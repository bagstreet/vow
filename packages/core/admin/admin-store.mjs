// Settings + digest buffer SQL, mixed into the base store so bots, tick and dashboard share it.
export function createAdminStore(sql) {
  return {
    async getSettings() { return Object.fromEntries((await sql('select key, value from app_settings')).map((r) => [r.key, r.value])); },
    async setSetting(k, v) { await sql('insert into app_settings(key, value) values ($1,$2::jsonb) on conflict (key) do update set value = $2::jsonb, updated_at = now()', [k, JSON.stringify(v)]); },
    memoryBuffer: {
      async add(u, t) { await sql('insert into memory_buffer(user_id, text) values ($1,$2)', [u, t]); },
      async count(u) { return Number((await sql('select count(*)::int n from memory_buffer where user_id = $1', [u]))[0].n); },
      async oldestAgeHours(u) { const r = await sql('select extract(epoch from now() - min(created_at))/3600 h from memory_buffer where user_id = $1', [u]); return Number(r[0].h ?? 0); },
      async take(u) { return sql('delete from memory_buffer where user_id = $1 returning text, created_at', [u]); },
      async usersDue(h) { return (await sql(`select user_id from memory_buffer group by user_id having min(created_at) < now() - ($1 || ' hours')::interval`, [String(h)])).map((r) => r.user_id); },
    },
  };
}
