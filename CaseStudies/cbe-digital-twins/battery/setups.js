// Problem-set setups, loaded from the URL hash #ps=<course>-<k> (for example #ps=430-1).
// s: model state (anything not listed takes the default); view: camera place; open: side-panel sections to open;
// co2: Footprint view on. problems_check.mjs evaluates the model in exactly these states.
export const SETUPS = {
  "150-1": { s: {}, view: "chain", open: ["sec-results"], co2: true },
  "250-1": { s: {}, view: "refinery", open: ["sec-results"] },
  "250-2": { s: { route: "hydro" }, view: "recycle", open: ["sec-recycle"] },
  "255-1": { s: { chem: "LFP" }, view: "particles", open: ["sec-cell"] },
  "310-1": { s: {}, view: "lattice", open: ["sec-cell"] },
  "311-1": { s: { chem: "LFP", li: "brine" }, view: "mine", open: ["sec-chain"] },
  "320-1": { s: { C: 3 }, view: "particles", open: ["sec-cell"] },
  "326-1": { s: { C: 3 }, view: "module", open: ["sec-cell"] },
  "426-1": { s: { route: "hydro" }, view: "recycle", open: ["sec-recycle"] },
  "430-1": { s: { Tamb: 0 }, view: "particles", open: ["sec-cell"] },
  "430-2": { s: {}, view: "particles", open: ["sec-results", "sec-cell"] },
  "450-1": { s: {}, view: "chain", open: ["sec-results", "sec-chain"], co2: true },
  "450-2": { s: { route: "hydro" }, view: "recycle", open: ["sec-recycle", "sec-results"] },
  "470-1": { s: {}, view: "ev", open: ["sec-cell"] },
  "440-1": { s: {}, view: "lattice", open: ["sec-cell"] },
  "512-1": { s: {}, view: "ev", open: ["sec-results", "sec-chain"] },
  "540-1": { s: {}, view: "cell", open: ["sec-cell"] },
  "562E-1": { s: {}, view: "particles", open: ["sec-cell"] },
  // design problem (Part U): opens the starting design, not the solved one
  "440-2": { s: { Tamb: 30, cycles: 3000, dod: 1.0 }, view: "cell", open: ["sec-cell", "sec-results"] },
  "int-1": { s: {}, view: "ev", open: ["sec-results", "sec-cell"] },   // integrative case study (default operating point)
};
