import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeButtons, pickButtons, DEFAULT_BUTTONS } from './buttons.mjs';
const ids = (b) => b.map((x) => x.id);
test('drops unknown ids, keeps taken + snooze', () => assert.deepEqual(ids(sanitizeButtons(['taken', 'hack', 'taken', 'snooze_1h'])), ['taken', 'snooze_1h']));
test('no answer/deferral -> defaults', () => assert.deepEqual(ids(sanitizeButtons(['cancel', 'skipped'])), [...DEFAULT_BUTTONS]));
test('model output parsed', async () => assert.deepEqual(ids(await pickButtons({ llm: { complete: async () => ({ text: 'Sure: ["taken","snooze","skipped"]' }) }, role: 'study', reminderText: 'x' })), ['taken', 'snooze', 'skipped']));
test('llm failure -> defaults', async () => assert.deepEqual(ids(await pickButtons({ llm: { complete: async () => { throw new Error('x'); } }, role: 'study', reminderText: 'x' })), [...DEFAULT_BUTTONS]));
test('garbage -> defaults', async () => assert.deepEqual(ids(await pickButtons({ llm: { complete: async () => ({ text: 'nope' }) }, role: 'study', reminderText: 'x' })), [...DEFAULT_BUTTONS]));
