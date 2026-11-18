// Course data for the Courses panel, generated from TwinKit/courses.json (CBE Curriculum Navigator).
// Titles, terms and topic names are copied exactly from that file.
export const FAMILIES = {"professional": ["Profession & practice", "#C5050C"], "balances": ["Material & energy balances", "#E8443A"], "thermo": ["Thermodynamics", "#F28E2B"], "transport": ["Transport phenomena", "#EDC948"], "fluidops": ["Fluid & heat operations", "#B6C45A"], "separations": ["Separations", "#59A14F"], "kinetics": ["Kinetics & reactors", "#2CA58D"], "computing": ["Computing & numerics", "#4E9AD6"], "stats": ["Statistics & data", "#7A7FE0"], "control": ["Dynamics & control", "#A86ACF"], "design": ["Design, economics & safety", "#D77CB0"], "materials": ["Materials, polymers & interfaces", "#B8A89A"], "bio": ["Bio, energy & renewables", "#7FB3A6"], "math": ["Mathematics", "#5B6C8F"], "physics": ["Physics", "#2F8FA3"], "chemistry": ["Chemistry", "#C27C3A"], "biology": ["Biology", "#6FA05A"]};
export const APP_COURSES = [
 {
  "n": "CBE 150",
  "title": "Introduction to Chemical Engineering",
  "term": "Fall 1",
  "kind": "core",
  "order": 1,
  "features": [
   "balances",
   "energy",
   "customers"
  ],
  "topics": [
   [
    "Material balances",
    "balances",
    "material-balances"
   ],
   [
    "Sustainability and LCA",
    "design",
    "sustainability"
   ],
   [
    "Process safety",
    "design",
    "process-safety"
   ]
  ],
  "student": "Run the day forward and watch the side panel: how much gas enters, how much the seven customers take, and where the difference goes. Then open In everyday terms and explain one number to a friend.",
  "instructor": "A first look at a real energy system: balances (in − out = accumulation), who uses natural gas, and the safety and climate trade-offs, all on live numbers."
 },
 {
  "n": "CBE 250",
  "title": "Process Synthesis",
  "term": "Fall 2",
  "kind": "core",
  "order": 3,
  "features": [
   "balances",
   "customers",
   "compression"
  ],
  "topics": [
   [
    "Material balances",
    "balances",
    "material-balances"
   ],
   [
    "Energy balances",
    "balances",
    "energy-balances"
   ],
   [
    "Process flowsheets and PFDs",
    "design",
    "flowsheets"
   ]
  ],
  "student": "Pick the junction where the power plant takes gas (node 6). From the Flow along the line chart and the Customers table, show that gas in = gas on + gas to the plant.",
  "instructor": "Every node is a balance (paper eq. 3.11a) and the whole line is a balance with accumulation (line pack). A clean case for degrees of freedom: supply pressure and demands are specified, flows are computed."
 },
 {
  "n": "CBE 255",
  "title": "Introduction to Chemical Process Modeling",
  "term": "Spring 2",
  "kind": "core",
  "order": 4,
  "features": [
   "model",
   "dynamics"
  ],
  "topics": [
   [
    "Numerical ODEs",
    "computing",
    "odes"
   ],
   [
    "Nonlinear equations",
    "computing",
    "nonlinear-equations"
   ],
   [
    "Process modeling",
    "computing",
    "process-modeling"
   ]
  ],
  "student": "Open About this application: the model has 240 unknowns. Work out where 240 comes from, and why the time step can be 300 s even though sound crosses a grid cell in 30 s.",
  "instructor": "Method of lines on two PDEs, implicit Euler and Newton on the whole network each step, validated against an independent Python solver to 1e-13 bar."
 },
 {
  "n": "CBE 310",
  "title": "Chemical Process Thermodynamics",
  "term": "Spring 2",
  "kind": "core",
  "order": 4,
  "features": [
   "compression",
   "realgas",
   "energy"
  ],
  "topics": [
   [
    "First law of thermodynamics",
    "thermo",
    "first-law"
   ],
   [
    "Flow-device energy balances",
    "thermo",
    "flow-processes"
   ],
   [
    "Power cycles",
    "thermo",
    "power-cycles"
   ],
   [
    "Equations of state",
    "thermo",
    "equations-of-state"
   ]
  ],
  "student": "At a compressor station, compute the isentropic compression power from the suction and discharge pressures and the flow, then compare with the station's power in the table.",
  "instructor": "The paper's compressor power (eq. 3.11i) is the open-system first law with isentropic ideal-gas compression; the tour adds Joule–Thomson cooling, the Brayton cycle and a real-gas z."
 },
 {
  "n": "CBE 311",
  "title": "Thermodynamics of Mixtures",
  "term": "Fall 3",
  "kind": "core",
  "order": 5,
  "features": [
   "realgas"
  ],
  "topics": [
   [
    "Equations of state",
    "thermo",
    "equations-of-state"
   ],
   [
    "Vapour–liquid equilibrium",
    "thermo",
    "vle"
   ],
   [
    "Chemical reaction equilibrium",
    "thermo",
    "reaction-equilibrium"
   ]
  ],
  "student": "Use Kay's rule and the Pitzer correlation (Molecules zoom level) to estimate z for the pipeline gas at 57 bar. How much more gas would an ideal gas model put in the pipe?",
  "instructor": "Natural gas as a non-ideal mixture: pseudo-critical properties, virial coefficients, condensation risk in the scrubbers and reaction equilibrium in the ammonia reformer."
 },
 {
  "n": "CBE 320",
  "title": "Introductory Transport Phenomena",
  "term": "Fall 3",
  "kind": "core",
  "order": 5,
  "features": [
   "friction",
   "inside",
   "dynamics"
  ],
  "topics": [
   [
    "Equations of change",
    "transport",
    "equations-of-change"
   ],
   [
    "Turbulent flow",
    "transport",
    "turbulence"
   ],
   [
    "Friction and pressure drop",
    "transport",
    "friction-factors"
   ]
  ],
  "student": "Derive the diffusion equation for pressure from the paper's eqs. (2.6) by dropping inertia, then compute D_eff for a link from the live numbers and the time for a change to spread 100 km.",
  "instructor": "Continuity and momentum in 1D, the turbulent velocity profile and viscous sublayer inside the pipe, and the diffusion analogy that explains why demand changes travel slowly."
 },
 {
  "n": "CBE 355",
  "title": "Statistics for Chemical Engineers",
  "term": "Fall 3",
  "kind": "core",
  "order": 5,
  "features": [
   "customers",
   "dynamics"
  ],
  "topics": [
   [
    "Random variables",
    "stats",
    "random-variables"
   ],
   [
    "Experimental data analysis",
    "stats",
    "data-analysis"
   ],
   [
    "Risk and uncertainty",
    "stats",
    "risk"
   ]
  ],
  "student": "Run a full day and compute the mean and standard deviation of the total demand. Why do utilities plan for the coldest day rather than the average?",
  "instructor": "Demand variability by customer type and weather; the paper plans compressor operation against stochastic demand scenarios."
 },
 {
  "n": "CBE 326",
  "title": "Momentum and Heat Transfer Operations",
  "term": "Spring 3",
  "kind": "core",
  "order": 6,
  "features": [
   "friction",
   "compression",
   "inside"
  ],
  "topics": [
   [
    "Friction and pressure drop",
    "transport",
    "friction-factors"
   ],
   [
    "Compressible flow",
    "fluidops",
    "compressible-flow"
   ],
   [
    "Pumps and compressors",
    "fluidops",
    "pumps-compressors"
   ],
   [
    "Heat exchanger design",
    "fluidops",
    "heat-exchangers"
   ]
  ],
  "student": "At the river crossing, use the steady isothermal gas-flow equation with the Colebrook friction factor to predict the pressure at the end of link 7, then compare with the model.",
  "instructor": "Compressible isothermal pipe flow (squared-pressure drop), the fully rough friction factor, compressor power and the aftercooler duty: the operations side of a gas pipeline."
 },
 {
  "n": "CBE 426",
  "title": "Mass Transfer Operations",
  "term": "Fall 4",
  "kind": "core",
  "order": 7,
  "features": [
   "compression",
   "realgas"
  ],
  "topics": [
   [
    "Vapour–liquid equilibrium",
    "thermo",
    "vle"
   ],
   [
    "Flash separation",
    "separations",
    "flash"
   ],
   [
    "Separation selection",
    "separations",
    "separation-selection"
   ]
  ],
  "student": "At peak demand on a very cold day, check whether the compressor suction scrubbers are loaded below the Souders–Brown limit.",
  "instructor": "Gas–liquid separation ahead of the compressors: why liquids can condense from a gas mixture and how the vessel diameter is set by the settling velocity."
 },
 {
  "n": "CBE 430",
  "title": "Chemical Kinetics and Reactor Design",
  "term": "Fall 4",
  "kind": "core",
  "order": 7,
  "features": [
   "ammonia"
  ],
  "topics": [
   [
    "Chemical reaction equilibrium",
    "thermo",
    "reaction-equilibrium"
   ],
   [
    "Catalytic reactors",
    "kinetics",
    "catalytic-reactors"
   ],
   [
    "Reaction stoichiometry",
    "kinetics",
    "stoichiometry"
   ]
  ],
  "student": "From the ammonia plant's gas use, estimate its ammonia output, then compare the gas actually used per tonne with the stoichiometric minimum.",
  "instructor": "Steam-methane reforming and Haber–Bosch at the ammonia plant: stoichiometry, endothermic vs exothermic equilibria and catalyst-filled tubes (the reactors are shown, not simulated)."
 },
 {
  "n": "CBE 450",
  "title": "Process Design",
  "term": "Spring 4",
  "kind": "core",
  "order": 8,
  "features": [
   "energy",
   "control",
   "compression"
  ],
  "topics": [
   [
    "Process economics",
    "design",
    "economics"
   ],
   [
    "Process optimization",
    "design",
    "optimization"
   ],
   [
    "Process safety",
    "design",
    "process-safety"
   ]
  ],
  "student": "Lower every station's discharge set-point from 56 to 54 bar and compare the daily compression cost. What do you give up?",
  "instructor": "Compression cost vs pressure margin is a compact operating trade-off; the paper's optimal-control problem minimizes exactly this cost subject to pressure limits."
 },
 {
  "n": "CBE 470",
  "title": "Process Dynamics and Control",
  "term": "Spring 4",
  "kind": "core",
  "order": 8,
  "features": [
   "control",
   "dynamics",
   "model"
  ],
  "topics": [
   [
    "First-order systems",
    "control",
    "first-order-systems"
   ],
   [
    "Feedback and PID",
    "control",
    "feedback-control"
   ],
   [
    "Dynamic process modeling",
    "control",
    "dynamic-modeling"
   ]
  ],
  "student": "Start the peaker and watch the supply inflow respond. Estimate a time constant from the response and compare it with the RC estimate in the dynamics section.",
  "instructor": "Line pack as capacitance, links as first-order systems, discharge set-point control at every station, and step disturbances you can trigger; the paper's model is the dynamic model."
 },
 {
  "n": "CBE 440",
  "title": "Chemical Engineering Materials",
  "term": "Elective",
  "kind": "elective",
  "order": 9,
  "features": [
   "materials"
  ],
  "topics": [
   [
    "Mechanical properties",
    "materials",
    "mechanical-properties"
   ],
   [
    "Corrosion",
    "materials",
    "corrosion"
   ],
   [
    "Alloys and metals",
    "materials",
    "alloys-metals"
   ]
  ],
  "student": "Find the highest pressure in the line and compute the hoop stress in the X70 pipe wall. What is the maximum allowable pressure at 72 % of the yield strength?",
  "instructor": "Line-pipe steel grades, hoop stress against yield strength, coatings and cathodic protection against corrosion."
 },
 {
  "n": "CBE 512",
  "title": "Energy Technology and Sustainability",
  "term": "Elective",
  "kind": "elective",
  "order": 9,
  "features": [
   "energy",
   "customers"
  ],
  "topics": [
   [
    "Fossil fuels",
    "bio",
    "fossil-fuels"
   ],
   [
    "Energy needs",
    "bio",
    "energy-context"
   ],
   [
    "Sustainability and LCA",
    "design",
    "sustainability"
   ]
  ],
  "student": "How many gigawatts of energy does the line carry, and what share of it is spent on compression? Where does the CO₂ come from?",
  "instructor": "Natural gas in the energy system: power plants, heating and fertilizer, the energy cost of transport, and CO₂ and methane emissions."
 }
];
