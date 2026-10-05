import {publicGameKnowledge} from '../knowledge/publicGameKnowledge.js';
import {deck, beats} from '../game/cards.js';

// Public facts and cautious estimates, never reconstructed hidden hands.
// Taking is NOT proof of a void suit; it may be a voluntary strategic choice.
export function publicKnowledge(view) {
 const k=publicGameKnowledge(view);
 return {held:new Map(k.knownCardsByPlayer.map((cards,id)=>[id,new Map(cards.map(c=>[c.id,c]))])),
 weaknesses:new Map(k.suspectedSuitWeaknesses.map(w=>[`${w.player}:${w.suit}`,w.strength])),openings:k.openings,trumpsOut:k.knownTrumpState.outCount};
}
export function attackEvidence(view, knowledge, attack) {
  const known = [...(knowledge.held.get(view.defender)?.values() ?? [])];
  const knownCounter = known.some(c => beats(c, attack, view.trump));
  const defenderCount = view.players.find(p => p.id === view.defender)?.count;
  if (defenderCount === undefined) return {knownCounter, pickupEstimate: 0, weakness: 0};
  // Remove only proven locations. Remaining cards are an uncertainty pool,
  // not a prediction of which particular cards were secretly dealt.
  const excluded = new Set([...view.hand, ...view.discarded,
    ...view.table.flatMap(p => [p.attack, p.defense].filter(Boolean)),
    ...[...knowledge.held.values()].flatMap(m => [...m.values()])].map(c => c.id));
  const pool = deck().filter(c => !excluded.has(c.id));
  const counters = pool.filter(c => beats(c, attack, view.trump)).length;
  const unknown = Math.max(0, defenderCount - known.length);
  let noCounter = knownCounter ? 0 : 1;
  for (let i = 0; i < Math.min(unknown, pool.length); i++) noCounter *= Math.max(0, pool.length - counters - i) / (pool.length - i);
  return {knownCounter, pickupEstimate: noCounter,
    weakness: knownCounter ? 0 : knowledge.weaknesses.get(`${view.defender}:${attack.suit}`) ?? 0};
}
