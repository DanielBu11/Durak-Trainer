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
