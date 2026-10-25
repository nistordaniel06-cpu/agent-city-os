'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {catalog,createCreative}=require('../creative-agency');
const {providerFromEnvironment,createAIClient}=require('../ai-provider');
const M=require('../public/agency/model');
const payload={provider:'deepseek',consent:true,brand:'4MEN',tone:'Premium',brief:'Campanie locală',kind:'reel'};
test('new providers require both explicit model and key; catalog contains no secrets',()=>{
 const env={DEEPSEEK_API_KEY:'very-secret',GEMINI_API_KEY:'gemini-secret',GEMINI_MODEL:'test-model'};
 assert.equal(catalog(env).find(p=>p.provider==='deepseek').configured,false);
 assert.equal(catalog(env).find(p=>p.provider==='gemini').configured,true);
 assert.ok(!JSON.stringify(catalog(env)).includes('secret'));
});
for(const [provider,base] of [['deepseek','https://api.deepseek.com/v1'],['gemini','https://generativelanguage.googleapis.com/v1beta/openai'],['meta','https://api.meta.ai/v1']])test(provider+' uses only its configured endpoint and secret',async()=>{
 const env={AI_PROVIDER:provider,[provider.toUpperCase()+'_API_KEY']:'provider-secret',[provider.toUpperCase()+'_MODEL']:'chosen-model',OPENAI_API_KEY:'not-used'};
 const client=createAIClient({config:providerFromEnvironment(env),fetcher:async(url,req)=>{
  assert.equal(url,base+'/chat/completions');assert.equal(req.headers.Authorization,'Bearer provider-secret');
  const body=JSON.parse(req.body);assert.equal(body.model,'chosen-model');assert.equal(body.max_tokens,1800);
  return {ok:true,json:async()=>({choices:[{message:{content:'Concept'}}],usage:{prompt_tokens:2,completion_tokens:3}})};
 }});
 assert.equal((await client.generate({instructions:'test',input:'brief',maxTokens:1800})).output,'Concept');
});
test('creative validation and missing provider block requests; attempts are limited and no fallback',async()=>{
 let calls=0;
 const service=createCreative({env:{DEEPSEEK_API_KEY:'secret',DEEPSEEK_MODEL:'chosen'},fetcher:async()=>{calls++;return {ok:false,status:429,json:async()=>({error:{message:'secret private body'}})};}});
 await assert.rejects(service.generate({...payload,consent:false}),e=>e.status===400);
 await assert.rejects(service.generate({...payload,provider:'openai'}),e=>e.status===503);
 assert.equal(calls,0);
 for(let i=0;i<6;i++)await assert.rejects(service.generate(payload),e=>e.status===429&&!e.message.includes('secret'));
 await assert.rejects(service.generate(payload),e=>e.status===429);
 assert.equal(calls,6);
});
test('creative output is explicitly unapproved, unpublished and text-only',async()=>{
 const service=createCreative({env:{DEEPSEEK_API_KEY:'secret',DEEPSEEK_MODEL:'chosen'},fetcher:async(url,req)=>{
  const body=JSON.parse(req.body);assert.match(body.messages[0].content,/NUMAI text/);
  assert.equal(JSON.parse(body.messages[1].content).brand,'4MEN');
  return {ok:true,json:async()=>({choices:[{message:{content:'Trei concepte'}}]})};
 }});
 const out=await service.generate({...payload,privateNotes:'never send'});assert.equal(out.mediaGenerated,false);assert.equal(out.approved,false);assert.equal(out.published,false);
});
test('campaign approvals cannot skip review and revisions invalidate approval',()=>{
 const c={id:'one',clientId:'4men',title:'Campanie',brief:'Brief',kind:'reel',date:'2026-10-25',output:'Text',stage:'draft'};
 assert.throws(()=>M.transition(c,'approved'));
 assert.throws(()=>M.transition(c,'published'));
 const approved=M.transition(M.transition(c,'review'),'approved');assert.equal(approved.stage,'approved');
 assert.equal(M.revise(approved,'Alt text').stage,'draft');
 assert.equal(M.transition(approved,'published').stage,'published');
 assert.throws(()=>M.transition({...c,output:''},'review'));
});
test('backup rejects malformed, duplicate and cross-client records without touching originals',()=>{
 const d=M.initial();assert.deepEqual(M.valid(d),d);
 assert.throws(()=>M.valid({...d,clients:[d.clients[0],d.clients[0]]}));
 assert.throws(()=>M.valid({...d,campaigns:[{id:'a',clientId:'missing'}]}));
 assert.throws(()=>M.valid({version:2,clients:[],campaigns:[]}));
 assert.deepEqual(d,M.initial());
});
