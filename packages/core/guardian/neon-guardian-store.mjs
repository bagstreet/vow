// Neon implementation of the guardian store (see guardian.mjs). Spread into the dashboard and tick stores.
import { randomBytes } from 'node:crypto';
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from(randomBytes(8), (b) => ALPHABET[b % ALPHABET.length]).join('');
const ms = (v) => (v == null ? null : new Date(v).getTime());
const link = (r) => ({ id: r.id, watchedUserId: r.watched_user_id, guardianUserId: r.guardian_user_id, status: r.status, missedCheckins: r.missed_checkins, silenceHours: r.silence_hours, lastAlertAt: ms(r.last_alert_at) });

export function createNeonGuardianStore(sql) {
  return {
    async countGuardiansOf(userId) { return Number((await sql("select count(*)::int n from guardian_links where watched_user_id = $1 and (status = 'active' or code_expires_at > now())", [userId]))[0].n); },
    async countWatchedBy(userId) { return Number((await sql("select count(*)::int n from guardian_links where guardian_user_id = $1 and status = 'active'", [userId]))[0].n); },
    async createGuardianInvite(userId) {
      const code = newCode();
      const r = await sql("insert into guardian_links(watched_user_id, code, code_expires_at) values ($1,$2, now() + interval '10 minutes') returning code_expires_at", [userId, code]);
      return { code, expiresAt: r[0].code_expires_at, ttlMinutes: 10 };
    },
    async findGuardianInvite(code) {
      if (!code) return null;
      const r = await sql("select id, watched_user_id from guardian_links where code = $1 and status = 'pending' and code_expires_at > now()", [code]);
      return r[0] ? { id: r[0].id, watchedUserId: r[0].watched_user_id } : null;
    },
    async guardianPairExists(watched, guardian) { return (await sql('select 1 from guardian_links where watched_user_id = $1 and guardian_user_id = $2', [watched, guardian])).length > 0; },
    async activateGuardian(id, guardianId) { await sql("update guardian_links set guardian_user_id = $2, status = 'active', code = null where id = $1 and status = 'pending'", [id, guardianId]); },
    async getGuardianLink(id) { if (!/^[0-9a-f-]{36}$/i.test(id)) return null; const r = await sql('select * from guardian_links where id = $1', [id]); return r[0] ? link(r[0]) : null; },
    async setGuardianRules(id, { missedCheckins, silenceHours }) { await sql('update guardian_links set missed_checkins = $2, silence_hours = $3 where id = $1', [id, missedCheckins, silenceHours]); },
    async deleteGuardianLink(id) { await sql('delete from guardian_links where id = $1', [id]); },
    async guardianLinksOf(userId) { return (await sql('select * from guardian_links where watched_user_id = $1 or guardian_user_id = $1', [userId])).map(link); },
    async guardianOverview(userId) {
      const mine = await sql(`select l.id, l.status, l.missed_checkins, l.silence_hours, l.code, l.code_expires_at, u.display_name from guardian_links l left join users u on u.id = l.guardian_user_id where l.watched_user_id = $1 and (l.status = 'active' or l.code_expires_at > now()) order by l.created_at`, [userId]);
      const watching = await sql(`select l.id, l.missed_checkins, l.silence_hours, u.display_name from guardian_links l join users u on u.id = l.watched_user_id where l.guardian_user_id = $1 and l.status = 'active' order by l.created_at`, [userId]);
      const notices = await sql('select id, text, created_at from notices where user_id = $1 order by created_at desc limit 20', [userId]);
      return {
        guardians: mine.map((r) => ({ id: r.id, status: r.status, name: r.display_name ?? null, code: r.status === 'pending' ? r.code : undefined, expiresAt: r.status === 'pending' ? r.code_expires_at : undefined, missedCheckins: r.missed_checkins, silenceHours: r.silence_hours })),
        watching: watching.map((r) => ({ id: r.id, name: r.display_name ?? 'Vow user', missedCheckins: r.missed_checkins, silenceHours: r.silence_hours })),
        notices,
      };
    },
    async addNotice(userId, text) { await sql('insert into notices(user_id, text) values ($1,$2)', [userId, text]); },
    async activeGuardianLinks() { return (await sql("select * from guardian_links where status = 'active' limit 500")).map(link); },
    async guardianStats(userId) {
      const u = (await sql('select display_name from users where id = $1', [userId]))[0];
      const rows = await sql("select status from outbox where user_id = $1 and status in ('acked','expired') order by send_at desc limit 12", [userId]);
      let missedInRow = 0; for (const r of rows) { if (r.status === 'expired') missedInRow++; else break; }
      const sent = (await sql("select max(send_at) t from outbox where user_id = $1 and status in ('sent','escalated','expired','acked')", [userId]))[0]?.t;
      const inb = (await sql("select max(created_at) t from chat_messages where user_id = $1 and direction = 'in'", [userId]))[0]?.t;
      const acked = (await sql('select max(acked_at) t from outbox where user_id = $1', [userId]))[0]?.t;
      return { name: u?.display_name ?? 'Your contact', missedInRow, lastSentAt: ms(sent), lastInboundAt: Math.max(ms(inb) ?? 0, ms(acked) ?? 0) || null };
    },
    async markGuardianAlert(id, prev, now) {
      const r = await sql('update guardian_links set last_alert_at = $3 where id = $1 and last_alert_at is not distinct from $2 returning id', [id, prev ? new Date(prev).toISOString() : null, new Date(now).toISOString()]);
      return r.length > 0;
    },
    async claimNotices(limit) {
      const r = await sql("update notices set sent_at = now() where id in (select id from notices where sent_at is null order by created_at limit $1 for update skip locked) returning id, user_id, text", [limit]);
      return r.map((x) => ({ id: x.id, userId: x.user_id, text: x.text }));
    },
    async finishNotice(id, delivered) { if (!delivered) await sql('update notices set sent_at = now() where id = $1', [id]); },
  };
}
