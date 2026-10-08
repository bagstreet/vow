// Vercel function: Slack Events API + Interactivity (one endpoint, Slack sends both shapes here).
// Env: DATABASE_URL, SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET, WEB_BASE_URL
import { createSql } from '../../../packages/db/neon.mjs';
import { createNeonStore } from '../../../packages/core/channels/neon-store.mjs';
import { buildLlmClient } from '../../../packages/core/llm/index.mjs';
import { createWalrusMemory, withMemoryLog, withForgetFilter } from '../../../packages/core/memory/walrus-memory.mjs';
import { buildMemwalSdk } from '../lib/walrus-memory-client.mjs';
import { createSettler } from '../../../packages/core/delivery/handled.mjs'
import { handleEvent, handleInteraction, verifySlackSignature } from '../../../packages/core/channels/slack-webhook.mjs';

export const config = { api: { bodyParser: false } }; // need the raw body for signature verification

async function readRawBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

const settle = createSettler({ telegram: process.env.TELEGRAM_BOT_TOKEN, slack: process.env.SLACK_BOT_TOKEN, discord: process.env.DISCORD_BOT_TOKEN })

export default async function handler(req, res) {
  const dbStore = createNeonStore(createSql());
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const raw = await readRawBody(req);
  if (!verifySlackSignature(req.headers, raw, process.env.SLACK_SIGNING_SECRET)) return res.status(401).json({ ok: false });

  let body;
  try { body = JSON.parse(raw); } catch { return res.status(400).json({ ok: false }); }
  // Interactivity requests arrive as application/x-www-form-urlencoded with a `payload` field.
  if (typeof body !== 'object' || body === null) {
    const params = new URLSearchParams(raw);
    const payload = params.get('payload');
    body = payload ? JSON.parse(payload) : {};
  }

  const token = process.env.SLACK_BOT_TOKEN;
  const slack = { postMessage: (channel, text) => fetch('https://slack.com/api/chat.postMessage', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ channel, text }) }) };
  const ctx = { store: dbStore, slack, llm: buildLlmClient(), memory: withMemoryLog(withForgetFilter(createWalrusMemory(buildMemwalSdk()), (u) => dbStore.listForgotten(u)), (u, r) => dbStore.logMemory(u, r), 'slack'), settle, webBase: process.env.WEB_BASE_URL ?? 'https://vow-livid.vercel.app' };

  try {
    if (body.type === 'block_actions') { await handleInteraction(body, ctx); return res.status(200).json({ ok: true }); }
    const r = await handleEvent(body, ctx);
    if (body.type === 'url_verification') return res.status(200).json({ challenge: r.challenge });
    return res.status(200).json(r);
  } catch (e) {
    console.error('slack webhook', e.message);
    return res.status(200).json({ ok: false });
  }
}
