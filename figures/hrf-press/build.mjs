// Fig 10 — HRF printing press: experimental design, convolution and efficiency.
// node build.mjs            → hrf-press.html (dark)
// node build.mjs --light    → hrf-press-light.html
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../_anatomy/kit/iso-kit.mjs";
import { kitScript } from "../_anatomy/scripts/inline-kit.mjs";
import { TR, RUN_S, SCANS, HRF_S, HP_CUTOFF, hrf, DESIGNS, efficiencyOf, gainOf } from "./model.mjs";
import { lightboxGeometry, lightboxSvg } from "../_shared/lightbox.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const OUT = theme === "light" ? "hrf-press-light.html" : "hrf-press.html";

const WIDTH = 600;
const HEIGHT = 400;

// ── world layout ────────────────────────────────────────────────────────────
const PLATE = { x: -150, y: -110, w: 300, d: 198, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

// the press: an upright board at the back with the paper, two rails and a carriage carrying the HRF stamp
const PRESS_BASE = { x: -146, y: -46, w: 190, d: 22, r: 3 };
const PRESS_BASE_H = 6;
const BOARD = { x: -144, y: -42, w: 186, d: 6, r: 1 };
const BOARD_TOP = 84;
const FACE_Y = BOARD.y + BOARD.d;
const PAPER = { x: -140, w: 178, z0: 10, z1: 78 };
const PAPER_Y = FACE_Y + 0.4;
const TX0 = -126; // t = 0
const KT = 1; // units per second
const DESIGN_Z = 14; // stimulus row
const PRED_Z0 = 28; // prediction baseline
const PRED_K = 44; // units per unit of prediction (after the display gain)
const RAIL_LO = PRESS_BASE_H;
const RAIL_HI = PAPER.z1;
const CAR_Y = FACE_Y + 3.5; // front of the rails
const STAMP_Y = PAPER_Y + 1.2; // the stamp's profile plane, just off the paper
const ARM_Z = 66;
const STAMP_W = HRF_S * KT;

// the lightbox shows the design matrix
const DM = { width: 54, height: 80 }; // film canvas: 3 columns, one row per scan
const LBOX = lightboxGeometry({ x: 72, y: -100, w: 70, d: 12, r: 2 }, DM, { top: 112, labels: ["design matrix X"] });

// console at the front left, efficiency meter at the front right
const CONSOLE = { x: -140, y: 40, w: 134, d: 30, r: 3 };
const CONSOLE_H = 9;
const KEYS = [-122, -97, -72, -47];
const KEY_Y = 51;
const GO = [-22, 54];
const METER_BOX = { x: 30, y: 40, w: 80, d: 24, r: 3 };
const METER_H = 48;
const DIAL_Y = METER_BOX.y + METER_BOX.d + 0.3;
const PIVOT = [70, 12];
const DIAL_R = 30;
const SWING = 55; // degrees either side of upright
const angleOf = (pct) => -SWING + (2 * SWING * Math.log10(Math.min(100, Math.max(1, pct)))) / 2;

// per-design numbers
const BASE_EFF = efficiencyOf(DESIGNS[0]);
const INFO = DESIGNS.map((d) => ({ eff: (100 * efficiencyOf(d)) / BASE_EFF, gain: gainOf(d) }));

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [BOARD.x, BOARD.y, BOARD_TOP], [BOARD.x + BOARD.w, BOARD.y, BOARD_TOP], [LBOX.LB.x, LBOX.LB.y, LBOX.top], [LBOX.LB.x + LBOX.LB.w, LBOX.LB.y, LBOX.top]],
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
const topText = (x, y, z, value, size = 3.4, anchor = "middle", tone = "mid") => k.faceTextSvg(k.topMatrix([x, y], z, P, "x"), value, { size, tone, anchor });
const faceText = (x, y, z, value, size = 3.4, anchor = "start", tone = "mid") => k.faceTextSvg(k.sideMatrix([x, y], z, P, "left"), value, { size, tone, anchor });

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

// ── the press ──────────────────────────────────────────────────────────────
function press() {
  const out = [S(k.slabOf(PRESS_BASE, 0, PRESS_BASE_H, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(PRESS_BASE, 2.5, P, 4), { tone: "faint" }) })];
  out.push(S(k.slabOf(BOARD, PRESS_BASE_H, BOARD_TOP - PRESS_BASE_H, P, 3, 0.6), { tone: "mid" }));
  out.push(S(k.slabOf({ x: PAPER.x, y: FACE_Y, w: PAPER.w, d: 0.4, r: 0 }, PAPER.z0, PAPER.z1 - PAPER.z0, P, 1), { tone: "hi", crease: "none" }));
  const grid = [];
  for (let s = 20; s <= RUN_S; s += 20) grid.push(on([[TX0 + s * KT, PAPER_Y, PAPER.z0], [TX0 + s * KT, PAPER_Y, PAPER.z1]]));
  for (const f of [0.25, 0.5, 0.75, 1]) grid.push(on([[TX0, PAPER_Y, PRED_Z0 + f * PRED_K], [PAPER.x + PAPER.w, PAPER_Y, PRED_Z0 + f * PRED_K]]));
  out.push(L(grid.join(""), { tone: "faint" }));
  out.push(L(on([[TX0, PAPER_Y, PRED_Z0], [PAPER.x + PAPER.w, PAPER_Y, PRED_Z0]]) + on([[TX0, PAPER_Y, DESIGN_Z], [PAPER.x + PAPER.w, PAPER_Y, DESIGN_Z]]) + on([[TX0, PAPER_Y, PAPER.z0], [TX0, PAPER_Y, PAPER.z1]]), { tone: "lo" }));
  out.push(faceText(PAPER.x + 1.2, PAPER_Y, DESIGN_Z + 0.9, "design", 2.8, "start", "lo"));
  out.push(faceText(PAPER.x + 1.2, PAPER_Y, PRED_Z0 + 0.9, "signal", 2.8, "start", "lo"));
  for (const s of [40, 80, 120]) out.push(faceText(TX0 + s * KT + 0.8, PAPER_Y, PAPER.z1 - 6.4, `${s} s`, 2.6, "start", "lo"));
  out.push(`<text data-part="gain" class="iso-face-text" data-tone="hi" transform="${k.sideMatrix([PAPER.x + 1.2, PAPER_Y], PAPER.z1 - 6.4, P, "left")}" font-size="3.2" text-anchor="start">×1</text>`);
  out.push(`<g data-part="bars"><path class="pr-bar" data-done="" d=""/><path class="pr-bar" d=""/></g>`);
  out.push(`<path data-part="copies" class="iso-line" data-tone="mid" data-dashed="" data-free="" d=""/>`);
  out.push(`<path data-part="sum" class="iso-line" data-tone="lit" data-free="" d="" style="stroke-width:1"/>`);
  for (const z of [RAIL_LO, RAIL_HI]) {
    const rail = { x: BOARD.x, y: FACE_Y, w: BOARD.w, d: 3.5, r: 0.8 };
    out.push(S(k.slabOf(rail, z, 2.6, P, 3, 0.3), { tone: "mid" }));
    out.push(D([rail.x + 3, rail.x + rail.w - 3].map((x) => at([x, CAR_Y, z + 1.3])), { size: 0.4 }));
  }
  out.push(faceText(PRESS_BASE.x + 4, PRESS_BASE.y + PRESS_BASE.d, 1.6, "design ⊛ HRF = predicted signal", 3.2));
  out.push(D(byDepth(k.corners(PRESS_BASE, 2.6)).map(([x, y]) => at([x, y, PRESS_BASE_H])), { size: 0.45 }));
  return out.join("");
}

// the carriage: drawn at t = 0 and translated along x; the stamp group moves towards the paper when it prints
function carriage() {
  const z0 = RAIL_LO + 2.6, z1 = RAIL_HI;
  const bar = S(k.slabOf({ x: TX0 - 2, y: CAR_Y + 0.4, w: 4, d: 2.4, r: 0.8 }, z0, z1 - z0, P, 3, 0.3), { tone: "mid", crease: "none" });
  const blocks = [RAIL_LO - 0.4, RAIL_HI - 0.4].map((z) => S(k.slabOf({ x: TX0 - 3.5, y: CAR_Y, w: 7, d: 3.2, r: 0.8 }, z, 3.4, P, 3, 0.4), { tone: "mid" })).join("");
  const arm = { x: TX0 + 2, y: STAMP_Y, w: STAMP_W - 1.4, d: CAR_Y + 2.8 - STAMP_Y, r: 0.6 };
  const post = { x: TX0 + STAMP_W - 0.8, y: STAMP_Y, w: 1.6, d: 1.6, r: 0.4 };
  const stamp =
    `<g data-part="stamp">` +
    S(k.slabOf(post, PRED_Z0 - 6, ARM_Z - PRED_Z0 + 6, P, 2, 0.2), { tone: "mid", crease: "none" }) +
    `<path data-part="profile" class="iso-line" data-tone="lit" data-free="" d="" style="stroke-width:1.1"/>` +
    S(k.slabOf(arm, ARM_Z, 2.4, P, 2, 0.3), { tone: "hi", crease: "lo" }) +
    k.faceTextSvg(k.sideMatrix([TX0 + 6, arm.y + arm.d], ARM_Z + 0.5, P, "left"), "HRF", { size: 1.9, tone: "lo" }) +
    `</g>`;
  return `<g data-part="carriage">${blocks}${stamp}${bar}</g>`;
}

// ── console ────────────────────────────────────────────────────────────────
function console_() {
  const z = CONSOLE_H;
  const out = [S(k.slabOf(CONSOLE, 0, CONSOLE_H, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(CONSOLE, 3.5, P, 4), { tone: "faint" }) })];
  DESIGNS.forEach((ds, i) => {
    const cx = KEYS[i];
    out.push(L(k.planOutline({ x: cx - 9.5, y: KEY_Y - 6.5, w: 19, d: 13, r: 2 }, z, P), { tone: "lo" }));
    out.push(S(k.slabOf({ x: cx - 8, y: KEY_Y - 5, w: 16, d: 10, r: 1.6 }, z, 3, P, 3, 0.4), { tone: "hi", crease: "lo" }));
    const lamp = { x: cx - 5, y: KEY_Y - 3.2, w: 10, d: 2.2, r: 0.8 };
    out.push(S(k.slabOf(lamp, z + 3, 0.5, P, 2), { tone: "lo", crease: "none" }));
    out.push(`<g data-part="key-lamp-${i}" opacity="0">${S(k.slabOf(lamp, z + 3, 0.5, P, 2), { tone: "hi", lit: true, crease: "none" })}</g>`);
    out.push(topText(cx, KEY_Y + 3.6, z + 3, String(i + 1), 3, "middle", "lo"));
    out.push(topText(cx, KEY_Y + 11, z, ds.label, 3.4));
  });
  const [gx, gy] = GO;
  out.push(S(k.cylinder(gx, gy, 7, z, 1.2, P, 32), { tone: "lo" }));
  out.push(`<g data-part="go">${S(k.cylinder(gx, gy, 5, z + 1.2, 3.2, P, 32, 0.4), { tone: "hi", crease: "lo" })}</g>`);
  out.push(topText(gx, gy + 11, z, "print", 3.4));
  out.push(faceText(CONSOLE.x + 5, CONSOLE.y + CONSOLE.d, 3, "stimulus design", 3.6));
  out.push(D(byDepth(k.corners(CONSOLE, 3)).map(([x, y]) => at([x, y, CONSOLE_H])), { size: 0.45 }));
  return out.join("");
}

// ── efficiency meter: a dial on the box's front face, log scale ────────────
const dialPoint = (deg, r) => [PIVOT[0] + Math.sin((deg * Math.PI) / 180) * r, DIAL_Y, PIVOT[1] + Math.cos((deg * Math.PI) / 180) * r];
function meter() {
  const out = [S(k.slabOf(METER_BOX, 0, METER_H, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(METER_BOX, 5, P, 4), { tone: "faint" }) })];
  // dial window
  const win = { x0: METER_BOX.x + 4, x1: METER_BOX.x + METER_BOX.w - 4, z0: 6, z1: METER_H - 4 };
  out.push(S(k.slabOf({ x: win.x0, y: DIAL_Y - 0.3, w: win.x1 - win.x0, d: 0.3, r: 0 }, win.z0, win.z1 - win.z0, P, 1), { tone: "hi", crease: "none" }));
  const arc = [];
  for (let i = 0; i <= 40; i++) arc.push(at(dialPoint(-SWING + (2 * SWING * i) / 40, DIAL_R)));
  out.push(L(k.pathOf(arc), { tone: "mid" }));
  const minor = [], major = [];
  for (const v of [2, 3, 5, 20, 30, 50]) minor.push(k.pathOf([at(dialPoint(angleOf(v), DIAL_R)), at(dialPoint(angleOf(v), DIAL_R + 2))]));
  for (const v of [1, 10, 100]) major.push(k.pathOf([at(dialPoint(angleOf(v), DIAL_R)), at(dialPoint(angleOf(v), DIAL_R + 3.4))]));
  out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }));
  for (const [v, text] of [[1, "1"], [10, "10"], [100, "100%"]]) {
    const [x, , zz] = dialPoint(angleOf(v), DIAL_R + 5.6);
    out.push(faceText(x, DIAL_Y, zz - 1, text, 3, "middle", "mid"));
  }
  // each design's mark, numbered as its key
  INFO.forEach((info, i) => {
    const [x, , zz] = dialPoint(angleOf(info.eff), DIAL_R - 4.2);
    out.push(faceText(x, DIAL_Y, zz - 1.1, String(i + 1), 2.6, "middle", "lo"));
  });
  out.push(faceText(PIVOT[0], DIAL_Y, PIVOT[1] - 4.6, "detection efficiency", 3.2, "middle", "mid"));
  out.push(faceText(PIVOT[0], DIAL_Y, PIVOT[1] - 8.6, "% of blocked, log scale", 2.6, "middle", "lo"));
  out.push(`<path data-part="needle" class="iso-line" data-tone="lit" data-free="" d="" style="stroke-width:1.1"/>`);
  out.push(D([at([PIVOT[0], DIAL_Y, PIVOT[1]])], { size: 1.6, tone: "hi" }));
  out.push(D(byDepth(k.corners(METER_BOX, 2.6)).map(([x, y]) => at([x, y, METER_H])), { size: 0.45 }));
  return out.join("");
}

// ── assemble ────────────────────────────────────────────────────────────────
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A printing press for the predicted fMRI signal. An upright board at the back carries paper with a row for the stimulus design and a row for the predicted signal. A carriage runs along rails in front of the paper carrying a stamp shaped like the haemodynamic response; at every second of stimulus it presses and prints one response, and the printed responses add up to the prediction, drawn as a bright line. A lightbox shows the design matrix filling in one scan at a time. At the front, four keys choose blocked, slow, fast fixed or jittered designs, and a dial shows how efficiently each design can detect activation, relative to the blocked design.",
  body: [plate(), lightboxSvg(k, P, LBOX), press(), carriage(), console_(), meter()],
});

const modelSource = readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "");

const live = `
${modelSource}
const P = ${JSON.stringify(P)};
const INFO = ${JSON.stringify(INFO)};
const TX0 = ${TX0}, KT = ${KT}, PAPER_Y = ${PAPER_Y}, STAMP_Y = ${STAMP_Y}, DESIGN_Z = ${DESIGN_Z}, PRED_Z0 = ${PRED_Z0}, PRED_K = ${PRED_K};
const DIAL_Y = ${DIAL_Y}, PIVOT = ${JSON.stringify(PIVOT)}, DIAL_R = ${DIAL_R}, SWING = ${SWING};
const angleOf = ${angleOf.toString()};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const q = (name) => svg.querySelector('[data-part="' + name + '"]');
const [barsDone, barsTodo] = q("bars").querySelectorAll("path");
const copies = q("copies"), sum = q("sum"), carriage = q("carriage"), stamp = q("stamp"), profile = q("profile"), gainText = q("gain"), needle = q("needle"), goButton = q("go");
const keyLamps = DESIGNS.map((_, i) => q("key-lamp-" + i));
const film = q("film-0");
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const SPEED = 12; // seconds of run per second
const HOLD = 2.6;
const STEP = 0.25;

// per design: the prediction sampled every 0.25 s, each stamp's printed response, the regressor and stimulus per scan
const PREP = DESIGNS.map((d, i) => {
  const gain = INFO[i].gain;
  const zOf = (v) => PRED_Z0 + v * gain * PRED_K;
  const pred = []; for (let t = 0; t <= RUN_S + 1e-9; t += STEP) pred.push(predictionAt(d, t));
  const copy = d.stamps.map((te) => { const pts = []; for (let s = 0; s <= Math.min(HRF_S, RUN_S - te) + 1e-9; s += 0.5) pts.push(iso([TX0 + (te + s) * KT, PAPER_Y, zOf(hrf(s))], P)); return pathOf(pts); });
  const bar = d.stamps.map((te) => pathOf([[te, DESIGN_Z], [te + 1, DESIGN_Z], [te + 1, DESIGN_Z + 5], [te, DESIGN_Z + 5]].map(([tt, z]) => iso([TX0 + tt * KT, PAPER_Y, z], P)), true));
  const prof = []; for (let s = 0; s <= HRF_S + 1e-9; s += 0.5) prof.push(iso([TX0 + s * KT, STAMP_Y, zOf(hrf(s))], P));
  const reg = regressorOf(d), stim = stimulusOf(d);
  return { gain, zOf, pred, copy, bar, profile: pathOf(prof), reg, stim, min: Math.min(...reg), max: Math.max(...reg) };
});

// the design matrix film: stimulus, predicted signal, constant; rows not yet scanned stay dark
const canvas = document.createElement("canvas");
canvas.width = 54; canvas.height = SCANS;
const ctx = canvas.getContext("2d");
const image = ctx.createImageData(54, SCANS);
let filmKey = "";
function paintFilm(di, t) {
  const rows = Math.min(SCANS, Math.floor(t / TR + 1e-9) + 1);
  const key = di + ":" + rows;
  if (key === filmKey) return;
  filmKey = key;
  const p = PREP[di];
  const px = image.data;
  const shade = (v) => Math.round(2.55 * (6 + 88 * v));
  for (let n = 0; n < SCANS; n++) for (let c = 0; c < 54; c++) {
    const col = c < 16 ? 0 : c < 19 ? -1 : c < 35 ? 1 : c < 38 ? -1 : 2;
    let g = 10;
    if (col >= 0 && n < rows) g = shade(col === 0 ? p.stim[n] : col === 1 ? (p.reg[n] - p.min) / (p.max - p.min || 1) : 1);
    else if (col >= 0) g = 22;
    const o = (n * 54 + c) * 4;
    px[o] = px[o + 1] = px[o + 2] = g; px[o + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  film.setAttribute("href", canvas.toDataURL());
}

let di = 3, t = 0, hold = 0, frame = 0, last = 0, clock = 0, visible = false, touring = !still.matches, idleTimer = 0, tourAt = 0, pressAt = -1e9, goAt = -1e9, scrubbing = false;
let needleShown = angleOf(INFO[di].eff), shownStamps = -1;

function drawDesign() {
  const p = PREP[di];
  profile.setAttribute("d", p.profile);
  gainText.textContent = "×" + p.gain;
  keyLamps.forEach((el, i) => el.setAttribute("opacity", i === di ? "1" : "0"));
  shownStamps = -1;
}

function draw() {
  const d = DESIGNS[di], p = PREP[di];
  const n = d.stamps.filter((te) => te < t || (t >= RUN_S && te <= t)).length;
  if (n !== shownStamps) {
    if (n > shownStamps && shownStamps >= 0) pressAt = clock;
    shownStamps = n;
    copies.setAttribute("d", p.copy.slice(0, n).join(""));
    barsDone.setAttribute("d", p.bar.slice(0, n).join(""));
    barsTodo.setAttribute("d", p.bar.slice(n).join(""));
  }
  const m = Math.round(t / STEP);
  const pts = [];
  for (let i = 0; i <= m; i += 2) pts.push(iso([TX0 + i * STEP * KT, PAPER_Y, p.zOf(p.pred[i])], P));
  pts.push(iso([TX0 + t * KT, PAPER_Y, p.zOf(p.pred[m])], P));
  sum.setAttribute("d", pathOf(pts));
  carriage.setAttribute("transform", translateAlong(P, [t * KT, 0, 0]));
  stamp.setAttribute("transform", translateAlong(P, [0, -1.1 * Math.exp(-Math.max(0, clock - pressAt) / 90), 0]));
  goButton.setAttribute("transform", translateAlong(P, [0, 0, -1.6 * Math.exp(-Math.max(0, clock - goAt) / 200)]));
  const a = (needleShown * Math.PI) / 180;
  needle.setAttribute("d", pathOf([[0, -2.5], [0, DIAL_R - 3]].map(([, r], j) => iso([PIVOT[0] + Math.sin(a) * (j ? r : -2.5), DIAL_Y + 0.2, PIVOT[1] + Math.cos(a) * (j ? r : -2.5)], P))));
  paintFilm(di, t);
  const eff = INFO[di].eff;
  const text = d.label + " · " + (d.key === "blocked" ? "4 blocks of 20 s" : d.stamps.length + " events") + " · efficiency " + (eff >= 10 ? Math.round(eff) : eff.toFixed(1)) + "% of blocked · t " + Math.round(t) + " s";
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuetext", text);
}

function restart() { t = 0; hold = 0; goAt = clock; drawDesign(); }

function tick(stamp_) {
  const dt = last ? Math.min((stamp_ - last) / 1000, 1 / 30) : 1 / 60;
  last = stamp_;
  clock += dt * 1000;
  needleShown += (angleOf(INFO[di].eff) - needleShown) * (1 - Math.exp(-dt / 0.35));
  if (scrubbing) hold = 0;
  else if (t < RUN_S) t = Math.min(RUN_S, t + dt * SPEED);
  else {
    hold += dt;
    if (hold > HOLD && touring) { di = tourAt++ % DESIGNS.length; restart(); }
  }
  draw();
  frame = visible ? requestAnimationFrame(tick) : 0;
}

const go = () => { if (!frame && visible && !still.matches) { last = 0; frame = requestAnimationFrame(tick); } };
function user() {
  touring = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { touring = !still.matches; scrubbing = false; }, 9000);
}
function choose(i) {
  user();
  scrubbing = false;
  if (i !== undefined) di = i;
  restart();
  if (still.matches) { t = RUN_S; needleShown = angleOf(INFO[di].eff); draw(); return; }
  go();
}
new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) go(); }, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("pointermove", (event) => {
  user();
  scrubbing = true;
  const box = svg.getBoundingClientRect();
  t = clamp(((event.clientX - box.left) / box.width - 0.12) / 0.76, 0, 1) * RUN_S;
  hold = 0;
  if (still.matches) draw(); else go();
});
stage.addEventListener("pointerleave", () => { scrubbing = false; });
stage.addEventListener("click", () => choose());
stage.addEventListener("keydown", (event) => {
  if (/^[1-4]$/.test(event.key)) choose(Number(event.key) - 1);
  else if (event.key === "Enter" || event.key === " ") choose();
  else return;
  event.preventDefault();
});
if (still.matches) t = RUN_S;
drawDesign();
draw();
`;

const css = `<style>
.pr-bar{fill:var(--anatomy-lo);stroke:none}
.pr-bar[data-done]{fill:var(--anatomy-hi)}
</style>`;
const pct = (i) => (INFO[i].eff >= 10 ? Math.round(INFO[i].eff) : INFO[i].eff.toFixed(1));
const body = k.plateHtml({
  fig: "Fig 10",
  title: "HRF printing press",
  hint: "Keys 1–4 · hover to scrub",
  readout: "jittered · 44 events · efficiency 8.3% of blocked · t 0 s",
  keys: [
    { mark: "lit", label: "Lit trace: the predicted signal, the sum of every printed response" },
    { mark: "dashed", label: "Dashed: the response printed for each second of stimulus" },
    { mark: "raised", label: "Stamp: SPM's canonical haemodynamic response (HRF), carried along the design" },
    { mark: "edge", label: `Lightbox: the design matrix, one row per scan (TR ${TR} s): stimulus, predicted signal, constant` },
  ],
  caption:
    `If the BOLD response adds up linearly (nearly true, Fig 9), the signal predicted for any design is the design convolved with one response shape: every second of stimulus prints a copy of the haemodynamic response, and the copies add. The press does exactly that, and the sum, sampled once per scan, becomes a column of the design matrix used in the analysis (Fig 11). ` +
    `The dial shows detection efficiency: how precisely a run of ${RUN_S} s can estimate the size of the response, which grows with how much the predicted signal varies from scan to scan once the mean and slow drifts (SPM's ${HP_CUTOFF} s high-pass filter) are removed. ` +
    `Blocked (1): responses pile up into large plateaus that come and go, the best design for detecting activation (100%). Slow (2): one event every 16 s gives clean, separate responses that show the response's shape, but only ${DESIGNS[1].stamps.length} events fit in the run (${pct(1)}%). Fast fixed (3): an event every 2 s fuses into a flat plateau; with almost nothing varying there is almost nothing to detect (${pct(2)}%). Jittered (4): the same 2 s slots filled at random, with ${DESIGNS[3].stamps.length} events instead of ${DESIGNS[2].stamps.length}, so the signal rises and falls, and the efficiency more than doubles (${pct(3)}%); this is why event-related experiments jitter their timing or mix in null events. ` +
    `Model: SPM's canonical HRF (difference of two gamma functions, peak at 5 s, undershoot near 16 s); 1 s per event; white noise assumed; the display gain (×1, ×2, ×4) changes so each design fills the paper. Detection is not everything: blocked designs are predictable, and comparing trial types needs them mixed in an order the analysis can separate.`,
  body: `<div class="iso-stage" tabindex="0" role="application" aria-roledescription="HRF printing press" aria-label="HRF printing press: keys 1 to 4 choose a blocked, slow, fast fixed or jittered design; Enter prints again; moving across the figure scrubs through the run">${svg}</div>`,
});

writeFileSync(join(HERE, OUT), k.pageHtml({ title: "HRF printing press", theme, body: css + body, script: kitScript() + live }));
console.log("wrote", OUT, INFO.map((x, i) => `${DESIGNS[i].key} ${x.eff.toFixed(1)}% ×${x.gain}`).join(" · "));
