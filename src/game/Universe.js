import * as THREE from 'three';
import { CELLS, STONES, SPAWN, ROCKET, HALF_X, HALF_Z, TILE, BANANAS, SPRINGS } from '../../shared/arena.js';

const PALETTE = { navy: 0x253750, stone: 0x879cae, light: 0xd7e2e5, yellow: 0xf6df77, coral: 0xf67f73 };
const clamp = THREE.MathUtils.clamp;
const rand = (min, max) => min + Math.random() * (max - min);
const material = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .72, metalness: .06, ...extra });
const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export class Universe {
  constructor(container, { onProgress = () => {}, preview = false, mobile = false, onError = () => {} } = {}) {
    this.mobile=mobile;this.avatars=new Map();this.networkPlayers=[];this.multiplayer=false;this.ownId=null;this.touchInput={x:0,z:0};
    this.container = container; this.onProgress = onProgress; this.preview = preview;
    this.keys = new Set(); this.objects = []; this.particles = []; this.tiles = [];
    this.effects = {}; this.room = { status: 'lobby' }; this.auto = preview; this.host = preview;
    this.health = 100; this.collected = new Set(); this.playerVelocity = v(); this.playerPosition = v(SPAWN[0], .7, SPAWN[1]);
    this.elapsed = 0; this.lastDamage = -10; this.lastProgress = 0; this.lastMeteor = 0; this.jump = false; this.launchedAt = null; this.autoWaitUntil = 0;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xbfc6e8, 45, 100);
    try { this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' }); }
    catch { onError(); return; }
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile?1.25:1.75));
    this.renderer.shadowMap.enabled = !mobile;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.domElement.setAttribute('aria-label', 'Live 3D universe: Nova the astronaut, floating islands, and a rocket');
    this.renderer.domElement.setAttribute('role', 'img');
    container.appendChild(this.renderer.domElement);
    this.camera = new THREE.OrthographicCamera(-15, 15, 12, -12, .1, 180);
    this.camera.position.set(21, 24, 29); this.camera.lookAt(0, 1.3, 0);
    const hemisphere = new THREE.HemisphereLight(0xf0ecff, 0x536a82, 2.7);
    this.scene.add(hemisphere);
    this.sun = new THREE.DirectionalLight(0xfff4da, 3.6);
    this.sun.position.set(-10, 22, 10); this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1536, 1536);
    Object.assign(this.sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 });
    this.sun.shadow.bias = -.0004; this.sun.shadow.normalBias = .03;
    this.scene.add(this.sun);
    this.buildWorld(); this.buildFun(); this.buildAstronaut(); this.buildRocket(); this.buildEffects();
    this.onKeyDown = e => {
      if (!this.host || /INPUT|TEXTAREA|BUTTON/.test(e.target.tagName) || e.target.isContentEditable) return;
      if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
      if (e.code === 'Space' && !e.repeat) this.jump = true;
      if (['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) this.auto = false;
    };
    this.onKeyUp = e => this.keys.delete(e.code);
    this.onBlur = () => this.keys.clear();
    window.addEventListener('keydown', this.onKeyDown); window.addEventListener('keyup', this.onKeyUp); window.addEventListener('blur', this.onBlur);
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(container); this.resize();
    this.lastTime = performance.now();
    this.frame = this.frame.bind(this); this.raf = requestAnimationFrame(this.frame);
  }
  mesh(geometry, mat, x = 0, y = 0, z = 0, parent = this.scene) {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(x,y,z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  box(x,y,z,color,px,py,pz,parent) { return this.mesh(new THREE.BoxGeometry(x,y,z), material(color),px,py,pz,parent); }
  buildWorld() {
    this.island = new THREE.Group(); this.scene.add(this.island);
    this.box(HALF_X*2+.6,1.1,HALF_Z*2+.6,0x31475d,0,-.85,0,this.island);
    this.box(HALF_X*2+.1,.25,HALF_Z*2+.1,0x657f92,0,-.2,0,this.island);
    for (let x = -HALF_X+TILE/2; x < HALF_X; x += TILE) for (let z = -HALF_Z+TILE/2; z < HALF_Z; z += TILE) {
      const base = new THREE.Color().setHSL(.57 + Math.random()*.025,.15,.59+Math.random()*.045);
      const tile = this.mesh(new THREE.BoxGeometry(TILE-.04,.22,TILE-.04), material(base),x,-.05,z,this.island);
      tile.userData.base = base; this.tiles.push(tile);
    }
    for (let i = 0; i < 12; i++) {
      const rock = this.mesh(new THREE.ConeGeometry(rand(1,2.3),rand(2,4),4),material(i%2 ? 0x34495e : 0x43576b),rand(-7,7),-2.1,rand(-4,4),this.island);
      rock.rotation.z = Math.PI; rock.rotation.y = rand(0,Math.PI);
    }
    this.stones = STONES;
    this.stones.forEach(([x,z,w,d],i) => {
      const stone = this.box(w,.65,d, i===6 ? 0x526b83 : 0xd1dbe0,x,.32,z);
      this.box(w-.12,.07,d-.12, i===6 ? 0x687f94 : 0xe0e6e5,x,.68,z);
      if (i===6) {
        const ring = this.mesh(new THREE.TorusGeometry(1.14,.045,8,48),material(PALETTE.yellow,{emissive: PALETTE.yellow,emissiveIntensity:.6}),x,.74,z);
        ring.rotation.x = -Math.PI/2;
      }
      stone.receiveShadow = true;
    });
    this.bridge = new THREE.Group(); this.scene.add(this.bridge); this.bridge.visible = false;
    const bridgePieces=Math.floor((HALF_X*2-1)/1.1);
    for (let i=0;i<bridgePieces;i++) this.box(1.1,.2,1.25,0xc8dbbd,-(bridgePieces-1)*.55+i*1.1,.53,0,this.bridge);
    const cellPositions = CELLS;
    this.cells = cellPositions.map(([x,z],i) => {
      const group = new THREE.Group(); group.position.set(x,1.25,z);
      this.mesh(new THREE.OctahedronGeometry(.38),material(PALETTE.yellow,{emissive:0xf4ba36,emissiveIntensity:.45}),0,.1,0,group);
      const orbit = this.mesh(new THREE.TorusGeometry(.58,.025,6,24),material(0xfff3ad),0,.12,0,group);
      orbit.rotation.x = Math.PI/2;
      this.scene.add(group); return { group, x, z, i };
    });
    // Coral and crystals give the moon its own silhouette.
    for (const [x,z] of [[-8,-4],[8,4],[-8,1],[3,5],[-3,-5],[8,-5]]) {
      const g = new THREE.Group(); g.position.set(x,0,z); this.scene.add(g);
      for(let j=0;j<3;j++) {
        const crystal = this.mesh(new THREE.ConeGeometry(.2+Math.random()*.16,.7+Math.random()*.8,5),material(j%2?0xd8b8e1:0xeb9d9e),j*.25-.2,.45+j*.12,0,g);
        crystal.rotation.z = (j-1)*.3;
      }
    }
    this.planet = this.mesh(new THREE.SphereGeometry(3,32,24),material(0xaea3d5,{roughness:1}),-13,9,-12);
    const planetRing = this.mesh(new THREE.TorusGeometry(4.3,.07,8,96),material(0xe2d4ec),-13,9,-12);
    planetRing.rotation.set(1.2,.1,-.35);
    const points = [];
    for(let i=0;i<160;i++) points.push(rand(-35,35),rand(3,27),rand(-40,-8));
    const stars = new THREE.BufferGeometry(); stars.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
    this.scene.add(new THREE.Points(stars,new THREE.PointsMaterial({color:0xffffff,size:.09,transparent:true,opacity:.85})));
    for (const [x,z] of [[-13,3],[12,-5],[-7,-12],[11,10]]) {
      const asteroid = this.mesh(new THREE.DodecahedronGeometry(rand(.6,1.4),0),material(0x8595b1),x,-2,z);
      asteroid.rotation.set(rand(0,3),rand(0,3),rand(0,3));
    }
  }
  buildFun() {
    this.bananas=BANANAS.map(([x,z],i)=>{
      const group=new THREE.Group();group.position.set(x,1.2,z);this.scene.add(group);
      this.mesh(new THREE.TorusGeometry(.38,.12,6,14,Math.PI*.95),material(0xffdf42,{emissive:0xe6aa13,emissiveIntensity:.35,metalness:.35}),0,0,0,group);
      this.mesh(new THREE.SphereGeometry(.11,6,6),material(0x725133),.38,0,0,group);
      this.mesh(new THREE.SphereGeometry(.09,6,6),material(0x725133),-.37,.06,0,group);
      const glow=this.mesh(new THREE.TorusGeometry(.7,.025,5,24),material(0xffe89a,{emissive:0xffdf42,emissiveIntensity:.7}),0,-.6,0,group);glow.rotation.x=-Math.PI/2;
      return {group,i};
    });
    this.springPads=SPRINGS.map(([x,z])=>{
      const group=new THREE.Group();group.position.set(x,.08,z);this.scene.add(group);
      this.mesh(new THREE.CylinderGeometry(.85,.95,.16,16),material(0x32456e),0,0,0,group);
      this.mesh(new THREE.CylinderGeometry(.67,.67,.08,16),material(0x9dedc9,{emissive:0x5fd9ba,emissiveIntensity:.4}),0,.13,0,group);
      const ring=this.mesh(new THREE.TorusGeometry(.85,.045,5,28),material(0xf6df77,{emissive:0xf6df77,emissiveIntensity:.7}),0,.2,0,group);ring.rotation.x=-Math.PI/2;
      this.mesh(new THREE.ConeGeometry(.21,.42,4),material(0xf6df77),0,.47,0,group);
      return {group,ring};
    });
  }
  buildAstronaut() {
    this.hero = new THREE.Group(); this.scene.add(this.hero);
    const white = material(0xf5f0df), navy = material(0x1c344d), yellow = material(PALETTE.yellow);
    this.mesh(new THREE.CapsuleGeometry(.3,.42,5,12),white,0,.79,0,this.hero);
    this.mesh(new THREE.SphereGeometry(.44,20,16),white,0,1.45,0,this.hero);
    const visor = this.mesh(new THREE.SphereGeometry(.34,20,12),material(0x234860,{metalness:.55,roughness:.18}),0,1.47,.27,this.hero);
    visor.scale.set(1,.68,.45);
    const glint = this.mesh(new THREE.SphereGeometry(.08,8,6),material(0xc9f1fc),-.15,1.55,.4,this.hero); glint.scale.set(1,.4,.3);
    this.box(.53,.17,.16,PALETTE.yellow,0,.88,.29,this.hero);
    this.box(.45,.57,.25,0xa5b4c0,0,.86,-.3,this.hero);
    this.arms = [-1,1].map(side => {
      const arm = this.mesh(new THREE.CapsuleGeometry(.11,.33,4,8),white,side*.43,.83,0,this.hero); arm.rotation.z = side*.25; return arm;
    });
    this.legs = [-1,1].map(side => {
      const leg = new THREE.Group(); leg.position.set(side*.16,.42,0);
      this.mesh(new THREE.CapsuleGeometry(.12,.18,4,8),white,0,-.05,0,leg);
      this.mesh(new THREE.BoxGeometry(.25,.16,.36),navy,0,-.3,.06,leg);
      this.hero.add(leg); return leg;
    });
    this.mesh(new THREE.CylinderGeometry(.025,.025,.28,6),yellow,.28,1.91,0,this.hero);
    this.mesh(new THREE.SphereGeometry(.055,8,6),material(0xff7d78,{emissive:0xff7d78}),.28,2.08,0,this.hero);
    this.shield = this.mesh(new THREE.SphereGeometry(1.1,24,16),new THREE.MeshPhysicalMaterial({color:0x8ae3ff,transparent:true,opacity:.2,roughness:.05,metalness:.1,depthWrite:false}),0,1,0,this.hero);
    this.shield.visible = false;
    this.hero.position.copy(this.playerPosition);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(.45,24),new THREE.MeshBasicMaterial({color:0x20364b,transparent:true,opacity:.22,depthWrite:false}));
    shadow.rotation.x = -Math.PI/2; this.scene.add(shadow); this.heroShadow = shadow;
  }
  buildRocket() {
    this.rocket = new THREE.Group(); this.rocket.position.set(ROCKET[0],.73,ROCKET[1]); this.scene.add(this.rocket);
    const white = material(0xf7f1dc), red = material(0xf2786b);
    this.mesh(new THREE.CylinderGeometry(.5,.57,2.35,16),white,0,1.6,0,this.rocket);
    this.mesh(new THREE.ConeGeometry(.5,1.08,16),red,0,3.3,0,this.rocket);
    this.mesh(new THREE.CylinderGeometry(.58,.58,.2,16),red,0,1,0,this.rocket);
    for(let i=0;i<3;i++) {
      const fin = this.mesh(new THREE.ConeGeometry(.55,1.15,3),red,Math.sin(i*Math.PI*2/3)*.58,.7,Math.cos(i*Math.PI*2/3)*.58,this.rocket);
      fin.rotation.y = i*Math.PI*2/3;
    }
    const rim = this.mesh(new THREE.TorusGeometry(.26,.07,8,24),material(0x91a4af),0,2.08,.51,this.rocket);
    const glass = this.mesh(new THREE.CircleGeometry(.24,24),material(0x28546e,{metalness:.6,roughness:.2}),0,2.08,.53,this.rocket);
    rim.rotation.x = 0; glass.rotation.x = 0;
    this.flame = this.mesh(new THREE.ConeGeometry(.4,1.7,12),material(0xffc361,{emissive:0xff8e38,emissiveIntensity:2}),0,-.45,0,this.rocket);
    this.flame.rotation.z = Math.PI; this.flame.visible = false;
    this.flameInner = this.mesh(new THREE.ConeGeometry(.22,1.25,10),material(0xffedb3,{emissive:0xffdd85,emissiveIntensity:2}),0,-.3,0,this.rocket);
    this.flameInner.rotation.z = Math.PI; this.flameInner.visible = false;
  }
  buildEffects() {
    this.hole = new THREE.Group(); this.hole.position.set(.5,3,-1); this.hole.visible = false; this.scene.add(this.hole);
    this.mesh(new THREE.SphereGeometry(.7,24,16),new THREE.MeshBasicMaterial({color:0x172039}),0,0,0,this.hole);
    this.holeRings = [1,1.35,1.7].map((r,i) => {
      const ring = this.mesh(new THREE.TorusGeometry(r,.035,8,64),material([0xb39ce6,0xf0b0de,0xffe2aa][i],{emissive:0xc8a0ff,emissiveIntensity:.7}),0,0,0,this.hole);
      ring.rotation.set(1.1+i*.3,i*.4,0); return ring;
    });
    this.particleGeometry = new THREE.BoxGeometry(.07,.07,.07);
    this.particleMaterial = new THREE.MeshBasicMaterial();
    this.particleMesh = new THREE.InstancedMesh(this.particleGeometry,this.particleMaterial,360);
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.scene.add(this.particleMesh); this.particleMesh.count = 0;
    this.dummy = new THREE.Object3D();
    this.windLines = new THREE.Group(); this.scene.add(this.windLines); this.windLines.visible=false;
    for(let i=0;i<14;i++) {
      const line = this.mesh(new THREE.BoxGeometry(rand(1,2.8),.018,.018),new THREE.MeshBasicMaterial({color:0xe2f7fa,transparent:true,opacity:.65}),rand(-10,10),rand(1,5),rand(-5,5),this.windLines);
      line.userData.speed = rand(4,9);
    }
  }
  resize() {
    if(!this.renderer) return;
    const {width,height} = this.container.getBoundingClientRect();
    if(!width || !height) return;
    this.renderer.setSize(width,height);
    const aspect=width/height, span=this.preview?32:30;
    this.camera.left = -span*aspect/2; this.camera.right = span*aspect/2;
    this.camera.top=span/2; this.camera.bottom=-span/2;
    if(aspect<1.15) { this.camera.left=-20; this.camera.right=20; this.camera.top=20/aspect; this.camera.bottom=-20/aspect; }
    if(this.mobile){this.camera.left=-8;this.camera.right=8;this.camera.top=8/aspect;this.camera.bottom=-8/aspect;}
    this.camera.updateProjectionMatrix();
  }
  setRoom(room, host) {
    this.room = room; this.host = host; this.effects = Object.fromEntries(room.effects.map(e => [e.id,e]));
    if(!this.preview && room.players)this.multiplayer=room.players.length>0;
    if(!this.multiplayer && this.networkPlayers.length)this.setArena({players:[],hazards:[]},this.ownId);
    this.container.dataset.effects=Object.keys(this.effects).join(',');
    if(['won','finale'].includes(room.status) && this.launchedAt===null) this.launch();
  }
  setArena(snapshot,ownId) {
    if(!this.renderer)return;
    this.ownId=ownId;this.networkPlayers=snapshot.players||[];this.multiplayer=this.networkPlayers.length>0;
    this.container.dataset.players=String(this.networkPlayers.length);
    const keep=new Set(this.networkPlayers.map(p=>p.id));
    for(const [id,avatar] of this.avatars)if(!keep.has(id)){
      this.scene.remove(avatar.group);avatar.group.traverse(n=>{if(n.isMesh||n.isSprite){n.geometry?.dispose();n.material?.map?.dispose();n.material?.dispose();}});this.avatars.delete(id);
    }
    for(const p of this.networkPlayers){
      let avatar=this.avatars.get(p.id);
      if(!avatar){avatar=this.makeAvatar(p,p.id===ownId);this.avatars.set(p.id,avatar);avatar.group.position.set(p.x,p.y,p.z);}
      if((p.boings||0)>(avatar.target.boings||0))this.burst(v(p.x,p.y+.4,p.z),18,true);
      if((p.bananas?.length||0)>(avatar.target.bananas?.length||0))this.burst(v(p.x,p.y+1,p.z),25,true);
      avatar.target=p;
    }
    if(this.multiplayer){
      this.hero.visible=false;this.heroShadow.visible=false;
      const desired=new Set((snapshot.hazards||[]).map(h=>h.id));
      for(const o of [...this.objects])if(!desired.has(o.networkId))this.removeObject(o);
      for(const h of snapshot.hazards||[]){
        let o=this.objects.find(o=>o.networkId===h.id);
        if(!o){this.spawn(h.type,1);o=this.objects[this.objects.length-1];o.networkId=h.id;o.mesh.position.set(h.x,h.y,h.z);}
        o.target=h;
      }
      const own=this.networkPlayers.find(p=>p.id===ownId);
      this.cells.forEach(c=>c.group.visible=!own?.cells.includes(c.i));
      this.bananas.forEach(c=>c.group.visible=!own?.bananas?.includes(c.i));
    }else if(this.launchedAt===null){this.hero.visible=true;this.heroShadow.visible=true;}
  }
  predictInput(input){this.touchInput=input;this.touchAt=performance.now();}
  makeAvatar(p,own){
    const group=new THREE.Group();this.scene.add(group);
    const white=material(0xf5f0df),accent=material(p.color),navy=material(0x234860);
    this.mesh(new THREE.CapsuleGeometry(.3,.42,4,8),white,0,.79,0,group);
    this.mesh(new THREE.SphereGeometry(.43,12,10),white,0,1.43,0,group);
    const visor=this.mesh(new THREE.SphereGeometry(.32,10,8),navy,0,1.45,.27,group);visor.scale.set(1,.65,.45);
    this.box(.57,.2,.16,p.color,0,.9,.3,group);
    this.mesh(new THREE.CylinderGeometry(.34,.34,.12,10),accent,0,1.12,0,group);
    const legs=[-1,1].map(side=>this.box(.22,.4,.25,0x33465c,side*.16,.26,0,group));
    const ring=this.mesh(new THREE.TorusGeometry(own?.66:.5,own?.055:.025,5,24),new THREE.MeshBasicMaterial({color:p.color}),0,.05,0,group);ring.rotation.x=-Math.PI/2;
    const canvas=document.createElement('canvas');canvas.width=320;canvas.height=64;
    const ctx=canvas.getContext('2d');ctx.fillStyle=own?'#f5e27e':'#142039';ctx.beginPath();ctx.roundRect(0,0,320,64,18);ctx.fill();ctx.fillStyle=own?'#142039':'#ffffff';ctx.font='600 25px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText((own?'YOU · ':'')+p.name.slice(0,18),160,32,300);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    const label=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false}));label.scale.set(3,.6,1);label.position.y=2.75;group.add(label);
    return {group,legs,target:p};
  }
  updateArena(dt){
    const size=this.active('giant')?1.7:this.active('tiny')?.55:1;
    for(const [id,a] of this.avatars){
      const p=a.target,before=a.group.position.clone(),blend=1-Math.exp(-18*dt);
      a.group.position.lerp(v(p.x,p.y,p.z),blend);
      if(id===this.ownId&&this.room.status==='live'&&performance.now()-(this.touchAt||0)<250){
        const i=this.touchInput,reverse=this.active('reverse')?-1:1,speed=4.2*(this.active('slow')?.45:1)*reverse;
        a.group.position.x+=(i.x*.82+i.z*.57)*speed*dt;
        a.group.position.z+=(-i.x*.57+i.z*.82)*speed*dt;
      }
      a.group.rotation.y=p.angle;
      if(this.mobile && id===this.ownId){this.mobileFocus ||= a.group.position.clone();this.mobileFocus.lerp(a.group.position,.12);}
      a.group.scale.lerp(v(size,size,size),.1);a.group.visible=this.launchedAt===null;
      const moving=a.group.position.distanceTo(before)>.003;
      a.legs.forEach((leg,i)=>leg.rotation.x=moving?Math.sin(this.elapsed*12+i*Math.PI)*.45:0);
    }
    for(const o of this.objects)if(o.target){const h=o.target;o.mesh.position.lerp(v(h.x,h.y,h.z),1-Math.exp(-20*dt));if(!['ducks','duckzilla'].includes(o.type))o.mesh.rotation.x+=dt;}
  }
  setAutopilot(value) { this.auto = value; this.keys.clear(); }
  active(id) { return Boolean(this.effects[id] && (this.room.status==='paused' || this.effects[id].expiresAt>Date.now())); }
  command(event) {
    if(!this.renderer) return;
    for(const effect of event.effects) {
      if(effect.remove) {
        if(['ducks','boulders'].includes(effect.id)) this.objects.filter(o=>o.type===effect.id).forEach(o=>this.removeObject(o));
        continue;
      }
      if(!this.multiplayer){
        if(effect.id==='ducks' || effect.id==='boulders') this.spawn(effect.id,effect.count || 4);
        if(effect.id==='duckzilla') this.spawn('duckzilla',1);
        if(effect.id==='earthquake') this.objects.forEach(object=>{object.velocity.y+=3;});
      }
      if(effect.id==='confetti') this.burst(v(0,4,0),90,true);
      if(effect.id==='heal') { this.health=100; this.burst(this.playerPosition.clone().add(v(0,1,0)),35,true); }
    }
    this.burst(this.playerPosition.clone().add(v(0,1,0)),12,true);
    this.sound();
  }
  control(action) {
    if(action==='reset') this.reset();
    if(action==='clear') { this.effects={}; [...this.objects].forEach(o=>this.removeObject(o)); }
    if(action==='won' || action==='finale') this.launch();
  }
  reset() {
    this.effects={}; [...this.objects].forEach(o=>this.removeObject(o));
    this.collected.clear(); this.cells.forEach(c=>c.group.visible=true);
    this.health=100; this.playerPosition.set(SPAWN[0],.7,SPAWN[1]); this.playerVelocity.set(0,0,0); this.autoWaitUntil=0;
    this.hero.visible=true; this.launchedAt=null; this.rocket.position.set(ROCKET[0],.73,ROCKET[1]);
    this.flame.visible=false; this.flameInner.visible=false; this.particles=[]; this.lastDamage=-10;
    this.keys.clear(); this.emitProgress();
  }
  spawn(type, count=4) {
    for(let i=0;i<count;i++) {
      if(this.objects.length>=30) this.removeObject(this.objects[0]);
      const duck=type==='ducks'||type==='duckzilla';
      const radius=type==='duckzilla'?2.4:duck?.48:type==='meteors'?.6:rand(.4,.75);
      let mesh;
      if(duck) {
        mesh=new THREE.Group();
        const body=this.mesh(new THREE.SphereGeometry(.42,12,8),material(0xf6d45d),0,0,0,mesh); body.scale.set(1,.85,1.3);
        this.mesh(new THREE.SphereGeometry(.27,12,8),material(0xfce17c),0,.37,.32,mesh);
        const beak=this.mesh(new THREE.ConeGeometry(.14,.3,4),material(0xf2904d),0,.3,.65,mesh); beak.rotation.x=Math.PI/2;
        [-1,1].forEach(side=>this.mesh(new THREE.SphereGeometry(.033,6,6),material(0x263b50),side*.18,.44,.5,mesh));
      } else {
        const color=type==='meteors'?0xd96b52:[0xb0a2ce,0x8aa4b6,0xe9bd85,0xb5c9ad][Math.floor(Math.random()*4)];
        mesh=new THREE.Mesh(new THREE.DodecahedronGeometry(radius,0),material(color,type==='meteors'?{emissive:0xeb6945,emissiveIntensity:.6}:{}));
        mesh.castShadow=true; mesh.receiveShadow=true;
      }
      if(type==='duckzilla')mesh.scale.setScalar(5);
      mesh.position.set(type==='duckzilla'?0:rand(-7,7),rand(7,12),type==='duckzilla'?0:rand(-4.5,4.5)); this.scene.add(mesh);
      this.objects.push({mesh,type,radius,velocity:v(rand(-2,2),type==='meteors'?-7:rand(-1,2),rand(-2,2)),born:this.elapsed,spin:v(rand(-2,2),rand(-2,2),rand(-2,2))});
    }
  }
  removeObject(object) {
    this.scene.remove(object.mesh);
    object.mesh.traverse(node=>{if(node.isMesh){node.geometry.dispose();node.material.dispose();}});
    this.objects=this.objects.filter(o=>o!==object);
  }
  burst(position,count=24,confetti=false) {
    for(let i=0;i<count;i++) {
      if(this.particles.length>=350) this.particles.shift();
      this.particles.push({position:position.clone(),velocity:v(rand(-3,3),rand(2,7),rand(-3,3)),life:rand(.6,2.5),maxLife:2.5,color:new THREE.Color(confetti?[0xf8df7b,0xfba4ba,0xc6b5f6,0xa8e3d9][i%4]:0xffb65f),scale:confetti?rand(.6,1.8):rand(.5,1.2)});
    }
  }
  sound() {
    if(!this.audio || this.audio.state!=='running') return;
    const osc=this.audio.createOscillator(),gain=this.audio.createGain();
    osc.type='sine'; osc.frequency.setValueAtTime(440,this.audio.currentTime); osc.frequency.exponentialRampToValueAtTime(660,this.audio.currentTime+.12);
    gain.gain.setValueAtTime(.035,this.audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001,this.audio.currentTime+.2);
    osc.connect(gain); gain.connect(this.audio.destination); osc.start(); osc.stop(this.audio.currentTime+.21);
  }
  async setSound(on) {
    if(on) { this.audio ||= new (window.AudioContext || window.webkitAudioContext)(); await this.audio.resume(); }
    else if(this.audio) await this.audio.suspend();
  }
  ground(x,z) {
    let ground=0;
    for(const [px,pz,w,d] of this.stones) if(Math.abs(x-px)<w/2+.12 && Math.abs(z-pz)<d/2+.12) ground=.73;
    if(this.active('bridge') && Math.abs(z)<.65 && Math.abs(x)<HALF_X-.5) ground=Math.max(ground,.65);
    return ground;
  }
  damage(amount) {
    if(amount <= 0 || this.active('shield') || this.elapsed-this.lastDamage<1.2 || this.preview) return;
    this.lastDamage=this.elapsed; this.health=Math.max(0,this.health-amount);
    this.burst(this.playerPosition.clone().add(v(0,.5,0)),15);
    if(this.health===0) { this.playerPosition.set(SPAWN[0],1,SPAWN[1]); this.playerVelocity.set(0,0,0); this.health=100; }
    this.emitProgress();
  }
  emitProgress(won=false) { if(this.host && !this.preview && !this.multiplayer) this.onProgress({cells:this.collected.size,health:this.health,won}); }
  updatePlayer(dt) {
    if(this.launchedAt!==null) return;
    let dx=0,dz=0;
    const playing=this.preview || this.room.status==='live';
    if(playing && this.host) {
      if(this.auto) {
        const target=this.cells.find(c=>!this.collected.has(c.i));
        const tx=target?.x??ROCKET[0],tz=target?.z??ROCKET[1];
        dx=tx-this.playerPosition.x; dz=tz-this.playerPosition.z;
        const length=Math.hypot(dx,dz); if(length>.18){dx/=length;dz/=length;}else{dx=0;dz=0;}
        if(this.elapsed < this.autoWaitUntil){dx=0;dz=0;}
      } else {
        const ax=Number(this.keys.has('KeyD')||this.keys.has('ArrowRight'))-Number(this.keys.has('KeyA')||this.keys.has('ArrowLeft'));
        const az=Number(this.keys.has('KeyS')||this.keys.has('ArrowDown'))-Number(this.keys.has('KeyW')||this.keys.has('ArrowUp'));
        dx=ax*.82+az*.57; dz=-ax*.57+az*.82;
        const length=Math.hypot(dx,dz); if(length>1){dx/=length;dz/=length;}
      }
    }
    if(this.active('reverse')){dx=-dx;dz=-dz;}
    const ease=this.active('ice')?1.5:12;
    const speed=this.auto&&!this.preview?2.4:4.2;
    this.playerVelocity.x=THREE.MathUtils.damp(this.playerVelocity.x,dx*speed,ease,dt);
    this.playerVelocity.z=THREE.MathUtils.damp(this.playerVelocity.z,dz*speed,ease,dt);
    if(this.active('wind')) this.playerVelocity.x+=4*dt;
    if(this.active('blackhole')) {
      const toward=v(.5,0,-1).sub(this.playerPosition); toward.y=0;
      this.playerVelocity.addScaledVector(toward.normalize(),4*dt);
    }
    const floor=this.ground(this.playerPosition.x,this.playerPosition.z);
    const grounded=this.playerPosition.y<=floor+.06 && this.playerVelocity.y<=0;
    const onSpring=SPRINGS.some(([x,z])=>Math.hypot(this.playerPosition.x-x,this.playerPosition.z-z)<.95);
    if(playing && grounded && (onSpring || this.jump || this.auto && (this.active('lava') || this.active('trampoline') || this.elapsed%3<.08))) {
      this.playerVelocity.y=onSpring?(this.active('moon')?7.5:12.5):this.active('trampoline')?11:this.active('moon')?5.4:6.8;
      this.jump=false;
    } else if(grounded) { this.playerPosition.y=floor; this.playerVelocity.y=0; }
    const gravity=this.active('moon')?3.3:this.active('heavy')?25:14;
    this.playerVelocity.y-=gravity*dt;
    const previousY=this.playerPosition.y;
    this.playerPosition.addScaledVector(this.playerVelocity,dt);
    const newFloor=this.ground(this.playerPosition.x,this.playerPosition.z);
    if(Math.abs(this.playerPosition.x)<HALF_X && Math.abs(this.playerPosition.z)<HALF_Z && this.playerPosition.y<newFloor && previousY>=newFloor-.22) {
      this.playerPosition.y=newFloor; this.playerVelocity.y=0;
      if(this.active('trampoline') && playing) this.playerVelocity.y=11;
    }
    if(Math.abs(this.playerPosition.x)>HALF_X+.5 || Math.abs(this.playerPosition.z)>HALF_Z+.5 || this.playerPosition.y< -4) {
      this.damage(25); this.playerPosition.set(SPAWN[0],1,SPAWN[1]); this.playerVelocity.set(0,0,0);
    }
    if(playing && this.active('lava') && this.playerPosition.y<.28) this.damage(12);
    if(playing) for(const cell of this.cells) {
      if(!this.collected.has(cell.i) && Math.hypot(this.playerPosition.x-cell.x,this.playerPosition.z-cell.z)<1.1 && Math.abs(this.playerPosition.y-.8)<2) {
        this.collected.add(cell.i); cell.group.visible=false;
        if(this.auto&&!this.preview)this.autoWaitUntil=this.elapsed+15;
        this.burst(cell.group.position,35,true); this.sound(); this.emitProgress();
      }
    }
    if(playing && this.collected.size===3 && Math.hypot(this.playerPosition.x-ROCKET[0],this.playerPosition.z-ROCKET[1])<1.4) {
      if(this.preview) { this.collected.clear(); this.cells.forEach(c=>c.group.visible=true); this.playerPosition.set(SPAWN[0],.8,SPAWN[1]); }
      else { this.emitProgress(true); this.launch(); }
    }
    const size=this.active('giant')?1.7:this.active('tiny')?.55:1;
    this.hero.scale.lerp(v(size,size,size),.1);
    this.hero.position.copy(this.playerPosition);
    if(Math.hypot(dx,dz)>.1) {
      const targetAngle=Math.atan2(dx,dz); let delta=targetAngle-this.hero.rotation.y; delta=Math.atan2(Math.sin(delta),Math.cos(delta)); this.hero.rotation.y+=delta*.2;
      this.legs.forEach((leg,i)=>leg.rotation.x=Math.sin(this.elapsed*11+i*Math.PI)*.5);
      this.arms.forEach((arm,i)=>arm.rotation.x=Math.sin(this.elapsed*11-i*Math.PI)*.35);
    } else this.legs.forEach(leg=>leg.rotation.x*=.8);
    this.hero.visible=!(this.elapsed-this.lastDamage<.5 && Math.floor(this.elapsed*16)%2===0);
    this.shield.visible=this.active('shield');
    this.shield.material.opacity=.16+Math.sin(this.elapsed*3)*.04;
    this.heroShadow.position.set(this.playerPosition.x,this.ground(this.playerPosition.x,this.playerPosition.z)+.02,this.playerPosition.z);
  }
  updateObjects(dt) {
    for(const o of [...this.objects]) {
      const gravity=this.active('moon')?3.3:this.active('heavy')?25:13;
      o.velocity.y-=gravity*dt;
      if(this.active('wind')) o.velocity.x+=4*dt;
      if(this.active('blackhole')) {
        const toward=this.hole.position.clone().sub(o.mesh.position);
        o.velocity.addScaledVector(toward.normalize(),9*dt);
      }
      o.mesh.position.addScaledVector(o.velocity,dt);
      o.mesh.rotation.x+=o.spin.x*dt; o.mesh.rotation.z+=o.spin.z*dt;
      if(o.type==='ducks'||o.type==='duckzilla') o.mesh.rotation.x=0;
      const p=o.mesh.position, floor=this.ground(p.x,p.z)+o.radius;
      if(Math.abs(p.x)<HALF_X && Math.abs(p.z)<HALF_Z && p.y<floor && o.velocity.y<0) {
        if(o.type==='meteors') { this.burst(p,22); this.damage(Math.hypot(p.x-this.playerPosition.x,p.z-this.playerPosition.z)<2?15:0); this.removeObject(o); continue; }
        p.y=floor; o.velocity.y=Math.max(Math.abs(o.velocity.y)*(o.type==='boulders'?.86:.68),this.active('trampoline')?8:1.4);
      }
      const delta=this.playerPosition.clone().add(v(0,.7,0)).sub(p);
      if(delta.length()<o.radius+.55 && this.room.status==='live') { this.damage(o.type==='ducks'?3:10); delta.y=0; this.playerVelocity.addScaledVector(delta.normalize(),2.5); }
      if(p.y< -12 || this.elapsed-o.born>35) this.removeObject(o);
    }
    for(let i=0;i<this.objects.length;i++) for(let j=i+1;j<this.objects.length;j++) {
      const a=this.objects[i],b=this.objects[j],delta=a.mesh.position.clone().sub(b.mesh.position),distance=delta.length(),limit=a.radius+b.radius;
      if(distance>0 && distance<limit) {
        delta.divideScalar(distance); const overlap=(limit-distance)*.5;
        a.mesh.position.addScaledVector(delta,overlap); b.mesh.position.addScaledVector(delta,-overlap);
        const speed=a.velocity.clone().sub(b.velocity).dot(delta);
        if(speed<0){a.velocity.addScaledVector(delta,-speed*.85);b.velocity.addScaledVector(delta,speed*.85);}
      }
    }
  }
  launch() {
    if(this.launchedAt!==null) return;
    this.launchedAt=this.elapsed; this.flame.visible=true; this.flameInner.visible=true;
    this.hero.visible=false; this.burst(v(ROCKET[0],2,ROCKET[1]),100,true); this.sound();
  }
  updateVisuals(dt) {
    const shake=this.active('earthquake')?.24:0;
    const focus=this.mobileFocus||v();
    this.camera.position.set(21+focus.x+Math.sin(this.elapsed*57)*shake,24+(this.mobile?focus.y*.6:0)+Math.cos(this.elapsed*43)*shake*.6,29+focus.z+Math.sin(this.elapsed*39)*shake);
    if(this.mobile)this.camera.lookAt(focus.x,1.3+focus.y*.6,focus.z);
    const lava=this.active('lava'),ice=this.active('ice'),disco=this.active('disco');
    this.tiles.forEach((tile,i)=>{
      const color=disco?new THREE.Color().setHSL((this.elapsed*.08+i*.035)%1,.5,.63):new THREE.Color(lava?0xef7558:ice?0xafe7ed:tile.userData.base);
      tile.material.color.lerp(color,.09);
      tile.material.emissive.set(lava?0x9b2f16:disco?color:0x000000); tile.material.emissiveIntensity=lava?.25+Math.sin(this.elapsed*3+i)*.1:disco?.15:0;
    });
    this.bridge.visible=this.active('bridge'); this.hole.visible=this.active('blackhole'); this.windLines.visible=this.active('wind');
    this.holeRings.forEach((r,i)=>r.rotation.z=this.elapsed*(i%2?-.8:.5));
    this.windLines.children.forEach(line=>{line.position.x+=line.userData.speed*dt;if(line.position.x>11)line.position.x=-11;});
    this.cells.forEach(cell=>{cell.group.rotation.y=this.elapsed*.8;cell.group.position.y=1.4+Math.sin(this.elapsed*2+cell.i)*.18;});
    this.bananas.forEach(b=>{b.group.rotation.y=this.elapsed*1.1+b.i;b.group.position.y=1.2+Math.sin(this.elapsed*2+b.i)*.2;});
    this.springPads.forEach((p,i)=>p.ring.scale.setScalar(1+Math.sin(this.elapsed*4+i)*.08));
    if(lava && Math.random()<dt*12) this.burst(v(rand(-8,8),.1,rand(-5,5)),2);
    if(!this.multiplayer && this.active('meteors') && this.elapsed-this.lastMeteor>.7 && this.room.status!=='paused') {this.spawn('meteors',1);this.lastMeteor=this.elapsed;}
    if(this.launchedAt!==null) {
      const t=this.elapsed-this.launchedAt;
      this.rocket.position.y=.73+t*t*1.1; this.rocket.rotation.z=Math.sin(t*16)*.008;
      this.flame.scale.y=.8+Math.random()*.55; this.flameInner.scale.y=.9+Math.random()*.3;
      if(t<3 && Math.random()<.4) this.burst(v(ROCKET[0],.5,ROCKET[1]),3);
    }
    const alive=[];
    for(const p of this.particles) {
      p.life-=dt; if(p.life<=0) continue;
      p.velocity.y-=5*dt; p.position.addScaledVector(p.velocity,dt);
      const i=alive.length;this.dummy.position.copy(p.position);this.dummy.rotation.set(this.elapsed*2+i,i,this.elapsed);
      this.dummy.scale.setScalar(p.scale*Math.min(1,p.life*2));this.dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i,this.dummy.matrix);this.particleMesh.setColorAt(i,p.color);alive.push(p);
    }
    this.particles=alive;this.particleMesh.count=alive.length;this.particleMesh.instanceMatrix.needsUpdate=true;if(this.particleMesh.instanceColor)this.particleMesh.instanceColor.needsUpdate=true;
  }
  frame(now) {
    if(!this.renderer) return;
    const realDt=Math.min((now-this.lastTime)/1000,.05);this.lastTime=now;
    const paused=this.room.status==='paused';
    const dt=paused?0:realDt*(this.active('slow')?.45:1);
    this.elapsed+=dt;
    if(this.multiplayer)this.updateArena(paused?0:realDt);
    else if(!paused && !['ended'].includes(this.room.status)) {this.updatePlayer(dt);this.updateObjects(dt);}
    this.updateVisuals(dt);
    if(this.elapsed-this.lastProgress>.7){this.emitProgress();this.lastProgress=this.elapsed;}
    this.renderer.render(this.scene,this.camera);
    this.raf=requestAnimationFrame(this.frame);
  }
  dispose() {
    cancelAnimationFrame(this.raf);this.resizeObserver?.disconnect();
    window.removeEventListener('keydown',this.onKeyDown);window.removeEventListener('keyup',this.onKeyUp);window.removeEventListener('blur',this.onBlur);
    this.scene?.traverse(node=>{if(node.isMesh || node.isPoints){node.geometry?.dispose();if(Array.isArray(node.material))node.material.forEach(m=>m.dispose());else node.material?.dispose();}});
    this.renderer?.dispose();this.renderer?.domElement.remove();this.audio?.close();
  }
}
