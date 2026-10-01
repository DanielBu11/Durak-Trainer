// Observe a completed, immutable UI transition; never change game state.
// Draws are inferred from public stock count, without exposing deck contents.
export function audioEvents(before,after,action) {
  const sounds=[];
  if(action.type==='attack')sounds.push('cardPlay');
  if(action.type==='defend')sounds.push('cardDefend');
  const events=after.events.slice(before.events.length);
  if(events.some(e=>e.type==='pickup'))sounds.push('cardsPickup');
  if(events.some(e=>e.type==='discard'))sounds.push('discard');
  // One cue per refill batch prevents a deafening burst of up to 18 sounds.
  if(after.stock.length<before.stock.length)sounds.push('cardDraw');
  if(!before.players[0].out && after.players[0].out && !(after.finished&&after.loser===null))sounds.push('win');
  if(!before.finished&&after.finished&&after.loser===0)sounds.push('lose');
  return sounds;
}
