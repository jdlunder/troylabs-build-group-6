import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer, setPlayerInput, stepArena, arenaSnapshot, resetArena, applyArenaCommand } from '../server/multiplayer.js';
import { createApplication } from '../server/index.js';
import { io } from 'socket.io-client';

function arena(){return {status:'live',players:new Map(),hazards:[],effects:{},lastMeteor:0};}
function player(room,id){const p=createPlayer({id,name:id,color:'#f9dc7b'},room.players.size);room.players.set(id,p);return p;}
test('two phone players move independently and stale input stops movement',()=>{
  const room=arena(),a=player(room,'alice'),b=player(room,'bob'),bx=b.x;
  setPlayerInput(a,{x:1,z:0},1000);
  for(let i=0;i<10;i++)stepArena(room,.05,1000+i*50);
  assert.ok(a.x>-6);assert.equal(b.x,bx);
  stepArena(room,.05,2000);const vx=a.vx;
  for(let i=0;i<20;i++)stepArena(room,.05,2050+i*50);
  assert.ok(Math.abs(a.vx)<Math.abs(vx));
});
test('phone input is bounded and a paused arena freezes all players',()=>{
  const room=arena(),p=player(room,'alice');
  assert.equal(setPlayerInput(p,{x:Infinity,z:0},1000),false);
  assert.equal(setPlayerInput(p,{x:100,z:-100,jump:true},1000),true);
  assert.equal(p.input.x,1);assert.equal(p.input.z,-1);
  room.status='paused';const before=[p.x,p.y,p.z];stepArena(room,.05,1050);
  assert.deepEqual([p.x,p.y,p.z],before);
});
test('each player collects their own cells and only reaching the rocket wins',()=>{
  const room=arena(),a=player(room,'alice'),b=player(room,'bob');
  for(const [x,z] of [[-5,-3],[0,3],[4,-3]]){a.x=x;a.z=z;a.y=.8;stepArena(room,.01,1000);}
  assert.equal(a.collected.size,3);assert.equal(b.collected.size,0);assert.equal(room.winner,undefined);
  a.x=7;a.z=0;stepArena(room,.01,1100);assert.equal(room.winner.name,'alice');
});
test('shared hazards, healing and reset affect the multiplayer arena',()=>{
  const room=arena(),p=player(room,'alice');p.health=30;
  applyArenaCommand(room,{effects:[{id:'duckzilla'},{id:'heal'}]},1000);
  assert.equal(room.hazards.length,1);assert.equal(room.hazards[0].type,'duckzilla');assert.equal(p.health,100);
  p.collected.add(0);resetArena(room);
  assert.equal(room.hazards.length,0);assert.equal(p.collected.size,0);assert.equal(room.players.size,1);
  const snapshot=arenaSnapshot(room);assert.equal(snapshot.players[0].id,'alice');assert.equal('input' in snapshot.players[0],false);
});
test('real sockets assign player roles, relay the arena, reject god movement and preserve reconnects',async()=>{
  const app=await createApplication(),clients=[];
  await new Promise(resolve=>app.http.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+app.http.address().port;
  const ack=(s,event,payload)=>new Promise((resolve,reject)=>s.timeout(2500).emit(event,payload,(err,r)=>err?reject(err):resolve(r)));
  async function join(code,role,clientId,hostToken){const s=io(base,{transports:['websocket'],forceNew:true});clients.push(s);await new Promise(resolve=>s.on('connect',resolve));return {s,result:await ack(s,'room:join',{code,role,clientId,name:clientId,hostToken})};}
  try{
    const room=await(await fetch(base+'/api/rooms',{method:'POST'})).json();
    const host=await join(room.code,'god','host',room.hostToken),a=await join(room.code,'player','alice'),b=await join(room.code,'player','bob'),god=await join(room.code,'god','zeus');
    assert.equal(a.result.participant.role,'player');assert.equal(a.result.arena.players.length,1);assert.equal(b.result.arena.players.length,2);
    assert.equal((await ack(god.s,'player:input',{x:1,z:0})).ok,false);
    await ack(host.s,'host:action',{action:'start'});
    const observed=new Promise(resolve=>b.s.once('arena:state',resolve));
    assert.equal((await ack(a.s,'player:input',{x:1,z:0,jump:true})).ok,true);
    const snapshot=await observed;assert.equal(snapshot.players.length,2);
    await new Promise(resolve=>setTimeout(resolve,250));
    const state=await(await fetch(base+'/api/rooms/'+room.code)).json();assert.equal(state.players.length,2);assert.equal(state.gods,1);
    a.s.disconnect();const again=await join(room.code,'player','alice');assert.equal(again.result.arena.players.filter(p=>p.name==='alice').length,1);
    assert.ok(again.result.arena.players.find(p=>p.name==='alice').x>-6.6);
    await ack(host.s,'host:action',{action:'reset'});assert.equal((await(await fetch(base+'/api/rooms/'+room.code)).json()).players.length,2);
  }finally{clients.forEach(s=>s.disconnect());await app.close();}
});
