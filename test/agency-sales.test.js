'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {PACKAGES,EXTRAS,STAGES,estimate,validateDraft,paidSummary}=require('../agency-sales');
const base={packageId:'START',extras:[],extraWorkRon:0,discountRon:0,internalCostRon:600,advancePercent:50};
test('START and GROW launch offers preserve monthly and one-time totals',()=>{
 const starter=estimate(base);
 assert.equal(starter.setupRon,1490);assert.equal(starter.monthlyRon,149);
 assert.equal(starter.advanceRon,745);assert.equal(starter.outstandingRon,745);
 assert.equal(starter.estimatedGrossMarginRon,890);
 const grow=estimate({...base,packageId:'GROW',extras:['copy','localSeo'],extraWorkRon:500,discountRon:200,advancePercent:40});
 assert.equal(grow.setupRon,3940);
 assert.equal(grow.monthlyRon,299);
 assert.equal(grow.advanceRon,1576);
 assert.equal(grow.outstandingRon,2364);
 assert.equal(grow.estimatedGrossMarginRon,3340);
 assert.equal(PACKAGES.GROW.setupRon,2990);assert.equal(EXTRAS.automation.ron,800);
 assert.equal(STAGES.sent,'Trimis manual');
});
test('pricing validator rejects negative amounts, discounts above total and invalid extras',()=>{
 assert.throws(()=>estimate({...base,extraWorkRon:-2}),/Lucrări/);
 assert.throws(()=>estimate({...base,discountRon:3000}),/depășește/);
 assert.throws(()=>estimate({...base,advancePercent:101}),/avans/);
 assert.throws(()=>estimate({...base,discountRon:2.5}),/Reducere/);
 assert.throws(()=>estimate({...base,extras:['copy','copy']}),/invalide/);
 assert.throws(()=>estimate({...base,extras:['unsafe']}),/invalide/);
 assert.throws(()=>estimate({...base,packageId:'UNKNOWN'}),/Alege/);
});
test('quote drafting requires explicit consent and refuses oversized customer descriptions',()=>{
 const valid={company:'Salon exemplu',requirements:'Un site pentru servicii și rezervări',recipient:'Administrator',estimate:base,consent:true};
 assert.equal(validateDraft(valid).estimate.setupRon,1490);
 assert.throws(()=>validateDraft({...valid,consent:false}),/Confirmă explicit/);
 assert.throws(()=>validateDraft({...valid,company:''}),/Compania/);
 assert.throws(()=>validateDraft({...valid,requirements:'x'.repeat(1801)}),/Cerințe/);
 assert.throws(()=>validateDraft({...valid,recipient:17}),/contact/);
});
test('payments are manual ledger entries and do not become bank-verified facts',()=>{
 const sums=paidSummary(estimate(base),[{amountRon:745},{amountRon:745}]);
 assert.equal(sums.paidRon,1490);assert.equal(sums.remainingRon,0);assert.equal(sums.advanceCovered,true);
 assert.equal(paidSummary(estimate(base),[{amountRon:2000}]).overpaymentRon,510);
 assert.throws(()=>paidSummary(estimate(base),[{amountRon:0}]),/Plată/);
});
