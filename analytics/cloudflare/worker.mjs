const SITE='https://volonterski.ru';
const EVENTS=new Set(['github_click','file_download','code_copy','search_used','article_read_75','article_read_100','share_click']);
const HEAD={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'};
const cors={'Access-Control-Allow-Origin':SITE,'Vary':'Origin'};
const out=(body,status=200,headers={})=>new Response(body,{status,headers:{...HEAD,...headers}});
const json=x=>out(JSON.stringify(x),200,{'Content-Type':'application/json; charset=utf-8'});
const e=new TextEncoder();
function equal(a,b){const x=e.encode(a),y=e.encode(b);let d=x.length^y.length;for(let i=0;i<Math.max(x.length,y.length);i++)d|=(x[i]||0)^(y[i]||0);return d===0;}
function auth(req,env){if(!env.ADMIN_USER||!env.ADMIN_PASSWORD||env.ADMIN_PASSWORD.length<16)return false;const h=req.headers.get('Authorization')||'';if(!h.startsWith('Basic '))return false;try{const bytes=Uint8Array.from(atob(h.slice(6)),c=>c.charCodeAt(0));const s=new TextDecoder('utf-8',{fatal:true}).decode(bytes),i=s.indexOf(':');return i>0&&equal(s.slice(0,i),env.ADMIN_USER)&&equal(s.slice(i+1),env.ADMIN_PASSWORD);}catch{return false;}}
function valid(b){if(!b||typeof b!=='object'||Array.isArray(b))return null;const p=b.path;if(!(p==='/'||typeof p==='string'&&/^\/articles\/[a-z0-9-]+\/$/.test(p)))return null;if(typeof b.session!=='string'||!/^[0-9a-f-]{36}$/.test(b.session))return null;const name=b.event||'pageview';if(name!=='pageview'&&!EVENTS.has(name))return null;return {path:p,session:b.session,name,source:typeof b.source==='string'&&/^[a-z0-9][a-z0-9._-]{0,49}$/.test(b.source)?b.source:'direct'};}
async function collect(req,env){
 if(req.headers.get('Origin')!==SITE)return out('Forbidden',403);
 if(req.method==='OPTIONS')return out(null,204,{...cors,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'});
 if(req.method!=='POST')return out('Method not allowed',405,cors);
 if(!env.DB||!env.SESSION_SALT||env.SESSION_SALT.length<32)return out('Not configured',503,cors);
 if(Number(req.headers.get('Content-Length')||0)>2048)return out('Too large',413,cors);
 let data;try{const raw=await req.text();if(raw.length>2048)return out('Too large',413,cors);data=valid(JSON.parse(raw));}catch{}
 if(!data)return out('Invalid event',400,cors);
 const day=new Date().toISOString().slice(0,10);
 try{
  if(data.name!=='pageview')await env.DB.prepare('INSERT INTO events(day,name,path,count) VALUES(?,?,?,1) ON CONFLICT(day,name,path) DO UPDATE SET count=count+1').bind(day,data.name,data.path).run();
  else{
   const hash=await crypto.subtle.digest('SHA-256',e.encode(env.SESSION_SALT+day+data.session));
   const sid=Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('');
   const v=await env.DB.prepare('INSERT OR IGNORE INTO sessions(day,sid) VALUES(?,?)').bind(day,sid).run();
   const visits=v.meta?.changes?1:0;
   await env.DB.batch([
    env.DB.prepare('INSERT INTO daily(day,views,visits) VALUES(?,1,?) ON CONFLICT(day) DO UPDATE SET views=views+1,visits=visits+excluded.visits').bind(day,visits),
    env.DB.prepare('INSERT INTO pages(day,path,views) VALUES(?,?,1) ON CONFLICT(day,path) DO UPDATE SET views=views+1').bind(day,data.path),
    env.DB.prepare('INSERT INTO sources(day,source,views) VALUES(?,?,1) ON CONFLICT(day,source) DO UPDATE SET views=views+1').bind(day,data.source)
   ]);
  }
  return out(null,204,cors);
 }catch(err){console.error(String(err));return out('Storage unavailable',503,cors);}
}
async function report(env,days){
 const since=new Date(Date.now()-(days-1)*86400000).toISOString().slice(0,10);
 const [a,b,c,d,f]=await env.DB.batch([
  env.DB.prepare('SELECT COALESCE(SUM(views),0) views,COALESCE(SUM(visits),0) visits FROM daily WHERE day>=?').bind(since),
  env.DB.prepare('SELECT day,views,visits FROM daily WHERE day>=? ORDER BY day').bind(since),
  env.DB.prepare('SELECT path,SUM(views) views FROM pages WHERE day>=? GROUP BY path ORDER BY views DESC LIMIT 30').bind(since),
  env.DB.prepare('SELECT source,SUM(views) views FROM sources WHERE day>=? GROUP BY source ORDER BY views DESC LIMIT 20').bind(since),
  env.DB.prepare('SELECT name,SUM(count) count FROM events WHERE day>=? GROUP BY name ORDER BY count DESC').bind(since)
 ]);
 return {totals:a.results?.[0]||{views:0,visits:0},trend:b.results||[],pages:c.results||[],sources:d.results||[],events:f.results||[],updatedAt:new Date().toISOString()};
}
const html='<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Статистика сайта</title><style>:root{font:15px system-ui;color-scheme:light dark}body{max-width:980px;margin:auto;padding:26px}h1{font-size:28px}.cards,.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:15px}.cards{margin:30px 0}.card{border:1px solid #8887;padding:18px;border-radius:10px}.card strong{display:block;font-size:32px}table{width:100%;border-collapse:collapse}td,th{padding:8px 3px;text-align:left;border-bottom:1px solid #8884;word-break:break-word}td:last-child,th:last-child{text-align:right}#chart{height:130px;display:flex;align-items:end;gap:3px;margin:20px 0}#chart span{flex:1;background:#6b87db}small{opacity:.7}</style></head><body><h1>Аналитика volonterski.ru</h1><label>Период <select id="days"><option value="7">7 дней</option><option value="30" selected>30 дней</option><option value="90">90 дней</option></select></label><p id="status">Загрузка…</p><div class="cards"><div class="card">Просмотры<strong id="views">—</strong></div><div class="card">Сессии<strong id="visits">—</strong></div><div class="card">События<strong id="actions">—</strong></div></div><h2>По дням</h2><div id="chart"></div><div class="cols"><section><h2>Страницы</h2><table><tbody id="pages"></tbody></table></section><section><h2>Источники</h2><table><tbody id="sources"></tbody></table></section><section><h2>Действия</h2><table><tbody id="events"></tbody></table></section></div><p><small>Сессия не равна уникальному человеку. Блокировщики могут мешать сбору.</small></p><script src="/dashboard.js"></script></body></html>';
const js='const e=id=>document.getElementById(id);function fill(id,items,k,n){const root=e(id);root.replaceChildren();for(const x of items){const tr=document.createElement("tr");for(const v of [x[k],x[n]]){const td=document.createElement("td");td.textContent=String(v);tr.append(td);}root.append(tr);}}async function load(){try{const r=await fetch("/api/report?days="+e("days").value);if(!r.ok)throw Error("HTTP "+r.status);const d=await r.json();e("views").textContent=d.totals.views;e("visits").textContent=d.totals.visits;e("actions").textContent=d.events.reduce((n,x)=>n+x.count,0);fill("pages",d.pages,"path","views");fill("sources",d.sources,"source","views");fill("events",d.events,"name","count");const chart=e("chart");chart.replaceChildren();const max=Math.max(1,...d.trend.map(x=>x.views));for(const x of d.trend){const b=document.createElement("span");b.style.height=Math.max(2,x.views/max*100)+"%";b.title=x.day+": "+x.views;chart.append(b);}e("status").textContent="Обновлено: "+new Date(d.updatedAt).toLocaleString("ru");}catch(x){e("status").textContent="Ошибка: "+x.message;}}e("days").addEventListener("change",load);load();';
export default {
 async fetch(req,env){
  const path=new URL(req.url).pathname;
  if(path==='/health')return out('ok',200,{'Content-Type':'text/plain'});
  if(path==='/collect')return collect(req,env);
  if(['/dashboard','/dashboard.js','/api/report'].includes(path)){
   if(!auth(req,env))return out('Authorization required',401,{'WWW-Authenticate':'Basic realm="Site Statistics", charset="UTF-8"'});
   if(req.method!=='GET')return out('Method not allowed',405);
   if(path==='/dashboard')return out(html,200,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none';script-src 'self';style-src 'unsafe-inline';connect-src 'self';base-uri 'none';frame-ancestors 'none'"});
   if(path==='/dashboard.js')return out(js,200,{'Content-Type':'text/javascript; charset=utf-8'});
   if(!env.DB)return out('Storage unavailable',503);
   const days=Number(new URL(req.url).searchParams.get('days')||30);
   if(![7,30,90].includes(days))return out('Invalid period',400);
   try{return json(await report(env,days));}catch(err){console.error(String(err));return out('Storage error',503);}
  }
  return out('Not found',404);
 },
 async scheduled(_event,env){if(env.DB)await env.DB.prepare('DELETE FROM sessions WHERE day<?').bind(new Date(Date.now()-2*86400000).toISOString().slice(0,10)).run();}
};
