// Store for telegram-webhook.mjs on Neon. Same interface as createMemoryStore.
import { randomBytes } from 'node:crypto';
export function createNeonStore(sql) {
  return {
    async seenUpdate(id) { const r = await sql('insert into idempotency(key) values ($1) on conflict do nothing returning key', [`tg:${id}`]); return r.length === 0; },
    async consumeLinkCode(code, channel = 'telegram') {
      const r = await sql('update link_codes set used_at = now() where code = $1 and used_at is null and expires_at > now() and channel = $2 returning user_id', [code, channel]);
      return r[0] ? { userId: r[0].user_id } : null;
    },
    async linkChannel(userId, channel, ext) { await sql('insert into channel_links(user_id, channel, external_id, last_seen_at) values ($1,$2,$3,now()) on conflict (channel, external_id) do update set user_id = excluded.user_id, enabled = true, last_seen_at = now()', [userId, channel, ext]); },
    // Channels already linked for this user BEFORE this call — used to detect "this is a returning
    // user adding another channel" so the bot can say it recognizes them, not just silently continue.
    async listChannels(userId) { return (await sql('select channel from channel_links where user_id = $1 and enabled', [userId])).map((x) => x.channel); },
    async userByChat(chat, channel = 'telegram') { const r = await sql('select l.user_id, u.default_role, u.role_label, u.last_role, u.tone from channel_links l join users u on u.id = l.user_id where l.channel = $2 and l.external_id = $1 and l.enabled', [chat, channel]); return r[0] ? { id: r[0].user_id, default_role: r[0].default_role, role_label: r[0].role_label, last_role: r[0].last_role, tone: r[0].tone } : null; },
    async listRoles(u) { return (await sql('select role from user_roles where user_id = $1 and enabled order by role', [u])).map((x) => x.role); },
    async setLastRole(u, role) { await sql('update users set last_role = $2 where id = $1', [u, role]); },
    async setDefaultRole(u, role) { await sql('update users set default_role = $2 where id = $1', [u, role]); },
    // Bot-first onboarding: the first message in any channel creates the account (default role: fitness) and links it.
    async signUp(channel, chat, displayName) {
      const u = await sql('insert into users(display_name, default_role) values ($1, $2) returning id', [displayName ?? null, 'fitness']);
      await sql("insert into user_roles(user_id, role) values ($1,'fitness') on conflict do nothing", [u[0].id]);
      await sql('insert into channel_links(user_id, channel, external_id, last_seen_at) values ($1,$2,$3,now()) on conflict (channel, external_id) do nothing', [u[0].id, channel, chat]);
      return { id: u[0].id };
    },
    async logMemory(userId, { channel, kind, preview, jobId }) { await sql('insert into memory_log(user_id, channel, kind, preview, job_id) values ($1,$2,$3,$4,$5)', [userId, channel, kind ?? 'chat', preview, jobId ?? null]); },
    async touchChannel(chat, channel) { await sql('update channel_links set last_seen_at = now() where channel = $2 and external_id = $1', [chat, channel]); },
    async setChannelPriority(u, list) { await sql('update users set channel_priority = $2::text[] where id = $1', [u, list]); },
    async setQuiet(u, v) { const m = v?.match(/^(\d\d:\d\d)-(\d\d:\d\d)$/); await sql('update users set quiet_start = $2, quiet_end = $3 where id = $1', [u, m?.[1] ?? null, m?.[2] ?? null]); },
    // Returns the reminder's title/role so callers can log a meaningful "what was this check-in about"
    // memory, or null if nothing matched (already acked, unknown occurrence, etc).
    async ackOccurrence(id, reply) {
      const r = await sql(
        `update outbox o set status = 'acked', reply = case when o.id::text = $1 then $2 else o.reply end, acked_at = now()
         from reminders rem
         where o.occurrence_id = (select occurrence_id from outbox where id::text = $1)
           and o.status in ('pending','sent','escalated','expired')
           and rem.id = o.reminder_id
         returning rem.title, rem.role`,
        [id, reply],
      );
      return r[0] ? { title: r[0].title, role: r[0].role } : null;
    },
    async createLoginToken(u) { const t = randomBytes(24).toString('base64url'); await sql("insert into login_tokens(token, user_id, expires_at) values ($1,$2, now() + interval '10 minutes')", [t, u]); return t; },
    async getHistory(u, limit = 12) {
      const r = await sql('select direction, role, content from chat_messages where user_id = $1 order by created_at desc limit $2', [u, limit]);
      return r.reverse().map((x) => ({ direction: x.direction, appRole: x.role, content: x.content }));
    },
    async saveMessage(u, channel, direction, content, role) { await sql('insert into chat_messages(user_id, channel, direction, role, content) values ($1,$2,$3,$4,$5)', [u, channel, direction, role ?? null, content]); },
  };
}
