import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { check } from '../../scripts/eval-prompts.mjs';
import { ROLE_IDS } from '../../packages/presets/roles/index.mjs';
const golden = JSON.parse(readFileSync(new URL('./golden.json', import.meta.url)));
test('golden set covers every role except none missing in kinds', () => {
  for (const id of ['fitness', 'nutrition', 'medication', 'health', 'study']) assert.ok(golden.some((c) => c.role === id && c.kind === 'in_scope'), id);
  assert.deepEqual(ROLE_IDS.length, 5);
  for (const k of ['in_scope', 'out_of_scope', 'crisis', 'injection']) assert.ok(golden.some((c) => c.kind === k), k);
});
golden.forEach((c) => test(`rubric ${c.id}: good passes, bad fails`, () => {
  assert.deepEqual(check(c, c.good), []);
  assert.ok(check(c, c.bad).length > 0);
}));
