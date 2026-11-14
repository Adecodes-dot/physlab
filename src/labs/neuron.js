import { controls, tiles, canvas, frame, line, hover, ink, legend, note, pm } from '../kit.js';
import { simulate } from '../physics/neuron.js';
import { notebook } from '../notebook.js';

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
    note(root, 'Firing rate is 1000 divided by the mean gap between spikes in milliseconds; its ± comes from how much those gaps vary, so it is zero for perfectly regular firing and absent with fewer than three spikes.');

    let s, pv, kpi, cross = -1, blind = false;
    const book = notebook(root, {
      lab: 'neuron',
      example: 'How fast does the cell fire at 10 µA/cm² with a quarter of its sodium channels blocked?',
      pending: 'No measurement available.',
      quantities: { 'Firing rate': 'Hz', 'Spike count': 'spikes', 'Peak voltage': 'mV' },
      results: () => kpi,
      method: () => ({ ...v }),
      restore: (m) => v.set(m),
      blind: (on) => { blind = on; report(); draw(); },
    });
    note(root, 'Model and parameters: Hodgkin & Huxley, J. Physiol. 117 (1952), squid giant axon at 6.3 °C, integrated with 4th-order Runge–Kutta. This lab is a simulation only — no measured dataset behind it yet.');

    function run() {
      s = simulate({ I: v.I, t0: T0, dur: v.dur, gNa: 120 * (1 - v.na / 100), gK: 36 * (1 - v.k / 100) });
      const gaps = s.spikes.slice(1).map((t, i) => t - s.spikes[i]), n = gaps.length, mean = n ? gaps.reduce((a, b) => a + b) / n : 0;
      const rate = n ? 1000 / mean : 0, sd = n > 1 ? Math.sqrt(gaps.reduce((a, g) => a + (g - mean) ** 2, 0) / (n - 1)) : 0;
      kpi = { 'Firing rate': [rate, n > 1 ? rate * sd / Math.sqrt(n) / mean : 0, 'Hz'], 'Spike count': [s.spikes.length, 0, 'spikes'], 'Peak voltage': [Math.max(...s.V), 0, 'mV'] };
      report(); draw(); book.refresh();
    }

    function report() {
      set(blind ? { Results: 'hidden until you lock a prediction' } : {
        Spikes: s.spikes.length,
        'Firing rate': s.spikes.length > 1 ? `${pm(...kpi['Firing rate'])} Hz` : '—',
        'Peak voltage': `${kpi['Peak voltage'][0].toFixed(1)} mV`,
        'Resting voltage': `${s.V[0].toFixed(1)} mV`,
      });
    }

    function draw() {
      const p = pv = frame(cvV, { x: [0, 100], y: [-90, 60], xlabel: 'Time (ms)', ylabel: 'Membrane voltage (mV)' });
      // stimulus window along the baseline
      p.ctx.fillStyle = ink('--muted'); p.ctx.fillRect(p.sx(T0), p.bottom - 5, p.sx(T0 + v.dur) - p.sx(T0), 5);
      p.ctx.textAlign = 'left'; p.ctx.textBaseline = 'bottom'; p.ctx.fillText('current on', p.sx(T0), p.bottom - 8);
      const g = frame(cvG, { x: [0, 100], y: [0, 1], xlabel: 'Time (ms)', ylabel: 'Fraction open' });
      if (blind) {
        for (const q of [p, g]) { q.ctx.fillStyle = ink('--text2'); q.ctx.textAlign = 'center'; q.ctx.textBaseline = 'middle'; q.ctx.fillText('Trace hidden until you lock a prediction', (q.left + q.right) / 2, (q.top + q.bottom) / 2); }
        return;
      }
      line(p, s.t, s.V, '--s1');
      for (const [, colour, key] of GATES) line(g, s.t, s[key], colour);
      if (cross >= 0) for (const q of [p, g]) {
        q.ctx.strokeStyle = ink('--muted'); q.ctx.lineWidth = 1; q.ctx.beginPath(); q.ctx.moveTo(q.sx(s.t[cross]), q.top); q.ctx.lineTo(q.sx(s.t[cross]), q.bottom); q.ctx.stroke();
      }
    }

    const probe = (cv) => hover(cv, (x) => {
      const i = Math.round(pv.ix(x) / 100 * (s.t.length - 1));
      cross = !blind && x >= 0 && i >= 0 && i < s.t.length ? i : -1;
      draw();
      return cross >= 0 && `<b>${s.t[i].toFixed(1)} ms</b><br>V = ${s.V[i].toFixed(1)} mV<br>m ${s.m[i].toFixed(2)} · h ${s.h[i].toFixed(2)} · n ${s.n[i].toFixed(2)}`;
    });
    probe(cvV); probe(cvG);

    run();
    return { draw };
  },
};
