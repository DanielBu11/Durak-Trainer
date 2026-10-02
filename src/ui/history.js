// Private controller storage. Snapshots never become inputs to bots.
export function createHistory(initial) {
  let entries=[structuredClone(initial)],cursor=0;
  return {
    get index(){return cursor;},get length(){return entries.length;},
    get isPast(){return cursor<entries.length-1;},
    current(){return structuredClone(entries[cursor]);},
    replace(snapshot){entries[cursor]=structuredClone(snapshot);},
    commit(snapshot){entries=entries.slice(0,cursor+1);entries.push(structuredClone(snapshot));cursor++;},
    go(index){cursor=Math.max(0,Math.min(entries.length-1,index));return structuredClone(entries[cursor]);}
  };
}

// Invalidate even callbacks that have already entered the browser's task queue.
export function createBotScheduler(set=setTimeout,clear=clearTimeout){
  let handle,epoch=0;
  const cancel=()=>{epoch++;clear(handle);};
  return {cancel,schedule(callback,delay){cancel();const token=epoch;handle=set(()=>{if(token===epoch)callback();},delay);}};
}
