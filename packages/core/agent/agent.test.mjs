import test from 'node:test'; import assert from 'node:assert/strict';
import { handleAgent, manageTokens, AGENT_LIMITS } from './agent.mjs';
import { hashToken } from '../dashboard/session.mjs';

function mk() {
  const s = { toks: [], writes: 0, mem: [] };
  const store = {
    listAgentTokens: async (u) => s.toks.filter((t) => t.user_id === u),
    createAgentToken: async (u, { hash, label, roles }) => { const t = { id: 't' + s.toks.length, user_id: u, token_hash: hash, label, roles, revoked_at: null }; s.toks.push(t); return t; },
    revokeAgentToken: async (u, id) => { const t = s.toks.find((x) => x.id === id && x.user_id === u && !x.revoked_at); if (!t) return false; t.revoked_at = 1; return true; },
    agentTokenByHash: async (h) => s.toks.find((t) => t.token_hash === h) ?? null,
    touchAgentToken: async () => {}, countAgentWrites: async () => s.writes,
  };
  const memory = { remember: async (u, t) => { s.mem.push(t); return 'job1'; }, recall: async () => ['[agent:coach][fitness] squat 100kg', '[telegram] private diet note', '[agent:x][study] exam on friday'] };
  return { s, store, memory };
}
const mint = async (store, roles = ['fitness']) => (await manageTokens({ store, method: 'POST', body: { label: 'coach', roles }, userId: 'u1' })).json.token;

test('token lifecycle: validation, one-time secret, hash stored, limit, revoke', async () => {
  const { s, store } = mk();
  assert.equal((await manageTokens({ store, method: 'POST', body: { roles: ['fitness'] }, userId: 'u1' })).status, 400);
  assert.equal((await manageTokens({ store, method: 'POST', body: { label: 'a', roles: ['hacker'] }, userId: 'u1' })).status, 400);
  assert.equal((await manageTokens({ store, method: 'POST', body: { label: 'a', roles: [] }, userId: 'u1' })).status, 400);
  const t = await mint(store);
  assert.match(t, /^vow_/); assert.equal(s.toks[0].token_hash, hashToken(t)); assert.notEqual(s.toks[0].token_hash, t);
  for (let i = 0; i < AGENT_LIMITS.tokensPerUser - 1; i++) await mint(store);
  assert.equal((await manageTokens({ store, method: 'POST', body: { label: 'z', roles: ['study'] }, userId: 'u1' })).status, 409);
  assert.equal((await manageTokens({ store, method: 'DELETE', body: { id: 't0' }, userId: 'u2' })).status, 404);
  assert.equal((await manageTokens({ store, method: 'DELETE', body: { id: 't0' }, userId: 'u1' })).status, 200);
});

test('agent auth: missing, malformed, unknown and revoked tokens are 401', async () => {
  const { store, memory } = mk(); const t = await mint(store);
  for (const bearer of [undefined, 'abc', 'vow_nope']) assert.equal((await handleAgent({ store, memory, action: 'me', method: 'GET', body: {}, bearer })).status, 401);
  assert.equal((await handleAgent({ store, memory, action: 'me', method: 'GET', body: {}, bearer: t })).json.roles[0], 'fitness');
  await manageTokens({ store, method: 'DELETE', body: { id: 't0' }, userId: 'u1' });
  assert.equal((await handleAgent({ store, memory, action: 'me', method: 'GET', body: {}, bearer: t })).status, 401);
});

test('remember: role scope, verified flag, size limits, rate limit, tagging', async () => {
  const { s, store, memory } = mk(); const t = await mint(store);
  const rem = (body) => handleAgent({ store, memory, action: 'remember', method: 'POST', body, bearer: t });
  assert.equal((await rem({ role: 'medication', text: 'takes 5mg of x daily', verified: true })).status, 403);
  assert.equal((await rem({ role: 'fitness', text: 'squat 100kg for 5 reps' })).json.error, 'verified_required');
  assert.equal((await rem({ role: 'fitness', text: 'short', verified: true })).json.error, 'text_too_short');
  assert.equal((await rem({ role: 'fitness', text: 'x'.repeat(601), verified: true })).json.error, 'text_too_long');
  const r = await rem({ role: 'fitness', text: 'squat 100kg\nfor 5 reps', verified: true });
  assert.equal(r.status, 201); assert.equal(s.mem[0], '[agent:coach][fitness] squat 100kg for 5 reps');
  s.writes = AGENT_LIMITS.writesPerHour;
  assert.equal((await rem({ role: 'fitness', text: 'squat 100kg for 5 reps', verified: true })).status, 429);
});

test('recall returns only snippets of allowed roles (no leaking untagged chat memory)', async () => {
  const { store, memory } = mk(); const t = await mint(store, ['fitness']);
  const r = await handleAgent({ store, memory, action: 'recall', method: 'GET', body: { q: 'squat' }, bearer: t });
  assert.deepEqual(r.json.results, ['[agent:coach][fitness] squat 100kg']);
  assert.equal((await handleAgent({ store, memory, action: 'recall', method: 'GET', body: {}, bearer: t })).status, 400);
  assert.equal((await handleAgent({ store, memory, action: 'nope', method: 'GET', body: {}, bearer: t })).status, 404);
});
