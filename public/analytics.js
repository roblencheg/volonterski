/* Privacy-first analytics. Public site IDs only; no API secrets belong here. */
(() => {
  'use strict';
  const config = document.querySelector('script[data-analytics-config]');
  if (!config) return;
  const umamiId = (config.dataset.umamiId || '').trim();
  const clarityId = (config.dataset.clarityId || '').trim();
  if (!umamiId && !clarityId) { document.querySelector('#analytics-settings')?.remove(); return; }
  const noticeKey = 'volonterski-analytics-notice-v2';
  let enabled = false;
  const sent = new Set();
  function track(name, data = {}) {
    if (!enabled || !umamiId) return;
    try { if (typeof window.umami?.track === 'function') window.umami.track(name, data); } catch {}
  }
  function loadScript(src, extra = {}) {
    const script = document.createElement('script');
    script.async = true;
    script.src = src;
    for (const [name, value] of Object.entries(extra)) script.setAttribute(name, value);
    document.head.append(script);
  }
  function start() {
    if (enabled) return;
    enabled = true;
    if (umamiId && /^[a-zA-Z0-9-]{8,64}$/.test(umamiId)) {
      loadScript('https://cloud.umami.is/script.js', { 'data-website-id': umamiId });
    }
    if (clarityId && /^[a-zA-Z0-9]+$/.test(clarityId)) {
      window.clarity = window.clarity || function(){ (window.clarity.q = window.clarity.q || []).push(arguments); };
      loadScript('https://www.clarity.ms/tag/' + clarityId);
    }
  }
  // Analytics is initialized automatically. Notice is informational only.
  start();
  function showNotice() {
    if (document.querySelector('#analytics-consent')) return;
    const panel = document.createElement('div');
    panel.id = 'analytics-consent';
    panel.className = 'analytics-consent';
    panel.setAttribute('role', 'status');
    panel.innerHTML = '<p>Используем аналитику посещений и взаимодействий с сайтом (Microsoft Clarity и при подключении Umami).</p><button type="button" aria-label="Закрыть уведомление">Понятно</button>';
    panel.querySelector('button').addEventListener('click', () => {
      try { localStorage.setItem(noticeKey, 'dismissed'); } catch {}
      panel.remove();
    });
    document.body.append(panel);
  }
  let dismissed = false;
  try { dismissed = localStorage.getItem(noticeKey) === 'dismissed'; } catch {}
  if (!dismissed) showNotice();

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link) return;
    let url;
    try { url = new URL(link.href, location.href); } catch { return; }
    if (url.hostname === 'github.com') track('github_click', { repository: url.pathname.split('/').slice(1,3).join('/').slice(0,100) });
    if (link.hasAttribute('download') || url.pathname.startsWith('/files/')) track('file_download', { filename: url.pathname.split('/').pop()?.slice(0,100) || 'file' });
  });
  document.addEventListener('click', (event) => {
    if (event.target.closest('button.copy-code')) track('code_copy');
    if (event.target.closest('#share')) track('share_click');
  });
  const search = document.querySelector('#search');
  search?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && search.value.trim()) track('search_used');
  });
  const article = document.querySelector('.article-page .prose');
  if (article) {
    const check = () => {
      const rect = article.getBoundingClientRect();
      const total = article.offsetHeight;
      if (total <= 0) return;
      const viewed = Math.max(0, Math.min(1, (innerHeight - rect.top) / total));
      if (!enabled) return;
      for (const [threshold, name] of [[0.75, 'article_read_75'], [1, 'article_read_100']]) {
        if (viewed >= threshold && !sent.has(name)) { sent.add(name); track(name, { article: location.pathname }); }
      }
    };
    addEventListener('scroll', check, { passive: true });
    addEventListener('resize', check, { passive: true });
    check();
  }
  document.querySelector('#analytics-settings')?.addEventListener('click', showNotice);
})();
