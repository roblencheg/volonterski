export const siteURL = 'https://volonterski.ru';
export const siteName = 'volonterski.ru';
export const siteDescription = 'Технические статьи и практические инструкции: Home Assistant, телеметрия автомобилей, AI-боты, электроника и самостоятельные разработки.';
export const imageURL = (id: string) => `${siteURL}/og/${id}.png`;

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${siteURL}/#website`,
    name: siteName,
    url: `${siteURL}/`,
    description: siteDescription,
    inLanguage: 'ru-RU'
  };
}
export function articleSchema(article: any) {
  const url = `${siteURL}/articles/${article.id}/`;
  return {
    '@context': 'https://schema.org', '@type': 'BlogPosting',
    '@id': `${url}#article`, headline: article.data.title,
    description: article.data.description, inLanguage: 'ru-RU',
    datePublished: article.data.date.toISOString(),
    dateModified: (article.data.updated || article.data.date).toISOString(),
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    url, image: [imageURL(article.id)],
    isPartOf: { '@id': `${siteURL}/#website` },
    keywords: article.data.tags.join(', ')
  };
}
export function articlePageSchema(article: any) {
  const url = `${siteURL}/articles/${article.id}/`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      articleSchema(article),
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Записи', item: `${siteURL}/` },
          { '@type': 'ListItem', position: 2, name: article.data.title, item: url }
        ]
      }
    ]
  };
}
export const safeJSON = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c');
