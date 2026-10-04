#!/usr/bin/env node
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startVowHttp } from "../src/http/server.mjs";

if (!process.env.VOW_STORE) {
  process.env.VOW_STORE = join(mkdtempSync(join(tmpdir(), "vow-http-")), "store.json");
}
const port = Number(process.env.PORT || 8788);
const started = await startVowHttp({ port, host: "127.0.0.1" });
console.error(`vow demo http ${started.url} mock_label=EXPLICIT_MOCK not_production_auth=true`);
