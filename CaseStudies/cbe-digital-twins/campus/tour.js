// Guided tour for the campus decarbonization twin: stops (where to fly, what the asset is, its specification,
// live readings and the equations at work, each tagged with the UW–Madison CBE course that teaches it), a course map,
// and detailed procedural 3D cutaway models shown in a separate viewer. Models are at true size in metres.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { CASE, DIST, BORE, COST, FUELS, PRICE, EF, NET, netLoss, copHeat, copCool, lcoe, crf, ABS_COP, HEAT_GWh, COOL_GWh } from "./models.js";
import { CARDINAL } from "./world.js";

// ---------- course tags: short subject label, full title on hover, link to the UW–Madison Guide entry ----------
export const COURSES = {
  "CBE 250": ["Process Synthesis", "#55606b", "Balances"],
  "CBE 310": ["Chemical Process Thermodynamics", "#2f6fb0", "Thermo"],
  "CBE 311": ["Thermodynamics of Mixtures", "#7b4fa6", "Mixtures"],
  "CBE 320": ["Introductory Transport Phenomena", "#1f7a45", "Transport"],
  "CBE 326": ["Momentum and Heat Transfer Operations", "#b5531f", "Fluids & Heat"],
  "CBE 426": ["Mass Transfer Operations", "#0f7378", "Mass Transfer"],
  "CBE 430": ["Chemical Kinetics and Reactor Design", "#9c2f68", "Kinetics & Reactors"],
  "CBE 440": ["Chemical Engineering Materials", "#7d621a", "Materials"],
  "CBE 450": ["Process Design", CARDINAL, "Design"],
  "CBE 470": ["Process Dynamics and Control", "#a3303f", "Control"],
  "CBE 512": ["Energy Technology and Sustainability", "#3d6b2e", "Energy"],
  "CBE 540": ["Polymer Science and Technology", "#5d7222", "Polymers"],
  "CBE 560": ["Biochemical Engineering", "#24704f", "Biochem"],
};
export const courseURL = c => `https://guide.wisc.edu/search/?P=${encodeURIComponent(c)}`;
export const tag = c => `<a class="course" href="${courseURL(c)}" target="_blank" rel="noopener" title="${c}: ${COURSES[c]?.[0] || ""}">${COURSES[c]?.[2] || c} ↗</a>`;
const eq = (courses, html, note) => ({ courses, html, note });
const I = v => `<i>${v}</i>`, sub = (a, b) => `${a}<sub>${b}</sub>`;
const f0 = v => Math.round(v).toLocaleString(), f1 = v => v.toFixed(1), f2 = v => v.toFixed(2);
const M$ = v => `$${(v / 1e6).toFixed(Math.abs(v) < 1e7 ? 1 : 0)}M`;


// ---------- references (every entry opened and checked when this model was built) ----------
export const REFS = [
  ["University of Wisconsin–Madison", "Campus Map: building footprints and names (map.wisc.edu, api/v1/map_objects)", "UW–Madison", "2026", "https://map.wisc.edu/"],
  ["OpenStreetMap contributors", "OpenStreetMap data (buildings, floor counts, lakes, streets), retrieved with the Overpass API; ODbL licence", "OpenStreetMap Foundation", "2026", "https://www.openstreetmap.org/copyright"],
  ["U.S. Energy Information Administration", "2018 Commercial Buildings Energy Consumption Survey, Table C5: Consumption and gross energy intensity by census region", "EIA", "2022", "https://www.eia.gov/consumption/commercial/data/2018/ce/pdf/c5.pdf"],
  ["Public Service Commission of Wisconsin", "Fiscal Year 2021 Energy Use in State Facilities Report (UW–Madison section)", "PSC of Wisconsin", "2021", "https://psc.wi.gov/Documents/OEI/WisconsinEnergyStatistics/Energy%20Use%20in%20State%20Facilities%20Report/FY2021_State_Energy_Report.pdf"],
  ["B. Lopez, J. Ma, V. M. Zavala", "Graph-Based Optimization for Technology Pathway Analysis: A Case Study in the Decarbonization of University Campuses", "Industrial & Engineering Chemistry Research 63, 2276–2293", "2024", "https://doi.org/10.1021/acs.iecr.3c03244"],
  ["J. Vergara-Zambrano, P. Brahmbhatt, S. Avraamidou", "A multi-scale optimization framework for energy transition planning in urban areas: Insights from a university campus case study", "Sustainable Energy, Grids and Networks 44, 101996", "2025", "https://doi.org/10.1016/j.segan.2025.101996"],
  ["N. Jandl", "A Lake Runs Through It: How the Charter Street Heating & Cooling Plant Helps UW–Madison Stay Comfortable Year-Round", "UW–Madison Office of Sustainability", "2019", "https://sustainability.wisc.edu/charter-street-heating-cooling-plant/"],
  ["University of Wisconsin–Madison News", "UW-Madison endorses 150-megawatt power plant (West Campus Cogeneration Facility)", "UW–Madison", "2003", "https://news.wisc.edu/uw-madison-endorses-150-megawatt-power-plant/"],
  ["U.S. Energy Information Administration", "How much energy is consumed in U.S. buildings? (FAQ)", "EIA", "2024", "https://www.eia.gov/tools/faqs/faq.php?id=86"],
  ["U.S. Energy Information Administration", "How much electricity does an American home use? (FAQ)", "EIA", "2023", "https://www.eia.gov/tools/faqs/faq.php?id=97"],
  ["U.S. Environmental Protection Agency", "GHG Emission Factors Hub (natural gas 53.06 kg CO₂/MMBtu; motor gasoline 8.78 kg CO₂/gal)", "EPA Center for Corporate Climate Leadership", "2025", "https://www.epa.gov/system/files/documents/2025-01/ghg-emission-factors-hub-2025.pdf"],
  ["U.S. Environmental Protection Agency", "Greenhouse Gas Emissions from a Typical Passenger Vehicle", "EPA", "2026", "https://www.epa.gov/greenvehicles/greenhouse-gas-emissions-typical-passenger-vehicle"],
  ["U.S. Environmental Protection Agency", "Greenhouse Gas Equivalencies Calculator: Calculations and References", "EPA", "2026", "https://www.epa.gov/energy/greenhouse-gas-equivalencies-calculator-calculations-and-references"],
  ["U.S. Department of Energy, Hydrogen and Fuel Cell Technologies Office", "Technical Targets for Proton Exchange Membrane Electrolysis", "DOE", "2024", "https://www.energy.gov/eere/fuelcells/technical-targets-proton-exchange-membrane-electrolysis"],
  ["P. Wirdzek, W. Lintner, P. Mathew, N. Carlisle", "Energy efficiency programs for niche markets: The Labs21 program as an exemplar (LBNL-55503)", "Lawrence Berkeley National Laboratory", "2004", "https://www.osti.gov/biblio/835810"],
  ["International Renewable Energy Agency", "Renewable Power Generation Costs in 2020: Highlights", "IRENA", "2021", "https://www.irena.org/-/media/Files/IRENA/Agency/Publication/2021/Jun/IRENA_Power_Generation_Costs_2020_Highlights.pdf"],
  ["R. Stull", "Wet-Bulb Temperature from Relative Humidity and Air Temperature", "Journal of Applied Meteorology and Climatology 50, 2267–2269", "2011", "https://doi.org/10.1175/JAMC-D-11-0143.1"],
  ["V. M. Zavala, S. Avraamidou", "CBE 450 Process Design, Spring 2026: campus decarbonization project handouts and data sheet (unpublished course materials)", "UW–Madison Department of Chemical and Biological Engineering", "2026", null],
  ["B. Haurwitz", "Insolation in relation to cloudiness and cloud density", "Journal of Meteorology 2, 154–166", "1945", null],
  ["P. Eskilson", "Thermal Analysis of Heat Extraction Boreholes (PhD thesis)", "Lund University, Department of Mathematical Physics", "1987", "https://lup.lub.lu.se/record/2536225"],
  ["J. M. Smith, H. C. Van Ness, M. M. Abbott, M. T. Swihart", "Introduction to Chemical Engineering Thermodynamics, 9th ed.", "McGraw-Hill Education", "2022", null],
  ["T. L. Bergman, A. S. Lavine, F. P. Incropera, D. P. DeWitt", "Fundamentals of Heat and Mass Transfer, 7th ed.", "Wiley", "2011", null],
  ["W. D. Seider, D. R. Lewin, J. D. Seader, S. Widagdo, R. Gani, K. M. Ng", "Product and Process Design Principles: Synthesis, Analysis and Evaluation, 4th ed.", "Wiley", "2017", null],
  ["R. M. Felder, R. W. Rousseau, L. G. Bullard", "Elementary Principles of Chemical Processes, 4th ed.", "Wiley", "2016", null],
  ["J. A. Duffie, W. A. Beckman", "Solar Engineering of Thermal Processes, 4th ed.", "Wiley", "2013", null],
  ["University of Wisconsin–Madison", "Facts: enrollment (51,822 students) and faculty and staff (28,017), Fall 2025", "wisc.edu", "2025", "https://www.wisc.edu/about/facts/"],
  ["Public Service Commission of Wisconsin", "Fiscal Year 2024 Energy Use in State Facilities Report (UW–Madison: 23,144,475 GSF; 18.83 kWh/GSF; 1.34 therm/GSF)", "PSC of Wisconsin", "2024", "https://psc.wi.gov/Documents/OEI/WisconsinEnergyStatistics/Energy%20Use%20in%20State%20Facilities%20Report/FY2024_State%20_Energy_Report.pdf"],
  ["Public Service Commission of Wisconsin", "Fiscal Year 2024 State Facilities CO₂e Report (UW–Madison: 15.66 thermal + 19.17 electric = 34.83 lb CO₂e/GSF)", "PSC of Wisconsin", "2024", "https://psc.wi.gov/Documents/OEI/WisconsinEnergyStatistics/Energy%20Use%20in%20State%20Facilities%20Report/FY2024_State_CO2e_Report.pdf"],
  ["Wisconsin Engineer", "The UW–Madison heating plants: staving off Wisconsin winters (plants generate up to 2.2 million lb/h of steam)", "Wisconsin Engineer magazine", "2016", "https://wisconsinengineer.com/2016/10/19/the-uw-madison-heating-plants-staving-off-wisconsin-winters/"],
];
export const cite = (...ns) => `<sup class="refsup">${ns.map(n => `<a class="ref" data-ref="${n}" href="#ref-${n}" title="${REFS[n - 1][0]}, ${REFS[n - 1][1].replace(/"/g, "'")}">${n}</a>`).join(",")}</sup>`;

// ---------- materials and geometry helpers ----------
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.05, ...o });
const metal = (color = "#b7bcc2") => mat(color, { metalness: 0.75, roughness: 0.32 });
const glow = color => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.6, transparent: true, opacity: 0.85, depthWrite: false });
function add(parent, geo, m, x = 0, y = 0, z = 0) { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; parent.add(o); return o; }
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (r, h, s = 24, r2 = r) => new THREE.CylinderGeometry(r2, r, h, s);
const cylX = (r, L, s = 24) => cyl(r, L, s).rotateZ(Math.PI / 2), cylZ = (r, L, s = 24) => cyl(r, L, s).rotateX(Math.PI / 2);
function shell(o, exp) { o.userData.shell = true; if (exp) o.userData.exp = new THREE.Vector3(...exp); return o; }
function label(parts, name, x, y, z) { parts.push([name, new THREE.Vector3(x, y, z)]); }
function tube(parent, pts, r, m) { const c = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)), false, "catmullrom", 0.05); const o = add(parent, new THREE.TubeGeometry(c, Math.max(16, pts.length * 12), r, 10), m); o.userData.curve = c; return o; }
function tracers(parent, n, color, size) {
  const pos = new Float32Array(n * 3), g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ color, size, sizeAttenuation: true, transparent: true, opacity: 0.9, depthWrite: false });
  const p = new THREE.Points(g, m); p.frustumCulled = false; parent.add(p);
  return { pos, geo: g, n, mat: m, u: new Float32Array(n).map(() => Math.random()), a: new Float32Array(n).map(() => Math.random()), b: new Float32Array(n).map(() => Math.random()) };
}
function alongCurves(tr, curves, dt, speed) {   // move tracers along a list of curves
  for (let i = 0; i < tr.n; i++) { tr.u[i] = Math.abs((tr.u[i] + dt * speed * (0.7 + 0.6 * tr.b[i])) % 1); const c = curves[Math.floor(tr.a[i] * curves.length)]; const p = c.getPointAt(tr.u[i]); tr.pos.set([p.x, p.y, p.z], i * 3); }
  tr.geo.attributes.position.needsUpdate = true;
}
export const thermalColor = (T, lo, hi, out = new THREE.Color()) => {
  const t = Math.min(1, Math.max(0, (T - lo) / (hi - lo)));
  const S = [[0, "#1b2a6b"], [0.3, "#2f7fc1"], [0.55, "#f2d14b"], [0.8, "#e8692c"], [1, "#b51d1d"]].map(([a, c]) => [a, new THREE.Color(c)]);
  for (let i = 1; i < S.length; i++) if (t <= S[i][0]) { const u = (t - S[i - 1][0]) / (S[i][0] - S[i - 1][0]); return out.copy(S[i - 1][1]).lerp(S[i][1], u); }
  return out.copy(S.at(-1)[1]);
};
function noiseTex(base, dots, n, size = 256, rep = 1) {
  const c = document.createElement("canvas"); c.width = c.height = size; const g = c.getContext("2d");
  g.fillStyle = base; g.fillRect(0, 0, size, size);
  for (let i = 0; i < n; i++) { g.fillStyle = dots[Math.floor(Math.random() * dots.length)]; g.beginPath(); g.arc(Math.random() * size, Math.random() * size, 0.8 + Math.random() * 2.2, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ===================================================================================
// detailed models
// ===================================================================================

// 0. The campus as a technology-pathway graph (the case-study superstructure), flows scaled to the scenario
function pathwayModel(S) {
  const g = new THREE.Group(), parts = [], R = S.R, o = S.o;
  const node = (name, x, y, color, r = 0.55) => { const n = add(g, new THREE.SphereGeometry(r, 24, 16), mat(color, { roughness: 0.35 }), x, y, 0); label(parts, name, x, y + r + 0.2, 0); return new THREE.Vector3(x, y, 0); };
  const tech = (name, x, y, color, on) => { const t = add(g, box(1.6, 0.9, 0.9), mat(on ? color : "#55595e", { roughness: 0.5, transparent: !on, opacity: on ? 1 : 0.35 }), x, y, 0); label(parts, name, x, y + 0.7, 0); return new THREE.Vector3(x, y, 0); };
  const sum = a => a.reduce((s, v) => s + v, 0);
  const inG = node("Grid electricity", -7, 3, "#8a5a2b"), inNG = node(`${FUELS[S.cfg.fuel].name.split(" (")[0]}`, -7, 0.6, "#f0a500"), inSun = node("Sun and wind", -7, -1.8, "#9aa0a6"), inGas = node("Gasoline", -7, -4.2, "#5b2a86");
  const c = S.cfg, hp = c.dist !== "steam";
  const tB = tech("Boilers", -1.5, 1.6, "#c0392b", R.boilMWh > 1), tHP = tech("Heat pumps", -1.5, 3.2, "#e67e22", hp && R.elecHeatMWh > 1), tCh = tech("Chillers", -1.5, -0.2, "#2f6fb0", true);
  const tPV = tech("Solar · wind · reactor", -1.5, -2, "#6b7c3a", c.solar + c.wind + c.nuclear > 1), tV = tech("Vehicles", -1.5, -4.2, "#0f7378", true), tCC = tech("CO₂ capture", 2.5, -3.2, "#3d5a80", !!c.ccs);
  const oE = node("Electricity", 6, 2.6, "#d4ac0d"), oH = node("Heat", 6, 0.8, "#c0392b"), oC = node("Cooling", 6, -1, "#2f6fb0"), oK = node("km travelled", 6, -2.8, "#0f7378"), oCO = node("CO₂ to air", 6, -4.6, "#7f7f7f");
  const W = (v, ref) => Math.max(0.02, Math.min(0.35, 0.35 * Math.sqrt(Math.max(0, v) / ref)));
  const ref = 600e3, flows = [];
  const F = (a, b, v, color) => { if (v <= 1) return; const mid = a.clone().lerp(b, 0.5); mid.z = 0.6; const t = tube(g, [[a.x, a.y, 0], [mid.x, mid.y, mid.z], [b.x, b.y, 0]], W(v, ref), mat(color, { transparent: true, opacity: 0.7 })); flows.push(t.userData.curve); };
  F(inG, oE, R.gridMWh - R.hpMWh - R.chMWh, "#b07a3b"); F(inG, tHP, R.hpMWh, "#b07a3b"); F(inG, tCh, R.chMWh, "#b07a3b");
  F(inNG, tB, R.fuelMWh, "#f0a500"); F(inSun, tPV, R.solarMWh + R.windMWh + R.nucMWh, "#9aa0a6"); F(tPV, oE, R.solarMWh + R.windMWh + R.nucMWh - R.exportMWh, "#9aa0a6");
  F(tB, oH, R.boilMWh, "#c0392b"); F(tHP, oH, R.elecHeatMWh, "#e67e22"); F(tCh, oC, sum(o.coolLoad), "#2f6fb0");
  F(inGas, tV, (1 - c.ev) * CASE.fleet_km / CASE.km_per_gal * 33.7 / 1000 * 20, "#5b2a86"); F(tV, oK, 2e5, "#0f7378");
  F(tB, tCC, R.captured_kt * 1000, "#3d5a80"); F(tB, oCO, R.kt.heating * 1000 * 2, "#7f7f7f"); F(inG, oCO, (R.kt.power + R.kt.cooling) * 1000 * 1.5, "#9f8f80");
  const tr = tracers(g, 500, "#ffffff", 0.09);
  return { group: g, parts, fit: 16, explodeAxis: "x", cutZ: 5, update(dt) { if (flows.length) alongCurves(tr, flows, dt, 0.18); } };
}

// 1. Gas-fired water-tube boiler (D-type package boiler) at the Charter Street plant
function boilerModel() {
  const g = new THREE.Group(), parts = [], L = 11;
  const casing = shell(add(g, box(L, 7.2, 4.6), mat("#9aa3ab", { metalness: 0.5, roughness: 0.5 }), 0, 3.6, 0), [0, 0, -5]);
  add(g, box(L + 0.6, 0.4, 5), mat("#55595e"), 0, 0.2, 0);
  add(g, cylX(0.85, L - 0.4), metal("#c9cdd2"), 0, 6.3, -0.9);           // steam drum
  add(g, cylX(0.5, L - 0.4), metal("#c9cdd2"), 0, 1.0, -0.9);            // mud drum
  const tm = metal("#8f969d");
  for (let i = 0; i < 18; i++) for (let j = 0; j < 4; j++) add(g, cyl(0.04, 5.0, 8), tm, -L / 2 + 0.6 + i * 0.58, 3.65, -0.4 - j * 0.32);
  const wall = new THREE.Group(); g.add(wall); for (let i = 0; i < 20; i++) shell(add(wall, cyl(0.04, 5.6, 8), metal("#7e858b"), -L / 2 + 0.5 + i * 0.52, 3.6, 1.9));
  const flame = add(g, new THREE.ConeGeometry(0.9, 6, 24, 1, true).rotateZ(Math.PI / 2), glow("#ff8a2a"), -1.6, 3.4, 0.9); flame.castShadow = false;
  const core = add(g, new THREE.ConeGeometry(0.45, 3.4, 24, 1, true).rotateZ(Math.PI / 2), glow("#ffe08a"), -3.0, 3.4, 0.9); core.castShadow = false;
  add(g, cylX(0.7, 1.2), mat("#3a3c40"), -L / 2 - 0.5, 3.4, 0.9);       // burner register
  add(g, box(1.4, 1.6, 1.4), mat(CARDINAL), -L / 2 - 1.6, 1.2, 0.9);    // forced-draft fan
  add(g, box(2.2, 1.6, 2.6), metal("#9da4aa"), L / 2 - 1.2, 8.0, 0);     // economizer
  add(g, cyl(0.6, 5, 20), metal("#a9adb2"), L / 2 - 1.2, 11.3, 0);       // stack
  const gas = tracers(g, 400, "#ffb26b", 0.12);
  const curves = [new THREE.CatmullRomCurve3([[-4.5, 3.4, 0.9], [3, 3.4, 1], [4.8, 3.6, 0], [3, 3.6, -1], [-3, 3.8, -0.9], [-4.6, 5.5, -0.3], [4.3, 8, 0], [4.3, 13.5, 0]].map(p => new THREE.Vector3(...p)))];
  label(parts, "Low-NOx gas burner", -L / 2 - 0.5, 3.4, 0.9);
  label(parts, "Forced-draft fan", -L / 2 - 1.6, 2.1, 0.9);
  label(parts, "Furnace and flame", -1.6, 3.4, 0.9);
  label(parts, "Membrane water wall", 0, 5.5, 1.9);
  label(parts, "Steam drum (separates steam from water)", 2, 7.2, -0.9);
  label(parts, "Generating tube bank (boiling)", 1, 3.6, -0.9);
  label(parts, "Mud drum", -2, 1.0, -0.9);
  label(parts, "Economizer (heats feedwater with flue gas)", L / 2 - 1.2, 8.9, 0);
  label(parts, "Stack", L / 2 - 1.2, 13.4, 0);
  label(parts, "Insulated steel casing", 0, 7.3, -2.3);
  return { group: g, parts, fit: 14, cutZ: 0.0, update(dt, S) { const q = Math.max(0.05, S.now.boil / Math.max(1, S.R.peakBoil)); flame.scale.set(0.4 + q, 0.4 + 0.6 * q, 0.4 + 0.6 * q); core.scale.copy(flame.scale); flame.visible = core.visible = S.now.boil > 0.5; gas.mat.opacity = S.now.boil > 0.5 ? 0.85 : 0; alongCurves(gas, curves, dt, 0.08 + 0.2 * q); } };
}

// 2. Gas turbine with heat-recovery steam generator (the cogeneration plant)
function chpModel() {
  const g = new THREE.Group(), parts = [];
  const shaft = new THREE.Group(); g.add(shaft); shaft.position.set(-6, 2.2, 0);
  add(shaft, cylX(0.18, 13), metal("#9aa0a6"), 0, 0, 0);
  for (let i = 0; i < 12; i++) { const r = 1.25 - i * 0.055, d = add(shaft, cylX(r, 0.12, 40), metal(i < 12 ? "#c3c8cd" : "#a0a6ab"), -4.6 + i * 0.32, 0, 0); }
  for (let i = 0; i < 4; i++) add(shaft, cylX(1.0 + i * 0.12, 0.2, 40), metal("#b48a5a"), 1.7 + i * 0.45, 0, 0);
  const casing = shell(add(g, cylX(1.5, 10, 40), mat("#a7adb3", { metalness: 0.5 }), -6.3, 2.2, 0), [0, 3, 0]);
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; add(g, cylX(0.22, 1.6, 16), mat("#d39b5a", { metalness: 0.5 }), -5.9, 2.2 + Math.cos(a) * 1.15, Math.sin(a) * 1.15); }
  const flame = add(g, new THREE.TorusGeometry(1.1, 0.16, 12, 40).rotateY(Math.PI / 2), glow("#ff8a2a"), -5.9, 2.2, 0); flame.castShadow = false;
  add(g, box(4, 3, 3), mat(CARDINAL), -13.8, 2.2, 0);                    // generator
  add(g, cylX(0.35, 1.8), metal(), -11.9, 2.2, 0);
  add(g, new THREE.CylinderGeometry(1.5, 2.3, 3, 32, 1, true).rotateZ(Math.PI / 2), mat("#8e959b", { metalness: 0.5, side: THREE.DoubleSide }), 0.2, 2.2, 0);
  const hrsg = shell(add(g, box(9, 7, 5), mat("#b9bdc0", { metalness: 0.3 }), 6.4, 3.5, 0), [0, 0, -6]);
  const cols = ["#c0392b", "#e67e22", "#2f6fb0"]; for (let s = 0; s < 3; s++) for (let i = 0; i < 9; i++) add(g, cyl(0.07, 6.2, 8), metal(cols[s]), 2.6 + s * 2.8 + (i % 3) * 0.55, 3.5, -1.8 + Math.floor(i / 3) * 1.6 + (i % 3) * 0.2);
  add(g, cylX(0.55, 4), metal("#cfd3d7"), 6.4, 7.7, 0); add(g, cyl(0.9, 9, 24), metal("#a9adb2"), 11.4, 7.5, 0);
  const gas = tracers(g, 500, "#ffcf8a", 0.12);
  const curves = [new THREE.CatmullRomCurve3([[-11, 2.2, 0], [-6, 2.2, 0.6], [-1, 2.2, -0.4], [2, 3, 0], [6, 3.5, 0.2], [10, 3.5, -0.2], [11.4, 5, 0], [11.4, 12, 0]].map(p => new THREE.Vector3(...p)))];
  label(parts, "Generator", -13.8, 3.9, 0);
  label(parts, "Axial compressor (≈ 15:1)", -9.2, 2.2, 0);
  label(parts, "Combustor cans", -5.9, 3.5, 0);
  label(parts, "Turbine stages (≈ 1,300 °C inlet)", -3.6, 2.2, 0);
  label(parts, "Exhaust diffuser (≈ 550 °C)", 0.2, 2.2, 0);
  label(parts, "Superheater", 2.9, 3.5, 0);
  label(parts, "Evaporator", 5.7, 3.5, 0);
  label(parts, "Economizer", 8.5, 3.5, 0);
  label(parts, "HRSG steam drum", 6.4, 8.3, 0);
  label(parts, "Stack (≈ 120 °C)", 11.4, 12, 0);
  return { group: g, parts, fit: 20, cutZ: 0, update(dt) { shaft.rotation.x += dt * 9; alongCurves(gas, curves, dt, 0.2); flame.material.emissiveIntensity = 1.2 + 0.4 * Math.sin(performance.now() / 90); } };
}

// 3. Steam tunnel and direct-buried hot-water / chilled-water mains
function networkModel(S) {
  const g = new THREE.Group(), parts = [], L = 8;
  const soil = shell(add(g, box(L, 5, 9), mat("#7a6248", { map: noiseTex("#7a6248", ["#5c4a36", "#8e7558"], 1500, 256, 2) }), 0, -2.5, 0), [0, 0, 6]);
  add(g, box(L, 0.2, 9), mat("#4d7a3c"), 0, 0.1, 0);
  // concrete walk-through steam tunnel
  const tun = new THREE.Group(); g.add(tun); tun.position.set(0, -2.3, -2.2);
  for (const [w, h, x, y] of [[0.25, 2.6, -1.4, 0], [0.25, 2.6, 1.4, 0], [3.05, 0.25, 0, 1.4], [3.05, 0.25, 0, -1.4]]) add(tun, box(L, h, w).rotateY(Math.PI / 2).rotateY(-Math.PI / 2), mat("#a8a59e"), 0, y, x).scale.set(1, 1, 1);
  tun.children.forEach((m, i) => { m.geometry.dispose(); m.geometry = i < 2 ? box(L, 2.6, 0.25) : box(L, 0.25, 3.05); }); shell(tun.children[1]);
  const steamIns = add(tun, cylX(0.225, L, 32), mat("#d9d4c7", { roughness: 0.9 }), 0, 0.5, -0.6); shell(steamIns, [0, 0.6, 0]);
  const steamP = add(tun, cylX(0.15, L + 0.4, 32), metal("#c0392b"), 0, 0.5, -0.6);
  add(tun, cylX(0.11, L, 24), mat("#d9d4c7", { roughness: 0.9 }), 0, -0.3, -0.7); add(tun, cylX(0.06, L + 0.4, 16), metal("#e67e22"), 0, -0.3, -0.7);
  add(tun, box(L, 0.08, 0.9), metal("#777"), 0, -1.0, 0.6);
  // direct-buried pre-insulated pipes (hot water or chilled water)
  const hw = add(g, cylX(0.3, L, 32), mat("#2c2c2c"), 0, -1.6, 2.0); shell(hw, [0, 1.2, 0]);
  add(g, cylX(0.18, L + 0.4, 24), metal("#e67e22"), 0, -1.6, 2.0);
  add(g, cylX(0.3, L, 32), mat("#2c2c2c"), 0, -1.6, 2.9); add(g, cylX(0.18, L + 0.4, 24), metal("#e9b43a"), 0, -1.6, 2.9);
  add(g, cylX(0.45, L + 0.4, 32), metal("#2f6fb0"), 0, -2.6, -0.2 + 4.0); add(g, cylX(0.45, L + 0.4, 32), metal("#6aa3e0"), 0, -3.7, 3.8);
  const heat = tracers(g, 260, "#ffb26b", 0.07);
  const curves = [new THREE.CatmullRomCurve3([new THREE.Vector3(-L / 2, -1.8, -2.8), new THREE.Vector3(L / 2, -1.8, -2.8)])];
  label(parts, "Walk-through concrete steam tunnel", -2.5, -0.9, -3.6);
  label(parts, "Steam main, 180 °C (≈ 300 mm)", 2, -1.8, -2.8);
  label(parts, "Mineral-wool insulation, 75 mm", -1, -1.58, -2.8);
  label(parts, "Condensate return, ≈ 85 °C", 1.5, -2.6, -2.9);
  label(parts, "Pre-insulated hot-water pipes (PUR foam, PE jacket)", -1.5, -1.3, 2.4);
  label(parts, "Chilled-water supply / return, ≈ 900 mm", 1.5, -3.1, 3.8);
  label(parts, "Glacial soil and backfill", 3, -4.2, 0);
  return { group: g, parts, fit: 11, cutZ: -2.2, explodeAxis: "y",
    update(dt, S) { const st = S.cfg.dist === "steam"; steamP.material.color.set(st ? "#c0392b" : "#6b6f73"); alongCurves(heat, curves, dt, 0.25); heat.mat.opacity = st ? 0.6 : 0.1; } };
}

// 4. Electric centrifugal chiller with cooling tower cell
function chillerModel() {
  const g = new THREE.Group(), parts = [], L = 6;
  const evap = shell(add(g, cylX(0.85, L, 40), mat("#2b7a6b", { metalness: 0.4 }), 0, 1.0, 0), [0, 0, -3]);
  const cond = shell(add(g, cylX(0.75, L, 40), mat("#2b7a6b", { metalness: 0.4 }), 0, 2.75, 0), [0, 0, -3]);
  const tm = metal("#c48a5a"); for (let i = 0; i < 26; i++) { add(g, cylX(0.03, L - 0.2, 6), tm, 0, 0.6 + (i % 6) * 0.16, -0.5 + Math.floor(i / 6) * 0.25); }
  for (let i = 0; i < 20; i++) add(g, cylX(0.03, L - 0.2, 6), tm, 0, 2.45 + (i % 5) * 0.14, -0.45 + Math.floor(i / 5) * 0.28);
  for (const x of [-L / 2, L / 2]) { add(g, cylX(0.9, 0.25, 40), mat("#24685b", { metalness: 0.4 }), x, 1.0, 0); add(g, cylX(0.8, 0.25, 40), mat("#24685b", { metalness: 0.4 }), x, 2.75, 0); }
  const comp = new THREE.Group(); g.add(comp); comp.position.set(1.4, 4.2, 0);
  add(comp, new THREE.TorusGeometry(0.55, 0.28, 16, 40), mat("#2b7a6b", { metalness: 0.4 }), 0, 0, 0);
  const imp = new THREE.Group(); comp.add(imp); for (let k = 0; k < 10; k++) { const b = add(imp, box(0.5, 0.05, 0.18), metal("#d0d4d8"), 0, 0, 0); b.rotation.z = k * Math.PI / 5; b.position.set(Math.cos(k * Math.PI / 5) * 0.25, Math.sin(k * Math.PI / 5) * 0.25, 0); }
  add(g, cylX(0.6, 2, 32), mat("#3a6fa0"), -0.6, 4.2, 0);
  tube(g, [[1.4, 3.6, 0.3], [1.4, 3.2, 0.3]], 0.25, metal("#c0c4c8")); tube(g, [[0.7, 4.2, 0.6], [-1.5, 3.5, 0.8], [-1.5, 3.0, 0.6]], 0.2, metal("#c0c4c8"));
  for (const [y, z, c] of [[1.0, 1.1, "#2f6fb0"], [1.0, -1.1, "#6aa3e0"], [2.75, 1.0, "#2e8540"], [2.75, -1.0, "#5cc276"]]) add(g, cylZ(0.25, 0.6, 20), metal(c), -2.4, y, z);
  // cooling tower cell
  const ct = shell(add(g, box(4, 4, 4), mat("#b9bcbc"), 6.5, 2, 0), [0, 0, -4]);
  add(g, box(3.6, 1.6, 3.6), mat("#7d8d8f", { map: noiseTex("#7d8d8f", ["#61706f", "#9aa7a8"], 2000) }), 6.5, 1.6, 0);
  const fan = new THREE.Group(); g.add(fan); fan.position.set(6.5, 4.4, 0); add(fan, cyl(1.6, 0.6, 32), mat("#4a4d52"), 0, 0, 0);
  const blades = new THREE.Group(); fan.add(blades); for (let k = 0; k < 6; k++) { const b = add(blades, box(1.4, 0.05, 0.3), metal(), 0, 0.35, 0); b.rotation.y = k * Math.PI / 3; b.position.set(Math.cos(k * Math.PI / 3) * 0.7, 0.35, Math.sin(k * Math.PI / 3) * 0.7); b.rotation.y = -k * Math.PI / 3; }
  const water = tracers(g, 300, "#bfe3ff", 0.06);
  label(parts, "Evaporator: refrigerant boils at ≈ 4 °C, chills water 13 → 6 °C", 0, 1.0, 0.86);
  label(parts, "Condenser: refrigerant condenses at ≈ 35 °C", -1, 2.75, 0.76);
  label(parts, "Copper tube bundles", 2.5, 0.8, 0);
  label(parts, "Centrifugal compressor (impeller)", 1.4, 4.2, 0);
  label(parts, "Variable-speed motor", -0.6, 4.2, 0.6);
  label(parts, "Chilled-water nozzles", -2.4, 1.0, 1.1);
  label(parts, "Condenser-water nozzles", -2.4, 2.75, 1.0);
  label(parts, "Cooling tower fill (evaporative)", 6.5, 1.6, 1.8);
  label(parts, "Tower fan", 6.5, 4.8, 0);
  return { group: g, parts, fit: 11, cutZ: 0, update(dt, S) { const q = S.now.cool / Math.max(1, S.R.peakCool); imp.rotation.z += dt * (6 + 30 * q); blades.rotation.y += dt * (2 + 10 * q);
    for (let i = 0; i < water.n; i++) { water.u[i] = (water.u[i] + dt * 0.5) % 1; water.pos.set([6.5 + (water.a[i] - 0.5) * 3.4, 3.6 - water.u[i] * 3.2, (water.b[i] - 0.5) * 3.4], i * 3); } water.geo.attributes.position.needsUpdate = true; } };
}

// 5. Laboratory building: envelope, 100 % outside-air ventilation, fume hoods, rooftop AHU, basement heat exchanger
function buildingModel() {
  const g = new THREE.Group(), parts = [], W = 24, D = 14, Hs = 4.2, n = 4;
  const facade = shell(add(g, box(W, n * Hs, D), mat("#a5533f", { transparent: true, opacity: 0.96 }), 0, n * Hs / 2, 0), [0, 0, -16]);
  for (let k = 0; k <= n; k++) add(g, box(W - 0.2, 0.3, D - 0.2), mat("#c9c5bb"), 0, k * Hs, 0);
  for (let k = 0; k < n; k++) for (let i = 0; i < 5; i++) { add(g, box(1.8, 2.3, 0.9), mat("#d8dcdf", { metalness: 0.3 }), -9 + i * 4.5, k * Hs + 1.45, -5.6); add(g, cyl(0.2, Hs - 2.5, 12), metal(), -9 + i * 4.5, k * Hs + Hs - 0.9, -5.6); }
  add(g, box(10, 3, 5), mat("#c2c7cc", { metalness: 0.4 }), -5, n * Hs + 1.5, 2);
  add(g, cylZ(1.3, 0.4, 32), mat(CARDINAL), -1.2, n * Hs + 1.5, 2);    // heat-recovery wheel
  for (let i = 0; i < 3; i++) add(g, cyl(0.6, 6, 16), metal(), 5 + i * 2.5, n * Hs + 3, -4);
  add(g, box(4, 2.4, 3), metal("#8f969d"), 6, -1.2, 3); add(g, box(W, 0.2, D), mat("#777"), 0, -2.6, 0);
  tube(g, [[6, -0.2, 3], [6, n * Hs - 0.5, 3]], 0.18, metal("#c0392b"));
  tube(g, [[7, -0.2, 3.6], [7, n * Hs - 0.5, 3.6]], 0.22, metal("#2f6fb0"));
  const air = tracers(g, 500, "#d6ecff", 0.12);
  const curves = [new THREE.CatmullRomCurve3([[-12, n * Hs + 1.5, 2], [-5, n * Hs + 1.5, 2], [-2, n * Hs - 1, 1], [-9, 10, 3], [-9, 3, 0], [-9, 1.5, -5.6], [-9, 15, -5.6], [5, n * Hs + 7, -4]].map(p => new THREE.Vector3(...p)))];
  label(parts, "Brick and glass envelope (UA)", 0, n * Hs / 2, D / 2);
  label(parts, "Fume hoods: once-through exhaust", -4.5, Hs + 1.45, -5.6);
  label(parts, "Rooftop air handler (100 % outside air)", -5, n * Hs + 3.2, 2);
  label(parts, "Heat-recovery wheel", -1.2, n * Hs + 1.5, 2.3);
  label(parts, "Exhaust fans and stacks", 7.5, n * Hs + 6, -4);
  label(parts, "Steam-to-hot-water converter (basement)", 6, -1.2, 3);
  label(parts, "Heating riser", 6, 8, 3);
  label(parts, "Chilled-water riser", 7, 10, 3.6);
  return { group: g, parts, fit: 26, cutZ: 0, update(dt) { alongCurves(air, curves, dt, 0.1); } };
}

// 6. Grid connection: power transformer and a battery container
function gridModel() {
  const g = new THREE.Group(), parts = [];
  const tank = shell(add(g, box(4.4, 3.6, 2.2), mat("#6e7a6b", { metalness: 0.4 }), 0, 2.2, 0), [0, 0, -3]);
  add(g, box(4.8, 0.4, 2.6), mat("#555"), 0, 0.2, 0);
  const core = mat("#5a5f66", { metalness: 0.6 }); for (const x of [-1.4, 0, 1.4]) { add(g, box(0.45, 2.6, 0.45), core, x, 2.2, 0); add(g, cyl(0.62, 2.2, 32), mat("#b87333", { metalness: 0.7, roughness: 0.35 }), x, 2.2, 0); add(g, cyl(0.42, 2.25, 32), mat("#d99a5a", { metalness: 0.6 }), x, 2.2, 0); }
  add(g, box(3.6, 0.45, 0.45), core, 0, 3.6, 0); add(g, box(3.6, 0.45, 0.45), core, 0, 0.8, 0);
  for (const x of [-1.4, 0, 1.4]) { add(g, cyl(0.12, 1.6, 12, 0.2), mat("#e9e6de"), x, 4.8, -0.5); add(g, cyl(0.1, 1.1, 12, 0.16), mat("#e9e6de"), x, 4.6, 0.6); }
  for (let i = 0; i < 6; i++) add(g, box(0.05, 2.8, 1.2), metal("#7f8a7c"), -1.9 + i * 0.75, 2.2, 1.8);
  // battery container
  const cont = shell(add(g, box(6.1, 2.6, 2.4), mat("#ececec"), 0, 1.3, -5), [0, 3, 0]);
  for (let r = 0; r < 2; r++) for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) add(g, box(0.6, 0.28, 0.7), mat(j % 2 ? "#2f3b4a" : "#3d4a5b"), -2.4 + i * 0.8, 0.3 + j * 0.31, -5.6 + r * 1.2);
  add(g, box(0.8, 2.2, 1.6), mat("#c9ccd0"), 2.6, 1.2, -5);
  label(parts, "Oil-filled tank", 0, 3.8, 1.1);
  label(parts, "Laminated steel core", 0, 3.6, 0);
  label(parts, "Copper windings (HV outer, LV inner)", 1.4, 2.2, 0.62);
  label(parts, "Bushings", 0, 5.6, -0.5);
  label(parts, "Radiators", 0, 2.2, 1.8);
  label(parts, "Battery container (≈ 4 MWh)", 0, 2.7, -5);
  label(parts, "Li-ion modules in racks", -1, 1.2, -5.6);
  label(parts, "Inverter / power conversion", 2.6, 2.4, -5);
  return { group: g, parts, fit: 9, cutZ: 0, explodeAxis: "y" };
}

// 7. Solar PV: module layers and a tilted rack
function pvModel() {
  const g = new THREE.Group(), parts = [];
  const cellTex = (() => { const c = document.createElement("canvas"); c.width = 384; c.height = 256; const x = c.getContext("2d"); x.fillStyle = "#e6e6e6"; x.fillRect(0, 0, 384, 256);
    for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) { x.fillStyle = "#1d2d52"; x.fillRect(i * 64 + 2, j * 64 + 2, 60, 60); x.strokeStyle = "#9aa3ad"; x.lineWidth = 0.6; for (let k = 0; k < 12; k++) { x.beginPath(); x.moveTo(i * 64 + 2, j * 64 + 6 + k * 5); x.lineTo(i * 64 + 62, j * 64 + 6 + k * 5); x.stroke(); } x.fillStyle = "#c9cdd2"; x.fillRect(i * 64 + 20, j * 64 + 2, 2, 60); x.fillRect(i * 64 + 42, j * 64 + 2, 2, 60); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const W = 1.7, D = 1.0, layers = new THREE.Group(); g.add(layers); layers.position.set(-1.6, 0.6, 0);
  const L = [["Tempered glass, 3.2 mm (anti-reflective)", "#cfe3ee", 0.03, { transparent: true, opacity: 0.45, roughness: 0.05 }], ["EVA encapsulant", "#f2f2ea", 0.01, { transparent: true, opacity: 0.6 }],
    ["Monocrystalline Si cells, ≈ 22 %", "#ffffff", 0.01, { map: cellTex, roughness: 0.3, metalness: 0.3 }], ["EVA encapsulant (rear)", "#f2f2ea", 0.01, { transparent: true, opacity: 0.6 }], ["Backsheet (PET/fluoropolymer)", "#fafafa", 0.01, {}]];
  L.forEach(([n, c, t, o], i) => { const m = add(layers, box(W, t, D), mat(c, o), 0, 0.5 - i * 0.03, 0); m.userData.exp = new THREE.Vector3(0, (4 - i) * 0.12, 0); label(parts, n, W / 2, 0.5 - i * 0.03 + (4 - i) * 0.0, 0); });
  add(layers, box(W + 0.06, 0.04, 0.04), metal("#c0c4c8"), 0, 0.42, D / 2); add(layers, box(W + 0.06, 0.04, 0.04), metal("#c0c4c8"), 0, 0.42, -D / 2);
  add(layers, box(0.15, 0.03, 0.1), mat("#222"), 0, 0.38, 0);
  // rack of 3 modules tilted to the south
  const rack = new THREE.Group(); g.add(rack); rack.position.set(1.6, 0, 0);
  for (let i = 0; i < 3; i++) { const p = add(rack, box(1.0, 0.04, 1.7), mat("#ffffff", { map: cellTex, roughness: 0.3 }), -1.05 + i * 1.05, 0.9, 0); p.rotation.x = -0.6; }
  for (const x of [-1.5, 1.5]) { add(rack, box(0.06, 0.9, 0.06), metal(), x, 0.45, 0.6); add(rack, box(0.06, 1.6, 0.06), metal(), x, 0.8, -0.6); }
  label(parts, "Aluminium frame and junction box", 0, 0.42, D / 2);
  label(parts, "Fixed-tilt rack, ≈ 35° facing south", 1.6, 0.9, 0);
  return { group: g, parts, fit: 4.2, cutZ: 5, explodeAxis: "y" };
}

// 8. Water-to-water heat-recovery heat pump (vapour-compression cycle shown with refrigerant tracers)
function heatpumpModel() {
  const g = new THREE.Group(), parts = [], L = 5;
  const evap = shell(add(g, cylX(0.75, L, 40), mat("#2f6fb0", { metalness: 0.4 }), 0, 0.9, 0), [0, 0, -3]);
  const cond = shell(add(g, cylX(0.7, L, 40), mat("#c0392b", { metalness: 0.4 }), 0, 2.6, 0), [0, 0, -3]);
  const tm = metal("#c48a5a"); for (let i = 0; i < 20; i++) { add(g, cylX(0.03, L - 0.2, 6), tm, 0, 0.55 + (i % 5) * 0.16, -0.45 + Math.floor(i / 5) * 0.28); add(g, cylX(0.03, L - 0.2, 6), tm, 0, 2.3 + (i % 5) * 0.13, -0.42 + Math.floor(i / 5) * 0.27); }
  const comp = add(g, cyl(0.45, 1.6, 24), mat("#5a6068", { metalness: 0.5 }), 1.8, 4.0, 0); comp.rotation.z = Math.PI / 2;
  const scr = new THREE.Group(); g.add(scr); scr.position.set(1.8, 4.0, 0); for (let k = 0; k < 2; k++) { const s = add(scr, new THREE.TorusKnotGeometry(0.16, 0.05, 64, 8, 2, 7), metal("#d0d4d8"), 0, 0, (k - 0.5) * 0.3); s.scale.set(1, 1, 1); }
  add(g, cylX(0.5, 1.6, 24), mat("#3a6fa0"), -0.2, 4.0, 0);
  const valve = add(g, new THREE.OctahedronGeometry(0.22), metal("#f2c618"), -2.8, 1.7, 0.9);
  const ref = mat("#bfc4c9", { metalness: 0.6 });
  const loop = [tube(g, [[1.0, 1.5, 0.6], [1.8, 2.0, 0.9], [1.8, 3.6, 0.6]], 0.08, ref), tube(g, [[2.6, 4.0, 0], [2.8, 3.6, 0.6], [2.2, 3.1, 0.6]], 0.08, ref), tube(g, [[-2.2, 2.2, 0.6], [-2.8, 2.0, 0.9], [-2.8, 1.4, 0.9], [-2.2, 1.2, 0.6]], 0.06, ref)];
  const rc = loop.map(t => t.userData.curve);
  const rt = tracers(g, 240, "#ffffff", 0.08);
  for (const [y, z, c] of [[0.9, 1.0, "#6aa3e0"], [0.9, -1.0, "#2f6fb0"], [2.6, 0.95, "#e67e22"], [2.6, -0.95, "#c0392b"]]) add(g, cylZ(0.22, 0.6, 20), metal(c), -2.0, y, z);
  label(parts, "Evaporator: takes heat from chilled-water return (≈ 13 °C)", 0, 0.9, 0.76);
  label(parts, "Condenser: delivers heat to the hot-water loop", -1, 2.6, 0.7);
  label(parts, "Twin-screw compressor", 1.8, 4.0, 0);
  label(parts, "Motor (variable speed)", -0.2, 4.0, 0.5);
  label(parts, "Expansion valve", -2.8, 1.7, 0.9);
  label(parts, "Refrigerant circuit (low-GWP HFO)", 1.8, 2.2, 0.9);
  label(parts, "Water nozzles: cold side (blue), hot side (red)", -2.0, 1.75, 1.0);
  return { group: g, parts, fit: 8, cutZ: 0, update(dt, S) { scr.rotation.x += dt * 12 * Math.min(1, 0.2 + S.now.hpP / Math.max(1, S.R.peakElec * 0.3)); alongCurves(rt, rc, dt, 0.4); } };
}

// 9. Geothermal borefield: soil column with U-tube boreholes, grout, header
function boreModel(S) {
  const g = new THREE.Group(), parts = [], Dp = 60, sp = 6, n = 3;   // a 60 m slice of a 200 m bore, 3 × 3 bores at 6 m spacing
  const layers = [["Topsoil and glacial till", 0, 15, "#7a6248"], ["Outwash sand and gravel", 15, 30, "#a08a62"], ["Cambrian sandstone", 30, 60, "#c2a477"]];
  const soilM = [];
  for (const [name, a, b, c] of layers) { const m = mat(c, { map: noiseTex(c, ["#5c4a36", "#d8c3a0"], 1200, 256, 2) }); soilM.push(m); const o = shell(add(g, box(sp * n, b - a, sp * n), m, 0, -(a + b) / 2, 0), [0, 0, sp * n * 1.2]); label(parts, name, sp * n / 2, -(a + b) / 2, sp * n / 2); }
  add(g, box(sp * n + 1, 0.4, sp * n + 1), mat("#4f8a3f"), 0, 0.2, 0);
  const grout = mat("#bfbab0", { transparent: true, opacity: 0.55 }), pipeD = mat("#1f6fb5"), pipeU = mat("#e0402a");
  const curves = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const x = (i - 1) * sp, z = (j - 1) * sp;
    add(g, cyl(0.075, Dp, 16), grout, x, -Dp / 2, z);
    add(g, cyl(0.016, Dp, 8), pipeD, x - 0.035, -Dp / 2, z); add(g, cyl(0.016, Dp, 8), pipeU, x + 0.035, -Dp / 2, z);
    curves.push(new THREE.CatmullRomCurve3([new THREE.Vector3(x - 0.035, -0.5, z), new THREE.Vector3(x - 0.035, -Dp, z), new THREE.Vector3(x + 0.035, -Dp, z), new THREE.Vector3(x + 0.035, -0.5, z)])); }
  tube(g, [[-sp, -1.5, -sp], [-sp, -1.5, sp], [sp, -1.5, sp], [sp, -1.5, -sp]], 0.1, mat("#2c2c2c"));
  add(g, box(2.6, 2.2, 2.6), mat("#9a9a94"), sp * 1.6, 0.2, 0);
  const fl = tracers(g, 400, "#bfe3ff", 0.12);
  label(parts, "HDPE U-tube, 32 mm (down / up)", -sp + 0.04, -20, -sp);
  label(parts, "Thermally enhanced grout, 150 mm bore", 0, -40, 0);
  label(parts, "Horizontal header (1.5 m deep)", 0, -1.5, sp);
  label(parts, "Manifold vault to the heat-pump plant", sp * 1.6, 1.4, 0);
  let thermal = false; const base = soilM.map(m => m.color.clone()), maps = soilM.map(m => m.map);
  return { group: g, parts, fit: 70, cutZ: 0.2, explodeAxis: "y",
    actions: [{ label: "Ground temperature", fn: b => { thermal = !thermal; b.setAttribute("aria-pressed", String(thermal)); soilM.forEach((m, i) => { m.map = thermal ? null : maps[i]; m.needsUpdate = true; }); } }],
    update(dt, S) { alongCurves(fl, curves, dt, 0.06); const Tg = S.o.Tg ?? BORE.Tg0; soilM.forEach((m, i) => thermal ? thermalColor(Tg + (i === 0 ? (S.now.T - Tg) * 0.25 : 0), -5, 25, m.color) : m.color.copy(base[i])); } };
}

// 10. Stratified thermal-storage tank
function tesModel() {
  const g = new THREE.Group(), parts = [], H = 30, r = 14;
  const wallM = mat("#e7dcc4", { metalness: 0.2 }); const wall = shell(add(g, cyl(r + 0.4, H, 64), wallM, 0, H / 2, 0), [0, 0, -2 * r]);
  add(g, cyl(r + 0.8, 0.8, 64), mat("#8a8a84"), 0, 0.4, 0);
  const hot = add(g, cyl(r - 0.05, 1, 64), mat("#d9472b", { transparent: true, opacity: 0.75 }), 0, 0, 0), cold = add(g, cyl(r - 0.05, 1, 64), mat("#2f6fb0", { transparent: true, opacity: 0.75 }), 0, 0, 0);
  const cline = add(g, cyl(r - 0.05, 1, 64), mat("#d6a2c8", { transparent: true, opacity: 0.6 }), 0, 0, 0);
  for (const y of [H - 1.2, 1.2]) { const ring = add(g, new THREE.TorusGeometry(r * 0.6, 0.3, 12, 8), metal(), 0, y, 0); ring.rotation.x = Math.PI / 2; }
  tube(g, [[r * 0.6, H - 1.2, 0], [r + 3, H - 1.2, 0], [r + 3, 0.5, 0]], 0.5, metal("#c0392b")); tube(g, [[r * 0.6, 1.2, 0], [r + 5, 1.2, 0]], 0.5, metal("#2f6fb0"));
  label(parts, "Hot zone", 0, H - 4, 0);
  label(parts, "Thermocline (≈ 1 m mixing layer)", 0, H / 2, 0);
  label(parts, "Cold zone", 0, 4, 0);
  label(parts, "Octagonal diffuser (slow, even inflow)", r * 0.6, H - 1.2, 0);
  label(parts, "Bottom diffuser", r * 0.6, 1.2, 0);
  label(parts, "Insulated steel shell", r, H * 0.75, r * 0.3);
  return { group: g, parts, fit: 40, cutZ: 0, update(dt, S) {
    const soc = S.cfg.tesH > 0 && S.cfg.dist !== "steam" ? S.now.tesHs / S.cfg.tesH : S.cfg.tesC > 0 ? S.now.tesCs / S.cfg.tesC : 0.5, yc = H * (1 - soc), th = 1.2;
    hot.scale.y = Math.max(0.01, H - yc - th / 2); hot.position.y = (yc + th / 2 + H) / 2; cold.scale.y = Math.max(0.01, yc - th / 2); cold.position.y = (yc - th / 2) / 2; cline.scale.y = th; cline.position.y = yc; } };
}

// 11. Amine post-combustion capture: absorber, cross exchanger, stripper with reboiler
function ccsModel() {
  const g = new THREE.Group(), parts = [];
  const absorber = shell(add(g, cyl(2.2, 24, 40), mat("#a9adb2", { metalness: 0.5 }), -5, 12, 0), [0, 0, -5]);
  for (let k = 0; k < 3; k++) add(g, cyl(2.1, 4.5, 32), mat("#c4a46a", { map: noiseTex("#c4a46a", ["#9b8050", "#e0c890"], 2500) }), -5, 4 + k * 6.2, 0);
  const stripper = shell(add(g, cyl(1.5, 18, 32), mat("#a9adb2", { metalness: 0.5 }), 6, 9, 0), [0, 0, -4]);
  for (let k = 0; k < 2; k++) add(g, cyl(1.4, 4.5, 32), mat("#c4a46a"), 6, 5 + k * 6, 0);
  add(g, box(3, 2, 2), metal("#8f969d"), 0.5, 2, 2); add(g, cylX(0.9, 3.2), mat("#c0392b", { metalness: 0.4 }), 6, 1.2, 2.4);
  add(g, cylX(0.6, 2.6), mat("#2f6fb0"), 6, 19, 1.6); add(g, box(2, 2, 2), mat(CARDINAL), 10.5, 1, 0);
  tube(g, [[-5, 0.8, 2.2], [-1, 1.2, 2], [0.5, 2, 2], [4, 15, 1.4], [6, 15, 0]], 0.25, metal("#7a5c2e"));
  tube(g, [[6, 0.5, -1.5], [2, 1.5, -2], [0.5, 2, -1.8], [-3, 22, -1.6], [-5, 22, 0]], 0.25, metal("#d7c27a"));
  tube(g, [[-12, 2, 0], [-7.2, 2, 0]], 0.9, mat("#7d7d7d"));
  const gas = tracers(g, 350, "#d8d8d8", 0.18), liq = tracers(g, 300, "#e8c062", 0.12), co2 = tracers(g, 160, "#8fd0ff", 0.14);
  label(parts, "Flue gas from boilers (≈ 9 % CO₂ wet)", -10, 2, 0);
  label(parts, "Absorber with structured packing", -5, 10, 0);
  label(parts, "Lean amine (30 wt % MEA) in at top", -5, 22, -1.6);
  label(parts, "Rich amine out at bottom", -5, 0.8, 2.2);
  label(parts, "Lean/rich cross heat exchanger", 0.5, 2, 2);
  label(parts, "Stripper (regenerator)", 6, 9, 0);
  label(parts, "Steam reboiler, ≈ 120 °C", 6, 1.2, 2.4);
  label(parts, "Overhead condenser", 6, 19, 1.6);
  label(parts, "CO₂ compressor to pipeline / storage", 10.5, 2, 0);
  return { group: g, parts, fit: 28, cutZ: 0, update(dt, S) {
    for (let i = 0; i < gas.n; i++) { gas.u[i] = (gas.u[i] + dt * 0.1) % 1; const a = gas.a[i] * 6.28, rr = Math.sqrt(gas.b[i]) * 2; gas.pos.set([-5 + Math.cos(a) * rr, 1 + gas.u[i] * 24, Math.sin(a) * rr], i * 3); }
    for (let i = 0; i < liq.n; i++) { liq.u[i] = (liq.u[i] + dt * 0.18) % 1; const a = liq.a[i] * 6.28, rr = Math.sqrt(liq.b[i]) * 2, k = liq.a[i] > 0.5; liq.pos.set([(k ? -5 : 6) + Math.cos(a) * rr * (k ? 1 : 0.7), (k ? 23 : 17) - liq.u[i] * (k ? 22 : 15), Math.sin(a) * rr], i * 3); }
    for (let i = 0; i < co2.n; i++) { co2.u[i] = (co2.u[i] + dt * 0.25) % 1; co2.pos.set([6 + (co2.a[i] - 0.5) * 1.5 + co2.u[i] * 4.5 * (co2.u[i] > 0.6 ? 1 : 0), co2.u[i] < 0.6 ? 2 + co2.u[i] * 30 : 20 - (co2.u[i] - 0.6) * 47, (co2.b[i] - 0.5) * 1.5], i * 3); }
    for (const t of [gas, liq, co2]) { t.geo.attributes.position.needsUpdate = true; t.mat.opacity = S.cfg.ccs ? 0.9 : 0.15; } } };
}

// 12. PEM electrolyser stack
function electrolyserModel() {
  const g = new THREE.Group(), parts = [], N = 14;
  add(g, box(0.25, 1.4, 1.4), metal("#7a7f86"), -2.1, 1, 0); add(g, box(0.25, 1.4, 1.4), metal("#7a7f86"), 2.1, 1, 0);
  for (let i = 0; i < N; i++) { const x = -1.8 + i * 3.6 / (N - 1);
    const bp = add(g, box(0.09, 1.2, 1.2), metal("#9aa0a6"), x, 1, 0); bp.userData.exp = new THREE.Vector3((x) * 0.6, 0, 0);
    if (i < N - 1) { const m = add(g, box(0.05, 1.0, 1.0), mat("#2c2c2c"), x + 0.13, 1, 0); m.userData.exp = new THREE.Vector3((x + 0.13) * 0.6, 0, 0); } }
  for (const [y, z] of [[1.6, 0.6], [1.6, -0.6], [0.4, 0.6], [0.4, -0.6]]) add(g, cylX(0.04, 4.8, 8), metal(), 0, y, z);
  tube(g, [[2.2, 1.5, 0.4], [3.2, 1.6, 0.4], [3.2, 2.6, 0.4]], 0.08, metal("#5cc276")); tube(g, [[2.2, 1.5, -0.4], [3.2, 1.6, -0.4], [3.2, 2.6, -0.4]], 0.08, metal("#6aa3e0"));
  const h2 = tracers(g, 300, "#d8f5d8", 0.05);
  label(parts, "End plate and current collector", -2.1, 1.7, 0);
  label(parts, "Titanium bipolar plates with flow fields", -0.8, 1.6, 0);
  label(parts, "Membrane-electrode assembly (Nafion, Ir anode, Pt cathode)", 0.4, 1, 0);
  label(parts, "Tie rods", 0, 1.6, 0.6);
  label(parts, "H₂ out (cathode)", 3.2, 2.6, 0.4);
  label(parts, "O₂ + water out (anode)", 3.2, 2.6, -0.4);
  return { group: g, parts, fit: 5.5, cutZ: 5, update(dt) { for (let i = 0; i < h2.n; i++) { h2.u[i] = (h2.u[i] + dt * 0.3) % 1; h2.pos.set([-1.8 + h2.a[i] * 3.6, 0.45 + h2.u[i] * 1.1, (h2.b[i] - 0.5) * 1.1], i * 3); } h2.geo.attributes.position.needsUpdate = true; } };
}

// ===================================================================================
// tour stops
// ===================================================================================
const T = "T", A = "A", C = "C";   // Typical, Assumption, Case-study data
export const STOPS = [
  { id: "system", title: "The campus energy system", where: "CBE 450 case study · the whole campus", model: pathwayModel,
    role: "About 50,000 students, 2.3 million m² of buildings and a carbon footprint near half a million tonnes of CO₂ a year. Four products have to be delivered every hour: electricity, heat, cooling and transport. The case study asked for a technology-pathway model that meets those demands at least cost, then traces how cost rises as emissions are cut from 0 to 100 %.",
    specs: [["Electricity demand", `402,637 MWh/yr${cite(18)}`, C], ["Steam demand", "1.04 Mt/yr (≈ 579 GWh heat)", C], ["Chilled water", "24 Mt/yr at 60 kJ/kg (≈ 406 GWh)", C], ["Fleet", "912 vehicles, 7.3 million km/yr", C], ["Emissions estimate", `≈ 500 kt/yr: power 240, heating 134, cooling 90, transport 36${cite(18)}`, C], ["Grid emission factor", `0.56 t CO₂/MWh (2019 state mix)${cite(5)}`, C], ["Campus goals", `100 % renewable electricity by 2030, net zero by 2048${cite(6)}`, T]],
    live: S => ({ rows: [["Scenario", S.cfg.name], ["Annual emissions", `${f0(S.R.kt.total)} kt CO₂ (${S.cmp.cut >= 0 ? "−" : "+"}${f0(Math.abs(S.cmp.cut * 100))} %)`], ["Annualized cost", `${M$(S.R.annual)}/yr`], ["Capital needed", M$(S.R.capex)], ["Heat load now", `${f0(S.now.heat)} MW`], ["Electricity load now", `${f0(S.now.elec)} MW`]] }) },
  { id: "charter", title: "Gas-fired boilers", where: "Charter Street and Walnut Street heating plants", model: boilerModel,
    role: "Natural gas burns in a furnace lined with water-filled tubes; the water boils, the steam drum separates steam from water, and steam at about 1,000 kPa goes out through the tunnels. Charter Street was converted from coal to natural gas in 2013. Today these boilers carry almost all campus heating and the steam that drives some of the chillers.",
    specs: [["Fuel", `Natural gas in five boilers at Charter Street; fuel-oil backup${cite(7)}`, C], ["Steam", "≈ 1,000 kPa, 180 °C (data sheet)", C], ["Boiler efficiency", "85 % HHV on steam (calibrated to FY2024 state data); 90–94 % condensing on hot water", T], ["CO₂ per kg CH₄", `2.75 kg (data sheet)${cite(18)}`, C], ["Gas emission factor", `53.06 kg CO₂/MMBtu = 0.181 t/MWh${cite(11)}`, C], ["Gas price", "$5.0/MMBtu delivered", T], ["Burner", "Low-NOx with flue-gas recirculation", T], ["Plants modelled", "Charter St + Walnut St as one boiler fleet", A]],
    live: S => ({ rows: [["Boiler heat output now", `${f0(S.now.boil)} MW`], ["Gas firing now", `${f0(S.now.fuel)} MW (HHV)`], ["Gas use this year", `${f0(S.R.fuelMWh / 1000)} GWh = ${f1(S.R.fuelMWh * 3.412 / 1e6)} million MMBtu`], ["Peak boiler duty", `${f0(S.R.peakBoil)} MW`], ["Fuel", FUELS[S.cfg.fuel].name], ["Boiler efficiency", `${f0(DIST[S.cfg.dist].etaB * 100)} % HHV`]] }) },
  { id: "wccf", title: "Cogeneration: gas turbine + HRSG", where: "West Campus Cogeneration Facility", model: chpModel,
    role: "A gas turbine burns fuel at high pressure and spins a generator; its 550 °C exhaust raises steam in a heat-recovery steam generator. The West Campus Cogeneration Facility (about 150 MW, opened 2005) is run by the local utility and supplies steam and chilled water to campus. Here its electricity counts as part of the grid; the CHP slider adds campus-dispatched CHP.",
    specs: [["Electric output", `150 MW; electricity, steam and chilled water${cite(8)}`, C], ["Case data per hour", `38 t CH₄ → 150 MWh + 225 t steam + 114 t CO₂${cite(18)}`, C], ["Campus CHP model", "η_e = 33 %, η_th = 45 % (HHV)", T], ["Pressure ratio", "≈ 15–20", T], ["Turbine inlet", "≈ 1,300 °C", T], ["HRSG stack", "≈ 120 °C", T], ["Accounting", "Existing WCCF power in grid mix; campus CHP optional", A]],
    live: S => { const ef = FUELS[S.cfg.fuel].ef, chpEF = ef * (1 / 0.33 - 0.45 / (0.33 * DIST[S.cfg.dist].etaB)); return { rows: [["Campus CHP size", `${f0(S.cfg.chp)} MWₑ`], ["CHP power now", `${f1(S.now.chpE)} MW`], ["CHP CO₂ per MWhₑ (heat credited)", `${f2(chpEF)} t/MWh`], ["Grid CO₂ per MWh", `${f2(S.cfg.grid)} t/MWh`], ["Verdict", chpEF < S.cfg.grid ? "CHP cuts CO₂ against this grid" : "Grid is cleaner than CHP"]] }; } },
  { id: "network", title: "Steam tunnels and chilled-water mains", where: "Under campus streets", model: networkModel,
    role: "Steam leaves the plants at about 180 °C through walk-through concrete tunnels and comes back as condensate; chilled water circulates in large buried pipes. Heat leaks through the insulation all year, and steam traps and aging joints add to it. Converting to hot water at 50–70 °C cuts those losses and makes heat pumps possible, but every building's connection has to change.",
    specs: [["Network length", `${NET.km} km of trench`, A], ["Steam pipe", "300 mm, 75 mm mineral wool, k = 0.045 W/m·K", T], ["Hot-water pipe", "Pre-insulated PUR, k = 0.027 W/m·K", T], ["Aging, traps, leaks", "× 1.8 on steam losses, × 1.1–1.15 on hot water", A], ["Chilled water", "6 °C supply, ≈ 13 °C return; Δp 500 kPa", C], ["Pump efficiency", "75 %", T]],
    live: S => { const st = netLoss("steam"), hw = netLoss("hw70"); return { rows: [["This network", DIST[S.cfg.dist].name], ["Heat loss, steam network", `${f1(st.MW)} MW = ${f0(st.MW * 8760 / 1000)} GWh/yr`], ["Heat loss, 70 °C hot water", `${f1(hw.MW)} MW = ${f0(hw.MW * 8760 / 1000)} GWh/yr`], ["Share of heat lost now", `${f1(S.R.lossMWh / S.R.heatMWh * 100)} %`], ["Pumping power now", `${f2(S.now.pump)} MW`]] }; } },
  { id: "chiller", title: "Chillers and cooling towers", where: "Chilled-water plants", model: chillerModel,
    role: "A vapour-compression chiller boils refrigerant at about 4 °C to chill water, compresses the vapour and condenses it at about 35 °C into condenser water that the cooling tower cools by evaporation. Some campus chillers are driven by steam instead of electricity. Steam-driven chilling uses far more primary energy, so electric chilling is usually the first step.",
    specs: [["Electric chiller COP", "≈ 5–7 (Carnot fraction 0.6)", T], ["Steam-driven chillers", `Steam-turbine chillers at Charter and Walnut Streets${cite(7)}; COP ≈ ${ABS_COP} (cooling per unit of steam heat), calibrated to FY2024 state data`, T], ["Steam-driven share today", "50 % of cooling (calibrated)", A], ["Tower approach", "≈ 4 K to wet bulb; condenser ≈ 9 K above wet bulb", T], ["Lab and data-centre base load", "26 MW all year", A], ["Electric-chiller cost", "$400k per MWₜₕ", T]],
    live: S => ({ rows: [["Cooling load now", `${f0(S.now.cool)} MW (${f0(S.now.cool / 3.517)}k tons)`], ["Wet bulb now", `${f1(S.now.Twb)} °C`], ["Electric chiller COP now", f2(S.now.copCh)], ["Electric chillers / steam-driven", `${f0(S.now.elCh)} / ${f0(S.now.stCh)} MW`], ["Chiller electricity now", `${f1(S.now.chP)} MW`], ["Peak cooling", `${f0(S.R.peakCool)} MW`]] }) },
  { id: "building", title: "A laboratory building", where: "Engineering campus", model: buildingModel,
    role: "Labs are the energy hogs of a research campus: fume hoods and safety codes require 100 % outside air, often 6–10 air changes an hour, heated or cooled once and thrown away. Envelope losses scale with the indoor-outdoor temperature difference; ventilation losses scale with airflow. Heat-recovery wheels, hood sash management and setbacks are the cheapest tonnes.",
    specs: [["Campus floor area", "2.3 million m²", C], ["Base heat (reheat, hot water, labs)", "≈ 30 MW all year", A], ["Heating balance point", "18 °C", A], ["Labs vs offices", `4–6× the energy of an office${cite(15)}`, T], ["Lab ventilation", "6–10 air changes per hour", T], ["Heat-recovery wheel", "≈ 60–75 % effective", T], ["Retrofit cost", "$25/m² per 10 % saved", A]],
    live: S => ({ rows: [["Outdoor air now", `${f1(S.now.T)} °C`], ["Campus heat demand now", `${f0(S.now.heat)} MW`], ["Campus cooling demand now", `${f0(S.now.cool)} MW`], ["Building electricity now", `${f0(S.now.elecB)} MW`], ["Efficiency setting", `${f0(S.cfg.eff)} % saved`], ["Peak heat demand", `${f0(S.R.peakHeat)} MW`]] }) },
  { id: "grid", title: "Grid electricity and batteries", where: "Campus substation", model: gridModel,
    role: "Most campus electricity is bought from the local utility through substations like this one. Its carbon content depends on the utility's mix of coal, gas, nuclear and renewables; the utility plans deep cuts this decade. Batteries shave the campus peak, which sets demand charges, and soak up surplus solar.",
    specs: [["Grid emission factor (today)", `0.56 t CO₂/MWh${cite(5)}`, C], ["Utility 2030 target", `≈ 80 % lower CO₂ (≈ 0.11 t/MWh)${cite(6)}`, T], ["Electricity price", `$99.8/MWh${cite(18)}`, C], ["Demand charge", "$15/kW-month", A], ["Export value", "$30/MWh, no carbon credit", A], ["Battery", `$465k/MWh, 4-hour, 94 % one-way${cite(6)}`, T]],
    live: S => ({ rows: [["Grid import now", `${f0(S.now.grid)} MW`], ["Export now", `${f1(S.now.exp)} MW`], ["Battery charge", `${f0(S.now.battS)} of ${f0(S.cfg.batt)} MWh`], ["Grid electricity this year", `${f0(S.R.gridMWh / 1000)} GWh`], ["Peak import", `${f0(S.R.peakGrid)} MW`], ["Grid CO₂", `${f0(S.R.gridMWh * S.cfg.grid / 1000)} kt/yr`]] }) },
  { id: "solar", title: "Solar PV and wind", where: "Rooftops, a solar farm and a wind PPA", model: pvModel,
    role: "Silicon cells turn about a fifth of the sunlight into electricity; heat lowers the voltage. Rooftops can host a few tens of MW, so larger amounts mean land off campus or power-purchase agreements for solar and wind farms. In the class this was the first and cheapest step for nearly every team.",
    specs: [["Existing campus PV", "≈ 0.04 MW", T], ["Rooftop potential", "≈ 36 MW", T], ["PV capacity factor, Madison", "14.5 % (AC)", T], ["Wind capacity factor", `36 % (data sheet)${cite(18)}`, C], ["Solar CAPEX / O&M", `$1.33M per MW, $22k/MW-yr${cite(6)}`, T], ["Wind CAPEX / O&M", `$2.63M per MW, $36k/MW-yr${cite(6)}`, T], ["Land", "≈ 2 ha per MW of solar", T]],
    live: S => ({ rows: [["Sunlight now", `${f0(S.now.ghi)} W/m²`], ["Solar output now", `${f1(S.now.solar)} MW of ${f0(S.cfg.solar)} MW`], ["Wind output now", `${f1(S.now.wind)} MW of ${f0(S.cfg.wind)} MW`], ["Solar this year", `${f0(S.R.solarMWh / 1000)} GWh`], ["Wind this year", `${f0(S.R.windMWh / 1000)} GWh`], ["LCOE solar / wind", `$${f0(lcoe("solar", 0.145, S.cfg.rate))} / $${f0(lcoe("wind", 0.36, S.cfg.rate))} per MWh`]] }) },
  { id: "heatpump", title: "Heat-recovery heat pumps", where: "Assumption: a new plant next to Charter Street", model: heatpumpModel,
    role: "A heat pump runs the chiller cycle on purpose: it takes heat from a cold source and lifts it to a useful temperature. On a campus that cools labs and data centres all year, the best source is the chilled-water return: one machine heats and cools at the same time. Air and ground are the other sources. Heat pumps can't make 180 °C steam efficiently, so they need a hot-water network.",
    specs: [["Carnot fraction", "0.55 water-to-water, 0.5 ground, 0.45 air", T], ["Approach temperatures", "3 K condenser, 5 K evaporator", A], ["Source temperatures", "Chilled-water return 13 °C; ground ≈ 10 °C; outdoor air", T], ["Air-source cutoff", "−20 °C", T], ["Installed cost", "$0.6M per MWₜₕ (air $0.75M)", T], ["Refrigerant", "HFO / HFO blend or ammonia", T]],
    live: S => ({ rows: [["Distribution", DIST[S.cfg.dist].name], ["COP now: heat recovery / ground / air", S.cfg.dist === "steam" ? "n/a: steam network" : `${f2(S.now.copHR)} / ${f2(S.now.copGS)} / ${S.now.copAS ? f2(S.now.copAS) : "off"}`], ["Heat from heat pumps now", `${f0(S.now.hr + S.now.gs + S.now.as)} MW`], ["Heat-pump electricity now", `${f1(S.now.hpP)} MW`], ["Electrified share of heat", `${f0(S.R.elecHeatMWh / S.R.heatMWh * 100)} %`], ["Seasonal COP", S.R.hpMWh > 0 ? f2(S.R.copGSavg) : "–"]] }) },
  { id: "borefield", title: "Geothermal borefield", where: "Assumption: under the recreation fields near Walnut Street", model: boreModel,
    role: "Hundreds to thousands of 200 m boreholes, each a plastic U-tube grouted into the ground, turn the earth into a seasonal heat battery: heat pumps pull heat out in winter and push it back when they cool in summer. If extraction and rejection don't balance, the ground drifts colder year after year and the COP falls.",
    specs: [["Bore depth / spacing", `${BORE.L} m / ${BORE.s} m`, T], ["Undisturbed ground", `${BORE.Tg0} °C`, T], ["Ground conductivity", `${BORE.k} W/m·K`, T], ["Peak extraction", `${BORE.qmax} W per m of bore`, T], ["Borehole + short-term resistance", `${BORE.Rb} m·K/W`, A], ["Long-term g-function", `g ≈ ${BORE.g} at 25 years`, A], ["Cost", "$25k per bore ($125/m)", T]],
    live: S => ({ rows: [["Bores", f0(S.cfg.bores)], ["Field area", `${f1(S.cfg.bores * BORE.s * BORE.s / 1e4)} ha`], ["Heat extracted / rejected", `${f0(S.o.Eext / 1000)} / ${f0(S.o.Erej / 1000)} GWh/yr`], ["Net flux", `${f1(S.o.qnet || 0)} W/m`], ["Ground drift after 25 yr", `${(S.o.drift25 || 0) >= 0 ? "+" : ""}${f1(S.o.drift25 || 0)} K${Math.abs(S.o.drift25 || 0) > 3 ? " · unbalanced" : ""}`], ["Ground-source COP now", S.cfg.dist === "steam" ? "n/a" : f2(S.now.copGS)]] }) },
  { id: "tes", title: "Thermal energy storage", where: "Tank farm near Walnut Street", model: tesModel,
    role: "A big insulated tank of water stores heat (or cold) as a temperature difference. Warm water floats on cold, so the tank stays stratified, with a thin mixing layer, the thermocline, that moves up and down as it charges and discharges. Storage lets heat pumps and chillers run at night or off-peak and covers peaks without extra boilers.",
    specs: [["Hot tank ΔT", "30 K (70/40 °C) or 25 K (50/25 °C)", A], ["Chilled tank ΔT", "8 K", A], ["Hot-water storage cost", "$30k per MWhₜₕ", T], ["Chilled-water storage cost", "$25k per MWhₜₕ", T], ["Standing loss", "≈ 0.5 %/day", A], ["Dispatch", "Charge on spare heat-pump capacity; discharge when heat pumps fall short", A]],
    live: S => ({ rows: [["Hot storage", S.cfg.dist === "steam" ? "needs hot-water network" : `${f0(S.now.tesHs)} of ${f0(S.cfg.tesH)} MWh`], ["Hot tank volume", `${f0(S.tanks?.H?.V || 0)} m³`], ["Chilled storage", `${f0(S.now.tesCs)} of ${f0(S.cfg.tesC)} MWh`], ["Chilled tank volume", `${f0(S.tanks?.C?.V || 0)} m³`], ["Discharging now (heat / cold)", `${f1(S.now.tesHd)} / ${f1(S.now.tesCd)} MW`]] }) },
  { id: "ccs", title: "Carbon capture on the boilers", where: "Assumption: beside Charter Street", model: ccsModel,
    role: "Flue gas rises through packing against a falling amine solution that reacts with CO₂. The CO₂-rich solvent is heated in a stripper to release nearly pure CO₂ for compression and storage. The regeneration steam is the big cost: the boilers have to burn more gas to capture the CO₂ from burning gas. Many teams used capture as the mid-depth step.",
    specs: [["Capture rate", "90 %", T], ["Regeneration energy", "≈ 3.0 GJ per t CO₂ (0.83 MWhₜₕ)", T], ["Compression + fans", "≈ 0.11 MWhₑ per t", T], ["Capital", `$713 per t/yr of capacity${cite(18)}`, T], ["Operating", `$22/t + $25/t transport and storage${cite(18)}`, T], ["Solvent", "30 wt % monoethanolamine", T]],
    live: S => ({ rows: [["Capture", S.cfg.ccs ? "on" : "off"], ["CO₂ captured", `${f0(S.R.captured_kt)} kt/yr`], ["Extra gas for regeneration", S.cfg.ccs ? `${f0((1 - 1 / (1 / (1 - 0.9 * FUELS[S.cfg.fuel].ef * 0.83 / DIST[S.cfg.dist].etaB))) * 100)} % more fuel` : "–"], ["Capture now", `${f1(S.now.capt)} t/h`], ["Cost of capture", S.cfg.ccs ? `$${f0(ccsCostPerT(S.cfg.rate))}/t captured` : "–"]] }) },
  { id: "h2", title: "Green hydrogen", where: "Assumption: electrolysers beside the heating plant", model: electrolyserModel,
    role: "A PEM electrolyser splits water with electricity: hydrogen at the cathode, oxygen at the anode. Burned in the boilers, hydrogen makes no CO₂, but every MWh of hydrogen takes about 1.4 MWh of electricity, so it is only as clean as that power and roughly four times the cost of gas. In the class it was always the expensive tail.",
    specs: [["Electricity", `55 kWh per kg H₂ (2022 status)${cite(14)}`, T], ["Water", "≈ 9 kg per kg H₂", T], ["Electrolyser cost", "$1.7M per MW", T], ["Blend option", "20 vol % H₂ = 7 % of fuel energy", T], ["Operation", "Flat load all year (storage assumed)", A]],
    live: S => ({ rows: [["Fuel", FUELS[S.cfg.fuel].name], ["Hydrogen per year", `${f0((S.o.h2kg || 0) / 1000)} t`], ["Electrolyser load", `${f0(S.o.h2MW || 0)} MW`], ["Electricity for H₂", `${f0(S.R.h2MWh / 1000)} GWh/yr`], ["CO₂ from that power", `${f0(S.R.h2MWh * S.cfg.grid / 1000)} kt/yr`]] }) },
];
const ccsCostPerT = r => COST.ccs.perTyr * crf(r, COST.ccs.life) + COST.ccs.op + COST.ccs.storage;

// equations at work
const TH = {
  system: S => { const R = S.R, c = S.cmp; return [
    eq(["CBE 250"], `Σ ${sub(I("ṁ"), "in")}Δ${I("h")} = ${sub(I("Q"), "heat")} + ${sub(I("Q"), "cool")} + ${sub(I("E"), "el")} + losses`, `Annual energy balance on the campus. In: ${f0(R.gridMWh / 1000)} GWh of grid power, ${f0(R.fuelMWh / 1000)} GWh of fuel and ${f0((R.solarMWh + R.windMWh + R.nucMWh) / 1000)} GWh of on-site or contracted clean power. Out: ${f0(HEAT_GWh)} GWh of heat, ${f0(COOL_GWh)} GWh of cooling, ${f0(CASE.elec_MWh / 1000)} GWh of building electricity.`),
    eq(["CBE 450"], `min Σ${sub(I("c"), "t")}${sub(I("x"), "t")} s.t. Σ${sub("α", "pt")}${sub(I("x"), "t")} ≥ ${sub(I("d"), "p")}, Σ${sub(I("e"), "t")}${sub(I("x"), "t")} ≤ (1 − φ)${sub(I("E"), "0")}`, `The case study's technology-pathway model: choose technology levels x to meet each product demand at least cost with emissions capped at a fraction (1 − φ) of today's. This model runs one scenario at a time hour by hour; the cost-vs-emissions chart is the Pareto front the teams traced.`),
    eq(["CBE 450"], `NPV = −ΔCAPEX + Σ<sub>t=1..25</sub> ΔOPEX/(1 + ${I("r")})<sup>t</sup>`, `Against the current campus at r = ${f1(S.cfg.rate * 100)} %: ${M$(c.npv)}. Annualized with the capital-recovery factor CRF = r(1+r)ⁿ/((1+r)ⁿ − 1) for each asset's life.`),
    eq(["CBE 450"], `abatement cost = Δ(annual cost)/Δ(annual CO₂)`, Number.isFinite(c.abate) ? `${M$(c.dAnnual)}/yr more for ${f0(S.R0.kt.total - R.kt.total)} kt/yr less: $${f0(c.abate)} per tonne. Compare a carbon price (slider) or the social cost of carbon (≈ $190/t).` : "Pick a scenario that cuts emissions to see its cost per tonne avoided."),
  ]; },
  charter: S => { const D = DIST[S.cfg.dist]; return [
    eq(["CBE 310", "CBE 430"], `CH₄ + 2 O₂ → CO₂ + 2 H₂O, HHV = 55.5 MJ/kg`, `Stoichiometry gives 44/16 = 2.75 kg CO₂ per kg CH₄ (the data-sheet value) and 2.75/55.5 = 0.050 kg/MJ = 0.178 t/MWh. Pipeline gas with some ethane: 0.181 t/MWh, used here.`),
    eq(["CBE 250"], `η = ${sub(I("ṁ"), "s")}(${sub(I("h"), "s")} − ${sub(I("h"), "fw")})/(${sub(I("ṁ"), "f")}·HHV)`, `At ${f0(D.etaB * 100)} % the boilers burn ${f0(S.now.fuel)} MW of gas (${f1(S.now.fuel * 3.6 / 55.5)} t/h CH₄) to deliver ${f0(S.now.boil)} MW of heat now.`),
    eq(["CBE 310"], `Δ${I("h")} = ${sub(I("h"), "g")}(1 MPa) − ${sub(I("h"), "f")}(85 °C) = 2,778 − 356 kJ/kg`, `Raising saturated steam from condensate takes 2,422 kJ/kg; buildings use about 2,000 kJ/kg of it (the data sheet's value) before the condensate returns.`),
    eq(["CBE 326"], `${sub(I("q"), "stack")} = ${sub(I("ṁ"), "fg")}${sub(I("c"), "p")}(${sub(I("T"), "stack")} − ${sub(I("T"), "air")}) + latent loss`, `Most of the lost 10–18 % leaves up the stack. Cooling flue gas below its ≈ 55 °C dew point (possible with 40 °C or 25 °C return water) condenses the water vapour and recovers its latent heat, so hot-water boilers reach ${f0(DIST.hw70.etaB * 100)}–${f0(DIST.hw50.etaB * 100)} %.`),
    eq(["CBE 430"], `${I("k")} = ${I("A")} exp(−${sub(I("E"), "a")}/${I("RT")}), N₂ + O → NO + N`, "Thermal NOx (Zeldovich) is extremely temperature sensitive. Recirculating flue gas into the burner cools the flame by a few hundred kelvin and cuts NOx several-fold."),
    eq(["CBE 560"], `C₆H₁₂O₆ → 3 CH₄ + 3 CO₂ (anaerobic digestion)`, `Renewable natural gas comes from digesting manure, food waste or sludge; its carbon is recent. Life-cycle ≈ ${f2(EF.rng)} t/MWh vs ${f2(EF.ng)} for fossil gas, at 5–10× the price.`),
  ]; },
  wccf: S => { const ef = FUELS[S.cfg.fuel].ef, eb = DIST[S.cfg.dist].etaB, chpEF = ef * (1 / 0.33 - 0.45 / (0.33 * eb)); return [
    eq(["CBE 310"], `${sub("η", "Brayton")} = 1 − ${sub(I("r"), "p")}<sup>−(γ−1)/γ</sup>`, `Ideal Brayton efficiency at a 15:1 pressure ratio and γ = 1.4: ${f0((1 - 15 ** (-0.4 / 1.4)) * 100)} %. Real simple-cycle turbines get 33–40 % after component losses; the hot exhaust carries most of the rest.`),
    eq(["CBE 250"], `${I("F")} = ${I("P")}/${sub("η", "e")}, ${I("Q")} = ${I("F")}${sub("η", "th")}`, `Case data: 38 t/h of CH₄ (≈ ${f0(38 * 55.5 / 3.6)} MW HHV) gives 150 MW of power and 225 t/h of steam (≈ ${f0(225 * 2.0 / 3.6)} MW of heat), and 38 × 2.75 = 104.5 t/h of CO₂ by stoichiometry (the sheet says 114).`),
    eq(["CBE 450", "CBE 512"], `${sub("ε", "CHP")} = ${sub("ε", "f")}(1/${sub("η", "e")} − ${sub("η", "th")}/(${sub("η", "e")}${sub("η", "b")}))`, `CO₂ per MWh of CHP power after crediting the boiler fuel its heat displaces: ${f2(chpEF)} t/MWh vs the grid's ${f2(S.cfg.grid)}. CHP cuts CO₂ only while the grid is dirtier than ${f2(chpEF)}; as the grid cleans up, the same plant starts adding CO₂.`),
    eq(["CBE 326"], `${I("Q")} = ${sub(I("ṁ"), "g")}${sub(I("c"), "p")}(${sub(I("T"), "in")} − ${sub(I("T"), "stack")}), pinch ≥ 10 K`, "The HRSG cools 550 °C exhaust to about 120 °C. The pinch between the gas and the boiling water in the evaporator sets how much steam one kilogram of exhaust can raise."),
  ]; },
  network: S => { const st = netLoss("steam"), hw = netLoss("hw70"), q = S.now.cool, V = q * 1000 / (4.186 * 7); return [
    eq(["CBE 320"], `${I("q′")} = 2π${I("k")}(${sub(I("T"), "pipe")} − ${sub(I("T"), "amb")})/ln(${sub(I("r"), "2")}/${sub(I("r"), "1")})`, `Conduction through cylindrical insulation: steam main ${f0(st.qs)} W/m and condensate ${f0(st.qr)} W/m; a 70 °C hot-water pair loses ${f0(hw.qs)} + ${f0(hw.qr)} W/m with foam insulation.`),
    eq(["CBE 250"], `${sub(I("Q"), "loss")} = ${I("q′")}${I("L")}·aging`, `Over ${NET.km} km: steam ${f1(st.MW)} MW all year (${f0(st.MW * 8760 / 1000)} GWh, ${f1(st.MW * 8760 / 1000 / HEAT_GWh * 100)} % of the heat sold); hot water ${f1(hw.MW)} MW.`),
    eq(["CBE 326"], `${I("P")} = ${I("V̇")}Δ${I("p")}/η, ${I("V̇")} = ${I("Q")}/(ρ${sub(I("c"), "p")}Δ${I("T")})`, `Chilled water now: ${f0(V)} kg/s at a 7 K rise to carry ${f0(q)} MW; at 500 kPa and 75 % that is ${f2(V * 500 / 0.75 / 1e6)} MW of pumping. A wider ΔT means less flow and less pumping.`),
  ]; },
  chiller: S => { const Tc = S.now.Twb + 9; return [
    eq(["CBE 310"], `COP = η·${sub(I("T"), "e")}/(${sub(I("T"), "c")} − ${sub(I("T"), "e")})`, `Evaporator 4 °C, condenser ${f1(Tc)} °C (wet bulb + 9 K): Carnot ${f1(277.15 / (Tc - 4))}, × 0.6 = ${f2(S.now.copCh)}. Cool, dry nights lift COP; the hottest humid afternoons cut it.`),
    eq(["CBE 311"], `${sub(I("T"), "wb")} from ${I("T")}, RH (Stull 2011)${cite(17)}`, `A cooling tower can only cool water toward the wet-bulb temperature: now ${f1(S.now.Twb)} °C at ${f1(S.now.T)} °C air. Psychrometrics, not dry-bulb temperature, sets the chiller lift.`),
    eq(["CBE 250"], `${sub(I("ṁ"), "evap")} ≈ ${sub(I("Q"), "rej")}/λ, ${sub(I("Q"), "rej")} = ${I("Q")}(1 + 1/COP)`, `The towers reject ${f0(S.now.cool * (1 + 1 / S.now.copCh))} MW now, evaporating about ${f0(S.now.cool * (1 + 1 / S.now.copCh) / 2.43 * 3.6)} m³/h of water.`),
    eq(["CBE 450"], `steam-driven: ${sub(I("F"), "gas")} = ${I("Q")}/(COP·${sub("η", "b")}); electric: ${I("E")} = ${I("Q")}/COP`, `Per MWh of cooling: steam-driven ${f2(1 / (ABS_COP * DIST.steam.etaB))} MWh of gas (${f2(EF.ng / (ABS_COP * DIST.steam.etaB))} t CO₂); electric ${f2(1 / S.now.copCh)} MWh of power (${f2(S.cfg.grid / S.now.copCh)} t CO₂ at today's grid).`),
  ]; },
  building: S => [
    eq(["CBE 326"], `${I("Q")} = ${I("UA")}(${sub(I("T"), "b")} − ${sub(I("T"), "o")}) + ρ${I("V̇")}${sub(I("c"), "p")}(1 − ε)(${sub(I("T"), "s")} − ${sub(I("T"), "o")}) + base`, `Campus heat demand as a degree-hour model: base load plus a lumped UA of ${f1(S.L.UAh)} MW/K below an 18 °C balance point. At ${f1(S.now.T)} °C: ${f0(S.now.heat)} MW. ε is the heat-recovery effectiveness.`),
    eq(["CBE 250"], `ACH = ${I("V̇")}/${I("V")}`, "A 10,000 m² lab at 8 air changes per hour moves about 80,000 m³/h of outside air; at −20 °C, warming it to 20 °C takes about 1 MW for that one building."),
    eq(["CBE 470"], `${I("u")} = ${sub(I("K"), "p")}${I("e")} + ${sub(I("K"), "p")}/${sub("τ", "I")}∫${I("e")} d${I("t")}`, "PI loops on supply-air and zone temperature, with night setbacks and occupancy-based airflow, are how retrofits actually save energy. Thermal mass lets campus loads shift a few hours."),
    eq(["CBE 450"], `${I("P")} = CAPEX/(annual savings)`, `Retrofits at $25/m² per 10 % saved: ${S.cfg.eff ? `${f0(S.cfg.eff)} % costs ${M$(S.cfg.eff / 10 * 25 * CASE.floor_m2)}` : "slide the efficiency lever to see it"}. Usually the cheapest tonnes on the cost curve.`),
  ],
  grid: S => [
    eq(["CBE 250"], `${sub(I("P"), "grid")} = ${sub(I("P"), "load")} − ${sub(I("P"), "PV")} − ${sub(I("P"), "wind")} − ${sub(I("P"), "nuc")} − ${sub(I("P"), "CHP")} ± ${sub(I("P"), "batt")}`, `Hourly electricity balance now: ${f0(S.now.elec)} − ${f1(S.now.solar)} − ${f1(S.now.wind)} − ${f1(S.now.nuc)} − ${f1(S.now.chpE)} ± battery = ${f0(S.now.grid)} MW imported${S.now.exp > 0.1 ? `, ${f1(S.now.exp)} MW exported` : ""}.`),
    eq(["CBE 450", "CBE 512"], `${sub(I("m"), "CO₂")} = ε${sub(I("E"), "grid")}`, `Location-based accounting at ${f2(S.cfg.grid)} t/MWh: ${f0(S.R.gridMWh * S.cfg.grid / 1000)} kt/yr. Today's ${f2(0.56)} is the case-study value; the utility's 2030 plan would bring it near 0.11.`),
    eq(["CBE 470"], `d${I("SOC")}/d${I("t")} = η${sub(I("P"), "ch")} − ${sub(I("P"), "dis")}`, `The battery discharges when import rises above the day's mean and charges when it falls below. Peak import this year: ${f0(S.R.peakGrid)} MW, worth ${M$(S.R.opex.demand)}/yr in demand charges.`),
  ],
  solar: S => { const Tc = S.now.T + S.now.ghi / 800 * 25; return [
    eq(["CBE 326"], `${sub(I("T"), "cell")} = ${sub(I("T"), "a")} + (NOCT − 20)·${I("G")}/800`, `Cell temperature now ${f1(Tc)} °C at ${f0(S.now.ghi)} W/m². Every kelvin above 25 °C costs about 0.4 % of power: ${f1(Math.max(0, Tc - 25) * 0.4)} % lost now.`),
    eq(["CBE 440"], `${I("E")}<sub>g</sub>(Si) = 1.12 eV, λ<sub>max</sub> = ${I("hc")}/${I("E")}<sub>g</sub> = 1.1 µm`, "Photons below the band gap pass through and photons above it lose their excess energy as heat: the Shockley–Queisser limit for silicon is about 33 %. Commercial cells reach 22–24 %."),
    eq(["CBE 450", "CBE 512"], `LCOE = (CAPEX·CRF + O&M)/(8,760·CF)`, `At r = ${f1(S.cfg.rate * 100)} %: solar $${f0(lcoe("solar", 0.145, S.cfg.rate))}/MWh (CF 14.5 %, 30 yr), wind $${f0(lcoe("wind", 0.36, S.cfg.rate))}/MWh (CF 36 %, 25 yr), microreactor $${f0(lcoe("nuclear", 0.93, S.cfg.rate))}/MWh, against $99.8 from the grid.`),
    eq(["CBE 512"], `${I("A")} = ${I("E")}/(${I("G")}·η·PR)`, `${f0(S.cfg.solar)} MW of PV needs about ${f0(S.cfg.solar * 2)} ha; wind farms spread over much more land but use little of it.`),
  ]; },
  heatpump: S => { const D = DIST[S.cfg.dist], g = copHeat(70, 13, 0.55), g50 = copHeat(50, 13, 0.55); return [
    eq(["CBE 310"], `${sub("COP", "h")} = η·${sub(I("T"), "c")}/(${sub(I("T"), "c")} − ${sub(I("T"), "e")})`, D.hp ? `Supply ${D.Ts} °C (condensing at ${D.Ts + 3} °C). From chilled-water return: ${f2(S.now.copHR)}; ground: ${f2(S.now.copGS)}; outdoor air at ${f1(S.now.T)} °C: ${S.now.copAS ? f2(S.now.copAS) : "below cutoff"}. Supply temperature matters: from 13 °C, ${f2(g)} at 70 °C vs ${f2(g50)} at 50 °C.` : `On a 180 °C steam network the lift is too large: COP ≈ ${f2(copHeat(180, 13, 0.55))}. Switch the network to hot water to use heat pumps.`),
    eq(["CBE 310"], `${sub(I("Q"), "h")} = ${sub(I("Q"), "c")} + ${I("W")}`, `First law: each MWh of electricity in a heat-recovery machine delivers COP MWh of heat and (COP − 1) MWh of free cooling. Now: ${f0(S.now.hr)} MW of heat and ${f0(S.now.hr * (1 - 1 / Math.max(1.01, S.now.copHR || 2)))} MW of cooling from heat recovery.`),
    eq(["CBE 311"], `ln ${I("p")}<sup>sat</sup> = ${I("A")} − ${I("B")}/(${I("T")} + ${I("C")})`, "The refrigerant's vapour-pressure curve sets the pressures at each temperature; low-GWP HFOs (R-1234ze) or ammonia replace HFCs, trading volumetric capacity, flammability and toxicity."),
    eq(["CBE 450", "CBE 512"], `heat pump wins if ${sub(I("p"), "e")}/COP < ${sub(I("p"), "g")}/${sub("η", "b")}`, `Cost per MWh of heat: electricity $${f0(99.8 / Math.max(1, S.now.copGS || 3))} at COP ${f2(S.now.copGS || 3)} vs gas $${f0(FUELS.ng.price / D.etaB)}. CO₂: ${f2(S.cfg.grid / Math.max(1, S.now.copGS || 3))} vs ${f2(EF.ng / D.etaB)} t/MWh. Cheap gas makes electrification a carbon decision, not a cost one.`),
  ]; },
  borefield: S => { const q = S.o.qnet || 0; return [
    eq(["CBE 320"], `Δ${I("T")}(${I("r")}, ${I("t")}) = (${I("q′")}/4π${I("k")})·${I("E")}₁(${I("r")}²/4α${I("t")})`, `Line-source solution for transient radial conduction from a long borehole. At ${BORE.qmax} W/m peak and k = ${BORE.k} W/m·K, the bore wall cools by about ${f1(BORE.qmax / (4 * Math.PI * BORE.k) * Math.log(4 * 1e-6 * 30 * 86400 / (0.075 ** 2 * 1.78)))} K over a month.`),
    eq(["CBE 326"], `${sub(I("T"), "f")} = ${sub(I("T"), "g")} − ${I("q′")}${sub(I("R"), "b")}`, `Fluid temperature sits below the ground by the borehole resistance (U-tube, grout and near-field): ${f1(BORE.qmax * BORE.Rb)} K at peak extraction. That is the source temperature the heat pump sees.`),
    eq(["CBE 250"], `Δ${sub(I("T"), "25y")} = ${I("q′")}<sub>net</sub>·${I("g")}/(2π${I("k")})`, `Annual ground balance: ${f0(S.o.Eext / 1000)} GWh out, ${f0(S.o.Erej / 1000)} GWh back in (summer cooling). Net ${f1(q)} W/m drifts the field ${f1(S.o.drift25 || 0)} K in 25 years. Balance it with more cooling to ground, more bores, or a solar or tower heat source.`),
    eq(["CBE 540"], `HDPE (PE 4710): ${I("k")} ≈ 0.4 W/m·K, ρ ≈ 0.95 g/cm³`, "Semicrystalline polyethylene pipe is fused into a seamless U-bend that will not corrode in 50+ years underground; its low conductivity is why grout and pipe spacing matter."),
  ]; },
  tes: S => { const V = S.tanks?.H?.V || 0; return [
    eq(["CBE 250"], `${I("E")} = ρ${I("V")}${sub(I("c"), "p")}Δ${I("T")}`, `${f0(S.cfg.tesH)} MWh of hot water at ΔT = ${S.cfg.dist === "hw50" ? 25 : 30} K needs ${f0(V)} m³: a tank ${f0(2 * (S.tanks?.H?.r || 0))} m across and ${f0(S.tanks?.H?.H || 0)} m tall.`),
    eq(["CBE 320"], `δ ≈ 2√(α${I("t")}), Ri = ${I("g")}βΔ${I("T")}${I("H")}/${I("v")}² ≫ 1`, `Heat diffuses across the thermocline only slowly (α = 1.5×10⁻⁷ m²/s → about ${f2(2 * Math.sqrt(1.5e-7 * 86400))} m in a day); buoyancy keeps it stable if diffusers inject water slowly (high Richardson number).`),
    eq(["CBE 470"], `d${I("S")}/d${I("t")} = ${sub(I("Q"), "ch")} − ${sub(I("Q"), "dis")} − ${I("S")}/τ`, `Storage dispatch: now ${f0(S.now.tesHs)} MWh hot and ${f0(S.now.tesCs)} MWh cold in store. The chilled tank charges at night (cooler wet bulb, cheaper hours) and discharges from 11:00 to 19:00.`),
  ]; },
  ccs: S => { const ef = FUELS[S.cfg.fuel].ef, gam = 0.9 * ef * 0.83 / DIST[S.cfg.dist].etaB; return [
    eq(["CBE 426"], `${sub(I("N"), "OG")} ≈ ln(${sub(I("y"), "in")}/${sub(I("y"), "out")}), ${I("Z")} = HTU·${sub(I("N"), "OG")}`, `For 90 % capture with fast reaction (negligible back-pressure), N_OG ≈ ln 10 = 2.3 transfer units; with HTU ≈ 0.6–1 m, about ${f0(2.3 * 0.8 * 3)}–${f0(2.3 * 1.2 * 3)} m of packing after design margins.`),
    eq(["CBE 430"], `CO₂ + 2 RNH₂ ⇌ RNHCOO⁻ + RNH₃⁺`, "Carbamate formation is fast enough to enhance absorption well beyond physical solubility (Hatta number ≫ 1); its reversal in the stripper needs heat."),
    eq(["CBE 310"], `${sub(I("q"), "regen")} = ${sub(I("q"), "sens")} + Δ${sub(I("H"), "abs")} + ${sub(I("q"), "strip")} ≈ 3.0 GJ/t`, `Fixed point on the boilers: capture needs steam, steam needs gas, gas makes CO₂. Fuel rises by 1/(1 − ${f2(gam)}) = ${f2(1 / (1 - gam))}×.`),
    eq(["CBE 450"], `$/t = ${I("I")}·CRF + ${sub(I("c"), "op")} + ${sub(I("c"), "T&S")}`, `$713 per t/yr × CRF(${f1(S.cfg.rate * 100)} %, 25 yr) + $22 + $25 = $${f0(ccsCostPerT(S.cfg.rate))} per tonne captured, before the extra gas.`),
  ]; },
  h2: S => [
    eq(["CBE 310"], `${sub(I("E"), "rev")} = Δ${I("G")}/(2${I("F")}) = 237.1 kJ/mol / (2 × 96,485) = 1.23 V`, "Thermoneutral voltage is ΔH/2F = 1.48 V (HHV). Stacks run at 1.8–2.0 V; whole systems use about 55 kWh per kg today (DOE), about 70 % of the hydrogen's HHV."),
    eq(["CBE 430"], `${I("ṅ")} = ${I("I")}/(2${I("F")}), η = ${I("b")} ln(${I("i")}/${sub(I("i"), "0")})`, "Faraday's law sets production per amp; Butler–Volmer / Tafel kinetics at the iridium anode (oxygen evolution) cause most of the overpotential."),
    eq(["CBE 311"], `20 vol % H₂ → ${f1(0.2 * 12.75 / (0.2 * 12.75 + 0.8 * 39.8) * 100)} % of the fuel energy`, "Hydrogen has a third of methane's heating value per mole, so a 20 % blend by volume replaces only about 7 % of the energy (and CO₂)."),
    eq(["CBE 450", "CBE 512"], `LCOH = (CAPEX·CRF + O&M)/${I("m")} + 55 kWh/kg × ${sub(I("p"), "e")}`, `At 55 kWh/kg and $99.8/MWh the electricity alone is $${f2(0.055 * 99.8)}/kg, about $${f0(0.055 * 99.8 / 0.0394)}/MWh of fuel, against $${f0(FUELS.ng.price)} for natural gas.${cite(14)}`),
  ],
};
STOPS.forEach(s => s.thermo = TH[s.id]);

// plain-language introductions for each tour stop (high-school readers); the technical text stays behind a toggle
export const PLAIN = {
  system: "A big university uses energy like a small city: electricity for lights and labs, heat in winter, cold water for air conditioning, and fuel for its vehicles. This model adds it all up hour by hour. The 3D view on the left shows how the energy flows: things bought on the left, what they're turned into in the middle, what the campus gets on the right.",
  charter: "This is where most campus heat comes from today. Natural gas burns inside a boiler, a big box lined with water-filled tubes. The water boils into steam, and the steam travels through pipes under the streets to heat hundreds of buildings. The flame also makes carbon dioxide (CO₂), which goes up the chimney.",
  wccf: "A cogeneration plant (also called combined heat and power, or CHP) makes electricity and steam from the same fuel. A gas turbine, a jet engine bolted to the ground, spins a generator. Its hot exhaust then boils water for heating instead of being wasted. Using the waste heat makes it more efficient than making power and heat separately.",
  network: "Steam and chilled water reach buildings through kilometres of pipes, some in walk-in concrete tunnels under the streets. Pipes are wrapped in insulation, but some heat always leaks out. The hotter the pipe, the more it leaks, which is one reason campuses are switching from steam to warm water.",
  chiller: "Air conditioning for a whole campus starts here. A chiller works like a giant refrigerator: a special fluid boils at a low temperature to soak up heat from the water, then a compressor squeezes it so it can dump that heat outside. Cooling towers then get rid of the heat by evaporating some water into the air.",
  building: "Research labs use far more energy than classrooms or dorms. For safety, many labs pull in fresh outdoor air all day and throw it away through fume hoods, so every bit of that air has to be heated or cooled first. Better controls and heat-recovery wheels can save a lot of energy here.",
  grid: "Most campus electricity is bought from the local utility and arrives at substations like this one, where high-voltage power is stepped down for campus. How much CO₂ that electricity carries depends on how the utility makes it: from coal, gas, nuclear, wind or sun. Batteries can store power for the busiest hours.",
  solar: "Solar panels turn sunlight straight into electricity; wind turbines turn moving air into electricity. Neither makes CO₂ while running. Rooftops can hold only so many panels, so bigger amounts mean solar farms on land elsewhere or contracts to buy power from wind farms. Both only produce when the sun shines or the wind blows.",
  heatpump: "A heat pump is a refrigerator run backwards. Instead of burning fuel to make heat, it moves heat that already exists, from the ground, the outdoor air, or the water coming back from air conditioning, into the buildings. One unit of electricity can move three or more units of heat.",
  borefield: "A geothermal borefield is a grid of deep holes, each about 200 m deep, with a plastic pipe loop inside. Water pumped through the loops picks up heat from the ground in winter and drops heat into it in summer, so the ground works like a giant seasonal battery for heat.",
  tes: "A giant insulated tank of water can store heat (or cold) for hours or days. Warm water floats on top of cold water, so they stay separated. Storage lets heat pumps and chillers run when it's cheapest or cleanest and still cover the busiest hours.",
  ccs: "Carbon capture cleans CO₂ out of a chimney's exhaust. The gas rises through a tall tower while a liquid trickles down and grabs the CO₂. Heating that liquid later releases pure CO₂, which can be compressed and stored deep underground. It works, but the heating takes extra energy.",
  h2: "Hydrogen burns without making CO₂. An electrolyser makes it by using electricity to split water into hydrogen and oxygen. The catch: it takes a lot of electricity, so the hydrogen is only as clean as the power used to make it, and it costs several times more than natural gas.",
};
STOPS.forEach(s => s.plain = PLAIN[s.id]);


// ---------- course map: topic → stop ----------
export const COURSE_MAP = [
  ["CBE 250", "Campus energy balance: inputs vs delivered services", "system"],
  ["CBE 250", "Boiler efficiency and fuel use", "charter"],
  ["CBE 250", "CHP energy balance from the case data", "wccf"],
  ["CBE 250", "Network heat loss over a year", "network"],
  ["CBE 250", "Cooling-tower water use", "chiller"],
  ["CBE 250", "Hourly electricity balance", "grid"],
  ["CBE 250", "Annual ground energy balance", "borefield"],
  ["CBE 250", "Storage tank sizing", "tes"],
  ["CBE 310", "Combustion stoichiometry and CO₂ per MWh", "charter"],
  ["CBE 310", "Steam enthalpy from the tables", "charter"],
  ["CBE 310", "Brayton cycle efficiency", "wccf"],
  ["CBE 310", "Carnot COP of chillers", "chiller"],
  ["CBE 310", "Heat-pump COP and the first law", "heatpump"],
  ["CBE 310", "Capture regeneration energy", "ccs"],
  ["CBE 310", "Electrolysis: reversible and thermoneutral voltage", "h2"],
  ["CBE 311", "Wet-bulb temperature and the cooling tower", "chiller"],
  ["CBE 311", "Refrigerant vapour pressure", "heatpump"],
  ["CBE 311", "Hydrogen–methane blends: volume vs energy", "h2"],
  ["CBE 320", "Conduction through pipe insulation", "network"],
  ["CBE 320", "Line-source conduction around a borehole", "borefield"],
  ["CBE 320", "Thermocline diffusion and stratification", "tes"],
  ["CBE 326", "Stack losses and condensing boilers", "charter"],
  ["CBE 326", "HRSG pinch", "wccf"],
  ["CBE 326", "Pumping power in the chilled-water loop", "network"],
  ["CBE 326", "Building envelope and ventilation loads", "building"],
  ["CBE 326", "PV cell temperature", "solar"],
  ["CBE 326", "Borehole thermal resistance", "borefield"],
  ["CBE 426", "Absorber height: transfer units", "ccs"],
  ["CBE 430", "Thermal NOx kinetics", "charter"],
  ["CBE 430", "Amine–CO₂ reaction", "ccs"],
  ["CBE 430", "Electrode kinetics and Faraday's law", "h2"],
  ["CBE 440", "Band gap and solar-cell efficiency", "solar"],
  ["CBE 450", "Technology-pathway optimization (the case study)", "system"],
  ["CBE 450", "NPV and abatement cost", "system"],
  ["CBE 450", "CHP vs a cleaning grid", "wccf"],
  ["CBE 450", "Steam-driven vs electric chilling", "chiller"],
  ["CBE 450", "Retrofit payback", "building"],
  ["CBE 450", "Emission-factor accounting", "grid"],
  ["CBE 450", "Levelized cost of electricity", "solar"],
  ["CBE 450", "When heat pumps beat gas", "heatpump"],
  ["CBE 450", "Cost per tonne captured", "ccs"],
  ["CBE 450", "Levelized cost of hydrogen", "h2"],
  ["CBE 512", "CHP vs a cleaning grid", "wccf"],
  ["CBE 512", "Solar and wind: LCOE and land", "solar"],
  ["CBE 512", "Grid carbon intensity", "grid"],
  ["CBE 512", "Heat pumps vs gas", "heatpump"],
  ["CBE 512", "Green hydrogen costs", "h2"],
  ["CBE 470", "PI control and setbacks", "building"],
  ["CBE 470", "Battery state-of-charge dispatch", "grid"],
  ["CBE 470", "Storage dispatch dynamics", "tes"],
  ["CBE 540", "HDPE ground-loop pipe", "borefield"],
  ["CBE 560", "Renewable natural gas from digestion", "charter"],
];

// ===================================================================================
// detail viewer
// ===================================================================================
export class DetailViewer {
  constructor(host) {
    this.host = host; this.canvas = host.querySelector("canvas"); this.callouts = host.querySelector(".callouts");
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true; this.renderer.localClippingEnabled = true;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color("#ffffff");
    this.scene.environment = new THREE.PMREMGenerator(this.renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    const sun = new THREE.DirectionalLight("#ffffff", 1.6); sun.position.set(6, 10, 8); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    this.sun = sun; this.scene.add(sun, new THREE.HemisphereLight("#ffffff", "#d8d8d8", 0.8));
    this.floor = new THREE.Mesh(new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: "#eeeeee", roughness: 0.95 }));
    this.floor.receiveShadow = true; this.scene.add(this.floor);
    this.grid = new THREE.GridHelper(2, 20, "#c9c9c9", "#dddddd"); this.scene.add(this.grid);
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.01, 2000);
    this.controls = new OrbitControls(this.camera, this.canvas); this.controls.enableDamping = true; this.controls.autoRotateSpeed = 0.6;
    this.clip = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
    this.cut = true; this.open = false; this.model = null;
    new ResizeObserver(() => this.resize()).observe(host);
  }
  resize() { const r = this.host.getBoundingClientRect(); if (!r.width) return; this.renderer.setSize(r.width, r.height, false); this.camera.aspect = r.width / r.height; this.camera.updateProjectionMatrix(); }
  show(stop, S) {
    if (this.model) { this.scene.remove(this.model.group); this.model.group.traverse(o => { o.geometry?.dispose?.(); }); }
    const m = stop.model(S); this.model = m; this.scene.add(m.group);
    const shells = []; m.group.traverse(o => { if (o.userData.shell) { o.material = o.material.clone(); o.material.side = THREE.DoubleSide; shells.push(o); } }); this.shells = shells;
    const bb = new THREE.Box3().setFromObject(m.group), c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3());
    const R = Math.max(sz.x, sz.z) * 0.8 + (m.fit ?? 1) * 0.3;
    this.floor.scale.setScalar(R); this.floor.position.y = bb.min.y - 0.002; this.grid.scale.setScalar(R); this.grid.position.y = bb.min.y;
    this.sun.position.set(c.x + R, c.y + R * 1.6, c.z + R * 1.2); this.sun.target.position.copy(c); this.scene.add(this.sun.target);
    Object.assign(this.sun.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 0.01, far: R * 6 }); this.sun.shadow.camera.updateProjectionMatrix();
    this.sun.shadow.bias = -0.0002; this.sun.shadow.normalBias = R * 0.002;
    this.cz = m.cutZ ?? 0;
    this.resize();
    const d = (m.fit ?? sz.length()) * Math.min(1.8, Math.max(1, 1.45 / Math.max(0.3, this.camera.aspect))) * 1.1;
    this.camera.position.set(c.x + d * 0.55, c.y + d * 0.4, c.z + d * 0.85); this.controls.target.copy(c);
    this.camera.near = d / 300; this.camera.far = d * 40; this.camera.updateProjectionMatrix();
    this.setCut(this.cut);
    const kids = m.group.children.filter(o => !o.isPoints && !o.isLine && o.type !== "ArrowHelper");
    const ctr = c.clone(); this.explode = 0; this.explodeT = this.explodeT ?? 0;
    this.kids = kids.map(o => { const b = new THREE.Box3().setFromObject(o), oc = b.getCenter(new THREE.Vector3()), dd = oc.clone().sub(ctr);
      const ax = m.explodeAxis ?? "x", dir = new THREE.Vector3();
      if (o.userData.exp) dir.copy(o.userData.exp);
      else if (o.userData.shell) dir.y = Math.max(sz.y, 0.2) * 0.75;
      else dir[ax] = dd[ax] * (ax === "y" ? 1.6 : 0.8);
      return { o, home: o.position.clone(), dir, oc }; });
    this.partKid = m.parts.map(([, p]) => { let best = null, bd = 1e9; for (const k of this.kids) { const dd = k.oc.distanceTo(p); if (dd < bd) { bd = dd; best = k; } } return best; });
    this.callouts.innerHTML = m.parts.map(([n], i) => `<button class="co" data-i="${i}"><b>${i + 1}</b><span>${n}</span></button>`).join("");
    this.coEls = [...this.callouts.children];
    this.coEls.forEach(el => el.onclick = () => this.focus(+el.dataset.i));
    this.focusT = null; this.open = true; this.resize();
    return m;
  }
  focus(i) {
    const p = this.partPos(i), d = Math.max(0.05, (this.model.fit ?? 1) * 0.45), dir = this.camera.position.clone().sub(this.controls.target).normalize();
    this.focusT = { t: 0, p0: this.camera.position.clone(), t0: this.controls.target.clone(), t1: p.clone(), p1: p.clone().addScaledVector(dir, d) };
    this.coEls.forEach((el, j) => el.classList.toggle("on", j === i));
    this.onFocus?.(i);
  }
  partPos(i) { const k = this.partKid[i], p = this.model.parts[i][1].clone(); if (k) p.add(k.o.position).sub(k.home); return p; }
  setExplode(on) { this.explodeT = on ? 1 : 0; }
  setCut(on) { this.cut = on; for (const o of this.shells || []) { o.material.clippingPlanes = on ? [this.clip] : []; o.material.needsUpdate = true; } }
  render(dt, S) {
    if (!this.open || !this.model) return;
    this.model.update?.(dt, S);
    this.explode += (this.explodeT - this.explode) * Math.min(1, dt * 3);
    for (const k of this.kids) k.o.position.copy(k.home).addScaledVector(k.dir, this.explode);
    if (this.focusT) { const f = this.focusT; f.t = Math.min(1, f.t + dt / 1.1); const u = f.t * f.t * (3 - 2 * f.t);
      this.camera.position.lerpVectors(f.p0, f.p1, u); this.controls.target.lerpVectors(f.t0, f.t1, u); if (f.t >= 1) this.focusT = null; }
    this.controls.update();
    const sgn = this.camera.position.z >= this.cz ? 1 : -1;
    this.clip.normal.set(0, 0, -sgn); this.clip.constant = sgn * this.cz;
    this.renderer.render(this.scene, this.camera);
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight, P = new THREE.Vector3();
    this.model.parts.forEach(([, p], i) => {
      P.copy(this.partPos(i)).applyMatrix4(this.model.group.matrixWorld).project(this.camera); const el = this.coEls[i];
      const vis = P.z < 1 && Math.abs(P.x) < 1.05 && Math.abs(P.y) < 1.05;
      el.style.display = vis ? "" : "none"; if (vis) el.style.transform = `translate(${(P.x * 0.5 + 0.5) * w}px, ${(-P.y * 0.5 + 0.5) * h}px)`;
    });
  }
}
