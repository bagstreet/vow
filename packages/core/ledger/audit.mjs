// ledger/audit.mjs — verify the chain, and refuse to trust a rewritten one.
//
// The audit is the product's promise made checkable: run it and it tells you whether the
// ledger is intact, and if not, exactly which entry was tampered and how. A streak means
// nothing without it; with it, the streak can't be faked or lost.
//
// Five rules are load-bearing (tests/prompt-contract.test.mjs deletes each and requires
// the audit to change). Together they make an append-only, owner-owned record.

import { GENESIS, hashOf, payloadOf } from "./chain.mjs";
import { honestSummary, emptySummary, isReceipted } from "./summary.mjs";
import { screen } from "./screen.mjs";

export const MATERIAL_RULES = [
  "r1-hash-chain-linked",     // each entry links to the previous one's hash
  "r2-payload-bound-hash",    // each entry's hash binds its own content (no in-place edit)
  "r3-append-only-monotonic", // strictly increasing seq — no insert, delete, or reorder
  "r4-receipt-backed-honesty", // a `done` counts only with a confirmed receipt
  "r5-quarantine-untrusted",  // a note that tries to instruct is flagged, not obeyed
];

export const LEAD = "VOW";

function out(state, code, extra) {
  return { state, code, ok: state === "intact", lead: `${LEAD}: ${state} — ${code}`, ...(extra || {}) };
}

export function auditLedger(entries, opts = {}) {
  const off = new Set(opts.disabledRules || []);
  const list = Array.isArray(entries) ? entries : [];

  if (list.length === 0) return out("empty", "no-checkins", { summary: emptySummary() });

  // r5 — a note that tries to instruct or leak is untrusted content in the ledger.
  if (!off.has("r5-quarantine-untrusted")) {
    for (const e of list) {
      const bad = screen(e);
      if (bad) return out("tampered", "untrusted-note", { at: e.seq, detail: bad });
    }
  }

  // r3 — append-only: seq must be 1..n in order. A gap, dup, or reorder is tampering.
  if (!off.has("r3-append-only-monotonic")) {
    for (let i = 0; i < list.length; i++) {
      if (list[i].seq !== i + 1) return out("tampered", "seq-out-of-order", { at: list[i].seq });
    }
  }

  // r2 — content binding: recompute each hash; an edited entry cannot match.
  // r1 — chain linking: each prev_hash must equal the previous entry's hash.
  let prev = GENESIS;
  for (const e of list) {
    if (!off.has("r2-payload-bound-hash") && e.hash !== hashOf(payloadOf(e), e.prev_hash)) {
      return out("tampered", "content-edited", { at: e.seq });
    }
    if (!off.has("r1-hash-chain-linked") && e.prev_hash !== prev) {
      return out("tampered", "link-broken", { at: e.seq });
    }
    prev = e.hash;
  }

  // r4 — honesty: a `done` with no confirmed receipt is a claim, not a kept vow.
  if (!off.has("r4-receipt-backed-honesty")) {
    const unproven = list.filter((e) => e.status === "done" && !isReceipted(e));
    if (unproven.length) return out("unproven", "claim-without-receipt", { at: unproven[0].seq, count: unproven.length, summary: emptySummary() });
  }

  const proof = opts.completeProof;
  if (!proof || proof.count !== list.length || proof.headHash !== (list.at(-1)?.hash || GENESIS) ||
      typeof proof.verifyReceipt !== 'function' || !list.every(e => proof.verifyReceipt(e))) {
    return out('unproven', 'complete-proof-unavailable', {summary:emptySummary()});
  }
  return out("intact", "verified", { summary: honestSummary(list, {verified:true}) });
}
