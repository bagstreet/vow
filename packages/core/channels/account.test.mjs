import test from 'node:test'; import assert from 'node:assert/strict';
import { createAccount, issueLinkCode, linkStatus, login } from './account.mjs';

const U = 'a0000000-0000-0000-0000-00000000000a';

function mockStore() {
  const users = new Map([[U, { id: U, display_name: 'Alice' }]]);
  const links = new Set(); // `${userId}:${channel}`
  const codes = new Map(); // code -> { userId, channel }
  const loginTokens = new Map(); // token -> userId
  let nextId = 1;
  return {
    users, links, codes, loginTokens,
    async createUser({ displayName }) { const id = `gen-${nextId++}`; users.set(id, { id, display_name: displayName ?? null }); return users.get(id); },
    async getUser(id) { return users.get(id) ?? null; },
    async createLinkCode({ userId, channel }) { const code = `CODE${nextId++}`; codes.set(code, { userId, channel }); return { code, expiresAt: new Date(Date.now() + 6e5).toISOString(), ttlMinutes: 10 }; },
    async isChannelLinked({ userId, channel }) { return links.has(`${userId}:${channel}`); },
    async consumeLoginToken(token) { const uid = loginTokens.get(token); if (!uid) return null; loginTokens.delete(token); return users.get(uid) ?? null; },
  };
}

test('createAccount: makes a bare user row, trims/clamps display name', async () => {
  const store = mockStore();
  const r = await createAccount(store, { displayName: '  Bob  ' });
  assert.equal(r.ok, true);
  assert.equal(store.users.get(r.userId).display_name, 'Bob');
});

test('issueLinkCode: rejects bad user id / bad channel / unknown user, else returns a code', async () => {
  const store = mockStore();
  assert.equal((await issueLinkCode(store, { userId: 'not-a-uuid', channel: 'telegram' })).status, 400);
  assert.equal((await issueLinkCode(store, { userId: U, channel: 'carrier-pigeon' })).status, 400);
  assert.equal((await issueLinkCode(store, { userId: 'ffffffff-ffff-ffff-ffff-ffffffffffff', channel: 'telegram' })).status, 404);
  const ok = await issueLinkCode(store, { userId: U, channel: 'telegram' });
  assert.equal(ok.ok, true); assert.match(ok.code, /^CODE/);
});

test('linkStatus: false until linked, true after', async () => {
  const store = mockStore();
  assert.equal((await linkStatus(store, { userId: U, channel: 'telegram' })).linked, false);
  store.links.add(`${U}:telegram`);
  assert.equal((await linkStatus(store, { userId: U, channel: 'telegram' })).linked, true);
});

test('login: 400 on missing/oversized token, 401 on unknown/used, 200 + userId on valid one-time token', async () => {
  const store = mockStore();
  assert.equal((await login(store, { token: '' })).status, 400);
  assert.equal((await login(store, { token: 'x'.repeat(300) })).status, 400);
  assert.equal((await login(store, { token: 'nope' })).status, 401);
  store.loginTokens.set('tok1', U);
  const r = await login(store, { token: 'tok1' });
  assert.equal(r.ok, true); assert.equal(r.userId, U); assert.equal(r.displayName, 'Alice');
  assert.equal((await login(store, { token: 'tok1' })).status, 401); // one-time use
});
