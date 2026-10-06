import test from 'node:test';
import assert from 'node:assert/strict';
import { createTelegramAdapter } from './telegram.mjs';
import { buildReminder } from '../quickreply.mjs';

const mk = (over = {}) => { const calls = [];
  const fetchFn = async (url, o) => { calls.push({ url, body: JSON.parse(o.body) }); return { ok: true, json: async () => ({ ok: true, result: {} }) }; };
  return { calls, a: createTelegramAdapter({ token: 'T', chatId: 42, fetchFn, ...over }) }; };

test('send posts inline keyboard with occ:reply callback data', async () => {
  const { a, calls } = mk();
  await a.send(buildReminder({ id: 'o1', label: 'water' }));
  assert.match(calls[0].url, /botT\/sendMessage$/);
  assert.deepEqual(calls[0].body.reply_markup.inline_keyboard[0].map(b => b.callback_data), ['o1:taken', 'o1:skipped', 'o1:snooze']);
});
test('parseUpdate accepts own chat only', () => {
  const { a } = mk();
  const u = c => ({ callback_query: { id: 'c', data: 'o1:snooze', message: { chat: { id: c } } } });
  assert.deepEqual(a.parseUpdate(u(42)), { occurrenceId: 'o1', reply: 'snooze', callbackId: 'c' });
  assert.equal(a.parseUpdate(u(7)), null);
  assert.equal(a.parseUpdate({}), null);
});
test('presence from lastSeen', () => {
  const { a } = mk({ lastSeen: () => 1000, now: () => 1000 + 60_000 });
  assert.equal(a.presence().state, 'online');
  assert.equal(mk().a.presence().state, 'unknown');
  assert.equal(mk({ lastSeen: () => 0, now: () => 3_600_000 }).a.presence().state, 'last_seen');
});
test('API error throws (so router retries/escalates)', async () => {
  const a = createTelegramAdapter({ token: 'T', chatId: 1, fetchFn: async () => ({ ok: false, status: 400, json: async () => ({ ok: false, description: 'bad' }) }) });
  await assert.rejects(a.send(buildReminder({ id: 'o', label: 'x' })), /bad/);
});
test('roleTag: italic last line, HTML-escaped text, Role button', async () => {
  const { a, calls } = mk();
  await a.send({ ...buildReminder({ id: 'o2', label: 'a<b' }), roleTag: { emoji: '💊', label: 'Medication Tracker', alsoUsed: ['Sobriety'] } });
  const b = calls[0].body;
  assert.equal(b.parse_mode, 'HTML');
  assert.match(b.text, /<i>💊 Medication Tracker · also: Sobriety<\/i>$/);
  assert.doesNotMatch(b.text, /a<b/);
  assert.equal(b.reply_markup.inline_keyboard[1][0].callback_data, 'o2:role');
});
test('no roleTag: unchanged plain message', async () => {
  const { a, calls } = mk();
  await a.send(buildReminder({ id: 'o3', label: 'water' }));
  assert.equal(calls[0].body.parse_mode, undefined);
  assert.equal(calls[0].body.reply_markup.inline_keyboard.length, 1);
});
