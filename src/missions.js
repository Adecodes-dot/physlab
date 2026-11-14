// Guided investigations at three levels. Each check reads the lab's current measurement (results) and
// settings (method), so a mission is passed by doing the experiment, not by answering a quiz.
import { barrierT } from './physics/quantum.js';

const KEY = 'physlab.missions';
const val = (r, k) => r?.[k]?.[0] ?? NaN;
const err = (r, k) => r?.[k]?.[1] ?? NaN;

export const MISSIONS = {
  collider: [
    { id: 'collider-jpsi', level: 'Explore', title: 'Find the J/ψ', brief: 'Drag across the tall narrow peak near 3 GeV until the lab reports a fitted position.', check: (r) => Math.abs(val(r, 'Peak position') - 3.097) < 0.05 },
    { id: 'collider-z', level: 'Investigate', title: 'Weigh the Z boson to 1 %', brief: 'Open the Z boson window and get the fitted position within 1 % of 91.19 GeV. Compare the two peak shapes: which gives the better χ² / ndf?', check: (r) => Math.abs(val(r, 'Peak position') / 91.1876 - 1) < 0.01 },
    { id: 'collider-upsilon2s', level: 'Research', title: 'Resolve the Υ(2S)', brief: 'The Υ family is three overlapping peaks. Isolate the middle one near 10.02 GeV with a signal at least five times its own uncertainty.', check: (r) => Math.abs(val(r, 'Peak position') - 10.023) < 0.06 && val(r, 'Signal events') > 5 * err(r, 'Signal events') },
  ],
  exoplanets: [
    { id: 'exo-radius', level: 'Explore', title: 'Map planet sizes', brief: 'Plot radius against orbital period. Where do Earth and Jupiter sit among the planets we have found?', check: (r, m) => m.x === 'Orbital period (days)' && m.y === 'Radius (Earth = 1)' },
    { id: 'exo-kepler', level: 'Investigate', title: 'Test Kepler’s third law', brief: 'Plot semi-major axis against orbital period and read the fitted slope. Kepler predicts exactly 2/3. Get within 0.02.', check: (r, m) => m.x === 'Orbital period (days)' && m.y === 'Semi-major axis (AU)' && Math.abs(val(r, 'Fitted slope') - 2 / 3) < 0.02 },
    { id: 'exo-bias', level: 'Research', title: 'Catch a selection effect', brief: 'Keep the Kepler plot but include only radial-velocity planets. The slope moves away from 2/3 by more than its error bar. Work out why before you record it.', check: (r, m) => m.who === 'Radial velocity' && m.y === 'Semi-major axis (AU)' && m.x === 'Orbital period (days)' && Math.abs(val(r, 'Fitted slope') - 2 / 3) > 3 * err(r, 'Fitted slope') },
  ],
  orbits: [
    { id: 'orbits-year', level: 'Explore', title: 'Time one Earth year', brief: 'Run the inner solar system until Earth completes an orbit. The measured period should be within 1 % of one year.', check: (r) => Math.abs(val(r, 'Period of Earth') - 1) < 0.01 },
    { id: 'orbits-mars', level: 'Investigate', title: 'Predict the Mars year', brief: 'Mars orbits at 1.524 AU. Kepler’s third law says T² = a³. Work out T, then let the simulation measure it to within 0.5 %.', check: (r) => Math.abs(val(r, 'Period of Mars') / 1.524 ** 1.5 - 1) < 0.005 },
    { id: 'orbits-euler', level: 'Research', title: 'Break the simulation honestly', brief: 'Switch to the Euler integrator and find settings where the energy drifts by more than 5 %. Nothing in the code is wrong: the method is.', check: (r, m) => m.method === 'Euler' && Math.abs(val(r, 'Energy drift')) > 5 },
  ],
  quantum: [
    { id: 'quantum-tunnel', level: 'Explore', title: 'See tunnelling', brief: 'Give the packet less energy than the barrier height and wait for the measurement. More than 1 % should still get through.', check: (r, m) => m.shape === 'Barrier' && m.E < m.V0 && val(r, 'Transmitted share') > 1 },
    { id: 'quantum-dial', level: 'Investigate', title: 'Dial in 15 %', brief: 'Keep the energy below the barrier and tune height and width until between 13 % and 17 % of the packet is transmitted.', check: (r, m) => m.shape === 'Barrier' && m.E < m.V0 && val(r, 'Transmitted share') >= 13 && val(r, 'Transmitted share') <= 17 },
    { id: 'quantum-spread', level: 'Research', title: 'Where the textbook formula fails', brief: 'Find a barrier where the packet’s transmitted share differs from the single-energy theory by more than 10 percentage points, and explain it from the packet’s spread of energies.', check: (r, m) => m.shape === 'Barrier' && Math.abs(val(r, 'Transmitted share') - 100 * barrierT(m.E, m.V0, m.a)) > 10 },
  ],
  neuron: [
    { id: 'neuron-fire', level: 'Explore', title: 'Make it fire', brief: 'Inject enough current for at least one spike.', check: (r) => val(r, 'Spike count') >= 1 },
    { id: 'neuron-threshold', level: 'Investigate', title: 'Find the threshold for sustained firing', brief: 'One spike is easy. With no channels blocked, find a current of 6.5 µA/cm² or less that makes the cell fire at least three times.', check: (r, m) => m.I <= 6.5 && m.na === 0 && m.k === 0 && val(r, 'Spike count') >= 3 },
    { id: 'neuron-potassium', level: 'Research', title: 'The potassium surprise', brief: 'Without changing the current above 10 µA/cm², get eight or more spikes. Predict first whether blocking potassium channels should speed the cell up or slow it down.', check: (r, m) => m.I <= 10 && val(r, 'Spike count') >= 8 },
  ],
};

export const total = Object.values(MISSIONS).reduce((n, list) => n + list.length, 0);
export const done = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { return {}; } };
export function complete(id) {
  const d = done();
  d[id] ??= Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* progress is a convenience; carry on without it */ }
}
