// GLM desk and false positives: fit one voxel's time course with the general linear model, then threshold a whole
// map of t values and count what survives. Shared by the build and the live page.
//   y = X·β + e,   X = [task, drift, constant]      (task: the blocked design of Fig 10 convolved with the HRF)
//   least squares: β̂ = (XᵀX)⁻¹Xᵀy;  σ̂² = |y − Xβ̂|² / (n − 3);  t = β̂_task / √(σ̂² [(XᵀX)⁻¹]₁₁)
// The map: a smooth noise field (unit variance, as after spatial smoothing) plus a true effect in visual cortex.
// Thresholds: p < 0.05 and p < 0.001 uncorrected, FDR q < 0.05 (Benjamini–Hochberg), FWE p < 0.05 (Bonferroni).

export const TR = 2;
export const SCANS = 80;
export const RUN_S = SCANS * TR;
export const BLOCKS = [[4, 24], [44, 64], [84, 104], [124, 144]];
const LG6 = Math.log(120), LG16 = Math.log(1307674368000);
const hrf = (t) => (t <= 0 ? 0 : Math.exp(5 * Math.log(t) - t - LG6) - Math.exp(15 * Math.log(t) - t - LG16) / 6);

// regressors, one value per scan
export const TASK = (() => {
  const x = Array.from({ length: SCANS }, (_, n) => { let v = 0; for (const [a, b] of BLOCKS) for (let te = a; te < b; te++) v += hrf(n * TR - te); return v; });
  const max = Math.max(...x);
  return x.map((v) => v / max);
})();
export const DRIFT = Array.from({ length: SCANS }, (_, n) => -1 + (2 * n) / (SCANS - 1));
export const X = Array.from({ length: SCANS }, (_, n) => [TASK[n], DRIFT[n], 1]);
export const NAMES = ["task", "drift", "baseline"];

function inverse3(m) {
  const [[a, b, c], [d, e, f], [g, h, i]] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [
    [A / det, -(b * i - c * h) / det, (b * f - c * e) / det],
    [B / det, (a * i - c * g) / det, -(a * f - c * d) / det],
    [C / det, -(a * h - b * g) / det, (a * e - b * d) / det],
  ];
}
const XTX_INV = inverse3([0, 1, 2].map((r) => [0, 1, 2].map((c) => X.reduce((s, row) => s + row[r] * row[c], 0))));

export const modelOf = (beta) => X.map((row) => row[0] * beta[0] + row[1] * beta[1] + row[2] * beta[2]);
export const rssOf = (y, beta) => modelOf(beta).reduce((s, m, n) => s + (y[n] - m) ** 2, 0);
export function fit(y) {
  const xty = [0, 1, 2].map((c) => X.reduce((s, row, n) => s + row[c] * y[n], 0));
  const beta = XTX_INV.map((r) => r[0] * xty[0] + r[1] * xty[1] + r[2] * xty[2]);
  const rss = rssOf(y, beta);
  const sigma2 = rss / (SCANS - 3);
  const se = Math.sqrt(sigma2 * XTX_INV[0][0]);
  return { beta, rss, sigma: Math.sqrt(sigma2), se, t: beta[0] / se };
}

// a simple seeded Gaussian generator
export function gauss(seed) {
  let s = seed >>> 0;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) + 0.5) / 4294967296;
  return () => Math.sqrt(-2 * Math.log(r())) * Math.cos(2 * Math.PI * r());
}
// a voxel's time course in % signal change
export function timeCourse(beta, sigma, seed) {
  const g = gauss(seed);
  return modelOf(beta).map((m) => m + sigma * g());
}

// standard normal tail and its inverse (for thresholds)
export function upperTail(z) {
  // Abramowitz–Stegun 7.1.26 via erfc, accurate to ~1e-7
  const x = z / Math.SQRT2, t = 1 / (1 + 0.3275911 * Math.abs(x));
  const erfc = t * Math.exp(-x * x) * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  return x >= 0 ? erfc / 2 : 1 - erfc / 2;
}
export function zFor(p) {
  let lo = -10, hi = 10;
  for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (upperTail(mid) > p) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

// the threshold for each rule, given the map's z values inside the brain
export const RULES = [
  { key: "p05", label: "p < .05", note: "p < 0.05, uncorrected" },
  { key: "p001", label: "p < .001", note: "p < 0.001, uncorrected" },
  { key: "fdr", label: "FDR .05", note: "FDR q < 0.05" },
  { key: "fwe", label: "FWE .05", note: "FWE p < 0.05 (Bonferroni)" },
];
export function thresholdOf(rule, zs) {
  const n = zs.length;
  if (rule === "p05") return zFor(0.05);
  if (rule === "p001") return zFor(0.001);
  if (rule === "fwe") return zFor(0.05 / n);
  const ps = zs.map(upperTail).sort((a, b) => a - b);
  let k = -1;
  for (let i = 0; i < n; i++) if (ps[i] <= ((i + 1) / n) * 0.05) k = i;
  return k < 0 ? Infinity : zFor(ps[k]);
}
