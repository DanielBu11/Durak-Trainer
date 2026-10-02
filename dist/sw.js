const VERSION = 'development-v14';
const PREFIX = `durak-pwa:${self.registration.scope}:`;
const CACHE = PREFIX + VERSION;
/* ASSETS_START */
const ASSETS=['./','./index.html','./style.css','./icon.svg','./icons/icon-192.png','./icons/icon-512.png','./manifest.webmanifest','./src/ui/app.js','./src/ui/cards.js','./src/ui/motion.js','./src/ui/eventFeedback.js','./src/ui/history.js','./src/ui/roundLifecycle.js','./src/game/cards.js','./src/game/engine.js','./src/bots/strategy.js','./src/training/analysis.js'];
ASSETS.push(...['beginner','amateur','weights','view','knowledge','scoring'].map(name=>`./src/bots/${name}.js`));
ASSETS.push('./src/ui/trainingUI.js',...['trainingLevels','trainingSelectors','trainingState','trainingEvaluation','trainingStats'].map(name=>`./src/training/${name}.js`));
ASSETS.push('./src/ui/audioUI.js',...['config','manager','events'].map(name=>`./src/audio/${name}.js`));
/* ASSETS_END */
/* AUDIO_START */
const AUDIO_ASSETS=['card-play','card-defend','card-draw','cards-pickup','discard','shuffle','win','lose'].map(name=>`./assets/audio/sfx/${name}.mp3`).concat('./assets/audio/music/background.mp3');
/* AUDIO_END */
const coreUrls=ASSETS.map(asset=>new URL(asset,self.registration.scope).href);
const urls = new Set([...ASSETS,...AUDIO_ASSETS].map(asset=>new URL(asset,self.registration.scope).href));
// Atomic app-shell install. Updates wait until old app windows close, so an
// active game is never mixed with modules from a new build. No forced reloads.
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(async cache=>{
    await cache.addAll(coreUrls.map(url=>new Request(url,{cache:'reload'})));
    // Optional media must never prevent the game shell installing offline.
    await Promise.allSettled(AUDIO_ASSETS.map(asset=>cache.add(new Request(new URL(asset,self.registration.scope),{cache:'reload'}))));
  }));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  url.search='';url.hash='';
  // Scope root and index.html are the same app entry, including offline starts.
  if(url.href===self.registration.scope)url.pathname+='index.html';
  if(!urls.has(url.href))return;
  // Only explicit build assets are cached. Never cache arbitrary requests,
  // errors, third-party content, or data. The next worker installs new assets.
  event.respondWith(caches.open(CACHE).then(cache=>cache.match(url.href)).then(cached=>cached||fetch(event.request)));
});
