const CACHE='durak-v5';
const ASSETS=['./','./index.html','./style.css','./icon.svg','./icons/icon-192.png','./icons/icon-512.png','./manifest.webmanifest','./src/ui/app.js','./src/game/cards.js','./src/game/engine.js','./src/bots/strategy.js','./src/training/analysis.js'];
ASSETS.push(...['beginner','amateur','weights','view','knowledge','scoring'].map(name=>`./src/bots/${name}.js`));
ASSETS.push('./src/ui/trainingUI.js',...['trainingLevels','trainingSelectors','trainingState','trainingEvaluation','trainingStats'].map(name=>`./src/training/${name}.js`));
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('durak-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});
