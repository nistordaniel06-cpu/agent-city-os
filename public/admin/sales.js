'use strict';
// Agency Sales MVP: zero third-party libraries; no automatic outreach or money movement.
// Client details are encrypted before browser persistence. Token remains only in page memory.
(()=>{
const $=id=>document.getElementById(id);
const KEY='acity_sales_encrypted_v1',MAX_LEADS=150;
let sessionToken='',key=null,salt=null,leads=[],selectedId='',api=null,catalog=null,busy=false,unlocked=false;
const enc=new TextEncoder(),dec=new TextDecoder();
const money=n=>Number(n||0).toLocaleString('ro-RO')+' lei';
const get=id=>$(id)?.value||'';
const text=(id,value)=>{if($(id))$(id).textContent=value};
function bytes64(bytes){let output='';for(let i=0;i<bytes.length;i+=8192)output+=String.fromCharCode(...bytes.slice(i,i+8192));return btoa(output)}
function from64(input){if(typeof input!=='string'||input.length>1800000)throw Error('Datele backupului sunt invalide.');const bin=atob(input);return Uint8Array.from(bin,c=>c.charCodeAt(0))}
async function derive(pass,s){const material=await crypto.subtle.importKey('raw',enc.encode(pass),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt:s,iterations:180000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
function validateEnvelope(obj){if(!obj||obj.version!==1||typeof obj.salt!=='string'||typeof obj.iv!=='string'||typeof obj.data!=='string')throw Error('Fișierul CRM criptat nu este valid.');return obj}
async function openEnvelope(obj,secret){validateEnvelope(obj);const s=from64(obj.salt),iv=from64(obj.iv);if(s.length!==16||iv.length!==12)throw Error('Parametrii criptografici sunt invalizi.');const derived=await derive(secret,s);
 let result;try{const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv},derived,from64(obj.data));result=JSON.parse(dec.decode(raw))}catch{throw Error('CRM-ul nu poate fi decriptat. Tokenul s-a schimbat sau backupul este corupt.')}
 if(!result||result.version!==1||!Array.isArray(result.leads)||result.leads.length>MAX_LEADS)throw Error('Format CRM invalid.');
 return {key:derived,salt:s,leads:result.leads};
}
async function persist(){
 if(!unlocked||!key)throw Error('CRM blocat.');
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,enc.encode(JSON.stringify({version:1,leads})));
 localStorage.setItem(KEY,JSON.stringify({version:1,salt:bytes64(salt),iv:bytes64(iv),data:bytes64(new Uint8Array(ciphertext))}));
}
function lock(){sessionToken='';key=null;salt=null;leads=[];selectedId='';api=null;catalog=null;unlocked=false;$('salesEditor')?.classList.add('hidden');$('salesLeadList')?.replaceChildren()}
async function unlock(token,authenticatedRequest){
 if(typeof token!=='string'||!token||typeof authenticatedRequest!=='function')throw Error('Autentificare necesară.');
 lock();
 const raw=localStorage.getItem(KEY);
 const restored=raw?await openEnvelope(JSON.parse(raw),token):{salt:crypto.getRandomValues(new Uint8Array(16)),leads:[],key:null};
 const derived=restored.key||await derive(token,restored.salt);
 const packages=await authenticatedRequest('/api/admin/sales/packages');
 if(!Array.isArray(packages.packages)||packages.packages.length!==2)throw Error('Catalogul de pachete nu este disponibil.');
 sessionToken=token;api=authenticatedRequest;key=derived;salt=restored.salt;leads=restored.leads;catalog=packages;unlocked=true;
 render();
}
function estimate(raw){
 const pkg=catalog?.packages.find(x=>x.id===raw.packageId);
 if(!pkg)throw Error('Alege un pachet disponibil.');
 const extraIds=raw.extras||[];
 if(new Set(extraIds).size!==extraIds.length||extraIds.some(id=>!catalog.extras.find(e=>e.id===id)))throw Error('Opțiuni suplimentare invalide.');
 const amount=(v,max,name)=>{if(!Number.isSafeInteger(v)||v<0||v>max)throw Error(name+' invalid.');return v};
 const additional=amount(raw.extraWorkRon,20000,'Lucrări'),discount=amount(raw.discountRon,20000,'Reducere');
 const internalCost=amount(raw.internalCostRon,50000,'Cost intern');
 const percentage=amount(raw.advancePercent,100,'Avans');
 const extrasRon=extraIds.reduce((total,id)=>total+catalog.extras.find(e=>e.id===id).ron,0);
 const subtotal=pkg.setupRon+extrasRon+additional;
 if(discount>subtotal)throw Error('Reducerea depășește prețul.');
 const total=subtotal-discount,advance=Math.round(total*percentage/100);
 return {packageId:pkg.id,packageName:pkg.name,extras:extraIds,extraWorkRon:additional,discountRon:discount,
  internalCostRon:internalCost,advancePercent:percentage,setupRon:total,monthlyRon:pkg.monthlyRon,
  advanceRon:advance,outstandingRon:total-advance,estimatedGrossMarginRon:total-internalCost};
}
function offerFingerprint(lead){return JSON.stringify([lead.company,lead.contact,lead.requirements,lead.pricing])}
function readForm(){
 const extras=[...document.querySelectorAll('[name="salesExtra"]:checked')].map(x=>x.value);
 const pricing={packageId:get('salesPackage'),extras,extraWorkRon:Number(get('salesExtraWork')),
  discountRon:Number(get('salesDiscount')),internalCostRon:Number(get('salesInternalCost')),advancePercent:Number(get('salesAdvance'))};
 estimate(pricing);
 const company=get('salesCompany').trim(),requirements=get('salesRequirements').trim(),contact=get('salesContact').trim(),
  channel=get('salesChannel').trim(),source=get('salesSource').trim(),notes=get('salesNotes').trim();
 if(!company||company.length>120||!requirements||requirements.length>1800||contact.length>90||channel.length>160||source.length>80||notes.length>2000)throw Error('Verifică numele firmei, cerințele și limitele câmpurilor.');
 return {company,contact,channel,source,requirements,pricing,stage:get('salesStage'),
  nextActionAt:get('salesNextAction'),deadline:get('salesDeadline'),notes};
}
function selected(){return leads.find(x=>x.id===selectedId)}
function newLead(){return{id:crypto.randomUUID(),company:'',contact:'',channel:'',source:'',requirements:'',pricing:{packageId:'START',extras:[],extraWorkRon:0,discountRon:0,internalCostRon:0,advancePercent:50},
 stage:'lead',nextActionAt:'',deadline:'',notes:'',offer:null,payments:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}}
function collectForm(lead){
 const data=readForm(),current=offerFingerprint(lead),next=offerFingerprint(data);
 if(current!==next&&lead.offer?.status==='approved'&&!confirm('Schimbările vor anula aprobarea ofertei. Continui?'))throw Error('Modificarea a fost anulată.');
 if(!Object.hasOwn({lead:1,qualified:1,draft:1,approved:1,sent:1,negotiation:1,won:1,in_progress:1,delivered:1,lost:1},data.stage))throw Error('Etapa este invalidă.');
 if(['approved','sent'].includes(data.stage)&&lead.offer?.status!=='approved'&&current===next)throw Error('Aprobă mai întâi textul ofertei.');
 if(['approved','sent'].includes(data.stage)&&current!==next)throw Error('Noua ofertă trebuie aprobată înainte de trimitere.');
 if(['sent','negotiation','won','in_progress','delivered'].includes(data.stage)&&data.stage!==lead.stage&&!confirm('Confirmi că această etapă a fost realizată în realitate, manual?'))throw Error('Etapa nu a fost confirmată.');
 Object.assign(lead,data,{updatedAt:new Date().toISOString()});
 if(current!==next&&lead.offer){lead.offer.status='draft';lead.offer.approvedAt=null;if(lead.stage==='approved'||lead.stage==='sent')lead.stage='draft'}
}
async function store(){await persist();render()}
function createNode(tag,cls,value){const node=document.createElement(tag);if(cls)node.className=cls;if(value!==undefined)node.textContent=String(value);return node}
function render(){
 if(!unlocked)return;
 text('salesCountLeads',leads.length);
 text('salesCountDrafts',leads.filter(l=>l.offer?.status==='draft').length);
 text('salesCountWon',money(leads.filter(l=>['won','in_progress','delivered'].includes(l.stage)).reduce((s,l)=>{try{return s+estimate(l.pricing).setupRon}catch{return s}},0)));
 text('salesCountDeposits',money(leads.reduce((n,l)=>n+(l.payments||[]).reduce((sum,p)=>sum+(Number(p.amountRon)||0),0),0)));
 renderList();if(selectedId&&selected())renderQuoteAndPayments();
}
function renderList(){
 const box=$('salesLeadList');if(!box)return;box.replaceChildren();
 const filter=get('salesFilter'),visible=leads.filter(l=>filter==='all'||l.stage===filter).slice().sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
 if(!visible.length){box.append(createNode('p','sub','Niciun client potențial pentru acest filtru.'));return}
 for(const lead of visible){
  const row=createNode('div','row'),info=createNode('div'),actions=createNode('div','actions');
  const gross=estimate(lead.pricing);info.append(createNode('b','',lead.company),createNode('small','',lead.stage+' · '+gross.packageId+' · '+money(gross.setupRon)+(lead.nextActionAt?' · Următoarea acțiune: '+lead.nextActionAt:'')));
  const edit=createNode('button','btn','Deschide');edit.type='button';edit.onclick=()=>editLead(lead.id);
  actions.append(edit);row.append(info,actions);box.append(row);
 }
}
function formFill(lead){
 $('salesForm').reset();text('salesEditorTitle',lead.company?'Lead · '+lead.company:'Lead nou');
 const mappings={salesCompany:lead.company,salesContact:lead.contact,salesChannel:lead.channel,salesSource:lead.source,salesRequirements:lead.requirements,salesPackage:lead.pricing.packageId,
  salesStage:lead.stage,salesExtraWork:lead.pricing.extraWorkRon,salesDiscount:lead.pricing.discountRon,
  salesInternalCost:lead.pricing.internalCostRon,salesAdvance:lead.pricing.advancePercent,salesNextAction:lead.nextActionAt,salesDeadline:lead.deadline,salesNotes:lead.notes};
 for(const [id,value]of Object.entries(mappings))$(id).value=value??'';
 for(const input of document.querySelectorAll('[name="salesExtra"]'))input.checked=(lead.pricing.extras||[]).includes(input.value);
 $('salesEditor').classList.remove('hidden');text('salesFeedback','');renderEstimate();renderQuoteAndPayments();
 $('salesEditor').scrollIntoView({behavior:'smooth',block:'start'});
}
function editLead(id){if(!unlocked)return;selectedId=id;const lead=selected();if(lead)formFill(lead)}
function startLead(){if(!unlocked)return;if(leads.length>=MAX_LEADS)return alert('Limită MVP: maximum '+MAX_LEADS+' leaduri per browser.');const lead=newLead();leads.unshift(lead);selectedId=lead.id;formFill(lead)}
function renderEstimate(){
 try{const form=readForm();const est=estimate(form.pricing);
  text('salesEstimate','Implementare: '+money(est.setupRon)+' · Lunar: '+money(est.monthlyRon)+
   ' · Avans solicitat: '+money(est.advanceRon)+' · Rest după avans: '+money(est.outstandingRon)+
   ' · Marjă brută estimată: '+money(est.estimatedGrossMarginRon)+
   '. Preț orientativ; taxele și costurile efective se verifică separat.');
 }catch(e){text('salesEstimate','Completează datele de bază și suma estimată: '+e.message)}
}
async function saveForm(e){
 if(e)e.preventDefault();const lead=selected();if(!lead)return;
 try{collectForm(lead);await store();text('salesFeedback','Salvat criptat pe acest dispozitiv.')}catch(err){text('salesFeedback',err.message)}
}
async function generate(){
 const lead=selected();if(!lead||busy)return;
 try{
  // Save current edited values first, before consent or AI processing.
  collectForm(lead);await store();
  if(!confirm('Trimiți către '+(catalog?.packages?.length?'furnizorul AI configurat':'AI')+' doar compania, persoana de contact, cerințele și estimarea? Notițele private NU sunt trimise. Nu se contactează clientul.'))return;
  busy=true;$('salesGenerate').disabled=true;text('salesFeedback','AI redactează o propunere pentru verificarea ta…');
  const result=await api('/api/admin/sales/draft',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({consent:true,company:lead.company,recipient:lead.contact,requirements:lead.requirements,estimate:lead.pricing})});
  lead.offer={text:String(result.draft||'').slice(0,12000),status:'draft',provider:result.provider||'AI',generatedAt:new Date().toISOString(),approvedAt:null};
  lead.stage='draft';lead.updatedAt=new Date().toISOString();await store();
  text('salesFeedback','Draft AI generat și salvat criptat. Citește și aprobă manual.');
 }catch(e){text('salesFeedback',e.message)}
 finally{busy=false;$('salesGenerate').disabled=false}
}
function renderQuoteAndPayments(){
 const l=selected();if(!l)return;
 $('salesOfferPanel').classList.toggle('hidden',!l.offer);
 $('salesPaymentsPanel').classList.toggle('hidden',!l.company);
 if(l.offer){$('salesOfferText').value=l.offer.text||'';
  text('salesOfferStatus',l.offer.status==='approved'?'Aprobat manual la '+(l.offer.approvedAt||'necunoscut'):'NEAPROBAT — necesită revizuirea ta');
  $('salesCopyOffer').disabled=l.offer.status!=='approved';
  $('salesMarkSent').disabled=l.offer.status!=='approved';
 }
 const est=estimate(l.pricing),payments=l.payments||[],paid=payments.reduce((sum,p)=>sum+(Number(p.amountRon)||0),0);
 text('salesPaymentSummary','Valoare implementare: '+money(est.setupRon)+' · Avans solicitat: '+money(est.advanceRon)+
  ' · Încasări declarate manual: '+money(paid)+' · Rest de încasat: '+money(Math.max(0,est.setupRon-paid))+
  (paid>est.setupRon?' · ATENȚIE: plată peste estimare':''));
 const rows=$('salesPaymentRows');rows.replaceChildren();
 for(const p of payments){const r=createNode('div','row');r.append(createNode('span','',money(p.amountRon)+' · '+String(p.receivedAt||'').slice(0,10)),
  createNode('small','',p.reference||'Fără referință'));rows.append(r)}
}
async function saveOffer(){
 const l=selected();if(!l?.offer)return;
 const next=get('salesOfferText').trim();if(!next||next.length>12000)return alert('Textul ofertei este invalid.');
 if(next!==l.offer.text){l.offer.text=next;l.offer.status='draft';l.offer.approvedAt=null;if(['approved','sent'].includes(l.stage))l.stage='draft'}
 try{await store();text('salesFeedback','Revizia este salvată. Aprobarea se face separat.')}catch(e){text('salesFeedback',e.message)}
}
async function approveOffer(){
 const l=selected();if(!l?.offer)return;
 if(get('salesOfferText').trim()!==l.offer.text)return alert('Mai întâi salvează revizia textului, apoi aprobă.');
 if(!confirm('Ai verificat manual prețul, condițiile, livrabilele și textul? Aprobi DOAR pentru copiere/trimitere manuală?'))return;
 l.offer.status='approved';l.offer.approvedAt=new Date().toISOString();l.stage='approved';l.updatedAt=new Date().toISOString();
 try{await store();text('salesFeedback','Oferta a fost aprobată, dar NU a fost trimisă.')}catch(e){text('salesFeedback',e.message)}
}
async function copyOffer(){
 const l=selected();if(!l?.offer||l.offer.status!=='approved'||get('salesOfferText').trim()!==l.offer.text)return alert('Trebuie să aprobi ultima versiune a textului înainte de copiere.');
 try{await navigator.clipboard.writeText(l.offer.text);text('salesFeedback','Copiat pentru trimitere manuală. Nu a fost expediat.')}catch{text('salesFeedback','Copiere indisponibilă; selectează și copiază textul manual.')}
}
async function markSent(){
 const l=selected();if(!l?.offer||l.offer.status!=='approved')return alert('Aprobă mai întâi oferta.');
 if(!confirm('Confirmi că ai TRIMIS personal oferta într-un alt canal? Aplicația nu poate verifica trimiterea.'))return;
 l.stage='sent';l.updatedAt=new Date().toISOString();
 try{await store();$('salesStage').value='sent';text('salesFeedback','Marcată ca trimisă manual.')}catch(e){text('salesFeedback',e.message)}
}
async function addPayment(){
 const l=selected();if(!l||!l.company)return;
 const amount=Number(get('salesPaymentAmount')),reference=get('salesPaymentReference').trim();
 if(!Number.isSafeInteger(amount)||amount<1||amount>500000||reference.length>90)return alert('Completează suma în lei întregi și o referință validă.');
 if(!confirm('Ai verificat deja încasarea de '+money(amount)+' în bancă / casierie? Această operație NU încasează bani.'))return;
 if(!Array.isArray(l.payments))l.payments=[];
 if(l.payments.length>=30)return alert('Limită MVP: 30 încasări per proiect.');
 l.payments.push({id:crypto.randomUUID(),amountRon:amount,reference,receivedAt:new Date().toISOString()});
 try{await store();$('salesPaymentAmount').value='';$('salesPaymentReference').value='';text('salesFeedback','Înregistrare manuală salvată criptat.')}catch(e){text('salesFeedback',e.message)}
}
function exportEncrypted(){
 const data=localStorage.getItem(KEY);
 if(!data)return alert('Nu există încă date CRM salvate.');const payload={schema:'agent-city-sales-backup-v1',exportedAt:new Date().toISOString(),envelope:JSON.parse(data)};
 const uri=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
 const a=createNode('a');a.href=uri;a.download='agent-city-sales-encrypted-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(uri),1500);
}
async function importEncrypted(){
 const file=$('salesImportFile').files?.[0];if(!file)return;
 try{
  if(file.size>1100000)throw Error('Backup prea mare.');
  const content=JSON.parse(await file.text());
  if(content?.schema!=='agent-city-sales-backup-v1')throw Error('Format backup invalid.');
  const old=await openEnvelope(content.envelope,sessionToken);
  if(!confirm('Înlocuiești toate cele '+leads.length+' leaduri locale cu cele '+old.leads.length+' din backup? Operația nu se poate anula.'))return;
  key=old.key;salt=old.salt;leads=old.leads;selectedId='';await persist();$('salesEditor').classList.add('hidden');render();
  alert('Backupul criptat a fost restaurat pe acest dispozitiv.');
 }catch(e){alert('Import eșuat: '+e.message)}
 finally{$('salesImportFile').value=''}
}
$('salesNew').onclick=startLead;
$('salesCancel').onclick=()=>{$('salesEditor').classList.add('hidden');selectedId=''};
$('salesFilter').onchange=renderList;
$('salesForm').onsubmit=saveForm;
$('salesForm').addEventListener('input',renderEstimate);
$('salesForm').addEventListener('change',renderEstimate);
$('salesGenerate').onclick=generate;
$('salesSaveOffer').onclick=saveOffer;
$('salesApproveOffer').onclick=approveOffer;
$('salesCopyOffer').onclick=copyOffer;
$('salesMarkSent').onclick=markSent;
$('salesAddPayment').onclick=addPayment;
$('salesExport').onclick=exportEncrypted;
$('salesImportButton').onclick=()=>$('salesImportFile').click();
$('salesImportFile').onchange=importEncrypted;
window.AgentCitySales={unlock,lock,render};
})();
