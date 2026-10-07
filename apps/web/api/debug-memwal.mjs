import { debugRemember } from '../../../packages/core/memory/walrus-memory.mjs';
export default async function handler(req, res) {
  try {
    const r = await debugRemember(process.env, 'debug-user-3', 'debug probe direct ' + Date.now());
    return res.status(200).json({ ok: true, r });
  } catch (e) { return res.status(200).json({ ok: false, error: e.message, stack: e.stack?.split('\n').slice(0,6) }); }
}
