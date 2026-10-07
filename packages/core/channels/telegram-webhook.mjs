// Telegram webhook handler (T47/T54). Pure: store + tg client injected, so every branch is testable offline.
// Link: deep link t.me/<bot>?start=<code> or manual /link CODE. /login returns a one-time web link (login happens via the bot).
import { ROLES, ROLE_IDS } from '../../presets/roles/index.mjs';
import { chatReply, withRoleLabel } from './chat.mjs';

const HELP = 'I am Vow. Commands: /link CODE, /login, /roles, /role <name>, /status, /quiet, /help.';
const CODE_RE = /^[A-Z0-9]{6,12}$/i;

export function verifySecret(headers, expected) {
  const got = headers?.['x-telegram-bot-api-secret-token'] ?? headers?.get?.('x-telegram-bot-api-secret-token');
  return Boolean(expected) && got === expected;
}

export async function handleUpdate(update, { store, tg, webBase, llm }) {
  if (!update || typeof update.update_id !== 'number') return { ok: false, reason: 'bad_update' };
  if (await store.seenUpdate(update.update_id)) return { ok: true, duplicate: true };

  const cq = update.callback_query;
  if (cq) {
    const data = String(cq.data ?? ''); const i = data.lastIndexOf(':');
    await tg.answerCallbackQuery(cq.id);
    if (i < 1 || Buffer.byteLength(data) > 64) return { ok: true, ignored: 'bad_callback' };
    const chat = String(cq.message?.chat?.id ?? '');
    if (!(await store.userByChat(chat))) return { ok: true, ignored: 'unlinked_chat' };
    await store.ackOccurrence(data.slice(0, i), data.slice(i + 1));
    return { ok: true, acked: data.slice(0, i) };
  }

  const msg = update.message; const text = String(msg?.text ?? '').trim();
  if (!msg || !text) return { ok: true, ignored: 'no_text' };
  const chat = String(msg.chat.id); const send = (t) => tg.sendMessage(chat, t);
  const m = text.match(/^\/(\w+)(?:@\w+)?(?:\s+(.*))?$/s);
  const cmd = m?.[1]?.toLowerCase(); const arg = (m?.[2] ?? '').trim();
  const user = await store.userByChat(chat);

  if (cmd === 'start' || cmd === 'link') {
    const code = arg.split(/\s+/)[0];
    if (!code) { await send(user ? 'Already linked. Try /roles or /status.' : 'Open the dashboard, press "Connect Telegram", then send me the code with /link CODE.'); return { ok: true, cmd }; }
    if (!CODE_RE.test(code)) { await send('That code does not look right. Codes are 6-12 letters/digits.'); return { ok: true, cmd, linked: false }; }
    const r = await store.consumeLinkCode(code.toUpperCase());
    if (!r) { await send('That code is invalid or expired. Create a new one in the dashboard.'); return { ok: true, cmd, linked: false }; }
    await store.linkChannel(r.userId, 'telegram', chat);
    await send('Linked. I will remind you here. Use /roles to see who answers what.');
    return { ok: true, cmd, linked: true };
  }
  if (!user) { await send('Not linked yet. Get a code in the dashboard, then /link CODE.'); return { ok: true, ignored: 'unlinked' }; }

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
    case 'quiet': await store.setQuiet(user.id, arg || null); await send(arg ? `Quiet hours set: ${arg}.` : 'Quiet hours cleared. Use /quiet 22:00-07:00 to set.'); break;
    default: {
      if (cmd || !llm) return { ok: true, cmd: cmd ?? 'chat', route: 'router' };
      const enabled = await store.listRoles(user.id);
      const r = await chatReply({ text, enabled, def: user.default_role, llm });
      await send(withRoleLabel(r.text, r.role, user.role_label ?? 'always', user.last_role ?? null));
      return { ok: true, cmd: 'chat', role: r.role };
    }
  }
  return { ok: true, cmd };
}

export function createMemoryStore() {
  const s = { seen: new Set(), codes: new Map(), chats: new Map(), roles: new Map(), acks: [], logins: [], quiet: new Map(), def: new Map() };
  return {
    _s: s,
    seenUpdate: async (id) => (s.seen.has(id) ? true : (s.seen.add(id), false)),
    consumeLinkCode: async (c) => { const r = s.codes.get(c); if (!r || r.exp < Date.now()) return null; s.codes.delete(c); return { userId: r.userId }; },
    linkChannel: async (userId, _ch, chat) => { s.chats.set(chat, { id: userId }); },
    userByChat: async (chat) => s.chats.get(chat) ?? null,
    listRoles: async (u) => s.roles.get(u) ?? [],
    setDefaultRole: async (u, r) => { s.def.set(u, r); },
    setQuiet: async (u, v) => { s.quiet.set(u, v); },
    ackOccurrence: async (id, reply) => { s.acks.push([id, reply]); },
    createLoginToken: async (u) => { const t = 'tok' + s.logins.length; s.logins.push([u, t]); return t; },
  };
}
