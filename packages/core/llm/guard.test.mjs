import test from 'node:test'; import assert from 'node:assert/strict';
import { guardReply } from './guard.mjs';
test('strips markdown lists/bold/headings', () => { const o = guardReply('## Plan\n- **Mon** legs\n- Wed push'); assert.doesNotMatch(o, /[#*\-]/); assert.match(o, /Mon legs/); });
test('caps sentences and length, keeps short text untouched', () => {
  assert.equal(guardReply('One. Two. Three. Four. Five. Six.').split(/(?<=\.)\s/).length, 4);
  assert.equal(guardReply('Hi there. Ok?'), 'Hi there. Ok?');
  assert.ok(guardReply('word '.repeat(400) + '.').length <= 700);
});
test('never returns undefined/empty for empty input', () => assert.equal(guardReply(undefined), ''));
