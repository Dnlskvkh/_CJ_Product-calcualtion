/* Generated version and exact asset list come from build-pwa.cjs. */
const VERSION=__PWA_VERSION__,ASSETS=__PWA_ASSETS__,PREFIX='izdelie-app-',CACHE=PREFIX+VERSION;
const allowed=new Set(ASSETS),origin=self.location.origin;
function trusted(response){return response.ok&&!response.redirected&&response.headers.get('x-izdelie-build')===VERSION}
async function clearCopies(){for(const name of await caches.keys())if(name.startsWith(PREFIX))await caches.delete(name)}
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 try{await Promise.all(ASSETS.map(async path=>{const response=await fetch(new Request(new URL(path,origin),{credentials:'same-origin',cache:'reload',redirect:'error'}));if(!trusted(response))throw Error('Offline copy rejected: '+path);await cache.put(path,response)}))}catch(e){await caches.delete(CACHE);throw e}
 // Updates wait for the user's explicit choice. First installation activates normally.
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith(PREFIX)&&name!==CACHE)await caches.delete(name);await self.clients.claim()})()));
self.addEventListener('message',event=>{if(event.data?.type==='APPLY_UPDATE')event.waitUntil(self.skipWaiting())});
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);if(req.method!=='GET'||url.origin!==origin||url.pathname.startsWith('/api/')||url.pathname==='/sw.js')return;
 if(req.mode==='navigate'&&(url.pathname==='/'||url.pathname==='/index.html')){
  event.respondWith((async()=>{let response;try{response=await fetch(req,{redirect:'manual'})}catch{const copy=await (await caches.open(CACHE)).match('/index.html');return copy||new Response('Нет сети. Откройте калькулятор с интернетом, чтобы подготовить автономную копию.',{status:503,headers:{'content-type':'text/plain; charset=utf-8'}})}
   if(response.type==='opaqueredirect'||(response.status>=300&&response.status<400)){await clearCopies();return fetch(req)}
   if(response.status===401||response.status===403||response.redirected||(!response.headers.get('x-izdelie-build')&&response.ok)){await clearCopies();return response}
   if(!response.ok)return response;
   if(!trusted(response)){const copy=await (await caches.open(CACHE)).match('/index.html');return copy||response}
   return response;
  })());return;
 }
 if(allowed.has(url.pathname)&&!url.search)event.respondWith((async()=>{const cache=await caches.open(CACHE),copy=await cache.match(url.pathname);if(copy)return copy;const response=await fetch(req);if(trusted(response))await cache.put(url.pathname,response.clone());return response})());
});
