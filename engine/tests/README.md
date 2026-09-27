# Checks

Three scripts, run from `engine/`:

| Script | What it proves |
|---|---|
| `xcheck.js` | The portal's JavaScript and the Python engine agree. Compares 72 quantities across the six pilot members. |
| `smoke.js` | The portal actually renders and wires up: the survey builds, a plan is produced, the group view populates, and no NaN reaches the DOM. |
| `roundtrip.js` | Writing a respondent into the form and reading it back produces identical results, and an unreachable floor is rejected with a readable message. |

```bash
cd engine && npm install && npm test
```

`xcheck.js` needs `outputs/analysis.json`, so run `robo_engine.py` first.
The other two need `jsdom`.

`roundtrip.js` exists because of a real bug it now guards. `writeForm` set the
floor-tolerance dropdown to `"0.1"` while its option value was `"0.10"`. The
select matched nothing, the value came back empty, `floorAlpha` became NaN, every
allocation compared false against it, and the behavioral portfolio silently
collapsed to zero equity for every respondent. Nothing threw. The only visible
symptom was a plausible-looking wrong number.
