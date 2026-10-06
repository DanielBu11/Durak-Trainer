import test from 'node:test';
import assert from 'node:assert/strict';
import {deck} from '../src/game/cards.js';
import {createMemory,observeMemory} from '../src/training/automaticMemory.js';
import {createManualCheck,emptyManualAnswer,evaluateManualCheck,manualAnswerComplete,memoryOptions} from '../src/training/manualCheck.js';
import {readFile} from 'node:fs/promises';
const c=id=>deck().find(c=>c.id===id);
const v={player:0,trump:'♠',phase:'attack',discarded:['♠6','♠8','♠Q'].map(c),events:[{type:'pickup',player:1,round:1,cards:['♥K','♠J'].map(c)},{type:'pickup',player:2,round:2,cards:['♦A'].map(c)}],players:[{id:0,count:6},{id:1,count:4},{id:2,count:1}]};
const fixture=choice=>createManualCheck({enabled:true,level:choice.startsWith('3')?3:Number(choice)},v,observeMemory(createMemory(choice),v),choice);
test('level 1 keeps face-only check; level 2 adds numeric count without memory questions',()=>{
 const one=fixture('1'),two=fixture('2');assert.equal(one.trumps.includeNumbers,false);assert.equal(two.trumps.includeNumbers,true);assert.equal(one.opponents.length,0);assert.equal(two.opponents.length,0);
 const a={...emptyManualAnswer(),faces:['Q']};assert.ok(evaluateManualCheck(one,a).correct);assert.ok(!evaluateManualCheck(two,a).correct);a.number=2;assert.ok(evaluateManualCheck(two,a).correct);
});
test('3A combines four sections and exactly one remembered card per available opponent',()=>{
 const q=fixture('3a');assert.equal(Number(q.trumps.includeNumbers)+1+q.opponents.length,4);
 assert.deepEqual(q.opponents.map(q=>q.required),[1,1]);assert.ok(q.opponents.every(q=>q.options.length===4));
});
test('3B asks all active memories but respects a one-card opponent',()=>{
 const q=fixture('3b');assert.equal(Number(q.trumps.includeNumbers)+1+q.opponents.length,4);
 assert.deepEqual(q.opponents.map(q=>q.required),[2,1]);
 for(const p of q.opponents){assert.equal(p.options.length,4);assert.equal(p.options.filter(c=>p.cards.some(a=>a.id===c.id)).length,p.required);}
});
test('missing or publicly played memory yields an unavailable question, never forced two answers',()=>{
 const memory=observeMemory(createMemory('3b'),v),changed=structuredClone(v);changed.events.push({type:'play',player:2,round:3,card:c('♦A')});changed.players[2].count=0;
 const q=createManualCheck({enabled:true,level:3},changed,memory,'3b');assert.equal(q.opponents[1].required,0);assert.deepEqual(q.opponents[1].options,[]);
});
test('random options are valid, unique, rank/suit mixed and include each correct card once',()=>{
 let seed=7;const rng=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296),seen=new Set();
 for(const correct of [[c('♥K')],[c('♥K'),c('♦K')],[c('♠A'),c('♠Q')]])for(let i=0;i<30;i++){
  const options=memoryOptions(correct,rng);assert.equal(options.length,4);assert.equal(new Set(options.map(c=>c.id)).size,4);
  assert.ok(options.every(c=>deck().some(d=>d.id===c.id)));assert.ok(new Set(options.map(c=>c.rank)).size>=3);assert.ok(new Set(options.map(c=>c.suit)).size>=3);
  for(const card of correct)assert.equal(options.filter(c=>c.id===card.id).length,1);seen.add(options.map(c=>c.id).join(','));
 }
 assert.ok(seen.size>50);
});
test('batch evaluation is explicit, nonmutating, per-section and requires exact multi-selection',()=>{
 const q=fixture('3b'),snapshot=structuredClone(q),a=emptyManualAnswer();
 assert.equal(q.result,undefined);assert.equal(manualAnswerComplete(q,a),false);
 a.number=2;a.faces=['Q'];for(const p of q.opponents)a.opponents[p.player]=p.cards.map(c=>c.id);
 assert.equal(q.result,undefined);assert.ok(manualAnswerComplete(q,a));assert.ok(evaluateManualCheck(q,a).correct);assert.deepEqual(q,snapshot);
 a.faces.push('K');a.opponents[1]=[q.opponents[0].cards[0].id,q.opponents[0].options.find(c=>!q.opponents[0].cards.some(r=>r.id===c.id)).id];
 const result=evaluateManualCheck(q,a);assert.equal(result.correct,false);assert.equal(result.trumps.numberCorrect,true);assert.equal(result.faces.K,false);assert.equal(result.opponents[0].correct,false);assert.equal(result.opponents[1].correct,true);
});
test('training off cannot create manual check',()=>assert.equal(createManualCheck({enabled:false,level:3},v,createMemory(),'3a'),null));
test('top level control and in-game icons are wired to dialogs, without automatic question entry points',async()=>{
 const [html,app,memory,ui]=await Promise.all(['../dist/index.html','../src/ui/app.js','../src/ui/memoryUI.js','../src/ui/trainingUI.js'].map(p=>readFile(new URL(p,import.meta.url),'utf8')));
 assert.match(html,/class="training-controls"[\s\S]*?id="training"[\s\S]*?id="setup-level"/);
 assert.ok(!ui.includes('id="training-level"'));assert.ok(html.includes('id="quiz-trigger"'));assert.ok(html.includes('id="coach-trigger"'));
 assert.ok(app.includes("$('play-tools').hidden=!state||!$('training').checked"));assert.ok(app.includes('trainingUI.begin();'));
 assert.ok(ui.includes('dialog.showModal()'));assert.ok(ui.includes('if (!quiz')||ui.includes('if(!quiz'));
 assert.ok(!memory.includes('beginMemoryQuestion'));assert.ok(!memory.includes('setInterval'));assert.ok(!memory.includes('FEEDBACK'));
 assert.ok(!ui.includes('setTimeout'));assert.ok(html.includes('data-close-training'));
});

import {createTrainingUI} from '../src/ui/trainingUI.js';
// Small DOM adapter for controller events; no timers or engine state are mocked.
function dialogFixture(){
 const content={html:'',buttons:[],set innerHTML(value){this.html=value;this.buttons=[...value.matchAll(/<button([^>]*)>/g)].map(([,attrs])=>({dataset:Object.fromEntries([...attrs.matchAll(/data-([\w-]+)="([^"]*)"/g)].map(([,k,v])=>[k,v])),disabled:attrs.includes('disabled'),focus(){}}));},get innerHTML(){return this.html;}};
 const close={};const listeners={};
 const dialog={open:false,opens:0,showModal(){this.open=true;this.opens++;},close(){this.open=false;},addEventListener(name,fn){listeners[name]=fn;},querySelector(selector){if(selector==='[data-close-training]')return close;if(selector==='[data-training-content]')return content;return content.buttons.find(b=>b.dataset.action==='close')??null;},querySelectorAll:()=>content.buttons};
 const root={hidden:false,innerHTML:'',replaceChildren(){this.innerHTML='';},querySelectorAll:()=>[]};
 return {dialog,root,content,close,listeners};
}
test('controller opens only manually, evaluates once on Prüfen and stays open until explicit close',t=>{
 // Reproducible options, including cards repeated across different opponents.
 let seed=7,overlappingOptions=0;
 t.mock.method(Math,'random',()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296));
 for(let iteration=0;iteration<100;iteration++){
 const dom=dialogFixture();let ui;
 ui=createTrainingUI({...dom,onChange(){ui.update(v);}});ui.setChoice('3b',false);ui.setEnabled(true);
 assert.equal(dom.dialog.open,false);assert.equal(ui.isPaused(),false);
 for(let i=0;i<10;i++)ui.update(v);assert.equal(dom.dialog.opens,0);
 ui.begin();assert.equal(dom.dialog.open,true);assert.equal(ui.isPaused(),true);
 assert.equal((dom.content.html.match(/data-question=/g)??[]).length,4);
 const click=(key,value,player)=>{const b=dom.content.buttons.find(b=>b.dataset[key]===value&&(player===undefined||b.dataset.player===String(player)));assert.ok(b);assert.equal(b.disabled,false);b.onclick();};
 const questions=ui.snapshot().quiz.opponents;
 if(questions[0].options.some(c=>c.id==='♦A'))overlappingOptions++;
 click('number','2');click('face','Q');
 // Card identity alone is ambiguous: choose in the intended opponent's section.
 for(const id of ['♠J','♥K'])click('card',id,1);
 click('card','♦A',2);
 assert.equal(ui.snapshot().result,null);click('action','submit');
 assert.equal(ui.snapshot().result.correct,true);assert.equal(ui.snapshot().stats.checks,1);
 for(let i=0;i<10;i++)ui.update(v);
 assert.equal(dom.dialog.open,true);assert.equal(ui.snapshot().stats.checks,1);
 assert.ok(dom.content.html.includes('Alles richtig'));click('action','close');
 assert.equal(dom.dialog.open,false);assert.equal(ui.isPaused(),false);
 ui.cancelMemory();
 }
 assert.ok(overlappingOptions>0,'Exercise the same card in both opponent sections');
});
test('off, level change and replay restore close quizzes instead of automatically reopening them',()=>{
 const dom=dialogFixture();let ui;ui=createTrainingUI({...dom,onChange(){ui.update(v);}});
 ui.setChoice('3a',false);ui.setEnabled(true);ui.begin();const saved=ui.snapshot();
 ui.setChoice('2');assert.equal(dom.dialog.open,false);assert.equal(ui.isPaused(),false);
 ui.begin();ui.setEnabled(false);assert.equal(dom.dialog.open,false);
 ui.restore(saved,v);assert.equal(dom.dialog.open,false);assert.equal(ui.isPaused(),false);
 ui.cancelMemory();
});
