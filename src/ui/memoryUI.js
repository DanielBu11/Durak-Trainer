import {createMemory,observeMemory,acknowledgeMemoryNotice,MEMORY_TIMING,loadMemoryStats,recordMemoryAnswer} from '../training/automaticMemory.js';
const who=id=>id===1?'Uhu':'Aal';
const label=c=>c.suit+c.rank;
/** Only reminder notices have a timer. Questions are owned by the manual dialog. */
export function createMemoryUI({onChange,storage,set=setTimeout,clear=clearTimeout}){
 let memory=createMemory(),stats=loadMemoryStats(storage),enabled=false;
 let timer=null,epoch=0,noticeKey='';
 const cancel=()=>{epoch++;clear(timer);timer=null;noticeKey='';};
 return {
  update(view,{ready,enabled:active,mode}){
   enabled=active&&view.phase!=='finished';
   if(!enabled||memory.mode!==mode){cancel();memory=createMemory(mode);}
   memory=observeMemory(memory,view,{enabled,mode});
   if(!enabled)return;
   const key=JSON.stringify(memory.notices);
   if(ready&&memory.notices.length&&key!==noticeKey){
    cancel();noticeKey=key;const token=epoch;
    timer=set(()=>{if(token!==epoch)return;memory=acknowledgeMemoryNotice(memory);noticeKey='';timer=null;onChange();},MEMORY_TIMING.NOTICE);
   }else if(!memory.notices.length&&noticeKey)cancel();
  },
  markup(){
   if(!enabled)return '';
   const notice=memory.notices.length&&noticeKey?`<div class="memory-notice" role="status">${memory.notices.map(n=>`<p>Merke bei ${who(n.player)}: <strong>${n.cards.map(label).join(' · ')}</strong></p>`).join('')}</div>`:'';
   const rows=['3a','3b'].map(m=>{const s=stats[m];return `Level ${m.toUpperCase()}: ${s.correct}/${s.checks} richtig${s.checks?' · '+Math.round(100*s.correct/s.checks)+' %':''} · Uhu ${s.players[1].correct}/${s.players[1].checks} · Aal ${s.players[2].correct}/${s.players[2].checks}`;});
   return `${notice}<details><summary>Merkkarten-Statistik</summary>${rows.map(r=>`<p>${r}</p>`).join('')}</details>`;
  },
  record(results){for(const r of results)if(!r.skipped)stats=recordMemoryAnswer(stats,memory.mode,r.player,r.correct);
   try{storage?.setItem('durak.memory.stats.v1',JSON.stringify(stats));}catch{}},
  dismissNotice(){cancel();memory=acknowledgeMemoryNotice(memory);},
  reset(){cancel();memory=createMemory(memory.mode);enabled=false;},
  suspend(){cancel();},
  snapshot:()=>structuredClone(memory),
  restore(saved){cancel();memory=createMemory(saved?.mode);if(saved?.active)memory.active=structuredClone(saved.active);enabled=false;},
 };
}
