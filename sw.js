/* Семья: страница из сети, без сети — из запаса. Сборка 20261031-1909 */
const CACHE='semya-20261031-1909'; const ASSETS=["./", "./index.html", "./manifest.webmanifest", "./icon-180.png", "./enhance.js", "./fonts/golos-local.css", "./fonts/GolosText-400-cyrillic.woff2", "./fonts/GolosText-400-latin.woff2", "./fonts/GolosText-500-cyrillic.woff2", "./fonts/GolosText-500-latin.woff2", "./fonts/GolosText-600-cyrillic.woff2", "./fonts/GolosText-600-latin.woff2", "./fonts/GolosText-700-cyrillic.woff2", "./fonts/GolosText-700-latin.woff2", "./fonts/GolosText-800-cyrillic.woff2", "./fonts/GolosText-800-latin.woff2", "./fonts/NotoSerifDisplay-300-cyrillic.woff2", "./fonts/NotoSerifDisplay-300-latin.woff2", "./fonts/NotoSerifDisplay-400-cyrillic.woff2", "./fonts/NotoSerifDisplay-400-latin.woff2"];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).catch(()=>{}).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{const req=e.request; if(req.method!=='GET') return; let u; try{u=new URL(req.url);}catch(err){return;} if(u.origin!==self.location.origin) return;
  const fromCache=()=>caches.match(req,{ignoreSearch:true}).then(r=>r||caches.match('./index.html'));
  e.respondWith(new Promise(res=>{ let done=false; const fin=r=>{ if(!done&&r){ done=true; res(r); } };
    const t=setTimeout(()=>fromCache().then(fin),3000);
    fetch(req).then(r=>{ if(r&&r.ok){const c=r.clone();caches.open(CACHE).then(x=>x.put(req,c)).catch(()=>{});} clearTimeout(t); fin(r); })
      .catch(()=>{ clearTimeout(t); fromCache().then(r=>fin(r||Response.error())); }); }));});
