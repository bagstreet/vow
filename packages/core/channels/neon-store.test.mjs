import test from 'node:test'; import assert from 'node:assert/strict';
import { createNeonStore } from './neon-store.mjs';
test('neon store: parameterised SQL, link code consumed once, dup update detected', async () => {
  const calls = []; const sql = async (q, p) => { calls.push([q, p]); return /returning key/.test(q) ? [] : /returning user_id/.test(q) ? [{ user_id: 'u1' }] : []; };
  const s = createNeonStore(sql);
  assert.equal(await s.seenUpdate(5), true);
  assert.deepEqual(await s.consumeLinkCode('ABC123'), { userId: 'u1' });
  assert.equal(await s.userByChat('9'), null);
  assert.ok(calls.every(([q, p]) => !q.includes('ABC123') && Array.isArray(p)), 'no interpolation of user input');
  const t = await s.createLoginToken('u1'); assert.ok(t.length >= 32);
});
