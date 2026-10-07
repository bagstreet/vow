import test from 'node:test'; import assert from 'node:assert/strict';
import { pickRole, chatReply } from './chat.mjs';
import { handleUpdate, createMemoryStore } from './telegram-webhook.mjs';
test('pickRole prefix, default, fallback', () => {
  assert.deepEqual(pickRole('study: hi', ['study','fitness'], 'fitness'), { role: 'study', text: 'hi' });
  assert.equal(pickRole('study: hi', ['fitness'], 'fitness').role, 'fitness');
  assert.equal(pickRole('hello', ['nutrition'], 'x').role, 'nutrition');
});
test('chatReply no roles', async () => { assert.equal((await chatReply({ text: 'x', enabled: [], llm: null })).role, null); });
test('free text routed to llm with role prompt', async () => {
  const store = createMemoryStore(); store._s.chats.set('1', { id: 'u' }); store._s.roles.set('u', ['medication']);
  const sent = []; let req;
  const llm = { complete: async (r) => { req = r; return { text: 'ok' }; } };
  const r = await handleUpdate({ update_id: 1, message: { chat: { id: 1 }, text: 'did I take it?' } }, { store, tg: { sendMessage: async (c, t) => sent.push(t) }, llm });
  assert.equal(r.role, 'medication'); assert.equal(sent.length, 1); assert.ok(sent[0].endsWith('\nok')); assert.equal(req.task, 'chat');
});
import { withRoleLabel } from './chat.mjs';
test('role label modes', () => {
  assert.match(withRoleLabel('hi', 'study', 'always'), /^.+\nhi$/);
  assert.equal(withRoleLabel('hi', 'study', 'off'), 'hi');
  assert.equal(withRoleLabel('hi', 'study', 'on_change', 'study'), 'hi');
  assert.notEqual(withRoleLabel('hi', 'study', 'on_change', 'fitness'), 'hi');
});
