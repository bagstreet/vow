// Pure request handling for the account/link-code/login endpoints (T54). Store is injected
// (createAccountStore(sql) in prod, a plain object in tests) so every branch is testable offline,
// same pattern as telegram-webhook.mjs.
const CHANNELS = ['telegram', 'slack', 'discord'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createAccount(store, { displayName } = {}) {
  const name = typeof displayName === 'string' ? displayName.trim().slice(0, 80) : undefined;
  const user = await store.createUser({ displayName: name || undefined });
  return { ok: true, userId: user.id };
}

export async function issueLinkCode(store, { userId, channel }) {
  if (!UUID_RE.test(String(userId ?? ''))) return { ok: false, status: 400, error: 'bad_user_id' };
  if (!CHANNELS.includes(channel)) return { ok: false, status: 400, error: 'bad_channel' };
  const user = await store.getUser(userId);
  if (!user) return { ok: false, status: 404, error: 'user_not_found' };
  const { code, expiresAt, ttlMinutes } = await store.createLinkCode({ userId, channel });
  return { ok: true, code, expiresAt, ttlMinutes };
}

export async function linkStatus(store, { userId, channel }) {
  if (!UUID_RE.test(String(userId ?? ''))) return { ok: false, status: 400, error: 'bad_user_id' };
  if (!CHANNELS.includes(channel)) return { ok: false, status: 400, error: 'bad_channel' };
  const linked = await store.isChannelLinked({ userId, channel });
  return { ok: true, linked };
}

export async function login(store, { token }) {
  if (!token || typeof token !== 'string' || token.length > 200) return { ok: false, status: 400, error: 'bad_token' };
  const user = await store.consumeLoginToken(token);
  if (!user) return { ok: false, status: 401, error: 'invalid_or_expired' };
  return { ok: true, userId: user.id, displayName: user.display_name };
}
