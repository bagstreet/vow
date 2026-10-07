import { createWalrusMemory } from '../../../packages/core/memory/walrus-memory.mjs';
export default async function handler(req, res) {
  const mem = createWalrusMemory();
  const out = {};
  try {
    const jobId = await mem.remember('debug-user-2', 'debug probe module ' + Date.now());
    out.remember = { jobId };
  } catch (e) { out.remember = { error: e.message }; }
  return res.status(200).json(out);
}
