/**
 * Builds MBA680_Presentation.pptx from content.json, in the group's template:
 * a navy header band with a teal rule, light panels carrying a coloured accent
 * bar, and a footer naming the group on every slide.
 *   node make_deck.js
 */
const fs = require("fs"), path = require("path");
const pptxgen = require(path.join(__dirname, "..", "engine", "node_modules", "pptxgenjs"));

const HERE = __dirname;
const C = JSON.parse(fs.readFileSync(path.join(HERE, "content.json"), "utf8"));
const T = C.theme, ACC = C.accents, TEAM = C.team;
const FIG = path.join(HERE, "..", "figures");

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";                  // 13.33 x 7.5
pres.author = TEAM.join(", ");
pres.company = "IIT Kanpur, MBA680";
pres.title = "MBA680 Personal Investment Advisor and Robo-Advisory Project";
pres.theme = { headFontFace: T.head, bodyFontFace: T.body };

const W = 13.33, H = 7.5, M = 0.55, CW = W - 2 * M;
const BAND = 1.28, RULE = 0.075;
const N = C.slides.length;
const FOOT = "MBA680 Group Project  |  " + TEAM.join(", ");
const TOP = H - BAND - RULE - 0.3;

pres.defineSlideMaster({ title: "TITLE", background: { color: T.navy } });
pres.defineSlideMaster({
  title: "CONTENT", background: { color: T.white },
  objects: [
    { rect: { x: 0, y: 0, w: W, h: BAND, fill: { color: T.navy } } },
    { rect: { x: 0, y: BAND, w: W, h: RULE, fill: { color: T.rule } } },
    { text: { text: FOOT, options: { x: M, y: H - 0.42, w: 8.5, h: 0.26, fontSize: 8,
      color: T.ink3, isTextBox: true, margin: 0, valign: "middle" } } },
    { placeholder: { options: { name: "slideNumber", type: "sldNum", x: W - M - 1.2,
      y: H - 0.42, w: 1.2, h: 0.26, fontSize: 8, color: T.ink3, align: "right" } } },
  ],
});

const txt = (s, t, o) => s.addText(t, Object.assign({ isTextBox: true, margin: 0 }, o));
const Y = v => H - v;                      // content.json uses a bottom-up y axis

function head(s, kicker, title) {
  txt(s, kicker, { x: M, y: 0.18, w: CW, h: 0.3, fontSize: 9.5, bold: true,
    color: T.rule, valign: "middle" });
  txt(s, title, { x: M, y: 0.52, w: CW, h: 0.6, fontSize: 24, bold: true,
    color: T.white, valign: "middle" });
}

function panel(s, x, yTop, w, h, accent) {
  s.addShape(pres.ShapeType.rect, { x, y: yTop, w, h, fill: { color: T.panel } });
  if (accent) s.addShape(pres.ShapeType.rect,
    { x, y: yTop, w: 0.065, h, fill: { color: T[accent] } });
}

function sideCard(s, x, yTop, w, h, accent, hd, body, hs = 12.5, bs = 10.5) {
  panel(s, x, yTop, w, h, accent);
  txt(s, hd, { x: x + 0.26, y: yTop + 0.12, w: w - 0.5, h: 0.5, fontSize: hs,
    bold: true, color: T.ink, valign: "top" });
  txt(s, body, { x: x + 0.26, y: yTop + 0.62, w: w - 0.5, h: h - 0.78, fontSize: bs,
    color: T.ink2, valign: "top", lineSpacingMultiple: 1.2 });
}

function topCard(s, x, yTop, w, h, accent, hd, body) {
  s.addShape(pres.ShapeType.rect, { x, y: yTop, w, h, fill: { color: T.panel } });
  s.addShape(pres.ShapeType.rect, { x, y: yTop, w, h: 0.055, fill: { color: T[accent] } });
  txt(s, hd, { x: x + 0.2, y: yTop + 0.14, w: w - 0.4, h: 0.4, fontSize: 12.5,
    bold: true, color: T.ink, valign: "top" });
  txt(s, body, { x: x + 0.2, y: yTop + 0.56, w: w - 0.4, h: h - 0.68, fontSize: 9.5,
    color: T.ink2, valign: "top", lineSpacingMultiple: 1.18 });
}

function table(s, x, yTop, w, headRow, rows, widths, fs = 9.5) {
  const scale = w / widths.reduce((a, b) => a + b, 0);
  const colW = widths.map(v => v * scale);
  const hdr = headRow.map(h => ({ text: String(h), options: { bold: true, color: T.white,
    fill: { color: T.navy }, fontSize: fs, align: "center", valign: "middle" } }));
  const body = rows.map((r, ri) => r.map(c => ({ text: String(c), options: { color: T.ink,
    fontSize: fs, align: "center", valign: "middle",
    fill: { color: ri % 2 === 0 ? "EAF4F3" : T.white } } })));
  s.addTable([hdr, ...body], { x, y: yTop, w, colW,
    border: { type: "solid", color: T.line, pt: 0.75 },
    rowH: 0.34, margin: 0.06, autoPage: false });
}

function fig(s, file, x, yTop, w, h) {
  const p = path.join(FIG, file);
  if (!fs.existsSync(p)) return;
  const b = fs.readFileSync(p), iw = b.readUInt32BE(16), ih = b.readUInt32BE(20);
  const r = Math.min(w / iw, h / ih);
  s.addImage({ path: p, x: x + (w - iw * r) / 2, y: yTop + (h - ih * r) / 2,
    w: iw * r, h: ih * r });
}

function bullets(s, x, yTop, items, w, h, size = 10.5, color) {
  s.addText(items.map((t, i) => ({ text: t,
    options: { bullet: { code: "25A0" }, breakLine: i < items.length - 1 } })), {
    x, y: yTop, w, h, isTextBox: true, margin: 0, fontSize: size,
    color: color || T.ink2, lineSpacingMultiple: 1.2, paraSpaceAfter: 7, valign: "top" });
}

pres.addSection({ title: "Deck" });

C.slides.forEach((d, idx) => {
  const n = idx + 1;
  const L = d.layout;

  if (L === "title") {
    const s = pres.addSlide({ masterName: "TITLE", sectionTitle: "Deck" });
    s.addShape(pres.ShapeType.rect, { x: M, y: Y(5.75), w: 0.075, h: 2.2,
      fill: { color: T.orange } });
    txt(s, d.kicker, { x: M + 0.32, y: Y(5.78), w: CW - 1.0, h: 0.3, fontSize: 11,
      bold: true, color: T.rule, valign: "middle" });
    txt(s, d.title, { x: M + 0.32, y: Y(5.42), w: CW - 2.6, h: 1.3, fontSize: 31,
      bold: true, color: T.white, valign: "top" });
    txt(s, d.sub, { x: M + 0.32, y: Y(4.1), w: CW - 1.4, h: 0.36, fontSize: 13.5,
      color: "C7D4E0" });
    txt(s, d.portal, { x: M + 0.32, y: Y(3.66), w: CW - 1.4, h: 0.3, fontSize: 11,
      color: T.rule });
    s.addShape(pres.ShapeType.rect, { x: 0, y: Y(2.775), w: W, h: 0.055,
      fill: { color: T.rule } });
    txt(s, "PRESENTED BY", { x: M, y: Y(2.52), w: CW, h: 0.28, fontSize: 9.5,
      bold: true, color: T.rule, valign: "middle" });
    const gap = 0.2, cw = (CW - 0.6) / 4;
    d.team.forEach((name, i) => {
      const x = M + i * (cw + gap);
      s.addShape(pres.ShapeType.roundRect, { x, y: Y(1.97), w: cw, h: 0.72,
        rectRadius: 0.05, fill: { color: T.navyMid } });
      txt(s, name, { x, y: Y(1.97), w: cw, h: 0.72, fontSize: 13, bold: true,
        color: T.white, align: "center", valign: "middle" });
    });
    s.addNotes(d.title); return;
  }

  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Deck" });
  head(s, d.kicker, d.title);
  const top = BAND + RULE + 0.3;            // top-down y of the content area

  if (L === "cards+table") {
    const gap = 0.22, cw = (CW - 0.66) / 4;
    d.cards.forEach((c, i) => topCard(s, M + i * (cw + gap), top, cw, 1.18,
      ACC[i % 5], c.h, c.b));
    txt(s, d.tableTitle, { x: M, y: top + 1.34, w: CW, h: 0.3, fontSize: 13,
      bold: true, color: T.ink });
    table(s, M, top + 1.68, CW, d.head, d.rows, [1.5, 0.7, 1.7, 1.3, 1.0, 1.9, 1.9]);
    txt(s, d.foot, { x: M, y: H - 0.95, w: CW, h: 0.3, fontSize: 9.5, color: T.ink3 });

  } else if (L === "cards4big") {
    const gap = 0.26, cw = (CW - gap) / 2, ch = (H - top - 0.75 - gap) / 2;
    d.cards.forEach((c, i) => sideCard(s, M + (i % 2) * (cw + gap),
      top + Math.floor(i / 2) * (ch + gap), cw, ch, ACC[i % 5], c.h, c.b, 13, 10.5));

  } else if (L === "method") {
    const cw = CW * 0.48, gap = CW - 2 * cw;
    const ch = (H - top - 0.72 - 3 * 0.14) / 4;
    d.cards.forEach((c, i) => sideCard(s, M, top + i * (ch + 0.14), cw, ch,
      ACC[i % 5], c.h, c.b, 11.5, 9.5));
    const x2 = M + cw + gap;
    txt(s, d.tableTitle, { x: x2, y: top, w: cw, h: 0.3, fontSize: 13, bold: true, color: T.ink });
    table(s, x2, top + 0.34, cw, d.head, d.rows, [1.1, 2.4, 2.0], 9);
    txt(s, d.foot, { x: x2, y: H - 1.1, w: cw, h: 0.5, fontSize: 9.5, bold: true, color: T.ink });

  } else if (L === "table+figure") {
    const cw = CW * 0.49, x2 = M + CW - cw;
    txt(s, d.tableTitle, { x: M, y: top, w: cw, h: 0.3, fontSize: 13, bold: true, color: T.ink });
    table(s, M, top + 0.34, cw, d.head, d.rows, [1.2, 2.6, 0.8, 1.2]);
    bullets(s, M, top + 2.35, d.bullets, cw, 1.6, 10);
    fig(s, d.image, x2, top, cw, 2.6);
    sideCard(s, x2, top + 2.86, cw, 1.5, "orange", d.card.h, d.card.b, 12.5, 10);

  } else if (L === "figure+table") {
    const cw = CW * 0.50, x2 = M + CW - cw;
    txt(s, d.lead, { x: M, y: top, w: cw, h: 0.42, fontSize: 11, italic: true, color: T.ink2 });
    fig(s, d.image, M, top + 0.46, cw, 2.95);
    bullets(s, M, top + 3.5, d.bullets, cw, 1.6, 10);
    txt(s, d.tableTitle, { x: x2, y: top, w: cw, h: 0.3, fontSize: 13, bold: true, color: T.ink });
    table(s, x2, top + 0.34, cw, d.head, d.rows,
      d.head.length === 5 ? [1.2, 1.6, 1.2, 1.0, 1.7] : d.head.map(() => 1.2));

  } else if (L === "table2+figure") {
    const cw = CW * 0.52, x2 = M + CW - CW * 0.44;
    txt(s, d.lead, { x: M, y: top, w: cw, h: 0.5, fontSize: 11, italic: true, color: T.ink2 });
    table(s, M, top + 0.56, cw, d.headA, d.rowsA, [1.5, 0.9, 0.8, 2.6]);
    table(s, M, top + 2.3, cw, d.headB, d.rowsB, [1.4, 0.6, 1.3, 1.2, 0.9, 1.0]);
    fig(s, d.image, x2, top, CW * 0.44, 3.0);
    sideCard(s, x2, top + 3.24, CW * 0.44, 1.85, "teal", d.card.h, d.card.b, 12.5, 10);

  } else if (L === "two-cards") {
    const cw = (CW - 0.3) / 2, x2 = M + cw + 0.3, ch = 0.86;
    txt(s, d.leftTitle, { x: M, y: top, w: cw, h: 0.3, fontSize: 13, bold: true, color: T.ink });
    txt(s, d.rightTitle, { x: x2, y: top, w: cw, h: 0.3, fontSize: 13, bold: true, color: T.ink });
    d.left.forEach((c, i) => sideCard(s, M, top + 0.36 + i * (ch + 0.14), cw, ch,
      "teal", c.h, c.b, 12, 10));
    d.right.forEach((c, i) => {
      const y = top + 0.36 + i * (ch + 0.14);
      s.addShape(pres.ShapeType.rect, { x: x2, y, w: cw, h: ch, fill: { color: T.panel } });
      s.addShape(pres.ShapeType.rect, { x: x2, y, w: 0.62, h: ch,
        fill: { color: T[ACC[i % 5]] } });
      txt(s, c.n, { x: x2, y, w: 0.62, h: ch, fontSize: 15, bold: true, color: T.white,
        align: "center", valign: "middle" });
      txt(s, c.b, { x: x2 + 0.78, y: y + 0.1, w: cw - 1.0, h: 0.46, fontSize: 10,
        color: T.ink, valign: "top" });
      txt(s, c.i, { x: x2 + 0.78, y: y + ch - 0.34, w: cw - 1.0, h: 0.26, fontSize: 9,
        bold: true, color: T[ACC[i % 5]], valign: "middle" });
    });
    txt(s, d.foot, { x: M, y: top + 0.36 + 4 * ch + 3 * 0.14 + 0.16, w: CW, h: 0.4,
      fontSize: 10, italic: true, color: T.ink2 });

  } else if (L === "figure+cards") {
    const cw = CW * 0.46, x2 = M + CW - CW * 0.51;
    fig(s, d.image, M, top, cw, 3.0);
    sideCard(s, M, top + 3.24, cw, 1.25, "teal", d.card.h, d.card.b, 12.5, 10);
    const ch = (H - top - 0.72 - 3 * 0.12) / 4;
    d.cards.forEach((c, i) => sideCard(s, x2, top + i * (ch + 0.12), CW * 0.51, ch,
      ACC[i % 5], c.h, c.b, 11.5, 9.5));

  } else if (L === "cards3") {
    txt(s, d.lead, { x: M, y: top, w: CW, h: 0.4, fontSize: 11.5, italic: true, color: T.ink2 });
    const gap = 0.3, cw = (CW - 2 * gap) / 3, yTop = top + 0.5;
    const ch = H - 1.55 - yTop;
    d.cards.forEach((c, i) => sideCard(s, M + i * (cw + gap), yTop, cw, ch,
      ACC[i % 5], c.h, c.b, 14, 11));
    s.addShape(pres.ShapeType.rect, { x: M, y: H - 1.32, w: CW, h: 0.6,
      fill: { color: T.navy } });
    txt(s, d.foot, { x: M, y: H - 1.32, w: CW, h: 0.6, fontSize: 13, bold: true,
      color: T.white, align: "center", valign: "middle" });

  } else if (L === "close") {
    const gap = 0.18, cw = (CW - 4 * gap) / 5, ch = 1.55;
    d.cards.forEach((c, i) => topCard(s, M + i * (cw + gap), top, cw, ch,
      ACC[i % 5], c.h, c.b));
    bullets(s, M, top + ch + 0.42, d.points, CW, 1.8, 11, T.ink);
    s.addShape(pres.ShapeType.rect, { x: M, y: H - 1.4, w: CW, h: 0.62,
      fill: { color: T.navy } });
    txt(s, d.quote, { x: M, y: H - 1.4, w: CW, h: 0.62, fontSize: 13.5, bold: true,
      color: T.white, align: "center", valign: "middle" });
  }

  s.addNotes(d.title);
});

pres.writeFile({ fileName: path.join(HERE, "MBA680_Presentation.pptx") })
  .then(f => console.log("wrote " + f));
