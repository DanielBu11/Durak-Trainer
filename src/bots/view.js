// Explicit allowlist. Never spread/clone the whole caller object: hidden hands,
// stock order and training revelations are not even read. Beginner ignores history.
const card = c => ({id: c.id, suit: c.suit, rank: c.rank, value: c.value});
export function publicView(source, level) {
  return {
    player: source.player, hand: source.hand.map(card), trump: source.trump,
    defender: source.defender, taking: Boolean(source.taking),
    table: source.table.map(p => ({attack: card(p.attack), defense: p.defense ? card(p.defense) : null})),
    players: (source.players ?? []).map(p => ({id: p.id, count: p.count, out: p.out})),
    discarded: level === 'amateur' ? (source.discarded ?? []).map(card) : [],
    events: level === 'amateur' ? (source.events ?? []).flatMap(e => {
      if (e.type === 'play') return [{type: e.type, player: e.player, round: e.round, card: card(e.card)}];
      if (e.type === 'pickup') return [{type: e.type, player: e.player, round: e.round, cards: e.cards.map(card)}];
      return [];
    }) : [],
    actions: source.actions.map(a => ({type: a.type, ...(a.card !== undefined ? {card: a.card} : {}), ...(a.target !== undefined ? {target: a.target} : {})})),
  };
}
// Public arithmetic only: no access to the hidden deck, even its count property.
export function stockRemaining(view) {
  if (view.players.length !== 3) return null;
  return Math.max(0, 36 - view.players.reduce((sum, p) => sum + p.count, 0)
    - view.discarded.length - view.table.reduce((sum, p) => sum + 1 + Number(Boolean(p.defense)), 0));
}
