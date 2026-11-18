// Problem-set setups (#ps-<course>-<k>): the inputs each problem loads and where in the batch it opens.
// Shared by app.js (to load the state) and problems_check.mjs (to compute the answers from the same state).
import { STYLES } from "./model.js";
const L = STYLES.lager, A = STYLES.ale, W = STYLES.amber;
export const PS_SETUPS = {
  "250-1": { inp: { style: "lager", ...L }, at: { end: true }, view: "brewhouse", panel: "sec-sustain" },
  "255-1": { inp: { style: "lager", ...L, rest: 0 }, at: { day: 1 }, view: "ferment", cut: true },
  "310-1": { inp: { style: "lager", ...L }, at: { stage: "boil", frac: 0.5 }, view: "kettle", panel: "sec-sustain" },
  "311-1": { inp: { style: "lager", ...L, vols: 2.5 }, at: { end: true }, view: "cellar", panel: "sec-ferm" },
  "320-1": { inp: { style: "amber", ...W }, at: { stage: "lauter", frac: 0.5 }, view: "brewhouse", panel: "sec-recipe" },
  "326-1": { inp: { style: "lager", ...L, cwT: 12 }, at: { stage: "cool", frac: 0.5 }, view: "cooler", panel: "sec-sustain" },
  "426-1": { inp: { style: "ale", ...A }, at: { end: true }, view: "cellar", panel: "sec-ferm" },
  "430-1": { inp: { style: "ale", ...A, boilMin: 60 }, at: { stage: "boil", frac: 1 }, view: "kettle", panel: "sec-recipe" },
  "430-2": { inp: { style: "lager", ...L, fermT: 10, rest: 0 }, at: { day: 2 }, view: "ferment", cut: true, panel: "sec-ferm" },
  "450-1": { inp: { style: "lager", ...L, fermT: 10 }, at: { end: true }, view: "packaging", panel: "sec-sustain" },
  "470-1": { inp: { style: "lager", ...L, control: "off", rest: 0 }, at: { day: 3 }, view: "ferment", cut: true, panel: "sec-ferm" },
  "470-2": { inp: { style: "lager", ...L, rest: 3 }, at: { day: 5 }, view: "ferment", cut: true, panel: "sec-ferm" },
  "560-1": { inp: { style: "lager", ...L, rest: 0 }, at: { day: 2 }, view: "yeast", panel: "sec-now" },
  "560-2": { inp: { style: "lager", ...L, mashT: 64 }, at: { stage: "mash", frac: 1 }, view: "brewhouse", panel: "sec-recipe" },
  // design problem (Part U; one per twin): opens the starting design, not the solved one
  "560-3": { inp: { style: "lager", ...L }, at: { end: true }, view: "brewhouse", panel: "sec-recipe" },
  "int-1": { inp: { style: "amber", ...W }, at: { day: 3 }, view: "ferment", cut: true },
};
// timeline index for a setup's "at"
export function psIndex(B, at) {
  const TL = B.timeline;
  if (at.end) return TL.n - 1;
  if (at.day !== undefined) return TL.nBrew + Math.min(TL.nFerm - 1, Math.round(at.day * 48));
  if (at.stage) { const s = TL.stages.find(x => x.name === at.stage); return Math.min(TL.nBrew - 1, Math.round(s.t0 + (s.t1 - s.t0) * at.frac)); }
  return 0;
}
