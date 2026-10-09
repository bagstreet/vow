import test from 'node:test';
import assert from 'node:assert/strict';

test('role-specific button labels keep ids and statuses', async () => {
  const { selectButtons } = await import('./quickreply.mjs');
  const b = selectButtons(null, 'health');
  assert.deepEqual(b.map((x) => x.id), ['taken', 'skipped', 'snooze']);
  assert.equal(b[0].label, 'Logged');
  assert.equal(selectButtons(null, 'unknown')[0].label, 'Taken');
});
