/* Agent City OS v4 - Hunter UI. Browser-only shortlist; no outreach of any kind. */
'use strict';
const HUNTER_KEY='agent_city_hunter_v4';
let hunterSaved=[];
try{const raw=JSON.parse(getLocal(HUNTER_KEY)||'[]');if(Array.isArray(raw))hunterSaved=raw.filter(x=>x&&typeof x.id==='string'&&typeof x.title==='string').slice(0,150)}catch{}
let hunterLatest=[];
let hunterCheckedAt='';
let hunterErrors=[];
let freelancerApiConnected=false;
const HUNTER_FILTERS={all:'Toate',web:'Websites',software:'Software & API',automation:'Automatizări AI',commerce:'Magazine online',design:'Design & UX',marketing:'Marketing & SEO'};
function hunterStore(){hunterSaved=hunterSaved.slice(-150);setLocal(HUNTER_KEY,JSON.stringify(hunterSaved))}
function hunterShort(id){return hunterSaved.find(x=>x.id===id)}
function hunterCard(o,mode='live'){
 const s=mode==='saved',title=esc(o.title),company=esc(o.company||'Companie nespecificată'),source=esc(o.source||'Manual'),link=safeUrl(o.url||'');
 const kind=({ 'contract-mention':'Mențiune contract/freelance','employment-mention':'Mențiune angajare',unspecified:'Tip neconfirmat','marketplace-project':'Proiect freelance (platformă)','request-for-work':'Cerere publică [Hiring] (neconfirmată)','lead-signal':'Posibilă nevoie de servicii (neconfirmată)'})[o.kind]||'Tip neconfirmat';
 const freshness=o.postedAt?new Date(o.postedAt).toLocaleDateString('ro-RO'):'Dată necunoscută';
 const idx=mode==='saved'?hunterSaved.findIndex(x=>x.id===o.id):hunterLatest.findIndex(x=>x.id===o.id);
 return `<article class="hunterItem"><div class="hunterMeta"><span>${source}</span><span>${esc(kind)}</span><span>${esc(freshness)}</span>${!s?`<span>Potrivire orientativă ${Number(o.score||0)}/100</span>`:''}</div>
 <h4>${title}</h4><p class="hunterCompany">${company}</p>
 ${o.budget?`<p class="hunterBudget">Buget declarat: ${esc(o.budget.minimum??'?')}–${esc(o.budget.maximum??'?')} ${esc(o.budget.currency||'')} · ${esc(o.budget.unit||'')} (de verificat)</p>`:''}
 <p>${esc((o.description||'Descriere indisponibilă').slice(0,350))}${(o.description||'').length>350?'…':''}</p>
 <div class="projectToolbar">${link?`<a class="smallBtn" href="${safeAttr(link)}" target="_blank" rel="noopener noreferrer">Verifică anunțul ↗</a>`:''}
 ${s?`<button class="smallBtn" data-hunter-draft="${idx}">✍️ Pregătește oferta</button><button class="smallBtn" data-hunter-estimate="${idx}">💰 Estimează</button><button class="smallBtn" data-hunter-state="${idx}">📋 Stare: ${esc(o.state||'Salvat')}</button><button class="smallBtn dangerBtn" data-hunter-del="${idx}">Șterge</button>`:`<button class="smallBtn approve" data-hunter-save="${idx}">+ Salvează oportunitatea</button>`}</div>
 ${s&&o.output?`<p class="hint">Oferta: ${o.state==='approved'?'aprobată pentru trimitere MANUALĂ':'schiță salvată'} — niciun mesaj trimis. <button class="smallBtn" data-hunter-view="${idx}">Vezi / editează</button></p>`:''}
 </article>`;
}
function hunterBindings(){
 document.querySelectorAll('[data-hunter-save]').forEach(b=>b.onclick=()=>{let o=hunterLatest[Number(b.dataset.hunterSave)];if(!o)return;
  if(hunterSaved.some(x=>x.url===o.url)){alert('Oportunitatea este deja salvată.');return}
  if(hunterSaved.length>=150){alert('Maximum 150 oportunități salvate. Șterge sau exportă câteva.');return}
  hunterSaved.push({...o,projectId:currentProjectId,state:'saved',output:'',savedAt:new Date().toISOString()});hunterStore();log('Hunter: oportunitate salvată, fără aplicare.');hunterResults();});
 document.querySelectorAll('[data-hunter-draft]').forEach(b=>b.onclick=()=>hunterDraftForm(Number(b.dataset.hunterDraft)));
 document.querySelectorAll('[data-hunter-estimate]').forEach(b=>b.onclick=()=>hunterEstimateForm(Number(b.dataset.hunterEstimate)));
 document.querySelectorAll('[data-hunter-view]').forEach(b=>b.onclick=()=>hunterEditDraft(Number(b.dataset.hunterView)));
 document.querySelectorAll('[data-hunter-del]').forEach(b=>b.onclick=()=>{let i=Number(b.dataset.hunterDel);if(!confirm('Ștergi oportunitatea salvată?'))return;hunterSaved.splice(i,1);hunterStore();hunterBoard()});
 document.querySelectorAll('[data-hunter-state]').forEach(b=>b.onclick=()=>{let x=hunterSaved[Number(b.dataset.hunterState)];if(!x)return;const states=['saved','drafted','approved','rejected'];x.state=states[(states.indexOf(x.state)+1)%states.length];hunterStore();hunterBoard()});
}
function hunterBoard(){
 modal('Hunter AI · Sales Desk','OPORTUNITĂȚI · FĂRĂ TRIMITERE AUTOMATĂ',`<p class="subtitle">Agent City caută zilnic semnale publice de clienți și poate pregăti oferte pentru orice industrie. <b>Lista zilnică funcționează fără chei API.</b> Căutarea avansată cere configurarea serverului. Anunțurile nu sunt garantat freelance și trebuie verificate la sursă. Datele salvate rămân doar în acest browser.</p>
 <div class="hunterStats"><span>📌 ${hunterSaved.length} salvate</span><span>✍️ ${hunterSaved.filter(x=>x.output).length} oferte</span><span>✅ ${hunterSaved.filter(x=>x.state==='approved').length} aprobate manual</span></div>
 <div class="projectToolbar"><button class="smallBtn approve" id="hunterLeadsOpen">🎯 Caută clienți (zilnic)</button><button class="smallBtn" id="hunterSearchOpen">🔎 Alte anunțuri</button><button class="smallBtn" id="hunterManualOpen">+ Adaugă anunț</button><button class="smallBtn" id="hunterExport">↓ Exportă oportunități</button></div>
 <h3 class="sectionTitle">LISTA TA DE OPORTUNITĂȚI</h3><div class="hunterList">${hunterSaved.slice().reverse().map(o=>hunterCard(o,'saved')).join('')||'<p class="emptyState">Nu ai salvat oportunități. Poți căuta în feedurile publice sau poți adăuga manual un anunț.</p>'}</div>
 <p class="note">Hunter nu trimite oferte, nu deschide conturi și nu acceptă contracte. „Aprobat” înseamnă doar că ai verificat textul pentru trimitere manuală.</p>`);
 $('#hunterLeadsOpen').onclick=hunterLeadsOpen;$('#hunterSearchOpen').onclick=hunterSearchForm;$('#hunterManualOpen').onclick=hunterManualForm;$('#hunterExport').onclick=hunterExport;hunterBindings();
 // Cards are rendered newest first; normalize handler indexes using data-index values from hunterCard.
}
// Daily leads are public read-only signals produced by GitHub Actions: no token, no outreach.
let hunterDailyReport = null;
let hunterDailySource = '';
async function hunterLeadsOpen(){
 modal('Hunter · Caută clienți','RAPORT PUBLIC · FĂRĂ CONTACTARE',`<p class="subtitle">Încarc lista zilnică de cereri și semnale publice. Nu reprezintă contracte confirmate.</p>`);
 try {
  // Scheduled commits may be blocked by Vercel's Verified Commits policy.
  // Read the public GitHub digest first so the UI stays fresh without a deploy.
  // Keep the bundled file as an offline/source-unavailable fallback.
  const sources=[
   {url:'https://raw.githubusercontent.com/nistordaniel06-cpu/agent-city-os/main/public/leads-daily.json',label:'GitHub (raport actualizat)'},
   {url:'/leads-daily.json',label:'Vercel (copie din deployment; poate fi veche)'}
  ];
  let lastError=null;
  for(const candidate of sources){
   const controller=new AbortController();
   const timeout=setTimeout(()=>controller.abort(),6500);
   try {
    const response=await fetch(candidate.url,{cache:'no-store',signal:controller.signal});
    if(!response.ok)throw Error('HTTP '+response.status);
    const report=await response.json();
    if(!report || !Array.isArray(report.results) || report.schema!==1)throw Error('Formatul raportului este invalid.');
    hunterDailyReport=report;
    hunterDailySource=candidate.label;
    hunterLeadsDisplay('all');
    return;
   }catch(e){lastError=e}
   finally{clearTimeout(timeout)}
  }
  throw lastError||Error('Nu pot încărca raportul Hunter.');
 }catch(e){
  modal('Hunter · Caută clienți','RAPORT NEDISPONIBIL',`<p class="note">${esc(String(e.message))}</p><p class="subtitle">Verifică raportul de rulare din <a href="https://github.com/nistordaniel06-cpu/agent-city-os/actions/workflows/hunter-daily.yml" target="_blank" rel="noopener noreferrer">GitHub Actions</a>. Lista este actualizată prin workflowul programat, nu prin trimiterea de mesaje automate.</p><button class="smallBtn" id="hunterLeadsBack">← Înapoi</button>`);
  $('#hunterLeadsBack').onclick=hunterBoard;
 }
}
function hunterLeadsDisplay(topic='all'){
 const report=hunterDailyReport;
 if(!report)return hunterLeadsOpen();
 const items=report.results.filter(x=>x&&typeof x.id==='string'&&typeof x.title==='string'&&typeof x.url==='string'&&Array.isArray(x.tags));
 const filtered=topic==='all'?items:items.filter(x=>x.tags.includes(topic));
 hunterLatest=filtered.slice(0,60);
 hunterCheckedAt=report.generatedAt||'';
 hunterErrors=report.errors||[];
 const generated=report.generatedAt?esc(new Date(report.generatedAt).toLocaleString('ro-RO')):'Nu a rulat încă';
 modal('Hunter · Clienți potențiali','CERERI PUBLICE · NEVERIFICATE',`<p class="subtitle"><b>Raport din ${generated}.</b> Sursă: ${esc(hunterDailySource||'necunoscută')}. ${filtered.length} semnale relevante din ${items.length} total. Cererile Reddit marcate [Hiring] au un indiciu mai puternic decât comentariile Hacker News, dar niciuna nu garantează un client sau un buget.</p>
 <label class="field">Domeniu <select id="hunterLeadsTopic"><option value="all">Toate industriile</option>${Object.entries(HUNTER_FILTERS).filter(([k])=>k!=='all').map(([k,v])=>`<option value="${k}" ${topic===k?'selected':''}>${esc(v)}</option>`).join('')}</select></label>
 <div class="projectToolbar"><button class="smallBtn" id="hunterLeadsReload">↻ Reîncarcă raportul</button><button class="smallBtn" id="hunterLeadsSaved">📌 Oportunități salvate</button><a class="smallBtn" href="https://github.com/nistordaniel06-cpu/agent-city-os/actions/workflows/hunter-daily.yml" target="_blank" rel="noopener noreferrer">Vezi automatizarea ↗</a></div>
 ${hunterErrors.length?`<p class="note">Surse temporar indisponibile: ${esc(hunterErrors.join('; ').slice(0,500))}</p>`:''}
 <div class="hunterList">${hunterLatest.slice(0,35).map(x=>hunterCard(x,'live')).join('')||'<p class="emptyState">Încă nu avem cereri relevante în filtrul ales. Poți schimba domeniul sau poți rula manual workflowul GitHub. Nu inventăm oportunități.</p>'}</div>
 <p class="note">Lista este publică pe GitHub și se actualizează printr-o verificare zilnică programată. Verifică anunțul, eligibilitatea și bugetul la sursă. Agent City nu trimite mesaje, oferte sau aplicații fără tine.</p>`);
 $('#hunterLeadsTopic').onchange=e=>hunterLeadsDisplay(e.target.value);
 $('#hunterLeadsReload').onclick=hunterLeadsOpen;
 $('#hunterLeadsSaved').onclick=hunterBoard;
 hunterBindings();
}
function hunterSearchForm(){
 modal('Căutare Hunter','SURSE OFICIALE · DOAR CITIRE',`<p class="subtitle">Surse: <a href="https://remoteok.com" target="_blank" rel="noopener noreferrer">Remote OK</a> și <a href="https://weworkremotely.com" target="_blank" rel="noopener noreferrer">We Work Remotely</a> și <a href="https://www.freelancer.com/jobs/" target="_blank" rel="noopener noreferrer">Freelancer.com</a> (necesită OAuth server-side). RSS/API oficiale, cu atribuire. Nu căutăm în conturi private sau site-uri care interzic automatizarea.</p>
 <form id="hunterSearchForm"><label class="field">Sursă<select id="hunterSource"><option value="all">Toate conectate</option><option value="remote">Remote OK + We Work Remotely</option><option value="freelancer" ${freelancerApiConnected?'':'disabled'}>Freelancer.com ${freelancerApiConnected?'conectat':'· necesită token OAuth'}</option></select></label><label class="field">Domeniu<select id="hunterFilter">${Object.entries(HUNTER_FILTERS).map(([v,n])=>`<option value="${v}">${esc(n)}</option>`).join('')}</select></label>
 <label class="field">Cuvinte relevante (obligatorii pentru Freelancer.com)<input id="hunterQuery" maxlength="90" placeholder="Ex: React, ecommerce, AI automation"></label>
 <label class="field" style="display:flex;align-items:center;gap:9px"><input type="checkbox" id="hunterContractOnly" style="width:auto" checked> Preferă doar proiecte/contracte (exclude angajările clare)</label><button class="action" type="submit">🌍 Caută anunțuri reale</button></form>
 <p class="note">Rezultatele provin din API/RSS ale surselor conectate; relevanța este euristică. Deschide fiecare anunț la sursă pentru a confirma că acceptă colaboratori.</p>
 <div class="projectToolbar"><button class="smallBtn" id="hunterManualFromSearch">+ Introdu manual</button><button class="smallBtn" id="hunterBack">← Înapoi</button></div>`);
 $('#hunterSearchForm').onsubmit=e=>{e.preventDefault();hunterSearchRun($('#hunterFilter').value,$('#hunterQuery').value,$('#hunterSource').value,$('#hunterContractOnly').checked)};
 $('#hunterManualFromSearch').onclick=hunterManualForm;$('#hunterBack').onclick=hunterBoard;
}
async function hunterSearchRun(filter,query,source='all',onlyContracts=true){
 if(lockRun)return;
 if(!connectedBackend){alert('Deschide aplicația din serverul Node.js. Fișierul demo local nu poate citi feeduri externe; poți adăuga anunțuri manual.');return}
 if(!await requireAccessToken())return;lockRun=true;
 modal('Hunter AI','CĂUTARE LA CERERE',`<p class="subtitle">Se consultă exclusiv sursele selectate, prin API/RSS oficial. Nu trimitem mesaje și nu aplicăm la proiecte.</p><p>Surse: Remote OK · We Work Remotely · Freelancer.com (doar cu OAuth)</p>`);
 try{const r=await fetch('/api/hunter/search',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+authToken},body:JSON.stringify({filter,query,source,onlyContracts})});const data=await r.json();if(!r.ok)throw new Error(data.error||'Căutarea a eșuat.');
  hunterLatest=data.results||[];hunterCheckedAt=data.checkedAt||'';hunterErrors=data.errors||[];hunterResults();log('Hunter: '+hunterLatest.length+' anunțuri în lista de evaluare.');
 }catch(e){alert('Hunter: '+e.message);hunterSearchForm()}
 finally{lockRun=false}
}
function hunterResults(){
 modal('Rezultate Hunter AI','ANUNȚURI REALE · VERIFICĂ SURSA',`<p class="subtitle">${hunterLatest.length} oportunități ordonate după potrivire orientativă · verificare feed ${hunterCheckedAt?esc(new Date(hunterCheckedAt).toLocaleString('ro-RO')):'necunoscută'}. Nu toate sunt freelance; oferta și eligibilitatea se verifică separat.</p>
 ${hunterErrors.length?`<p class="note">Unele surse nu au răspuns: ${esc(hunterErrors.join('; '))}</p>`:''}
 <div class="projectToolbar"><button class="smallBtn" id="hunterBackSearch">↻ Altă căutare</button><button class="smallBtn" id="hunterSavedResults">📌 Lista salvată</button></div>
 <div class="hunterList">${hunterLatest.slice(0,25).map(o=>hunterCard(o,'live')).join('')||'<p class="emptyState">Nu am primit rezultate potrivite. Modifică filtrul sau adaugă manual o oportunitate.</p>'}</div>
 <p class="hint">Sursa este menționată pe fiecare card și linkul duce direct la anunțul original.</p>`);
 $('#hunterBackSearch').onclick=hunterSearchForm;$('#hunterSavedResults').onclick=hunterBoard;hunterBindings();
}
function hunterManualForm(){
 modal('Oportunitate nouă','INTRODUCERE MANUALĂ',`<p class="subtitle">Adaugă un anunț găsit de tine. Noi nu îi verificăm automat conținutul și nu îl prezentăm drept contract confirmat.</p>
 <form id="hunterManual"><label class="field">Titlu<input id="hunterTitle" required maxlength="220" placeholder="Ex: Realizare website pentru firmă de transport"></label>
 <label class="field">Companie / client<input id="hunterCompany" maxlength="130" placeholder="Dacă apare în anunț"></label>
 <label class="field">Link public HTTPS<input id="hunterUrl" type="url" required maxlength="600" placeholder="https://site-exemplu.com/anunt"></label>
 <label class="field">Descriere<textarea id="hunterDescription" maxlength="1800" required placeholder="Copiază cerințele verificabile ale proiectului"></textarea></label>
 <button class="action" type="submit">📌 Salvează în listă</button></form>
 <div class="projectToolbar"><button class="smallBtn" id="hunterBackManual">← Înapoi</button></div>`);
 $('#hunterBackManual').onclick=hunterBoard;
 $('#hunterManual').onsubmit=e=>{e.preventDefault();const raw=$('#hunterUrl').value.trim();const u=safeUrl(raw);if(!u||!u.startsWith('https://')){alert('Este necesar un link HTTPS.');return}
  if(hunterSaved.some(x=>x.url===u)){alert('Anunțul este deja salvat.');return}if(hunterSaved.length>=150){alert('Lista a atins limita de 150.');return}
  hunterSaved.push({id:uid(),title:$('#hunterTitle').value.trim(),company:$('#hunterCompany').value.trim(),description:$('#hunterDescription').value.trim(),url:u,source:'Adăugat manual',kind:'unspecified',postedAt:null,score:0,projectId:currentProjectId,state:'saved',savedAt:new Date().toISOString(),output:''});hunterStore();hunterBoard();log('Hunter: oportunitate adăugată manual.');
 };
}
function hunterDraftForm(index){const item=hunterSaved[index];if(!item)return hunterBoard();
 const chosen=workspaces.find(p=>p.id===item.projectId)||currentProject();
 modal('Pregătește ofertă','DRAFT · NICIO TRIMITERE',`<p class="subtitle"><b>${esc(item.title)}</b><br>${esc(item.company||item.source)} · Verifică mai întâi anunțul și eligibilitatea pentru colaborare.</p>
 <form id="hunterDraftRequest"><label class="field">Proiect / profil care prezintă oferta<select id="hunterPitchProject">${workspaces.map(p=>`<option value="${safeAttr(p.id)}" ${p.id===chosen?.id?'selected':''}>${esc(p.name)}${p.sample?' (exemplu)':''}</option>`).join('')}</select></label>
 <p class="hint">Descrierea proiectului selectat va fi utilizată ca prezentare. Completează informații reale; AI nu va inventa referințe sau experiență.</p>
 <button class="action" type="submit">🤖 Generează draft AI</button></form>
 <div class="projectToolbar"><button class="smallBtn" id="hunterTemplate">📝 Folosește șablon fără AI</button><button class="smallBtn" id="hunterBackDraft">← Listă</button></div>
 <p class="note">AI generează numai text; niciun mesaj nu este expediat. Nu furniza parole, date confidențiale sau informații ale clienților.</p>`);
 $('#hunterBackDraft').onclick=hunterBoard;$('#hunterTemplate').onclick=()=>hunterEditDraft(index,true);
 $('#hunterDraftRequest').onsubmit=e=>{e.preventDefault();hunterDraftRun(index,$('#hunterPitchProject').value)};
}
async function hunterDraftRun(index,projectId){const item=hunterSaved[index],p=workspaces.find(x=>x.id===projectId);if(!item||!p)return;if(lockRun)return;
 if(!connectedBackend||!configuredBackend){alert('Pentru draft AI trebuie pornit serverul cu OPENAI_API_KEY. Poți folosi și șablonul manual.');return}
 if(!await requireAccessToken())return;lockRun=true;
 modal('Hunter AI','GENERARE SCHIȚĂ',`<p class="subtitle">AI pregătește propunerea pe baza profilului selectat. Nu verifică activitatea anunțului și nu trimite oferta.</p>`);
 try{const resp=await fetch('/api/hunter/draft',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+authToken},body:JSON.stringify({opportunity:{title:item.title,company:item.company,url:item.url,source:item.source,description:(item.description||'').slice(0,1800),kind:item.kind},profile:{name:p.name,description:p.description||'',category:p.category||'other'}})});
  const data=await resp.json();if(!resp.ok)throw new Error(data.error||'Eroare AI');item.output=data.output;item.projectId=p.id;item.state='drafted';hunterStore();hunterEditDraft(index);
 }catch(e){alert(e.message);hunterDraftForm(index)}finally{lockRun=false}
}
function hunterEditDraft(index,template=false){const o=hunterSaved[index];if(!o)return hunterBoard();
 const p=workspaces.find(x=>x.id===o.projectId);
 const fallback=`Hello,\n\nI'm interested in discussing ${o.title}.\n\n[Add only verified experience, relevant portfolio links and examples here.]\n\nCould you confirm the scope, timeline, budget, and whether independent contractors are eligible?\n\nThank you.`;
 const output=template?fallback:(o.output||fallback);
 modal('Oferta pentru aprobare','EDITARE MANUALĂ · NU SE TRIMITE',`<p class="subtitle"><b>${esc(o.title)}</b> · ${esc(o.source)} · ${esc(p?.name||'fără proiect asociat')}</p>
 <label class="field">Schiță editabilă<textarea id="hunterOfferText" rows="13" maxlength="12000">${esc(output)}</textarea></label>
 <div class="projectToolbar"><button class="smallBtn" id="hunterSaveDraft">💾 Salvează</button><button class="smallBtn approve" id="hunterApprove">✓ Aprob pentru trimitere MANUALĂ</button><button class="smallBtn" id="hunterCopyOffer">📋 Copiază</button><button class="smallBtn" id="hunterBackOffer">← Listă</button></div>
 <p class="note">Confirmă anunțul la sursă. Aprobare = pregătit pentru copiere; nicio ofertă nu este transmisă automat. Nu ai garantat un contract, venit sau termen.</p>`);
 function save(state){o.output=$('#hunterOfferText').value.trim();o.state=state;hunterStore()}
 $('#hunterSaveDraft').onclick=()=>{save('drafted');hunterBoard()};
 $('#hunterApprove').onclick=()=>{if(!$('#hunterOfferText').value.trim()){alert('Introdu textul ofertei.');return}if(!confirm('Ai verificat textul și anunțul? Oferta va fi DOAR marcată pentru trimitere manuală.'))return;save('approved');hunterBoard()};
 $('#hunterCopyOffer').onclick=async()=>{save('drafted');try{await navigator.clipboard.writeText(o.output);alert('Text copiat. Tu decizi dacă îl trimiți pe platforma oficială.')}catch{alert('Copiază manual textul selectat.')}};
 $('#hunterBackOffer').onclick=hunterBoard;
}
function hunterEstimateForm(index){
 const o=hunterSaved[index];if(!o)return hunterBoard();
 const current=o.estimateInputs||{minimumHours:8,maximumHours:24,hourlyRate:25,expenses:0,marginPercent:20};
 modal('Estimare ofertă','COST · DURATĂ · REZERVĂ',`<p class="subtitle"><b>${esc(o.title)}</b>. Valori introduse de tine, nu prețuri verificate. Poți schimba orice sumă.</p>
 <form id="hunterEstimate"><label class="field">Ore minime estimate<input id="heMin" type="number" min="1" max="2000" step="1" value="${current.minimumHours}"></label>
 <label class="field">Ore maxime estimate<input id="heMax" type="number" min="1" max="2000" step="1" value="${current.maximumHours}"></label>
 <label class="field">Cost orar intern (în moneda aleasă de tine)<input id="heRate" type="number" min="1" max="10000" step="1" value="${current.hourlyRate}"></label>
 <label class="field">Cheltuieli suplimentare<input id="heExpenses" type="number" min="0" step="1" value="${current.expenses}"></label>
 <label class="field">Marjă brută țintă (%)<input id="heMargin" type="number" min="0" max="70" step="1" value="${current.marginPercent}"></label>
 <button class="action" type="submit">Calculează și salvează</button></form>
 ${o.estimate?`<p class="hunterBudget">Interval intern: ${esc(o.estimate.low)}–${esc(o.estimate.high)} · verifică valuta separat</p>`:''}
 <button class="smallBtn" id="heBack">← Înapoi</button><p class="note">Preț intern orientativ ≠ ofertă trimisă. Nu comparăm cu bugetul clientului fără verificarea monedei, unității și domeniului.</p>`);
 $('#heBack').onclick=hunterBoard;
 $('#hunterEstimate').onsubmit=e=>{e.preventDefault();const x={minimumHours:Number($('#heMin').value),maximumHours:Number($('#heMax').value),hourlyRate:Number($('#heRate').value),expenses:Number($('#heExpenses').value),marginPercent:Number($('#heMargin').value)};
 if(Object.values(x).some(v=>!Number.isFinite(v))||x.minimumHours<=0||x.maximumHours<x.minimumHours||x.maximumHours>2000||x.hourlyRate<=0||x.hourlyRate>10000||x.expenses<0||x.marginPercent<0||x.marginPercent>70){alert('Verifică orele, costul, cheltuielile și marja.');return}
 const multiplier=1/(1-x.marginPercent/100);const round=v=>Math.ceil(v*100)/100;
 o.estimate={low:round((x.minimumHours*x.hourlyRate+x.expenses)*multiplier),high:round((x.maximumHours*x.hourlyRate+x.expenses)*multiplier)};o.estimateInputs=x;hunterStore();hunterEstimateForm(index);
 };
}
function hunterExport(){const blob=new Blob([JSON.stringify({schema:1,exportedAt:new Date().toISOString(),opportunities:hunterSaved},null,2)],{type:'application/json'});const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='agent-city-hunter-opportunities.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
$('#hunterOpenBtn').onclick=hunterBoard;
(async()=>{try{const r=await fetch('/api/health');const j=await r.json();freelancerApiConnected=!!j.freelancerConnected}catch{freelancerApiConnected=false}})();
// Buildings show a dedicated entry point to Hunter, keeping original departments intact.
const openBuildingBeforeHunter=openBuilding;
openBuilding=function(b){if(b.id==='research'||b.id==='trading')return hunterBoard();return openBuildingBeforeHunter(b)};
