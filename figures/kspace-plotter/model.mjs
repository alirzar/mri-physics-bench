// k-space and image reconstruction, shared by the build and the live page.
// The image is the 2D inverse Fourier transform of k-space. Each k-space point (kx, ky) is one spatial
// frequency of the whole image: the centre holds the coarse brightness (contrast), the edges the fine detail.
// The readout gradient sweeps kx along a line; phase encoding steps ky from line to line.
// Matrix N × N with 1 mm pixels gives a 256 mm field of view (FOV = 1/Δk) and 1 mm resolution (1/(2·kmax)).
// Keeping only every other line doubles Δk, halves the FOV, and the image wraps around (aliasing).

export const N = 256; // matrix; also the FOV in mm (1 mm pixels)
export const CENTRE = 24; // half-width of the central block that "centre" keeps (48 × 48 points)
export const TR_MS = 500; // line by line: one excitation (one TR) per line
export const ESP_MS = 0.5; // EPI: echo spacing, all lines after one excitation
export const MODES = ["lines", "EPI"];
export const COVERAGES = [
  { key: "full", label: "full" },
  { key: "centre", label: "centre" },
  { key: "edges", label: "edges" },
  { key: "half", label: "½ lines" },
];

// r, c: rows and columns of centred k-space (ky = r − N/2, kx = c − N/2)
const inBlock = (i) => i - N / 2 >= -CENTRE && i - N / 2 < CENTRE; // k from −CENTRE to CENTRE − 1
export function included(cov, r, c) {
  const inCentre = inBlock(r) && inBlock(c);
  if (cov === "centre") return inCentre;
  if (cov === "edges") return !inCentre;
  if (cov === "half") return (r & 1) === 0;
  return true;
}
export function rowsOf(cov) {
  const rows = [];
  for (let r = 0; r < N; r++) if (cov === "centre" ? inBlock(r) : cov !== "half" || (r & 1) === 0) rows.push(r);
  return rows;
}
export const resolutionOf = (cov) => (cov === "centre" ? N / (2 * CENTRE) : 1); // mm
export const fovOf = (cov) => (cov === "half" ? N / 2 : N); // mm, along ky
export const scanTimeOf = (mode, cov) => rowsOf(cov).length * (mode === "EPI" ? ESP_MS : TR_MS); // ms

// radix-2 complex FFT of length n, in place; inverse divides by n
export function makeFFT(n) {
  const bits = Math.round(Math.log2(n));
  const rev = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
    rev[i] = r;
  }
  const cos = new Float64Array(n), sin = new Float64Array(n);
  for (let k = 0; k < n; k++) { cos[k] = Math.cos((2 * Math.PI * k) / n); sin[k] = Math.sin((2 * Math.PI * k) / n); }
  function fft(re, im, inverse = false) {
    for (let i = 0; i < n; i++) {
      const j = rev[i];
      if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1, step = n / size;
      for (let i = 0; i < n; i += size) {
        for (let j = 0; j < half; j++) {
          const wr = cos[j * step], wi = inverse ? sin[j * step] : -sin[j * step];
          const a = i + j, b = a + half;
          const tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
          re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        }
      }
    }
    if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
  }
  return { fft, cos, sin };
}

// image (N × N, real) → centred k-space (re, im)
export function kspaceOf(image, F) {
  const re = Float64Array.from(image), im = new Float64Array(N * N);
  const rr = new Float64Array(N), ri = new Float64Array(N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) { rr[x] = re[y * N + x]; ri[x] = im[y * N + x]; }
    F.fft(rr, ri);
    for (let x = 0; x < N; x++) { re[y * N + x] = rr[x]; im[y * N + x] = ri[x]; }
  }
  for (let x = 0; x < N; x++) {
    for (let y = 0; y < N; y++) { rr[y] = re[y * N + x]; ri[y] = im[y * N + x]; }
    F.fft(rr, ri);
    for (let y = 0; y < N; y++) { re[y * N + x] = rr[y]; im[y * N + x] = ri[y]; }
  }
  // centre it: row r, column c hold ky = r − N/2, kx = c − N/2
  const cre = new Float64Array(N * N), cim = new Float64Array(N * N);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const u = (r + N / 2) % N, v = (c + N / 2) % N;
    cre[r * N + c] = re[u * N + v]; cim[r * N + c] = im[u * N + v];
  }
  return { re: cre, im: cim };
}

// add one acquired k-space line (centred row r, masked by coverage) to the image accumulator (accRe, accIm):
// a 1D inverse FFT along kx, then that line's ky phase ramp across every image row
export function addLine(K, r, cov, acc, F) {
  const hr = new Float64Array(N), hi = new Float64Array(N);
  for (let c = 0; c < N; c++) {
    if (!included(cov, r, c)) continue;
    const v = (c + N / 2) % N;
    hr[v] = K.re[r * N + c]; hi[v] = K.im[r * N + c];
  }
  F.fft(hr, hi, true);
  const ky = (r + N / 2) % N;
  for (let y = 0; y < N; y++) {
    const m = (ky * y) % N;
    const c = F.cos[m] / N, s = F.sin[m] / N;
    const row = y * N;
    for (let x = 0; x < N; x++) {
      acc.re[row + x] += hr[x] * c - hi[x] * s;
      acc.im[row + x] += hr[x] * s + hi[x] * c;
    }
  }
}
