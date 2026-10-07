import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeButtons, pickButtons, DEFAULT_BUTTONS } from './buttons.mjs';
test('drops unknown ids and dedupes', () => assert.deepEqual(sanitizeButtons(['yes', 'hack', 'yes', 'no']), ['yes', 'no']));
test('too few valid ids -> defaults', () => assert.deepEqual(sanitizeButtons(['yes']), DEFAULT_BUTTONS));
test('model output parsed', async () => assert.deepEqual(await pickButtons({ llm: { complete: async () => ({ text: 'Sure: ["done","snooze"]' }) }, role: 'study', reminderText: 'x' }), ['done', 'snooze']));
test('llm failure -> defaults', async () => assert.deepEqual(await pickButtons({ llm: { complete: async () => { throw new Error('x'); } }, role: 'study', reminderText: 'x' }), DEFAULT_BUTTONS));
test('garbage -> defaults', async () => assert.deepEqual(await pickButtons({ llm: { complete: async () => ({ text: 'nope' }) }, role: 'study', reminderText: 'x' }), DEFAULT_BUTTONS));
