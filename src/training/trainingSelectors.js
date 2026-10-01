import {analyzePublicCards} from './analysis.js';

export const selectTrainingFacts = view => analyzePublicCards(view);
export function memoryCandidates(view, player) {
  // Only cards visibly picked up AND not subsequently played are eligible.
  const known = selectTrainingFacts(view).knownHeld[player] ?? [];
  return [...known].sort((a, b) =>
    Number(b.suit === view.trump) - Number(a.suit === view.trump)
    || b.value - a.value || a.id.localeCompare(b.id));
}
export function trumpSolution(view) {
  const memory = selectTrainingFacts(view).memory;
  return {number: memory.numberTrumpsOut, faces: Object.entries(memory.facesOut).filter(([, out]) => out).map(([rank]) => rank)};
}
