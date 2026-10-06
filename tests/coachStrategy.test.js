import test from 'node:test';
import assert from 'node:assert/strict';
import {deck,beats} from '../src/game/cards.js';
import {recommendMove} from '../src/coach/coach.js';
const c=id=>deck().find(c=>c.id===id);
function position(ids,{stock=18,attack=null,known=[],count=known.length||4,out=[]}={}){
 const hand=ids.map(c),table=attack?[{attack:c(attack),defense:null}]:[];
 return {player:0,defender:attack?0:1,trump:'♠',stockCount:stock,limit:Math.min(6,attack?hand.length:count),hand,
 players:[{id:0,count:hand.length},{id:1,count},{id:2,count:4}],table,discarded:out.map(c),taking:false,
 events:known.length?[{type:'pickup',player:1,round:1,cards:known.map(c)}]:[],
 actions:attack?hand.filter(x=>beats(x,c(attack),'♠')).map(x=>({type:'defend',card:x.id,target:0})).concat({type:'take'}):hand.map(x=>({type:'attack',card:x.id}))};
}
const tip=(s,level=3)=>recommendMove(s,{enabled:true,level});
test('strategic attack: isolated diamond king instead of heart six',()=>{
 const s=position(['♥6','♦K','♠7'],{known:['♥7','♦6','♣6']});
 assert.equal(tip(s).action.card,'♦K');
 assert.ok(tip(s).reasons.some(r=>r.includes('isolierte hohe')));
});
test('strategic defense: king instead of seven preserves a pair',()=>{
 const s=position(['♥7','♦7','♥K','♠6'],{attack:'♥6'}),r=tip(s);
 assert.equal(r.action.card,'♥K');
 assert.ok(r.alternatives[0].remaining.includes('♥7')&&r.alternatives[0].remaining.includes('♦7'));
});
test('strategic defense: queen instead of seven preserves three sevens',()=>{
 assert.equal(tip(position(['♥7','♥Q','♦7','♣7','♠6'],{attack:'♥6'})).action.card,'♥Q');
});
test('voluntary pickup preserves two high trumps and adds an ace pair',()=>{
 const s=position(['♠A','♠K','♥6','♦6'],{attack:'♥A'}),r=tip(s);
 assert.equal(r.action.type,'take');
 assert.equal(r.label,'Aufnehmen');
 assert.ok(r.alternatives.some(a=>a.action.type==='defend'));
 assert.deepEqual(r.alternatives[0].remaining,['♠A','♠K','♥6','♦6','♥A']);
});
test('trump attack uses public singleton trump and preserves two rank pairs',()=>{
 const s=position(['♠7','♠9','♦9','♥J','♣J'],{stock:0,known:['♠6']});
 const r=tip(s);assert.equal(r.action.card,'♠7');
 assert.deepEqual(r.alternatives[0].remaining,['♠9','♦9','♥J','♣J']);
 // One-card defender means one attack, no invented 9 after a 7.
 assert.equal(r.lines[0].steps.length,1);
});
test('known enemy response changes the actual recommendation',()=>{
 const s=position(['♥6','♦K','♠7'],{count:4});
 assert.equal(tip(s).action.card,'♦K');
 const known=position(['♥6','♦K','♠7'],{known:['♠6','♦A','♥A'],count:4});
 assert.equal(tip(known).action.card,'♠7');
 assert.ok(tip(known).reasons.some(r=>r.includes('unbekannte')));
});
test('public high-trump distribution changes attack from queen to trump ten',()=>{
 const s=position(['♥Q','♦8','♠10'],{stock:0,count:3});
 assert.equal(tip(s,2).action.card,'♥Q');
 s.discarded=['♠J','♠Q','♠K','♠A'].map(c);
 assert.equal(tip(s,2).action.card,'♠10');
});
test('endgame finds a three-action empty-hand line against fully known low cards',()=>{
 const s=position(['♥J','♦J','♣J'],{stock:0,known:['♥6','♦6','♣6']});
 const r=tip(s);assert.equal(r.lines[0].steps.length,3);assert.deepEqual(r.lines[0].remaining,[]);
 const own=r.alternatives[0].line.steps.filter(s=>s.kind==='attack');
 assert.equal(new Set(own.map(s=>s.card)).size,3);
 assert.ok(own.every(s=>c(s.card).rank==='J'));
});
test('early and late phases choose different uses of the same trump pair',()=>{
 const s=position(['♠7','♠9','♦9','♥J','♣J']);
 assert.equal(tip(s).action.card,'♦9');
 s.stockCount=0;assert.equal(tip(s).action.card,'♠9');
 assert.equal(tip(s).alternatives[0].phase,'endgame');
});
test('opened rank with known opposing throws is considered in defense',()=>{
 const s=position(['♥7','♥Q','♠6'],{attack:'♥6',known:['♦7','♣7'],count:4});
 const r=tip(s);assert.notEqual(r.action.card,'♥7');
 assert.ok(r.alternatives.find(a=>a.action.card==='♥7').reasons.some(r=>r.includes('Nachwürfe')));
});
test('all levels remain deterministic, legal and immune to private getter access',()=>{
 const s=position(['♥6','♦K','♠7'],{count:4}),before=structuredClone(s);
 for(const p of s.players)Object.defineProperty(p,'hand',{get(){throw Error('hidden hand');}});
 for(const key of ['stock','revealed','training','future'])Object.defineProperty(s,key,{get(){throw Error('hidden state');}});
 for(const level of [1,2,3,4]){
  const r=tip(s,level);assert.deepEqual(r,tip(before,level));
  assert.ok(s.actions.some(a=>JSON.stringify(a)===JSON.stringify(r.action)));
  assert.ok(r.search.nodes<=384);assert.ok(r.reasons.length<=4);
 }
});
test('all public choices scored, including more than eight legal attacks',()=>{
 const s=position(['♥6','♥7','♥8','♥9','♥10','♥J','♥Q','♥K','♥A']);
 const r=tip(s);assert.equal(r.alternatives.length,9);assert.ok(r.alternatives.every(a=>Number.isFinite(a.score)));
});

test('last defense card is not a win while another attack remains uncovered',()=>{
 const s=position(['♠7'],{stock:0,attack:'♥6'});
 s.table.push({attack:c('♦6'),defense:null});s.limit=2;
 s.actions.push({type:'defend',card:'♠7',target:1});
 const r=tip(s);assert.equal(r.action.type,'take');
 for(const a of r.alternatives.filter(a=>a.action.type==='defend'))assert.ok(!a.reasons.some(r=>r.includes('Hand leeren')));
});

import {createGame,observation,act,legalActions} from '../src/game/engine.js';
import {chooseAction} from '../src/bots/strategy.js';
test('coach advice stays legal throughout seeded games and leaves input unchanged',()=>{
 for(let seed=1;seed<=3;seed++){
  let n=seed;const random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
  let s=createGame(random),steps=0;
  while(!s.finished&&steps++<1500){
   const v=observation(s),before=structuredClone(v);
   const a=s.actor===0?tip(v,(steps%4)+1).action:chooseAction(v,'amateur');
   assert.ok(legalActions(s).some(x=>JSON.stringify(x)===JSON.stringify(a)));
   assert.deepEqual(v,before);s=act(s,a);
  }
  assert.ok(s.finished,`seed ${seed}`);
 }
});
