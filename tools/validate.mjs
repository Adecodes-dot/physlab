// Physics regression suite. Measures known quantities with the same code the labs run, compares each with an
// independent reference, and writes data/validation.json (shown on the Validation page). Exits 1 on any failure.
import { readFileSync, writeFileSync } from 'node:fs';
import { pairMass, histogram } from '../src/physics/kinematics.js';
import { fitPeak, linfit } from '../src/physics/fit.js';
import { G, step, energy, revolutions } from '../src/physics/nbody.js';
import * as q from '../src/physics/quantum.js';
import { simulate } from '../src/physics/neuron.js';

const file = (name) => new URL(`../data/${name}`, import.meta.url);
const rows = [];
// tolerance is absolute, in the benchmark's unit
const bench = (lab, name, measured, reference, tolerance, unit, basis) =>
  rows.push({ lab, name, measured, reference, tolerance, unit, basis, pass: Math.abs(measured - reference) <= tolerance });

// --- particle physics: real CMS data ---
const meta = JSON.parse(readFileSync(file('dimuon.meta.json'), 'utf8'));
bench('collider', 'Largest mass difference from CMS, all events', meta.maxMassDifferenceGeV, 0, 0.005, 'GeV', `Our invariant mass against the mass column CMS published, ${meta.events.toLocaleString('en')} events`);
const ev = readFileSync(file('dimuon.csv'), 'utf8').split('\n').slice(1).map((r) => r.split(',').map(Number)).filter((r) => r.length === 8 && r[3] * r[7] === -1);
const masses = ev.map((r) => pairMass(r[0], r[1], r[2], r[4], r[5], r[6]));
const peak = (lo, hi, shape) => { const bins = 60, h = histogram(masses, lo, hi, bins); return fitPeak(Array.from(h, (_, i) => lo + (i + 0.5) * (hi - lo) / bins), h, shape); };
for (const [name, lo, hi, shape, ref] of [['J/ψ mass', 2.95, 3.25, 'gauss', 3.0969], ['ψ(2S) mass', 3.55, 3.85, 'gauss', 3.6861], ['Υ(1S) mass', 9.2, 9.7, 'gauss', 9.4603], ['Z mass', 80, 100, 'bw', 91.1876]]) {
  bench('collider', name, peak(lo, hi, shape).position[0], ref, ref * 0.005, 'GeV', 'Fitted peak against the Particle Data Group value, within 0.5 %');
}

// --- statistics: are the fit's error bars honest? ---
{
  let seed = 1;
  const rand = () => (seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32;
  const gauss = () => Math.sqrt(-2 * Math.log(rand() || 1e-12)) * Math.cos(2 * Math.PI * rand());
  const x = Array.from({ length: 60 }, (_, i) => 9 + (i + 0.5) / 60), truth = (xi) => 600 * Math.exp(-((xi - 9.46) ** 2) / (2 * 0.09 ** 2)) + 250 - 40 * (xi - 9.5);
  const pulls = [];
  for (let k = 0; k < 400; k++) { const f = fitPeak(x, x.map((xi) => Math.round(truth(xi) + Math.sqrt(truth(xi)) * gauss())), 'gauss'); if (f?.ok) pulls.push((f.position[0] - 9.46) / f.position[1]); }
  const mean = pulls.reduce((a, b) => a + b, 0) / pulls.length;
  bench('statistics', 'Spread of fit pulls (1 = error bars are the right size)', Math.sqrt(pulls.reduce((a, b) => a + (b - mean) ** 2, 0) / (pulls.length - 1)), 1, 0.15, '', `${pulls.length} simulated experiments with a known answer`);
  bench('statistics', 'Mean of fit pulls (0 = no bias)', mean, 0, 0.15, '', `${pulls.length} simulated experiments with a known answer`);
}

// --- astrophysics: real NASA data ---
{
  const d = JSON.parse(readFileSync(file('exoplanets.json'), 'utf8')), c = (k) => d.cols.indexOf(k), P = c('pl_orbper'), a = c('pl_orbsmax'), M = c('st_mass');
  const both = d.rows.filter((r) => r[P] > 0 && r[a] > 0);
  bench('exoplanets', 'Kepler exponent from the planet census', linfit(both.map((r) => Math.log10(r[P])), both.map((r) => Math.log10(r[a]))).slope[0], 2 / 3, 0.015, '', `Slope of log a against log P for ${both.length.toLocaleString('en')} planets; Kepler’s third law gives 2/3`);
  const ratio = both.filter((r) => r[M] > 0).map((r) => r[a] ** 3 / (r[P] / 365.25) ** 2 / r[M]).sort((x, y) => x - y);
  bench('exoplanets', 'Median a³ / (P²·M★)', ratio[ratio.length >> 1], 1, 0.01, '', 'Kepler’s third law in AU, years and solar masses');
}

// --- gravity simulation ---
{
  const mass = 3e-6, exact = 1 / Math.sqrt(1 + mass); // two-body period for a = 1 AU, in years
  const orbit = (dt) => {
    const b = [{ m: 1, x: 0, y: 0, vx: 0, vy: 0 }, { m: mass, x: 1, y: 0, vx: 0, vy: Math.sqrt(G * (1 + mass)) }], laps = revolutions(), e0 = energy(b);
    laps.push(0, 0);
    for (let i = 1; i <= Math.round(10.5 / dt); i++) { step(b, dt); laps.push(i * dt, Math.atan2(b[1].y - b[0].y, b[1].x - b[0].x)); }
    return { error: laps.period()[0] - exact, period: laps.period()[0], drift: (energy(b) - e0) / Math.abs(e0) };
  };
  const coarse = orbit(0.002), fine = orbit(0.001);
  bench('orbits', 'Period of a 1 AU circular orbit', fine.period, exact, 2e-5, 'yr', 'Leapfrog at a 0.001 yr step against the exact two-body solution; a second-order method should err by about (ω·dt)²/3 = 1.3e-5');
  bench('orbits', 'Convergence order of the integrator', Math.log2(coarse.error / fine.error), 2, 0.05, '', 'Halving the time step should cut the error by four');
  bench('orbits', 'Relative energy change over 10 orbits', fine.drift, 0, 1e-8, '', 'Energy is conserved exactly by the true motion');
}

// --- quantum simulation ---
{
  const s = q.makeState(1201, 120), E = 0.8, V0 = 1, width = 1.6;
  for (let j = 0; j < s.n; j++) if (j * s.dx >= 60 && j * s.dx < 60 + width) s.V[j] = V0;
  q.gaussian(s, 35, 5, Math.sqrt(2 * E));
  for (let i = 0; i < 792; i++) q.step(s, 0.05);
  bench('quantum', 'Total probability after scattering', q.prob(s), 1, 1e-9, '', 'The Schrödinger equation conserves probability exactly');
  bench('quantum', 'Tunnelling probability', q.prob(s, Math.round((60 + width) / s.dx)), q.barrierT(E, V0, width), 0.02, '', 'Wave packet against the textbook formula for one exact energy; the packet’s energy spread accounts for the gap');
  const free = q.makeState(1201, 120);
  q.gaussian(free, 30, 5, 1.2);
  for (let i = 0; i < 400; i++) q.step(free, 0.05);
  let x = 0;
  for (let j = 0; j < free.n; j++) x += j * free.dx * (free.re[j] ** 2 + free.im[j] ** 2) * free.dx;
  bench('quantum', 'Speed of a free wave packet', (x - 30) / 20, 1.2, 0.012, '', 'Group velocity equals the mean momentum k₀ (ħ = m = 1)');
}

// --- neuron simulation ---
{
  const rate = (dt) => { const k = simulate({ I: 10, dt }).spikes; return 1000 * (k.length - 1) / (k.at(-1) - k[0]); };
  bench('neuron', 'Firing rate at 10 µA/cm²', rate(0.01), rate(0.0025), 0.2, 'Hz', 'Our time step against one four times finer: the answer should not depend on the step');
  bench('neuron', 'Resting voltage with no input', simulate({ I: 0 }).V.at(-1), -65, 0.1, 'mV', 'The Hodgkin–Huxley resting potential');
}

const passed = rows.filter((r) => r.pass).length;
writeFileSync(file('validation.json'), JSON.stringify({ generated: new Date().toISOString().slice(0, 10), passed, total: rows.length, rows }, null, 1));
for (const r of rows) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.lab.padEnd(11)} ${r.name.padEnd(52)} ${String(+r.measured.toPrecision(7)).padStart(12)}  ref ${+r.reference.toPrecision(7)}  ±${+r.tolerance.toPrecision(3)} ${r.unit}`);
console.log(`\n${passed} of ${rows.length} benchmarks pass`);
process.exit(passed === rows.length ? 0 : 1);
