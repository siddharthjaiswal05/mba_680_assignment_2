"""
Rewrites the PILOT block inside portal/index.html from responses.json.

The portal ships the pilot peer group so its group view is never empty. Typing
that data in by hand is how the portal and the report quietly drift apart, so it
is generated instead. Run this after changing responses.json.

The only fiddly part is the personality items. responses.json stores six
already-reverse-scored values per domain; the portal stores thirty raw item
responses and applies the reverse keys itself. So each scored value is mapped
back to a raw one (raw = 6 - scored on a reverse-keyed item) and dropped into the
position the portal's item list expects.
"""
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
PORTAL = os.path.abspath(os.path.join(HERE, "..", "portal", "index.html"))

GOAL_MAP = {"Specified goal": "A specific purchase"}


def portal_bfi_spec(html):
    """Read the portal's own item list so the two can never disagree about order."""
    block = re.search(r"const BFI = \[(.*?)\n\];", html, re.S).group(1)
    items = []
    for line in block.strip().splitlines():
        m = re.search(r'\{d:"(\w)".*?\}', line)
        if m:
            items.append({"d": m.group(1), "r": ", r:1}" in line or ",r:1}" in line})
    assert len(items) == 30, f"expected 30 items, read {len(items)}"
    return items


def raw_items(scored_by_domain, spec):
    """Place each domain's scored values into the portal's item order, un-reversed."""
    cursor = {d: 0 for d in scored_by_domain}
    out = []
    for it in spec:
        v = scored_by_domain[it["d"]][cursor[it["d"]]]
        cursor[it["d"]] += 1
        out.append(6 - v if it["r"] else v)
    return out


def main():
    html = open(PORTAL, encoding="utf-8").read()
    spec = portal_bfi_spec(html)
    members = json.load(open(os.path.join(HERE, "responses.json")))

    blocks = []
    for m in members:
        d = {
            "id": m["member_id"],
            "name": f"{m['name']} · {m['persona']}",
            "age": m["age"], "corpus": m["corpus_inr"], "horizon": m["horizon_years"],
            "goal": GOAL_MAP.get(m["goal"], m["goal"]),
            "ladderRow": m["ladder_switch_row"],
            "td1": m["td_indiff_1m"], "td13": m["td_indiff_13m"],
            "utilP": m["util_p"], "gainP": m["vf_gain_p"], "lossP": m["vf_loss_p"],
            "mixedGain": m["vf_mixed_gain"], "pwCe": m["pw_ce"],
            "bfi": raw_items(m["bfi_items"], spec),
            "floor": m["floor_inr"], "floorAlpha": m["floor_alpha"],
            "income": m["income_need_pa"], "aspiration": m["aspiration_inr"],
            "secPoints": m["security_points"], "tradeoff": m["aspiration_tradeoff_inr"],
        }
        body = ",".join(f'{k}:{json.dumps(v)}' for k, v in d.items())
        blocks.append(" {" + body + "}")

    new = ("const PILOT = [\n" + ",\n".join(blocks) + "\n];")
    out, n = re.subn(r"const PILOT = \[.*?\n\];", lambda _: new, html, flags=re.S)
    assert n == 1, f"expected one PILOT block, replaced {n}"
    open(PORTAL, "w", encoding="utf-8").write(out)
    print(f"rewrote the PILOT block in {PORTAL} with {len(members)} members")


if __name__ == "__main__":
    main()
