import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const dir = new URL('../apps/extension/', import.meta.url);
test('extension manifest is valid MV3, references existing files and asks for no broad permissions', () => {
  const m = JSON.parse(readFileSync(new URL('manifest.json', dir), 'utf8'));
  assert.equal(m.manifest_version, 3);
  for (const f of [m.background.service_worker, m.action.default_popup, ...Object.values(m.icons)]) assert.ok(existsSync(new URL(f, dir)), f);
  assert.deepEqual([...m.permissions].sort(), ['alarms', 'notifications', 'storage']);
  assert.ok(!m.permissions.includes('tabs') && !m.permissions.includes('contextMenus'));
});

test('mute presets', async () => {
  globalThis.chrome = { storage: { local: {} } };
  const { muteUntil, isMuted } = await import('../apps/extension/lib.js');
  const now = new Date('2026-10-09T10:00:00');
  assert.equal(muteUntil('hour', now) - now.getTime(), 3600_000);
  assert.equal(new Date(muteUntil('tomorrow', now)).getHours(), 7);
  assert.ok(isMuted('off') && isMuted(Date.now() + 1000) && !isMuted(0) && !isMuted(Date.now() - 1));
});
