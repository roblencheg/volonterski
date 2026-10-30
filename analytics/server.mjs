import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { createHash, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

const port = Number(process.env.PORT || 3090);
const dbFile = process.env.DATA_FILE || './data/analytics.sqlite';
const siteOrigin = new URL(process.env.SITE_ORIGIN || 'https://volonterski.ru').origin;
const user = process.env.ADMIN_USER || '';
const password = process.env.ADMIN_PASSWORD || '';
const secret = process.env.SESSION_SECRET || '';
if (!user || password.length < 16 || secret.length < 32) throw Error('Set ADMIN_USER, ADMIN_PASSWORD (16+), SESSION_SECRET (32+)');
mkdirSync(dirname(dbFile),{recursive:true});
const db = new DatabaseSync(dbFile);
db.exec([
  'PRAGMA journal_mode=WAL',
  'PRAGMA busy_timeout=5000',
  'CREATE TABLE IF NOT EXISTS daily(day TEXT PRIMARY KEY,views INTEGER NOT NULL DEFAULT 0,visits INTEGER NOT NULL DEFAULT 0)',
  'CREATE TABLE IF NOT EXISTS pages(day TEXT NOT NULL,path TEXT NOT NULL,views INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(day,path))',
  'CREATE TABLE IF NOT EXISTS sources(day TEXT NOT NULL,source TEXT NOT NULL,views INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(day,source))',
  'CREATE TABLE IF NOT EXISTS events(day TEXT NOT NULL,name TEXT NOT NULL,path TEXT NOT NULL,count INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(day,name,path))',
  'CREATE TABLE IF NOT EXISTS sessions(day TEXT NOT NULL,sid TEXT NOT NULL,PRIMARY KEY(day,sid))'
].join(';')+';');
const sql = {
  day:db.prepare('INSERT INTO daily(day,views,visits) VALUES (?,1,0) ON CONFLICT(day) DO UPDATE SET views=views+1'),
  visit:db.prepare('UPDATE daily SET visits=visits+1 WHERE day=?'),
  session:db.prepare('INSERT OR IGNORE INTO sessions(day,sid) VALUES (?,?)'),
  page:db.prepare('INSERT INTO pages(day,path,views) VALUES (?,?,1) ON CONFLICT(day,path) DO UPDATE SET views=views+1'),
  source:db.prepare('INSERT INTO sources(day,source,views) VALUES (?,?,1) ON CONFLICT(day,source) DO UPDATE SET views=views+1'),
  event:db.prepare('INSERT INTO events(day,name,path,count) VALUES (?,?,?,1) ON CONFLICT(day,name,path) DO UPDATE SET count=count+1'),
  prune:db.prepare('DELETE FROM sessions WHERE day < ?'),
  totals:db.prepare('SELECT COALESCE(SUM(views),0) AS views,COALESCE(SUM(visits),0) AS visits FROM daily WHERE day>=?'),
  trend:db.prepare('SELECT day,views,visits FROM daily WHERE day>=? ORDER BY day'),
  pages:db.prepare('SELECT path,SUM(views) AS views FROM pages WHERE day>=? GROUP BY path ORDER BY views DESC LIMIT 30'),
  sources:db.prepare('SELECT source,SUM(views) AS views FROM sources WHERE day>=? GROUP BY source ORDER BY views DESC LIMIT 20'),
  events:db.prepare('SELECT name,SUM(count) AS count FROM events WHERE day>=? GROUP BY name ORDER BY count DESC')
};
function pruneSessions() {
  sql.prune.run(new Date(Date.now()-2*86400000).toISOString().slice(0,10));
}
pruneSessions();
setInterval(pruneSessions,12*60*60*1000).unref();
const allowedEvents = new Set(['github_click','file_download','code_copy','search_used','article_read_75','article_read_100','share_click']);
const origins=new Set([siteOrigin]);
if(process.env.DEV_ORIGIN) origins.add(new URL(process.env.DEV_ORIGIN).origin);
const rate=new Map();
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'};
function send(res,code,body='',extra={}){res.writeHead(code,{...headers,...extra});res.end(body);}
function equal(a,b){const x=Buffer.from(a);const y=Buffer.from(b);return x.length===y.length && timingSafeEqual(x,y);}
function auth(req,res){
  const header=req.headers.authorization||'';
  if(header.startsWith('Basic ')){
    try {
      const decoded=Buffer.from(header.slice(6),'base64').toString('utf8');
      const i=decoded.indexOf(':');
      if(i>0 && equal(decoded.slice(0,i),user) && equal(decoded.slice(i+1),password)) return true;
    }catch{}
  }
  send(res,401,'Authorization required',{'WWW-Authenticate':'Basic realm="Site Analytics", charset="UTF-8"'});
  return false;
}
function pathOf(value){
  if(typeof value!=='string'||value.length>180||value.includes('\\'))return null;
  if(value==='/')return value;
  return /^\/articles\/[a-z0-9-]+\/$/.test(value)?value:null;
}
function sourceOf(value){
  if(typeof value!=='string')return 'direct';
  const s=value.toLowerCase().trim();
  return /^[a-z0-9][a-z0-9._-]{0,49}$/.test(s)?s:'other';
}
function validate(body){
  if(!body||typeof body!=='object'||Array.isArray(body))return null;
  const path=pathOf(body.path);
  if(!path||typeof body.session!=='string'||!/^[0-9a-f-]{36}$/.test(body.session))return null;
  const event=body.event||'pageview';
  if(event!=='pageview'&&!allowedEvents.has(event))return null;
  return {path,session:body.session,event,source:sourceOf(body.source)};
}
function record(item){
  const day=new Date().toISOString().slice(0,10);
  if(item.event!=='pageview'){sql.event.run(day,item.event,item.path);return;}
  const sid=createHash('sha256').update(secret).update(day).update(item.session).digest('hex');
  db.exec('BEGIN IMMEDIATE');
  try{
    sql.day.run(day);
    if(sql.session.run(day,sid).changes)sql.visit.run(day);
    sql.page.run(day,item.path);
    sql.source.run(day,item.source);
    db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
}
function report(days){
  const since=new Date(Date.now()-(days-1)*86400000).toISOString().slice(0,10);
  return {days,since,totals:sql.totals.get(since),trend:sql.trend.all(since),
    pages:sql.pages.all(since),sources:sql.sources.all(since),events:sql.events.all(since),
    updatedAt:new Date().toISOString(),note:'Visits count distinct browser-tab sessions per UTC day, not distinct people.'};
}
function limited(ip){
  const now=Date.now(),old=rate.get(ip);
  if(!old||old.until<now){rate.set(ip,{count:1,until:now+60000});return false;}
  old.count++;
  if(rate.size>10000){for(const [k,v] of rate)if(v.until<now)rate.delete(k);}
  return old.count>300;
}
const dashboard=readFileSync(new URL('./dashboard.html',import.meta.url),'utf8');
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url||'/', 'http://localhost');
    if(url.pathname==='/health'&&req.method==='GET')return send(res,200,'ok',{'Content-Type':'text/plain'});
    if(url.pathname==='/collect'&&['POST','OPTIONS'].includes(req.method)){
      const origin=req.headers.origin||'';
      if(!origins.has(origin))return send(res,403);
      const cors={'Access-Control-Allow-Origin':origin,'Vary':'Origin'};
      if(req.method==='OPTIONS')return send(res,204,'',{...cors,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'});
      if(limited(req.socket.remoteAddress||'unknown'))return send(res,429,'',cors);
      let size=0;const chunks=[];
      for await(const chunk of req){size+=chunk.length;if(size>2048)return send(res,413,'',cors);chunks.push(chunk);}
      let payload;
      try{payload=validate(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch{}
      if(!payload)return send(res,400,'',cors);
      record(payload);
      return send(res,204,'',cors);
    }
    if(url.pathname==='/dashboard'&&req.method==='GET'){
      if(!auth(req,res))return;
      return send(res,200,dashboard,{'Content-Type':'text/html; charset=utf-8',
        'Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"});
    }
    if(url.pathname==='/api/report'&&req.method==='GET'){
      if(!auth(req,res))return;
      const days=Number(url.searchParams.get('days')||30);
      if(![7,30,90].includes(days))return send(res,400);
      return send(res,200,JSON.stringify(report(days)),{'Content-Type':'application/json; charset=utf-8'});
    }
    return send(res,404,'Not found',{'Content-Type':'text/plain'});
  }catch(e){
    console.error('Request error',e?.message||'unknown');
    if(!res.headersSent)send(res,500,'Internal error');else res.end();
  }
});
server.listen(port,'0.0.0.0',()=>console.log('Site analytics on port '+port));
process.on('SIGTERM',()=>server.close(()=>{db.close();process.exit(0);}));
