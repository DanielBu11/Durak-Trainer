import {collectionFeedback} from './eventFeedback.js';
import {card} from './cards.js';
// Presentation only: DOM snapshots plus already-public transition events.
// No timers advance the game, and animations never trigger audio or actions.
export const COLLECTION_MS=660;
const running=new Set();
function track(animation){running.add(animation);animation.finished.then(()=>running.delete(animation),()=>running.delete(animation));return animation;}
export function cancelMotion(){for(const animation of running)animation.cancel();running.clear();document.querySelectorAll('.motion-card, .motion-destination').forEach(el=>el.remove());}
export function motionFinished(){return Promise.allSettled([...running].map(a=>a.finished));}
export function pulseStock(){if(!matchMedia('(prefers-reduced-motion: reduce)').matches)track(document.getElementById('stock').animate([{filter:'brightness(1)'},{filter:'brightness(1.3)'},{filter:'brightness(1)'}],{duration:300}));}
const rect = el => el?.getBoundingClientRect();
const player = id => document.getElementById(id === 0 ? 'hand' : `bot${id}`);
export function captureMotion(actor) {
  return {source:rect(player(actor)), stock:rect(document.querySelector('#stock .card')||document.getElementById('stock')),
    hand:[...document.querySelectorAll('#hand .card')].map(el=>({id:el.dataset.card,box:rect(el)})),
    table:[...document.querySelectorAll('#table .card')].map(el=>({id:el.dataset.card,node:el.cloneNode(true),box:rect(el)}))};
}
function fly(node, from, to, delay=0) {
  if(!from || !to || !node.animate || matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  node.removeAttribute('id');node.removeAttribute('aria-label');node.setAttribute('aria-hidden','true');node.tabIndex=-1;
  node.className='card motion-card'+(node.classList.contains('draw-back')?' draw-back':'')+(node.classList.contains('red')?' red':'');
  Object.assign(node.style,{left:`${from.left}px`,top:`${from.top}px`,width:`${from.width}px`,height:`${from.height}px`});
  document.body.append(node);
  const x=to.left+to.width/2-from.left-from.width*.3;
  const y=to.top+to.height/2-from.top-from.height*.3;
  const arrival=`translate(${x}px,${y}px) scale(.6)`;
  const animation=track(node.animate([
    {transform:'translate(0,0) scale(1)',opacity:1},
    {transform:arrival,opacity:1,offset:.78},
    {transform:arrival,opacity:1,offset:.92},
    {transform:arrival,opacity:0}
  ],{duration:COLLECTION_MS,delay,fill:'backwards',easing:'cubic-bezier(.22,.65,.3,1)'}));
  animation.finished.then(()=>node.remove(),()=>node.remove());
}
export function animateMove(snapshot, before, after, action, events) {
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const laid=[...document.querySelectorAll('#table .card')].find(el=>el.dataset.card===action.card);
  if(laid){
    const destination=rect(laid), origin=before.actor===0?snapshot.hand.find(c=>c.id===action.card)?.box:snapshot.source;
    // Animate the actual final card: its rank stays readable throughout landing.
    if(origin)track(laid.animate([{transform:`translate(${origin.left-destination.left}px,${origin.top-destination.top}px)`,opacity:.4},{transform:'translate(0,0)',opacity:1}],{duration:220,easing:'ease-out'}));
  }
  const collected=collectionFeedback(events);
  if(collected){
    const target=document.getElementById(collected.target);
    const targetBox=rect(collected.kind==='discard'?(target?.querySelector?.('.back, .card, .empty-stock')||target):target);
    if(!targetBox)return;
    // If a player is offscreen, land at a named viewport-edge marker instead of
    // making cards disappear beyond the screen. Never redirect to another hand.
    const height=globalThis.innerHeight||10000,width=globalThis.innerWidth||10000;
    const offscreen=targetBox.top<0||targetBox.top+targetBox.height>height;
    const destination=offscreen?{left:Math.max(8,Math.min(width-92,targetBox.left)),top:targetBox.top<0?90:height-66,width:84,height:44}:targetBox;
    let marker;
    if(offscreen){marker=document.createElement('div');marker.className='motion-destination';marker.textContent=(targetBox.top<0?'↑ ':'↓ ')+collected.label;Object.assign(marker.style,{left:destination.left+'px',top:destination.top+'px'});document.body.append(marker);}
    // Use the event's exact cards, including a defense that ended the round in
    // the same action. Snapshot geometry is retained after the table is cleared.
    collected.cards.forEach((c,i)=>{
      const previous=snapshot.table.find(entry=>entry.id===c.id||entry.node.dataset?.card===c.id);
      const origin=previous?.box||snapshot.table[0]?.box||snapshot.source;
      const node=previous?.node||card(c);
      fly(node,origin,destination,Math.min(i,3)*45);
    });
    if(marker)motionFinished().then(()=>marker.remove());
    return; // Refills must never look like pickup cards flying to other players.
  }
  if(after.stock.length<before.stock.length){
    for(const p of after.players){
      const pickup=events.filter(e=>e.type==='pickup'&&e.player===p.id).reduce((n,e)=>n+e.cards.length,0);
      const played=events.filter(e=>e.type==='play'&&e.player===p.id).length;
      const count=p.hand.length-before.players[p.id].hand.length-pickup+played;
      // At most three generic backs per recipient; never inspect a bot's cards.
      for(let i=0;i<Math.min(3,count);i++){const node=document.createElement('div');node.className='draw-back';node.textContent='◆';fly(node,snapshot.stock,rect(player(p.id)));}
    }
  }
}
