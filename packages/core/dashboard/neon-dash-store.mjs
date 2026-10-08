// Neon store for the dashboard API (handleDash). Extends the bot store so chat reuses history/last_role helpers.
import { createNeonStore } from '../channels/neon-store.mjs';
import { createAccountStore } from '../channels/account-store.mjs';
import { parseArr } from '../scheduler/time.mjs';

import { SESSION_DAYS } from './session.mjs';

const days = (v) => parseArr(v).map(Number);
const remOut = (r) => ({ id: r.id, title: r.title, role: r.role, time: String(r.time_local).slice(0, 5), days: days(r.days), channel: r.channel_pref ?? null, enabled: r.enabled, nextFireAt: r.next_fire_at ?? null });

export function createNeonDashStore(sql) {
  const base = createNeonStore(sql);
  const acct = createAccountStore(sql);
  return {
    ...base,
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
    async createMagic(email, hash) { await sql("insert into magic_tokens(token_hash, email, expires_at) values ($1,$2, now() + interval '10 minutes')", [hash, email]); },
    async consumeMagic(hash) { return (await sql('update magic_tokens set used_at = now() where token_hash = $1 and used_at is null and expires_at > now() returning email', [hash]))[0]?.email ?? null; },
    async findOrCreateByEmail(email) {
      const f = await sql('select id from users where lower(email) = $1', [email]); if (f[0]) return { id: f[0].id };
      const c = await sql('insert into users(display_name, email) values ($1,$2) returning id', [email.split('@')[0], email]);
      await sql("insert into user_roles(user_id, role) values ($1,'fitness') on conflict do nothing", [c[0].id]);
      await sql("update users set default_role = 'fitness' where id = $1", [c[0].id]);
      return { id: c[0].id };
    },
    async getProfile(userId) {
      const r = await sql('select id, display_name, email, tz, tone, role_label, default_role, last_role, quiet_start, quiet_end, ack_min, channel_priority from users where id = $1', [userId]);
      const u = r[0]; if (!u) return null;
      return { ...u, quiet_start: u.quiet_start ? String(u.quiet_start).slice(0, 5) : null, quiet_end: u.quiet_end ? String(u.quiet_end).slice(0, 5) : null, channel_priority: parseArr(u.channel_priority) };
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
    async listMemoryLog(userId, limit) { return sql('select id, channel, kind, preview, job_id, blob_id, created_at from memory_log where user_id = $1 order by created_at desc limit $2', [userId, limit]); },
    async logMemory(userId, { channel, kind, preview, jobId, blobId }) { await sql('insert into memory_log(user_id, channel, kind, preview, job_id, blob_id) values ($1,$2,$3,$4,$5,$6)', [userId, channel, kind ?? 'chat', preview, jobId ?? null, blobId ?? null]); },
    async exportAll(userId) {
      const [profile, channels, roles, reminders, messages, memory] = await Promise.all([this.getProfile(userId), this.listChannels(userId), this.listRoles(userId), this.listReminders(userId), this.listMessages(userId, 5000), this.listMemoryLog(userId, 5000)]);
      return { profile, channels, roles, reminders, messages, memory };
    },
    async deleteAccount(userId) { await sql('delete from users where id = $1', [userId]); },
  };
}
