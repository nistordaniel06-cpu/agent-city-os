'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {providerFromEnvironment,createAIClient,DEFAULT_GROQ_MODEL}=require('../ai-provider');

test('explicit Groq provider uses only Groq key and model, never silently OpenAI',async()=>{
 const settings=providerFromEnvironment({
  AI_PROVIDER:'groq',GROQ_API_KEY:'groq-test-only',OPENAI_API_KEY:'openai-test-only'
 });
 assert.equal(settings.provider,'groq');
 assert.equal(settings.model,DEFAULT_GROQ_MODEL);
 assert.equal(settings.enabled,true);
 let calls=0;
 const client=createAIClient({config:settings,fetcher:async(url,request)=>{
  calls++;assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(request.headers.Authorization,'Bearer groq-test-only');
  const body=JSON.parse(request.body);
  assert.equal(body.messages[0].role,'system');
  assert.equal(body.messages[1].role,'user');
  assert.equal(body.messages[1].content,'Scrie ofertă');
  assert.equal(body.model,DEFAULT_GROQ_MODEL);
  assert.equal(body.max_completion_tokens,350);
  assert.equal(body.stream,false);
  assert.equal(body.store,undefined);
  return {ok:true,json:async()=>({
   choices:[{message:{role:'assistant',content:'Oferta se pregătește manual.'}}],
   usage:{prompt_tokens:12,completion_tokens:25}
  })};
 }});
 const response=await client.generate({instructions:'Nu trimite mesaje.',input:'Scrie ofertă',maxTokens:350});
 assert.equal(calls,1);
 assert.equal(response.output,'Oferta se pregătește manual.');
 assert.equal(response.usage.input_tokens,12);
 assert.equal(response.usage.output_tokens,25);
 assert.equal(response.provider,'groq');
});

test('Groq selected but key missing fails closed without charging OpenAI',async()=>{
 const config=providerFromEnvironment({AI_PROVIDER:'groq',OPENAI_API_KEY:'openai-test-only'});
 assert.equal(config.enabled,false);
 let contacted=false;
 const client=createAIClient({config,fetcher:async()=>{contacted=true;throw Error('should not call')}});
 await assert.rejects(client.generate({instructions:'a',input:'b'}),/GROQ_API_KEY/);
 assert.equal(contacted,false);
});

test('Groq rate-limit 429 is explicit and never retries through OpenAI',async()=>{
 const config=providerFromEnvironment({AI_PROVIDER:'groq',GROQ_API_KEY:'g'});
 let contacted=0;
 const client=createAIClient({config,fetcher:async()=>{
  contacted++;
  return {ok:false,status:429,json:async()=>({error:{message:'Rate limit reached'}})};
 }});
 await assert.rejects(client.generate({instructions:'a',input:'b'}),e=>e.status===429&&/limita gratuită Groq/i.test(e.message));
 assert.equal(contacted,1);
});

test('OpenAI remains opt-in and keeps Responses API format',async()=>{
 const config=providerFromEnvironment({AI_PROVIDER:'openai',OPENAI_API_KEY:'openai-key'});
 const client=createAIClient({config,fetcher:async(url,request)=>{
  assert.equal(url,'https://api.openai.com/v1/responses');
  const body=JSON.parse(request.body);
  assert.equal(body.store,false);
  assert.equal(body.instructions,'system');
  assert.equal(body.input,'input');
  return {ok:true,json:async()=>({output:[{type:'message',content:[{type:'output_text',text:'Răspuns OpenAI'}]}],usage:{input_tokens:3,output_tokens:7}})};
 }});
 const output=await client.generate({instructions:'system',input:'input'});
 assert.equal(output.output,'Răspuns OpenAI');
 assert.equal(output.model,'gpt-5-mini');
});

test('auto-detect selects Groq with a key, without exposing key in selected metadata',()=>{
 const config=providerFromEnvironment({GROQ_API_KEY:'private-groq',OPENAI_API_KEY:'private-openai'});
 assert.equal(config.provider,'groq');
 assert.equal(config.apiBase,'https://api.groq.com/openai/v1');
 assert.ok(!JSON.stringify({provider:config.provider,model:config.model}).includes('private'));
});
