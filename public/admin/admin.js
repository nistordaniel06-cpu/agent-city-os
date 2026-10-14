'use strict';
/* Owner panel: token exists in JS memory only. Never write secrets to storage. */
(()=>{
const $=id=>document.getElementById(id);
let ownerToken='',state=null;
const NS={projects:'agent_city_workspaces_v2',tasks:'acity_tasks',agents:'acity_agents'};
const getStored=key=>{try{const x=JSON.parse(localStorage.getItem(key));return Array.isArray(x)?x:[]}catch{return []}};
const putStored=(key,data)=>localStorage.setItem(key,JSON.stringify(data));
const element=(tag,cls,contents)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(contents!==undefined)e.textContent=String(contents);return e};
const pill=(text,ok=false)=>{const e=element('span','pill '+(ok?'ok':'warn'),text);return e};
const appendRow=(parent,title,description,value,success)=>{
 const row=element('div','row'),left=element('div');
 left.append(element('b','',title),element('small','',description));
 row.append(left,pill(value,success));parent.append(row);return row;
};
const message=(id,text)=>{const el=$(id);if(el)el.textContent=text};
const readLocal=()=>({projects:getStored(NS.projects),tasks:getStored(NS.tasks),agents:getStored(NS.agents)});
const protect=async(path,options={})=>{
 const response=await fetch(path,{...options,cache:'no-store',headers:{Authorization:'Bearer '+ownerToken,...(options.headers||{})}});
 let data={};try{data=await response.json()}catch{}
 if(response.status===401){logout();throw new Error('Sesiunea a expirat sau tokenul este invalid.')}
 if(!response.ok)throw new Error(data.error||'Eroare server HTTP '+response.status);
 return data;
};
function loginView(open){
 $('login').classList.toggle('hidden',!open);
 $('dashboard').classList.toggle('hidden',open);
 $('logout').classList.toggle('hidden',open);
}
function logout(){window.AgentCitySales?.lock();ownerToken='';state=null;$('ownerToken').value='';loginView(true);message('loginError','')}
async function login(e){
 e.preventDefault();
 const value=$('ownerToken').value.trim();if(!value)return;
 ownerToken=value;message('loginError','Verific tokenul pe server…');
 try{state=await protect('/api/admin/status');await window.AgentCitySales.unlock(value,protect);$('ownerToken').value='';loginView(false);message('loginError','');refreshAll()}
 catch(e){ownerToken='';state=null;window.AgentCitySales?.lock();message('loginError',e.message)}
}
function showSection(section){
 document.querySelectorAll('.section').forEach(el=>el.classList.toggle('active',el.id===section));
 document.querySelectorAll('.nav').forEach(el=>el.classList.toggle('active',el.dataset.section===section));
 if(section==='sales')window.AgentCitySales?.render();
 if(section==='projects')renderProjects();
 if(section==='missions')renderMissions();
 if(section==='agents')renderAgents();
 if(section==='integrations')renderIntegrations();
}
function updateStats(){
 const d=readLocal();
 $('countProjects').textContent=d.projects.length;
 $('countMissions').textContent=d.tasks.length;
 $('countReview').textContent=d.tasks.filter(t=>t.status==='review').length;
 $('metricProvider').textContent=state?.ai?.provider?.toUpperCase()||'—';
}
function renderStatus(){
 const box=$('statusRows'),limits=$('limitsRows');box.replaceChildren();limits.replaceChildren();
 appendRow(box,'Agent AI principal',state.ai.model,state.ai.provider.toUpperCase(),state.ai.configured);
 appendRow(box,'HyAgent · Tencent Hy-MT2',state.hyagent.model,state.hyagent.configured?'Configurat':'Necesită endpoint',state.hyagent.configured);
 appendRow(box,'Hunter', 'Semnale publice și oferte pentru aprobare',state.hunter.draftsConfigured?'Pregătit':'Neconfigurat',state.hunter.draftsConfigured);
 appendRow(box,'Code Reviewer','PR #9 rămâne separat până la aprobarea merge-ului','PR în așteptare',false);
 appendRow(limits,'Misiuni AI','Limita procesului curent; valori aproximative',state.limits.aiRunsUsed+' / '+state.limits.maxAiRuns,true);
 appendRow(limits,'Traduceri','Apeluri reușite pe procesul curent',state.limits.translationsUsed+' / '+state.limits.maxTranslations,true);
 appendRow(limits,'Execuție AI', 'O singură cerere AI simultan per instanță',state.limits.activeRun?'În curs':'Liber',!state.limits.activeRun);
 $('hyModel').textContent=state.hyagent.model;
 $('hyStatus').className='pill '+(state.hyagent.configured?'ok':'warn');
 $('hyStatus').textContent=state.hyagent.configured?'Configurat':'Neconfigurat';
 $('hyHint').textContent=state.hyagent.configured?
 'Endpointul de traducere este configurat; prima traducere va verifica funcționarea reală.':
 'Adaugă HYAGENT_API_BASE_URL (HTTPS, compatibil OpenAI Chat Completions) și HYAGENT_MODEL în Vercel, apoi fă redeploy. Modelul nu rulează automat pe Vercel.';
 $('translateBtn').disabled=!state.hyagent.configured;
}
function renderProjects(){
 const data=readLocal().projects;const target=$('projectRows');target.replaceChildren();
 if(!data.length){target.append(element('p','sub','Nu există proiecte locale în acest browser.'));return}
 for(const p of data){
  if(!p||typeof p!=='object'||typeof p.id!=='string')continue;
  const row=element('div','row'),info=element('div'),opts=element('div','actions');
  info.append(element('b','',String(p.name||'Proiect fără nume').slice(0,150)),
    element('small','',String(p.description||'Fără descriere').slice(0,180)));
  const selector=element('select');
  selector.setAttribute('aria-label','Stare '+String(p.name||'proiect'));
  selector.className='btn';
  for(const [key,label] of [['idea','Idee'],['active','Activ'],['paused','Pauză'],['done','Finalizat']]){
   const o=element('option','',label);o.value=key;selector.append(o);
  }
  selector.value=['idea','active','paused','done'].includes(p.status)?p.status:'idea';
  selector.onchange=()=>{
   if(!confirm('Actualizezi starea proiectului „'+String(p.name).slice(0,90)+'” doar în acest browser?')){selector.value=p.status||'idea';return}
   const latest=getStored(NS.projects);const matched=latest.find(x=>x&&x.id===p.id);
   if(matched){matched.status=selector.value;putStored(NS.projects,latest)}
   updateStats();
  };
  opts.append(selector);row.append(info,opts);target.append(row);
 }
}
function renderMissions(){
 const data=readLocal().tasks,filter=$('missionFilter').value;const target=$('missionRows');target.replaceChildren();
 const filtered=data.filter(t=>t&&typeof t==='object'&&(filter==='all'||t.status===filter)).slice().reverse().slice(0,80);
 if(!filtered.length){target.append(element('p','sub','Nicio misiune pentru acest filtru.'));return}
 for(const t of filtered){
  const row=element('div','row'),info=element('div'),actions=element('div','actions');
  info.append(element('b','',String(t.name||'Misiune fără nume').slice(0,220)),
   element('small','',(t.scope==='global'?'🌐 Agenția AI':'📁 Proiect')+' · '+String(t.role||'agent')+' · '+String(t.status||'queued')));
  if(t.status==='review'&&typeof t.output==='string'&&t.output.trim()){
   const view=element('button','btn','Citește livrabilul');
   view.type='button';
   view.onclick=()=>{const dialog=$('missionDialog');
    $('missionDialogTitle').textContent=String(t.name||'Livrabil');
    $('missionDialogText').textContent=t.output.slice(0,30000);
    $('approveMission').onclick=()=>{
     if(!confirm('Confirmi aprobarea manuală a acestui LIVRABIL TEXT? Acest lucru nu face merge în GitHub.'))return;
     const list=getStored(NS.tasks),targetMission=list.find(item=>String(item.id)===String(t.id));
     if(targetMission&&targetMission.status==='review'){targetMission.status='done';putStored(NS.tasks,list)}
     dialog.close();refreshAll();showSection('missions');
    };
    dialog.showModal()
   };
   actions.append(view);
  }
  row.append(info,actions);target.append(row);
 }
}
function renderAgents(){
 const b=$('agentRows');b.replaceChildren();const local=readLocal().agents;
 appendRow(b,'Agent AI · '+(state?.ai?.provider?.toUpperCase()||'N/A'),'Misiuni de strategie, dezvoltare, cercetare, marketing, QA și operațiuni',state?.ai?.configured?'Configurat':'Neconfigurat',state?.ai?.configured);
 appendRow(b,'HyAgent · Translator','Traduceri multilingve prin Hy-MT2, când există server de inferență',state?.hyagent?.configured?'Configurat':'Așteaptă endpoint',state?.hyagent?.configured);
 appendRow(b,'OpenCodeReview · GitHub','Acțiunea din PR #9, separat de această schimbare','Așteaptă aprobarea PR #9',false);
 for(const agent of local.slice(0,30))appendRow(b,String(agent.name||'Agent'),String(agent.role||'Rol demo')+' · NPC vizual local','DEMO',false);
 if(!local.length)b.append(element('p','sub','Nu sunt agenți demo salvați în browser.'));
}
function renderIntegrations(){
 const b=$('integrationRows');b.replaceChildren();
 const records=[
 ['GitHub · agent-city-os','Cod sursă, pull requesturi și acțiuni','https://github.com/nistordaniel06-cpu/agent-city-os'],
 ['OpenCodeReview · PR #9','Necesită aprobarea de merge și secretul OCR_GROQ_API_KEY','https://github.com/nistordaniel06-cpu/agent-city-os/pull/9'],
 ['GitHub Actions','Teste și verificări Code Reviewer','https://github.com/nistordaniel06-cpu/agent-city-os/actions'],
 ['HyAgent · repository','Hy-MT2 — modele pentru traduceri','https://github.com/nistordaniel06-cpu/hyagent'],
 ['Vercel · Production','Setări proiect și variabilele de mediu','https://vercel.com/4-men/agent-city-os']
 ];
 for(const [name,description,url]of records){
  const r=element('div','row'),info=element('div'),link=element('a','btn','Deschide ↗');
  info.append(element('b','',name),element('small','',description));link.href=url;link.target='_blank';link.rel='noopener noreferrer';r.append(info,link);b.append(r);
 }
}
async function reloadStatus(){
 try{state=await protect('/api/admin/status');refreshAll()}
 catch(e){alert(e.message)}
}
function refreshAll(){
 if(!state)return;
 updateStats();renderStatus();renderProjects();renderMissions();renderAgents();renderIntegrations();window.AgentCitySales?.render();
}
async function translate(e){
 e.preventDefault();if(!state?.hyagent?.configured)return;
 message('translateMessage','Trimit cererea către serverul HyAgent…');
 $('translateBtn').disabled=true;$('translationResult').classList.add('hidden');
 try{
  const data=await protect('/api/hyagent/translate',{method:'POST',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({text:$('translationText').value,sourceLanguage:$('sourceLanguage').value,
    targetLanguage:$('targetLanguage').value,style:$('translationStyle').value})});
  $('translatedText').textContent=data.translation;
  $('translationResult').classList.remove('hidden');
  message('translateMessage','Traducere finalizată de '+data.model+'. Verifică manual rezultatul.');
 }catch(err){message('translateMessage',err.message)}
 finally{$('translateBtn').disabled=!state?.hyagent?.configured}
}
function backup(){
 const data=readLocal();
 const safe={schema:2,exportedAt:new Date().toISOString(),projects:data.projects,tasks:data.tasks};
 const blob=new Blob([JSON.stringify(safe,null,2)],{type:'application/json'});
 const uri=URL.createObjectURL(blob);const a=element('a');a.href=uri;a.download='agent-city-admin-browser-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(uri),1200);
}
$('loginForm').onsubmit=login;$('logout').onclick=logout;
document.querySelectorAll('[data-section]').forEach(b=>b.onclick=()=>showSection(b.dataset.section));
$('refreshStatus').onclick=reloadStatus;
$('reloadProjects').onclick=renderProjects;
$('missionFilter').onchange=renderMissions;
$('translateForm').onsubmit=translate;
$('copyTranslation').onclick=async()=>{try{await navigator.clipboard.writeText($('translatedText').textContent);message('translateMessage','Traducerea a fost copiată.')}catch{message('translateMessage','Copiază manual textul rezultat.')}}
$('exportBackup').onclick=backup;
$('closeMissionDialog').onclick=()=>$('missionDialog').close();
})();
