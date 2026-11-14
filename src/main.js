import collider from './labs/collider.js';
import exoplanets from './labs/exoplanets.js';
import orbits from './labs/orbits.js';
import quantum from './labs/quantum.js';
import neuron from './labs/neuron.js';
import bench from './labs/bench.js';
import { home, validation, notebookPage } from './pages.js';

// To add an experiment: write a module exporting { id, field, title, blurb, mount(root) } and list it here.
// mount may return { draw, stop }: draw is called on resize/theme change, stop when leaving the page.
const labs = [collider, exoplanets, orbits, quantum, neuron];
const pages = [home(labs), ...labs, bench, notebookPage, validation];

const nav = document.getElementById('nav'), host = document.getElementById('lab');
nav.innerHTML = pages.map((p) => `<a href="#${p.id}"><small>${p.field}</small>${p.title}</a>`).join('');

let current, visit = 0;
async function route() {
  current?.stop?.();
  current = null;
  document.getElementById('tip').hidden = true;
  const page = pages.find((p) => '#' + p.id === location.hash) ?? pages[0], mine = ++visit;
  for (const a of nav.children) a.hash === '#' + page.id ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current');
  document.title = page.id === 'home' ? 'PhysLab — open-data physics workbench' : `${page.title} — PhysLab`;
  const root = document.createElement('section'); // a slow mount that lost the race draws into a detached node
  root.innerHTML = `<h1>${page.title}</h1><p class="blurb">${page.blurb}</p>`;
  host.replaceChildren(root);
  scrollTo(0, 0);
  let handle;
  try { handle = await page.mount(root); } catch (e) { root.insertAdjacentHTML('beforeend', `<p class="note">⚠ ${e.message}</p>`); }
  if (mine === visit) current = handle; else handle?.stop?.();
}

const redraw = () => current?.draw?.();
addEventListener('hashchange', route);
new ResizeObserver(redraw).observe(host); // also catches a scrollbar appearing, which fires no window resize
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', redraw);
route();
