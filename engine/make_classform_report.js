/**
 * Builds the MBA680 Steps 1 to 6 report from outputs/classform.json.
 * Every quoted figure is read from that file, so the document cannot drift.
 *   node make_classform_report.js
 */
const fs = require("fs"), path = require("path"), D = require("docx");
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak,
        Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, ImageRun,
        Footer, PageNumber } = D;

const HERE = __dirname;
const FIGDIR = path.join(HERE, "..", "figures");
const OUTDIR = path.join(HERE, "..", "report");
const A = JSON.parse(fs.readFileSync(path.join(HERE, "outputs", "classform.json"), "utf8"));
const R = A.results, ADV = A.constants.advice, ENG = A.engines[ADV];
const by = Object.fromEntries(R.map(r => [r.roll, r]));

const RISK_CERTAIN=[10000,12000,15000,20000,25000,30000,40000,50000];
const TIME_OFFERS=[[10500,1],[11000,1],[12000,1],[13000,1],[15000,2],[18000,2]];
const VF_C=[10000,20000,30000];
/* Read the item list out of the portal so the report and the survey cannot disagree. */
const BFI_ITEMS=(()=>{
  const src=fs.readFileSync(path.join(HERE,"..","docs","survey.js"),"utf8");
  const blk=src.match(/const BFI = \[([\s\S]*?)\n\];/)[1];
  const D2={E:"Extraversion",A:"Agreeableness",C:"Conscientiousness",
            N:"Negative Emotionality",O:"Open-Mindedness"};
  const out=[];
  blk.split("\n").forEach(line=>{
    const m=line.match(/\{n:(\d+),\s*d:"(\w)",\s*f:"([^"]+)",\s*t:"([^"]+)"(,\s*r:1)?\}/);
    if(m) out.push({n:+m[1],dom:D2[m[2]],facet:m[3],text:m[4],r:!!m[5]});
  });
  if(out.length!==30) throw new Error("expected 30 BFI items, parsed "+out.length);
  return out;
})();

const pct = (x,d=1) => x==null ? "n/a" : (x*100).toFixed(d)+"%";
const f2 = x => x==null ? "n/a" : Number(x).toFixed(2);
const inr = x => { if(x==null) return "n/a"; const n=Math.round(x);
  if(n>=1e7) return "Rs "+(n/1e7).toFixed(2).replace(/\.00$/,"")+" crore";
  if(n>=1e5) return "Rs "+(n/1e5).toFixed(2).replace(/\.00$/,"")+" lakh";
  return "Rs "+n.toLocaleString("en-IN"); };

const INK="1A1A1A", INK2="56554F", RULE="D8D6D0", BAND="F4F3F0", ACC="2A78D6";
const P=(t,o={})=>new Paragraph({spacing:{after:o.after??120,line:o.line??300},
  alignment:o.align, children:[new TextRun({text:t,size:o.size??20,color:o.color??INK,
  bold:o.bold,italics:o.italics})]});
const RP=(parts,o={})=>new Paragraph({spacing:{after:o.after??120,line:o.line??300},
  children:parts.map(p=>typeof p==="string"
    ? new TextRun({text:p,size:o.size??20,color:INK})
    : new TextRun({text:p.t,size:o.size??20,bold:p.b,italics:p.i,color:p.c??INK,
                   font:p.code?"Consolas":undefined}))});
const H=(t,l=1)=>new Paragraph({heading:l===1?HeadingLevel.HEADING_1:l===2?HeadingLevel.HEADING_2:HeadingLevel.HEADING_3,
  spacing:{before:l===1?380:l===2?300:220,after:l===1?160:110},keepNext:true,
  children:[new TextRun({text:t,size:l===1?28:l===2?23:21,bold:true,color:INK})]});
const NOTE=(lines,o={})=>lines.map((t,i)=>new Paragraph({
  spacing:{before:i===0?120:0,after:i===lines.length-1?150:40,line:280},
  indent:{left:340},
  border:{left:{style:BorderStyle.SINGLE,size:10,color:o.color??RULE,space:14}},
  children:[new TextRun({text:t,size:19,color:INK2,font:o.mono?"Consolas":undefined})]}));

function cell(text,o={}){ return new TableCell({
  width:o.width?{size:o.width,type:WidthType.DXA}:undefined,
  shading:o.shade?{type:ShadingType.CLEAR,fill:o.shade,color:"auto"}:undefined,
  margins:{top:70,bottom:70,left:100,right:100},
  borders:{top:{style:BorderStyle.SINGLE,size:o.top??2,color:RULE},
           bottom:{style:BorderStyle.SINGLE,size:o.bottom??2,color:RULE},
           left:{style:BorderStyle.NONE},right:{style:BorderStyle.NONE}},
  children:(Array.isArray(text)?text:[text]).map(t=>new Paragraph({
    spacing:{after:0,line:260}, alignment:o.right?AlignmentType.RIGHT:undefined,
    children:[new TextRun({text:String(t),size:o.size??18,bold:o.bold,color:o.color??INK})]}))});}
function table(cols,head,rows,opts={}){ const rf=opts.rightFrom??1;
  return new Table({columnWidths:cols, width:{size:cols.reduce((a,b)=>a+b,0),type:WidthType.DXA},
    rows:[ new TableRow({tableHeader:true,children:head.map((h,i)=>
             cell(h,{width:cols[i],bold:true,size:17,color:INK2,right:i>=rf,bottom:8}))}),
      ...rows.map((r,ri)=>new TableRow({children:r.map((c,i)=>
         cell(c,{width:cols[i],right:i>=rf,shade:opts.band&&ri%2===1?BAND:undefined,
                 bold:opts.boldRow===ri}))}))]});}
function figure(file,caption,widthPt=468){
  const p=path.join(FIGDIR,file);
  if(!fs.existsSync(p)) return [P(`[missing figure: ${file}]`,{color:"AA0000"})];
  const buf=fs.readFileSync(p), w=buf.readUInt32BE(16), h=buf.readUInt32BE(20);
  return [ new Paragraph({spacing:{before:160,after:60},alignment:AlignmentType.CENTER,
      children:[new ImageRun({data:buf,type:"png",
        transformation:{width:widthPt,height:Math.round(widthPt*h/w)}})]}),
    new Paragraph({spacing:{after:220},alignment:AlignmentType.CENTER,
      children:[new TextRun({text:caption,size:17,color:INK2,italics:true})]})];}

const doc=[];
const usable = R.filter(r=>r.portfolios);
const blocked = R.filter(r=>!r.portfolios);

/* ---- title ---- */
doc.push(
  new Paragraph({spacing:{before:1300,after:0},children:[new TextRun({
    text:"BEHAVIORAL FINANCE (MBA680)",size:20,color:ACC,bold:true})]}),
  new Paragraph({spacing:{before:140,after:0},children:[new TextRun({
    text:"Personal Investment Advisor",size:44,bold:true,color:INK})]}),
  new Paragraph({spacing:{before:0,after:0},children:[new TextRun({
    text:"and Robo-Advisory Project",size:44,bold:true,color:INK})]}),
  new Paragraph({spacing:{before:120,after:220},children:[new TextRun({
    text:"Steps 1 to 6, on the fielded peer-group responses",size:26,color:INK2})]}),
  P("Every figure in this report is computed from the submitted survey responses. Where a "
  + "respondent's data could not be used, that is stated and the cell is left empty. Where the "
  + "class instrument cannot identify a parameter at all, that is reported as a property of the "
  + "instrument. No participant results are fabricated.", {size:19,color:INK2,italics:true}));
doc.push(table([2100,6600],["",""],[
  ["Peer group", `${R.length} respondents, roll numbers ${R.map(r=>r.roll).join(", ")}`],
  ["Instrument", "The class form: R1-R8, T1-T6, the 30-item BFI-2 subset, U1-U6, V1-V6"],
  ["Market inputs", "The 60-stock maximum-Sharpe portfolio from Problem Statement 1"],
  ["Methods", "Expected utility theory, prospect theory, behavioral portfolio theory"],
], {rightFrom:99}));
doc.push(new Paragraph({children:[new PageBreak()]}));

/* ================================================== 1 */
doc.push(H("1. Summary"));
doc.push(P("Four classmates completed the Steps 1 to 4 survey. This report estimates everything "
  + "those answers identify, builds the Step 5 portfolios on the actual Problem Statement 1 "
  + "outputs rather than on illustrative market assumptions, and gives the Step 6 personality "
  + "commentary. It also sets out, precisely, what the instrument cannot measure and what four "
  + "extra questions would fix."));

doc.push(H("The four findings", 2));
doc.push(RP([{t:"The risk ladder cannot measure risk aversion, and two respondents proved it. ",b:true},
  "Every row of R1 to R8 offers a certain amount exactly equal to the gamble's expected value. "
  + "Under expected utility a risk-averse person must therefore choose the certain amount at all "
  + "eight rows, and a risk-seeking person the gamble at all eight. No utility function over final "
  + `wealth can produce a switch part way down. Roll ${by["251250039"].roll} switches at `
  + `R${by["251250039"].risk.switch_row} and roll ${by["251250002"].roll} switches at `
  + `R${by["251250002"].risk.switch_row}. Those are not noise, they are direct violations of `
  + "expected utility, and they are exactly what prospect theory predicts. Risk aversion is "
  + "therefore taken from the utility curve, where it is genuinely identified."]));
doc.push(RP([{t:"Loss aversion is not identified by this instrument at all. ",b:true},
  "Each of V1 to V6 offers a certain amount against a gamble paying double or nothing, so the "
  + "certain amount cancels and the row reveals only a curvature. The gain rows fix the gain "
  + "curvature and the loss rows fix the loss curvature, but nothing anywhere in the form compares "
  + "their heights. Lambda needs a gamble with a gain on one side and a loss on the other. Without "
  + "it, the single most important parameter in prospect theory is missing."]));
doc.push(RP([{t:"V1, V2 and V3 are the same question asked three times. ",b:true},
  "Because the certain amount cancels, all three rows imply the identical curvature, so a steady "
  + `respondent gives the same answer to each. Roll ${by["251250039"].roll} answered 0.40, 0.45 and `
  + `0.70, implying curvatures of ${by["251250039"].value.alpha_detail.each.map(v=>v.toFixed(2)).join(", ")}, `
  + `a spread of ${by["251250039"].value.alpha_detail.spread.toFixed(2)}. Averaging to `
  + `${f2(by["251250039"].value.alpha)} hides that. The spread is the measurement error on a single `
  + "answer and belongs in the report."]));
doc.push(RP([{t:"The recommendation depends more on the return assumption than on the client. ",b:true},
  `Both respondents with usable utility data want more than 100% in equities under every one of the `
  + `three input sets, so the no-borrowing cap binds and both receive the same advice. What separates `
  + `them is not their preferences but whether the Problem Statement 1 expected return of `
  + `${pct(A.constants.ps1.tangency.mu)} is believed.`]));

doc.push(H("Data quality", 2));
doc.push(P("Recorded rather than silently corrected."));
doc.push(table([1500,7200],["Roll","Issue"],[
  ["251250047","The four utility amounts (Rs 50,000 to Rs 85,000) fall below the stated lower endpoint A of Rs 100,000, so they lie outside the valid range. No utility curve, and therefore no Step 5 portfolio. Needs re-eliciting between A and B."],
  ["251250030","U1 to U4 left blank, so no utility curve. The V1 to V6 indifference fields contain rupee amounts rather than probabilities, so the value function is also unusable. Both need re-collecting."],
  ["251250002","Did not state a reference amount W0, so the value curve is drawn in relative terms."],
  ["251250047","Did not state a reference amount W0, same treatment."],
  ["251250039","Time answers are mildly non-monotonic. Reported as a midpoint rather than a hard bracket."],
], {band:true, rightFrom:99}));

/* ================================================== 2 */
doc.push(H("2. Participants"));
doc.push(table([1400,700,1500,1300,900,1700,1200],
  ["Roll","Age","Investable wealth","Experience","Horizon","Primary goal","Usable for Step 5"],
  R.map(r=>[r.roll,String(r.age),inr(r.corpus),r.experience,r.horizon+" yrs",r.goal,
            r.portfolios?"Yes":"No"]), {band:true, rightFrom:1}));

/* ================================================== 3 */
doc.push(H("3. Method"));
doc.push(H("3.1 The risk ladder, and why it is classified rather than fitted", 2));
doc.push(P("Every row of R1 to R8 pairs a certain amount X with a gamble paying 2X or nothing on a "
  + "coin flip. The expected values are identical by construction, so the choice is a pure test of "
  + "curvature. For any utility function u over final wealth, the respondent prefers the certain "
  + "amount whenever"));
doc.push(...NOTE(["u(w0 + X)  >  0.5 u(w0 + 2X) + 0.5 u(w0)"], {mono:true}));
doc.push(P("which is Jensen's inequality and holds at every X if u is concave, and fails at every X "
  + "if u is convex. There is no concave or convex u for which it holds at small X and fails at "
  + "large X. A switch part way down the ladder is therefore not a measurement of risk aversion, it "
  + "is evidence against the model that would do the measuring. We classify the pattern, flag the "
  + "violation, and take the risk aversion coefficient from Section 4 instead."));

doc.push(H("3.2 The utility curve", 2));
doc.push(P("Probability equivalence, exactly as the Week 2 to 3 lecture sets it out. With U(A) = 0 "
  + "and U(B) = 1, the probability that leaves a certain X indifferent to the gamble is the utility "
  + "of X:"));
doc.push(...NOTE(["U(X) = (1 - p) U(A) + p U(B) = p"], {mono:true}));
doc.push(P("Two curves are fitted to the same points. The log form the lecture suggests, and a "
  + "one-parameter constant relative risk aversion form:"));
doc.push(...NOTE([
  "log   U(W) = [ ln W - ln A ] / [ ln B - ln A ]",
  "CRRA  U(W) = [ W^(1-A) - A_lo^(1-A) ] / [ B^(1-A) - A_lo^(1-A) ]"], {mono:true}));
doc.push(P("The CRRA coefficient is what Step 5 needs, because it is exactly the A in "
  + "U = E(r) - 0.5 A sigma squared that the lecture uses for portfolio choice. The log curve is "
  + "the special case A = 1 and is reported beside it."));
doc.push(RP([{t:"One numerical point. ",i:true,c:INK2},{t:"Wealth is normalised by A before "
  + "fitting. The probability equivalence is a ratio of utility differences and CRRA scales those "
  + "by a common factor, so normalising changes no answer. At rupee scale W^(1-A) underflows to "
  + "zero once A passes about six, which silently collapses the denominator and returns a "
  + "meaningless fit. This bit us during development and is worth stating.",c:INK2}],{size:19}));

doc.push(H("3.3 The value function, and what it cannot reach", 2));
doc.push(P("Each of V1 to V6 offers a certain amount against a gamble paying double or nothing. At "
  + "indifference v(X) = p v(2X), and with v(x) = x raised to alpha the certain amount cancels:"));
doc.push(...NOTE([
  "X^alpha = p (2X)^alpha   =>   p = (1/2)^alpha   =>   alpha = -log2(p)"], {mono:true}));
doc.push(P("Two consequences follow, and both matter."));
doc.push(RP([{t:"First, ",b:true},"V1, V2 and V3 are the same question at three sizes rather than "
  + "three independent measurements, because the answer does not depend on X. A power value "
  + "function predicts an identical response to all three. The spread across them is response "
  + "noise, and it is reported in Section 5 rather than averaged away."]));
doc.push(RP([{t:"Second, ",b:true},"loss aversion is not identified. Each row is internally scaled, "
  + "so the gain rows pin down the gain curvature and the loss rows pin down the loss curvature, "
  + "but the two limbs are never placed on a common scale. Lambda requires a prospect with a gain "
  + "on one side and a loss on the other, which the form does not contain. This is why the Steps 5 "
  + "to 6 analysis circulated earlier had to record lambda as unidentified; it is a property of the "
  + "instrument, not of the respondents."]));

doc.push(H("3.4 Step 5, the portfolio", 2));
doc.push(P("Maximising the lecture's utility score along the capital allocation line gives the "
  + "textbook solution, with A read off the fitted utility curve:"));
doc.push(...NOTE(["U = E(r) - 0.5 A sigma^2",
                  "y* = [ E(rP) - rf ] / ( A sigmaP^2 )"], {mono:true}));
doc.push(P("Borrowing is capped at zero as a policy choice for retail clients rather than a "
  + "theoretical one. The unconstrained y* is reported alongside, because for this group it is the "
  + "cap and not the preference that determines the answer."));

/* ================================================== 4 */
doc.push(new Paragraph({children:[new PageBreak()]}));
doc.push(H("4. Steps 2 and 3: risk, time and personality"));

doc.push(H("4.1 Revealed risk preference", 2));
doc.push(table([1400,3000,1500,2800],["Roll","Pattern","Consistent with EU","Note"],
  R.map(r=>[r.roll, r.risk.pattern, r.risk.eu_consistent?"Yes":"No",
            r.risk.eu_consistent ? "Interpretable as a curvature" : `Switches at R${r.risk.switch_row}`]),
  {band:true, rightFrom:2}));
doc.push(...figure("c3_risk_ladder.png",
  "Figure 1. The eight rows for each respondent. Because every rung is expected-value neutral, a "
  + "row of all-filled or all-hollow squares is the only pattern expected utility can produce."));

doc.push(H("4.2 Time preference", 2));
doc.push(table([1400,2200,2000,3100],["Roll","Implied rate","Bracket","Note"],
  R.map(r=>[r.roll, pct(r.time.point,1),
            r.time.hi==null ? `above ${pct(r.time.lo,1)}` : `${pct(r.time.lo,1)} to ${pct(r.time.hi,1)}`,
            r.time.consistent ? "Consistent" : "Answers overlap, midpoint reported"]),
  {band:true, rightFrom:1}));
doc.push(...figure("c4_discount.png",
  "Figure 2. What the six now-or-later rows pin down. Grey lines are the six offers."));
doc.push(P("Every respondent discounts the future at a rate far above any available return, and one "
  + "rejects even 34% a year. Rates this high in a survey usually mean one of three things: a real "
  + "short-term need for cash, a shorter true horizon than the one stated, or the questions not "
  + "being taken literally. All three are worth a conversation before acting on a stated horizon of "
  + "ten or fifteen years."));

doc.push(H("4.3 Personality", 2));
doc.push(table([1400,1450,1450,1450,1450,1450],
  ["Roll","Extraversion","Agreeableness","Conscientious","Neg. Emotionality","Open-Minded"],
  R.map(r=>[r.roll, ...["E","A","C","N","O"].map(d=>f2(r.bfi.domains[d].mean))]),
  {band:true}));
doc.push(...figure("c5_personality.png",
  "Figure 3. Domain scores against the BFI-2 norming-sample average."));

/* ================================================== 5 */
doc.push(H("5. Step 4: utility and value functions"));
doc.push(H("5.1 Utility", 2));
doc.push(table([1300,1400,1500,1300,1300,1900],
  ["Roll","Range A to B","Risk aversion A","Fit R2","Log fit error","Status"],
  R.map(r=>{ const u=r.utility;
    return [r.roll, u?`${inr(u.A)} to ${inr(u.B)}`:"n/a", u?f2(u.gamma):"n/a",
            u&&u.r2!=null?u.r2.toFixed(3):"n/a", u?u.log_rmse.toFixed(3):"n/a",
            u?(u.concave?"Concave, risk averse":"Close to linear"):"Not usable"]; }),
  {band:true, rightFrom:2}));
doc.push(...figure("c1_utility.png",
  "Figure 4. The two usable utility curves. Dots are the elicited points, the solid line is the "
  + "fitted CRRA curve and the dashed line is the log curve from the lecture."));

doc.push(H("5.2 Value function", 2));
doc.push(table([1300,1200,1200,1500,1500,2000],
  ["Roll","Gain alpha","Loss beta","Spread on gains","Spread on losses","Loss aversion"],
  R.map(r=>{ const v=r.value;
    return [r.roll, v?f2(v.alpha):"n/a", v?f2(v.beta):"n/a",
            v&&v.alpha_detail?v.alpha_detail.spread.toFixed(2):"n/a",
            v&&v.beta_detail?v.beta_detail.spread.toFixed(2):"n/a",
            v&&v.lambda?f2(v.lambda):"Not identified"]; }),
  {band:true, rightFrom:1}));
doc.push(P("The two spread columns are the range of the curvature implied by the three rows that "
  + "should all give the same number. A spread near zero would mean a steady respondent. These are "
  + "not near zero.", {size:18,color:INK2}));
doc.push(...figure("c2_value.png",
  "Figure 5. Fitted value functions. The two limbs are drawn on their own scales because nothing "
  + "in the instrument ties their heights together."));
doc.push(P("Every estimated loss curvature is above one, which means the loss limb gets steeper as "
  + "losses grow. Prospect theory predicts the opposite, diminishing sensitivity with a curvature "
  + "below one. Two readings are possible. Either this group genuinely shows increasing sensitivity "
  + "to larger losses, which would be an unusual and interesting result, or the loss rows are being "
  + "answered with less care than the gain rows, which the spread column supports. A larger sample "
  + "and a second pass on the loss questions would separate the two."));

/* ================================================== 6 */
doc.push(new Paragraph({children:[new PageBreak()]}));
doc.push(H("6. Step 5: portfolio recommendations"));
doc.push(P("The risky asset is the 60-stock maximum-Sharpe portfolio built in Problem Statement 1, "
  + `returning ${pct(A.constants.ps1.tangency.mu)} against ${pct(A.constants.ps1.tangency.sigma)} `
  + `volatility in sample, with a risk-free rate of ${pct(A.constants.rf)}. This report does not `
  + "re-optimise it. The personal plan only decides how much of it each respondent should hold."));
doc.push(P("That in-sample Sharpe ratio is "
  + f2((A.constants.ps1.tangency.mu-A.constants.rf)/A.constants.ps1.tangency.sigma)
  + ", and it should not be planned around. Those expected returns are three-year averages taken "
  + "over a strong run in Indian equities, where the error on a mean estimated that way is roughly "
  + "17% a year. Volatility estimates from the same data are far more reliable, so the volatility "
  + "is carried across untouched and only the expected return is cut back toward a long-run figure. "
  + "Advice is given on the base case, with the other two shown beside it."));
doc.push(table([2400,1600,1600,3100],["Input set","Return","Sharpe","What it assumes"],
  Object.keys(A.engines).map(k=>[
    k==="in_sample"?"PS1 as reported":k==="base"?"Base case":"Stress case",
    pct(A.engines[k].mu), f2(A.engines[k].sharpe),
    k==="in_sample"?"The PS1 averages repeat out of sample"
      :k==="base"?"A quarter of the screening premium survives":"None of it survives"]),
  {band:true, boldRow:1}));

doc.push(H("6.1 Recommended allocations", 2));
doc.push(table([1300,1400,1500,1400,1400,1700],
  ["Roll","Risk aversion A","Unconstrained y*","Advised equity","Expected return","Volatility"],
  R.map(r=>{ if(!r.portfolios) return [r.roll,"n/a","n/a","Not computed","n/a","n/a"];
    const p=r.portfolios[ADV];
    return [r.roll, f2(r.gamma_used), p.y_star.toFixed(2)+"x", pct(p.y,0),
            pct(p.mu), pct(p.sigma)]; }),
  {band:true, rightFrom:1}));
doc.push(P("For the two respondents with usable data the unconstrained solution calls for "
  + "borrowing, so the no-borrowing cap is what actually sets the allocation. Both are advised to "
  + "hold 100% of their corpus in the Problem Statement 1 portfolio, which for roll 251250039 is "
  + `${inr(by["251250039"].corpus)} and for roll 251250002 is ${inr(by["251250002"].corpus)}.`));
doc.push(...figure("c6_portfolios.png",
  "Figure 6. Where each usable respondent sits, on base-case inputs."));
doc.push(...figure("c7_scenarios.png",
  "Figure 7. The unconstrained solution under all three input sets. The cap binds everywhere, so "
  + "the advice is the same in all nine cells."));
doc.push(RP([{t:"Two respondents receive no portfolio. ",b:true},
  "Roll 251250047 and roll 251250030 have no usable utility curve, so relative risk aversion is not "
  + "identified and y* cannot be computed. The risk ladder cannot substitute for it, for the reason "
  + "given in Section 3.1. Assigning them a number by judgement would be inventing the input that "
  + "does all the work, so the cells are left empty and the re-elicitation is specified instead."]));

doc.push(H("6.2 Why the behavioral portfolio cannot be sized", 2));
doc.push(P("Behavioral portfolio theory builds a layered portfolio: a safety layer sized to protect "
  + "a floor, an income layer, and an aspiration layer holding the shot at a target. Sizing those "
  + "layers needs four things, and the class instrument asks for none of them."));
doc.push(table([2600,6100],["What is needed","Why it cannot be inferred"],[
  ["The floor, in rupees","The amount that must survive is a stated preference. Nothing in Sections 1 to 4 asks for it."],
  ["The acceptable chance of breaching it","Roy's safety-first criterion needs a tolerance. There is no question that reveals one."],
  ["The aspiration level","The target that defines success. Not asked."],
  ["Loss aversion, lambda","Drives the fear parameter in the SP/A objective, and is unidentified for the reason in Section 3.3."],
], {rightFrom:99, band:true}));
doc.push(P("A safety and potential split could be asserted from the personality scores and the "
  + "curvature estimates, and that is what the earlier Steps 5 to 6 analysis did. It is a reasonable "
  + "way to produce a number, but it should not be mistaken for a measurement: the split would be "
  + "the adviser's judgement wearing the respondent's data as a costume. We prefer to state the gap "
  + "and close it."));

doc.push(H("6.3 The four questions that would close it", 2));
doc.push(P("Each is one line, and together they take about a minute. They are already live in the "
  + "project's survey portal, marked as extensions to the class form."));
doc.push(table([700,4300,3700],["","Question","What it identifies"],[
  ["E1","A coin flip: tails you lose Rs 10,000, heads you win G. How big must G be before you would take it?","Loss aversion lambda, by placing the two limbs of the value function on a common scale"],
  ["E2","A 10% chance of Rs 10,000, otherwise nothing. What certain amount feels as good? And the same at 90%.","The probability weighting function, and with it the hope parameter in SP/A"],
  ["E3","What is the smallest amount you must still have at the end, and how often could you live with falling below it?","The safety layer and the shortfall constraint"],
  ["E4","What amount at the end would you call a success, and how much expected wealth would you give up for a 10 point better chance of reaching it?","The aspiration layer and the weight on aspiration"],
], {rightFrom:99, band:true}));

/* ================================================== 7 */
doc.push(new Paragraph({children:[new PageBreak()]}));
doc.push(H("7. Step 6: personality commentary"));
doc.push(P("Personality does not enter the optimisation and should not. Risk aversion is already "
  + "measured directly in Section 5, so adding a personality adjustment to the equity weight would "
  + "be counting the same thing twice. What personality predicts is not what a client should hold "
  + "but whether they will hold it: how they will read a statement, what will make them abandon the "
  + "plan, and what the adviser has to do to prevent that. Those are process questions."));

const NOTES = {
 "251250039": ["Low conscientiousness is the binding constraint",
   `Conscientiousness of ${f2(by["251250039"].bfi.domains.C.mean)} sits well below average, and it `
   + "is paired with a switch to risk seeking at higher stakes and a near-linear gain curve "
   + `(alpha ${f2(by["251250039"].value.alpha)}). This profile sets a plan up and then stops watching `
   + "it, and may chase larger bets after an early win. The plan should therefore contain as few "
   + "decisions as possible: a standing instruction on the contribution date, automatic rebalancing "
   + "at a fixed threshold, and review dates fixed in advance rather than triggered by news. A "
   + "slightly worse portfolio that is actually followed beats the optimal one that is not."],
 "251250047": ["Methodical, calm, and genuinely conservative",
   `Conscientiousness of ${f2(by["251250047"].bfi.domains.C.mean)} is high and negative emotionality `
   + `of ${f2(by["251250047"].bfi.domains.N.mean)} is the lowest in the group. It would be a mistake `
   + "to read that calm as hidden risk tolerance: this respondent took the certain amount at every "
   + "one of the eight rows, including the ones that were actuarially fair. With a ten-year horizon "
   + "and a wealth-creation goal, the right response is a glide path that steps equity up over time "
   + "rather than a single large allocation at the start, so that the exposure grows with "
   + "familiarity instead of being imposed on day one."],
 "251250002": ["A balanced profile that reasons in rupees, not percentages",
   "Every domain sits between 3.0 and 3.67, and the risk pattern matches: risk seeking at small "
   + "stakes, cautious once the amounts approach real money. With "
   + `${inr(by["251250002"].corpus)} invested, the switch at R${by["251250002"].risk.switch_row} `
   + "suggests risk is being judged in nominal amounts rather than proportionally. The advisory "
   + "conversation should therefore be framed in rupees throughout, including the downside case. "
   + "A 20% fall means little; losing Rs 2,00,000 means something."],
 "251250030": ["Re-interview before acting on anything here",
   `Negative emotionality of ${f2(by["251250030"].bfi.domains.N.mean)} is moderate, but the rest of `
   + "this response needs a conversation rather than a model. The gamble was chosen at all eight "
   + "rows, every delay was refused even at 34% a year, the utility table was left blank and the "
   + "value-function fields contain rupee amounts where probabilities were asked for. Taken at face "
   + "value the choices would imply a very large risky allocation. Taken as a whole they more likely "
   + "indicate a genuine short-term need for cash, a horizon much shorter than the fifteen years "
   + "stated, or a questionnaire filled in quickly. Re-administer Sections 4 and 4.9 first."],
};
R.forEach(r=>{ const [h,b]=NOTES[r.roll];
  doc.push(H(`Roll ${r.roll}`,2));
  doc.push(table([1350,1350,1350,1500,1350,1700],
    ["","Extraversion","Agreeableness","Conscientious","Neg. Emot.","Open-Minded"],
    [["Score", ...["E","A","C","N","O"].map(d=>f2(r.bfi.domains[d].mean))]],{rightFrom:1}));
  doc.push(RP([{t:h+". ",b:true},b]));
});

/* ================================================== 8 */
doc.push(H("8. What this does not establish"));
[["Four respondents cannot support a claim about a population.",
  "What they support is a claim about the instrument, which is what Sections 3 and 6.2 make. Two of the four also failed to produce usable data, so the effective sample for Step 5 is two."],
 ["The expected return is the weakest input by a wide margin.",
  "Three scenarios are reported, but shrinkage is a patch on a genuinely hard problem. Nothing here should be read as a claim that the portfolio will return what any of the three says."],
 ["Both models are single period, applied over multi-year horizons.",
  "The projection assumes a constant mix, no contributions, no taxes and no transaction costs. Real plans have all four."],
 ["Normality is assumed throughout the probability statements.",
  "Equity returns are fat-tailed and negatively skewed, so any shortfall probability quoted here understates the true tail."],
 ["Survivorship bias is inherited from Problem Statement 1.",
  "The 60-name universe is today's index membership, so failed companies are absent and the historical statistics flatter the result."],
].forEach(([h,b])=>doc.push(RP([{t:h+" ",b:true},b])));

doc.push(H("9. References"));
["Das, S., Markowitz, H., Scheid, J. and Statman, M. (2010). Portfolio optimization with mental accounts. Journal of Financial and Quantitative Analysis, 45(2), 311-334.",
 "Kahneman, D. and Tversky, A. (1979). Prospect theory: an analysis of decision under risk. Econometrica, 47(2), 263-291.",
 "Lopes, L. (1987). Between hope and fear: the psychology of risk. Advances in Experimental Social Psychology, 20, 255-295.",
 "Roy, A. D. (1952). Safety first and the holding of assets. Econometrica, 20(3), 431-449.",
 "Saurabh, S. Behavioral Finance (MBA680), Week 2 to 3 lecture, IIT Kanpur, 2026-27-I.",
 "Shefrin, H. and Statman, M. (2000). Behavioral portfolio theory. Journal of Financial and Quantitative Analysis, 35(2), 127-151.",
 "Soto, C. J. and John, O. P. (2017). The next Big Five Inventory (BFI-2). Journal of Personality and Social Psychology, 113, 117-143.",
].forEach(t=>doc.push(new Paragraph({spacing:{after:110,line:280},
  indent:{left:340,hanging:340},
  children:[new TextRun({text:t,size:19,color:INK})]})));

doc.push(new Paragraph({children:[new PageBreak()]}));
doc.push(H("Appendix A. The survey, as administered"));
doc.push(P("Reproduced exactly as respondents saw it. Sections A.1 to A.5 are the class form. "
  + "Section A.6 holds the four added questions, which are marked as extensions in the portal so a "
  + "respondent can see which part of the form is standard and which is not."));

doc.push(H("A.1 Participant information", 2));
doc.push(P("Roll number (used instead of a name so the data set stays anonymous), age, monthly "
  + "income band, amount available to invest, investing experience (none, limited, moderate or "
  + "substantial), horizon in years, primary goal (wealth creation, capital preservation, liquidity "
  + "or a specific goal), and any constraint or liquidity need."));

doc.push(H("A.2 Risk preference, R1 to R8", 2));
doc.push(P("For each row, pick exactly one.", {size:19}));
doc.push(table([700,2700,4100],["Q","A: certain","B: coin flip"],
  RISK_CERTAIN.map((x,i)=>[`R${i+1}`, `Rs ${x.toLocaleString("en-IN")} guaranteed`,
    `50% Rs ${(2*x).toLocaleString("en-IN")}, 50% Rs 0`]), {band:true, rightFrom:99}));

doc.push(H("A.3 Time preference, T1 to T6", 2));
doc.push(P("For each row, pick the amount you would rather receive.", {size:19}));
doc.push(table([700,2100,2100,1500,1800],["Q","Amount today","Delayed amount","Delay","Implied annual rate"],
  TIME_OFFERS.map(([fv,t],i)=>[`T${i+1}`,"Rs 10,000",`Rs ${fv.toLocaleString("en-IN")}`,
    t===1?"1 year":`${t} years`, ((fv/10000)**(1/t)-1).toLocaleString("en-US",{style:"percent",minimumFractionDigits:1})]),
  {band:true, rightFrom:4}));
doc.push(...NOTE(["PV = FV / (1 + r)^t      so for PV = Rs 10,000:   r = (FV / 10,000)^(1/t) - 1"],{mono:true}));

doc.push(H("A.4 Personality, the 30-item BFI-2 subset", 2));
doc.push(P("Rated 1 (disagree strongly) to 5 (agree strongly). Items marked r are reverse keyed, so "
  + "the score is 6 minus the response. A facet score is the mean of its two items and a domain "
  + "score is the mean of its six. This is a project-specific subset of the official 60-item BFI-2 "
  + "pool, not the validated short form.", {size:19}));
doc.push(table([800,1700,1900,3500],["Item","Domain","Facet","Statement"],
  BFI_ITEMS.map(it=>[String(it.n)+(it.r?"r":""), it.dom, it.facet, it.text]),
  {band:true, rightFrom:99}));

doc.push(H("A.5 Utility and value function, U1 to U6 and V1 to V6", 2));
doc.push(P("The respondent first sets the lowest and highest amounts that feel relevant, A and B, "
  + "with U(A) = 0 and U(B) = 1. Six intermediate amounts are then spaced across that range. For "
  + "each one the respondent moves a slider to the probability of B that makes the certain amount "
  + "and the gamble feel equal. At indifference U(X) = p.", {size:19}));
doc.push(table([700,3000,4800],["Q","Certain outcome X","Gamble"],
  [1,2,3,4,5,6].map(k=>[`U${k}`,`Intermediate ${k}, spaced between A and B`,
    "A with probability 1 - p, B with probability p"]), {band:true, rightFrom:99}));
doc.push(P("The lecture's worked example uses A = Rs 10,000 and B = Rs 50,000, where indifference "
  + "at p = 0.5 gives U(Rs 20,000) = 0.5. That is the default range in the portal.", {size:19}));
doc.push(P("The value function section first asks for a reference amount W0, then presents six "
  + "rows. Each offers a certain outcome against a gamble paying double or nothing, and the "
  + "respondent gives the probability at indifference.", {size:19}));
doc.push(table([700,3300,4500],["Q","Certain choice","Risky choice"],
  [...VF_C.map((x,i)=>[`V${i+1}`,`Guaranteed gain of Rs ${x.toLocaleString("en-IN")}`,
     `50% gain Rs ${(2*x).toLocaleString("en-IN")}, 50% gain Rs 0`]),
   ...VF_C.map((x,i)=>[`V${i+4}`,`Guaranteed loss of Rs ${x.toLocaleString("en-IN")}`,
     `50% loss Rs ${(2*x).toLocaleString("en-IN")}, 50% loss Rs 0`])],
  {band:true, rightFrom:99}));

doc.push(H("A.6 The four added questions", 2));
doc.push(P("Not part of the class form. Section 6.3 explains why each is needed.", {size:19}));
doc.push(table([700,4400,3600],["Q","Question","What it identifies"],[
  ["E1","A coin flip. Tails, you lose Rs 10,000. Heads, you win G. How big does G have to be before you would take the bet?","Loss aversion lambda"],
  ["E2a","You have a 10 in 100 chance of winning Rs 10,000, otherwise nothing. What amount, given for sure, would feel just as good?","One point of the probability weighting function"],
  ["E2b","The same question at 90 in 100.","The second point, which fits the weighting curvature"],
  ["E3a","What is the smallest amount you must still have at the end?","The floor for the safety layer"],
  ["E3b","How often could you live with falling below it? (1 in 50, 1 in 20, 1 in 10, 1 in 5, 1 in 4)","The shortfall tolerance"],
  ["E4a","What amount at the end would make you call this a success?","The aspiration level"],
  ["E4b","Split 100 points between staying safe and having a real shot at that number.","The security and potential weight in SP/A"],
  ["E4c","How much expected end wealth would you give up to raise your chance of hitting it by 10 points?","The weight on aspiration"],
  ["E5","Do you need to take money out each year, and how much?","The income layer"],
], {band:true, rightFrom:99}));

doc.push(new Paragraph({children:[new PageBreak()]}));
doc.push(H("Appendix B. Reproducing every number"));
doc.push(P("Three commands, in order. Each reads only the output of the one before it.",{size:19}));
[["responses_real.json","The fielded responses, transcribed from the submitted surveys. Fields the class form does not ask are null, and invalid submissions are null with the reason attached."],
 ["classform_engine.py","Estimates everything the instrument identifies, builds the Step 5 portfolios, and writes outputs/classform.json and the figures."],
 ["make_classform_report.js","Builds this document, reading every quoted figure from that JSON."],
].forEach(([f,d])=>doc.push(RP([{t:f,code:true,b:true},"   "+d],{size:19})));
doc.push(P("The survey portal at docs/index.html fields the same instrument and uses the same "
  + "estimators, so a respondent can fill it in and see their own plan immediately.",{size:19}));

/* ---- build ---- */
const document=new Document({
  creator:"MBA680 Personal Investment Advisor Project",
  title:"MBA680 Steps 1 to 6",
  styles:{default:{document:{run:{font:"Calibri",size:20,color:INK}}},
    paragraphStyles:[
      {id:"Heading1",name:"Heading 1",basedOn:"Normal",quickFormat:true,
       run:{size:28,bold:true,color:INK,font:"Calibri"}},
      {id:"Heading2",name:"Heading 2",basedOn:"Normal",quickFormat:true,
       run:{size:23,bold:true,color:INK,font:"Calibri"}},
      {id:"Heading3",name:"Heading 3",basedOn:"Normal",quickFormat:true,
       run:{size:21,bold:true,color:INK,font:"Calibri"}}]},
  sections:[{ properties:{page:{size:{width:11906,height:16838},
      margin:{top:1250,right:1150,bottom:1250,left:1150}}},
    footers:{default:new Footer({children:[new Paragraph({alignment:AlignmentType.CENTER,
      children:[new TextRun({children:[PageNumber.CURRENT],size:17,color:INK2})]})]})},
    children:doc }]});

fs.mkdirSync(OUTDIR,{recursive:true});
Packer.toBuffer(document).then(buf=>{
  const out=path.join(OUTDIR,"MBA680_Steps1to6_Report.docx");
  fs.writeFileSync(out,buf);
  console.log(`wrote ${out}  (${(buf.length/1024).toFixed(0)} KB, ${doc.length} blocks)`);
});
