(function(){
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = id => document.getElementById(id);
const el = (tag, cls, txt) => { const e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e; };

/* ---------- split-flap ---------- */
const CH='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789₹.';
document.querySelectorAll('.flap').forEach((f,ri)=>{
  const v=f.dataset.v; f.innerHTML='';
  [...v].forEach((c,i)=>{ const s=el('i',null,c===' '?' ':c); f.appendChild(s);
    if(reduce||c===' ')return; let n=6+i*2+ri*4,t=0;
    const tick=()=>{ if(t++<n){s.textContent=CH[Math.random()*CH.length|0];setTimeout(tick,45);} else s.textContent=c; };
    setTimeout(tick,200);});
});

/* ---------- story ---------- */
const rooms=$('rooms'); const R=[];
for(let r=0;r<4;r++)for(let c=0;c<10;c++){const x=10+c*43,y=12+r*48;
  const rc=document.createElementNS('http://www.w3.org/2000/svg','rect');
  rc.setAttribute('x',x);rc.setAttribute('y',y);rc.setAttribute('width',36);rc.setAttribute('height',40);rc.setAttribute('rx',4);rc.setAttribute('class','r r-empty');
  rooms.appendChild(rc);R.push(rc);}
const ST=[
 {big:'312 searches',t:'An agency wants Goa',x:'Agencies search TBO for this hotel, 28–31 December. Demand is clearly there, and every search is a customer ready to pay.',s:()=>'r-empty'},
 {big:'0 rooms left',t:'But the rooms are gone',x:'Other channels bought the hotel out weeks ago. Every one of those 312 searches ends on "sold out". That is lost revenue TBO never even sees in its booking reports.',s:()=>'r-other'},
 {big:'24 rooms',t:'So TBO pre-buys a block',x:'Months earlier, TBO commits to a hard allotment of 24 rooms at a contracted rate. Now it has stock when the searches arrive.',s:i=>i<24?'r-held':'r-other'},
 {big:'−₹1.4 L',t:'Buy too many and you lose',x:'Only 16 rooms sell. The other 8 nights are paid for and wasted. Guessing is expensive in both directions.',s:i=>i<16?'r-ours':i<24?'r-waste':'r-other'},
 {big:'μ 18 ± 4',t:'The forecast sizes the bet',x:'Allotment Atlas reads search trends, past booking curves, festivals and cancellations, and predicts demand of about 18 rooms, with a range. The newsvendor rule turns that range into a buy quantity.',s:i=>i<18?'r-held':'r-other'},
 {big:'+₹2.1 L',t:'Right block, right time',x:'18 rooms bought at the cheapest sensible moment, all sold. Now repeat that decision for thousands of hotel-dates and flight routes under one budget. That is the product.',s:i=>i<18?'r-ours':'r-other'}
];
const dots=$('stDots'); ST.forEach((_,i)=>{const b=el('button');b.type='button';b.setAttribute('aria-label','Step '+(i+1));b.appendChild(el('i'));b.onclick=()=>{go(i);};dots.appendChild(b);});
let si=0, playing=!reduce, timer=null;
function go(i){si=(i+ST.length)%ST.length;const s=ST[si];
  $('stStep').textContent=`Step ${si+1} of ${ST.length}`;$('stBig').textContent=s.big;$('stTitle').textContent=s.t;$('stText').textContent=s.x;
  R.forEach((r,k)=>{setTimeout(()=>r.setAttribute('class','r '+s.s(k)),reduce?0:k*18);});
  [...dots.children].forEach((d,k)=>{d.classList.toggle('on',k===si);const n=d.firstChild.cloneNode();d.replaceChild(n,d.firstChild);});
  clearTimeout(timer); if(playing) timer=setTimeout(()=>go(si+1),6000);}
$('stNext').onclick=()=>go(si+1);$('stPrev').onclick=()=>go(si-1);
$('stPlay').onclick=()=>{playing=!playing;$('stPlay').textContent=playing?'Pause':'Play';dots.classList.toggle('paused',!playing);clearTimeout(timer);if(playing)timer=setTimeout(()=>go(si+1),6000);};
if(!playing){$('stPlay').textContent='Play';dots.classList.add('paused');}
go(0);

/* ---------- glossary ---------- */
const G=[
 ['Allotment','A block of rooms or seats a supplier reserves for TBO at a contracted rate.','Hard: TBO pays even if unsold. Soft: TBO can hand it back.'],
 ['Release days','How many days before check-in TBO can return unsold soft-allotment rooms without penalty.','Release at 14 days: unsold rooms go back on 17 Dec.'],
 ['Look-to-book','Bookings divided by searches. A low rate with high search volume means demand you are not capturing.','10,000 searches, 380 bookings = 3.8%'],
 ['Sell-out','The moment a hotel or flight has no inventory left for TBO to offer.','Goa resorts often sell out 3–5 weeks before New Year.'],
 ['Lead time','Days between when a booking is made and the stay date.','Religious travel books early; leisure books late.'],
 ['Pickup curve','How bookings for one stay date accumulate as the date approaches. Used to forecast the final total.','At 30 days out, 60% of final rooms are usually booked.'],
 ['Critical ratio','Profit on a sale divided by the gap between price and salvage. Says how far above or below average demand to buy.','0.36 → buy a bit less than average demand.'],
 ['P10 / P50 / P90','Forecast range. P10 is the low case (90% chance of beating it), P50 the middle, P90 the high case.','Demand P10 = 90, P50 = 120, P90 = 160 rooms.'],
 ['CVaR','Average loss in the worst 5% or 10% of outcomes. A tail-risk measure that the optimizer can cap.','CVaR 5% = −₹18 L means bad seasons lose 18 lakh on average.'],
 ['Price elasticity','How much demand drops when price rises.','Elasticity −1.5: 10% price rise loses 15% of bookings.'],
 ['Efficient frontier','The set of plans where no other plan earns more without taking more risk.','Our plan should sit on its upper-left edge.'],
 ['Monte Carlo','Running thousands of random demand scenarios to see the full spread of profit, not just the average.','10,000 runs → chart of possible outcomes.']
];
$('gloss').innerHTML='';G.forEach(([t,d,e])=>{const c=el('div','term');c.append(el('b',null,t),el('p',null,d),el('em',null,e));$('gloss').appendChild(c);});

/* ---------- funnel ---------- */
const FN=[
 {s:[10000,6100,2400,380],lost:3900},
 {s:[10000,8700,3400,540],lost:1300}];
const FL=['Agency searches','Found availability','Opened a hotel','Booked'];
const fun=$('funnel');
FL.forEach((l,i)=>{const r=el('div','fstep');r.append(el('span',null,l));const tr=el('div','ftrack');tr.appendChild(el('i'));r.appendChild(tr);fun.appendChild(r);});
const lr=el('div','fstep');lr.append(el('span',null,'Lost to sold-out'));const lt=el('div','ftrack');const li=el('i','lost');lt.appendChild(li);lr.appendChild(lt);fun.appendChild(lr);
function funnel(k){const d=FN[k];[...fun.children].slice(0,4).forEach((r,i)=>{const b=r.querySelector('i');b.style.width=Math.max(8,d.s[i]/100)+'%';b.textContent=d.s[i].toLocaleString('en-IN');});
  li.style.width=Math.max(8,d.lost/100)+'%';li.textContent=d.lost.toLocaleString('en-IN');
  $('ltb').textContent=(d.s[3]/d.s[0]*100).toFixed(1)+'%';$('lostN').textContent=d.lost.toLocaleString('en-IN');$('bkN').textContent=d.s[3];}
document.querySelectorAll('#leak .seg button').forEach(b=>b.onclick=()=>{document.querySelectorAll('#leak .seg button').forEach(x=>x.setAttribute('aria-pressed',x===b));funnel(+b.dataset.f);});
funnel(0);

/* ---------- math ---------- */
const erf=x=>{const s=Math.sign(x);x=Math.abs(x);const t=1/(1+.3275911*x);return s*(1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-x*x));};
const Phi=z=>.5*(1+erf(z/Math.SQRT2)); const phi=z=>Math.exp(-z*z/2)/Math.sqrt(2*Math.PI);
function invPhi(p){p=Math.min(Math.max(p,1e-6),1-1e-6);
  const a=[-39.6968302866538,220.946098424521,-275.928510446969,138.357751867269,-30.6647980661472,2.50662827745924],b=[-54.4760987982241,161.585836858041,-155.698979859887,66.8013118877197,-13.2806815528857],c=[-.00778489400243029,-.322396458041136,-2.40075827716184,-2.54973253934373,4.37466414146497,2.93816398269878],d=[.00778469570904146,.32246712907004,2.445134137143,3.75440866190742];
  const pl=.02425;let q,r;
  if(p<pl){q=Math.sqrt(-2*Math.log(p));return(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);}
  if(p>1-pl){q=Math.sqrt(-2*Math.log(1-p));return-(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);}
  q=p-.5;r=q*q;return(((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);}
function newsvendor(p,c,s,mu,sd){const cr=(p-c)/(p-s);if(cr<=0)return{Q:0,cr:0,E:0};const z=invPhi(cr);const Q=Math.max(0,mu+sd*z);const L=phi(z)-z*(1-Phi(z));return{Q,cr,E:(p-s)*(mu-sd*L)-(c-s)*Q};}
const inr=v=>'₹'+Math.round(v).toLocaleString('en-IN');
const lakh=v=>Math.abs(v)>=1e5?'₹'+(v/1e5).toFixed(2)+' L':inr(v);

/* ---------- newsvendor widget ---------- */
const P=$('nvP'),C=$('nvC'),S=$('nvS'),svg=$('nvChart');
function nv(){let p=+P.value,c=+C.value,s=+S.value;
  if(c>=p){c=p-250;C.value=c;} if(s>=c){s=c-250;S.value=s;}
  $('oP').textContent=inr(p);$('oC').textContent=inr(c);$('oS').textContent=inr(s);
  const mu=120,sd=35,{Q,cr,E}=newsvendor(p,c,s,mu,sd);
  $('rQ').textContent=Math.round(Q);$('rCR').textContent=cr.toFixed(2);$('rE').textContent=lakh(E);$('rSO').textContent=Math.round((1-cr)*100)+'%';
  const W=520,H=240,l=30,r=10,t=14,b=30,x1=260,X=v=>l+v/x1*(W-l-r),maxY=phi(0)/sd,Y=v=>H-b-(v/maxY)*(H-b-t);
  let curve='',area=`M${X(0)} ${Y(0)}`;
  for(let v=0;v<=x1;v+=2){const y=phi((v-mu)/sd)/sd;curve+=(v?'L':'M')+X(v).toFixed(1)+' '+Y(y).toFixed(1);if(v<=Q)area+=`L${X(v).toFixed(1)} ${Y(y).toFixed(1)}`;}
  area+=`L${X(Q).toFixed(1)} ${Y(phi((Q-mu)/sd)/sd).toFixed(1)}L${X(Q).toFixed(1)} ${Y(0)}Z`;
  let ticks='';for(let v=0;v<=250;v+=50)ticks+=`<line x1="${X(v)}" x2="${X(v)}" y1="${H-b}" y2="${H-b+4}" stroke="var(--muted)"/><text x="${X(v)}" y="${H-b+17}" text-anchor="middle">${v}</text>`;
  svg.innerHTML=`<line x1="${l}" x2="${W-r}" y1="${H-b}" y2="${H-b}" stroke="var(--line)"/>${ticks}<path d="${area}" fill="var(--accent)" fill-opacity=".28"/><path d="${curve}" fill="none" stroke="var(--ink)" stroke-width="1.8"/><line x1="${X(Q)}" x2="${X(Q)}" y1="${t}" y2="${H-b}" stroke="var(--accent-ink)" stroke-width="2" stroke-dasharray="4 4"/><text x="${Math.min(X(Q)+6,W-120)}" y="${t+10}" style="fill:var(--accent-ink);font-weight:600">buy ${Math.round(Q)}</text><text x="${X(mu)}" y="${H-b-6}" text-anchor="middle">μ</text><text x="${W-r}" y="${H-4}" text-anchor="end">rooms demanded</text>`;}
[P,C,S].forEach(e=>e.addEventListener('input',nv));nv();

/* ---------- buy timing ---------- */
const rate=d=>5000+2600*Math.exp(-d/22)+4*Math.max(0,d-100);
const sig=d=>15+.25*d;
const avail=d=>1-.75*Math.exp(-d/35);
const prof=d=>{const r=newsvendor(8500,rate(d),1500,120,sig(d));return r.E*avail(d);};
const LD=[];for(let d=5;d<=180;d+=1)LD.push([d,prof(d)]);
const best=LD.reduce((a,b)=>b[1]>a[1]?b:a);
const tsvg=$('timeChart');
function timing(){const d=+$('lead').value;
  $('oLead').textContent=d+' days';$('tRate').textContent=inr(rate(d));$('tSig').textContent='±'+Math.round(sig(d));$('tAv').textContent=Math.round(avail(d)*100)+'%';$('tE').textContent=lakh(prof(d));
  $('tBest').textContent=`Best buy day in this model: about ${best[0]} days out, for ${lakh(best[1])} expected profit. Real curves come from supplier rate history and forecast backtests.`;
  const W=520,H=260,l=46,r=12,t=16,b=34,X=v=>l+(180-v)/175*(W-l-r);
  const ys=LD.map(x=>x[1]),mn=Math.min(...ys),mx=Math.max(...ys),Y=v=>H-b-(v-mn)/(mx-mn)*(H-b-t-10);
  const rs=LD.map(x=>rate(x[0])),rmn=Math.min(...rs),rmx=Math.max(...rs),YR=v=>H-b-(v-rmn)/(rmx-rmn)*(H-b-t-10);
  let p='',pr='';LD.forEach(([dd,v],i)=>{p+=(i?'L':'M')+X(dd).toFixed(1)+' '+Y(v).toFixed(1);pr+=(i?'L':'M')+X(dd).toFixed(1)+' '+YR(rate(dd)).toFixed(1);});
  let ticks='';[180,150,120,90,60,30,5].forEach(v=>ticks+=`<text x="${X(v)}" y="${H-b+16}" text-anchor="middle">${v}</text>`);
  tsvg.innerHTML=`<line x1="${l}" x2="${W-r}" y1="${H-b}" y2="${H-b}" stroke="var(--line)"/>${ticks}
  <text x="${W-r}" y="${H-4}" text-anchor="end">days before check-in →</text>
  <path d="${pr}" fill="none" stroke="var(--sky)" stroke-width="1.6" stroke-dasharray="5 4"/>
  <path d="${p}" fill="none" stroke="var(--accent)" stroke-width="2.6"/>
  <circle cx="${X(best[0])}" cy="${Y(best[1])}" r="5" fill="var(--good)"/>
  <text x="${X(best[0])}" y="${Y(best[1])-10}" text-anchor="middle" style="fill:var(--good);font-weight:600">best</text>
  <line x1="${X(d)}" x2="${X(d)}" y1="${t}" y2="${H-b}" stroke="var(--ink)" stroke-width="1.5"/>
  <circle cx="${X(d)}" cy="${Y(prof(d))}" r="6" fill="var(--accent)" stroke="var(--ink)" stroke-width="2"/>
  <text x="${l}" y="${t+4}" style="fill:var(--accent-ink);font-weight:600">expected profit</text>
  <text x="${l}" y="${t+18}" style="fill:var(--sky)">supplier rate (dashed)</text>`;}
$('lead').addEventListener('input',timing);timing();

/* ---------- heatmap ---------- */
const M=['N','D','J','F','M','A','M','J','J','A','S','O'],MF=['November','December','January','February','March','April','May','June','July','August','September','October'];
const D={'Goa':[.6,1,.85,.6,.45,.3,.25,.1,.1,.15,.2,.45],'Dubai':[.75,.95,.8,.7,.6,.45,.3,.2,.2,.25,.4,.65],'Bangkok':[.7,.9,.8,.6,.5,.55,.35,.3,.3,.3,.35,.55],'Bali':[.4,.7,.5,.35,.35,.45,.6,.8,.9,.85,.55,.45],'Manali':[.3,.55,.5,.35,.4,.6,.95,.9,.4,.3,.4,.55],'Jaipur':[.85,.8,.7,.6,.45,.25,.15,.15,.2,.25,.4,.7],'Singapore':[.45,.7,.5,.4,.45,.55,.8,.85,.55,.4,.4,.45],'Kerala':[.6,.85,.8,.7,.5,.35,.25,.2,.35,.5,.45,.55],'Maldives':[.6,.85,.8,.85,.7,.55,.3,.25,.3,.35,.4,.55],'Makkah':[.4,.45,.5,.95,.9,.4,.55,.7,.35,.35,.4,.4]};
function driver(d,m,v){
  if(d==='Makkah'&&(m===3||m===4))return'Ramadan and Umrah peak; religious segment books early and rarely cancels.';
  if(m===1||m===2)return v>.75?'Christmas and New Year peak; hotels sell out weeks ahead.':'Year-end holidays lift demand moderately.';
  if(m===0)return d==='Jaipur'?'Wedding season and Diwali travel; large group blocks.':'Diwali long weekend and early winter travel.';
  if(m===6||m===7)return v>.7?'Indian school summer holidays; families book 6–10 weeks out.':'Summer holidays, but off-season locally.';
  if((m===8||m===9)&&d==='Bali')return'Dry season and peak international arrivals.';
  if(v<.3)return'Off-season or monsoon; avoid hard allotments, use soft or free-sale only.';
  return'Shoulder season; moderate demand, good prices for flexible contracts.';}
const heat=$('heat');let h='<div></div>'+M.map(m=>`<div class="h">${m}</div>`).join('');
Object.entries(D).forEach(([d,arr],ri)=>{h+=`<div class="d">${d}</div>`;arr.forEach((v,mi)=>{h+=`<button type="button" data-d="${d}" data-m="${mi}" style="background:color-mix(in srgb,var(--accent) ${Math.round(6+v*94)}%,var(--surface));animation-delay:${(ri*12+mi)*12}ms" aria-label="${d} ${MF[mi]}: demand index ${Math.round(v*100)}"${d==='Goa'&&mi===1?' class="sel"':''}></button>`});});
heat.innerHTML=h;
heat.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;heat.querySelectorAll('.sel').forEach(x=>x.classList.remove('sel'));b.classList.add('sel');
  const d=b.dataset.d,m=+b.dataset.m,v=D[d][m];$('cellInfo').textContent=`${d}, ${MF[m]}: demand index ${Math.round(v*100)}. ${driver(d,m,v)}${v>.7?' Pre-buy window: '+MF[(m+9)%12]+'.':''}`;});

/* ---------- optimizer + frontier ---------- */
const B=[['Goa beach resorts','Dec 20–Jan 2','H',72,26,8],['Dubai city hotels','Dec 15–31','H',84,21,10,1],['DEL→DXB seats','Dec 18–24','F',108,19,11,1],['Bangkok hotels','Dec 22–Jan 5','H',48,15,6],['Bali villas','Jul–Aug','H',56,14,9],['Manali hotels','May 15–Jun 15','H',38,13,4],['Jaipur heritage','Nov weddings','H',44,12,5],['Singapore hotels','May–Jun','H',66,13,7],['BOM→GOI seats','Dec 26–31','F',41,11,5],['Kerala houseboats','Jan–Feb','H',22,8,3],['Maldives resorts','Feb','H',90,17,15],['Srinagar hotels','Apr–May','H',26,9,4],['Phuket hotels','Nov–Dec','H',34,9,5],['Makkah hotels','Ramadan 2027','H',95,22,7],['BLR→SIN seats','May','F',52,7,6],['Da Nang hotels','Dec–Jan','H',30,10,5]];
let lam=.5,shock=false;const bud=$('bud'),blocks=$('blocks');
blocks.innerHTML=B.map((b,i)=>`<div class="blk ${b[2]==='F'?'flight':''}" id="b${i}"><div class="nm">${b[0]}<em>${b[1]}</em></div><div class="v" id="v${i}"></div><div class="bar"><i id="w${i}"></i></div></div>`).join('');
const lk=v=>(v<0?'−':'')+'₹'+(Math.abs(v)>=100?(Math.abs(v)/100).toFixed(2)+' Cr':Math.round(Math.abs(v))+' L');
const items=()=>B.map((b,i)=>{let e=b[4],s=b[5];if(shock&&b[6]){e=e*.65-b[3]*.12;s*=1.4;}return{i,c:b[3],e,s,f:b[2]};});
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function opt(){
  const cap=+bud.value;$('oB').textContent=lk(cap);
  const it=items();const order=it.map(x=>({...x,sc:x.e-lam*x.s})).filter(x=>x.sc>0).sort((a,b)=>b.sc/b.c-a.sc/a.c);
  let left=cap;const pick=new Set();order.forEach(x=>{if(x.c<=left){pick.add(x.i);left-=x.c;}});
  let spend=0,E=0,V=0,h=0,f=0;
  it.forEach(x=>{const on=pick.has(x.i);$('b'+x.i).className='blk '+(x.f==='F'?'flight ':'')+(on?'on':'off');
    $('w'+x.i).style.width=(on?Math.max(4,x.c/110*100):0)+'%';$('v'+x.i).textContent=`${x.c} → ${x.e>=0?'+':''}${x.e.toFixed(0)}`;
    if(on){spend+=x.c;E+=x.e;V+=x.s*x.s;x.f==='F'?f+=x.c:h+=x.c;}});
  const p10=E-1.2816*Math.sqrt(V);
  $('oSpend').textContent=lk(spend);$('oExp').textContent=lk(E);const p=$('oP10');p.textContent=lk(p10);p.style.color=p10<0?'var(--bad)':'var(--good)';
  $('oRoi').textContent=spend?Math.round(E/spend*100)+'%':'–';
  $('alloc').innerHTML=`<i style="width:${h/cap*100}%;background:var(--accent)"></i><i style="width:${f/cap*100}%;background:var(--sky)"></i>`;
  frontier(it,cap,E,Math.sqrt(V));
}
const fsvg=$('front');
function frontier(it,cap,myE,myS){
  const r=rng(7),pts=[];
  for(let k=0;k<420;k++){const idx=it.map(x=>x.i).sort(()=>r()-.5);let left=cap,e=0,v=0;idx.forEach(i=>{const x=it[i];if(x.c<=left&&r()>.3){left-=x.c;e+=x.e;v+=x.s*x.s;}});pts.push([Math.sqrt(v),e]);}
  pts.push([myS,myE]);
  const W=560,H=300,l=48,rr=14,t=16,b=36;const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
  const x0=0,x1=Math.max(...xs)*1.08,y0=Math.min(0,Math.min(...ys)),y1=Math.max(...ys)*1.1;
  const X=v=>l+(v-x0)/(x1-x0)*(W-l-rr),Y=v=>H-b-(v-y0)/(y1-y0)*(H-b-t);
  let g='';for(let k=0;k<=4;k++){const v=y0+(y1-y0)*k/4;g+=`<line x1="${l}" x2="${W-rr}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)" stroke-width="1"/><text x="${l-6}" y="${Y(v)+4}" text-anchor="end">${Math.round(v)}</text>`;}
  for(let k=0;k<=4;k++){const v=x1*k/4;g+=`<text x="${X(v)}" y="${H-b+16}" text-anchor="middle">${Math.round(v)}</text>`;}
  const dots=pts.slice(0,-1).map(p=>`<circle class="p" cx="${X(p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="3"/>`).join('');
  const beat=pts.slice(0,-1).filter(p=>p[1]>myE&&p[0]<=myS).length;
  fsvg.innerHTML=`${g}${dots}<circle class="me" cx="${X(myS)}" cy="${Y(myE)}" r="8"/>
   <text x="${Math.min(X(myS)+12,W-90)}" y="${Y(myE)+4}" style="fill:var(--ink);font-weight:600">our plan</text>
   <text x="${l}" y="${t-2}">expected profit (₹ L)</text><text x="${W-rr}" y="${H-4}" text-anchor="end">risk: profit spread σ (₹ L) →</text>`;
  $('frontNote').textContent=`${pts.length-1} random plans at a ${lk(cap)} budget. ${beat===0?'None of them earns more than our plan without taking more risk.':beat+' random plans beat ours at equal or lower risk; the greedy demo is close but not exact, which is why the real engine uses an integer solver.'}`;
}
bud.addEventListener('input',opt);
document.querySelectorAll('#riskSeg button').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('#riskSeg button').forEach(x=>x.setAttribute('aria-pressed','false'));b.setAttribute('aria-pressed','true');lam=+b.dataset.l;opt();}));
$('shock').addEventListener('click',e=>{shock=!shock;e.currentTarget.setAttribute('aria-pressed',shock);opt();});
opt();

/* ---------- idea bank ---------- */
const CATS=[['data','New data signals','var(--c1)'],['intel','Smarter models','var(--c2)'],['decide','Better decisions','var(--c3)'],['ux','Experience','var(--c4)'],['biz','Business model','var(--c5)']];
const CAT=Object.fromEntries(CATS.map(c=>[c[0],c]));
const I=[
 ['Airfare as a hotel signal','data',4,2,'Rising flight prices and seat sell-outs into a city usually lead hotel demand by weeks.','Gives the forecaster an early warning that bookings alone show too late.','Join route fare history to destination demand; add lagged fare features to the LightGBM model.'],
 ['Event and concert radar','data',4,3,'Detect concerts, sports finals, expos and weddings-season dates that cause local sell-outs.','One concert can sell out a city overnight. Judges love a live example.','Scrape or mock an events feed; tag dates with intensity; add as forecast feature and heatmap overlay.'],
 ['Weather and disaster feed','data',3,2,'Monsoon, cyclone and heatwave alerts that cut demand or trigger cancellations.','Automatically reduces risk exposure before bad news hits bookings.','Mock an alert feed; apply a demand multiplier and higher cancellation rate in the simulator.'],
 ['Visa and policy tracker','data',4,2,'Visa-free announcements and rule changes for Indian travellers.','A visa change can shift demand 20–30% within weeks; buying first is pure margin.','Store policy events with dates; show a "policy shock" scenario like the Dubai shock button.'],
 ['Competitor rate shopping','intel',4,3,'Compare TBO\'s selling price with market rates for the same hotel and date.','Sets selling prices that still sell out without leaving money on the table.','Mock a rate feed; add a price-position feature; recommend sell price per block.'],
 ['Cancellation predictor per agency','intel',3,2,'Predict which agencies and bookings are likely to cancel.','Lets TBO overbook pre-bought stock safely, like airlines do.','Logistic model on lead time, refundability and agency history; feed expected cancellations into the newsvendor.'],
 ['Agency-level demand','intel',4,3,'Forecast which agencies will sell which inventory.','Turns a destination forecast into targeted offers to the agencies most likely to buy.','Cluster agencies by booking mix; allocate pre-bought rooms to segments; show a Sankey from block to agencies.'],
 ['Substitution-aware buying','intel',4,4,'When hotel A sells out, some demand moves to similar hotel B.','Avoids buying two near-identical hotels and over-counting demand.','Hotel similarity from star, area and price; use a substitution matrix in the optimizer constraints.'],
 ['Smart release engine','decide',5,2,'Decide each day whether to return unsold soft-allotment rooms before the release deadline.','Directly cuts unsold losses, the brief\'s main risk objective.','Compare expected remaining pickup vs release value each day; show a countdown and a "release now" recommendation.'],
 ['Markdown pricing','decide',5,3,'Lower the selling price of pre-bought stock as the date nears if pickup is slow.','Sells inventory that would otherwise waste, and shows dynamic pricing.','Simple elasticity model; recommend price steps at 21, 14, 7 days; chart the markdown curve.'],
 ['Contract mix advisor','decide',4,3,'Recommend hard vs soft vs free-sale terms and a target rate for each hotel.','Gives the procurement team a negotiation sheet, not just a buy list.','Evaluate each contract type in the simulator; pick the best risk-adjusted option per hotel.'],
 ['Flight + hotel bundles','decide',4,3,'Package risky inventory with strong sellers to move it.','Raises sell-through on weak blocks and lifts basket value.','Pair blocks with correlated demand dates; price bundle with a small discount; measure lift in simulation.'],
 ['Weekly rolling re-plan','decide',4,4,'Re-run the optimizer every week as new bookings arrive.','Shows the system is a living process, not a one-time report.','Rolling horizon loop over the synthetic timeline; animate the plan changing week by week.'],
 ['RL buy-timing agent','decide',3,5,'A reinforcement learning agent that learns when to buy from simulated seasons.','Impressive, but risky to finish; keep it as a stretch.','Gym-style environment over the simulator; compare against the analytic timing rule.'],
 ['Ask-the-optimizer chat','ux',4,2,'Type "what if we add ₹2 Cr for Dubai?" and get a re-planned answer.','The most demo-friendly feature; the LLM calls your optimizer as a tool.','LLM with tool calls to /optimize and /simulate; render the answer with a mini chart.'],
 ['Buyer alerts','ux',3,1,'Notifications when a buy window opens or sell-out risk spikes.','Makes the system proactive with almost no effort.','Rules over forecast output; post to a mock Slack or email panel in the demo.'],
 ['Supplier portal','ux',4,4,'Hotels see demand forecasts and offer allotments directly.','Turns the tool into a two-sided marketplace feature.','A simple supplier view: forecast for their dates and an "offer block" form feeding the candidate list.'],
 ['Why-this-forecast view','ux',3,2,'Show which features drove each forecast, such as festival or search spike.','Builds trust with judges and buyers.','SHAP values from LightGBM rendered as a waterfall chart per destination-week.'],
 ['Season time machine','biz',5,3,'Replay last season day by day with our policy vs what actually happened.','The strongest proof of value: rupees saved, shown as a race chart.','Run the backtest across the synthetic timeline; animate cumulative profit for baseline vs Atlas.'],
 ['Guaranteed availability badge','biz',3,2,'Agencies see a badge on inventory TBO owns, with instant confirmation.','Turns pre-bought stock into a selling point and conversion lift.','Flag owned inventory in search results mock; measure conversion lift in simulation.'],
 ['Ancillary attach','biz',3,2,'Add transfers and sightseeing to each pre-bought room.','Raises margin per room, which raises the optimizer\'s willingness to buy.','Attach-rate assumption per destination; add expected ancillary margin to each block\'s profit.']
];
let activeCat=null,selIdea=0;
const chipsEl=$('catChips');
const allChip=el('button','chip','All');allChip.type='button';allChip.setAttribute('aria-pressed','true');allChip.style.setProperty('--c','var(--ink)');chipsEl.appendChild(allChip);
CATS.forEach(c=>{const b=el('button','chip',c[1]);b.type='button';b.dataset.c=c[0];b.setAttribute('aria-pressed','false');b.style.setProperty('--c',c[2]);chipsEl.appendChild(b);});
chipsEl.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;activeCat=b.dataset.c||null;[...chipsEl.children].forEach(x=>x.setAttribute('aria-pressed',x===b));renderIdeas();});
const mx=$('matrix');
function renderIdeas(){
  const W=400,H=340,l=34,r=10,t=14,b=34,X=e=>l+(e-.5)/5*(W-l-r),Y=i=>H-b-(i-.5)/5*(H-b-t);
  let s=`<rect x="${l}" y="${t}" width="${(W-l-r)/2}" height="${(H-b-t)/2}" fill="var(--good)" fill-opacity=".07"/>
  <line x1="${(X(.5)+X(5.5))/2}" x2="${(X(.5)+X(5.5))/2}" y1="${t}" y2="${H-b}" stroke="var(--line)"/><line x1="${l}" x2="${W-r}" y1="${(Y(.5)+Y(5.5))/2}" y2="${(Y(.5)+Y(5.5))/2}" stroke="var(--line)"/>
  <rect x="${l}" y="${t}" width="${W-l-r}" height="${H-b-t}" fill="none" stroke="var(--line)"/>
  <text class="q" x="${l+8}" y="${t+16}" style="fill:var(--good)">QUICK WINS</text><text class="q" x="${W-r-8}" y="${t+16}" text-anchor="end">BIG BETS</text>
  <text class="q" x="${l+8}" y="${H-b-8}">FILL-INS</text><text class="q" x="${W-r-8}" y="${H-b-8}" text-anchor="end">LATER</text>
  <text x="${(l+W-r)/2}" y="${H-8}" text-anchor="middle">effort to build →</text><text x="12" y="${(t+H-b)/2}" transform="rotate(-90 12 ${(t+H-b)/2})" text-anchor="middle">impact on judges →</text>`;
  const seen={};
  I.forEach((d,k)=>{const key=d[2]+'_'+d[3];const n=seen[key]=(seen[key]||0)+1;const ang=n*2.1,rad=n>1?Math.min(22,8+n*3):0;
    const cx=X(d[3])+Math.cos(ang)*rad,cy=Y(d[2])+Math.sin(ang)*rad;
    const dim=activeCat&&d[1]!==activeCat;
    s+=`<circle data-k="${k}" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${k===selIdea?10:8}" fill="${CAT[d[1]][2]}" class="${dim?'dim':''} ${k===selIdea?'sel':''}" tabindex="0" role="button" aria-label="${d[0]}"><title>${d[0]}</title></circle>`;});
  mx.innerHTML=s;
  [...$('ideaList').children].forEach((row,k)=>{row.hidden=!!(activeCat&&I[k][1]!==activeCat);row.classList.toggle('sel',k===selIdea);});
  showIdea(selIdea);
}
mx.addEventListener('click',e=>{const c=e.target.closest('circle[data-k]');if(c){selIdea=+c.dataset.k;renderIdeas();}});
mx.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){const c=e.target.closest('circle[data-k]');if(c){e.preventDefault();selIdea=+c.dataset.k;renderIdeas();}}});
const list=$('ideaList');
I.forEach((d,k)=>{const b=el('button','idea-row');b.type='button';b.style.setProperty('--c',CAT[d[1]][2]);b.append(el('i'),el('span',null,d[0]),el('small',null,`impact ${d[2]} · effort ${d[3]}`));b.onclick=()=>{selIdea=k;renderIdeas();$('ideas').scrollIntoView({behavior:reduce?'auto':'smooth'});};list.appendChild(b);});
function meter(n){const m=el('span','meter');for(let i=1;i<=5;i++)m.appendChild(el('i',i<=n?'f':''));return m;}
function showIdea(k){const d=I[k],box=$('ideaDetail');box.innerHTML='';
  const ey=el('div','eyebrow',CAT[d[1]][1]);ey.style.color=CAT[d[1]][2];
  const meta=el('div','idea-meta');const a=el('span',null,'Impact ');a.appendChild(meter(d[2]));const b=el('span',null,'Effort ');b.appendChild(meter(d[3]));meta.append(a,b);
  const quad=d[2]>=4&&d[3]<=2?'Quick win':d[2]>=4?'Big bet':d[3]<=2?'Fill-in':'Later';
  meta.appendChild(el('span','tag'+(quad==='Quick win'?' hot':''),quad));
  const w1=el('p');w1.append(el('b',null,'What it is. '),d[4]);
  const w2=el('p');w2.append(el('b',null,'Why it matters. '),d[5]);
  const w3=el('p','muted');w3.append(el('b',null,'How to build it. '),d[6]);
  const btn=el('button','btn','Put this on the team board');btn.type='button';btn.onclick=()=>prefill(d[0],d[5]+' '+d[6],d[1]);
  box.append(ey,el('h3',null,d[0]),meta,w1,w2,w3,btn);}
renderIdeas();

/* ---------- spark ---------- */
const SP=[
 ['Which signal would tell us about demand 90 days before bookings do?','Think searches, airfares, events, visa news, social trends.'],
 ['Where does TBO lose a booking because of availability, not price?','The sold-out leak is the business case. Can we measure it per hotel?'],
 ['What would make our forecast wrong, and how would we notice within a day?','Drift alerts, forecast vs pickup tracking, anomaly flags.'],
 ['If a supplier refunded half of unsold rooms, how should we change the plan?','Contract terms change the salvage value, which changes the critical ratio.'],
 ['Could two agencies\' demand be pooled to cut risk?','Pooling uncorrelated demand narrows the spread, so the same budget buys safer.'],
 ['What would a hotel pay us to guarantee a minimum occupancy?','A revenue model where TBO earns on certainty, not just on margin.'],
 ['How do we sell the last 10% of a block that is not moving?','Markdowns, bundles, agency incentives, early release.'],
 ['What should happen the moment a sell-out risk spikes?','An alert? An auto-buy within a pre-approved limit? A human approval?'],
 ['If you had to explain one pick to a CFO in one sentence, what would it be?','This becomes the LLM explainer\'s template.'],
 ['What would change if the budget were split by quarter instead of one pot?','Multi-period budgets and cash-flow timing are a real procurement constraint.']
];
let sk=0;function spark(){$('sparkN').textContent=`Question ${sk+1} of ${SP.length}`;$('sparkQ').textContent=SP[sk][0];$('sparkHint').textContent=SP[sk][1];}
$('sparkNext').onclick=()=>{sk=(sk+1)%SP.length;spark();};
$('sparkUse').onclick=()=>prefill('',`Re: "${SP[sk][0]}"\n`,'data');
spark();

/* ---------- team board (db) ---------- */
const catSel=$('ideaCat');CATS.forEach(c=>{const o=el('option',null,c[1]);o.value=c[0];catSel.appendChild(o);});
function prefill(t,d,c){$('ideaTitle').value=t;$('ideaDetail').value=d;catSel.value=c;$('team').scrollIntoView({behavior:reduce?'auto':'smooth'});setTimeout(()=>$('ideaTitle').focus({preventScroll:true}),reduce?0:600);}
const posts=$('posts'),status=$('addStatus');
let db=null,user=null,uid=null,isOwner=false,canWrite=true,ideas=[],votes={},mine=new Set(),sortBy='votes',writing=Promise.resolve();
function unavailable(msg){posts.innerHTML='';const e=el('div','empty',msg);posts.appendChild(e);$('addBtn').disabled=true;}
async function renderPosts(){
  if(!db)return;
  if(!ideas.length){posts.innerHTML='';const e=el('div','empty');e.append(el('b',null,'No ideas yet.'),document.createElement('br'),'Post the first one, or pick an idea from section 14 and tap "Put this on the team board".');posts.appendChild(e);return;}
  const count=id=>Object.values(votes).filter(v=>v.has(id)).length;
  const arr=[...ideas].sort((a,b)=>sortBy==='votes'?(count(b.id)-count(a.id))||(b.at-a.at):(b.at-a.at));
  let names={};try{const ids=[...new Set(arr.map(x=>x.by).filter(Boolean))];if(user&&ids.length)names=await user.profiles(ids)||{};}catch(e){}
  posts.innerHTML='';
  arr.forEach(x=>{const p=el('div','post');
    const v=el('button','vote',String(count(x.id)));v.type='button';v.setAttribute('aria-pressed',mine.has(x.id));v.setAttribute('aria-label','Upvote '+x.title);v.disabled=!canWrite||!uid;v.onclick=()=>toggleVote(x.id);
    const body=el('div');body.style.minWidth='0';body.append(el('h4',null,x.title));if(x.detail)body.appendChild(el('p',null,x.detail));
    const meta=el('div','meta');const c=CAT[x.cat]||CATS[0];const tg=el('span','tag',c[1]);tg.style.color=c[2];tg.style.borderColor=c[2];meta.appendChild(tg);
    meta.appendChild(el('span',null,(names[x.by]&&names[x.by].name)||'Teammate'));
    meta.appendChild(el('span',null,new Date(x.at).toLocaleDateString('en-IN',{day:'numeric',month:'short'})));
    if(canWrite&&(x.by===uid||isOwner)){const d=el('button','del','Delete');d.type='button';d.onclick=()=>delIdea(x.id);meta.appendChild(d);}
    body.appendChild(meta);p.append(v,body);posts.appendChild(p);});
}
function queue(fn){writing=writing.then(fn,fn);return writing;}
function toggleVote(id){if(!db||!uid)return;mine.has(id)?mine.delete(id):mine.add(id);votes[uid]=new Set(mine);renderPosts();
  const snap=[...mine];queue(()=>db.doc('votes/'+uid).set({ideas:snap}).catch(err=>{if(err&&err.code==='invalid_argument'){canWrite=false;renderPosts();}}));}
async function delIdea(id){try{await db.doc('ideas/'+id).delete();}catch(e){status.textContent='Could not delete. Try again in a moment.';}}
$('addForm').addEventListener('submit',async e=>{e.preventDefault();if(!db)return;
  const t=$('ideaTitle').value.trim(),d=$('ideaDetail').value.trim();
  if(t.length<4){status.textContent='Give the idea a short title of at least 4 characters.';$('ideaTitle').focus();return;}
  $('addBtn').disabled=true;status.textContent='Posting…';
  try{await db.collection('ideas').add({title:t.slice(0,90),detail:d.slice(0,600),cat:catSel.value,by:uid||'',at:Date.now()});
    $('ideaTitle').value='';$('ideaDetail').value='';status.textContent='Posted. Everyone with this page sees it now.';}
  catch(err){status.textContent=err&&err.code==='invalid_argument'?'You can view this board but not post to it. Ask the owner for Contributor access.':err&&err.code==='quota_exceeded'?'The board is full. Delete old ideas to make room.':'Could not post. Check your connection and try again.';if(err&&err.code==='invalid_argument'){canWrite=false;}}
  finally{$('addBtn').disabled=!canWrite;}});
document.querySelectorAll('#sortChips button').forEach(b=>b.onclick=()=>{sortBy=b.dataset.s;document.querySelectorAll('#sortChips button').forEach(x=>x.setAttribute('aria-pressed',x===b));renderPosts();});
(async()=>{
  if(!window.claude||!window.claude.use){unavailable('The team board works when this page is opened in Claude. Everything else on the page works here.');return;}
  try{[db,user]=await Promise.all([window.claude.use('db'),window.claude.use('user')]);}catch(e){}
  if(!db){unavailable('Sign in to Claude to see and post team ideas. The idea bank above works without it.');return;}
  try{uid=user?await user.id():null;isOwner=user?!!(await user.isOwner()):false;const cw=user&&user.can?await user.can('data.write'):null;if(cw===false)canWrite=false;}catch(e){}
  if(!canWrite){$('addBtn').disabled=true;status.textContent='You can read and follow ideas. Posting needs Contributor access from the page owner.';}
  db.collection('ideas').orderBy('at','desc').limit(300).onSnapshot(s=>{ideas=s.docs.map(d=>({id:d.id,...d.data()}));renderPosts();},()=>unavailable('The team board is unavailable right now. Reload the page to try again.'));
  db.collection('votes').onSnapshot(s=>{const v={};s.docs.forEach(d=>{v[d.id]=new Set((d.data().ideas)||[]);});if(uid){if(!v[uid]&&mine.size)v[uid]=new Set(mine);else if(v[uid])mine=new Set(v[uid]);}votes=v;renderPosts();},()=>{});
})();

/* ---------- presenter + nav highlight ---------- */
const SECS=['top',...[...document.querySelectorAll('main section.sec')].map(s=>s.id)];
const names=Object.fromEntries([...document.querySelectorAll('#navlinks a')].map(a=>[a.getAttribute('href').slice(1),a.textContent]));names.top='Start';
let cur=0;
const io=new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting){cur=SECS.indexOf(e.target.id);$('pvLabel').textContent=`${cur} / ${SECS.length-1} · ${names[e.target.id]}`;
  document.querySelectorAll('#navlinks a').forEach(a=>a.classList.toggle('cur',a.getAttribute('href')==='#'+e.target.id));}});},{rootMargin:'-40% 0px -55% 0px'});
SECS.forEach(id=>{const s=$(id);if(s)io.observe(s);});
const jump=i=>{cur=Math.max(0,Math.min(SECS.length-1,i));$(SECS[cur]).scrollIntoView({behavior:reduce?'auto':'smooth'});};
$('pvNext').onclick=()=>jump(cur+1);$('pvPrev').onclick=()=>jump(cur-1);
document.addEventListener('keydown',e=>{if(e.target.closest('input,textarea,select'))return;if(e.key==='ArrowRight'||e.key==='PageDown'&&e.altKey){jump(cur+1);}if(e.key==='ArrowLeft'){jump(cur-1);}});
})();
