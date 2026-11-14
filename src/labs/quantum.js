import { controls, tiles, canvas, frame, line, ink, button, note } from '../kit.js';
import { makeState, gaussian, step, prob, barrierT } from '../physics/quantum.js';
import { notebook } from '../notebook.js';

const LENGTH = 120, N = 1201, DT = 0.05, X0 = 35, SIGMA = 5, WALL = 60, STEPS_PER_FRAME = 6;
const pc = (x) => `${x.toFixed(1)} %`;

export default {
  id: 'quantum',
  field: 'Quantum physics',
  title: 'Wave packet and barrier',
  blurb: 'A particle described by a wave packet meets a potential. Classically it either clears the barrier or bounces; here the wave splits, and part of it appears on the far side even when its energy is below the barrier. Once the packet has finished scattering the run pauses and the transmitted and reflected shares are measured. Try energy below the barrier height, then thin the barrier.',

  mount(root) {
    const v = controls(root, {
      shape: { label: 'Potential', options: ['Barrier', 'Step', 'Harmonic well', 'None (free particle)'], value: 'Barrier' },
      E: { label: 'Packet energy', min: 0.1, max: 3, step: 0.05, value: 0.8 },
      V0: { label: 'Barrier height', min: 0, max: 3, step: 0.05, value: 1 },
      a: { label: 'Barrier width', min: 0.2, max: 6, step: 0.2, value: 1.6 },
    }, reset);
    const bar = root.lastChild;
    let running = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    const toggle = button(bar, '', () => run(!running));
    const run = (on) => { running = on; toggle.textContent = on ? 'Pause' : 'Run'; };
    run(running);
    button(bar, 'Restart', reset);
    const cvV = canvas(root, 150, 'Potential energy against position, with the packet energy marked');
    root.insertAdjacentHTML('beforeend', '<div class="legend"><span>Height: how likely the particle is to be found there. Colour: the phase of ψ, −π <i class="phase"></i> +π. Bands packed closer together mean higher momentum; where incoming and reflected waves overlap, the height ripples.</span></div>');
    const cvP = canvas(root, 320, 'Probability density of the particle against position, coloured by the phase of the wave function, animated');
    const set = tiles(root);
    note(root, 'A simulation has no statistical noise, so the measured shares carry no ± of their own; your prediction’s tolerance alone decides the verdict. Theory T is for a single exact energy, while a packet is a spread of energies, so the two differ a little.');

    const s = makeState(N, LENGTH), xs = Float64Array.from({ length: N }, (_, j) => j * s.dx), density = new Float64Array(N);
    let t, raf, final = null, hold = false;
    const scatters = () => v.shape === 'Barrier' || v.shape === 'Step';
    const near = Math.round(WALL / s.dx), far = () => Math.round((WALL + (v.shape === 'Barrier' ? v.a : 0)) / s.dx);
    // by then the reflected part is back at the start and the transmitted part is as far beyond the barrier
    const tMeasure = () => 2 * (WALL - X0) / Math.sqrt(2 * v.E);

    function reset() {
      const end = WALL + v.a;
      for (let j = 0; j < N; j++) {
        const x = xs[j];
        s.V[j] = v.shape === 'Barrier' ? (x >= WALL && x < end ? v.V0 : 0)
          : v.shape === 'Step' ? (x >= WALL ? v.V0 : 0)
          : v.shape === 'Harmonic well' ? 0.5 * 0.05 ** 2 * (x - WALL) ** 2 : 0;
      }
      gaussian(s, X0, SIGMA, Math.sqrt(2 * v.E));
      t = 0; final = null;
    }
    reset();

    const book = notebook(root, {
      lab: 'quantum',
      example: 'What share of the packet tunnels through when its energy is 80 % of the barrier height?',
      pending: 'The measurement is taken once the packet has finished scattering (barrier or step only).',
      quantities: { 'Transmitted share': '%', 'Reflected share': '%' },
      results: () => (final ? { 'Transmitted share': [final.T, 0, '%'], 'Reflected share': [final.R, 0, '%'] } : null),
      method: () => ({ ...v }),
      restore: (m) => v.set(m),
      // while predicting, the packet waits at the start so the outcome cannot be watched in advance
      blind: (on) => { hold = on; reset(); if (!on) run(true); },
    });
    note(root, 'Natural units (ħ = m = 1). The box has hard walls, so if you run on after the measurement the packet reflects off the ends.');

    function tick() {
      if (running && !hold) {
        for (let i = 0; i < STEPS_PER_FRAME; i++) step(s, DT);
        t += STEPS_PER_FRAME * DT;
        if (scatters() && !final && t >= tMeasure()) { final = { T: prob(s, far()) * 100, R: prob(s, 0, near) * 100, t }; run(false); }
      }
      for (let j = 0; j < N; j++) density[j] = s.re[j] ** 2 + s.im[j] ** 2;

      const e = frame(cvV, { x: [0, LENGTH], y: [0, 3.2], ylabel: 'Energy' });
      e.ctx.save(); e.clip();
      e.ctx.fillStyle = ink('--axis'); e.ctx.beginPath(); e.ctx.moveTo(e.sx(0), e.sy(0));
      for (let j = 0; j < N; j++) e.ctx.lineTo(e.sx(xs[j]), e.sy(s.V[j]));
      e.ctx.lineTo(e.sx(LENGTH), e.sy(0)); e.ctx.fill();
      e.ctx.setLineDash([5, 4]); e.ctx.strokeStyle = ink('--s2'); e.ctx.lineWidth = 2;
      e.ctx.beginPath(); e.ctx.moveTo(e.left, e.sy(v.E)); e.ctx.lineTo(e.right, e.sy(v.E)); e.ctx.stroke();
      e.ctx.restore();
      e.ctx.fillStyle = ink('--text2'); e.ctx.textAlign = 'left'; e.ctx.textBaseline = 'bottom';
      e.ctx.fillText('packet energy', e.left + 6, e.sy(v.E) - 3);
      e.ctx.fillText('potential V(x)', e.sx(WALL) + 8, Math.max(e.top + 14, e.sy(Math.min(3.2, s.V[Math.round((WALL + 0.1) / s.dx)])) - 3));

      const p = frame(cvP, { x: [0, LENGTH], y: [0, 0.26], xlabel: 'Position', ylabel: 'Probability density |ψ|²' });
      p.ctx.save(); p.clip();
      // fill coloured by the phase of ψ: hue runs once round the colour wheel as the phase goes from −π to +π
      for (let px = Math.ceil(p.left); px < p.right; px += 2) {
        const j = Math.round(p.ix(px) / s.dx);
        p.ctx.fillStyle = `hsl(${(Math.atan2(s.im[j], s.re[j]) / Math.PI + 1) * 180} 75% 55%)`;
        p.ctx.fillRect(px, p.sy(density[j]), 2, p.bottom - p.sy(density[j]));
      }
      line(p, xs, density, '--text');
      p.ctx.restore();

      set(hold ? { Status: 'Waiting at the start. Results stay hidden until you lock a prediction.' } : {
        Time: t.toFixed(1),
        'Total probability': prob(s).toFixed(6),
        ...(scatters() && (final
          ? { [`Transmitted, measured at t = ${final.t.toFixed(0)}`]: pc(final.T), 'Reflected': pc(final.R) }
          : { 'Past barrier so far': pc(prob(s, far()) * 100), 'Left of barrier so far': pc(prob(s, 0, near) * 100), 'Measurement at': `t = ${tMeasure().toFixed(0)}` })),
        ...(v.shape === 'Barrier' && { 'Theory T (single energy)': pc(barrierT(v.E, v.V0, v.a) * 100) }),
      });
      book.refresh();
      raf = requestAnimationFrame(tick);
    }

    tick();
    return { stop: () => cancelAnimationFrame(raf) };
  },
};
