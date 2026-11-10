// Artifact clinic: faults inserted into the k-space acquisition of Fig 7, shared by the build and the page.
// Builds on ../kspace-plotter/model.mjs (N, the FFT, k-space of an image, line-by-line reconstruction).
//   spike      one corrupt k-space sample (e.g. static discharge)        → herringbone stripes over the whole image
//   motion     the head shifts between lines (line by line only)          → ghosts repeated along phase encoding
//   trunc      outer k-space never acquired (64 × 64)                     → ringing beside sharp edges (Gibbs)
//   fov        every other line (field of view halved)                    → wrap-around
//   ghost      EPI: left- and right-going lines misaligned in time        → a ghost shifted by half the FOV
//   warp       EPI: an uneven field shifts tissue along phase encoding    → stretching and squashing
// EPI acquires every line within ~0.1 s, so it freezes motion: the motion fault does nothing in EPI.
import { N, ESP_MS } from "../kspace-plotter/model.mjs";

export const FAULTS = [
  { key: "spike", label: "spike", epi: false, effect: "herringbone stripes" },
  { key: "motion", label: "motion", epi: false, effect: "ghosts along phase encoding" },
  { key: "trunc", label: "truncated", epi: false, effect: "ringing at edges" },
  { key: "fov", label: "small FOV", epi: false, effect: "wrap-around" },
  { key: "ghost", label: "EPI ghost", epi: true, effect: "ghost at half the FOV" },
  { key: "warp", label: "EPI warp", epi: true, effect: "stretched frontal lobe" },
];
export const SPIKE = { r: N / 2 + 40, c: N / 2 + 58, size: 0.45 }; // centred k-space position; size relative to the k = 0 value
export const MOTION = { amp: 4, period: 16 }; // mm (pixels), lines per cycle
export const TRUNC = 32; // keeps −32 ≤ k < 32 in both directions: a 64 × 64 matrix
export const GHOST = { delay: 0.45, phase: 0.35 }; // odd-line readout timing error (samples) and phase error (radians)
export const WARP = { peak: -70, x: 128, y: 52, sigma: 22 }; // Hz; illustrative field offset near the frontal pole (pixels)
export const BW_PE = 1000 / (N * ESP_MS); // EPI bandwidth per pixel along phase encoding, Hz (7.8 Hz at 0.5 ms spacing)

export const isEpi = (on) => !!(on.ghost || on.warp);

export function keep(on, r, c) {
  const inBlock = (i) => i - N / 2 >= -TRUNC && i - N / 2 < TRUNC;
  if (on.trunc && !(inBlock(r) && inBlock(c))) return false;
  if (on.fov && r & 1) return false;
  return true;
}
export function rowsFor(on) {
  const rows = [];
  for (let r = 0; r < N; r++) {
    let any = false;
    for (let c = 0; c < N && !any; c++) any = keep(on, r, c);
    if (any) rows.push(r);
  }
  return rows;
}

export const shiftAt = (line) => MOTION.amp * Math.sin((2 * Math.PI * line) / MOTION.period); // pixels

// EPI distortion: each pixel lands Δy = Δf / BW_PE pixels away along phase encoding (intensity is conserved,
// so stretched regions darken and squashed regions brighten)
export function fieldAt(x, y) {
  return WARP.peak * Math.exp(-((x - WARP.x) ** 2 + (y - WARP.y) ** 2) / (2 * WARP.sigma ** 2));
}
// inverse mapping: for each displayed pixel find the tissue that lands there (a few fixed-point steps, since the
// shift changes slowly), sample it, and scale by the Jacobian so stretched tissue thins and squashed tissue piles up
export function warp(image) {
  const out = new Float64Array(N * N);
  const shift = (x, y) => fieldAt(x, y) / BW_PE;
  for (let x = 0; x < N; x++) for (let yo = 0; yo < N; yo++) {
    let ys = yo;
    for (let it = 0; it < 5; it++) ys = yo - shift(x, ys);
    const stretch = 1 + (shift(x, ys + 0.5) - shift(x, ys - 0.5));
    const y0 = Math.floor(ys), f = ys - y0;
    const a = y0 >= 0 && y0 < N ? image[y0 * N + x] : 0;
    const b = y0 + 1 >= 0 && y0 + 1 < N ? image[(y0 + 1) * N + x] : 0;
    out[yo * N + x] = ((1 - f) * a + f * b) / Math.max(0.2, stretch);
  }
  return out;
}

// the k-space actually recorded: motion phase on every line (line by line only) and the spike
export function corrupt(K, on, rows, epi) {
  const re = Float64Array.from(K.re), im = Float64Array.from(K.im);
  if (on.motion && !epi) {
    rows.forEach((r, line) => {
      const a = (-2 * Math.PI * (r - N / 2) * shiftAt(line)) / N; // shift theorem: a shift in y is a phase ramp in ky
      const ca = Math.cos(a), sa = Math.sin(a);
      for (let c = 0; c < N; c++) {
        const i = r * N + c, u = re[i], v = im[i];
        re[i] = u * ca - v * sa; im[i] = u * sa + v * ca;
      }
    });
  }
  if (on.spike) re[SPIKE.r * N + SPIKE.c] += SPIKE.size * Math.hypot(K.re[(N / 2) * N + N / 2], K.im[(N / 2) * N + N / 2]);
  return { re, im };
}

// add one recorded line to the image accumulator; EPI ghost: odd lines (read the other way) carry a timing and
// phase error, a linear phase across x after the 1D inverse FFT
export function addFaultyLine(Ka, r, line, on, epi, acc, F) {
  const hr = new Float64Array(N), hi = new Float64Array(N);
  for (let c = 0; c < N; c++) {
    if (!keep(on, r, c)) continue;
    const v = (c + N / 2) % N;
    hr[v] = Ka.re[r * N + c]; hi[v] = Ka.im[r * N + c];
  }
  F.fft(hr, hi, true);
  if (epi && on.ghost && line & 1) {
    for (let x = 0; x < N; x++) {
      const t = GHOST.phase + (2 * Math.PI * GHOST.delay * (x - N / 2)) / N;
      const ct = Math.cos(t), st = Math.sin(t), u = hr[x], w = hi[x];
      hr[x] = u * ct - w * st; hi[x] = u * st + w * ct;
    }
  }
  const ky = (r + N / 2) % N;
  for (let y = 0; y < N; y++) {
    const m = (ky * y) % N;
    const c = F.cos[m] / N, s = F.sin[m] / N;
    const row = y * N;
    for (let x = 0; x < N; x++) {
      acc.re[row + x] += hr[x] * c - hi[x] * s;
      acc.im[row + x] += hr[x] * s + hi[x] * c;
    }
  }
}
