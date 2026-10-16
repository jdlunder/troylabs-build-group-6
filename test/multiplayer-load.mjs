import assert from 'node:assert/strict';
import { io } from 'socket.io-client';
import { createApplication } from '../server/index.js';
import { SPAWN } from '../shared/arena.js';

let application,base=process.argv[2];const clients=[];
if(!base){application=await createApplication();await new Promise(r=>application.http.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+application.http.address().port;}
const ack=(s,event,data)=>new Promise((resolve,reject)=>s.timeout(8000).emit(event,data,(e,r)=>e?reject(e):resolve(r)));
async function join(data){const s=io(base,{transports:['websocket'],forceNew:true});clients.push(s);await new Promise((r,j)=>{s.once('connect',r);s.once('connect_error',j);});const result=await ack(s,'room:join',data);assert.equal(result.ok,true,result.error);return {s,result};}
try{
  const room=await(await fetch(base+'/api/rooms',{method:'POST'})).json();
  const host=await join({code:room.code,hostToken:room.hostToken,clientId:'race-host'});
  const players=await Promise.all(Array.from({length:40},(_,i)=>join({code:room.code,role:'player',name:'Racer '+(i+1),clientId:'race-'+i})));
  const god=await join({code:room.code,role:'god',name:'Chaos load tester',clientId:'race-god'});
  let latest,frames=0;host.s.on('arena:state',s=>{latest=s;frames++;});
  await ack(host.s,'host:action',{action:'start'});
  const latency=await Promise.all(players.map(async({s},i)=>{const start=performance.now();const r=await ack(s,'player:input',{x:i%2?1:-1,z:0,jump:i%3===0});assert.equal(r.ok,true);return performance.now()-start;}));
  const effect=await ack(god.s,'world:command',{text:'moon gravity and rain 8 ducks and disco and lava',requestId:'race-chaos'});assert.equal(effect.ok,true,effect.error);
  await new Promise(r=>setTimeout(r,700));
  assert.equal(latest.players.length,40);assert.equal(latest.hazards.length,8);assert.ok(frames>=3);assert.ok(Math.abs(latest.players.find(p=>p.id===players[0].result.participant.id).x-SPAWN[0])>.2);
  assert.equal((await ack(god.s,'player:input',{x:1,z:0})).ok,false);
  assert.equal((await ack(players[0].s,'world:command',{text:'lava',requestId:'not-a-god'})).ok,false);
  await ack(host.s,'host:action',{action:'pause'});await new Promise(r=>setTimeout(r,130));const paused=latest.players.map(p=>[p.x,p.y,p.z]);await new Promise(r=>setTimeout(r,200));assert.deepEqual(latest.players.map(p=>[p.x,p.y,p.z]),paused);
  await ack(host.s,'host:action',{action:'reset'});await new Promise(r=>setTimeout(r,150));assert.equal(latest.players.length,40);assert.ok(latest.players.every(p=>p.cells.length===0&&p.health===100));assert.equal(latest.hazards.length,0);
  const sorted=latency.sort((a,b)=>a-b);console.log(JSON.stringify({result:'PASS',base,simultaneousPlayers:40,godmodeControllers:1,arenaFramesObserved:frames,sharedHazards:8,checks:['independent movement','shared hazards','role permissions','pause freezes all players','reset retains all players'],inputAckMs:{median:+sorted[19].toFixed(1),p95:+sorted[37].toFixed(1)}},null,2));
}finally{clients.forEach(s=>s.disconnect());if(application)await application.close();}
