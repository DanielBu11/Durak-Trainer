import test from 'node:test';
import assert from 'node:assert/strict';
import {deck} from '../src/game/cards.js';
import {basicCoachAdvice} from '../src/coach/evaluation.js';
import {trainingKnowledge} from '../src/knowledge/trainingKnowledge.js';
const c=id=>deck().find(c=>c.id===id);
const view={player:0,defender:1,trump:'♠',stockCount:18,hand:[c('♥7'),c('♠6')],players:[{id:0,count:2},{id:1,count:6},{id:2,count:6}],table:[{attack:c('♥6'),defense:null}],discarded:[],events:[],actions:[{type:'defend',card:'♥7',target:0},{type:'defend',card:'♠6',target:0},{type:'take'}]};
test('coach compares legal moves and preserves trump when a normal defense suffices',()=>{
  const result=basicCoachAdvice({view,knowledge:trainingKnowledge(view,1)});
  assert.equal(result.action.card,'♥7');assert.ok(result.reasons.length<=3);assert.equal(result.alternatives.length,3);
});

import {recommendMove} from '../src/coach/coach.js';
import {coachInput} from '../src/coach/knowledge.js';
test('coach never reads hidden game state or hidden opponent hands',()=>{
 const s=structuredClone(view);for(const k of ['stock','training','revealed'])Object.defineProperty(s,k,{get(){throw Error('PRIVATE');}});
 for(const p of s.players)Object.defineProperty(p,'hand',{get(){throw Error('PRIVATE HAND');}});
 assert.ok(recommendMove(s,{enabled:true,level:4}).available);
});
test('level 1 rejects numeric history; level 2 ignores known opponents and weaknesses',()=>{
 const a={...structuredClone(view),discarded:[c('♠J'),c('♠6')],events:[]};
 const b={...structuredClone(view),discarded:[c('♠J'),c('♠7')],events:[{type:'pickup',player:1,round:1,cards:[c('♥8')]}]};
 const forbidden=new Proxy({},{get(){throw Error('LEVEL 4');}});
 assert.deepEqual(recommendMove(a,{enabled:true,level:1}),recommendMove({...b,discarded:[c('♠J')]},{enabled:true,level:1}));
 assert.deepEqual(recommendMove(a,{enabled:true,level:2,manualWeaknesses:forbidden}),recommendMove(b,{enabled:true,level:2,manualWeaknesses:forbidden}));
 assert.equal(coachInput(a,2).knowledge.knownTrumpState.numberOut,1);
 assert.equal(coachInput(b,3).knowledge.knownCardsByPlayer[1][0].id,'♥8');
 assert.equal(coachInput(b,3).knowledge.suspectedSuitWeaknesses.length,0);
 assert.ok(coachInput(b,4).knowledge.suspectedSuitWeaknesses.length);
});
test('training off never reads source and provides no advice',()=>{
 assert.equal(recommendMove(new Proxy({},{get(){throw Error('OFF');}}),{enabled:false,level:4}).available,false);
});

test('level 3 coach finds a legal multi-card finish and qualifies unknown answers',()=>{
 const hand=['♥6','♦6','♣6','♠6'].map(c);
 const s={player:0,defender:1,trump:'♠',stockCount:0,limit:4,hand,players:[{id:0,count:4},{id:1,count:4},{id:2,count:2}],table:[],discarded:[],events:[],taking:false,actions:hand.map(c=>({type:'attack',card:c.id}))};
 const result=recommendMove(s,{enabled:true,level:3});
 assert.ok(result.lines.some(l=>l.steps.length>=2&&l.steps.length<=4));
 assert.ok(result.lines.some(l=>l.remaining.length<hand.length-1));
 assert.ok(result.search.nodes<=384);
 assert.ok(!JSON.stringify(result).includes('muss aufnehmen'));
 assert.ok(result.reasons.some(r=>r.includes('unbekannte')));
 const input=coachInput(s,3);assert.deepEqual(input.view.events,[]);assert.deepEqual(input.view.discarded,[]);
});
test('rank-mismatched cards are never thrown into a pickup continuation',()=>{
 const hand=['♥6','♦J','♣J'].map(c);
 const s={player:0,defender:1,trump:'♠',stockCount:0,limit:4,hand,players:[{id:0,count:3},{id:1,count:4},{id:2,count:2}],table:[{attack:c('♠6'),defense:null}],discarded:[],events:[],taking:true,actions:[{type:'attack',card:'♥6'},{type:'pass'}]};
 const result=recommendMove(s,{enabled:true,level:3});
 for(const a of result.alternatives)if(a.line)assert.ok(a.line.steps.filter(s=>s.kind==='attack').every(s=>s.card==='♥6'));
});
