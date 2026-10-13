'use strict';
// Vercel's Node request can have a pre-parsed .body; rehydrate a readable
// request for the existing private Node HTTP handler. No listener is opened.
const {PassThrough} = require('node:stream');
const {server} = require('../server');

module.exports = function handler(req, res) {
  const url = new URL(req.url || '/', 'https://agent-city.invalid');
  const pathname = url.pathname;
  // The GitHub proposal store is process-local in v5: Vercel functions do not
  // guarantee the same instance between prepare/approve requests. Fail closed.
  if (pathname.startsWith('/api/developer/')) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({error: 'Developer AI: draft PR indisponibil pe Vercel până la implementarea stocării persistente a aprobărilor.'}));
    return;
  }
  const stream = new PassThrough();
  stream.method = req.method;
  stream.url = req.url;
  stream.headers = req.headers;
  server.emit('request', stream, res);
  if (req.body !== undefined) {
    const serialized = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    stream.end(serialized);
  } else {
    req.pipe(stream);
  }
};
