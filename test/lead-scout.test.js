'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {normalizeReddit,normalizeHN,scout,httpsSourceLink}=require('../lead-scout');
const now=Date.parse('2026-10-14T10:00:00Z');
const feed=`<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
  <entry><title>[Hiring] Need a web developer for WordPress</title><link href="https://www.reddit.com/r/forhire/comments/abc/hiring/"/><updated>2026-10-13T10:00:00Z</updated><content>Seeking a developer for a website. Contact foo@example.com</content></entry>
  <entry><title>[For Hire] I build websites</title><link href="https://www.reddit.com/r/forhire/comments/def/offer/"/><updated>2026-10-13T10:00:00Z</updated><content>Websites</content></entry>
  <entry><title>[Hiring] Need a mechanic</title><link href="https://www.reddit.com/r/forhire/comments/ghi/hiring/"/><updated>2026-10-13T10:00:00Z</updated><content>Fix a car</content></entry>
  <entry><title>[Hiring] Old app</title><link href="https://www.reddit.com/r/forhire/comments/jkl/hiring/"/><updated>2026-01-01T10:00:00Z</updated><content>software</content></entry>
  <entry><title>[Hiring] Bad external URL for web developer</title><link href="https://evil.example.org/r/forhire/comments/xyz"/><updated>2026-10-13T10:00:00Z</updated><content>site</content></entry>
 </feed>`;
const hn={hits:[{objectID:'12345',created_at:'2026-10-12T10:00:00Z',story_title:'Ask HN: Need help',comment_text:'We need automation of a website workflow.'},
 {objectID:'22222',created_at:'2026-10-12T10:00:00Z',comment_text:"I'm available for hire as a developer and looking for a job."},
 {objectID:'3333',created_at:'2026-10-12T10:00:00Z',comment_text:'What is a popular web framework?'}]};
test('keeps explicit hiring requests, not worker ads / irrelevant / old posts',()=>{
 const r=normalizeReddit(feed,now);assert.equal(r.length,1);assert.equal(r[0].kind,'request-for-work');assert.equal(r[0].verified,false);
 assert.match(r[0].description,/email omis/);assert.doesNotMatch(JSON.stringify(r),/foo@example.com/);
});
test('HN signals are unverified, recency-bounded and only canonical URLs',()=>{
 const r=normalizeHN(hn,now);assert.equal(r.length,1);assert.equal(r[0].source,'Hacker News');
 assert.equal(r[0].url,'https://news.ycombinator.com/item?id=12345');assert.equal(r[0].verified,false);
});
test('blocks attacker-controlled URL hosts and non-HTTPS links',()=>{
 assert.equal(httpsSourceLink('https://evil.example.com/p','www.reddit.com'),'');
 assert.equal(httpsSourceLink('http://www.reddit.com/r/forhire','www.reddit.com'),'');
 assert.equal(httpsSourceLink('https://www.reddit.com.evil.example/r','www.reddit.com'),'');
});
test('scouts only fixed endpoints, deduplicates HN hits, handles source error without false contract claims',async()=>{
 const seen=[];
 const mock=async(url)=>{
  seen.push(url);if(url.includes('reddit.com')) return {ok:true,headers:{get(){return '0'}},text:async()=>feed};
  if(url.includes('need+automation'))throw Error('Transient source error');
  return {ok:true,headers:{get(){return '0'}},text:async()=>JSON.stringify(hn)};
 };
 const out=await scout({fetcher:mock,now});
 assert.equal(seen.length,4);assert.ok(seen.every(u=>/^https:\/\/(www\.reddit\.com|hn\.algolia\.com)\//.test(u)));
 assert.equal(out.results.length,2);assert.equal(out.errors.length,1);
 assert.equal(out.results.filter(x=>x.source==='Hacker News').length,1);
 assert.match(out.notice,/Nu s-au trimis oferte/);
});
test('fail gracefully if every feed is unavailable',async()=>{
 const out=await scout({fetcher:async()=>{throw Error('blocked')},now});
 assert.equal(out.results.length,0);assert.equal(out.errors.length,4);
});
