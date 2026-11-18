// Text content of the Lake Mendota Ice Digital Twin: references, subject lenses, course map and ∑ Model panel.
// Numbers that depend on the model are filled in live by app.js through the `live` functions.

export const REFS = [
  // 1
  `R. B. Bird, W. E. Stewart, E. N. Lightfoot. <i>Transport Phenomena</i>. Wiley, 1960; 2nd ed. 2002.`,
  // 2
  `J. Stefan. "Über die Theorie der Eisbildung, insbesondere über die Eisbildung im Polarmeere." <i>Sitzungsberichte der Kaiserlichen Akademie der Wissenschaften Wien, Math.-Naturwiss. Classe, Abt. 2a</i> 98 (1889) 965–983. <a href="https://www.zobodat.at/pdf/SBAWW_98_2a_0965-0983.pdf" target="_blank" rel="noopener">Link ↗</a>`,
  // 3
  `G. D. Ashton. "Thin ice growth." <i>Water Resources Research</i> 25(3) (1989) 564–566. <a href="https://doi.org/10.1029/WR025i003p00564" target="_blank" rel="noopener">doi ↗</a>`,
  // 4
  `M. Leppäranta. "A review of analytical models of sea-ice growth." <i>Atmosphere-Ocean</i> 31(1) (1993) 123–138. <a href="https://doi.org/10.1080/07055900.1993.9649465" target="_blank" rel="noopener">doi ↗</a>`,
  // 5
  `M. Sturm, J. Holmgren, M. König, K. Morris. "The thermal conductivity of seasonal snow." <i>Journal of Glaciology</i> 43(143) (1997) 26–41. <a href="https://doi.org/10.3189/S0022143000002781" target="_blank" rel="noopener">doi ↗</a>`,
  // 6
  `J. A. Palyvos. "A survey of wind convection coefficient correlations for building envelope energy systems' modeling." <i>Applied Thermal Engineering</i> 28 (2008) 801–808. <a href="https://doi.org/10.1016/j.applthermaleng.2007.12.005" target="_blank" rel="noopener">doi ↗</a>`,
  // 7
  `The Engineering ToolBox. "Ice – Thermal Properties". <a href="https://www.engineeringtoolbox.com/ice-thermal-properties-d_576.html" target="_blank" rel="noopener">Link ↗</a>`,
  // 8
  `The Engineering ToolBox. "Latent Heat of Melting common Materials". <a href="https://www.engineeringtoolbox.com/latent-heat-melting-solids-d_96.html" target="_blank" rel="noopener">Link ↗</a>`,
  // 9
  `Wisconsin State Climatology Office. "History of Freezing and Thawing on Lake Mendota" and "Madison Lake Ice". Retrieved 12 Nov 2026. <a href="https://climatology.nelson.wisc.edu/first-order-station-climate-data/madison-climate/lake-ice/history-of-ice-freezing-and-thawing-on-lake-mendota/" target="_blank" rel="noopener">Link ↗</a>`,
  // 10
  `NOAA Regional Climate Centers, Applied Climate Information System (ACIS). Madison daily temperature and snow depth (MSNthr), 1948–2026. Retrieved 12 Nov 2026. <a href="https://www.rcc-acis.org/" target="_blank" rel="noopener">Link ↗</a>`,
  // 11
  `Minnesota Department of Natural Resources. "General ice thickness guidelines". <a href="https://www.dnr.state.mn.us/safety/ice/thickness.html" target="_blank" rel="noopener">Link ↗</a>`,
  // 12
  `Wisconsin Public Radio. "How to tell if ice is thick enough and safe to be on" ("No ice is safe ice"). <a href="https://www.wpr.org/environment/how-tell-if-ice-thick-enough-and-safe-be" target="_blank" rel="noopener">Link ↗</a>`,
  // 13
  `UW–Madison Center for Limnology. "Sorry, Mendota, Trout Lake has the 'good' ice," 8 Mar 2012 (17 cm on 29 Feb 2012). <a href="https://blog.limnology.wisc.edu/2012/03/08/sorry-mendota-trout-lake-has-the-good-ice" target="_blank" rel="noopener">Link ↗</a>`,
  // 14
  `UW–Madison Center for Limnology. "Slideshow: LTER winter sampling on 'unusually' thick ice," 14 Feb 2014 (about two feet). <a href="https://blog.limnology.wisc.edu/2014/02/14/slideshow-lter-winter-sampling-on-unusually-thick-ice/" target="_blank" rel="noopener">Link ↗</a>`,
  // 15
  `UW–Madison Center for Limnology. "Where does Lake Mendota's 2025 freeze date rank in the 170-year record?" 6 Jan 2026 (median ice-on 20 Dec). <a href="https://blog.limnology.wisc.edu/2026/01/06/where-does-lake-mendotas-2025-freeze-date-rank-in-the-170-year-record/" target="_blank" rel="noopener">Link ↗</a>`,
  // 16
  `University of Wisconsin–Madison. <i>Guide</i>: Chemical and Biological Engineering (CBE) courses. <a href="https://guide.wisc.edu/courses/cbe/" target="_blank" rel="noopener">Link ↗</a>`,
];
export const ref = (...n) => `<sup class="refsup">${n.map(k => `<a href="#ref-${k}" class="ref" data-ref="${k}">${k}</a>`).join(",")}</sup>`;

// Subject labels used across the ChemE Digital Twins
export const COURSE = {
  150: ["Intro", "Introduction to Chemical Engineering"],
  250: ["Balances", "Process Synthesis"], 255: ["Modeling", "Introduction to Chemical Process Modeling"],
  310: ["Thermo", "Chemical Process Thermodynamics"], 320: ["Transport", "Introductory Transport Phenomena"],
  324: ["Transport Lab", "Transport Phenomena Lab"],
  326: ["Fluids & Heat", "Momentum and Heat Transfer Operations"], 355: ["Statistics", "Statistics for Chemical Engineers"],
  450: ["Design", "Process Design"], 512: ["Energy", "Energy Technology and Sustainability"],
};

// Features of this twin (rows of the course map); `go` names a jump action in app.js
export const FEATURES = [
  { id: "cutaway", name: "Ice cutaway and temperature profile", go: "cutaway" },
  { id: "chart", name: "Season chart: three ice models", go: "chart" },
  { id: "front", name: "Energy balance at the freezing front", go: "front" },
  { id: "insul", name: "Snow and wind insulation", go: "weather" },
  { id: "weather", name: "Real Madison winters, 1948–2026", go: "weather" },
  { id: "safety", name: "Ice-safety thresholds", go: "hole" },
  { id: "warming", name: "Warming scenarios", go: "climate" },
  { id: "record", name: "170-year Mendota ice record", go: "climate" },
  { id: "numerics", name: "Moving-boundary solver", go: "m-num" },
  { id: "validation", name: "Validation against exact solution and data", go: "m-val" },
];

const PS = "../problems/#ice-";
export const COURSES = [
  { n: 150, features: ["chart", "safety", "warming", "record"],
    topics: ["first-law", "transport-intro", "sustainability", "process-safety"],
    student: "Play 2013–14: when can people walk on the ice, and when could a truck? Then add +2 °C.",
    instructor: "Energy, heat flow and safety in a familiar setting; a first look at climate change." },
  { n: 250, features: ["front", "chart", "cutaway"],
    topics: ["energy-balances", "enthalpy-changes", "first-law"],
    student: "Use eq. (3) and the live readout: how many W/m² leave the lake today?",
    instructor: "The Stefan condition is an energy balance on a moving boundary; latent heat dominates." },
  { n: 255, features: ["numerics", "front", "validation", "weather"],
    topics: ["odes", "numerical-integration", "process-modeling", "parameter-estimation"],
    student: "Integrate $\\dfrac{dh}{dt} = \\dfrac{\\Delta T}{\\rho L\\,(h/k + R)}$ with one-day Euler steps; compare with the twin.",
    instructor: "A moving-boundary PDE, its ODE reduction, an exact solution and a one-parameter fit." },
  { n: 310, features: ["front", "cutaway"],
    topics: ["enthalpy-changes", "pure-phase-equilibrium", "first-law"],
    student: "Compare latent heat for 30 cm of ice with sensible heat for a 10 °C drop. Find $\\mathrm{Ste}$.",
    instructor: "Solid–liquid equilibrium fixes the front at 0 °C; Ste compares sensible with latent heat." },
  { n: 320, features: ["cutaway", "front", "insul", "chart", "validation"],
    topics: ["conduction", "shell-balances", "equations-of-change", "convection"],
    student: "Derive Stefan's law (8), $h = \\sqrt{2kS/\\rho L}$, from a shell balance; add the snow and air resistances.",
    instructor: "The Bird–Stewart–Lightfoot quasi-steady method on a real lake, checked against the exact solution." },
  { n: 324, features: ["validation", "chart", "weather"],
    topics: ["conduction", "convection", "data-analysis"],
    student: "Compare the twin with the measured 17 cm (2012) and ~61 cm (2014). What would you measure next?",
    instructor: "Model vs field data with honest uncertainty; snow on the lake matters most." },
  { n: 326, features: ["insul", "chart", "cutaway"],
    topics: ["conduction", "convection", "heat-exchangers"],
    student: "Use $h_a = 5.7 + 3.8\\,V$ at 1 and 8 m/s. How much thicker is the 2013–14 ice in strong wind?",
    instructor: "Overall heat-transfer coefficient through ice, snow and an air film, like a heat-exchanger wall." },
  { n: 355, features: ["record", "warming", "validation"],
    topics: ["regression", "data-analysis", "estimation", "risk"],
    student: "Fit days of ice vs year: how many days per century, and how big is the scatter?",
    instructor: "Least-squares trend on a long, noisy record: residuals and prediction intervals." },
  { n: 450, features: ["safety", "warming", "chart"],
    topics: ["process-safety", "risk", "sustainability"],
    student: "A festival needs 13 in of ice for trucks. Earliest safe date, and with +2 °C?",
    instructor: "Safety margins, input uncertainty and climate trends turn heat transfer into a decision.",
    design: { kind: "process", ps: "450-3", text: "Plan an ice road: choose the plowing level and dates so trucks have 14 days of 13 in ice by 10 Feb, even 1 °C warmer." } },
  { n: 512, features: ["warming", "record"],
    topics: ["sustainability", "energy-context"],
    student: "Rerun 1990–2020 at +1 to +4 °C: thinner peak ice and fewer walkable days per degree?",
    instructor: "A local, physics-based climate-impact estimate." },
];
export const PS_LINK = n => PS + n;

// Subject lenses (course-number order). Each stop: camera view, beacon position key, panel to highlight.
export const LENSES = [
  { n: 250, stops: [{
    view: "edge", beacon: "front", panel: "sec-now",
    title: "Where does the heat go when water freezes?", eqNo: 3, face: "temp",
    text: "Freezing water gives off latent heat. The ice grows only as fast as that heat escapes up to the cold air.",
    plain: "Heat out through the ice = heat released by new ice.",
    eq: "(3)&nbsp; ρ L dh/dt = k ∂T/∂z|<sub>z=h</sub> − q<sub>w</sub>",
    why: "The same balance sizes food freezers and casting molds.",
  }] },
  { n: 255, stops: [{
    view: "lake", beacon: "station", panel: "sec-weather",
    title: "A computer model of the whole winter", eqNo: 11,
    text: "The twin splits the ice into thin layers and steps through every hour of a real Madison winter. You can replay any winter since 1948.",
    plain: "Small time steps + simple rules = a whole season.",
    eq: "(11)&nbsp; ∂T/∂t = (α/h²) ∂²T/∂ξ² + ξ (ḣ/h) ∂T/∂ξ, &nbsp; ξ = z/h",
    why: "Models let engineers test ideas safely before building.",
  }] },
  { n: 310, stops: [{
    view: "cutaway", beacon: "water", panel: null,
    title: "Why the lake freezes from the top", eqNo: 9,
    text: "Water is densest near 4 °C, so the coldest water stays on top and freezes there. The floating ice shields the water and fish below.",
    plain: "Freezing 1 kg of water releases 334 kJ.",
    eq: "Q = m L, &nbsp; L = 334 kJ/kg; Stefan number Ste = c<sub>p</sub>(T<sub>f</sub> − T<sub>s</sub>)/L",
    why: "Phase changes run refrigerators, power plants and freezers.",
  }] },
  { n: 320, stops: [{
    view: "edge", beacon: "ice", panel: "sec-now",
    title: "Heat conducts up through the ice", eqNo: 8, face: "temp",
    text: "Heat flows up from the 0 °C bottom of the ice to its cold top. Thicker ice insulates better, so growth slows down.",
    plain: "Thickness ≈ $\\sqrt{\\text{how cold} \\times \\text{how long}}$.",
    eq: "(8)&nbsp; h = √(2 k S / ρL), &nbsp; S = ∫(T<sub>f</sub> − T<sub>a</sub>) dt",
    why: "It is the classic lake-ice problem in <i>Transport Phenomena</i>, written at UW–Madison.",
  }, {
    view: "village", beacon: "snow", panel: "sec-weather",
    title: "Snow is a warm blanket", eqNo: 4,
    text: "Snow is mostly trapped air and conducts heat about ten times worse than ice. A few centimetres of it slow freezing a lot.",
    plain: "More snow → less heat out → thinner ice.",
    eq: "(4)&nbsp; q = (T<sub>f</sub> − T<sub>a</sub>) / (1/h<sub>a</sub> + d<sub>s</sub>/k<sub>s</sub> + h/k)",
    why: "The same idea insulates buildings and pipes.",
  }] },
  { n: 326, stops: [{
    view: "lake", beacon: "wind", panel: "sec-weather",
    title: "Wind pulls heat off the ice", eqNo: 5,
    text: "Wind sweeps heat off the ice surface. On calm days the still air acts as insulation.",
    plain: "Windier → faster freezing.",
    eq: "(5)&nbsp; h<sub>a</sub> = 5.7 + 3.8 V &nbsp; [W/m²·K, V in m/s]",
    why: "Wind correlations size cooling towers and heat exchangers.",
  }] },
  { n: 355, stops: [{
    view: "lake", beacon: "shore", panel: "sec-climate",
    title: "170 years of ice records", eqNo: 13,
    text: "Madison has logged freeze and thaw dates since the 1850s. The years scatter, but the trend is clearly down.",
    plain: "A trend line separates change from noise.",
    eq: "(13)&nbsp; D = β<sub>0</sub> + β<sub>1</sub>·year, &nbsp; least squares",
    why: "Engineers use the same tools on plant and sensor data.",
  }] },
  { n: 450, stops: [{
    view: "village", beacon: "hole", panel: "sec-now",
    title: "Is the ice safe enough?",
    text: "Guides list the clear-ice thickness for people, snowmobiles, cars and trucks. White ice is weaker, so engineers add a margin.",
    plain: "Measure first, then add a margin.",
    eq: "4 in (10 cm): on foot · 5–7 in: snowmobile · 9–10 in: small car · 13 in: medium truck",
    why: "Safety margins are at the heart of process design.",
  }] },
];

// ChemE spots: number, name, lens index, anchor key in the scene
export const SPOTS = [
  { name: "Freezing front: heat released", lens: 0, at: "front" },
  { name: "Ice: heat conduction", lens: 3, at: "ice" },
  { name: "Snow: insulation", lens: 3, k: 1, at: "snow" },
  { name: "Wind over the ice", lens: 4, at: "wind" },
  { name: "Lake water near 4 °C", lens: 2, at: "water" },
  { name: "Auger hole: is it safe?", lens: 6, at: "hole" },
  { name: "Weather station and model", lens: 1, at: "station" },
  { name: "Ice records since 1855", lens: 5, at: "shore" },
];
