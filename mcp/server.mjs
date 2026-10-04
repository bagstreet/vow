#!/usr/bin/env node
// mcp/server.mjs — Vow as a conversational accountability companion.
//
// This is the one project of the six whose main surface IS a chat: a person makes a vow,
// checks in by conversation, and asks for their honest streak. Every check-in is a durable
// receipt on a tamper-evident chain, so the streak can't be faked or lost. The audit is
// code; these tools expose it. Credentials come from the environment, never tool arguments.
//
// Requires the optional dependency @modelcontextprotocol/sdk (run `npm install`). Not
// needed for `make test` / `make demo` — the offline path has no dependencies.

import { Companion, exitCodeFor } from "../src/companion.mjs";

async function loadSdk() {
  try {
    const s = await import("@modelcontextprotocol/sdk/server/mcp.js");
    const t = await import("@modelcontextprotocol/sdk/server/stdio.js");
    const z = await import("zod");
    return { McpServer: s.McpServer, StdioServerTransport: t.StdioServerTransport, z: z.z || z.default || z };
  } catch {
    console.error("[vow] @modelcontextprotocol/sdk is not installed. Run `npm install` to use the MCP surface.");
    process.exit(1);
  }
}

const word = (s) => (s === "intact" ? "OK" : s === "tampered" ? "TAMPERED" : s === "unproven" ? "UNPROVEN" : "EMPTY");

async function main() {
  const { McpServer, StdioServerTransport, z } = await loadSdk();
  const owner = process.env.VOW_OWNER || "sam";
  const c = await Companion.open({ owner });
  const server = new McpServer({ name: "vow", version: "1.0.0" });

  server.tool(
    "vow_make",
    "Make a vow (a commitment): a title and a cadence. Returns an honest receipt (terminal blob_id + Walruscan).",
    { title: z.string(), cadence: z.enum(["daily", "weekly"]).optional(), vow_id: z.string().optional(), target: z.number().optional() },
    async (a) => {
      const res = await c.makeVow(a);
      const r = res.receipt;
      return { content: [{ type: "text", text: r.durable ? `STATUS: STORED\n${res.vow.vow_id} — "${res.vow.title}"\nblob_id ${r.blob_id}\n${r.walruscan}` : `STATUS: NOT-DURABLE\n${r.mocked ? "MOCKED digest only; not a Mainnet receipt" : r.note}` }] };
    }
  );

  server.tool(
    "vow_checkin",
    "Log a check-in on a vow (done / missed / skipped). It is linked onto the tamper-evident chain and gets its own receipt. To correct the past, add a check-in that supersedes an earlier one — never edit.",
    { vow_id: z.string(), date: z.string(), status: z.enum(["done", "missed", "skipped"]), note: z.string().optional(), supersedes: z.string().optional() },
    async (a) => {
      const res = await c.checkin(a);
      const r = res.receipt;
      return { content: [{ type: "text", text: r.durable ? `STATUS: STORED\n${res.entry.checkin_id} [${res.entry.status}] ${res.entry.date}\nblob_id ${r.blob_id}\n${r.walruscan}` : `STATUS: NOT-DURABLE\n${r.mocked ? "MOCKED digest only; not a Mainnet receipt" : r.note}` }] };
    }
  );

  server.tool(
    "vow_audit",
    "Verify the whole ledger is intact — that no check-in was edited, reordered, or deleted. Returns intact / tampered (with the entry) / unproven / empty, plus the honest summary.",
    {},
    async () => {
      const { decision, count } = await c.audit();
      const lines = [`STATUS: ${word(decision.state)} (exit ${exitCodeFor(decision.state)})`, decision.lead];
      if (decision.at) lines.push(`at seq ${decision.at}${decision.detail ? ` (${decision.detail})` : ""}`);
      if (decision.summary) lines.push(`summary: ${decision.summary.done} done · ${decision.summary.missed} missed · streak ${decision.summary.streak} · ${decision.summary.receipts} receipts`);
      lines.push(`chain: ${count} check-in(s)`);
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  server.tool(
    "vow_status",
    "The honest current streak for one vow (computed only from receipt-backed check-ins), plus the ledger audit state.",
    { vow_id: z.string() },
    async ({ vow_id }) => {
      const { decision, summary } = await c.status(vow_id);
      return { content: [{ type: "text", text: `STATUS: ${word(decision.state)}\n${vow_id}: ${summary.done} done · ${summary.missed} missed · current streak ${summary.streak}` }] };
    }
  );

  server.tool(
    "vow_restore",
    "Rebuild the ledger from Walrus (the memory passport: the same streak on a new device/agent).",
    {},
    async () => {
      const o = await c.restore();
      return { content: [{ type: "text", text: `STATUS: OK\nrestored ${o.restored}/${o.total} (skipped ${o.skipped}) in ${o.namespace}` }] };
    }
  );

  await server.connect(new StdioServerTransport());
  console.error("[vow] MCP server ready on stdio");
}

main().catch((err) => {
  console.error("[vow] fatal:", err.message);
  process.exit(1);
});
