// Vercel function: reminder tick. Called every minute by cron-job.org (primary) and every 5 min by GitHub Actions (backup).
// Env: DATABASE_URL, TELEGRAM_BOT_TOKEN, DISCORD_BOT_TOKEN, SLACK_BOT_TOKEN, TICK_SECRET
import { timingSafeEqual } from 'node:crypto';
import { createSql } from '../../../packages/db/neon.mjs';
import { createNeonTickStore } from '../../../packages/core/scheduler/neon-tick-store.mjs';
import { createNeonDashStore } from '../../../packages/core/dashboard/neon-dash-store.mjs';
import { buildMemory } from '../lib/memory-stack.mjs';
import { runTick } from '../../../packages/core/scheduler/tick.mjs';
import { buildLlmClient } from '../../../packages/core/llm/index.mjs';
import { pickButtons } from '../../../packages/core/channels/buttons.mjs';
import { createTelegramAdapter } from '../../../packages/core/delivery/adapters/telegram.mjs';
import { createSlackAdapter } from '../../../packages/core/delivery/adapters/slack.mjs';
import { createDiscordAdapter } from '../../../packages/core/delivery/adapters/discord.mjs';

export function authorized(headers, secret) {
  const got = String(headers['x-tick-secret'] ?? '');
  if (!secret || got.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(secret));
}

// Only Slack exposes presence to bots (users.getPresence: active/away). Telegram and Discord bots cannot see it, so they fall back to last_seen_at.
const slackPresence = (token) => async (c) => {
  if (c.channel !== 'slack') return null;
  const call = (method, init) => fetch(`https://slack.com/api/${method}`, { ...init, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json; charset=utf-8' }, signal: AbortSignal.timeout(2500) }).then((x) => x.json());
  let user = /^[UW][A-Z0-9]+$/.test(c.externalId ?? '') ? c.externalId : null;
  if (!user && /^D[A-Z0-9]+$/.test(c.externalId ?? '')) { // channel_links stores the DM channel id; conversations.open(return_im) maps it back to the user (needs only im:write)
    const o = await call('conversations.open', { method: 'POST', body: JSON.stringify({ channel: c.externalId, return_im: true }) });
    user = o.ok ? o.channel?.user ?? null : null;
  }
  if (!user) return null;
  const r = await call(`users.getPresence?user=${user}`, { method: 'GET' });
  return r.ok ? r.presence === 'active' : null;
};

const discordDmCache = new Map(); // survives across ticks on a warm lambda; keyed by Discord user id, see adapters/discord.mjs

export default async function handler(req, res) {
  if (!['POST', 'GET'].includes(req.method)) return res.status(405).json({ ok: false });
  if (!authorized(req.headers, process.env.TICK_SECRET)) return res.status(401).json({ ok: false });
  const tgToken = process.env.TELEGRAM_BOT_TOKEN;
  const dcToken = process.env.DISCORD_BOT_TOKEN;
  const slToken = process.env.SLACK_BOT_TOKEN;
  const senders = {
    ...(tgToken ? { telegram: ({ externalId, text, buttons, outboxId }) => createTelegramAdapter({ token: tgToken, chatId: externalId }).send({ occurrenceId: outboxId, text, buttons }).then(r => ({ ref: `${externalId}:${r.message_id}` })) } : {}),
    ...(dcToken ? { discord: ({ externalId, text, buttons, outboxId }) => createDiscordAdapter({ token: dcToken, userId: externalId, dmChannelCache: discordDmCache }).send({ occurrenceId: outboxId, text, buttons }).then(r => ({ ref: `${r.channel_id}:${r.id}` })) } : {}),
    extension: async () => ({ ref: 'extension' }), // pull channel: the outbox row is the inbox item the extension polls
    ...(slToken ? { slack: ({ externalId, text, buttons, outboxId }) => createSlackAdapter({ token: slToken, channelId: externalId }).send({ occurrenceId: outboxId, text, buttons }).then(r => ({ ref: `${r.channel}:${r.ts}` })) } : {}),
  };
  const llm = buildLlmClient();
  try {
    const result = await runTick({ store: createNeonTickStore(createSql()), senders, pickButtons: (a) => pickButtons({ ...a, llm }), presence: slToken ? slackPresence(slToken) : null });
    let digests = 0;
    try { const ds = createNeonDashStore(createSql()); digests = await buildMemory(ds, 'digest').flushDue?.() ?? 0; } catch (e) { console.error('digest flush', e.message); }
    return res.status(200).json({ ok: true, ...result, digests });
  } catch (e) {
    console.error('tick', e.message);
    return res.status(500).json({ ok: false });
  }
}
