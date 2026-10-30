/* Independent site analytics. No cookies, IPs, full referrers or search text sent. */
(() => {
  'use strict';
  const tag=document.querySelector('script[data-own-analytics]');
  if (!tag) return;
  const endpoint=(tag.dataset.endpoint||'').trim();
  if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?\/collect$/.test(endpoint)) return;
  const key='site-session-v1';
  let id;
  try {
    id=sessionStorage.getItem(key);
    if(!id || !/^[0-9a-f-]{36}$/.test(id)){id=crypto.randomUUID();sessionStorage.setItem(key,id);}
  } catch { id=crypto.randomUUID(); }
  const path=location.pathname;
  if (path!=='/' && !/^\/articles\/[a-z0-9-]+\/$/.test(path)) return;
  let source='direct';
  try {
    const cached=sessionStorage.getItem('site-source-v1');
    if(cached) source=cached;
    else {
      const utm=new URLSearchParams(location.search).get('utm_source');
      if(utm && /^[a-z0-9._-]{1,50}$/i.test(utm))source=utm.toLowerCase();
      else if(document.referrer){
        const hostname=new URL(document.referrer).hostname.toLowerCase().replace(/^www\./,'');
        if(hostname && hostname!==location.hostname)source=hostname.slice(0,50);
      }
      sessionStorage.setItem('site-source-v1',source);
    }
  } catch {}
  const sent=new Set();
  function track(event='pageview'){
    const body=JSON.stringify({event,path,session:id,source});
    try {
      fetch(endpoint,{method:'POST',mode:'cors',headers:{'Content-Type':'text/plain;charset=UTF-8'},
        body,keepalive:true,credentials:'omit'}).catch(()=>{});
    } catch {}
  }
  track();
  document.addEventListener('click',event=>{
    const el=event.target;
    if(!(el instanceof Element))return;
    const link=el.closest('a[href]');
    if(link){
      let url;try{url=new URL(link.href,location.href);}catch{}
      if(url?.hostname==='github.com')track('github_click');
      if(link.hasAttribute('download') || (url && url.origin===location.origin && url.pathname.startsWith('/files/')))track('file_download');
    }
    if(el.closest('button.copy-code'))track('code_copy');
    if(el.closest('#share'))track('share_click');
  });
  const search=document.querySelector('#search');
  search?.addEventListener('keydown',e=>{if(e.key==='Enter'&&search.value.trim())track('search_used');});
  const article=document.querySelector('.article-page .prose');
  if(article){
    let scheduled=false;
    const check=()=>{
      scheduled=false;
      const height=article.offsetHeight;
      if(!height)return;
      const viewed=Math.max(0,Math.min(1,(innerHeight-article.getBoundingClientRect().top)/height));
      for(const [part,name] of [[0.75,'article_read_75'],[1,'article_read_100']]){
        if(viewed>=part&&!sent.has(name)){sent.add(name);track(name);}
      }
    };
    const schedule=()=>{if(!scheduled){scheduled=true;requestAnimationFrame(check);}};
    addEventListener('scroll',schedule,{passive:true});
    addEventListener('resize',schedule,{passive:true});
    schedule();
  }
})();