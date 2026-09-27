"""
Generates the pilot peer-group dataset for MBA680 Problem Statement 2.

Every respondent is built from an assumed *true* parameter vector, run through the
exact response rules of the survey instrument, then rounded the way a human would
round when filling a form. The estimation engine re-reads only the rounded answers,
so the gap between the true vector and the recovered vector is an honest measure of
how much precision the instrument itself loses. That recovery check is reported in
Section 5 of the write-up.

Replace responses.json with the real fielded data and nothing downstream changes.
"""
import json, math, random

random.seed(680)

# ----------------------------------------------------------------- instrument
# Section 2 risk ladder. The classic Holt-Laury payoffs stop discriminating once
# relative risk aversion passes about 1.4, and every member of this peer group sits
# above that, so the ladder is reframed over terminal wealth instead of over small
# cash prizes. Each row offers a 50/50 gamble on the corpus against leaving it alone:
# lose LADDER_DOWN, or gain the row's upside. The row at which the respondent first
# accepts brackets their relative risk aversion.
LADDER_DOWN = 0.10
LADDER_UP = [0.10, 0.15, 0.20, 0.25, 0.30, 0.40, 0.50, 0.65, 0.80, 1.00]

UTIL_GRID = [0.90, 1.00, 1.15, 1.30, 1.45]   # multiples of corpus, probability equivalence
UTIL_LO, UTIL_HI = 0.85, 1.60                # anchors: U(lo)=0, U(hi)=1

VF_GAIN = [0.10, 0.25, 0.50]     # gains as a fraction of corpus, against a +100% anchor
VF_LOSS = [0.10, 0.25, 0.50]     # losses as a fraction of corpus, against a -100% anchor
VF_ANCHOR = 1.00
MIXED_LOSS = 10000.0             # rupee loss used in the mixed-gamble question
PW_STAKE = 10000.0
PW_P = [0.10, 0.90]

BFI_DOMAINS = ["E", "A", "C", "N", "O"]


def crra(w, g):
    return math.log(w) if abs(g - 1.0) < 1e-9 else (w ** (1.0 - g) - 1.0) / (1.0 - g)


def kt_weight(p, g):
    return p ** g / (p ** g + (1 - p) ** g) ** (1.0 / g)


def ladder_switch(gamma):
    """First row whose gamble beats leaving the corpus untouched, under CRRA."""
    base = crra(1.0, gamma)
    down = crra(1.0 - LADDER_DOWN, gamma)
    for i, up in enumerate(LADDER_UP, start=1):
        if 0.5 * crra(1.0 + up, gamma) + 0.5 * down >= base:
            return i
    return 11


def jitter(x, pct, step):
    """Human rounding: small proportional error, then snapped to a plausible step."""
    v = x * (1.0 + random.gauss(0.0, pct))
    return round(v / step) * step


TRUE = [
    dict(member_id="M1", name="Member 1", persona="Cautious accumulator", age=23,
         corpus=800000, horizon=5, goal="Capital preservation",
         gamma=6.0, alpha=0.72, beta_loss=0.89, lam=2.90, gw=0.58,
         present_bias=0.97, delta_m=0.9901,
         bfi=dict(E=2.83, A=4.17, C=4.00, N=3.67, O=3.00),
         floor=800000, floor_alpha=0.05, income=0, aspiration=1400000,
         sec_points=80, asp_tradeoff=12000),
    dict(member_id="M2", name="Member 2", persona="Balanced planner", age=24,
         corpus=1500000, horizon=5, goal="Wealth creation",
         gamma=3.2, alpha=0.86, beta_loss=0.88, lam=2.25, gw=0.62,
         present_bias=0.99, delta_m=0.9852,
         bfi=dict(E=3.50, A=3.83, C=3.67, N=2.83, O=3.50),
         floor=1200000, floor_alpha=0.10, income=60000, aspiration=2600000,
         sec_points=55, asp_tradeoff=40000),
    dict(member_id="M3", name="Member 3", persona="Growth seeker", age=23,
         corpus=1000000, horizon=7, goal="Wealth creation",
         gamma=1.6, alpha=0.93, beta_loss=0.91, lam=1.55, gw=0.71,
         present_bias=1.00, delta_m=0.9804,
         bfi=dict(E=3.83, A=3.00, C=3.33, N=2.17, O=4.33),
         floor=500000, floor_alpha=0.20, income=0, aspiration=3000000,
         sec_points=30, asp_tradeoff=90000),
    dict(member_id="M4", name="Member 4", persona="Impatient saver", age=25,
         corpus=600000, horizon=4, goal="Specified goal",
         gamma=3.6, alpha=0.84, beta_loss=0.87, lam=2.45, gw=0.60,
         present_bias=0.82, delta_m=0.9823,
         bfi=dict(E=3.67, A=3.50, C=2.50, N=3.17, O=3.33),
         floor=450000, floor_alpha=0.10, income=0, aspiration=1100000,
         sec_points=60, asp_tradeoff=25000),
    dict(member_id="M5", name="Member 5", persona="Capital protector", age=26,
         corpus=2500000, horizon=5, goal="Capital preservation",
         gamma=7.5, alpha=0.68, beta_loss=0.92, lam=3.40, gw=0.55,
         present_bias=0.98, delta_m=0.9921,
         bfi=dict(E=2.50, A=3.67, C=4.33, N=4.00, O=2.50),
         floor=2400000, floor_alpha=0.02, income=120000, aspiration=3300000,
         sec_points=90, asp_tradeoff=15000),
    dict(member_id="M6", name="Member 6", persona="Lottery optimist", age=22,
         corpus=700000, horizon=6, goal="Wealth creation",
         gamma=2.1, alpha=0.90, beta_loss=0.86, lam=1.80, gw=0.49,
         present_bias=0.86, delta_m=0.9756,
         bfi=dict(E=4.33, A=3.33, C=2.83, N=2.67, O=4.00),
         floor=300000, floor_alpha=0.25, income=0, aspiration=2800000,
         sec_points=25, asp_tradeoff=70000),
]


def build(t):
    g, corpus = t["gamma"], float(t["corpus"])
    # Wealth is carried as a multiple of the corpus throughout. The probability
    # equivalence p is a ratio of utility differences, and CRRA scales those by a
    # common factor, so normalising leaves every answer unchanged while keeping the
    # powers inside float range.

    # Section 2: wealth-framed risk ladder, recorded as the switch row.
    hl = ladder_switch(g)

    # Section 3: two titrations. The front-end-delay pair identifies present bias,
    # the 12-vs-13-month pair identifies the long-run monthly discount factor.
    td_1m = jitter(10000.0 / (t["present_bias"] * t["delta_m"]), 0.010, 50)
    td_13m = jitter(10000.0 / t["delta_m"], 0.006, 10)

    # Section 5: von Neumann-Morgenstern utility by probability equivalence.
    u_lo, u_hi = crra(UTIL_LO, g), crra(UTIL_HI, g)
    util = [round(min(0.99, max(0.01, jitter((crra(m, g) - u_lo) / (u_hi - u_lo), 0.030, 0.01))), 2)
            for m in UTIL_GRID]

    # Section 6: prospect-theory value function, also by probability equivalence,
    # against a +/-100%-of-corpus anchor. Linear probabilities during elicitation.
    vg = [round(min(0.99, max(0.01, jitter((x / VF_ANCHOR) ** t["alpha"], 0.030, 0.01))), 2) for x in VF_GAIN]
    vl = [round(min(0.99, max(0.01, jitter((x / VF_ANCHOR) ** t["beta_loss"], 0.030, 0.01))), 2) for x in VF_LOSS]
    abar = 0.5 * (t["alpha"] + t["beta_loss"])
    mixed_g = jitter(MIXED_LOSS * t["lam"] ** (1.0 / abar), 0.025, 500)

    # Section 7: certainty equivalents that pin down the weighting function.
    pw = [jitter(PW_STAKE * (kt_weight(p, t["gw"]) ** (1.0 / t["alpha"])), 0.025, 50) for p in PW_P]

    # Section 4: BFI-2-S item responses reconstructed from the domain means so the
    # portal's item-level scoring reproduces the stored domain scores.
    bfi_items = {}
    for d in BFI_DOMAINS:
        target = t["bfi"][d]
        total = round(target * 6)
        vals = [3] * 6
        i, delta = 0, total - 18
        while delta != 0:
            step = 1 if delta > 0 else -1
            if 1 <= vals[i % 6] + step <= 5:
                vals[i % 6] += step
                delta -= step
            i += 1
        random.shuffle(vals)
        bfi_items[d] = vals

    return dict(
        member_id=t["member_id"], name=t["name"], persona=t["persona"], age=t["age"],
        corpus_inr=t["corpus"], horizon_years=t["horizon"], goal=t["goal"],
        ladder_switch_row=hl,
        td_indiff_1m=td_1m, td_indiff_13m=td_13m,
        util_grid=UTIL_GRID, util_p=util, util_lo=UTIL_LO, util_hi=UTIL_HI,
        vf_gain_x=VF_GAIN, vf_gain_p=vg, vf_loss_x=VF_LOSS, vf_loss_p=vl,
        vf_mixed_loss=MIXED_LOSS, vf_mixed_gain=mixed_g,
        pw_p=PW_P, pw_stake=PW_STAKE, pw_ce=pw,
        bfi_items=bfi_items,
        floor_inr=t["floor"], floor_alpha=t["floor_alpha"],
        income_need_pa=t["income"], aspiration_inr=t["aspiration"],
        security_points=t["sec_points"], aspiration_tradeoff_inr=t["asp_tradeoff"],
        _true=dict(gamma=t["gamma"], alpha=t["alpha"], beta_loss=t["beta_loss"],
                   lam=t["lam"], gamma_w=t["gw"], present_bias=t["present_bias"],
                   delta_monthly=t["delta_m"]),
    )


if __name__ == "__main__":
    import os
    out = [build(t) for t in TRUE]
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "responses.json")
    with open(path, "w") as fh:
        json.dump(out, fh, indent=1)
    print(f"wrote {len(out)} responses to {path}")
    for r in out:
        print(f"  {r['member_id']}  ladder row {r['ladder_switch_row']}  "
              f"U(p)={r['util_p']}  gain p={r['vf_gain_p']}  G={r['vf_mixed_gain']:.0f}  "
              f"CE={[round(c) for c in r['pw_ce']]}")
