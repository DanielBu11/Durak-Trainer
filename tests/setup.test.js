import test from 'node:test';
import assert from 'node:assert/strict';
import {createSession,loadPreferences,savePreferences,numericLevel} from '../src/ui/setup.js';
import {readFile} from 'node:fs/promises';
test('opening a session and changing persisted options never starts a game',()=>{
 let calls=0,received;const session=createSession(options=>{calls++;received=options;return {game:{}};});
 const saved=new Map(),storage={getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)};
 const options={difficulty:'meister',speed:'3000',training:true,level:'3b'};
 savePreferences(storage,options);assert.deepEqual(loadPreferences(storage),{...options,level:'4'});assert.equal(numericLevel('3b'),4);
 assert.equal(session.isSetup,true);assert.equal(session.round,null);assert.equal(calls,0);
 session.start(options);assert.equal(calls,1);assert.deepEqual(received,options);assert.equal(session.isSetup,false);
 session.start(options);assert.equal(calls,1);session.setup();assert.equal(calls,1);assert.equal(session.round,null);
 session.start(options);assert.equal(calls,2);
 assert.equal(createSession(()=>{throw Error('AUTO START');}).round,null);
});
test('setup survives malformed or blocked storage',()=>{
 assert.equal(loadPreferences({getItem(){throw Error();}}).difficulty,'amateur');
 assert.equal(loadPreferences({getItem:()=>'{bad'}).level,'1');assert.doesNotThrow(()=>savePreferences({setItem(){throw Error();}},{}));
});
test('app wiring starts only on explicit click, guards bots and returns result button to setup',async()=>{
 const app=await readFile(new URL('../src/ui/app.js',import.meta.url),'utf8');
 assert.ok(app.includes('let state=null'));assert.ok(!app.includes('createGame('));
 assert.ok(app.includes("$('start-round').onclick=newRound"));assert.ok(app.includes("$('result-new').onclick=returnToSetup"));
 assert.ok(app.includes('function botStep(){if(state &&'));assert.ok(app.includes('if(state && !moving && !history?.isPast'));
});
