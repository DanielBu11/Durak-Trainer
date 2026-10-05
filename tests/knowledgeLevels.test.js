import test from 'node:test';
import assert from 'node:assert/strict';
import {deck} from '../src/game/cards.js';
import {trainingKnowledge,knownHandView} from '../src/knowledge/trainingKnowledge.js';
const card=id=>deck().find(c=>c.id===id);
const source=()=>({player:0,trump:'♠',players:[{id:0,count:6},{id:1,count:6},{id:2,count:6}],discarded:[card('♠6'),card('♠J'),card('♥A')],events:[{type:'pickup',player:1,round:1,cards:[card('♥9'),card('♠K')]}]});
test('eyes show only public cards; plays remove them and pickups add them',()=>{
  const s=source();Object.defineProperty(s.players[1],'hand',{get(){throw Error('hidden');}});
  assert.deepEqual(knownHandView(s,1,{enabled:true,level:3}).cards.map(c=>c.id),['♥9','♠K']);
  assert.equal(knownHandView(s,1,{enabled:true,level:3}).unknown,4);
  s.events.push({type:'play',player:1,round:2,card:card('♠K')},{type:'pickup',player:1,round:3,cards:[card('♦6')]});
  assert.deepEqual(knownHandView(s,1,{enabled:true,level:3}).cards.map(c=>c.id),['♥9','♦6']);
  assert.equal(knownHandView(s,1,{enabled:false,level:4}),null);
  assert.equal(knownHandView(s,1,{enabled:true,level:2}),null);
});
test('levels 1/2 never read public pickup history; numeric identities are not exposed',()=>{
  const s=source();Object.defineProperty(s,'events',{get(){throw Error('higher level');}});
  const one=trainingKnowledge(s,1),two=trainingKnowledge(s,2);
  assert.equal(one.knownTrumpState.numberOut,null);assert.equal(two.knownTrumpState.numberOut,1);
  assert.deepEqual(one.discardedCards.map(c=>c.id),['♠J']);assert.ok(!JSON.stringify(two).includes('♠6'));
  assert.deepEqual(two.knownCardsByPlayer,[[],[],[]]);
});
test('level 3 grants known cards, level 4 alone grants hypotheses',()=>{
  assert.equal(trainingKnowledge(source(),3).knownCardsByPlayer[1].length,2);
  assert.deepEqual(trainingKnowledge(source(),3).suspectedSuitWeaknesses,[]);
  assert.ok(trainingKnowledge(source(),4).suspectedSuitWeaknesses.every(w=>w.certainty==='suspected'));
});
