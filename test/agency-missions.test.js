'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const originalFetch=globalThis.fetch;

process.env.AI_PROVIDER='groq';
process.env.GROQ_API_KEY='unit-test-key';
process.env.AGENT_CITY_ACCESS_TOKEN='unit-test-very-long-access-token';
let providerCalls=[];
globalThis.fetch=async (url,options)=>{
 assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');
 const body=JSON.parse(options.body);
 providerCalls.push(body);
 return {ok:true,json:async()=>({choices:[{message:{content:'Propunere pentru aprobare.'}}],usage:{prompt_tokens:20,completion_tokens:15}})};
};
const {server,validatePayload}=require('../server');

const lead={title:'Cerere site web',description:'Așteaptă ofertă pentru un site nou',source:'Reddit r/forhire',stage:'saved',score:64};
const task={title:'Analizează oportunitățile Hunter și prioritățile agenției',role:'operator'};
test('API supports agency-wide missions without a linked project and explicit Hunter data',async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const endpoint='http://127.0.0.1:'+server.address().port+'/api/run';
  const headers={'Content-Type':'application/json',Authorization:'Bearer unit-test-very-long-access-token'};
  const call=async body=>{
   const r=await originalFetch(endpoint,{method:'POST',headers,body:JSON.stringify(body)});
   return {status:r.status,json:await r.json()};
  };
  const first=await call({scope:'global',task,hunterLeads:[lead]});
  assert.equal(first.status,200);
  assert.equal(providerCalls.length,1);
  assert.match(providerCalls[0].messages[0].content,/întregii agenții/);
  assert.match(providerCalls[0].messages[1].content,/MISIUNE GLOBALĂ/);
  assert.match(providerCalls[0].messages[1].content,/Cerere site web/);
  assert.doesNotMatch(providerCalls[0].messages[1].content,/Magazin online de nișă/);
  assert.equal(first.json.output,'Propunere pentru aprobare.');

  const noLeads=await call({scope:'global',task});
  assert.equal(noLeads.status,200);
  assert.match(providerCalls[1].messages[1].content,/Nu ai acces la oportunitățile Hunter/);
  assert.doesNotMatch(providerCalls[1].messages[1].content,/Cerere site web/);

  const project=await call({scope:'project',project:{name:'Magazin online de nișă',category:'commerce',description:'Doar magazin'},task});
  assert.equal(project.status,200);
  assert.match(providerCalls[2].messages[1].content,/PROIECT: Magazin online de nișă/);
  assert.doesNotMatch(providerCalls[2].messages[1].content,/Cerere site web/);

  const rejects=await call({scope:'global',project:{name:'Magazin online de nișă',category:'commerce',description:'Nu'},task});
  assert.equal(rejects.status,400);
  assert.equal(providerCalls.length,3);

  const forbidden=await call({scope:'project',project:{name:'Magazin online de nișă',category:'commerce',description:'Nu'},task,hunterLeads:[lead]});
  assert.equal(forbidden.status,400);
  assert.equal(providerCalls.length,3);
 }finally{await new Promise(resolve=>server.close(resolve));globalThis.fetch=originalFetch;}
});

test('input validation isolates agency and project missions and bounds Hunter data',()=>{
 assert.equal(validatePayload({scope:'global',task}),null);
 assert.equal(validatePayload({scope:'global',task,hunterLeads:[lead]}),null);
 assert.equal(validatePayload({project:{name:'Existing',category:'web',description:'Text'},task}),null);
 assert.match(validatePayload({scope:'global',project:{name:'Wrong'},task}),/globală/);
 assert.match(validatePayload({scope:'project',task}),/Proiectul/);
 assert.match(validatePayload({scope:'project',project:{name:'Existing',description:'',category:'web'},task,hunterLeads:[lead]}),/doar în misiuni globale/);
 assert.match(validatePayload({scope:'global',task,hunterLeads:Array(11).fill(lead)}),/Maximum 10/);
});

test('Hunter sharing is explicit, limited, and strips private notes and tokens',()=>{
 const script=fs.readFileSync(path.join(__dirname,'..','multiproject.js'),'utf8');
 const publicScript=fs.readFileSync(path.join(__dirname,'..','public','multiproject.js'),'utf8');
 assert.equal(script,publicScript);
 const from=script.indexOf('function hunterMissionSnapshot(){');
 const to=script.indexOf('function missionDetail(',from);
 assert.ok(from>=0&&to>from);
 const context={hunterSaved:Array.from({length:15},(_,i)=>({
   title:'Anunț '+i,description:'Sarcină web',source:'Reddit',state:'saved',score:44,
   notes:'Notițe PRIVATE care nu trebuie trimise',secretToken:'PAROLA_SECRET'
 }))};
 vm.createContext(context);vm.runInContext(script.slice(from,to),context);
 const snapshot=vm.runInContext('hunterMissionSnapshot()',context);
 assert.equal(snapshot.length,10);
 assert.equal(snapshot[0].title,'Anunț 0');
 assert.ok(!JSON.stringify(snapshot).includes('PRIVATE'));
 assert.ok(!JSON.stringify(snapshot).includes('PAROLA_SECRET'));
 assert.match(script,/id="taskScope"/);
 assert.match(script,/id="taskHunterConsent"/);
 assert.match(script,/id="moveMissionGlobal"/);
 assert.match(script,/id="toggleMissionHunter"/);
 assert.match(script,/tasks\.filter\(t=>t\.projectId\|\|t\.scope==='global'\)/);
});
