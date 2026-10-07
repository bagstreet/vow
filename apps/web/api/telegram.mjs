// Vercel function: Telegram webhook. Env: DATABASE_URL, TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, WEB_BASE_URL
import { createSql } from '../../../packages/db/neon.mjs';
import { createNeonStore } from '../../../packages/core/channels/neon-store.mjs';
import { buildLlmClient } from '../../../packages/core/llm/index.mjs';
import { handleUpdate, verifySecret } from '../../../packages/core/channels/telegram-webhook.mjs';
import { createWalrusMemory } from '../../../packages/core/memory/walrus-memory.mjs';
import { buildMemwalSdk } from '../lib/walrus-memory-client.mjs';

export const config = { maxDuration: 30 };

const call = (token, method, body) => fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  if (!verifySecret(req.headers, process.env.TELEGRAM_WEBHOOK_SECRET)) return res.status(401).json({ ok: false });
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const tg = { sendMessage: (chat_id, text) => call(token, 'sendMessage', { chat_id, text }), answerCallbackQuery: (id) => call(token, 'answerCallbackQuery', { callback_query_id: id }) };
  try {
    const r = await handleUpdate(req.body, { store: createNeonStore(createSql()), tg, llm: buildLlmClient(), memory: createWalrusMemory(buildMemwalSdk()), webBase: process.env.WEB_BASE_URL ?? 'https://vow-livid.vercel.app' });
    return res.status(200).json(r);
  } catch (e) {
    console.error('telegram webhook', e.message);
    return res.status(200).json({ ok: false }); // 200 so Telegram does not retry-storm; idempotency covers real retries
  }
}

