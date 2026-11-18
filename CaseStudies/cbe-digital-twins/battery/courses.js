// How the Lithium-Ion Battery application connects to the CBE curriculum (shared ChemE Applications format).
// Course numbers, titles, terms and topic names come from TwinKit/courses.json (CBE Curriculum Navigator) via catalog.js.
import { CATALOG, FAMILIES } from "./catalog.js";
export { FAMILIES };

// application features (rows of the course map); `go` is the jump action in app.js
export const FEATURES = [
  { id: "chain", name: "Supply chain & footprint view", go: "chain" },
  { id: "mines", name: "Brine ponds & hard-rock mine", go: "mine" },
  { id: "lca", name: "Life-cycle footprint (LCA)", go: "lca" },
  { id: "factory", name: "Cell factory energy & grid", go: "factory" },
  { id: "cell", name: "Live cell model: charge & discharge", go: "cell" },
  { id: "heat", name: "Heating & cooling of the cell", go: "module" },
  { id: "particles", name: "Particles & lithium diffusion", go: "particles" },
  { id: "kinetics", name: "Surface reactions, plating & aging", go: "kinetics" },
  { id: "lattice", name: "Crystal lattice: NMC vs LFP", go: "lattice" },
  { id: "bms", name: "CC–CV charging (battery management)", go: "ev" },
  { id: "recycle", name: "Recycling line & mass balances", go: "recycle" },
];

// topic ids must exist for that course in courses.json; the first topic's family colours its map dots
const MINE = [
  { n: "CBE 150", topics: ["sustainability", "material-balances", "process-safety"], features: ["chain", "lca", "factory", "recycle", "mines"],
    student: "In Footprint view, find the stage with the most CO₂, change one setting and check.",
    instructor: "Life-cycle thinking on one product; pair with the Real world card for ethics." },
  { n: "CBE 250", topics: ["material-balances", "reacting-systems", "flowsheets", "energy-balances"], features: ["recycle", "lca", "chain", "mines"],
    student: "Balance the NMC leach reaction and find the acid per kWh; check End of life.",
    instructor: "Atom balances from the cathode formula; a reacting-system recycling flowsheet." },
  { n: "CBE 255", topics: ["process-modeling", "odes", "numerical-integration", "nonlinear-equations"], features: ["cell", "particles", "bms"],
    student: "Estimate the explicit time-step limit for LFP; why is the solver implicit?",
    instructor: "Method of lines: finite volumes, backward Euler, secant CV control, checked in Python." },
  { n: "CBE 310", topics: ["first-law", "second-law", "property-relations"], features: ["cell", "lattice", "heat"],
    student: "Compute ΔG per mole of lithium from the mean voltage, NMC vs LFP.",
    instructor: "ΔG = −nFE and the entropic heat term, with live values." },
  { n: "CBE 311", topics: ["electrolytes", "lle-sle", "reaction-equilibrium"], features: ["mines", "chain"],
    student: "Estimate brine pumped per kWh of LFP from the cited brine ratio.",
    instructor: "Brine evaporation as solid–liquid equilibrium of electrolytes." },
  { n: "CBE 320", topics: ["diffusion", "convection", "conduction"], features: ["particles", "heat", "cell"],
    student: "Compare R²/D for graphite and LFP; watch gradients at 3 C.",
    instructor: "Transient diffusion in spheres and Newton cooling, live." },
  { n: "CBE 326", topics: ["convection", "heat-exchangers", "conduction"], features: ["heat", "cell", "bms"],
    student: "At 3 C, estimate I²R heat, ΔT and the time constant; compare with the model.",
    instructor: "A lumped heat balance with a time-varying source." },
  { n: "CBE 426", topics: ["extraction-leaching", "staging", "transient-diffusion"], features: ["recycle", "particles"],
    student: "How many stages give 99.9 % with extraction factor 3?",
    instructor: "Leaching and Kremser stages in a real recycling flowsheet." },
  { n: "CBE 430", topics: ["rate-laws", "mechanisms", "complex-reactions", "nonisothermal-reactors"], features: ["kinetics", "particles", "heat", "cell"],
    student: "Find the coldest 1 C charge without plating; explain 2 C at 0 °C.",
    instructor: "Butler–Volmer with Arrhenius, a side reaction and self-heating." },
  { n: "CBE 450", topics: ["sustainability", "economics", "optimization", "process-safety"], features: ["lca", "chain", "factory", "recycle", "mines"],
    student: "Find the settings with the lowest footprint per kWh delivered.",
    instructor: "A transparent bottom-up LCA: functional units, boundaries, hot spots." },
  { n: "CBE 470", topics: ["batch-control", "feedback-control", "process-safety"], features: ["bms", "cell", "heat"],
    student: "Compare the constant-voltage time at 1 C and 3 C.",
    instructor: "CC–CV as a switched feedback law with safety limits." },
  { n: "CBE 440", topics: ["crystals", "functional-properties", "diffusion"], features: ["lattice", "particles", "cell"],
    student: "Compute theoretical and used capacity (mAh/g) for NMC811 and LFP.",
    instructor: "Layered oxides vs olivines: sites, voltage, rate." },
  { n: "CBE 512", topics: ["energy-storage", "sustainability", "renewable-power", "economics"], features: ["lca", "factory", "bms", "chain"],
    student: "Compare footprint per kWh delivered on Norway's and India's grids.",
    instructor: "Embodied carbon, grid intensity and lifetime together." },
  { n: "CBE 540", topics: ["polymer-structure", "polymer-physics"], features: ["cell"],
    student: "Find the separator's share of cell resistance; then at 40 % porosity.",
    instructor: "Porous polymer films set ionic resistance; shutdown separators add safety." },
  { n: "CBE 562E", topics: ["electrochemistry", "diffusion", "interface-thermo"], features: ["kinetics", "cell", "particles", "lattice"],
    student: "Compute i₀ and the graphite overpotential at 1 C, 25 °C and −10 °C.",
    instructor: "A full single particle model with published parameters." },
];

// merge with the catalog: exact titles, terms, kinds, topic names and families
export const COURSES = MINE.map(m => {
  const c = CATALOG[m.n];
  if (!c) throw new Error("course not in courses.json: " + m.n);
  const topics = m.topics.map(id => { const t = c.topics.find(x => x.id === id); if (!t) throw new Error(`topic ${id} not in ${m.n}`); return [t.name, t.family, t.id]; });
  return { ...m, title: c.title, term: c.term, order: c.order, core: c.kind === "core", topics };
}).sort((a, b) => a.order - b.order || a.n.localeCompare(b.n, "en", { numeric: true }));
