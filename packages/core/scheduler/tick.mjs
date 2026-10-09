// Reminder tick (T39/T41/T51). Stateless and idempotent: every step claims rows through the store
// (compare-and-swap), so overlapping or repeated ticks (cron-job.org + GitHub Actions backup) never double-send.
import { evaluateGuardians, deliverNotices } from '../guardian/guardian.mjs';
import { computeNextFire } from './time.mjs';
import { inQuietHours } from '../delivery/escalation.mjs';
import { orderChannels } from '../delivery/choose.mjs';
import { selectButtons, buildReminder } from '../delivery/quickreply.mjs';

export const MAX_STEPS = 2;          // at most 2 delivered sends per occurrence (global cap)
export const MAX_ATTEMPTS = 3;
export const DEFAULT_ACK_MIN = 10;
export const SNOOZE_MIN = { snooze: 10, snooze_1h: 60 };

/**
 * store: claimDueReminders(now) -> [{id,userId,role,title,timeLocal,days,tz}] (already advanced by CAS)
 *        initReminders(now), enqueue(row), claimPendingSends(now,limit), channelsFor(userId, occurrenceId),
 *        markSent(id,{channel,escalateAt}), markRetry(id,{sendAt,error,failed}), deferSend(id,sendAt),
 *        claimEscalations(now), expire(id), claimSnoozes(now), userPrefs(userId) -> {tz,quietStart,quietEnd,ackMin}
 * senders: { telegram: async ({externalId,text,buttons,outboxId}) => void }
 */
export async function runTick({ store, senders, pickButtons = null, presence = null, now = Date.now(), batch = 50 }) {
  const out = { initialized: 0, fired: 0, sent: 0, deferred: 0, retried: 0, failed: 0, escalated: 0, expired: 0, snoozed: 0 };

  const choose = async (row, text) => { try { return pickButtons ? await pickButtons({ role: row.role, reminderText: text }) : selectButtons(null, row.role); } catch { return selectButtons(null, row.role); } };

  for (const r of await store.initReminders(now)) { out.initialized++; void r; }

  for (const r of await store.claimDueReminders(now, batch)) {
    await store.enqueue({ userId: r.userId, reminderId: r.id, step: 0, sendAt: now, label: r.title, role: r.role });
    out.fired++;
  }

  for (const s of await store.claimSnoozes(now)) {
    const min = SNOOZE_MIN[s.reply] ?? SNOOZE_MIN.snooze;
    await store.enqueue({ userId: s.userId, reminderId: s.reminderId, step: 0, sendAt: now + min * 60000, occurrenceId: null, label: s.label, role: s.role });
    out.snoozed++;
  }

  for (const row of await store.claimPendingSends(now, batch)) {
    const prefs = await store.userPrefs(row.userId);
    const quiet = inQuietHours(now, { quietHours: prefs.quietStart && prefs.quietEnd ? { start: prefs.quietStart, end: prefs.quietEnd } : null, utcOffsetMin: prefs.utcOffsetMin ?? 0 });
    if (quiet) { await store.deferSend(row.id, now + 15 * 60000); out.deferred++; continue; }
    const withPresence = async (list) => presence ? Promise.all(list.map(async (c) => { try { return { ...c, active: (await presence(c)) === true }; } catch { return c; } })) : list;
    const channels = orderChannels(await withPresence((await store.channelsFor(row.userId, row.occurrenceId)).filter(c => senders[c.channel])), row.channelPref ? [row.channelPref, ...(prefs.channelPriority ?? []).filter(c => c !== row.channelPref)] : (prefs.channelPriority ?? []));
    const target = channels[0];
    if (!target) { await store.markRetry(row.id, { sendAt: now, error: 'no_channel', failed: true }); out.failed++; continue; }
    try {
      const msg = buildReminder({ id: row.id, label: row.label });
      const sent = await senders[target.channel]({ externalId: target.externalId, text: msg.text, buttons: await choose(row, msg.text), outboxId: row.id });
      await store.markSent(row.id, { channel: target.channel, escalateAt: now + (prefs.ackMin ?? DEFAULT_ACK_MIN) * 60000, ref: sent?.ref ?? null });
      out.sent++;
    } catch (e) {
      const failed = row.attempts >= MAX_ATTEMPTS;
      await store.markRetry(row.id, { sendAt: now + 30000 * 2 ** row.attempts, error: String(e.message).slice(0, 200), failed });
      failed ? out.failed++ : out.retried++;
    }
  }

  for (const e of await store.claimEscalations(now)) {
    const next = e.step + 1 < MAX_STEPS ? (await store.channelsFor(e.userId, e.occurrenceId)).filter(c => senders[c.channel]) : []; // next channel is chosen at send time (same ranking)
    if (next.length) { await store.enqueue({ userId: e.userId, reminderId: e.reminderId, step: e.step + 1, sendAt: now, occurrenceId: e.occurrenceId, label: e.label, role: e.role }); out.escalated++; }
    else { await store.expire(e.id); out.expired++; }
  }
  if (store.activeGuardianLinks) { out.guardianAlerts = await evaluateGuardians({ store, now }); out.notices = await deliverNotices({ store, senders, now }); }
  return out;
}

export { computeNextFire };
