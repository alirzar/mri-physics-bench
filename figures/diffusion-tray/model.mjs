// Diffusion weighting: the Stejskal–Tanner pulsed-gradient spin echo, the apparent diffusion coefficient (ADC) and
// what an infarct looks like over time. Shared by the build and the live page.
//   Two gradient lobes (duration δ, starts Δ apart) on either side of the 180° pulse wind each spin's phase in
//   proportion to its position and then unwind it. A spin that stayed put ends with no extra phase; one that moved
//   by Δx keeps q·Δx, q = γGδ. Averaged over many molecules the echo falls to S = S0·exp(−b·D), b = q²(Δ − δ/3).
//   Time t is in ms, lengths in µm, D in µm²/ms (1 µm²/ms = 1 × 10⁻³ mm²/s), b in s/mm².

export const SEQ = { g1: [10, 30], rf180: 40, g2: [50, 70], te: 80, end: 90 }; // ms
export const SMALL_DELTA = 20; // δ, ms
export const BIG_DELTA = 40; // Δ, ms
export const DIFF_TIME = BIG_DELTA - SMALL_DELTA / 3; // ms
export const B_VALUES = [0, 500, 1000, 2000, 3000];
export const GAMMA = 2.675e8; // rad s⁻¹ T⁻¹

// q in rad/µm for a b-value in s/mm²: b = q² (Δ − δ/3)  →  q = √(b / (Δ − δ/3))
export const qOf = (b) => Math.sqrt(b / (DIFF_TIME / 1000)) / 1000;
// gradient amplitude in mT/m: G = q / (γ δ)
export const gradientOf = (b) => ((qOf(b) * 1e6) / (GAMMA * (SMALL_DELTA / 1000))) * 1000;

// k(t): the phase-winding wave number in units of q. It ramps up in the first lobe, changes sign at the 180° pulse
// (which mirrors every phase) and ramps back to zero in the second lobe: the echo.
export function kAt(t) {
  const [a1, b1] = SEQ.g1, [a2, b2] = SEQ.g2;
  if (t < a1) return 0;
  if (t < b1) return (t - a1) / (b1 - a1);
  if (t < SEQ.rf180) return 1;
  if (t < a2) return -1;
  if (t < b2) return -1 + (t - a2) / (b2 - a2);
  return 0;
}
// the share of the b-value accumulated by time t: ∫k² dt / (Δ − δ/3)
export function bShareAt(t) {
  let s = 0;
  const dt = 0.05;
  for (let u = 0; u < Math.min(t, SEQ.te); u += dt) s += kAt(u + dt / 2) ** 2 * dt;
  return s / DIFF_TIME;
}

// tissues at 3 T, read with a spin-echo EPI (TR 5000 ms, TE 80 ms); ADC in µm²/ms
export const TR = 5000;
export const TE = 80;
export const TISSUES = {
  csf: { label: "CSF", pd: 1.0, t1: 4000, t2: 2000, adc: 3.0 },
  gm: { label: "grey matter", pd: 0.8, t1: 1330, t2: 110, adc: 0.8 },
  wm: { label: "white matter", pd: 0.7, t1: 830, t2: 80, adc: 0.7 },
};
// an infarct over time: ADC and T2 relative to the healthy tissue
export const STAGES = [
  { key: "acute", label: "acute", when: "hours", adc: 0.55, t2: 1.0 },
  { key: "subacute", label: "subacute", when: "about a week", adc: 1.0, t2: 1.45 },
  { key: "chronic", label: "chronic", when: "months", adc: 2.2, t2: 3.0 },
];
// illustrative infarct in the left middle-cerebral-artery territory (MNI mm)
export const LESION = { x: -47, y: -2, rx: 17, ry: 24 };

export const s0Of = (t, stage = null) => t.pd * (1 - Math.exp(-TR / t.t1)) * Math.exp(-TE / (t.t2 * (stage ? stage.t2 : 1)));
export const adcOf = (t, stage = null) => t.adc * (stage ? stage.adc : 1);
export const signalOf = (t, b, stage = null) => s0Of(t, stage) * Math.exp(-(b / 1000) * adcOf(t, stage));
