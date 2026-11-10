// Fig 5 — Spin-echo track: echo train, shim and pulse-sequence recorder.
// node build.mjs            → spin-echo-track.html (dark)
// node build.mjs --light    → spin-echo-track-light.html
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../_anatomy/kit/iso-kit.mjs";
import { kitScript } from "../_anatomy/scripts/inline-kit.mjs";
import { OFFSETS, T2, T2_PRIME_BASE, SHIM_RANGE, T_SPAN, TISSUES, t2StarOf, signalOf } from "./model.mjs";
import { loadSlice, lightboxGeometry, lightboxSvg, FILM_JS, MNI_NOTICE } from "../_shared/lightbox.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const OUT = theme === "light" ? "spin-echo-track-light.html" : "spin-echo-track.html";

const WIDTH = 600;
const HEIGHT = 400;

// ── world layout ────────────────────────────────────────────────────────────
const PLATE = { x: -150, y: -110, w: 300, d: 198, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

const TC = [-52, -14]; // track centre
const TRACK_R = 64;
const TOP = 7; // track surface
const LANES = OFFSETS.map((_, i) => 28 + i * 4);
const START = (-35 * Math.PI) / 180; // start line direction, side-on to the camera
const LAMP = [TC[0] + 74 * Math.cos(START), TC[1] + 74 * Math.sin(START)];
const LAMP_Z = 34;

// lightbox behind the track: one film per echo
const SLICE = loadSlice();
const LBOX = lightboxGeometry({ x: -128, y: -100, w: 104, d: 12, r: 2 }, SLICE, { grid: [2, 2], labels: ["echo 1", "echo 2", "echo 3", "echo 4"] });

// shim box at the front, between the TE fader and the console
const SHIM = { x: 23, y: 50, w: 16, d: 22, r: 3 };
const SHIM_H = 9;
const SHIM_C = [SHIM.x + SHIM.w / 2, SHIM.y + SHIM.d / 2];

// sequence recorder
const CHART = { x: 28, y: -64, w: 116, d: 30, r: 3 };
const CHART_H = 6;
const BOARD = { x: 30, y: -62, w: 112, d: 6, r: 1 };
const BOARD_TOP = 98;
const FACE_Y = BOARD.y + BOARD.d;
const PAPER = { x: 32, w: 108, z0: 11, z1: 91 };
const PAPER_Y = FACE_Y + 0.4;
const X0 = 44;
const X1 = 136;
const KX = (X1 - X0) / T_SPAN;
const ROWS = {
  sig: { base: 15, amp: 30, label: "echo" },
  gx: { base: 53, amp: 4, label: "Gx" },
  gy: { base: 61, amp: 4, label: "Gy" },
  gz: { base: 69, amp: 4, label: "Gz" },
  rf: { base: 79, amp: 8, label: "RF" },
};
const PEN_DX = 6.5; // pens sit beside the bar
const RULER = { x: 34, y: -44, w: 104, d: 6, r: 0.8 };

const CONSOLE = { x: 40, y: 30, w: 100, d: 44, r: 3 };
const CONSOLE_H = 8;
const BUTTONS = [
  { key: "p90", label: "90°", at: [58, 50] },
  { key: "p180", label: "180°", at: [88, 50] },
];
const SELECTOR = [120, 50];
const DETENTS = [-60, -20, 20, 60]; // degrees, N = 1..4
const SWITCH_X = 104; // spin echo / gradient echo slide switch
const SWITCH_Y = { SE: 45, GRE: 55 };

const FADER = { y: 70, rail0: -110, travel: 120 }; // 1 unit per ms
const PANEL_Z = 4;
const TE0 = 80;
const N0 = 1;
const SHIM0 = 1;

const P = k.fitProjection(
  [
    ...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0),
    [LAMP[0], LAMP[1], LAMP_Z + 8],
    [CHART.x, CHART.y, BOARD_TOP],
    [CHART.x + CHART.w, CHART.y, BOARD_TOP],
    [LBOX.LB.x, LBOX.LB.y, LBOX.top],
    [LBOX.LB.x + LBOX.LB.w, LBOX.LB.y, LBOX.top],
  ],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: 55 },
);

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (pts) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const polar = (r, a) => [TC[0] + r * Math.cos(a), TC[1] + r * Math.sin(a)];
const on = (pts) => k.pathOf(pts.map((p) => at(p)));

// dial direction on a top face: 0° points to the back (−y), positive turns toward +x
const dirOf = (deg) => [Math.sin((deg * Math.PI) / 180), -Math.cos((deg * Math.PI) / 180)];
const shimAngle = (s) => -135 + (270 * (s - SHIM_RANGE[0])) / (SHIM_RANGE[1] - SHIM_RANGE[0]);

// Shared by build (first paint) and page (every frame).
function carsAt(K, P, phases, lanes, centre, top, start) {
  return phases.map((phi, i) => {
    const a = start + phi;
    const r = lanes[i];
    const c = [centre[0] + r * Math.cos(a), centre[1] + r * Math.sin(a)];
    const t = [-Math.sin(a), Math.cos(a)];
    const n = [Math.cos(a), Math.sin(a)];
    const box = (shift, half, side) => [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([u, v]) => [c[0] + t[0] * (shift + u * half) + n[0] * v * side, c[1] + t[1] * (shift + u * half) + n[1] * v * side]);
    const svg =
      K.solidSvg(K.extrude(box(0, 3.6, 1.8), top, 2.6, P, { bevel: 0.3 }), { tone: "hi", lit: true, crease: "lo" }) +
      K.solidSvg(K.extrude(box(-0.9, 1.5, 1.2), top + 2.6, 1.3, P), { tone: "hi", lit: true, crease: "lo" });
    return { depth: K.depthOf([c[0], c[1], top], P), svg };
  });
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

// ── shim box: the knob sets how uneven the field is ────────────────────────
function shimBox() {
  const [cx, cy] = SHIM_C;
  const out = [S(k.slabOf(SHIM, 0, SHIM_H, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(SHIM, 3, P, 4), { tone: "faint" }) })];
  out.push(L(k.ring(cx, cy, 7, SHIM_H, P, 56), { tone: "faint" }));
  const minor = [];
  const major = [];
  for (let i = 0; i <= 10; i++) {
    const d = dirOf(-135 + 27 * i);
    const big = i % 5 === 0;
    (big ? major : minor).push(k.lineOnTop([cx + d[0] * 7, cy + d[1] * 7], [cx + d[0] * (big ? 5.4 : 6), cy + d[1] * (big ? 5.4 : 6)], SHIM_H, P));
  }
  out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }));
  out.push(S(k.cylinder(cx, cy, 4.2, SHIM_H, 5, P, 40, 0.4), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(cx, cy, 4.2, SHIM_H, SHIM_H + 5, 40, P), { tone: "lo" }));
  out.push(`<path data-part="shim-pointer" class="iso-line" data-tone="hi" data-free="start" d="${pointerOf(k, P, SHIM_C, shimAngle(SHIM0), 3.6, SHIM_H + 5)}"/>`);
  out.push(k.faceTextSvg(k.sideMatrix([SHIM.x + 3.4, SHIM.y + SHIM.d], 2.6, P, "left"), "SHIM", { size: 3.6, tone: "mid" }));
  out.push(D([[SHIM.x + 2.4, SHIM.y + 2.4], [SHIM.x + SHIM.w - 2.4, SHIM.y + SHIM.d - 2.4]].map(([x, y]) => at([x, y, SHIM_H])), { size: 0.4 }));
  return out.join("");
}

// ── track ───────────────────────────────────────────────────────────────────
function track() {
  const [cx, cy] = TC;
  const out = [`<path class="iso-halo" d="${k.haloOf({ x: cx - TRACK_R, y: cy - TRACK_R, w: TRACK_R * 2, d: TRACK_R * 2, r: TRACK_R }, 0, 0.1, P)}" style="filter:blur(4px)"/>`];
  out.push(S(k.cylinder(cx, cy, TRACK_R + 2, 0, 2, P, 96), { tone: "lo" }));
  out.push(S(k.cylinder(cx, cy, TRACK_R, 2, TOP - 2, P, 96, 0.8), { tone: "mid", inner: L(k.sideArc(cx, cy, TRACK_R, 4.5, P, 64), { tone: "faint" }) }));
  out.push(L(LANES.map((r) => k.ring(cx, cy, r, TOP, P, 96)).join(""), { tone: "lo" }));
  out.push(L(k.ring(cx, cy, LANES[LANES.length - 1] + 3, TOP, P, 96) + k.ring(cx, cy, LANES[0] - 3, TOP, P, 72), { tone: "faint" }));
  const ticks = k.radialTicks(cx, cy, TRACK_R - 1.2, 72, 6, TOP, [1.2, 2.6], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(L(k.onTop([polar(LANES[0] - 3, START), polar(LANES[LANES.length - 1] + 3, START)], TOP, P), { tone: "hi" }));
  out.push(S(k.cylinder(cx, cy, 20, TOP, 1.4, P, 64, 0.5), { tone: "mid" }));
  out.push(L(k.ring(cx, cy, 15, TOP + 1.4, P, 56), { tone: "faint" }));
  out.push(D(byDepth([0, 1, 2, 3].map((i) => [cx + 17.5 * Math.cos(i * Math.PI / 2 + 0.4), cy + 17.5 * Math.sin(i * Math.PI / 2 + 0.4)])).map(([x, y]) => at([x, y, TOP + 1.4])), { size: 0.45 }));
  out.push(S(k.cylinder(cx, cy, 4, TOP + 1.4, 2, P, 28), { tone: "mid" }));
  out.push(D([at([cx, cy, TOP + 3.4])], { size: 0.6, tone: "hi" }));
  return out.join("");
}

function lamp() {
  const [x, y] = LAMP;
  return (
    S(k.cylinder(x, y, 5, 0, 2, P, 28), { tone: "lo" }) +
    S(k.cylinder(x, y, 1.8, 2, LAMP_Z - 2, P, 16), { tone: "mid", crease: "none", inner: L(k.sideArc(x, y, 1.8, 14, P, 12), { tone: "faint" }) }) +
    S(k.cylinder(x, y, 4.2, LAMP_Z, 5, P, 32, 0.4), { tone: "mid", inner: L(k.sideArc(x, y, 4.2, LAMP_Z + 2, P, 24), { tone: "faint" }) }) +
    S(k.cylinder(x, y, 3, LAMP_Z + 5, 1.6, P, 28), { tone: "lo" }) +
    `<g data-part="glow" opacity="0">${S(k.cylinder(x, y, 3, LAMP_Z + 5, 1.6, P, 28), { tone: "hi", lit: true })}</g>`
  );
}

// ── sequence recorder: five pens on one bridge ─────────────────────────────
function recorder() {
  const out = [S(k.slabOf(CHART, 0, CHART_H, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(CHART, 2.5, P, 4), { tone: "faint" }) })];
  out.push(S(k.slabOf(BOARD, CHART_H, BOARD_TOP - CHART_H, P, 3, 0.6), { tone: "mid" }));
  out.push(S(k.slabOf({ x: PAPER.x, y: FACE_Y, w: PAPER.w, d: 0.4, r: 0 }, PAPER.z0, PAPER.z1 - PAPER.z0, P, 1), { tone: "hi", crease: "none" }));
  const grid = [];
  for (let ms = 50; ms <= T_SPAN; ms += 50) grid.push(on([[X0 + ms * KX, PAPER_Y, PAPER.z0], [X0 + ms * KX, PAPER_Y, PAPER.z1]]));
  for (const s of [0.5, 1]) grid.push(on([[PAPER.x, PAPER_Y, ROWS.sig.base + s * ROWS.sig.amp], [PAPER.x + PAPER.w, PAPER_Y, ROWS.sig.base + s * ROWS.sig.amp]]));
  out.push(L(grid.join(""), { tone: "faint" }));
  const bases = Object.values(ROWS).map((r) => on([[PAPER.x, PAPER_Y, r.base], [PAPER.x + PAPER.w, PAPER_Y, r.base]])).join("");
  out.push(L(bases + on([[X0, PAPER_Y, PAPER.z0], [X0, PAPER_Y, PAPER.z1]]), { tone: "lo" }));
  for (const r of Object.values(ROWS)) out.push(k.faceTextSvg(k.sideMatrix([PAPER.x + 1.2, PAPER_Y], r.base + 1, P, "left"), r.label, { size: 3.2, tone: "lo" }));
  // T2 envelope e^(−t/T2), printed on the paper
  const env = [];
  for (let ms = 0; ms <= T_SPAN; ms += 4) env.push([X0 + ms * KX, PAPER_Y, ROWS.sig.base + Math.exp(-ms / T2) * ROWS.sig.amp]);
  out.push(L(on(env), { tone: "lo", dotted: true, free: true }));
  // T2* envelope e^(−t/T2*), redrawn when the shim changes
  out.push(`<path data-part="env-star" class="iso-line" data-tone="lo" data-dashed="" data-free="" d=""/>`);
  for (const key of ["rf", "gz", "gy", "gx"]) out.push(`<path data-part="trace-${key}" class="iso-line" data-tone="mid" data-free="" d=""/>`);
  out.push(`<path data-part="trace-sig" class="iso-line" data-tone="lit" data-free="" d="" style="stroke-width:1"/>`);
  for (const z of [CHART_H, BOARD_TOP - 7]) {
    const rail = { x: BOARD.x, y: FACE_Y, w: BOARD.w, d: 4, r: 0.8 };
    out.push(S(k.slabOf(rail, z, 3, P, 3, 0.3), { tone: "mid" }));
    out.push(D([rail.x + 3, rail.x + rail.w - 3].map((x) => at([x, FACE_Y + 4, z + 1.5])), { size: 0.4 }));
  }
  out.push(S(k.slabOf(RULER, CHART_H, 0.5, P, 3), { tone: "lo", crease: "none" }));
  const minor = [];
  const major = [];
  for (let ms = 0; ms <= T_SPAN; ms += 25) (ms % 100 === 0 ? major : minor).push(k.lineOnTop([X0 + ms * KX, RULER.y], [X0 + ms * KX, RULER.y + (ms % 100 === 0 ? 3.6 : 2)], CHART_H + 0.5, P));
  out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }));
  out.push(`<g data-part="events"></g>`);
  out.push(D(byDepth(k.corners(CHART, 2.6)).map(([x, y]) => at([x, y, CHART_H])), { size: 0.45 }));
  out.push(D([BOARD.x + 4, BOARD.x + BOARD.w - 4].map((x) => at([x, FACE_Y, BOARD_TOP - 2.5])), { size: 0.45 }));
  return out.join("");
}

function bridge() {
  const front = FACE_Y + 4;
  const blocks = [CHART_H - 0.5, BOARD_TOP - 7.5].map((z) => S(k.slabOf({ x: -4, y: front, w: 8, d: 3.5, r: 0.8 }, z, 4, P, 3, 0.4), { tone: "mid" })).join("");
  const bar = S(k.slabOf({ x: -2.2, y: front + 0.6, w: 4.4, d: 2.6, r: 0.8 }, CHART_H + 3.5, BOARD_TOP - 7.5 - CHART_H - 3.5, P, 3, 0.3), { tone: "mid", crease: "none" });
  const pen = (key, half, lit) =>
    `<g data-part="pen-${key}" transform="${k.translateAlong(P, [0, 0, ROWS[key].base])}">` +
    S(k.slabOf({ x: PEN_DX - 0.6, y: PAPER_Y, w: 1.2, d: front - PAPER_Y + 1, r: 0.4 }, -0.6, 1.2, P, 2), { tone: "hi", lit, crease: "none" }) +
    S(k.slabOf({ x: 2.6, y: front, w: 7.6, d: 4.4, r: 1 }, -half, half * 2, P, 3, 0.4), { tone: lit ? "hi" : "mid", crease: "lo" }) +
    D([at([PEN_DX, front + 4.4, 0])], { size: 0.45 }) +
    `</g>`;
  const pens = ["gx", "gy", "gz", "rf"].map((key) => pen(key, 1.6, false)).join("") + pen("sig", 3.5, true);
  return `<g data-part="bridge" transform="${k.translateAlong(P, [X0 - PEN_DX, 0, 0])}">${blocks}${bar}${pens}</g>`;
}

// ── RF console: pulse buttons and echo-count selector ──────────────────────
function console_() {
  const out = [S(k.slabOf(CONSOLE, 0, CONSOLE_H, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(CONSOLE, 3, P, 4), { tone: "faint" }) })];
  for (const b of BUTTONS) {
    const [x, y] = b.at;
    out.push(S(k.cylinder(x, y, 9, CONSOLE_H, 1.6, P, 40), { tone: "lo" }));
    out.push(L(k.ring(x, y, 7.6, CONSOLE_H + 1.6, P, 40), { tone: "faint" }));
    out.push(`<g data-part="${b.key}">${S(k.cylinder(x, y, 6, CONSOLE_H + 1.6, 4, P, 40, 0.5), { tone: "hi", crease: "lo", inner: L(k.sideArc(x, y, 6, CONSOLE_H + 3, P, 28), { tone: "faint" }) })}${L(k.ring(x, y, 3.6, CONSOLE_H + 5.6, P, 32), { tone: "lo" })}</g>`);
    out.push(k.faceTextSvg(k.topMatrix([x, y + 15], CONSOLE_H, P, "x"), b.label, { size: 6, tone: "mid", anchor: "middle" }));
  }
  const [sx, sy] = SELECTOR;
  const z = CONSOLE_H + 1.6;
  out.push(S(k.cylinder(sx, sy, 9, CONSOLE_H, 1.6, P, 40), { tone: "lo" }));
  out.push(L(DETENTS.map((deg) => { const d = dirOf(deg); return k.lineOnTop([sx + d[0] * 9, sy + d[1] * 9], [sx + d[0] * 7.4, sy + d[1] * 7.4], z, P); }).join(""), { tone: "hi" }));
  out.push(S(k.cylinder(sx, sy, 6, z, 4, P, 40, 0.4), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(sx, sy, 6, z, z + 4, 40, P), { tone: "lo" }));
  out.push(`<path data-part="n-pointer" class="iso-line" data-tone="hi" data-free="start" d="${pointerOf(k, P, SELECTOR, DETENTS[N0 - 1], 5, z + 4)}"/>`);
  out.push(k.faceTextSvg(k.topMatrix([sx, sy + 15], CONSOLE_H, P, "x"), "echoes", { size: 5, tone: "mid", anchor: "middle" }));
  // slide switch: spin echo or gradient echo
  out.push(L(k.planOutline({ x: SWITCH_X - 1.5, y: 41, w: 3, d: 18, r: 1.5 }, CONSOLE_H, P, 3), { tone: "lo" }));
  out.push(`<g data-part="mode-switch" transform="${k.translateAlong(P, [0, SWITCH_Y.SE, 0])}">${S(k.slabOf({ x: SWITCH_X - 3, y: -3, w: 6, d: 6, r: 1.2 }, CONSOLE_H, 3.5, P, 3, 0.4), { tone: "hi", crease: "lo" })}</g>`);
  out.push(k.faceTextSvg(k.topMatrix([SWITCH_X, 38], CONSOLE_H, P, "x"), "SE", { size: 3.6, tone: "mid", anchor: "middle" }));
  out.push(k.faceTextSvg(k.topMatrix([SWITCH_X, 65.5], CONSOLE_H, P, "x"), "GRE", { size: 3.6, tone: "mid", anchor: "middle" }));
  out.push(D(byDepth(k.corners(CONSOLE, 3)).map(([x, y]) => at([x, y, CONSOLE_H])), { size: 0.45 }));
  return out.join("");
}

function fader() {
  const { y, rail0, travel } = FADER;
  const panel = { x: rail0 - 24, y: y - 9, w: travel + 36, d: 19, r: 2.5 };
  const out = [S(k.slabOf(panel, 0, PANEL_Z, P, 4, 0.6), { tone: "mid" })];
  const slot = { x: rail0 + 10 - 1.2, y: y - 1.4, w: travel - 10 + 2.4, d: 2.8, r: 1.4 };
  out.push(S(k.slabOf(slot, PANEL_Z - 0.4, 0.4, P, 4), { tone: "lo", crease: "none", flat: true }));
  out.push(L(k.planOutline(slot, PANEL_Z, P, 4), { tone: "lo" }));
  const strip = { x: rail0 + 7, y: y + 3.4, w: travel - 4, d: 5, r: 0.8 };
  out.push(S(k.slabOf(strip, PANEL_Z, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const minor = [];
  const major = [];
  for (let ms = 10; ms <= 120; ms += 5) (ms % 20 === 0 ? major : minor).push(k.lineOnTop([rail0 + ms, strip.y], [rail0 + ms, strip.y + (ms % 20 === 0 ? 3.6 : 2)], PANEL_Z + 0.6, P));
  out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }));
  out.push(k.faceTextSvg(k.topMatrix([rail0 - 10, y + 1.8], PANEL_Z, P, "x"), "TE", { size: 5, tone: "hi", anchor: "middle" }));
  out.push(D(byDepth(k.corners(panel, 3)).map(([x, yy]) => at([x, yy, PANEL_Z])), { size: 0.45 }));
  const cap = { x: -5, y: y - 6.5, w: 10, d: 13, r: 1.6 };
  const knob =
    S(k.slabOf({ x: -1.2, y: y - 1.2, w: 2.4, d: 2.4, r: 0.6 }, PANEL_Z - 0.4, 1.4, P, 2), { tone: "lo", crease: "none" }) +
    S(k.slabOf(cap, PANEL_Z + 1, 7, P, 4, 0.6), { tone: "hi", crease: "lo", inner: L(k.sideSeam(cap, PANEL_Z + 3, P, 4), { tone: "faint" }) }) +
    L([-2.6, 2.6].map((dx) => k.lineOnTop([dx, cap.y], [dx, cap.y + cap.d], PANEL_Z + 8, P)).join(""), { tone: "lo" }) +
    L(k.lineOnTop([0, cap.y], [0, cap.y + cap.d], PANEL_Z + 8, P), { tone: "hi" });
  out.push(`<g data-part="knob" transform="${k.translateAlong(P, [rail0 + TE0, 0, 0])}">${knob}</g>`);
  return out.join("");
}

// ── assemble ────────────────────────────────────────────────────────────────
const lampDepth = k.depthOf([LAMP[0], LAMP[1], 0], P);
const first = carsAt(k, P, OFFSETS.map(() => 0), LANES, TC, TOP, START).sort((a, b) => a.depth - b.depth);

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A round slot-car track with eight lanes, one car per lane. The cars start together on the start line, each at its own speed, and spread out; at every 180° pulse they all reverse and arrive back on the line together, one echo each time. A shim knob behind the track sets how far apart the speeds are. A five-pen recorder draws the pulse sequence (RF, three gradients and the echo signal), and a lightbox holds one brain film per echo, each exposed at its echo. At the front a fader sets the echo spacing TE, and a console carries the 90° and 180° buttons, a switch between spin echo and gradient echo, and an echo-count selector. In gradient-echo mode no pulse reverses the cars: a readout gradient pushes them apart and back, which undoes only its own push.",
  body: [
    plate(),
    lightboxSvg(k, P, LBOX),
    shimBox(),
    track(),
    `<g data-part="cars-back">${first.filter((c) => c.depth < lampDepth).map((c) => c.svg).join("")}</g>`,
    lamp(),
    `<g data-part="cars-front">${first.filter((c) => c.depth >= lampDepth).map((c) => c.svg).join("")}</g>`,
    recorder(),
    bridge(),
    fader(),
    console_(),
  ],
});

const modelSource = readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "");

const live = `
${modelSource}
const carsAt = ${carsAt.toString()};
const pointerOf = ${pointerOf.toString()};
const P = ${JSON.stringify(P)};
const K = { solidSvg, extrude, depthOf, lineOnTop };
const LANES = ${JSON.stringify(LANES)}, TC = ${JSON.stringify(TC)}, TOP = ${TOP}, START = ${START};
const X0 = ${X0}, KX = ${KX}, PEN_DX = ${PEN_DX}, PAPER_Y = ${PAPER_Y}, RULER_Y = ${RULER.y}, RULER_Z = ${CHART_H + 0.5};
const ROWS = ${JSON.stringify(ROWS)};
const RAIL0 = ${FADER.rail0}, LAMP_DEPTH = ${lampDepth};
const SHIM_C = ${JSON.stringify(SHIM_C)}, SHIM_Z = ${SHIM_H + 5}, SELECTOR = ${JSON.stringify(SELECTOR)}, SEL_Z = ${CONSOLE_H + 5.6};
const DETENTS = ${JSON.stringify(DETENTS)};
const SWITCH_Y = ${JSON.stringify(SWITCH_Y)};
const LANE_POS = OFFSETS.map((_, i) => (2 * i) / (OFFSETS.length - 1) - 1); // −1 inner lane … +1 outer lane
const shimAngle = (s) => -135 + (270 * (s - SHIM_RANGE[0])) / (SHIM_RANGE[1] - SHIM_RANGE[0]);
${FILM_JS}
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const SLICE = ${JSON.stringify(SLICE)};
const films = [0, 1, 2, 3].map((i) => makeFilm(svg, SLICE, TISSUES.map((t) => t.key), "film-" + i));
const q = (name) => svg.querySelector('[data-part="' + name + '"]');
const back = q("cars-back"), front = q("cars-front"), events = q("events");
const traces = { sig: q("trace-sig"), rf: q("trace-rf"), gz: q("trace-gz"), gy: q("trace-gy"), gx: q("trace-gx") };
const pens = { sig: q("pen-sig"), rf: q("pen-rf"), gz: q("pen-gz"), gy: q("pen-gy"), gx: q("pen-gx") };
const bridge = q("bridge"), knob = q("knob"), glow = q("glow"), shimPointer = q("shim-pointer"), nPointer = q("n-pointer");
const modeSwitch = q("mode-switch"), envStar = q("env-star");
const buttons = { p90: q("p90"), p180: q("p180") };
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// what the user has asked for, what the knobs show, and what the running cycle uses
const want = { TE: ${TE0}, N: ${N0}, shim: ${SHIM0}, mode: "SE" };
const shown = { TE: want.TE, N: want.N, shim: want.shim, sw: SWITCH_Y.SE };
let run = { ...want };
let t = 0, hold = 0, frame = 0, last = 0, visible = false, restartTimer = 0, idleTimer = 0, touring = !still.matches, tourAt = 1;
const TOUR = [
  { mode: "SE", TE: 80, N: 1, shim: 1 },
  { mode: "SE", TE: 80, N: 3, shim: 1 },
  { mode: "SE", TE: 80, N: 3, shim: 2.4 },
  { mode: "GRE", TE: 30, N: 3, shim: 0.25 },
  { mode: "GRE", TE: 30, N: 3, shim: 1 },
];
const HOLD = 1.8;
const pressed = { p90: -1e9, p180: -1e9 };
let clockReal = 0;

const refocusing = () => (run.mode === "GRE" ? 0 : run.N); // gradient echoes have no 180° pulses
const valueOf = {
  sig: (ms) => signalOf(ms, run.TE, run.N, run.shim, run.mode),
  rf: (ms) => rfOf(ms, run.TE, refocusing()),
  gz: (ms) => gzOf(ms, run.TE, refocusing()),
  gy: (ms) => gyOf(ms, run.TE),
  gx: (ms) => gxOf(ms, run.TE, run.N, run.mode),
};

function drawEvents() {
  const marks = [];
  for (let j = 1; j <= run.N; j++) { if (run.mode === "SE") marks.push((j - 0.5) * run.TE); marks.push(j * run.TE); }
  events.innerHTML = dotsSvg([0, ...marks].map((ms) => iso([X0 + ms * KX, RULER_Y + 3, RULER_Z], P)), { size: 0.9, tone: "hi" });
  const star = t2StarOf(run.shim);
  const env = [];
  for (let ms = 0; ms <= Math.min(T_SPAN, star * Math.log(100)); ms += 1) env.push(iso([X0 + ms * KX, PAPER_Y, ROWS.sig.base + Math.exp(-ms / star) * ROWS.sig.amp], P));
  envStar.setAttribute("d", pathOf(env));
}

function draw() {
  const end = endOf(run.TE, run.N);
  const now = clamp(t, 0, end);
  const cars = carsAt(K, P, OFFSETS.map((f, i) => phaseOf(f, now, run.TE, run.N, run.shim, run.mode, LANE_POS[i])), LANES, TC, TOP, START).sort((a, b) => a.depth - b.depth);
  back.innerHTML = cars.filter((c) => c.depth < LAMP_DEPTH).map((c) => c.svg).join("");
  front.innerHTML = cars.filter((c) => c.depth >= LAMP_DEPTH).map((c) => c.svg).join("");
  for (const key of Object.keys(traces)) {
    const row = ROWS[key];
    const pts = [];
    for (let ms = 0; ms <= now + 1e-9; ms += 0.5) pts.push(iso([X0 + ms * KX, PAPER_Y, row.base + valueOf[key](ms) * row.amp], P));
    pts.push(iso([X0 + now * KX, PAPER_Y, row.base + valueOf[key](now) * row.amp], P));
    traces[key].setAttribute("d", pathOf(pts));
    pens[key].setAttribute("transform", translateAlong(P, [0, 0, row.base + valueOf[key](now) * row.amp]));
  }
  bridge.setAttribute("transform", translateAlong(P, [X0 + now * KX - PEN_DX, 0, 0]));
  knob.setAttribute("transform", translateAlong(P, [RAIL0 + shown.TE, 0, 0]));
  shimPointer.setAttribute("d", pointerOf(K, P, SHIM_C, shimAngle(shown.shim), 3.6, SHIM_Z));
  nPointer.setAttribute("d", pointerOf(K, P, SELECTOR, -60 + 40 * (shown.N - 1), 5, SEL_Z));
  modeSwitch.setAttribute("transform", translateAlong(P, [0, shown.sw, 0]));
  // films: echo j is exposed over the half-TE before it forms, then held
  films.forEach((paint, i) => {
    const j = i + 1;
    if (j > run.N || now < (j - 0.5) * run.TE) return paint([0, 0, 0]);
    const time = Math.min(now, j * run.TE);
    paint(TISSUES.map((tissue) => tissueSignalOf(tissue, time, run.TE, run.N, run.shim, run.mode)));
  });
  // the start-line lamp glows at each echo, as brightly as the cars are regrouped
  let lit = 0;
  for (let j = 1; j <= run.N; j++) {
    if (now <= (j - 0.5) * run.TE) continue;
    const together = run.mode === "GRE" ? Math.exp((-j * run.TE) / t2PrimeOf(run.shim)) : 1;
    lit = Math.max(lit, Math.exp(-(((now - j * run.TE) / 4) ** 2)) * together);
  }
  glow.setAttribute("opacity", lit.toFixed(2));
  for (const key of ["p90", "p180"]) {
    const dip = Math.exp(-Math.max(0, clockReal - pressed[key]) / 0.22);
    buttons[key].setAttribute("transform", translateAlong(P, [0, 0, -2 * dip]));
  }
  const s = signalOf(now, run.TE, run.N, run.shim, run.mode);
  const text = run.mode + " · TE " + Math.round(run.TE) + " · " + run.N + (run.N > 1 ? " echoes" : " echo") + " · T2* " + Math.round(t2StarOf(run.shim)) + " ms · t " + Math.round(now) + " · " + stageOf(now, run.TE, run.N, run.mode) + " · " + s.toFixed(2);
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuetext", text);
}

function restart() {
  if (touring) Object.assign(want, TOUR[tourAt++ % TOUR.length]);
  want.N = Math.min(want.N, maxEchoes(want.TE));
  run = { TE: Math.round(want.TE), N: want.N, shim: want.shim, mode: want.mode };
  t = 0; hold = 0; drawEvents(); pressed.p90 = clockReal;
}

function tick(stamp) {
  const dt = last ? Math.min((stamp - last) / 1000, 1 / 30) : 1 / 60;
  last = stamp;
  clockReal += dt;
  const ease = 1 - Math.exp(-dt / 0.3);
  shown.TE += (want.TE - shown.TE) * ease;
  shown.shim += (want.shim - shown.shim) * ease;
  shown.N += (want.N - shown.N) * ease;
  shown.sw += (SWITCH_Y[want.mode] - shown.sw) * ease;
  const end = endOf(run.TE, run.N);
  if (t < end) {
    const before = t;
    t = Math.min(end, t + (dt * end) / (2 + 1.8 * run.N));
    if (run.mode === "SE") for (let j = 1; j <= run.N; j++) if (before < (j - 0.5) * run.TE && t >= (j - 0.5) * run.TE) pressed.p180 = clockReal;
  } else {
    hold += dt;
    if (hold > HOLD) restart();
  }
  draw();
  frame = visible ? requestAnimationFrame(tick) : 0;
}

const go = () => { if (!frame && visible && !still.matches) { last = 0; frame = requestAnimationFrame(tick); } };
function steer(change) {
  touring = false;
  Object.assign(want, change);
  want.TE = clamp(Math.round(want.TE), TE_RANGE[0], TE_RANGE[1]);
  want.shim = clamp(want.shim, SHIM_RANGE[0], SHIM_RANGE[1]);
  want.N = clamp(Math.round(want.N), 1, maxEchoes(want.TE));
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { touring = !still.matches; }, 8000);
  if (still.matches) { Object.assign(shown, want, { sw: SWITCH_Y[want.mode] }); run = { ...want }; t = endOf(run.TE, run.N); drawEvents(); draw(); return; }
  clearTimeout(restartTimer);
  restartTimer = setTimeout(() => { if (want.TE !== run.TE || want.N !== run.N || want.mode !== run.mode || Math.abs(want.shim - run.shim) > 0.05) restart(); }, 350);
  go();
}
new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) go(); }, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("pointermove", (event) => {
  const box = svg.getBoundingClientRect();
  const sx = clamp(((event.clientX - box.left) / box.width - 0.12) / 0.76, 0, 1);
  const sy = clamp(((event.clientY - box.top) / box.height - 0.15) / 0.7, 0, 1);
  steer({ TE: TE_RANGE[0] + sx * (TE_RANGE[1] - TE_RANGE[0]), shim: SHIM_RANGE[0] + sy * (SHIM_RANGE[1] - SHIM_RANGE[0]) });
});
stage.addEventListener("keydown", (event) => {
  if (event.key === "ArrowRight") steer({ TE: want.TE + 10 });
  else if (event.key === "ArrowLeft") steer({ TE: want.TE - 10 });
  else if (event.key === "ArrowDown") steer({ shim: want.shim + 0.25 });
  else if (event.key === "ArrowUp") steer({ shim: want.shim - 0.25 });
  else if (/^[1-4]$/.test(event.key)) steer({ N: Number(event.key) });
  else if (event.key === "g" || event.key === "G") steer({ mode: want.mode === "SE" ? "GRE" : "SE" });
  else return;
  event.preventDefault();
});
if (still.matches) { run = { TE: ${TE0}, N: 3, shim: ${SHIM0}, mode: "SE" }; Object.assign(want, run); Object.assign(shown, run); t = endOf(run.TE, run.N); }
drawEvents();
draw();
`;

const body = k.plateHtml({
  fig: "Fig 5",
  title: "Spin-echo track",
  hint: "Hover or keys 1–4, G",
  readout: `SE · TE ${TE0} · 1 echo · T2* ${Math.round(t2StarOf(SHIM0))} ms · t 0 · 90° pulse · ${signalOf(0, TE0, N0, SHIM0).toFixed(2)}`,
  keys: [
    { mark: "lit", label: "Cars: spins at slightly different frequencies (field inhomogeneity)" },
    { mark: "raised", label: "Shim knob: how uneven the field is · switch: spin echo (SE) or gradient echo (GRE) · selector: number of echoes" },
    { mark: "dotted", label: `Recorder: RF, slice (Gz), phase (Gy) and readout (Gx) gradients, and the echo signal with its T2 envelope, T2 = ${T2} ms` },
    { mark: "dashed", label: "Dashed: the T2* envelope e^(−t/T2*), set by the shim" },
    { mark: "edge", label: `Lightbox: one film per echo, MNI152 slice z = +${SLICE.z} mm` },
  ],
  caption: `Eight spins in the rotating frame precess up to ${Math.max(...OFFSETS)} Hz faster or slower than the scanner's reference because the field is not perfectly uniform. After the 90° pulse they fan out and the free induction decay collapses within milliseconds: T2* decay. Spin echo (SE): each 180° pulse flips every phase; since each spin keeps its own speed, they all come back into phase one TE later, and every refocusing pulse makes a new echo, an echo train. The echoes shrink along the true T2 decay, e^(−t/T2), which no pulse can undo. Turning the shim knob toward a poorer shim spreads the speeds further (T2′ = ${T2_PRIME_BASE} ms divided by the shim factor): the FID and the sides of each echo get narrower, but the echo peaks stay on the T2 curve. Gradient echo (GRE): there is no 180° pulse. A readout gradient first spreads the spins across the voxel and then gathers them again, alternating in sign to make an echo train; at each echo its own effect cancels, but the field's spread keeps growing, so the echoes fall on the T2* curve instead. A good shim (T2* near 29 ms here) leaves usable gradient echoes; a poor one wipes them out, while the spin echoes at the same TE would barely change. That is why spin echoes are insensitive to field inhomogeneity and gradient echoes are not, and why gradient echoes see the small field changes BOLD fMRI depends on. The shim range here is exaggerated so the cars move visibly; a well-shimmed brain at 3 T has T2* of about 50–65 ms. The recorder trace uses a continuous (Lorentzian) spread of frequencies, of which the eight cars are a sample; reversing the cars is the classic runners picture, while the real pulse mirrors the phases, which gives the same signal. RF and gradient rows are schematic: shapes and order are right, lobe sizes and pulse widths are not to scale. Each film is exposed from its 180° pulse to its echo for white matter, grey matter and CSF (T2 80, 110 and 2000 ms; proton density 0.7, 0.8 and 1.0; long TR) on one fixed display window: later echoes are darker and more strongly T2-weighted, and fitting the four of them pixel by pixel is how a T2 map is made. ${MNI_NOTICE}`,
  body: `<div class="iso-stage" tabindex="0" role="application" aria-roledescription="spin-echo track" aria-label="Spin-echo track: left and right arrows change TE by 10 ms, up and down change the shim, keys 1 to 4 set the number of echoes, G switches between spin echo and gradient echo">${svg}</div>`,
});

writeFileSync(join(HERE, OUT), k.pageHtml({ title: "Spin-echo track", theme, body, script: kitScript() + live }));
console.log("wrote", OUT);
