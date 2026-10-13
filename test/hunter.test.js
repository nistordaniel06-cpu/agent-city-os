'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {createHunter,normalizeRemote,normalizeWWR,guessKind,score,validateProfile,FEEDS}=require('../hunter');
const exampleRemote=[{last_updated:1700000000,legal:'Attribute Remote OK'},
 {position:'Freelance Next.js Website Developer',company:'Acme',url:'https://remoteok.com/remote-jobs/test',description:'Project-based build landing page. Contract role.',tags:['react','web'],date:'2026-10-12T12:00:00Z'},
 {position:'Full-time Engineer',company:'Other',url:'https://evil.tld/phishing',description:'full-time',tags:[],date:'2026-10-11'}];
const rss=`<?xml version="1.0"?><rss><channel><item><title><![CDATA[Studio: Front-end Contractor]]></title><link>https://weworkremotely.com/remote-jobs/studio-front-end</link><pubDate>Mon, 12 Oct 2026 12:00:00 GMT</pubDate><description><![CDATA[<p>Contract engagement for web redesign.</p>]]></description></item><item><title>Bad</title><link>http://invalid.test/</link><description>Fake</description></item></channel></rss>`;
test('only canonical remote job URLs; no arbitrary source hosts',()=>{
 const out=normalizeRemote(exampleRemote);assert.equal(out.length,1);assert.equal(out[0].kind,'contract-mention');assert.equal(out[0].title,'Freelance Next.js Website Developer');
 const jobs=normalizeWWR(rss);assert.equal(jobs.length,1);assert.equal(jobs[0].source,'We Work Remotely');assert.match(jobs[0].description,/Contract engagement/);assert.equal(jobs[0].kind,'contract-mention');
 assert.equal(guessKind('Full-time Software Developer',''), 'employment-mention');
 assert.ok(score(out[0],'web','Next.js')>score({title:'Waiter',description:'bar',tags:[],kind:'unspecified'},'web','Next.js'));
});
test('only fixed official feeds, cache results and surface partial errors',async()=>{
 let called=[];const fake=async(url)=>{called.push(url);if(url===FEEDS[0].url)return {ok:true,headers:{get:()=>null},text:async()=>JSON.stringify(exampleRemote)};if(url===FEEDS[1].url)return {ok:true,headers:{get:()=>null},text:async()=>rss};throw Error('Unexpected URL')};
 const h=createHunter({fetcher:fake});const first=await h.search({filter:'web',query:'Developer'});
 assert.equal(called.length,2);assert.equal(first.totalExamined,2);assert.equal(first.errors.length,0);assert.ok(first.results.length>=1);
 const second=await h.search({filter:'all'});assert.equal(called.length,2);assert.equal(second.results.length,2);
 assert.ok(second.results.every(x=>x.url.startsWith('https://')));
});
test('one source can fail without disguising or inventing opportunities',async()=>{
 const h=createHunter({fetcher:async(url)=>{if(url.includes('remoteok'))throw Error('Connection failed');return {ok:true,headers:{get:()=>null},text:async()=>rss}}});
 const r=await h.search({});assert.equal(r.totalExamined,1);assert.equal(r.errors.length,1);assert.equal(r.results[0].source,'We Work Remotely');
});
test('AI proposal is a text draft and never a posted application',async()=>{
 let sent;const mock=async(url,options)=>{assert.equal(url,'https://api.openai.com/v1/responses');sent=JSON.parse(options.body);return {ok:true,json:async()=>({output:[{content:[{type:'output_text',text:'Draft proposal — verify portfolio first.'}]}],usage:{input_tokens:100,output_tokens:65}})}};
 const h=createHunter({fetcher:mock,openaiKey:'mock-secret'});
 const body={opportunity:{title:'Frontend contractor',description:'React website',url:'https://remoteok.com/remote-jobs/test',source:'Remote OK',company:'Acme'},profile:{name:'Web studio',description:'Building React websites',category:'web'}};
 assert.deepEqual(validateProfile(body),{opportunity:{...body.opportunity,kind:'unspecified'},profile:body.profile});
 const r=await h.draft(body);assert.equal(r.sent,false);assert.equal(r.delivery,'manual_only');assert.match(r.output,/Draft proposal/);assert.equal(sent.store,false);assert.match(sent.instructions,/Nu inventa/);
});
test('draft is disabled without key, manual public HTTPS input is permitted as text',async()=>{
 const h=createHunter();await assert.rejects(h.draft({}),/OPENAI_API_KEY/);
 const p={opportunity:{title:'Design site',description:'Make website',url:'https://example.org/requests/12',source:'Adăugat manual'},profile:{name:'Web studio',description:'UX design and sites'}};
 assert.equal(validateProfile(p).opportunity.source,'Adăugat manual');
 assert.throws(()=>validateProfile({...p,opportunity:{...p.opportunity,url:'http://127.0.0.1:3000/'}}),/HTTPS/);
});
