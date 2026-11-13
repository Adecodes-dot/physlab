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
