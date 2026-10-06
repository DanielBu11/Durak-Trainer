import {publicGameKnowledge} from '../knowledge/publicGameKnowledge.js';

export const MEMORY_TIMING={NOTICE:1900};
export const MEMORY_POLICY={TRUMP:100,RANK:8,MIN_PLAIN:4,REPLACE_MARGIN:16};
export const memoryScore=(c,trump)=>(c.suit===trump?MEMORY_POLICY.TRUMP:0)+c.value*MEMORY_POLICY.RANK;
export const memoryCapacity=mode=>mode==='3b'?2:1;
export function createMemory(mode='3a'){return {mode,active:{1:[],2:[]},notices:[]};}
/** Only public pickup/play history and counts. Never actual opponent hands. */
export function observeMemory(previous,view,{enabled=true,mode=previous.mode}={}){
 if(!enabled||view.phase==='finished')return createMemory(mode);
 const s=mode===previous.mode?structuredClone(previous):createMemory(mode);
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
   const entry=()=>({card:{...card}});
   if(active.length<cap){active.push(entry());added.push(card);continue;}
   const weakest=active.reduce((i,m,j)=>memoryScore(m.card,view.trump)<memoryScore(active[i].card,view.trump)?j:i,0);
   if(cap&&memoryScore(card,view.trump)>=memoryScore(active[weakest].card,view.trump)+MEMORY_POLICY.REPLACE_MARGIN){active[weakest]=entry();added.push(card);}
  }
  s.active[player]=active;
  if(added.length)s.notices.push({player,cards:added.filter(c=>active.some(m=>m.card.id===c.id))});
 }
 // Remove stale notifications immediately after a public play.
 s.notices=s.notices.map(n=>({...n,cards:n.cards.filter(c=>s.active[n.player].some(m=>m.card.id===c.id))})).filter(n=>n.cards.length);
 return s;
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
 s.notices=[];return s;
}
