const fs=require('fs');
const html=fs.readFileSync(require('path').join(__dirname,'..','..','docs','index.html'),'utf8');
const js=html.split('<script>\n"use strict";')[1].split(/\nboot\(\);/)[0];

// Stub the DOM pieces the math does not need.
global.document={getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],
  createElement:()=>({append(){},setAttribute(){},style:{},classList:{toggle(){},add(){},remove(){}}}),
  addEventListener(){},body:{}};
global.getComputedStyle=()=>({getPropertyValue:()=>"#000"});
global.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
global.matchMedia=()=>({matches:false});
global.window={scrollTo(){},print(){}};

const mod = new Function(js + "\n; return {analyse, PILOT, ADVICE, engineFor, fitCRRA, FRONT_D, SLEEVE_BETA};");
const M = mod();

const py=JSON.parse(fs.readFileSync(require('path').join(__dirname,'..','outputs','analysis.json'),'utf8'));
const byId={}; py.results.forEach(r=>byId[r.member.member_id]=r);

const rows=[];
let worst=0, worstWhat="";
function cmp(id,what,a,b,tol){
  const d=Math.abs(a-b);
  const rel = Math.abs(b)>1e-9 ? d/Math.abs(b) : d;
  if(rel>worst){worst=rel;worstWhat=`${id} ${what}`;}
  return {id,what,js:a,py:b,rel};
}
for(const p of M.PILOT){
  const A=M.analyse(p); const R=byId[p.id]; const s=R.scenarios[M.ADVICE]; const js=A.scen[M.ADVICE];
  rows.push(cmp(p.id,"gamma",A.ra.gamma,R.fitted.risk_aversion.gamma));
  rows.push(cmp(p.id,"alpha",A.val.alpha,R.fitted.value.alpha));
  rows.push(cmp(p.id,"beta",A.val.beta,R.fitted.value.beta));
  rows.push(cmp(p.id,"lambda",A.val.lambda,R.fitted.value.lambda));
  rows.push(cmp(p.id,"gammaW",A.wgt.gammaW,R.fitted.weighting.gamma_w));
  rows.push(cmp(p.id,"presentBias",A.dis.beta,R.fitted.discounting.beta_present_bias));
  rows.push(cmp(p.id,"bfi_N",A.bfi.N.mean,R.bfi.N.mean));
  rows.push(cmp(p.id,"eut_y",js.eut.y,s.eut.y_advised));
  rows.push(cmp(p.id,"spa_y",js.sa.best.y,s.bpt_sa.optimum.y));
  rows.push(cmp(p.id,"ma_mu",js.ma.agg.mu,s.bpt_ma.aggregate.mu));
  rows.push(cmp(p.id,"ma_sigma",js.ma.agg.sigma,s.bpt_ma.aggregate.sigma));
  rows.push(cmp(p.id,"loss_bps",js.ma.lossBps,s.bpt_ma.efficiency_loss_bps));
}
const bad=rows.filter(r=>r.rel>0.02);
console.log(`compared ${rows.length} quantities across ${M.PILOT.length} members`);
console.log(`worst relative difference: ${(worst*100).toFixed(3)}%  (${worstWhat})`);
if(bad.length){
  console.log("\nover 2% apart:");
  bad.forEach(r=>console.log(`  ${r.id} ${r.what.padEnd(13)} js=${r.js.toFixed(5)}  py=${r.py.toFixed(5)}  ${(r.rel*100).toFixed(2)}%`));
  process.exit(1);
} else { console.log("engine and portal agree"); process.exit(0); }
