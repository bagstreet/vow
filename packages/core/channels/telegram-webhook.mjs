// Telegram webhook handler (T47/T54). Pure: store + tg client injected, so every branch is testable offline.
// Link: deep link t.me/<bot>?start=<code> or manual /link CODE. /login returns a one-time web link (login happens via the bot).
import { ROLES, ROLE_IDS } from '../../presets/roles/index.mjs';
import { parsePriority } from '../delivery/choose.mjs';
import { runIntent, loadSchedule } from './intent.mjs';
import { chatReply, withRoleLabel, shouldRemember } from './chat.mjs';

const HELP = 'I am Vow. Commands: /link CODE, /login, /roles, /role <name>, /status, /quiet, /priority, /help.';
const CHANNEL = 'telegram';
const CODE_RE = /^[A-Z0-9]{6,12}$/i;

export function verifySecret(headers, expected) {
  const got = headers?.['x-telegram-bot-api-secret-token'] ?? headers?.get?.('x-telegram-bot-api-secret-token');
  return Boolean(expected) && got === expected;
}

export async function handleUpdate(update, { store, tg, webBase, llm, memory, settle }) {
  if (!update || typeof update.update_id !== 'number') return { ok: false, reason: 'bad_update' };
  if (await store.seenUpdate(update.update_id)) return { ok: true, duplicate: true };

  const cq = update.callback_query;
  if (cq) {
    const data = String(cq.data ?? ''); const i = data.lastIndexOf(':');
    await tg.answerCallbackQuery(cq.id);
    if (i < 1 || Buffer.byteLength(data) > 64) return { ok: true, ignored: 'bad_callback' };
    const chat = String(cq.message?.chat?.id ?? '');
    const cqUser = await store.userByChat(chat);
    if (!cqUser) return { ok: true, ignored: 'unlinked_chat' };
    const status = data.slice(i + 1);
    const info = await store.ackOccurrence(data.slice(0, i), status);
    if (info && settle) await settle({ ...info, status, via: 'telegram' });
    if (memory && info) await memory.remember(cqUser.id, `[check-in, telegram] "${info.title}" (${info.role}) -> ${status}`);
    return { ok: true, acked: data.slice(0, i) };
  }

  const msg = update.message; const text = String(msg?.text ?? '').trim();
  if (!msg || !text) return { ok: true, ignored: 'no_text' };
  const chat = String(msg.chat.id); const send = (t) => tg.sendMessage(chat, t);
  const m = text.match(/^\/(\w+)(?:@\w+)?(?:\s+(.*))?$/s);
  const cmd = m?.[1]?.toLowerCase(); const arg = (m?.[2] ?? '').trim();
  const user = await store.userByChat(chat);
  if (user) await store.touchChannel?.(chat, 'telegram'); // activity feeds delivery ranking

  if (cmd === 'start' || cmd === 'link') {
    const code = arg.split(/\s+/)[0];
    if (!code) {
      if (user) { await send('Already linked. Try /roles or /status.'); return { ok: true, cmd }; }
      await store.signUp(CHANNEL, chat, msg.from?.first_name);
      await send('Welcome to Vow! I created your account with the Fitness role. /roles to see roles, /login for the dashboard, /priority to choose where I reach you first. Add more channels from the dashboard: same memory everywhere.'); return { ok: true, cmd, signedUp: true };
    }
    if (!CODE_RE.test(code)) { await send('That code does not look right. Codes are 6-12 letters/digits.'); return { ok: true, cmd, linked: false }; }
    const r = await store.consumeLinkCode(code.toUpperCase());
    if (!r) { await send('That code is invalid or expired. Create a new one in the dashboard.'); return { ok: true, cmd, linked: false }; }
    const priorChannels = ((await store.listChannels?.(r.userId)) ?? []).filter((c) => c !== 'telegram');
    await store.linkChannel(r.userId, 'telegram', chat);
    await send('Linked. I will remind you here. Use /roles to see who answers what.');
    if (priorChannels.length) await send(`Welcome back — I already know you from ${priorChannels.join(', ')}. Same memory, one more place to reach me.`);
    return { ok: true, cmd, linked: true };
  }
  if (!user) { await send('Send /start to create your account, or /link CODE to add this chat to an existing one.'); return { ok: true, ignored: 'unlinked' }; }

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
    case 'priority': { const list = parsePriority(arg); await store.setChannelPriority?.(user.id, list); await send(list.length ? `Delivery order: ${list.join(' > ')}. Reminders try the first, then escalate to the next.` : 'Delivery order: automatic (the channel you used most recently). Set one with /priority slack telegram.'); break; }
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
      const r = await chatReply({ text, enabled, def: user.default_role, llm, history, remembered, tone: user.tone, schedule });
      await store.setLastRole?.(user.id, r.role);
      await store.saveMessage?.(user.id, 'telegram', 'in', text, r.role);
      await store.saveMessage?.(user.id, 'telegram', 'out', r.text, r.role);
      await send(withRoleLabel(r.text, r.role, user.role_label ?? 'always', user.last_role ?? null));
      if (memory && shouldRemember(text, r.role)) await memory.remember(user.id, `[telegram] ${text}`);
      return { ok: true, cmd: 'chat', role: r.role };
    }
  }
  return { ok: true, cmd };
}

export function createMemoryStore() {
  const s = { seen: new Set(), codes: new Map(), chats: new Map(), roles: new Map(), acks: [], logins: [], quiet: new Map(), def: new Map(), history: new Map() };
  return {
    _s: s,
    seenUpdate: async (id) => (s.seen.has(id) ? true : (s.seen.add(id), false)),
    consumeLinkCode: async (c) => { const r = s.codes.get(c); if (!r || r.exp < Date.now()) return null; s.codes.delete(c); return { userId: r.userId }; },
    linkChannel: async (userId, _ch, chat) => { s.chats.set(chat, { id: userId }); },
    listChannels: async () => [],
    signUp: async (_channel, chat) => { const id = 'u' + (s.chats.size + 1); s.chats.set(chat, { id }); s.roles.set(id, ['fitness']); return { id }; },
    userByChat: async (chat) => s.chats.get(chat) ?? null,
    listRoles: async (u) => s.roles.get(u) ?? [],
    setDefaultRole: async (u, r) => { s.def.set(u, r); },
    setQuiet: async (u, v) => { s.quiet.set(u, v); },
    setChannelPriority: async (u, l) => { s.prio = s.prio ?? new Map(); s.prio.set(u, l); },
    touchChannel: async () => {},
    ackOccurrence: async (id, reply) => { s.acks.push([id, reply]); },
    createLoginToken: async (u) => { const t = 'tok' + s.logins.length; s.logins.push([u, t]); return t; },
    getHistory: async (u, limit = 12) => (s.history.get(u) ?? []).slice(-limit),
    saveMessage: async (u, _channel, direction, content, role) => {
      const h = s.history.get(u) ?? []; h.push({ direction, appRole: role ?? null, content }); s.history.set(u, h);
    },
  };
}
