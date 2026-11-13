import { controls, tiles, canvas, frame, hover, ink, legend, note, esc } from '../kit.js';

const AXES = {
  'Orbital period (days)': 'pl_orbper', 'Semi-major axis (AU)': 'pl_orbsmax', 'Mass (Earth = 1)': 'pl_bmasse',
  'Radius (Earth = 1)': 'pl_rade', 'Distance from us (parsec)': 'sy_dist', 'Discovery year': 'disc_year',
};
// Scatter needs every pair of colours distinguishable, which caps the palette at three groups.
const GROUPS = [['Transit', '--s1'], ['Radial velocity', '--s2'], ['Other methods', '--s3']];
const HOME = [
  ['Earth', { pl_orbper: 365.25, pl_orbsmax: 1, pl_bmasse: 1, pl_rade: 1 }],
  ['Jupiter', { pl_orbper: 4332.6, pl_orbsmax: 5.203, pl_bmasse: 317.8, pl_rade: 11.21 }],
];
const num = (x) => +(+x).toPrecision(4);

export default {
  id: 'exoplanets',
  field: 'Astrophysics',
  title: 'Exoplanet census',
  blurb: 'Every confirmed planet around another star in NASA’s archive. Each detection method has blind spots, so the clusters show what we can find as much as what exists. Try semi-major axis against orbital period: the points fall on a line, which is Kepler’s third law.',

  async mount(root) {
    const res = await fetch('data/exoplanets.json');
    if (!res.ok) throw new Error('Could not load data/exoplanets.json — run `npm run data` to download it.');
    const data = await res.json(), col = Object.fromEntries(data.cols.map((c, i) => [c, i]));
    const group = (r) => ({ Transit: 0, 'Radial Velocity': 1 }[r[col.discoverymethod]] ?? 2);

    // Kepler check: a³ / (P² · M★) should be 1 in AU, years, solar masses.
    const ratios = data.rows.map((r) => r[col.pl_orbsmax] ** 3 / (r[col.pl_orbper] / 365.25) ** 2 / r[col.st_mass]).filter((x) => x > 0 && isFinite(x)).sort((a, b) => a - b);

    const v = controls(root, {
      x: { label: 'Horizontal axis', options: Object.keys(AXES), value: 'Orbital period (days)' },
      y: { label: 'Vertical axis', options: Object.keys(AXES), value: 'Mass (Earth = 1)' },
    }, draw);
    legend(root, GROUPS);
    const cv = canvas(root, 460, 'Scatter plot of confirmed exoplanets coloured by discovery method');
    const set = tiles(root);
    note(root, `Data: <a href="https://exoplanetarchive.ipac.caltech.edu/">NASA Exoplanet Archive</a>, Planetary Systems Composite Parameters, snapshot ${esc(data.fetched)}. Many archive semi-major axes are themselves computed from the period with Kepler’s law, so the Kepler ratio is partly a consistency check, not an independent test.`);

    let screen = [];
    function draw() {
      const kx = AXES[v.x], ky = AXES[v.y], lin = (k) => k === 'disc_year';
      const pts = data.rows.filter((r) => r[col[kx]] > 0 && r[col[ky]] > 0);
      const range = (k) => {
        const vals = pts.map((r) => r[col[k]]), lo = Math.min(...vals), hi = Math.max(...vals);
        return lin(k) ? [lo - 1, hi + 1] : [lo / 1.6, hi * 1.6];
      };
      const p = frame(cv, { x: range(kx), xlog: !lin(kx), y: range(ky), ylog: !lin(ky), xlabel: v.x, ylabel: v.y });
      const { ctx } = p;
      screen = pts.map((r) => [p.sx(r[col[kx]]), p.sy(r[col[ky]]), r]);
      ctx.save(); p.clip(); ctx.globalAlpha = 0.6;
      GROUPS.forEach(([, colour], g) => {
        ctx.fillStyle = ink(colour);
        for (const [X, Y, r] of screen) if (group(r) === g) { ctx.beginPath(); ctx.arc(X, Y, 2.2, 0, 7); ctx.fill(); }
      });
      ctx.globalAlpha = 1;
      const kepler = new Set([kx, ky]).size === 2 && [kx, ky].every((k) => k === 'pl_orbper' || k === 'pl_orbsmax');
      if (kepler) {
        const a = (P) => (P / 365.25) ** (2 / 3), ends = range('pl_orbper');
        ctx.setLineDash([5, 4]); ctx.strokeStyle = ink('--text'); ctx.beginPath();
        for (const P of ends) kx === 'pl_orbper' ? ctx.lineTo(p.sx(P), p.sy(a(P))) : ctx.lineTo(p.sx(a(P)), p.sy(P));
        ctx.stroke(); ctx.setLineDash([]);
      }
      // our own solar system for scale
      ctx.strokeStyle = ctx.fillStyle = ink('--text'); ctx.lineWidth = 2; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      for (const [name, o] of HOME) {
        if (!(kx in o && ky in o)) continue;
        ctx.beginPath(); ctx.arc(p.sx(o[kx]), p.sy(o[ky]), 5, 0, 7); ctx.stroke();
        ctx.fillText(name, p.sx(o[kx]) + 9, p.sy(o[ky]));
      }
      ctx.restore();
      set({
        'Planets plotted': `${pts.length.toLocaleString()} of ${data.rows.length.toLocaleString()}`,
        ...(kepler && { 'Dashed line': 'a³ = P² for a Sun-mass star', 'Median a³ / (P²·M★)': ratios[ratios.length >> 1].toFixed(3) }),
      });
    }

    hover(cv, (x, y) => {
      let best, d = 100; // within 10 px
      for (const s of screen) { const q = (s[0] - x) ** 2 + (s[1] - y) ** 2; if (q < d) { d = q; best = s[2]; } }
      return best && `<b>${esc(best[col.pl_name])}</b><br>${v.x}: ${num(best[col[AXES[v.x]]])}<br>${v.y}: ${num(best[col[AXES[v.y]]])}<br>${esc(best[col.discoverymethod])}, ${best[col.disc_year]}`;
    });

    draw();
    return { draw };
  },
};
