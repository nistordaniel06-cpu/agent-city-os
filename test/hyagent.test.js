'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {hyagentConfig,verifyTranslation,createHyAgent}=require('../hyagent');

const INPUT={text:'Bună ziua, aș dori o ofertă.',sourceLanguage:'Romanian',targetLanguage:'English',style:'business'};
test('HyAgent is opt-in: never pretends that model is installed on Vercel',()=>{
 const config=hyagentConfig({});
 assert.equal(config.enabled,false);
 assert.match(config.error,/HYAGENT_API_BASE_URL/);
 assert.equal(config.model,'tencent/Hy-MT2-1.8B');
 assert.equal(verifyTranslation(INPUT),null);
});
test('rejects private, insecure or credential-bearing remote inference endpoints',()=>{
 for(const url of ['http://example.com/v1','http://127.0.0.1:9000/v1','https://localhost/v1','https://192.168.1.10/v1','https://user:password@example.com/v1','https://foo.internal/v1','https://127.0.0.1/v1','file:///tmp/secret','https://example.com/v1?token=secret']){
  assert.equal(hyagentConfig({HYAGENT_API_BASE_URL:url}).enabled,false,url);
 }
});
test('uses only approved Hy-MT2 endpoint, model and optional service key',async()=>{
 const config=hyagentConfig({HYAGENT_API_BASE_URL:'https://translation.example/v1',HYAGENT_MODEL:'tencent/Hy-MT2-7B',HYAGENT_API_KEY:'hy-test-key'});
 assert.equal(config.enabled,true);
 let calls=0;
 const client=createHyAgent({config,fetcher:async(url,opts)=>{
  calls++;
  assert.equal(url,'https://translation.example/v1/chat/completions');
  assert.equal(opts.redirect,'error');
  assert.equal(opts.headers.Authorization,'Bearer hy-test-key');
  const body=JSON.parse(opts.body);
  assert.equal(body.model,'tencent/Hy-MT2-7B');
  assert.equal(body.messages[1].content,INPUT.text);
  assert.match(body.messages[0].content,/English/);
  assert.equal(body.stream,false);
  return {ok:true,json:async()=>({choices:[{message:{content:'Hello, I would like a quote.'}}],usage:{prompt_tokens:23,completion_tokens:9}})};
 }});
 const result=await client.translate(INPUT);
 assert.equal(calls,1);
 assert.equal(result.provider,'hyagent');
 assert.equal(result.translation,'Hello, I would like a quote.');
 assert.equal(result.usage.output_tokens,9);
});
test('invalid input and missing inference server never make external requests or Groq fallback',async()=>{
 let requests=0;
 const client=createHyAgent({config:hyagentConfig({}),fetcher:async()=>{requests++;throw Error('MUST NOT CALL')}});
 await assert.rejects(client.translate(INPUT),err=>err.status===503);
 await assert.rejects(client.translate({...INPUT,text:' '.repeat(6)}),err=>err.status===400);
 await assert.rejects(client.translate({...INPUT,sourceLanguage:'../../../../etc/passwd'}),err=>err.status===400);
 assert.equal(requests,0);
});
test('upstream rate limits remain explicit, no other AI provider is tried',async()=>{
 const client=createHyAgent({config:hyagentConfig({HYAGENT_API_BASE_URL:'https://translation.example/v1'}),fetcher:async()=>({ok:false,status:429,json:async()=>({error:'quota'})})});
 await assert.rejects(client.translate(INPUT),err=>err.status===429);
});
