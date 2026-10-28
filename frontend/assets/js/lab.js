(function(){
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const $=id=>document.getElementById(id);
const COL={bg:0xEEF2F8,gold:0xF2A922,sky:0x2F5BD3,red:0xD9472F,green:0x1C8A57,violet:0x7E4CC9,ink:0x0F1B33,muted:0x5B6680,line:0xE3E7EF};
const inr=v=>(v<0?'−':'')+'₹'+Math.round(Math.abs(v)).toLocaleString('en-IN');
const lakh=v=>{const a=Math.abs(v);return (v<0?'−':'')+'₹'+(a>=1e7?(a/1e7).toFixed(2)+' Cr':a>=1e5?(a/1e5).toFixed(2)+' L':Math.round(a).toLocaleString('en-IN'));};
const lk=v=>(v<0?'−':'')+'₹'+(Math.abs(v)>=100?(Math.abs(v)/100).toFixed(2)+' Cr':Math.round(Math.abs(v))+' L');
function pressSeg(seg,btn){seg.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b===btn));}
function poisson(l){if(l<=0)return 0;if(l>30)return Math.max(0,Math.round(l+Math.sqrt(l)*gauss()));let L=Math.exp(-l),k=0,p=1;do{k++;p*=Math.random();}while(p>L);return k-1;}
function gauss(){let u=0,v=0;while(!u)u=Math.random();while(!v)v=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]];}return a;}
const erf=x=>{const s=Math.sign(x);x=Math.abs(x);const t=1/(1+.3275911*x);return s*(1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-x*x));};
const Phi=z=>.5*(1+erf(z/Math.SQRT2)),phi=z=>Math.exp(-z*z/2)/Math.sqrt(2*Math.PI);
function invPhi(p){p=Math.min(Math.max(p,1e-6),1-1e-6);const a=[-39.6968302866538,220.946098424521,-275.928510446969,138.357751867269,-30.6647980661472,2.50662827745924],b=[-54.4760987982241,161.585836858041,-155.698979859887,66.8013118877197,-13.2806815528857],c=[-.00778489400243029,-.322396458041136,-2.40075827716184,-2.54973253934373,4.37466414146497,2.93816398269878],d=[.00778469570904146,.32246712907004,2.445134137143,3.75440866190742];const pl=.02425;let q,r;if(p<pl){q=Math.sqrt(-2*Math.log(p));return(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);}if(p>1-pl){q=Math.sqrt(-2*Math.log(1-p));return-(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);}q=p-.5;r=q*q;return(((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);}
const expProfit=(Q,mu,sd,p,c,s)=>{const z=(Q-mu)/sd,L=phi(z)-z*(1-Phi(z));return (p-s)*(mu-sd*L)-(c-s)*Q;};
const optQ=(mu,sd,p,c,s)=>{const cr=(p-c)/(p-s);return cr<=0?0:Math.max(0,mu+sd*invPhi(cr));};
function logTo(el,html,max=4){const d=document.createElement('div');d.innerHTML=html;el.prepend(d);while(el.children.length>max)el.lastChild.remove();}

/* ---------- 2D canvas helper ---------- */
function fit2d(cv){const r=cv.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);cv.width=Math.max(1,r.width*dpr);cv.height=Math.max(1,r.height*dpr);const ctx=cv.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);return{ctx,w:r.width,h:r.height};}

/* ================= 3D infrastructure ================= */
const has3D=typeof THREE!=='undefined'&&THREE.OrbitControls;
const stages=[];
const vis=new IntersectionObserver(es=>es.forEach(e=>{if(e.target._st)e.target._st.visible=e.isIntersecting;}),{rootMargin:'100px'});
function stage(host,o){
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.setClearColor(COL.bg,0);
  renderer.domElement.setAttribute('aria-hidden','true');
  host.prepend(renderer.domElement);
  const scene=new THREE.Scene();if(o.fog)scene.fog=new THREE.Fog(COL.bg,o.fog[0],o.fog[1]);
  const camera=new THREE.PerspectiveCamera(o.fov||40,1,.1,300);camera.position.set(...o.cam);const base=new THREE.Vector3(...o.cam),tgt=new THREE.Vector3(...(o.target||[0,0,0]));
  const controls=new THREE.OrbitControls(camera,renderer.domElement);
  controls.target.set(...(o.target||[0,0,0]));controls.enableDamping=true;controls.dampingFactor=.08;controls.enableZoom=false;controls.enablePan=false;
  controls.autoRotate=!reduce&&!!o.spin;controls.autoRotateSpeed=o.spin||0;
  if(o.maxPolar)controls.maxPolarAngle=o.maxPolar;if(o.minPolar)controls.minPolarAngle=o.minPolar;
  renderer.domElement.style.touchAction='pan-y';
  scene.add(new THREE.AmbientLight(0xffffff,o.amb??.72));
  const dl=new THREE.DirectionalLight(0xffffff,o.dir??.85);dl.position.set(6,12,8);scene.add(dl);
  const rim=new THREE.DirectionalLight(0xBFD0FF,.3);rim.position.set(-8,4,-6);scene.add(rim);
  const st={host,renderer,scene,camera,controls,visible:false,tick:null};
  const fit=()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();if(!o.onResize){const a=w/h,k=a<1.25?Math.pow(1.25/a,.9):1;camera.position.copy(base.clone().sub(tgt).multiplyScalar(k).add(tgt));}if(o.onResize)o.onResize(w,h,camera);};
  new ResizeObserver(fit).observe(host);fit();
  host._st=st;vis.observe(host);stages.push(st);return st;
}
function label(text,{color='#0F1B33',size=.3,bg='rgba(255,255,255,.92)'}={}){
  const c=document.createElement('canvas'),x=c.getContext('2d'),fs=44;
  x.font=`600 ${fs}px "IBM Plex Mono",ui-monospace,monospace`;const w=Math.ceil(x.measureText(text).width)+28;c.width=w;c.height=fs+22;
  x.font=`600 ${fs}px "IBM Plex Mono",ui-monospace,monospace`;
  if(bg){x.fillStyle=bg;const r=12;x.beginPath();x.moveTo(r,0);x.arcTo(w,0,w,c.height,r);x.arcTo(w,c.height,0,c.height,r);x.arcTo(0,c.height,0,0,r);x.arcTo(0,0,w,0,r);x.fill();}
  x.fillStyle=color;x.textBaseline='middle';x.fillText(text,14,c.height/2+2);
  const tex=new THREE.CanvasTexture(c);tex.minFilter=THREE.LinearFilter;
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false}));s.scale.set(size*w/c.height,size,1);return s;
}
let last=performance.now();
function loop(now){const dt=Math.min(.05,(now-last)/1000);last=now;const t=now/1000;
  stages.forEach(s=>{if(!s.visible)return;if(s.tick)s.tick(dt,t);s.controls.update();s.renderer.render(s.scene,s.camera);});
  swarmFrame(dt);requestAnimationFrame(loop);}

/* ================= HERO GLOBE ================= */
function initGlobe(){
  const host=$('globe');
  const g=new THREE.Group();
  const place=()=>{g.position.set(0,0,0);};
  const st=stage(host,{cam:[0,.6,6.6],spin:.45,fov:38,amb:.6,dir:.7,target:[0,0,0],onResize:(w,h,cam)=>{place(w);cam.position.z=6.9;}});
  const R=2;st.scene.add(g);place(host.clientWidth);
  const ll=(lat,lng,r=R)=>{const p=(90-lat)*Math.PI/180,t=(lng+180)*Math.PI/180;return new THREE.Vector3(-r*Math.sin(p)*Math.cos(t),r*Math.cos(p),r*Math.sin(p)*Math.sin(t));};
  const earth=new THREE.Group();g.add(earth);
  earth.add(new THREE.Mesh(new THREE.SphereGeometry(R*.99,64,48),new THREE.MeshPhongMaterial({color:0xFFFFFF,emissive:0xD6DEEC,shininess:12,specular:0xffffff})));
  // dot shell
  const N=3200,pts=new Float32Array(N*3);for(let i=0;i<N;i++){const y=1-(i/(N-1))*2,r=Math.sqrt(1-y*y),th=Math.PI*(3-Math.sqrt(5))*i;pts.set([Math.cos(th)*r*R*1.002,y*R*1.002,Math.sin(th)*r*R*1.002],i*3);}
  const dg=new THREE.BufferGeometry();dg.setAttribute('position',new THREE.BufferAttribute(pts,3));
  earth.add(new THREE.Points(dg,new THREE.PointsMaterial({color:0xA9B6CC,size:.022,transparent:true,opacity:.9})));
  // graticule
  const gm=new THREE.LineBasicMaterial({color:0xC9D3E3,transparent:true,opacity:.6});
  for(let lat=-60;lat<=60;lat+=30){const p=[];for(let l=0;l<=360;l+=6)p.push(ll(lat,l,R*1.001));earth.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(p),gm));}
  for(let lng=0;lng<360;lng+=30){const p=[];for(let la=-90;la<=90;la+=6)p.push(ll(la,lng,R*1.001));earth.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(p),gm));}
  // atmosphere
  earth.add(new THREE.Mesh(new THREE.SphereGeometry(R*1.12,48,32),new THREE.MeshBasicMaterial({color:0x2F5BD3,transparent:true,opacity:.06,side:THREE.BackSide})));
  const hubs={DEL:[28.6,77.2],BOM:[19.1,72.9],BLR:[13,77.6]};
  const dests=[['Goa',15.4,73.9,'BOM',1],['Dubai',25.2,55.3,'DEL',1],['Bangkok',13.75,100.5,'DEL',.9],['Bali',-8.4,115.2,'BLR',.7],['Singapore',1.35,103.8,'BLR',.8],['Maldives',3.2,73.2,'BLR',.6],['Makkah',21.4,39.8,'BOM',.9],['Phuket',7.9,98.4,'BOM',.5],['Da Nang',16.05,108.2,'DEL',.5],['Manali',32.2,77.2,'DEL',.6],['Jaipur',26.9,75.8,'BOM',.6],['Kochi',9.9,76.3,'DEL',.5],['Srinagar',34.1,74.8,'BOM',.4],['London',51.5,-.1,'DEL',.6],['Kuala Lumpur',3.14,101.7,'BOM',.5],['Tbilisi',41.7,44.8,'DEL',.4]];
  const packets=[];
  Object.entries(hubs).forEach(([k,[la,ln]])=>{const v=ll(la,ln,R*1.01);const m=new THREE.Mesh(new THREE.SphereGeometry(.045,16,12),new THREE.MeshBasicMaterial({color:COL.ink}));m.position.copy(v);earth.add(m);const lb=label(k,{size:.12,color:'#0F1B33'});lb.position.copy(ll(la,ln,R*1.12));earth.add(lb);});
  const rings=[];
  dests.forEach(([n,la,ln,h,w])=>{
    const a=ll(...hubs[h],R*1.01),b=ll(la,ln,R*1.01),dist=a.distanceTo(b);
    const mid=a.clone().add(b).multiplyScalar(.5).normalize().multiplyScalar(R*1.01+Math.max(.12,dist*.42));
    const curve=new THREE.QuadraticBezierCurve3(a,mid,b);
    earth.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(60)),new THREE.LineBasicMaterial({color:0xE39A0B,transparent:true,opacity:.5})));
    const dot=new THREE.Mesh(new THREE.SphereGeometry(.03+.03*w,16,12),new THREE.MeshBasicMaterial({color:COL.gold}));dot.position.copy(b);earth.add(dot);
    const ring=new THREE.Mesh(new THREE.RingGeometry(.06,.075,32),new THREE.MeshBasicMaterial({color:COL.gold,transparent:true,opacity:.7,side:THREE.DoubleSide}));ring.position.copy(b);ring.lookAt(b.clone().multiplyScalar(2));earth.add(ring);rings.push([ring,Math.random()*2]);
    if(w>=.8){const lb=label(n,{size:.1,color:'#C98200'});lb.position.copy(ll(la,ln,R*1.1));earth.add(lb);}
    const k=Math.max(1,Math.round(w*3));for(let i=0;i<k;i++){const p=new THREE.Mesh(new THREE.SphereGeometry(.02,8,8),new THREE.MeshBasicMaterial({color:0xE08A00}));earth.add(p);packets.push({p,curve,t:Math.random(),sp:.18+Math.random()*.12});}
  });
  const india=ll(20,78).normalize();earth.quaternion.setFromUnitVectors(india,new THREE.Vector3(0,.25,1).normalize());
  st.tick=(dt,t)=>{packets.forEach(o=>{o.t=(o.t+dt*o.sp)%1;o.p.position.copy(o.curve.getPoint(o.t));});
    rings.forEach(([r,ph])=>{const k=((t*.6+ph)%1);r.scale.setScalar(1+k*2.2);r.material.opacity=.7*(1-k);});};
  st.renderer.render(st.scene,st.camera);
}

/* ================= SIM 1 · TOWER ================= */
const tw={};
function initTower(){
  const host=$('towerVp');
  const st=stage(host,{cam:[7.5,4.6,8.5],target:[0,2.3,0],spin:.35,fov:42,maxPolar:Math.PI*.48,fog:[14,26]});
  const F=10,Cc=12;tw.N=F*Cc*2;
  const ground=new THREE.Mesh(new THREE.CircleGeometry(9,64),new THREE.MeshStandardMaterial({color:0xEEF1F7,roughness:.9}));ground.rotation.x=-Math.PI/2;st.scene.add(ground);
  const gridH=new THREE.GridHelper(18,36,0xC9D2E1,0xE1E6EF);gridH.position.y=.005;st.scene.add(gridH);
  const W=Cc*.52+.3,H=F*.46+.3;
  const core=new THREE.Mesh(new THREE.BoxGeometry(W-.2,H,.34),new THREE.MeshStandardMaterial({color:0x1E2D50,roughness:.7}));core.position.y=H/2;st.scene.add(core);
  const slabM=new THREE.MeshStandardMaterial({color:0x2B3D66,roughness:.6});
  for(let f=0;f<=F;f++){const s=new THREE.Mesh(new THREE.BoxGeometry(W,.05,1.12),slabM);s.position.y=.1+f*.46;st.scene.add(s);}
  const roof=new THREE.Mesh(new THREE.BoxGeometry(2.2,.5,.8),slabM);roof.position.y=H+.25;st.scene.add(roof);
  const sign=label('GOA · 31 DEC',{size:.32,color:'#C98200'});sign.position.set(0,H+.95,0);st.scene.add(sign);
  const mat=new THREE.MeshStandardMaterial({roughness:.45,metalness:.05});
  const im=new THREE.InstancedMesh(new THREE.BoxGeometry(.42,.33,.3),mat,tw.N);st.scene.add(im);
  tw.pos=[];const d=new THREE.Object3D();
  let k=0;for(let side=0;side<2;side++)for(let f=0;f<F;f++)for(let c=0;c<Cc;c++){const p=[(c-(Cc-1)/2)*.52,.3+f*.46,side?-.34:.34];tw.pos.push(p);d.position.set(...p);d.updateMatrix();im.setMatrixAt(k,d.matrix);im.setColorAt(k,new THREE.Color(0x1B2540));k++;}
  im.instanceMatrix.needsUpdate=true;im.instanceColor.needsUpdate=true;tw.im=im;tw.dummy=d;
  // spark pool
  tw.sparks=[];const sg=new THREE.SphereGeometry(.06,8,8);
  for(let i=0;i<60;i++){const m=new THREE.Mesh(sg,new THREE.MeshBasicMaterial({color:COL.red,transparent:true,opacity:0}));m.visible=false;st.scene.add(m);tw.sparks.push({m,life:0,v:new THREE.Vector3()});}
  tw.pulse=new Float32Array(tw.N);
  st.tick=(dt)=>{towerTick(dt);
    tw.sparks.forEach(s=>{if(s.life<=0)return;s.life-=dt;s.m.position.addScaledVector(s.v,dt);s.v.y-=dt*1.2;s.m.material.opacity=Math.max(0,s.life);if(s.life<=0)s.m.visible=false;});
    let dirty=false;for(let i=0;i<tw.N;i++){if(tw.pulse[i]>0){tw.pulse[i]=Math.max(0,tw.pulse[i]-dt*2.5);const sc=1+tw.pulse[i]*.45;d.position.set(...tw.pos[i]);d.scale.setScalar(sc);d.updateMatrix();im.setMatrixAt(i,d.matrix);dirty=true;}}
    if(dirty){d.scale.setScalar(1);im.instanceMatrix.needsUpdate=true;}};
  towerReset();
}
const TC=[0x3A4D78,0x9FAAC0,0xF6DDA5,0xF2A922,0x4F7BE6,0xD9472F];
const tState={Q:60,dem:'normal',cx:.12,speed:2,playing:false};
const DEM={low:{mu:45,fill:.62},normal:{mu:75,fill:.92},festival:{mu:118,fill:1.25}};
const TD=90,TP=8500,TCst=6000,TS=1500,TM=900;
function towerReset(){
  const s=tState;s.playing=false;$('tPlay').textContent='Play season';
  const front=shuffle([...Array(120).keys()]),back=[...Array(120).keys()].map(i=>i+120);
  tw.allot=front.slice(0,s.Q);
  tw.state=new Uint8Array(tw.N);tw.allot.forEach(i=>tw.state[i]=2);
  tw.free=shuffle([...front.slice(s.Q),...back]);
  tw.held=[...tw.allot];tw.soldA=[];tw.soldF=[];
  const D=DEM[s.dem],dem=Math.max(5,Math.round(D.mu*(1+.22*gauss())));
  const wT=[],wO=[];let sT=0,sO=0;for(let d=TD;d>=1;d--){const a=Math.exp(-d/24),b=Math.exp(-d/42);wT.push(a);wO.push(b);sT+=a;sO+=b;}
  const other=240*D.fill;
  tw.plan=wT.map((a,i)=>({t:poisson(dem*a/sT),o:poisson(other*wO[i]/sO)}));
  tw.day=TD;tw.acc=0;tw.lost=0;tw.cancels=0;tw.sellout=false;tw.curve=[];tw.done=false;tw.searches=0;
  $('tLog').innerHTML='';logTo($('tLog'),`<b>T−${TD}</b> TBO holds ${s.Q} rooms, paid ${lakh(s.Q*TCst)} upfront`);
  paintTower();hudTower();drawSpark();
}
function paintTower(){if(!has3D)return;const c=new THREE.Color();for(let i=0;i<tw.N;i++){c.setHex(TC[tw.state[i]]);tw.im.setColorAt(i,c);}tw.im.instanceColor.needsUpdate=true;}
function profitNow(){return tw.soldA.length*TP-tState.Q*TCst+tw.soldF.length*TM+(tw.done?tw.held.length*TS:0);}
function hudTower(){$('tDay').textContent=tw.done?'Check-in':tw.day;$('tSold').textContent=(tw.soldA.length+tw.soldF.length);$('tLost').textContent=tw.lost;const p=profitNow(),e=$('tProfit');e.textContent=lakh(p);e.style.color=p<0?'var(--red)':'var(--green)';}
function spark(){const s=tw.sparks.find(x=>x.life<=0);if(!s)return;const side=Math.random()<.5?1:-1;s.m.position.set((Math.random()-.5)*6,.2,side*(1.6+Math.random()*1.5));s.v.set((Math.random()-.5)*.8,1.6+Math.random()*1.4,side*(.5+Math.random()));s.life=1;s.m.visible=true;}
function towerStep(){
  if(tw.day<=0){finishTower();return;}
  const day=tw.plan[TD-tw.day];
  for(let i=0;i<day.o;i++){if(tw.free.length){const r=tw.free.pop();tw.state[r]=1;}}
  for(let i=0;i<day.t;i++){tw.searches+=3;
    if(tw.held.length){const r=tw.held.pop();tw.state[r]=3;tw.soldA.push(r);tw.pulse[r]=1;}
    else if(tw.free.length){const r=tw.free.pop();tw.state[r]=4;tw.soldF.push(r);tw.pulse[r]=1;}
    else{tw.lost++;spark();spark();}}
  if(!tw.sellout&&!tw.free.length){tw.sellout=true;logTo($('tLog'),`<b>T−${tw.day}</b> Hotel sold out on other channels`);}
  const h=tState.cx/(TD*.55);
  tw.soldA=tw.soldA.filter(r=>{if(Math.random()<h){tw.state[r]=2;tw.held.push(r);tw.cancels++;return false;}return true;});
  tw.soldF=tw.soldF.filter(r=>{if(Math.random()<h){tw.state[r]=0;tw.free.push(r);tw.cancels++;return false;}return true;});
  tw.curve.push([tw.soldA.length+tw.soldF.length,tw.lost]);
  if(tw.day===60||tw.day===30||tw.day===7)logTo($('tLog'),`<b>T−${tw.day}</b> ${tw.soldA.length} of ${tState.Q} block rooms sold · ${tw.lost} searches lost`);
  tw.day--;paintTower();hudTower();drawSpark();
}
function finishTower(){tw.done=true;tState.playing=false;$('tPlay').textContent='Replay';
  const waste=tw.held.length;tw.held.forEach(r=>tw.state[r]=5);paintTower();hudTower();
  logTo($('tLog'),`<b>Check-in</b> ${waste} rooms wasted · ${tw.lost} lost · ${tw.cancels} cancels · profit ${lakh(profitNow())}`);}
function towerTick(dt){if(!tState.playing||tw.done)return;tw.acc+=dt;const dur=.32/tState.speed;while(tw.acc>dur&&!tw.done){tw.acc-=dur;towerStep();}}
function drawSpark(){const cv=$('tSpark');const{ctx,w,h}=fit2d(cv);ctx.clearRect(0,0,w,h);
  ctx.strokeStyle='#E3E7EF';ctx.beginPath();ctx.moveTo(0,h-14);ctx.lineTo(w,h-14);ctx.stroke();
  const max=Math.max(20,...tw.curve.map(c=>Math.max(c[0],c[1])));
  [[0,'#C98200'],[1,'#D9472F']].forEach(([k,c])=>{ctx.strokeStyle=c;ctx.lineWidth=2;ctx.beginPath();tw.curve.forEach((p,i)=>{const x=i/(TD-1)*w,y=h-14-p[k]/max*(h-24);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();});
  ctx.fillStyle='#5B6680';ctx.font='500 10px "IBM Plex Mono",monospace';ctx.fillText('T−90',0,h-2);ctx.textAlign='right';ctx.fillText('check-in',w,h-2);ctx.textAlign='left';
  ctx.fillStyle='#C98200';ctx.fillText('bookings',4,11);ctx.fillStyle='#D9472F';ctx.fillText('lost',72,11);}
function bindTower(){
  const q=$('tQ'),cx=$('tCx'),sp=$('tSp');
  const out=()=>{$('oQ').textContent=q.value+' rooms';$('oCx').textContent=cx.value+'%';$('oSp').textContent=sp.value+'×';};
  q.oninput=()=>{tState.Q=+q.value;out();towerReset();};
  cx.oninput=()=>{tState.cx=cx.value/100;out();};
  sp.oninput=()=>{tState.speed=+sp.value;out();};
  $('tDem').onclick=e=>{const b=e.target.closest('button');if(!b)return;pressSeg($('tDem'),b);tState.dem=b.dataset.v;towerReset();};
  $('tPlay').onclick=()=>{if(tw.done)towerReset();tState.playing=!tState.playing;$('tPlay').textContent=tState.playing?'Pause':'Play season';};
  $('tReset').onclick=towerReset;
  $('tAuto').onclick=()=>{const mu=DEM[tState.dem].mu,Q=Math.min(120,Math.round(optQ(mu,mu*.22,TP,TCst,TS)/2)*2);q.value=Q;tState.Q=Q;out();towerReset();logTo($('tLog'),`<b>Forecast</b> demand ≈ ${mu} ± ${Math.round(mu*.22)} → buy ${Q} rooms`);};
  out();
}

/* ================= SIM 2 · SWARM (2D) ================= */
const sw={parts:[],fx:[],t:0,day:1,stock:[],max:[],booked:0,lost:0,waste:0,search:0,pre:8,demand:5,fest:false,smart:false,acc:0,visible:false};
const SWC=[['Delhi',.25],['Mumbai',.4],['Bengaluru',.6],['Dubai',.78]];
const SWD=[['Goa',.16,1.4],['Bangkok',.34,1.1],['Bali',.52,.8],['Manali',.7,.7],['Makkah',.86,1]];
function swWeights(){return SWD.map((d,i)=>d[2]*(sw.fest&&i===0?2.5:1));}
function restock(){const w=swWeights(),tot=w.reduce((a,b)=>a+b,0);
  sw.stock.forEach(s=>sw.waste+=s);
  sw.max=SWD.map((d,i)=>sw.smart?Math.round(sw.pre*SWD.length*w[i]/tot):sw.pre);sw.stock=[...sw.max];}
function swReset(){sw.parts=[];sw.fx=[];sw.day=1;sw.booked=sw.lost=sw.waste=sw.search=0;sw.stock=[];restock();sw.waste=0;sw.t=0;swHud();}
function swHud(){$('sDay').textContent=sw.day;$('sLost').textContent=sw.lost;$('sWaste').textContent=sw.waste;$('sBooked').textContent=sw.booked;$('sSearch').textContent=sw.search;
  $('sLtb').textContent=sw.search?Math.round(sw.booked/sw.search*100)+'%':'0%';
  const p=sw.booked*2500-sw.waste*4500,e=$('sProfit');e.textContent=lakh(p);e.style.color=p<0?'var(--red)':'var(--green)';
  const bought=sw.booked+sw.waste;$('sFill').textContent=bought?Math.round(sw.booked/bought*100)+'%':'–';}
let swCtx=null,swW=0,swH=0;
function swFit(){const r=fit2d($("swarmCv"));swCtx=r.ctx;swW=r.w;swH=r.h;}
function swFrame(dt){if(!sw.visible||!swCtx)return;
  sw.t+=dt;sw.acc+=dt;
  if(sw.t>7){sw.t=0;sw.day++;restock();}
  const rate=sw.demand*2.2*(sw.fest?1.35:1);
  while(sw.acc>1/rate){sw.acc-=1/rate;const w=swWeights(),tot=w.reduce((a,b)=>a+b,0);let r=Math.random()*tot,di=0;while(r>w[di]){r-=w[di];di++;}
    const ci=Math.random()*SWC.length|0;sw.search++;
    sw.parts.push({ci,di,t:0,sp:.35+Math.random()*.25,jit:(Math.random()-.5)*.25,state:0});}
  const X0=swW*.13,X1=swW*.8,ctx=swCtx;
  ctx.clearRect(0,0,swW,swH);
  // links
  ctx.lineWidth=1;SWC.forEach(c=>SWD.forEach(d=>{ctx.strokeStyle='rgba(15,27,51,.07)';ctx.beginPath();ctx.moveTo(X0,c[1]*swH);ctx.bezierCurveTo(swW*.45,c[1]*swH,swW*.5,d[1]*swH,X1,d[1]*swH);ctx.stroke();}));
  // particles
  const bez=(p,a,b,c,d)=>{const u=1-p;return u*u*u*a+3*u*u*p*b+3*u*p*p*c+p*p*p*d;};
  sw.parts=sw.parts.filter(p=>{
    const y0=SWC[p.ci][1]*swH,y1=SWD[p.di][1]*swH;
    if(p.state===0){p.t+=dt*p.sp;if(p.t>=1){if(sw.stock[p.di]>0){sw.stock[p.di]--;sw.booked++;sw.fx.push({x:X1,y:y1,r:4,life:1,c:'224,138,0'});return false;}else{sw.lost++;p.state=1;p.t=1;sw.fx.push({x:X1,y:y1,r:3,life:.7,c:'217,71,47'});}}}
    else{p.t-=dt*.9;if(p.t<=.55)return false;}
    const x=bez(p.t,X0,swW*.45,swW*.5,X1),y=bez(p.t,y0,y0,y1,y1)+p.jit*20*Math.sin(p.t*Math.PI);
    ctx.fillStyle=p.state?'rgba(217,71,47,'+(p.t-.5)*2+')':'rgba(224,138,0,.95)';
    ctx.shadowColor=p.state?'#D9472F':'#C98200';ctx.shadowBlur=5;ctx.beginPath();ctx.arc(x,y,p.state?2.6:2.2,0,7);ctx.fill();return true;});
  ctx.shadowBlur=0;
  sw.fx=sw.fx.filter(f=>{f.life-=dt*1.6;f.r+=dt*40;ctx.strokeStyle=`rgba(${f.c},${Math.max(0,f.life)})`;ctx.lineWidth=2;ctx.beginPath();ctx.arc(f.x,f.y,f.r,0,7);ctx.stroke();return f.life>0;});
  // cities
  ctx.font='600 12px "IBM Plex Sans",system-ui,sans-serif';
  SWC.forEach(c=>{const y=c[1]*swH;ctx.fillStyle='#0F1B33';ctx.beginPath();ctx.arc(X0,y,6,0,7);ctx.fill();ctx.textAlign='right';ctx.fillText(c[0],X0-12,y+4);});
  // destinations with stock bars
  SWD.forEach((d,i)=>{const y=d[1]*swH,bw=Math.min(90,swW*.14),mx=Math.max(1,sw.max[i]||1),frac=(sw.stock[i]||0)/mx;
    ctx.fillStyle='#C98200';ctx.beginPath();ctx.arc(X1,y,7,0,7);ctx.fill();
    ctx.textAlign='left';ctx.fillStyle='#0F1B33';ctx.fillText(d[0],X1+14,y-5);
    ctx.fillStyle='#E3E7EF';ctx.fillRect(X1+14,y+2,bw,6);ctx.fillStyle=frac>0?'#C98200':'#D9472F';ctx.fillRect(X1+14,y+2,bw*frac,6);
    ctx.fillStyle='#5B6680';ctx.font='500 10px "IBM Plex Mono",monospace';ctx.fillText(`${sw.stock[i]||0}/${sw.max[i]||0}`,X1+14,y+20);ctx.font='600 12px "IBM Plex Sans",system-ui,sans-serif';});
  // day progress
  ctx.fillStyle='#E3E7EF';ctx.fillRect(0,swH-3,swW,3);ctx.fillStyle='#2F5BD3';ctx.fillRect(0,swH-3,swW*sw.t/7,3);
  swHud();
}
function swarmFrame(dt){swFrame(dt);}
function bindSwarm(){
  const pre=$('sPre'),dm=$('sDemand');
  const out=()=>{$('oPre').textContent=pre.value;$('oDemand').textContent=dm.value+' / 10';};
  pre.oninput=()=>{sw.pre=+pre.value;out();};dm.oninput=()=>{sw.demand=+dm.value;out();};
  $('sFest').onclick=e=>{sw.fest=!sw.fest;e.currentTarget.setAttribute('aria-pressed',sw.fest);};
  $('sSmart').onclick=e=>{sw.smart=!sw.smart;e.currentTarget.setAttribute('aria-pressed',sw.smart);};
  $('sReset').onclick=swReset;
  new ResizeObserver(swFit).observe($('swarmVp'));swFit();
  new IntersectionObserver(es=>es.forEach(e=>sw.visible=e.isIntersecting)).observe($('swarmVp'));
  out();swReset();
}

/* ================= surface helper ================= */
function gridGeo(nx,nz){const g=new THREE.BufferGeometry(),pos=new Float32Array(nx*nz*3),col=new Float32Array(nx*nz*3),idx=[];
  for(let j=0;j<nz-1;j++)for(let i=0;i<nx-1;i++){const a=j*nx+i,b=a+1,c=a+nx,d=c+1;idx.push(a,c,b,b,c,d);}
  g.setIndex(idx);g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('color',new THREE.BufferAttribute(col,3));return g;}

/* ================= SIM 3 · TIME SURFACE ================= */
const fs={T:-20,S:30,tau:20,shock:false};
const NS=60,ND=46;
const dateOf=i=>{const d=new Date(2026,11,1+i);return d.toLocaleDateString('en-IN',{day:'numeric',month:'short'});};
function finalDemand(s){const wk=new Date(2026,11,1+s).getDay();return 38+78*Math.exp(-(((s-29.5)/5.5)**2))+((wk===5||wk===6)?16:0)+(fs.shock?70*Math.exp(-(((s-13)/1.3)**2)):0);}
const fsx=s=>(s-(NS-1)/2)*.13,fsz=d=>(d/90)*5.6-2.8;
function initSurface(){
  const host=$('surfVp');
  const st=stage(host,{cam:[7.4,5.8,8.2],target:[0,.9,0],spin:0,fov:40,maxPolar:Math.PI*.47});
  const geo=gridGeo(NS,ND);
  const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.6,metalness:.05}));st.scene.add(mesh);
  st.scene.add(new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:0x0F1B33,wireframe:true,transparent:true,opacity:.07})));
  const base=new THREE.GridHelper(9,18,0xC9D2E1,0xE1E6EF);base.position.y=-.01;st.scene.add(base);
  const todayLine=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0x0F1B33,transparent:true,opacity:.55}));st.scene.add(todayLine);
  const stayLine=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0x0F1B33}));st.scene.add(stayLine);
  const a1=label('stay date →',{size:.2,color:'#5B6680'});a1.position.set(0,0,3.4);st.scene.add(a1);
  const a2=label('days before arrival →',{size:.2,color:'#5B6680'});a2.position.set(4.6,0,0);st.scene.add(a2);
  const a3=label('rooms booked ↑',{size:.26,color:'#5B6680'});a3.position.set(-4.4,2.6,-2.8);st.scene.add(a3);
  const l1=label('1 Dec',{size:.24,color:'#5B6680'});l1.position.set(fsx(0),0,3);st.scene.add(l1);
  const l2=label('31 Dec',{size:.24,color:'#C98200'});l2.position.set(fsx(30),0,3);st.scene.add(l2);
  const l3=label('29 Jan',{size:.24,color:'#5B6680'});l3.position.set(fsx(59),0,3);st.scene.add(l3);
  const cK1=new THREE.Color(0xF8E6BC),cK2=new THREE.Color(0xF2A922),cU1=new THREE.Color(0xE9EEF6),cU2=new THREE.Color(0x2F5BD3),tmp=new THREE.Color();
  function update(){
    const F=[...Array(NS)].map((_,s)=>finalDemand(s)),mx=160;
    const pos=geo.attributes.position.array,col=geo.attributes.color.array;
    for(let j=0;j<ND;j++){const d=j*2;for(let i=0;i<NS;i++){const k=(j*NS+i)*3,v=F[i]*Math.exp(-d/fs.tau),h=v/mx*2.8;
      pos[k]=fsx(i);pos[k+1]=h;pos[k+2]=fsz(d);
      const known=(i-d)<=fs.T,r=Math.min(1,v/mx*1.4);
      tmp.copy(known?cK1:cU1).lerp(known?cK2:cU2,known?r:r*.75);col[k]=tmp.r;col[k+1]=tmp.g;col[k+2]=tmp.b;}}
    geo.attributes.position.needsUpdate=true;geo.attributes.color.needsUpdate=true;geo.computeVertexNormals();
    const tp=[];for(let i=0;i<NS;i++){const d=i-fs.T;if(d>=0&&d<=90)tp.push(new THREE.Vector3(fsx(i),F[i]*Math.exp(-d/fs.tau)/mx*2.8+.03,fsz(d)));}
    todayLine.geometry.dispose();todayLine.geometry=new THREE.BufferGeometry().setFromPoints(tp);
    const sp=[];for(let d=0;d<=90;d+=2)sp.push(new THREE.Vector3(fsx(fs.S),F[fs.S]*Math.exp(-d/fs.tau)/mx*2.8+.04,fsz(d)));
    stayLine.geometry.dispose();stayLine.geometry=new THREE.BufferGeometry().setFromPoints(sp);
    const td=fs.T<0?`${-fs.T} days before 1 Dec`:dateOf(fs.T);$('fToday').textContent=fs.T<0?`${dateOf(0)} −${-fs.T}d`:td;$('oT').textContent=fs.T<0?`${-fs.T} days before 1 Dec`:dateOf(fs.T);
    $('fStay').textContent=dateOf(fs.S);$('oS').textContent=dateOf(fs.S);
    const d0=fs.S-fs.T,fin=F[fs.S];
    if(d0<=0){$('fOn').textContent=Math.round(fin)+' (stayed)';}else{const on=d0>90?0:fin*Math.exp(-d0/fs.tau);$('fOn').textContent=`${Math.round(on)} · ${Math.round(on/fin*100)}%`;}
    $('fFin').textContent=Math.round(fin)+' rooms';
  }
  fs.update=update;update();
  let anim=false;
  let tf=fs.T;
  st.tick=(dt)=>{if(!anim)return;tf+=dt*14;if(tf>=59){tf=59;anim=false;$('fPlay').textContent='Animate today';}const r=Math.round(tf);if(r!==fs.T){fs.T=r;$('fT').value=r;update();}};
  $('fPlay').onclick=()=>{anim=!anim;tf=fs.T;if(anim&&tf>=58)tf=-60;$('fPlay').textContent=anim?'Pause':'Animate today';};
}
function bindSurface(){
  $('fT').oninput=e=>{fs.T=+e.target.value;fs.update();};
  $('fS').oninput=e=>{fs.S=+e.target.value;fs.update();};
  $('fSeg').onclick=e=>{const b=e.target.closest('button');if(!b)return;pressSeg($('fSeg'),b);fs.tau=+b.dataset.v;fs.update();};
  $('fShock').onclick=e=>{fs.shock=!fs.shock;e.currentTarget.setAttribute('aria-pressed',fs.shock);fs.update();};
}

/* ================= SIM 4 · LANDSCAPE + MC ================= */
const ls={p:9000,c:6000,s:1500,Q:150,sig:30,mu:110};
const NQ=56,NG=40,QMAX=220;
const lx=Q=>(Q/QMAX)*7-3.5,lz=g=>((g-5)/55)*5-2.5;
function initLand(){
  const host=$('landVp');
  const st=stage(host,{cam:[7.6,6.4,9.4],target:[0,.3,0],spin:.25,fov:40,maxPolar:Math.PI*.48});
  const geo=gridGeo(NQ,NG);
  st.scene.add(new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.5,metalness:.1})));
  st.scene.add(new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:0x0F1B33,wireframe:true,transparent:true,opacity:.06})));
  const zero=new THREE.Mesh(new THREE.PlaneGeometry(7.4,5.4),new THREE.MeshBasicMaterial({color:0x2F5BD3,transparent:true,opacity:.07,side:THREE.DoubleSide,depthWrite:false}));zero.rotation.x=-Math.PI/2;st.scene.add(zero);
  const ridge=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0x0F1B33}));st.scene.add(ridge);
  const marker=new THREE.Mesh(new THREE.SphereGeometry(.13,24,16),new THREE.MeshStandardMaterial({color:COL.gold,emissive:0x5a3c00}));st.scene.add(marker);
  const stem=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:COL.gold}));st.scene.add(stem);
  const a1=label('rooms pre-bought →',{size:.2,color:'#5B6680'});a1.position.set(0,-.2,3.2);st.scene.add(a1);
  const a2=label('forecast uncertainty →',{size:.2,color:'#5B6680'});a2.position.set(4.5,-.2,0);st.scene.add(a2);
  const a3=label('expected profit ↑',{size:.26,color:'#5B6680'});a3.position.set(-4.3,2,-2.6);st.scene.add(a3);
  const cNeg=new THREE.Color(0xD9472F),cMid=new THREE.Color(0xE6EBF3),cPos=new THREE.Color(0xF2A922),tmp=new THREE.Color();
  let scale=1;
  function update(){
    const {p,c,s,mu}=ls,pos=geo.attributes.position.array,col=geo.attributes.color.array;
    scale=2.6/Math.max(1,(p-c)*mu);
    for(let j=0;j<NG;j++){const g=5+j*(55/(NG-1));for(let i=0;i<NQ;i++){const Q=i*(QMAX/(NQ-1)),E=expProfit(Q,mu,g,p,c,s),k=(j*NQ+i)*3;
      pos[k]=lx(Q);pos[k+1]=E*scale;pos[k+2]=lz(g);
      const r=E*scale/2.6;if(r>=0)tmp.copy(cMid).lerp(cPos,Math.min(1,r*1.2));else tmp.copy(cMid).lerp(cNeg,Math.min(1,-r*1.6));col[k]=tmp.r;col[k+1]=tmp.g;col[k+2]=tmp.b;}}
    geo.attributes.position.needsUpdate=true;geo.attributes.color.needsUpdate=true;geo.computeVertexNormals();
    const rp=[];for(let g=5;g<=60;g+=1){const Qs=Math.min(QMAX,optQ(mu,g,p,c,s));rp.push(new THREE.Vector3(lx(Qs),expProfit(Qs,mu,g,p,c,s)*scale+.05,lz(g)));}
    ridge.geometry.dispose();ridge.geometry=new THREE.BufferGeometry().setFromPoints(rp);
    const E=expProfit(ls.Q,mu,ls.sig,p,c,s),Qs=optQ(mu,ls.sig,p,c,s),Es=expProfit(Qs,mu,ls.sig,p,c,s);
    marker.position.set(lx(ls.Q),E*scale+.15,lz(ls.sig));
    stem.geometry.dispose();stem.geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(lx(ls.Q),0,lz(ls.sig)),marker.position.clone()]);
    $('lQv').textContent=ls.Q+' rooms';const e=$('lE');e.textContent=lakh(E);e.style.color=E<0?'var(--red)':'var(--gold)';
    $('lQs').textContent=Math.round(Qs)+' rooms';$('lGap').textContent=lakh(Math.max(0,Es-E));
    ls.Qs=Qs;
  }
  ls.update=update;update();
}
function bindLand(){
  const P=$('lP'),C=$('lC'),S=$('lS'),Q=$('lQ'),G=$('lSig');
  const out=()=>{$('oLP').textContent=inr(+P.value);$('oLC').textContent=inr(+C.value);$('oLS').textContent=inr(+S.value);$('oLQ').textContent=Q.value+' rooms';$('oLSig').textContent='± '+G.value;};
  const sync=()=>{let p=+P.value,c=+C.value,s=+S.value;if(c>=p){c=p-250;C.value=c;}if(s>=c){s=c-250;S.value=s;}Object.assign(ls,{p,c,s,Q:+Q.value,sig:+G.value});out();ls.update&&ls.update();};
  [P,C,S,Q,G].forEach(x=>x.oninput=sync);
  $('lSnap').onclick=()=>{Q.value=Math.round(ls.Qs/2)*2;sync();};
  $('mcRun').onclick=runMC;sync();
}
let mcAnim=null;
function runMC(){
  const {p,c,s,mu,sig,Q}=ls,Qs=ls.Qs||optQ(mu,sig,p,c,s),N=5000;
  const prof=(q,D)=>p*Math.min(D,q)+s*Math.max(q-D,0)-c*q;
  const A=[],B=[];for(let i=0;i<N;i++){const D=Math.max(0,mu+sig*gauss());A.push(prof(Q,D));B.push(prof(Qs,D));}
  const lo=Math.min(...A,...B),hi=Math.max(...A,...B),bins=46,bw=(hi-lo)/bins||1;
  const ha=new Array(bins).fill(0),hb=new Array(bins).fill(0);let n=0;
  const stat=arr=>{const s2=[...arr].sort((a,b)=>a-b);return{m:arr.reduce((a,b)=>a+b,0)/arr.length,p10:s2[Math.floor(arr.length*.1)],loss:arr.filter(x=>x<0).length/arr.length};};
  cancelAnimationFrame(mcAnim);
  const step=()=>{const end=Math.min(N,n+(reduce?N:180));for(;n<end;n++){ha[Math.min(bins-1,Math.floor((A[n]-lo)/bw))]++;hb[Math.min(bins-1,Math.floor((B[n]-lo)/bw))]++;}
    drawHist(ha,hb,lo,hi,bins,bw);
    const sa=stat(A.slice(0,n)),sb=stat(B.slice(0,n));
    $('mcM1').textContent=lakh(sa.m);$('mcM2').textContent=lakh(sb.m);$('mcP1').textContent=lakh(sa.p10);$('mcP2').textContent=lakh(sb.p10);
    $('mcL1').textContent=Math.round(sa.loss*100)+'%';$('mcL2').textContent=Math.round(sb.loss*100)+'%';
    if(n<N)mcAnim=requestAnimationFrame(step);};
  step();
}
function drawHist(ha,hb,lo,hi,bins,bw){const{ctx,w,h}=fit2d($('mcHist'));ctx.clearRect(0,0,w,h);
  const pad=22,mx=Math.max(1,...ha,...hb),X=v=>pad+(v-lo)/(hi-lo||1)*(w-pad*2),bwPx=(w-pad*2)/bins;
  if(lo<0){ctx.fillStyle='rgba(217,71,47,.08)';ctx.fillRect(pad,0,X(0)-pad,h-18);ctx.strokeStyle='#D9472F';ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(X(0),6);ctx.lineTo(X(0),h-18);ctx.stroke();ctx.setLineDash([]);}
  ha.forEach((v,i)=>{const bh=v/mx*(h-30);ctx.fillStyle='rgba(242,169,34,.85)';ctx.fillRect(pad+i*bwPx+1,h-18-bh,bwPx-2,bh);});
  ctx.strokeStyle='#2F5BD3';ctx.lineWidth=2;ctx.beginPath();hb.forEach((v,i)=>{const y=h-18-v/mx*(h-30),x0=pad+i*bwPx,x1=x0+bwPx;i?ctx.lineTo(x0,y):ctx.moveTo(x0,y);ctx.lineTo(x1,y);});ctx.stroke();
  ctx.fillStyle='#5B6680';ctx.font='500 10px "IBM Plex Mono",monospace';ctx.textAlign='left';ctx.fillText(lakh(lo),pad,h-4);ctx.textAlign='right';ctx.fillText(lakh(hi),w-pad,h-4);ctx.textAlign='center';ctx.fillText('profit per season',w/2,h-4);}

/* ================= SIM 5 · CITY ================= */
const BL=[['Goa','Goa resorts','H',72,26,8],['Dubai','Dubai hotels','H',84,21,10],['DEL→DXB','DEL→DXB seats','F',108,19,11],['Bangkok','Bangkok hotels','H',48,15,6],['Bali','Bali villas','H',56,14,9],['Manali','Manali hotels','H',38,13,4],['Jaipur','Jaipur heritage','H',44,12,5],['Singapore','Singapore hotels','H',66,13,7],['BOM→GOI','BOM→GOI seats','F',41,11,5],['Kerala','Kerala houseboats','H',22,8,3],['Maldives','Maldives resorts','H',90,17,15],['Srinagar','Srinagar hotels','H',26,9,4],['Phuket','Phuket hotels','H',34,9,5],['Makkah','Makkah hotels','H',95,22,7],['BLR→SIN','BLR→SIN seats','F',52,7,6],['Da Nang','Da Nang hotels','H',30,10,5]];
const cs={bud:500,lam:.5,sh:{}};const towers=[];
function cityItems(){return BL.map((b,i)=>{let e=b[4],s=b[5];const n=b[0],sh=cs.sh;
  if(sh.dubai&&(n==='Dubai'||n==='DEL→DXB')){e=e*.65-b[3]*.12;s*=1.4;}
  if(sh.vietnam&&n==='Da Nang'){e*=1.6;}
  if(sh.cyclone&&(n==='Phuket'||n==='Bali')){e-=b[3]*.3;s*=1.5;}
  if(sh.concert&&n==='Bangkok'){e*=1.35;}
  if(sh.fuel&&b[2]==='F'){e-=b[3]*.1;}
  return{i,c:b[3],e,s,f:b[2]};});}
function initCity(){
  const host=$('cityVp');
  const st=stage(host,{cam:[11,9.5,12.5],target:[0,1.2,0],spin:.3,fov:40,maxPolar:Math.PI*.46,fog:[16,32]});
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(14,14),new THREE.MeshStandardMaterial({color:0xEEF1F7,roughness:.95}));ground.rotation.x=-Math.PI/2;st.scene.add(ground);
  const gh=new THREE.GridHelper(14,28,0xC9D2E1,0xE1E6EF);gh.position.y=.005;st.scene.add(gh);
  const bg=new THREE.BoxGeometry(1,1,1);bg.translate(0,.5,0);
  BL.forEach((b,i)=>{const gx=i%4,gz=Math.floor(i/4);
    const m=new THREE.Mesh(bg,new THREE.MeshStandardMaterial({color:0xCBD3E1,roughness:.4,metalness:.15,emissive:0x000000}));
    const w=.55+b[3]/110*1.05;m.scale.set(w,.1,w);m.position.set((gx-1.5)*2.6,0,(gz-1.5)*2.6);st.scene.add(m);
    const pad=new THREE.Mesh(new THREE.PlaneGeometry(2.2,2.2),new THREE.MeshBasicMaterial({color:b[2]==='F'?0x2F5BD3:0xF2A922,transparent:true,opacity:.06}));pad.rotation.x=-Math.PI/2;pad.position.set(m.position.x,.01,m.position.z);st.scene.add(pad);
    const lb=label(b[0],{size:.28,color:b[2]==='F'?'#2F5BD3':'#0F1B33'});st.scene.add(lb);
    towers.push({m,lb,h:.1,target:.1,on:false});});
  st.tick=dt=>{towers.forEach(t=>{t.h+=(t.target-t.h)*Math.min(1,dt*5);t.m.scale.y=Math.max(.05,t.h);t.lb.position.set(t.m.position.x,Math.max(.05,t.h)+.45,t.m.position.z);});};
  cityUpdate(true);
}
function cityUpdate(first){
  const cap=cs.bud,it=cityItems();
  const order=it.map(x=>({...x,sc:x.e-cs.lam*x.s})).filter(x=>x.sc>0).sort((a,b)=>b.sc/b.c-a.sc/a.c);
  let left=cap;const pick=new Set();order.forEach(x=>{if(x.c<=left){pick.add(x.i);left-=x.c;}});
  let sp=0,E=0,V=0;
  it.forEach(x=>{const t=towers[x.i];if(!t)return;const on=pick.has(x.i);t.target=Math.max(.06,x.e*.12);
    const mat=t.m.material;if(x.e<0){mat.color.setHex(0xD9472F);mat.emissive.setHex(0x200500);}
    else if(on){mat.color.setHex(x.f==='F'?0x2F5BD3:0xF2A922);mat.emissive.setHex(x.f==='F'?0x050c24:0x2a1800);}
    else{mat.color.setHex(0xCBD3E1);mat.emissive.setHex(0x000000);}
    if(on){sp+=x.c;E+=x.e;V+=x.s*x.s;}});
  const p10=E-1.2816*Math.sqrt(V);
  $('cSpend').textContent=lk(sp);$('cExp').textContent=lk(E);const pe=$('cP10');pe.textContent=lk(p10);pe.style.color=p10<0?'var(--red)':'var(--green)';$('cN').textContent=pick.size+' / 16';$('oCB').textContent=lk(cap);
  if(!first&&cs.prev){const added=[...pick].filter(i=>!cs.prev.has(i)).map(i=>BL[i][0]),dropped=[...cs.prev].filter(i=>!pick.has(i)).map(i=>BL[i][0]);
    if(added.length||dropped.length)logTo($('cLog'),`${added.length?'<b>Buy</b> '+added.join(', '):''}${added.length&&dropped.length?' · ':''}${dropped.length?'<b>Drop</b> '+dropped.join(', '):''}`);}
  if(first)logTo($('cLog'),`<b>Plan</b> ${pick.size} blocks bought for ${lk(sp)}. Hit a shock to see it re-plan.`);
  cs.prev=pick;
}
function bindCity(){
  $('cBud').oninput=e=>{cs.bud=+e.target.value;cityUpdate();};
  $('cRisk').onclick=e=>{const b=e.target.closest('button');if(!b)return;pressSeg($('cRisk'),b);cs.lam=+b.dataset.v;cityUpdate();};
  $('cShocks').onclick=e=>{const b=e.target.closest('button');if(!b)return;const k=b.dataset.k;cs.sh[k]=!cs.sh[k];b.setAttribute('aria-pressed',cs.sh[k]);logTo($('cLog'),`<b>${cs.sh[k]?'Shock':'Cleared'}</b> ${b.textContent}`);cityUpdate();};
  if(!towers.length){$('oCB').textContent=lk(cs.bud);}
}

/* ================= boot ================= */
function noGL(){['globe','towerVp','surfVp','landVp','cityVp'].forEach(id=>{const d=document.createElement('div');d.className='fallback';d.textContent='3D view could not start in this browser. The controls and numbers still work.';$(id).appendChild(d);});}
function boot(){
  bindTower();bindSwarm();bindSurface();bindLand();bindCity();
  if(has3D){try{initGlobe();initTower();initSurface();initLand();initCity();bindLand();}catch(err){console.error(err);noGL();}}
  else{noGL();tw.N=240;tw.im={setColorAt(){},instanceColor:{}};tw.pos=[];tw.sparks=[];tw.pulse=new Float32Array(240);towerReset();}
  // keep tower sim running headless-safe when no GL
  requestAnimationFrame(loop);
  if(!has3D){const tick=()=>{towerTick(1/60);requestAnimationFrame(tick);};tick();}
  runMC();
}
const ready=document.fonts&&document.fonts.ready?Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,1500))]):Promise.resolve();
ready.then(boot);
})();
