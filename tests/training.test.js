import test from 'node:test';
import assert from 'node:assert/strict';
import {deck} from '../src/game/cards.js';
import {createGame, act, observation} from '../src/game/engine.js';
import {chooseAction, explainDecision} from '../src/bots/strategy.js';
import {createTrainingState, configureTraining, observeTraining, rememberCard, toggleWeakness} from '../src/training/trainingState.js';
import {trumpSolution, memoryCandidates} from '../src/training/trainingSelectors.js';
import {createCheck, evaluateCheck} from '../src/training/trainingEvaluation.js';
import {emptyStats, loadStats, saveStats, recordCheck, STATS_KEY} from '../src/training/trainingStats.js';
import {hasFeature} from '../src/training/trainingLevels.js';

const c=id=>deck().find(c=>c.id===id);
const publicView=overrides=>({trump:'♠',events:[],discarded:[],table:[],...overrides});
const enabled=level=>configureTraining(createTrainingState(),{enabled:true,level});
test('trump counts as out only when physically discarded, not on table or in history',()=>{
  const v=publicView({table:[{attack:c('♥6'),defense:c('♠J')}],events:[{type:'play',player:1,card:c('♠J')}]});
  assert.deepEqual(trumpSolution(v),{number:0,faces:[]});
  v.discarded.push(c('♠J'));v.table=[];
  assert.deepEqual(trumpSolution(v),{number:0,faces:['J']});
});
test('picked-up trumps are not out',()=>{
  const v=publicView({events:[{type:'pickup',player:1,round:1,cards:[c('♠6'),c('♠Q')]}]});
  assert.deepEqual(trumpSolution(v),{number:0,faces:[]});
});
test('0–5 counts only numeric trumps; face ranks tracked separately',()=>{
  const v=publicView({discarded:['♠6','♠8','♠10','♠J','♠Q','♥7','♦A'].map(c)});
  assert.deepEqual(trumpSolution(v),{number:3,faces:['J','Q']});
  v.discarded=deck().filter(c=>c.suit==='♠');assert.deepEqual(trumpSolution(v),{number:5,faces:['J','Q','K','A']});
});
test('level gating is cumulative and unavailable levels cannot be selected',()=>{
  assert.ok(hasFeature(1,'faces'));assert.ok(!hasFeature(1,'numbers'));
  assert.ok(hasFeature(2,'numbers'));assert.ok(!hasFeature(2,'memory'));
  assert.ok(hasFeature(3,'memory'));assert.ok(!hasFeature(3,'weakness'));
  assert.ok(hasFeature(4,'weakness'));assert.equal(enabled(7).level,1);
});
test('recommendations prioritize trump, A, K, Q, J, then numbers',()=>{
  const v=publicView({events:[{type:'pickup',player:1,cards:['♥6','♥J','♥Q','♥K','♥A','♠6'].map(c)}]});
  assert.deepEqual(memoryCandidates(v,1).map(c=>c.id),['♠6','♥A','♥K','♥Q','♥J','♥6']);
});
test('level 3 allows exactly one known card per opponent and user replacement',()=>{
  const v=publicView({events:[{type:'pickup',player:1,cards:['♠6','♥A'].map(c)},{type:'pickup',player:2,cards:[c('♦K')]}]});
  let s=rememberCard(enabled(3),v,1,'♠6');s=rememberCard(s,v,1,'♥A');s=rememberCard(s,v,2,'♦K');
  assert.equal(Object.keys(s.remembered).length,2);assert.equal(s.remembered[1].card.id,'♥A');
  assert.equal(s.remembered[1].certainty,'known');assert.deepEqual(rememberCard(s,v,1,'♣A'),s);
  assert.deepEqual(rememberCard(enabled(2),v,1,'♥A').remembered,{});
});
test('remembered card expires as soon as played, even when training is off',()=>{
  const v=publicView({events:[{type:'pickup',player:1,round:1,cards:[c('♥A')]}]});
  let s=rememberCard(enabled(3),v,1,'♥A');s=observeTraining(s,v);s=configureTraining(s,{enabled:false});
  v.events.push({type:'play',player:1,round:2,card:c('♥A')});s=observeTraining(s,v);
  assert.deepEqual(s.remembered,{});assert.deepEqual(memoryCandidates(v,1),[]);
});
test('level 4 markers are only suspicions; no scoring or card facts',()=>{
  let s=toggleWeakness(enabled(4),2,'♥');assert.deepEqual(s.weaknesses[2]['♥'],{certainty:'suspected',suit:'♥'});
  assert.deepEqual(s.remembered,{});s=toggleWeakness(s,2,'♥');assert.deepEqual(s.weaknesses[2],{});
  assert.deepEqual(toggleWeakness(enabled(3),2,'♥').weaknesses,{});
});
test('completion notice only follows pickup/discard, not an ongoing card action',()=>{
  let s=enabled(1),v=publicView({events:[{type:'play',player:1,round:1,card:c('♥6')}]});
  s=observeTraining(s,v);assert.equal(s.completedRound,null);
  v.events.push({type:'discard',round:1,cards:[c('♥6'),c('♥7')]});s=observeTraining(s,v);assert.equal(s.completedRound,1);
  assert.deepEqual(observeTraining(s,v),s);
});
test('check snapshots and answers do not mutate view or training state',()=>{
  const v=publicView({discarded:['♠6','♠J'].map(c)}),s=enabled(2),before=structuredClone(v),stateBefore=structuredClone(s);
  const q=createCheck(s,v),r=evaluateCheck(q,{number:1,faces:['J']});assert.ok(r.correct);
  assert.ok(!evaluateCheck(q,{number:0,faces:['J']}).correct);assert.ok(!evaluateCheck(q,{number:1,faces:['Q']}).correct);
  assert.deepEqual(v,before);assert.deepEqual(s,stateBefore);
  v.discarded.push(c('♠Q'));assert.deepEqual(q.solution,{number:1,faces:['J']});
});
test('level 1 ignores numeric count; level 2 requires a number; memory checks compare chosen card',()=>{
  const v=publicView({discarded:[c('♠6')],events:[{type:'pickup',player:1,cards:[c('♥A')]}]});
  assert.ok(evaluateCheck(createCheck(enabled(1),v),{faces:[]}).correct);
  assert.ok(!evaluateCheck(createCheck(enabled(2),v),{faces:[]}).correct);
  const s=rememberCard(enabled(3),v,1,'♥A'),q=createCheck(s,v,'memory',1);
  assert.ok(evaluateCheck(q,{card:'♥A'}).correct);assert.ok(!evaluateCheck(q,{card:'♦A'}).correct);
  assert.equal(createCheck(enabled(2),v,'memory',1),null);
});
test('statistics persist locally, per-level accuracy and streaks remain consistent',()=>{
  let stats=emptyStats();stats=recordCheck(stats,1,true);stats=recordCheck(stats,2,true);stats=recordCheck(stats,2,false);
  assert.equal(stats.checks,3);assert.equal(stats.correct,2);assert.equal(stats.streak,0);assert.equal(stats.best,2);
  assert.deepEqual(stats.levels[2],{checks:2,correct:1,streak:0,best:1});
  const values=new Map(),store={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
  assert.ok(saveStats(store,stats));assert.deepEqual(loadStats(store),stats);
  values.set(STATS_KEY,'bad json');assert.deepEqual(loadStats(store),emptyStats());
  values.set(STATS_KEY,JSON.stringify({...stats,checks:100}));assert.deepEqual(loadStats(store),emptyStats());
  const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
  assert.deepEqual(loadStats(blocked),emptyStats());assert.equal(saveStats(blocked,stats),false);
});
test('training disabled creates no checks and cannot store new memories or weaknesses',()=>{
  const s=createTrainingState(),v=publicView({events:[{type:'pickup',player:1,cards:[c('♥A')]}]});
  assert.equal(createCheck(s,v),null);assert.deepEqual(rememberCard(s,v,1,'♥A'),s);assert.deepEqual(toggleWeakness(s,1,'♥'),s);
});
test('training on/off and quizzes never alter engine transitions or bot decisions',()=>{
  let game=createGame(()=>0.37),baseline=structuredClone(game),training=enabled(4);
  for(let i=0;i<150&&!game.finished;i++){
    const view=observation(game),expected=chooseAction(observation(baseline),'amateur');
    training=configureTraining(training,{enabled:i%2===0});training=observeTraining(training,observation(game,0));
    const check=createCheck(training,observation(game,0));if(check)evaluateCheck(check,{number:2,faces:['J']});
    const action=chooseAction(view,'amateur');assert.deepEqual(action,expected);
    game=act(game,action);baseline=act(baseline,expected);assert.deepEqual(game,baseline);
  }
});
test('bot rejects access to training and revealed fields; training selectors ignore hidden hands',()=>{
  const game=createGame(),v=observation(game),before=explainDecision(v,'amateur');
  const fail=()=>{throw Error('Private information read');};
  for(const key of ['training','remembered','weaknesses','revealed','opponentHands'])Object.defineProperty(v,key,{get:fail});
  for(const p of v.players)Object.defineProperty(p,'hand',{get:fail});
  assert.deepEqual(explainDecision(v,'amateur'),before);
  assert.doesNotThrow(()=>trumpSolution(v));assert.doesNotThrow(()=>observeTraining(enabled(4),v));
});
