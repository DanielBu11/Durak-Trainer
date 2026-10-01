import test from 'node:test';
import assert from 'node:assert/strict';
import {createAudioManager} from '../src/audio/manager.js';
import {audioEvents} from '../src/audio/events.js';
import {AUDIO_SETTINGS_KEY} from '../src/audio/config.js';
import {createGame,act,legalActions} from '../src/game/engine.js';

function fixture({missing=false,blocked=false}={}){
  const sources=[],gains=[],requests=[],warnings=[],values=new Map();let creates=0;
  const param=()=>({value:1,setValueAtTime(){},linearRampToValueAtTime(){}});
  const context={state:'suspended',currentTime:0,destination:{},
    async resume(){if(blocked)throw Error('Autoplay blocked');this.state='running';},
    async suspend(){this.state='suspended';},
    createGain(){const gain={gain:param(),connect(){},disconnect(){}};gains.push(gain);return gain;},
    createBufferSource(){const source={connect(){},disconnect(){},start(...args){this.started=args;},stop(){this.stopped=true;this.onended?.();}};sources.push(source);return source;},
    async decodeAudioData(){return {duration:60,sampleRate:100,getChannelData:()=>new Float32Array([0,0,0.1,0.2])};}
  };
  const audio=createAudioManager({contextFactory:()=>{creates++;return context;},fetcher:async url=>{requests.push(String(url));return {ok:!missing,status:missing?404:200,arrayBuffer:async()=>new ArrayBuffer(1)};},storage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)},baseURL:new URL('https://example.test/Durak-Trainer/assets/audio/'),warn:m=>warnings.push(m)});
  return {audio,context,sources,gains,requests,warnings,values,get creates(){return creates;}};
}
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
test('audio has no context, download or autoplay before real UI unlock',async()=>{
  const f=fixture();assert.equal(await f.audio.play('cardPlay'),false);assert.equal(f.creates,0);assert.equal(f.requests.length,0);
  await f.audio.unlock();await flush();assert.equal(f.creates,1);assert.ok(f.sources.some(s=>s.loop));
});
test('rapid effects overlap and do not restart looping background music',async()=>{
  const f=fixture();await f.audio.unlock();await flush();const music=f.sources.find(s=>s.loop);
  assert.deepEqual(await Promise.all([f.audio.play('cardPlay'),f.audio.play('cardPlay'),f.audio.play('shuffle')]),[true,true,true]);
  await f.audio.unlock();await flush();assert.equal(f.sources.filter(s=>s.loop).length,1);assert.equal(music.stopped,undefined);
  const effects=f.sources.filter(s=>!s.loop);assert.equal(effects.length,3);assert.notEqual(effects[0],effects[1]);
  assert.equal(f.requests.filter(url=>url.endsWith('card-play.mp3')).length,1);
  assert.ok(f.requests.every(url=>url.startsWith('https://example.test/Durak-Trainer/assets/audio/')));
});
test('independent gains, mute, persistence and music resume position',async()=>{
  const f=fixture();await f.audio.unlock();await flush();assert.equal(f.gains[0].gain.value,0.65);assert.equal(f.gains[1].gain.value,0.15);
  f.context.currentTime=12;f.audio.updateSettings({sfxEnabled:false,musicEnabled:false,musicVolume:0.2});
  assert.equal(await f.audio.play('cardPlay'),false);assert.ok(f.sources[0].stopped);
  f.audio.updateSettings({musicEnabled:true});await flush();assert.equal(f.sources.at(-1).started[1],12);assert.equal(f.gains[1].gain.value,0.2);
  assert.equal(JSON.parse(f.values.get(AUDIO_SETTINGS_KEY)).sfxEnabled,false);
});
test('missing files and unavailable Web Audio never reject or stop game code',async()=>{
  const f=fixture({missing:true});await f.audio.unlock();await flush();assert.equal(await f.audio.play('win'),false);await f.audio.play('win');
  assert.equal(f.warnings.filter(w=>w.includes('win.mp3')).length,1);
  const unavailable=createAudioManager({contextFactory:()=>{throw Error('unsupported');},warn:()=>{}});
  assert.equal(await unavailable.unlock(),false);assert.equal(await unavailable.play('cardPlay'),false);
});
test('blocked resume is recoverable on a later gesture',async()=>{
  const f=fixture({blocked:true});assert.equal(await f.audio.unlock(),false);
  f.context.resume=async()=>{f.context.state='running';};assert.equal(await f.audio.unlock(),true);await flush();assert.ok(f.sources.some(s=>s.loop));
});
test('background pause silences audio; subsequent gesture resumes music once',async()=>{
  const f=fixture();await f.audio.unlock();await flush();f.context.currentTime=5;f.audio.setHidden(true);
  assert.equal(await f.audio.play('cardDraw'),false);assert.ok(f.sources[0].stopped);
  f.audio.setHidden(false);assert.equal(f.sources.length,1);await f.audio.unlock();await flush();assert.equal(f.sources[1].started[1],5);
});
test('stored settings restore safely and corrupt values cannot break playback',()=>{
  const saved={sfxEnabled:false,musicEnabled:false,sfxVolume:0.3,musicVolume:0.1};
  const restored=createAudioManager({storage:{getItem:()=>JSON.stringify(saved)}});assert.deepEqual(restored.getSettings(),saved);
  const malformed=createAudioManager({storage:{getItem:()=>'{broken'},warn:()=>{}});assert.equal(malformed.getSettings().musicVolume,0.15);
  const denied=createAudioManager({storage:{getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}},warn:()=>{}});
  assert.doesNotThrow(()=>denied.updateSettings({musicVolume:5}));assert.equal(denied.getSettings().musicVolume,1);
});
test('events correspond to completed public transitions, pickup only after actual collection',()=>{
  const state=createGame(()=>0.4),action=legalActions(state)[0],after=act(state,action),original=structuredClone(after);
  assert.deepEqual(audioEvents(state,after,action),['cardPlay']);assert.deepEqual(after,original);
  const next={...after,events:[...after.events,{type:'pickup'}],stock:after.stock.slice(1)};
  assert.deepEqual(audioEvents(after,next,{type:'pass'}),['cardsPickup','cardDraw']);
  assert.deepEqual(audioEvents(after,after,{type:'take'}),[]);
  assert.deepEqual(audioEvents(after,{...after,events:[...after.events,{type:'discard'}]},{type:'pass'}),['discard']);
});
test('human win once on exit, lose only at game end; draw is not a win',()=>{
  const before=createGame();const after=structuredClone(before);after.players[0].out=true;
  assert.deepEqual(audioEvents(before,after,{type:'pass'}),['win']);assert.deepEqual(audioEvents(after,after,{type:'pass'}),[]);
  assert.deepEqual(audioEvents(before,{...before,finished:true,loser:0},{type:'pass'}),['lose']);
  assert.deepEqual(audioEvents(before,{...after,finished:true,loser:null},{type:'pass'}),[]);
});
