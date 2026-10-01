import {deck, beats} from '../game/cards.js';

// Public facts and cautious estimates, never reconstructed hidden hands.
// Taking is NOT proof of a void suit; it may be a voluntary strategic choice.
export function publicKnowledge(view) {
  const held = new Map(view.players.map(p => [p.id, new Map()]));
  const weaknesses = new Map(), openings = new Map(), rounds = new Set();
  for (const event of view.events) {
    if (event.type === 'pickup') {
      if (!held.has(event.player)) held.set(event.player, new Map());
      for (const c of event.cards) held.get(event.player).set(c.id, c);
      for (const suit of new Set(event.cards.filter(c => c.suit !== view.trump).map(c => c.suit))) {
        weaknesses.set(`${event.player}:${suit}`, Math.min(2, (weaknesses.get(`${event.player}:${suit}`) ?? 0) + 1));
      }
    } else if (event.type === 'play') {
      held.get(event.player)?.delete(event.card.id);
      weaknesses.delete(`${event.player}:${event.card.suit}`);
      if (!rounds.has(event.round)) {
        rounds.add(event.round);
        if (event.player === view.player) openings.set(event.card.id, (openings.get(event.card.id) ?? 0) + 1);
      }
    }
  }
  return {held, weaknesses, openings, trumpsOut: view.discarded.filter(c => c.suit === view.trump).length};
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
