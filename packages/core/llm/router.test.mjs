import { test } from "node:test";
import assert from "node:assert/strict";
import { LlmRouter } from "./router.mjs";
const ok = (n) => ({ complete: async () => ({ text: "hi from " + n, provider: n }) });
const bad = (status) => ({ complete: async () => { const e = new Error("x"); e.status = status; throw e; } });
test("falls through failing provider", async () => {
  const r = new LlmRouter({ a: bad(500), b: ok("b") }, { routes: { chat: ["a", "b"] } });
  const o = await r.complete({}); assert.equal(o.provider, "b"); assert.deepEqual(o.tried, ["a:500"]);
});
test("429 opens circuit, then skips, then recovers", async () => {
  let t = 0; const r = new LlmRouter({ a: bad(429), b: ok("b") }, { routes: { chat: ["a", "b"] }, now: () => t, cooldownMs: 100 });
  await r.complete({}); assert.ok(r.isOpen("a"));
  const o = await r.complete({}); assert.deepEqual(o.tried, ["a:open"]);
  t = 200; assert.ok(!r.isOpen("a"));
});
test("3 generic fails open circuit", async () => {
  const r = new LlmRouter({ a: bad(500), b: ok("b") }, { routes: { chat: ["a", "b"] } });
  for (let i = 0; i < 3; i++) await r.complete({}); assert.ok(r.isOpen("a"));
});
test("task routes differ and unknown clients are skipped", async () => {
  const r = new LlmRouter({ b: ok("b") }, { routes: { chat: ["a", "b"], buttons: ["b"] } });
  assert.equal((await r.complete({ task: "buttons" })).provider, "b");
});
test("tail used when all fail; throws without tail", async () => {
  const r = new LlmRouter({ a: bad(500) }, { routes: { chat: ["a"] }, tail: ok("tail") });
  assert.equal((await r.complete({})).provider, "tail");
  await assert.rejects(new LlmRouter({ a: bad(500) }, { routes: { chat: ["a"] } }).complete({}));
});
