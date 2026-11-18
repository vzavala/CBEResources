// Text content of the Summer Lab Distillation Digital Twin: references, subject lenses, ChemE spots and the course map.
// Numbers that depend on the model are filled in live by app.js.

export const REFS = [
  // 1
  `H. Renon, J. M. Prausnitz. "Local compositions in thermodynamic excess functions for liquid mixtures." <i>AIChE Journal</i> 14(1) (1968) 135–144. <a href="https://doi.org/10.1002/aic.690140124" target="_blank" rel="noopener">doi ↗</a>`,
  // 2
  `B. E. Poling, J. M. Prausnitz, J. P. O'Connell. <i>The Properties of Gases and Liquids</i>, 5th ed. McGraw-Hill, 2001. Antoine equation, Watson relation, mixture viscosity.`,
  // 3
  `K. M. Watson. "Thermodynamics of the liquid state." <i>Industrial &amp; Engineering Chemistry</i> 35(4) (1943) 398–406. <a href="https://doi.org/10.1021/ie50400a004" target="_blank" rel="noopener">doi ↗</a>`,
  // 4
  `E. V. Murphree. "Rectifying column calculations." <i>Industrial &amp; Engineering Chemistry</i> 17(7) (1925) 747–750. <a href="https://doi.org/10.1021/ie50187a044" target="_blank" rel="noopener">doi ↗</a>`,
  // 5
  `W. L. McCabe, E. W. Thiele. "Graphical design of fractionating columns." <i>Industrial &amp; Engineering Chemistry</i> 17(6) (1925) 605–611. <a href="https://doi.org/10.1021/ie50186a023" target="_blank" rel="noopener">doi ↗</a>`,
  // 6
  `A. P. Colburn. "Effect of entrainment on plate efficiency in distillation." <i>Industrial &amp; Engineering Chemistry</i> 28(5) (1936) 526–530. <a href="https://doi.org/10.1021/ie50317a005" target="_blank" rel="noopener">doi ↗</a>`,
  // 7
  `D. L. Bennett, R. Agrawal, P. J. Cook. "New pressure drop correlation for sieve tray distillation columns." <i>AIChE Journal</i> 29(3) (1983) 434–442. <a href="https://doi.org/10.1002/aic.690290313" target="_blank" rel="noopener">doi ↗</a>`,
  // 8
  `G. Towler, R. Sinnott. <i>Chemical Engineering Design: Principles, Practice and Economics of Plant and Process Design</i>, 2nd ed. Butterworth-Heinemann, 2013. Sieve-tray design: Francis weir, weep point, pressure drop, downcomer backup.`,
  // 9
  `J. R. Fair. "How to predict sieve tray entrainment and flooding." <i>Petro/Chem Engineer</i> 33(10) (1961) 45–52. Flooding and entrainment charts, as reproduced in refs. 8 and 11.`,
  // 10
  `J. A. Lygeros, K. G. Magoulas. "Column flooding and entrainment." <i>Hydrocarbon Processing</i> 65(12) (1986) 43–44. Curve fit of Fair's flooding chart, as given in ref. 11.`,
  // 11
  `D. W. Green, R. H. Perry (eds.). <i>Perry's Chemical Engineers' Handbook</i>, 8th ed. McGraw-Hill, 2008. Section 13: ethanol–water equilibrium data at 1 atm; Section 14: tray hydraulics.`,
  // 12
  `J. D. Seader, E. J. Henley, D. K. Roper. <i>Separation Process Principles</i>, 3rd ed. Wiley, 2011. Stage (MESH) equations, Murphree efficiency, McCabe–Thiele method.`,
  // 13
  `T. L. Bergman, A. S. Lavine, F. P. Incropera, D. P. DeWitt. <i>Fundamentals of Heat and Mass Transfer</i>, 7th ed. Wiley, 2011. Effectiveness–NTU method.`,
  // 14
  `D. E. Seborg, T. F. Edgar, D. A. Mellichamp, F. J. Doyle III. <i>Process Dynamics and Control</i>, 4th ed. Wiley, 2016. PI control, anti-windup, step-test identification.`,
  // 15
  `S. Skogestad. "Dynamics and control of distillation columns: a tutorial introduction." <i>Chemical Engineering Research and Design</i> 75(6) (1997) 539–562. <a href="https://doi.org/10.1205/026387697524092" target="_blank" rel="noopener">doi ↗</a>`,
  // 16
  `International Organization of Legal Metrology. <i>OIML R 22: International Alcoholometric Tables</i> (1975). Density of ethanol–water mixtures at 20 °C.`,
  // 17
  `Department of Chemical and Biological Engineering, UW–Madison. Distillation runs from the summer Operations and Process Laboratory, 2026: four runs with tray liquid samples, flows, temperatures, and steam and cooling-water meter readings. Unpublished course data.`,
  // 18
  `University of Wisconsin–Madison. <i>Guide</i>: Chemical and Biological Engineering (CBE) courses. <a href="https://guide.wisc.edu/courses/cbe/" target="_blank" rel="noopener">Link ↗</a>`,
];
export const ref = (...n) => `<sup class="refsup">${n.map(k => `<a href="#ref-${k}" class="ref" data-ref="${k}">${k}</a>`).join(",")}</sup>`;

// Subject labels used across the ChemE Digital Twins
export const COURSE = {
  250: ["Balances", "Process Synthesis"], 255: ["Modeling", "Introduction to Chemical Process Modeling"],
  310: ["Thermo", "Chemical Process Thermodynamics"], 311: ["Mixtures", "Thermodynamics of Mixtures"],
  320: ["Transport", "Introductory Transport Phenomena"], 326: ["Fluids & Heat", "Momentum and Heat Transfer Operations"],
  355: ["Statistics", "Statistics for Chemical Engineers"], 424: ["Summer Lab", "Operations and Process Laboratory"],
  426: ["Mass Transfer", "Mass Transfer Operations"], 450: ["Design", "Process Design"], 470: ["Control", "Process Dynamics and Control"],
};

// Features of this twin (rows of the course map); `go` names a jump action in app.js
export const FEATURES = [
  { id: "balances", name: "Mass and energy balances", go: "balances" },
  { id: "mccabe", name: "McCabe–Thiele diagram", go: "mccabe" },
  { id: "profile", name: "Tray profiles", go: "profile" },
  { id: "vle", name: "∑ VLE: NRTL and the azeotrope", go: "m-vle" },
  { id: "tray", name: "Sieve tray close-up", go: "tray" },
  { id: "hyd", name: "Flooding and weeping", go: "hyd" },
  { id: "heat", name: "Condenser and reboiler", go: "heat" },
  { id: "trends", name: "Live trends", go: "trends" },
  { id: "control", name: "PI control loops", go: "control" },
  { id: "faults", name: "Faults and what-ifs", go: "faults" },
  { id: "lab", name: "Lab runs and calibration", go: "lab" },
  { id: "numerics", name: "∑ Numerical method", go: "m-num" },
  { id: "validation", name: "∑ Validation", go: "m-val" },
];

const PS = "../problems/#distill-";
export const PS_LINK = n => PS + n;
export const COURSES = [
  { n: 250, features: ["balances", "mccabe", "heat"], topics: ["material-balances", "energy-balances", "vle", "staging"],
    student: "Read feed, distillate and bottoms. Do total moles and ethanol close? What share of the ethanol leaves in the distillate?",
    instructor: "Overall and component balances on a real unit; the energy balance splits steam into condenser duty and wall losses." },
  { n: 255, features: ["numerics", "validation", "trends", "lab"], topics: ["process-modeling", "odes", "nonlinear-equations", "parameter-estimation"],
    student: "In ∑ Model, find which equation is solved by Newton's method and which by Euler steps. How many steps is one hour?",
    instructor: "A full-size DAE: 32 ODEs for holdups, algebraic bubble points by Newton, explicit Euler at 0.1 s, parameters fitted to data." },
  { n: 310, features: ["heat", "balances"], topics: ["first-law", "enthalpy-changes", "pure-phase-equilibrium"],
    student: "Estimate the boil-up from the reboiler duty and the latent heat of water. Compare with the vapour flow in ∑ Model.",
    instructor: "Open-system energy balances, sensible against latent heat, Antoine vapour pressure, Watson latent heat." },
  { n: 311, features: ["vle", "mccabe", "profile"], topics: ["vle", "activity-models", "mixture-phase-diagrams"],
    student: "Raise the reflux ratio as far as it goes. Why does the distillate never pass 89.7 mol % ethanol?",
    instructor: "NRTL activity coefficients, modified Raoult's law and the azeotrope, seen tray by tray." },
  { n: 320, features: ["tray", "hyd", "heat"], topics: ["mass-transfer-coefficients", "convection", "viscosity"],
    student: "Read one tray's wall loss in ∑ Model. What share of the steam warms the room instead of separating?",
    instructor: "Convective loss from a bare wall; Murphree efficiency as lumped interphase mass transfer." },
  { n: 326, features: ["hyd", "heat", "faults"], topics: ["boiling-condensation", "heat-exchangers", "two-phase-flow", "friction-factors"],
    student: "Lower the cooling water until the condenser vents. Predict that flow with ε–NTU first.",
    instructor: "Tray pressure drop, flooding and weeping limits, and an ε–NTU condenser in one unit." },
  { n: 355, features: ["lab", "profile", "validation"], topics: ["parameter-estimation", "regression", "data-analysis"],
    student: "Load Run 2 and compare the model with the samples. Is the distillate error random or a bias?",
    instructor: "Least squares for two efficiencies on 64 samples from four runs: residuals, RMSE and ranked error sources." },
  { n: 426, features: ["mccabe", "profile", "tray", "hyd", "vle"], topics: ["distillation", "staging", "vle"],
    student: "At fixed steam, sweep the reflux ratio. Plot distillate strength against distillate flow: where is the knee?",
    instructor: "The core course: McCabe–Thiele from live tray compositions, Murphree efficiency, internal reflux, hydraulic limits." },
  { n: 450, features: ["balances", "heat", "mccabe", "faults"], topics: ["distillation", "optimization", "economics", "process-safety"],
    student: "Find the reflux ratio and steam rate that make 90 % ABV with the least energy per litre. What limits you?",
    instructor: "Energy per litre against purity and recovery; cooling-water loss and steam trip as safety scenarios." },
  { n: 470, features: ["control", "trends", "faults"], topics: ["dynamic-modeling", "system-identification", "feedback-control", "multivariable-control"],
    student: "Step the reflux in Manual and fit a first-order model to tray 4. Then close the loop and repeat the feed upset.",
    instructor: "Step tests, PI tuning with anti-windup, and two interacting temperature loops plus a level loop." },
  { n: 424, features: ["lab", "profile", "trends", "heat", "control"], topics: ["distillation", "feedback-control", "experimental-design", "tech-communication"],
    student: "Before lab day, load your planned run and predict the compositions and the time to steady state. Compare afterwards.",
    instructor: "Plan runs, rehearse upsets and debrief with model against data. The twin resembles the lab column; it is not a copy." },
];

// Subject lenses (course-number order). Each stop: camera view, beacon anchor, panel section to highlight, equation number.
export const LENSES = [
  { n: 250, stops: [{ view: "feed", beacon: "feed", panel: "sec-energy", eq: 1,
    title: "What goes in must come out", text: "Feed enters on tray 12. Ethanol leaves at the top, water at the bottom. Every mole is accounted for.",
    plain: "Count what enters and what leaves; at steady state they match.",
    why: "Balances tell you the product flow before you build anything." }] },
  { n: 255, stops: [{ view: "column", beacon: "top", panel: "sec-now", eq: 2,
    title: "A column written as equations", text: "Two balances per stage, 16 stages. The twin steps them forward 0.1 s at a time and solves each boiling point by Newton's method.",
    plain: "Many tiny steps add up to a prediction.",
    why: "The same recipe simulates plants far too big to experiment on." }] },
  { n: 310, stops: [{ view: "reboiler", beacon: "reboiler", panel: "sec-energy", eq: 7,
    title: "Steam in, vapour up", text: "Steam boils the liquid in the pot. Almost all of that heat leaves again in the condenser.",
    plain: "Distillation runs on heat: boil at the bottom, condense at the top.",
    why: "Separations use a large share of the energy in chemical plants." }] },
  { n: 311, stops: [{ view: "column", beacon: "trays", panel: "sec-chart", eq: 4,
    title: "Why ethanol climbs", text: "Ethanol is more volatile, so the vapour over each tray is richer than the liquid. Stack trays and it adds up, until the azeotrope.",
    plain: "Each tray is one small enrichment step; at 89.7 mol % vapour and liquid match and it stops.",
    why: "Mixture thermodynamics decides whether a separation is possible at all." }] },
  { n: 320, stops: [{ view: "column", beacon: "wall", panel: "sec-energy", eq: 18,
    title: "Heat leaks through the wall", text: "The column is near 100 °C in a 21 °C room, so every section loses heat to the air.",
    plain: "A hot wall in a cool room loses heat, like a mug of coffee.",
    why: "Lost heat is steam that separates nothing; insulation pays for itself." }] },
  { n: 326, stops: [
    { view: "tray", beacon: "froth", panel: "sec-now", eq: 13,
      title: "Too much vapour: flooding", text: "Vapour bubbles through holes in the tray and lifts the liquid into froth. Push too hard and froth reaches the tray above.",
      plain: "Like a pot boiling over, on every tray at once.",
      why: "Flooding sets the top capacity of every tray column." },
    { view: "condenser", beacon: "condenser", panel: "sec-energy", eq: 16,
      title: "The condenser is a heat exchanger", text: "Cooling water in tubes condenses the vapour. Too little water and vapour escapes through the vent.",
      plain: "No cooling, no liquid product.",
      why: "The same sizing method covers car radiators and power-plant condensers." }] },
  { n: 355, stops: [{ view: "column", beacon: "sample", panel: "sec-chart", eq: 21,
    title: "Fitting the model to samples", text: "Students draw liquid from each tray. Two tray efficiencies were adjusted until the model best matched 64 samples.",
    plain: "Tune the knobs until prediction and measurement agree, then check what is left over.",
    why: "A model you have not compared with data is only a guess." }] },
  { n: 424, stops: [{ view: "products", beacon: "product", panel: "sec-operate", eq: 22,
    title: "Rehearse your lab day", text: "Load a lab run, change one setting and watch how long the column takes to settle before you would sample.",
    plain: "Practice on the twin, then run the real thing.",
    why: "Sampling before steady state is the most common lab mistake." }] },
  { n: 426, stops: [{ view: "tray", beacon: "tray", panel: "sec-chart", eq: 9,
    title: "One tray, one step", text: "Vapour and liquid meet on each sieve tray and trade ethanol for water. A real tray gets only part of the way to equilibrium.",
    plain: "Each tray is a small mixer; its efficiency says how well it mixes.",
    why: "Tray count and efficiency set the height, and the cost, of a column." }] },
  { n: 450, stops: [{ view: "condenser", beacon: "splitter", panel: "sec-operate", eq: 22,
    title: "Reflux: purity against output", text: "The splitter sends part of the condensed liquid back down. More reflux means purer product, but less of it per unit of steam.",
    plain: "You can have stronger or more, not both.",
    why: "This trade-off drives the operating cost of every distillation." }] },
  { n: 470, stops: [{ view: "console", beacon: "console", panel: "sec-control", eq: 20,
    title: "Holding purity automatically", text: "A controller watches the tray 4 temperature and adjusts the reflux. Temperature stands in for composition, which is slow to measure.",
    plain: "A thermostat for product strength.",
    why: "Feed changes all day; control keeps the product on spec without an operator." }] },
];
export const SPOTS = [
  { name: "Reboiler: steam and boil-up", lens: 2, at: "reboiler", off: [44, 10] },
  { name: "Feed tray: balances", lens: 0, at: "feed", off: [-44, 6] },
  { name: "Trays: ethanol climbs", lens: 3, at: "trays", off: [48, 0] },
  { name: "Sieve tray: efficiency", lens: 8, at: "tray", off: [-48, 0] },
  { name: "Froth: flooding limit", lens: 5, k: 0, at: "froth", off: [48, 4] },
  { name: "Bare wall: heat loss", lens: 4, at: "wall", off: [-44, 0] },
  { name: "Condenser: heat exchange", lens: 5, k: 1, at: "condenser" },
  { name: "Reflux splitter: trade-off", lens: 9, at: "splitter" },
  { name: "Sample ports: lab data", lens: 6, at: "sample", off: [-48, 0] },
  { name: "Whole column: the model", lens: 1, at: "top", off: [-40, -22] },
  { name: "Console: control loops", lens: 10, at: "console" },
  { name: "Receivers: your lab day", lens: 7, at: "product" },
];
// short 3D name labels shown next to each major element
export const NAMES = [["Feed tank", "feedTank"], ["Preheater", "preheater", "up"], ["Reboiler", "reboilerLbl"], ["Sieve trays 1–14", "traysLbl"], ["Condenser", "condLbl", "up"], ["Reflux splitter", "splitLbl"], ["Distillate", "prodLbl"], ["Bottoms", "botLbl"], ["Console", "consoleLbl", "up"], ["Walkway", "walkway", "up"]];
