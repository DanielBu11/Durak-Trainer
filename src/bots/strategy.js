import {beginnerScores} from './beginner.js';
import {amateurScores} from './amateur.js';
import {publicView} from './view.js';

/** Highest score wins. Ties use a stable key, or an explicitly injected RNG.
 * Diagnostics and normal play use exactly the same evaluation path. */
export function explainDecision(observation, level = 'beginner', {rng} = {}) {
  if (!['beginner', 'amateur'].includes(level)) throw new Error(`Unbekannte Bot-Stufe: ${level}`);
  const view = publicView(observation, level);
  const alternatives = level === 'amateur' ? amateurScores(view) : beginnerScores(view);
  const key = a => `${a.type}:${a.card ?? ''}:${a.target ?? ''}`;
  alternatives.sort((a, b) => b.score - a.score || (key(a.action) < key(b.action) ? -1 : key(a.action) > key(b.action) ? 1 : 0));
  if (!alternatives.length) return {level, action: null, card: null, score: null, reasons: [], alternatives: []};
  const tied = alternatives.filter(a => a.score === alternatives[0].score);
  let choice = tied[0];
  if (rng && tied.length > 1) {
    const random = rng();
    if (!Number.isFinite(random) || random < 0 || random >= 1) throw new Error('RNG muss in [0, 1) liegen.');
    choice = tied[Math.floor(random * tied.length)];
  }
  return {level, action: choice.action, card: view.hand.find(c => c.id === choice.action.card) ?? null,
    score: choice.score, reasons: [...choice.reasons].sort((a, b) => Math.abs(b.points) - Math.abs(a.points)).slice(0, 5), alternatives};
}
export function chooseAction(view, level = 'beginner', options = {}) {
  return explainDecision(view, level, options).action;
}
