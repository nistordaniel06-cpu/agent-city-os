'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));

test('Vercel runs API through dedicated function rather than server.js', () => {
  assert.equal(config.version, 2);
  assert.deepEqual(config.builds[0], {src:'api/index.js', use:'@vercel/node'});
  assert.equal(config.builds.some(x => x.src === 'server.js'), false);
  assert.ok(fs.existsSync(path.join(root, 'api/index.js')));
});

test('Vercel ships static UI and routes only allowed browser files', () => {
  assert.deepEqual(config.builds[1], {src:'public/**', use:'@vercel/static'});
  const api = config.routes.find(x => x.dest === '/api/index.js');
  const index = config.routes.find(x => x.dest === '/public/index.html');
  const assets = config.routes.find(x => x.dest === '/public/$1');
  assert.ok(api && index && assets);
  assert.match('/api/health', new RegExp(api.src));
  assert.match('/api/hunter/search', new RegExp(api.src));
  assert.match('/', new RegExp(index.src));
  assert.doesNotMatch('/api/health', new RegExp(index.src));
  for (const file of ['multiproject.js', 'hunter-ui.js']) {
    assert.match('/' + file, new RegExp(assets.src));
    assert.ok(fs.existsSync(path.join(root, 'public', file)));
  }
  assert.doesNotMatch('/.env.example', new RegExp(assets.src));
  assert.doesNotMatch('/server.js', new RegExp(assets.src));
});
