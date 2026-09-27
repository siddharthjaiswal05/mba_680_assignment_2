"use strict";
/* ===================================================================
   MBA680 Steps 1 to 6.

   The instrument is the class form: R1-R8, T1-T6, the 30-item BFI-2
   subset, U1-U6 and V1-V6, with the exact wording and numbers from the
   Steps 1-4 document. Four short questions are added at the end, marked
   as extensions, because the class form leaves loss aversion, probability
   weighting and the behavioral layers unidentified.

   Market inputs are the Problem Statement 1 outputs.
   =================================================================== */

/* ---------------- Problem Statement 1 ---------------- */
const RF = 0.0650;
const PS1 = { gmv:{mu:0.1271,sigma:0.1403}, tangency:{mu:0.2493,sigma:0.1797},
              maxReturn:{mu:0.2514,sigma:0.1878} };
const AVG_VOL = 0.3471, AVG_CORR = 0.2383;
const EQUITY_PRIOR = 0.12;
const SCENARIOS = { in_sample:{shrink:0,label:"PS1 as reported"},
                    base:{shrink:0.75,label:"Base case"},
                    prudent:{shrink:1,label:"Stress case"} };
const ADVICE = "base";
const FLOOR_INTERIM_YEARS = 1.0;
const ASPIRATION_N = 8;

const FRONT_D = Math.pow(PS1.tangency.mu-PS1.gmv.mu,2) /
                (Math.pow(PS1.tangency.sigma,2)-Math.pow(PS1.gmv.sigma,2));
const frontierSigma = r => Math.sqrt(Math.max(
  PS1.gmv.sigma**2 + (r-PS1.gmv.mu)**2/FRONT_D, 1e-12));
const SLEEVE_COV = AVG_CORR*AVG_VOL*AVG_VOL;
const SLEEVE_BETA = SLEEVE_COV/(PS1.tangency.sigma**2);
const sleeveSigma = n => AVG_VOL*Math.sqrt(1/n + (1-1/n)*AVG_CORR);
const sleeveMuRaw = () => RF + SLEEVE_BETA*(PS1.tangency.mu-RF);
const sleeveCorr  = n => Math.min(SLEEVE_COV/(sleeveSigma(n)*PS1.tangency.sigma),0.999);
const shrinkMu = (mu,sc) => (1-SCENARIOS[sc].shrink)*mu + SCENARIOS[sc].shrink*EQUITY_PRIOR;
const engineFor = sc => { const mu = shrinkMu(PS1.tangency.mu,sc);
  return {name:sc, mu, sigma:PS1.tangency.sigma, sharpe:(mu-RF)/PS1.tangency.sigma}; };

/* ---------------- Section 2.1, the risk ladder ---------------- */
/* Every row offers a certain amount equal to the gamble's expected value. */
const RISK_CERTAIN = [10000,12000,15000,20000,25000,30000,40000,50000];

/* ---------------- Section 2.2, time preference ---------------- */
const TIME_OFFERS = [[10500,1],[11000,1],[12000,1],[13000,1],[15000,2],[18000,2]];
const timeRate = ([fv,t]) => Math.pow(fv/10000, 1/t) - 1;

/* ---------------- Section 3, the 30-item BFI-2 subset ----------------
   Item numbers and wording are the official BFI-2 items named in the
   Steps 1-4 document. `r:1` marks a reverse-keyed item. */
const BFI = [
 {n:1,  d:"E",f:"Sociability",         t:"Is outgoing, sociable."},
 {n:16, d:"E",f:"Sociability",         t:"Tends to be quiet.", r:1},
 {n:6,  d:"E",f:"Assertiveness",       t:"Has an assertive personality."},
 {n:36, d:"E",f:"Assertiveness",       t:"Finds it hard to influence people.", r:1},
 {n:41, d:"E",f:"Energy Level",        t:"Is full of energy."},
 {n:11, d:"E",f:"Energy Level",        t:"Rarely feels excited or eager.", r:1},
 {n:2,  d:"A",f:"Compassion",          t:"Is compassionate, has a soft heart."},
 {n:17, d:"A",f:"Compassion",          t:"Feels little sympathy for others.", r:1},
 {n:7,  d:"A",f:"Respectfulness",      t:"Is respectful, treats others with respect."},
 {n:22, d:"A",f:"Respectfulness",      t:"Starts arguments with others.", r:1},
 {n:27, d:"A",f:"Trust",               t:"Has a forgiving nature."},
 {n:42, d:"A",f:"Trust",               t:"Is suspicious of others' intentions.", r:1},
 {n:18, d:"C",f:"Organization",        t:"Is systematic, likes to keep things in order."},
 {n:3,  d:"C",f:"Organization",        t:"Tends to be disorganized.", r:1},
 {n:38, d:"C",f:"Productiveness",      t:"Is efficient, gets things done."},
 {n:8,  d:"C",f:"Productiveness",      t:"Tends to be lazy.", r:1},
 {n:13, d:"C",f:"Responsibility",      t:"Is dependable, steady."},
 {n:28, d:"C",f:"Responsibility",      t:"Can be somewhat careless.", r:1},
 {n:19, d:"N",f:"Anxiety",             t:"Can be tense."},
 {n:4,  d:"N",f:"Anxiety",             t:"Is relaxed, handles stress well.", r:1},
 {n:39, d:"N",f:"Depression",          t:"Often feels sad."},
 {n:9,  d:"N",f:"Depression",          t:"Stays optimistic after experiencing a setback.", r:1},
 {n:14, d:"N",f:"Emotional Volatility",t:"Is moody, has up and down mood swings."},
 {n:29, d:"N",f:"Emotional Volatility",t:"Is emotionally stable, not easily upset.", r:1},
 {n:10, d:"O",f:"Intellectual Curiosity", t:"Is curious about many different things."},
 {n:25, d:"O",f:"Intellectual Curiosity", t:"Avoids intellectual, philosophical discussions.", r:1},
 {n:20, d:"O",f:"Aesthetic Sensitivity",  t:"Is fascinated by art, music, or literature."},
 {n:5,  d:"O",f:"Aesthetic Sensitivity",  t:"Has few artistic interests.", r:1},
 {n:15, d:"O",f:"Creative Imagination",   t:"Is inventive, finds clever ways to do things."},
 {n:30, d:"O",f:"Creative Imagination",   t:"Has little creativity.", r:1}
];
const DOM = {E:"Extraversion",A:"Agreeableness",C:"Conscientiousness",
             N:"Negative Emotionality",O:"Open-Mindedness"};
const FACETS = {E:["Sociability","Assertiveness","Energy Level"],
  A:["Compassion","Respectfulness","Trust"],
  C:["Organization","Productiveness","Responsibility"],
  N:["Anxiety","Depression","Emotional Volatility"],
  O:["Intellectual Curiosity","Aesthetic Sensitivity","Creative Imagination"]};
/* Domain means and SDs from the BFI-2 norming sample (Soto and John 2017),
   used only to place a respondent on a percentile. */
const NORM = {E:[3.24,0.77],A:[3.65,0.66],C:[3.43,0.74],N:[2.93,0.86],O:[3.68,0.68]};
const DOM_COLOR = {E:"--s1",A:"--s3",C:"--s4",N:"--s8",O:"--s7"};

/* ---------------- Section 4.9, the value function ---------------- */
const VF_CERTAIN = [10000,20000,30000];   /* each against a double-or-nothing gamble */

/* ---------------- Extensions ---------------- */
const MIXED_LOSS = 10000, PW_STAKE = 10000, PW_P = [0.10,0.90];

/* ===================================================================
   Numerics
   =================================================================== */
const erf = x => { const s=x<0?-1:1; x=Math.abs(x);
  const t=1/(1+0.3275911*x);
  return s*(1-((((1.061405429*t-1.453152027)*t+1.421413741)*t-0.284496736)*t
    +0.254829592)*t*Math.exp(-x*x)); };
const normCdf = z => 0.5*(1+erf(z/Math.SQRT2));
const normPdf = z => Math.exp(-0.5*z*z)/Math.sqrt(2*Math.PI);
function normInv(p){
  if(p<=0) return -Infinity; if(p>=1) return Infinity;
  const a=[-3.969683028665376e+01,2.209460984245205e+02,-2.759285104469687e+02,
           1.383577518672690e+02,-3.066479806614716e+01,2.506628277459239e+00];
  const b=[-5.447609879822406e+01,1.615858368580409e+02,-1.556989798598866e+02,
           6.680131188771972e+01,-1.328068155288572e+01];
  const c=[-7.784894002430293e-03,-3.223964580411365e-01,-2.400758277161838e+00,
           -2.549732539343734e+00,4.374664141464968e+00,2.938163982698783e+00];
  const d=[7.784695709041462e-03,3.224671290700398e-01,2.445134137142996e+00,
           3.754408661907416e+00];
  let q,r; const pl=0.02425;
  if(p<pl){ q=Math.sqrt(-2*Math.log(p));
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);}
  if(p>1-pl){ q=Math.sqrt(-2*Math.log(1-p));
    return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);}
  q=p-0.5; r=q*q;
  return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q/
         (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
}
const lognCdf = (x,m,s) => x<=0?0:normCdf((Math.log(x)-m)/s);
const lognPdf = (x,m,s) => x<=0?0:normPdf((Math.log(x)-m)/s)/(x*s);
const crraU = (w,g) => Math.abs(g-1)<1e-9 ? Math.log(w) : (Math.pow(w,1-g)-1)/(1-g);

function minimise(f,a,b,tol=1e-7){
  const gr=(Math.sqrt(5)-1)/2;
  let c=b-gr*(b-a), d=a+gr*(b-a), fc=f(c), fd=f(d);
  for(let i=0;i<200 && Math.abs(b-a)>tol;i++){
    if(fc<fd){ b=d; d=c; fd=fc; c=b-gr*(b-a); fc=f(c); }
    else     { a=c; c=d; fc=fd; d=a+gr*(b-a); fd=f(d); }
  }
  return (a+b)/2;
}
function bisect(f,a,b,tol=1e-9){
  let fa=f(a); if(fa*f(b)>0) return NaN;
  for(let i=0;i<200;i++){ const m=(a+b)/2, fm=f(m);
    if(Math.abs(b-a)<tol) return m;
    if(fa*fm<=0) b=m; else { a=m; fa=fm; } }
  return (a+b)/2;
}

/* ===================================================================
   Estimation
   =================================================================== */

/**
 * Section 2.1. Every row is expected-value neutral, so under expected
 * utility a risk-averse respondent must choose the certain amount at
 * EVERY row and a risk-seeking one must choose the gamble at every row.
 * A switch part-way down cannot be produced by any concave or convex
 * utility function over final wealth, so the pattern is classified and
 * flagged rather than converted into a risk-aversion number.
 */
function classifyRisk(choices){
  const firstB = choices.indexOf("B"), firstA = choices.indexOf("A");
  const allA = choices.every(c=>c==="A"), allB = choices.every(c=>c==="B");
  let pattern, euConsistent = allA || allB, note;
  if(allA){ pattern = "Consistently risk averse";
    note = "Chose the certain amount at every stake, which is the expected-utility-consistent response for any concave utility."; }
  else if(allB){ pattern = "Consistently risk seeking";
    note = "Chose the gamble at every stake, which is consistent with a convex utility function throughout."; }
  else {
    let switches = 0;
    for(let i=1;i<choices.length;i++) if(choices[i]!==choices[i-1]) switches++;
    const dir = choices[0]==="A" ? "averse at low stakes, seeking at high stakes"
                                 : "seeking at low stakes, averse at high stakes";
    pattern = "Risk " + dir;
    note = `Switched ${switches===1?"once":switches+" times"}, first at R${(choices[0]==="A"?firstB:firstA)+1}. `
         + "Because every row is expected-value neutral, no utility function over final wealth can generate a switch. "
         + "This is a direct violation of expected utility and is consistent with outcomes being evaluated as gains and losses against a moving reference point.";
  }
  return {pattern, euConsistent, note, choices};
}

/**
 * Section 2.2. Each offer implies an annual rate r = (FV/10000)^(1/t) - 1.
 * Accepting a delay means the respondent's own discount rate is at or below
 * that offer. Sorting the offers by rate turns the six answers into a bracket.
 */
function bracketDiscount(choices){
  const rows = TIME_OFFERS.map((o,i)=>({rate:timeRate(o), waited:choices[i]==="delayed", i}))
                          .sort((a,b)=>a.rate-b.rate);
  const acc = rows.filter(r=>r.waited).map(r=>r.rate);
  const rej = rows.filter(r=>!r.waited).map(r=>r.rate);
  const lo = rej.length ? Math.max(...rej) : 0;
  const hi = acc.length ? Math.min(...acc) : Infinity;
  const consistent = lo <= hi + 1e-12;
  return { lo, hi, consistent,
    point: !isFinite(hi) ? lo : (consistent ? (lo+hi)/2 : (lo+hi)/2),
    note: !acc.length ? `Never accepted a delay, so the implied rate is above ${(lo*100).toFixed(1)}% a year.`
      : consistent ? `Rejected up to ${(lo*100).toFixed(1)}% and accepted from ${(hi*100).toFixed(1)}%, a consistent bracket.`
      : `Rejected an offer of ${(lo*100).toFixed(1)}% while accepting one of ${(hi*100).toFixed(1)}%, so the answers are mildly non-monotonic. Reported as an approximate midpoint rather than a hard interval.` };
}

/**
 * Section 3. Items arrive as raw 1 to 5 responses in the order of the BFI
 * array; reverse-keyed items are scored as 6 minus the response.
 */
function scoreBFI(ans){
  const dom = {E:[],A:[],C:[],N:[],O:[]}, facet = {};
  BFI.forEach((it,i)=>{
    const v = it.r ? 6-ans[i] : ans[i];
    dom[it.d].push(v);
    (facet[it.d+"|"+it.f] = facet[it.d+"|"+it.f] || []).push(v);
  });
  const out = {domains:{}, facets:{}};
  for(const d in dom){
    const m = dom[d].reduce((a,b)=>a+b,0)/dom[d].length;
    const z = (m-NORM[d][0])/NORM[d][1];
    out.domains[d] = {label:DOM[d], mean:m, z, pct:normCdf(z)*100};
    out.facets[d] = FACETS[d].map(f=>{
      const v = facet[d+"|"+f] || [];
      return {facet:f, mean: v.reduce((a,b)=>a+b,0)/(v.length||1)};
    });
  }
  return out;
}

/**
 * Section 4.4. Probability equivalence: U(A)=0, U(B)=1, and at indifference
 * U(X) = p. Two curves are fitted to the same points.
 *
 *   Log, the form the lecture suggests:  U(W) = [lnW - lnA] / [lnB - lnA]
 *   CRRA, one free parameter:            U(W) = [W^(1-g) - A^(1-g)] / [B^(1-g) - A^(1-g)]
 *
 * The CRRA gamma is what the mean-variance step needs, because relative risk
 * aversion is exactly the A in U = E(r) - 0.5*A*sigma^2. The log fit is the
 * special case gamma = 1 and is reported beside it.
 */
function fitUtility(xs, ps, A, B){
  if(!xs || !xs.length || !(B>A)) return null;
  /* Wealth is normalised by A before fitting. The probability equivalence is a ratio
     of utility differences and CRRA scales those by a common factor, so this leaves
     every answer unchanged while keeping the powers inside floating-point range. At
     rupee scale W^(1-g) underflows to zero once g passes about six, which collapses
     the denominator and makes the fit meaningless. */
  const a=1, b=B/A, xn=xs.map(x=>x/A);
  const pred=(x,g)=>(crraU(x,g)-crraU(a,g))/(crraU(b,g)-crraU(a,g));
  const sse=g=>xn.reduce((s,x,i)=>s+(pred(x,g)-ps[i])**2,0);
  const g=minimise(sse,-0.9,15);
  const mean=ps.reduce((x,y)=>x+y,0)/ps.length;
  const sst=ps.reduce((x,y)=>x+(y-mean)**2,0);
  const logPred=xn.map(x=>Math.log(x)/Math.log(b));
  const logSse=xn.reduce((s,x,i)=>s+(logPred[i]-ps[i])**2,0);
  return { gamma:g, rmse:Math.sqrt(sse(g)/xn.length),
           r2: sst>0 ? 1-sse(g)/sst : NaN,
           logRmse: Math.sqrt(logSse/xn.length),
           atBound: g>14.5 || g<-0.85,
           points: xs.map((x,i)=>({x, p:ps[i], crra:pred(xn[i],g), log:logPred[i]})),
           concave: g>0.05, A, B };
}


/**
 * Section 4.9. Every row offers a certain amount against a gamble paying
 * double or nothing, so at indifference
 *
 *     v(X) = p * v(2X)   =>   X^a = p (2X)^a   =>   p = (1/2)^a
 *
 * The certain amount cancels. V1, V2 and V3 are therefore the SAME question
 * asked at three scales, not three independent identifications, and a power
 * value function predicts an identical answer to all three. The spread across
 * them is response noise, so it is reported as a reliability statistic rather
 * than averaged away silently.
 */
function fitValue(gainP, lossP, mixedGain){
  const est = ps => {
    if(!ps || !ps.length) return null;
    const each = ps.map(p=>-Math.log2(p));
    const m = each.reduce((a,b)=>a+b,0)/each.length;
    return {est:m, each, spread:Math.max(...each)-Math.min(...each),
            sd: Math.sqrt(each.reduce((s,v)=>s+(v-m)**2,0)/each.length)};
  };
  const a = est(gainP), b = est(lossP);
  let lambda = null, lambdaNote =
    "Not identified. The class form has no mixed gain-and-loss gamble, and the gain and loss rows are each internally scaled, so they pin down the two curvatures but say nothing about their relative height.";
  if(a && b && mixedGain > 0){
    const abar = 0.5*(a.est + b.est);
    lambda = Math.pow(mixedGain/MIXED_LOSS, abar);
    lambdaNote = `Estimated from the added mixed gamble at the common curvature ${abar.toFixed(2)}. `
      + "Lambda is only scale free when the two curvatures are equal, so quoting it without them is meaningless.";
  }
  return { alpha:a?a.est:null, beta:b?b.est:null, alphaDetail:a, betaDetail:b,
           lambda, lambdaNote,
           alphaConcave: a ? a.est < 1 : null, betaConvex: b ? b.est < 1 : null };
}

const ktWeight = (p,g) => Math.pow(p,g)/Math.pow(Math.pow(p,g)+Math.pow(1-p,g),1/g);

function fitWeighting(ces, alpha){
  if(!ces || ces.some(c=>!(c>0)) || !alpha) return null;
  const obs = ces.map(c=>Math.pow(c/PW_STAKE, alpha));
  const sse = g => PW_P.reduce((s,p,i)=>s+(ktWeight(p,g)-obs[i])**2,0);
  const g = minimise(sse, 0.28, 1.0);
  return {gammaW:g, rmse:Math.sqrt(sse(g)/PW_P.length), observed:obs,
          crossover: bisect(p=>ktWeight(p,g)-p, 0.01, 0.99)};
}

/* ---------------- Portfolios ---------------- */
const termDist = (mu,sig,y) => [(mu-0.5*sig*sig)*y, Math.max(sig*Math.sqrt(y),1e-9)];
const probBelow = (mult,mu,sig,y) => { if(mult<=0) return 0;
  const [m,s]=termDist(mu,sig,y); return normCdf((Math.log(mult)-m)/s); };

function eutPortfolio(gamma, eng, cap=1.0){
  const yStar = (eng.mu-RF)/(gamma*eng.sigma*eng.sigma);
  const y = Math.min(Math.max(yStar,0),cap);
  const mu = RF+y*(eng.mu-RF), sigma = y*eng.sigma;
  return {yStar, y, capped:yStar>cap, mu, sigma, utility: mu-0.5*gamma*sigma*sigma};
}

function spaValue(mu,sig,yrs,spa,aspMult,n=1200){
  const [m,s]=termDist(mu,sig,yrs);
  const hi=Math.exp(m+6*s), dx=hi/n;
  let sp=0;
  for(let i=0;i<n;i++){
    const w=(i+0.5)*dx, D=1-lognCdf(w,m,s);
    sp += (spa.omega*Math.pow(D,1+spa.qs) +
           (1-spa.omega)*(1-Math.pow(1-D,1+spa.qp)))*dx;
  }
  const pAsp = 1-lognCdf(aspMult,m,s);
  return {sp, pAsp, objective: sp + spa.betaAsp*pAsp};
}

function bptSingleAccount(spa, eng, yrs, aspMult, floorMult, alpha){
  let best=null, feasible=false; const curve=[];
  for(let i=0;i<=120;i++){
    const y=i/120, mu=RF+y*(eng.mu-RF), sig=y*eng.sigma;
    const pT=probBelow(floorMult,mu,sig,yrs), pI=probBelow(floorMult,mu,sig,FLOOR_INTERIM_YEARS);
    const v=spaValue(mu,sig,yrs,spa,aspMult);
    const ok=Math.max(pT,pI)<=alpha+1e-9; feasible=feasible||ok;
    const row={y,mu,sigma:sig,pT,pI,ok,...v}; curve.push(row);
    if(ok && (!best || v.objective>best.objective)) best=row;
  }
  if(!best) best=curve.reduce((a,b)=>Math.max(b.pT,b.pI)<Math.max(a.pT,a.pI)?b:a);
  return {best, feasible, curve};
}

function bptMentalAccounts(inp, eng, yrs, nSleeve=ASPIRATION_N){
  const corpus=inp.corpus;
  const l1=Math.min(inp.floor/Math.pow(1+RF,yrs), corpus);
  let need=0; for(let t=1;t<=yrs;t++) need += (inp.income||0)/Math.pow(1+RF,t);
  const l2=Math.min(need, Math.max(corpus-l1,0));
  const l3=Math.max(corpus-l1-l2,0);
  let y2=0;
  for(let i=0;i<=100;i++){ const y=i/100;
    if(probBelow(1.0, RF+y*(eng.mu-RF), y*eng.sigma, yrs)<=0.10+1e-9) y2=y; }
  const mu2=RF+y2*(eng.mu-RF), sig2=y2*eng.sigma;
  const sig3=sleeveSigma(nSleeve), mu3=shrinkMu(sleeveMuRaw(), eng.name), rho=sleeveCorr(nSleeve);
  const w1=l1/corpus, w2=l2/corpus, w3=l3/corpus;
  const muAgg=w1*RF+w2*mu2+w3*mu3;
  const sigAgg=Math.sqrt(Math.max((w2*sig2)**2+(w3*sig3)**2+2*rho*(w2*sig2)*(w3*sig3),0));
  const calMu=RF+eng.sharpe*sigAgg;
  return { layers:[
      {name:"Security", amount:l1, weight:w1, mu:RF, sigma:0, y:0,
       vehicle:"Treasury bills or a bank fixed deposit",
       goal:`Hold at least ${inr(inp.floor)} at year ${yrs}`},
      {name:"Income", amount:l2, weight:w2, mu:mu2, sigma:sig2, y:y2,
       vehicle:`${pct(y2,0)} in the PS1 portfolio, the rest in T-bills`,
       goal: inp.income>0 ? `Fund ${inr(inp.income)} a year for ${yrs} years` : "Not required"},
      {name:"Aspiration", amount:l3, weight:w3, mu:mu3, sigma:sig3, y:1,
       vehicle:`Equal-weighted ${nSleeve}-name cut of the same portfolio`,
       goal:`Reach ${inr(inp.aspiration)}`}],
    nSleeve, sleeveSigma:sig3, sleeveMu:mu3, rho,
    agg:{mu:muAgg, sigma:sigAgg}, calMu, lossBps:(calMu-muAgg)*10000 };
}

/* ---------------- formatting ---------------- */
const pct = (x,d=1) => (x*100).toFixed(d)+"%";
function inr(x){ if(!isFinite(x)||x==null) return "n/a";
  const n=Math.round(x);
  if(n>=1e7) return "Rs "+(n/1e7).toFixed(2).replace(/\.00$/,"")+" cr";
  if(n>=1e5) return "Rs "+(n/1e5).toFixed(2).replace(/\.00$/,"")+" L";
  return "Rs "+n.toLocaleString("en-IN"); }
const cssv = v => getComputedStyle(document.body).getPropertyValue(v).trim();
const esc = s => String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
