// Build-side: the 3 mm z map for Fig 11 and the two voxels the desk shows.
// A smooth noise field (white noise smoothed to 6 mm FWHM, unit variance inside the brain) plus a true effect in
// visual cortex whose peak matches the t value fitted at the V1 voxel's time course.
import { V1 } from "../bold-balloon/model.mjs";
import { gauss, fit, timeCourse, RULES, thresholdOf } from "./model.mjs";

export const VOX = 3; // mm
export const FWHM = 6; // mm
export const REAL = 0.25; // a voxel counts as visual cortex when its true effect is at least a quarter of the peak

export function makeMap(slice, { noiseSeed = 2024, v1Beta = [1.0, 0.5, 0.35], fpBeta = [0, -0.45, -0.25], sigma = 0.5 } = {}) {
  const un = (b64) => Buffer.from(b64, "base64");
  const gm1 = un(slice.gm), wm1 = un(slice.wm), csf1 = un(slice.csf);
  const W1 = slice.width, H1 = slice.height, A = slice.affine;
  const W = Math.floor(W1 / VOX), H = Math.floor(H1 / VOX);
  const gm = new Float64Array(W * H), wm = new Float64Array(W * H), w = new Float64Array(W * H);
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    let g = 0, m = 0, v = 0;
    for (let dr = 0; dr < VOX; dr++) for (let dc = 0; dc < VOX; dc++) {
      const rr = r * VOX + dr, cc = c * VOX + dc, p = rr * W1 + cc;
      const i = slice.i_last - cc, j = slice.j_last - rr;
      const x = A[0][0] * i + A[0][3], y = A[1][1] * j + A[1][3];
      const e = Math.exp(-(((x - V1.x) / V1.rx) ** 2 + ((y - V1.y) / V1.ry) ** 2));
      g += gm1[p] / 255; m += wm1[p] / 255; v += (gm1[p] / 255) * (e > 0.05 ? e : 0);
    }
    const q = r * W + c, n = VOX * VOX;
    gm[q] = g / n; wm[q] = m / n; w[q] = v / n;
  }
  const mask = Array.from(gm, (g, q) => g + wm[q] > 0.45);
  const wMax = Math.max(...w.filter((_, q) => mask[q]));
  for (let q = 0; q < W * H; q++) w[q] = mask[q] ? w[q] / wMax : 0;

  // smooth noise: white noise convolved with a Gaussian of the given FWHM, rescaled to unit variance in the mask
  const g = gauss(noiseSeed);
  const white = Float64Array.from({ length: W * H }, () => g());
  const s = FWHM / VOX / 2.3548;
  const R = Math.ceil(3 * s);
  const kern = Array.from({ length: 2 * R + 1 }, (_, i) => Math.exp(-((i - R) ** 2) / (2 * s * s)));
  const tmp = new Float64Array(W * H), noise = new Float64Array(W * H);
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) { let a = 0; for (let k = -R; k <= R; k++) { const cc = Math.min(W - 1, Math.max(0, c + k)); a += kern[k + R] * white[r * W + cc]; } tmp[r * W + c] = a; }
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) { let a = 0; for (let k = -R; k <= R; k++) { const rr = Math.min(H - 1, Math.max(0, r + k)); a += kern[k + R] * tmp[rr * W + c]; } noise[r * W + c] = a; }
  const inside = [...noise].filter((_, q) => mask[q]);
  const mean = inside.reduce((a, b) => a + b, 0) / inside.length;
  const sd = Math.sqrt(inside.reduce((a, b) => a + (b - mean) ** 2, 0) / inside.length);
  for (let q = 0; q < W * H; q++) noise[q] = (noise[q] - mean) / sd;

  // the V1 voxel: the strongest true effect; its time course sets the effect size
  let v1q = 0;
  for (let q = 0; q < W * H; q++) if (w[q] > w[v1q]) v1q = q;
  // a typical run: the first noise seed whose fitted task effect lands within 3% of the true one
  let v1Seed = 1;
  while (Math.abs(fit(timeCourse(v1Beta, sigma, v1Seed)).beta[0] - v1Beta[0]) > 0.03) v1Seed++;
  const v1Course = timeCourse(v1Beta, sigma, v1Seed);
  const v1Fit = fit(v1Course);
  const amp = v1Fit.t - noise[v1q];
  const z = Float64Array.from(noise, (n, q) => (mask[q] ? n + amp * w[q] : 0));

  // a false positive: a voxel with no true effect whose noise crosses p < 0.05 but not p < 0.001; prefer the frontal lobe
  const centre = (q) => { const r = Math.floor(q / W), c = q % W; return { r, c }; };
  const cand = [];
  for (let q = 0; q < W * H; q++) if (mask[q] && w[q] === 0 && z[q] > 2.0 && z[q] < 2.8) cand.push(q);
  cand.sort((a, b) => centre(a).r - centre(b).r); // nearest the front (top rows)
  const fpq = cand[0];
  let fpSeed = 1, fpCourse = null, fpFit = null;
  for (let seed = 1; seed < 20000; seed++) {
    const y = timeCourse(fpBeta, sigma, seed);
    const f = fit(y);
    if (Math.abs(f.t - z[fpq]) < 0.03) { fpSeed = seed; fpCourse = y; fpFit = f; break; }
  }
  const zs = [...z].filter((_, q) => mask[q]);
  const rules = RULES.map((rule) => {
    const thr = thresholdOf(rule.key, zs);
    let tp = 0, fp = 0, truth = 0;
    for (let q = 0; q < W * H; q++) {
      if (!mask[q]) continue;
      const real = w[q] > REAL;
      if (real) truth++;
      if (z[q] > thr) real ? tp++ : w[q] === 0 ? fp++ : 0;
    }
    return { key: rule.key, thr, tp, fp, truth };
  });
  return { W, H, mask, w, z, v1q, fpq, v1Course, v1Fit, fpCourse, fpFit, fpSeed, v1Seed, rules, n: zs.length, amp };
}
