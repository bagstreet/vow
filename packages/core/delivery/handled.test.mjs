import test from 'node:test'; import assert from 'node:assert/strict';
import { createSettler, handledText } from './handled.mjs';
test('handledText', () => assert.equal(handledText('Drink water', 'taken', 'slack'), '✓ Drink water: taken (answered in slack)'));
test('settler edits every copy via the right API and never throws', async () => {
  const calls = [];
  const f = async (url, o) => { calls.push([url, o.method, JSON.parse(o.body)]); if (url.includes('discord')) throw new Error('boom'); return { ok: true }; };
  const settle = createSettler({ telegram: 'T', slack: 'S', discord: 'D' }, f);
  const done = await settle({ title: 'Water', status: 'taken', via: 'telegram', messages: [
    { channel: 'telegram', ref: '42:7' }, { channel: 'slack', ref: 'D1:1.2' }, { channel: 'discord', ref: '9:8' }, { channel: 'slack', ref: null } ] });
  assert.deepEqual(done, ['telegram', 'slack']);
  assert.match(calls[0][0], /botT\/editMessageText/); assert.equal(calls[0][2].message_id, 7); assert.deepEqual(calls[0][2].reply_markup.inline_keyboard, []);
  assert.match(calls[1][0], /chat\.update/); assert.equal(calls[1][2].ts, '1.2');
  assert.equal(calls[2][1], 'PATCH');
});
