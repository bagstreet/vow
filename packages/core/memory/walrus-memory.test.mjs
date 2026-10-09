import test from 'node:test'; import assert from 'node:assert/strict';
import { createWalrusMemory } from './walrus-memory.mjs';

test('withMemoryLog records each write with channel/kind and survives logger failure', async () => {
  const { withMemoryLog } = await import('./walrus-memory.mjs');
  const rows = []; const base = { recall: async () => ['x'], remember: async () => 'job9' };
  const m = withMemoryLog(base, async (u, r) => rows.push([u, r]), 'slack');
  assert.equal(await m.remember('u1', '[check-in, slack] "Run" -> done'), 'job9');
  assert.equal(rows[0][1].kind, 'check-in'); assert.equal(rows[0][1].channel, 'slack'); assert.deepEqual(await m.recall('u1', 'q'), ['x']);
  const bad = withMemoryLog(base, async () => { throw new Error('db down'); }, 'slack');
  assert.equal(await bad.remember('u1', 'hi'), 'job9');
});

import { resolveBlobIds } from '../dashboard/dash.mjs';
test('jobStatus returns blob id once done, never throws', async () => {
  const mem = createWalrusMemory({ getRememberStatus: async (id) => id === 'j1' ? { status: 'done', blob_id: 'B1' } : Promise.reject(new Error('x')) });
  assert.deepEqual(await mem.jobStatus('j1'), { status: 'done', blobId: 'B1' });
  assert.deepEqual(await mem.jobStatus('j2'), { status: 'unknown', blobId: null });
});
test('resolveBlobIds fills and persists blob ids only for rows without one', async () => {
  const saved = [];
  const rows = [{ id: 1, job_id: 'j1', blob_id: null }, { id: 2, job_id: 'j2', blob_id: 'KEEP' }, { id: 3, job_id: null, blob_id: null }];
  await resolveBlobIds(rows, { setBlobId: async (id, b) => saved.push([id, b]) }, { jobStatus: async () => ({ blobId: 'B1' }) });
  assert.deepEqual(rows.map(r => r.blob_id), ['B1', 'KEEP', null]);
  assert.deepEqual(saved, [[1, 'B1']]);
});

import { withForgetFilter } from './walrus-memory.mjs';
test('withForgetFilter hides forgotten memories from recall', async () => {
  const base = { recall: async () => ['[telegram] I take 5mg melatonin', 'likes rowing'], remember: async () => 'j' };
  const m = withForgetFilter(base, async () => ['[telegram] I take 5mg melatonin']);
  assert.deepEqual(await m.recall('u', 'q'), ['likes rowing']);
  assert.deepEqual(await withForgetFilter(base, async () => []).recall('u', 'q'), ['[telegram] I take 5mg melatonin', 'likes rowing']);
  assert.deepEqual(await withForgetFilter(base, async () => { throw new Error('db'); }).recall('u', 'q'), ['[telegram] I take 5mg melatonin', 'likes rowing']);
});

import { withAliasRecall } from './walrus-memory.mjs';
test('alias recall reads the absorbed namespace and de-duplicates', async () => {
  const mem = { recall: async (u) => (u === 'new' ? ['a', 'b'] : ['b', 'c']) };
  assert.deepEqual(await withAliasRecall(mem, () => ['old']).recall('new', 'q', { limit: 4 }), ['a', 'b', 'c']);
  assert.deepEqual(await withAliasRecall(mem, () => []).recall('new', 'q'), ['a', 'b']);
});

test('S10: the same text through two channels within seconds is written once', async () => {
  const calls = []; const mem = createWalrusMemory({ remember: async (t) => { calls.push(t); return { job_id: 'j' + calls.length }; } });
  assert.equal(await mem.remember('u-s10', '[telegram] I took magnesium 400 mg'), 'j1');
  assert.equal(await mem.remember('u-s10', '[slack] I took magnesium 400 mg'), null);
  assert.equal(await mem.remember('u-s10', '[slack] something else'), 'j2'); assert.equal(calls.length, 2);
});
