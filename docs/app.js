"use strict";
/* UI: builds the survey, reads it, and renders the plan, the group view and the method. */

const $ = id => document.getElementById(id);
const el = (t,a={},...k)=>{ const n=document.createElement(t);
  for(const x in a){ if(x==="class") n.className=a[x]; else if(x==="html") n.innerHTML=a[x]; else n.setAttribute(x,a[x]); }
  k.flat().forEach(c=>n.append(c&&c.nodeType?c:document.createTextNode(c))); return n; };
let toastT;
function toast(m){ const t=$("toast"); t.textContent=m; t.classList.add("on");
  clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("on"),2400); }
const num = id => parseFloat($(id).value);

/* ------------------------------------------------ charts */
function chart({w=440,h=250,pad=[14,12,34,44],xd,yd,xfmt,yfmt,xlabel,ylabel,
                xticks=5,yticks=4,draw}){
  const [pt,pr,pb,pl]=pad, iw=w-pl-pr, ih=h-pt-pb;
  const X=v=>pl+(v-xd[0])/(xd[1]-xd[0])*iw, Y=v=>pt+ih-(v-yd[0])/(yd[1]-yd[0])*ih;
  let s=`<svg class="chart" viewBox="0 0 ${w} ${h}" role="img">`;
  for(let i=0;i<=yticks;i++){ const v=yd[0]+(yd[1]-yd[0])*i/yticks, y=Y(v);
    s+=`<line class="gridline" x1="${pl}" y1="${y}" x2="${w-pr}" y2="${y}"/>`;
    s+=`<text x="${pl-7}" y="${y+3.5}" font-size="10" text-anchor="end">${yfmt(v)}</text>`; }
  for(let i=0;i<=xticks;i++){ const v=xd[0]+(xd[1]-xd[0])*i/xticks, x=X(v);
    s+=`<text x="${x}" y="${h-pb+15}" font-size="10" text-anchor="middle">${xfmt(v)}</text>`; }
  s+=`<line class="axis" x1="${pl}" y1="${pt+ih}" x2="${w-pr}" y2="${pt+ih}"/>`;
  s+=draw({X,Y,iw,ih,pl,pt,pr,pb,w,h});
  if(xlabel) s+=`<text x="${pl+iw/2}" y="${h-2}" font-size="10.5" text-anchor="middle">${xlabel}</text>`;
  if(ylabel) s+=`<text transform="translate(11,${pt+ih/2}) rotate(-90)" font-size="10.5" text-anchor="middle">${ylabel}</text>`;
  return s+"</svg>"; }
const path=(p,X,Y)=>p.map((q,i)=>(i?"L":"M")+X(q[0]).toFixed(2)+" "+Y(q[1]).toFixed(2)).join(" ");

function chartUtility(u){
  const A=u.A,B=u.B,b=B/A, pts=[],lg=[];
  const f=(x,g)=>(crraU(x,g)-crraU(1,g))/(crraU(b,g)-crraU(1,g));
  for(let i=0;i<=120;i++){ const w=A+(B-A)*i/120;
    pts.push([w, f(w/A, u.gamma)]);
    lg.push([w, Math.log(w/A)/Math.log(b)]); }
  return chart({xd:[A,B], yd:[0,1],
    xfmt:v=>"Rs "+Math.round(v/1000)+"k", yfmt:v=>v.toFixed(1),
    xlabel:"Amount", ylabel:"Utility U(W)",
    draw:({X,Y})=>`
      <path d="${path([[A,0],[B,1]],X,Y)}" fill="none" stroke="${cssv('--ink-3')}" stroke-width="1.1" stroke-dasharray="4 3"/>
      <path d="${path(lg,X,Y)}" fill="none" stroke="${cssv('--s3')}" stroke-width="1.6" stroke-dasharray="6 3"/>
      <path d="${path(pts,X,Y)}" fill="none" stroke="${cssv('--s1')}" stroke-width="2.2"/>
      ${u.points.map(q=>`<circle cx="${X(q.x)}" cy="${Y(q.p)}" r="4.4" fill="${cssv('--s1')}"
         stroke="${cssv('--surface')}" stroke-width="1.6"/>`).join("")}`});
}
function chartValue(v,w0){
  const lim=Math.max(w0,1)*1.0, f=x=>x>=0?Math.pow(x/lim,v.alpha):-(v.lambda||1)*Math.pow(-x/lim,v.beta);
  const pts=[]; for(let i=-60;i<=60;i++) pts.push([i/60*lim, f(i/60*lim)]);
  const lo=f(-lim),hi=f(lim);
  return chart({xd:[-lim,lim], yd:[lo*1.08,hi*1.5], yticks:4,
    xfmt:v2=>(v2/1000).toFixed(0)+"k", yfmt:v2=>v2.toFixed(1),
    xlabel:"Gain or loss against your reference amount", ylabel:"Value v(x)",
    draw:({X,Y,pl,w,pr,pt,ih})=>`
      <line class="axis" x1="${pl}" y1="${Y(0)}" x2="${w-pr}" y2="${Y(0)}"/>
      <line class="axis" x1="${X(0)}" y1="${pt}" x2="${X(0)}" y2="${pt+ih}"/>
      <path d="${path(pts.filter(q=>q[0]<=0),X,Y)}" fill="none" stroke="${cssv('--s8')}" stroke-width="2.2"/>
      <path d="${path(pts.filter(q=>q[0]>=0),X,Y)}" fill="none" stroke="${cssv('--s3')}" stroke-width="2.2"/>
      <text x="${X(0.45*lim)}" y="${Y(hi*0.55)}" font-size="10.5" fill="${cssv('--s3')}">gains</text>
      <text x="${X(-0.92*lim)}" y="${Y(lo*0.6)}" font-size="10.5" fill="${cssv('--s8')}">losses</text>`});
}
function chartWeighting(wg){
  const pts=[]; for(let i=1;i<200;i++) pts.push([i/200,ktWeight(i/200,wg.gammaW)]);
  return chart({xd:[0,1],yd:[0,1],xfmt:v=>v.toFixed(1),yfmt:v=>v.toFixed(1),
    xlabel:"Real chance", ylabel:"The weight you act on",
    draw:({X,Y})=>`
      <path d="${path([[0,0],[1,1]],X,Y)}" fill="none" stroke="${cssv('--ink-3')}" stroke-width="1.1" stroke-dasharray="4 3"/>
      <path d="${path(pts,X,Y)}" fill="none" stroke="${cssv('--s7')}" stroke-width="2.2"/>
      ${PW_P.map((p,i)=>`<circle cx="${X(p)}" cy="${Y(wg.observed[i])}" r="4.4" fill="${cssv('--s7')}"
         stroke="${cssv('--surface')}" stroke-width="1.6"/>`).join("")}`});
}
function chartFrontier(eut,ma,eng){
  const fr=[]; for(let i=0;i<=80;i++){ const r=PS1.gmv.mu+(PS1.maxReturn.mu-PS1.gmv.mu)*i/80;
    fr.push([frontierSigma(r), shrinkMu(r,eng.name)]); }
  const xmax=0.21;
  return chart({h:260,xd:[0,xmax],yd:[0.05,Math.max(0.175,eng.mu*1.12)],
    xfmt:v=>(v*100).toFixed(0)+"%", yfmt:v=>(v*100).toFixed(0)+"%",
    xlabel:"Risk (yearly volatility)", ylabel:"Expected return",
    draw:({X,Y})=>`
      <path d="${path(fr,X,Y)}" fill="none" stroke="${cssv('--ink-3')}" stroke-width="1.6"/>
      <path d="${path([[0,RF],[xmax,RF+eng.sharpe*xmax]],X,Y)}" fill="none"
            stroke="${cssv('--ink')}" stroke-width="1.6" stroke-dasharray="5 3"/>
      <circle cx="${X(0)}" cy="${Y(RF)}" r="3.6" fill="${cssv('--ink')}"/>
      <text x="${X(0.006)}" y="${Y(RF)-8}" font-size="10">no risk</text>
      <line x1="${X(eut.sigma)}" y1="${Y(eut.mu)}" x2="${X(ma.agg.sigma)}" y2="${Y(ma.agg.mu)}"
            stroke="${cssv('--ink-3')}" stroke-width="1"/>
      <circle cx="${X(eut.sigma)}" cy="${Y(eut.mu)}" r="6" fill="${cssv('--s1')}"
              stroke="${cssv('--surface')}" stroke-width="2"/>
      <rect x="${X(ma.agg.sigma)-5.4}" y="${Y(ma.agg.mu)-5.4}" width="10.8" height="10.8" rx="2"
              fill="${cssv('--s2')}" stroke="${cssv('--surface')}" stroke-width="2"/>
      <text x="${X(eut.sigma)+10}" y="${Y(eut.mu)-6}" font-size="10.5" fill="${cssv('--s1')}" font-weight="600">EUT</text>
      <text x="${X(ma.agg.sigma)+10}" y="${Y(ma.agg.mu)+13}" font-size="10.5" fill="${cssv('--s2')}" font-weight="600">BPT</text>`});
}

/* ------------------------------------------------ build the survey */
function utilGrid(A,B){ const g=[]; for(let k=1;k<=6;k++) g.push(Math.round((A+(B-A)*k/7)/500)*500); return g; }

function buildRisk(){
  const tb=$("risk");
  RISK_CERTAIN.forEach((x,i)=>{
    tb.append(el("tr",{},
      el("td",{class:"muted"},String(i+1)),
      el("td",{},"Rs "+x.toLocaleString("en-IN")),
      el("td",{class:"muted"},"Half the time Rs "+(2*x).toLocaleString("en-IN")+", half the time nothing"),
      el("td",{html:`<div class="pick">
        <input type="radio" name="r${i}" id="r${i}A" value="A" checked><label for="r${i}A">A</label>
        <input type="radio" name="r${i}" id="r${i}B" value="B"><label for="r${i}B">B</label></div>`})));
  });
}
function buildTime(){
  const tb=$("time");
  TIME_OFFERS.forEach(([fv,t],i)=>{
    tb.append(el("tr",{},
      el("td",{class:"muted"},String(i+1)),
      el("td",{},"Rs 10,000"),
      el("td",{},"Rs "+fv.toLocaleString("en-IN")),
      el("td",{class:"muted"}, t===1?"1 year":t+" years"),
      el("td",{html:`<div class="pick">
        <input type="radio" name="t${i}" id="t${i}N" value="today" checked><label for="t${i}N">Now</label>
        <input type="radio" name="t${i}" id="t${i}D" value="delayed"><label for="t${i}D">Wait</label></div>`})));
  });
}
function buildBFI(){
  const box=$("bfi");
  box.append(el("p",{class:"tiny",style:"margin:0 0 10px"},
    "1 means not like me at all. 5 means very much like me."));
  BFI.forEach((it,i)=>{
    const opts=[1,2,3,4,5].map(v=>
      `<input type="radio" name="b${i}" id="b${i}_${v}" value="${v}"${v===3?" checked":""}>
       <label for="b${i}_${v}">${v}</label>`).join("");
    box.append(el("div",{class:"lik"}, el("div",{class:"t"}, it.t),
      el("div",{class:"opts",html:opts})));
  });
}
function sliderRow(id,title,hint,val){
  return el("div",{class:"q"}, el("div",{class:"qt"},title), el("div",{class:"qh"},hint),
    el("div",{class:"inline"},
      el("input",{type:"range",id,min:"1",max:"99",step:"1",value:String(val),style:"flex:1; min-width:200px"}),
      el("span",{class:"unit",id:id+"_out",style:"font-variant-numeric:tabular-nums; min-width:44px"})));
}
function buildUtil(){
  const box=$("util"); box.innerHTML="";
  const A=num("f_uA"), B=num("f_uB");
  if(!(B>A)){ box.append(el("p",{class:"muted"},"Set B higher than A to see the questions.")); return; }
  box.append(el("p",{class:"tiny",style:"margin:0 0 10px"},
    `Each row: take the middle amount for sure, or play a game that pays Rs ${B.toLocaleString("en-IN")} `
    + `if you win and Rs ${A.toLocaleString("en-IN")} if you lose. What winning chance makes them feel equal?`));
  utilGrid(A,B).forEach((x,i)=>
    box.append(sliderRow("u"+i, `Rs ${x.toLocaleString("en-IN")} for sure, or play the game.`,
      "Chance of winning that makes both feel the same", Math.round(100*(x-A)/(B-A)))));
}
function buildVF(){
  const box=$("vf"); box.innerHTML="";
  VF_CERTAIN.forEach((x,i)=> box.append(sliderRow("g"+i,
    `Win Rs ${x.toLocaleString("en-IN")} for sure, or play for Rs ${(2*x).toLocaleString("en-IN")}.`,
    "The game pays double or nothing. What winning chance makes them feel the same?", 50)));
  VF_CERTAIN.forEach((x,i)=> box.append(sliderRow("l"+i,
    `Lose Rs ${x.toLocaleString("en-IN")} for sure, or risk losing Rs ${(2*x).toLocaleString("en-IN")}.`,
    "The risk is double or nothing. What chance of the bigger loss makes them feel the same?", 50)));
}
function buildPW(){
  const box=$("pw");
  PW_P.forEach((p,i)=> box.append(el("div",{class:"q"},
    el("div",{class:"qt"},`You have a ${(p*100).toFixed(0)} in 100 chance of winning Rs 10,000, otherwise nothing.`),
    el("div",{class:"qh"},"What amount, given to you for sure, would feel just as good?"),
    el("div",{class:"inline"}, el("span",{class:"unit"},"Rs"),
      el("input",{id:"pw"+i,class:"w-sm",type:"number",min:"0",max:"10000",step:"50",
                  value:String(p===0.10?1500:7000)})))));
}

/* ------------------------------------------------ read and persist */
function readForm(){
  const pick=(pfx,n)=>{ const out=[]; for(let i=0;i<n;i++){
    const c=document.querySelector(`input[name=${pfx}${i}]:checked`); out.push(c?c.value:null);} return out; };
  const A=num("f_uA"), B=num("f_uB");
  return {
    roll:$("f_id").value.trim(), age:num("f_age"), incomeBand:$("f_income_band").value,
    corpus:num("f_corpus"), experience:$("f_exp").value, horizon:Math.round(num("f_horizon")),
    goal:$("f_goal").value, constraints:$("f_constraints").value.trim(),
    riskChoices:pick("r",RISK_CERTAIN.length),
    timeChoices:pick("t",TIME_OFFERS.length),
    bfi:BFI.map((_,i)=>{const c=document.querySelector(`input[name=b${i}]:checked`);return c?+c.value:3;}),
    utilA:A, utilB:B, utilX:utilGrid(A,B), utilP:utilGrid(A,B).map((_,i)=>num("u"+i)/100),
    w0:num("f_w0"),
    vfGainP:VF_CERTAIN.map((_,i)=>num("g"+i)/100),
    vfLossP:VF_CERTAIN.map((_,i)=>num("l"+i)/100),
    mixedGain:num("f_mixed"), pwCe:PW_P.map((_,i)=>num("pw"+i)),
    floor:num("f_floor"), floorAlpha:parseFloat($("f_alpha").value),
    aspiration:num("f_asp"), secPoints:num("f_sec"),
    tradeoff:num("f_tradeoff"), income:num("f_draw")
  };
}
function writeForm(d){
  const set=(id,v)=>{ if($(id)!=null && v!=null && v!=="") $(id).value=v; };
  set("f_id",d.roll); set("f_age",d.age); set("f_corpus",d.corpus); set("f_horizon",d.horizon);
  set("f_constraints",d.constraints); set("f_uA",d.utilA); set("f_uB",d.utilB); set("f_w0",d.w0);
  set("f_mixed",d.mixedGain); set("f_floor",d.floor); set("f_asp",d.aspiration);
  set("f_sec",d.secPoints); set("f_tradeoff",d.tradeoff); set("f_draw",d.income);
  [["f_income_band",d.incomeBand],["f_exp",d.experience],["f_goal",d.goal]].forEach(([id,v])=>{
    if(v && $(id)) { const o=[...$(id).options].find(o=>o.value===v); if(o) $(id).value=v; } });
  if(d.floorAlpha!=null){ const s=$("f_alpha");
    const o=[...s.options].find(o=>Math.abs(parseFloat(o.value)-d.floorAlpha)<1e-9); if(o) s.value=o.value; }
  (d.riskChoices||[]).forEach((v,i)=>{ const n=$(`r${i}${v}`); if(n) n.checked=true; });
  (d.timeChoices||[]).forEach((v,i)=>{ const n=$(`t${i}${v==="delayed"?"D":"N"}`); if(n) n.checked=true; });
  (d.bfi||[]).forEach((v,i)=>{ const n=$(`b${i}_${v}`); if(n) n.checked=true; });
  buildUtil(); buildVF();
  (d.utilP||[]).forEach((v,i)=> set("u"+i, Math.round(v*100)));
  (d.vfGainP||[]).forEach((v,i)=> set("g"+i, Math.round(v*100)));
  (d.vfLossP||[]).forEach((v,i)=> set("l"+i, Math.round(v*100)));
  (d.pwCe||[]).forEach((v,i)=> set("pw"+i, v));
  sync();
}
const KEY="mba680.layered.v2";
const save=()=>{ try{ localStorage.setItem(KEY,JSON.stringify(readForm())); }catch(e){} };
const load=()=>{ try{ const s=localStorage.getItem(KEY); if(s) writeForm(JSON.parse(s)); }catch(e){} };
function sync(){
  const s=$("f_sec");
  if(s) $("f_sec_out").textContent = `${s.value} safe / ${100-s.value} shot`;
  document.querySelectorAll('#p-survey input[type=range]').forEach(r=>{
    const o=$(r.id+"_out"); if(o && r.id!=="f_sec") o.textContent=r.value+"%"; });
  const f=[...document.querySelectorAll("#p-survey input, #p-survey select")];
  const done=f.filter(x=>x.type==="radio"?x.checked:x.value!=="").length;
  $("prog").style.width=Math.min(100,100*done/f.length)+"%";
}

/* ------------------------------------------------ analysis */
function validate(d){
  const bad=[];
  if(!(d.corpus>0)) bad.push("how much you can invest");
  if(!(d.horizon>=1)) bad.push("how many years");
  if(!(d.utilB>d.utilA)) bad.push("your A and B amounts, B must be bigger");
  if(d.riskChoices.some(c=>!c)) bad.push("the sure-money rows");
  if(d.timeChoices.some(c=>!c)) bad.push("the now-or-later rows");
  if([...d.utilP,...d.vfGainP,...d.vfLossP].some(p=>!(p>0&&p<1))) bad.push("the sliders");
  if(d.floor>0 && d.floor > d.corpus*Math.pow(1+RF,d.horizon))
    bad.push(`your safety amount, since even a bank deposit cannot reach ${inr(d.floor)} from ${inr(d.corpus)} in ${d.horizon} years`);
  if(bad.length) throw new Error("please check "+bad.join(", "));
  return d;
}
function analyse(d){
  validate(d);
  const risk=classifyRisk(d.riskChoices);
  const time=bracketDiscount(d.timeChoices);
  const util=fitUtility(d.utilX,d.utilP,d.utilA,d.utilB);
  const val=fitValue(d.vfGainP,d.vfLossP,d.mixedGain);
  const wgt=fitWeighting(d.pwCe,val.alpha);
  const bfi=scoreBFI(d.bfi);
  const gamma=util?Math.max(util.gamma,0.2):3;
  const spa={ qs:Math.max((val.lambda||1)-1,0),
              qp:wgt?Math.max(1/wgt.gammaW-1,0):0,
              omega:(d.secPoints!=null?d.secPoints:50)/100,
              betaAsp:((d.tradeoff||0)/0.10)/d.corpus };
  const floorM=(d.floor||0)/d.corpus, aspM=(d.aspiration||d.corpus)/d.corpus;
  const scen={};
  for(const sc in SCENARIOS){
    const eng=engineFor(sc), eut=eutPortfolio(gamma,eng);
    const sa=bptSingleAccount(spa,eng,d.horizon,aspM,floorM,d.floorAlpha||0.1);
    const ma=bptMentalAccounts(d,eng,d.horizon);
    const conc=[20,12,8,5,3,2,1].map(n=>{ const m=bptMentalAccounts(d,eng,d.horizon,n);
      return {n, sigma:m.sleeveSigma, lossBps:m.lossBps}; });
    [eut,sa.best,ma.agg].forEach(p=>{
      p.pFloor1y=probBelow(floorM,p.mu,p.sigma,FLOOR_INTERIM_YEARS);
      p.pAsp=1-probBelow(aspM,p.mu,p.sigma,d.horizon);
      const [m,s]=termDist(p.mu,p.sigma,d.horizon);
      p.median=d.corpus*Math.exp(m);
      p.p05=d.corpus*Math.exp(m+s*normInv(0.05));
    });
    scen[sc]={eng,eut,sa,ma,conc};
  }
  return {inp:d,risk,time,util,val,wgt,bfi,spa,gamma,floorM,aspM,scen,
          advice:commentary(bfi,val,time,spa)};
}

const RULES=[
 ["N","high",0.5,"Worry will decide this, not the numbers",
  "Fund the safe layer first and show it as its own line before talking about returns. Look at the portfolio once a year, not once a month. Over a month there is roughly a 44% chance of seeing a loss; over a year it is about 12%. Set up the monthly payment automatically so the decision is not made again every month."],
 ["N","low",-0.5,"Calm enough to hold more equity than the score alone suggests",
  "The textbook allocation can be used close to its full value. The risk here is the opposite of worry: you are unlikely to panic, but also unlikely to check. Put a fixed rebalancing date in the calendar."],
 ["O","high",0.5,"Curiosity is good, but give it a budget",
  "Keep a real aspiration layer. If it is removed, that appetite usually reappears as unplanned trading outside the plan. Write down a cap, and pay for any new idea by selling something inside the same layer."],
 ["O","low",-0.5,"Keep it small and explain it in familiar terms",
  "Keep the aspiration layer small or leave it out. Describe the portfolio in terms of the companies in it rather than the maths behind it. Anything unfamiliar will be read as risk."],
 ["C","low",-0.5,"The plan will fail on follow-through, not on design",
  "Cut the number of decisions to almost zero: a standing instruction on payday, automatic rebalancing at a fixed threshold, no ad hoc top-ups. A slightly worse plan that is actually followed beats a perfect one that is not."],
 ["C","high",0.5,"Follow-through is reliable, so the plan can have more moving parts",
  "Threshold rebalancing, tax-loss harvesting and a staged entry are all realistic. The thing to watch is checking too often, so fix the review dates in advance."],
 ["E","high",0.5,"Conversations with friends are the likely source of changes",
  "Expect pressure from talk about individual stocks. Fix the review dates in advance and measure against your own goal, not against an index or against what a friend says they made."],
 ["A","high",0.5,"High trust means advice gets accepted without pushback",
  "Since you are unlikely to challenge a recommendation, the downside case has to be stated plainly and in rupees at every review."],
 ["A","low",-0.5,"You will check the reasoning, so lead with it",
  "Show the screen, the inputs and the constraints before the recommendation. Buy-in comes from the method, and an unexplained allocation will simply be ignored."]
];
function commentary(bfi,val,time,spa){
  const out=[];
  for(const [d,dir,thr,h,b] of RULES){ const z=bfi.domains[d].z;
    if((dir==="high"&&z>=thr)||(dir==="low"&&z<=thr)) out.push({domain:DOM[d],head:h,body:b}); }
  if(val.lambda && val.lambda>=2.5) out.push({domain:"Loss aversion",
    head:`Losses hurt about ${val.lambda.toFixed(1)} times as much as the same gain feels good`,
    body:"At this level how often you look at the portfolio matters more than what is in it. The same holding checked monthly and checked yearly produces different behaviour from the same person, so the review interval belongs in the plan next to the weights."});
  if(time.point>=0.20) out.push({domain:"Patience",
    head:`An implied discount rate near ${(time.point*100).toFixed(0)}% a year is very high`,
    body:"A rate this high usually means one of three things: a real short-term need for cash, a shorter true horizon than stated, or the questions not being taken literally. It is worth a direct conversation before acting on the stated long horizon."});
  if(spa.qp>=0.7) out.push({domain:"Long shots",
    head:"Small chances get more weight than they deserve",
    body:"You genuinely value a lottery-like payoff, and prospect theory treats that as a real preference rather than a mistake. Meet it inside the aspiration layer, where it is sized and visible, instead of letting it leak into the main portfolio."});
  return out;
}

/* ------------------------------------------------ render the plan */
function renderPlan(A){
  const P=$("p-plan"), s=A.scen[ADVICE], eut=s.eut, sa=s.sa.best, ma=s.ma, d=A.inp;
  const who=d.roll||"you";
  P.innerHTML="";
  P.append(el("h1",{},`Plan for ${who}`));
  P.append(el("p",{class:"lede"},
    `Built on ${inr(d.corpus)} over ${d.horizon} years. The risky part is the 60-stock `
    + `portfolio from Problem Statement 1, with its expected return cut three quarters of the `
    + `way back to a long-run average, which puts it at ${pct(s.eng.mu)} a year against `
    + `${pct(PS1.tangency.sigma)} of ups and downs.`));

  P.append(el("div",{class:"tiles",html:`
    <div class="tile"><div class="k">Risk aversion</div><div class="v">${A.gamma.toFixed(2)}</div>
      <div class="s">from your own utility curve</div></div>
    <div class="tile"><div class="k">Losses feel</div>
      <div class="v">${A.val.lambda?A.val.lambda.toFixed(2)+"x":"n/a"}</div>
      <div class="s">as bad as the same gain feels good</div></div>
    <div class="tile"><div class="k">Textbook answer</div><div class="v">${pct(eut.y,0)}</div>
      <div class="s">of your money in the risky portfolio</div></div>
    <div class="tile"><div class="k">Behavioral answer</div><div class="v">${pct(sa.y,0)}</div>
      <div class="s">once your safety amount is enforced</div></div>`}));

  const gap=Math.abs(eut.y-sa.y);
  P.append(el("div",{class:"card",html:`
    <div class="hd"><h2>Where the two answers differ</h2><p>${gap<0.03
      ? "They agree. Your safety amount is comfortable enough for the horizon that it never binds."
      : `The textbook answer uses one number, your risk aversion of ${A.gamma.toFixed(2)}, and gets `
        + `${pct(eut.y,0)}. The behavioral answer asks a second question: what are the chances you drop `
        + `below ${inr(d.floor)}, and can you live with that? Checking that at the one-year mark and not `
        + `only at the end moves you to ${pct(sa.y,0)}. The difference is what safety costs.`}</p></div>
    <div class="overflow"><table class="data"><thead><tr>
      <th>Plan</th><th class="n">In equity</th><th class="n">Return</th><th class="n">Risk</th>
      <th class="n">Likely end value</th><th class="n">Bad case</th>
      <th class="n">Chance of dropping below</th><th class="n">Chance of success</th></tr></thead>
      <tbody>${[["Textbook (EUT)","--s1",eut,pct(eut.y,0)],
                ["Behavioral (SP/A)","--s2",sa,pct(sa.y,0)],
                ["Layered","--s4",ma.agg,pct(1-ma.layers[0].weight,0)]].map(([n,c,p,y])=>`
        <tr><td><span class="swatch" style="background:${cssv(c)}"></span>${n}</td>
        <td class="n">${y}</td><td class="n">${pct(p.mu)}</td><td class="n">${pct(p.sigma)}</td>
        <td class="n">${inr(p.median)}</td><td class="n">${inr(p.p05)}</td>
        <td class="n">${pct(p.pFloor1y)}</td><td class="n">${pct(p.pAsp)}</td></tr>`).join("")}
      </tbody></table></div>
    <p class="tiny" style="margin-top:10px">Bad case is the 5th percentile. You said you could live
      with dropping below your safety amount about ${pct(d.floorAlpha,0)} of the time.</p>`}));

  const cols=["--s3","--s1","--s4"];
  P.append(el("div",{class:"card",html:`
    <div class="hd"><h2>Your three buckets</h2>
      <p>One for safety, one for income, one for the shot at the big number. Each gets its own
      job. The catch is that they are built separately, without looking at how they move together,
      and that is exactly why the total ends up below the line.</p></div>
    <div class="stack">${ma.layers.map((L,i)=>L.weight<=0.001?"":
      `<div style="flex:${L.weight}; background:${cssv(cols[i])}">${L.weight>0.10?pct(L.weight,0):""}</div>`).join("")}</div>
    <div class="overflow"><table class="data"><thead><tr>
      <th>Bucket</th><th>What it is for</th><th>How to hold it</th><th class="n">Amount</th><th class="n">Share</th>
    </tr></thead><tbody>${ma.layers.map((L,i)=>`
      <tr><td><span class="swatch" style="background:${cssv(cols[i])}"></span><b>${L.name}</b></td>
      <td class="muted">${esc(L.goal)}</td><td class="muted">${esc(L.vehicle)}</td>
      <td class="n">${inr(L.amount)}</td><td class="n">${pct(L.weight,0)}</td></tr>`).join("")}
    </tbody></table></div>
    <div class="note">Together these give ${pct(ma.agg.mu)} a year at ${pct(ma.agg.sigma)} risk.
      For that same risk you could have had ${pct(ma.calMu)}, so splitting the money into buckets
      costs about <b>${Math.round(ma.lossBps)} basis points a year</b>, or
      ${inr(d.corpus*ma.lossBps/10000)} on this amount. That is not a mistake to fix. It is the
      price of a plan you will actually stick with, and it is worth paying only if the alternative
      is giving up in a bad year.</div>`}));

  P.append(el("div",{class:"card",html:`
    <div class="hd"><h2>Your curves</h2><p>None of these is assumed. Each one is drawn from your own answers.</p></div>
    <div class="charts2">
      ${A.util?`<div><div class="chartwrap">${chartUtility(A.util)}</div>
        <div class="cap">Your utility curve. Dots are your answers, the solid line is the fitted
          curve with risk aversion ${A.util.gamma.toFixed(2)} and R&sup2; ${A.util.r2.toFixed(3)},
          the dashed green line is the log curve the lecture suggests, and the straight dashed
          line is what someone who did not mind risk at all would look like.</div></div>`:""}
      <div><div class="chartwrap">${chartValue(A.val,d.w0||d.corpus)}</div>
        <div class="cap">Gains and losses. Curvature ${A.val.alpha?A.val.alpha.toFixed(2):"n/a"} on
          the gain side and ${A.val.beta?A.val.beta.toFixed(2):"n/a"} on the loss side.</div></div>
      ${A.wgt?`<div><div class="chartwrap">${chartWeighting(A.wgt)}</div>
        <div class="cap">How you read chances, curvature ${A.wgt.gammaW.toFixed(2)}. Below the
          diagonal you are treating a chance as smaller than it is, above it as bigger.</div></div>`:""}
      <div><div class="chartwrap">${chartFrontier(eut,ma,s.eng)}</div>
        <div class="cap">Both plans against the frontier and the line from the risk-free rate.</div></div>
    </div>`}));

  const doms=["E","A","C","N","O"];
  P.append(el("div",{class:"card",html:`
    <div class="hd"><h2>What you are like, and what it changes</h2>
      <p>Personality does not change the maths. It changes how the plan should be built,
      explained and reviewed.</p></div>
    <div class="overflow"><table class="data"><thead><tr>
      <th>Trait</th><th class="n">Score</th><th class="n">Percentile</th><th>Against the average</th>
    </tr></thead><tbody>${doms.map(dd=>{ const b=A.bfi.domains[dd], w=Math.max(2,Math.min(100,b.pct));
      return `<tr><td><span class="swatch" style="background:${cssv(DOM_COLOR[dd])}"></span>${DOM[dd]}</td>
      <td class="n">${b.mean.toFixed(2)}</td><td class="n">${Math.round(b.pct)}</td>
      <td style="width:38%"><div style="background:var(--line); height:7px; border-radius:4px; position:relative">
        <div style="width:${w}%; height:100%; border-radius:4px; background:${cssv(DOM_COLOR[dd])}"></div>
        <div style="position:absolute; left:50%; top:-3px; width:1px; height:13px; background:var(--ink-3)"></div>
      </div></td></tr>`;}).join("")}</tbody></table></div>`}));

  const adv=el("div",{class:"card"});
  adv.append(el("div",{class:"hd",html:"<h2>What to do differently</h2><p>Each of these is triggered by one of your own answers.</p>"}));
  A.advice.forEach(a=>adv.append(el("div",{class:"adv",
    html:`<div class="d">${esc(a.domain)}</div><div class="h">${esc(a.head)}</div><div class="b">${esc(a.body)}</div>`})));
  if(!A.advice.length) adv.append(el("p",{class:"muted"},
    "Every trait is close to average and no preference is extreme, so a standard approach is fine."));
  P.append(adv);

  P.append(el("div",{class:"card",html:`
    <div class="hd"><h2>Checks on your answers</h2>
      <p>Two places where the questions can catch an inconsistency. This is information, not a mistake.</p></div>
    <div class="adv"><div class="d">Sure money or coin flip</div>
      <div class="h">${esc(A.risk.pattern)}${A.risk.euConsistent?"":", which expected utility cannot explain"}</div>
      <div class="b">${esc(A.risk.note)}</div></div>
    <div class="adv"><div class="d">Now or later</div>
      <div class="h">Implied rate around ${(A.time.point*100).toFixed(1)}% a year</div>
      <div class="b">${esc(A.time.note)}</div></div>
    ${A.val.alphaDetail&&A.val.alphaDetail.spread>0.3?`<div class="adv">
      <div class="d">Gains and losses</div>
      <div class="h">Your three gain answers do not agree with each other</div>
      <div class="b">They imply curvatures of ${A.val.alphaDetail.each.map(v=>v.toFixed(2)).join(", ")}.
        All three rows are the same question at a different size, so a steady answer would give the
        same number three times. The spread of ${A.val.alphaDetail.spread.toFixed(2)} is how much
        noise there is in a single answer, which is worth knowing before reading much into the average.</div></div>`:""}`}));

  P.append(el("div",{class:"card",html:`
    <div class="hd"><h2>How much of this depends on the assumptions</h2>
      <p>The expected return of the risky portfolio is the shakiest number here. This is your
      plan under all three versions of it.</p></div>
    <div class="overflow"><table class="data"><thead><tr>
      <th>Version</th><th class="n">Return</th><th class="n">Reward per unit of risk</th>
      <th class="n">Textbook</th><th class="n">Behavioral</th><th class="n">Cost of buckets</th></tr></thead>
      <tbody>${Object.keys(SCENARIOS).map(sc=>{const x=A.scen[sc];
        return `<tr${sc===ADVICE?' style="font-weight:560"':''}>
        <td>${SCENARIOS[sc].label}${sc===ADVICE?' <span class="pill ok">used</span>':''}</td>
        <td class="n">${pct(x.eng.mu)}</td><td class="n">${x.eng.sharpe.toFixed(2)}</td>
        <td class="n">${pct(x.eut.y,0)}</td><td class="n">${pct(x.sa.best.y,0)}</td>
        <td class="n">${Math.round(x.ma.lossBps)} bp</td></tr>`;}).join("")}</tbody></table></div>
    <h3>And if the shot-at-the-big-number bucket holds fewer names</h3>
    <div class="overflow"><table class="data"><thead><tr><th>Number of stocks</th>
      ${s.conc.map(c=>`<th class="n">${c.n}</th>`).join("")}</tr></thead><tbody>
      <tr><td>Its risk</td>${s.conc.map(c=>`<td class="n">${pct(c.sigma,0)}</td>`).join("")}</tr>
      <tr><td>Cost per year</td>${s.conc.map(c=>`<td class="n">${Math.round(c.lossBps)} bp</td>`).join("")}</tr>
    </tbody></table></div>
    <div class="note">Holding fewer names buys nothing. A handful of stocks from the same list moves
      with the market in the same way however few you hold, so cutting the number just adds swings
      that you are not paid for.</div>`}));

  P.append(el("div",{class:"card"}, el("div",{class:"row"},
    el("button",{class:"btn ghost",id:"dl-plan"},"Download this plan"),
    el("button",{class:"btn ghost",id:"print"},"Print or save as PDF"))));
  $("dl-plan").onclick=()=>download(`plan_${d.roll||"respondent"}.json`,
    JSON.stringify({input:d,risk:A.risk,time:A.time,utility:A.util,value:A.val,
                    weighting:A.wgt,bfi:A.bfi,scenarios:A.scen,advice:A.advice},null,1));
  $("print").onclick=()=>window.print();
}

/* ------------------------------------------------ group */
let GROUP=[];
function renderGroup(){
  const out=$("group-out"); out.innerHTML="";
  if(!GROUP.length){ out.append(el("p",{class:"muted"},"No responses loaded.")); return; }
  const rows=GROUP.map(g=>{ try{ return {ok:true,g,A:analyse(g)}; }
                            catch(e){ return {ok:false,g,err:e.message}; } });
  out.append(el("div",{class:"card",html:`
    <div class="hd"><h2>What the survey measured</h2>
      <p>${rows.length} responses. Blank cells are things the class form does not ask.</p></div>
    <div class="overflow"><table class="data"><thead><tr>
      <th>Roll</th><th class="n">Risk aversion</th><th class="n">Gain curve</th><th class="n">Loss curve</th>
      <th class="n">Loss aversion</th><th class="n">Discount rate</th><th>Risk pattern</th>
      <th class="n">Worry pct</th></tr></thead><tbody>
      ${rows.map((r,i)=>{ if(!r.ok) return `<tr><td>${esc(r.g.roll)}</td><td colspan="7" class="muted">${esc(r.err)}</td></tr>`;
        const A=r.A;
        return `<tr><td><span class="swatch" style="background:${cssv('--s'+(i%8+1))}"></span>${esc(A.inp.roll)}</td>
        <td class="n">${A.util?A.util.gamma.toFixed(2):"&#8211;"}</td>
        <td class="n">${A.val.alpha?A.val.alpha.toFixed(2):"&#8211;"}</td>
        <td class="n">${A.val.beta?A.val.beta.toFixed(2):"&#8211;"}</td>
        <td class="n">${A.val.lambda?A.val.lambda.toFixed(2):"&#8211;"}</td>
        <td class="n">${(A.time.point*100).toFixed(1)}%</td>
        <td class="muted" style="font-size:12.5px">${esc(A.risk.pattern)}${A.risk.euConsistent?"":" <b>(EU violation)</b>"}</td>
        <td class="n">${Math.round(A.bfi.domains.N.pct)}</td></tr>`;}).join("")}
    </tbody></table></div>`}));
  out.append(el("div",{class:"card",html:`
    <div class="hd"><h2>What they should hold</h2><p>Base-case inputs throughout.</p></div>
    <div class="overflow"><table class="data"><thead><tr>
      <th>Roll</th><th class="n">Amount</th><th class="n">Years</th><th class="n">Textbook</th>
      <th class="n">Behavioral</th><th class="n">Safe bucket</th><th class="n">Big-shot bucket</th>
      <th class="n">Cost of buckets</th></tr></thead><tbody>
      ${rows.filter(r=>r.ok).map((r,i)=>{const A=r.A,s=A.scen[ADVICE];
        return `<tr><td><span class="swatch" style="background:${cssv('--s'+(i%8+1))}"></span>${esc(A.inp.roll)}</td>
        <td class="n">${inr(A.inp.corpus)}</td><td class="n">${A.inp.horizon}</td>
        <td class="n">${pct(s.eut.y,0)}</td><td class="n">${pct(s.sa.best.y,0)}</td>
        <td class="n">${pct(s.ma.layers[0].weight,0)}</td><td class="n">${pct(s.ma.layers[2].weight,0)}</td>
        <td class="n">${Math.round(s.ma.lossBps)} bp</td></tr>`;}).join("")}
    </tbody></table></div>`}));
}

/* ------------------------------------------------ method */
function renderMethod(){
  const eng=engineFor(ADVICE);
  $("p-method").innerHTML=`
  <h1>Method</h1>
  <p class="lede">Every number the portal produces comes from one of the steps below, so a reader
  can disagree with a specific choice rather than with the output as a whole.</p>

  <div class="card"><div class="hd"><span class="num">2</span><h2>The sure-money ladder</h2></div>
  <p class="muted">Every row offers a certain amount exactly equal to the gamble's expected value.
  Under expected utility that means a risk-averse person must take the certain amount at
  <em>every</em> row, and a risk-seeking one must take the gamble at every row. No utility function
  over final wealth can produce a switch part-way down. So the ladder is used to classify the
  pattern and to flag violations, and the risk-aversion number itself is taken from the utility
  curve, where it is actually identified.</p></div>

  <div class="card"><div class="hd"><span class="num">4</span><h2>The utility curve</h2></div>
  <p class="muted">Probability equivalence, exactly as the Week 2 to 3 lecture sets it out.
  With U(A)=0 and U(B)=1, the probability that makes a certain X indifferent to the gamble
  <em>is</em> the utility of X.</p>
  <div class="note">U(X) = (1 &minus; p)&middot;U(A) + p&middot;U(B) = p</div>
  <p class="muted">Two curves are fitted to the same points. The log form the lecture suggests,
  U(W) = [ln W &minus; ln A] / [ln B &minus; ln A], and a one-parameter constant relative risk aversion
  form. The second is what the portfolio step needs, because that parameter is exactly the A in
  U = E(r) &minus; &frac12;A&sigma;&sup2;. The log curve is the special case A = 1.</p></div>

  <div class="card"><div class="hd"><span class="num">4.9</span><h2>Gains and losses</h2></div>
  <p class="muted">Each row offers a certain amount against a gamble paying double or nothing, so
  at indifference v(X) = p&middot;v(2X). With v(x) = x<sup>&alpha;</sup> the certain amount cancels:</p>
  <div class="note">X<sup>&alpha;</sup> = p&middot;(2X)<sup>&alpha;</sup> &nbsp;&rArr;&nbsp;
    p = (&frac12;)<sup>&alpha;</sup> &nbsp;&rArr;&nbsp; &alpha; = &minus;log&#8322;(p)</div>
  <p class="muted">This has a consequence worth stating. V1, V2 and V3 are the same question asked
  at three sizes, not three separate measurements, so a steady respondent must give the same answer
  to all three. The spread across them is therefore a reliability statistic, and averaging it away
  without reporting it hides how noisy a single answer is.</p>
  <p class="muted">Loss aversion cannot be recovered from these six rows at all. Each row is
  internally scaled, so the gain rows fix the gain curvature and the loss rows fix the loss
  curvature, but nothing ties their heights together. That needs a gamble with a gain on one side
  and a loss on the other, which is the first of the four questions added in Section 7.</p></div>

  <div class="card"><div class="hd"><span class="num">5</span><h2>The textbook portfolio</h2></div>
  <p class="muted">Maximising U = E(r) &minus; &frac12;A&sigma;&sup2; along the capital allocation
  line gives the solution in the lecture, with A read off the fitted utility curve:</p>
  <div class="note">y* = [ E(r<sub>P</sub>) &minus; r<sub>f</sub> ] / ( A &middot; &sigma;<sub>P</sub>&sup2; )</div>
  <p class="muted">Borrowing is capped at zero as a policy choice rather than a theoretical one.</p></div>

  <div class="card"><div class="hd"><span class="num">6</span><h2>The behavioral portfolios</h2></div>
  <p class="muted">Two, following Shefrin and Statman (2000). The single-account version maximises
  the SP/A objective of Lopes (1987), which distorts the whole distribution rather than individual
  probabilities: fear pulls weight onto the worst outcomes, hope onto the best.</p>
  <div class="note">h(D) = &omega;&middot;D<sup>1+q<sub>s</sub></sup> +
    (1&minus;&omega;)&middot;[1 &minus; (1&minus;D)<sup>1+q<sub>p</sub></sup>]<br>
    V = &int; h(D(w)) dw &nbsp;+&nbsp; &beta;<sub>A</sub>&middot;Pr(W &ge; A)</div>
  <p class="muted">&omega; comes from the respondent's own 100-point split and &beta;<sub>A</sub>
  from their stated trade-off, so neither is assumed. Fear is mapped from loss aversion as
  q<sub>s</sub> = &lambda; &minus; 1 and hope from the weighting curvature as
  q<sub>p</sub> = 1/&gamma; &minus; 1. Both vanish at the neutral value. These two mappings are the
  only modelling choice the data does not force, which is why they are stated here.</p>
  <p class="muted">The layered version follows Das, Markowitz, Scheid and Statman (2010): each
  bucket is built against its own target and its own acceptable failure rate, and the covariance
  between buckets is never consulted. That omission is the model, not an oversight. Since the
  frontier is defined by exactly those covariance terms, a portfolio built without them lands
  inside it except by coincidence.</p></div>

  <div class="card"><div class="hd"><span class="num">7</span><h2>Why the safety check is at one year</h2></div>
  <p class="muted">A floor you can breach in year two is not one you experience as safe. Checked
  only at the finish it almost never binds, because over five years at any positive reward-to-risk
  ratio equity beats cash even deep in the left tail. Checking it at the one-year mark as well is
  what makes it bite, and it matches what the model is about, which is how a holding feels along
  the way.</p></div>

  <div class="card"><div class="hd"><h2>Market inputs</h2></div>
  <div class="overflow"><table class="data"><thead><tr><th>Input</th><th class="n">Value</th><th>Where it comes from</th></tr></thead>
  <tbody>
    <tr><td>Risk-free rate</td><td class="n">${pct(RF)}</td><td class="muted">91-day Treasury bill, 21 August 2026</td></tr>
    <tr><td>Risky portfolio, as reported</td><td class="n">${pct(PS1.tangency.mu)} / ${pct(PS1.tangency.sigma)}</td>
        <td class="muted">The Problem Statement 1 maximum-Sharpe portfolio, 60 stocks</td></tr>
    <tr><td>Risky portfolio, base case</td><td class="n">${pct(eng.mu)} / ${pct(eng.sigma)}</td>
        <td class="muted">Return cut 75% toward a 12% long-run figure; risk left alone</td></tr>
    <tr><td>Big-shot bucket beta</td><td class="n">${SLEEVE_BETA.toFixed(3)}</td>
        <td class="muted">Derived, not assumed: the core is the best-reward portfolio, so every subset is priced off it</td></tr>
  </tbody></table></div>
  <div class="note">Those expected returns are three-year averages taken over a strong run in Indian
    equities. The error on a mean estimated that way is roughly 17% a year, so a reward-to-risk
    ratio of ${((PS1.tangency.mu-RF)/PS1.tangency.sigma).toFixed(2)} is not something to plan a
    household around. Risk estimates from the same data are far more reliable, which is why only the
    return is cut back.</div></div>

  <div class="card"><div class="hd"><h2>References</h2></div>
  <p class="muted" style="font-size:13.5px; line-height:1.7">
    Saurabh, S. Behavioral Finance (MBA680), Week 2 to 3 lecture, IIT Kanpur, 2026-27-I.<br>
    Kahneman, D. and Tversky, A. (1979). Prospect theory. <em>Econometrica</em> 47(2), 263-291.<br>
    Lopes, L. (1987). Between hope and fear. <em>Advances in Experimental Social Psychology</em> 20, 255-295.<br>
    Shefrin, H. and Statman, M. (2000). Behavioral portfolio theory. <em>JFQA</em> 35(2), 127-151.<br>
    Das, S., Markowitz, H., Scheid, J. and Statman, M. (2010). Portfolio optimization with mental accounts. <em>JFQA</em> 45(2), 311-334.<br>
    Soto, C. J. and John, O. P. (2017). The next Big Five Inventory (BFI-2). <em>JPSP</em> 113, 117-143.
  </p></div>`;
}

/* ------------------------------------------------ wiring */
function download(name,text){
  const b=new Blob([text],{type:"application/json"});
  const a=el("a",{href:URL.createObjectURL(b),download:name});
  document.body.append(a); a.click(); a.remove();
}
function show(tab){
  ["survey","plan","group","method"].forEach(t=>{
    $("p-"+t).classList.toggle("hide",t!==tab);
    $("t-"+t).setAttribute("aria-selected",String(t===tab)); });
  window.scrollTo({top:0,behavior:"instant"});
}
function boot(){
  buildRisk(); buildTime(); buildBFI(); buildUtil(); buildVF(); buildPW();
  sync(); load(); renderMethod();
  ["f_uA","f_uB"].forEach(id=>$(id).addEventListener("change",()=>{ buildUtil(); sync(); save(); }));
  document.addEventListener("input",e=>{ if(e.target.closest("#p-survey")){ sync(); save(); } });
  document.addEventListener("change",e=>{ if(e.target.closest("#p-survey")){ sync(); save(); } });
  ["survey","plan","group","method"].forEach(t=>$("t-"+t).onclick=()=>{
    if(t==="plan"){ try{ renderPlan(analyse(readForm())); }catch(e){ toast(e.message); return; } }
    if(t==="group") renderGroup();
    show(t); });
  $("go").onclick=()=>{ try{ renderPlan(analyse(readForm())); show("plan"); }
                        catch(e){ toast(e.message); } };
  $("dl-json").onclick=()=>{ const d=readForm();
    download(`response_${d.roll||"respondent"}.json`,JSON.stringify(d,null,1));
    toast("Saved. Send that file to whoever is collecting the group's data."); };
  $("demo").onclick=()=>{ writeForm(COLLECTED[2]); save(); toast("Filled in with a real response"); };
  $("clear").onclick=()=>{ localStorage.removeItem(KEY); location.reload(); };
  $("f-import").onchange=async e=>{
    const loaded=[];
    for(const f of [...e.target.files]){
      try{ const j=JSON.parse(await f.text()); (Array.isArray(j)?j:[j]).forEach(r=>loaded.push(r.input||r)); }
      catch(err){ toast("Could not read "+f.name); } }
    if(loaded.length){ GROUP=loaded; renderGroup(); toast(`Loaded ${loaded.length} response(s)`); } };
  $("reset-group").onclick=()=>{ GROUP=COLLECTED.slice(); renderGroup(); };
  $("theme").onclick=()=>{
    const cur=document.documentElement.getAttribute("data-theme");
    const next=cur==="dark"?"light":cur==="light"?"dark"
      :(matchMedia("(prefers-color-scheme: dark)").matches?"light":"dark");
    document.documentElement.setAttribute("data-theme",next);
    try{ localStorage.setItem("mba680.theme",next); }catch(e){}
    if(!$("p-plan").classList.contains("hide")){ try{ renderPlan(analyse(readForm())); }catch(e){} }
    if(!$("p-group").classList.contains("hide")) renderGroup();
    renderMethod(); };
  try{ const t=localStorage.getItem("mba680.theme"); if(t) document.documentElement.setAttribute("data-theme",t); }catch(e){}
  GROUP=COLLECTED.slice();
}
