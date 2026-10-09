import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAdmin, handleAdmin, cleanSettings } from './admin.mjs';
import { withWriteMode } from '../memory/write-mode.mjs';
import { handleDash } from '../dashboard/dash.mjs';

const env = { ADMIN_USER_IDS: 'a1', ADMIN_EMAILS: 'Boss@x.io' };
const admin = { id: 'a1', email: null }; const user = { id: 'u1', email: 'u@x.io' };
const mkStore = () => { const users = { a1: { id: 'a1' }, u1: { id: 'u1' }, a2: { id: 'a2', email: 'boss@x.io' } }; const set = {}; const blocked = {};
  return { blocked, set, getProfile: async (id) => users[id] ?? null, adminListUsers: async () => [], setBlocked: async (id, b) => { blocked[id] = b; }, getSettings: async () => set, setSetting: async (k, v) => { set[k] = v; } }; };

test('isAdmin: env ids and emails only', () => {
  assert.equal(isAdmin(admin, env), true); assert.equal(isAdmin({ id: 'x', email: 'BOSS@x.io' }, env), true);
  assert.equal(isAdmin(user, env), false); assert.equal(isAdmin(null, env), false); assert.equal(isAdmin(user, {}), false);
});
test('non-admin gets 403 on every admin op', async () => {
  for (const [op, method] of [['admin-users', 'GET'], ['admin-block', 'POST'], ['admin-settings', 'PATCH']]) assert.equal((await handleAdmin({ store: mkStore(), op, method, profile: user, env })).status, 403);
});
test('block: cannot block self or another admin; can block a user', async () => {
  const store = mkStore();
  assert.equal((await handleAdmin({ store, op: 'admin-block', method: 'POST', body: { id: 'a1', blocked: true }, profile: admin, env })).json.error, 'cannot_block_self');
  assert.equal((await handleAdmin({ store, op: 'admin-block', method: 'POST', body: { id: 'a2', blocked: true }, profile: admin, env })).json.error, 'cannot_block_admin');
  assert.equal((await handleAdmin({ store, op: 'admin-block', method: 'POST', body: { id: 'u1', blocked: true }, profile: admin, env })).status, 200);
  assert.equal(store.blocked.u1, true);
  assert.equal((await handleAdmin({ store, op: 'admin-block', method: 'POST', body: { id: 'nope', blocked: true }, profile: admin, env })).status, 404);
});
test('settings validation and defaults', async () => {
  assert.ok(cleanSettings({ memory_write_mode: 'weird' }).error); assert.ok(cleanSettings({ digest_hours: 0 }).error); assert.ok(cleanSettings({}).error);
  const store = mkStore();
  const r = await handleAdmin({ store, op: 'admin-settings', method: 'PATCH', body: { memory_write_mode: 'digest', digest_hours: 6 }, profile: admin, env });
  assert.deepEqual(r.json.settings, { memory_write_mode: 'digest', digest_hours: 6 });
});
test('admin cannot delete own account; normal user can', async () => {
  const store = { ...mkStore(), deleteAccount: async () => {} };
  assert.equal((await handleDash({ store, op: 'account', method: 'DELETE', body: { confirm: 'DELETE' }, userId: 'a1', deps: { env } })).json.error, 'admin_cannot_delete');
  assert.equal((await handleDash({ store, op: 'account', method: 'DELETE', body: { confirm: 'DELETE' }, userId: 'u1', deps: { env } })).status, 200);
});
test('write mode: instant passes through; digest buffers, flushes when due or on force', async () => {
  const written = []; const mem = { remember: async (u, t) => { written.push(t); return { jobId: 'j' }; }, recall: async () => [] };
  const rows = []; let age = 0;
  const buffer = { add: async (u, t) => { rows.push({ u, text: t }); }, count: async () => rows.length, oldestAgeHours: async () => age, take: async () => rows.splice(0), usersDue: async () => (rows.length ? ['u1'] : []) };
  let settings = { memory_write_mode: 'instant' };
  const m = withWriteMode(mem, { getSettings: async () => settings, buffer });
  await m.remember('u1', 'a'); assert.deepEqual(written, ['a']);
  settings = { memory_write_mode: 'digest', digest_hours: 24 };
  assert.deepEqual(await m.remember('u1', 'b'), { buffered: true }); await m.remember('u1', 'c');
  assert.equal(written.length, 1);
  age = 25; await m.remember('u1', 'd'); assert.equal(written.length, 2); assert.match(written[1], /^\[digest 3\] b \| c \| d$/);
  age = 0; await m.remember('u1', 'e'); assert.equal(await m.flush('u1').then((r) => !!r), true); assert.match(written[2], /digest 1/);
  assert.equal(await m.flush('u1'), null);
});

test('blocking a trusted contact or a watched user notifies the other side (S06/S07)', async () => {
  const notes = [];
  const store = { ...mkStore(), guardianLinksOf: async () => [{ watchedUserId: 'w1', guardianUserId: 'u1' }], addNotice: async (uid, t) => notes.push([uid, t]) };
  const admin = { id: 'a1', email: 'boss@x.io' };
  await handleAdmin({ store, op: 'admin-block', method: 'POST', body: { id: 'u1', blocked: true }, profile: admin, env: { ADMIN_EMAILS: 'boss@x.io' } });
  assert.equal(notes.length, 1); assert.equal(notes[0][0], 'w1'); assert.match(notes[0][1], /trusted contact is unavailable/);
  notes.length = 0; store.guardianLinksOf = async () => [{ watchedUserId: 'u1', guardianUserId: 'g1' }];
  await handleAdmin({ store, op: 'admin-block', method: 'POST', body: { id: 'u1', blocked: true }, profile: admin, env: { ADMIN_EMAILS: 'boss@x.io' } });
  assert.equal(notes[0][0], 'g1'); assert.match(notes[0][1], /paused/);
});
