// Original adapter. Protocol reference: SelfJev 35835e2 src/selfjev/types.py, client.py.
// This class suggests UI intent only; never grants permissions, verifies evidence or creates receipts.
export class DecisionAdvisor {
  constructor({baseUrl, apiKey, model='selfjev-4b', fetchImpl=fetch, timeoutMs=5000, minimum=0.8, margin=0.2}={}) {
    this.config={baseUrl,apiKey,model,fetchImpl,timeoutMs,minimum,margin};
    if (!Number.isFinite(timeoutMs)||timeoutMs<1||timeoutMs>30000||![minimum,margin].every(x=>Number.isFinite(x)&&x>=0&&x<=1)) throw new Error('Invalid advisor bounds');
    if(baseUrl){const u=new URL(baseUrl);if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.search||u.hash)throw new Error('Invalid operator endpoint');}
  }
  async suggest({authorizedState, options, instructions='Choose the most relevant user-intent view. Do not decide permission or truth.'}) {
    const hold=reason=>({status:'abstain',reason,authority:false});
    if(typeof authorizedState!=='string'||!authorizedState.trim()||authorizedState.length>16000||typeof instructions!=='string'||instructions.length>1000)return hold('invalid_input');
    if(!options||Object.getPrototypeOf(options)!==Object.prototype)return hold('invalid_options');
    const keys=Object.keys(options);
    if(keys.length<2||keys.length>255||keys.some(k=>!k.trim()||k.length>80||['__proto__','constructor','prototype'].includes(k)||typeof options[k]!=='string'||options[k].length>500))return hold('invalid_options');
    const c=this.config;if(!c.baseUrl)return hold('not_configured');
    try{
      const r=await c.fetchImpl(c.baseUrl.replace(/\/$/,'')+'/v1/systemone',{method:'POST',redirect:'error',signal:AbortSignal.timeout(c.timeoutMs),headers:{'Content-Type':'application/json',...(c.apiKey?{Authorization:'Bearer '+c.apiKey}:{})},body:JSON.stringify({model:c.model,state:authorizedState,questions:{intent:{type:'choice',instructions,criteria:options}}})});
      if(!r.ok)return hold('provider_unavailable');
      let text='';const decoder=new TextDecoder();for await(const chunk of r.body){text+=decoder.decode(chunk,{stream:true});if(text.length>65536)return hold('response_too_large');}text+=decoder.decode();
      const d=JSON.parse(text),a=d.answers?.intent;
      if(d.model!==c.model||a?.type!=='choice'||!keys.includes(a.choice)||!a.probabilities||!Number.isFinite(a.confidence)||a.confidence<0||a.confidence>1)return hold('invalid_response');
      const ps=Object.keys(a.probabilities);
      if(ps.length!==keys.length||ps.some(k=>!keys.includes(k)||!Number.isFinite(a.probabilities[k])||a.probabilities[k]<0||a.probabilities[k]>1))return hold('invalid_response');
      const ranked=keys.map(k=>({key:k,p:a.probabilities[k]})).sort((x,y)=>y.p-x.p);
      if(Math.abs(ranked.reduce((s,x)=>s+x.p,0)-1)>0.001||ranked[0].key!==a.choice)return hold('invalid_response');
      if(ranked[0].p<c.minimum||ranked[0].p-ranked[1].p<c.margin)return hold('uncertain');
      return {status:'suggested',choice:a.choice,probability:ranked[0].p,confidence:a.confidence,model:d.model,authority:false,calibratedForThisProduct:false};
    }catch{return hold('provider_or_protocol_error');}
  }
}
