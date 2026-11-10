// Fig 13 — Tensor bench: direction-dependent diffusion, the diffusion tensor (FA, MD, V1), colour FA and tractography.
// node build.mjs            → tensor-bench.html (dark)
// node build.mjs --light    → tensor-bench-light.html
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../_anatomy/kit/iso-kit.mjs";
import { kitScript } from "../_anatomy/scripts/inline-kit.mjs";
import { SPECIMENS, FIBRE, fitTensor, adcAt } from "./model.mjs";
import { lightboxGeometry, lightboxSvg } from "../_shared/lightbox.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const OUT = theme === "light" ? "tensor-bench-light.html" : "tensor-bench.html";

const WIDTH = 600;
const HEIGHT = 400;
const DTI = JSON.parse(readFileSync(join(HERE, "..", "data", "omm1-slice.json"), "utf8"));
const NOTICE =
  "Diffusion data: Oxford-MM-1 DTI template (Arthofer et al., Imaging Neuroscience 2024, doi:10.1162/imag_a_00361), built from UK Biobank data and shared under CC BY-SA 4.0; one axial slice at z = +14 mm in FSL's MNI152 space, shown in radiological view. This figure is shared under CC BY-SA 4.0.";

// ── world layout ────────────────────────────────────────────────────────────
const PLATE = { x: -150, y: -110, w: 300, d: 198, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

// the sample on a turntable, with the gradient arrow hanging above it
const TT = [-100, -56];
const TT_R = 38;
const BLOCK_H = 22; // half-size
const BLOCK_Z = [5, 13];
const TOP_Z = BLOCK_Z[1];
const POST = [TT[0], TT[1] - 35];
const ARM_Z = 32;
const ARROW_Z = 26;
const ARROW_L = 28;

// the dish: ADC in every in-plane direction, rings at 1, 2, 3 × 10⁻³ mm²/s
const DISH = [-8, -22];
const DISH_R = 40;
const DISH_Z = 3;
const ADC_K = 12; // units per 10⁻³ mm²/s

// console at the front: specimen keys, the tracking button and an FA gauge set into its top
const CONSOLE = { x: -130, y: 40, w: 240, d: 36, r: 3 };
const CONSOLE_H = 9;
const KEYS = [-112, -88, -64, -40];
const KEY_Y = 52;
const TRACK = [-14, 56];
const GAUGE = [46, 66]; // pivot of the FA needle on the console top
const FA_R = 16;
const SWING = 70;

const LBOX = lightboxGeometry({ x: -8, y: -100, w: 154, d: 12, r: 2 }, DTI, { top: 84, grid: [3, 1], labels: ["FA", "colour FA", "tracts"] });

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [LBOX.LB.x, LBOX.LB.y, LBOX.top], [LBOX.LB.x + LBOX.LB.w, LBOX.LB.y, LBOX.top], [POST[0], POST[1], ARM_Z + 3]],
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
const RAD = Math.PI / 180;
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

// ── turntable, post and sample ─────────────────────────────────────────────
function turntable() {
  const [x, y] = TT;
  const out = [S(k.cylinder(x, y, TT_R, 0, 3, P, 64, 0.5), { tone: "lo" })];
  out.push(S(k.cylinder(x, y, TT_R - 2, 3, 2, P, 64, 0.4), { tone: "mid" }));
  const ticks = [];
  for (let a = 0; a < 360; a += 15) ticks.push(k.lineOnTop([x + Math.cos(a * RAD) * (TT_R - 2), y + Math.sin(a * RAD) * (TT_R - 2)], [x + Math.cos(a * RAD) * (TT_R - (a % 45 === 0 ? 5 : 3.6)), y + Math.sin(a * RAD) * (TT_R - (a % 45 === 0 ? 5 : 3.6))], 5, P));
  out.push(L(ticks.join(""), { tone: "lo" }));
  // the post at the back carries the arm over the sample
  out.push(S(k.cylinder(POST[0], POST[1], 3.4, 5, 1.2, P, 24), { tone: "mid" }));
  out.push(S(k.cylinder(POST[0], POST[1], 1.8, 6.2, ARM_Z - 6.2, P, 16), { tone: "mid", crease: "none" }));
  return out.join("");
}
function block() {
  const [x, y] = TT;
  const plan = { x: x - BLOCK_H, y: y - BLOCK_H, w: 2 * BLOCK_H, d: 2 * BLOCK_H, r: 2 };
  return S(k.slabOf(plan, BLOCK_Z[0], BLOCK_Z[1] - BLOCK_Z[0], P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(plan, BLOCK_Z[0] + 3, P, 3), { tone: "faint" }) }) +
    `<text data-part="specimen-name" class="iso-face-text" data-tone="mid" transform="${k.sideMatrix([x - BLOCK_H + 2.2, y + BLOCK_H], BLOCK_Z[0] + 1.6, P, "left")}" font-size="3.2" text-anchor="start"></text>`;
}
function arm() {
  const [x, y] = TT;
  const out = [S(k.slabOf({ x: x - 1.6, y: POST[1] - 1.6, w: 3.2, d: y - POST[1] + 1.6, r: 0.8 }, ARM_Z, 2.2, P, 2, 0.3), { tone: "mid" })];
  out.push(S(k.cylinder(x, y, 1.1, ARROW_Z + 0.8, ARM_Z - ARROW_Z - 0.8, P, 12), { tone: "mid", crease: "none" }));
  out.push(`<g data-part="arrow"></g>`);
  out.push(S(k.cylinder(x, y, 2, ARROW_Z - 0.6, 1.4, P, 18, 0.3), { tone: "hi", crease: "lo" }));
  return out.join("");
}

// ── dish ───────────────────────────────────────────────────────────────────
function dish() {
  const [x, y] = DISH;
  const out = [S(k.cylinder(x, y, DISH_R, 0, DISH_Z, P, 72, 0.6), { tone: "mid", inner: L(k.sideArc(x, y, DISH_R, 1.4, P, 48), { tone: "faint" }) })];
  out.push(L([1, 2, 3].map((v) => k.ring(x, y, v * ADC_K, DISH_Z, P, 72)).join(""), { tone: "faint" }));
  out.push(L(k.lineOnTop([x - DISH_R, y], [x + DISH_R, y], DISH_Z, P) + k.lineOnTop([x, y - DISH_R], [x, y + DISH_R], DISH_Z, P), { tone: "faint" }));
  for (const v of [1, 2, 3]) out.push(topText(x + v * ADC_K - 0.6, y - 1, DISH_Z, String(v), 2.6, "end", "lo"));
  out.push(`<path data-part="radar" class="iso-line" data-tone="mid" data-free="" d=""/>`);
  out.push(`<path data-part="fit" class="iso-line" data-tone="hi" data-dashed="" data-free="" d=""/>`);
  out.push(`<path data-part="v1" class="iso-line" data-tone="hi" data-free="" d="" style="stroke-width:1"/>`);
  out.push(`<path data-part="trace" class="iso-line" data-tone="lit" data-free="" d="" style="stroke-width:1.1"/>`);
  out.push(D([at([x, y, DISH_Z])], { size: 0.9, tone: "hi" }));
  out.push(topText(x, y + DISH_R - 2.6, DISH_Z, "ADC by direction, ×10⁻³ mm²/s", 2.8, "middle", "lo"));
  return out.join("");
}

// ── FA gauge on the console top ────────────────────────────────────────────
const faPoint = (fa, r) => { const a = (-SWING + 2 * SWING * fa) * RAD; return [GAUGE[0] + Math.sin(a) * r, GAUGE[1] - Math.cos(a) * r, CONSOLE_H]; };
function gauge() {
  const out = [];
  const arc = [];
  for (let i = 0; i <= 40; i++) arc.push(at(faPoint(i / 40, FA_R)));
  out.push(L(k.pathOf(arc), { tone: "mid" }));
  const minor = [], major = [];
  for (let i = 0; i <= 10; i++) (i % 5 === 0 ? major : minor).push(k.pathOf([at(faPoint(i / 10, FA_R)), at(faPoint(i / 10, FA_R + (i % 5 === 0 ? 3 : 1.8)))]));
  out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }));
  for (const [v, text, anchor] of [[0, "0", "end"], [0.5, "0.5", "middle"], [1, "1", "start"]]) { const [x, y] = faPoint(v, FA_R + 5.4); out.push(topText(x, y + 1.2, CONSOLE_H, text, 3, anchor)); }
  SPECIMENS.forEach((sp, i) => { const [x, y] = faPoint(fitTensor(sp).fa, FA_R - 3.6); out.push(topText(x + (i === 3 ? 1.4 : 0), y + 1, CONSOLE_H, String(i + 1), 2.6, "middle", "lo")); });
  out.push(topText(GAUGE[0], GAUGE[1] + 6, CONSOLE_H, "fractional anisotropy", 3.2));
  out.push(`<path data-part="needle" class="iso-line" data-tone="lit" data-free="" d="" style="stroke-width:1.1"/>`);
  out.push(S(k.cylinder(GAUGE[0], GAUGE[1], 1.8, CONSOLE_H, 1.2, P, 18, 0.2), { tone: "hi", crease: "none" }));
  out.push(`<text data-part="md" class="iso-face-text" data-tone="hi" transform="${k.topMatrix([GAUGE[0] + 24, GAUGE[1] - 6], CONSOLE_H, P, "x")}" font-size="4.4" text-anchor="start"></text>`);
  out.push(topText(GAUGE[0] + 24, GAUGE[1] + 0.4, CONSOLE_H, "mean diffusivity, ×10⁻³ mm²/s", 2.8, "start", "lo"));
  return out.join("");
}
function unusedMeter() {
  const out = [S(k.slabOf(METER, 0, METER_H, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(METER, 5, P, 4), { tone: "faint" }) })];
  out.push(S(k.slabOf({ x: METER.x + 4, y: MFACE - 0.3, w: METER.w - 8, d: 0.3, r: 0 }, 5, METER_H - 9, P, 1), { tone: "hi", crease: "none" }));
  const arc = [];
  for (let i = 0; i <= 40; i++) arc.push(at(faPoint(i / 40, FA_R)));
  out.push(L(k.pathOf(arc), { tone: "mid" }));
  const minor = [], major = [];
  for (let i = 0; i <= 10; i++) (i % 5 === 0 ? major : minor).push(k.pathOf([at(faPoint(i / 10, FA_R)), at(faPoint(i / 10, FA_R + (i % 5 === 0 ? 3.4 : 2)))]));
  out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }));
  for (const [v, text] of [[0, "0"], [0.5, "0.5"], [1, "1"]]) { const [x, , z] = faPoint(v, FA_R + 6); out.push(faceText(x, MFACE, z - 1, text, 3, "middle")); }
  // the four specimens' marks, numbered as their keys
  SPECIMENS.forEach((sp, i) => { const [x, , z] = faPoint(fitTensor(sp).fa, FA_R - 4.4); out.push(faceText(x + (i === 3 ? 1.6 : 0), MFACE, z - 1.1, String(i + 1), 2.6, "middle", "lo")); });
  out.push(faceText(PIVOT[0], MFACE, PIVOT[1] - 4.8, "fractional anisotropy", 3.2, "middle"));
  out.push(`<text data-part="md" class="iso-face-text" data-tone="hi" transform="${k.sideMatrix([PIVOT[0], MFACE], PIVOT[1] - 9.4, P, "left")}" font-size="3" text-anchor="middle"></text>`);
  out.push(`<path data-part="needle" class="iso-line" data-tone="lit" data-free="" d="" style="stroke-width:1.1"/>`);
  out.push(D([at([PIVOT[0], MFACE, PIVOT[1]])], { size: 1.5, tone: "hi" }));
  out.push(D(byDepth(k.corners(METER, 2.6)).map(([x, y]) => at([x, y, METER_H])), { size: 0.45 }));
  return out.join("");
}

// ── console ────────────────────────────────────────────────────────────────
function console_() {
  const z = CONSOLE_H;
  const out = [S(k.slabOf(CONSOLE, 0, CONSOLE_H, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(CONSOLE, 3.5, P, 4), { tone: "faint" }) })];
  SPECIMENS.forEach((sp, i) => {
    const cx = KEYS[i];
    out.push(L(k.planOutline({ x: cx - 9.5, y: KEY_Y - 6.5, w: 19, d: 13, r: 2 }, z, P), { tone: "lo" }));
    out.push(S(k.slabOf({ x: cx - 8, y: KEY_Y - 5, w: 16, d: 10, r: 1.6 }, z, 3, P, 3, 0.4), { tone: "hi", crease: "lo" }));
    const lamp = { x: cx - 5, y: KEY_Y - 3.2, w: 10, d: 2.2, r: 0.8 };
    out.push(S(k.slabOf(lamp, z + 3, 0.5, P, 2), { tone: "lo", crease: "none" }));
    out.push(`<g data-part="key-lamp-${i}" opacity="0">${S(k.slabOf(lamp, z + 3, 0.5, P, 2), { tone: "hi", lit: true, crease: "none" })}</g>`);
    out.push(topText(cx, KEY_Y + 3.6, z + 3, String(i + 1), 3, "middle", "lo"));
    out.push(topText(cx, KEY_Y + 11, z, sp.label, 3.4));
  });
  const [gx, gy] = TRACK;
  out.push(S(k.cylinder(gx, gy, 7, z, 1.2, P, 32), { tone: "lo" }));
  out.push(`<g data-part="track">${S(k.cylinder(gx, gy, 5, z + 1.2, 3.2, P, 32, 0.4), { tone: "hi", crease: "lo" })}</g>`);
  out.push(topText(gx, gy + 11, z, "track", 3.4));
  out.push(gauge());
  out.push(faceText(CONSOLE.x + 5, CONSOLE.y + CONSOLE.d, 3, "specimen · tractography · anisotropy", 3.6));
  out.push(D(byDepth(k.corners(CONSOLE, 3)).map(([x, y]) => at([x, y, CONSOLE_H])), { size: 0.45 }));
  return out.join("");
}

// ── assemble ────────────────────────────────────────────────────────────────
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A bench for the diffusion tensor. On a turntable at the back left sits a sample block, a fibre bundle, crossing fibres, grey matter or water, with water molecules wandering over it and leaving short trails; an arrow hanging above it shows the direction of the diffusion gradient as it sweeps round. A dish beside it plots the apparent diffusion coefficient measured in each direction, then the tensor fitted to those measurements as a dashed ellipse with its main direction. A meter at the front shows the fractional anisotropy and mean diffusivity, and a lightbox shows a brain slice as an FA map, a colour FA map and in-plane tractography.",
  body: [plate(), lightboxSvg(k, P, LBOX), turntable(), block(), `<g data-part="fibres"></g>`, `<g data-part="molecules"></g>`, arm(), dish(), console_()],
});

const modelSource = readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "");

const live = `
${modelSource}
const P = ${JSON.stringify(P)};
const TT = ${JSON.stringify(TT)}, BLOCK_H = ${BLOCK_H}, TOP_Z = ${TOP_Z}, ARROW_Z = ${ARROW_Z}, ARROW_L = ${ARROW_L};
const DISH = ${JSON.stringify(DISH)}, DISH_R = ${DISH_R}, DISH_Z = ${DISH_Z}, ADC_K = ${ADC_K};
const GAUGE = ${JSON.stringify(GAUGE)}, FA_R = ${FA_R}, SWING = ${SWING}, CONSOLE_H = ${CONSOLE_H};
const DTI = ${JSON.stringify({ width: DTI.width, height: DTI.height, fa: DTI.fa, vx: DTI.vx, vy: DTI.vy, vz: DTI.vz })};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const q = (name) => svg.querySelector('[data-part="' + name + '"]');
const fibres = q("fibres"), molG = q("molecules"), arrow = q("arrow"), radar = q("radar"), fitPath = q("fit"), v1Path = q("v1"), trace = q("trace");
const needle = q("needle"), mdText = q("md"), specimenName = q("specimen-name"), trackButton = q("track");
const keyLamps = SPECIMENS.map((_, i) => q("key-lamp-" + i));
const films = [q("film-0"), q("film-1"), q("film-2")];
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const FITS = SPECIMENS.map(fitTensor);

// ── the sample's surface: fibres, cells or plain water ──
function clipLine(cx, cy, ux, uy, h) {
  let t0 = -1e9, t1 = 1e9;
  for (const [p, u] of [[cx, ux], [cy, uy]]) {
    if (Math.abs(u) < 1e-9) { if (Math.abs(p) > h) return null; continue; }
    const a = (-h - p) / u, b = (h - p) / u;
    t0 = Math.max(t0, Math.min(a, b)); t1 = Math.min(t1, Math.max(a, b));
  }
  return t1 > t0 ? [t0, t1] : null;
}
function drawSurface(si) {
  const sp = SPECIMENS[si], [bx, by] = TT, h = BLOCK_H - 0.6;
  let d = "";
  if (sp.key === "bundle" || sp.key === "crossing") {
    for (const part of sp.parts) {
      const ux = Math.cos(part.angle * RAD), uy = Math.sin(part.angle * RAD), nx = -uy, ny = ux;
      for (let o = -32; o <= 32; o += 3.6) {
        const cx = o * nx, cy = o * ny, t = clipLine(cx, cy, ux, uy, h);
        if (!t) continue;
        d += pathOf([iso([bx + cx + ux * t[0], by + cy + uy * t[0], TOP_Z], P), iso([bx + cx + ux * t[1], by + cy + uy * t[1], TOP_Z], P)]);
      }
    }
    fibres.innerHTML = '<path class="iso-line" data-tone="lo" data-free="" d="' + d + '"/>';
  } else if (sp.key === "grey") {
    let s = 5;
    const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 26; i++) d += ringPath(bx + (r() * 2 - 1) * (h - 2.4), by + (r() * 2 - 1) * (h - 2.4), 1.6 + r() * 1.2);
    fibres.innerHTML = '<path class="iso-line" data-tone="lo" data-free="" d="' + d + '"/>';
  } else fibres.innerHTML = "";
}
function ringPath(x, y, r) { const pts = []; for (let i = 0; i <= 16; i++) pts.push(iso([x + Math.cos((i / 16) * 2 * Math.PI) * r, y + Math.sin((i / 16) * 2 * Math.PI) * r, TOP_Z], P)); return pathOf(pts); }

// ── molecules: anisotropic random walks with short trails ──
const walkSeed = (() => { let s = 99; const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) + 0.5) / 4294967296; return () => Math.sqrt(-2 * Math.log(r())) * Math.cos(2 * Math.PI * r()); })();
const N_MOL = 22, TRAIL = 16;
let mols = [];
function resetMolecules(si) {
  const sp = SPECIMENS[si];
  mols = Array.from({ length: N_MOL }, (_, i) => { const x = ((i % 5) / 4 - 0.5) * 32 + walkSeed() * 2, y = (Math.floor(i / 5) / 4 - 0.5) * 32 + walkSeed() * 2; return { x, y, part: sp.parts[i % sp.parts.length], trail: [[x, y]] }; });
}
let trailClock = 0;
function stepMolecules(dtMs) {
  const h = BLOCK_H - 1.2;
  for (const m of mols) {
    const a = m.part.angle * RAD, ux = Math.cos(a), uy = Math.sin(a);
    const sPar = Math.sqrt(2 * m.part.par * dtMs) * walkSeed(), sPerp = Math.sqrt(2 * m.part.perp * dtMs) * walkSeed();
    m.x += ux * sPar - uy * sPerp; m.y += uy * sPar + ux * sPerp;
    if (m.x < -h) m.x = -2 * h - m.x; if (m.x > h) m.x = 2 * h - m.x;
    if (m.y < -h) m.y = -2 * h - m.y; if (m.y > h) m.y = 2 * h - m.y;
  }
  trailClock += dtMs;
  if (trailClock > 2.5) { trailClock = 0; for (const m of mols) { m.trail.push([m.x, m.y]); if (m.trail.length > TRAIL) m.trail.shift(); } }
}
function drawMolecules() {
  const [bx, by] = TT;
  let d = "";
  const dots = [];
  for (const m of mols) {
    const pts = m.trail.concat([[m.x, m.y]]).map(([x, y]) => iso([bx + x, by + y, TOP_Z + 0.1], P));
    d += pathOf(pts);
    dots.push(pts[pts.length - 1]);
  }
  molG.innerHTML = '<path class="iso-line" data-tone="mid" data-free="" d="' + d + '"/>' + dotsSvg(dots, { size: 0.8, tone: "hi" });
}

// ── dish and meter ──
function polar(r, deg) { const [x, y] = DISH; return iso([x + Math.cos(deg * RAD) * r, y + Math.sin(deg * RAD) * r, DISH_Z], P); }
function drawDish(si, psi, swept, fitShown) {
  const sp = SPECIMENS[si], f = FITS[si];
  const pts = [], back = [];
  const end = FIBRE + swept;
  for (let a = FIBRE; a <= end + 1e-9; a += 2) { const r = ADC_K * adcAt(sp, a); pts.push(polar(r, a)); back.push(polar(r, a + 180)); }
  if (swept >= 180) trace.setAttribute("d", pathOf(pts.concat(back), true));
  else trace.setAttribute("d", pts.length > 1 ? pathOf(pts) + pathOf(back) : "");
  radar.setAttribute("d", pathOf([polar(DISH_R - 1, psi + 180), polar(DISH_R - 1, psi)]));
  if (fitShown) {
    const e = [];
    const a = f.angle * RAD, c = Math.cos(a), s = Math.sin(a);
    for (let i = 0; i <= 72; i++) { const t = (i / 72) * 2 * Math.PI; const u = ADC_K * f.l1 * Math.cos(t), v = ADC_K * f.l2 * Math.sin(t); e.push(iso([DISH[0] + u * c - v * s, DISH[1] + u * s + v * c, DISH_Z], P)); }
    fitPath.setAttribute("d", pathOf(e, true));
    const iso_ = (f.l1 - f.l2) / (f.l1 + f.l2) < 0.04;
    const L = ADC_K * Math.max(f.l1, 0.6) + 3;
    v1Path.setAttribute("d", pathOf([polar(L, f.angle + 180), polar(L, f.angle)]));
    v1Path.setAttribute("data-dashed", iso_ ? "" : null);
    if (!iso_) v1Path.removeAttribute("data-dashed");
  } else { fitPath.setAttribute("d", ""); v1Path.setAttribute("d", ""); }
}
const faPoint = (fa, r) => { const a = (-SWING + 2 * SWING * fa) * RAD; return iso([GAUGE[0] + Math.sin(a) * r, GAUGE[1] - Math.cos(a) * r, CONSOLE_H + 1.2], P); };
function drawArrow(psi) {
  const [x, y] = TT, ux = Math.cos(psi * RAD), uy = Math.sin(psi * RAD), nx = -uy, ny = ux;
  const p = (s, o = 0) => iso([x + ux * s + nx * o, y + uy * s + ny * o, ARROW_Z], P);
  const head = (sgn) => pathOf([p(sgn * (ARROW_L - 4), 2.2), p(sgn * ARROW_L), p(sgn * (ARROW_L - 4), -2.2)]);
  arrow.innerHTML = '<path class="iso-line" data-tone="lit" data-free="" d="' + pathOf([p(-ARROW_L), p(ARROW_L)]) + head(1) + head(-1) + '" style="stroke-width:1.1"/>';
}

// ── films: FA, colour FA, tractography ──
const un = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const W = DTI.width, H = DTI.height;
const FA = Float32Array.from(un(DTI.fa), (v) => v / 255);
const VX = Float32Array.from(un(DTI.vx), (v) => (v - 128) / 127), VY = Float32Array.from(un(DTI.vy), (v) => (v - 128) / 127), VZ = Float32Array.from(un(DTI.vz), (v) => (v - 128) / 127);
const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");
function paintPixels(film, fn) {
  canvas.width = W; canvas.height = H;
  const img = ctx.createImageData(W, H);
  for (let p = 0; p < W * H; p++) { const [r, g, b] = fn(p); img.data[p * 4] = r; img.data[p * 4 + 1] = g; img.data[p * 4 + 2] = b; img.data[p * 4 + 3] = 255; }
  ctx.putImageData(img, 0, 0);
  film.setAttribute("href", canvas.toDataURL());
}
const grey = (v) => Math.round(2.55 * (4 + 92 * clamp(v, 0, 1)));
paintPixels(films[0], (p) => { const g = grey(FA[p] / 0.8); return [g, g, g]; });
paintPixels(films[1], (p) => { const s = clamp(FA[p] / 0.7, 0, 1) * 240 + 10 * (FA[p] > 0.02); return [Math.abs(VX[p]) * s, Math.abs(VY[p]) * s, Math.abs(VZ[p]) * s].map(Math.round); });

// in-plane tractography: follow V1 from voxel to voxel while FA stays high, the fibre stays in the slice, and the
// path does not turn sharply; directions on the image: right = −x (radiological), down = −y
const at2 = (a, c, r) => a[Math.round(r) * W + Math.round(c)];
function trackFrom(c0, r0, sgn) {
  const pts = [[c0, r0]];
  let c = c0, r = r0, pc = 0, pr = 0;
  for (let n = 0; n < 400; n++) {
    const ci = Math.round(c), ri = Math.round(r);
    if (ci < 1 || ri < 1 || ci >= W - 1 || ri >= H - 1) break;
    const p = ri * W + ci;
    if (FA[p] < 0.18) break;
    let dc = -VX[p], dr = -VY[p];
    const m = Math.hypot(dc, dr);
    if (m < 0.55) break;
    dc /= m; dr /= m;
    if (n === 0) { dc *= sgn; dr *= sgn; }
    else { const dot = dc * pc + dr * pr; if (dot < 0) { dc = -dc; dr = -dr; } if (Math.abs(dot) < 0.8) break; }
    c += dc * 0.45; r += dr * 0.45; pc = dc; pr = dr;
    pts.push([c, r]);
  }
  return pts;
}
const STREAMS = [];
for (let r = 2; r < H - 2; r += 2) for (let c = 2 + (r % 4 ? 1 : 0); c < W - 2; c += 2) {
  const p = r * W + c;
  if (FA[p] < 0.32 || Math.hypot(VX[p], VY[p]) < 0.75) continue;
  const a = trackFrom(c, r, 1), b = trackFrom(c, r, -1);
  if (a.length + b.length < 34) continue;
  STREAMS.push({ a, b, colour: [Math.abs(VX[p]), Math.abs(VY[p]), Math.abs(VZ[p])] });
}
const SCALE = 2;
function paintTracts(grow) {
  canvas.width = W * SCALE; canvas.height = H * SCALE;
  const img = ctx.createImageData(W * SCALE, H * SCALE);
  for (let r = 0; r < H * SCALE; r++) for (let c = 0; c < W * SCALE; c++) { const g = grey(0.32 * FA[Math.floor(r / SCALE) * W + Math.floor(c / SCALE)] / 0.8); const o = (r * W * SCALE + c) * 4; img.data[o] = img.data[o + 1] = img.data[o + 2] = g; img.data[o + 3] = 255; }
  ctx.putImageData(img, 0, 0);
  ctx.lineWidth = 0.9;
  ctx.globalAlpha = 0.55;
  ctx.lineCap = "round";
  for (const s of STREAMS) {
    ctx.strokeStyle = "rgb(" + s.colour.map((v) => Math.round(70 + 185 * v)).join(",") + ")";
    for (const half of [s.a, s.b]) {
      const n = Math.max(1, Math.floor(half.length * grow));
      ctx.beginPath();
      ctx.moveTo((half[0][0] + 0.5) * SCALE, (half[0][1] + 0.5) * SCALE);
      for (let i = 1; i < n; i++) ctx.lineTo((half[i][0] + 0.5) * SCALE, (half[i][1] + 0.5) * SCALE);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  films[2].setAttribute("href", canvas.toDataURL());
}

// ── state and animation ──
const SWEEP_MS = 5200, HOLD_MS = 3200, SLOW = 60;
let si = 0, swept = 0, psi = FIBRE, phase = "sweep", holdT = 0, frame = 0, last = 0, clock = 0, visible = false, touring = !still.matches, idleTimer = 0, manual = false;
let faShown = 0, grow = still.matches ? 1 : 0, trackAt = -1e9;

function chooseSpecimen(i) {
  si = i; swept = 0; psi = FIBRE; phase = "sweep"; holdT = 0; manual = false;
  drawSurface(si); resetMolecules(si);
  specimenName.textContent = SPECIMENS[si].note;
  keyLamps.forEach((el, j) => el.setAttribute("opacity", j === si ? "1" : "0"));
}

function draw() {
  const sp = SPECIMENS[si], f = FITS[si];
  const fitShown = phase === "hold" || manual || still.matches;
  drawArrow(psi);
  drawDish(si, psi, manual || still.matches ? 180 : swept, fitShown);
  needle.setAttribute("d", pathOf([faPoint(faShown, 0), faPoint(faShown, FA_R - 2)]));
  const md = "MD " + f.md.toFixed(2);
  if (mdText.textContent !== md) mdText.textContent = md;
  drawMolecules();
  trackButton.setAttribute("transform", translateAlong(P, [0, 0, -1.6 * Math.exp(-Math.max(0, clock - trackAt) / 200)]));
  const rel = ((psi - FIBRE) % 180 + 180) % 180;
  const REF = { bundle: " from the fibres", crossing: " from one bundle", grey: "", csf: "" };
  const text = sp.label + " · gradient " + Math.round(rel) + "°" + REF[sp.key] + " · ADC " + adcAt(sp, psi).toFixed(2) + (fitShown ? " · FA " + f.fa.toFixed(2) : "");
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuetext", text + " · MD " + f.md.toFixed(2));
}

function tick(stamp) {
  const dt = last ? Math.min((stamp - last) / 1000, 1 / 30) : 1 / 60;
  last = stamp;
  clock += dt * 1000;
  stepMolecules((dt * 1000) / SLOW);
  if (!manual) {
    if (phase === "sweep") {
      swept = Math.min(180, swept + (180 * dt * 1000) / SWEEP_MS);
      psi = FIBRE + swept;
      if (swept >= 180) { phase = "hold"; holdT = 0; }
    } else {
      holdT += dt * 1000;
      if (holdT > HOLD_MS && touring) chooseSpecimen((si + 1) % SPECIMENS.length);
    }
  }
  const target = phase === "hold" || manual ? FITS[si].fa : 0;
  faShown += (target - faShown) * (1 - Math.exp(-dt / 0.3));
  if (grow < 1) { grow = Math.min(1, grow + dt / 2.4); paintTracts(grow); }
  draw();
  frame = visible ? requestAnimationFrame(tick) : 0;
}

const go = () => { if (!frame && visible && !still.matches) { last = 0; frame = requestAnimationFrame(tick); } };
function user() {
  touring = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { touring = !still.matches; if (manual) chooseSpecimen(si); }, 10000);
}
function retrack() { trackAt = clock; if (still.matches) { grow = 1; paintTracts(1); } else grow = 0; }
new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) go(); }, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("pointermove", (event) => {
  user();
  manual = true;
  const box = svg.getBoundingClientRect();
  psi = FIBRE + clamp(((event.clientX - box.left) / box.width - 0.12) / 0.76, 0, 1) * 180;
  if (still.matches) { faShown = FITS[si].fa; draw(); } else go();
});
stage.addEventListener("keydown", (event) => {
  if (/^[1-4]$/.test(event.key)) { user(); chooseSpecimen(Number(event.key) - 1); if (still.matches) { faShown = FITS[si].fa; draw(); } else go(); }
  else if (event.key === "t" || event.key === "T") { user(); retrack(); go(); }
  else if (event.key === "Enter" || event.key === " ") { user(); chooseSpecimen(si); go(); }
  else return;
  event.preventDefault();
});
chooseSpecimen(0);
if (still.matches) { swept = 180; psi = FIBRE + 40; phase = "hold"; faShown = FITS[0].fa; for (let i = 0; i < 400; i++) stepMolecules(0.6); paintTracts(1); }
else paintTracts(0);
draw();
`;

const body = k.plateHtml({
  fig: "Fig 13",
  title: "Tensor bench",
  hint: "Keys 1–4, T · move across",
  readout: "bundle · gradient 0° from the fibres · ADC 1.70",
  keys: [
    { mark: "lit", label: "Arrow over the sample: the gradient's direction; lit trace on the dish: the ADC measured along it" },
    { mark: "dashed", label: "Dashed ellipse: the tensor fitted to those measurements; bright line: its main direction, V1" },
    { mark: "raised", label: "Sample: one fibre bundle, two crossing bundles, grey matter or water, with the molecules' recent paths" },
    { mark: "edge", label: "Lightbox: FA, colour FA (red left–right, green front–back, blue up–down) and in-plane tractography" },
  ],
  caption:
    `In white matter, water moves easily along the axons and is held back across them by membranes and myelin, so the apparent diffusion coefficient depends on the gradient's direction: in the bundle it is ${adcAt(SPECIMENS[0], FIBRE).toFixed(1)} × 10⁻³ mm²/s along the fibres and ${adcAt(SPECIMENS[0], FIBRE + 90).toFixed(1)} across them. Measured in at least six directions, those numbers fit a diffusion tensor, drawn here as an ellipse. Its eigenvalues give the mean diffusivity (MD, how much water moves) and the fractional anisotropy (FA, 0 for the same in every direction, near 1 for one direction only); its first eigenvector, V1, points along the fibres. ` +
    `A colour FA map paints V1 as colour, red for left–right, green for front–back and blue for up–down, with brightness set by FA: in this slice the corpus callosum crosses in red at the front and back, the internal capsule runs up and down in blue, and the optic radiations run front to back in green. Tractography joins V1 from voxel to voxel into streamlines; on a single slice only the fibres lying in its plane can be followed, so the blue internal capsule leaves no streamlines here. ` +
    `Crossing fibres are the tensor's blind spot. Two bundles at right angles give a voxel whose ADC is highest between them (${adcAt(SPECIMENS[1], FIBRE + 45).toFixed(1)} at 45° against ${adcAt(SPECIMENS[1], FIBRE).toFixed(2)} along either), and the fitted tensor is a flat disc: FA falls from ${fitTensor(SPECIMENS[0]).fa.toFixed(2)} to ${fitTensor(SPECIMENS[1]).fa.toFixed(2)}, and V1 points along neither bundle, so a streamline arriving there stops or wanders. Most white-matter voxels contain more than one fibre population, which is why newer methods fit several directions per voxel. ` +
    `Model: compartments with λ∥ = 1.7 and λ⊥ = 0.3 × 10⁻³ mm²/s for fibres, 0.85/0.78 for grey matter and 3.0 for water, b = 1000 s/mm²; the bench measures in its horizontal plane only. Tractography on the film: FA above 0.18, at most about 37° of turn per 0.45 mm step, and fibres within about 57° of the slice; seeds every 2 mm where FA > 0.32. ` +
    NOTICE,
  body: `<div class="iso-stage" tabindex="0" role="application" aria-roledescription="tensor bench" aria-label="Tensor bench: keys 1 to 4 choose a fibre bundle, crossing fibres, grey matter or water; Enter sweeps the gradient again; T reruns the tractography; moving across the figure turns the gradient by hand">${svg}</div>`,
});

writeFileSync(join(HERE, OUT), k.pageHtml({ title: "Tensor bench", theme, body, script: kitScript() + live }));
console.log("wrote", OUT, "·", SPECIMENS.map((sp) => { const f = fitTensor(sp); return `${sp.key} FA ${f.fa.toFixed(2)} MD ${f.md.toFixed(2)}`; }).join(" · "));
