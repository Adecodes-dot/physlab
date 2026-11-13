// Shared UI and plotting helpers. Canvas colours come from the CSS variables in style.css,
// so every chart follows the light/dark theme.
export const ink = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

// spec: { key: { label, options, value } | { label, min, max, step, value, unit } } → live values object.
export function controls(host, spec, onChange) {
  const v = {}, form = document.createElement('form');
  form.className = 'controls';
  form.onsubmit = (e) => e.preventDefault();
  for (const [key, c] of Object.entries(spec)) {
    const label = document.createElement('label'), head = document.createElement('span'), out = document.createElement('output');
    let input;
    if (c.options) {
      input = document.createElement('select');
      for (const o of c.options) input.add(new Option(o));
    } else {
      input = Object.assign(document.createElement('input'), { type: 'range', min: c.min, max: c.max, step: c.step ?? 1 });
    }
    input.value = c.value;
    const read = () => {
      v[key] = c.options ? input.value : +input.value;
      if (!c.options) out.textContent = `${v[key]}${c.unit ? ' ' + c.unit : ''}`;
    };
    input.oninput = () => { read(); onChange(key); };
    read();
    head.append(c.label, ' ', out);
    label.append(head, input);
    form.append(label);
  }
  host.append(form);
  return v;
}

export function button(host, text, onClick) {
  const b = Object.assign(document.createElement('button'), { type: 'button', textContent: text, onclick: onClick });
  host.append(b);
  return b;
}

// Returns set({ label: value }) which re-renders a row of stat tiles.
export function tiles(host) {
  const dl = document.createElement('dl');
  dl.className = 'tiles';
  host.append(dl);
  return (o) => { dl.innerHTML = Object.entries(o).map(([k, val]) => `<div><dt>${k}</dt><dd>${val}</dd></div>`).join(''); };
}

export function legend(host, items) {
  host.insertAdjacentHTML('beforeend', `<div class="legend">${items.map(([name, c]) => `<span><i style="background:var(${c})"></i>${name}</span>`).join('')}</div>`);
}

export function note(host, html) {
  host.insertAdjacentHTML('beforeend', `<p class="note">${html}</p>`);
}

export function canvas(host, height, label) {
  const cv = document.createElement('canvas');
  cv.style.height = height + 'px';
  cv.setAttribute('role', 'img');
  cv.setAttribute('aria-label', label);
  host.append(cv);
  return cv;
}

export function ctx2d(cv) {
  const dpr = devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
  cv.width = w * dpr; cv.height = h * dpr; // also clears the canvas and resets the transform
  const ctx = cv.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.font = '12px system-ui, sans-serif';
  return { ctx, w, h };
}

function ticks(lo, hi, log) {
  const t = [];
  if (log) {
    const mult = Math.log10(hi / lo) < 3 ? [1, 2, 5] : [1];
    for (let e = Math.floor(Math.log10(lo)); 10 ** e <= hi; e++) for (const m of mult) if (m * 10 ** e >= lo && m * 10 ** e <= hi) t.push(m * 10 ** e);
    return t;
  }
  const raw = (hi - lo) / 6, mag = 10 ** Math.floor(Math.log10(raw)), stepSize = [1, 2, 5, 10].find((s) => s * mag >= raw) * mag;
  for (let val = Math.ceil(lo / stepSize - 1e-9) * stepSize; val <= hi + stepSize * 1e-9; val += stepSize) t.push(val);
  return t;
}
const fmt = (val) => (val !== 0 && (Math.abs(val) >= 1e5 || Math.abs(val) < 1e-3) ? val.toExponential(0).replace('e+', 'e') : String(+val.toPrecision(6))).replace('-', '−');

// Draws grid, ticks and axis labels; returns scales (sx, sy), their inverses (ix, iy) and a clip() for the plot area.
// o: { x: [lo, hi], y: [lo, hi], xlog, ylog, xlabel, ylabel }
export function frame(cv, o) {
  const { ctx, w, h } = ctx2d(cv), L = 62, R = 14, T = 14, B = 42;
  const fx = o.xlog ? Math.log10 : (val) => val, fy = o.ylog ? Math.log10 : (val) => val;
  const [x0, x1] = o.x.map(fx), [y0, y1] = o.y.map(fy);
  const sx = (val) => L + (fx(val) - x0) / (x1 - x0) * (w - L - R);
  const sy = (val) => h - B - (fy(val) - y0) / (y1 - y0) * (h - T - B);
  const ix = (px) => { const u = x0 + (px - L) / (w - L - R) * (x1 - x0); return o.xlog ? 10 ** u : u; };
  const iy = (py) => { const u = y0 + (h - B - py) / (h - T - B) * (y1 - y0); return o.ylog ? 10 ** u : u; };
  const seg = (xa, ya, xb, yb) => { ctx.beginPath(); ctx.moveTo(xa, ya); ctx.lineTo(xb, yb); ctx.stroke(); };

  ctx.strokeStyle = ink('--grid'); ctx.fillStyle = ink('--muted');
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (const t of ticks(o.x[0], o.x[1], o.xlog)) { const X = Math.round(sx(t)) + 0.5; seg(X, T, X, h - B); ctx.fillText(fmt(t), X, h - B + 6); }
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  for (const t of ticks(o.y[0], o.y[1], o.ylog)) { const Y = Math.round(sy(t)) + 0.5; seg(L, Y, w - R, Y); ctx.fillText(fmt(t), L - 6, Y); }
  ctx.strokeStyle = ink('--axis');
  seg(L, h - B + 0.5, w - R, h - B + 0.5);

  ctx.fillStyle = ink('--text2'); ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  if (o.xlabel) ctx.fillText(o.xlabel, (L + w - R) / 2, h - 4);
  if (o.ylabel) { ctx.save(); ctx.translate(13, (T + h - B) / 2); ctx.rotate(-Math.PI / 2); ctx.textBaseline = 'middle'; ctx.fillText(o.ylabel, 0, 0); ctx.restore(); }

  const clip = () => { ctx.beginPath(); ctx.rect(L, T, w - L - R, h - T - B); ctx.clip(); };
  return { ctx, w, h, sx, sy, ix, iy, clip, top: T, bottom: h - B, left: L, right: w - R };
}

// 2px polyline in data coordinates.
export function line(p, xs, ys, colour) {
  const { ctx } = p;
  ctx.beginPath();
  for (let i = 0; i < xs.length; i++) ctx.lineTo(p.sx(xs[i]), p.sy(ys[i]));
  ctx.strokeStyle = ink(colour); ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
}

// fn(x, y) in canvas pixels → tooltip HTML, or a falsy value to hide it.
const tip = document.getElementById('tip');
export function hover(cv, fn) {
  cv.onmousemove = (e) => {
    const html = fn(e.offsetX, e.offsetY);
    tip.hidden = !html;
    if (!html) return;
    tip.innerHTML = html;
    tip.style.left = Math.min(e.clientX + 14, innerWidth - 250) + 'px';
    tip.style.top = e.clientY + 14 + 'px';
  };
  cv.onmouseleave = () => { tip.hidden = true; fn(-1, -1); };
}
