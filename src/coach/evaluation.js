import {beats,deck} from '../game/cards.js';

// Contextual position weights: individual card rank is never the final policy.
export const COACH_WEIGHTS=Object.freeze({EARLY_COUNT:6,MIDDLE_COUNT:9,END_COUNT:16,
 EARLY_PAIR:10,MIDDLE_PAIR:12,END_PAIR:18,EARLY_TRUMP:14,MIDDLE_TRUMP:12,END_TRUMP:8,
 ISOLATED_HIGH:6,SUIT_CONTROL:2,PRESSURE:22,END_PRESSURE:34,REPLY_COST:12,FOLLOWUP:9,
 WEAKNESS:5,DEFENSE_TEMPO:8,TAKE_TEMPO:5,END_TAKE_TEMPO:12,OPEN_RANK:12,
 UNKNOWN_RANK:3,FINISH:100,LOOKAHEAD:.65,DEFENSE_NODES:256});
const names=['Du','Uhu','Aal'];
export const actionLabel=(a,hand)=>{
 const c=hand.find(c=>c.id===a.card),label=c?`${c.rank}${c.suit}`:'';
 return a.type==='attack'?`${label} spielen`:a.type==='defend'?`Mit ${label} verteidigen`:a.type==='take'?'Aufnehmen':'Angriff beenden';
};
export function phaseWeights(view){
 const phase=view.stockCount===0?'endgame':view.stockCount>9?'early':'middle',W=COACH_WEIGHTS;
 return {phase,count:phase==='early'?W.EARLY_COUNT:phase==='middle'?W.MIDDLE_COUNT:W.END_COUNT,
 pair:phase==='early'?W.EARLY_PAIR:phase==='middle'?W.MIDDLE_PAIR:W.END_PAIR,
 trump:phase==='early'?W.EARLY_TRUMP:phase==='middle'?W.MIDDLE_TRUMP:W.END_TRUMP};
}
export function handQuality(hand,view,facts){
 const w=phaseWeights(view),ranks=new Map(),suits=new Map();
 for(const c of hand){ranks.set(c.rank,(ranks.get(c.rank)??0)+1);suits.set(c.suit,Math.max(suits.get(c.suit)??0,c.value));}
 const out=Object.values(facts.knownTrumpState.facesOut).filter(Boolean).length+(facts.knownTrumpState.numberOut??0);
 let value=-hand.length*w.count;
 for(const n of ranks.values())value+=Math.max(0,n-1)*w.pair;
 for(const c of hand){
  if(c.suit===view.trump)value+=w.trump*(.45+c.value/8)*(1+out/18);
  else if(ranks.get(c.rank)===1)value-=COACH_WEIGHTS.ISOLATED_HIGH*(c.value/8)**2;
 }
 for(const v of suits.values())value+=COACH_WEIGHTS.SUIT_CONTROL*v/8;
 return value;
}
// No numeric discard identities are reconstructed from the count at level 2.
export function possibleCards(view,facts){
 const excluded=new Set([...view.hand,...facts.discardedCards,...facts.knownCardsByPlayer.flat(),...view.table.flatMap(p=>[p.attack,p.defense].filter(Boolean))].map(c=>c.id));
 const numeric=deck().filter(c=>c.suit===view.trump&&c.value<=4&&!excluded.has(c.id)).length;
 const weight=numeric?Math.max(0,1-(facts.knownTrumpState.numberOut??0)/numeric):0;
 return deck().filter(c=>!excluded.has(c.id)).map(card=>({card,weight:card.suit===view.trump&&card.value<=4?weight:1})).filter(p=>p.weight>0);
}
export function attackPressure(card,view,facts){
 const known=facts.knownCardsByPlayer[view.defender]??[],count=view.players.find(p=>p.id===view.defender)?.count??6;
 const unknown=Math.max(0,count-known.length),answers=known.filter(c=>beats(c,card,view.trump));
 const pool=possibleCards(view,facts),mass=pool.reduce((n,p)=>n+p.weight,0),matching=pool.filter(p=>beats(p.card,card,view.trump));
 const fraction=mass?matching.reduce((n,p)=>n+p.weight,0)/mass:0;
 const pickup=answers.length?0:Math.pow(1-fraction,unknown);
 const cost=c=>c.suit===view.trump?.7+.3*c.value/8:.15+.5*c.value/8;
 const knownCost=answers.length?Math.min(...answers.map(cost)):1;
 const unknownCost=matching.length?matching.reduce((n,p)=>n+p.weight*cost(p.card),0)/matching.reduce((n,p)=>n+p.weight,0):1;
 return {pickup,unknown,answers,cost:Math.min(knownCost,unknown?unknownCost:knownCost)};
}
function rankDanger(cards,view,facts){
 const old=new Set(view.table.flatMap(p=>[p.attack.rank,p.defense?.rank]));
 const opened=new Set(cards.map(c=>c.rank).filter(r=>!old.has(r))),room=Math.max(0,(view.limit??6)-view.table.length);
 if(!room)return 0;
 const known=facts.knownCardsByPlayer.flatMap((hand,id)=>id===view.player?[]:hand);
 const certain=known.filter(c=>opened.has(c.rank)).length;
 const possible=possibleCards(view,facts).filter(p=>opened.has(p.card.rank)).reduce((n,p)=>n+p.weight,0);
 return Math.min(room,certain)*COACH_WEIGHTS.OPEN_RANK+Math.min(room,possible/4)*COACH_WEIGHTS.UNKNOWN_RANK;
}
// Compare whole assignments, not greedy cheapest defenses. Bounded and stable;
// a missing completion is a search limitation, never a claim of impossibility.
function defenseCompletion(rest,open,view,facts){
 let nodes=0,best=null;
 const visit=(hand,index,used)=>{
  if(++nodes>COACH_WEIGHTS.DEFENSE_NODES)return;
  if(index===open.length){const score=handQuality(hand,view,facts)-rankDanger(used,view,facts);if(!best||score>best.score)best={score,hand};return;}
  for(const c of hand.filter(c=>beats(c,open[index].attack,view.trump)).sort((a,b)=>a.id.localeCompare(b.id)))visit(hand.filter(x=>x.id!==c.id),index+1,[...used,c]);
 };
 visit(rest,0,[]);return best;
}
export function coachScores(view,facts){
 const W=COACH_WEIGHTS,w=phaseWeights(view),before=handQuality(view.hand,view,facts);
 const tableCards=view.table.flatMap(p=>[p.attack,p.defense].filter(Boolean)),pickupHand=[...view.hand,...tableCards];
 const pickupScore=handQuality(pickupHand,view,facts)-before-(w.phase==='endgame'?W.END_TAKE_TEMPO:W.TAKE_TEMPO);
 return view.actions.map(action=>{
  let score=0,completeDefense=false;const reasons=[];let rest=view.hand;
  if(action.type==='pass')reasons.push('Den Angriff beenden und die verbleibende Hand zusammenhalten.');
  if(action.type==='take'){
   score=pickupScore;rest=pickupHand;
   reasons.push(`${tableCards.length} Tischkarten kommen hinzu; weitere Nachwürfe sind möglich.`,'Aufnehmen erhält deine Verteidigungsreserve und vermeidet den teuren Einsatz deiner passenden Karten.');
   if(tableCards.some(c=>view.hand.some(h=>h.rank===c.rank)))reasons.push('Die aufgenommenen Karten ergänzen gleiche Ränge für einen späteren Angriff.');
  }
  const c=view.hand.find(c=>c.id===action.card);
  if(c){
   rest=view.hand.filter(x=>x.id!==c.id);score=handQuality(rest,view,facts)-before;
   const same=rest.filter(x=>x.rank===c.rank).length;
   if(action.type==='attack'){
    const pressure=attackPressure(c,view,facts),room=Math.max(0,(view.limit??6)-view.table.length-1);
    score+=(view.taking?1:pressure.pickup)*(w.phase==='endgame'?W.END_PRESSURE:W.PRESSURE);
    if(!view.taking)score+=(1-pressure.pickup)*pressure.cost*W.REPLY_COST;
    score+=Math.min(same,room)*(w.pair+W.FOLLOWUP);
    if(same&&room)reasons.push(`Weitere Karten vom Rang ${c.rank} passen zum Nachwerfen; so kannst du mehrere Karten zusammen loswerden.`);
    if(!same&&c.suit!==view.trump&&c.value>=5)reasons.push('Du wirst eine isolierte hohe Farbkarte los, ohne eine Rang-Kombination aufzubrechen.');
    if(pressure.answers.length){const reply=pressure.answers.slice().sort((a,b)=>a.value-b.value)[0];reasons.push(`${names[view.defender]} kann mit der bekannten ${reply.rank}${reply.suit} antworten; diese Karte wäre danach verbraucht.`);}
    else reasons.push(pressure.unknown?`${names[view.defender]} hat keine bekannte Antwort; unbekannte Karten könnten den Angriff noch schlagen.`:`Die vollständig bekannte Hand von ${names[view.defender]} hat keine passende Antwort.`);
    if(c.suit===view.trump)reasons.push('Dieser Trumpfangriff tauscht eigene Reserve gegen Druck auf die gegnerischen Trümpfe.');
    if(facts.suspectedSuitWeaknesses.some(s=>s.player===view.defender&&s.suit===c.suit)){score+=W.WEAKNESS;reasons.push(`${names[view.defender]} ist in dieser Farbe vermutlich schwach; das bleibt eine Vermutung.`);}
   }else{
    const open=view.table.filter((p,i)=>!p.defense&&i!==action.target),completion=defenseCompletion(rest,open,view,facts);
    if(completion){completeDefense=true;rest=completion.hand;score=completion.score-before+W.DEFENSE_TEMPO-rankDanger([c],view,facts);}
    else {score=pickupScore-12;reasons.push('Für die übrigen offenen Angriffe findet die begrenzte Suche keine vollständige Verteidigung.');}
    if(c.suit!==view.trump)reasons.push('Die Farbkarte verteidigt und erhält deine Trümpfe als Reserve.');
    if(same)reasons.push(`Die Verteidigung löst eine ${c.rank}er-Kombination auf; dieser Verlust ist mitbewertet.`);
    else if(rest.some(x=>rest.filter(y=>y.rank===x.rank).length>1))reasons.push('Deine gleichen Ränge bleiben für einen späteren gemeinsamen Angriff zusammen.');
    if(rankDanger([c],view,facts)>W.OPEN_RANK/2)reasons.push(`Der neue Tischrang ${c.rank} könnte weitere Nachwürfe ermöglichen.`);
   }
   if(w.phase==='endgame'&&!rest.length&&(action.type==='attack'||completeDefense)){score+=W.FINISH;reasons.push('Damit lässt sich die Hand leeren; das Ausscheiden zählt erst am Rundenende.');}
  }
  if(reasons.length<2&&c)reasons.push(`Danach bleiben ${rest.length} Karten; die Bewertung berücksichtigt zusammenpassende Ränge und deine Trumpfreserve.`);
  return {action,score,reasons,remaining:rest.map(c=>c.id),phase:w.phase};
 });
}
export function basicCoachAdvice({view,knowledge}){
 const alternatives=coachScores(view,knowledge).sort((a,b)=>b.score-a.score||JSON.stringify(a.action).localeCompare(JSON.stringify(b.action)));
 if(!alternatives.length)return {available:false,lines:[]};
 const best=alternatives[0];return {available:true,action:best.action,label:actionLabel(best.action,view.hand),reasons:best.reasons.slice(0,3),alternatives,lines:[]};
}
