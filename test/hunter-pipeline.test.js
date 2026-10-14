'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','hunter-ui.js'),'utf8');
const publicSource=fs.readFileSync(path.join(__dirname,'..','public','hunter-ui.js'),'utf8');
function pipeline(){
 const start=source.indexOf('const HUNTER_STAGES=');
 const end=source.indexOf('function hunterCard(',start);
 assert.ok(start>=0&&end>start,'Pipeline helpers exist in app bundle');
 const context={Date,Object,String,Number};
 vm.createContext(context);
 vm.runInContext(source.slice(start,end),context);
 return context;
}
test('overdue action excludes completed and lost opportunities',()=>{
 const ctx=pipeline();
 assert.equal(vm.runInContext('hunterDue({state:"saved",nextActionAt:"2026-10-12"},"2026-10-14")',ctx),true);
 assert.equal(vm.runInContext('hunterDue({state:"won",nextActionAt:"2026-10-12"},"2026-10-14")',ctx),false);
 assert.equal(vm.runInContext('hunterDue({state:"lost",nextActionAt:"2026-10-12"},"2026-10-14")',ctx),false);
 assert.equal(vm.runInContext('hunterDue({state:"saved",nextActionAt:"2026-10-30"},"2026-10-14")',ctx),false);
 assert.equal(vm.runInContext('hunterDue({state:"saved",nextActionAt:"today"},"2026-10-14")',ctx),false);
});
test('sales pipeline prioritizes due work, then chosen priority',()=>{
 const ctx=pipeline();
 ctx.items=[
  {id:'a',state:'saved',priority:'low',score:10},
  {id:'b',state:'saved',priority:'high',score:60},
  {id:'c',state:'qualified',priority:'normal',score:20,nextActionAt:'2026-10-10'},
  {id:'d',state:'lost',priority:'high',score:95,nextActionAt:'2026-10-09'}
 ];
 assert.deepEqual(Array.from(vm.runInContext('hunterPipelineRows(items,"all","2026-10-14")',ctx),x=>x.id),['c','b','d','a']);
 assert.deepEqual(Array.from(vm.runInContext('hunterPipelineRows(items,"due","2026-10-14")',ctx),x=>x.id),['c']);
 assert.deepEqual(Array.from(vm.runInContext('hunterPipelineRows(items,"qualified","2026-10-14")',ctx),x=>x.id),['c']);
});
test('summary reflects only user-recorded pipeline stages',()=>{
 const ctx=pipeline();ctx.items=[
  {state:'approved',nextActionAt:'2026-10-12'},
  {state:'sent',nextActionAt:'2026-11-11'},
  {state:'followup',nextActionAt:'2026-10-10'},
  {state:'won',nextActionAt:'2026-10-10'},
  {state:'lost'}
 ];
 const result=vm.runInContext('hunterPipelineSummary(items,"2026-10-14")',ctx);
 assert.equal(result.total,5);assert.equal(result.due,2);
 assert.equal(result.ready,1);assert.equal(result.sent,2);assert.equal(result.won,1);
});
test('pipeline editor confirms manually sent milestones and source mirrors public bundle',()=>{
 assert.match(source,/function hunterPipelineEdit\(index\)/);
 assert.match(source,/data-hunter-pipeline/);
 assert.match(source,/id="hunterStageFilter"/);
 assert.match(source,/confirm\('Confirmi că această etapă reflectă o acțiune REALĂ/);
 assert.equal(source,publicSource);
});
