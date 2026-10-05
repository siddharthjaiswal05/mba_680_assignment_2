"""
Builds MBA680_Presentation.pdf from the same content.json the .pptx is built from.

Normally a PDF would be exported from the .pptx through LibreOffice. This machine
has no LibreOffice and only a few GB of free disk, so the PDF is rendered directly
instead. Both renderers read one content file, so the words and numbers are
identical by construction; only the typesetting engine differs.

Run:  python make_deck_pdf.py
"""
import json, os, textwrap
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch
from matplotlib.backends.backend_pdf import PdfPages
import matplotlib.image as mpimg

HERE = os.path.dirname(os.path.abspath(__file__))
C = json.load(open(os.path.join(HERE, "content.json")))
T = C["theme"]
FIG = os.path.join(HERE, "..", "figures")
hx = lambda k: "#" + T[k]

W, H = 13.333, 7.5
M = 0.72
CW = W - 2 * M
HEAD, BODY = "DejaVu Serif", "DejaVu Sans"

plt.rcParams.update({"font.family": BODY})


def page(pdf, bg):
    fig = plt.figure(figsize=(W, H), dpi=150)
    ax = fig.add_axes([0, 0, 1, 1]); ax.set_xlim(0, W); ax.set_ylim(0, H)
    ax.axis("off"); ax.set_facecolor(bg); fig.patch.set_facecolor(bg)
    return fig, ax


def txt(ax, x, y, s, size=13, color=None, weight="normal", style="normal",
        wrap=None, va="top", ha="left", font=BODY, lh=1.25, spacing=0):
    color = color or hx("ink")
    if wrap:
        s = "\n".join(textwrap.wrap(s, wrap)) if isinstance(s, str) else s
    if spacing:
        s = (" " * 0).join(s)
    t = ax.text(x, y, s, fontsize=size, color=color, fontweight=weight,
                fontstyle=style, va=va, ha=ha, family=font, linespacing=lh,
                transform=ax.transData)
    return t


def wrapped(ax, x, y, s, width_in, size=13, **kw):
    """Wrap on an approximate character width for the given box width."""
    chars = max(10, int(width_in / (size * 0.0088)))
    return txt(ax, x, y, "\n".join(textwrap.wrap(s, chars)), size=size, **kw)


def rrect(ax, x, y, w, h, fc, ec=None, lw=1.0):
    ax.add_patch(FancyBboxPatch((x, y), w, h,
        boxstyle="round,pad=0,rounding_size=0.07",
        facecolor=fc, edgecolor=ec or fc, linewidth=lw, zorder=1))


def light_head(ax, title, dark=False):
    txt(ax, M, H - 0.72, title, size=25, weight="bold", font=HEAD,
        color=hx("white") if dark else hx("navy"), va="center")


def foot(ax, n):
    txt(ax, M, 0.38, "MBA680 Behavioral Finance  |  Problem Statement 2",
        size=9, color=hx("ink3"), va="center")
    txt(ax, W - M, 0.38, str(n), size=9, color=hx("ink3"), va="center", ha="right")


def bullets(ax, x, y, items, width_in, size=12.5, color=None, gap=0.30):
    color = color or hx("ink")
    for it in items:
        chars = max(10, int(width_in / (size * 0.0092)))
        lines = textwrap.wrap(it, chars)
        ax.plot([x + 0.07], [y - 0.085], marker="o", ms=3.4,
                color=hx("amber"), zorder=3)
        txt(ax, x + 0.26, y, "\n".join(lines), size=size, color=color, lh=1.3)
        y -= 0.21 * len(lines) + gap
    return y


def card(ax, x, y, w, h, n, head, body, big=True):
    rrect(ax, x, y, w, h, hx("white"), hx("line"), 1.0)
    txt(ax, x + 0.32, y + h - 0.34, n, size=20 if big else 14.5, weight="bold",
        color=hx("amber"), va="center")
    wrapped(ax, x + 0.32, y + h - 0.78, head, w - 0.64, size=14,
            weight="bold", color=hx("navy"), font=HEAD)
    wrapped(ax, x + 0.32, y + h - 1.22, body, w - 0.64, size=11, color=hx("ink2"))


def put_fig(ax, name, x, y, w, h):
    p = os.path.join(FIG, name)
    if not os.path.exists(p):
        return
    im = mpimg.imread(p)
    ih, iw = im.shape[0], im.shape[1]
    r = min(w / iw, h / ih)
    ww, hh = iw * r, ih * r
    ax.imshow(im, extent=[x + (w - ww) / 2, x + (w - ww) / 2 + ww,
                          y + (h - hh) / 2, y + (h - hh) / 2 + hh],
              aspect="auto", zorder=2)


def render(d, n, pdf):
    L = d["layout"]
    dark = L in ("title", "statement", "close")
    fig, ax = page(pdf, hx("navy") if dark else
                   (hx("surface") if L in ("cards3", "cards4", "stat") else hx("white")))

    if L == "title":
        txt(ax, M, H - 1.6, "MBA680   |   BEHAVIORAL FINANCE", size=11.5, weight="bold",
            color=hx("amber"), va="center")
        wrapped(ax, M, H - 2.25, d["title"], CW - 1.4, size=32, weight="bold",
                color=hx("white"), font=HEAD, lh=1.15)
        wrapped(ax, M, 3.1, d["kicker"], CW - 3.4, size=15, style="italic",
                color=hx("ice"))
        txt(ax, M, 2.25, d["subtitle"], size=11.5, color=hx("ink3"))
        txt(ax, M, 1.5, "      ".join(d["team"]), size=13.5, weight="bold",
            color=hx("white"))
        txt(ax, M, 1.08, "Indian Institute of Technology Kanpur", size=10.5,
            color=hx("ink3"))

    elif L == "statement":
        txt(ax, M, H - 1.35, d["title"].upper(), size=11.5, weight="bold",
            color=hx("amber"), va="center")
        wrapped(ax, M, H - 1.85, d["big"], CW - 1.2, size=28, weight="bold",
                color=hx("white"), font=HEAD, lh=1.18)
        wrapped(ax, M, 3.0, d["body"], CW - 2.9, size=13.5, color=hx("ice"), lh=1.35)

    elif L in ("cards3", "cards4"):
        light_head(ax, d["title"])
        y = H - 1.4
        if d.get("lead"):
            wrapped(ax, M, y, d["lead"], CW - 1.0, size=13, style="italic",
                    color=hx("ink2")); y -= 0.6
        cards = d["cards"]; k = len(cards); gap = 0.30
        cw = (CW - gap * (k - 1)) / k
        bottom = 1.25 if d.get("foot") else 0.85
        ch = y - bottom
        for i, c in enumerate(cards):
            card(ax, M + i * (cw + gap), bottom, cw, ch, c["n"], c["h"], c["b"],
                 big=(L == "cards3"))
        if d.get("foot"):
            txt(ax, W / 2, 0.86, d["foot"], size=12.5, weight="bold",
                color=hx("navy"), ha="center", va="center")
        foot(ax, n)

    elif L == "table":
        light_head(ax, d["title"])
        y = H - 1.4
        if d.get("lead"):
            wrapped(ax, M, y, d["lead"], CW - 0.8, size=13, style="italic",
                    color=hx("ink2")); y -= 0.72
        head, rows = d["head"], d["rows"]
        ncol = len(head)
        widths = ([1.3, 0.8, 1.5, 1.5, 1.2, 2.5, 1.1] if ncol == 7 else [0.7, 6.9, 4.3])
        scale = CW / sum(widths)
        widths = [w * scale for w in widths]
        xs = [M]
        for w in widths[:-1]:
            xs.append(xs[-1] + w)

        # Measure first so the block can be centred, rather than left hanging
        # against the title with two inches of dead space underneath.
        rh = 0.46
        heights, wrapped_rows = [], []
        for row in rows:
            nlines, cells = 1, []
            for w, c in zip(widths, row):
                chars = max(8, int((w - 0.24) / (11 * 0.0092)))
                ls = textwrap.wrap(str(c), chars)
                nlines = max(nlines, len(ls))
                cells.append("\n".join(ls))
            heights.append(max(rh, 0.2 * nlines + 0.22))
            wrapped_rows.append(cells)
        foot_h = 0.62 if d.get("foot") else 0.0
        block = rh + sum(heights) + foot_h
        y = min(y, 1.0 + block + (y - 1.0 - block) / 2)

        rrect(ax, M, y - rh, CW, rh, hx("navy"))
        for x, hcell in zip(xs, head):
            txt(ax, x + 0.12, y - rh / 2, hcell, size=10.5, weight="bold",
                color=hx("white"), va="center")
        yy = y - rh
        for ri, (cells, rhh) in enumerate(zip(wrapped_rows, heights)):
            if ri % 2:
                ax.add_patch(plt.Rectangle((M, yy - rhh), CW, rhh,
                             facecolor=hx("surface"), edgecolor="none", zorder=1))
            for x, c in zip(xs, cells):
                txt(ax, x + 0.12, yy - rhh / 2, c, size=11, color=hx("ink"), va="center")
            ax.plot([M, M + CW], [yy - rhh, yy - rhh], color=hx("line"), lw=0.8, zorder=2)
            yy -= rhh
        if d.get("foot"):
            wrapped(ax, M, yy - 0.3, d["foot"], CW - 0.6, size=12, style="italic",
                    color=hx("ink2"))
        foot(ax, n)

    elif L == "figure":
        light_head(ax, d["title"])
        wrapped(ax, M, H - 1.4, d["lead"], CW - 0.8, size=13, style="italic",
                color=hx("ink2"))
        put_fig(ax, d["image"], M, 0.95, 7.3, 4.95)
        bullets(ax, M + 7.55, H - 1.95, d["points"], CW - 7.55, size=12.5)
        foot(ax, n)

    elif L == "proof":
        light_head(ax, d["title"])
        wrapped(ax, M, H - 1.4, d["lead"], CW - 0.8, size=13, style="italic",
                color=hx("ink2"))
        rrect(ax, M, 3.55, 6.0, 2.05, hx("navy"))
        txt(ax, M + 0.42, 5.3, "\n".join(d["math"]), size=14,
            color=hx("white"), font="DejaVu Sans Mono", lh=1.6)
        wrapped(ax, M + 6.5, 5.55, d["body"], CW - 6.6, size=13, color=hx("ink"), lh=1.32)
        rrect(ax, M, 2.1, CW, 1.0, hx("surface"), hx("line"), 1.0)
        wrapped(ax, M + 0.42, 2.8, d["callout"], CW - 0.9, size=15.5,
                weight="bold", color=hx("navy"))
        foot(ax, n)

    elif L == "stat":
        light_head(ax, d["title"])
        stats = d["stats"]; k = len(stats); gap = 0.30
        cw = (CW - gap * (k - 1)) / k
        for i, st in enumerate(stats):
            x = M + i * (cw + gap)
            rrect(ax, x, H - 3.4, cw, 1.8, hx("white"), hx("line"), 1.0)
            txt(ax, x + cw / 2, H - 2.5, st["v"], size=46, weight="bold",
                color=hx("navy"), ha="center", va="center", font=HEAD)
            txt(ax, x + cw / 2, H - 3.12, st["l"], size=11.5, color=hx("ink2"),
                ha="center", va="center")
        wrapped(ax, M, H - 3.75, d["body"], CW - 1.3, size=13.5, color=hx("ink"), lh=1.32)
        rrect(ax, M, 0.95, CW, 0.95, hx("navy"))
        wrapped(ax, M + 0.42, 1.62, d["callout"], CW - 0.9, size=15.5,
                weight="bold", color=hx("white"))
        foot(ax, n)

    elif L == "close":
        txt(ax, M, H - 0.95, "IN CLOSING", size=11.5, weight="bold",
            color=hx("amber"), va="center")
        wrapped(ax, M, H - 1.4, d["title"], CW - 1.2, size=28, weight="bold",
                color=hx("white"), font=HEAD)
        bullets(ax, M, H - 2.5, d["points"], CW - 2.2, size=13.5,
                color=hx("ice"), gap=0.34)
        txt(ax, M, 0.85, "      ".join(d["team"]), size=13, weight="bold",
            color=hx("white"))

    pdf.savefig(fig); plt.close(fig)


def main():
    out = os.path.join(HERE, "MBA680_Presentation.pdf")
    with PdfPages(out) as pdf:
        for i, d in enumerate(C["slides"], start=1):
            render(d, i, pdf)
        info = pdf.infodict()
        info["Title"] = "MBA680 Personal Investment Advisor and Robo-Advisory Design"
        info["Author"] = "Abhinav Raj, Raghav Patidar, Shubham Raj, Siddharth Jaiswal"
    print(f"wrote {out}  ({len(C['slides'])} slides)")


if __name__ == "__main__":
    main()
