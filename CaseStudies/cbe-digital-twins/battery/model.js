// One evaluation of the whole application model for a given state S: cell cycle, aging, life-cycle footprint and
// end of life. Used by the page (app.js) and by problems_check.mjs, so problem answers come from the same code.
import { CELLS, cycle, aging, derive, ocvAt } from "./cell.js";
import { lca, recycling } from "./lca.js";

export const DEF = { chem: "NMC", C: 1, Tamb: 25, dod: 0.8, cycles: 1500, li: "brine", gridF: 528, gridU: 384, route: "hydro" };

export function meanOCV(chem) { let s = 0; const n = 50; for (let i = 0; i < n; i++) s += ocvAt(chem, (i + 0.5) / n); return s / n; }

export function evaluate(S, opts = {}) {
  const d = derive(S.chem);
  const CYC = cycle({ ch: S.chem, C: S.C, TambC: S.Tamb, dod: S.dod, profiles: !!opts.profiles });
  const AG = aging(S.chem, S.cycles, CYC, S.dod, S.Tamb);
  const capLeft = 1 - AG.frac;
  // energy delivered over life: each cycle delivers Eout scaled by the capacity left (average over life ≈ midpoint)
  const lifeWh = S.cycles * CYC.Eout / 3600 * (1 + capLeft) / 2;   // Wh per cell over its life
  const ocv = meanOCV(S.chem);
  const nomWh = d.Q * ocv;                                          // Wh per cell when new
  const L = lca({ ...S, nomWh, lifeWh, eff: CYC.eff, capLeft });
  const RC = recycling(S.route, S.chem, nomWh);
  return { CYC, AG, L, RC, capLeft, lifeWh, nomWh, ocv, Q: d.Q, cell: CELLS[S.chem] };
}
