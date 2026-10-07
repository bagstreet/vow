// Vercel function: create a bare account row. Env: DATABASE_URL.
// Stand-in for real OAuth/email sign-in (T54 §C point 1 is design-only for that part); this just gives the
// dashboard a real DB user id to attach channel links and reminders to instead of a client-only mock id.
import { createSql } from '../../../packages/db/neon.mjs';
import { createAccountStore } from '../../../packages/core/channels/account-store.mjs';
import { createAccount } from '../../../packages/core/channels/account.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  try {
    const body = typeof req.body === 'object' && req.body ? req.body : {};
    const r = await createAccount(createAccountStore(createSql()), { displayName: body.displayName });
    return res.status(200).json(r);
  } catch (e) {
    console.error('account', e.message);
    return res.status(500).json({ ok: false });
  }
}
