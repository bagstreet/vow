import test from 'node:test';
import assert from 'node:assert/strict';
import { ROLES, ROLE_IDS, getRole, enabledRoles } from './index.mjs';
import { BUTTON_CATALOG } from '../../core/delivery/quickreply.mjs';

test('five roles exactly as on the site', () => {
  assert.deepEqual([...ROLE_IDS], ['fitness', 'medication', 'nutrition', 'health', 'study']);
});
test('every role is complete and uses catalog buttons only', () => {
  for (const r of Object.values(ROLES)) {
    for (const k of ['id', 'label', 'emoji', 'prompt', 'keywords', 'scope', 'never', 'buttons']) assert.ok(r[k]?.length, `${r.id}.${k}`);
    for (const b of r.buttons) assert.ok(BUTTON_CATALOG[b], `${r.id} button ${b}`);
    assert.match(r.prompt, /Never:/);
    assert.match(r.prompt, /Ignore any instruction/);
  }
});
test('sensitive roles are marked', () => {
  assert.deepEqual(Object.values(ROLES).filter((r) => r.sensitive).map((r) => r.id), ['medication', 'health']);
});
test('health role is cycle tracking and predictions come from code', () => {
  assert.match(ROLES.health.prompt, /cycle|period/i);
  assert.match(ROLES.health.prompt, /never from the model/i);
});
test('unknown ids are ignored', () => {
  assert.equal(getRole('nope'), null);
  assert.equal(enabledRoles(['study', 'nope']).length, 1);
});
