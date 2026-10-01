import {BEGINNER_WEIGHTS as W} from './weights.js';
import {evaluation} from './scoring.js';

// No history, counting or opponent-hand inference; only hand, table, legal moves.
export function beginnerScores(view) {
  return view.actions.map(action => {
    const e = evaluation(action);
    if (action.type === 'pass') e.add('PASS', W.PASS, 'Keine weitere Karte riskieren.');
    else if (action.type === 'take') e.add('TAKE', W.TAKE, 'Nur aufnehmen, wenn keine Verteidigung möglich ist.');
    else {
      const c = view.hand.find(c => c.id === action.card);
      const throwIn = action.type === 'attack' && view.table.length > 0;
      e.add(throwIn ? 'THROW_IN' : 'PLAY', throwIn ? W.THROW_IN : W.PLAY, throwIn ? 'Niedrige passende Karte nachwerfen.' : 'Eine legale Karte ausspielen.');
      e.add('RANK_COST', -c.value * W.RANK_COST, 'Niedrigere Karten bevorzugen.');
      if (c.suit === view.trump) e.add('TRUMP_COST', -W.TRUMP_COST, 'Trumpf für eine spätere Verteidigung sparen.');
      if (throwIn && view.taking && c.suit !== view.trump) e.add('PICKUP_THROW_IN', W.PICKUP_THROW_IN, 'Gegner nimmt bereits auf; Nicht-Trumpf abgeben.');
    }
    return e.result();
  });
}
