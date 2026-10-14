'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const originalFetch=globalThis.fetch;
process.env.AI_PROVIDER='groq';
process.env.GROQ_API_KEY='groq-test-key-no-real-credential';
process.env.OPENAI_API_KEY='openai-old-not-used';
process.env.AGENT_CITY_ACCESS_TOKEN='local-only-test-long-access-token';
let calls=[];
globalThis.fetch=async(url,request)=>{
 calls.push({url:String(url),request});
 if(url!=='https://api.groq.com/openai/v1/chat/completions')throw Error('Request must never use other AI backend: '+url);
 const body=JSON.parse(request.body);
 const input=body.messages?.[1]?.content||'';
 return {ok:true,json:async()=>({choices:[{message:{content:input.includes('PROIECT:')?'Plan MVP AI via Groq':'Oferta Hunter AI via Groq'}}],usage:{prompt_tokens:26,completion_tokens:12}})};
};
const {server}=require('../server');
test('production-like HTTP runs missions and Hunter with Groq without OpenAI calls',async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const base='http://127.0.0.1:'+server.address().port;
  const health=await (await originalFetch(base+'/api/health')).json();
  assert.equal(health.aiProvider,'groq');
  assert.equal(health.aiModel,'openai/gpt-oss-20b');
  assert.equal(health.aiConfigured,true);
  assert.equal(health.hunterDraftConfigured,true);
  assert.equal(health.apiKey,undefined);
  assert.ok(!JSON.stringify(health).includes('groq-test-key'));
  const headers={'Content-Type':'application/json',Authorization:'Bearer local-only-test-long-access-token'};
  const task={project:{name:'Studio web',description:'Site-uri și automatizări',category:'software'},task:{role:'planner',title:'Scrie un plan scurt pentru clienți'}};
  const noAuth=await originalFetch(base+'/api/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(task)});
  assert.equal(noAuth.status,401);
  const response=await originalFetch(base+'/api/run',{method:'POST',headers,body:JSON.stringify(task)});
  assert.equal(response.status,200);
  const output=await response.json();
  assert.equal(output.output,'Plan MVP AI via Groq');
  assert.equal(output.provider,'groq');
  const hunterRequest={opportunity:{title:'Website pentru client',description:'Caut dezvoltator freelance React',url:'https://example.com/job/123',source:'Adăugat manual'},profile:{name:'Studio web',description:'React și API-uri',category:'software'}};
  const draft=await originalFetch(base+'/api/hunter/draft',{method:'POST',headers,body:JSON.stringify(hunterRequest)});
  assert.equal(draft.status,200);
  const proposal=await draft.json();
  assert.equal(proposal.output,'Oferta Hunter AI via Groq');
  assert.equal(proposal.provider,'groq');
  assert.equal(proposal.delivery,'manual_only');
  assert.equal(proposal.sent,false);
  assert.equal(calls.length,2);
  assert.ok(calls.every(x=>x.url.startsWith('https://api.groq.com/')));
 }finally{
  await new Promise(resolve=>server.close(resolve));
  globalThis.fetch=originalFetch;
 }
});
