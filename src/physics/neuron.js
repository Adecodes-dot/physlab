// Hodgkin–Huxley squid-axon membrane (1952), 6.3 °C. V in mV, t in ms, I in µA/cm².
const C = 1, G_L = 0.3, E_NA = 50, E_K = -77, E_L = -54.387;

const lin = (x) => (Math.abs(x) < 1e-7 ? 10 : x / (1 - Math.exp(-x / 10))); // removable singularity at x = 0
const rates = (V) => ({
  am: 0.1 * lin(V + 40), bm: 4 * Math.exp(-(V + 65) / 18),
  ah: 0.07 * Math.exp(-(V + 65) / 20), bh: 1 / (1 + Math.exp(-(V + 35) / 10)),
  an: 0.01 * lin(V + 55), bn: 0.125 * Math.exp(-(V + 65) / 80),
});

// A current pulse of amplitude I runs from t0 for dur ms. Returns sampled traces and spike times.
export function simulate({ I = 10, t0 = 10, dur = 80, T = 100, dt = 0.01, gNa = 120, gK = 36 } = {}) {
  const r0 = rates(-65);
  let y = [-65, r0.am / (r0.am + r0.bm), r0.ah / (r0.ah + r0.bh), r0.an / (r0.an + r0.bn)];
  const f = ([V, m, h, n], t) => {
    const r = rates(V), stim = t >= t0 && t < t0 + dur ? I : 0;
    return [
      (stim - gNa * m ** 3 * h * (V - E_NA) - gK * n ** 4 * (V - E_K) - G_L * (V - E_L)) / C,
      r.am * (1 - m) - r.bm * m, r.ah * (1 - h) - r.bh * h, r.an * (1 - n) - r.bn * n,
    ];
  };
  const add = (a, b, k) => a.map((v, i) => v + b[i] * k);
  const out = { t: [], V: [], m: [], h: [], n: [], spikes: [] };
  for (let i = 0; i <= Math.round(T / dt); i++) {
    const t = i * dt;
    if (i % 10 === 0) { out.t.push(t); out.V.push(y[0]); out.m.push(y[1]); out.h.push(y[2]); out.n.push(y[3]); }
    const k1 = f(y, t), k2 = f(add(y, k1, dt / 2), t + dt / 2), k3 = f(add(y, k2, dt / 2), t + dt / 2), k4 = f(add(y, k3, dt), t + dt);
    const next = y.map((v, j) => v + dt / 6 * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
    if (y[0] < 0 && next[0] >= 0) out.spikes.push(t); // upward crossing of 0 mV
    y = next;
  }
  return out;
}
