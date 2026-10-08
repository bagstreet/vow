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

test('tone is injected into the system prompt, neutral adds nothing', async () => {
  const seen = [];
  const llm = { complete: async ({ messages }) => { seen.push(messages[0].content); return { text: 'x' }; } };
  await chatReply({ text: 'hi', enabled: ['fitness'], def: 'fitness', llm, tone: 'strict' });
  await chatReply({ text: 'hi', enabled: ['fitness'], def: 'fitness', llm, tone: 'neutral' });
  assert.match(seen[0], /accountability language/); assert.doesNotMatch(seen[1], /Tone:/);
});

import { shouldRemember } from './chat.mjs';
test('shouldRemember: skips noise, keeps facts', () => {
  assert.equal(shouldRemember('ping', 'fitness'), false);
  assert.equal(shouldRemember('привет!', 'fitness'), false);
  assert.equal(shouldRemember('I take 5mg of X every morning', null), false);
  assert.equal(shouldRemember('/start', 'fitness'), false);
  assert.equal(shouldRemember('I take 5mg of X every morning', 'medication'), true);
});

test('contradiction guard: prompt tells the model to name both versions and ask when memory conflicts', async () => {
  let req; const llm = { complete: async (r) => { req = r; return { text: 'ok' }; } };
  await chatReply({ text: 'I take 20 mg', enabled: ['medication'], def: 'medication', llm, remembered: ['[telegram] I take 10 mg'] });
  const sys = req.messages[0].content;
  assert.match(sys, /I take 10 mg/); assert.match(sys, /conflicts with a remembered fact/); assert.match(sys, /ask which is correct/);
});

test('shouldRemember skips greetings and filler', () => {
  for (const t of ['hello there', 'good morning!', 'how are you', 'добрый день', 'got it']) assert.equal(shouldRemember(t, 'fitness'), false, t);
  assert.equal(shouldRemember('I deadlift 100 kg on Mondays', 'fitness'), true);
});

import { splitMessage } from './chat.mjs';
test('splitMessage keeps chunks within the limit and loses no text', () => {
  const t = Array.from({ length: 300 }, (_, i) => `word${i}`).join(' ');
  const parts = splitMessage(t, 200);
  assert.ok(parts.length > 1 && parts.every((p) => p.length <= 200));
  assert.equal(parts.join(' ').replace(/\s+/g, ' '), t);
  assert.deepEqual(splitMessage('short', 200), ['short']);
});
