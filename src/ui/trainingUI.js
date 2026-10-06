import {createMemoryUI} from './memoryUI.js';
import {TRAINING_CHOICES,numericLevel} from './setup.js';
import {SUITS} from '../game/cards.js';
import {hasFeature} from '../training/trainingLevels.js';
import {createTrainingState, configureTraining, observeTraining, toggleWeakness} from '../training/trainingState.js';
import {createManualCheck,emptyManualAnswer,manualAnswerComplete,evaluateManualCheck} from '../training/manualCheck.js';
import {loadStats, emptyStats, recordCheck, saveStats} from '../training/trainingStats.js';

const suitNames = {'♣':'Kreuz','♦':'Karo','♥':'Herz','♠':'Pik'};
const cardLabel = c => `${suitNames[c.suit]} ${c.rank}`;
const opponent = id => id === 1 ? 'Uhu · links' : 'Aal · rechts';
const chips = cards => cards.length ? cards.map(c => `<span class="chip ${['♥','♦'].includes(c.suit)?'red':''}">${c.rank}${c.suit}</span>`).join('') : 'Keine';

/** UI-only controller. Receives public observation, never hidden hands. */
export function createTrainingUI({root, dialog, onChange}) {
  let state = createTrainingState(), view, quiz = null, answer, result = null, canOpen=false;
  let analysisOpen = false, statsOpen = false, storage, storageAvailable = true;
  try {storage = window.localStorage;} catch {storageAvailable = false;}
  let stats = storage ? loadStats(storage) : emptyStats();
  let choice='1';
  const memory=createMemoryUI({onChange,storage});
  const paused = () => state.enabled && Boolean(quiz);
  function dismiss(){quiz=null;result=null;if(dialog.open)dialog.close();}
  const setChoice=(value,notify=true)=>{choice=TRAINING_CHOICES.some(([id])=>id===value)?value:'1';state=configureTraining(state,{level:numericLevel(choice)});dismiss();analysisOpen=false;memory.reset();if(notify)redraw();};
  function redraw(){onChange();}
  function closeCheck(){dismiss();state={...state,completedRound:null};redraw();}
  dialog.querySelector('[data-close-training]').onclick=closeCheck;
  dialog.addEventListener('cancel',event=>{event.preventDefault();closeCheck();});
  function begin(){
    if(!state.enabled||!canOpen||!view||quiz||view.phase==='finished')return;
    quiz=createManualCheck(state,view,memory.snapshot(),choice);
    answer=emptyManualAnswer();result=null;analysisOpen=false;memory.dismissNotice();
    redraw();dialog.showModal();
  }
  function submit(){
    if(!quiz||result||!manualAnswerComplete(quiz,answer))return;
    result=evaluateManualCheck(quiz,answer);
    stats=recordCheck(stats,quiz.level,result.correct);memory.record(result.opponents);
    storageAvailable=storage?saveStats(storage,stats):false;redraw();
    dialog.querySelector('[data-action="close"]')?.focus();
  }
  function quizMarkup(){
    if(!quiz)return '';
    const yes=correct=>'<span class="quiz-verdict '+(correct?'is-correct':'is-incorrect')+'"><span aria-hidden="true">'+(correct?'✓':'✕')+'</span> '+(correct?'richtig':'falsch')+'</span>';
    let body='';
    if(quiz.trumps.includeNumbers)body+='<section data-question="numbers"><h3>Wie viele Zahlentrümpfe 6–10 sind raus?</h3>'+(result?'<p>Zahlentrümpfe: '+yes(result.trumps.numberCorrect)+' · Lösung: '+quiz.trumps.solution.number+'</p>':'<div class="touch-options">'+[0,1,2,3,4,5].map(n=>'<button data-number="'+n+'" aria-pressed="'+(answer.number===n)+'">'+n+'</button>').join('')+'</div>')+'</section>';
    body+='<section data-question="faces"><h3>Welche hohen Trümpfe sind raus?</h3>'+(result?'<p>'+Object.entries(result.faces).map(([rank,correct])=>rank+': '+yes(correct)).join(' · ')+'</p><p>Raus: '+(quiz.trumps.solution.faces.join(', ')||'keiner')+'</p>':'<div class="touch-options">'+['J','Q','K','A'].map(r=>'<button data-face="'+r+'" aria-pressed="'+answer.faces.includes(r)+'">'+r+' '+view.trump+'</button>').join('')+'</div><small>Mehrfachauswahl · keine Auswahl bedeutet: keiner.</small>')+'</section>';
    for(const q of quiz.opponents){
      const name=q.player===1?'Uhu':'Aal',feedback=result?.opponents.find(r=>r.player===q.player);
      body+='<section data-question="player-'+q.player+'"><h3>'+name+' · '+(q.required===2?'Welche 2 Karten merkst du dir?':'Welche Karte merkst du dir?')+'</h3>';
      if(!q.required)body+='<p>Noch keine Merkkarte vorhanden.</p>';
      else if(result)body+='<p>'+name+': '+yes(feedback.correct)+' · '+(feedback.correct?'Gemerkte Karten: ':'Korrekt: ')+feedback.cards.map(cardLabel).join(', ')+'</p>';
      else body+='<p>Wähle '+q.required+' Karte'+(q.required===1?'':'n')+'.</p><div class="touch-options">'+q.options.map(c=>'<button data-player="'+q.player+'" data-card="'+c.id+'" aria-pressed="'+answer.opponents[q.player].includes(c.id)+'">'+c.suit+c.rank+'</button>').join('')+'</div>';
      body+='</section>';
    }
    return '<p class="note">Level '+quiz.choice.toUpperCase()+' · Spiel pausiert. Nur abgelegte Karten zählen als raus.</p>'+body+'<div class="quiz-actions">'+(result?'<p role="status">'+(result.correct?'Alles richtig ✓':'Ergebnisse oben ansehen')+'</p><button data-action="close">Weiter</button>':'<button data-action="submit" '+(manualAnswerComplete(quiz,answer)?'':'disabled')+'>Prüfen</button>')+'</div>';
  }
  function weaknessMarkup() {
    if (!hasFeature(state.level,'weakness')) return '';
    return `<section class="weakness-section"><h3>Vermutete Farb-Schwäche</h3><p class="note">„Vermutlich schwach oder leer“ ist kein Kartenbeweis: Ein Gegner kann freiwillig Trumpf spielen oder aufnehmen. Diese Markierungen werden nicht als richtig/falsch bewertet.</p><div class="training-opponents">${[1,2].map(id=>`<article><h4>${opponent(id)}</h4><div class="touch-options">${SUITS.map(s=>`<button data-weak-player="${id}" data-weak-suit="${s}" aria-pressed="${Boolean(state.weaknesses[id]?.[s])}">${s} ${suitNames[s]}${state.weaknesses[id]?.[s]?' · vermutet':''}</button>`).join('')}</div></article>`).join('')}</div></section>`;
  }
  function render() {
    root.hidden = !state.enabled;
    if (!state.enabled || !view) {root.replaceChildren(); return;}
    root.innerHTML = memory.markup()+weaknessMarkup();
    dialog.querySelector('[data-training-content]').innerHTML=quizMarkup();
    root.querySelectorAll('[data-panel]').forEach(el=>el.ontoggle=()=>{if(el.dataset.panel==='analysis')analysisOpen=el.open;else statsOpen=el.open;});
    [...root.querySelectorAll('button'),...dialog.querySelectorAll('[data-training-content] button')].forEach(button=>button.onclick=()=>{
      const d=button.dataset;
      if(d.action==='close')closeCheck();
      if(d.action==='submit')submit();
      if(d.number!==undefined){answer.number=Number(d.number);render();}
      if(d.face){answer.faces=answer.faces.includes(d.face)?answer.faces.filter(r=>r!==d.face):[...answer.faces,d.face];render();}
      if(d.card&&!result){const values=answer.opponents[d.player],q=quiz.opponents.find(q=>q.player===Number(d.player));answer.opponents[d.player]=values.includes(d.card)?values.filter(id=>id!==d.card):values.length<q.required?[...values,d.card]:values;render();}
      if(d.weakPlayer){state=toggleWeakness(state,Number(d.weakPlayer),d.weakSuit);redraw();}

    });

  }
  return {
    // Restore without replaying events or scoring a question a second time.
    snapshot(){return structuredClone({state,quiz,answer,result,analysisOpen,statsOpen,stats,choice,memory:memory.snapshot()});},
    restore(saved,publicView){({state,quiz,answer,result,analysisOpen,statsOpen,stats}=structuredClone(saved));dismiss();choice=saved.choice??String(state.level);memory.restore(saved.memory);view=publicView;if(storage)saveStats(storage,stats);render();},
    getLevel:()=>state.level,
    getChoice:()=>choice,
    setChoice,
    blockedPlayer:()=>null,
    begin,
    close:closeCheck,
    cancelMemory:()=>{dismiss();memory.reset();},
    suspendMemory:()=>memory.suspend(),
    getWeaknesses:()=>structuredClone(state.weaknesses),
    isPaused: paused,
    update(publicView,{ready=true}={}) {canOpen=ready;view=publicView;state=observeTraining(state,view);memory.update(view,{enabled:state.enabled&&hasFeature(state.level,'memory'),mode:choice==='3b'?'3b':'3a',ready:ready&&!quiz});render();},
    setEnabled(enabled) {dismiss();memory.reset();state={...configureTraining(state,{enabled}),completedRound:null};quiz=null;result=null;analysisOpen=false;redraw();},
    reset(publicView) {dismiss();memory.reset();state={...createTrainingState(),enabled:state.enabled,level:state.level};quiz=null;answer=null;result=null;analysisOpen=false;view=publicView;render();},
  };
}
