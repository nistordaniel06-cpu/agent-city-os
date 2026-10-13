'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const path=require('node:path');
function listen(server){return new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))}
test('AI draft endpoint requires bearer token and sends scoped brief to provider',async()=>{
 let providerCalls=0,lastRequest=null;
 const mock=http.createServer(async(req,res)=>{
  providerCalls++;let chunks=[];for await(const c of req)chunks.push(c);
  lastRequest=JSON.parse(Buffer.concat(chunks).toString());
  res.writeHead(200,{'Content-Type':'application/json'});
  res.end(JSON.stringify({output:[{type:'message',content:[{type:'output_text',text:'MVP joc: plan verificabil, fără publicare.'}]}],usage:{input_tokens:100,output_tokens:30}}));
 });
 await listen(mock);
 const providerPort=mock.address().port;
 // Require after configuration; separate test file is executed by Node test runner in its own worker.
 process.env.OPENAI_API_KEY='test-only-key';process.env.AGENT_CITY_ACCESS_TOKEN='test-very-long-secret';
 process.env.OPENAI_API_BASE_URL=`http://127.0.0.1:${providerPort}`;
 const {server}=require('../server');await listen(server);
 try{
  const u=`http://127.0.0.1:${server.address().port}/api/run`;
  const payload={project:{name:'Joc puzzle',category:'game',description:'Puzzle mobile MVP'},task:{title:'Scrie plan de MVP',role:'planner'}};
  const options={method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)};
  const unauthorized=await fetch(u,options);assert.equal(unauthorized.status,401);assert.equal(providerCalls,0);
  const authorized=await fetch(u,{...options,headers:{...options.headers,Authorization:'Bearer test-very-long-secret'}});
  assert.equal(authorized.status,200);
  const result=await authorized.json();assert.match(result.output,/plan verificabil/);
  assert.equal(result.usage.output_tokens,30);assert.equal(providerCalls,1);
  assert.match(lastRequest.input,/Joc puzzle/);assert.match(lastRequest.input,/Scrie plan de MVP/);
  assert.equal(lastRequest.store,false);assert.ok(!JSON.stringify(lastRequest).includes('salon'));
 }finally{await new Promise(resolve=>server.close(resolve));await new Promise(resolve=>mock.close(resolve))}
});
