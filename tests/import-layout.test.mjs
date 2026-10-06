import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join, relative } from "node:path";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SOURCE_DIRS = ["apps", "packages", "examples", "tests"];

async function modules(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory() && (entry.name === "node_modules" || entry.name === "dist")) continue;
    if (entry.isDirectory()) files.push(...await modules(path));
    else if (entry.name.endsWith(".mjs")) files.push(path);
  }
  return files;
}

test("every literal relative module import resolves in the current source layout", async () => {
  const missing = [];
  let checked = 0;
  for (const dir of SOURCE_DIRS) {
    for (const file of await modules(join(ROOT, dir))) {
      const source = await readFile(file, "utf8");
      const imports = /\b(?:from\s*|import\s*\(\s*|import\s*)(["'])(\.[^"']+)\1/g;
      for (const match of source.matchAll(imports)) {
        checked++;
        const target = new URL(match[2], pathToFileURL(file));
        try {
          assert.ok((await stat(target)).isFile());
        } catch {
          missing.push(`${relative(ROOT, file)}: ${match[2]}`);
        }
      }
    }
  }
  assert.ok(checked > 0, "the regression check must inspect real imports");
  assert.deepEqual(missing, [], `unresolved imports:\n${missing.join("\n")}`);
});
