// Arterial spin labelling (pCASL), shared by the build and the live page.
// Blood water is magnetically labelled (inverted) as it flows through a plane in the neck for a label duration
// τ. After a post-labelling delay (PLD) the labelled water has reached the brain and exchanged into tissue,
// and an image is taken. A control image without labelling is subtracted: ΔM = control − label ∝ CBF.
// Signal model: the general kinetic model for pCASL (Buxton et al. 1998) with tissue T1 taken equal to blood
// T1, as in the consensus recommendations (Alsop et al. 2015). For each tissue, with transit time δ (ATT),
// readout at t = τ + PLD after labelling starts, and A = 2·α·f·T1b/λ (f = CBF in ml/g/s):
//   t ≤ δ:            ΔM/M0 = 0                                    (label not yet arrived)
//   δ < t < τ + δ:     ΔM/M0 = A·e^(−δ/T1b)·(1 − e^(−(t − δ)/T1b))   (label still arriving)
//   t ≥ τ + δ:         ΔM/M0 = A·e^(−PLD/T1b)·(1 − e^(−τ/T1b))       (all label arrived, decaying)
// The scanner turns ΔM into CBF with the last formula, which is only right when PLD ≥ δ.

export const T1_BLOOD = 1650; // ms, arterial blood at 3 T
export const LAMBDA = 0.9; // ml/g, blood–brain partition coefficient
export const ALPHA = 0.85; // pCASL labelling efficiency
export const TAU = 1800; // ms, label duration
export const PLD_RANGE = [0, 3000]; // ms
export const PLD_DEFAULT = 1800; // ms, the consensus value for adults
export const READ_TAIL = 500; // ms after the readout before the next acquisition starts
export const NOISE = 0.005; // raw image noise as a fraction of M0 (illustrative: one pair gives GM SNR ≈ 1)
export const AVERAGES = [1, 4, 16, 64];

export const TISSUES = [
  { key: "wm", name: "WM", cbf: 20, att: 1600, PD: 0.7 },
  { key: "gm", name: "GM", cbf: 60, att: 1200, PD: 0.8 },
  { key: "csf", name: "CSF", cbf: 0, att: 0, PD: 1.0 },
];

// ΔM as a fraction of the tissue's own M0, at the readout
export function deltaMOf(tissue, pld, tau = TAU) {
  if (!tissue.cbf) return 0;
  const T1 = T1_BLOOD / 1000, d = tissue.att / 1000, ta = tau / 1000, t = (tau + pld) / 1000;
  const A = (2 * ALPHA * (tissue.cbf / 6000) * T1) / LAMBDA;
  if (t <= d) return 0;
  if (t < ta + d) return A * Math.exp(-d / T1) * (1 - Math.exp(-(t - d) / T1));
  return A * Math.exp(-pld / 1000 / T1) * (1 - Math.exp(-ta / T1));
}

// the consensus single-compartment formula: CBF (ml/100 g/min) from ΔM/M0, assuming PLD ≥ transit time
export function cbfFrom(r, pld, tau = TAU) {
  const T1 = T1_BLOOD / 1000;
  return (6000 * LAMBDA * r * Math.exp(pld / 1000 / T1)) / (2 * ALPHA * T1 * (1 - Math.exp(-tau / 1000 / T1)));
}

// the label left on a tagged spin a time dt (ms) after it was tagged
export const labelLeft = (dt) => Math.exp(-Math.max(0, dt) / T1_BLOOD);
