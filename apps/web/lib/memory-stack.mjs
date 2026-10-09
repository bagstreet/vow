// One place that builds the memory stack: Walrus -> forget filter -> memory log -> admin write mode (instant | digest).
import { createWalrusMemory, withMemoryLog, withForgetFilter, withAliasRecall } from '../../../packages/core/memory/walrus-memory.mjs';
import { withWriteMode } from '../../../packages/core/memory/write-mode.mjs';
import { createSql } from '../../../packages/db/neon.mjs';
import { createNeonDashStore } from '../../../packages/core/dashboard/neon-dash-store.mjs';
import { createHash } from 'node:crypto';
import { buildMemwalSdk } from './walrus-memory-client.mjs';

// Atomic claim: insert, or take over the row only when it is older than the dedupe window. Zero rows back = a twin write is in flight.
const claimWrite = (sql) => async (userId, text) => (await sql("insert into memory_dedupe(user_id, h, at) values ($1,$2,now()) on conflict (user_id, h) do update set at = now() where memory_dedupe.at < now() - interval '5 seconds' returning h", [userId, createHash('sha256').update(text).digest('hex').slice(0, 32)])).length > 0;

export function buildMemory(channelStore, channel) {
  // Channel stores (Telegram, Slack, Discord) do not carry memory bookkeeping; the dashboard store does.
  const store = channelStore.listForgotten ? channelStore : createNeonDashStore(createSql());
  const base = withMemoryLog(withAliasRecall(withForgetFilter(createWalrusMemory(buildMemwalSdk(), { claim: claimWrite(createSql()) }), (u) => store.listForgotten(u)), (u) => store.listAliases?.(u) ?? []), (u, r) => store.logMemory(u, r), channel);
  return store.memoryBuffer ? withWriteMode(base, { getSettings: () => store.getSettings(), buffer: store.memoryBuffer }) : base;
}
