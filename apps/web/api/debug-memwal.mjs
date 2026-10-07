import { createWalrusMemory } from '../../../packages/core/memory/walrus-memory.mjs';
export default async function handler(req, res) {
  const mem = createWalrusMemory();
  const out = { env: { hasKey: !!process.env.MEMWAL_PRIVATE_KEY, hasAccount: !!process.env.MEMWAL_ACCOUNT_ID, hasUrl: !!process.env.MEMWAL_SERVER_URL } };
  try {
    const jobId = await mem.remember('debug-user-1', 'debug probe ' + Date.now());
    out.remember = { jobId };
  } catch (e) { out.remember = { error: e.message }; }
  try {
    const r = await mem.recall('debug-user-1', 'debug probe');
    out.recall = r;
  } catch (e) { out.recall = { error: e.message }; }
  return res.status(200).json(out);
}
