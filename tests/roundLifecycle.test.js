import test from 'node:test';
import assert from 'node:assert/strict';
import {roundResult,createResultGate,startFreshRound,canInspectStock} from '../src/ui/roundLifecycle.js';
import {createGame,act,observation} from '../src/game/engine.js';
import {chooseAction} from '../src/bots/strategy.js';
import {createBotScheduler} from '../src/ui/history.js';
import {createTrainingState} from '../src/training/trainingState.js';

function finishedGame(){
  let game=createGame(()=>.43);
  for(let i=0;i<1500&&!game.finished;i++)game=act(game,chooseAction(observation(game),'beginner'));
  assert.ok(game.finished);return game;
}
test('real round end names first finishers and Durak; live games have no result',()=>{
  assert.equal(roundResult(createGame()),null);
  const game=finishedGame(),result=roundResult(game);
  assert.equal(result.loser,game.players[game.loser].name);
  assert.ok(result.winners.length>0);
  assert.ok(!result.winners.includes(result.loser));
});
test('simultaneous winners share place; all-empty result is a draw',()=>{
  const game={finished:true,loser:1,players:[{id:0,name:'Du'},{id:1,name:'Uhu'},{id:2,name:'Aal'}],events:[{type:'out',player:0,round:9},{type:'out',player:2,round:9}]};
  assert.deepEqual(roundResult(game),{draw:false,winners:['Du','Aal'],others:[],loser:'Uhu'});
  assert.equal(roundResult({...game,loser:null}).draw,true);
});
test('result appears once, after animation, never reopens in replay, resets for a new branch',()=>{
  const gate=createResultGate(),game=finishedGame();
  assert.equal(gate.take(createGame()),false);
  assert.equal(gate.take(game,{moving:true}),false);
  assert.equal(gate.take(game,{past:true}),false);
  assert.equal(gate.take(game),true);
  assert.equal(gate.take(game),false);
  gate.take(createGame());assert.equal(gate.take(game),false);
  gate.reset();assert.equal(gate.take(game),true);
});
test('fresh round cancels queued work, resets all game/history state and retains settings',()=>{
  const old=finishedGame(),callbacks=[];let fired=0,animationActive=true,overlayOpen=true;
  const scheduler=createBotScheduler(fn=>callbacks.push(fn),()=>{});
  scheduler.schedule(()=>fired++,1000);
  const settings={difficulty:'amateur',speed:'5000',music:.15,sound:.65};
  let trainingState={...createTrainingState(),enabled:true,level:4,remembered:{1:{card:'old'}},cursor:90};
  const training={reset(view){assert.equal(animationActive,false);assert.equal(overlayOpen,false);trainingState={...createTrainingState(),enabled:trainingState.enabled,level:trainingState.level};assert.equal(view.events.length,0);},snapshot(){return {state:trainingState,stats:{checks:7}};}};
  const fresh=startFreshRound({cancelPending(){scheduler.cancel();animationActive=false;},closeOverlays(){overlayOpen=false;},training,difficulty:settings.difficulty,random:()=>.2});
  callbacks[0]();assert.equal(fired,0);
  const game=fresh.game;assert.equal(game.finished,false);assert.equal(game.loser,null);
  assert.deepEqual(game.table,[]);assert.deepEqual(game.discarded,[]);assert.deepEqual(game.events,[]);
  assert.deepEqual(game.players.map(p=>p.hand.length),[6,6,6]);assert.ok(game.players.every(p=>!p.out));
  assert.equal(game.stock.length,18);assert.equal(game.stock[0].id,game.trumpCard.id);
  assert.equal(new Set([...game.stock,...game.players.flatMap(p=>p.hand)].map(c=>c.id)).size,36);
  assert.notDeepEqual(game,old);assert.equal(fresh.history.length,1);assert.equal(fresh.history.index,0);
  assert.deepEqual(fresh.history.current().game,game);
  assert.equal(trainingState.enabled,true);assert.equal(trainingState.level,4);assert.deepEqual(trainingState.remembered,{});
  assert.equal(fresh.history.current().training.stats.checks,7);
  assert.deepEqual(settings,{difficulty:'amateur',speed:'5000',music:.15,sound:.65});
});
test('stock inspection is exclusively training-only, and blocked during a quiz',()=>{
  assert.equal(canInspectStock(false),false);assert.equal(canInspectStock(true),true);assert.equal(canInspectStock(true,true),false);
});
