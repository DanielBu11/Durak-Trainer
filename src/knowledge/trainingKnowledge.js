import {publicGameKnowledge} from './publicGameKnowledge.js';

// Level capabilities are allowlisted. No raw events, full discard list or
// identities of numeric discarded trumps cross this boundary.
export function trainingKnowledge(source,level){
  const k=publicGameKnowledge({player:source.player,trump:source.trump,
    discarded:source.discarded,events:level>=3?source.events:[]});
  return {level,discardedCards:k.discardedCards.filter(c=>c.suit===source.trump&&['J','Q','K','A'].includes(c.rank)),
    knownCardsByPlayer:level>=3?k.knownCardsByPlayer:[[],[],[]],
    knownTrumpState:{facesOut:k.knownTrumpState.facesOut,numberOut:level>=2?k.knownTrumpState.numberOut:null},
    suspectedSuitWeaknesses:level>=4?k.suspectedSuitWeaknesses:[]};
}

export function knownHandView(source,player,{enabled,level}){
  if(!enabled||level<3)return null;
  const cards=trainingKnowledge(source,level).knownCardsByPlayer[player];
  const count=source.players.find(p=>p.id===player)?.count??0;
  return {cards,unknown:Math.max(0,count-cards.length)};
}
