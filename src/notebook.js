// Lab notebook: question → prediction locked before the result is shown → measurement → verdict → conclusion.
// Records live in this browser's localStorage and can be downloaded as Markdown.
import { esc, pm } from './kit.js';
import { compare } from './physics/fit.js';

const KEY = 'physlab.notebook';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? []; } catch { return []; } };
const save = (all) => { try { localStorage.setItem(KEY, JSON.stringify(all)); return true; } catch { return false; } };

const amount = ([value, err, unit]) => `${pm(value, err)} ${unit}`.trim();
const methodText = (m) => Object.entries(m).map(([k, val]) => `${k}: ${Array.isArray(val) ? val.map((x) => +(+x).toPrecision(5)).join(' – ') : val}`).join(' · ');
const judge = (r) => { const c = compare(r.predicted, r.tolerance, r.measured[0], r.measured[1]); return `${c.text}${isFinite(c.z) ? ` (${c.z.toFixed(1)} σ apart)` : ''}`; };

// o: { lab, example: sample question, pending: text shown while there is nothing to measure,
//      quantities: { name: unit }, results(): { name: [value, err, unit] } | null,
//      method(): settings snapshot, restore(method), blind(on): hide/show measured values in the lab }
export function notebook(root, o) {
  const box = document.createElement('section');
  box.className = 'notebook';
  root.append(box);
  let stage = 'idle', draft = null;

  function live() {
    const el = box.querySelector('[data-live]');
    if (!el) return;
    const got = o.results()?.[draft.quantity];
    el.textContent = got ? `Measured now: ${amount(got)} → ${judge({ ...draft, measured: got })}` : o.pending;
  }

  function render() {
    const mine = load().filter((r) => r.lab === o.lab);
    const sheet = stage === 'idle' ? `
      <p class="note">Work the way a physicist does: ask a question, write down what you expect <em>before</em> you look, measure, then compare. Measured values stay hidden from the moment you start until your prediction is locked.</p>
      <button type="button" data-act="new">New experiment</button>`
      : stage === 'predict' ? `
      <form class="sheet">
        <label>Question<input name="question" required placeholder="e.g. ${esc(o.example)}"></label>
        <label>Quantity to predict<select name="quantity">${Object.entries(o.quantities).map(([q, unit]) => `<option value="${esc(q)}">${esc(q)}${unit ? ` (${esc(unit)})` : ''}</option>`).join('')}</select></label>
        <label>My prediction<input name="predicted" type="number" step="any" required></label>
        <label>± how sure I am, same units<input name="tolerance" type="number" step="any" min="0" required></label>
        <label class="wide">Why I expect this<textarea name="reason" rows="2"></textarea></label>
        <div class="wide"><button>Lock prediction and reveal results</button> <button type="button" data-act="cancel">Cancel</button></div>
      </form>
      <p class="note">Choose your settings above first. The measured values are hidden until you lock.</p>`
      : `
      <div class="sheet">
        <p class="wide"><b>Question</b> ${esc(draft.question)}<br><b>Prediction</b> ${esc(draft.quantity)} = ${draft.predicted} ± ${draft.tolerance} ${esc(o.quantities[draft.quantity] ?? '')}, locked ${new Date(draft.id).toLocaleTimeString()}</p>
        <p class="wide" data-live></p>
        <label class="wide">Conclusion<textarea name="conclusion" rows="2" placeholder="What did you learn? What would you test next?"></textarea></label>
        <div class="wide"><button type="button" data-act="record">Record this result</button> <button type="button" data-act="cancel">Discard</button></div>
      </div>`;
    const records = mine.map((r) => `
      <article class="record">
        <b>${esc(r.question)}</b> <small>${new Date(r.id).toLocaleString()}</small>
        <p>Predicted ${esc(r.quantity)} = ${esc(r.predicted)} ± ${esc(r.tolerance)} ${esc(r.measured[2])} · measured ${esc(amount(r.measured))} · <b>${esc(judge(r))}</b></p>
        ${r.reason ? `<p><i>Why:</i> ${esc(r.reason)}</p>` : ''}${r.conclusion ? `<p><i>Conclusion:</i> ${esc(r.conclusion)}</p>` : ''}
        <p class="note">${esc(methodText(r.method))}${r.changed ? ' · settings were changed after the prediction was locked' : ''}</p>
        <button type="button" data-reopen="${r.id}">Reopen these settings</button> <button type="button" data-delete="${r.id}">Delete</button>
      </article>`).join('');
    box.innerHTML = `<h2>Lab notebook</h2>${sheet}${mine.length ? `<h3>Recorded experiments (${mine.length})</h3>${records}<button type="button" data-act="export">Download notebook as Markdown</button>` : ''}`;
    live();
  }

  function go(next) { stage = next; o.blind(next === 'predict'); render(); }

  box.onsubmit = (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    draft = { id: Date.now(), lab: o.lab, question: f.question, quantity: f.quantity, predicted: +f.predicted, tolerance: +f.tolerance, reason: f.reason, method: o.method() };
    go('measure');
  };

  box.onclick = (e) => {
    const b = e.target.closest('button[data-act], button[data-reopen], button[data-delete]');
    if (!b) return;
    const all = load();
    if (b.dataset.act === 'new') go('predict');
    else if (b.dataset.act === 'cancel') go('idle');
    else if (b.dataset.act === 'record') {
      const results = o.results(), method = o.method();
      if (!results?.[draft.quantity]) { box.querySelector('[data-live]').textContent = `Nothing to record yet. ${o.pending}`; return; }
      all.push({ ...draft, measured: results[draft.quantity], results, method, changed: JSON.stringify(method) !== JSON.stringify(draft.method), conclusion: box.querySelector('[name=conclusion]').value });
      if (!save(all)) alert('This browser blocked saving. Download the notebook to keep your record.');
      go('idle');
    } else if (b.dataset.reopen) {
      o.restore(all.find((r) => r.id === +b.dataset.reopen).method);
      root.scrollIntoView({ behavior: 'smooth' });
    } else if (b.dataset.delete && confirm('Delete this record? This cannot be undone.')) {
      save(all.filter((r) => r.id !== +b.dataset.delete));
      render();
    } else if (b.dataset.act === 'export') {
      const md = `# PhysLab notebook — ${o.lab}\n\n` + all.filter((r) => r.lab === o.lab).map((r) => [
        `## ${r.question}`, `- Date: ${new Date(r.id).toLocaleString()}`,
        `- Prediction: ${r.quantity} = ${r.predicted} ± ${r.tolerance} ${r.measured[2]}`, `- Why: ${r.reason || '—'}`,
        `- Measured: ${amount(r.measured)}`, `- Verdict: ${judge(r)}`,
        `- All results: ${Object.entries(r.results).map(([q, val]) => `${q} ${amount(val)}`).join('; ')}`,
        `- Method: ${methodText(r.method)}${r.changed ? ' (settings changed after the prediction was locked)' : ''}`,
        `- Conclusion: ${r.conclusion || '—'}`,
      ].join('\n')).join('\n\n') + '\n';
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([md], { type: 'text/markdown' })), download: `physlab-notebook-${o.lab}.md` });
      a.click();
      URL.revokeObjectURL(a.href);
    }
  };

  render();
  return { refresh: live };
}
