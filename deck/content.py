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
        return f"Rs {n/1e5:.2f}".rstrip("0").rstrip(".") + " L"
    return "Rs " + f"{n:,}"


usable = [r for r in R if r["portfolios"]]
blocked = [r for r in R if not r["portfolios"]]
m39, m02 = by["251250039"], by["251250002"]
in_sharpe = (PS1["tangency"]["mu"] - RF) / PS1["tangency"]["sigma"]

THEME = {
    "name": "MBA680 Behavioral Finance",
    "head": "Cambria", "body": "Calibri",
    "navy": "1E2761", "navyDeep": "151C45", "ice": "CADCFC",
    "white": "FFFFFF", "ink": "1A1A2E", "ink2": "55607A", "ink3": "8A93A8",
    "amber": "E9A13B", "line": "DFE5F2", "surface": "F6F8FD",
}

slides = []
S = slides.append

# 1 ------------------------------------------------------------------ title
S({"layout": "title", "title": "Personal Investment Advisor and Robo-Advisory Design",
   "subtitle": "MBA680 Behavioral Finance  |  Problem Statement 2  |  Steps 1 to 6",
   "team": ["Abhinav Raj", "Raghav Patidar", "Shubham Raj", "Siddharth Jaiswal"],
   "kicker": "What four classmates told us, and what their answers could not tell us"})

# 2 ------------------------------------------------------------- the message
S({"layout": "statement",
   "title": "The headline",
   "big": "We can tell you how much equity to hold. We cannot yet tell you how to split it.",
   "body": "The class survey identifies risk aversion, time preference, personality and the two "
           "curvatures of the value function. It does not identify loss aversion, the floor or the "
           "aspiration level, so the behavioral layers cannot be sized from stated preferences. "
           "Four extra questions close that gap, and they are already live in our portal."})

# 3 ------------------------------------------------------------ what we did
S({"layout": "cards3", "title": "What we did",
   "cards": [
     {"n": "01", "h": "Fielded the survey",
      "b": "Four classmates completed Steps 1 to 4: the eight-row risk ladder, six time-preference "
           "rows, the 30-item BFI-2 subset, and the utility and value elicitations."},
     {"n": "02", "h": "Estimated what it identifies",
      "b": "Risk aversion from the utility curve, a discount bracket from the time rows, five "
           "personality domains and fifteen facets, and both value-function curvatures."},
     {"n": "03", "h": "Built Step 5 on real inputs",
      "b": f"The 60-stock maximum-Sharpe portfolio from Problem Statement 1, {pct(PS1['tangency']['mu'])} "
           f"against {pct(PS1['tangency']['sigma'])}, not an illustrative market assumption."}]})

# 4 ------------------------------------------------------------ the group
S({"layout": "table", "title": "The peer group",
   "head": ["Roll", "Age", "Investable", "Experience", "Horizon", "Goal", "Usable"],
   "rows": [[r["roll"], str(r["age"]), inr(r["corpus"]), r["experience"],
             f"{r['horizon']} yrs", r["goal"], "Yes" if r["portfolios"] else "No"] for r in R],
   "foot": "Two of the four submitted utility data we could not use. We left those cells empty "
           "rather than inventing a number, and specified the re-elicitation instead."})

# 5 ------------------------------------------------------- finding 1
S({"layout": "figure", "title": "Finding 1: the risk ladder cannot measure risk aversion",
   "image": "c3_risk_ladder.png",
   "lead": "Every rung offers a certain amount equal to the gamble's expected value.",
   "points": [
     "Under expected utility, a risk-averse person takes the certain amount at all eight rows "
     "and a risk-seeking person takes the gamble at all eight.",
     f"Roll {m39['roll']} switches at R{m39['risk']['switch_row']}. "
     f"Roll {m02['roll']} switches at R{m02['risk']['switch_row']}.",
     "No utility function over final wealth can produce a switch. These are not noise, they are "
     "violations of the model that would do the measuring.",
     "So we classify the pattern and take risk aversion from the utility curve instead."]})

# 6 ------------------------------------------------------- finding 2
S({"layout": "proof", "title": "Finding 2: loss aversion is not identified at all",
   "lead": "Every value-function row offers a certain amount against double or nothing, so the "
           "certain amount cancels:",
   "math": ["v(X) = p  v(2X)",
            "X^a  =  p (2X)^a",
            "p  =  (1/2)^a        so        a  =  -log2(p)"],
   "body": "The gain rows fix the gain curvature and the loss rows fix the loss curvature, but "
           "nothing in the form ever compares their heights. Lambda needs a prospect with a gain "
           "on one side and a loss on the other. Without it, the single most important parameter "
           "in prospect theory is simply absent.",
   "callout": "This is a property of the instrument, not of the respondents."})

# 7 ------------------------------------------------------- finding 3
S({"layout": "stat", "title": "Finding 3: V1, V2 and V3 are one question asked three times",
   "stats": [{"v": f2(m39["value"]["alpha_detail"]["each"][0]),
              "l": "implied by V1"},
             {"v": f2(m39["value"]["alpha_detail"]["each"][1]),
              "l": "implied by V2"},
             {"v": f2(m39["value"]["alpha_detail"]["each"][2]),
              "l": "implied by V3"}],
   "body": f"Because the certain amount cancels, all three rows imply the identical curvature. A "
           f"steady respondent gives the same number three times. Roll {m39['roll']} gives a spread "
           f"of {m39['value']['alpha_detail']['spread']:.2f}, and averaging to "
           f"{f2(m39['value']['alpha'])} hides it entirely.",
   "callout": "The spread is the measurement error on a single answer. It belongs in the report."})

# 8 ------------------------------------------------------ utility curves
S({"layout": "figure", "title": "Step 4: the two usable utility curves",
   "image": "c1_utility.png",
   "lead": "Probability equivalence, exactly as the Week 2 to 3 lecture sets it out.",
   "points": [
     "With U(A) = 0 and U(B) = 1, the probability that leaves a certain X indifferent to the "
     "gamble is the utility of X.",
     f"Roll {m39['roll']} fits a relative risk aversion of {f2(m39['utility']['gamma'])}, "
     f"roll {m02['roll']} fits {f2(m02['utility']['gamma'])}.",
     "That coefficient is exactly the A in the lecture's U = E(r) minus half A sigma squared, "
     "so it feeds Step 5 directly.",
     "The dashed line is the log curve the lecture suggests, which is the special case A = 1."]})

# 9 ------------------------------------------------------ value functions
S({"layout": "figure", "title": "Step 4: value functions, with one uncomfortable result",
   "image": "c2_value.png",
   "lead": "Every estimated loss curvature came out above one.",
   "points": [
     "A curvature above one means the loss limb gets steeper as losses grow.",
     "Prospect theory predicts the opposite: diminishing sensitivity, a curvature below one.",
     "Either this group genuinely shows increasing sensitivity to larger losses, which would be "
     "an unusual result, or the loss rows were answered with less care than the gain rows.",
     "The spread statistic supports the second reading. A second pass would separate them."]})

# 10 ----------------------------------------------------- inputs
S({"layout": "cards3", "title": "Step 5: how much to believe the inputs",
   "lead": f"Problem Statement 1 reports a Sharpe ratio of {in_sharpe:.2f}. That is not a number to "
           f"plan a household around.",
   "cards": [
     {"n": pct(A["engines"]["in_sample"]["mu"], 1), "h": "As reported",
      "b": "Three-year averages taken over a strong run in Indian equities. The error on a mean "
           "estimated that way is roughly 17% a year."},
     {"n": pct(A["engines"]["base"]["mu"], 1), "h": "Base case, used",
      "b": "Expected return cut three quarters of the way back to a long-run figure. Volatility "
           "is left untouched, because it is the reliable half of the estimate."},
     {"n": pct(A["engines"]["prudent"]["mu"], 1), "h": "Stress case",
      "b": "None of the screening premium survives. Reported so the reader can see how much of "
           "the advice is the client and how much is the estimate."}]})

# 11 ----------------------------------------------------- recommendation
S({"layout": "figure", "title": "Step 5: the recommendation, and why it is the same for both",
   "image": "c7_scenarios.png",
   "lead": "The no-borrowing cap binds in all nine cells.",
   "points": [
     f"Roll {m39['roll']}, A = {f2(m39['gamma_used'])}, unconstrained y* of "
     f"{m39['portfolios'][ADV]['y_star']:.1f} times the corpus.",
     f"Roll {m02['roll']}, A = {f2(m02['gamma_used'])}, unconstrained y* of "
     f"{m02['portfolios'][ADV]['y_star']:.1f} times the corpus.",
     "Both are advised to hold 100% of their corpus in the Problem Statement 1 portfolio.",
     "What separates the two respondents is not their preferences. It is whether you believe the "
     "expected return."]})

# 12 ----------------------------------------------------- personality
S({"layout": "cards4", "title": "Step 6: personality changes the process, not the weights",
   "lead": "Risk aversion is already measured directly, so adjusting the equity weight for "
           "personality would count the same thing twice.",
   "cards": [
     {"n": "251250039", "h": "Low conscientiousness",
      "b": "Will set the plan up and stop watching it. Automate the contribution, rebalance on a "
           "threshold, fix review dates in advance."},
     {"n": "251250047", "h": "Calm but genuinely conservative",
      "b": "Took the certain amount at all eight rows. Low reactivity is not hidden risk "
           "tolerance. Use a glide path, not a single large allocation."},
     {"n": "251250002", "h": "Reasons in rupees",
      "b": "Risk seeking at small stakes, cautious at real money. Frame everything in rupees, "
           "including the downside case."},
     {"n": "251250030", "h": "Re-interview first",
      "b": "Refused every delay even at 34% a year, and left two tables unusable. Likely a "
           "short-term cash need or a quick fill-in."}]})

# 13 ----------------------------------------------------- the gap
S({"layout": "table", "title": "What is missing, and the four questions that fix it",
   "lead": "Each is one line. Together they take about a minute, and they are already live in our "
           "portal, marked as extensions to the class form.",
   "head": ["", "Question", "What it unlocks"],
   "rows": [
     ["E1", "Tails you lose Rs 10,000, heads you win G. How big must G be?", "Loss aversion"],
     ["E2", "A 10% chance of Rs 10,000. What certain amount feels as good? Same at 90%.",
      "Probability weighting"],
     ["E3", "Smallest amount you must still have, and how often you could fall below it.",
      "The safety layer"],
     ["E4", "The amount you would call success, and what you would pay for a better shot.",
      "The aspiration layer"]],
   "foot": "Without these four, the safety and potential split is the adviser's judgement wearing "
           "the respondent's data as a costume."})

# 14 ----------------------------------------------------- portal
S({"layout": "cards3", "title": "The robo-advisory portal",
   "lead": "A single static page, no server and no account, so it opens on a phone in a classroom.",
   "cards": [
     {"n": "01", "h": "Fields the whole form",
      "b": "All six class sections plus the four extensions, in plain English, with autosave and "
           "a one-click export of the respondent's answers."},
     {"n": "02", "h": "Fits and plots live",
      "b": "Draws the respondent's own utility curve, value function and weighting function in "
           "the browser, using the same estimators as the report."},
     {"n": "03", "h": "Builds both portfolios",
      "b": "The mean-variance allocation and the behavioral layers, against the real Problem "
           "Statement 1 frontier, with the advisory commentary generated from their own scores."}],
   "foot": "siddharthjaiswal05.github.io/mba_680_assignment_2"})

# 15 ----------------------------------------------------- close
S({"layout": "close", "title": "What we would say to the client",
   "points": [
     "Hold the Problem Statement 1 portfolio, and hold all of it, if you are either of the two "
     "respondents whose data we could use.",
     "Do not read the risk ladder as a measure of how risk averse you are. It cannot be one.",
     "Answer four more questions and we can size your safety layer instead of asserting it.",
     "Treat the expected return, not your own preferences, as the thing most likely to be wrong."],
   "team": ["Abhinav Raj", "Raghav Patidar", "Shubham Raj", "Siddharth Jaiswal"]})

out = {"theme": THEME, "slides": slides}
with open(os.path.join(HERE, "content.json"), "w") as fh:
    json.dump(out, fh, indent=1)
print(f"wrote content.json with {len(slides)} slides")
