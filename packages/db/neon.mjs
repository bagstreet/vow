// Minimal Neon HTTP SQL client (serverless-friendly, no driver). sql(text, params) -> rows[]
export function createSql(url = process.env.DATABASE_URL, fetchFn = globalThis.fetch) {
  if (!url) throw new Error('DATABASE_URL not set');
  const host = new URL(url).host;
  return async (query, params = []) => {
    const r = await fetchFn(`https://${host}/sql`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Neon-Connection-String': url }, body: JSON.stringify({ query, params }) });
    const j = await r.json();
    if (!r.ok) throw new Error(`neon: ${j.message ?? r.status}`);
    return j.rows ?? [];
  };
}
