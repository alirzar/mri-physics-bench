// Relaxation after an RF pulse (Bloch equations, no field inhomogeneity), shared by build and page.
// After a flip α from equilibrium (M along z, size 1):
//   Mz(t)  = 1 − (1 − cos α)·e^(−t/T1)        T1: regrowth along B0 (63% of the way back at t = T1 after 90°)
//   Mxy(t) = sin α·e^(−t/T2)                   T2: loss of the transverse part (37% left at t = T2)
// After a 180° inversion, Mz = 1 − 2e^(−t/T1) passes through zero at t = T1·ln 2: the null point that
// inversion recovery uses (FLAIR times its readout to the CSF null).

export const TISSUES = [
  { key: "wm", name: "WM", T1: 830, T2: 80, PD: 0.7 },
  { key: "gm", name: "GM", T1: 1330, T2: 110, PD: 0.8 },
  { key: "csf", name: "CSF", T1: 4000, T2: 2000, PD: 1.0 },
];
export const FLIPS = [90, 180];
export const RUN = 9; // seconds of playback per run
export const SPAN_T1 = 5; // each run covers 5·T1 of the chosen tissue

export const mzOf = (tissue, t, flipDeg) => 1 - (1 - Math.cos((flipDeg * Math.PI) / 180)) * Math.exp(-t / tissue.T1);
export const mxyOf = (tissue, t, flipDeg) => Math.abs(Math.sin((flipDeg * Math.PI) / 180)) * Math.exp(-t / tissue.T2);
export const nullOf = (tissue) => tissue.T1 * Math.LN2;

// playback time s (0..RUN) → tissue time t (ms): logarithmic, so the fast T2 decay and the slow T1
// regrowth both get room on screen
export function timeOf(tissue, s) {
  const total = SPAN_T1 * tissue.T1;
  const ratio = total / tissue.T2;
  return (total * (Math.pow(ratio, s / RUN) - 1)) / (ratio - 1);
}
// precession is drawn at a steady, far-slower-than-real rate in playback time
export const TURNS_PER_SECOND = 0.7;
