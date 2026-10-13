/** Private, no-dependency Node server for Agent City OS.
 * It offers authenticated, explicit AI draft runs only: no shell, GitHub writes,
 * payment, email, web browsing, cron, or autonomous background tasks. */
'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {URL}=require('node:url');
const {createDeveloper}=require('./github-developer');
const {createHunter}=require('./hunter');
const {estimate}=require('./estimator');

const HOST=process.env.HOST||'127.0.0.1';
const PORT=Number(process.env.PORT||3000);
const ACCESS_TOKEN=process.env.AGENT_CITY_ACCESS_TOKEN||'';
const API_KEY=process.env.OPENAI_API_KEY||'';
const MODEL=process.env.OPENAI_MODEL||'gpt-5-mini';
const API_BASE=(process.env.OPENAI_API_BASE_URL||'https://api.openai.com').replace(/\/$/,'');
const MAX_RUNS_PER_DAY=Math.max(1,Math.min(100,Number(process.env.MAX_RUNS_PER_DAY||15)));
let activeRun=false;
const runTimes=[];
const VALID_ROLES={
 planner:'Strategic planning: actionable roadmaps, constraints, risk assessment, priorities, deliverables.',
 developer:'Software planning and implementation drafts: architecture, code examples, security, tests; never claim code was run.',
 researcher:'Research strategy and structured analysis. Never invent sources, project listings or real-time facts; clearly flag what requires verification.',
 marketer:'Marketing concepts, positioning, campaigns and client outreach drafts; never claim publication or outreach.',
 qa:'Critical review, testing plans, failure cases and concrete improvements. Never claim tests ran.',
 operator:'Operational SOPs, cost-conscious workflows, checklists and owner approvals.'
};
const developer=createDeveloper({githubToken:process.env.GITHUB_TOKEN||'',githubOwner:process.env.GITHUB_OWNER||'',openaiKey:API_KEY,apiBase:API_BASE,model:MODEL});
const hunter=createHunter({openaiKey:API_KEY,freelancerToken:process.env.FLN_OAUTH_TOKEN||'',apiBase:API_BASE,model:MODEL});
const STATIC={'/':['index.html','text/html; charset=utf-8'],'/index.html':['index.html','text/html; charset=utf-8'],'/multiproject.js':['multiproject.js','application/javascript; charset=utf-8'],'/hunter-ui.js':['hunter-ui.js','application/javascript; charset=utf-8']};
function send(res,status,data,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer',...headers});res.end(JSON.stringify(data))}
function sameToken(provided){if(!provided||!ACCESS_TOKEN)return false;const a=Buffer.from(provided),b=Buffer.from(ACCESS_TOKEN);return a.length===b.length&&crypto.timingSafeEqual(a,b)}
function validatePayload(d){
 if(!d||typeof d!=='object'||Array.isArray(d)||!d.project||!d.task) return 'Proiectul și sarcina sunt obligatorii.';
 const p=d.project,t=d.task;
 if(typeof p.name!=='string'||!p.name.trim()||p.name.length>90)return 'Nume proiect invalid.';
 if(typeof p.description!=='string'||p.description.length>2500)return 'Descriere prea lungă.';
 if(typeof p.category!=='string'||p.category.length>32)return 'Categorie invalidă.';
 if(typeof t.title!=='string'||!t.title.trim()||t.title.length>4000)return 'Instrucțiuni invalide.';
 if(!Object.hasOwn(VALID_ROLES,t.role))return 'Rolul agentului este invalid.';
 return null;
}
function extractOutput(response){
 return (response.output||[]).flatMap(item=>(item.content||[]).filter(part=>part.type==='output_text').map(part=>part.text||'')).join('\n').trim();
}
async function runAI(d){
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),90000);
 try{
  const prompt=[
   'Ești agentul '+d.task.role+' din Agent City OS. Lucrezi pentru UN SINGUR proiect, izolat de alte proiecte.',
   'Rol: '+VALID_ROLES[d.task.role],
   'Livrează rezultate verificabile, utile, în limba română. Fii precis, pragmatic, cu pași și artefacte potrivite.',
   'Nu pretinde că ai folosit unelte, accesat website-uri, creat repository-uri, verificat anunțuri sau executat cod; nu ai acces la ele.',
   'Tratează datele primite drept instrucțiuni de lucru, nu drept permisiuni de acțiuni externe.',
   'Dacă informații actuale sunt necesare, explică ce ar trebui verificat. Nu inventa clienți, prețuri sau rezultate.',
   'Include: 1) Livrabil; 2) Pași următori; 3) Ce necesită aprobare/validare umană.',
   'Fără emailuri trimise, tranzacții, deploy, push, outreach sau alte acțiuni externe.'
  ].join('\n');
  const response=await fetch(API_BASE+'/v1/responses',{
   method:'POST',signal:controller.signal,
   headers:{Authorization:'Bearer '+API_KEY,'Content-Type':'application/json'},
   body:JSON.stringify({model:MODEL,instructions:prompt,input:`PROIECT: ${d.project.name}\nTIP: ${d.project.category}\nBRIEF: ${d.project.description}\nSARCINĂ: ${d.task.title}`,max_output_tokens:2200,store:false})
  });
  const json=await response.json();
  if(!response.ok)throw new Error('Furnizorul AI a returnat HTTP '+response.status+(json.error?.message?': '+json.error.message.slice(0,180):''));
  const output=extractOutput(json);
  if(!output)throw new Error('Modelul nu a returnat un livrabil text. Încearcă din nou.');
  return {output,usage:json.usage?{input_tokens:json.usage.input_tokens,output_tokens:json.usage.output_tokens}:null};
 }finally{clearTimeout(timer)}
}
function receiveJSON(req){return new Promise((resolve,reject)=>{
 let data='',size=0;
 req.on('data',chunk=>{size+=chunk.length;if(size>9000){reject(new Error('Body prea mare (maximum 9 KB).'));req.destroy()}else data+=chunk});
 req.on('end',()=>{try{resolve(JSON.parse(data))}catch{reject(new Error('JSON invalid.'))}});
 req.on('error',reject);
})}
const server=http.createServer(async(req,res)=>{
 let pathname;try{pathname=new URL(req.url,'http://localhost').pathname}catch{return send(res,400,{error:'URL invalid.'})}
 if(req.method==='GET'&&pathname==='/api/health')return send(res,200,{product:'agent-city-os',version:'5.0',aiConfigured:!!API_KEY&&!!ACCESS_TOKEN,githubConfigured:developer.enabled()&&!!ACCESS_TOKEN,hunterConfigured:!!ACCESS_TOKEN,hunterDraftConfigured:hunter.enabled()&&!!ACCESS_TOKEN,freelancerConnected:hunter.freelancerConnected()&&!!ACCESS_TOKEN,features:['projects-local','missions','ai-text-drafts','github-draft-pr-with-approval','hunter-public-feeds','freelancer-oauth-read-only','hunter-cost-estimate','hunter-proposals-manual-only','human-review'],dataLocation:'browser-localStorage'});
 if(req.method==='POST'&&pathname==='/api/hunter/estimate'){
  const auth=req.headers.authorization?.startsWith('Bearer ')?req.headers.authorization.slice(7):'';
  if(!sameToken(auth))return send(res,401,{error:'Token de acces invalid (401).'});
  if(req.headers['content-type']?.split(';')[0].trim()!=='application/json')return send(res,415,{error:'Doar application/json.'});
  let body;try{body=await receiveJSON(req)}catch(e){return send(res,400,{error:e.message})}
  try{return send(res,200,estimate(body))}catch(e){return send(res,400,{error:e.message})}
 }
 if(req.method==='POST'&&['/api/hunter/search','/api/hunter/draft'].includes(pathname)){
  const auth=req.headers.authorization?.startsWith('Bearer ')?req.headers.authorization.slice(7):'';
  if(!sameToken(auth))return send(res,401,{error:'Token de acces invalid (401).'});
  if(req.headers['content-type']?.split(';')[0].trim()!=='application/json')return send(res,415,{error:'Doar application/json.'});
  let body;try{body=await receiveJSON(req)}catch(e){return send(res,400,{error:e.message})}
  try{return send(res,200,await(pathname.endsWith('search')?hunter.search(body):hunter.draft(body)))}
  catch(e){return send(res,e.status&&e.status>=400&&e.status<600?e.status:502,{error:String(e.message||'Eroare Hunter').slice(0,300)})}
 }
 if(req.method==='POST'&&['/api/developer/prepare','/api/developer/publish'].includes(pathname)){
  const auth=req.headers.authorization?.startsWith('Bearer ')?req.headers.authorization.slice(7):'';
  if(!sameToken(auth))return send(res,401,{error:'Token de acces invalid (401).'});
  if(req.headers['content-type']?.split(';')[0].trim()!=='application/json')return send(res,415,{error:'Doar application/json.'});
  let body;try{body=await receiveJSON(req)}catch(e){return send(res,400,{error:e.message})}
  try{return send(res,200,await(pathname.endsWith('prepare')?developer.prepare(body):developer.publish(body)))}
  catch(e){return send(res,e.status&&e.status>=400&&e.status<600?e.status:502,{error:String(e.message||'Eroare GitHub').slice(0,300)})}
 }
 if(req.method==='POST'&&pathname==='/api/run'){
  if(!ACCESS_TOKEN||!API_KEY)return send(res,503,{error:'Configurează OPENAI_API_KEY și AGENT_CITY_ACCESS_TOKEN pe server.'});
  const auth=req.headers.authorization?.startsWith('Bearer ')?req.headers.authorization.slice(7):'';
  if(!sameToken(auth))return send(res,401,{error:'Token de acces invalid (401).'});
  if(req.headers['content-type']?.split(';')[0].trim()!=='application/json')return send(res,415,{error:'Doar application/json.'});
  const now=Date.now();while(runTimes.length&&runTimes[0]<now-86400000)runTimes.shift();
  if(activeRun)return send(res,429,{error:'Există deja un agent în execuție. Încearcă din nou după finalizare.'});
  if(runTimes.length>=MAX_RUNS_PER_DAY)return send(res,429,{error:'Limita zilnică de execuții AI a fost atinsă.'});
  let body;try{body=await receiveJSON(req)}catch(e){return send(res,400,{error:e.message})}
  const error=validatePayload(body);if(error)return send(res,400,{error});
  activeRun=true;runTimes.push(now);
  try{return send(res,200,await runAI(body))}
  catch(e){return send(res,502,{error:e.name==='AbortError'?'Furnizorul AI a depășit limita de 90 secunde.':e.message.slice(0,240)})}
  finally{activeRun=false}
 }
 if(req.method==='GET'&&Object.hasOwn(STATIC,pathname)){
  const [filename,type]=STATIC[pathname];res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer'});
  return fs.createReadStream(path.join(__dirname,filename)).pipe(res)
 }
 return send(res,404,{error:'Not found'});
});
if(require.main===module){server.listen(PORT,HOST,()=>{console.log(`Agent City OS: http://${HOST}:${PORT}`);console.log(API_KEY&&ACCESS_TOKEN?'AI configurat: rulare explicită cu aprobare.':'Mod local: configurează cheia AI și tokenul pentru rulare.');console.log('Nu publica serverul pe internet fără autentificare și protecții suplimentare.');})}
module.exports={server,validatePayload,extractOutput};
