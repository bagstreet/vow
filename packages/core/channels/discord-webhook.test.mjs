import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sign, generateKeyPairSync } from 'node:crypto';
import { handleInteraction, verifyDiscordSignature } from './discord-webhook.mjs';
import { createMemoryStore } from './memory-store.mjs';

test('PING is answered with PONG', async () => {
  const store = createMemoryStore();
  const r = await handleInteraction({ type: 1 }, { store });
  assert.deepEqual(r, { type: 1 });
});

test('link flow via slash command, then /ask uses the role prompt', async () => {
  const store = createMemoryStore();
  store.registerLinkCode('ABC123', 'u1', 'discord');
  store._s.roles.set('u1', ['fitness']);
  store._s.def.set('u1', 'fitness');

  const bad = await handleInteraction({ type: 2, channel_id: 'C1', data: { name: 'link', options: [{ name: 'code', value: 'nope!' }] } }, { store });
  assert.ok(bad.data.content.includes('does not look right'));

  const ok = await handleInteraction({ type: 2, id: 'i1', channel_id: 'C1', data: { name: 'link', options: [{ name: 'code', value: 'ABC123' }] } }, { store });
  assert.ok(ok.data.content.startsWith('Linked'));

  const llm = { complete: async () => ({ text: 'go lift something' }) };
  const ask = await handleInteraction({ type: 2, id: 'i2', channel_id: 'C1', data: { name: 'ask', options: [{ name: 'text', value: 'plan leg day' }] } }, { store, llm });
  assert.ok(ask.data.content.includes('go lift something'));
});

test('duplicate interaction id is not processed twice', async () => {
  const store = createMemoryStore();
  await store.linkChannel('u1', 'discord', 'C1');
  store._s.roles.set('u1', ['fitness']);
  const int = { type: 2, id: 'same-id', channel_id: 'C1', data: { name: 'status' } };
  const r1 = await handleInteraction(int, { store });
  const r2 = await handleInteraction(int, { store });
  assert.ok(r1.data.content.includes('Active roles'));
  assert.equal(r2.data.content, 'Already processed.');
});

test('unknown command for a linked user', async () => {
  const store = createMemoryStore();
  await store.linkChannel('u1', 'discord', 'C1');
  const r = await handleInteraction({ type: 2, id: 'i3', channel_id: 'C1', data: { name: 'nope' } }, { store });
  assert.ok(r.data.content.includes('Unknown command'));
});

test('button press (MESSAGE_COMPONENT) acks the occurrence, silently', async () => {
  const store = createMemoryStore();
  await store.linkChannel('u1', 'discord', 'C1');
  const r = await handleInteraction({ type: 3, channel_id: 'C1', data: { custom_id: 'occ-1:taken' } }, { store });
  assert.deepEqual(r, { type: 6 });
  assert.deepEqual(store._s.acks, [['occ-1', 'taken']]);
});

test('verifyDiscordSignature accepts a real Ed25519 signature and rejects a tampered one', () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const rawPub = publicKey.export({ type: 'spki', format: 'der' }).slice(-32).toString('hex');
  const ts = '123456';
  const body = '{"type":1}';
  const sig = sign(null, Buffer.from(ts + body), privateKey).toString('hex');
  assert.equal(verifyDiscordSignature({ 'x-signature-ed25519': sig, 'x-signature-timestamp': ts }, body, rawPub), true);
  assert.equal(verifyDiscordSignature({ 'x-signature-ed25519': sig, 'x-signature-timestamp': ts }, body + 'x', rawPub), false);
  assert.equal(verifyDiscordSignature({}, body, rawPub), false);
});
