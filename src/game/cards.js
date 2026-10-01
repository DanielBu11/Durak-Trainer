export const SUITS = ['♣', '♦', '♥', '♠'];
export const RANKS = ['6','7','8','9','10','J','Q','K','A'];
export const deck = () => SUITS.flatMap(suit => RANKS.map((rank, value) => ({id: `${suit}${rank}`, suit, rank, value})));
export function shuffle(cards, random = Math.random) {
  const result = [...cards];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
export const beats = (card, attack, trump) => card.suit === attack.suit ? card.value > attack.value : card.suit === trump && attack.suit !== trump;
