import test from 'node:test';
import assert from 'node:assert/strict';
import { VowAgent, VowAgentError } from './index.mjs';

const mk = (status, json, seen = []) => async (url, init) => { seen.push({ url, init }); return { ok: status < 400, status, json: async () => json }; };

test('requires token', () => assert.throws(() => new VowAgent({})));
test('whoami sends bearer GET', async () => {
  const seen = []; const v = new VowAgent({ token: 't', baseUrl: 'http://x/', fetch: mk(200, { ok: true }, seen) });
  await v.whoami();
  assert.equal(seen[0].url, 'http://x/api/agent?action=me');
  assert.equal(seen[0].init.headers.Authorization, 'Bearer t');
});
test('remember posts body', async () => {
  const seen = []; const v = new VowAgent({ token: 't', fetch: mk(200, { ok: true }, seen) });
  await v.remember('fitness', 'Ran 5 km today');
  assert.deepEqual(JSON.parse(seen[0].init.body), { role: 'fitness', text: 'Ran 5 km today', verified: true });
});
test('recall encodes query', async () => {
  const seen = []; const v = new VowAgent({ token: 't', fetch: mk(200, { hits: [] }, seen) });
  await v.recall('a b');
  assert.match(seen[0].url, /action=recall&q=a\+b/);
});
test('errors throw VowAgentError', async () => {
  const v = new VowAgent({ token: 't', fetch: mk(403, { error: 'role_not_allowed' }) });
  await assert.rejects(() => v.remember('x', 'some text here'), (e) => e instanceof VowAgentError && e.status === 403);
});
