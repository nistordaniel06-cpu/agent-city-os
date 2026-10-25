'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const project=path.join(__dirname,'..');
const conf=JSON.parse(fs.readFileSync(path.join(project,'vercel.json'),'utf8'));

test('Vercel deploys the API from its dedicated serverless entrypoint, not server.js',()=>{
  assert.equal(conf.version,2);
  assert.deepEqual(conf.builds[0],{src:'api/index.js',use:'@vercel/node'});
  assert.equal(conf.builds.some(x=>x.src==='server.js'),false);
  assert.ok(fs.existsSync(path.join(project,'api','index.js')));
});
test('Vercel includes static frontend and strictly maps known asset routes',()=>{
  assert.deepEqual(conf.builds[1],{src:'public/**',use:'@vercel/static'});
  const api=conf.routes.find(x=>x.dest==='/api/index.js');
  const root=conf.routes.find(x=>x.src==='^/$');
  assert.equal(root.dest,'/public/agency/index.html');
  assert.ok(conf.routes.some(x=>x.dest==='/public/index.html' && new RegExp(x.src).test('/city')));
  const assets=conf.routes.find(x=>x.dest==='/public/$1');
  assert.ok(api && root && assets);
  assert.match('/api/health',new RegExp(api.src));
  assert.match('/api/hunter/search',new RegExp(api.src));
  assert.match('/',new RegExp(root.src));
  assert.doesNotMatch('/api/health',new RegExp(root.src));
  for(const s of ['multiproject.js','hunter-ui.js','leads-daily.json']){
    assert.match('/'+s,new RegExp(assets.src));
    assert.ok(fs.existsSync(path.join(project,'public',s)));
  }
  assert.doesNotMatch('/.env.example',new RegExp(assets.src));
  assert.doesNotMatch('/server.js',new RegExp(assets.src));
});

