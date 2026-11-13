import { controls, tiles, canvas, frame, ctx2d, hover, ink, button, note } from '../kit.js';
import { invariantMass, histogram } from '../physics/kinematics.js';

// [low, high, log axes] in GeV
const VIEWS = { 'Full spectrum (log–log)': [2, 110, true], 'J/ψ and ψ(2S)': [2.6, 4.1], 'Υ family': [8.5, 11.5], 'Z boson': [70, 110] };
// Particle Data Group masses, GeV. Third field: hide in the crowded full view.
const PDG = [['J/ψ', 3.0969], ['ψ(2S)', 3.6861], ['Υ(1S)', 9.4603], ['Υ(2S)', 10.0233, 1], ['Υ(3S)', 10.3552, 1], ['Z', 91.1876]];
const B_FIELD = 3.8, R_TRACKER = 1.2, R_SOLENOID = 3; // tesla, metres

export default {
  id: 'collider',
  field: 'Particle physics',
  title: 'Dimuon mass spectrum',
  blurb: '100,000 real proton–proton collisions recorded by the CMS detector at the LHC in 2011, each with two muons. Combine each pair’s energy and momentum into one invariant mass and the short-lived parent particles show up as peaks. Try the Υ family view and raise the bin count until three separate peaks resolve.',

  async mount(root) {
    const res = await fetch('data/dimuon.csv');
    if (!res.ok) throw new Error('Could not load data/dimuon.csv — run `npm run data` to download it.');
    // columns: pt1, eta1, phi1, Q1, pt2, eta2, phi2, Q2
    const ev = (await res.text()).split('\n').slice(1).map((r) => r.split(',').map(Number)).filter((r) => r.length === 8);
    const mass = ev.map((r) => invariantMass(r[0], r[1], r[2], r[4], r[5], r[6]));

    const v = controls(root, {
      view: { label: 'Mass window', options: Object.keys(VIEWS), value: 'Full spectrum (log–log)' },
      charge: { label: 'Muon charges', options: ['Opposite charge', 'Same charge', 'Any'], value: 'Opposite charge' },
      bins: { label: 'Bins', min: 20, max: 300, step: 10, value: 150 },
      minPt: { label: 'Min. muon pT', min: 0, max: 30, step: 1, value: 0, unit: 'GeV' },
    }, update);
    const cv = canvas(root, 400, 'Histogram of dimuon invariant mass with known particle masses marked');
    const set = tiles(root);
    const row = Object.assign(document.createElement('div'), { className: 'split' });
    const evCv = canvas(row, 340, 'One collision seen along the beam line: two muon tracks curving in the magnetic field');
    const info = document.createElement('div');
    row.append(info);
    root.append(row);
    note(root, 'Data: CMS collaboration, <a href="https://opendata.cern.ch/record/545">CERN Open Data record 545</a> (CC0), an education subset of Run2011A — fine for learning, not for a physics result. Reference masses: Particle Data Group.');

    let sel = [], shown = -1, hist, plot;
    const [lo, hi, log] = [0, 1, 2].map((i) => () => VIEWS[v.view][i]);
    const edge = (i) => (log() ? lo() * (hi() / lo()) ** (i / v.bins) : lo() + (hi() - lo()) * i / v.bins);

    function update() {
      const want = { 'Opposite charge': -1, 'Same charge': 1 }[v.charge];
      sel = [];
      ev.forEach((r, i) => {
        if (mass[i] >= lo() && mass[i] < hi() && Math.min(r[0], r[4]) >= v.minPt && (!want || r[3] * r[7] === want)) sel.push(i);
      });
      hist = histogram(sel.map((i) => mass[i]), lo(), hi(), v.bins, log());
      const peak = hist.indexOf(Math.max(...hist)), at = (edge(peak) + edge(peak + 1)) / 2;
      const ref = PDG.reduce((a, b) => (Math.abs(Math.log(b[1] / at)) < Math.abs(Math.log(a[1] / at)) ? b : a));
      set(sel.length ? {
        'Events in view': sel.length.toLocaleString(),
        'Tallest bin': `${at.toFixed(at < 20 ? 3 : 2)} GeV`,
        'Nearest known particle': `${ref[0]} · ${ref[1].toFixed(3)} GeV`,
        'Bin width there': `${(edge(peak + 1) - edge(peak)).toFixed(3)} GeV`,
      } : { 'Events in view': 'none — loosen the cuts' });
      next();
    }

    function next() {
      shown = sel.length ? sel[Math.floor(Math.random() * sel.length)] : -1;
      draw();
    }

    function draw() {
      const top = Math.max(1, ...hist);
      const p = plot = frame(cv, {
        x: [lo(), hi()], xlog: log(), y: log() ? [0.7, top * 3] : [0, top * 1.15], ylog: log(),
        xlabel: 'Dimuon invariant mass (GeV)', ylabel: 'Events per bin',
      });
      const { ctx } = p;
      ctx.save(); p.clip();
      ctx.fillStyle = ink('--s1');
      hist.forEach((n, i) => {
        if (!n) return;
        const x0 = p.sx(edge(i)), wBar = p.sx(edge(i + 1)) - x0, y = p.sy(n);
        ctx.fillRect(x0, y, wBar > 3 ? wBar - 1 : wBar, p.bottom - y);
      });
      ctx.restore();
      // reference masses: dashed rule + label, staggered so neighbours don't collide
      ctx.setLineDash([4, 4]); ctx.strokeStyle = ink('--muted'); ctx.fillStyle = ink('--text2'); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      PDG.filter(([, m, minor]) => m > lo() && m < hi() && !(log() && minor)).forEach(([name, m], i) => {
        const X = p.sx(m), yLabel = p.top + 2 + (i % 2) * 15;
        ctx.beginPath(); ctx.moveTo(X, yLabel + 15); ctx.lineTo(X, p.bottom); ctx.stroke();
        ctx.fillText(name, X, yLabel);
      });
      ctx.setLineDash([]);
      drawEvent();
    }

    function drawEvent() {
      const { ctx, w, h } = ctx2d(evCv), cx = w / 2, cy = h / 2, s = Math.min(w, h) / 2 / (R_SOLENOID * 1.12); // px per metre
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      for (const [r, name] of [[R_TRACKER, 'tracker'], [R_SOLENOID, `solenoid, ${B_FIELD} T`]]) {
        ctx.strokeStyle = ink('--axis'); ctx.beginPath(); ctx.arc(cx, cy, r * s, 0, 7); ctx.stroke();
        ctx.fillStyle = ink('--muted'); ctx.fillText(name, cx, cy - r * s - 2);
      }
      if (shown < 0) { info.innerHTML = ''; return; }
      const r = ev[shown], mu = [[r[0], r[1], r[2], r[3]], [r[4], r[5], r[6], r[7]]];
      for (const [pt, , phi0, q] of mu) {
        // radius of curvature R[m] = pT[GeV] / (0.3 · B[T]); positive charges bend clockwise for B along +z
        const R = pt / (0.3 * B_FIELD), ds = 0.01;
        let x = 0, y = 0, phi = phi0;
        ctx.beginPath(); ctx.moveTo(cx, cy);
        for (let i = 0; i < 3000 && Math.hypot(x, y) < R_SOLENOID; i++) {
          phi -= q * ds / R; x += Math.cos(phi) * ds; y += Math.sin(phi) * ds;
          ctx.lineTo(cx + x * s, cy - y * s);
        }
        ctx.strokeStyle = ink(q > 0 ? '--s2' : '--s1'); ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1;
        ctx.fillStyle = ink('--text'); ctx.textBaseline = 'middle';
        ctx.fillText(q > 0 ? 'μ⁺' : 'μ⁻', cx + x * s * 0.88 + 12 * Math.sin(phi), cy - y * s * 0.88 + 12 * Math.cos(phi));
      }
      info.innerHTML = `<table>
        <tr><th>Event ${shown + 1} of ${ev.length.toLocaleString()}</th><th>pT (GeV)</th><th>η</th><th>φ (rad)</th></tr>
        ${mu.map(([pt, eta, phi, q]) => `<tr><td>${q > 0 ? 'μ⁺' : 'μ⁻'}</td><td>${pt.toFixed(2)}</td><td>${eta.toFixed(2)}</td><td>${phi.toFixed(2)}</td></tr>`).join('')}
        <tr><td>Pair mass</td><td colspan="3">${mass[shown].toFixed(3)} GeV</td></tr></table>
        <p class="note">View along the beam. The magnet bends each muon into a circle of radius pT / (0.3·B) metres, so a faster muon leaves a straighter track — that curvature is how the detector measures momentum. Tracks are drawn to the solenoid only.</p>`;
      button(info, 'Another event from this window', next);
    }

    hover(cv, (x) => {
      if (!plot || x < plot.left || x > plot.right) return '';
      const m = plot.ix(x), i = Math.floor(log() ? Math.log(m / lo()) / Math.log(hi() / lo()) * v.bins : (m - lo()) / (hi() - lo()) * v.bins);
      return hist[i] === undefined ? '' : `<b>${hist[i].toLocaleString()} events</b><br>${edge(i).toFixed(3)} – ${edge(i + 1).toFixed(3)} GeV`;
    });

    update();
    return { draw };
  },
};
