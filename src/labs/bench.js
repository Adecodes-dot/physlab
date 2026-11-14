import { controls, tiles, canvas, frame, hover, ink, button, note, line, pm, esc } from '../kit.js';
import { histogram, pairMass } from '../physics/kinematics.js';
import { fitPeak, linfit } from '../physics/fit.js';
import { notebook } from '../notebook.js';
import { parseTable } from '../table.js';


export default {
  id: 'bench',
  field: 'Your data',
  title: 'Data bench',
  blurb: 'Bring your own measurements. Load a CSV file, pick two columns to scatter with a fitted line, or one column to histogram with a fitted peak, and use the same notebook as the built-in labs. The file is read inside your browser and never uploaded anywhere.',

  mount(root) {
    const bar = Object.assign(document.createElement('div'), { className: 'controls' });
    const pick = Object.assign(document.createElement('input'), { type: 'file', accept: '.csv,.tsv,.txt,text/csv' });
    const label = document.createElement('label');
    label.append('CSV file from your computer', pick);
    bar.append(label);
    const status = Object.assign(document.createElement('p'), { className: 'note' }), host = document.createElement('div');
    root.append(bar, status, host);
    let redraw = null;

    pick.onchange = async () => {
      const f = pick.files[0];
      if (!f) return;
      try { open(parseTable(await f.text()), f.name); } catch (e) { status.textContent = `⚠ ${e.message}`; }
    };
    button(bar, 'Load a sample: 5,000 CMS muon pairs', async () => {
      const res = await fetch('data/dimuon.csv');
      if (!res.ok) { status.textContent = '⚠ Could not load the sample.'; return; }
      const rows = (await res.text()).split('\n').slice(1, 5001).map((r) => r.split(',').map(Number)).filter((r) => r.length === 8);
      const col = (fn) => rows.map(fn);
      open({
        cols: ['pair mass (GeV)', 'muon 1 pT (GeV)', 'muon 2 pT (GeV)', 'muon 1 pz (GeV)', 'muon 2 pz (GeV)', 'charge product'],
        data: [col((r) => pairMass(r[0], r[1], r[2], r[4], r[5], r[6])), col((r) => Math.hypot(r[0], r[1])), col((r) => Math.hypot(r[4], r[5])), col((r) => r[2]), col((r) => r[6]), col((r) => r[3] * r[7])],
      }, 'sample: CMS muon pairs');
    });

    function open(table, name) {
      status.textContent = `${name}: ${table.data[0].length.toLocaleString()} rows, ${table.cols.length} numeric column${table.cols.length > 1 ? 's' : ''}.`;
      host.replaceChildren();
      const v = controls(host, {
        mode: { label: 'Analysis', options: ['Histogram with peak fit', 'Scatter with line fit'], value: 'Histogram with peak fit' },
        x: { label: 'Column (horizontal)', options: table.cols, value: table.cols[0] },
        y: { label: 'Column (vertical, scatter only)', options: table.cols, value: table.cols[Math.min(1, table.cols.length - 1)] },
        scale: { label: 'Axes (scatter only)', options: ['Linear', 'Log–log'], value: 'Linear' },
        bins: { label: 'Bins (histogram only)', min: 10, max: 200, step: 5, value: 60 },
        shape: { label: 'Peak shape', options: ['Gaussian', 'Breit–Wigner'], value: 'Gaussian' },
      }, () => { range = null; draw(); });
      button(host.lastChild, 'Show full range', () => { range = null; draw(); });
      const cv = canvas(host, 420, 'Chart of the selected columns with the fitted curve');
      cv.style.touchAction = 'pan-y';
      const set = tiles(host);
      note(host, 'In histogram mode, drag across a peak to zoom in and fit just that range. Fit uncertainties are statistical; they assume independent rows and, for the line, equal random scatter.');
      let range = null, plot = null, hist = null, peak = null, fitLine = null, pts = [], drag = null, blind = false;
      const isHist = () => v.mode.startsWith('Histogram'), column = (name) => table.data[table.cols.indexOf(name)];

      const book = notebook(host, {
        lab: 'bench',
        example: 'What slope do I expect between these two columns, and why?',
        pending: 'No fit available for the current selection.',
        get quantities() { return isHist() ? { 'Peak position': '', 'Peak width': '', 'Signal events': 'rows' } : { 'Fitted slope': '', 'Intercept': '', 'Scatter about the line': '' }; },
        results: () => (isHist()
          ? (peak?.ok ? { 'Peak position': [...peak.position, ''], 'Peak width': [...peak.width, ''], 'Signal events': [...peak.signal, 'rows'] } : null)
          : (fitLine ? { 'Fitted slope': [...fitLine.slope, ''], 'Intercept': [...fitLine.intercept, ''], 'Scatter about the line': [...fitLine.scatter, ''] } : null)),
        method: () => ({ file: name, ...v, ...(range && { range }) }),
        restore: (m) => { range = m.range ?? null; v.set(m); },
        blind: (on) => { blind = on; draw(); },
      });

      function draw() {
        const hidden = { 'Fit results': 'hidden until you lock a prediction' };
        if (isHist()) {
          const vals = column(v.x).filter(isFinite), [lo, hi] = range ?? [Math.min(...vals), Math.max(...vals)];
          if (!(hi > lo)) { set({ Rows: vals.length, Fit: 'this column has a single value' }); return; }
          hist = histogram(vals, lo, hi * (1 + 1e-12), v.bins);
          const edge = (i) => lo + (hi - lo) * i / v.bins;
          peak = fitPeak(Array.from(hist, (_, i) => (edge(i) + edge(i + 1)) / 2), hist, v.shape === 'Gaussian' ? 'gauss' : 'bw');
          const p = plot = frame(cv, { x: [lo, hi], y: [0, Math.max(1, ...hist) * 1.15], xlabel: v.x, ylabel: 'Rows per bin' });
          p.ctx.save(); p.clip(); p.ctx.fillStyle = ink('--s1');
          hist.forEach((n, i) => { const x0 = p.sx(edge(i)), w = p.sx(edge(i + 1)) - x0, y = p.sy(n); p.ctx.fillRect(x0, y, w > 3 ? w - 1 : w, p.bottom - y); });
          if (peak?.ok && !blind) { const xs = Array.from({ length: 201 }, (_, i) => lo + (hi - lo) * i / 200); line(p, xs, xs.map(peak.curve), '--s2'); }
          if (drag) { p.ctx.globalAlpha = 0.15; p.ctx.fillStyle = ink('--text'); p.ctx.fillRect(Math.min(...drag), p.top, Math.abs(drag[1] - drag[0]), p.bottom - p.top); }
          p.ctx.restore();
          set({ 'Rows in range': hist.reduce((a, b) => a + b, 0).toLocaleString(), ...(blind ? hidden : peak?.ok ? {
            'Peak position': pm(...peak.position), [v.shape === 'Gaussian' ? 'Width σ' : 'Width Γ']: pm(...peak.width), 'Signal rows': pm(...peak.signal),
            'Fit quality χ² / ndf': `${peak.chi2.toFixed(0)} / ${peak.ndf} = ${(peak.chi2 / peak.ndf).toFixed(2)}`,
          } : { Fit: 'no significant single peak in this range' }) });
        } else {
          const log = v.scale !== 'Linear', X = column(v.x), Y = column(v.y), t = (val) => (log ? Math.log10(val) : val);
          pts = X.map((x, i) => [x, Y[i]]).filter(([x, y]) => isFinite(x) && isFinite(y) && (!log || (x > 0 && y > 0)));
          fitLine = linfit(pts.map((q) => t(q[0])), pts.map((q) => t(q[1])));
          if (pts.length < 2) { set({ Rows: pts.length, Fit: log ? 'log axes need positive values' : 'not enough rows' }); return; }
          const span = (k) => { const s = pts.map((q) => q[k]), lo = Math.min(...s), hi = Math.max(...s), pad = (hi - lo) * 0.05 || 1; return log ? [lo / 1.3, hi * 1.3] : [lo - pad, hi + pad]; };
          const p = plot = frame(cv, { x: span(0), y: span(1), xlog: log, ylog: log, xlabel: v.x, ylabel: v.y });
          p.ctx.save(); p.clip(); p.ctx.fillStyle = ink('--s1'); p.ctx.globalAlpha = pts.length > 2000 ? 0.4 : 0.8;
          for (const [x, y] of pts) { p.ctx.beginPath(); p.ctx.arc(p.sx(x), p.sy(y), 2.2, 0, 7); p.ctx.fill(); }
          p.ctx.globalAlpha = 1;
          if (fitLine && !blind) { const xs = span(0), f = (x) => { const y = fitLine.intercept[0] + fitLine.slope[0] * t(x); return log ? 10 ** y : y; }; line(p, xs, xs.map(f), '--s2'); }
          p.ctx.restore();
          set({ Rows: pts.length.toLocaleString(), ...(blind ? hidden : fitLine ? {
            [log ? 'Fitted slope (power-law exponent)' : 'Fitted slope']: pm(...fitLine.slope), Intercept: pm(...fitLine.intercept),
            'Scatter about the line': pm(...fitLine.scatter), 'Correlation r': fitLine.r.toFixed(3),
          } : { Fit: 'the horizontal column has a single value' }) });
        }
        book.refresh();
      }

      hover(cv, (x, y) => {
        if (drag || !plot || x < plot.left || x > plot.right) return '';
        if (isHist()) {
          const [lo, hi] = [plot.ix(plot.left), plot.ix(plot.right)], i = Math.floor((plot.ix(x) - lo) / (hi - lo) * v.bins);
          return hist?.[i] === undefined ? '' : `<b>${hist[i].toLocaleString()} rows</b><br>${esc(v.x)} ≈ ${+(lo + (hi - lo) * (i + 0.5) / v.bins).toPrecision(5)}`;
        }
        let best = null, d = 100;
        for (const q of pts) { const s = (plot.sx(q[0]) - x) ** 2 + (plot.sy(q[1]) - y) ** 2; if (s < d) { d = s; best = q; } }
        return best && `${esc(v.x)}: ${+best[0].toPrecision(5)}<br>${esc(v.y)}: ${+best[1].toPrecision(5)}`;
      });

      const clampX = (x) => Math.min(plot.right, Math.max(plot.left, x));
      cv.onpointerdown = (e) => { if (isHist() && plot) { drag = [clampX(e.offsetX), clampX(e.offsetX)]; cv.setPointerCapture(e.pointerId); } };
      cv.onpointermove = (e) => { if (drag) { drag[1] = clampX(e.offsetX); draw(); } };
      cv.onpointerup = cv.onpointercancel = () => {
        if (!drag) return;
        const picked = drag.map(plot.ix).sort((a, b) => a - b), wide = Math.abs(drag[1] - drag[0]) > 8;
        drag = null;
        if (wide) range = picked;
        draw();
      };

      redraw = draw;
      draw();
    }

    status.textContent = 'Choose a file, or load the sample to try it.';
    return { draw: () => redraw?.() };
  },
};
