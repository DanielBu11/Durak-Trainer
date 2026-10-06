import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {build, outputRoot} from '../scripts/build.mjs';
import {previewServer, BASE} from '../scripts/preview.mjs';

const production=await build();
const worker=await readFile(path.join(outputRoot,'sw.js'),'utf8');
test('production artifact serves every HTML reference, module import and icon under Pages subpath',async()=>{
  const server=previewServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const origin=`http://127.0.0.1:${server.address().port}`;
    const index=await fetch(origin+BASE);assert.equal(index.status,200);
    const html=await index.text();
    for(const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
      const resolved=new URL(match[1],origin+BASE);assert.ok(resolved.pathname.startsWith(BASE));
      assert.equal((await fetch(resolved)).status,200,resolved.href);
    }
    for(const file of production.assets){
      const url=origin+BASE+file;const response=await fetch(url);assert.equal(response.status,200,url);
      if(file.endsWith('.js')){
        assert.match(response.headers.get('content-type'),/javascript/);
        for(const match of (await response.text()).matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)) {
          const dependency=new URL(match[1],url);assert.ok(dependency.pathname.startsWith(BASE));
          assert.equal((await fetch(dependency)).status,200,dependency.href);
        }
      }
    }
    assert.equal((await fetch(origin+'/src/game/engine.js')).status,404);
    assert.equal((await fetch(origin+BASE+'missing-route')).status,404); // No client-side routing.
    const manifest=await (await fetch(origin+BASE+'manifest.webmanifest')).json();
    for(const property of ['id','scope','start_url'])assert.equal(new URL(manifest[property],origin+BASE+'manifest.webmanifest').pathname,BASE);
    for(const icon of manifest.icons){const response=await fetch(new URL(icon.src,origin+BASE));assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');}
    for(const file of production.assets.filter(f=>f.endsWith('.mp3'))){const response=await fetch(origin+BASE+file);assert.equal(response.headers.get('content-type'),'audio/mpeg');assert.ok((await response.arrayBuffer()).byteLength>0);}
  } finally {await new Promise(resolve=>server.close(resolve));}
});

function workerHarness(scope='https://example.test/Durak-Trainer/',missingAudio=false) {
  const listeners={},stores=new Map(),deleted=[];let claimed=false;
  const caches={
    async open(key){if(!stores.has(key))stores.set(key,new Map());const store=stores.get(key);return {
      async addAll(requests){for(const req of requests)store.set(req.url,new Response(`cached:${req.url}`));},
      async add(req){if(missingAudio)throw Error('Audio missing');store.set(req.url,new Response(`cached:${req.url}`));},
      async match(url){return store.get(url)?.clone();}
    };},
    async keys(){return [...stores.keys()];},async delete(key){deleted.push(key);return stores.delete(key);}
  };
  vm.runInNewContext(worker,{self:{registration:{scope},clients:{claim:async()=>{claimed=true;}},addEventListener:(type,fn)=>listeners[type]=fn},caches,URL,Request,fetch:async()=>{throw Error('Offline');}});
  return {listeners,stores,deleted,get claimed(){return claimed;},async lifecycle(type){let pending;listeners[type]({waitUntil:p=>pending=p});await pending;}};
}
test('installed production PWA starts and serves every necessary asset offline',async()=>{
  const h=workerHarness();await h.lifecycle('install');await h.lifecycle('activate');assert.ok(h.claimed);
  for(const asset of ['./',...production.assets.map(f=>'./'+f)]) {
    const url=new URL(asset,'https://example.test/Durak-Trainer/').href;
    let response;h.listeners.fetch({request:new Request(url),respondWith:p=>response=p});
    assert.ok(response,url);assert.equal((await response).status,200,url);
  }
});
test('service worker does not intercept unrelated resources, POSTs or other sites',async()=>{
  const h=workerHarness();await h.lifecycle('install');
  for(const request of [new Request('https://example.test/other/index.html'),new Request('https://example.test/Durak-Trainer/not-an-asset'),new Request('https://elsewhere.test/Durak-Trainer/index.html'),new Request('https://example.test/Durak-Trainer/index.html',{method:'POST'})]) {
    let handled=false;h.listeners.fetch({request,respondWith:()=>handled=true});assert.equal(handled,false);
  }
});
test('missing optional audio does not prevent offline game installation',async()=>{
  const h=workerHarness('https://example.test/Durak-Trainer/',true);await h.lifecycle('install');await h.lifecycle('activate');
  let response;h.listeners.fetch({request:new Request('https://example.test/Durak-Trainer/'),respondWith:p=>response=p});
  assert.equal((await response).status,200);
});
test('cache upgrades remove only old versions of this exact app scope',async()=>{
  const h=workerHarness(),old='durak-pwa:https://example.test/Durak-Trainer/:old',other='durak-pwa:https://example.test/another/:old';
  h.stores.set(old,new Map());h.stores.set(other,new Map());h.stores.set('unrelated-cache',new Map());
  await h.lifecycle('install');await h.lifecycle('activate');assert.deepEqual(h.deleted,[old]);assert.ok(h.stores.has(other));assert.ok(h.stores.has('unrelated-cache'));
});
test('build is reproducible and cache version reflects production content',async()=>{
  const html=await readFile(path.join(outputRoot,'index.html'),'utf8');
  assert.match(production.release,/^\d{2}\.\d{2}$/);
  assert.ok(html.includes('Version: '+production.release));
  assert.ok(!html.includes('Version: '+production.version));
  assert.ok(!html.includes('Version: lokale Entwicklung'));
  assert.match(production.version,/^[a-f0-9]{16}$/);assert.ok(worker.includes(production.version));
  const next=await build();assert.equal(next.version,production.version);
  assert.ok(production.assets.includes('src/training/trainingStats.js'));
});
