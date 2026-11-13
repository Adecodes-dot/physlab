import collider from './labs/collider.js';
import exoplanets from './labs/exoplanets.js';
import orbits from './labs/orbits.js';
import quantum from './labs/quantum.js';
import neuron from './labs/neuron.js';

// To add an experiment: write a module exporting { id, field, title, blurb, mount(root) } and list it here.
// mount may return { draw, stop }: draw is called on resize/theme change, stop when leaving the lab.
const labs = [collider, exoplanets, orbits, quantum, neuron];

const nav = document.getElementById('nav'), host = document.getElementById('lab');
nav.innerHTML = labs.map((l) => `<a href="#${l.id}"><small>${l.field}</small>${l.title}</a>`).join('');

let current, visit = 0;
async function route() {
  current?.stop?.();
  current = null;
  document.getElementById('tip').hidden = true;
  const lab = labs.find((l) => '#' + l.id === location.hash) ?? labs[0], mine = ++visit;
  for (const a of nav.children) a.hash === '#' + lab.id ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current');
  const root = document.createElement('section'); // a slow mount that lost the race draws into a detached node
  root.innerHTML = `<h1>${lab.title}</h1><p class="blurb">${lab.blurb}</p>`;
  host.replaceChildren(root);
  let handle;
  try { handle = await lab.mount(root); } catch (e) { root.insertAdjacentHTML('beforeend', `<p class="note">⚠ ${e.message}</p>`); }
  if (mine === visit) current = handle; else handle?.stop?.();
}

const redraw = () => current?.draw?.();
addEventListener('hashchange', route);
addEventListener('resize', redraw);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', redraw);
route();
