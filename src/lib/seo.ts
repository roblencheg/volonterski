export const siteURL = 'https://volonterski.ru';
export const imageURL = (id: string) => `${siteURL}/og/${id}.png`;
export function articleSchema(article: any) {
  const url = `${siteURL}/articles/${article.id}/`;
  return {
    '@context': 'https://schema.org', '@type': 'BlogPosting',
    '@id': `${url}#article`, headline: article.data.title,
    description: article.data.description, inLanguage: 'ru-RU',
    datePublished: article.data.date.toISOString(),
    dateModified: (article.data.updated || article.data.date).toISOString(),
    mainEntityOfPage: url, url, image: [imageURL(article.id)],
    keywords: article.data.tags.join(', ')
  };
}
export const safeJSON = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c');
