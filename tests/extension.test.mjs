import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const dir = new URL('../apps/extension/', import.meta.url);
test('extension manifest is valid MV3 and references existing files', () => {
  const m = JSON.parse(readFileSync(new URL('manifest.json', dir), 'utf8'));
  assert.equal(m.manifest_version, 3);
  for (const f of [m.background.service_worker, m.action.default_popup, ...Object.values(m.icons)]) assert.ok(existsSync(new URL(f, dir)), f);
  assert.ok(!m.permissions.includes('tabs'));
});
