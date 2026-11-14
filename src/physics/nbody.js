// Planar Newtonian gravity. Units: AU, years, solar masses.
export const G = 4 * Math.PI ** 2;

function accel(b) {
  const a = b.map(() => [0, 0]);
  for (let i = 0; i < b.length; i++) {
    for (let j = i + 1; j < b.length; j++) {
      const dx = b[j].x - b[i].x, dy = b[j].y - b[i].y, r3 = Math.hypot(dx, dy) ** 3;
      a[i][0] += G * b[j].m * dx / r3; a[i][1] += G * b[j].m * dy / r3;
      a[j][0] -= G * b[i].m * dx / r3; a[j][1] -= G * b[i].m * dy / r3;
    }
  }
  return a;
}

// Advances bodies [{m, x, y, vx, vy}] in place by dt.
// 'leapfrog' (kick-drift-kick) is symplectic: energy error stays bounded. 'euler' drifts.
export function step(b, dt, method = 'leapfrog') {
  const kick = (a, h) => b.forEach((p, i) => { p.vx += a[i][0] * h; p.vy += a[i][1] * h; });
  const drift = () => b.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; });
  if (method === 'euler') { const a = accel(b); drift(); kick(a, dt); return; }
  kick(accel(b), dt / 2);
  drift();
  kick(accel(b), dt / 2);
}

export function energy(b) {
  let e = 0;
  for (let i = 0; i < b.length; i++) {
    e += 0.5 * b[i].m * (b[i].vx ** 2 + b[i].vy ** 2);
    for (let j = i + 1; j < b.length; j++) e -= G * b[i].m * b[j].m / Math.hypot(b[j].x - b[i].x, b[j].y - b[i].y);
  }
  return e;
}

// Measures an orbital period from successive angles (radians) of a body about its primary.
// period() → [mean, standard error across completed orbits, number of orbits], or null before the first one.
export function revolutions() {
  const laps = [];
  let last, tPrev, mark, turned = 0;
  return {
    push(t, angle) {
      if (last === undefined) mark = t;
      else {
        const d = angle - last, before = Math.abs(turned);
        turned += d - 2 * Math.PI * Math.round(d / (2 * Math.PI));
        const now = Math.abs(turned), k = Math.floor(now / (2 * Math.PI));
        if (k > Math.floor(before / (2 * Math.PI))) {
          const cross = tPrev + (k * 2 * Math.PI - before) / (now - before) * (t - tPrev); // interpolate inside the step
          laps.push(cross - mark);
          mark = cross;
        }
      }
      last = angle; tPrev = t;
    },
    period() {
      const n = laps.length;
      if (!n) return null;
      const mean = laps.reduce((a, b) => a + b, 0) / n;
      return [mean, n > 1 ? Math.sqrt(laps.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1) / n) : 0, n];
    },
  };
}
