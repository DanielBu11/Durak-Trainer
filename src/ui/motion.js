// Presentation only: DOM snapshots plus already-public transition events.
// No timers advance the game, and animations never trigger audio or actions.
const rect = el => el?.getBoundingClientRect();
const player = id => document.getElementById(id === 0 ? 'hand' : `bot${id}`);
export function captureMotion(actor) {
  return {source:rect(player(actor)), stock:rect(document.querySelector('#stock .card')||document.getElementById('stock')),
    hand:[...document.querySelectorAll('#hand .card')].map(el=>({id:el.dataset.card,box:rect(el)})),
    table:[...document.querySelectorAll('#table .card')].map(el=>({node:el.cloneNode(true),box:rect(el)}))};
}
function fly(node, from, to) {
  if(!from || !to || !node.animate || matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  node.removeAttribute('id');node.removeAttribute('aria-label');node.setAttribute('aria-hidden','true');node.tabIndex=-1;
  node.className='card motion-card'+(node.classList.contains('draw-back')?' draw-back':'')+(node.classList.contains('red')?' red':'');
  Object.assign(node.style,{left:`${from.left}px`,top:`${from.top}px`,width:`${from.width}px`,height:`${from.height}px`});
  document.body.append(node);
  const animation=node.animate([
    {transform:'translate(0,0) scale(1)',opacity:.9},
    {transform:`translate(${to.left-from.left}px,${to.top-from.top}px) scale(${Math.min(1,to.width/from.width)})`,opacity:0}
  ],{duration:220,easing:'cubic-bezier(.2,.7,.3,1)'});
  animation.finished.then(()=>node.remove(),()=>node.remove());
}
export function animateMove(snapshot, before, after, action, events) {
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const laid=[...document.querySelectorAll('#table .card')].find(el=>el.dataset.card===action.card);
  if(laid){
    const destination=rect(laid), origin=before.actor===0?snapshot.hand.find(c=>c.id===action.card)?.box:snapshot.source;
    // Animate the actual final card: its rank stays readable throughout landing.
    if(origin)laid.animate([{transform:`translate(${origin.left-destination.left}px,${origin.top-destination.top}px)`,opacity:.4},{transform:'translate(0,0)',opacity:1}],{duration:220,easing:'ease-out'});
  }
  const collected=events.find(e=>e.type==='pickup'||e.type==='discard');
  if(collected){
    const destination=rect(collected.type==='pickup'?player(collected.player):document.getElementById('discard-count'));
    snapshot.table.forEach(c=>fly(c.node,c.box,destination));
    // A final defense may also finish the round in the same engine action.
    if(action.card&&!laid){const played=events.find(e=>e.type==='play');if(played){const node=document.createElement('div');node.textContent=played.card.rank+played.card.suit;fly(node,snapshot.source,destination);}}
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
