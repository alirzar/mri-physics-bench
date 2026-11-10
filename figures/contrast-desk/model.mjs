// Contrast model for three sequences, shared by the build and the live page.
// Approximate brain tissue values at 3 T (literature ranges vary by ~10–20%).
//   SE  spin echo:                 S = PD · (1 − e^(−TR/T1)) · e^(−TE/T2)
//   IR  inversion recovery:        S = PD · |1 − 2e^(−TI/T1) + e^(−TR/T1)| · e^(−TE/T2)   (magnitude image)
//   GRE spoiled gradient echo:     S = PD · sin α · (1 − E1) / (1 − cos α · E1) · e^(−TE/T2*),  E1 = e^(−TR/T1)
// T2* comes from T2 and one reversible term for a well-shimmed brain, 1/T2* = 1/T2 + 1/T2′ with T2′ = 160 ms,
// which gives WM 53 ms and GM 65 ms, close to published 3 T measurements.

export const TISSUES = [
  { key: "wm", name: "WM", long: "white matter", T1: 830, T2: 80, PD: 0.7 },
  { key: "gm", name: "GM", long: "grey matter", T1: 1330, T2: 110, PD: 0.8 },
  { key: "csf", name: "CSF", long: "cerebrospinal fluid", T1: 4000, T2: 2000, PD: 1.0 },
];

export const T2_PRIME = 160; // ms
export const t2StarOf = (t) => 1 / (1 / t.T2 + 1 / T2_PRIME);

export const MODES = ["SE", "IR", "GRE"];
export const TR_RANGE = [10, 10000]; // ms; the TR fader is logarithmic
export const TR_MIN = { SE: 200, IR: 500, GRE: 5 };
export const TE_RANGE = [2, 150]; // ms
export const TE_SCALE = 150; // the TE ruler runs 0..150 ms
export const TI_RANGE = [20, 4000]; // ms
export const TI_SCALE = 4000; // the TI ruler runs 0..4000 ms
export const FLIP_RANGE = [1, 90]; // degrees

export const nullTiOf = (t, TR) => t.T1 * Math.log(2 / (1 + Math.exp(-TR / t.T1)));
export const ernstOf = (t, TR) => (Math.acos(Math.exp(-TR / t.T1)) * 180) / Math.PI;

export function signalOf(t, p) {
  if (p.mode === "IR") return t.PD * Math.abs(1 - 2 * Math.exp(-p.TI / t.T1) + Math.exp(-p.TR / t.T1)) * Math.exp(-p.TE / t.T2);
  if (p.mode === "GRE") {
    const a = (p.flip * Math.PI) / 180;
    const e1 = Math.exp(-p.TR / t.T1);
    return (t.PD * Math.sin(a) * (1 - e1)) / (1 - Math.cos(a) * e1) * Math.exp(-p.TE / t2StarOf(t));
  }
  return t.PD * (1 - Math.exp(-p.TR / t.T1)) * Math.exp(-p.TE / t.T2);
}

// s: signals in TISSUES order (WM, GM, CSF)
export function weightingOf(p, s) {
  const [wm, , csf] = s;
  const top = Math.max(...s);
  if (p.mode === "IR") {
    if (wm === top) return "T1w (IR)";
    if (csf < 0.15 * top) return "FLAIR";
    if (wm < 0.15 * top) return "WM nulled";
    return "IR";
  }
  if (p.mode === "GRE") {
    if (wm === top) return "T1w";
    if (csf === top) return p.TE >= 20 ? "T2*w" : "PDw";
    return "mixed";
  }
  if (p.TR <= 900 && p.TE <= 30) return "T1w";
  if (p.TR >= 2000 && p.TE >= 70) return "T2w";
  if (p.TR >= 2000 && p.TE <= 30) return "PDw";
  return "mixed";
}

const CSF = TISSUES[2];
export const PRESETS = [
  { name: "T1-weighted spin echo", mode: "SE", TR: 500, TE: 15, TI: 900, flip: 90 },
  { name: "PD-weighted spin echo", mode: "SE", TR: 5000, TE: 12, TI: 900, flip: 90 },
  { name: "T2-weighted spin echo", mode: "SE", TR: 4000, TE: 100, TI: 900, flip: 90 },
  { name: "FLAIR", mode: "IR", TR: 9000, TE: 100, TI: Math.round(nullTiOf(CSF, 9000)), flip: 90 },
  { name: "T1 inversion (MPRAGE-like)", mode: "IR", TR: 2300, TE: 4, TI: 900, flip: 90 },
  { name: "T1-weighted gradient echo", mode: "GRE", TR: 20, TE: 4, TI: 900, flip: 25 },
  { name: "T2*-weighted gradient echo", mode: "GRE", TR: 600, TE: 30, TI: 900, flip: 20 },
];
