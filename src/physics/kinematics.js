export const M_MU = 0.1056583755; // muon mass, GeV

// Invariant mass (GeV) of two particles given transverse momentum, pseudorapidity and azimuth.
// M² = (E1 + E2)² − |p1 + p2|², natural units (c = 1).
export function invariantMass(pt1, eta1, phi1, pt2, eta2, phi2, m = M_MU) {
  const energy = (pt, eta) => Math.hypot(pt * Math.cosh(eta), m);
  const E = energy(pt1, eta1) + energy(pt2, eta2);
  const px = pt1 * Math.cos(phi1) + pt2 * Math.cos(phi2);
  const py = pt1 * Math.sin(phi1) + pt2 * Math.sin(phi2);
  const pz = pt1 * Math.sinh(eta1) + pt2 * Math.sinh(eta2);
  return Math.sqrt(Math.max(0, E * E - px * px - py * py - pz * pz));
}

// The same mass from Cartesian momenta (GeV), with each energy rebuilt as E = √(p² + m²).
export function pairMass(px1, py1, pz1, px2, py2, pz2, m = M_MU) {
  const E = Math.hypot(px1, py1, pz1, m) + Math.hypot(px2, py2, pz2, m);
  return Math.sqrt(Math.max(0, E * E - (px1 + px2) ** 2 - (py1 + py2) ** 2 - (pz1 + pz2) ** 2));
}

// Counts per bin over [lo, hi). With log = true the bins are equal-width in log(value).
export function histogram(values, lo, hi, bins, log = false) {
  const f = log ? Math.log : (v) => v;
  const a = f(lo), k = bins / (f(hi) - a), h = new Uint32Array(bins);
  for (const v of values) {
    const i = Math.floor((f(v) - a) * k);
    if (i >= 0 && i < bins) h[i]++;
  }
  return h;
}
