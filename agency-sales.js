'use strict';
// Shared, deterministic pricing / validation for owner-approved proposals.
// Figures are illustrative launch prices in RON, not tax or accounting advice.
const PACKAGES=Object.freeze({
 START:Object.freeze({id:'START',name:'START · Prezență online',setupRon:1490,monthlyRon:149,deliverables:Object.freeze(['Site de prezentare (până la 5 secțiuni)','Servicii, galerie și contact WhatsApp','SEO tehnic de bază și design mobil'])}),
 GROW:Object.freeze({id:'GROW',name:'GROW · Clienți și programări',setupRon:2990,monthlyRon:299,deliverables:Object.freeze(['Tot ce include START','Integrare programări cu furnizor existent','Formular cereri și raportare contacte','Setări analitice și instruire de bază'])})
});
const EXTRAS=Object.freeze({
 copy:Object.freeze({id:'copy',name:'Copywriting suplimentar',ron:300}),
 localSeo:Object.freeze({id:'localSeo',name:'SEO local extins',ron:350}),
 automation:Object.freeze({id:'automation',name:'Automatizare simplă (după verificare)',ron:800})
});
const STAGES=Object.freeze({
 lead:'Lead nou',qualified:'Calificat',draft:'Ofertă în lucru',approved:'Ofertă aprobată',sent:'Trimis manual',
 negotiation:'Negociere',won:'Acceptat manual',in_progress:'În execuție',delivered:'Livrat manual',lost:'Pierdut'
});
function int(value,min,max,label){
 if(typeof value!=='number'||!Number.isSafeInteger(value)||value<min||value>max)throw Object.assign(new Error(label+' trebuie să fie întreg între '+min+' și '+max+'.'),{status:400});
 return value;
}
function validateEstimate(data){
 if(!data||typeof data!=='object'||Array.isArray(data)||!Object.hasOwn(PACKAGES,data.packageId))throw Object.assign(new Error('Alege un pachet START sau GROW.'),{status:400});
 const extras=data.extras===undefined?[]:data.extras;
 if(!Array.isArray(extras)||extras.length>3||new Set(extras).size!==extras.length||extras.some(x=>!Object.hasOwn(EXTRAS,x)))throw Object.assign(new Error('Opțiuni suplimentare invalide.'),{status:400});
 const extraWorkRon=int(data.extraWorkRon??0,0,20000,'Lucrări suplimentare');
 const discountRon=int(data.discountRon??0,0,20000,'Reducere');
 const internalCostRon=int(data.internalCostRon??0,0,50000,'Cost intern estimat');
 const advancePercent=int(data.advancePercent??50,0,100,'Procent avans');
 return {packageId:data.packageId,extras,extraWorkRon,discountRon,internalCostRon,advancePercent};
}
function estimate(input){
 const data=validateEstimate(input),pkg=PACKAGES[data.packageId];
 const extrasRon=data.extras.reduce((sum,id)=>sum+EXTRAS[id].ron,0);
 const subtotalRon=pkg.setupRon+extrasRon+data.extraWorkRon;
 if(data.discountRon>subtotalRon)throw Object.assign(new Error('Reducerea depășește valoarea lucrării.'),{status:400});
 const setupRon=subtotalRon-data.discountRon;
 const advanceRon=Math.round(setupRon*data.advancePercent/100);
 const outstandingRon=setupRon-advanceRon;
 return {...data,packageName:pkg.name,deliverables:pkg.deliverables,extrasRon,subtotalRon,setupRon,monthlyRon:pkg.monthlyRon,advanceRon,outstandingRon,
  estimatedGrossMarginRon:setupRon-data.internalCostRon,currency:'RON',
  disclaimer:'Preț orientativ, fără tratament TVA specificat. Nu reprezintă factură, plată primită sau acceptarea clientului.'};
}
function cleanString(v,max,label,mandatory=false){
 if(typeof v!=='string')throw Object.assign(new Error(label+' trebuie să fie text.'),{status:400});
 const text=v.trim();
 if(text.length>max||(mandatory&&!text))throw Object.assign(new Error(label+' este invalid.'),{status:400});
 return text;
}
function validateDraft(data){
 if(!data||typeof data!=='object'||Array.isArray(data)||data.consent!==true)throw Object.assign(new Error('Confirmă explicit generarea ofertei; nu se trimite către client.'),{status:400});
 const company=cleanString(data.company,120,'Compania',true);
 const requirements=cleanString(data.requirements,1800,'Cerințe',true);
 const recipient=cleanString(data.recipient||'',90,'Persoană de contact');
 const summary=estimate(data.estimate);
 return {company,requirements,recipient,estimate:summary};
}
function paidSummary(estimated, payments){
 const total=estimated.setupRon;
 if(!Array.isArray(payments)||payments.length>30)throw new Error('Registru plăți invalid.');
 let paidRon=0;
 for(const p of payments){paidRon+=int(p.amountRon,1,500000,'Plată')}
 return {paidRon,remainingRon:Math.max(0,total-paidRon),overpaymentRon:Math.max(0,paidRon-total),advanceCovered:paidRon>=estimated.advanceRon};
}
module.exports={PACKAGES,EXTRAS,STAGES,estimate,validateEstimate,validateDraft,paidSummary};
