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
    const graph = schemas[0]['@graph'];
    assert(Array.isArray(graph), `${file}: missing schema graph`);
    const blog = graph.find(item => item['@type'] === 'BlogPosting');
    const breadcrumbs = graph.find(item => item['@type'] === 'BreadcrumbList');
    assert(blog && breadcrumbs, `${file}: missing BlogPosting/BreadcrumbList`);
    assert(!blog.author, `${file}: unexpected personal attribution`);
    assert.equal(breadcrumbs.itemListElement.length, 2);
    assert(content.includes('property="og:type" content="article"'));
  }
}
console.log('Verified generated PNG dimensions and article JSON-LD.');

const origin = 'https://volonterski.ru';
const robots = await readFile(path.join(root, 'robots.txt'), 'utf8');
assert.match(robots, /User-agent:\\s*\\*/i);
assert.match(robots, /Sitemap:\\s*https:\\/\\/volonterski\\.ru\\/sitemap\\.xml/i);
assert(!/Disallow:\\s*\\//i.test(robots), 'Robots blocks crawlable pages');
const sitemap = await readFile(path.join(root, 'sitemap.xml'), 'utf8');
const locations = [...sitemap.matchAll(/<loc>([^<]+)<\\/loc>/g)].map(m => m[1]);
assert(locations.length > 1, 'Expected home and published articles in sitemap');
assert.equal(new Set(locations).size, locations.length, 'Duplicate URLs in sitemap');
const htmlFor = (url) => {
  const pathname = new URL(url).pathname;
  return path.join(root, pathname, pathname.endsWith('/') ? 'index.html' : '');
};
for (const url of locations) {
  assert(url.startsWith(origin + '/'), `Off-site URL in sitemap: ${url}`);
  assert(url === origin + '/' || /^https:\\/\\/volonterski\\.ru\\/articles\\/[a-z0-9-]+\\/$/.test(url), `Noncanonical URL in sitemap: ${url}`);
  assert((await stat(htmlFor(url))).isFile(), `Sitemap location missing: ${url}`);
}
const titles = new Set();
const descriptions = new Set();
for (const file of html) {
  const content = await readFile(file, 'utf8');
  const relative = path.relative(root, file).replaceAll(path.sep, '/');
  const title = content.match(/<title>([^<]+)<\\/title>/)?.[1];
  const description = content.match(/<meta name="description" content="([^"]+)"/)?.[1];
  const canonical = content.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  assert(title && title.length >= 12 && title.length <= 160, `${relative}: missing/invalid title`);
  assert(description && description.length >= 40 && description.length <= 300, `${relative}: missing/invalid description`);
  assert(canonical && canonical.startsWith(origin + '/'), `${relative}: missing/foreign canonical`);
  if (relative !== '404.html') {
    assert(!titles.has(title), `${relative}: duplicate title`);
    assert(!descriptions.has(description), `${relative}: duplicate meta description`);
    titles.add(title); descriptions.add(description);
    assert(!/name="robots" content="noindex"/.test(content), `${relative}: accidentally noindexed`);
    assert(locations.includes(canonical), `${relative}: indexable page missing from sitemap`);
    assert(content.includes('<h1'), `${relative}: missing h1`);
  }
  if (relative === 'index.html') {
    const schemas = [...content.matchAll(/<script\\b[^>]*type="application\\/ld\\+json"[^>]*>([\\s\\S]*?)<\\/script>/g)].map(m => JSON.parse(m[1]));
    assert(schemas.some(schema => schema['@type'] === 'WebSite' && schema.url === origin + '/'), 'Homepage missing WebSite schema');
    assert(content.includes('Home Assistant') && content.includes('AI-боты'), 'Homepage missing topic context');
  }
}
console.log(`SEO verified: ${locations.length} canonical sitemap URLs, unique titles/descriptions, robots and JSON-LD.`);
