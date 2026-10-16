import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { io } from 'socket.io-client';
import QRCode from 'qrcode';
import { ArrowUpRight, ArrowRight, ArrowLeft, ArrowDownToLine, ArrowUpFromLine, Bird, Check, CheckCheck, ChevronRight, CircleDot, Copy, Eclipse, Flame, Heart, Maximize, Maximize2, Minimize, Moon, MoveHorizontal, Orbit, PartyPopper, Pause, Play, Radio, Rocket, RotateCcw, Shield, Smartphone, Snowflake, Sparkles, Timer, Users, Volume2, VolumeX, WandSparkles, Wind, X, Zap, Keyboard, Link2, HelpCircle } from 'lucide-react';
import '@fontsource-variable/space-grotesk';
import '@fontsource/dm-mono/400.css';
import '@fontsource/dm-mono/500.css';
import { EFFECTS, QUICK_CHAOS, QUICK_HELP, ROUND_MS } from '../shared/catalog.js';
import './style.css';

const ICONS = { ArrowDownToLine, ArrowUpFromLine, Bird, CircleDot, Eclipse, Flame, Heart, Maximize, Minimize, Moon, MoveHorizontal, Orbit, PartyPopper, Shield, Snowflake, Sparkles, Timer, Wind };
function EffectIcon({ id, size=18, ...props }) { const Icon = ICONS[EFFECTS[id]?.icon] || Sparkles; return <Icon size={size} aria-hidden="true" {...props}/>; }
function Mark({ small=false }) { return <svg className={small?'mark small':'mark'} viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="m24 5 5 14 14 5-14 5-5 14-5-14L5 24l14-5z" fill="currentColor"/><ellipse cx="24" cy="24" rx="23" ry="9" stroke="currentColor" strokeWidth="1.7" transform="rotate(-35 24 24)"/></svg>; }
function Brand({ dark=false, onClick }) { return <button className={'brand '+(dark?'dark':'')} onClick={onClick} aria-label="GODMODE home"><Mark/><span>godmode<span className="brand-period">.</span></span></button>; }
function navigate(path) { window.history.pushState({},'',path); window.dispatchEvent(new PopStateEvent('popstate')); }
const uid = () => globalThis.crypto?.randomUUID?.() || Date.now().toString(36)+Math.random().toString(36).slice(2);
function clientId() { let id=sessionStorage.getItem('godmode:client'); if(!id){id=uid();sessionStorage.setItem('godmode:client',id);} return id; }
function useTick() { const [now,setNow]=useState(Date.now());useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),250);return()=>clearInterval(id);},[]);return now; }
function clock(room, now) {
  if(!room?.startedAt) return '03:00';
  const end=room.status==='paused'?room.pausedAt:now;
  const seconds=Math.max(0,Math.ceil((ROUND_MS-(end-room.startedAt-room.pauseDuration))/1000));
  return Math.floor(seconds/60).toString().padStart(2,'0')+':'+(seconds%60).toString().padStart(2,'0');
}
async function newRoom(setError, setLoading, practice=false) {
  setLoading(true);setError('');
  try {
    const response=await fetch('/api/rooms',{method:'POST'});
    const result=await response.json();
    if(!response.ok) throw new Error(result.error);
    localStorage.setItem('godmode:host:'+result.code,result.hostToken);
    navigate('/stage/'+result.code+(practice?'?practice=1':''));
  } catch(error){setError(error.message || 'Could not open a universe. Try again.');setLoading(false);}
}
function GameCanvas({ room, host, gameRef, preview=false, onProgress, onReady }) {
  const container=useRef(null),current=useRef({room,host,onProgress,onReady}),[failed,setFailed]=useState(false);
  current.current={room,host,onProgress,onReady};
  useEffect(()=>{
    let disposed=false,instance;
    import('./game/Universe.js').then(({Universe})=>{
      if(disposed)return;
      instance=new Universe(container.current,{preview,onProgress:p=>current.current.onProgress?.(p),onError:()=>setFailed(true)});
      gameRef.current=instance;
      if(current.current.room)instance.setRoom(current.current.room,current.current.host);
      current.current.onReady?.(instance);
    }).catch(()=>setFailed(true));
    return()=>{disposed=true;instance?.dispose();gameRef.current=null;};
  },[preview]);
  useEffect(()=>{if(room)gameRef.current?.setRoom(room,host);},[room,host]);
  return <div className="universe" ref={container}>{failed && <div className="webgl-error"><Orbit size={32}/><strong>This universe needs WebGL.</strong><p>Open this stage in a current Chrome, Edge, or Safari window with graphics acceleration enabled.</p></div>}</div>;
}
function useRoom(code,name,enabled,gameRef) {
  const [room,setRoom]=useState(null),[connection,setConnection]=useState('connecting'),[error,setError]=useState(''),[host,setHost]=useState(false),[latest,setLatest]=useState(null);
  const socketRef=useRef(null);
  useEffect(()=>{
    if(!enabled)return;
    const socket=io({transports:['websocket','polling'],timeout:8000});socketRef.current=socket;
    socket.on('connect',()=>{
      setConnection('connecting');setError('');
      socket.timeout(8000).emit('room:join',{code,name,clientId:clientId(),hostToken:gameRef ? localStorage.getItem('godmode:host:'+code) : undefined},(err,result)=>{
        if(err||!result?.ok){setError(result?.error||'Could not join. Check your connection and try again.');setConnection('failed');return;}
        setRoom(result.room);setHost(result.host);setConnection('connected');
      });
    });
    socket.on('room:state',setRoom);
    socket.on('world:event',event=>{setLatest(event);gameRef?.current?.command(event);});
    socket.on('world:control',event=>{gameRef?.current?.control(event.action);if(event.action==='reset')setLatest(null);});
    socket.on('disconnect',()=>setConnection('reconnecting'));
    socket.on('connect_error',()=>setConnection('reconnecting'));
    socket.on('room:closed',()=>{setError('This universe has closed. Start another one from the home page.');setConnection('failed');});
    return()=>{socket.disconnect();socketRef.current=null;};
  },[code,name,enabled]);
  const command=useCallback((text,effectId)=>new Promise(resolve=>{
    const socket=socketRef.current;
    if(!socket?.connected)return resolve({ok:false,error:'Reconnecting to the universe. Try again in a moment.'});
    const sent=performance.now();
    socket.timeout(6000).emit('world:command',{text,effectId,requestId:uid()},(err,result)=>{
      if(err)return resolve({ok:false,error:'Your rule was not confirmed. Check the connection before trying again.'});
      resolve({...result,latency:Math.round(performance.now()-sent)});
    });
  }),[]);
  const action=useCallback(action=>socketRef.current?.emit('host:action',{action},result=>{if(!result.ok)setError(result.error);}),[]);
  const progress=useCallback(data=>socketRef.current?.emit('world:progress',data),[]);
  return {room,connection,error,host,latest,command,action,progress};
}
function Connection({ status }) { return <span className={'connection '+status}><i/>{status==='connected'?'Connected':status==='failed'?'Disconnected':'Reconnecting…'}</span>; }
function Home() {
  const [code,setCode]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(false);
  const [previewId,setPreviewId]=useState('moon');const gameRef=useRef(null);
  const previewRef=useRef(null);
  const initPreview=useCallback(instance=>{
    const apply=id=>{
      setPreviewId(id);
      instance.setRoom({status:'live',effects:[{id,expiresAt:Date.now()+9000}],round:1},true);
      if(['ducks','boulders'].includes(id))instance.command({effects:[{id,count:5}]});
    };
    apply('moon');let i=0;const sequence=['moon','ducks','lava','disco','boulders','shield'];
    previewRef.current=setInterval(()=>apply(sequence[++i%sequence.length]),6500);
  },[]);
  useEffect(()=>()=>clearInterval(previewRef.current),[]);
  async function join(e) {
    e.preventDefault();
    if(code.length!==4)return setError('Enter the four-character code on the big screen.');
    setLoading(true);setError('');
    try {const r=await fetch('/api/rooms/'+code);if(!r.ok)throw new Error((await r.json()).error);navigate('/join/'+code);}
    catch(e){setError(e.message);setLoading(false);}
  }
  return <div className="home">
    <header className="home-header"><Brand onClick={()=>navigate('/')}/><span className="eyebrow desktop-only"><span className="live-dot"/> BUILT FOR A ROOM FULL OF CHAOS</span><a className="text-link" href="https://github.com/jdlunder/troylabs-build-group-6" target="_blank" rel="noreferrer">The experiment <ArrowUpRight size={16}/></a></header>
    <main className="home-main">
      <div className="home-copy">
        <div className="edition"><span className="tiny-star">✳</span> A LIVE MULTIPLAYER EXPERIMENT</div>
        <h1>You play.<br/>They <span className="rule-word">rule<svg viewBox="0 0 260 15" aria-hidden="true"><path d="M3 10Q120 -5 257 8" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round"/></svg></span></h1>
        <p className="hero-copy">One astronaut. A room full of gods.<br/>Every phone can rewrite the universe.</p>
        <div className="home-actions">
          <button className="button yellow big" disabled={loading} onClick={()=>newRoom(setError,setLoading)}>{loading?'Opening a universe…':'Create a universe'}<ArrowUpRight size={22}/></button>
          <button className="solo-link" disabled={loading} onClick={()=>newRoom(setError,setLoading,true)}>Try a solo run <ChevronRight size={15}/></button>
        </div>
        <div className="join-divider"><span/>OR JOIN THE CHAOS<span/></div>
        <form className="join-form" onSubmit={join}><label className="sr-only" htmlFor="room-code">Room code</label><input id="room-code" value={code} onChange={e=>setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,4))} placeholder="Room code" autoCapitalize="characters" maxLength={4} autoComplete="off"/><button className="button outline" disabled={loading || code.length!==4}>Join room<ArrowRight size={18}/></button></form>
        {error&&<p className="error" role="alert">{error}</p>}
        <p className="home-footnote"><Smartphone size={14}/> No downloads. No accounts. Just questionable decisions.</p>
      </div>
      <div className="home-world">
        <div className="preview-label"><i/> UNIVERSE PREVIEW</div>
        <div className="world-coordinate">SECTOR 06 / SOMEWHERE UNREASONABLE</div>
        <GameCanvas gameRef={gameRef} preview onReady={initPreview}/>
        <div className="preview-command" key={previewId}><div className="preview-avatar"><EffectIcon id={previewId} size={23}/></div><div><span>IMAGINE SOMEONE TYPING…</span><strong>“{EFFECTS[previewId].label.toLowerCase()}”</strong></div><span className="preview-check"><Check size={16}/></span></div>
        <div className="orbital-stamp"><Mark/><span>REAL PEOPLE<br/>UNREAL POWER</span></div>
      </div>
    </main>
    <footer className="home-footer"><div><Smartphone/><p><strong>Scan into the universe.</strong><span>One QR code gets the whole room in.</span></p></div><div><WandSparkles/><p><strong>Say the unreasonable.</strong><span>“Floor is lava.” “Make it rain ducks.”</span></p></div><div><Rocket/><p><strong>Watch reality react.</strong><span>Help the hero. Or become the problem.</span></p></div><span className="footer-credit">TROYLABS<br/>BUILDERS NIGHT '26</span></footer>
  </div>;
}
function ActiveEffects({room,compact=false}) {
  const now=useTick();
  return <div className={'active-effects '+(compact?'compact':'')}>{room.effects.map(effect=><span className="effect-pill" key={effect.id} style={{'--effect':EFFECTS[effect.id].color}}><EffectIcon id={effect.id} size={14}/>{EFFECTS[effect.id].label}<small>{Math.max(0,Math.ceil((effect.expiresAt-(room.status==='paused'?room.pausedAt:now))/1000))}s</small></span>)}</div>;
}
function RuleFeed({room}) {
  return <div className="feed" aria-label="Live audience rules">
    <div className="section-label"><span><Radio size={13}/> LIVE RULES</span><span>{room.totalCommands.toString().padStart(2,'0')}</span></div>
    {room.history.length===0?<div className="empty-feed"><Sparkles size={26}/><p>The room is quiet.<br/><strong>For now.</strong></p></div>:room.history.slice(0,7).map(event=><div className="feed-item" key={event.id}>
      <span className="feed-avatar" style={{background:event.author.color,color:'#142039'}}><EffectIcon id={event.effects[0].id} size={17}/></span>
      <div><span className="feed-name">{event.author.name}</span><p>{event.text}</p><span className="feed-result">{event.effects.map(e=>(e.remove?'Cleared: ':'')+EFFECTS[e.id].label).join(' + ')}</span></div>
    </div>)}
  </div>;
}
function Composer({command,mini=false,disabled=false}) {
  const [text,setText]=useState(''),[pending,setPending]=useState(false),[notice,setNotice]=useState(null),[cooldown,setCooldown]=useState(false);
  const timer=useRef(null);
  useEffect(()=>()=>clearTimeout(timer.current),[]);
  async function send(value,id) {
    if(pending||cooldown||disabled)return;
    setPending(true);setNotice(null);
    const result=await command(value,id);
    setPending(false);
    if(result.ok) {
      setText('');setNotice({ok:true,text:'World changed',latency:result.latency,labels:result.event.effects.map(e=>EFFECTS[e.id].label).join(' + ')});
      navigator.vibrate?.(25);
      setCooldown(true);timer.current=setTimeout(()=>setCooldown(false),mini?250:1100);
    } else setNotice({ok:false,text:result.error});
  }
  return <div className={'composer '+(mini?'mini':'')}>
    <form className="rule-form" onSubmit={e=>{e.preventDefault();if(text.trim())send(text.trim());}}>
      <label htmlFor={mini?'stage-rule':'phone-rule'}>{mini?'YOUR TURN, MISSION CONTROL':'YOUR WORD. THEIR PROBLEM.'}</label>
      <div className="rule-input-wrap"><textarea id={mini?'stage-rule':'phone-rule'} rows={mini?2:3} maxLength={160} value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();if(text.trim())send(text.trim());}}} placeholder={mini?'Make it rain ducks…':'What happens next?\n“The floor is lava…”'} disabled={disabled}/><button type="submit" className="send-button" disabled={disabled||pending||cooldown||!text.trim()} aria-label="Change the world">{pending?<span className="spinner"/>:<ArrowUpRight size={24}/>}</button></div>
      {!mini&&<div className="input-hint"><span>Mix ideas: “moon gravity and rain ducks”</span><span>{text.length}/160</span></div>}
    </form>
    <div className={'command-notice '+(notice?.ok?'success':'')} role="status">{pending?<><span className="spinner"/> Bending reality…</>:notice?.ok?<><CheckCheck size={16}/><span><strong>{notice.text}</strong><small>{notice.latency} ms acknowledgement</small></span></>:notice?<><HelpCircle size={16}/>{notice.text}</>:mini?null:<><Zap size={14}/> Your rule goes straight to the big screen.</>}</div>
    {!mini&&<><div className="quick-heading"><span>INSTANT CHAOS</span><small>Pick your power</small></div><div className="quick-grid">{QUICK_CHAOS.map(id=><button key={id} disabled={disabled||pending||cooldown} style={{'--effect':EFFECTS[id].color}} onClick={()=>send(EFFECTS[id].label,id)}><EffectIcon id={id} size={22}/><span>{EFFECTS[id].label}</span><ArrowUpRight size={14}/></button>)}</div><div className="quick-heading help-heading"><span>FEELING GENEROUS?</span><Heart size={13}/></div><div className="quick-grid help-grid">{QUICK_HELP.map(id=><button key={id} disabled={disabled||pending||cooldown} style={{'--effect':EFFECTS[id].color}} onClick={()=>send(EFFECTS[id].label,id)}><EffectIcon id={id} size={20}/><span>{EFFECTS[id].label}</span><ArrowUpRight size={14}/></button>)}</div></>}
    {mini&&<div className="stage-quick">{['lava','moon','ducks','shield','confetti'].map(id=><button title={EFFECTS[id].label} aria-label={EFFECTS[id].label} key={id} disabled={disabled||pending||cooldown} onClick={()=>send(EFFECTS[id].label,id)}><EffectIcon id={id} size={17}/></button>)}</div>}
  </div>;
}
function Stage({code}) {
  const gameRef=useRef(null);
  const {room,host,connection,error,latest,command,action,progress}=useRoom(code,'Mission control',true,gameRef);
  const [qr,setQr]=useState(''),[copied,setCopied]=useState(false),[auto,setAuto]=useState(false),[sound,setSound]=useState(false),[cinema,setCinema]=useState(false);
  const [ready,setReady]=useState(false),[banner,setBanner]=useState(null),[controlError,setControlError]=useState('');
  const now=useTick();const invite=window.location.origin+'/join/'+code;
  useEffect(()=>{QRCode.toDataURL(invite,{width:256,margin:1,color:{dark:'#142039',light:'#ffffff'}}).then(setQr);},[invite]);
  useEffect(()=>{if(!latest)return;setBanner(latest);const timer=setTimeout(()=>setBanner(null),3500);return()=>clearTimeout(timer);},[latest]);
  useEffect(()=>{
    if(ready&&host&&new URLSearchParams(window.location.search).has('practice')){
      setAuto(true);gameRef.current?.setAutopilot(true);action('start');
    }
  },[ready,host]);
  useEffect(()=>{
    const handler=e=>{
      if(/INPUT|TEXTAREA/.test(e.target.tagName))return;
      if(e.code==='KeyF')document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen().catch(()=>{});
      if(e.code==='KeyH')setCinema(v=>!v);
      if(e.code==='KeyP'&&host)action(room?.status==='paused'?'start':'pause');
    };
    window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);
  },[host,room?.status]);
  const copy=async()=>{try{await navigator.clipboard.writeText(invite);setCopied(true);setTimeout(()=>setCopied(false),1800);}catch{setControlError('Invite link: '+invite);}};
  if(!room)return <Loading error={error} connection={connection}/>;
  const terminal=['won','finale','ended'].includes(room.status);
  return <div className={'stage '+(cinema?'cinema':'')}>
    <header className="stage-header"><Brand onClick={()=>navigate('/')}/><div className="stage-universe"><span>UNIVERSE</span><strong>{code}</strong></div><div className="stage-header-right"><Connection status={connection}/><span className="audience-count"><Users size={16}/><strong>{room.audience}</strong> {room.audience===1?'god':'gods'} online</span><button className="icon-button" aria-label="Copy audience invite link" onClick={copy}>{copied?<Check size={18}/>:<Link2 size={18}/>}</button><button className="icon-button" aria-label="Toggle fullscreen" onClick={()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen().catch(()=>setControlError('Use your browser’s fullscreen command.'))}><Maximize2 size={18}/></button></div></header>
    <main className="stage-main">
      <section className="stage-play">
        <GameCanvas room={room} host={host} gameRef={gameRef} onProgress={progress} onReady={()=>setReady(true)}/>
        <div className="game-heading"><span className="eyebrow">ONE HERO. EVERYONE ELSE IS GOD.</span><h1>Get Nova home<span>.</span></h1><p>Collect 3 energy cells. Reach the rocket. Survive the room.</p></div>
        <div className="game-timer"><span>{room.status==='lobby'?'READY FOR CHAOS':room.status==='paused'?'UNIVERSE PAUSED':terminal?'MISSION COMPLETE':'TIME TO LAUNCH'}</span><strong>{clock(room,now)}</strong></div>
        <div className="game-stats"><div className="health-stat"><Heart size={16}/><span>NOVA</span><div className="health-track"><i style={{width:room.progress.health+'%'}}/></div><strong>{room.progress.health}</strong></div><div className="fuel-stat"><Zap size={16}/><span>FUEL</span>{[0,1,2].map(i=><span className={'fuel-cell '+(i<room.progress.cells?'filled':'')} key={i}>◆</span>)}</div></div>
        <div className="game-active"><ActiveEffects room={room} compact/></div>
        {banner&&!terminal&&<div className="world-banner" key={banner.id} style={{'--effect':EFFECTS[banner.effects[0].id].color}}><span><EffectIcon id={banner.effects[0].id} size={27}/></span><div><small>{banner.author.name} rewrote reality</small><strong>{banner.effects.map(e=>(e.remove?'Cleared: ':'')+EFFECTS[e.id].label).join(' + ')}</strong></div></div>}
        {room.status==='paused'&&<div className="pause-overlay"><Pause size={40}/><h2>Even gods need a breather.</h2>{host&&<button className="button yellow" onClick={()=>action('start')}>Resume universe <Play size={17}/></button>}</div>}
        {terminal&&<div className="finale-overlay"><div className="finale-star"><Mark/></div><span className="eyebrow">{room.status==='won'?'MISSION ACCOMPLISHED':room.status==='finale'?'THE GRAND FINALE':'TIME’S UP, UNIVERSE'}</span><h2>{room.status==='won'?'Against all odds.':room.status==='finale'?'The room made this.':'Beautiful chaos.'}</h2><p>{room.totalCommands} rules. {room.audience} gods. One very brave astronaut.</p>{host&&<button className="button yellow" onClick={()=>action('reset')}>One more universe <RotateCcw size={16}/></button>}</div>}
        <div className="game-bottom"><div className="key-guide"><Keyboard size={15}/><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move</span><span><kbd>space</kbd> jump</span></div><span className="sector-label">NOVA / SECTOR 06</span></div>
        {room.status==='lobby'&&host&&<button className="begin-game button yellow" onClick={()=>action('start')}><Play size={18}/> Start the experiment <ArrowRight size={18}/></button>}
        {!host&&<div className="spectator-note">Spectator view · Presenter controls stay on the original browser.</div>}
      </section>
      <aside className="stage-sidebar">
        <div className="invite-panel"><div className="invite-heading"><span className="live-dot"/> THE AUDIENCE HAS GODMODE</div><div className="qr-row"><div className="qr-frame">{qr&&<img src={qr} alt={'Scan to join universe '+code}/>}</div><div className="invite-copy"><Smartphone size={19}/><h2>Rewrite<br/>this world.</h2><p>Scan. Say a rule.<br/>Watch it happen.</p></div></div><button className="room-invite" onClick={copy}><span>JOIN CODE</span><strong>{code}</strong><Copy size={15}/></button><a className="invite-url" href={invite} target="_blank" rel="noreferrer">{window.location.host}/join/{code}<ArrowUpRight size={12}/></a></div>
        <RuleFeed room={room}/>
        {host&&<Composer command={command} mini disabled={connection!=='connected'||terminal||room.status==='paused'}/>}
      </aside>
    </main>
    {host&&<footer className="presenter-bar"><span className="presenter-label"><Radio size={14}/> MISSION CONTROL</span><button onClick={()=>action(room.status==='live'?'pause':'start')} disabled={terminal}>{room.status==='live'?<Pause size={15}/>:<Play size={15}/>} {room.status==='live'?'Pause':room.status==='paused'?'Resume':'Start'}</button><button onClick={()=>action('clear')}><Wind size={15}/> Clear chaos</button><button onClick={()=>action('reset')}><RotateCcw size={14}/> Reset</button><span className="control-divider"/><button className={auto?'selected':''} onClick={()=>{setAuto(!auto);gameRef.current?.setAutopilot(!auto);}}><Rocket size={15}/> Guided run {auto?'on':'off'}</button><button onClick={()=>{setSound(!sound);gameRef.current?.setSound(!sound);}} aria-label={sound?'Mute sound':'Enable sound'}>{sound?<Volume2 size={16}/>:<VolumeX size={16}/>}</button><button onClick={()=>setCinema(!cinema)} title="Hide controls (H)"><Maximize2 size={15}/><span className="desktop-only">Cinema</span></button><button className="finale-button" onClick={()=>action('finale')} disabled={terminal}><Sparkles size={14}/> Launch finale</button><span className="engine-label">{room.aiEnabled?'AI imagination + instant rules':'Instant rules ready'}</span></footer>}
    {(error||controlError)&&<div className="stage-error" role="alert">{error||controlError}<button onClick={()=>setControlError('')} aria-label="Dismiss message"><X size={16}/></button></div>}
  </div>;
}
function Loading({error,connection}) { return <div className="loading-screen"><Mark/><h1>{error?'Universe not found.':'Opening the universe…'}</h1><p>{error||'Connecting to mission control.'}</p>{error?<button className="button yellow" onClick={()=>navigate('/')}>Back to home <ArrowRight size={18}/></button>:<Connection status={connection}/>}</div>; }
function Phone({code}) {
  const [nickname,setNickname]=useState(()=>localStorage.getItem('godmode:name')||'');
  const [joined,setJoined]=useState(false),[name,setName]=useState('');
  const {room,connection,error,command}=useRoom(code,name,joined);
  const now=useTick();
  function enter(e) {e?.preventDefault();const clean=nickname.trim().slice(0,22)||'Anonymous deity';setName(clean);localStorage.setItem('godmode:name',clean);setJoined(true);}
  if(!joined)return <div className="phone-welcome"><header><Brand dark onClick={()=>navigate('/')}/><span className="room-badge">{code}</span></header><main><div className="welcome-orbit"><Mark/><div className="orbit-dot"/></div><span className="eyebrow">YOU’RE ABOUT TO BECOME A PROBLEM.</span><h1>A little power.<br/>A lot of <em>chaos.</em></h1><p>There’s an astronaut on the big screen.<br/>You get to change their entire world.</p><form onSubmit={enter}><label htmlFor="nickname">Your name on the big screen <span>optional</span></label><input id="nickname" maxLength={22} value={nickname} onChange={e=>setNickname(e.target.value)} autoComplete="nickname" placeholder="Your godly alter ego"/><button className="button yellow big">Give me godmode <ArrowUpRight size={22}/></button></form><span className="welcome-note"><Shield size={13}/> No account. Just a name and unreasonable power.</span></main><footer>UNIVERSE {code} <span>GODMODE EXPERIMENT / 06</span></footer></div>;
  if(!room)return <Loading error={error} connection={connection}/>;
  const terminal=['won','ended','finale'].includes(room.status),disabled=connection!=='connected'||room.status==='paused'||terminal;
  return <div className="phone">
    <header className="phone-header"><Brand onClick={()=>navigate('/')}/><span className="room-badge">{code}</span></header>
    <div className="phone-live"><Connection status={connection}/><span><Users size={13}/>{room.audience} {room.audience===1?'god':'gods'} online</span><strong>{clock(room,now)}</strong></div>
    <main className="phone-main">
      <div className="phone-title"><div><span className="eyebrow">HELLO, {name.toUpperCase()}</span><h1>You have godmode<span>.</span></h1></div><Mark small/></div>
      <p className="phone-subtitle">Change the world on the big screen.<br/>Be kind. Be chaotic. Be a little unreasonable.</p>
      {room.status==='paused'&&<div className="phone-status"><Pause size={18}/><p><strong>The universe is paused.</strong>Your powers return when the presenter resumes.</p></div>}
      {terminal&&<div className="phone-status celebration"><Rocket size={22}/><p><strong>{room.status==='won'?'Nova made it home.':room.status==='finale'?'You made that happen.':'What a universe.'}</strong>{room.totalCommands} rules rewritten. Stay here for the next round.</p></div>}
      <Composer command={command} disabled={disabled}/>
      {room.effects.length>0&&<section className="phone-world-state"><div className="quick-heading"><span>HAPPENING RIGHT NOW</span><Radio size={14}/></div><ActiveEffects room={room}/></section>}
      <div className="nova-status"><span className="nova-avatar">✦</span><div><strong>Nova is {room.progress.health>50?'hanging in there.':'having a moment.'}</strong><span>Health {room.progress.health}% · Fuel {room.progress.cells}/3</span></div><Heart size={17}/></div>
      {error&&<p className="error" role="alert">{error}</p>}
    </main><footer className="phone-footer">THE AUDIENCE IS THE GAME.<span>GODMODE / TROYLABS '26</span></footer>
  </div>;
}
function App() {
  const [path,setPath]=useState(window.location.pathname);
  useEffect(()=>{const update=()=>setPath(window.location.pathname);window.addEventListener('popstate',update);return()=>window.removeEventListener('popstate',update);},[]);
  const match=path.match(/^\/(stage|join)\/([a-z0-9]{4})\/?$/i);
  if(match)return match[1]==='stage'?<Stage key={match[2].toUpperCase()} code={match[2].toUpperCase()}/>:<Phone key={match[2].toUpperCase()} code={match[2].toUpperCase()}/>;
  return <Home/>;
}
class ErrorBoundary extends React.Component {
  state={error:false};
  static getDerivedStateFromError(){return {error:true};}
  render(){return this.state.error?<div className="loading-screen"><Mark/><h1>Reality hit a little turbulence.</h1><p>Reload to reconnect to your universe.</p><button className="button yellow" onClick={()=>location.reload()}>Reconnect <RotateCcw size={18}/></button></div>:this.props.children;}
}
createRoot(document.getElementById('root')).render(<ErrorBoundary><App/></ErrorBoundary>);
