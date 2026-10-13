'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createDeveloper,validPath,parseRepo}=require('../github-developer');
const OLD='// original app\nconst title = "Old";\n';
const NEW='// updated app\nconst title = "New";\n';
const BASE='a'.repeat(40),BLOB='b'.repeat(40),TREE='c'.repeat(40),COMMIT='d'.repeat(40);
function mock({move=false}={}){
 const calls=[];
 const gh=async(method,route,body)=>{
  calls.push({method,route,body});
  if(route==='/repos/nistordaniel06-cpu/demo')return {full_name:'nistordaniel06-cpu/demo',default_branch:'main',archived:false};
  if(route==='/repos/nistordaniel06-cpu/demo/commits/main')return {sha:move&&calls.some(x=>x.method==='POST')?'e'.repeat(40):BASE};
  if(route===`/repos/nistordaniel06-cpu/demo/contents/src/app.js?ref=${BASE}`)return {type:'file',encoding:'base64',content:Buffer.from(OLD).toString('base64'),size:Buffer.byteLength(OLD),sha:BLOB};
  if(route===`/repos/nistordaniel06-cpu/demo/git/commits/${BASE}`)return {tree:{sha:TREE}};
  if(route==='/repos/nistordaniel06-cpu/demo/git/blobs')return {sha:BLOB};
  if(route==='/repos/nistordaniel06-cpu/demo/git/trees')return {sha:TREE};
  if(route==='/repos/nistordaniel06-cpu/demo/git/commits')return {sha:COMMIT};
  if(route==='/repos/nistordaniel06-cpu/demo/git/refs')return {ref:body.ref};
  if(route==='/repos/nistordaniel06-cpu/demo/pulls')return {html_url:'https://github.com/nistordaniel06-cpu/demo/pull/7',number:7};
  throw Error('Unexpected route: '+method+' '+route);
 };
 const developer=createDeveloper({githubToken:'test-token',githubOwner:'nistordaniel06-cpu',openaiKey:'test-openai',githubRequest:gh,modelDraft:async()=>({summary:'Actualizează titlul aplicației',changes:[{path:'src/app.js',content:NEW,reason:'Titlu nou'}]})});
 return {developer,calls};
}
const body={repo:'https://github.com/nistordaniel06-cpu/demo',project:'Site client',task:'Actualizează titlul',files:['src/app.js']};
test('safe file path limits and owner scoping',()=>{
 for(const path of ['README.md','src/app.js','site/index.html','test/example.py'])assert.equal(validPath(path),true,path);
 for(const path of ['../.env','src/../../server.js','.github/workflows/ci.yml','package.json','.env','src/.env.production','src/node_modules/a.js','foo//bar.js','/tmp/a.js','build/index.js','src/evil.sh','src/.git/config'])assert.equal(validPath(path),false,path);
 assert.equal(parseRepo(body.repo,'nistordaniel06-cpu'),'nistordaniel06-cpu/demo');
 assert.throws(()=>parseRepo('https://github.com/another-owner/demo','nistordaniel06-cpu'),/proprietarului/);
});
test('prepare proposes changes without writing to GitHub',async()=>{
 const {developer,calls}=mock();
 const r=await developer.prepare(body);
 assert.equal(r.repo,'nistordaniel06-cpu/demo');assert.equal(r.changes[0].content,NEW);
 assert.equal(calls.filter(x=>x.method==='POST').length,0);
 await assert.rejects(developer.publish({previewId:r.previewId}),/Aprobarea explicită/);
 assert.equal(calls.filter(x=>x.method==='POST').length,0);
});
test('explicit approval creates branch and draft PR, never merges',async()=>{
 const {developer,calls}=mock();const p=await developer.prepare(body);
 const r=await developer.publish({previewId:p.previewId,approval:'PUBLISH_DRAFT_PR'});
 assert.equal(r.number,7);assert.equal(r.draft,true);assert.equal(r.url,'https://github.com/nistordaniel06-cpu/demo/pull/7');
 const posts=calls.filter(x=>x.method==='POST');assert.deepEqual(posts.map(x=>x.route),[
 '/repos/nistordaniel06-cpu/demo/git/blobs','/repos/nistordaniel06-cpu/demo/git/trees','/repos/nistordaniel06-cpu/demo/git/commits','/repos/nistordaniel06-cpu/demo/git/refs','/repos/nistordaniel06-cpu/demo/pulls']);
 assert.equal(posts.at(-1).body.draft,true);assert.equal(posts.at(-1).body.base,'main');
 assert.equal(posts.at(-2).body.sha,COMMIT);
 assert.equal(calls.filter(x=>x.method==='PUT'||x.route.includes('/merges')).length,0);
 await assert.rejects(developer.publish({previewId:p.previewId,approval:'PUBLISH_DRAFT_PR'}),/nu există/);
});
test('rejects invalid filenames before any GitHub requests',async()=>{
 const {developer,calls}=mock();
 await assert.rejects(developer.prepare({...body,files:['.github/workflows/main.yml']}),/fișiere/);
 assert.equal(calls.length,0);
});
test('rejects advanced base ref before writing to GitHub',async()=>{
 // Simulate another collaborator moving base after planning.
 const movedCalls=[];let checks=0;
 const gh=async(method,route,requestBody)=>{
  movedCalls.push({method,route});
  if(route.endsWith('/commits/main')){checks++;return {sha: checks===1?BASE:'e'.repeat(40)}}
  if(route.endsWith('/contents/src/app.js?ref='+BASE))return {type:'file',encoding:'base64',content:Buffer.from(OLD).toString('base64'),size:OLD.length,sha:BLOB};
  if(route==='/repos/nistordaniel06-cpu/demo')return {full_name:'nistordaniel06-cpu/demo',default_branch:'main'};
  throw Error('Should not write to GitHub');
 };
 const moving=createDeveloper({githubToken:'x',githubOwner:'nistordaniel06-cpu',openaiKey:'x',githubRequest:gh,modelDraft:async()=>({summary:'Edit',changes:[{path:'src/app.js',content:NEW,reason:'update'}]})});
 const q=await moving.prepare(body);
 await assert.rejects(moving.publish({previewId:q.previewId,approval:'PUBLISH_DRAFT_PR'}),/s-a schimbat/);
 assert.equal(movedCalls.filter(c=>c.method==='POST').length,0);
});
