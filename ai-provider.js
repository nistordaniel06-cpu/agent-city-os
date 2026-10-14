'use strict';
/**
 * Small server-side AI provider adapter. Never exports or logs credentials.
 * Groq uses Chat Completions; OpenAI retains Responses for backwards compatibility.
 * No automatic fallback between providers (prevents accidental paid calls).
 */
const GROQ_BASE='https://api.groq.com/openai/v1';
const DEFAULT_GROQ_MODEL='openai/gpt-oss-20b';

function providerFromEnvironment(env=process.env){
 const explicit=String(env.AI_PROVIDER||'').trim().toLowerCase();
 const provider=explicit|| (env.GROQ_API_KEY?'groq':'openai');
 if(!['groq','openai'].includes(provider))return {provider,enabled:false,model:'',error:'AI_PROVIDER trebuie să fie groq sau openai.'};
 const groq=provider==='groq';
 const apiKey=groq?env.GROQ_API_KEY:env.OPENAI_API_KEY;
 const model=groq?(env.GROQ_MODEL||DEFAULT_GROQ_MODEL):(env.OPENAI_MODEL||'gpt-5-mini');
 const apiBase=groq?GROQ_BASE:String(env.OPENAI_API_BASE_URL||'https://api.openai.com').replace(/\/$/,'')+'/v1';
 return {provider,model,apiKey:apiKey||'',apiBase,enabled:!!apiKey,
  error:apiKey?'':('Configurează '+(groq?'GROQ_API_KEY':'OPENAI_API_KEY')+' în Vercel / pe server.')};
}

function extractResponseText(response){
 return (response?.output||[]).flatMap(item=>(item.content||[]).filter(part=>part.type==='output_text').map(part=>part.text||'')).join('\n').trim();
}
function normalUsage(usage){
 if(!usage)return null;
 return {
  input_tokens:usage.input_tokens??usage.prompt_tokens??0,
  output_tokens:usage.output_tokens??usage.completion_tokens??0
 };
}
function createAIClient({config=providerFromEnvironment(),fetcher=globalThis.fetch}={}){
 const enabled=()=>config.enabled===true;
 async function generate({instructions,input,maxTokens=2200,jsonSchema=null,timeoutMs=90000}){
  if(!enabled())throw Object.assign(new Error(config.error||'Furnizor AI neconfigurat.'),{status:503});
  const isGroq=config.provider==='groq';
  const endpoint=config.apiBase.replace(/\/$/,'')+(isGroq?'/chat/completions':'/responses');
  const body=isGroq
   ? {model:config.model,messages:[
      {role:'system',content:instructions+(jsonSchema?'\nReturnează numai un obiect JSON valid, fără markdown.':'')},
      {role:'user',content:input}
     ],max_completion_tokens:maxTokens,stream:false,...(jsonSchema?{response_format:{type:'json_object'}}:{})}
   : {model:config.model,instructions,input,max_output_tokens:maxTokens,store:false,
      ...(jsonSchema?{text:{format:{type:'json_schema',name:'github_change_proposal',strict:true,schema:jsonSchema}}}:{})};
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
   const response=await fetcher(endpoint,{
    method:'POST',signal:controller.signal,headers:{Authorization:'Bearer '+config.apiKey,'Content-Type':'application/json'},
    body:JSON.stringify(body)
   });
   let json={};try{json=await response.json()}catch{}
   if(!response.ok){
    const errCode=response.status;
    const detail=String(json?.error?.message||'').slice(0,160);
    const summary=errCode===429&&isGroq?'Limita gratuită Groq a fost atinsă. Încearcă mai târziu sau verifică limitele contului.':
     errCode===401?'Cheie API respinsă. Verifică variabila secretă din Vercel.':
     'Furnizorul '+(isGroq?'Groq':'OpenAI')+' a returnat HTTP '+errCode+(detail?': '+detail:'');
    throw Object.assign(new Error(summary),{status:errCode===429?429:502});
   }
   const output=isGroq?String(json?.choices?.[0]?.message?.content||'').trim():extractResponseText(json);
   if(!output)throw Object.assign(new Error('Modelul '+config.provider+' nu a returnat text. Încearcă un alt model sau o sarcină mai scurtă.'),{status:502});
   return {output,usage:normalUsage(json.usage),provider:config.provider,model:config.model};
  }finally{clearTimeout(timer)}
 }
 return {provider:config.provider,model:config.model,enabled,generate};
}
module.exports={GROQ_BASE,DEFAULT_GROQ_MODEL,providerFromEnvironment,extractResponseText,normalUsage,createAIClient};
