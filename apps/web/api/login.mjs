// Vercel function: reverse path — exchange the bot's /login one-time token for the account it belongs to
// (T54 §C point 4). Env: DATABASE_URL. The dashboard stores the returned userId client-side; this app has
// no server session/cookie layer yet (the whole dashboard is still local-storage state, see T51/T53 notes),
// so this is the same trust model as the rest of the preview dashboard, not a hardened session exchange.
import { createSql } from '../../../packages/db/neon.mjs';
import { createAccountStore } from '../../../packages/core/channels/account-store.mjs';
import { login } from '../../../packages/core/channels/account.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  try {
    const body = typeof req.body === 'object' && req.body ? req.body : {};
    const r = await login(createAccountStore(createSql()), { token: body.token });
    return res.status(r.ok ? 200 : (r.status ?? 400)).json(r);
  } catch (e) {
    console.error('login', e.message);
    return res.status(500).json({ ok: false });
  }
}
