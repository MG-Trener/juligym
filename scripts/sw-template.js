// Generated precache constants are prepended by build-offline.mjs.
const PREFIX='juligym:'+new URL(self.registration.scope).pathname+':';
const CACHE=PREFIX+VERSION;
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 try{
  // A bounded queue avoids flooding the connection; activation requires the entire library.
  const queue=[...FILES];
  const results=await Promise.allSettled(Array.from({length:6},async()=>{while(queue.length){const file=queue.shift();const url=new URL(file,self.registration.scope);const response=await fetch(new Request(url,{cache:'reload'}));if(!response.ok)throw new Error('Cannot cache '+file);await cache.put(url,response);}}));
  const failure=results.find(r=>r.status==='rejected');if(failure)throw failure.reason;
 }catch(error){await caches.delete(CACHE);throw error;}
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const name of await caches.keys())if(name.startsWith(PREFIX) && name!==CACHE)await caches.delete(name);
 await self.clients.claim();
})()));
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url),scope=new URL(self.registration.scope);
 if(event.request.method!=='GET' || url.origin!==scope.origin || !url.pathname.startsWith(scope.pathname))return;
 const relative=url.pathname.slice(scope.pathname.length);
 if(event.request.mode!=='navigate' && !FILES.includes(relative))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  const key=event.request.mode==='navigate'?new URL('index.html',scope):new URL(relative,scope);
  return await cache.match(key) || fetch(event.request);
 })());
});
