import {performance} from 'node:perf_hooks';
import {createGame,act,observation} from '../src/game/engine.js';
import {chooseAction} from '../src/bots/strategy.js';
const rng=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const deals=Number(process.argv[2]??12);
for(const level of ['amateur','profi','meister']){
  let losses=0,draws=0,unfinished=0,calls=0,totalMs=0,maxMs=0;
  for(let deal=0;deal<deals;deal++)for(let seat=0;seat<3;seat++){
    let game=createGame(rng(72500+deal)),steps=0;
    while(!game.finished&&steps++<2500){
      const ours=game.actor===seat,start=performance.now();
      const action=chooseAction(observation(game),ours?level:'amateur');
      if(ours){const ms=performance.now()-start;calls++;totalMs+=ms;maxMs=Math.max(maxMs,ms);}
      game=act(game,action);
    }
    unfinished+=Number(!game.finished);losses+=Number(game.finished&&game.loser===seat);draws+=Number(game.finished&&game.loser===null);
  }
  console.log(JSON.stringify({level,games:deals*3,losses,draws,unfinished,lossPercent:100*losses/(deals*3),meanMs:totalMs/calls,maxMs}));
}
