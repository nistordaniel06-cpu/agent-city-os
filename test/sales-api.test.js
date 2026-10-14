'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const request=globalThis.fetch;
process.env.AI_PROVIDER='groq';
process.env.GROQ_API_KEY='groq-simulated-not-real';
process.env.AGENT_CITY_ACCESS_TOKEN='test-sales-owner-token-over-32-characters';
const apiCalls=[];
globalThis.fetch=async (url,opts)=>{
 if(url!=='https://api.groq.com/openai/v1/chat/completions')throw Error('No other AI provider allowed: '+url);
 apiCalls.push({url,opts,body:JSON.parse(opts.body)});
 return {ok:true,json:async()=>({choices:[{message:{content:'OFERTĂ PENTRU REVIZUIRE MANUALĂ. Nicio expediere.'}}],usage:{prompt_tokens:120,completion_tokens:100}})};
};
const {server}=require('../server');
test('owner Sales API rejects anonymous proposals and returns package prices',async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const headers={Authorization:'Bearer test-sales-owner-token-over-32-characters','Content-Type':'application/json'};
 try{
  const anonymous=await request(base+'/api/admin/sales/packages');
  assert.equal(anonymous.status,401);
  const packages=await request(base+'/api/admin/sales/packages',{headers:{Authorization:'Bearer wrong'}});
  assert.equal(packages.status,401);
  const catalog=await request(base+'/api/admin/sales/packages',{headers});
  assert.equal(catalog.status,200);
  const contents=await catalog.json();
  assert.equal(contents.packages[0].setupRon,1490);
  assert.equal(contents.packages[1].setupRon,2990);
  assert.equal(contents.storage,'encrypted-local-browser');
  const proposal={consent:true,company:'Studio demo',recipient:'Owner',requirements:'Doresc o pagină cu servicii, WhatsApp și programări',estimate:{packageId:'GROW',extras:[],extraWorkRon:0,discountRon:0,internalCostRon:700,advancePercent:50}};
  const deny=await request(base+'/api/admin/sales/draft',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(proposal)});
  assert.equal(deny.status,401);
  const noConsent=await request(base+'/api/admin/sales/draft',{method:'POST',headers,body:JSON.stringify({...proposal,consent:false})});
  assert.equal(noConsent.status,400);
  assert.equal(apiCalls.length,0);
  const valid=await request(base+'/api/admin/sales/draft',{method:'POST',headers,body:JSON.stringify(proposal)});
  assert.equal(valid.status,200);
  const data=await valid.json();
  assert.equal(data.approved,false);assert.equal(data.sent,false);
  assert.equal(data.estimate.setupRon,2990);
  assert.equal(data.estimate.advanceRon,1495);
  assert.equal(data.provider,'groq');
  assert.match(data.draft,/REVIZUIRE MANUALĂ/);
  assert.equal(apiCalls.length,1);
  assert.equal(apiCalls[0].body.messages[1].role,'user');
  assert.match(apiCalls[0].body.messages[0].content,/nu contactezi clienți/i);
  assert.doesNotMatch(JSON.stringify(apiCalls[0].body),/groq-simulated-not-real/);
  for(let i=0;i<2;i++){
   const other=await request(base+'/api/admin/sales/draft',{method:'POST',headers,body:JSON.stringify(proposal)});
   assert.equal(other.status,200);
  }
  const limited=await request(base+'/api/admin/sales/draft',{method:'POST',headers,body:JSON.stringify(proposal)});
  assert.equal(limited.status,429);
  assert.equal(apiCalls.length,3);
 }finally{
  await new Promise(resolve=>server.close(resolve));
  globalThis.fetch=request;
 }
});
