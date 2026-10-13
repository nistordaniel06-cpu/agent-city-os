'use strict';
/** Public read-only lead signals. No login, contact lookup, automated outreach, bids, or AI costs.
 * Scan only fixed public sources once daily; all saved findings are public GitHub data. */
const crypto = require('node:crypto');
const HN_API = 'https://hn.algolia.com/api/v1/search_by_date';
const REDDIT_RSS = 'https://www.reddit.com/r/forhire/new/.rss';
const SEARCHES = ['looking for a developer', 'need a website', 'need automation'];
const MAX_BYTES = 1_500_000;
const TOPICS = Object.freeze({
  web: ['website', 'web site', 'wordpress', 'landing page', 'frontend', 'web developer', 'web design', 'web app'],
  automation: ['automation', 'automate', 'workflow', 'ai agent', 'chatbot', 'n8n', 'zapier', 'make.com'],
  commerce: ['shopify', 'ecommerce', 'e-commerce', 'online store', 'woocommerce', 'shop', 'storefront'],
  software: ['developer', 'software', 'app', 'backend', 'mobile app', 'api', 'saas', 'python', 'react'],
  design: ['design', 'logo', 'figma', 'ux', 'ui', 'brand'],
  marketing: ['seo', 'marketing', 'copywriting', 'social media', 'ads', 'content']
});
function clean(s, max = 400) {
  return String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]*>/g, ' ').replace(/&(?:amp|#38);/g, '&').replace(/&(?:lt|#60);/g, '<')
    .replace(/&(?:gt|#62);/g, '>').replace(/&(?:quot|#34);/g, '"').replace(/&(?:apos|#39);/g, "'")
    .replace(/&#(\d+);/g, (_, v) => String.fromCharCode(Number(v)))
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email omis]')
    .replace(/\s+/g, ' ').trim().slice(0, max);
}
function httpsSourceLink(value, hostname) {
  try {
    const u = new URL(String(value || ''));
    return u.protocol === 'https:' && !u.username && !u.password && u.hostname === hostname ? u.href : '';
  } catch { return ''; }
}
function iso(s) { const d = new Date(s); return Number.isFinite(d.getTime()) ? d.toISOString() : null; }
function categories(text) {
  const t = String(text).toLowerCase();
  // Word boundaries prevent false leads from app->'apply', design->'InDesign',
  // ui->'quite' or seo->'reason'. An empty list is better than noise.
  const termMatch = word => {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    return new RegExp('(?:^|[^a-z0-9])' + escaped + '(?=$|[^a-z0-9])', 'i').test(t);
  };
  return Object.entries(TOPICS).filter(([, keys]) => keys.some(termMatch)).map(([key]) => key);
}
function digest(s) { return crypto.createHash('sha256').update(s).digest('hex').slice(0, 16); }
function tagValue(entry, tag) {
  return (new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(entry) || [])[1] || '';
}
function normalizeReddit(xml, now = Date.now()) {
  if (typeof xml !== 'string' || !xml.includes('<feed')) throw Error('Reddit RSS indisponibil');
  const entries = [...xml.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi)].slice(0, 70);
  return entries.map(([, e]) => {
    const title = clean(tagValue(e, 'title'), 200);
    // Explicit demand only. [For Hire] means the person is offering work, not buying it.
    if (!/^\s*\[(?:hiring|task|paid)\]/i.test(title)) return null;
    const href = /<link\b[^>]*href=["']([^"']+)["']/i.exec(e)?.[1] || '';
    const url = httpsSourceLink(href.replace(/&amp;/g, '&'), 'www.reddit.com');
    if (!url) return null;
    const date = iso(clean(tagValue(e, 'updated') || tagValue(e, 'published'), 100));
    if (!date || now - Date.parse(date) > 45 * 86400000 || Date.parse(date) > now + 86400000) return null;
    const summary = clean(tagValue(e, 'content') || tagValue(e, 'summary'), 430);
    // Prioritize projects where the title itself names a service we can deliver.
    // Omit surveys, testimonial filming, academic studies, and similar tasks.
    if (/\b(selfie|film yourself|college student|survey|paid study|focus group|product testing|video testimonial)\b/i.test(title)) return null;
    const tags = categories(title);
    if (!tags.length) return null;
    return {id: 'reddit:' + digest(url), source: 'Reddit r/forhire', title, company: 'Autorul anunțului (neverificat)', url,
      description: summary, tags, postedAt: date, kind: 'request-for-work', score: Math.min(92, 50 + 7 * tags.length),
      verified: false};
  }).filter(Boolean);
}
function normalizeHN(json, now = Date.now()) {
  if (!json || !Array.isArray(json.hits)) throw Error('Răspuns HN nevalid');
  return json.hits.slice(0, 40).map(h => {
    if (!/^\d+$/.test(String(h.objectID || ''))) return null;
    const date = iso(h.created_at);
    if (!date || now - Date.parse(date) > 45 * 86400000 || Date.parse(date) > now + 86400000) return null;
    const description = clean(h.comment_text || h.story_text || '', 430);
    const title = clean(h.story_title || h.title || description.slice(0, 110), 200);
    const s = description.toLowerCase();
    // Generic technical discussions and HN recruitment threads are not clients.
    if (/who (?:is hiring|wants to be hired)/i.test(title)) return null;
    if (/\b(i am available for hire|i'm available for hire|looking for (?:a|my) job|job seeking|full.time position)\b/i.test(s)) return null;
    const buyerIntent = /\b(?:i|we|our team|my company|my business)\s+(?:(?:am|are)\s+)?(?:looking for|seeking|hiring)\s+(?:a |an |someone|help|developer|freelancer|agency|web)/i.test(s)
      || /\b(?:i|we|our team|my company|my business)\s+need\s+(?:someone|a developer|a designer|an agency|a freelancer|help with|a website|a web app|an app|a chatbot|automation|automating|an automation)/i.test(s)
      || /\b(?:we|i)\s+(?:can|would)\s+pay\s+(?:someone|for)\b/i.test(s)
      || /\b(?:can anyone|anyone available to)\s+.{0,70}\b(?:build|create|automate|develop)\b/i.test(s);
    if (!buyerIntent) return null;
    const tags = categories(s);
    if (!tags.length) return null;
    const url = httpsSourceLink('https://news.ycombinator.com/item?id=' + h.objectID, 'news.ycombinator.com');
    return {id:'hn:' + digest(url),source:'Hacker News',title,company:'Cerere posibilă (neconfirmată)',url,
      description, tags, postedAt:date, kind:'lead-signal',score:Math.min(72,30+6*tags.length),verified:false};
  }).filter(Boolean);
}
async function readLimited(fetcher, url, accept) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 11000);
  try {
    const res = await fetcher(url, {method:'GET',signal:controller.signal,
      headers:{'Accept': accept, 'User-Agent':'AgentCityOS/6.0 (+https://github.com/nistordaniel06-cpu/agent-city-os)'}});
    if (!res.ok) throw Error('HTTP ' + res.status);
    const headerLength = Number(res.headers?.get?.('content-length') || 0);
    if (headerLength > MAX_BYTES) throw Error('Sursă prea mare');
    const txt = await res.text();
    if (Buffer.byteLength(txt) > MAX_BYTES) throw Error('Sursă prea mare');
    return txt;
  } finally { clearTimeout(timer); }
}
async function scout({fetcher = globalThis.fetch, now = Date.now()} = {}) {
  const age = Math.floor((now - 45 * 86400000) / 1000);
  const requests = [{id:'reddit',url:REDDIT_RSS,kind:'atom'},...SEARCHES.map((q,i)=>({id:'hn'+i,url:HN_API+'?'+new URLSearchParams({query:q,tags:'comment',hitsPerPage:'35',numericFilters:'created_at_i>'+age}),kind:'json'}))];
  // Fixed documented endpoints, bounded fanout, no arbitrary URL input or stored credentials.
  const settled = await Promise.allSettled(requests.map(async r => {
    const raw = await readLimited(fetcher, r.url, r.kind === 'atom' ? 'application/atom+xml' : 'application/json');
    return r.kind === 'atom' ? normalizeReddit(raw, now) : normalizeHN(JSON.parse(raw), now);
  }));
  const errors = [], byUrl = new Map();
  settled.forEach((r,i)=>{
    if (r.status !== 'fulfilled') { errors.push(requests[i].id + ': ' + clean(r.reason?.message || r.reason, 85)); return; }
    r.value.forEach(v => { const old = byUrl.get(v.url); if (!old || v.score > old.score) byUrl.set(v.url, v); });
  });
  const results = [...byUrl.values()].sort((a,b)=>b.score-a.score || b.postedAt.localeCompare(a.postedAt)).slice(0,60);
  return {schema:1,generatedAt:new Date(now).toISOString(),results,errors,sources:[
    {name:'Reddit r/forhire',url:'https://www.reddit.com/r/forhire/',type:'cereri explicite [Hiring]'},
    {name:'Hacker News Search',url:'https://hn.algolia.com/',type:'semnale de nevoie (neconfirmate)'}],
    notice:'Date publice, fără verificarea identității sau a bugetului. Nu reprezintă contracte confirmate. Nu s-au trimis oferte sau mesaje. Lista zilnică este publică pe GitHub.'};
}
module.exports={scout,normalizeReddit,normalizeHN,categories,httpsSourceLink,TOPICS};
