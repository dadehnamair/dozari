const W=1080,H=1080;
const MOTION={
  enter:(s,e,a=0,b=1)=>animate({from:a,to:b,start:s,end:e,ease:Easing.easeOutCubic}),
  pop:(s,e,a=0,b=1)=>animate({from:a,to:b,start:s,end:e,ease:Easing.easeOutBack}),
  draw:(s,e,a=0,b=1)=>animate({from:a,to:b,start:s,end:e,ease:Easing.easeInCubic}),
};
const INK='#2B1240';
const ab={position:'absolute'};
const CANDY=['#FF4D8D','#FF7A3D','#FFC93C','#3FC1F0','#A66BF0','#7ED957'];
const SPARKS=Array.from({length:22},(_,i)=>({a:i*(360/22)+(i%3)*7,d:260+(i*53)%220,s:18+(i*7)%22,c:CANDY[i%6],sq:i%2}));

function Bg({T}){
  return <>
    <div style={{...ab,inset:0,background:'radial-gradient(circle at 50% 48%,#6A2290 0%,#40166A 45%,#1A0A2C 100%)'}}/>
    <div style={{...ab,left:W/2-1100,top:H/2-1100,width:2200,height:2200,borderRadius:'50%',transform:`rotate(${T*12}deg)`,
      background:'repeating-conic-gradient(rgba(255,201,60,.09) 0 9deg,transparent 9deg 18deg)'}}/>
  </>;
}

function Wordmark({T,CUES,total}){
  const hit=CUES.Pop;
  const p=MOTION.pop(hit+0.05,hit+0.55)(T);
  const sx=T<hit+0.05?0:1+Math.sin((T-hit)*14)*0.12*Math.exp(-(T-hit)*4);
  const sy=T<hit+0.05?0:1-Math.sin((T-hit)*14)*0.12*Math.exp(-(T-hit)*4);
  const breathe=T>CUES.Shine?1+Math.sin((T-CUES.Shine)*2.4)*0.015:1;
  const shineX=MOTION.enter(CUES.Shine+0.2,CUES.Shine+1.2,-260,820)(T);
  const out=MOTION.draw(CUES.Out,total)(T);
  return <div style={{...ab,left:0,right:0,top:470,height:280,display:'grid',placeItems:'center',
    transform:`scale(${p*breathe*(1-out*0.15)}) scaleX(${sx}) scaleY(${sy})`,opacity:1-out,transformOrigin:'50% 80%'}}>
    <svg viewBox="-90 0 700 200" width="1000" style={{overflow:'visible'}}>
      <defs>
        <linearGradient id="lgW" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFF6A8"/><stop offset=".5" stopColor="#FFC93C"/><stop offset="1" stopColor="#FF7A3D"/></linearGradient>
        <clipPath id="lgClip"><text x="260" y="146" textAnchor="middle" fontFamily="Lalezar" fontSize="168">دوزاری</text></clipPath>
      </defs>
      <text x="260" y="158" textAnchor="middle" fontFamily="Lalezar" fontSize="168" fill={INK} stroke={INK} strokeWidth="26" strokeLinejoin="round">دوزاری</text>
      <text x="260" y="146" textAnchor="middle" fontFamily="Lalezar" fontSize="168" fill="url(#lgW)" stroke={INK} strokeWidth="14" strokeLinejoin="round" paintOrder="stroke">دوزاری</text>
      <g clipPath="url(#lgClip)"><rect x={shineX} y="-20" width="70" height="260" fill="rgba(255,255,255,.75)" transform={`skewX(-20)`}/></g>
    </svg>
  </div>;
}

function Coin({T,CUES,total}){
  const s=CUES.Drop, hit=CUES.Pop;
  // fall to logo center, bounce up into the dot position (top-right of wordmark)
  let x=W/2, y, rot, sc=1, sqY=1;
  if(T<hit){ y=MOTION.draw(s+0.15,hit,-260,560)(T); rot=MOTION.enter(s,hit,0,1080)(T); }
  else {
    const k=MOTION.enter(hit,hit+0.9)(T);
    x=W/2-k*330; y=560-Math.sin(k*Math.PI)*260-k*20; rot=1080+k*360; sc=1-k*0.6;
    if(T<hit+0.1) sqY=0.75;
  }
  const settle=T>hit+0.9?Math.sin((T-hit-0.9)*3)*6:0;
  const out=MOTION.draw(CUES.Out,total)(T);
  const spinX=Math.abs(Math.cos(rot*Math.PI/180));
  return <img src="promo/i-coin.png" style={{...ab,left:x-150,top:y-150+settle,width:300,height:300,opacity:1-out,
    transform:`scale(${sc*(1-out*0.3)}) scaleX(${0.35+spinX*0.65}) scaleY(${sqY})`}}/>;
}

function Burst({T,CUES}){
  const hit=CUES.Pop;
  if(T<hit) return null;
  const k=MOTION.enter(hit,hit+0.8)(T);
  const ring=MOTION.enter(hit,hit+0.6)(T);
  const flash=Math.max(0,1-(T-hit)*4);
  return <>
    <div style={{...ab,inset:0,background:'#FFF4B0',opacity:flash*0.55}}/>
    <div style={{...ab,left:W/2-ring*480,top:610-ring*480,width:ring*960,height:ring*960,borderRadius:'50%',border:`${18*(1-ring)+2}px solid #FFC93C`,opacity:1-ring}}/>
    {SPARKS.map((p,i)=>{const r=p.d*k, a=p.a*Math.PI/180, g=(T-hit)*(T-hit)*180;
      return <div key={i} style={{...ab,left:W/2+Math.cos(a)*r-p.s/2,top:610+Math.sin(a)*r*0.8-p.s/2+g,width:p.s,height:p.s,
        borderRadius:p.sq?5:'50%',background:p.c,border:`3px solid ${INK}`,opacity:1-MOTION.enter(hit+0.5,hit+1.2)(T),transform:`rotate(${(T-hit)*400*(p.sq?1:-1)}deg)`}}/>;})}
  </>;
}

function Tagline({T,CUES,total}){
  const s=CUES.Shine;
  const t=MOTION.pop(s+0.6,s+1.0)(T);
  const out=MOTION.draw(CUES.Out,total)(T);
  return <div style={{...ab,left:0,right:0,top:790,display:'flex',justifyContent:'center',opacity:Math.min(1,t)*(1-out)}}>
    <div style={{padding:'10px 40px 18px',background:'linear-gradient(180deg,#FF8FB6,#FF4D8D)',border:`7px solid ${INK}`,borderRadius:40,
      boxShadow:`inset 0 6px 0 rgba(255,255,255,.5),0 10px 0 ${INK}`,font:'64px/1.2 Lalezar',color:'#fff',textShadow:`0 5px 0 ${INK}`,
      transform:`scale(${t}) rotate(-3deg)`}}>دوزاریت افتاد؟</div>
  </div>;
}

function Piece(){
  const {T,CUES,authoredTotal}=useComposition();
  const total=authoredTotal;
  React.useEffect(()=>{const r=document.querySelector('[data-logo-root]');if(r)r.setAttribute('data-screen-label','t='+Math.floor(T)+'s');},[Math.floor(T)]);
  return <div data-logo-root="1" style={{...ab,inset:0,overflow:'hidden',direction:'rtl'}}>
    <Bg T={T}/>
    <Burst T={T} CUES={CUES}/>
    <Wordmark T={T} CUES={CUES} total={total}/>
    <Coin T={T} CUES={CUES} total={total}/>
    <Tagline T={T} CUES={CUES} total={total}/>
  </div>;
}

const TWEAK_DEFAULTS=window.LOGO_TWEAKS?JSON.parse(window.LOGO_TWEAKS):{motionEditor:true};
function DozariLogoAnim(){
  const [t,setTweak]=useTweaks(TWEAK_DEFAULTS);
  return <>
    <CompositionStage width={W} height={H} scenes={window.OM_SCENES} playback={window.OM_PLAYBACK} bg="#1A0A2C"><Piece/></CompositionStage>
    <TweaksPanel><TweakToggle label="Motion editor" value={t.motionEditor} onChange={v=>setTweak('motionEditor',v)}/></TweaksPanel>
  </>;
}
window.DozariLogoAnim=DozariLogoAnim;
