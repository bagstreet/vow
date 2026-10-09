import { createSql } from '../../../packages/db/neon.mjs';

// Public aggregate for the landing page: Walrus mainnet blobs written by the live bots. Only a number leaves the database.
// BASELINE = the 11 blobs published in docs/MAINNET_EVIDENCE.md; live rows are counted from the moment the DEMO account went live.
const BASELINE = 11, SINCE = '2026-10-09T07:14:37Z';

export default async function handler(req, res) {
  if (req.query?.stats === 'proof') {
    try {
      const r = await createSql()('select count(blob_id)::int as n from memory_log where created_at >= $1', [SINCE]);
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
      return res.status(200).json({ ok: true, blobs: BASELINE + (r[0]?.n ?? 0) });
    } catch (e) { console.error('proof stats', e.message); return res.status(200).json({ ok: true, blobs: BASELINE }); }
  }
  res.status(200).json({ ok: true, service: 'vow', time: new Date().toISOString() });
}
