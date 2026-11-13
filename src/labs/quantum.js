import { controls, tiles, canvas, frame, line, ink, button, note } from '../kit.js';
import { makeState, gaussian, step, prob, barrierT } from '../physics/quantum.js';

const LENGTH = 120, N = 1201, DT = 0.05, X0 = 35, SIGMA = 5, WALL = 60, STEPS_PER_FRAME = 6;

export default {
  id: 'quantum',
  field: 'Quantum physics',
  title: 'Wave packet and barrier',
  blurb: 'A particle described by a wave packet meets a potential. Classically it either clears the barrier or bounces; here the wave splits, and part of it appears on the far side even when its energy is below the barrier. Try energy below the barrier height, then thin the barrier and watch the transmitted share grow.',

  mount(root) {
    const v = controls(root, {
      shape: { label: 'Potential', options: ['Barrier', 'Step', 'Harmonic well', 'None (free particle)'], value: 'Barrier' },
      E: { label: 'Packet energy', min: 0.1, max: 3, step: 0.05, value: 0.8 },
      V0: { label: 'Barrier height', min: 0, max: 3, step: 0.05, value: 1 },
      a: { label: 'Barrier width', min: 0.2, max: 6, step: 0.2, value: 1.6 },
    }, reset);
    const bar = root.lastChild;
    let running = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    const toggle = button(bar, running ? 'Pause' : 'Run', () => { running = !running; toggle.textContent = running ? 'Pause' : 'Run'; });
    button(bar, 'Restart', reset);
    const cvV = canvas(root, 150, 'Potential energy against position, with the packet energy marked');
    const cvP = canvas(root, 320, 'Probability density of the particle against position, animated');
    const set = tiles(root);
    note(root, 'Natural units (ħ = m = 1). The box has hard walls, so the packet eventually reflects off the ends. Theory T is for a single exact energy; a packet is a spread of energies, so its transmitted share differs a little.');

    const s = makeState(N, LENGTH), xs = Float64Array.from({ length: N }, (_, j) => j * s.dx), density = new Float64Array(N);
    let t, raf;

    function reset() {
      const end = WALL + v.a;
      for (let j = 0; j < N; j++) {
        const x = xs[j];
        s.V[j] = v.shape === 'Barrier' ? (x >= WALL && x < end ? v.V0 : 0)
          : v.shape === 'Step' ? (x >= WALL ? v.V0 : 0)
          : v.shape === 'Harmonic well' ? 0.5 * 0.05 ** 2 * (x - WALL) ** 2 : 0;
      }
      gaussian(s, X0, SIGMA, Math.sqrt(2 * v.E));
      t = 0;
    }

    function tick() {
      if (running) { for (let i = 0; i < STEPS_PER_FRAME; i++) step(s, DT); t += STEPS_PER_FRAME * DT; }
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
      line(p, xs, density, '--s1');
      p.ctx.lineTo(p.sx(LENGTH), p.sy(0)); p.ctx.lineTo(p.sx(0), p.sy(0));
      p.ctx.globalAlpha = 0.18; p.ctx.fillStyle = ink('--s1'); p.ctx.fill();
      p.ctx.restore();

      const barrier = v.shape === 'Barrier', edge = Math.round(WALL / s.dx), far = Math.round((WALL + (barrier ? v.a : 0)) / s.dx);
      set({
        Time: t.toFixed(1),
        'Total probability': prob(s).toFixed(6),
        ...(barrier || v.shape === 'Step' ? { 'Left of barrier': `${(prob(s, 0, edge) * 100).toFixed(1)} %`, 'Past barrier': `${(prob(s, far) * 100).toFixed(1)} %` } : {}),
        ...(barrier ? { 'Theory T (single energy)': `${(barrierT(v.E, v.V0, v.a) * 100).toFixed(1)} %` } : {}),
      });
      raf = requestAnimationFrame(tick);
    }

    reset();
    tick();
    return { stop: () => cancelAnimationFrame(raf) };
  },
};
