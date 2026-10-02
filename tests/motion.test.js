import test from 'node:test';
import assert from 'node:assert/strict';
import {animateMove,motionFinished,cancelMotion} from '../src/ui/motion.js';
function environment(reduced=false){
 const animations=[],nodes=[],box={left:10,top:20,width:44,height:66};
 const targets={'hand-target':{...box,left:300},bot1:{...box,left:100},bot2:{...box,left:600},'stock':{...box,left:900}};
 const node=()=>{const n={dataset:{card:'x'},className:'',style:{},setAttribute(){},removeAttribute(){},getBoundingClientRect:()=>box,animate(frames,options){animations.push({frames,options});return {finished:Promise.resolve(),cancel(){}};},remove(){this.removed=true;}};n.classList={contains:c=>n.className.includes(c)};return n;};
 const oldDoc=globalThis.document,oldMedia=globalThis.matchMedia;
 globalThis.matchMedia=()=>({matches:reduced});
 globalThis.document={querySelectorAll:()=>[],getElementById:id=>({getBoundingClientRect:()=>targets[id]||box}),createElement:node,body:{append(n){nodes.push(n);}}};
 return {box,node,targets,animations,nodes,restore(){globalThis.document=oldDoc;globalThis.matchMedia=oldMedia;}};
}
for(const [kind,player,target] of [['pickup',0,'hand-target'],['pickup',1,'bot1'],['pickup',2,'bot2'],['discard',null,'stock']]){
 test(`${kind} recipient ${player}: all table cards land only at ${target}, never at refill recipients`,async()=>{
 const e=environment();try{
 const snapshot={table:[{id:'x',node:e.node(),box:e.box},{id:'y',node:e.node(),box:e.box}]};
 const before={stock:{length:10}},after={stock:{length:2},get players(){throw Error('no refill flights during collection');}};
 animateMove(snapshot,before,after,{type:'pass'},[{type:kind,player,cards:[{id:'x'},{id:'y'}]}]);assert.equal(e.animations.length,2);
 for(const a of e.animations){const t=e.targets[target];assert.equal(a.frames.at(-1).transform,`translate(${t.left+t.width/2-e.box.left-e.box.width*.3}px,${t.top+t.height/2-e.box.top-e.box.height*.3}px) scale(.6)`);assert.equal(a.options.duration,660);assert.equal(a.frames[2].opacity,1);}
 assert.deepEqual(e.animations.map(a=>a.options.delay),[0,45]);await motionFinished();assert.ok(e.nodes.every(n=>n.removed));
 }finally{e.restore();}});
}
test('reduced motion skips flights and pending take does not count as pickup',()=>{
 let e=environment(true);try{animateMove(null,null,null,null,null);assert.equal(e.animations.length,0);}finally{e.restore();}
 e=environment();try{animateMove({table:[]},{stock:{length:8}},{stock:{length:8}},{type:'take'},[]);assert.equal(e.animations.length,0);}finally{e.restore();}
});
test('completion barrier waits for arrival and undo cancels pending animations',async()=>{
 const e=environment();try{const ghost=e.node();let reject,canceled=false,done=false;
 ghost.animate=()=>({finished:new Promise((resolve,fail)=>{reject=fail;}),cancel(){canceled=true;reject(Error('cancel'));}});
 animateMove({table:[{id:'x',node:ghost,box:e.box}]},{stock:{length:8}},{stock:{length:8}},{type:'pass'},[{type:'discard',cards:[{id:'x'}]}]);
 const barrier=motionFinished().then(()=>{done=true;});await Promise.resolve();assert.equal(done,false);cancelMotion();await barrier;assert.equal(canceled,true);assert.equal(done,true);assert.equal(ghost.removed,true);
 }finally{e.restore();}
});
