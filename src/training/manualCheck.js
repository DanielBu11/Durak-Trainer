import {deck,shuffle} from '../game/cards.js';
import {createCheck,evaluateCheck} from './trainingEvaluation.js';
import {publicGameKnowledge} from '../knowledge/publicGameKnowledge.js';

// Random deck distractors, with varied ranks/suits rather than near-identical
// cards. RNG can be injected in tests; real openings use fresh Math.random.
export function memoryOptions(correct,rng=Math.random){
 if(!correct.length)return [];
 const chosen=correct.map(c=>({...c})),ids=new Set(chosen.map(c=>c.id));
 const pool=shuffle(deck().filter(c=>!ids.has(c.id)),rng);
 while(chosen.length<4){
  const ranks=new Set(chosen.map(c=>c.rank)),suits=new Set(chosen.map(c=>c.suit));
  let i=pool.findIndex(c=>!ranks.has(c.rank)&&!suits.has(c.suit));
  if(i<0)i=pool.findIndex(c=>!ranks.has(c.rank));
  if(i<0)i=0;chosen.push(pool.splice(i,1)[0]);
 }
 return shuffle(chosen,rng);
}
export function createManualCheck(state,view,memory,choice,rng=Math.random){
 const trumps=createCheck(state,view);if(!trumps)return null;
 const opponents=[];
 if(state.level>=3){
  const known=publicGameKnowledge(view).knownCardsByPlayer,cap=choice==='3b'?2:1;
  for(const player of [1,2]){
   const count=view.players.find(p=>p.id===player)?.count??0;
   const cards=(memory.active[player]??[]).map(m=>m.card).filter(c=>known[player].some(k=>k.id===c.id)).slice(0,Math.min(cap,count));
   opponents.push({player,cards:structuredClone(cards),options:memoryOptions(cards,rng),required:cards.length});
  }
 }
 return {choice,level:state.level,trumps,opponents};
}
export function emptyManualAnswer(){return {number:null,faces:[],opponents:{1:[],2:[]}};}
const equalSet=(a,b)=>new Set(a).size===new Set(b).size&&[...new Set(a)].every(x=>b.includes(x));
export function manualAnswerComplete(check,answer){
 return (!check.trumps.includeNumbers||Number.isInteger(answer.number))&&check.opponents.every(q=>!q.required||answer.opponents[q.player].length===q.required);
}
export function evaluateManualCheck(check,answer){
 const trumps=evaluateCheck(check.trumps,answer);
 const opponents=check.opponents.map(q=>({player:q.player,skipped:!q.required,correct:equalSet(answer.opponents[q.player]??[],q.cards.map(c=>c.id)),cards:structuredClone(q.cards)}));
 return {correct:trumps.correct&&opponents.every(q=>q.skipped||q.correct),trumps,opponents,
  faces:Object.fromEntries(['J','Q','K','A'].map(rank=>[rank,(answer.faces??[]).includes(rank)===check.trumps.solution.faces.includes(rank)]))};
}
