// Problem-set setups: the exact model state each problem starts from. The app applies one when the page is opened
// with #ps=<course>-<k> (or #ps-<course>-<k>), and problems_check.mjs computes every numeric answer from the same state.
// All setups switch the daily temperature and tide swing off so the plant settles to a reproducible steady state.
export const PS_BASE = { S: 35, T: 22, rec: 45, flux: 14, etaERD: 96, etaPump: 85, age: 2, foul: 5, pH: 8.0, erd: true, swing: false };
export const PS = {
  "150-1": { inp: {}, view: "overview", open: ["secKpi", "secEvery"] },
  "250-1": { inp: { rec: 50 }, view: "ro", open: ["secKpi", "secScale"] },
  "255-1": { inp: { T: 25 }, view: "ro", open: ["secVessel"], lens: ["CBE 426", 0] },
  "310-1": { inp: {}, view: "ro", open: ["secEnergy"], lens: ["CBE 310", 0] },
  "311-1": { inp: { T: 25 }, view: "ro", open: ["secVessel"], lens: ["CBE 311", 0] },
  "311-2": { inp: { pH: 8.0 }, view: "ro", open: ["secKpi", "secTrends"], lens: ["CBE 311", 2] },
  "320-1": { inp: {}, view: "outfall", open: ["secKpi"], lens: ["CBE 320", 1] },
  "326-1": { inp: {}, view: "intake", open: ["secEnergy"], lens: ["CBE 326", 0] },
  "426-1": { inp: {}, view: "ro", open: ["secVessel"], lens: ["CBE 426", 0] },
  "426-2": { inp: {}, view: "ro", open: ["secVessel"], lens: ["CBE 320", 0] },
  "430-1": { inp: { T: 15 }, view: "ro", open: ["secVessel", "secTrends"], lens: ["CBE 430", 0] },
  "440-1": { inp: {}, view: "ro", open: ["secKpi"], lens: ["CBE 440", 0] },
  "450-1": { inp: {}, view: "ro", open: ["secEnergy", "secScale"], lens: ["CBE 450", 1] },
  "450-2": { inp: {}, view: "ro", open: ["secEnergy"], lens: ["CBE 450", 0] },
  "470-1": { inp: {}, view: "ro", open: ["secTrends"], lens: ["CBE 470", 0], rate: 1 },   // the PI step response needs real time
  "512-1": { inp: {}, view: "overview", open: ["secEnergy", "secEvery"] },
  "540-1": { inp: { age: 0, foul: 0 }, view: "ro", open: ["secKpi", "secVessel"], lens: ["CBE 540", 0] },
  "int-1": { inp: {}, view: "ro", open: ["secKpi", "secEnergy", "secVessel", "secTrends"], rate: 1 },   // part (k) watches the PI response in real time
  "540-2": { inp: { grade: "std", rec: 45, flux: 14 }, view: "ro", open: ["secKpi", "secEnergy", "secOp"] },
  "547-1": { inp: {}, view: "pretreat", open: ["secKpi"], lens: ["CBE 547", 0] },
};
