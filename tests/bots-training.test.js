import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,act,legalActions,observation} from '../src/game/engine.js';
import {deck} from '../src/game/cards.js';
import {chooseAction} from '../src/bots/strategy.js';
import {analyzePublicCards} from '../src/training/analysis.js';
const card=id=>deck().find(c=>c.id===id);
function rng(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
test('200 seeded full games: legal actions, conservation, limits, termination',()=>{
  for(let seed=1;seed<=200;seed++) {let s=createGame(rng(seed)),steps=0;
    while(!s.finished && steps++<4000){const view=observation(s);const action=chooseAction(view,seed%2?'beginner':'amateur');assert.ok(legalActions(s).some(a=>JSON.stringify(a)===JSON.stringify(action)));s=act(s,action);
      const all=[...s.stock,...s.discarded,...s.players.flatMap(p=>p.hand),...s.table.flatMap(p=>[p.attack,p.defense].filter(Boolean))];assert.equal(all.length,36);assert.equal(new Set(all.map(c=>c.id)).size,36);assert.ok(s.table.length<=s.limit);assert.ok(s.players.filter(p=>p.out).every(p=>p.hand.length===0));
    }assert.ok(s.finished,`seed ${seed} does not finish`);assert.ok(s.players.filter(p=>p.hand.length).length<=1);
  }
});
test('public analysis forgets played pickup cards and counts numeric/face trumps',()=>{const view={trump:'♠',discarded:[card('♠6'),card('♠10'),card('♠Q')],events:[{type:'pickup',player:1,round:1,cards:[card('♥6'),card('♥7')]},{type:'play',player:1,card:card('♥6')}]};const a=analyzePublicCards(view);assert.equal(a.memory.numberTrumpsOut,2);assert.equal(a.memory.facesOut.Q,true);assert.equal(a.trumpsRemaining.length,6);assert.deepEqual(a.knownHeld[1].map(c=>c.id),['♥7']);assert.equal(a.pickups[0].cards.length,2);});
test('amateur preserves expensive trump but empties hand in endgame',()=>{const view={player:0,hand:[card('♠K')],players:[{id:0,count:1},{id:1,count:6},{id:2,count:6}],trump:'♠',discarded:[],table:[{attack:card('♥6'),defense:null}],actions:[{type:'defend',card:'♠K',target:0},{type:'take'}]};assert.equal(chooseAction(view,'amateur').type,'take');assert.equal(chooseAction(view,'beginner').type,'defend');view.discarded=deck().filter(c=>!['♠K','♥6'].includes(c.id)).slice(0,22);assert.equal(chooseAction(view,'amateur').type,'defend');});
test('training observation cannot alter strategy or engine state',()=>{const s=createGame(rng(99)),before=structuredClone(s),first=chooseAction(observation(s),'amateur');analyzePublicCards(observation(s,0));assert.deepEqual(s,before);assert.deepEqual(chooseAction(observation(s),'amateur'),first);});
