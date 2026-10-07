// Vercel function: issue a one-time link code for the dashboard "Connect <channel>" button (T54).
// Env: DATABASE_URL, TELEGRAM_BOT_TOKEN (to build the t.me deep link; code works without it too).
import { createSql } from '../../../packages/db/neon.mjs';
import { createAccountStore } from '../../../packages/core/channels/account-store.mjs';
import { issueLinkCode } from '../../../packages/core/channels/account.mjs';

let cachedBotUsername; // warm-lambda best-effort cache; refetched if a cold start clears it
async function botUsername(token) {
  if (!token) return null;
  if (cachedBotUsername) return cachedBotUsername;
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getMe`).then((x) => x.json());
    cachedBotUsername = r?.result?.username ?? null;
  } catch { cachedBotUsername = null; }
  return cachedBotUsername;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  try {
    const body = typeof req.body === 'object' && req.body ? req.body : {};
    const r = await issueLinkCode(createAccountStore(createSql()), { userId: body.userId, channel: body.channel });
    if (!r.ok) return res.status(r.status ?? 400).json(r);
    const out = { ...r };
    if (body.channel === 'telegram') {
      const username = await botUsername(process.env.TELEGRAM_BOT_TOKEN);
      if (username) out.deepLink = `https://t.me/${username}?start=${r.code}`;
    }
    return res.status(200).json(out);
  } catch (e) {
    console.error('link-code', e.message);
    return res.status(500).json({ ok: false });
  }
}
