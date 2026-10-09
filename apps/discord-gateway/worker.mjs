// Discord Gateway relay: receives direct messages and forwards them to the Vow API, then posts the reply.
// Env: DISCORD_BOT_TOKEN, VOW_API_URL (default https://vow-livid.vercel.app), PORT (health endpoint).
import http from 'node:http';
import crypto from 'node:crypto';
import WebSocket from 'ws';

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const API = (process.env.VOW_API_URL ?? 'https://vow-livid.vercel.app').replace(/\/$/, '');
if (!TOKEN) { console.error('DISCORD_BOT_TOKEN is required'); process.exit(1); }
const AUTH = crypto.createHash('sha256').update(TOKEN).digest('hex');
const DM_INTENT = 1 << 12;
const COMMANDS = new Set(['link', 'login', 'roles', 'role', 'status', 'quiet', 'priority', 'help']);
const ARG = { link: 'code', role: 'name', quiet: 'hours', priority: 'order' };

/** "/link ABC" -> command interaction; any other text -> ask. */
export function toInteraction(msg) {
  const text = String(msg.content ?? '').trim();
  const m = /^\/(\w+)\s*(.*)$/.exec(text);
  const base = { id: `gw-${msg.id}`, type: 2, channel_id: msg.channel_id, user: { id: msg.author.id, username: msg.author.username } };
  if (m && COMMANDS.has(m[1].toLowerCase())) {
    const name = m[1].toLowerCase();
    const options = ARG[name] && m[2] ? [{ name: ARG[name], type: 3, value: m[2].trim() }] : [];
    return { ...base, data: { name, options } };
  }
  return { ...base, data: { name: 'ask', options: [{ name: 'text', type: 3, value: text }] } };
}

async function reply(channelId, content) {
  await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: 'POST', headers: { authorization: `Bot ${TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ content: String(content).slice(0, 1990) }),
  });
}

async function onMessage(msg) {
  if (msg.author?.bot || msg.guild_id || !msg.content) return; // direct messages from people only
  try {
    const r = await fetch(`${API}/api/discord`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-gateway-auth': AUTH }, body: JSON.stringify(toInteraction(msg)) });
    const j = await r.json();
    await reply(msg.channel_id, j?.data?.content ?? 'Done.');
  } catch (e) {
    console.error('relay failed', e.message);
    await reply(msg.channel_id, 'Something went wrong, try again.').catch(() => {});
  }
}

function connect() {
  const ws = new WebSocket('wss://gateway.discord.gg/?v=10&encoding=json');
  let hb, seq = null;
  ws.on('message', (raw) => {
    const p = JSON.parse(raw);
    if (p.s != null) seq = p.s;
    if (p.op === 10) {
      hb = setInterval(() => ws.send(JSON.stringify({ op: 1, d: seq })), p.d.heartbeat_interval);
      ws.send(JSON.stringify({ op: 2, d: { token: TOKEN, intents: DM_INTENT, properties: { os: 'linux', browser: 'vow', device: 'vow' } } }));
    } else if (p.op === 7 || p.op === 9) ws.close();
    else if (p.t === 'READY') console.log('gateway ready');
    else if (p.t === 'MESSAGE_CREATE') onMessage(p.d);
  });
  ws.on('close', () => { clearInterval(hb); console.log('gateway closed, reconnecting'); setTimeout(connect, 3000); });
  ws.on('error', (e) => console.error('ws', e.message));
}

if (process.argv[1]?.endsWith('worker.mjs')) {
  http.createServer((_, res) => { res.writeHead(200); res.end('ok'); }).listen(process.env.PORT ?? 8080);
  connect();
}
