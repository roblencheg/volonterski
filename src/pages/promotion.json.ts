import { createHash } from 'node:crypto';
import { published, articleURL } from '../lib/articles';
import { siteURL } from '../lib/seo';
export async function GET() {
  const articles = await published();
  const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  const entries = articles.map(a => ({
    id: a.id, url: `${siteURL}${articleURL(a.id)}`, title: a.data.title,
    description: a.data.description, tags: a.data.tags,
    hash: hash({ data:a.data, body:a.body })
  }));
  return Response.json({ commit: process.env.GITHUB_SHA || 'local', site: siteURL,
    entries: [{ id:'', url:`${siteURL}/`, hash:hash(entries) }, ...entries] });
}
