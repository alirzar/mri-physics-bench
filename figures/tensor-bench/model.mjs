// The diffusion tensor: in white matter water moves faster along the fibres than across them, so the signal depends
// on the gradient's direction. Shared by the build and the live page.
//   Each specimen is one or more compartments with their own cylindrical tensor (λ∥ along the fibres, λ⊥ across);
//   the signal for an in-plane gradient direction ψ averages the compartments, S/S0 = mean exp(−b·gᵀDg), and the
//   apparent diffusion coefficient is ADC(ψ) = −ln(S/S0)/b.
//   The scanner fits one tensor to the ADCs it measures: its eigenvalues give the mean diffusivity (MD) and the
//   fractional anisotropy (FA), its first eigenvector (V1) the direction of fastest diffusion.
//   Units: µm²/ms (= 10⁻³ mm²/s); b = 1 ms/µm² (1000 s/mm²).

export const B = 1;
export const FIBRE = -35; // degrees in the plan; looks left-right on the bench
export const SPECIMENS = [
  { key: "bundle", label: "bundle", parts: [{ angle: FIBRE, par: 1.7, perp: 0.3 }], lz: 0.3, note: "a single fibre bundle" },
  { key: "crossing", label: "crossing", parts: [{ angle: FIBRE, par: 1.7, perp: 0.3 }, { angle: FIBRE + 90, par: 1.7, perp: 0.3 }], lz: 0.3, note: "two crossing bundles" },
  { key: "grey", label: "grey", parts: [{ angle: FIBRE, par: 0.85, perp: 0.78 }], lz: 0.77, note: "grey matter" },
  { key: "csf", label: "CSF", parts: [{ angle: FIBRE, par: 3.0, perp: 3.0 }], lz: 3.0, note: "free water (CSF)" },
];

const RAD = Math.PI / 180;
// diffusivity of one compartment along in-plane direction ψ (degrees)
export const dAlong = (part, psi) => part.perp + (part.par - part.perp) * Math.cos((psi - part.angle) * RAD) ** 2;
export function signalAt(sp, psi) {
  return sp.parts.reduce((s, part) => s + Math.exp(-B * dAlong(part, psi)), 0) / sp.parts.length;
}
export const adcAt = (sp, psi) => -Math.log(signalAt(sp, psi)) / B;

// least-squares in-plane tensor from ADCs measured every 1°, plus the out-of-plane eigenvalue
export function fitTensor(sp) {
  // ADC(ψ) = dxx·c² + 2·dxy·c·s + dyy·s²
  const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], r = [0, 0, 0];
  for (let psi = 0; psi < 180; psi += 1) {
    const c = Math.cos(psi * RAD), s = Math.sin(psi * RAD);
    const row = [c * c, 2 * c * s, s * s], y = adcAt(sp, psi);
    for (let i = 0; i < 3; i++) { r[i] += row[i] * y; for (let j = 0; j < 3; j++) A[i][j] += row[i] * row[j]; }
  }
  const det3 = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const d = det3(A);
  const solve = (col) => det3(A.map((row, i) => row.map((v, j) => (j === col ? r[i] : v)))) / d;
  const [dxx, dxy, dyy] = [solve(0), solve(1), solve(2)];
  const tr = dxx + dyy, diff = Math.sqrt(((dxx - dyy) / 2) ** 2 + dxy * dxy);
  const l1 = tr / 2 + diff, l2 = tr / 2 - diff;
  const angle = (0.5 * Math.atan2(2 * dxy, dxx - dyy)) / RAD; // direction of l1 in the plan, degrees
  const ls = [l1, l2, sp.lz].sort((a, b) => b - a);
  return { dxx, dxy, dyy, l1, l2, angle, lambdas: ls, md: mdOf(ls), fa: faOf(ls) };
}
export const mdOf = (l) => (l[0] + l[1] + l[2]) / 3;
export function faOf(l) {
  const m = mdOf(l);
  const num = (l[0] - m) ** 2 + (l[1] - m) ** 2 + (l[2] - m) ** 2;
  const den = l[0] ** 2 + l[1] ** 2 + l[2] ** 2;
  return den > 0 ? Math.sqrt(1.5 * (num / den)) : 0;
}
