import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { VowLedgerMock } from "../packages/core/memwal-mock.mjs";
import { isReceipt } from "../packages/core/memwal.mjs";
import { Companion } from "../packages/core/companion.mjs";

const b64url = (buf) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
const blobIdFor = (t) => b64url(createHash("sha256").update(t).digest()).slice(0, 43);

function companionOn(client) {
  return new Companion({ client, owner: "sam", mode: "mock" });
}

test("remember() returns a job, NOT a receipt", async () => {
  const m = new VowLedgerMock();
  const job = await m.remember("x", "vow:ledger:sam");
  assert.ok(job.job_id);
  assert.equal(isReceipt(job), false);
});

test("rememberAndWait() returns a terminal 43-char blob_id", async () => {
  const m = new VowLedgerMock();
  const r = await m.rememberAndWait("x", "vow:ledger:sam");
  assert.ok(isReceipt(r));
  assert.equal(r.blob_id.length, 43);
});

test("a check-in's receipt binds to the exact stored bytes", async () => {
  const book = new Map();
  const c = companionOn(new VowLedgerMock());
  c.client.ledgers = book;
  await c.makeVow({ vow_id: "vow:x", title: "x" });
  const res = await c.checkin({ vow_id: "vow:x", date: "2026-09-25", status: "done" });
  const stored = book.get(c.namespace).find((e) => e.blob_id === res.receipt.blob_id);
  assert.equal(blobIdFor(stored.text), res.receipt.blob_id);
});

test("first turn is recall-only (no write); a check-in appends one record", async () => {
  const book = new Map();
  const c = companionOn(new VowLedgerMock());
  c.client.ledgers = book;
  const before = await c.recallCheckins();
  assert.equal(before.entries.length, 0);
  assert.equal((book.get(c.namespace) || []).length, 0);
  await c.checkin({ vow_id: "vow:x", date: "2026-09-25", status: "done" });
  assert.equal(book.get(c.namespace).length, 1);
});

test("passport: a fresh client cold-recalls the same ledger, and it still audits intact", async () => {
  const book = new Map();
  const c = companionOn(new VowLedgerMock());
  c.client.ledgers = book;
  await c.checkin({ vow_id: "vow:x", date: "2026-09-25", status: "done" });
  await c.checkin({ vow_id: "vow:x", date: "2026-09-26", status: "done" });
  const cold = companionOn(new VowLedgerMock());
  cold.client.ledgers = book;
  const r = await cold.client.restore(cold.namespace);
  assert.equal(r.total, 2);
  const audit = await cold.audit();
  assert.equal(audit.decision.state, "intact");
});
