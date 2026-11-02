import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSiteStats } from '../src/lib/site-stats.mjs';
const env = { CLOUDFLARE_ANALYTICS_API_TOKEN: 'private-test-value', CLOUDFLARE_ACCOUNT_ID: 'account', PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN: 'site' };
const now = new Date('2026-11-02T12:00:00Z');
const result = groups => ({ ok: true, json: async () => ({ data: { viewer: { accounts: [{ rumPageloadEventsAdaptiveGroups: groups }] } } }) });
test('unconfigured access hides statistics without fetching', async () => {
  assert.equal(await loadSiteStats({ env: {}, fetcher: () => assert.fail('unexpected network request') }), null);
});
test('fetches host-scoped 30-day totals without returning credentials', async () => {
  const stats = await loadSiteStats({ env, now, fetcher: async (url, options) => {
    assert.equal(url, 'https://api.cloudflare.com/client/v4/graphql');
    assert.equal(options.headers.Authorization, 'Bearer private-test-value');
    const body = JSON.parse(options.body);
    assert.equal(body.variables.since, '2026-10-03T12:00:00.000Z');
    assert.equal(body.variables.until, now.toISOString());
    assert.match(body.query, /requestHost: "volonterski.ru"/);
    return result([{ count: 456, sum: { visits: 123 } }]);
  } });
  assert.deepEqual(stats, { pageViews: 456, visits: 123, updated: now.toISOString() });
});
test('successful empty dataset means zero; unavailable data never means zero', async () => {
  assert.deepEqual(await loadSiteStats({ env, now, fetcher: async () => result([]) }), { pageViews: 0, visits: 0, updated: now.toISOString() });
  for (const response of [
    { ok: false },
    { ok: true, json: async () => ({ errors: [{ message: 'not authorized' }] }) },
    { ok: true, json: async () => ({ data: { viewer: { accounts: [] } } }) },
    result([{ count: 100, sum: { visits: null } }]),
    result([{ count: -1, sum: { visits: 2 } }])
  ]) assert.equal(await loadSiteStats({ env, now, fetcher: async () => response }), null);
});
