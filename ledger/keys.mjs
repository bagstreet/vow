// keys.mjs — vow ids, namespaces, and the ledger's vocabulary.
//
// A MemWal namespace is opaque and exactly matched. Vow keeps every key here. Its own
// scheme: a vow id reads like `vow:run-3x-week`, namespaces are `vow:ledger:<owner>`.
// bagstreet has no prior repo — this is written from scratch, a hash-chained ledger,
// deliberately unlike the resolver/firewall shape of the other five.

export function slugify(s) {
  return String(s).trim().toLowerCase().replace(/[^a-z0-9:]+/g, "-").replace(/^-+|-+$/g, "");
}

export function ledgerNamespace(owner) {
  return `vow:ledger:${slugify(owner)}`;
}

// A check-in's status. `done` counts toward a streak ONLY when a confirmed receipt backs
// it (see summary.mjs) — an honest ledger can't inflate itself.
export const STATUSES = ["done", "missed", "skipped"];

// The four states an audit can report.
export const STATES = ["intact", "tampered", "unproven", "empty"];
