import test from 'node:test';
import assert from 'node:assert/strict';
import { createDiscordAdapter } from './discord.mjs';

const mk = () => {
  const calls = [];
  const fetchFn = async (url, o) => {
    calls.push({ url, body: JSON.parse(o.body), auth: o.headers.authorization });
    if (url.endsWith('/users/@me/channels')) return { ok: true, json: async () => ({ id: 'dm-1' }) };
    return { ok: true, json: async () => ({ id: 'msg-1' }) };
  };
  return { calls, a: createDiscordAdapter({ token: 'T', userId: 'U1', fetchFn }) };
};

test('send opens a DM channel then posts a message with button components', async () => {
  const { a, calls } = mk();
  await a.send({ occurrenceId: 'o1', text: 'Drink water', buttons: [{ id: 'taken', label: 'Taken' }, { id: 'skipped', label: 'Skip' }] });
  assert.equal(calls[0].url, 'https://discord.com/api/v10/users/@me/channels');
  assert.deepEqual(calls[0].body, { recipient_id: 'U1' });
  assert.equal(calls[1].url, 'https://discord.com/api/v10/channels/dm-1/messages');
  assert.equal(calls[1].body.content, 'Drink water');
  assert.deepEqual(calls[1].body.components[0].components.map((c) => c.custom_id), ['o1:taken', 'o1:skipped']);
  assert.ok(calls.every((c) => c.auth === 'Bot T'));
});

test('DM channel id is cached: only one channel-open call across two sends', async () => {
  const { a, calls } = mk();
  await a.send({ occurrenceId: 'o1', text: 'a', buttons: [] });
  await a.send({ occurrenceId: 'o2', text: 'b', buttons: [] });
  assert.equal(calls.filter((c) => c.url.endsWith('/channels')).length, 1);
});

test('roleTag is appended as an italic line, buttons default to empty row', async () => {
  const { a, calls } = mk();
  await a.send({ occurrenceId: 'o3', text: 'Log weight', buttons: [], roleTag: { emoji: '💊', label: 'Med Tracker', alsoUsed: ['Coach'] } });
  assert.match(calls[1].body.content, /Log weight\n\n_💊 Med Tracker · also: Coach_$/);
  assert.deepEqual(calls[1].body.components, []);
});

test('API error throws (so router retries/escalates)', async () => {
  const a = createDiscordAdapter({
    token: 'T', userId: 'U1',
    fetchFn: async (url) => url.endsWith('/channels')
      ? { ok: true, json: async () => ({ id: 'dm-1' }) }
      : { ok: false, status: 400, json: async () => ({ message: 'bad' }) },
  });
  await assert.rejects(a.send({ occurrenceId: 'o', text: 'x', buttons: [] }), /bad/);
});
