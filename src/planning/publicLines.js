import {deck,beats} from '../game/cards.js';

export const SEARCH_LIMITS=Object.freeze({ROOTS:8,BEAM:4,OWN_STEPS:4,NODES_PER_ROOT:48});
const name=c=>`${c.rank}${c.suit}`;
const key=a=>`${a.type}:${a.card??''}:${a.target??''}`;

/** Small conditional scenario search, NOT access to a sampled real deal.
 * Every node retains the remaining OWN hand. Opponent replies come from known
 * cards or a public possibility pool and are explicitly marked hypothetical.
 * No refill is invented. Future round openings require a stated condition. */
export function searchPublicLines(view,facts,weights,rootActions){
  const endgame=view.stockCount===0;
  const quality=n=>{
    const ranks=new Map();for(const c of n.hand)ranks.set(c.rank,(ranks.get(c.rank)??0)+1);
    const pairs=[...ranks.values()].reduce((v,count)=>v+Math.max(0,count-1),0);
    return -n.hand.length*weights.CARD_COUNT+pairs*weights.PAIRS
      +n.hand.filter(c=>c.suit===view.trump).reduce((v,c)=>v+weights.TRUMP_RESERVE*(1+c.value/8),0)
      +n.pressure*weights.PRESSURE-n.risk*weights.RISK
      +(endgame&&!n.hand.length?weights.FINISH:0);
  };
  const initial=()=>({hand:view.hand.map(c=>({...c})),table:structuredClone(view.table),defender:view.defender,
    counts:view.players.map(p=>p.count),known:structuredClone(facts.knownCardsByPlayer),
    discarded:structuredClone(facts.discardedCards),phase:view.actions.some(a=>a.type==='defend'||a.type==='take')?'defend':'attack',
    limit:view.limit??Math.min(6,view.players.find(p=>p.id===view.defender)?.count??6),taking:view.taking,
    pressure:0,risk:0,steps:[],cardsPlayed:[],conditional:false,terminal:false});
  function options(n){
    if(n.terminal||!n.hand.length)return [];
    if(n.phase==='defend')return n.table.flatMap((p,target)=>p.defense?[]:n.hand.filter(c=>beats(c,p.attack,view.trump)).map(c=>({type:'defend',card:c.id,target}))).concat({type:'take'});
    const ranks=new Set(n.table.flatMap(p=>[p.attack.rank,p.defense?.rank]));
    if(n.table.length>=n.limit)return [];
    return n.hand.filter(c=>!n.table.length||ranks.has(c.rank)).map(c=>({type:'attack',card:c.id}));
  }
  function advance(n,a){
    n=structuredClone(n);
    if(a.type==='pass'){n.steps.push({text:'Angriff beenden.',kind:'pass'});n.terminal=true;return [n];}
    if(a.type==='take'){
      n.hand.push(...n.table.flatMap(p=>[p.attack,p.defense].filter(Boolean)));
      n.steps.push({text:'Aufnehmen; weitere Nachwürfe sind möglich.',kind:'take'});n.risk+=2;n.terminal=true;return [n];
    }
    const index=n.hand.findIndex(c=>c.id===a.card);if(index<0)return [];
    const c=n.hand.splice(index,1)[0];n.cardsPlayed.push(c.id);
    n.steps.push({text:`${n.conditional?'Falls keine weiteren Nachwürfe folgen, in der nächsten Runde: ':''}${a.type==='defend'?'Mit '+name(c)+' verteidigen.':name(c)+(n.table.length?' nachwerfen.':' angreifen.')}`,kind:a.type,card:c.id,remaining:n.hand.map(c=>c.id)});
    n.conditional=false;
    if(a.type==='defend'){
      n.table[a.target].defense=c;
      if(n.table.every(p=>p.defense)){
        n.discarded.push(...n.table.flatMap(p=>[p.attack,p.defense].filter(Boolean)));n.table=[];n.phase='attack';n.taking=false;n.conditional=true;
        n.defender=[1,2,3].map(i=>(view.player+i)%3).find(id=>id!==view.player&&!view.players.find(p=>p.id===id)?.out)??view.defender;
        n.limit=Math.min(6,endgame?n.counts[n.defender]:6);
      }
      return [n];
    }
    n.table.push({attack:c,defense:null});
    if(n.taking){n.pressure++;return [n];}
    const known=n.known[n.defender]??[];
    const answers=known.filter(other=>beats(other,c,view.trump)).sort((a,b)=>Number(a.suit===view.trump)-Number(b.suit===view.trump)||a.value-b.value);
    const unknown=Math.max(0,n.counts[n.defender]-known.length);
    const excluded=new Set([...view.hand,...n.discarded,...n.table.flatMap(p=>[p.attack,p.defense].filter(Boolean)),...n.known.flat()].map(c=>c.id));
    const possible=unknown?deck().filter(other=>!excluded.has(other.id)&&beats(other,c,view.trump)).sort((a,b)=>b.value-a.value):[];
    const scenarios=[];
    // Pickup is conditional, even with a known counter (voluntary pickup).
    const pickup=structuredClone(n);pickup.taking=true;pickup.pressure+=n.table.length;
    pickup.steps.push({text:'Falls der Gegner aufnimmt: passende Tischränge weiter nutzen.',kind:'condition'});scenarios.push(pickup);
    for(const [reply,hypothetical] of [[answers[0],false],[possible[0],true]]){
      if(!reply)continue;
      const response=structuredClone(n);response.table.at(-1).defense=reply;response.counts[n.defender]--;
      response.known[n.defender]=known.filter(c=>c.id!==reply.id);response.risk+=hypothetical?1.5:1;
      response.steps.push({text:`${hypothetical?'Mögliche unbekannte':'Bekannte mögliche'} Antwort: ${name(reply)}.`,kind:'reply',hypothetical});
      scenarios.push(response);
    }
    return scenarios;
  }
  let totalNodes=0;
  const roots=rootActions.slice(0,SEARCH_LIMITS.ROOTS);
  const lines=roots.map(action=>{
    let nodes=0,maxDepth=1;
    const start=initial(),baseline=quality(start);
    const scenarios=advance(start,action);nodes+=scenarios.length;
    const outcomes=scenarios.map(first=>{
      let beam=[first],best=first;
      for(let depth=1;depth<SEARCH_LIMITS.OWN_STEPS&&nodes<SEARCH_LIMITS.NODES_PER_ROOT;depth++){
        const next=[];
        for(const n of beam){
          for(const a of options(n).sort((a,b)=>key(a).localeCompare(key(b))).slice(0,SEARCH_LIMITS.BEAM)){
            const children=advance(n,a).slice(0,SEARCH_LIMITS.NODES_PER_ROOT-nodes);
            nodes+=children.length;next.push(...children);if(nodes>=SEARCH_LIMITS.NODES_PER_ROOT)break;
          }
          if(nodes>=SEARCH_LIMITS.NODES_PER_ROOT)break;
        }
        if(!next.length)break;maxDepth=depth+1;
        next.sort((a,b)=>quality(b)-quality(a));beam=next.slice(0,SEARCH_LIMITS.BEAM);
        if(quality(beam[0])>quality(best))best=beam[0];
      }
      return best;
    });
    // Conservative root comparison: don't select a move only because a generous
    // opponent might take. Also expose a clearly conditional promising line.
    outcomes.sort((a,b)=>quality(a)-quality(b));
    const robust=outcomes[0]??start,promising=outcomes.at(-1)??start;
    totalNodes+=nodes;
    return {action,score:quality(robust)-baseline,steps:promising.steps,remaining:promising.hand.map(c=>c.id),
      depth:maxDepth,nodes,scenarioCount:scenarios.length,robustSteps:robust.steps};
  });
  return {lines,totalNodes,limits:SEARCH_LIMITS};
}
