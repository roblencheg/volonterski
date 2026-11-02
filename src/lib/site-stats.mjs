// Runs only while building the static site. Credentials never reach the browser.
export async function loadSiteStats({ env = process.env, fetcher = fetch, now = new Date() } = {}) {
  const token = env.CLOUDFLARE_ANALYTICS_API_TOKEN;
  const account = env.CLOUDFLARE_ACCOUNT_ID;
  const site = env.PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN;
  if (!token || !account || !site) return null;
  const since = new Date(now.getTime() - 30 * 86400000).toISOString();
  try {
    const response = await fetcher('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        query: `query SiteStats($account: String!, $site: String!, $since: Time!, $until: Time!) {
          viewer { accounts(filter: { accountTag: $account }) {
            rumPageloadEventsAdaptiveGroups(limit: 1, filter: {
              siteTag: $site, requestHost: "volonterski.ru", datetime_geq: $since, datetime_lt: $until
            }) { count sum { visits } }
          } }
        }`,
        variables: { account, site, since, until: now.toISOString() }
      })
    });
    if (!response.ok) throw new Error('HTTP error');
    const payload = await response.json();
    if (payload.errors?.length) throw new Error('GraphQL error');
    const groups = payload.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups;
    if (!Array.isArray(groups)) throw new Error('Missing dataset');
    const pageViews = groups.length ? groups[0]?.count : 0;
    const visits = groups.length ? groups[0]?.sum?.visits : 0;
    if (![pageViews, visits].every(n => Number.isSafeInteger(n) && n >= 0)) throw new Error('Invalid counts');
    return { pageViews, visits, updated: now.toISOString() };
  } catch {
    console.warn('Cloudflare footer statistics unavailable; footer counts omitted.');
    return null;
  }
}

let pending;
export function getSiteStats() {
  return pending ??= loadSiteStats();
}
