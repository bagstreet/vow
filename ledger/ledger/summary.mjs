// ledger/summary.mjs — the HONEST streak.
//
// The number a habit app shows is exactly where trust breaks: stickK charged people who
// had completed. Vow computes the streak only from the owner's own chain, and counts a
// `done` ONLY when a confirmed receipt backs it — so neither the vendor nor the user can
// inflate it. Corrections are resolved by supersede (the latest live status per date).

const BLOB_RE = /^[A-Za-z0-9_-]{43}$/;

// A check-in is proven only when it carries a terminal blob_id — never a job id.
export function isReceipted(entry) {
  return !!(entry && entry.receipt && typeof entry.receipt.blob_id === "string" && BLOB_RE.test(entry.receipt.blob_id));
}

export function emptySummary() {
  return { total: 0, done: 0, missed: 0, streak: 0, receipts: 0 };
}

export function honestSummary(entries, {verified=false}={}) {
  if (!verified) return emptySummary();
  const list = Array.isArray(entries) ? entries : [];
  // Resolve supersedes: a correction is a later entry naming the checkin_id it replaces.
  const superseded = new Set(list.map((e) => e.supersedes).filter(Boolean));
  const live = list.filter((e) => !superseded.has(e.checkin_id));

  // Latest live status per date (list is in append order, so a later entry wins).
  const byDate = new Map();
  for (const e of live) byDate.set(e.date, e);
  const days = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const done = days.filter((e) => e.status === "done" && isReceipted(e)).length;
  const missed = days.filter((e) => e.status === "missed").length;

  // Current streak: consecutive proven `done` days from the most recent backward.
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].status === "done" && isReceipted(days[i])) streak++;
    else break;
  }

  return { total: days.length, done, missed, streak, receipts: live.filter(isReceipted).length };
}
