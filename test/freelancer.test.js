'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {normalizeFreelancer,fetchFreelancer,API}=require('../freelancer');
const {createHunter}=require('../hunter');
const {estimate}=require('../estimator');
const payload={status:'success',result:{projects:[{id:123,title:'Landing page for a new startup',seo_url:'website-design/landing-page-123',description:'React web design',budget:{minimum:150,maximum:500},currency:{code:'USD'},time_submitted:1791913000,jobs:[{name:'React'},{name:'Design'}]},{id:124,title:'Bad link but known ID',seo_url:'javascript:bad.example',description:'Website',budget:{minimum:null,maximum:250},currency:{code:'EUR'}}]}};
test('Freelancer official project JSON normalized, links constrained, budgets exact',()=>{
 const r=normalizeFreelancer(payload);
 assert.equal(r.length,2);
 assert.equal(r[0].source,'Freelancer.com');assert.equal(r[0].kind,'marketplace-project');
 assert.equal(r[0].url,'https://www.freelancer.com/projects/website-design/landing-page-123');
 assert.equal(r[0].budget.maximum,500);assert.equal(r[0].budget.currency,'USD');
 assert.equal(r[1].url,'https://www.freelancer.com/projects/124');assert.equal(r[1].budget.minimum,null);
 assert.throws(()=>normalizeFreelancer({status:'error'}),/nevalid/);
});
test('Freelancer API uses OAuth only on GET official fixed HTTPS host, no writing',async()=>{
 let called=0;
 const fake=async(url,options)=>{
  called++;
  assert.equal(new URL(url).origin,'https://www.freelancer.com');
  assert.equal(new URL(url).pathname,new URL(API).pathname);
  assert.equal(new URL(url).searchParams.get('query'),'React website');
  assert.equal(options.method,'GET');assert.equal(options.headers['Freelancer-OAuth-V1'],'private-test-token');
  return {ok:true,headers:{get:()=>null},text:async()=>JSON.stringify(payload)};
 };
 const data=await fetchFreelancer({fetcher:fake,token:'private-test-token',query:'React website'});
 assert.equal(called,1);assert.equal(data.length,2);
 await assert.rejects(()=>fetchFreelancer({fetcher:fake,query:'React'}),/FLN_OAUTH_TOKEN/);
 await assert.rejects(()=>fetchFreelancer({fetcher:fake,token:'a',query:''}),/minimum 2/);
});
test('Hunter source selection avoids remote feeds when freelancer selected and never publishes',async()=>{
 let calls=[];
 const fake=async(url,options)=>{
  calls.push({url,method:options.method});
  if(!url.startsWith('https://www.freelancer.com/'))throw Error('Unexpected remote API call');
  return {ok:true,headers:{get:()=>null},text:async()=>JSON.stringify(payload)};
 };
 const h=createHunter({fetcher:fake,freelancerToken:'TOKEN'});
 const r=await h.search({source:'freelancer',query:'web',filter:'all',onlyContracts:true});
 assert.equal(calls.length,1);
 assert.equal(calls[0].method,'GET');
 assert.equal(r.errors.length,0);
 assert.ok(r.results.every(x=>x.source==='Freelancer.com'));
 assert.equal(r.results.length,2); // both descriptions match query
 assert.equal(r.sources[2].connected,true);
 const empty=createHunter({fetcher:fake});
 await assert.rejects(()=>empty.search({source:'freelancer',query:'web'}),/nu este conectat/);
});
test('Internal cost estimator calculates gross margin range; rejects invalid values',()=>{
 const x=estimate({minimumHours:8,maximumHours:16,hourlyRate:25,expenses:0,marginPercent:20});
 assert.equal(x.low,250);assert.equal(x.high,500);
 assert.throws(()=>estimate({minimumHours:16,maximumHours:8,hourlyRate:25}),/invalide/);
 assert.throws(()=>estimate({minimumHours:8,maximumHours:16,hourlyRate:25,marginPercent:100}),/invalide/);
});
