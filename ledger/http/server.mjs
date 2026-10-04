// Local Node http demo. Bearer access token maps to a signed owner principal.
// Not production OAuth. Not a wallet or MemWal private key.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { Companion } from "../companion.mjs";
import { DeterministicClient } from "../llm/deterministic.mjs";
import { localDecision } from "../decision/local.mjs";
import { authenticate, loadPrincipalTable, rejectPrivilegeBody, signingKey } from "./auth.mjs";

const ROOT = fileURLToPath(new URL("../../web/", import.meta.url));
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml" };
const MAX_BODY = 16 * 1024;

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) {
      const err = new Error("Body too large");
      err.status = 413;
      throw err;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const err = new Error("Invalid JSON");
    err.status = 400;
    throw err;
  }
}

export function createVowApp({ companion, table, key, chat = new DeterministicClient() }) {
  return async function handle(req, res) {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    try {
      if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html" || url.pathname === "/styles.css" || url.pathname === "/app.js")) {
        const rel = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
        const file = join(ROOT, normalize(rel).replace(/^(\.\.(\/|\\|$))+/, ""));
        if (!file.startsWith(ROOT)) {
          send(res, 404, { error: "not found" });
          return;
        }
        const buf = await readFile(file);
        res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream", "cache-control": "no-store" });
        res.end(buf);
        return;
      }
      if (!url.pathname.startsWith("/api/")) {
        send(res, 404, { error: "not found" });
        return;
      }
      const principal = authenticate(req.headers.authorization, table, key);
      if (!principal) {
        send(res, 401, { error: "unauthorized", mock_label: "EXPLICIT_MOCK" });
        return;
      }
      if (principal.owner !== companion.owner) {
        send(res, 403, { error: "owner mismatch" });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/vow") {
        const body = rejectPrivilegeBody(await readBody(req));
        const out = await companion.makeVow({ vow_id: body.vow_id, title: body.title, cadence: body.cadence, target: body.target });
        send(res, 201, {
          mock_label: "EXPLICIT_MOCK",
          not_mainnet: true,
          not_production_auth: true,
          durable: false,
          mode: out.mode,
          vow: out.vow,
          receipt: { blob_id: out.receipt.blob_id || null, mocked: true, durable: false, confirmed: out.receipt.confirmed === true, walruscan: null },
        });
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/checkin") {
        const body = rejectPrivilegeBody(await readBody(req));
        const out = await companion.checkin({ vow_id: body.vow_id, date: body.date, status: body.status, note: body.note || "", supersedes: body.supersedes || null });
        send(res, 201, {
          mock_label: "EXPLICIT_MOCK",
          not_mainnet: true,
          durable: false,
          mode: out.mode,
          entry: { checkin_id: out.entry.checkin_id, seq: out.entry.seq, date: out.entry.date, status: out.entry.status, vow_id: out.entry.vow_id, hash: out.entry.hash },
          receipt: { blob_id: out.receipt.blob_id || null, mocked: true, durable: false, walruscan: null },
        });
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/correction") {
        const body = rejectPrivilegeBody(await readBody(req));
        if (!body.supersedes) {
          send(res, 400, { error: "correction must supersede an earlier check-in" });
          return;
        }
        const out = await companion.checkin({ vow_id: body.vow_id, date: body.date, status: body.status, note: body.note || "", supersedes: body.supersedes });
        send(res, 201, {
          mock_label: "EXPLICIT_MOCK",
          correction: true,
          edited_in_place: false,
          entry: { checkin_id: out.entry.checkin_id, seq: out.entry.seq, supersedes: out.entry.supersedes, status: out.entry.status },
          receipt: { blob_id: out.receipt.blob_id || null, mocked: true, durable: false },
        });
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/audit") {
        const out = await companion.audit();
        send(res, 200, { mock_label: "EXPLICIT_MOCK", mode: out.mode, count: out.count, decision: out.decision, local_decision: localDecision(out.decision.state) });
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/status") {
        const vow = url.searchParams.get("vow");
        if (!vow) {
          send(res, 400, { error: "vow required" });
          return;
        }
        const out = await companion.status(vow);
        send(res, 200, { mock_label: "EXPLICIT_MOCK", mode: out.mode, decision: out.decision, summary: out.summary, local_decision: localDecision(out.decision.state) });
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/chat") {
        rejectPrivilegeBody(await readBody(req));
        const vow = url.searchParams.get("vow");
        const out = vow ? await companion.status(vow) : await companion.audit();
        const reply = await chat.complete({ prompt: out.decision.lead || out.decision.state });
        send(res, 200, { mock_label: "EXPLICIT_MOCK", not_a_real_llm: true, provider: reply.provider, model: reply.model, text: reply.text, state: out.decision.state });
        return;
      }
      send(res, 404, { error: "not found" });
    } catch (err) {
      send(res, err.status || 500, { error: err.status ? err.message : "server error", mock_label: "EXPLICIT_MOCK" });
    }
  };
}

export async function startVowHttp({ env = process.env, port = 0, host = "127.0.0.1" } = {}) {
  const { assertDemoHttpAllowed } = await import("./auth.mjs");
  assertDemoHttpAllowed(env);
  const owner = env.VOW_OWNER || "sam";
  const companion = await Companion.open({ owner, env });
  if (companion.mode !== "mock") throw new Error("HTTP demo refuses non-mock storage");
  const table = loadPrincipalTable(env);
  const key = signingKey(env);
  const server = createServer(createVowApp({ companion, table, key }));
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
  const address = server.address();
  return { server, port: address.port, host, companion, url: `http://${host}:${address.port}` };
}
