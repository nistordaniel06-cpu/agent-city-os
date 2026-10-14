'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const workflow=fs.readFileSync(path.join(__dirname,'..','.github','workflows','code-review-groq.yml'),'utf8');
const source=fs.readFileSync(path.join(__dirname,'..','multiproject.js'),'utf8');
const publicSource=fs.readFileSync(path.join(__dirname,'..','public','multiproject.js'),'utf8');

test('GitHub Action uses pinned OpenCodeReview and Groq with safe permissions, no merge',()=>{
 assert.match(workflow,/pull_request_target:/);
 assert.match(workflow,/head\.repo\.full_name == github\.repository/);
 assert.match(workflow,/contents: read/);
 assert.match(workflow,/pull-requests: write/);
 assert.match(workflow,/OCR_GROQ_API_KEY/);
 assert.match(workflow,/if \[ -z "\$GROQ_OCR_API_KEY" \]/);
 assert.match(workflow,/echo "configured=false" >> "\$GITHUB_OUTPUT"/);
 assert.match(workflow,/if: steps\.configuration\.outputs\.configured == 'true'/);
 assert.match(workflow,/uses: nistordaniel06-cpu\/open-code-review@[a-f0-9]{40}/);
 assert.match(workflow,/ocr_version: '1\.13\.0'/);
 assert.match(workflow,/llm_url: 'https:\/\/api\.groq\.com\/openai\/v1\/chat\/completions'/);
 assert.match(workflow,/llm_model: 'openai\/gpt-oss-20b'/);
 assert.match(workflow,/review_concurrency: '1'/);
 assert.match(workflow,/max_tokens_budget: '8000'/);
 assert.doesNotMatch(workflow,/(\n|\s)(?:gh pr merge|merge_pull_request|git push|pull-requests: write.*contents: write)/);
 assert.doesNotMatch(workflow,/uses: nistordaniel06-cpu\/open-code-review@(?:main|master|v\d)/);
});
test('Code Reviewer stays in source/published UI and is presented as real integration',()=>{
 assert.equal(source,publicSource);
 assert.match(source,/function showCodeReviewer\(\)/);
 assert.match(source,/id="openCodeReview"/);
 assert.match(source,/PR Reviews/);
 assert.match(source,/GitHub Actions/);
 assert.match(source,/OCR_GROQ_API_KEY/);
 assert.match(source,/function loadCodeReviewStatus\(\)/);
});
test('Code Review PR links are restricted to positive numbers and public repo',()=>{
 const start=source.indexOf("const CODE_REVIEW_REPO=");
 const stop=source.indexOf("function displayProjects(){",start);
 assert.ok(start>0&&stop>start,'Review-only script exists');
 const context={Number,String,Promise,Array,Date};
 vm.createContext(context);
 vm.runInContext(source.slice(start,stop),context);
 context.positive=3;context.unsafe='javascript:alert(1)';
 assert.equal(vm.runInContext('codeReviewItemURL(positive)',context),'https://github.com/nistordaniel06-cpu/agent-city-os/pull/3');
 assert.equal(vm.runInContext('codeReviewItemURL(unsafe)',context),'');
 assert.equal(vm.runInContext('codeReviewItemURL(-1)',context),'');
});
test('Code Reviewer escapes GitHub titles and shows actual public workflow runs',async()=>{
 const start=source.indexOf("const CODE_REVIEW_REPO=");
 const stop=source.indexOf("function displayProjects(){",start);
 const elements={'#codeReviewPulls':{innerHTML:''},'#codeReviewRuns':{innerHTML:''}};
 let requests=[];
 const context={
  Number,String,Promise,Array,Date,
  $:s=>elements[s]||null,
  esc:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),
  fetch:async url=>{
   requests.push(url);
   return {ok:true,json:async()=>url.includes('/pulls?')?[{number:12,title:'PR <img src=x onerror=alert(1)>'}]:
    {workflow_runs:[{id:12345,status:'completed',conclusion:'success',pull_requests:[{number:12}]}]}}
  }
 };
 vm.createContext(context);
 vm.runInContext(source.slice(start,stop),context);
 await vm.runInContext('loadCodeReviewStatus()',context);
 assert.equal(requests.length,2);
 assert.ok(requests.every(url=>url.startsWith('https://api.github.com/repos/nistordaniel06-cpu/agent-city-os/')));
 assert.match(elements['#codeReviewPulls'].innerHTML,/PR &lt;img src=x/);
 assert.doesNotMatch(elements['#codeReviewPulls'].innerHTML,/<img src=x/);
 assert.match(elements['#codeReviewPulls'].innerHTML,/agent-city-os\/pull\/12/);
 assert.match(elements['#codeReviewRuns'].innerHTML,/agent-city-os\/actions\/runs\/12345/);
});
