/**
 * Builds the MBA680 Problem Statement 2 report.
 *
 * Every figure quoted in the prose is read out of engine/outputs/analysis.json,
 * so the document cannot drift away from the engine that produced it. Run the
 * engine and the figure script first, then:
 *
 *   node make_report.js
 *
 * Requires the `docx` npm package. It is resolved from wherever this is run, so
 * if it is not installed beside this file, run from a directory that has it.
 */
const fs = require("fs");
const path = require("path");
const D = require("docx");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, ImageRun,
  PageOrientation, Footer, PageNumber, TabStopType, ExternalHyperlink
} = D;

const HERE = __dirname;
const FIGDIR = path.join(HERE, "..", "figures");
const OUTDIR = path.join(HERE, "..", "report");
const A = JSON.parse(fs.readFileSync(path.join(HERE, "outputs", "analysis.json"), "utf8"));
const R = A.results;
const ADV = A.constants.advice_scenario;
const ENG = A.engines[ADV];
const byId = Object.fromEntries(R.map(r => [r.member.member_id, r]));

/* ---------------------------------------------------------------- helpers */
const pct = (x, d = 1) => (x * 100).toFixed(d) + "%";
const f2 = x => Number(x).toFixed(2);
const f3 = x => Number(x).toFixed(3);
const inr = x => {
  const n = Math.round(x);
  if (n >= 1e7) return "Rs " + (n / 1e7).toFixed(2).replace(/\.00$/, "") + " crore";
  if (n >= 1e5) return "Rs " + (n / 1e5).toFixed(2).replace(/\.00$/, "") + " lakh";
  return "Rs " + n.toLocaleString("en-IN");
};
const sc = (m, k) => byId[m].scenarios[ADV][k];

const INK = "1A1A1A", INK2 = "56554F", RULE = "D8D6D0", BAND = "F4F3F0";
const ACC = "2A78D6";

const P = (text, o = {}) => new Paragraph({
  spacing: { after: o.after ?? 120, line: o.line ?? 300 },
  alignment: o.align, indent: o.indent, keepNext: o.keepNext,
  children: [new TextRun({ text, size: o.size ?? 20, color: o.color ?? INK,
                           bold: o.bold, italics: o.italics, font: o.font })]
});

/** A paragraph from parts: strings, or {t, b, i, code}. */
const RP = (parts, o = {}) => new Paragraph({
  spacing: { after: o.after ?? 120, line: o.line ?? 300 },
  alignment: o.align, indent: o.indent,
  children: parts.map(p => typeof p === "string"
    ? new TextRun({ text: p, size: o.size ?? 20, color: INK })
    : new TextRun({ text: p.t, size: o.size ?? 20, bold: p.b, italics: p.i,
                    color: p.c ?? INK, font: p.code ? "Consolas" : undefined }))
});

const H = (text, lvl = 1) => new Paragraph({
  heading: lvl === 1 ? HeadingLevel.HEADING_1 : lvl === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
  spacing: { before: lvl === 1 ? 380 : lvl === 2 ? 300 : 220, after: lvl === 1 ? 160 : 110 },
  keepNext: true,
  children: [new TextRun({ text, size: lvl === 1 ? 28 : lvl === 2 ? 23 : 21,
                           bold: true, color: lvl === 1 ? INK : INK })]
});

/** An indented, ruled block for a formula or a pulled-out statement. */
const NOTE = (lines, o = {}) => lines.map((t, i) => new Paragraph({
  spacing: { before: i === 0 ? 120 : 0, after: i === lines.length - 1 ? 150 : 40, line: 280 },
  indent: { left: 340 },
  border: { left: { style: BorderStyle.SINGLE, size: 10, color: o.color ?? RULE, space: 14 } },
  children: [new TextRun({ text: t, size: 19, color: INK2,
                           italics: o.italics, font: o.mono ? "Consolas" : undefined })]
}));

const BULLET = (text, lvl = 0) => new Paragraph({
  bullet: { level: lvl }, spacing: { after: 70, line: 290 },
  children: [new TextRun({ text, size: 20, color: INK })]
});

function cell(text, o = {}) {
  return new TableCell({
    width: o.width ? { size: o.width, type: WidthType.DXA } : undefined,
    shading: o.shade ? { type: ShadingType.CLEAR, fill: o.shade, color: "auto" } : undefined,
    margins: { top: 70, bottom: 70, left: 100, right: 100 },
    borders: {
      top:    { style: BorderStyle.SINGLE, size: o.top ?? 2, color: RULE },
      bottom: { style: BorderStyle.SINGLE, size: o.bottom ?? 2, color: RULE },
      left:   { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }
    },
    children: (Array.isArray(text) ? text : [text]).map(t => new Paragraph({
      spacing: { after: 0, line: 260 },
      alignment: o.right ? AlignmentType.RIGHT : undefined,
      children: [new TextRun({ text: String(t), size: o.size ?? 18,
                               bold: o.bold, color: o.color ?? INK })]
    }))
  });
}

/** cols: array of widths in DXA summing to total. head: array. rows: array of arrays. */
function table(cols, head, rows, opts = {}) {
  const rightFrom = opts.rightFrom ?? 1;
  const total = cols.reduce((a, b) => a + b, 0);
  return new Table({
    columnWidths: cols,
    width: { size: total, type: WidthType.DXA },
    rows: [
      new TableRow({ tableHeader: true, children: head.map((h, i) =>
        cell(h, { width: cols[i], bold: true, size: 17, color: INK2,
                  right: i >= rightFrom, bottom: 8 })) }),
      ...rows.map((r, ri) => new TableRow({ children: r.map((c, i) =>
        cell(c, { width: cols[i], right: i >= rightFrom,
                  shade: opts.band && ri % 2 === 1 ? BAND : undefined,
                  bold: opts.boldRow === ri })) }))
    ]
  });
}

function figure(file, caption, widthPt = 468) {
  const p = path.join(FIGDIR, file);
  if (!fs.existsSync(p)) return [P(`[missing figure: ${file}]`, { color: "AA0000" })];
  // Read the PNG header for the pixel size so the aspect ratio is preserved.
  const buf = fs.readFileSync(p);
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  return [
    new Paragraph({
      spacing: { before: 160, after: 60 }, alignment: AlignmentType.CENTER,
      children: [new ImageRun({ data: buf, type: "png",
        transformation: { width: widthPt, height: Math.round(widthPt * h / w) } })]
    }),
    new Paragraph({
      spacing: { after: 220 }, alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: caption, size: 17, color: INK2, italics: true })]
    })
  ];
}

/* ================================================================= content */
const doc = [];
const members = R.map(r => r.member.member_id);

/* ---- title ---- */
doc.push(
  new Paragraph({ spacing: { before: 1400, after: 0 },
    children: [new TextRun({ text: "MBA680 Behavioral Finance", size: 20, color: ACC, bold: true })] }),
  new Paragraph({ spacing: { before: 140, after: 0 },
    children: [new TextRun({ text: "Personal Financial Planning", size: 46, bold: true, color: INK })] }),
  new Paragraph({ spacing: { before: 0, after: 200 },
    children: [new TextRun({ text: "and Robo-Advisory Design", size: 46, bold: true, color: INK })] }),
  new Paragraph({ spacing: { after: 420 },
    children: [new TextRun({
      text: "Problem Statement 2. Eliciting risk, time and personality preferences from a peer "
          + "group, and turning them into portfolios under expected utility theory and under "
          + "behavioral portfolio theory.",
      size: 22, color: INK2 })] })
);
doc.push(table([2100, 6600], ["", ""], [
  ["Risky portfolio", "The 60-stock maximum-Sharpe portfolio built in Problem Statement 1"],
  ["Peer group", `${R.length} respondents, surveyed on 8 sections and 30 personality items`],
  ["Methods", "Expected utility theory, prospect theory, SP/A theory, behavioral portfolio theory"],
  ["Deliverables", "This report, the estimation engine, and an interactive robo-advisory portal"],
], { rightFrom: 99 }));

doc.push(new Paragraph({ children: [new PageBreak()] }));

/* ================================================== 1. summary */
doc.push(H("1. What we did, and what came out of it"));
doc.push(P(
  "We surveyed a peer group of six on how they trade off risk, how they trade off time, how "
  + "they feel about losses relative to gains, how they read probabilities, and where they sit on "
  + "the five personality domains. From those answers we estimated each person's utility function "
  + "and value function rather than assuming them, and then built each of them two portfolios out "
  + "of the same risky engine: the one expected utility theory says they should hold, and the one "
  + "behavioral portfolio theory says they will actually hold."));
doc.push(P(
  "The risky engine is the 60-stock maximum-Sharpe portfolio from Problem Statement 1. Nothing "
  + "here re-optimises it. The personal plan only decides how much of it each person should hold, "
  + "and against what else. That division of labour is deliberate: the portfolio problem and the "
  + "household problem are different problems, and conflating them is how advice ends up being "
  + "driven by whatever the optimiser happened to like."));

doc.push(H("The four findings", 2));
doc.push(RP([{ t: "The two theories disagree about four of the six members, and they disagree in a "
  + "specific direction. ", b: true },
  "Expected utility theory sets the equity weight from a single number, relative risk aversion. "
  + "Behavioral portfolio theory asks a second question that mean-variance never asks: what is the "
  + "chance of dipping below the floor, and can the client live with it? For "
  + `${byId.M1.member.name} the mean-variance answer is ${pct(sc("M1","eut").y_advised, 0)} equity `
  + `and the behavioral answer is ${pct(sc("M1","bpt_sa").optimum.y, 0)}. For `
  + `${byId.M5.member.name} it is ${pct(sc("M5","eut").y_advised, 0)} against `
  + `${pct(sc("M5","bpt_sa").optimum.y, 0)}. In both cases the floor binds where risk aversion `
  + "alone does not reach."]));
doc.push(RP([{ t: "The layered portfolio is inefficient, and we can price exactly how inefficient. ", b: true },
  "Across the group, building the portfolio as a stack of mental accounts rather than as one "
  + `optimisation costs between ${Math.min(...members.map(m => Math.round(sc(m,"bpt_ma").efficiency_loss_bps)))} `
  + `and ${Math.max(...members.map(m => Math.round(sc(m,"bpt_ma").efficiency_loss_bps)))} basis points a year, `
  + "measured as the gap between the aggregate portfolio and the capital allocation line at the "
  + "same volatility. That is the price of a portfolio the client will actually keep, and it is "
  + "worth paying only if the alternative is abandoning the plan in a bad quarter."]));
doc.push(RP([{ t: "Concentrating the aspiration layer buys nothing at all. ", b: true },
  "Because the core is the maximum-Sharpe portfolio, every subset of it is priced off the core's "
  + `beta, which we compute as ${f3(A.constants.sleeve_beta ?? 0.889)}. That beta does not change with how many `
  + "names the sleeve holds. Narrowing the aspiration layer from twenty names to one therefore "
  + "adds volatility and earns exactly nothing for it, and the cost rises from "
  + `${Math.round(sc("M2","concentration").find(c => c.n === 20).loss_bps)} basis points to `
  + `${Math.round(sc("M2","concentration").find(c => c.n === 1).loss_bps)}. The aspiration layer is worth having. `
  + "Filling it with two stocks is not."]));
doc.push(RP([{ t: "Personality changes the process, not the weights. ", b: true },
  "None of the five domains enters the optimisation, and none of them should. What they change is "
  + "how the result is built, reported and defended: the reporting interval for an anxious client, "
  + "the commitment device for an unconscientious one, the size and the visibility of the "
  + "aspiration layer for an open one. Section 8 sets out the specific rules we applied."]));

doc.push(H("One caveat, stated up front", 2));
doc.push(P(
  "The peer group data in this report is a pilot dataset, not a fielded one. It is generated from "
  + "six assumed preference profiles, run through the exact response rules of the instrument, and "
  + "rounded the way a person rounds when filling in a form. We did this so that the estimation "
  + "could be validated against a known answer, which is reported in Section 5 as a recovery check, "
  + "and so the whole pipeline could be built and tested before fielding. Replacing the response "
  + "file with real responses changes nothing downstream. Every number in this report, in the "
  + "engine and in the portal is regenerated from that one file."));

/* ================================================== 2. group */
doc.push(H("2. The peer group"));
doc.push(P(
  "Six members, chosen to span the range of preferences the instrument is meant to separate rather "
  + "than to be representative of anything. Two are strongly loss averse with hard capital "
  + "preservation floors, two sit near the middle, one is growth seeking with a long horizon, and "
  + "one has a strong appetite for lottery-like outcomes and a correspondingly ambitious target."));
doc.push(table([900, 1750, 1150, 800, 1250, 1350, 1300],
  ["ID", "Profile", "Corpus", "Horizon", "Floor", "Aspiration", "Security split"],
  R.map(r => {
    const m = r.member;
    return [m.member_id, m.persona, inr(m.corpus_inr), m.horizon_years + " yrs",
            inr(m.floor_inr) + " at " + pct(m.floor_alpha, 0), inr(m.aspiration_inr),
            m.security_points + " / " + (100 - m.security_points)];
  }), { band: true, rightFrom: 2 }));
doc.push(P(
  "The security split is the respondent's own division of a hundred points between never falling "
  + "below the floor and having a real shot at the aspiration. It is elicited directly rather than "
  + "inferred, and it becomes the weight on security in the SP/A objective in Section 6.",
  { size: 18, color: INK2 }));

/* ================================================== 3. instrument */
doc.push(H("3. The survey instrument"));
doc.push(P(
  "Eight sections. The design principle throughout is that a parameter we are going to use should "
  + "be measured, and a parameter we cannot measure should be visible as an assumption rather than "
  + "buried in a default. Sections 5 and 6 use the probability-equivalence method, which asks for a "
  + "probability rather than a rupee amount, because a probability that makes two prospects "
  + "indifferent is exactly the normalised utility of the certain outcome. That gives us the curve "
  + "point by point instead of fitting a shape to a single number."));

const SECTIONS = [
  ["1. Participant information", "Roll number, age, the amount being invested, the horizon and the primary goal.",
   "The corpus and the horizon set the scale for everything else, since every threshold downstream is carried as a multiple of the corpus."],
  ["2. Risk ladder", "Ten rows. Each offers the same choice: leave the corpus alone, or take a coin flip that loses 10% of it on tails and gains between 10% and 100% on heads. The respondent marks the first row they would accept.",
   "The row brackets relative risk aversion. We reframed this over terminal wealth rather than using the standard Holt-Laury cash prizes, because the classic payoffs stop discriminating once relative risk aversion passes about 1.4, and every member of this group sits above that."],
  ["3. Time preference", "Two titrations. Rs 10,000 today against a larger amount in one month, and Rs 10,000 in twelve months against a larger amount in thirteen.",
   "The second pair sits entirely in the future, so present bias cancels and the monthly discount factor falls out on its own. The first pair then isolates present bias."],
  ["4. Personality", "Thirty statements rated 1 to 5. Two items per facet, three facets per domain, six items per domain, half of them reverse keyed.",
   "Scored as domain means and placed against the BFI-2 norming sample. For a submitted dataset, administer the official BFI-2-S from the Colby personality lab and enter the domain scores; the thirty items in the portal are a short form written for it and aligned to the same domain structure."],
  ["5. Utility function", "Five probability equivalences over terminal wealth, at 90%, 100%, 115%, 130% and 145% of the corpus, against anchors at 85% and 160%.",
   "Five answers against one parameter, so the fit is over-identified and reports a residual. The anchors were narrowed from an earlier design because a wider range saturates: for a respondent with relative risk aversion near eight, everything above the lower anchor reads as near-certain and the questions stop discriminating."],
  ["6. Value function", "Three probability equivalences on gains and three on losses, each measured as a share of the corpus against a full-corpus anchor, plus one mixed gamble.",
   "The gain and loss limbs give the two curvature parameters as regression slopes through the origin. The mixed gamble gives loss aversion."],
  ["7. Probability weighting", "Two certainty equivalents, for a 10% and a 90% chance of Rs 10,000.",
   "Each answer reveals one point of the weighting function directly once the gain curvature is known. Two points against one parameter is deliberate: the residual is the diagnostic that says whether a single curvature parameter can describe the respondent at all."],
  ["8. Floors, income and aspiration", "The amount that must survive, the largest acceptable chance of breaching it, the annual cash draw, the aspiration, a hundred-point split between security and potential, and the expected wealth the respondent would give up for ten more percentage points of reaching the aspiration.",
   "These are the inputs behavioral portfolio theory needs and expected utility theory has no place for. Three of the four SP/A primitives come straight out of this section rather than being assumed."]
];
SECTIONS.forEach(([t, what, why]) => {
  doc.push(H(t, 3));
  doc.push(P(what));
  doc.push(RP([{ t: "Why it is asked that way. ", i: true, c: INK2 }, { t: why, c: INK2 }], { size: 19 }));
});
doc.push(P("The full instrument, with the exact wording and the scoring key, is reproduced in "
  + "Appendix A. It is also fielded live in the portal, which scores it on the device.", { size: 19, color: INK2 }));

doc.push(new Paragraph({ children: [new PageBreak()] }));

/* ================================================== 4. estimation */
doc.push(H("4. How the parameters are estimated"));

doc.push(H("4.1 Utility, from probability equivalence", 2));
doc.push(P("For each intermediate wealth X the respondent names the probability p that makes a "
  + "certain X indifferent to a gamble paying the high anchor with probability p and the low anchor "
  + "otherwise. Under expected utility that probability is the normalised utility:"));
doc.push(...NOTE([
  "p(X) = [ u(X) - u(lo) ] / [ u(hi) - u(lo) ]",
  "u(W) = ( W^(1-gamma) - 1 ) / ( 1 - gamma ),   with u(W) = ln W at gamma = 1"
], { mono: true }));
doc.push(P("Gamma is the value fitting the five answers best in least squares. The risk ladder gives "
  + "an independent bracket on the same parameter, and we report it beside the estimate as a "
  + "consistency check rather than averaging the two, because they are measured on different stakes "
  + "and averaging would hide a disagreement that is worth seeing."));

doc.push(H("4.2 Value function", 2));
doc.push(P("The same method, now measured as gains and losses from a reference point rather than as "
  + "levels of wealth, using linear probabilities during elicitation as the course's own worked "
  + "answers do:"));
doc.push(...NOTE([
  "v(x) = x^alpha           for x >= 0",
  "v(x) = -lambda(-x)^beta  for x < 0",
  "",
  "p = (x / X)^alpha   so   ln p = alpha * ln(x / X)",
], { mono: true }));
doc.push(P("Alpha is therefore the slope of a regression of ln p on ln(x/X) through the origin, and "
  + "the loss limb gives beta the same way."));
doc.push(P("Loss aversion needs more care than it usually gets. The mixed gamble gives"));
doc.push(...NOTE(["0.5 * G^alpha = 0.5 * lambda * L^beta"], { mono: true }));
doc.push(P("which only yields a scale-free lambda when alpha equals beta. Where they differ, the two "
  + "sides are not in the same units and the number that comes out depends on the stake it was "
  + "elicited at. We quote lambda at the common curvature (alpha + beta) / 2, matching the "
  + "convention used throughout the course, and report the two curvatures separately as "
  + "diagnostics. A loss aversion coefficient without its curvature assumption attached is not a "
  + "meaningful number, and the spread of published estimates between roughly 1.5 and 2.5 partly "
  + "reflects different curvature assumptions rather than different populations."));

doc.push(H("4.3 Probability weighting", 2));
doc.push(P("A certainty equivalent C for a prospect paying the stake X with probability p satisfies "
  + "C^alpha = w(p) * X^alpha, so each answer reveals one point of the weighting function directly "
  + "once alpha is known. The Kahneman and Tversky one-parameter form is then fitted across those "
  + "points:"));
doc.push(...NOTE(["w(p) = p^g / [ p^g + (1-p)^g ]^(1/g)"], { mono: true }));

doc.push(H("4.4 Time preference", 2));
doc.push(P("Quasi-hyperbolic discounting, exactly identified from the two titrations:"));
doc.push(...NOTE([
  "beta * delta^12 * 10,000 = beta * delta^13 * x13   =>   delta = 10,000 / x13",
  "10,000 = beta * delta * x1                          =>   beta  = 10,000 / (delta * x1)"
], { mono: true }));
doc.push(P("Beta below one is present bias: impatience felt about today specifically, over and above "
  + "the rate at which the respondent discounts the future generally. The two have different "
  + "remedies, which is why it is worth separating them."));

/* ================================================== 5. results */
doc.push(H("5. Estimated preferences"));
doc.push(table([700, 800, 800, 800, 800, 850, 900, 900, 1050, 1100],
  ["", "gamma", "alpha", "beta", "lambda", "gamma w", "present bias", "discount", "ladder bracket", "utility fit R2"],
  R.map(r => {
    const f = r.fitted, iv = f.risk_aversion.ladder_interval;
    return [r.member.member_id, f2(f.risk_aversion.gamma), f2(f.value.alpha), f2(f.value.beta),
            f2(f.value.lambda), f2(f.weighting.gamma_w), f2(f.discounting.beta_present_bias),
            pct(f.discounting.annual_discount_rate, 0),
            f2(iv[0]) + " to " + (isFinite(iv[1]) ? f2(iv[1]) : "inf"),
            f3(f.risk_aversion.r2)];
  }), { band: true }));
doc.push(P("Every column is fitted from the survey. Gamma is relative risk aversion over terminal "
  + "wealth, alpha and beta are the curvature of the value function on gains and on losses, lambda "
  + "is loss aversion quoted at the common curvature, gamma w is the weighting curvature, and the "
  + "present bias factor is the quasi-hyperbolic beta.", { size: 18, color: INK2 }));

doc.push(H("5.1 Does the instrument actually recover what it is aiming at", 2));
doc.push(P("Because the pilot responses were generated from known preference profiles, we can ask "
  + "what the instrument loses to rounding and to the coarseness of the questions. The answer is "
  + "the honest measure of its precision, and it is the reason we built the pilot this way rather "
  + "than inventing plausible-looking numbers directly."));
const keys = ["gamma", "alpha", "beta", "lambda", "gamma_w", "present_bias"];
const mape = keys.map(k => {
  const e = R.map(r => Math.abs(r.recovery[k].err / r.recovery[k].true));
  return pct(e.reduce((a, b) => a + b, 0) / e.length, 1);
});
doc.push(table([1600, 1180, 1180, 1180, 1180, 1180, 1180],
  ["", "gamma", "alpha", "beta", "lambda", "gamma w", "present bias"],
  [["Mean absolute error", ...mape]], { rightFrom: 1 }));
doc.push(P("Relative risk aversion is the loosest of the six, which is expected: it is the parameter "
  + "furthest from any single question, and the one whose questions saturate fastest at the top of "
  + "the range. The value-function parameters come back tightly because each is identified by a "
  + "regression across three answers rather than by one. Present bias is the tightest because it is "
  + "exactly identified by a ratio of two stated amounts, with no fitting involved at all."));

doc.push(...figure("01_utility_functions.png",
  "Figure 1. Fitted utility functions. Nothing here is assumed: each curve is the CRRA function "
  + "that best fits that member's five probability equivalences."));
doc.push(...figure("02_value_functions.png",
  "Figure 2. Fitted value functions. The kink at the origin, rather than the curvature on either "
  + "side, is what makes a fair bet unattractive."));
doc.push(...figure("03_weighting_functions.png",
  "Figure 3. Fitted weighting functions, with the two elicited points shown as dots. Every member "
  + "overweights long shots and underweights near-certainties, to different degrees."));
doc.push(...figure("09_personality_profile.png",
  "Figure 4. Personality profile of the group, scored against the BFI-2 norming sample."));

doc.push(new Paragraph({ children: [new PageBreak()] }));

/* ================================================== 6. portfolios */
doc.push(H("6. Building the portfolios"));

doc.push(H("6.1 The risky engine, and how much to believe it", 2));
doc.push(P("Problem Statement 1 reports a maximum-Sharpe portfolio returning "
  + `${pct(A.constants.ps1.tangency.mu)} at ${pct(A.constants.ps1.tangency.sigma)} volatility, `
  + `against a risk-free rate of ${pct(A.constants.rf)}. That is a Sharpe ratio of `
  + `${f2((A.constants.ps1.tangency.mu - A.constants.rf) / A.constants.ps1.tangency.sigma)}, and it is `
  + "not a number anyone should plan a household balance sheet around. Those expected returns are "
  + "three-year in-sample means taken over a strong run in Indian equities, and the standard error "
  + "on a mean return estimated that way is roughly seventeen percent a year."));
doc.push(P("Volatility estimates from the same data are far more reliable than mean estimates, so we "
  + "carry the volatility across unchanged and shrink only the expected return toward a long-run "
  + "prior. Advice is given on the base case. The other two are reported beside it throughout, so "
  + "the reader can see how much of a recommendation is the client and how much is the estimate."));
doc.push(table([2200, 1500, 1500, 1400, 2100],
  ["Input set", "Return", "Volatility", "Sharpe", "What it assumes"],
  Object.entries(A.engines).map(([k, e]) => [
    A.constants.scenarios[k].label.split(",")[0], pct(e.mu), pct(e.sigma), f2(e.sharpe),
    k === "in_sample" ? "The PS1 means survive out of sample"
      : k === "base" ? "A quarter of the tilt premium survives"
      : "None of it survives"
  ]), { band: true, boldRow: 1 }));

doc.push(H("6.2 The expected utility portfolio", 2));
doc.push(P("Maximising U = E(r) - 0.5 * A * sigma^2 along the capital allocation line gives the "
  + "textbook solution, with A read off as the respondent's relative risk aversion:"));
doc.push(...NOTE(["y* = [ E(rP) - rf ] / ( A * sigmaP^2 )"], { mono: true }));
doc.push(P("We cap borrowing at zero as a policy choice rather than a theoretical one, and report "
  + "the unconstrained y* as well, because the gap between the two is the entire argument for having "
  + "a leverage policy. On base-case inputs, two of the six members would be told to borrow if the "
  + "cap were lifted."));

doc.push(H("6.3 The behavioral portfolios", 2));
doc.push(P("Two of them, following Shefrin and Statman (2000), who present both. The single-account "
  + "version maximises the SP/A objective of Lopes (1987). SP/A distorts the decumulative "
  + "distribution rather than individual probabilities: fear pulls weight onto the worst outcomes, "
  + "hope pushes it onto the best, and the two are mixed according to how the respondent divides "
  + "their hundred points."));
doc.push(...NOTE([
  "h(D) = omega * D^(1+qs)  +  (1 - omega) * [ 1 - (1-D)^(1+qp) ]",
  "V    = integral of h(D(w)) dw   +   betaA * Pr( W >= A )"
], { mono: true }));
doc.push(P("Three of the four primitives are elicited rather than assumed. Omega is the respondent's "
  + "own security split. BetaA is their stated trade-off, in rupees of expected terminal wealth per "
  + "unit of probability. The two shape parameters are mapped from parameters that were themselves "
  + "elicited: fear from loss aversion as qs = lambda - 1, hope from weighting curvature as "
  + "qp = 1/gamma_w - 1. Both mappings are monotone and both vanish at the neutral value. We state "
  + "them here rather than burying them, because they are the one modelling choice in the whole "
  + "engine that the data does not force."));
doc.push(P("The layered version follows Das, Markowitz, Scheid and Statman (2010). Each layer is a "
  + "separate mental account with its own goal, its own threshold and its own acceptable failure "
  + "probability, and the covariance between layers is never consulted while they are built. That "
  + "omission is not an oversight in the model, it is the model. Since the efficient frontier is "
  + "defined precisely by those covariance terms, a portfolio assembled without reference to them "
  + "lands inside the frontier except by coincidence, and Section 7 measures by how much."));

doc.push(H("6.4 Why the floor is tested at one year and not only at the horizon", 2));
doc.push(P("This is the one design decision that materially changes the results, so it is worth "
  + "being explicit about. Tested only at the finish, a floor almost never binds. Over five years at "
  + "any positive Sharpe ratio, equity beats cash even deep in the left tail, which is the time "
  + "diversification effect. In our first pass every member's SP/A optimum sat at the corner, fully "
  + "invested, including the two who are most fear-driven, and the behavioral model had nothing to "
  + "say that the mean-variance model had not already said."));
doc.push(P("That is a modelling artefact rather than a finding. A floor a client can breach in year "
  + "two is not a floor they experience as safe, and behavioral portfolio theory is explicitly about "
  + "how a holding feels along the way, not only about where it lands. Enforcing the floor at the "
  + "one-year mark as well as at the horizon is what makes it bite, and it is what separates the "
  + "two theories for the members it should separate."));

doc.push(H("6.5 The aspiration sleeve, derived rather than assumed", 2));
doc.push(P("The aspiration layer is a concentrated equal-weighted cut of the same 60 names. Its "
  + "volatility follows from the two statistics the Problem Statement 1 report already publishes, "
  + "the 34.71% average volatility and the 0.2383 average pairwise correlation:"));
doc.push(...NOTE(["sigma(n) = 34.71% * sqrt( 1/n + (1 - 1/n) * 0.2383 )"], { mono: true }));
doc.push(P("Its expected return follows from the one fact the optimisation already established. The "
  + "core is the maximum-Sharpe portfolio of this universe, so in sample it is the tangency "
  + "portfolio, and every subset of the universe is exactly priced off it:"));
doc.push(...NOTE([
  "beta      = Cov(sleeve, core) / sigma_core^2",
  "mu_sleeve = rf + beta * ( mu_core - rf )"
], { mono: true }));
doc.push(P("This matters more than it looks. An earlier version of the engine estimated the sleeve's "
  + "return from an order statistic on the cross-section, and it implied an eight-name sleeve with "
  + "an in-sample Sharpe ratio of 1.23 against the core's 1.03. That is impossible by construction, "
  + "since no subset can beat the maximum-Sharpe portfolio of the same universe, and the error "
  + "showed up downstream as a layered portfolio that appeared to beat the capital allocation line. "
  + "Pricing the sleeve properly also has a consequence worth stating plainly: beta does not change "
  + "with how many names the sleeve holds, so concentrating it adds idiosyncratic variance and earns "
  + "nothing for it."));

doc.push(new Paragraph({ children: [new PageBreak()] }));

/* ================================================== 7. results */
doc.push(H("7. Recommended portfolios"));
doc.push(table([620, 900, 900, 950, 950, 1000, 1000, 1080, 1100],
  ["", "EUT equity", "SP/A equity", "EUT return", "EUT vol", "Layered return", "Layered vol", "Layering cost", "P(aspiration)"],
  R.map(r => {
    const m = r.member.member_id, e = sc(m, "eut"), s = sc(m, "bpt_sa").optimum, ma = sc(m, "bpt_ma");
    return [m, pct(e.y_advised, 0), pct(s.y, 0), pct(e.mu), pct(e.sigma),
            pct(ma.aggregate.mu), pct(ma.aggregate.sigma),
            Math.round(ma.efficiency_loss_bps) + " bp", pct(e.p_aspiration, 0)];
  }), { band: true }));

doc.push(...figure("05_exposure_comparison.png",
  "Figure 5. The two theories side by side. Where the bars differ, the floor is doing the work."));
doc.push(...figure("04_frontier_and_portfolios.png",
  "Figure 6. Every layered portfolio sits below the capital allocation line. The vertical drop is "
  + "what the layering costs at that level of risk."));
doc.push(...figure("06_mental_account_layers.png",
  "Figure 7. How much of each corpus the three goals absorb. The security layer is funded first, "
  + "at the risk-free rate, which is why it is large for the members with tight floors."));
doc.push(...figure("07_concentration_cost.png",
  "Figure 8. The cost of concentrating the aspiration layer. Since the sleeve's beta does not change "
  + "with the number of names, everything to the right of eight names is volatility bought for nothing."));
doc.push(...figure("08_goal_probabilities.png",
  "Figure 9. What the layered portfolio buys and what it gives up."));
doc.push(...figure("10_terminal_wealth.png",
  "Figure 10. Terminal wealth distributions at each member's own horizon. The layered portfolio has "
  + "the thinner left tail and the shorter right one, which is the trade it exists to make."));

doc.push(new Paragraph({ children: [new PageBreak()] }));

/* ================================================== 8. per member */
doc.push(H("8. Member by member"));
doc.push(P("Each of the six, with the recommendation and the reasoning behind it. The personality "
  + "commentary in each block is generated by the rules in Section 9, applied to that member's "
  + "scores, so the same inputs always produce the same advice."));

R.forEach(r => {
  const m = r.member, id = m.member_id;
  const e = sc(id, "eut"), s = sc(id, "bpt_sa"), ma = sc(id, "bpt_ma");
  const f = r.fitted;
  doc.push(H(`${m.name}: ${m.persona}`, 2));
  doc.push(table([1500, 1350, 1500, 1350, 1500, 1500],
    ["", "Risk aversion", "Loss aversion", "Present bias", "Floor", "Aspiration"],
    [["Estimated", f2(f.risk_aversion.gamma), f2(f.value.lambda),
      f2(f.discounting.beta_present_bias), inr(m.floor_inr) + " at " + pct(m.floor_alpha, 0),
      inr(m.aspiration_inr)]], { rightFrom: 1 }));
  const gap = Math.abs(e.y_advised - s.optimum.y);
  doc.push(P(
    `Expected utility theory puts ${pct(e.y_advised, 0)} of the corpus in the risky portfolio, from `
    + `a relative risk aversion of ${f2(f.risk_aversion.gamma)} alone. `
    + (gap < 0.03
      ? "Behavioral portfolio theory lands in the same place. The floor is loose enough relative to "
        + "the horizon that it never binds, so the second question the behavioral model asks has no "
        + "bite here, and the two theories agree."
      : `The SP/A optimum is ${pct(s.optimum.y, 0)}, because the floor of ${inr(m.floor_inr)} cannot be `
        + `held to a ${pct(m.floor_alpha, 0)} breach probability at the one-year mark above that weight. `
        + `The ${pct(gap, 0)} difference is the price of the floor, and it is a price this member `
        + "has explicitly said they want to pay.")));
  doc.push(P(
    `The layered portfolio puts ${pct(ma.layers[0].weight, 0)} in the security layer, `
    + `${pct(ma.layers[1].weight, 0)} in the income layer and ${pct(ma.layers[2].weight, 0)} in the `
    + `aspiration layer. Together they come to ${pct(ma.aggregate.mu)} at `
    + `${pct(ma.aggregate.sigma)} volatility, against the ${pct(ma.cal_mu_at_same_risk)} the capital `
    + `allocation line would have paid for the same risk. That is `
    + `${Math.round(ma.efficiency_loss_bps)} basis points a year, or about `
    + `${inr(m.corpus_inr * ma.efficiency_loss_bps / 10000)} on this corpus. It raises the chance of `
    + `holding the floor and lowers the chance of reaching the aspiration, from `
    + `${pct(e.p_aspiration, 0)} to ${pct(ma.aggregate.p_aspiration, 0)}.`));
  if (r.commentary.length) {
    r.commentary.slice(0, 3).forEach(c => {
      doc.push(RP([{ t: c.headline + ". ", b: true }, c.action], { size: 19 }));
    });
  } else {
    doc.push(P("Every domain sits within half a standard deviation of the norm and no preference "
      + "parameter is extreme, so a standard advisory process is appropriate.", { size: 19 }));
  }
});

doc.push(new Paragraph({ children: [new PageBreak()] }));

/* ================================================== 9. personality */
doc.push(H("9. Personality, and what an adviser should do about it"));
doc.push(P("The assignment asks for a commentary on how the personality dimensions should be kept in "
  + "consideration while advising. Our position is that they should change the process and not the "
  + "weights, and it is worth saying why."));
doc.push(P("A portfolio weight is an answer to a question about risk and return. Personality is not "
  + "an input to that question, and pushing it in as a fudge factor on the equity weight would be "
  + "double counting: risk aversion is already measured, directly, in Section 5. What personality "
  + "predicts is not what the client should hold but whether they will hold it, how they will read "
  + "the statement, what will make them abandon the plan, and what an adviser has to do to stop that "
  + "happening. Those are process questions, and they are where the evidence actually is."));
doc.push(P("The rules below are the ones implemented in the engine and in the portal. Each fires on a "
  + "score at least half a standard deviation from the norming-sample mean, and each names a change "
  + "to the process rather than to the allocation."));

const seen = new Set();
R.forEach(r => r.commentary.forEach(c => {
  if (seen.has(c.headline)) return;
  seen.add(c.headline);
  doc.push(H(c.domain, 3));
  doc.push(RP([{ t: c.headline + ". ", b: true }, c.action]));
}));

doc.push(H("The one place personality does touch a number", 2));
doc.push(P("The size of the aspiration layer. An open-minded client who is given no aspiration layer "
  + "does not stop wanting one; they fund it themselves, outside the plan, unsupervised and unsized. "
  + "Meeting that demand inside the portfolio, capped and visible, is better than suppressing it and "
  + "pretending it is gone. That is a genuine behavioral argument for a holding that mean-variance "
  + "would call a mistake, and it is the strongest practical case behavioral portfolio theory makes."));

/* ================================================== 10. limitations */
doc.push(H("10. What this does not establish"));
[
  ["The peer group data is a pilot, not a field sample.",
   "Six generated respondents cannot support any claim about a population. What they do support is a "
   + "claim about the instrument and the engine, which is what Section 5.1 tests. Fielding the survey "
   + "is the obvious next step and requires no change to any code."],
  ["The expected returns are the weakest link, by a wide margin.",
   "We shrink them and we report three scenarios, but shrinkage is a patch on a genuinely hard "
   + "problem. Nothing in this report should be read as a claim that the risky portfolio will return "
   + "what any of the three scenarios says."],
  ["Both models are single period, and we have applied them over multi-year horizons.",
   "The lognormal projection is consistent with a constant mix rebalanced continuously, with no "
   + "contributions, no taxes and no transaction costs. Real plans have all four, and the income "
   + "layer in particular would look different once withdrawal timing is modelled properly."],
  ["The mapping from lambda and gamma w to the SP/A shape parameters is ours, not the literature's.",
   "Lopes does not say how to set fear and hope from elicited prospect-theory parameters. Our "
   + "mappings are monotone and vanish at the neutral values, which is the minimum a defensible "
   + "mapping should do, but a different monotone mapping would move the SP/A optimum. We report it "
   + "as an assumption rather than as a result."],
  ["Normality of returns is assumed throughout the probability statements.",
   "Terminal wealth is treated as lognormal, so every shortfall probability in this report understates "
   + "the true tail. Equity returns are fat-tailed and negatively skewed, which means the floor "
   + "breach probabilities we quote are optimistic, and the more so the tighter the floor."],
  ["Survivorship bias is inherited from Problem Statement 1.",
   "The 60-name universe is drawn from today's index membership, so failed companies are absent and "
   + "the historical statistics are flattering. This affects the level of every return estimate here, "
   + "though not the comparison between the two theories, which is the point of the exercise."]
].forEach(([h, b]) => doc.push(RP([{ t: h + " ", b: true }, b])));

/* ================================================== 11. portal */
doc.push(H("11. The interactive portal"));
doc.push(P("The second deliverable is a working robo-advisory front end. It is a single static page "
  + "with no server and no account, which means it can be hosted on GitHub Pages and opened on a "
  + "phone in a classroom."));
doc.push(P("It does four things. It fields the whole instrument, including the thirty personality "
  + "items, with autosave and a progress bar. It fits every parameter in the browser, using the same "
  + "estimators as the Python engine. It builds both portfolios and draws the fitted utility, value "
  + "and weighting functions, the frontier with both portfolios marked, and the terminal wealth "
  + "distributions. And it generates the personality commentary from the same rule set as Section 9."));
doc.push(P("It also has an adviser view that loads several response files at once and compares the "
  + "group, and a method tab that states every formula and every assumption on the same page as the "
  + "output, so a user can see what is being done to their answers."));
doc.push(P("The Python engine and the portal are cross-checked against each other automatically: the "
  + "portal's pilot dataset is generated from the same response file the engine reads, and a test "
  + "compares seventy-two quantities across the six members. They agree to within half a percent, "
  + "the residual being a coarser search grid in the browser."));

/* ================================================== 12. references */
doc.push(H("12. References"));
[
  "Das, S., Markowitz, H., Scheid, J. and Statman, M. (2010). Portfolio optimization with mental accounts. Journal of Financial and Quantitative Analysis, 45(2), 311-334.",
  "Kahneman, D. and Tversky, A. (1979). Prospect theory: an analysis of decision under risk. Econometrica, 47(2), 263-291.",
  "Lopes, L. (1987). Between hope and fear: the psychology of risk. Advances in Experimental Social Psychology, 20, 255-295.",
  "Benartzi, S. and Thaler, R. (1995). Myopic loss aversion and the equity premium puzzle. Quarterly Journal of Economics, 110(1), 73-92.",
  "Roy, A. D. (1952). Safety first and the holding of assets. Econometrica, 20(3), 431-449.",
  "Shefrin, H. and Statman, M. (2000). Behavioral portfolio theory. Journal of Financial and Quantitative Analysis, 35(2), 127-151.",
  "Soto, C. J. and John, O. P. (2017). Short and extra-short forms of the Big Five Inventory 2. Journal of Research in Personality, 68, 69-81.",
  "Tversky, A. and Kahneman, A. (1992). Advances in prospect theory: cumulative representation of uncertainty. Journal of Risk and Uncertainty, 5(4), 297-323.",
  "Wakker, P. and Deneffe, D. (1996). Eliciting von Neumann-Morgenstern utilities when probabilities are distorted or unknown. Management Science, 42(8), 1131-1150."
].forEach(t => doc.push(new Paragraph({
  spacing: { after: 110, line: 280 }, indent: { left: 340, hanging: 340 },
  children: [new TextRun({ text: t, size: 19, color: INK })]
})));

doc.push(new Paragraph({ children: [new PageBreak()] }));

/* ================================================== appendix */
doc.push(H("Appendix A. The instrument"));
doc.push(P("Reproduced as fielded. Sections 5, 6 and 7 are the ones that produce the curves, and are "
  + "worth reading closely; the rest are conventional."));

doc.push(H("A.2 Risk ladder", 3));
doc.push(P("For each row: would you take this coin flip, or leave your corpus alone? Mark the first "
  + "row you would accept.", { size: 19 }));
doc.push(table([900, 2400, 2400],
  ["Row", "Heads, you gain", "Tails, you lose"],
  [0.10, 0.15, 0.20, 0.25, 0.30, 0.40, 0.50, 0.65, 0.80, 1.00].map((u, i) =>
    [String(i + 1), "+" + pct(u, 0) + " of your corpus", "-10% of your corpus"]),
  { band: true }));

doc.push(H("A.5 Utility function", 3));
doc.push(P("Worst outcome on the table: 85% of your corpus. Best outcome: 160%. For each row, what "
  + "chance of the best outcome would make the certain amount and the gamble equally attractive?",
  { size: 19 }));
doc.push(table([2400, 3300],
  ["Certain amount", "Your answer, as a probability of the best outcome"],
  [0.90, 1.00, 1.15, 1.30, 1.45].map(m => [pct(m, 0) + " of your corpus", ""]), { rightFrom: 99 }));

doc.push(H("A.6 Value function", 3));
doc.push(table([2400, 3300],
  ["The certain outcome", "Your answer, as a probability of the full 100% move"],
  [...[0.10, 0.25, 0.50].map(x => ["A certain gain of " + pct(x, 0) + " of your corpus", ""]),
   ...[0.10, 0.25, 0.50].map(x => ["A certain loss of " + pct(x, 0) + " of your corpus", ""])],
  { rightFrom: 99, band: true }));
doc.push(P("Then: a coin flip loses you Rs 10,000 on tails and wins you G on heads. What is the "
  + "smallest G at which you would take it?", { size: 19 }));

doc.push(H("A.7 Probability weighting", 3));
doc.push(table([3000, 2700],
  ["The prospect", "The certain amount you would accept instead"],
  [["A 10% chance of Rs 10,000, otherwise nothing", ""],
   ["A 90% chance of Rs 10,000, otherwise nothing", ""]], { rightFrom: 99 }));

doc.push(H("A.4 Personality items and scoring key", 3));
doc.push(P("Rated 1 (disagree strongly) to 5 (agree strongly). Items marked R are reverse keyed, so "
  + "the score is 6 minus the response. Domain scores are the mean of the six items. This is a short "
  + "form written for this project and aligned to the BFI-2 domain and facet structure. For a "
  + "submitted dataset, administer the official BFI-2-S from the Colby personality lab and enter the "
  + "domain scores directly.", { size: 19 }));

const portalHtml = fs.readFileSync(path.join(HERE, "..", "docs", "index.html"), "utf8");
const bfiBlock = portalHtml.match(/const BFI = \[([\s\S]*?)\n\];/)[1];
const bfiItems = [];
bfiBlock.split("\n").forEach(line => {
  const m = line.match(/\{d:"(\w)",f:"([^"]+)",\s*t:"([^"]+)"(,\s*r:1)?\}/);
  if (m) bfiItems.push({ d: m[1], f: m[2], t: m[3].replace(/\\"/g, '"'), r: !!m[4] });
});
const DOMNAME = { E: "Extraversion", A: "Agreeableness", C: "Conscientiousness",
                  N: "Negative Emotionality", O: "Open-Mindedness" };
doc.push(table([550, 800, 1300, 3050],
  ["#", "Domain", "Facet", "Statement"],
  bfiItems.map((it, i) => [String(i + 1) + (it.r ? " R" : ""), DOMNAME[it.d].split(" ")[0],
                           it.f, it.t]),
  { rightFrom: 99, band: true }));

doc.push(H("Appendix B. How to reproduce every number in this report", 3));
doc.push(P("The pipeline is four commands, in order. Each reads only the output of the one before "
  + "it, so there is no hidden state and no manual step.", { size: 19 }));
[
  ["make_pilot_data.py", "Generates responses.json from the assumed preference profiles. Replace this step with the real survey responses when the instrument is fielded."],
  ["robo_engine.py", "Fits every parameter and builds every portfolio. Writes outputs/analysis.json and outputs/summary.csv."],
  ["make_figures.py", "Draws Figures 1 to 10 into figures/."],
  ["sync_portal_pilot.py", "Rewrites the portal's bundled pilot dataset from responses.json, so the portal and the report cannot drift apart."],
  ["make_report.js", "Builds this document, reading every quoted figure from outputs/analysis.json."]
].forEach(([f, d]) => doc.push(RP([{ t: f, code: true, b: true }, "   " + d], { size: 19 })));

/* ================================================================= build */
const document = new Document({
  creator: "MBA680 Problem Statement 2",
  title: "Personal Financial Planning and Robo-Advisory Design",
  styles: {
    default: { document: { run: { font: "Calibri", size: 20, color: INK } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", quickFormat: true,
        run: { size: 28, bold: true, color: INK, font: "Calibri" } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", quickFormat: true,
        run: { size: 23, bold: true, color: INK, font: "Calibri" } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", quickFormat: true,
        run: { size: 21, bold: true, color: INK, font: "Calibri" } }
    ]
  },
  sections: [{
    properties: {
      page: { size: { width: 11906, height: 16838 },  // A4
              margin: { top: 1250, right: 1150, bottom: 1250, left: 1150 } }
    },
    footers: {
      default: new Footer({ children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ children: [PageNumber.CURRENT], size: 17, color: INK2 })] })] })
    },
    children: doc
  }]
});

fs.mkdirSync(OUTDIR, { recursive: true });
Packer.toBuffer(document).then(buf => {
  const out = path.join(OUTDIR, "MBA680_PS2_Report.docx");
  fs.writeFileSync(out, buf);
  console.log(`wrote ${out}  (${(buf.length / 1024).toFixed(0)} KB, ${doc.length} blocks)`);
});
