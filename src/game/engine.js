import {deck, shuffle, beats} from './cards.js';
export function createGame(random = Math.random) {
  const stock = shuffle(deck(), random);
  const trumpCard = stock[0]; // Draw from the end: the exposed bottom card is drawn last.
  const players = ['Du', 'Bot 1', 'Bot 2'].map((name, id) => ({id, name, hand: stock.splice(-6), out: false}));
  const trumps = players.flatMap(p => p.hand.filter(c => c.suit === trumpCard.suit).map(c => ({player:p.id, value:c.value})));
  const attacker = trumps.sort((a,b) => a.value-b.value)[0]?.player ?? 0;
  const state = {players, stock, trump:trumpCard.suit, trumpCard, discarded:[], table:[], events:[], attacker, defender:null, actor:attacker, phase:'attack', taking:false, passed:[], round:0, loser:null, finished:false};
  startRound(state, attacker);
  return state;
}
const next = (s, id) => { for(let i=1;i<=3;i++){const n=(id+i)%3;if(!s.players[n].out)return n;} return id; };
function startRound(s, attacker) {
  s.attacker=attacker; s.defender=next(s, attacker); s.actor=attacker;
  s.limit=Math.min(6,s.players[s.defender].hand.length); s.table=[]; s.passed=[]; s.taking=false; s.phase='attack'; s.round++;
}
export function legalActions(s) {
  if(s.finished) return [];
  const hand=s.players[s.actor].hand;
  if(s.phase==='defend') {
    const actions=[];
    s.table.forEach((pair,target)=>{if(!pair.defense) for(const c of hand) if(beats(c,pair.attack,s.trump)) actions.push({type:'defend',card:c.id,target});});
    return [...actions,{type:'take'}];
  }
  const ranks=new Set(s.table.flatMap(p=>[p.attack.rank,p.defense?.rank]).filter(Boolean));
  const actions=s.table.length<s.limit ? hand.filter(c=>!s.table.length || ranks.has(c.rank)).map(c=>({type:'attack',card:c.id})) : [];
  if(s.table.length) actions.push({type:'pass'});
  return actions;
}
function chooseAttacker(s, from) {
  // A pass lasts until a new attack card changes the table. Every eligible
  // attacker gets another opportunity, including after the defender takes.
  for(let i=0;i<3;i++) { const id=(from+i)%3;
    if(id!==s.defender && !s.players[id].out && s.players[id].hand.length && !s.passed.includes(id)) {s.actor=id;s.phase='attack';return;}
  }
  finishRound(s);
}
function finishRound(s) {
  const cards=s.table.flatMap(p=>[p.attack,p.defense].filter(Boolean));
  const oldDefender=s.defender;
  if(s.taking) { s.players[oldDefender].hand.push(...cards);s.events.push({type:'pickup',player:oldDefender,cards:structuredClone(cards),round:s.round}); }
  else {s.discarded.push(...cards);s.events.push({type:'discard',cards:structuredClone(cards),round:s.round});}
  // Refill clockwise from the original attacker; defender always last.
  const order=[0,1,2].map(i=>(s.attacker+i)%3).filter(id=>id!==oldDefender).concat(oldDefender);
  for(const id of order) while(!s.players[id].out && s.players[id].hand.length<6 && s.stock.length) s.players[id].hand.push(s.stock.pop());
  if(!s.stock.length) for(const p of s.players) if(!p.hand.length && !p.out){p.out=true;s.events.push({type:'out',player:p.id,round:s.round});}
  const remaining=s.players.filter(p=>!p.out);
  if(remaining.length<=1){s.finished=true;s.loser=remaining[0]?.id??null;s.table=[];s.phase='finished';return;}
  // Successful defender attacks next; after taking, skip the defender.
  const attacker=s.taking || s.players[oldDefender].out ? next(s,oldDefender) : oldDefender;
  startRound(s,attacker);
}
export function act(state, action) {
  if(!legalActions(state).some(a=>a.type===action.type && a.card===action.card && a.target===action.target)) throw new Error('Diese Aktion ist nicht erlaubt.');
  const s=structuredClone(state); const player=s.actor;
  if(action.type==='attack' || action.type==='defend') {
    const hand=s.players[player].hand; const card=hand.splice(hand.findIndex(c=>c.id===action.card),1)[0];
    s.events.push({type:'play',player,card:structuredClone(card),round:s.round});
    if(action.type==='attack') {
      s.table.push({attack:card,defense:null});s.passed=[];
      if(s.taking) chooseAttacker(s,player); else {s.actor=s.defender;s.phase='defend';}
    } else {s.table[action.target].defense=card;
      if(s.table.every(p=>p.defense)) chooseAttacker(s,s.attacker);
    }
  } else if(action.type==='take') {s.taking=true;chooseAttacker(s,s.attacker);}
  else {s.passed.push(player);chooseAttacker(s,(player+1)%3);}
  return s;
}
// This is the ONLY input to bots: no stock order or opponents' hidden hands.
export function observation(s, player=s.actor) {
  return {player, hand:structuredClone(s.players[player].hand), players:s.players.map(p=>({id:p.id,count:p.hand.length,out:p.out})), trump:s.trump, trumpCard:{...s.trumpCard}, stockCount:s.stock.length, table:structuredClone(s.table), discarded:structuredClone(s.discarded), events:structuredClone(s.events), attacker:s.attacker, defender:s.defender, phase:s.phase, taking:s.taking, actions:player===s.actor?legalActions(s):[]};
}
