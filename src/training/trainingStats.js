import {LEVELS} from './trainingLevels.js';
export const STATS_KEY = 'durak.training.stats.v1';
const emptyLevel = () => ({checks: 0, correct: 0, streak: 0, best: 0});
export function emptyStats() {return {version: 1, ...emptyLevel(), levels: Object.fromEntries(LEVELS.map(l => [l.id, emptyLevel()]))};}
const validCounts = value => value && ['checks','correct','streak','best'].every(k => Number.isSafeInteger(value[k]) && value[k] >= 0)
  && value.correct <= value.checks && value.streak <= value.best && value.best <= value.correct;
export function loadStats(storage) {
  try {
    const data = JSON.parse(storage.getItem(STATS_KEY));
    if (data?.version !== 1 || !validCounts(data) || !LEVELS.every(l => validCounts(data.levels?.[l.id]))) return emptyStats();
    if (LEVELS.reduce((sum,l)=>sum+data.levels[l.id].checks,0)!==data.checks || LEVELS.reduce((sum,l)=>sum+data.levels[l.id].correct,0)!==data.correct) return emptyStats();
    // Copy only expected numeric fields from browser storage.
    const copy = value => Object.fromEntries(['checks','correct','streak','best'].map(k => [k, value[k]]));
    return {version: 1, ...copy(data), levels: Object.fromEntries(LEVELS.map(l => [l.id, copy(data.levels[l.id])]))};
  } catch {return emptyStats();}
}
export function recordCheck(stats, level, correct) {
  if (!stats.levels[level]) return stats;
  const result = structuredClone(stats);
  for (const entry of [result, result.levels[level]]) {
    entry.checks++; entry.correct += Number(Boolean(correct));
    entry.streak = correct ? entry.streak + 1 : 0;
    entry.best = Math.max(entry.best, entry.streak);
  }
  return result;
}
export function saveStats(storage, stats) {try {storage.setItem(STATS_KEY, JSON.stringify(stats)); return true;} catch {return false;}}
export const accuracy = stats => stats.checks ? `${Math.round(100 * stats.correct / stats.checks)} %` : '–';
