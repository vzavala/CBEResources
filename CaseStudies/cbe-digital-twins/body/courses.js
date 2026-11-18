// How The Human Body connects to the CBE curriculum. Course titles, terms, core/elective, topic names and
// family colours come from TwinKit/courses.json (CBE Curriculum Navigator) via courses_data.js.
import { CJ } from "./courses_data.js";
export const FAMILIES = CJ.families;
// Twin features (rows of the course map); `go` names the jump action in app.js
export const FEATURES = [
  { id: "readouts", name: "Live readouts & 6-hour trend", go: "readouts" },
  { id: "activity", name: "Activity, weather & altitude", go: "activity" },
  { id: "food", name: "Meals, caffeine & water", go: "food" },
  { id: "lungs", name: "Lungs: air sacs & O₂ diffusion", go: "lungs" },
  { id: "heart", name: "Heart & blood flow to organs", go: "heart" },
  { id: "kidney", name: "Kidneys & urine", go: "kidney" },
  { id: "liver", name: "Liver & enzyme kinetics", go: "liver" },
  { id: "heat", name: "Heat view: skin, sweat, temperature control", go: "heat" },
  { id: "glucose", name: "Blood sugar & insulin loop", go: "glucose" },
  { id: "pk", name: "Caffeine in the bloodstream", go: "pk" },
  { id: "molecules", name: "Molecules: hemoglobin, glucose, caffeine", go: "molecules" },
  { id: "model", name: "Model, assumptions & checks", go: "model" },
];
// topics: [name exactly as in courses.json, family]
const RAW = [
  { n: "CBE 150", topics: ["material-balances", "first-law", "transport-intro", "rate-laws"],
    features: ["readouts", "activity", "food", "heart", "heat"],
    student: "Pick Jog and read the oxygen use and heat made in the Activity panel. Then work out how many minutes of jogging a 75 g carbohydrate breakfast pays for.",
    instructor: "A first look at the body as a process: streams in (O₂, food, water), streams out (CO₂, heat, sweat, urine), with every organ as a unit operation." },
  { n: "CBE 250", topics: ["material-balances", "energy-balances", "degrees-of-freedom", "reacting-systems"],
    features: ["readouts", "activity", "food", "kidney"],
    student: "Jog for an hour at 25 °C without drinking. Use the Balances lens and the water readout to close the body-water balance: what left as sweat, urine and breath?",
    instructor: "Whole-body O₂, CO₂, energy and water balances run live; the water balance links sweat, kidneys and drinking into one flowsheet." },
  { n: "CBE 255", topics: ["odes", "process-modeling", "nonlinear-equations", "numerical-integration"],
    features: ["pk", "glucose", "lungs", "model"],
    student: "Take 200 mg of caffeine. Solve the two-tank model by hand, then compare your peak with the app's numerically integrated curve.",
    instructor: "The app is a coupled ODE system (RK4 for glucose, insulin, caffeine and water; explicit one-minute steps for temperature) with nonlinear algebraic sub-models (lung oxygen fixed point), checked against an independent Python version." },
  { n: "CBE 310", topics: ["first-law", "enthalpy-changes", "pure-phase-equilibrium"],
    features: ["heat", "activity", "readouts"],
    student: "Run at marathon pace in 30 °C air. How much sweat would have to evaporate to remove all the heat, and how much actually does?",
    instructor: "Latent heat of sweat, vapor pressure of water at skin temperature versus the air, and an energy balance on the body show why humid heat is dangerous." },
  { n: "CBE 311", topics: ["electrolytes", "partial-molar", "vle"],
    features: ["kidney", "lungs", "food"],
    student: "Set the water deficit to 1.0 L. Predict the new plasma osmolality by hand, then read how concentrated the urine becomes.",
    instructor: "Osmolality, partial pressures in air-sac gas (saturated with water vapor at 47 mmHg) and the humid-air limit on sweating are all mixture thermodynamics." },
  { n: "CBE 320", topics: ["diffusion", "viscosity", "convection", "mass-transfer-coefficients"],
    features: ["lungs", "heart", "heat", "molecules"],
    student: "Go to 4500 m and jog. Read how long blood stays in a lung capillary and how far short of the air-sac PO₂ it leaves. Why does it fill up at sea level but not here?",
    instructor: "Fick's-law uptake along a lung capillary (Bohr integration with the Hill curve), shear-thinning blood viscosity and convective heat loss from skin, all with live numbers." },
  { n: "CBE 326", topics: ["flow-networks", "pumps-compressors", "friction-factors", "convection"],
    features: ["heart", "heat", "activity"],
    student: "Jog for 30 minutes. From the flow bars and blood pressure, compute the muscle bed's resistance and how much its vessels widened (R ∝ 1/r⁴).",
    instructor: "Organ beds are parallel Poiseuille branches fed by one pump; the heat side is convection plus evaporation from skin, with blood flow as the core-to-skin heat carrier." },
  { n: "CBE 426", topics: ["membranes", "mass-transfer-coefficients", "diffusion"],
    features: ["kidney", "lungs", "molecules"],
    student: "Compare the kidneys' filtration at rest and at marathon pace, then argue why dialyzers run blood and cleaning fluid counter-current.",
    instructor: "Glomerular filtration, the counter-current loop of Henle, alveolar gas exchange and the hollow-fiber dialyzer and ECMO oxygenator are membrane mass-transfer devices." },
  { n: "CBE 430", topics: ["ideal-reactors", "rate-laws", "enzyme-kinetics"],
    features: ["liver", "pk", "food"],
    student: "After a coffee, use the well-stirred liver model to find the share of caffeine removed per pass. Then jog: why does clearance barely change?",
    instructor: "The liver is a CSTR with a Michaelis–Menten enzyme; caffeine is a low-extraction drug, so clearance is reaction-limited, not flow-limited." },
  { n: "CBE 470", topics: ["dynamic-modeling", "first-order-systems", "feedback-control"],
    features: ["heat", "glucose", "readouts", "activity"],
    student: "Start jogging and watch core temperature: estimate the time constant, and explain why it settles above the 36.8 °C set point.",
    instructor: "Two physiological controllers: a proportional temperature controller, like a thermostat (sweating and skin blood flow) with steady offset, and the insulin loop (Bergman minimal model) with undershoot; automated insulin delivery closes the loop in therapy." },
  { n: "CBE 560", topics: ["enzyme-kinetics", "biomolecules"],
    features: ["food", "liver", "glucose", "molecules"],
    student: "Eat 75 g of carbohydrate and find when glucose arrives fastest from the gut. Compare with the two-tank model's prediction.",
    instructor: "Digestive enzymes and transporters feed glucose to blood; CYP1A2 breaks down caffeine. The same enzyme kinetics run industrial starch processing and drug metabolism." },
];

// Resolve titles, terms and topic names from the Curriculum Navigator data
export const COURSES = RAW.map(c => { const d = CJ.courses[c.n]; return { ...c, title: d.title, term: d.term, order: d.order, core: d.core, topics: c.topics.map(id => { if (!d.topics[id]) throw new Error(c.n + " has no topic " + id); return [d.topics[id][0], d.topics[id][1], id]; }) }; })
  .sort((a, b) => a.order - b.order || a.n.localeCompare(b.n));
export const courseUrl = n => CJ.courseUrl.replace("{num}", n.replace("CBE ", ""));
