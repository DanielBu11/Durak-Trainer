import {profiScores} from './profi.js';
import {publicGameKnowledge} from '../knowledge/publicGameKnowledge.js';
import {searchPublicLines} from '../planning/publicLines.js';
import {stockRemaining} from './view.js';

export const MEISTER_WEIGHTS=Object.freeze({CARD_COUNT:8,PAIRS:5,TRUMP_RESERVE:3,PRESSURE:3,RISK:6,FINISH:100,LOOKAHEAD:.3});
export function meisterScores(view){
  const base=profiScores(view);
  const ranked=[...base].sort((a,b)=>b.score-a.score||JSON.stringify(a.action).localeCompare(JSON.stringify(b.action)));
  const facts=publicGameKnowledge(view);
  const search=searchPublicLines({...view,stockCount:stockRemaining(view)},facts,MEISTER_WEIGHTS,ranked.map(r=>r.action));
  return base.map(result=>{
    const line=search.lines.find(line=>JSON.stringify(line.action)===JSON.stringify(result.action));
    if(!line)return {...result,search:{searched:false,nodes:0}};
    const points=line.score*MEISTER_WEIGHTS.LOOKAHEAD;
    return {...result,score:result.score+points,reasons:[...result.reasons,{factor:'BOUNDED_LOOKAHEAD',points,
      detail:`${line.scenarioCount} öffentliche Antwortszenarien, bis zu ${line.depth} eigene Aktionen; ungünstige Antwort mitbewertet.`}],search:{...line,searched:true,totalNodes:search.totalNodes}};
  });
}
