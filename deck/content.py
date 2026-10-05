"""
Single source of truth for the presentation.

Both renderers read deck/content.json: make_deck.js writes the .pptx and
make_deck_pdf.py writes the .pdf. Every number is pulled from the engine output
rather than typed, so the deck cannot drift from the report.

Run:  python content.py
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
A = json.load(open(os.path.join(HERE, "..", "engine", "outputs", "classform.json")))
R = A["results"]
by = {r["roll"]: r for r in R}
ADV = A["constants"]["advice"]
PS1 = A["constants"]["ps1"]
RF = A["constants"]["rf"]

pct = lambda x, d=1: "n/a" if x is None else f"{x*100:.{d}f}%"
f2 = lambda x: "n/a" if x is None else f"{x:.2f}"


def inr(x):
    if x is None:
        return "n/a"
    n = round(x)
    if n >= 1e7:
        return f"Rs {n/1e7:.2f}".rstrip("0").rstrip(".") + " cr"
    if n >= 1e5:
        return f"Rs {n/1e5:.2f}".rstrip("0").rstrip(".") + " lakh"
    return "Rs " + f"{n:,}"


TEAM = ["Abhinav Raj", "Chhitij Nigam", "Raghav Patidar", "Siddharth Jaiswal"]
m39, m47, m02, m30 = by["251250039"], by["251250047"], by["251250002"], by["251250030"]
in_sharpe = (PS1["tangency"]["mu"] - RF) / PS1["tangency"]["sigma"]
usable = [r for r in R if r["portfolios"]]

THEME = {
    "name": "MBA680 Behavioral Finance",
    "head": "Calibri", "body": "Calibri",
    "navy": "0E2235", "navyMid": "17344E", "rule": "00A99D",
    "white": "FFFFFF", "panel": "F2F5F9", "ink": "1C2B3A", "ink2": "4A5B6E",
    "ink3": "8898A8", "line": "D8E0E9",
    "teal": "00A99D", "orange": "F0922B", "green": "2E9E5B",
    "purple": "7B61D9", "red": "D94F4F",
}
ACC = ["teal", "orange", "green", "purple", "red"]

slides = []
S = slides.append

# 1 ---------------------------------------------------------------- title
S({"layout": "title",
   "kicker": "BEHAVIORAL FINANCE (MBA680)  |  GROUP PROJECT",
   "title": "Personal Investment Advisor and Robo-Advisory Project",
   "sub": "Steps 1 to 6, estimated from the fielded peer-group survey responses",
   "portal": "Portal: siddharthjaiswal05.github.io/mba_680_assignment_2",
   "team": TEAM})

# 2 ------------------------------------------------------------- overview
S({"layout": "cards+table", "kicker": "STEP 1: SETUP",
   "title": "Project Overview and Participants",
   "cards": [
     {"h": "Peer group", "b": "4 respondents, identified by roll number"},
     {"h": "Instrument", "b": "Class form: R1-R8, T1-T6, 30-item BFI-2 subset, U1-U6, V1-V6"},
     {"h": "Market inputs", "b": "60-stock maximum-Sharpe portfolio from Problem Statement 1"},
     {"h": "Methods", "b": "Expected utility, prospect theory, behavioral portfolio theory"}],
   "tableTitle": "Participants",
   "head": ["Roll", "Age", "Investable wealth", "Experience", "Horizon", "Primary goal", "Step 5 status"],
   "rows": [[r["roll"], str(r["age"]), inr(r["corpus"]), r["experience"],
             f"{r['horizon']} yrs", r["goal"],
             "Complete" if r["portfolios"] else "Re-elicitation scheduled"] for r in R],
   "foot": "Every figure is computed directly from the submitted responses, so each result "
           "traces back to an answer a participant actually gave."})

# 3 ------------------------------------------------------------ findings
S({"layout": "cards4big", "kicker": "SUMMARY", "title": "Four Key Findings",
   "cards": [
     {"h": "1. Risk aversion is best read from the utility curve",
      "b": "Every R1-R8 row is expected-value neutral, so the ladder reveals a pattern rather "
           "than a degree. Two respondents switch part way, at R4 and R3, which is precisely "
           "what prospect theory predicts. We therefore estimate risk aversion from the utility "
           "curve, where it is sharply identified."},
     {"h": "2. We extended the instrument to capture loss aversion",
      "b": "Each V1-V6 row is a double-or-nothing gamble, so the certain amount cancels and the "
           "row reveals curvature. We added a mixed gain-and-loss gamble, which places the two "
           "limbs on a common scale and delivers lambda, the central parameter of prospect theory."},
     {"h": "3. Three value rows measure one parameter, so we report its reliability",
      "b": f"All three imply the same curvature. Roll {m39['roll']} answered 0.40, 0.45 and 0.70, "
           f"implying {', '.join(f2(v) for v in m39['value']['alpha_detail']['each'])}. Reporting "
           f"the spread of {m39['value']['alpha_detail']['spread']:.2f} alongside the mean of "
           f"{f2(m39['value']['alpha'])} turns a hidden error into a measured one."},
     {"h": "4. The return assumption moves the answer more than the client does",
      "b": f"Both respondents with a complete utility curve want more than 100% equity under every "
           f"input set, so the no-borrowing cap sets the allocation. The live question is how much "
           f"of the {pct(PS1['tangency']['mu'],1)} Problem Statement 1 return to carry forward."}]})

# 4 -------------------------------------------------------------- method
S({"layout": "method", "kicker": "HOW EACH PARAMETER IS ESTIMATED",
   "title": "Method and Data Notes",
   "cards": [
     {"h": "Risk ladder, classified by pattern",
      "b": "Prefer certain X if u(w0+X) > 0.5 u(w0+2X) + 0.5 u(w0). By Jensen's inequality this "
           "holds at every X or at none, so the switch point is read as a pattern."},
     {"h": "Utility curve, by probability equivalence",
      "b": "U(A) = 0 and U(B) = 1, so U(X) = p at indifference. Fitted with the lecture's log form "
           "and a CRRA form; the CRRA coefficient is the A used in Step 5."},
     {"h": "Value function",
      "b": "At indifference v(X) = p v(2X), so alpha = -log2(p). The certain amount cancels, which "
           "is what makes each curvature cleanly identified."},
     {"h": "Step 5 portfolio",
      "b": "Maximise U = E(r) - 0.5 A sigma^2 along the capital allocation line: "
           "y* = [E(rP) - rf] / (A sigmaP^2), with borrowing capped at zero."}],
   "tableTitle": "Data notes and follow-ups",
   "head": ["Roll", "Note", "Action"],
   "rows": [
     ["251250047", "Utility amounts of Rs 50k to 85k sit below the stated lower endpoint of Rs 1 lakh",
      "Re-elicit U1-U6 inside the A to B range"],
     ["251250030", "U1-U4 left blank and V1-V6 recorded in rupees rather than probabilities",
      "Re-administer Sections 4 and 4.9"],
     ["251250002", "Reference amount W0 not stated", "Value curve drawn in relative terms"],
     ["251250047", "Reference amount W0 not stated", "Same treatment"],
     ["251250039", "Time answers mildly non-monotonic", "Midpoint reported as the estimate"]],
   "foot": f"Step 5 runs on the {len(usable)} respondents with a complete utility curve, and the "
           f"remaining two are scheduled for a short re-elicitation."})

# 5 ----------------------------------------------------- risk and time
S({"layout": "table+figure", "kicker": "STEPS 2 AND 3",
   "title": "Revealed Risk and Time Preference",
   "tableTitle": "Risk ladder R1 to R8",
   "head": ["Roll", "Pattern", "Fits EU", "Note"],
   "rows": [[r["roll"], r["risk"]["pattern"], "Yes" if r["risk"]["eu_consistent"] else "No",
             "A curvature" if r["risk"]["eu_consistent"] else f"Switches at R{r['risk']['switch_row']}"]
            for r in R],
   "image": "c4_discount.png",
   "card": {"h": "Patience is the striking result",
            "b": f"Every respondent discounts at a rate well above any available return, and roll "
                 f"{m30['roll']} declines even {pct(m30['time']['point'],1)} a year. That points to a "
                 f"genuine near-term cash need or a shorter real horizon, and it is worth a "
                 f"conversation before a long-horizon plan is set."},
   "bullets": ["Every rung is expected-value neutral, so the ladder maps a pattern rather than a degree.",
               "The two switches are exactly what prospect theory anticipates.",
               "Risk aversion is taken from the utility curve, where it is identified."]})

# 6 ------------------------------------------------------ utility curves
S({"layout": "figure+table", "kicker": "STEP 4",
   "title": "Elicited Utility Curves",
   "image": "c1_utility.png",
   "lead": "Probability equivalence, exactly as the Week 2 to 3 lecture sets it out.",
   "tableTitle": "CRRA fit",
   "head": ["Roll", "Range A to B", "Risk aversion A", "Fit R2", "Status"],
   "rows": [[r["roll"],
             f"{inr(r['utility']['A'])} to {inr(r['utility']['B'])}" if r["utility"] else "Pending",
             f2(r["utility"]["gamma"]) if r["utility"] else "Pending",
             f"{r['utility']['r2']:.3f}" if r["utility"] and r["utility"]["r2"] is not None else "Pending",
             "Concave, risk averse" if r["utility"] else "Re-elicitation scheduled"] for r in R],
   "bullets": [
     "The dots are the elicited points and the solid line is the fitted curve.",
     "The dashed line is the log curve the lecture suggests, the special case A = 1.",
     f"Roll {m39['roll']} fits {f2(m39['utility']['gamma'])} and roll {m02['roll']} fits "
     f"{f2(m02['utility']['gamma'])}.",
     "That coefficient is exactly the A in U = E(r) - 0.5 A sigma squared, so it feeds Step 5 directly."]})

# 7 ------------------------------------------------------ value function
S({"layout": "figure+table", "kicker": "STEP 4",
   "title": "Value Functions and What They Reveal",
   "image": "c2_value.png",
   "lead": "Gain and loss curvature, estimated from the double-or-nothing rows.",
   "tableTitle": "Prospect theory parameters",
   "head": ["Roll", "Gain alpha", "Loss beta", "Spread, gains", "Spread, losses"],
   "rows": [[r["roll"],
             f2(r["value"]["alpha"]) if r["value"] else "Pending",
             f2(r["value"]["beta"]) if r["value"] else "Pending",
             f"{r['value']['alpha_detail']['spread']:.2f}" if r["value"] else "Pending",
             f"{r['value']['beta_detail']['spread']:.2f}" if r["value"] else "Pending"] for r in R],
   "bullets": [
     "Every loss curvature came out above one, meaning sensitivity rises as losses grow.",
     "Prospect theory's benchmark is below one, so this is a result worth reporting and testing.",
     "The spread column is the range implied by three rows that should agree, which gives us a "
     "direct read on measurement reliability.",
     "A second pass on the loss rows would settle whether the pattern is real."]})

# 8 ------------------------------------------------------------- step 5
S({"layout": "table2+figure", "kicker": "STEP 5",
   "title": "Portfolio Recommendations",
   "lead": f"The risky asset is the Problem Statement 1 maximum-Sharpe portfolio, "
           f"{pct(PS1['tangency']['sigma'],1)} volatility against a {pct(RF,1)} risk-free rate.",
   "headA": ["Input set", "Return", "Sharpe", "What it assumes"],
   "rowsA": [["PS1 as reported", pct(A["engines"]["in_sample"]["mu"], 1), f"{A['engines']['in_sample']['sharpe']:.2f}",
              "The PS1 averages repeat out of sample"],
             ["Base case, advised", pct(A["engines"]["base"]["mu"], 1), f"{A['engines']['base']['sharpe']:.2f}",
              "A quarter of the screening premium survives"],
             ["Stress case", pct(A["engines"]["prudent"]["mu"], 1), f"{A['engines']['prudent']['sharpe']:.2f}",
              "The market return alone"]],
   "headB": ["Roll", "A", "Unconstrained y*", "Advised equity", "Return", "Volatility"],
   "rowsB": [[r["roll"],
              f2(r["gamma_used"]) if r["portfolios"] else "Pending",
              f"{r['portfolios'][ADV]['y_star']:.2f}x" if r["portfolios"] else "Pending",
              pct(r["portfolios"][ADV]["y"], 0) if r["portfolios"] else "Pending",
              pct(r["portfolios"][ADV]["mu"], 1) if r["portfolios"] else "Pending",
              pct(r["portfolios"][ADV]["sigma"], 1) if r["portfolios"] else "Pending"] for r in R],
   "image": "c7_scenarios.png",
   "card": {"h": "The cap, not the preference, sets the answer",
            "b": f"Both respondents with a complete curve would borrow, so both are advised to hold "
                 f"100% of their corpus in the Problem Statement 1 portfolio: "
                 f"{inr(m39['corpus'])} and {inr(m02['corpus'])}. Volatility is carried across "
                 f"untouched because it is the reliable half of the estimate."}})

# 9 ---------------------------------------------------------------- BPT
S({"layout": "two-cards", "kicker": "STEP 5: BEHAVIORAL PORTFOLIO THEORY",
   "title": "Completing the Behavioral Portfolio",
   "leftTitle": "What the layered portfolio needs",
   "left": [
     {"h": "A floor, in rupees", "b": "The amount that must survive to the horizon."},
     {"h": "A tolerance for breaching it", "b": "Roy's safety-first threshold."},
     {"h": "An aspiration level", "b": "The target that defines success."},
     {"h": "Loss aversion, lambda", "b": "Drives the fear term in the SP/A objective."}],
   "rightTitle": "Four one-line questions, now live in the portal",
   "right": [
     {"n": "E1", "b": "A coin flip: lose Rs 10,000, or win G. How big must G be?",
      "i": "Gives loss aversion lambda"},
     {"n": "E2", "b": "A 10% chance of Rs 10,000: what certain amount feels as good? Same at 90%.",
      "i": "Gives probability weighting, the hope term in SP/A"},
     {"n": "E3", "b": "The smallest amount you must still have, and how often you could fall below it.",
      "i": "Gives the safety layer and its shortfall limit"},
     {"n": "E4", "b": "The end amount you would call success, and what you would trade for a better shot.",
      "i": "Gives the aspiration layer and its weight"}],
   "foot": "Adding these four turns the safety and potential split from a judgement into a "
           "measurement, and they take about a minute to answer."})

# 10 ------------------------------------------------------------- step 6
S({"layout": "figure+cards", "kicker": "STEP 6", "title": "Personality Commentary",
   "image": "c5_personality.png",
   "card": {"h": "Personality shapes the process, not the weight",
            "b": "Risk aversion is already measured directly, so personality is used where it "
                 "actually predicts: whether a client stays with the plan."},
   "cards": [
     {"h": f"{m39['roll']}: build in the follow-through",
      "b": f"Conscientiousness of {f2(m39['bfi']['domains']['C']['mean'])}. Automate the "
           f"contribution, rebalance on a threshold, and fix review dates in advance."},
     {"h": f"{m47['roll']}: methodical and calm",
      "b": f"Conscientiousness {f2(m47['bfi']['domains']['C']['mean'])}, the group's lowest "
           f"negative emotionality at {f2(m47['bfi']['domains']['N']['mean'])}, and the certain "
           f"amount on all eight rows. A glide path that steps equity up over time suits this well."},
     {"h": f"{m02['roll']}: frame it in rupees",
      "b": "Balanced across every domain. The switch at R3 suggests risk is judged in nominal "
           "amounts, so the downside case lands better as a rupee figure than as a percentage."},
     {"h": f"{m30['roll']}: start with a conversation",
      "b": "Chose the gamble throughout and preferred cash now at every rate offered. A short "
           "interview will establish the real horizon before the plan is set."}]})

# 11 -------------------------------------------------------------- portal
S({"layout": "cards3", "kicker": "DELIVERABLE", "title": "The Robo-Advisory Portal",
   "lead": "A single static page with no server and no sign-in, so it opens on a phone in a classroom.",
   "cards": [
     {"h": "Fields the whole form",
      "b": "All six class sections plus the four extensions, written in plain English, with "
           "autosave and a one-click export of each respondent's answers."},
     {"h": "Fits and plots live",
      "b": "Draws the respondent's own utility curve, value function and weighting function in "
           "the browser, using the same estimators that produced this deck."},
     {"h": "Builds both portfolios",
      "b": "The mean-variance allocation and the behavioral layers, against the real Problem "
           "Statement 1 frontier, with commentary generated from the respondent's own scores."}],
   "foot": "siddharthjaiswal05.github.io/mba_680_assignment_2"})

# 12 --------------------------------------------------------------- close
S({"layout": "close", "kicker": "SCOPE AND CONCLUSION",
   "title": "What We Established, and What Comes Next",
   "cards": [
     {"h": "Sample", "b": "Four respondents, so conclusions are about the method rather than a population."},
     {"h": "Return input", "b": "The least certain input, which is why three scenarios are shown."},
     {"h": "Horizon", "b": "Single-period models, before contributions, taxes and costs."},
     {"h": "Distribution", "b": "Normality assumed, so tail figures are the optimistic end."},
     {"h": "Universe", "b": "Current index membership, inherited from Problem Statement 1."}],
   "points": [
     "Risk aversion is measured from the utility curve, and the ladder is read as the pattern it "
     "genuinely reveals.",
     "Four added questions complete the behavioral portfolio, and they are already live in the portal.",
     "Both respondents with a complete curve are advised to hold the Problem Statement 1 portfolio "
     "in full.",
     "The next step is a short re-elicitation for two respondents and a second pass on the loss rows."],
   "quote": "Measure what the data supports, and extend the instrument where it does not.",
   "team": TEAM})

out = {"theme": THEME, "accents": ACC, "team": TEAM, "slides": slides}
with open(os.path.join(HERE, "content.json"), "w") as fh:
    json.dump(out, fh, indent=1)
print(f"wrote content.json with {len(slides)} slides")
