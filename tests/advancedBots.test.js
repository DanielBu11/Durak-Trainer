import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,observation,act,legalActions} from '../src/game/engine.js';
import {chooseAction,explainDecision} from '../src/bots/strategy.js';
import {publicGameKnowledge} from '../src/knowledge/publicGameKnowledge.js';
import {deck} from '../src/game/cards.js';
const card=id=>deck().find(c=>c.id===id);
export function poison(view){
  for(const key of ['stock','training','revealed','internal'])Object.defineProperty(view,key,{get(){throw Error('PRIVATE '+key);}});
  for(const p of view.players)Object.defineProperty(p,'hand',{get(){throw Error('PRIVATE HAND');}});
  return view;
}
test('central knowledge shares pickup provenance and expires cards on public play',()=>{
  const view=poison({...observation(createGame()),events:[{type:'pickup',player:1,round:1,cards:[card('♠K'),card('♥9')]},{type:'play',player:1,round:2,card:card('♠K')},{type:'pickup',player:1,round:3,cards:[card('♦6')]}],discarded:[card('♠6')]});
  assert.deepEqual(publicGameKnowledge(view).knownCardsByPlayer[1].map(c=>c.id),['♥9','♦6']);
  assert.ok(!('stock' in publicGameKnowledge(view)));
});
for(const level of ['profi','meister']){
  test(`${level} never accesses private getters and only returns legal deterministic actions`,()=>{
    let game=createGame(()=>.37);
    for(let i=0;i<1200&&!game.finished;i++){
      const view=poison(observation(game));const action=chooseAction(view,level);
      assert.ok(legalActions(game).some(a=>JSON.stringify(a)===JSON.stringify(action)));
      assert.deepEqual(action,chooseAction(view,level));game=act(game,action);
    }
    assert.ok(game.finished);
  });
  test(`${level} explains public countercards and preserves input`,()=>{
    const view=observation(createGame(()=>.6));const before=structuredClone(view);
    const result=explainDecision(poison(view),level);assert.ok(result.alternatives.length);
    assert.deepEqual(view.hand,before.hand);assert.deepEqual(view.events,before.events);
  });
}

test('Meister explores bounded follow-ups using the same public information as Profi',()=>{
 const hand=['♥6','♦6','♣6','♠6'].map(card);
 const view={player:0,defender:1,trump:'♠',limit:4,hand,players:[{id:0,count:4},{id:1,count:4},{id:2,count:2}],table:[],discarded:[],events:[],taking:false,actions:hand.map(c=>({type:'attack',card:c.id}))};
 const result=explainDecision(poison(view),'meister');
 assert.ok(result.alternatives.some(a=>a.search.depth>=2));
 assert.ok(result.alternatives.some(a=>a.search.scenarioCount>=2));
 assert.ok(result.alternatives.filter(a=>a.search.searched).every(a=>a.search.totalNodes<=384));
});

test('new bot levels ignore alternative hidden deals and stock order',()=>{
 for(const level of ['profi','meister']){
 const state=createGame(()=>.42),altered=structuredClone(state),actor=state.actor;
 altered.stock.reverse();for(const p of altered.players)if(p.id!==actor)p.hand.reverse();
 assert.deepEqual(chooseAction(observation(state),level),chooseAction(observation(altered),level));
 }
});
test('mixed advanced games conserve all cards and terminate across seeded deals',()=>{
 for(let seed=1;seed<=6;seed++){
 let n=seed;const random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
 let state=createGame(random),steps=0;
 while(!state.finished&&steps++<2500){
 state=act(state,chooseAction(observation(state),['profi','meister','amateur'][state.actor]));
 const cards=[...state.stock,...state.discarded,...state.players.flatMap(p=>p.hand),...state.table.flatMap(p=>[p.attack,p.defense].filter(Boolean))];
 assert.equal(cards.length,36);assert.equal(new Set(cards.map(c=>c.id)).size,36);
 }
 assert.ok(state.finished,`seed ${seed}`);
 }
});
