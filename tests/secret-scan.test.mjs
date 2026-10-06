import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";

// Secret scan over tracked content. The pattern source (ledger/screen.mjs) and this test
// are excluded — they legitimately contain example shapes; everything else must be clean.

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIRS = ["src", "ledger", "bin", "mcp", "demo", "docs", "tests", "web"];
const ROOT_FILES = ["README.md", "PROMPT.md", "Makefile", "package.json", ".gitignore"];
const EXCLUDE = new Set(["ledger/ledger/screen.mjs", "tests/secret-scan.test.mjs"]);

const SHAPES = [
  ["GitHub PAT", /ghp_[A-Za-z0-9]{20,}/],
  ["OpenAI key", /sk-[A-Za-z0-9]{16,}/],
  ["AWS access key", /AKIA[0-9A-Z]{16}/],
  ["PEM private key", /-----BEGIN(?:\s+[A-Z]+)?\s+PRIVATE\s+KEY-----/],
  ["Sui private key", /suiprivkey1[a-z0-9]{20,}/i],
];

async function walk(dir, acc = []) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (["node_modules", ".git", "dist", "build", "out"].includes(e.name)) continue;
      await walk(p, acc);
    } else if (/\.(mjs|js|ts|tsx|json|md|txt)$/.test(e.name) || ROOT_FILES.includes(e.name)) {
      acc.push(p);
    }
  }
  return acc;
}

test("no real secret shapes are committed", async () => {
  const files = [];
  for (const d of DIRS) await walk(join(ROOT, d), files);
  for (const f of ROOT_FILES) files.push(join(ROOT, f));
  const hits = [];
  for (const f of files) {
    const rel = relative(ROOT, f).replace(/\\/g, "/");
    if (EXCLUDE.has(rel)) continue;
    let text;
    try { text = await readFile(f, "utf8"); } catch { continue; }
    for (const [name, re] of SHAPES) if (re.test(text)) hits.push(`${rel}: ${name}`);
  }
  assert.deepEqual(hits, [], `secret-like content found:\n${hits.join("\n")}`);
});
