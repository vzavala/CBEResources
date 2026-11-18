// Problem-set setups: the app reads #ps=<course>-<k> (or #ps-<course>-<k>) on load and applies one of these.
// problems_check.mjs uses the same table, so every answer is computed from exactly the state the link loads.
export const BASE = { rate: 150, timing: "split", irrigate: false, year: "normal", trait: "bt", precision: false, cover: false, digester: true, recovery: false };
const END = 213;   // Oct 31: season totals are final

// ctl: changes from BASE · day: season day shown (0 = Apr 1) · lens/stop: subject card to open · view: camera · open: panel sections
export const PS = {
  "150-1": { ctl: {}, day: END, lens: 250, open: ["sec-n", "sec-lake"] },
  "250-1": { ctl: {}, day: END, lens: 250, open: ["sec-n"] },
  "250-2": { ctl: {}, day: END, lens: 250, stop: 1, open: ["sec-season"] },
  "255-1": { ctl: {}, day: 100, lens: 255, open: ["sec-live"] },
  "310-1": { ctl: {}, day: END, lens: 310, open: ["sec-energy"] },
  "311-1": { ctl: {}, day: END, lens: 311, open: ["sec-n"] },
  "320-1": { ctl: { year: "wet", timing: "fall" }, day: END, lens: 320, open: ["sec-n", "sec-season"] },
  "326-1": { ctl: {}, day: END, lens: 326, open: ["sec-energy"] },
  "355-1": { ctl: {}, day: END, lens: 355, open: ["sec-season"] },
  "426-1": { ctl: {}, day: 100, lens: 426, open: ["sec-season"] },
  "430-1": { ctl: {}, day: 70, lens: 430, open: ["sec-dairy", "sec-live"] },
  "450-1": { ctl: {}, day: END, lens: 450, open: ["sec-n"] },
  "450-2": { ctl: {}, day: END, lens: 547, open: ["sec-lake", "sec-dairy"] },
  "470-1": { ctl: { precision: true }, day: END, lens: 470, open: ["sec-prec", "sec-n"] },
  "470-2": { ctl: { year: "dry", irrigate: true }, day: END, view: "farm", open: ["sec-season"] },
  "512-1": { ctl: {}, day: END, lens: 512, open: ["sec-energy", "sec-dairy"] },
  "547-1": { ctl: {}, day: END, lens: 547, open: ["sec-lake"] },
  "int-1": { ctl: {}, day: END, lens: 250, open: ["sec-n", "sec-energy", "sec-prec"] },
  "560-1": { ctl: { trait: "conv" }, day: END, lens: 560, open: ["sec-season"] },
  // Part U design problem (one per twin): the link opens the STARTING design, not the solved one
  "560-2": { ctl: {}, day: END, lens: 560, open: ["sec-season", "sec-n"] },
};
export const psCtl = id => ({ ...BASE, ...(PS[id] ? PS[id].ctl : {}) });
