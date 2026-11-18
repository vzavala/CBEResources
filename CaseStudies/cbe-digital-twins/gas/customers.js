// Gas customers along the line: where they take gas (paper node), what they are, and how their demand
// moves through the day. The paper's Fig. 1 puts all demand at node 13; its node balance (3.11a) allows
// a demand d_j at any node, which is how the twin spreads deliveries along the line. Sizes are Typical:
//   homes        ~5 Sm3/day per home on an annual average (EIA), x weather factor
//   CCGT 500 MW  at 55 % efficiency: 500 / 0.55 = 909 MW of fuel = 2.3 MMSCM/d at full load
//   peaker 2 x 100 MW simple cycle at 35 %: 571 MW of fuel = 1.5 MMSCM/d when running
//   ammonia 1500 t/d at ~33 GJ/t (feed + fuel): 1.47 MMSCM/d, flat
//   dairy / ice cream plant: boilers and CHP, ~0.06 MMSCM/d on shift
export const SM3_MJ = 0.72 * 46.8;      // MJ per standard m3 (density x LHV of the illustrative mixture)

export const CUSTOMERS = [
  { id: "townA", name: "Riverton", kind: "town", node: 3, km: 400, side: -1, offset: 520, along: 0, homes: 150000, color: "#c5050c" },
  { id: "nh3", name: "Prairie Ammonia", kind: "ammonia", node: 5, km: 600, side: 1, offset: 470, along: 40, tpd: 1500, color: "#7b4fa6" },
  { id: "ccgt", name: "Lakeshore CCGT", kind: "ccgt", node: 6, km: 700, side: -1, offset: 480, along: 0, MW: 500, color: "#2f6fb0" },
  { id: "townB", name: "Millbrook", kind: "town", node: 9, km: 1000, side: 1, offset: 470, along: 0, homes: 100000, color: "#c5050c" },
  { id: "peaker", name: "Ridge Peaker", kind: "peaker", node: 10, km: 1100, side: -1, offset: 420, along: 0, MW: 200, color: "#e0761f" },
  { id: "dairy", name: "Badger Dairy (ice cream)", kind: "dairy", node: 12, km: 1300, side: 1, offset: 330, along: 0, color: "#23824a" },
  { id: "metro", name: "Metro City gate", kind: "metro", node: 13, km: 1600, side: -1, offset: 0, along: 0, homes: 600000, color: "#c5050c" },
];
export const KIND_LABEL = { town: "Homes and businesses", metro: "City (homes and businesses)", ccgt: "Combined-cycle power plant", peaker: "Peaking power plant", ammonia: "Ammonia plant (feedstock + fuel)", dairy: "Dairy / ice cream plant" };

// smooth step helpers
const sig = (x, k = 1) => 1 / (1 + Math.exp(-x * k));
const bump = (h, c, w) => Math.exp(-0.5 * ((((h - c) % 24) + 36) % 24 - 12) ** 2 / (w * w));   // periodic gaussian

// unit shapes (multiply by size), h = hour of day
export const SHAPES = {
  // homes: low at night, morning and evening peaks; the heating share scales with the weather factor
  residential: (h, wx) => 0.55 + 0.45 * wx * (0.75 + 0.55 * bump(h, 7.5, 1.4) + 0.6 * bump(h, 19, 2.0) - 0.35 * bump(h, 3, 2.2)),
  // combined cycle follows the electricity market: minimum load at night, ramps at 6-8 h, evening peak
  ccgt: h => 0.35 + 0.4 * (sig(h - 7, 2) - sig(h - 23, 2)) + 0.25 * bump(h, 18.5, 1.6),
  // peaker: off, or full load during the morning and evening peaks (fast starts, ~10 min)
  peaker: (h, wx) => (((h >= 7 && h < 9.5) || (h >= 17 && h < 20.5)) && wx >= 0.9) ? 1 : 0,
  ammonia: () => 1,
  dairy: h => (h >= 5 && h < 22) ? 1 : 0.35,
};

// nominal MMSCM/d at full shape value
export function sizeOf(c) {
  switch (c.kind) {
    case "town": case "metro": return c.homes * 5 / 1e6;                       // annual-average gas use
    case "ccgt": return c.MW / 0.55 * 86400 / SM3_MJ / 1e6;
    case "peaker": return c.MW / 0.35 * 86400 / SM3_MJ / 1e6;
    case "ammonia": return c.tpd * 33e3 / SM3_MJ / 1e6;
    case "dairy": return 0.06;
  }
}
export function demandOf(c, h, wx = 1) {
  const s = c.kind === "town" || c.kind === "metro" ? SHAPES.residential(h, wx) : SHAPES[c.kind](h, wx);
  return sizeOf(c) * s;
}
export const WEATHER = [["Mild", 0.6], ["Average", 1.0], ["Cold", 1.4], ["Very cold", 1.8]];
