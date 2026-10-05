import {beats} from '../game/cards.js';

export const COACH_WEIGHTS=Object.freeze({ATTACK:22,DEFEND:32,TAKE:-16,PICKUP_CARD:3,ENDGAME_TAKE:45,
  LOW_PLAIN:8,HIGH_PLAIN:3,TRUMP:10,HIGH_TRUMP:22,LAST_TRUMP:8,
  PAIR:7,KNOWN_COUNTER:18,NO_KNOWN_COUNTER:5,ALL_KNOWN_NO_COUNTER:26,WEAKNESS:5,
  FACE_RESERVE:1.5,NUMBER_RESERVE:1,FINISH:120,UNANSWERED:34,
  CARD_COUNT:9,PAIRS:6,TRUMP_RESERVE:3,PRESSURE:4,RISK:7,LOOKAHEAD:.8});
const names=['Du','Uhu','Aal'];
export const actionLabel=(action,hand)=>{
  const c=hand.find(c=>c.id===action.card),label=c?`${c.rank}${c.suit}`:'';
  return action.type==='attack'?`${label} ${action.isThrow?'nachwerfen':'spielen'}`:action.type==='defend'?`Mit ${label} verteidigen`:action.type==='take'?'Aufnehmen':'Angriff beenden';
};
export function coachScores(view,facts){
  const W=COACH_WEIGHTS,end=view.stockCount===0;
  const known=facts.knownCardsByPlayer[view.defender]??[];
  const unknown=Math.max(0,(view.players.find(p=>p.id===view.defender)?.count??6)-known.length);
  return view.actions.map(action=>{
    let score=0;const reasons=[];const add=(points,text)=>{score+=points;if(text)reasons.push(text);};
    if(action.type==='pass')add(0,'Keine zusätzliche Karte investieren.');
    if(action.type==='take'){
      const count=view.table.reduce((n,p)=>n+1+Number(Boolean(p.defense)),0);
      add(W.TAKE-count*W.PICKUP_CARD-(end?W.ENDGAME_TAKE:0),`${count} Tischkarten kämen hinzu; weitere Nachwürfe sind möglich.`);
      reasons.push('So bleiben wertvolle Verteidigungskarten erhalten.');
    }
    const c=view.hand.find(c=>c.id===action.card);
    if(c){
      const rank=c.value/8,trump=c.suit===view.trump;
      const rest=view.hand.filter(other=>other.id!==c.id);
      add(action.type==='attack'?W.ATTACK:W.DEFEND);
      if(trump)add(-W.TRUMP-W.HIGH_TRUMP*rank**2,'Trumpf kostet Verteidigungsreserve; möglichst den kleinsten passenden nutzen.');
      else add(W.LOW_PLAIN*(1-rank)+W.HIGH_PLAIN*rank,action.type==='defend'?'Die normale Farbe reicht; Trumpf bleibt erhalten.':'Einen Nicht-Trumpf abgeben und Trümpfe behalten.');
      if(trump&&view.hand.filter(c=>c.suit===view.trump).length<=1)add(-W.LAST_TRUMP);
      if(trump){
        const faces=Object.entries(facts.knownTrumpState.facesOut).filter(([,out])=>out).map(([rank])=>rank);
        if(faces.length)add(-W.FACE_RESERVE*faces.length,`${faces.join(', ')} sind als hohe Trümpfe raus; die eigene Reserve gezielt einsetzen.`);
        if(facts.knownTrumpState.numberOut!==null)add(-W.NUMBER_RESERVE*facts.knownTrumpState.numberOut,`${facts.knownTrumpState.numberOut} der fünf Zahlentrümpfe sind raus.`);
      }
      if(action.type==='attack'){
        const same=rest.filter(other=>other.rank===c.rank).length;
        if(same)add(W.PAIR*Math.min(same,Math.max(0,(view.limit??6)-view.table.length-1)),`${same} weitere eigene Karte${same===1?'':'n'} desselben Rangs ermöglichen passende Nachwürfe.`);
        if(facts.level>=3){
          const reply=known.find(other=>beats(other,c,view.trump));
          if(reply)add(-W.KNOWN_COUNTER,`${names[view.defender]} hat ${reply.rank}${reply.suit} als bekannte mögliche Antwort.`);
          else add(unknown?W.NO_KNOWN_COUNTER:W.ALL_KNOWN_NO_COUNTER,unknown?`${names[view.defender]} hat keine bekannte Antwort; unbekannte Karten könnten schlagen.`:`Die vollständig bekannte Hand von ${names[view.defender]} hat keine passende Antwort.`);
        }
        if(facts.level>=4&&facts.suspectedSuitWeaknesses.some(w=>w.player===view.defender&&w.suit===c.suit))add(W.WEAKNESS,`${names[view.defender]} ist bei ${c.suit} vermutlich schwach; das ist keine Gewissheit.`);
      }
      if(action.type==='defend'){
        add(-c.value);
        const available=[...rest];
        for(const [target,pair] of view.table.entries())if(!pair.defense&&target!==action.target){
          const reply=available.filter(other=>beats(other,pair.attack,view.trump)).sort((a,b)=>Number(a.suit===view.trump)-Number(b.suit===view.trump)||a.value-b.value)[0];
          if(reply){add(-(reply.suit===view.trump?W.TRUMP+reply.value:reply.value));available.splice(available.indexOf(reply),1);}
          else add(-W.UNANSWERED,'Ein weiterer offener Angriff wäre mit der Resthand nicht abwehrbar.');
        }
      }
      if(end&&!rest.length)add(W.FINISH,'Die eigene Hand wäre leer; das Ausscheiden wird am Rundenende entschieden.');
    }
    return {action,score,reasons};
  });
}

// This entry receives only the filtered coach interface, never game state.
export function basicCoachAdvice({view,knowledge}){
  const alternatives=coachScores(view,knowledge).sort((a,b)=>b.score-a.score||JSON.stringify(a.action).localeCompare(JSON.stringify(b.action)));
  if(!alternatives.length)return {available:false,lines:[]};
  const best=alternatives[0];
  return {available:true,action:best.action,label:actionLabel(best.action,view.hand),reasons:best.reasons.slice(-3),alternatives,lines:[]};
}
