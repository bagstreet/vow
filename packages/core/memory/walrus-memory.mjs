// Real, long-term, cross-channel memory on Walrus Mainnet (via MemWal), independent from the
// Companion/ledger code path (packages/core/companion.mjs), which needs client.completeLedger()
// — a method the production adapter (memwal.mjs's adaptMemWal) never implements, so Companion
// cannot run against the live relayer today. This module talks to a MemWal SDK client directly:
//
// - remember(): submits text to the relayer and returns as soon as the job is ACCEPTED (~1-3s).
//   It deliberately does NOT await full completion (embed + Seal-encrypt + Walrus upload + Sui tx,
//   ~15-20s measured against the live mainnet relayer) — the relayer finishes that job on its own
//   infrastructure even after this serverless invocation returns its HTTP response. Blocking a chat
//   reply on 15-20s would risk function timeouts for no user-visible benefit.
// - recall(): read-only semantic search, awaited inline so replies can use real memory (fast, no job).
//
// One namespace per app user (`vow:mem:<userId>`), spanning every channel (telegram/discord/slack/web) —
// by design the same person is one memory no matter which channel they write from.
//
// The actual `@mysten-incubation/memwal` SDK client is constructed by the caller (see
// apps/web/api/telegram.mjs / discord.mjs) and injected here, deliberately NOT imported from this file:
// this module lives under packages/core/, outside the Vercel project root (apps/web), and Node's module
// resolution never looks sideways into apps/web/node_modules from there — only ancestors of the importing
// file are searched. A dynamic import('@mysten-incubation/memwal') here resolved fine locally (repo-root
// node_modules) but silently returned nothing in the deployed function (verified 2026-10-07). Constructing
// the SDK inside apps/web/api/*.mjs, which IS under the project root, sidesteps the resolution gap entirely
// and keeps this module dependency-injected/offline-testable like the rest of the codebase (store/tg/llm).
const ns = (userId) => `vow:mem:${userId}`;

export function createWalrusMemory(sdk) {
  return {
    /** Submit-only: returns a job_id string once the relayer accepts the write, or null (never throws). */
    async remember(userId, text) {
      if (!sdk) return null;
      try {
        const job = await sdk.remember(String(text).slice(0, 2000), ns(userId));
        return job?.job_id ?? null;
      } catch (e) {
        console.error('memwal remember failed', e.message);
        return null;
      }
    },
    /** Read-only semantic recall. Returns plain text snippets; [] on any failure. */
    async recall(userId, query, { limit = 4 } = {}) {
      if (!sdk) return [];
      try {
        const r = await sdk.recall({ query, namespace: ns(userId), limit });
        return (r?.results ?? []).map((x) => x.text).filter(Boolean);
      } catch (e) {
        console.error('memwal recall failed', e.message);
        return [];
      }
    },
  };
}
