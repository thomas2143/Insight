'use strict';

// ── Perlin noise ──
const P = new Uint8Array(512);
(()=>{
  const b = new Uint8Array(256);
  for(let i=0;i<256;i++) b[i]=i;
  for(let i=255;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [b[i],b[j]]=[b[j],b[i]]; }
  for(let i=0;i<512;i++) P[i]=b[i&255];
})();
function noise(x,y){
  const X=Math.floor(x)&255, Y=Math.floor(y)&255;
  x-=Math.floor(x); y-=Math.floor(y);
  const u=x*x*x*(x*(x*6-15)+10), v=y*y*y*(y*(y*6-15)+10);
  const A=P[X]+Y, B=P[X+1]+Y;
  function g(h,x,y){ const u=h<8?x:y,v=h<4?y:h===12||h===14?x:0; return((h&1)?-u:u)+((h&2)?-v:v); }
  function l(a,b,t){ return a+t*(b-a); }
  return l(l(g(P[A],x,y),g(P[B],x-1,y),u), l(g(P[A+1],x,y-1),g(P[B+1],x-1,y-1),u), v);
}

// ── Canvas setup ──
let canvas, ctx, W=0, H=0;
function engineInit(canvasEl){
  canvas = canvasEl;
  ctx = canvas.getContext('2d');
  engineResize();
  window.addEventListener('resize', engineResize);
}
function engineResize(){
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W;
  canvas.height = H;
}

// ── Particles ──
const N = 2200;
const particles = [];
for(let i=0;i<N;i++){
  const a=Math.random()*Math.PI*2, r=Math.random()*30;
  particles.push({
    x: W/2+Math.cos(a)*r, y: H/2+Math.sin(a)*r,
    vx:0, vy:0,
    z: Math.random(),
    sz: Math.random()*1.2+0.2,
    ph: Math.random()*Math.PI*2,
    phy: Math.random()*Math.PI*2,
    mass: 0.7+Math.random()*0.6,
    fric: 0.82+Math.random()*0.08
  });
}
let targets = particles.map(p=>[p.x, p.y]);

// ── Shape generators ──
function genHuman(){
  const cx=W/2, cy=H/2, s=Math.min(W,H)*0.42, pts=[];
  for(let i=0;i<300;i++){ const a=Math.random()*Math.PI*2,r=s*0.17*(0.6+Math.random()*0.4); pts.push([cx+Math.cos(a)*r, cy-s*0.43+Math.sin(a)*r]); }
  for(let i=0;i<700;i++){ const t=Math.random(),hw=s*(0.20-t*0.05); pts.push([cx+(Math.random()-0.5)*hw*2, cy-s*0.17+t*s*0.50]); }
  for(const side of[-1,1]) for(let i=0;i<250;i++){ const t=Math.random(); pts.push([cx+side*(s*0.14+t*s*0.30), cy-s*0.15+t*s*0.42]); }
  for(const side of[-1,1]) for(let i=0;i<250;i++){ const t=Math.random(); pts.push([cx+side*(s*0.06+t*t*0.07*s), cy+s*0.33+t*s*0.44]); }
  return pts;
}
function genVortex(){
  const cx=W/2, cy=H/2, s=Math.min(W,H)*0.40, pts=[];
  for(let i=0;i<N;i++){
    const t=i/N, arm=i%3, base=(arm/3)*Math.PI*2;
    const a=base+t*Math.PI*2*5+(Math.random()-0.5)*0.3;
    const r=Math.pow(t,0.6)*s*0.9;
    pts.push([cx+Math.cos(a)*r, cy+Math.sin(a)*r]);
  }
  return pts;
}
function genExpand(){
  const cx=W/2, cy=H/2, s=Math.min(W,H)*0.36, pts=[];
  const rings=[{r:0,n:30},{r:0.22,n:130},{r:0.44,n:280},{r:0.65,n:400},{r:0.83,n:480},{r:0.96,n:500}];
  for(const ring of rings) for(let i=0;i<ring.n;i++){
    const a=Math.random()*Math.PI*2;
    pts.push([cx+Math.cos(a)*ring.r*s, cy+Math.sin(a)*ring.r*s]);
  }
  return pts;
}
function genScatter(){
  const cx=W/2, cy=H/2, s=Math.min(W,H)*0.5;
  return Array.from({length:N}, ()=>{ const a=Math.random()*Math.PI*2,r=Math.random()*s; return[cx+Math.cos(a)*r, cy+Math.sin(a)*r]; });
}

const CVERTS=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
const CEDGES=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
const CASS=[];
(()=>{
  const pe=Math.floor(N*0.90/CEDGES.length);
  for(let e=0;e<CEDGES.length;e++) for(let i=0;i<pe;i++){
    const sp=Math.random()<0.15?5:1.2;
    CASS.push({type:'edge',e,t:i/pe,jx:(Math.random()-0.5)*sp,jy:(Math.random()-0.5)*sp});
  }
  for(let v=0;v<8;v++) for(let i=0;i<8;i++) CASS.push({type:'vert',v,jx:(Math.random()-0.5)*6,jy:(Math.random()-0.5)*6});
  while(CASS.length<N){ const e=Math.floor(Math.random()*CEDGES.length); CASS.push({type:'edge',e,t:Math.random(),jx:(Math.random()-0.5)*1.2,jy:(Math.random()-0.5)*1.2}); }
})();

let tick = 0;
function genCube(){
  const cx=W/2, cy=H/2, s=Math.min(W,H)*0.22, t=tick*0.006;
  function rot(v){
    let[x,y,z]=v;
    const a1=t*0.55; [x,y]=[x*Math.cos(a1)-y*Math.sin(a1), x*Math.sin(a1)+y*Math.cos(a1)];
    const a2=t*0.38; [x,z]=[x*Math.cos(a2)-z*Math.sin(a2), x*Math.sin(a2)+z*Math.cos(a2)];
    const a3=t*0.22; [y,z]=[y*Math.cos(a3)-z*Math.sin(a3), y*Math.sin(a3)+z*Math.cos(a3)];
    return[x,y,z];
  }
  function proj(v){ const[x,y,z]=rot(v); const f=1/(3.8-z); return[cx+x*f*s*3.2, cy+y*f*s*3.2]; }
  const pr=CVERTS.map(proj), pts=[];
  for(let i=0;i<N;i++){
    const a=CASS[i];
    if(!a){pts.push([cx,cy]);continue;}
    if(a.type==='edge'){ const[ea,eb]=CEDGES[a.e]; const pa=pr[ea],pb=pr[eb]; pts.push([pa[0]+(pb[0]-pa[0])*a.t+a.jx, pa[1]+(pb[1]-pa[1])*a.t+a.jy]); }
    else{ pts.push([pr[a.v][0]+a.jx, pr[a.v][1]+a.jy]); }
  }
  return pts;
}

function computeTargets(shape){
  let pts;
  if(shape==='human') pts=genHuman();
  else if(shape==='vortex') pts=genVortex();
  else if(shape==='expand') pts=genExpand();
  else if(shape==='cube') pts=genCube();
  else pts=genScatter();
  while(pts.length<N) pts.push(pts[Math.floor(Math.random()*pts.length)]);
  return pts.slice(0,N);
}

// ── AI shapes ──
const VERCEL = 'https://insight-five-phi.vercel.app/api/insight';
const aiShapes = {}; // label -> points[]

async function generateShape(prompt, label){
  try{
    const res = await fetch(VERCEL, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({prompt})
    });
    const data = await res.json();
    if(data.error) throw new Error(data.error);
    return data.points;
  } catch(e){
    console.error('generateShape error:', e);
    return null;
  }
}

function genCustom(label){
  const pts = aiShapes[label];
  if(!pts||!pts.length) return genScatter();
  const cx=W/2, cy=H/2, s=Math.min(W,H)*0.38;
  const result = pts.map(([x,y])=>[cx+x*s, cy+y*s+(Math.random()-0.5)*1.5]);
  while(result.length<N) result.push(result[Math.floor(Math.random()*result.length)]);
  return result.slice(0,N);
}

// ── Active state ──
let activeShape = null;
let activeColor = [184,164,122];
let activeChaos = 0.2;
let activeSpeed = 0.5;
let exploding=false, explodeTimer=0;
let wavePhase=0, waveActive=false;

const PARAMS = {
  human:  {chaos:0.26, speed:0.5},
  vortex: {chaos:0.94, speed:2.1},
  expand: {chaos:0.09, speed:0.3},
  cube:   {chaos:0.18, speed:0.75},
  scatter:{chaos:0.5,  speed:0.8}
};

function hexRgb(h){ return[parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)]; }

function applyTransition(newT, trans){
  exploding=false; explodeTimer=0; waveActive=false; wavePhase=0;
  if(trans==='explosion'){
    exploding=true; explodeTimer=0;
    setTimeout(()=>{ targets=newT; }, 400);
  } else if(trans==='wave'){
    waveActive=true; wavePhase=0; targets=newT;
  } else if(trans==='dissolve'){
    targets=particles.map(()=>[W/2+(Math.random()-0.5)*W*0.9, H/2+(Math.random()-0.5)*H*0.9]);
    setTimeout(()=>{ targets=newT; }, 600);
  } else if(trans==='pulse'){
    targets=particles.map(()=>[W/2+(Math.random()-0.5)*20, H/2+(Math.random()-0.5)*20]);
    setTimeout(()=>{ targets=newT; }, 500);
  } else if(trans==='spiral'){
    targets=particles.map((_,i)=>{ const a=(i/N)*Math.PI*6,r=Math.min(W,H)*0.55; return[W/2+Math.cos(a)*r, H/2+Math.sin(a)*r]; });
    setTimeout(()=>{ targets=newT; }, 700);
  } else {
    targets=newT;
  }
}

function applyState(shape, colorArr, trans){
  const p = PARAMS[shape]||{chaos:0.2,speed:0.5};
  activeShape=shape; activeColor=colorArr;
  activeChaos=p.chaos; activeSpeed=p.speed;
  document.documentElement.style.setProperty('--accent', `rgb(${colorArr.join(',')})`);
  applyTransition(computeTargets(shape), trans);
}

function applyCustomState(label, colorArr, trans){
  activeShape='custom_'+label; activeColor=colorArr;
  activeChaos=0.15; activeSpeed=0.4;
  document.documentElement.style.setProperty('--accent', `rgb(${colorArr.join(',')})`);
  applyTransition(genCustom(label), trans);
}

// ── Draw loop ──
function engineDraw(){
  tick++;
  const persistence = activeChaos>0.8 ? 0.62 : 0.78;
  ctx.fillStyle = `rgba(5,5,10,${persistence})`;
  ctx.fillRect(0,0,W,H);

  if(!activeShape){ requestAnimationFrame(engineDraw); return; }

  if(activeShape==='cube' && !exploding){
    const nt=genCube();
    for(let i=0;i<N;i++) if(targets[i]) targets[i]=nt[i];
  }

  const[r,g,b]=activeColor;
  const isCube=activeShape==='cube', isExp=exploding;

  for(let i=0;i<N;i++){
    const p=particles[i], t=targets[i]; if(!t) continue;
    if(isExp){
      p.vx+=(Math.random()-0.5)*5; p.vy+=(Math.random()-0.5)*5;
      p.vx*=0.90; p.vy*=0.90;
    } else {
      const dx=t[0]-p.x, dy=t[1]-p.y;
      let pullMult=1;
      if(waveActive){ const wp=wavePhase-i/N; pullMult=Math.max(0,Math.min(1,wp*3)); }
      const nm=isCube?0.3:activeChaos*3.2;
      const nx=noise(p.x*0.003+tick*0.004*activeSpeed, p.ph)*nm;
      const ny=noise(p.y*0.003+tick*0.003*activeSpeed, p.phy)*nm;
      const pull=(isCube?0.042:0.024)*p.mass*(1+activeChaos*0.3)*pullMult;
      const fric=isCube?0.80:p.fric;
      p.vx=(p.vx+dx*pull+nx)*fric;
      p.vy=(p.vy+dy*pull+ny)*fric;
    }
    p.x+=p.vx; p.y+=p.vy;
    const sz=p.sz*(0.35+p.z*0.85)*(1+activeChaos*0.2*Math.sin(tick*0.018+p.ph));
    const alpha=isExp?0.2:(0.55+p.z*0.42);
    if(!isExp&&isCube){ ctx.beginPath();ctx.arc(p.x,p.y,sz*5,0,Math.PI*2);ctx.fillStyle=`rgba(${r},${g},${b},0.02)`;ctx.fill(); }
    else if(!isExp&&p.z>0.55){ ctx.beginPath();ctx.arc(p.x,p.y,sz*3,0,Math.PI*2);ctx.fillStyle=`rgba(${r},${g},${b},${alpha*0.08})`;ctx.fill(); }
    ctx.beginPath();ctx.arc(p.x,p.y,Math.max(0.1,sz),0,Math.PI*2);
    ctx.fillStyle=`rgba(${r},${g},${b},${Math.min(1,alpha)})`;ctx.fill();
  }

  if(isExp){ explodeTimer++; if(explodeTimer>28){exploding=false;explodeTimer=0;} }
  if(waveActive){ wavePhase+=0.012; if(wavePhase>1.3) waveActive=false; }
  requestAnimationFrame(engineDraw);
}
