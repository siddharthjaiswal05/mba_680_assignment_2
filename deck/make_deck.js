/**
 * Builds MBA680_Presentation.pptx from content.json.
 * Layouts are defined once and filled by placeholder name, so the deck can be
 * restyled in PowerPoint without fighting it.
 *   node make_deck.js
 */
const fs = require("fs"), path = require("path");
const pptxgen = require(path.join(__dirname, "..", "engine", "node_modules", "pptxgenjs"));

const HERE = __dirname;
const C = JSON.parse(fs.readFileSync(path.join(HERE, "content.json"), "utf8"));
const T = C.theme;
const FIG = path.join(HERE, "..", "figures");

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";                 // 13.33 x 7.5 inches
pres.author = "Abhinav Raj, Raghav Patidar, Shubham Raj, Siddharth Jaiswal";
pres.company = "IIT Kanpur, MBA680";
pres.title = "MBA680 Personal Investment Advisor and Robo-Advisory Design";
pres.theme = { headFontFace: T.head, bodyFontFace: T.body };

const W = 13.33, H = 7.5, M = 0.72;
const CW = W - 2 * M;

/* ---------------------------------------------------------------- layouts */
const footer = (dark) => ([
  { text: { text: "MBA680 Behavioral Finance  |  Problem Statement 2",
            options: { x: M, y: H - 0.52, w: 6, h: 0.3, fontSize: 10,
                       color: dark ? T.ink3 : T.ink3, isTextBox: true, margin: 0 } } },
  { placeholder: { options: { name: "slideNumber", type: "sldNum", x: W - M - 0.6,
                              y: H - 0.52, w: 0.6, h: 0.3, fontSize: 10,
                              color: T.ink3, align: "right" } } },
]);

pres.defineSlideMaster({
  title: "DARK", background: { color: T.navy },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: M, y: 2.35, w: CW - 1.2,
      h: 1.9, fontSize: 40, bold: true, color: T.white, valign: "bottom" } } },
    { placeholder: { options: { name: "body", type: "body", x: M, y: 4.45, w: CW - 2.4,
      h: 1.9, fontSize: 15, color: T.ice, valign: "top" } } },
  ],
});

pres.defineSlideMaster({
  title: "LIGHT", background: { color: T.white },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: M, y: 0.52, w: CW,
      h: 0.86, fontSize: 30, bold: true, color: T.navy, valign: "middle" } } },
    ...footer(false),
  ],
});

pres.defineSlideMaster({
  title: "ACCENT", background: { color: T.surface },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: M, y: 0.52, w: CW,
      h: 0.86, fontSize: 30, bold: true, color: T.navy, valign: "middle" } } },
    ...footer(false),
  ],
});

/* ------------------------------------------------------------- primitives */
const txt = (s, t, o) => s.addText(t, Object.assign({ isTextBox: true, margin: 0 }, o));

function lead(s, text, y) {
  txt(s, text, { x: M, y, w: CW, h: 0.42, fontSize: 15, italic: true, color: T.ink2 });
}

function bullets(s, items, o) {
  s.addText(items.map((t, i) => ({
    text: t, options: { bullet: { code: "25CF" }, breakLine: i < items.length - 1 },
  })), Object.assign({ isTextBox: true, margin: 0, fontSize: 14.5, color: T.ink,
    lineSpacingMultiple: 1.16, paraSpaceAfter: 9 }, o));
}

function card(s, x, y, w, h, n, head, body, accentNum) {
  s.addShape(pres.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.06,
    fill: { color: T.white }, line: { color: T.line, width: 1 },
    shadow: { type: "outer", color: T.navy, opacity: 0.1, blur: 10, offset: 2, angle: 90 } });
  txt(s, n, { x: x + 0.34, y: y + 0.3, w: w - 0.68, h: 0.46,
    fontSize: accentNum ? 26 : 19, bold: true, color: T.amber });
  txt(s, head, { x: x + 0.34, y: y + 0.82, w: w - 0.68, h: 0.44,
    fontSize: 16, bold: true, color: T.navy });
  txt(s, body, { x: x + 0.34, y: y + 1.3, w: w - 0.68, h: h - 1.62,
    fontSize: 12.5, color: T.ink2, lineSpacingMultiple: 1.2, valign: "top" });
}

function fig(s, file, x, y, w, h) {
  const p = path.join(FIG, file);
  if (!fs.existsSync(p)) return;
  const buf = fs.readFileSync(p);
  const iw = buf.readUInt32BE(16), ih = buf.readUInt32BE(20);
  const r = Math.min(w / iw, h / ih);
  s.addImage({ path: p, x: x + (w - iw * r) / 2, y: y + (h - ih * r) / 2,
               w: iw * r, h: ih * r });
}

/* ---------------------------------------------------------------- render */
pres.addSection({ title: "Opening" });
pres.addSection({ title: "Findings" });
pres.addSection({ title: "Results" });
pres.addSection({ title: "Close" });
const sectionFor = i => i <= 1 ? "Opening" : i <= 6 ? "Findings" : i <= 13 ? "Results" : "Close";

C.slides.forEach((d, i) => {
  const sect = sectionFor(i);
  let s;

  if (d.layout === "title") {
    s = pres.addSlide({ masterName: "DARK", sectionTitle: sect });
    txt(s, "MBA680  |  BEHAVIORAL FINANCE", { x: M, y: 1.55, w: CW, h: 0.34,
      fontSize: 13, bold: true, color: T.amber, charSpacing: 2.4 });
    s.addText(d.title, { placeholder: "title" });
    txt(s, d.kicker, { x: M, y: 4.4, w: CW - 3.4, h: 0.5, fontSize: 17, italic: true,
      color: T.ice });
    txt(s, d.subtitle, { x: M, y: 5.25, w: CW, h: 0.34, fontSize: 12.5, color: T.ink3 });
    txt(s, d.team.join("      "), { x: M, y: 6.0, w: CW, h: 0.38, fontSize: 14.5,
      bold: true, color: T.white });
    txt(s, "Indian Institute of Technology Kanpur", { x: M, y: 6.46, w: CW, h: 0.3,
      fontSize: 11.5, color: T.ink3 });

  } else if (d.layout === "statement") {
    s = pres.addSlide({ masterName: "DARK", sectionTitle: sect });
    txt(s, d.title.toUpperCase(), { x: M, y: 1.35, w: CW, h: 0.34, fontSize: 13,
      bold: true, color: T.amber, charSpacing: 2.4 });
    txt(s, d.big, { x: M, y: 1.95, w: CW - 1.1, h: 2.1, fontSize: 34, bold: true,
      color: T.white, lineSpacingMultiple: 1.1, valign: "top" });
    txt(s, d.body, { x: M, y: 4.5, w: CW - 2.9, h: 1.9, fontSize: 15, color: T.ice,
      lineSpacingMultiple: 1.25, valign: "top" });

  } else if (d.layout === "cards3" || d.layout === "cards4") {
    s = pres.addSlide({ masterName: "ACCENT", sectionTitle: sect });
    s.addText(d.title, { placeholder: "title" });
    let y = 1.56;
    if (d.lead) { lead(s, d.lead, y); y += 0.56; }
    const n = d.cards.length, gap = 0.34;
    const cw = (CW - gap * (n - 1)) / n;
    const ch = d.foot ? H - y - 1.18 : H - y - 0.86;
    d.cards.forEach((c, k) => card(s, M + k * (cw + gap), y, cw, ch, c.n, c.h, c.b,
      d.layout === "cards3"));
    if (d.foot) txt(s, d.foot, { x: M, y: H - 1.08, w: CW, h: 0.34, fontSize: 13,
      bold: true, color: T.navy, align: "center" });

  } else if (d.layout === "table") {
    s = pres.addSlide({ masterName: "LIGHT", sectionTitle: sect });
    s.addText(d.title, { placeholder: "title" });
    let y = 1.56;
    if (d.lead) { lead(s, d.lead, y); y += 0.62; }
    const head = d.head.map(h => ({ text: h,
      options: { bold: true, color: T.white, fill: { color: T.navy }, fontSize: 12 } }));
    const rows = d.rows.map((r, ri) => r.map(c => ({ text: String(c),
      options: { color: T.ink, fontSize: 12.5,
                 fill: { color: ri % 2 ? T.surface : T.white } } })));
    s.addTable([head, ...rows], { x: M, y, w: CW, colW: d.head.length === 7
        ? [1.3, 0.8, 1.5, 1.5, 1.2, 2.5, 1.1] : [0.7, 6.9, 4.3],
      border: { type: "solid", color: T.line, pt: 1 },
      rowH: 0.42, valign: "middle", margin: 0.09, autoPage: false });
    if (d.foot) txt(s, d.foot, { x: M, y: H - 1.22, w: CW, h: 0.6, fontSize: 13,
      italic: true, color: T.ink2, lineSpacingMultiple: 1.2 });

  } else if (d.layout === "figure") {
    s = pres.addSlide({ masterName: "LIGHT", sectionTitle: sect });
    s.addText(d.title, { placeholder: "title" });
    lead(s, d.lead, 1.5);
    fig(s, d.image, M, 1.98, 7.3, 4.78);
    bullets(s, d.points, { x: M + 7.62, y: 2.02, w: CW - 7.62, h: 4.7 });

  } else if (d.layout === "proof") {
    s = pres.addSlide({ masterName: "LIGHT", sectionTitle: sect });
    s.addText(d.title, { placeholder: "title" });
    lead(s, d.lead, 1.52);
    s.addShape(pres.ShapeType.roundRect, { x: M, y: 2.12, w: 6.0, h: 2.1,
      rectRadius: 0.06, fill: { color: T.navy } });
    s.addText(d.math.map((t, i) => ({ text: t,
      options: { breakLine: i < d.math.length - 1 } })), {
      x: M + 0.42, y: 2.34, w: 5.2, h: 1.7, isTextBox: true, margin: 0,
      fontFace: "Courier New", fontSize: 16, color: T.white, lineSpacingMultiple: 1.45 });
    txt(s, d.body, { x: M + 6.5, y: 2.12, w: CW - 6.5, h: 2.6, fontSize: 14.5,
      color: T.ink, lineSpacingMultiple: 1.22, valign: "top" });
    s.addShape(pres.ShapeType.roundRect, { x: M, y: 4.62, w: CW, h: 1.0,
      rectRadius: 0.06, fill: { color: T.surface }, line: { color: T.line, width: 1 } });
    txt(s, d.callout, { x: M + 0.42, y: 4.62, w: CW - 0.84, h: 1.0, fontSize: 17,
      bold: true, color: T.navy, valign: "middle" });

  } else if (d.layout === "stat") {
    s = pres.addSlide({ masterName: "ACCENT", sectionTitle: sect });
    s.addText(d.title, { placeholder: "title" });
    const n = d.stats.length, gap = 0.34, cw = (CW - gap * (n - 1)) / n;
    d.stats.forEach((st, k) => {
      const x = M + k * (cw + gap);
      s.addShape(pres.ShapeType.roundRect, { x, y: 1.72, w: cw, h: 1.78,
        rectRadius: 0.06, fill: { color: T.white }, line: { color: T.line, width: 1 } });
      txt(s, st.v, { x, y: 1.9, w: cw, h: 1.0, fontSize: 58, bold: true,
        color: T.navy, align: "center" });
      txt(s, st.l, { x, y: 2.92, w: cw, h: 0.38, fontSize: 13, color: T.ink2,
        align: "center" });
    });
    txt(s, d.body, { x: M, y: 3.86, w: CW - 1.3, h: 1.5, fontSize: 15.5, color: T.ink,
      lineSpacingMultiple: 1.24, valign: "top" });
    s.addShape(pres.ShapeType.roundRect, { x: M, y: 5.5, w: CW, h: 0.92,
      rectRadius: 0.06, fill: { color: T.navy } });
    txt(s, d.callout, { x: M + 0.42, y: 5.5, w: CW - 0.84, h: 0.92, fontSize: 17,
      bold: true, color: T.white, valign: "middle" });

  } else if (d.layout === "close") {
    s = pres.addSlide({ masterName: "DARK", sectionTitle: sect });
    txt(s, "IN CLOSING", { x: M, y: 0.95, w: CW, h: 0.34, fontSize: 13, bold: true,
      color: T.amber, charSpacing: 2.4 });
    txt(s, d.title, { x: M, y: 1.42, w: CW - 1.2, h: 0.8, fontSize: 34, bold: true,
      color: T.white });
    s.addText(d.points.map((t, i) => ({ text: t,
      options: { bullet: { code: "25CF" }, breakLine: i < d.points.length - 1 } })), {
      x: M, y: 2.5, w: CW - 2.0, h: 3.0, isTextBox: true, margin: 0, fontSize: 15.5,
      color: T.ice, lineSpacingMultiple: 1.2, paraSpaceAfter: 11 });
    txt(s, d.team.join("      "), { x: M, y: 6.26, w: CW, h: 0.38, fontSize: 14,
      bold: true, color: T.white });
  }

  s.addNotes(d.title);
});

pres.writeFile({ fileName: path.join(HERE, "MBA680_Presentation.pptx") })
  .then(f => console.log("wrote " + f));
