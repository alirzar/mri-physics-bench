// Fig 9 — BOLD balloon: from neural activity to the fMRI signal.
// node build.mjs            → bold-balloon.html (dark)
// node build.mjs --light    → bold-balloon-light.html
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../_anatomy/kit/iso-kit.mjs";
import { kitScript } from "../_anatomy/scripts/inline-kit.mjs";
import { PARAMS, RUN_S, DESIGNS, EPI, V1, simulate } from "./model.mjs";
import { loadSlice, lightboxGeometry, lightboxSvg, FILM_JS, MNI_NOTICE } from "../_shared/lightbox.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const OUT = theme === "light" ? "bold-balloon-light.html" : "bold-balloon.html";

const WIDTH = 600;
const HEIGHT = 400;
const GAIN = 20; // the change film shows the signal change ×20
const SWELL = 1.6; // the balloon's swelling is drawn 1.6× the model's volume change so that a few per cent shows

// ── world layout ────────────────────────────────────────────────────────────
const PLATE = { x: -150, y: -110, w: 300, d: 198, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

// stimulus monitor at the back left
const MONITOR = { x: -148, y: -104, w: 46, d: 8, r: 2 };
const MON_Z = [18, 60];
const SCREEN = { x0: -145, x1: -105, z0: 22, z1: 56, cols: 8, rows: 7 };
const SCREEN_Y = MONITOR.y + MONITOR.d + 0.4;

// neurons: a lamp at the front left, wired to the arteriole (neurovascular coupling)
const LAMP = [-132, -8];

// the vascular line along y = −36: artery → arteriole valve → flow meter → venous balloon → outflow
const LINE_Y = -36;
const DUCT_Z = [20, 28];
const SOURCE = { x: -124, y: -43, w: 18, d: 14, r: 3 };
const SOURCE_H = 32;
const VALVE = { x: -90, y: -43, w: 18, d: 14, r: 3 };
const VALVE_TOP = 34;
const VALVE_C = [-81, LINE_Y];
const WHEEL_R = 7.5;
const WHEEL_Z = VALVE_TOP + 5; // underside of the handwheel
const WHEEL_H = 1.6;
const METER = { x: -56, y: -44, w: 16, d: 16, r: 3 };
const METER_H = 28;
const METER_C = [-48, LINE_Y];
const TUBE_R = 4.2;
const TUBE_TOP = 74;
const METER_Z0 = 32; // float bottom at rest (f = 1)
const METER_K = 32; // float travel per unit of flow above rest
const BALLOON = [-4, LINE_Y, 37];
const R0 = 15;
const BASE = { x: -14, y: -44, w: 20, d: 16, r: 3 }; // plinth under the balloon
const BASE_H = 8;
const DRAIN = { x: 34, y: -43, w: 18, d: 14, r: 3 };
const DRAIN_H = 32;
const DUCTS = [
  { x: SOURCE.x + SOURCE.w, w: VALVE.x - SOURCE.x - SOURCE.w },
  { x: VALVE.x + VALVE.w, w: METER.x - VALVE.x - VALVE.w },
  { x: METER.x + METER.w, w: BALLOON[0] - 7 - METER.x - METER.w },
  { x: BALLOON[0] + 5, w: DRAIN.x - BALLOON[0] - 5 },
];

// recorder at the front right: stimulus bars and the BOLD trace
const REC_BASE = { x: 14, y: 50, w: 130, d: 26, r: 3 };
const REC_BASE_H = 6;
const BOARD = { x: 16, y: 52, w: 126, d: 5, r: 1 };
const BOARD_TOP = 52;
const FACE_Y = BOARD.y + BOARD.d;
const PAPER = { x: 18, w: 122, z0: 9, z1: 46 };
const PAPER_Y = FACE_Y + 0.4;
const TX0 = 30;
const TX1 = 136;
const KT = (TX1 - TX0) / RUN_S;
const STIM_Z = 11;
const BOLD_Z = 21;
const PCT = 6; // units per 1 % BOLD
const PEN_DX = 5;

// console at the front left: three design keys and a go button
const CONSOLE = { x: -118, y: 52, w: 104, d: 28, r: 3 };
const CONSOLE_H = 9;
const KEYS = [-100, -74, -48];
const KEY_Y = 60;
const GO = [-26, 62];

// slice data plus two derived planes: the brain, and visual cortex (illustrative)
const SLICE0 = loadSlice();
const SLICE = (() => {
  const un = (b64) => Buffer.from(b64, "base64");
  const gm = un(SLICE0.gm), wm = un(SLICE0.wm), csf = un(SLICE0.csf);
  const W = SLICE0.width, H = SLICE0.height, A = SLICE0.affine;
  const brain = Buffer.alloc(W * H), v1 = Buffer.alloc(W * H);
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const p = r * W + c;
    brain[p] = Math.min(255, gm[p] + wm[p] + csf[p]);
    const i = SLICE0.i_last - c, j = SLICE0.j_last - r;
    const x = A[0][0] * i + A[0][3], y = A[1][1] * j + A[1][3];
    const e = Math.exp(-(((x - V1.x) / V1.rx) ** 2 + ((y - V1.y) / V1.ry) ** 2));
    v1[p] = e > 0.05 ? Math.round(gm[p] * e) : 0;
  }
  return { ...SLICE0, brain: brain.toString("base64"), v1: v1.toString("base64") };
})();
const LBOX = lightboxGeometry({ x: 44, y: -100, w: 102, d: 12, r: 2 }, SLICE, { grid: [2, 1], labels: ["EPI image", `change ×${GAIN}`] });

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [MONITOR.x, MONITOR.y, MON_Z[1]], [METER_C[0], METER_C[1], TUBE_TOP + 3], [LBOX.LB.x, LBOX.LB.y, LBOX.top], [LBOX.LB.x + LBOX.LB.w, LBOX.LB.y, LBOX.top]],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: 55 },
);
const { k: KPX } = k.cameraOf(P); // screen units per world unit across the line of sight (a sphere's radius)

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (pts) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const on = (pts, closed) => k.pathOf(pts.map((p) => at(p)), closed);
const topText = (x, y, z, value, size = 3.4, anchor = "middle", tone = "mid") => k.faceTextSvg(k.topMatrix([x, y], z, P, "x"), value, { size, tone, anchor });
const frontText = (x, y, z, value, size = 3.4, anchor = "start", tone = "mid") => k.faceTextSvg(k.sideMatrix([x, y], z, P, "left"), value, { size, tone, anchor });
const block = (plan, h, seam = 8) => S(k.slabOf(plan, 0, h, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(plan, seam, P, 3), { tone: "faint" }) });

// spokes of the valve's handwheel, turned by `turn` degrees
function spokesOf(K, P, c, z, turn, hub, rim) {
  let d = "";
  for (let i = 0; i < 3; i++) {
    const a = ((turn + i * 120) * Math.PI) / 180;
    d += K.lineOnTop([c[0] + Math.cos(a) * hub, c[1] + Math.sin(a) * hub], [c[0] + Math.cos(a) * rim, c[1] + Math.sin(a) * rim], z, P);
  }
  return d;
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

// ── stimulus monitor with a reversing checkerboard ─────────────────────────
function monitor() {
  const foot = { x: -136, y: -108, w: 22, d: 14, r: 3 };
  const out = [`<path class="iso-halo" d="${k.haloOf(foot, 0, 0.1, P)}" style="filter:blur(4px)"/>`];
  out.push(S(k.slabOf(foot, 0, 3, P, 3, 0.5), { tone: "lo" }));
  out.push(S(k.slabOf({ x: -127, y: -102, w: 4, d: 4, r: 1 }, 3, MON_Z[0] - 3, P, 2, 0.3), { tone: "mid" }));
  out.push(S(k.slabOf(MONITOR, MON_Z[0], MON_Z[1] - MON_Z[0], P, 3, 0.8), { tone: "mid" }));
  const cw = (SCREEN.x1 - SCREEN.x0) / SCREEN.cols, ch = (SCREEN.z1 - SCREEN.z0) / SCREEN.rows;
  const groups = ["", ""];
  for (let i = 0; i < SCREEN.cols; i++) for (let j = 0; j < SCREEN.rows; j++) {
    const x0 = SCREEN.x0 + i * cw, z0 = SCREEN.z0 + j * ch;
    groups[(i + j) % 2] += on([[x0, SCREEN_Y, z0], [x0 + cw, SCREEN_Y, z0], [x0 + cw, SCREEN_Y, z0 + ch], [x0, SCREEN_Y, z0 + ch]], true);
  }
  out.push(`<g data-part="checks" data-phase="idle"><path class="bb-check bb-a" d="${groups[0]}"/><path class="bb-check bb-b" d="${groups[1]}"/></g>`);
  out.push(L(on([[SCREEN.x0, SCREEN_Y, SCREEN.z0], [SCREEN.x1, SCREEN_Y, SCREEN.z0], [SCREEN.x1, SCREEN_Y, SCREEN.z1], [SCREEN.x0, SCREEN_Y, SCREEN.z1]], true), { tone: "lo" }));
  out.push(frontText(SCREEN.x0, SCREEN_Y - 0.4, MON_Z[0] + 0.9, "stimulus", 2.8, "start", "lo"));
  out.push(D([at([MONITOR.x + MONITOR.w - 3, SCREEN_Y - 0.4, MON_Z[0] + 2])], { size: 0.5 }));
  return out.join("");
}

// ── neurons and the coupling wire ──────────────────────────────────────────
function neurons() {
  const [x, y] = LAMP;
  const out = [];
  out.push(S(k.cylinder(x, y, 5.6, 0, 2.4, P, 28, 0.4), { tone: "lo" }));
  out.push(S(k.cylinder(x, y, 1.4, 2.4, 11, P, 14), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(x, y, 4.4, 13.4, 5, P, 28, 0.5), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, 3.2, 18.4, 1.6, P, 24, 0.3), { tone: "lo" }));
  out.push(`<g data-part="neurons" opacity="0">${S(k.cylinder(x, y, 3.2, 18.4, 1.6, P, 24, 0.3), { tone: "hi", lit: true })}</g>`);
  out.push(topText(x, y + 12, 0, "neurons", 3.4));
  return out.join("");
}

const WIRE = [
  [LAMP[0] + 5.6, LAMP[1], 1.2],
  [VALVE_C[0] - 4, LAMP[1], 1.2],
  [VALVE_C[0] - 4, VALVE.y + VALVE.d, 1.2],
];
function wire() {
  const pts = WIRE.map((p) => at(p));
  const d = k.pathOf(pts);
  return (
    L(d, { tone: "lo" }) +
    `<g data-part="signal" opacity="0">${L(d, { tone: "lit", flow: true })}</g>` +
    D([pts[0], pts[pts.length - 1]], { size: 0.9, tone: "mid" }) +
    topText((LAMP[0] + VALVE_C[0]) / 2 + 2, LAMP[1] + 6, 0, "coupling", 3, "middle", "lo")
  );
}

// ── the vascular line ──────────────────────────────────────────────────────
function duct(i) {
  return [DUCTS[i]].map((d) => {
    const plan = { x: d.x, y: LINE_Y - 4, w: d.w, d: 8, r: 1.2 };
    return S(k.slabOf(plan, DUCT_Z[0], DUCT_Z[1] - DUCT_Z[0], P, 2, 0.4), { tone: "mid", inner: L(k.sideSeam(plan, DUCT_Z[0] + 4, P, 2), { tone: "faint" }) });
  }).join("");
}

function source() {
  return block(SOURCE, SOURCE_H, 10) + frontText(SOURCE.x + 2, SOURCE.y + SOURCE.d, 23, "artery", 3.2);
}

function valve() {
  const [cx, cy] = VALVE_C;
  const out = [block(VALVE, VALVE_TOP, 10)];
  out.push(frontText(VALVE.x + 1.6, VALVE.y + VALVE.d, 25, "arteriole", 2.9));
  out.push(S(k.cylinder(cx, cy, 4.4, VALVE_TOP, 1.4, P, 24, 0.3), { tone: "mid" }));
  out.push(S(k.cylinder(cx, cy, 1.5, VALVE_TOP + 1.4, WHEEL_Z - VALVE_TOP - 1.4, P, 14), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(cx, cy, WHEEL_R, WHEEL_Z, WHEEL_H, P, 40, 0.4), { tone: "hi", crease: "lo" }));
  out.push(L(k.ring(cx, cy, WHEEL_R - 1.6, WHEEL_Z + WHEEL_H, P, 40), { tone: "lo" }));
  out.push(S(k.cylinder(cx, cy, 2, WHEEL_Z + WHEEL_H, 1.2, P, 18, 0.2), { tone: "hi", crease: "none" }));
  out.push(`<path data-part="spokes" class="iso-line" data-tone="mid" data-free="" d="${spokesOf(k, P, VALVE_C, WHEEL_Z + WHEEL_H, -90, 2, WHEEL_R - 1.6)}"/>`);
  return out.join("");
}

function meter() {
  const [cx, cy] = METER_C;
  const out = [block(METER, METER_H, 10)];
  out.push(frontText(METER.x + 2, METER.y + METER.d, 20, "flow", 3.2));
  // a glass tube: back rim, the float, then the silhouette and front graduations over it
  out.push(S(k.cylinder(cx, cy, TUBE_R + 1.4, METER_H, 2, P, 28, 0.3), { tone: "mid" }));
  out.push(L(k.ring(cx, cy, TUBE_R, METER_H + 2, P, 28), { tone: "lo" }));
  out.push(`<g data-part="float" transform="${k.translateAlong(P, [0, 0, METER_Z0])}">${S(k.cylinder(cx, cy, TUBE_R - 0.6, 0, 3.6, P, 28, 0.4), { tone: "hi", lit: true, crease: "lo" })}</g>`);
  const [sx, sy] = [Math.sin((55 * Math.PI) / 180), -Math.cos((55 * Math.PI) / 180)];
  const edge = (side) => k.segment([cx + side * sx * TUBE_R, cy + side * sy * TUBE_R, METER_H + 2], [cx + side * sx * TUBE_R, cy + side * sy * TUBE_R, TUBE_TOP], P);
  out.push(L(edge(1) + edge(-1), { tone: "mid" }));
  const front = (55 * Math.PI) / 180;
  const arc = (z, half) => {
    const pts = [];
    for (let i = 0; i <= 6; i++) { const a = front - half + (2 * half * i) / 6; pts.push(at([cx + Math.cos(a) * TUBE_R, cy + Math.sin(a) * TUBE_R, z])); }
    return k.pathOf(pts);
  };
  const minor = [], major = [];
  for (let i = 0; i <= 8; i++) (i % 4 === 0 ? major : minor).push(arc(METER_Z0 + (i / 8) * METER_K, i % 4 === 0 ? 0.75 : 0.4));
  out.push(L(minor.join(""), { tone: "lo", free: true }), L(major.join(""), { tone: "mid", free: true }));
  out.push(S(k.cylinder(cx, cy, TUBE_R + 1.2, TUBE_TOP, 3, P, 28, 0.4), { tone: "mid" }));
  out.push(frontText(cx + TUBE_R + 1.6, cy + 2.4, METER_Z0 + 0.4, "×1", 2.8, "start", "lo"));
  out.push(frontText(cx + TUBE_R + 1.6, cy + 2.4, METER_Z0 + METER_K + 0.4, "×2", 2.8, "start", "lo"));
  return out.join("");
}

function balloonBase() {
  const [x, y] = BALLOON;
  return (
    block(BASE, BASE_H, 3.5) +
    frontText(BASE.x + 2, BASE.y + BASE.d, 2.4, "veins", 3.2) +
    S(k.cylinder(x, y, 1.8, BASE_H, BALLOON[2] - R0 - BASE_H - 1, P, 14), { tone: "mid", crease: "none" }) +
    S(k.cylinder(x, y, 5, BALLOON[2] - R0 - 2.6, 2, P, 24, 0.3), { tone: "mid" })
  );
}

function drain() {
  return block(DRAIN, DRAIN_H, 10) + frontText(DRAIN.x + 1.8, DRAIN.y + DRAIN.d, 23, "outflow", 3);
}

// ── recorder ───────────────────────────────────────────────────────────────
function recorder() {
  const out = [S(k.slabOf(REC_BASE, 0, REC_BASE_H, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(REC_BASE, 2.5, P, 4), { tone: "faint" }) })];
  out.push(S(k.slabOf(BOARD, REC_BASE_H, BOARD_TOP - REC_BASE_H, P, 3, 0.6), { tone: "mid" }));
  out.push(S(k.slabOf({ x: PAPER.x, y: FACE_Y, w: PAPER.w, d: 0.4, r: 0 }, PAPER.z0, PAPER.z1 - PAPER.z0, P, 1), { tone: "hi", crease: "none" }));
  const grid = [];
  for (let s = 5; s <= RUN_S; s += 5) grid.push(on([[TX0 + s * KT, PAPER_Y, PAPER.z0], [TX0 + s * KT, PAPER_Y, PAPER.z1]]));
  for (const pct of [-1, 1, 2, 3]) grid.push(on([[PAPER.x, PAPER_Y, BOLD_Z + pct * PCT], [PAPER.x + PAPER.w, PAPER_Y, BOLD_Z + pct * PCT]]));
  out.push(L(grid.join(""), { tone: "faint" }));
  out.push(L(on([[PAPER.x, PAPER_Y, BOLD_Z], [PAPER.x + PAPER.w, PAPER_Y, BOLD_Z]]) + on([[PAPER.x, PAPER_Y, STIM_Z], [PAPER.x + PAPER.w, PAPER_Y, STIM_Z]]) + on([[TX0, PAPER_Y, PAPER.z0], [TX0, PAPER_Y, PAPER.z1]]), { tone: "lo" }));
  const label = (z, text) => k.faceTextSvg(k.sideMatrix([PAPER.x + 1.2, PAPER_Y], z, P, "left"), text, { size: 2.8, tone: "lo" });
  out.push(label(STIM_Z + 0.9, "stim"), label(BOLD_Z + 0.9, "BOLD"), label(BOLD_Z + PCT + 0.9, "+1%"), label(BOLD_Z + 3 * PCT + 0.9, "+3%"));
  for (const s of [10, 20, 30]) out.push(k.faceTextSvg(k.sideMatrix([TX0 + s * KT + 0.8, PAPER_Y], PAPER.z1 - 6.2, P, "left"), `${s} s`, { size: 2.6, tone: "lo" }));
  out.push(`<g data-part="stim-bars"></g>`);
  out.push(`<path data-part="parts" class="iso-line" data-tone="mid" data-dashed="" data-free="" d=""/>`);
  out.push(`<path data-part="trace" class="iso-line" data-tone="lit" data-free="" d="" style="stroke-width:1"/>`);
  for (const z of [REC_BASE_H, BOARD_TOP - 6]) {
    const rail = { x: BOARD.x, y: FACE_Y, w: BOARD.w, d: 3.5, r: 0.8 };
    out.push(S(k.slabOf(rail, z, 2.6, P, 3, 0.3), { tone: "mid" }));
    out.push(D([rail.x + 3, rail.x + rail.w - 3].map((x) => at([x, FACE_Y + 3.5, z + 1.3])), { size: 0.4 }));
  }
  out.push(frontText(REC_BASE.x + 4, REC_BASE.y + REC_BASE.d, 1.6, "BOLD recorder", 3.2));
  out.push(D(byDepth(k.corners(REC_BASE, 2.6)).map(([x, y]) => at([x, y, REC_BASE_H])), { size: 0.45 }));
  return out.join("");
}

function bridge() {
  const front = FACE_Y + 3.5;
  const z0 = REC_BASE_H + 2.6, z1 = BOARD_TOP - 6;
  const bar = S(k.slabOf({ x: -2, y: front + 0.4, w: 4, d: 2.4, r: 0.8 }, z0, z1 - z0, P, 3, 0.3), { tone: "mid", crease: "none" });
  const blocks = [REC_BASE_H - 0.4, BOARD_TOP - 6.4].map((z) => S(k.slabOf({ x: -3.5, y: front, w: 7, d: 3.2, r: 0.8 }, z, 3.4, P, 3, 0.4), { tone: "mid" })).join("");
  const pen =
    `<g data-part="pen" transform="${k.translateAlong(P, [0, 0, BOLD_Z])}">` +
    S(k.slabOf({ x: PEN_DX - 0.6, y: PAPER_Y, w: 1.2, d: front - PAPER_Y + 1, r: 0.4 }, -0.6, 1.2, P, 2), { tone: "hi", lit: true, crease: "none" }) +
    S(k.slabOf({ x: 2.2, y: front, w: 6.6, d: 4, r: 1 }, -3, 6, P, 3, 0.4), { tone: "hi", crease: "lo" }) +
    `</g>`;
  return `<g data-part="bridge" transform="${k.translateAlong(P, [TX0 - PEN_DX, 0, 0])}">${blocks}${bar}${pen}</g>`;
}

// ── console ────────────────────────────────────────────────────────────────
function console_() {
  const z = CONSOLE_H;
  const out = [S(k.slabOf(CONSOLE, 0, CONSOLE_H, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(CONSOLE, 3.5, P, 4), { tone: "faint" }) })];
  DESIGNS.forEach((ds, i) => {
    const cx = KEYS[i];
    const well = { x: cx - 9.5, y: KEY_Y - 6.5, w: 19, d: 13, r: 2 };
    out.push(L(k.planOutline(well, z, P), { tone: "lo" }));
    const cap = { x: cx - 8, y: KEY_Y - 5, w: 16, d: 10, r: 1.6 };
    out.push(S(k.slabOf(cap, z, 3, P, 3, 0.4), { tone: "hi", crease: "lo" }));
    const lamp = { x: cx - 5, y: KEY_Y - 3.2, w: 10, d: 2.2, r: 0.8 };
    out.push(S(k.slabOf(lamp, z + 3, 0.5, P, 2), { tone: "lo", crease: "none" }));
    out.push(`<g data-part="key-lamp-${i}" opacity="0">${S(k.slabOf(lamp, z + 3, 0.5, P, 2), { tone: "hi", lit: true, crease: "none" })}</g>`);
    out.push(topText(cx, KEY_Y + 11, z, ds.label, 3.4));
    out.push(topText(cx, KEY_Y + 3.6, z + 3, String(i + 1), 3, "middle", "lo"));
  });
  const [gx, gy] = GO;
  out.push(S(k.cylinder(gx, gy, 7, z, 1.2, P, 32), { tone: "lo" }));
  out.push(`<g data-part="go">${S(k.cylinder(gx, gy, 5, z + 1.2, 3.2, P, 32, 0.4), { tone: "hi", crease: "lo" })}</g>`);
  out.push(topText(gx, gy + 11, z, "go", 3.4));
  out.push(frontText(CONSOLE.x + 5, CONSOLE.y + CONSOLE.d, 3, "stimulus design", 3.6));
  out.push(D(byDepth(k.corners(CONSOLE, 3)).map(([x, y]) => at([x, y, CONSOLE_H])), { size: 0.45 }));
  return out.join("");
}

// ── assemble ────────────────────────────────────────────────────────────────
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A bench model of the BOLD response. At the back a monitor shows a checkerboard that flickers while the stimulus is on, and a lamp marked neurons lights with it; a wire marked coupling runs from the lamp to a valve marked arteriole, whose handwheel turns as the vessel dilates. Along the vascular line, a flow meter's float rises with blood flow, and a balloon on a plinth marked veins swells with blood and holds beads of deoxyhaemoglobin that thin out as fresh blood washes them away, before the line drains to an outflow. A recorder at the front draws the stimulus and the BOLD signal, and a lightbox shows a raw EPI image and its change from rest, with visual cortex lighting up.",
  body: [
    plate(),
    lightboxSvg(k, P, LBOX),
    monitor(),
    source(),
    duct(0),
    valve(),
    duct(1),
    meter(),
    duct(2),
    duct(3),
    balloonBase(),
    `<g data-part="balloon"></g>`,
    drain(),
    neurons(),
    wire(),
    recorder(),
    bridge(),
    console_(),
  ],
});

const modelSource = readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "");

const live = `
${modelSource}
const spokesOf = ${spokesOf.toString()};
const P = ${JSON.stringify(P)};
const K = { lineOnTop };
const KPX = ${KPX}, BALLOON = ${JSON.stringify(BALLOON)}, R0 = ${R0}, GAIN = ${GAIN}, SWELL = ${SWELL};
const VALVE_C = ${JSON.stringify(VALVE_C)}, SPOKE_Z = ${WHEEL_Z + WHEEL_H}, WHEEL_IN = ${WHEEL_R - 1.6};
const METER_Z0 = ${METER_Z0}, METER_K = ${METER_K};
const TX0 = ${TX0}, KT = ${KT}, PAPER_Y = ${PAPER_Y}, STIM_Z = ${STIM_Z}, BOLD_Z = ${BOLD_Z}, PCT = ${PCT}, PEN_DX = ${PEN_DX};
${FILM_JS}
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const SLICE = ${JSON.stringify(SLICE)};
const filmRaw = makeFilm(svg, SLICE, ["wm", "gm", "csf", "v1"], "film-0");
const filmChange = makeFilm(svg, SLICE, ["brain", "v1"], "film-1", { signed: true });
const q = (name) => svg.querySelector('[data-part="' + name + '"]');
const checks = q("checks"), lamp = q("neurons"), signal = q("signal"), spokes = q("spokes"), float = q("float"), balloon = q("balloon");
const trace = q("trace"), parts = q("parts"), bars = q("stim-bars"), bridge = q("bridge"), pen = q("pen"), goButton = q("go");
const keyLamps = DESIGNS.map((_, i) => q("key-lamp-" + i));
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const DT = 0.005;
const TRACES = Object.fromEntries(DESIGNS.map((d) => [d.key, simulate(d, DT)]));
// each event of the two-event design on its own, to show that the responses add
const ALONE = DESIGNS[1].on.map((window) => simulate({ on: [window] }, DT));
const SPEED = 4; // simulated seconds per real second
const HOLD = 2.2;
// fixed spots inside a unit disc for the deoxyhaemoglobin beads
const BEADS = Array.from({ length: 30 }, (_, i) => { const a = i * 2.39996, r = Math.sqrt((i + 0.5) / 30) * 0.8; return [r * Math.cos(a), r * Math.sin(a)]; });

let design = DESIGNS[0], t = 0, hold = 0, frame = 0, last = 0, clock = 0, visible = false, touring = !still.matches, idleTimer = 0, tourAt = 1, pressAt = -1e9, scrubbing = false;

const stateAt = (time) => TRACES[design.key][clamp(Math.round(time / DT), 0, TRACES[design.key].length - 1)];
const traceOf = (run, upTo) => {
  const pts = [];
  for (let i = 0; i < run.length && run[i].t <= upTo + 1e-9; i += 20) pts.push(iso([TX0 + run[i].t * KT, PAPER_Y, BOLD_Z + run[i].bold * 100 * PCT], P));
  return pts;
};

function drawDesign() {
  bars.innerHTML = design.on.map(([a, b]) => {
    const p = [[TX0 + a * KT, PAPER_Y, STIM_Z], [TX0 + b * KT, PAPER_Y, STIM_Z], [TX0 + b * KT, PAPER_Y, STIM_Z + 3], [TX0 + a * KT, PAPER_Y, STIM_Z + 3]];
    return '<path class="bb-bar" d="' + pathOf(p.map((v) => iso(v, P)), true) + '"/>';
  }).join("");
  parts.setAttribute("d", design.key === "two" ? ALONE.map((run) => pathOf(traceOf(run, RUN_S))).join("") : "");
  keyLamps.forEach((el, i) => el.setAttribute("opacity", DESIGNS[i] === design ? "1" : "0"));
}

function balloonSvg(x) {
  const [cx, cy] = iso(BALLOON, P);
  const r = R0 * (1 + SWELL * (x.v - 1)) * KPX;
  const f = (v) => v.toFixed(2);
  const pt = (deg, rad = r) => [cx + Math.cos((deg * Math.PI) / 180) * rad, cy + Math.sin((deg * Math.PI) / 180) * rad];
  const [a1, a2] = [pt(-35), pt(145)];
  const inner = r * 1.064;
  const n = clamp(Math.round(20 * x.q), 0, BEADS.length);
  const [h1, h2] = [pt(200, r * 0.72), pt(250, r * 0.72)];
  return '<circle class="bb-balloon" cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + f(r) + '"/>' +
    '<path class="bb-shade" d="M' + f(a1[0]) + ' ' + f(a1[1]) + 'A' + f(r) + ' ' + f(r) + ' 0 0 1 ' + f(a2[0]) + ' ' + f(a2[1]) + 'A' + f(inner) + ' ' + f(inner) + ' 0 0 0 ' + f(a1[0]) + ' ' + f(a1[1]) + 'Z"/>' +
    '<circle class="bb-rim" cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + f(r) + '"/>' +
    '<path class="iso-line" data-tone="lo" data-free="" d="M' + f(h1[0]) + ' ' + f(h1[1]) + 'A' + f(r * 0.72) + ' ' + f(r * 0.72) + ' 0 0 1 ' + f(h2[0]) + ' ' + f(h2[1]) + '"/>' +
    dotsSvg(BEADS.slice(0, n).map(([bx, by]) => [cx + bx * r, cy + by * r]), { size: 1.15, tone: "hi" });
}

function draw() {
  const x = stateAt(t);
  const u = stimAt(design, t);
  checks.setAttribute("data-phase", u ? (Math.floor(clock / 125) % 2 ? "a" : "b") : "idle");
  lamp.setAttribute("opacity", String(u));
  signal.setAttribute("opacity", clamp(x.s / 0.18, 0, 1).toFixed(2));
  spokes.setAttribute("d", spokesOf(K, P, VALVE_C, SPOKE_Z, -90 + clamp(x.f - 1, 0, 1.2) * 150, 2, WHEEL_IN));
  float.setAttribute("transform", translateAlong(P, [0, 0, METER_Z0 + clamp(x.f - 1, 0, 1.15) * METER_K]));
  balloon.innerHTML = balloonSvg(x);
  const pts = traceOf(TRACES[design.key], t);
  pts.push(iso([TX0 + t * KT, PAPER_Y, BOLD_Z + x.bold * 100 * PCT], P));
  trace.setAttribute("d", pathOf(pts));
  bridge.setAttribute("transform", translateAlong(P, [TX0 + t * KT - PEN_DX, 0, 0]));
  pen.setAttribute("transform", translateAlong(P, [0, 0, BOLD_Z + x.bold * 100 * PCT]));
  goButton.setAttribute("transform", translateAlong(P, [0, 0, -1.6 * Math.exp(-Math.max(0, clock - pressAt) / 200)]));
  // films: the raw EPI image barely changes; the change film shows visual cortex
  const n0 = 0.4;
  filmRaw([EPI.wm / n0, EPI.gm / n0, EPI.csf / n0, (EPI.gm / n0) * x.bold]);
  filmChange([0.5, GAIN * (EPI.gm / n0) * x.bold]);
  const text = design.label + " · t " + t.toFixed(1) + " s · flow " + (x.f >= 1 ? "+" : "") + Math.round((x.f - 1) * 100) + "% · volume " + (x.v >= 1 ? "+" : "") + Math.round((x.v - 1) * 100) + "% · BOLD " + (x.bold >= 0 ? "+" : "") + (x.bold * 100).toFixed(2) + "%";
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuetext", text);
}

function restart() { t = 0; hold = 0; pressAt = clock; drawDesign(); }

function tick(stamp) {
  const dt = last ? Math.min((stamp - last) / 1000, 1 / 30) : 1 / 60;
  last = stamp;
  clock += dt * 1000;
  if (scrubbing) hold = 0;
  else if (t < RUN_S) t = Math.min(RUN_S, t + dt * SPEED);
  else {
    hold += dt;
    if (hold > HOLD) { if (touring) design = DESIGNS[tourAt++ % DESIGNS.length]; restart(); }
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
function choose(d) {
  user();
  scrubbing = false;
  if (d) design = d;
  restart();
  if (still.matches) { t = design.key === "block" ? 14 : 6; draw(); return; }
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
  if (/^[1-3]$/.test(event.key)) choose(DESIGNS[Number(event.key) - 1]);
  else if (event.key === "Enter" || event.key === " ") choose();
  else return;
  event.preventDefault();
});
if (still.matches) { design = DESIGNS[2]; t = 14; }
drawDesign();
draw();
`;

const css = `<style>
.bb-check{stroke:none;fill:#6b6b6b}
[data-phase="a"] .bb-a,[data-phase="b"] .bb-b{fill:#ececec}
[data-phase="a"] .bb-b,[data-phase="b"] .bb-a{fill:#141414}
.bb-balloon{fill:var(--anatomy-top);stroke:none}
.bb-shade{fill:var(--anatomy-shade-1);stroke:none}
.bb-rim{fill:none;stroke:var(--anatomy-hi);stroke-width:var(--anatomy-weight)}
.bb-bar{fill:var(--anatomy-mid);stroke:none}
</style>`;
const ev = simulate(DESIGNS[0]);
const two = simulate(DESIGNS[1]);
const bl = simulate(DESIGNS[2]);
const peak = ev.reduce((a, b) => (b.bold > a.bold ? b : a));
const dip = ev.reduce((a, b) => (b.bold < a.bold ? b : a));
const blockPlateau = bl.filter((s) => s.t > 15 && s.t < 21).reduce((a, s, _, arr) => a + s.bold / arr.length, 0);
const blockDip = bl.reduce((a, b) => (b.bold < a.bold ? b : a));
const flowMax = Math.max(...bl.map((s) => s.f)) - 1;
const twoPeak = Math.max(...two.map((s) => s.bold));
const alone = DESIGNS[1].on.map((w) => simulate({ on: [w] }));
const sumPeak = Math.max(...alone[0].map((s, i) => s.bold + alone[1][i].bold));
const body = k.plateHtml({
  fig: "Fig 9",
  title: "BOLD balloon",
  hint: "Hover to scrub · keys 1–3",
  readout: "event · t 0.0 s · flow +0% · volume +0% · BOLD +0.00%",
  keys: [
    { mark: "lit", label: "Recorder trace: the BOLD signal; bars underneath: when the stimulus is on" },
    { mark: "raised", label: "Handwheel: the arteriole dilating · float: blood flow · balloon: venous blood volume" },
    { mark: "dotted", label: "Beads in the balloon: deoxyhaemoglobin, which disturbs the field and lowers the signal" },
    { mark: "dashed", label: "Dashed (two events): each event on its own; the response to both is close to their sum" },
    { mark: "edge", label: `Lightbox: raw EPI image, and its change from rest ×${GAIN} (visual cortex region illustrative; MNI152 slice z = +${SLICE.z} mm)` },
  ],
  caption:
    `fMRI does not see neurons fire. Active neurons signal the arterioles upstream to dilate, and blood flow rises far more than the extra oxygen the tissue uses (here by up to ${Math.round(flowMax * 100)}% during a sustained stimulus). The surplus of oxygenated blood washes deoxyhaemoglobin out of the veins. Deoxyhaemoglobin is paramagnetic: it disturbs the field around vessels and shortens T2*, so with less of it a gradient-echo image gets slightly brighter. That is the blood-oxygen-level-dependent (BOLD) signal. ` +
    `It is small and slow: a 1 s flash raises it by about ${(peak.bold * 100).toFixed(1)}%, peaking ${(peak.t - DESIGNS[0].on[0][0]).toFixed(1)} s after the flash begins (4–6 s is typical in people), and a 20 s block holds it near ${(blockPlateau * 100).toFixed(1)}%. Afterwards blood volume recovers more slowly than flow, so deoxyhaemoglobin briefly builds up and the signal dips below baseline (to ${(blockDip.bold * 100).toFixed(1)}% after the block, ${(dip.bold * 100).toFixed(2)}% after a flash): the post-stimulus undershoot. Two flashes 3 s apart give overlapping responses that peak together at ${(twoPeak * 100).toFixed(2)}%, a little below the ${(sumPeak * 100).toFixed(2)}% that the two alone add up to (dashed): close to linear, with mild saturation. That near-linearity is what lets the next figure predict the response to any design from one response shape. ` +
    `Model: the balloon model (Buxton et al. 1998) as written by Friston et al. (2000), with κ = ${PARAMS.kappa}, γ = ${PARAMS.gamma}, τ0 = ${PARAMS.tau0} s, α = ${PARAMS.alpha}, E0 = ${PARAMS.E0}, V0 = ${PARAMS.V0} and neural efficacy ${PARAMS.eps}. The raw film is a gradient-echo EPI image (TR 2 s, TE 30 ms), where the change cannot be seen by eye; the change film shows the change from rest ×${GAIN} on a mid-grey brain. The visual-cortex region is an illustrative patch of grey matter at the occipital pole, not an atlas label. The balloon's swelling is drawn ${SWELL} times the model's volume change so that it shows, and the bench runs at 4× real time. ` +
    MNI_NOTICE,
  body: `<div class="iso-stage" tabindex="0" role="application" aria-roledescription="BOLD balloon" aria-label="BOLD balloon: keys 1 to 3 choose a single event, two events or a 20 second block; Enter runs it again; moving across the figure scrubs through time">${svg}</div>`,
});

writeFileSync(join(HERE, OUT), k.pageHtml({ title: "BOLD balloon", theme, body: css + body, script: kitScript() + live }));
console.log("wrote", OUT, "· event peak", (peak.bold * 100).toFixed(2), "% at", peak.t.toFixed(2), "s · block plateau", (blockPlateau * 100).toFixed(2), "% · block dip", (blockDip.bold * 100).toFixed(2), "% · flow max", Math.round(flowMax * 100), "% · two-event peak", (twoPeak * 100).toFixed(2), "% vs sum", (sumPeak * 100).toFixed(2), "%");
