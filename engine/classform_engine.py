"""
MBA680 Steps 1 to 6, estimated from the class instrument.

Reads engine/responses_real.json (the fielded responses), estimates everything the
class form identifies, builds the Step 5 portfolios on the real Problem Statement 1
inputs, and writes outputs/classform.json plus the report figures.

Nothing is filled in for a respondent who did not answer. Where the instrument
cannot identify a parameter at all, that is recorded as a property of the
instrument rather than as missing data.

Run:  python classform_engine.py
"""
from __future__ import annotations
import json, math, os
import numpy as np
from scipy import optimize, stats

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.ticker import PercentFormatter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "outputs"); os.makedirs(OUT, exist_ok=True)
FIG = os.path.abspath(os.path.join(HERE, "..", "figures")); os.makedirs(FIG, exist_ok=True)

# ---------------------------------------------------------------- PS1 inputs
RF = 0.0650
PS1 = {"gmv": {"mu": 0.1271, "sigma": 0.1403},
       "tangency": {"mu": 0.2493, "sigma": 0.1797},
       "max_return": {"mu": 0.2514, "sigma": 0.1878}}
EQUITY_PRIOR = 0.12
SCENARIOS = {"in_sample": 0.00, "base": 0.75, "prudent": 1.00}
ADVICE = "base"
FRONT_D = (PS1["tangency"]["mu"] - PS1["gmv"]["mu"]) ** 2 / \
          (PS1["tangency"]["sigma"] ** 2 - PS1["gmv"]["sigma"] ** 2)


def shrink(mu, sc):
    s = SCENARIOS[sc]
    return (1 - s) * mu + s * EQUITY_PRIOR


def engine(sc):
    mu = shrink(PS1["tangency"]["mu"], sc)
    return {"name": sc, "mu": mu, "sigma": PS1["tangency"]["sigma"],
            "sharpe": (mu - RF) / PS1["tangency"]["sigma"]}


def frontier_sigma(r):
    return math.sqrt(max(PS1["gmv"]["sigma"] ** 2 +
                         (r - PS1["gmv"]["mu"]) ** 2 / FRONT_D, 1e-12))


TIME_OFFERS = [(10500, 1), (11000, 1), (12000, 1), (13000, 1), (15000, 2), (18000, 2)]
RISK_CERTAIN = [10000, 12000, 15000, 20000, 25000, 30000, 40000, 50000]
DOM = {"E": "Extraversion", "A": "Agreeableness", "C": "Conscientiousness",
       "N": "Negative Emotionality", "O": "Open-Mindedness"}
NORM = {"E": (3.24, 0.77), "A": (3.65, 0.66), "C": (3.43, 0.74),
        "N": (2.93, 0.86), "O": (3.68, 0.68)}
FACETS = {"E": ["Sociability", "Assertiveness", "Energy Level"],
          "A": ["Compassion", "Respectfulness", "Trust"],
          "C": ["Organization", "Productiveness", "Responsibility"],
          "N": ["Anxiety", "Depression", "Emotional Volatility"],
          "O": ["Intellectual Curiosity", "Aesthetic Sensitivity", "Creative Imagination"]}


# ================================================================ estimation
def crra_u(w, g):
    w = np.asarray(w, float)
    return np.log(w) if abs(g - 1) < 1e-9 else (w ** (1 - g) - 1) / (1 - g)


def classify_risk(choices):
    """
    Every row offers a certain amount exactly equal to the gamble's expected value.
    Under expected utility a concave decision maker therefore takes the certain
    amount at EVERY row and a convex one takes the gamble at every row. No utility
    function over final wealth can generate a switch part way down the ladder, so a
    switch is classified and flagged rather than converted into a risk aversion
    number.
    """
    all_a = all(c == "A" for c in choices)
    all_b = all(c == "B" for c in choices)
    switches = sum(1 for i in range(1, len(choices)) if choices[i] != choices[i - 1])
    if all_a:
        return {"pattern": "Consistently risk averse", "eu_consistent": True, "switches": 0,
                "note": "Took the certain amount at every stake. This is the expected-utility-consistent "
                        "response for any concave utility function."}
    if all_b:
        return {"pattern": "Consistently risk seeking", "eu_consistent": True, "switches": 0,
                "note": "Took the gamble at every stake, consistent with a convex utility function throughout."}
    first = choices.index("B") if choices[0] == "A" else choices.index("A")
    direction = ("risk averse at low stakes and risk seeking at high stakes" if choices[0] == "A"
                 else "risk seeking at low stakes and risk averse at high stakes")
    return {"pattern": direction[0].upper() + direction[1:], "eu_consistent": False,
            "switches": switches, "switch_row": first + 1,
            "note": f"Switched at R{first + 1}. Because every row is expected-value neutral, no utility "
                    "function over final wealth can produce a switch. This is a direct violation of "
                    "expected utility, and it is what prospect theory predicts once outcomes are coded "
                    "as gains and losses against a reference point that moves with the stake."}


def bracket_discount(choices):
    rows = sorted(((fv / 10000) ** (1 / t) - 1, choices[i] == "delayed")
                  for i, (fv, t) in enumerate(TIME_OFFERS))
    acc = [r for r, w in rows if w]
    rej = [r for r, w in rows if not w]
    lo = max(rej) if rej else 0.0
    hi = min(acc) if acc else float("inf")
    consistent = lo <= hi + 1e-12
    point = lo if not math.isfinite(hi) else (lo + hi) / 2
    if not acc:
        note = f"Never accepted a delay, so the implied rate is above {lo:.1%} a year."
    elif consistent:
        note = f"Rejected up to {lo:.1%} and accepted from {hi:.1%}, a consistent bracket."
    else:
        note = (f"Rejected an offer of {lo:.1%} while accepting one of {hi:.1%}, so the answers are "
                "mildly non-monotonic. Reported as an approximate midpoint rather than a hard interval.")
    return {"lo": lo, "hi": hi if math.isfinite(hi) else None, "consistent": consistent,
            "point": point, "note": note}


def fit_utility(xs, ps, A, B):
    """
    Probability equivalence, exactly as the Week 2 to 3 lecture sets it out: with
    U(A)=0 and U(B)=1, the probability that leaves a certain X indifferent to the
    gamble IS U(X). Two curves are fitted to the same points, the log form the
    lecture suggests and a one-parameter CRRA form. The CRRA parameter is what the
    portfolio step needs, because it is exactly the A in U = E(r) - 0.5*A*sigma^2.

    Wealth is normalised by A first. The probability equivalence is a ratio of
    utility differences and CRRA scales those by a common factor, so normalising
    changes nothing while keeping the powers inside floating-point range. At rupee
    scale W^(1-g) underflows once g passes about six, which silently collapses the
    denominator.
    """
    if not xs:
        return None
    b = B / A
    xn = np.array(xs, float) / A
    ps = np.array(ps, float)

    def pred(g):
        return (crra_u(xn, g) - crra_u(1.0, g)) / (crra_u(b, g) - crra_u(1.0, g))

    res = optimize.least_squares(lambda g: pred(float(g[0])) - ps, x0=[1.0],
                                 bounds=([-0.9], [15.0]))
    g = float(res.x[0])
    r = pred(g) - ps
    sst = float(np.sum((ps - ps.mean()) ** 2))
    log_pred = np.log(xn) / np.log(b)
    return {"gamma": g, "rmse": float(np.sqrt(np.mean(r ** 2))),
            "r2": 1 - float(np.sum(r ** 2)) / sst if sst > 0 else None,
            "log_rmse": float(np.sqrt(np.mean((log_pred - ps) ** 2))),
            "at_bound": g > 14.5 or g < -0.85,
            "A": A, "B": B, "x": list(xs), "p": [float(v) for v in ps],
            "crra_pred": [float(v) for v in pred(g)],
            "log_pred": [float(v) for v in log_pred],
            "concave": g > 0.05}


def fit_value(gain_p, loss_p, mixed_gain=None):
    """
    Each row offers a certain amount against a gamble paying double or nothing, so
    at indifference v(X) = p*v(2X). With v(x) = x^alpha the certain amount cancels:

        X^alpha = p (2X)^alpha  =>  p = (1/2)^alpha  =>  alpha = -log2(p)

    So V1, V2 and V3 are the SAME question asked at three sizes, not three separate
    identifications, and a power value function predicts an identical answer to all
    three. The spread across them is therefore a measure of response noise and is
    reported rather than averaged away.

    Loss aversion cannot be recovered from these six rows at all. Each row is
    internally scaled, so the gain rows fix the gain curvature and the loss rows fix
    the loss curvature, but nothing ties the two heights together.
    """
    def est(ps):
        if not ps:
            return None
        each = [-math.log2(p) for p in ps]
        m = sum(each) / len(each)
        return {"est": m, "each": each, "spread": max(each) - min(each),
                "sd": float(np.std(each))}

    a, b = est(gain_p), est(loss_p)
    lam, note = None, ("Not identified. The class form has no gamble with a gain on one side and a "
                       "loss on the other, and each of the six rows is internally scaled, so the "
                       "heights of the two limbs are never compared.")
    if a and b and mixed_gain:
        abar = 0.5 * (a["est"] + b["est"])
        lam = (mixed_gain / 10000.0) ** abar
        note = f"Estimated from the added mixed gamble at the common curvature {abar:.2f}."
    return {"alpha": a["est"] if a else None, "beta": b["est"] if b else None,
            "alpha_detail": a, "beta_detail": b, "lambda": lam, "lambda_note": note}


def score_bfi(facets):
    out = {"domains": {}, "facets": {}}
    for d, vals in facets.items():
        m = float(np.mean(vals))
        z = (m - NORM[d][0]) / NORM[d][1]
        out["domains"][d] = {"label": DOM[d], "mean": m, "z": z,
                             "pct": float(stats.norm.cdf(z) * 100)}
        out["facets"][d] = [{"facet": f, "mean": float(v)} for f, v in zip(FACETS[d], vals)]
    return out


def eut_portfolio(gamma, eng, cap=1.0):
    y_star = (eng["mu"] - RF) / (gamma * eng["sigma"] ** 2)
    y = min(max(y_star, 0.0), cap)
    mu, sig = RF + y * (eng["mu"] - RF), y * eng["sigma"]
    return {"y_star": y_star, "y": y, "capped": y_star > cap, "mu": mu, "sigma": sig,
            "utility": mu - 0.5 * gamma * sig ** 2,
            "equity_inr_per_lakh": y * 100000}


# ==================================================================== run
def analyse(r):
    out = {"roll": r["roll"], "age": r["age"], "corpus": r["corpus_inr"],
           "experience": r["experience"], "horizon": r["horizon_years"], "goal": r["goal"]}
    out["risk"] = classify_risk(r["risk_choices"])
    out["time"] = bracket_discount(r["time_choices"])
    out["bfi"] = score_bfi(r["bfi_facets"])
    out["utility"] = (fit_utility(r["util_x"], r["util_p"], r["util_lo"], r["util_hi"])
                      if r["util_x"] and r["util_hi"] else None)
    out["utility_invalid"] = r["util_invalid"]
    out["value"] = (fit_value(r["vf_gain_p"], r["vf_loss_p"], r["vf_mixed_gain"])
                    if r["vf_gain_p"] else None)
    out["value_invalid"] = r["vf_invalid"]
    out["w0"] = r["vf_reference_w0"]

    if out["utility"]:
        g = max(out["utility"]["gamma"], 0.2)
        out["gamma_used"] = g
        out["portfolios"] = {sc: eut_portfolio(g, engine(sc)) for sc in SCENARIOS}
    else:
        out["gamma_used"] = None
        out["portfolios"] = None
        out["portfolio_blocked"] = ("No usable utility curve, so relative risk aversion is not "
                                    "identified and y* cannot be computed. The risk ladder cannot "
                                    "substitute for it, because every rung is expected-value neutral.")
    out["bpt_blocked"] = ("The class form does not ask for a floor, a tolerance for breaching it, or "
                          "an aspiration level, so the behavioral layers cannot be sized from stated "
                          "preferences. Loss aversion is also unidentified without a mixed gamble.")
    return out


def main():
    data = json.load(open(os.path.join(HERE, "responses_real.json")))
    res = [analyse(r) for r in data["respondents"]]
    bundle = {"constants": {"rf": RF, "ps1": PS1, "equity_prior": EQUITY_PRIOR,
                            "scenarios": SCENARIOS, "advice": ADVICE},
              "engines": {sc: engine(sc) for sc in SCENARIOS},
              "not_asked": data["_not_asked"], "results": res}

    def clean(o):
        if isinstance(o, float):
            return None if (math.isnan(o) or math.isinf(o)) else o
        if isinstance(o, dict):
            return {k: clean(v) for k, v in o.items()}
        if isinstance(o, (list, tuple)):
            return [clean(v) for v in o]
        if isinstance(o, (np.floating, np.integer)):
            return clean(float(o))
        if isinstance(o, np.bool_):
            return bool(o)
        return o

    json.dump(clean(bundle), open(os.path.join(OUT, "classform.json"), "w"),
              indent=1, allow_nan=False)

    print("Respondent summary")
    for r in res:
        u = r["utility"]; v = r["value"]; pf = r["portfolios"]
        g = f"{u['gamma']:.2f}" if u else "n/a"
        al = f"{v['alpha']:.2f}" if v and v["alpha"] else "n/a"
        be = f"{v['beta']:.2f}" if v and v["beta"] else "n/a"
        y = f"{pf[ADVICE]['y']:.0%}" if pf else "blocked"
        eu = "EU ok " if r["risk"]["eu_consistent"] else "EU VIOL"
        print(f"  {r['roll']}  gamma {g:>6s}   alpha {al:>5s}   beta {be:>5s}"
              f"   rate {r['time']['point']:6.1%}   {eu}   y* {y:>8s}")
    print(f"\nwrote {OUT}/classform.json")
    make_figures(res)


# ==================================================================== figures
S = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"]
INK, INK2, INK3, GRID, SURF = "#0b0b0b", "#52514e", "#8a8985", "#e8e7e3", "#ffffff"
plt.rcParams.update({
    "figure.facecolor": SURF, "axes.facecolor": SURF, "font.family": "DejaVu Sans",
    "font.size": 9, "axes.edgecolor": GRID, "axes.labelcolor": INK2, "axes.titlecolor": INK,
    "axes.titlesize": 10.5, "axes.titleweight": "semibold", "axes.titlelocation": "left",
    "axes.grid": True, "axes.axisbelow": True, "grid.color": GRID, "grid.linewidth": 0.7,
    "xtick.color": INK2, "ytick.color": INK2, "xtick.labelsize": 8.5, "ytick.labelsize": 8.5,
    "legend.frameon": False, "legend.fontsize": 8.5, "lines.linewidth": 2.0,
    "savefig.dpi": 200, "savefig.bbox": "tight"})


def _clean(ax):
    ax.spines["top"].set_visible(False); ax.spines["right"].set_visible(False)
    for s in ("left", "bottom"):
        ax.spines[s].set_color(GRID)


def _save(fig, name):
    fig.savefig(os.path.join(FIG, name)); plt.close(fig); print("  " + name)


def make_figures(res):
    print("\nFigures")
    col = {r["roll"]: S[i] for i, r in enumerate(res)}

    # 1. utility curves
    withu = [r for r in res if r["utility"]]
    fig, axes = plt.subplots(1, max(len(withu), 1), figsize=(3.4 * max(len(withu), 1), 3.3),
                             squeeze=False)
    for ax, r in zip(axes[0], withu):
        u = r["utility"]; A, B = u["A"], u["B"]; b = B / A
        w = np.linspace(A, B, 200)
        f = lambda x, g: (crra_u(x, g) - crra_u(1.0, g)) / (crra_u(b, g) - crra_u(1.0, g))
        ax.plot(w, f(w / A, u["gamma"]), color=col[r["roll"]],
                label=f"fitted, A = {u['gamma']:.2f}")
        ax.plot(w, np.log(w / A) / np.log(b), color=INK3, ls=(0, (5, 3)), lw=1.5, label="log curve")
        ax.plot([A, B], [0, 1], color=INK3, lw=1.0, ls=(0, (2, 3)))
        ax.scatter(u["x"], u["p"], s=38, color=col[r["roll"]], zorder=5,
                   edgecolor=SURF, linewidth=1.4, label="elicited")
        ax.set_title(f"Roll {r['roll']}", fontsize=9.5)
        ax.set_xlabel("Amount (Rs)"); ax.legend(loc="lower right", fontsize=7.5)
        ax.xaxis.set_major_formatter(lambda v, _: f"{v/1000:.0f}k")
        _clean(ax)
    axes[0][0].set_ylabel("Utility U(W)")
    fig.suptitle("Elicited utility curves, with the log curve the lecture suggests",
                 x=0.02, ha="left", fontsize=10.5, weight="semibold", color=INK)
    fig.tight_layout(rect=(0, 0, 1, 0.9))
    _save(fig, "c1_utility.png")

    # 2. value functions
    withv = [r for r in res if r["value"]]
    fig, ax = plt.subplots(figsize=(6.2, 4.0))
    x = np.linspace(-1, 1, 401)
    for r in withv:
        v = r["value"]
        y = np.where(x >= 0, np.abs(x) ** v["alpha"], -np.abs(x) ** v["beta"])
        ax.plot(x, y, color=col[r["roll"]],
                label=f"{r['roll']}   a {v['alpha']:.2f}   b {v['beta']:.2f}")
    ax.axhline(0, color=INK3, lw=1.0); ax.axvline(0, color=INK3, lw=1.0)
    ax.plot([-1, 1], [-1, 1], color=INK3, lw=1.0, ls=(0, (4, 3)))
    ax.set_xlabel("Gain or loss, scaled to the reference amount")
    ax.set_ylabel("Value v(x), heights not comparable")
    ax.set_title("Fitted value functions, with loss aversion left unidentified")
    ax.annotate("the two limbs cannot be scaled against each other\n"
                "without a mixed gain-and-loss gamble",
                xy=(0, 0), xytext=(-0.95, 0.55), fontsize=8, color=INK2,
                arrowprops=dict(arrowstyle="-", color=INK3, lw=0.8,
                                connectionstyle="arc3,rad=0.2"))
    ax.legend(loc="lower right"); _clean(ax)
    _save(fig, "c2_value.png")

    # 3. risk ladder patterns
    fig, ax = plt.subplots(figsize=(6.4, 2.9))
    for i, r in enumerate(res):
        ch = json.load(open(os.path.join(HERE, "responses_real.json")))["respondents"][i]["risk_choices"]
        for j, c in enumerate(ch):
            ax.scatter(j + 1, i, s=120, marker="s",
                       color=(col[r["roll"]] if c == "B" else "none"),
                       edgecolor=col[r["roll"]], linewidth=1.6)
        if not r["risk"]["eu_consistent"]:
            ax.axvline(r["risk"]["switch_row"] - 0.5, color=INK3, lw=1.0, ls=(0, (3, 3)))
    ax.set_yticks(range(len(res)))
    ax.set_yticklabels([r["roll"] for r in res], fontsize=8.5)
    ax.set_xticks(range(1, 9))
    ax.set_xticklabels([f"R{i}\n{c//1000}k" for i, c in enumerate(RISK_CERTAIN, 1)], fontsize=7.5)
    ax.set_xlabel("Filled means the gamble was chosen, hollow means the certain amount")
    ax.set_title("Every rung is expected-value neutral, so a switch cannot come from any utility function")
    ax.set_ylim(-0.7, len(res) - 0.3); ax.grid(axis="y", visible=False); _clean(ax)
    _save(fig, "c3_risk_ladder.png")

    # 4. discount brackets
    fig, ax = plt.subplots(figsize=(6.2, 2.9))
    rates = sorted(((fv / 10000) ** (1 / t) - 1) for fv, t in TIME_OFFERS)
    for rr in rates:
        ax.axvline(rr, color=GRID, lw=1.0)
    for i, r in enumerate(res):
        t = r["time"]
        hi = t["hi"] if t["hi"] is not None else max(rates) * 1.18
        ax.plot([t["lo"], hi], [i, i], color=col[r["roll"]], lw=7, solid_capstyle="butt",
                alpha=0.85 if t["consistent"] else 0.45)
        ax.scatter([t["point"]], [i], s=40, color=INK, zorder=5, marker="|", linewidth=2)
        if not t["consistent"]:
            ax.annotate("answers overlap", xy=(t["point"], i), xytext=(6, 9),
                        textcoords="offset points", fontsize=7.5, color=INK2)
    ax.set_yticks(range(len(res)))
    ax.set_yticklabels([r["roll"] for r in res], fontsize=8.5)
    ax.xaxis.set_major_formatter(PercentFormatter(1.0, decimals=0))
    ax.set_xlabel("Implied annual discount rate. Grey lines are the six offers.")
    ax.set_title("What the six now-or-later rows pin down")
    ax.set_ylim(-0.7, len(res) - 0.3); ax.grid(axis="y", visible=False); _clean(ax)
    _save(fig, "c4_discount.png")

    # 5. personality
    fig, ax = plt.subplots(figsize=(6.6, 3.4))
    doms = ["E", "A", "C", "N", "O"]
    xs = np.arange(len(doms)); w = 0.19
    for i, r in enumerate(res):
        ax.bar(xs + (i - 1.5) * w, [r["bfi"]["domains"][d]["mean"] for d in doms], w - 0.02,
               color=col[r["roll"]], label=r["roll"])
    for i, d in enumerate(doms):
        ax.scatter([i], [NORM[d][0]], s=44, color=INK, marker="_", linewidth=2.2, zorder=6)
    ax.scatter([], [], s=44, color=INK, marker="_", linewidth=2.2, label="average")
    ax.set_xticks(xs); ax.set_xticklabels([DOM[d].replace(" ", "\n") for d in doms], fontsize=8.5)
    ax.set_ylabel("Score, 1 to 5"); ax.set_ylim(1, 5)
    ax.set_title("Personality profile of the four respondents")
    ax.legend(loc="upper center", ncol=5, fontsize=8); ax.grid(axis="x", visible=False); _clean(ax)
    _save(fig, "c5_personality.png")

    # 6. portfolios on the CAL
    fig, ax = plt.subplots(figsize=(6.6, 4.0))
    eng = engine(ADVICE)
    rs = np.linspace(PS1["gmv"]["mu"], PS1["max_return"]["mu"], 200)
    ax.plot([frontier_sigma(r) for r in rs], [shrink(r, ADVICE) for r in rs],
            color=INK3, lw=1.6, label="PS1 equity frontier")
    sx = np.linspace(0, 0.20, 50)
    ax.plot(sx, RF + eng["sharpe"] * sx, color=INK, lw=1.6, ls=(0, (5, 3)),
            label="capital allocation line")
    ax.scatter([0], [RF], s=38, color=INK, zorder=6)
    ax.annotate("risk free 6.50%", xy=(0, RF), xytext=(12, -13),
                textcoords="offset points", fontsize=8, color=INK2)
    for r in res:
        if not r["portfolios"]:
            continue
        p = r["portfolios"][ADVICE]
        ax.scatter([p["sigma"]], [p["mu"]], s=64, color=col[r["roll"]], zorder=7,
                   edgecolor=SURF, linewidth=1.6)
        ax.annotate(f"{r['roll']}\nA = {r['gamma_used']:.2f}, y* = {p['y']:.0%}",
                    xy=(p["sigma"], p["mu"]), xytext=(8, -16), textcoords="offset points",
                    fontsize=8, color=col[r["roll"]], weight="bold")
    blocked = [r["roll"] for r in res if not r["portfolios"]]
    if blocked:
        ax.annotate("No point for " + " or ".join(blocked) +
                    ",\nwhose utility data could not be used",
                    xy=(0.012, 0.155), fontsize=8, color=INK2)
    ax.set_xlabel("Annualised volatility"); ax.set_ylabel("Expected annual return")
    ax.set_title("Step 5: where each usable respondent sits on the capital allocation line")
    ax.xaxis.set_major_formatter(PercentFormatter(1.0, decimals=0))
    ax.yaxis.set_major_formatter(PercentFormatter(1.0, decimals=0))
    ax.set_xlim(0, 0.205); ax.set_ylim(0.055, 0.175)
    ax.legend(loc="lower right"); _clean(ax)
    _save(fig, "c6_portfolios.png")

    # 7. what the three input sets do
    fig, ax = plt.subplots(figsize=(6.4, 3.4))
    names = list(SCENARIOS)
    xs = np.arange(len(names)); w = 0.35
    usable = [r for r in res if r["portfolios"]]
    for i, r in enumerate(usable):
        vals = [r["portfolios"][s]["y_star"] for s in names]
        off = (i - (len(usable) - 1) / 2) * w
        ax.bar(xs + off, vals, w - 0.02, color=col[r["roll"]],
               label=f"{r['roll']}, A = {r['gamma_used']:.2f}")
        for j, v in enumerate(vals):
            ax.text(j + off, v + 0.12, f"{v:.1f}x", ha="center", fontsize=8, color=INK2)
    ax.axhline(1.0, color=INK, lw=1.4, ls=(0, (5, 3)))
    ax.annotate("no-borrowing cap, where both respondents actually end up",
                xy=(1.9, 1.0), xytext=(0, 9), textcoords="offset points",
                fontsize=8, color=INK2, ha="right")
    ax.set_xticks(xs)
    ax.set_xticklabels(["PS1 as reported\nSharpe 1.03", "Base case\nSharpe 0.49",
                        "Stress case\nSharpe 0.31"], fontsize=8.5)
    ax.set_ylabel("Unconstrained y*, as a multiple of the corpus")
    ax.set_title("Both respondents want leverage under every input set, so the cap is what binds")
    ax.legend(loc="upper right"); ax.grid(axis="x", visible=False); _clean(ax)
    _save(fig, "c7_scenarios.png")


if __name__ == "__main__":
    main()
