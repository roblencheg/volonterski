import { getCollection } from 'astro:content';
export async function published() {
  return (await getCollection('articles', ({ data }) => !data.draft)).sort((a,b) => b.data.date.valueOf()-a.data.date.valueOf() || a.id.localeCompare(b.id));
}
export const formatDate = (date: Date) => new Intl.DateTimeFormat('ru-RU', { day:'numeric', month:'long', year:'numeric', timeZone:'Asia/Novosibirsk' }).format(date);
export const readingTime = (text = '') => Math.max(1, Math.ceil(text.split(/\s+/).length / 200));
export const articleURL = (id: string) => `/articles/${id}/`;
export const escapeXML = (text: string) => text.replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]!));
