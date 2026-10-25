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
 const definitions={
  groq:{key:'GROQ_API_KEY',model:env.GROQ_MODEL||DEFAULT_GROQ_MODEL,base:GROQ_BASE},
  openai:{key:'OPENAI_API_KEY',model:env.OPENAI_MODEL||'gpt-5-mini',base:String(env.OPENAI_API_BASE_URL||'https://api.openai.com').replace(/\/$/,'')+'/v1'},
  deepseek:{key:'DEEPSEEK_API_KEY',model:env.DEEPSEEK_MODEL||'',base:'https://api.deepseek.com/v1'},
  gemini:{key:'GEMINI_API_KEY',model:env.GEMINI_MODEL||'',base:'https://generativelanguage.googleapis.com/v1beta/openai'},
  meta:{key:'META_API_KEY',model:env.META_MODEL||'',base:'https://api.meta.ai/v1'}
 };
 if(!Object.hasOwn(definitions,provider))return {provider,enabled:false,model:'',error:'Furnizor AI necunoscut.'};
 const d=definitions[provider],apiKey=env[d.key]||'';
 return {provider,model:d.model,apiKey,apiBase:d.base,enabled:!!apiKey&&!!d.model,
  error:!apiKey?'Configurează '+d.key+' pe server.':!d.model?'Configurează '+provider.toUpperCase()+'_MODEL pe server.':''};
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
  const isGroq=config.provider==='groq',isChat=config.provider!=='openai';
  const endpoint=config.apiBase.replace(/\/$/,'')+(isChat?'/chat/completions':'/responses');
  const body=isChat
   ? {model:config.model,messages:[
      {role:'system',content:instructions+(jsonSchema?'\nReturnează numai un obiect JSON valid, fără markdown.':'')},
      {role:'user',content:input}
     ],...(isGroq?{max_completion_tokens:maxTokens}:{max_tokens:maxTokens}),stream:false,...(jsonSchema?{response_format:{type:'json_object'}}:{})}
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
    // Never surface provider bodies: they may echo private input or credentials.
    const summary=errCode===429&&isGroq?'Limita gratuită Groq a fost atinsă. Încearcă mai târziu sau verifică limitele contului.':
     errCode===401?'Cheie API respinsă. Verifică variabila secretă din Vercel.':
     'Furnizorul '+config.provider+' a returnat HTTP '+errCode;
    throw Object.assign(new Error(summary),{status:errCode===429?429:502});
   }
   const output=isChat?String(json?.choices?.[0]?.message?.content||'').trim():extractResponseText(json);
   if(!output)throw Object.assign(new Error('Modelul '+config.provider+' nu a returnat text. Încearcă un alt model sau o sarcină mai scurtă.'),{status:502});
   return {output,usage:normalUsage(json.usage),provider:config.provider,model:config.model};
  }finally{clearTimeout(timer)}
 }
 return {provider:config.provider,model:config.model,enabled,generate};
}
module.exports={GROQ_BASE,DEFAULT_GROQ_MODEL,providerFromEnvironment,extractResponseText,normalUsage,createAIClient};

