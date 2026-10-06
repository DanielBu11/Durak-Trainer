import test from 'node:test';
import assert from 'node:assert/strict';
import {deck} from '../src/game/cards.js';
import {createMemory,observeMemory,acknowledgeMemoryNotice} from '../src/training/automaticMemory.js';
import {createMemoryUI} from '../src/ui/memoryUI.js';
const c=id=>deck().find(c=>c.id===id);
const view=(ids,count=ids.length)=>({player:0,trump:'♠',phase:'attack',discarded:[],events:[{type:'pickup',player:1,round:1,cards:ids.map(c)}],players:[{id:0,count:6},{id:1,count},{id:2,count:6}]});
const active=(s,id=1)=>s.active[id].map(m=>m.card.id);
test('3A one and 3B at most two relevant PUBLIC cards per opponent',()=>{
 const v=view(['♥6','♦A','♠9','♠Q']);v.events.push({type:'pickup',player:2,round:1,cards:[c('♣K'),c('♥A'),c('♠7')]});
 for(const [mode,limit] of [['3a',1],['3b',2]]){
 const s=observeMemory(createMemory(mode),v);assert.equal(s.active[1].length,limit);assert.equal(s.active[2].length,limit);
 assert.equal(active(s)[0],'♠Q');assert.ok(!active(s).includes('♥6'));
 }
});
test('never exceeds known or actual public count; low irrelevant cards need not be assigned',()=>{
 for(const [cards,count,expected] of [[['♠Q'],5,1],[['♠Q','♥A'],1,1],[[],3,0],[['♥6','♦7','♣8','♥9'],4,0]])assert.equal(observeMemory(createMemory('3b'),view(cards,count)).active[1].length,expected);
});
test('stable memory survives lower priorities, replaced only by clearly stronger card',()=>{
 const v=view(['♠9']);let s=acknowledgeMemoryNotice(observeMemory(createMemory(),v));
 v.events.push({type:'pickup',player:1,round:2,cards:[c('♥K')]});v.players[1].count++;
 s=observeMemory(s,v);assert.deepEqual(active(s),['♠9']);assert.equal(s.notices.length,0);
 v.events.push({type:'pickup',player:1,round:3,cards:[c('♠K')]});v.players[1].count++;
 s=observeMemory(s,v);assert.deepEqual(active(s),['♠K']);assert.equal(s.notices.length,1);
});
test('played memory is removed; next relevant known card moves up',()=>{
 const v=view(['♠Q','♥A']);let s=acknowledgeMemoryNotice(observeMemory(createMemory(),v));
 v.events.push({type:'play',player:1,round:2,card:c('♠Q')});v.players[1].count--;
 s=observeMemory(s,v);assert.deepEqual(active(s),['♥A']);
 v.events.push({type:'play',player:1,round:3,card:c('♥A')});v.players[1].count=0;s=observeMemory(s,v);assert.deepEqual(active(s),[]);
});
test('off, finished game and mode change discard pending memory work',()=>{
 const v=view(['♠Q','♥A']);let s=observeMemory(createMemory('3b'),v);s=acknowledgeMemoryNotice(s);
 for(const cleared of [observeMemory(s,v,{enabled:false}),observeMemory(s,{...v,phase:'finished'})]){assert.deepEqual(active(cleared),[]);assert.equal(cleared.notices.length,0);}
 const switched=observeMemory(s,v,{mode:'3a'});assert.equal(active(switched).length,1);
});
test('private getters never enter memory selection',()=>{
 const v=view(['♠Q']);for(const p of v.players)Object.defineProperty(p,'hand',{get(){throw Error('PRIVATE');}});
 Object.defineProperty(v,'stock',{get(){throw Error('PRIVATE');}});assert.deepEqual(active(observeMemory(createMemory(),v)),['♠Q']);
});

test('notices expire but no amount of time or public actions creates an automatic question',()=>{
 const callbacks=[];const ui=createMemoryUI({onChange(){},set(fn){callbacks.push(fn);return callbacks.length;},clear(){}});
 const v=view(['♠Q']),options={enabled:true,mode:'3a',ready:true};ui.update(v,options);
 assert.ok(ui.markup().includes('Merke bei Uhu'));callbacks[0]();
 for(let i=0;i<50;i++){v.events.push({type:'play',player:0,round:i+2,card:c('♦6')});ui.update(v,options);}
 assert.ok(!ui.markup().includes('Merke bei'));assert.ok(!ui.markup().includes('Welche Karte'));
 assert.equal(ui.snapshot().question,undefined);assert.equal(callbacks.length,1);
 ui.reset();for(const fn of callbacks)fn();assert.equal(ui.markup(),'');
});
