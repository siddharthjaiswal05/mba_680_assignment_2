# MBA680 Problem Statement 2

Personal financial planning and robo-advisory design. A peer group is surveyed on risk,
time, loss and personality; each person's utility and value functions are estimated from
their own answers; and each is given two portfolios built from the Problem Statement 1
equity portfolio, one under expected utility theory and one under behavioral portfolio
theory.

## Deliverables

| Path | What it is |
|---|---|
| `report/MBA680_PS2_Report.docx` | The report: instrument, method, results, recommendations |
| `docs/index.html` | The interactive robo-advisory portal, ready for GitHub Pages |
| `engine/` | The estimation and portfolio engine, and everything that feeds the report |
| `figures/` | Figures 1 to 10, regenerated from the engine outputs |

## Reproducing every number

Four steps, in order. Each reads only the output of the one before it.

```bash
cd engine
python make_pilot_data.py     # responses.json          (replace with fielded data)
python robo_engine.py         # outputs/analysis.json, outputs/summary.csv
python make_figures.py        # ../figures/*.png
python sync_portal_pilot.py   # refreshes the portal's bundled pilot dataset
npm install && node make_report.js   # ../report/MBA680_PS2_Report.docx
```

Python needs numpy and scipy. The report step needs the `docx` npm package.

## Fielding it for real

The pilot dataset is generated from six assumed preference profiles so that the estimators
could be validated against a known answer before the survey was fielded. That recovery
check is reported in Section 5.1 of the report.

To use real responses, collect them through the portal, which exports one JSON file per
respondent, and assemble them into `engine/responses.json`. Nothing downstream changes.

## What the engine does

- Fits relative risk aversion by least squares over five probability equivalences, with an
  independent bracket from a wealth-framed risk ladder
- Fits the prospect-theory value function as two regressions through the origin, and quotes
  loss aversion at the common curvature because it is not scale free otherwise
- Fits the Kahneman-Tversky weighting function over two elicited points, leaving the fit
  over-identified so the residual is visible
- Separates present bias from the long-run discount factor using a front-end-delay pair
- Builds the mean-variance complete portfolio on the capital allocation line
- Builds both behavioral portfolios from Shefrin and Statman (2000): the single-account
  SP/A optimum and the layered multiple-mental-account portfolio
- Prices the layered portfolio against the capital allocation line, so the cost of layering
  is a number rather than an assertion
