export default async function handler(req, res) {
  try {
    const { MemWal } = await import('@mysten-incubation/memwal');
    try {
      const sdk = MemWal.create({
        key: process.env.MEMWAL_PRIVATE_KEY,
        accountId: process.env.MEMWAL_ACCOUNT_ID,
        serverUrl: process.env.MEMWAL_SERVER_URL || undefined,
        requestTimeoutMs: 20000,
      });
      return res.status(200).json({ ok: true, created: true, type: typeof sdk });
    } catch (e) {
      return res.status(200).json({ ok: false, step: 'create', error: e.message, stack: e.stack?.split('\n').slice(0,8) });
    }
  } catch (e) {
    return res.status(200).json({ ok: false, step: 'import', error: e.message });
  }
}
