import test from 'node:test';
import assert from 'node:assert/strict';
import { invariantMass, histogram } from '../src/physics/kinematics.js';
import { G, step, energy } from '../src/physics/nbody.js';
import * as q from '../src/physics/quantum.js';
import { simulate } from '../src/physics/neuron.js';

const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b} (tol ${tol})`);

test('invariant mass reproduces the CMS value for the first event', () => {
  near(invariantMass(9.5175, 0.1945, 3.1031, 7.4178, 0.7756, -0.1560), 17.4922, 0.005);
});

test('histogram bins linear and log ranges', () => {
  assert.deepEqual([...histogram([0.5, 1.5, 1.6, 9], 0, 2, 2)], [1, 2]);
  assert.deepEqual([...histogram([1, 5, 50, 500], 1, 100, 2, true)], [2, 1]);
});

test('leapfrog keeps Earth on a closed one-year orbit and conserves energy', () => {
  const b = [{ m: 1, x: 0, y: 0, vx: 0, vy: 0 }, { m: 3e-6, x: 1, y: 0, vx: 0, vy: Math.sqrt(G) }];
  const e0 = energy(b);
  for (let i = 0; i < 1000; i++) step(b, 0.001);
  near(b[1].x, 1, 2e-3); near(b[1].y, 0, 2e-3);
  near(energy(b) / e0, 1, 1e-6);
});

test('Crank–Nicolson conserves probability and moves a free packet at k0', () => {
  const s = q.makeState(1201, 120);
  q.gaussian(s, 30, 5, 1.2);
  for (let i = 0; i < 400; i++) q.step(s, 0.05);
  near(q.prob(s), 1, 1e-9);
  let mean = 0;
  for (let j = 0; j < s.n; j++) mean += j * s.dx * (s.re[j] ** 2 + s.im[j] ** 2) * s.dx;
  near(mean, 30 + 1.2 * 20, 0.5);
});

test('a packet below the barrier energy partly tunnels, roughly as theory predicts', () => {
  const s = q.makeState(1201, 120), E = 0.8, V0 = 1, a = 1.5;
  for (let j = 0; j < s.n; j++) if (j * s.dx >= 60 && j * s.dx < 60 + a) s.V[j] = V0;
  q.gaussian(s, 35, 5, Math.sqrt(2 * E));
  for (let i = 0; i < 800; i++) q.step(s, 0.05);
  const T = q.prob(s, Math.round((60 + a) / s.dx));
  near(T, q.barrierT(E, V0, a), 0.05);
});

test('Hodgkin–Huxley neuron rests without input and fires repeatedly with it', () => {
  assert.equal(simulate({ I: 0 }).spikes.length, 0);
  assert.ok(simulate({ I: 10 }).spikes.length >= 4);
  near(simulate({ I: 0 }).V.at(-1), -65, 0.5);
});

// --- measurement engine ---
import { readFileSync } from 'node:fs';
import { fitPeak, compare } from '../src/physics/fit.js';

test('peak fit recovers a known Gaussian on a sloped background within its own error bars', () => {
  let seed = 42;
  const rand = () => (seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32;
  const gauss = () => Math.sqrt(-2 * Math.log(rand() || 1e-12)) * Math.cos(2 * Math.PI * rand());
  const x = Array.from({ length: 80 }, (_, i) => 9 + (i + 0.5) * 0.0125);
  const truth = (xi) => 900 * Math.exp(-((xi - 9.46) ** 2) / (2 * 0.09 ** 2)) + 300 - 40 * (xi - 9.5);
  const y = x.map((xi) => Math.round(truth(xi) + Math.sqrt(truth(xi)) * gauss()));
  const f = fitPeak(x, y, 'gauss');
  assert.ok(f.ok);
  near(f.position[0], 9.46, 4 * f.position[1]);
  near(f.width[0], 0.09, 4 * f.width[1]);
  near(f.signal[0], 900 * 0.09 * Math.sqrt(2 * Math.PI) / 0.0125, 4 * f.signal[1]);
  assert.ok(f.chi2 / f.ndf > 0.5 && f.chi2 / f.ndf < 1.6, `chi2/ndf ${f.chi2 / f.ndf}`);
});

test('fitting the real CMS data finds the J/psi near 3.097 GeV', () => {
  const rows = readFileSync(new URL('../data/dimuon.csv', import.meta.url), 'utf8').split('\n').slice(1).map((r) => r.split(',').map(Number));
  const m = rows.filter((r) => r.length === 8 && r[3] * r[7] === -1).map((r) => invariantMass(r[0], r[1], r[2], r[4], r[5], r[6]));
  const lo = 2.95, hi = 3.25, bins = 60, h = histogram(m, lo, hi, bins);
  const f = fitPeak(Array.from(h, (_, i) => lo + (i + 0.5) * (hi - lo) / bins), h, 'gauss');
  assert.ok(f.ok);
  near(f.position[0], 3.0969, 0.015);
  assert.ok(f.width[0] > 0.015 && f.width[0] < 0.06, `width ${f.width[0]}`);
  assert.ok(f.signal[0] > 1000, `signal ${f.signal[0]}`);
});

test('compare judges a prediction against a measurement', () => {
  assert.equal(compare(3.097, 0.005, 3.094, 0.001).text, 'Prediction survived');
  assert.equal(compare(3.2, 0.005, 3.094, 0.001).text, 'Prediction refuted');
  assert.equal(compare(1, 0, 1, 0).text, 'Cannot judge without an uncertainty');
});

import { linfit } from '../src/physics/fit.js';
import { revolutions } from '../src/physics/nbody.js';

test('straight-line fit recovers slope and intercept within its error bars', () => {
  let seed = 7;
  const rand = () => (seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32;
  const x = Array.from({ length: 200 }, (_, i) => i / 20), y = x.map((xi) => 1 + 2 * xi + (rand() - 0.5));
  const f = linfit(x, y);
  near(f.slope[0], 2, 4 * f.slope[1]);
  near(f.intercept[0], 1, 4 * f.intercept[1]);
  near(f.scatter[0], 1 / Math.sqrt(12), 0.05); // sd of a unit-width uniform
  assert.equal(linfit([1, 1, 1], [1, 2, 3]), null);
});

test('the real exoplanet data follow Kepler: log a against log P has slope 2/3', () => {
  const d = JSON.parse(readFileSync(new URL('../data/exoplanets.json', import.meta.url), 'utf8'));
  const P = d.cols.indexOf('pl_orbper'), a = d.cols.indexOf('pl_orbsmax');
  const rows = d.rows.filter((r) => r[P] > 0 && r[a] > 0);
  near(linfit(rows.map((r) => Math.log10(r[P])), rows.map((r) => Math.log10(r[a]))).slope[0], 2 / 3, 0.01);
});

test('period tracker measures a one-year orbit for Earth', () => {
  const b = [{ m: 1, x: 0, y: 0, vx: 0, vy: 0 }, { m: 3e-6, x: 1, y: 0, vx: 0, vy: Math.sqrt(G) }], laps = revolutions();
  laps.push(0, 0);
  for (let i = 1; i <= 3500; i++) { step(b, 0.001); laps.push(i * 0.001, Math.atan2(b[1].y - b[0].y, b[1].x - b[0].x)); }
  const [mean, se, n] = laps.period();
  assert.equal(n, 3);
  near(mean, 1, 1e-4);
  assert.ok(se < 1e-5);
});
