import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIntent, runIntent, parseTime, parseDays, scheduleContext } from './intent.mjs';
import { resolveOnce } from './once.mjs';
import { computeNextFire } from '../scheduler/time.mjs';

const mkStore = (o = {}) => {
  const s = { acks: [], reminders: o.reminders ?? [], added: [], removed: [], occ: o.occ ?? null };
  return { _s: s,
    latestOpenOccurrence: async () => s.occ,
    ackOccurrence: async (id, st) => { s.acks.push([id, st]); return { title: s.occ.title, role: s.occ.role, messages: [] }; },
    listUserReminders: async () => s.reminders,
    addUserReminder: async (_u, v) => { s.added.push(v); s.reminders.push({ id: 'x' + s.added.length, enabled: true, ...v }); },
    removeUserReminder: async (_u, id) => { s.removed.push(id); } };
};
const mem = () => { const w = []; return { w, remember: async (_u, t) => { w.push(t); } }; };
const user = { id: 'u1', default_role: 'fitness' };
const run = (text, store, memory = mem(), enabled = ['fitness', 'medication']) => runIntent({ text, user, store, memory, settle: async () => [], channel: 'telegram', enabled });

test('parse: "I took it" in RU and EN is an ack, questions are not', () => {
  for (const t of ['запиши, что принял', 'принял', 'took it', 'done', 'Выпила витамины']) assert.deepEqual(parseIntent(t), { type: 'ack', status: 'taken' }, t);
  for (const t of ['не принял сегодня', 'skipped it', "didn't take it", 'пропустил']) assert.equal(parseIntent(t).status, 'skip', t);
  assert.equal(parseIntent('напомни позже').status, 'snooze');
  assert.equal(parseIntent('что я принял вчера?'), null);
  assert.equal(parseIntent('Today I ran 5 km, great'), null);
});
test('parse: time and days', () => {
  assert.equal(parseTime('в 9 утра'), '09:00'); assert.equal(parseTime('at 7pm'), '19:00'); assert.equal(parseTime('в 21:30'), '21:30'); assert.equal(parseTime('at 12am'), '00:00');
  assert.equal(parseTime('приём таблеток'), null); assert.equal(parseTime('в 25:00'), null);
  assert.deepEqual(parseDays('по будням'), [1, 2, 3, 4, 5]); assert.deepEqual(parseDays('weekends'), [6, 7]); assert.deepEqual(parseDays('каждый день'), [1, 2, 3, 4, 5, 6, 7]); assert.deepEqual(parseDays('в пн и пт'), [1, 5]);
});
test('ack with an open reminder logs it, acks it, writes memory and says what was logged', async () => {
  const st = mkStore({ occ: { id: 'o1', title: 'Vitamin D', role: 'medication' } }); const m = mem();
  const r = await run('запиши, что принял', st, m);
  assert.deepEqual(st._s.acks, [['o1', 'taken']]); assert.match(r.text, /Logged: "Vitamin D" — taken/); assert.equal(r.role, 'medication'); assert.match(m.w[0], /Vitamin D.*taken/);
});
test('ack with nothing pending falls through to the model (no fake confirmation)', async () => {
  assert.equal(await run('took it', mkStore()), null);
});
test('skip is logged but snooze is not written to memory', async () => {
  const st = mkStore({ occ: { id: 'o1', title: 'Run', role: 'fitness' } }); const m = mem();
  await run('skipped', st, m); assert.match(m.w[0], /skipped/);
  const m2 = mem(); const r = await run('напомни позже', st, m2); assert.equal(m2.w.length, 0); assert.match(r.text, /again later/);
});
test('off-topic text with a pending reminder is not an action and leaves it pending', async () => {
  const st = mkStore({ occ: { id: 'o1', title: 'Run', role: 'fitness' } });
  assert.equal(await run('how many calories in a banana', st), null); assert.equal(st._s.acks.length, 0);
});
test('create from chat: role routed, saved, remembered, deduplicated', async () => {
  const st = mkStore(); const m = mem();
  const r = await run('Напомни мне принять витамин D в 9:00 каждый день', st, m);
  assert.equal(st._s.added.length, 1); assert.equal(st._s.added[0].time, '09:00'); assert.match(r.text, /dashboard/); assert.match(m.w[0], /schedule/);
  assert.match((await run('Напомни мне принять витамин D в 9:00 каждый день', st)).text, /already have/); assert.equal(st._s.added.length, 1);
});
test('create without time or title asks instead of guessing', async () => {
  const st = mkStore();
  assert.match((await run('напомни выпить воду', st)).text, /what time|At what time/i); assert.match((await run('remind me at 9', st)).text, /What should I remind/);
  assert.equal(st._s.added.length, 0);
});
test('list and delete (by name, by number, ambiguity)', async () => {
  const st = mkStore({ reminders: [{ id: 'a', title: 'Vitamin D', role: 'medication', time: '09:00', days: [1, 2, 3, 4, 5, 6, 7], enabled: true }, { id: 'b', title: 'Vitamin C', role: 'medication', time: '10:00', days: [1, 2, 3, 4, 5], enabled: true }] });
  assert.match((await run('my reminders', st)).text, /1\. Vitamin D — 09:00 daily/);
  assert.match((await run('delete reminder vitamin', st)).text, /Several match/); assert.equal(st._s.removed.length, 0);
  await run('удали напоминание vitamin c', st); assert.deepEqual(st._s.removed, ['b']);
  await run('delete reminder #1', st); assert.deepEqual(st._s.removed, ['b', 'a']);
  assert.match((await run('delete reminder nothing', mkStore())).text, /could not find/);
});
test('schedule context names reminders so the model can answer "what was that reminder"', () => {
  const c = scheduleContext([{ title: 'dadsa', time: '18:40', days: [1, 2, 3, 4, 5, 6, 7], role: 'fitness' }], { title: 'dadsa', role: 'fitness', status: 'sent' });
  assert.match(c, /"dadsa" 18:40 daily \(fitness\)/); assert.match(c, /Most recent reminder sent/);
});

test('open check-in adds a reply-disambiguation hint; closed one does not', () => {
  assert.match(scheduleContext([], { title: 'Pills', role: 'medication', status: 'sent' }), /still open/);
  assert.doesNotMatch(scheduleContext([], { title: 'Pills', role: 'medication', status: 'acked' }), /still open/);
});

import { mentionsOtherSubject } from './intent.mjs';
test('ack text that names another subject does not close the open check-in', () => {
  assert.equal(mentionsOtherSubject('I took magnesium 200 mg at 9:00 today', 'drink water'), true);
  assert.equal(mentionsOtherSubject('took it', 'drink water'), false);
  assert.equal(mentionsOtherSubject('drank the water, done', 'drink water'), false);
  assert.equal(mentionsOtherSubject('запиши, что принял', 'Vitamin D'), false);
  assert.equal(mentionsOtherSubject('took vitamin', 'Vitamin D'), false);
});

test('parse: doses and quantities in the title are kept, only the time is stripped', () => {
  const r = parseIntent('I take magnesium 200 mg every evening, remind me at 21:00');
  assert.equal(r.type, 'create'); assert.equal(r.time, '21:00'); assert.match(r.title, /200 mg/);
  assert.match(parseIntent('напомни в 9 принять 200 мг магния').title, /200 мг/);
  assert.equal(parseIntent('remind me to call mom at 7pm').title, 'call mom');
});

test('parse: spoken and unusual time formats (English)', () => {
  const cases = [['remind me to take vitamins at noon', '12:00', 'take vitamins'], ['remind me to stretch at half past one', '01:30', 'stretch'],
    ['remind me to call mom at quarter to five', '04:45', 'call mom'], ['remind me to read at 12h', '12:00', 'read'], ['remind me to meditate at 7 in the evening', '19:00', 'meditate'],
    ["remind me at nine o'clock to journal", '09:00', 'journal'], ['remind me to sleep at midnight', '00:00', 'sleep'], ['remind me to run at six thirty', '06:30', 'run'],
    ['remind me to drink water at twenty past six pm', '18:20', 'drink water'], ['remind me to take 2 pills at 8 am', '08:00', 'take 2 pills'], ['remind me to eat at 12:30 pm', '12:30', 'eat']];
  for (const [t, time, title] of cases) { const r = parseIntent(t); assert.equal(r.time, time, t); assert.equal(r.title, title, t); }
});

test('once: resolveOnce handles tomorrow, today, next weekday, in N minutes, dates, and leaves recurring alone', () => {
  const now = Date.UTC(2026, 9, 9, 10, 0); // Fri 2026-10-09 10:00 UTC
  const r = (t, time) => resolveOnce(t, { now, tz: 'UTC', time });
  assert.deepEqual(r('remind me tomorrow at 9', '09:00'), { date: '2026-10-10' });
  assert.deepEqual(r('remind me today at 18:00', '18:00'), { date: '2026-10-09' });
  assert.deepEqual(r('remind me today at 8:00', '08:00'), { date: '2026-10-10' }); // already past
  assert.deepEqual(r('call mom next monday at 9', '09:00'), { date: '2026-10-12' });
  assert.deepEqual(r('remind me in 90 minutes to stretch'), { date: '2026-10-09', time: '11:30' });
  assert.deepEqual(r('remind me on Oct 20 at 9', '09:00'), { date: '2026-10-20' });
  assert.deepEqual(r('remind me on 2026-11-01 at 9', '09:00'), { date: '2026-11-01' });
  assert.equal(r('remind me every day at 9', '09:00'), null);
  assert.equal(r('remind me on monday at 9', '09:00'), null);
  assert.deepEqual(resolveOnce('tomorrow at 9', { now: Date.UTC(2026, 9, 9, 15, 0), tz: 'Pacific/Auckland', time: '09:00' }), { date: '2026-10-11' }); // NZ is already Saturday
});

test('once: computeNextFire for one-time reminders, then null after the date', () => {
  const now = Date.UTC(2026, 9, 9, 10, 0);
  assert.equal(computeNextFire({ timeLocal: '09:00', tz: 'UTC', onceDate: '2026-10-10' }, now), Date.UTC(2026, 9, 10, 9, 0));
  assert.equal(computeNextFire({ timeLocal: '09:00', tz: 'Europe/Minsk', onceDate: '2026-10-10' }, now), Date.UTC(2026, 9, 10, 6, 0));
  assert.equal(computeNextFire({ timeLocal: '09:00', tz: 'UTC', onceDate: '2026-10-09' }, now), null);
});

test('create: one-time wording stores a date, recurring wording does not', async () => {
  const added = [];
  const store = { listUserReminders: async () => [], addUserReminder: async (_u, v) => { added.push(v); } };
  const user = { id: 'u', default_role: 'fitness', tz: 'UTC' };
  const a = await runIntent({ text: 'remind me to stretch tomorrow at 9:00', user, store, channel: 'telegram', enabled: ['fitness'] });
  assert.match(a.text, /once on \d{4}-\d{2}-\d{2}/); assert.match(added[0].date, /^\d{4}-\d{2}-\d{2}$/); assert.equal(added[0].title, 'stretch');
  const b = await runIntent({ text: 'remind me to stretch at 9:00 daily', user, store, channel: 'telegram', enabled: ['fitness'] });
  assert.doesNotMatch(b.text, /once/); assert.equal(added[1].date, null);
  const c = await runIntent({ text: 'remind me in 20 minutes to check the oven', user, store, channel: 'telegram', enabled: ['fitness'] });
  assert.match(c.text, /once on/); assert.equal(added[2].title, 'check the oven');
});
