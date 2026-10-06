import {deck} from '../game/cards.js';
import {publicGameKnowledge} from '../knowledge/publicGameKnowledge.js';

export const MEMORY_TIMING={NOTICE:1900,FEEDBACK:1300};
export const MEMORY_POLICY={TRUMP:100,RANK:8,MIN_PLAIN:4,REPLACE_MARGIN:16};
export const memoryScore=(c,trump)=>(c.suit===trump?MEMORY_POLICY.TRUMP:0)+c.value*MEMORY_POLICY.RANK;
export const memoryCapacity=mode=>mode==='3b'?2:1;
export function createMemory(mode='3a',seed=173){return {mode,seed,active:{1:[],2:[]},action:0,cursor:0,nextQuizAfter:0,notices:[],question:null};}
function random(s){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
const delay=s=>2+Math.floor(random(s)*3);
/** Only public pickup/play history and counts. Never actual opponent hands. */
export function observeMemory(previous,view,{enabled=true,mode=previous.mode}={}){
 if(!enabled||view.phase==='finished')return createMemory(mode,previous.seed);
 const s=mode===previous.mode?structuredClone(previous):createMemory(mode,previous.seed);
 if(view.events.length!==s.cursor){s.action++;s.cursor=view.events.length;}
 const facts=publicGameKnowledge(view);
 for(const player of [1,2]){
  const known=facts.knownCardsByPlayer[player],count=view.players.find(p=>p.id===player)?.count??0;
  const candidates=known.filter(c=>c.suit===view.trump||c.value>=MEMORY_POLICY.MIN_PLAIN)
   .sort((a,b)=>memoryScore(b,view.trump)-memoryScore(a,view.trump)||a.id.localeCompare(b.id));
  const cap=Math.min(memoryCapacity(mode),count,candidates.length);
  let active=s.active[player].filter(m=>candidates.some(c=>c.id===m.card.id)).slice(0,cap);
  const added=[];
  for(const card of candidates){
   if(active.some(m=>m.card.id===card.id))continue;
   const entry=()=>({card:{...card},due:s.action+delay(s)});
   if(active.length<cap){active.push(entry());added.push(card);continue;}
   const weakest=active.reduce((i,m,j)=>memoryScore(m.card,view.trump)<memoryScore(active[i].card,view.trump)?j:i,0);
   if(cap&&memoryScore(card,view.trump)>=memoryScore(active[weakest].card,view.trump)+MEMORY_POLICY.REPLACE_MARGIN){active[weakest]=entry();added.push(card);}
  }
  s.active[player]=active;
  if(added.length)s.notices.push({player,cards:added.filter(c=>active.some(m=>m.card.id===c.id))});
 }
 // Remove stale notifications and questions immediately after a public play.
 s.notices=s.notices.map(n=>({...n,cards:n.cards.filter(c=>s.active[n.player].some(m=>m.card.id===c.id))})).filter(n=>n.cards.length);
 if(s.question&&!s.active[s.question.player].some(m=>m.card.id===s.question.card.id))s.question=null;
 return s;
}
export function beginMemoryQuestion(previous,view){
 const s=structuredClone(previous);if(s.question||s.notices.length||s.action<s.nextQuizAfter)return s;
 const due=[1,2].flatMap(player=>s.active[player].filter(m=>m.due<=s.action).map(m=>({player,...m})));
 if(!due.length)return s;
 const chosen=due[Math.floor(random(s)*due.length)];
 const exclude=new Set(s.active[chosen.player].map(m=>m.card.id));
 const candidates=deck().filter(c=>!exclude.has(c.id)).map(c=>({card:c,score:Math.abs(c.value-chosen.card.value)*3+(c.suit===chosen.card.suit?0:2),tie:random(s)}))
  .sort((a,b)=>a.score-b.score||a.tie-b.tie).slice(0,3).map(x=>x.card);
 const options=[chosen.card,...candidates];
 for(let i=options.length-1;i>0;i--){const j=Math.floor(random(s)*(i+1));[options[i],options[j]]=[options[j],options[i]];}
 s.question={player:chosen.player,card:chosen.card,options};return s;
}
export function finishMemoryQuestion(previous){
 const s=structuredClone(previous),q=s.question;if(!q)return s;
 const m=s.active[q.player].find(m=>m.card.id===q.card.id);if(m)m.due=s.action+delay(s);
 s.question=null;s.nextQuizAfter=s.action+delay(s);return s;
}
export function emptyMemoryStats(){return Object.fromEntries(['3a','3b'].map(mode=>[mode,{checks:0,correct:0,players:{1:{checks:0,correct:0},2:{checks:0,correct:0}}}]));}
export function loadMemoryStats(storage){
 try{const data=JSON.parse(storage?.getItem('durak.memory.stats.v1'));const result=emptyMemoryStats();
 for(const mode of ['3a','3b'])for(const [target,source] of [[result[mode],data[mode]],...[1,2].map(id=>[result[mode].players[id],data[mode].players[id]])]){
 if(!Number.isSafeInteger(source.checks)||!Number.isSafeInteger(source.correct)||source.correct<0||source.correct>source.checks)throw Error();
 target.checks=source.checks;target.correct=source.correct;
 }return result;}catch{return emptyMemoryStats();}
}
export function recordMemoryAnswer(stats,mode,player,correct){const next=structuredClone(stats);for(const target of [next[mode],next[mode].players[player]]){target.checks++;target.correct+=Number(correct);}return next;}

export function acknowledgeMemoryNotice(previous){
 const s=structuredClone(previous);
 for(const n of s.notices)for(const m of s.active[n.player])if(n.cards.some(c=>c.id===m.card.id))m.due=s.action+delay(s);
 s.notices=[];return s;
}
