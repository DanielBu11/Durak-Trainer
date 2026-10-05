import {deck} from '../game/cards.js';

export const copyPublicCard=c=>({id:c.id,suit:c.suit,rank:c.rank,value:c.value});

/** No full state, stock contents, opponent hands, or training revelations are
 * read. Known cards have a public pickup as provenance and expire on play. */
export function publicGameKnowledge(source){
  const discardedCards=(source.discarded??[]).map(copyPublicCard);
  const held=[new Map(),new Map(),new Map()],weaknesses=new Map(),openings=new Map(),rounds=new Set(),pickups=[];
  for(const e of source.events??[]){
    if(e.type==='pickup'){
      const cards=e.cards.map(copyPublicCard);
      pickups.push({type:'pickup',player:e.player,round:e.round,cards});
      for(const c of cards)held[e.player].set(c.id,c);
      // A pickup is a weak hypothesis, never proof that a suit is absent.
      for(const suit of new Set(cards.filter(c=>c.suit!==source.trump).map(c=>c.suit))){
        const key=`${e.player}:${suit}`;weaknesses.set(key,Math.min(2,(weaknesses.get(key)??0)+1));
      }
    }else if(e.type==='play'){
      held[e.player].delete(e.card.id);weaknesses.delete(`${e.player}:${e.card.suit}`);
      if(!rounds.has(e.round)){rounds.add(e.round);if(e.player===source.player)openings.set(e.card.id,(openings.get(e.card.id)??0)+1);}
    }
  }
  const out=new Set(discardedCards.map(c=>c.id)),trumps=discardedCards.filter(c=>c.suit===source.trump);
  return {discardedCards,knownCardsByPlayer:held.map(m=>[...m.values()]),pickups,openings,
    suspectedSuitWeaknesses:[...weaknesses].map(([key,strength])=>{const [player,suit]=key.split(':');return {player:Number(player),suit,strength,certainty:'suspected'};}),
    knownTrumpState:{numberOut:trumps.filter(c=>c.value<=4).length,
      facesOut:Object.fromEntries(['J','Q','K','A'].map(rank=>[rank,trumps.some(c=>c.rank===rank)])),
      outCount:trumps.length,remaining:deck().filter(c=>c.suit===source.trump&&!out.has(c.id))}};
}

export function knownOpponentCards(source,player){
  const known=publicGameKnowledge(source).knownCardsByPlayer[player]??[];
  const count=source.players.find(p=>p.id===player)?.count??0;
  return {known,unknown:Math.max(0,count-known.length)};
}
