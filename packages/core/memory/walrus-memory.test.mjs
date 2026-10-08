import test from 'node:test'; import assert from 'node:assert/strict';

test('withMemoryLog records each write with channel/kind and survives logger failure', async () => {
  const { withMemoryLog } = await import('./walrus-memory.mjs');
  const rows = []; const base = { recall: async () => ['x'], remember: async () => 'job9' };
  const m = withMemoryLog(base, async (u, r) => rows.push([u, r]), 'slack');
  assert.equal(await m.remember('u1', '[check-in, slack] "Run" -> done'), 'job9');
  assert.equal(rows[0][1].kind, 'check-in'); assert.equal(rows[0][1].channel, 'slack'); assert.deepEqual(await m.recall('u1', 'q'), ['x']);
  const bad = withMemoryLog(base, async () => { throw new Error('db down'); }, 'slack');
  assert.equal(await bad.remember('u1', 'hi'), 'job9');
});
