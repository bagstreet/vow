import test from 'node:test';
import assert from 'node:assert/strict';
import { handleExtension, hashSecret } from './extension.mjs';

const mk = () => {
  const s = { links: new Map(), acks: [], codes: new Map([['ABC123', 'u1']]), inbox: [{ id: 'o1', title: 'Vitamin D', role: 'medication', status: 'sent' }], touched: 0 };
  const store = {
    consumeLinkCode: async (c, ch) => { assert.equal(ch, 'extension'); const u = s.codes.get(c); s.codes.delete(c); return u ? { userId: u } : null; },
    pairExtension: async (u, h) => { s.links.set(h, u); },
    userByChat: async (h, ch) => { assert.equal(ch, 'extension'); return s.links.has(h) ? { id: s.links.get(h), blocked: false } : null; },
    extensionInbox: async () => s.inbox,
    ackOccurrence: async (id, r) => { s.acks.push([id, r]); s.inbox = s.inbox.filter((o) => o.id !== id); return { title: 'Vitamin D', role: 'medication', messages: [] }; },
    touchChannel: async () => { s.touched++; },
  };
  return { s, store };
};

test('pairing consumes the code once and returns a secret that only its hash is stored for', async () => {
  const { s, store } = mk();
  const r = await handleExtension({ store, action: 'pair', method: 'POST', body: { code: 'abc123' } });
  assert.equal(r.status, 201); assert.match(r.json.secret, /^vowx_/);
  assert.ok(s.links.has(hashSecret(r.json.secret))); assert.ok(![...s.links.keys()].includes(r.json.secret));
  assert.equal((await handleExtension({ store, action: 'pair', method: 'POST', body: { code: 'ABC123' } })).status, 400);
  assert.equal((await handleExtension({ store, action: 'pair', method: 'POST', body: { code: 'x' } })).json.error, 'bad_code');
});

test('poll needs a valid secret and returns role-labelled buttons', async () => {
  const { store } = mk();
  const { json } = await handleExtension({ store, action: 'pair', method: 'POST', body: { code: 'ABC123' } });
  assert.equal((await handleExtension({ store, action: 'poll', method: 'GET', bearer: 'vowx_nope' })).status, 401);
  assert.equal((await handleExtension({ store, action: 'poll', method: 'GET' })).status, 401);
  const r = await handleExtension({ store, action: 'poll', method: 'GET', bearer: json.secret });
  assert.deepEqual(r.json.items.map((i) => i.id), ['o1']);
  assert.deepEqual(r.json.items[0].buttons.map((b) => b.id), ['taken', 'skipped', 'snooze']);
});

test('reply acks the occurrence, settles other channels and remembers; foreign ids and unknown buttons are refused', async () => {
  const { s, store } = mk();
  const { json } = await handleExtension({ store, action: 'pair', method: 'POST', body: { code: 'ABC123' } });
  const settled = [], remembered = [];
  const deps = { store, settle: async (x) => settled.push(x), memory: { remember: async (u, t) => remembered.push(t) }, bearer: json.secret, action: 'reply', method: 'POST' };
  assert.equal((await handleExtension({ ...deps, body: { id: 'zzz', button: 'taken' } })).status, 404);
  assert.equal((await handleExtension({ ...deps, body: { id: 'o1', button: 'rm -rf' } })).json.error, 'bad_button');
  assert.equal((await handleExtension({ ...deps, body: { id: 'o1', button: 'taken' } })).status, 200);
  assert.deepEqual(s.acks, [['o1', 'taken']]); assert.equal(settled[0].via, 'browser extension'); assert.match(remembered[0], /extension/);
  assert.equal(s.touched, 1);
  assert.equal((await handleExtension({ ...deps, body: { id: 'o1', button: 'taken' } })).status, 404); // already answered
});
