// Published SDK 0.1.8 root entry; no /ai class construction or Seal-session fiction.
import { VowLedgerMock, walruscanUrl } from './memwal-mock.mjs';
export {walruscanUrl};
const BLOB_RE=/^[A-Za-z0-9_-]{43}$/;
export function isReceipt(r) {return !!(r && typeof r.blob_id==='string' && BLOB_RE.test(r.blob_id));}
export function adaptMemWal(sdk) {
 return {
  rememberAndWait:(text,namespace)=>sdk.rememberAndWait(text,namespace,{timeoutMs:15000,pollIntervalMs:250}),
  async recall({query,namespace,limit=100}) {
   if(typeof query!=='string'||!query.trim())throw new Error('Recall requires query');
   const cap=Math.max(1,Math.min(100,Math.floor(limit)||100));
   const result=await sdk.recall({query,namespace,limit:cap});
   if(!Array.isArray(result.results))throw new Error('Invalid SDK recall results');
   return {records:result.results,complete:false,truncated:true,proof:null};
  },
  restore:namespace=>sdk.restore(namespace)
 };
}
export async function createMemWal(env=process.env, load=()=>import('@mysten-incubation/memwal')) {
  if (env.NODE_ENV === 'production' && (!env.MEMWAL_MODE || env.MEMWAL_MODE === 'mock')) throw new Error('Production requires explicit live MemWal mode; mock is demo only');

 if(env.MEMWAL_SEAL_SESSION)throw new Error('Legacy Seal session unsupported: use SDK 0.1.8 key/accountId configuration');
 if(!env.MEMWAL_KEY && !env.MEMWAL_ACCOUNT_ID)return {client:new VowLedgerMock({storePath:env.VOW_STORE||null}),mode:'mock'};
 if(!env.MEMWAL_KEY || !env.MEMWAL_ACCOUNT_ID)throw new Error('Both MEMWAL_KEY and MEMWAL_ACCOUNT_ID are required');
 const {MemWal}=await load();
 const sdk=MemWal.create({key:env.MEMWAL_KEY,accountId:env.MEMWAL_ACCOUNT_ID,requestTimeoutMs:15000});
 return {client:adaptMemWal(sdk),mode:'relayer-unverified'};
}
