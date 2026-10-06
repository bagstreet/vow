import test from 'node:test';
import assert from 'node:assert/strict';
import { ChannelRegistry } from './registry.mjs';
import { rankChannels } from './presence.mjs';
import { dispatchReminder, AckBus, InMemoryPermitStore, normalizeSettings } from './escalation.mjs';
import { buildReminder, replyToCheckin } from './quickreply.mjs';

const T0 = Date.UTC(2026, 9, 6, 12, 0);
const occ = { id: 'occ1', label: 'vitamin D' };
const fast = { sleep: async () => {}, retry: { backoffMs: 0 } };
const timeoutNow = { setTimeoutFn: fn => { setImmediate(fn); return 0; }, clearTimeoutFn() {} };

function mock(id, presence, { fail = 0, onSend } = {}) {
  const a = { id, log: [], supportsButtons: true, presence: () => presence,
    async send(m) { if (fail-- > 0) throw new Error('down'); a.log.push(m); onSend?.(m); } };
  return a;
}
const reg = (...as) => as.reduce((r, a) => r.register(a), new ChannelRegistry());

test('online channel beats stale one', async () => {
  const r = await rankChannels([mock('desktop', { state: 'last_seen', ts: 1 }), mock('slack', { state: 'online' })]);
  assert.deepEqual(r.map(x => x.id), ['slack', 'desktop']);
});
test('more recent activity first; no presence -> priority then default order', async () => {
  const r = await rankChannels([mock('slack', { state: 'last_seen', ts: 5 }), mock('discord', { state: 'last_seen', ts: 9 }),
    mock('push', { state: 'unknown' }), mock('telegram', { state: 'unknown' }), mock('desktop', { state: 'unknown' })], { priority: ['push'] });
  assert.deepEqual(r.map(x => x.id), ['discord', 'slack', 'push', 'desktop', 'telegram']);
});
test('no ACK in timeout -> next channel, max 2 sends total', async () => {
  const a = mock('desktop', { state: 'online' }), b = mock('telegram', { state: 'unknown' }), c = mock('web', { state: 'unknown' });
  const res = await dispatchReminder({ account: 'u', occurrence: occ, registry: reg(a, b, c), bus: new AckBus(timeoutNow), now: T0, ...fast });
  assert.equal(res.status, 'unacknowledged');
  assert.equal(a.log.length + b.log.length + c.log.length, 2);
  assert.equal(res.sends.length, 2);
});
test('ACK on first channel cancels escalation; button reply recorded as CHECKIN', async () => {
  const bus = new AckBus(timeoutNow);
  const a = mock('desktop', { state: 'online' }, { onSend: () => bus.ack('occ1', 'taken') }), b = mock('telegram', { state: 'unknown' });
  const res = await dispatchReminder({ account: 'u', occurrence: occ, registry: reg(a, b), bus, now: T0, ...fast });
  assert.equal(res.status, 'acknowledged'); assert.equal(res.checkin.type, 'CHECKIN'); assert.equal(res.checkin.status, 'taken');
  assert.equal(b.log.length, 0);
});
test('send failure -> retry then next channel without consuming extra permit', async () => {
  const a = mock('desktop', { state: 'online' }, { fail: 99 }), b = mock('telegram', { state: 'unknown' }), c = mock('web', { state: 'unknown' });
  const res = await dispatchReminder({ account: 'u', occurrence: occ, registry: reg(a, b, c), bus: new AckBus(timeoutNow), now: T0, ...fast });
  assert.equal(b.log.length + c.log.length, 2); assert.equal(a.log.length, 0);
  assert.deepEqual(res.sends.map(s => s.permit), [1, 2]);
});
test('all channels fail -> unacknowledged, not skipped', async () => {
  const a = mock('desktop', { state: 'online' }, { fail: 99 });
  const res = await dispatchReminder({ account: 'u', occurrence: occ, registry: reg(a), bus: new AckBus(timeoutNow), now: T0, ...fast });
  assert.equal(res.status, 'unacknowledged'); assert.equal(res.sends.length, 0);
});
test('quiet hours respected (incl. wrap past midnight and offset)', async () => {
  const a = mock('desktop', { state: 'online' });
  const res = await dispatchReminder({ account: 'u', occurrence: occ, registry: reg(a), bus: new AckBus(timeoutNow), now: Date.UTC(2026, 9, 6, 23, 30),
    settings: { quietHours: { start: '22:00', end: '07:00' } }, ...fast });
  assert.equal(res.status, 'deferred_quiet_hours'); assert.equal(a.log.length, 0);
  const ok = await dispatchReminder({ account: 'u', occurrence: occ, registry: reg(a), bus: new AckBus(timeoutNow), now: T0,
    settings: { quietHours: { start: '22:00', end: '07:00' } }, ...fast });
  assert.notEqual(ok.status, 'deferred_quiet_hours');
});
test('dedup after restart: permit 1 already used is not resent', async () => {
  const store = new InMemoryPermitStore(); store.put('u:occ1:1', { channel: 'desktop' });
  const a = mock('desktop', { state: 'online' }), b = mock('telegram', { state: 'unknown' });
  const res = await dispatchReminder({ account: 'u', occurrence: occ, registry: reg(a, b), bus: new AckBus(timeoutNow), store, now: T0, ...fast });
  assert.equal(a.log.length, 0); assert.equal(b.log.length, 1); assert.equal(res.sends.length, 1);
});
test('ack_timeout bounds 2..120, default 10', () => {
  assert.equal(normalizeSettings({}).ackTimeoutMin, 10);
  assert.equal(normalizeSettings({ ackTimeoutMin: 0 }).ackTimeoutMin, 2);
  assert.equal(normalizeSettings({ ackTimeoutMin: 999 }).ackTimeoutMin, 120);
});
test('message has quick replies and no medical advice; alias yes/no/later map', () => {
  assert.deepEqual(buildReminder(occ).buttons.map(b => b.id), ['taken', 'skipped', 'snooze']);
  assert.throws(() => buildReminder(occ, { text: 'take 500 mg dose' }));
  assert.equal(replyToCheckin('later', occ).status, 'snooze');
  assert.throws(() => replyToCheckin('maybe', occ));
});
