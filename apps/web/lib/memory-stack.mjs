// One place that builds the memory stack: Walrus -> forget filter -> memory log -> admin write mode (instant | digest).
import { createWalrusMemory, withMemoryLog, withForgetFilter, withAliasRecall } from '../../../packages/core/memory/walrus-memory.mjs';
import { withWriteMode } from '../../../packages/core/memory/write-mode.mjs';
import { buildMemwalSdk } from './walrus-memory-client.mjs';

export function buildMemory(store, channel) {
  const base = withMemoryLog(withAliasRecall(withForgetFilter(createWalrusMemory(buildMemwalSdk()), (u) => store.listForgotten(u)), (u) => store.listAliases?.(u) ?? []), (u, r) => store.logMemory(u, r), channel);
  return store.memoryBuffer ? withWriteMode(base, { getSettings: () => store.getSettings(), buffer: store.memoryBuffer }) : base;
}
