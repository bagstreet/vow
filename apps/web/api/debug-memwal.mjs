export default async function handler(req, res) {
  try {
    const mod = await import('@mysten-incubation/memwal');
    return res.status(200).json({ ok: true, hasMemWal: typeof mod.MemWal === 'function' });
  } catch (e) {
    return res.status(200).json({ ok: false, error: e.message, stack: e.stack?.split('\n').slice(0,5) });
  }
}
