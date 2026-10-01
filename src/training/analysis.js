import {deck} from '../game/cards.js';
// Derive knowledge from public events only. Future quizzes can consume this
// snapshot without coupling training state or revealed hands to bot policy.
export function analyzePublicCards(view) {
  const discarded=structuredClone(view.discarded), gone=new Set(discarded.map(c=>c.id));
  const known=[new Map(),new Map(),new Map()];
  const pickups=[];
  for(const event of view.events){
    if(event.type==='pickup'){pickups.push(structuredClone(event));for(const c of event.cards)known[event.player].set(c.id,c);}
    if(event.type==='play')known[event.player].delete(event.card.id);
  }
  const outTrumps=discarded.filter(c=>c.suit===view.trump);
  return {discarded,trumpsRemaining:deck().filter(c=>c.suit===view.trump&&!gone.has(c.id)),pickups,knownHeld:known.map(m=>[...m.values()]),memory:{numberTrumpsOut:outTrumps.filter(c=>c.value<=4).length,facesOut:Object.fromEntries(['J','Q','K','A'].map(rank=>[rank,outTrumps.some(c=>c.rank===rank)]))}};
}
