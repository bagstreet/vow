// Trusted contact ("guardian"): a Vow user nominates another Vow user who is told when check-ins are missed.
// Pure logic; the store is injected. Disclosure is minimal: guardians learn THAT check-ins were missed, never message or memory content.
export const MAX_GUARDIANS = 3;
export const MAX_WATCHED = 10;
export const ALERT_COOLDOWN_MS = 24 * 3600 * 1000;
const ok = (json = {}) => ({ status: 200, json: { ok: true, ...json } });
const err = (status, error) => ({ status, json: { ok: false, error } });
const name = (p) => p?.display_name || 'A Vow user';

export async function handleGuardian({ store, op, method, body = {}, userId }) {
  if (op === 'guardian-list' && method === 'GET') return ok(await store.guardianOverview(userId));
  if (op === 'guardian-invite' && method === 'POST') {
    if ((await store.countGuardiansOf(userId)) >= MAX_GUARDIANS) return err(409, 'guardian_limit');
    return ok(await store.createGuardianInvite(userId)); // { code, expiresAt, ttlMinutes }
  }
  if (op === 'guardian-accept' && method === 'POST') {
    const inv = await store.findGuardianInvite(String(body.code ?? '').trim().toUpperCase());
    if (!inv) return err(400, 'invalid_or_expired_code');
    if (inv.watchedUserId === userId) return err(400, 'self_link');
    if (await store.guardianPairExists(inv.watchedUserId, userId)) return err(409, 'already_linked');
    if ((await store.countWatchedBy(userId)) >= MAX_WATCHED) return err(409, 'watch_limit');
    await store.activateGuardian(inv.id, userId);
    const g = await store.getProfile(userId);
    await store.addNotice(inv.watchedUserId, `${name(g)} accepted and is now your trusted contact. They will be told if you miss check-ins. You can remove them any time in the dashboard.`);
    return ok({ linked: true, watched: name(await store.getProfile(inv.watchedUserId)) });
  }
  if (op === 'guardian-rules' && method === 'PATCH') {
    const link = await store.getGuardianLink(String(body.id ?? ''));
    if (!link || link.guardianUserId !== userId) return err(404, 'not_found'); // only the guardian sets the rules
    const m = body.missedCheckins === undefined ? link.missedCheckins : Number(body.missedCheckins);
    const h = body.silenceHours === undefined ? link.silenceHours : Number(body.silenceHours);
    if (!Number.isInteger(m) || m < 1 || m > 10) return err(400, 'bad_missed');
    if (!Number.isInteger(h) || h < 1 || h > 720) return err(400, 'bad_silence');
    await store.setGuardianRules(link.id, { missedCheckins: m, silenceHours: h });
    await store.addNotice(link.watchedUserId, `${name(await store.getProfile(userId))} changed your trusted-contact rules: alert after ${m} missed check-in${m === 1 ? '' : 's'} or ${h} h of silence.`);
    return ok({});
  }
  if (op === 'guardian-revoke' && method === 'DELETE') {
    const link = await store.getGuardianLink(String(body.id ?? ''));
    if (!link || (link.watchedUserId !== userId && link.guardianUserId !== userId)) return err(404, 'not_found');
    const byWatched = link.watchedUserId === userId;
    await store.deleteGuardianLink(link.id);
    if (link.guardianUserId) {
      if (byWatched) await store.addNotice(link.guardianUserId, `${name(await store.getProfile(userId))} removed you as their trusted contact. You no longer receive alerts about them.`);
      else await store.addNotice(link.watchedUserId, `${name(await store.getProfile(userId))} stopped being your trusted contact.`);
    }
    return ok({});
  }
  return null;
}

/** Call BEFORE deleting an account: tells every counterpart that the link is gone (the DB cascade then removes the rows). */
export async function notifyBeforeDelete(store, userId) {
  if (!store.guardianLinksOf) return;
  const self = name(await store.getProfile(userId));
  for (const l of await store.guardianLinksOf(userId)) {
    if (!l.guardianUserId) continue;
    if (l.watchedUserId === userId) await store.addNotice(l.guardianUserId, `${self} deleted their account. You no longer watch them.`);
    else await store.addNotice(l.watchedUserId, `Your trusted contact ${self} deleted their account. Protection is off; choose a new trusted contact in the dashboard.`);
  }
}

/** Evaluate one active link from the watched user's stats. Returns the alert text or null. */
export function breach(link, stats, now) {
  if (link.lastAlertAt && now - link.lastAlertAt < ALERT_COOLDOWN_MS) return null;
  if (stats.missedInRow >= link.missedCheckins) return `${stats.name} missed ${stats.missedInRow} check-ins in a row.`;
  if (stats.lastSentAt && now - stats.lastSentAt >= link.silenceHours * 3600000 && (!stats.lastInboundAt || stats.lastInboundAt < stats.lastSentAt)) return `${stats.name} has not replied to Vow for ${link.silenceHours} h or more.`;
  return null;
}

/** Tick step: raise alerts for active links. Returns the number of alerts queued. */
export async function evaluateGuardians({ store, now = Date.now() }) {
  let n = 0;
  for (const link of await store.activeGuardianLinks()) {
    const stats = await store.guardianStats(link.watchedUserId);
    const text = breach(link, stats, now);
    if (!text) continue;
    if (!(await store.markGuardianAlert(link.id, link.lastAlertAt, now))) continue; // compare-and-swap: overlapping ticks alert once
    await store.addNotice(link.guardianUserId, `${text} (Vow is not an emergency service.)`);
    n++;
  }
  return n;
}

/** Tick step: deliver queued notices through the user's first available channel. */
export async function deliverNotices({ store, senders, now = Date.now() }) {
  let sent = 0;
  for (const nt of await store.claimNotices(20)) {
    const chans = (await store.channelsFor(nt.userId, null)).filter((c) => senders[c.channel]).sort((a, b) => b.lastSeenAt - a.lastSeenAt);
    const c = chans[0];
    if (!c) { await store.finishNotice(nt.id, false); continue; } // stays visible in the dashboard
    try { await senders[c.channel]({ externalId: c.externalId, text: nt.text, buttons: [] }); await store.finishNotice(nt.id, true); sent++; }
    catch { await store.finishNotice(nt.id, false); }
  }
  void now; return sent;
}
