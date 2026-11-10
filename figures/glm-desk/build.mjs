// Fig 11 — GLM desk: fit a voxel's time course, then threshold the whole map and count false positives.
// node build.mjs            → glm-desk.html (dark)
// node build.mjs --light    → glm-desk-light.html
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../_anatomy/kit/iso-kit.mjs";
import { kitScript } from "../_anatomy/scripts/inline-kit.mjs";
import { SCANS, TR, RUN_S, BLOCKS, RULES, upperTail } from "./model.mjs";
import { makeMap, VOX, FWHM, REAL } from "./map.mjs";
import { loadSlice, lightboxGeometry, lightboxSvg, MNI_NOTICE } from "../_shared/lightbox.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const OUT = theme === "light" ? "glm-desk-light.html" : "glm-desk.html";

const WIDTH = 600;
const HEIGHT = 400;

// ── data ────────────────────────────────────────────────────────────────────
const SLICE = loadSlice();
const MAP = makeMap(SLICE);
const VOXELS = [
  { key: "v1", label: "V1 voxel", q: MAP.v1q, y: MAP.v1Course, fit: MAP.v1Fit },
  { key: "fp", label: "frontal voxel", q: MAP.fpq, y: MAP.fpCourse, fit: MAP.fpFit },
];

// ── world layout ────────────────────────────────────────────────────────────
const PLATE = { x: -150, y: -110, w: 300, d: 198, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

// recorder at the back left: the voxel's time course, the model and the residuals
const REC_BASE = { x: -146, y: -52, w: 168, d: 22, r: 3 };
const REC_BASE_H = 6;
const BOARD = { x: -144, y: -48, w: 164, d: 6, r: 1 };
const BOARD_TOP = 74;
const FACE_Y = BOARD.y + BOARD.d;
const PAPER = { x: -140, w: 156, z0: 10, z1: 68 };
const PAPER_Y = FACE_Y + 0.4;
const TX0 = -126;
const KT = 0.875; // units per second
const Y0 = 36; // 0 % signal change
const YK = 9; // units per 1 %
const DESIGN_Z = 13;

// lightbox at the back right: the thresholded z map
const LBOX = lightboxGeometry({ x: 40, y: -100, w: 104, d: 12, r: 2 }, SLICE, { labels: ["z map, thresholded"] });

// the GLM desk at the front left
const DESK = { x: -144, y: 0, w: 128, d: 66, r: 3 };
const DESK_H = 10;
const FADERS = [-128, -110, -92];
const SLOT = { back: 10, front: 46, lo: -1, hi: 2 };
const slotY = (b) => SLOT.front - ((Math.min(SLOT.hi, Math.max(SLOT.lo, b)) - SLOT.lo) / (SLOT.hi - SLOT.lo)) * (SLOT.front - SLOT.back);
const FIT_BTN = [-68, 15];
const LED = { x0: -78, x1: -24, y: 29, d: 4, n: 12, full: 1.2 }; // residual RMS, 0.1 % per segment
const LCD = { x0: -78, x1: -24, y0: 45, y1: 59 };

// the threshold box at the front right
const TBOX = { x: 6, y: 14, w: 128, d: 50, r: 3 };
const TBOX_H = 12;
const KNOB = [42, 40];
const DETENTS = [-90, -30, 30, 90];
const TLCD = [{ x0: 76, x1: 128, y0: 22, y1: 33 }, { x0: 76, x1: 128, y0: 37, y1: 48 }];

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [BOARD.x, BOARD.y, BOARD_TOP], [LBOX.LB.x, LBOX.LB.y, LBOX.top], [LBOX.LB.x + LBOX.LB.w, LBOX.LB.y, LBOX.top]],
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
const liveTopText = (part, x, y, z, size, anchor = "middle", tone = "lit") => `<text data-part="${part}" class="iso-face-text" data-tone="${tone}" transform="${k.topMatrix([x, y], z, P, "x")}" font-size="${size}" text-anchor="${anchor}"></text>`;

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

// ── recorder ───────────────────────────────────────────────────────────────
function recorder() {
  const out = [S(k.slabOf(REC_BASE, 0, REC_BASE_H, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(REC_BASE, 2.5, P, 4), { tone: "faint" }) })];
  out.push(S(k.slabOf(BOARD, REC_BASE_H, BOARD_TOP - REC_BASE_H, P, 3, 0.6), { tone: "mid" }));
  out.push(S(k.slabOf({ x: PAPER.x, y: FACE_Y, w: PAPER.w, d: 0.4, r: 0 }, PAPER.z0, PAPER.z1 - PAPER.z0, P, 1), { tone: "hi", crease: "none" }));
  const grid = [];
  for (let s = 20; s <= RUN_S; s += 20) grid.push(on([[TX0 + s * KT, PAPER_Y, PAPER.z0], [TX0 + s * KT, PAPER_Y, PAPER.z1]]));
  for (const pct of [-2, -1, 1, 2, 3]) grid.push(on([[TX0, PAPER_Y, Y0 + pct * YK], [PAPER.x + PAPER.w, PAPER_Y, Y0 + pct * YK]]));
  out.push(L(grid.join(""), { tone: "faint" }));
  out.push(L(on([[TX0, PAPER_Y, Y0], [PAPER.x + PAPER.w, PAPER_Y, Y0]]) + on([[TX0, PAPER_Y, PAPER.z0], [TX0, PAPER_Y, PAPER.z1]]), { tone: "lo" }));
  const bars = BLOCKS.map(([a, b]) => on([[TX0 + a * KT, PAPER_Y, DESIGN_Z], [TX0 + b * KT, PAPER_Y, DESIGN_Z], [TX0 + b * KT, PAPER_Y, DESIGN_Z + 2.4], [TX0 + a * KT, PAPER_Y, DESIGN_Z + 2.4]], true)).join("");
  out.push(`<path class="gd-bar" d="${bars}"/>`);
  out.push(faceText(PAPER.x + 1.2, PAPER_Y, DESIGN_Z + 0.4, "task", 2.6, "start", "lo"));
  for (const [pct, text] of [[0, "0%"], [1, "+1"], [2, "+2"], [-1, "−1"]]) out.push(faceText(TX0 - 1.4, PAPER_Y, Y0 + pct * YK - 0.9, text, 2.6, "end", "lo"));
  for (const s of [40, 80, 120]) out.push(faceText(TX0 + s * KT + 0.8, PAPER_Y, PAPER.z1 - 5.6, `${s} s`, 2.6, "start", "lo"));
  out.push(`<text data-part="voxel-name" class="iso-face-text" data-tone="hi" transform="${k.sideMatrix([TX0 + 2, PAPER_Y], PAPER.z1 - 5.6, P, "left")}" font-size="3.2" text-anchor="start"></text>`);
  out.push(`<path data-part="residuals" class="iso-line" data-tone="mid" data-free="" d=""/>`);
  out.push(`<path data-part="model" class="iso-line" data-tone="lit" data-free="" d="" style="stroke-width:1"/>`);
  out.push(`<g data-part="data"></g>`);
  out.push(faceText(REC_BASE.x + 4, REC_BASE.y + REC_BASE.d, 1.6, "one voxel: data, model, residuals", 3.2));
  out.push(D(byDepth(k.corners(REC_BASE, 2.6)).map(([x, y]) => at([x, y, REC_BASE_H])), { size: 0.45 }));
  return out.join("");
}

// ── GLM desk ───────────────────────────────────────────────────────────────
function desk() {
  const z = DESK_H;
  const out = [S(k.slabOf(DESK, 0, DESK_H, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(DESK, 4, P, 4), { tone: "faint" }) })];
  ["task", "drift", "base"].forEach((name, i) => {
    const cx = FADERS[i];
    out.push(S(k.slabOf({ x: cx - 1, y: SLOT.back - 2, w: 2, d: SLOT.front - SLOT.back + 4, r: 1 }, z - 0.01, 0.01, P, 3), { tone: "lo", crease: "none", flat: true }));
    out.push(L(k.planOutline({ x: cx - 1, y: SLOT.back - 2, w: 2, d: SLOT.front - SLOT.back + 4, r: 1 }, z, P), { tone: "lo" }));
    const ticks = [];
    for (let b = SLOT.lo; b <= SLOT.hi + 1e-9; b += 0.5) ticks.push(k.lineOnTop([cx + 2.4, slotY(b)], [cx + (b % 1 === 0 ? 5.4 : 4), slotY(b)], z, P));
    out.push(L(ticks.join(""), { tone: "lo" }));
    out.push(`<g data-part="fader-${i}" transform="">${S(k.slabOf({ x: cx - 4, y: slotY(0) - 1.8, w: 8, d: 3.6, r: 0 }, z, 4, P, 3, 0.4), { tone: "hi", crease: "lo", inner: L(k.lineOnTop([cx - 4, slotY(0)], [cx + 4, slotY(0)], z + 4, P), { tone: "lo" }) })}</g>`);
    out.push(topText(cx, SLOT.front + 8.5, z, name, 3.8));
  });
  for (const b of [2, 1, 0, -1]) out.push(topText(FADERS[0] - 3.4, slotY(b) + 1.1, z, b === 0 ? "0" : b > 0 ? `+${b}` : "−1", 2.6, "end", "lo"));
  // fit button
  const [fx, fy] = FIT_BTN;
  out.push(S(k.cylinder(fx, fy, 6.6, z, 1.2, P, 32), { tone: "lo" }));
  out.push(`<g data-part="fit">${S(k.cylinder(fx, fy, 4.8, z + 1.2, 3, P, 32, 0.4), { tone: "hi", crease: "lo" })}</g>`);
  out.push(topText(fx + 9.5, fy + 1.4, z, "least squares", 3.6, "start"));
  // residual LEDs
  const segW = (LED.x1 - LED.x0) / LED.n;
  for (let i = 0; i < LED.n; i++) {
    const seg = { x: LED.x0 + i * segW + 0.4, y: LED.y, w: segW - 0.8, d: LED.d, r: 0.4 };
    out.push(S(k.slabOf(seg, z, 0.5, P, 2), { tone: "lo", crease: "none" }));
    out.push(`<g data-part="led-${i}" opacity="0">${S(k.slabOf(seg, z, 0.5, P, 2), { tone: "hi", lit: true, crease: "none" })}</g>`);
  }
  out.push(topText(LED.x0, LED.y + LED.d + 5, z, "residual (rms)", 3.6, "start"));
  out.push(topText(LED.x1, LED.y + LED.d + 5, z, "1.2%", 3, "end", "lo"));
  // t display
  out.push(S(k.slabOf({ x: LCD.x0, y: LCD.y0, w: LCD.x1 - LCD.x0, d: LCD.y1 - LCD.y0, r: 1 }, z, 0.4, P, 3), { tone: "lo", crease: "none" }));
  out.push(liveTopText("t-lcd", (LCD.x0 + LCD.x1) / 2, (LCD.y0 + LCD.y1) / 2 + 2, z + 0.4, 5.6));
  out.push(faceText(DESK.x + 5, DESK.y + DESK.d, 3.2, "y = β1·task + β2·drift + β0 + error", 3.8));
  out.push(D(byDepth(k.corners(DESK, 3)).map(([x, y]) => at([x, y, DESK_H])), { size: 0.45 }));
  return out.join("");
}

// ── threshold box ──────────────────────────────────────────────────────────
function thresholdBox() {
  const z = TBOX_H;
  const out = [S(k.slabOf(TBOX, 0, TBOX_H, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(TBOX, 4.5, P, 4), { tone: "faint" }) })];
  const [cx, cy] = KNOB;
  out.push(L(k.ring(cx, cy, 11.4, z, P, 48), { tone: "faint" }));
  out.push(L(DETENTS.map((deg) => { const d = dirOf(deg); return k.lineOnTop([cx + d[0] * 11.4, cy + d[1] * 11.4], [cx + d[0] * 8.8, cy + d[1] * 8.8], z, P); }).join(""), { tone: "hi" }));
  const anchors = ["end", "end", "start", "start"];
  RULES.forEach((rule, i) => {
    const d = dirOf(DETENTS[i]);
    out.push(topText(cx + d[0] * (i === 1 ? 19.5 : 15.6) - (i === 1 ? 1.5 : 0), cy + d[1] * (i === 1 ? 19.5 : 15.6) + 1.4, z, rule.label, 3.8, anchors[i]));
  });
  out.push(S(k.cylinder(cx, cy, 7.2, z, 5, P, 40, 0.4), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(cx, cy, 7.2, z, z + 5, 40, P), { tone: "lo" }));
  out.push(`<path data-part="rule-pointer" class="iso-line" data-tone="hi" data-free="" d="${pointerOf(k, P, KNOB, DETENTS[0], 5.8, z + 5)}"/>`);
  out.push(topText(cx, cy + 17, z, "threshold", 3.8));
  TLCD.forEach((w, i) => {
    out.push(S(k.slabOf({ x: w.x0, y: w.y0, w: w.x1 - w.x0, d: w.y1 - w.y0, r: 1 }, z, 0.4, P, 3), { tone: "lo", crease: "none" }));
    out.push(liveTopText(`count-${i}`, (w.x0 + w.x1) / 2, (w.y0 + w.y1) / 2 + 1.6, z + 0.4, 4.2));
  });
  out.push(faceText(TBOX.x + 5, TBOX.y + TBOX.d, 3.8, `testing ${MAP.n.toLocaleString("en")} brain voxels`, 3.8));
  out.push(D(byDepth(k.corners(TBOX, 3)).map(([x, y]) => at([x, y, TBOX_H])), { size: 0.45 }));
  return out.join("");
}

// ── assemble ────────────────────────────────────────────────────────────────
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A bench for analysing fMRI data. At the back left a recorder plots one voxel's time course as dots, with the model as a bright line and the residuals as short sticks; bars mark the task blocks. At the front left a mixing desk holds three faders, for the task, a slow drift and the baseline, a least-squares button that moves them to the best fit, a row of lights for the size of the residuals, and a display of the t value. At the back right a lightbox shows a brain slice with the voxels whose t value passes the threshold coloured, and a dotted outline around visual cortex where the effect is real. At the front right a knob chooses the threshold, and two displays count the voxels found in visual cortex and the false positives elsewhere.",
  body: [plate(), lightboxSvg(k, P, LBOX), recorder(), desk(), thresholdBox()],
});

const modelSource = readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "");
const un = (b64) => [...Buffer.from(b64, "base64")];
const anatomy = (() => {
  const gm = un(SLICE.gm), wm = un(SLICE.wm), csf = un(SLICE.csf);
  return Buffer.from(gm.map((g, p) => Math.round(0.42 * g + 0.72 * wm[p] + 0.1 * csf[p]))).toString("base64");
})();
const MAPDATA = {
  W: MAP.W, H: MAP.H, W1: SLICE.width, H1: SLICE.height, VOX,
  z: Array.from(MAP.z, (v) => Math.round(v * 100) / 100),
  real: Array.from(MAP.w, (v) => (v > REAL ? 1 : 0)),
  mask: MAP.mask.map((m) => (m ? 1 : 0)),
  rules: MAP.rules,
  anatomy,
};

const live = `
${modelSource}
const pointerOf = ${pointerOf.toString()};
const P = ${JSON.stringify(P)};
const K = { lineOnTop };
const MAP = ${JSON.stringify(MAPDATA)};
const VOXELS = ${JSON.stringify(VOXELS)};
const TX0 = ${TX0}, KT = ${KT}, PAPER_Y = ${PAPER_Y}, Y0 = ${Y0}, YK = ${YK};
const SLOT = ${JSON.stringify(SLOT)}, DESK_H = ${DESK_H}, LED = ${JSON.stringify(LED)};
const KNOB = ${JSON.stringify(KNOB)}, DETENTS = ${JSON.stringify(DETENTS)}, KNOB_Z = ${TBOX_H + 5};
const slotY = ${slotY.toString()};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const q = (name) => svg.querySelector('[data-part="' + name + '"]');
const faders = [0, 1, 2].map((i) => q("fader-" + i));
const leds = Array.from({ length: LED.n }, (_, i) => q("led-" + i));
const dataG = q("data"), model = q("model"), residuals = q("residuals"), voxelName = q("voxel-name"), tLcd = q("t-lcd"), fitButton = q("fit");
const rulePointer = q("rule-pointer"), counts = [q("count-0"), q("count-1")];
const film = q("film-0");
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

// ── the film: anatomy, supra-threshold voxels, the true region's outline, a cross at the chosen voxel ──
const canvas = document.createElement("canvas");
canvas.width = MAP.W1; canvas.height = MAP.H1;
const ctx = canvas.getContext("2d");
const image = ctx.createImageData(MAP.W1, MAP.H1);
const anat = Uint8Array.from(atob(MAP.anatomy), (c) => c.charCodeAt(0));
function paintFilm(rule, vi) {
  const thr = MAP.rules[rule].thr;
  const px = image.data;
  for (let r = 0; r < MAP.H1; r++) for (let c = 0; c < MAP.W1; c++) {
    const p = r * MAP.W1 + c, o = p * 4;
    const g = Math.round(2.55 * (4 + 70 * Math.min(1, anat[p] / 255)));
    let R = g, G = g, B = g;
    const vr = Math.floor(r / MAP.VOX), vc = Math.floor(c / MAP.VOX);
    if (vr < MAP.H && vc < MAP.W) {
      const vq = vr * MAP.W + vc, zv = MAP.z[vq];
      if (MAP.mask[vq] && zv > thr) { const f = clamp((zv - thr) / 4, 0, 1); R = 236; G = Math.round(64 + 160 * f); B = Math.round(56 * (1 - f)); }
      // dotted outline where the true region meets the rest
      const edge = (rr, cc) => rr >= 0 && cc >= 0 && rr < MAP.H && cc < MAP.W && MAP.real[rr * MAP.W + cc] !== MAP.real[vq];
      const ir = r % MAP.VOX, ic = c % MAP.VOX;
      if (MAP.real[vq] && (((ir === 0 && edge(vr - 1, vc)) || (ir === MAP.VOX - 1 && edge(vr + 1, vc))) && (c & 1) || ((ic === 0 && edge(vr, vc - 1)) || (ic === MAP.VOX - 1 && edge(vr, vc + 1))) && (r & 1))) { R = G = B = 245; }
    }
    px[o] = R; px[o + 1] = G; px[o + 2] = B; px[o + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  // a cross around the chosen voxel
  const vq = VOXELS[vi].q, cr = (Math.floor(vq / MAP.W) + 0.5) * MAP.VOX, cc = ((vq % MAP.W) + 0.5) * MAP.VOX;
  ctx.fillStyle = "#ffffff";
  for (const [dx, dy, w, h] of [[-9, -0.5, 5, 1], [4, -0.5, 5, 1], [-0.5, -9, 1, 5], [-0.5, 4, 1, 5]]) ctx.fillRect(cc + dx, cr + dy, w, h);
  film.setAttribute("href", canvas.toDataURL());
}

// ── state ──
let vi = 0, rule = 1, beta = [0, 0, 0], from = [0, 0, 0], glideAt = -1, frame = 0, last = 0, clock = 0, visible = false;
let touring = !still.matches, idleTimer = 0, tourT = 0, pressAt = -1e9, knobShown = rule, filmKey = "";
const GLIDE = 1.6;
const STEPS = [0.9, GLIDE + 0.9, 2.3, 2.3, 2.3, 2.3]; // rest, fit, then the four thresholds
const dataSvg = () => { const v = VOXELS[vi]; return dotsSvg(v.y.map((y, n) => iso([TX0 + n * TR * KT, PAPER_Y, Y0 + y * YK], P)), { size: 0.75, tone: "hi" }); };

function draw() {
  const v = VOXELS[vi];
  const m = modelOf(beta);
  model.setAttribute("d", pathOf(m.map((y, n) => iso([TX0 + n * TR * KT, PAPER_Y, Y0 + y * YK], P))));
  residuals.setAttribute("d", v.y.map((y, n) => pathOf([iso([TX0 + n * TR * KT, PAPER_Y, Y0 + y * YK], P), iso([TX0 + n * TR * KT, PAPER_Y, Y0 + m[n] * YK], P)])).join(""));
  faders.forEach((f, i) => f.setAttribute("transform", translateAlong(P, [0, slotY(beta[i]) - slotY(0), 0])));
  const rms = Math.sqrt(rssOf(v.y, beta) / SCANS);
  const lit = Math.round(clamp(rms / LED.full, 0, 1) * LED.n);
  leds.forEach((el, i) => el.setAttribute("opacity", i < lit ? "1" : "0"));
  const fitted = beta.every((b, i) => Math.abs(b - v.fit.beta[i]) < 0.005);
  const tText = fitted ? "t = " + v.fit.t.toFixed(2) : "t  –";
  if (tLcd.textContent !== tText) tLcd.textContent = tText;
  fitButton.setAttribute("transform", translateAlong(P, [0, 0, -1.4 * Math.exp(-Math.max(0, clock - pressAt) / 200)]));
  rulePointer.setAttribute("d", pointerOf(K, P, KNOB, DETENTS[0] + knobShown * (DETENTS[1] - DETENTS[0]), 5.8, KNOB_Z));
  const R = MAP.rules[rule];
  const c0 = "in V1 " + R.tp + " of " + R.truth, c1 = "false + " + R.fp;
  if (counts[0].textContent !== c0) { counts[0].textContent = c0; counts[1].textContent = c1; }
  const key = rule + ":" + vi;
  if (key !== filmKey) { filmKey = key; paintFilm(rule, vi); }
  const text = v.label + " · task β " + beta[0].toFixed(2) + "% · rms " + rms.toFixed(2) + "% · " + RULES[rule].label + ", z > " + R.thr.toFixed(2);
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuetext", text + " · " + (fitted ? "t " + v.fit.t.toFixed(2) : "not fitted") + " · " + c0 + ", " + c1);
}

function chooseVoxel(i) {
  vi = i;
  dataG.innerHTML = dataSvg();
  voxelName.textContent = VOXELS[vi].label;
  beta = [0, 0, 0];
  glideAt = -1;
}
function startFit() { from = beta.slice(); glideAt = clock; pressAt = clock; }

function tick(stamp) {
  const dt = last ? Math.min((stamp - last) / 1000, 1 / 30) : 1 / 60;
  last = stamp;
  clock += dt * 1000;
  if (touring) {
    const before = tourT;
    tourT += dt;
    const ends = STEPS.reduce((acc, s) => [...acc, (acc[acc.length - 1] ?? 0) + s], []);
    const crossed = (x) => before < x && tourT >= x;
    if (crossed(ends[0])) startFit();
    for (let i = 0; i < 4; i++) if (crossed(ends[1 + i])) rule = i;
    if (tourT >= ends[ends.length - 1] + 0.01) { tourT = 0; chooseVoxel((vi + 1) % VOXELS.length); rule = 0; }
  }
  if (glideAt >= 0) {
    const g = clamp((clock - glideAt) / 1000 / GLIDE, 0, 1);
    beta = from.map((b, i) => b + (VOXELS[vi].fit.beta[i] - b) * ease(g));
    if (g >= 1) glideAt = -1;
  }
  knobShown += (rule - knobShown) * (1 - Math.exp(-dt / 0.2));
  draw();
  frame = visible ? requestAnimationFrame(tick) : 0;
}

const go = () => { if (!frame && visible && !still.matches) { last = 0; frame = requestAnimationFrame(tick); } };
function user() {
  touring = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { touring = !still.matches; tourT = 0; }, 10000);
}
function settle() { if (still.matches) { if (glideAt >= 0) { beta = VOXELS[vi].fit.beta.slice(); glideAt = -1; } knobShown = rule; draw(); } else go(); }
new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) go(); }, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("pointermove", (event) => {
  user();
  const box = svg.getBoundingClientRect();
  const f = clamp(((event.clientY - box.top) / box.height - 0.15) / 0.7, 0, 1);
  glideAt = -1;
  beta = [SLOT.hi - f * (SLOT.hi - SLOT.lo), beta[1], beta[2]];
  settle();
});
stage.addEventListener("click", () => { user(); startFit(); settle(); });
stage.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (key === "1" || key === "2") { user(); chooseVoxel(Number(key) - 1); }
  else if (key === "f" || key === "enter" || key === " ") { user(); startFit(); }
  else if (key === "t") { user(); rule = (rule + 1) % RULES.length; }
  else if (key === "arrowup" || key === "arrowdown") { user(); glideAt = -1; beta = [clamp(beta[0] + (key === "arrowup" ? 0.1 : -0.1), SLOT.lo, SLOT.hi), beta[1], beta[2]]; }
  else return;
  event.preventDefault();
  settle();
});
chooseVoxel(0);
if (still.matches) { beta = VOXELS[0].fit.beta.slice(); rule = 1; knobShown = 1; }
else rule = 0;
knobShown = rule;
draw();
`;

const css = `<style>
.gd-bar{fill:var(--anatomy-lo);stroke:none}
</style>`;
const R = Object.fromEntries(MAP.rules.map((r) => [r.key, r]));
const V1F = VOXELS[0].fit, FPF = VOXELS[1].fit;
const body = k.plateHtml({
  fig: "Fig 11",
  title: "GLM desk",
  hint: "Keys 1–2, F, T · hover up/down",
  readout: "V1 voxel · task β 0.00% · rms 0.00% · p < .05, z > 1.64",
  keys: [
    { mark: "lit", label: "Lit line: the model, β1·task + β2·drift + β0, drawn through the data (dots)" },
    { mark: "raised", label: "Faders: the three β weights; least squares moves them to the smallest residual" },
    { mark: "edge", label: "Lightbox: voxels whose z passes the threshold (red to yellow); dotted: where the effect is real" },
  ],
  caption:
    `Every voxel gets the same model: its time course is a weighted sum of the predicted task response (the blocked design of Fig 10 convolved with the HRF), a slow drift and a baseline, plus noise. Least squares picks the weights (β) that leave the smallest residuals, and the t value divides the task weight by its standard error, how much it would wobble from noise alone. ` +
    `For the V1 voxel the fit finds β1 = ${V1F.beta[0].toFixed(2)}% with t = ${V1F.t.toFixed(1)}. The frontal voxel holds nothing but noise and drift, yet its best fit still finds β1 = ${FPF.beta[0].toFixed(2)}% with t = ${FPF.t.toFixed(2)} (p ≈ ${upperTail(FPF.t).toFixed(3)}, one-sided): significant at p < 0.05, and wrong. ` +
    `Fitting all ${MAP.n.toLocaleString("en")} voxels of this slice gives a map, and the threshold decides what counts. At p < 0.05 uncorrected, ${R.p05.fp} voxels outside visual cortex pass, about 5% as promised, and the map is speckled with false positives. At p < 0.001 uncorrected ${R.p001.fp} remains. FDR (q < 0.05) adapts to the data: it keeps the expected share of false discoveries among those found below 5% (here ${R.fdr.fp} of ${R.fdr.tp + R.fdr.fp}). FWE (Bonferroni, p < 0.05 / ${MAP.n.toLocaleString("en")}) makes even one false positive in the slice unlikely, but finds only ${R.fwe.tp} of the ${R.fwe.truth} visual-cortex voxels. Strict thresholds miss weak effects; lenient ones report noise. ` +
    `Model: ${SCANS} scans, TR ${TR} s, Gaussian noise of 0.5% per scan for the time courses. The map is simulated on ${VOX} mm voxels: a noise field smoothed to ${FWHM} mm FWHM with unit variance, plus a true effect in an illustrative visual-cortex patch peaking at z = ${VOXELS[0].fit.t.toFixed(1)}; "in V1" counts voxels where the true effect is at least a quarter of the peak. Real analyses also model autocorrelated noise and often use random-field theory or cluster-level inference instead of Bonferroni, which is conservative for smooth maps. ` +
    MNI_NOTICE,
  body: `<div class="iso-stage" tabindex="0" role="application" aria-roledescription="GLM desk" aria-label="GLM desk: keys 1 and 2 choose the V1 voxel or a frontal voxel, F fits by least squares, T steps through thresholds, up and down arrows move the task fader, and moving up and down over the figure sets the task weight by hand">${svg}</div>`,
});

writeFileSync(join(HERE, OUT), k.pageHtml({ title: "GLM desk", theme, body: css + body, script: kitScript() + live }));
console.log("wrote", OUT, "· voxels", MAP.n, "· V1 t", V1F.t.toFixed(2), "· FP t", FPF.t.toFixed(2), "·", MAP.rules.map((r) => `${r.key} z>${r.thr.toFixed(2)} ${r.tp}/${r.truth} fp ${r.fp}`).join(" · "));
