import {createSession,loadPreferences,savePreferences,TRAINING_CHOICES} from './setup.js';
import {recommendMove} from '../coach/coach.js';
import {renderCoachUI} from './coachUI.js';
import {knownHandView} from '../knowledge/trainingKnowledge.js';
import {collectionFeedback, createEventFeedback} from './eventFeedback.js';
import {startFreshRound, roundResult, createResultGate, canInspectStock} from './roundLifecycle.js';
import {createBotScheduler} from './history.js';
import {captureMotion, animateMove, cancelMotion, motionFinished, pulseStock} from './motion.js';
import {card, suitName, stockDisplay, renderDiscardOverview} from './cards.js';
import {act, legalActions, observation} from '../game/engine.js';
import {chooseAction} from '../bots/strategy.js';
import {createTrainingUI} from './trainingUI.js';
import {setupAudio} from './audioUI.js';
import {audioEvents} from '../audio/events.js';
// Fallbacks can later be replaced by local image elements.
const botAvatars={1:'🦉',2:'🐟'};
const $=id=>document.getElementById(id);
const audio=setupAudio($('audio-settings'));
const eventFeedback=createEventFeedback($('event-feedback'));
let state=null, selected=null, history=null, moving=false, motionEpoch=0;
let preferencesStorage;try{preferencesStorage=window.localStorage;}catch{}
const preferences=loadPreferences(preferencesStorage);
const session=createSession(startFreshRound);
function persist(){savePreferences(preferencesStorage,{difficulty:$('difficulty').value,speed:$('speed').value,training:$('training').checked,level:trainingUI.getChoice()});}
const botScheduler=createBotScheduler();
const resultGate=createResultGate();
let coachAdvice=null,coachStamp=null;
const revealed=new Set(), revealTimers=new Map();
function clearReveals(){revealed.clear();for(const t of revealTimers.values())clearTimeout(t);revealTimers.clear();}
function revealHand(id){clearTimeout(revealTimers.get(id));if(revealed.has(id))revealed.delete(id);else{revealed.add(id);revealTimers.set(id,setTimeout(()=>{revealed.delete(id);render();},8000));}render();}
const trainingUI=createTrainingUI({root:$('training-panel'),dialog:$('training-dialog'),onChange:()=>{if(trainingUI.isPaused())clearReveals();persist();render();}});
const gamePaused=()=>trainingUI.isPaused()||$('discard-dialog').open;
function snapshot(){return {game:state,training:trainingUI.snapshot(),difficulty:$('difficulty').value};}
function move(action){
  if(!state||gamePaused()||moving)return;
  try{
    const before=state, visual=captureMotion(state.actor), next=act(state,action);
    if(history.isPast)resultGate.reset();
    history.replace(snapshot());botScheduler.cancel();state=next;selected=null;moving=true;
    const token=++motionEpoch;
    const events=state.events.slice(before.events.length),collection=collectionFeedback(events);
    const sounds=audioEvents(before,state,action);
    for(const event of sounds)if(event!=='cardDraw'||!collection)void audio.play(event);
    render();history.commit(snapshot());renderHistory();
    showMoveFeedback(before,events,action);eventFeedback.show(collection);
    try{animateMove(visual,before,state,action,events);}catch{/* Animation failure must not prevent further play. */}
    motionFinished().then(()=>{if(token!==motionEpoch)return;
      if(collection&&sounds.includes('cardDraw')){void audio.play('cardDraw');$('move-feedback').textContent='Nachgezogen · Hände aufgefüllt';pulseStock();}
      moving=false;render();});
  }catch(error){$('status').textContent=error.message;}
}
function navigateHistory(index){
  if(!state||!history)return;trainingUI.suspendMemory();if($('coach-dialog').open)$('coach-dialog').close();
  botScheduler.cancel();motionEpoch++;cancelMotion();eventFeedback.cancel();moving=false;clearReveals();selected=null;
  clearTimeout(feedbackTimer);$('move-feedback').textContent='';
  history.replace(snapshot());const saved=history.go(index);state=saved.game;
  $('difficulty').value=saved.difficulty;trainingUI.restore(saved.training,observation(state,0));
  $('training').checked=saved.training.state.enabled;
  render();
}
function renderHistory(){
  const training=$('training').checked;
  $('history-controls').hidden=!training;
  $('history-back').disabled=history.index===0;$('history-forward').disabled=!history.isPast;
  $('history-start').disabled=history.index===0;$('history-latest').disabled=!history.isPast;
  $('history-position').textContent=(history.isPast?'Rückblick':'Aktuell')+' · '+history.index+' / '+(history.length-1);
  $('history-controls').classList.toggle('in-past',history.isPast);
  $('history-note').hidden=!training||!history.isPast;
}
let feedbackTimer;
function showMoveFeedback(before,events,action){
  const pickup=events.find(e=>e.type==='pickup');
  const says=(id,verb)=>id===0?'Du '+({ 'nimmt auf':'nimmst auf','greift an':'greifst an','verteidigt':'verteidigst'}[verb]):before.players[id].name+' '+verb;
  $('move-feedback').textContent=pickup||events.some(e=>e.type==='discard')?'':action.type==='take'?says(before.actor,'nimmt auf'):action.type==='attack'?says(before.actor,'greift an'):action.type==='defend'?says(before.actor,'verteidigt'):'';
  clearTimeout(feedbackTimer);feedbackTimer=setTimeout(()=>{$('move-feedback').textContent='';},1800);
}
function botStep(){if(state && !moving && !gamePaused() && !state.finished && state.actor!==0)move(chooseAction(observation(state),$('difficulty').value));}
function schedule(){botScheduler.cancel();if(state && !moving && !history?.isPast && !gamePaused() && !state.finished && state.actor!==0 && $('speed').value!=='manual')botScheduler.schedule(botStep,Number($('speed').value));}
// Move the existing controls, preserving their values and event handlers.
const mobileLayout=window.matchMedia('(max-width:650px)');
function placeSettings(){
  const compact=Boolean(state)&&mobileLayout.matches;
  document.body.classList.toggle('mobile-game',compact);
  $('settings-trigger').hidden=!compact;
  const controls=$('game-settings');
  if(compact){if(controls.parentElement!==$('settings-content'))$('settings-content').append(controls);}
  else {if($('settings-dialog').open)$('settings-dialog').close();$('settings-home').after(controls);}
}
mobileLayout.addEventListener('change',placeSettings);
$('settings-trigger').onclick=()=>$('settings-dialog').showModal();
$('close-settings').onclick=()=>$('settings-dialog').close();
function render(){
  placeSettings();
  $('setup-view').hidden=Boolean(state);$('game-view').hidden=!state;$('new').hidden=!state;
  $('setup-level').value=trainingUI.getChoice();$('setup-level').disabled=!$('training').checked;
  $('play-tools').hidden=!state||!$('training').checked;
  if(!state){botScheduler.cancel();return;}
  trainingUI.update(observation(state,0),{ready:!moving&&!history?.isPast});
  const blocked=trainingUI.blockedPlayer();if(blocked)revealed.delete(blocked);
  const actions=legalActions(state), paused=gamePaused(), human=state.actor===0&&!state.finished&&!paused&&!moving, training=$('training').checked;
  const publicState=observation(state,0),level=trainingUI.getLevel();
  $('quiz-trigger').disabled=moving||paused||Boolean(history?.isPast)||state.finished;
  $('coach-trigger').disabled=!human||paused;
  if(!training&&$('coach-dialog').open)$('coach-dialog').close();
  $('round').textContent=`Runde ${state.round}`;
  for(const id of [1,2]) {
    const p={...publicState.players[id],name:state.players[id].name}, root=$(`bot${id}`);root.className=`opponent ${state.actor===id&&!state.finished&&!paused?'active-player':''}`;
    root.innerHTML=`<div class="opponent-header"><span class="avatar" aria-hidden="true">${botAvatars[id]}</span><div><h2>${p.name}<span class="turn-tag">${state.actor===id&&!state.finished&&!paused?'am Zug':''}</span></h2><small>${p.out?'Fertig':`${p.count} Karten · ${state.defender===id?'Verteidigung':state.attacker===id?'Angriff':'Nachwerfen'}`}</small></div></div>`;
    if(training&&level>=3){const eye=document.createElement('button');eye.className='eye';eye.textContent='👁';eye.disabled=paused&&(!blocked||blocked===id);eye.setAttribute('aria-label',`${p.name}: bekannte Karten ${revealed.has(id)?'verbergen':'8 Sekunden anzeigen'}`);eye.setAttribute('aria-pressed',String(revealed.has(id)));eye.onclick=()=>revealHand(id);root.firstChild.insertBefore(eye,root.firstChild.children[1]);}
    const cards=document.createElement('div');cards.className=training&&level>=3&&revealed.has(id)?'revealed':'backs';
    if(training&&level>=3&&revealed.has(id)){const known=knownHandView(publicState,id,{enabled:training,level});const label=document.createElement('small');label.className='known-hand-label';label.textContent='Bekannt';cards.append(label);known.cards.forEach(c=>cards.append(card(c)));const unknown=document.createElement('small');unknown.className='known-hand-label';unknown.textContent='Unbekannt: '+known.unknown;cards.append(unknown);}else for(let i=0;i<Math.min(8,p.count);i++){const back=document.createElement('span');back.className='back';back.setAttribute('aria-hidden','true');cards.append(back);}root.append(cards);
  }
  $('hand').closest('.hand-section').classList.toggle('your-turn',human);
  const stock=stockDisplay(state);$('stock').classList.toggle('is-empty',!stock.count);$('stock').replaceChildren();
  if(stock.card)$('stock').append(card(stock.card));else{const empty=document.createElement('span');empty.className='empty-stock';empty.textContent='Leer';$('stock').append(empty);}
  if(stock.count>1){const back=document.createElement('span');back.className='back';back.innerHTML='<span class=stock-count>'+stock.count+'</span>';$('stock').append(back);}
  const label=document.createElement('small');label.textContent=stock.label+(stock.count===1?' · 1':'');$('stock').append(label);
  $('stock').disabled=!canInspectStock(training,paused);
  $('stock').setAttribute('aria-label',training?'Welche Karten sind aus dem Spiel?':'Nachziehstapel · Trumpf '+state.trump);
  if(!training&&$('discard-dialog').open)$('discard-dialog').close();
  if($('discard-dialog').open)renderDiscardOverview($('discard-overview'),state.discarded);
  $('limit').textContent=`${state.table.length} / ${state.limit}`;
  $('table').replaceChildren();if(!state.table.length)$('table').innerHTML='<div class="empty-table">Die nächste Karte eröffnet die Runde.</div>';
  state.table.forEach((pair,target)=>{const el=document.createElement('div');el.className='pair'+(pair.defense?' covered':'');const a=card(pair.attack,human&&state.phase==='defend'&&!pair.defense);if(a.tagName==='BUTTON'){a.disabled=!actions.some(x=>x.type==='defend'&&x.target===target&&(!selected||x.card===selected));a.setAttribute('aria-label',`${suitName[pair.attack.suit]} ${pair.attack.rank} decken`);a.onclick=()=>{if(selected)move({type:'defend',card:selected,target});else{$('hint').textContent='Wähle zuerst eine passende Karte aus deiner Hand.';}};}el.append(a);if(pair.defense){const d=card(pair.defense);d.classList.add('defense');el.append(d);}else if(selected)el.classList.add('target');$('table').append(el);});
  $('hand').replaceChildren();[...state.players[0].hand].sort((a,b)=>(a.suit===state.trump)-(b.suit===state.trump)||a.suit.localeCompare(b.suit)||a.value-b.value).forEach(c=>{const el=card(c,true);const options=actions.filter(a=>a.card===c.id);el.disabled=!human||!options.length;if(selected===c.id)el.classList.add('selected');el.onclick=()=>{if(options.length===1)move(options[0]);else{selected=c.id;render();}};$('hand').append(el);});
  $('hand-count').textContent=`/ ${state.players[0].hand.length} Karten`;$('your-role').textContent=state.players[0].out?'Du bist fertig ✓':state.defender===0?'VERTEIDIGUNG':state.attacker===0?'ANGRIFF':'NACHWERFEN';
  $('status').textContent=state.finished?(state.loser===null?'Unentschieden – alle Hände sind leer.':`${state.players[state.loser].name} ${state.loser===0?'bist':'ist'} Durak.`):human?(state.phase==='defend'?'Du verteidigst.':state.taking?'Du kannst noch nachwerfen.':'Du bist am Zug.'): `${state.players[state.actor].name} ${state.phase==='defend'?(state.actor===0?'verteidigst':'verteidigt'):(state.actor===0?'bist am Zug':'ist am Zug')}.`;
  $('hint').textContent=state.finished?'Eine neue Partie wartet auf dich.':state.taking?`${state.defender===0?'Du nimmst':state.players[state.defender].name+' nimmt'} auf. Passende Werte dürfen noch dazu.`:human?(state.phase==='defend'?'Klicke eine höhere Karte derselben Farbe oder einen Trumpf.':state.table.length?'Wirf einen passenden Wert nach oder beende deinen Angriff.':'Wähle eine Karte, um den Angriff zu eröffnen.'):state.players[0].out?'Du bist fertig. Die Bots spielen die Partie zu Ende.':'Beobachte die Karten und plane deinen nächsten Zug.';
  $('take').disabled=!human||!actions.some(a=>a.type==='take');$('pass').disabled=!human||!actions.some(a=>a.type==='pass');$('step').hidden=$('speed').value!=='manual'||history?.isPast;$('step').disabled=state.finished||state.actor===0||paused||moving;
  if(paused){$('status').textContent='Training · Spiel pausiert';$('hint').textContent=$('discard-dialog').open?'Schließe die Kartenübersicht, um weiterzuspielen.':'Prüfe deine Antwort oder überspringe den Check, um weiterzuspielen.';}
  const stamp=JSON.stringify([state.events.length,state.actor,state.phase,history?.index,history?.length,level,training,level>=4?trainingUI.getWeaknesses():null]);
  if(coachStamp!==stamp){coachAdvice=null;coachStamp=stamp;}
  renderCoachUI($('coach-panel'),{enabled:training,level,advice:coachAdvice});
  if(history)renderHistory();schedule();showResult();
}
$('quiz-trigger').onclick=()=>{if(!state||moving)return;clearReveals();if($('coach-dialog').open)$('coach-dialog').close();trainingUI.begin();};
$('coach-trigger').onclick=()=>{
  if(!state||moving||trainingUI.isPaused()||!$('training').checked||state.actor!==0||state.finished)return;
  const level=trainingUI.getLevel();coachAdvice=recommendMove(observation(state,0),{enabled:true,level,manualWeaknesses:level>=4?trainingUI.getWeaknesses():undefined});
  render();$('coach-dialog').showModal();
};
$('close-coach').onclick=()=>$('coach-dialog').close();
$('stock').onclick=()=>{if(!state)return;if(!canInspectStock($('training').checked,trainingUI.isPaused()))return;renderDiscardOverview($('discard-overview'),state.discarded);$('discard-dialog').showModal();botScheduler.cancel();render();};
$('discard-dialog').addEventListener('close',()=>render());
$('close-discard').onclick=()=>$('discard-dialog').close();
$('discard-dialog').onclick=e=>{if(e.target===$('discard-dialog'))$('discard-dialog').close();};
$('take').onclick=()=>move({type:'take'});$('pass').onclick=()=>move({type:'pass'});$('step').onclick=botStep;
function cancelRoundWork(){
  trainingUI.cancelMemory();if($('coach-dialog').open)$('coach-dialog').close();
  coachAdvice=null;coachStamp=null;
  botScheduler.cancel();motionEpoch++;moving=false;
  cancelMotion();eventFeedback.cancel();clearReveals();selected=null;
  clearTimeout(feedbackTimer);$('move-feedback').textContent='';
}
function newRound(){
  if(state)return;persist();
  const fresh=session.start({cancelPending:cancelRoundWork,
    closeOverlays:()=>{for(const id of ['result-dialog','discard-dialog'])if($(id).open)$(id).close();},
    training:trainingUI,difficulty:$('difficulty').value});
  state=fresh.game;history=fresh.history;resultGate.reset();
  void audio.play('shuffle');render();
}
function showResult(){
  if(!resultGate.take(state,{moving,past:history?.isPast}))return;
  const result=roundResult(state);
  $('result-winners').textContent=result.draw?'Unentschieden – alle Hände sind leer.':'Gewinner: '+result.winners.join(' & ');
  $('result-loser').textContent=result.draw?'Kein Durak.':'Durak: '+result.loser;
  $('result-others').textContent=result.others.length?'Ebenfalls kartenfrei: '+result.others.join(' & '):'';
  $('result-review').hidden=!$('training').checked;
  if($('discard-dialog').open)$('discard-dialog').close();
  $('result-dialog').showModal();
}
function returnToSetup(){
  cancelRoundWork();session.setup();state=null;history=null;resultGate.reset();
  for(const id of ['result-dialog','discard-dialog'])if($(id).open)$(id).close();
  persist();render();$('start-round').focus();
}
$('new').onclick=returnToSetup;$('result-new').onclick=returnToSetup;$('start-round').onclick=newRound;
$('result-review').onclick=()=>{if(!$('training').checked)return;$('result-dialog').close();$('history-back').focus();};
$('result-dialog').addEventListener('cancel',event=>event.preventDefault());
$('training').onchange=()=>{clearReveals();trainingUI.setEnabled($('training').checked);};$('speed').onchange=scheduleAndRender;function scheduleAndRender(){persist();render();}$('difficulty').onchange=()=>{persist();schedule();};
$('difficulty').value=preferences.difficulty;$('speed').value=preferences.speed;$('training').checked=preferences.training;
$('setup-level').innerHTML=TRAINING_CHOICES.map(([id,title])=>'<option value="'+id+'" title="'+title+'">'+id.toUpperCase()+'</option>').join('');
trainingUI.setChoice(preferences.level,false);trainingUI.setEnabled(preferences.training);
$('setup-level').onchange=()=>trainingUI.setChoice($('setup-level').value);
$('history-back').onclick=()=>navigateHistory(history.index-1);$('history-forward').onclick=()=>navigateHistory(history.index+1);
$('history-start').onclick=()=>navigateHistory(0);$('history-latest').onclick=()=>navigateHistory(history.length-1);
render();
if('serviceWorker' in navigator && window.isSecureContext){navigator.serviceWorker.register('./sw.js').then(()=>navigator.serviceWorker.ready).then(()=>{$('pwa-status').textContent='Offline-Unterstützung aktiv. Nach dem ersten Laden ist die App ohne Internet nutzbar.';}).catch(()=>{$('pwa-status').textContent='Offline-Unterstützung konnte nicht aktiviert werden. Online kannst du weiterspielen.';});}else $('pwa-status').textContent='Offline-Installation benötigt HTTPS oder localhost.';
