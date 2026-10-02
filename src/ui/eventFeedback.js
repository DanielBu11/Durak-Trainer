export const PLAYER_TARGETS=['hand-target','bot1','bot2'];
export const PLAYER_LABELS=['Deine Hand','Uhu','Aal'];

// Only completed public engine events count, never a pending take declaration.
export function collectionFeedback(events) {
  const event=events.find(e=>e.type==='pickup'||e.type==='discard');
  if(!event)return null;
  if(event.type==='discard')return {kind:'discard',target:'discard-target',label:'Ablage',title:'Verteidigt!',detail:'Karten gehen aus dem Spiel',cards:event.cards};
  return {kind:'pickup',target:PLAYER_TARGETS[event.player],label:PLAYER_LABELS[event.player],title:'Aufgenommen!',
    detail:`${event.player===0?'Du nimmst':PLAYER_LABELS[event.player]+' nimmt'} ${event.cards.length} ${event.cards.length===1?'Karte':'Karten'}`,cards:event.cards};
}

export function createEventFeedback(root,{set=setTimeout,clear=clearTimeout}={}) {
  let timer,cleanup,version=0;
  const cancel=()=>{version++;clear(timer);clear(cleanup);root.classList.remove('visible');root.hidden=true;};
  return {cancel,show(message){
    cancel();if(!message)return;
    const token=version;
    root.dataset.kind=message.kind;
    root.querySelector('strong').textContent=message.title;
    root.querySelector('small').textContent=message.detail;
    root.hidden=false;root.classList.add('visible');
    timer=set(()=>{if(token!==version)return;root.classList.remove('visible');cleanup=set(()=>{if(token===version)root.hidden=true;},180);},1400);
  }};
}
