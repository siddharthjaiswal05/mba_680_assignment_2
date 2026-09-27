"""
Figures for the MBA680 Problem Statement 2 report.

Reads outputs/analysis.json and writes PNGs to ../figures. Colours are the
validated categorical palette, assigned in fixed slot order and never cycled, so
the same member is the same colour in every chart.
"""
import json
import math
import os

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.ticker import FuncFormatter, PercentFormatter
from scipy import stats

import robo_engine as R

HERE = os.path.dirname(os.path.abspath(__file__))
FIG = os.path.abspath(os.path.join(HERE, "..", "figures"))
os.makedirs(FIG, exist_ok=True)

SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300",
          "#4a3aa7", "#e34948"]
INK, INK2, INK3 = "#0b0b0b", "#52514e", "#8a8985"
GRID, SURFACE = "#e8e7e3", "#ffffff"

plt.rcParams.update({
    "figure.facecolor": SURFACE, "axes.facecolor": SURFACE,
    "font.family": "DejaVu Sans", "font.size": 9,
    "axes.edgecolor": GRID, "axes.labelcolor": INK2, "axes.titlecolor": INK,
    "axes.titlesize": 10.5, "axes.titleweight": "semibold", "axes.titlelocation": "left",
    "axes.labelsize": 9, "axes.grid": True, "axes.axisbelow": True,
    "grid.color": GRID, "grid.linewidth": 0.7,
    "xtick.color": INK2, "ytick.color": INK2,
    "xtick.labelsize": 8.5, "ytick.labelsize": 8.5,
    "legend.frameon": False, "legend.fontsize": 8.5, "legend.labelcolor": INK2,
    "lines.linewidth": 2.0, "savefig.dpi": 200, "savefig.bbox": "tight",
})


def clean(ax, top=False, right=False):
    ax.spines["top"].set_visible(top)
    ax.spines["right"].set_visible(right)
    for s in ("left", "bottom"):
        ax.spines[s].set_color(GRID)


def save(fig, name):
    p = os.path.join(FIG, name)
    fig.savefig(p)
    plt.close(fig)
    print("  " + name)
    return p


B = json.load(open(os.path.join(HERE, "outputs", "analysis.json")))
RES = B["results"]
ADV = B["constants"]["advice_scenario"]
IDS = [r["member"]["member_id"] for r in RES]
COL = {m: SERIES[i] for i, m in enumerate(IDS)}


# ---------------------------------------------------------------- 1. utility
def fig_utility():
    fig, ax = plt.subplots(figsize=(6.4, 4.0))
    w = np.linspace(0.85, 1.60, 300)
    for r in RES:
        g = r["fitted"]["risk_aversion"]["gamma"]
        u = R.crra_u(w, g)
        lo, hi = R.crra_u(0.85, g), R.crra_u(1.60, g)
        ax.plot(w, (u - lo) / (hi - lo), color=COL[r["member"]["member_id"]],
                label=f"{r['member']['member_id']}  $\\gamma$ = {g:.2f}")
    ax.plot([0.85, 1.60], [0, 1], color=INK3, lw=1.2, ls=(0, (4, 3)), zorder=1)
    ax.annotate("risk neutral", xy=(1.40, 0.733), xytext=(1.40, 0.62),
                color=INK3, fontsize=8, ha="center")
    ax.set_xlabel("Terminal wealth, as a multiple of the corpus")
    ax.set_ylabel("Normalised utility  U(W)")
    ax.set_title("Fitted von Neumann-Morgenstern utility functions")
    ax.set_xlim(0.85, 1.60)
    ax.set_ylim(0, 1.02)
    ax.legend(loc="lower right", ncol=2)
    clean(ax)
    return save(fig, "01_utility_functions.png")


# ------------------------------------------------------------ 2. value function
def fig_value():
    fig, ax = plt.subplots(figsize=(6.4, 4.2))
    x = np.linspace(-1.0, 1.0, 401)
    for r in RES:
        v = r["fitted"]["value"]
        y = np.where(x >= 0, np.abs(x) ** v["alpha"],
                     -v["lambda"] * np.abs(x) ** v["beta"])
        ax.plot(x, y, color=COL[r["member"]["member_id"]],
                label=f"{r['member']['member_id']}  $\\lambda$ = {v['lambda']:.2f}")
    ax.axhline(0, color=INK3, lw=1.0)
    ax.axvline(0, color=INK3, lw=1.0)
    ax.plot([-1, 1], [-1, 1], color=INK3, lw=1.0, ls=(0, (4, 3)), zorder=1)
    ax.set_xlabel("Outcome, as a fraction of the corpus, measured from the reference point")
    ax.set_ylabel("Value  v(x)")
    ax.set_title("Fitted prospect-theory value functions")
    ax.annotate("the kink at the origin, not the curvature,\nis what makes fair bets unattractive",
                xy=(0, 0), xytext=(0.06, -2.4), color=INK2, fontsize=8,
                arrowprops=dict(arrowstyle="-", color=INK3, lw=0.8,
                                connectionstyle="arc3,rad=-0.25"))
    ax.set_xlim(-1, 1)
    ax.legend(loc="upper left", ncol=2)
    clean(ax)
    return save(fig, "02_value_functions.png")


# --------------------------------------------------------- 3. weighting function
def fig_weighting():
    fig, ax = plt.subplots(figsize=(5.6, 4.6))
    p = np.linspace(0.001, 0.999, 400)
    for r in RES:
        g = r["fitted"]["weighting"]["gamma_w"]
        ax.plot(p, R.kt_weight(p, g), color=COL[r["member"]["member_id"]],
                label=f"{r['member']['member_id']}  $\\gamma$ = {g:.2f}")
        obs = r["fitted"]["weighting"]["w_observed"]
        ax.scatter([float(k) for k in obs], list(obs.values()), s=26, zorder=5,
                   color=COL[r["member"]["member_id"]],
                   edgecolor=SURFACE, linewidth=1.5)
    ax.plot([0, 1], [0, 1], color=INK3, lw=1.2, ls=(0, (4, 3)), zorder=1)
    ax.set_xlabel("Stated probability  p")
    ax.set_ylabel("Decision weight  w(p)")
    ax.set_title("Fitted probability weighting functions")
    ax.text(0.50, 0.93, "dots are the two elicited points;\nthe curve is the fitted one-parameter form",
            transform=ax.transAxes, fontsize=8, color=INK2, va="top")
    ax.text(0.06, 0.30, "small probabilities\noverweighted", fontsize=8, color=INK2)
    ax.text(0.62, 0.52, "large probabilities\nunderweighted", fontsize=8, color=INK2)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.set_aspect("equal")
    ax.legend(loc="lower right", ncol=2)
    clean(ax)
    return save(fig, "03_weighting_functions.png")


# ------------------------------------------------- 4. frontier, CAL, portfolios
def fig_frontier():
    fig, ax = plt.subplots(figsize=(6.8, 4.4))
    coef = B["frontier"]
    eng = B["engines"][ADV]

    # Everything on this chart is drawn on the base-case inputs. Shrinking the
    # frontier means shrinking each expected return; the volatilities are left
    # alone, because they are the part of the estimate that is actually reliable.
    rs = np.linspace(coef["r_gmv"], R.PS1["max_return"]["mu"], 200)
    ss = np.array([R.frontier_sigma(r, coef) for r in rs])
    rs_adj = np.array([R.shrink_mu(r, ADV) for r in rs])
    ax.plot(ss, rs_adj, color=INK3, lw=1.7, label="PS1 equity frontier")

    sx = np.linspace(0, 0.20, 50)
    ax.plot(sx, R.RF + eng["sharpe"] * sx, color=INK, lw=1.6, ls=(0, (5, 3)),
            label="Capital allocation line")
    ax.scatter([0], [R.RF], s=38, color=INK, zorder=6)
    ax.annotate("risk-free 6.50%", xy=(0, R.RF), xytext=(14, -14),
                textcoords="offset points", fontsize=8, color=INK2)

    t_sig, t_mu = R.PS1["tangency"]["sigma"], R.shrink_mu(R.PS1["tangency"]["mu"], ADV)
    ax.scatter([t_sig], [t_mu], s=62, color=INK, zorder=8, marker="D")
    ax.annotate("PS1 60-stock portfolio, fully invested\n"
                f"{t_mu:.2%} return at {t_sig:.2%} volatility",
                xy=(t_sig, t_mu), xytext=(0.152, 0.0705), fontsize=8, color=INK2,
                ha="center", va="bottom",
                arrowprops=dict(arrowstyle="-", color=INK3, lw=0.8, alpha=0.7,
                                shrinkB=8, connectionstyle="arc3,rad=0.2"))

    # Several members are fully invested, so their EUT points coincide exactly.
    # Label the group once rather than stacking identical labels on one dot.
    groups = {}
    for r in RES:
        s = r["scenarios"][ADV]
        key = (round(s["eut"]["sigma"], 4), round(s["eut"]["mu"], 4))
        groups.setdefault(key, []).append(r["member"]["member_id"])

    for r in RES:
        mid = r["member"]["member_id"]
        s = r["scenarios"][ADV]
        ax.plot([s["eut"]["sigma"], s["bpt_ma"]["aggregate"]["sigma"]],
                [s["eut"]["mu"], s["bpt_ma"]["aggregate"]["mu"]],
                color=COL[mid], lw=1.0, alpha=0.5, zorder=4)
        ax.scatter([s["bpt_ma"]["aggregate"]["sigma"]], [s["bpt_ma"]["aggregate"]["mu"]],
                   s=58, color=COL[mid], zorder=7, marker="s",
                   edgecolor=SURFACE, linewidth=1.6)
        ax.scatter([s["eut"]["sigma"]], [s["eut"]["mu"]], s=62, color=COL[mid],
                   zorder=7, edgecolor=SURFACE, linewidth=1.6)

    for (sg, mu), ids in groups.items():
        ax.annotate(", ".join(sorted(ids)), xy=(sg, mu), xytext=(6, 5),
                    textcoords="offset points", fontsize=8.5,
                    color=COL[sorted(ids)[0]] if len(ids) == 1 else INK,
                    weight="bold")

    ax.scatter([], [], s=62, color=INK2, label="EUT complete portfolio")
    ax.scatter([], [], s=58, color=INK2, marker="s", label="BPT layered portfolio")
    ax.set_xlabel("Annualised volatility")
    ax.set_ylabel("Expected annual return")
    ax.set_title("Every layered portfolio sits below the line the same risk could have bought")
    ax.xaxis.set_major_formatter(PercentFormatter(1.0, decimals=0))
    ax.yaxis.set_major_formatter(PercentFormatter(1.0, decimals=0))
    ax.set_xlim(0, 0.205)
    ax.set_ylim(0.055, 0.175)
    ax.legend(loc="upper left", ncol=2, columnspacing=1.2)
    clean(ax)
    return save(fig, "04_frontier_and_portfolios.png")


# ------------------------------------------------------- 5. EUT vs BPT exposure
def fig_exposure():
    fig, ax = plt.subplots(figsize=(6.4, 3.8))
    n = len(RES)
    xs = np.arange(n)
    w = 0.34
    eut = [r["scenarios"][ADV]["eut"]["y_advised"] for r in RES]
    spa = [r["scenarios"][ADV]["bpt_sa"]["optimum"]["y"] for r in RES]
    ma = [1.0 - r["scenarios"][ADV]["bpt_ma"]["layers"][0]["weight"] for r in RES]

    ax.bar(xs - w / 2, eut, w - 0.02, color=SERIES[0], label="EUT, mean-variance y*")
    ax.bar(xs + w / 2, spa, w - 0.02, color=SERIES[1], label="BPT, SP/A optimum")
    ax.scatter(xs, ma, s=46, color=INK, zorder=6, marker="_", linewidth=2.4)
    ax.scatter([], [], s=46, color=INK, marker="_", linewidth=2.4,
               label="BPT layered, share outside the security layer")

    for i, (a, b) in enumerate(zip(eut, spa)):
        ax.text(i - w / 2, a + 0.02, f"{a:.0%}", ha="center", fontsize=8, color=INK2)
        ax.text(i + w / 2, b + 0.02, f"{b:.0%}", ha="center", fontsize=8, color=INK2)

    ax.set_xticks(xs)
    ax.set_xticklabels([f"{r['member']['member_id']}\n{r['member']['persona']}"
                        for r in RES], fontsize=8)
    ax.set_ylabel("Share of the corpus in the risky portfolio")
    ax.set_title("The two theories disagree about four of the six members")
    ax.yaxis.set_major_formatter(PercentFormatter(1.0, decimals=0))
    ax.set_ylim(0, 1.18)
    ax.legend(loc="upper left", ncol=1)
    ax.grid(axis="x", visible=False)
    clean(ax)
    return save(fig, "05_exposure_comparison.png")


# ------------------------------------------------------------ 6. the BPT pyramid
def fig_layers():
    fig, ax = plt.subplots(figsize=(6.4, 3.8))
    names = ["Security", "Income", "Aspiration"]
    cols = [SERIES[2], SERIES[0], SERIES[3]]
    xs = np.arange(len(RES))
    bottom = np.zeros(len(RES))
    for k, (nm, c) in enumerate(zip(names, cols)):
        vals = np.array([r["scenarios"][ADV]["bpt_ma"]["layers"][k]["weight"] for r in RES])
        ax.bar(xs, vals, 0.62, bottom=bottom, color=c, label=nm,
               edgecolor=SURFACE, linewidth=2.0)
        for i, (v, b) in enumerate(zip(vals, bottom)):
            if v > 0.07:
                ax.text(i, b + v / 2, f"{v:.0%}", ha="center", va="center",
                        fontsize=8.5, color="white", weight="bold")
        bottom += vals
    ax.set_xticks(xs)
    ax.set_xticklabels([f"{r['member']['member_id']}\n{r['member']['persona']}"
                        for r in RES], fontsize=8)
    ax.set_ylabel("Share of the corpus")
    ax.set_title("The layered portfolio: how much each goal absorbs")
    ax.yaxis.set_major_formatter(PercentFormatter(1.0, decimals=0))
    ax.set_ylim(0, 1.0)
    ax.legend(loc="upper center", ncol=3, bbox_to_anchor=(0.5, 1.0))
    ax.grid(axis="x", visible=False)
    clean(ax)
    return save(fig, "06_mental_account_layers.png")


# -------------------------------------------------- 7. cost of concentration
def fig_concentration():
    fig, ax = plt.subplots(figsize=(6.0, 3.8))
    for r in RES:
        cs = r["scenarios"][ADV]["concentration"]
        ax.plot([c["n"] for c in cs], [c["loss_bps"] for c in cs],
                color=COL[r["member"]["member_id"]], marker="o", markersize=5,
                markeredgecolor=SURFACE, markeredgewidth=1.2,
                label=r["member"]["member_id"])
    ax.set_xscale("log")
    ax.set_xticks([1, 2, 3, 5, 8, 12, 20])
    ax.get_xaxis().set_major_formatter(FuncFormatter(lambda v, _: f"{v:g}"))
    ax.invert_xaxis()
    ax.set_xlabel("Number of names in the aspiration layer (more concentrated to the right)")
    ax.set_ylabel("Basis points below the capital allocation line")
    ax.set_title("What the aspiration layer costs, as it gets more concentrated")
    ax.legend(loc="upper left", ncol=3)
    clean(ax)
    return save(fig, "07_concentration_cost.png")


# ----------------------------------------------------- 8. goal probabilities
def fig_goals():
    fig, axes = plt.subplots(1, 2, figsize=(7.2, 3.6), sharey=True)
    xs = np.arange(len(RES))
    w = 0.34
    for ax, key, title in (
        (axes[0], "p_aspiration", "Probability of reaching the aspiration"),
        (axes[1], "p_floor_breach_1y", "Probability of breaching the floor within a year"),
    ):
        a = [r["scenarios"][ADV]["eut"][key] for r in RES]
        b = [r["scenarios"][ADV]["bpt_ma"]["aggregate"][key] for r in RES]
        ax.bar(xs - w / 2, a, w - 0.02, color=SERIES[0], label="EUT")
        ax.bar(xs + w / 2, b, w - 0.02, color=SERIES[1], label="BPT layered")
        ax.set_xticks(xs)
        ax.set_xticklabels(IDS, fontsize=8.5)
        ax.set_title(title, fontsize=9.5)
        ax.yaxis.set_major_formatter(PercentFormatter(1.0, decimals=0))
        ax.grid(axis="x", visible=False)
        clean(ax)
    axes[1].axhline(0.10, color=INK3, lw=1.1, ls=(0, (4, 3)))
    axes[1].text(0.02, 0.115, "a 10% reference line", fontsize=8, color=INK2,
                 transform=axes[1].get_yaxis_transform())
    axes[0].set_ylabel("Probability")
    axes[0].legend(loc="upper right")
    fig.suptitle("The layered portfolio buys safety by giving up the aspiration",
                 x=0.055, ha="left", fontsize=10.5, weight="semibold", color=INK)
    fig.tight_layout(rect=(0, 0, 1, 0.93))
    return save(fig, "08_goal_probabilities.png")


# ------------------------------------------------------------- 9. personality
def fig_bfi():
    fig, ax = plt.subplots(figsize=(6.6, 3.6))
    doms = R.BFI_DOMAINS
    xs = np.arange(len(doms))
    w = 0.14
    for i, r in enumerate(RES):
        vals = [r["bfi"][d]["mean"] for d in doms]
        ax.bar(xs + (i - 2.5) * w, vals, w - 0.015,
               color=COL[r["member"]["member_id"]], label=r["member"]["member_id"])
    for i, d in enumerate(doms):
        ax.scatter([i], [R.BFI_NORM[d][0]], s=40, color=INK, marker="_",
                   linewidth=2.2, zorder=6)
    ax.scatter([], [], s=40, color=INK, marker="_", linewidth=2.2,
               label="norming-sample mean")
    ax.set_xticks(xs)
    ax.set_xticklabels([R.BFI_LABEL[d].replace(" ", "\n") for d in doms], fontsize=8.5)
    ax.set_ylabel("BFI-2-S domain score (1 to 5)")
    ax.set_title("Personality profile of the peer group")
    ax.set_ylim(1, 5)
    ax.legend(loc="upper center", ncol=7, fontsize=8, bbox_to_anchor=(0.5, 1.02))
    ax.grid(axis="x", visible=False)
    clean(ax)
    return save(fig, "09_personality_profile.png")


# ------------------------------------------- 10. terminal wealth distributions
def fig_wealth():
    fig, axes = plt.subplots(2, 3, figsize=(7.4, 4.6), sharex=False)
    for ax, r in zip(axes.ravel(), RES):
        mid = r["member"]["member_id"]
        s = r["scenarios"][ADV]
        yrs = r["member"]["horizon_years"]
        corpus = r["member"]["corpus_inr"]
        hi = 0
        for port, c, lab in ((s["eut"], SERIES[0], "EUT"),
                             (s["bpt_ma"]["aggregate"], SERIES[1], "BPT")):
            m, sd = R.terminal_dist(port["mu"], port["sigma"], yrs)
            x = np.linspace(0.2, math.exp(m + 3.2 * sd), 400)
            ax.plot(x, stats.lognorm.pdf(x, sd, scale=math.exp(m)), color=c, lw=1.8,
                    label=lab)
            hi = max(hi, math.exp(m + 3.2 * sd))
        ax.axvline(r["floor_multiple"], color=SERIES[7], lw=1.2, ls=(0, (3, 2)))
        ax.axvline(r["aspiration_multiple"], color=SERIES[5], lw=1.2, ls=(0, (3, 2)))
        ax.set_title(f"{mid}  {r['member']['persona']}", fontsize=8.5)
        ax.set_xlim(0.2, min(hi, r["aspiration_multiple"] * 1.9))
        ax.set_yticks([])
        ax.tick_params(labelsize=7.5)
        ax.grid(axis="y", visible=False)
        clean(ax)
    axes[0][0].legend(loc="upper right", fontsize=7.5)
    axes[0][2].text(0.98, 0.55, "floor", transform=axes[0][2].transAxes,
                    fontsize=7.5, color=SERIES[7], ha="right")
    fig.supxlabel("Terminal wealth as a multiple of the corpus; dashed lines are the "
                  "floor and the aspiration", fontsize=8, color=INK2)
    fig.suptitle("Terminal wealth distributions at each member's own horizon",
                 x=0.045, ha="left", fontsize=10.5, weight="semibold", color=INK)
    fig.tight_layout(rect=(0, 0.03, 1, 0.94))
    return save(fig, "10_terminal_wealth.png")


if __name__ == "__main__":
    print("writing figures to", FIG)
    for f in (fig_utility, fig_value, fig_weighting, fig_frontier, fig_exposure,
              fig_layers, fig_concentration, fig_goals, fig_bfi, fig_wealth):
        f()
    print("done")
