// Constructs the real MemWal SDK client. Lives under apps/web (the Vercel project root) so the
// `@mysten-incubation/memwal` dependency (declared in apps/web/package.json) actually resolves in the
// deployed function — see packages/core/memory/walrus-memory.mjs for why this can't live there instead.
import { MemWal } from '@mysten-incubation/memwal';

export function buildMemwalSdk(env = process.env) {
  if (!env.MEMWAL_PRIVATE_KEY || !env.MEMWAL_ACCOUNT_ID) return null;
  try {
    return MemWal.create({
      key: env.MEMWAL_PRIVATE_KEY,
      accountId: env.MEMWAL_ACCOUNT_ID,
      serverUrl: env.MEMWAL_SERVER_URL || undefined,
      requestTimeoutMs: 20000,
    });
  } catch (e) {
    console.error('memwal sdk init failed', e.message);
    return null;
  }
}
