import { test } from "node:test";
import assert from "node:assert/strict";
import { VowLedgerMock } from "../src/memwal-mock.mjs";
import { Companion, exitCodeFor } from "../src/companion.mjs";
import { ledgerNamespace, slugify, STATUSES, STATES } from "../src/keys.mjs";

// App-level tests: exercise the Companion application API end-to-end against the offline
// vow ledger (makeVow → checkin → audit → status → restore) and the key helpers. With the
// ledger/*.test coverage (chain/audit/screen/summary) these bring the business logic to full
// line + function coverage.

const OWNER = "bagstreet";
const NS = "vow:ledger:bagstreet";
const VID = "vow:run-3x";

function companionOn(client) {
  return new Companion({ client, owner: OWNER, mode: "mock" });
}

test("keys: ledgerNamespace + slugify + vocab", () => {
  assert.equal(ledgerNamespace("BagStreet"), NS);
  assert.equal(slugify("  A B "), "a-b");
  assert.ok(STATUSES.includes("done") && STATES.includes("intact"));
});

test("exitCodeFor maps the 4 audit states and falls back to 1", () => {
  assert.equal(exitCodeFor("intact"), 0);
  assert.equal(exitCodeFor("tampered"), 1);
  assert.equal(exitCodeFor("unproven"), 2);
  assert.equal(exitCodeFor("empty"), 3);
  assert.equal(exitCodeFor("???"), 1);
});

test("Companion.open uses the offline mock when there is no Seal session", async () => {
  const c = await Companion.open({ owner: OWNER, env: {} });
  assert.equal(c.mode, "mock");
  assert.equal(c.namespace, NS);
});

test("makeVow returns an honest receipt with a terminal blob_id", async () => {
  const c = companionOn(new VowLedgerMock());
  const res = await c.makeVow({ vow_id: VID, title: "Run 3x a week", cadence: "weekly", target: 3 });
  assert.equal(res.receipt.durable, false);
  assert.equal(res.receipt.mocked, true);
  assert.equal(res.receipt.confirmed, true);
  assert.match(res.receipt.blob_id, /^[A-Za-z0-9_-]{43}$/);
});

test("makeVow marks a write NOT durable when no terminal blob_id comes back", async () => {
  const flaky = {
    owner: "0xVOWOWNER",
    rememberAndWait: async () => ({ job_id: "job_1" }),
    recall: async () => ({ records: [], truncated: false }),
    restore: async () => ({ restored: 0, total: 0, skipped: 0, namespace: NS }),
  };
  const res = await companionOn(flaky).makeVow({ vow_id: VID, title: "x" });
  assert.equal(res.receipt.durable, false);
  assert.match(res.receipt.note, /NOT a receipt/);
});

test("checkin links onto the chain and audit reports an intact ledger", async () => {
  const c = companionOn(new VowLedgerMock());
  await c.makeVow({ vow_id: VID, title: "Run 3x a week" });
  await c.checkin({ vow_id: VID, date: "2026-09-28", status: "done", note: "5k" });
  await c.checkin({ vow_id: VID, date: "2026-09-29", status: "done", note: "6k" });
  const { entries } = await c.recallCheckins();
  assert.equal(entries.length, 2);
  assert.equal(entries[0].seq, 1);
  assert.equal(entries[1].seq, 2);
  const { decision, count } = await c.audit();
  assert.equal(decision.state, "intact");
  assert.equal(count, 2);
});

test("status returns the honest streak summary for a vow", async () => {
  const c = companionOn(new VowLedgerMock());
  await c.makeVow({ vow_id: VID, title: "Run 3x a week" });
  await c.checkin({ vow_id: VID, date: "2026-09-28", status: "done" });
  const { decision, summary } = await c.status(VID);
  assert.equal(decision.state, "intact");
  assert.ok(summary && typeof summary === "object");
});

test("recallCheckins ignores foreign / non-checkin records", async () => {
  const client = new VowLedgerMock();
  const c = companionOn(client);
  await c.checkin({ vow_id: VID, date: "2026-09-28", status: "done" });
  await client.rememberAndWait(JSON.stringify({ __tag: "not.vow", hello: "world" }), c.namespace);
  await client.rememberAndWait("plain non-json checkin-ish text", c.namespace);
  const { entries } = await c.recallCheckins();
  assert.equal(entries.length, 1);
});

test("restore reports the rebuilt count for the namespace", async () => {
  const c = companionOn(new VowLedgerMock());
  await c.makeVow({ vow_id: VID, title: "x" });
  const out = await c.restore();
  assert.equal(out.total, 1);
  assert.equal(out.namespace, NS);
});
