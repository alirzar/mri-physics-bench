// Fig 3 — Relaxation dome: T1 regrowth, T2 decay and the inversion null, traced by the magnetization.
// node build.mjs            → relaxation-dome.html (dark)
// node build.mjs --light    → relaxation-dome-light.html
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../_anatomy/kit/iso-kit.mjs";
import { kitScript } from "../_anatomy/scripts/inline-kit.mjs";
import { TISSUES, FLIPS, RUN, SPAN_T1, mzOf, mxyOf, nullOf } from "./model.mjs";
import { loadSlice, lightboxGeometry, lightboxSvg, FILM_JS, MNI_NOTICE } from "../_shared/lightbox.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const OUT = theme === "light" ? "relaxation-dome-light.html" : "relaxation-dome.html";

const WIDTH = 600;
const HEIGHT = 400;

// ── world layout ────────────────────────────────────────────────────────────
const PLATE = { x: -150, y: -110, w: 300, d: 198, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

const G = [-30, -30, 62]; // globe centre = arrow pivot
const R = 44; // glass radius
const ARROW = 40; // arrow length for |M| = 1
const STAND_R = 22;

// gauges at the back left: Mz (−1..1) and Mxy (0..1)
const GAUGES = [
  { key: "mz", label: "Mz", x: -132, lo: -1, hi: 1, marks: [0.63, 0] },
  { key: "mxy", label: "Mxy", x: -110, lo: 0, hi: 1, marks: [0.37] },
];
const GY = -40;
const GZ0 = 16;
const GZ1 = 104;

// console at the front: tissue knob, flip knob, RF button
const CONSOLE = { x: -70, y: 36, w: 170, d: 40, r: 3 };
const CONSOLE_H = 10;
const TISSUE_KNOB = [-40, 56];
const TISSUE_DETENTS = [-45, 0, 45];
const FLIP_KNOB = [15, 56];
const FLIP_DETENTS = [-35, 35];
const RF_BUTTON = [66, 56];

const SLICE = loadSlice();
const LBOX = lightboxGeometry({ x: 40, y: -100, w: 104, d: 12, r: 2 }, SLICE, { top: 100, grid: [2, 1], labels: ["Mz", "Mxy"] });

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [G[0], G[1], G[2] + R], [GAUGES[0].x, GY, GZ1 + 6], [LBOX.LB.x + LBOX.LB.w, LBOX.LB.y, LBOX.top]],
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
const gaugeZ = (g, v) => GZ0 + ((v - g.lo) / (g.hi - g.lo)) * (GZ1 - GZ0);

// ── the arrow, drawn along any direction (shared by build and page) ────────
function arrowSvg(K, P, base, vec) {
  const len = Math.hypot(vec[0], vec[1], vec[2]);
  if (len < 0.3) return K.solidSvg(K.cylinder(base[0], base[1], 2.4, base[2] - 1.2, 2.4, P, 20), { tone: "hi", lit: true, crease: "lo" });
  const a = vec.map((c) => c / len);
  const d0 = K.depthOf([0, 0, 0], P);
  const V = [K.depthOf([1, 0, 0], P) - d0, K.depthOf([0, 1, 0], P) - d0, K.depthOf([0, 0, 1], P) - d0];
  const cross = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
  const norm = (p) => { const n = Math.hypot(...p) || 1; return p.map((c) => c / n); };
  const u = norm(cross(a, Math.abs(a[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]));
  const v = cross(a, u);
  const pt = (s, r, g) => [0, 1, 2].map((i) => base[i] + a[i] * s + r * (u[i] * Math.cos(g) + v[i] * Math.sin(g)));
  const ring = (s, r, n = 20) => Array.from({ length: n }, (_, i) => pt(s, r, (2 * Math.PI * i) / n));
  const hull = (pts) => {
    const q = pts.map((p) => K.iso(p, P)).sort((m, n) => m[0] - n[0] || m[1] - n[1]);
    const side = (o, m, n) => (m[0] - o[0]) * (n[1] - o[1]) - (m[1] - o[1]) * (n[0] - o[0]);
    const lo = [], hi = [];
    for (const p of q) { while (lo.length > 1 && side(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (const p of q.reverse()) { while (hi.length > 1 && side(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
    return K.pathOf(lo.slice(0, -1).concat(hi.slice(0, -1)), true);
  };
  const solid = (pts) => { const o = hull(pts); return K.solidSvg({ fill: o, outline: o, crease: "", top: "", shades: ["", o, "", ""] }, { tone: "hi", lit: true, crease: "none" }); };
  const head = Math.min(7, len);
  const hr = 3.4 * (head / 7);
  const shaft = len - head > 0.5 ? solid([...ring(0, 1.3), ...ring(len - head, 1.3)]) : "";
  const cone = solid([...ring(len - head, hr, 28), pt(len, 0, 0)]);
  const ball = K.solidSvg(K.cylinder(base[0], base[1], 2.4, base[2] - 1.2, 2.4, P, 20), { tone: "mid", crease: "lo" });
  const toward = a[0] * V[0] + a[1] * V[1] + a[2] * V[2] >= 0;
  return toward ? ball + shaft + cone : cone + shaft + ball;
}
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

// ── gauges ─────────────────────────────────────────────────────────────────
function gauge(g) {
  const x = g.x;
  const out = [];
  const foot = { x: x - 9, y: GY - 9, w: 18, d: 22, r: 2 };
  out.push(S(k.slabOf(foot, 0, 6, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(foot, 2, P, 3), { tone: "faint" }) }));
  out.push(k.faceTextSvg(k.sideMatrix([x, foot.y + foot.d], 4.4, P, "left"), g.label, { size: 4.2, tone: "mid", anchor: "middle" }));
  const plateY = GY - 6;
  const face = plateY + 1.6;
  const left = x - 8;
  out.push(S(k.slabOf({ x: left, y: plateY, w: 16, d: 1.6, r: 0.3 }, 6, GZ1 + 4 - 6, P, 2, 0.3), { tone: "mid", crease: "none" }));
  const minor = [];
  const major = [];
  for (let i = 0; i <= 20; i++) {
    const v = g.lo + ((g.hi - g.lo) * i) / 20;
    (i % 5 === 0 ? major : minor).push(k.segment([left, face, gaugeZ(g, v)], [left + (i % 5 === 0 ? 5 : 2.8), face, gaugeZ(g, v)], P));
  }
  out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }));
  out.push(L(g.marks.map((v) => k.segment([left, face, gaugeZ(g, v)], [x - 1.3, face, gaugeZ(g, v)], P)).join(""), { tone: "hi" }));
  out.push(S(k.cylinder(x, GY, 1.3, 6, GZ1 + 4 - 6, P, 16), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(x, GY, 3.2, GZ1 + 4, 3, P, 24, 0.3), { tone: "mid" }));
  out.push(`<g data-part="float-${g.key}" transform="${k.translateAlong(P, [0, 0, gaugeZ(g, g.key === "mz" ? 1 : 0)])}">` + S(k.cylinder(x, GY, 5, -2, 4, P, 32, 0.4), { tone: "hi", crease: "lo", inner: L(k.sideArc(x, GY, 5, -0.5, P, 24), { tone: "lo" }) }) + `</g>`);
  return out.join("");
}

// ── globe on a stand ───────────────────────────────────────────────────────
function standAndBack() {
  const [x, y] = G;
  const out = [`<path class="iso-halo" d="${k.haloOf({ x: x - STAND_R, y: y - STAND_R, w: STAND_R * 2, d: STAND_R * 2, r: STAND_R }, 0, 0.1, P)}" style="filter:blur(4px)"/>`];
  out.push(S(k.cylinder(x, y, STAND_R, 0, 6, P, 72, 0.8), { tone: "mid", inner: L(k.sideArc(x, y, STAND_R, 2.5, P, 48), { tone: "faint" }) }));
  out.push(D(byDepth([0, 1, 2, 3].map((i) => [x + 17 * Math.cos((i * Math.PI) / 2 + 0.4), y + 17 * Math.sin((i * Math.PI) / 2 + 0.4)])).map(([px, py]) => at([px, py, 6])), { size: 0.45 }));
  out.push(S(k.cylinder(x, y, 3, 6, G[2] - R - 6 + 2, P, 20), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(x, y, 9, G[2] - R - 2, 3, P, 40, 0.4), { tone: "mid" }));
  // the transverse plane: an equator ring etched in the glass, and two axes across it
  out.push(L(k.ring(x, y, R, G[2], P, 120), { tone: "faint" }));
  out.push(L(k.lineOnTop([x - R, y], [x + R, y], G[2], P) + k.lineOnTop([x, y - R], [x, y + R], G[2], P), { tone: "faint" }));
  return out.join("");
}

function glass() {
  const c = at(G);
  const side = at([G[0] + R * Math.sin((55 * Math.PI) / 180), G[1] - R * Math.cos((55 * Math.PI) / 180), G[2]]);
  const r = Math.hypot(side[0] - c[0], side[1] - c[1]);
  const circle = `M${(c[0] - r).toFixed(1)} ${c[1].toFixed(1)}A${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(c[0] + r).toFixed(1)} ${c[1].toFixed(1)}A${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(c[0] - r).toFixed(1)} ${c[1].toFixed(1)}Z`;
  const a0 = (205 * Math.PI) / 180, a1 = (245 * Math.PI) / 180, hr = r * 0.84;
  const shine = `M${(c[0] + hr * Math.cos(a0)).toFixed(1)} ${(c[1] + hr * Math.sin(a0)).toFixed(1)}A${hr.toFixed(1)} ${hr.toFixed(1)} 0 0 1 ${(c[0] + hr * Math.cos(a1)).toFixed(1)} ${(c[1] + hr * Math.sin(a1)).toFixed(1)}`;
  return L(circle, { tone: "lo" }) + L(shine, { tone: "faint", free: true });
}

// ── console ────────────────────────────────────────────────────────────────
function knob(centre, detents, labels, part, start) {
  const [cx, cy] = centre;
  const z = CONSOLE_H;
  const out = [L(k.ring(cx, cy, 10, z, P, 56), { tone: "faint" })];
  out.push(L(detents.map((deg) => { const d = dirOf(deg); return k.lineOnTop([cx + d[0] * 10, cy + d[1] * 10], [cx + d[0] * 7.6, cy + d[1] * 7.6], z, P); }).join(""), { tone: "hi" }));
  labels.forEach((text, i) => { const d = dirOf(detents[i]); out.push(k.faceTextSvg(k.topMatrix([cx + d[0] * 15, cy + d[1] * 15 + 1.5], z, P, "x"), text, { size: 3.6, tone: "mid", anchor: "middle" })); });
  out.push(S(k.cylinder(cx, cy, 6, z, 5, P, 40, 0.4), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(cx, cy, 6, z, z + 5, 40, P), { tone: "lo" }));
  out.push(`<path data-part="${part}" class="iso-line" data-tone="hi" data-free="" d="${pointerOf(k, P, centre, detents[start], 5, z + 5)}"/>`);
  return out.join("");
}

function console_() {
  const out = [S(k.slabOf(CONSOLE, 0, CONSOLE_H, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(CONSOLE, 3.5, P, 4), { tone: "faint" }) })];
  out.push(knob(TISSUE_KNOB, TISSUE_DETENTS, TISSUES.map((t) => t.name), "tissue-pointer", 0));
  out.push(knob(FLIP_KNOB, FLIP_DETENTS, FLIPS.map((f) => f + "°"), "flip-pointer", 0));
  const [bx, by] = RF_BUTTON;
  out.push(S(k.cylinder(bx, by, 8, CONSOLE_H, 1.4, P, 36), { tone: "lo" }));
  out.push(`<g data-part="rf">${S(k.cylinder(bx, by, 5.6, CONSOLE_H + 1.4, 4, P, 36, 0.5), { tone: "hi", crease: "lo", inner: L(k.sideArc(bx, by, 5.6, CONSOLE_H + 2.8, P, 24), { tone: "faint" }) })}</g>`);
  out.push(k.faceTextSvg(k.topMatrix([bx, by + 14], CONSOLE_H, P, "x"), "RF", { size: 4.4, tone: "mid", anchor: "middle" }));
  out.push(k.faceTextSvg(k.sideMatrix([CONSOLE.x + 6, CONSOLE.y + CONSOLE.d], 3.5, P, "left"), "tissue · flip", { size: 4, tone: "mid" }));
  out.push(D(byDepth(k.corners(CONSOLE, 3)).map(([x, y]) => at([x, y, CONSOLE_H])), { size: 0.45 }));
  return out.join("");
}

// ── assemble ────────────────────────────────────────────────────────────────
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A glass globe on a stand with an arrow pivoting at its centre: the net magnetization. After an RF pulse the arrow is tipped; it precesses while its sideways part shrinks (T2) and its upright part regrows (T1), and a pen on its tip traces a spiral back to the top. Two graduated gauges at the back read the upright part Mz and the sideways part Mxy, marked at 63% and 37%. A console at the front chooses the tissue and a 90° or 180° pulse, and a lightbox shows a brain film of each.",
  body: [
    plate(),
    lightboxSvg(k, P, LBOX),
    ...GAUGES.map(gauge),
    standAndBack(),
    `<path data-part="trace" class="iso-line" data-tone="hi" data-free="" d=""/>`,
    `<g data-part="arrow">${arrowSvg(k, P, G, [0, 0, ARROW])}</g>`,
    glass(),
    console_(),
  ],
});

const modelSource = readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "");

const live = `
${modelSource}
const arrowSvg = ${arrowSvg.toString()};
const pointerOf = ${pointerOf.toString()};
const P = ${JSON.stringify(P)};
const K = { solidSvg, cylinder, depthOf, iso, pathOf, lineOnTop };
const G = ${JSON.stringify(G)}, ARROW = ${ARROW}, GZ0 = ${GZ0}, GZ1 = ${GZ1};
const GAUGES = ${JSON.stringify(GAUGES)};
const gaugeZ = (g, v) => GZ0 + ((v - g.lo) / (g.hi - g.lo)) * (GZ1 - GZ0);
const TISSUE_KNOB = ${JSON.stringify(TISSUE_KNOB)}, TISSUE_DETENTS = ${JSON.stringify(TISSUE_DETENTS)};
const FLIP_KNOB = ${JSON.stringify(FLIP_KNOB)}, FLIP_DETENTS = ${JSON.stringify(FLIP_DETENTS)}, KNOB_Z = ${CONSOLE_H + 5};
${FILM_JS}
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const SLICE = ${JSON.stringify(SLICE)};
const filmMz = makeFilm(svg, SLICE, TISSUES.map((t) => t.key), "film-0");
const filmMxy = makeFilm(svg, SLICE, TISSUES.map((t) => t.key), "film-1");
const q = (name) => svg.querySelector('[data-part="' + name + '"]');
const arrow = q("arrow"), trace = q("trace"), rf = q("rf"), tissuePointer = q("tissue-pointer"), flipPointer = q("flip-pointer");
const floats = { mz: q("float-mz"), mxy: q("float-mxy") };
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const TOUR = [{ tissue: 0, flip: 90 }, { tissue: 2, flip: 90 }, { tissue: 2, flip: 180 }, { tissue: 0, flip: 180 }];
const HOLD = 1.6;
let sel = { tissue: 0, flip: 90 }, run = { ...sel };
let s = 0, hold = 0, frame = 0, last = 0, clock = 0, pressed = -1e9, visible = false, touring = !still.matches, tourAt = 1, idleTimer = 0, scrubbing = false;
let knobShown = { tissue: 0, flip: 0 };
let path = [];

function tipAt(sNow) {
  const tissue = TISSUES[run.tissue];
  const t = timeOf(tissue, sNow);
  const phi = 2 * Math.PI * TURNS_PER_SECOND * sNow;
  const mz = mzOf(tissue, t, run.flip), mxy = mxyOf(tissue, t, run.flip);
  return { t, mz, mxy, vec: [ARROW * mxy * Math.cos(phi), ARROW * mxy * Math.sin(phi), ARROW * mz] };
}

function rebuildPath(sNow) {
  path = [];
  for (let u = 0; u <= sNow + 1e-9; u += 1 / 60) path.push(tipAt(u).vec);
}

function draw() {
  const tissue = TISSUES[run.tissue];
  const now = tipAt(s);
  arrow.innerHTML = arrowSvg(K, P, G, now.vec);
  const pts = path.concat([now.vec]).map((v) => iso([G[0] + v[0], G[1] + v[1], G[2] + v[2]], P));
  trace.setAttribute("d", pts.length > 1 ? pathOf(pts) : "");
  floats.mz.setAttribute("transform", translateAlong(P, [0, 0, gaugeZ(GAUGES[0], now.mz)]));
  floats.mxy.setAttribute("transform", translateAlong(P, [0, 0, gaugeZ(GAUGES[1], now.mxy)]));
  tissuePointer.setAttribute("d", pointerOf(K, P, TISSUE_KNOB, TISSUE_DETENTS[0] + knobShown.tissue * 45, 5, KNOB_Z));
  flipPointer.setAttribute("d", pointerOf(K, P, FLIP_KNOB, FLIP_DETENTS[0] + knobShown.flip * 70, 5, KNOB_Z));
  rf.setAttribute("transform", translateAlong(P, [0, 0, -1.8 * Math.exp(-Math.max(0, clock - pressed) / 0.25)]));
  filmMz(TISSUES.map((x) => x.PD * Math.abs(mzOf(x, now.t, run.flip))));
  filmMxy(TISSUES.map((x) => x.PD * mxyOf(x, now.t, run.flip)));
  let note = "";
  if (Math.abs(now.t - tissue.T2) < tissue.T2 * 0.12) note = " · t ≈ T2";
  else if (Math.abs(now.t - tissue.T1) < tissue.T1 * 0.06) note = " · t ≈ T1";
  if (run.flip === 180 && Math.abs(now.t - nullOf(tissue)) < tissue.T1 * 0.05) note = " · null (T1·ln2)";
  const text = tissue.name + " (T1 " + tissue.T1 + ", T2 " + tissue.T2 + ") · " + run.flip + "° · t " + Math.round(now.t) + " ms · Mz " + now.mz.toFixed(2) + " · Mxy " + now.mxy.toFixed(2) + note;
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuetext", text);
}

function pulse() {
  if (touring) { const p = TOUR[tourAt++ % TOUR.length]; sel = { ...p }; }
  run = { ...sel };
  s = 0; hold = 0; path = []; pressed = clock;
}

function tick(stamp) {
  const dt = last ? Math.min((stamp - last) / 1000, 1 / 30) : 1 / 60;
  last = stamp;
  clock += dt;
  const ease = 1 - Math.exp(-dt / 0.3);
  knobShown.tissue += (sel.tissue - knobShown.tissue) * ease;
  knobShown.flip += ((sel.flip === 180 ? 1 : 0) - knobShown.flip) * ease;
  if (!scrubbing) {
    if (s < RUN) { s = Math.min(RUN, s + dt); path.push(tipAt(s).vec); }
    else { hold += dt; if (hold > HOLD && (touring || run.tissue !== sel.tissue || run.flip !== sel.flip)) pulse(); }
  }
  draw();
  frame = visible ? requestAnimationFrame(tick) : 0;
}

const go = () => { if (!frame && visible && !still.matches) { last = 0; frame = requestAnimationFrame(tick); } };
function user() {
  touring = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { touring = !still.matches; scrubbing = false; }, 10000);
}
function choose(change) {
  user(); scrubbing = false;
  Object.assign(sel, change);
  if (still.matches) { run = { ...sel }; knobShown = { tissue: sel.tissue, flip: sel.flip === 180 ? 1 : 0 }; rebuildPath(s); draw(); return; }
  pulse(); go();
}
new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) go(); }, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("pointermove", (event) => {
  user(); scrubbing = true;
  const box = svg.getBoundingClientRect();
  s = clamp(((event.clientX - box.left) / box.width - 0.12) / 0.76, 0, 1) * RUN;
  rebuildPath(s);
  if (still.matches) draw(); else go();
});
stage.addEventListener("pointerleave", () => { scrubbing = false; });
stage.addEventListener("click", () => choose({}));
stage.addEventListener("keydown", (event) => {
  if (/^[1-3]$/.test(event.key)) choose({ tissue: Number(event.key) - 1 });
  else if (event.key === "f" || event.key === "F") choose({ flip: sel.flip === 90 ? 180 : 90 });
  else if (event.key === "Enter" || event.key === " ") choose({});
  else if (event.key === "ArrowRight" || event.key === "ArrowLeft") { user(); scrubbing = true; s = clamp(s + (event.key === "ArrowRight" ? 0.3 : -0.3), 0, RUN); rebuildPath(s); if (still.matches) draw(); else go(); }
  else return;
  event.preventDefault();
});
if (still.matches) { s = RUN * 0.45; rebuildPath(s); }
draw();
`;

const body = k.plateHtml({
  fig: "Fig 3",
  title: "Relaxation dome",
  hint: "Hover to scrub · click",
  readout: "WM (T1 830, T2 80) · 90° · t 0 ms · Mz 0.00 · Mxy 1.00",
  keys: [
    { mark: "lit", label: "Arrow: net magnetization, tipped by the pulse and relaxing back" },
    { mark: "raised", label: "Gauges: Mz (mark at 63%, and the zero line) and Mxy (mark at 37%)" },
    { mark: "edge", label: `Lightbox: proton density × |Mz| and × Mxy for every tissue at this moment, MNI152 slice z = +${SLICE.z} mm` },
  ],
  caption: `After an RF pulse the magnetization relaxes back along B0 in two independent ways. The sideways part Mxy, the part that gives signal, decays as e^(−t/T2): 37% is left at t = T2. The upright part Mz regrows as 1 − (1 − cos α)·e^(−t/T1): after a 90° pulse it is 63% back at t = T1. T2 is always shorter than T1, so the arrow's tip spirals in towards the axis long before it is back to full height. Approximate 3 T values: WM T1 830, T2 80 ms; GM T1 1330, T2 110 ms; CSF T1 4000, T2 2000 ms. After a 180° inversion there is no sideways part at all; Mz = 1 − 2e^(−t/T1) shrinks through zero at t = T1·ln 2 (${Math.round(nullOf(TISSUES[0]))} ms for WM, ${Math.round(nullOf(TISSUES[2]))} ms for CSF) and regrows. A readout timed to that null blanks the tissue: inversion recovery, and with CSF nulled, FLAIR. The Mz film is what a readout pulse at this moment would see (proton density × |Mz|), so T1 contrast builds up in it; the Mxy film is the signal still precessing. Each run covers ${SPAN_T1}·T1 of the chosen tissue on a logarithmic clock so the fast T2 decay and slow T1 regrowth both show; precession is drawn far slower than real. ${MNI_NOTICE}`,
  body: `<div class="iso-stage" tabindex="0" role="application" aria-roledescription="relaxation dome" aria-label="Relaxation dome: keys 1 to 3 choose white matter, grey matter or CSF, F switches between a 90 and a 180 degree pulse, Enter pulses again, left and right arrows scrub through time">${svg}</div>`,
});

writeFileSync(join(HERE, OUT), k.pageHtml({ title: "Relaxation dome", theme, body, script: kitScript() + live }));
console.log("wrote", OUT);
