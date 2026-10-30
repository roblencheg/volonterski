/* Privacy-first analytics. Public site IDs only; no API secrets belong here. */
(() => {
  'use strict';
  const config = document.querySelector('script[data-analytics-config]');
  if (!config) return;
  const umamiId = (config.dataset.umamiId || '').trim();
  const clarityId = (config.dataset.clarityId || '').trim();
  if (!umamiId && !clarityId) return;
  const key = 'volonterski-analytics-consent-v1';
  const storage = {
    get() { try { return localStorage.getItem(key); } catch { return null; } },
    set(value) { try { localStorage.setItem(key, value); } catch {} }
  };
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
  function hide() { document.querySelector('#analytics-consent')?.remove(); }
  function show() {
    if (document.querySelector('#analytics-consent')) return;
    const panel = document.createElement('div');
    panel.id = 'analytics-consent';
    panel.className = 'analytics-consent';
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-label', 'Настройки аналитики');
    panel.innerHTML = '<div><strong>Аналитика сайта</strong><p>С вашего разрешения используем Umami и Microsoft Clarity, чтобы понимать, какие материалы полезны. Clarity может записывать взаимодействия со страницей. Без согласия счётчики не загружаются.</p></div><div class="analytics-actions"><button type="button" data-consent="no">Не разрешать</button><button type="button" data-consent="yes">Разрешить</button></div>';
    panel.addEventListener('click', (event) => {
      const button = event.target.closest('[data-consent]');
      if (!button) return;
      const choice = button.dataset.consent;
      storage.set(choice);
      hide();
      if (choice === 'yes') { start(); dispatchEvent(new Event('scroll')); }
      else if (enabled) location.reload();
    });
    document.body.append(panel);
  }
  const choice = storage.get();
  if (choice === 'yes') start();
  else if (choice !== 'no') show();

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
  /* Visitors can reopen this preference from the footer. */
  document.querySelector('#analytics-settings')?.addEventListener('click', () => show());
})();
