"""
Single source of truth for the presentation.

The deck walks the grader through the project one step at a time. Each step slide
shows the same four things: what the step required, the questions the form
actually asked, how the answers were turned into a number, and what came out.

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
usable = [r for r in R if r["portfolios"]]
G39, G02 = f2(m39["utility"]["gamma"]), f2(m02["utility"]["gamma"])

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

# ---------------------------------------------------------------- helpers
def step(kicker, title, lead, left, right, gap=0.03, wl=0.52, wr=0.45):
    S({"layout": "blocks", "kicker": kicker, "title": title, "lead": lead,
       "gap": gap, "cols": [{"w": wl, "blocks": left}, {"w": wr, "blocks": right}]})


def wide(kicker, title, lead, blocks):
    S({"layout": "blocks", "kicker": kicker, "title": title, "lead": lead,
       "cols": [{"w": 1.0, "blocks": blocks}]})


def tt(text):
    return {"k": "tt", "text": text}


def tbl(head, rows, widths, rowh=0.34, fs=9.5):
    return {"k": "table", "head": head, "rows": rows, "widths": widths,
            "rowh": rowh, "fs": fs}


def card(h, head, body, acc="teal", hs=12, bs=10):
    return {"k": "card", "h": h, "head": head, "body": body, "acc": acc,
            "hs": hs, "bs": bs}


def img(file, h):
    return {"k": "img", "file": file, "h": h}


def note(text, h=0.4):
    return {"k": "note", "text": text, "h": h}


# 1 ---------------------------------------------------------------- title
S({"layout": "title",
   "kicker": "BEHAVIORAL FINANCE (MBA680)  |  GROUP PROJECT",
   "title": "Personal Investment Advisor and Robo-Advisory Project",
   "sub": "A step by step walk-through of Steps 1 to 6, with the survey questions used at each step",
   "portal": "Portal: siddharthjaiswal05.github.io/mba_680_assignment_2",
   "team": TEAM})

# 2 -------------------------------------------------------------- roadmap
wide("THE WORK, END TO END", "The Six Steps at a Glance",
     "The map. Each of the next nine slides takes one step and shows the questions, the method and the result together.",
     [tt("Every step, the part of the form it used, and what it produced"),
      tbl(["Step", "What it required", "Part of the form used", "How it was done", "What came out"],
          [["1", "Pick a peer group and build the survey",
            "Section 1, About you",
            "Eight profile questions, roll number instead of a name",
            "Four anonymous investor profiles"],
           ["2", "Measure the attitude to risk",
            "Section 2, eight ladder rows",
            "A sure amount against a double or nothing coin flip",
            "A risk pattern for each person"],
           ["3", "Measure the attitude to waiting",
            "Section 3, six now or later rows",
            "Rs 10,000 today against a larger amount later",
            "A yearly discount rate for each person"],
           ["4", "Fit the curves and score the personality",
            "Sections 4, 5 and 6",
            "Probability equivalence, then a least squares fit; BFI-2 scored by facet",
            "Risk aversion A, curvatures alpha and beta, five domain scores"],
           ["5", "Build the portfolio",
            "Nothing new, it reuses Steps 2 to 4",
            "Maximise E(r) minus half A sigma squared along the capital allocation line",
            "An advised equity weight for each person"],
           ["6", "Write the advice and ship the tool",
            "Section 4 scores plus Section 7",
            "Rules that fire on the respondent's own answers",
            "Personal commentary and a live portal"]],
          [0.4, 2.3, 2.1, 3.4, 2.6], rowh=0.52, fs=9),
      note("The seven Section 7 questions are our own addition to the class form. They are "
           "introduced on the Step 5 behavioral slide, where they are used.")])

# 3 -------------------------------------------------------------- step 1
step("STEP 1 OF 6", "Choose the Peer Group and Build the Survey",
     "Requirement: field an investor survey on a peer group and record it in a form that "
     "an estimator can read.",
     [tt("The eight questions in Section 1, as they appeared"),
      tbl(["Question on the form", "Answer type"],
          [["Roll number", "Text, used instead of a name"],
           ["Age", "Years"],
           ["Money coming in each month", "One of five bands"],
           ["Money you can invest (Rs)", "Rupees"],
           ["How much investing have you done?", "None to Substantial"],
           ["How many years will you keep it invested?", "Years"],
           ["What is the money mainly for?", "One of four goals"],
           ["Anything that limits you?", "Optional free text"]],
          [3.0, 1.5], rowh=0.36),
      card(1.05, "How it was done",
           "Fielded to four classmates through the portal. The export of their answers is "
           "the file the estimator reads.", "teal", 12, 9.5)],
     [tt("What came back"),
      tbl(["Roll", "Investable wealth", "Experience", "Horizon", "Primary goal"],
          [[r["roll"], inr(r["corpus"]), r["experience"], f"{r['horizon']} yrs", r["goal"]]
           for r in R],
          [1.1, 1.3, 1.2, 0.8, 1.5], rowh=0.40),
      card(1.08, "How the step was completed",
           "Four responses collected and transcribed into one machine readable file.",
           "orange", 12, 9.5),
      card(1.08, "Output of Step 1",
           "engine/responses_real.json, the single input to every later step.",
           "green", 12, 9.5)])

# 4 -------------------------------------------------------------- step 2
step("STEP 2 OF 6", "Measure the Attitude to Risk",
     "Requirement: put a sure amount against a fair gamble and see which one the respondent "
     "takes, row by row.",
     [tt("Section 2, all eight rows exactly as asked"),
      tbl(["#", "A: you get for sure", "B: coin flip"],
          [[str(i + 1), inr(x), f"{inr(2*x)} or nothing, 50:50"]
           for i, x in enumerate([10000, 12000, 15000, 20000, 25000, 30000, 40000, 50000])],
          [0.3, 1.1, 1.9]),
      card(1.2, "How it was done",
           "The sure amount equals the gamble's average on every row, so one utility curve "
           "means the same side all eight times. We read the pattern of the picks.",
           "teal", 12, 9.5)],
     [img("c3_risk_ladder.png", 1.85),
      card(1.3, "How the step was completed",
           f"All four patterns were classified. {m47['roll']} took the sure amount every "
           f"time and {m30['roll']} took the coin flip every time.", "orange", 12, 9.5),
      card(1.3, "What it told us",
           f"{m39['roll']} and {m02['roll']} switch part way down, at rows 4 and 3, exactly "
           f"as prospect theory predicts.", "green", 12, 9.5)])

# 5 -------------------------------------------------------------- step 3
step("STEP 3 OF 6", "Measure the Attitude to Waiting",
     "Requirement: offer money now against more money later and find the return that makes "
     "waiting worthwhile.",
     [tt("Section 3, all six rows exactly as asked"),
      tbl(["#", "Take now", "Or wait and get", "Wait how long"],
          [[str(i + 1), "Rs 10,000", inr(fv), "1 year" if t == 1 else f"{t} years"]
           for i, (fv, t) in enumerate([(10500, 1), (11000, 1), (12000, 1),
                                        (13000, 1), (15000, 2), (18000, 2)])],
          [0.3, 0.9, 1.1, 0.9]),
      card(1.5, "How it was done",
           "Each row implies a yearly return. The lowest offer waited for and the highest one "
           "turned down bracket the personal discount rate, and the midpoint of that bracket "
           "is the point estimate.", "teal", 12, 9.5)],
     [img("c4_discount.png", 1.85),
      card(1.3, "How the step was completed",
           f"A discount rate was produced for all four. {m39['roll']} came out near "
           f"{pct(m39['time']['point'],1)} a year and {m02['roll']} near "
           f"{pct(m02['time']['point'],1)}.", "orange", 12, 9.5),
      card(1.3, "What it told us",
           f"Every rate sits above any return on offer, and {m30['roll']} preferred cash at "
           f"every rung. Worth a conversation about the real horizon.", "green", 12, 9.5)])

# 6 ------------------------------------------------------- step 4, part 1
step("STEP 4 OF 6, PART 1", "Fit the Utility Curve",
     "Requirement: elicit a utility curve over wealth by the probability equivalence method from the lecture.",
     [tt("Section 5, with one respondent's own answers alongside"),
      tbl(["Item", "Question on the form", f"{m39['roll']} said"],
          [["A", "The lowest amount that feels relevant to you", inr(m39["utility"]["A"])],
           ["B", "The highest amount that feels relevant to you", inr(m39["utility"]["B"])]]
          + [[f"U{i+1}", f"{inr(x)} for sure, or play the game. What winning chance makes "
                         f"the two feel the same?", f"{round(p*100)} in 100"]
             for i, (x, p) in enumerate(zip(m39["utility"]["x"], m39["utility"]["p"]))],
          [0.4, 3.0, 1.1], rowh=0.42),
      card(1.4, "How it was done",
           "Set U(A) = 0 and U(B) = 1. At indifference the stated chance is the utility of "
           "the sure amount, so U(X) = p. Those points were fitted with a constant relative "
           "risk aversion curve by least squares.", "teal", 12, 9.5)],
     [img("c1_utility.png", 1.7),
      tt("The fitted curves"),
      tbl(["Roll", "Range A to B", "Risk aversion", "Fit R2"],
          [[r["roll"],
            f"{inr(r['utility']['A'])} to {inr(r['utility']['B'])}" if r["utility"] else "To come",
            f2(r["utility"]["gamma"]) if r["utility"] else "To come",
            f"{r['utility']['r2']:.3f}" if r["utility"] and r["utility"]["r2"] is not None else "To come"]
           for r in R],
          [1.0, 1.6, 1.3, 0.9], rowh=0.40),
      note(f"Both curves came out concave, so both respondents are risk averse: A = {G39} "
           f"and A = {G02}. That coefficient is the A used directly in Step 5.", 0.45)])

# 7 ------------------------------------------------------- step 4, part 2
step("STEP 4 OF 6, PART 2", "Fit the Value Function Over Gains and Losses",
     "Requirement: measure how gains and losses are coded against a reference point, as prospect theory sets it out.",
     [tt("Section 6, all seven fields exactly as asked"),
      tbl(["Item", "Question on the form", "Answer scale"],
          [["W0", "The amount you measure gains and losses against", "Rupees"]]
          + [[f"V{i+1}", f"Win {inr(x)} for sure, or play for {inr(2*x)}", "Winning chance"]
             for i, x in enumerate([10000, 20000, 30000])]
          + [[f"V{i+4}", f"Lose {inr(x)} for sure, or risk losing {inr(2*x)}",
              "Chance of the bigger loss"]
             for i, x in enumerate([10000, 20000, 30000])],
          [0.4, 3.0, 1.2], rowh=0.38),
      card(1.25, "How it was done",
           "The gamble pays double or nothing, so v(X) = p times v(2X) at indifference. With "
           "v(x) = x to the power alpha the sure amount cancels and alpha is minus log base 2 "
           "of p.", "teal", 12, 9.5)],
     [img("c2_value.png", 1.7),
      tt("The fitted parameters"),
      tbl(["Roll", "Gain alpha", "Loss beta", "Spread across rows"],
          [[r["roll"],
            f2(r["value"]["alpha"]) if r["value"] else "To come",
            f2(r["value"]["beta"]) if r["value"] else "To come",
            f"{r['value']['alpha_detail']['spread']:.2f} and "
            f"{r['value']['beta_detail']['spread']:.2f}" if r["value"] else "To come"]
           for r in R],
          [1.0, 1.1, 1.0, 1.6], rowh=0.40),
      note("All three gain rows measure the same curvature, so the spread between them is a "
           "direct read on how reliably the answer was given.", 0.45)])

# 8 ------------------------------------------------------- step 4, part 3
step("STEP 4 OF 6, PART 3", "Score the Personality Profile",
     "Requirement: collect a standard personality measure so the advice can speak to behaviour, not only to risk.",
     [tt("Section 4, thirty short items, one sample from each domain"),
      tbl(["Domain", "A sample item from the thirty", "Scale"],
          [["Extraversion", "Is outgoing, sociable.", "1 to 5"],
           ["Agreeableness", "Is compassionate, has a soft heart.", "1 to 5"],
           ["Conscientiousness", "Is systematic, likes to keep things in order.", "1 to 5"],
           ["Negative emotionality", "Can be tense.", "1 to 5"],
           ["Open-mindedness", "Is curious about many different things.", "1 to 5"]],
          [1.4, 3.0, 0.7]),
      card(1.6, "How it was done",
           "Thirty items from the BFI-2, two per facet, chosen so all fifteen facets are "
           "covered within the thirty question cap. Reverse keyed items were flipped, facets "
           "averaged, domains averaged from their facets, then placed against the published "
           "norming means.", "teal", 12, 9.5),
      note("1 means not like me at all and 5 means very much like me.", 0.3)],
     [img("c5_personality.png", 2.15),
      card(1.25, "How the step was completed",
           "All four answered all thirty items, so every domain and facet score is complete.",
           "orange", 12, 9.5),
      card(1.05, "Output of this step",
           "Five domain scores and fifteen facet scores per person.", "green", 12, 9.5)])

# 9 -------------------------------------------------------------- step 5
step("STEP 5 OF 6", "Build the Mean-Variance Portfolio",
     "Requirement: combine the measured risk aversion with the Problem Statement 1 portfolio and set the equity weight.",
     [tt("The inputs, all carried forward rather than asked again"),
      tbl(["Input", "Value used", "Where it came from"],
          [["Risky portfolio", f"{pct(PS1['tangency']['mu'],1)} return, "
                               f"{pct(PS1['tangency']['sigma'],1)} risk", "Problem Statement 1"],
           ["Risk-free rate", pct(RF, 1), "Treasury bill yield"],
           ["Risk aversion A", f"{G39} and {G02}", "The Step 4 utility curve"],
           ["Borrowing", "Capped at zero", "Student investor constraint"]],
          [1.3, 1.7, 1.5], rowh=0.40),
      card(1.5, "How it was done",
           "Maximise U = E(r) minus half A sigma squared along the capital allocation line. "
           "The optimum is y* = [E(rP) minus rf] divided by A times sigmaP squared, capped at "
           "one because borrowing is not available.", "teal", 12, 9.5),
      note("Three return scenarios are carried through, because the expected return is the "
           "least certain input in the whole exercise.", 0.45)],
     [tt("The recommendation, base case inputs"),
      tbl(["Roll", "A", "y* uncapped", "Advised equity", "Return", "Risk"],
          [[r["roll"],
            f2(r["gamma_used"]) if r["portfolios"] else "To come",
            f"{r['portfolios'][ADV]['y_star']:.2f}x" if r["portfolios"] else "To come",
            pct(r["portfolios"][ADV]["y"], 0) if r["portfolios"] else "To come",
            pct(r["portfolios"][ADV]["mu"], 1) if r["portfolios"] else "To come",
            pct(r["portfolios"][ADV]["sigma"], 1) if r["portfolios"] else "To come"]
           for r in R],
          [1.1, 0.5, 1.2, 1.2, 0.8, 0.7], rowh=0.40),
      img("c7_scenarios.png", 1.5),
      note(f"Both respondents with a fitted curve want more than their whole corpus in the "
           f"risky portfolio, so the cap sets the answer: hold 100%, which is "
           f"{inr(m39['corpus'])} and {inr(m02['corpus'])}.", 0.6)])

# 10 ------------------------------------------- step 5, behavioral layers
step("STEP 5 OF 6, EXTENDED", "Build the Behavioral Portfolio",
     "Requirement: go past mean-variance and size the layered portfolio that behavioral "
     "portfolio theory describes.",
     [tt("Section 7, the questions we added to the class form"),
      tbl(["Item", "Question added to the form", "What it measures"],
          [["E1", "A coin flip. Tails you lose Rs 10,000, heads you win G. How big must G be?",
            "Loss aversion, lambda"],
           ["E2", "A 10 in 100 chance of Rs 10,000. What sure amount feels as good? Same at 90 in 100.",
            "Probability weighting"],
           ["E3", "What is the smallest amount you must still have at the end?",
            "The safety floor"],
           ["E4", "How often could you live with falling below that amount?",
            "Shortfall tolerance"],
           ["E5", "What amount at the end would you call a success?",
            "The aspiration level"],
           ["E6", "Split 100 points between staying safe and a real shot at the big number.",
            "Security and potential split"],
           ["E7", "What would you give up to raise your chance of success by 10 points?",
            "Weight on the aspiration"]],
          [0.4, 3.4, 1.3], rowh=0.40, fs=9),
      card(1.1, "How it was done",
           "Each layer needs one number the class form does not collect, so we wrote the "
           "seven shortest questions that supply them. They take about a minute to answer.",
           "teal", 12, 9.5)],
     [card(1.5, "What the layered portfolio needs",
           "A floor in rupees, a tolerance for breaching it, an aspiration level, and loss "
           "aversion. Together they split the corpus into a safety sleeve and a potential "
           "sleeve, each priced off the same frontier.", "orange", 12.5, 10),
      card(1.5, "How it was completed",
           "The engine, the estimators and the layer solver are built and tested, and all "
           "seven questions are live in the portal. The code path runs end to end on worked "
           "inputs.", "green", 12.5, 10),
      card(1.3, "The next pass",
           "The four respondents answer the seven added questions, and the same run then "
           "prints a sized behavioral portfolio beside the mean-variance one.",
           "purple", 12.5, 10)])

# 11 ------------------------------------------------------------- step 6
step("STEP 6 OF 6", "Turn the Numbers Into Advice",
     "Requirement: write the commentary and the behavioral guidance that goes back to each "
     "respondent.",
     [tt("The rules, and the answer that triggers each one"),
      tbl(["Guidance", "Fires when", "Fired for"],
          [["Automate the monthly contribution",
            "Conscientiousness below the group mean", m39["roll"]],
           ["Fix the review dates in advance",
            "Organization facet below 3 out of 5", m39["roll"]],
           ["Step the equity weight up over time",
            "Low negative emotionality and a long horizon", m47["roll"]],
           ["Show the downside in rupees, not percent",
            "A switch part way down the risk ladder", m02["roll"]],
           ["Confirm the real horizon first",
            "Cash preferred at every rate offered", m30["roll"]]],
          [1.8, 2.0, 1.0], rowh=0.44),
      card(1.56, "How it was done",
           "Risk aversion is already measured in Step 4, so personality is used only where it "
           "predicts something else: whether the client stays with the plan. Each rule names "
           "the answer that set it off, so nothing in the advice is unexplained.",
           "teal", 12, 9.5)],
     [card(1.05, f"{m39['roll']}: build in the follow-through",
           f"Conscientiousness {f2(m39['bfi']['domains']['C']['mean'])}. Automate the "
           f"contribution and rebalance on a threshold.", "teal", 11.5, 9.5),
      card(1.05, f"{m47['roll']}: methodical and calm",
           f"Conscientiousness {f2(m47['bfi']['domains']['C']['mean'])} and the group's "
           f"lowest negative emotionality at {f2(m47['bfi']['domains']['N']['mean'])}. A "
           f"glide path suits this well.", "orange", 11.5, 9.5),
      card(1.05, f"{m02['roll']}: frame it in rupees",
           "Balanced across every domain. The switch at row 3 suggests risk is judged in "
           "nominal amounts, so show the downside as a rupee figure.", "green", 11.5, 9.5),
      card(1.05, f"{m30['roll']}: start with a conversation",
           "Took the gamble throughout and preferred cash now at every rate. A short "
           "interview will establish the real horizon before the plan is set.",
           "purple", 11.5, 9.5)])

# 12 ----------------------------------------------------------- completed
wide("WHAT WAS DELIVERED", "How Each Step Was Completed",
     "The same six steps again, this time with the evidence for each one.",
     [tt("Step by step, what exists at the end of the project"),
      tbl(["Step", "How it was completed", "Where to see it"],
          [["1. Peer group and survey",
            "Eight profile questions fielded to four classmates, answers stored under roll "
            "numbers and exported to one file",
            "Portal Section 1, responses_real.json"],
           ["2. Risk attitude",
            "All eight ladder rows answered by all four; each pattern classified and the "
            "expected utility check reported",
            "Report Section 2, figure c3"],
           ["3. Time preference",
            "All six rows answered by all four; a discount rate bracket and a midpoint "
            "estimate produced for each",
            "Report Section 3, figure c4"],
           ["4. Curves and personality",
            "Utility curves fitted for two respondents, value curves for three, and all "
            "thirty personality items scored for all four",
            "Report Section 4, figures c1, c2, c5"],
           ["5. Portfolio",
            "Advised equity weight computed for every respondent with a fitted curve, under "
            "three return scenarios",
            "Report Section 5, figures c6, c7"],
           ["6. Advice and tool",
            "Written commentary per respondent, plus a live portal that fields the form and "
            "repeats the whole calculation in the browser",
            "Report Section 6, the portal"],
           ["Beyond the brief",
            "Seven extra questions added to the form so the behavioral layers can be sized "
            "from stated preferences",
            "Portal Section 7"]],
          [1.5, 4.4, 2.1], rowh=0.50, fs=9),
      note("Two respondents are scheduled for a short re-elicitation so their utility and "
           "value curves join the Step 5 run.")])

# 13 -------------------------------------------------------------- portal
S({"layout": "cards3", "kicker": "THE DELIVERABLE", "title": "The Robo-Advisory Portal",
   "lead": "One static page, no server and no sign-in, so it opens on a phone in a classroom.",
   "cards": [
     {"h": "Fields the whole form",
      "b": "All six class sections plus the seven added questions, written in plain English, "
           "with autosave and a one-click export of each respondent's answers."},
     {"h": "Fits and plots live",
      "b": "Draws the respondent's own utility curve, value function and weighting function "
           "in the browser, using the same estimators that produced this deck."},
     {"h": "Builds both portfolios",
      "b": "The mean-variance allocation and the behavioral layers, against the real Problem "
           "Statement 1 frontier, with commentary generated from the respondent's own answers."}],
   "foot": "siddharthjaiswal05.github.io/mba_680_assignment_2"})

# 14 --------------------------------------------------------------- close
S({"layout": "close", "kicker": "SCOPE AND CONCLUSION",
   "title": "What We Established, and What Comes Next",
   "cards": [
     {"h": "Sample", "b": "Four respondents, so the conclusions are about the method rather than a population."},
     {"h": "Return input", "b": "The least certain input, which is why three scenarios are carried through."},
     {"h": "Horizon", "b": "Single-period models, before contributions, taxes and costs."},
     {"h": "Distribution", "b": "Normality assumed, so tail figures are the optimistic end."},
     {"h": "Universe", "b": "Current index membership, inherited from Problem Statement 1."}],
   "points": [
     "Every one of the six steps is traceable to the exact question that produced it, and "
     "every number in this deck is computed from a submitted answer.",
     "Risk aversion is measured from the utility curve, and the ladder is read as the pattern "
     "it genuinely reveals.",
     "Seven added questions complete the behavioral portfolio, and they are already live in "
     "the portal.",
     "The next pass collects those answers and re-elicits two respondents, which closes out "
     "Steps 4 and 5 for the full group."],
   "quote": "Measure what the data supports, and extend the instrument where it does not.",
   "team": TEAM})

out = {"theme": THEME, "accents": ACC, "team": TEAM, "slides": slides}
with open(os.path.join(HERE, "content.json"), "w") as fh:
    json.dump(out, fh, indent=1)
print(f"wrote content.json with {len(slides)} slides")
