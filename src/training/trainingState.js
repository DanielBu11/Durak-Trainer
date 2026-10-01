import {hasFeature, levelDefinition} from './trainingLevels.js';
import {memoryCandidates} from './trainingSelectors.js';

export function createTrainingState() {
  return {enabled: false, level: 1, cursor: 0, remembered: {}, weaknesses: {}, completedRound: null};
}
export function configureTraining(state, {enabled = state.enabled, level = state.level}) {
  return {...state, enabled: Boolean(enabled), level: levelDefinition(level).id};
}
/** Consume public events after an atomic engine action. This module never calls
 * the engine and never receives an opponent's actual hand. Even while disabled,
 * invalidate old memories on play so re-enabling cannot revive stale cards. */
export function observeTraining(state, view) {
  const result = structuredClone(state);
  for (const event of view.events.slice(state.cursor)) {
    if (event.type === 'play') {
      for (const [player, memory] of Object.entries(result.remembered)) {
        if (memory.card.id === event.card.id) delete result.remembered[player];
      }
    }
    if (state.enabled && ['discard', 'pickup'].includes(event.type)) result.completedRound = event.round;
  }
  result.cursor = view.events.length;
  return result;
}
export function rememberCard(state, view, player, cardId) {
  if (!state.enabled || !hasFeature(state.level, 'memory') || ![1, 2].includes(player)) return state;
  const card = memoryCandidates(view, player).find(c => c.id === cardId);
  if (!card) return state;
  return {...state, remembered: {...state.remembered, [player]: {card: {...card}, certainty: 'known', source: 'public-pickup'}}};
}
export function forgetCard(state, player) {
  const remembered = {...state.remembered}; delete remembered[player];
  return {...state, remembered};
}
export function toggleWeakness(state, player, suit) {
  if (!state.enabled || !hasFeature(state.level, 'weakness') || ![1, 2].includes(player) || !['♣','♦','♥','♠'].includes(suit)) return state;
  const weaknesses = structuredClone(state.weaknesses);
  weaknesses[player] ??= {};
  if (weaknesses[player][suit]) delete weaknesses[player][suit];
  else weaknesses[player][suit] = {certainty: 'suspected', suit};
  return {...state, weaknesses};
}
