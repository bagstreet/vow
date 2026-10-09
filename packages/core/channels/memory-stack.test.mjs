import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Regression: channel stores lack listForgotten/listAliases/getSettings; buildMemory must fall back to the dashboard store.
test('memory stack falls back to the dashboard store for channel stores', () => {
  const src = readFileSync(new URL('../../../apps/web/lib/memory-stack.mjs', import.meta.url), 'utf8');
  assert.match(src, /channelStore\.listForgotten \? channelStore : createNeonDashStore/);
});
