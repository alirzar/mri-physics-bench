// Fig 6 — ASL marble run: arterial spin labelling (pCASL), label, wait, subtract.
// node build.mjs            → asl-marble-run.html (dark)
// node build.mjs --light    → asl-marble-run-light.html
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../_anatomy/kit/iso-kit.mjs";
import { kitScript } from "../_anatomy/scripts/inline-kit.mjs";
import { TISSUES, TAU, PLD_DEFAULT, T1_BLOOD, ALPHA, LAMBDA, AVERAGES, deltaMOf, cbfFrom } from "./model.mjs";
import { loadSlice, lightboxGeometry, lightboxSvg, FILM_JS, MNI_NOTICE } from "../_shared/lightbox.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const OUT = theme === "light" ? "asl-marble-run-light.html" : "asl-marble-run.html";

const WIDTH = 600;
const HEIGHT = 400;

// ── world layout ────────────────────────────────────────────────────────────
const PLATE = { x: -150, y: -110, w: 300, d: 198, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

// the marble-run board stands at the back left; its front face is y = −78
const BOARD = { x: -144, y: -84, w: 136, d: 6, r: 1 };
const BOARD_TOP = 92;
const FACE = BOARD.y + BOARD.d;
const PY = -71; // centre line of every track
const MR = 2.6; // marble radius
// three tracks (floor heights), switching back down the board; the last runs on past the board on posts
const TRACKS = [
  { key: "r1", floor: 76, x0: -138, x1: -12, stop: "left" },
  { key: "r2", floor: 56, x0: -136, x1: -6, stop: "right" },
  { key: "r3", floor: 36, x0: -142, x1: 40, stop: "left", notch: [-18, -10] },
];
const LABEL_X = -84; // the labelling plane (the neck)
const COIL = { x: LABEL_X - 2, w: 4 };
const POSTS = [4, 34]; // supports under the third track beyond the board

// tissue trays at the foot of the board
const TRAY_H = 5;
const TRAYS = {
  csf: { x: -118, y: -60, w: 38, d: 22, r: 2, name: "CSF", cols: 6, rows: 3 },
  gm: { x: -42, y: -60, w: 38, d: 22, r: 2, name: "GM", cols: 6, rows: 3 },
  wm: { x: 22, y: -60, w: 38, d: 22, r: 2, name: "WM", cols: 6, rows: 3 },
};
const slotOf = (tray, i) => [tray.x + 5.5 + (i % tray.cols) * 5.4, tray.y + 5.6 + Math.floor(i / tray.cols) * 5.4, TRAY_H + MR];
const READ_LAMP = [-64, -28];

// marble paths (centres): inlet → labelling plane, then on to the grey-matter notch, then each branch's tail
const f = (track) => TRACKS.find((t) => t.key === track).floor + MR;
const PATH_IN = [[-134, PY, f("r1")], [LABEL_X, PY, f("r1")]];
const PATH_C = [[LABEL_X, PY, f("r1")], [-10, PY, f("r1")], [-8, PY, f("r2")], [-137, PY, f("r2")], [-139, PY, f("r3")], [-14, PY, f("r3")]];
const TAIL = {
  gm: [[-14, PY, f("r3")], [-14, -62, f("r3") - 1]],
  wm: [[-14, PY, f("r3")], [40, PY, f("r3")], [45, -64, f("r3") - 2]],
};

// front: PLD fader, console with stopwatch, averages knob and lamps, readout lamp near the trays
const FADER = { y: 70, rail0: -110, travel: 120 }; // 25 ms per unit, 0–3000 ms
const PANEL_Z = 4;
const CONSOLE = { x: 34, y: 18, w: 106, d: 56, r: 3 };
const CONSOLE_H = 9;
const WATCH = [64, 46];
const WATCH_R = 14.5;
const WATCH_SPAN = 5000; // ms per turn
const AVG_KNOB = [112, 38];
const AVG_DETENTS = [-60, -20, 20, 60];
const LAMPS = { label: [100, 62], control: [124, 62] };

const SLICE = loadSlice();
const LBOX = lightboxGeometry({ x: 40, y: -100, w: 104, d: 12, r: 2 }, SLICE, { grid: [2, 2], labels: ["control", "label", "control − label", "average"] });

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [BOARD.x, BOARD.y, BOARD_TOP], [BOARD.x + BOARD.w, BOARD.y, BOARD_TOP], [LBOX.LB.x + LBOX.LB.w, LBOX.LB.y, LBOX.top]],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: 55 },
);
const KPERP = Math.hypot(...[0, 1].map((i) => k.iso([Math.sin((55 * Math.PI) / 180), -Math.cos((55 * Math.PI) / 180), 0], P)[i] - k.iso([0, 0, 0], P)[i]));

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (pts) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const on = (pts, closed) => k.pathOf(pts.map((p) => at(p)), closed);
const dirOf = (deg) => [Math.sin((deg * Math.PI) / 180), -Math.cos((deg * Math.PI) / 180)];
const faceText = (x, y, z, value, size, anchor = "start", tone = "mid") => k.faceTextSvg(k.sideMatrix([x, y], z, P, "left"), value, { size, tone, anchor });

function pointerOf(K, P, centre, deg, r, z, tail = 1.6) {
  const d = [Math.sin((deg * Math.PI) / 180), -Math.cos((deg * Math.PI) / 180)];
  return K.lineOnTop([centre[0] - d[0] * tail, centre[1] - d[1] * tail], [centre[0] + d[0] * r, centre[1] + d[1] * r], z, P);
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

// ── the board, its tracks (floors first; front lips after the marbles) ─────
function board() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BOARD, 0, 0.1, P)}" style="filter:blur(4px)"/>`];
  for (const fx of [BOARD.x + 4, BOARD.x + BOARD.w - 20]) out.push(S(k.slabOf({ x: fx, y: BOARD.y - 12, w: 16, d: 30, r: 2 }, 0, 4, P, 3, 0.5), { tone: "lo" }));
  out.push(S(k.slabOf(BOARD, 4, BOARD_TOP - 4, P, 3, 0.8), { tone: "mid", inner: L(k.sideSeam(BOARD, 10, P, 3), { tone: "faint" }) }));
  out.push(D([[BOARD.x + 4, 8], [BOARD.x + BOARD.w - 4, 8], [BOARD.x + 4, BOARD_TOP - 4], [BOARD.x + BOARD.w - 4, BOARD_TOP - 4]].map(([x, z]) => at([x, FACE, z])), { size: 0.5 }));
  // inlet from the heart: a bore in the board where the first track starts
  const ring = (cx, cz, r) => on(Array.from({ length: 28 }, (_, i) => [cx + r * Math.cos((2 * Math.PI * i) / 28), FACE, cz + r * Math.sin((2 * Math.PI * i) / 28)]), true);
  out.push(L(ring(-134, f("r1"), 4.2) + ring(-134, f("r1"), 3), { tone: "lo" }));
  out.push(faceText(-142, FACE, 86, "heart", 3.6));
  out.push(faceText(-124, FACE, 86, "neck · RF label", 3.6));
  // the coil's lower bar sits under the first track
  out.push(S(k.slabOf({ x: COIL.x, y: FACE, w: COIL.w, d: 17.4, r: 0.6 }, f("r1") - MR - 8, 2, P, 2, 0.3), { tone: "mid" }));
  return out.join("");
}

function trackFloors() {
  const out = [];
  for (const t of TRACKS) {
    const floor = { x: t.x0, y: FACE, w: t.x1 - t.x0, d: 14, r: 0.8 };
    for (const bx of t.key === "r3" ? [-120, -50] : t.key === "r2" ? [-110, -30] : [-120, -40]) {
      out.push(S(k.slabOf({ x: bx - 1, y: FACE, w: 2, d: 10, r: 0.4 }, t.floor - 9, 7, P, 2, 0.3), { tone: "lo" }));
      out.push(D([at([bx, FACE, t.floor - 4])], { size: 0.4 }));
    }
    out.push(S(k.slabOf(floor, t.floor - 2, 2, P, 3, 0.4), { tone: "mid" }));
    out.push(L(k.lineOnTop([t.x0, PY - 4.5], [t.x1, PY - 4.5], t.floor, P) + k.lineOnTop([t.x0, PY + 4.5], [t.x1, PY + 4.5], t.floor, P), { tone: "faint" }));
    const stop = t.stop === "left" ? { x: t.x0, y: FACE, w: 1.6, d: 14, r: 0.4 } : { x: t.x1 - 1.6, y: FACE, w: 1.6, d: 14, r: 0.4 };
    out.push(S(k.slabOf(stop, t.floor, 3.4, P, 2, 0.3), { tone: "mid" }));
  }
  for (const x of POSTS) {
    out.push(S(k.cylinder(x, PY, 4, 0, 2, P, 24), { tone: "lo" }));
    out.push(S(k.cylinder(x, PY, 2.2, 2, f("r3") - MR - 4, P, 18), { tone: "mid", crease: "none", inner: L(k.sideArc(x, PY, 2.2, 14, P, 12), { tone: "faint" }) }));
  }
  return out.join("");
}

function trackLips() {
  const out = [];
  for (const t of TRACKS) {
    const spans = t.notch ? [[t.x0, t.notch[0]], [t.notch[1], t.x1]] : [[t.x0, t.x1]];
    for (const [a, b] of spans) out.push(S(k.slabOf({ x: a, y: FACE + 12.4, w: b - a, d: 1.6, r: 0.4 }, t.floor, 2.2, P, 2, 0.3), { tone: "mid" }));
  }
  return out.join("");
}

// the labelling coil: a rectangular loop around the neck track, lit while it labels
function coilFront() {
  const post = { x: COIL.x, y: FACE + 15.4, w: COIL.w, d: 2, r: 0.5 };
  const bar = { x: COIL.x, y: FACE, w: COIL.w, d: 17.4, r: 0.6 };
  const z0 = f("r1") - MR - 8;
  const top = f("r1") + 10;
  const parts =
    S(k.slabOf(post, z0, top - z0, P, 2, 0.3), { tone: "mid" }) +
    S(k.slabOf(bar, top, 3, P, 2, 0.3), { tone: "mid" });
  const turns = [];
  for (let y = FACE + 1.5; y <= FACE + 16; y += 2) turns.push(k.lineOnTop([COIL.x, y], [COIL.x + COIL.w, y], top + 3, P));
  for (let z = z0 + 2; z <= top - 1; z += 2.5) turns.push(k.segment([COIL.x, post.y + post.d, z], [COIL.x + COIL.w, post.y + post.d, z], P));
  const lit =
    S(k.slabOf(post, z0, top - z0, P, 2, 0.3), { tone: "hi", lit: true }) +
    S(k.slabOf(bar, top, 3, P, 2, 0.3), { tone: "hi", lit: true });
  return parts + L(turns.join(""), { tone: "lo" }) + `<g data-part="coil-glow" opacity="0">${lit}</g>`;
}

// ── trays ───────────────────────────────────────────────────────────────────
function trays() {
  const out = [];
  for (const tray of Object.values(TRAYS)) {
    out.push(S(k.slabOf(tray, 0, TRAY_H, P, 4, 0.6), { tone: "mid" }));
    out.push(L(k.planOutline(k.insetPlan(tray, 2.2), TRAY_H, P, 4), { tone: "lo" }));
    out.push(faceText(tray.x + tray.w / 2, tray.y + tray.d, 1.1, tray.name, 3.8, "middle"));
    out.push(D([at([tray.x + 1.2, tray.y + 1.2, TRAY_H]), at([tray.x + tray.w - 1.2, tray.y + tray.d - 1.2, TRAY_H])], { size: 0.4 }));
  }
  return out.join("");
}

function readLamp() {
  const [x, y] = READ_LAMP;
  return (
    S(k.cylinder(x, y, 4.4, 0, 2, P, 28), { tone: "lo" }) +
    S(k.cylinder(x, y, 1.4, 2, 18, P, 14), { tone: "mid", crease: "none" }) +
    S(k.cylinder(x, y, 3.6, 20, 5, P, 28, 0.4), { tone: "mid", inner: L(k.sideArc(x, y, 3.6, 22, P, 20), { tone: "faint" }) }) +
    S(k.cylinder(x, y, 2.6, 25, 1.4, P, 24), { tone: "lo" }) +
    `<g data-part="flash" opacity="0">${S(k.cylinder(x, y, 2.6, 25, 1.4, P, 24), { tone: "hi", lit: true })}</g>`
  );
}

// ── PLD fader ──────────────────────────────────────────────────────────────
function fader() {
  const { y, rail0, travel } = FADER;
  const panel = { x: rail0 - 24, y: y - 9, w: travel + 36, d: 19, r: 2.5 };
  const out = [S(k.slabOf(panel, 0, PANEL_Z, P, 4, 0.6), { tone: "mid" })];
  const slot = { x: rail0 - 1.2, y: y - 1.4, w: travel + 2.4, d: 2.8, r: 1.4 };
  out.push(S(k.slabOf(slot, PANEL_Z - 0.4, 0.4, P, 4), { tone: "lo", crease: "none", flat: true }));
  out.push(L(k.planOutline(slot, PANEL_Z, P, 4), { tone: "lo" }));
  const strip = { x: rail0 - 3, y: y + 3.4, w: travel + 6, d: 5, r: 0.8 };
  out.push(S(k.slabOf(strip, PANEL_Z, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const minor = [];
  const major = [];
  for (let ms = 0; ms <= 3000; ms += 100) (ms % 500 === 0 ? major : minor).push(k.lineOnTop([rail0 + ms / 25, strip.y], [rail0 + ms / 25, strip.y + (ms % 500 === 0 ? 3.6 : 2)], PANEL_Z + 0.6, P));
  out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }));
  // transit times: the PLD has to be longer than these for the label to have arrived
  out.push(D(TISSUES.filter((t) => t.cbf).map((t) => at([rail0 + t.att / 25, strip.y, PANEL_Z + 0.6])), { size: 1, tone: "hi" }));
  out.push(k.faceTextSvg(k.topMatrix([rail0 - 12, y + 1.8], PANEL_Z, P, "x"), "PLD", { size: 4.6, tone: "hi", anchor: "middle" }));
  out.push(D(byDepth(k.corners(panel, 3)).map(([x, yy]) => at([x, yy, PANEL_Z])), { size: 0.45 }));
  const cap = { x: -5, y: y - 6.5, w: 10, d: 13, r: 1.6 };
  const knob =
    S(k.slabOf({ x: -1.2, y: y - 1.2, w: 2.4, d: 2.4, r: 0.6 }, PANEL_Z - 0.4, 1.4, P, 2), { tone: "lo", crease: "none" }) +
    S(k.slabOf(cap, PANEL_Z + 1, 7, P, 4, 0.6), { tone: "hi", crease: "lo", inner: L(k.sideSeam(cap, PANEL_Z + 3, P, 4), { tone: "faint" }) }) +
    L([-2.6, 2.6].map((dx) => k.lineOnTop([dx, cap.y], [dx, cap.y + cap.d], PANEL_Z + 8, P)).join(""), { tone: "lo" }) +
    L(k.lineOnTop([0, cap.y], [0, cap.y + cap.d], PANEL_Z + 8, P), { tone: "hi" });
  out.push(`<g data-part="knob" transform="${k.translateAlong(P, [rail0 + PLD_DEFAULT / 25, 0, 0])}">${knob}</g>`);
  return out.join("");
}

// ── console: stopwatch, averages knob, label and control lamps ─────────────
function console_() {
  const z = CONSOLE_H;
  const out = [S(k.slabOf(CONSOLE, 0, CONSOLE_H, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(CONSOLE, 3.5, P, 4), { tone: "faint" }) })];
  // stopwatch: one turn is 5 s; lit marks at the end of labelling and at the readout
  const [wx, wy] = WATCH;
  out.push(S(k.cylinder(wx, wy - WATCH_R - 1.6, 1.8, z, 3, P, 16), { tone: "mid" }));
  out.push(S(k.cylinder(wx, wy - WATCH_R - 1.6, 2.6, z + 3, 2.4, P, 20), { tone: "mid" }));
  out.push(L(k.knurl(wx, wy - WATCH_R - 1.6, 2.6, z + 3, z + 5.4, 16, P), { tone: "lo" }));
  out.push(S(k.cylinder(wx, wy, WATCH_R + 1.4, z, 1.2, P, 64), { tone: "lo" }));
  out.push(S(k.cylinder(wx, wy, WATCH_R, z + 1.2, 5, P, 72, 0.6), { tone: "hi", crease: "lo", inner: L(k.sideArc(wx, wy, WATCH_R, z + 3, P, 48), { tone: "faint" }) }));
  const top = z + 6.2;
  out.push(L(k.ring(wx, wy, WATCH_R - 1.6, top, P, 72), { tone: "lo" }));
  const ticks = k.radialTicks(wx, wy, WATCH_R - 1.6, 50, 10, top, [1.2, 2.6], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(`<g data-part="watch-marks"></g>`);
  out.push(`<path data-part="watch-needle" class="iso-line" data-tone="lit" data-free="" d="${pointerOf(k, P, WATCH, 0, WATCH_R - 3.2, top + 0.2, 3)}" style="stroke-width:1"/>`);
  out.push(L(k.ring(wx, wy, 1.2, top, P, 14), { tone: "mid" }));
  // averages knob: 1, 4, 16 or 64 label–control pairs
  const [ax, ay] = AVG_KNOB;
  out.push(L(k.ring(ax, ay, 9, z, P, 48), { tone: "faint" }));
  out.push(L(AVG_DETENTS.map((deg) => { const d = dirOf(deg); return k.lineOnTop([ax + d[0] * 9, ay + d[1] * 9], [ax + d[0] * 7.2, ay + d[1] * 7.2], z, P); }).join(""), { tone: "hi" }));
  AVERAGES.forEach((n, i) => { const d = dirOf(AVG_DETENTS[i]); out.push(k.faceTextSvg(k.topMatrix([ax + d[0] * 12.8, ay + d[1] * 12.8 + 1.4], z, P, "x"), String(n), { size: 3.4, tone: "mid", anchor: "middle" })); });
  out.push(S(k.cylinder(ax, ay, 5.4, z, 4.5, P, 36, 0.4), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(ax, ay, 5.4, z, z + 4.5, 36, P), { tone: "lo" }));
  out.push(`<path data-part="avg-pointer" class="iso-line" data-tone="hi" data-free="" d="${pointerOf(k, P, AVG_KNOB, AVG_DETENTS[AVERAGES.indexOf(16)], 4.4, z + 4.5)}"/>`);
  out.push(k.faceTextSvg(k.topMatrix([ax, ay + 12], z, P, "x"), "pairs", { size: 3.6, tone: "mid", anchor: "middle" }));
  // lamps: which acquisition is running
  for (const [name, [lx, ly]] of Object.entries(LAMPS)) {
    out.push(S(k.cylinder(lx, ly, 3.8, z, 1.2, P, 24), { tone: "lo" }));
    out.push(S(k.cylinder(lx, ly, 2.6, z + 1.2, 1.4, P, 20), { tone: "mid" }));
    out.push(`<g data-part="lamp-${name}" opacity="0">${S(k.cylinder(lx, ly, 2.6, z + 1.2, 1.4, P, 20), { tone: "hi", lit: true })}</g>`);
    out.push(k.faceTextSvg(k.topMatrix([lx, ly + 8], z, P, "x"), name, { size: 3.6, tone: "mid", anchor: "middle" }));
  }
  out.push(faceText(CONSOLE.x + 6, CONSOLE.y + CONSOLE.d, 3.4, `pCASL · label ${TAU / 1000} s`, 4));
  out.push(D(byDepth(k.corners(CONSOLE, 3)).map(([x, y]) => at([x, y, CONSOLE_H])), { size: 0.45 }));
  return out.join("");
}

// ── assemble ────────────────────────────────────────────────────────────────
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A marble run standing on a bench. Marbles, standing for blood water, leave a bore marked heart and roll along three switchback tracks down a board. Around the first track, the neck, a rectangular RF coil tags the marbles that pass while it is labelling; tagged marbles are lit and fade as the label relaxes. Three quarters of the marbles drop out through a notch into the grey-matter tray, a quarter roll on along the last track to the white-matter tray, and the CSF tray gets none. A lamp flashes at the readout. A fader sets the post-labelling delay, a stopwatch shows the timing, lamps show whether the label or the control image is being taken, a knob sets how many pairs are averaged, and a lightbox holds the control, label, difference and averaged brain films.",
  body: [
    plate(),
    lightboxSvg(k, P, LBOX),
    board(),
    trackFloors(),
    trays(),
    `<g data-part="marbles"></g>`,
    trackLips(),
    coilFront(),
    readLamp(),
    fader(),
    console_(),
  ],
});

const modelSource = readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "");

const live = `
${modelSource}
const pointerOf = ${pointerOf.toString()};
const P = ${JSON.stringify(P)};
const K = { lineOnTop };
const MR = ${MR}, KPERP = ${KPERP};
const PATH_IN = ${JSON.stringify(PATH_IN)}, PATH_C = ${JSON.stringify(PATH_C)}, TAIL = ${JSON.stringify(TAIL)};
const TRAYS = ${JSON.stringify(TRAYS)}, TRAY_H = ${TRAY_H};
const slotOf = (tray, i) => [tray.x + 5.5 + (i % tray.cols) * 5.4, tray.y + 5.6 + Math.floor(i / tray.cols) * 5.4, TRAY_H + MR];
const RAIL0 = ${FADER.rail0};
const WATCH = ${JSON.stringify(WATCH)}, WATCH_R = ${WATCH_R}, WATCH_TOP = ${CONSOLE_H + 6.2}, WATCH_SPAN = ${WATCH_SPAN};
const AVG_KNOB = ${JSON.stringify(AVG_KNOB)}, AVG_DETENTS = ${JSON.stringify(AVG_DETENTS)}, AVG_Z = ${CONSOLE_H + 4.5};
const SPEED = 0.6; // simulated ms per real ms
const RATE = 8 / 1000; // marbles per ms
const T0 = 250; // ms from the inlet to the labelling plane
const TC = 950; // ms from the labelling plane to the grey-matter notch
const WIN = 0.007; // display window for difference images (fraction of M0)
const GM = TISSUES.find((t) => t.key === "gm"), WM = TISSUES.find((t) => t.key === "wm");
const ATT = { gm: GM.att, wm: WM.att };
${FILM_JS}
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const SLICE = ${JSON.stringify(SLICE)};
const KEYS = TISSUES.map((t) => t.key);
const films = {
  control: makeFilm(svg, SLICE, KEYS, "film-0", { seed: 11 }),
  label: makeFilm(svg, SLICE, KEYS, "film-1", { seed: 23 }),
  diff: makeFilm(svg, SLICE, KEYS, "film-2", { seed: 37, signed: true }),
  avg: makeFilm(svg, SLICE, KEYS, "film-3", { seed: 41, signed: true }),
};
const q = (name) => svg.querySelector('[data-part="' + name + '"]');
const marblesEl = q("marbles"), coilGlow = q("coil-glow"), flash = q("flash"), knob = q("knob");
const needle = q("watch-needle"), watchMarks = q("watch-marks"), avgPointer = q("avg-pointer");
const lamps = { label: q("lamp-label"), control: q("lamp-control") };
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ── polylines ─────────────────────────────────────────────────────────────
const lengthOf = (pts) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1], p[2] - pts[i][2]), 0);
function along(pts, u) {
  let left = clamp(u, 0, 1) * lengthOf(pts);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const seg = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    if (left <= seg || i === pts.length - 1) { const s = seg ? Math.min(1, left / seg) : 1; return [0, 1, 2].map((j) => a[j] + (b[j] - a[j]) * s); }
    left -= seg;
  }
  return pts[pts.length - 1];
}

// ── state ─────────────────────────────────────────────────────────────────
let want = { pld: ${PLD_DEFAULT}, avg: 16 };
let run = { pld: want.pld, avg: want.avg };
let pldShown = want.pld, avgShown = AVERAGES.indexOf(want.avg);
let now = 0, trStart = 0, phase = "label", readDone = false, flashAt = -1e9, pairs = 0, seed = 1;
let nextN = 0;
const marbles = new Map();
const slotsUsed = { gm: 0, wm: 0, csf: 0 };
let frame = 0, last = 0, visible = false, touring = !still.matches, idleTimer = 0, tourAt = 1;
const TOUR = [{ pld: 1800, avg: 1 }, { pld: 1800, avg: 16 }, { pld: 1800, avg: 64 }, { pld: 600, avg: 64 }];
const trLength = () => TAU + run.pld + READ_TAIL;

function spawn() {
  while (nextN / RATE <= now) {
    const n = nextN++;
    marbles.set(n, { n, emit: n / RATE, branch: n % 4 === 2 ? "wm" : "gm", passed: false, tagged: false, slot: null, landed: false });
  }
}

function update() {
  for (const m of marbles.values()) {
    const s = now - m.emit;
    if (!m.passed && s >= T0) {
      m.passed = true;
      const passTime = m.emit + T0;
      if (phase === "label" && passTime - trStart >= 0 && passTime - trStart <= TAU) { m.tagged = true; m.tagTime = passTime; }
    }
    if (m.tagged && m.slot === null && s >= T0 + TC) {
      const tray = TRAYS[m.branch];
      m.slot = slotOf(tray, Math.min(slotsUsed[m.branch]++, tray.cols * tray.rows - 1));
    }
    if (!m.landed && s >= T0 + ATT[m.branch]) { m.landed = true; m.landTime = m.emit + T0 + ATT[m.branch]; }
    if (m.landed && !m.tagged && now - m.landTime > 350) marbles.delete(m.n);
    if (m.landed && m.tagged && m.cleared) marbles.delete(m.n);
  }
}

function positionOf(m) {
  const s = now - m.emit;
  if (s < T0) return along(PATH_IN, s / T0);
  if (s < T0 + TC) return along(PATH_C, (s - T0) / TC);
  const tray = TRAYS[m.branch];
  const end = m.slot || [tray.x + 8 + ((m.n * 7) % (tray.w - 16)), tray.y + 6 + ((m.n * 5) % (tray.d - 12)), TRAY_H + MR];
  if (s < T0 + ATT[m.branch]) return along(TAIL[m.branch].concat([end]), (s - T0 - TC) / (ATT[m.branch] - TC));
  return end;
}

function readoutNow() {
  readDone = true;
  flashAt = now;
  seed += 1;
  const r = TISSUES.map((t) => deltaMOf(t, run.pld));
  if (phase === "label") films.label(TISSUES.map((t, i) => t.PD * (1 - r[i])), NOISE, seed);
  else paintPair(seed);
}

function paintPair(s) {
  const r = TISSUES.map((t) => deltaMOf(t, run.pld));
  films.control(TISSUES.map((t) => t.PD), NOISE, s);
  films.diff(TISSUES.map((t, i) => (t.PD * r[i]) / WIN), (NOISE * Math.SQRT2) / WIN, s + 1000);
  films.avg(TISSUES.map((t, i) => (t.PD * r[i]) / WIN), (NOISE * Math.SQRT2) / Math.sqrt(run.avg) / WIN, s + 2000);
}

function nextTR() {
  for (const m of marbles.values()) if (m.tagged && m.landed) m.cleared = true;
  slotsUsed.gm = slotsUsed.wm = 0;
  if (phase === "label") phase = "control";
  else {
    phase = "label";
    pairs += 1;
    if (touring) Object.assign(want, TOUR[tourAt++ % TOUR.length]);
    run = { pld: want.pld, avg: want.avg };
  }
  trStart = now;
  readDone = false;
}

function step(dt) {
  now += dt;
  spawn();
  update();
  const t = now - trStart;
  if (!readDone && t >= TAU + run.pld) readoutNow();
  if (t >= trLength()) nextTR();
}

function draw() {
  // marbles, back to front
  const items = [...marbles.values()].map((m) => { const p = positionOf(m); return { m, p, depth: depthOf(p, P) }; }).sort((a, b) => a.depth - b.depth);
  const rr = (MR * KPERP).toFixed(2);
  marblesEl.innerHTML = items.map(({ m, p }) => {
    const [cx, cy] = iso(p, P);
    const label = m.tagged ? labelLeft(now - m.tagTime) : 0;
    return '<circle class="asl-marble" cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + rr + '"/>' +
      (label > 0.02 ? '<circle class="asl-tag" cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + rr + '" opacity="' + label.toFixed(2) + '"/>' : "");
  }).join("");
  const t = now - trStart;
  coilGlow.setAttribute("opacity", phase === "label" && t <= TAU ? "1" : "0");
  lamps.label.setAttribute("opacity", phase === "label" ? "1" : "0");
  lamps.control.setAttribute("opacity", phase === "control" ? "1" : "0");
  flash.setAttribute("opacity", Math.exp(-Math.max(0, now - flashAt) / 250).toFixed(2));
  knob.setAttribute("transform", translateAlong(P, [RAIL0 + pldShown / 25, 0, 0]));
  avgPointer.setAttribute("d", pointerOf(K, P, AVG_KNOB, AVG_DETENTS[0] + avgShown * 40, 4.4, AVG_Z));
  const angle = (ms) => (360 * (ms % WATCH_SPAN)) / WATCH_SPAN;
  needle.setAttribute("d", pointerOf(K, P, WATCH, angle(t), WATCH_R - 3.2, WATCH_TOP + 0.2, 3));
  watchMarks.innerHTML = dotsSvg([TAU, TAU + run.pld].map((ms) => { const a = (angle(ms) * Math.PI) / 180; return iso([WATCH[0] + Math.sin(a) * (WATCH_R - 1.6), WATCH[1] - Math.cos(a) * (WATCH_R - 1.6), WATCH_TOP], P); }), { size: 1, tone: "hi" });
  const rg = deltaMOf(GM, run.pld), rw = deltaMOf(WM, run.pld);
  const text = phase + " · PLD " + Math.round(run.pld) + " · ΔM " + (rg * 100).toFixed(2) + "% · CBF " + Math.round(cbfFrom(rg, run.pld)) + "/" + Math.round(cbfFrom(rw, run.pld)) + " · " + run.avg + (run.avg > 1 ? " pairs" : " pair");
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuetext", text);
}

function tick(stamp) {
  const dt = last ? Math.min(stamp - last, 50) : 16;
  last = stamp;
  const ease = 1 - Math.exp(-dt / 300);
  pldShown += (want.pld - pldShown) * ease;
  avgShown += (AVERAGES.indexOf(want.avg) - avgShown) * ease;
  let simDt = dt * SPEED;
  while (simDt > 0) { const h = Math.min(simDt, 10); step(h); simDt -= h; }
  draw();
  frame = visible ? requestAnimationFrame(tick) : 0;
}

const go = () => { if (!frame && visible && !still.matches) { last = 0; frame = requestAnimationFrame(tick); } };
function steer(change) {
  touring = false;
  Object.assign(want, change);
  want.pld = clamp(Math.round(want.pld / 50) * 50, PLD_RANGE[0], PLD_RANGE[1]);
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { touring = !still.matches; }, 9000);
  if (still.matches) { settle(); return; }
  go();
}
// still frame: run one full pair at the chosen settings, then stop at the label readout of the next
function settle() {
  run = { ...want };
  pldShown = want.pld;
  avgShown = AVERAGES.indexOf(want.avg);
  now = 0; trStart = 0; phase = "label"; readDone = false; nextN = 0; marbles.clear(); slotsUsed.gm = slotsUsed.wm = 0;
  const target = 2 * trLength() + TAU + run.pld + 1;
  while (now < target) step(10);
  flashAt = -1e9;
  draw();
}
new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) go(); }, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("pointermove", (event) => {
  const box = svg.getBoundingClientRect();
  steer({ pld: clamp(((event.clientX - box.left) / box.width - 0.12) / 0.76, 0, 1) * PLD_RANGE[1] });
});
stage.addEventListener("keydown", (event) => {
  if (event.key === "ArrowRight") steer({ pld: want.pld + 100 });
  else if (event.key === "ArrowLeft") steer({ pld: want.pld - 100 });
  else if (/^[1-4]$/.test(event.key)) steer({ avg: AVERAGES[Number(event.key) - 1] });
  else return;
  event.preventDefault();
});
// first paint: films as they would look after one pair at the starting settings
films.label(TISSUES.map((t) => t.PD * (1 - deltaMOf(t, run.pld))), NOISE, 7);
paintPair(7);
if (still.matches) settle(); else draw();
`;

const gm = TISSUES.find((t) => t.key === "gm");
const wm = TISSUES.find((t) => t.key === "wm");
const css = `<style>.asl-marble{fill:var(--anatomy-top);stroke:var(--anatomy-mid);stroke-width:0.5}.asl-tag{fill:var(--anatomy-lit);stroke:none}</style>`;
const body = k.plateHtml({
  fig: "Fig 6",
  title: "ASL marble run",
  hint: "Hover or keys 1–4",
  readout: `label · PLD ${PLD_DEFAULT} · ΔM ${(deltaMOf(gm, PLD_DEFAULT) * 100).toFixed(2)}% · CBF ${Math.round(cbfFrom(deltaMOf(gm, PLD_DEFAULT), PLD_DEFAULT))}/${Math.round(cbfFrom(deltaMOf(wm, PLD_DEFAULT), PLD_DEFAULT))} · 16 pairs`,
  keys: [
    { mark: "lit", label: `Tagged marbles: labelled blood water; the tag fades with blood T1 (${T1_BLOOD} ms)` },
    { mark: "flat", label: "Readout: grey-matter ΔM as a share of its signal, and CBF in grey/white matter (ml/100 g/min) as the scanner would compute it" },
    { mark: "raised", label: "Coil round the neck track: the labelling plane · trays: grey matter, white matter, CSF" },
    { mark: "dotted", label: "Lit dots: grey- and white-matter transit times on the PLD scale; end of labelling and readout on the stopwatch (one turn = 5 s)" },
    { mark: "edge", label: `Lightbox: control, label, their difference, and the average of the chosen number of pairs (MNI152 slice z = +${SLICE.z} mm)` },
  ],
  caption:
    `Arterial spin labelling measures blood flow with blood water as its own tracer. For ${TAU / 1000} s an RF coil at the neck inverts the magnetization of blood flowing past (pseudo-continuous ASL, labelling efficiency ${ALPHA}); after a post-labelling delay (PLD) the labelled water has reached the brain and exchanged into tissue, and an image is taken. A control image is taken the same way without labelling, and the difference, control − label, is proportional to cerebral blood flow (CBF). ` +
    `The difference is tiny: about ${(deltaMOf(gm, 1800) * 100).toFixed(1)}% of the grey-matter signal at the recommended PLD of 1.8 s, so control and label look identical and a single pair is mostly noise (here a single pair gives a grey-matter signal-to-noise ratio of about 1, an illustrative figure). Averaging N pairs improves it by √N. ` +
    `Timing matters. Labelled blood takes a transit time to arrive (here ${gm.att} ms for grey matter and ${wm.att} ms for white matter), and the label decays with blood T1 (${T1_BLOOD} ms at 3 T) on the way. The scanner computes CBF = 6000 · λ · ΔM · e^(PLD/T1b) / (2 · α · T1b · M0 · (1 − e^(−τ/T1b))), with λ = ${LAMBDA} ml/g, which is right only when the PLD is longer than the transit time: shorten the PLD below the lit dots and the estimates fall (to about ${Math.round(cbfFrom(deltaMOf(gm, 600), 600))} and ${Math.round(cbfFrom(deltaMOf(wm, 600), 600))} ml/100 g/min at 600 ms instead of ${gm.cbf} and ${wm.cbf}); lengthen it and the estimates stay right but the signal, and so the signal-to-noise ratio, falls. CSF has no blood flow and stays dark. ` +
    `Signal model: the general kinetic model for pCASL (Buxton et al. 1998) with the consensus simplifications (Alsop et al. 2015). The marble run is drawn at 0.6× real time; each marble stands for a great many water molecules, grey matter receives three times the flow of white matter, and the tracks' lengths are not to scale. ` +
    MNI_NOTICE,
  body: `<div class="iso-stage" tabindex="0" role="application" aria-roledescription="ASL marble run" aria-label="ASL marble run: left and right arrows change the post-labelling delay by 100 ms, keys 1 to 4 average 1, 4, 16 or 64 pairs">${svg}</div>`,
});

writeFileSync(join(HERE, OUT), k.pageHtml({ title: "ASL marble run", theme, body: css + body, script: kitScript() + live }));
console.log("wrote", OUT);
