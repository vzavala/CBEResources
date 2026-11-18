// Problem-set setups: the state each problem loads with #ps=<course>-<k>.
// Shared by the app (index.html) and problems_check.mjs, so the answers are computed from exactly this state.
// Any field left out keeps the app default: 70 kg, 4:00 /km, SC-EVA at 130 kg/m3, no plate, new shoe,
// N2 at 20 MPa and 135 C.
export const DEFAULTS = { mass: 70, paceS: 240, foam: "SCEVA", rho: 130, plate: false, miles: 0, gas: "N2", P: 20, Tc: 135 };

export const SETUPS = {
  "150-1": { view: "shoe", open: ["sec-results", "sec-run"] },
  "250-1": { gas: "N2", P: 20, Tc: 135, view: "factory", open: ["sec-factory"] },
  "255-1": { view: "shoe", open: ["sec-run", "sec-results"] },
  "255-2": { gas: "N2", P: 15, Tc: 135, view: "factory", open: ["sec-factory"] },
  "310-1": { gas: "CO2", P: 10, Tc: 135, view: "factory", open: ["sec-factory"] },
  "311-1": { gas: "CO2", P: 15, Tc: 110, view: "factory", open: ["sec-factory"] },
  "320-1": { gas: "N2", P: 20, Tc: 135, view: "factory", open: ["sec-factory"] },
  "426-1": { gas: "CO2", P: 15, Tc: 135, view: "factory", open: ["sec-factory"] },
  "440-1": { foam: "SCEVA", rho: 100, view: "cutaway", open: ["sec-shoe", "sec-results"] },
  "440-2": { view: "cutaway", open: ["sec-results", "sec-shoe"] },
  "450-1": { mass: 90, paceS: 300, view: "shoe", open: ["sec-run", "sec-shoe", "sec-results"] },
  "470-1": { view: "shoe", open: ["sec-run", "sec-results"] },
  "470-2": { foam: "EVA", rho: 200, view: "shoe", open: ["sec-shoe", "sec-results"] },
  "540-1": { view: "chains", open: ["sec-shoe", "sec-results"] },
  "547-1": { gas: "N2", P: 10, Tc: 135, view: "cells", open: ["sec-factory"] },
  "540-2": { view: "shoe", open: ["sec-dist", "sec-results"] },
  "440-3": { mass: 85, paceS: 270, foam: "SCEVA", rho: 130, plate: false, miles: 0, view: "shoe", open: ["sec-run", "sec-shoe", "sec-results", "sec-dist"] },
  "450-2": { gas: "N2", P: 20, Tc: 135, view: "factory", open: ["sec-factory"] },
  "int-1": { gas: "N2", P: 20, Tc: 135, view: "factory", open: ["sec-factory", "sec-shoe", "sec-dist"] },
};

export const setupState = k => ({ ...DEFAULTS, ...Object.fromEntries(Object.entries(SETUPS[k] || {}).filter(([f]) => f in DEFAULTS)) });
