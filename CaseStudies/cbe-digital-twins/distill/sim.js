// Shared set-up of the column model for the page (app.js) and the checks (problems_check.mjs, gen_init.mjs).
// The model itself (model/column.js, model/thermo.js) and the calibration (model/calibration.js, model/labdata.js)
// are copied unchanged from the source distillation twin.
import { Column } from "./model/column.js";
import { LAB_RUNS, LAB_META, CALIBRATION, runConfig } from "./model/calibration.js";
import * as th from "./model/thermo.js";
export { Column, LAB_RUNS, LAB_META, CALIBRATION, runConfig, th };

export const BASE_RUN = 1;                         // "Run 2": continuous feed, reflux ratio about 3.8
export const DT = 0.1;                             // s, explicit Euler step
// The standard disturbance (Part S): the feed gets weaker a short time after the page opens.
export const DISTURB = { at: 120, feedX: 0.08, label: "Feed weakens" };

export function newColumn(runIdx = BASE_RUN, patch = {}) {
  const cfg = runConfig(LAB_RUNS[runIdx]);
  // temperature loops retuned for this column (the source values were for a smaller column): see ∑ Model, Eq. (20)
  cfg.control.top = { mode: "manual", tray: 4, sp: null, Kc: 0.6, tauI: 240 };
  cfg.control.tray = { mode: "manual", tray: 5, sp: null, Kc: 1500, tauI: 300, hi: 120000 };
  Object.assign(cfg.operation, patch.op || {});
  const c = new Column(cfg); c.runIdx = runIdx; return c;
}
export const steadySeconds = runIdx => (LAB_RUNS[runIdx].totalReflux ? 1800 : 3 * 3600);
export function toSteady(c, seconds = steadySeconds(c.runIdx)) { c.advance(seconds, DT); return c; }

// compact state for instant loading
export function snapshot(c) { const r = a => Array.from(a).map(v => +v.toPrecision(9)); return { M: r(c.M), x: r(c.x), T: r(c.T), P: r(c.P), levelInt: +c.levelInt.toPrecision(9) }; }
export function restore(c, s) {
  c.M.set(s.M); c.x.set(s.x); c.T.set(s.T); c.P.set(s.P); c.levelInt = s.levelInt; c.dxdt.fill(0); c.t = 0; c.history.length = 0; c.nStep = 0;
  for (let k = 0; k < 6; k++) c.updateAlgebraic(0);
  c.ctl.tray.bias = c.cfg.operation.reboilerDuty; c.ctl.top.bias = c.cfg.operation.refluxRatio; c.ctl.tray.I = c.ctl.top.I = 0;
  return c;
}
// derived numbers used by readouts, takeaways and problems
export function summary(c) {
  const N = c.N, b = c.balances(), op = c.cfg.operation, hy = c.hyd.slice(1, N + 1);
  const Dlph = c.toLph(c.D, c.x[0], 298.15), Blph = c.toLph(c.B, c.x[N + 1], 298.15);
  const flood = Math.max(...hy.map(h => h.flood || 0)), weep = Math.max(...hy.map(h => h.weep || 0));
  return { N, xD: c.x[0], xB: c.x[N + 1], abvD: th.abv(c.x[0]), Dlph, Blph, D: c.D, B: c.B, F: b.F, zF: op.feedX, Ttop: c.T[1] - 273.15, Tbot: c.T[N + 1] - 273.15,
    recovery: b.ethRecovery, Qr: b.Qr, Qc: b.Qc, Qloss: b.Qloss, Qpre: b.Qpre, flood, weep, floodTray: 1 + hy.findIndex(h => (h.flood || 0) === flood), dP: c.P[N + 1] - c.P[1], vent: c.vent, V1: c.V[1],
    L0: c.L[0], L1: c.L[1], level: c.reboilerLevel, kWhPerL: Dlph > 0.01 ? b.Qr / 1000 / Dlph : Infinity, massErr: b.massIn > 0 ? (b.massIn - b.massOut) / b.massIn : 0, energyErr: (b.energyIn - b.energyOut) / b.energyIn, R: op.refluxRatio };
}
