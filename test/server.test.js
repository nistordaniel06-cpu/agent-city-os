const test=require('node:test');
const assert=require('node:assert/strict');
const {server,validatePayload,extractOutput}=require('../server');
const GOOD={project:{name:'Joc mobil',description:'MVP puzzle',category:'game'},task:{title:'Plan MVP',role:'planner'}};

test('Validation accepts universal category and supported role',()=>{assert.equal(validatePayload(GOOD),null)});
test('Validation rejects missing project, unknown roles and excessive payloads',()=>{
 assert.ok(validatePayload({}));assert.ok(validatePayload({...GOOD,task:{...GOOD.task,role:'hacker'}}));
 assert.ok(validatePayload({...GOOD,task:{...GOOD.task,title:'x'.repeat(5000)}}));
});
test('Output parser gathers messages safely',()=>{
 assert.equal(extractOutput({output:[{type:'message',content:[{type:'output_text',text:'Salut'},{type:'output_text',text:'Rezultat'}]}]}),'Salut\nRezultat');
});
test('HTTP serves app and health without exposing keys',async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const port=server.address().port;
  const h=await (await fetch(`http://127.0.0.1:${port}/api/health`)).json();
  assert.equal(h.product,'agent-city-os');assert.equal(h.dataLocation,'browser-localStorage');
  assert.equal(h.apiKey,undefined);
  const home=await (await fetch(`http://127.0.0.1:${port}/`)).text();assert.ok(home.includes('AGENT CITY'));
  const css=await fetch(`http://127.0.0.1:${port}/../server.js`);assert.equal(css.status,404);
  const post=await fetch(`http://127.0.0.1:${port}/api/run`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(GOOD)});
  assert.ok([401,503].includes(post.status));
 }finally{await new Promise(resolve=>server.close(resolve))}
});
