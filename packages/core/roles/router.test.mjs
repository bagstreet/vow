import test from 'node:test';
import assert from 'node:assert/strict';

test('supplements route to nutrition, medicines to medication', async () => {
  const { route } = await import('./router.mjs');
  const en = { enabled: ['medication', 'nutrition'] };
  assert.equal(route('remind me to take magnesium tablet at 9', en).primary, 'nutrition');
  assert.equal(route('take my vitamin D pill daily', en).primary, 'nutrition');
  assert.equal(route('take my antibiotic pill at 8', en).primary, 'medication');
  assert.equal(route('refill my prescription', en).primary, 'medication');
});
