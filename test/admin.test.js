'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

// Each test file runs in an independent worker; don't import server before setting a test token.
process.env.AGENT_CITY_ACCESS_TOKEN='test-only-admin-secret-minimum-32-characters';
delete process.env.HYAGENT_API_BASE_URL;
const {server}=require('../server');
const root=path.join(__dirname,'..');
const config=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
function getEndpoint(name){return config.routes.find(r=>r.src.includes(name))}

test('production maps admin HTML and JS while all privileged data stays behind bearer API',()=>{
 assert.ok(getEndpoint('admin/?'));
 assert.ok(getEndpoint('admin/admin'));
 assert.equal(fs.existsSync(path.join(root,'public/admin/index.html')),true);
 assert.equal(fs.existsSync(path.join(root,'public/admin/admin.js')),true);
 const page=fs.readFileSync(path.join(root,'public/admin/index.html'),'utf8');
 const ui=fs.readFileSync(path.join(root,'public/admin/admin.js'),'utf8');
 assert.match(page,/id="loginForm"/);
 assert.match(page,/id="dashboard"/);
 assert.match(page,/id="missionDialog"/);
 assert.match(page,/id="translationForm"|id="translateForm"/);
 assert.match(ui,/function logout\(/);
 assert.match(ui,/\/api\/admin\/status/);
 assert.match(ui,/Authorization:'Bearer '\+ownerToken/);
 assert.doesNotMatch(ui,/localStorage\.setItem\([^,\n]*ownerToken/i);
 assert.doesNotMatch(ui,/putStored\([^,\n]*ownerToken/i);
 assert.match(ui,/ownerToken='';state=null;/);
 assert.match(ui,/Code Reviewer/);
 assert.match(ui,/hyagent/);
});
test('owner-only status never includes credentials, and local admin serves shell',async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const base='http://127.0.0.1:'+server.address().port;
  const shell=await fetch(base+'/admin');
  assert.equal(shell.status,200);
  assert.match(shell.headers.get('content-type'),/text\/html/);
  assert.match(await shell.text(),/Controlul agenției/);
  const script=await fetch(base+'/admin/admin.js');
  assert.equal(script.status,200);
  assert.match(script.headers.get('content-type'),/javascript/);
  const absent=await fetch(base+'/api/admin/status');
  assert.equal(absent.status,401);
  const wrong=await fetch(base+'/api/admin/status',{headers:{Authorization:'Bearer invalid'}});
  assert.equal(wrong.status,401);
  const yes=await fetch(base+'/api/admin/status',{headers:{Authorization:'Bearer test-only-admin-secret-minimum-32-characters'}});
  assert.equal(yes.status,200);
  const status=await yes.json();
  assert.equal(status.admin,true);
  assert.equal(status.storage,'browser-localStorage');
  assert.equal(status.hyagent.configured,false);
  assert.ok(!JSON.stringify(status).includes('minimum-32-characters'));
  assert.ok(!JSON.stringify(status).includes('OPENAI_API_KEY'));
  const translateDenied=await fetch(base+'/api/hyagent/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'Salut',sourceLanguage:'Romanian',targetLanguage:'English'})});
  assert.equal(translateDenied.status,401);
  const translateConfigured=await fetch(base+'/api/hyagent/translate',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer test-only-admin-secret-minimum-32-characters'},body:JSON.stringify({text:'Salut',sourceLanguage:'Romanian',targetLanguage:'English'})});
  assert.equal(translateConfigured.status,503);
  const body=await translateConfigured.json();
  assert.match(body.error,/HYAGENT_API_BASE_URL/);
 }finally{
  await new Promise(resolve=>server.close(resolve));
 }
});
