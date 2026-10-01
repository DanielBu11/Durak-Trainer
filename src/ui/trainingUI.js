import {SUITS, RANKS} from '../game/cards.js';
import {LEVELS, levelDefinition, hasFeature} from '../training/trainingLevels.js';
import {createTrainingState, configureTraining, observeTraining, rememberCard, forgetCard, toggleWeakness} from '../training/trainingState.js';
import {selectTrainingFacts, memoryCandidates} from '../training/trainingSelectors.js';
import {createCheck, evaluateCheck} from '../training/trainingEvaluation.js';
import {loadStats, emptyStats, recordCheck, saveStats, accuracy} from '../training/trainingStats.js';

const suitNames = {'♣':'Kreuz','♦':'Karo','♥':'Herz','♠':'Pik'};
const cardLabel = c => `${suitNames[c.suit]} ${c.rank}`;
const opponent = id => id === 1 ? 'Bot 1 · links' : 'Bot 2 · rechts';
const chips = cards => cards.length ? cards.map(c => `<span class="chip ${['♥','♦'].includes(c.suit)?'red':''}">${c.rank}${c.suit}</span>`).join('') : 'Keine';

/** UI-only controller. Receives public observation; hidden hand reveal is an
 * isolated rendering callback owned by app.js, never a training/bot input. */
export function createTrainingUI({root, onChange, onReveal}) {
  let state = createTrainingState(), view, quiz = null, answer, result = null, picking = null;
  let analysisOpen = false, statsOpen = false, storage, storageAvailable = true;
  try {storage = window.localStorage;} catch {storageAvailable = false;}
  let stats = storage ? loadStats(storage) : emptyStats();
  const paused = () => state.enabled && Boolean(quiz || picking !== null);
  function redraw() {onChange();}
  function closeCheck() {quiz = null; result = null; picking = null; state = {...state, completedRound:null}; redraw();}
  function begin(kind = 'trumps', player = null) {
    quiz = createCheck(state, view, kind, player);
    if (!quiz) return;
    picking = null; answer = {faces:[], number:null, suit:null, rank:null}; result = null; analysisOpen = false;
    redraw(); root.querySelector('.quiz-box')?.focus();
  }
  function submit() {
    if (!quiz || result) return; // Count each question at most once.
    result = evaluateCheck(quiz, {...answer, card:answer.suit && answer.rank ? `${answer.suit}${answer.rank}` : null});
    stats = recordCheck(stats, quiz.level, result.correct);
    storageAvailable = storage ? saveStats(storage, stats) : false;
    redraw(); root.querySelector('[role="status"]')?.focus();
  }
  function quizMarkup() {
    if (!quiz) return '';
    const memory = quiz.kind === 'memory';
    let body = '';
    if (result) {
      const solution = result.solution;
      const text = memory ? cardLabel(solution.card) : `${quiz.includeNumbers ? `${solution.number} Zahlentrümpfe (6–10) · ` : ''}${solution.faces.length ? solution.faces.join(', ') : 'Keine hohen Trümpfe'} sicher raus`;
      body = `<div class="check-result ${result.correct?'correct':'incorrect'}" role="status" tabindex="-1"><strong>${result.correct?'Richtig ✓':'Noch nicht richtig'}</strong><p>Lösung: ${text}</p></div><button data-action="close">Weiterspielen →</button>`;
    } else {
      if (memory) body = `<p>Welche Karte hast du dir bei ${opponent(quiz.player)} gemerkt?</p><div class="touch-options" role="group" aria-label="Farbe wählen">${SUITS.map(s=>`<button data-suit="${s}" aria-pressed="${answer.suit===s}">${s} ${suitNames[s]}</button>`).join('')}</div><div class="touch-options" role="group" aria-label="Rang wählen">${RANKS.map(r=>`<button data-rank="${r}" aria-pressed="${answer.rank===r}">${r}</button>`).join('')}</div>`;
      else {
        if (quiz.includeNumbers) body += `<p>Wie viele Zahlentrümpfe <strong>6–10</strong> sind sicher raus?</p><div class="touch-options" role="group" aria-label="Zahlentrümpfe raus">${[0,1,2,3,4,5].map(n=>`<button data-number="${n}" aria-pressed="${answer.number===n}">${n}</button>`).join('')}</div>`;
        body += `<p>Welche hohen Trümpfe sind sicher raus? <small>Keine Auswahl bedeutet: keiner.</small></p><div class="touch-options" role="group" aria-label="Hohe Trümpfe raus">${['J','Q','K','A'].map(r=>`<button data-face="${r}" aria-pressed="${answer.faces.includes(r)}">${r} ${view.trump}</button>`).join('')}</div>`;
      }
      const incomplete = memory ? !answer.suit || !answer.rank : quiz.includeNumbers && answer.number === null;
      body += `<div class="training-actions"><button data-action="submit" ${incomplete?'disabled':''}>Prüfen</button><button class="quiet" data-action="close">Überspringen</button></div>`;
    }
    return `<section class="quiz-box" tabindex="-1" aria-label="Trainingscheck"><h3>Level ${quiz.level} · ${memory?'Gemerkte Karte':'Trumpf-Check'}</h3><p class="note">Spiel pausiert. ${memory?'':'Nur abgelegte Karten zählen als raus. Aufgenommene Karten bleiben im Spiel.'}</p>${body}</section>`;
  }
  function memoryMarkup() {
    if (!hasFeature(state.level,'memory')) return '';
    return `<section class="memory-section"><h3>Sicher bekannte Karte · eine pro Gegner</h3><p class="note">Wähle aus sichtbar aufgenommenen Karten. Die gemerkte Karte bleibt verborgen, bis du sie abfragst oder kontrollierst. Beim Ausspielen wird sie automatisch vergessen.</p><div class="training-opponents">${[1,2].map(id=>{
      const candidates=memoryCandidates(view,id), saved=state.remembered[id];
      return `<article><h4>${opponent(id)}</h4><p>${saved?'Eine Karte sicher gemerkt ✓':'Noch keine Karte gemerkt.'}</p><div class="training-actions"><button data-pick="${id}" ${!candidates.length||quiz?'disabled':''}>${saved?'Karte wechseln':'Karte merken'}</button><button data-recall="${id}" ${!saved||quiz||picking!==null?'disabled':''}>Karte abfragen</button>${saved?`<button class="quiet" data-forget="${id}" ${quiz?'disabled':''}>Vergessen</button>`:''}</div>${!candidates.length?'<p class="note">Noch keine sichtbar aufgenommene Karte auf dieser Hand.</p>':''}</article>`;
    }).join('')}</div></section>`;
  }
  function pickerMarkup() {
    if (picking === null) return '';
    const cards=memoryCandidates(view,picking);
    return `<section class="quiz-box" tabindex="-1" aria-label="Karte merken"><h3>${opponent(picking)} · eine Karte auswählen</h3><p>Spiel pausiert. Empfehlung: zuerst Trumpf, dann A, K, Q, J, übrige Karten. Deine Wahl ersetzt die bisher gemerkte Karte.</p><div class="touch-options">${cards.map((c,i)=>`<button data-remember="${c.id}">${cardLabel(c)}${i===0?' · empfohlen':''}</button>`).join('')}</div><button class="quiet" data-action="close">Abbrechen / weiterspielen</button></section>`;
  }
  function weaknessMarkup() {
    if (!hasFeature(state.level,'weakness')) return '';
    return `<section class="weakness-section"><h3>Vermutete Farb-Schwäche</h3><p class="note">„Vermutlich schwach oder leer“ ist kein sicherer Kartenbeweis: Ein Gegner kann freiwillig Trumpf spielen oder aufnehmen. Diese Markierungen werden nicht als richtig/falsch bewertet.</p><div class="training-opponents">${[1,2].map(id=>`<article><h4>${opponent(id)}</h4><div class="touch-options">${SUITS.map(s=>`<button data-weak-player="${id}" data-weak-suit="${s}" aria-pressed="${Boolean(state.weaknesses[id]?.[s])}">${s} ${suitNames[s]}${state.weaknesses[id]?.[s]?' · vermutet':''}</button>`).join('')}</div></article>`).join('')}</div></section>`;
  }
  function analysisMarkup() {
    if (quiz || picking !== null) return '';
    const a=selectTrainingFacts(view);
    return `<details class="training-details" data-panel="analysis" ${analysisOpen?'open':''}><summary>Analyse / Kontrolle</summary><p class="note">Bewusst nachsehen: Diese Anzeige beeinflusst die Bots nicht. Bot-Hände werden am Spieltisch für 8 Sekunden aufgedeckt.</p><div class="training-actions">${[1,2].map(id=>`<button data-reveal="${id}">Gegnerhand aufdecken · ${id===1?'links':'rechts'}</button>`).join('')}</div><div class="analysis-grid"><article><h3>Sicher aus dem Spiel · ${a.discarded.length}</h3>${chips(a.discarded)}</article><article><h3>Trümpfe noch im Spiel · ${a.trumpsRemaining.length}</h3>${chips(a.trumpsRemaining)}<p>In Händen, auf dem Tisch oder im Stapel.</p><p>${a.memory.numberTrumpsOut} Zahlentrümpfe raus · ${Object.entries(a.memory.facesOut).map(([rank,out])=>`${rank}: ${out?'raus':'nicht sicher raus'}`).join(' · ')}</p></article><article><h3>Sichtbar aufgenommene Karten</h3>${[1,2].map(id=>`<h4>${opponent(id)}</h4><p>Noch sicher auf der Hand:</p>${chips(a.knownHeld[id])}${hasFeature(state.level,'memory')&&state.remembered[id]?`<p>Deine gemerkte Karte: ${chips([state.remembered[id].card])}</p>`:''}`).join('')}</article></div><details><summary>Vollständiger Aufnahmeverlauf</summary>${a.pickups.map(e=>`<p>Runde ${e.round} · ${e.player===0?'Du':opponent(e.player)}: ${chips(e.cards)}</p>`).join('')||'<p>Noch keine Aufnahme.</p>'}</details></details>`;
  }
  function statsMarkup() {
    return `<details class="training-details" data-panel="stats" ${statsOpen?'open':''}><summary>Trainingsstatistik · ${stats.correct} / ${stats.checks} richtig</summary><p>Trefferquote ${accuracy(stats)} · Aktuelle Serie ${stats.streak} · Beste Serie ${stats.best}</p><div class="stats-table"><table><thead><tr><th>Level</th><th>Checks</th><th>Richtig</th><th>Quote</th><th>Serie</th><th>Beste</th></tr></thead><tbody>${LEVELS.filter(l=>l.id<=state.level).map(l=>{const s=stats.levels[l.id];return `<tr><th>${l.id}</th><td>${s.checks}</td><td>${s.correct}</td><td>${accuracy(s)}</td><td>${s.streak}</td><td>${s.best}</td></tr>`;}).join('')}</tbody></table></div><p class="note">Checks zählen zum beim Öffnen gewählten Level. Überspringen und Vermutungen zählen nicht. ${storageAvailable?'Nur lokal in diesem Browser gespeichert.':'Speichern ist nicht verfügbar; Statistik gilt nur für diese Sitzung.'}</p></details>`;
  }
  function render() {
    root.hidden = !state.enabled;
    if (!state.enabled || !view) {root.replaceChildren(); return;}
    root.innerHTML = `<div class="training-heading"><label>Trainingslevel <select id="training-level" ${paused()?'disabled':''}>${LEVELS.map(l=>`<option value="${l.id}" ${state.level===l.id?'selected':''}>Level ${l.id} · ${l.title}</option>`).join('')}</select></label><button data-action="begin" ${paused()?'disabled':''}>Jetzt prüfen</button></div><p>${levelDefinition(state.level).description}</p>${state.completedRound&&!paused()?`<p class="training-notice" role="status">Runde ${state.completedRound} abgeschlossen. Ein freiwilliger Check ist bereit.</p>`:''}${quizMarkup()}${pickerMarkup()}${memoryMarkup()}${weaknessMarkup()}${analysisMarkup()}${statsMarkup()}`;
    root.querySelector('#training-level').onchange = event => {state=configureTraining(state,{level:Number(event.target.value)});redraw();};
    root.querySelectorAll('[data-panel]').forEach(el=>el.ontoggle=()=>{if(el.dataset.panel==='analysis')analysisOpen=el.open;else statsOpen=el.open;});
    root.querySelectorAll('button').forEach(button=>button.onclick=()=>{
      const d=button.dataset;
      if(d.action==='begin')begin();
      if(d.action==='close')closeCheck();
      if(d.action==='submit')submit();
      if(d.number!==undefined){answer.number=Number(d.number);render();}
      if(d.face){answer.faces=answer.faces.includes(d.face)?answer.faces.filter(r=>r!==d.face):[...answer.faces,d.face];render();}
      if(d.suit){answer.suit=d.suit;render();}
      if(d.rank){answer.rank=d.rank;render();}
      if(d.pick){picking=Number(d.pick);analysisOpen=false;redraw();root.querySelector('[aria-label="Karte merken"]')?.focus();}
      if(d.remember){state=rememberCard(state,view,picking,d.remember);picking=null;redraw();}
      if(d.recall)begin('memory',Number(d.recall));
      if(d.forget){state=forgetCard(state,Number(d.forget));redraw();}
      if(d.weakPlayer){state=toggleWeakness(state,Number(d.weakPlayer),d.weakSuit);render();}
      if(d.reveal)onReveal(Number(d.reveal));
    });
  }
  return {
    isPaused: paused,
    update(publicView) {view=publicView;state=observeTraining(state,view);render();},
    setEnabled(enabled) {state={...configureTraining(state,{enabled}),completedRound:null};quiz=null;picking=null;result=null;analysisOpen=false;redraw();},
    reset(publicView) {state={...createTrainingState(),enabled:state.enabled,level:state.level};quiz=null;picking=null;result=null;analysisOpen=false;view=publicView;render();},
  };
}
