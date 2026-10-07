export default async function handler(req, res) {
  const out = { env: { hasKey: !!process.env.MEMWAL_PRIVATE_KEY, hasAccount: !!process.env.MEMWAL_ACCOUNT_ID, hasUrl: !!process.env.MEMWAL_SERVER_URL, url: process.env.MEMWAL_SERVER_URL } };
  try {
    const { MemWal } = await import('@mysten-incubation/memwal');
    const sdk = MemWal.create({ key: process.env.MEMWAL_PRIVATE_KEY, accountId: process.env.MEMWAL_ACCOUNT_ID, serverUrl: process.env.MEMWAL_SERVER_URL, requestTimeoutMs: 20000 });
    out.sdkCreated = true;
    try {
      const job = await sdk.remember('debug probe ' + Date.now(), 'vow:mem:debug-user-1');
      out.job = job;
    } catch (e) { out.rememberError = { message: e.message, name: e.name, stack: e.stack?.split('\n').slice(0,6) }; }
  } catch (e) { out.sdkError = { message: e.message, stack: e.stack?.split('\n').slice(0,6) }; }
  return res.status(200).json(out);
}
