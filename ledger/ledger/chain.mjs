// ledger/chain.mjs — the tamper-evident hash chain.
//
// The whole promise of Vow: you cannot silently rewrite the past. Every check-in is
// linked to the one before it by a hash, and its own hash binds its content. Edit a past
// entry and its hash no longer matches; change the order and a link no longer matches.
// The only honest way to correct the record is to APPEND a new check-in that supersedes
// an earlier one — never to reach back and change it.

import { createHash } from "node:crypto";

export const GENESIS = "VOW-GENESIS-0";

// Recursively canonical serialization so the hash is stable regardless of key order.
export function canonical(v) {
  return JSON.stringify(sortDeep(v));
}
function sortDeep(v) {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v && typeof v === "object") {
    const o = {};
    for (const k of Object.keys(v).sort()) o[k] = sortDeep(v[k]);
    return o;
  }
  return v;
}

// The content that the hash binds — everything except the chain fields and the receipt.
// The receipt (a Walrus blob_id) is the proof the entry was STORED; it is not part of the
// content, so it is excluded here.
export function payloadOf(entry) {
  const { prev_hash, hash, receipt, evidence, __tag, ...payload } = entry;
  return payload;
}

export function hashOf(payload, prev_hash) {
  return createHash("sha256").update(canonical(payload) + "\n" + prev_hash).digest("hex");
}

// Link a new check-in onto the chain. `prevEntry` is the last stored entry (or null for
// the first). Returns a chained entry ready to store.
export function linkCheckin(prevEntry, input) {
  const prev_hash = prevEntry ? prevEntry.hash : GENESIS;
  const payload = {
    checkin_id: input.checkin_id,
    seq: input.seq,
    vow_id: input.vow_id,
    date: input.date,
    status: input.status,
    note: input.note || "",
    supersedes: input.supersedes || null,
    ts: input.ts,
  };
  return { ...payload, prev_hash, hash: hashOf(payload, prev_hash) };
}
