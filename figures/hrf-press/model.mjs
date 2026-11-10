// HRF printing press: the predicted BOLD signal is the stimulus design convolved with the haemodynamic response,
// and some designs give far more signal to detect than others. Shared by the build and the live page.
//   prediction(t) = Σ over stimulus seconds tₑ of hrf(t − tₑ)          (every second of stimulus prints one HRF)
//   hrf(t) = Γ(6,1) density − Γ(16,1) density / 6                     (SPM's canonical double gamma: peak ~5 s,
//                                                                       undershoot ~15 s)
// Detection efficiency of a design is 1 / var(β̂) for its regressor (up to the noise variance): the sum of squares
// of the regressor sampled at each scan, after the constant and SPM's 128 s high-pass filter (a discrete cosine set)
// are projected out. More variation in the predicted signal → more to detect.

export const TR = 2; // s
export const RUN_S = 160; // s per run
export const SCANS = RUN_S / TR;
export const HRF_S = 32; // s of response drawn per stamp
export const HP_CUTOFF = 128; // s

const LG6 = Math.log(120), LG16 = Math.log(1307674368000); // ln Γ(6), ln Γ(16)
export const hrf = (t) => (t <= 0 ? 0 : Math.exp(5 * Math.log(t) - t - LG6) - Math.exp(15 * Math.log(t) - t - LG16) / 6);

const range = (a, b, step) => { const out = []; for (let t = a; t <= b + 1e-9; t += step) out.push(t); return out; };
// jittered: each 2 s slot holds an event with probability 1/2 (a fixed random order, seed 3)
const JITTERED = (() => { let s = 3; const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) + 0.5) / 4294967296; return range(4, 158, 2).filter(() => r() < 0.5); })();
const BLOCKS = [[4, 24], [44, 64], [84, 104], [124, 144]];

// each stamp is one second of stimulus
export const DESIGNS = [
  { key: "blocked", label: "blocked", stamps: BLOCKS.flatMap(([a, b]) => range(a, b - 1, 1)), note: "4 blocks of 20 s" },
  { key: "slow", label: "slow", stamps: range(4, 148, 16), note: "an event every 16 s" },
  { key: "fast", label: "fast fixed", stamps: range(4, 158, 2), note: "an event every 2 s" },
  { key: "jitter", label: "jittered", stamps: JITTERED, note: "random 2 s slots" },
];

export function predictionAt(design, t) {
  let v = 0;
  for (const te of design.stamps) if (te < t && t - te < 40) v += hrf(t - te);
  return v;
}
export const regressorOf = (design) => Array.from({ length: SCANS }, (_, n) => predictionAt(design, n * TR));
export const stimulusOf = (design) => Array.from({ length: SCANS }, (_, n) => (design.stamps.some((te) => n * TR >= te && n * TR < te + 1) ? 1 : 0));

// residual of the regressor after the constant and the high-pass cosine set, then its sum of squares
export function efficiencyOf(design) {
  const x = regressorOf(design);
  const kmax = Math.floor((2 * SCANS * TR) / HP_CUTOFF);
  for (let k = 0; k <= kmax; k++) {
    const b = Array.from({ length: SCANS }, (_, n) => Math.cos((Math.PI * k * (n + 0.5)) / SCANS));
    const bb = b.reduce((a, v) => a + v * v, 0);
    const d = b.reduce((a, v, n) => a + v * x[n], 0) / bb;
    for (let n = 0; n < SCANS; n++) x[n] -= d * b[n];
  }
  return x.reduce((a, v) => a + v * v, 0);
}
// display gain: the largest of ×1, ×2, ×4 that keeps the prediction on the paper
export function gainOf(design) {
  let max = 0;
  for (let t = 0; t <= RUN_S; t += 0.25) max = Math.max(max, predictionAt(design, t));
  return [4, 2, 1].find((g) => g * max <= 1.0) ?? 1;
}
