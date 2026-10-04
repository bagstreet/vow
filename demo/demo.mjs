#!/usr/bin/env node
// demo/demo.mjs — the one-screen tour of Vow. Offline, no keys.
//
// Make a vow, check in over a few days, and each check-in becomes a durable receipt on a
// tamper-evident chain. Then try to quietly rewrite a past day to fake the streak — the
// audit catches it and names the entry. The honest way to correct the record is to APPEND
// a check-in that supersedes the old one, which the audit accepts. A claimed "done" with
// no receipt is not counted.

import { Companion, exitCodeFor } from "../src/companion.mjs";
import { auditLedger } from "../src/ledger/audit.mjs";
import { buildLlmClient } from "../src/llm/index.mjs";

const hr = (t) => console.log(`\n${"─".repeat(66)}\n${t}\n${"─".repeat(66)}`);
const S = (d) => (d.summary ? `${d.summary.done} done · ${d.summary.missed} missed · streak ${d.summary.streak} · ${d.summary.receipts} receipts` : "");

async function main() {
  const c = await Companion.open({ owner: "sam-demo-" + Date.now() }); // fresh ledger each run
  const llm = buildLlmClient(process.env);
  const VOW = "vow:run-3x";
  console.log(`Vow demo — mode=${c.mode} (mock = no keys/network; NOT a mainnet run)`);

  hr("1. Make a vow, then check in — each check-in is a receipt on the chain");
  await c.makeVow({ vow_id: VOW, title: "Run 3x a week", cadence: "weekly", target: 3 });
  for (const [date, status] of [["2026-09-25", "done"], ["2026-09-26", "missed"], ["2026-09-27", "done"], ["2026-09-28", "done"]]) {
    const r = await c.checkin({ vow_id: VOW, date, status });
    console.log(`${r.entry.date} ${status.padEnd(6)} seq=${r.entry.seq}  receipt ${r.receipt.blob_id.slice(0, 12)}…`);
  }

  hr("2. Audit the ledger — verified, and the streak is honest");
  const a1 = await c.audit();
  console.log(`${a1.decision.lead}\nsummary: ${S(a1.decision)}`);
  const narr = await llm.complete({ prompt: `Explain in one sentence: the ledger is ${a1.decision.state} (${a1.decision.code}).` });
  console.log(`why: ${narr.text}  [${narr.provider}]`);

  const { entries } = await c.recallCheckins();

  hr("3. Try to rewrite the past — flip the missed day to 'done' to fake the streak");
  const tampered = entries.map((e) => ({ ...e }));
  tampered[1] = { ...tampered[1], status: "done" }; // edit in place, do NOT re-hash
  const t = auditLedger(tampered);
  console.log(`${t.lead}  → at check-in seq ${t.at}. You cannot quietly rewrite the past; the hash no longer matches.`);

  hr("4. A claimed 'done' with no receipt is not counted");
  const unproven = entries.map((e) => ({ ...e }));
  unproven[0] = { ...unproven[0], receipt: null }; // a write that never confirmed
  const u = auditLedger(unproven);
  console.log(`${u.lead}  → at check-in seq ${u.at}. A claim without a receipt is not a kept vow.`);

  hr("5. Correct the record the honest way — append a check-in that supersedes the old one");
  await c.checkin({ vow_id: VOW, date: "2026-09-26", status: "done", supersedes: entries[1].checkin_id, note: "logged missed by mistake; did run, proof attached" });
  const a2 = await c.audit();
  console.log(`${a2.decision.lead}\nsummary: ${S(a2.decision)}  (the original 'missed' stays in the ledger, marked superseded)`);

  hr("6. Memory passport — restore on a fresh client");
  const rst = await c.restore();
  console.log(`restore(): ${rst.restored}/${rst.total} records rebuilt in ${rst.namespace} (index is a cache; Walrus is the source of truth)`);
  console.log(`\n(audit exit code = ${exitCodeFor(a2.decision.state)})`);

  hr("Evidence boundary");
  console.log("This demo proves DETERMINISTIC POLICY only (mock storage). It is NOT a live mainnet run,");
  console.log("and a mock blob_id is NOT a storage receipt. No Mainnet evidence was produced or verified by this repair.");
  process.exit(0);
}

main().catch((e) => { console.error("demo error:", e.message); process.exit(70); });
