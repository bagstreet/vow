import test from 'node:test'; import assert from 'node:assert/strict';
import { handleDash, cleanReminder, cleanPrefs } from './dash.mjs';
import { hashToken, readCookie, cookieHeader } from './session.mjs';

function makeStore() {
  const s = { users: new Map(), sessions: new Map(), logins: new Map(), magic: new Map(), rem: [], chans: [], msgs: [], mem: [], n: 0 };
  const mkUser = (extra = {}) => { const id = 'u' + ++s.n; s.users.set(id, { id, display_name: 'T', email: null, tz: 'UTC', tone: 'friendly', role_label: 'on_change', default_role: 'fitness', last_role: null, quiet_start: null, quiet_end: null, ack_min: 10, channel_priority: [], roles: ['fitness'], ...extra }); return s.users.get(id); };
  return { _s: s, mkUser,
    consumeLoginToken: async (t) => { const u = s.logins.get(t); s.logins.delete(t); return u ? { id: u } : null; },
    createSession: async (u, h) => { s.sessions.set(h, u); }, sessionUser: async (h) => s.sessions.get(h) ?? null, deleteSession: async (h) => { s.sessions.delete(h); },
    countRecentMagic: async (e) => [...s.magic.values()].filter((m) => m.email === e).length,
    createMagic: async (email, h, userId = null) => { s.magic.set(h, { email, userId }); }, consumeMagic: async (h) => { const m = s.magic.get(h); if (!m || m.used) return null; m.used = true; return { email: m.email, userId: m.userId }; },
    countLinkRequestsToday: async (u) => [...s.magic.values()].filter((m) => m.userId === u).length,
    emailOwner: async (e) => [...s.users.values()].find((u) => u.email === e)?.id ?? null, setEmail: async (id, e) => { s.users.get(id).email = e; }, clearEmail: async (id) => { s.users.get(id).email = null; },
    findOrCreateByEmail: async (email) => [...s.users.values()].find((u) => u.email === email) ?? mkUser({ email }),
    getProfile: async (id) => s.users.get(id) ?? null,
    updateProfile: async (id, p) => { const u = s.users.get(id); const m = { displayName: 'display_name', tz: 'tz', tone: 'tone', roleLabel: 'role_label', ackMin: 'ack_min', defaultRole: 'default_role', quietStart: 'quiet_start', quietEnd: 'quiet_end', priority: 'channel_priority' }; for (const [k, v] of Object.entries(p)) if (m[k]) u[m[k]] = v; },
    listRoles: async (id) => s.users.get(id).roles, setRoles: async (id, r) => { s.users.get(id).roles = r; }, setLastRole: async (id, r) => { s.users.get(id).last_role = r; },
    listChannels: async (id) => s.chans.filter((c) => c.userId === id), unlinkChannel: async (id, cid) => { s.chans = s.chans.filter((c) => c.id !== cid); },
    listReminders: async (id) => s.rem.filter((r) => r.userId === id),
    createReminder: async (id, v) => { const r = { id: 'r' + ++s.n, userId: id, title: v.title, role: v.role, time: v.time, days: v.days, channel: v.channel ?? null, enabled: true }; s.rem.push(r); return r; },
    updateReminder: async (id, rid, v) => { const r = s.rem.find((x) => x.id === rid && x.userId === id); if (!r) return null; Object.assign(r, v); return r; },
    deleteReminder: async (id, rid) => { const n = s.rem.length; s.rem = s.rem.filter((x) => !(x.id === rid && x.userId === id)); return s.rem.length < n; },
    listMessages: async (id) => s.msgs.filter((m) => m.u === id), listMemoryLog: async (id) => s.mem.filter((m) => m.u === id),
    getHistory: async (id) => s.msgs.filter((m) => m.u === id).map((m) => ({ direction: m.direction, appRole: m.role, content: m.content })),
    saveMessage: async (u, channel, direction, content, role) => { s.msgs.push({ u, channel, direction, content, role }); },
    logMemory: async (u, v) => { s.mem.push({ u, id: 'm' + s.mem.length, ...v }); },
    forgetMemory: async (u, id) => { const m = s.mem.find((x) => x.u === u && x.id === id && !x.forgotten_at); if (!m) return false; m.forgotten_at = 1; return true; },
    exportAll: async (id) => ({ profile: s.users.get(id), reminders: s.rem.filter((r) => r.userId === id) }),
    deleteAccount: async (id) => { s.users.delete(id); s.rem = s.rem.filter((r) => r.userId !== id); s.chans = s.chans.filter((c) => c.userId !== id); },
    createLinkCode: async () => ({ code: 'ABCD2345', expiresAt: 'x', ttlMinutes: 10 }), isChannelLinked: async ({ userId, channel }) => s.chans.some((c) => c.userId === userId && c.channel === channel),
  };
}
const call = (store, op, method, body, userId, deps) => handleDash({ store, op, method, body, userId, deps });

test('every authenticated op rejects an anonymous caller', async () => {
  const st = makeStore();
  for (const [op, m] of [['me', 'GET'], ['prefs', 'PATCH'], ['reminders', 'GET'], ['reminders', 'POST'], ['channels', 'DELETE'], ['history', 'GET'], ['chat', 'POST'], ['export', 'GET'], ['account', 'DELETE'], ['link-code', 'POST'], ['link-status', 'GET']]) {
    assert.equal((await call(st, op, m, {}, null)).status, 401, `${op} ${m}`);
  }
});

test('bot /login token: one-time, creates a server session', async () => {
  const st = makeStore(); const u = st.mkUser(); st._s.logins.set('tok', u.id);
  const r = await call(st, 'login', 'POST', { token: 'tok' }); assert.equal(r.status, 200); assert.ok(r.setSession);
  assert.equal(await st.sessionUser(hashToken(r.setSession)), u.id);
  assert.equal((await call(st, 'login', 'POST', { token: 'tok' })).status, 401);
  assert.equal((await call(st, 'login', 'POST', {})).status, 401);
});

test('magic link: validates email, rate-limits, one-time, same user for same email, never leaks existence', async () => {
  const st = makeStore(); const sent = [];
  const deps = { sendMagic: async (e, t) => sent.push([e, t]) };
  assert.equal((await call(st, 'magic-request', 'POST', { email: 'nope' }, null, deps)).status, 400);
  const a = await call(st, 'magic-request', 'POST', { email: 'A@x.io' }, null, deps); assert.equal(a.json.sent, true);
  assert.equal(sent[0][0], 'a@x.io');
  const v = await call(st, 'magic-verify', 'POST', { token: sent[0][1] }); assert.equal(v.status, 200);
  assert.equal((await call(st, 'magic-verify', 'POST', { token: sent[0][1] })).status, 401);
  await call(st, 'magic-request', 'POST', { email: 'a@x.io' }, null, deps);
  const v2 = await call(st, 'magic-verify', 'POST', { token: sent[1][1] }); assert.equal(v2.json.userId, v.json.userId);
  await call(st, 'magic-request', 'POST', { email: 'a@x.io' }, null, deps); await call(st, 'magic-request', 'POST', { email: 'a@x.io' }, null, deps);
  assert.equal((await call(st, 'magic-request', 'POST', { email: 'a@x.io' }, null, deps)).status, 429);
  assert.equal((await call(st, 'magic-verify', 'POST', { token: 'garbage' })).status, 401);
});

test('cookie helpers: HttpOnly Secure SameSite, parse', () => {
  const h = cookieHeader('abc'); assert.match(h, /HttpOnly/); assert.match(h, /Secure/); assert.match(h, /SameSite=Lax/);
  assert.equal(readCookie('x=1; vow_sid=abc; y=2'), 'abc'); assert.equal(readCookie(undefined), null);
});

test('reminders: validation table', () => {
  const good = { title: 'Vitamin D', time: '08:00', days: [1, 2, 3] };
  assert.ok(cleanReminder(good).value);
  for (const [patch, err] of [[{ title: '' }, 'bad_title'], [{ title: 'x'.repeat(81) }, 'bad_title'], [{ time: '25:00' }, 'bad_time'], [{ time: '8:00' }, 'bad_time'], [{ days: [] }, 'bad_days'], [{ days: [0] }, 'bad_days'], [{ days: [8] }, 'bad_days'], [{ role: 'hacker' }, 'bad_role'], [{ channel: 'fax' }, 'bad_channel']]) {
    assert.equal(cleanReminder({ ...good, ...patch }).error, err, JSON.stringify(patch));
  }
  assert.deepEqual(cleanReminder({ days: [3, 1, 1] }, { partial: true }).value.days, [1, 3]);
});

test('reminders CRUD persists time/day/channel changes and is isolated per user', async () => {
  const st = makeStore(); const a = st.mkUser(); const b = st.mkUser();
  const c = await call(st, 'reminders', 'POST', { title: 'Omega-3', time: '08:00', days: [1, 2, 3, 4, 5, 6, 7] }, a.id); assert.equal(c.status, 200);
  const id = c.json.reminder.id;
  const u = await call(st, 'reminders', 'PATCH', { id, time: '21:30', days: [1, 3, 5], channel: 'slack' }, a.id);
  assert.equal(u.json.reminder.time, '21:30'); assert.deepEqual(u.json.reminder.days, [1, 3, 5]); assert.equal(u.json.reminder.channel, 'slack');
  assert.equal((await call(st, 'reminders', 'GET', {}, a.id)).json.reminders[0].time, '21:30');
  assert.equal((await call(st, 'reminders', 'PATCH', { id, time: '10:00' }, b.id)).status, 404);
  assert.equal((await call(st, 'reminders', 'DELETE', { id }, b.id)).status, 404);
  assert.equal((await call(st, 'reminders', 'GET', {}, b.id)).json.reminders.length, 0);
  assert.equal((await call(st, 'reminders', 'DELETE', { id }, a.id)).status, 200);
  assert.equal((await call(st, 'reminders', 'GET', {}, a.id)).json.reminders.length, 0);
  assert.equal((await call(st, 'reminders', 'POST', { title: 'x', time: '08:00', days: [1], role: 'study' }, a.id)).json.error, 'role_not_enabled');
});

test('prefs: tz/tone/quiet/ack/priority/roles validated and saved; default role follows enabled roles', async () => {
  const st = makeStore(); const u = st.mkUser();
  const r = await call(st, 'prefs', 'PATCH', { tz: 'Europe/Tallinn', tone: 'concise', quiet: { from: '22:00', to: '07:00' }, ackMin: 15, priority: ['slack', 'telegram'], roleLabel: 'always' }, u.id);
  assert.equal(r.status, 200); const p = r.json.profile;
  assert.equal(p.tz, 'Europe/Tallinn'); assert.equal(p.quiet_start, '22:00'); assert.equal(p.ack_min, 15); assert.deepEqual(p.channel_priority, ['slack', 'telegram']);
  for (const bad of [{ tz: 'Mars/Base' }, { tone: 'rude' }, { quiet: { from: '99:00', to: '07:00' } }, { ackMin: 0 }, { ackMin: 500 }, { priority: ['fax'] }, { priority: ['slack', 'slack'] }, { roles: [] }, { roles: ['wizard'] }, { roleLabel: 'x' }, { displayName: '' }]) {
    assert.equal((await call(st, 'prefs', 'PATCH', bad, u.id)).status, 400, JSON.stringify(bad));
  }
  const r2 = await call(st, 'prefs', 'PATCH', { roles: ['nutrition', 'study'] }, u.id); assert.equal(r2.json.profile.default_role, 'nutrition');
  assert.equal((await call(st, 'prefs', 'PATCH', { defaultRole: 'fitness' }, u.id)).json.error, 'default_role_not_enabled');
  assert.equal((await call(st, 'prefs', 'PATCH', { quiet: null }, u.id)).json.profile.quiet_start, null);
});

test('channels: unlink works, but the last login method cannot be removed unless an email is attached', async () => {
  const st = makeStore(); const u = st.mkUser();
  st._s.chans.push({ id: 'c1', userId: u.id, channel: 'telegram', enabled: true }, { id: 'c2', userId: u.id, channel: 'slack', enabled: true });
  assert.equal((await call(st, 'channels', 'DELETE', { id: 'zzz' }, u.id)).status, 404);
  assert.equal((await call(st, 'channels', 'DELETE', { id: 'c1' }, u.id)).status, 200);
  assert.equal((await call(st, 'channels', 'DELETE', { id: 'c2' }, u.id)).json.error, 'last_login_method');
  u.email = 'a@x.io';
  assert.equal((await call(st, 'channels', 'DELETE', { id: 'c2' }, u.id)).status, 200);
  assert.equal((await call(st, 'me', 'GET', {}, u.id)).status, 200); // still signed in: account anchored on email
});

test('link-code / link-status', async () => {
  const st = makeStore(); const u = st.mkUser();
  assert.equal((await call(st, 'link-code', 'POST', { channel: 'fax' }, u.id)).status, 400);
  const r = await call(st, 'link-code', 'POST', { channel: 'discord' }, u.id); assert.equal(r.json.code, 'ABCD2345');
  assert.equal((await call(st, 'link-status', 'GET', { channel: 'discord' }, u.id)).json.linked, false);
  st._s.chans.push({ id: 'c', userId: u.id, channel: 'discord', enabled: true });
  assert.equal((await call(st, 'link-status', 'GET', { channel: 'discord' }, u.id)).json.linked, true);
});

test('chat: real llm+memory path saves history, remembers, logs a memory entry; rejects empty/oversize', async () => {
  const st = makeStore(); const u = st.mkUser(); const mem = [];
  const deps = { llm: { complete: async ({ messages }) => ({ text: 'ok:' + messages.at(-1).content }) }, memory: { recall: async () => ['likes rowing'], remember: async (id, t) => { mem.push(t); return 'job1'; } } };
  const r = await call(st, 'chat', 'POST', { text: 'plan my week' }, u.id, deps);
  assert.equal(r.status, 200); assert.match(r.json.reply, /ok:plan my week/); assert.equal(r.json.remembered, 1); assert.equal(r.json.memoryJob, 'job1');
  assert.equal(st._s.msgs.length, 2); assert.equal(st._s.mem[0].jobId, 'job1'); assert.match(mem[0], /web\/fitness/);
  assert.equal((await call(st, 'chat', 'POST', { text: '   ' }, u.id, deps)).status, 400);
  assert.equal((await call(st, 'chat', 'POST', { text: 'x'.repeat(2001) }, u.id, deps)).status, 400);
  const h = await call(st, 'history', 'GET', {}, u.id); assert.equal(h.json.messages.length, 2); assert.equal(h.json.memory.length, 1);
});

test('export returns the user data; account delete requires confirmation and wipes everything', async () => {
  const st = makeStore(); const u = st.mkUser(); await call(st, 'reminders', 'POST', { title: 'a', time: '08:00', days: [1] }, u.id);
  assert.equal((await call(st, 'export', 'GET', {}, u.id)).json.data.reminders.length, 1);
  assert.equal((await call(st, 'account', 'DELETE', {}, u.id)).status, 400);
  const d = await call(st, 'account', 'DELETE', { confirm: 'DELETE' }, u.id); assert.equal(d.status, 200); assert.equal(d.clearSession, true);
  assert.equal(await st.getProfile(u.id), null); assert.equal((await call(st, 'me', 'GET', {}, u.id)).status, 401);
});

test('cleanPrefs ignores unknown keys (no mass assignment)', () => {
  assert.deepEqual(cleanPrefs({ isAdmin: true, email: 'x@y.z' }).value, {});
});

test('transcribe: auth, validation, success, failure', async () => {
  const { handleDash } = await import('./dash.mjs');
  const mk = (extra) => ({ store: { sessionUser: async () => 'u' }, op: 'transcribe', method: 'POST', userId: 'u', ...extra });
  assert.equal((await handleDash(mk({ body: {}, deps: {} }))).status, 400);
  assert.equal((await handleDash(mk({ body: { audio: 'QQ==' }, deps: {} }))).status, 501);
  assert.equal((await handleDash(mk({ body: { audio: 'QQ==' }, deps: { transcribe: async () => 'hello' } }))).json.text, 'hello');
  assert.equal((await handleDash(mk({ body: { audio: 'QQ==' }, deps: { transcribe: async () => { throw new Error('x'); } } }))).status, 502);
  assert.equal((await handleDash(mk({ userId: null, body: { audio: 'QQ==' }, deps: { transcribe: async () => 'x' } }))).status, 401);
});

test('memory-forget: hides own memory once, 404 for others/unknown, 401 anonymous', async () => {
  const st = makeStore();
  await st.logMemory('u1', { channel: 'telegram', preview: 'x' });
  assert.equal((await call(st, 'memory-forget', 'POST', { id: 'm0' }, 'u1', {})).json.forgotten, true);
  assert.equal((await call(st, 'memory-forget', 'POST', { id: 'm0' }, 'u1', {})).status, 404);
  await st.logMemory('u1', { channel: 'slack', preview: 'y' });
  assert.equal((await call(st, 'memory-forget', 'POST', { id: 'm1' }, 'u2', {})).status, 404);
  assert.equal((await call(st, 'memory-forget', 'POST', {}, 'u1', {})).status, 400);
  assert.equal((await call(st, 'memory-forget', 'POST', { id: 'm1' }, null, {})).status, 401);
});

test('email link: attach, conflict, daily limit, removal guard, admin rights follow the email', async () => {
  const { isAdmin } = await import('../admin/admin.mjs');
  const st = makeStore(); const u = st.mkUser(); const other = st.mkUser({ email: 'taken@x.io' });
  let sent = []; const deps = { sendMagic: async (e, t, purpose) => sent.push({ e, t, purpose }) };
  assert.equal((await call(st, 'email-add', 'POST', { email: 'bad' }, u.id, deps)).status, 400);
  assert.equal((await call(st, 'email-add', 'POST', { email: 'taken@x.io' }, u.id, deps)).json.error, 'email_in_use');
  assert.equal((await call(st, 'email-add', 'POST', { email: 'me@x.io' }, null, deps)).status, 401);
  assert.equal((await call(st, 'email-add', 'POST', { email: 'ME@x.io' }, u.id, deps)).status, 200);
  assert.equal(sent[0].purpose, 'link'); assert.equal(u.email, null, 'not attached before confirmation');
  const v = await call(st, 'magic-verify', 'POST', { token: sent[0].t }, null, deps);
  assert.equal(v.status, 200); assert.equal(v.json.userId, u.id); assert.equal(u.email, 'me@x.io');
  assert.equal((await call(st, 'magic-verify', 'POST', { token: sent[0].t }, null, deps)).status, 401, 'one use');
  assert.equal((await call(st, 'email-add', 'POST', { email: 'me@x.io' }, u.id, deps)).json.error, 'already_yours');
  const env = { ADMIN_EMAILS: 'me@x.io' };
  assert.equal(isAdmin(u, env), true);
  // no channel -> the email is the only login method -> cannot be removed
  assert.equal((await call(st, 'email', 'DELETE', {}, u.id, deps)).json.error, 'last_login_method');
  st.updateProfile; st._s.chans.push({ id: 'c1', userId: u.id, enabled: true });
  assert.equal((await call(st, 'email', 'DELETE', {}, u.id, deps)).status, 200);
  assert.equal(isAdmin(u, env), false, 'admin rights vanish with the email');
  assert.equal((await call(st, 'email', 'DELETE', {}, u.id, deps)).status, 404);
  // daily limit
  for (let i = 0; i < 4; i++) await call(st, 'email-add', 'POST', { email: `a${i}@x.io` }, u.id, deps);
  assert.equal((await call(st, 'email-add', 'POST', { email: 'z@x.io' }, u.id, deps)).status, 429);
  // link token whose email was taken meanwhile
  const st2 = makeStore(); const a = st2.mkUser(); const b = st2.mkUser(); const got = [];
  await call(st2, 'email-add', 'POST', { email: 'race@x.io' }, a.id, { sendMagic: async (e, t) => got.push(t) });
  b.email = 'race@x.io';
  assert.equal((await call(st2, 'magic-verify', 'POST', { token: got[0] }, null, {})).json.error, 'email_in_use');
});

test('merge: code from source, run by target; same account and bad code rejected', async () => {
  const st = makeStore(); const a = st.mkUser(), b = st.mkUser(); const codes = new Map(); const merged = [];
  st.createMergeCode = async (u) => { codes.set('M1', u); return { code: 'M1', ttlMinutes: 10 }; };
  st.consumeMergeCode = async (c) => { const u = codes.get(c); codes.delete(c); return u ?? null; };
  st.mergeAccounts = async (t, s) => { merged.push([t, s]); return { ok: true }; };
  assert.equal((await call(st, 'merge', 'POST', { code: 'nope' }, a.id)).status, 400);
  await call(st, 'merge-code', 'POST', {}, a.id);
  assert.equal((await call(st, 'merge', 'POST', { code: 'M1' }, a.id)).status, 400); // own code
  await call(st, 'merge-code', 'POST', {}, b.id);
  const r = await call(st, 'merge', 'POST', { code: 'M1' }, a.id);
  assert.equal(r.status, 200); assert.deepEqual(merged, [[a.id, b.id]]);
});
