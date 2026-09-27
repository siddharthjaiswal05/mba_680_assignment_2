"""
MBA680 Problem Statement 2 -- estimation and portfolio engine.

Reads the peer group's raw survey responses, recovers each member's preference
parameters, and builds two portfolios for each of them:

  EUT   a mean-variance complete portfolio on the capital allocation line through
        the Problem Statement 1 maximum-Sharpe portfolio

  BPT   the behavioral pair from Shefrin and Statman (2000): the single-account
        SP/A optimum in the sense of Lopes (1987), and the layered multiple-mental-
        account portfolio of Das, Markowitz, Scheid and Statman (2010)

Everything the portal needs is written out to outputs/ as JSON, so the web app and
this script can never disagree about a number.

Run:  python robo_engine.py
"""
from __future__ import annotations

import csv
import json
import math
import os

import numpy as np
from scipy import optimize, stats

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "outputs")
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------------------
# Inputs carried over from Problem Statement 1
#
# The risky engine of every portfolio below is the 60-stock maximum-Sharpe
# portfolio built in Problem Statement 1. Nothing here re-optimises it; the
# personal plan only decides how much of it each member should hold, and against
# what else.
# ---------------------------------------------------------------------------
RF = 0.0650                     # 91-day T-bill, 21 Aug 2026
PS1 = {
    "gmv":       {"mu": 0.1271, "sigma": 0.1403},
    "tangency":  {"mu": 0.2493, "sigma": 0.1797},
    "max_return": {"mu": 0.2514, "sigma": 0.1878},
}
PS1_AVG_VOL = 0.3471            # weighted average volatility of the 60 names
PS1_AVG_CORR = 0.2383           # average pairwise correlation

# The Problem Statement 1 expected returns are three-year in-sample means taken
# over a strong run in Indian equities, and the standard error on a mean return
# estimated from three years of a 30% volatility stock is roughly 17% per annum.
# A Sharpe ratio of 1.03 is therefore not a number anyone should plan a household
# balance sheet around. Volatility estimates from the same data are far more
# reliable than mean estimates, so sigma is carried across unchanged and only the
# expected return is shrunk toward a long-run Indian equity prior.
#
# Advice is given on the base case. The other two are reported beside it so the
# reader can see how much of the recommendation is an artefact of the input.
EQUITY_PRIOR = 0.1200
SCENARIOS = {
    "in_sample": {"shrink": 0.00, "label": "PS1 as reported, three-year in-sample means"},
    "base":      {"shrink": 0.75, "label": "Base case, 75% shrunk to the equity prior"},
    "prudent":   {"shrink": 1.00, "label": "Stress case, the prior alone, no tilt premium"},
}
ADVICE_SCENARIO = "base"

# A floor the client can breach in year two is not a floor they experience as
# safe. Behavioral portfolio theory is explicitly about how a holding feels along
# the way, not only about where it lands, so the floor is enforced at the one-year
# mark as well as at the terminal date. This is the single constraint that makes
# the SP/A optimum interior rather than a corner: over five years at any positive
# Sharpe ratio, equity beats cash even deep in the left tail, which is the time
# diversification effect and is discussed in the write-up.
FLOOR_INTERIM_YEARS = 1.0

# --- The aspiration sleeve ------------------------------------------------
#
# The aspiration layer is an equal-weighted concentrated cut of the same 60
# names: the n with the highest expected return. Its volatility, its expected
# return and its correlation with the core all follow from statistics the
# Problem Statement 1 report already publishes, so none of them is a free
# parameter that could be tuned to produce a desired answer.
#
# Volatility, from the average volatility and average pairwise correlation:
#     sigma(n) = 34.71% * sqrt( 1/n + (1 - 1/n) * 0.2383 )
# which runs from 20.1% at eight names to 34.7% at one.
#
# Covariance with the core, from the same constant-correlation approximation:
#     Cov(sleeve, core) ~ rho_bar * avg_vol^2 = 0.2383 * 0.3471^2
# This does not depend on n, because averaging more names of the same universe
# changes the sleeve's own variance but not its co-movement with the whole.
#
# Expected return, from the one fact the optimisation already established. The
# core IS the maximum-Sharpe portfolio of this universe, so in sample it is the
# tangency portfolio, and every subset of the universe is exactly priced off it:
#
#     beta = Cov(sleeve, core) / sigma_core^2
#     mu_sleeve = rf + beta * ( mu_core - rf )
#
# That is not an extra assumption, it is the first-order condition the optimiser
# solved. An earlier version of this engine instead estimated the sleeve's return
# from an order statistic on the cross-section of expected returns, and it implied
# an eight-name sleeve with an in-sample Sharpe ratio of 1.23 against the core's
# 1.03. That is impossible by construction, and the error showed up downstream as
# a layered portfolio that appeared to beat the capital allocation line.
#
# Pricing the sleeve properly has a consequence worth stating plainly: beta does
# not change with n, so concentrating the aspiration layer adds idiosyncratic
# variance and earns nothing for it. The entire cost of the layer is visible in
# its volatility.
ASPIRATION_N = 8
N_UNIVERSE = 60
SLEEVE_COV_WITH_CORE = PS1_AVG_CORR * PS1_AVG_VOL ** 2
SLEEVE_BETA = SLEEVE_COV_WITH_CORE / PS1["tangency"]["sigma"] ** 2


def sleeve_sigma(n: int = ASPIRATION_N) -> float:
    return PS1_AVG_VOL * math.sqrt(1.0 / n + (1.0 - 1.0 / n) * PS1_AVG_CORR)


def sleeve_mu_raw(n: int = ASPIRATION_N) -> float:
    """In-sample expected return of the sleeve, priced off the tangency portfolio."""
    return RF + SLEEVE_BETA * (PS1["tangency"]["mu"] - RF)


def sleeve_corr(n: int = ASPIRATION_N) -> float:
    return min(SLEEVE_COV_WITH_CORE / (sleeve_sigma(n) * PS1["tangency"]["sigma"]), 0.999)


# Survey design constants, mirrored from make_pilot_data.py
LADDER_DOWN = 0.10
LADDER_UP = [0.10, 0.15, 0.20, 0.25, 0.30, 0.40, 0.50, 0.65, 0.80, 1.00]
BFI_DOMAINS = ["E", "A", "C", "N", "O"]
BFI_LABEL = {
    "E": "Extraversion", "A": "Agreeableness", "C": "Conscientiousness",
    "N": "Negative Emotionality", "O": "Open-Mindedness",
}
# Domain means and standard deviations from the BFI-2 internet norming sample
# (Soto and John, 2017), used only to place a respondent on a percentile.
BFI_NORM = {"E": (3.24, 0.77), "A": (3.65, 0.66), "C": (3.43, 0.74),
            "N": (2.93, 0.86), "O": (3.68, 0.68)}


# ===========================================================================
# 1. Preference estimation
# ===========================================================================

def crra_u(w, gamma):
    """Constant relative risk aversion utility, with the log case handled."""
    w = np.asarray(w, dtype=float)
    if abs(gamma - 1.0) < 1e-9:
        return np.log(w)
    return (w ** (1.0 - gamma) - 1.0) / (1.0 - gamma)


def fit_crra(grid, probs, lo, hi):
    """
    Recover relative risk aversion from probability-equivalence answers.

    For each intermediate wealth X the respondent names the probability p that
    makes a certain X indifferent to a gamble paying hi with probability p and lo
    otherwise. Under expected utility that probability *is* the normalised
    utility, so

        p_hat(X; gamma) = [ u(X) - u(lo) ] / [ u(hi) - u(lo) ]

    and gamma is the value that fits the reported p's best in least squares.
    Returns the estimate, the root mean squared residual and the implied R^2.
    """
    grid = np.asarray(grid, float)
    probs = np.asarray(probs, float)

    def resid(g):
        g = float(g[0])
        lo_u, hi_u = crra_u(lo, g), crra_u(hi, g)
        return (crra_u(grid, g) - lo_u) / (hi_u - lo_u) - probs

    best = optimize.least_squares(resid, x0=[3.0], bounds=([-0.9], [25.0]))
    gamma = float(best.x[0])
    r = resid(best.x)
    rmse = float(np.sqrt(np.mean(r ** 2)))
    ss_tot = float(np.sum((probs - probs.mean()) ** 2))
    r2 = 1.0 - float(np.sum(r ** 2)) / ss_tot if ss_tot > 0 else float("nan")
    return gamma, rmse, r2


def ladder_interval(row):
    """
    Bracket relative risk aversion from the row at which the respondent first
    accepts the wealth gamble. Accepting row i but refusing row i-1 means gamma
    lies between the two indifference values.
    """
    def gamma_at(up):
        f = lambda g: 0.5 * crra_u(1.0 + up, g) + 0.5 * crra_u(1.0 - LADDER_DOWN, g) - crra_u(1.0, g)
        try:
            return float(optimize.brentq(f, -0.5, 40.0))
        except ValueError:
            return float("nan")

    if row < 1 or row > len(LADDER_UP):
        return (gamma_at(LADDER_UP[-1]), float("inf"))
    hi = gamma_at(LADDER_UP[row - 1])
    lo = gamma_at(LADDER_UP[row - 2]) if row >= 2 else 0.0
    return (lo, hi)


def fit_discounting(x_1m, x_13m, base=10000.0):
    """
    Quasi-hyperbolic discounting from two titrations.

    The 12-versus-13-month pair sits entirely in the future, so the present-bias
    factor cancels and the monthly discount factor falls straight out:

        beta * delta^12 * base = beta * delta^13 * x_13m   ->   delta = base / x_13m

    The today-versus-one-month pair then isolates present bias:

        base = beta * delta * x_1m                         ->   beta = base / (delta * x_1m)
    """
    delta_m = base / float(x_13m)
    beta = base / (delta_m * float(x_1m))
    return {
        "beta_present_bias": beta,
        "delta_monthly": delta_m,
        "delta_annual": delta_m ** 12,
        "annual_discount_rate": delta_m ** (-12) - 1.0,
        "one_month_rate": 1.0 / (beta * delta_m) - 1.0,
    }


def fit_value_function(gain_x, gain_p, loss_x, loss_p, mixed_loss, mixed_gain):
    """
    Prospect-theory value function from probability-equivalence answers.

    Elicitation uses linear probabilities, as the course's own worked answers do,
    so for a gain x measured against the anchor X:

        p = v(x) / v(X) = (x / X)^alpha      ->      ln p = alpha * ln(x / X)

    alpha is therefore the slope of a regression of ln p on ln(x / X) through the
    origin, and the loss limb gives beta the same way.

    Loss aversion needs more care. The mixed gamble gives

        0.5 * G^alpha = 0.5 * lambda * L^beta

    which only yields a scale-free lambda when alpha equals beta. Where they
    differ, lambda is quoted at the common curvature abar = (alpha + beta) / 2,
    matching the convention used throughout the course, and the raw alpha and
    beta are reported separately as curvature diagnostics.
    """
    def slope(x, p):
        lx = np.log(np.asarray(x, float))
        lp = np.log(np.asarray(p, float))
        s = float(np.sum(lx * lp) / np.sum(lx * lx))          # regression through origin
        pred = np.exp(s * lx)
        rmse = float(np.sqrt(np.mean((pred - np.asarray(p, float)) ** 2)))
        return s, rmse

    alpha, a_rmse = slope(gain_x, gain_p)
    beta, b_rmse = slope(loss_x, loss_p)
    abar = 0.5 * (alpha + beta)
    lam = (float(mixed_gain) / float(mixed_loss)) ** abar
    lam_linear = float(mixed_gain) / float(mixed_loss)        # the naive estimate
    return {
        "alpha": alpha, "beta": beta, "abar": abar,
        "lambda": lam, "lambda_linear_value": lam_linear,
        "alpha_rmse": a_rmse, "beta_rmse": b_rmse,
    }


def kt_weight(p, g):
    p = np.asarray(p, float)
    return p ** g / (p ** g + (1 - p) ** g) ** (1.0 / g)


def fit_weighting(ps, ces, stake, alpha):
    """
    Probability weighting from certainty equivalents.

    A certainty equivalent C for a prospect paying the stake X with probability p
    satisfies C^alpha = w(p) * X^alpha, so each answer reveals one point of the
    weighting function directly:

        w(p) = (C / X)^alpha

    The Kahneman-Tversky one-parameter form is then fitted across those points.
    Two answers against one parameter leaves the fit over-identified, which is
    deliberate: the residual is the diagnostic that says whether a single
    curvature parameter can describe this respondent at all.
    """
    ps = np.asarray(ps, float)
    w_obs = (np.asarray(ces, float) / float(stake)) ** alpha

    def resid(g):
        return kt_weight(ps, float(g[0])) - w_obs

    best = optimize.least_squares(resid, x0=[0.61], bounds=([0.28], [1.0]))
    g = float(best.x[0])
    rmse = float(np.sqrt(np.mean(resid(best.x) ** 2)))
    return {
        "gamma_w": g, "rmse": rmse,
        "w_observed": {str(p): float(v) for p, v in zip(ps, w_obs)},
        "w_fitted": {str(p): float(v) for p, v in zip(ps, kt_weight(ps, g))},
        "crossover_p": float(crossover(g)),
    }


def crossover(g):
    """The probability at which w(p) crosses the 45-degree line."""
    f = lambda p: float(kt_weight(p, g)) - p
    try:
        return optimize.brentq(f, 0.01, 0.99)
    except ValueError:
        return float("nan")


def score_bfi(items):
    """
    BFI-2-S domain scores. Items arrive already reverse-keyed by the instrument,
    so scoring is the domain mean, reported alongside a percentile against the
    Soto and John (2017) norming sample.
    """
    out = {}
    for d in BFI_DOMAINS:
        vals = np.asarray(items[d], float)
        m = float(vals.mean())
        mu, sd = BFI_NORM[d]
        out[d] = {
            "label": BFI_LABEL[d], "mean": m,
            "z": (m - mu) / sd,
            "percentile": float(stats.norm.cdf((m - mu) / sd) * 100.0),
        }
    return out


# ===========================================================================
# 2. The two portfolio constructions
# ===========================================================================

def frontier_coefficients():
    """
    Reconstruct the Problem Statement 1 efficient frontier in closed form.

    An unconstrained frontier is the hyperbola

        sigma^2(r) = sigma_gmv^2 + (r - r_gmv)^2 / D

    and the Problem Statement 1 report publishes three points on its frontier:
    the global minimum variance portfolio, the maximum-Sharpe portfolio and the
    highest attainable return. Three points would fix a general parabola exactly,
    but that fit is badly conditioned here, because the top two points are only
    21 basis points apart in return while their variances differ by a fifth. The
    resulting parabola is so sharp that it turns negative inside the feasible
    range, which is an artefact of the fit and not a property of the frontier.

    The frontier is therefore anchored where it is best determined: the vertex is
    placed exactly at the reported minimum-variance point, and D is set so the
    curve also passes exactly through the maximum-Sharpe portfolio. Those are the
    two points every allocation below actually uses. The highest-return point is
    then left as an out-of-sample check, and its residual is reported rather than
    fitted away. It comes out about 70 basis points of volatility below the
    reported figure, which is what should be expected: the 4% position cap and the
    20% sector cap bind hardest at the top of the frontier and bend that arm
    upward, away from the unconstrained hyperbola.
    """
    r_g, s_g = PS1["gmv"]["mu"], PS1["gmv"]["sigma"]
    r_t, s_t = PS1["tangency"]["mu"], PS1["tangency"]["sigma"]
    D = (r_t - r_g) ** 2 / (s_t ** 2 - s_g ** 2)

    r_x, s_x = PS1["max_return"]["mu"], PS1["max_return"]["sigma"]
    s_pred = math.sqrt(s_g ** 2 + (r_x - r_g) ** 2 / D)
    return {
        "form": "sigma^2(r) = sigma_gmv^2 + (r - r_gmv)^2 / D",
        "D": float(D), "r_gmv": float(r_g), "sigma_gmv": float(s_g),
        "check_max_return": {
            "reported_sigma": float(s_x), "fitted_sigma": float(s_pred),
            "residual_pp": float((s_pred - s_x) * 100.0),
        },
    }


def frontier_sigma(r, coef):
    v = coef["sigma_gmv"] ** 2 + (r - coef["r_gmv"]) ** 2 / coef["D"]
    return math.sqrt(max(v, 1e-12))


def risky_engine(scenario):
    """Expected return and volatility of the risky sleeve under one input set."""
    s = SCENARIOS[scenario]["shrink"]
    sig = PS1["tangency"]["sigma"]
    mu = (1 - s) * PS1["tangency"]["mu"] + s * EQUITY_PRIOR
    return {"name": scenario, "label": SCENARIOS[scenario]["label"],
            "shrink": s, "mu": mu, "sigma": sig, "sharpe": (mu - RF) / sig}


def shrink_mu(mu_raw, scenario):
    s = SCENARIOS[scenario]["shrink"]
    return (1 - s) * mu_raw + s * EQUITY_PRIOR


def eut_portfolio(gamma, engine, allow_leverage=False):
    """
    Mean-variance complete portfolio.

    Maximising U = E(r_c) - 0.5 * A * sigma_c^2 over the capital allocation line
    gives the textbook solution

        y* = [ E(r_P) - rf ] / ( A * sigma_P^2 )

    with A read off as the respondent's relative risk aversion. The unconstrained
    y* is reported as well as the advised one, because the gap between them is the
    whole argument for a leverage policy.
    """
    mu_p, sig_p = engine["mu"], engine["sigma"]
    y_star = (mu_p - RF) / (gamma * sig_p ** 2)
    cap = 2.0 if allow_leverage else 1.0
    y = min(max(y_star, 0.0), cap)
    mu_c = RF + y * (mu_p - RF)
    sig_c = y * sig_p
    return {
        "y_unconstrained": y_star, "y_advised": y, "capped": y_star > cap,
        "mu": mu_c, "sigma": sig_c,
        "utility_score": mu_c - 0.5 * gamma * sig_c ** 2,
        "sharpe": (mu_c - RF) / sig_c if sig_c > 1e-9 else float("nan"),
        "equity_inr_per_lakh": y * 100000.0,
    }


def terminal_dist(mu, sigma, years):
    """
    Terminal wealth per rupee invested, as a lognormal.

    Holding a constant mix for T years and compounding continuously gives
    ln(W_T) ~ N( (mu - sigma^2/2) * T , sigma^2 * T ), which keeps terminal wealth
    strictly positive and is the convention the Problem Statement 1 playbook sets
    for multi-period projections.
    """
    m = (mu - 0.5 * sigma ** 2) * years
    s = sigma * math.sqrt(years) if sigma > 1e-9 else 1e-9
    return m, s


def prob_below(threshold_mult, mu, sigma, years):
    """Probability that terminal wealth falls short of a multiple of the corpus."""
    m, s = terminal_dist(mu, sigma, years)
    if threshold_mult <= 0:
        return 0.0
    return float(stats.norm.cdf((math.log(threshold_mult) - m) / s))


def spa_parameters(fitted, bfi, security_points, aspiration_tradeoff, corpus):
    """
    Translate the elicited parameters into the SP/A primitives of Lopes (1987).

    Three of the four come straight out of the survey rather than being assumed:

      omega   the weight on security relative to potential, taken directly from
              the respondent's own 100-point split
      beta_A  the value of aspiration, in rupees of expected terminal wealth the
              respondent will give up for a one-unit rise in the probability of
              reaching it, read off the stated trade-off for ten percentage points

    The two shape parameters are mapped from parameters that were elicited:

      q_s     fear, which steepens the weighting of the worst outcomes, mapped
              from loss aversion as q_s = lambda - 1 so that a respondent with no
              loss aversion has no fear component
      q_p     hope, which lifts the weighting of the best outcomes, mapped from
              the weighting-function curvature as q_p = 1/gamma_w - 1 so that a
              respondent who does not distort probabilities has no hope component

    Both mappings are monotone, vanish at the neutral value, and are stated here
    rather than buried, because they are the one modelling choice in this engine
    that the data does not force.
    """
    lam = fitted["value"]["lambda"]
    gw = fitted["weighting"]["gamma_w"]
    q_s = max(lam - 1.0, 0.0)
    q_p = max(1.0 / gw - 1.0, 0.0)
    omega = float(security_points) / 100.0
    beta_a = float(aspiration_tradeoff) / 0.10 / float(corpus)   # in corpus multiples
    return {"q_s": q_s, "q_p": q_p, "omega": omega, "beta_aspiration": beta_a,
            "neg_emotionality_z": bfi["N"]["z"], "openness_z": bfi["O"]["z"]}


def spa_value(mu, sigma, years, spa, aspiration_mult, n_grid=4000):
    """
    The SP/A objective, evaluated for one portfolio.

    Lopes models the security-potential tension as a distortion of the
    decumulative distribution D(w) = Pr(W > w) rather than of individual
    probabilities. Fear pulls weight onto the worst outcomes and hope pushes it
    onto the best:

        h(D) = omega * D^(1 + q_s)  +  (1 - omega) * [ 1 - (1 - D)^(1 + q_p) ]

    The security-potential term is the Choquet expectation of wealth under that
    distorted decumulative,

        SP = integral over w of h( D(w) ) dw

    and the aspiration term adds beta_A times the probability of clearing the
    aspiration level. The objective is SP + aspiration, in corpus multiples.
    """
    m, s = terminal_dist(mu, sigma, years)
    hi = math.exp(m + 6.0 * s)
    w = np.linspace(1e-9, hi, n_grid)
    D = 1.0 - stats.lognorm.cdf(w, s, scale=math.exp(m))
    h = spa["omega"] * D ** (1.0 + spa["q_s"]) + \
        (1.0 - spa["omega"]) * (1.0 - (1.0 - D) ** (1.0 + spa["q_p"]))
    sp = float(np.trapz(h, w))
    p_asp = 1.0 - float(stats.lognorm.cdf(aspiration_mult, s, scale=math.exp(m)))
    return {"sp": sp, "p_aspiration": p_asp,
            "objective": sp + spa["beta_aspiration"] * p_asp,
            "certainty_equivalent": sp}


def bpt_single_account(spa, engine, years, aspiration_mult, floor_mult, floor_alpha):
    """
    BPT-SA: one mental account, the SP/A objective maximised along the capital
    allocation line, subject to the respondent's own floor constraint.

    The floor is treated as a hard chance constraint, Pr(W < floor) <= alpha,
    which is Roy's safety-first criterion operating as a feasibility filter rather
    than as the objective. Where no allocation satisfies it, the engine says so
    instead of quietly returning the least-bad answer.
    """
    ys = np.linspace(0.0, 1.0, 201)
    rows, best, feasible_any = [], None, False
    for y in ys:
        mu = RF + y * (engine["mu"] - RF)
        sig = y * engine["sigma"]
        p_term = prob_below(floor_mult, mu, sig, years)
        p_int = prob_below(floor_mult, mu, sig, FLOOR_INTERIM_YEARS)
        v = spa_value(mu, sig, years, spa, aspiration_mult)
        ok = max(p_term, p_int) <= floor_alpha + 1e-9
        feasible_any |= ok
        row = {"y": float(y), "mu": mu, "sigma": sig,
               "p_floor_breach": p_term, "p_floor_breach_1y": p_int,
               "feasible": ok, **v}
        rows.append(row)
        if ok and (best is None or v["objective"] > best["objective"]):
            best = row
    if best is None:                                  # floor cannot be met at all
        best = min(rows, key=lambda r: max(r["p_floor_breach"], r["p_floor_breach_1y"]))
    return {"optimum": best, "floor_feasible": feasible_any,
            "binding_constraint": "one-year floor" if feasible_any and
            best["p_floor_breach_1y"] > best["p_floor_breach"] else "terminal floor",
            "curve": [{k: r[k] for k in ("y", "objective", "sp", "p_aspiration",
                                         "p_floor_breach", "p_floor_breach_1y",
                                         "feasible")} for r in rows]}


def bpt_mental_accounts(member, fitted, engine, years, coef, n_sleeve=ASPIRATION_N):
    """
    BPT-MA: the layered pyramid, built the way Das, Markowitz, Scheid and Statman
    (2010) build it. Each layer is a separate mental account with its own goal,
    its own threshold and its own acceptable failure probability, and crucially
    the covariance between layers is never consulted while they are built.

      Layer 1, security. Funded to make the floor certain, so it is discounted
      back at the risk-free rate: L1 = floor / (1 + rf)^T.

      Layer 2, income. Funds the stated annual withdrawal over the horizon, at a
      moderate allocation chosen as the largest y whose shortfall probability
      against the layer's own threshold stays inside 10%.

      Layer 3, aspiration. Whatever is left, in the concentrated sleeve.

    The aggregate is then priced back against the frontier, and the distance is
    reported. That distance is the point of the exercise: it is what the layered
    construction costs, and therefore what the client is paying for the comfort of
    seeing their money in labelled buckets.
    """
    corpus = float(member["corpus_inr"])
    floor = float(member["floor_inr"])
    income = float(member["income_need_pa"])

    # Layer 1
    l1 = min(floor / (1.0 + RF) ** years, corpus)
    # Layer 2: present value of the income stream at the risk-free rate
    l2_need = sum(income / (1.0 + RF) ** t for t in range(1, years + 1))
    l2 = min(l2_need, max(corpus - l1, 0.0))
    l3 = max(corpus - l1 - l2, 0.0)

    # Layer 2 allocation: most risk that still keeps a 10% shortfall ceiling
    y2 = 0.0
    for y in np.linspace(0.0, 1.0, 101):
        mu = RF + y * (engine["mu"] - RF)
        sig = y * engine["sigma"]
        if prob_below(1.0, mu, sig, years) <= 0.10 + 1e-9:
            y2 = float(y)
    mu2, sig2 = RF + y2 * (engine["mu"] - RF), y2 * engine["sigma"]

    # Layer 3: the concentrated sleeve, fully invested
    sig3 = sleeve_sigma(n_sleeve)
    # The sleeve's in-sample expected return is the most overfitted number in the
    # whole exercise, so it takes the same shrinkage as the core rather than less.
    mu3 = shrink_mu(sleeve_mu_raw(n_sleeve), engine["name"])
    rho23 = sleeve_corr(n_sleeve)

    w1, w2, w3 = l1 / corpus, l2 / corpus, l3 / corpus
    mu_agg = w1 * RF + w2 * mu2 + w3 * mu3
    # Layer 1 is risk free. Layers 2 and 3 are both drawn from the same 60 names,
    # so their correlation is derived rather than assumed (see sleeve_corr).
    var = (w2 * sig2) ** 2 + (w3 * sig3) ** 2 + \
        2 * rho23 * (w2 * sig2) * (w3 * sig3)
    sig_agg = math.sqrt(max(var, 0.0))

    # What the capital allocation line would have delivered at the same risk
    cal_mu = RF + engine["sharpe"] * sig_agg
    # And where the equity-only frontier sits at the same risk
    frontier_mu = float("nan")
    lo, hi = PS1["gmv"]["mu"], PS1["max_return"]["mu"]
    if frontier_sigma(lo, coef) <= sig_agg <= frontier_sigma(hi, coef):
        frontier_mu = float(optimize.brentq(
            lambda r: frontier_sigma(r, coef) - sig_agg, lo, hi))

    return {
        "layers": [
            {"name": "Security", "goal": f"Hold at least Rs {floor:,.0f} at year {years}",
             "amount": l1, "weight": w1, "mu": RF, "sigma": 0.0, "y": 0.0,
             "vehicle": "91-day T-bill roll / bank fixed deposit"},
            {"name": "Income", "goal": f"Fund Rs {income:,.0f} a year for {years} years",
             "amount": l2, "weight": w2, "mu": mu2, "sigma": sig2, "y": y2,
             "vehicle": f"{y2:.0%} of the PS1 60-stock portfolio, rest in T-bills"},
            {"name": "Aspiration", "goal": f"Reach Rs {float(member['aspiration_inr']):,.0f}",
             "amount": l3, "weight": w3, "mu": mu3, "sigma": sig3, "y": 1.0,
             "vehicle": f"Equal-weighted {n_sleeve}-name concentrated cut of the same portfolio"},
        ],
        "n_sleeve": n_sleeve, "sleeve_sigma": sig3, "sleeve_mu": mu3,
        "sleeve_corr_with_core": rho23,
        "aggregate": {"mu": mu_agg, "sigma": sig_agg,
                      "sharpe": (mu_agg - RF) / sig_agg if sig_agg > 1e-9 else float("nan")},
        "cal_mu_at_same_risk": cal_mu,
        "frontier_mu_at_same_risk": frontier_mu,
        "efficiency_loss_bps": (cal_mu - mu_agg) * 10000.0,
        "covariance_ignored": True,
    }


def concentration_sensitivity(member, fitted, engine, years, coef,
                              sizes=(20, 12, 8, 5, 3, 2, 1)):
    """
    How much the layered portfolio costs, as a function of how concentrated the
    aspiration layer is.

    Building every layer out of the same well-screened 60 names is the charitable
    case for behavioral portfolio theory, and it produces a small efficiency loss.
    Real clients do not fill the aspiration bucket that way. They fill it with two
    or three stocks they have a story about, and the volatility of that sleeve
    follows directly from the two statistics Problem Statement 1 already publishes:

        sigma_sleeve(n) = 34.71% * sqrt( 1/n + (1 - 1/n) * 0.2383 )

    which runs from 20.1% at eight names to 34.7% at one. The loss below is the
    gap in expected return between the aggregate portfolio and the capital
    allocation line at the same total volatility.
    """
    out = []
    for n in sizes:
        ma = bpt_mental_accounts(member, fitted, engine, years, coef, n_sleeve=n)
        out.append({"n": n, "sleeve_sigma": ma["sleeve_sigma"],
                    "sleeve_mu": ma["sleeve_mu"], "rho": ma["sleeve_corr_with_core"],
                    "agg_mu": ma["aggregate"]["mu"], "agg_sigma": ma["aggregate"]["sigma"],
                    "loss_bps": ma["efficiency_loss_bps"]})
    return out


# ===========================================================================
# 3. Personality-aware advisory commentary
# ===========================================================================

ADVICE_RULES = [
    # (domain, direction, threshold in z, headline, what the adviser actually changes)
    ("N", "high", 0.5,
     "Anxiety will be the binding constraint, not the risk budget",
     "Fund the security layer first and show it as a separate line before any "
     "discussion of return. Report performance annually rather than monthly: at a "
     "17.97% volatility the probability of seeing a loss over any given month is "
     "about 44%, against roughly 12% over a year, and each of those printed losses "
     "is scaled by this member's loss aversion. Automate the contribution so the "
     "decision is not re-taken every month."),
    ("N", "low", -0.5,
     "Low reactivity permits a higher equity weight than the risk score alone suggests",
     "The mean-variance allocation can be implemented close to its unconstrained "
     "value. The risk here is the mirror image of anxiety: this member is unlikely "
     "to be shaken out of the position, but equally unlikely to review it, so put a "
     "calendar rebalance in place rather than relying on attention."),
    ("O", "high", 0.5,
     "Openness sustains the aspiration layer but invites thematic drift",
     "Give the aspiration layer a real allocation, since suppressing it usually "
     "reappears as unsupervised trading outside the plan. Cap it in writing and "
     "require that any new theme be funded by selling something inside the same "
     "layer, so curiosity is spent from a fixed budget."),
    ("O", "low", -0.5,
     "A small aspiration layer, explained in familiar terms",
     "Keep the aspiration layer token or absent, and describe the core portfolio in "
     "terms of the companies inside it rather than the optimisation behind it. "
     "Novel structures will be read as risk regardless of their statistics."),
    ("C", "low", -0.5,
     "The plan will fail on execution rather than on design",
     "Reduce the number of decisions to as close to zero as possible: standing "
     "instruction on the contribution date, automatic rebalancing at a fixed "
     "threshold, no discretionary top-ups. A slightly worse portfolio that is "
     "actually followed dominates the optimal one that is not."),
    ("C", "high", 0.5,
     "Execution is reliable, so the plan can carry more moving parts",
     "Threshold rebalancing, tax-loss harvesting and a staged entry are all "
     "realistic here. The failure mode to watch is over-monitoring: set an explicit "
     "review cadence so diligence does not turn into trading."),
    ("E", "high", 0.5,
     "Social comparison is the likely source of unplanned changes",
     "Expect pressure from peer conversations about individual stocks. Pre-commit "
     "the review dates, and benchmark against the member's own goal funding level "
     "rather than against an index or against what a friend reports, since neither "
     "comparison is adjusted for risk."),
    ("A", "high", 0.5,
     "High trust raises advice-taking but also herding risk",
     "Recommendations will be accepted with little pushback, which shifts the burden "
     "of challenge onto the adviser. State the downside case explicitly and in "
     "rupees at every review, and record that it was stated."),
    ("A", "low", -0.5,
     "Expect the reasoning to be audited, so lead with it",
     "Present the screen, the covariance inputs and the constraint set before the "
     "recommendation. Buy-in here comes from the method rather than from the "
     "relationship, and an unexplained allocation will simply be overridden."),
]


def commentary(bfi, fitted, spa):
    out = []
    for dom, direction, thr, head, body in ADVICE_RULES:
        z = bfi[dom]["z"]
        if (direction == "high" and z >= thr) or (direction == "low" and z <= thr):
            out.append({"domain": BFI_LABEL[dom], "z": z, "headline": head, "action": body})

    lam = fitted["value"]["lambda"]
    if lam >= 2.5:
        out.append({
            "domain": "Loss aversion", "z": float("nan"),
            "headline": f"Loss aversion of {lam:.2f} makes reporting frequency a portfolio decision",
            "action": "At this lambda the portfolio's own volatility is less damaging than the "
                      "rate at which it is observed. Myopic loss aversion says the same holding "
                      "reviewed monthly and annually produces different behaviour from the same "
                      "person, so the review interval belongs in the investment policy statement "
                      "next to the asset weights."})
    if fitted["discounting"]["beta_present_bias"] <= 0.90:
        out.append({
            "domain": "Present bias", "z": float("nan"),
            "headline": f"Present bias of {fitted['discounting']['beta_present_bias']:.2f} "
                        "threatens the contribution, not the allocation",
            "action": "The allocation can be correct and the plan still fail, because the money "
                      "never arrives. Use a commitment device: auto-debit on the salary date, and "
                      "hold the security layer in an instrument with a withdrawal penalty so the "
                      "cost of raiding it is felt at the moment of temptation."})
    if spa["q_p"] >= 0.7:
        out.append({
            "domain": "Hope", "z": float("nan"),
            "headline": "Strong overweighting of small probabilities",
            "action": "This member genuinely values lottery-like exposure, and prospect theory "
                      "treats that as a preference rather than as an error. Meet it inside the "
                      "aspiration layer, where it is sized and visible, instead of letting it "
                      "leak into the core portfolio as position concentration."})
    return out


# ===========================================================================
# 4. Run everything
# ===========================================================================

def analyse(member, coef):
    corpus = float(member["corpus_inr"])
    years = int(member["horizon_years"])

    gamma, g_rmse, g_r2 = fit_crra(member["util_grid"], member["util_p"],
                                   member["util_lo"], member["util_hi"])
    lo, hi = ladder_interval(member["ladder_switch_row"])
    disc = fit_discounting(member["td_indiff_1m"], member["td_indiff_13m"])
    val = fit_value_function(member["vf_gain_x"], member["vf_gain_p"],
                             member["vf_loss_x"], member["vf_loss_p"],
                             member["vf_mixed_loss"], member["vf_mixed_gain"])
    wgt = fit_weighting(member["pw_p"], member["pw_ce"], member["pw_stake"], val["alpha"])
    bfi = score_bfi(member["bfi_items"])

    fitted = {
        "risk_aversion": {"gamma": gamma, "rmse": g_rmse, "r2": g_r2,
                          "ladder_row": member["ladder_switch_row"],
                          "ladder_interval": [lo, hi],
                          "ladder_consistent": bool(lo - 0.75 <= gamma <= hi + 0.75)},
        "discounting": disc, "value": val, "weighting": wgt,
    }
    spa = spa_parameters(fitted, bfi, member["security_points"],
                         member["aspiration_tradeoff_inr"], corpus)

    floor_mult = float(member["floor_inr"]) / corpus
    asp_mult = float(member["aspiration_inr"]) / corpus

    result = {"member": {k: member[k] for k in
                         ("member_id", "name", "persona", "age", "corpus_inr",
                          "horizon_years", "goal", "floor_inr", "floor_alpha",
                          "income_need_pa", "aspiration_inr", "security_points",
                          "aspiration_tradeoff_inr")},
              "fitted": fitted, "bfi": bfi, "spa_parameters": spa,
              "floor_multiple": floor_mult, "aspiration_multiple": asp_mult,
              "scenarios": {}}

    for name in SCENARIOS:
        eng = risky_engine(name)
        eut = eut_portfolio(gamma, eng)
        bpt_sa = bpt_single_account(spa, eng, years, asp_mult, floor_mult,
                                    float(member["floor_alpha"]))
        bpt_ma = bpt_mental_accounts(member, fitted, eng, years, coef)

        for tag, port in (("eut", eut), ("bpt_sa", bpt_sa["optimum"]),
                          ("bpt_ma", bpt_ma["aggregate"])):
            port["p_floor_breach"] = prob_below(floor_mult, port["mu"], port["sigma"], years)
            port["p_floor_breach_1y"] = prob_below(floor_mult, port["mu"], port["sigma"],
                                                   FLOOR_INTERIM_YEARS)
            port["p_aspiration"] = 1.0 - prob_below(asp_mult, port["mu"], port["sigma"], years)
            m, s = terminal_dist(port["mu"], port["sigma"], years)
            port["median_terminal_inr"] = corpus * math.exp(m)
            port["p05_terminal_inr"] = corpus * math.exp(m + s * stats.norm.ppf(0.05))
            port["p95_terminal_inr"] = corpus * math.exp(m + s * stats.norm.ppf(0.95))
            port["expected_terminal_inr"] = corpus * math.exp(m + 0.5 * s ** 2)

        result["scenarios"][name] = {
            "engine": eng, "eut": eut, "bpt_sa": bpt_sa, "bpt_ma": bpt_ma,
            "concentration": concentration_sensitivity(member, fitted, eng, years, coef),
            "spa_at_eut": spa_value(eut["mu"], eut["sigma"], years, spa, asp_mult),
            "mv_utility_at_bpt_sa": bpt_sa["optimum"]["mu"] - 0.5 * gamma * bpt_sa["optimum"]["sigma"] ** 2,
            "mv_utility_at_bpt_ma": bpt_ma["aggregate"]["mu"] - 0.5 * gamma * bpt_ma["aggregate"]["sigma"] ** 2,
        }

    result["commentary"] = commentary(bfi, fitted, spa)
    if "_true" in member:
        t = member["_true"]
        result["recovery"] = {
            "gamma": {"true": t["gamma"], "fitted": gamma, "err": gamma - t["gamma"]},
            "alpha": {"true": t["alpha"], "fitted": val["alpha"], "err": val["alpha"] - t["alpha"]},
            "beta": {"true": t["beta_loss"], "fitted": val["beta"], "err": val["beta"] - t["beta_loss"]},
            "lambda": {"true": t["lam"], "fitted": val["lambda"], "err": val["lambda"] - t["lam"]},
            "gamma_w": {"true": t["gamma_w"], "fitted": wgt["gamma_w"], "err": wgt["gamma_w"] - t["gamma_w"]},
            "present_bias": {"true": t["present_bias"], "fitted": disc["beta_present_bias"],
                             "err": disc["beta_present_bias"] - t["present_bias"]},
        }
    return result


def main():
    with open(os.path.join(HERE, "responses.json")) as fh:
        members = json.load(fh)

    coef = frontier_coefficients()
    results = [analyse(m, coef) for m in members]

    bundle = {
        "constants": {"rf": RF, "ps1": PS1, "equity_prior": EQUITY_PRIOR,
                      "scenarios": SCENARIOS, "advice_scenario": ADVICE_SCENARIO,
                      "floor_interim_years": FLOOR_INTERIM_YEARS,
                      "avg_vol": PS1_AVG_VOL,
                      "avg_corr": PS1_AVG_CORR, "aspiration_n": ASPIRATION_N,
                      "sleeve_beta": SLEEVE_BETA,
                      "sleeve_cov_with_core": SLEEVE_COV_WITH_CORE,
                      "aspiration_sleeve_sigma": sleeve_sigma(),
                      "aspiration_sleeve_mu_raw": sleeve_mu_raw(),
                      "aspiration_corr_with_core": sleeve_corr()},
        "frontier": coef,
        "engines": {k: risky_engine(k) for k in SCENARIOS},
        "results": results,
    }
    # json.dump happily writes bare NaN and Infinity, which no strict JSON parser
    # will read back, including the one in the portal. Map them to null instead.
    def jsonable(o):
        if isinstance(o, float):
            return None if (math.isnan(o) or math.isinf(o)) else o
        if isinstance(o, dict):
            return {k: jsonable(v) for k, v in o.items()}
        if isinstance(o, (list, tuple)):
            return [jsonable(v) for v in o]
        if isinstance(o, (np.floating, np.integer)):
            return jsonable(float(o))
        if isinstance(o, np.bool_):
            return bool(o)
        return o

    with open(os.path.join(OUT, "analysis.json"), "w") as fh:
        json.dump(jsonable(bundle), fh, indent=1, allow_nan=False)

    # Flat summary table for the report
    rows = []
    for r in results:
        s = r["scenarios"][ADVICE_SCENARIO]
        f = r["fitted"]
        rows.append({
            "member": r["member"]["member_id"], "persona": r["member"]["persona"],
            "corpus": r["member"]["corpus_inr"], "horizon": r["member"]["horizon_years"],
            "gamma": round(f["risk_aversion"]["gamma"], 2),
            "alpha": round(f["value"]["alpha"], 3), "beta": round(f["value"]["beta"], 3),
            "lambda": round(f["value"]["lambda"], 2),
            "gamma_w": round(f["weighting"]["gamma_w"], 3),
            "present_bias": round(f["discounting"]["beta_present_bias"], 3),
            "annual_discount_pct": round(f["discounting"]["annual_discount_rate"] * 100, 1),
            "N_pctile": round(r["bfi"]["N"]["percentile"]),
            "O_pctile": round(r["bfi"]["O"]["percentile"]),
            "C_pctile": round(r["bfi"]["C"]["percentile"]),
            "eut_y": round(s["eut"]["y_advised"], 3),
            "eut_mu_pct": round(s["eut"]["mu"] * 100, 2),
            "eut_sigma_pct": round(s["eut"]["sigma"] * 100, 2),
            "bpt_sa_y": round(s["bpt_sa"]["optimum"]["y"], 3),
            "bpt_sa_mu_pct": round(s["bpt_sa"]["optimum"]["mu"] * 100, 2),
            "bpt_sa_sigma_pct": round(s["bpt_sa"]["optimum"]["sigma"] * 100, 2),
            "bpt_ma_mu_pct": round(s["bpt_ma"]["aggregate"]["mu"] * 100, 2),
            "bpt_ma_sigma_pct": round(s["bpt_ma"]["aggregate"]["sigma"] * 100, 2),
            "bpt_ma_loss_bps": round(s["bpt_ma"]["efficiency_loss_bps"]),
            "p_floor_eut": round(s["eut"]["p_floor_breach"] * 100, 1),
            "p_asp_eut": round(s["eut"]["p_aspiration"] * 100, 1),
            "p_asp_bpt_ma": round(s["bpt_ma"]["aggregate"]["p_aspiration"] * 100, 1),
        })
    with open(os.path.join(OUT, "summary.csv"), "w", newline="") as fh:
        wtr = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        wtr.writeheader()
        wtr.writerows(rows)

    # ------------------------------------------------------------------ console
    fc = coef
    print("Frontier reconstruction")
    print(f"  sigma^2(r) = {fc['sigma_gmv']**2:.6f} + (r - {fc['r_gmv']:.4f})^2 / {fc['D']:.4f}")
    print(f"  passes exactly through the minimum-variance and maximum-Sharpe points")
    print(f"  highest-return check: reported {fc['check_max_return']['reported_sigma']:.2%}, "
          f"fitted {fc['check_max_return']['fitted_sigma']:.2%}, "
          f"residual {fc['check_max_return']['residual_pp']:+.2f} pp")
    print(f"\nRisky engine")
    for k in SCENARIOS:
        e = risky_engine(k)
        mark = "  <- advice" if k == ADVICE_SCENARIO else ""
        print(f"  {k:10s} mu {e['mu']:.2%}  sigma {e['sigma']:.2%}  Sharpe {e['sharpe']:.3f}{mark}")
    print(f"  aspiration sleeve sigma {sleeve_sigma():.2%} ({ASPIRATION_N} names)")

    print("\nParameter recovery (fitted minus true)")
    keys = ["gamma", "alpha", "beta", "lambda", "gamma_w", "present_bias"]
    print("     " + "".join(f"{k:>14s}" for k in keys))
    errs = {k: [] for k in keys}
    for r in results:
        rec = r["recovery"]
        print(f"  {r['member']['member_id']}" +
              "".join(f"{rec[k]['err']:+14.3f}" for k in keys))
        for k in keys:
            errs[k].append(abs(rec[k]["err"] / rec[k]["true"]))
    print("  MAPE" + "".join(f"{np.mean(errs[k]) * 100:13.1f}%" for k in keys))

    print(f"\nRecommended portfolios ({ADVICE_SCENARIO} inputs)")
    print(f"  {'':4s}{'gamma':>7s}{'lambda':>8s}{'omega':>7s}"
          f"{'y EUT':>8s}{'y SPA':>8s}{'BPT-MA mu':>11s}{'sig':>7s}{'loss bp':>9s}"
          f"{'P(asp)EUT':>11s}{'BPT-MA':>9s}")
    for r, row in zip(results, rows):
        print(f"  {row['member']:4s}{row['gamma']:7.2f}{row['lambda']:8.2f}"
              f"{r['spa_parameters']['omega']:7.2f}"
              f"{row['eut_y']:8.2f}{row['bpt_sa_y']:8.2f}"
              f"{row['bpt_ma_mu_pct']:11.2f}{row['bpt_ma_sigma_pct']:7.2f}"
              f"{row['bpt_ma_loss_bps']:9.0f}{row['p_asp_eut']:10.1f}%{row['p_asp_bpt_ma']:8.1f}%")

    print("\nCost of concentrating the aspiration layer (M2, base inputs, bps below the CAL)")
    m2 = [r for r in results if r["member"]["member_id"] == "M2"][0]
    cs = m2["scenarios"][ADVICE_SCENARIO]["concentration"]
    print("    names " + "".join(f"{c['n']:>8d}" for c in cs))
    print("    sigma " + "".join(f"{c['sleeve_sigma']:>7.1%}" for c in cs))
    print("    rho   " + "".join(f"{c['rho']:>8.2f}" for c in cs))
    print("    mu    " + "".join(f"{c['sleeve_mu']:>7.1%}" for c in cs))
    print("    loss  " + "".join(f"{c['loss_bps']:>8.0f}" for c in cs))
    print(f"\n  sleeve beta against the core {SLEEVE_BETA:.3f}; at n={ASPIRATION_N} its "
          f"in-sample mu is {sleeve_mu_raw():.2%}, sigma {sleeve_sigma():.2%}, "
          f"Sharpe {(sleeve_mu_raw()-RF)/sleeve_sigma():.3f} against the core's "
          f"{risky_engine('in_sample')['sharpe']:.3f}")

    print(f"\nwrote {OUT}/analysis.json and summary.csv")


if __name__ == "__main__":
    main()
