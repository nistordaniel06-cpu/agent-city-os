'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const file = path.join(__dirname, '..', 'hunter-ui.js');
const publicFile = path.join(__dirname, '..', 'public', 'hunter-ui.js');
const report = {schema:1,generatedAt:'2026-10-14T01:00:00Z',results:[],errors:[]};

function widget(fetcher) {
  const source = fs.readFileSync(file, 'utf8');
  const start = source.indexOf('async function hunterLeadsOpen(){');
  const end = source.indexOf('\nfunction hunterLeadsDisplay(', start);
  assert.ok(start !== -1 && end > start, 'Hunter daily loader exists');
  const context = {
    fetch: fetcher, setTimeout, clearTimeout, AbortController,
    hunterDailyReport: null, hunterDailySource: '',
    displayCount: 0, modal(){},
    hunterLeadsDisplay(){ context.displayCount++ },
    esc(value){ return String(value) },
    $(selector){ return {onclick: null} },
    hunterBoard(){}
  };
  vm.createContext(context);
  vm.runInContext(source.slice(start, end), context);
  return context;
}

test('fresh GitHub digest loads before deployment copy', async () => {
  const requests = [];
  const ui = widget(async url => {
    requests.push(url);
    return {ok:true,json:async()=>report};
  });
  await vm.runInContext('hunterLeadsOpen()', ui);
  assert.equal(requests.length, 1);
  assert.match(requests[0], /^https:\/\/raw\.githubusercontent\.com\/nistordaniel06-cpu\/agent-city-os\/main\/public\/leads-daily\.json$/);
  assert.equal(ui.hunterDailySource, 'GitHub (raport actualizat)');
  assert.equal(ui.displayCount, 1);
});

test('falls back to Vercel digest if GitHub is unreachable', async () => {
  const requests = [];
  const ui = widget(async url => {
    requests.push(url);
    if (url.startsWith('https://')) throw Error('Network failure');
    return {ok:true,json:async()=>report};
  });
  await vm.runInContext('hunterLeadsOpen()', ui);
  assert.equal(requests.length, 2);
  assert.equal(requests[1], '/leads-daily.json');
  assert.match(ui.hunterDailySource, /Vercel/);
  assert.equal(ui.displayCount, 1);
});

test('rejects an invalid GitHub report before trying the static backup', async () => {
  const requests = [];
  const ui = widget(async url => {
    requests.push(url);
    return {ok:true,json:async()=>url.startsWith('https://')?{schema:2,results:[]}:report};
  });
  await vm.runInContext('hunterLeadsOpen()', ui);
  assert.deepEqual(requests.map(url=>url.startsWith('https://')), [true,false]);
  assert.equal(ui.displayCount, 1);
  assert.match(ui.hunterDailySource, /Vercel/);
});

test('public Hunter bundle is identical to the source script', () => {
  assert.equal(fs.readFileSync(file, 'utf8'), fs.readFileSync(publicFile, 'utf8'));
});
