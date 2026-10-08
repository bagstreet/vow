// Memory write modes (admin setting). `instant`: every remember() becomes a Walrus blob (default).
// `digest`: texts are buffered per user and written as ONE blob once the oldest entry is older than digest_hours,
// or immediately via flush() ("remember now"). Fewer, denser blobs = less on-chain noise and gas.
import { SETTING_DEFAULTS } from '../admin/admin.mjs';

export function withWriteMode(memory, { getSettings, buffer }) {
  const cfg = async () => ({ ...SETTING_DEFAULTS, ...((await getSettings?.()) ?? {}) });
  async function flush(userId) {
    const rows = await buffer.take(userId); if (!rows.length) return null;
    const text = `[digest ${rows.length}] ` + rows.map((r) => r.text).join(' | ').slice(0, 1800);
    return memory.remember(userId, text);
  }
  return {
    ...memory,
    flush,
    async remember(userId, text, opts) {
      const c = await cfg();
      if (c.memory_write_mode !== 'digest' || opts?.force) { const pending = await buffer.count(userId); if (pending) { await buffer.add(userId, text); return flush(userId); } return memory.remember(userId, text, opts); }
      await buffer.add(userId, text);
      const oldest = await buffer.oldestAgeHours(userId);
      return oldest >= c.digest_hours ? flush(userId) : { buffered: true };
    },
    async flushAll() { let n = 0; for (const u of await buffer.usersDue(0)) { if (await flush(u)) n++; } return n; },
    async flushDue() {
      const c = await cfg(); if (c.memory_write_mode !== 'digest') return 0;
      let n = 0; for (const u of await buffer.usersDue(c.digest_hours)) { if (await flush(u)) n++; } return n;
    },
  };
}
