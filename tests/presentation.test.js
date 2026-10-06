import test from 'node:test';
import assert from 'node:assert/strict';
import {deck} from '../src/game/cards.js';
import {createGame,act} from '../src/game/engine.js';
import {stockDisplay,discardRows} from '../src/ui/cards.js';
const c=id=>deck().find(c=>c.id===id);
test('last exposed card moves to hand, disappears from stock display, suit remains',()=>{
  let s=createGame();
  Object.assign(s,{stock:[c('♠6')],trump:'♠',trumpCard:c('♠6'),attacker:0,defender:1,actor:0,phase:'attack',table:[],limit:2,passed:[],taking:false});
  s.players.forEach((p,i)=>p.hand=[['♥6','♣8'],['♥7','♣9'],['♦9']][i].map(c));
  assert.equal(stockDisplay(s).card.id,'♠6');
  s=act(s,{type:'attack',card:'♥6'});s=act(s,{type:'defend',card:'♥7',target:0});
  s=act(s,{type:'pass'});s=act(s,{type:'pass'});
  assert.equal(s.stock.length,0);
  assert.equal(s.players.flatMap(p=>p.hand).filter(c=>c.id==='♠6').length,1);
  assert.deepEqual(stockDisplay(s),{card:null,count:0,label:'Stapel leer · ♠'});
});
test('overview marks exactly discarded cards, including all four suits and nine ranks',()=>{
  const discarded=[c('♥6'),c('♠A')];const rows=discardRows(discarded);
  assert.equal(rows.length,4);assert.ok(rows.every(r=>r.cards.length===9));
  assert.deepEqual(rows.flatMap(r=>r.cards.filter(c=>c.out).map(c=>r.suit+c.rank)).sort(),['♥6','♠A'].sort());
  assert.equal(discardRows([]).flatMap(r=>r.cards).filter(c=>c.out).length,0);
});

import {renderDiscardOverview} from '../src/ui/cards.js';
import {canInspectStock} from '../src/ui/roundLifecycle.js';
import {readFile} from 'node:fs/promises';
test('stock overview renders every discarded suit and rank identically through level changes',async()=>{
 const discarded=['♣6','♦8','♥J','♠A'].map(c),root={innerHTML:''};
 const app=await readFile(new URL('../src/ui/app.js',import.meta.url),'utf8');
 // Both initial opening and refresh must use the complete discard pile.
 const calls=app.match(/renderDiscardOverview\(\$\('discard-overview'\),state\.discarded,state\.trump\)/g);
 assert.equal(calls.length,2);assert.ok(!app.includes('renderTrainingOverview'));
 let expected;
 for(const level of [1,2,3,4,1,4,2]){
  const training={enabled:true,level};assert.ok(canInspectStock(training.enabled));
  renderDiscardOverview(root,discarded);
  expected??=root.innerHTML;assert.equal(root.innerHTML,expected);
  for(const label of ['Kreuz 6','Karo 8','Herz J','Pik A'])assert.ok(root.innerHTML.includes(`${label}: raus`));
  assert.equal((root.innerHTML.match(/class="discard-rank is-out"/g)??[]).length,4);
 }
});
function discardFixture(){
 const s=createGame();Object.assign(s,{stock:[c('♠6')],discarded:[],trump:'♠',trumpCard:c('♠6'),attacker:0,defender:1,actor:0,phase:'attack',table:[],limit:2,passed:[],taking:false});
 s.players.forEach((p,i)=>p.hand=[['♥6','♣8'],['♥7','♣9'],['♦9']][i].map(c));return s;
}
const outIds=s=>discardRows(s.discarded).flatMap(r=>r.cards.filter(c=>c.out).map(c=>r.suit+c.rank)).sort();
test('stock overview excludes table/hand/stock and adds cards only after successful round completion',()=>{
 let s=discardFixture();assert.deepEqual(outIds(s),[]);
 s=act(s,{type:'attack',card:'♥6'});assert.deepEqual(outIds(s),[]);
 s=act(s,{type:'defend',card:'♥7',target:0});assert.deepEqual(outIds(s),[]);
 s=act(s,{type:'pass'});assert.deepEqual(outIds(s),[]);
 s=act(s,{type:'pass'});assert.deepEqual(outIds(s),['♥6','♥7']);
});
test('stock overview never marks collected cards as discarded',()=>{
 let s=discardFixture();s=act(s,{type:'attack',card:'♥6'});s=act(s,{type:'take'});
 s=act(s,{type:'pass'});s=act(s,{type:'pass'});
 assert.ok(s.players[1].hand.some(c=>c.id==='♥6'));assert.deepEqual(outIds(s),[]);
});
test('training off still blocks stock inspection and closes an open overview',async()=>{
 assert.equal(canInspectStock(false),false);
 const app=await readFile(new URL('../src/ui/app.js',import.meta.url),'utf8');
 assert.ok(app.includes("if(!training&&$('discard-dialog').open)$('discard-dialog').close()"));
 assert.ok(app.includes("if(!canInspectStock($('training').checked,trainingUI.isPaused()))return;"));
});

test('overview identifies only the current trump suit',()=>{
 const root={innerHTML:''};for(const trump of ['♠','♥','♦','♣']){renderDiscardOverview(root,[],trump);assert.equal((root.innerHTML.match(/\(Trumpf\)/g)??[]).length,1);assert.ok(root.innerHTML.includes('<h3>'+trump+' (Trumpf)'));}
});
