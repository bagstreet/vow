import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { VowLedgerMock } from "../src/memwal-mock.mjs";
import { createMemWal, isReceipt } from "../src/memwal.mjs";
import { CheckinWriter } from "../src/write-queue.mjs";

// Infra coverage: the vow-ledger mock, the real-or-mock selector, and the 429-aware writer.
// Edge/error paths the happy-path tests do not reach.

const NS = "vow:ledger:bagstreet";

test("ledger mock: remember() is a job, rememberAndWait() persists and reloads", async () => {
  const file = join(mkdtempSync(join(tmpdir(), "vow-store-")), "s.json");
  const m = new VowLedgerMock({ storePath: file });
  const job = await m.remember("x", NS);
  assert.ok(job.job_id);
  assert.equal(isReceipt(job), false);
  await m.rememberAndWait(JSON.stringify({ __tag: "vow.checkin.v1", seq: 1 }), NS);
  const m2 = new VowLedgerMock({ storePath: file });
  assert.equal((await m2.restore(NS)).total, 1);
});

test("ledger mock: a corrupted store file fails closed", () => {
  const file = join(mkdtempSync(join(tmpdir(), "vow-bad-")), "s.json");
  writeFileSync(file, "{ not json ");
  assert.throws(() => new VowLedgerMock({ storePath: file }), /Incomplete/);
});

test("createMemWal: no Seal session → offline mock mode", async () => {
  assert.equal((await createMemWal({})).mode, "mock");
});

test("createMemWal: legacy Seal session is rejected explicitly", async () => {
  await assert.rejects(() => createMemWal({ MEMWAL_SEAL_SESSION: "x" }), /Legacy Seal session unsupported/);
});

test("write-queue: honors a 429 retry_after and then succeeds", async () => {
  let calls = 0;
  const w = new CheckinWriter(async () => {
    calls++;
    if (calls === 1) { const e = new Error("429"); e.cause = JSON.stringify({ retry_after_seconds: 0.01 }); throw e; }
    return { blob_id: "b".repeat(43) };
  }, { minGapMs: 0, maxBackoffMs: 1000 });
  assert.ok(isReceipt(await w.submit("t", NS)));
  assert.equal(calls, 2);
});

test("write-queue: a non-retryable error past the backoff ceiling throws", async () => {
  const w = new CheckinWriter(async () => { throw new Error("boom"); }, { minGapMs: 0, maxBackoffMs: 5 });
  await assert.rejects(() => w.submit("t", NS), /boom/);
});
