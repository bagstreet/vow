// Vercel function: Discord Interactions endpoint. Env: DATABASE_URL, DISCORD_PUBLIC_KEY, WEB_BASE_URL
import { createSql } from '../../../packages/db/neon.mjs';
import { createNeonStore } from '../../../packages/core/channels/neon-store.mjs';
import { buildLlmClient } from '../../../packages/core/llm/index.mjs';
import { handleInteraction, verifyDiscordSignature } from '../../../packages/core/channels/discord-webhook.mjs';
import { createWalrusMemory } from '../../../packages/core/memory/walrus-memory.mjs';
import { buildMemwalSdk } from '../lib/walrus-memory-client.mjs';

export const config = { api: { bodyParser: false }, maxDuration: 30 }; // need the raw body for Ed25519 signature verification

async function readRawBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const raw = await readRawBody(req);
  if (!verifyDiscordSignature(req.headers, raw, process.env.DISCORD_PUBLIC_KEY)) return res.status(401).end();

  let body;
  try { body = JSON.parse(raw); } catch { return res.status(400).json({ ok: false }); }

  try {
    const r = await handleInteraction(body, { store: createNeonStore(createSql()), llm: buildLlmClient(), memory: createWalrusMemory(buildMemwalSdk()), webBase: process.env.WEB_BASE_URL ?? 'https://vow-livid.vercel.app' });
    return res.status(200).json(r);
  } catch (e) {
    console.error('discord webhook', e.message);
    return res.status(200).json({ type: 4, data: { content: 'Something went wrong, try again.' } });
  }
}

