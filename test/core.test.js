import test from 'node:test';
import assert from 'node:assert/strict';
import { compileLocal, planSchema } from '../server/compiler.js';
import { createRoom, publicRoom, applyPlan, expireEffects, hostAction, rooms } from '../server/rooms.js';
import { EFFECTS } from '../shared/catalog.js';
import { CHAOS_ROULETTE } from '../shared/chaos.js';

test('all instant controls have valid corresponding rule plans', () => {
  for (const id of Object.keys(EFFECTS)) assert.equal(planSchema.safeParse({effects:[{id}]}).success,true,id);
});
test('wind and black holes can combine as independent forces',()=>{
 const room=createRoom();applyPlan(room,{effects:[{id:'blackhole'},{id:'wind'}]},{name:'Test'},'black hole and wind');
 assert.ok(room.effects.blackhole);assert.ok(room.effects.wind);rooms.delete(room.code);
});
test('every roulette result produces four distinct valid active powers',()=>{
  for(const entry of CHAOS_ROULETTE){const plan=compileLocal(entry.rule);assert.equal(plan.effects.length,4,entry.name);assert.equal(new Set(plan.effects.map(e=>e.id)).size,4);assert.ok(plan.effects.every(e=>!e.remove));assert.equal(planSchema.safeParse({effects:plan.effects}).success,true);}
});
test('compound language compiles in one pass', () => {
  const plan=compileLocal('moon gravity and rain 6 ducks');
  assert.deepEqual(plan.effects.map(e=>e.id),['moon','ducks']);
  assert.equal(plan.effects[1].count,6);
});
test('floor is lava is interpreted immediately', () => assert.equal(compileLocal('the floor is lava').effects[0].id,'lava'));
test('boulders accept common fast-typing typos', () => assert.equal(compileLocal('make the blouders bounce').effects[0].id,'boulders'));
test('zero gravity remains an active low gravity effect', () => assert.equal(compileLocal('no gravity').effects[0].remove,undefined));
test('negation removes the matching effect', () => assert.equal(compileLocal('no lava').effects[0].remove,true));
test('clause negation does not remove other requested effects', () => {
  const effects=compileLocal('stop lava and spawn ducks').effects;
  assert.equal(effects[0].remove,true);assert.equal(effects[1].remove,undefined);
});
test('unknown input is not silently converted into a random effect', () => assert.equal(compileLocal('order me a sandwich'),null));
test('spawn count is bounded and compound effects are capped', () => {
  assert.equal(compileLocal('rain 999999 ducks').effects[0].count,8);
  assert.equal(compileLocal('lava moon ducks rocks disco shield ice').effects.length,4);
});
test('schema rejects unrecognized effects and unbounded AI plans', () => {
  assert.equal(planSchema.safeParse({effects:[{id:'eval',count:999}]}).success,false);
  assert.equal(planSchema.safeParse({effects:[{id:'ducks',count:1000}]}).success,false);
  assert.equal(planSchema.safeParse({effects:[]}).success,false);
});
test('public state never exposes presenter token, receipt cache or socket identifiers', () => {
  const room=createRoom(1000),snapshot=publicRoom(room,1000);
  assert.equal('hostToken' in snapshot,false);assert.equal('participants' in snapshot,false);assert.equal('receipts' in snapshot,false);
  assert.ok(room.hostToken.length>=48);rooms.delete(room.code);
});
test('a new floor replaces the previous floor, while compatible effects compose', () => {
  const room=createRoom(1000),author={name:'Test',color:'#fff'};
  applyPlan(room,{effects:[{id:'lava'},{id:'moon'}],engine:'instant'},author,'lava and moon',1000);
  applyPlan(room,{effects:[{id:'ice'}],engine:'instant'},author,'ice',2000);
  assert.equal(Boolean(room.effects.lava),false);assert.ok(room.effects.ice);assert.ok(room.effects.moon);
  rooms.delete(room.code);
});
test('expiry and remove commands actually clear world rules', () => {
  const room=createRoom(1000),author={name:'Test',color:'#fff'};
  applyPlan(room,{effects:[{id:'lava'}]},author,'lava',1000);
  assert.equal(expireEffects(room,5000),false);
  assert.equal(expireEffects(room,20000),true);
  assert.equal(Object.keys(room.effects).length,0);
  applyPlan(room,{effects:[{id:'moon'},{id:'moon',remove:true}]},author,'moon then remove moon',21000);
  assert.equal(Object.keys(room.effects).length,0);rooms.delete(room.code);
});
test('pause preserves remaining round and effect time', () => {
  const room=createRoom(1000);
  hostAction(room,'start',2000);
  applyPlan(room,{effects:[{id:'lava'}]},{name:'Test'},'lava',3000);
  hostAction(room,'pause',4000);
  assert.equal(expireEffects(room,50000),false);
  hostAction(room,'start',14000);
  assert.equal(room.pauseDuration,10000);
  assert.equal(room.effects.lava.expiresAt,31000);
  assert.equal(room.status,'live');rooms.delete(room.code);
});
test('reset creates a clean round while preserving room access and connections', () => {
  const room=createRoom(1000),token=room.hostToken;
  applyPlan(room,{effects:[{id:'lava'}]},{name:'Test'},'lava',1000);
  room.receipts.set('old',{ok:true});hostAction(room,'reset',2000);
  assert.equal(room.hostToken,token);assert.equal(room.round,2);assert.equal(room.status,'lobby');
  assert.equal(room.history.length,0);assert.equal(room.totalCommands,0);assert.equal(room.receipts.size,0);
  assert.deepEqual(room.effects,{});rooms.delete(room.code);
});
test('live rule history stays bounded', () => {
  const room=createRoom();
  for(let i=0;i<60;i++)applyPlan(room,{effects:[{id:'ducks'}]},{name:'Test'},'ducks');
  assert.equal(room.history.length,32);assert.equal(room.totalCommands,60);rooms.delete(room.code);
});
test('audience timer powers change authoritative remaining time and reset cleanly', () => {
  const room=createRoom(1000),author={name:'Clock gremlin'};
  hostAction(room,'start',1000);
  const plus=applyPlan(room,{effects:[{id:'timeplus'}]},author,'more time',2000);
  assert.equal(plus.timerDeltaMs,15000);assert.equal(publicRoom(room,2000).roundMs,195000);
  const minus=applyPlan(room,{effects:[{id:'timeminus'}]},author,'steal time',3000);
  assert.equal(minus.timerDeltaMs,-10000);assert.equal(publicRoom(room,3000).roundMs,185000);
  hostAction(room,'lockclock',4000);assert.equal(room.clockLocked,true);
  hostAction(room,'reset',5000);assert.equal(room.timeAdjustmentMs,0);assert.equal(room.clockLocked,false);rooms.delete(room.code);
});
test('timer theft preserves a fifteen-second runway and mercy is capped at five minutes remaining', () => {
  const room=createRoom(1000),author={name:'Test'};hostAction(room,'start',1000);
  for(let i=0;i<40;i++)applyPlan(room,{effects:[{id:'timeminus'}]},author,'steal',2000);
  assert.equal(publicRoom(room,2000).roundMs-1000,15000);
  for(let i=0;i<40;i++)applyPlan(room,{effects:[{id:'timeplus'}]},author,'mercy',2000);
  assert.equal(publicRoom(room,2000).roundMs-1000,300000);rooms.delete(room.code);
});
test('giant duck is one boss duck, not a surprise giant astronaut', () => {
  assert.deepEqual(compileLocal('spawn a giant duck').effects.map(e=>e.id),['duckzilla']);
  assert.equal(compileLocal('remove 10 seconds').effects[0].id,'timeminus');
  assert.equal(compileLocal('remove 10 seconds').effects[0].remove,undefined);
  assert.equal(compileLocal('reverse controls and earthquake').effects.length,2);
});
test('clock theft cannot accidentally grant time when less than fifteen seconds remain', () => {
  const room=createRoom(1000);hostAction(room,'start',1000);
  const event=applyPlan(room,{effects:[{id:'timeminus'}]},{name:'Test'},'steal',177000);
  assert.equal(event.timerDeltaMs,0);assert.equal(room.timeAdjustmentMs,0);rooms.delete(room.code);
});
