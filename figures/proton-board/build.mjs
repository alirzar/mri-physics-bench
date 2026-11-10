// Fig 1 — Proton compass board: protons in B0, the tiny parallel excess, and signal-to-noise.
// node build.mjs            → proton-board.html (dark)
// node build.mjs --light    → proton-board-light.html
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../_anatomy/kit/iso-kit.mjs";
import { kitScript } from "../_anatomy/scripts/inline-kit.mjs";
import { NEEDLES, MAGNIFY, B0_RANGE, SNR_AT_3T, TISSUES, excessOf, parallelOf } from "./model.mjs";
import { loadSlice, lightboxGeometry, lightboxSvg, FILM_JS, MNI_NOTICE } from "../_shared/lightbox.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const OUT = theme === "light" ? "proton-board-light.html" : "proton-board.html";

const WIDTH = 600;
const HEIGHT = 400;

// ── world layout ────────────────────────────────────────────────────────────
const PLATE = { x: -150, y: -110, w: 300, d: 198, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

// C-shaped electromagnet open toward the viewer; the field runs along +x across the gap
const MAG_H = 24;
const YOKE = { x: -140, y: -98, w: 210, d: 20, r: 2 };
const ARMS = [
  { x: -140, y: -78, w: 20, d: 80, r: 2 },
  { x: 50, y: -78, w: 20, d: 80, r: 2 },
];
const COIL_Y = [-60, -20];

// needle board in the gap
const BOARD = { x: -114, y: -70, w: 130, d: 64, r: 3 };
const BOARD_H = 3;
const COLS = 7;
const ROWS = NEEDLES / COLS;
const PIVOTS = [];
for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) PIVOTS.push([-104 + c * 18, -60 + r * 15]);
const NEEDLE_Z = BOARD_H + 3;

// net-magnetization arrow on a ruler in front of the gap
const RULER = { x: -114, y: 6, w: 148, d: 8, r: 1 };
const RULER_H = 1.2;
const ARROW_X0 = -104;
const ARROW_FULL = 140; // length for full alignment
const ARROW_Y = 11;

// power supply with the B0 knob
const SUPPLY = { x: -136, y: 46, w: 84, d: 38, r: 3 };
const SUPPLY_H = 10;
const KNOB = [-110, 65];

const SLICE = loadSlice();
const LBOX = lightboxGeometry({ x: 80, y: -100, w: 64, d: 12, r: 2 }, SLICE, { top: 100 });
const LABEL = { x: 96, y: 34, w: 42, d: 34, r: 2 };

const B0_START = 0;

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [LBOX.LB.x, LBOX.LB.y, LBOX.top], [LBOX.LB.x + LBOX.LB.w, LBOX.LB.y, LBOX.top]],
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
const knobAngle = (b) => -135 + (270 * b) / B0_RANGE[1];

// Shared by build (first paint) and page (every frame).
function needlesAt(K, P, angles, pivots, z) {
  return angles
    .map((a, i) => {
      const [cx, cy] = pivots[i];
      const d = [Math.cos(a), Math.sin(a)];
      const n = [-d[1], d[0]];
      const half = (sign) => [[cx + sign * d[0] * 6.5, cy + sign * d[1] * 6.5], [cx + n[0] * 1.5 * sign, cy + n[1] * 1.5 * sign], [cx - n[0] * 1.5 * sign, cy - n[1] * 1.5 * sign]];
      const svg =
        K.solidSvg(K.extrude(half(-1), z, 0.8, P), { tone: "mid", crease: "lo" }) +
        K.solidSvg(K.extrude(half(1), z, 0.8, P), { tone: "hi", crease: "lo" }) +
        K.dotsSvg([K.iso([cx, cy, z + 0.8], P)], { size: 0.55, tone: "mid" });
      return { depth: K.depthOf([cx, cy, z], P), svg };
    })
    .sort((a, b) => a.depth - b.depth)
    .map((n) => n.svg)
    .join("");
}
function arrowAt(K, P, length, x0, y, z) {
  const head = Math.min(6, Math.max(0, length));
  const shaft = Math.max(0, length - head);
  let svg = "";
  if (shaft > 0.4) svg += K.solidSvg(K.slabOf({ x: x0, y: y - 1.2, w: shaft, d: 2.4, r: 0.6 }, z, 1.8, P, 2, 0.3), { tone: "hi", lit: true, crease: "lo" });
  if (head > 0.4) svg += K.solidSvg(K.extrude([[x0 + shaft + head, y], [x0 + shaft, y - 3.2], [x0 + shaft, y + 3.2]], z, 1.8, P), { tone: "hi", lit: true, crease: "lo" });
  return svg;
}
function pointerOf(K, P, centre, deg, r, z) {
  const d = [Math.sin((deg * Math.PI) / 180), -Math.cos((deg * Math.PI) / 180)];
  return K.lineOnTop([centre[0] - d[0] * 2, centre[1] - d[1] * 2], [centre[0] + d[0] * r, centre[1] + d[1] * r], z, P);
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

// ── electromagnet ──────────────────────────────────────────────────────────
function yoke() {
  const out = [`<path class="iso-halo" d="${k.haloOf(YOKE, 0, 0.1, P)}" style="filter:blur(4px)"/>`];
  out.push(S(k.slabOf(YOKE, 0, MAG_H, P, 3, 0.8), { tone: "mid", inner: L(k.sideSeam(YOKE, 6, P, 3) + k.sideSeam(YOKE, 18, P, 3), { tone: "faint" }) }));
  out.push(D([-130, -60, 0, 60].map((x) => at([x, YOKE.y + YOKE.d / 2, MAG_H])), { size: 0.5 }));
  return out.join("");
}

function arm(plan, side) {
  const out = [S(k.slabOf(plan, 0, MAG_H, P, 3, 0.8), { tone: "mid", inner: L(k.sideSeam(plan, 6, P, 3), { tone: "faint" }) })];
  // pole face plate on the inner side
  const faceX = side < 0 ? plan.x + plan.w : plan.x - 1.2;
  out.push(S(k.slabOf({ x: faceX, y: plan.y + 6, w: 1.2, d: plan.d - 12, r: 0 }, 2, MAG_H - 4, P, 1), { tone: "hi", crease: "none" }));
  // coil wound round the arm
  const coil = { x: plan.x - 2, y: COIL_Y[0], w: plan.w + 4, d: COIL_Y[1] - COIL_Y[0], r: 1.5 };
  const top = MAG_H + 2;
  out.push(S(k.slabOf(coil, 0, top, P, 3, 0.5), { tone: "mid" }));
  const turns = [];
  for (let y = coil.y + 3; y <= coil.y + coil.d - 3 + 1e-6; y += 2.5) {
    turns.push(k.lineOnTop([coil.x, y], [coil.x + coil.w, y], top, P));
    turns.push(k.segment([coil.x + coil.w, y, 0], [coil.x + coil.w, y, top], P));
  }
  out.push(L(turns.join(""), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(coil, 1.5), top, P, 3), { tone: "faint" }));
  return out.join("");
}

function poleLabels() {
  // N on the left pole face (it faces the gap and the viewer), S on the right arm's front end
  return (
    k.faceTextSvg(k.sideMatrix([ARMS[0].x + ARMS[0].w + 1.2, -6], 15, P, "right"), "N", { size: 9, tone: "mid", anchor: "middle" }) +
    k.faceTextSvg(k.sideMatrix([ARMS[1].x + ARMS[1].w / 2, ARMS[1].y + ARMS[1].d], 16, P, "left"), "S", { size: 9, tone: "mid", anchor: "middle" })
  );
}

// ── needle board ───────────────────────────────────────────────────────────
function board() {
  const out = [S(k.slabOf(BOARD, 0, BOARD_H, P, 4, 0.6), { tone: "lo" })];
  out.push(L(k.planOutline(k.insetPlan(BOARD, 3), BOARD_H, P, 4), { tone: "faint" }));
  for (const [x, y] of byDepth(PIVOTS)) {
    out.push(L(k.ring(x, y, 7.2, BOARD_H, P, 40), { tone: "faint" }));
    out.push(S(k.cylinder(x, y, 1.8, BOARD_H, NEEDLE_Z - BOARD_H, P, 16), { tone: "mid" }));
  }
  out.push(D(byDepth(k.corners(BOARD, 2.6)).map(([x, y]) => at([x, y, BOARD_H])), { size: 0.45 }));
  return out.join("");
}

function ruler() {
  const out = [S(k.slabOf(RULER, 0, RULER_H, P, 3, 0.4), { tone: "mid" })];
  const minor = [];
  const major = [];
  for (let i = 0; i <= 20; i++) {
    const x = ARROW_X0 + (i / 20) * ARROW_FULL;
    (i % 4 === 0 ? major : minor).push(k.lineOnTop([x, RULER.y], [x, RULER.y + (i % 4 === 0 ? 3.4 : 2)], RULER_H, P));
  }
  out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }));
  out.push(S(k.slabOf({ x: ARROW_X0 - 5, y: ARROW_Y - 3, w: 5, d: 6, r: 1 }, RULER_H, 3.2, P, 2, 0.4), { tone: "mid" }));
  out.push(`<g data-part="arrow"></g>`);
  return out.join("");
}

// ── power supply ───────────────────────────────────────────────────────────
function supply() {
  const [cx, cy] = KNOB;
  const out = [S(k.slabOf(SUPPLY, 0, SUPPLY_H, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(SUPPLY, 5, P, 4), { tone: "faint" }) })];
  out.push(L(k.ring(cx, cy, 13, SUPPLY_H, P, 72), { tone: "faint" }));
  const minor = [];
  const major = [];
  for (let i = 0; i <= 14; i++) {
    const d = dirOf(knobAngle(i / 2));
    const big = i % 2 === 0;
    (big ? major : minor).push(k.lineOnTop([cx + d[0] * 13, cy + d[1] * 13], [cx + d[0] * (big ? 10.4 : 11.4), cy + d[1] * (big ? 10.4 : 11.4)], SUPPLY_H, P));
  }
  out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }));
  out.push(S(k.cylinder(cx, cy, 8, SUPPLY_H, 6, P, 48, 0.5), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(cx, cy, 8, SUPPLY_H, SUPPLY_H + 6, 56, P), { tone: "lo" }));
  out.push(`<path data-part="knob-pointer" class="iso-line" data-tone="hi" data-free="" d="${pointerOf(k, P, KNOB, knobAngle(B0_START), 6.5, SUPPLY_H + 6)}"/>`);
  // two terminal posts and a row of vent slots
  for (const [x, y] of byDepth([[-66, 55], [-66, 75]])) {
    out.push(S(k.cylinder(x, y, 3.4, SUPPLY_H, 1.2, P, 24), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 2.2, SUPPLY_H + 1.2, 4, P, 20), { tone: "mid", inner: L(k.sideArc(x, y, 2.2, SUPPLY_H + 3, P, 12), { tone: "faint" }) }));
  }
  out.push(L([0, 1, 2, 3, 4].map((i) => k.planOutline({ x: -90 + i * 3.6, y: 58, w: 1.6, d: 12, r: 0.8 }, SUPPLY_H, P, 2)).join(""), { tone: "lo" }));
  out.push(k.faceTextSvg(k.sideMatrix([SUPPLY.x + 6, SUPPLY.y + SUPPLY.d], 4, P, "left"), "B0 (T)", { size: 5, tone: "mid" }));
  out.push(D(byDepth(k.corners(SUPPLY, 3)).map(([x, y]) => at([x, y, SUPPLY_H])), { size: 0.45 }));
  return out.join("");
}

function labelPlate() {
  const out = [S(k.slabOf(LABEL, 0, 0.8, P, 4), { tone: "lo", crease: "none" })];
  out.push(L(k.planOutline(k.insetPlan(LABEL, 1.6), 0.8, P, 4), { tone: "faint" }));
  [[24, 10], [16, 17], [20, 24]].forEach(([len, dy]) => out.push(L(k.lineOnTop([LABEL.x + 6, LABEL.y + dy], [LABEL.x + 6 + len, LABEL.y + dy], 0.8, P), { tone: "lo", free: true })));
  out.push(D([at([LABEL.x + 3, LABEL.y + 3, 0.8]), at([LABEL.x + LABEL.w - 3, LABEL.y + LABEL.d - 3, 0.8])], { size: 0.45 }));
  return out.join("");
}

// ── assemble ────────────────────────────────────────────────────────────────
// fixed per-needle randomness (shared with the page so the first paint matches)
let seed = 7;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const BASE = PIVOTS.map(() => rnd() * Math.PI * 2);
const PHASE = PIVOTS.map(() => [rnd() * 6.28, rnd() * 6.28]);
const RANK = PIVOTS.map((_, i) => i).sort(() => rnd() - 0.5).map((_, i, a) => a.indexOf(i));

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A C-shaped electromagnet open toward the viewer, its two arms wound with coils and labelled N and S. In the gap sits a board of 28 compass needles standing for protons. With the power supply at zero they point every which way; as the B0 knob is turned up they settle either along the field or against it, with only a few more along it. A lit arrow on a ruler in front of the gap shows the net magnetization, and a lightbox shows a brain image whose noise falls as the field rises.",
  body: [
    plate(),
    yoke(),
    lightboxSvg(k, P, LBOX),
    arm(ARMS[0], -1),
    board(),
    `<g data-part="needles">${needlesAt(k, P, BASE, PIVOTS, NEEDLE_Z)}</g>`,
    arm(ARMS[1], 1),
    poleLabels(),
    ruler(),
    supply(),
    labelPlate(),
  ],
});

const modelSource = readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "");

const live = `
${modelSource}
const needlesAt = ${needlesAt.toString()};
const arrowAt = ${arrowAt.toString()};
const pointerOf = ${pointerOf.toString()};
const P = ${JSON.stringify(P)};
const K = { solidSvg, extrude, slabOf, depthOf, dotsSvg, iso, lineOnTop };
const PIVOTS = ${JSON.stringify(PIVOTS)}, NEEDLE_Z = ${NEEDLE_Z};
const BASE = ${JSON.stringify(BASE)}, PHASE = ${JSON.stringify(PHASE)}, RANK = ${JSON.stringify(RANK)};
const ARROW_X0 = ${ARROW_X0}, ARROW_FULL = ${ARROW_FULL}, ARROW_Y = ${ARROW_Y}, ARROW_Z = ${RULER_H};
const KNOB = ${JSON.stringify(KNOB)}, KNOB_Z = ${SUPPLY_H + 6};
const knobAngle = (b) => -135 + (270 * b) / B0_RANGE[1];
${FILM_JS}
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const paintFilm = makeFilm(svg, ${JSON.stringify(SLICE)}, TISSUES.map((t) => t.key));
const q = (name) => svg.querySelector('[data-part="' + name + '"]');
const needles = q("needles"), arrow = q("arrow"), pointer = q("knob-pointer");
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const smooth = (e0, e1, x) => { const u = clamp((x - e0) / (e1 - e0), 0, 1); return u * u * (3 - 2 * u); };

let want = ${B0_START}, b0 = want;
const angles = BASE.slice();
let clock = 0, frame = 0, last = 0, visible = false, touring = !still.matches, idleTimer = 0;
const DWELL = 3.6;

function draw() {
  const nPar = b0 < 0.02 ? NEEDLES / 2 : parallelOf(b0);
  needles.innerHTML = needlesAt(K, P, angles, PIVOTS, NEEDLE_Z);
  const net = b0 < 0.02 ? 0 : (2 * nPar - NEEDLES) / NEEDLES;
  arrow.innerHTML = arrowAt(K, P, net * ARROW_FULL, ARROW_X0, ARROW_Y, ARROW_Z);
  pointer.setAttribute("d", pointerOf(K, P, KNOB, knobAngle(b0), 6.5, KNOB_Z));
  paintFilm(TISSUES.map((t) => t.PD), noiseOf(b0));
  const ppm = excessOf(b0) * 1e6;
  const text = "B0 " + b0.toFixed(1) + " T · excess " + ppm.toFixed(1) + " per million · board " + nPar + "↑ " + (NEEDLES - nPar) + "↓";
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuetext", text);
}

function tick(stamp) {
  const dt = last ? Math.min((stamp - last) / 1000, 1 / 30) : 1 / 60;
  last = stamp;
  clock += dt;
  if (touring) want = PRESETS[Math.floor(clock / DWELL) % PRESETS.length];
  b0 += (want - b0) * (1 - Math.exp(-dt / 0.5));
  if (Math.abs(want - b0) < 0.005) b0 = want;
  const s = smooth(0, 0.4, b0);
  const nPar = parallelOf(b0);
  angles.forEach((a, i) => {
    const [p1, p2] = PHASE[i];
    const thermal = BASE[i] + 0.9 * Math.sin(0.5 * clock + p1) + 0.6 * Math.sin(1.1 * clock + p2);
    const aligned = (RANK[i] < nPar ? 0 : Math.PI) + (0.22 * (1 - s) + 0.07) * Math.sin(2.2 * clock + p1);
    const target = thermal + s * wrap(aligned - thermal);
    angles[i] = a + wrap(target - a) * (1 - Math.exp(-dt / 0.35));
  });
  draw();
  frame = visible ? requestAnimationFrame(tick) : 0;
}

const go = () => { if (!frame && visible && !still.matches) { last = 0; frame = requestAnimationFrame(tick); } };
function steer(b) {
  touring = false;
  want = clamp(b, B0_RANGE[0], B0_RANGE[1]);
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { touring = !still.matches; clock = 0; }, 6000);
  if (still.matches) { b0 = want; settle(); draw(); return; }
  go();
}
function settle() {
  const nPar = parallelOf(b0);
  const s = smooth(0, 0.4, b0);
  angles.forEach((_, i) => { angles[i] = BASE[i] + s * wrap((RANK[i] < nPar ? 0 : Math.PI) - BASE[i]); });
}
new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) go(); }, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("pointermove", (event) => {
  const box = svg.getBoundingClientRect();
  steer(clamp(((event.clientX - box.left) / box.width - 0.12) / 0.76, 0, 1) * B0_RANGE[1]);
});
stage.addEventListener("keydown", (event) => {
  if (event.key === "ArrowRight" || event.key === "ArrowUp") steer(want + 0.5);
  else if (event.key === "ArrowLeft" || event.key === "ArrowDown") steer(want - 0.5);
  else if (/^[1-4]$/.test(event.key)) steer(PRESETS[Number(event.key) - 1]);
  else return;
  event.preventDefault();
});
if (still.matches) { want = b0 = 3; settle(); }
draw();
`;

const body = k.plateHtml({
  fig: "Fig 1",
  title: "Proton compass board",
  hint: "Hover or keys 1–4",
  readout: "B0 0.0 T · excess 0.0 per million · board 14↑ 14↓",
  keys: [
    { mark: "raised", label: "Needles: hydrogen nuclei (protons), each a tiny magnet" },
    { mark: "lit", label: "Arrow: net magnetization, the sum of all the needles" },
    { mark: "edge", label: `Lightbox: proton-density image with the noise a scanner would see at this field (MNI152 slice z = +${SLICE.z} mm)` },
  ],
  caption: `Water's hydrogen nuclei are tiny magnets. With no field (B0 = 0) they point every which way and cancel. In a field they do not all swing round like compass needles: each settles in one of two states, along the field (parallel, lower energy) or against it (anti-parallel), and body heat keeps the two almost equal. The excess along the field is tanh(γħB0/2kT): ${(excessOf(1.5) * 1e6).toFixed(1)} per million at 1.5 T, ${(excessOf(3) * 1e6).toFixed(1)} per million at 3 T and ${(excessOf(7) * 1e6).toFixed(0)} per million at 7 T. The board magnifies that excess ${MAGNIFY.toLocaleString("en-US")} times so it shows on ${NEEDLES} needles. That small excess, summed over some 10^22 protons in a voxel's worth of tissue, is the net magnetization (the lit arrow), and it is all the signal MRI will ever have to work with. It grows in proportion to B0, so signal-to-noise does too: the film is a proton-density image rescaled for display, with fixed noise whose relative size falls as 1/B0 (SNR about ${SNR_AT_3T} in CSF at 3 T; real gains also depend on coils, tissue and sequence). The scanner calls the field direction z; here it runs from the N pole face to the S pole across the gap. ${MNI_NOTICE}`,
  body: `<div class="iso-stage" tabindex="0" role="application" aria-roledescription="proton compass board" aria-label="Proton compass board: arrows change B0 by 0.5 tesla, keys 1 to 4 choose 0, 1.5, 3 and 7 tesla">${svg}</div>`,
});

writeFileSync(join(HERE, OUT), k.pageHtml({ title: "Proton compass board", theme, body, script: kitScript() + live }));
console.log("wrote", OUT);
