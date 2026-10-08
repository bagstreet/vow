import test from 'node:test';
import assert from 'node:assert/strict';
import { orderChannels, parsePriority } from './choose.mjs';
import { createSlackAdapter } from './adapters/slack.mjs';
import { runTick } from '../scheduler/tick.mjs';

const ch = (channel, lastSeenAt) => ({ channel, externalId: channel, lastSeenAt });
test('orderChannels: most recent activity wins when no priority set', () => {
  assert.deepEqual(orderChannels([ch('telegram', 1), ch('slack', 5), ch('discord', 3)]).map(c => c.channel), ['slack', 'discord', 'telegram']);
});
test('orderChannels: explicit priority beats recency; unlisted channels follow by recency', () => {
  assert.deepEqual(orderChannels([ch('telegram', 9), ch('slack', 1), ch('discord', 5)], ['slack']).map(c => c.channel), ['slack', 'telegram', 'discord']);
});
test('parsePriority: tolerant parsing, unknown dropped, auto -> []', () => {
  assert.deepEqual(parsePriority('Slack > telegram, slack, foo'), ['slack', 'telegram']);
  assert.deepEqual(parsePriority('auto'), []);
});
test('slack adapter: blocks with action_id occ:reply; ok:false throws', async () => {
  let body;
  const ok = createSlackAdapter({ token: 't', channelId: 'D1', fetchFn: async (_u, o) => { body = JSON.parse(o.body); return { ok: true, json: async () => ({ ok: true }) }; } });
  await ok.send({ occurrenceId: 'occ1', text: 'Take it', buttons: [{ id: 'taken', label: 'Taken' }] });
  assert.equal(body.channel, 'D1'); assert.equal(body.blocks[1].elements[0].action_id, 'occ1:taken');
  const bad = createSlackAdapter({ token: 't', channelId: 'D1', fetchFn: async () => ({ ok: true, json: async () => ({ ok: false, error: 'not_in_channel' }) }) });
  await assert.rejects(bad.send({ occurrenceId: 'o', text: 'x', buttons: [] }), /not_in_channel/);
});
test('tick: user priority picks slack first although telegram was seen more recently; escalation goes to telegram', async () => {
  const outbox = []; let seq = 0; const sent = [];
  const store = {
    initReminders: async () => [], claimSnoozes: async () => [],
    claimDueReminders: async () => (seq++ ? [] : [{ id: 'r', userId: 'u', role: 'medication', title: 'Vit D' }]),
    enqueue: async (r) => { outbox.push({ id: `o${outbox.length}`, status: 'pending', attempts: 0, occurrenceId: r.occurrenceId ?? 'occ', ...r }); },
    claimPendingSends: async (now) => outbox.filter(o => o.status === 'pending' && o.sendAt <= now).map(o => ({ ...o, attempts: ++o.attempts, label: 'Vit D' })),
    channelsFor: async (u, occ) => [ch('telegram', 9), ch('slack', 1)].filter(c => !outbox.some(o => o.occurrenceId === occ && o.channel === c.channel)),
    userPrefs: async () => ({ ackMin: 10, channelPriority: ['slack'] }),
    markSent: async (id, { channel, escalateAt }) => Object.assign(outbox.find(o => o.id === id), { status: 'sent', channel, escalateAt }),
    markRetry: async () => {}, deferSend: async () => {},
    claimEscalations: async (now) => outbox.filter(o => o.status === 'sent' && o.escalateAt <= now).map(o => { o.status = 'escalated'; return o; }),
    expire: async () => {},
  };
  const senders = { telegram: async () => sent.push('telegram'), slack: async () => sent.push('slack') };
  const T = Date.UTC(2026, 9, 6, 8, 0);
  await runTick({ store, senders, now: T });
  await runTick({ store, senders, now: T + 11 * 60000 });
  await runTick({ store, senders, now: T + 12 * 60000 });
  assert.deepEqual(sent, ['slack', 'telegram']);
});
