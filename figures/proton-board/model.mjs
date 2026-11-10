// Protons in a static field B0, shared by the build and the live page.
// Each proton sits in one of two states, parallel (lower energy) or anti-parallel. At body temperature the
// excess in the lower state is (N↑ − N↓)/N = tanh(γħB0 / 2kT): about 10 per million at 3 T. The net
// magnetization (and so the signal the scanner can ever get) is proportional to that excess, i.e. to B0.
// The board magnifies the excess so a handful of needles can show it; the factor is stated on the card.

const H = 6.62607015e-34;
const HBAR = H / (2 * Math.PI);
const KB = 1.380649e-23;
export const BODY_T = 310; // K
export const GAMMA = 2 * Math.PI * 42.577e6; // rad/s/T for 1H
export const B0_RANGE = [0, 7]; // T
export const NEEDLES = 28;
export const MAGNIFY = 12600; // board excess = true excess × MAGNIFY
export const PRESETS = [0, 1.5, 3, 7];

export const excessOf = (B0) => Math.tanh((GAMMA * HBAR * B0) / (2 * KB * BODY_T));
export const boardExcessOf = (B0) => Math.min(1, excessOf(B0) * MAGNIFY);
// needles in the parallel state on the board (N/2 + half the magnified excess)
export const parallelOf = (B0) => Math.round((NEEDLES / 2) * (1 + boardExcessOf(B0)));
export const larmorMHz = (B0) => (GAMMA * B0) / (2 * Math.PI) / 1e6;

// Image noise: SNR grows roughly in proportion to B0 (ignoring coil, tissue and sequence changes).
// σ is the noise relative to the brightest tissue after the display is rescaled; SNR ≈ 20 for CSF at 3 T.
export const SNR_AT_3T = 20;
export const noiseOf = (B0) => (B0 < 0.05 ? 1 : 3 / (SNR_AT_3T * B0));

export const TISSUES = [
  { key: "wm", name: "WM", PD: 0.7 },
  { key: "gm", name: "GM", PD: 0.8 },
  { key: "csf", name: "CSF", PD: 1.0 },
];
