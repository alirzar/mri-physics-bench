// Shared film viewer (lightbox) with synthetic MRI slices, used by several course figures.
// Build side: lightboxGeometry(LB, slice, { grid }) lays out one or more films on the screen;
// lightboxSvg(k, P, g) draws the viewer, each film an <image data-part="film-i">.
// Page side: FILM_JS defines makeFilm(svg, slice, keys, part = "film-0") → paint(weights), where each
// pixel is Σ fraction_k × weight_k and weights are 0..1 on the display window (1 = white).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

export const loadSlice = () => JSON.parse(readFileSync(join(HERE, "..", "data", "mni152-slice.json"), "utf8"));

export const MNI_NOTICE =
  "The film is a synthetic image: each 1 mm pixel is the sum of its GM, WM and CSF fractions times that tissue's signal, using the tissue probability maps of the MNI152 ICBM 2009c Nonlinear Asymmetric template (Fonov et al., NeuroImage 2011; via TemplateFlow). Brain only, no skull or scalp; real images add noise, coil shading and tissues this model leaves out. MNI152 template: Copyright (C) 1993–2004 Louis Collins, McConnell Brain Imaging Centre, Montreal Neurological Institute, McGill University.";

// LB: plan of the housing { x, y, w, d, r }; the front face (y + d) faces the viewer.
// grid: [columns, rows]; films fill the screen with `gap` between them, row 0 at the top.
export function lightboxGeometry(LB, slice, { z0 = 4, top = 124, grid = [1, 1], gap = 8, labels = null } = {}) {
  const face = LB.y + LB.d;
  const [cols, rows] = grid;
  const screen = { x0: LB.x + 6, x1: LB.x + LB.w - 6, z0: z0 + 8, z1: top - 6 };
  const labelRoom = labels ? 5 : 0;
  const maxH = (screen.z1 - screen.z0 - 8 - gap * (rows - 1) - labelRoom * rows) / rows;
  const maxW = (screen.x1 - screen.x0 - 8 - gap * (cols - 1)) / cols;
  const aspect = slice.width / slice.height;
  const filmH = Math.min(cols === 1 && rows === 1 ? 96 : maxH, maxW / aspect);
  const filmW = filmH * aspect;
  const totalW = cols * filmW + (cols - 1) * gap;
  const totalH = rows * (filmH + labelRoom) + (rows - 1) * gap;
  const left = (screen.x0 + screen.x1) / 2 - totalW / 2;
  const bottom = cols === 1 && rows === 1 ? 17 : (screen.z0 + screen.z1) / 2 - totalH / 2;
  const films = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      films.push({ x: left + c * (filmW + gap), z: bottom + (rows - 1 - r) * (filmH + labelRoom + gap) + labelRoom, label: labels ? labels[r * cols + c] : null });
  return { LB, z0, top, face, filmH, filmW, filmY: face + 0.8, films };
}

export function lightboxSvg(k, P, g) {
  const { LB, z0, top, face, filmH, filmW, filmY, films } = g;
  const at = (p) => k.iso(p, P);
  const S = (paths, style) => k.solidSvg(paths, style);
  const L = (d, style) => k.lineSvg(d, style);
  const D = (points, style) => k.dotsSvg(points, style);
  const out = [`<path class="iso-halo" d="${k.haloOf(LB, 0, 0.1, P)}" style="filter:blur(4px)"/>`];
  for (const fx of [LB.x + 6, LB.x + LB.w - 20]) {
    const foot = { x: fx, y: LB.y - 8, w: 14, d: LB.d + 18, r: 2 };
    out.push(S(k.slabOf(foot, 0, z0, P, 3, 0.5), { tone: "lo" }));
    out.push(D([at([fx + 7, foot.y + 3, z0]), at([fx + 7, foot.y + foot.d - 3, z0])], { size: 0.45 }));
  }
  out.push(S(k.slabOf(LB, z0, top - z0, P, 3, 0.8), { tone: "mid", inner: L(k.sideSeam(LB, z0 + 4, P, 3), { tone: "faint" }) }));
  // diffuser screen, inset in the front face
  const screen = { x: LB.x + 6, y: face, w: LB.w - 12, d: 0.6, r: 0 };
  out.push(S(k.slabOf(screen, z0 + 8, top - z0 - 14, P, 1), { tone: "hi", crease: "none" }));
  films.forEach((f, i) => {
    out.push(`<image data-part="film-${i}" x="0" y="0" width="${filmW.toFixed(2)}" height="${filmH.toFixed(2)}" preserveAspectRatio="none" transform="${k.sideMatrix([f.x, filmY], f.z + filmH, P, "left")}" href=""/>`);
    const edge = [[f.x, filmY, f.z], [f.x + filmW, filmY, f.z], [f.x + filmW, filmY, f.z + filmH], [f.x, filmY, f.z + filmH]];
    out.push(L(k.pathOf(edge.map((p) => at(p)), true), { tone: "lo" }));
    const clips = films.length === 1 ? [f.x + filmW * 0.25, f.x + filmW * 0.75] : [f.x + filmW / 2];
    for (const cx of clips) {
      out.push(S(k.slabOf({ x: cx - 3, y: filmY, w: 6, d: 2.2, r: 0.6 }, f.z + filmH - 4, 7, P, 2, 0.3), { tone: "mid" }));
      out.push(D([at([cx, filmY + 2.2, f.z + filmH + 1.2])], { size: 0.45 }));
    }
    if (f.label) out.push(k.faceTextSvg(k.sideMatrix([f.x, face], f.z - 4.4, P, "left"), f.label, { size: 3.4, tone: "lo" }));
  });
  // bezel screws and a rocker switch on the lower bezel
  out.push(D([[LB.x + 3, z0 + 3], [LB.x + LB.w - 3, z0 + 3], [LB.x + 3, top - 3], [LB.x + LB.w - 3, top - 3]].map(([x, z]) => at([x, face, z])), { size: 0.45 }));
  out.push(S(k.slabOf({ x: LB.x + LB.w - 16, y: face, w: 8, d: 2.4, r: 0.8 }, z0 + 1.5, 4.5, P, 2, 0.3), { tone: "hi", crease: "lo" }));
  return out.join("");
}

export const FILM_JS = `
// opts.signed: a difference image (values below zero show black instead of folding back as magnitude)
function makeFilm(svg, slice, keys, part = "film-0", opts = {}) {
  const unpack = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const maps = (makeFilm.cache ||= {});
  const planes = keys.map((key) => (maps[key] ||= unpack(slice[key])));
  const film = svg.querySelector('[data-part="' + part + '"]');
  const canvas = document.createElement("canvas");
  canvas.width = slice.width;
  canvas.height = slice.height;
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(slice.width, slice.height);
  let painted = null;
  let grain = null;
  let grainSeed = null;
  // paint(weights, noise, seed): noise is the standard deviation of a Gaussian grain in display units
  // (1 = white); a new seed draws a new grain, as a new acquisition would
  return function paint(weights, noise = 0, seed = opts.seed ?? 12345) {
    const key = weights.concat(noise, seed);
    if (painted && key.every((v, i) => Math.abs(v - painted[i]) < 0.002)) return;
    painted = key;
    if (noise && grainSeed !== seed) {
      let s = seed >>> 0;
      const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) + 0.5) / 4294967296;
      grain = new Float32Array(slice.width * slice.height).map(() => Math.sqrt(-2 * Math.log(rand())) * Math.cos(2 * Math.PI * rand()));
      grainSeed = seed;
    }
    const px = image.data;
    for (let p = 0, n = slice.width * slice.height; p < n; p++) {
      let v = 0;
      for (let i = 0; i < planes.length; i++) v += planes[i][p] * weights[i];
      if (noise) v = opts.signed ? v + 255 * noise * grain[p] : Math.abs(v + 255 * noise * grain[p]); // magnitude images keep noise positive
      const g = Math.round(2.55 * (4 + 92 * Math.min(1, Math.max(0, v / 255))));
      px[p * 4] = px[p * 4 + 1] = px[p * 4 + 2] = g;
      px[p * 4 + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    film.setAttribute("href", canvas.toDataURL());
  };
}
`;
