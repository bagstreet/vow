// demo/tamper.mjs — a malicious editor the audit defeats.
//
// It reaches into the stored ledger and flips a check-in's status without re-hashing —
// exactly the "quietly rewrite the past" attack Vow exists to prevent. Run `vow audit`
// afterward and it is caught (content-edited). Offline; edits the file at VOW_STORE.

import { readFileSync, writeFileSync } from "node:fs";

const path = process.env.VOW_STORE || process.argv[2];
if (!path) {
  console.error("set VOW_STORE (or pass a path) to the ledger to tamper with");
  process.exit(64);
}

const book = JSON.parse(readFileSync(path, "utf8"));
let done = false;
for (const [, entries] of book) {
  const checkins = entries.filter((e) => {
    try { return JSON.parse(e.text).__tag === "vow.checkin.v1"; } catch { return false; }
  });
  const victim = checkins.find((e) => JSON.parse(e.text).status === "missed") || checkins[0];
  if (victim) {
    const obj = JSON.parse(victim.text);
    obj.status = "done"; // flip it, but do NOT recompute the hash
    victim.text = JSON.stringify(obj);
    done = true;
  }
}
writeFileSync(path, JSON.stringify(book));
console.log(done ? "tampered: flipped a stored check-in to 'done' (no re-hash) — now run `vow audit`" : "no check-ins to tamper with");
