import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routeWithModel, parseClassifierOutput } from '../../packages/core/roles/classifier.mjs';

const ok = (obj) => ({ complete: async () => ({ text: JSON.stringify(obj) }) });
const ctx = { now: 0 };
test('rules decide: model not called', async () => {
  let called = 0;
  const r = await routeWithModel('my period is late', ctx, { client: { complete: async () => { called++; return { text: '{}' }; } } });
  assert.equal(r.primary, 'health'); assert.equal(called, 0);
});
test('model used for unmatched text', async () => {
  const r = await routeWithModel('hello there', ctx, { client: ok({ primary: 'study', confidence: 0.9 }) });
  assert.equal(r.primary, 'study'); assert.equal(r.reason, 'model');
});
test('model outOfScope', async () => {
  const r = await routeWithModel('hello there', ctx, { client: ok({ outOfScope: true }) });
  assert.equal(r.outOfScope, true);
});
test('invalid JSON -> default role', async () => {
  const r = await routeWithModel('hello there', ctx, { client: { complete: async () => ({ text: 'nope' }) }, defaultRole: 'fitness' });
  assert.equal(r.primary, 'fitness');
});
test('role not enabled is rejected', async () => {
  const r = await routeWithModel('hello there', { now: 0, enabled: ['study'] }, { client: ok({ primary: 'health' }), defaultRole: 'study' });
  assert.equal(r.primary, 'study');
});
test('timeout -> fallback', async () => {
  const slow = { complete: () => new Promise(() => {}) };
  const r = await routeWithModel('hello there', ctx, { client: slow, timeoutMs: 20, defaultRole: 'fitness' });
  assert.equal(r.primary, 'fitness');
});
test('throwing client -> fallback; rulesOnly skips model', async () => {
  const bad = { complete: async () => { throw new Error('x'); } };
  assert.equal((await routeWithModel('hello there', ctx, { client: bad, defaultRole: 'study' })).primary, 'study');
  assert.equal((await routeWithModel('hello there', ctx, { client: ok({ primary: 'health' }), rulesOnly: true, defaultRole: 'study' })).primary, 'study');
});
test('parse strips fences and dedups', () => {
  const p = parseClassifierOutput('```json\n{"primary":"study","secondary":["study","fitness","fitness"],"confidence":2}\n```', ['study', 'fitness']);
  assert.deepEqual(p.secondary, ['fitness']); assert.equal(p.confidence, 1);
});
