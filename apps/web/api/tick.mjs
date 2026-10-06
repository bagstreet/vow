// Vercel function: reminder tick. Called every minute by cron-job.org (primary) and every 5 min by GitHub Actions (backup).
// Env: DATABASE_URL, TELEGRAM_BOT_TOKEN, TICK_SECRET
import { timingSafeEqual } from 'node:crypto';
import { createSql } from '../../../packages/db/neon.mjs';
import { createNeonTickStore } from '../../../packages/core/scheduler/neon-tick-store.mjs';
import { runTick } from '../../../packages/core/scheduler/tick.mjs';
import { createTelegramAdapter } from '../../../packages/core/delivery/adapters/telegram.mjs';

export function authorized(headers, secret) {
  const got = String(headers['x-tick-secret'] ?? '');
  if (!secret || got.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(secret));
}

export default async function handler(req, res) {
  if (!['POST', 'GET'].includes(req.method)) return res.status(405).json({ ok: false });
  if (!authorized(req.headers, process.env.TICK_SECRET)) return res.status(401).json({ ok: false });
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const senders = token ? { telegram: ({ externalId, text, buttons, outboxId }) => createTelegramAdapter({ token, chatId: externalId }).send({ occurrenceId: outboxId, text, buttons }) } : {};
  try {
    const result = await runTick({ store: createNeonTickStore(createSql()), senders });
    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    console.error('tick', e.message);
    return res.status(500).json({ ok: false });
  }
}
