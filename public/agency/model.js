(function(root){
 'use strict';
 const stages=['draft','review','approved','published'];
 const labels={draft:'În lucru',review:'De aprobat',approved:'Aprobat',published:'Publicat manual'};
 function initial(){return {version:1,clients:[{id:'4men',name:'4MEN',tone:'Premium, prietenos, direct',brief:'Barbershop în Lujerului, București.'}],campaigns:[]};}
 function valid(d){
  if(!d||d.version!==1||!Array.isArray(d.clients)||!Array.isArray(d.campaigns)||d.clients.length>100||d.campaigns.length>500)throw Error('Backup invalid sau prea mare.');
  const text=(v,n)=>typeof v==='string'&&v.length<=n;
  const ids=new Set();
  for(const c of d.clients){if(!c||!text(c.id,100)||!c.id||ids.has(c.id)||!text(c.name,100)||!c.name.trim()||!text(c.tone,200)||!text(c.brief,4000))throw Error('Client invalid.');ids.add(c.id);}
  const campaigns=new Set();
  for(const c of d.campaigns){
   if(!c||!text(c.id,100)||!c.id||campaigns.has(c.id)||!ids.has(c.clientId)||!text(c.title,150)||!c.title.trim()||!text(c.brief,4000)||!text(c.output,20000)||!stages.includes(c.stage)||!['concept','reel','pr','caption'].includes(c.kind)||!text(c.date,10)||(c.date&&!/^\d{4}-\d{2}-\d{2}$/.test(c.date)))throw Error('Campanie invalidă.');
   campaigns.add(c.id);
  }
  // Return only recognized fields; never trust imported object properties.
  return {version:1,clients:d.clients.map(c=>({id:c.id,name:c.name,tone:c.tone,brief:c.brief})),campaigns:d.campaigns.map(c=>({id:c.id,clientId:c.clientId,title:c.title,brief:c.brief,kind:c.kind,date:c.date,output:c.output,stage:c.stage}))};
 }
 function revise(c,output){return {...c,output,stage:'draft'};}
 function transition(c,next){
  if(!stages.includes(next))throw Error('Stare invalidă.');
  if(next==='approved'&&c.stage!=='review')throw Error('Trimite întâi materialul la aprobare.');
  if(next==='published'&&c.stage!=='approved')throw Error('Aprobă materialul înainte să confirmi publicarea.');
  if(next!=='draft'&&!c.output.trim())throw Error('Adaugă mai întâi livrabilul.');
  return {...c,stage:next};
 }
 const api={initial,valid,revise,transition,labels};
 if(typeof module!=='undefined')module.exports=api;else root.AgencyModel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
