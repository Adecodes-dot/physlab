import { controls, tiles, canvas, frame, line, hover, ink, legend, note } from '../kit.js';
import { simulate } from '../physics/neuron.js';

const T0 = 10, GATES = [['m — Na⁺ gate opening', '--s1', 'm'], ['h — Na⁺ gate not yet inactivated', '--s2', 'h'], ['n — K⁺ gate opening', '--s3', 'n']];

export default {
  id: 'neuron',
  field: 'Biophysics',
  title: 'Nerve impulse',
  blurb: 'The Hodgkin–Huxley model of a squid nerve fibre: sodium and potassium channels opening and closing turn a steady current into sharp voltage spikes. Raise the current from zero to find the threshold where the cell starts firing, then block the sodium channels and watch the spikes vanish — which is how local anaesthetics and pufferfish toxin work.',

  mount(root) {
    const v = controls(root, {
      I: { label: 'Injected current', min: 0, max: 20, step: 0.5, value: 10, unit: 'µA/cm²' },
      dur: { label: 'Stimulus length', min: 1, max: 90, value: 80, unit: 'ms' },
      na: { label: 'Na⁺ channels blocked', min: 0, max: 100, step: 5, value: 0, unit: '%' },
      k: { label: 'K⁺ channels blocked', min: 0, max: 100, step: 5, value: 0, unit: '%' },
    }, run);
    const cvV = canvas(root, 300, 'Membrane voltage against time');
    legend(root, GATES);
    const cvG = canvas(root, 210, 'Channel gate variables m, h and n against time');
    const set = tiles(root);
    note(root, 'Model and parameters: Hodgkin & Huxley, J. Physiol. 117 (1952), squid giant axon at 6.3 °C, integrated with 4th-order Runge–Kutta. This lab is a simulation only — no measured dataset behind it yet.');

    let s, pv, cross = -1;
    function run() {
      s = simulate({ I: v.I, t0: T0, dur: v.dur, gNa: 120 * (1 - v.na / 100), gK: 36 * (1 - v.k / 100) });
      const k = s.spikes, gaps = k.slice(1).map((t, i) => t - k[i]);
      set({
        Spikes: k.length,
        'Firing rate': gaps.length ? `${(1000 * gaps.length / gaps.reduce((a, b) => a + b)).toFixed(0)} Hz` : '—',
        'Peak voltage': `${Math.max(...s.V).toFixed(1)} mV`,
        'Resting voltage': `${s.V[0].toFixed(1)} mV`,
      });
      draw();
    }

    function draw() {
      const p = pv = frame(cvV, { x: [0, 100], y: [-90, 60], xlabel: 'Time (ms)', ylabel: 'Membrane voltage (mV)' });
      // stimulus window along the baseline
      p.ctx.fillStyle = ink('--muted'); p.ctx.fillRect(p.sx(T0), p.bottom - 5, p.sx(T0 + v.dur) - p.sx(T0), 5);
      p.ctx.textAlign = 'left'; p.ctx.textBaseline = 'bottom'; p.ctx.fillText('current on', p.sx(T0), p.bottom - 8);
      line(p, s.t, s.V, '--s1');
      const g = frame(cvG, { x: [0, 100], y: [0, 1], xlabel: 'Time (ms)', ylabel: 'Fraction open' });
      for (const [, colour, key] of GATES) line(g, s.t, s[key], colour);
      if (cross >= 0) for (const q of [p, g]) {
        q.ctx.strokeStyle = ink('--muted'); q.ctx.lineWidth = 1; q.ctx.beginPath(); q.ctx.moveTo(q.sx(s.t[cross]), q.top); q.ctx.lineTo(q.sx(s.t[cross]), q.bottom); q.ctx.stroke();
      }
    }

    const probe = (cv) => hover(cv, (x) => {
      const i = Math.round(pv.ix(x) / 100 * (s.t.length - 1));
      cross = x >= 0 && i >= 0 && i < s.t.length ? i : -1;
      draw();
      return cross >= 0 && `<b>${s.t[i].toFixed(1)} ms</b><br>V = ${s.V[i].toFixed(1)} mV<br>m ${s.m[i].toFixed(2)} · h ${s.h[i].toFixed(2)} · n ${s.n[i].toFixed(2)}`;
    });
    probe(cvV); probe(cvG);

    run();
    return { draw };
  },
};
