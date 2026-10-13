'use strict';
/** Read-only connector for the official Freelancer.com active-projects API.
 * Requires OAuth token supplied server-side. No bidding, messaging or writes. */
const crypto=require('node:crypto');
const API='https://www.freelancer.com/api/projects/0.1/projects/active/';
const ROOT='https://www.freelancer.com';
function clean(s,max=1200){return String(s??'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,max)}
function num(x){if(x===undefined||x===null||x==='')return null;const v=Number(x);return Number.isFinite(v)&&v>=0?v:null}
function normalizeFreelancer(json){
 if(!json || json.status==='error' || !json.result || !Array.isArray(json.result.projects))throw new Error('Răspuns Freelancer.com nevalid.');
 return json.result.projects.slice(0,75).map(p=>{
  if(!p || (!Number.isSafeInteger(Number(p.id)) && !p.seo_url))return null;
  const id=Number.isSafeInteger(Number(p.id))?String(p.id):'';
  const seo=String(p.seo_url||'');
  const path=/^[a-zA-Z0-9][a-zA-Z0-9/_-]{1,180}$/.test(seo)&&!seo.includes('..')?seo:'';
  const url=path?`${ROOT}/projects/${path.replace(/^projects\//,'')}`:id?`${ROOT}/projects/${id}`:'';
  if(!url)return null;
  const min=num(p.budget?.minimum),max=num(p.budget?.maximum);
  const currency=clean(p.currency?.code||p.currency?.name||'',10).replace(/[^A-Z]/gi,'');
  const rawTime=num(p.time_submitted||p.time_updated);
  const date=rawTime?new Date(rawTime*1000):null;
  return {
   id:'freelancer:'+crypto.createHash('sha256').update(url).digest('hex').slice(0,20),
   source:'Freelancer.com', title:clean(p.title,220),company:'Client pe Freelancer.com',url,
   description:clean(p.preview_description||p.description||p.full_description,1800),
   tags:Array.isArray(p.jobs)?p.jobs.slice(0,12).map(j=>clean(j.name,60)).filter(Boolean):[],
   postedAt:date&&Number.isFinite(date.getTime())?date.toISOString():null,
   kind:'marketplace-project',
   budget:min!==null||max!==null?{minimum:min,maximum:max,currency:currency||'nespecificată',unit:p.type==='HOURLY'?'orar':'proiect (de verificat)'}:null,
   pay:null
  };
 }).filter(p=>p&&p.title);
}
async function fetchFreelancer({fetcher=globalThis.fetch,token,query='',limit=35}={}){
 if(!token)throw Object.assign(new Error('FLN_OAUTH_TOKEN lipsește; conectează OAuth de pe server.'),{status:503});
 if(typeof query!=='string'||query.trim().length<2||query.length>90)throw Object.assign(new Error('Pentru Freelancer.com introdu minimum 2 caractere în căutare.'),{status:400});
 const url=new URL(API); url.searchParams.set('query',query.trim());url.searchParams.set('limit',String(Math.min(50,Math.max(1,limit))));
 url.searchParams.set('offset','0');
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);
 try{
  const resp=await fetcher(url.toString(),{method:'GET',signal:controller.signal,headers:{'Accept':'application/json','Freelancer-OAuth-V1':token,'User-Agent':'AgentCityOS/5.0 (read-only project research)'}});
  if(!resp.ok)throw Error(`Freelancer.com HTTP ${resp.status}`);
  const len=Number(resp.headers?.get?.('content-length')||0);if(len>2_000_000)throw Error('Răspuns prea mare');
  const raw=await resp.text();if(Buffer.byteLength(raw)>2_000_000)throw Error('Răspuns prea mare');
  return normalizeFreelancer(JSON.parse(raw));
 }finally{clearTimeout(timer)}
}
module.exports={API,normalizeFreelancer,fetchFreelancer};
