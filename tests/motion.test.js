import test from 'node:test';
import assert from 'node:assert/strict';
import {animateMove, motionFinished, cancelMotion} from '../src/ui/motion.js';

function environment(reduced=false) {
  const animations=[],nodes=[];
  const box={left:10,top:20,width:44,height:66};
  const node=()=>({className:'',style:{},setAttribute(){},removeAttribute(){},
    classList:{contains(){return false;}},getBoundingClientRect:()=>box,
    animate(frames,options){animations.push({frames,options});return {finished:Promise.resolve()};},
    remove(){this.removed=true;}});
  const originalDocument=globalThis.document,originalMatchMedia=globalThis.matchMedia;
  globalThis.matchMedia=()=>({matches:reduced});
  globalThis.document={querySelectorAll:()=>[],getElementById:node,createElement:node,body:{append(n){nodes.push(n);}}};
  return {box,node,nodes,animations,restore(){globalThis.document=originalDocument;globalThis.matchMedia=originalMatchMedia;}};
}
const counts=values=>values.map((length,id)=>({id,hand:new Proxy({length},{get(target,key){assert.equal(key,'length','animation must not inspect hidden cards');return target.length;}})}));
test('pickup and refill use public counts, cap draw backs, and clean up without callbacks',async()=>{
  const env=environment();try{
    const snapshot={source:env.box,stock:env.box,table:[{node:env.node(),box:env.box}],hand:[]};
    const before={players:counts([2,1,1]),stock:{length:10}};
    const after={players:counts([5,6,3]),stock:{length:3}};
    animateMove(snapshot,before,after,{type:'pass'},[{type:'pickup',player:0,cards:[1,2,3]}]);
    // One pickup ghost, three capped backs for bot 1, two for bot 2.
    assert.equal(env.animations.length,6);
    assert.ok(env.animations.every(a=>a.options.duration===580));
    await Promise.resolve();assert.ok(env.nodes.every(n=>n.removed));
  }finally{env.restore();}
});
test('reduced motion skips all flights, even before looking up cards',()=>{
  const env=environment(true);try{animateMove(null,null,null,null,null);assert.equal(env.animations.length,0);}finally{env.restore();}
});
test('declaring take does not prematurely clear the table or draw cards',()=>{
  const env=environment();try{
    const snapshot={table:[{node:env.node(),box:env.box}]};
    animateMove(snapshot,{stock:{length:8}},{stock:{length:8}},{type:'take'},[]);
    assert.equal(env.animations.length,0);
  }finally{env.restore();}
});
test('completion barrier waits for visible motion and undo can cancel it safely',async()=>{
  const env=environment();try{
    const ghost=env.node();let reject,canceled=false,done=false;
    ghost.animate=()=>({finished:new Promise((resolve,fail)=>{reject=fail;}),cancel(){canceled=true;reject(new Error('canceled'));}});
    animateMove({table:[{node:ghost,box:env.box}]},{stock:{length:8}},{stock:{length:8}},{type:'pass'},[{type:'discard'}]);
    const barrier=motionFinished().then(()=>{done=true;});
    await Promise.resolve();assert.equal(done,false);
    cancelMotion();await barrier;
    assert.equal(canceled,true);assert.equal(done,true);assert.equal(ghost.removed,true);
  }finally{env.restore();}
});
