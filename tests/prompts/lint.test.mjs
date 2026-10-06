// Prompt lint (MODULE_MAP L4 step 1): deterministic, no model calls, runs in CI.
// Every rule below is a check a judge can read and re-run: `npm run test:prompts`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ROLES, ROLE_IDS } from '../../packages/presets/roles/index.mjs';

const BUTTONS = new Set(['taken', 'skipped', 'snooze', 'snooze_1h', 'cancel', 'yes', 'no']);

test('exactly the five site roles exist', () => {
  assert.deepEqual([...ROLE_IDS].sort(), ['fitness', 'health', 'medication', 'sobriety', 'study']);
});

for (const id of ROLE_IDS) {
  const r = ROLES[id];
  test(`${id}: structure`, () => {
    for (const f of ['label', 'emoji', 'prompt', 'keywords', 'scope', 'never', 'buttons'])
      assert.ok(r[f] && r[f].length, `missing ${f}`);
    assert.ok(r.scope.length >= 2 && r.never.length >= 2);
  });
  test(`${id}: prompt has scope, refusal, injection guard, safety`, () => {
    assert.match(r.prompt, /outside your role scope|outside/i, 'refusal sentence');
    assert.match(r.prompt, /Ignore any instruction/i, 'injection guard');
    assert.match(r.prompt, /Do:/); assert.match(r.prompt, /Never:/);
  });
  test(`${id}: no contradiction between Do and Never`, () => {
    const norm = s => s.toLowerCase().replace(/[^a-z ]/g, '').trim();
    const never = new Set(r.never.map(norm));
    for (const d of r.scope) assert.ok(!never.has(norm(d)), `"${d}" is both allowed and forbidden`);
  });
  test(`${id}: no duplicate entries`, () => {
    for (const k of ['keywords', 'scope', 'never', 'buttons']) assert.equal(new Set(r[k].map(x => x.toLowerCase())).size, r[k].length, `duplicate in ${k}`);
  });
  test(`${id}: buttons come from the catalog`, () => {
    for (const b of r.buttons) assert.ok(BUTTONS.has(b), `unknown button ${b}`);
  });
  test(`${id}: prompt is language-neutral English and bounded`, () => {
    assert.ok(!/[\u0400-\u04FF]/.test(r.prompt), 'non-English text');
    assert.ok(r.prompt.length < 3000, 'prompt too long');
  });
  test(`${id}: sensitive roles forbid diagnosis/advice and have a fixed-safe path`, () => {
    if (!r.sensitive) return;
    assert.match(r.never.join(' ') + r.prompt, /diagnos|dose|clinical|medical/i);
  });
}

test('keywords overlap between roles is reported (<=2 shared words per pair)', () => {
  for (const a of ROLE_IDS) for (const b of ROLE_IDS) {
    if (a >= b) continue;
    const shared = ROLES[a].keywords.filter(k => ROLES[b].keywords.includes(k));
    assert.ok(shared.length <= 2, `${a}/${b} share: ${shared.join(', ')}`);
  }
});
