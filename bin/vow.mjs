#!/usr/bin/env node
// bin/vow.mjs — Vow on the command line, with a 4-state exit code.
//
//   vow make    --id vow:run-3x --title "Run 3x a week" --cadence weekly [--target 3]
//   vow checkin --vow vow:run-3x --date 2026-09-28 --status done [--note "5k"] [--supersedes ci-3]
//   vow audit                                  (verify the chain)
//   vow status  --vow vow:run-3x               (honest streak for a vow)
//   vow restore
//
// Exit codes: 0 intact, 1 tampered, 2 unproven, 3 empty.

import { tmpdir } from "node:os";
import { join } from "node:path";
import { Companion, exitCodeFor } from "../packages/core/companion.mjs";

if (!process.env.VOW_STORE && !process.env.MEMWAL_SEAL_SESSION) {
  process.env.VOW_STORE = join(tmpdir(), "vow-store.json");
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const n = argv[i + 1];
      if (n === undefined || n.startsWith("--")) out[k] = true;
      else { out[k] = n; i++; }
    } else out._.push(a);
  }
  return out;
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  const owner = args.owner || process.env.VOW_OWNER || "sam";
  const c = await Companion.open({ owner });

  if (cmd === "make") {
    const res = await c.makeVow({ vow_id: args.id, title: args.title || "", cadence: args.cadence || "daily", target: args.target != null ? Number(args.target) : null });
    console.log(`vow ${res.vow.vow_id} — "${res.vow.title}" (${res.vow.cadence}) mode=${res.mode}`);
    console.log(res.receipt.durable ? `receipt ${res.receipt.blob_id}\n${res.receipt.walruscan}` : `receipt: ${res.receipt.mocked ? "MOCKED digest only; not a Mainnet receipt" : res.receipt.note}`);
    process.exit(0);
  }

  if (cmd === "checkin") {
    const res = await c.checkin({ vow_id: args.vow, date: args.date, status: args.status, note: args.note || "", supersedes: args.supersedes || null });
    console.log(`checkin ${res.entry.checkin_id} [${res.entry.status}] ${res.entry.date} seq=${res.entry.seq}`);
    console.log(res.receipt.durable ? `receipt ${res.receipt.blob_id}\n${res.receipt.walruscan}` : `receipt: ${res.receipt.mocked ? "MOCKED digest only; not a Mainnet receipt" : res.receipt.note}`);
    process.exit(0);
  }

  if (cmd === "audit") {
    const { decision, count } = await c.audit();
    console.log(decision.lead);
    if (decision.at) console.log(`at check-in seq ${decision.at}${decision.detail ? ` (${decision.detail})` : ""}`);
    if (decision.summary) console.log(`summary: ${decision.summary.done} done · ${decision.summary.missed} missed · streak ${decision.summary.streak} · ${decision.summary.receipts} receipts`);
    console.log(`chain: ${count} check-in(s)`);
    process.exit(exitCodeFor(decision.state));
  }

  if (cmd === "status") {
    const { decision, summary } = await c.status(args.vow);
    console.log(`${decision.lead}`);
    console.log(`${args.vow}: ${summary.done} done · ${summary.missed} missed · current streak ${summary.streak}`);
    process.exit(exitCodeFor(decision.state));
  }

  if (cmd === "restore") {
    const o = await c.restore();
    console.log(`restored ${o.restored}/${o.total} (skipped ${o.skipped}) in ${o.namespace}`);
    process.exit(0);
  }

  console.error("usage: vow <make|checkin|audit|status|restore> [--flags]");
  process.exit(64);
}

main().catch((err) => {
  console.error("vow error:", err.message);
  process.exit(70);
});
