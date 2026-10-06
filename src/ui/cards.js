import {SUITS, RANKS} from '../game/cards.js';

export const suitName = {'♠':'Pik','♥':'Herz','♦':'Karo','♣':'Kreuz'};
export function card(c, button=false) {
  const el=document.createElement(button?'button':'div');
  el.dataset.card=c.id;
  el.className=`card ${['♥','♦'].includes(c.suit)?'red':''}`;
  el.innerHTML=`<span class="card-index"><span>${c.rank}</span><span>${c.suit}</span></span><span class="suit">${c.suit}</span><span class="corner">${c.rank}</span>`;
  el.setAttribute('aria-label',`${suitName[c.suit]} ${c.rank}`);
  return el;
}
// The historical trump card is not a card in the stock after it has been drawn.
export function stockDisplay(state) {
  return {card:state.stock.length ? state.trumpCard : null, count:state.stock.length,
    label:`${state.stock.length?'Trumpf':'Stapel leer'} · ${state.trump}`};
}
// Read only the real discard pile. Pickups and table cards never count as out.
export function discardRows(discarded) {
  const out=new Set(discarded.map(c=>c.id));
  return SUITS.map(suit=>({suit,name:suitName[suit],cards:RANKS.map(rank=>({rank,out:out.has(suit+rank)}))}));
}
export function renderDiscardOverview(root, discarded, trump) {
  root.innerHTML=discardRows(discarded).map(row=>`<section class="discard-suit ${['♥','♦'].includes(row.suit)?'red':''}"><h3>${row.suit}${row.suit===trump?' (Trumpf)':''} ${row.name}</h3><div class="discard-ranks">${row.cards.map(c=>`<span class="discard-rank ${c.out?'is-out':''}" aria-label="${row.name} ${c.rank}: ${c.out?'raus':'unbekannt'}">${c.rank}<small>${c.out?'✓':'·'}</small></span>`).join('')}</div></section>`).join('');
}
