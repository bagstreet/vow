// Real, long-term, cross-channel memory on Walrus Mainnet (via MemWal), independent from the
// Companion/ledger code path (packages/core/companion.mjs), which needs client.completeLedger()
// — a method the production adapter (memwal.mjs's adaptMemWal) never implements, so Companion
// cannot run against the live relayer today. This module talks to the MemWal SDK directly instead:
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
let sdkPromise = null;

async function getSdk(env) {
  if (!env.MEMWAL_PRIVATE_KEY || !env.MEMWAL_ACCOUNT_ID) return null;
  if (!sdkPromise) {
    sdkPromise = import('@mysten-incubation/memwal')
      .then(({ MemWal }) =>
        MemWal.create({
          key: env.MEMWAL_PRIVATE_KEY,
          accountId: env.MEMWAL_ACCOUNT_ID,
          serverUrl: env.MEMWAL_SERVER_URL || undefined,
          requestTimeoutMs: 20000,
        }),
      )
      .catch((e) => {
        console.error('memwal sdk init failed', e.message);
        sdkPromise = null;
        return null;
      });
  }
  return sdkPromise;
}

const ns = (userId) => `vow:mem:${userId}`;

export function createWalrusMemory(env = process.env) {
  return {
    /** Submit-only: returns a job_id string once the relayer accepts the write, or null (never throws). */
    async remember(userId, text) {
      try {
        const sdk = await getSdk(env);
        if (!sdk) return null;
        const job = await sdk.remember(String(text).slice(0, 2000), ns(userId));
        return job?.job_id ?? null;
      } catch (e) {
        console.error('memwal remember failed', e.message);
        return null;
      }
    },
    /** Read-only semantic recall. Returns plain text snippets, oldest concerns first; [] on any failure. */
    async recall(userId, query, { limit = 4 } = {}) {
      try {
        const sdk = await getSdk(env);
        if (!sdk) return [];
        const r = await sdk.recall({ query, namespace: ns(userId), limit });
        return (r?.results ?? []).map((x) => x.text).filter(Boolean);
      } catch (e) {
        console.error('memwal recall failed', e.message);
        return [];
      }
    },
  };
}
