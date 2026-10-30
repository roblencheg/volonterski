import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

test('self-hosted analytics: ingestion, origin and protected dashboard', async () => {
  const dir=mkdtempSync(join(tmpdir(),'site-analytics-'));
  const port=30000+Math.floor(Math.random()*20000);
  const base='http://127.0.0.1:'+port;
  const pw='test-password-123456789';
  const child=spawn(process.execPath,['analytics/server.mjs'],{
    env:{...process.env,PORT:String(port),DATA_FILE:join(dir,'test.sqlite'),
      ADMIN_USER:'tester',ADMIN_PASSWORD:pw,SESSION_SECRET:randomBytes(40).toString('hex')},
    stdio:'pipe'
  });
  try{
    let ready=false;
    for(let i=0;i<70;i++){
      if(child.exitCode!==null)break;
      try{const r=await fetch(base+'/health');if(r.ok){ready=true;break;}}catch{}
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    assert(ready,'backend did not start');
    const payload={path:'/articles/summary-bot/',session:'6c045ec5-9e08-4d54-89e4-a73f5d26a882',source:'github',event:'pageview'};
    const send=(body,origin='https://volonterski.ru')=>fetch(base+'/collect',{method:'POST',headers:{Origin:origin,'Content-Type':'text/plain'},body:JSON.stringify(body)});
    assert.equal((await send(payload,'https://fake.example')).status,403);
    assert.equal((await send({...payload,path:'/admin'})).status,400);
    assert.equal((await send(payload)).status,204);
    assert.equal((await send(payload)).status,204);
    assert.equal((await send({...payload,event:'github_click'})).status,204);
    assert.equal((await fetch(base+'/api/report')).status,401);
    assert.equal((await fetch(base+'/dashboard')).status,401);
    const auth='Basic '+Buffer.from('tester:'+pw).toString('base64');
    const report=await (await fetch(base+'/api/report?days=30',{headers:{Authorization:auth}})).json();
    assert.equal(report.totals.views,2);
    assert.equal(report.totals.visits,1);
    assert.equal(report.pages[0].path,payload.path);
    assert.equal(report.sources[0].source,'github');
    assert.equal(report.events[0].name,'github_click');
    const dashboard=await fetch(base+'/dashboard',{headers:{Authorization:auth}});
    assert.equal(dashboard.status,200);
    assert.match(await dashboard.text(),/Аналитика сайта/);
  } finally {
    child.kill('SIGTERM');
    await new Promise(resolve=>child.once('exit',resolve));
    rmSync(dir,{recursive:true,force:true});
  }
});