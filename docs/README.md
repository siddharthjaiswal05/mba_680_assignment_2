# Layered

A robo-advisory prototype built for MBA680 (Behavioral Finance), Problem Statement 2.

It fields an eight-section preference survey, fits each respondent's utility function,
value function, probability weighting function and discount factors from their own
answers, and then builds two portfolios out of the same risky engine: the one expected
utility theory says they should hold, and the one behavioral portfolio theory says they
will actually hold.

Everything runs in the browser. There is no server, no account and no database, and
nothing leaves the device unless the respondent exports it.

## What is in it

| Tab | What it does |
|---|---|
| Survey | The full instrument, including 30 personality items, with autosave and export |
| My plan | Fitted parameters, the three curves, both portfolios, and the advisory commentary |
| Peer group | Loads several exported responses and compares them |
| Method | Every formula and every assumption, on the same page as the output |

## The risky engine

The risky portfolio is the 60-stock maximum-Sharpe portfolio from Problem Statement 1:
24.93% expected return against 17.97% volatility in sample, with a 6.50% risk-free rate.
Nothing here re-optimises it. The plan only decides how much of it to hold, and against
what else.

Those expected returns are three-year in-sample means, so advice is given on a base case
that shrinks the return 75% of the way to a long-run equity prior. All three input sets
are shown side by side.

## Running it

It is a single static file. Open `index.html`, or serve the folder:

```
python3 -m http.server 8000
```

## Deploying to GitHub Pages

```
git init
git add .
git commit -m "Layered: MBA680 robo-advisory portal"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

Then in the repository, open Settings, Pages, and set the source to `main` with the root
folder. The `.nojekyll` file stops GitHub from hiding anything.

## Checks

The portal's maths is cross-checked against the Python engine that produces the report.
The pilot dataset bundled here is generated from the same response file the engine reads,
and a test compares 72 quantities across the six pilot members. They agree to within half
a percent, the residual being a coarser search grid in the browser.

Nothing here is investment advice.
