import {createGame, observation} from '../game/engine.js';
import {createHistory} from './history.js';

// Both restart buttons use this one path. Global settings and audio are owned
// outside the round; only game-specific training data is reset by reset().
export function startFreshRound({cancelPending,closeOverlays,training,difficulty,random=Math.random}) {
  cancelPending();
  closeOverlays();
  const game=createGame(random);
  training.reset(observation(game,0));
  const history=createHistory({game,training:training.snapshot(),difficulty});
  return {game,history};
}

export function roundResult(game) {
  if(!game.finished)return null;
  if(game.loser===null)return {draw:true,winners:[],others:[],loser:null};
  const exits=game.events.filter(e=>e.type==='out');
  const firstRound=exits[0]?.round;
  // Simultaneous exits share a place; never break a tie by player-array order.
  const winnerIds=new Set(exits.filter(e=>e.round===firstRound).map(e=>e.player));
  const safe=game.players.filter(p=>p.id!==game.loser);
  return {draw:false,winners:safe.filter(p=>winnerIds.has(p.id)).map(p=>p.name),
    others:safe.filter(p=>!winnerIds.has(p.id)).map(p=>p.name),loser:game.players[game.loser].name};
}

// Re-rendering, closing for review, or replaying the same ending must not reopen
// the modal. A new game or an explicitly branched timeline resets the latch.
export function createResultGate() {
  let shown=false;
  return {reset(){shown=false;},take(game,{moving=false,past=false}={}){
    if(shown||moving||past||!game.finished)return false;
    shown=true;return true;
  }};
}

export const canInspectStock=(training,paused=false)=>training&&!paused;
