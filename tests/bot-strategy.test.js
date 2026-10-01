import test from 'node:test';
import assert from 'node:assert/strict';
import {deck} from '../src/game/cards.js';
import {createGame, observation} from '../src/game/engine.js';
import {chooseAction, explainDecision} from '../src/bots/strategy.js';
import {publicKnowledge} from '../src/bots/knowledge.js';
import {publicView} from '../src/bots/view.js';
const c = id => deck().find(c => c.id === id);
function position(hand, attacks = [], overrides = {}) {
  const s = createGame();
  Object.assign(s, {trump: '♠', table: attacks.map(id => ({attack: c(id), defense: null})),
    actor: 0, attacker: attacks.length ? 1 : 0, defender: attacks.length ? 0 : 1,
    phase: attacks.length ? 'defend' : 'attack', limit: 6, events: [], discarded: [], taking: false});
  s.players[0].hand = hand.map(c);
  const view = observation(s);
  return {...view, ...overrides};
}
for (const level of ['beginner', 'amateur']) {
  test(`${level}: normal suit before trump and lowest normal defense`, () => {
    const v = position(['♥8', '♥K', '♠6', '♠A'], ['♥7']);
    assert.equal(chooseAction(v, level).card, '♥8');
  });
  test(`${level}: small trump before high trump`, () => {
    const v = position(['♠6', '♠A', '♦8'], ['♥K']);
    assert.equal(chooseAction(v, level).card, '♠6');
  });
  test(`${level}: never accesses hidden fields, even throwing getters`, () => {
    const v = position(['♥6', '♦8', '♠K']);
    const before = chooseAction(v, level);
    const fail = () => {throw new Error('Hidden information was read');};
    for (const key of ['stock', 'stockCount', 'trumpCard', 'revealed', 'training', 'opponentHands']) Object.defineProperty(v, key, {get: fail});
    for (const p of v.players) Object.defineProperty(p, 'hand', {get: fail});
    assert.deepEqual(chooseAction(v, level), before);
  });
  test(`${level}: hidden deals with identical public view yield identical scores`, () => {
    const s = createGame();
    const other = structuredClone(s);
    const opponents = other.players.filter(p => p.id !== s.actor);
    [opponents[0].hand[0], other.stock[1]] = [other.stock[1], opponents[0].hand[0]];
    [opponents[1].hand[1], other.stock[2]] = [other.stock[2], opponents[1].hand[1]];
    assert.deepEqual(explainDecision(observation(s), level), explainDecision(observation(other), level));
  });
}
test('beginner: low plain opening, conservative follow-up, no history access', () => {
  const v = position(['♥6', '♦A', '♠6']);
  const fail = () => {throw new Error('Beginner read counting data');};
  Object.defineProperty(v, 'events', {get: fail});
  Object.defineProperty(v, 'discarded', {get: fail});
  assert.equal(chooseAction(v).card, '♥6');
  const follow = position(['♠A'], [], {table: [{attack: c('♥A'), defense: c('♠6')}], actions: [{type:'attack',card:'♠A'},{type:'pass'}]});
  assert.equal(chooseAction(follow).type, 'pass');
});
test('amateur: paired rank preferred over isolated low card', () => {
  const v = position(['♥6', '♦9', '♣9', '♠K']);
  assert.ok(['♦9', '♣9'].includes(chooseAction(v, 'amateur').card));
});
test('amateur: chooses take through score rather than hard-coded override', () => {
  const v = position(['♠K', '♦8'], ['♥6']);
  const result = explainDecision(v, 'amateur');
  assert.equal(result.action.type, 'take');
  assert.ok(result.score > result.alternatives.find(a => a.action.type === 'defend').score);
  assert.equal(chooseAction(v, 'beginner').type, 'defend');
});
test('amateur: expensive sequence of open attacks favors pickup', () => {
  const v = position(['♠Q', '♠A', '♦8'], ['♥6', '♣6']);
  assert.equal(chooseAction(v, 'amateur').type, 'take');
});
test('amateur: known pickup counter changes attack; knowledge expires on play', () => {
  const base = position(['♥8', '♦8', '♣K']);
  const v = {...base, events: [{type:'pickup', player:1, round:1, cards:[c('♥9')]}]};
  const result = explainDecision(v, 'amateur');
  const hearts = result.alternatives.find(a=>a.action.card==='♥8');
  const diamonds = result.alternatives.find(a=>a.action.card==='♦8');
  assert.ok(hearts.score < diamonds.score);
  assert.ok(hearts.reasons.some(r=>r.factor==='KNOWN_COUNTER_COST'));
  v.events.push({type:'play',player:1,round:2,card:c('♥9')});
  assert.equal(publicKnowledge(publicView(v,'amateur')).held.get(1).size,0);
  assert.ok(!explainDecision(v,'amateur').alternatives.find(a=>a.action.card==='♥8').reasons.some(r=>r.factor==='KNOWN_COUNTER_COST'));
});
test('amateur: discarded trumps affect reserve score, beginner unaffected', () => {
  const v = position(['♠K', '♦8'], ['♥6']);
  const changed = {...v, discarded:[c('♠6'),c('♠7'),c('♠8')]};
  const score = view => explainDecision(view,'amateur').alternatives.find(a=>a.action.card==='♠K').score;
  assert.ok(score(changed) < score(v));
  assert.deepEqual(explainDecision(v,'beginner'),explainDecision(changed,'beginner'));
});
test('amateur: exploits a publicly known unanswerable high plain attack', () => {
  const v = position(['♥6','♦A','♠8'], [], {
    players:[{id:0,count:3},{id:1,count:1},{id:2,count:6}],
    events:[{type:'pickup',player:1,round:1,cards:[c('♥K')]}],
  });
  const result = explainDecision(v,'amateur');
  assert.equal(result.action.card,'♦A');
  assert.ok(result.reasons.some(r=>r.factor==='FORCE_PICKUP'&&r.points===22));
});
test('amateur: last two trumps incur explicit reserve penalty', () => {
  const v = position(['♠6','♠K','♦8'],['♥6']);
  const result = explainDecision(v,'amateur');
  assert.ok(result.alternatives.find(a=>a.action.card==='♠6').reasons.some(r=>r.factor==='LAST_TRUMPS_COST'&&r.points===-14));
  v.hand.push(c('♠9'));
  assert.ok(!explainDecision(v,'amateur').alternatives.find(a=>a.action.card==='♠6').reasons.some(r=>r.factor==='LAST_TRUMPS_COST'));
});
test('amateur: public weakness is uncertain and cleared by suit play', () => {
  const v = position(['♥8','♦8'], [], {events:[{type:'pickup',player:1,round:1,cards:[c('♥6')]}]});
  assert.equal(publicKnowledge(publicView(v,'amateur')).weaknesses.get('1:♥'),1);
  v.events.push({type:'play',player:1,round:2,card:c('♥6')});
  assert.equal(publicKnowledge(publicView(v,'amateur')).weaknesses.has('1:♥'),false);
});
test('explanations are deterministic, additive, legal and do not mutate input', () => {
  const v = position(['♥6','♦9','♣9','♠K']);
  const before = structuredClone(v);
  for (const level of ['beginner','amateur']) {
    const result=explainDecision(v,level);
    assert.deepEqual(result,explainDecision(v,level));
    assert.deepEqual(result.action,chooseAction(v,level));
    assert.equal(result.alternatives.length,v.actions.length);
    for(const alternative of result.alternatives) {
      assert.ok(v.actions.some(a=>JSON.stringify(a)===JSON.stringify(alternative.action)));
      assert.equal(alternative.score,alternative.reasons.reduce((sum,r)=>sum+r.points,0));
      assert.ok(Number.isFinite(alternative.score));
    }
  }
  assert.deepEqual(v,before);
});
test('injected RNG only breaks exact ties; default independent of action order', () => {
  const v = position(['♥6','♦6']);
  const first=chooseAction(v,'beginner',{rng:()=>0}), last=chooseAction(v,'beginner',{rng:()=>0.999});
  assert.notEqual(first.card,last.card);
  assert.deepEqual(chooseAction(v),chooseAction({...v,actions:[...v.actions].reverse()}));
  assert.throws(()=>chooseAction(v,'beginner',{rng:()=>1}),/RNG/);
});
test('finished/no turn has no action; invalid level rejected', () => {
  const v = position(['♥6'],[],{actions:[]});
  assert.equal(chooseAction(v),null);
  assert.throws(()=>chooseAction(v,'master'),/Bot-Stufe/);
});
