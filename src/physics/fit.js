// Least-squares curve fitting (Levenberg–Marquardt) for binned data, and the statistics to judge a result.

// Gauss–Jordan inverse with partial pivoting; null if the matrix is singular.
function invert(a) {
  const n = a.length, m = a.map((row, i) => [...row, ...row.map((_, j) => +(i === j))]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[piv][c])) piv = r;
    if (!(Math.abs(m[piv][c]) > 1e-300)) return null;
    [m[c], m[piv]] = [m[piv], m[c]];
    const d = m[c][c];
    for (let j = 0; j < 2 * n; j++) m[c][j] /= d;
    for (let r = 0; r < n; r++) {
      const f = m[r][c];
      if (r !== c && f) for (let j = 0; j < 2 * n; j++) m[r][j] -= f * m[c][j];
    }
  }
  return m.map((row) => row.slice(n));
}

// Minimises χ² = Σ ((y − model(x, p)) / sigma)². Returns best parameters, their covariance and 1σ errors.
export function fit(model, x, y, sigma, p0) {
  const n = x.length, k = p0.length;
  const chi2 = (p) => x.reduce((s, xi, i) => s + ((y[i] - model(xi, p)) / sigma[i]) ** 2, 0);
  const normal = (p) => { // JᵀWJ and JᵀW·residual, with numeric derivatives
    const A = Array.from({ length: k }, () => new Array(k).fill(0)), g = new Array(k).fill(0);
    for (let i = 0; i < n; i++) {
      const w = 1 / sigma[i] ** 2, r = y[i] - model(x[i], p);
      const J = p.map((pj, j) => {
        const h = 1e-6 * Math.max(Math.abs(pj), 1e-3), up = p.slice(), dn = p.slice();
        up[j] += h; dn[j] -= h;
        return (model(x[i], up) - model(x[i], dn)) / (2 * h);
      });
      for (let a = 0; a < k; a++) { g[a] += w * J[a] * r; for (let b = 0; b < k; b++) A[a][b] += w * J[a] * J[b]; }
    }
    return { A, g };
  };

  let p = p0.slice(), best = chi2(p), lambda = 1e-3;
  for (let it = 0; it < 200 && lambda < 1e10; it++) {
    const { A, g } = normal(p);
    const inv = invert(A.map((row, a) => row.map((val, b) => (a === b ? val * (1 + lambda) : val))));
    if (!inv) { lambda *= 10; continue; }
    const trial = p.map((pj, a) => pj + inv[a].reduce((s, val, b) => s + val * g[b], 0)), c = chi2(trial);
    if (!(c < best)) { lambda *= 10; continue; }
    const gain = best - c;
    p = trial; best = c; lambda /= 10;
    if (gain < 1e-8 * best || gain < 1e-12) break;
  }
  const cov = invert(normal(p).A);
  if (!cov || !isFinite(best)) return null;
  return { p, cov, err: cov.map((row, a) => Math.sqrt(Math.abs(row[a]))), chi2: best, ndf: n - k };
}

// Fits one peak on a straight-line background to a histogram with equal-width bins.
// x: bin centres, y: counts. shape 'gauss' (width = σ) or 'bw' (Breit–Wigner, width = Γ, full width at half maximum).
// Values come back as [value, 1σ error]; errors are statistical only.
export function fitPeak(x, y, shape = 'gauss') {
  const n = x.length;
  if (n < 8) return null;
  const binWidth = x[1] - x[0], span = x[n - 1] - x[0], mid = (x[0] + x[n - 1]) / 2;
  let top = 0;
  for (let i = 1; i < n; i++) if (y[i] > y[top]) top = i;
  const edge = (y[0] + y[1] + y[n - 2] + y[n - 1]) / 4;
  const peak = shape === 'gauss' ? (d, s) => Math.exp(-d * d / (2 * s * s)) : (d, s) => s * s / (4 * d * d + s * s);
  const model = (xi, p) => p[0] * peak(xi - p[1], p[2]) + p[3] + p[4] * (xi - mid);
  const r = fit(model, x, y, Array.from(y, (c) => Math.sqrt(Math.max(c, 1))), [Math.max(y[top] - edge, 1), x[top], span / 10, edge, 0]);
  if (!r) return null;
  const [height, position] = r.p, width = Math.abs(r.p[2]);
  const signal = height * width * (shape === 'gauss' ? Math.sqrt(2 * Math.PI) : Math.PI / 2) / binWidth; // area under the peak, in events
  const rel = Math.sqrt(Math.max(0, r.cov[0][0] / height ** 2 + r.cov[2][2] / width ** 2 + 2 * r.cov[0][2] / (height * r.p[2])));
  return {
    // a peak counts only if it is inside the window, resolved by the binning, and at least 3σ above the background
    ok: height > 0 && position > x[0] && position < x[n - 1] && width < span && width > binWidth / 4 && r.err.every(isFinite) && rel < 1 / 3,
    position: [position, r.err[1]], width: [width, r.err[2]], signal: [signal, signal * rel],
    chi2: r.chi2, ndf: r.ndf,
    curve: (xi) => model(xi, r.p), background: (xi) => r.p[3] + r.p[4] * (xi - mid),
  };
}

// How far a measurement lands from a prediction, in combined standard deviations.
export function compare(predicted, tolerance, measured, err) {
  const z = Math.abs(measured - predicted) / Math.hypot(tolerance, err);
  return { z, text: !isFinite(z) ? 'Cannot judge without an uncertainty' : z < 2 ? 'Prediction survived' : z < 3 ? 'In tension' : 'Prediction refuted' };
}

// Straight-line least squares y = intercept + slope·x with equal weights. Errors come from the scatter of the
// points about the line, so they assume that scatter is random. Values are [value, 1σ error].
export function linfit(x, y) {
  const n = x.length;
  if (n < 3) return null;
  const mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
  let sxx = 0, sxy = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = x[i] - mx, dy = y[i] - my; sxx += dx * dx; sxy += dx * dy; syy += dy * dy; }
  if (!(sxx > 0)) return null;
  const slope = sxy / sxx, s2 = Math.max(0, syy - slope * sxy) / (n - 2);
  return {
    n, slope: [slope, Math.sqrt(s2 / sxx)], intercept: [my - slope * mx, Math.sqrt(s2 * (1 / n + mx * mx / sxx))],
    scatter: [Math.sqrt(s2), Math.sqrt(s2 / (2 * (n - 2)))], r: syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0,
  };
}
