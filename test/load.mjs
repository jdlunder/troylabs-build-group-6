import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { io } from 'socket.io-client';
import { createApplication } from '../server/index.js';

let application,base=process.argv[2];
if(!base) {
  application=await createApplication();
  await new Promise(resolve=>application.http.listen(0,'127.0.0.1',resolve));
  base='http://127.0.0.1:'+application.http.address().port;
}
const clients=[];
const ack=async(socket,event,payload)=>{
  try { return await socket.timeout(12000).emitWithAck(event,payload); }
  catch(error) { throw new Error(event+': '+error.message); }
};
async function connect(payload) {
  const socket=io(base,{transports:['websocket'],forceNew:true,reconnection:false,timeout:15000});
  clients.push(socket);
  await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});
  const result=await ack(socket,'room:join',payload);
  assert.equal(result.ok,true,result.error);
  return {socket,result};
}
try {
  const response=await fetch(base+'/api/rooms',{method:'POST'});
  assert.equal(response.status,201);
  const {code,hostToken}=await response.json();
  const {socket:host}=await connect({code,clientId:'load-presenter',name:'Presenter',hostToken});
  console.log('Presenter connected.');
  let received=0;host.on('world:event',()=>received++);
  const audience=await Promise.all(Array.from({length:40},(_,i)=>connect({code,name:'Load tester '+(i+1),clientId:'load-'+i})));
  console.log('40 audience clients connected.');
  await ack(host,'host:action',{action:'start'});
  const rules=['floor is lava','moon gravity','rain ducks','bouncy boulders','bubble shield','disco','build a bridge','confetti'];
  const latencies=await Promise.all(audience.map(async ({socket},i)=>{
    const start=performance.now();
    const result=await ack(socket,'world:command',{text:rules[i%rules.length],requestId:'command-'+i});
    assert.equal(result.ok,true,result.error);
    return performance.now()-start;
  }));
  console.log('40 commands acknowledged.');
  let state=await (await fetch(base+'/api/rooms/'+code)).json();
  assert.equal(state.totalCommands,40);
  assert.equal(state.audience,40);
  assert.equal(received,40,'The stage must receive every command');
  assert.equal(state.history.length,32);
  assert.equal('hostToken' in state,false);
  const duplicate=await ack(audience[0].socket,'world:command',{text:rules[0],requestId:'command-0'});
  assert.equal(duplicate.ok,true);
  state=await (await fetch(base+'/api/rooms/'+code)).json();
  assert.equal(state.totalCommands,40,'Retry must not apply the same rule twice');
  const unauthorized=await ack(audience[0].socket,'host:action',{action:'reset'});
  assert.equal(unauthorized.ok,false);
  audience[0].socket.emit('world:progress',{cells:3,health:100,won:true});
  await ack(audience[0].socket,'host:action',{action:'finale'});
  state=await (await fetch(base+'/api/rooms/'+code)).json();
  assert.equal(state.progress.cells,0);
  assert.equal(state.status,'live');
  await ack(host,'host:action',{action:'pause'});
  const paused=await ack(audience[1].socket,'world:command',{text:'lava',requestId:'paused'});
  assert.equal(paused.ok,false);assert.match(paused.error,/paused/);
  await ack(host,'host:action',{action:'start'});
  audience[39].socket.disconnect();
  const {socket:reconnected,result:reconnect}=await connect({code,name:'Load tester 40',clientId:'load-39'});
  assert.equal(reconnect.room.totalCommands,40);
  assert.equal(reconnect.room.audience,40);
  assert.equal(reconnect.host,false);
  assert.ok(reconnected.connected);
  audience[0].socket.emit('room:join',null);
  const health=await (await fetch(base+'/api/health')).json();
  assert.equal(health.ok,true,'Malformed messages must not crash the server');
  await ack(host,'host:action',{action:'reset'});
  state=await (await fetch(base+'/api/rooms/'+code)).json();
  assert.equal(state.totalCommands,0);assert.equal(state.history.length,0);assert.equal(state.effects.length,0);assert.equal(state.status,'lobby');
  const sorted=latencies.sort((a,b)=>a-b);
  console.log(JSON.stringify({base,audienceClients:40,deliveredToStage:received,checks:'delivery, bounded history, duplicate protection, private host capability, guest progress rejection, pause/resume, reconnect, malformed messages, clean reset',ackMs:{min:+sorted[0].toFixed(1),median:+sorted[19].toFixed(1),p95:+sorted[37].toFixed(1),max:+sorted[39].toFixed(1)}},null,2));
} finally {
  clients.forEach(socket=>socket.disconnect());
  if(application)await application.close();
}
