import test from 'node:test';
import assert from 'node:assert/strict';
import {createHistory,createBotScheduler} from '../src/ui/history.js';
import {createGame,act,legalActions} from '../src/game/engine.js';
import {createTrainingState,configureTraining} from '../src/training/trainingState.js';

test('complete snapshots round-trip hands, stock, phase, roles, table, events and training',()=>{
  let game=createGame(()=>.42);const first={game,training:createTrainingState(),difficulty:'amateur'};
  const history=createHistory(first);
  for(let i=0;i<20&&!game.finished;i++){game=act(game,legalActions(game)[0]);history.commit({game,training:{...first.training,level:3},difficulty:'amateur'});}
  const latest=history.current(),end=history.index;
  assert.deepEqual(history.go(0),first);assert.ok(history.isPast);
  assert.deepEqual(history.go(end),latest);assert.equal(history.isPast,false);
  const copy=history.current();copy.game.stock.length=0;assert.deepEqual(history.current(),latest);
});
test('branching after undo replaces future with a different real legal action',()=>{
  const start=createGame(()=>.42),history=createHistory({game:start});
  const attacks=legalActions(start);assert.ok(attacks.length>1);
  const a=act(start,attacks[0]);history.commit({game:a});
  history.commit({game:act(a,legalActions(a)[0])});
  const restored=history.go(0).game;const alternative=act(restored,attacks[1]);
  history.commit({game:alternative});
  assert.equal(history.length,2);assert.equal(history.index,1);assert.equal(history.isPast,false);
  assert.deepEqual(history.go(999).game,alternative);assert.notDeepEqual(alternative,a);
});
test('cancel invalidates already queued bot callbacks, including after a new schedule',()=>{
  const callbacks=[];let moves=0;
  const scheduler=createBotScheduler(fn=>{callbacks.push(fn);return callbacks.length;},()=>{});
  scheduler.schedule(()=>moves++,500);scheduler.cancel();
  scheduler.schedule(()=>moves+=10,500);callbacks[0]();assert.equal(moves,0);
  callbacks[1]();assert.equal(moves,10);
  scheduler.schedule(()=>moves++,500);scheduler.cancel();callbacks[2]();assert.equal(moves,10);
});
test('training switch alters only training; snapshot retains memory and quiz data',()=>{
  const game=createGame(()=>.42),original=structuredClone(game);
  const training=configureTraining(createTrainingState(),{enabled:true,level:4});
  const history=createHistory({game,training:{state:training,quiz:{level:4},answer:{faces:['J']}}});
  const saved=history.current();saved.training.state=configureTraining(saved.training.state,{enabled:false});
  history.commit(saved);assert.deepEqual(history.current().game,original);
  assert.equal(history.go(0).training.state.enabled,true);
  assert.deepEqual(history.current().training.answer,{faces:['J']});
});
