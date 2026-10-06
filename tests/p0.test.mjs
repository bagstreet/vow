import test from 'node:test';
import assert from 'node:assert/strict';
import {Companion} from '../ledger/companion.mjs';
import {VowLedgerMock} from '../ledger/memwal-mock.mjs';
import {CheckinWriter} from '../ledger/write-queue.mjs';
const input={vow_id:'v',date:'2026-01-01',status:'done',note:''};
test('P0 full read build write serialized across companion instances',async()=>{
 const client=new VowLedgerMock(); const a=new Companion({client,owner:'o',mode:'mock'}); const b=new Companion({client,owner:'o',mode:'mock'});
 const out=await Promise.all([a.checkin(input),b.checkin({...input,date:'2026-01-02'})]);
 assert.deepEqual(out.map(x=>x.entry.seq),[1,2]); assert.equal((await a.audit()).decision.state,'intact');
});
test('P0 semantic prefix without trusted complete head fails closed',async()=>{
 const c=new Companion({owner:'o',mode:'mock',client:{recall:async()=>({records:[],truncated:false}),rememberAndWait:async()=>({blob_id:'a'.repeat(43)})}});
 await assert.rejects(c.checkin(input),/complete|proof/i); assert.equal((await c.audit()).decision.ok,false);
 assert.equal((await c.status('v')).summary.done,0);
});
test('P0 edited content and forged receipts never count completion',async()=>{
 for(const edit of ['content','receipt']){
  const client=new VowLedgerMock(); const c=new Companion({client,owner:'o',mode:'mock'}); await c.checkin(input);
  const r=client.ledgers.get(c.namespace)[0]; if(edit==='content'){const x=JSON.parse(r.text);x.note='edited';r.text=JSON.stringify(x);}else r.blob_id='z'.repeat(43);
  const s=await c.status('v'); assert.equal(s.decision.ok,false); assert.equal(s.summary.done,0); assert.equal(s.summary.streak,0);
 }
});
test('P0 queue survives permanent failure',async()=>{
 let n=0;const w=new CheckinWriter(async()=>{if(++n===1){const e=new Error('denied');e.status=403;throw e;}return 'ok';},{minGapMs:0,maxBackoffMs:1,maxAttempts:2});
 await assert.rejects(w.submit('a','n'));assert.equal(await w.submit('b','n'),'ok');assert.equal(n,2);
});

import {adaptMemWal,createMemWal} from '../ledger/memwal.mjs';
test('P0 published SDK root factory contract without keys or network',async()=>{
 let config,params; const sdk={recall:async p=>{params=p;return {results:[]};}};
 const x=await createMemWal({MEMWAL_KEY:'MOCK_ONLY',MEMWAL_ACCOUNT_ID:'MOCK_ONLY'},async()=>({MemWal:{create:c=>{config=c;return sdk;}}}));
 assert.equal(config.key,'MOCK_ONLY');assert.equal(config.accountId,'MOCK_ONLY');
 const r=await x.client.recall({query:'ledger',namespace:'n',limit:500});
 assert.equal(params.limit,100);assert.equal(params.query,'ledger');assert.equal(r.complete,false);
 await assert.rejects(x.client.recall({namespace:'n'}),/query/);
});
test('P0 transient retries are bounded even with retry_after',async()=>{
 let calls=0; const writer=new CheckinWriter(async()=>{calls++;const e=new Error('429');e.status=429;e.retry_after_seconds=0.001;throw e;},{minGapMs:0,maxBackoffMs:1,maxAttempts:3});
 await assert.rejects(writer.submit('x','n'));assert.equal(calls,3);
});

import {auditLedger} from '../ledger/ledger/audit.mjs';
import {linkCheckin} from '../ledger/ledger/chain.mjs';
import {honestSummary} from '../ledger/ledger/summary.mjs';
test('P0 structural chain without trusted manifest is not completion',()=>{
 const e={...linkCheckin(null,{checkin_id:'c',seq:1,vow_id:'v',date:'2026-01-01',status:'done',ts:1}),receipt:{blob_id:'a'.repeat(43)}};
 const d=auditLedger([e]);assert.equal(d.ok,false);assert.equal(d.summary.done,0);
});
test('P0 standalone summary does not count edited content',()=>{
 const e={...linkCheckin(null,{checkin_id:'c',seq:1,vow_id:'v',date:'2026-01-01',status:'missed',ts:1}),receipt:{blob_id:'a'.repeat(43)}};
 e.status='done';assert.equal(honestSummary([e]).done,0);
});

import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('P0 two mock clients sharing persisted ledger serialize head updates',async()=>{
 const storePath=join(mkdtempSync(join(tmpdir(),'vow-p0-')),'ledger.json');
 const a=new Companion({client:new VowLedgerMock({storePath}),owner:'o',mode:'mock'});
 const b=new Companion({client:new VowLedgerMock({storePath}),owner:'o',mode:'mock'});
 const out=await Promise.all([a.checkin(input),b.checkin({...input,date:'2026-01-02'})]);
 assert.deepEqual(out.map(x=>x.entry.seq),[1,2]); assert.equal((await a.audit()).decision.state,'intact');
});
