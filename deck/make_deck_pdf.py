"""
Builds MBA680_Presentation.pdf from content.json.

Design follows the group's agreed template: a navy header band with a teal rule,
light panels carrying a coloured accent bar, and a footer naming the group on
every slide.

Normally the PDF would be exported from the .pptx through LibreOffice. This
machine has neither, so the PDF is rendered directly. Both renderers read one
content file, so the words and numbers are identical by construction.

Run:  python make_deck_pdf.py
"""
import json, os, textwrap
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle, FancyBboxPatch
from matplotlib.backends.backend_pdf import PdfPages
import matplotlib.image as mpimg

HERE = os.path.dirname(os.path.abspath(__file__))
C = json.load(open(os.path.join(HERE, "content.json")))
T, ACC, TEAM = C["theme"], C["accents"], C["team"]
FIG = os.path.join(HERE, "..", "figures")
hx = lambda k: "#" + T[k]

W, H = 13.333, 7.5
M = 0.55
CW = W - 2 * M
BAND = 1.28          # header band height
RULE = 0.075         # teal rule under the band
N = len(C["slides"])
FOOT = "MBA680 Group Project  |  " + ", ".join(TEAM)

plt.rcParams.update({"font.family": "DejaVu Sans"})


def page(bg="white"):
    fig = plt.figure(figsize=(W, H), dpi=150)
    ax = fig.add_axes([0, 0, 1, 1]); ax.set_xlim(0, W); ax.set_ylim(0, H); ax.axis("off")
    fig.patch.set_facecolor(bg); ax.set_facecolor(bg)
    return fig, ax


def T_(ax, x, y, s, size=12, color=None, weight="normal", style="normal",
       va="top", ha="left", lh=1.3):
    return ax.text(x, y, s, fontsize=size, color=color or hx("ink"), fontweight=weight,
                   fontstyle=style, va=va, ha=ha, linespacing=lh)


def wrap(s, inches, size):
    chars = max(8, int(inches / (size * 0.0092)))
    return "\n".join(textwrap.wrap(str(s), chars))


def WT(ax, x, y, s, inches, size=12, **kw):
    return T_(ax, x, y, wrap(s, inches, size), size=size, **kw)


def header(ax, kicker, title):
    ax.add_patch(Rectangle((0, H - BAND), W, BAND, fc=hx("navy"), ec="none", zorder=1))
    ax.add_patch(Rectangle((0, H - BAND - RULE), W, RULE, fc=hx("rule"), ec="none", zorder=1))
    T_(ax, M, H - 0.34, kicker, size=9.5, color=hx("rule"), weight="bold", va="center")
    T_(ax, M, H - 0.78, title, size=24, color=hx("white"), weight="bold", va="center")


def footer(ax, n):
    T_(ax, M, 0.3, FOOT, size=8, color=hx("ink3"), va="center")
    T_(ax, W - M, 0.3, f"{n} / {N}", size=8, color=hx("ink3"), va="center", ha="right")


def panel(ax, x, y, w, h, accent=None, fc=None):
    """Light panel with an optional coloured bar down its left edge."""
    ax.add_patch(Rectangle((x, y), w, h, fc=fc or hx("panel"), ec="none", zorder=1))
    if accent:
        ax.add_patch(Rectangle((x, y), 0.065, h, fc=hx(accent), ec="none", zorder=2))


def topbar_card(ax, x, y, w, h, accent, head, body):
    """Panel with the accent bar across the top, used for the overview row."""
    ax.add_patch(Rectangle((x, y), w, h, fc=hx("panel"), ec="none", zorder=1))
    ax.add_patch(Rectangle((x, y + h - 0.055), w, 0.055, fc=hx(accent), ec="none", zorder=2))
    WT(ax, x + 0.2, y + h - 0.28, head, w - 0.4, size=12.5, weight="bold", color=hx("ink"))
    nl = len(wrap(head, w - 0.4, 12.5).split("\n"))
    WT(ax, x + 0.2, y + h - 0.3 - 0.22 * nl, body, w - 0.4, size=9.5,
       color=hx("ink2"), lh=1.32)


def side_card(ax, x, y, w, h, accent, head, body, hs=12.5, bs=10.5):
    panel(ax, x, y, w, h, accent)
    WT(ax, x + 0.26, y + h - 0.24, head, w - 0.5, size=hs, weight="bold", color=hx("ink"))
    nl = len(wrap(head, w - 0.5, hs).split("\n"))
    WT(ax, x + 0.26, y + h - 0.24 - 0.22 * nl - 0.12, body, w - 0.5, size=bs,
       color=hx("ink2"), lh=1.38)


def table(ax, x, y, w, head, rows, widths, fs=10, hfs=9.5, rowmin=0.36):
    scale = w / sum(widths)
    widths = [v * scale for v in widths]
    xs = [x]
    for v in widths[:-1]:
        xs.append(xs[-1] + v)
    hh = 0.4
    ax.add_patch(Rectangle((x, y - hh), w, hh, fc=hx("navy"), ec="none", zorder=1))
    for cx, cw, c in zip(xs, widths, head):
        T_(ax, cx + cw / 2, y - hh / 2, wrap(c, cw - 0.16, hfs), size=hfs,
           color=hx("white"), weight="bold", va="center", ha="center")
    yy = y - hh
    for ri, row in enumerate(rows):
        cells = [wrap(c, cw - 0.16, fs) for cw, c in zip(widths, row)]
        rh = max(rowmin, 0.19 * max(len(c.split("\n")) for c in cells) + 0.18)
        if ri % 2 == 0:
            ax.add_patch(Rectangle((x, yy - rh), w, rh, fc="#EAF4F3", ec="none", zorder=1))
        for cx, cw, c in zip(xs, widths, cells):
            T_(ax, cx + cw / 2, yy - rh / 2, c, size=fs, color=hx("ink"),
               va="center", ha="center")
        ax.plot([x, x + w], [yy - rh, yy - rh], color=hx("line"), lw=0.7, zorder=2)
        yy -= rh
    return yy


def put_fig(ax, name, x, y, w, h):
    p = os.path.join(FIG, name)
    if not os.path.exists(p):
        return
    im = mpimg.imread(p)
    ih, iw = im.shape[0], im.shape[1]
    r = min(w / iw, h / ih)
    ww, hh = iw * r, ih * r
    ax.imshow(im, extent=[x + (w - ww) / 2, x + (w - ww) / 2 + ww,
                          y + (h - hh) / 2, y + (h - hh) / 2 + hh], aspect="auto", zorder=3)


def bullets(ax, x, y, items, inches, size=10.5, color=None, accent="rule"):
    for it in items:
        txt = wrap(it, inches - 0.25, size)
        ax.add_patch(Rectangle((x, y - 0.115), 0.085, 0.085, fc=hx(accent), ec="none", zorder=3))
        T_(ax, x + 0.19, y, txt, size=size, color=color or hx("ink2"), lh=1.38)
        y -= 0.175 * len(txt.split("\n")) + 0.14
    return y


# ----------------------------------------------------------------- layouts
def render(d, n, pdf):
    L = d["layout"]

    if L == "title":
        fig, ax = page(hx("navy"))
        ax.add_patch(Rectangle((M, 3.55), 0.075, 2.2, fc=hx("orange"), ec="none"))
        T_(ax, M + 0.32, 5.62, d["kicker"], size=11, color=hx("rule"), weight="bold", va="center")
        WT(ax, M + 0.32, 5.3, d["title"], CW - 2.6, size=31, color=hx("white"), weight="bold")
        T_(ax, M + 0.32, 4.02, d["sub"], size=13.5, color="#C7D4E0")
        T_(ax, M + 0.32, 3.6, d["portal"], size=11, color=hx("rule"))
        ax.add_patch(Rectangle((0, 2.72), W, 0.055, fc=hx("rule"), ec="none"))
        T_(ax, M, 2.4, "PRESENTED BY", size=9.5, color=hx("rule"), weight="bold", va="center")
        gap, cw = 0.2, (CW - 0.6) / 4
        for i, name in enumerate(d["team"]):
            x = M + i * (cw + gap)
            ax.add_patch(FancyBboxPatch((x, 1.25), cw, 0.72,
                boxstyle="round,pad=0,rounding_size=0.05",
                fc=hx("navyMid"), ec="none"))
            T_(ax, x + cw / 2, 1.61, name, size=13, color=hx("white"), weight="bold",
               va="center", ha="center")
        pdf.savefig(fig); plt.close(fig); return

    fig, ax = page()
    header(ax, d["kicker"], d["title"])
    footer(ax, n)
    top = H - BAND - RULE - 0.3

    if L == "cards+table":
        gap, cw = 0.22, (CW - 0.66) / 4
        for i, c in enumerate(d["cards"]):
            topbar_card(ax, M + i * (cw + gap), top - 1.18, cw, 1.18, ACC[i % 5], c["h"], c["b"])
        y = top - 1.52
        T_(ax, M, y, d["tableTitle"], size=13, weight="bold", color=hx("ink"))
        y -= 0.3
        yy = table(ax, M, y, CW, d["head"], d["rows"], [1.5, 0.7, 1.7, 1.3, 1.0, 1.9, 1.9])
        WT(ax, M, yy - 0.22, d["foot"], CW, size=9.5, color=hx("ink3"))

    elif L == "cards4big":
        gap = 0.26; cw = (CW - gap) / 2; ch = (top - 0.75 - gap) / 2
        for i, c in enumerate(d["cards"]):
            x = M + (i % 2) * (cw + gap); y = top - ch - (i // 2) * (ch + gap)
            side_card(ax, x, y, cw, ch, ACC[i % 5], c["h"], c["b"], hs=13, bs=10.5)

    elif L == "method":
        cw = CW * 0.48; gap = CW - 2 * cw
        ch = (top - 0.72 - 3 * 0.14) / 4
        for i, c in enumerate(d["cards"]):
            side_card(ax, M, top - ch - i * (ch + 0.14), cw, ch, ACC[i % 5],
                      c["h"], c["b"], hs=11.5, bs=9.5)
        x2 = M + cw + gap
        T_(ax, x2, top, d["tableTitle"], size=13, weight="bold", color=hx("ink"))
        yy = table(ax, x2, top - 0.3, cw, d["head"], d["rows"], [1.1, 2.4, 2.0], fs=9, hfs=9)
        WT(ax, x2, yy - 0.2, d["foot"], cw, size=9.5, color=hx("ink"), weight="bold")

    elif L == "table+figure":
        cw = CW * 0.49; x2 = M + CW - cw
        T_(ax, M, top, d["tableTitle"], size=13, weight="bold", color=hx("ink"))
        yy = table(ax, M, top - 0.3, cw, d["head"], d["rows"], [1.2, 2.6, 0.8, 1.2], fs=9.5, hfs=9)
        yb = bullets(ax, M, yy - 0.3, d["bullets"], cw, size=10)
        put_fig(ax, d["image"], x2, top - 2.6, cw, 2.6)
        ch = 1.5
        side_card(ax, x2, top - 2.6 - 0.26 - ch, cw, ch, "orange",
                  d["card"]["h"], d["card"]["b"], hs=12.5, bs=10)

    elif L == "figure+table":
        cw = CW * 0.50; x2 = M + CW - cw
        WT(ax, M, top, d["lead"], cw, size=11, style="italic", color=hx("ink2"))
        put_fig(ax, d["image"], M, top - 3.3, cw, 2.95)
        bullets(ax, M, top - 3.55, d["bullets"], cw, size=10)
        T_(ax, x2, top, d["tableTitle"], size=13, weight="bold", color=hx("ink"))
        table(ax, x2, top - 0.3, cw, d["head"], d["rows"],
              [1.2, 1.6, 1.2, 1.0, 1.7] if len(d["head"]) == 5 else [1.2] * len(d["head"]),
              fs=9.5, hfs=9)

    elif L == "table2+figure":
        cw = CW * 0.52; x2 = M + CW - CW * 0.44
        WT(ax, M, top, d["lead"], cw, size=11, style="italic", color=hx("ink2"))
        y = top - 0.5
        yy = table(ax, M, y, cw, d["headA"], d["rowsA"], [1.5, 0.9, 0.8, 2.6], fs=9.5, hfs=9)
        yy = table(ax, M, yy - 0.34, cw, d["headB"], d["rowsB"],
                   [1.4, 0.6, 1.3, 1.2, 0.9, 1.0], fs=9.5, hfs=9)
        put_fig(ax, d["image"], x2, top - 3.0, CW * 0.44, 3.0)
        side_card(ax, x2, top - 3.0 - 0.24 - 1.85, CW * 0.44, 1.85, "teal",
                  d["card"]["h"], d["card"]["b"], hs=12.5, bs=10)

    elif L == "two-cards":
        cw = (CW - 0.3) / 2; x2 = M + cw + 0.3
        T_(ax, M, top, d["leftTitle"], size=13, weight="bold", color=hx("ink"))
        ch = 0.86
        for i, c in enumerate(d["left"]):
            y = top - 0.32 - ch - i * (ch + 0.14)
            side_card(ax, M, y, cw, ch, "teal", c["h"], c["b"], hs=12, bs=10)
        T_(ax, x2, top, d["rightTitle"], size=13, weight="bold", color=hx("ink"))
        for i, c in enumerate(d["right"]):
            y = top - 0.32 - ch - i * (ch + 0.14)
            ax.add_patch(Rectangle((x2, y), cw, ch, fc=hx("panel"), ec="none", zorder=1))
            ax.add_patch(Rectangle((x2, y), 0.62, ch, fc=hx(ACC[i % 5]), ec="none", zorder=2))
            T_(ax, x2 + 0.31, y + ch / 2, c["n"], size=15, color=hx("white"), weight="bold",
               va="center", ha="center")
            WT(ax, x2 + 0.78, y + ch - 0.16, c["b"], cw - 1.0, size=10, color=hx("ink"))
            T_(ax, x2 + 0.78, y + 0.26, c["i"], size=9, color=hx(ACC[i % 5]), weight="bold",
               va="center")
        WT(ax, M, top - 0.32 - 4 * ch - 3 * 0.14 - 0.22, d["foot"], CW, size=10,
           color=hx("ink2"), style="italic")

    elif L == "figure+cards":
        cw = CW * 0.46; x2 = M + CW - CW * 0.51
        put_fig(ax, d["image"], M, top - 3.0, cw, 3.0)
        side_card(ax, M, top - 3.0 - 0.24 - 1.25, cw, 1.25, "teal",
                  d["card"]["h"], d["card"]["b"], hs=12.5, bs=10)
        ch = (top - 0.72 - 3 * 0.12) / 4
        for i, c in enumerate(d["cards"]):
            side_card(ax, x2, top - ch - i * (ch + 0.12), CW * 0.51, ch, ACC[i % 5],
                      c["h"], c["b"], hs=11.5, bs=9.5)

    elif L == "cards3":
        WT(ax, M, top, d["lead"], CW, size=11.5, style="italic", color=hx("ink2"))
        gap = 0.3; cw = (CW - 2 * gap) / 3; y = 1.55; ch = top - 0.45 - y
        for i, c in enumerate(d["cards"]):
            side_card(ax, M + i * (cw + gap), y, cw, ch, ACC[i % 5], c["h"], c["b"],
                      hs=14, bs=11)
        ax.add_patch(Rectangle((M, 0.72), CW, 0.6, fc=hx("navy"), ec="none"))
        T_(ax, W / 2, 1.02, d["foot"], size=13, color=hx("white"), weight="bold",
           va="center", ha="center")

    elif L == "close":
        gap = 0.18; cw = (CW - 4 * gap) / 5; ch = 1.55
        for i, c in enumerate(d["cards"]):
            topbar_card(ax, M + i * (cw + gap), top - ch, cw, ch, ACC[i % 5], c["h"], c["b"])
        bullets(ax, M, top - ch - 0.42, d["points"], CW, size=11, color=hx("ink"))
        ax.add_patch(Rectangle((M, 0.78), CW, 0.62, fc=hx("navy"), ec="none"))
        T_(ax, W / 2, 1.09, d["quote"], size=13.5, color=hx("white"), weight="bold",
           va="center", ha="center")

    pdf.savefig(fig); plt.close(fig)


def main():
    out = os.path.join(HERE, "MBA680_Presentation.pdf")
    with PdfPages(out) as pdf:
        for i, d in enumerate(C["slides"], start=1):
            render(d, i, pdf)
        info = pdf.infodict()
        info["Title"] = "MBA680 Personal Investment Advisor and Robo-Advisory Project"
        info["Author"] = ", ".join(TEAM)
    print(f"wrote {out}  ({N} slides)")


if __name__ == "__main__":
    main()
