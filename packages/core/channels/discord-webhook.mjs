// Discord adapter (T50 minimal: slash commands + buttons). No Gateway connection (BACKEND_PLAN: a long-running
// worker is only needed for presence, which Discord treats as unknown here by default) — everything goes through
// the HTTP Interactions endpoint, so chat is a slash command ("/ask <text>"), not a free DM like Telegram/Slack.
// Pure: store injected, every branch testable offline. Responses are returned, not sent via a separate API call
// (Discord interactions are request/response).
import { createPublicKey, verify as cryptoVerify } from 'node:crypto';
import { ROLES, ROLE_IDS } from '../../presets/roles/index.mjs';
import { parsePriority } from '../delivery/choose.mjs';
import { chatReply, withRoleLabel } from './chat.mjs';

const HELP = 'I am Vow. Commands: /link code:CODE, /login, /roles, /role name:<role>, /status, /quiet hours:<HH:MM-HH:MM>, /priority order:<slack telegram discord>, /ask text:<question>, /help.';
const CODE_RE = /^[A-Z0-9]{6,12}$/i;
const CHANNEL = 'discord';
const PING = 1;
const APPLICATION_COMMAND = 2;
const MESSAGE_COMPONENT = 3;
const PONG = { type: 1 };
const EPHEMERAL = 64; // visible only to the invoking user — commands here carry link codes/login tokens, never post them to the whole channel
const reply = (content, extra) => ({ type: 4, data: { content, flags: EPHEMERAL, ...extra } });
const ackUpdate = () => ({ type: 6 }); // DEFERRED_UPDATE_MESSAGE-style silent ack for button presses

/** Discord Ed25519 request signing (discord.com/developers/docs/interactions/overview#setting-up-an-endpoint). */
export function verifyDiscordSignature(headers, rawBody, publicKeyHex) {
  const get = (k) => headers?.[k] ?? headers?.get?.(k);
  const sig = get('x-signature-ed25519');
  const ts = get('x-signature-timestamp');
  if (!publicKeyHex || !sig || !ts) return false;
  try {
    const rawPub = Buffer.from(publicKeyHex, 'hex');
    if (rawPub.length !== 32) return false;
    const spkiHeader = Buffer.from('302a300506032b6570032100', 'hex'); // fixed ASN.1 prefix for a raw Ed25519 SPKI key
    const keyObj = createPublicKey({ key: Buffer.concat([spkiHeader, rawPub]), format: 'der', type: 'spki' });
    return cryptoVerify(null, Buffer.from(ts + rawBody), keyObj, Buffer.from(sig, 'hex'));
  } catch {
    return false;
  }
}

function opt(interaction, name) {
  return interaction?.data?.options?.find((o) => o.name === name)?.value;
}

/** Single entry point for every Discord interaction (PING, slash command, button press). */
export async function handleInteraction(interaction, { store, webBase, llm, memory }) {
  if (interaction?.type === PING) return PONG;

  // Identity key for linking/storage: prefer the Discord *user* id (interaction.member.user in a guild,
  // interaction.user in a DM) over channel_id. A slash command can be run from any guild channel, but
  // reminders are sent via DM (see delivery/adapters/discord.mjs), which needs the user id, not that
  // channel. Falls back to channel_id only when no user id is present (keeps older/offline tests valid).
  const chat = String(interaction.member?.user?.id ?? interaction.user?.id ?? interaction.channel_id ?? interaction.channel?.id ?? '');

  if (interaction.type === MESSAGE_COMPONENT) {
    const data = String(interaction.data?.custom_id ?? '');
    const i = data.lastIndexOf(':');
    if (i < 1) return ackUpdate();
    const cqUser = await store.userByChat(chat, CHANNEL);
    if (!cqUser) return ackUpdate();
    const status = data.slice(i + 1);
    const info = await store.ackOccurrence(data.slice(0, i), status);
    if (memory && info) await memory.remember(cqUser.id, `[check-in, discord] "${info.title}" (${info.role}) -> ${status}`);
    return ackUpdate();
  }

  if (interaction.type !== APPLICATION_COMMAND) return reply('Unsupported interaction.');
  if (await store.seenUpdate(`discord:${interaction.id}`)) return reply('Already processed.');

  const cmd = String(interaction.data?.name ?? '').toLowerCase();
  const user = await store.userByChat(chat, CHANNEL);
  if (user) await store.touchChannel?.(chat, CHANNEL); // activity feeds delivery ranking

  if (cmd === 'link') {
    const code = String(opt(interaction, 'code') ?? '').trim();
    if (!code) return reply(user ? 'Already linked. Try /roles or /status.' : 'Open the dashboard, press "Connect Discord", then run /link code:CODE.');
    if (!CODE_RE.test(code)) return reply('That code does not look right. Codes are 6-12 letters/digits.');
    const r = await store.consumeLinkCode(code.toUpperCase(), CHANNEL);
    if (!r) return reply('That code is invalid or expired. Create a new one in the dashboard.');
    const priorChannels = ((await store.listChannels?.(r.userId)) ?? []).filter((c) => c !== CHANNEL);
    await store.linkChannel(r.userId, CHANNEL, chat);
    return reply(priorChannels.length
      ? `Linked. I will remind you here. Welcome back — I already know you from ${priorChannels.join(', ')}. Same memory, one more place to reach me.`
      : 'Linked. I will remind you here. Use /roles to see who answers what.');
  }
  if (!user) return reply('Not linked yet. Get a code in the dashboard, then /link code:CODE.');

  switch (cmd) {
    case 'help': return reply(HELP);
    case 'login': { const t = await store.createLoginToken(user.id); return reply(`Sign in (valid 10 min, one use): ${webBase}/login?t=${t}`); }
    case 'roles': {
      const on = new Set(await store.listRoles(user.id));
      return reply(ROLE_IDS.map((id) => `${on.has(id) ? '✅' : '▫️'} ${ROLES[id].emoji} ${id}: ${ROLES[id].label}`).join('\n') + '\n\nSwitch default: /role name:<role>');
    }
    case 'role': {
      const id = String(opt(interaction, 'name') ?? '').toLowerCase(); const on = await store.listRoles(user.id);
      if (!ROLES[id]) return reply(`Unknown role. Choose: ${ROLE_IDS.join(', ')}.`);
      if (!on.includes(id)) return reply(`${ROLES[id].label} is not enabled. Enable it in the dashboard first.`);
      await store.setDefaultRole(user.id, id);
      return reply(`Default role: ${ROLES[id].emoji} ${ROLES[id].label}.`);
    }
    case 'status': { const on = await store.listRoles(user.id); return reply(`Linked. Active roles: ${on.length ? on.join(', ') : 'none'}.`); }
    case 'priority': { const list = parsePriority(opt(interaction, 'order')); await store.setChannelPriority?.(user.id, list); return reply(list.length ? `Delivery order: ${list.join(' > ')}. Reminders try the first, then escalate to the next.` : 'Delivery order: automatic (the channel you used most recently).'); }
    case 'quiet': { const v = opt(interaction, 'hours'); await store.setQuiet(user.id, v || null); return reply(v ? `Quiet hours set: ${v}.` : 'Quiet hours cleared.'); }
    case 'ask': {
      const text = String(opt(interaction, 'text') ?? '').trim();
      if (!text || !llm) return reply('Ask something, e.g. /ask text: plan my leg day.');
      const enabled = await store.listRoles(user.id);
      const history = (await store.getHistory?.(user.id)) ?? [];
      const remembered = memory ? await memory.recall(user.id, text) : [];
      const r = await chatReply({ text, enabled, def: user.default_role, llm, history, remembered });
      await store.setLastRole?.(user.id, r.role);
      await store.saveMessage?.(user.id, CHANNEL, 'in', text, r.role);
      await store.saveMessage?.(user.id, CHANNEL, 'out', r.text, r.role);
      if (memory) await memory.remember(user.id, `[discord] ${text}`);
      return reply(withRoleLabel(r.text, r.role, user.role_label ?? 'always', user.last_role ?? null));
    }
    default: return reply('Unknown command. Try /help.');
  }
}
