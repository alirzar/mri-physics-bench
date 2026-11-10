// BOLD response: the hemodynamic (balloon) model, shared by the build and the live page.
// Neural activity u(t) drives a vasodilatory signal s, which raises blood flow f into a compliant venous
// "balloon" of volume v holding deoxyhaemoglobin q (Buxton et al. 1998; equations of Friston et al. 2000):
//   ds/dt = ε·u − κ·s − γ·(f − 1)
//   df/dt = s
//   τ0·dv/dt = f − v^(1/α)
//   τ0·dq/dt = f·E(f)/E0 − v^(1/α)·q/v,    E(f) = 1 − (1 − E0)^(1/f)   (oxygen extraction)
//   BOLD = V0·(k1·(1 − q) + k2·(1 − q/v) + k3·(1 − v)),   k1 = 7·E0, k2 = 2, k3 = 2·E0 − 0.2
// Flow rises more than oxygen use, so deoxyhaemoglobin is washed out, T2* lengthens and the signal rises.

export const PARAMS = { kappa: 0.65, gamma: 0.41, tau0: 0.98, alpha: 0.32, E0: 0.34, V0: 0.02, eps: 0.3 };
export const RUN_S = 40; // seconds per run
export const DESIGNS = [
  { key: "event", label: "event", on: [[2, 3]] },
  { key: "two", label: "two events", on: [[2, 3], [5, 6]] },
  { key: "block", label: "block", on: [[2, 22]] },
];
export const stimAt = (design, t) => (design.on.some(([a, b]) => t >= a && t < b) ? 1 : 0);

export const restState = () => ({ s: 0, f: 1, v: 1, q: 1 });
export function stepState(x, u, dt) {
  const { kappa, gamma, tau0, alpha, E0, eps } = PARAMS;
  const E = 1 - Math.pow(1 - E0, 1 / x.f);
  const out = Math.pow(x.v, 1 / alpha);
  const s = x.s + (eps * u - kappa * x.s - gamma * (x.f - 1)) * dt;
  const f = x.f + x.s * dt;
  const v = x.v + ((x.f - out) / tau0) * dt;
  const q = x.q + ((x.f * E) / E0 - (out * x.q) / x.v) / tau0 * dt;
  return { s, f, v, q };
}
export function boldOf(x) {
  const { E0, V0 } = PARAMS;
  return V0 * (7 * E0 * (1 - x.q) + 2 * (1 - x.q / x.v) + (2 * E0 - 0.2) * (1 - x.v));
}
// the whole run at once (for checks and the still frame)
export function simulate(design, dt = 0.005) {
  let x = restState();
  const out = [];
  for (let t = 0; t <= RUN_S + 1e-9; t += dt) {
    out.push({ t, ...x, bold: boldOf(x) });
    x = stepState(x, stimAt(design, t), dt);
  }
  return out;
}

// the brain film: a gradient-echo EPI image (TR 2 s, TE 30 ms at 3 T) has little tissue contrast
export const EPI = { wm: 0.362, gm: 0.392, csf: 0.321 };
// visual cortex at this slice (illustrative): grey matter within an ellipse round the occipital pole
export const V1 = { x: 0, y: -92, rx: 24, ry: 16 }; // MNI mm
