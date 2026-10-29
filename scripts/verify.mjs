import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve('dist');
async function walk(dir){const result=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())result.push(...await walk(p));else result.push(p);}return result;}
const files=await walk(root);const html=files.filter(f=>f.endsWith('.html'));
for(const file of html){const content=await readFile(file,'utf8');assert(content.includes('<html lang="ru"'),`${file}: missing language`);assert(content.includes('name="viewport"'),`${file}: missing viewport`);for(const match of content.matchAll(/(?:href|src)="(\/[^"?#]*)(?:[?#][^"]*)?"/g)){const url=decodeURI(match[1]);assert(!url.includes('..'),`Unsafe local path: ${url}`);const target=path.join(root,url.endsWith('/')?url+'index.html':url);assert((await stat(target)).isFile(),`Missing internal target ${url} in ${file}`);}}
assert((await readFile('dist/CNAME','utf8')).trim()==='volonterski.ru');
for(const filename of ['rss.xml','sitemap.xml']){const content=await readFile(path.join(root,filename),'utf8');assert(content.includes('https://volonterski.ru'));}
console.log(`Verified ${html.length} HTML pages, local links/assets, RSS, sitemap and domain.`);
for (const file of html) {
  const content = await readFile(file, 'utf8');
  const image = content.match(/property="og:image" content="([^"]+)"/);
  assert(image, `${file}: missing social preview`);
  const imageUrl = new URL(image[1]);
  assert.equal(imageUrl.origin, 'https://volonterski.ru');
  const png = await readFile(path.join(root, imageUrl.pathname));
  assert.equal(png.toString('hex',0,8), '89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
  const schemas = [...content.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(match=>JSON.parse(match[1]));
  if (file.includes(`${path.sep}articles${path.sep}`)) {
    assert.equal(schemas.length, 1, `${file}: missing article schema`);
    assert.equal(schemas[0]['@type'], 'BlogPosting');
    assert(!schemas[0].author, `${file}: unexpected personal attribution`);
    assert(content.includes('property="og:type" content="article"'));
  }
}
console.log('Verified generated PNG dimensions and article JSON-LD.');
