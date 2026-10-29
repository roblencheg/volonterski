import test from 'node:test';
import assert from 'node:assert/strict';
import { planSubmissions, validateCatalog } from '../scripts/indexnow.mjs';
import { makeProposal } from '../scripts/release-watch.mjs';

test('unchanged pages do not get submitted again',()=>{
  assert.deepEqual(planSubmissions([{url:'https://example.com/a/',hash:'same'}],{'https://example.com/a/':'same'}).urls,[]);
});
test('submits only new, modified and removed pages',()=>{
  const entries=[{url:'https://example.com/new/',hash:'new'},{url:'https://example.com/change/',hash:'v2'},{url:'https://example.com/keep/',hash:'v1'}];
  const known={'https://example.com/change/':'v1','https://example.com/keep/':'v1','https://example.com/removed/':'old'};
  const result=planSubmissions(entries,known);
  assert.deepEqual(result.urls,['https://example.com/new/','https://example.com/change/','https://example.com/removed/']);
  assert.equal(result.current['https://example.com/removed/'],undefined);
});
test('a stale deployment or foreign host cannot be announced',()=>{
  const catalog={site:'https://example.com',commit:'old',entries:[{url:'https://example.com/a/',hash:'a'.repeat(64)}]};
  assert.throws(()=>validateCatalog(catalog,'https://example.com','new'),/commit/);
  assert.throws(()=>validateCatalog({...catalog,commit:'new',entries:[{url:'https://other.com/a/',hash:'a'.repeat(64)}]},'https://example.com','new'),/URL/);
  assert.equal(validateCatalog({...catalog,commit:'new'},'https://example.com','new').length,1);
});
test('release proposal remains editorial and retains article URL',()=>{
  const text=makeProposal({repository:'roblencheg/test',article:'existing-slug',reviewedRelease:'v1'},{tag_name:'v2',html_url:'https://github.com/roblencheg/test/releases/tag/v2',published_at:'2026-10-29',body:'New feature'});
  assert.match(text,/https:\/\/volonterski.ru\/articles\/existing-slug\//);
  assert.match(text,/не опубликованная статья/);
  assert.match(text,/Проверенный в статье релиз: v1/);
  assert.match(text,/Новый опубликованный релиз: v2/);
  assert.match(text,/New feature/);
});
