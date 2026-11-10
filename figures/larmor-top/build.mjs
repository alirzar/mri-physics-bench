// Fig 2 — Larmor top and RF tuner: precession at f0 = γ̄B0, and resonance.
// node build.mjs            → larmor-top.html (dark)
// node build.mjs --light    → larmor-top-light.html
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../_anatomy/kit/iso-kit.mjs";
import { kitScript } from "../_anatomy/scripts/inline-kit.mjs";
import { B0_OPTIONS, TUNER_RANGE, F1, REAL_F1_HZ, GAMMA_BAR, METABOLITES, PPM_RANGE, larmorOf, slowdownOf, linewidthHz } from "./model.mjs";
import { loadSlice, lightboxGeometry, lightboxSvg, FILM_JS, MNI_NOTICE } from "../_shared/lightbox.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const OUT = theme === "light" ? "larmor-top-light.html" : "larmor-top.html";

const WIDTH = 600;
const HEIGHT = 400;

// ── world layout ────────────────────────────────────────────────────────────
const PLATE = { x: -150, y: -110, w: 300, d: 198, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

// vertical C-frame magnet: B0 points up (+z), from the lower pole to the upper one
const M = [-20, -30];
const POLE_R = 38;
const LOW_H = 12;
const UP_Z = 96;
const UP_H = 10;
const COLUMN = { x: -44, y: -100, w: 48, d: 22, r: 2 };
const ARM = { x: -44, y: -78, w: 48, d: 42, r: 2 };
const FRAME_TOP = 118;
const PIVOT = [M[0], M[1], 34];

// RF coil standing left of the top, its axis along x (perpendicular to B0)
const COIL_FOOT = { x: -92, y: -54, w: 16, d: 48, r: 2 };
const COIL = { x: -84, y: -50, w: 4, d: 40, r: 0.8 };
const COIL_Z = [14, 62];

// RF generator with the tuning dial
const GEN = { x: -130, y: 36, w: 150, d: 44, r: 3 };
const GEN_H = 14;
const WINDOW = { x: -120, y: 44, w: 116, d: 12, r: 1.5 };
const FX0 = -118;
const FX1 = -6;
const fx = (f) => FX0 + ((f - TUNER_RANGE[0]) / (TUNER_RANGE[1] - TUNER_RANGE[0])) * (FX1 - FX0);
const TUNE_KNOB = [6, 60];
const FIRE = [-108, 70];
const LAMP = [-90, 70];

// B0 selector
const SEL = { x: 40, y: 20, w: 34, d: 32, r: 3 };
const SEL_H = 10;
const SEL_C = [57, 34];
const DETENTS = [-45, 0, 45];

// MRS spectrum analyzer at the front right: an upright screen, a fine-tuning knob and a small display
const ANA = { x: 84, y: 40, w: 60, d: 14, r: 2 };
const ANA_H = 52;
const ANA_FACE = ANA.y + ANA.d;
const SCREEN = { x0: 89, x1: 139, z0: 14, z1: 42 };
const SPEC_BASE = 17;
const SPEC_AMP = 22;
const FINE_KNOB = [132, 47];
const px = (ppm) => SCREEN.x0 + ((PPM_RANGE[0] - ppm) / (PPM_RANGE[0] - PPM_RANGE[1])) * (SCREEN.x1 - SCREEN.x0);
const CURSOR_START = 3.03;

const SLICE = loadSlice();
const LBOX = lightboxGeometry({ x: 76, y: -100, w: 64, d: 12, r: 2 }, SLICE, { top: 100 });

const B0_START = 3;
const TUNE_START = 80;

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [COLUMN.x, COLUMN.y, FRAME_TOP], [COLUMN.x + COLUMN.w, COLUMN.y, FRAME_TOP], [LBOX.LB.x + LBOX.LB.w, LBOX.LB.y, LBOX.top]],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: 55 },
);

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (pts) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const on = (pts, closed) => k.pathOf(pts.map((p) => at(p)), closed);
const dirOf = (deg) => [Math.sin((deg * Math.PI) / 180), -Math.cos((deg * Math.PI) / 180)];

// ── the top, drawn along any axis (shared by build and page) ───────────────
function topSvg(K, P, pivot, alpha, phi, spin) {
  const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
  const O = [0, 0, 0];
  const d0 = K.depthOf(O, P);
  const V = [K.depthOf([1, 0, 0], P) - d0, K.depthOf([0, 1, 0], P) - d0, K.depthOf([0, 0, 1], P) - d0];
  const a = [Math.sin(alpha) * Math.cos(phi), Math.sin(alpha) * Math.sin(phi), Math.cos(alpha)];
  const cross = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
  const norm = (p) => { const n = Math.hypot(...p) || 1; return [p[0] / n, p[1] / n, p[2] / n]; };
  const u = norm(cross(a, Math.abs(a[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]));
  const v = cross(a, u);
  const pt = (s, r, ang) => [0, 1, 2].map((i) => pivot[i] + a[i] * s + r * (u[i] * Math.cos(ang) + v[i] * Math.sin(ang)));
  const ring = (s, r, n = 40) => Array.from({ length: n }, (_, i) => pt(s, r, (2 * Math.PI * i) / n));
  const scr = (pts) => pts.map((p) => K.iso(p, P));
  const hull = (pts) => {
    const q = [...pts].sort((m, n) => m[0] - n[0] || m[1] - n[1]);
    const side = (o, m, n) => (m[0] - o[0]) * (n[1] - o[1]) - (m[1] - o[1]) * (n[0] - o[0]);
    const lo = [], hi = [];
    for (const p of q) { while (lo.length > 1 && side(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (const p of q.reverse()) { while (hi.length > 1 && side(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
    return lo.slice(0, -1).concat(hi.slice(0, -1));
  };
  const up = a[0] * V[0] + a[1] * V[1] + a[2] * V[2] >= 0;
  const solid = (pts3, face3, style) => {
    const outline = K.pathOf(hull(scr(pts3)), true);
    const face = face3 ? K.pathOf(scr(face3), true) : "";
    return K.solidSvg({ fill: outline, outline, crease: face, top: face, shades: ["", outline, "", ""] }, style);
  };
  const R = 13;
  const cone = solid([pivot, ...ring(12, R - 1)], null, { tone: "mid", crease: "none" });
  const disc = solid([...ring(12, R, 56), ...ring(16, R, 56)], up ? ring(16, R, 56) : ring(12, R, 56), { tone: "hi", lit: true, crease: "lo" });
  let marks = "";
  if (up) {
    const lines = [];
    for (let i = 0; i < 6; i++) { const g = spin + (i * Math.PI) / 3; lines.push(K.pathOf(scr([pt(16, 4.5, g), pt(16, 10.5, g)]))); }
    marks = `<path class="iso-line" data-tone="lo" data-free="" d="${lines.join("")}"/>`;
  }
  const stem = solid([...ring(16, 1.6, 20), ...ring(26, 1.6, 20)], up ? ring(26, 1.6, 20) : null, { tone: "hi", crease: "lo" });
  const cap = solid([...ring(26, 2.8, 28), ...ring(28.5, 2.8, 28)], up ? ring(28.5, 2.8, 28) : ring(26, 2.8, 28), { tone: "hi", crease: "lo" });
  return up ? cone + disc + marks + stem + cap : cap + stem + disc + cone;
}
// the cone swept by the tip of the stem
function sweepOf(K, P, pivot, alpha) {
  if (alpha < 0.05) return "";
  const pts = [];
  for (let i = 0; i < 72; i++) {
    const g = (2 * Math.PI * i) / 72;
    pts.push(K.iso([pivot[0] + 28.5 * Math.sin(alpha) * Math.cos(g), pivot[1] + 28.5 * Math.sin(alpha) * Math.sin(g), pivot[2] + 28.5 * Math.cos(alpha)], P));
  }
  return K.pathOf(pts, true);
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

// ── C-frame magnet: column, arm and two pole pieces ────────────────────────
function frameBack() {
  const out = [`<path class="iso-halo" d="${k.haloOf(COLUMN, 0, 0.1, P)}" style="filter:blur(4px)"/>`];
  out.push(S(k.slabOf(COLUMN, 0, FRAME_TOP, P, 3, 0.8), { tone: "mid", inner: L([30, 60].map((z) => k.sideSeam(COLUMN, z, P, 3)).join(""), { tone: "faint" }) }));
  // field direction engraved on the column's front face
  const fy = COLUMN.y + COLUMN.d;
  const cx = COLUMN.x + COLUMN.w / 2;
  out.push(k.faceTextSvg(k.sideMatrix([cx, fy], 40, P, "left"), "B0 ↑", { size: 6, tone: "mid", anchor: "middle" }));
  return out.join("");
}

function lowerPole() {
  const [x, y] = M;
  const out = [`<path class="iso-halo" d="${k.haloOf({ x: x - POLE_R, y: y - POLE_R, w: POLE_R * 2, d: POLE_R * 2, r: POLE_R }, 0, 0.1, P)}" style="filter:blur(4px)"/>`];
  out.push(S(k.cylinder(x, y, POLE_R, 0, LOW_H, P, 96, 0.8), { tone: "mid", inner: L(k.sideArc(x, y, POLE_R, 5, P, 64), { tone: "faint" }) }));
  out.push(S(k.cylinder(x, y, POLE_R - 4, LOW_H, 1, P, 96), { tone: "hi", crease: "lo" }));
  out.push(L(k.ring(x, y, POLE_R - 8, LOW_H + 1, P, 96), { tone: "faint" }));
  out.push(D(byDepth([0, 1, 2, 3, 4, 5].map((i) => [x + (POLE_R - 2) * Math.cos((i * Math.PI) / 3), y + (POLE_R - 2) * Math.sin((i * Math.PI) / 3)])).map(([px, py]) => at([px, py, LOW_H])), { size: 0.45 }));
  out.push(k.faceTextSvg(k.topMatrix([x + 18, y + 18], LOW_H + 1, P, "x"), "N", { size: 6, tone: "mid", anchor: "middle" }));
  // pedestal and cup holding the top's point
  out.push(S(k.cylinder(x, y, 2.6, LOW_H + 1, PIVOT[2] - 4 - LOW_H - 1, P, 20), { tone: "mid", crease: "none", inner: L(k.sideArc(x, y, 2.6, 22, P, 12), { tone: "faint" }) }));
  out.push(S(k.cylinder(x, y, 4.5, PIVOT[2] - 4, 4, P, 28, 0.4), { tone: "mid" }));
  out.push(L(k.ring(x, y, 2.4, PIVOT[2], P, 20), { tone: "lo" }));
  return out.join("");
}

function upperPole() {
  const [x, y] = M;
  const out = [S(k.cylinder(x, y, POLE_R - 4, UP_Z - 1, 1, P, 96), { tone: "hi", crease: "none" })];
  out.push(S(k.cylinder(x, y, POLE_R, UP_Z, UP_H, P, 96, 0.8), { tone: "mid", inner: L(k.sideArc(x, y, POLE_R, UP_Z + 5, P, 64), { tone: "faint" }) }));
  out.push(S(k.slabOf(ARM, UP_Z + UP_H, FRAME_TOP - UP_Z - UP_H, P, 3, 0.8), { tone: "mid" }));
  out.push(D([ARM.x + 6, ARM.x + ARM.w - 6].map((px) => at([px, ARM.y + ARM.d - 6, FRAME_TOP])), { size: 0.5 }));
  return out.join("");
}

// ── RF coil ────────────────────────────────────────────────────────────────
function rfCoil() {
  const out = [S(k.slabOf(COIL_FOOT, 0, 4, P, 3, 0.5), { tone: "lo" })];
  out.push(S(k.slabOf(COIL, 4, COIL_Z[1] - 4, P, 2, 0.4), { tone: "mid" }));
  const fxp = COIL.x + COIL.w;
  const loops = [];
  for (let i = 0; i < 5; i++) {
    const y0 = COIL.y + 3 + i * 2.6, y1 = COIL.y + COIL.d - 3 - i * 2.6, z0 = COIL_Z[0] + 3 + i * 2.6, z1 = COIL_Z[1] - 3 - i * 2.6;
    loops.push(on([[fxp, y0, z0], [fxp, y1, z0], [fxp, y1, z1], [fxp, y0, z1]], true));
  }
  out.push(L(loops.join(""), { tone: "lo" }));
  out.push(`<g data-part="coil-glow" opacity="0">${L(loops.join(""), { tone: "lit" })}</g>`);
  out.push(S(k.cylinder(-84, -10, 2.2, 4, 3, P, 16), { tone: "mid" }));
  return out.join("");
}

function cable() {
  return k.wireSvg(at([-124, 40, GEN_H + 3]), at([-84, -10, 7]), { via: [at([-124, 30, 0.2]), at([-84, 30, 0.2])], tone: "lo" });
}

// ── RF generator: tuning dial, knob, transmit button and lamp ──────────────
function generator() {
  const out = [S(k.slabOf(GEN, 0, GEN_H, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(GEN, 5, P, 4), { tone: "faint" }) })];
  out.push(S(k.slabOf(WINDOW, GEN_H - 0.6, 0.6, P, 3), { tone: "lo", crease: "none", flat: true }));
  out.push(L(k.planOutline(WINDOW, GEN_H, P, 3), { tone: "lo" }));
  const minor = [];
  const major = [];
  for (let f = 0; f <= TUNER_RANGE[1]; f += 10) (f % 50 === 0 ? major : minor).push(k.lineOnTop([fx(f), WINDOW.y], [fx(f), WINDOW.y + (f % 50 === 0 ? 4 : 2.4)], GEN_H, P));
  out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }));
  // marks for the Larmor frequency at 1.5, 3 and 7 T on the window's front edge
  out.push(D(B0_OPTIONS.map((b) => at([fx(larmorOf(b)), WINDOW.y + WINDOW.d - 1.6, GEN_H])), { size: 0.9, tone: "hi" }));
  out.push(`<path data-part="tuner" class="iso-line" data-tone="hi" d="${k.lineOnTop([fx(TUNE_START), WINDOW.y], [fx(TUNE_START), WINDOW.y + WINDOW.d], GEN_H + 0.1, P)}" style="stroke-width:1"/>`);
  out.push(k.faceTextSvg(k.topMatrix([WINDOW.x + WINDOW.w + 6, WINDOW.y + 8], GEN_H, P, "x"), "MHz", { size: 4, tone: "mid" }));
  const [kx, ky] = TUNE_KNOB;
  out.push(S(k.cylinder(kx, ky, 9, GEN_H, 1.2, P, 40), { tone: "lo" }));
  out.push(S(k.cylinder(kx, ky, 7.5, GEN_H + 1.2, 6, P, 48, 0.5), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(kx, ky, 7.5, GEN_H + 1.2, GEN_H + 7.2, 52, P), { tone: "lo" }));
  out.push(`<path data-part="tune-pointer" class="iso-line" data-tone="hi" data-free="" d="${pointerOf(k, P, TUNE_KNOB, 0, 6, GEN_H + 7.2)}"/>`);
  const [bx, by] = FIRE;
  out.push(S(k.cylinder(bx, by, 6.5, GEN_H, 1.2, P, 32), { tone: "lo" }));
  out.push(`<g data-part="fire">${S(k.cylinder(bx, by, 4.6, GEN_H + 1.2, 3.4, P, 32, 0.4), { tone: "hi", crease: "lo" })}</g>`);
  const [lx, ly] = LAMP;
  out.push(S(k.cylinder(lx, ly, 3.6, GEN_H, 1.6, P, 24), { tone: "lo" }));
  out.push(`<g data-part="lamp" opacity="0">${S(k.cylinder(lx, ly, 3.6, GEN_H, 1.6, P, 24), { tone: "hi", lit: true })}</g>`);
  out.push(k.faceTextSvg(k.sideMatrix([GEN.x + 8, GEN.y + GEN.d], 4, P, "left"), "RF", { size: 5, tone: "mid" }));
  out.push(S(k.cylinder(-124, 40, 2, GEN_H, 3, P, 16), { tone: "mid" }));
  out.push(D(byDepth(k.corners(GEN, 3)).map(([x, y]) => at([x, y, GEN_H])), { size: 0.45 }));
  return out.join("");
}

// ── B0 selector ────────────────────────────────────────────────────────────
function selector() {
  const [cx, cy] = SEL_C;
  const out = [S(k.slabOf(SEL, 0, SEL_H, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(SEL, 3, P, 4), { tone: "faint" }) })];
  out.push(L(k.ring(cx, cy, 10, SEL_H, P, 56), { tone: "faint" }));
  out.push(L(DETENTS.map((deg) => { const d = dirOf(deg); return k.lineOnTop([cx + d[0] * 10, cy + d[1] * 10], [cx + d[0] * 7.6, cy + d[1] * 7.6], SEL_H, P); }).join(""), { tone: "hi" }));
  out.push(S(k.cylinder(cx, cy, 6, SEL_H, 5, P, 40, 0.4), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(cx, cy, 6, SEL_H, SEL_H + 5, 40, P), { tone: "lo" }));
  out.push(`<path data-part="b0-pointer" class="iso-line" data-tone="hi" data-free="" d="${pointerOf(k, P, SEL_C, DETENTS[B0_OPTIONS.indexOf(B0_START)], 5, SEL_H + 5)}"/>`);
  out.push(k.faceTextSvg(k.sideMatrix([SEL.x + 4, SEL.y + SEL.d], 3, P, "left"), "B0", { size: 4.4, tone: "mid" }));
  return out.join("");
}

// ── MRS spectrum analyzer ──────────────────────────────────────────────────
function analyzer() {
  const sy = ANA_FACE + 0.6; // the plane the screen's lines sit in
  const text = (part, x, z, value, anchor, tone = "lo", size = 4) =>
    `<text class="iso-face-text"${part ? ` data-part="${part}"` : ""} data-tone="${tone}" transform="${k.sideMatrix([x, ANA_FACE], z, P, "left")}" font-size="${size}" text-anchor="${anchor}">${value}</text>`;
  const out = [`<path class="iso-halo" d="${k.haloOf(ANA, 0, 0.1, P)}" style="filter:blur(4px)"/>`];
  out.push(S(k.slabOf(ANA, 0, ANA_H, P, 3, 0.8), { tone: "mid", inner: L(k.sideSeam(ANA, ANA_H - 3, P, 3), { tone: "faint" }) }));
  // screen with a grid every 0.5 ppm and a baseline
  out.push(S(k.slabOf({ x: SCREEN.x0, y: ANA_FACE, w: SCREEN.x1 - SCREEN.x0, d: 0.5, r: 0 }, SCREEN.z0, SCREEN.z1 - SCREEN.z0, P, 1), { tone: "lo", crease: "none" }));
  const grid = [];
  for (let ppm = 4; ppm >= 2; ppm -= 0.5) grid.push(on([[px(ppm), sy, SCREEN.z0], [px(ppm), sy, SCREEN.z1]]));
  out.push(L(grid.join(""), { tone: "faint" }));
  out.push(L(on([[SCREEN.x0, sy, SPEC_BASE], [SCREEN.x1, sy, SPEC_BASE]]), { tone: "lo" }));
  out.push(`<path data-part="mrs-cursor" class="iso-line" data-tone="mid" d="${on([[px(CURSOR_START), sy, SCREEN.z0], [px(CURSOR_START), sy, SCREEN.z1]])}"/>`);
  out.push(`<path data-part="mrs-trace" class="iso-line" data-tone="hi" data-free="" d="" style="stroke-width:0.9"/>`);
  // peak names above the screen, ppm numbers below it
  out.push(text("mrs-label-NAA", px(2.01), SCREEN.z1 + 2.2, "NAA", "middle"));
  out.push(text("mrs-label-Cho", px(3.2) - 0.6, SCREEN.z1 + 2.2, "Cho", "end"));
  out.push(text("mrs-label-Cr", px(3.03) + 0.6, SCREEN.z1 + 2.2, "Cr", "start"));
  for (const ppm of [4, 3, 2]) out.push(text("", px(ppm), 8.6, String(ppm), "middle", "mid"));
  // display: how many hertz one ppm is at this field
  const lcd = { x0: 104, x1: 140, z0: 1.6, z1: 7 };
  out.push(L(on([[lcd.x0, ANA_FACE, lcd.z0], [lcd.x1, ANA_FACE, lcd.z0], [lcd.x1, ANA_FACE, lcd.z1], [lcd.x0, ANA_FACE, lcd.z1]], true), { tone: "lo" }));
  out.push(text("mrs-lcd", (lcd.x0 + lcd.x1) / 2, lcd.z0 + 1.4, "1 ppm = 128 Hz", "middle", "hi", 3.4));
  // name on the top, fine-tuning knob, corner screws
  out.push(k.faceTextSvg(k.topMatrix([100, ANA.y + 9], ANA_H, P, "x"), "MRS", { size: 5, tone: "mid", anchor: "middle" }));
  const [kx, ky] = FINE_KNOB;
  out.push(S(k.cylinder(kx, ky, 5.6, ANA_H, 1, P, 32), { tone: "lo" }));
  out.push(S(k.cylinder(kx, ky, 4.4, ANA_H + 1, 4.5, P, 36, 0.4), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(kx, ky, 4.4, ANA_H + 1, ANA_H + 5.5, 36, P), { tone: "lo" }));
  out.push(`<path data-part="fine-pointer" class="iso-line" data-tone="hi" data-free="" d="${pointerOf(k, P, FINE_KNOB, -135 + (270 * (PPM_RANGE[0] - CURSOR_START)) / (PPM_RANGE[0] - PPM_RANGE[1]), 3.8, ANA_H + 5.5)}"/>`);
  out.push(D([[ANA.x + 3, 3], [ANA.x + ANA.w - 3, 3], [ANA.x + 3, ANA_H - 6], [ANA.x + ANA.w - 3, ANA_H - 6]].map(([x, z]) => at([x, ANA_FACE, z])), { size: 0.45 }));
  return out.join("");
}

// ── assemble ────────────────────────────────────────────────────────────────
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A vertical C-frame magnet with a lower and an upper pole; between them a spinning top stands on a pivot, its axis the net magnetization. Beside it an RF coil stands on a foot, cabled to a radio-style generator with a frequency dial from 0 to 320 megahertz, a tuning knob, a transmit button and a lamp. A three-position selector sets B0 to 1.5, 3 or 7 tesla. When the dial matches the Larmor frequency and RF is sent, the top tips over and precesses; otherwise nothing happens. A lightbox shows the brain image the tipped magnetization would give, and a spectrum analyzer at the front shows the few-ppm differences in frequency between hydrogen in NAA, creatine and choline, with a fine-tuning knob that moves a cursor across them.",
  body: [
    plate(),
    frameBack(),
    lightboxSvg(k, P, LBOX),
    rfCoil(),
    cable(),
    lowerPole(),
    `<path data-part="sweep" class="iso-line" data-tone="lo" data-dotted="" d=""/>`,
    `<g data-part="top">${topSvg(k, P, PIVOT, 0, 0, 0)}</g>`,
    upperPole(),
    selector(),
    generator(),
    analyzer(),
  ],
});

const modelSource = readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "");

const live = `
${modelSource}
const topSvg = ${topSvg.toString()};
const sweepOf = ${sweepOf.toString()};
const pointerOf = ${pointerOf.toString()};
const P = ${JSON.stringify(P)};
const K = { solidSvg, depthOf, iso, pathOf, lineOnTop };
const PIVOT = ${JSON.stringify(PIVOT)};
const FX0 = ${FX0}, FX1 = ${FX1}, WIN_Y = ${WINDOW.y}, WIN_D = ${WINDOW.d}, GEN_H = ${GEN_H};
const TUNE_KNOB = ${JSON.stringify(TUNE_KNOB)}, SEL_C = ${JSON.stringify(SEL_C)}, SEL_Z = ${SEL_H + 5}, DETENTS = ${JSON.stringify(DETENTS)};
const fx = (f) => FX0 + ((f - TUNER_RANGE[0]) / (TUNER_RANGE[1] - TUNER_RANGE[0])) * (FX1 - FX0);
const SCREEN = ${JSON.stringify(SCREEN)}, SPEC_BASE = ${SPEC_BASE}, SPEC_AMP = ${SPEC_AMP}, SCREEN_Y = ${ANA_FACE + 0.6};
const FINE_KNOB = ${JSON.stringify(FINE_KNOB)}, FINE_Z = ${ANA_H + 5.5};
const px = (ppm) => SCREEN.x0 + ((PPM_RANGE[0] - ppm) / (PPM_RANGE[0] - PPM_RANGE[1])) * (SCREEN.x1 - SCREEN.x0);
${FILM_JS}
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const paintFilm = makeFilm(svg, ${JSON.stringify(SLICE)}, TISSUES.map((t) => t.key));
const q = (name) => svg.querySelector('[data-part="' + name + '"]');
const top = q("top"), sweep = q("sweep"), tuner = q("tuner"), tunePointer = q("tune-pointer"), b0Pointer = q("b0-pointer");
const fire = q("fire"), lamp = q("lamp"), coilGlow = q("coil-glow");
const mrsTrace = q("mrs-trace"), mrsCursor = q("mrs-cursor"), mrsLcd = q("mrs-lcd"), finePointer = q("fine-pointer");
const mrsLabels = ["NAA", "Cr", "Cho"].map((name) => ({ name, el: q("mrs-label-" + name), ppm: METABOLITES.find((m) => m.name === name).ppm }));
const spectrumPeak = {};
const peakOf = (b) => (spectrumPeak[b] ||= Math.max(...Array.from({ length: 241 }, (_, i) => spectrumAt(PPM_RANGE[0] - i * 0.01, b))));
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const PULSE = 0.9, HOLD = 3.6, RELAX = 0.9; // seconds as drawn
let B0 = ${B0_START}, b0Shown = B0, tune = ${TUNE_START}, tuneShown = tune;
let alpha = 0, phi = 0, spin = 0, phase = "idle", since = 0, pulseDelta = 0, alphaStart = 0;
let clock = 0, frame = 0, last = 0, visible = false, touring = !still.matches, idleTimer = 0, tourAt = 0, pressed = -1e9;
let cursor = ${CURSOR_START}, cursorShown = cursor;

const TOUR = [
  { at: 0.0, B0: 3, tune: 80 }, { at: 1.4, fire: true },
  { at: 4.2, tune: larmorOf(3) }, { at: 5.6, fire: true }, { at: 8.0, B0: 7 },
  { at: 12.0, tune: larmorOf(7) }, { at: 13.4, fire: true },
  { at: 18.6, B0: 1.5, tune: larmorOf(1.5) }, { at: 20.0, fire: true },
  { at: 26.0, loop: true },
];

function transmit() {
  if (phase !== "idle") return;
  phase = "pulse"; since = 0; pulseDelta = larmorOf(B0) - tune; pressed = clock;
}

function draw() {
  top.innerHTML = topSvg(K, P, PIVOT, alpha, phi, spin);
  sweep.setAttribute("d", sweepOf(K, P, PIVOT, alpha));
  tuner.setAttribute("d", lineOnTop([fx(tuneShown), WIN_Y], [fx(tuneShown), WIN_Y + WIN_D], GEN_H + 0.1, P));
  tunePointer.setAttribute("d", pointerOf(K, P, TUNE_KNOB, (tuneShown / TUNER_RANGE[1]) * 300 - 150, 6, GEN_H + 7.2));
  const detent = b0Shown <= 3 ? DETENTS[0] + ((b0Shown - 1.5) / 1.5) * (DETENTS[1] - DETENTS[0]) : DETENTS[1] + ((b0Shown - 3) / 4) * (DETENTS[2] - DETENTS[1]);
  b0Pointer.setAttribute("d", pointerOf(K, P, SEL_C, detent, 5, SEL_Z));
  const rf = phase === "pulse" ? 1 : 0;
  lamp.setAttribute("opacity", String(rf));
  coilGlow.setAttribute("opacity", String(rf));
  fire.setAttribute("transform", translateAlong(P, [0, 0, -1.8 * Math.exp(-Math.max(0, clock - pressed) / 0.25)]));
  paintFilm(TISSUES.map((t) => t.PD * Math.sin(alpha)));
  // spectrum: only tipped magnetization gives a signal to analyse
  const gain = (SPEC_AMP * Math.sin(alpha)) / peakOf(B0);
  const pts = [];
  for (let i = 0; i <= 240; i++) { const ppm = PPM_RANGE[0] - i * 0.01; pts.push(iso([px(ppm), SCREEN_Y, SPEC_BASE + gain * spectrumAt(ppm, B0)], P)); }
  mrsTrace.setAttribute("d", pathOf(pts));
  mrsCursor.setAttribute("d", pathOf([iso([px(cursorShown), SCREEN_Y, SCREEN.z0], P), iso([px(cursorShown), SCREEN_Y, SCREEN.z1], P)]));
  finePointer.setAttribute("d", pointerOf(K, P, FINE_KNOB, -135 + (270 * (PPM_RANGE[0] - cursorShown)) / (PPM_RANGE[0] - PPM_RANGE[1]), 3.8, FINE_Z));
  for (const label of mrsLabels) label.el.setAttribute("data-tone", Math.abs(cursorShown - label.ppm) < 0.07 ? "hi" : "lo");
  const lcd = "1 ppm = " + Math.round(hzPerPpm(B0)) + " Hz";
  if (mrsLcd.textContent !== lcd) mrsLcd.textContent = lcd;
  const f0 = larmorOf(B0);
  const off = tune - f0;
  const match = Math.abs(off) < 0.5 ? "on resonance" : "off by " + Math.abs(off).toFixed(0) + " MHz";
  const text = "B0 " + B0 + " T · f0 " + f0.toFixed(1) + " MHz · RF " + tune.toFixed(1) + " MHz · " + match + " · tip " + Math.round((alpha * 180) / Math.PI) + "°";
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuetext", text);
}

function tick(stamp) {
  const dt = last ? Math.min((stamp - last) / 1000, 1 / 30) : 1 / 60;
  last = stamp;
  clock += dt;
  if (touring) {
    const t = clock - tourAt;
    for (const step of TOUR) {
      if (step.done || t < step.at) continue;
      step.done = true;
      if (step.loop) { TOUR.forEach((s) => (s.done = false)); tourAt = clock; break; }
      if (step.B0) B0 = step.B0;
      if (step.tune !== undefined) tune = step.tune;
      if (step.fire) transmit();
    }
  }
  const ease = 1 - Math.exp(-dt / 0.35);
  if (touring) cursor = 2.9 + 1.0 * Math.sin(clock * 0.55);
  cursorShown += (cursor - cursorShown) * ease;
  tuneShown += (tune - tuneShown) * ease;
  b0Shown += (B0 - b0Shown) * ease;
  since += dt;
  if (phase === "pulse") {
    alpha = tipOf(pulseDelta, Math.min(1, since / PULSE));
    if (since >= PULSE) { since = 0; phase = alpha < 0.1 ? "relax" : "hold"; alphaStart = alpha; }
  } else if (phase === "hold") {
    if (since >= HOLD) { phase = "relax"; since = 0; alphaStart = alpha; }
  } else if (phase === "relax") {
    alpha = alphaStart * Math.exp(-since / (RELAX / 3));
    if (since >= RELAX * 1.6) { phase = "idle"; alpha = 0; }
  }
  phi += 2 * Math.PI * shownTurnsPerSecond(b0Shown) * dt;
  spin += 2 * Math.PI * 2.2 * dt;
  draw();
  frame = visible ? requestAnimationFrame(tick) : 0;
}

const go = () => { if (!frame && visible && !still.matches) { last = 0; frame = requestAnimationFrame(tick); } };
function user() {
  touring = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { touring = !still.matches; tourAt = clock; TOUR.forEach((s) => (s.done = false)); }, 9000);
}
function setTune(f) { user(); tune = clamp(f, TUNER_RANGE[0], TUNER_RANGE[1]); if (still.matches) { tuneShown = tune; draw(); } go(); }
function setB0(b) { user(); B0 = b; if (still.matches) { b0Shown = B0; draw(); } go(); }
function setCursor(ppm) { cursor = clamp(ppm, PPM_RANGE[1], PPM_RANGE[0]); if (still.matches) { cursorShown = cursor; draw(); } go(); }
function fireNow() {
  user();
  if (still.matches) { alpha = tipOf(larmorOf(B0) - tune); draw(); return; }
  transmit(); go();
}
new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) go(); }, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("pointermove", (event) => {
  const box = svg.getBoundingClientRect();
  setTune(clamp(((event.clientX - box.left) / box.width - 0.12) / 0.76, 0, 1) * TUNER_RANGE[1]);
  setCursor(PPM_RANGE[0] - clamp(((event.clientY - box.top) / box.height - 0.15) / 0.7, 0, 1) * (PPM_RANGE[0] - PPM_RANGE[1]));
});
stage.addEventListener("click", fireNow);
stage.addEventListener("keydown", (event) => {
  const step = event.shiftKey ? 10 : 1;
  if (event.key === "ArrowRight") setTune(tune + step);
  else if (event.key === "ArrowLeft") setTune(tune - step);
  else if (event.key === "t" || event.key === "T") setTune(larmorOf(B0));
  else if (event.key === "ArrowUp") { user(); setCursor(cursor + 0.05); }
  else if (event.key === "ArrowDown") { user(); setCursor(cursor - 0.05); }
  else if (event.key === "Enter" || event.key === " ") fireNow();
  else if (/^[1-3]$/.test(event.key)) setB0(B0_OPTIONS[Number(event.key) - 1]);
  else return;
  event.preventDefault();
});
if (still.matches) { tune = tuneShown = larmorOf(B0); alpha = tipOf(0); phi = 0.6; }
draw();
`;

const body = k.plateHtml({
  fig: "Fig 2",
  title: "Larmor top and RF tuner",
  hint: "Hover · click",
  readout: `B0 ${B0_START} T · f0 ${larmorOf(B0_START).toFixed(1)} MHz · RF ${TUNE_START.toFixed(1)} MHz · off by ${Math.abs(TUNE_START - larmorOf(B0_START)).toFixed(0)} MHz · tip 0°`,
  keys: [
    { mark: "lit", label: "Top: the net magnetization; once tipped it precesses about B0" },
    { mark: "raised", label: "Dial: RF frequency, with dots at the Larmor frequency for 1.5, 3 and 7 T" },
    { mark: "edge", label: `Lightbox: the signal the tipped magnetization gives, MNI152 slice z = +${SLICE.z} mm` },
    { mark: "flat", label: "Analyzer: the brain's spectrum in ppm (water suppressed), with a fine-tuning cursor; the display shows how many hertz one ppm is at this field" },
  ],
  caption: `A magnetic moment in a field precesses like a tilted spinning top, at the Larmor frequency f0 = γ̄·B0, with γ̄ = ${GAMMA_BAR} MHz per tesla for hydrogen: ${larmorOf(1.5).toFixed(1)} MHz at 1.5 T, ${larmorOf(3).toFixed(1)} MHz at 3 T and ${larmorOf(7).toFixed(1)} MHz at 7 T. The top is drawn slowed about ${(slowdownOf(3) / 1e6).toFixed(0)} million times. At rest the net magnetization points straight along B0 and nothing precesses. An RF pulse is a small magnetic field turning at the radio frequency; only when that frequency matches f0 does it keep pushing the top the same way, tipping it over (resonance). Off resonance the pushes cancel and the top barely moves. The tip follows the Bloch equations for a rectangular pulse that gives 90° on resonance. Real pulses are resonant within about a kilohertz (an RF strength of a few hundred hertz, about ${REAL_F1_HZ} Hz for a 1 ms 90° pulse); the dial draws the resonance about ${F1} MHz wide so it can be found by hand. The scanner can only detect magnetization that has been tipped into the transverse plane, so the film's brightness follows sin(tip): no resonance, no image. The return to upright is relaxation, the subject of Fig 3. The spectrum analyzer zooms in a few parts per million (ppm) around f0. Hydrogen in different molecules is shielded slightly differently by its electrons, so it resonates slightly off: in brain spectra NAA sits at 2.01 ppm, creatine at 3.03 ppm and choline at 3.20 ppm, while water at 4.7 ppm is thousands of times stronger and is suppressed before the measurement. The positions are fixed in ppm, but in hertz they grow with the field: 1 ppm is ${Math.round(larmorOf(1.5))} Hz at 1.5 T, ${Math.round(larmorOf(3))} Hz at 3 T and ${Math.round(larmorOf(7))} Hz at 7 T. Lines broaden too (drawn about ${B0_OPTIONS.map((b) => Math.round(linewidthHz(b))).join(", ")} Hz wide), but more slowly, so creatine and choline separate better at higher field. Like the image, the spectrum appears only when the magnetization has been tipped. Peak heights are illustrative. ${MNI_NOTICE}`,
  body: `<div class="iso-stage" tabindex="0" role="application" aria-roledescription="Larmor top" aria-label="Larmor top: left and right arrows tune the RF by 1 MHz (shift for 10), T tunes to the Larmor frequency, Enter transmits, keys 1 to 3 set B0 to 1.5, 3 and 7 tesla, up and down move the spectrum cursor">${svg}</div>`,
});

writeFileSync(join(HERE, OUT), k.pageHtml({ title: "Larmor top and RF tuner", theme, body, script: kitScript() + live }));
console.log("wrote", OUT);
