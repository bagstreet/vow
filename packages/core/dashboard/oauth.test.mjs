import test from 'node:test'; import assert from 'node:assert/strict';
import { startUrl, resolveIdentity, loginWithIdentity } from './oauth.mjs';
test('startUrl builds provider URL with state', () => {
  const r = startUrl('discord', { clientId: 'C', redirectUri: 'https://x/cb' });
  assert.match(r.url, /discord\.com\/oauth2\/authorize\?client_id=C/); assert.ok(r.url.includes(`state=${r.state}`)); assert.match(r.url, /scope=identify\+email/);
  assert.equal(startUrl('nope', { clientId: 'C' }), null); assert.equal(startUrl('slack', {}), null);
});
test('discord identity', async () => {
  const f = async (url) => ({ json: async () => (url.includes('oauth2/token') ? { access_token: 'a' } : { id: 123, username: 'bob' }) });
  assert.deepEqual(await resolveIdentity('discord', 'c', { clientId: 'C', clientSecret: 'S', redirectUri: 'r' }, f), { channel: 'discord', chat: '123', name: 'bob' });
  await assert.rejects(resolveIdentity('discord', 'c', {}, async () => ({ json: async () => ({}) })), /token_exchange_failed/);
});
test('slack identity resolves the DM channel', async () => {
  const f = async (url) => ({ json: async () => url.includes('token') ? { ok: true, access_token: 'a' } : url.includes('userInfo') ? { sub: 'U1', name: 'Ann' } : { ok: true, channel: { id: 'D9' } } });
  assert.deepEqual(await resolveIdentity('slack', 'c', { botToken: 'x' }, f), { channel: 'slack', chat: 'D9', name: 'Ann' });
});
test('loginWithIdentity: existing user vs sign-up', async () => {
  const users = new Map([['discord:1', 'u1']]); let created = 0;
  const store = { userByChat: async (c, ch) => (users.has(`${ch}:${c}`) ? { id: users.get(`${ch}:${c}`) } : null), signUp: async () => ({ id: `n${++created}` }) };
  assert.deepEqual(await loginWithIdentity(store, { channel: 'discord', chat: '1' }), { userId: 'u1', created: false });
  assert.deepEqual(await loginWithIdentity(store, { channel: 'discord', chat: '2' }), { userId: 'n1', created: true });
});
