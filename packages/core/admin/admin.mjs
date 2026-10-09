// Admin = a regular user (everything in the dashboard) plus extra ops. Admins are NOT stored in the DB:
// they are declared in the ADMIN_USER_IDS / ADMIN_EMAILS env vars (comma-separated), so nobody can self-promote.
// An admin can never delete their own account through the API and can never be blocked.
export const SETTING_DEFAULTS = { memory_write_mode: 'instant', digest_hours: 24 };
export const WRITE_MODES = ['instant', 'digest'];

export function isAdmin(profile, env = process.env) {
  if (!profile) return false;
  const ids = String(env.ADMIN_USER_IDS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const mails = String(env.ADMIN_EMAILS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return ids.includes(String(profile.id).toLowerCase()) || (!!profile.email && mails.includes(String(profile.email).toLowerCase()));
}

export function cleanSettings(b) {
  const o = {};
  if (b.memory_write_mode !== undefined) { if (!WRITE_MODES.includes(b.memory_write_mode)) return { error: 'bad_write_mode' }; o.memory_write_mode = b.memory_write_mode; }
  if (b.digest_hours !== undefined) { const n = Number(b.digest_hours); if (!Number.isInteger(n) || n < 1 || n > 168) return { error: 'bad_digest_hours' }; o.digest_hours = n; }
  return Object.keys(o).length ? { value: o } : { error: 'nothing_to_update' };
}

const ok = (json = {}) => ({ status: 200, json: { ok: true, ...json } });
const err = (status, error) => ({ status, json: { ok: false, error } });

/** op: admin-users (GET), admin-block (POST {id, blocked}), admin-settings (GET/PATCH). Caller must already be authenticated. */
export async function handleAdmin({ store, op, method, body = {}, profile, env = process.env, memory }) {
  if (!isAdmin(profile, env)) return err(403, 'admin_only');
  if (op === 'admin-users' && method === 'GET') return ok({ users: await store.adminListUsers() });
  if (op === 'admin-block' && method === 'POST') {
    const id = String(body.id ?? ''); if (!id) return err(400, 'id_required');
    if (id === profile.id) return err(400, 'cannot_block_self');
    const target = await store.getProfile(id); if (!target) return err(404, 'not_found');
    if (isAdmin(target, env)) return err(400, 'cannot_block_admin');
    await store.setBlocked(id, !!body.blocked);
    if (body.blocked && store.guardianLinksOf && store.addNotice) { // S06/S07: tell the other side that protection is paused
      const who = target.display_name || 'A Vow user';
      for (const l of await store.guardianLinksOf(id)) {
        if (!l.guardianUserId) continue;
        if (l.guardianUserId === id) await store.addNotice(l.watchedUserId, 'Your trusted contact is unavailable. Protection is paused until an admin restores the account; you can choose another trusted contact in the dashboard.');
        else await store.addNotice(l.guardianUserId, `Alerts for ${who} are paused.`);
      }
    }
    return ok({ id, blocked: !!body.blocked });
  }
  if (op === 'admin-settings' && method === 'GET') return ok({ settings: { ...SETTING_DEFAULTS, ...(await store.getSettings()) } });
  if (op === 'admin-settings' && method === 'PATCH') {
    const c = cleanSettings(body); if (c.error) return err(400, c.error);
    for (const [k, v] of Object.entries(c.value)) await store.setSetting(k, v);
    return ok({ settings: { ...SETTING_DEFAULTS, ...(await store.getSettings()) } });
  }
  if (op === 'admin-flush' && method === 'POST') return ok({ flushed: (await memory?.flushAll?.()) ?? 0 });
  return err(404, 'unknown_op');
}
