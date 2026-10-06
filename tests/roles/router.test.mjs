import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { route, STICKY_MS } from '../../packages/core/roles/router.mjs';

const fx = JSON.parse(readFileSync(new URL('./router.fixtures.json', import.meta.url)));
test('at least 30 fixtures', () => assert.ok(fx.length >= 30));
fx.forEach((f, i) => test(`fixture ${i}: ${f.t}`, () => {
  const now = 1_000_000_000;
  const ctx = { now, enabled: f.en, occurrenceRole: f.occ, sticky: f.sticky ? { role: f.sticky, at: f.stale ? now - STICKY_MS - 1 : now } : undefined };
  const r = route(f.t, ctx);
  if (f.oos) return assert.equal(r.outOfScope, true);
  if (f.crisis) return assert.equal(r.crisis, true);
  assert.equal(r.outOfScope, false);
  assert.equal(r.primary, f.p ?? null);
  if (f.model) assert.equal(r.needsModel, true);
  if (f.sec) assert.deepEqual(r.secondary, f.sec);
}));
test('disabled role is never selected by keywords', () => {
  const r = route('my period is late', { enabled: ['fitness'], now: 0 });
  assert.notEqual(r.primary, 'health');
});
import { shouldShowRoleLabel } from '../../packages/core/roles/router.mjs';
test('role label policy', () => {
  assert.equal(shouldShowRoleLabel('off', 'a', 'b'), false);
  assert.equal(shouldShowRoleLabel('always', 'a', 'a'), true);
  assert.equal(shouldShowRoleLabel('on_change', 'a', 'a'), false);
  assert.equal(shouldShowRoleLabel('on_change', 'a', 'b'), true);
  assert.equal(shouldShowRoleLabel('on_change', 'a', undefined), true);
});

import { route as _route } from '../../packages/core/roles/router.mjs';
import { test as _t } from 'node:test';
import _a from 'node:assert/strict';
_t('@ is a role prefix only on web; chat channels use /role or "role:"', () => {
  _a.equal(_route('@medication did I take it?', { channel: 'web' }).reason, 'explicit');
  _a.notEqual(_route('@medication did I take it?', { channel: 'telegram' }).reason, 'explicit');
  _a.equal(_route('/study@VoW_rebot what is due', { channel: 'telegram' }).primary, 'study');
  _a.equal(_route('study: what is due', { channel: 'slack' }).primary, 'study');
});
