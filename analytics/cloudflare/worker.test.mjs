import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.mjs';
const url='https://volonterski-analytics.example.workers.dev';
const request=(path,options={})=>new Request(url+path,options);
test('health and protected endpoints',async()=>{
 const env={};
 assert.equal((await worker.fetch(request('/health'),env)).status,200);
 assert.equal((await worker.fetch(request('/dashboard'),env)).status,401);
 assert.equal((await worker.fetch(request('/api/report'),env)).status,401);
 assert.equal((await worker.fetch(request('/unknown'),env)).status,404);
});
test('tracking rejects wrong origin, malformed events and unset backend',async()=>{
 const send=(body,origin='https://volonterski.ru')=>worker.fetch(request('/collect',{
  method:'POST',headers:{Origin:origin,'Content-Type':'text/plain'},body:JSON.stringify(body)
 }),{});
 const item={path:'/',session:'3dc31943-43ad-4a12-82ce-e8f480dbe31c',event:'pageview'};
 assert.equal((await send(item,'https://bad.example')).status,403);
 assert.equal((await send(item)).status,503);
 const env={DB:{},SESSION_SALT:'x'.repeat(50)};
 const invalid=await worker.fetch(request('/collect',{method:'POST',headers:{Origin:'https://volonterski.ru'},body:JSON.stringify({...item,path:'/admin'})}),env);
 assert.equal(invalid.status,400);
});
test('admin accepts only valid credentials and duration',async()=>{
 const env={ADMIN_USER:'admin',ADMIN_PASSWORD:'a-very-long-secret-password',DB:{}};
 const headers={Authorization:'Basic '+Buffer.from('admin:a-very-long-secret-password').toString('base64')};
 assert.equal((await worker.fetch(request('/dashboard',{headers}),env)).status,200);
 assert.equal((await worker.fetch(request('/dashboard.js',{headers}),env)).status,200);
 assert.equal((await worker.fetch(request('/api/report?days=99',{headers}),env)).status,400);
 assert.equal((await worker.fetch(request('/dashboard',{headers:{Authorization:'Basic '+Buffer.from('admin:incorrect').toString('base64')}}),env)).status,401);
});
test('UTF-8 credentials work with browser Basic Auth',async()=>{
 const env={ADMIN_USER:'админ',ADMIN_PASSWORD:'секретный-пароль-длиннее-16'};
 const credentials=Buffer.from('админ:секретный-пароль-длиннее-16','utf8').toString('base64');
 const result=await worker.fetch(request('/dashboard',{headers:{Authorization:'Basic '+credentials}}),env);
 assert.equal(result.status,200);
});
