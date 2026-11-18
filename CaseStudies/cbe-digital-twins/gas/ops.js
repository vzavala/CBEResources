// Demand logic, stepping and problem-set setups shared by the page (index.html) and problems_check.mjs.
// No browser dependencies, so the numbers in problems.json come from exactly the same code the page runs.
import { MMSCMd_to_kgs, kgs_to_MMSCMd } from "./sim.js";
import { CUSTOMERS, demandOf, sizeOf } from "./customers.js";
import { LHV_MIX_ } from "./gasprops.js";

export const DT = 300;   // s; the paper uses 1800 s, finer steps animate smoothly (validated at both)

// requested demand at time t: per customer (kg/s) and per node. "customers" spreads deliveries along the
// line with daily profiles; the paper scenarios put all demand at node 13 as in Fig. 1.
export function demandsAt(ctrl, t) {
  const h = (t / 3600) % 24, byCust = CUSTOMERS.map(() => 0), byNode = {};
  const stepF = { high: 1.3, medium: 1.2, low: 1.1 }[ctrl.scen];
  if (stepF) {
    const q = MMSCMd_to_kgs(ctrl.dNom) * (h >= 9.5 && h < 14.5 ? stepF : 1);
    byCust[CUSTOMERS.findIndex(c => c.node === 13)] = q; byNode.n13 = q;
  } else {
    // a cold front is regional: during the cold snap every town and the metro also heat more (weather factor
    // rises about 0.05 per degree below the normal -2 C winter mean)
    const wx = ctrl.wx + (t < ctrl.ev.cold ? 0.6 : 0) + (ctrl.snap && ctrl.snap.on ? Math.max(0, -2 - outdoorT(ctrl.snap, t)) * 0.05 : 0);
    CUSTOMERS.forEach((c, k) => {
      let q = demandOf(c, h, wx);
      // "every home on the line" turns its thermostats too: scale the other towns' heating with the same
      // steady heat balance (no thermal mass for them), relative to a 21 C set-point
      if (ctrl.snap && ctrl.snap.on && ctrl.snap.all && (c.kind === "town" || c.kind === "metro") && c.id !== CITY.cust) {
        const To = outdoorT(ctrl.snap, t), gas = sp => CITY.UA * Math.max(0, sp - To) / CITY.eta + hotWaterKW(t);
        q *= gas(setpointAt(ctrl.snap, t)) / gas(21);
      }
      if (c.kind === "peaker" && t < ctrl.ev.peaker) q = sizeOf(c);
      if (c.kind === "ammonia" && t < ctrl.ev.nh3) q = 0;
      byCust[k] = MMSCMd_to_kgs(q); byNode["n" + c.node] = (byNode["n" + c.node] || 0) + byCust[k];
    });
    if (ctrl.snap && ctrl.snap.on) {          // the Madison-size city replaces Millbrook's simple profile
      const g = cityGas(ctrl.snap, t, LHV_MIX_), k = CUSTOMERS.findIndex(c => c.id === CITY.cust), nk = "n" + CITY.node;
      byNode[nk] += g.homes + g.plants - byCust[k]; byCust[k] = g.homes;
      return { byCust, byNode, total: byCust.reduce((a, b) => a + b, 0) + g.plants, city: g };
    }
  }
  return { byCust, byNode, total: byCust.reduce((a, b) => a + b, 0) };
}
// set the model's demand; returns per-customer flows actually taken
export function applyDemand(sim, ctrl, t, scale) {
  const D = demandsAt(ctrl, t), d = {};
  for (const k in D.byNode) d[k] = D.byNode[k] * scale;
  sim.demand = d; return D.byCust.map(v => v * scale);
}
// customers scenario: stations hold a discharge set-point (how lines are run); paper scenarios: fixed 2 bar boosts
export function compDefaults(sim, ctrl) { sim.comps.forEach(c => { c.boost = 2.0; c.pset = ctrl.pset ?? 56; c.mode = ctrl.scen === "customers" ? "pset" : "boost"; }); }
// one time step with soft demand curtailment when the line cannot carry it (demands are soft in the paper)
export function advanceStep(sim, ctrl, st) {
  const t = sim.t + DT, sn = ctrl.snap && ctrl.snap.on ? ctrl.snap : null;
  if (sn) cityStep(sn, t, DT, st.curtail);
  sim.thetaSupply = ctrl.ps;
  // cold snap: the supply plant can only send so much (processing and contract capacity). Above the limit its
  // outlet pressure sags (about 6 bar/h per 10 % over); below it, the pressure recovers at 1 bar/h.
  if (sn && sn.cap) {
    if (sn.pSup === undefined) sn.pSup = ctrl.ps;
    const q = kgs_to_MMSCMd(sim.supplyFlow), over = (q - sn.cap) / sn.cap;
    sn.pSup = over > 0 ? sn.pSup - 60 * over * DT / 3600 : Math.min(ctrl.ps, sn.pSup + DT / 3600);
    sn.pSup = Math.max(30, sn.pSup); sim.thetaSupply = sn.pSup;
  }
  st.curtail = Math.min(1, st.curtail + 0.02);
  for (let k = 0; k < 14; k++) {
    st.cust = applyDemand(sim, ctrl, t, st.curtail);
    const it = sim.step(DT);
    if (it >= 0) { st.iters = it; break; }
    st.curtail *= 0.92;
    if (k === 13) { sim.t = t; break; }
  }
  st.shed = st.curtail < 0.999;
}
export function resetSim(sim, ctrl, st) {
  sim.thetaSupply = ctrl.ps;
  if (ctrl.snap && ctrl.snap.on) { cityInit(ctrl.snap); ctrl.snap.pSup = ctrl.ps; }
  st.cust = applyDemand(sim, ctrl, 0, 1);
  sim.t = 0; st.curtail = 1; ctrl.ev = { peaker: -1, nh3: -1, cold: -1 };
  return sim.initSteady();
}

// problem-set setups: #ps=<course>-<k> (also #ps-<course>-<k>). hours = model time to run to, then pause.
export const PS = {
  "150-1": { scen: "customers", wx: 1.0, hours: 8, view: "overview" },
  "250-1": { scen: "customers", wx: 1.0, hours: 18, view: "ccgt" },
  "250-2": { scen: "customers", wx: 1.4, hours: 24, view: "overview" },
  "255-1": { scen: "customers", wx: 1.0, hours: 0, view: "cutaway" },
  "310-1": { scen: "high", hours: 0, view: "station" },
  "311-1": { scen: "customers", wx: 1.0, hours: 8, view: "supply" },
  "320-1": { scen: "customers", wx: 1.0, hours: 12, view: "overview" },
  "326-1": { scen: "high", hours: 0, view: "river" },
  "326-2": { scen: "high", hours: 0, view: "station" },
  "355-1": { scen: "customers", wx: 1.0, hours: 24, view: "overview" },
  "426-1": { scen: "customers", wx: 1.8, hours: 19, view: "station" },
  "430-1": { scen: "customers", wx: 1.0, hours: 10, view: "ammonia" },
  "440-1": { scen: "high", hours: 0, view: "river" },
  "450-1": { scen: "customers", wx: 1.8, hours: 17, view: "station" },
  "470-1": { scen: "customers", wx: 1.0, hours: 1, view: "peaker", ev: { peaker: 3 } },
  "470-2": { scen: "high", hours: 0, view: "overview" },
  "512-1": { scen: "customers", wx: 1.0, hours: 18, view: "overview" },
  // integrative case study: one operating point (cold evening peak) seen through five courses
  "int-1": { scen: "customers", wx: 1.4, hours: 18, view: "station" },
  // Part U design problems: open in the starting design with its day already run (Last 24 h readout filled)
  "450-2": { scen: "customers", wx: 1.4, hours: 24, view: "station" },
};
export function parsePS(hash) { const m = /^#ps[=-](\d{3}|int)-(\d+)$/.exec(hash || ""); return m && PS[`${m[1]}-${m[2]}`] ? `${m[1]}-${m[2]}` : null; }
// controller settings for a setup (shared by the page and the check script)
export function psCtrl(cfg) { return { scen: cfg.scen, wx: cfg.wx ?? 1.0, dNom: 10, ps: 57, pset: cfg.pset ?? 56, ev: { peaker: -1, nh3: -1, cold: -1 } }; }
// apply events relative to the setup time (hours after the pause point)
export function psEvents(ctrl, cfg, tNow) { for (const [k, h] of Object.entries(cfg.ev || {})) ctrl.ev[k] = tNow + h * 3600; }

// ---------- Cold snap in a Madison-size city (Millbrook, node 9) ----------
// 250 000 people in about 110 000 homes (2.3 people per home). Each home is one lumped heat balance:
//   C dT_in/dt = Q_furnace - UA (T_in - T_out),  gas = Q_furnace / eta_furnace + water heating and cooking
// with Typical single-family values (assumed): UA = 0.25 kW/K, C = 25 MJ/K (time constant C/UA about 28 h),
// furnace 24 kW, 92 % efficient. The thermostat adds heat to hold its set-point and can only give Q_max, so after a
// night setback every furnace runs flat out at once in the morning (cold-load pickup).
// Gas power plants sized like Madison's (MGE): a 150 MW campus cogeneration plant (two gas turbines + steam
// turbine, like the West Campus Cogeneration Facility), a 100 MW gas-fired station (like Blount), and about 75 MW of
// small peaking combustion turbines (like Fitchburg and Nine Springs). Fuel use: 150/0.45, 100/0.31, 75/0.30 MW (assumed efficiencies).
export const CITY = {
  people: 250000, homes: 110000, node: 9, cust: "townB",
  UA: 0.25, C: 25000, Qmax: 24, eta: 0.92, hotKW: 0.45,
  plants: [
    { id: "chp", name: "Campus cogeneration, 150 MW", like: "MGE West Campus Cogeneration Facility", MW: 150, eff: 0.45 },
    { id: "steam", name: "Gas-fired station, 100 MW", like: "MGE Blount Generating Station", MW: 100, eff: 0.31 },
    { id: "ct", name: "Peaking turbines, 75 MW", like: "MGE Fitchburg and Nine Springs turbines", MW: 75, eff: 0.30 },
  ],
};
export const SNAP_LEVELS = [["Chilly front (lows −12 °C)", 8], ["Hard freeze (lows −22 °C)", 18], ["Polar vortex (lows −32 °C)", 28]];
const sgm = x => 1 / (1 + Math.exp(-x));
// outdoor temperature, °C: a winter day (mean −2 °C, ±4 °C, coldest at 06:00), then a front arrives at hour 30
// and leaves at hour 72 (snap.drop °C colder at its depth)
export function outdoorT(snap, t) {
  const h = t / 3600, day = -2 + 4 * Math.sin(2 * Math.PI * (h - 12) / 24);
  return day - snap.drop * (sgm((h - snap.start) / 2.5) - sgm((h - snap.end) / 5));
}
// night setback of 3 C from 23:00; households wake between about 05:00 and 07:30, so the city-wide set-point
// comes back as a ramp rather than a step (diversity)
export function setpointAt(snap, t) { const hd = (t / 3600) % 24; if (!snap.setback) return snap.tset;
  const down = Math.min(1, Math.max(0, (hd >= 12 ? hd - 23 : hd + 1) / 1)), up = Math.min(1, Math.max(0, (hd - 5) / 2.5));
  return snap.tset - 3 * (hd >= 12 ? down : (1 - up)); }
// furnace output the thermostat asks for (kW per home): hold the set-point, recover within about 30 min, never above Q_max
export function furnaceKW(snap, t, Tin) {
  const Tout = outdoorT(snap, t), Tsp = setpointAt(snap, t);
  return Math.min(CITY.Qmax, Math.max(0, CITY.UA * (Tsp - Tout) + CITY.C * (Tsp - Tin) / 3600));
}
export function hotWaterKW(t) { const hd = (t / 3600) % 24, b = (c, w) => Math.exp(-0.5 * ((((hd - c) % 24) + 36) % 24 - 12) ** 2 / (w * w)); return CITY.hotKW * (0.45 + 0.9 * b(7, 1.3) + 0.8 * b(19, 1.8)); }
// power plant fuel (MW of fuel) for the hour and the weather: cold raises electric demand (heat pumps, block heaters,
// lighting) so the peaking units start in the coldest daytime hours
export function plantFuelMW(snap, t) {
  const hd = (t / 3600) % 24, Tout = outdoorT(snap, t), day = hd >= 6 && hd < 22, peak = (hd >= 7 && hd < 10) || (hd >= 16 && hd < 21);
  const out = {};
  for (const p of CITY.plants) {
    let load = 0;
    if (p.id === "chp") load = day ? 1 : 0.7;                          // must-run: it heats and cools the campus
    if (p.id === "steam") load = Tout < -8 && day ? 1 : 0;
    if (p.id === "ct") load = Tout < -14 && peak ? 1 : 0;
    out[p.id] = load * p.MW / p.eff;
  }
  return out;
}
// one model step of the homes' heat balance (explicit Euler is fine: dt = 300 s << C/UA = 28 h).
// Only the gas actually delivered heats the homes, so a curtailed line makes them cooler.
export function cityStep(snap, t, dt, delivered = 1) {
  const Tout = outdoorT(snap, t), Q = furnaceKW(snap, t, snap.Tin) * delivered;
  snap.Tin += dt * (Q - CITY.UA * (snap.Tin - Tout)) / CITY.C; snap.Q = Q; snap.Tout = Tout;
}
export function cityInit(snap) { snap.Tin = setpointAt(snap, 0); snap.Q = furnaceKW(snap, 0, snap.Tin); snap.Tout = outdoorT(snap, 0); }
// gas, kg/s: homes (furnaces + water heating) and the plants
export function cityGas(snap, t, LHV) {
  const Q = furnaceKW(snap, t, snap.Tin), homes = CITY.homes * (Q / CITY.eta + hotWaterKW(t)) / (LHV * 1000);
  const pf = plantFuelMW(snap, t), plants = Object.values(pf).reduce((a, b) => a + b, 0) * 1000 / (LHV * 1000);
  return { homes, plants, byPlant: Object.fromEntries(Object.entries(pf).map(([k, v]) => [k, v / LHV])) };
}
