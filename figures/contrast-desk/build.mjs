// Fig 4 — Contrast desk: spin echo, inversion recovery and gradient echo.
// node build.mjs            → contrast-desk.html (dark)
// node build.mjs --light    → contrast-desk-light.html
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../_anatomy/kit/iso-kit.mjs";
import { kitScript } from "../_anatomy/scripts/inline-kit.mjs";
import { TISSUES, PRESETS, TR_RANGE, TE_SCALE, TI_SCALE, T2_PRIME, signalOf, t2StarOf, nullTiOf } from "./model.mjs";
import { loadSlice, lightboxGeometry, lightboxSvg, FILM_JS, MNI_NOTICE } from "../_shared/lightbox.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const OUT = theme === "light" ? "contrast-desk-light.html" : "contrast-desk.html";

const WIDTH = 600;
const HEIGHT = 400;

// ── world layout (1 unit ≈ 1 px) ────────────────────────────────────────────
const PLATE = { x: -140, y: -70, w: 280, d: 168, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

const GY = -40; // gauge row
const GX = [-106, -68, -30];
const VIAL_R = 11;
const VIAL_H = 16;
const CAP_Z = VIAL_H;
const CAP_H = 5;
const COLLAR_Z = CAP_Z + CAP_H;
const ROD_Z = COLLAR_Z + 3;
const BAR_Z = 128; // crossbar underside
const BAR_H = 6;
const FLOAT_Z0 = ROD_Z + 2; // float bottom at S = 0
const SCALE = 88; // float travel for S = 0 → 1
const FLOAT_H = 5;
const FLOAT_R = 6;
const POST_X = [-128, -8];
const LAMP = [-118, GY]; // range lamp on the crossbar

const SLICE = loadSlice();
const LBOX = lightboxGeometry({ x: 22, y: -64, w: 104, d: 12, r: 2 }, SLICE);

const TILE = (gx) => ({ x: gx - 15, y: GY + 17, w: 30, d: 40, r: 1.8 });
const TILE_H = 2.4;
const FILM = (gx) => ({ x: gx - 12, y: GY + 20, w: 24, d: 24, r: 0.8 });

// three faders: TR (logarithmic, 10 ms to 10 s), TE (0–150 ms) and TI (0–4 s)
const RAIL0 = -60;
const TRAVEL = 120;
const FADERS = [
  { key: "tr", label: "TR", y: 34 },
  { key: "te", label: "TE", y: 56 },
  { key: "ti", label: "TI", y: 78 },
];
const PANEL_Z = 4;
const KNOB_H = 7;
const posOf = {
  tr: (v) => RAIL0 + (TRAVEL * Math.log10(v / TR_RANGE[0])) / Math.log10(TR_RANGE[1] / TR_RANGE[0]),
  te: (v) => RAIL0 + (v / TE_SCALE) * TRAVEL,
  ti: (v) => RAIL0 + (v / TI_SCALE) * TRAVEL,
};
const ticksOf = {
  tr: () => [...[10, 100, 1000].flatMap((d) => Array.from({ length: 9 }, (_, m) => ({ v: (m + 1) * d, major: m === 0 }))), { v: 10000, major: true }],
  te: () => Array.from({ length: 16 }, (_, i) => ({ v: i * 10, major: i % 5 === 0 })),
  ti: () => Array.from({ length: 41 }, (_, i) => ({ v: i * 100, major: i % 10 === 0 })),
};

// control box: sequence selector and flip-angle dial
const CTRL = { x: 86, y: 24, w: 50, d: 66, r: 3 };
const CTRL_H = 10;
const MODE_KNOB = [111, 41];
const MODE_DETENTS = [-50, 0, 50]; // SE, IR, GRE
const FLIP_KNOB = [111, 70];
const FLIP_R = 12;
const dialOfFlip = (f) => -120 + (240 * f) / 90;

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [POST_X[0], GY, BAR_Z + BAR_H], [POST_X[1], GY, BAR_Z + BAR_H], [LBOX.LB.x, LBOX.LB.y, LBOX.top], [LBOX.LB.x + LBOX.LB.w, LBOX.LB.y, LBOX.top]],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: 55 },
);

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (pts) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const dirOf = (deg) => [Math.sin((deg * Math.PI) / 180), -Math.cos((deg * Math.PI) / 180)];

function pointerOf(K, P, centre, deg, r, z) {
  const d = [Math.sin((deg * Math.PI) / 180), -Math.cos((deg * Math.PI) / 180)];
  return K.lineOnTop([centre[0] - d[0] * 1.6, centre[1] - d[1] * 1.6], [centre[0] + d[0] * r, centre[1] + d[1] * r], z, P);
}

// ── base ────────────────────────────────────────────────────────────────────
function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 22))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(PLATE, -5, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  return out.join("");
}

// ── gauge row: posts, sample vials, graduated scales, rods and floats ──────
function post(x) {
  const out = [];
  out.push(S(k.cylinder(x, GY, 6.5, 0, 3, P, 28), { tone: "lo" }));
  out.push(D(byDepth([[x - 4.6, GY - 4.6], [x + 4.6, GY - 4.6], [x - 4.6, GY + 4.6], [x + 4.6, GY + 4.6]]).map(([px, py]) => at([px, py, 3])), { size: 0.4 }));
  out.push(S(k.cylinder(x, GY, 3.6, 3, BAR_Z - 3, P, 28), { tone: "mid", crease: "none", inner: L([40, 80].map((z) => k.sideArc(x, GY, 3.6, z, P, 16)).join(""), { tone: "faint" }) }));
  return out.join("");
}

function gauge(t, gx, index) {
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf({ x: gx - VIAL_R, y: GY - VIAL_R, w: VIAL_R * 2, d: VIAL_R * 2, r: VIAL_R }, 0, 0.1, P)}" style="filter:blur(3px)"/>`);
  out.push(S(k.cylinder(gx, GY, VIAL_R, 0, VIAL_H, P, 56, 0.8), { tone: "hi", crease: "lo", inner: L(k.sideArc(gx, GY, VIAL_R, 4, P, 32) + k.sideArc(gx, GY, VIAL_R, 11, P, 32), { tone: "faint" }) }));
  out.push(L(k.ring(gx, GY, VIAL_R - 2.4, VIAL_H, P, 48), { tone: "lo" }));
  out.push(S(k.cylinder(gx, GY, 7, CAP_Z, CAP_H, P, 40), { tone: "mid" }));
  out.push(L(k.knurl(gx, GY, 7, CAP_Z, CAP_Z + CAP_H, 40, P), { tone: "lo" }));
  out.push(S(k.cylinder(gx, GY, 3.4, COLLAR_Z, 3, P, 24), { tone: "mid" }));
  const plateY = GY - 6;
  const face = plateY + 1.6;
  const left = gx - 9;
  out.push(S(k.slabOf({ x: left, y: plateY, w: 18, d: 1.6, r: 0.3 }, ROD_Z, BAR_Z - ROD_Z, P, 2, 0.3), { tone: "mid", crease: "none" }));
  const minor = [];
  const major = [];
  for (let i = 0; i <= 20; i++) {
    const z = FLOAT_Z0 + (i / 20) * SCALE;
    (i % 5 === 0 ? major : minor).push(k.segment([left, face, z], [left + (i % 5 === 0 ? 5 : 2.8), face, z], P));
  }
  out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }));
  out.push(S(k.cylinder(gx, GY, 1.4, ROD_Z, BAR_Z - ROD_Z, P, 16), { tone: "mid", crease: "none" }));
  const s0 = signalOf(t, PRESETS[0]);
  out.push(
    `<g data-part="float-${index}" transform="${k.translateAlong(P, [0, 0, s0 * SCALE])}">` +
      S(k.cylinder(gx, GY, FLOAT_R, FLOAT_Z0, FLOAT_H, P, 40, 0.5), { tone: "hi", lit: true, inner: L(k.sideArc(gx, GY, FLOAT_R, FLOAT_Z0 + 1.6, P, 28), { tone: "lo" }) }) +
      L(k.ring(gx, GY, 2.2, FLOAT_Z0 + FLOAT_H, P, 20), { tone: "lo" }) +
      `</g>`,
  );
  return out.join("");
}

function crossbar() {
  const bar = { x: POST_X[0] - 5, y: GY - 4.5, w: POST_X[1] - POST_X[0] + 10, d: 9, r: 2 };
  const top = BAR_Z + BAR_H;
  const out = [S(k.slabOf(bar, BAR_Z, BAR_H, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(bar, BAR_Z + 2, P, 4), { tone: "faint" }) })];
  out.push(L([...POST_X, ...GX].map((x) => k.ring(x, GY, 2, top, P, 16)).join(""), { tone: "lo" }));
  out.push(D([...POST_X, ...GX].map((x) => at([x, GY, top])), { size: 0.5 }));
  // range lamp: lights when the gauges read ten times larger
  const [lx, ly] = LAMP;
  out.push(S(k.cylinder(lx, ly, 3, top, 1.2, P, 24), { tone: "lo" }));
  out.push(S(k.cylinder(lx, ly, 2.1, top + 1.2, 1.6, P, 20), { tone: "mid" }));
  out.push(`<g data-part="range-lamp" opacity="0">${S(k.cylinder(lx, ly, 2.1, top + 1.2, 1.6, P, 20), { tone: "hi", lit: true })}</g>`);
  out.push(k.faceTextSvg(k.sideMatrix([lx - 4, bar.y + bar.d], BAR_Z + 1.4, P, "left"), "×10", { size: 4, tone: "mid" }));
  return out.join("");
}

// ── image tiles ─────────────────────────────────────────────────────────────
function tile(t, gx, index) {
  const plan = TILE(gx);
  const film = FILM(gx);
  const out = [S(k.slabOf(plan, 0, TILE_H, P, 4, 0.5), { tone: "lo" })];
  out.push(`<path data-part="pixel-${index}" class="cd-pixel" d="${k.planOutline(film, TILE_H, P, 3)}"/>`);
  out.push(L(k.planOutline(k.insetPlan(film, -1), TILE_H, P, 3), { tone: "lo" }));
  out.push(k.faceTextSvg(k.topMatrix([gx, plan.y + plan.d - 5.2], TILE_H, P, "x"), t.name, { size: 7, tone: "mid", anchor: "middle" }));
  out.push(D([at([plan.x + 2.2, plan.y + plan.d - 2.2, TILE_H]), at([plan.x + plan.w - 2.2, plan.y + plan.d - 2.2, TILE_H])], { size: 0.4 }));
  return out.join("");
}

// ── faders ─────────────────────────────────────────────────────────────────
function faderPanel(f) {
  const panel = { x: RAIL0 - 20, y: f.y - 9, w: TRAVEL + 32, d: 19, r: 2.5 };
  const out = [S(k.slabOf(panel, 0, PANEL_Z, P, 4, 0.6), { tone: "mid" })];
  const slot = { x: RAIL0 - 1.2, y: f.y - 1.4, w: TRAVEL + 2.4, d: 2.8, r: 1.4 };
  out.push(S(k.slabOf(slot, PANEL_Z - 0.4, 0.4, P, 4), { tone: "lo", crease: "none", flat: true }));
  out.push(L(k.planOutline(slot, PANEL_Z, P, 4), { tone: "lo" }));
  const strip = { x: RAIL0 - 3, y: f.y + 3.4, w: TRAVEL + 6, d: 5, r: 0.8 };
  out.push(S(k.slabOf(strip, PANEL_Z, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const minor = [];
  const major = [];
  for (const tick of ticksOf[f.key]()) {
    const x = posOf[f.key](tick.v);
    (tick.major ? major : minor).push(k.lineOnTop([x, strip.y], [x, strip.y + (tick.major ? 3.6 : 2)], PANEL_Z + 0.6, P));
  }
  out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }));
  out.push(k.faceTextSvg(k.topMatrix([RAIL0 - 11, f.y + 1.6], PANEL_Z, P, "x"), f.label, { size: 5, tone: "hi", anchor: "middle" }));
  out.push(D(byDepth(k.corners(panel, 3)).map(([x, y]) => at([x, y, PANEL_Z])), { size: 0.45 }));
  if (f.key === "ti") out.push(`<g data-part="null-marks"></g>`);
  return out.join("");
}

function faderKnob(f, value) {
  const cap = { x: -5, y: f.y - 6.5, w: 10, d: 13, r: 1.6 };
  const body =
    S(k.slabOf({ x: -1.2, y: f.y - 1.2, w: 2.4, d: 2.4, r: 0.6 }, PANEL_Z - 0.4, 1.4, P, 2), { tone: "lo", crease: "none" }) +
    S(k.slabOf(cap, PANEL_Z + 1, KNOB_H, P, 4, 0.6), { tone: "hi", crease: "lo", inner: L(k.sideSeam(cap, PANEL_Z + 3, P, 4), { tone: "faint" }) }) +
    L([-2.6, 2.6].map((dx) => k.lineOnTop([dx, cap.y], [dx, cap.y + cap.d], PANEL_Z + 1 + KNOB_H, P)).join(""), { tone: "lo" }) +
    L(k.lineOnTop([0, cap.y], [0, cap.y + cap.d], PANEL_Z + 1 + KNOB_H, P), { tone: "hi" });
  return `<g data-part="knob-${f.key}" transform="${k.translateAlong(P, [posOf[f.key](value), 0, 0])}">${body}</g>`;
}

// ── control box: sequence selector and flip-angle dial ─────────────────────
function controlBox() {
  const z = CTRL_H;
  const out = [S(k.slabOf(CTRL, 0, CTRL_H, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(CTRL, 3.5, P, 4), { tone: "faint" }) })];
  // sequence selector
  const [mx, my] = MODE_KNOB;
  out.push(L(k.ring(mx, my, 10, z, P, 56), { tone: "faint" }));
  out.push(L(MODE_DETENTS.map((deg) => { const d = dirOf(deg); return k.lineOnTop([mx + d[0] * 10, my + d[1] * 10], [mx + d[0] * 7.6, my + d[1] * 7.6], z, P); }).join(""), { tone: "hi" }));
  ["SE", "IR", "GRE"].forEach((text, i) => { const d = dirOf(MODE_DETENTS[i]); out.push(k.faceTextSvg(k.topMatrix([mx + d[0] * 14.5, my + d[1] * 14.5 + 1.5], z, P, "x"), text, { size: 4, tone: "mid", anchor: "middle" })); });
  out.push(S(k.cylinder(mx, my, 6, z, 5, P, 40, 0.4), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(mx, my, 6, z, z + 5, 40, P), { tone: "lo" }));
  out.push(`<path data-part="mode-pointer" class="iso-line" data-tone="hi" data-free="" d="${pointerOf(k, P, MODE_KNOB, MODE_DETENTS[0], 5, z + 5)}"/>`);
  // flip-angle dial, 0–90°
  const [fx, fy] = FLIP_KNOB;
  out.push(L(k.ring(fx, fy, FLIP_R, z, P, 64), { tone: "faint" }));
  const minor = [];
  const major = [];
  for (let f = 0; f <= 90; f += 10) {
    const d = dirOf(dialOfFlip(f));
    const big = f % 30 === 0;
    (big ? major : minor).push(k.lineOnTop([fx + d[0] * FLIP_R, fy + d[1] * FLIP_R], [fx + d[0] * (FLIP_R - (big ? 2.6 : 1.6)), fy + d[1] * (FLIP_R - (big ? 2.6 : 1.6))], z, P));
  }
  out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }));
  [["0°", 0], ["90°", 90]].forEach(([text, f]) => { const d = dirOf(dialOfFlip(f)); out.push(k.faceTextSvg(k.topMatrix([fx + d[0] * 16.5, fy + d[1] * 16.5 + 1.5], z, P, "x"), text, { size: 3.6, tone: "mid", anchor: "middle" })); });
  out.push(`<g data-part="ernst-marks"></g>`);
  out.push(S(k.cylinder(fx, fy, 6.5, z, 5, P, 44, 0.4), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(fx, fy, 6.5, z, z + 5, 44, P), { tone: "lo" }));
  out.push(`<path data-part="flip-pointer" class="iso-line" data-tone="hi" data-free="" d="${pointerOf(k, P, FLIP_KNOB, dialOfFlip(90), 5.5, z + 5)}"/>`);
  out.push(k.faceTextSvg(k.sideMatrix([CTRL.x + 5, CTRL.y + CTRL.d], 3.4, P, "left"), "sequence · flip", { size: 4, tone: "mid" }));
  out.push(D(byDepth(k.corners(CTRL, 3)).map(([x, y]) => at([x, y, CTRL_H])), { size: 0.45 }));
  return out.join("");
}

// ── assemble ────────────────────────────────────────────────────────────────
const start = PRESETS[0];
const row = [
  { x: POST_X[0], svg: post(POST_X[0]) },
  ...TISSUES.map((t, i) => ({ x: GX[i], svg: gauge(t, GX[i], i) })),
  { x: POST_X[1], svg: post(POST_X[1]) },
].sort((a, b) => a.x - b.x);

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A contrast desk. Three sample vials of white matter, grey matter and cerebrospinal fluid stand under a crossbar; on each, a float rides a graduated rod to the height of that tissue's signal. In front of each vial a tile shows the grey level the tissue would have in the image, and a lightbox shows a whole synthetic brain slice made from the same three signals. Three faders at the front set TR, TE and TI, and a control box selects spin echo, inversion recovery or gradient echo and sets the flip angle.",
  body: [
    plate(),
    ...row.map((r) => r.svg),
    crossbar(),
    ...TISSUES.map((t, i) => tile(t, GX[i], i)),
    lightboxSvg(k, P, LBOX),
    ...FADERS.map((f) => faderPanel(f) + faderKnob(f, start[{ tr: "TR", te: "TE", ti: "TI" }[f.key]])),
    controlBox(),
  ],
});

const modelSource = readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "");

const live = `
${modelSource}
const pointerOf = ${pointerOf.toString()};
const P = ${JSON.stringify(P)};
const K = { lineOnTop };
const SCALE = ${SCALE}, RAIL0 = ${RAIL0}, TRAVEL = ${TRAVEL}, PANEL_Z = ${PANEL_Z};
const TI_STRIP_Y = ${FADERS[2].y + 3.4};
const MODE_KNOB = ${JSON.stringify(MODE_KNOB)}, MODE_DETENTS = ${JSON.stringify(MODE_DETENTS)}, FLIP_KNOB = ${JSON.stringify(FLIP_KNOB)}, FLIP_R = ${FLIP_R}, CTRL_H = ${CTRL_H};
const dialOfFlip = (f) => -120 + (240 * f) / 90;
const posOf = {
  tr: (v) => RAIL0 + (TRAVEL * Math.log10(v / TR_RANGE[0])) / Math.log10(TR_RANGE[1] / TR_RANGE[0]),
  te: (v) => RAIL0 + (v / TE_SCALE) * TRAVEL,
  ti: (v) => RAIL0 + (v / TI_SCALE) * TRAVEL,
};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const q = (name) => svg.querySelector('[data-part="' + name + '"]');
const floats = TISSUES.map((_, i) => q("float-" + i));
const pixels = TISSUES.map((_, i) => q("pixel-" + i));
const knobs = { tr: q("knob-tr"), te: q("knob-te"), ti: q("knob-ti") };
const modePointer = q("mode-pointer"), flipPointer = q("flip-pointer"), ernstMarks = q("ernst-marks"), nullMarks = q("null-marks"), rangeLamp = q("range-lamp");
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

let want = { ...PRESETS[0] };
let now = { ...want };
let level = TISSUES.map((t) => ({ at: signalOf(t, want), rate: 0 }));
let gain = 1;
let frame = 0, last = 0, clock = 0, touring = !still.matches, visible = false, idleTimer = 0;
const DWELL = 3.4;

${FILM_JS}
const paintFilm = makeFilm(svg, ${JSON.stringify(SLICE)}, TISSUES.map((t) => t.key));

function draw() {
  knobs.tr.setAttribute("transform", translateAlong(P, [posOf.tr(now.TR), 0, 0]));
  knobs.te.setAttribute("transform", translateAlong(P, [posOf.te(now.TE), 0, 0]));
  knobs.ti.setAttribute("transform", translateAlong(P, [posOf.ti(now.TI), 0, 0]));
  modePointer.setAttribute("d", pointerOf(K, P, MODE_KNOB, MODE_DETENTS[MODES.indexOf(now.mode)], 5, CTRL_H + 5));
  flipPointer.setAttribute("d", pointerOf(K, P, FLIP_KNOB, dialOfFlip(now.mode === "GRE" ? now.flip : 90), 5.5, CTRL_H + 5));
  ernstMarks.innerHTML = now.mode === "GRE" ? dotsSvg(TISSUES.map((t) => { const a = (dialOfFlip(ernstOf(t, now.TR)) * Math.PI) / 180; return iso([FLIP_KNOB[0] + Math.sin(a) * FLIP_R, FLIP_KNOB[1] - Math.cos(a) * FLIP_R, CTRL_H], P); }), { size: 1, tone: "hi" }) : "";
  nullMarks.innerHTML = now.mode === "IR" ? dotsSvg(TISSUES.map((t) => iso([posOf.ti(nullTiOf(t, now.TR)), TI_STRIP_Y, PANEL_Z + 0.6], P)), { size: 1, tone: "hi" }) : "";
  rangeLamp.setAttribute("opacity", clamp((gain - 1) / 9, 0, 1).toFixed(2));
  const top = Math.max(...level.map((l) => l.at), 1e-6);
  level.forEach((l, i) => {
    floats[i].setAttribute("transform", translateAlong(P, [0, 0, clamp(l.at * gain, 0, 1.05) * SCALE]));
    const shade = Math.round(4 + 92 * clamp(l.at / top, 0, 1));
    pixels[i].style.fill = "hsl(0 0% " + shade + "%)";
  });
  paintFilm(level.map((l) => l.at / top));
  const signals = TISSUES.map((t) => signalOf(t, now));
  const s = TISSUES.map((t, i) => ({ name: t.name, v: signals[i] })).sort((a, b) => b.v - a.v);
  const near = (a, b) => a - b < 0.02 * Math.max(s[0].v, 1e-6) * 5;
  const order = s.map((x, i) => x.name + (i < s.length - 1 ? (near(x.v, s[i + 1].v) ? " ≈ " : " > ") : "")).join("");
  let params = "TR " + Math.round(now.TR) + " · ";
  if (now.mode === "IR") params += "TI " + Math.round(now.TI) + " · ";
  params += "TE " + Math.round(now.TE);
  if (now.mode === "GRE") params += " · " + Math.round(now.flip) + "°";
  const text = now.mode + " · " + params + " · " + weightingOf(now, signals) + " · " + order;
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuetext", text);
}

function tick(t) {
  const dt = last ? Math.min((t - last) / 1000, 1 / 30) : 1 / 60;
  last = t;
  const calm = still.matches;
  if (touring) {
    clock += dt;
    want = { ...PRESETS[Math.floor(clock / DWELL) % PRESETS.length] };
  }
  const ease = calm ? 1 : 1 - Math.exp(-dt / 0.35);
  now.mode = want.mode;
  now.TR = Math.exp(Math.log(now.TR) + (Math.log(want.TR) - Math.log(now.TR)) * ease);
  for (const key of ["TE", "TI", "flip"]) now[key] += (want[key] - now[key]) * ease;
  let settled = true;
  for (const key of ["TR", "TE", "TI", "flip"]) {
    if (Math.abs(want[key] - now[key]) < (key === "TR" ? 0.5 : 0.05)) now[key] = want[key];
    else settled = false;
  }
  const targets = TISSUES.map((tissue) => signalOf(tissue, now));
  const wantGain = Math.max(...targets) < 0.1 ? 10 : 1;
  gain += (wantGain - gain) * (calm ? 1 : 1 - Math.exp(-dt / 0.3));
  if (Math.abs(wantGain - gain) < 0.01) gain = wantGain; else settled = false;
  TISSUES.forEach((tissue, i) => {
    const l = level[i];
    if (calm) { l.at = targets[i]; l.rate = 0; return; }
    const stiff = 160, drag = 2 * Math.sqrt(stiff) * 0.8;
    for (let n = 0; n < 4; n++) { l.rate += ((targets[i] - l.at) * stiff - l.rate * drag) * dt / 4; l.at += l.rate * dt / 4; }
    if (Math.abs(targets[i] - l.at) < 1e-4 && Math.abs(l.rate) < 1e-4) { l.at = targets[i]; l.rate = 0; } else settled = false;
  });
  draw();
  frame = visible && (touring || !settled) ? requestAnimationFrame(tick) : 0;
}

const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
function steer(change) {
  touring = false;
  const next = { ...want, ...change };
  next.TR = clamp(next.TR, TR_MIN[next.mode], TR_RANGE[1]);
  next.TE = clamp(next.TE, TE_RANGE[0], Math.min(TE_RANGE[1], next.TR - 1));
  next.TI = clamp(next.TI, TI_RANGE[0], Math.min(TI_RANGE[1], next.TR - 10));
  next.flip = clamp(next.flip, FLIP_RANGE[0], FLIP_RANGE[1]);
  want = next;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { touring = !still.matches; clock = 0; run(); }, 6000);
  if (still.matches) { now = { ...want }; level.forEach((l, i) => (l.at = signalOf(TISSUES[i], now))); gain = Math.max(...level.map((l) => l.at)) < 0.1 ? 10 : 1; draw(); return; }
  run();
}
new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("pointermove", (event) => {
  const box = svg.getBoundingClientRect();
  const sx = clamp(((event.clientX - box.left) / box.width - 0.12) / 0.76, 0, 1);
  const sy = clamp(((event.clientY - box.top) / box.height - 0.15) / 0.7, 0, 1);
  const TE = TE_RANGE[0] + sy * (TE_RANGE[1] - TE_RANGE[0]);
  if (want.mode === "IR") steer({ TI: TI_RANGE[0] + sx * (TI_RANGE[1] - TI_RANGE[0]), TE });
  else if (want.mode === "GRE") steer({ flip: FLIP_RANGE[0] + sx * (FLIP_RANGE[1] - FLIP_RANGE[0]), TE });
  else steer({ TR: TR_MIN.SE * Math.pow(TR_RANGE[1] / TR_MIN.SE, sx), TE });
});
stage.addEventListener("keydown", (event) => {
  const m = want.mode;
  const across = (sign) => (m === "IR" ? { TI: want.TI + 50 * sign } : m === "GRE" ? { flip: want.flip + 2 * sign } : { TR: want.TR * Math.pow(1.15, sign) });
  if (event.key === "ArrowRight") steer(across(1));
  else if (event.key === "ArrowLeft") steer(across(-1));
  else if (event.key === "ArrowDown") steer({ TE: want.TE + (m === "GRE" ? 2 : 5) });
  else if (event.key === "ArrowUp") steer({ TE: want.TE - (m === "GRE" ? 2 : 5) });
  else if (event.key === "]") steer({ TR: want.TR * 1.15 });
  else if (event.key === "[") steer({ TR: want.TR / 1.15 });
  else if (event.key === "m" || event.key === "M") steer({ mode: MODES[(MODES.indexOf(m) + 1) % MODES.length] });
  else if (/^[1-7]$/.test(event.key)) steer({ ...PRESETS[Number(event.key) - 1] });
  else return;
  event.preventDefault();
});
draw();
`;

const csf = TISSUES[2];
const body = k.plateHtml({
  fig: "Fig 4",
  title: "Contrast desk",
  hint: "Hover or keys 1–7",
  readout: "SE · TR 500 · TE 15 · T1w · WM > GM > CSF",
  keys: [
    { mark: "lit", label: "Floats: each tissue's signal for the chosen sequence (the ×10 lamp means the gauges read ten times larger)" },
    { mark: "raised", label: "Faders: TR (log scale), TE and TI; knobs: sequence and flip angle" },
    { mark: "dotted", label: "Lit dots: null points on the TI scale (WM, GM, CSF from left) and Ernst angles on the flip dial (CSF, GM, WM)" },
    { mark: "flat", label: "Tiles: the grey level each tissue gets in the image" },
    { mark: "edge", label: `Lightbox: synthetic MRI of an MNI152 slice (z = +${SLICE.z} mm, radiological view)` },
  ],
  caption:
    `Each float rides to its tissue's signal for the chosen sequence, using approximate 3 T values: WM T1 830, T2 80 ms; GM T1 1330, T2 110 ms; CSF T1 4000, T2 2000 ms; proton density 0.7, 0.8 and 1.0. ` +
    `Spin echo (SE): S = PD · (1 − e^(−TR/T1)) · e^(−TE/T2). Short TR lets only short-T1 tissue recover, so WM is brightest (T1 weighting); long TR with long TE keeps only long-T2 tissue, so CSF is brightest (T2 weighting); long TR with short TE leaves proton density. ` +
    `Inversion recovery (IR) adds a 180° pulse a time TI before the readout: S = PD · |1 − 2e^(−TI/T1) + e^(−TR/T1)| · e^(−TE/T2), a magnitude image. Each tissue vanishes at its own null, TI = T1 · ln(2 / (1 + e^(−TR/T1))). FLAIR times TI to the CSF null (${Math.round(nullTiOf(csf, 9000))} ms at TR 9 s) and leaves T2-weighted tissue beside black fluid. A short TI near 0.9 s gives the strong T1 contrast MPRAGE relies on; MPRAGE itself reads out with a fast gradient-echo train, which this model leaves out. ` +
    `Spoiled gradient echo (GRE) has no refocusing pulse and usually a flip angle α below 90°: S = PD · sin α · (1 − E1) / (1 − cos α · E1) · e^(−TE/T2*), with E1 = e^(−TR/T1). Each tissue gives its most signal at its Ernst angle, cos α = E1; larger flip angles make the image more T1-weighted. T2* follows 1/T2* = 1/T2 + 1/T2′ with T2′ = ${T2_PRIME} ms for a well-shimmed brain: ${TISSUES.map((t) => t.name + " " + Math.round(t2StarOf(t)) + " ms").join(", ")}. Short-TR gradient echoes give little signal per shot; when every tissue is below 0.1 the range lamp lights and the gauges read ten times larger. ` +
    `The tiles and the film are windowed to the brightest tissue, as a scanner display would be. ` +
    MNI_NOTICE,
  body: `<div class="iso-stage" tabindex="0" role="application" aria-roledescription="contrast desk" aria-label="Contrast desk: keys 1 to 7 choose T1, PD and T2-weighted spin echo, FLAIR, T1 inversion, T1-weighted and T2-star-weighted gradient echo; M changes the sequence; left and right arrows change TR, TI or flip angle; up and down change TE; square brackets change TR">${svg}</div>`,
});

const css = `<style>.cd-pixel{stroke:none;fill:hsl(0 0% 50%)}</style>`;
writeFileSync(join(HERE, OUT), k.pageHtml({ title: "Contrast desk", theme, body: css + body, script: kitScript() + live }));
console.log("wrote", OUT);
