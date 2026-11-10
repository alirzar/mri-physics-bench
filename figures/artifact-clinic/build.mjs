// Fig 8 — Artifact clinic: the k-space plotter with faults switched in from a fault panel.
// node build.mjs            → artifact-clinic.html (dark)
// node build.mjs --light    → artifact-clinic-light.html
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../_anatomy/kit/iso-kit.mjs";
import { kitScript } from "../_anatomy/scripts/inline-kit.mjs";
import { N, ESP_MS, TR_MS } from "../kspace-plotter/model.mjs";
import { FAULTS, SPIKE, MOTION, TRUNC, GHOST, WARP, BW_PE } from "./model.mjs";
import { loadSlice, lightboxGeometry, lightboxSvg, MNI_NOTICE } from "../_shared/lightbox.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const OUT = theme === "light" ? "artifact-clinic-light.html" : "artifact-clinic.html";

const WIDTH = 600;
const HEIGHT = 400;

// ── world layout (the plotter as in Fig 7) ─────────────────────────────────
const PLATE = { x: -150, y: -110, w: 300, d: 198, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;
const BED = { x: -134, y: -94, w: 148, d: 148, r: 3 };
const BED_H = 10;
const X0 = -124;
const Y0 = -84;
const SIZE = 128;
const PAPER_Z = BED_H + 0.4;
const STEP = SIZE / N;
const RAIL_H = 3;
const PEN_DY = 5.5;
const BEAM_Z = BED_H + RAIL_H + 19;
const RAILS = [BED.x + 1, BED.x + BED.w - 5];
const penY = (r) => Y0 + (r + 0.5) * STEP;
const penX = (c) => X0 + (c + 0.5) * STEP;

// end stops: parked at the rail and beam ends, or closed in so the pen cannot leave the central 64 × 64
const STOP_OFF = { back: BED.y + 5, front: BED.y + BED.d - 5, left: BED.x + 9, right: BED.x + BED.w - 9 };
const STOP_ON = {
  back: penY(N / 2 - TRUNC) - PEN_DY - 4 - 3,
  front: penY(N / 2 + TRUNC - 1) - PEN_DY + 4 + 3,
  left: penX(N / 2 - TRUNC) - 5 - 1.5,
  right: penX(N / 2 + TRUNC - 1) + 5 + 1.5,
};

// spark gap beside the bed (the spike), subject sled with a cam (motion), field magnet (EPI warp)
const SPARK = [27, -10];
const SLED = { x: -114, y: 61, w: 24, d: 22, r: 2 };
const SLED_RAILS = [-112, -97];
const CAM = [-103, 57.5];
const MAGNET = { x: -84, y: 64, w: 10, d: 16, r: 1.5 }; // where it sits when the warp fault is on
const MAGNET_AWAY = 16;
const MOTION_SHOWN = 0.4; // the sled's swing is drawn this many units per mm of motion (exaggerated)

// fault panel: six toggle switches with lamps
const PANEL = { x: 34, y: 14, w: 106, d: 60, r: 3 };
const PANEL_H = 9;
const SWITCHES = FAULTS.map((f, i) => ({ ...f, at: [50 + (i % 3) * 34, 30 + Math.floor(i / 3) * 26] }));

const SLICE = loadSlice();
const LBOX = lightboxGeometry({ x: 40, y: -100, w: 104, d: 12, r: 2 }, { width: 1, height: 1 }, { top: 124 });

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [BED.x, BED.y, BEAM_Z + 8], [BED.x + BED.w, BED.y + BED.d, BEAM_Z + 8], [LBOX.LB.x + LBOX.LB.w, LBOX.LB.y, LBOX.top]],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: 55 },
);

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (pts) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

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

// ── plotter bed with film, rulers, rails and the sliding end stops ─────────
function bed() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BED, 0, 0.1, P)}" style="filter:blur(4px)"/>`];
  out.push(S(k.slabOf(BED, 0, BED_H, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(BED, 3.5, P, 4), { tone: "faint" }) }));
  out.push(S(k.slabOf({ x: X0, y: Y0, w: SIZE, d: SIZE, r: 0 }, BED_H, 0.4, P, 1), { tone: "lo", crease: "none" }));
  out.push(`<image data-part="paper" x="0" y="0" width="${SIZE}" height="${SIZE}" preserveAspectRatio="none" style="image-rendering:pixelated" transform="${k.topMatrix([X0, Y0], PAPER_Z, P, "x")}" href=""/>`);
  const mid = penX(N / 2), midY = penY(N / 2);
  out.push(L(k.lineOnTop([X0, midY], [X0 + SIZE, midY], PAPER_Z, P) + k.lineOnTop([mid, Y0], [mid, Y0 + SIZE], PAPER_Z, P), { tone: "faint" }));
  out.push(L(k.planOutline({ x: X0, y: Y0, w: SIZE, d: SIZE, r: 0 }, PAPER_Z, P, 1), { tone: "lo" }));
  for (const [cx, cy] of byDepth([[X0, Y0], [X0 + SIZE, Y0], [X0, Y0 + SIZE], [X0 + SIZE, Y0 + SIZE]])) {
    out.push(S(k.slabOf({ x: cx - 3, y: cy - 3, w: 6, d: 6, r: 1 }, PAPER_Z, 1.2, P, 2, 0.3), { tone: "mid" }));
    out.push(D([at([cx, cy, PAPER_Z + 1.2])], { size: 0.4 }));
  }
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
  for (const x of RAILS) {
    const rail = { x, y: BED.y + 2, w: 4, d: BED.d - 4, r: 0.8 };
    out.push(S(k.slabOf(rail, BED_H, RAIL_H, P, 2, 0.3), { tone: "mid" }));
  }
  // rail stops, built at y = 0 and slid into place
  for (const side of ["back", "front"]) {
    const blocks = RAILS.map((x) => S(k.slabOf({ x: x - 0.5, y: -3, w: 5, d: 6, r: 0.8 }, BED_H + RAIL_H, 3.2, P, 2, 0.3), { tone: "hi", crease: "lo" })).join("");
    out.push(`<g data-part="stop-${side}" transform="${k.translateAlong(P, [0, STOP_OFF[side], 0])}">${blocks}</g>`);
  }
  out.push(k.faceTextSvg(k.sideMatrix([X0 + 76, BED.y + BED.d], 3.4, P, "left"), "kx · readout →", { size: 4.2, tone: "mid" }));
  out.push(k.faceTextSvg(k.sideMatrix([BED.x + BED.w, Y0 + SIZE - 10], 3.4, P, "right"), "ky · phase encoding →", { size: 4.2, tone: "mid" }));
  return out.join("");
}

function gantry() {
  const z0 = BED_H + RAIL_H;
  const uprights = [BED.x, BED.x + BED.w - 6].map((x) => S(k.slabOf({ x, y: -4, w: 6, d: 8, r: 1 }, z0, BEAM_Z - z0, P, 2, 0.4), { tone: "mid", inner: L(k.sideSeam({ x, y: -4, w: 6, d: 8, r: 1 }, z0 + 6, P, 2), { tone: "faint" }) })).join("");
  const beam = S(k.slabOf({ x: BED.x, y: -2.5, w: BED.w, d: 5, r: 1 }, BEAM_Z, 4, P, 3, 0.4), { tone: "mid" });
  const beamStops = ["left", "right"].map((side) => `<g data-part="stop-${side}" transform="${k.translateAlong(P, [STOP_OFF[side], 0, 0])}">${S(k.slabOf({ x: -1.5, y: -3, w: 3, d: 6, r: 0.6 }, BEAM_Z + 4, 3, P, 2, 0.3), { tone: "hi", crease: "lo" })}</g>`).join("");
  const carriage =
    S(k.cylinder(0, PEN_DY, 1, PAPER_Z, BEAM_Z - 5 - PAPER_Z, P, 12), { tone: "mid", crease: "none" }) +
    S(k.cylinder(0, PEN_DY, 1.5, PAPER_Z, 2.2, P, 16), { tone: "hi", lit: true, crease: "lo" }) +
    S(k.slabOf({ x: -5, y: 2.5, w: 10, d: 6.5, r: 1.2 }, BEAM_Z - 5, 10, P, 3, 0.5), { tone: "hi", crease: "lo" }) +
    D([at([-3, 9, BEAM_Z + 2]), at([3, 9, BEAM_Z + 2])], { size: 0.4 });
  return `<g data-part="gantry" transform="${k.translateAlong(P, [0, penY(0) - PEN_DY, 0])}">${uprights}${beam}${beamStops}<g data-part="carriage" transform="${k.translateAlong(P, [penX(0), 0, 0])}">${carriage}</g></g>`;
}

// ── props ──────────────────────────────────────────────────────────────────
function sparkGap() {
  const [x, y] = SPARK;
  const base = { x: x - 8, y: y - 6, w: 16, d: 12, r: 2 };
  const out = [S(k.slabOf(base, 0, 2, P, 3, 0.4), { tone: "lo" })];
  for (const px of [x - 4, x + 4]) {
    out.push(S(k.cylinder(px, y, 1, 2, 11, P, 12), { tone: "mid", crease: "none" }));
    out.push(S(k.cylinder(px, y, 1.9, 13, 2.6, P, 18, 0.3), { tone: "hi", crease: "lo" }));
  }
  const zig = [[x - 2.1, y, 14.3], [x - 0.8, y, 15.8], [x + 0.3, y, 13.4], [x + 1.2, y, 15.4], [x + 2.1, y, 14.3]];
  out.push(`<g data-part="spark" opacity="0">${L(k.pathOf(zig.map((p) => at(p))), { tone: "lit" })}</g>`);
  out.push(k.faceTextSvg(k.sideMatrix([base.x + 2, base.y + base.d], 0.5, P, "left"), "static", { size: 3, tone: "mid" }));
  return out.join("");
}

function subjectStage() {
  const out = [];
  for (const x of SLED_RAILS) out.push(S(k.slabOf({ x, y: 56, w: 3, d: 30, r: 0.6 }, 0, 2, P, 2, 0.3), { tone: "lo" }));
  const [cx, cy] = CAM;
  out.push(S(k.cylinder(cx, cy, 3, 0, 4, P, 24, 0.3), { tone: "mid" }));
  out.push(`<g data-part="cam-pin"></g>`);
  const film = { x: SLED.x + 2, y: SLED.y + 1, w: 20, d: 20 };
  const sled =
    S(k.slabOf(SLED, 2, 3, P, 3, 0.4), { tone: "mid" }) +
    `<image data-part="truth" x="0" y="0" width="${film.w}" height="${film.d}" preserveAspectRatio="none" transform="${k.topMatrix([film.x, film.y], 5.1, P, "x")}" href=""/>` +
    L(k.planOutline({ ...film, r: 0 }, 5.1, P, 1), { tone: "lo" }) +
    D([at([SLED.x + 1.2, SLED.y + SLED.d - 1, 5]), at([SLED.x + SLED.w - 1.2, SLED.y + SLED.d - 1, 5])], { size: 0.4 });
  out.push(`<g data-part="sled">${sled}</g>`);
  return out.join("");
}

function magnet() {
  const top = 9;
  const body =
    S(k.slabOf(MAGNET, 0, top, P, 2, 0.5), { tone: "mid", inner: L(k.sideSeam(MAGNET, 4.5, P, 2), { tone: "faint" }) }) +
    `<g data-part="magnet-glow" opacity="0">${S(k.slabOf(k.insetPlan(MAGNET, 2), top, 0.6, P, 2), { tone: "hi", lit: true, crease: "none" })}</g>` +
    k.faceTextSvg(k.topMatrix([MAGNET.x + MAGNET.w / 2, MAGNET.y + MAGNET.d / 2 + 2], top, P, "x"), "N", { size: 5, tone: "mid", anchor: "middle" });
  return `<g data-part="magnet" transform="${k.translateAlong(P, [MAGNET_AWAY, 0, 0])}">${body}</g>`;
}

// ── fault panel ────────────────────────────────────────────────────────────
function faultPanel() {
  const z = PANEL_H;
  const out = [S(k.slabOf(PANEL, 0, PANEL_H, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(PANEL, 3.5, P, 4), { tone: "faint" }) })];
  for (const s of SWITCHES) {
    const [x, y] = s.at;
    out.push(S(k.slabOf({ x: x - 6, y: y - 6, w: 12, d: 12, r: 1.5 }, z, 1.2, P, 2, 0.3), { tone: "lo" }));
    out.push(L(k.planOutline({ x: x - 1.4, y: y - 4.5, w: 2.8, d: 9, r: 1.4 }, z + 1.2, P, 3), { tone: "lo" }));
    out.push(`<g data-part="switch-${s.key}" transform="${k.translateAlong(P, [0, -2.5, 0])}">${S(k.slabOf({ x: x - 2.4, y: y - 2.4, w: 4.8, d: 4.8, r: 1 }, z + 1.2, 3.4, P, 2, 0.3), { tone: "hi", crease: "lo" })}</g>`);
    out.push(S(k.cylinder(x + 10, y - 3, 2.6, z, 1, P, 20), { tone: "lo" }));
    out.push(S(k.cylinder(x + 10, y - 3, 1.8, z + 1, 1.2, P, 18), { tone: "mid" }));
    out.push(`<g data-part="lamp-${s.key}" opacity="0">${S(k.cylinder(x + 10, y - 3, 1.8, z + 1, 1.2, P, 18), { tone: "hi", lit: true })}</g>`);
    out.push(k.faceTextSvg(k.topMatrix([x + 2, y + 11.5], z, P, "x"), s.label, { size: 3.4, tone: "mid", anchor: "middle" }));
  }
  out.push(k.faceTextSvg(k.sideMatrix([PANEL.x + 6, PANEL.y + PANEL.d], 3.4, P, "left"), "fault panel · 1–6", { size: 4, tone: "mid" }));
  out.push(D(byDepth(k.corners(PANEL, 3)).map(([x, y]) => at([x, y, PANEL_H])), { size: 0.45 }));
  return out.join("");
}

// ── assemble ────────────────────────────────────────────────────────────────
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "The k-space plotter of Fig 7 on a repair bench, with a fault panel of six toggle switches. A spark gap beside the bed can corrupt one k-space sample; a cam can jiggle the subject's sled between lines; end stops can slide in on the rails and beam so the pen never reaches outer k-space; the gantry can skip every other line; EPI's left- and right-going lines can be misaligned; and a magnet can slide up to the subject and bend the field. The film shows the k-space actually recorded and the lightbox shows the image reconstructed from it, with the artifact each fault causes.",
  body: [
    plate(),
    lightboxSvg(k, P, LBOX),
    bed(),
    sparkGap(),
    gantry(),
    subjectStage(),
    magnet(),
    faultPanel(),
  ],
});

const strip = (src) => src.replace(/^import .*$/gm, "").replace(/^export /gm, "");
const modelSource = strip(readFileSync(join(HERE, "..", "kspace-plotter", "model.mjs"), "utf8")) + "\n" + strip(readFileSync(join(HERE, "model.mjs"), "utf8"));

const live = `
${modelSource}
const P = ${JSON.stringify(P)};
const X0 = ${X0}, Y0 = ${Y0}, STEP = ${STEP}, PEN_DY = ${PEN_DY};
const STOP_OFF = ${JSON.stringify(STOP_OFF)}, STOP_ON = ${JSON.stringify(STOP_ON)};
const CAM = ${JSON.stringify(CAM)}, MAGNET_AWAY = ${MAGNET_AWAY}, MOTION_SHOWN = ${MOTION_SHOWN};
const SLICE = ${JSON.stringify(SLICE)};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const q = (name) => svg.querySelector('[data-part="' + name + '"]');
const paperEl = q("paper"), filmEl = q("film-0"), truthEl = q("truth"), gantry = q("gantry"), carriage = q("carriage");
const stops = { back: q("stop-back"), front: q("stop-front"), left: q("stop-left"), right: q("stop-right") };
const sparkEl = q("spark"), sled = q("sled"), camPin = q("cam-pin"), magnetEl = q("magnet"), magnetGlow = q("magnet-glow");
const switches = Object.fromEntries(FAULTS.map((f) => [f.key, { lever: q("switch-" + f.key), lamp: q("lamp-" + f.key), shown: 0 }]));
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const penY = (r) => Y0 + (r + 0.5) * STEP, penX = (c) => X0 + (c + 0.5) * STEP;

// ── the subject, its k-space, and its k-space seen through an uneven field ──
const F = makeFFT(N);
const base = new Float64Array(N * N);
{
  const un = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const gm = un(SLICE.gm), wm = un(SLICE.wm), csf = un(SLICE.csf);
  const r0 = Math.floor((N - SLICE.height) / 2), c0 = Math.floor((N - SLICE.width) / 2);
  for (let y = 0; y < SLICE.height; y++) for (let x = 0; x < SLICE.width; x++) {
    const p = y * SLICE.width + x;
    base[(y + r0) * N + x + c0] = (wm[p] * 1.0 + gm[p] * 0.84 + csf[p] * 0.45) / 255;
  }
}
const K0 = kspaceOf(base, F);
const KW = kspaceOf(warp(base), F);
let fullMax = 0, kTop = 0;
for (let i = 0; i < N * N; i++) { if (base[i] > fullMax) fullMax = base[i]; kTop = Math.max(kTop, Math.hypot(K0.re[i], K0.im[i])); }

const canvasOf = () => { const c = document.createElement("canvas"); c.width = N; c.height = N; return c; };
const paperCanvas = canvasOf(), filmCanvas = canvasOf(), truthCanvas = canvasOf();
const paperCtx = paperCanvas.getContext("2d"), filmCtx = filmCanvas.getContext("2d");
const paperData = paperCtx.createImageData(N, N), filmData = filmCtx.createImageData(N, N);
{
  const ctx = truthCanvas.getContext("2d"), data = ctx.createImageData(N, N);
  for (let i = 0; i < N * N; i++) { const g = Math.round(255 * Math.min(1, base[i] / fullMax)); data.data[i * 4] = data.data[i * 4 + 1] = data.data[i * 4 + 2] = g; data.data[i * 4 + 3] = 255; }
  ctx.putImageData(data, 0, 0);
  truthEl.setAttribute("href", truthCanvas.toDataURL());
}
const BLANK = 14;

// ── scan state ─────────────────────────────────────────────────────────────
const want = {};
let on = {}, epi = false, rows = [], Ka = null, logK = new Float32Array(N * N);
let rowIdx = 0, rowT = 0, lastC = -1, phase = "scan", hold = 0;
let acc = null;
let paperDirty = true, filmDirty = true, lastPaper = -1e9, lastFilm = -1e9, sparkAt = -1e9;
let clock = 0, frame = 0, last = 0, visible = false, touring = !still.matches, idleTimer = 0, tourAt = 1, scrubbing = false;
const shown = { stops: 0, magnet: 0, sled: 0 };
const TOUR = [{}, { spike: true }, { motion: true }, { trunc: true }, { fov: true }, { ghost: true }, { warp: true }, { motion: true, ghost: true }];
const HOLD = 2600;
const rowTime = () => (epi ? clamp(3500 / rows.length, 12, 90) : clamp(6000 / rows.length, 22, 120));

function startScan() {
  on = { ...want };
  epi = isEpi(on);
  rows = rowsFor(on);
  Ka = corrupt(on.warp ? KW : K0, on, rows, epi);
  for (let i = 0; i < N * N; i++) logK[i] = Math.log10(1 + Math.hypot(Ka.re[i], Ka.im[i]) / (1e-4 * kTop)) / Math.log10(1 + 1e4);
  rowIdx = 0; rowT = 0; lastC = -1; phase = "scan"; hold = 0;
  acc = { re: new Float64Array(N * N), im: new Float64Array(N * N) };
  for (let i = 0; i < N * N; i++) { paperData.data[i * 4] = paperData.data[i * 4 + 1] = paperData.data[i * 4 + 2] = BLANK; paperData.data[i * 4 + 3] = 255; }
  paperDirty = filmDirty = true;
}
function expose(r, cFrom, cTo) {
  const a = Math.max(0, Math.min(cFrom, cTo)), b = Math.min(N - 1, Math.max(cFrom, cTo));
  for (let c = a; c <= b; c++) {
    if (!keep(on, r, c)) continue;
    const g = Math.round(BLANK + 236 * Math.min(1, logK[r * N + c]));
    const p = (r * N + c) * 4;
    paperData.data[p] = paperData.data[p + 1] = paperData.data[p + 2] = g;
  }
  paperDirty = true;
}
function completeRow() {
  const r = rows[rowIdx];
  expose(r, 0, N - 1);
  addFaultyLine(Ka, r, rowIdx, on, epi, acc, F);
  if (on.spike && r === SPIKE.r) sparkAt = clock;
  filmDirty = true;
  rowIdx += 1;
  lastC = -1;
  if (rowIdx >= rows.length) { phase = "hold"; hold = 0; }
}
// the pen's sweep along a line: the whole line, or only the central block when the end stops are in
function penC() {
  const lo = on.trunc ? N / 2 - TRUNC : 0, span = (on.trunc ? N / 2 + TRUNC - 1 : N - 1) - lo;
  if (epi) { const forward = rowIdx % 2 === 0; return { c: lo + (forward ? rowT : 1 - rowT) * span, on: true }; }
  if (rowT < 0.85) return { c: lo + (rowT / 0.85) * span, on: true };
  return { c: lo + (1 - (rowT - 0.85) / 0.15) * span, on: false };
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
  const pen = phase === "scan" ? penC() : { c: N / 2 };
  const c = pen.c;
  gantry.setAttribute("transform", translateAlong(P, [0, penY(r) - PEN_DY, 0]));
  carriage.setAttribute("transform", translateAlong(P, [penX(c), 0, 0]));
  for (const side of ["back", "front"]) stops[side].setAttribute("transform", translateAlong(P, [0, STOP_OFF[side] + (STOP_ON[side] - STOP_OFF[side]) * shown.stops, 0]));
  for (const side of ["left", "right"]) stops[side].setAttribute("transform", translateAlong(P, [STOP_OFF[side] + (STOP_ON[side] - STOP_OFF[side]) * shown.stops, 0, 0]));
  sparkEl.setAttribute("opacity", Math.exp(-Math.max(0, clock - sparkAt) / 260).toFixed(2));
  const line = Math.min(rowIdx, rows.length - 1);
  const swing = on.motion && !epi && phase === "scan" ? shiftAt(line + rowT) * MOTION_SHOWN : 0;
  shown.sled += (swing - shown.sled) * 0.5;
  sled.setAttribute("transform", translateAlong(P, [0, shown.sled, 0]));
  const angle = (2 * Math.PI * (line + rowT)) / MOTION.period;
  camPin.innerHTML = solidSvg(cylinder(CAM[0] + 1.7 * Math.cos(angle), CAM[1] + 1.7 * Math.sin(angle), 0.8, 4, 2.2, P, 12), { tone: "hi", crease: "lo" });
  magnetEl.setAttribute("transform", translateAlong(P, [MAGNET_AWAY * (1 - shown.magnet), 0, 0]));
  magnetGlow.setAttribute("opacity", shown.magnet.toFixed(2));
  for (const f of FAULTS) {
    const s = switches[f.key];
    s.lever.setAttribute("transform", translateAlong(P, [0, -2.5 + 5 * s.shown, 0]));
    s.lamp.setAttribute("opacity", s.shown.toFixed(2));
  }
  if (paperDirty && (clock - lastPaper > 70 || phase !== "scan")) { renderPaper(); paperDirty = false; lastPaper = clock; }
  if (filmDirty && (clock - lastFilm > 60 || phase !== "scan")) { renderFilm(); filmDirty = false; lastFilm = clock; }
  const active = FAULTS.filter((f) => on[f.key]);
  let what = "no faults";
  if (active.length === 1) what = active[0].label + " → " + (active[0].key === "motion" && epi ? "frozen by EPI" : active[0].effect);
  else if (active.length > 1) what = active.map((f) => f.label + (f.key === "motion" && epi ? " (frozen)" : "")).join(" + ");
  const text = (epi ? "EPI" : "lines") + " · " + what + " · " + Math.min(rowIdx, rows.length) + "/" + rows.length;
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuetext", text);
}

function tick(stamp) {
  const dt = last ? Math.min(stamp - last, 50) : 16;
  last = stamp;
  clock += dt;
  const ease = 1 - Math.exp(-dt / 250);
  shown.stops += ((on.trunc ? 1 : 0) - shown.stops) * ease;
  shown.magnet += ((on.warp ? 1 : 0) - shown.magnet) * ease;
  for (const f of FAULTS) switches[f.key].shown += ((want[f.key] ? 1 : 0) - switches[f.key].shown) * ease;
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
      if (hold > HOLD) {
        if (touring) { for (const key of Object.keys(want)) delete want[key]; Object.assign(want, TOUR[tourAt++ % TOUR.length]); }
        startScan();
      }
    }
  }
  draw();
  frame = visible ? requestAnimationFrame(tick) : 0;
}

function seek(n) {
  n = clamp(Math.round(n), 0, rows.length);
  if (n < rowIdx) { const keepOn = { ...on }; for (const key of Object.keys(want)) delete want[key]; Object.assign(want, keepOn); startScan(); }
  while (rowIdx < n) completeRow();
  if (rowIdx < rows.length) { phase = "scan"; rowT = 0; lastC = -1; }
  paperDirty = filmDirty = true;
  lastPaper = lastFilm = -1e9;
  draw();
}
function settleProps() {
  shown.stops = on.trunc ? 1 : 0;
  shown.magnet = on.warp ? 1 : 0;
  for (const f of FAULTS) switches[f.key].shown = want[f.key] ? 1 : 0;
}

const go = () => { if (!frame && visible && !still.matches) { last = 0; frame = requestAnimationFrame(tick); } };
function user() {
  touring = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { touring = !still.matches; scrubbing = false; }, 10000);
}
function apply() {
  user();
  scrubbing = false;
  startScan();
  if (still.matches) { settleProps(); seek(rows.length); return; }
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
stage.addEventListener("click", apply);
stage.addEventListener("keydown", (event) => {
  if (/^[1-6]$/.test(event.key)) { const key = FAULTS[Number(event.key) - 1].key; want[key] = !want[key]; apply(); }
  else if (event.key === "0") { for (const key of Object.keys(want)) delete want[key]; apply(); }
  else if (event.key === "Enter" || event.key === " ") apply();
  else if (event.key === "ArrowRight" || event.key === "ArrowLeft") { user(); scrubbing = true; seek(rowIdx + (event.key === "ArrowRight" ? 16 : -16)); go(); }
  else return;
  event.preventDefault();
});
startScan();
if (still.matches) { Object.assign(want, { spike: true }); startScan(); settleProps(); seek(rows.length); }
else { renderPaper(); renderFilm(); draw(); }
`;

const body = k.plateHtml({
  fig: "Fig 8",
  title: "Artifact clinic",
  hint: "Keys 1–6 · hover to scrub",
  readout: `lines · no faults · 0/${N}`,
  keys: [
    { mark: "raised", label: "Fault panel: spike, motion, truncated, small FOV, EPI ghost, EPI warp (keys 1–6, 0 clears; faults combine)" },
    { mark: "lit", label: "Props: spark gap (spike), cam under the subject's sled (motion), end stops on the rails and beam (truncation), magnet (field)" },
    { mark: "flat", label: "Film: the k-space actually recorded · sled: the true subject" },
    { mark: "edge", label: `Lightbox: the image reconstructed from the recorded k-space (MNI152 slice z = +${SLICE.z} mm)` },
  ],
  caption:
    `Every MRI artifact starts as a fault in k-space. ` +
    `Spike: one corrupt sample, often a static discharge in the scanner room, adds a single spatial frequency to the whole image, so stripes cross everything, outside the head as well (here ${Math.round(SPIKE.size * 100)}% of the k = 0 value, at kx = ${SPIKE.c - N / 2}, ky = ${SPIKE.r - N / 2}). ` +
    `Motion: when the head moves between lines, each line is recorded from a slightly different position; repeating motion (here ${MOTION.amp} mm every ${MOTION.period} lines, the sled's swing drawn exaggerated) leaves ghosts copied along the phase-encoding direction, never along the readout, because each readout takes only milliseconds. ` +
    `Truncation: stopping at the central ${2 * TRUNC} × ${2 * TRUNC} points leaves out the fine detail, and the sharp edges ring (Gibbs). ` +
    `Small field of view: every other line halves the field of view and the head wraps onto itself. ` +
    `EPI ghost: in echo-planar imaging every other line is read in the opposite direction; a timing mismatch between the two (here ${GHOST.delay} samples and ${GHOST.phase} rad) makes a ghost shifted by half the field of view, the Nyquist or N/2 ghost. ` +
    `EPI warp: EPI collects so slowly along phase encoding (${BW_PE.toFixed(1)} Hz per pixel at ${ESP_MS} ms per line) that a small field offset moves tissue: here an illustrative ${Math.abs(WARP.peak)} Hz offset near the frontal pole, as an air-filled sinus would cause, shifts it by up to ${(Math.abs(WARP.peak) / BW_PE).toFixed(0)} mm, stretching and squashing the image. ` +
    `EPI collects a whole slice in about ${Math.round(N * ESP_MS)} ms, so it freezes the motion that line-by-line imaging (${TR_MS} ms per line here) smears into ghosts: switch on motion and an EPI fault together and the motion ghosts vanish. ` +
    `All artifacts are computed by Fourier transform from the synthetic slice; their sizes are chosen to be clearly visible. ` +
    MNI_NOTICE,
  body: `<div class="iso-stage" tabindex="0" role="application" aria-roledescription="artifact clinic" aria-label="Artifact clinic: keys 1 to 6 switch spike, motion, truncation, small field of view, EPI ghost and EPI warp on and off; 0 clears all faults; Enter starts a new scan; left and right arrows step through the lines">${svg}</div>`,
});

writeFileSync(join(HERE, OUT), k.pageHtml({ title: "Artifact clinic", theme, body, script: kitScript() + live }));
console.log("wrote", OUT);
