import {createHistory, createBotScheduler} from './history.js';
import {captureMotion, animateMove, cancelMotion, motionFinished} from './motion.js';
import {card, suitName, stockDisplay, renderDiscardOverview} from './cards.js';
import {createGame, act, legalActions, observation} from '../game/engine.js';
import {chooseAction} from '../bots/strategy.js';
import {createTrainingUI} from './trainingUI.js';
import {setupAudio} from './audioUI.js';
import {audioEvents} from '../audio/events.js';
// Fallbacks can later be replaced by local image elements.
const botAvatars={1:'🦉',2:'🐟'};
const $=id=>document.getElementById(id);
const audio=setupAudio($('audio-settings'));
let state=createGame(), selected=null, history, moving=false, motionEpoch=0;
const botScheduler=createBotScheduler();
const revealed=new Set(), revealTimers=new Map();
function clearReveals(){revealed.clear();for(const t of revealTimers.values())clearTimeout(t);revealTimers.clear();}
function revealHand(id){clearTimeout(revealTimers.get(id));if(revealed.has(id))revealed.delete(id);else{revealed.add(id);revealTimers.set(id,setTimeout(()=>{revealed.delete(id);render();},8000));}render();}
const trainingUI=createTrainingUI({root:$('training-panel'),onChange:()=>{if(trainingUI.isPaused())clearReveals();render();}});
function snapshot(){return {game:state,training:trainingUI.snapshot(),difficulty:$('difficulty').value};}
function move(action){
  if(trainingUI.isPaused()||moving)return;
  try{
    const before=state, visual=captureMotion(state.actor), next=act(state,action);
    history.replace(snapshot());botScheduler.cancel();state=next;selected=null;moving=true;
    const token=++motionEpoch;
    for(const event of audioEvents(before,state,action))void audio.play(event);
    render();history.commit(snapshot());renderHistory();
    const events=state.events.slice(before.events.length);showMoveFeedback(before,events,action);
    try{animateMove(visual,before,state,action,events);}catch{/* Animation failure must not prevent further play. */}
    motionFinished().then(()=>{if(token!==motionEpoch)return;moving=false;render();});
  }catch(error){$('status').textContent=error.message;}
}
function navigateHistory(index){
  botScheduler.cancel();motionEpoch++;cancelMotion();moving=false;clearReveals();selected=null;
  clearTimeout(feedbackTimer);$('move-feedback').textContent='';
  history.replace(snapshot());const saved=history.go(index);state=saved.game;
  $('difficulty').value=saved.difficulty;trainingUI.restore(saved.training,observation(state,0));
  $('training').checked=saved.training.state.enabled;
  render();
}
function renderHistory(){
  $('history-back').disabled=history.index===0;$('history-forward').disabled=!history.isPast;
  $('history-start').disabled=history.index===0;$('history-latest').disabled=!history.isPast;
  $('history-position').textContent=(history.isPast?'Rückblick':'Aktuell')+' · '+history.index+' / '+(history.length-1);
  $('history-controls').classList.toggle('in-past',history.isPast);
  $('history-note').hidden=!history.isPast;
}
let feedbackTimer;
function showMoveFeedback(before,events,action){
  const pickup=events.find(e=>e.type==='pickup');
  const says=(id,verb)=>id===0?'Du '+({ 'nimmt auf':'nimmst auf','greift an':'greifst an','verteidigt':'verteidigst'}[verb]):before.players[id].name+' '+verb;
  $('move-feedback').textContent=pickup?says(pickup.player,'nimmt auf'):events.some(e=>e.type==='discard')?'Karten gehen raus':action.type==='take'?says(before.actor,'nimmt auf'):action.type==='attack'?says(before.actor,'greift an'):action.type==='defend'?says(before.actor,'verteidigt'):'';
  clearTimeout(feedbackTimer);feedbackTimer=setTimeout(()=>{$('move-feedback').textContent='';},1800);
}
function botStep(){if(!moving && !trainingUI.isPaused() && !state.finished && state.actor!==0)move(chooseAction(observation(state),$('difficulty').value));}
function schedule(){botScheduler.cancel();if(!moving && !history?.isPast && !trainingUI.isPaused() && !state.finished && state.actor!==0 && $('speed').value!=='manual')botScheduler.schedule(botStep,Number($('speed').value));}
function render(){
  const actions=legalActions(state), paused=trainingUI.isPaused(), human=state.actor===0&&!state.finished&&!paused&&!moving, training=$('training').checked;
  $('round').textContent=`Runde ${state.round}`;
  for(const id of [1,2]) {
    const p=state.players[id], root=$(`bot${id}`);root.className=`opponent ${state.actor===id&&!state.finished&&!paused?'active-player':''}`;
    root.innerHTML=`<div class="opponent-header"><span class="avatar" aria-hidden="true">${botAvatars[id]}</span><div><h2>${p.name}<span class="turn-tag">${state.actor===id&&!state.finished&&!paused?'am Zug':''}</span></h2><small>${p.out?'Fertig':`${p.hand.length} Karten · ${state.defender===id?'Verteidigung':state.attacker===id?'Angriff':'Nachwerfen'}`}</small></div></div>`;
    if(training){const eye=document.createElement('button');eye.className='eye';eye.textContent='👁';eye.disabled=paused;eye.setAttribute('aria-label',`${p.name}: Hand ${revealed.has(id)?'verbergen':'8 Sekunden aufdecken'}`);eye.setAttribute('aria-pressed',String(revealed.has(id)));eye.onclick=()=>revealHand(id);root.firstChild.insertBefore(eye,root.firstChild.children[1]);}
    const cards=document.createElement('div');cards.className=training&&revealed.has(id)?'revealed':'backs';
    if(training&&revealed.has(id))p.hand.forEach(c=>cards.append(card(c)));else for(let i=0;i<Math.min(8,p.hand.length);i++){const back=document.createElement('span');back.className='back';back.setAttribute('aria-hidden','true');cards.append(back);}root.append(cards);
  }
  $('hand').closest('.hand-section').classList.toggle('your-turn',human);
  const stock=stockDisplay(state);$('stock').classList.toggle('is-empty',!stock.count);$('stock').replaceChildren();
  if(stock.card)$('stock').append(card(stock.card));else{const empty=document.createElement('span');empty.className='empty-stock';empty.textContent='Leer';$('stock').append(empty);}
  if(stock.count>1){const back=document.createElement('span');back.className='back';back.innerHTML='<span class=stock-count>'+stock.count+'</span>';$('stock').append(back);}
  const label=document.createElement('small');label.textContent=stock.label+(stock.count===1?' · 1':'');$('stock').append(label);
  $('stock').disabled=paused;
  if($('discard-dialog').open)renderDiscardOverview($('discard-overview'),state.discarded);
  $('discard-count').textContent=state.discarded.length;$('limit').textContent=`${state.table.length} / ${state.limit}`;
  $('table').replaceChildren();if(!state.table.length)$('table').innerHTML='<div class="empty-table">Die nächste Karte eröffnet die Runde.</div>';
  state.table.forEach((pair,target)=>{const el=document.createElement('div');el.className='pair'+(pair.defense?' covered':'');const a=card(pair.attack,human&&state.phase==='defend'&&!pair.defense);if(a.tagName==='BUTTON'){a.disabled=!actions.some(x=>x.type==='defend'&&x.target===target&&(!selected||x.card===selected));a.setAttribute('aria-label',`${suitName[pair.attack.suit]} ${pair.attack.rank} decken`);a.onclick=()=>{if(selected)move({type:'defend',card:selected,target});else{$('hint').textContent='Wähle zuerst eine passende Karte aus deiner Hand.';}};}el.append(a);if(pair.defense){const d=card(pair.defense);d.classList.add('defense');el.append(d);}else if(selected)el.classList.add('target');$('table').append(el);});
  $('hand').replaceChildren();[...state.players[0].hand].sort((a,b)=>(a.suit===state.trump)-(b.suit===state.trump)||a.suit.localeCompare(b.suit)||a.value-b.value).forEach(c=>{const el=card(c,true);const options=actions.filter(a=>a.card===c.id);el.disabled=!human||!options.length;if(selected===c.id)el.classList.add('selected');el.onclick=()=>{if(options.length===1)move(options[0]);else{selected=c.id;render();}};$('hand').append(el);});
  $('hand-count').textContent=`/ ${state.players[0].hand.length} Karten`;$('your-role').textContent=state.players[0].out?'Du bist fertig ✓':state.defender===0?'VERTEIDIGUNG':state.attacker===0?'ANGRIFF':'NACHWERFEN';
  $('status').textContent=state.finished?(state.loser===null?'Unentschieden – alle Hände sind leer.':`${state.players[state.loser].name} ${state.loser===0?'bist':'ist'} Durak.`):human?(state.phase==='defend'?'Du verteidigst.':state.taking?'Du kannst noch nachwerfen.':'Du bist am Zug.'): `${state.players[state.actor].name} ${state.phase==='defend'?(state.actor===0?'verteidigst':'verteidigt'):(state.actor===0?'bist am Zug':'ist am Zug')}.`;
  $('hint').textContent=state.finished?'Eine neue Partie wartet auf dich.':state.taking?`${state.defender===0?'Du nimmst':state.players[state.defender].name+' nimmt'} auf. Passende Werte dürfen noch dazu.`:human?(state.phase==='defend'?'Klicke eine höhere Karte derselben Farbe oder einen Trumpf.':state.table.length?'Wirf einen passenden Wert nach oder beende deinen Angriff.':'Wähle eine Karte, um den Angriff zu eröffnen.'):state.players[0].out?'Du bist fertig. Die Bots spielen die Partie zu Ende.':'Beobachte die Karten und plane deinen nächsten Zug.';
  $('take').disabled=!human||!actions.some(a=>a.type==='take');$('pass').disabled=!human||!actions.some(a=>a.type==='pass');$('step').hidden=$('speed').value!=='manual'||history?.isPast;$('step').disabled=state.finished||state.actor===0||paused||moving;
  if(paused){$('status').textContent='Training · Spiel pausiert';$('hint').textContent='Prüfe deine Antwort oder überspringe den Check, um weiterzuspielen.';}
  trainingUI.update(observation(state,0));if(history)renderHistory();schedule();
}
$('stock').onclick=()=>{renderDiscardOverview($('discard-overview'),state.discarded);$('discard-dialog').showModal();};
$('close-discard').onclick=()=>$('discard-dialog').close();
$('discard-dialog').onclick=e=>{if(e.target===$('discard-dialog'))$('discard-dialog').close();};
$('take').onclick=()=>move({type:'take'});$('pass').onclick=()=>move({type:'pass'});$('step').onclick=botStep;
$('new').onclick=()=>{botScheduler.cancel();motionEpoch++;cancelMotion();moving=false;clearReveals();selected=null;state=createGame();clearTimeout(feedbackTimer);$('move-feedback').textContent='';void audio.play('shuffle');trainingUI.reset(observation(state,0));history=createHistory(snapshot());render();};
$('training').onchange=()=>{clearReveals();trainingUI.setEnabled($('training').checked);};$('speed').onchange=scheduleAndRender;function scheduleAndRender(){render();}$('difficulty').onchange=schedule;
trainingUI.update(observation(state,0));history=createHistory(snapshot());
$('history-back').onclick=()=>navigateHistory(history.index-1);$('history-forward').onclick=()=>navigateHistory(history.index+1);
$('history-start').onclick=()=>navigateHistory(0);$('history-latest').onclick=()=>navigateHistory(history.length-1);
render();
if('serviceWorker' in navigator && window.isSecureContext){navigator.serviceWorker.register('./sw.js').then(()=>navigator.serviceWorker.ready).then(()=>{$('pwa-status').textContent='Offline-Unterstützung aktiv. Nach dem ersten Laden ist die App ohne Internet nutzbar.';}).catch(()=>{$('pwa-status').textContent='Offline-Unterstützung konnte nicht aktiviert werden. Online kannst du weiterspielen.';});}else $('pwa-status').textContent='Offline-Installation benötigt HTTPS oder localhost.';
