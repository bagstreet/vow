import test from 'node:test'; import assert from 'node:assert/strict';
import { handleGuardian, notifyBeforeDelete, breach, evaluateGuardians, deliverNotices, MAX_GUARDIANS, MAX_WATCHED } from './guardian.mjs';
import { handleDash } from '../dashboard/dash.mjs';

function mk() {
  const s = { users: new Map(), links: [], notices: [], n: 0, stats: {} };
  const user = (name) => { const id = 'u' + ++s.n; s.users.set(id, { id, display_name: name, roles: ['fitness'], default_role: 'fitness', tz: 'UTC', tone: 'friendly', role_label: 'off' }); return id; };
  const store = {
    getProfile: async (id) => s.users.get(id) ?? null,
    countGuardiansOf: async (u) => s.links.filter((l) => l.watchedUserId === u).length,
    countWatchedBy: async (u) => s.links.filter((l) => l.guardianUserId === u && l.status === 'active').length,
    createGuardianInvite: async (u) => { const code = 'CODE' + ++s.n; s.links.push({ id: 'l' + s.n, watchedUserId: u, guardianUserId: null, status: 'pending', code, missedCheckins: 2, silenceHours: 24, lastAlertAt: null }); return { code, ttlMinutes: 10 }; },
    findGuardianInvite: async (c) => { const l = s.links.find((x) => x.code === c && x.status === 'pending'); return l ? { id: l.id, watchedUserId: l.watchedUserId } : null; },
    guardianPairExists: async (w, g) => s.links.some((l) => l.watchedUserId === w && l.guardianUserId === g),
    activateGuardian: async (id, g) => { const l = s.links.find((x) => x.id === id); Object.assign(l, { guardianUserId: g, status: 'active', code: null }); },
    getGuardianLink: async (id) => s.links.find((l) => l.id === id) ?? null,
    setGuardianRules: async (id, r) => Object.assign(s.links.find((l) => l.id === id), r),
    deleteGuardianLink: async (id) => { s.links = s.links.filter((l) => l.id !== id); },
    guardianLinksOf: async (u) => s.links.filter((l) => l.watchedUserId === u || l.guardianUserId === u),
    addNotice: async (u, text) => { s.notices.push({ id: 'n' + s.notices.length, userId: u, text }); },
    activeGuardianLinks: async () => s.links.filter((l) => l.status === 'active'),
    guardianStats: async (u) => s.stats[u],
    markGuardianAlert: async (id, prev, now) => { const l = s.links.find((x) => x.id === id); if (l.lastAlertAt !== prev) return false; l.lastAlertAt = now; return true; },
    deleteAccount: async (id) => { s.users.delete(id); s.links = s.links.filter((l) => l.watchedUserId !== id && l.guardianUserId !== id); },
  };
  return { s, store, user };
}
const call = (store, op, method, body, userId) => handleGuardian({ store, op, method, body, userId });
async function pair(m) { const w = m.user('Anna'), g = m.user('Boris'); const inv = (await call(m.store, 'guardian-invite', 'POST', {}, w)).json; await call(m.store, 'guardian-accept', 'POST', { code: inv.code }, g); return { w, g, id: m.s.links[0].id }; }

test('invite and accept activate the link and tell the watched user', async () => {
  const m = mk(); const { w, g } = await pair(m);
  assert.equal(m.s.links[0].status, 'active'); assert.equal(m.s.links[0].guardianUserId, g);
  assert.match(m.s.notices.at(-1).text, /Boris accepted/); assert.equal(m.s.notices.at(-1).userId, w);
});
test('self-link, bad code, duplicate pair and limits are rejected', async () => {
  const m = mk(); const w = m.user('A'); const inv = (await call(m.store, 'guardian-invite', 'POST', {}, w)).json;
  assert.equal((await call(m.store, 'guardian-accept', 'POST', { code: inv.code }, w)).json.error, 'self_link');
  assert.equal((await call(m.store, 'guardian-accept', 'POST', { code: 'NOPE' }, m.user('B'))).json.error, 'invalid_or_expired_code');
  const g = m.user('G'); await call(m.store, 'guardian-accept', 'POST', { code: inv.code }, g);
  const inv2 = (await call(m.store, 'guardian-invite', 'POST', {}, w)).json;
  assert.equal((await call(m.store, 'guardian-accept', 'POST', { code: inv2.code }, g)).json.error, 'already_linked');
  const m2 = mk(); const w2 = m2.user('W'); for (let i = 0; i < MAX_GUARDIANS; i++) await call(m2.store, 'guardian-invite', 'POST', {}, w2);
  assert.equal((await call(m2.store, 'guardian-invite', 'POST', {}, w2)).json.error, 'guardian_limit');
  const m3 = mk(); const g3 = m3.user('G'); for (let i = 0; i < MAX_WATCHED; i++) { const x = m3.user('w' + i); const c = (await call(m3.store, 'guardian-invite', 'POST', {}, x)).json.code; await call(m3.store, 'guardian-accept', 'POST', { code: c }, g3); }
  const x = m3.user('extra'); const c = (await call(m3.store, 'guardian-invite', 'POST', {}, x)).json.code;
  assert.equal((await call(m3.store, 'guardian-accept', 'POST', { code: c }, g3)).json.error, 'watch_limit');
});
test('only the guardian sets rules; values are validated; watched user is told', async () => {
  const m = mk(); const { w, g, id } = await pair(m);
  assert.equal((await call(m.store, 'guardian-rules', 'PATCH', { id, missedCheckins: 3 }, w)).status, 404);
  assert.equal((await call(m.store, 'guardian-rules', 'PATCH', { id, missedCheckins: 0 }, g)).json.error, 'bad_missed');
  assert.equal((await call(m.store, 'guardian-rules', 'PATCH', { id, silenceHours: 9999 }, g)).json.error, 'bad_silence');
  assert.equal((await call(m.store, 'guardian-rules', 'PATCH', { id, missedCheckins: 3, silenceHours: 48 }, g)).status, 200);
  assert.deepEqual([m.s.links[0].missedCheckins, m.s.links[0].silenceHours], [3, 48]); assert.match(m.s.notices.at(-1).text, /3 missed/);
});
test('either side can leave; the other side is notified; strangers cannot', async () => {
  let m = mk(); let p = await pair(m);
  assert.equal((await call(m.store, 'guardian-revoke', 'DELETE', { id: p.id }, m.user('X'))).status, 404);
  await call(m.store, 'guardian-revoke', 'DELETE', { id: p.id }, p.g);
  assert.equal(m.s.links.length, 0); assert.equal(m.s.notices.at(-1).userId, p.w); assert.match(m.s.notices.at(-1).text, /stopped being/);
  m = mk(); p = await pair(m); await call(m.store, 'guardian-revoke', 'DELETE', { id: p.id }, p.w);
  assert.equal(m.s.notices.at(-1).userId, p.g); assert.match(m.s.notices.at(-1).text, /removed you/);
});
test('N18 guardian account deleted: all links drop, each watched user is notified', async () => {
  const m = mk(); const g = m.user('Boris');
  const ws = [m.user('A'), m.user('B')];
  for (const w of ws) { const c = (await call(m.store, 'guardian-invite', 'POST', {}, w)).json.code; await call(m.store, 'guardian-accept', 'POST', { code: c }, g); }
  m.s.users.get(g).roles = ['fitness'];
  const r = await handleDash({ store: m.store, op: 'account', method: 'DELETE', body: { confirm: 'DELETE' }, userId: g, deps: { env: {} } });
  assert.equal(r.status, 200); assert.equal(m.s.links.length, 0);
  const told = m.s.notices.filter((n) => /deleted their account/.test(n.text)).map((n) => n.userId).sort();
  assert.deepEqual(told, ws.sort());
});
test('N19 watched user deleted: guardian is told; N21 mutual deletion leaves no orphans', async () => {
  const m = mk(); const { w, g } = await pair(m);
  await notifyBeforeDelete(m.store, w); await m.store.deleteAccount(w);
  assert.equal(m.s.notices.at(-1).userId, g); assert.match(m.s.notices.at(-1).text, /no longer watch/);
  const m2 = mk(); const p = await pair(m2); await call(m2.store, 'guardian-invite', 'POST', {}, p.g); const c = m2.s.links.at(-1).code; await call(m2.store, 'guardian-accept', 'POST', { code: c }, p.w); // A<->B
  assert.equal(m2.s.links.filter((l) => l.status === 'active').length, 2);
  await Promise.all([notifyBeforeDelete(m2.store, p.w), notifyBeforeDelete(m2.store, p.g)]); await Promise.all([m2.store.deleteAccount(p.w), m2.store.deleteAccount(p.g)]);
  assert.equal(m2.s.links.length, 0);
});
test('breach rules: missed in a row, silence, cooldown, no false positives', () => {
  const link = { missedCheckins: 2, silenceHours: 24, lastAlertAt: null }; const now = 1e12; const H = 3600000;
  assert.match(breach(link, { name: 'Anna', missedInRow: 2, lastSentAt: now, lastInboundAt: now }, now), /missed 2/);
  assert.equal(breach(link, { name: 'Anna', missedInRow: 1, lastSentAt: now, lastInboundAt: now }, now), null);
  assert.match(breach(link, { name: 'Anna', missedInRow: 0, lastSentAt: now - 30 * H, lastInboundAt: now - 40 * H }, now), /24 h/);
  assert.equal(breach(link, { name: 'Anna', missedInRow: 0, lastSentAt: now - 30 * H, lastInboundAt: now - 29 * H }, now), null); // replied after the last message
  assert.equal(breach(link, { name: 'Anna', missedInRow: 0, lastSentAt: null, lastInboundAt: null }, now), null); // never messaged: nothing to miss
  assert.equal(breach({ ...link, lastAlertAt: now - H }, { name: 'Anna', missedInRow: 5 }, now), null); // cooldown
});
test('N20 evaluateGuardians alerts once per breach and the notice goes to the guardian only', async () => {
  const m = mk(); const { w, g } = await pair(m); m.s.stats[w] = { name: 'Anna', missedInRow: 3, lastSentAt: 1, lastInboundAt: null };
  assert.equal(await evaluateGuardians({ store: m.store, now: 1e12 }), 1);
  assert.equal(await evaluateGuardians({ store: m.store, now: 1e12 + 60000 }), 0);
  const a = m.s.notices.at(-1); assert.equal(a.userId, g); assert.doesNotMatch(a.text, /fitness|memory/i);
});
test('deliverNotices uses the most recently seen channel; undeliverable notices are not retried forever', async () => {
  const sent = []; let done = [];
  const store = { claimNotices: async () => [{ id: 1, userId: 'u', text: 'hi' }, { id: 2, userId: 'x', text: 'yo' }], channelsFor: async (u) => u === 'u' ? [{ channel: 'telegram', externalId: 't', lastSeenAt: 1 }, { channel: 'discord', externalId: 'd', lastSeenAt: 5 }] : [], finishNotice: async (id, ok) => done.push([id, ok]) };
  const n = await deliverNotices({ store, senders: { telegram: async (x) => sent.push(['tg', x.externalId]), discord: async (x) => sent.push(['dc', x.externalId]) } });
  assert.equal(n, 1); assert.deepEqual(sent, [['dc', 'd']]); assert.deepEqual(done, [[1, true], [2, false]]);
});
