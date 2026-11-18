// Text content of the Brewery Digital Twin: references, subject lenses, ChemE spots and the course map.
// Numbers that depend on the model are filled in live by app.js.

export const REFS = [
  // 1
  `D. A. Gee, W. F. Ramirez. "Optimal temperature control for batch beer fermentation." <i>Biotechnology and Bioengineering</i> 31(3) (1988) 224–234. <a href="https://doi.org/10.1002/bit.260310308" target="_blank" rel="noopener">doi ↗</a>`,
  // 2
  `D. A. Gee, W. F. Ramirez. "A flavour model for beer fermentation." <i>Journal of the Institute of Brewing</i> 100 (1994) 321–329.`,
  // 3
  `COMSOL Application Library. "Fermentation in Beer Brewing" (model documentation, version 6.4). Parameter table used here. <a href="https://doc.comsol.com/6.4/doc/com.comsol.help.models.chem.beer_fermentation/beer_fermentation.html" target="_blank" rel="noopener">Link ↗</a>`,
  // 4
  `J. M. Zamudio Lara, L. Dewasme, H. Hernández Escoto, A. Vande Wouwer. "Parameter estimation of dynamic beer fermentation models." <i>Foods</i> 11 (2022) 3602. <a href="https://doi.org/10.3390/foods11223602" target="_blank" rel="noopener">doi ↗</a>`,
  // 5
  `W. F. Ramirez, J. Maciejowski. "Optimal beer fermentation." <i>Journal of the Institute of Brewing</i> 113(3) (2007) 325–333.`,
  // 6
  `M. G. Malowicki, T. H. Shellhammer. "Isomerization and degradation kinetics of hop (<i>Humulus lupulus</i>) acids in a model wort-boiling system." <i>Journal of Agricultural and Food Chemistry</i> 53(11) (2005) 4434–4439. <a href="https://doi.org/10.1021/jf0481296" target="_blank" rel="noopener">doi ↗</a>`,
  // 7
  `K. Krogerus, B. R. Gibson. "125th Anniversary Review: Diacetyl and its control during brewery fermentation." <i>Journal of the Institute of Brewing</i> 119 (2013) 86–97. Flavour threshold about 0.1–0.2 mg/L in lagers.`,
  // 8
  `A. Marc et al. "A kinetic model of starch hydrolysis by α- and β-amylase during mashing." <i>Biotechnology and Bioengineering</i> 25(2) (1983) 481–496. <a href="https://doi.org/10.1002/bit.260250214" target="_blank" rel="noopener">doi ↗</a>`,
  // 9
  `C. Brandam, X. M. Meyer, J. Proth, P. Strehaiano, H. Pingaud. "An original kinetic model for the enzymatic hydrolysis of starch during mashing." <i>Biochemical Engineering Journal</i> 13 (2003) 43–52.`,
  // 10
  `R. Sander. "Compilation of Henry's law constants (version 4.0) for water as solvent." <i>Atmospheric Chemistry and Physics</i> 15 (2015) 4399–4981. <a href="https://doi.org/10.5194/acp-15-4399-2015" target="_blank" rel="noopener">doi ↗</a>`,
  // 11
  `A. J. Cutaia, A.-J. Reid, R. A. Speers. "Examination of the relationships between original, real and apparent extracts, and alcohol in pilot plant and commercially produced beers." <i>Journal of the Institute of Brewing</i> 115(4) (2009) 318–327.`,
  // 12
  `S. I. Mussatto, G. Dragone, I. C. Roberto. "Brewers' spent grain: generation, characteristics and potential applications." <i>Journal of Cereal Science</i> 43(1) (2006) 1–14. Spent grain is about 85 % of a brewery's by-products.`,
  // 13
  `S. D. Peterson, R. Amón, T. Wong, E. S. Spang, C. W. Simmons. "Material and energy flow analysis of craft brewing: a case study at a California microbrewery." <i>Frontiers in Sustainable Food Systems</i> 6 (2022) 1028520. Measured 4.2 MJ/L of heat, 1.6 MJ/L of electricity and 12.8 L of water per litre of packaged beer. <a href="https://doi.org/10.3389/fsufs.2022.1028520" target="_blank" rel="noopener">doi ↗</a>`,
  // 14
  `U.S. Environmental Protection Agency. "Emission Factors for Greenhouse Gas Inventories" (natural gas: 53.06 kg CO₂ per million Btu, about 0.181 kg per kWh of heat). <a href="https://www.epa.gov/climateleadership/ghg-emission-factors-hub" target="_blank" rel="noopener">Link ↗</a>`,
  // 15
  `T. L. Bergman, A. S. Lavine, F. P. Incropera, D. P. DeWitt. <i>Fundamentals of Heat and Mass Transfer</i>, 7th ed. Wiley, 2011.`,
  // 16
  `R. B. Bird, W. E. Stewart, E. N. Lightfoot. <i>Transport Phenomena</i>, 2nd ed. Wiley, 2002.`,
  // 17
  `University of Wisconsin–Madison. <i>Guide</i>: Chemical and Biological Engineering (CBE) courses. <a href="https://guide.wisc.edu/courses/cbe/" target="_blank" rel="noopener">Link ↗</a>`,
];
export const ref = (...n) => `<sup class="refsup">${n.map(k => `<a href="#ref-${k}" class="ref" data-ref="${k}">${k}</a>`).join(",")}</sup>`;

// Subject labels used across the ChemE Digital Twins
export const COURSE = {
  250: ["Balances", "Process Synthesis"], 255: ["Modeling", "Introduction to Chemical Process Modeling"],
  310: ["Thermo", "Chemical Process Thermodynamics"], 311: ["Mixtures", "Thermodynamics of Mixtures"],
  320: ["Transport", "Introductory Transport Phenomena"], 326: ["Fluids & Heat", "Momentum and Heat Transfer Operations"],
  426: ["Mass Transfer", "Mass Transfer Operations"], 430: ["Kinetics & Reactors", "Chemical Kinetics and Reactor Design"],
  450: ["Design", "Process Design"], 470: ["Control", "Process Dynamics and Control"], 560: ["Biochem", "Biochemical Engineering"],
};

// Features of this twin (rows of the course map); `go` names a jump action in app.js
export const FEATURES = [
  { id: "mash", name: "Mash tun", go: "mash" },
  { id: "lauter", name: "Lauter tun", go: "lauter" },
  { id: "kettle", name: "Kettle and hops", go: "kettle" },
  { id: "cooler", name: "Plate cooler", go: "cooler" },
  { id: "ferm", name: "Fermenter cutaway", go: "ferm" },
  { id: "chart", name: "Fermentation chart", go: "chart" },
  { id: "control", name: "Temperature control", go: "control" },
  { id: "yeast", name: "Yeast microscope", go: "yeast" },
  { id: "carb", name: "Carbonation", go: "carb" },
  { id: "pack", name: "Packaging", go: "pack" },
  { id: "sustain", name: "Water and energy", go: "sustain" },
  { id: "numerics", name: "∑ Numerical method", go: "m-num" },
  { id: "validation", name: "∑ Validation", go: "m-val" },
];

const PS = "../problems/#brewery-";
export const PS_LINK = n => PS + n;
export const COURSES = [
  { n: 250, features: ["mash", "kettle", "chart", "sustain"], topics: ["material-balances", "reacting-systems", "energy-balances", "heat-integration"],
    student: "Load the American lager. Does the mass from malt to alcohol and CO₂ add up? How much heat does the cooler give back?",
    instructor: "Brewhouse extract and water balances, a reacting batch balance, heat integration with the wort cooler." },
  { n: 255, features: ["chart", "ferm", "numerics", "validation"], topics: ["odes", "rate-laws", "process-modeling", "parameter-estimation"],
    student: "Find the fermenter equations in ∑ Model. Take 6-hour Euler steps for day one and compare with the twin.",
    instructor: "Nonlinear ODEs with Arrhenius parameters; RK4 checked against SciPy to 10⁻¹⁰." },
  { n: 310, features: ["kettle", "control", "sustain"], topics: ["enthalpy-changes", "first-law", "refrigeration"],
    student: "Compare the heat to reach the boil with the heat to boil off 6 %. Then find the chiller COP in ∑ Model.",
    instructor: "Sensible versus latent heat, heat of fermentation, a Carnot-based COP." },
  { n: 311, features: ["carb", "ferm"], topics: ["vle", "pure-phase-equilibrium"],
    student: "Read the bright-tank pressure for 2.5 volumes at 2 °C. Predict it at 10 °C, then check with Henry's law.",
    instructor: "Henry's law and its temperature dependence: why a warm keg foams." },
  { n: 320, features: ["lauter", "cooler", "pack"], topics: ["viscosity", "convection"],
    student: "Raise the malt bill and watch the lautering time. Which terms in Darcy's law change?",
    instructor: "Creeping flow twice: Darcy in the grain bed, Stokes for settling yeast." },
  { n: 326, features: ["lauter", "cooler", "control", "pack"], topics: ["packed-fluidized-beds", "heat-exchangers", "particles-filtration", "boiling-condensation"],
    student: "Find the cooler's effectiveness and NTU. Warm the cooling water to 22 °C: how much warmer does the wort leave?",
    instructor: "ε–NTU counterflow exchanger with heat recovery, a jacketed vessel, a packed bed, settling." },
  { n: 426, features: ["carb", "kettle", "ferm"], topics: ["extraction-leaching", "absorption-stripping", "vle"],
    student: "How much CO₂ must be dissolved for 2.5 volumes, and how much did the fermentation make?",
    instructor: "Leaching by sparging; gas absorption with a Henry's-law equilibrium line." },
  { n: 430, features: ["mash", "kettle", "ferm", "chart"], topics: ["enzyme-kinetics", "complex-reactions", "nonisothermal-reactors", "ideal-reactors"],
    student: "Boil the hops 30, 60 and 90 minutes: why does bitterness level off? Then ferment at 10 and 14 °C.",
    instructor: "Series reactions, enzyme deactivation, a non-isothermal batch reactor with inhibition." },
  { n: 450, features: ["sustain", "cooler", "pack", "chart"], topics: ["heat-integration", "equipment-design", "sustainability", "optimization"],
    student: "Find the tank time at 10, 12 and 14 °C. How many extra batches a year is that, and what would you check first?",
    instructor: "Tank turnover against quality, heat integration, water and energy intensity, co-products." },
  { n: 470, features: ["control", "chart", "ferm"], topics: ["feedback-control", "batch-control", "dynamic-modeling", "first-order-systems"],
    student: "Switch the cooling off: how far does the tank warm? Switch it back on and change the controller gain.",
    instructor: "Batch PI control: time-varying disturbance, set-point steps, valve saturation, anti-windup." },
  { n: 560, features: ["ferm", "yeast", "mash", "chart", "pack"], topics: ["cell-growth", "enzyme-kinetics", "bioreactors", "downstream-processing"],
    student: "Why does the yeast finish glucose before maltose? Halve and double the pitch rate and watch time and diacetyl.",
    instructor: "Three-sugar uptake with inhibition, yields, enzyme deactivation in the mash, downstream steps." },
];

// Subject lenses (course-number order). Each stop: camera view, beacon anchor, panel to highlight, cutaway on/off.
export const LENSES = [
  { n: 250, stops: [{ view: "brewhouse", beacon: "mash", panel: "sec-recipe",
    title: "Where does everything go?", text: "Malt and water go in; wort, spent grain and steam come out. A material balance accounts for every kilogram.",
    plain: "What goes in must come out or stay inside.",
    eq: "(1)&nbsp; m<sub>extract</sub> = m<sub>malt</sub> · e · x<sub>conv</sub> · η<sub>L</sub>",
    why: "Sugar left in the spent grain is beer that was never made." }] },
  { n: 255, stops: [{ view: "ferment", beacon: "fv", panel: "sec-now", cut: true,
    title: "A recipe written as equations", text: "The twin stores rate rules, not a curve. It steps them forward two minutes at a time for weeks.",
    plain: "Small steps, repeated thousands of times, become a prediction.",
    eq: "(11)–(15)&nbsp; dy/dt = f(y, T), solved with fourth-order Runge–Kutta, Δt = 120 s",
    why: "A brewer can test a new temperature plan on a laptop, not in a 5,000-litre tank." }] },
  { n: 310, stops: [{ view: "kettle", beacon: "kettle", panel: "sec-sustain",
    title: "Boiling is expensive", text: "Heating wort to 100 °C takes energy; boiling water away takes far more. The kettle is the brewhouse's biggest energy user.",
    plain: "Making steam costs about five times as much as heating water from fridge-cold to boiling.",
    eq: "(7)&nbsp; Q = m c<sub>p</sub> (100 − T<sub>in</sub>) + m<sub>evap</sub> Δh<sub>vap</sub>",
    why: "Breweries save energy by boiling less and reusing the heat." }] },
  { n: 311, stops: [{ view: "cellar", beacon: "bright", panel: "sec-ferm",
    title: "Why cold beer holds its fizz", text: "CO₂ dissolves in proportion to the gas pressure, and better when cold. The brewer sets the bright-tank pressure to hit the style's fizz.",
    plain: "Colder and more pressure means more dissolved gas.",
    eq: "(18)&nbsp; c<sub>CO₂</sub> = H(T) · p, &nbsp; H rises as T falls",
    why: "The same law sizes CO₂ capture and the oxygen supply to bioreactors." }] },
  { n: 320, stops: [{ view: "brewhouse", beacon: "lauter", panel: "sec-recipe",
    title: "Wort through a bed of grain", text: "The grain husks form their own filter. Deeper beds and stickier wort drain more slowly.",
    plain: "Flow through a sponge depends on its thickness, the liquid and the push.",
    eq: "(6)&nbsp; Q = k A Δp / (μ L)",
    why: "The same law describes groundwater, coffee filters and water treatment." }] },
  { n: 326, stops: [{ view: "cooler", beacon: "cooler", panel: "sec-sustain",
    title: "Cool the wort, heat the next batch", text: "Hot wort and cold water pass on opposite sides of thin steel plates. The wort leaves ready for yeast; the water leaves hot for the next mash.",
    plain: "The heat the wort must lose is the heat the next brew needs.",
    eq: "(10)&nbsp; q = ε C<sub>min</sub> (T<sub>wort,in</sub> − T<sub>water,in</sub>)",
    why: "Exchangers like this recover heat in dairies, refineries and power plants." }] },
  { n: 426, stops: [{ view: "cellar", beacon: "co2", panel: "sec-ferm",
    title: "Sugar out, CO₂ in", text: "Sparging rinses sugar out of the grain. Carbonation pushes CO₂ into the beer.",
    plain: "A substance moves between phases until both sides balance.",
    eq: "(18)&nbsp; CO₂ to add = (c<sub>target</sub> − c<sub>after fermentation</sub>) · V",
    why: "The same operations decaffeinate coffee and scrub pollutants from air." }] },
  { n: 430, stops: [
    { view: "kettle", beacon: "steam", panel: "sec-recipe",
      title: "Bitterness is a reaction", text: "Heat rearranges hop acids into bitter ones. The bitter product also slowly breaks down, so longer boils gain less.",
      plain: "Two reactions in a row: make it, then lose a little.",
      eq: "(9)&nbsp; α-acids → iso-α-acids → degradation products, both first order",
      why: "Picking time and temperature to get the most product is everyday reactor design." },
    { view: "ferment", beacon: "jacket", panel: "sec-ferm", cut: true,
      title: "A reactor that heats itself", text: "Fermentation releases heat, and warm yeast works faster. The cooling jacket stops the tank from running away.",
      plain: "Faster reaction, more heat, faster reaction: cooling breaks the loop.",
      eq: "(15)&nbsp; ρ c<sub>p</sub> dT/dt = Σ ΔH<sub>i</sub> r<sub>i</sub> − u UA (T − T<sub>glycol</sub>) + losses",
      why: "Heat control is the main safety problem in industrial reactors." }] },
  { n: 450, stops: [{ view: "packaging", beacon: "kegs", panel: "sec-sustain",
    title: "Designing the whole brewery", text: "A designer weighs tanks, water, energy and co-products together. Every choice trades cost against quality.",
    plain: "Good design makes more beer with less water, energy and waste.",
    eq: "(22)&nbsp; water ratio = water in / beer packaged; &nbsp; energy = kWh per hectolitre",
    why: "Spent grain feeds cattle, recovered heat cuts fuel and captured CO₂ replaces bought gas." }] },
  { n: 470, stops: [{ view: "ferment", beacon: "jacket", panel: "sec-ferm", cut: true,
    title: "A thermostat for 5,000 litres", text: "A controller reads the beer temperature and opens the glycol valve just enough. It follows the set point through the diacetyl rest and the final chill.",
    plain: "Measure, compare, adjust, repeat.",
    eq: "(16)&nbsp; u = K<sub>c</sub> (T − T<sub>sp</sub>) + (K<sub>c</sub>/τ<sub>I</sub>) ∫(T − T<sub>sp</sub>) dt, &nbsp; 0 ≤ u ≤ 1",
    why: "Automatic control keeps every batch the same and the plant safe." }] },
  { n: 560, stops: [
    { view: "yeast", beacon: "yeast", panel: "sec-now",
      title: "Yeast: a living factory", text: "Each cell turns sugar into alcohol and CO₂. It eats glucose first, then maltose, then maltotriose.",
      plain: "Billions of cells each do a little chemistry.",
      eq: "(11)&nbsp; r<sub>G</sub> = k<sub>G</sub> G/(K<sub>G</sub> + G) · X, and the same form with inhibition for maltose and maltotriose",
      why: "The same engineering makes insulin, vaccines and biofuels." },
    { view: "brewhouse", beacon: "mash", panel: "sec-recipe",
      title: "Enzymes with a sweet spot", text: "Malt enzymes cut starch into sugar, faster when warm, but heat destroys them. A hot mash leaves more unfermentable sugar and a fuller beer.",
      plain: "Workers speed up in the heat until it gets too hot and they quit.",
      eq: "(3)–(4)&nbsp; rate = k(T) · activity · substrate; &nbsp; d(activity)/dt = −k<sub>d</sub>(T) · activity",
      why: "Detergents, cheese and corn syrup all balance enzyme speed against lifetime." }] },
];

export const SPOTS = [
  { name: "Mash tun: enzymes", lens: 10, k: 1, at: "mash" },
  { name: "Lauter tun: grain filter", lens: 4, at: "lauter" },
  { name: "Kettle: boiling energy", lens: 2, at: "kettle" },
  { name: "Hops: bitterness reaction", lens: 7, at: "steam" },
  { name: "Plate cooler: heat recovery", lens: 5, at: "cooler" },
  { name: "Fermenter: yeast at work", lens: 10, at: "fv" },
  { name: "Glycol jacket: control", lens: 9, at: "jacket" },
  { name: "Bright tank: carbonation", lens: 3, at: "bright" },
  { name: "Spent grain: co-product", lens: 0, at: "grain" },
  { name: "Kegs: plant design", lens: 8, at: "kegs" },
];
// short 3D name labels shown under each major element
export const NAMES = [["Mill", "mill"], ["Mash tun", "mash"], ["Lauter tun", "lauter"], ["Kettle", "kettle"], ["Whirlpool", "whirl"], ["Wort cooler", "cooler"], ["Fermenters", "fvTop", "up"], ["Bright tank", "bright"], ["Glycol chiller", "glycol"], ["Keg filler", "filler"], ["Kegs", "kegs"]];
