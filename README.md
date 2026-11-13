# PhysLab

An open-data physics workbench that runs in the browser. Explore real measurements from CERN and NASA, run simulations, change the parameters and watch what happens.

It is built for learning and for practising how research is done: make a cut, bin the data, compare with a reference value, check that a simulation conserves what it should.

## Labs

| Lab | Field | What it does | Source |
|---|---|---|---|
| Dimuon mass spectrum | Particle physics | Computes the invariant mass of 100,000 real muon pairs and histograms them. J/ψ, ψ(2S), Υ and Z show up as peaks. Includes an event display with tracks curving in the 3.8 T field. | CMS open data |
| Exoplanet census | Astrophysics | Scatter any two properties of ~6,500 confirmed exoplanets, coloured by discovery method. Checks Kepler's third law against the data. | NASA Exoplanet Archive |
| Gravity sandbox | Astrophysics | N-body gravity with a choice of integrator and a live energy-drift readout. | Simulation |
| Wave packet and barrier | Quantum physics | Solves the time-dependent Schrödinger equation; shows tunnelling and compares it with the textbook formula. | Simulation |
| Nerve impulse | Biophysics | Hodgkin–Huxley neuron with adjustable current and ion-channel block. | Simulation |

## Run it

Needs [Node.js](https://nodejs.org) 20.11 or newer. There is nothing to install.

```bash
npm start
```

Then open http://localhost:5200.

Any static file server works too, because the app is plain HTML, CSS and JavaScript modules with no build step.

```bash
npm test
```

runs the physics self-checks: the mass calculation reproduces the value CMS published for the same event, the orbit integrator conserves energy, the quantum solver conserves probability and matches the analytic tunnelling rate, and the neuron fires only when driven.

## Data

Neither CERN Open Data nor the NASA Exoplanet Archive allows direct requests from a web page, so trimmed snapshots live in `data/`. Refresh them with:

```bash
npm run data
```

- **`data/dimuon.csv`** — CMS collaboration, *Dimuon events from Run2011A*, [CERN Open Data record 545](https://opendata.cern.ch/record/545), released under CC0. This is an education and outreach subset. It is not suitable for a physics result.
- **`data/exoplanets.json`** — [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/), Planetary Systems Composite Parameters table. This research has made use of the NASA Exoplanet Archive, which is operated by the California Institute of Technology, under contract with the National Aeronautics and Space Administration under the Exoplanet Exploration Program.
- Reference particle masses are from the Particle Data Group.

PhysLab is an independent project. It is not affiliated with or endorsed by CERN, the CMS collaboration or NASA.

## Add an experiment

Each lab is one file in `src/labs/` that exports `{ id, field, title, blurb, mount(root) }`. Put the physics in a pure function under `src/physics/` so it can be tested, then add the lab to the list in `src/main.js`. `src/kit.js` has the controls, stat tiles and plotting helpers.

## Known limits

- The simulations use simplified setups: planar circular starting orbits, one spatial dimension for the quantum lab, a single-compartment neuron.
- The event display draws tracks inside the solenoid only and ignores the reversed field outside it.
- Histogram peaks are read from the tallest bin. There is no curve fitting yet.
- Charts have hover read-outs but no table view of the underlying numbers.

## Licence

Code: MIT, see `LICENSE`. Data: see the sources above.
