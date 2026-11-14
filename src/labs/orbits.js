import { controls, tiles, canvas, ctx2d, ink, button, note, pm } from '../kit.js';
import { G, step, energy, revolutions } from '../physics/nbody.js';
import { notebook } from '../notebook.js';

const TAU = 2 * Math.PI;
const body = (name, colour, m, x, y, vx, vy) => ({ name, colour, m, x, y, vx, vy });
const planet = (name, colour, m, a) => body(name, colour, m, a, 0, 0, TAU / Math.sqrt(a)); // circular orbit round 1 M☉

// [bodies(), half-width of the view in AU]
const PRESETS = {
  'Inner solar system': [() => [
    body('Sun', '--s4', 1, 0, 0, 0, 0), planet('Mercury', '--s5', 1.66e-7, 0.387), planet('Venus', '--s2', 2.45e-6, 0.723),
    planet('Earth', '--s1', 3.0e-6, 1), planet('Mars', '--s8', 3.23e-7, 1.524),
  ], 1.9],
  'Binary star with a planet': [() => {
    const v = Math.sqrt(G * 1.5); // relative speed of a circular 1 AU binary of total mass 1.5 M☉
    return [body('Star A', '--s4', 1, -1 / 3, 0, 0, -v / 3), body('Star B', '--s2', 0.5, 2 / 3, 0, 0, 2 * v / 3), body('Planet', '--s1', 3e-6, 4, 0, 0, Math.sqrt(G * 1.5 / 4))];
  }, 5],
  // Chenciner–Montgomery choreography; velocities scaled from G = 1 to our units by √G = 2π.
  'Figure-eight (three equal stars)': [() => {
    const x = 0.97000436, y = -0.24308753, vx = -0.93240737 * TAU, vy = -0.86473146 * TAU;
    return [body('A', '--s1', 1, x, y, -vx / 2, -vy / 2), body('B', '--s2', 1, -x, -y, -vx / 2, -vy / 2), body('C', '--s3', 1, 0, 0, vx, vy)];
  }, 1.6],
};

export default {
  id: 'orbits',
  field: 'Astrophysics',
  title: 'Gravity sandbox',
  blurb: 'Bodies pulling on each other with Newtonian gravity, integrated step by step. Each orbit is timed as it completes, so you can test Kepler’s third law yourself: predict a planet’s year from its distance, then measure it. Watch the energy drift too. Switch to Euler and raise the time step to see a simulation quietly go wrong even though the code has no bug.',

  mount(root) {
    const v = controls(root, {
      preset: { label: 'System', options: Object.keys(PRESETS), value: 'Inner solar system' },
      method: { label: 'Integrator', options: ['Leapfrog (symplectic)', 'Euler'], value: 'Leapfrog (symplectic)' },
      dt: { label: 'Time step', min: 0.0005, max: 0.02, step: 0.0005, value: 0.002, unit: 'yr' },
      speed: { label: 'Steps per frame', min: 1, max: 40, value: 8 },
    }, (key) => { if (key !== 'speed') reset(); });
    const bar = root.lastChild;
    let running = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    const toggle = button(bar, running ? 'Pause' : 'Run', () => { running = !running; toggle.textContent = running ? 'Pause' : 'Run'; });
    button(bar, 'Restart', reset);
    const cv = canvas(root, 520, 'Animated top-down view of bodies orbiting under gravity');
    const set = tiles(root);
    note(root, 'A period is timed from one full turn about the heaviest body; its ± is the spread between successive orbits, so it is zero for a perfectly repeating orbit and grows when orbits drift or disturb each other. The figure-eight has no single heaviest body, so no period is timed there.');

    let bodies, trails, laps, primary, t, e0, n, raf, blind = false;
    const drift = () => (energy(bodies) - e0) / Math.abs(e0) * 100;
    const angle = (j) => Math.atan2(bodies[j].y - bodies[primary].y, bodies[j].x - bodies[primary].x);
    const timed = () => bodies.map((b, j) => [b.name, laps[j]]).filter(([, l]) => l);

    function reset() {
      bodies = PRESETS[v.preset][0]();
      const M = bodies.reduce((s, b) => s + b.m, 0); // remove net momentum so the system stays centred
      for (const k of ['vx', 'vy']) { const c = bodies.reduce((s, b) => s + b.m * b[k], 0) / M; bodies.forEach((b) => { b[k] -= c; }); }
      const heavy = bodies.map((_, j) => j).sort((a, b) => bodies[b].m - bodies[a].m);
      primary = bodies[heavy[0]].m > 1.5 * bodies[heavy[1]].m ? heavy[0] : -1;
      laps = bodies.map((_, j) => (primary >= 0 && j !== primary ? revolutions() : null));
      trails = bodies.map(() => []); t = 0; n = 0; e0 = energy(bodies);
      laps.forEach((l, j) => l?.push(0, angle(j)));
    }
    reset();

    const book = notebook(root, {
      lab: 'orbits',
      example: 'How long is a Mars year if Kepler’s third law holds?',
      pending: 'That orbit has not completed yet — let the simulation run.',
      get quantities() { return { ...Object.fromEntries(timed().map(([name]) => [`Period of ${name}`, 'yr'])), 'Energy drift': '%' }; },
      results: () => ({
        ...Object.fromEntries(timed().flatMap(([name, l]) => { const p = l.period(); return p ? [[`Period of ${name}`, [p[0], p[1], 'yr']]] : []; })),
        'Energy drift': [drift(), 0, '%'],
      }),
      method: () => ({ ...v, time: +t.toFixed(3) }),
      restore: (m) => v.set(m),
      blind: (on) => { blind = on; },
    });
    note(root, 'Units: AU, years, solar masses (G = 4π²). Planet masses and orbit sizes are real; orbits start circular and in one plane, which the real ones are not quite.');

    function tick() {
      if (running) {
        for (let i = 0; i < v.speed; i++) {
          step(bodies, v.dt, v.method === 'Euler' ? 'euler' : 'leapfrog'); t += v.dt;
          laps.forEach((l, j) => l?.push(t, angle(j)));
          if (++n % 2 === 0) bodies.forEach((b, j) => { trails[j].push(b.x, b.y); if (trails[j].length > 3000) trails[j].splice(0, 2); });
        }
      }
      const { ctx, w, h } = ctx2d(cv), view = PRESETS[v.preset][1], s = Math.min(w, h) / 2 / view, X = (x) => w / 2 + x * s, Y = (y) => h / 2 - y * s;
      bodies.forEach((b, j) => {
        const tr = trails[j];
        ctx.strokeStyle = ink(b.colour); ctx.globalAlpha = 0.55; ctx.beginPath();
        for (let i = 0; i < tr.length; i += 2) ctx.lineTo(X(tr[i]), Y(tr[i + 1]));
        ctx.stroke(); ctx.globalAlpha = 1;
        ctx.fillStyle = ink(b.colour); ctx.beginPath(); ctx.arc(X(b.x), Y(b.y), b.m > 0.1 ? 7 : 4, 0, 7); ctx.fill();
        ctx.fillStyle = ink('--text2'); ctx.textBaseline = 'middle'; ctx.fillText(b.name, X(b.x) + 10, Y(b.y));
      });
      // scale bar
      ctx.strokeStyle = ink('--muted'); ctx.fillStyle = ink('--muted'); ctx.beginPath(); ctx.moveTo(16, h - 16); ctx.lineTo(16 + s, h - 16); ctx.stroke();
      ctx.textBaseline = 'bottom'; ctx.fillText('1 AU', 16, h - 20);
      set({
        Time: `${t.toFixed(2)} yr`,
        ...(blind ? { Measurements: 'hidden until you lock a prediction' } : {
          'Energy drift': `${drift().toExponential(1)} %`,
          ...Object.fromEntries(timed().map(([name, l]) => {
            const p = l.period();
            return [`Period of ${name}`, p ? `${p[1] < 1e-6 ? p[0].toFixed(5) : pm(p[0], p[1])} yr · ${p[2]} orbit${p[2] > 1 ? 's' : ''}` : 'first orbit…'];
          })),
        }),
      });
      book.refresh();
      raf = requestAnimationFrame(tick);
    }

    tick();
    return { stop: () => cancelAnimationFrame(raf) };
  },
};
