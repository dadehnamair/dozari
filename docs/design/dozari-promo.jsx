const W=1080,H=1920;
const MOTION={
  enter:(s,e,a=0,b=1)=>animate({from:a,to:b,start:s,end:e,ease:Easing.easeOutCubic}),
  pop:(s,e,a=0,b=1)=>animate({from:a,to:b,start:s,end:e,ease:Easing.easeOutBack}),
  draw:(s,e,a=0,b=1)=>animate({from:a,to:b,start:s,end:e,ease:Easing.linear}),
};
const INK='#2B1240';
const LZ="Lalezar, Vazirmatn, sans-serif";
const ab={position:'absolute'};
const ICONS=['pomegranate','teaGlass','samovar','kite','carpet','coinStack','grape','saffron','pistachio','dice','crown','gem','sohan','watermelon','coin','kite'];
const GROUPC=['#FFE48A','#8FDCFA','#B8F08F','#FF8FB6'];
const fa=n=>String(n).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]);

function Bg({T,CUES,total}){
  const heat=MOTION.enter(CUES.Reveal-0.3,CUES.Reveal+0.6)(T);
  const rot=T*14;
  const rayOp=0.08+heat*0.14;
  return <>
    <div style={{...ab,inset:0,background:`radial-gradient(circle at 50% 45%, ${heat>0.5?'#8E2A9E':'#5E1F7E'} 0%, #40166A 45%, #1A0A2C 100%)`}}/>
    <div style={{...ab,left:W/2-1800,top:860-1800,width:3600,height:3600,borderRadius:'50%',transform:`rotate(${rot}deg)`,
      background:`repeating-conic-gradient(rgba(255,201,60,${rayOp}) 0 8deg,transparent 8deg 16deg)`}}/>
    {[0,1,2,3,4,5,6,7].map(i=>{const x=(i*137)%W,y=((i*331+T*60*(1+i%3))%(H+200))-100;
      return <img key={i} src={`promo/i-${ICONS[i]}.png`} style={{...ab,left:x,top:H-y,width:90,height:90,opacity:.18,transform:`rotate(${T*20*(i%2?1:-1)}deg)`}}/>;})}
  </>;
}

function Drop({T,CUES}){
  const s=CUES.Drop, hit=s+1.5;
  const y=T<hit?MOTION.draw(s+0.2,hit,-400,820)(T)*1:820-Math.abs(Math.sin((T-hit)*7))*90*Math.exp(-(T-hit)*3);
  const spin=T<hit?(T-s)*900:0;
  const sq=T>=hit&&T<hit+0.12?0.8:1;
  const out=MOTION.enter(CUES.Tiles-0.2,CUES.Tiles+0.3)(T);
  const flash=T>=hit?Math.max(0,1-(T-hit)*3):0;
  const burst=MOTION.pop(hit,hit+0.35)(T);
  const kick=MOTION.enter(s+0.1,s+0.6)(T)*(1-out);
  return <>
    <div style={{...ab,top:360,left:0,right:0,textAlign:'center',opacity:kick,transform:`translateY(${(1-kick)*30}px)`,font:`800 64px/1.4 Vazirmatn`,color:'#FFF6E8',textShadow:`0 4px 0 ${INK}`}}>یه دوزاری داره میفته…</div>
    <img src="promo/i-coin.png" style={{...ab,left:W/2-170,top:y,width:340,height:340,opacity:1-out,transform:`rotate(${spin}deg) scale(${(1-out*0.6)}) scaleY(${sq})`}}/>
    <div style={{...ab,inset:0,background:'#FFF4B0',opacity:flash*0.6}}/>
    {T>=hit&&<div style={{...ab,left:0,right:0,top:620,textAlign:'center',opacity:(1-out),transform:`scale(${burst}) rotate(-6deg)`}}>
      <span style={{font:`170px/1 ${LZ}`,color:'#FFC93C',WebkitTextStroke:`14px ${INK}`,paintOrder:'stroke',textShadow:`0 12px 0 ${INK}`}}>دیلینگ!</span>
    </div>}
  </>;
}

function Tiles({T,CUES}){
  const s=CUES.Tiles, e=CUES.Reveal;
  const size=200,gap=20,gx=(W-(size*4+gap*3))/2,gy=640;
  const fly=MOTION.enter(e-0.15,e+0.5)(T);
  return <>
    <div style={{...ab,top:420,left:0,right:0,textAlign:'center',opacity:MOTION.enter(s+0.1,s+0.5)(T)*(1-fly),font:`80px/1.2 ${LZ}`,color:'#FFF6E8',textShadow:`0 6px 0 ${INK}`}}>۱۶ کلمه، ۴ دسته!</div>
    {ICONS.map((k,i)=>{
      const r=Math.floor(i/4),c=i%4;
      const p=MOTION.pop(s+0.15+i*0.05,s+0.5+i*0.05)(T);
      const lock=MOTION.pop(s+1.5+r*0.4,s+1.8+r*0.4)(T);
      const bg=lock>0.5?GROUPC[r]:'#FFF6E8';
      const dx=(c-1.5)*fly*900, dy=(r-1.5)*fly*1100;
      return <div key={i} style={{...ab,left:W-(gx+c*(size+gap))-size+dx,top:gy+r*(size+gap)+dy,width:size,height:size,borderRadius:36,background:bg,
        border:`8px solid ${INK}`,boxShadow:`inset 0 8px 0 rgba(255,255,255,.55),0 12px 0 ${INK}`,display:'grid',placeItems:'center',
        transform:`scale(${p*(1+Math.sin(lock*Math.PI)*0.12)}) rotate(${fly*(c-1.5)*30}deg)`,opacity:1-fly*0.9}}>
        <img src={`promo/i-${k}.png`} style={{width:130,height:130}}/>
      </div>;})}
  </>;
}

function Reveal({T,CUES}){
  const s=CUES.Reveal;
  const hero=MOTION.pop(s+0.1,s+0.7)(T);
  const side=MOTION.pop(s+0.5,s+1.1)(T);
  const logo=MOTION.pop(s+0.9,s+1.4)(T);
  const bob=Math.sin(T*4)*10;
  const shift=MOTION.enter(CUES.Slogan,CUES.Slogan+0.6)(T);
  return <>
    <img src="promo/ajan.png" style={{...ab,left:-40-(1-side)*500,top:1080-shift*40,width:340,height:394,transform:`rotate(${-4+bob*0.2}deg)`}}/>
    <img src="promo/goli.png" style={{...ab,right:-40-(1-side)*500,top:1080-shift*40,width:340,height:394,transform:`scaleX(-1) rotate(${-4-bob*0.2}deg)`}}/>
    <img src={T<s+1.6?'promo/shocked.png':'promo/win.png'} style={{...ab,left:W/2-310,top:700+(1-hero)*1300+bob-shift*80,width:620,height:719}}/>
    <div style={{...ab,top:250-shift*60,left:0,right:0,textAlign:'center',transform:`scale(${logo}) rotate(${(1-logo)*-12}deg)`}}>
      <span style={{font:`230px/1 ${LZ}`,color:'#FFC93C',WebkitTextStroke:`18px ${INK}`,paintOrder:'stroke',textShadow:`0 16px 0 ${INK}`}}>دوزاری</span>
    </div>
  </>;
}

function Slogan({T,CUES,total}){
  const s=CUES.Slogan;
  const w1=MOTION.pop(s+0.2,s+0.55)(T), w2=MOTION.pop(s+0.45,s+0.8)(T);
  const nums=[3,2,1];
  const stampT=s+2.4;
  const stamp=MOTION.pop(stampT,stampT+0.3,2.4,1)(T);
  const shake=T>=stampT&&T<stampT+0.35?Math.sin((T-stampT)*90)*14*(1-(T-stampT)/0.35):0;
  const sub=MOTION.enter(stampT+0.5,stampT+0.9)(T);
  const fade=MOTION.enter(total-0.45,total)(T);
  return <div style={{...ab,inset:0,transform:`translateX(${shake}px)`}}>
    <div style={{...ab,top:470,left:0,right:0,display:'flex',justifyContent:'center',gap:24,direction:'rtl'}}>
      <span style={{font:`96px/1.1 ${LZ}`,color:'#FFF6E8',textShadow:`0 6px 0 ${INK}`,transform:`scale(${w1})`,display:'inline-block'}}>بازار</span>
      <span style={{font:`96px/1.1 ${LZ}`,color:'#FF8FB6',WebkitTextStroke:`8px ${INK}`,paintOrder:'stroke',textShadow:`0 6px 0 ${INK}`,transform:`scale(${w2}) rotate(-4deg)`,display:'inline-block'}}>داره داغ میشه!</span>
    </div>
    {nums.map((n,i)=>{const a=s+1.0+i*0.45,b=a+0.45;if(T<a||T>=b)return null;const k=(T-a)/0.45;
      return <div key={n} style={{...ab,left:W/2-130,top:1480,width:260,height:260,borderRadius:'50%',background:'radial-gradient(circle at 35% 30%,#FFF4B0,#FFC93C 55%,#D98A0B)',border:`10px solid ${INK}`,
        display:'grid',placeItems:'center',font:`170px/1 ${LZ}`,color:INK,transform:`scale(${1.4-k*0.4})`,opacity:1-k*0.3}}>{fa(n)}</div>;})}
    {T>=stampT&&<div style={{...ab,left:60,right:60,top:1440,display:'flex',flexDirection:'column',alignItems:'center',gap:24}}>
      <div style={{padding:'20px 70px 34px',background:'linear-gradient(180deg,#B8F08F,#7ED957 60%,#5DBB3C)',border:`12px solid ${INK}`,borderRadius:56,
        boxShadow:`inset 0 10px 0 rgba(255,255,255,.55),0 18px 0 ${INK}`,font:`150px/1.1 ${LZ}`,color:'#fff',textShadow:`0 8px 0 ${INK}`,transform:`scale(${stamp}) rotate(-5deg)`}}>به‌زودی!</div>
      <div style={{font:`800 46px Vazirmatn`,color:'#FFE48A',textShadow:`0 4px 0 ${INK}`,opacity:sub,transform:`translateY(${(1-sub)*30}px)`}}>دوزاریت رو آماده کن</div>
    </div>}
    <div style={{...ab,inset:0,background:'#1A0A2C',opacity:fade}}/>
  </div>;
}

function Piece(){
  const {T,CUES,authoredTotal}=useComposition();
  const total=authoredTotal;
  React.useEffect(()=>{const r=document.querySelector('[data-promo-root]');if(r)r.setAttribute('data-screen-label','t='+Math.floor(T)+'s');},[Math.floor(T)]);
  return <div data-promo-root="1" style={{...ab,inset:0,overflow:'hidden',direction:'rtl'}}>
    <Bg T={T} CUES={CUES} total={total}/>
    <Shot from={CUES.Drop} to={CUES.Reveal+0.6}><Drop T={T} CUES={CUES}/><Tiles T={T} CUES={CUES}/></Shot>
    <Shot from={CUES.Reveal} to={total+1}><Reveal T={T} CUES={CUES}/><Slogan T={T} CUES={CUES} total={total}/></Shot>
  </div>;
}

const TWEAK_DEFAULTS=window.PROMO_TWEAKS?JSON.parse(window.PROMO_TWEAKS):{motionEditor:true};
function DozariPromo(){
  const [t,setTweak]=useTweaks(TWEAK_DEFAULTS);
  return <>
    <CompositionStage width={W} height={H} scenes={window.OM_SCENES} playback={window.OM_PLAYBACK} bg="#1A0A2C"><Piece/></CompositionStage>
    <TweaksPanel><TweakToggle label="Motion editor" value={t.motionEditor} onChange={v=>setTweak('motionEditor',v)}/></TweaksPanel>
  </>;
}
window.DozariPromo=DozariPromo;
