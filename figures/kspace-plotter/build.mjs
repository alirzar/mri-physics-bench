// Fig 7 — k-space plotter: the scanner fills k-space; the image is its inverse Fourier transform.
// node build.mjs            → kspace-plotter.html (dark)
// node build.mjs --light    → kspace-plotter-light.html
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../_anatomy/kit/iso-kit.mjs";
import { kitScript } from "../_anatomy/scripts/inline-kit.mjs";
import { N, CENTRE, TR_MS, ESP_MS, COVERAGES, scanTimeOf, resolutionOf } from "./model.mjs";
import { loadSlice, lightboxGeometry, lightboxSvg, MNI_NOTICE } from "../_shared/lightbox.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const OUT = theme === "light" ? "kspace-plotter-light.html" : "kspace-plotter.html";

const WIDTH = 600;
const HEIGHT = 400;

// ── world layout ────────────────────────────────────────────────────────────
const PLATE = { x: -150, y: -110, w: 300, d: 198, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

// plotter bed with a square sheet of film: k-space, kx along x (readout), ky along y (phase encoding)
const BED = { x: -134, y: -94, w: 148, d: 148, r: 3 };
const BED_H = 10;
const X0 = -124; // film's back-left corner
const Y0 = -84;
const SIZE = 128; // film side, world units (two k-space points per unit)
const PAPER_Z = BED_H + 0.4;
const STEP = SIZE / N;
const RAIL_H = 3;
const PEN_DY = 5.5; // the pen hangs in front of the gantry beam

// gantry (built with its pen over the origin, then moved along y; the carriage moves along x)
const BEAM_Z = BED_H + RAIL_H + 19;

const SLICE = loadSlice();
const LBOX = lightboxGeometry({ x: 40, y: -100, w: 104, d: 12, r: 2 }, { width: 1, height: 1 }, { top: 124 });

// console: coverage knob, line-by-line / EPI switch, RF lamp, scan button
const CONSOLE = { x: 34, y: 14, w: 106, d: 60, r: 3 };
const CONSOLE_H = 9;
const COV_KNOB = [60, 42];
const COV_DETENTS = [-120, -160, -200, -240]; // in front of the knob, so its labels stay in view
const SWITCH_X = 100;
const SWITCH_Y = { lines: 36, EPI: 46 };
const RF_LAMP = [124, 34];
const SCAN_BUTTON = [124, 58];

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [BED.x, BED.y, BEAM_Z + 6], [BED.x + BED.w, BED.y + BED.d, BEAM_Z + 6], [LBOX.LB.x + LBOX.LB.w, LBOX.LB.y, LBOX.top]],
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

// ── plotter bed: film, crosshair at k = 0, clips, rulers, rails ────────────
function bed() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BED, 0, 0.1, P)}" style="filter:blur(4px)"/>`];
  out.push(S(k.slabOf(BED, 0, BED_H, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(BED, 3.5, P, 4), { tone: "faint" }) }));
  out.push(S(k.slabOf({ x: X0, y: Y0, w: SIZE, d: SIZE, r: 0 }, BED_H, 0.4, P, 1), { tone: "lo", crease: "none" }));
  out.push(`<image data-part="paper" x="0" y="0" width="${SIZE}" height="${SIZE}" preserveAspectRatio="none" style="image-rendering:pixelated" transform="${k.topMatrix([X0, Y0], PAPER_Z, P, "x")}" href=""/>`);
  const mid = X0 + (N / 2 + 0.5) * STEP;
  const midY = Y0 + (N / 2 + 0.5) * STEP;
  out.push(L(k.lineOnTop([X0, midY], [X0 + SIZE, midY], PAPER_Z, P) + k.lineOnTop([mid, Y0], [mid, Y0 + SIZE], PAPER_Z, P), { tone: "faint" }));
  out.push(L(k.planOutline({ x: X0, y: Y0, w: SIZE, d: SIZE, r: 0 }, PAPER_Z, P, 1), { tone: "lo" }));
  for (const [cx, cy] of byDepth([[X0, Y0], [X0 + SIZE, Y0], [X0, Y0 + SIZE], [X0 + SIZE, Y0 + SIZE]])) {
    out.push(S(k.slabOf({ x: cx - 3, y: cy - 3, w: 6, d: 6, r: 1 }, PAPER_Z, 1.2, P, 2, 0.3), { tone: "mid" }));
    out.push(D([at([cx, cy, PAPER_Z + 1.2])], { size: 0.4 }));
  }
  // rulers: one tick every 32 k-space points, majors at the edges and at k = 0
  const kxRuler = { x: X0, y: Y0 + SIZE + 1.5, w: SIZE, d: 4, r: 0.6 };
  const kyRuler = { x: X0 + SIZE + 1.5, y: Y0, w: 4, d: SIZE, r: 0.6 };
  out.push(S(k.slabOf(kxRuler, BED_H, 0.5, P, 2), { tone: "lo", crease: "none" }));
  out.push(S(k.slabOf(kyRuler, BED_H, 0.5, P, 2), { tone: "lo", crease: "none" }));
  const minor = [];
  const major = [];
  for (let i = 0; i <= 8; i++) {
    const big = i % 4 === 0;
    const len = big ? 3.2 : 1.8;
    (big ? major : minor).push(k.lineOnTop([X0 + i * 16, kxRuler.y], [X0 + i * 16, kxRuler.y + len], BED_H + 0.5, P));
    (big ? major : minor).push(k.lineOnTop([kyRuler.x, Y0 + i * 16], [kyRuler.x + len, Y0 + i * 16], BED_H + 0.5, P));
  }
  out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }));
  // rails for the gantry
  for (const x of [BED.x + 1, BED.x + BED.w - 5]) {
    const rail = { x, y: BED.y + 2, w: 4, d: BED.d - 4, r: 0.8 };
    out.push(S(k.slabOf(rail, BED_H, RAIL_H, P, 2, 0.3), { tone: "mid" }));
    out.push(D([at([x + 2, rail.y + 3, BED_H + RAIL_H]), at([x + 2, rail.y + rail.d - 3, BED_H + RAIL_H])], { size: 0.4 }));
  }
  out.push(k.faceTextSvg(k.sideMatrix([X0 + 18, BED.y + BED.d], 3.4, P, "left"), "kx · readout →", { size: 4.2, tone: "mid" }));
  out.push(k.faceTextSvg(k.sideMatrix([BED.x + BED.w, Y0 + SIZE - 10], 3.4, P, "right"), "ky · phase encoding →", { size: 4.2, tone: "mid" }));
  return out.join("");
}

// ── gantry and pen ─────────────────────────────────────────────────────────
function gantry() {
  const z0 = BED_H + RAIL_H;
  const uprights = [BED.x, BED.x + BED.w - 6].map((x) => S(k.slabOf({ x, y: -4, w: 6, d: 8, r: 1 }, z0, BEAM_Z - z0, P, 2, 0.4), { tone: "mid", inner: L(k.sideSeam({ x, y: -4, w: 6, d: 8, r: 1 }, z0 + 6, P, 2), { tone: "faint" }) })).join("");
  const beam = S(k.slabOf({ x: BED.x, y: -2.5, w: BED.w, d: 5, r: 1 }, BEAM_Z, 4, P, 3, 0.4), { tone: "mid" });
  const beamDots = D([BED.x + 3, BED.x + BED.w - 3].map((x) => at([x, 0, BEAM_Z + 4])), { size: 0.45 });
  const carriage =
    S(k.cylinder(0, PEN_DY, 1, PAPER_Z, BEAM_Z - 5 - PAPER_Z, P, 12), { tone: "mid", crease: "none" }) +
    S(k.cylinder(0, PEN_DY, 1.5, PAPER_Z, 2.2, P, 16), { tone: "hi", lit: true, crease: "lo" }) +
    S(k.slabOf({ x: -5, y: 2.5, w: 10, d: 6.5, r: 1.2 }, BEAM_Z - 5, 10, P, 3, 0.5), { tone: "hi", crease: "lo", inner: L(k.sideSeam({ x: -5, y: 2.5, w: 10, d: 6.5, r: 1.2 }, BEAM_Z - 1, P, 3), { tone: "faint" }) }) +
    D([at([-3, 9, BEAM_Z + 2]), at([3, 9, BEAM_Z + 2])], { size: 0.4 });
  return `<g data-part="gantry" transform="${k.translateAlong(P, [0, Y0 + 0.5 * STEP - PEN_DY, 0])}">${uprights}${beam}${beamDots}<g data-part="carriage" transform="${k.translateAlong(P, [X0 + 0.5 * STEP, 0, 0])}">${carriage}</g></g>`;
}

// ── console ────────────────────────────────────────────────────────────────
function console_() {
  const z = CONSOLE_H;
  const out = [S(k.slabOf(CONSOLE, 0, CONSOLE_H, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(CONSOLE, 3.5, P, 4), { tone: "faint" }) })];
  // coverage knob
  const [cx, cy] = COV_KNOB;
  out.push(L(k.ring(cx, cy, 10, z, P, 56), { tone: "faint" }));
  out.push(L(COV_DETENTS.map((deg) => { const d = dirOf(deg); return k.lineOnTop([cx + d[0] * 10, cy + d[1] * 10], [cx + d[0] * 7.6, cy + d[1] * 7.6], z, P); }).join(""), { tone: "hi" }));
  const anchors = [["middle", 0], ["end", 2.8], ["start", -2.8], ["middle", 0]]; // keep the two middle labels apart
  COVERAGES.forEach((c, i) => { const d = dirOf(COV_DETENTS[i]); out.push(k.faceTextSvg(k.topMatrix([cx + d[0] * 17 + anchors[i][1], cy + d[1] * 17 + 1.4], z, P, "x"), c.label, { size: 3.4, tone: "mid", anchor: anchors[i][0] })); });
  out.push(S(k.cylinder(cx, cy, 6, z, 5, P, 40, 0.4), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(cx, cy, 6, z, z + 5, 40, P), { tone: "lo" }));
  out.push(`<path data-part="cov-pointer" class="iso-line" data-tone="hi" data-free="" d="${pointerOf(k, P, COV_KNOB, COV_DETENTS[0], 5, z + 5)}"/>`);
  out.push(k.faceTextSvg(k.topMatrix([cx, cy + 25], z, P, "x"), "coverage", { size: 3.6, tone: "mid", anchor: "middle" }));
  // line-by-line or EPI slide switch
  out.push(L(k.planOutline({ x: SWITCH_X - 1.5, y: SWITCH_Y.lines - 4, w: 3, d: SWITCH_Y.EPI - SWITCH_Y.lines + 8, r: 1.5 }, z, P, 3), { tone: "lo" }));
  out.push(`<g data-part="mode-switch" transform="${k.translateAlong(P, [0, SWITCH_Y.lines, 0])}">${S(k.slabOf({ x: SWITCH_X - 3, y: -3, w: 6, d: 6, r: 1.2 }, z, 3.5, P, 3, 0.4), { tone: "hi", crease: "lo" })}</g>`);
  out.push(k.faceTextSvg(k.topMatrix([SWITCH_X + 5, SWITCH_Y.lines + 1.4], z, P, "x"), "lines", { size: 3.4, tone: "mid" }));
  out.push(k.faceTextSvg(k.topMatrix([SWITCH_X + 5, SWITCH_Y.EPI + 1.4], z, P, "x"), "EPI", { size: 3.4, tone: "mid" }));
  // RF lamp: flashes at every excitation
  const [lx, ly] = RF_LAMP;
  out.push(S(k.cylinder(lx, ly, 4, z, 1.2, P, 24), { tone: "lo" }));
  out.push(S(k.cylinder(lx, ly, 2.8, z + 1.2, 1.4, P, 20), { tone: "mid" }));
  out.push(`<g data-part="rf-lamp" opacity="0">${S(k.cylinder(lx, ly, 2.8, z + 1.2, 1.4, P, 20), { tone: "hi", lit: true })}</g>`);
  out.push(k.faceTextSvg(k.topMatrix([lx, ly + 8.5], z, P, "x"), "RF", { size: 3.6, tone: "mid", anchor: "middle" }));
  // scan button
  const [bx, by] = SCAN_BUTTON;
  out.push(S(k.cylinder(bx, by, 6.5, z, 1.2, P, 32), { tone: "lo" }));
  out.push(`<g data-part="scan-button">${S(k.cylinder(bx, by, 4.6, z + 1.2, 3, P, 32, 0.4), { tone: "hi", crease: "lo" })}</g>`);
  out.push(k.faceTextSvg(k.topMatrix([bx, by + 11], z, P, "x"), "scan", { size: 3.6, tone: "mid", anchor: "middle" }));
  out.push(k.faceTextSvg(k.sideMatrix([CONSOLE.x + 6, CONSOLE.y + CONSOLE.d], 3.4, P, "left"), `${N} × ${N} · FOV ${N} mm`, { size: 4, tone: "mid" }));
  out.push(D(byDepth(k.corners(CONSOLE, 3)).map(([x, y]) => at([x, y, CONSOLE_H])), { size: 0.45 }));
  return out.join("");
}

// ── assemble ────────────────────────────────────────────────────────────────
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A gantry plotter on a bench. Its bed holds a square sheet of film, k-space, with kx running left to right and ky front to back. The pen sweeps along one line of kx at a time while the gantry steps through ky, exposing the film as it goes: bright in the middle, where the low spatial frequencies are, faint towards the edges. A lightbox shows the brain image reconstructed from whatever part of k-space has been exposed so far. A console sets which part of k-space is covered, switches between one line per excitation and a single echo-planar sweep, and flashes an RF lamp at every excitation.",
  body: [
    plate(),
    lightboxSvg(k, P, LBOX),
    bed(),
    gantry(),
    console_(),
  ],
});

const modelSource = readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "");

const live = `
${modelSource}
const pointerOf = ${pointerOf.toString()};
const P = ${JSON.stringify(P)};
const K = { lineOnTop };
const X0 = ${X0}, Y0 = ${Y0}, STEP = ${STEP}, PEN_DY = ${PEN_DY};
const COV_KNOB = ${JSON.stringify(COV_KNOB)}, COV_DETENTS = ${JSON.stringify(COV_DETENTS)}, KNOB_Z = ${CONSOLE_H + 5};
const SWITCH_Y = ${JSON.stringify(SWITCH_Y)};
const SLICE = ${JSON.stringify(SLICE)};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const q = (name) => svg.querySelector('[data-part="' + name + '"]');
const paperEl = q("paper"), filmEl = q("film-0"), gantry = q("gantry"), carriage = q("carriage");
const covPointer = q("cov-pointer"), modeSwitch = q("mode-switch"), rfLamp = q("rf-lamp"), scanButton = q("scan-button");
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ── the brain image and its k-space ───────────────────────────────────────
const F = makeFFT(N);
const base = new Float64Array(N * N);
{
  const un = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const gm = un(SLICE.gm), wm = un(SLICE.wm), csf = un(SLICE.csf);
  const r0 = Math.floor((N - SLICE.height) / 2), c0 = Math.floor((N - SLICE.width) / 2);
  for (let y = 0; y < SLICE.height; y++) for (let x = 0; x < SLICE.width; x++) {
    const p = y * SLICE.width + x;
    base[(y + r0) * N + x + c0] = (wm[p] * 1.0 + gm[p] * 0.84 + csf[p] * 0.45) / 255; // T1-weighted look
  }
}
const KS = kspaceOf(base, F);
let fullMax = 0;
for (let i = 0; i < N * N; i++) if (base[i] > fullMax) fullMax = base[i];
// k-space as film: log magnitude over four decades
const logK = new Float32Array(N * N);
{
  let top = 0;
  for (let i = 0; i < N * N; i++) top = Math.max(top, Math.hypot(KS.re[i], KS.im[i]));
  for (let i = 0; i < N * N; i++) logK[i] = Math.log10(1 + Math.hypot(KS.re[i], KS.im[i]) / (1e-4 * top)) / Math.log10(1 + 1e4);
}

const canvasOf = () => { const c = document.createElement("canvas"); c.width = N; c.height = N; return c; };
const paperCanvas = canvasOf(), filmCanvas = canvasOf();
const paperCtx = paperCanvas.getContext("2d"), filmCtx = filmCanvas.getContext("2d");
const paperData = paperCtx.createImageData(N, N), filmData = filmCtx.createImageData(N, N);
const BLANK = 14;

// ── scan state ─────────────────────────────────────────────────────────────
const want = { mode: "lines", cov: "full" };
let run = { ...want };
let rows = rowsOf(run.cov), rowIdx = 0, rowT = 0, lastC = -1, phase = "scan", hold = 0;
let acc = { re: new Float64Array(N * N), im: new Float64Array(N * N) };
let paperDirty = true, filmDirty = true, lastPaper = -1e9, lastFilm = -1e9, rfAt = -1e9, pressAt = -1e9;
let clock = 0, frame = 0, last = 0, visible = false, touring = !still.matches, idleTimer = 0, tourAt = 1, scrubbing = false;
let knobShown = 0, switchShown = SWITCH_Y.lines;
const TOUR = [
  { mode: "lines", cov: "full" }, { mode: "lines", cov: "centre" }, { mode: "lines", cov: "edges" },
  { mode: "lines", cov: "half" }, { mode: "EPI", cov: "full" }, { mode: "EPI", cov: "half" },
];
const HOLD = 2600;
const rowTime = () => (run.mode === "EPI" ? clamp(4000 / rows.length, 15, 90) : clamp(8000 / rows.length, 30, 170));

function clearPaper() {
  for (let i = 0; i < N * N; i++) { paperData.data[i * 4] = paperData.data[i * 4 + 1] = paperData.data[i * 4 + 2] = BLANK; paperData.data[i * 4 + 3] = 255; }
  paperDirty = true;
}
function expose(r, cFrom, cTo) {
  const a = Math.max(0, Math.min(cFrom, cTo)), b = Math.min(N - 1, Math.max(cFrom, cTo));
  for (let c = a; c <= b; c++) {
    if (!included(run.cov, r, c)) continue;
    const g = Math.round(BLANK + 236 * logK[r * N + c]);
    const p = (r * N + c) * 4;
    paperData.data[p] = paperData.data[p + 1] = paperData.data[p + 2] = g;
  }
  paperDirty = true;
}
function startScan() {
  run = { ...want };
  rows = rowsOf(run.cov);
  rowIdx = 0; rowT = 0; lastC = -1; phase = "scan"; hold = 0;
  acc = { re: new Float64Array(N * N), im: new Float64Array(N * N) };
  clearPaper();
  filmDirty = true;
  rfAt = clock;
}
function completeRow() {
  const r = rows[rowIdx];
  expose(r, 0, N - 1);
  addLine(KS, r, run.cov, acc, F);
  filmDirty = true;
  rowIdx += 1;
  lastC = -1;
  if (rowIdx >= rows.length) { phase = "hold"; hold = 0; }
  else if (run.mode === "lines") rfAt = clock; // a new excitation for every line
}
// where the pen is along the current line (0..N−1), and whether it is exposing
function penC() {
  if (run.mode === "EPI") { const forward = rowIdx % 2 === 0; return { c: (forward ? rowT : 1 - rowT) * (N - 1), on: true }; }
  if (rowT < 0.85) return { c: (rowT / 0.85) * (N - 1), on: true };
  return { c: (1 - (rowT - 0.85) / 0.15) * (N - 1), on: false }; // fly back for the next excitation
}

function renderFilm() {
  let top = 0;
  const mag = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) { mag[i] = Math.hypot(acc.re[i], acc.im[i]); if (mag[i] > top) top = mag[i]; }
  const win = Math.max(top, 0.25 * fullMax);
  for (let i = 0; i < N * N; i++) {
    const g = Math.round(255 * Math.min(1, mag[i] / win));
    filmData.data[i * 4] = filmData.data[i * 4 + 1] = filmData.data[i * 4 + 2] = g;
    filmData.data[i * 4 + 3] = 255;
  }
  filmCtx.putImageData(filmData, 0, 0);
  filmEl.setAttribute("href", filmCanvas.toDataURL());
}
function renderPaper() {
  paperCtx.putImageData(paperData, 0, 0);
  paperEl.setAttribute("href", paperCanvas.toDataURL());
}

function draw() {
  const r = rows[Math.min(rowIdx, rows.length - 1)];
  const pen = phase === "scan" ? penC() : { c: N - 1 };
  const x = X0 + (pen.c + 0.5) * STEP, y = Y0 + (r + 0.5) * STEP;
  gantry.setAttribute("transform", translateAlong(P, [0, y - PEN_DY, 0]));
  carriage.setAttribute("transform", translateAlong(P, [x, 0, 0]));
  rfLamp.setAttribute("opacity", Math.exp(-Math.max(0, clock - rfAt) / 120).toFixed(2));
  scanButton.setAttribute("transform", translateAlong(P, [0, 0, -1.6 * Math.exp(-Math.max(0, clock - pressAt) / 200)]));
  covPointer.setAttribute("d", pointerOf(K, P, COV_KNOB, COV_DETENTS[0] + knobShown * (COV_DETENTS[1] - COV_DETENTS[0]), 5, KNOB_Z));
  modeSwitch.setAttribute("transform", translateAlong(P, [0, switchShown, 0]));
  if (paperDirty && (clock - lastPaper > 70 || phase !== "scan")) { renderPaper(); paperDirty = false; lastPaper = clock; }
  if (filmDirty && (clock - lastFilm > 60 || phase !== "scan")) { renderFilm(); filmDirty = false; lastFilm = clock; }
  const cov = COVERAGES.find((c) => c.key === run.cov).label;
  const detail = run.cov === "half" ? "FOV " + fovOf(run.cov) + " mm" : (Math.round(resolutionOf(run.cov) * 10) / 10) + " mm";
  const ms = scanTimeOf(run.mode, run.cov);
  const time = run.mode === "EPI" ? (ms / 1000).toFixed(2) + " s" : Math.floor(ms / 60000) + ":" + String(Math.round((ms % 60000) / 1000)).padStart(2, "0");
  const text = run.mode + " · " + cov + " · " + detail + " · " + Math.min(rowIdx, rows.length) + "/" + rows.length + " lines · " + time;
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuetext", text);
}

function tick(stamp) {
  const dt = last ? Math.min(stamp - last, 50) : 16;
  last = stamp;
  clock += dt;
  const ease = 1 - Math.exp(-dt / 250);
  knobShown += (COVERAGES.findIndex((c) => c.key === want.cov) - knobShown) * ease;
  switchShown += (SWITCH_Y[want.mode] - switchShown) * ease;
  if (!scrubbing) {
    if (phase === "scan") {
      rowT += dt / rowTime();
      while (phase === "scan" && rowT >= 1) { rowT -= 1; completeRow(); }
      if (phase === "scan") {
        const pen = penC();
        if (pen.on) { const c = Math.round(pen.c); expose(rows[rowIdx], lastC < 0 ? c : lastC, c); lastC = c; }
      }
    } else {
      hold += dt;
      if (hold > HOLD && (touring || want.mode !== run.mode || want.cov !== run.cov)) {
        if (touring) Object.assign(want, TOUR[tourAt++ % TOUR.length]);
        startScan();
      }
    }
  }
  draw();
  frame = visible ? requestAnimationFrame(tick) : 0;
}

// jump straight to a number of acquired lines (scrubbing, keys, still frames)
function seek(n) {
  n = clamp(Math.round(n), 0, rows.length);
  if (n < rowIdx) { const keep = { ...run }; want.mode = keep.mode; want.cov = keep.cov; startScan(); }
  while (rowIdx < n) completeRow();
  if (rowIdx < rows.length) { phase = "scan"; rowT = 0; lastC = -1; }
  paperDirty = filmDirty = true;
  lastPaper = lastFilm = -1e9;
  draw();
}

const go = () => { if (!frame && visible && !still.matches) { last = 0; frame = requestAnimationFrame(tick); } };
function user() {
  touring = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { touring = !still.matches; scrubbing = false; }, 9000);
}
function choose(change) {
  user();
  scrubbing = false;
  Object.assign(want, change);
  pressAt = clock;
  startScan();
  if (still.matches) { knobShown = COVERAGES.findIndex((c) => c.key === want.cov); switchShown = SWITCH_Y[want.mode]; seek(rows.length); return; }
  go();
}
new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) go(); }, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("pointermove", (event) => {
  user();
  scrubbing = true;
  const box = svg.getBoundingClientRect();
  seek(clamp(((event.clientX - box.left) / box.width - 0.12) / 0.76, 0, 1) * rows.length);
  go();
});
stage.addEventListener("pointerleave", () => { scrubbing = false; });
stage.addEventListener("click", () => choose({}));
stage.addEventListener("keydown", (event) => {
  if (/^[1-4]$/.test(event.key)) choose({ cov: COVERAGES[Number(event.key) - 1].key });
  else if (event.key === "e" || event.key === "E") choose({ mode: want.mode === "lines" ? "EPI" : "lines" });
  else if (event.key === "Enter" || event.key === " ") choose({});
  else if (event.key === "ArrowRight" || event.key === "ArrowLeft") { user(); scrubbing = true; seek(rowIdx + (event.key === "ArrowRight" ? 16 : -16)); go(); }
  else return;
  event.preventDefault();
});
startScan();
if (still.matches) seek(rows.length);
else { renderPaper(); renderFilm(); draw(); }
`;

const body = k.plateHtml({
  fig: "Fig 7",
  title: "k-space plotter",
  hint: "Hover to scrub · keys 1–4, E",
  readout: `lines · full · 1 mm · 0/${N} lines · 2:08`,
  keys: [
    { mark: "flat", label: "Film on the bed: k-space (log magnitude), kx across, ky front to back; bright centre = low spatial frequencies" },
    { mark: "lit", label: "Pen: the current k-space point; the readout gradient sweeps it along kx, phase encoding steps it in ky" },
    { mark: "raised", label: "Console: coverage (full, centre, edges, every other line), line by line or EPI, RF lamp at each excitation" },
    { mark: "edge", label: `Lightbox: the inverse Fourier transform of what has been acquired so far (MNI152 slice z = +${SLICE.z} mm in a ${N} mm field of view)` },
  ],
  caption:
    `The scanner does not record pixels. With gradients on, each moment of the readout samples one spatial frequency of the whole slice, a point in k-space; the readout gradient sweeps along kx and each phase-encoding step moves to a new line in ky. The image is the two-dimensional inverse Fourier transform of k-space, computed live here from a ${N} × ${N} matrix (1 mm pixels, ${N} mm field of view). ` +
    `Every point of k-space contributes to every pixel. The centre of k-space holds the coarse brightness, the contrast; the edges hold the fine detail. Keeping only the central ${2 * CENTRE} × ${2 * CENTRE} points gives the right contrast at ${resolutionOf("centre").toFixed(1)} mm resolution, with ringing at sharp edges; keeping only the edges leaves outlines. The spacing of the lines sets the field of view (FOV = 1/Δk): keeping every other line halves the FOV to ${N / 2} mm, and anything outside it wraps around onto the other side of the image. ` +
    `Line by line, as in conventional spin-echo and gradient-echo imaging, each line needs its own excitation, so ${N} lines at a TR of ${TR_MS} ms take ${(scanTimeOf("lines", "full") / 60000).toFixed(1)} minutes. Echo-planar imaging (EPI) zig-zags through every line after a single excitation, about ${ESP_MS} ms per line, so the whole slice takes ${scanTimeOf("EPI", "full")} ms: fast enough for fMRI and diffusion, at the cost of distortion and ghosting where the field is uneven (not modelled here). ` +
    `The plotter runs far slower than a scanner. The k-space shown is the Fourier transform of the synthetic slice itself, not measured data. ` +
    MNI_NOTICE,
  body: `<div class="iso-stage" tabindex="0" role="application" aria-roledescription="k-space plotter" aria-label="k-space plotter: keys 1 to 4 choose full, centre, edges or every other line; E switches between line-by-line and EPI; Enter starts a new scan; left and right arrows step through the lines">${svg}</div>`,
});

writeFileSync(join(HERE, OUT), k.pageHtml({ title: "k-space plotter", theme, body, script: kitScript() + live }));
console.log("wrote", OUT);
