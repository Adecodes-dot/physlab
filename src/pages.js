// Pages that are not experiments: overview, validation report, and the notebook across all labs.
import { esc, tiles, note } from './kit.js';
import { load, save, recordHtml, toMarkdown, download, reopenLater } from './notebook.js';
import { MISSIONS, total, done } from './missions.js';
import { compare } from './physics/fit.js';

const getJson = async (path) => { const res = await fetch(path); if (!res.ok) throw new Error(`Could not load ${path}`); return res.json(); };
const show = (x) => (x === 0 ? '0' : Math.abs(x) < 1e-3 || Math.abs(x) >= 1e5 ? x.toExponential(2) : String(+x.toPrecision(6)));

export const home = (labs) => ({
  id: 'home',
  field: 'Start here',
  title: 'PhysLab',
  blurb: 'A physics laboratory in your browser. Measure real particle collisions from CERN and real planets from NASA, run simulations you can break on purpose, and work the way research is done: predict first, measure with uncertainties, record what happened.',
  async mount(root) {
    const [val, meta, planets] = await Promise.all([getJson('data/validation.json'), getJson('data/dimuon.meta.json'), getJson('data/exoplanets.json')]);
    const passed = Object.keys(done()).length, records = load().length;
    tiles(root)({
      'Physics benchmarks passing': `<a href="#validation">${val.passed} of ${val.total}</a>`,
      'Real LHC collisions': meta.events.toLocaleString(),
      'Confirmed exoplanets': planets.rows.length.toLocaleString(),
      'Missions you have completed': `${passed} of ${total}`,
      'Experiments in your notebook': `<a href="#notebook">${records}</a>`,
    });
    root.insertAdjacentHTML('beforeend', `
      <h2 class="section">How to use it</h2>
      <ol class="steps">
        <li><b>Explore.</b> Open a lab and change things. Every chart answers a hover with the number behind it.</li>
        <li><b>Measure.</b> Each lab turns what you see into numbers with uncertainties: a mass, a slope, a period, a transmitted share, a firing rate.</li>
        <li><b>Predict, then test.</b> Start an experiment in the lab notebook, lock a numerical prediction before the result is shown, and record the verdict with the settings that produced it.</li>
        <li><b>Go further.</b> Missions take you from first look to research-style questions. The data bench does the same analysis on your own CSV file.</li>
      </ol>
      <h2 class="section">Laboratories</h2>
      <div class="cards">${labs.map((l) => { const list = MISSIONS[l.id] ?? [], n = list.filter((m) => done()[m.id]).length; return `
        <a class="card" href="#${l.id}"><small>${l.field}</small><b>${l.title}</b><span>${l.blurb.split('. ')[0]}.</span>${list.length ? `<small>${n} of ${list.length} missions done</small>` : ''}</a>`; }).join('')}</div>`);
    note(root, `Every number PhysLab reports is produced by code that is checked against an independent reference on each change. See the <a href="#validation">validation report</a>. PhysLab is an independent project, not affiliated with CERN, the CMS collaboration or NASA.`);
  },
});

export const validation = {
  id: 'validation',
  field: 'Evidence',
  title: 'Validation report',
  blurb: 'Why trust the numbers? Each row is a quantity PhysLab measures with the same code the labs run, set against an independent reference: a published value, an exact solution, or a conservation law. The suite runs automatically on every change.',
  async mount(root) {
    const v = await getJson('data/validation.json'), labs = [...new Set(v.rows.map((r) => r.lab))];
    tiles(root)({ 'Benchmarks passing': `${v.passed} of ${v.total}`, 'Last run': esc(v.generated), 'Reproduce it': '<code>npm run validate</code>' });
    root.insertAdjacentHTML('beforeend', labs.map((lab) => `
      <h2 class="section">${esc(lab[0].toUpperCase() + lab.slice(1))}</h2>
      <div class="scroll"><table class="wide-table">
        <tr><th>Benchmark</th><th>Measured</th><th>Reference</th><th>Allowed gap</th><th>Gap used</th><th>Result</th></tr>
        ${v.rows.filter((r) => r.lab === lab).map((r) => { const used = Math.abs(r.measured - r.reference) / r.tolerance; return `
        <tr><td><b>${esc(r.name)}</b><br><span class="note">${esc(r.basis)}</span></td>
          <td>${show(r.measured)} ${esc(r.unit)}</td><td>${show(r.reference)} ${esc(r.unit)}</td><td>± ${show(r.tolerance)}</td>
          <td><span class="meter"><i style="width:${Math.min(100, used * 100).toFixed(0)}%"></i></span> ${(used * 100).toFixed(0)} %</td>
          <td>${r.pass ? '✓ pass' : '✗ fail'}</td></tr>`; }).join('')}
      </table></div>`).join(''));
    note(root, '“Gap used” is the distance between measured and reference as a share of the allowed gap. The collider masses sit a little below their references by more than their statistical error: that is detector calibration in a 2011 education sample, which this tool does not correct, and the allowed gap of 0.5 % is set to cover it.');
  },
};

export const notebookPage = {
  id: 'notebook',
  field: 'Your work',
  title: 'Notebook',
  blurb: 'Every experiment you have recorded, across all labs. Records are stored in this browser only: download them to keep or share them.',
  mount(root) {
    const box = document.createElement('div');
    root.append(box);
    const render = () => {
      const all = load().sort((a, b) => b.id - a.id), kept = all.filter((r) => compare(r.predicted, r.tolerance, r.measured[0], r.measured[1]).z < 2).length;
      box.innerHTML = all.length ? `
        <dl class="tiles"><div><dt>Experiments recorded</dt><dd>${all.length}</dd></div><div><dt>Predictions that survived</dt><dd>${kept} of ${all.length}</dd></div></dl>
        <button type="button" data-act="export">Download everything as Markdown</button>
        ${all.map((r) => recordHtml(r, `<button type="button" data-reopen="${r.id}">Open in its lab with these settings</button> <button type="button" data-delete="${r.id}">Delete</button>`)).join('')}`
        : '<p class="note">Nothing recorded yet. Open a lab, scroll to its notebook and start an experiment.</p>';
    };
    box.onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const all = load();
      if (b.dataset.act === 'export') download('physlab-notebook.md', toMarkdown(all, 'PhysLab notebook'));
      else if (b.dataset.reopen) { const r = all.find((x) => x.id === +b.dataset.reopen); reopenLater(r); location.hash = r.lab; }
      else if (b.dataset.delete && confirm('Delete this record? This cannot be undone.')) { save(all.filter((r) => r.id !== +b.dataset.delete)); render(); }
    };
    render();
  },
};
