import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startVowHttp } from "../src/http/server.mjs";

const env = {
  NODE_ENV: "development",
  VOW_OWNER: "sam",
  VOW_STORE: join(mkdtempSync(join(tmpdir(), "vow-http-")), "store.json"),
  VOW_DEMO_TOKEN: "demo-vow-token-local",
  VOW_DEMO_SIGNING_KEY: "demo-signing-key-not-a-wallet",
};

let started;
test.before(async () => {
  started = await startVowHttp({ env, port: 0 });
});
test.after(async () => {
  await new Promise((resolve) => started.server.close(resolve));
});

async function call(path, { token, method = "GET", body } = {}) {
  const res = await fetch(`${started.url}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, text, json: text ? JSON.parse(text) : null };
}

test("HTTP unauthenticated requests are 401", async () => {
  const res = await call("/api/audit");
  assert.equal(res.status, 401);
});

test("body cannot choose another owner", async () => {
  const res = await call("/api/vow", {
    token: env.VOW_DEMO_TOKEN,
    method: "POST",
    body: { title: "Walk", owner: "mallory", vow_id: "vow:walk" },
  });
  assert.equal(res.status, 400);
  assert.match(res.json.error, /cannot set owner/);
});

test("parallel check-ins get distinct seq and stay intact", async () => {
  const made = await call("/api/vow", { token: env.VOW_DEMO_TOKEN, method: "POST", body: { vow_id: "vow:walk", title: "Walk" } });
  assert.equal(made.status, 201);
  assert.equal(made.json.durable, false);
  assert.equal(made.json.receipt.mocked, true);
  const pair = await Promise.all([
    call("/api/checkin", { token: env.VOW_DEMO_TOKEN, method: "POST", body: { vow_id: "vow:walk", date: "2026-10-01", status: "done" } }),
    call("/api/checkin", { token: env.VOW_DEMO_TOKEN, method: "POST", body: { vow_id: "vow:walk", date: "2026-10-02", status: "done" } }),
  ]);
  assert.deepEqual(pair.map((r) => r.status), [201, 201]);
  assert.deepEqual(pair.map((r) => r.json.entry.seq).sort(), [1, 2]);
  const audit = await call("/api/audit", { token: env.VOW_DEMO_TOKEN });
  assert.equal(audit.json.decision.state, "intact");
});

test("chat is labeled not a real LLM", async () => {
  const res = await call("/api/chat?vow=vow:walk", { token: env.VOW_DEMO_TOKEN, method: "POST", body: {} });
  assert.equal(res.json.not_a_real_llm, true);
  assert.equal(res.json.provider, "deterministic");
});

test("production env refuses the demo HTTP listener", async () => {
  await assert.rejects(() => startVowHttp({ env: { ...env, NODE_ENV: "production" } }), /not a production auth/);
});
