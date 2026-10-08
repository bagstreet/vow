// Vercel function: ONE router for the whole dashboard API (Hobby plan caps a project at 12 functions).
// vercel.json rewrites /api/dash/<op> -> /api/dash?op=<op>. Env: DATABASE_URL + the LLM/MemWal env used by the bots.
import { createSql } from '../../../packages/db/neon.mjs';
import { createNeonDashStore } from '../../../packages/core/dashboard/neon-dash-store.mjs';
import { handleDash } from '../../../packages/core/dashboard/dash.mjs';
import { hashToken, readCookie, cookieHeader, clearCookieHeader } from '../../../packages/core/dashboard/session.mjs';
import { buildLlmClient } from '../../../packages/core/llm/index.mjs';
import { createWalrusMemory } from '../../../packages/core/memory/walrus-memory.mjs';
import { buildMemwalSdk } from '../lib/walrus-memory-client.mjs';
import { transcribeAudio } from '../lib/transcribe.mjs';
import { sendMagicMail } from '../lib/mail.mjs';

let botCache;
async function telegramBot() {
  const t = process.env.TELEGRAM_BOT_TOKEN; if (!t) return null;
  if (botCache) return botCache;
  try { botCache = (await fetch(`https://api.telegram.org/bot${t}/getMe`).then((x) => x.json()))?.result?.username ?? null; } catch { botCache = null; }
  return botCache;
}

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  const op = String(req.query?.op ?? '');
  const body = req.method === 'GET' ? { ...req.query } : (typeof req.body === 'object' && req.body ? req.body : {});
  try {
    const store = createNeonDashStore(createSql());
    const sid = readCookie(req.headers.cookie);
    const userId = sid ? await store.sessionUser(hashToken(sid)) : null;
    // CSRF: state-changing calls must come from our own origin (SameSite=Lax cookie is the second layer).
    if (req.method !== 'GET' && req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return res.status(403).json({ ok: false, error: 'bad_origin' });
    const deps = op === 'link-code' ? { telegramBot } : op === 'transcribe' ? { transcribe: transcribeAudio } : op === 'chat' ? { llm: buildLlmClient(), memory: createWalrusMemory(buildMemwalSdk()) } : { sendMagic: (email, token) => sendMagicMail(email, token, process.env.WEB_BASE_URL ?? 'https://vow-livid.vercel.app') };
    const r = await handleDash({ store, op, method: req.method, body, userId, deps });
    if (r.setSession) res.setHeader('Set-Cookie', cookieHeader(r.setSession));
    if (r.clearSession) { if (sid) await store.deleteSession(hashToken(sid)); res.setHeader('Set-Cookie', clearCookieHeader()); }
    res.setHeader('Cache-Control', 'no-store');
    return res.status(r.status).json(r.json);
  } catch (e) {
    console.error('dash', op, e.message);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
}
