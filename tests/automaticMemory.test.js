import test from 'node:test';
import assert from 'node:assert/strict';
import {deck} from '../src/game/cards.js';
import {createMemory,observeMemory,acknowledgeMemoryNotice,beginMemoryQuestion,finishMemoryQuestion} from '../src/training/automaticMemory.js';
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
test('played memory and pending question are removed; next relevant known card moves up',()=>{
 const v=view(['♠Q','♥A']);let s=acknowledgeMemoryNotice(observeMemory(createMemory(),v));s.action=10;s=beginMemoryQuestion(s,v);
 assert.ok(s.question);v.events.push({type:'play',player:1,round:2,card:c('♠Q')});v.players[1].count--;
 s=observeMemory(s,v);assert.equal(s.question,null);assert.deepEqual(active(s),['♥A']);
 v.events.push({type:'play',player:1,round:3,card:c('♥A')});v.players[1].count=0;s=observeMemory(s,v);assert.deepEqual(active(s),[]);
});
test('question waits for notice dismissal PLUS 2–4 later events, renders four plausible options',()=>{
 const v=view(['♠Q']);let s=observeMemory(createMemory(),v);
 assert.equal(beginMemoryQuestion(s,v).question,null);s=acknowledgeMemoryNotice(s);
 const due=s.active[1][0].due;assert.ok(due-s.action>=2&&due-s.action<=4);
 for(let action=s.action;action<due;action++){s.action=action;assert.equal(beginMemoryQuestion(s,v).question,null);}
 s.action=due;s=beginMemoryQuestion(s,v);assert.equal(s.question.options.length,4);
 assert.equal(new Set(s.question.options.map(c=>c.id)).size,4);assert.equal(s.question.options.filter(c=>c.id==='♠Q').length,1);
 assert.ok(s.question.options.every(c=>Math.abs(c.value-6)<=1));
});
test('3B tests one memory at a time and does not offer the other active memory as a wrong answer',()=>{
 const v=view(['♠Q','♥A']);let s=acknowledgeMemoryNotice(observeMemory(createMemory('3b'),v)),seen=new Set();
 for(let i=0;i<12;i++){s.action+=5;s=beginMemoryQuestion(s,v);seen.add(s.question.card.id);
 assert.equal(s.question.options.filter(c=>active(s).includes(c.id)).length,1);s=finishMemoryQuestion(s);}
 assert.equal(seen.size,2);
});
test('off, finished game and mode change discard pending memory work',()=>{
 const v=view(['♠Q','♥A']);let s=observeMemory(createMemory('3b'),v);s=acknowledgeMemoryNotice(s);s.action=10;s=beginMemoryQuestion(s,v);
 for(const cleared of [observeMemory(s,v,{enabled:false}),observeMemory(s,{...v,phase:'finished'})]){assert.deepEqual(active(cleared),[]);assert.equal(cleared.question,null);assert.equal(cleared.notices.length,0);}
 const switched=observeMemory(s,v,{mode:'3a'});assert.equal(switched.question,null);assert.equal(active(switched).length,1);
});
test('private getters never enter memory selection',()=>{
 const v=view(['♠Q']);for(const p of v.players)Object.defineProperty(p,'hand',{get(){throw Error('PRIVATE');}});
 Object.defineProperty(v,'stock',{get(){throw Error('PRIVATE');}});assert.deepEqual(active(observeMemory(createMemory(),v)),['♠Q']);
});
test('memory controller waits through movement, locks affected eye and cancels stale timers',()=>{
 const timers=[];const ui=createMemoryUI({onChange(){},set(fn){timers.push(fn);return timers.length;},clear(){}});
 const v=view(['♠Q']);const options={enabled:true,mode:'3a',ready:false};
 ui.update(v,options);assert.ok(!ui.markup().includes('Merke bei'));assert.equal(timers.length,0);
 options.ready=true;ui.update(v,options);assert.ok(ui.markup().includes('Merke bei Uhu'));timers.at(-1)();
 assert.ok(!ui.markup().includes('Merke bei'));assert.equal(ui.blockedPlayer(),null);
 for(let i=0;i<4;i++){v.events.push({type:'play',player:0,round:2,card:c('♦6')});ui.update(v,options);}
 assert.equal(ui.blockedPlayer(),1);assert.equal(ui.paused,true);
 ui.reset();for(const callback of timers)callback();assert.equal(ui.blockedPlayer(),null);assert.equal(ui.markup(),'');
});

test('answer feedback scores once, closes automatically, and inserts a new action gap',()=>{
 const timers=[],saved=new Map();const storage={getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)};
 const ui=createMemoryUI({storage,onChange(){},set(fn){timers.push(fn);return timers.length;},clear(){}});
 const v=view(['♠Q','♥A']),options={enabled:true,mode:'3b',ready:true};ui.update(v,options);timers.at(-1)();
 for(let i=0;i<4;i++){v.events.push({type:'play',player:0,round:2,card:c('♦6')});ui.update(v,options);}
 const q=ui.snapshot().question;assert.ok(q);
 const button={dataset:{memoryAnswer:q.card.id}};
 ui.bind({querySelectorAll:()=>[button],querySelector:()=>null});button.onclick();button.onclick();
 const stats=JSON.parse(saved.get('durak.memory.stats.v1'));assert.equal(stats['3b'].checks,1);assert.equal(stats['3b'].players[1].correct,1);
 assert.ok(ui.markup().includes('Richtig'));timers.at(-1)();ui.update(v,options);
 assert.equal(ui.paused,false);assert.ok(!ui.markup().includes('Richtig'));
});
test('level change or training off invalidates a scheduled notice even when callback is already queued',()=>{
 for(const change of [{enabled:false,mode:'3a',ready:true},{enabled:true,mode:'3b',ready:false}]){
  const timers=[];let redraws=0;
  const ui=createMemoryUI({onChange(){redraws++;},set(fn){timers.push(fn);return timers.length;},clear(){}});
  const v=view(['♠Q']);ui.update(v,{enabled:true,mode:'3a',ready:true});const old=timers[0];
  ui.update(v,change);old();assert.equal(redraws,0);assert.equal(ui.blockedPlayer(),null);
 }
});
test('finished game cancels planned quiz and a replay restores cards without stale timers',()=>{
 const timers=[];const ui=createMemoryUI({onChange(){},set(fn){timers.push(fn);return timers.length;},clear(){}});
 const v=view(['♠Q']),options={enabled:true,mode:'3a',ready:true};ui.update(v,options);timers.at(-1)();
 const saved=ui.snapshot();ui.suspend();ui.restore(saved);ui.update(v,{...options,ready:false});assert.deepEqual(active(ui.snapshot()),['♠Q']);assert.equal(ui.paused,false);
 ui.update({...v,phase:'finished'},options);for(const fn of timers)fn();assert.deepEqual(active(ui.snapshot()),[]);assert.equal(ui.markup(),'');
});
