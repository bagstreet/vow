// Slack adapter (T50 minimal: send + buttons). Pure: store + slack client injected, every branch testable offline.
// Link: DM the bot "/link CODE" (code comes from the dashboard). Events API (message in a DM) + block_actions interactivity.
// Ack rule (PLATFORM_CHECK): Slack interactions must be acked within 3s; this handler itself has no I/O delay,
// the HTTP layer calling it is expected to respond 200 immediately after awaiting this (no extra network round trip).
import { createHmac, timingSafeEqual } from 'node:crypto';
import { ROLES, ROLE_IDS } from '../../presets/roles/index.mjs';
import { parsePriority } from '../delivery/choose.mjs';
import { runIntent, loadSchedule } from './intent.mjs';
import { chatReply, withRoleLabel, shouldRemember, splitMessage, CHANNEL_LIMITS } from './chat.mjs';

const HELP = 'I am Vow. Commands: /link CODE, /login, /roles, /role <name>, /status, /quiet, /priority, /help.';
const CODE_RE = /^[A-Z0-9]{6,12}$/i;
const CHANNEL = 'slack';

/** Slack request signing (api.slack.com/authentication/verifying-requests-from-slack). rawBody is the exact request body string. */
export function verifySlackSignature(headers, rawBody, signingSecret, nowSec = Math.floor(Date.now() / 1000)) {
  const get = (k) => headers?.[k] ?? headers?.get?.(k);
  const ts = get('x-slack-request-timestamp');
  const sig = get('x-slack-signature');
  if (!signingSecret || !ts || !sig) return false;
  if (Math.abs(nowSec - Number(ts)) > 60 * 5) return false; // replay guard
  const base = `v0:${ts}:${rawBody}`;
  const expected = `v0=${createHmac('sha256', signingSecret).update(base).digest('hex')}`;
  const a = Buffer.from(expected); const b = Buffer.from(String(sig));
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Events API entry point. Handles the one-time url_verification handshake and DM messages. */
export async function handleEvent(body, { store, slack, webBase, llm, memory, settle }) {
  if (body?.type === 'url_verification') return { ok: true, challenge: body.challenge };
  if (body?.type !== 'event_callback') return { ok: true, ignored: 'not_event' };

  const ev = body.event;
  if (!ev || ev.type !== 'message' || ev.subtype || ev.bot_id) return { ok: true, ignored: 'not_a_user_message' };
  if (await store.seenUpdate(`slack:${ev.channel}:${ev.ts}`)) return { ok: true, duplicate: true };

  const text = String(ev.text ?? '').trim();
  if (!text) return { ok: true, ignored: 'no_text' };
  const chat = String(ev.channel);
  const send = async (t) => { let r; for (const part of splitMessage(t, CHANNEL_LIMITS.slack)) r = await slack.postMessage(chat, part); return r; };
  const m = text.match(/^\/(\w+)(?:\s+(.*))?$/s);
  const cmd = m?.[1]?.toLowerCase(); const arg = (m?.[2] ?? '').trim();
  const user = await store.userByChat(chat, CHANNEL);
  if (user?.blocked) { await send('Your Vow account is suspended. Contact the project administrator.'); return { ok: true, ignored: 'blocked' }; }
  if (user) await store.touchChannel?.(chat, CHANNEL); // activity feeds delivery ranking

  if (cmd === 'link') {
    const code = arg.split(/\s+/)[0];
    if (!code) {
      if (user) { await send('Already linked. Try /roles or /status.'); return { ok: true, cmd }; }
      await store.signUp(CHANNEL, chat); await send('Welcome to Vow! I created your account with the Fitness role. /roles to see roles, /login for the dashboard, /priority to choose where I reach you first. Add more channels from the dashboard: same memory everywhere.'); return { ok: true, cmd, signedUp: true };
    }
    if (!CODE_RE.test(code)) { await send('That code does not look right. Codes are 6-12 letters/digits.'); return { ok: true, cmd, linked: false }; }
    const r = await store.consumeLinkCode(code.toUpperCase(), CHANNEL);
    if (!r) { await send('That code is invalid or expired. Create a new one in the dashboard.'); return { ok: true, cmd, linked: false }; }
    const priorChannels = ((await store.listChannels?.(r.userId)) ?? []).filter((c) => c !== CHANNEL);
    await store.linkChannel(r.userId, CHANNEL, chat);
    await send('Linked. I will remind you here. Use /roles to see who answers what.');
    if (priorChannels.length) await send(`Welcome back — I already know you from ${priorChannels.join(', ')}. Same memory, one more place to reach me.`);
    return { ok: true, cmd, linked: true };
  }
  if (!user) {
    await store.signUp(CHANNEL, chat); await send('Welcome to Vow! I created your account with the Fitness role. /roles to see roles, /login for the dashboard, /priority to choose where I reach you first. Add more channels from the dashboard: same memory everywhere.');
    return { ok: true, signedUp: true };
  }

  switch (cmd) {
    case 'help': await send(HELP); break;
    case 'login': { const t = await store.createLoginToken(user.id); await send(`Sign in (valid 10 min, one use): ${webBase}/login?t=${t}`); break; }
    case 'roles': {
      const on = new Set(await store.listRoles(user.id));
      await send(ROLE_IDS.map((id) => `${on.has(id) ? '✅' : '▫️'} ${ROLES[id].emoji} ${id}: ${ROLES[id].label}`).join('\n') + '\n\nSwitch default: /role <name>'); break;
    }
    case 'role': {
      const id = arg.toLowerCase(); const on = await store.listRoles(user.id);
      if (!ROLES[id]) await send(`Unknown role. Choose: ${ROLE_IDS.join(', ')}.`);
      else if (!on.includes(id)) await send(`${ROLES[id].label} is not enabled. Enable it in the dashboard first.`);
      else { await store.setDefaultRole(user.id, id); await send(`Default role: ${ROLES[id].emoji} ${ROLES[id].label}.`); }
      break;
    }
    case 'status': { const on = await store.listRoles(user.id); await send(`Linked. Active roles: ${on.length ? on.join(', ') : 'none'}.`); break; }
    case 'priority': {
      const list = parsePriority(arg);
      await store.setChannelPriority?.(user.id, list);
      await send(list.length ? `Delivery order: ${list.join(' > ')}. Reminders try the first, then escalate to the next.` : 'Delivery order: automatic (the channel you used most recently). Set one with /priority slack telegram.');
      break;
    }
    case 'quiet': await store.setQuiet(user.id, arg || null); await send(arg ? `Quiet hours set: ${arg}.` : 'Quiet hours cleared. Use /quiet 22:00-07:00 to set.'); break;
    default: {
      if (cmd || !llm) return { ok: true, cmd: cmd ?? 'chat', route: 'router' };
      const enabled = await store.listRoles(user.id);
      const act = await runIntent({ text, user, store, memory, settle, channel: CHANNEL, enabled });
      if (act) {
        await store.saveMessage?.(user.id, CHANNEL, 'in', text, act.role ?? null);
        await store.saveMessage?.(user.id, CHANNEL, 'out', act.text, act.role ?? null);
        await send(act.text);
        return { ok: true, cmd: 'intent', role: act.role ?? null };
      }
      const schedule = await loadSchedule(store, user.id);
      const history = (await store.getHistory?.(user.id)) ?? [];
      const remembered = memory ? await memory.recall(user.id, text) : [];
      const r = await chatReply({ text, enabled, def: user.default_role, llm, history, remembered, tone: user.tone, schedule, lastRole: user.last_role ?? null, channel: 'slack' });
      await store.setLastRole?.(user.id, r.role);
      await store.saveMessage?.(user.id, CHANNEL, 'in', text, r.role);
      await store.saveMessage?.(user.id, CHANNEL, 'out', r.text, r.role);
      if (memory && shouldRemember(text, r.role)) await memory.remember(user.id, `[slack] ${text}`);
      await send(withRoleLabel(r.text, r.role, user.role_label ?? 'always', user.last_role ?? null));
      return { ok: true, cmd: 'chat', role: r.role };
    }
  }
  return { ok: true, cmd };
}

/** Interactivity entry point: block_actions payload, one button press. action_id = "<occurrenceId>:<reply>" (mirrors the Telegram callback_data shape; action_id has no byte limit on Slack but we keep it consistent). */
export async function handleInteraction(payload, { store, memory, settle }) {
  if (payload?.type !== 'block_actions') return { ok: true, ignored: 'not_block_actions' };
  const action = payload.actions?.[0];
  const data = String(action?.action_id ?? action?.value ?? '');
  const i = data.lastIndexOf(':');
  if (i < 1) return { ok: true, ignored: 'bad_action' };
  const chat = String(payload.channel?.id ?? '');
  if (!(await store.userByChat(chat, CHANNEL))) return { ok: true, ignored: 'unlinked_chat' };
  const cqUser = await store.userByChat(chat, CHANNEL);
  const status = data.slice(i + 1);
  const info = await store.ackOccurrence(data.slice(0, i), status);
  if (info && settle) await settle({ ...info, status, via: 'slack' });
    if (memory && info) await memory.remember(cqUser.id, `[check-in, slack] "${info.title}" (${info.role}) -> ${status}`);
  return { ok: true, acked: data.slice(0, i) };
}
