import {hasFeature} from './trainingLevels.js';
import {trumpSolution} from './trainingSelectors.js';

// Snapshot solutions when opening a check. The UI pauses play until dismissal.
// Answers and evaluations never write to the engine or training memory.
export function createCheck(state, view, kind = 'trumps', player = null) {
  if (!state.enabled) return null;
  if (kind === 'memory') {
    const memory = state.remembered[player];
    if (!hasFeature(state.level, 'memory') || !memory) return null;
    return {kind, level: state.level, player, solution: {card: {...memory.card}}};
  }
  if (kind !== 'trumps') return null;
  return {kind, level: state.level, includeNumbers: hasFeature(state.level, 'numbers'), solution: trumpSolution(view)};
}
export function evaluateCheck(check, answer) {
  if (check.kind === 'memory') return {correct: answer.card === check.solution.card.id, solution: structuredClone(check.solution)};
  const faces = [...new Set(answer.faces ?? [])].sort();
  const expected = [...check.solution.faces].sort();
  const facesCorrect = faces.length === expected.length && faces.every((rank, i) => rank === expected[i]);
  const numberCorrect = !check.includeNumbers || (Number.isInteger(answer.number) && answer.number === check.solution.number);
  return {correct: facesCorrect && numberCorrect, facesCorrect, numberCorrect, solution: structuredClone(check.solution)};
}
