import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { buildWorld, AT, inferno } from "./body3d.js";
import { Body, P, bloodVisc, poiseuille, liverCL, caffeineCLlin, sat, O2content, organHeat, bedGas, heatBalance, skinLocalT, ORGAN_MASS, THERMO_SCENARIOS, thermoRun } from "./sim.js";
import { REFS } from "./refs.js";
import { COURSES, FEATURES, FAMILIES, courseUrl } from "./courses.js";
import { SETUPS, applySetup } from "./ps.js";
import { equations, PARAMS, METHOD, ASSUMPTIONS, texNorm } from "./model.js";
import { RESEARCH, CENTERS } from "./research.js";

const $ = id => document.getElementById(id);
// KaTeX placeholders: MI = inline math, MD = display math; typeset() renders them (see the KaTeX block below)
const setH = (el, h) => { if (el && el.__h !== h) { el.__h = h; el.innerHTML = h; } };   // rewrite only when content changes (no blinking)
// One shared helper for symbols written in plain text (x_y, Greek letters, p₁): turns each into an inline KaTeX placeholder,
// so a symbol looks the same in prose, tables, live lines and equations. Chemical formulas and units (CO₂, m³, µm) stay text;
// HTML tags and <code> are left alone. sym = true also typesets lone single letters (for the Symbol column).
const GREEK_TEX = { "α": "\\alpha", "β": "\\beta", "γ": "\\gamma", "δ": "\\delta", "ε": "\\varepsilon", "θ": "\\theta", "λ": "\\lambda", "μ": "\\mu", "π": "\\pi", "ρ": "\\rho", "σ": "\\sigma", "τ": "\\tau", "φ": "\\varphi", "ω": "\\omega", "Δ": "\\Delta", "Ω": "\\Omega" };
const SUBDIG = { "₀": "0", "₁": "1", "₂": "2", "₃": "3" };
const CHEM = /^([A-Za-z]*?)(CO₂|O₂|H₂O)$/;
const symTex = tok => {
  let m = tok.match(/^([A-Za-z]{1,3}|[αβγδεθλμπρστφωΔΩ]̇?)(?:_(.+))?$/); if (!m) return null;
  let base = m[1]; base = base.replace(/^([αβγδεθλμπρστφωΔΩ])(̇?)$/, (_, g, d) => d ? `\\dot${GREEK_TEX[g]}` : GREEK_TEX[g]);
  if (!m[2]) return base;
  const sub = m[2].replace(/^\{|\}$/g, ""), c = sub.match(CHEM);
  if (c) return c[1] ? `${base}_{${c[1]}}\\mathrm{${c[2].replace("₂", "_2")}}` : `${base}_{\\mathrm{${c[2].replace(/₂/g, "_2")}}}`;
  return `${base}_{${sub}}`;
};
function mathify(html, sym = false) {
  const RULES = [
    [/(?<![\w\\{])((?:[A-Za-z]{1,3}|[αβγδεθλμπρστφωΔΩ]̇?)_(?:\{[^}]*\}|[A-Za-z0-9]+(?:,[A-Za-z0-9]+)*(?:CO₂|O₂|H₂O)?|CO₂|O₂|H₂O))(?![\w₀-₉])/g, t => { const x = symTex(t); return x ? MI(x) : t; }],
    [/(?<![\w])(p[₁₂₃]|SV₀|TBW₀|MAP₀|CO₀|D[₁₂])(?![\w])/g, t => MI(t.replace(/^(.+?)([₀₁₂₃])$/, (_, b, d) => `${b}_${SUBDIG[d]}`))],
    [/(?<![\w\\])([αβγδεθλμπρστφωΔΩ]̇?)(?![\wα-ω])/g, t => MI(symTex(t))],
  ];
  if (sym) RULES.push([/(?<![\w\\])([A-Za-z])(?![\w])/g, t => MI(t)]);
  let out = String(html);
  for (const [re, f] of RULES)   // each rule sees only plain text: tags, <code> and placeholders made by earlier rules are skipped
    out = out.split(/(<code>[\s\S]*?<\/code>|<span class="tx"[^>]*><\/span>|<[^>]+>)/).map((part, i) => (i % 2 ? part : part.replace(re, f))).join("");
  return out;
}
const MI = tex => `<span class="tx" data-tex-i="${encodeURIComponent(tex)}"></span>`;
const MD = tex => `<div class="lc-tex" data-tex="${encodeURIComponent(tex)}"></div>`;
const TN = v => String(v).replace(/,/g, "{,}").replace(/−/g, "-");   // a number inside TeX
const KATEX = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js";
let katexP = null;
const loadKatex = () => katexP ??= new Promise(res => { if (window.katex) return res(window.katex); const sc = document.createElement("script"); sc.src = KATEX; sc.onload = () => res(window.katex); sc.onerror = () => res(null); document.head.appendChild(sc); });
// All math is KaTeX HTML with the KaTeX fonts (inlined katex.css, fonts at katex-fonts/). If the fonts fail to load, fall back to MathML.
const KOPT = { output: "html" };
const texCache = new Map();
function texHTML(tex, display = false) {
  const key = KOPT.output + (display ? "D" : "I") + tex;
  if (texCache.has(key)) return texCache.get(key);
  let h; try { h = window.katex.renderToString(texNorm(tex, display), { displayMode: display, output: KOPT.output, throwOnError: false }); } catch (err) { h = null; }
  if (h != null) texCache.set(key, h);
  return h;
}
function typeset(root = document.body, force = false) {
  const run = k => {
    root.querySelectorAll("[data-tex],[data-tex-i]").forEach(el => {
      if (el.dataset.txDone === KOPT.output && !force) return;
      const display = el.hasAttribute("data-tex"), tex = decodeURIComponent(display ? el.dataset.tex : el.dataset.texI);
      const h = k ? texHTML(tex, display) : null;
      if (h == null) el.textContent = tex; else { el.innerHTML = h; el.dataset.txDone = KOPT.output; }
    });
  };
  if (window.katex) run(window.katex); else loadKatex().then(run);
}
new MutationObserver(muts => { for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1 && (n.matches("[data-tex],[data-tex-i]") || n.querySelector("[data-tex],[data-tex-i]"))) { if (!n.closest("details:not([open])")) typeset(n.parentElement || n); } }).observe(document.body, { childList: true, subtree: true });
const fontsOK = (document.fonts ? Promise.race([document.fonts.load("1em KaTeX_Main").then(() => document.fonts.check("1em KaTeX_Main")), new Promise(r => setTimeout(() => r(false), 8000))]) : Promise.resolve(false));
fontsOK.then(ok => { window.__katexFonts = ok; if (!ok) { KOPT.output = "mathml"; typeset(document.body, true); } });
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const HRMAX = 208 - 0.7 * P.age;
// ---------- temperature units: °C or °F (model works in °C; only the display changes) ----------
const U = { f: false }; try { U.f = localStorage.getItem("body-units") === "F"; } catch (e) {}
const tU = () => (U.f ? "°F" : "°C");
const tV = (c, d = 1) => (U.f ? c * 1.8 + 32 : c).toFixed(d);          // a temperature
const tT = (c, d = 1) => `${tV(c, d)} ${tU()}`;
const tDv = (dc, d = 1) => (U.f ? dc * 1.8 : dc).toFixed(d);          // a temperature change or rate
const tD = (dc, d = 1, per = "") => `${tDv(dc, d)} ${tU()}${per}`;

// ---------- references (numbered in order of first appearance in this list) ----------
const REFNUM = {}; REFS.forEach((r, i) => REFNUM[r.id] = i + 1);
$("refs").innerHTML = REFS.map((r, i) => `<li id="ref-${i + 1}">${r.text}${r.url ? ` <a href="${r.url}" target="_blank" rel="noopener">Link ↗</a>` : ""}</li>`).join("");
const R = (...ids) => `<sup class="refsup">${ids.map(id => { const k = REFNUM[id]; if (!k) console.warn("missing ref", id); return `<a href="#ref-${k}" class="ref" data-ref="${k}">${k}</a>`; }).join(",")}</sup>`;

// ---------- courses ----------
const COURSE = {
  250: ["Balances", "Process Synthesis"], 255: ["Modeling", "Introduction to Chemical Process Modeling"],
  310: ["Thermo", "Chemical Process Thermodynamics"], 320: ["Transport", "Introductory Transport Phenomena"],
  326: ["Fluids & Heat", "Momentum and Heat Transfer Operations"], 426: ["Mass Transfer", "Mass Transfer Operations"],
  430: ["Kinetics & Reactors", "Chemical Kinetics and Reactor Design"], 470: ["Control", "Process Dynamics and Control"],
  560: ["Biochem", "Biochemical Engineering"],
};
const esc = s => s.replace(/&/g, "&amp;");
const courseLink = n => `<a class="course" href="https://guide.wisc.edu/search/?P=CBE%20${n}" target="_blank" rel="noopener" title="CBE ${n}: ${COURSE[n][1]}">${esc(COURSE[n][0])} ↗</a>`;
document.querySelectorAll("a.course[data-c]").forEach(a => { a.outerHTML = courseLink(+a.dataset.c); });

// ---------- model ----------
const body = new Body({ act: "rest", tdb: 22, rh: 50, alt: 0 });
const hist = [];                                 // [t, Tc, G, C]
function record() { hist.push([body.t, body.now.th.t_core, body.glucose, body.caffeineC, body.y[2], body.y[4] / P.tmaxG, Math.min(body.now.circ.HR, 208 - 0.7 * P.age)]); if (hist.length > 2000) hist.shift(); }
// the strip opens filled: the six hours before 08:00 show the model's resting starting state (its initial steady state), drawn dashed
const RATE0 = "2";   // default speed: 1 real second = 2 simulated minutes: a meal response (rise, peak, return, ~2-3 h) plays in ~1-1.5 real minutes; the 6-hour strip turns over in 3 min
const AUTO_MEAL = { at: 15, g: 75, on: true };   // the standard meal the twin eats by itself
function autoMeal() { if (AUTO_MEAL.on && body.t >= AUTO_MEAL.at && !body.events.some(e => e[1] === "meal")) body.eat(AUTO_MEAL.g); }
function prefill() { if (!hist.length || hist[0][0] > 0) return; const q = hist[0]; for (let t = -10; t >= -360; t -= 10) hist.unshift([t, ...q.slice(1)]); }
record(); prefill();
const clockStr = t => { const m = Math.round(480 + t) % 1440; return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; };
const dayStr = t => (480 + t >= 1440 ? ` (day ${Math.floor((480 + t) / 1440) + 1})` : "");
const f1 = x => x.toFixed(1), f0 = x => x.toFixed(0);

// ---------- renderer / scene (1 unit = 1 cm) ----------
const stage = $("stage");
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
// quality tier (Part H): phones and slow frames get no AO/bloom, a smaller shadow map and pixel ratio 1
const PHONE = matchMedia("(max-width: 860px)").matches || matchMedia("(pointer: coarse)").matches;
const Q = { high: !PHONE, pr: Math.min(devicePixelRatio, PHONE ? 1.5 : 2) };
renderer.setPixelRatio(Q.pr);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.prepend(renderer.domElement);
const scene = new THREE.Scene();
{ // soft neutral studio backdrop: light gray at the top, slightly darker toward the floor
  const c = document.createElement("canvas"); c.width = 4; c.height = 256; const g = c.getContext("2d"), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, "#e9ecef"); gr.addColorStop(0.55, "#d7dbe0"); gr.addColorStop(1, "#b7bdc4"); g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; scene.background = t; }
scene.fog = new THREE.Fog("#c9ced4", 700, 2400);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
scene.environmentIntensity = 0.45;
const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 6000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
scene.add(new THREE.HemisphereLight("#e8f0f8", "#3a3430", 0.45));
const key = new THREE.DirectionalLight("#fff4e6", 2.2); key.position.set(80, 220, 160); key.castShadow = true;
key.shadow.mapSize.set(PHONE ? 1024 : 2048, PHONE ? 1024 : 2048); Object.assign(key.shadow.camera, { left: -75, right: 75, top: 110, bottom: -100, near: 60, far: 420 });
key.shadow.bias = -0.0004; key.shadow.normalBias = 0.6; key.shadow.radius = 4;
scene.add(key, key.target);
const fill = new THREE.DirectionalLight("#9cc4ff", 0.7); fill.position.set(-150, 80, -60); scene.add(fill);
const W = buildWorld(scene);

// ---------- views / zoom ladder ----------
const A = AT;
const VIEWS = {
  body: { p: [62, 112, 400], c: [0, 89, 0], label: "Overview", skin: 0.42 },
  organs: { p: [40, 118, 132], c: [0, 108, 0], label: "Organs · skin made see-through", skin: 0.08 },
  rbc: { p: [A.rbc.x + 30, A.rbc.y + 95, 215], c: [A.rbc.x, A.rbc.y - 4, 0], label: "Red blood cell · cut open" },
};
let tween = null, viewName = "body";
function goTo(name, instant = false) {
  const v = VIEWS[name]; viewName = name;
  document.querySelectorAll("[data-view]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.view === name)));
  $("zoomlabel").textContent = heatMode && v.skin != null ? `${v.label.split(" · ")[0]} · thermal camera` : v.label;
  if (v.skin != null) W.skinMat.uniforms.uOpacity.value = heatMode ? Math.max(v.skin, 0.55) : v.skin;
  const to = { p: new THREE.Vector3(...v.p), c: new THREE.Vector3(...v.c) };
  if (name === "body" && document.body.classList.contains("fac-on") && innerWidth > 860) { to.p.x += 50; to.c.x += 50; }   // body left of the factory diagram
  if (name === "rbc" && innerWidth <= 860) { to.p.sub(to.c).multiplyScalar(1.7).add(to.c); to.c.y -= 30; to.p.y -= 30; }   // phones: smaller cell, above the caption
  if (instant || matchMedia("(prefers-reduced-motion: reduce)").matches) { tween = null; camera.position.copy(to.p); controls.target.copy(to.c); controls.update(); return; }
  tween = { from: { p: camera.position.clone(), c: controls.target.clone() }, to, t0: performance.now(), dur: 1500 };
}
document.querySelectorAll("[data-view]").forEach(b => b.onclick = () => goTo(b.dataset.view));

// heat view: skin coloured by skin temperature
let heatMode = false;
// ---------- thermal camera: local skin temperature on every vertex, organs glowing by the heat they make ----------
const TH = { lo: 24, hi: 38, bg: null, dark: new THREE.Color("#0b0d12") };
const thermRef = (() => {   // reference radius so the mean convection coefficient over the skin equals the model's h_c
  let sum = 0, n = 0; for (const m of W.skinParts) { const a = m.geometry.attributes.arad.array; for (const r of a) { sum += Math.pow(Math.max(r, 0.3), -0.4); n++; } }
  return Math.pow(sum / n, -1 / 0.4); })();
const ORG_GLOW = () => [[W.organs.brain, "brain", ORGAN_MASS.brain], [W.organs.heart, "heart", ORGAN_MASS.heart], [W.organs.liver, "liver", ORGAN_MASS.liver],
  [W.organs.kidneyR, "kidneys", ORGAN_MASS.kidneys], [W.organs.stomach, "residual", ORGAN_MASS.residual], [W.organs.smallInt, "residual", ORGAN_MASS.residual], [W.organs.largeInt, "residual", ORGAN_MASS.residual]];
function updateThermal() {
  if (!heatMode) return;
  const n = N(); let sum = 0, cnt = 0;
  const parts = W.skinParts.map(m => { const a = m.geometry.attributes.arad.array, T = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) { T[i] = skinLocalT(n, Math.max(a[i], 0.3), thermRef); sum += T[i]; cnt++; } return T; });
  const shift = n.th.t_skin - sum / cnt;   // calibrate: the average equals the model's mean skin temperature
  TH.range = [Math.min(...parts.map(T => Math.min(...T))) + shift, Math.max(...parts.map(T => Math.max(...T))) + shift];
  // auto-range like a thermal camera: span the coldest to warmest skin, at least 4 °C wide, in whole degrees
  const lo = Math.floor(TH.range[0] - 0.5), hi = Math.max(lo + 4, Math.ceil(TH.range[1] + 0.5));
  if (lo !== TH.lo || hi !== TH.hi) { TH.lo = lo; TH.hi = hi; drawThermBar(); }
  W.skinParts.forEach((m, k) => { const T = parts[k], c = m.geometry.attributes.color;
    for (let i = 0; i < T.length; i++) { inferno((T[i] + shift - TH.lo) / (TH.hi - TH.lo), col); c.setXYZ(i, col.r, col.g, col.b); } c.needsUpdate = true; });
  const H = organHeat(n), glow = (mat, wkg) => { const u = Math.min(1, Math.max(0, Math.log10(wkg / 0.3) / 2)); inferno(0.15 + 0.85 * u, mat.emissive); mat.emissiveIntensity = 0.25 + 1.2 * u; };
  for (const [m, key, kg] of ORG_GLOW()) glow(m.material, H[key] / kg);
  glow(W.muscleMat, H.muscle / ORGAN_MASS.muscle);
}
function drawThermBar() {
  const c = $("thermBar"), g = c.getContext("2d");
  for (let x = 0; x < c.width; x++) { inferno(x / (c.width - 1), col); g.fillStyle = col.getStyle(THREE.SRGBColorSpace); g.fillRect(x, 0, 1, c.height); }
  $("tl-lo").textContent = tT(TH.lo, 0); $("tl-hi").textContent = tT(TH.hi, 0);
}
function setHeat(on) {
  heatMode = on; document.body.classList.toggle("heat-on", on); $("mode-anat").setAttribute("aria-pressed", String(!on)); $("mode-heat").setAttribute("aria-pressed", String(on));
  W.skinParts.forEach(m => { m.material = on ? W.thermMat : m.userData.glass; });
  W.floor.forEach(o => { o.visible = !on; }); W.drops.visible = !on;
  if (on) { TH.bg ??= scene.background; scene.background = TH.dark; scene.fog.color.set("#0b0d12"); drawThermBar(); setFold($("sec-heat"), true); }
  else { if (TH.bg) scene.background = TH.bg; scene.fog.color.set("#c9ced4");
    for (const [m] of ORG_GLOW()) { m.material.emissive.set(0); m.material.emissiveIntensity = 0; } W.muscleMat.emissive.set("#ff3b2f"); }
  $("thermLegend").hidden = !on; HA.group.visible = on; $("ebox").hidden = !on; $("heatLabels").hidden = !on; if (on) { heatArrows(); refreshEbox(); }
  goTo(viewName, true); updateThermal();
  $("zoomlabel").textContent = on ? "Thermal camera · skin by temperature, organs by heat made" : VIEWS[viewName].label;
}
$("mode-anat").onclick = () => setHeat(false); $("mode-heat").onclick = () => setHeat(true);

// ---------- Part M: heat view arrows (sized by live watts) and the energy-balance box ----------
const HA = (() => {
  const group = new THREE.Group(); group.visible = false; W.body.add(group);
  const mk = color => { const g = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.92, depthTest: false, toneMapped: false });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 18), mat), head = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 22), mat);
    shaft.renderOrder = head.renderOrder = 30; g.add(shaft, head); group.add(g); return { g, shaft, head }; };
  const defs = [["rad", "#ffd166", [-28, 126, 0], [-1, 0.12, 0], "Radiation"], ["rad2", "#ffd166", [28, 126, 0], [1, 0.12, 0], null],
    ["conv", "#8fd3ff", [-15, 149, -1], [-0.25, 1, 0], "Convection"], ["evap", "#7ee0c8", [15, 96, 6], [1, 0.25, 0.5], "Evaporation (sweat)"],
    ["breath", "#c9b8ff", [0, 156.5, 10.5], [-0.35, 0.05, 1], "Breathing"], ["cond", "#bdbdbd", [-9, 0.5, 8], [0, -1, 0.25], "Conduction"]];
  const arrows = {}; defs.forEach(([k, c, p, d, l]) => { arrows[k] = { ...mk(c), p: new THREE.Vector3(...p), d: new THREE.Vector3(...d).normalize(), label: l, color: c }; });
  const core = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), new THREE.MeshBasicMaterial({ color: "#ff6a3d", transparent: true, opacity: 0.5, depthTest: false, toneMapped: false }));
  core.renderOrder = 29; core.position.set(0, 112, 1); group.add(core);
  return { group, arrows, core };
})();
const _up = new THREE.Vector3(0, 1, 0);
function setArrow(a, watts, minLen = 8) {
  const mag = Math.abs(watts), L = Math.min(70, minLen + 0.3 * mag), r = 0.45 + 0.09 * Math.sqrt(mag), hl = Math.min(L * 0.45, 3 + r * 2.2);
  const dir = a.d.clone(); let start = a.p.clone();
  if (watts < 0) { start = a.p.clone().addScaledVector(dir, L); dir.negate(); }   // heat gained from hot surroundings: arrow points into the body
  a.g.position.copy(start); a.g.quaternion.setFromUnitVectors(_up, dir);
  a.shaft.scale.set(r, L - hl, r); a.shaft.position.y = (L - hl) / 2; a.head.scale.set(r * 2.3, hl, r * 2.3); a.head.position.y = L - hl / 2;
  a.tip = (watts < 0 ? start : start.clone().addScaledVector(dir, L + 5));
}
function heatLoss() {   // dry loss split into radiation and convection by h_r : h_c (same operative-temperature driving force)
  const n = N(), B = heatBalance(n), th = n.th, fr = th.h_cc != null ? th.h_r / (th.h_r + th.h_cc) : 0.5;
  return { n, B, rad: B.dry * fr, conv: B.dry * (1 - fr), evap: B.evap, breath: B.breath };
}
function heatArrows() {
  const L = heatLoss(); HA.L = L;
  setArrow(HA.arrows.rad, L.rad / 2); setArrow(HA.arrows.rad2, L.rad / 2); setArrow(HA.arrows.conv, L.conv);
  setArrow(HA.arrows.evap, L.evap); setArrow(HA.arrows.breath, L.breath); setArrow(HA.arrows.cond, 0, 5);
  HA.core.scale.setScalar(2.5 + 0.5 * Math.sqrt(Math.max(L.B.M, 0)));
}
const HL = { el: $("heatLabels"), items: {} };
["core", "rad", "conv", "evap", "breath", "cond"].forEach(k => { const d = document.createElement("div"); d.className = "hl hl-" + k; HL.el.appendChild(d); HL.items[k] = d; });
function placeHeatLabels(w, h) {
  const rects = [];
  if (!heatMode || !HA.L) return rects;
  const L = HA.L, wv = v => `${Math.round(Math.abs(v))} W${v < -0.5 ? " in" : ""}`;
  const txt = { core: `Generated inside: ${Math.round(L.B.M)} W`, rad: `Radiation ${wv(L.rad)}`, conv: `Convection ${wv(L.conv)}`, evap: `Evaporation ${wv(L.evap)}`, breath: `Breathing ${wv(L.breath)}`, cond: "Conduction: not modeled (small)" };
  for (const k in HL.items) {
    const at = k === "core" ? new THREE.Vector3(-40, 104, 0) : HA.arrows[k].tip; if (!at) continue;
    _v.copy(at).project(camera); const el = HL.items[k];
    const vis = _v.z < 1 && Math.abs(_v.x) < 1 && Math.abs(_v.y) < 1; el.style.display = vis ? "" : "none";
    if (vis) { el.style.left = `${(_v.x + 1) / 2 * w}px`; el.style.top = `${(1 - _v.y) / 2 * h}px`; }
    if (el.textContent !== txt[k]) el.textContent = txt[k];
    if (vis) rects.push({ x: (_v.x + 1) / 2 * w, y: (1 - _v.y) / 2 * h, hw: el.offsetWidth / 2 + 18, hh: el.offsetHeight / 2 + 18 });
  }
  return rects;
}
function refreshEbox() {
  const L = heatLoss(), B = L.B, n = L.n, r0 = v => Math.round(v), sg = v => (v >= 0 ? "+" : "−") + Math.abs(r0(v));
  if (n.th.h_cc == null) { setH($("ebox"), `<h4>Energy balance</h4><p class="eb-wait">Losses appear after the first simulated minute.</p>`); return; }
  const rows = [["Radiation", L.rad, "#ffd166"], ["Convection", L.conv, "#8fd3ff"], ["Evaporation", L.evap, "#7ee0c8"], ["Breathing", L.breath, "#c9b8ff"]];
  const mx = Math.max(B.M, ...rows.map(r => Math.abs(r[1])), 1);
  setH($("ebox"), `<h4>Energy balance <small>live</small></h4>
    <div class="eb-box eb-in"><span>Generation <small>(metabolism)</small></span><b>${r0(B.M)} W</b></div>
    <div class="eb-ar" aria-hidden="true">▼</div>
    <div class="eb-box eb-core"><span>Body core <b>${tT(n.th.t_core)}</b></span><span>Storage <b>${sg(B.S)} W</b></span><small>core changes ${B.dTdt >= 0 ? "+" : "−"}${tD(Math.abs(B.dTdt), 2, "/h")}</small></div>
    <div class="eb-ar" aria-hidden="true">▼</div>
    <div class="eb-box eb-out"><span>Losses</span>${rows.map(([nm, v, c]) => `<div class="eb-row"><i style="background:${c};width:${(Math.abs(v) / mx * 100).toFixed(0)}%"></i><em>${nm}</em><b>${v < -0.5 ? "gain " : ""}${Math.abs(r0(v))} W</b></div>`).join("")}
      <div class="eb-row"><i style="background:#bdbdbd;width:0"></i><em>Conduction</em><b class="tag-assumed">not modeled</b></div></div>
    <p class="eb-eq">${MI(String.raw`S = M - (R + C + E + B)`)}</p>
    <p class="eb-ctl">Feedback: sweat and skin blood flow adjust until losses ≈ generation, so S ≈ 0.</p>`);
}

// ---------- Part M: User guide overlay, pop-out information panel ----------
$("guideBody").innerHTML = `
  <p class="g-what">A live model of one healthy body run as a chemical plant. Every number comes from equations you can open in <b>∑ Model</b>.</p>
  <p class="disclaimer"><b>Disclaimer:</b> This is for educational purposes only. This digital twin is based on a combination of public data, scientific publications and fictionalized settings.</p>
  <h4>How to explore</h4><ul>
    <li>🧍 <b>Overview</b> (bottom bar): the whole body, all spots numbered.</li>
    <li>🔴 Click a <b>numbered spot</b> or its row in the spots list to zoom in and learn.</li>
    <li>🖱️ Drag to orbit · scroll or pinch to zoom · right-drag to pan.</li>
    <li>🔍 Bottom bar: <b>Overview</b>, <b>Organs</b> (skin see-through) and <b>Red blood cell</b> (one cell, labelled, carrying oxygen).</li></ul>
  <h4>Buttons</h4><ul>
    <li><b>Anatomy view</b> / <b>Heat view</b>: glass body, or a thermal camera with heat arrows and the energy balance.</li>
    <li><b>°C / °F</b>: temperature units.</li>
    <li><b>∑ Model</b>: all equations, parameters, method and validation.</li>
    <li><b>Circulation map</b>: oxygen and CO₂ flow through lungs, heart and organs.</li>
    <li><b>Thermo Lab</b>: heat made vs heat lost, with temperature control on and off.</li>
    <li><b>Body | Factory</b>: the body drawn as a chemical plant flowsheet; hover a unit to find its organ.</li>
    <li><b>Links to Research</b>: UW–Madison CBE faculty working on related topics.</li>
    <li><b>Links to Courses</b>: where each CBE course appears here, with problem sets.</li>
    <li><b>Real world</b>: why this matters for medicine.</li>
    <li><b>Conditions</b>: open the activity, weather, food and drink controls.</li>
    <li>Subject buttons (<b>Balances</b> … <b>Biochem</b>): guided tours of one course topic.</li>
    <li><b>Pause</b> / <b>Speed</b>: run the simulated day.</li>
    <li><b>⤢</b>: pop the side panel out as a floating window (<b>⤡</b> docks it).</li></ul>
  <h4>Change conditions</h4><ul>
    <li>Pick <b>Rest</b>, <b>Walk</b>, <b>Jog</b> or <b>Marathon</b>; set air temperature, humidity and altitude.</li>
    <li><b>Meal</b>: the twin eats a standard 75 g meal at 08:15 by itself; the strip below shows blood sugar, insulin and gut absorption, with an arrow at the meal.</li>
    <li>Drink water or take caffeine under <b>Food, drink and caffeine</b>.</li>
    <li>Watch heart rate, core temperature, sweat, blood sugar and caffeine in <b>Your body right now</b>.</li>
    <li>Open <b>Thermo Lab</b> to switch the body's temperature control off.</li></ul>
  <h4>Equations, courses, problems</h4><ul>
    <li><b>∑ Model</b>: equations; <b>Links to Courses</b>: courses and problem sets; <b>References</b>: sources (bottom of the side panel).</li></ul>`;
const guide = $("guidePanel");
const setGuide = on => { guide.hidden = !on; $("btnGuide").setAttribute("aria-expanded", String(on)); if (on) $("guideClose").focus(); };
try { if (localStorage.getItem("twin-guide-seen") === "1") $("btnGuide").classList.add("seen"); } catch (e) {}
$("btnGuide").onclick = () => { $("btnGuide").classList.add("seen"); try { localStorage.setItem("twin-guide-seen", "1"); } catch (e) {} setGuide(guide.hidden); }; $("guideClose").onclick = () => setGuide(false);
document.addEventListener("keydown", e => { if (e.key === "Escape" && !guide.hidden) setGuide(false); });
const asideEl = document.querySelector("aside");
function setPop(on) {
  if (on && matchMedia("(max-width: 860px)").matches) on = false;
  document.body.classList.toggle("popped", on);
  const b = $("btnPop"); b.textContent = on ? "⤡" : "⤢"; b.title = on ? "Dock the panel back" : "Pop out this panel as a floating window"; b.setAttribute("aria-pressed", String(on));
  if (on) { const wd = Math.min(620, innerWidth - 40); Object.assign(asideEl.style, { width: `${wd}px`, height: `${Math.round(innerHeight * 0.8)}px`, left: `${innerWidth - wd - 24}px`, top: `${Math.round(innerHeight * 0.1)}px` }); }
  else asideEl.removeAttribute("style");
  try { localStorage.setItem("body-pop", on ? "1" : "0"); } catch (e) {}
}
$("btnPop").onclick = () => setPop(!document.body.classList.contains("popped"));
{ const bar = asideEl.querySelector(".pop-bar"); let drag = null;
  bar.addEventListener("pointerdown", e => { if (!document.body.classList.contains("popped") || e.target.closest("button")) return; drag = { x: e.clientX - asideEl.offsetLeft, y: e.clientY - asideEl.offsetTop }; bar.setPointerCapture(e.pointerId); });
  bar.addEventListener("pointermove", e => { if (!drag) return; asideEl.style.left = `${Math.min(innerWidth - 80, Math.max(0, e.clientX - drag.x))}px`; asideEl.style.top = `${Math.min(innerHeight - 40, Math.max(0, e.clientY - drag.y))}px`; });
  bar.addEventListener("pointerup", () => { drag = null; }); }
try { if (localStorage.getItem("body-pop") === "1") setPop(true); } catch (e) {}

// ---------- learn by subject ----------
const N = () => body.now;
const L = () => N().lung, C = () => N().circ, K = () => N().kid, T = () => N().th;
const actLabel = () => ({ rest: "resting", walk: "walking", jog: "jogging", run: "marathon pace" })[body.cfg.act];
const LENSES = [
  { n: 250, stops: [{
    view: "body", beacon: [0, 158, 9], panel: "sec-live",
    title: "Balances: what goes in must come out",
    text: "In: oxygen and food. Out: CO₂, water and heat. Any mismatch is stored: extra heat warms you, missing water makes you thirsty.",
    plain: "In − out = what builds up inside.",
    eq: MD(String.raw`\dfrac{dE}{dt} = \dot M_{\mathrm{food}} - \dot Q_{\mathrm{heat}} - \dot W,\qquad \dfrac{d(\text{water})}{dt} = \text{drink} + \text{made} - \text{sweat} - \text{urine} - \text{breath}`),
    live: () => { const t = body.tot; return `Since 08:00: heat released ${f0(t.heatKJ)} kJ, food eaten ${f0(t.foodKJ)} kJ; O₂ in ${f0(t.O2L)} L, CO₂ out ${f0(t.CO2L)} L; water: drank ${t.drankL.toFixed(2)} L, sweat ${t.sweatL.toFixed(2)} L, urine ${f0(t.urineL * 1000)} mL.`; },
    why: "Doctors use balances to manage fluids; adults take in and lose about 2.5 L of water a day." + R("os-fluid"),
  }] },
  { n: 255, stops: [{
    view: "body", beacon: [7, 104, 8], panel: "sec-food",
    title: "Tracking caffeine",
    text: "Caffeine soaks from gut to blood, spreads through body water, then is removed. The model: two connected tanks, gut and body." + R("caf-rev"),
    plain: "Gut drains into blood; the blood level halves every few hours.",
    eq: MD(String.raw`\dfrac{dA_{\mathrm{gut}}}{dt} = -k_a A_{\mathrm{gut}},\qquad V\,\dfrac{dC}{dt} = k_a A_{\mathrm{gut}} - \mathit{CL}(C)\,C`),
    live: () => `Caffeine in blood ${f1(body.caffeineC)} mg/L; still in gut ${f0(body.y[5])} mg. Spread volume ${f0(P.cafVd * P.mass)} L, low-dose half-life ${P.cafHalf} h.`,
    note: "Half-life is shorter in smokers, much longer in pregnancy; the FDA cites 400 mg a day for most adults." + R("caf-rev", "fda-caf"),
    why: "Drug makers and regulators use these models to pick doses and timing." + R("pbpk"),
  }] },
  { n: 310, stops: [{
    view: "body", beacon: [-24, 100, 3], panel: "sec-act",
    title: "Sweat: cooling by evaporation",
    text: "Evaporating sweat takes heat from your skin. Humid air, already full of vapor, slows evaporation, so sweat cools less.",
    plain: "Each gram evaporated removes about 2,400 J." + R("baker2019") + " Dripping sweat does nothing.",
    eq: MD(String.raw`\dot Q_{\mathrm{evap}} = \lambda\,\dot m_{\mathrm{evap}},\ \ \lambda \approx 0.68\ \mathrm{W\,h/g},\qquad \dot E_{\max} \propto p_{\mathrm{sat}}(T_{\mathrm{skin}}) - \varphi\,p_{\mathrm{sat}}(T_{\mathrm{air}})`),
    live: () => `Making ${f0(N().sweatLmin * 60000)} mL of sweat an hour; evaporation removes ${f0(T().e_skin * P.bsa)} W. Skin wetness ${f0(T().w * 100)} % of its limit ${f0(T().w_max * 100)} %.`,
    why: "Heat illness hits about 9,237 U.S. high-school athletes a year" + R("cdc-heat") + ", who sweat 0.5–2 L an hour" + R("baker2017") + "; cold-water immersion treats heatstroke." + R("heatstroke"),
  }, {
    view: "body", beacon: [0, 120, 16], panel: "sec-heat", action: () => { if (!heatMode) setHeat(true); },
    title: "Thermal camera: heat in = heat out",
    text: "Busy organs (brain, heart, liver, kidneys, working muscle) glow warmest." + R("wang2010") + " Fingers, ears and nose lose heat fastest and show coolest.",
    plain: "Heat made − heat lost = heat stored; losses adjust so temperature barely changes.",
    eq: MD(String.raw`S = M - (C+R) - E_{\mathrm{sk}} - (E_{\mathrm{res}} + C_{\mathrm{res}}),\qquad \dfrac{dT}{dt} = \dfrac{S}{m\,c_p}`),
    live: () => { if (N().th.h_cc == null) return "Press Play: the heat losses are computed from the first simulated minute on."; const B = heatBalance(N()); return `Making ${Math.round(B.M)} W, losing ${Math.round(B.dry + B.evap + B.breath)} W → storing ${Math.round(B.S)} W (${tD(B.dTdt, 2, "/h")}). With no cooling: +${tD(B.noCool, 1, "/h")}.`; },
    why: "Thermal cameras screen for fever; engineers use the same balance to cool electronics and spacesuits.",
  }] },
  { n: 320, stops: [{
    view: "organs", beacon: [-9, 128, 6], panel: "sec-organs",
    title: "Lungs: thin air at altitude",
    text: "Oxygen moves from air sacs into blood, pushed by its partial pressure. High up, air pressure is lower, so the push is weaker." + R("west1996", "ortiz2019"),
    plain: "Air-sac O₂ push = 20.9 % × (air pressure − water vapor) − a CO₂ correction." + R("os-resp"),
    eq: MD(String.raw`P_{A}\mathrm{O_2} = F_{I}\mathrm{O_2}\,(P_B - 47) - \dfrac{P_{A}\mathrm{CO_2}}{R}\quad\text{(alveolar gas equation)}`),
    live: () => `At ${body.cfg.alt} m: air ${f0(L().Pb)} mmHg, air-sac O₂ ${f0(L().PAO2)} mmHg, CO₂ ${f0(L().PaCO2)} mmHg → blood oxygen ${f1(L().Sa * 100)} % saturated.`,
    note: "Altitude makes you breathe harder, lowering CO₂ and raising O₂ (from climbers' data)." + R("west1983"),
    why: "Altitude training, airplane cabins and lung tests all use this equation.",
  }, {
    view: "organs", beacon: [-10, 128, 7], panel: "sec-organs",
    title: "Diffusion across the air-sac wall",
    text: "O₂ crosses a wall 0.6 µm thick over about 130 m², half a tennis court." + R("hsia2016") + " At rest blood fills in a third of its trip" + R("loyola") + "; in hard exercise at altitude it rushes by too fast.",
    plain: "O₂ flow = how leaky the wall is × (O₂ push in air − in blood).",
    eq: MD(String.raw`\dot V_{\mathrm{O_2}} = D_L\,(P_{A}\mathrm{O_2} - P_{c}\mathrm{O_2})\ \ \text{(Fick’s law)},\qquad S = \dfrac{(P/P_{50})^n}{1+(P/P_{50})^n},\ \ n = 2.7,\ P_{50} = 26.8\ \mathrm{mmHg}`) + R("dash2010"),
    live: () => `Blood spends ${L().tT.toFixed(2)} s in a lung capillary; ${L().tEq != null ? `it reaches the air-sac O₂ within ${L().tEq.toFixed(2)} s` : `it leaves ${f1(L().PAO2 - L().Pa)} mmHg short of the air-sac O₂`}. O₂ diffusing capacity ${f0(L().DL)} mL/min/mmHg.`,
    why: "ECMO machines do the lungs' job, diffusing oxygen into blood across a membrane." + R("ecmo"),
  }] },
  { n: 326, stops: [{
    view: "organs", beacon: [3, 119, 7], panel: "sec-organs",
    title: "The heart: pump and pipe network",
    text: "In exercise, muscle arteries widen and take more blood. Heart output = beats per minute × blood per beat." + R("os-cv"),
    plain: "Blood splits between organs like water between open taps.",
    eq: MD(String.raw`\mathit{CO} = \mathit{HR}\times\mathit{SV} = \sum Q_{\mathrm{organ}},\qquad Q_{\mathrm{organ}} = \dfrac{\mathit{MAP}}{R_{\mathrm{organ}}}`),
    live: () => `${P.ACT[body.cfg.act].label}: ${f1(C().CO)} L/min = ${f0(C().HR)} beats/min × ${f0(C().SV)} mL. Muscles get ${f1(C().Q.muscle)} L/min (${f0(C().Q.muscle / C().CO * 100)} %), kidneys ${f1(C().Q.kidneys)}, gut ${f1(C().Q.gut)}.`,
    note: "Organ flows come from a textbook table; muscle and skin flows from the O₂ and heat models.",
    why: "This guides the design of artificial hearts, assist pumps and heart–lung machines.",
  }, {
    view: "organs", beacon: [-0.9, 112, -5.4], panel: "sec-organs",
    title: "Pipes: small narrowing, big effect",
    text: "Resistance grows with 1/radius⁴ (Hagen–Poiseuille): 16 % narrower doubles it." + R("os-cv") + " Blood gets runnier when it flows fast, as red cells line up." + R("zhou2018", "cho1991"),
    plain: "Halve the radius → 16× less flow at the same pressure.",
    eq: MD(String.raw`\Delta P = \dfrac{8\mu L Q}{\pi r^4},\qquad \mu(\dot\gamma) = \mu_\infty + (\mu_0-\mu_\infty)\left[1+(\lambda\dot\gamma)^2\right]^{(n-1)/2}\ \ \text{(Carreau)}`),
    live: () => { const pz = poiseuille(C().Q.muscle / 2 / 40, 0.0015, 0.2, 0.0035); return `Muscle vessels are ${f0((C().rad.muscle - 1) * 100)} % wider than at rest. Blood viscosity: ${(bloodVisc(1) * 1000).toFixed(1)} mPa·s when slow (1 /s), ${(bloodVisc(500) * 1000).toFixed(1)} mPa·s when fast (500 /s).`; },
    why: "That is why coronary plaque is dangerous and stents restore so much flow." + R("nhlbi-stent"),
  }, {
    view: "organs", beacon: [3, 119, 7], panel: "sec-organs", action: () => toggleCirc(true),
    title: "Circulation map: one pump, many reactors",
    text: "Blood loads O₂ in the lungs; organs use it like reactors and return CO₂. The map shows every stream live.",
    plain: "O₂ loaded in lungs = O₂ used; CO₂ made = CO₂ breathed out.",
    eq: MD(String.raw`\mathit{CO}\,(C_a - C_v) = \sum_i \dot V_{\mathrm{O_2},i},\qquad \sum_i \dot V_{\mathrm{CO_2},i} = \dfrac{\dot V_A\,P_{A}\mathrm{CO_2}}{0.863}`),
    live: () => { const G = bedGas(N()); return `O₂: ${Math.round(G.VO2)} mL/min used; CO₂: ${Math.round(G.VCO2)} mL/min made and breathed out; left-heart pump power ${G.pumpW.toFixed(1)} W.`; },
    why: "Artificial hearts, ECMO and dialysis must match these flows and gas balances.",
  }] },
  { n: 426, stops: [{
    view: "organs", beacon: [6.6, 102, -6], panel: "sec-organs",
    title: "Kidneys: filtering 180 L a day",
    text: "Kidneys filter about 180 L of plasma a day, keep 99 % of the water and make 1–2 L of urine." + R("os-kid") + " Hard exercise cuts their blood flow, so they filter less.",
    plain: "Filtered ≈ 1/5 of plasma flow; urine = filtered − taken back.",
    eq: MD(String.raw`\mathit{GFR} = \mathit{FF}\times\mathit{RPF} = \mathit{FF}\times\mathit{RBF}\,(1-\mathit{Hct}),\qquad \text{urine} = \dfrac{\text{solute load}}{U_{\mathrm{osm}}}`),
    live: () => `Kidney blood ${f1(C().Q.kidneys)} L/min → filtering ${f0(K().GFR * 1000)} mL/min (${f0(K().GFR * 1440)} L/day); ${f1(K().reabsorbed * 100)} % of the water goes back. Urine: ${f0(K().urine * 60000)} mL/h.`,
    why: "Over 808,000 Americans live with kidney failure, 68 % on dialysis" + R("niddk-stats") + ", whose machines are mass exchangers." + R("niddk-hd"),
  }, {
    view: "organs", beacon: [6.6, 102, -6], panel: "sec-organs",
    title: "Counter-current flow: concentrating urine",
    text: "Salt pumped from the loop of Henle makes deep kidney tissue very salty, up to about 1200 mOsm/kg." + R("os-kid") + " Urine passing through loses water, so a thirsty body makes little, strong urine.",
    plain: "Thirsty → ADH → less, darker urine; well watered → lots of pale urine (50–1200 mOsm/kg)." + R("medline-uosm"),
    eq: MI(String.raw`U_{\mathrm{osm}}`) + " ranges 50–1200 mOsm/kg, set by plasma osmolality:" + MD(String.raw`P_{\mathrm{osm}} = P_{\mathrm{osm},0}\,\dfrac{\mathit{TBW}_0}{\mathit{TBW}_0 - \text{deficit}}`),
    live: () => `Water deficit ${f1(body.y[8])} L → blood saltiness ${f0(K().Posm)} mOsm/kg → urine ${f0(K().Uosm)} mOsm/kg.`,
    note: "Here, urine strength rises in a straight line with blood saltiness.",
    why: "Dialysis copies this with opposite flows along hollow fibers" + R("niddk-hd") + "; Willem Kolff built the first artificial kidney in the 1940s." + R("kolff"),
  }] },
  { n: 430, stops: [{
    view: "organs", beacon: [-5, 107, 8], panel: "sec-organs",
    title: "The liver: a stirred reactor",
    text: "The liver is a stirred tank: enzymes break down caffeine, drugs and alcohol as gut blood passes. Caffeine's enzyme is slow, so little goes per pass and blood flow barely matters." + R("wellstirred", "tuloup"),
    plain: "Removed = blood flow × share removed per pass.",
    eq: MD(String.raw`\mathit{CL}_H = \dfrac{Q_H\,\mathit{CL}_{\mathrm{int}}}{Q_H+\mathit{CL}_{\mathrm{int}}},\qquad E = \dfrac{\mathit{CL}_{\mathrm{int}}}{Q_H+\mathit{CL}_{\mathrm{int}}}`),
    live: () => { const l = liverCL(body.caffeineC, N().QH, N().QH0); return `Liver blood ${f1(N().QH)} L/min; the liver clears ${f0(l.CL * 1000)} mL of blood of caffeine each minute, removing ${f1(l.E * 100)} % per pass.`; },
    why: "Liver reactor models predict doses and guide bioartificial liver design.",
  }, {
    view: "organs", beacon: [-5, 107, 8], panel: "sec-food",
    title: "Enzymes: catalysts that max out",
    text: "An enzyme's rate rises with concentration, then levels off (Michaelis–Menten)." + R("mm1913") + " In volunteers, CYP1A2 cleared 500 mg of caffeine more slowly than 250 mg." + R("caf-rev", "kaplan1997"),
    plain: "Low dose: rate ∝ amount. Huge dose: rate tops out.",
    eq: MD(String.raw`\text{rate} = \dfrac{V_{\max}\,C}{K_m + C}`),
    live: () => { const l = liverCL(body.caffeineC, N().QH, N().QH0); return `At ${f1(body.caffeineC)} mg/L the enzymes run at ${f1(body.caffeineC / (P.cafKm + body.caffeineC) * 100)} % of their top speed.`; },
    note: MI("K_m") + " = 58 mg/L (300 µM) was measured on purified CYP1A2" + R("thomas2026") + "; the whole-body value is unknown.",
    why: "It explains drug build-up at high doses and personalized dosing.",
  }] },
  { n: 470, stops: [{
    view: "body", beacon: [0, 166, 2], panel: "sec-act",
    title: "The brain: the body's orchestrator",
    text: "Your brain compares core and skin temperature with set points of 36.8 °C (98.2 °F) and 33.7 °C (92.7 °F). Too warm: vessels widen, sweat starts; too cold: they narrow, you shiver." + R("gagge1986", "ptc2020"),
    plain: "Error = temperature − set point; sweat and skin flow grow with it.",
    eq: MD(String.raw`\dot m_{\mathrm{sweat}} = 170\,\mathit{warm}_{\mathrm{body}}\,e^{\mathit{warm}_{\mathrm{skin}}/10.7},\qquad \text{skin flow} = \dfrac{6.3 + 120\,\mathit{warm}_{\mathrm{core}}}{1 + 0.5\,\mathit{cold}_{\mathrm{skin}}}`),
    live: () => `Core ${tT(T().t_core, 2)} (set point ${tT(36.8)}), skin ${tT(T().t_skin)}. Skin blood flow ${f1(T().m_bl * P.bsa / 60)} L/min, sweat ${f0(N().sweatLmin * 60000)} mL/h.`,
    note: "Like any proportional controller it leaves an offset: in exercise, core settles above 36.8 °C (98.2 °F).",
    why: "Overwhelmed, it lets core temperature climb toward heatstroke; fast cooling saves lives." + R("heatstroke"),
  }, {
    view: "organs", beacon: [2, 100, 4], panel: "sec-live",
    title: "Blood sugar: insulin as a controller",
    text: "After a meal, glucose rises and insulin helps cells take it in (Bergman minimal model)." + R("bergman1979") + " In type 1 diabetes no insulin is made, so the loop breaks.",
    plain: "Sugar up → insulin up → sugar into cells → sugar down.",
    eq: MD(String.raw`\dfrac{dG}{dt} = -(p_1+X)\,G + p_1 G_b + \dfrac{R_a}{V},\qquad \dfrac{dX}{dt} = -p_2 X + p_3\,(I - I_b),\qquad \dfrac{dI}{dt} = -n\,(I-I_b) + \gamma\,(G-h)^+`),
    live: () => `Blood sugar ${f0(body.glucose)} mg/dL, insulin ${f1(body.y[2])} µU/mL; glucose arriving from the gut ${f0(body.y[4] / P.tmaxG)} mg/min.`,
    note: "The model leaves out exercise, when muscles use more glucose and the liver releases more." + R("roy2007"),
    why: "The FDA approved the first \"artificial pancreas\" in 2016" + R("aid") + " and accepts a glucose–insulin simulator in place of animal trials" + R("kovatchev2009") + "; about 40.1 million Americans have diabetes." + R("cdc-diabetes"),
  }, {
    view: "body", beacon: [0, 166, 2], panel: "sec-heat", action: () => toggleTlab(true),
    title: "Thermo Lab: controller off",
    text: "Like a jacketed reactor, the body makes heat nonstop; skin blood flow, sweat and shivering are its valves. The lab runs one day with feedback on and off.",
    plain: "Feedback on: core barely moves. Off: it drifts by degrees within hours.",
    eq: MD(String.raw`\text{error} = T_{\mathrm{core}} - 36.8\,^{\circ}\mathrm{C}\ \to\ \text{skin blood flow, sweat, shivering (eq. 9)}\ \to\ \text{heat balance (eq. 35)}\ \to\ T_{\mathrm{core}}`),
    live: () => { const r = tlab.runs || (tlabCompute(), tlab.runs), dOn = Math.max(...r.on.map(x => Math.abs(x.Tc - 36.8))), dOff = Math.max(...r.off.map(x => Math.abs(x.Tc - 36.8))); return `${r.S.label}: largest drift ${tD(dOn)} with feedback, ${tD(dOff)} without.`; },
    why: "A failed cooling loop means a runaway reactor; in people, heatstroke or hypothermia.",
  }] },
  { n: 560, stops: [{
    view: "organs", beacon: [2, 96, 6], panel: "sec-food",
    title: "Digestion: food to fuel",
    text: "Enzymes cut starch into glucose, which enters the blood. The model's gut is two tanks in a row, so glucose arrives over an hour or two." + R("hovorka2004", "wilinska2010"),
    plain: "Food carbs → glucose → blood over time; about 80 % arrives.",
    eq: MD(String.raw`\dfrac{dD_1}{dt} = -\dfrac{D_1}{t_{\max}},\qquad \dfrac{dD_2}{dt} = \dfrac{D_1 - D_2}{t_{\max}},\qquad R_a = \dfrac{D_2}{t_{\max}}\quad (t_{\max} = 40\ \mathrm{min})`),
    live: () => `Glucose waiting in the gut: ${f0((body.y[3] + body.y[4]) / 1000)} g; entering blood at ${f0(body.y[4] / P.tmaxG)} mg/min.`,
    why: "Industry uses these enzymes to make sweeteners and ethanol from corn; glucose timing guides diabetes care.",
  }] },
];
// equation numbers in the ∑ Model panel for each lens stop ("Show the equation")
const EQN = { "0-0": "(1)–(3)", "1-0": "(27)", "2-0": "(8)–(9)", "2-1": "(32), (34), (35)", "4-2": "(13), (33), (19)", "3-0": "(16)–(18)", "3-1": "(20)–(21)", "4-0": "(11)–(13)", "4-1": "(14)–(15)", "5-0": "(23)", "5-1": "(24)–(26)", "6-0": "(28)", "6-1": "(29)", "7-0": "(9)", "7-1": "(31)", "7-2": "(9), (35)", "8-0": "(30)" };
LENSES.forEach((Lz, i) => Lz.stops.forEach((St, k) => { St.eqn = EQN[`${i}-${k}`]; }));
const lensNav = $("lenses"), lensCard = $("lens-card");
LENSES.forEach((Lz, i) => {
  const b = document.createElement("button");
  b.type = "button"; b.textContent = COURSE[Lz.n][0]; b.dataset.i = i; b.setAttribute("aria-pressed", "false");
  b.title = `See where ${COURSE[Lz.n][0]} shows up in the human body`;
  b.onclick = () => (lens && lens.i === i ? closeLens() : openLens(i));
  lensNav.appendChild(b);
});

const beacon = new THREE.Group(); scene.add(beacon); beacon.visible = false;
{ const mat = new THREE.MeshBasicMaterial({ color: "#e0262c", transparent: true, opacity: 0.9, depthTest: false });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3, 0.28, 12, 64), mat); ring.renderOrder = 30; beacon.add(ring); }
let lens = null, lensPrev = null;
function openLens(i, k = 0) {
  $("realworld").setAttribute("aria-pressed", "false");
  if (!lens) lensPrev = { view: viewName };
  lens = { i, k };
  lensNav.querySelectorAll("button[data-i]").forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.i === i)));
  showStop();
}
function showStop() {
  const Lz = LENSES[lens.i], St = Lz.stops[lens.k];
  goTo(St.view);
  St.action?.();
  beacon.position.set(...St.beacon); beacon.visible = true;
  beacon.scale.setScalar(St.view === "body" ? 1.6 : St.view === "organs" ? 0.9 : 4);
  document.querySelectorAll(".lens-hl").forEach(e => e.classList.remove("lens-hl"));
  if (St.panel) { const el = $(St.panel); if (el.classList.contains("fold")) setFold(el, true); el.classList.add("lens-hl"); }
  const last = lens.k === Lz.stops.length - 1;
  lensCard.innerHTML = `
    <div class="lc-top"><span class="lc-subject">${esc(COURSE[Lz.n][0])}</span><span class="lc-step">${Lz.stops.length > 1 ? `${lens.k + 1} of ${Lz.stops.length}` : ""}</span>
      <button class="lc-x" type="button" aria-label="Close">×</button></div>
    <h3>${St.title}</h3><p>${St.text}</p>
    <p class="lc-plain"><b>In plain words:</b> ${St.plain}</p>
    <details class="lc-eq"><summary>Show the equation</summary><div>${St.eqn ? eqNums(St.eqn).map(k => `<div class="lc-tex" data-tex="${encodeURIComponent(EQS[k - 1].tex)}"></div><p class="lc-eqref">Eq. (${k}) · ${EQS[k - 1].name} · <button type="button" data-eq="${k}">open in ∑ Model ▸</button></p>`).join("") : St.eq}</div></details>
    <p class="lc-live" id="lc-live"></p>
    ${St.note ? `<p class="lc-note">${St.note}</p>` : ""}
    <p class="lc-why"><b>Why it matters:</b> ${St.why}</p>
    <p class="lc-course">In college, you learn this in ${courseLink(Lz.n)}</p>
    <div class="lc-nav"><button class="btn" type="button" id="lc-back" ${lens.k === 0 ? "disabled" : ""}>Back</button>
      <button class="btn primary" type="button" id="lc-next">${last ? "Done" : "Next"}</button></div>`;
  lensCard.hidden = false; showCard();
  { const det = lensCard.querySelector(".lc-eq");
    det.addEventListener("toggle", () => { if (det.open) typeset(det); });
    det.querySelectorAll("button[data-eq]").forEach(b => b.onclick = () => openEq(+b.dataset.eq)); }
  lensCard.querySelector(".lc-x").onclick = closeLens;
  $("lc-back").onclick = () => { if (lens.k > 0) { lens.k--; showStop(); } };
  $("lc-next").onclick = () => { if (last) closeLens(); else { lens.k++; showStop(); } };
  lensRefresh();
}
// docked card (Part G): bring it into view at the top of the side panel
function showCard() { const a = document.querySelector("aside"); if (matchMedia("(max-width: 860px)").matches) lensCard.scrollIntoView({ block: "start", behavior: "smooth" }); else a.scrollTo({ top: 0, behavior: "smooth" }); }
function lensRefresh() { if (!lens) return; const el = $("lc-live"); if (el) el.textContent = LENSES[lens.i].stops[lens.k].live(); }
function closeLens() {
  if (!lens) return;
  lens = null; lensCard.hidden = true; beacon.visible = false;
  document.querySelectorAll(".lens-hl").forEach(e => e.classList.remove("lens-hl"));
  lensNav.querySelectorAll("button[data-i]").forEach(b => b.setAttribute("aria-pressed", "false"));
  if (lensPrev) goTo(lensPrev.view);
}

// ---------- clean by default: folds, Conditions toggle, references ----------
function setFold(sec, open) { sec.classList.toggle("collapsed", !open); const h = sec.querySelector(":scope > h2"); if (h) h.setAttribute("aria-expanded", String(open)); if (open) drawCharts(); }
document.querySelectorAll("section.fold").forEach(sec => {
  const h = sec.querySelector(":scope > h2");
  h.tabIndex = 0; h.setAttribute("role", "button"); h.setAttribute("aria-expanded", "false");
  const toggle = () => setFold(sec, sec.classList.contains("collapsed"));
  h.addEventListener("click", e => { if (!e.target.closest("a")) toggle(); });
  h.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
});
$("cond-toggle").onclick = e => {
  const on = e.currentTarget.getAttribute("aria-pressed") !== "true";
  e.currentTarget.setAttribute("aria-pressed", String(on));
  $("tag").hidden = !on;
  ["sec-act", "sec-food", "sec-organs"].forEach(id => setFold($(id), on));
};
document.addEventListener("click", e => {
  const a = e.target.closest("a.ref"); if (!a) return;
  e.preventDefault();
  const li = $("ref-" + a.dataset.ref); if (!li) return;
  setFold($("sec-refs"), true);
  li.scrollIntoView({ block: "center", behavior: "smooth" });
  li.classList.add("flash"); setTimeout(() => li.classList.remove("flash"), 1600);
});

// ---------- controls ----------
function setAct(a) {
  body.cfg.act = a; body.update(0);
  document.querySelectorAll("[data-act]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.act === a)));
  const A = P.ACT[a];
  $("act-note").innerHTML = `${A.label}: ${A.met} MET${A.met === 1 ? "" : "s"}${R("compendium")}, ${(A.met * 3.5 * P.mass / 1000).toFixed(2)} L of O₂ a minute (Compendium code ${A.code}), ${f0(N().M)} W of heat. ${A.v > 0.2 ? `Air rushes past at ${A.v} m/s.` : ""}`;
  refreshAll();
}
document.querySelectorAll("[data-act]").forEach(b => b.onclick = () => setAct(b.dataset.act));
function bindRange(id, fmt, apply) {
  const el = $(id), out = $(id + "-out");
  el.addEventListener("input", () => { out.textContent = fmt(+el.value); apply(+el.value); body.update(0); refreshAll(); });
  out.textContent = fmt(+el.value);
}
bindRange("tdb", v => tT(v, 0), v => body.cfg.tdb = v);
bindRange("rh", v => `${v} %`, v => body.cfg.rh = v);
bindRange("alt", v => `${v.toLocaleString("en-US")} m`, v => body.cfg.alt = v);
bindRange("dose", v => `${v} mg`, () => {});
bindRange("def", v => `${v.toFixed(1)} L`, v => { body.y[8] = v; });
$("eat").onclick = () => { body.eat(75); flash($("eat")); };
$("drink").onclick = () => { body.drink(0.5); flash($("drink")); };
$("coffee").onclick = () => { body.coffee(+$("dose").value); flash($("coffee")); };
function flash(b) { b.classList.add("lens-hl"); setTimeout(() => b.classList.remove("lens-hl"), 600); }
$("reset").onclick = () => {
  Object.assign(body.cfg, { act: "rest", tdb: 22, rh: 50, alt: 0, startDef: 0 });
  [["tdb", 22], ["rh", 50], ["alt", 0], ["def", 0], ["dose", 100]].forEach(([id, v]) => { $(id).value = v; $(id + "-out").textContent = id === "tdb" ? tT(v, 0) : id === "rh" ? `${v} %` : id === "alt" ? `${v} m` : id === "def" ? "0.0 L" : `${v} mg`; });
  body.reset(); AUTO_MEAL.on = true; hist.length = 0; record(); prefill(); $("rate").value = RATE0; setAct("rest");
};

// ---------- readouts and charts ----------
function prepCanvas(c) {
  const r = c.getBoundingClientRect(); if (!r.width) return null;
  const d = Math.min(devicePixelRatio, 2); c.width = r.width * d; c.height = r.height * d;
  const g = c.getContext("2d"); g.setTransform(d, 0, 0, d, 0, 0); return { g, w: r.width, h: r.height };
}
// live trend strip: tab "meal" (blood sugar, insulin, sugar arriving from the gut) or tab "heat" (core temperature, caffeine, heart rate)
const TREND = { tab: "meal" };
const TREND_SETS = {   // fixed y-ranges that hold the standard 75 g meal response with a margin (they widen only if data leave them)
  meal: [
    { i: 2, title: "Blood sugar", col: "--signal", unit: "mg/dL", fmt: v => v.toFixed(0), lo: 60, hi: 200, band: [60, 99], note: "green: normal fasting ≤ 99" },
    { i: 4, title: "Insulin", col: "--accent", unit: "µU/mL", fmt: v => v.toFixed(0), lo: 0, hi: 70 },
    { i: 5, title: "Sugar entering blood from gut", col: "--warn", unit: "g/h", k: 0.06, fmt: v => v.toFixed(0), lo: 0, hi: 40 },
  ],
  heat: [
    { i: 1, title: "Core temperature", col: "--accent", unit: () => tU(), fmt: v => tV(v, 1), lo: 36, hi: 39 },
    { i: 3, title: "Caffeine in blood", col: "--warn", unit: "mg/L", fmt: v => v.toFixed(1), lo: 0, hi: 6 },
    { i: 6, title: "Heart rate", col: "--signal", unit: "beats/min", fmt: v => v.toFixed(0), lo: 40, hi: 200 },
  ],
};
window.__trendBoxes = [];
function drawTrend() {
  const ink2 = css("--ink-2"), rule = css("--rule"), boxes = [];
  const t1 = body.t, t0 = t1 - 360, span = 360, meals = body.events.filter(e => e[1] === "meal" && e[0] >= t0);
  TREND_SETS[TREND.tab].forEach((r, k) => {
    const val = q => q[r.i] * (r.k || 1), unit = typeof r.unit === "function" ? r.unit() : r.unit;
    const head = $("tsl-" + k), ttl = r.title + (r.note ? ` · ${r.note}` : ""); if (head && head.textContent !== ttl) head.textContent = ttl;
    $("tssw-" + k).style.background = css(r.col);
    const now = hist.length ? val(hist.at(-1)) : null, el = $("tsn-" + k), txt = now == null ? "" : `${r.fmt(now)} ${unit}`;
    if (el && el.textContent !== txt) el.textContent = txt;
    const p = prepCanvas($("tr-" + k)); if (!p) return; const { g, w, h } = p;
    const xL = 40, xR = w - 4, y0 = 18, y1 = h - 14;   // band above the plot (0..16) holds the meal label; time labels below
    let lo = r.lo, hi = r.hi; for (const q of hist) if (q[0] >= t0) { hi = Math.max(hi, val(q)); lo = Math.min(lo, val(q)); }
    const X = t => xL + (t - t0) / span * (xR - xL), Y = v => y1 - (v - lo) / (hi - lo) * (y1 - y0);
    const text = (s, x, y, align) => { g.textAlign = align; g.fillText(s, x, y); const wd = g.measureText(s).width, xa = align === "right" ? x - wd : align === "center" ? x - wd / 2 : x; boxes.push({ k, s, x0: xa, x1: xa + wd, y0: y - 9, y1: y + 2 }); };
    g.font = `10.5px ${css("--font-data")}`;
    if (r.band) { const ya = Y(Math.min(r.band[1], hi)), yb = Y(Math.max(r.band[0], lo)); g.fillStyle = "rgba(31,138,76,.12)"; g.fillRect(xL, ya, xR - xL, yb - ya); }
    g.strokeStyle = rule; g.lineWidth = 1; g.strokeRect(xL, y0, xR - xL, y1 - y0);
    g.fillStyle = ink2; text(r.fmt(hi), xL - 4, y0 + 9, "right"); text(r.fmt(lo), xL - 4, y1, "right");
    const pts = [];
    for (const pre of [true, false]) {   // dashed: resting starting state before 08:00; solid: the simulated day
      g.strokeStyle = css(r.col); g.lineWidth = 2; g.globalAlpha = pre ? 0.5 : 1; g.setLineDash(pre ? [4, 4] : []); g.beginPath(); let on = false;
      for (const q of hist) { if (q[0] < t0 || (pre ? q[0] > 0 : q[0] < 0)) continue; const x = X(q[0]), y = Y(val(q)); pts.push([x, y]); on ? g.lineTo(x, y) : g.moveTo(x, y); on = true; }
      g.stroke(); }
    g.globalAlpha = 1; g.setLineDash([]);
    for (const m of meals) {   // the disturbance: an arrow from the label band down to the curve at the meal time
      const x = X(m[0]), q = hist.find(qq => qq[0] >= m[0]), yc = q ? Y(val(q)) : y1, ink = css("--ink");
      g.strokeStyle = ink; g.fillStyle = ink; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, 13); g.lineTo(x, yc - 5); g.stroke();
      g.beginPath(); g.moveTo(x - 4, yc - 10); g.lineTo(x, yc - 4); g.lineTo(x + 4, yc - 10); g.closePath(); g.fill();
      const lab = `meal, ${m[2]} g`, wd = g.measureText(lab).width, lx = Math.min(Math.max(x - wd / 2, xL), xR - wd);
      g.font = `600 10.5px ${css("--font-data")}`; text(lab, lx, 10, "left"); g.font = `10.5px ${css("--font-data")}`;
    }
    g.fillStyle = ink2; text(clockStr(t0), xL, h - 1, "left"); text(clockStr(t1), xR, h - 1, "right");
    boxes.push({ k, curve: pts });
  });
  window.__trendBoxes = boxes;
}
document.querySelectorAll("#trendTabs button").forEach(b => b.onclick = () => { TREND.tab = b.dataset.t; document.querySelectorAll("#trendTabs button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); drawTrend(); });
// ---------- meals: one click feeds the model now; the strip, the gut and the flowsheet show the response ----------
function mealTakeaway() {
  const m = body.events.filter(e => e[1] === "meal").at(-1), box = $("tk-meal");
  if (!m) { setH(box, `<b>What this means</b>A standard 75 g meal is eaten at ${clockStr(AUTO_MEAL.at)}; watch blood sugar and insulin below.`); return; }
  if (body.t - m[0] > 360) { setH(box, ""); return; }
  const after = hist.filter(q => q[0] >= m[0]), G0 = after.length ? after[0][2] : body.glucose;
  let pk = after[0] || [m[0], 0, G0]; for (const q of after) if (q[2] > pk[2]) pk = q;
  const back = after.find(q => q[0] > pk[0] && q[2] <= G0 + 5), rising = pk === after.at(-1);
  const hm = min => { min = Math.round(min); return min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ""}` : `${min} min`; };
  setH(box, `<b>What this means</b><b>${m[2]} g meal at ${clockStr(m[0])}:</b> ` + (rising ? `blood sugar rising (${Math.round(body.glucose)} mg/dL); insulin follows.`
    : `peak ${Math.round(pk[2])} mg/dL after ${hm(pk[0] - m[0])}; ` + (back ? `back near ${Math.round(G0)} after ${hm(back[0] - m[0])}.` : "insulin is bringing it down.")) + R("cdc-glucose"));
}
const BEDNAMES = { brain: "Brain", heart: "Heart", muscle: "Muscle", skin: "Skin", kidneys: "Kidneys", gut: "Gut", other: "Liver etc." };
function drawBars() {
  const p = prepCanvas($("bars")); if (!p) return; const { g, w, h } = p;
  const keys = Object.keys(BEDNAMES), Q = C().Q, B = P.BEDS, max = Math.max(4, ...keys.map(k => Q[k]));
  const rowH = h / keys.length, xL = 70, xR = w - 52;
  g.font = `12px ${css("--font-body")}`;
  keys.forEach((k, i) => {
    const y = i * rowH;
    g.fillStyle = css("--ink-2"); g.textAlign = "left"; g.fillText(BEDNAMES[k], 0, y + rowH * 0.62);
    g.fillStyle = css("--chip"); g.fillRect(xL, y + 3, (xR - xL), rowH - 6);
    g.fillStyle = css("--ink-2"); g.fillRect(xL, y + 3, (xR - xL) * B[k] / max, (rowH - 6) * 0.35);
    g.fillStyle = css("--accent"); g.fillRect(xL, y + 3 + (rowH - 6) * 0.42, (xR - xL) * Q[k] / max, (rowH - 6) * 0.58);
    g.fillStyle = css("--ink"); g.textAlign = "right"; g.font = `11.5px ${css("--font-data")}`; g.fillText(Q[k].toFixed(2), w, y + rowH * 0.62); g.font = `12px ${css("--font-body")}`;
  });
}
function drawCharts() { drawTrend(); drawBars(); drawHeatBars(); }
// ---------- plain-language takeaways under each block of results (built from the live numbers) ----------
const TK = (id, html) => setH($(id), `<b>What this means</b>${html}`);
function renderTakeaways() {
  const n = N(), c = n.circ, l = n.lung, k = n.kid, th = n.th, Tc = th.t_core, G = body.glucose, Cc = body.caffeineC;
  const hr = Math.min(c.HR, HRMAX), pctMax = hr / HRMAX * 100, d = body.y[8], dPct = d / P.mass * 100;
  const state = Tc >= 39.5 ? "dangerously hot" : Tc >= 37.6 ? "warm from effort (normal in exercise)" : "at normal temperature";
  TK("tk-live", `<b>Your body is ${state}.</b> Heart: ${Math.round(hr)} beats/min (${Math.round(pctMax)} % of estimated max), ${c.CO.toFixed(1)} L/min, a 2 L bottle every ${Math.round(2 / c.CO * 60)} s. ` +
    (Tc >= 39.5 ? "Slow down, cool off, drink." : dPct > 2 ? `${d.toFixed(1)} L short of water: drink.` : G > 140 ? "Sugar is high after the meal; insulin is lowering it." : "Try Jog, Marathon or a hot day."));
  const A = P.ACT[body.cfg.act], hot = body.cfg.tdb >= 30;
  TK("tk-act", `<b>${A.met <= 1 ? "Resting: the body idles" : A.met < 5 ? "Walking: about 3× resting energy use" : "Running: about " + Math.round(A.met) + "× resting energy use"}.</b> Using ${(n.VO2 / 1000).toFixed(2)} L O₂/min, making ${Math.round(n.M)} W of heat (roughly ${(n.M / 100).toFixed(1)} old 100 W bulbs). ` +
    (hot && A.met > 5 ? `In ${tT(body.cfg.tdb, 0)} air this heat barely escapes, so core temperature climbs.` : body.cfg.alt >= 2500 ? `At ${body.cfg.alt.toLocaleString("en-US")} m, blood leaves the lungs ${Math.round(l.Sa * 100)} % saturated, not about 97 %.` : body.cfg.tdb <= 5 ? "Cold air: skin vessels narrow to keep the core warm." : "Change air temperature, humidity or altitude."));
  const gGrams = G * P.VG * P.mass / 1000, cafMg = Cc * P.cafVd * P.mass, cafState = Cc < 0.5 ? "almost no caffeine" : `${Math.round(cafMg)} mg of caffeine`;
  TK("tk-food", `<b>${G > 140 ? "Blood sugar is high, as after a meal" : G < 70 ? "Blood sugar is low" : "Blood sugar is normal"}.</b> Blood holds about ${gGrams.toFixed(1)} g of sugar (${(gGrams / 4).toFixed(1)} teaspoons) and ${cafState}${Cc >= 0.5 ? `, halving every ${P.cafHalf} h (FDA: max 400 mg/day for most adults)` : ""}. ` +
    (dPct > 3 ? `Lost ${dPct.toFixed(1)} % of weight in water: drink now.` : dPct > 1 ? `${d.toFixed(1)} L short of water: drink soon.` : "Water is balanced."));
  const restCO = c.CO0, muscleShare = c.Q.muscle / c.CO * 100, pump = c.MAP * 133.322 * c.CO / 60000;
  TK("tk-heart", `<b>${c.CO > restCO * 1.5 ? `Heart output is ${(c.CO / restCO).toFixed(1)}× resting, mostly to muscle` : "At rest, blood is shared evenly between organs"}.</b> Muscles get ${Math.round(muscleShare)} % of ${c.CO.toFixed(1)} L/min; their vessels widened ${Math.round((c.rad.muscle - 1) * 100)} %. Pump power: about ${pump.toFixed(1)} W, like a small LED. ` +
    (c.HR > HRMAX ? "No heart beats this fast: slow down." : "Change activity to watch blood shift to muscle."));
  const sa = l.Sa * 100;
  TK("tk-lungs", `<b>${sa >= 95 ? "Blood leaves the lungs nearly full of O₂" : sa >= 90 ? "O₂ loading is slightly reduced" : "Blood is short of O₂"}</b> (${sa.toFixed(0)} % saturated). Capillary transit: ${l.tT.toFixed(2)} s, roughly a blink; ${l.tEq != null ? `full after ${l.tEq.toFixed(2)} s` : "too short to fill in this thin air"}. ` +
    (sa < 90 ? "Go lower or slow down." : body.cfg.alt < 1000 ? "Try 4,500 m and Jog: diffusion becomes the limit." : "Higher or faster makes the lungs the bottleneck."));
  const perDay = k.GFR * 1440, tubs = perDay / 150, uo = k.Uosm;
  TK("tk-kidney", `<b>${uo > 800 ? "Kidneys are saving water: urine is concentrated" : uo < 300 ? "Kidneys are dumping extra water: urine is dilute" : "Kidneys are balancing water normally"}.</b> They filter ${Math.round(perDay)} L of plasma a day (roughly ${tubs.toFixed(1)} bathtubs of 150 L), keeping ${k.reabsorbed * 100 >= 99.5 ? "more than 99.5" : (k.reabsorbed * 100).toFixed(1)} % of the water; the liver removes ${(liverCL(Cc, n.QH, n.QH0).E * 100).toFixed(0)} % of caffeine per pass. ` +
    (uo > 800 ? "Drinking would make urine lighter and more plentiful." : "Sweating would make them hold on to water."));
}
// ---------- heat balance: heat made by each organ vs heat lost by each route ----------
const HEATCOL = { muscle: "#c5050c", brain: "#e07a5f", liver: "#9b2c1d", heart: "#7c0f19", kidneys: "#b85c4c", other: "#c9b8a8", dry: "#1f6fd1", evap: "#59a5e6", breath: "#9cc7ef", store: "#b26a00" };
function drawHeatBars() {
  if (N().th.h_cc == null) return;
  const p = prepCanvas($("heatBars")); if (!p) return; const { g, w, h } = p;
  const H = organHeat(N()), B = heatBalance(N()), max = Math.max(H.total, B.dry + B.evap + B.breath + Math.max(B.S, 0));
  const made = [["muscle", H.muscle], ["brain", H.brain], ["liver", H.liver], ["heart", H.heart], ["kidneys", H.kidneys], ["other", H.adipose + H.residual]];
  const lost = [["dry", B.dry], ["evap", B.evap], ["breath", B.breath], ["store", Math.max(B.S, 0)]];
  const xL = 56, W2 = w - xL - 6, rowH = 30;
  g.font = `600 11.5px ${css("--font-body")}`;
  [["Made, W", made, 8], ["Lost, W", lost, 8 + rowH + 18]].forEach(([lab, list, y]) => {
    g.fillStyle = css("--ink-2"); g.textAlign = "left"; g.fillText(lab, 0, y + 19);
    let x = xL; for (const [k, v] of list) { const ww = Math.max(0, v) / max * W2; g.fillStyle = HEATCOL[k]; g.fillRect(x, y, ww, rowH); if (ww > 34) { g.fillStyle = "#fff"; g.textAlign = "center"; g.fillText(`${Math.round(v)}`, x + ww / 2, y + 19); } x += ww; }
  });
  g.font = `11px ${css("--font-body")}`; g.textAlign = "left";
  const leg = [["muscle", "muscle"], ["brain", "brain"], ["liver", "liver"], ["heart", "heart"], ["kidneys", "kidneys"], ["other", "other tissue"], ["dry", "convection + radiation"], ["evap", "sweat"], ["breath", "breath"], ["store", "stored"]];
  let lx = 0, ly = 2 * rowH + 44;
  for (const [k, t] of leg) { const tw = g.measureText(t).width + 18; if (lx + tw > w) { lx = 0; ly += 15; } g.fillStyle = HEATCOL[k]; g.fillRect(lx, ly - 8, 9, 9); g.fillStyle = css("--ink-2"); g.fillText(t, lx + 12, ly); lx += tw + 4; }
}
function refreshHeat() {
  if (N().th.h_cc == null) { ["h-dry", "h-evap", "h-breath", "h-S", "h-dT"].forEach(id => { $(id).textContent = "after 1 min"; }); $("h-why").textContent = "The heat losses are computed from the first simulated minute on; press Play."; return; }
  const n = N(), H = organHeat(n), B = heatBalance(n), f0w = v => `${Math.round(v)} W`;
  $("h-M").textContent = f0w(B.M); $("h-org").textContent = `${f0w(H.muscle)} / ${f0w(H.brain)} / ${f0w(H.liver)}`;
  $("h-dry").textContent = f0w(B.dry); $("h-evap").textContent = f0w(B.evap); $("h-breath").textContent = f0w(B.breath);
  $("h-S").textContent = `${B.S >= 0 ? "+" : "−"}${f0w(Math.abs(B.S))}`; $("h-dT").textContent = `${B.dTdt >= 0 ? "+" : "−"}${tD(Math.abs(B.dTdt), 2, "/h")}`;
  $("h-nc").textContent = `+${tD(B.noCool, 1, "/h")}`;
  { const Tc = n.th.t_core, toDanger = B.dTdt > 0.05 && Tc < 39.5 ? (39.5 - Tc) / B.dTdt * 60 : null;
    TK("h-why", `<b>Heat out matches heat in, so you stay near ${tT(37, 0)}.</b> You make ${Math.round(B.M)} W; with no cooling you would warm ${tD(B.noCool)} per hour, but ${Math.round(B.dry + B.evap + B.breath)} W leaves. ` +
      (Tc >= 39.5 ? "Danger zone: stop, cool off, drink." : toDanger != null && toDanger < 240 ? `${tT(39.5)} danger zone in about ${Math.round(toDanger)} min: slow down and drink.` : "Safe balance."));
  }
}
function refreshAll() {
  if (heatMode) refreshEbox(); refreshFactory(); mealTakeaway(); mealGlow(); refreshRbcInfo();
  const n = N(), c = n.circ, l = n.lung, k = n.kid;
  const hr = Math.min(c.HR, HRMAX);
  $("clock").textContent = clockStr(body.t) + dayStr(body.t); $("clock-pill").textContent = clockStr(body.t);
  $("r-hr").textContent = `${f0(hr)} beats/min`; $("r-hr").classList.toggle("warn", c.HR > HRMAX);
  $("r-co").textContent = `${f1(c.CO)} L/min`;
  $("r-sa").textContent = `${f0(l.Sa * 100)} % saturated`; $("r-sa").classList.toggle("warn", l.Sa < 0.9);
  $("r-tc").textContent = tT(n.th.t_core); $("r-tc").classList.toggle("warn", n.th.t_core >= 39.5);
  $("r-sw").textContent = `${f0(n.sweatLmin * 60000)} mL/h`;
  $("r-g").textContent = `${f0(body.glucose)} mg/dL`;
  $("r-caf").textContent = `${f1(body.caffeineC)} mg/L`;
  const d = body.y[8]; $("r-w").textContent = d > 0.005 ? `${d.toFixed(2)} L short (${f1(d / P.mass * 100)} % of weight)` : d < -0.005 ? `${(-d).toFixed(2)} L extra` : "balanced";
  $("r-w").classList.toggle("warn", d / P.mass > 0.02);
  $("o-sv").textContent = `${f0(c.SV)} mL`; $("o-map").textContent = `${f0(c.MAP)} mmHg`; $("o-rad").textContent = `${f0((c.rad.muscle - 1) * 100)} %`;
  $("o-pb").textContent = `${f0(l.Pb)} mmHg`; $("o-pao2").textContent = `${f0(l.PAO2)} mmHg`; $("o-pa").textContent = `${f0(l.Pa)} mmHg`;
  $("o-tt").textContent = `${l.tT.toFixed(2)} s`; $("o-va").textContent = `${f1(l.VA)} L/min`;
  $("o-gfr").textContent = `${f0(k.GFR * 1000)} mL/min`; $("o-reab").textContent = `${f1(k.reabsorbed * 100)} %`;
  $("o-urine").textContent = `${f0(k.urine * 60000)} mL/h`; $("o-uosm").textContent = `${f0(k.Uosm)} mOsm/kg`;
  $("o-ext").textContent = `${f1(liverCL(body.caffeineC, n.QH, n.QH0).E * 100)} %`;
  $("tag").textContent = `${clockStr(body.t)} · ${actLabel()} · ${tT(body.cfg.tdb, 0)}, ${body.cfg.rh} % humid · ${body.cfg.alt} m · HR ${f0(hr)} · core ${n.th.t_core.toFixed(1)} °C`;
  const msgs = [];
  if (c.HR > HRMAX) msgs.push(`This pace needs ${f0(c.HR)} beats/min, more than a ${P.age}-year-old's maximum of about ${f0(HRMAX)}${R("tanaka2001")}. In real life you would have to slow down.`);
  if (n.th.t_core >= 39.5) msgs.push("Core temperature is in the danger zone for heat illness. Stop, get to shade, cool down and drink.");
  if (d / P.mass > 0.03) msgs.push("You have lost more than 3 % of your weight in water. Time to drink.");
  if (l.Sa < 0.85) msgs.push("Blood oxygen is low: the air up here is thin.");
  $("alert").hidden = !msgs.length; setH($("alert"), msgs.join("<br>"));
  drawCharts(); lensRefresh(); if (typeof modelLive === "function") modelLive();
  refreshHeat(); updateThermal(); renderTakeaways(); if (circ.open) renderCirc();
  if (typeof tlab !== "undefined" && tlab.open && (tlab.tick = (tlab.tick || 0) + 1) % 8 === 0) renderTlab();
}

// ---------- real world ----------
function openIntro() {
  if (lens) closeLens();
  $("realworld").setAttribute("aria-pressed", "true"); beacon.visible = false;
  lensCard.innerHTML = `
    <div class="lc-top"><span class="lc-subject">Real world</span><button class="lc-x" type="button" aria-label="Close">×</button></div>
    <h3>Why is your body a chemical plant?</h3>
    <p>Lungs swap gas, the heart pumps, kidneys filter, the liver reacts, the brain controls heat.</p>
    <p><b>Better treatments</b></p>
    <ul class="lc-list">
      <li><b>Dialysis:</b> hollow-fiber filters${R("niddk-hd")}, used by 68 % of 808,000+ Americans in kidney failure.${R("niddk-stats")}</li>
      <li><b>ECMO:</b> membrane lungs.${R("ecmo")}</li>
      <li><b>Stents:</b> re-open narrowed arteries.${R("nhlbi-stent")}</li>
      <li><b>Artificial pancreas:</b> sensor + pump + controller.${R("aid", "kovatchev2009")}</li>
      <li><b>Drug dosing:</b> pharmacokinetic models.${R("pbpk")}</li>
      <li><b>Heatstroke:</b> cold-water cooling; none of 521 cooled fast enough died.${R("heatstroke")}</li>
    </ul>
    <p class="lc-note">Educational model of one healthy 70 kg, ${P.age}-year-old. Not medical advice. Superscripted numbers are sourced.</p>
    <p class="lc-plain">Tap a numbered ChemE spot or pick a subject.</p>
    <div class="lc-nav"><button class="btn primary" type="button" id="lc-next">Start exploring</button></div>`;
  lensCard.hidden = false; showCard();
  const done = () => { lensCard.hidden = true; $("realworld").setAttribute("aria-pressed", "false"); try { localStorage.setItem("body-intro-seen", "1"); } catch (e) {} };
  lensCard.querySelector(".lc-x").onclick = done; $("lc-next").onclick = done;
}
$("realworld").onclick = () => ($("realworld").getAttribute("aria-pressed") === "true" ? (lensCard.hidden = true, $("realworld").setAttribute("aria-pressed", "false")) : openIntro());
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if (lens) closeLens(); else if (!lensCard.hidden) { lensCard.hidden = true; $("realworld").setAttribute("aria-pressed", "false"); }
});

// ---------- ChemE spots ----------
const SPOTS = [
  { name: "Lungs: gas exchange", lens: 3, pos: [-10, 131, 7] },
  { name: "Heart: the pump", lens: 4, pos: [4, 118, 9] },
  { name: "Liver: chemical reactor", lens: 6, pos: [-8, 106, 9] },
  { name: "Kidneys: filter and recycle", lens: 5, pos: [12, 101, 1] },
  { name: "Gut: digesting a meal", lens: 8, pos: [-1, 89, 9] },
  { name: "Skin: sweat cooling", lens: 2, pos: [-24.5, 104, 4] },
  { name: "Brain: the orchestrator", lens: 7, pos: [11, 168, 3] },
  { name: "Blood: tracking caffeine", lens: 1, pos: [23.5, 100, 4] },
  { name: "Whole body: in and out", lens: 0, pos: [0, 158, 11] },
];
const spotLayer = $("spots"), spotEls = [];
SPOTS.forEach((Sp, i) => {
  const b = document.createElement("button"); b.type = "button"; b.className = "spot"; b.textContent = String(i + 1);
  b.setAttribute("aria-label", `ChemE spot ${i + 1}: ${Sp.name}`);
  const t = document.createElement("span"); t.textContent = Sp.name; b.appendChild(t);
  b.onclick = () => openLens(Sp.lens, Sp.stop || 0); spotLayer.appendChild(b); spotEls.push(b);
});
// Part M: spots are always on. Spots that project close together are pushed apart, with a leader line to their true place.
const SVGNS = "http://www.w3.org/2000/svg", spotLines = document.createElementNS(SVGNS, "svg"); spotLines.id = "spotLines"; spotLayer.prepend(spotLines);
const _v = new THREE.Vector3();
const spotList = $("spotList");
spotList.querySelector("ol").innerHTML = SPOTS.map((Sp, i) => `<li><button type="button" data-i="${i}" title="Zoom in: ${Sp.name}"><b>${i + 1}</b><span>${Sp.name}</span></button></li>`).join("");
spotList.querySelectorAll("button[data-i]").forEach(b => b.onclick = () => spotEls[+b.dataset.i].click());
const slTog = spotList.querySelector(".sl-tog");
const setSL = open => { spotList.classList.toggle("open", open); slTog.setAttribute("aria-expanded", String(open)); slTog.textContent = open ? "‹" : "›"; slTog.title = open ? "Collapse the spots list" : "Show the spot titles"; };
setSL(!matchMedia("(max-width: 860px)").matches); slTog.onclick = () => setSL(!spotList.classList.contains("open"));
let spotActive = -2;
function placeSpots() {
  const w = stage.clientWidth, h = stage.clientHeight, pts = [];
  const xMin = spotList.offsetLeft + spotList.offsetWidth + 22;
  const facBox = document.getElementById("factory"), xMax = facBox && facBox.offsetParent && innerWidth > 860 ? Math.max(w / 2, facBox.offsetLeft - 22) : w - 20;
  SPOTS.forEach((Sp, i) => {
    _v.set(...Sp.pos); let dist = _v.distanceTo(camera.position);
    if (dist >= 520 && Sp.bodyPos) { _v.set(...Sp.bodyPos); dist = _v.distanceTo(camera.position); }
    _v.project(camera);
    const vis = _v.z < 1 && _v.z > -1 && Math.abs(_v.x) < 1.02 && Math.abs(_v.y) < 1.02 && dist < 560;
    if (vis) { const x = (_v.x + 1) / 2 * w, y = (1 - _v.y) / 2 * h; pts.push({ i, x0: x, y0: y, x, y }); } else spotEls[i].style.display = "none";
  });
  const R = 46;   // minimum centre distance (32 px spot, its 7 px ring, margin)
  const obst = placeHeatLabels(w, h);
  for (let it = 0; it < 120; it++) { let moved = false;
    for (let a = 0; a < pts.length; a++) for (let b = a + 1; b < pts.length; b++) {
      const A2 = pts[a], B2 = pts[b]; let dx = B2.x - A2.x, dy = B2.y - A2.y, d = Math.hypot(dx, dy);
      if (d < R) { if (d < 0.01) { dx = 1; dy = 0; d = 1; } const push = (R - d) / 2; dx /= d; dy /= d; A2.x -= dx * push; A2.y -= dy * push; B2.x += dx * push; B2.y += dy * push; moved = true; } }
    for (const p of pts) for (const o of obst) { const dx = p.x - o.x, dy = p.y - o.y;
      if (Math.abs(dx) < o.hw && Math.abs(dy) < o.hh) { if (o.hh - Math.abs(dy) < o.hw - Math.abs(dx)) p.y = o.y + Math.sign(dy || 1) * o.hh; else p.x = o.x + Math.sign(dx || 1) * o.hw; moved = true; } }
    for (const p of pts) { p.x = Math.min(xMax, Math.max(Math.min(xMin, w / 2), p.x)); p.y = Math.min(h - 20, Math.max(20, p.y)); }
    if (!moved) break; }
  let lines = "";
  for (const p of pts) { const el = spotEls[p.i]; el.style.display = ""; el.style.left = `${p.x}px`; el.style.top = `${p.y}px`;
    if (Math.hypot(p.x - p.x0, p.y - p.y0) > 4) lines += `<line x1="${p.x0.toFixed(1)}" y1="${p.y0.toFixed(1)}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}"/><circle cx="${p.x0.toFixed(1)}" cy="${p.y0.toFixed(1)}" r="2.6"/>`; }
  if (spotLines.__l !== lines) { spotLines.__l = lines; spotLines.innerHTML = lines; }
  const act = lens ? SPOTS.findIndex(Sp => Sp.lens === lens.i && (Sp.stop || 0) === lens.k) : -1;
  if (act !== spotActive) { spotActive = act;
    spotEls.forEach((e, i) => e.classList.toggle("active", i === act));
    spotList.querySelectorAll("button[data-i]").forEach(b => b.classList.toggle("active", +b.dataset.i === act)); }
}

// ---------- the body as a chemical factory: a process flow diagram beside the figure, linked to organs and spots ----------
const FAC_ORG = { 1: ["lungR", "lungL"], 2: ["heart"], 3: ["liver"], 4: ["kidneyR", "kidneyL"], 5: ["stomach", "smallInt", "largeInt"], 7: ["brain"] };
{
  // unit: symbol, numbered badge at [bx, by], two-line label (name / role) at [lx, ly] with anchor
  const U = (n, label, sym, [bx, by], [lx, ly, anchor = "middle"]) => `<g class="fu" data-n="${n}" tabindex="0" role="button" aria-label="${label}">${sym}
    ${n ? `<circle class="fu-n" cx="${bx}" cy="${by}" r="10"/><text class="fu-nt" x="${bx}" y="${by + 4}">${n}</text>` : ""}
    <text class="fu-l" x="${lx}" y="${ly}" text-anchor="${anchor}">${label.split(" · ").map((t, k) => `<tspan x="${lx}" dy="${k ? 15 : 0}" class="${k ? "fu-r" : ""}">${t}</tspan>`).join("")}</text></g>`;
  const arr = (d, cls) => `<path class="${cls}" d="${d}" marker-end="url(#fa-${cls.includes("st-v") ? "v" : cls.includes("st-c") ? "c" : "a"})"/>`;
  const X = [70, 170, 270, 370, 480];   // gut, liver, muscles, kidneys, skin
  $("factory").innerHTML = `<div class="fac-h"><b>Your body as a chemical factory</b><span>hover a unit to find its organ</span></div>
  <svg viewBox="0 0 560 580" role="img" aria-label="Process flow diagram of the body as a chemical plant">
  <defs>${[["a", "#c97a80"], ["v", "#7f93b5"], ["c", "#5d6875"]].map(([k, c]) => `<marker id="fa-${k}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0L10,5L0,10z" fill="${c}"/></marker>`).join("")}</defs>
  <path class="st-v" d="M8 480 V140 H218"/>
  <path class="st-a" d="M240 150 V206"/><path class="st-a" d="M240 254 V300"/><path class="st-a" d="M70 300 H480"/>
  ${X.map(x => `<path class="st-a" ${x === 270 ? 'id="fs-musc" ' : ""}d="M${x} 300 V338"/><path class="st-v" d="M${x} 404 V480"/>`).join("")}
  <path class="st-v" d="M8 480 H480"/>
  ${arr("M64 70 H216", "st-c")}${arr("M264 60 H344", "st-c")}
  ${arr("M14 322 L40 344", "st-c")}${arr("M100 372 H138", "st-v").replace("<path ", '<path id="fs-portal" ')}
  ${arr("M392 404 L420 430 V556", "st-c")}${arr("M504 392 L536 424", "st-c")}
  <text class="fv" x="64" y="58">O₂ in <tspan id="fs-o2">–</tspan></text>
  <text class="fv" x="266" y="48">CO₂ out <tspan id="fs-co2">–</tspan></text>
  <text class="fv" x="282" y="290">blood <tspan id="fs-co">–</tspan></text>
  <text class="fv" x="14" y="314">food in</text>
  <text class="fv" x="428" y="560">urine <tspan id="fs-ur">–</tspan></text>
  <text class="fv" x="552" y="444" text-anchor="end">heat out</text><text class="fv" x="552" y="462" text-anchor="end"><tspan id="fs-heat">–</tspan></text>
  <text class="fv fv-loop" x="16" y="560">8 · Blood · the recycle loop</text>
  <g class="ctl"><path d="M480 100 V160 H300 V230 H264"/><path d="M466 96 L392 338"/><path d="M494 96 L500 344"/><path d="M450 300 V112 L466 98"/>
    <text x="454" y="214" class="fv">sensor</text></g>
  ${U(1, "Lungs · gas exchanger", `<rect class="fu-s" x="220" y="38" width="40" height="112" rx="20"/><path class="fu-i" d="M224 66 H256 M224 86 H256 M224 106 H256 M224 126 H256"/>`, [204, 42], [210, 104, "end"])}
  ${U(2, "Heart · pump", `<circle class="fu-s" cx="240" cy="230" r="22"/><path class="fu-i" d="M228 216 L258 230 L228 244 Z"/>`, [204, 200], [210, 232, "end"])}
  ${U(7, "Brain · controller", `<circle class="fu-s" cx="480" cy="80" r="20"/><text class="fu-c" x="480" y="85">TC</text>`, [504, 58], [452, 78, "end"])}
  ${U(5, "Gut · feed prep", `<path class="fu-s" d="M42 340 H98 V384 L70 404 L42 384 Z"/>`, [106, 334], [70, 504])}
  ${U(3, "Liver · reactor", `<rect class="fu-s" x="142" y="340" width="56" height="64" rx="14"/><path class="fu-i" d="M170 330 V386 M158 386 H182"/>`, [136, 336], [170, 504])}
  ${U(0, "Muscles · burners", `<rect class="fu-s" x="242" y="340" width="56" height="64" rx="5"/><path class="fu-i" d="M260 396 Q270 362 280 396 Q270 380 260 396"/>`, [0, 0], [270, 504])}
  ${U(4, "Kidneys · separator", `<rect class="fu-s" x="344" y="340" width="52" height="64" rx="5"/><path class="fu-i fu-mem" d="M344 404 L396 340"/>`, [338, 336], [370, 504])}
  ${U(6, "Skin · cooler", `<circle class="fu-s" cx="480" cy="372" r="28"/><path class="fu-i" d="M456 372 L464 360 L472 384 L480 360 L488 384 L496 360 L504 372"/>`, [450, 338], [480, 504])}
  </svg>`;
}
const factory = $("factory");
function facHi(num, on) {
  facHover = on ? num : 0;
  factory.querySelectorAll(`.fu[data-n="${num}"]`).forEach(g => g.classList.toggle("on", on));
  if (num > 0) { spotEls[num - 1]?.classList.toggle("hover", on); spotList.querySelector(`button[data-i="${num - 1}"]`)?.classList.toggle("hover", on); }
  if (heatMode) return;
  for (const k of FAC_ORG[num] || []) { const m = W.organs[k]?.material; if (m && m.emissive) { m.emissive.set(on ? "#c5050c" : 0); m.emissiveIntensity = on ? 0.55 : 0; } }
  if (num === 6) W.skinMat.uniforms.uRim.value.set(on ? "#c5050c" : "#5b7590");
}
factory.querySelectorAll(".fu").forEach(g => { const n = +g.dataset.n;
  g.addEventListener("mouseenter", () => facHi(n, true)); g.addEventListener("mouseleave", () => facHi(n, false));
  g.addEventListener("focus", () => facHi(n, true)); g.addEventListener("blur", () => facHi(n, false));
  if (n) { g.addEventListener("click", () => spotEls[n - 1].click()); g.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); spotEls[n - 1].click(); } }); } });
spotEls.forEach((el, i) => { el.addEventListener("mouseenter", () => facHi(i + 1, true)); el.addEventListener("mouseleave", () => facHi(i + 1, false)); });
spotList.querySelectorAll("button[data-i]").forEach(b => { const n = +b.dataset.i + 1; b.addEventListener("mouseenter", () => facHi(n, true)); b.addEventListener("mouseleave", () => facHi(n, false)); });
const facSeg = $("facSeg");
function setFac(on) { document.body.classList.toggle("fac-on", on); facSeg.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String((b.dataset.f === "fac") === on))); if (viewName === "body" && innerWidth > 860) goTo("body"); }
facSeg.querySelectorAll("button").forEach(b => b.onclick = () => setFac(b.dataset.f === "fac"));
setFac(!matchMedia("(max-width: 860px)").matches);
const setT = (id, t) => { const el = $(id); if (el && el.textContent !== t) el.textContent = t; };
let facHover = 0;
function mealGlow() {   // gut and liver glow while sugar is being absorbed (anatomy view); flowsheet portal stream thickens
  const Ra = body.y[4] / P.tmaxG, u = Math.min(1, Ra / 450), XG = body.y[1] * body.glucose;
  const portal = $("fs-portal"), musc = $("fs-musc");
  if (portal) { portal.classList.toggle("fac-act", Ra > 20); portal.style.strokeWidth = `${1.6 + 5 * u}`; }
  if (musc) { musc.classList.toggle("fac-act", Ra > 20); musc.style.strokeWidth = `${1.6 + 3 * Math.min(1, XG / 2)}`; }
  setT("fs-ra", Ra > 20 ? `sugar ${Math.round(Ra * 0.06)} g/h` : "");
  if (heatMode) return;
  for (const [k, f] of [["stomach", 1], ["smallInt", 1], ["largeInt", 0.6], ["liver", 0.6]]) {
    if ((facHover === 5 && k !== "liver") || (facHover === 3 && k === "liver")) continue;
    const mat = W.organs[k]?.material; if (mat && mat.emissive) { mat.emissive.set("#c5050c"); mat.emissiveIntensity = 0.5 * u * f; }
  }
}
function refreshFactory() {
  const n = N(), G = bedGas(n), B = heatBalance(n);
  setT("fs-o2", `${Math.round(G.VO2)} mL/min`); setT("fs-co2", `${Math.round(G.VCO2)} mL/min`); setT("fs-co", `${n.circ.CO.toFixed(1)} L/min`);
  setT("fs-ur", `${Math.round(n.kid.urine * 60000)} mL/h`); setT("fs-heat", n.th.h_cc == null ? "–" : `${Math.round(B.dry + B.evap + B.breath)} W`);
}

// ---------- Links to Research (Part N): UW–Madison CBE faculty, names linked to official pages, general areas, jump to the spot ----------
function renderResearch() {
  const row = (r, i) => `<article class="res-card"><h4><a href="${r.url}" target="_blank" rel="noopener">${r.name} ↗</a></h4>
    <p class="res-where">Connects to: ${r.where}</p>
    <div class="res-tags res-areas">${r.areas.slice(0, 3).map(a => `<span>${a}</span>`).join("")}</div>
    <button class="btn" type="button" data-r="${i}">Show in the twin ▸</button></article>`;
  $("resBody").innerHTML = `<p class="crs-intro">Research in UW–Madison Chemical &amp; Biological Engineering that connects to this digital twin.</p>
    <div class="res-grid">${RESEARCH.map(row).join("")}</div>
    <h5 class="res-h">UW–Madison centers and programs</h5>
    <div class="res-grid res-centers">${CENTERS.map(([n, u, w]) => `<article class="res-card"><h4><a href="${u}" target="_blank" rel="noopener">${n} ↗</a></h4><p class="res-where">Connects to: ${w}</p></article>`).join("")}</div>`;
  $("resBody").querySelectorAll("button[data-r]").forEach(b => b.onclick = () => { const w = RESEARCH[+b.dataset.r].go; toggleResearch(false);
    if (w.spot) spotEls[w.spot - 1].click(); else if (w.view) { if (lens) closeLens(); goTo(w.view); } else if (w.lens != null) openLens(w.lens, w.stop || 0); });
}
const resP = { open: false };
function toggleResearch(on = !resP.open) { resP.open = on; $("resPanel").hidden = !on; if (on) { renderResearch(); $("resClose").focus(); } }
$("btnRes").onclick = () => toggleResearch(); $("resClose").onclick = () => toggleResearch(false);
document.addEventListener("keydown", e => { if (e.key === "Escape" && resP.open) toggleResearch(false); });

// ---------- red blood cell view: every component labelled; caption, colour legend and what it means ----------
const RBC_LABELS = [["membrane", "Cell membrane"], ["hemoglobin", "Hemoglobin (carries O₂)"], ["oxygen", "Oxygen molecule (O₂)"], ["co2", "Carbon dioxide (CO₂)"], ["plasma", "Plasma (the liquid of blood)"], ["wall", "Vessel wall"]];
const rbcLayer = $("rbcLabels"), rbcSvg = document.createElementNS(SVGNS, "svg"); rbcLayer.appendChild(rbcSvg);
const rbcEls = RBC_LABELS.map(([k, t]) => { const d = document.createElement("div"); d.className = "rbc-l"; d.textContent = t; d.dataset.k = k; rbcLayer.appendChild(d); return d; });
function placeRbcLabels() {
  const on = viewName === "rbc" && !tween; rbcLayer.hidden = !on; $("rbcInfo").hidden = viewName !== "rbc"; document.body.classList.toggle("view-rbc", viewName === "rbc");
  if (!on) return;
  const w = stage.clientWidth, h = stage.clientHeight, prj = v => { _v.copy(v).project(camera); return [(_v.x + 1) / 2 * w, (1 - _v.y) / 2 * h]; };
  // projected outline of the cell, so labels stay clear of it
  let cx0 = Infinity, cx1 = -Infinity, cy0 = Infinity, cy1 = -Infinity;
  for (let a = 0; a < 24; a++) { const v = new THREE.Vector3(36 * Math.cos(a / 24 * Math.PI * 2), 0, 36 * Math.sin(a / 24 * Math.PI * 2)).applyAxisAngle(new THREE.Vector3(1, 0, 0), 0.35).add(A.rbc);
    const [x, y] = prj(v); cx0 = Math.min(cx0, x); cx1 = Math.max(cx1, x); cy0 = Math.min(cy0, y - 10); cy1 = Math.max(cy1, y + 10); }
  const narrow = w < 600;
  rbcLayer.classList.toggle("narrow", narrow);
  if (narrow) {   // phones: numbered markers on the cell, names in the caption's key
    const pts = rbcEls.map((el, i) => { const [x, y] = prj(W.rbcAnchors[RBC_LABELS[i][0]].clone().add(A.rbc)); return { x0: x, y0: y, x, y }; });
    for (let it = 0; it < 60; it++) { for (let a = 0; a < pts.length; a++) for (let b = a + 1; b < pts.length; b++) { const P = pts[a], Q = pts[b]; let dx = Q.x - P.x, dy = Q.y - P.y, d = Math.hypot(dx, dy);
        if (d < 32) { if (d < 0.01) { dx = 1; dy = 0; d = 1; } const m = (32 - d) / 2; P.x -= dx / d * m; P.y -= dy / d * m; Q.x += dx / d * m; Q.y += dy / d * m; } }
      for (const P of pts) { P.x = Math.min(w - 14, Math.max(14, P.x)); P.y = Math.min(h - 14, Math.max(50, P.y)); } }
    let ln = "";
    rbcEls.forEach((el, i) => { const P = pts[i]; if (el.textContent !== String(i + 1)) el.textContent = String(i + 1); el.style.left = `${P.x - 9}px`; el.style.top = `${P.y - 9}px`;
      if (Math.hypot(P.x - P.x0, P.y - P.y0) > 4 && P.x0 >= 0 && P.x0 <= w) ln += `<line x1="${P.x.toFixed(1)}" y1="${P.y.toFixed(1)}" x2="${P.x0.toFixed(1)}" y2="${P.y0.toFixed(1)}"/><circle cx="${P.x0.toFixed(1)}" cy="${P.y0.toFixed(1)}" r="2.5"/>`; });
    if (rbcSvg.__l !== ln) { rbcSvg.__l = ln; rbcSvg.innerHTML = ln; }
    rbcLayer.__cell = [cx0, cy0, cx1, cy1]; return;
  }
  rbcEls.forEach((el, i) => { if (el.textContent !== RBC_LABELS[i][1]) el.textContent = RBC_LABELS[i][1]; });
  const left = [], right = [];
  RBC_LABELS.forEach(([k], i) => { const [x, y] = prj(W.rbcAnchors[k].clone().add(A.rbc)); (x < (cx0 + cx1) / 2 ? left : right).push({ i, x, y }); });
  const minY = 54, gap = 30, colL = Math.max(cx0 - 36, (spotList.offsetLeft + spotList.offsetWidth) + 20), colR = Math.min(cx1 + 36, w - 20);
  let lines = "";
  for (const [side, list] of [["L", left], ["R", right]]) {
    list.sort((a, b) => a.y - b.y); let yPrev = minY - gap;
    for (const it of list) {
      const el = rbcEls[it.i], ly = Math.max(it.y, yPrev + gap); yPrev = ly;
      const wd = el.offsetWidth, lx = side === "L" ? colL - wd : colR;
      el.style.left = `${lx}px`; el.style.top = `${ly - 11}px`;
      const ex = side === "L" ? colL + 4 : colR - 4;
      lines += `<line x1="${ex.toFixed(1)}" y1="${ly.toFixed(1)}" x2="${it.x.toFixed(1)}" y2="${it.y.toFixed(1)}"/><circle cx="${it.x.toFixed(1)}" cy="${it.y.toFixed(1)}" r="3"/>`;
    }
  }
  if (rbcSvg.__l !== lines) { rbcSvg.__l = lines; rbcSvg.innerHTML = lines; }
  rbcLayer.__cell = [cx0, cy0, cx1, cy1];
}
function refreshRbcInfo() {
  if (viewName !== "rbc") return;
  const l = N().lung;
  setH($("rbcInfo"), `<p class="rbc-cap">One red blood cell, cut open, inside a small blood vessel: about 8 µm across, drawn about 90,000× larger than the body around it.</p>
    <div class="rbc-leg"><span><i style="background:#${satCol(1).getHexString()}"></i>hemoglobin with O₂</span><span><i style="background:#${satCol(0.1).getHexString()}"></i>hemoglobin without O₂</span><span><i style="background:#ff3b30"></i>O₂</span><span><i style="background:#59606a"></i>CO₂ (carbon)</span></div>
    <ol class="rbc-key">${RBC_LABELS.map(([, t]) => `<li>${t}</li>`).join("")}</ol>
    <div class="takeaway"><b>What this means</b>Each litre of blood leaving the lungs carries ${Math.round(l.Ca * 10)} mL of oxygen, almost all on hemoglobin; ${Math.round(l.Sa * 100)} % of it is loaded now.</div>`);
}

// ---------- animation driven by the model ----------
const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), s4 = new THREE.Vector3(1, 1, 1), p4 = new THREE.Vector3(), col = new THREE.Color();
const satCol = s => col.setRGB(0.42 + 0.4 * s, 0.1 + 0.05 * s, 0.32 - 0.25 * s, THREE.SRGBColorSpace);
let beatPhase = 0, breathPhase = 0;
function animate(dt, now) {
  const n = N(), c = n.circ, l = n.lung;
  const hr = Math.min(c.HR, HRMAX), rr = 12 + 28 * c.effort;     // breaths per minute: visual only
  beatPhase += dt * hr / 60; breathPhase += dt * rr / 60;
  const beat = Math.exp(-(((beatPhase % 1) * 6) ** 2)) * 0.09;
  W.organs.heart.scale.setScalar(1 + beat);
  const br = 0.5 - 0.5 * Math.cos(2 * Math.PI * breathPhase), depth = 0.03 + 0.05 * c.effort;
  W.organs.lungR.scale.set(1 + depth * br, 1 + depth * 0.6 * br, 1 + depth * br); W.organs.lungL.scale.copy(W.organs.lungR.scale);
  W.ribs.scale.set(1 + depth * 0.5 * br, 1, 1 + depth * 0.6 * br);
  W.organs.diaphragm.position.y = 104 - 2.5 * br * (1 + c.effort);
  // blood streams faster when the heart pumps more
  const v = 14 * c.CO / 5.8;
  for (const F of [W.flowArt, W.flowVein]) {
    F.items.forEach((it, i) => { it.u = (it.u + dt * v / it.v.len) % 1; it.v.curve.getPointAt(it.u, p4); m4.compose(p4, q4, s4); F.m.setMatrixAt(i, m4); });
    F.m.instanceMatrix.needsUpdate = true;
  }
  // air in and out
  const inhale = Math.sin(2 * Math.PI * breathPhase) > 0;
  W.air.items.forEach((it, i) => { it.u = (it.u + dt * (inhale ? 0.5 : -0.5) * (0.6 + c.effort)) % 1; if (it.u < 0) it.u += 1; it.c.getPointAt(it.u, p4); p4.addScaledVector(it.jitter, 0.6); m4.compose(p4, q4, s4); W.air.m.setMatrixAt(i, m4); });
  W.air.m.instanceMatrix.needsUpdate = true;
  // working muscles glow
  if (!heatMode) W.muscleMat.emissiveIntensity = 0.05 + 1.1 * c.effort * (0.85 + 0.15 * Math.sin(now / 300));
  // heat: skin colour, sweat beads, rising warm air
  const th = n.th;
  W.drops.count = Math.round(Math.min(1, Math.max(0, (th.w - 0.08) / 0.6)) * 420);
  const heatOut = (th.q_sensible + th.e_skin) * P.bsa, nh = Math.round(Math.min(120, Math.max(0, heatOut / 8)));
  W.heat.m.count = nh;
  W.heat.items.forEach((it, i) => { if (i >= nh) return; it.y += dt * 12; it.a += dt * 0.5; if (it.y > 190) it.y = 20 + Math.random() * 40; const s = 0.5 + 0.8 * ((it.y - 20) / 170); m4.compose(p4.set(it.x * (1 + (it.y - 20) / 400) + Math.sin(it.a * 4) * 2, it.y, it.z + 14 * (it.x > 0 ? 0.2 : -0.2)), q4, s4.setScalar(s)); W.heat.m.setMatrixAt(i, m4); });
  s4.set(1, 1, 1); W.heat.m.instanceMatrix.needsUpdate = true;
  // bladder fills with urine; stomach with food
  const bl = body.y[9]; if (bl > 0.45) body.void();
  W.organs.bladder.scale.setScalar(0.6 + 1.0 * Math.cbrt(Math.max(bl, 0) / 0.45));
  W.organs.stomach.scale.setScalar(1 + 0.25 * Math.min(1, (body.y[3] / 1000) / 60));
  if (viewName === "rbc") {
    for (let i = 0; i < W.rbcHb.count; i++) W.rbcHb.setColorAt(i, satCol(i / W.rbcHb.count < l.Sa ? 1 : 0.1));
    W.rbcHb.instanceColor.needsUpdate = true;
  }
}
const lerpN = (a, b, u) => a + (b - a) * u;

// ---------- loop ----------
// post-processing: GTAO ambient occlusion (opaque tissue only), subtle bloom for glowing things, SMAA, ACES output
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const gtao = new GTAOPass(scene, camera, 16, 16);
gtao.updateGtaoMaterial({ radius: 6, distanceExponent: 1.5, thickness: 4, scale: 1.0, samples: 16 });
gtao.blendIntensity = 0.85;
{ const base = gtao.overrideVisibility.bind(gtao);   // keep the see-through skin, particles and decals out of the AO buffer
  gtao.overrideVisibility = () => { base(); scene.traverse(o => { if (o.isMesh && (o.userData.noAO || o.material?.transparent || o.isInstancedMesh)) o.visible = false; }); }; }
const bloom = new UnrealBloomPass(new THREE.Vector2(16, 16), 0.25, 0.45, 1.05);
const smaa = new SMAAPass(16, 16);
composer.addPass(gtao); composer.addPass(bloom); composer.addPass(new OutputPass()); composer.addPass(smaa);
function setQuality(high) { Q.high = high; gtao.enabled = high; bloom.enabled = high; smaa.enabled = true; }
setQuality(Q.high);
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
  renderer.setSize(w, h, false); composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix(); drawCharts();
}
// frame-time watchdog: if frames stay slow for ~3 s, drop to the low tier
const fps = { acc: 0, n: 0, slow: 0 };
function watchFrames(dt) {
  if (!Q.high) return; fps.acc += dt; fps.n++;
  if (fps.acc > 1) { const mean = fps.acc / fps.n; fps.slow = mean > 1 / 28 ? fps.slow + 1 : 0; fps.acc = 0; fps.n = 0;
    if (fps.slow >= 3) { setQuality(false); renderer.setPixelRatio(Math.min(renderer.getPixelRatio(), 1.25)); resize(); } }
}
new ResizeObserver(resize).observe(stage);
let playing = !matchMedia("(prefers-reduced-motion: reduce)").matches, simAcc = 0, last = performance.now(), uiT = 0;
$("play").textContent = playing ? "Pause" : "Play";
$("play").onclick = () => { playing = !playing; $("play").textContent = playing ? "Pause" : "Play"; };
renderer.setAnimationLoop(now => {
  const dt = Math.min((now - last) / 1000, 0.1); last = now;
  if (!stage.clientWidth || !stage.clientHeight) return;
  if (playing) {
    simAcc += dt * +$("rate").value;
    let k = 0; while (simAcc >= 1 && k < 40) { body.step(); autoMeal(); record(); simAcc -= 1; k++; }
  }
  animate(dt, now); if (heatMode) heatArrows();
  if (now - uiT > 250) { refreshAll(); uiT = now; }
  if (beacon.visible) { const s = 1 + 0.18 * Math.sin(now / 220); beacon.children[0].scale.set(s, s, 1); beacon.quaternion.copy(camera.quaternion); }
  if (tween) {
    const u = Math.min((now - tween.t0) / tween.dur, 1), e = u * u * (3 - 2 * u);
    camera.position.lerpVectors(tween.from.p, tween.to.p, e); controls.target.lerpVectors(tween.from.c, tween.to.c, e);
    if (u >= 1) tween = null;
  }
  key.position.set(controls.target.x + 80, controls.target.y + 200, controls.target.z + 160); key.target.position.copy(controls.target); key.target.updateMatrixWorld();
  controls.update(); composer.render(dt); placeSpots(); placeRbcLabels(); watchFrames(dt);
});
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", drawCharts);
new MutationObserver(drawCharts).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });


// ---------- courses panel (shared ChemE Digital Twins format) ----------
const PS_URL = "../problems/";
const crs = { open: false, aud: "student", kind: "all", hi: null };
const featById = Object.fromEntries(FEATURES.map(f => [f.id, f]));
function flashSec(id) {
  const el = $(id); if (el.classList.contains("fold")) setFold(el, true);
  el.scrollIntoView({ block: "nearest", behavior: "smooth" }); el.classList.add("lens-hl"); setTimeout(() => el.classList.remove("lens-hl"), 1800);
}
const GO = {
  readouts: () => flashSec("sec-live"), activity: () => flashSec("sec-act"), food: () => flashSec("sec-food"),
  lungs: () => openLens(3, 1), heart: () => { goTo("organs"); flashSec("sec-organs"); },
  kidney: () => openLens(5, 1), liver: () => openLens(6, 0), heat: () => { setHeat(true); goTo("body"); },
  glucose: () => openLens(7, 1), pk: () => openLens(1, 0), molecules: () => goTo("rbc"), model: () => flashSec("sec-about"),
};
const famColor = f => FAMILIES[f]?.[1] || "#888";
function renderCourses() {
  const list = COURSES.filter(c => crs.kind === "all" || (crs.kind === "core" ? c.core : !c.core));
  const head = list.map(c => `<th class="${crs.hi === c.n ? "hi" : ""}"><button type="button" data-c="${c.n}" title="${c.n}: ${c.title}">${c.n.replace("CBE ", "")}</button></th>`).join("");
  const rows = FEATURES.map(f => `<tr><td><button type="button" class="crs-go" data-go="${f.go}" title="Show this in the twin">${f.name}</button></td>${list.map(c =>
    `<td class="${crs.hi === c.n ? "hi" : ""}">${c.features.includes(f.id) ? `<i style="background:${famColor(c.topics[0][1])}" title="${c.n} uses ${f.name}"></i>` : ""}</td>`).join("")}</tr>`).join("");
  const cards = list.map(c => `<article class="crs-card ${crs.hi === c.n ? "hi" : ""}" id="crs-${c.n.replace(/\s/g, "")}">
      <header><a href="${courseUrl(c.n)}" target="_blank" rel="noopener" title="${c.n}: ${c.title} in the UW–Madison Guide">${c.n} ↗</a><span class="crs-term">${c.term}</span></header>
      <h4>${c.title}</h4>
      <div class="crs-topics">${c.topics.map(([t, fam]) => `<span><i style="background:${famColor(fam)}"></i>${t}</span>`).join("")}</div>
      <div class="crs-uses">${c.features.map(id => featById[id]).filter(Boolean).map(f => `<button type="button" class="crs-go" data-go="${f.go}">${f.name} →</button>`).join("")}</div>
      <p class="crs-act"><span>${crs.aud === "student" ? "Try this" : "Use in class"}</span>${crs.aud === "student" ? c.student : c.instructor}</p>
      <a class="crs-ps" href="${PS_URL}#body-${c.n.replace("CBE ", "")}" target="_blank" rel="noopener">Problem set ↗</a>
    </article>`).join("");
  const fams = [...new Set(list.flatMap(c => c.topics.map(t => t[1])))];
  $("crsBody").innerHTML = `
    <p class="crs-intro"><b>One process, many courses:</b> this digital twin shows how balances, thermodynamics, transport, fluid flow, separations, kinetics and control work together in a real system, the human body.</p>
    <p class="crs-intro">${list.length} courses use this digital twin. Topic names follow the CBE Curriculum Navigator; click a feature to jump to it, or a course number to find its card.</p>
    <h5>Course map <small>(rows: features of the twin · columns: courses, in curriculum order)</small></h5>
    <div class="crs-scroll"><table class="crs-map"><thead><tr><th></th>${head}</tr></thead><tbody>${rows}</tbody></table></div>
    <p class="crs-intro"><a class="crs-ps" href="${PS_URL}#body-Integrative" target="_blank" rel="noopener">Integrative problem ↗</a> One runner in a hot marathon, followed through CBE 250, 310, 326, 320, 426 and 470 on the same operating point (setup link in the problem set).</p>
    <h5>Courses</h5><div class="crs-grid">${cards}</div>
    <p class="crs-legend">${fams.map(k => `<span><i style="background:${famColor(k)}"></i>${FAMILIES[k]?.[0] || k}</span>`).join("")}</p>`;
}
function toggleCourses(on = !crs.open) {
  crs.open = on; $("crsPanel").hidden = !on; $("btnCrs").setAttribute("aria-expanded", String(on));
  if (on && typeof mdl !== "undefined" && mdl.open) toggleModel(false);
  if (on) { renderCourses(); $("crsClose").focus(); } else $("btnCrs").focus({ preventScroll: true });
}
$("crs-summary").textContent = `Used in ${COURSES.length} courses (${COURSES.filter(c => c.core).length} core, ${COURSES.filter(c => !c.core).length} elective)`;
$("btnCrs").onclick = () => toggleCourses(true);
$("btnCrsHdr").onclick = () => toggleCourses(!crs.open);
$("crsClose").onclick = () => toggleCourses(false);
for (const [id, key, prop] of [["crsAud", "a", "aud"], ["crsKind", "k", "kind"]]) $(id).addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return; crs[prop] = b.dataset[key];
  $(id).querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); renderCourses();
});
$("crsBody").addEventListener("click", e => {
  const g = e.target.closest(".crs-go"); if (g) { toggleCourses(false); if (lens && !["glucose", "pk"].includes(g.dataset.go)) closeLens(); GO[g.dataset.go]?.(); return; }
  const h = e.target.closest("th button[data-c]"); if (h) { crs.hi = crs.hi === h.dataset.c ? null : h.dataset.c; renderCourses();
    document.getElementById("crs-" + h.dataset.c.replace(/\s/g, ""))?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && crs.open) { e.stopImmediatePropagation(); toggleCourses(false); } }, true);


// ---------- ∑ Model panel: equations (KaTeX, MathML output), parameters, method, assumptions, validation ----------
const EQS = equations({ body });
const mdl = { open: false };
const refsHtml = ids => ids.length ? R(...ids) : ` <span class="tag-assumed">assumed</span>`;
function renderModel() {
  const groups = [...new Set(EQS.map(e => e.group))];
  const GROUP_COURSES = { "Activity and whole-body balances": [250], "Thermoregulation: Gagge two-node model": [310, 470], "Heart and blood flow": [326], "Lungs and gas exchange": [320, 426],
    "Kidneys and body water": [426], "Liver and caffeine (pharmacokinetics)": [255, 430], "Glucose and insulin (control)": [470, 560], "Heat sources, organ reactors and the thermal camera": [250, 310, 320] };
  // one card per equation (football format): header · typeset equation · ASSUMED line · symbols table · live line
  const eqCard = e => `<article class="mdl-eq" id="eq-${e.n}">
      <div class="mdl-h"><span class="mdl-n">(${e.n})</span><span class="mdl-name">${e.name}${e.refs.length ? R(...e.refs) : ""}</span><button class="btn mdl-go" type="button" data-go="${e.go}" title="Close the panel and show where this happens in the twin">Show in the twin ▸</button></div>
      <div class="mdl-tex" data-tex="${encodeURIComponent(e.tex)}"></div>
      ${e.assumed ? `<p class="mdl-assumed"><span class="mdl-src">assumed</span>${mathify(e.assumed)}</p>` : ""}
      <div class="mdl-scroll"><table class="mdl-tab"><thead><tr><th>Symbol</th><th>Meaning</th><th>Units</th><th>Value or range</th></tr></thead><tbody>${e.syms.map(([sy, m, u, v]) => `<tr><td data-tex-i="${encodeURIComponent(sy)}"></td><td>${mathify(m)}</td><td>${u}</td><td>${mathify(v)}</td></tr>`).join("")}</tbody></table></div>
      <p class="mdl-live" data-live="${e.n}"></p>
    </article>`;
  const eqHtml = groups.map(g => { const list = EQS.filter(e => e.group === g); return `<h4 class="mdl-grp">${g} <small>Eqs. (${list[0].n})–(${list.at(-1).n})</small> ${(GROUP_COURSES[g] || []).map(courseLink).join(" ")}</h4>` + list.map(eqCard).join(""); }).join("");
  const params = `<div class="mdl-scroll"><table class="mdl-tab"><thead><tr><th>Parameter</th><th>Symbol</th><th>Value</th><th>Units</th><th>Source</th></tr></thead><tbody>${PARAMS.map(([nm, sy, v, u, ref, note]) =>
    `<tr><td>${mathify(nm)}${note ? `<br><small style="color:var(--ink-2)">${mathify(note)}</small>` : ""}</td><td class="v">${mathify(sy, true)}</td><td class="v">${v}</td><td class="v">${u}</td><td>${ref ? R(ref) : `<span class="tag-assumed">assumed</span>`}</td></tr>`).join("")}</tbody></table></div>`;
  $("mdlBody").innerHTML = `
    <h5>1. What is modeled</h5>
    <p>The system is one healthy 70 kg body treated as a set of connected unit operations. <b>States:</b> core and skin temperature, skin blood flow and the controller signals (Gagge two-node model); blood glucose, insulin and insulin action; glucose in two gut tanks; caffeine in the gut and in body water; drunk water in the gut; the body water deficit; and urine in the bladder. <b>Algebraic sub-models</b> solved each minute: oxygen use and heat (1–2), organ blood flows and the heart (11–14), lung gas exchange (16–22), kidney filtration and urine (23–26) and liver clearance (28–29). <b>Inputs you can change:</b> activity, air temperature, humidity, altitude, meals, caffeine dose, drinking and the water deficit. <b>Outputs shown:</b> heart rate and cardiac output, O₂ saturation, core temperature, sweat, blood sugar, caffeine, water balance, organ flows, lung pressures, filtration and urine, liver extraction.</p>
    <h5>2. Governing equations <small>(${EQS.length} equations, all solved in sim.js; live lines use the current state)</small></h5>
    ${eqHtml}
    <h5>3. Parameters and data</h5>${params}
    <h5>4. Numerical method</h5><ul>${METHOD.map(m => `<li>${mathify(m)}</li>`).join("")}</ul>
    <h5>5. Assumptions and limits</h5><ul>${ASSUMPTIONS.map(m => `<li>${mathify(m)}</li>`).join("")}</ul>
    <h5>6. Validation</h5><p class="takeaway"><b>In short</b>The twin's math was rebuilt independently in Python and agrees to better than 2 parts in 100,000 everywhere, and its body numbers (heart output, kidney filtering, oxygen loading, caffeine and sugar curves) land inside textbook ranges.</p><ul>
      <li><b>Reference implementation (thermoregulation):</b> the JavaScript Gagge model matches pythermalcomfort 3.3.0 and the current upstream source of <code>two_nodes_gagge</code>${R("ptc2020")} to a relative 5 × 10⁻¹⁶ over 96 conditions × 59 minutes (5–40 °C, 30 and 70 % humidity, rest to running, 1 and 0.69 atm).</li>
      <li><b>Independent re-implementation:</b> every other sub-model was rewritten in Python and solved with SciPy (LSODA ODE solver at 10⁻¹¹ tolerance, Brent root finding) instead of the twin's RK4 and bisection. Lungs, 56 cases: ${MI(String.raw`|\Delta P_{a}\mathrm{O_2}| \le 3\times10^{-7}\ \mathrm{mmHg}`)}, ${MI(String.raw`|\Delta S_{a}\mathrm{O_2}| \le 7\times10^{-9}`)}. A 10-hour day with a meal, two caffeine doses, a jog, a run, altitude, cold air and drinks: core temperature within 1.5 × 10⁻⁶ °C, heart rate 1.4 × 10⁻⁶ relative, all ten ODE states within 2 × 10⁻⁷ relative except insulin (1.8 × 10⁻⁵, at the kink where secretion switches on).</li>
      <li><b>Physiology benchmarks</b> (not used to fit, except where marked): blood at rest reaches air-sac PO₂ within 0.26 s (textbook 0.25 s${R("loyola")}); resting cardiac output 5.4 L/min (4–8 L/min${R("os-cv")}); GFR 121 mL/min (about 125${R("os-kid")}); 99.1 % of filtered water reabsorbed (99 %${R("os-kid")}); caffeine peak at 46 min after a dose (30–60 min${R("caf-rev")}; ${MI("k_a")} chosen for this); 2-hour glucose after 75 g is 124 mg/dL (normal ≤ 140${R("cdc-glucose")}; ${MI("\\gamma")} calibrated for this); urine about 1.5 L/day when hydrated (calibrated${R("os-fluid")}).</li>
      <li><b>Heat and gas balances (32)–(35):</b> organ heats add up to M exactly; the flow-weighted O₂ content leaving all organ beds equals the mixed venous content of (22) within 2 × 10⁻¹¹ mL/dL, so O₂ loaded in the lungs equals O₂ used by the organs, and CO₂ made equals CO₂ breathed out; organ heat, storage and local skin temperature match the Python version to 10⁻¹³ or better.</li>
      <li><b>Conservation:</b> the water deficit (3) equals the time integral of the listed losses minus drinking and metabolic water; the energy and O₂/CO₂ totals in the Balances lens are integrals of (1)–(2) and R·V̇O₂.</li></ul>`;
  typeset($("mdlBody"));
  modelLive();
}
function modelLive() {
  if (!mdl.open) return;
  $("mdlBody").querySelectorAll("[data-live]").forEach(el => { const e = EQS[+el.dataset.live - 1]; let t; try { t = e.live(); } catch (err) { t = "—"; } setH(el, `Live: <b>${mathify(t)}</b>`); });
}
function eqNums(str) {   // "(1)–(3)" -> [1,2,3]; "(32), (34), (35)" -> [32,34,35]
  const out = []; for (const part of str.split(",")) { const m = part.match(/\((\d+)\)(?:\s*–\s*\((\d+)\))?/); if (!m) continue; const a0 = +m[1], b0 = m[2] ? +m[2] : a0; for (let k = a0; k <= b0; k++) out.push(k); }
  return out.slice(0, 3);
}
function openEq(k) { toggleModel(true); setTimeout(() => { const el = $("eq-" + k); if (!el) return; el.scrollIntoView({ block: "start", behavior: "smooth" }); el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1600); }, 60); }
function toggleModel(on = !mdl.open) {
  mdl.open = on; $("mdlPanel").hidden = !on; $("btnModel").setAttribute("aria-expanded", String(on));
  if (on) { if (crs.open) toggleCourses(false); if (!$("mdlBody").childElementCount) renderModel(); else modelLive(); $("mdlClose").focus(); }
}
$("btnModel").onclick = () => toggleModel();
$("mdlClose").onclick = () => toggleModel(false);
$("mdlBody").addEventListener("click", e => {
  const g = e.target.closest(".mdl-go"); if (g) { toggleModel(false); if (lens && !["glucose", "pk"].includes(g.dataset.go)) closeLens(); GO[g.dataset.go]?.(); return; }
  if (e.target.closest("a.ref")) toggleModel(false);
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && mdl.open) { e.stopImmediatePropagation(); toggleModel(false); } }, true);

// ---------- circulation map: lungs (gas exchanger), heart (pump), organs (reactors) ----------
const circ = { open: false };
function renderCirc() {
  const n = N(), G = bedGas(n), l = n.lung, c = n.circ, f1c = v => v.toFixed(1), f0c = v => Math.round(v);
  const names = { brain: "Brain", heart: "Heart muscle", muscle: "Skeletal muscle", skin: "Skin", kidneys: "Kidneys", gut: "Gut", other: "Liver, spleen etc." };
  const keys = Object.keys(names), bw = 128, gap = 10, x0 = 22, by = 400;
  const red = "#c5050c", blue = "#1f6fd1";
  const box = (x, y, w, h, title, lines, stroke) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="#fff" stroke="${stroke}" stroke-width="2"/>
    <text x="${x + 10}" y="${y + 20}" font-family="Barlow Semi Condensed" font-weight="700" font-size="15" fill="#1d2733">${title}</text>` +
    lines.map((t, i) => `<text x="${x + 10}" y="${y + 39 + i * 16}" font-family="JetBrains Mono" font-size="11.5" fill="#1d2733">${t}</text>`).join("");
  const arrow = (d, col, label, lx, ly, anchor = "start") => `<path d="${d}" fill="none" stroke="${col}" stroke-width="5" stroke-linecap="round" marker-end="url(#ah-${col === red ? "r" : "b"})" opacity=".85"/>` +
    (label ? `<text x="${lx}" y="${ly}" text-anchor="${anchor}" font-family="JetBrains Mono" font-size="11.5" fill="${col}">${label}</text>` : "");
  let beds = "";
  keys.forEach((k, i) => { const b = G.beds[k], x = x0 + i * (bw + gap);
    beds += box(x, by, bw, 124, names[k], [`Q ${f1c(b.Q)} L/min`, `O₂ used ${f0c(b.VO2)}`, `CO₂ made ${f0c(b.VCO2)}`, `extracts ${f0c(b.ext * 100)} %`, `out C_v ${f1c(b.Cv)}`], b.ext > 0.5 ? red : "#cfd6de");
    beds += `<line x1="${x + bw * 0.3}" y1="372" x2="${x + bw * 0.3}" y2="${by}" stroke="${red}" stroke-width="3"/><line x1="${x + bw * 0.7}" y1="${by + 124}" x2="${x + bw * 0.7}" y2="545" stroke="${blue}" stroke-width="3"/>`; });
  const right = x0 + keys.length * (bw + gap) - gap;
  const svg = `<svg viewBox="0 0 1000 560" role="img" aria-label="Circulation map with live oxygen and carbon dioxide flows">
    <defs><marker id="ah-r" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M0,0L10,5L0,10z" fill="${red}"/></marker>
      <marker id="ah-b" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M0,0L10,5L0,10z" fill="${blue}"/></marker></defs>
    ${box(330, 14, 340, 128, "Lungs · gas exchanger (diffusion)", [`O₂ into blood  ${f0c(G.VO2)} mL/min`, `CO₂ out in breath ${f0c(G.VCO2)} mL/min`, `air sacs PO₂ ${f0c(l.PAO2)}, PCO₂ ${f0c(l.PaCO2)} mmHg`, `blood ${f0c(l.Sv * 100)}% → ${f0c(l.Sa * 100)}% O₂-saturated`, `${l.tT.toFixed(2)} s in a capillary`], "#1d2733")}
    ${box(360, 205, 280, 112, "Heart · two pumps in series", [`${f0c(c.HR)} beats/min × ${f0c(c.SV)} mL`, `= ${f1c(c.CO)} L/min each side`, `left pump power ΔP·Q ≈ ${G.pumpW.toFixed(1)} W`, `(MAP ${f0c(c.MAP)} mmHg × flow)`], "#1d2733")}
    ${arrow("M 400 205 C 330 190, 300 140, 330 95", blue, `to lungs: C<tspan baseline-shift="sub" font-size="9">v</tspan> ${f1c(G.Cmix)} mL/dL`, 120, 160)}
    ${arrow("M 670 95 C 710 140, 680 190, 610 205", red, `from lungs: C<tspan baseline-shift="sub" font-size="9">a</tspan> ${f1c(l.Ca)} mL/dL`, 700, 160)}
    ${arrow(`M 640 270 C 900 270, ${right - 40} 330, ${right - 40} 366`, red, `aorta ${f1c(c.CO)} L/min`, 760, 262)}
    <line x1="${x0 + bw * 0.3}" y1="372" x2="${right - 40}" y2="372" stroke="${red}" stroke-width="5"/>
    <line x1="${x0 + bw * 0.7}" y1="545" x2="${right - bw * 0.3}" y2="545" stroke="${blue}" stroke-width="5"/>
    ${arrow(`M ${x0 + bw * 0.7} 545 C 6 545, 6 270, 360 270`, blue, `veins ${f1c(c.CO)} L/min`, 30, 262)}
    ${beds}
    <text x="250" y="360" text-anchor="middle" font-family="Barlow" font-size="12" fill="#5d6875">organs as reactors in parallel · O₂ and CO₂ in mL/min · contents in mL O₂ per dL of blood</text>
  </svg>`;
  const ex = c.CO * 10 * (l.Ca - G.Cmix);
  setH($("circBody"), `<p class="crs-intro">Live, for the body as it is now (${actLabel()}, ${tT(body.cfg.tdb, 0)}, ${body.cfg.alt} m). Red: oxygen-rich blood; blue: oxygen-poor blood.</p>
    <div class="circ-scroll">${svg}</div>
    <p class="circ-bal">O₂ balance: lungs load ${MI(String.raw`\mathit{CO}\,(C_a - C_v) = ${TN(f1c(c.CO))}\times 10\times(${TN(f1c(l.Ca))} - ${TN(f1c(G.Cmix))}) = ${TN(f0c(ex))}\ \mathrm{mL/min}`)} = sum of organ use ${f0c(G.VO2)} mL/min ✓</p>
    <p class="circ-bal">CO₂ balance: organs make ${MI(String.raw`R\,\dot V_{\mathrm{O_2}} = 0.8\times ${TN(f0c(G.VO2))} = ${TN(f0c(G.VCO2))}\ \mathrm{mL/min}`)}; breathing removes ${MI(String.raw`\dfrac{\dot V_A\,P_{A}\mathrm{CO_2}}{0.863} = \dfrac{${TN(f1c(l.VA))}\times ${TN(f1c(l.PaCO2))}}{0.863} = ${TN(f0c(l.VA * l.PaCO2 / 0.863))}\ \mathrm{mL/min}`)} ✓</p>
    <div class="takeaway"><b>What this means</b><b>Blood is a delivery loop that always balances.</b> Every minute the lungs load ${f0c(G.VO2)} mL of oxygen, exactly what the organs burn, and the CO₂ the organs make (${f0c(G.VCO2)} mL) is breathed out. ${n.circ.effort > 0.3 ? `Working muscle now takes ${f0c(G.beds.muscle.VO2 / G.VO2 * 100)} % of the oxygen and returns its blood ${f0c(100 - G.beds.muscle.ext * 100)} % full, so the heart must pump faster.` : "At rest the brain and liver are the biggest oxygen users; switch to Marathon to see muscle take over."}</div>
    <div class="circ-grid">
      <article><h4>The heart is two pumps</h4>Right side: lungs; left side: organs. Power = pressure × flow = ${G.pumpW.toFixed(1)} W of the ${f0c(n.M)} W the body makes. <span class="eqn">${MI(String.raw`P = \Delta P\,Q,\quad \mathit{CO} = \mathit{HR}\,\mathit{SV}`)} (eq. 13)</span></article>
      <article><h4>Lungs: gas diffusion</h4>O₂ and CO₂ diffuse down their pressure differences. Blood: ${f0c(l.Sv * 100)} % → ${f0c(l.Sa * 100)} % saturated. <span class="eqn">${MI(String.raw`\dot V_{\mathrm{O_2}} = D_L\,(P_{A}\mathrm{O_2} - P)`)} (eq. 21)</span></article>
      <article><h4>Organs: reactors in parallel</h4>Cells burn fuel with O₂, making CO₂, water and heat. O₂ extracted: muscle ${f0c(G.beds.muscle.ext * 100)} %, kidneys ${f0c(G.beds.kidneys.ext * 100)} %. <span class="eqn">${MI(String.raw`C_{v,i} = C_a - \dot V_{\mathrm{O_2},i}/Q_i`)} (eq. 33)</span></article>
      <article><h4>CO₂ balance and breathing control</h4>0.8 L CO₂ per L O₂. Breathing removes CO₂ as fast as it is made, holding PCO₂ near ${f0c(l.PaCO2)} mmHg. <span class="eqn">${MI(String.raw`\dot V_A = 0.863\,\dot V_{\mathrm{CO_2}}/P_{A}\mathrm{CO_2}`)} (eq. 19)</span></article>
    </div>
    <p class="note">Organ O₂ use comes from organ heat production (eq. 32): resting rates per kg of organ (Elia, as tested by Wang et al.${R("wang2010")}) times the organ masses of 70 kg adults, with exercise heat going to working muscle and heart work rising with pressure × flow. Venous CO₂ content is not modeled; only CO₂ flows are shown.</p>`);
}
function toggleCirc(on = !circ.open) { circ.open = on; $("circPanel").hidden = !on; if (on) { if (tlab.open) toggleTlab(false); if (crs.open) toggleCourses(false); if (mdl.open) toggleModel(false); renderCirc(); $("circClose").focus(); } }
$("btnCirc").onclick = () => toggleCirc();
$("circClose").onclick = () => toggleCirc(false);
$("circBody").addEventListener("click", e => { if (e.target.closest("a.ref")) toggleCirc(false); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && circ.open) { e.stopImmediatePropagation(); toggleCirc(false); } }, true);


// ---------- Thermo Lab: the body as a temperature-controlled reactor; the same day with feedback on and off ----------
const tlab = { open: false, scn: "exercise", runs: null };
function tlabCompute() { const S = THERMO_SCENARIOS[tlab.scn]; tlab.runs = { on: thermoRun(S, false), off: thermoRun(S, true), S }; }
function renderTlab() {
  if (!tlab.runs) tlabCompute();
  const n = N(), th = n.th, B = heatBalance(n), H = organHeat(n), mblL = th.m_bl * P.bsa / 60, sweat = (th.m_rsw_reg || 0) * P.bsa, shiv = (th.shiver || 0) * P.bsa;
  const dryIn = B.dry < 0;
  const row = (what, reactor, house, body, val) => `<tr><td><b>${what}</b></td><td>${reactor}</td><td>${house}</td><td>${body}</td><td class="v">${val}</td></tr>`;
  const analogy = `<div class="circ-scroll"><table class="tl-analogy"><thead><tr><th>Role</th><th>Jacketed chemical reactor</th><th>House</th><th>Your body</th><th>Now</th></tr></thead><tbody>
    ${row("Heat generation", "exothermic reaction", "furnace", "metabolism: cells burning food", `${Math.round(B.M)} W`)}
    ${row("Heat input from outside", "hot feed or hot surroundings", "sun and hot air", "air or surfaces hotter than the skin", dryIn ? `${Math.round(-B.dry)} W in` : "none now")}
    ${row("Heat removal", "coolant through the jacket", "walls and windows", "blood carries heat to the skin, which loses it to the air", dryIn ? "0 W" : `${Math.round(B.dry)} W`)}
    ${row("Extra cooling", "evaporative cooler", "air conditioner", "sweat evaporating", `${Math.round(B.evap)} W`)}
    ${row("Extra heating", "steam heater", "furnace on high", "shivering", `${Math.round(shiv)} W`)}
    ${row("Temperature sensor", "thermocouple", "thermostat sensor", "nerve sensors in skin and brain", `core ${tT(th.t_core)}, skin ${tT(th.t_skin)}`)}
    ${row("Controller and set point", "temperature controller", "thermostat dial", "hypothalamus, set near " + tT(36.8), `error ${th.t_core >= 36.8 ? "+" : "−"}${tD(Math.abs(th.t_core - 36.8), 2)}`)}
    ${row("Valve the controller moves", "coolant valve", "fan speed", "skin blood vessels widen or narrow", `${mblL.toFixed(2)} L/min to skin`)}
    ${row("Heat capacity (slows changes)", "reactor contents", "the house's air and walls", "70 kg of watery tissue, about 3.5 kJ per kg per degree", `${(P.mass * 3.492 / (U.f ? 1.8 : 1)).toFixed(0)} kJ per ${tU()}`)}
  </tbody></table></div>`;
  const red = "#c5050c", blue = "#1f6fd1", ink = "#1d2733";
  const blk = (x, y, w, h, t1, t2, col = ink) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9" fill="#fff" stroke="${col}" stroke-width="2"/><text x="${x + w / 2}" y="${y + 22}" text-anchor="middle" font-family="Barlow Semi Condensed" font-weight="700" font-size="15" fill="${ink}">${t1}</text><text x="${x + w / 2}" y="${y + 41}" text-anchor="middle" font-family="JetBrains Mono" font-size="11.5" fill="${ink}">${t2}</text>`;
  const ar = (d, col = ink) => `<path d="${d}" fill="none" stroke="${col}" stroke-width="2.5" marker-end="url(#ta)"/>`;
  const loop = `<svg viewBox="0 0 960 250" role="img" aria-label="Feedback loop that holds body temperature">
    <defs><marker id="ta" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0L10,5L0,10z" fill="${ink}"/></marker></defs>
    ${blk(10, 40, 130, 56, "Set point", tT(36.8), "#cfd6de")}
    <circle cx="185" cy="68" r="17" fill="#fff" stroke="${ink}" stroke-width="2"/><text x="185" y="73" text-anchor="middle" font-size="16" font-family="Barlow" fill="${ink}">Σ</text><text x="168" y="98" font-size="12" fill="${ink}" font-family="Barlow">−</text>
    ${ar("M140 68 L166 68")}
    ${blk(226, 40, 190, 56, "Controller: hypothalamus", `error ${th.t_core >= 36.8 ? "+" : "−"}${tD(Math.abs(th.t_core - 36.8), 2)}`, red)}
    ${ar("M202 68 L224 68")}
    ${blk(450, 30, 200, 76, "Actuators", `skin flow ${mblL.toFixed(2)} L/min`, red)}<text x="550" y="88" text-anchor="middle" font-family="JetBrains Mono" font-size="11.5" fill="${ink}">sweat ${Math.round(sweat)} g/h · shiver ${Math.round(shiv)} W</text>
    ${ar("M416 68 L448 68")}
    ${blk(700, 40, 240, 56, "Body (the process)", `M ${Math.round(B.M)} W in · ${Math.round(B.dry + B.evap + B.breath)} W out`)}
    ${ar("M650 68 L698 68")}
    ${ar("M820 96 L820 190 L185 190 L185 87", blue)}
    <text x="500" y="182" text-anchor="middle" font-family="Barlow" font-size="13" fill="${blue}">sensors feed back core temperature ${tT(th.t_core)} and skin ${tT(th.t_skin)}</text>
    ${ar("M820 10 L820 38", "#b26a00")}<text x="812" y="22" text-anchor="end" font-family="Barlow" font-size="12.5" fill="#b26a00">disturbances: exercise, weather</text>
    <text x="480" y="232" text-anchor="middle" font-family="Barlow" font-size="12.5" fill="#5d6875">negative feedback: if the core warms, the error grows and the actuators remove more heat; if it cools, they hold heat in</text>
  </svg>`;
  const R1 = tlab.runs, Ton = R1.on.map(r => r.Tc), Toff = R1.off.map(r => r.Tc);
  const devOn = Math.max(...Ton.map(T => Math.abs(T - 36.8))), devOff = Math.max(...Toff.map(T => Math.abs(T - 36.8)));
  const peakFlow = Math.max(...R1.on.map(r => r.mbl)) * P.bsa / 60, peakSweat = Math.max(...R1.on.map(r => r.sweat)), peakShiv = Math.max(...R1.on.map(r => r.shiver));
  const offEnd = Toff.at(-1), offWorst = Toff.reduce((a, b) => Math.abs(b - 36.8) > Math.abs(a - 36.8) ? b : a, 36.8);
  const verdict = offWorst >= 39.5 ? "heatstroke territory" : offWorst <= 35 ? "hypothermia (below 35 °C, 95 °F)" : "a fever-like drift";
  const hrs = R1.S.minutes / 60;
  $("tlabBody").innerHTML = `
    <p class="takeaway"><b>In short</b>Your body makes heat all the time, like a reactor running an exothermic reaction. It stays near ${tT(36.8)} because a feedback controller keeps heat out equal to heat in. Switch the controller off and the same day ends in ${verdict}.</p>
    <h5 style="margin:12px 0 0;font:700 12.5px var(--font-display);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-2)">1. The analogy, with your body's numbers right now</h5>${analogy}
    <h5 style="margin:12px 0 0;font:700 12.5px var(--font-display);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-2)">2. The feedback loop</h5><div class="circ-scroll">${loop}</div>
    <h5 style="margin:12px 0 0;font:700 12.5px var(--font-display);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-2)">3. Experiment: the same ${hrs}-hour day, temperature control on and off</h5>
    <div class="seg" role="group" aria-label="Scenario" id="tlScn">${Object.entries(THERMO_SCENARIOS).map(([k, v]) => `<button type="button" data-s="${k}" aria-pressed="${k === tlab.scn}">${v.label.replace(/(\d+) °C/g, (m, x) => tT(+x, 0))}</button>`).join("")}</div>
    <canvas id="tlChart" aria-label="Core temperature with and without feedback control"></canvas>
    <div class="legend-row"><span><i class="sw" style="background:${red}"></i>Control on (normal body)</span><span><i class="sw" style="background:${blue}"></i>Control off (thought experiment)</span><span><i class="sw" style="background:#9aa3ad"></i>Set point ${tT(36.8)}</span></div>
    <div class="tl-sum">
      <div>Largest drift, control on<b>${tD(devOn, 1)}</b></div>
      <div>Largest drift, control off<b>${tD(devOff, 1)}</b></div>
      <div>Core temperature at the end, off<b>${tT(offEnd)}</b></div>
      <div>What the controller used (peak)<b style="font-size:13px">skin flow ${peakFlow.toFixed(2)} L/min · sweat ${Math.round(peakSweat)} g/h · shiver ${Math.round(peakShiv)} W</b></div>
    </div>
    <p class="takeaway"><b>What this means</b><b>Feedback keeps the core within ${tD(devOn, 1)} of its set point; without it the core would drift ${tD(devOff, 1)}.</b> ${tlab.scn === "cold" ? `In cold air the controller narrows skin vessels and shivers (up to ${Math.round(peakShiv)} W, like turning a furnace up) so heat loss is matched.` : tlab.scn === "hot" ? `In hot, humid air heat even flows in from the air, so sweating (up to ${Math.round(peakSweat)} g/h) and wide-open skin vessels must carry it all away.` : `During the jog the body makes about 8 times more heat; the controller opens skin vessels and turns on sweat (up to ${Math.round(peakSweat)} g/h) within minutes.`} This is the same negative-feedback idea chemical engineers use to hold a reactor at temperature.</p>
    <p class="note">The control-off run keeps skin blood flow fixed at its neutral value and switches off sweating and shivering in the same Gagge model (eq. 9); it is a thought experiment, and the model is not meant for temperatures far outside the normal range.</p>`;
  $("tlScn").querySelectorAll("button").forEach(b => b.onclick = () => { tlab.scn = b.dataset.s; tlab.runs = null; renderTlab(); });
  drawTlChart();
}
function drawTlChart() {
  const p = prepCanvas($("tlChart")); if (!p || !tlab.runs) return; const { g, w, h } = p;
  const on = tlab.runs.on, off = tlab.runs.off, all = on.concat(off).map(r => r.Tc).concat([36.8]);
  let lo = Math.floor(Math.min(...all) - 0.3), hi = Math.ceil(Math.max(...all) + 0.3); if (hi - lo < 2) hi = lo + 2;
  const xL = 46, xR = w - 10, yT = 10, yB = h - 34, N = on.length, X = t => xL + (t / N) * (xR - xL), Y = T => yB - (T - lo) / (hi - lo) * (yB - yT);
  g.strokeStyle = "#e1e5ea"; g.lineWidth = 1; g.font = `11px ${css("--font-data")}`; g.fillStyle = "#5d6875";
  // ticks on round numbers of the unit being shown (°C or °F)
  const toD = T => (U.f ? T * 1.8 + 32 : T), fromD = D => (U.f ? (D - 32) / 1.8 : D), span = toD(hi) - toD(lo);
  const step = span > 16 ? 4 : span > 8 ? 2 : 1;
  for (let D = Math.ceil(toD(lo) / step) * step; D <= toD(hi) + 1e-9; D += step) { const T = fromD(D); g.beginPath(); g.moveTo(xL, Y(T)); g.lineTo(xR, Y(T)); g.stroke(); g.textAlign = "right"; g.fillText(String(D), xL - 5, Y(T) + 4); }
  for (let m = 0; m <= N; m += 60) { g.textAlign = m === 0 ? "left" : m === N ? "right" : "center"; g.fillText(`${m / 60} h`, X(m), yB + 14); }
  g.textAlign = "center"; g.fillText("time since start", (xL + xR) / 2, h - 3);
  g.save(); g.translate(11, (yT + yB) / 2); g.rotate(-Math.PI / 2); g.fillText(`core temperature, ${tU()}`, 0, 0); g.restore();
  // activity bands
  for (const sg of tlab.runs.S.steps) if (sg[1] !== "rest") { const nx = tlab.runs.S.steps.find(x => x[0] > sg[0]); g.fillStyle = "rgba(197,5,12,.07)"; g.fillRect(X(sg[0]), yT, X(nx ? nx[0] : N) - X(sg[0]), yB - yT); g.fillStyle = "#9b0000"; g.textAlign = "left"; g.fillText(sg[1], X(sg[0]) + 4, yT + 12); }
  g.setLineDash([5, 4]); g.strokeStyle = "#9aa3ad"; g.beginPath(); g.moveTo(xL, Y(36.8)); g.lineTo(xR, Y(36.8)); g.stroke(); g.setLineDash([]);
  for (const [run, colr] of [[off, "#1f6fd1"], [on, "#c5050c"]]) { g.strokeStyle = colr; g.lineWidth = 2.2; g.beginPath(); run.forEach((r, i) => { const x = X(r.t), y = Y(r.Tc); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); }
}
function toggleTlab(on = !tlab.open) { tlab.open = on; $("tlabPanel").hidden = !on; if (on) { if (crs.open) toggleCourses(false); if (mdl.open) toggleModel(false); if (circ.open) toggleCirc(false); renderTlab(); $("tlabClose").focus(); } }
$("btnTlab").onclick = () => toggleTlab(true);
$("btnTlabHdr").onclick = () => toggleTlab();
$("tlabClose").onclick = () => toggleTlab(false);
document.addEventListener("keydown", e => { if (e.key === "Escape" && tlab.open) { e.stopImmediatePropagation(); toggleTlab(false); } }, true);
// unit switch
function setUnits(f) {
  U.f = f; try { localStorage.setItem("body-units", f ? "F" : "C"); } catch (e) {}
  $("unitSeg").querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String((b.dataset.u === "F") === f)));
  $("tdb-out").textContent = tT(+$("tdb").value, 0); if (heatMode) drawThermBar();
  refreshAll(); if (tlab.open) renderTlab();
}
$("unitSeg").addEventListener("click", e => { const b = e.target.closest("button"); if (b) setUnits(b.dataset.u === "F"); });

// ---------- problem-set setups: #ps=<course>-<k> ----------
function loadSetup(key) {
  const S = SETUPS[key]; if (!S) return false;
  AUTO_MEAL.on = false;
  if (crs.open) toggleCourses(false);
  if (lens) closeLens();
  lensCard.hidden = true; $("realworld").setAttribute("aria-pressed", "false");
  hist.length = 0;
  applySetup(body, S, () => record());
  record(); prefill();
  const c = body.cfg;
  [["tdb", c.tdb, v => tT(v, 0)], ["rh", c.rh, v => `${v} %`], ["alt", c.alt, v => `${v.toLocaleString("en-US")} m`], ["def", Math.round(body.y[8] * 10) / 10, v => `${v.toFixed(1)} L`]]
    .forEach(([id, v, f]) => { $(id).value = v; $(id + "-out").textContent = f(+v); });
  setAct(c.act);
  playing = false; $("play").textContent = "Play";
  setHeat(!!S.heat);
  goTo(S.view || "body", true);
  (S.open || []).forEach(id => setFold($(id), true));
  if (S.lens) openLens(S.lens[0], S.lens[1]);
  refreshAll();
  return true;
}
const psKey = () => (location.hash.match(/^#ps[=-](int-\d+|\d+-d?\d+)$/) || [])[1];
window.addEventListener("hashchange", () => { const k = psKey(); if (k) loadSetup(k); });

// ---------- about ----------
$("about-1").innerHTML = `An integrative case for UW–Madison CBE students. Models: Gagge two-node thermoregulation${R("gagge1986")} (ported from pythermalcomfort${R("ptc2020")}); activity O₂ use${R("compendium")} at about 5 kcal/L O₂${R("franklin2026")}; organ flows${R("os-cv")}; alveolar gas equation${R("ortiz2019")}, West atmosphere${R("west1996")}, alveolar CO₂${R("west1983")}, Hill O₂ curve${R("dash2010")}, diffusing capacity${R("hsia2016")}; Bergman glucose model${R("bergman1979")}${R("saleem2024")} with a two-tank gut${R("hovorka2004")}; caffeine one-compartment model${R("caf-rev")}, well-stirred liver${R("wellstirred")}, Michaelis–Menten${R("mm1913")}. Checked against independent Python: ≤ 2 × 10⁻⁵ relative (10⁻¹⁵ vs pythermalcomfort).`;
$("about-2").innerHTML = `<span class="tag-assumed">assumed</span> 70 kg, 1.83 m², age ${P.age}; 0.3 clo; VO₂max ${P.VO2max} mL/kg/min; stroke volume ${P.SV0} → ${P.SVmax} mL; muscle O₂ extraction ${P.Emus * 100} %; filtration fraction 0.2; urine 50–1200 mOsm/kg; hemoglobin 15 g/dL; insulin gain ${MI("\\gamma")} = ${P.gam} (normal 2-h glucose${R("cdc-glucose", "ogtt")}). Stylized 3D body. Not medical advice.`;

// ---------- start ----------
setAct("rest"); goTo("body", true); resize(); if (U.f) setUnits(true);
if (!(psKey() && loadSetup(psKey()))) { let seen = false; try { seen = localStorage.getItem("body-intro-seen") === "1"; } catch (e) {} if (!seen) openIntro(); }
window.__app = { placeRbcLabels, refreshRbcInfo, record, drawCharts, placeSpots, refreshAll, heatArrows, refreshEbox, setPop, animate, controls, body, P, Q, setQuality, renderer, composer, W, scene, loadSetup, toggleCourses, openLens, closeLens, openIntro, goTo, LENSES, SPOTS, camera, setAct, setHeat, hist };
