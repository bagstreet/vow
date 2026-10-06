// memwal-mock.mjs — an offline ledger that stands in for the MemWal relayer.
//
// Vow reads and writes check-ins through this in `make demo`/`make test`, so a judge needs
// no keys or network. Honest boundary: a mock blob_id is a deterministic digest of the
// stored bytes, not a Walrus receipt. Real mainnet blobs live in docs/RECEIPTS.md.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const b64url = (buf) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
const blobIdFor = (text) => b64url(createHash("sha256").update(text).digest()).slice(0, 43);

export class VowLedgerMock {
  constructor({ owner = "0xVOWOWNER", storePath = null } = {}) {
    this.owner = owner;
    this.storePath = storePath;
    this.isMock = true;
    this._jobs = 0;
    this.ledgers = new Map(); // namespace -> entries (append-only)
    if (storePath && existsSync(storePath)) {
      try {
        this.ledgers = new Map(JSON.parse(readFileSync(storePath, "utf8")));
      } catch {
        throw new Error("Incomplete mock ledger: persisted store is unreadable");
      }
    }
  }

  _book(ns) {
    if (!this.ledgers.has(ns)) this.ledgers.set(ns, []);
    return this.ledgers.get(ns);
  }
  _persist() {
    if (!this.storePath) return;
    try {
      mkdirSync(dirname(this.storePath), { recursive: true });
      writeFileSync(this.storePath, JSON.stringify([...this.ledgers]));
    } catch {
      throw new Error("Mock storage persistence failed");
    }
  }

  async remember(text, namespace) {
    return { job_id: `job_${++this._jobs}`, status: "accepted", namespace };
  }

  async rememberAndWait(text, namespace) {
    const book = this._book(namespace);
    const blob_id = blobIdFor(text);
    const entry = { id: `vow_${blob_id.slice(0, 8)}`, blob_id, text, ts: Date.now(), namespace };
    book.push(entry);
    this._persist();
    return { id: entry.id, blob_id, owner: this.owner, namespace };
  }

  // Complete enumeration is a MOCK trust boundary, not semantic top-k proof.
  async completeLedger(namespace) {
    if (this.storePath && existsSync(this.storePath)) {
      try { this.ledgers=new Map(JSON.parse(readFileSync(this.storePath,'utf8'))); }
      catch { throw new Error('Incomplete mock ledger: persisted store is unreadable'); }
    }
    const records = this._book(namespace).map(r => ({...r}));
    const valid = records.every(r => r.blob_id === blobIdFor(r.text));
    return {records, complete: valid, proof: valid ? {source:'mock-complete-enumeration', count:records.length} : null};
  }

  async recall({ query, namespace, limit = 500 }) {
    const rows = this._book(namespace);
    const q = new Set(String(query || "").toLowerCase().split(/\W+/).filter(Boolean));
    const scored = rows.map((r) => {
      const toks = new Set(String(r.text).toLowerCase().split(/\W+/).filter(Boolean));
      let overlap = 0;
      for (const t of q) if (toks.has(t)) overlap++;
      return { r, overlap };
    });
    scored.sort((a, b) => b.overlap - a.overlap || b.r.ts - a.r.ts);
    const hits = (query ? scored.filter((s) => s.overlap > 0) : scored).slice(0, limit).map((s) => s.r);
    return { records: hits, truncated: hits.length >= limit };
  }

  async restore(namespace) {
    const rows = this._book(namespace);
    return { restored: rows.length, skipped: 0, total: rows.length, namespace, owner: this.owner };
  }
}

export function walruscanUrl(blob_id) {
  return `https://walruscan.com/mainnet/blob/${blob_id}`;
}
