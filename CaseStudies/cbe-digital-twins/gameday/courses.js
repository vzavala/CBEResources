// Courses panel data for Gameday ChemE (format shared by all ChemE Digital Twins).
// Course numbers, titles, terms, order and topic names are copied from TwinKit/courses.json (CBE Curriculum Navigator);
// regenerate this file with the python snippet in README if courses.json changes.
export const FAMILIES = {"professional": ["Profession & practice", "#C5050C"], "balances": ["Material & energy balances", "#E8443A"], "thermo": ["Thermodynamics", "#F28E2B"], "transport": ["Transport phenomena", "#EDC948"], "fluidops": ["Fluid & heat operations", "#B6C45A"], "separations": ["Separations", "#59A14F"], "kinetics": ["Kinetics & reactors", "#2CA58D"], "computing": ["Computing & numerics", "#4E9AD6"], "stats": ["Statistics & data", "#7A7FE0"], "control": ["Dynamics & control", "#A86ACF"], "design": ["Design, economics & safety", "#D77CB0"], "materials": ["Materials, polymers & interfaces", "#B8A89A"], "bio": ["Bio, energy & renewables", "#7FB3A6"], "math": ["Mathematics", "#5B6C8F"], "physics": ["Physics", "#2F8FA3"], "chemistry": ["Chemistry", "#C27C3A"], "biology": ["Biology", "#6FA05A"]};
export const FEATURES = [{"id": "turf", "name": "Turf surface energy balance (spot 1)"}, {"id": "base", "name": "Shock pad, G-max and drainage (spot 2)"}, {"id": "ball", "name": "Football: gas law and permeation (spot 3)"}, {"id": "pass", "name": "Spiral pass: drag and spin (spot 4)"}, {"id": "helmet", "name": "Helmet impact and foams (spot 5)"}, {"id": "cleats", "name": "Shoe foams and traction (spot 6)"}, {"id": "uniform", "name": "Fabric wicking and evaporation (spot 7)"}, {"id": "player", "name": "Player heat balance and sweating (spot 8)"}, {"id": "drink", "name": "Drinks: osmolality and uptake (spot 9)"}, {"id": "heating", "name": "Field heating and snow melt (spot 10)"}, {"id": "everyday", "name": "In everyday terms (live math)"}, {"id": "realworld", "name": "Real world: industry and sustainability"}];
export const CARDS = [
 {
  "n": "CBE 150",
  "title": "Introduction to Chemical Engineering",
  "term": "Fall 1",
  "order": 1,
  "kind": "core",
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
  "features": [
   "realworld",
   "everyday",
   "turf",
   "player"
  ],
  "student": "Open Real world, then read In everyday terms. Pick one number (sweat, pizza slices, sugar) and redo its math by hand from the formula shown.",
  "instructor": "A first-week hook: everyday products (turf, foams, drinks) are chemical-engineering products made at scale, with real trade-offs in heat, waste and safety."
 },
 {
  "n": "CBE 250",
  "title": "Process Synthesis",
  "term": "Fall 2",
  "order": 3,
  "kind": "core",
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
    "Degrees of freedom analysis",
    "balances",
    "degrees-of-freedom"
   ]
  ],
  "features": [
   "base",
   "drink",
   "everyday",
   "turf"
  ],
  "student": "Load the thunderstorm. Write the water balance on the field (rain = infiltration + runoff + storage) and check the drain flow in L/s.",
  "instructor": "Small, closed balances with live numbers: storm water on 7,400 m², and water plus sodium in a player over a game."
 },
 {
  "n": "CBE 310",
  "title": "Chemical Process Thermodynamics",
  "term": "Spring 2",
  "order": 4,
  "kind": "core",
  "topics": [
   [
    "First law of thermodynamics",
    "thermo",
    "first-law"
   ],
   [
    "Properties of pure fluids",
    "thermo",
    "pvt-properties"
   ],
   [
    "Enthalpy changes",
    "balances",
    "enthalpy-changes"
   ]
  ],
  "features": [
   "ball",
   "uniform",
   "heating"
  ],
  "student": "Redo the Deflategate calculation: 12.5 psi at 71 °F taken to 48 °F, with absolute pressure. Then load a cold night and read the ball's pressure.",
  "instructor": "Ideal gas at constant volume, latent heat of evaporation, and a combustion energy balance for the field-heating boiler."
 },
 {
  "n": "CBE 311",
  "title": "Thermodynamics of Mixtures",
  "term": "Fall 3",
  "order": 5,
  "kind": "core",
  "topics": [
   [
    "Vapour–liquid equilibrium",
    "thermo",
    "vle"
   ],
   [
    "Phase diagrams of mixtures",
    "thermo",
    "mixture-phase-diagrams"
   ],
   [
    "Electrolyte solutions",
    "thermo",
    "electrolytes"
   ]
  ],
  "features": [
   "pass",
   "player",
   "drink"
  ],
  "student": "Compute the density of humid air at the current conditions and the wet-bulb temperature from the psychrometric equation; compare with the app.",
  "instructor": "Moist air as an ideal-gas mixture, the psychrometric wet bulb and WBGT, and colligative osmolality of sports drinks and ORS."
 },
 {
  "n": "CBE 320",
  "title": "Introductory Transport Phenomena",
  "term": "Fall 3",
  "order": 5,
  "kind": "core",
  "topics": [
   [
    "Radiation heat transfer",
    "transport",
    "radiation"
   ],
   [
    "Convective heat transfer",
    "transport",
    "convection"
   ],
   [
    "Diffusion",
    "transport",
    "diffusion"
   ],
   [
    "Friction and pressure drop",
    "transport",
    "friction-factors"
   ]
  ],
  "features": [
   "turf",
   "base",
   "pass",
   "uniform",
   "helmet",
   "ball"
  ],
  "student": "Compute the drag on a 25 m/s pass by hand, then compare the range with and without air on the Pass chart.",
  "instructor": "Darcy flow in layered media, drag and Reynolds number, Lucas–Washburn wicking, solution–diffusion and impact mechanics: transport in every stop."
 },
 {
  "n": "CBE 326",
  "title": "Momentum and Heat Transfer Operations",
  "term": "Spring 3",
  "order": 6,
  "kind": "core",
  "topics": [
   [
    "Radiation heat transfer",
    "transport",
    "radiation"
   ],
   [
    "Convective heat transfer",
    "transport",
    "convection"
   ],
   [
    "Heat exchanger design",
    "fluidops",
    "heat-exchangers"
   ],
   [
    "Process equipment and sizing",
    "design",
    "equipment-design"
   ]
  ],
  "features": [
   "turf",
   "ball",
   "player",
   "heating"
  ],
  "student": "At 13:00 on a hot day, close the energy balance on the turf surface term by term, then switch to grass and explain the difference.",
  "instructor": "Surface radiation balance, lumped-capacitance cooling, heat loss from a clothed body and the ASHRAE snow-melt load with buried tubes."
 },
 {
  "n": "CBE 426",
  "title": "Mass Transfer Operations",
  "term": "Fall 4",
  "order": 7,
  "kind": "core",
  "topics": [
   [
    "Diffusion",
    "transport",
    "diffusion"
   ],
   [
    "Mass transfer coefficients",
    "transport",
    "mass-transfer-coefficients"
   ],
   [
    "Membrane separations",
    "separations",
    "membranes"
   ],
   [
    "Humidification and drying",
    "separations",
    "humidification-drying"
   ]
  ],
  "features": [
   "ball",
   "uniform",
   "player"
  ],
  "student": "Compare butyl and latex bladders: pressure lost per day, and the O₂ fraction left after 60 days. Why does the gas inside get richer in N₂?",
  "instructor": "A membrane separation in a football (permeability = D·S, O₂/N₂ selectivity) and evaporation by the heat–mass transfer analogy."
 },
 {
  "n": "CBE 430",
  "title": "Chemical Kinetics and Reactor Design",
  "term": "Fall 4",
  "order": 7,
  "kind": "core",
  "topics": [
   [
    "Rate laws",
    "kinetics",
    "rate-laws"
   ],
   [
    "Enzyme kinetics",
    "bio",
    "enzyme-kinetics"
   ]
  ],
  "features": [
   "turf",
   "drink"
  ],
  "student": "Use the first-order, Arrhenius aging law: how many seasons until turf fibre loses half its strength on a hot field vs at 25 °C?",
  "instructor": "First-order kinetics with Arrhenius temperature dependence (UV aging of polyethylene) and saturable uptake (Michaelis–Menten form)."
 },
 {
  "n": "CBE 450",
  "title": "Process Design",
  "term": "Spring 4",
  "order": 8,
  "kind": "core",
  "topics": [
   [
    "Process equipment and sizing",
    "design",
    "equipment-design"
   ],
   [
    "Process economics",
    "design",
    "economics"
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
  "features": [
   "heating",
   "turf",
   "helmet",
   "realworld"
  ],
  "student": "Size a field-heating loop for 1 cm/h of snow: duty, glycol flow and supply temperature. Then argue whether a stadium should install one.",
  "instructor": "An open design question with numbers: snow-melt duty, pumps and boiler, energy cost, versus ploughing; plus turf and helmet choices as trade-offs."
 },
 {
  "n": "CBE 470",
  "title": "Process Dynamics and Control",
  "term": "Spring 4",
  "order": 8,
  "kind": "core",
  "topics": [
   [
    "Dynamic process modeling",
    "control",
    "dynamic-modeling"
   ],
   [
    "First-order systems",
    "control",
    "first-order-systems"
   ],
   [
    "Feedback and PID",
    "control",
    "feedback-control"
   ]
  ],
  "features": [
   "player",
   "ball",
   "heating"
  ],
  "student": "Run a hot game in full pads and in shorts. Why does core temperature settle in shorts but keep rising in pads?",
  "instructor": "Thermoregulation as a proportional controller with saturation, and a football cooling as a first-order system you can read τ from."
 },
 {
  "n": "CBE 440",
  "title": "Chemical Engineering Materials",
  "term": "Elective",
  "order": 9,
  "kind": "elective",
  "topics": [
   [
    "Mechanical properties",
    "materials",
    "mechanical-properties"
   ],
   [
    "Polymer structure",
    "materials",
    "polymer-structure"
   ],
   [
    "Composites",
    "materials",
    "composites"
   ]
  ],
  "features": [
   "helmet",
   "cleats",
   "base"
  ],
  "student": "Compare helmet liners at 5.5 and 9.3 m/s. Which one keeps the peak lowest, and why does every liner bottom out eventually?",
  "instructor": "Crushable foams (Gibson–Ashby), the polycarbonate shell and field hardness (G-max) from one constitutive law."
 },
 {
  "n": "CBE 512",
  "title": "Energy Technology and Sustainability",
  "term": "Elective",
  "order": 9,
  "kind": "elective",
  "topics": [
   [
    "Energy needs",
    "bio",
    "energy-context"
   ],
   [
    "Fossil fuels",
    "bio",
    "fossil-fuels"
   ],
   [
    "Sustainability and LCA",
    "design",
    "sustainability"
   ]
  ],
  "features": [
   "heating",
   "realworld",
   "everyday"
  ],
  "student": "How much natural gas does it take to keep a field snow-free for a 6-hour snowfall? Suggest two ways to cut it.",
  "instructor": "Stadium energy use made concrete: boiler gas for snow melting, in MW, GJ and tonnes."
 },
 {
  "n": "CBE 540",
  "title": "Polymer Science and Technology",
  "term": "Elective",
  "order": 9,
  "kind": "elective",
  "topics": [
   [
    "Polymer physics and solutions",
    "materials",
    "polymer-physics"
   ],
   [
    "Polymer structure",
    "materials",
    "polymer-structure"
   ]
  ],
  "features": [
   "cleats",
   "helmet",
   "turf"
  ],
  "student": "Compare EVA and PEBA midsoles: energy returned and stiffness. Then cool the day to −5 °C and see what happens to EVA.",
  "instructor": "Loss tangent and energy return, rate and temperature dependence of polymer foams, and why polyethylene grass stays flexible."
 },
 {
  "n": "CBE 547",
  "title": "Colloid and Interface Science",
  "term": "Elective",
  "order": 9,
  "kind": "elective",
  "topics": [
   [
    "Wetting and adhesion",
    "materials",
    "wetting"
   ],
   [
    "Interface thermodynamics",
    "materials",
    "interface-thermo"
   ]
  ],
  "features": [
   "uniform"
  ],
  "student": "Compute the capillary pressure in a polyester base layer and predict how far sweat wicks in 10 minutes from the 60 s value.",
  "instructor": "Young–Laplace and Lucas–Washburn in a fabric everyone wears; contact angle and pore size set the wicking."
 },
 {
  "n": "CBE 560",
  "title": "Biochemical Engineering",
  "term": "Elective",
  "order": 9,
  "kind": "elective",
  "topics": [
   [
    "Biomolecules",
    "bio",
    "biomolecules"
   ],
   [
    "Enzyme kinetics",
    "bio",
    "enzyme-kinetics"
   ]
  ],
  "features": [
   "drink",
   "player"
  ],
  "student": "Drink only water at 1.2 L/h for 3 hours and watch plasma sodium. Then switch to a sports drink: what changes, and why?",
  "instructor": "Sodium and water balances with the Edelman relation, glucose uptake on SGLT1, and metabolic heat from substrate oxidation."
 }
];
export const PROBLEM_SET = n => `../problems/#gameday-${n.replace("CBE ", "")}`;
