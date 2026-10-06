// Store for telegram-webhook.mjs on Neon. Same interface as createMemoryStore.
import { randomBytes } from 'node:crypto';
export function createNeonStore(sql) {
  return {
    async seenUpdate(id) { const r = await sql('insert into idempotency(key) values ($1) on conflict do nothing returning key', [`tg:${id}`]); return r.length === 0; },
    async consumeLinkCode(code) {
      const r = await sql("update link_codes set used_at = now() where code = $1 and used_at is null and expires_at > now() and channel = 'telegram' returning user_id", [code]);
      return r[0] ? { userId: r[0].user_id } : null;
    },
    async linkChannel(userId, channel, ext) { await sql('insert into channel_links(user_id, channel, external_id, last_seen_at) values ($1,$2,$3,now()) on conflict (channel, external_id) do update set user_id = excluded.user_id, enabled = true, last_seen_at = now()', [userId, channel, ext]); },
    async userByChat(chat) { const r = await sql("select user_id from channel_links where channel = 'telegram' and external_id = $1 and enabled", [chat]); return r[0] ? { id: r[0].user_id } : null; },
    async listRoles(u) { return (await sql('select role from user_roles where user_id = $1 and enabled order by role', [u])).map((x) => x.role); },
    async setDefaultRole(u, role) { await sql('update users set default_role = $2 where id = $1', [u, role]); },
    async setQuiet(u, v) { const m = v?.match(/^(\d\d:\d\d)-(\d\d:\d\d)$/); await sql('update users set quiet_start = $2, quiet_end = $3 where id = $1', [u, m?.[1] ?? null, m?.[2] ?? null]); },
    async ackOccurrence(id, reply) { await sql("update outbox set status = 'acked', reply = case when id::text = $1 then $2 else reply end, acked_at = now() where occurrence_id = (select occurrence_id from outbox where id::text = $1) and status in ('pending','sent','escalated')", [id, reply]); },
    async createLoginToken(u) { const t = randomBytes(24).toString('base64url'); await sql("insert into login_tokens(token, user_id, expires_at) values ($1,$2, now() + interval '10 minutes')", [t, u]); return t; },
  };
}
