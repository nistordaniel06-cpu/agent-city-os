'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
process.env.AGENT_CITY_ACCESS_TOKEN='agency-test-access';
process.env.DEEPSEEK_API_KEY='server-secret';process.env.DEEPSEEK_MODEL='test-model';
const {server}=require('../server');
test('agency routes preserve legacy app, protect providers and reject invalid requests',async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 try{
  let r=await fetch(base+'/');assert.match(await r.text(),/Creative|CREATIVE STUDIO/);
  r=await fetch(base+'/city');assert.equal(r.status,200);assert.match(await r.text(),/multiproject.js/);
  r=await fetch(base+'/api/agency/providers');assert.equal(r.status,401);
  r=await fetch(base+'/api/agency/providers',{headers:{Authorization:'Bearer agency-test-access'}});assert.equal(r.status,200);const body=await r.text();assert.ok(!body.includes('server-secret'));assert.match(body,/deepseek/);
  r=await fetch(base+'/api/agency/creative',{method:'POST',headers:{Authorization:'Bearer agency-test-access','Content-Type':'application/json'},body:JSON.stringify({provider:'deepseek',consent:false})});assert.equal(r.status,400);
  for(const asset of ['app.js','model.js','style.css'])assert.equal((await fetch(base+'/agency/'+asset)).status,200);
  assert.equal((await fetch(base+'/agency/../../.env')).status,404);
 }finally{await new Promise(r=>server.close(r));}
});
