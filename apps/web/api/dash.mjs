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
import { startUrl, resolveIdentity, loginWithIdentity } from '../../../packages/core/dashboard/oauth.mjs';
import { newToken } from '../../../packages/core/dashboard/session.mjs';
import { sendMagicMail } from '../lib/mail.mjs';

let botCache;
async function telegramBot() {
  const t = process.env.TELEGRAM_BOT_TOKEN; if (!t) return null;
  if (botCache) return botCache;
  try { botCache = (await fetch(`https://api.telegram.org/bot${t}/getMe`).then((x) => x.json()))?.result?.username ?? null; } catch { botCache = null; }
  return botCache;
}

export const config = { maxDuration: 30 };

const BASE = () => process.env.WEB_BASE_URL ?? 'https://vow-livid.vercel.app';
const oauthCfg = (provider) => ({
  clientId: provider === 'discord' ? (process.env.DISCORD_CLIENT_ID ?? '1557286978905571428') : process.env.SLACK_CLIENT_ID,
  clientSecret: provider === 'discord' ? process.env.DISCORD_CLIENT_SECRET : process.env.SLACK_CLIENT_SECRET,
  redirectUri: `${BASE()}/api/dash/oauth-callback`, botToken: process.env.SLACK_BOT_TOKEN,
});
const STATE_COOKIE = 'vow_oauth';
const readState = (h) => { const m = /(?:^|;\s*)vow_oauth=([^;]+)/.exec(h ?? ''); return m ? decodeURIComponent(m[1]) : null; };
const fail = (res, why) => { res.setHeader('Set-Cookie', `${STATE_COOKIE}=; Path=/; Max-Age=0`); res.redirect(302, `/login?error=${why}`); };

async function oauth(op, req, res) {
  if (op === 'oauth-start') {
    const provider = String(req.query.provider ?? '');
    const cfg = oauthCfg(provider);
    const st = cfg.clientId && cfg.clientSecret ? startUrl(provider, cfg) : null;
    if (!st) return fail(res, 'provider_unavailable');
    res.setHeader('Set-Cookie', `${STATE_COOKIE}=${encodeURIComponent(`${provider}.${st.state}`)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
    return res.redirect(302, st.url);
  }
  // callback
  const [provider, state] = String(readState(req.headers.cookie) ?? '.').split('.');
  if (req.query.error) return fail(res, 'cancelled');
  if (!provider || !state || state !== req.query.state || !req.query.code) return fail(res, 'bad_state');
  try {
    const store = createNeonDashStore(createSql());
    const identity = await resolveIdentity(provider, String(req.query.code), oauthCfg(provider));
    const { userId, created } = await loginWithIdentity(store, identity);
    const token = newToken(); await store.createSession(userId, hashToken(token));
    res.setHeader('Set-Cookie', [cookieHeader(token), `${STATE_COOKIE}=; Path=/; Max-Age=0`]);
    return res.redirect(302, created ? '/dashboard/channels?welcome=1' : '/dashboard');
  } catch (e) { console.error('oauth', provider, e.message); return fail(res, 'failed'); }
}

export default async function handler(req, res) {
  const op = String(req.query?.op ?? '');
  if (op === 'oauth-start' || op === 'oauth-callback') return oauth(op, req, res);
  const body = req.method === 'GET' ? { ...req.query } : (typeof req.body === 'object' && req.body ? req.body : {});
  try {
    const store = createNeonDashStore(createSql());
    const sid = readCookie(req.headers.cookie);
    const userId = sid ? await store.sessionUser(hashToken(sid)) : null;
    // CSRF: state-changing calls must come from our own origin (SameSite=Lax cookie is the second layer).
    if (req.method !== 'GET' && req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return res.status(403).json({ ok: false, error: 'bad_origin' });
    const deps = op === 'history' ? { memory: createWalrusMemory(buildMemwalSdk()) } : op === 'link-code' ? { telegramBot } : op === 'transcribe' ? { transcribe: transcribeAudio } : op === 'chat' ? { llm: buildLlmClient(), memory: createWalrusMemory(buildMemwalSdk()) } : { sendMagic: (email, token) => sendMagicMail(email, token, process.env.WEB_BASE_URL ?? 'https://vow-livid.vercel.app') };
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
