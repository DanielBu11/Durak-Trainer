import test from 'node:test';
import assert from 'node:assert/strict';
import {collectionFeedback,createEventFeedback} from '../src/ui/eventFeedback.js';
test('completed pickups report exact player, card count, and destination',()=>{
 for(const [player,name,target] of [[0,'Du nimmst','hand-target'],[1,'Uhu nimmt','bot1'],[2,'Aal nimmt','bot2']]){const result=collectionFeedback([{type:'pickup',player,cards:Array(6).fill({id:'x'})}]);assert.equal(result.title,'Aufgenommen!');assert.equal(result.detail,`${name} 6 Karten`);assert.equal(result.target,target);}
});
test('defended banner only for actual discard, never defense play or announced take',()=>{
 assert.equal(collectionFeedback([{type:'play'}]),null);assert.equal(collectionFeedback([{type:'take'}]),null);assert.equal(collectionFeedback([{type:'discard',cards:[]}]).title,'Verteidigt!');
});
test('undo/new game cancels banner timers, including already queued callbacks',()=>{
 const calls=[],classes=new Set(),texts={strong:{},small:{}};
 const root={hidden:true,dataset:{},querySelector:key=>texts[key],classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)}};
 const banner=createEventFeedback(root,{set:fn=>{calls.push(fn);return calls.length;},clear(){}});
 const message=collectionFeedback([{type:'pickup',player:1,cards:[{}]}]);banner.show(message);assert.equal(root.hidden,false);assert.equal(texts.small.textContent,'Uhu nimmt 1 Karte');
 const stale=calls[0];banner.cancel();assert.equal(root.hidden,true);banner.show({...message,title:'New'});stale();assert.ok(classes.has('visible'));calls[1]();assert.equal(classes.has('visible'),false);calls[2]();assert.equal(root.hidden,true);
});
