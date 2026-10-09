// Neon implementation of the tick store. Claims use compare-and-swap UPDATEs (no long transactions over HTTP SQL).
import { createNeonGuardianStore } from '../guardian/neon-guardian-store.mjs';
import { computeNextFire, parseArr, parseTextArr, tzOffsetMin } from './time.mjs';

const toMs = (v) => (v == null ? null : new Date(v).getTime());
const iso = (ms) => new Date(ms).toISOString();

export function createNeonTickStore(sql) {
  const rem = (r) => ({ id: r.id, userId: r.user_id, role: r.role, title: r.title, timeLocal: String(r.time_local).slice(0, 5), days: parseArr(r.days), tz: r.tz, onceDate: r.once_date ? String(r.once_date).slice(0, 10) : null });
  return {
    ...createNeonGuardianStore(sql),
    async initReminders(now) {
      const rows = await sql("select r.id, r.user_id, r.role, r.title, r.time_local, r.once_date, r.next_fire_at, array_to_string(r.days, ',') as days, u.tz from reminders r join users u on u.id = r.user_id where r.enabled and u.blocked_at is null and r.next_fire_at is null limit 100");
      let n = 0;
      for (const r0 of rows) {
        try {
          const r = rem(r0); const nf = computeNextFire(r, now);
          if (nf) { await sql('update reminders set next_fire_at = $2 where id = $1 and next_fire_at is null', [r.id, iso(nf)]); n++; }
          else if (r.onceDate) await sql('update reminders set enabled = false where id = $1', [r.id]); // one-time reminder whose date has passed
          else await sql('update reminders set enabled = false where id = $1', [r.id]); // unschedulable (e.g. empty days): park it so it cannot block the tick
        } catch (e) { console.error('initReminders row failed', r0.id, e?.message); }
      }
      return rows.slice(0, n);
    },
    async claimDueReminders(now, limit) {
      const rows = await sql("select r.id, r.user_id, r.role, r.title, r.time_local, r.once_date, r.next_fire_at, array_to_string(r.days, ',') as days, u.tz from reminders r join users u on u.id = r.user_id where r.enabled and u.blocked_at is null and r.next_fire_at <= $1 order by r.next_fire_at limit $2", [iso(now), limit]);
      const out = [];
      for (const r0 of rows) {
        try {
          const r = rem(r0); const nf = computeNextFire(r, now);
          const won = await sql('update reminders set next_fire_at = $3 where id = $1 and next_fire_at = $2 returning id', [r.id, r0.next_fire_at, nf ? iso(nf) : null]);
          if (won.length) { out.push(r); if (r.onceDate) await sql('update reminders set enabled = false where id = $1', [r.id]); }
        } catch (e) { console.error('claimDue row failed', r0.id, e?.message); }
      }
      return out;
    },
    async enqueue({ userId, reminderId, step, sendAt, occurrenceId, label, role }) {
      await sql(`insert into outbox(reminder_id, user_id, step, send_at, status, occurrence_id)
                 values ($1,$2,$3,$4,'pending', coalesce($5::uuid, gen_random_uuid()))`, [reminderId, userId, step, iso(sendAt), occurrenceId ?? null]);
    },
    async claimPendingSends(now, limit) {
      // lease: push send_at 2 min ahead so a concurrent tick skips the row; attempts counts claims
      const rows = await sql(`update outbox set attempts = attempts + 1, send_at = $2::timestamptz + interval '2 minutes'
        where id in (select id from outbox where status = 'pending' and send_at <= $1::timestamptz order by send_at limit $3 for update skip locked)
        returning id, user_id, reminder_id, occurrence_id, step, attempts`, [iso(now), iso(now), limit]);
      const out = [];
      for (const r of rows) {
        const m = await sql('select title, role, channel_pref from reminders where id = $1', [r.reminder_id]);
        out.push({ id: r.id, userId: r.user_id, reminderId: r.reminder_id, occurrenceId: r.occurrence_id, step: r.step, attempts: r.attempts, label: m[0]?.title ?? 'your reminder', role: m[0]?.role, channelPref: m[0]?.channel_pref ?? null });
      }
      return out;
    },
    async channelsFor(userId, occurrenceId) {
      const rows = await sql(`select channel, external_id, last_seen_at from channel_links l where user_id = $1 and enabled and channel <> 'web'
        and channel not in (select channel from outbox where occurrence_id = $2 and channel is not null)
        `, [userId, occurrenceId ?? '00000000-0000-0000-0000-000000000000']);
      return rows.map(r => ({ channel: r.channel, externalId: r.external_id, lastSeenAt: toMs(r.last_seen_at) ?? 0 }));
    },
    async userPrefs(userId) {
      const r = (await sql('select tz, quiet_start, quiet_end, channel_priority, ack_min from users where id = $1', [userId]))[0] ?? {};
      return { tz: r.tz, quietStart: r.quiet_start ? String(r.quiet_start).slice(0, 5) : null, quietEnd: r.quiet_end ? String(r.quiet_end).slice(0, 5) : null, utcOffsetMin: tzOffsetMin(r.tz ?? 'UTC', Date.now()), ackMin: r.ack_min ?? 10, channelPriority: parseTextArr(r.channel_priority) };
    },
    async markSent(id, { channel, escalateAt, ref = null }) { await sql("update outbox set status = 'sent', channel = $2, escalate_at = $3, last_error = null, msg_ref = $4 where id = $1", [id, channel, iso(escalateAt), ref]); },
    async markRetry(id, { sendAt, error, failed }) { await sql('update outbox set status = $2, send_at = $3, last_error = $4 where id = $1', [id, failed ? 'failed' : 'pending', iso(sendAt), error]); },
    async deferSend(id, sendAt) { await sql("update outbox set send_at = $2, attempts = greatest(attempts - 1, 0) where id = $1", [id, iso(sendAt)]); },
    async claimEscalations(now) {
      const rows = await sql(`update outbox set status = 'escalated' where id in (select id from outbox where status = 'sent' and escalate_at <= $1 for update skip locked)
        returning id, user_id, reminder_id, occurrence_id, step`, [iso(now)]);
      const out = [];
      for (const r of rows) {
        const m = await sql('select title, role from reminders where id = $1', [r.reminder_id]);
        out.push({ id: r.id, userId: r.user_id, reminderId: r.reminder_id, occurrenceId: r.occurrence_id, step: r.step, label: m[0]?.title ?? 'your reminder', role: m[0]?.role });
      }
      return out;
    },
    async expire(id) { await sql("update outbox set status = 'expired' where id = $1", [id]); },
    async claimSnoozes() {
      const rows = await sql(`update outbox set snoozed_at = now() where id in (select id from outbox where status = 'acked' and reply like 'snooze%' and snoozed_at is null for update skip locked)
        returning id, user_id, reminder_id, reply`);
      const out = [];
      for (const r of rows) {
        const m = await sql('select title, role from reminders where id = $1', [r.reminder_id]);
        out.push({ userId: r.user_id, reminderId: r.reminder_id, reply: r.reply, label: m[0]?.title ?? 'your reminder', role: m[0]?.role });
      }
      return out;
    },
  };
}
