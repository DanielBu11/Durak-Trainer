import {hasFeature} from '../training/trainingLevels.js';
import {publicView} from '../bots/view.js';
import {trainingKnowledge} from '../knowledge/trainingKnowledge.js';
import {levelDefinition} from '../training/trainingLevels.js';

/** Construct the ONLY coach input. The normal hand/table/counts/legal moves
 * are baseline information; historical knowledge is a separate level mask. */
export function coachInput(source,level,manualWeaknesses){
  level=levelDefinition(level).id;
  const view=publicView(source,'beginner'); // no raw history or discard identities
  view.stockCount=Number.isInteger(source.stockCount)?source.stockCount:null;
  const knowledge=trainingKnowledge(source,level);
  if(hasFeature(level,'weakness')&&manualWeaknesses){
    for(const player of [1,2])for(const suit of ['♣','♦','♥','♠'])if(manualWeaknesses[player]?.[suit]){
      if(!knowledge.suspectedSuitWeaknesses.some(w=>w.player===player&&w.suit===suit))knowledge.suspectedSuitWeaknesses.push({player,suit,strength:1,certainty:'suspected',source:'user'});
    }
  }
  return {view,knowledge};
}
