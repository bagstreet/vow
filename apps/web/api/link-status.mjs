// Vercel function: poll whether a channel got linked yet (T54). Env: DATABASE_URL.
import { createSql } from '../../../packages/db/neon.mjs';
import { createAccountStore } from '../../../packages/core/channels/account-store.mjs';
import { linkStatus } from '../../../packages/core/channels/account.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false });
  try {
    const { userId, channel } = req.query;
    const r = await linkStatus(createAccountStore(createSql()), { userId, channel });
    return res.status(r.ok ? 200 : (r.status ?? 400)).json(r);
  } catch (e) {
    console.error('link-status', e.message);
    return res.status(500).json({ ok: false });
  }
}
