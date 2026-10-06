// Applies migrations over Neon's HTTP SQL endpoint. Usage: DATABASE_URL=... node packages/db/apply.mjs
import { readdirSync, readFileSync } from 'node:fs';
const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL not set');
const host = new URL(url).host;
async function sql(query) {
  const r = await fetch(`https://${host}/sql`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Neon-Connection-String': url }, body: JSON.stringify({ query, params: [] }) });
  const j = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(j));
  return j;
}
const dir = new URL('./migrations/', import.meta.url);
await sql('create table if not exists schema_migrations (id text primary key, applied_at timestamptz not null default now())');
const done = new Set((await sql('select id from schema_migrations')).rows.map(r => r.id));
for (const f of readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
  if (done.has(f)) { console.log('skip', f); continue; }
  // HTTP endpoint runs one statement per call
  for (const stmt of readFileSync(new URL(f, dir), 'utf8').split(/;\s*\n/).map(s => s.replace(/^\s*--.*$/gm, '').trim()).filter(Boolean)) await sql(stmt);
  await sql(`insert into schema_migrations(id) values ('${f}')`);
  console.log('applied', f);
}
