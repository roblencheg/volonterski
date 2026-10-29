import { readFile, writeFile, mkdir, appendFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function planSubmissions(entries, known = {}) {
  const current = Object.fromEntries(entries.map(e => [e.url, e.hash]));
  const changed = entries.filter(e => known[e.url] !== e.hash).map(e => e.url);
  const removed = Object.keys(known).filter(url => !(url in current));
  return { urls: [...new Set([...changed, ...removed])], current };
}
export function validateCatalog(catalog, site, commit) {
  if (catalog.commit !== commit) throw new Error('The deployed commit does not match the checked out source.');
  if (catalog.site !== site || !Array.isArray(catalog.entries)) throw new Error('Invalid publication catalog.');
  for (const entry of catalog.entries) {
    const url = new URL(entry.url);
    if (url.origin !== site || url.search || url.hash || !/^[a-f0-9]{64}$/.test(entry.hash)) throw new Error('Invalid publication URL or content hash.');
  }
  return catalog.entries;
}
async function get(url) {
  const response = await fetch(url, { signal:AbortSignal.timeout(10000), headers:{'Cache-Control':'no-cache'} });
  if (!response.ok) throw new Error(`Public site returned HTTP ${response.status}.`);
  return response;
}
async function summary(text) {
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, text+'\n');
}
export async function run() {
  const config = JSON.parse(await readFile('config/promotion.json','utf8'));
  const statePath = '.cache/indexnow.json';
  await mkdir('.cache',{recursive:true});
  let state = { known:{} };
  try { state = JSON.parse(await readFile(statePath,'utf8')); } catch {}
  await writeFile(statePath,JSON.stringify(state));
  let commit = process.env.GITHUB_SHA || 'local';
  try { commit = execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim(); } catch {}
  let entries, lastError;
  for (let attempt=0;attempt<6;attempt++) {
    try {
      const catalog = await (await get(`${config.site}/promotion.json?commit=${commit}`)).json();
      const candidate = validateCatalog(catalog, config.site, commit);
      const key = await (await get(`${config.site}/${config.indexNowKey}.txt`)).text();
      if (key.trim() !== config.indexNowKey) throw new Error('Public IndexNow key does not match.');
      entries = candidate;
      break;
    } catch (error) {
      lastError = error;
      if (attempt<5) await new Promise(resolve=>setTimeout(resolve,10000));
    }
  }
  if (!entries) throw new Error(`Public HTTPS publication is not ready: ${lastError?.message}`);
  const plan = planSubmissions(entries,state.known);
  if (!plan.urls.length) { await summary('IndexNow: no content changes; nothing submitted.'); return; }
  if (process.argv.includes('--dry-run')) { await summary(`Dry run: ${plan.urls.length} changed/deleted URLs; no requests sent.`); return; }
  for (let i=0;i<plan.urls.length;i+=10000) {
    const response = await fetch(config.indexNowEndpoint,{
      method:'POST',headers:{'Content-Type':'application/json; charset=utf-8'},signal:AbortSignal.timeout(20000),
      body:JSON.stringify({host:new URL(config.site).hostname,key:config.indexNowKey,keyLocation:`${config.site}/${config.indexNowKey}.txt`,urlList:plan.urls.slice(i,i+10000)})
    });
    if (![200,202].includes(response.status)) throw new Error(`IndexNow returned HTTP ${response.status}; acknowledgement state was not changed.`);
  }
  await writeFile(statePath,JSON.stringify({known:plan.current,commit,submittedAt:new Date().toISOString()},null,2));
  await summary(`IndexNow accepted ${plan.urls.length} changed/deleted URLs. This acknowledges submission, not indexing or rankings.`);
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  run().catch(async error=>{await summary(`IndexNow submission pending: ${error.message}. The next scheduled run will retry.`);process.exitCode=1;});
}
