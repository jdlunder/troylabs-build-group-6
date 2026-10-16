import { randomUUID } from 'node:crypto';
import { CELLS as cells, STONES as stones, SPAWN, ROCKET, HALF_X, HALF_Z } from '../shared/arena.js';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function active(room,id,now){return Boolean(room.effects[id]&&room.effects[id].expiresAt>now);}
function ground(room,x,z,now){
  let floor=0;
  for(const [px,pz,w,d] of stones)if(Math.abs(x-px)<w/2+.12&&Math.abs(z-pz)<d/2+.12)floor=.73;
  if(active(room,'bridge',now)&&Math.abs(z)<.65&&Math.abs(x)<HALF_X-.5)floor=Math.max(floor,.65);
  return floor;
}
export function createPlayer(participant,seat=0){
  return {id:participant.id,name:participant.name,color:participant.color,seat,x:SPAWN[0]+(seat%8)*.6,y:.75,z:SPAWN[1]+Math.floor(seat/8)*.48,vx:0,vy:0,vz:0,angle:0,health:100,wins:participant.wins||0,falls:0,collected:new Set(),input:{x:0,z:0,jump:false},inputAt:0,jumpQueued:false,lastDamage:0,connected:true};
}
export function setPlayerInput(player,input,now=Date.now()){
  if(!Number.isFinite(input.x)||!Number.isFinite(input.z))return false;
  if(input.jump===true&&!player.input.jump)player.jumpQueued=true;
  player.input={x:clamp(input.x,-1,1),z:clamp(input.z,-1,1),jump:input.jump===true};player.inputAt=now;return true;
}
function damage(room,p,amount,now){
  if(!amount||active(room,'shield',now)||now-p.lastDamage<1200)return;
  p.lastDamage=now;p.health=Math.max(0,p.health-amount);
  if(p.health===0){p.health=100;p.x=SPAWN[0];p.y=1;p.z=SPAWN[1];p.vx=p.vy=p.vz=0;}
}
function spawn(room,type,count,now){
  for(let i=0;i<count;i++){
    if(room.hazards.length>=30)room.hazards.shift();
    room.hazards.push({id:randomUUID(),type,x:(Math.random()-.5)*(HALF_X*1.6),y:6+Math.random()*4,z:(Math.random()-.5)*(HALF_Z*1.6),vx:(Math.random()-.5)*3,vy:0,vz:(Math.random()-.5)*3,radius:type==='duckzilla'?2.4:type==='ducks'?.48:.65,born:now});
  }
}
export function applyArenaCommand(room,plan,now=Date.now()){
  for(const e of plan.effects){
    if(e.remove){room.hazards=room.hazards.filter(h=>h.type!==e.id);continue;}
    if(['duckzilla','ducks','boulders'].includes(e.id))spawn(room,e.id,e.id==='duckzilla'?1:e.count||4,now);
    if(e.id==='heal')for(const p of room.players.values())p.health=100;
    if(e.id==='earthquake')for(const h of room.hazards)h.vy+=3;
  }
}
export function resetArena(room){
  room.winner=null;room.hazards=[];room.lastMeteor=0;
  for(const [id,p] of room.players){const fresh=createPlayer(p,p.seat);Object.assign(p,fresh,{connected:p.connected});room.players.set(id,p);}
}
export function stepArena(room,realDt,now=Date.now()){
  if(room.status!=='live'||room.winner)return;
  const dt=realDt*(active(room,'slow',now)?.45:1),moon=active(room,'moon',now),gravity=moon?3.3:active(room,'heavy',now)?25:14;
  for(const p of room.players.values()){
    if(p.connected===false)continue;
    const input=now-p.inputAt<700?p.input:{x:0,z:0,jump:false};
    let dx=input.x*.82+input.z*.57,dz=-input.x*.57+input.z*.82;
    const length=Math.hypot(dx,dz);if(length>1){dx/=length;dz/=length;}
    if(active(room,'reverse',now)){dx=-dx;dz=-dz;}
    const damping=1-Math.exp(-(active(room,'ice',now)?1.5:12)*dt);
    p.vx+=(dx*4.2-p.vx)*damping;p.vz+=(dz*4.2-p.vz)*damping;
    if(active(room,'wind',now))p.vx+=4*dt;
    if(active(room,'blackhole',now)){const hx=.5-p.x,hz=-1-p.z,d=Math.max(.1,Math.hypot(hx,hz));p.vx+=hx/d*4*dt;p.vz+=hz/d*4*dt;}
    const floor=ground(room,p.x,p.z,now),grounded=p.y<=floor+.06&&p.vy<=0;
    if(grounded){p.y=floor;p.vy=0;if(p.jumpQueued||input.jump||active(room,'trampoline',now))p.vy=active(room,'trampoline',now)?11:moon?5.4:6.8;}
    p.jumpQueued=false;p.vy-=gravity*dt;const previousY=p.y;
    p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;
    const nextFloor=ground(room,p.x,p.z,now);
    if(Math.abs(p.x)<HALF_X&&Math.abs(p.z)<HALF_Z&&p.y<nextFloor&&previousY>=nextFloor-.22){p.y=nextFloor;p.vy=0;}
    if(Math.abs(p.x)>HALF_X+.5||Math.abs(p.z)>HALF_Z+.5||p.y< -4){p.falls++;damage(room,p,25,now);p.x=SPAWN[0];p.y=1;p.z=SPAWN[1];p.vx=p.vy=p.vz=0;}
    if(active(room,'lava',now)&&p.y<.28)damage(room,p,12,now);
    if(length>.1)p.angle=Math.atan2(dx,dz);
    cells.forEach(([x,z],i)=>{if(Math.hypot(p.x-x,p.z-z)<1.1&&Math.abs(p.y-.8)<2)p.collected.add(i);});
    if(p.collected.size===3&&Math.hypot(p.x-ROCKET[0],p.z-ROCKET[1])<1.4){p.wins++;room.winner={id:p.id,name:p.name,color:p.color,wins:p.wins,title:'Rocket royalty'};break;}
  }
  if(active(room,'meteors',now)&&now-room.lastMeteor>700){spawn(room,'meteors',1,now);room.lastMeteor=now;}
  const remaining=[];
  for(const h of room.hazards){
    h.vy-=gravity*dt;
    if(active(room,'wind',now))h.vx+=4*dt;
    if(active(room,'blackhole',now)){const dx=.5-h.x,dz=-1-h.z,d=Math.max(.1,Math.hypot(dx,dz));h.vx+=dx/d*9*dt;h.vz+=dz/d*9*dt;}
    h.x+=h.vx*dt;h.y+=h.vy*dt;h.z+=h.vz*dt;
    const floor=ground(room,h.x,h.z,now)+h.radius;
    if(Math.abs(h.x)<HALF_X&&Math.abs(h.z)<HALF_Z&&h.y<floor&&h.vy<0){
      if(h.type==='meteors'){for(const p of room.players.values())if(Math.hypot(p.x-h.x,p.z-h.z)<2)damage(room,p,15,now);continue;}
      h.y=floor;h.vy=Math.max(Math.abs(h.vy)*(h.type==='boulders'?.86:.68),active(room,'trampoline',now)?8:1.4);
    }
    for(const p of room.players.values()){
      const dx=p.x-h.x,dz=p.z-h.z,d=Math.hypot(dx,dz);
      if(Math.hypot(d,p.y+.7-h.y)<h.radius+.55){damage(room,p,h.type==='ducks'?3:10,now);p.vx+=dx/Math.max(.1,d)*2.5;p.vz+=dz/Math.max(.1,d)*2.5;}
    }
    if(h.y> -12&&now-h.born<35000)remaining.push(h);
  }
  room.hazards=remaining;
}
export function arenaSnapshot(room){
  const round=n=>Math.round(n*1000)/1000;
  return {round:room.round,at:Date.now(),players:[...room.players.values()].filter(p=>p.connected!==false).map(p=>({id:p.id,name:p.name,color:p.color,x:round(p.x),y:round(p.y),z:round(p.z),angle:p.angle,health:p.health,wins:p.wins,falls:p.falls,cells:[...p.collected]})),hazards:room.hazards.map(h=>({id:h.id,type:h.type,x:round(h.x),y:round(h.y),z:round(h.z)})),winner:room.winner||null};
}
