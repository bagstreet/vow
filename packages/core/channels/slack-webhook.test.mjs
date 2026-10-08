import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { handleEvent, handleInteraction, verifySlackSignature } from './slack-webhook.mjs';
import { createMemoryStore } from './memory-store.mjs';

function setup() {
  const store = createMemoryStore();
  const sent = [];
  const slack = { postMessage: async (chat, text) => sent.push({ chat, text }) };
  return { store, slack, sent };
}

test('url_verification handshake echoes the challenge', async () => {
  const { store, slack } = setup();
  const r = await handleEvent({ type: 'url_verification', challenge: 'abc123' }, { store, slack });
  assert.deepEqual(r, { ok: true, challenge: 'abc123' });
});

test('bot/echo messages and non-message subtypes are ignored', async () => {
  const { store, slack } = setup();
  const bot = await handleEvent({ type: 'event_callback', event: { type: 'message', channel: 'C1', ts: '1', bot_id: 'B1', text: 'hi' } }, { store, slack });
  assert.equal(bot.ignored, 'not_a_user_message');
});

test('duplicate event (same channel+ts) is a no-op the second time', async () => {
  const { store, slack } = setup();
  const ev = { type: 'event_callback', event: { type: 'message', channel: 'C1', ts: '100.1', text: '/help' } };
  await handleEvent(ev, { store, slack });
  const r2 = await handleEvent(ev, { store, slack });
  assert.equal(r2.duplicate, true);
});

test('link flow: bad code, valid code, then chat works', async () => {
  const { store, slack, sent } = setup();
  store.registerLinkCode('ABC123', 'u1', 'slack');
  store._s.roles.set('u1', ['fitness']);
  store._s.def.set('u1', 'fitness');

  const bad = await handleEvent({ type: 'event_callback', event: { type: 'message', channel: 'C1', ts: '1', text: '/link nope!' } }, { store, slack });
  assert.equal(bad.linked, false);

  const ok = await handleEvent({ type: 'event_callback', event: { type: 'message', channel: 'C1', ts: '2', text: '/link ABC123' } }, { store, slack });
  assert.equal(ok.linked, true);

  const llm = { complete: async () => ({ text: 'go lift something' }) };
  const chat = await handleEvent({ type: 'event_callback', event: { type: 'message', channel: 'C1', ts: '3', text: 'plan leg day' } }, { store, slack, llm });
  assert.equal(chat.role, 'fitness');
  assert.ok(sent.some((m) => m.text.includes('go lift something')));
});

test('first DM from an unknown Slack user creates the account (bot-first onboarding), no LLM chat', async () => {
  const { store, slack, sent } = setup();
  const llm = { complete: async () => ({ text: 'should not be called' }) };
  await handleEvent({ type: 'event_callback', event: { type: 'message', channel: 'C9', ts: '1', text: 'hello' } }, { store, slack, llm });
  assert.ok(sent[0].text.includes('Welcome to Vow'));
  assert.ok(await store.userByChat('C9', 'slack'));
});

test('block_actions interaction acks the occurrence for a linked channel only', async () => {
  const { store, slack } = setup();
  await store.linkChannel('u1', 'slack', 'C1');
  const r = await handleInteraction({ type: 'block_actions', channel: { id: 'C1' }, actions: [{ action_id: 'occ-1:taken' }] }, { store, slack });
  assert.equal(r.acked, 'occ-1');
  assert.deepEqual(store._s.acks, [['occ-1', 'taken']]);

  const r2 = await handleInteraction({ type: 'block_actions', channel: { id: 'C_unknown' }, actions: [{ action_id: 'occ-2:taken' }] }, { store, slack });
  assert.equal(r2.ignored, 'unlinked_chat');
});

test('verifySlackSignature matches Slack\'s v0 HMAC scheme and rejects stale/garbled requests', () => {
  const secret = 'shhh';
  const ts = String(Math.floor(Date.now() / 1000));
  const body = 'payload=abc';
  const sig = 'v0=' + createHmac('sha256', secret).update(`v0:${ts}:${body}`).digest('hex');
  assert.equal(verifySlackSignature({ 'x-slack-request-timestamp': ts, 'x-slack-signature': sig }, body, secret), true);
  assert.equal(verifySlackSignature({ 'x-slack-request-timestamp': ts, 'x-slack-signature': 'v0=deadbeef' }, body, secret), false);
  const old = String(Math.floor(Date.now() / 1000) - 600);
  const oldSig = 'v0=' + createHmac('sha256', secret).update(`v0:${old}:${body}`).digest('hex');
  assert.equal(verifySlackSignature({ 'x-slack-request-timestamp': old, 'x-slack-signature': oldSig }, body, secret), false);
});

test('slack: /link on a returning user says welcome back', async () => {
  const { createMemoryStore } = await import('./memory-store.mjs');
  const store = createMemoryStore(); store.registerLinkCode('ABC123', 'u1', 'slack');
  store.listChannels = async () => ['telegram'];
  const sent = []; const slack = { postMessage: async (_c, t) => sent.push(t) };
  await handleEvent({ type: 'event_callback', event: { type: 'message', channel: 'D1', ts: '1', text: '/link ABC123' } }, { store, slack });
  assert.ok(sent.some(t => /Welcome back — I already know you from telegram/.test(t)));
});
