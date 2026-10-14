/* Agent City OS — independent project workspaces. Runs offline without external network.
   Real drafts require a private backend + API key. No external actions are performed. */
'use strict';
const PROJECT_KEY = 'agent_city_workspaces_v2';
const ACTIVE_KEY = 'agent_city_active_workspace_v2';
const fallbackStore = new Map();
function getLocal(k){try{return localStorage.getItem(k)}catch{return fallbackStore.get(k)||null}}
function setLocal(k,v){fallbackStore.set(k,v);try{localStorage.setItem(k,v)}catch{ /* ephemeral mode */ }}
const CATEGORY = {
  web:['🌐','Website'], commerce:['🛒','E-commerce'], mobile:['📱','Aplicație mobilă'],
  saas:['🧩','SaaS'], game:['🎮','Joc'], automation:['⚙️','Automatizare'],
  marketing:['📣','Marketing'], research:['🔎','Cercetare'], other:['🚀','Alt domeniu']
};
const AGENT_ROLES = {
  planner:'🧠 Strateg & planificare', developer:'💻 Developer & arhitectură',
  researcher:'🔎 Research & oportunități', marketer:'📣 Marketing & vânzări',
  qa:'🛡️ QA & verificare', operator:'🗂️ Operations & procese'
};
let workspaces=loadWorkspaces();
let currentProjectId=getLocal(ACTIVE_KEY)||workspaces[0]?.id||'';
let connectedBackend=false,configuredBackend=false,configuredGithub=false,activeAIProvider='';
let authToken='';
let lockRun=false;
function uid(){return (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`)}
function loadWorkspaces(){
  try {const raw=JSON.parse(getLocal(PROJECT_KEY));if(Array.isArray(raw))return raw.filter(isProject).slice(0,300)}catch{}
  return [
    {id:uid(),name:'Magazin online de nișă',category:'commerce',description:'Exemplu: magazin de produse premium cu pagini de produs, plăți și logistică.',repo:'',status:'idea',sample:true},
    {id:uid(),name:'Mini-joc mobil',category:'game',description:'Exemplu: joc mobil rapid cu clasament și recompense virtuale.',repo:'',status:'idea',sample:true},
    {id:uid(),name:'Automatizări pentru firme',category:'automation',description:'Exemplu: automatizarea procesării solicitărilor și a raportării pentru o firmă.',repo:'',status:'idea',sample:true}
  ];
}
function isProject(p){return p&&typeof p.id==='string'&&typeof p.name==='string'}
function saveProjects(){setLocal(PROJECT_KEY,JSON.stringify(workspaces));setLocal(ACTIVE_KEY,currentProjectId)}
function currentProject(){return workspaces.find(p=>p.id===currentProjectId)||workspaces[0]||null}
function catLabel(p){return CATEGORY[p.category]||CATEGORY.other}
function projectTasks(pid=currentProjectId){return tasks.filter(t=>t.projectId===pid)}
function missionStatus(s){return ({queued:'În așteptare',running:'În execuție',review:'De aprobat',done:'Aprobat',failed:'Eroare',legacy:'Demo vechi'})[s]||'În așteptare'}
function safeUrl(url){try{let u=new URL(url);return ['https:','http:'].includes(u.protocol)?u.href:''}catch{return ''}}
function safeAttr(s){return esc(s).replaceAll("'",'&#39;')}
function displayProjects(){
  if(!workspaces.some(p=>p.id===currentProjectId)) currentProjectId=workspaces[0]?.id||'';
  saveProjects();let p=currentProject();
  $('#projectCount').textContent=`${workspaces.length} proiecte`;
  $('#activeProjectTitle').textContent=p?p.name:'Creează un proiect';
  $('#projectSelect').innerHTML=workspaces.map(o=>`<option value="${safeAttr(o.id)}" ${o.id===currentProjectId?'selected':''}>${catLabel(o)[0]} ${esc(o.name)}</option>`).join('')||'<option>Niciun proiect</option>';
  $('#projectRows').innerHTML=workspaces.map(o=>{
    let active=o.id===currentProjectId, count=projectTasks(o.id).length;
    return `<button class="projectRow ${active?'active':''}" data-project="${safeAttr(o.id)}"><span class="projectIcon">${catLabel(o)[0]}</span><span><b>${esc(o.name)}</b><small>${esc(catLabel(o)[1])} · ${count} misiuni${o.sample?' · exemplu':''}</small></span></button>`;
  }).join('')||'<p class="emptyState">Nu există proiecte. Creează primul proiect.</p>';
  document.querySelectorAll('[data-project]').forEach(el=>el.onclick=()=>selectProject(el.dataset.project));
  $('#topTasks').textContent=tasks.length;
  $('#credits').textContent=workspaces.length;
  document.querySelectorAll('#agentRows .status').forEach(b=>{b.textContent='ROL DEMO';b.classList.add('idle')});
  $('#completedBig').innerHTML=`${p?projectTasks().filter(t=>t.status==='done').length:0} <span style="font-size:12px;color:#93a1bf;font-weight:650">aprobate</span>`;
  $('#runningStat').textContent=projectTasks().filter(t=>t.status==='running').length;
  $('#queuedStat').textContent=projectTasks().filter(t=>['queued','review'].includes(t.status)).length;
}
const baseRefresh=refresh;
refresh=function(){baseRefresh();displayProjects()};
function selectProject(id){currentProjectId=id;displayProjects();log('Spațiu selectat: '+(currentProject()?.name||'?'))}
function projectModal(id=null){
  const p=id?workspaces.find(x=>x.id===id):null;
  modal(p?'Editează proiectul':'Proiect nou','UNIVERSAL WORKSPACE',
    `<p class="subtitle">Orice industrie, orice produs. Fiecare proiect are propriul brief, misiuni și rezultate.</p>
     <form id="projectForm"><label class="field">Nume proiect<input id="pName" required maxlength="90" placeholder="Ex: Magazin de modă, joc, app de fitness" value="${safeAttr(p?.name||'')}"></label>
     <label class="field">Domeniu<select id="pCategory">${Object.entries(CATEGORY).map(([key,c])=>`<option value="${key}" ${p?.category===key?'selected':''}>${c.join(' ')}</option>`).join('')}</select></label>
     <label class="field">Descriere / obiectiv<textarea id="pDescription" maxlength="2500" placeholder="Ce problemă rezolvă? Ce rezultate vrei?">${esc(p?.description||'')}</textarea></label>
     <label class="field">Repository GitHub (opțional)<input id="pRepo" type="url" maxlength="300" placeholder="https://github.com/cont/repo" value="${safeAttr(p?.repo||'')}"></label>
     <label class="field">Stadiu<select id="pStatus">${[['idea','Idee'],['active','Activ'],['paused','Pauză'],['done','Finalizat']].map(([v,n])=>`<option value="${v}" ${p?.status===v?'selected':''}>${n}</option>`).join('')}</select></label>
     <button type="submit" class="action">💾 ${p?'Salvează':'Creează proiectul'}</button></form>`+
    (p?`<div class="projectToolbar"><button class="smallBtn dangerBtn" id="removeProject">Șterge acest proiect</button></div>`:''));
  $('#projectForm').onsubmit=e=>{
    e.preventDefault();let name=$('#pName').value.trim(),repo=$('#pRepo').value.trim();
    if(!name)return;if(!p&&workspaces.length>=300){alert('Maximum 300 de proiecte în modul local. Exportă datele și folosește o bază de date pentru mai multe.');return}if(repo&&!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/.test(repo)){alert('Introdu un URL complet de repository github.com sau lasă câmpul gol.');return}
    const value={id:p?.id||uid(),name,category:$('#pCategory').value,description:$('#pDescription').value.trim(),repo,status:$('#pStatus').value,sample:false};
    if(p){let i=workspaces.indexOf(p);workspaces[i]=value}else workspaces.push(value);
    currentProjectId=value.id;saveProjects();close();refresh();log('Proiect salvat: '+name);projectDetail();
  };
  if(p)$('#removeProject').onclick=()=>{
    if(!confirm(`Ștergi „${p.name}” și toate misiunile sale? Operația nu poate fi anulată fără backup.`))return;
    workspaces=workspaces.filter(x=>x.id!==p.id);tasks=tasks.filter(t=>t.projectId!==p.id);currentProjectId=workspaces[0]?.id||'';saveProjects();close();refresh();
  };
}
function projectDetail(){
 const p=currentProject();if(!p){projectModal();return}
 const ts=projectTasks();
 const meta=`<div class="projectMeta"><span>${catLabel(p)[0]} ${esc(catLabel(p)[1])}</span><span>${esc(({idea:'Idee',active:'Activ',paused:'Pauză',done:'Finalizat'})[p.status]||'Idee')}</span><span>📋 ${ts.length} misiuni</span>${p.sample?'<span>Exemplu de proiect</span>':''}</div>`;
 modal(p.name,'WORKSPACE · PROJECT HQ',meta+`<p class="subtitle">${esc(p.description||'Fără descriere încă.')}</p>`+
   (p.repo?`<p class="hint">🔗 Repo: <a target="_blank" rel="noopener noreferrer" href="${safeAttr(safeUrl(p.repo))}" style="color:#8bd1ff">${esc(p.repo)}</a> (doar asociere; nu scrie automat în GitHub)</p>`:'')+
   `<div class="projectToolbar"><button id="editProject" class="smallBtn">✎ Editează proiectul</button><button id="projectNewTask" class="smallBtn">+ Misiune nouă</button><button id="viewProjectMissions" class="smallBtn">📋 Misiuni</button></div>`+
   `<h3 class="sectionTitle">ULTIMELE MISIUNI</h3>${ts.length?ts.slice(-3).reverse().map(t=>missionCard(t)).join(''):'<p class="emptyState">Nu există misiuni. Creează o misiune și atribuie-i un agent.</p>'}`);
 $('#editProject').onclick=()=>projectModal(p.id);$('#projectNewTask').onclick=()=>newTask('command','project');$('#viewProjectMissions').onclick=()=>allTaskModal('project');attachMissionActions();
}
function missionCard(t){
 let agent=AGENT_ROLES[t.role]||t.role||t.agent||'Agent';
 return `<div class="taskItem"><h4>${esc(t.name)}</h4><p>${esc(agent)} · ${new Date(t.created||Date.now()).toLocaleDateString('ro-RO')}</p>
    <footer><span class="state ${esc(t.status)}">${missionStatus(t.status)}</span><button class="smallBtn" data-task-view="${safeAttr(String(t.id))}">Detalii →</button></footer></div>`;
}
function attachMissionActions(){document.querySelectorAll('[data-task-view]').forEach(el=>el.onclick=()=>missionDetail(el.dataset.taskView))}
allTaskModal=function(scope='global'){
 // Click events can reach this handler directly; never interpret them as a filter.
 if(scope!=='project')scope='global';
 const p=currentProject();
 const globalTasks=tasks.filter(t=>t.scope==='global');
 const related=scope==='project'?projectTasks():globalTasks;
 modal(scope==='global'?'Misiunile agenției':'Misiunile proiectului',scope==='global'?'🌐 AGENȚIE · MISSION BOARD':p?.name||'WORKSPACE',
 `<p class="subtitle">${scope==='global'?'Misiuni fără proiect asociat: analiză de oportunități, cercetare și coordonare.':'Misiuni limitate la proiectul ales.'} Nu se execută automat.</p>
 <div class="projectToolbar"><button class="smallBtn" id="globalMissionTab">🌐 Agenție (${globalTasks.length})</button><button class="smallBtn" id="projectMissionTab">${p?'📁 '+esc(p.name):'📁 Proiect'} (${p?projectTasks().length:0})</button><button class="smallBtn" id="newTaskBoard">+ Misiune</button></div>
 <div>${related.slice().reverse().map(missionCard).join('')||'<p class="emptyState">Nicio misiune în această categorie.</p>'}</div>`);
 $('#globalMissionTab').onclick=()=>allTaskModal('global');
 $('#projectMissionTab').onclick=()=>allTaskModal('project');
 $('#newTaskBoard').onclick=()=>newTask('command',scope);
 attachMissionActions();
};
function newTask(building='command',preferredScope='global'){
 const p=currentProject();
 const defaultRole=({research:'researcher',studio:'marketer',factory:'developer',armory:'qa',archive:'planner',command:'operator',trading:'researcher'})[building]||'planner';
 const defaultScope=preferredScope==='project'&&p?'project':'global';
 const options=`<option value="global" ${defaultScope==='global'?'selected':''}>🌐 Agenția AI — misiune globală</option>${p?`<option value="project" ${defaultScope==='project'?'selected':''}>📁 Doar proiectul: ${esc(p.name)}</option>`:''}`;
 modal('Misiune nouă','ALEGE DOMENIUL MISIUNII',`<p class="subtitle">Misiunile globale sunt pentru întreaga agenție: analiză de clienți, strategii și operațiuni. Cele pe proiect folosesc doar brief-ul proiectului ales.</p>
  <form id="taskForm"><label class="field">Unde lucrează agentul?<select id="taskScope">${options}</select></label>
  <p class="hint" id="scopeHint"></p>
  <label class="field">Ce trebuie să livreze agentul?<textarea id="taskDescription" required maxlength="4000" placeholder="Ex: Analizează oportunitățile Hunter salvate și propune criterii pentru cele mai profitabile proiecte"></textarea></label>
  <label class="field">Agent responsabil<select id="taskRole">${Object.entries(AGENT_ROLES).map(([k,v])=>`<option value="${k}" ${k===defaultRole?'selected':''}>${v}</option>`).join('')}</select></label>
  <label class="field"><input id="taskHunterConsent" type="checkbox" style="width:auto;vertical-align:middle;margin-right:7px"> Include oportunitățile Hunter salvate în analiza AI</label>
  <p class="hint" id="hunterConsentHint">Opțional. Trimite către furnizorul AI maximum 12 anunțuri salvate (titlu, descriere scurtă, scor), fără notițele private sau tokenuri. Nu se preiau automat în lipsa acordului.</p>
  <button class="action" type="submit">📋 Creează misiunea</button></form>
  <p class="note">Nicio ofertă, publicare, tranzacție sau modificare GitHub fără un flux separat de aprobare. Serverul generează doar text.</p>`);
 const updateHint=()=>{
  const scope=$('#taskScope').value;
  $('#scopeHint').textContent=scope==='global'?'🌐 Context global al agenției, fără asociere cu proiectul selectat.':'📁 Context exclusiv: '+(p?.name||'Proiect neselectat');
 };
 $('#taskScope').onchange=updateHint;updateHint();
 $('#taskForm').onsubmit=e=>{
  e.preventDefault();
  const name=$('#taskDescription').value.trim(),role=$('#taskRole').value,scope=$('#taskScope').value;
  if(!name)return;
  if(scope!=='global'&&scope!=='project')return alert('Alege domeniul misiunii.');
  if(scope==='project'&&!p)return alert('Creează întâi un proiect.');
  const t={id:uid(),name,scope,projectId:scope==='project'?p.id:'',role,status:'queued',created:new Date().toISOString(),output:'',usage:null,includeHunter:$('#taskHunterConsent').checked};
  tasks.push(t);refresh();close();log('Misiune '+(scope==='global'?'globală':'de proiect')+' pregătită: '+name.slice(0,60));missionDetail(t.id);
 };
}
function hunterMissionSnapshot(){
 // Client-side Hunter data is local to this browser and MUST be explicitly opted in.
 if(typeof hunterSaved==='undefined'||!Array.isArray(hunterSaved))return [];
 return hunterSaved.slice(0,12).map(o=>({
  title:String(o.title||'').slice(0,180),
  description:String(o.description||'').slice(0,240),
  source:String(o.source||'').slice(0,70),
  stage:String(o.state||'saved').slice(0,30),
  score:Number.isFinite(Number(o.score))?Math.max(0,Math.min(100,Number(o.score))):0
 })).filter(o=>o.title);
}
function missionDetail(id){
 let t=tasks.find(x=>String(x.id)===String(id));if(!t)return allTaskModal();
 const global=t.scope==='global';
 let p=global?null:workspaces.find(x=>x.id===t.projectId);if(!global&&!p)return allTaskModal();
 const mode=connectedBackend&&configuredBackend?'Server AI '+(activeAIProvider||'')+' conectat':'Fără AI conectat (mod local)';
 modal('Misiune · '+(global?'🌐 Agenția AI':p.name),'AGENT WORK ORDER',
   `<div class="projectMeta"><span>${esc(AGENT_ROLES[t.role]||t.role||'Agent')}</span><span>${missionStatus(t.status)}</span><span>${global?'🌐 Global':'📁 '+esc(p.name)}</span>${t.includeHunter?'<span>📌 Hunter (cu acord)</span>':''}</div>
    <div class="resultText">${esc(t.name)}</div>
    ${t.output?`<h3 class="sectionTitle">LIVRABIL AI · NECESITĂ VERIFICARE UMANĂ</h3><div class="resultText">${esc(t.output)}</div>`:''}
    <div class="projectToolbar">
      ${['queued','failed'].includes(t.status)?`<button class="smallBtn approve" id="runMission">▶ Execută cu AI</button>`:''}
      ${!global&&t.role==='developer'&&p.repo?`<button class="smallBtn approve" id="prepareGitHub">🔧 Pregătește patch GitHub</button>`:''}
      ${t.githubPreview?`<button class="smallBtn" id="showGitHubPreview">👁️ Vezi propunerea GitHub</button>`:''}
      ${t.status==='review'?`<button class="smallBtn approve" id="approveMission">✓ Aprob livrabilul</button>`:''}
      ${t.output?`<button class="smallBtn" id="copyResult">Copiază rezultatul</button>`:''}
      <button class="smallBtn" id="backToMissions">← Misiuni</button>
      <button class="smallBtn dangerBtn" id="deleteMission">Șterge</button>
    </div>
    <p class="hint">${esc(mode)} · „Execută cu AI” generează text. „Pregătește patch GitHub” citește doar fișierele indicate și propune modificări; deschiderea unui draft PR cere o aprobare separată. Nu rulează cod, nu face merge.</p>`);
 if($('#runMission'))$('#runMission').onclick=()=>startTask(t.id);
 if($('#prepareGitHub'))$('#prepareGitHub').onclick=()=>githubPrepareForm(t.id);
 if($('#showGitHubPreview'))$('#showGitHubPreview').onclick=()=>githubPreview(t.id);
 if($('#approveMission'))$('#approveMission').onclick=()=>{t.status='done';refresh();log('Livrabil aprobat: '+t.name.slice(0,48));missionDetail(t.id)};
 if($('#copyResult'))$('#copyResult').onclick=async()=>{try{await navigator.clipboard.writeText(t.output);alert('Rezultat copiat!')}catch{alert('Selectează textul din rezultatul afișat și copiază-l manual.')}};
 $('#backToMissions').onclick=()=>allTaskModal(global?'global':'project');
 $('#deleteMission').onclick=()=>{if(!confirm('Ștergi misiunea?'))return;tasks=tasks.filter(x=>x.id!==t.id);refresh();allTaskModal(global?'global':'project')};
}
async function probeBackend(){
 try{let ctrl=new AbortController();let timeout=setTimeout(()=>ctrl.abort(),1700);
   let r=await fetch('/api/health',{signal:ctrl.signal});clearTimeout(timeout);
   let j=await r.json();connectedBackend=r.ok&&j.product==='agent-city-os';configuredBackend=!!j.aiConfigured;configuredGithub=!!j.githubConfigured;activeAIProvider=j.aiProvider==='groq'?'GROQ':j.aiProvider==='openai'?'OPENAI':'';
 }catch{connectedBackend=false;configuredBackend=false;configuredGithub=false;activeAIProvider=''}
 $('#connectionLabel').textContent=connectedBackend?(configuredBackend?'AI '+(activeAIProvider||'DISPONIBIL'):'SERVER · LIPSEȘTE CHEIA'):'MOD LOCAL';
 $('#executionMode').textContent=connectedBackend?(configuredBackend?'AI '+(activeAIProvider||'')+' LA CERERE':'NECONFIGURAT'):'FĂRĂ BACKEND';
}

async function requireAccessToken(){
 if(!connectedBackend){alert('Pornește serverul Node.js din arhivă; demo-ul HTML este doar offline.');return false}
 if(!authToken){authToken=prompt('AGENT_CITY_ACCESS_TOKEN (nu cheia API sau GitHub!), valabil doar în memoria paginii:')||''}
 return !!authToken;
}
function githubPrepareForm(id){
 const t=tasks.find(x=>x.id===id),p=workspaces.find(x=>x.id===t?.projectId);
 if(!t||!p)return;
 modal('Developer AI · GitHub','PREGĂTIREA MODIFICĂRILOR',`<p class="subtitle">Proiect: <b>${esc(p.name)}</b><br>Repository: <b>${esc(p.repo||'Nesetat')}</b></p>
 <p class="note">Modificăm doar 1–3 fișiere EXISTENTE din repo-ul tău. Nu este permisă schimbarea workflow-urilor, a fișierelor secrete sau de instalare. Nu rulează teste și nu publică nimic în această etapă.</p>
 <form id="githubPrepareForm"><label class="field">Căile exacte ale fișierelor (una pe linie)<textarea id="githubFilePaths" required maxlength="600" placeholder="README.md
src/app.js"></textarea></label>
 <button class="action" type="submit">🔎 Citește fișierele și propune cod</button></form>`);
 $('#githubPrepareForm').onsubmit=e=>{
  e.preventDefault();const files=$('#githubFilePaths').value.split(/[\n,]+/).map(x=>x.trim()).filter(Boolean);
  if(!files.length||files.length>3){alert('Alege între 1 și 3 fișiere existente.');return}
  prepareGithubTask(id,files);
 };
}
async function prepareGithubTask(id,files){
 if(lockRun)return;const t=tasks.find(x=>x.id===id),p=workspaces.find(x=>x.id===t?.projectId);
 if(!t||!p)return;
 if(!configuredGithub){alert('Integrarea GitHub nu este configurată pe server. Sunt necesare GITHUB_OWNER, GITHUB_TOKEN și cheia furnizorului AI ales.');return}
 if(!await requireAccessToken())return;
 lockRun=true;
 modal('Developer AI · GitHub','SE PREGĂTEȘTE PROPUNEREA',`<p class="subtitle">Se citesc fișierele selectate, apoi AI pregătește o versiune nouă. Nu se modifică repository-ul.</p><p class="hint">Fișiere: ${esc(files.join(', '))}</p>`);
 try{
  const r=await fetch('/api/developer/prepare',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+authToken},body:JSON.stringify({repo:p.repo,project:p.name,task:t.name,files})});
  const data=await r.json();if(!r.ok)throw new Error(data.error||'Eroare de pregătire.');
  t.githubPreview=data;
  refresh();log('GitHub: patch pentru aprobare · '+p.name);githubPreview(id);
 }catch(e){alert('GitHub: '+e.message);if(/401|token/i.test(e.message))authToken='';missionDetail(id)}
 finally{lockRun=false}
}
function githubPreview(id){
 const t=tasks.find(x=>x.id===id),v=t?.githubPreview;if(!v)return missionDetail(id);
 modal('Previzualizare GitHub','APROBAREA TA ESTE NECESARĂ',`<p class="subtitle"><b>${esc(v.repo)}</b> · ${esc(v.baseBranch||'main')} · expiră după 30 de minute de la pregătire (și dacă restartezi serverul).</p>
 <div class="resultText">${esc(v.summary)}</div>
 <p class="note">Codul de mai jos este propus de AI, nu verificat. Nu am executat teste. GitHub primește DOAR un draft PR după ce confirmi; nu facem merge.</p>
 ${v.changes.map(c=>`<details style="margin:12px 0;border:1px solid #46516d;border-radius:10px;padding:10px"><summary style="cursor:pointer;font-weight:800">${esc(c.path)} — vezi întreg fișierul propus</summary><p class="subtitle">${esc(c.reason)}</p><pre class="resultText">${esc(c.content)}</pre></details>`).join('')}
 <div class="projectToolbar"><button id="publishGithub" class="smallBtn approve">📤 Aprob și creez draft PR</button><button id="backMissionGithub" class="smallBtn">← Înapoi</button></div>`);
 $('#publishGithub').onclick=()=>publishGithub(id);
 $('#backMissionGithub').onclick=()=>missionDetail(id);
}
async function publishGithub(id){
 if(lockRun)return;const t=tasks.find(x=>x.id===id),v=t?.githubPreview;
 if(!v)return;
 if(!confirm('CONFIRMĂ: Creez un BRANCH nou și un DRAFT PULL REQUEST pe GitHub pentru '+v.repo+'? Nu fac merge și nu deployez. Ai verificat codul afișat?'))return;
 if(!await requireAccessToken())return;
 lockRun=true;
 try{
  const r=await fetch('/api/developer/publish',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+authToken},body:JSON.stringify({previewId:v.previewId,approval:'PUBLISH_DRAFT_PR'})});
  const data=await r.json();if(!r.ok)throw new Error(data.error||'GitHub nu a creat PR.');
  t.githubPR=data.url;t.githubPreview=null;t.status='review';t.output='Draft PR deschis pe GitHub: '+data.url+'\nRevizuiește codul și verificările CI înainte de merge.';
  refresh();log('Draft PR GitHub creat: '+data.url);
  modal('Draft PR creat','GITHUB · NECESITĂ REVIEW',`<p class="subtitle">Propunerea a fost publicată ca draft PR. Niciun merge sau deploy nu a fost executat.</p><div class="projectToolbar"><a href="${safeAttr(data.url)}" target="_blank" rel="noopener noreferrer" class="smallBtn">Deschide PR pe GitHub ↗</a><button class="smallBtn" id="backAfterPr">Înapoi la misiune</button></div>`);
  $('#backAfterPr').onclick=()=>missionDetail(id);
 }catch(e){alert(e.message);if(/401|token/i.test(e.message))authToken='';missionDetail(id)}
 finally{lockRun=false}
}
async function startTask(id){
 if(lockRun)return;
 const t=tasks.find(x=>x.id===id);if(!t)return;
 const global=t.scope==='global';const p=global?null:workspaces.find(x=>x.id===t.projectId);
 if(!global&&!p)return;if(!connectedBackend){alert('Acum funcționează doar dashboard-ul local. Pentru AI real pornește serverul Node.js din arhivă. Vezi README.');return}
 if(!configuredBackend){alert('Serverul există, dar cheia furnizorului AI selectat nu este configurată. Pentru Groq adaugă GROQ_API_KEY și AI_PROVIDER=groq în Vercel.');return}
 if(!authToken){authToken=prompt('Tokenul tău de acces (AGENT_CITY_ACCESS_TOKEN), păstrat doar în memoria paginii:')||'';if(!authToken)return}
 lockRun=true;t.status='running';refresh();missionDetail(t.id);
 try{
   let response=await fetch('/api/run',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+authToken},body:JSON.stringify({...(global?{scope:'global'}:{scope:'project',project:{name:p.name,category:p.category,description:p.description}}),task:{title:t.name,role:t.role},...(t.includeHunter?{hunterLeads:hunterMissionSnapshot()}: {})})});
   let data=await response.json();if(!response.ok)throw new Error(data.error||'Eroare server.');
   t.output=data.output;t.usage=data.usage||null;t.status='review';log('Livrabil pentru verificare: '+t.name.slice(0,60));
 }catch(error){t.status='failed';log('Eroare misiune: '+error.message);alert(error.message);if(/token|401|403|autentific/i.test(error.message))authToken=''}
 finally{lockRun=false;refresh();missionDetail(t.id)}
}
function openBuilding(b){
 const specialties={command:'Coordonare, misiuni și aprobări',market:'Specialiști disponibili',research:'Cercetare și oportunități',factory:'Producție și dezvoltare',armory:'QA, securitate și verificare',trading:'Analiza comercială și oferte',archive:'Proiecte și memorie',studio:'Branding și conținut'};
 modal(b.name,'DEPARTAMENT · AGENT CITY',`<p class="subtitle">${esc(specialties[b.id])}. Lucrează pentru proiectul selectat: <b>${esc(currentProject()?.name||'Niciun proiect')}</b>.</p>`+
 `<div class="projectToolbar"><button class="smallBtn" id="buildingNewTask">+ Creează misiune</button><button class="smallBtn" id="buildingProject">📁 Proiect activ</button><button class="smallBtn" id="buildingBoard">📋 Mission board</button></div>`+
 `<p class="note">Departamentul nu are acces la conturi externe sau bani. Orice execuție AI este pornită explicit de tine și produce doar un livrabil text.</p>`);
 $('#buildingNewTask').onclick=()=>newTask(b.id);$('#buildingProject').onclick=projectDetail;$('#buildingBoard').onclick=allTaskModal;
}
function backup(){let data={schema:2,exportedAt:new Date().toISOString(),projects:workspaces,tasks:tasks.filter(t=>t.projectId||t.scope==='global'),agents:agents};let blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});let u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='agent-city-os-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
function restoreBackup(file){
 if(!file)return;
 if(file.size>2000000){alert('Backup prea mare (maximum 2 MB).');return}
 file.text().then(content=>{
   let data=JSON.parse(content);
   if(data.schema!==2||!Array.isArray(data.projects)||!Array.isArray(data.tasks)||data.projects.length>300||data.tasks.length>5000)throw new Error('Format sau dimensiune incompatibilă.');
   if(!data.projects.every(p=>isProject(p)&&p.name.length<=90&&p.id.length<=80)||!data.tasks.every(t=>typeof t.id==='string'&&typeof t.projectId==='string'&&typeof t.name==='string'&&t.name.length<=4000))throw new Error('Datele conțin câmpuri invalide.');
   if(!confirm('Importul înlocuiește proiectele și misiunile locale curente. Continui?'))return;
   workspaces=data.projects.map(p=>({id:p.id,name:p.name,category:CATEGORY[p.category]?p.category:'other',description:String(p.description||'').slice(0,2500),repo:safeUrl(p.repo||''),status:p.status||'idea',sample:!!p.sample}));
   const ids=new Set(workspaces.map(p=>p.id));
   tasks=data.tasks.filter(t=>t.scope==='global'||ids.has(t.projectId)).map(t=>({id:t.id,projectId:t.scope==='global'?'':t.projectId,scope:t.scope==='global'?'global':'project',name:t.name,role:AGENT_ROLES[t.role]?t.role:'planner',includeHunter:t.includeHunter===true,status:['queued','review','done','failed'].includes(t.status)?t.status:'queued',created:t.created,output:String(t.output||'').slice(0,20000),usage:null}));
   currentProjectId=workspaces[0]?.id||'';saveProjects();refresh();log('Backup importat cu succes.');
 }).catch(e=>alert('Import eșuat: '+e.message)).finally(()=>{$('#restoreFile').value=''})
}
// Controls
$('#projectSelect').onchange=e=>selectProject(e.target.value);
$('#createProjectTop').onclick=()=>projectModal();
$('#createProjectSide').onclick=()=>projectModal();
$('#showProjectTasks').onclick=()=>allTaskModal('global');
$('#backupBtn').onclick=backup;
$('#restoreBtn').onclick=()=>$('#restoreFile').click();
$('#restoreFile').onchange=e=>restoreBackup(e.target.files?.[0]);
$('#missionBtn').onclick=()=>newTask('command','global');
$('#allTasks').onclick=()=>allTaskModal('global');
$('#addAgent').onclick=()=>{
 modal('Echipă de agenți','AGENT ROLES',`<p class="subtitle">Rolurile pot fi atribuite fiecărui proiect independent, fără costuri de recrutare virtuală.</p>`+Object.values(AGENT_ROLES).map(x=>`<div class="rowline">${esc(x)}<span class="badge">Disponibil</span></div>`).join('')+`<button class="action" id="toMission">+ Dă un task</button>`);$('#toMission').onclick=()=>newTask()
};
// Existing task entries in the old demo remain in storage but are never attributed to new projects.
for(let t of tasks){if(!t.projectId&&t.scope!=='global')t.status=t.status==='done'?'legacy':t.status}
refresh();probeBackend();
