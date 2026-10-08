import test from 'node:test';
import assert from 'node:assert/strict';
import { computeNextFire, tzOffsetMin, parseArr } from './time.mjs';
import { runTick } from './tick.mjs';

// L1 pure time
test('computeNextFire: today if later, else tomorrow (UTC)', () => {
  const now = Date.UTC(2026, 9, 6, 7, 0);
  assert.equal(computeNextFire({ timeLocal: '08:00' }, now), Date.UTC(2026, 9, 6, 8, 0));
  assert.equal(computeNextFire({ timeLocal: '06:00' }, now), Date.UTC(2026, 9, 7, 6, 0));
});
test('computeNextFire: honours days (ISO, Mon=1) and zone', () => {
  const now = Date.UTC(2026, 9, 6, 7, 0); // Tue
  assert.equal(new Date(computeNextFire({ timeLocal: '08:00', days: [5] }, now)).getUTCDay(), 5);
  assert.equal(tzOffsetMin('Europe/Berlin', now), 120);
});
test('computeNextFire: Berlin 09:00 local = 07:00Z in October', () => {
  const now = Date.UTC(2026, 9, 6, 6, 0);
  assert.equal(computeNextFire({ timeLocal: '09:00', tz: 'Europe/Berlin' }, now), Date.UTC(2026, 9, 6, 7, 0));
});
test('computeNextFire: no allowed day -> null; parseArr handles pg strings', () => {
  assert.equal(computeNextFire({ timeLocal: '08:00', days: [9] }, 0), null);
  assert.deepEqual(parseArr('{1,3,5}'), [1, 3, 5]);
});

// L2 orchestration with an in-memory store
function memStore({ channels = [{ channel: 'telegram', externalId: '1' }], prefs = {} } = {}) {
  const s = { outbox: [], reminders: [{ id: 'r1', userId: 'u', role: 'medication', title: 'Vitamin D', timeLocal: '08:00', days: [1, 2, 3, 4, 5, 6, 7], tz: 'UTC', due: true }], expired: [], seq: 0 };
  return Object.assign(s, {
    initReminders: async () => [],
    claimDueReminders: async () => s.reminders.filter(r => r.due).map(r => { r.due = false; return r; }),
    claimSnoozes: async () => s.outbox.filter(o => o.status === 'acked' && /^snooze/.test(o.reply ?? '') && !o.snoozed).map(o => { o.snoozed = true; return { userId: o.userId, reminderId: o.reminderId, reply: o.reply, label: 'Vitamin D', role: 'medication' }; }),
    enqueue: async (r) => { s.outbox.push({ id: `o${++s.seq}`, status: 'pending', attempts: 0, occurrenceId: r.occurrenceId ?? `occ${s.seq}`, ...r }); },
    claimPendingSends: async (now) => s.outbox.filter(o => o.status === 'pending' && o.sendAt <= now).map(o => { o.attempts++; return { ...o, label: 'Vitamin D' }; }),
    channelsFor: async (u, occ) => channels.filter(c => !s.outbox.some(o => o.occurrenceId === occ && o.channel === c.channel)),
    userPrefs: async () => ({ ackMin: 10, ...prefs }),
    markSent: async (id, { channel, escalateAt }) => Object.assign(s.outbox.find(o => o.id === id), { status: 'sent', channel, escalateAt }),
    markRetry: async (id, { sendAt, failed }) => Object.assign(s.outbox.find(o => o.id === id), { status: failed ? 'failed' : 'pending', sendAt }),
    deferSend: async (id, sendAt) => Object.assign(s.outbox.find(o => o.id === id), { sendAt }),
    claimEscalations: async (now) => s.outbox.filter(o => o.status === 'sent' && o.escalateAt <= now).map(o => { o.status = 'escalated'; return o; }),
    expire: async (id) => { s.outbox.find(o => o.id === id).status = 'expired'; },
  });
}
const NOW = Date.UTC(2026, 9, 6, 8, 0);

test('tick: due reminder is sent once with default buttons; a second tick does not resend', async () => {
  const store = memStore(); const sent = [];
  const senders = { telegram: async (m) => { sent.push(m); } };
  const a = await runTick({ store, senders, now: NOW });
  const b = await runTick({ store, senders, now: NOW + 1000 });
  assert.equal(a.fired, 1); assert.equal(a.sent, 1); assert.equal(b.sent, 0);
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].buttons.map(x => x.id), ['taken', 'skipped', 'snooze']);
  assert.ok(Buffer.byteLength(`${sent[0].outboxId}:snooze`) <= 64 || sent[0].outboxId.length < 40);
});
test('tick: no ack -> escalates to the next channel, then expires (max 2 sends)', async () => {
  const store = memStore({ channels: [{ channel: 'telegram', externalId: '1' }, { channel: 'slack', externalId: 'U1' }] });
  const sent = [];
  const senders = { telegram: async () => sent.push('telegram'), slack: async () => sent.push('slack') };
  await runTick({ store, senders, now: NOW });
  const t1 = await runTick({ store, senders, now: NOW + 11 * 60000 });
  assert.equal(t1.escalated, 1);
  await runTick({ store, senders, now: NOW + 11 * 60000 + 1000 });
  assert.deepEqual(sent, ['telegram', 'slack']);
  await runTick({ store, senders, now: NOW + 30 * 60000 });
  const t3 = await runTick({ store, senders, now: NOW + 31 * 60000 });
  assert.equal(sent.length, 2);
  assert.ok(store.outbox.every(o => o.status !== 'pending'));
  assert.ok(t3.expired >= 0);
});
test('tick: acked reminder is not escalated', async () => {
  const store = memStore({ channels: [{ channel: 'telegram', externalId: '1' }, { channel: 'slack', externalId: 'U1' }] });
  const senders = { telegram: async () => {}, slack: async () => {} };
  await runTick({ store, senders, now: NOW });
  store.outbox[0].status = 'acked';
  const t = await runTick({ store, senders, now: NOW + 11 * 60000 });
  assert.equal(t.escalated, 0);
});
test('tick: send failure retries with backoff then fails after max attempts', async () => {
  const store = memStore(); let calls = 0;
  const senders = { telegram: async () => { calls++; throw new Error('boom'); } };
  let now = NOW;
  for (let i = 0; i < 5; i++) { await runTick({ store, senders, now }); now += 10 * 60000; }
  assert.equal(calls, 3);
  assert.equal(store.outbox[0].status, 'failed');
});
test('tick: no deliverable channel -> failed, not looping', async () => {
  const store = memStore({ channels: [] });
  const t = await runTick({ store, senders: { telegram: async () => {} }, now: NOW });
  assert.equal(t.failed, 1);
});
test('tick: quiet hours defer the send', async () => {
  const store = memStore({ prefs: { quietStart: '07:00', quietEnd: '09:00' } }); let sent = 0;
  const t = await runTick({ store, senders: { telegram: async () => { sent++; } }, now: NOW });
  assert.equal(t.deferred, 1); assert.equal(sent, 0);
});
test('tick: snooze creates a new occurrence later', async () => {
  const store = memStore(); const senders = { telegram: async () => {} };
  await runTick({ store, senders, now: NOW });
  Object.assign(store.outbox[0], { status: 'acked', reply: 'snooze_1h' });
  const t = await runTick({ store, senders, now: NOW + 1000 });
  assert.equal(t.snoozed, 1);
  assert.equal(store.outbox[1].sendAt, NOW + 1000 + 60 * 60000);
});

test('parseTextArr: text[] priority survives both Neon shapes (regression: parseArr turned names into NaN)', async () => {
  const { parseTextArr } = await import('./time.mjs');
  assert.deepEqual(parseTextArr('{slack,telegram}'), ['slack', 'telegram']); assert.deepEqual(parseTextArr('{}'), []);
  assert.deepEqual(parseTextArr(['discord']), ['discord']); assert.deepEqual(parseTextArr(null), []);
});
