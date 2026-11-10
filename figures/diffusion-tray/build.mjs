// Fig 12 — Diffusion tray: diffusion weighting, the ADC, and an infarct on DWI and ADC over time.
// node build.mjs            → diffusion-tray.html (dark)
// node build.mjs --light    → diffusion-tray-light.html
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../_anatomy/kit/iso-kit.mjs";
import { kitScript } from "../_anatomy/scripts/inline-kit.mjs";
import { SEQ, SMALL_DELTA, BIG_DELTA, B_VALUES, TISSUES, STAGES, LESION, TR, TE, gradientOf, signalOf } from "./model.mjs";
import { loadSlice, lightboxGeometry, lightboxSvg, MNI_NOTICE } from "../_shared/lightbox.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const OUT = theme === "light" ? "diffusion-tray-light.html" : "diffusion-tray.html";

const WIDTH = 600;
const HEIGHT = 400;

// ── world layout ────────────────────────────────────────────────────────────
const PLATE = { x: -150, y: -110, w: 300, d: 198, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

// pulse-sequence board at the back left
const SEQ_BASE = { x: -146, y: -104, w: 128, d: 18, r: 3 };
const SEQ_BASE_H = 6;
const SEQ_BOARD = { x: -144, y: -100, w: 124, d: 6, r: 1 };
const SEQ_TOP = 54;
const SFACE = SEQ_BOARD.y + SEQ_BOARD.d;
const SPAPER = { x: -140, w: 116, z0: 9, z1: 50 };
const SPY = SFACE + 0.4;
const STX0 = -128; // t = 0 ms
const SKT = 1.14; // units per ms
const RF_Z = 39;
const G_Z = 24;
const ECHO_Z = 12;
const G_H = 9; // lobe height at b = 3000

// gradient coil and the tray of water
const COIL = { x: -130, y: -68, w: 160, d: 8, r: 1.5 };
const COIL_H = 12;
const TRAY = { x: -131, y: -57, w: 162, d: 70, r: 2 };
const INNER = { x0: -128, x1: 28 }; // 100 µm
const UM = (INNER.x1 - INNER.x0) / 100; // units per µm
const LANES = [
  { y0: -54, y1: -34, key: "csf", label: "CSF" },
  { y0: -32, y1: -12, key: "gm", label: "grey" },
  { y0: -10, y1: 10, key: "lesion", label: "infarct" },
];
const WALL_Z = 9;
const WATER_Z = 8.2;
const DECK = { x: 37, y: -57, w: 50, d: 70, r: 3 };
const DECK_H = 6;
const DIAL_X = 49;
const DIAL_R = 8;

// console at the front
const CONSOLE = { x: -90, y: 30, w: 180, d: 34, r: 3 };
const CONSOLE_H = 9;
const KNOB = [-66, 47];
const DETENTS = [-120, -60, 0, 60, 120];
const KEYS = [-14, 12, 38];
const KEY_Y = 43;

// slice with an illustrative infarct mask
const SLICE0 = loadSlice();
const SLICE = (() => {
  const W = SLICE0.width, H = SLICE0.height, A = SLICE0.affine;
  const m = Buffer.alloc(W * H);
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const i = SLICE0.i_last - c, j = SLICE0.j_last - r;
    const x = A[0][0] * i + A[0][3], y = A[1][1] * j + A[1][3];
    const rr = ((x - LESION.x) / LESION.rx) ** 2 + ((y - LESION.y) / LESION.ry) ** 2;
    m[r * W + c] = Math.round(255 * Math.min(1, Math.max(0, (1 - rr) * 3.5)));
  }
  return { ...SLICE0, lesion: m.toString("base64") };
})();
const LBOX = lightboxGeometry({ x: -8, y: -100, w: 154, d: 12, r: 2 }, SLICE, { top: 84, grid: [3, 1], labels: ["b = 0", "DWI", "ADC"] });

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [SEQ_BOARD.x, SEQ_BOARD.y, SEQ_TOP], [LBOX.LB.x, LBOX.LB.y, LBOX.top], [LBOX.LB.x + LBOX.LB.w, LBOX.LB.y, LBOX.top]],
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
const topText = (x, y, z, value, size = 3.4, anchor = "middle", tone = "mid") => k.faceTextSvg(k.topMatrix([x, y], z, P, "x"), value, { size, tone, anchor });
const faceText = (x, y, z, value, size = 3.4, anchor = "start", tone = "mid") => k.faceTextSvg(k.sideMatrix([x, y], z, P, "left"), value, { size, tone, anchor });

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

// ── pulse-sequence board ───────────────────────────────────────────────────
const sx = (t) => STX0 + t * SKT;
const sinc = (u) => (Math.abs(u) < 1e-6 ? 1 : Math.sin(u) / u);
function rfPulse(t0, amp, z0) {
  const pts = [];
  for (let i = -16; i <= 16; i++) { const tt = t0 + (i / 16) * 2.6; pts.push([sx(tt), SPY, z0 + amp * sinc((Math.PI * (tt - t0)) / 1.3)]); }
  return on(pts);
}
function sequenceBoard() {
  const out = [S(k.slabOf(SEQ_BASE, 0, SEQ_BASE_H, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(SEQ_BASE, 2.5, P, 4), { tone: "faint" }) })];
  out.push(S(k.slabOf(SEQ_BOARD, SEQ_BASE_H, SEQ_TOP - SEQ_BASE_H, P, 3, 0.6), { tone: "mid" }));
  out.push(S(k.slabOf({ x: SPAPER.x, y: SFACE, w: SPAPER.w, d: 0.4, r: 0 }, SPAPER.z0, SPAPER.z1 - SPAPER.z0, P, 1), { tone: "hi", crease: "none" }));
  const grid = [];
  for (let t = 10; t <= SEQ.end; t += 10) grid.push(on([[sx(t), SPY, SPAPER.z0], [sx(t), SPY, SPAPER.z1]]));
  out.push(L(grid.join(""), { tone: "faint" }));
  out.push(L([RF_Z, G_Z, ECHO_Z].map((z) => on([[SPAPER.x, SPY, z], [SPAPER.x + SPAPER.w, SPY, z]])).join(""), { tone: "lo" }));
  out.push(`<path data-part="rf" class="iso-line" data-tone="mid" d="${rfPulse(0, 6, RF_Z) + rfPulse(SEQ.rf180, 9, RF_Z)}"/>`);
  out.push(`<path data-part="lobes" class="iso-line" data-tone="mid" d=""/>`);
  out.push(`<path data-part="echo" class="iso-line" data-tone="mid" d=""/>`);
  for (const [z, text] of [[RF_Z, "RF"], [G_Z, "G"], [ECHO_Z, "echo"]]) out.push(faceText(SPAPER.x + 1.2, SPY, z + 1, text, 2.8, "start", "lo"));
  out.push(faceText(sx(0) + 2.4, SPY, RF_Z + 4, "90°", 2.6, "start", "lo"));
  out.push(faceText(sx(SEQ.rf180) + 2.6, SPY, RF_Z + 6.5, "180°", 2.6, "start", "lo"));
  out.push(faceText((sx(SEQ.g1[0]) + sx(SEQ.g1[1])) / 2, SPY, G_Z + G_H + 1.6, "δ", 3, "middle", "lo"));
  out.push(faceText(sx(SEQ.te), SPY, ECHO_Z + 9.5, "TE", 2.6, "middle", "lo"));
  // Δ: a dimension line from the start of one lobe to the start of the other
  const dz = G_Z + G_H + 7;
  out.push(L(on([[sx(SEQ.g1[0]), SPY, dz], [sx(SEQ.g2[0]), SPY, dz]]) + on([[sx(SEQ.g1[0]), SPY, dz - 1.4], [sx(SEQ.g1[0]), SPY, dz + 1.4]]) + on([[sx(SEQ.g2[0]), SPY, dz - 1.4], [sx(SEQ.g2[0]), SPY, dz + 1.4]]), { tone: "lo", free: true }));
  out.push(faceText((sx(SEQ.g1[0]) + sx(SEQ.g2[0])) / 2, SPY, dz + 1, "Δ", 3, "middle", "lo"));
  out.push(`<path data-part="cursor" class="iso-line" data-tone="lit" data-free="" d=""/>`);
  out.push(faceText(SEQ_BASE.x + 4, SEQ_BASE.y + SEQ_BASE.d, 1.6, "b = γ²G²δ²(Δ − δ/3)", 3.2));
  out.push(D(byDepth(k.corners(SEQ_BASE, 2.6)).map(([x, y]) => at([x, y, SEQ_BASE_H])), { size: 0.45 }));
  return out.join("");
}

// ── gradient coil: a bar behind the tray; a wedge on its face shows the field rising along x ──
function coil() {
  const out = [S(k.slabOf(COIL, 0, COIL_H, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(COIL, 4, P, 3), { tone: "faint" }) })];
  const fy = COIL.y + COIL.d + 0.3;
  out.push(`<path data-part="wedge" class="dt-wedge" d=""/>`);
  out.push(L(on([[COIL.x + 2, fy, 2], [COIL.x + COIL.w - 2, fy, 2]]), { tone: "lo", free: true }));
  out.push(topText(COIL.x + COIL.w / 2, COIL.y + COIL.d / 2 + 1.2, COIL_H, "gradient coil · field rises along the tray", 3, "middle"));
  return out.join("");
}

// ── the tray ───────────────────────────────────────────────────────────────
const wall = (plan) => S(k.slabOf(plan, 1.5, WALL_Z - 1.5, P, 2, 0.3), { tone: "mid" });
function trayBack() {
  const out = [S(k.slabOf(TRAY, 0, 1.5, P, 3, 0.4), { tone: "mid" })];
  out.push(wall({ x: TRAY.x, y: TRAY.y, w: TRAY.w, d: 3, r: 1 }));
  out.push(wall({ x: TRAY.x, y: TRAY.y, w: 3, d: TRAY.d, r: 1 }));
  return out.join("");
}
function water(lane) {
  const plan = { x: INNER.x0, y: lane.y0, w: INNER.x1 - INNER.x0, d: lane.y1 - lane.y0, r: 0 };
  return `<path class="dt-water" d="${on([[plan.x, plan.y, WATER_Z], [plan.x + plan.w, plan.y, WATER_Z], [plan.x + plan.w, plan.y + plan.d, WATER_Z], [plan.x, plan.y + plan.d, WATER_Z]], true)}"/>`;
}
function divider(y0, y1) { return wall({ x: INNER.x0, y: y0, w: INNER.x1 - INNER.x0, d: y1 - y0, r: 0.5 }); }
function trayFront() {
  return wall({ x: TRAY.x, y: TRAY.y + TRAY.d - 3, w: TRAY.w, d: 3, r: 1 }) + wall({ x: TRAY.x + TRAY.w - 3, y: TRAY.y, w: 3, d: TRAY.d, r: 1 });
}

// ── echo deck: one dial per lane ───────────────────────────────────────────
function deck() {
  const out = [S(k.slabOf(DECK, 0, DECK_H, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(DECK, 2.5, P, 3), { tone: "faint" }) })];
  LANES.forEach((lane, i) => {
    const cy = (lane.y0 + lane.y1) / 2;
    out.push(L(k.ring(DIAL_X, cy, DIAL_R, DECK_H, P, 40), { tone: "lo" }));
    out.push(L(k.lineOnTop([DIAL_X, cy - DIAL_R], [DIAL_X, cy - DIAL_R + 1.6], DECK_H, P), { tone: "mid" }));
    out.push(`<path data-part="dial-${i}" class="iso-line" data-tone="lit" data-free="" d="" style="stroke-width:1.1"/>`);
    out.push(D([at([DIAL_X, cy, DECK_H])], { size: 0.8, tone: "hi" }));
    out.push(`<text data-part="lane-${i}" class="iso-face-text" data-tone="mid" transform="${k.topMatrix([DIAL_X + DIAL_R + 2.4, cy + 1.2], DECK_H, P, "x")}" font-size="3.4" text-anchor="start">${lane.label}</text>`);
  });
  out.push(topText(DECK.x + DECK.w / 2, DECK.y + DECK.d - 2.4, DECK_H, "echo", 3, "middle", "lo"));
  return out.join("");
}

// ── console ────────────────────────────────────────────────────────────────
function console_() {
  const z = CONSOLE_H;
  const out = [S(k.slabOf(CONSOLE, 0, CONSOLE_H, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(CONSOLE, 3.5, P, 4), { tone: "faint" }) })];
  const [cx, cy] = KNOB;
  out.push(L(k.ring(cx, cy, 10.5, z, P, 48), { tone: "faint" }));
  out.push(L(DETENTS.map((deg) => { const d = dirOf(deg); return k.lineOnTop([cx + d[0] * 10.5, cy + d[1] * 10.5], [cx + d[0] * 8.2, cy + d[1] * 8.2], z, P); }).join(""), { tone: "hi" }));
  const anchors = ["end", "end", "middle", "start", "start"];
  B_VALUES.forEach((b, i) => { const d = dirOf(DETENTS[i]); out.push(topText(cx + d[0] * 14.4, cy + d[1] * 14.4 + 1.2, z, String(b), 3.2, anchors[i])); });
  out.push(S(k.cylinder(cx, cy, 6.4, z, 4.6, P, 36, 0.4), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(cx, cy, 6.4, z, z + 4.6, 36, P), { tone: "lo" }));
  out.push(`<path data-part="b-pointer" class="iso-line" data-tone="hi" data-free="" d="${pointerOf(k, P, KNOB, DETENTS[2], 5.2, z + 4.6)}"/>`);
  out.push(topText(cx, cy + 16.4, z, "b, s/mm²", 3.2));
  STAGES.forEach((st, i) => {
    const kx = KEYS[i];
    out.push(L(k.planOutline({ x: kx - 9.5, y: KEY_Y - 6.5, w: 19, d: 13, r: 2 }, z, P), { tone: "lo" }));
    out.push(S(k.slabOf({ x: kx - 8, y: KEY_Y - 5, w: 16, d: 10, r: 1.6 }, z, 3, P, 3, 0.4), { tone: "hi", crease: "lo" }));
    const lamp = { x: kx - 5, y: KEY_Y - 3.2, w: 10, d: 2.2, r: 0.8 };
    out.push(S(k.slabOf(lamp, z + 3, 0.5, P, 2), { tone: "lo", crease: "none" }));
    out.push(`<g data-part="key-lamp-${i}" opacity="0">${S(k.slabOf(lamp, z + 3, 0.5, P, 2), { tone: "hi", lit: true, crease: "none" })}</g>`);
    out.push(topText(kx, KEY_Y + 3.6, z + 3, String(i + 1), 3, "middle", "lo"));
    out.push(topText(kx, KEY_Y + 11, z, st.label, 3.4));
  });
  const plaque = { x: 52, y: CONSOLE.y + 6, w: 36, d: 22, r: 1.5 };
  out.push(L(k.planOutline(plaque, z, P), { tone: "lo" }));
  out.push(topText(plaque.x + 2.2, plaque.y + 8, z, "S = S0·e^(−b·D)", 3, "start"));
  out.push(topText(plaque.x + 2.2, plaque.y + 16, z, "ADC = ln(S0/Sb)/b", 3, "start"));
  out.push(faceText(CONSOLE.x + 5, CONSOLE.y + CONSOLE.d, 3, "b-value · stage of the infarct", 3.6));
  out.push(D(byDepth(k.corners(CONSOLE, 3)).map(([x, y]) => at([x, y, CONSOLE_H])), { size: 0.45 }));
  return out.join("");
}

// ── assemble ────────────────────────────────────────────────────────────────
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A bench for diffusion MRI. At the back left a board draws the pulse sequence: a 90 degree and a 180 degree RF pulse, two gradient lobes either side of the 180, and the echo, with a moving cursor. In the middle a shallow tray of water, 100 micrometres long, has three lanes: CSF, grey matter and an infarct. Each lane holds wandering water molecules with a small hand for their phase; a gradient coil behind the tray winds the hands into a helix, the 180 degree pulse mirrors them and the second lobe unwinds them, so molecules that moved keep a leftover phase. Dials at the end of each lane show the echo. At the front a knob sets the b-value and three keys choose the stage of an infarct; a lightbox shows the brain at b = 0, on diffusion weighting, and as an ADC map.",
  body: [
    plate(),
    lightboxSvg(k, P, LBOX),
    sequenceBoard(),
    coil(),
    trayBack(),
    water(LANES[0]),
    `<g data-part="lane-mol-0"></g>`,
    divider(LANES[0].y1, LANES[1].y0),
    water(LANES[1]),
    `<g data-part="lane-mol-1"></g>`,
    divider(LANES[1].y1, LANES[2].y0),
    water(LANES[2]),
    `<g data-part="lane-mol-2"></g>`,
    trayFront(),
    deck(),
    console_(),
  ],
});

const modelSource = readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "");

const live = `
${modelSource}
const pointerOf = ${pointerOf.toString()};
const P = ${JSON.stringify(P)};
const K = { lineOnTop };
const LANES = ${JSON.stringify(LANES)}, INNER = ${JSON.stringify(INNER)}, UM = ${UM}, WATER_Z = ${WATER_Z};
const DIAL_X = ${DIAL_X}, DIAL_R = ${DIAL_R}, DECK_H = ${DECK_H};
const STX0 = ${STX0}, SKT = ${SKT}, SPY = ${SPY}, G_Z = ${G_Z}, G_H = ${G_H}, ECHO_Z = ${ECHO_Z}, SPAPER = ${JSON.stringify(SPAPER)};
const COIL = ${JSON.stringify(COIL)};
const KNOB = ${JSON.stringify(KNOB)}, DETENTS = ${JSON.stringify(DETENTS)}, KNOB_Z = ${CONSOLE_H + 4.6};
const SLICE = ${JSON.stringify({ width: SLICE.width, height: SLICE.height, gm: SLICE.gm, wm: SLICE.wm, csf: SLICE.csf, lesion: SLICE.lesion })};
const stage_ = document.querySelector(".iso-stage");
const svg = stage_.querySelector("svg");
const q = (name) => svg.querySelector('[data-part="' + name + '"]');
const molGroups = LANES.map((_, i) => q("lane-mol-" + i));
const dials = LANES.map((_, i) => q("dial-" + i));
const laneText = LANES.map((_, i) => q("lane-" + i));
const keyLamps = STAGES.map((_, i) => q("key-lamp-" + i));
const lobes = q("lobes"), echoPath = q("echo"), cursor = q("cursor"), rf = q("rf"), wedge = q("wedge"), bPointer = q("b-pointer");
const films = [q("film-0"), q("film-1"), q("film-2")];
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const sinc = (u) => (Math.abs(u) < 1e-6 ? 1 : Math.sin(u) / u);
const sx = (t) => STX0 + t * SKT;

// ── seeded randomness ──
function gauss(seed) { let s = seed >>> 0; const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) + 0.5) / 4294967296; return () => Math.sqrt(-2 * Math.log(r())) * Math.cos(2 * Math.PI * r()); }
const walk = gauss(7);

// ── films: b = 0, DWI at the chosen b, ADC from b 0 and 1000 (as on a scanner), each windowed separately ──
const unpack = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const GM = unpack(SLICE.gm), WMM = unpack(SLICE.wm), CSF = unpack(SLICE.csf), LES = unpack(SLICE.lesion);
const NPX = SLICE.width * SLICE.height;
const NOISE = 0.008;
const noiseField = (seed) => { const g = gauss(seed); return [Float32Array.from({ length: NPX }, () => g() * NOISE), Float32Array.from({ length: NPX }, () => g() * NOISE)]; };
const N0 = noiseField(101), NB = noiseField(202), N1000 = noiseField(303);
const canvas = document.createElement("canvas");
canvas.width = SLICE.width; canvas.height = SLICE.height;
const ctx = canvas.getContext("2d");
const image = ctx.createImageData(SLICE.width, SLICE.height);
function imageOf(b, st) {
  const out = new Float32Array(NPX);
  const t = TISSUES;
  const n = [signalOf(t.gm, b), signalOf(t.wm, b), signalOf(t.csf, b)];
  const l = [signalOf(t.gm, b, st), signalOf(t.wm, b, st)];
  for (let p = 0; p < NPX; p++) {
    const m = LES[p] / 255, g = GM[p] / 255, w = WMM[p] / 255, c = CSF[p] / 255;
    out[p] = g * ((1 - m) * n[0] + m * l[0]) + w * ((1 - m) * n[1] + m * l[1]) + c * n[2];
  }
  return out;
}
const magnitude = (img, nz) => Float32Array.from(img, (v, p) => Math.hypot(v + nz[0][p], nz[1][p]));
function paint(film, values, scale) {
  const px = image.data;
  for (let p = 0; p < NPX; p++) {
    const g = Math.round(2.55 * (4 + 92 * clamp(values[p] / scale, 0, 1)));
    px[p * 4] = px[p * 4 + 1] = px[p * 4 + 2] = g; px[p * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  film.setAttribute("href", canvas.toDataURL());
}
let paintedStage = -1, paintedB = -1, s0Cache = null;
function paintFilms(b, si) {
  const st = STAGES[si];
  if (si !== paintedStage) {
    s0Cache = magnitude(imageOf(0, st), N0);
    paint(films[0], s0Cache, 0.7);
    const s1000 = magnitude(imageOf(1000, st), N1000);
    const adc = Float32Array.from(s0Cache, (s0, p) => (s0 > 0.06 ? Math.log(s0 / Math.max(1e-4, s1000[p])) : 0));
    paint(films[2], adc, 3.2);
    paintedB = -1;
  }
  const bq = Math.round(b / 25) * 25;
  if (bq !== paintedB || si !== paintedStage) {
    const dwi = bq === 0 ? s0Cache : magnitude(imageOf(bq, st), NB);
    paint(films[1], dwi, 2.2 * signalOf(TISSUES.gm, bq));
    paintedB = bq;
  }
  paintedStage = si;
}

// ── molecules: random walks in each lane, phases wound by the gradient ──
const PER_LANE = 26;
const laneUm = (lane) => (lane.y1 - lane.y0) / UM;
const mols = LANES.map((lane) => Array.from({ length: PER_LANE }, (_, i) => ({ x: ((i + 0.5) / PER_LANE) * 100 + (Math.random() - 0.5) * 2, y: Math.random() * laneUm(lane), phi: Math.random() * 2 * Math.PI })));
const laneD = (i, si) => (i === 0 ? TISSUES.csf.adc : i === 1 ? TISSUES.gm.adc : TISSUES.gm.adc * STAGES[si].adc);
const B_SHARE = Array.from({ length: 181 }, (_, i) => bShareAt(i / 2));
const shareAt = (t) => B_SHARE[clamp(Math.round(t * 2), 0, 180)];
const CYCLE = 112; // ms of sequence time per loop: the sequence, then a hold on the echo
const SLOW = 75; // the bench runs this many times slower than real time

let b = 1000, si = 0, t = 0, frame = 0, last = 0, visible = false, touring = !still.matches, idleTimer = 0, tourAt = 0;
const TOUR = [[1000, 0], [0, 0], [3000, 0], [1000, 1], [1000, 2]];

function stepMolecules(dtMs, t0, t1) {
  const qv = qOf(b);
  const k0 = kAt(t0), k1 = kAt(t1);
  const flip = t0 < SEQ.rf180 && t1 >= SEQ.rf180;
  const excite = t1 < t0; // wrapped: a new 90° pulse
  LANES.forEach((lane, i) => {
    const Dl = laneD(i, si), wY = laneUm(lane), sd = Math.sqrt(2 * Dl * dtMs);
    for (const m of mols[i]) {
      if (excite) m.phi = 0;
      else if (flip) m.phi = -m.phi; // the 180° pulse mirrors every phase
      else m.phi += qv * (k1 - k0) * m.x; // a gradient lobe winds phase in proportion to position
      m.x += sd * walk(); m.y += sd * walk();
      if (m.x < 0) m.x = -m.x; if (m.x > 100) m.x = 200 - m.x;
      if (m.y < 0) m.y = -m.y; if (m.y > wY) m.y = 2 * wY - m.y;
    }
  });
}

function drawMolecules() {
  LANES.forEach((lane, i) => {
    let hands = "";
    const dots = [];
    for (const m of mols[i]) {
      const X = INNER.x0 + m.x * UM, Y = lane.y0 + m.y * UM;
      const c = iso([X, Y, WATER_Z], P);
      const e = iso([X + Math.sin(m.phi) * 3.2, Y - Math.cos(m.phi) * 3.2, WATER_Z], P);
      hands += "M" + c[0].toFixed(1) + " " + c[1].toFixed(1) + "L" + e[0].toFixed(1) + " " + e[1].toFixed(1);
      dots.push(c);
    }
    molGroups[i].innerHTML = '<path class="iso-line" data-tone="hi" data-free="" d="' + hands + '"/>' + dotsSvg(dots, { size: 0.75, tone: "mid" });
  });
}

function echoOf(i) { return Math.exp(-(b / 1000) * laneD(i, si)); }
function draw() {
  const qv = qOf(b), tt = Math.min(t, SEQ.end);
  // dials: the average over very many molecules (not just the few drawn): a uniform helix averages to sinc, diffusion adds exp(−b·D)
  LANES.forEach((lane, i) => {
    const cy = (lane.y0 + lane.y1) / 2;
    const kk = kAt(Math.min(t, SEQ.te));
    const mag = Math.abs(sinc((qv * kk * 100) / 2)) * Math.exp(-(b / 1000) * laneD(i, si) * shareAt(Math.min(t, SEQ.te)));
    dials[i].setAttribute("d", lineOnTop([DIAL_X, cy], [DIAL_X, cy - Math.max(0.05, mag) * (DIAL_R - 0.6)], DECK_H, P));
    const text = lane.label + " " + Math.round(100 * echoOf(i)) + "%";
    if (laneText[i].textContent !== text) laneText[i].textContent = text;
  });
  // the sequence board
  const h = G_H * Math.sqrt(b / 3000);
  const lobe = ([a, c]) => pathOf([[a, G_Z], [a + 1, G_Z + h], [c - 1, G_Z + h], [c, G_Z]].map(([u, z]) => iso([sx(u), SPY, z], P)));
  lobes.setAttribute("d", b > 0 ? lobe(SEQ.g1) + lobe(SEQ.g2) : "");
  const amp = 8 * echoOf(1);
  const pts = [];
  for (let u = SEQ.te - 7; u <= SEQ.te + 7; u += 0.5) pts.push(iso([sx(u), SPY, ECHO_Z + amp * Math.exp(-(((u - SEQ.te) / 2.6) ** 2)) * Math.cos((u - SEQ.te) * 1.6)], P));
  echoPath.setAttribute("d", pathOf(pts));
  cursor.setAttribute("d", pathOf([iso([sx(tt), SPY, SPAPER.z0], P), iso([sx(tt), SPY, SPAPER.z1], P)]));
  rf.setAttribute("data-tone", tt < 2.5 || Math.abs(tt - SEQ.rf180) < 1.5 ? "lit" : "mid");
  // the coil's wedge: the field rises along x while a lobe is on
  const on_ = (tt >= SEQ.g1[0] && tt < SEQ.g1[1]) || (tt >= SEQ.g2[0] && tt < SEQ.g2[1]);
  const wh = on_ ? 9 * Math.sqrt(b / 3000) : 0;
  const fy = COIL.y + COIL.d + 0.3;
  wedge.setAttribute("d", wh > 0.05 ? pathOf([[INNER.x0, fy, 2], [INNER.x1, fy, 2], [INNER.x1, fy, 2 + wh]].map((p) => iso(p, P)), true) : "");
  // knob
  let ang = DETENTS[0];
  for (let i = 0; i < B_VALUES.length - 1; i++) if (b >= B_VALUES[i]) ang = DETENTS[i] + ((b - B_VALUES[i]) / (B_VALUES[i + 1] - B_VALUES[i])) * (DETENTS[i + 1] - DETENTS[i]);
  if (b >= B_VALUES[B_VALUES.length - 1]) ang = DETENTS[DETENTS.length - 1];
  bPointer.setAttribute("d", pointerOf(K, P, KNOB, ang, 5.2, KNOB_Z));
  keyLamps.forEach((el, i) => el.setAttribute("opacity", i === si ? "1" : "0"));
  drawMolecules();
  paintFilms(b, si);
  const text = STAGES[si].label + " infarct · b " + Math.round(b) + " s/mm² · G " + Math.round(gradientOf(b)) + " mT/m · t " + Math.round(tt) + " ms";
  if (readout.textContent !== text) readout.textContent = text;
  stage_.setAttribute("aria-valuetext", text + " · echo left: " + LANES.map((l, i) => l.label + " " + Math.round(100 * echoOf(i)) + "%").join(", "));
}

function tick(stamp) {
  const dt = last ? Math.min((stamp - last) / 1000, 1 / 30) : 1 / 60;
  last = stamp;
  const dtMs = (dt * 1000) / SLOW;
  const t0 = t;
  let t1 = t + dtMs;
  if (t1 >= CYCLE) {
    t1 -= CYCLE;
    if (touring) { const [bb, ss] = TOUR[++tourAt % TOUR.length]; b = bb; si = ss; }
  }
  stepMolecules(dtMs, t0, t1);
  t = t1;
  draw();
  frame = visible ? requestAnimationFrame(tick) : 0;
}

const go = () => { if (!frame && visible && !still.matches) { last = 0; frame = requestAnimationFrame(tick); } };
function user() {
  touring = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { touring = !still.matches; }, 10000);
}
function settle() { if (still.matches) draw(); else go(); }
new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) go(); }, { rootMargin: "120px 0px" }).observe(stage_);
stage_.addEventListener("pointermove", (event) => {
  user();
  const box = svg.getBoundingClientRect();
  b = Math.round(clamp(((event.clientX - box.left) / box.width - 0.12) / 0.76, 0, 1) * 3000 / 50) * 50;
  settle();
});
stage_.addEventListener("keydown", (event) => {
  if (/^[1-3]$/.test(event.key)) { user(); si = Number(event.key) - 1; }
  else if (event.key === "]" || event.key === "ArrowRight") { user(); b = B_VALUES.find((v) => v > b + 1) ?? B_VALUES[B_VALUES.length - 1]; }
  else if (event.key === "[" || event.key === "ArrowLeft") { user(); b = [...B_VALUES].reverse().find((v) => v < b - 1) ?? 0; }
  else return;
  event.preventDefault();
  settle();
});
if (still.matches) {
  // a still frame at the echo: every molecule's phase set from a typical walk
  t = SEQ.te;
  LANES.forEach((lane, i) => { const sdPhase = Math.sqrt(2 * (b / 1000) * laneD(i, si)); for (const m of mols[i]) m.phi = sdPhase * walk(); });
}
draw();
`;

const css = `<style>
.dt-water{fill:var(--anatomy-shade-2);stroke:none}
.dt-wedge{fill:var(--anatomy-lit);fill-opacity:.35;stroke:var(--anatomy-lit);stroke-width:var(--anatomy-weight)}
</style>`;
const pct = (t, bb, st = null) => Math.round(100 * Math.exp(-(bb / 1000) * t.adc * (st ? st.adc : 1)));
const ratio = (st, bb) => (signalOf(TISSUES.gm, bb, st) / signalOf(TISSUES.gm, bb)).toFixed(2);
const body = k.plateHtml({
  fig: "Fig 12",
  title: "Diffusion tray",
  hint: "Move across for b · keys 1–3",
  readout: "acute infarct · b 1000 s/mm² · G 32 mT/m · t 0 ms",
  keys: [
    { mark: "lit", label: "Dials: the echo left in each lane, the average over very many molecules" },
    { mark: "raised", label: "Hands: each water molecule's phase, wound by the gradient and unwound after the 180° pulse" },
    { mark: "flat", label: "Wedge on the coil: the extra field, rising along the tray while a gradient lobe is on" },
    { mark: "edge", label: `Lightbox: b = 0, DWI at the chosen b, and the ADC map from b = 0 and 1000 (illustrative infarct; MNI152 slice z = +${SLICE.z} mm)` },
  ],
  caption:
    `Water molecules wander, and diffusion MRI measures how far. The Stejskal–Tanner sequence puts two identical gradient lobes either side of the 180° pulse. The first winds every spin's phase into a helix along the gradient, the 180° pulse mirrors the phases, and the second lobe unwinds them: a molecule that stayed put ends in phase, one that moved keeps a phase in proportion to how far. Averaged over the billions of molecules in a voxel, the echo falls to S = S0·exp(−b·D), where b = γ²G²δ²(Δ − δ/3) gathers the gradient's strength and timing (here δ = ${SMALL_DELTA} ms and Δ = ${BIG_DELTA} ms, so b = 1000 s/mm² needs ${Math.round(gradientOf(1000))} mT/m). ` +
    `Free water (CSF, D = ${TISSUES.csf.adc.toFixed(1)} × 10⁻³ mm²/s at body temperature) wanders farthest and keeps ${pct(TISSUES.csf, 1000)}% of its echo at b = 1000; in grey matter, where cell membranes get in the way, the water keeps ${pct(TISSUES.gm, 1000)}%. Because tissue is not free water, the D it gives is called the apparent diffusion coefficient (ADC), computed from two images: ADC = ln(S0/Sb)/b. ` +
    `In an acute infarct, cells swell within minutes and hinder the water more, so the ADC falls (here by ${Math.round(100 * (1 - STAGES[0].adc))}%): the infarct is bright on DWI (×${ratio(STAGES[0], 1000)}) and dark on ADC while the b = 0 image still looks normal, which is why DWI is the scan for acute stroke. About a week later the ADC is back to normal but T2 has risen, so the infarct still glows on DWI (×${ratio(STAGES[1], 1000)}): T2 shine-through, given away by its normal ADC. Months later the tissue has been replaced by fluid: high ADC, bright on b = 0, dark on DWI. ` +
    `Model: spin-echo EPI (TR ${TR} ms, TE ${TE} ms); ADC ${TISSUES.csf.adc.toFixed(1)}, ${TISSUES.gm.adc.toFixed(1)} and ${TISSUES.wm.adc.toFixed(1)} × 10⁻³ mm²/s for CSF, grey and white matter; the infarct's ADC ×${STAGES.map((s) => s.adc).join(", ×")} and T2 ×${STAGES.map((s) => s.t2).join(", ×")} at the three stages, an illustrative patch in the left middle-cerebral-artery territory. The films average the gradient directions (trace weighting), so white matter's direction dependence does not show. Each film is windowed separately and carries noise; at b = 3000 the CSF signal sinks into the noise. The tray is 100 µm long with a few dozen molecules per lane, and the bench runs about 75 times slower than real time. ` +
    MNI_NOTICE,
  body: `<div class="iso-stage" tabindex="0" role="application" aria-roledescription="diffusion tray" aria-label="Diffusion tray: moving across the figure sets the b-value from 0 to 3000 s/mm², left and right arrows step through 0, 500, 1000, 2000 and 3000, keys 1 to 3 choose an acute, subacute or chronic infarct">${svg}</div>`,
});

writeFileSync(join(HERE, OUT), k.pageHtml({ title: "Diffusion tray", theme, body: css + body, script: kitScript() + live }));
console.log("wrote", OUT, "· G(1000)", gradientOf(1000).toFixed(1), "mT/m · echo at b1000: csf", pct(TISSUES.csf, 1000), "% gm", pct(TISSUES.gm, 1000), "% · DWI infarct/GM", STAGES.map((s) => ratio(s, 1000)).join(" "));
