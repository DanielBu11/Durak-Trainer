import {beats} from '../game/cards.js';
import {AMATEUR_WEIGHTS as W} from './weights.js';
import {evaluation} from './scoring.js';
import {publicKnowledge, attackEvidence} from './knowledge.js';
import {stockRemaining} from './view.js';

function trumpCost(c, view, knowledge) {
  if (c.suit !== view.trump) return 0;
  const count = view.hand.filter(c => c.suit === view.trump).length;
  return W.SMALL_TRUMP_COST + W.HIGH_TRUMP_COST * (c.value / 8) ** 2
    + (count <= 2 ? W.LAST_TRUMPS_COST : 0) + W.TRUMPS_OUT_RESERVE * knowledge.trumpsOut / 9;
}
export function amateurScores(view) {
  const knowledge = publicKnowledge(view);
  const endgame = stockRemaining(view) === 0;
  return view.actions.map(action => {
    const e = evaluation(action);
    if (action.type === 'pass') e.add('PASS', W.PASS, 'Keine zusätzliche Karte investieren.');
    if (action.type === 'take') {
      const pickupCount = view.table.reduce((sum, p) => sum + 1 + Number(Boolean(p.defense)), 0);
      e.add('TAKE', W.TAKE, 'Initiative durch Aufnahme abgeben.');
      e.add('PICKUP_CARD_COST', -W.PICKUP_CARD_COST * pickupCount, `${pickupCount} sichtbare Karten aufnehmen; weitere Nachwürfe sind möglich.`);
      if (endgame) e.add('ENDGAME_TAKE_COST', -W.ENDGAME_TAKE_COST, 'Ohne Nachziehstapel ist eine größere Hand besonders teuer.');
    }
    if (action.card) {
      const c = view.hand.find(c => c.id === action.card), rank = c.value / 8, trump = c.suit === view.trump;
      if (trump) {
        e.add('SMALL_TRUMP_COST', -W.SMALL_TRUMP_COST, 'Trumpf als Verteidigungsreserve erhalten.');
        e.add('HIGH_TRUMP_COST', -W.HIGH_TRUMP_COST * rank ** 2, 'Hohe Trümpfe sind besonders wertvoll.');
        if (view.hand.filter(c => c.suit === view.trump).length <= 2) e.add('LAST_TRUMPS_COST', -W.LAST_TRUMPS_COST, 'Einer der letzten beiden eigenen Trümpfe.');
        e.add('TRUMPS_OUT_RESERVE', -W.TRUMPS_OUT_RESERVE * knowledge.trumpsOut / 9, `${knowledge.trumpsOut} Trümpfe sind raus; eigene Reserve schützen.`);
      }
      if (action.type === 'attack') {
        e.add('ATTACK', W.ATTACK, 'Initiative nutzen.');
        if (!trump) {
          e.add('LOW_PLAIN_CARD', W.LOW_PLAIN_CARD * (1 - rank), 'Günstigen Nicht-Trumpf ausspielen.');
          e.add('SHED_HIGH_PLAIN_CARD', W.SHED_HIGH_PLAIN_CARD * rank, 'Hohen Nicht-Trumpf loswerden.');
        }
        const same = view.hand.filter(other => other.id !== c.id && other.rank === c.rank).length;
        const defenderCount = view.players.find(p => p.id === view.defender)?.count ?? 6;
        const followUps = Math.min(same, Math.max(0, Math.min(6 - view.table.length, defenderCount) - 1));
        e.add('SAME_RANK', W.SAME_RANK * followUps, `${followUps} weitere eigene Karten dieses Rangs könnten folgen.`);
        const evidence = attackEvidence(view, knowledge, c);
        e.add('FORCE_PICKUP', W.FORCE_PICKUP * evidence.pickupEstimate, `Geschätzte Chance ohne passende Abwehr: ${Math.round(evidence.pickupEstimate * 100)} % (öffentliches Wissen, keine Gewissheit).`);
        if (evidence.knownCounter) e.add('KNOWN_COUNTER_COST', -W.KNOWN_COUNTER_COST, 'Sichtbar aufgenommene Gegenkarte noch bekannt auf der Hand.');
        e.add('OBSERVED_WEAKNESS', W.OBSERVED_WEAKNESS * evidence.weakness, 'Frühere Aufnahme dieser Farbe: schwaches Indiz, kein Beweis.');
        if (view.table.length) e.add('THROW_IN_COST', -W.THROW_IN_COST, 'Nachwerfen nur mit ausreichendem Nutzen.');
        else e.add('REPEATED_OPENING_COST', -W.REPEATED_OPENING_COST * (knowledge.openings.get(c.id) ?? 0), 'Eröffnungen variieren, um Aufnahme-Schleifen zu vermeiden.');
        if (view.taking) e.add('PICKUP_THROW_IN', W.PICKUP_THROW_IN, 'Der Verteidiger hat die Aufnahme erklärt.');
      }
      if (action.type === 'defend') {
        e.add('DEFEND', W.DEFEND, 'Angriff abwehren und Initiative erhalten.');
        e.add('DEFENSE_RANK_COST', -W.DEFENSE_RANK_COST * rank, 'Mit der niedrigsten geeigneten Karte verteidigen.');
        // Greedy estimate for other OPEN attacks, no game-tree search. Already
        // spent cards are sunk costs, never a reason to waste more trumps.
        const remaining = view.hand.filter(other => other.id !== c.id);
        for (const [target, pair] of view.table.entries()) {
          if (pair.defense || target === action.target) continue;
          const options = remaining.filter(other => beats(other, pair.attack, view.trump))
            .sort((a, b) => trumpCost(a, view, knowledge) + a.value - trumpCost(b, view, knowledge) - b.value);
          if (!options.length) e.add('UNANSWERABLE_ATTACK_COST', -W.UNANSWERABLE_ATTACK_COST, 'Ein weiterer offener Angriff wäre nicht mehr abwehrbar.');
          else {
            const candidate = options[0];
            e.add('FUTURE_DEFENSE_COST', -W.FUTURE_DEFENSE_COST * (trumpCost(candidate, view, knowledge) + candidate.value), 'Zusätzliche Karten für weitere offene Angriffe reservieren.');
            remaining.splice(remaining.indexOf(candidate), 1);
          }
        }
      }
      if (endgame && view.hand.length <= 2) e.add(view.hand.length === 1 ? 'FINISH_HAND' : 'PENULTIMATE_CARD', view.hand.length === 1 ? W.FINISH_HAND : W.PENULTIMATE_CARD, 'Ohne Nachziehstapel die eigene Hand leeren.');
    }
    return e.result();
  });
}
