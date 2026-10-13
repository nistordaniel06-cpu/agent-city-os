'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const nativeFetch=globalThis.fetch;
process.env.AGENT_CITY_ACCESS_TOKEN='hunter-long-private-test-token';
process.env.OPENAI_API_KEY='mock-test-key';
let externalCalls=[];
globalThis.fetch=async(url,opts)=>{
 externalCalls.push(String(url));
 if(String(url)==='https://remoteok.com/api')return {ok:true,headers:{get:()=>null},text:async()=>JSON.stringify([{last_updated:0},{position:'Freelance UX designer',company:'Example',description:'Contract UI and web redesign',url:'https://remoteok.com/remote-jobs/mock-ux'}])};
 if(String(url).includes('weworkremotely.com/'))return {ok:true,headers:{get:()=>null},text:async()=>'<rss><channel><item><title>Contract frontend</title><link>https://weworkremotely.com/remote-jobs/mock-front</link><description>React website</description></item></channel></rss>'};
 if(String(url).includes('/v1/responses'))return {ok:true,json:async()=>({output:[{content:[{type:'output_text',text:'Proposal: I would like to discuss the scope.'}]}]})};
 throw Error('Unexpected outbound URL '+url);
};
const {server}=require('../server');
test('hunter endpoints enforce auth, only fetch public feeds, never send offers',async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const base=`http://127.0.0.1:${server.address().port}`;
  const health=await (await nativeFetch(base+'/api/health')).json();assert.equal(health.hunterConfigured,true);assert.equal(health.hunterDraftConfigured,true);
  const unauth=await nativeFetch(base+'/api/hunter/search',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(unauth.status,401);assert.equal(externalCalls.length,0);
  const auth={'Content-Type':'application/json','Authorization':'Bearer hunter-long-private-test-token'};
  const result=await nativeFetch(base+'/api/hunter/search',{method:'POST',headers:auth,body:JSON.stringify({filter:'web',query:'react'})});assert.equal(result.status,200);const json=await result.json();assert.equal(json.totalExamined,2);assert.match(json.disclaimer,/nu neapărat contracte freelance/);assert.equal(externalCalls.length,2);
  const body={opportunity:{title:'Front end site',url:'https://weworkremotely.com/remote-jobs/mock-front',description:'React frontend',source:'We Work Remotely'},profile:{name:'Demo',description:'Web freelancer',category:'web'}};
  const draft=await nativeFetch(base+'/api/hunter/draft',{method:'POST',headers:auth,body:JSON.stringify(body)});assert.equal(draft.status,200);const d=await draft.json();assert.equal(d.sent,false);assert.equal(d.delivery,'manual_only');assert.match(d.output,/scope/);
  assert.equal(externalCalls.length,3);
  const script=await nativeFetch(base+'/hunter-ui.js');assert.equal(script.status,200);assert.match(await script.text(),/Hunter UI/);
  const secret=await nativeFetch(base+'/hunter.js');assert.equal(secret.status,404);
 }finally{await new Promise(resolve=>server.close(resolve));globalThis.fetch=nativeFetch}
});
