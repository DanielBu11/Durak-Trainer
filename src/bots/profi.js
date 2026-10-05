import {amateurScores} from './amateur.js';
import {publicKnowledge,attackEvidence} from './knowledge.js';
import {stockRemaining} from './view.js';

// Additive refinements; counting, countercards, weakness and endgame already
// carry the calibrated Amateur weights. Zero avoids charging them twice.
export const PROFI_WEIGHTS=Object.freeze({STRUCTURE:1,PAIR_STRUCTURE:5,SUIT_CONTROL:2,TRUMP_CONTROL:3,
  ENDGAME_RELEASE:0,KNOWN_COUNTER:0,PICKUP_PRESSURE:0,WEAKNESS:0,
  SHORT_OPPONENT:0,EMPTY_HAND:0,TAKE_BURDEN:0,HIGH_PLAIN:6});

export function handQuality(hand,trump){
  const ranks=new Map(),suits=new Map();
  for(const c of hand){ranks.set(c.rank,(ranks.get(c.rank)??0)+1);suits.set(c.suit,Math.max(suits.get(c.suit)??0,c.value));}
  return [...ranks.values()].reduce((n,count)=>n+Math.max(0,count-1)*PROFI_WEIGHTS.PAIR_STRUCTURE,0)
    + [...suits.values()].reduce((n,value)=>n+value/8*PROFI_WEIGHTS.SUIT_CONTROL,0)
    + hand.filter(c=>c.suit===trump).reduce((n,c)=>n+(1+c.value/8)*PROFI_WEIGHTS.TRUMP_CONTROL,0);
}
export function profiScores(view,weights=PROFI_WEIGHTS){
  const k=publicKnowledge(view),end=stockRemaining(view)===0,W=weights;
  return amateurScores(view).map(result=>{
    const reasons=[...result.reasons];
    const add=(factor,points,detail)=>{if(points)reasons.push({factor,points,detail});};
    const a=result.action,c=view.hand.find(c=>c.id===a.card);
    if(c){
      const rest=view.hand.filter(other=>other.id!==c.id);
      add('HAND_STRUCTURE',W.STRUCTURE*(handQuality(rest,view.trump)-handQuality(view.hand,view.trump)),'Zusammenhängende Ränge und brauchbare Verteidigung in der Resthand erhalten.');
      if(end&&c.suit===view.trump)add('ENDGAME_RELEASE',W.ENDGAME_RELEASE*(.5+c.value/16),'Ohne Nachziehstapel Trümpfe zum Leeren der Hand einsetzen.');
      if(end&&!rest.length)add('EMPTY_HAND',W.EMPTY_HAND,'Letzte eigene Karte abgeben; endgültiges Ausscheiden erst am Rundenende.');
      if(a.type==='attack'){
        const evidence=attackEvidence(view,k,c),count=view.players.find(p=>p.id===view.defender)?.count??6;
        add('PUBLIC_PRESSURE',W.PICKUP_PRESSURE*evidence.pickupEstimate,'Öffentliche Kartenlage lässt eine Aufnahme eher erwarten; unbekannte Karten bleiben möglich.');
        if(evidence.knownCounter)add('KNOWN_COUNTER',-W.KNOWN_COUNTER,'Der Gegner besitzt eine bekannte passende Antwort.');
        add('SUSPECTED_WEAKNESS',W.WEAKNESS*evidence.weakness,'Vermutete Farb-Schwäche aus früheren Aufnahmen, kein Beweis.');
        if(count<=2)add('SHORT_OPPONENT',W.SHORT_OPPONENT*(2*evidence.pickupEstimate-1),'Bei kleiner Gegnerhand eine einfache Abwehr vermeiden.');
        if(c.suit!==view.trump)add('HIGH_PLAIN',W.HIGH_PLAIN*c.value/8,'Hohe Nicht-Trümpfe über passenden Rang loswerden.');
      }
    }
    if(a.type==='take'&&view.hand.length>6)add('TAKE_BURDEN',-W.TAKE_BURDEN*(view.hand.length-6),'Eine bereits große Hand nicht weiter vergrößern.');
    return {...result,reasons,score:reasons.reduce((n,r)=>n+r.points,0)};
  });
}
