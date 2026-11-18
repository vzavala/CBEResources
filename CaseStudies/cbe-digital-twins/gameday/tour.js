// Guided tour for the football twin: stops (where to fly, what the thing is, its specification, live
// readings and the equations at work, each tagged with the UW–Madison CBE course that teaches it),
// a course map, and detailed procedural 3D models shown in a separate cutaway viewer.
// Models are at true size in metres unless a stop says it is magnified.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { BALL, BLADDERS, LINERS, FOAMS, FABRICS, DRINKS, ROLES, GEAR, SURF, lemonR, psat, K, P_ATM, PSI, latent, moistAir, AERO, G } from "./models.js";
import { makePlayer, lemonGeometry, ballTexture, CARDINAL } from "./world.js";

// ---------- course tags: titles as checked against the UW–Madison Guide; each links to the catalog's course search ----------
export const COURSES = {
  "CBE 250": ["Process Synthesis", "#55606b"],
  "CBE 310": ["Chemical Process Thermodynamics", "#2f6fb0"],
  "CBE 311": ["Thermodynamics of Mixtures", "#7b4fa6"],
  "CBE 320": ["Introductory Transport Phenomena", "#1f7a45"],
  "CBE 326": ["Momentum and Heat Transfer Operations", "#b5531f"],
  "CBE 426": ["Mass Transfer Operations", "#0f7378"],
  "CBE 430": ["Chemical Kinetics and Reactor Design", "#9c2f68"],
  "CBE 440": ["Chemical Engineering Materials", "#7d621a"],
  "CBE 450": ["Process Design", "#3d5a80"],
  "CBE 470": ["Process Dynamics and Control", "#a3303f"],
  "CBE 540": ["Polymer Science and Technology", "#5d7222"],
  "CBE 547": ["Introduction to Colloid and Interface Science", "#4f6d7a"],
  "CBE 560": ["Biochemical Engineering", "#24704f"],
};
export const courseURL = c => `https://guide.wisc.edu/search/?P=${encodeURIComponent(c)}`;
export const LABEL = {"CBE 250": "Balances", "CBE 310": "Thermo", "CBE 311": "Mixtures", "CBE 320": "Transport", "CBE 326": "Fluids & Heat", "CBE 426": "Mass Transfer", "CBE 430": "Kinetics & Reactors", "CBE 440": "Materials", "CBE 450": "Design", "CBE 470": "Control", "CBE 540": "Polymers", "CBE 547": "Colloids", "CBE 560": "Biochem"};
export const subj = c => LABEL[c] || c;
const full = c => `${c}: ${COURSES[c]?.[0] || ""}`;
export const tag = c => `<a class="course" href="${courseURL(c)}" target="_blank" rel="noopener" title="${full(c)}">${subj(c)} ↗</a>`;
export const chip = c => `<span class="course" title="${full(c)}">${subj(c)}</span>`;      // non-link chip for use inside buttons
export const seenIn = tag;   // one course chip; callers prefix "Seen in"
const eq = (courses, tex, note) => ({ courses, tex, note });   // tex: KaTeX source, typeset by the page
const I = v => `<i>${v}</i>`;
const f0 = v => Math.round(v).toLocaleString(), f1 = v => v.toFixed(1), f2 = v => v.toFixed(2), f3 = v => v.toFixed(3);
const sub = (a, b) => `${a}<sub>${b}</sub>`;


// ---------- references (each link opened and checked when added; see README) ----------
export const REFS = [
  ["University of Wisconsin–Madison", "Guide: Chemical and Biological Engineering (CBE) courses", "UW–Madison Guide", "2025–26", "https://guide.wisc.edu/courses/cbe/"],
  ["Wikipedia contributors", "Camp Randall Stadium", "Wikipedia", "accessed 2026", "https://en.wikipedia.org/wiki/Camp_Randall_Stadium"],
  ["Wikimedia Commons", "Camp Randall Aerial (photograph)", "Wikimedia Commons", "2021", "https://commons.wikimedia.org/wiki/File:Camp_Randall_Aerial.jpg"],
  ["Wikimedia Commons", "Camp Randall Stadium stands (photograph)", "Wikimedia Commons", "n.d.", "https://commons.wikimedia.org/wiki/File:Camp_Randall_Stadium_stands.jpg"],
  ["Wikimedia Commons", "Wisconsin Badgers football uniform (diagram)", "Wikimedia Commons", "n.d.", "https://commons.wikimedia.org/wiki/File:Wisconsin_badgers_football_unif.png"],
  ["ASTM International", "ASTM F1936-19, Standard Specification for Impact Attenuation of Turf Playing Systems as Measured in the Field", "ASTM International", "2019", "https://store.astm.org/f1936-19.html"],
  ["ASTM International", "ASTM F355-16, Standard Test Method for Impact Attenuation of Playing Surface Systems, Other Protective Sport Systems, and Materials Used for Athletics, Recreation and Play", "ASTM International", "2016", "https://store.astm.org/f0355-16.html"],
  ["Walsh, D.", "Safety Is the Goal (F1936 maximum 200 g; NFL and Synthetic Turf Council about 165 g)", "ASTM Standardization News", "2020", "https://www.astm.org/news/safety-goal-so20"],
  ["Thoms, A. W.", "Sources of Heat in Synthetic Turf Systems (PhD dissertation)", "University of Tennessee, Knoxville", "2015", "https://trace.tennessee.edu/utk_graddiss/3475"],
  ["New York State Department of Health", "Crumb-Rubber Infilled Synthetic Turf Athletic Fields (fact sheet)", "NYSDOH", "rev. 2018", "https://www.health.ny.gov/environmental/outdoors/synthetic_turf/crumb-rubber_infilled/fact_sheet.htm"],
  ["Brutsaert, W.", "On a derivable formula for long-wave radiation from clear skies", "Water Resources Research 11(5), 742–744", "1975", "https://doi.org/10.1029/WR011i005p00742"],
  ["Kasten, F.; Czeplak, G.", "Solar and terrestrial radiation dependent on the amount and type of cloud", "Solar Energy 24(2), 177–189", "1980", "https://doi.org/10.1016/0038-092X(80)90391-6"],
  ["NOCSAE", "ND002: Standard Performance Specification for Newly Manufactured Football Helmets (current edition ND002-17m24)", "National Operating Committee on Standards for Athletic Equipment", "2024", "https://nocsae.org/nd002-standard-performance-specification-for-newly-manufactured-football-helmets/"],
  ["Versace, J.", "A Review of the Severity Index", "SAE Technical Paper 710881", "1971", "https://www.sae.org/publications/technical-papers/content/710881/"],
  ["Gibson, L. J.; Ashby, M. F.", "Cellular Solids: Structure and Properties, 2nd ed.", "Cambridge University Press", "1997", "https://doi.org/10.1017/CBO9781139878326"],
  ["Exponent", "The Science of “Deflategate”", "Exponent, Inc.", "2016", "https://www.exponent.com/article/science-deflategate"],
  ["Rae, W. J.", "Flight dynamics of an American football in a forward pass", "Sports Engineering 6(3), 149–163", "2003", "https://doi.org/10.1007/BF02859892"],
  ["Washburn, E. W.", "The dynamics of capillary flow", "Physical Review 17(3), 273–283", "1921", "https://doi.org/10.1103/PhysRev.17.273"],
  ["Sawka, M. N.; Burke, L. M.; Eichner, E. R.; Maughan, R. J.; Montain, S. J.; Stachenfeld, N. S. (American College of Sports Medicine)", "ACSM position stand: Exercise and fluid replacement", "Medicine & Science in Sports & Exercise 39(2), 377–390", "2007", "https://pubmed.ncbi.nlm.nih.gov/17277604/"],
  ["Edelman, I. S.; Leibman, J.; O'Meara, M. P.; Birkenfeld, L. W.", "Interrelations between serum sodium concentration, serum osmolarity and total exchangeable sodium, total exchangeable potassium and total body water", "Journal of Clinical Investigation 37(9), 1236–1256", "1958", "https://pubmed.ncbi.nlm.nih.gov/13575523/"],
  ["Wright, E. M.; Loo, D. D. F.; Hirayama, B. A.", "Biology of human sodium glucose transporters", "Physiological Reviews 91(2), 733–794", "2011", "https://pubmed.ncbi.nlm.nih.gov/21527736/"],
  ["World Health Organization", "Oral rehydration salts: production of the new ORS (WHO/FCH/CAH/06.1)", "World Health Organization", "2006", "https://iris.who.int/handle/10665/69227"],
  ["Liljegren, J. C.; Carhart, R. A.; Lawday, P.; Tschopp, S.; Sharp, R.", "Modeling the wet bulb globe temperature using standard meteorological measurements", "Journal of Occupational and Environmental Hygiene 5(10), 645–655", "2008", "https://pubmed.ncbi.nlm.nih.gov/18668404/"],
  ["ISO", "ISO 7933:2023 Ergonomics of the thermal environment — Analytical determination and interpretation of heat stress using calculation of the predicted heat strain", "International Organization for Standardization", "2023", "https://www.iso.org/standard/78240.html"],
  ["ASHRAE", "ASHRAE Handbook — HVAC Applications (chapter: Snow Melting and Freeze Protection)", "ASHRAE", "current edition", "https://www.ashrae.org/technical-resources/ashrae-handbook"],
  ["Alduchov, O. A.; Eskridge, R. E.", "Improved Magnus form approximation of saturation vapor pressure", "Journal of Applied Meteorology 35(4), 601–609", "1996", "https://doi.org/10.1175/1520-0450(1996)035<0601:IMFAOS>2.0.CO;2"],
  ["Kasten, F.; Young, A. T.", "Revised optical air mass tables and approximation formula", "Applied Optics 28(22), 4735–4738", "1989", "https://doi.org/10.1364/AO.28.004735"],
  ["Duffie, J. A.; Beckman, W. A.", "Solar Engineering of Thermal Processes, 4th ed.", "Wiley", "2013", "https://doi.org/10.1002/9781118671603"],
  ["Whitaker, S.", "Forced convection heat transfer correlations for flow in pipes, past flat plates, single cylinders, single spheres, and for flow in packed beds and tube bundles", "AIChE Journal 18(2), 361–371", "1972", "https://doi.org/10.1002/aic.690180219"],
  ["Wijmans, J. G.; Baker, R. W.", "The solution-diffusion model: a review", "Journal of Membrane Science 107(1–2), 1–21", "1995", "https://doi.org/10.1016/0376-7388(95)00102-I"],
  ["Du Bois, D.; Du Bois, E. F.", "Clinical calorimetry, tenth paper: a formula to estimate the approximate surface area if height and weight be known", "Archives of Internal Medicine XVII(6_2), 863–871", "1916", "https://doi.org/10.1001/archinte.1916.00080130010002"],
  ["Chilton, T. H.; Colburn, A. P.", "Mass transfer (absorption) coefficients: prediction from data on heat transfer and fluid friction", "Industrial & Engineering Chemistry 26(11), 1183–1187", "1934", "https://doi.org/10.1021/ie50299a012"],
  ["Bergman, T. L.; Lavine, A. S.; Incropera, F. P.; DeWitt, D. P.", "Fundamentals of Heat and Mass Transfer, 7th ed. (ISBN 9780470501979)", "Wiley", "2011", "https://openlibrary.org/isbn/9780470501979"],
  ["Bird, R. B.; Stewart, W. E.; Lightfoot, E. N.", "Transport Phenomena, 2nd ed. (ISBN 9780471410775)", "Wiley", "2002", "https://openlibrary.org/isbn/9780471410775"],
  ["Bear, J.", "Dynamics of Fluids in Porous Media (Dover reprint of the 1972 edition, ISBN 9780486656755)", "Dover", "1988", "https://openlibrary.org/isbn/9780486656755"],
  ["Fogler, H. S.", "Elements of Chemical Reaction Engineering, 6th ed. (ISBN 9780135486221)", "Pearson", "2019", "https://openlibrary.org/isbn/9780135486221"],
  ["Butcher, J. C.", "Numerical Methods for Ordinary Differential Equations, 3rd ed.", "Wiley", "2016", "https://doi.org/10.1002/9781119121534"],
];
export const cite = (...ns) => ns.map(n => `<sup class="refsup"><a href="#ref-${n}" class="ref" data-ref="${n}" title="${REFS[n - 1][0]} (${REFS[n - 1][3]}). ${REFS[n - 1][1]}">${n}</a></sup>`).join(`<sup class="refsup">,</sup>`);

// ---------- materials and geometry helpers ----------
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.05, ...o });
function add(parent, geo, m, x = 0, y = 0, z = 0) { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; parent.add(o); return o; }
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (r, h, s = 24, r2 = r) => new THREE.CylinderGeometry(r2, r, h, s);
function shell(o, exp) { o.userData.shell = true; if (exp) o.userData.exp = new THREE.Vector3(...exp); return o; }
function label(parts, name, x, y, z) { parts.push([name, new THREE.Vector3(x, y, z)]); }
function noiseTex(base, dots, n, size = 256, rep = 1) {
  const c = document.createElement("canvas"); c.width = c.height = size; const g = c.getContext("2d");
  g.fillStyle = base; g.fillRect(0, 0, size, size);
  for (let i = 0; i < n; i++) { g.fillStyle = dots[Math.floor(Math.random() * dots.length)]; g.beginPath(); g.arc(Math.random() * size, Math.random() * size, 0.8 + Math.random() * 2.2, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function tracers(parent, n, color, size) {
  const pos = new Float32Array(n * 3), g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ color, size, sizeAttenuation: true, transparent: true, opacity: 0.9, depthWrite: false });
  const p = new THREE.Points(g, m); p.frustumCulled = false; parent.add(p);
  return { pos, geo: g, n, mat: m, u: new Float32Array(n).map(() => Math.random()), a: new Float32Array(n).map(() => Math.random()), b: new Float32Array(n).map(() => Math.random()) };
}
function arrow(parent, color) { const a = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, color, 0.3, 0.15); parent.add(a); return a; }
const thermalColor = (T, lo, hi, out = new THREE.Color()) => {   // blue → yellow → red "thermal camera" palette
  const t = Math.min(1, Math.max(0, (T - lo) / (hi - lo)));
  const S = [[0, "#1b2a6b"], [0.3, "#2f7fc1"], [0.55, "#f2d14b"], [0.8, "#e8692c"], [1, "#b51d1d"]].map(([a, c]) => [a, new THREE.Color(c)]);
  for (let i = 1; i < S.length; i++) if (t <= S[i][0]) { const u = (t - S[i - 1][0]) / (S[i][0] - S[i - 1][0]); return out.copy(S[i - 1][1]).lerp(S[i][1], u); }
  return out.copy(S.at(-1)[1]);
};
export { thermalColor };

// ===================================================================================
// detailed models: each returns { group, parts: [[name, Vector3]], update(dt, S), actions, fit }
// ===================================================================================

// 1. Synthetic turf system, close-up block 0.30 m × 0.30 m
function bladeGeo(h, w) { const g = new THREE.PlaneGeometry(w, h, 1, 6); g.translate(0, h / 2, 0); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i) / h; p.setZ(i, 0.18 * h * y * y); } g.computeVertexNormals(); return g; }
function turfModel() {
  const g = new THREE.Group(), parts = [], L = 0.30;
  const base = add(g, box(L, 0.06, L), mat("#8d8a82", { map: noiseTex("#8f8b83", ["#6e6a64", "#b0aba2", "#57534e"], 900) }), 0, -0.081, 0);
  const pad = add(g, box(L, 0.015, L), mat("#5b6168", { roughness: 0.8 }), 0, -0.0435, 0);
  for (let i = -6; i <= 6; i++) add(g, box(L, 0.004, 0.006), mat("#3f444a"), 0, -0.035, i * 0.022);       // drainage channels on top of the pad
  const back = add(g, box(L, 0.004, L), mat("#2a2c2e", { roughness: 0.7 }), 0, -0.034, 0);
  const holes = new THREE.InstancedMesh(cyl(0.0025, 0.0045, 8), mat("#0d0d0d"), 64), m4 = new THREE.Matrix4(); let k = 0;
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { m4.makeTranslation(-0.13 + i * 0.037, -0.034, -0.13 + j * 0.037); holes.setMatrixAt(k++, m4); } g.add(holes);
  const sandM = mat("#c8b48c", { map: noiseTex("#c9b58d", ["#a8916a", "#e2d3b2", "#8c7a5c"], 3500), roughness: 0.95 });
  const sand = add(g, box(L, 0.018, L), sandM, 0, -0.023, 0);
  const rubM = mat("#1d1d1d", { map: noiseTex("#1c1c1c", ["#333", "#0a0a0a", "#444"], 2600), roughness: 0.85 });
  const rub = add(g, box(L, 0.014, L), rubM, 0, -0.007, 0);
  // loose granules on top
  const gran = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.0016, 0), rubM, 700); k = 0;
  for (let i = 0; i < 700; i++) { m4.compose(new THREE.Vector3((Math.random() - 0.5) * L * 0.98, 0.0005, (Math.random() - 0.5) * L * 0.98), new THREE.Quaternion().random(), new THREE.Vector3(1, 0.7 + Math.random() * 0.6, 1)); gran.setMatrixAt(i, m4); }
  g.add(gran);
  // fibres: 3/4-inch gauge rows, tufts of 8 monofilaments (≈ 55 mm pile, 40 mm above the infill) plus curly nylon thatch
  const fibM = mat("#3f8a3a", { side: THREE.DoubleSide, roughness: 0.55 }), fib2 = mat("#5aa44c", { side: THREE.DoubleSide, roughness: 0.55 });
  const fg = bladeGeo(0.055, 0.0018), nR = 16, nS = 20, per = 8;
  const fA = new THREE.InstancedMesh(fg, fibM, nR * nS * per / 2), fB = new THREE.InstancedMesh(fg, fib2, nR * nS * per / 2); let ka = 0, kb = 0;
  const q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let r = 0; r < nR; r++) for (let s = 0; s < nS; s++) for (let b = 0; b < per; b++) {
    const x = -L / 2 + (r + 0.5) * L / nR, z = -L / 2 + (s + 0.5) * L / nS;
    e.set((Math.random() - 0.5) * 0.5, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.5); q.setFromEuler(e);
    m4.compose(new THREE.Vector3(x + (Math.random() - 0.5) * 0.004, -0.032, z + (Math.random() - 0.5) * 0.004), q, new THREE.Vector3(1, 0.85 + Math.random() * 0.25, 1));
    (b % 2 ? fA : fB).setMatrixAt(b % 2 ? ka++ : kb++, m4);
  }
  fA.castShadow = fB.castShadow = true; g.add(fA, fB);
  const thM = mat("#2f6a2c", { side: THREE.DoubleSide }), th = new THREE.InstancedMesh(new THREE.TorusGeometry(0.004, 0.0006, 4, 10, Math.PI * 1.5), thM, 260);
  for (let i = 0; i < 260; i++) { m4.compose(new THREE.Vector3((Math.random() - 0.5) * L, -0.006 + Math.random() * 0.01, (Math.random() - 0.5) * L), new THREE.Quaternion().random(), new THREE.Vector3(1, 1, 1)); th.setMatrixAt(i, m4); } g.add(th);
  label(parts, "PE monofilament fibres (≈ 55 mm pile)", 0.06, 0.03, 0.1);
  label(parts, "Nylon thatch (short, curled)", -0.1, 0.004, 0.13);
  label(parts, "Crumb-rubber infill (SBR, 1–3 mm)", -0.15, -0.007, 0.08);
  label(parts, "Silica sand ballast", -0.15, -0.023, -0.02);
  label(parts, "Perforated backing (latex/PU coated)", 0.15, -0.034, -0.1);
  label(parts, "Shock pad with drainage channels", 0.15, -0.045, 0.05);
  label(parts, "Open-graded stone base", 0.1, -0.09, 0.15);
  let thermal = false, was = false; const col = new THREE.Color();
  const layers = [[fibM, 0], [fib2, 0], [rubM, 1], [thM, 0.5], [sandM, 2], [back.material, 3], [pad.material, 4], [base.material, 5]];
  const orig = layers.map(([m]) => m.color.clone()); const origMaps = layers.map(([m]) => m.map);
  return {
    group: g, parts, fit: 0.55, explodeAxis: "y",
    actions: [{ label: "Thermal camera", fn: b => { thermal = !thermal; b.setAttribute("aria-pressed", String(thermal)); } }],
    update(dt, S) {
      const flip = thermal !== was; was = thermal;
      layers.forEach(([m, depth], i) => {
        if (thermal) { const T = S.Ts.sun + (S.w.Tmean - S.Ts.sun) * Math.min(1, depth / 3.5); thermalColor(T, -5, 70, m.color); m.map = null; }
        else { m.color.copy(orig[i]); m.map = origMaps[i]; }
        if (flip) m.needsUpdate = true;
      });
    },
  };
}

// 2. Impact and drainage section: missile drop on the surface, water through the layers to a slit drain
function baseModel() {
  const g = new THREE.Group(), parts = [], Lx = 1.2, Lz = 0.7;
  const soil = add(g, box(Lx, 0.25, Lz), mat("#6e5640", { roughness: 1 }), 0, -0.365, 0);
  const trench = add(g, box(0.3, 0.2, Lz), mat("#7f7b74"), 0, -0.32, 0);
  const pipeM = mat("#2b2d30", { roughness: 0.6, side: THREE.DoubleSide }); const pipe = shell(add(g, new THREE.CylinderGeometry(0.05, 0.05, Lz, 28, 1, true).rotateX(Math.PI / 2), pipeM, 0, -0.36, 0));
  const stoneM = mat("#9a968e", { flatShading: true, roughness: 0.9 }), st = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.012, 0), stoneM, 1400), m4 = new THREE.Matrix4();
  for (let i = 0; i < 1400; i++) { m4.compose(new THREE.Vector3((Math.random() - 0.5) * Lx * 0.98, -0.2 + Math.random() * 0.14, (Math.random() - 0.5) * Lz * 0.98), new THREE.Quaternion().random(), new THREE.Vector3(1, 0.7, 1).multiplyScalar(0.7 + Math.random() * 0.6)); st.setMatrixAt(i, m4); }
  st.castShadow = true; g.add(st);
  const stoneBed = add(g, box(Lx, 0.15, Lz), mat("#7a766f", { transparent: true, opacity: 0.35, depthWrite: false }), 0, -0.165, 0);
  const pad = add(g, box(Lx, 0.015, Lz), mat("#5b6168"), 0, -0.0825, 0);
  const back = add(g, box(Lx, 0.004, Lz), mat("#2a2c2e"), 0, -0.073, 0);
  const inf = add(g, box(Lx, 0.03, Lz), mat("#3a3a36", { map: noiseTex("#3b3a35", ["#c9b58d", "#1a1a1a", "#a8916a"], 3000, 256, 3) }), 0, -0.056, 0);
  const fg = bladeGeo(0.055, 0.004), fM = mat("#3f8a3a", { side: THREE.DoubleSide }), n = 2600, fib = new THREE.InstancedMesh(fg, fM, n), q = new THREE.Quaternion();
  for (let i = 0; i < n; i++) { q.setFromEuler(new THREE.Euler((Math.random() - 0.5) * 0.5, Math.random() * 6.3, (Math.random() - 0.5) * 0.5)); m4.compose(new THREE.Vector3((Math.random() - 0.5) * Lx, -0.045, (Math.random() - 0.5) * Lz), q, new THREE.Vector3(1, 1, 1)); fib.setMatrixAt(i, m4); }
  g.add(fib);
  // ASTM F355 procedure A missile: 9.1 kg, 129 cm² flat face (Ø 128 mm), guide tube
  const mis = new THREE.Group(); g.add(mis); mis.position.set(-0.35, 0.3, 0);
  add(mis, cyl(0.064, 0.09, 36), mat("#b9bec4", { metalness: 0.8, roughness: 0.3 }), 0, 0.045, 0);
  add(mis, cyl(0.03, 0.2, 20), mat("#8d949b", { metalness: 0.8, roughness: 0.3 }), 0, 0.19, 0);
  add(mis, box(0.04, 0.03, 0.03), mat("#d8a32c"), 0, 0.105, 0.06);
  const guide = add(g, cyl(0.075, 0.9, 32), mat("#cfd8df", { transparent: true, opacity: 0.18, depthWrite: false }), -0.35, 0.45, 0);
  const dimple = add(g, new THREE.RingGeometry(0.02, 0.07, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: "#000", transparent: true, opacity: 0 }), -0.35, -0.04, 0);
  const wat = tracers(g, 700, "#5fc3ff", 0.012);
  label(parts, "F355-A missile: 9.1 kg, 129 cm² face, 0.61 m drop", -0.35, 0.45, 0.07);
  label(parts, "Infill and fibres", 0.4, -0.05, 0.3);
  label(parts, "Shock pad (closed-cell foam)", 0.45, -0.0825, -0.3);
  label(parts, "Open-graded stone base, 150 mm", 0.45, -0.17, 0.3);
  label(parts, "Perforated slit drain, 100 mm", 0.0, -0.36, 0.35);
  label(parts, "Compacted subgrade", -0.45, -0.38, 0.3);
  let t = 0;
  return {
    group: g, parts, fit: 1.5, explodeAxis: "y",
    update(dt, S) {
      t += dt; const cyc = 2.4, ph = t % cyc, gm = S.gm, fall = Math.sqrt(2 * 0.61 / G);
      // free fall (real time), then a slowed-down crush (×40) using the model's deflection, then rest
      let y; const crush = gm.xmax, contact = 0.4;
      if (ph < fall) y = 0.61 - 0.5 * G * ph * ph; else if (ph < fall + contact) y = -crush * Math.sin(Math.PI * (ph - fall) / contact); else y = 0;
      const lift = ph > fall + contact + 0.6 ? (ph - fall - contact - 0.6) / (cyc - fall - contact - 0.6) * 0.61 : 0;
      mis.position.y = -0.04 + Math.max(y, 0) + Math.min(0, y) + lift * (y === 0 ? 1 : 0);
      dimple.material.opacity = y < 0 ? 0.5 * (-y / crush) : 0; dimple.scale.setScalar(1 + (y < 0 ? -y * 20 : 0));
      // water: speed ∝ Darcy velocity of the actual rain (shown 100× faster)
      const v = Math.max(0.0002, S.dr.vDarcy * 100), on = S.W.rain > 0;
      wat.mat.opacity = on ? 0.9 : 0;
      for (let i = 0; i < wat.n; i++) {
        wat.u[i] += dt * v * (0.6 + wat.b[i]) * 8; if (wat.u[i] > 1) { wat.u[i] -= 1; wat.a[i] = Math.random(); }
        const u = wat.u[i], x0 = (wat.a[i] - 0.5) * Lx, z0 = (wat.b[i] - 0.5) * Lz;
        let x = x0, y2 = -0.04 - u * 0.24, z = z0;
        if (u > 0.55) { const s = (u - 0.55) / 0.45; x = x0 * (1 - s); y2 = -0.172 - s * 0.19; }
        wat.pos.set([x, y2, z], i * 3);
      }
      wat.geo.attributes.position.needsUpdate = true;
    },
  };
}

// 3. The football: skin, lining, bladder, valve, laces
function ballModel() {
  const g = new THREE.Group(), parts = [], { a, b } = BALL;
  const tex = ballTexture();
  const skin = shell(add(g, lemonGeometry(a, b, 64).rotateZ(Math.PI / 2), mat("#ffffff", { map: tex, roughness: 0.55, side: THREE.DoubleSide })), [0, 0.22, 0]);
  const lining = shell(add(g, lemonGeometry(a * 0.985, b * 0.955, 48).rotateZ(Math.PI / 2), mat("#e6dccb", { roughness: 0.9, side: THREE.DoubleSide })), [0, 0.12, 0]);
  const bladM = mat("#3b3e42", { roughness: 0.5, side: THREE.DoubleSide });
  const bladder = shell(add(g, lemonGeometry(a * 0.965, b * 0.92, 48).rotateZ(Math.PI / 2), bladM), [0, 0.03, 0]);
  const valve = add(g, cyl(0.0045, 0.012, 16), mat("#222"), 0.045, b - 0.004, 0);
  const lM = mat("#f6f3ea", { roughness: 0.7 });
  add(g, box(0.085, 0.003, 0.004), lM, 0, b + 0.001, 0);
  for (let i = 0; i < 8; i++) add(g, box(0.004, 0.003, 0.03), lM, -0.035 + i * 0.01, b + 0.0015, 0);
  const gas = tracers(g, 520, "#a9d4ff", 0.004), gN = new Float32Array(520).map(() => Math.random() < 0.79 ? 1 : 0);
  gas.geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(520 * 3).map((_, i) => gN[Math.floor(i / 3)] ? [0.75, 0.78, 0.82][i % 3] : [0.38, 0.72, 1][i % 3]), 3));
  gas.mat.vertexColors = true; gas.mat.color.set("#ffffff");
  label(parts, "Pebbled cowhide skin, chrome-tanned (4 panels)", 0.05, b * 0.8, 0.05);
  label(parts, "Laces and white NCAA stripes", -0.02, b + 0.004, 0);
  label(parts, "Laminated cotton/polyester lining", -0.09, -b * 0.6, 0.02);
  label(parts, "Bladder (butyl or latex)", 0.0, -b * 0.85, 0);
  label(parts, "Inflation valve", 0.045, b + 0.004, 0);
  label(parts, "Air: N₂ (grey) and O₂ (blue) molecules", 0.06, 0.0, -0.01);
  let t = 0;
  return {
    group: g, parts, fit: 0.75, cutZ: 0, explodeAxis: "y",
    update(dt, S) {
      t += dt; bladder.material.color.set(S.ball.bladder === "latex" ? "#c99a52" : "#3b3e42");
      const Tk = K(S.ball.Tball), sp = Math.sqrt(Tk / 293) * 0.12;
      for (let i = 0; i < gas.n; i++) {
        gas.u[i] = (gas.u[i] + dt * sp * (0.5 + gas.a[i])) % 1;
        const x = (gas.u[i] * 2 - 1) * a * 0.9, r = lemonR(x) * 0.86 * Math.sqrt(gas.b[i]), ang = gas.a[i] * 40 + t * (0.4 + gas.b[i]);
        gas.pos.set([x, Math.sin(ang) * r, Math.cos(ang) * r], i * 3);
      }
      gas.geo.attributes.position.needsUpdate = true;
    },
  };
}

// 4. The spiral in flight: forces and the air streaming past
function passModel() {
  const g = new THREE.Group(), parts = [], { a, b } = BALL, s = 6;   // shown 6× life size
  const ball = new THREE.Group(); g.add(ball);
  add(ball, lemonGeometry(a * s, b * s, 64).rotateZ(Math.PI / 2), mat("#ffffff", { map: ballTexture(), roughness: 0.55 }));
  const flow = tracers(g, 1600, "#bfe6ff", 0.02);
  const ar = { v: arrow(g, 0x3ccf6e), d: arrow(g, 0xe2503c), n: arrow(g, 0xf0a020), m: arrow(g, 0xb57cff), w: arrow(g, 0x6aa3e0) };
  const axis = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-1.4, 0, 0), new THREE.Vector3(1.4, 0, 0)]), new THREE.LineDashedMaterial({ color: "#ffffff", dashSize: 0.06, gapSize: 0.04 }));
  axis.computeLineDistances(); g.add(axis);
  label(parts, "Velocity relative to the air", 1.6, 0.1, 0);
  label(parts, "Drag, ½ρv²AC_D", -1.4, 0.1, 0);
  label(parts, "Side force from the yaw of repose", 0, 0.1, 1.0);
  label(parts, "Magnus force (spin × crossflow)", 0, 0.9, 0);
  label(parts, "Weight", 0, -1.0, 0);
  label(parts, "Spin axis (yaw exaggerated 4×)", 1.2, 0.02, 0.2);
  let t = 0;
  return {
    group: g, parts, fit: 4.2, explodeAxis: "y",
    update(dt, S) {
      t += dt; const F = S.flF, sc = 0.9;
      ball.rotation.x += dt * 2 * Math.PI * S.pass.spin * 0.15;           // spin shown slowed down
      const yaw = Math.min(0.6, 4 * F.alpha); ball.rotation.y = -yaw; axis.rotation.y = -yaw;
      const set = (A, dir, mag, org = [0, 0, 0]) => { mag *= 2.2; const L = Math.max(0.05, mag); A.setDirection(new THREE.Vector3(...dir).normalize()); A.setLength(L, Math.min(0.3, L * 0.3), Math.min(0.15, L * 0.18)); A.position.set(...org); };
      set(ar.v, [1, 0, 0], 0.5, [a * s + 0.1, 0, 0]); set(ar.d, [-1, 0, 0], sc * F.drag / F.weight, [-a * s, 0, 0]);
      set(ar.n, [0, 0, 1], sc * F.side / F.weight * 3, [0, 0, b * s]); set(ar.m, [0, 1, 0], sc * F.magnus / F.weight * 10, [0, b * s, 0]); set(ar.w, [0, -1, 0], sc, [0, -b * s, 0]);
      const V = 0.8 + S.pass.v0 / 25;
      for (let i = 0; i < flow.n; i++) {
        flow.u[i] += dt * V * 0.35; if (flow.u[i] > 1) flow.u[i] -= 1;
        const x = 2.2 - flow.u[i] * 4.4, r0 = 0.04 + flow.a[i] * 0.9, th = flow.b[i] * Math.PI * 2;
        const xr = x / s, R = Math.abs(xr) < a ? lemonR(xr) * s : 0, r = Math.sqrt(r0 * r0 + R * R);
        const wake = x < -a * s ? Math.exp(-r0 * 4) * 0.05 * Math.sin(t * 9 + i) : 0;
        flow.pos.set([x, Math.sin(th) * r + wake, Math.cos(th) * r + wake - yaw * 0.25 * x * (Math.abs(xr) < a ? 0.2 : 0)], i * 3);
      }
      flow.geo.attributes.position.needsUpdate = true;
    },
  };
}

// 5. Helmet on a headform, struck by a linear impactor
function helmetModel() {
  const g = new THREE.Group(), parts = [];
  const headM = mat("#9aa0a6", { roughness: 0.5, metalness: 0.2 });
  const head = add(g, new THREE.SphereGeometry(0.095, 40, 30), headM, 0, 0.18, 0); head.scale.set(1.0, 1.12, 0.88);
  add(g, cyl(0.045, 0.12, 24), headM, 0, 0.06, 0);
  add(g, box(0.06, 0.08, 0.05), headM, 0.075, 0.13, 0);            // face/jaw block
  const shellM = mat(CARDINAL, { roughness: 0.18, metalness: 0.05, side: THREE.DoubleSide });
  const sh = shell(add(g, new THREE.SphereGeometry(0.148, 48, 32, 0, Math.PI * 2, 0, Math.PI * 0.62), shellM, -0.01, 0.17, 0), [0, 0.25, 0]);
  sh.scale.set(1.12, 1.0, 0.95); sh.rotation.z = 0.25;
  const stripe = add(g, new THREE.TorusGeometry(0.149, 0.006, 8, 48, Math.PI * 0.85), mat("#ffffff", { roughness: 0.3 }), -0.01, 0.17, 0); stripe.rotation.set(Math.PI / 2, 0, Math.PI * 0.6); stripe.scale.set(1.12, 0.95, 1);
  shell(stripe, [0, 0.25, 0]);
  // facemask: steel bars
  const barM = mat("#c9ccd0", { metalness: 0.85, roughness: 0.3 });
  for (const [y, rr] of [[0.15, 0.13], [0.11, 0.125], [0.07, 0.11]]) { const bar = add(g, new THREE.TorusGeometry(rr, 0.0055, 8, 32, Math.PI * 0.9), barM, 0.02, y, 0); bar.rotation.set(Math.PI / 2, 0, -Math.PI * 0.45); }
  add(g, cyl(0.0055, 0.1, 8), barM, 0.14, 0.11, 0);
  // liner pads between head and shell (positions on a sphere, radial)
  const padM = mat("#d9d2a7", { roughness: 0.8 }), pads = [], dirs = [];
  for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) { const th = -Math.PI * 0.9 + i * Math.PI * 0.33, ph = 0.25 + j * 0.3; dirs.push(new THREE.Vector3(Math.cos(th) * Math.sin(ph) * 1.0, Math.cos(ph), Math.sin(th) * Math.sin(ph))); }
  const padGeo = { epp: () => box(0.03, 0.032, 0.03), vn: () => box(0.03, 0.03, 0.03), tpu: () => cyl(0.011, 0.034, 12, 0.006), none: () => box(0.001, 0.001, 0.001) };
  let liner = null;
  const buildPads = key => { for (const p of pads) g.remove(p); pads.length = 0; liner = key;
    padM.color.set({ epp: "#3a3d40", vn: "#d0c58e", tpu: "#2f2f33", none: "#000" }[key]);
    for (const d of dirs) { const p = new THREE.Mesh(padGeo[key](), padM); p.castShadow = true; p.position.set(0, 0.18, 0).addScaledVector(d, 0.112); p.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d); p.userData.d = d; g.add(p); pads.push(p); } };
  // linear impactor ram
  const ram = new THREE.Group(); g.add(ram);
  add(ram, cyl(0.065, 0.03, 32).rotateZ(Math.PI / 2), mat("#3b3f44", { metalness: 0.6 }), 0, 0, 0);
  add(ram, cyl(0.025, 0.5, 20).rotateZ(Math.PI / 2), mat("#b9bec4", { metalness: 0.85, roughness: 0.25 }), -0.26, 0, 0);
  const ramDir = new THREE.Vector3(1, 0.15, 0.55).normalize(), contact = new THREE.Vector3(0, 0.2, 0).addScaledVector(ramDir, 0.18);
  ram.quaternion.setFromUnitVectors(new THREE.Vector3(-1, 0, 0), ramDir.clone().negate());
  label(parts, "Polycarbonate shell (≈ 3.5 mm)", -0.1, 0.31, 0.05);
  label(parts, "Energy-absorbing liner", -0.08, 0.22, -0.11);
  label(parts, "Steel facemask", 0.14, 0.11, 0.0);
  label(parts, "Headform (≈ 4.9 kg)", 0.0, 0.08, 0.0);
  label(parts, "Linear impactor", contact.x + ramDir.x * 0.1, contact.y, contact.z + ramDir.z * 0.1);
  let t = 0;
  return {
    group: g, parts, fit: 0.6, explodeAxis: "y",
    update(dt, S) {
      if (liner !== S.hel.liner) buildPads(S.hel.liner);
      t += dt; const cyc = 3.0, ph = t % cyc, H = S.hel.res, dur = H.dur / 1000, slow = 80;
      const tt = (ph - 1.0) / slow;   // impact starts at 1.0 s, shown 80× slowed
      let x = 0; if (tt > 0 && tt < dur) { const i = Math.min(H.x.length - 1, Math.floor(tt / dur * H.x.length)); x = H.x[i] / 1000; }
      const pre = ph < 1.0 ? (1 - ph) * 0.25 : (tt >= dur ? Math.min(0.25, (tt - dur) * slow * 0.15) : 0);
      ram.position.copy(contact).addScaledVector(ramDir, pre + 0.03 - x * 0.8);
      const L = LINERS[S.hel.liner], strain = L.H ? Math.min(0.75, x / L.H) : 0;
      for (const p of pads) { const w = Math.max(0, p.userData.d.dot(ramDir)); p.scale.y = 1 - strain * w * w; }
    },
  };
}

// 6. Cleated shoe on turf
function cleatModel() {
  const g = new THREE.Group(), parts = [];
  const foot = new THREE.Shape(); foot.moveTo(-0.15, 0); foot.bezierCurveTo(-0.16, 0.045, -0.12, 0.05, -0.06, 0.045); foot.bezierCurveTo(0.02, 0.04, 0.1, 0.06, 0.145, 0.03); foot.bezierCurveTo(0.165, 0.0, 0.15, -0.04, 0.11, -0.045); foot.bezierCurveTo(0.04, -0.05, -0.02, -0.035, -0.08, -0.04); foot.bezierCurveTo(-0.13, -0.045, -0.155, -0.03, -0.15, 0);
  const ext = (d, bev = 0.002) => new THREE.ExtrudeGeometry(foot, { depth: d, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 2 }).rotateX(-Math.PI / 2);
  const mid = new THREE.Group(); g.add(mid);
  const midM = mat("#f1f0ea", { roughness: 0.7 }); const ms = add(mid, ext(0.016), midM, 0, 0.012, 0);
  const plate = add(g, ext(0.004, 0.001), mat("#1c1c1e", { roughness: 0.4 }), 0, 0.008, 0);
  const studM = mat("#2a2a2c", { roughness: 0.4 });
  for (const [x, z] of [[-0.12, -0.02], [-0.12, 0.02], [-0.09, 0], [0.02, 0.03], [0.05, -0.03], [0.07, 0.035], [0.1, -0.025], [0.12, 0.02], [0.135, -0.005], [0.04, 0.0]]) add(g, cyl(0.0065, 0.013, 12, 0.004), studM, x, 0.0, z);
  const upM = mat("#b9101a", { roughness: 0.75, side: THREE.DoubleSide });
  const up = shell(add(g, new THREE.SphereGeometry(0.075, 40, 24, 0, Math.PI * 2, 0, Math.PI / 2), upM, -0.005, 0.03, 0), [0, 0.12, 0]); up.scale.set(2.05, 1.0, 0.68);
  const collar = shell(add(g, new THREE.TorusGeometry(0.035, 0.008, 10, 24), mat("#151515"), -0.075, 0.098, 0), [0, 0.12, 0]); collar.rotation.x = Math.PI / 2; collar.scale.set(1.3, 1, 1);
  for (let i = 0; i < 6; i++) add(g, box(0.003, 0.003, 0.04), mat("#fafafa"), -0.03 + i * 0.016, 0.098 - i * 0.004, 0);
  add(g, ext(0.004, 0.001), mat("#55595e"), 0, 0.03, 0);   // insole
  // turf patch
  const turf = add(g, box(0.5, 0.02, 0.25), mat("#2f2f2c", { map: noiseTex("#30302c", ["#c9b58d", "#151515"], 2500) }), 0, -0.018, 0);
  const fg = bladeGeo(0.03, 0.003), fM = mat("#3f8a3a", { side: THREE.DoubleSide }), n = 1100, fib = new THREE.InstancedMesh(fg, fM, n), m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  for (let i = 0; i < n; i++) { let x, z; do { x = (Math.random() - 0.5) * 0.5; z = (Math.random() - 0.5) * 0.25; } while (Math.abs(x) < 0.17 && Math.abs(z) < 0.06);
    q.setFromEuler(new THREE.Euler((Math.random() - 0.5) * 0.6, Math.random() * 6.3, (Math.random() - 0.5) * 0.6)); m4.compose(new THREE.Vector3(x, -0.008, z), q, new THREE.Vector3(1, 1, 1)); fib.setMatrixAt(i, m4); }
  g.add(fib);
  label(parts, "Knit/TPU-film upper", -0.02, 0.09, 0.04);
  label(parts, "Midsole foam (EVA, e-TPU or PEBA)", 0.08, 0.02, 0.05);
  label(parts, "TPU/nylon stud plate", -0.1, 0.008, 0.05);
  label(parts, "Moulded studs, ≈ 13 mm", 0.12, -0.004, 0.025);
  label(parts, "Insole and sockliner", -0.04, 0.036, -0.03);
  label(parts, "Turf infill the studs penetrate", 0.2, -0.01, 0.1);
  let t = 0;
  return {
    group: g, parts, fit: 0.45, explodeAxis: "y",
    update(dt, S) {
      t += dt; const ph = (t % 1.6) / 1.6, load = Math.max(0, Math.sin(ph * Math.PI * 2)) ** 2;
      mid.scale.y = 1 - S.shoe.mid.strain * load; midM.color.set({ eva: "#f1f0ea", etpu: "#e9e6dc", peba: "#dfe8ef" }[S.shoe.foam]);
    },
  };
}

// 7. Uniform layers over the shoulder: skin, base layer, pads, jersey (block 0.25 m, layers at true thickness)
function uniformModel() {
  const g = new THREE.Group(), parts = [], L = 0.25;
  const skinM = mat("#c58c62", { roughness: 0.5 });
  add(g, box(L, 0.02, L), skinM, 0, -0.01, 0);
  const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0025, 10, 8), mat("#cfe9ff", { roughness: 0.05, transparent: true, opacity: 0.8 }), 90), m4 = new THREE.Matrix4();
  for (let i = 0; i < 90; i++) { m4.compose(new THREE.Vector3((Math.random() - 0.5) * L, 0.001, (Math.random() - 0.5) * L), new THREE.Quaternion(), new THREE.Vector3(1, 0.5, 1)); drops.setMatrixAt(i, m4); } g.add(drops);
  const baseM = mat("#1f2227", { roughness: 0.8 }); const baseL = add(g, box(L, 0.0012, L), baseM, 0, 0.0026, 0);
  const foamM = mat("#e9d37a", { roughness: 0.9 }); const foam = add(g, box(L * 0.8, 0.022, L), foamM, -L * 0.1, 0.016, 0);
  const capM = mat("#f3f3f3", { roughness: 0.3 }); const cap = add(g, box(L * 0.62, 0.004, L), capM, -L * 0.19, 0.029, 0);
  for (let i = -2; i <= 0; i++) for (let j = -2; j <= 2; j++) add(g, cyl(0.004, 0.0045, 12), mat("#222"), i * 0.04 - 0.01, 0.029, j * 0.045);   // vent holes
  // jersey: mesh knit with open holes
  const jc = document.createElement("canvas"); jc.width = jc.height = 128; const jg = jc.getContext("2d"); jg.fillStyle = "#fff"; jg.fillRect(0, 0, 128, 128); jg.fillStyle = "#000"; for (let x = 0; x < 128; x += 16) for (let y = 0; y < 128; y += 16) { jg.beginPath(); jg.arc(x + 8 + (y / 16 % 2) * 4, y + 8, 4.5, 0, 7); jg.fill(); }
  const jt = new THREE.CanvasTexture(jc); jt.wrapS = jt.wrapT = THREE.RepeatWrapping; jt.repeat.set(2, 4);
  const jerM = mat(CARDINAL, { alphaMap: jt, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 });
  const jer = add(g, box(L * 0.45, 0.0012, L), jerM, -L * 0.275, 0.038, 0);
  const vap = tracers(g, 500, "#e8f4ff", 0.004), liq = tracers(g, 300, "#5fc3ff", 0.0035);
  label(parts, "Skin, sweat glands and sweat film", -0.1, 0.0, 0.1);
  label(parts, "Compression base layer (nylon/spandex)", 0.11, 0.003, -0.11);
  label(parts, "Shoulder-pad foam (closed-cell PE/EVA)", 0.07, 0.016, -0.08);
  label(parts, "Hard pad shell (PC/ABS), vent holes", 0.0, 0.03, 0.08);
  label(parts, "Jersey: polyester mesh knit (holes enlarged)", -0.1, 0.038, 0.11);
  label(parts, "Water vapour leaving the microclimate", 0, 0.08, 0);
  return {
    group: g, parts, fit: 0.42, explodeAxis: "y",
    update(dt, S) {
      const ev = Math.min(1, S.pl.E / 250), sw = Math.min(1, S.pl.SW / 2.5);
      for (let i = 0; i < vap.n; i++) {
        vap.u[i] += dt * (0.15 + 0.5 * ev) * (0.5 + vap.b[i]); if (vap.u[i] > 1) { vap.u[i] = 0; vap.a[i] = Math.random(); vap.b[i] = Math.random(); }
        const u = vap.u[i], x = (vap.a[i] - 0.5) * L, z = (vap.b[i] - 0.5) * L, inside = Math.abs(x) < L * 0.42 && Math.abs(z) < L * 0.42;
        const y = u * 0.09, ox = inside && y > 0.004 && y < 0.03 ? Math.sign(x || 1) * (y - 0.004) * 4 : 0;   // vapour detours round the pads to the vents/edges
        vap.pos.set([x + ox, y, z], i * 3);
      }
      vap.mat.opacity = 0.3 + 0.6 * ev; vap.geo.attributes.position.needsUpdate = true;
      for (let i = 0; i < liq.n; i++) { liq.u[i] += dt * 0.1 * (0.5 + liq.b[i]) * (0.3 + sw); if (liq.u[i] > 1) liq.u[i] -= 1;
        liq.pos.set([(liq.a[i] - 0.5) * L * (0.3 + 0.7 * liq.u[i]), 0.0028, (liq.b[i] - 0.5) * L * (0.3 + 0.7 * liq.u[i])], i * 3); }
      liq.mat.opacity = 0.3 + 0.7 * sw; liq.geo.attributes.position.needsUpdate = true;
    },
  };
}

// 8. The player's heat balance
function playerModel() {
  const g = new THREE.Group(), parts = [];
  const p = makePlayer("home", 2); g.add(p);
  p.traverse(o => { if (o.userData.torso) { o.material = o.material.clone(); o.material.side = THREE.DoubleSide; shell(o, [0, 0, 0.6]); } });
  const coreM = new THREE.MeshStandardMaterial({ color: "#d33", emissive: "#d33", emissiveIntensity: 0.6 });
  const core = add(g, new THREE.SphereGeometry(0.11, 24, 18), coreM, 0, 1.2, 0);
  const ar = { sun: arrow(g, 0xf2c94c), conv: arrow(g, 0x6aa3e0), evap: arrow(g, 0xbfe6ff), met: arrow(g, 0xe2503c), res: arrow(g, 0xb0b0b0) };
  const vap = tracers(g, 400, "#e8f4ff", 0.025);
  label(parts, "Core: metabolic heat M", 0, 1.2, 0);
  label(parts, "Solar and long-wave radiation", 0.6, 2.3, 0.4);
  label(parts, "Convection C + radiation R", -0.6, 1.2, 0.5);
  label(parts, "Sweat evaporation E", 0, 1.9, -0.3);
  label(parts, "Respiration", 0.25, 1.75, 0);
  let t = 0;
  return {
    group: g, parts, fit: 2.6, explodeAxis: "z",
    update(dt, S) {
      t += dt; const o = S.pl, A = o.A, sc = 1 / 400;
      thermalColor(o.Tc, 36.5, 40.5, coreM.color); coreM.emissive.copy(coreM.color);
      const set = (a, dir, W, org) => { const L = Math.max(0.05, Math.abs(W) * A * sc); a.setDirection(new THREE.Vector3(...dir).normalize()); a.setLength(L, Math.min(0.25, L * 0.3), 0.1); a.position.set(...org); };
      const sunA = S.w.sun.el > 0 ? S.w.I.glob * 0.7 * 0.3 : 0;
      set(ar.sun, [-0.5, -1, -0.3], sunA, [0.5 + sunA * A * sc * 0.5, 1.9 + sunA * A * sc, 0.3 + sunA * A * sc * 0.3]);
      set(ar.met, [0, 1, 0], o.M, [0, 1.2, 0]);
      const cr = o.CR; set(ar.conv, cr >= 0 ? [-1, 0, 0.6] : [1, 0, -0.6], cr, cr >= 0 ? [-0.25, 1.15, 0.15] : [-0.25 - Math.abs(cr) * A * sc, 1.15, 0.15 + Math.abs(cr) * A * sc * 0.6]);
      set(ar.evap, [0, 1, -0.4], o.E, [0, 1.55, -0.15]); set(ar.res, [1, 0.2, 0], o.res, [0.2, 1.72, 0]);
      const rate = Math.min(1, o.E / 300);
      for (let i = 0; i < vap.n; i++) { vap.u[i] += dt * (0.2 + rate) * (0.4 + vap.b[i]) * 0.5; if (vap.u[i] > 1) vap.u[i] = 0;
        const th = vap.a[i] * 6.28, r = 0.25 + vap.u[i] * 0.3; vap.pos.set([Math.cos(th) * r * 0.7, 0.9 + vap.b[i] * 0.7 + vap.u[i] * 1.2, Math.sin(th) * r], i * 3); }
      vap.mat.opacity = 0.15 + 0.6 * rate; vap.geo.attributes.position.needsUpdate = true;
    },
  };
}

// 9. Osmosis demonstrator and a squeeze bottle
function drinkModel() {
  const g = new THREE.Group(), parts = [];
  const glass = mat("#cfe3f0", { transparent: true, opacity: 0.22, roughness: 0.05, depthWrite: false, side: THREE.DoubleSide });
  const R = 0.03, H = 0.34;
  for (const x of [-0.09, 0.09]) add(g, new THREE.CylinderGeometry(R, R, H, 32, 1, true), glass, x, 0.25, 0);
  add(g, new THREE.TorusGeometry(0.09, R, 16, 32, Math.PI), glass, 0, 0.08, 0).rotation.z = Math.PI;
  const mem = add(g, cyl(R * 1.05, 0.004, 32).rotateZ(Math.PI / 2), mat("#f2e7c9", { roughness: 0.9 }), 0, -0.01, 0);
  const liqL = mat("#ffb347", { transparent: true, opacity: 0.55 }), liqR = mat("#f6d5b0", { transparent: true, opacity: 0.55 });
  const colL = add(g, cyl(R * 0.95, 1, 32), liqL, -0.09, 0, 0), colR = add(g, cyl(R * 0.95, 1, 32), liqR, 0.09, 0, 0);
  const ions = tracers(g, 400, "#ffffff", 0.006); ions.geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(400 * 3), 3)); ions.mat.vertexColors = true;
  // bottle
  const bot = add(g, new THREE.LatheGeometry([[0, 0], [0.036, 0], [0.038, 0.01], [0.038, 0.17], [0.03, 0.2], [0.015, 0.22], [0.015, 0.24], [0, 0.24]].map(([r, y]) => new THREE.Vector2(r, y)), 40), mat("#f4f4f4", { transparent: true, opacity: 0.55, roughness: 0.2 }), 0.25, 0, 0);
  const botL = add(g, cyl(0.035, 0.15, 32), liqL, 0.25, 0.08, 0);
  add(g, cyl(0.016, 0.03, 20), mat(CARDINAL), 0.25, 0.25, 0);
  label(parts, "Drink side", -0.09, 0.3, 0);
  label(parts, "Plasma side, ≈ 290 mOsm/kg", 0.09, 0.3, 0);
  label(parts, "Semi-permeable membrane (water passes, solutes do not)", 0, -0.01, 0.03);
  label(parts, "Solutes: sugars (white), Na⁺ (yellow), K⁺ (violet)", -0.09, 0.12, 0);
  label(parts, "Squeeze bottle", 0.25, 0.2, 0.04);
  let t = 0, hL = 0.2, hR = 0.2;
  return {
    group: g, parts, fit: 0.75,
    update(dt, S) {
      t += dt; const D = S.drink, dPi = (D.osm - 290) / 1000 * 8.314 * 310;      // kPa, drink minus plasma
      const target = Math.max(-0.08, Math.min(0.08, dPi / 400 * 0.08));              // level difference (scaled)
      hL += (0.2 + target / 2 - hL) * Math.min(1, dt); hR += (0.2 - target / 2 - hR) * Math.min(1, dt);
      colL.scale.y = hL; colL.position.y = -0.0 + hL / 2 + 0.0; colR.scale.y = hR; colR.position.y = hR / 2;
      liqL.color.set(D.osm === 0 ? "#d9ecf7" : D.cho > 8 ? "#5c3a1f" : "#ffb347");
      const c = ions.geo.attributes.color.array, nS = Math.min(ions.n, Math.round(D.osm / 700 * ions.n));
      for (let i = 0; i < ions.n; i++) {
        const left = i < nS, plasma = !left && i < nS + Math.round(290 / 700 * ions.n), x = left ? -0.09 : 0.09;
        const h = left ? hL : hR; const on = left || plasma;
        const y = 0.02 + ((ions.a[i] + t * 0.03 * (0.5 + ions.b[i])) % 1) * (h - 0.03), r = Math.sqrt(ions.b[i]) * R * 0.85, th = ions.a[i] * 40 + t * ions.b[i];
        ions.pos.set(on ? [x + Math.cos(th) * r, y, Math.sin(th) * r] : [0, -10, 0], i * 3);
        const kind = ions.a[i]; const col = kind < 0.6 ? [1, 1, 1] : kind < 0.88 ? [1, 0.85, 0.2] : [0.7, 0.45, 1];
        c.set(col, i * 3);
      }
      ions.geo.attributes.position.needsUpdate = true; ions.geo.attributes.color.needsUpdate = true;
    },
  };
}

// 10. Under-field heating: glycol tubes under a natural-grass root zone, snow on top
function heatingModel() {
  const g = new THREE.Group(), parts = [], Lx = 1.2, Lz = 0.6;
  const gravel = add(g, box(Lx, 0.1, Lz), mat("#7d7a73", { map: noiseTex("#7d7a73", ["#5d5a54", "#9b978f"], 1500) }), 0, -0.35, 0);
  const sandM = mat("#c8b48c", { map: noiseTex("#c9b58d", ["#a8916a", "#e2d3b2"], 2500) }); const sand = shell(add(g, box(Lx, 0.3, Lz), sandM, 0, -0.15, 0), [0, 0, -0.5]);
  const sod = add(g, box(Lx, 0.02, Lz), mat("#4b3a28"), 0, 0.01, 0);
  const fg = bladeGeo(0.04, 0.003), fM = mat("#4f9a3f", { side: THREE.DoubleSide }), n = 2400, fib = new THREE.InstancedMesh(fg, fM, n), m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  for (let i = 0; i < n; i++) { q.setFromEuler(new THREE.Euler((Math.random() - 0.5) * 0.4, Math.random() * 6.3, (Math.random() - 0.5) * 0.4)); m4.compose(new THREE.Vector3((Math.random() - 0.5) * Lx, 0.02, (Math.random() - 0.5) * Lz), q, new THREE.Vector3(1, 1, 1)); fib.setMatrixAt(i, m4); }
  g.add(fib);
  const snowM = mat("#f7fbff", { roughness: 0.9, transparent: true, opacity: 0.92 }); const snow = add(g, box(Lx, 1, Lz), snowM, 0, 0.05, 0);
  const tubes = []; const tubeM = [mat("#d9472b", { roughness: 0.4 }), mat("#3f7fc1", { roughness: 0.4 })];
  for (let i = 0; i < 5; i++) { const x = -0.46 + i * 0.23; tubes.push(add(g, cyl(0.0125, Lz, 20).rotateX(Math.PI / 2), tubeM[i % 2], x, -0.15, 0)); }
  add(g, cyl(0.03, Lx, 20).rotateZ(Math.PI / 2), mat("#9a9fa5", { metalness: 0.7 }), 0, -0.15, Lz / 2 + 0.04);
  const fl = tracers(g, 400, "#ffe0a0", 0.008);
  label(parts, "Snow layer", 0.4, 0.1, 0.2);
  label(parts, "Turfgrass and thatch", -0.4, 0.04, 0.25);
  label(parts, "Sand root zone, 300 mm", -0.45, -0.15, 0.25);
  label(parts, "PEX tubes, glycol supply (red) / return (blue), 230 mm apart, 150 mm deep", -0.23, -0.15, 0.0);
  label(parts, "Supply header", 0.45, -0.15, Lz / 2 + 0.04);
  label(parts, "Gravel drainage blanket", 0.4, -0.35, 0.25);
  let depth = 0.04, t = 0, thermal = false, was = false; const sandOrig = sandM.color.clone(), sandMap = sandM.map; const SM = () => sand.material;
  return {
    group: g, parts, fit: 1.6, explodeAxis: "y",
    actions: [{ label: "Thermal camera", fn: b => { thermal = !thermal; b.setAttribute("aria-pressed", String(thermal)); } }],
    update(dt, S) {
      t += dt; const sm = S.snow, on = sm.q > 0;
      depth = Math.max(0.0, Math.min(0.12, depth + dt * 0.004 * (S.snowRate > 0 ? 1 : 0) - dt * (on ? 0.006 : 0)));
      snow.scale.y = Math.max(0.001, depth); snow.position.y = 0.02 + depth / 2; snow.visible = depth > 0.002;
      if (thermal) { thermalColor(on ? (sm.Tf + 0.5) / 2 : S.w.Ta, -10, 60, SM().color); SM().map = null; tubes.forEach((tb, i) => thermalColor(on ? sm.Tf - (i % 2) * 10 : S.w.Ta, -10, 60, tb.material.color)); }
      else { SM().color.copy(sandOrig); SM().map = sandMap; tubeM[0].color.set("#d9472b"); tubeM[1].color.set("#3f7fc1"); }
      if (thermal !== was) { SM().needsUpdate = true; was = thermal; }
      for (let i = 0; i < fl.n; i++) { fl.u[i] = (fl.u[i] + dt * (on ? 0.25 : 0)) % 1; const k = Math.floor(fl.a[i] * 5); fl.pos.set([-0.46 + k * 0.23, -0.15, (k % 2 ? 1 : -1) * (fl.u[i] - 0.5) * Lz], i * 3); }
      fl.mat.opacity = on ? 0.9 : 0; fl.geo.attributes.position.needsUpdate = true;
    },
  };
}

// ===================================================================================
// tour stops
// ===================================================================================
export const STOPS = [
  {
    id: "turf", refs: [9, 10, 11, 12], title: "Synthetic turf surface", where: "Playing surface · between the hashes", model: turfModel,
    role: "The plastic grass is made of polyethylene (the same plastic as milk jugs), held upright by sand and ground-up tires. It is dark and dry, so it soaks up sunlight and cannot cool itself by evaporating water the way real grass does. On a sunny afternoon it runs much hotter than grass.",
    specs: [["Fibre", "PE monofilament, 50–60 mm pile, 3/4\" gauge", "T"], ["Thatch", "Texturised nylon 6 or PE", "T"], ["Infill", "≈ 20 kg/m² silica sand + 10–13 kg/m² SBR crumb rubber", "T"], ["Alternatives", "Coated rubber, TPE, cork, coconut fibre", "T"], ["Solar absorptance", "≈ 0.92 (albedo 0.08); grass albedo 0.23", "T"], ["Area modelled", "7,400 m² including run-off", "A"], ["Weather", "Madison, 43.07° N; air temperature on a cosine between dawn low and 3 pm high", "A"]],
    live: S => ({ rows: [["Surface, in sun", `${f1(S.Ts.sun)} °C`], ["Surface, in stand shadow", `${f1(S.Ts.shade)} °C`], ["Natural grass, same sun", `${f1(S.Ts.grassSun)} °C`], ["Air", `${f1(S.w.Ta)} °C · ${f0(S.w.RH)} % RH`], ["Sunlight on the field", `${f0(S.w.I.glob)} W/m² · sun ${f0(Math.max(0, S.w.sun.elDeg))}° up`], ["Field in shadow now", `${f0(S.shadeFrac * 100)} %`]] }),
  },
  {
    id: "base", refs: [6, 7, 8], title: "Shock pad, impact and drainage", where: "Under the carpet · goal-line section", model: baseModel,
    role: "Under the carpet, a foam pad and a layer of gravel do two jobs: they cushion a player who hits the ground, and they let rainwater drain straight down to buried pipes so the field does not flood.",
    specs: [["Impact test", `ASTM F1936 with F355-A missile: 9.1 kg, 129 cm², 0.61 m drop${cite(6, 7)}`, "S"], ["G-max limits", `ASTM F1936 maximum 200 g; NFL and Synthetic Turf Council guideline about 165 g${cite(6, 8)}`, "S"], ["Shock pad", "Closed-cell PE/PP foam or bonded rubber, 10–25 mm", "T"], ["Stone base", "150 mm open-graded aggregate", "T"], ["Drains", "100 mm perforated pipe, slit drains every 6–10 m", "T"], ["Infiltration, new field", "> 250 mm/h (10 in/h)", "T"], ["Surface model", "Hyperfoam spring + dashpot, stiffening with age and cold", "A"]],
    live: S => ({ rows: [["G-max now", `${f0(S.gm.g)} g ${S.gm.g < 165 ? "· under the 165 g guideline" : S.gm.g < 200 ? "· over the 165 g guideline" : "· over the ASTM 200 g maximum"}`], ["Peak crush of surface", `${f1(S.gm.xmax * 1000)} mm`], ["Missile rebound", `${f0(S.gm.rebound * 100)} % of impact speed`], ["Rainfall now", `${f0(S.W.rain)} mm/h`], ["Drainage capacity", `${f0(S.dr.cap)} mm/h`], ["Status", S.dr.ponding ? "Ponding: rain exceeds capacity" : S.W.rain > 0 ? "Draining, no surface water" : "Dry"]] }),
  },
  {
    id: "ball", refs: [16], title: "The football", where: "In the quarterback's hands", model: ballModel,
    role: "A leather cover, a stitched lining and a rubber bag (the bladder) holding about 3.7 litres of air. The pressure inside drops when the ball gets colder (the 2015 \"Deflategate\" question), and air slowly leaks out through the rubber.",
    specs: [["Size (NCAA/NFL)", "Long axis 11–11.25 in; long circ. 28–28.5 in; short circ. 21–21.25 in", "S"], ["Weight", "14–15 oz (397–425 g)", "S"], ["Inflation", "12.5–13.5 psi gauge", "S"], ["Skin", "Chrome-tanned cowhide, pebbled, tack finish; youth balls PU composite", "T"], ["Lining", "3-ply cotton/polyester, latex laminated", "T"], ["Bladder", "Butyl (IIR) or natural latex, ≈ 1 mm", "T"], ["Geometry", `Lemon of revolution: 2a = ${f0(BALL.a * 2000)} mm, 2b = ${f0(BALL.b * 2000)} mm, V = ${f2(BALL.V * 1000)} L`, "A"]],
    live: S => ({ rows: [["Inflated in locker room", `${f2(S.ball.pg0)} psi at ${f1(S.ball.Tin)} °C`], ["Ball temperature now", `${f1(S.ball.Tball)} °C (→ ${f1(S.ball.th.Teq)} °C)`], ["Gauge pressure now", `${f2(S.ball.pgNow)} psi ${S.ball.pgNow < 12.5 ? "· below 12.5" : S.ball.pgNow > 13.5 ? "· above 13.5" : "· in range"}`], ["Thermal time constant", `${f1(S.ball.th.tau / 60)} min`], ["Diffusion loss", `${f3(S.ball.perm.perDay)} psi/day (${BLADDERS[S.ball.bladder].name})`], ["O₂ in the ball after 60 days", `${f1(S.ball.perm.pts.at(-1).yO2 * 100)} %`]] }),
  },
  {
    id: "pass", refs: [17], title: "The spiral pass", where: "Quarterback to receiver", model: passModel,
    role: "A good spiral spins around its long axis like a top, which keeps its nose pointed forward so the air pushes back less. As the ball curves downward, the spin makes the nose lag slightly to one side, so the pass drifts a little sideways.",
    specs: [["Release speed", "22–27 m/s (50–60 mph)", "T"], ["Spin", "8–12 rev/s", "T"], ["Drag coefficient", "≈ 0.05–0.15 nose-on, 0.6–0.9 side-on", "T"], ["Model C_D", `C_D = ${AERO.Cd0} + ${f2(AERO.Cd90 - AERO.Cd0)} sin²α`, "A"], ["Side-force slope", `C_Nα = ${AERO.CNa}/rad, pitching C_Mα = ${AERO.CMa}/rad`, "A"], ["Spin inertia", `I_x = ${BALL.Ix} kg·m²`, "T"], ["Thrower", "Right-handed, clockwise spin seen from behind", "A"]],
    live: S => ({ rows: [["Range (ground)", `${f1(S.fl.range)} m = ${f1(S.fl.range / 0.9144)} yd`], ["In a vacuum", `${f1(S.fl.vacRange)} m`], ["Hang time", `${f2(S.fl.tof)} s · apex ${f1(S.fl.apex)} m`], ["Sideways drift", `${f2(S.fl.drift)} m ${S.fl.drift >= 0 ? "right" : "left"}`], ["Air density", `${f3(S.fl.rho)} kg/m³`], ["Peak yaw of repose", `${f1(S.fl.maxAlpha * 180 / Math.PI)}°`]] }),
  },
  {
    id: "helmet", refs: [13, 14, 15], title: "Helmet", where: "Linebacker meets ball carrier", model: helmetModel,
    role: "A hard plastic shell spreads a hit over a wide area; the soft padding underneath squashes to slow the head down over a longer distance and time. The padding is stiffer when hit faster and when it is cold.",
    specs: [["Shell", "Polycarbonate (or PC/ABS), 3–4 mm, T_g ≈ 147 °C", "T"], ["Liner options", "EPP or vinyl-nitrile foam; TPU lattice or cone columns", "T"], ["Facemask", "Coated carbon steel or titanium", "T"], ["Certification", `NOCSAE ND002 drop test, Severity Index < 1200${cite(13)}`, "S"], ["Headform", "≈ 4.9 kg (medium)", "A"], ["Contact model", "Patch grows with crush; shell flexes in series (0.45 MN/m)", "A"]],
    live: S => ({ rows: [["Impact speed", `${f1(S.hel.v)} m/s · ${f0(S.hel.res.KE)} J`], ["Peak deceleration", `${f0(S.hel.res.g)} g`], ["HIC₁₅", f0(S.hel.res.hic)], ["Severity Index", `${f0(S.hel.res.SI)} ${S.hel.res.SI < 1200 ? "(< 1200)" : "(≥ 1200, fails ND002 level)"}`], ["Liner crush", `${f0(S.hel.res.strain * 100)} % of ${f0((LINERS[S.hel.liner].H || 0) * 1000)} mm${S.hel.res.bottom ? " · bottomed out" : ""}`], ["Pulse duration", `${f1(S.hel.res.dur)} ms`]] }),
  },
  {
    id: "cleats", refs: [15], title: "Cleats and shoes", where: "Receiver's cut at the numbers", model: cleatModel,
    role: "The cushioning in a shoe is plastic full of tiny bubbles. How stiff it feels depends on the plastic and how many bubbles it has; how bouncy it feels depends on how much energy it turns into heat each step. Studs dig into the turf so a player can change direction.",
    specs: [["Midsole", "EVA 0.15–0.25 g/cm³; e-TPU beads; PEBA (racing)", "T"], ["Stud plate", "TPU or nylon, moulded studs 10–15 mm", "T"], ["Upper", "Knit polyester / TPU film", "T"], ["Heel-strike load", "≈ 2.5 × body weight on 80 cm²", "A"], ["Cut model", "6 m/s approach, 0.25 s stance, mean vertical force 2 BW", "A"], ["Traction", "Peak translational μ 1.0–1.3; rotational torque 30–45 N·m", "T"]],
    live: S => ({ rows: [["Foam modulus", `${f2(S.shoe.mid.E / 1e6)} MPa (${FOAMS[S.shoe.foam].name})`], ["Energy returned", `${f0(S.shoe.mid.ret * 100)} %`], ["Midsole strain at heel strike", `${f0(S.shoe.mid.strain * 100)} %`], ["Friction a cut needs", `μ = ${f2(S.shoe.cut.mu)} (${f0(S.pass.cut)}° cut)`], ["Friction the surface gives", `μ = ${f2(S.shoe.trac.mu)}${S.shoe.cut.mu > S.shoe.trac.mu ? " · foot slips" : " · grips"}`], ["Rotational torque", `${f0(S.shoe.trac.rot)} N·m`]] }),
  },
  {
    id: "uniform", refs: [18], title: "Uniform fabrics", where: "Shoulder of a lineman", model: uniformModel,
    role: "Sweat only cools you if it evaporates. A good undershirt pulls sweat away from the skin and spreads it thin so it can evaporate; the pads block much of the chest, so vapour has to escape around them. Cotton soaks up sweat and holds it instead.",
    specs: [["Jersey", "Polyester mesh knit, hydrophilic finish", "T"], ["Base layer", "Nylon or polyester with spandex", "T"], ["Pads", "PE/EVA foam under PC/ABS shell", "T"], ["Moisture regain (65 % RH)", "Polyester 0.4 %, nylon 4 %, cotton 8.5 %", "T"], ["Wicking model", "Lucas–Washburn, effective pore radius 1–2 µm", "A"], ["Skin temperature", "33–36 °C", "T"]],
    live: S => ({ rows: [["Fabric", FABRICS[S.fab.key].name], ["Wicked in 60 s", `${f1(S.fab.w.h60 * 100)} cm`], ["Capillary rise limit", `${f1(S.fab.w.jurin)} m`], ["Water held when soaked", `${f2(FABRICS[S.fab.key].hold)} g per g fabric`], ["Evaporation from a wet jersey", `${f0(S.fab.ev.m * 3.6e6)} g/m²·h`], ["Its cooling power", `${f0(S.fab.ev.m * latent(33))} W/m²`]] }),
  },
  {
    id: "player", refs: [19, 23, 24], title: "The player's heat balance", where: `${"Offensive lineman"} on the field`, model: playerModel,
    role: "A big lineman in full pads makes several hundred watts of heat, like a few old light bulbs. In hot, humid weather the pads keep sweat from evaporating, so heat builds up and body temperature climbs. The body controls this a bit like a thermostat.",
    specs: [["Body", "Lineman 140 kg, 1.93 m; receiver 90 kg, 1.85 m", "A"], ["Metabolic rate", "90 (standing) / 200 (game average) / 480 (drills) W/m²", "T"], ["Full uniform", "I_cl 1.3 clo, R_e,cl 0.035 m²·kPa/W", "T"], ["Movement factor", "0.6 on clothing resistances (ISO 9920 pumping)", "A"], ["Sweat controller", "Gain 1.2 L/h per °C above 36.9 °C, max 2.5 L/h", "A"], ["Sweat composition", "Na⁺ 40, K⁺ 5 mmol/L", "T"]],
    live: S => ({ rows: [["Core temperature", `${f2(S.pl.Tc)} °C ${S.pl.Tc >= 40 ? "· heat-illness danger" : S.pl.Tc >= 39 ? "· high" : ""}`], ["Sweat rate", `${f2(S.pl.SW)} L/h`], ["Evaporation needed / possible", `${f0(S.pl.Ereq)} / ${f0(S.pl.Emax)} W/m²`], ["Heat stored", `${f0(S.pl.S)} W`], ["Body mass lost", `${f2(S.pl.lossPct)} %`], ["WBGT", `${f1(S.wb.wbgt)} °C`]] }),
  },
  {
    id: "drink", refs: [19, 20, 21, 22], title: "Hydration and sports drinks", where: "Sideline cooler", model: drinkModel,
    role: "A drink only helps once it leaves the stomach and crosses into the body. Water moves toward the side with more dissolved particles, so how much sugar and salt a drink contains decides how fast water and energy get in. Salt replaces what sweat carries away.",
    specs: [["Sports drink", "6 % carbohydrate (sucrose + glucose), Na⁺ 20, K⁺ 3 mmol/L", "T"], ["ORS (WHO 2002)", `Glucose 75, Na⁺ 75, K⁺ 20, Cl⁻ 65, citrate 10 mmol/L = 245 mOsm/L${cite(22)}`, "S"], ["Plasma", "285–295 mOsm/kg", "T"], ["Gastric emptying", "Water half-time 15 min; caloric drinks ≤ 3 kcal/min", "A"], ["Sodium model", `Edelman: [Na]p = 1.11 (Na_e + K_e)/TBW − 25.6${cite(20)}`, "T"], ["Body water", "60 % of body mass", "A"]],
    live: S => ({ rows: [["Drink", DRINKS[S.P.drink].name], ["Osmolality", `${f0(S.drink.osm)} mOsm/kg (${S.drink.osm < 270 ? "hypotonic" : S.drink.osm <= 310 ? "isotonic" : "hypertonic"})`], ["Drinking", `${f0(S.P.drinkRate)} mL/h`], ["Absorbed so far", `${f2(S.plAbs)} L of ${f2(S.plDrunk)} L`], ["Plasma sodium", `${f1(S.pl.Na)} mmol/L`], ["Carbohydrate absorbed", `${f0(S.plCho)} g`]] }),
  },
  {
    id: "heating", refs: [25], title: "Under-field heating (natural-grass option)", where: "Below the root zone", model: heatingModel,
    role: "Some cold-climate stadiums with real grass bury pipes carrying warm fluid under the field to keep the grass growing and the snow off. This stop is a design exercise for a Madison November; artificial-turf fields like this one are cleared by plough instead.",
    specs: [["Tubes", "PEX, 25 mm, 230 mm apart, 150 mm deep", "A"], ["Fluid", "40 % propylene glycol, c_p ≈ 3.7 kJ/kg·K, 10 K drop", "T"], ["Heat source", "Gas-fired boiler, 90 % efficient", "A"], ["Method", "ASHRAE snow-melt load, surface held at 0.5 °C, fully clear", "S"], ["Snow density", "10 : 1 snow to water", "T"], ["Area", "7,400 m²", "A"]],
    live: S => ({ rows: [["Mode", S.snow.design ? `Off now (air ${f1(S.w.Ta)} °C); design case at −5 °C shown` : "Running: air below 3 °C"], ["Snowfall", `${f1(S.snowRate)} cm/h`], ["Heat flux needed", `${f0(S.snow.q)} W/m²`], ["Whole field", `${f2(S.snow.Q / 1e6)} MW`], ["Glycol temperature needed", `${f0(S.snow.Tf)} °C`], ["Glycol flow", `${f0(S.snow.flow)} kg/s`], ["Natural gas burned", `${f0(S.snow.gas)} kg/h`]] }),
  },
];

// ---------- equations at work (live numbers) ----------
const TH = {
  turf: S => { const F = S.flux, s = SURF.rubber;
    return [
      eq(["CBE 326"], String.raw`(1-a)\,S + \varepsilon L_\downarrow = \varepsilon\sigma T_s^4 + h\,(T_s - T_a) + \lambda E + k_d\,(T_s - \bar T_a)`, `Surface energy balance, solved for T<sub>s</sub> through the day with heat capacity ${f0(SURF[S.surf].C / 1000)} kJ/m²K. Now: absorbed sun ${f0(F.sw)}, sky ${f0(F.lwIn)} W/m² in; emitted ${f0(F.lwOut)}, convection ${f0(F.conv)}, evaporation ${f0(F.LE)}, into ground ${f0(F.gnd)} W/m² out.`),
      eq(["CBE 326"], String.raw`L_\downarrow = \varepsilon_{\mathrm{sky}}\,\sigma T_a^4,\qquad \varepsilon_{\mathrm{sky}} = 1.24\left(\dfrac{p_v}{T_a}\right)^{1/7}\left(1 + 0.22\,c^2\right)`, `Brutsaert's clear-sky emissivity with a cloud correction: ε<sub>a</sub> = ${f3(S.w.sky.eps)}, so the sky radiates like a black body at ${f1(S.w.sky.Tsky)} °C.`),
      eq(["CBE 426", "CBE 311"], String.raw`\lambda E = \lambda\,\rho_a\,\dfrac{q_s - q_a}{r_a + r_s}`, `Evaporation is what keeps grass cool: with stomatal resistance r<sub>s</sub> = 70 s/m it carries away heat and holds grass at ${f1(S.Ts.grassSun)} °C. Crumb-rubber turf has no water to lose (r<sub>s</sub> → ∞).`),
      eq(["CBE 430"], String.raw`R = e^{-kt},\qquad k = k_{\mathrm{ref}}\exp\!\left[-\dfrac{E_a}{R}\left(\dfrac{1}{T} - \dfrac{1}{T_{\mathrm{ref}}}\right)\right]`, `UV photo-oxidation of PE fibre, first order with Arrhenius temperature dependence (E<sub>a</sub> 50 kJ/mol assumed). At today's mean surface temperature the fibre would lose half its strength in ${f1(S.fib.half)} seasons.`),
      eq(["CBE 250"], String.raw`N_{\mathrm{tires}} = \dfrac{m''_{\mathrm{infill}}\,A}{y_{\mathrm{crumb}}}`, `Mass balance: 13.4 kg/m² of rubber over 7,400 m² at about 5 kg of crumb recovered per passenger tire is ${f0(13.4 * 7400 / 5)} tires per field.`),
      eq(["CBE 440", "CBE 540"], String.raw`T_m(\mathrm{PE}) \approx 130\,{}^\circ\mathrm{C},\qquad T_g(\mathrm{PE}) \approx -120\,{}^\circ\mathrm{C}`, "Polyethylene is semicrystalline: far below its melting point at 70 °C but far above its glass transition, so the fibre stays flexible in a Wisconsin December and creeps (lays flat) when hot."),
    ]; },
  base: S => { const gm = S.gm, dr = S.dr;
    return [
      eq(["CBE 320"], String.raw`m\ddot x = mg - A\,\sigma(\varepsilon,\dot\varepsilon),\qquad G_{\max} = \dfrac{\max F}{mg}`, `Newton's second law for the 9.1 kg missile landing at ${f2(gm.v0)} m/s; the surface is integrated step by step until the missile rebounds. Peak ${f0(gm.g)} g.`),
      eq(["CBE 440", "CBE 540"], String.raw`\sigma = \dfrac{E\,\varepsilon}{\left(1 - \varepsilon/\varepsilon_D\right)^2} + \eta\,\dot\varepsilon`, `Layer ${f0(gm.H * 1000)} mm thick, modulus ${f2(gm.E / 1e6)} MPa: stiffens as infill compacts with age and as rubber cools (≈ 1.2 %/°C here). It densifies sharply near ε<sub>D</sub>, which is why a thin, packed surface gives high G-max.`),
      eq(["CBE 320"], String.raw`q = -K\,\dfrac{dh}{dz},\qquad K_{\mathrm{eq}} = \dfrac{\sum_i L_i}{\sum_i L_i/K_i}`, `Darcy's law through the layers in series (${dr.layers.map(l => `${l[0].split(" (")[0].toLowerCase()} ${(l[2] * 3.6e6).toFixed(0)} mm/h`).join(", ")}). The tightest layer controls: K<sub>eq</sub> = ${(dr.Keq * 3.6e6).toFixed(0)} mm/h.`),
      eq(["CBE 250"], String.raw`P = I + Q_{\mathrm{runoff}} + \dfrac{dS}{dt}`, `Water balance on the field: rain ${f0(S.W.rain)} mm/h, infiltration ${f0(Math.min(S.W.rain, dr.cap))} mm/h, runoff ${f0(dr.runoff)} mm/h. Over the field that is ${f1(Math.min(S.W.rain, dr.cap) / 1000 * 7400 / 3600 * 1000)} L/s to the drains.`),
    ]; },
  ball: S => { const b = S.ball, Pa = P_ATM / PSI, B = BLADDERS[b.bladder];
    return [
      eq(["CBE 310"], String.raw`\dfrac{p_g + p_{\mathrm{atm}}}{T} = \text{const}\quad (V,\ n\ \text{fixed})`, `Ideal gas at constant volume, using absolute pressure: (${f2(b.pg0)} + ${f2(Pa)}) psi × ${f1(K(b.Tball))}/${f1(K(b.Tin))} K − ${f2(Pa)} = ${f2(b.pgNow)} psi. Deflategate check: 12.5 psi at 71 °F falls to ${f2((12.5 + 14.7) * 282.0 / 294.8 - 14.7)} psi at 48 °F.`),
      eq(["CBE 326"], String.raw`mc\,\dfrac{dT}{dt} = hA\,(T_\infty - T) + \alpha\,S A_p,\qquad \tau = \dfrac{mc}{hA}`, `Lumped capacitance: Nu = 2 + (0.4Re<sup>½</sup> + 0.06Re<sup>⅔</sup>)Pr<sup>0.4</sup> gives h = ${f1(b.th.h)} W/m²K, τ = ${f1(b.th.tau / 60)} min. ${S.W.rain > 0 ? `In rain the wet skin heads for the wet-bulb temperature, ${f1(b.th.Tinf)} °C, which lowers the pressure further.` : "A wet ball would head for the wet-bulb temperature instead."}`),
      eq(["CBE 426"], String.raw`N_i = \dfrac{\mathcal{P}_i\,A\,\left(p_{i,\mathrm{in}} - p_{i,\mathrm{out}}\right)}{\delta},\qquad \mathcal{P} = D\,S`, `Solution–diffusion through the ${B.name.toLowerCase()} bladder (${f1(B.d * 1000)} mm): permeability = diffusivity × solubility. P(O₂) = ${B.O2}, P(N₂) = ${B.N2} Barrer at 25 °C → ${f3(b.perm.perDay)} psi/day.`),
      eq(["CBE 311", "CBE 426"], String.raw`\alpha_{\mathrm{O_2/N_2}} = \dfrac{\mathcal{P}_{\mathrm{O_2}}}{\mathcal{P}_{\mathrm{N_2}}}`, `Selectivity ${f1(B.O2 / B.N2)}: oxygen leaves faster than nitrogen, so the air left inside is enriched in N₂ (${f1(b.perm.pts.at(-1).yO2 * 100)} % O₂ after 60 days).`),
      eq(["CBE 320"], String.raw`\theta_{\mathrm{lag}} = \dfrac{\delta^2}{6D}`, `Time for a steady diffusion profile to set up across the membrane: ${b.perm.lagH < 1 ? f0(b.perm.lagH * 60) + " min" : f1(b.perm.lagH) + " h"} for N₂ in this bladder.`),
      eq(["CBE 430", "CBE 560"], String.raw`T_s(t) = T_{s,0} + \Delta T_s\left(1 - e^{-kt}\right)`, "Chrome tanning: basic chromium(III) sulfate cross-links the carboxyl groups of collagen, raising the hide's shrinkage temperature from about 60 °C to above 100 °C. Illustrative first-order uptake in the drum; vegetable tanning reaches only 75–85 °C."),
    ]; },
  pass: S => { const F = S.flF, fl = S.fl;
    return [
      eq(["CBE 320"], String.raw`m\,\dfrac{d\mathbf{v}}{dt} = m\mathbf{g} - \tfrac12\rho v^2 A\,C_D(\alpha)\,\hat{\mathbf{v}} + \mathbf{F}_N + \mathbf{F}_M`, `Integrated with RK4. At release the drag is ${f2(F.drag)} N against a weight of ${f2(F.weight)} N; the pass loses ${f1(fl.vacRange - fl.range)} m compared with the vacuum parabola.`),
      eq(["CBE 311"], String.raw`\rho = \dfrac{p_d M_d + p_v M_w}{RT}`, `Moist air is an ideal-gas mixture: water (18 g/mol) displaces heavier air (29 g/mol), so humid air is lighter. Now ρ = ${f3(fl.rho)} kg/m³ at Madison's ${f1(P_ATM)} kPa.`),
      eq(["CBE 320"], String.raw`\mathrm{Re} = \dfrac{\rho v d}{\mu}`, `Re = ${(fl.Re / 1e5).toFixed(1)}×10⁵ at release, near the drag-crisis range where surface texture (the pebbling and laces) matters.`),
      eq(["CBE 320"], String.raw`\alpha = \dfrac{I_x\,\omega\,|\dot\gamma|}{\tfrac12\rho v^2 A L\,C_{M\alpha}},\qquad \dot\gamma = \dfrac{g\cos\gamma}{v}`, `Yaw of repose: the spin angular momentum ${f3(BALL.Ix * 2 * Math.PI * S.pass.spin)} kg·m²/s precesses to follow the curving path, leaving the nose ${f1(F.alpha * 180 / Math.PI)}° to the right at the apex. The side force C<sub>Nα</sub>α moves the ball ${f2(fl.drift)} m.`),
      eq(["CBE 320"], String.raw`F_M = \tfrac12\rho v^2 A\,C_{\mathrm{Ls}}\,S\sin\alpha,\qquad S = \dfrac{\omega b}{v}`, `Magnus force from spin about the long axis acting on the crossflow v sin α: about ${f0(F.magnus * 1000)} mN near the apex (${f1(F.magnus / F.weight * 100)} % of the weight), pointing up for this spin and yaw. It is larger for a wobbly ball or a kicked end-over-end ball.`),
    ]; },
  helmet: S => { const H = S.hel.res, L = LINERS[S.hel.liner];
    return [
      eq(["CBE 320"], String.raw`\tfrac12 mv^2 = \int F\,dx,\qquad F_{\mathrm{peak}} \ge \dfrac{\tfrac12 mv^2}{x_{\max}}`, `${f0(H.KE)} J must be absorbed in the ${f0(H.xmax * 1000)} mm of travel available. The flatter the force–distance curve, the lower the peak: ${f0(H.g)} g here.`),
      eq(["CBE 440"], String.raw`\sigma = \sigma_p\left[\tanh\dfrac{\varepsilon}{\varepsilon_y} + \beta\,\dfrac{(\varepsilon/\varepsilon_D)^3}{1 - \varepsilon/\varepsilon_D}\right]`, `Crushable-foam law (Gibson–Ashby shape): elastic rise, long plateau, then densification near ε<sub>D</sub> = ${L.eD ?? "–"}. Crush reached ${f0(H.strain * 100)} %.`),
      eq(["CBE 540"], String.raw`\sigma_p = \sigma_0\left[1 + C\ln\!\left(1 + \dot\varepsilon/\dot\varepsilon_0\right)\right]e^{-\kappa(T-20)}`, `Viscoelastic polymers are stiffer at high strain rate and low temperature (time–temperature superposition). C = ${L.C ?? 0}, κ = ${L.kap ?? 0}/°C. At ${f1(S.w.Ta)} °C the liner is ${f0((Math.exp(-(L.kap || 0) * (S.w.Ta - 20)) - 1) * 100)} % stiffer than at 20 °C.`),
      eq(["CBE 320"], String.raw`\mathrm{HIC} = \max\left[(t_2 - t_1)\left(\dfrac{\int_{t_1}^{t_2} a\,dt}{t_2 - t_1}\right)^{2.5}\right],\qquad \mathrm{SI} = \int a^{2.5}\,dt`, `Head Injury Criterion over windows up to 15 ms: ${f0(H.hic)} (window ${f1(H.win[0])}–${f1(H.win[1])} ms). NOCSAE Severity Index ${f0(H.SI)}; the drop-test limit is 1200.`),
      eq(["CBE 440"], String.raw`T_g(\mathrm{PC}) \approx 147\,{}^\circ\mathrm{C},\qquad \text{notched Izod} \approx 600\text{–}900\,\mathrm{J/m}`, "Polycarbonate stays glassy and tough over the whole playing range; its amorphous chains yield and draw rather than shatter, which is why the shell spreads the load instead of cracking."),
      eq(["CBE 250"], String.raw`e_{\mathrm{abs}} = 1 - \left(\dfrac{v_{\mathrm{out}}}{v_{\mathrm{in}}}\right)^2`, `Energy balance on the impact: ${f0(H.eAbs * 100)} % of the kinetic energy is dissipated as heat in the liner; the rest returns as rebound.`),
    ]; },
  cleats: S => { const m = S.shoe.mid, F = FOAMS[S.shoe.foam];
    return [
      eq(["CBE 440"], String.raw`\dfrac{E^*}{E_s} = \left(\dfrac{\rho^*}{\rho_s}\right)^2`, `Gibson–Ashby scaling for open-cell foams: ${F.name} at ${F.rho} kg/m³ from a ${F.rhoS} kg/m³ solid of ${f0(F.Es / 1e6)} MPa gives E* = ${f2(m.E / 1e6)} MPa.`),
      eq(["CBE 540"], String.raw`e = \exp\!\left(\dfrac{-\pi\zeta}{\sqrt{1-\zeta^2}}\right),\qquad \zeta \approx \dfrac{\tan\delta}{2},\qquad \text{energy return} = e^2`, `With tan δ = ${F.tand}, the foam returns ${f0(m.ret * 100)} % of the energy of each footstrike. EVA ≈ 60 %, e-TPU ≈ 75 %, PEBA ≈ 85 %.`),
      eq(["CBE 320"], String.raw`\mu_{\mathrm{req}} = \dfrac{m\,\Delta v}{t_c\,F_z},\qquad \Delta v = 2v\sin\dfrac{\theta}{2}`, `Momentum change of a ${f0(S.pass.cut)}° cut at 6 m/s: Δv = ${f2(S.shoe.cut.dv)} m/s in 0.25 s needs μ = ${f2(S.shoe.cut.mu)}; the surface gives ${f2(S.shoe.trac.mu)}.`),
      eq(["CBE 540"], String.raw`E(T) \approx E_{20}\,e^{-k_T(T-20)}`, `Cold stiffens the foam and the outsole rubber as they approach their glass transitions: at ${f1(S.w.Ta)} °C the midsole is ${f0((Math.exp(-F.kT * (S.w.Ta - 20)) - 1) * 100)} % stiffer.`),
    ]; },
  uniform: S => { const w = S.fab.w, F = FABRICS[S.fab.key];
    return [
      eq(["CBE 547"], String.raw`\Delta p = \dfrac{2\gamma\cos\theta}{r}`, `Young–Laplace capillary suction in the yarn gaps: γ = 68.5 mN/m for sweat, contact angle ${F.theta}°, effective pore radius ${f1(F.r * 1e6)} µm → ${f1(2 * 0.0685 * Math.cos(F.theta * Math.PI / 180) / F.r / 1000)} kPa.`),
      eq(["CBE 320", "CBE 547"], String.raw`h^2 = \dfrac{r\gamma\cos\theta}{2\mu}\,t`, `Lucas–Washburn wicking: viscous flow driven by capillary pressure. μ = ${(w.mu * 1000).toFixed(2)} mPa·s at skin temperature → ${f1(w.h60 * 100)} cm in 60 s.`),
      eq(["CBE 426"], String.raw`\dot m_{\mathrm{evap}} = h_m\left(\rho_{v,s} - \rho_{v,\infty}\right),\qquad h_m = \dfrac{h}{\rho\,c_p\,\mathrm{Le}^{2/3}}`, `Chilton–Colburn analogy: h = ${f1(S.fab.ev.h)} W/m²K gives h<sub>m</sub> = ${(S.fab.ev.hm * 1000).toFixed(1)} mm/s. Vapour density ${(S.fab.ev.rvs * 1000).toFixed(1)} g/m³ at the wet fabric vs ${(S.fab.ev.rva * 1000).toFixed(1)} g/m³ in the air.`),
      eq(["CBE 310"], String.raw`q = \lambda\,\dot m_{\mathrm{evap}},\qquad \lambda(33\,{}^\circ\mathrm{C}) = ${f0(latent(33) / 1000)}\,\mathrm{kJ/kg}`, `Latent heat is what cools: ${f0(S.fab.ev.m * latent(33))} W/m² from a fully wet jersey surface. Sweat that drips off cools nothing.`),
      eq(["CBE 311"], String.raw`\text{regain} = \dfrac{m_{\mathrm{water}}}{m_{\mathrm{dry}}}\ \text{at 65\,\% RH}`, `Sorption equilibrium: cotton's hydroxyl groups bind water (8.5 %), polyester's ester groups barely do (0.4 %), so polyester leaves the water in the pores where it can wick and evaporate.`),
    ]; },
  player: S => { const o = S.pl;
    return [
      eq(["CBE 326"], String.raw`S = M - (C + R) - E - C_{\mathrm{res}} - E_{\mathrm{res}}`, `Per m² of skin (A<sub>D</sub> = ${f2(o.A)} m²): M = ${f0(o.M)}, C + R = ${f0(o.CR)}, respiration ${f0(o.res)}, evaporation ${f0(o.E)} W/m². Stored: ${f0(o.S)} W.`),
      eq(["CBE 326"], String.raw`C + R = \dfrac{T_{\mathrm{sk}} - T_o}{I_{\mathrm{cl}} + 1/(f_{\mathrm{cl}}\,h)}`, `Operative temperature ${f1(o.To)} °C combines air at ${f1(S.w.Ta)} °C with a mean radiant temperature of ${f1(o.Tmrt)} °C from sun and sky. Above skin temperature the body gains heat instead of losing it.`),
      eq(["CBE 426"], String.raw`E_{\max} = \dfrac{p_{\mathrm{sat}}(T_{\mathrm{sk}}) - p_a}{R_{e,\mathrm{cl}} + 1/(f_{\mathrm{cl}}\,h_e)},\qquad h_e = 16.5\,h_c`, `Lewis relation links mass and heat transfer. Vapour pressure ${f2(psat(35))} kPa at the skin vs ${f2(S.w.pv)} kPa in the air limits evaporation to ${f0(o.Emax)} W/m²; the body needs ${f0(o.Ereq)}.`),
      eq(["CBE 470"], String.raw`\mathit{SW} = K_p\,(T_c - T_{\mathrm{set}}),\qquad m\,c_b\,\dfrac{dT_c}{dt} = A_{\mathrm{Du}}\,S`, `Proportional control has a steady-state offset: the harder the work, the higher the core temperature must sit to drive enough sweat. Now ${f2(o.Tc)} °C, sweating ${f2(o.SW)} L/h.`),
      eq(["CBE 311"], String.raw`\mathrm{WBGT} = 0.7\,T_{\mathrm{nwb}} + 0.2\,T_g + 0.1\,T_a`, `Psychrometric wet bulb ${f1(S.wb.Tw)} °C (from p<sub>v</sub> = p<sub>sat</sub>(T<sub>w</sub>) − γp(T − T<sub>w</sub>)), black globe ${f1(S.wb.Tg)} °C → WBGT ${f1(S.wb.wbgt)} °C. Many athletic heat policies restrict full-pad practice above about 28–30 °C.`),
      eq(["CBE 560"], String.raw`\mathrm{C_6H_{12}O_6} + 6\,\mathrm{O_2} \rightarrow 6\,\mathrm{CO_2} + 6\,\mathrm{H_2O},\qquad \Delta H \approx -2.8\,\mathrm{MJ/mol}`, `Metabolic heat comes from oxidising fuel: ${f0(o.M * o.A)} W is about ${f0(o.M * o.A / 2.8e6 * 180 * 3600)} g of glucose-equivalent per hour, and muscle is only about 20–25 % efficient.`),
    ]; },
  drink: S => { const D = S.drink;
    return [
      eq(["CBE 311"], String.raw`\mathrm{Osm} = \sum_j i_j\,c_j`, `Colligative count of dissolved particles: ${D.parts.length ? D.parts.map(([n, c]) => `${n} ${f0(c * 1000)}`).join(" + ") : "none"} = ${f0(D.osm)} mOsm/kg (ideal, dilute).`),
      eq(["CBE 311"], String.raw`\Pi = cRT`, `van 't Hoff osmotic pressure difference against plasma (290 mOsm/kg) at 37 °C: ${f0((D.osm - 290) / 1000 * 8.314 * 310)} kPa. Water moves toward the higher osmolality, so a hypertonic drink first pulls water into the gut.`),
      eq(["CBE 430"], String.raw`\dfrac{dV_s}{dt} = -\min\!\left(kV_s,\ \dfrac{R_E}{\epsilon_d}\right)`, `Gastric emptying: first order for water (t<sub>½</sub> 15 min), capped at about 3 kcal/min for energy-dense drinks (ε = ${f2(D.cho * 0.04)} kcal/mL). Illustrative model.`),
      eq(["CBE 560"], String.raw`v = \dfrac{V_{\max}\,[\mathrm{G}]}{K_m + [\mathrm{G}]}`, "Glucose crosses the gut wall on the SGLT1 co-transporter with Na⁺, a saturable carrier: intake beyond about 1 g/min of glucose alone is not absorbed. Mixing in fructose (GLUT5) raises the ceiling."),
      eq(["CBE 250"], String.raw`\Delta N_{\mathrm{Na}} = V_{\mathrm{abs}}\,c_{\mathrm{Na,drink}} - V_{\mathrm{sweat}}\,c_{\mathrm{Na,sweat}}`, `Sodium and water balances on the body, closed with the Edelman relation: plasma Na⁺ now ${f1(S.pl.Na)} mmol/L. Drinking plain water beyond sweat losses dilutes it (hyponatremia below 135).`),
    ]; },
  heating: S => { const s = S.snow;
    return [
      ...(s.design ? [eq(["CBE 450"], "Design case", `The air is above 3 °C, so the system is off. The numbers below are the design case: −5 °C, 80 % RH, overcast, the design snowfall of ${f1(S.snowRate)} cm/h and today's wind.`)] : []),
      eq(["CBE 326"], String.raw`q_o = q_s + q_m + A_r\,(q_h + q_e)`, `ASHRAE snow-melting load: warm the snow ${f0(s.qs)}, melt it ${f0(s.qm)}, plus convection and radiation ${f0(s.qh)} and evaporation ${f0(s.qe)} W/m² from the wet surface = ${f0(s.q)} W/m².`),
      eq(["CBE 320"], String.raw`q' = k\,S\,\Delta T,\qquad \dfrac{S}{L} = \dfrac{2\pi}{\ln\!\left[\dfrac{2s}{\pi D}\sinh\dfrac{2\pi d}{s}\right]}`, `Conduction shape factor for a row of buried tubes: S/L = ${f2(s.SL)}, so ${f2(s.UA)} W/m²K between glycol and surface. The glycol must run at ${f0(s.Tf)} °C.`),
      eq(["CBE 450"], String.raw`Q = \dot m\,c_p\,\Delta T`, `Sizing the loop: ${f2(s.Q / 1e6)} MW over 7,400 m² with a 10 K glycol drop needs ${f0(s.flow)} kg/s of 40 % propylene glycol (${f0(s.flow / 1.04 * 3.6)} m³/h).`),
      eq(["CBE 310"], String.raw`\dot m_{\mathrm{gas}} = \dfrac{Q}{\eta\,\mathrm{LHV}}`, `A 90 %-efficient boiler burning natural gas (LHV 50 MJ/kg) uses ${f0(s.gas)} kg/h, the same gas the natural-gas pipeline digital twin delivers.`),
      eq(["CBE 470"], String.raw`T_{\mathrm{supply}} = T_0 - K_r\,(T_a - T_{a,0})`, "Outdoor-reset control raises the supply temperature as the air cools, with a PI loop trimming it on measured surface temperature. The root zone's slow thermal response (hours) makes feed-forward on the weather forecast worthwhile."),
    ]; },
};
STOPS.forEach(s => s.thermo = TH[s.id]);

// ---------- course map: topic → stop ----------
export const COURSE_MAP = [
  ["CBE 250", "Crumb-rubber mass balance: tires per field", "turf"],
  ["CBE 250", "Field water balance: rain, infiltration, runoff", "base"],
  ["CBE 250", "Sodium and water balances on the athlete", "drink"],
  ["CBE 310", "Ideal gas at constant volume: the Deflategate calculation", "ball"],
  ["CBE 310", "Latent heat and evaporative cooling", "uniform"],
  ["CBE 310", "Combustion: boiler gas for field heating", "heating"],
  ["CBE 311", "Moist air as an ideal-gas mixture; air density", "pass"],
  ["CBE 311", "Psychrometrics: wet bulb and WBGT", "player"],
  ["CBE 311", "Osmolality and osmotic pressure (colligative properties)", "drink"],
  ["CBE 311", "Gas solubility and O₂/N₂ selectivity in rubber", "ball"],
  ["CBE 320", "Darcy flow through layered media", "base"],
  ["CBE 320", "Drag, Reynolds number, gyroscopic yaw and Magnus force", "pass"],
  ["CBE 320", "Capillary flow: Lucas–Washburn wicking", "uniform"],
  ["CBE 320", "Diffusion time lag; conduction shape factors", "heating"],
  ["CBE 326", "Surface radiation balance: why turf gets hot", "turf"],
  ["CBE 326", "Lumped-capacitance cooling of the ball", "ball"],
  ["CBE 326", "Human heat balance: convection, radiation, evaporation", "player"],
  ["CBE 326", "Snow-melt load and buried-tube heat transfer", "heating"],
  ["CBE 426", "Solution–diffusion permeation through the bladder", "ball"],
  ["CBE 426", "Evaporation by the heat–mass transfer analogy", "uniform"],
  ["CBE 426", "Evaporative limit E_max and the Lewis relation", "player"],
  ["CBE 430", "First-order UV degradation with Arrhenius kinetics", "turf"],
  ["CBE 430", "Gastric emptying as first-order kinetics", "drink"],
  ["CBE 440", "Foam mechanics: Gibson–Ashby scaling", "cleats"],
  ["CBE 440", "Crushable-foam liners and the polycarbonate shell", "helmet"],
  ["CBE 440", "Impact attenuation and G-max of the surface", "base"],
  ["CBE 450", "Sizing a glycol heating loop", "heating"],
  ["CBE 470", "Thermoregulation as proportional control", "player"],
  ["CBE 470", "Outdoor-reset and PI control of field heating", "heating"],
  ["CBE 540", "Viscoelasticity, strain rate and temperature", "helmet"],
  ["CBE 540", "Loss tangent and energy return of midsoles", "cleats"],
  ["CBE 540", "Polyethylene fibre: T_g and T_m", "turf"],
  ["CBE 547", "Young–Laplace capillary pressure, contact angle and wetting", "uniform"],
  ["CBE 560", "Collagen cross-linking in leather tanning", "ball"],
  ["CBE 560", "Glucose transport (Michaelis–Menten, SGLT1)", "drink"],
  ["CBE 560", "Metabolic heat from substrate oxidation", "player"],
];

// ===================================================================================
// detail viewer: its own renderer, cutaway clipping, exploded view, numbered callouts
// ===================================================================================
export class DetailViewer {
  constructor(host) {
    this.host = host;
    this.canvas = host.querySelector("canvas");
    this.callouts = host.querySelector(".callouts");
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true; this.renderer.localClippingEnabled = true;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color("#ffffff");
    this.scene.environment = new THREE.PMREMGenerator(this.renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    const sun = new THREE.DirectionalLight("#ffffff", 1.6); sun.position.set(6, 10, 8); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    this.sun = sun; this.scene.add(sun, new THREE.HemisphereLight("#dfe8f0", "#3a3530", 0.6));
    this.floor = new THREE.Mesh(new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: "#eeeeee", roughness: 0.95 }));
    this.floor.receiveShadow = true; this.scene.add(this.floor);
    this.grid = new THREE.GridHelper(2, 20, "#cfcfcf", "#e2e2e2"); this.scene.add(this.grid);
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
    // exploded view: shells lift off (or follow their own vector); other top-level pieces slide apart along the model axis
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
    this.focusT = null;
    this.open = true; this.resize();
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
