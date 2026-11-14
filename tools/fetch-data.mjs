// Refreshes the snapshots in data/. Neither CERN Open Data nor the NASA Exoplanet Archive
// sends CORS headers, so the browser cannot fetch them directly — we keep trimmed copies.
import { writeFile, mkdir } from 'node:fs/promises';
import { pairMass } from '../src/physics/kinematics.js';

const out = new URL('../data/', import.meta.url);
await mkdir(out, { recursive: true });

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return res.text();
}

// CMS dimuon events, Run2011A (CERN Open Data record 545). Keep only what the mass calculation needs.
// We keep the Cartesian momenta, not pt/eta/phi: for about 5% of events the file's pt/eta/phi columns disagree
// with its own px/py/pz, and only the Cartesian values reproduce the published mass column.
const KEEP = ['px1', 'py1', 'pz1', 'Q1', 'px2', 'py2', 'pz2', 'Q2'];
const lines = (await get('https://opendata.cern.ch/record/545/files/Dimuon_DoubleMu.csv')).trim().split(/\r?\n/);
const head = lines[0].split(',');
const idx = KEEP.map((c) => head.indexOf(c));
if (idx.includes(-1) || lines.length < 1000) throw new Error('CMS file layout changed — not overwriting data/dimuon.csv');
await writeFile(new URL('dimuon.csv', out), lines.map((l) => { const c = l.split(','); return idx.map((i) => c[i]).join(','); }).join('\n'));
// Cross-check before the published mass column is dropped: our formula against CMS's own value for every event.
const mCol = head.indexOf('M');
const diffs = lines.slice(1).map((l) => { const c = l.split(','), [px1, py1, pz1, , px2, py2, pz2] = idx.map((i) => +c[i]); return Math.abs(pairMass(px1, py1, pz1, px2, py2, pz2) - +c[mCol]); }).sort((a, b) => a - b);
const meta = {
  fetched: new Date().toISOString().slice(0, 10), events: diffs.length, source: 'https://opendata.cern.ch/record/545',
  medianMassDifferenceGeV: +diffs[diffs.length >> 1].toPrecision(3), maxMassDifferenceGeV: +diffs.at(-1).toPrecision(3),
  shareWithin10MeV: diffs.filter((d) => d <= 0.01).length / diffs.length,
};
await writeFile(new URL('dimuon.meta.json', out), JSON.stringify(meta));
console.log('dimuon.csv:', JSON.stringify(meta));

// NASA Exoplanet Archive, Planetary Systems Composite Parameters table.
const COLS = ['pl_name', 'pl_orbper', 'pl_orbsmax', 'pl_bmasse', 'pl_rade', 'discoverymethod', 'disc_year', 'sy_dist', 'st_mass'];
const tap = `https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=select+${COLS.join(',')}+from+pscomppars&format=json`;
const planets = JSON.parse(await get(tap));
if (!Array.isArray(planets) || planets.length < 1000) throw new Error('Unexpected NASA response — not overwriting data/exoplanets.json');
await writeFile(new URL('exoplanets.json', out), JSON.stringify({
  fetched: new Date().toISOString().slice(0, 10),
  cols: COLS,
  rows: planets.map((p) => COLS.map((c) => p[c])),
}));
console.log(`exoplanets.json: ${planets.length} planets`);
