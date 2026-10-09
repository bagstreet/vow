// One place that builds the memory stack: Walrus -> forget filter -> memory log -> admin write mode (instant | digest).
import { createWalrusMemory, withMemoryLog, withForgetFilter, withAliasRecall } from '../../../packages/core/memory/walrus-memory.mjs';
import { withWriteMode } from '../../../packages/core/memory/write-mode.mjs';
import { createSql } from '../../../packages/db/neon.mjs';
import { createNeonDashStore } from '../../../packages/core/dashboard/neon-dash-store.mjs';
import { buildMemwalSdk } from './walrus-memory-client.mjs';

export function buildMemory(channelStore, channel) {
  // Channel stores (Telegram, Slack, Discord) do not carry memory bookkeeping; the dashboard store does.
  const store = channelStore.listForgotten ? channelStore : createNeonDashStore(createSql());
  const base = withMemoryLog(withAliasRecall(withForgetFilter(createWalrusMemory(buildMemwalSdk()), (u) => store.listForgotten(u)), (u) => store.listAliases?.(u) ?? []), (u, r) => store.logMemory(u, r), channel);
  return store.memoryBuffer ? withWriteMode(base, { getSettings: () => store.getSettings(), buffer: store.memoryBuffer }) : base;
}
