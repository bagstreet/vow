import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chatReply, trimHistory, MAX_HISTORY_TURNS } from '../packages/core/channels/chat.mjs';
import { handleUpdate, createMemoryStore } from '../packages/core/channels/telegram-webhook.mjs';

const enabled = ['fitness', 'nutrition'];

function capturingLlm() {
  const calls = [];
  return { calls, complete: async (req) => { calls.push(req); return { text: `reply ${calls.length}` }; } };
}

test('trimHistory drops other-role turns and caps length', () => {
  const h = [
    { direction: 'in', appRole: 'fitness', content: 'a' },
    { direction: 'out', appRole: 'fitness', content: 'b' },
    { direction: 'in', appRole: 'nutrition', content: 'c' },
    { direction: 'out', appRole: 'nutrition', content: 'd' },
  ];
  assert.deepEqual(trimHistory(h, 'fitness').map((x) => x.content), ['a', 'b']);
  assert.deepEqual(trimHistory(h, 'nutrition').map((x) => x.content), ['c', 'd']);
  assert.deepEqual(trimHistory(h, null), []);
  assert.deepEqual(trimHistory(null, 'fitness'), []);
});

test('trimHistory caps to MAX_HISTORY_TURNS*2 most recent matching turns', () => {
  const h = [];
  for (let i = 0; i < 20; i++) h.push({ direction: i % 2 ? 'out' : 'in', appRole: 'fitness', content: `m${i}` });
  const trimmed = trimHistory(h, 'fitness');
  assert.equal(trimmed.length, MAX_HISTORY_TURNS * 2);
  assert.equal(trimmed[trimmed.length - 1].content, 'm19');
});

test('chatReply includes prior same-role turns as chat messages, in order', async () => {
  const llm = capturingLlm();
  const history = [
    { direction: 'in', appRole: 'fitness', content: 'how much protein after leg day' },
    { direction: 'out', appRole: 'fitness', content: 'about 30g within 2 hours' },
  ];
  await chatReply({ text: 'and carbs?', enabled, def: 'fitness', llm, history });
  const msgs = llm.calls[0].messages;
  assert.equal(msgs[0].role, 'system');
  assert.deepEqual(msgs.slice(1), [
    { role: 'user', content: 'how much protein after leg day' },
    { role: 'assistant', content: 'about 30g within 2 hours' },
    { role: 'user', content: 'and carbs?' },
  ]);
});

test('chatReply ignores history tagged with a different role than the one picked', async () => {
  const llm = capturingLlm();
  const history = [{ direction: 'in', appRole: 'nutrition', content: 'is fasting ok' }];
  await chatReply({ text: 'plan my leg day', enabled, def: 'fitness', llm, history });
  const msgs = llm.calls[0].messages;
  assert.equal(msgs.length, 2); // system + current question only, no leaked nutrition turn
});

test('telegram webhook: second message in the same role reuses saved history', async () => {
  const store = createMemoryStore();
  await store.linkChannel('u1', 'telegram', '42');
  store._s.roles.set('u1', ['fitness']);
  store._s.def.set('u1', 'fitness');
  const llm = capturingLlm();
  const tg = { answerCallbackQuery: async () => {}, sendMessage: async () => {} };

  await handleUpdate({ update_id: 1, message: { chat: { id: 42 }, text: 'how much protein after leg day' } }, { store, tg, llm });
  await handleUpdate({ update_id: 2, message: { chat: { id: 42 }, text: 'and carbs?' } }, { store, tg, llm });

  assert.equal(llm.calls.length, 2);
  const secondMsgs = llm.calls[1].messages;
  assert.ok(secondMsgs.some((m) => m.content === 'how much protein after leg day'));
  assert.ok(secondMsgs.some((m) => m.content === 'reply 1'));
  assert.equal(store._s.history.get('u1').length, 4); // 2 user-saved + 2 assistant-saved turns
});
