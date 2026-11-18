// Problem-set set-ups (#ps-<course>-<k>): the exact model state each problem loads.
// Shared by app.js (to load the state) and problems_check.mjs (to compute the answers from the same state).
import { newColumn, restore, toSteady, DT } from "./sim.js";
import { INIT } from "./init_state.js";

// run: index of the lab-run set-up (1 = Run 2, the base case); op: operating changes applied at steady state;
// settle: plant seconds to integrate after the change; cold: start from the model's cold start instead of steady state.
export const PS_SETUPS = {
  "250-1": { run: 1, view: "feed", panel: "sec-energy", note: "Run 2 conditions at steady state" },
  "255-1": { run: 1, view: "column", panel: "sec-now", note: "Run 2 conditions at steady state" },
  "310-1": { run: 1, view: "reboiler", panel: "sec-energy", note: "Run 2 conditions at steady state" },
  "311-1": { run: 1, op: { refluxRatio: 10 }, settle: 5400, view: "column", chart: "mt", note: "reflux ratio 10, settled for 90 min" },
  "320-1": { run: 1, view: "column", panel: "sec-energy", note: "Run 2 conditions at steady state" },
  "326-1": { run: 1, view: "condenser", panel: "sec-operate", note: "Run 2 conditions at steady state" },
  "355-1": { run: 3, view: "column", chart: "prof", panel: "sec-operate", note: "Run 4, total reflux, at steady state" },
  "426-1": { run: 1, view: "column", chart: "mt", panel: "sec-operate", note: "Run 2 conditions at steady state" },
  "426-2": { run: 1, view: "tray", chart: "mt", note: "Run 2 conditions at steady state" },
  "450-1": { run: 1, view: "condenser", panel: "sec-energy", note: "Run 2 conditions at steady state" },
  "470-1": { run: 1, view: "console", panel: "sec-control", speed: 5, note: "Run 2 conditions at steady state, both loops in Manual" },
  "470-2": { run: 1, loop: "top", view: "console", panel: "sec-control", note: "Run 2 at steady state, tray 4 → reflux loop in Auto" },
  "424-1": { run: 1, cold: true, view: "overview", panel: "sec-now", speed: 60, note: "Run 2 settings from a cold start (every stage at the feed composition)" },
  "424-2": { run: 2, view: "column", chart: "prof", panel: "sec-energy", note: "Run 3 conditions at steady state" },
  "450-2": { run: 1, view: "condenser", panel: "sec-operate", note: "the starting design: Run 2 conditions at steady state" },
  "470-3": { run: 1, view: "console", panel: "sec-control", note: "the starting design: Run 2 at steady state, both loops in Manual" },
  "int-1": { run: 1, view: "overview", panel: "sec-energy", note: "Run 2 conditions at steady state" },
};
export function buildSetup(id) {
  const P = PS_SETUPS[id]; if (!P) return null;
  const c = newColumn(P.run);
  if (!P.cold) restore(c, INIT[P.run]);
  if (P.op) Object.assign(c.cfg.operation, P.op);
  if (P.settle) c.advance(P.settle, DT);
  if (P.loop) c.setLoopMode(P.loop, "auto");
  c.t = 0; return c;
}
void toSteady;
