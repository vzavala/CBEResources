// Calibration against the lab runs (copied from the source twin's src/model/calibration.js; JSON imports replaced by labdata.js).
import { DEFAULT_CONFIG, cloneConfig } from './config.js';
import { bubbleT } from './thermo.js';
import { LAB, FIT } from './labdata.js';

export const LAB_RUNS = LAB.runs;
export const LAB_META = LAB.meta;
export const CALIBRATION = FIT;

export function labGeometry(fit = FIT) {
  const c = LAB.meta.column;
  return {
    ...cloneConfig(DEFAULT_CONFIG).geometry,
    nTrays: c.nTrays, diameter: c.diameter_m, traySpacing: c.traySpacing_m, weirHeight: c.weirHeight_m,
    holeDiameter: fit.holeDiameter, holeAreaFrac: fit.holeAreaFrac, floodFactor: fit.floodFactor,
    shellHeight: (c.nTrays + 1) * c.traySpacing_m, reboilerVolume: fit.reboilerVolume,
  };
}
// Model configuration that reproduces one lab run. p overrides: { duty (W), E, Estrip, z0 }
export function runConfig(run, p = {}, fit = FIT) {
  const cfg = cloneConfig(DEFAULT_CONFIG);
  const c = LAB.meta.column;
  const rf = fit.runs?.[run.name] || {};
  cfg.geometry = labGeometry(fit);
  const P = (run.Pamb_kPa || 101.325) * 1000;
  const xD = run.xD ?? 0.63;
  const Tbub = bubbleT(xD, P).T;
  Object.assign(cfg.operation, {
    feedFlowLph: run.totalReflux ? 0 : run.feedLpm * 60,
    feedX: run.totalReflux ? (p.z0 ?? rf.z0 ?? 0.05) : run.xF,
    feedT: run.TF != null ? run.TF + 273.15 : 323.15,
    feedTray: c.feedTray,
    reboilerDuty: p.duty ?? rf.duty ?? 50000,
    refluxRatio: run.totalReflux ? 1e4 : run.L0 / run.D,
    topPressure: P,
    refluxSubcool: Math.max(0, Tbub - (run.Treflux + 273.15)),
    coolingWaterLpm: (run.CWkgps || 0.25) * 60,
    coolingWaterT: (run.CWin ?? 13) + 273.15,
    condenserUA: fit.condenserUA,
    ambientT: 20.56 + 273.15,
    insulated: false,
    efficiencyMode: 'fixed',
    murphreeFixed: p.E ?? fit.E_rect,
    murphreeStrip: p.Estrip ?? fit.E_strip,
    reboilerLevelSP: 0.6,
  });
  cfg.control.level = { mode: 'auto', Kc: Math.max(0.5, 2 * (run.F || 0)), tauI: 300, bias: Math.max(0, (run.F || 0) - (run.D || 0)), Bmax: Math.max(0.5, 4 * (run.F || 0)) };
  cfg.heatLoss = { hBare: c.Un_Wm2K, hInsulated: c.Un_Wm2K, wallAreaPerTray: c.An_m2, rebUA: c.Ureb_Wm2K * c.Areb_m2 };
  return cfg;
}
