// CSV text to numeric columns. Pure, so it can be tested without a browser.
const MAX_ROWS = 200000;

// Text → { cols: [names], data: [number[] per column] } keeping only numeric columns.
// shortcut: quoted fields that contain the delimiter are not supported; switch to a real CSV parser if files need them.
export function parseTable(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#')).slice(0, MAX_ROWS + 1);
  if (lines.length < 4) throw new Error('That file has fewer than three rows of data.');
  const sep = [',', ';', '\t'].map((s) => [s, lines[0].split(s).length]).sort((a, b) => b[1] - a[1])[0][0];
  const cells = lines.map((l) => l.split(sep).map((c) => c.trim().replace(/^"|"$/g, '')));
  const header = cells[0].some((c) => c !== '' && !isFinite(c)), body = header ? cells.slice(1) : cells;
  const names = cells[0].map((c, i) => (header && c ? c : `column ${i + 1}`));
  const keep = names.map((_, i) => body.filter((r) => r[i] !== '' && r[i] !== undefined && isFinite(r[i])).length >= 0.9 * body.length);
  if (!keep.some(Boolean)) throw new Error('No numeric columns found. The bench needs columns of numbers.');
  return { cols: names.filter((_, i) => keep[i]), data: names.map((_, i) => body.map((r) => (r[i] === '' || r[i] === undefined ? NaN : +r[i]))).filter((_, i) => keep[i]) };
}
