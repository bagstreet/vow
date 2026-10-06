import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// End-to-end: drive the REAL CLI through each use-case, asserting stdout + the 4-state exit
// code. State is shared via a temp VOW_STORE (the append-only hash chain persists across calls).

// Offline fixtures must never inherit live provider credentials. Assertions are unchanged.
const demoEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("MEMWAL_")));
const BIN = fileURLToPath(new URL("../apps/cli/vow.mjs", import.meta.url));
const STORE = join(mkdtempSync(join(tmpdir(), "vow-e2e-")), "store.json");
const run = (args) => spawnSync("node", [BIN, ...args], { encoding: "utf8", env: { ...demoEnv, VOW_STORE: STORE } });

test("e2e: make a vow → terminal receipt (exit 0)", () => {
  const r = run(["make", "--id", "vow:run-3x", "--title", "Run 3x a week", "--cadence", "weekly", "--target", "3"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test("e2e: two honest check-ins link onto the chain (exit 0)", () => {
  assert.equal(run(["checkin", "--vow", "vow:run-3x", "--date", "2026-09-28", "--status", "done", "--note", "5k"]).status, 0);
  assert.equal(run(["checkin", "--vow", "vow:run-3x", "--date", "2026-09-29", "--status", "done", "--note", "6k"]).status, 0);
});

test("e2e: audit reports an intact, tamper-evident chain (exit 0)", () => {
  const r = run(["audit"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /intact/);
});

test("e2e: status reports the honest streak for a vow (exit 0)", () => {
  const r = run(["status", "--vow", "vow:run-3x"]);
  assert.equal(r.status, 0);
});

test("e2e: restore rebuilds the chain (exit 0)", () => {
  const r = run(["restore"]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /restored \d+\/\d+/);
});

test("e2e: unknown subcommand exits 64 with usage", () => {
  const r = run(["frobnicate"]);
  assert.equal(r.status, 64);
  assert.match(r.stderr, /usage: vow/);
});
