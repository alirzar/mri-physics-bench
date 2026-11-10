// Larmor precession and RF resonance, shared by the build and the live page.
// f0 = γ̄·B0 with γ̄ = 42.577 MHz/T for hydrogen. A rectangular RF pulse at frequency f_rf tips the net
// magnetization about the effective field in the rotating frame: with detuning Δ = f0 − f_rf and RF
// strength f1, the axis sits at θ = atan(f1/Δ) from z and turns by β = 2π·√(f1² + Δ²)·τ. Starting along z,
// Mz = cos²θ + sin²θ·cos β. The pulse length is set so that on resonance it gives exactly 90°.
// Real pulses are resonant within about a kilohertz; the dial draws the resonance far wider (F1 below)
// so it can be found by hand. The card says so.

export const GAMMA_BAR = 42.577; // MHz per tesla
export const B0_OPTIONS = [1.5, 3, 7];
export const TUNER_RANGE = [0, 320]; // MHz on the dial
export const F1 = 3; // MHz, RF strength as drawn (real: a few hundred Hz)
export const REAL_F1_HZ = 250; // Hz, a typical 1 ms 90° pulse
export const PULSE_FLIP = 90; // degrees on resonance

export const larmorOf = (B0) => GAMMA_BAR * B0;

// tip angle (radians) after fraction u (0..1) of the pulse, for detuning delta (MHz)
export function tipOf(delta, u = 1) {
  const theta = Math.atan2(F1, delta);
  const beta = ((PULSE_FLIP * Math.PI) / 180) * (Math.hypot(F1, delta) / F1) * u;
  const mz = Math.cos(theta) ** 2 + Math.sin(theta) ** 2 * Math.cos(beta);
  return Math.acos(Math.max(-1, Math.min(1, mz)));
}

// precession as drawn: half a turn per second at 3 T, in proportion to B0
export const shownTurnsPerSecond = (B0) => 0.5 * (B0 / 3);
export const slowdownOf = (B0) => (larmorOf(B0) * 1e6) / shownTurnsPerSecond(B0);

// MR spectroscopy: hydrogen in different molecules resonates a few parts per million (ppm) apart, because
// the electrons around it shield it slightly from B0. Peak positions are fixed in ppm; in hertz the spacing
// grows with B0 (1 ppm of f0, in Hz, equals f0 in MHz). Lines are Lorentzians with a typical in-vivo width
// that also grows with field, but more slowly, so peaks separate better at higher B0.
export const METABOLITES = [
  { name: "NAA", ppm: 2.01, amp: 1.0, label: true },
  { name: "Cr", ppm: 3.03, amp: 0.62, label: true },
  { name: "Cho", ppm: 3.2, amp: 0.5, label: true },
  { name: "mI", ppm: 3.56, amp: 0.3, label: false },
  { name: "Cr", ppm: 3.92, amp: 0.36, label: false },
];
export const PPM_RANGE = [4.1, 1.7]; // left → right, as spectra are drawn
export const hzPerPpm = (B0) => larmorOf(B0);
export const linewidthHz = (B0) => 4 + 1.2 * B0;
export function spectrumAt(ppm, B0) {
  const half = linewidthHz(B0) / 2 / hzPerPpm(B0); // half width at half height, in ppm
  let v = 0;
  for (const m of METABOLITES) v += m.amp / (1 + ((ppm - m.ppm) / half) ** 2);
  return v;
}

// the film: transverse magnetization makes the signal, so a proton-density image scaled by sin(tip)
export const TISSUES = [
  { key: "wm", name: "WM", PD: 0.7 },
  { key: "gm", name: "GM", PD: 0.8 },
  { key: "csf", name: "CSF", PD: 1.0 },
];
