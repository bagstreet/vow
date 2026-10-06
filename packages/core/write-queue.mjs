// Bounded transient retries; rejected writes never poison the queue.
const sleep = ms => new Promise(r => setTimeout(r, ms));
function retryAfter(e) {
 try { return Number(JSON.parse(e.cause).retry_after_seconds) || 0; } catch { return Number(e.retry_after_seconds) || 0; }
}
export class CheckinWriter {
 constructor(writeFn, {minGapMs=400,maxBackoffMs=1000,maxAttempts=3}={}) {
  this.writeFn=writeFn; this.minGapMs=minGapMs; this.maxBackoffMs=maxBackoffMs;
  this.maxAttempts=Math.max(1,Math.min(5,maxAttempts)); this._tail=Promise.resolve(); this._lastAt=0;
 }
 submit(text,namespace) {
  const result=this._tail.then(()=>this._one(text,namespace));
  this._tail=result.catch(()=>{}); return result;
 }
 async _one(text,namespace) {
  const gap=this.minGapMs-(Date.now()-this._lastAt); if(gap>0)await sleep(gap);
  for(let attempt=1;attempt<=this.maxAttempts;attempt++) {
   try { const result=await this.writeFn(text,namespace);this._lastAt=Date.now();return result; }
   catch(e) {
    const status=Number(e.status||e.statusCode||e.response?.status);
    const retryable=status===429||status>=500||['ECONNRESET','ETIMEDOUT','EAI_AGAIN'].includes(e.code)||(!status && /429|503|temporar|timeout/i.test(e.message));
    if(!retryable||attempt===this.maxAttempts)throw e;
    const ra=retryAfter(e);await sleep(Math.min(this.maxBackoffMs,ra>0?ra*1000:100*2**(attempt-1)));
   }
  }
 }
}
