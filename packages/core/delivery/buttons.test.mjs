import test from 'node:test';
import assert from 'node:assert/strict';
import { selectButtons, checkinFromButton, DEFAULT_BUTTON_IDS } from './quickreply.mjs';

test('model picks from closed catalog; unknown ids dropped', () => {
  const b = selectButtons(['taken', 'delete_all_data', 'snooze_1h', 'taken']);
  assert.deepEqual(b.map(x => x.id), ['taken', 'snooze_1h']);
});
test('invalid / injected / empty suggestion falls back to default', () => {
  for (const s of [null, [], 'taken', ['rm -rf'], ['skipped'], ['taken']])
    assert.deepEqual(selectButtons(s).map(x => x.id), DEFAULT_BUTTON_IDS);
});
test('max 4 buttons', () => {
  assert.equal(selectButtons(['taken', 'skipped', 'snooze', 'snooze_1h', 'cancel']).length <= 4, true);
});
test('button -> CHECKIN mapping incl. stopSeries and snooze minutes', () => {
  const o = { id: 'o1' };
  assert.equal(checkinFromButton('cancel', o, 1).stopSeries, true);
  assert.equal(checkinFromButton('snooze_1h', o, 1).snoozeMin, 60);
  assert.equal(checkinFromButton('taken', o, 1).status, 'taken');
});
