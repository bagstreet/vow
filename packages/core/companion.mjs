// companion.mjs — Vow's application API (used by the CLI, the MCP server, the demo).
//
// A vow (the commitment) and each check-in are stored as durable records. Check-ins form
// ONE append-only hash chain per owner: each new one links onto the last, so the whole
// ledger is tamper-evident. On a fresh session the chain is rebuilt from recall (blob_ids
// reattached), and the audit proves it was never quietly rewritten.

import { randomUUID } from "node:crypto";
import { createMemWal, isReceipt, walruscanUrl } from "./memwal.mjs";
import { ledgerNamespace } from "./keys.mjs";
import { GENESIS, linkCheckin } from "./ledger/chain.mjs";
import { auditLedger } from "./ledger/audit.mjs";
import { honestSummary } from "./ledger/summary.mjs";
import { CheckinWriter } from "./write-queue.mjs";

// Single-process lock shared by all instances using the same client/namespace.
// Remote adapter cannot prove complete heads, so writes fail closed (no distributed CAS claim).
const locks = new WeakMap();
const persistedLocks = new Map();
function serialize(client, namespace, work) {
 let map;
 if (client.isMock && client.storePath) {
  map=persistedLocks.get(client.storePath);if(!map){map=new Map();persistedLocks.set(client.storePath,map);}
 } else {map=locks.get(client);if(!map){map=new Map();locks.set(client,map);}}
 const result=(map.get(namespace)||Promise.resolve()).then(work);
 map.set(namespace,result.catch(()=>{}));return result;
}
const VTAG = "vow.vow.v1";
const CTAG = "vow.checkin.v1";
const enc = (tag, r) => JSON.stringify({ __tag: tag, ...r });
function dec(tag, text) {
  try {
    const o = JSON.parse(text);
    if (o && o.__tag === tag) {
      const { __tag, ...rest } = o;
      return rest;
    }
  } catch {
    /* not this type */
  }
  return null;
}

export class Companion {
  constructor({ client, owner, mode }) {
    this.client = client;
    this.owner = owner;
    this.namespace = ledgerNamespace(owner);
    this.mode = mode;
    this.ownerAddr = client.owner || "0xVOWOWNER";
    this.writer = new CheckinWriter((t, ns) => this.client.rememberAndWait(t, ns));
  }

  static async open({ owner, env = process.env }) {
    const { client, mode } = await createMemWal(env);
    return new Companion({ client, owner, mode });
  }

  async makeVow(input) {
    const vow = {
      vow_id: input.vow_id || `vow:${randomUUID().slice(0, 6)}`,
      owner: this.owner,
      title: input.title || "",
      cadence: input.cadence || "daily",
      target: input.target || null,
      created_at: input.created_at || Date.now(),
    };
    const receipt = await this.writer.submit(enc(VTAG, vow), this.namespace);
    const ok = isReceipt(receipt);
    return {
      vow,
      receipt: ok ? { blob_id: receipt.blob_id, walruscan: this.mode === "mock" ? null : walruscanUrl(receipt.blob_id), durable: this.mode !== "mock", mocked: this.mode === "mock", confirmed: true } : { durable: false, note: "NOT a receipt" },
      mode: this.mode,
    };
  }

  // All check-ins for this owner, in chain order, with their receipts reattached.
  async recallCheckins() {
    if (typeof this.client.completeLedger !== 'function') return {entries:[],complete:false};
    const result=await this.client.completeLedger(this.namespace);
    if (result.complete !== true || !result.proof) return {entries:[],complete:false};
    const entries=result.records.map(r=>{const c=dec(CTAG,r.text);return c?{...c,receipt:{blob_id:r.blob_id}}:null;}).filter(Boolean).sort((a,b)=>a.seq-b.seq);
    const receipts=new Map(entries.map(e=>[e.checkin_id, {seq:e.seq,hash:e.hash,blob_id:e.receipt.blob_id}]));
    const completeProof={count:entries.length,headHash:entries.at(-1)?.hash || GENESIS,
      verifyReceipt:e=>{const expected=receipts.get(e.checkin_id);return !!expected && expected.seq===e.seq && expected.hash===e.hash && expected.blob_id===e.receipt?.blob_id;}};
    return {entries,complete:true,completeProof};
  }

  // Append a check-in onto the chain and store it (honest receipt).
  async checkin(input) {
    return serialize(this.client,this.namespace,()=>this._checkin(input));
  }
  async _checkin(input) {
    const { entries, complete, completeProof } = await this.recallCheckins();
    if (!complete) throw new Error('Complete trusted ledger proof unavailable');
    if (entries.length && !auditLedger(entries,{completeProof}).ok) throw new Error('Ledger integrity proof failed');
    const last = entries[entries.length - 1] || null;
    const seq = (last ? last.seq : 0) + 1;
    const entry = linkCheckin(last, {
      checkin_id: input.checkin_id || `ci-${seq}`,
      seq,
      vow_id: input.vow_id,
      date: input.date,
      status: input.status,
      note: input.note || "",
      supersedes: input.supersedes || null,
      ts: input.ts || Date.now(),
    });
    const receipt = await this.writer.submit(enc(CTAG, entry), this.namespace);
    const ok = isReceipt(receipt);
    if (!ok) throw new Error("Write receipt proof unavailable");
    return {
      entry: { ...entry, receipt: ok ? { blob_id: receipt.blob_id } : null },
      receipt: ok ? { blob_id: receipt.blob_id, walruscan: this.mode === "mock" ? null : walruscanUrl(receipt.blob_id), durable: this.mode !== "mock", mocked: this.mode === "mock", confirmed: true } : { durable: false, note: "NOT a receipt" },
      mode: this.mode,
    };
  }

  async audit() {
    const {entries,complete,completeProof}=await this.recallCheckins();
    return {decision:complete?auditLedger(entries,{completeProof}):{state:'unproven',code:'complete-proof-unavailable',ok:false,lead:'VOW: unproven — complete-proof-unavailable'},count:entries.length,mode:this.mode};
  }

  async status(vow_id) {
    const {entries,complete,completeProof}=await this.recallCheckins();
    const decision=complete?auditLedger(entries,{completeProof}):{state:'unproven',code:'complete-proof-unavailable',ok:false,lead:'VOW: unproven — complete-proof-unavailable'};
    const summary=decision.ok?honestSummary(entries.filter(e=>e.vow_id===vow_id),{verified:true}):{total:0,done:0,missed:0,streak:0,receipts:0};
    return {decision,summary,mode:this.mode};
  }

  async restore() {
    return this.client.restore(this.namespace);
  }
}

// CI exit codes for Vow's 4-state audit.
export const EXIT = { intact: 0, tampered: 1, unproven: 2, empty: 3 };
export function exitCodeFor(state) {
  return EXIT[state] ?? 1;
}
