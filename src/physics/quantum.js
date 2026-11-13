// 1D time-dependent Schrödinger equation, ħ = m = 1, hard walls at both ends.
// Crank–Nicolson time stepping: unitary, so total probability is conserved.

export function makeState(n, length) {
  const z = () => new Float64Array(n);
  return { n, dx: length / (n - 1), re: z(), im: z(), V: z(), br: z(), bi: z(), cr: z(), ci: z() };
}

// Normalised Gaussian wave packet centred at x0 with mean momentum k0.
export function gaussian(s, x0, sigma, k0) {
  for (let j = 1; j < s.n - 1; j++) {
    const x = j * s.dx, a = Math.exp(-((x - x0) ** 2) / (4 * sigma * sigma));
    s.re[j] = a * Math.cos(k0 * x); s.im[j] = a * Math.sin(k0 * x);
  }
  const k = 1 / Math.sqrt(prob(s));
  for (let j = 0; j < s.n; j++) { s.re[j] *= k; s.im[j] *= k; }
}

// Probability of finding the particle between grid indices [from, to).
export function prob(s, from = 0, to = s.n) {
  let p = 0;
  for (let j = Math.max(0, from); j < Math.min(s.n, to); j++) p += s.re[j] ** 2 + s.im[j] ** 2;
  return p * s.dx;
}

// Solves (1 + i·dt·H/2) ψ' = (1 − i·dt·H/2) ψ with the Thomas algorithm (complex tridiagonal).
export function step(s, dt) {
  const { n, dx, re, im, V, br, bi, cr, ci } = s, r = dt / (4 * dx * dx);
  for (let j = 1; j < n - 1; j++) {
    const g = 2 * r + dt * V[j] / 2;
    const nr = re[j] - r * (im[j + 1] + im[j - 1]) + g * im[j] - r * bi[j - 1];
    const ni = im[j] + r * (re[j + 1] + re[j - 1]) - g * re[j] + r * br[j - 1];
    const dr = 1 - r * ci[j - 1], di = g + r * cr[j - 1], d2 = dr * dr + di * di;
    cr[j] = -r * di / d2; ci[j] = -r * dr / d2;
    br[j] = (nr * dr + ni * di) / d2; bi[j] = (ni * dr - nr * di) / d2;
  }
  re[n - 1] = im[n - 1] = 0;
  for (let j = n - 2; j > 0; j--) {
    const xr = re[j + 1], xi = im[j + 1];
    re[j] = br[j] - (cr[j] * xr - ci[j] * xi);
    im[j] = bi[j] - (cr[j] * xi + ci[j] * xr);
  }
}

// Textbook transmission probability for a plane wave of energy E on a rectangular barrier.
export function barrierT(E, V0, a) {
  if (V0 === 0) return 1;
  if (E === V0) return 1 / (1 + V0 * a * a / 2);
  const k = Math.sqrt(2 * Math.abs(V0 - E)), s = E < V0 ? Math.sinh(k * a) : Math.sin(k * a);
  return 1 / (1 + V0 * V0 * s * s / (4 * E * Math.abs(V0 - E)));
}
