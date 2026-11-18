// Problem-set setups for the Pastillation Line Digital Twin.
// The app reads #ps-<course>-<k> (or the older #ps=<course>-<k>) and calls applySetup() on its live
// simulator; problems_check.mjs calls the same function under node, so every numeric answer in
// problems.json is computed from exactly the state a student sees.
import { DEFAULTS, FIG3A_CLOG, mulberry32 } from "./sim.js";

export const T_AMB = 72;
export const PROFILES = {
  fig3a: FIG3A_CLOG.map(p => 1 - p),    // deposit probability = 1 - clog probability (Fig. 3a)
  none: new Array(32).fill(1),           // every nozzle fires: fully deterministic
  uniform: new Array(32).fill(0.8),
};

const CODE_GAINS = { kp: DEFAULTS.Kp, ti: DEFAULTS.tI, td: DEFAULTS.td };
const base = { sp: 86, ...CODE_GAINS, mode: "manual", speed: 2, profile: "none", seed: null, events: [], view: "belt", thermal: false, fold: [] };

// steps: how many 0.5 s steps to run from a cold belt (all cells at 72 °F) before pausing.
export const PS = {
  "250-1": { ...base, profile: "fig3a", seed: 250, speed: 2, steps: 600, view: "roto", fold: ["sec-clogs"] },
  "255-2": { ...base, speed: 2, steps: 1, view: "camera", thermal: true },
  "320-1": { ...base, speed: 2, steps: 600, view: "belt", thermal: true },
  "320-2": { ...base, speed: 6, steps: 600, view: "sprays", thermal: true },
  "326-1": { ...base, speed: 3, steps: 600, view: "sprays" },
  "355-1": { ...base, profile: "fig3a", seed: 355, speed: 2, steps: 400, view: "roto", fold: ["sec-clogs"] },
  "450-1": { ...base, speed: 6, steps: 600, view: "discharge" },
  // design problem (Part U): starts from a design that fails the spec (fouled drop former, belt too fast)
  "450-2": { ...base, profile: "fig3a", seed: 450, speed: 8, steps: 800, view: "discharge", fold: ["sec-control", "sec-clogs"] },
  "470-1": { ...base, speed: 4, steps: 600, view: "belt", fold: ["sec-control"] },
  "470-2": { ...base, mode: "pid", sp: 86, steps: 800, view: "belt", fold: ["sec-control"] },
  // integrative case study: one operating point with the plant's clog pattern, used by six courses in turn
  "int-1": { ...base, profile: "fig3a", seed: 2026, speed: 6, steps: 600, view: "overview", fold: ["sec-control", "sec-clogs"] },
};

export function parsePsHash(hash) {
  const m = /^#ps[-=](\d{3}|int)-(\d+)$/.exec(hash || "");
  return m ? `${m[1]}-${m[2]}` : null;
}

// Put `sim` in the setup's state: parameters, cold start, then run `steps` steps (with any events).
export function applySetup(sim, S) {
  sim.depositProb = PROFILES[S.profile].slice();
  sim.rand = S.seed == null ? Math.random : mulberry32(S.seed);
  sim.Tsp = S.sp - T_AMB;
  sim.Kp = S.kp; sim.tI = S.ti; sim.td = S.td;
  sim.mode = S.mode;
  sim.manualSpeed = S.speed;
  sim.uBar = S.mode === "manual" ? S.speed : DEFAULTS.uBar;
  sim.reset();
  for (let n = 0; n < S.steps; n++) {
    for (const ev of S.events || []) if (ev.at === n) {
      if (ev.sp != null) sim.Tsp = ev.sp - T_AMB;
      if (ev.speed != null) sim.manualSpeed = ev.speed;
      if (ev.mode) sim.mode = ev.mode;
    }
    sim.step();
  }
  return sim;
}
