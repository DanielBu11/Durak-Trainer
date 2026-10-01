import {createGame, act, observation, legalActions} from '../src/game/engine.js';
import {chooseAction} from '../src/bots/strategy.js';

function rng(seed) {
  return () => {seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296;};
}
// Fixed deals, all three seats, and a reproducible uniform-legal random baseline.
// This is a smoke benchmark, not a calibrated skill rating or tuning dataset.
const results = [];
for (const policy of ['random', 'beginner', 'amateur']) {
  let losses = 0, draws = 0, stepsTotal = 0;
  const games = 90;
  for (let game = 0; game < games; game++) {
    const seat = game % 3, random = rng(9000 + game);
    let state = createGame(rng(5000 + Math.floor(game / 3))), steps = 0;
    while (!state.finished && steps++ < 4000) {
      const actions = legalActions(state);
      const action = state.actor === seat && policy !== 'random'
        ? chooseAction(observation(state), policy)
        : actions[Math.floor(random() * actions.length)];
      state = act(state, action);
    }
    if (!state.finished) throw new Error(`${policy}, game ${game}: did not terminate`);
    losses += Number(state.loser === seat);
    draws += Number(state.loser === null);
    stepsTotal += steps;
  }
  results.push({policy, games, losses, draws, lossPercent: +(100 * losses / games).toFixed(1), meanActions: Math.round(stepsTotal / games)});
}
console.table(results);
