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
