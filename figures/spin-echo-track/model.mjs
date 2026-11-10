// Spin echo, gradient echo and echo trains in the rotating frame, shared by the build and the live page.
// Eight isochromats with static off-resonance offsets (field inhomogeneity) dephase after the 90° pulse.
// Spin echo (SE): each 180° pulse at (j − ½)·TE mirrors every phase (φ → −φ); each spin keeps its own offset,
// so all are back in phase at j·TE. Echo heights fall only by irreversible T2 decay, e^(−j·TE/T2).
// On the track each 180° pulse is shown as every car reversing (the classic runners picture): the phase
// it gives is the mirror image of the true one, and the net signal is identical.
// Gradient echo (GRE): no refocusing pulse. A readout gradient first dephases the spins across the voxel and
// then rephases them; its own effect cancels at each echo (the gradient moment returns to zero), but nothing
// undoes the field's spread, so echo heights fall as e^(−t/T2*).
// The shim factor scales the spread of offsets: a poorer shim (larger factor) shortens T2*. It narrows spin
// echoes but leaves their heights alone; it lowers every gradient echo.

export const OFFSETS = [-22, -15, -9, -4, 4, 9, 15, 22]; // Hz at shim 1, one per lane (inner → outer)
export const T2 = 100; // ms, the recorder's tissue
export const T2_PRIME_BASE = 10; // ms, reversible dephasing at shim 1
export const SHIM_RANGE = [0.25, 2.5];
export const TE_RANGE = [10, 120]; // ms, echo spacing
export const N_MAX = 4;
export const T_SPAN = 400; // ms shown on the recorder
export const MODES = ["SE", "GRE"];
export const GRAD_TWIST = 2.5; // radians across the voxel at full gradient moment (cars, GRE)
export const GRAD_SHARPNESS = 8; // how fast the readout gradient dephases the voxel's signal (schematic)

export const TISSUES = [
  { key: "wm", name: "WM", T2: 80, PD: 0.7 },
  { key: "gm", name: "GM", T2: 110, PD: 0.8 },
  { key: "csf", name: "CSF", T2: 2000, PD: 1.0 },
];

export const t2PrimeOf = (shim) => T2_PRIME_BASE / shim;
export const t2StarOf = (shim) => 1 / (1 / T2 + shim / T2_PRIME_BASE);
export const maxEchoes = (TE) => Math.max(1, Math.min(N_MAX, Math.floor(T_SPAN / TE - 0.5)));
export const endOf = (TE, N) => (N + 0.5) * TE;
export const pulseTimes = (TE, N) => [0, ...Array.from({ length: N }, (_, j) => (j + 0.5) * TE)];

export function refocusCount(t, TE, N) {
  let n = 0;
  for (let j = 1; j <= N; j++) if (t >= (j - 0.5) * TE) n = j;
  return n;
}

const halfWidth = (TE) => Math.min(10, TE / 6); // RF pulse half-width
const prephase = (TE) => [halfWidth(TE) + 0.5, TE / 2 - halfWidth(TE) - 0.5];
const readHalf = (TE) => Math.min(8, TE / 2 - halfWidth(TE) - 0.5);

// GRE readout gradient moment: 0 after the pulse, −1 at the end of the prephaser (TE/2), then a triangle
// wave from alternating readout lobes that passes through zero at every echo, n·TE
export function momentOf(t, TE) {
  const a = halfWidth(TE) + 0.5;
  if (t <= a) return 0;
  if (t < TE / 2) return -(t - a) / (TE / 2 - a);
  const u = (t - TE / 2) / TE;
  const n = Math.floor(u);
  return (n % 2 === 0 ? 1 : -1) * (2 * (u - n) - 1);
}

// car phase (radians). SE: direction flips at every 180° pulse. GRE: field spread plus the gradient's twist
// across the voxel (lane runs from −1 inner to +1 outer)
export function phaseOf(offset, t, TE, N, shim, mode = "SE", lane = 0) {
  const w = (2 * Math.PI * offset * shim) / 1000;
  if (mode === "GRE") return w * t + GRAD_TWIST * lane * momentOf(t, TE);
  const n = refocusCount(t, TE, N);
  const since = t - n * TE;
  return w * (n % 2 ? -since : since);
}

// Real tissue has a continuous (Lorentzian) spread of offsets; the cars are a sample of it. SE: dephasing is
// exponential in the time from the last refocus point (0 for the FID, j·TE after pulse j). GRE: dephasing
// from the field runs on unchecked, and the readout gradient adds its own, which vanishes at each echo.
export function decayOf(t, TE, N, shim, t2, mode = "SE") {
  if (mode === "GRE") return Math.exp(-t / t2) * Math.exp(-t / t2PrimeOf(shim)) * Math.exp(-GRAD_SHARPNESS * Math.abs(momentOf(t, TE)));
  const n = refocusCount(t, TE, N);
  return Math.exp(-t / t2) * Math.exp(-Math.abs(t - n * TE) / t2PrimeOf(shim));
}

export const signalOf = (t, TE, N, shim, mode = "SE") => decayOf(t, TE, N, shim, T2, mode);
export const tissueSignalOf = (tissue, t, TE, N, shim, mode = "SE") => tissue.PD * decayOf(t, TE, N, shim, tissue.T2, mode);

export function stageOf(t, TE, N, mode = "SE") {
  if (t < 1.5) return "90° pulse";
  for (let j = 1; j <= N; j++) {
    if (mode === "SE" && Math.abs(t - (j - 0.5) * TE) < 1.5) return "180° pulse";
    if (Math.abs(t - j * TE) < 2) return "echo " + j;
  }
  if (t < TE / 2) return "FID";
  if (mode === "GRE") {
    const u = (t - TE / 2) / TE;
    return u - Math.floor(u) < 0.5 && t < N * TE ? "rephasing" : "dephasing";
  }
  const n = refocusCount(t, TE, N);
  return t < n * TE ? "rephasing" : "dephasing";
}

// ── sequence diagram channels (schematic shapes; gradient lobes not to scale) ──
const sinc = (x) => (Math.abs(x) < 1e-6 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x));
function trap(t, a, b, ramp) {
  if (b <= a || t <= a || t >= b) return 0;
  const r = Math.min(ramp, (b - a) / 3);
  if (t < a + r) return (t - a) / r;
  if (t > b - r) return (b - t) / r;
  return 1;
}

// GRE passes N = 0 here: only the 90° pulse
export function rfOf(t, TE, N) {
  const hw = halfWidth(TE);
  let v = 0;
  pulseTimes(TE, N).forEach((tp, i) => {
    const x = t - tp;
    if (Math.abs(x) < hw) v += (i ? 1 : 0.5) * sinc(x / (hw / 3)) * (0.5 + 0.5 * Math.cos((Math.PI * x) / hw));
  });
  return v;
}

export function gzOf(t, TE, N) {
  const hw = halfWidth(TE);
  const [a, b] = prephase(TE);
  let v = -0.5 * trap(t, a, (a + b) / 2, 1.5);
  for (const tp of pulseTimes(TE, N)) v += trap(t, tp - hw, tp + hw, 1.5);
  return v;
}

export const gyOf = (t, TE) => 0.7 * trap(t, ...prephase(TE), 1.5);

export function gxOf(t, TE, N, mode = "SE") {
  if (mode === "GRE") {
    let v = -0.8 * trap(t, halfWidth(TE) + 0.5, TE / 2, 1.5);
    for (let n = 0; n < N; n++) v += (n % 2 === 0 ? 0.6 : -0.6) * trap(t, TE / 2 + n * TE, TE / 2 + (n + 1) * TE, 1.5);
    return v;
  }
  const ro = readHalf(TE);
  let v = 0.5 * trap(t, ...prephase(TE), 1.5);
  for (let j = 1; j <= N; j++) v += trap(t, j * TE - ro, j * TE + ro, 1.5);
  return v;
}
