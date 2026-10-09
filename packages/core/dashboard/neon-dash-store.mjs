// Neon store for the dashboard API (handleDash). Extends the bot store so chat reuses history/last_role helpers.
import { createNeonStore } from '../channels/neon-store.mjs';
import { createAccountStore } from '../channels/account-store.mjs';
import { parseArr, parseTextArr } from '../scheduler/time.mjs';

import { createNeonGuardianStore } from '../guardian/neon-guardian-store.mjs';
import { SESSION_DAYS } from './session.mjs';

const days = (v) => parseArr(v).map(Number);
const remOut = (r) => ({ id: r.id, title: r.title, role: r.role, time: String(r.time_local).slice(0, 5), days: days(r.days), channel: r.channel_pref ?? null, enabled: r.enabled, source: r.source ?? 'dashboard', nextFireAt: r.next_fire_at ?? null });

export function createNeonDashStore(sql) {
  const base = createNeonStore(sql);
  const acct = createAccountStore(sql);
  return {
    ...base,
    ...createNeonGuardianStore(sql),
    createLinkCode: acct.createLinkCode, isChannelLinked: acct.isChannelLinked,
    async consumeLoginToken(token) {
      const r = await sql('update login_tokens set used_at = now() where token = $1 and used_at is null and expires_at > now() returning user_id', [token]);
      return r[0] ? { id: r[0].user_id } : null;
    },
    async createSession(userId, hash) { await sql(`insert into sessions(token_hash, user_id, expires_at) values ($1,$2, now() + interval '${SESSION_DAYS} days')`, [hash, userId]); },
    async sessionUser(hash) {
      const r = await sql('update sessions set last_used_at = now() where token_hash = $1 and expires_at > now() returning user_id', [hash]);
      return r[0]?.user_id ?? null;
    },
    async deleteSession(hash) { await sql('delete from sessions where token_hash = $1', [hash]); },
    async countRecentMagic(email) { return Number((await sql("select count(*)::int n from magic_tokens where email = $1 and expires_at > now() - interval '50 minutes'", [email]))[0].n); },
    async createMagic(email, hash, userId = null) { await sql("insert into magic_tokens(token_hash, email, user_id, expires_at) values ($1,$2,$3, now() + interval '10 minutes')", [hash, email, userId]); },
    async countLinkRequestsToday(userId) { return Number((await sql("select count(*)::int n from magic_tokens where user_id = $1 and expires_at > now() - interval '23 hours 50 minutes'", [userId]))[0].n); },
    async emailOwner(email) { return (await sql('select id from users where lower(email) = $1', [email]))[0]?.id ?? null; },
    async setEmail(userId, email) { await sql('update users set email = $2 where id = $1', [userId, email]); },
    async clearEmail(userId) { await sql('update users set email = null where id = $1', [userId]); },
    async consumeMagic(hash) { const r = (await sql('update magic_tokens set used_at = now() where token_hash = $1 and used_at is null and expires_at > now() returning email, user_id', [hash]))[0]; return r ? { email: r.email, userId: r.user_id } : null; },
    async userByChat(chat, channel) { const r = await sql('select user_id from channel_links where channel = $2 and external_id = $1 and enabled', [chat, channel]); return r[0] ? { id: r[0].user_id } : null; },
    async signUp(channel, chat, displayName) {
      const u = await sql('insert into users(display_name, default_role) values ($1, $2) returning id', [displayName ?? null, 'fitness']);
      await sql("insert into user_roles(user_id, role) values ($1,'fitness') on conflict do nothing", [u[0].id]);
      await sql('insert into channel_links(user_id, channel, external_id, last_seen_at) values ($1,$2,$3,now()) on conflict (channel, external_id) do nothing', [u[0].id, channel, chat]);
      return { id: u[0].id };
    },
    async touchChannel(chat, channel) { await sql('update channel_links set last_seen_at = now() where channel = $2 and external_id = $1', [chat, channel]); },
    async findOrCreateByEmail(email) {
      const f = await sql('select id from users where lower(email) = $1', [email]); if (f[0]) return { id: f[0].id };
      const c = await sql('insert into users(display_name, email) values ($1,$2) returning id', [email.split('@')[0], email]);
      await sql("insert into user_roles(user_id, role) values ($1,'fitness') on conflict do nothing", [c[0].id]);
      await sql("update users set default_role = 'fitness' where id = $1", [c[0].id]);
      return { id: c[0].id };
    },
    async getProfile(userId) {
      const r = await sql('select id, blocked_at, display_name, email, tz, tone, role_label, default_role, last_role, quiet_start, quiet_end, ack_min, channel_priority from users where id = $1', [userId]);
      const u = r[0]; if (!u) return null;
      return { ...u, quiet_start: u.quiet_start ? String(u.quiet_start).slice(0, 5) : null, quiet_end: u.quiet_end ? String(u.quiet_end).slice(0, 5) : null, channel_priority: parseTextArr(u.channel_priority) };
    },
    async updateProfile(userId, p) {
      const set = { display_name: p.displayName, tz: p.tz, tone: p.tone, role_label: p.roleLabel, ack_min: p.ackMin, default_role: p.defaultRole };
      if ('quietStart' in p) { set.quiet_start = p.quietStart; set.quiet_end = p.quietEnd; }
      if (p.priority) set.channel_priority = p.priority;
      for (const [k, v] of Object.entries(set)) {
        if (v === undefined) continue;
        await sql(`update users set ${k} = $2${k === 'channel_priority' ? '::text[]' : ''} where id = $1`, [userId, v]);
      }
      if (p.tz) await sql('update reminders set next_fire_at = null where user_id = $1 and enabled', [userId]); // recompute in the new tz
    },
    async listRoles(userId) { return base.listRoles(userId); },
    async setRoles(userId, roles) {
      await sql('update user_roles set enabled = false where user_id = $1', [userId]);
      for (const r of roles) await sql('insert into user_roles(user_id, role, enabled) values ($1,$2,true) on conflict (user_id, role) do update set enabled = true', [userId, r]);
    },
    async listChannels(userId) {
      return (await sql("select id, channel, enabled, last_seen_at, created_at from channel_links where user_id = $1 and enabled and channel <> 'web' order by created_at", [userId]))
        .map((c) => ({ id: c.id, channel: c.channel, enabled: c.enabled, lastSeenAt: c.last_seen_at, linkedAt: c.created_at }));
    },
    async linkChannel(userId, channel, ext) { await sql('insert into channel_links(user_id, channel, external_id, last_seen_at) values ($1,$2,$3,now()) on conflict (channel, external_id) do update set user_id = excluded.user_id, enabled = true', [userId, channel, ext]); },
    async unlinkChannel(userId, id) { await sql('delete from channel_links where id = $1 and user_id = $2', [id, userId]); },
    async listReminders(userId) { return (await sql('select * from reminders where user_id = $1 order by time_local, created_at', [userId])).map(remOut); },
    async createReminder(userId, v) {
      const r = await sql('insert into reminders(user_id, role, title, time_local, days, channel_pref) values ($1,$2,$3,$4,$5::smallint[],$6) returning *', [userId, v.role, v.title, v.time, v.days, v.channel ?? null]);
      return remOut(r[0]);
    },
    async updateReminder(userId, id, v) {
      if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
      const cur = (await sql('select * from reminders where id = $1 and user_id = $2', [id, userId]))[0]; if (!cur) return null;
      const r = await sql('update reminders set title=$3, role=$4, time_local=$5, days=$6::smallint[], channel_pref=$7, enabled=$8, next_fire_at=null where id=$1 and user_id=$2 returning *',
        [id, userId, v.title ?? cur.title, v.role ?? cur.role, v.time ?? String(cur.time_local).slice(0, 5), v.days ?? days(cur.days), v.channel === undefined ? cur.channel_pref : v.channel, v.enabled ?? cur.enabled]);
      return remOut(r[0]);
    },
    async deleteReminder(userId, id) { if (!/^[0-9a-f-]{36}$/i.test(id)) return false; return (await sql('delete from reminders where id = $1 and user_id = $2 returning id', [id, userId])).length > 0; },
    async listMessages(userId, limit) { return (await sql('select channel, direction, role, content, created_at from chat_messages where user_id = $1 order by created_at desc limit $2', [userId, limit])).reverse(); },
    async listMemoryLog(userId, limit) { return sql('select id, channel, kind, preview, job_id, blob_id, created_at, forgotten_at from memory_log where user_id = $1 order by created_at desc limit $2', [userId, limit]); },
    async forgetMemory(userId, id) { const r = await sql('update memory_log set forgotten_at = now() where id = $1 and user_id = $2 and forgotten_at is null returning id', [id, userId]); return r.length > 0; },
    async listForgotten(userId) { return (await sql('select preview from memory_log where user_id = $1 and forgotten_at is not null', [userId])).map((r) => r.preview); },
    async listAgentTokens(userId) { return sql('select id, label, roles, created_at, last_used_at, revoked_at from agent_tokens where user_id = $1 order by created_at desc', [userId]); },
    async createAgentToken(userId, { hash, label, roles }) { const r = await sql('insert into agent_tokens(user_id, token_hash, label, roles) values ($1,$2,$3,$4) returning id', [userId, hash, label, roles]); return r[0]; },
    async revokeAgentToken(userId, id) { if (!/^[0-9a-f-]{36}$/i.test(id)) return false; const r = await sql('update agent_tokens set revoked_at = now() where id = $1 and user_id = $2 and revoked_at is null returning id', [id, userId]); return r.length > 0; },
    async agentTokenByHash(hash) { const r = await sql('select id, user_id, label, roles, revoked_at from agent_tokens where token_hash = $1', [hash]); return r[0] ?? null; },
    async touchAgentToken(id) { await sql('update agent_tokens set last_used_at = now() where id = $1', [id]); },
    async countAgentWrites(userId, label) { const r = await sql("select count(*)::int n from memory_log where user_id = $1 and channel = 'agent' and preview like $2 and created_at > now() - interval '1 hour'", [userId, `[agent:${label}]%`]); return r[0].n; },
    async setBlobId(id, blobId) { await sql('update memory_log set blob_id = $2 where id = $1 and blob_id is null', [id, blobId]); },
    async logMemory(userId, { channel, kind, preview, jobId, blobId }) { await sql('insert into memory_log(user_id, channel, kind, preview, job_id, blob_id) values ($1,$2,$3,$4,$5,$6)', [userId, channel, kind ?? 'chat', preview, jobId ?? null, blobId ?? null]); },
    async exportAll(userId) {
      const [profile, channels, roles, reminders, messages, memory] = await Promise.all([this.getProfile(userId), this.listChannels(userId), this.listRoles(userId), this.listReminders(userId), this.listMessages(userId, 5000), this.listMemoryLog(userId, 5000)]);
      return { profile, channels, roles, reminders, messages, memory };
    },
    async adminListUsers() {
      return (await sql(`select u.id, u.display_name, u.email, u.created_at, u.blocked_at is not null as blocked,
        (select array_agg(channel) from channel_links l where l.user_id = u.id and l.enabled) as channels,
        (select count(*)::int from memory_log m where m.user_id = u.id) as blobs,
        (select count(*)::int from chat_messages g where g.user_id = u.id) as messages from users u order by u.created_at desc limit 200`)).map((r) => ({ ...r, email: maskEmail(r.email), channels: parseTextArr(r.channels) }));
    },
    async listAliases(userId) { return (await sql('select alias_id from user_aliases where user_id = $1', [userId])).map((r) => r.alias_id); },
    async createMergeCode(userId) {
      const code = 'M' + Math.random().toString(36).slice(2, 8).toUpperCase();
      await sql("insert into link_codes(code, user_id, channel, expires_at) values ($1,$2,'merge', now() + interval '10 minutes')", [code, userId]);
      return { code, ttlMinutes: 10 };
    },
    /** One-use: returns the source account id or null. */
    async consumeMergeCode(code) { const r = await sql("update link_codes set used_at = now() where code = $1 and channel = 'merge' and used_at is null and expires_at > now() returning user_id", [String(code)]); return r[0]?.user_id ?? null; },
    /** Move everything from source into target (rules in docs/design/ACCOUNT_MERGE.md), then delete source. Steps are ordered so a retry is safe. */
    async mergeAccounts(targetId, sourceId) {
      const src = (await sql('select email from users where id = $1', [sourceId]))[0]; if (!src) return { error: 'source_missing' };
      await sql('update channel_links set user_id = $1 where user_id = $2', [targetId, sourceId]);
      await sql('insert into user_roles(user_id, role, enabled) select $1, role, enabled from user_roles where user_id = $2 on conflict (user_id, role) do update set enabled = user_roles.enabled or excluded.enabled', [targetId, sourceId]);
      await sql('delete from reminders r using reminders t where r.user_id = $2 and t.user_id = $1 and r.role is not distinct from t.role and r.time_local = t.time_local and r.days = t.days and r.title is not distinct from t.title', [targetId, sourceId]);
      await sql("update reminders set user_id = $1, title = case when title is null or title = '' then title else title end where user_id = $2", [targetId, sourceId]);
      for (const t of ['memory_log', 'chat_messages', 'memory_buffer', 'outbox', 'agent_tokens']) await sql(`update ${t} set user_id = $1 where user_id = $2`, [targetId, sourceId]);
      await sql('delete from guardian_links where (watched_user_id = $1 and guardian_user_id = $2) or (watched_user_id = $2 and guardian_user_id = $1)', [targetId, sourceId]);
      await sql('delete from guardian_links s using guardian_links t where s.watched_user_id = $2 and t.watched_user_id = $1 and s.guardian_user_id is not null and s.guardian_user_id = t.guardian_user_id', [targetId, sourceId]);
      await sql('delete from guardian_links s using guardian_links t where s.guardian_user_id = $2 and t.guardian_user_id = $1 and s.watched_user_id = t.watched_user_id', [targetId, sourceId]);
      await sql('update guardian_links set watched_user_id = $1 where watched_user_id = $2', [targetId, sourceId]);
      await sql('update guardian_links set guardian_user_id = $1 where guardian_user_id = $2', [targetId, sourceId]);
      await sql('insert into user_aliases(alias_id, user_id) values ($2, $1) on conflict do nothing', [targetId, sourceId]);
      await sql('update user_aliases set user_id = $1 where user_id = $2', [targetId, sourceId]);
      if (src.email) { await sql('update users set email = null where id = $1', [sourceId]); await sql('update users set email = coalesce(email, $2) where id = $1', [targetId, src.email]); }
      await sql('delete from users where id = $1', [sourceId]);
      return { ok: true };
    },
    async setBlocked(id, blocked) { await sql('update users set blocked_at = case when $2 then now() else null end where id = $1', [id, !!blocked]); if (blocked) { await sql('delete from sessions where user_id = $1', [id]); await sql('update agent_tokens set revoked_at = now() where user_id = $1 and revoked_at is null', [id]); } },
    async deleteAccount(userId) { await sql('delete from users where id = $1', [userId]); },
  };
}

/** Admin view shows a masked address only (data minimisation): j***@gmail.com. */
export function maskEmail(e) { if (!e) return null; const [l, d] = String(e).split('@'); return `${l.slice(0, 1)}***@${d ?? ''}`; }
