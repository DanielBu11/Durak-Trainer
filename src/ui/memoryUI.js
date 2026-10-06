import {createMemory,observeMemory,beginMemoryQuestion,finishMemoryQuestion,acknowledgeMemoryNotice,MEMORY_TIMING,loadMemoryStats,recordMemoryAnswer} from '../training/automaticMemory.js';
const who=id=>id===1?'Uhu':'Aal';
const label=c=>c.suit+c.rank;
export function createMemoryUI({onChange,storage,set=setTimeout,clear=clearTimeout}){
 let memory=createMemory(),stats=loadMemoryStats(storage),enabled=false,ready=false,view;
 let timer=null,epoch=0,noticeKey='',feedback=null,focusedQuestion=null;
 const cancel=()=>{epoch++;clear(timer);timer=null;noticeKey='';feedback=null;};
 const later=(fn,delay)=>{const token=++epoch;clear(timer);timer=set(()=>{if(token!==epoch)return;timer=null;fn();onChange();},delay);};
 return {
  update(publicView,options){
   view=publicView;ready=options.ready;enabled=options.enabled&&view.phase!=='finished';
   if(!enabled||memory.mode!==options.mode){cancel();memory=createMemory(options.mode,memory.seed);}
   const previousQuestion=memory.question;
   memory=observeMemory(memory,view,{enabled,mode:options.mode});
   if(previousQuestion&&!memory.question)cancel();
   if(!enabled)return;
   const key=JSON.stringify(memory.notices);
   if(ready&&memory.notices.length){
    if(key!==noticeKey){noticeKey=key;later(()=>{memory=acknowledgeMemoryNotice(memory);noticeKey='';},MEMORY_TIMING.NOTICE);}
   }else if(!memory.notices.length&&noticeKey){cancel();}
   if(ready&&!memory.notices.length&&!feedback)memory=beginMemoryQuestion(memory,view);
  },
  get paused(){return enabled&&Boolean(memory.question);},
  blockedPlayer:()=>enabled?(memory.question?.player??null):null,
  markup(){
   if(!enabled)return '';
   const mode=memory.mode.toUpperCase();
   const notice=memory.notices.length&&noticeKey?`<div class="memory-notice" role="status">${memory.notices.map(n=>`<p>Merke bei ${who(n.player)}: <strong>${n.cards.map(label).join(' · ')}</strong></p>`).join('')}</div>`:'';
   const q=memory.question;
   const question=q?`<section class="quiz-box" tabindex="-1" aria-label="Merkkarten-Abfrage"><h3>Level ${mode}</h3>${feedback?`<p role="status">${feedback.correct?'Richtig':'Falsch'} – ${feedback.correct?'':'gemerkt war '}${label(q.card)}</p>`:`<p>Welche Karte merkst du dir bei ${who(q.player)}?</p><div class="touch-options">${q.options.map(c=>`<button data-memory-answer="${c.id}">${label(c)}</button>`).join('')}</div><button class="quiet" data-memory-skip>Überspringen</button>`}</section>`:'';
   const rows=['3a','3b'].map(m=>{const s=stats[m];return `Level ${m.toUpperCase()}: ${s.correct}/${s.checks} richtig${s.checks?' · '+Math.round(100*s.correct/s.checks)+' %':''} · Uhu ${s.players[1].correct}/${s.players[1].checks} · Aal ${s.players[2].correct}/${s.players[2].checks}`;});
   return `${notice}${question}<section class="memory-section"><h3>Level ${mode} · Automatisches Kartengedächtnis</h3><p>Merke dir ${memory.mode==='3b'?'bis zu zwei relevante Karten':'eine relevante Karte'} pro Gegner. Neue Merkkarten erscheinen kurz; die Abfrage folgt nach einigen Spielaktionen.</p><details><summary>Merkkarten-Statistik</summary>${rows.map(r=>`<p>${r}</p>`).join('')}</details></section>`;
  },
  bind(root){
   const focusKey=memory.question?memory.question.player+memory.question.card.id:null;
   if(focusKey!==focusedQuestion){focusedQuestion=focusKey;root.querySelector('[aria-label="Merkkarten-Abfrage"]')?.focus();}
   root.querySelectorAll('[data-memory-answer]').forEach(button=>button.onclick=()=>{
    if(!memory.question||feedback)return;
    const q=memory.question;feedback={correct:button.dataset.memoryAnswer===q.card.id};
    stats=recordMemoryAnswer(stats,memory.mode,q.player,feedback.correct);
    try{storage?.setItem('durak.memory.stats.v1',JSON.stringify(stats));}catch{}
    later(()=>{memory=finishMemoryQuestion(memory);feedback=null;},MEMORY_TIMING.FEEDBACK);onChange();
   });
   const skip=root.querySelector('[data-memory-skip]');if(skip)skip.onclick=()=>{cancel();memory=finishMemoryQuestion(memory);onChange();};
  },
  reset(){cancel();memory=createMemory(memory.mode,memory.seed);enabled=false;},
  suspend(){cancel();},
  snapshot:()=>structuredClone(memory),
  restore(saved){cancel();memory=saved?structuredClone(saved):createMemory();memory=finishMemoryQuestion(memory);memory.notices=[];enabled=false;},
 };
}
