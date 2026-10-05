import {publicGameKnowledge} from '../knowledge/publicGameKnowledge.js';
export function analyzePublicCards(view){
 const k=publicGameKnowledge(view);
 return {discarded:k.discardedCards,trumpsRemaining:k.knownTrumpState.remaining,pickups:k.pickups,knownHeld:k.knownCardsByPlayer,
 memory:{numberTrumpsOut:k.knownTrumpState.numberOut,facesOut:k.knownTrumpState.facesOut}};
}
