// Equipment tour for the gas transmission twin: tour stops (where to fly, what the equipment does,
// its specification, live readings from the model) and detailed procedural 3D models, shown in a
// separate cutaway viewer. Models are at true size in metres; specs are typical for a 36" line of
// the kind in Zavala (2014), sized so they agree with the paper's numbers (57 bar supply, 3000 kW
// station limit, 914 mm line, isothermal gas at 293.15 K).
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

// ===================================================================================
// references (each link checked when added, Nov 2026); ref("key") gives a superscript citation
// ===================================================================================
export const REFS = [
  ["zavala", "Zavala, V. M. Stochastic optimal control model for natural gas networks. <i>Computers &amp; Chemical Engineering</i> 64, 103–113 (2014).", "https://doi.org/10.1016/j.compchemeng.2014.02.002"],
  ["eia-winter", "U.S. Energy Information Administration. Winter Fuels Outlook 2024–25 (Short-Term Energy Outlook supplement), 8 Oct 2024: natural gas is the main heating fuel in 45 % of U.S. homes.", "https://www.eia.gov/outlooks/steo/report/perspectives/2024/10-winterfuels/article.php"],
  ["eia-elec", "U.S. Energy Information Administration. Electricity explained: Electricity in the United States (natural gas is the top source of utility-scale generation).", "https://www.eia.gov/energyexplained/electricity/electricity-in-the-us.php"],
  ["eia-use", "U.S. Energy Information Administration. Natural gas explained: Use of natural gas.", "https://www.eia.gov/energyexplained/natural-gas/use-of-natural-gas.php"],
  ["eia-rescons", "U.S. Energy Information Administration. U.S. Natural Gas Residential Consumption, annual (million cubic feet).", "https://www.eia.gov/dnav/ng/hist/n3010us2a.htm"],
  ["eia-consumers", "U.S. Energy Information Administration. U.S. Number of Natural Gas Consumers, annual. With the consumption series: 59,500–68,400 ft³ (4.6–5.3 m³ per day) per residential customer, 2022–2024.", "https://www.eia.gov/dnav/ng/ng_cons_num_dcu_nus_a.htm"],
  ["eia-kwh", "U.S. Energy Information Administration. FAQ: How much electricity does an American home use? (10,791 kWh per residential customer in 2022).", "https://www.eia.gov/tools/faqs/faq.php?id=97&t=3"],
  ["phmsa", "U.S. Pipeline and Hazardous Materials Safety Administration. Annual Report Mileage for Natural Gas Transmission &amp; Gathering Systems (about 300,000 miles of transmission pipeline).", "https://www.phmsa.dot.gov/data-and-statistics/pipeline/annual-report-mileage-natural-gas-transmission-gathering-systems"],
  ["epa-gwp", "U.S. Environmental Protection Agency. Understanding Global Warming Potentials (methane: 81–83 over 20 years, 27–30 over 100 years, from IPCC AR6, 2021).", "https://www.epa.gov/ghgemissions/understanding-global-warming-potentials"],
  ["epa-car", "U.S. Environmental Protection Agency. Greenhouse Gas Emissions from a Typical Passenger Vehicle (about 4.6 t CO₂ per year).", "https://www.epa.gov/greenvehicles/greenhouse-gas-emissions-typical-passenger-vehicle"],
  ["afdc", "U.S. Department of Energy, Alternative Fuels Data Center. Fuel Properties Comparison (gasoline lower heating value 112,114–116,090 Btu/gal, about 118–122 MJ).", "https://afdc.energy.gov/fuels/properties"],
  ["iea-nh3", "International Energy Agency. Ammonia Technology Roadmap (2021): 28 GJ/t for the best gas-based plants, about 41 GJ/t world average.", "https://www.iea.org/reports/ammonia-technology-roadmap"],
  ["nist", "NIST Chemistry WebBook, SRD 69: Methane, gas-phase thermochemistry (heat of combustion −890 kJ/mol; lower heating value after subtracting water's heat of vaporization).", "https://webbook.nist.gov/cgi/cbook.cgi?ID=C74828&Mask=1"],
  ["bsl", "Bird, R. B., Stewart, W. E. &amp; Lightfoot, E. N. <i>Transport Phenomena</i>, revised 2nd ed. Wiley (2006): continuity and momentum balances, Darcy–Weisbach friction, turbulent velocity profiles, kinetic theory of gases, Ergun equation.", "https://www.wiley.com/en-us/Transport+Phenomena,+Revised+2nd+Edition-p-9780470115398"],
  ["svna", "Smith, J. M., Van Ness, H. C., Abbott, M. M. &amp; Swihart, M. T. <i>Introduction to Chemical Engineering Thermodynamics</i>, 9th ed. McGraw Hill (2022): real gases and the Pitzer virial correlation, compression work, Joule–Thomson, Brayton cycle, heats of reaction, flash calculations.", "https://www.mheducation.com/highered/product/introduction-to-chemical-engineering-thermodynamics-smith.html"],
  ["ppo", "Poling, B. E., Prausnitz, J. M. &amp; O'Connell, J. P. <i>The Properties of Gases and Liquids</i>, 5th ed. McGraw-Hill (2001): critical constants, acentric factors, pseudo-critical (Kay's rule) mixing.", "https://www.accessengineeringlibrary.com/content/book/9780070116825"],
  ["colebrook", "Colebrook, C. F. Turbulent flow in pipes, with particular reference to the transition region between the smooth and rough pipe laws. <i>Journal of the Institution of Civil Engineers</i> 11(4), 133–156 (1939).", "https://doi.org/10.1680/ijoti.1939.13150"],
  ["souders", "Souders, M. &amp; Brown, G. G. Design of fractionating columns I. Entrainment and capacity. <i>Industrial &amp; Engineering Chemistry</i> 26(1), 98–103 (1934).", "https://doi.org/10.1021/ie50289a025"],
  ["asme", "ASME. B31.8 Gas Transmission and Distribution Piping Systems (2025 edition): design factor 0.72 for class 1 locations.", "https://www.asme.org/codes-standards/find-codes-standards/b31-8-gas-transmission-distribution-piping-systems"],
  ["api5l", "American Petroleum Institute. API Specification 5L, Line Pipe, 47th ed. (2026): steel grades such as X70.", "https://www.api.org/products-and-services/standards/important-standards-announcements/api-announces-47th-edition-of-foundational-line-pipe-standard-5l"],
  ["threejs", "three.js contributors. three.js JavaScript 3D library (r160, used to render this digital twin).", "https://threejs.org/"],
  ["guide", "University of Wisconsin–Madison. Guide: Chemical and Biological Engineering (CBE) courses (course pages linked from every subject label).", "https://guide.wisc.edu/courses/cbe/"],
];
export const refNum = k => REFS.findIndex(r => r[0] === k) + 1;
export const ref = (...ks) => `<sup class="refsup">${ks.map(k => `<a class="ref" data-ref="${refNum(k)}" href="#ref-${refNum(k)}" title="${REFS[refNum(k) - 1][1].replace(/<[^>]+>/g, "").replace(/"/g, "'")}">${refNum(k)}</a>`).join(",")}</sup>`;



// ---------- gas data shared with sim.js (paper Appendix A, assumptions in README) ----------
const C2 = 370.2 ** 2, BAR = 1e5, CP = 2.34, A_LINE = Math.PI * 0.914 ** 2 / 4, RHO_N = 0.72;
const rhoAt = p => p * BAR / C2;                       // kg/m3 at p bar
const mmscmd = kgs => kgs * 86400 / RHO_N / 1e6;
const f1 = v => v.toFixed(1), f2 = v => v.toFixed(2), f0 = v => Math.round(v).toLocaleString();
const f3 = v => v.toFixed(3);

import { GAS, Mmix, Tpc, Ppc, Wmix, nC, T0, Rg, GAMMA, BETA, CO2_PER_KG, pitzer, LHV_MIX_ } from "./gasprops.js";
export { GAS, CO2_PER_KG };
const LHV_MIX = LHV_MIX_;
// ---------- everyday-terms conversion factors (Typical, US averages; stated in the panel) ----------
export const EVERY = {
  homeGas: 5.0,        // m3/day of gas per gas-heated US home, annual average (EIA ~ 65 thousand ft3/yr)
  homeElec: 1.2,       // kW average electricity per US home (EIA ~ 10,500 kWh/yr)
  carCO2: 4.6,         // t CO2 per passenger car per year (US EPA)
  gasolineMJ: 121,     // MJ per US gallon of gasoline
  ccgt: 0.55,          // combined-cycle plant efficiency
  ledW: 10,            // W, one LED bulb
  lhv: LHV_MIX_, co2PerKg: 0,
};
const homesFromKgs = kgs => kgs * 86400 / RHO_N / EVERY.homeGas;      // homes whose daily gas this flow covers
const big = v => v >= 1e6 ? `${(v / 1e6).toFixed(2)} million` : v >= 1e4 ? `${f0(Math.round(v / 100) * 100)}` : f0(v);
export { homesFromKgs, big };
// UW–Madison CBE courses: exact catalog titles and per-course catalog links
export const COURSE_TITLE = {
  "CBE 250": "Process Synthesis", "CBE 255": "Introduction to Chemical Process Modeling", "CBE 310": "Chemical Process Thermodynamics",
  "CBE 311": "Thermodynamics of Mixtures", "CBE 320": "Introductory Transport Phenomena", "CBE 324": "Transport Phenomena Lab",
  "CBE 326": "Momentum and Heat Transfer Operations", "CBE 355": "Statistics for Chemical Engineers", "CBE 424": "Operations and Process Laboratory",
  "CBE 426": "Mass Transfer Operations", "CBE 430": "Chemical Kinetics and Reactor Design", "CBE 440": "Chemical Engineering Materials",
  "CBE 450": "Process Design", "CBE 470": "Process Dynamics and Control",
  "CBE 512": "Energy Technology and Sustainability", "CBE 540": "Polymer Science and Technology", "CBE 547": "Introduction to Colloid and Interface Science", "CBE 560": "Biochemical Engineering",
};
export const COURSE_LABEL = { "CBE 250": "Balances", "CBE 255": "Modeling", "CBE 310": "Thermo", "CBE 311": "Mixtures", "CBE 320": "Transport", "CBE 324": "Transport Lab",
  "CBE 326": "Fluids & Heat", "CBE 355": "Statistics", "CBE 424": "Unit Ops Lab", "CBE 426": "Mass Transfer", "CBE 430": "Kinetics & Reactors", "CBE 440": "Materials",
  "CBE 450": "Design", "CBE 470": "Control", "CBE 512": "Energy", "CBE 540": "Polymers", "CBE 547": "Colloids", "CBE 560": "Biochem" };
export const courseURL = c => `https://guide.wisc.edu/search/?P=${encodeURIComponent(c)}`;
const crsClass = c => c === "Paper" ? "pp" : c === "Transport" ? "tr" : "c" + (c.match(/\d{3}/) || ["310"])[0];
// small tag; a link to the course page unless inside another control (link = false)
const tag = (c, link = true) => c === "Paper" ? `<span class="course paper" title="Zavala (2014), Comput. Chem. Eng. 64:103-113">Paper</span>`
  : !COURSE_TITLE[c] || link === false ? `<span class="course" title="${c}: ${COURSE_TITLE[c] || ""}">${COURSE_LABEL[c] || c}</span>`
  : `<a class="course" href="${courseURL(c)}" target="_blank" rel="noopener" title="${c}: ${COURSE_TITLE[c]}">${COURSE_LABEL[c]} ↗</a>`;
export const seenChip = c => `<a class="course" href="${courseURL(c)}" target="_blank" rel="noopener" title="${c}: ${COURSE_TITLE[c]}">${COURSE_LABEL[c]} ↗</a>`;

const eq = (courses, tex, note, refs = "") => ({ courses, tex, note, refs });   // tex: KaTeX source (Part L)

// ---------- materials ----------
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.5, ...o });
const MT = {
  steel: () => mat("#9aa1a6", { metalness: 0.85, roughness: 0.35 }),
  dark: () => mat("#4a5157", { metalness: 0.7, roughness: 0.5 }),
  paint: () => mat("#d9dad5", { metalness: 0.2, roughness: 0.5 }),
  blue: () => mat("#2e5f8f", { metalness: 0.4, roughness: 0.4 }),
  yellow: () => mat("#e0b123", { metalness: 0.2, roughness: 0.5 }),
  red: () => mat("#b8352c", { metalness: 0.2, roughness: 0.5 }),
  bronze: () => mat("#b48a4a", { metalness: 0.9, roughness: 0.3 }),
  hot: () => mat("#a2643a", { metalness: 0.85, roughness: 0.35 }),
  fbe: () => mat("#3f7a52", { metalness: 0.1, roughness: 0.4 }),
  pe: () => mat("#1d2328", { metalness: 0.05, roughness: 0.55 }),
  soil: () => mat("#7a5f45", { metalness: 0, roughness: 0.95 }),
  sand: () => mat("#c9b48a", { metalness: 0, roughness: 0.95 }),
  liquid: () => mat("#3a6f86", { metalness: 0.1, roughness: 0.1, transparent: true, opacity: 0.75 }),
  poly: () => mat("#c0392b", { metalness: 0, roughness: 0.6 }),
  glass: () => mat("#a8d0e6", { metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.45 }),
};

// ---------- geometry helpers (y is the default axis of revolution) ----------
function add(parent, geo, m, x = 0, y = 0, z = 0) { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; parent.add(o); return o; }
const cyl = (r, h, s = 40, r2 = r, open = false) => new THREE.CylinderGeometry(r2, r, h, s, 1, open);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
function tube(rOut, rIn, len, seg = 56) {   // thick-walled tube along y
  const p = [[rIn, -len / 2], [rOut, -len / 2], [rOut, len / 2], [rIn, len / 2], [rIn, -len / 2]].map(([a, b]) => new THREE.Vector2(a, b));
  return new THREE.LatheGeometry(p, seg);
}
function lathe(profile, seg = 56) { return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg); }
const alongX = g => g.rotateZ(-Math.PI / 2);   // revolve about x instead of y
const alongZ = g => g.rotateX(Math.PI / 2);
function pipe(parent, a, b, r, m, seg = 20) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), L = d.length();
  const o = add(parent, cyl(r, L, seg), m); o.position.copy(A).addScaledVector(d, 0.5);
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return o;
}
function flange(parent, r, x, m, axis = "x", bolts = 16) {   // weld-neck flange pair with bolts
  const g = new THREE.Group(); parent.add(g);
  add(g, cyl(r * 1.55, r * 0.5, 48), m);
  const bm = MT.dark();
  for (let i = 0; i < bolts; i++) { const a = i / bolts * Math.PI * 2; add(g, cyl(r * 0.07, r * 0.75, 8), bm, Math.cos(a) * r * 1.33, 0, Math.sin(a) * r * 1.33); }
  if (axis === "x") { g.rotation.z = -Math.PI / 2; g.position.x = x; } else if (axis === "z") { g.rotation.x = Math.PI / 2; g.position.z = x; } else g.position.y = x;
  return g;
}
function shell(o) { o.userData.shell = true; return o; }      // clipped when the cutaway is on
function label(parts, name, x, y, z) { parts.push([name, new THREE.Vector3(x, y, z)]); }

// moving tracer points (gas parcels or droplets) owned by a model
function tracers(parent, n, color, size) {
  const pos = new Float32Array(n * 3), g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ color, size, sizeAttenuation: true, transparent: true, opacity: 0.9, depthWrite: false });
  const p = new THREE.Points(g, m); p.frustumCulled = false; parent.add(p);
  return { pos, geo: g, n, mat: m, u: new Float32Array(n).map(() => Math.random()), a: new Float32Array(n).map(() => Math.random()), b: new Float32Array(n).map(() => Math.random()) };
}

// ===================================================================================
// detailed models: each returns { group, parts: [[name, Vector3]], update(dt, live), actions }
// ===================================================================================

// 1. Ultrasonic export meter run
function meterModel() {
  const g = new THREE.Group(), parts = [], R = 0.2, Ro = 0.215;
  const st = MT.steel(), pt = MT.paint(), bl = MT.blue();
  // upstream / downstream pipe, flow conditioner, meter spool
  const up = shell(add(g, alongX(tube(Ro, R, 3.2)), pt, -2.4, 0, 0));
  const dn = shell(add(g, alongX(tube(Ro, R, 1.6)), pt, 2.0, 0, 0));
  const body = shell(add(g, alongX(tube(Ro + 0.06, R, 1.4)), bl, 0.4, 0, 0));
  for (const x of [-0.8, -0.3, 1.1, 1.2 + 0.0]) flange(g, Ro, x, st);
  flange(g, Ro, -4.0, st); flange(g, Ro, 2.8, st);
  // perforated-plate flow conditioner (between flanges at x = -0.8)
  const plate = add(g, alongX(cyl(R, 0.03, 48)), MT.dark(), -0.8, 0, 0);
  const holeM = mat("#11161a", { metalness: 0.2 });
  for (let ring = 0; ring < 3; ring++) { const rr = [0, 0.08, 0.15][ring], n = [1, 8, 14][ring]; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; add(g, alongX(cyl(0.024, 0.035, 12)), holeM, -0.8, Math.sin(a) * rr, Math.cos(a) * rr); } }
  // four chordal paths: transducer bosses and acoustic paths crossing the bore at 45 deg
  const pathM = new THREE.LineBasicMaterial({ color: "#5fd0ff" });
  const paths = [];
  for (const [k, h] of [-0.14, -0.05, 0.05, 0.14].entries()) {
    const zc = Math.sqrt(R * R - h * h), xA = 0.4 - zc, xB = 0.4 + zc;
    const A = new THREE.Vector3(xA, h, -zc), B = new THREE.Vector3(xB, h, zc);
    for (const P of [A, B]) {
      const o = add(g, cyl(0.03, 0.16, 16), MT.dark()); o.position.copy(P).multiplyScalar(1).add(new THREE.Vector3(0, 0, Math.sign(P.z) * 0.06));
      o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
    }
    const lg = new THREE.BufferGeometry().setFromPoints([A, B]); g.add(new THREE.Line(lg, pathM));
    const pulse = add(g, new THREE.SphereGeometry(0.018, 10, 8), new THREE.MeshBasicMaterial({ color: "#bff0ff" }));
    paths.push({ A, B, pulse, ph: k * 0.25 });
  }
  // flow computer head, cable conduit, pressure & temperature taps
  add(g, box(0.34, 0.26, 0.22), mat("#c9ccc8", { metalness: 0.4 }), 0.4, 0.55, 0);
  pipe(g, [0.4, Ro + 0.06, 0], [0.4, 0.42, 0], 0.04, st);
  add(g, cyl(0.015, 0.28, 10), st, 1.7, Ro + 0.12, 0); add(g, cyl(0.05, 0.05, 20), MT.dark(), 1.7, Ro + 0.28, 0);
  pipe(g, [2.2, Ro, 0], [2.2, 0.42, 0], 0.012, st); add(g, cyl(0.06, 0.03, 24).rotateX(Math.PI / 2), mat("#f2f2ee"), 2.2, 0.48, 0.02);
  for (const x of [-3.2, -1.4, 1.6, 2.6]) add(g, box(0.25, 0.42, 0.5), MT.dark(), x, -0.43, 0);
  const tr = tracers(g, 900, "#ffd28a", 0.022);
  label(parts, "Flow conditioner (perforated plate, 10 D upstream)", -0.8, R + 0.25, 0);
  label(parts, "Transducer pairs: 4 chordal acoustic paths", 0.4, -0.14, -0.3);
  label(parts, "Flow computer / signal processing", 0.4, 0.7, 0);
  label(parts, "Pressure tap", 1.7, 0.33, 0);
  label(parts, "Temperature (thermowell) and gauge", 2.2, 0.5, 0);
  label(parts, "Straight upstream run, DN400 Class 600", -2.6, Ro, 0);
  let t = 0;
  return {
    group: g, parts, fit: 6,
    update(dt, live) {
      t += dt; const v = live.vel ?? 8;
      for (const p of paths) { const u = ((t * 0.9 + p.ph) % 1); p.pulse.position.lerpVectors(p.A, p.B, u < 0.5 ? u * 2 : 2 - u * 2); }
      for (let i = 0; i < tr.n; i++) {
        tr.u[i] += dt * v * 0.12 / 7.0 * (0.6 + 0.4 * (1 - tr.a[i] ** 2)); if (tr.u[i] > 1) tr.u[i] -= 1;
        const r = Math.sqrt(tr.a[i]) * R * 0.92, an = tr.b[i] * Math.PI * 2;
        tr.pos.set([-4 + tr.u[i] * 6.8, Math.sin(an) * r, Math.cos(an) * r], i * 3);
      }
      tr.geo.attributes.position.needsUpdate = true;
    },
  };
}

// 2. Line pipe in its trench
function pipeModel() {
  const g = new THREE.Group(), parts = [], Ro = 0.457, t = 0.0111, Ri = Ro - t, L = 6;
  // steel, FBE, 3LPE with stepped cut-back so each layer shows
  shell(add(g, alongX(tube(Ro, Ri, L)), MT.steel(), 0, 0, 0));
  shell(add(g, alongX(tube(Ro + 0.0006 + 0.003, Ro + 0.0004, L - 0.8)), MT.fbe(), -0.4, 0, 0));
  shell(add(g, alongX(tube(Ro + 0.0035, Ro + 0.0007, L - 1.6)), MT.pe(), -0.8, 0, 0));
  add(g, new THREE.TorusGeometry(Ro + 0.002, 0.012, 10, 64).rotateY(Math.PI / 2), mat("#c7b79a", { metalness: 0.9, roughness: 0.6 }), 2.4, 0, 0);
  // field joint: heat-shrink sleeve over the girth weld on the left
  shell(add(g, alongX(tube(Ro + 0.006, Ro + 0.004, 0.5)), mat("#2b2b2b", { roughness: 0.7, metalness: 0 }), -2.7, 0, 0));
  // trench section: sand padding, backfill, topsoil, warning tape, marker post, CP test station
  const depth = 1.2 + 2 * Ro, W = 1.9, soil = MT.soil(), sand = MT.sand();
  const sec = (w, h, y, m, zc = -1.6) => add(g, box(L + 0.6, h, w), m, 0, y, zc);
  // the section is drawn as the back half of the trench (z < 0) so the pipe stays visible
  const bed = -Ro - 0.15;
  add(g, box(L + 0.6, 0.15, W), sand, 0, bed - 0.075, 0);
  add(g, box(L + 0.6, 2 * Ro + 0.45, W * 0.5 - 0.05), sand, 0, 0.075, -W * 0.25 - Ro * 0.45 - 0.02).scale.z = 0.6;
  add(g, box(L + 0.6, 0.9, W), soil, 0, Ro + 0.3 + 0.45, -W * 0.5 - 0.02).scale.z = 0.02;
  add(g, box(L + 0.6, 0.12, 2.6), mat("#5a7d3a", { metalness: 0, roughness: 1 }), 0, Ro + 1.25, -1.1);   // turf at grade
  add(g, box(L + 0.6, depth + 0.6, 0.05), soil, 0, Ro + 1.2 - (depth + 0.6) / 2, -W / 2 - 0.4);      // trench wall
  add(g, box(L + 0.6, 0.004, 0.3), MT.yellow(), 0, Ro + 0.35, -0.1);                                 // warning tape
  const post = new THREE.Group(); post.position.set(1.6, Ro + 1.25, -0.6); g.add(post);
  add(post, cyl(0.05, 1.4, 16), MT.yellow(), 0, 0.7, 0); add(post, box(0.24, 0.32, 0.02), mat("#f4d03f"), 0, 1.2, 0.06);
  const cp = new THREE.Group(); cp.position.set(-1.8, Ro + 1.25, -0.8); g.add(cp);
  add(cp, cyl(0.04, 1.0, 12), mat("#eaeaea"), 0, 0.5, 0); add(cp, box(0.14, 0.18, 0.1), mat("#2a6db0"), 0, 1.05, 0);
  pipe(g, [-1.8, Ro + 1.25, -0.8], [-1.8, Ro + 0.02, -0.4], 0.006, mat("#c44", { metalness: 0.3 }));
  const tr = tracers(g, 1800, "#ffd28a", 0.03);
  label(parts, "API 5L X70 steel, OD 914 mm x 11.1 mm wall", 2.9, Ro, 0);
  label(parts, "Fusion-bonded epoxy (FBE) primer", 2.4 - 0.4, Ro + 0.02, 0.1);
  label(parts, "3-layer polyethylene coating, 3.2 mm", 0.6, Ro + 0.02, 0.15);
  label(parts, "Girth weld (automatic GMAW, 100 % UT)", 2.4, -Ro, 0);
  label(parts, "Heat-shrink sleeve on field joint", -2.7, Ro + 0.02, 0);
  label(parts, "Sand padding and bedding", -1.2, bed, -0.4);
  label(parts, "Warning tape 300 mm above pipe", 0, Ro + 0.35, -0.1);
  label(parts, "Marker post at grade (cover >= 1.2 m)", 1.6, Ro + 2.5, -0.6);
  label(parts, "Cathodic protection test station", -1.8, Ro + 2.3, -0.8);
  return {
    group: g, parts, fit: 7,
    update(dt, live) {
      const v = live.vel ?? 4;
      for (let i = 0; i < tr.n; i++) {
        tr.u[i] += dt * v * 0.25 / L; if (tr.u[i] > 1) tr.u[i] -= 1;
        const r = Math.sqrt(tr.a[i]) * Ri * 0.95, an = tr.b[i] * Math.PI * 2;
        tr.pos.set([-L / 2 + tr.u[i] * L, Math.sin(an) * r, Math.cos(an) * r], i * 3);
      }
      tr.geo.attributes.position.needsUpdate = true;
    },
  };
}

// 3. Mainline block valve: full-bore trunnion ball valve with gas-over-oil actuator
function ballValveModel() {
  const g = new THREE.Group(), parts = [], Rp = 0.457, Rb = 0.78, st = MT.steel(), pt = mat("#6f7a83", { metalness: 0.6 });
  // body: forged spherical centre with tapered necks
  shell(add(g, alongX(lathe([[Rp, -1.6], [Rp + 0.05, -1.6], [Rp + 0.08, -1.2], [Rb + 0.14, -0.62], [Rb + 0.2, 0], [Rb + 0.14, 0.62], [Rp + 0.08, 1.2], [Rp + 0.05, 1.6], [Rp, 1.6]])), pt));
  shell(add(g, cyl(0.42, 0.5, 40), pt, 0, Rb + 0.2, 0)); shell(add(g, cyl(0.34, 0.4, 40), pt, 0, -Rb - 0.15, 0));
  flange(g, Rp + 0.05, -1.6, st); flange(g, Rp + 0.05, 1.6, st);
  shell(add(g, alongX(tube(Rp + 0.012, Rp, 1.8)), MT.pe(), -2.6, 0, 0)); shell(add(g, alongX(tube(Rp + 0.012, Rp, 1.8)), MT.pe(), 2.6, 0, 0));
  // ball: sphere with full-port bore, trunnions top and bottom
  const ball = new THREE.Group(); g.add(ball);
  const a = Math.asin(Rp / Rb);
  add(ball, new THREE.SphereGeometry(Rb, 64, 40, 0, Math.PI * 2, a, Math.PI - 2 * a).rotateZ(Math.PI / 2), mat("#e3e6e8", { metalness: 0.75, roughness: 0.22 }));
  add(ball, alongX(cyl(Rp, 2 * Rb * Math.cos(a), 48, Rp, true)), mat("#b5b9bc", { metalness: 1, roughness: 0.2, side: THREE.BackSide }));
  add(ball, cyl(0.2, 0.3, 24), st, 0, Rb + 0.05, 0); add(ball, cyl(0.2, 0.3, 24), st, 0, -Rb - 0.05, 0);
  // seats (spring-loaded seat rings)
  for (const s of [-1, 1]) add(g, alongX(new THREE.TorusGeometry(Rp + 0.06, 0.05, 12, 48)).rotateZ(Math.PI / 2).rotateY(Math.PI / 2), MT.bronze(), s * Rb * Math.cos(a) * 0.98, 0, 0);
  // stem, gearbox/yoke, gas-over-oil actuator with two tanks
  add(g, cyl(0.09, 1.0, 20), st, 0, Rb + 0.9, 0);
  const act = new THREE.Group(); act.position.set(0, Rb + 1.5, 0); g.add(act);
  add(act, box(0.8, 0.5, 0.7), MT.blue(), 0, 0, 0);
  add(act, alongZ(cyl(0.18, 1.6, 32)), MT.blue(), 0, 0.1, 0.9);
  const tanks = [];
  for (const s of [-1, 1]) {
    tanks.push(add(act, cyl(0.2, 1.2, 32), MT.yellow(), s * 0.6, 0.85, -0.15));
    add(act, new THREE.SphereGeometry(0.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), MT.yellow(), s * 0.6, 1.45, -0.15);
    pipe(g, [s * 0.6, Rb + 1.5 + 1.5, -0.15], [s * 1.0, Rb + 3.2, -0.15], 0.02, st);
  }
  add(act, box(0.3, 0.35, 0.2), mat("#c9ccc8"), 0, 0.15, -0.5);         // control box with line-break sensor
  // power gas tubing from both sides of the valve; equalizing bypass and blowdowns
  pipe(g, [-1.25, Rp + 0.05, 0], [-1.25, Rb + 3.2, 0], 0.025, st); pipe(g, [-1.25, Rb + 3.2, 0], [-0.6, Rb + 3.2, -0.15], 0.025, st);
  for (const s of [-1, 1]) { pipe(g, [s * 2.4, Rp, 0.0], [s * 2.4, 1.3, 0.0], 0.07, st); add(g, cyl(0.1, 0.25, 20), MT.red(), s * 2.4, 1.0, 0); }
  pipe(g, [-2.0, 0, -Rp], [-2.0, 0, -0.95], 0.06, st); pipe(g, [2.0, 0, -Rp], [2.0, 0, -0.95], 0.06, st); pipe(g, [-2.0, 0, -0.95], [2.0, 0, -0.95], 0.06, st);
  add(g, cyl(0.1, 0.22, 20).rotateX(Math.PI / 2), MT.red(), 0, 0, -0.95);
  label(parts, "Full-bore ball (piggable, 36\" port)", 0, Rb * 0.7, Rb * 0.5);
  label(parts, "Trunnion and stem bearings", 0, -Rb - 0.2, 0);
  label(parts, "Spring-loaded seats: double block and bleed", Rb * 0.8, -Rp - 0.1, 0);
  label(parts, "Gas-over-oil actuator (uses line gas)", 0, Rb + 1.6, 0.9);
  label(parts, "Gas/oil tanks", 0.6, Rb + 3.0, -0.15);
  label(parts, "Line-break controller", 0, Rb + 1.65, -0.6);
  label(parts, "Equalizing bypass", 0, 0, -0.95);
  label(parts, "Blowdown valves (vent each side)", 2.4, 1.2, 0);
  let target = 0, ang = 0;   // 0 open, pi/2 closed
  const self = {
    group: g, parts, fit: 8, center: [0, 0.9, 0],
    actions: [{ label: "Close valve", fn(btn) { target = target ? 0 : Math.PI / 2; btn.textContent = target ? "Open valve" : "Close valve"; } }],
    update(dt) {
      const sp = Math.PI / 2 / 6;   // ~6 s stroke (real valves take ~60 s)
      ang += Math.max(-sp * dt, Math.min(sp * dt, target - ang)); ball.rotation.y = ang;
      tanks.forEach((tk, i) => tk.scale.y = 1);
    },
  };
  return self;
}

// 4. Suction scrubber (vertical gas-liquid separator)
function scrubberModel() {
  const g = new THREE.Group(), parts = [], R = 1.4, H = 8, y0 = 1.2, pt = MT.paint(), st = MT.steel();
  shell(add(g, tube(R, R - 0.09, H), pt, 0, y0 + H / 2, 0));
  const head = (s) => { const h = add(g, new THREE.SphereGeometry(R, 56, 20, 0, Math.PI * 2, s > 0 ? 0 : Math.PI / 2, Math.PI / 2), pt, 0, s > 0 ? y0 + H : y0, 0); h.scale.y = 0.5; h.material = pt.clone(); h.material.side = THREE.DoubleSide; return shell(h); };
  head(1); head(-1);
  // skirt and base ring
  shell(add(g, tube(R, R - 0.03, y0 - 0.2), MT.dark(), 0, (y0 - 0.2) / 2, 0));
  add(g, cyl(R + 0.25, 0.2, 48), MT.dark(), 0, 0.1, 0);
  // inlet nozzle with vane-type inlet device
  const yin = y0 + 4.2;
  shell(add(g, alongX(tube(0.3, 0.28, 1.4)), st, -R - 0.4, yin, 0)); flange(g, 0.3, -R - 1.1, st);
  const vane = new THREE.Group(); vane.position.set(-0.5, yin, 0); g.add(vane);
  for (let i = 0; i < 9; i++) { const b = add(vane, box(0.03, 0.6, 0.5), MT.dark(), i * 0.14, 0, 0); b.rotation.y = 0.5 + i * 0.05; b.position.z = (i - 4) * 0.05; }
  add(vane, box(1.3, 0.04, 0.9), MT.dark(), 0.56, 0.32, 0); add(vane, box(1.3, 0.04, 0.9), MT.dark(), 0.56, -0.32, 0);
  // vane-pack mist eliminator near the top, support ring, outlet nozzle
  const vp = new THREE.Group(); vp.position.set(0, y0 + 6.6, 0); g.add(vp);
  for (let i = 0; i < 22; i++) { const zz = -1.2 + i * 0.115, w = 2 * Math.sqrt(Math.max(0, (R - 0.1) ** 2 - zz * zz)); if (w < 0.2) continue; const pl = add(vp, box(w, 0.5, 0.012), mat("#c9ced2", { metalness: 0.9, roughness: 0.3 }), 0, 0, zz); pl.rotation.x = (i % 2 ? 0.25 : -0.25); }
  add(g, new THREE.TorusGeometry(R - 0.12, 0.04, 8, 64).rotateX(Math.PI / 2), MT.dark(), 0, y0 + 6.3, 0);
  pipe(g, [0, y0 + H + 0.6, 0], [0, y0 + H + 1.5, 0], 0.3, st); flange(g, 0.3, y0 + H + 1.5, st, "y");
  // liquid sump, vortex breaker, drain, level bridle with gauge glass and level transmitter
  const liq = add(g, cyl(R - 0.1, 0.9, 48), MT.liquid(), 0, y0 + 0.45 - 0.2, 0);
  add(g, box(0.6, 0.3, 0.02), MT.dark(), 0, y0 - 0.2, 0); add(g, box(0.02, 0.3, 0.6), MT.dark(), 0, y0 - 0.2, 0);
  pipe(g, [0, y0 - 0.7, 0], [0, -0.3 + 0.6, 0], 0.07, st); pipe(g, [0, 0.3, 0], [1.6, 0.3, 0], 0.07, st); add(g, cyl(0.12, 0.25, 20).rotateZ(Math.PI / 2), MT.red(), 1.2, 0.3, 0);
  pipe(g, [R + 0.5, y0 + 0.2, 0.5], [R + 0.5, y0 + 2.4, 0.5], 0.06, st);
  for (const yy of [y0 + 0.2, y0 + 2.4]) pipe(g, [R * 0.86, yy, 0.5 * 0.86], [R + 0.5, yy, 0.5], 0.04, st);
  add(g, box(0.1, 1.6, 0.14), MT.glass(), R + 0.66, y0 + 1.3, 0.5);
  add(g, box(0.22, 0.28, 0.2), mat("#c9ccc8"), R + 0.5, y0 + 2.75, 0.5);
  // manway, ladder
  shell(add(g, alongZ(cyl(0.32, 0.5, 32)), pt, 0, y0 + 2.6, R + 0.15)); add(g, alongZ(cyl(0.45, 0.12, 32)), st, 0, y0 + 2.6, R + 0.42);
  for (const s of [-1, 1]) pipe(g, [R + 0.25, 0.3, s * 0.25 - 1.0], [R + 0.25, y0 + H + 0.5, s * 0.25 - 1.0], 0.025, MT.yellow(), 8);
  for (let y = 0.6; y < y0 + H + 0.4; y += 0.3) pipe(g, [R + 0.25, y, -1.25], [R + 0.25, y, -0.75], 0.015, MT.yellow(), 6);
  const gas = tracers(g, 700, "#ffd28a", 0.06), drops = tracers(g, 260, "#6fc3ff", 0.07);
  label(parts, "Inlet nozzle with vane-type inlet device", -R - 0.6, yin + 0.4, 0);
  label(parts, "Gravity settling section", 0, y0 + 5.3, 0);
  label(parts, "Vane-pack mist eliminator (>99 % of drops > 10 um)", 0, y0 + 6.85, 0.3);
  label(parts, "Gas outlet to compressor suction", 0, y0 + H + 1.6, 0);
  label(parts, "Liquid sump with vortex breaker", 0, y0 + 0.1, 0);
  label(parts, "Level bridle, gauge glass and transmitter", R + 0.6, y0 + 2.9, 0.5);
  label(parts, "Drain with level-controlled dump valve", 1.2, 0.5, 0);
  label(parts, "Manway (inspection)", 0, y0 + 2.6, R + 0.5);
  return {
    group: g, parts, fit: 17, center: [0, 5, 0], explodeAxis: "y",
    update(dt, live) {
      const load = Math.min(1.5, (live.vsup ?? 0.15) / 0.15);
      for (let i = 0; i < gas.n; i++) {           // gas: enter at inlet, spread, rise to outlet
        gas.u[i] += dt * 0.12 * load; if (gas.u[i] > 1) { gas.u[i] = 0; gas.a[i] = Math.random(); gas.b[i] = Math.random(); }
        const u = gas.u[i], an = gas.b[i] * Math.PI * 2, rr = Math.sqrt(gas.a[i]) * (R - 0.15);
        let x, y, z;
        if (u < 0.15) { const k = u / 0.15; x = -R - 1 + k * (R + 1 + 0.2); y = yin + (gas.a[i] - 0.5) * 0.4 * k; z = (gas.b[i] - 0.5) * 0.4 * k; }
        else if (u < 0.85) { const k = (u - 0.15) / 0.7; x = Math.cos(an) * rr * Math.min(1, k * 3); z = Math.sin(an) * rr * Math.min(1, k * 3); y = yin + k * (y0 + H - yin); }
        else { const k = (u - 0.85) / 0.15; x = Math.cos(an) * rr * (1 - k) * 0.9; z = Math.sin(an) * rr * (1 - k) * 0.9; y = y0 + H + k * 1.4; }
        gas.pos.set([x, y, z], i * 3);
      }
      for (let i = 0; i < drops.n; i++) {          // droplets knocked out at the inlet device and vane pack, fall to the sump
        drops.u[i] += dt * 0.35; if (drops.u[i] > 1) { drops.u[i] = 0; drops.a[i] = Math.random(); drops.b[i] = Math.random(); }
        const top = drops.a[i] < 0.3 ? y0 + 6.4 : yin - 0.3, an = drops.b[i] * Math.PI * 2, rr = Math.sqrt(drops.a[i]) * (R - 0.2);
        const y = top - drops.u[i] ** 2 * (top - (y0 + 0.25));
        drops.pos.set([Math.cos(an) * rr, y, Math.sin(an) * rr], i * 3);
      }
      gas.geo.attributes.position.needsUpdate = true; drops.geo.attributes.position.needsUpdate = true;
      liq.scale.y = 0.8 + 0.2 * Math.sin(performance.now() * 0.0004);
    },
  };
}

// 5. Gas turbine driver (two-shaft: gas generator + free power turbine)
function turbineModel() {
  const g = new THREE.Group(), parts = [], cs = mat("#c8ccc9", { metalness: 0.5 }), st = MT.steel();
  // casing profile along x: bellmouth inlet, compressor, combustor bulge, turbines, exhaust diffuser
  const prof = [[0.55, -2.6], [0.75, -2.5], [0.62, -2.2], [0.5, -1.9], [0.46, -1.0], [0.42, -0.3], [0.6, -0.1], [0.66, 0.5], [0.52, 0.8], [0.55, 1.4], [0.68, 1.9], [0.8, 2.4]];
  shell(add(g, alongX(lathe(prof.map(([r, y]) => [r, y]))), cs)).material.side = THREE.DoubleSide;
  // gas generator rotor: axial compressor (11 stages) + 2 turbine stages
  const gg = new THREE.Group(); g.add(gg);
  add(gg, alongX(cyl(0.2, 3.0, 32, 0.28)), st, -0.8, 0, 0);
  const bladeM = mat("#b9c0c4", { metalness: 1, roughness: 0.25 });
  function stage(parent, x, rHub, rTip, n, m, twist = 0.5, chord = 0.06) {
    const geo = box(0.012, rTip - rHub, chord);
    const im = new THREE.InstancedMesh(geo, m, n), q = new THREE.Quaternion(), M4 = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2, rr = (rHub + rTip) / 2;
      q.setFromEuler(new THREE.Euler(a, twist, 0, "XYZ"));
      M4.compose(new THREE.Vector3(x, Math.cos(a) * rr, Math.sin(a) * rr), q, new THREE.Vector3(1, 1, 1)); im.setMatrixAt(i, M4);
    }
    im.castShadow = true; parent.add(im);
    add(parent, alongX(cyl(rHub, chord * 1.2, 32)), MT.dark(), x, 0, 0);
  }
  for (let k = 0; k < 11; k++) { const x = -2.0 + k * 0.16, rt = 0.46 - k * 0.012; stage(gg, x, 0.24 + k * 0.006, rt, 36 - k, bladeM, 0.55, 0.07 - k * 0.002); }
  const hotM = MT.hot();
  stage(gg, 0.62, 0.3, 0.5, 46, hotM, -0.6, 0.08); stage(gg, 0.78, 0.3, 0.5, 46, hotM, -0.6, 0.08);
  // stators between compressor stages (static)
  for (let k = 0; k < 10; k++) stage(g, -1.92 + k * 0.16, 0.25 + k * 0.006, 0.46 - k * 0.012, 40, MT.dark(), -0.5, 0.05);
  // annular combustor with fuel injectors and flame glow
  add(g, alongX(new THREE.TorusGeometry(0.47, 0.11, 20, 64)).rotateY(0), mat("#cfa985", { metalness: 0.8 }), 0.2, 0, 0).rotation.y = Math.PI / 2;
  const flameM = new THREE.MeshBasicMaterial({ color: "#ff8a2a", transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
  const flame = add(g, new THREE.TorusGeometry(0.47, 0.07, 16, 64), flameM, 0.24, 0, 0); flame.rotation.y = Math.PI / 2;
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; pipe(g, [0.0, Math.cos(a) * 0.47, Math.sin(a) * 0.47], [-0.15, Math.cos(a) * 0.82, Math.sin(a) * 0.82], 0.018, st, 8); }
  add(g, alongX(new THREE.TorusGeometry(0.84, 0.03, 10, 64)).rotateY(0), MT.yellow(), -0.15, 0, 0).rotation.y = Math.PI / 2;   // fuel manifold
  // free power turbine (separate shaft) and output shaft
  const ptR = new THREE.Group(); g.add(ptR);
  stage(ptR, 1.2, 0.32, 0.58, 52, hotM, -0.7, 0.1); stage(ptR, 1.42, 0.32, 0.62, 52, hotM, -0.7, 0.1);
  add(ptR, alongX(cyl(0.12, 3.0, 24)), st, 2.6, 0, 0);
  shell(add(g, box(1.0, 1.8, 1.6), cs, 2.5, 0.9, 0));   // exhaust collector to the stack
  shell(add(g, cyl(0.45, 1.2, 32), cs, 2.5, 2.4, 0));
  // inlet plenum and filter, skid, accessory gearbox
  shell(add(g, box(0.8, 1.9, 1.9), mat("#a9b0b4", { metalness: 0.5 }), -3.05, 0.25, 0));
  add(g, box(7.2, 0.25, 2.0), MT.dark(), 0, -1.2, 0);
  for (const x of [-2.4, -0.4, 1.6]) add(g, box(0.18, 0.75, 0.9), MT.dark(), x, -0.75, 0);
  add(g, box(0.5, 0.6, 0.7), MT.blue(), -2.6, -0.6, 0.5);
  label(parts, "Air inlet plenum and filter house", -3.05, 1.2, 0);
  label(parts, "Axial compressor, 11 stages (pressure ratio ~10)", -1.2, 0.5, 0.2);
  label(parts, "Annular dry low-NOx combustor", 0.2, 0.6, 0.3);
  label(parts, "Fuel-gas manifold and injectors", -0.15, 0.85, 0);
  label(parts, "Gas-producer turbine, 2 stages", 0.7, -0.5, 0.2);
  label(parts, "Free power turbine, 2 stages", 1.3, 0.62, 0.2);
  label(parts, "Exhaust collector to stack", 2.5, 1.9, 0);
  label(parts, "Output shaft to the compressor", 3.8, 0, 0);
  return {
    group: g, parts, fit: 7.5,
    update(dt, live) {
      const load = live.load ?? 0.5, run = live.running !== false;
      gg.rotation.x += dt * (run ? 18 + 10 * load : 0);
      ptR.rotation.x += dt * (run ? 10 + 8 * load : 0);
      flameM.opacity = run ? 0.25 + 0.6 * load : 0;
    },
  };
}

// 6. Centrifugal pipeline compressor (barrel casing, 2 impellers)
function compressorModel() {
  const g = new THREE.Group(), parts = [], bl = MT.blue(), st = MT.steel();
  shell(add(g, alongX(tube(0.95, 0.85, 2.4)), bl));
  for (const s of [-1, 1]) shell(add(g, alongX(cyl(0.95, 0.14, 56)), mat("#284f78", { metalness: 0.4 }), s * 1.27, 0, 0));
  for (const s of [-1, 1]) for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2; add(g, alongX(cyl(0.035, 0.22, 8)), MT.dark(), s * 1.35, Math.cos(a) * 0.82, Math.sin(a) * 0.82); }
  // suction and discharge nozzles (top-mounted, 30")
  for (const [x, nm] of [[-0.6, "s"], [0.6, "d"]]) { shell(add(g, tube(0.42, 0.38, 1.3), bl, x, 1.3, 0)); flange(g, 0.42, 1.95, st, "y").position.x = x; }
  // rotor: shaft, two shrouded impellers with backswept blades, balance piston
  const rot = new THREE.Group(); g.add(rot);
  add(rot, alongX(cyl(0.11, 4.2, 32)), st);
  const impM = mat("#c3c8cb", { metalness: 1, roughness: 0.2 });
  for (const x0 of [-0.35, 0.35]) {
    const imp = new THREE.Group(); imp.position.x = x0; rot.add(imp);
    add(imp, alongX(lathe([[0.12, -0.12], [0.62, 0.02], [0.62, 0.05], [0.12, 0.02]])), impM);                // hub disc
    add(imp, alongX(lathe([[0.25, -0.18], [0.3, -0.12], [0.62, 0.1], [0.6, 0.13], [0.26, -0.1], [0.22, -0.16]])), mat("#aeb4b8", { metalness: 1, roughness: 0.25, side: THREE.DoubleSide }));   // shroud (eye)
    const n = 15, bm = mat("#d6dadc", { metalness: 1, roughness: 0.2 });
    for (let i = 0; i < n; i++) {             // backswept blade: chain of small segments following a log spiral
      for (let k = 0; k < 6; k++) {
        const r = 0.2 + k * 0.075, th = i / n * Math.PI * 2 + k * 0.12, b = add(imp, box(0.13, 0.012, 0.085), bm);
        b.position.set(-0.05 + k * 0.022, Math.cos(th) * r, Math.sin(th) * r); b.rotation.x = -th + 0.35;
      }
    }
    // vaned diffuser and return channel (static, on the casing)
    add(g, alongX(new THREE.TorusGeometry(0.73, 0.06, 12, 64)).rotateY(0), MT.dark(), x0 + 0.12, 0, 0).rotation.y = Math.PI / 2;
    for (let i = 0; i < 22; i++) { const a = i / 22 * Math.PI * 2, v = add(g, box(0.08, 0.1, 0.012), MT.dark(), x0 + 0.08, Math.cos(a) * 0.7, Math.sin(a) * 0.7); v.rotation.x = -a + 0.9; }
  }
  add(rot, alongX(cyl(0.3, 0.25, 40)), MT.dark(), 0.95, 0, 0);    // balance piston
  // dry gas seals and tilting-pad bearings at each end, coupling hub
  for (const s of [-1, 1]) {
    add(g, alongX(tube(0.26, 0.12, 0.3)), mat("#2f9a78", { metalness: 0.6 }), s * 1.55, 0, 0);
    add(g, alongX(tube(0.3, 0.12, 0.25)), MT.bronze(), s * 1.9, 0, 0);
    add(g, box(0.4, 0.9, 0.9), mat("#284f78"), s * 1.9, 0, 0).scale.set(1, 1, 1);
  }
  add(rot, alongX(cyl(0.22, 0.25, 32)), MT.yellow(), -2.3, 0, 0);
  add(g, box(4.8, 0.2, 2.0), MT.dark(), 0, -1.15, 0); for (const s of [-1, 1]) add(g, box(0.4, 0.55, 1.4), MT.dark(), s * 1.6, -0.8, 0);
  // anti-surge recycle loop: discharge back to suction through a control valve
  const rc = [[0.6, 2.0, 0.6], [0.6, 2.4, 0.6], [-0.6, 2.4, 0.6], [-0.6, 2.0, 0.6]];
  for (let i = 0; i < 3; i++) pipe(g, rc[i], rc[i + 1], 0.07, st);
  add(g, box(0.25, 0.25, 0.25), MT.red(), 0, 2.4, 0.6); add(g, cyl(0.15, 0.3, 20), MT.yellow(), 0, 2.7, 0.6);
  const gas = tracers(g, 900, "#ffd28a", 0.03);
  label(parts, "Barrel casing, design 84 bar", 0, 0.95, -0.4);
  label(parts, "Suction nozzle (from scrubbers)", -0.6, 2.0, 0);
  label(parts, "Discharge nozzle (to coolers)", 0.6, 2.0, 0);
  label(parts, "Shrouded impellers with backswept blades", -0.35, 0.5, 0.3);
  label(parts, "Vaned diffuser and return channel", 0.47, -0.7, 0.2);
  label(parts, "Balance piston", 0.95, 0.3, 0);
  label(parts, "Tandem dry gas seals", 1.55, 0.3, 0);
  label(parts, "Tilting-pad journal and thrust bearings", 1.9, 0.5, 0);
  label(parts, "Anti-surge recycle valve", 0, 2.6, 0.6);
  label(parts, "Coupling from power turbine", -2.3, 0.2, 0);
  return {
    group: g, parts, fit: 6,
    update(dt, live) {
      const load = live.load ?? 0.5, run = live.running !== false;
      rot.rotation.x += dt * (run ? 8 + 10 * load : 0);
      for (let i = 0; i < gas.n; i++) {   // gas: down the suction nozzle, through the two impellers (spiral out, return in), up the discharge
        gas.u[i] += dt * (run ? 0.18 : 0.02); if (gas.u[i] > 1) gas.u[i] -= 1;
        const u = gas.u[i], an = gas.b[i] * Math.PI * 2 + u * 20, j = (gas.a[i] - 0.5) * 0.5;
        let x, y, z;
        if (u < 0.2) { const k = u / 0.2; x = -0.6 + j * 0.5; y = 2.0 - k * 1.7; z = (gas.b[i] - 0.5) * 0.5; }
        else if (u < 0.8) { const k = (u - 0.2) / 0.6, s = k < 0.5 ? k * 2 : (k - 0.5) * 2, x0 = k < 0.5 ? -0.35 : 0.35; const r = 0.2 + 0.5 * Math.sin(Math.PI * s); x = x0 - 0.15 + s * 0.3; y = Math.cos(an) * r; z = Math.sin(an) * r; }
        else { const k = (u - 0.8) / 0.2; x = 0.6 + j * 0.5; y = 0.3 + k * 1.7; z = (gas.b[i] - 0.5) * 0.5; }
        gas.pos.set([x, y, z], i * 3);
      }
      gas.geo.attributes.position.needsUpdate = true;
    },
  };
}

// 7. Air-cooled gas cooler (one bay of the fin-fan bank)
function coolerModel() {
  const g = new THREE.Group(), parts = [], st = MT.steel(), dk = MT.dark();
  const finTex = (() => { const c = document.createElement("canvas"); c.width = 8; c.height = 64; const x = c.getContext("2d"); x.fillStyle = "#c5ccd0"; x.fillRect(0, 0, 8, 64); x.fillStyle = "#6c757b"; for (let y = 0; y < 64; y += 4) x.fillRect(0, y, 8, 1.3); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 120); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const finM = new THREE.MeshStandardMaterial({ map: finTex, metalness: 0.8, roughness: 0.4 });
  // structure: columns, plenum, fan rings
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(g, box(0.25, 6.5, 0.25), dk, sx * 5.8, 3.25, sz * 2.4);
  for (const sz of [-1, 1]) add(g, box(12, 0.3, 0.25), dk, 0, 6.5, sz * 2.4);
  // finned tube bundle: 4 rows of tubes running along x, two plug-type headers
  const tubes = new THREE.Group(); tubes.position.y = 7.0; g.add(tubes);
  for (let row = 0; row < 4; row++) for (let k = 0; k < 18; k++) add(tubes, alongX(cyl(0.057, 10.6, 12)), finM, 0, row * 0.12, -2.2 + k * 0.26 + (row % 2) * 0.13);
  for (const s of [-1, 1]) {
    add(g, box(0.5, 0.8, 5.0), mat("#c9ccc8", { metalness: 0.5 }), s * 5.55, 7.2, 0);
    for (let k = 0; k < 18; k++) for (let row = 0; row < 4; row++) add(g, alongX(cyl(0.035, 0.05, 10)), dk, s * 5.82, 6.95 + row * 0.12, -2.2 + k * 0.26 + (row % 2) * 0.13);
  }
  pipe(g, [-5.55, 7.6, 0], [-5.55, 9.0, 0], 0.3, st); flange(g, 0.3, 9.0, st, "y").position.x = -5.55;
  pipe(g, [5.55, 6.8, 0], [5.55, 5.2, 0], 0.3, st); flange(g, 0.3, 5.2, st, "y").position.x = 5.55;
  // forced-draft fans below the bundle: plenum, ring, blades, motor and belt drive
  const fans = [];
  for (const fx of [-2.9, 2.9]) {
    shell(add(g, lathe([[2.15, 0], [2.15, 0.6], [2.5, 1.2], [2.5, 1.25]], 4).rotateY(Math.PI / 4), mat("#b9bfc3", { metalness: 0.6, side: THREE.DoubleSide }), fx, 5.3, 0)).scale.set(1.15, 1, 1.0);
    add(g, tube(2.2, 2.15, 0.7), st, fx, 4.9, 0);
    const fan = new THREE.Group(); fan.position.set(fx, 4.9, 0); g.add(fan);
    add(fan, cyl(0.3, 0.3, 24), dk);
    for (let b = 0; b < 6; b++) { const bl = add(fan, box(1.85, 0.03, 0.32), mat("#2f3438", { metalness: 0.4 })); const a = b / 6 * Math.PI * 2; bl.position.set(Math.cos(a) * 1.15, 0, Math.sin(a) * 1.15); bl.rotation.y = -a; bl.rotation.x = 0.3; }
    fans.push(fan);
    add(g, cyl(0.06, 3.3, 12), st, fx, 2.9, 0);
    add(g, alongX(cyl(0.3, 0.7, 24)), MT.blue(), fx + 0.6, 1.5, 0);
    add(g, box(0.1, 3.0, 0.3), dk, fx + 0.3, 3.0, 0.3).rotation.z = 0.12;
  }
  // walkway with handrail along the header
  add(g, box(1.0, 0.06, 5.6), mat("#8b939a", { metalness: 0.6 }), 6.4, 6.6, 0);
  for (const zz of [-2.8, 2.8]) pipe(g, [6.9, 6.6, zz], [6.9, 7.7, zz], 0.025, MT.yellow(), 6);
  pipe(g, [6.9, 7.7, -2.8], [6.9, 7.7, 2.8], 0.025, MT.yellow(), 6);
  const air = tracers(g, 900, "#8ec9ff", 0.08);
  label(parts, "Finned tube bundle: 4 rows, aluminium fins", 0, 7.5, 0);
  label(parts, "Hot gas in (inlet header)", -5.55, 9.1, 0);
  label(parts, "Cooled gas out to the line", 5.55, 5.1, 0);
  label(parts, "Plug-type header box", 5.55, 7.6, -2.0);
  label(parts, "Axial fan, 6 blades, 4.3 m", -2.9, 4.9, 1.8);
  label(parts, "Fan motor and belt drive", 3.5, 1.5, 0);
  label(parts, "Plenum chamber", 2.9, 5.9, -2.2);
  label(parts, "Walkway for header maintenance", 6.4, 7.8, 0);
  return {
    group: g, parts, fit: 13, center: [0, 5, 0], explodeAxis: "y",
    update(dt, live) {
      const fanOn = live.running !== false, sp = fanOn ? 4 + 4 * (live.load ?? 0.5) : 0;
      for (const f of fans) f.rotation.y += dt * sp;
      for (let i = 0; i < air.n; i++) {   // air drawn up through the fans and bundle, warming from blue to orange
        air.u[i] += dt * (fanOn ? 0.35 : 0.04); if (air.u[i] > 1) { air.u[i] = 0; air.a[i] = Math.random(); air.b[i] = Math.random(); }
        const u = air.u[i], fx = air.b[i] < 0.5 ? -2.9 : 2.9, an = air.a[i] * 40, rr = Math.sqrt((air.a[i] * 7) % 1) * 2.0;
        const y = 2.0 + u * 8.5, spread = Math.min(1, u * 1.6);
        air.pos.set([fx + Math.cos(an) * rr * (0.6 + spread * 0.9), y, Math.sin(an) * rr * (0.6 + spread * 0.5)], i * 3);
      }
      air.geo.attributes.position.needsUpdate = true;
    },
  };
}

// 8. Pig launcher
function pigModel() {
  const g = new THREE.Group(), parts = [], Rl = 0.457, Rb = 0.55, st = MT.steel(), pt = MT.paint();
  shell(add(g, alongX(tube(Rb, Rb - 0.025, 4.0)), pt, -2.0, 0, 0));
  shell(add(g, alongX(lathe([[Rb, -0.4], [Rb - 0.003, -0.4], [Rl - 0.003, 0.4], [Rl, 0.4]].map(([r, y]) => [r, y]).reverse())), pt, 0.4, 0, 0)).material.side = THREE.DoubleSide;
  shell(add(g, alongX(tube(Rl, Rl - 0.012, 4.0)), MT.pe(), 2.8, 0, 0));
  // quick-opening closure: hub ring and door on a davit
  add(g, alongX(tube(Rb + 0.12, Rb - 0.02, 0.25)), st, -4.05, 0, 0);
  const door = new THREE.Group(); door.position.set(-4.18, 0, Rb + 0.12); g.add(door);
  add(door, alongX(cyl(Rb + 0.1, 0.12, 48)), st, 0, 0, -Rb - 0.12);
  add(door, alongX(cyl(0.1, 0.18, 20)), MT.red(), -0.1, 0.4, -Rb - 0.12);
  add(g, cyl(0.05, 1.4, 12), st, -4.18, 0.2, Rb + 0.12);
  // kicker line with valve from mainline, isolation valve, pressure gauge, drains, vent
  pipe(g, [-3.5, Rb, 0], [-3.5, 1.2, 0], 0.1, st); pipe(g, [-3.5, 1.2, 0], [3.5, 1.2, 0], 0.1, st); pipe(g, [3.5, 1.2, 0], [3.5, Rl, 0], 0.1, st);
  add(g, box(0.4, 0.35, 0.3), MT.red(), 0, 1.2, 0); add(g, cyl(0.04, 0.4, 10), st, 0, 1.55, 0); add(g, cyl(0.2, 0.05, 24), MT.yellow(), 0, 1.78, 0);
  add(g, box(0.5, 1.4, 1.2), MT.red(), 1.6, 0, 0).visible = false;   // placeholder for clipping symmetry
  const vb = add(g, alongX(cyl(Rl + 0.15, 0.7, 40)), MT.dark(), 1.6, 0, 0); shell(vb);
  add(g, box(0.3, 0.6, 0.3), MT.yellow(), 1.6, Rl + 0.5, 0); add(g, cyl(0.3, 0.05, 24), MT.yellow(), 1.6, Rl + 0.85, 0);
  pipe(g, [-1.5, Rb, 0], [-1.5, Rb + 0.45, 0], 0.02, st); add(g, alongZ(cyl(0.09, 0.04, 24)), mat("#f2f2ee"), -1.5, Rb + 0.55, 0.02);
  pipe(g, [-3.0, -Rb, 0], [-3.0, -1.0, 0], 0.05, st); pipe(g, [-0.8, -Rb + 0.05, 0], [-0.8, -1.0, 0], 0.05, st);
  pipe(g, [-2.6, Rb, 0], [-2.6, Rb + 0.7, 0], 0.04, st);
  add(g, box(0.25, 0.2, 0.15), MT.blue(), 2.2, Rl + 0.1, 0);   // pig signaller
  for (const x of [-3.2, -1.0, 2.6]) add(g, box(0.25, 0.6, 0.8), MT.dark(), x, -0.85, 0);
  // the pig: body with polyurethane cups and discs, magnets/brushes
  const pig = new THREE.Group(); g.add(pig);
  add(pig, alongX(cyl(0.2, 1.1, 24)), st);
  for (const x of [-0.45, -0.15, 0.15, 0.45]) add(pig, alongX(lathe([[0.2, -0.05], [Rl - 0.005, 0.03], [Rl - 0.01, 0.07], [0.2, 0.0]])), MT.poly(), x, 0, 0);
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; add(pig, alongX(cyl(0.012, 0.18, 6)), mat("#58606a", { metalness: 0.8 }), 0, Math.cos(a) * (Rl - 0.12), Math.sin(a) * (Rl - 0.12)); }
  add(pig, alongX(cyl(0.12, 0.1, 16)), MT.yellow(), 0.6, 0, 0);
  label(parts, "Oversize launcher barrel (42\")", -2.6, Rb, 0.2);
  label(parts, "Quick-opening closure with pressure interlock", -4.2, Rb + 0.2, 0);
  label(parts, "Pig: polyurethane cups and cleaning brushes", -2.4, 0.3, 0);
  label(parts, "Reducer to 36\" line", 0.4, Rb, 0);
  label(parts, "Kicker line and throttling valve", 0, 1.8, 0);
  label(parts, "Mainline isolation valve", 1.6, Rl + 0.9, 0);
  label(parts, "Pig passage signaller", 2.2, Rl + 0.25, 0);
  label(parts, "Pressure gauge, vent and drains", -1.5, Rb + 0.65, 0);
  let t = 0, run = false;
  return {
    group: g, parts, fit: 7.5,
    actions: [{ label: "Launch pig", fn(btn) { run = true; t = 0; } }],
    update(dt, live) {
      if (run) { t += dt; } const v = Math.min(5, Math.max(1, live.vel ?? 3));
      const x = run ? Math.min(-2.4 + t * v * 0.5, 6) : -2.4; pig.position.x = x;
      const s = x > -0.2 ? Math.min(1, Math.max(Rl / Rb, 1 - (x + 0.2) / 0.8 * (1 - Rl / Rb))) : 1;
      pig.scale.set(1, s, s);
      if (run && x >= 6) { run = false; pig.position.x = -2.4; pig.scale.set(1, 1, 1); }
      door.rotation.y = 0;
    },
  };
}

// 9. City-gate axial-flow pressure regulator (worker) with pilot
function regulatorModel() {
  const g = new THREE.Group(), parts = [], R = 0.2, st = MT.steel(), body = mat("#3c6f9e", { metalness: 0.4 });
  shell(add(g, alongX(lathe([[R, -0.6], [R + 0.05, -0.6], [R + 0.14, -0.25], [R + 0.16, 0], [R + 0.14, 0.25], [R + 0.05, 0.6], [R, 0.6]])), body)).material.side = THREE.DoubleSide;
  flange(g, R + 0.05, -0.6, st); flange(g, R + 0.05, 0.6, st);
  shell(add(g, alongX(tube(R + 0.012, R, 1.6)), MT.paint(), -1.4, 0, 0)); shell(add(g, alongX(tube(R + 0.15, R + 0.13, 1.6)), MT.paint(), 1.5, 0, 0));
  // central cage with slots, moving sleeve (the throttling element), diaphragm housing in the core
  const cageTex = (() => { const c = document.createElement("canvas"); c.width = 64; c.height = 64; const x = c.getContext("2d"); x.fillStyle = "#c2c8cc"; x.fillRect(0, 0, 64, 64); x.clearRect(0, 18, 64, 28); for (let i = 0; i < 64; i += 16) { x.fillStyle = "#c2c8cc"; x.fillRect(i, 18, 5, 28); } const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.repeat.set(10, 1); return t; })();
  add(g, alongX(cyl(R * 0.62, 0.35, 48, R * 0.62, true)), new THREE.MeshStandardMaterial({ map: cageTex, alphaTest: 0.5, transparent: true, metalness: 0.8, roughness: 0.3, side: THREE.DoubleSide }), 0.05, 0, 0);
  const sleeve = add(g, alongX(tube(R * 0.7, R * 0.64, 0.3)), mat("#e0e3e5", { metalness: 1, roughness: 0.15 }), -0.15, 0, 0);
  add(g, alongX(lathe([[0.001, -0.42], [0.1, -0.35], [R * 0.6, -0.2], [R * 0.6, 0.0], [0.001, 0.0]])), mat("#2f5b84"), 0, 0, 0);
  add(g, alongX(lathe([[R * 0.62, 0.22], [R * 0.4, 0.42], [0.001, 0.5]])), mat("#2f5b84"), 0, 0, 0);
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4; const rib = add(g, box(0.5, 0.02, 0.06), st, 0.05, Math.cos(a) * (R + 0.05) * 0.85, Math.sin(a) * (R + 0.05) * 0.85); rib.rotation.x = a; }
  // pilot, restrictor, sensing line downstream, gauges
  const pilot = new THREE.Group(); pilot.position.set(0, 0.62, 0); g.add(pilot);
  add(pilot, cyl(0.1, 0.18, 32), mat("#c9a227"), 0, 0, 0); add(pilot, cyl(0.035, 0.25, 12), st, 0, 0.2, 0); add(pilot, cyl(0.06, 0.04, 16), MT.dark(), 0, 0.34, 0);
  add(g, box(0.12, 0.1, 0.1), MT.dark(), -0.3, 0.55, 0);
  pipe(g, [-0.5, R, 0], [-0.5, 0.55, 0], 0.012, st); pipe(g, [-0.5, 0.55, 0], [-0.1, 0.62, 0], 0.012, st);
  pipe(g, [0.1, 0.62, 0], [0.45, 0.45, 0], 0.012, st); pipe(g, [0.45, 0.45, 0], [0.45, R + 0.15, 0], 0.012, st);
  pipe(g, [0.08, 0.6, 0.0], [1.9, 0.6, 0.0], 0.01, mat("#d4d4d4", { metalness: 0.8 })); pipe(g, [1.9, 0.6, 0], [1.9, R + 0.15, 0], 0.01, mat("#d4d4d4", { metalness: 0.8 }));
  for (const [x, rr] of [[-1.0, R], [2.2, R + 0.15]]) { pipe(g, [x, rr, 0], [x, rr + 0.3, 0], 0.012, st); add(g, alongZ(cyl(0.07, 0.035, 24)), mat("#f2f2ee"), x, rr + 0.37, 0.02); }
  for (const x of [-1.9, -0.9, 1.0, 2.0]) add(g, box(0.2, 0.3, 0.4), MT.dark(), x, -0.42, 0);
  const gas = tracers(g, 700, "#ffd28a", 0.016);
  label(parts, "Axial-flow body, inlet DN400 Class 600", -0.4, R + 0.1, 0);
  label(parts, "Slotted cage", 0.05, R * 0.62, 0.05);
  label(parts, "Throttling sleeve (moves with load)", -0.15, -R * 0.7, 0);
  label(parts, "Pilot regulator with set-point spring", 0, 1.0, 0);
  label(parts, "Restrictor and loading line", -0.3, 0.62, 0);
  label(parts, "Downstream sensing line", 1.9, 0.62, 0);
  label(parts, "Larger outlet pipe (velocity limit)", 1.5, R + 0.15, 0);
  label(parts, "Inlet and outlet gauges", -1.0, R + 0.45, 0);
  let open = 0.5;
  return {
    group: g, parts, fit: 4.4,
    update(dt, live) {
      const target = Math.min(1, Math.max(0.1, live.open ?? 0.5)); open += (target - open) * Math.min(1, dt * 2);
      sleeve.position.x = -0.15 + open * 0.2;
      for (let i = 0; i < gas.n; i++) {
        gas.u[i] += dt * 0.25 * (0.5 + open); if (gas.u[i] > 1) gas.u[i] -= 1;
        const u = gas.u[i], an = gas.b[i] * Math.PI * 2, x = -2.2 + u * 4.5;
        let r; if (x < -0.45) r = Math.sqrt(gas.a[i]) * R * 0.9; else if (x < 0.45) r = R * 0.7 + gas.a[i] * (R + 0.12 - R * 0.7) * 0.9; else r = Math.sqrt(gas.a[i]) * (R + 0.12) * Math.min(1, 0.6 + (x - 0.45));
        gas.pos.set([x, Math.cos(an) * r, Math.sin(an) * r], i * 3);
      }
      gas.geo.attributes.position.needsUpdate = true;
    },
  };
}

// 10. Inside the pipe: turbulent velocity profile, viscous sublayer, wall roughness
function flowModel() {
  const g = new THREE.Group(), parts = [], R = 0.457, L = 3.0;
  shell(add(g, alongX(tube(R + 0.011, R, L)), MT.steel()));
  // wall roughness: small bumps on the far half of the bore
  const bump = new THREE.InstancedMesh(new THREE.SphereGeometry(0.006, 6, 4), MT.dark(), 900), m4 = new THREE.Matrix4();
  for (let i = 0; i < 900; i++) { const a = Math.PI * (0.05 + 0.9 * Math.random()) + Math.PI, x = -L / 2 + Math.random() * L; m4.makeTranslation(x, Math.sin(a) * R * 0.998, Math.cos(a) * R * 0.998); bump.setMatrixAt(i, m4); }
  g.add(bump);
  // velocity profile arrows on a vertical diameter, u(r) = Umax (1 - r/R)^(1/7)
  const arrows = [], arrM = new THREE.MeshStandardMaterial({ color: "#c5050c", roughness: 0.5 });
  for (let k = -9; k <= 9; k++) {
    const y = k / 9.5 * R, u = Math.pow(Math.max(0, 1 - Math.abs(y) / R), 1 / 7);
    const sh = add(g, alongX(cyl(0.011, 1, 8)), arrM, -0.9, y, 0), hd = add(g, alongX(new THREE.ConeGeometry(0.03, 0.08, 12)), arrM, 0, y, 0);
    arrows.push({ sh, hd, u });
  }
  // profile envelope line and the viscous sublayer (exaggerated thickness)
  const env = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: "#c5050c" })); g.add(env);
  const sub = shell(add(g, alongX(tube(R, R - 0.02, L, 64)), new THREE.MeshBasicMaterial({ color: "#6fb4e8", transparent: true, opacity: 0.45, side: THREE.DoubleSide })));
  // eddies: tracer parcels moving with u(r) plus a random turbulent wander
  const tr = tracers(g, 1400, "#ffb347", 0.012);
  label(parts, "Turbulent core: velocity nearly flat", -0.9, 0, 0);
  label(parts, "1/7-power-law velocity profile", 0.05, 0.3, 0);
  label(parts, "Viscous sublayer (exaggerated)", 0.6, -R + 0.03, 0);
  label(parts, "Wall roughness 0.012 mm (exaggerated)", -0.4, -R, -0.15);
  label(parts, "Steel wall, 11.1 mm", 1.2, R + 0.01, 0);
  label(parts, "Eddies carry momentum to the wall (turbulent stress)", 1.0, 0.15, 0.1);
  let t = 0;
  return {
    group: g, parts, fit: 2.4,
    update(dt, live) {
      t += dt; const U = live.vel ?? 4, sc = 0.22;
      const pts = [];
      for (const a of arrows) { const len = Math.max(0.02, a.u * U * sc); a.sh.scale.set(1, len, 1); a.sh.position.x = -0.9 + len / 2; a.hd.position.x = -0.9 + len + 0.04; pts.push(new THREE.Vector3(-0.9 + len + 0.05, a.sh.position.y, 0)); }
      env.geometry.setFromPoints(pts);
      for (let i = 0; i < tr.n; i++) {
        const r = Math.sqrt(tr.a[i]) * R * 0.97, u = Math.pow(1 - r / R, 1 / 7);
        tr.u[i] += dt * U * u * 0.08; if (tr.u[i] > 1) tr.u[i] -= 1;
        const an = tr.b[i] * Math.PI * 2 + 0.6 * Math.sin(t * 3 + i), rr = r + 0.02 * Math.sin(t * 5 + i * 1.7);
        tr.pos.set([-L / 2 + tr.u[i] * L, Math.sin(an) * rr, Math.cos(an) * rr], i * 3);
      }
      tr.geo.attributes.position.needsUpdate = true;
    },
  };
}

// 11. Molecules: a 6 nm box of pipeline gas at the local pressure and temperature (time slowed ~10^12)
function moleculesModel() {
  const g = new THREE.Group(), parts = [], B = 6;        // 1 scene unit = 1 nm
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(B, B, B)), new THREE.LineBasicMaterial({ color: "#9aa0a6" })); edges.position.y = B / 2 + 0.2; g.add(edges);
  const spec = [["CH₄", 0.90, 0.38, "#9aa6b2"], ["C₂H₆", 0.05, 0.44, "#5c7a99"], ["C₃H₈", 0.02, 0.51, "#3d5a73"], ["N₂", 0.02, 0.36, "#2f6fb0"], ["CO₂", 0.01, 0.40, "#c5050c"]];
  const MAXN = 420, mols = [];
  const geo = new THREE.SphereGeometry(1, 16, 10);
  for (const [nm, y, d, col] of spec) {
    const n = Math.max(1, Math.round(MAXN * y)), im = new THREE.InstancedMesh(geo, mat(col, { metalness: 0.1, roughness: 0.4 }), n);
    im.frustumCulled = false; g.add(im);
    const st = []; for (let i = 0; i < n; i++) st.push({ p: new THREE.Vector3(Math.random() * B, Math.random() * B, Math.random() * B), v: new THREE.Vector3().randomDirection().multiplyScalar(0.6 + Math.random()) });
    mols.push({ nm, im, st, r: d / 2, M: { "CH₄": 16, "C₂H₆": 30, "C₃H₈": 44, "N₂": 28, "CO₂": 44 }[nm] });
  }
  label(parts, "Methane CH₄ (90 %), kinetic diameter 0.38 nm", B * 0.3, B * 0.9, B / 2);
  label(parts, "Ethane and propane (heavier, slower)", B * 0.8, B * 0.5, B / 2);
  label(parts, "N₂ and CO₂ (inerts)", B * 0.2, B * 0.25, B / 2);
  label(parts, "Box 6 nm on a side; motion slowed about 10¹² times", B, B + 0.4, B);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sv = new THREE.Vector3();
  let shown = MAXN;
  return {
    group: g, parts, fit: 13, center: [B / 2, B / 2, B / 2],
    update(dt, live) {
      // number in the box from the local density: n = rho N_A / M; scale shown count to the box volume
      const nTarget = live.nBox ?? 250; shown = nTarget;
      for (const m of mols) {
        const nShow = Math.min(m.st.length, Math.round(m.st.length * nTarget / MAXN)), vs = Math.sqrt(16 / m.M) * 1.6;
        for (let i = 0; i < m.st.length; i++) {
          const s = m.st[i];
          s.p.addScaledVector(s.v, dt * vs);
          for (const ax of ["x", "y", "z"]) { if (s.p[ax] < m.r) { s.p[ax] = m.r; s.v[ax] = Math.abs(s.v[ax]); } if (s.p[ax] > B - m.r) { s.p[ax] = B - m.r; s.v[ax] = -Math.abs(s.v[ax]); } }
          if (Math.random() < dt * 0.8) s.v.randomDirection().multiplyScalar(0.6 + Math.random());   // collisions randomize direction
          m4.compose(i < nShow ? s.p.clone().setY(s.p.y + 0.2) : sv.set(0, -100, 0), q, sv.clone().setScalar(i < nShow ? m.r : 0.0001));
          m.im.setMatrixAt(i, m4);
        }
        m.im.instanceMatrix.needsUpdate = true;
      }
    },
  };
}

// 12. Steam-methane reformer tube (ammonia plant front end)
function reformerModel() {
  const g = new THREE.Group(), parts = [], R = 0.065, H = 12;
  // firebox wall section and burners
  shell(add(g, box(3.2, H + 1, 0.3), mat("#b9734a", { roughness: 0.9, metalness: 0 }), 0, H / 2, -0.9));
  add(g, box(3.2, 0.3, 2.0), mat("#8d5a3b", { roughness: 0.9, metalness: 0 }), 0, H + 0.6, 0);
  const flameM = new THREE.MeshBasicMaterial({ color: "#ff9a3c", transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const x of [-1.1, 1.1]) { add(g, box(0.3, 0.2, 0.3), MT.dark(), x, H + 0.4, 0); add(g, new THREE.ConeGeometry(0.22, 3.2, 16).rotateX(Math.PI), flameM, x, H - 1.4, 0); }
  // three tubes, the middle one cut open to show catalyst pellets
  for (const x of [-0.5, 0, 0.5]) {
    const t = add(g, tube(R + 0.012, R, H), mat("#8f6d5b", { metalness: 0.8, roughness: 0.5 }), x, H / 2, 0); if (x === 0) shell(t);
    add(g, cyl(0.03, 1.2, 10), MT.steel(), x, H + 0.6 + 0.6, 0); add(g, cyl(0.03, 1.0, 10), MT.steel(), x, -0.5, 0);
  }
  const pel = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.012, 0.012, 0.016, 8), mat("#e6e1d8", { metalness: 0, roughness: 0.8 }), 1600), m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  for (let i = 0; i < 1600; i++) { const r = Math.sqrt(Math.random()) * (R - 0.012), a = Math.random() * Math.PI * 2; q.setFromEuler(new THREE.Euler(Math.random() * 3, Math.random() * 3, 0)); m4.compose(new THREE.Vector3(Math.cos(a) * r, 0.3 + Math.random() * (H - 0.6), Math.sin(a) * r), q, new THREE.Vector3(1, 1, 1)); pel.setMatrixAt(i, m4); }
  g.add(pel);
  const gas = tracers(g, 600, "#ffd28a", 0.035);
  add(g, box(3.4, 0.5, 2.2), MT.dark(), 0, -1.2, 0);
  label(parts, "Catalyst tube, Ni on alumina pellets", 0, H * 0.5, 0.1);
  label(parts, "Burners fire down the radiant box (fuel gas)", 1.1, H + 0.4, 0);
  label(parts, "Gas + steam in at ~500 °C", 0, H + 1.3, 0);
  label(parts, "Syngas out at ~850 °C: H₂, CO, CO₂", 0, -0.6, 0);
  label(parts, "Refractory-lined firebox wall", -1.2, H * 0.3, -0.8);
  return {
    group: g, parts, fit: 15, center: [0, H / 2, 0],
    update(dt, live) {
      const on = (live.load ?? 1) > 0.05;
      flameM.opacity = on ? 0.55 : 0;
      for (let i = 0; i < gas.n; i++) { gas.u[i] += dt * (on ? 0.08 : 0); if (gas.u[i] > 1) gas.u[i] -= 1; const r = Math.sqrt(gas.a[i]) * R * 0.85, an = gas.b[i] * 6.28; gas.pos.set([Math.cos(an) * r, H - gas.u[i] * H, Math.sin(an) * r], i * 3);
        gas.mat.color.setHSL(0.11 - 0.1 * 0.5, 1, 0.6); }
      gas.geo.attributes.position.needsUpdate = true;
    },
  };
}
export const EXTRA_MODELS = { flowModel, moleculesModel, reformerModel, compressorModel, turbineModel, regulatorModel };
export { pitzer, rhoAt, mmscmd, A_LINE, GAMMA, f1, f2, f0, f3 };

// ===================================================================================
// tour stops
// ===================================================================================
// ctx: { sim, comp (selected station's comp), cs (its compState), linkState(i), stationName }
export const STOPS = [
  {
    id: "supply", title: "Export meter station", where: "Node 1 · supply plant outlet", model: meterModel,
    role: "Gas leaves the processing plant here. Ultrasonic meters measure every kilogram sent into the line (custody transfer), and the plant holds the line inlet at the supply pressure $\\theta_1$, the paper's fixed boundary condition (4.15).",
    specs: [["Meter runs", "3 × DN400 (16\"), 2 duty + 1 standby"], ["Meter type", "4-path ultrasonic, ISO 17089 / AGA 9"], ["Uncertainty", "± 0.5 % of mass flow"], ["Flow conditioning", "Perforated plate, 10 D straight run"], ["Export pressure", "57 bar ($\\theta_1$ in the paper)", "P"], ["Gas", "M 18 kg/kmol, z 0.8, 20 °C (App. A)", "P"]],
    live: c => { const f = c.sim.supplyFlow, p = c.sim.thetaSupply, v = f / 2 / (rhoAt(p) * Math.PI * 0.381 ** 2 / 4);
      return { rows: [["Supply flow", `${f2(mmscmd(f))} MMSCM/d · ${f1(f)} kg/s`], ["Inlet pressure $\\theta_1$", `${f1(p)} bar`], ["Gas density", `${f1(rhoAt(p))} kg/m³`], ["Velocity per duty run", `${f1(v)} m/s`], ["≈ In everyday terms", `a day's gas for ${big(homesFromKgs(f))} homes`]], vel: v }; },
  },
  {
    id: "pipe", title: "Line pipe", where: "Buried mainline · shown at the river span", model: pipeModel,
    role: "1600 km of 36-inch steel pipe, buried with at least 1.2 m of cover. The pipe is both the conveyor and the storage: its 0.66 m² bore holds the line pack, and wall friction (the c3 f|f|/p term in eq. 2.6b) sets how fast pressure falls between stations.",
    specs: [["Line length", "1600 km; 100 km between stations", "P"], ["Grade", `API 5L X70 PSL2, SMYS 483 MPa${ref("api5l")}`], ["Diameter", "914 mm (D in the paper)", "P"], ["Wall", "11.1 mm"], ["Design pressure", `84 bar (ASME B31.8 class 1, F 0.72)${ref("asme")}`], ["Coating", "FBE + 3-layer PE, 3.2 mm; heat-shrink field joints"], ["Corrosion control", "Impressed-current CP, −850 mV CSE"], ["Friction factor", "$\\lambda$ = 0.0084 (rugosity 0.012 mm)", "P"], ["Model grid", "$N_x$ = 10 points per link, eq. (3.11b,c)", "P"]],
    live: c => { const l = c.sim.links[6], s = c.sim.state[l.id], k = 6, p = s.p[k], v = s.vel[k];
      return { rows: [["Pressure here (link 7)", `${f1(p)} bar`], ["Gas velocity", `${f2(v)} m/s`], ["Line pack per km", `${f1(A_LINE * rhoAt(p))} t/km`], ["Line pack, link 7", `${f2(s.pack / 1e6)} kt`], ["Whole line", `${f2(c.sim.linepack / 1e6)} kt`], ["≈ One km of this pipe holds", `a day's gas for ${big(A_LINE * rhoAt(p) * 1000 / RHO_N / EVERY.homeGas)} homes`]], vel: v }; },
  },
  {
    id: "valve", title: "Mainline block valve", where: "Valve site at mid-link", model: ballValveModel,
    role: "Every 50 km a full-bore ball valve can isolate a section of line. The actuator runs on line gas, so it works with no grid power, and a line-break controller closes it on its own if pressure falls too fast. Blowdown valves on each side vent the isolated section for repairs.",
    specs: [["Valve", "36\" trunnion-mounted ball, full bore (piggable)"], ["Rating", "ASME Class 600, API 6D, double block & bleed"], ["Actuator", "Gas-over-oil, line-gas powered, ≈ 60 s stroke"], ["Line-break trip", "Pressure drop rate > 1.5 bar/min"], ["Spacing", "≈ 50 km (one per link midpoint)"], ["Telemetry", "Solar RTU, satellite link to control centre"]],
    live: c => { const s = c.sim.state[c.sim.links[c.linkIx].id], p = s.p[4];
      return { rows: [["Pressure at valve", `${f1(p)} bar`], ["Flow through", `${f2(mmscmd(s.f[4]))} MMSCM/d`], ["Section line pack (50 km)", `${f1(A_LINE * rhoAt(p) * 50)} t`], ["Status", "Open"], ["≈ Gas behind each valve", `${big(A_LINE * rhoAt(p) * 50000 / RHO_N / EVERY.homeGas)} home-days of supply`]] }; },
  },
  {
    id: "scrubber", title: "Suction scrubber", where: "Compressor station inlet", model: scrubberModel, station: true,
    role: "Before gas reaches the compressor, two vertical separators knock out liquid droplets and dust that would erode the impellers. Gas slows down in the large vessel, so droplets fall out under gravity, and a vane pack catches the fine mist.",
    specs: [["Minimum suction", "34 bar (paper bound 4.18)", "P"], ["Vessels", "2 × 100 %, vertical"], ["Size", "2.8 m ID × 8.0 m tangent to tangent"], ["Design", "84 bar, SA-516-70, ≈ 90 mm shell"], ["Internals", "Vane inlet device, vane-pack mist eliminator"], ["Separation", "> 99 % of droplets above 10 µm"], ["Liquid handling", "Level control, dump valve to drain tank"]],
    live: c => { const ps = c.cs.suction, rho = rhoAt(ps), q = c.cs.flow / 2, vs = q / (rho * Math.PI * 1.4 ** 2), vmax = 0.1 * Math.sqrt((700 - rho) / rho);
      return { rows: [["Suction pressure", `${f1(ps)} bar (min 34)`], ["Gas density", `${f1(rho)} kg/m³`], ["Flow per vessel", `${f1(q)} kg/s`], ["Upward gas velocity", `${f2(vs)} m/s`], ["Vane-pack loading", `${f0(100 * vs / vmax)} % of Souders-Brown limit`]], vsup: vs }; },
  },
  {
    id: "turbine", title: "Gas turbine driver", where: "Inside the compressor building", model: turbineModel, station: true,
    role: "Each compressor is driven by a two-shaft gas turbine burning a little of the pipeline gas. The gas generator makes hot, high-pressure gas, and a separate free power turbine turns the compressor at the speed it needs. The paper caps each station at 3000 kW (bound 4.18).",
    specs: [["Units", "3 per station (2 duty + 1 standby)"], ["Rating", "1.5 MW ISO each → 3000 kW station limit", "P"], ["Type", "Two-shaft industrial, free power turbine"], ["Efficiency", "≈ 28 % simple cycle"], ["Fuel", "Line gas, LHV ≈ 46.8 MJ/kg"], ["Emissions", "Dry low-NOx combustor, < 25 ppm NOx"]],
    live: c => { const P = c.cs.power, run = P < 0.5 ? 0 : P <= 1500 ? 1 : 2, fuel = P / (0.28 * LHV_MIX * 1000);
      return { rows: [["Station shaft power", `${f0(P)} kW of ${f0(c.comp.PU)} kW`], ["Units running", `${run} of 3`], ["Load per running unit", run ? `${f0(100 * P / run / 1500)} %` : "–"], ["Fuel gas", `${f2(fuel * 86.4)} t/d (${f2(100 * fuel / Math.max(1e-6, c.cs.flow))} % of throughput)`], ["CO₂", `${f1(fuel * CO2_PER_KG * 86.4)} t/d`], ["≈ Fuel burned per day", `what ${big(homesFromKgs(fuel))} homes use`]], load: Math.min(1, P / c.comp.PU), running: P > 0.5 }; },
  },
  {
    id: "compressor", title: "Centrifugal compressor", where: "Inside the compressor building", model: compressorModel, station: true,
    role: "The compressor adds the boost $\\Delta\\theta$ that the paper's model applies at the inlet of each active link (3.11h): spinning impellers fling the gas outward, and diffusers turn that speed into pressure. Its power follows (3.11i): $P = c_4 f\\,[((\\theta+\\Delta\\theta)/\\theta)^{\\beta} - 1]$.",
    specs: [["Compressor model", "Boost $\\Delta\\theta$ at link inlet (3.11h), $\\Delta\\theta \\ge 0$", "P"], ["Power limit", "3000 kW per station (4.18)", "P"], ["Type", "Barrel casing, 2 shrouded impellers"], ["Design", "84 bar, 30\" top nozzles"], ["Seals and bearings", "Tandem dry gas seals, tilting-pad bearings"], ["Protection", "Anti-surge recycle valve and controller"], ["Model constants", "$c_4 = c_p T$ = 686 kJ/kg, $\\beta = (\\gamma-1)/\\gamma$ = 0.209", "P"]],
    live: c => { const s = c.cs, q = s.flow / rhoAt(s.suction) * 3600;
      return { rows: [["Suction → discharge", `${f1(s.suction)} → ${f1(s.discharge)} bar`], ["Boost $\\Delta\\theta$ · ratio", `${f2(s.dtheta)} bar · ${(s.ratio).toFixed(3)}`], ["Mass flow", `${f1(s.flow)} kg/s`], ["Actual inlet volume", `${f0(q)} m³/h`], ["Power (3.11i)", `${f0(s.power)} kW`], ["≈ Same power as", `${big(s.power / EVERY.homeElec)} homes' electricity`], ["Control mode", c.comp.mode === "pset" ? (s.active === "power" ? "Set-point, power-limited" : "Discharge set-point") : "Fixed boost"]], load: Math.min(1, s.power / c.comp.PU), running: s.power > 0.5 }; },
  },
  {
    id: "inside", title: "Inside the pipe", where: "Cutaway at the compressor discharge", model: pipeModel, station: true,
    role: "The pipe wall is cut open just downstream of the compressor. Each moving particle is a fixed mass of gas, so the particles bunch up where the gas is dense (high pressure) and speed up as pressure falls along the link. This is the mass and momentum balance of eqs. (2.6a,b) made visible.",
    specs: [["Mass balance", "$\\partial p/\\partial\\tau = -c_1\\,\\partial f/\\partial x,\\ c_1 = c^2/A$", "P"], ["Momentum balance", "$\\partial f/\\partial\\tau = -c_2\\,\\partial p/\\partial x - c_3 f|f|/p$", "P"], ["Speed of sound", "$c$ = 370 m/s ($z$ = 0.8)", "P"], ["Flow area", "$A$ = 0.656 m²", "P"], ["Time step", "$\\Delta\\tau$ = 300 s here, 1800 s in the paper", "P"]],
    live: c => { const l = c.sim.links[c.stIx + 1], s = c.sim.state[l.id], p = s.p[0], v = s.vel[0], pe = s.p[s.p.length - 1], ve = s.vel[s.vel.length - 1];
      return { rows: [["Discharge pressure", `${f1(p)} bar`], ["Density here → link end", `${f1(rhoAt(p))} → ${f1(rhoAt(pe))} kg/m³`], ["Velocity here → link end", `${f2(v)} → ${f2(ve)} m/s`], ["Mass flow", `${f1(s.f[0])} kg/s`], ["Residence time in link", `${f1(s.pack / Math.max(1, s.f[0]) / 3600)} h`]], vel: v }; },
  },
  {
    id: "cooler", title: "Gas aftercooler", where: "Compressor station outlet", model: coolerModel, station: true,
    role: "Compression heats the gas. Air-cooled fin-fan coolers remove that heat so the gas re-enters the line near 20 °C. That's what lets the paper treat the line as isothermal at 293.15 K. Almost all the shaft power ends up as heat removed here.",
    specs: [["Type", "Forced-draft air-cooled exchanger"], ["Bank", "6 bays, 2 fans each"], ["Bundles", "4 rows, 25.4 mm tubes, aluminium fins"], ["Fans", "4.3 m, 6 blades, 30 kW motors, VFD"], ["Gas temperature in the line", "293.15 K, isothermal (App. A)", "P"], ["Outlet", "≤ 30 °C, approach to air ≈ 10 K"]],
    live: c => { const s = c.cs, dT = s.flow > 1 ? s.power / (s.flow * CP) : 0;
      return { rows: [["Heat removed", `${f0(s.power)} kW (≈ shaft power)`], ["Gas temperature rise across compressor", `${f1(dT)} K`], ["Compressor discharge", `≈ ${f1(20 + dT)} °C`], ["Gas back to line", "≈ 20 °C (isothermal model)"], ["≈ Heat dumped", `the average heating load of ${big(s.power / (EVERY.homeGas * RHO_N * LHV_MIX_ * 1000 / 86400))} homes`]], load: Math.min(1, s.power / c.comp.PU), running: s.power > 0.5 }; },
  },
  {
    id: "pig", title: "Pig launcher", where: "Compressor station yard", model: pigModel, station: true,
    role: "Pigs are plugs pushed through the line by the gas itself. Cleaning pigs sweep out liquids and debris, and smart pigs inspect the wall for corrosion and dents. They travel at about the local gas velocity, so the model's flow sets the run time to the next station.",
    specs: [["Barrel", "42\" oversize, reducer to 36\" line"], ["Closure", "Quick-opening, pressure-interlocked"], ["Pigs", "Cup/brush cleaning; MFL inspection every 5–7 years"], ["Valves", "Kicker, mainline isolation, drains, vent"], ["Speed", "1–5 m/s, follows the gas"]],
    live: c => { const l = c.sim.links[c.stIx + 1], s = c.sim.state[l.id], v = s.vel.reduce((a, b) => a + b, 0) / s.vel.length;
      return { rows: [["Mean gas velocity, next link", `${f2(v)} m/s`], ["Pig run to next station (100 km)", `${f1(100000 / Math.max(0.05, v) / 3600)} h`], ["Pressure behind pig", `${f1(s.p[0])} bar`], ["≈ Pig speed", `${f1(v * 3.6)} km/h, ${v * 3.6 < 7 ? "a brisk walk" : v * 3.6 < 14 ? "a jog" : "a bike ride"}`]], vel: v }; },
  },
  {
    id: "citygate", title: "City-gate regulator", where: "Node 13 · delivery", model: regulatorModel,
    role: "At the delivery end the gas is metered and its pressure is cut to what the customer's network needs. The paper requires at least 39 bar here (bound 4.18). Expanding gas cools (the Joule-Thomson effect), so large pressure cuts need preheating to keep the outlet above freezing.",
    specs: [["Runs", "3 × DN400, worker + monitor regulators"], ["Regulator", "Axial-flow, pilot-operated"], ["Outlet", "25 bar to the distribution and power plant"], ["Minimum inlet", "39 bar (paper bound 4.18)", "P"], ["Joule-Thomson", "≈ 0.45 K per bar of pressure cut"]],
    live: c => { const pd = c.sim.demandPressure, d = c.sim.demand.n13, cut = Math.max(0, pd - 25);
      return { rows: [["Delivery pressure", `${f1(pd)} bar ${pd >= 39 ? "(OK ≥ 39)" : "(below 39!)"}`], ["Delivered", `${f2(mmscmd(d))} MMSCM/d · ${f1(d)} kg/s`], ["Pressure cut", `${f1(cut)} bar`], ["JT cooling", `${f1(0.45 * cut)} K`], ["≈ Homes served today", big(homesFromKgs(d))]], open: d / 108.3 * 0.9 }; },
  },
];

// ---------- equations at work, per stop (live numbers plugged in) ----------
const I = v => `<i>${v}</i>`;
const TH = {
  supply: c => { const p = c.sim.thetaSupply, P = pitzer(p), f = c.sim.supplyFlow;
    return [
      eq(["CBE 311"], String.raw`M = \sum_i y_i M_i`, `Mixture molar mass for ${GAS.map(g => `${f0(g[1] * 100)} % ${g[0]}`).join(", ")}: M = ${f2(Mmix)} kg/kmol (paper: 18).`),
      eq(["CBE 311"], String.raw`T_{\mathrm{pc}} = \sum_i y_i T_{\mathrm{c},i}, \quad p_{\mathrm{pc}} = \sum_i y_i p_{\mathrm{c},i}`, `Kay's rule pseudo-critical point${ref("ppo")}: $T_{\\mathrm{pc}}$ = ${f1(Tpc)} K, $p_{\\mathrm{pc}}$ = ${f1(Ppc)} bar, $\\omega$ = ${f3(Wmix)}.`),
      eq(["CBE 310"], String.raw`z = 1 + \left(B^0 + \omega B^1\right)\dfrac{p_{\mathrm{r}}}{T_{\mathrm{r}}}, \quad B^0 = 0.083 - \dfrac{0.422}{T_{\mathrm{r}}^{1.6}}`, `Pitzer virial correlation${ref("svna")} at $\\theta_1$ = ${f1(p)} bar, 20 °C: $T_{\\mathrm{r}}$ = ${f2(P.Tr)}, $p_{\\mathrm{r}}$ = ${f2(P.pr)} → $z$ = ${f3(P.z)}. The model assumes $z$ = 0.8.`),
      eq(["CBE 310"], String.raw`\rho = \dfrac{p M}{z R T}`, `Real-gas density here: ${f1(P.rho)} kg/m³. An ultrasonic meter measures velocity, so the flow computer needs $\\rho$ from an equation of state (AGA 8 / GERG-2008) to report mass.`),
      eq(["Paper"], String.raw`Q_{\mathrm{std}} = \dfrac{\dot m}{\rho_{\mathrm{n}}}, \quad \rho_{\mathrm{n}} = 0.72\ \mathrm{kg/Sm^3}`, `${f1(f)} kg/s = ${f2(mmscmd(f))} million standard m³ per day.`),
    ]; },
  pipe: c => { const s = c.sim.state[c.sim.links[6].id], fl = s.f[0], L = c.sim.links[6].dx * (s.p.length - 1), lam = 0.00842, D = 0.914;
    const pin = s.p[0] * BAR, pout = Math.sqrt(Math.max(0, pin * pin - lam * C2 * fl * fl * L / (D * A_LINE ** 2))) / BAR, Re = 4 * fl / (Math.PI * D * 1.1e-5);
    return [
      eq(["Paper", "CBE 320"], String.raw`\dfrac{\partial f}{\partial \tau} = -A\,\dfrac{\partial p}{\partial x} - \dfrac{\lambda c^2}{2DA}\,\dfrac{f\,|f|}{p}`, "Momentum balance, eq. (2.6b): pressure force against wall friction. The inertia term is kept; the kinetic-energy flux is dropped because the gas moves at about 1 % of the speed of sound."),
      eq(["CBE 326"], String.raw`p_{\mathrm{in}}^2 - p_{\mathrm{out}}^2 = \dfrac{\lambda c^2 f^2 L}{D A^2}`, `Steady, isothermal form (integrate $p\\,dp$). For link 7 now: $p_{\\mathrm{in}}$ = ${f1(s.p[0])} bar, $f$ = ${f1(fl)} kg/s, $L$ = ${f0(L / 1000)} km → $p_{\\mathrm{out}}$ = ${f1(pout)} bar; the dynamic model gives ${f1(s.p[s.p.length - 1])} bar.`),
      eq(["CBE 326"], String.raw`\lambda = \left[2\log_{10}\!\left(\dfrac{3.7\,D}{\varepsilon}\right)\right]^{-2}, \quad \mathrm{Re} = \dfrac{4 f}{\pi D \mu}`, `Fully rough turbulent friction (von Kármán–Nikuradse): $\\lambda$ = 0.0084, $\\mathrm{Re}$ = ${(Re / 1e6).toFixed(1)}×10⁶, deep in the rough-pipe region of the Moody chart.`, `${ref("colebrook", "bsl")}`),
      eq(["CBE 440"], String.raw`\sigma_{\mathrm{h}} = \dfrac{p D}{2 t_{\mathrm{w}}} \le F \cdot \mathrm{SMYS}`, `Barlow's formula for the steel wall${ref("asme", "api5l")}: at ${f1(s.p[0])} bar the hoop stress is ${f0(s.p[0] * 1e5 * 0.914 / (2 * 0.0111) / 1e6)} MPa, ${f0(100 * s.p[0] * 1e5 * 0.914 / (2 * 0.0111) / 483e6)} % of the X70 yield strength (limit 72 %). Coatings and cathodic protection keep the steel from corroding.`),
      eq(["Paper", "CBE 310"], String.raw`m = \int \rho A\, dx = \dfrac{A}{c^2}\int p\, dx`, `Line pack is the integral of density. With $p = c^2\\rho$, stored mass is proportional to the area under the pressure profile: ${f2(c.sim.linepack / 1e6)} kt in the whole line now.`),
    ]; },
  valve: c => { const p = c.sim.state[c.sim.links[c.linkIx].id].p[4], rc = (2 / (GAMMA + 1)) ** (GAMMA / (GAMMA - 1)), P = pitzer(p);
    return [
      eq(["CBE 310"], String.raw`m = \dfrac{p V M}{z R T}`, `Gas trapped in a 50 km section at ${f1(p)} bar: ${f0(P.rho * A_LINE * 50000 / 1000)} t (real-gas z = ${f3(P.z)}). That is what a blowdown has to vent.`),
      eq(["CBE 310", "CBE 326"], String.raw`\dfrac{p^*}{p_0} = \left(\dfrac{2}{\gamma + 1}\right)^{\gamma/(\gamma - 1)}`, `Blowdown flow through the vent is choked (sonic) while $p_{\\mathrm{atm}}/p$ &lt; ${f3(rc)}; at ${f1(p)} bar the vent stays choked until the line falls to about ${f1(1.013 / rc)} bar.`),
      eq(["CBE 310"], String.raw`\dfrac{T_2}{T_1} = \left(\dfrac{p_2}{p_1}\right)^{(\gamma - 1)/\gamma}`, "As a closed section is vented, the gas left inside expands nearly adiabatically and cools sharply. Blowdowns are slowed down to keep the steel above its minimum design temperature."),
    ]; },
  scrubber: c => { const ps = c.cs.suction, P = pitzer(ps), rho = rhoAt(ps), vmax = 0.1 * Math.sqrt((700 - rho) / rho);
    return [
      eq(["CBE 311"], String.raw`\sum_i \dfrac{z_i (K_i - 1)}{1 + V (K_i - 1)} = 0, \quad K_i = \dfrac{y_i}{x_i}`, "Rachford–Rice flash. If the gas cools below its hydrocarbon or water dew point, a liquid fraction 1 − V condenses; the scrubber is where that liquid is removed before it reaches the impellers."),
      eq(["CBE 311"], String.raw`y_i\, \varphi_i\, p = x_i\, \gamma_i\, p_i^{\mathrm{sat}}`, `Phase equilibrium at ${f1(ps)} bar is far from ideal: vapour fugacity coefficients $\\varphi_i \\neq 1$ ($z$ = ${f3(P.z)}), so K-values come from an EOS (Peng–Robinson), not Raoult's law.`),
      eq(["CBE 326", "CBE 426"], String.raw`v_{\max} = K\sqrt{\dfrac{\rho_{\mathrm{L}} - \rho_{\mathrm{G}}}{\rho_{\mathrm{G}}}}`, `Souders–Brown: drops settle if the gas rises slower than $v_{\\max}$. With $K$ = 0.1 m/s, $\\rho_{\\mathrm{G}}$ = ${f1(rho)} kg/m³: $v_{\\max}$ = ${f2(vmax)} m/s.`, `${ref("souders")}`),
    ]; },
  turbine: c => { const P = c.cs.power, fuel = P / (0.28 * LHV_MIX * 1000), etaB = 1 - 10 ** (-(1.4 - 1) / 1.4);
    return [
      eq(["CBE 310"], String.raw`\mathrm{CH_4 + 2\,O_2 \rightarrow CO_2 + 2\,H_2O(g)}, \quad \Delta H^\circ_{\mathrm{c}} = -802\ \mathrm{kJ/mol}`, `Heat of combustion from heats of formation${ref("nist")}. For the mixture, $\\mathrm{LHV} = \\sum_i y_i(-\\Delta H_{\\mathrm{c},i})/M$ = ${f1(LHV_MIX)} MJ/kg.`),
      eq(["CBE 310"], String.raw`\eta_{\mathrm{Brayton}} = 1 - r_{\mathrm{p}}^{-(\gamma - 1)/\gamma}`, `Ideal air-standard Brayton cycle at pressure ratio 10: η = ${f0(100 * etaB)} %. Real machines reach ≈ 28 % because of compressor and turbine irreversibilities (entropy generation).`),
      eq(["CBE 310"], String.raw`\dot m_{\mathrm{fuel}} = \dfrac{\dot W}{\eta\, \mathrm{LHV}}`, `First law on the whole turbine: ${f0(P)} kW of shaft power needs ${f3(fuel)} kg/s of fuel gas (${f2(fuel * 86.4)} t/d).`),
      eq(["CBE 311"], String.raw`\dot m_{\mathrm{CO_2}} = \dot m_{\mathrm{fuel}}\,\dfrac{\left(\sum_i y_i n_{\mathrm{C},i}\right) M_{\mathrm{CO_2}}}{M}`, `Element balance on carbon: ${f2(CO2_PER_KG)} kg CO₂ per kg of this fuel → ${f1(fuel * CO2_PER_KG * 86.4)} t/d.`),
    ]; },
  compressor: c => { const s = c.cs, r = s.discharge / s.suction, T2 = T0 * r ** BETA, Ws = s.flow * CP * T0 * (r ** BETA - 1);
    return [
      eq(["CBE 310"], String.raw`\dot W = \dot m\,(h_2 - h_1)`, "First law for a steady, adiabatic open system with negligible kinetic and potential energy changes: all the shaft work raises the gas enthalpy."),
      eq(["CBE 310"], String.raw`\dfrac{T_2}{T_1} = \left(\dfrac{p_2}{p_1}\right)^{(\gamma - 1)/\gamma}, \quad \gamma = \dfrac{c_p}{c_v} = ${f3(GAMMA)}`, `Reversible adiabatic (isentropic) ideal gas, $\\Delta s = 0$: ratio ${f3(r)} → $T_2$ = ${f1(T2)} K (${f1(T2 - T0)} K rise).`),
      eq(["Paper", "CBE 310"], String.raw`P = c_p T_1\, \dot m\left[\left(\dfrac{p_2}{p_1}\right)^{\beta} - 1\right], \quad \beta = \dfrac{\gamma - 1}{\gamma}`, `Combine the two lines above and you get the paper's eq. (3.11i) with $c_4 = c_p T$ = ${f0(CP * T0)} kJ/kg, $\\beta$ = ${f3(BETA)}: ${f0(Ws)} kW (model: ${f0(s.power)} kW). It's the isentropic power; a real machine needs $P/\\eta_{\\mathrm{s}}$, about ${f0(Ws / 0.8)} kW at $\\eta_{\\mathrm{s}}$ = 0.8.`),
      eq(["CBE 310"], String.raw`h - h^{\mathrm{ig}} = -R T^2 \int_0^{p} \left(\dfrac{\partial z}{\partial T}\right)_{p} \dfrac{dp}{p}`, `Residual (departure) enthalpy: at ${f1(s.suction)} bar the gas is non-ideal (z = ${f3(pitzer(s.suction).z)}), so accurate compressor work uses real-gas enthalpies from an EOS.`),
    ]; },
  inside: c => { const l = c.sim.links[c.stIx + 1], s = c.sim.state[l.id], v = s.vel[0], P = pitzer(s.p[0]), cT = Math.sqrt(0.8 * 8314 * T0 / 18);
    return [
      eq(["Paper", "CBE 320"], String.raw`\dfrac{\partial \rho}{\partial t} + \dfrac{\partial (\rho v)}{\partial x} = 0 \;\Rightarrow\; \dfrac{\partial p}{\partial \tau} = -\dfrac{c^2}{A}\,\dfrac{\partial f}{\partial x}`, "Continuity with $f = \\rho v A$ and $p = c^2\\rho$ gives the paper's eq. (2.6a). Where more gas flows in than out, pressure (and line pack) rises."),
      eq(["Paper", "CBE 310"], String.raw`p = c^2 \rho, \quad c^2 = \dfrac{\gamma z R T}{M}`, `The paper closes the balances with the adiabatic speed of sound, c = 370 m/s. The isothermal value $\\sqrt{zRT/M}$ = ${f0(cT)} m/s would match the equation of state $\\rho = pM/(zRT)$ exactly, giving ${f0(100 * (GAMMA - 1))} % more line pack. A good class question.`),
      eq(["CBE 320"], String.raw`\mathrm{Ma} = \dfrac{v}{c}`, `Ma = ${(v / 370.2).toFixed(4)} here. Low Mach number is why the kinetic-energy terms are dropped and why isothermal flow is a good model.`),
      eq(["CBE 310"], String.raw`\rho = \dfrac{p M}{z R T}`, `At ${f1(s.p[0])} bar with Pitzer $z$ = ${f3(P.z)}: $\\rho$ = ${f1(P.rho)} kg/m³ (model: ${f1(rhoAt(s.p[0]))} kg/m³).`),
    ]; },
  cooler: c => { const s = c.cs, dT = s.flow > 1 ? s.power / (s.flow * CP) : 0, mAir = s.power / (1.006 * 12);
    return [
      eq(["CBE 310"], String.raw`\dot Q = \dot m_{\mathrm{gas}}\, c_p (T_2 - T_1) = \dot m_{\mathrm{air}}\, c_{p,\mathrm{air}}\, \Delta T_{\mathrm{air}}`, `Energy balance on both streams: ${f0(s.power)} kW removed, gas cooled by ${f1(dT)} K; with a 12 K air rise the fans move ${f1(mAir)} kg/s of air.`),
      eq(["CBE 326"], String.raw`\dot Q = U A F\, \Delta T_{\mathrm{lm}}`, "Design equation for the exchanger: finned tubes raise the outside area A, because air-side heat transfer controls U."),
      eq(["Paper"], String.raw`T(x, \tau) = T_{\mathrm{gas}} = 293.15\ \mathrm{K}`, "Because the coolers return the gas to ambient temperature and the buried line exchanges heat with the soil, the paper can drop the energy balance and model the line as isothermal."),
    ]; },
  pig: c => { const l = c.sim.links[c.stIx + 1], s = c.sim.state[l.id], v = s.vel[0];
    return [
      eq(["CBE 320"], String.raw`v = \dfrac{f}{\rho A}`, `The pig moves with the gas: ${f2(v)} m/s at the station outlet, rising to ${f2(s.vel[s.vel.length - 1])} m/s at the end of the link, because the same mass flow carries less dense gas as pressure falls.`),
      eq(["CBE 326"], String.raw`\Delta p_{\mathrm{pig}}\, A = F_{\mathrm{friction}}`, "A pig needs only about 0.2–1 bar of differential pressure to overcome cup friction against the wall."),
    ]; },
  citygate: c => { const pd = c.sim.demandPressure, P = pitzer(pd), cut = Math.max(0, pd - 25), Pm = pitzer((pd + 25) / 2);
    return [
      eq(["CBE 310"], String.raw`h_1 = h_2`, "Throttling through the regulator: no work, no heat, negligible kinetic energy change, so the first law says enthalpy is unchanged (isenthalpic)."),
      eq(["CBE 310"], String.raw`\mu_{\mathrm{JT}} = \left(\dfrac{\partial T}{\partial p}\right)_h = \dfrac{R T^2}{p\, C_p}\left(\dfrac{\partial z}{\partial T}\right)_p`, `From the Pitzer correlation: $\\mu_{\\mathrm{JT}}$ = ${f2(Pm.muJT)} K/bar at the mean pressure. For an ideal gas $z = 1$ and $\\mu_{\\mathrm{JT}} = 0$; the cooling is purely a real-gas (departure-function) effect.`),
      eq(["CBE 310"], String.raw`\Delta T \approx \mu_{\mathrm{JT}}\, \Delta p`, `Cutting ${f1(pd)} → 25 bar cools the gas by about ${f1(Pm.muJT * cut)} K (from ${f1(T0 - 273.15)} °C to ${f1(T0 - 273.15 - Pm.muJT * cut)} °C).`),
      eq(["CBE 311"], String.raw`\text{hydrate / dew-point check: } T_{\mathrm{out}} > T_{\mathrm{dew}}(p_{\mathrm{out}}, y)`, "If the cooled gas crosses its water or hydrocarbon dew point, liquids or gas hydrates form (phase equilibrium of the mixture). Large cuts need a line heater upstream."),
    ]; },
};
STOPS.forEach(s => s.thermo = TH[s.id]);
const SEEN = {"supply": ["CBE 311", "CBE 250"], "pipe": ["CBE 440", "CBE 326"], "valve": ["CBE 326", "CBE 310"], "scrubber": ["CBE 426", "CBE 311"], "turbine": ["CBE 310", "CBE 512"], "compressor": ["CBE 310", "CBE 470"], "inside": ["CBE 320"], "cooler": ["CBE 326"], "pig": ["CBE 326"], "citygate": ["CBE 310", "CBE 311"]};
STOPS.forEach(s => s.seen = SEEN[s.id] || []);
const PLAIN = {"supply": "This is where the gas enters the pipeline. A processing plant cleans it, and meters measure exactly how much leaves, a bit like the water meter at a house, except these use sound waves sent across the pipe.", "pipe": "The pipe is steel about as wide as a doorway, with walls about 1 cm thick, buried roughly a metre underground and wrapped in a plastic coating so it doesn't rust. It both carries the gas and stores it.", "valve": "Every 50 km or so a big valve can shut off a section of pipe for repairs or if there's a leak. It runs on the pressure of the gas itself, so it still works if the power goes out.", "scrubber": "Before the gas reaches the compressor, these tall tanks catch liquid droplets and dust that could damage the fast-spinning machine.", "turbine": "Each compressor is driven by a gas turbine, basically a jet engine bolted to the ground, which burns a small amount of the pipeline's own gas.", "compressor": "The compressor is a big spinning fan inside a sealed case. It pushes the gas back up to a higher pressure so it keeps flowing to the next station, 100 km away.", "inside": "Here the pipe is cut open so you can see the gas. Each dot is the same amount of gas: crowded together where the pressure is high, spread out and moving faster where it is lower.", "cooler": "Squeezing gas warms it, the way a bike pump gets warm. Giant fans blow outdoor air over finned tubes to cool the gas before it continues.", "pig": "A \"pig\" is a plug that the gas pushes through the pipe to clean it, or to check the steel wall with sensors. It travels at about jogging speed.", "citygate": "At the end of the line the gas is measured and its pressure is lowered so it can go into the smaller pipes under city streets. Gas cools when its pressure drops, so sometimes it has to be warmed first."};
STOPS.forEach(s => s.plain = PLAIN[s.id]);

// course map for the side panel: topic → stop
export const COURSE_MAP = [
  ["CBE 310", "Real-gas equation of state, z and the Pitzer correlation", "supply"],
  ["CBE 310", "First law for open systems; isentropic compression work (= paper eq. 3.11i)", "compressor"],
  ["CBE 310", "Residual (departure) enthalpy of a real gas", "compressor"],
  ["CBE 310", "Combustion energy balance and the Brayton cycle", "turbine"],
  ["CBE 310", "Throttling, Joule–Thomson coefficient", "citygate"],
  ["CBE 310", "Choked flow and adiabatic expansion in blowdown", "valve"],
  ["CBE 311", "Mixture molar mass and Kay's-rule pseudo-critical properties", "supply"],
  ["CBE 311", "Vapour–liquid equilibrium, fugacity, Rachford–Rice flash", "scrubber"],
  ["CBE 311", "Carbon element balance, CO₂ emissions", "turbine"],
  ["CBE 311", "Dew point and hydrate formation after throttling", "citygate"],
  ["CBE 320", "Continuity and momentum balances (paper eqs. 2.6a,b)", "inside"],
  ["CBE 326", "Friction factor, Reynolds number, steady pressure drop", "pipe"],
  ["CBE 320", "Turbulent velocity profile and the viscous sublayer", "zoom:3"],
  ["CBE 250", "Mass balance on the whole line; line pack as storage", "dyn"],
  ["CBE 320", "Pressure spreads like heat in a rod: the diffusion equation", "dyn"],
  ["CBE 470", "Time constants, the RC analogy, set-point control of stations", "dyn"],
  ["CBE 310", "Kinetic theory: molecular speed, spacing, mean free path", "zoom:4"],
  ["CBE 430", "Steam-methane reforming and Haber–Bosch ammonia", "nh3"],
  ["CBE 450", "Compression cost and the paper's optimal-control problem", "zoom:0"],
  ["CBE 440", "Line-pipe steel: hoop stress, coatings, corrosion", "pipe"],
  ["CBE 512", "Energy delivered, power plants and CO₂ in everyday terms", "every"],
  ["CBE 255", "How the model solves the paper's equations each step", "model"],
  ["CBE 355", "Demand variability by customer type and weather", "who"],
  ["CBE 326", "Heat-exchanger design, log-mean temperature difference", "cooler"],
  ["CBE 426", "Gas–liquid separation, settling velocity (Souders–Brown)", "scrubber"],
];
export { tag };

// ===================================================================================
// detail viewer: its own renderer, cutaway clipping, numbered callouts
// ===================================================================================
export class DetailViewer {
  constructor(host) {
    this.host = host;
    this.canvas = host.querySelector("canvas");
    this.callouts = host.querySelector(".callouts");
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true; this.renderer.localClippingEnabled = true;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color("#ffffff");
    this.scene.environment = new THREE.PMREMGenerator(this.renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    const sun = new THREE.DirectionalLight("#ffffff", 1.6); sun.position.set(6, 10, 8); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    this.sun = sun; this.scene.add(sun, new THREE.HemisphereLight("#dfe8f0", "#3a3530", 0.6));
    this.floor = new THREE.Mesh(new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: "#eeeeee", roughness: 0.95 }));
    this.floor.receiveShadow = true; this.scene.add(this.floor);
    this.grid = new THREE.GridHelper(2, 20, "#cccccc", "#dddddd"); this.scene.add(this.grid);
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.01, 500);
    this.controls = new OrbitControls(this.camera, this.canvas); this.controls.enableDamping = true; this.controls.autoRotateSpeed = 0.6;
    this.clip = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
    this.cut = true; this.open = false; this.model = null;
    new ResizeObserver(() => this.resize()).observe(host);
  }
  resize() { const r = this.host.getBoundingClientRect(); if (!r.width) return; this.renderer.setSize(r.width, r.height, false); this.camera.aspect = r.width / r.height; this.camera.updateProjectionMatrix(); }
  show(stop) {
    if (this.model) { this.scene.remove(this.model.group); this.model.group.traverse(o => { o.geometry?.dispose?.(); }); }
    const m = stop.model(); this.model = m; this.scene.add(m.group);
    const shells = []; m.group.traverse(o => { if (o.userData.shell) { o.material = o.material.clone(); o.material.side = THREE.DoubleSide; shells.push(o); } }); this.shells = shells;
    const bb = new THREE.Box3().setFromObject(m.group), c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3());
    if (m.center) c.set(...m.center);
    const R = Math.max(sz.x, sz.z) * 0.8 + 1;
    this.floor.scale.setScalar(R); this.floor.position.y = bb.min.y - 0.002; this.grid.scale.setScalar(R); this.grid.position.y = bb.min.y;
    this.sun.position.set(c.x + R, c.y + R * 1.6, c.z + R * 1.2); this.sun.target.position.copy(c); this.scene.add(this.sun.target);
    Object.assign(this.sun.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 0.1, far: R * 6 }); this.sun.shadow.camera.updateProjectionMatrix();
    this.cz = bb.getCenter(new THREE.Vector3()).z * 0 + (m.cutZ ?? 0);
    this.resize();
    const d = (m.fit ?? sz.length()) * Math.min(1.8, Math.max(1, 1.45 / Math.max(0.3, this.camera.aspect))) * 1.1;
    this.camera.position.set(c.x + d * 0.55, c.y + d * 0.35, c.z + d * 0.85); this.controls.target.copy(c);
    this.camera.near = d / 200; this.camera.far = d * 40; this.camera.updateProjectionMatrix();
    this.setCut(this.cut);
    // exploded view: top-level pieces move away from the model centre; each callout follows its nearest piece
    const kids = m.group.children.filter(o => !o.isPoints && !o.isLine);
    const ctr = c.clone(); this.explode = 0; this.explodeT = this.explodeT ?? 0;
    this.kids = kids.map(o => { const b = new THREE.Box3().setFromObject(o), oc = b.getCenter(new THREE.Vector3()), d = oc.clone().sub(ctr);
      // classic exploded view: pieces slide apart along the machine axis, casings lift off sideways
      const ax = m.explodeAxis ?? "x", dir = new THREE.Vector3();
      if (o.userData.shell) { if (ax === "x") dir.y = Math.max(sz.y, 1.5) * 0.75; else dir.x = Math.max(sz.x, 1.5) * 0.9; }
      else dir[ax] = d[ax] * 0.8;
      return { o, home: o.position.clone(), dir, oc }; });
    this.partKid = m.parts.map(([, p]) => { let best = null, bd = 1e9; for (const k of this.kids) { if (k.o.userData.shell) continue; const dd = k.oc.distanceTo(p); if (dd < bd) { bd = dd; best = k; } } return best; });
    this.callouts.innerHTML = m.parts.map(([n], i) => `<button class="co" data-i="${i}"><b>${i + 1}</b><span>${n}</span></button>`).join("");
    this.coEls = [...this.callouts.children];
    this.coEls.forEach(el => el.onclick = () => this.focus(+el.dataset.i));
    this.focusT = null;
    this.open = true; this.resize();
    return m;
  }
  focus(i) {          // fly to a part and highlight its callout and list entry
    const p = this.partPos(i), d = Math.max(1.2, (this.model.fit ?? 6) * 0.35), dir = this.camera.position.clone().sub(this.controls.target).normalize();
    this.focusT = { t: 0, p0: this.camera.position.clone(), t0: this.controls.target.clone(), t1: p.clone(), p1: p.clone().addScaledVector(dir, d) };
    this.coEls.forEach((el, j) => el.classList.toggle("on", j === i));
    this.onFocus?.(i);
  }
  partPos(i) { const k = this.partKid[i], p = this.model.parts[i][1].clone(); if (k) p.add(k.o.position).sub(k.home); return p; }
  setExplode(on) { this.explodeT = on ? 1 : 0; }
  setCut(on) { this.cut = on; for (const o of this.shells || []) { o.material.clippingPlanes = on ? [this.clip] : []; o.material.needsUpdate = true; } }
  render(dt, live) {
    if (!this.open || !this.model) return;
    this.model.update?.(dt, live || {});
    this.explode += (this.explodeT - this.explode) * Math.min(1, dt * 3);
    for (const k of this.kids) k.o.position.copy(k.home).addScaledVector(k.dir, this.explode);
    if (this.focusT) { const f = this.focusT; f.t = Math.min(1, f.t + dt / 1.1); const u = f.t * f.t * (3 - 2 * f.t);
      this.camera.position.lerpVectors(f.p0, f.p1, u); this.controls.target.lerpVectors(f.t0, f.t1, u); if (f.t >= 1) this.focusT = null; }
    this.controls.update();
    // keep the cut facing the viewer: clip the half of each shell nearest the camera
    // cut along the machine's axis (vertical x-y plane through its centre), removing the half facing the camera
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

// ===================================================================================
// zoom ladder: network -> site -> equipment -> inside the pipe -> molecules, for a chosen focus
// ctx: { sim, focus: { kind: "station" | customer kind, name, node, size? }, q (kg/s at the customer),
//        comp, cs (station), totalOut, inflow }
// ===================================================================================
const kB = 1.380649e-23, NA = 6.02214e23, MU = 1.1e-5;
export const ZOOM_LEVELS = [
  { key: "network", label: "Network", scale: "1600 km" },
  { key: "site", label: "Site", scale: "1 km" },
  { key: "equipment", label: "Equipment", scale: "10 m" },
  { key: "inside", label: "Inside the pipe", scale: "1 m" },
  { key: "molecules", label: "Molecules", scale: "1 nm" },
];
function localState(c) {     // gas state just downstream of the focus node
  const n = c.focus.node, l = c.sim.links[Math.min(11, n - 1)], s = c.sim.state[l.id], k = n - 1 <= 11 ? 0 : s.p.length - 1;
  return { p: s.p[k], v: Math.abs(s.vel[k]), f: Math.abs(s.f[k]), rho: rhoAt(s.p[k]) };
}
export function zoomStop(level, c) {
  const F = c.focus, I = v => `<i>${v}</i>`;
  if (level === 0) return {
    plain: "From far away the pipeline is one long line: gas goes in at one end, and towns, power plants and factories take it out along the way. The pipe also stores gas, which covers the times when customers suddenly need more.",
    title: "The whole line", where: "1600 km, supply to Metro City · 12 links, 10 stations, 7 customers",
    role: "At this scale the pipeline is a network of balances. Gas enters at one end and is taken by homes, power plants and industry along the way. The pipe stores gas (line pack) to cover the gap whenever customers take more or less than enters.",
    specs: [["Network", "13 nodes, 12 links (Fig. 1)", "P"], ["Customers", "towns, city, CCGT, peaker, ammonia, dairy"], ["Control", "10 stations; discharge set-points or fixed boosts", "P"]],
    live: () => ({ rows: [["Entering at supply", `${f2(mmscmd(c.inflow))} MMSCM/d`], ["Delivered to customers", `${f2(mmscmd(c.totalOut))} MMSCM/d`], ["Line pack", `${f2(c.sim.linepack / 1e6)} kt`], ["Compression power", `${f0(c.sim.comps.reduce((a, k) => a + c.sim.compState[k.id].power, 0))} kW`]] }),
    thermo: () => { const P = c.sim.comps.reduce((a, k) => a + c.sim.compState[k.id].power, 0);
      return [
        eq(["CBE 250"], String.raw`f_{\mathrm{in}} - \sum_j d_j = \dfrac{d m_{\mathrm{pack}}}{d t}`, `Overall mass balance: ${f1(c.inflow)} − ${f1(c.totalOut)} kg/s = ${f1(c.inflow - c.totalOut)} kg/s into storage.`),
        eq(["Paper", "CBE 470"], String.raw`\min \sum_t \sum_i P_{i,t}\, \Delta\tau \quad \text{s.t. (3.11)},\ p \ge p_{\min},\ P_i \le P^{\mathrm{U}}`, "The paper chooses the compressor boosts to meet uncertain demands at least compression cost, using the line pack as a buffer: stochastic optimal control."),
        eq(["CBE 450"], String.raw`\text{cost} = \sum P \times 24\ \mathrm{h} \times \text{price}`, `At $0.08/kWh (Typical), compression now costs about $${f0(P * 24 * 0.08)} per day.`),
      ]; },
    cam: "overview",
  };
  if (level === 1) {
    if (F.kind === "station") return {
      plain: "A compressor station: gas comes in, is cleaned, pushed back up to a higher pressure, cooled and sent on to the next station. It is where the pipeline spends most of its energy.",
      title: `${F.name} compressor station`, where: `Node ${F.node}, km ${F.km}`,
      role: "Gas arrives at suction pressure, is cleaned in the scrubbers, boosted by turbine-driven centrifugal compressors and cooled before re-entering the line. The station is where most of the line's energy is spent.",
      specs: [["Units", "3 × 1.5 MW, 2 duty + 1 standby"], ["Limit", "3000 kW (4.18)", "P"]],
      live: () => ({ rows: [["Suction → discharge", `${f1(c.cs.suction)} → ${f1(c.cs.discharge)} bar`], ["Flow", `${f2(mmscmd(c.cs.flow))} MMSCM/d`], ["Power", `${f0(c.cs.power)} kW`]] }),
      thermo: () => [eq(["CBE 250", "CBE 450"], String.raw`\dot m_{\mathrm{in}} = \dot m_{\mathrm{out}} + \dot m_{\mathrm{fuel}}`, `Flowsheet balance around the station: fuel for the turbines is taken from the line, ${f3(c.cs.power / (0.28 * LHV_MIX * 1000))} kg/s now.`),
        eq(["CBE 310"], String.raw`\dot W = \dot m\, c_p T_1\left[\left(\dfrac{p_2}{p_1}\right)^{\beta} - 1\right]`, `Isentropic compression power, eq. (3.11i): ${f0(c.cs.power)} kW.`)],
      cam: "station",
    };
    const q = c.q, mm = mmscmd(q), MJs = q * LHV_MIX, kind = F.kind;
    const T = {
      town: ["Homes and businesses", "A city gate cuts the pressure to distribution levels and adds odorant. Thousands of homes heat with the gas; their demand peaks in the morning and evening and rises on cold days.",
        [eq(["CBE 450"], String.raw`q = q_{\mathrm{base}} + b \cdot \mathrm{HDD}`, "Gas use grows linearly with heating degree-days (18 °C minus the outdoor temperature). That's why the Weather buttons scale the residential peaks."), eq(["CBE 310"], String.raw`\Delta T = \mu_{\mathrm{JT}}\, \Delta p`, "Throttling to distribution pressure cools the gas; the city gate heater keeps it above freezing.")]],
      metro: ["City gate and city", "The end of the line. The gate meters and reduces the pressure for a city of about 600 000 homes plus businesses. The paper's minimum delivery pressure of 39 bar applies here.",
        [eq(["Paper"], String.raw`p_{13} \ge 39\ \mathrm{bar}`, `Delivery bound (4.18): now ${f1(c.sim.nodeP.n13)} bar.`), eq(["CBE 450"], String.raw`q = q_{\mathrm{base}} + b \cdot \mathrm{HDD}`, "Heating load follows the weather.")]],
      ccgt: ["Combined-cycle power plant", "A gas turbine burns the fuel; its hot exhaust raises steam in a heat-recovery boiler that drives a steam turbine. It follows electricity demand: low at night, ramping in the morning and evening.",
        [eq(["CBE 310"], String.raw`\eta_{\mathrm{CC}} = \eta_{\mathrm{GT}} + (1 - \eta_{\mathrm{GT}})\,\eta_{\mathrm{ST}}`, `0.38 + 0.62 × 0.33 ≈ 0.58 (Typical): two heat engines in series.`), eq(["CBE 310"], String.raw`P_{\mathrm{e}} = \eta\, \dot m\, \mathrm{LHV}`, `${f1(q)} kg/s × ${f1(LHV_MIX)} MJ/kg × 0.55 = ${f0(MJs * 0.55)} MW of electricity now.`)]],
      peaker: ["Peaking power plant", "Simple-cycle gas turbines that start in about 10 minutes and run only at the morning and evening peaks. They are the sharpest demand step the pipeline sees.",
        [eq(["CBE 310"], String.raw`\eta_{\mathrm{Brayton}} = 1 - r_{\mathrm{p}}^{-(\gamma - 1)/\gamma}`, "Simple cycle, real efficiency about 35 %."), eq(["CBE 470"], String.raw`d(t)\ \text{steps} \;\Rightarrow\; p(x,t),\ f(x,t)\ \text{respond}`, `A start takes ${f2(mm)} MMSCM/d almost instantly; watch the flow-in-space-and-time map for the disturbance moving upstream.`)]],
      ammonia: ["Ammonia plant", "Natural gas is both feedstock and fuel: steam reforming makes hydrogen, which is combined with nitrogen from air to make ammonia for fertilizer. The plant runs flat out around the clock.",
        [eq(["CBE 430", "CBE 311"], String.raw`\mathrm{CH_4 + H_2O \rightleftharpoons CO + 3\,H_2}, \quad \Delta H^\circ = +206\ \mathrm{kJ/mol}`, "Endothermic steam reforming at ~850 °C over nickel catalyst; equilibrium shifts right at high temperature (van 't Hoff)."),
         eq(["CBE 430"], String.raw`\mathrm{N_2 + 3\,H_2 \rightleftharpoons 2\,NH_3}, \quad \Delta H^\circ = -92\ \mathrm{kJ/mol}`, `Haber–Bosch on iron catalyst at 150–300 bar. At ~33 GJ of gas per tonne${ref("iea-nh3")}, ${f2(mm)} MMSCM/d makes about ${f0(mm * 1e6 * 33.7 / 33000)} t/d of ammonia.`)]],
      dairy: ["Dairy and ice cream plant", "Gas fires the boilers for pasteurization steam and cleaning; the refrigeration for freezing runs on electricity. A small but steady customer on shift hours.",
        [eq(["CBE 310"], String.raw`\dot Q = \dot m_{\mathrm{steam}}\,(h_{\mathrm{g}} - h_{\mathrm{f}})`, `Boiler duty from ${f2(mm)} MMSCM/d at 85 % efficiency: ${f1(MJs * 0.85)} MW of steam.`)]],
    }[kind];
    const PL = { town: "A town takes its gas through a \"city gate\" that lowers the pressure for the small pipes under the streets. Homes use the most gas in the morning and evening, and more on cold days.",
      metro: "The end of the line: a city of about 600,000 homes plus shops and offices. The gas has to arrive with enough pressure left to get into the city's pipes.",
      ccgt: "A power plant that burns gas to spin turbines and make electricity. It follows how much electricity people need: low at night, high in the evening.",
      peaker: "A power plant that switches on only at the busiest times of day. It can go from off to full power in about 10 minutes.",
      ammonia: "A plant that makes ammonia, the base of most fertilizer, from natural gas and air. It runs steadily day and night.",
      dairy: "A dairy and ice cream plant. It burns gas to make steam for pasteurizing milk and cleaning equipment." }[kind];
    return { plain: PL, title: F.name, where: `${T[0]} · node ${F.node}, km ${F.km}`, role: T[1], specs: [["Takes gas at", `node ${F.node} (paper node balance 3.11a)`, "P"], ["Size at full shape", `${f2(F.size)} MMSCM/d`]],
      live: () => ({ rows: [["Taking now", `${f2(mm)} MMSCM/d · ${f1(q)} kg/s`], ["Pressure at node", `${f1(c.sim.nodeP["n" + F.node])} bar`], ["Fuel energy", `${f0(MJs)} MW`]], load: q / Math.max(1e-6, F.size / 86400 * 1e6 * RHO_N) }),
      thermo: () => T[2], cam: "customer" };
  }
  if (level === 2) {
    const st = STOPS.find(s => s.id === (F.kind === "station" ? "compressor" : (F.kind === "ccgt" || F.kind === "peaker") ? "turbine" : F.kind === "ammonia" ? "__ref" : "citygate"));
    if (F.kind === "ammonia") return { plain: "Inside the fertilizer plant: tall metal tubes packed with catalyst pellets (a catalyst speeds up a reaction without being used up) are heated by flames. Inside, steam pulls hydrogen out of methane.", title: "Steam-methane reformer tube", where: `${F.name} · front end of the ammonia plant`, model: reformerModel,
      role: "Hundreds of alloy tubes packed with nickel catalyst hang in a fired box. Gas and steam flow down the tubes and react; burners outside supply the heat the endothermic reaction needs.",
      specs: [["Tubes", "~10 m long, 100–130 mm ID, HP-Nb alloy"], ["Outlet", "~850 °C, 30–35 bar"], ["Steam/carbon", "≈ 3.0"]],
      live: () => ({ rows: [["Plant gas use", `${f2(mmscmd(c.q))} MMSCM/d`]], load: c.q > 0.01 ? 1 : 0 }),
      thermo: () => [eq(["CBE 430"], String.raw`r = k_0\, e^{-E_{\mathrm{a}}/RT} \cdot f(p_i)`, "Arrhenius kinetics ($E_{\\mathrm{a}}$ ≈ 240 kJ/mol) with a Langmuir–Hinshelwood driving force: hotter tubes react faster, until the tube metal limit."),
        eq(["CBE 311"], String.raw`\ln K = -\dfrac{\Delta G^\circ}{R T}, \quad \dfrac{d \ln K}{d T} = \dfrac{\Delta H^\circ}{R T^2}`, "Reaction equilibrium: a strongly endothermic reaction needs high temperature and low pressure to go far."),
        eq(["CBE 326"], String.raw`\text{Ergun: } \dfrac{\Delta p}{L} = \dfrac{150\,\mu (1-\varepsilon)^2 v}{\varepsilon^3 d^2} + \dfrac{1.75\,\rho (1-\varepsilon) v^2}{\varepsilon^3 d}`, "Pressure drop through the catalyst bed sets the tube count.")], cam: "customer" };
    if (F.kind === "ccgt" || F.kind === "peaker") {
      const cc = F.kind === "ccgt", eta = cc ? 0.55 : 0.35, nameT = cc ? "Heavy-duty gas turbine" : "Aeroderivative gas turbine";
      return { plain: "The gas turbine: air is squeezed, mixed with gas and burned, and the hot gas spins the turbine, which turns a generator to make electricity.", title: nameT, where: `${F.name}`, model: turbineModel,
        role: cc ? "The gas turbine makes about two-thirds of the plant's power; its 600 °C exhaust raises steam for the steam turbine. Fuel flow follows the electricity it is asked to make." : "A jet engine adapted for power: it starts and reaches full load in about 10 minutes, so it covers short peaks in electricity demand.",
        specs: cc ? [["Configuration", "1 gas turbine + 1 steam turbine (1×1)"], ["Gas turbine", "≈ 330 MW, pressure ratio ≈ 20"], ["Plant", `${F.MW} MW, ≈ 55 % efficient`]] : [["Units", "2 × 100 MW"], ["Start to full load", "≈ 10 min"], ["Efficiency", "≈ 35 % simple cycle"]],
        live: () => { const MW = c.q * LHV_MIX * eta, load = Math.min(1, c.q / Math.max(1e-6, F.size / 86400 * 1e6 * RHO_N));
          return { rows: [["Fuel", `${f2(mmscmd(c.q))} MMSCM/d · ${f1(c.q)} kg/s`], ["Electricity", `${f0(MW)} MW`], ["Load", `${f0(100 * load)} %`], ["CO₂", `${f0(c.q * CO2_PER_KG * 86.4)} t/d`]], load, running: c.q > 0.01 }; },
        thermo: () => { const rp = cc ? 20 : 25, eB = 1 - rp ** (-(1.4 - 1) / 1.4);
          return [eq(["CBE 310"], String.raw`\eta_{\mathrm{Brayton}} = 1 - r_{\mathrm{p}}^{-(\gamma - 1)/\gamma}`, `Ideal air-standard cycle at $r_{\\mathrm{p}}$ = ${rp}: ${f0(100 * eB)} %. The real ${cc ? "combined cycle reaches 55 % by recovering exhaust heat" : "machine reaches about 35 %"}.`),
            eq(["CBE 310"], String.raw`P_{\mathrm{e}} = \eta\, \dot m_{\mathrm{fuel}}\, \mathrm{LHV}`, `${f1(c.q)} kg/s × ${f1(LHV_MIX)} MJ/kg × ${eta} = ${f0(c.q * LHV_MIX * eta)} MW.`),
            eq(["CBE 250", "CBE 311"], String.raw`\dot m_{\mathrm{CO_2}} = \dot m_{\mathrm{fuel}}\,\dfrac{\left(\sum_i y_i n_{\mathrm{C},i}\right) M_{\mathrm{CO_2}}}{M}`, `${f0(c.q * CO2_PER_KG * 86.4)} t of CO₂ per day at this rate.`)]; },
        cam: "customer" };
    }
    const ctxLive = F.kind === "station" ? c : { ...c, sim: { ...c.sim, demandPressure: c.sim.nodeP["n" + F.node], demand: { n13: c.q } } };
    return { plain: F.kind === "station" || F.kind === "metro" ? st.plain : "A pressure regulator lowers the gas from pipeline pressure to what the customer's own pipes can take, and a meter measures how much they use. Gas cools as its pressure drops.", title: st.title, where: `${F.name}`, model: st.model, role: st.role, specs: st.specs,
      live: () => { const r = st.live(ctxLive); if (F.kind !== "station") r.load = Math.min(1, c.q / Math.max(1e-6, F.size / 86400 * 1e6 * RHO_N)); return r; },
      thermo: () => st.thermo(ctxLive), cam: F.kind === "station" ? "station" : "customer" };
  }
  if (level === 3) return {
    plain: "Up close inside the pipe the gas is swirling (turbulent). Across most of the pipe it moves at almost the same speed; it slows down only in a very thin layer right at the wall, about as thick as the bumps in the steel.",
    title: "Inside the pipe", where: `Just downstream of ${F.name}`, model: flowModel,
    role: "The flow is fully turbulent: eddies mix the core so the velocity is almost flat, and nearly all the velocity change happens in a very thin layer at the wall. That layer is about as thick as the wall roughness, which is why the friction factor depends only on roughness.",
    specs: [["Bore", "892 mm (914 mm in the paper's model)", "P"], ["Roughness $\\varepsilon$", "0.012 mm (assumed)", "P"], ["Viscosity $\\mu$", "1.1×10⁻⁵ Pa·s (Typical)"]],
    live: () => { const L = localState(c), Re = L.rho * L.v * 0.914 / MU, us = L.v * Math.sqrt(0.00842 / 8), dv = 5 * MU / L.rho / Math.max(1e-6, us);
      return { rows: [["Pressure", `${f1(L.p)} bar`], ["Mean velocity", `${f2(L.v)} m/s`], ["Reynolds number", `${(Re / 1e6).toFixed(1)}×10⁶`], ["Friction velocity u*", `${f3(us)} m/s`], ["Viscous sublayer", `${f1(dv * 1e6)} µm vs roughness 12 µm`]], vel: L.v }; },
    thermo: () => { const L = localState(c), Re = L.rho * L.v * 0.914 / MU, us = L.v * Math.sqrt(0.00842 / 8), dv = 5 * MU / L.rho / Math.max(1e-6, us), tw = L.rho * us * us;
      return [
        eq(["CBE 320"], String.raw`\mathrm{Re} = \dfrac{\rho v D}{\mu}`, `${f1(L.rho)} × ${f2(L.v)} × 0.914 / 1.1×10⁻⁵ = ${(Re / 1e6).toFixed(1)}×10⁶: turbulent (laminar below about 2300).`),
        eq(["CBE 320"], String.raw`u(r) = U_{\max}\left(1 - \dfrac{r}{R}\right)^{1/7}`, "Empirical power-law profile for turbulent pipe flow: flat core, steep near the wall (the red arrows)."),
        eq(["CBE 326"], String.raw`\tau_{\mathrm{w}} = \rho\, u_*^2, \quad u_* = v\sqrt{\lambda/8}, \quad \delta_{\mathrm{v}} \approx \dfrac{5\nu}{u_*}`, `Wall shear stress ${f2(tw)} Pa; sublayer $\\delta_{\\mathrm{v}}$ = ${f1(dv * 1e6)} µm. With $\\varepsilon/\\delta_{\\mathrm{v}}$ ≈ ${f1(12 / (dv * 1e6))}, the roughness pokes through: fully rough flow, so $\\lambda$ depends on $\\varepsilon/D$ only.`),
        eq(["Paper", "CBE 326"], String.raw`\dfrac{\Delta p}{L} = \dfrac{\lambda \rho v^2}{2 D} \;\rightarrow\; c_3\, \dfrac{f\,|f|}{p}`, "The friction term of eq. (2.6b) is the Darcy–Weisbach pressure drop written in mass flow and pressure."),
      ]; },
  };
  return {
    plain: "At the scale of molecules: methane molecules about a nanometre (a millionth of a millimetre) apart, zipping around at hundreds of metres per second and bumping into each other constantly. They are close enough to pull on each other a little, which is why real gas packs tighter than the ideal gas law predicts.",
    title: "Molecules", where: `Gas just downstream of ${F.name}, a 6 nm box`, model: moleculesModel,
    role: "At pipeline pressure the molecules are only about a nanometre apart, close to their own size, so they feel each other's attraction. That is why the gas is non-ideal (z < 1) and why it cools when throttled.",
    specs: [["Composition", "90 % CH₄, 5 % C₂H₆, 2 % C₃H₈, 2 % N₂, 1 % CO₂ (illustrative)"], ["Temperature", "293.15 K (App. A)", "P"]],
    live: () => { const L = localState(c), P = pitzer(L.p), n = L.p * 1e5 / (P.z * kB * T0), Nbox = n * 216e-27, sp = Math.cbrt(1 / n) * 1e9, vr = Math.sqrt(3 * Rg * T0 / 0.016), mfp = kB * T0 / (Math.SQRT2 * Math.PI * (0.38e-9) ** 2 * L.p * 1e5);
      return { rows: [["Pressure", `${f1(L.p)} bar`], ["Molecules in the box", f0(Nbox)], ["Mean spacing", `${f2(sp)} nm`], ["Mean free path", `${f2(mfp * 1e9)} nm`], ["CH₄ rms speed", `${f0(vr)} m/s`], ["Compressibility z", f3(P.z)]], nBox: Nbox }; },
    thermo: () => { const L = localState(c), P = pitzer(L.p), n = L.p * 1e5 / (P.z * kB * T0), vr = Math.sqrt(3 * Rg * T0 / 0.016), mfp = kB * T0 / (Math.SQRT2 * Math.PI * (0.38e-9) ** 2 * L.p * 1e5);
      return [
        eq(["CBE 310"], String.raw`p V = z N k_{\mathrm{B}} T \;\Rightarrow\; n = \dfrac{p}{z k_{\mathrm{B}} T}`, `${f3(n / 1e27)}×10²⁷ molecules per m³, about ${f0(n * 216e-27)} in this box.`),
        eq(["CBE 310"], String.raw`v_{\mathrm{rms}} = \sqrt{\dfrac{3 R T}{M}}`, `Methane at 20 °C: ${f0(vr)} m/s. Heavier ethane and propane move slower ($1/\\sqrt{M}$ scaling).`),
        eq(["CBE 310"], String.raw`\lambda_{\mathrm{mfp}} = \dfrac{k_{\mathrm{B}} T}{\sqrt{2}\,\pi d^2 p}`, `${f2(mfp * 1e9)} nm, about one molecular spacing: a dense gas, so intermolecular forces matter.`),
        eq(["CBE 311"], String.raw`z = 1 + \dfrac{B p}{R T}, \quad B = \sum_i \sum_j y_i y_j B_{ij}`, `Second virial coefficient of the mixture from pair interactions: z = ${f3(P.z)} here (Pitzer correlation). Attraction (B < 0) packs more gas into the pipe than an ideal gas would.`),
      ]; },
  };
}

