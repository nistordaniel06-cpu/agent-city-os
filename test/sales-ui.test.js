'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const {webcrypto}=require('node:crypto');
const src=fs.readFileSync(path.join(__dirname,'..','public','admin','sales.js'),'utf8');
const page=fs.readFileSync(path.join(__dirname,'..','public','admin','index.html'),'utf8');
const routes=JSON.parse(fs.readFileSync(path.join(__dirname,'..','vercel.json'),'utf8')).routes;
test('Sales UI is included in admin routing and never stores plaintext CRM',()=>{
 assert.doesNotThrow(()=>new Function(src));
 assert.match(page,/data-section="sales"/);
 assert.match(page,/id="salesLeadList"/);
 assert.match(page,/id="salesOfferPanel"/);
 assert.match(page,/id="salesPaymentsPanel"/);
 assert.match(page,/src="\/admin\/sales\.js"/);
 assert.ok(routes.some(r=>r.src.includes('admin/sales')));
 assert.match(src,/AES-GCM/);
 assert.match(src,/PBKDF2/);
 assert.doesNotMatch(src,/localStorage\.setItem\([^,)]*,JSON\.stringify\(leads\)/);
 assert.doesNotMatch(src,/window\.location\s*=/);
 assert.doesNotMatch(src,/(?:mailTo|sendEmail|sendMessage)\(/);
});
class Element{
 constructor(tag){this.tag=tag;this.value='';this.checked=false;this.children=[];this.textContent='';this.classList={add(){},remove(){},toggle(){}};this.disabled=false;this.files=[];}
 append(...nodes){this.children.push(...nodes)}replaceChildren(...nodes){this.children=nodes}
 addEventListener(){}scrollIntoView(){}reset(){}click(){}
}
test('owner unlock encrypts saved leads; AI approval never sends anything',async()=>{
 const nodes=new Map();
 function getNode(id){if(!nodes.has(id))nodes.set(id,new Element(id));return nodes.get(id)}
 const store=new Map(),calls=[],messages=[];
 const fakeCrypto={subtle:webcrypto.subtle,getRandomValues:arr=>webcrypto.getRandomValues(arr),randomUUID:()=>String(store.size)+'-test-id'};
 const scope={document:{getElementById:getNode,createElement:tag=>new Element(tag),querySelectorAll:()=>[]},
  crypto:fakeCrypto,TextEncoder,TextDecoder,Uint8Array,
  atob:s=>Buffer.from(s,'base64').toString('binary'),btoa:s=>Buffer.from(s,'binary').toString('base64'),
  localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},
  navigator:{clipboard:{writeText:async x=>messages.push('copied:'+x)}},
  confirm:()=>true,alert:x=>messages.push(x),window:{},setTimeout:()=>1,URL:{createObjectURL:()=>'',revokeObjectURL:()=>{}},
  Blob:class{},console};
 vm.createContext(scope);vm.runInContext(src,scope);
 const catalog=require('../agency-sales');
 const api=async(path,options)=>{
  calls.push(path);
  if(path==='/api/admin/sales/packages')return {packages:Object.values(catalog.PACKAGES),extras:Object.values(catalog.EXTRAS)};
  if(path==='/api/admin/sales/draft')return {draft:'Draft de verificat, cu preț.',provider:'groq'};
  throw Error('Unwanted endpoint '+path);
 };
 const login=()=>scope.window.AgentCitySales.unlock('token-owner-test-1234567890',api);
 await login();
 getNode('salesNew').onclick();
 getNode('salesCompany').value='Client PRIVAT';
 getNode('salesRequirements').value='Doresc site nou';
 getNode('salesContact').value='Persoană PRIVATĂ';
 getNode('salesChannel').value='confidential@example.com';
 getNode('salesPackage').value='START';
 getNode('salesStage').value='lead';
 await getNode('salesForm').onsubmit({preventDefault(){}});
 const record=store.get('acity_sales_encrypted_v1');
 assert.ok(record);
 assert.equal(JSON.parse(record).version,1);
 assert.ok(!record.includes('Client PRIVAT'));
 assert.ok(!record.includes('confidential@example.com'));
 assert.equal(getNode('salesCountLeads').textContent,1);
 await getNode('salesGenerate').onclick();
 assert.equal(calls.filter(x=>x==='/api/admin/sales/draft').length,1);
 assert.ok(!store.get('acity_sales_encrypted_v1').includes('Draft de verificat'));
 getNode('salesApproveOffer').onclick&&await getNode('salesApproveOffer').onclick();
 assert.match(getNode('salesOfferStatus').textContent,/Aprobat/);
 assert.equal(calls.filter(x=>x.includes('/send')).length,0);
 scope.window.AgentCitySales.lock();
 assert.equal(getNode('salesLeadList').children.length,0);
 await login();
 assert.equal(getNode('salesCountLeads').textContent,1);
 scope.window.AgentCitySales.lock();
 await assert.rejects(scope.window.AgentCitySales.unlock('incorrect-token',api),/nu poate fi decriptat/);
});
