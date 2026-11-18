import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { setupRendering, SUN_DIR } from "./render.js";
import { CELLS, cycle, aging, derive, ocvAt } from "./cell.js";
import { CHAIN, EF } from "./lca.js";
const EF_MFG_KWH = EF.mfgElecKWh, EF_LI = { NMC: EF.li.NMC, LFP: EF.li.LFP };
import { AT, EV_SCALE, EV_Z, buildWorld, buildZoom, setLattice } from "./scene.js";
import { COURSE, REFS, buildLenses, introHTML, aboutHTML, SPOTS } from "./content.js";

const $ = id => document.getElementById(id);
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
import { DEF, evaluate, meanOCV as meanOCVof } from "./model.js";
import { FEATURES, COURSES, FAMILIES } from "./courses.js";
import { SETUPS } from "./setups.js";
import { RESEARCH, CENTERS } from "./research.js";
import { equations, parameterRows } from "./modelpanel.js";
const S = { ...DEF };
let CYC = null, AG = null, L = null, RC = null;

// ---------- renderer / scene ----------
const stage = $("stage");
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
stage.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 20000);   // near/far follow the viewing distance each frame
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.495; controls.maxDistance = 9000;
scene.add(new THREE.HemisphereLight("#e3edf8", "#8a7c66", 0.6));
const sun = new THREE.DirectionalLight("#fff1dc", 3.0);
sun.castShadow = true; sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);
const R3 = setupRendering(renderer, scene, camera, sun);
const W = buildWorld(scene), Z = buildZoom(scene);
setLattice(Z, S.chem);

// ---------- model ----------
let runTimer = 0;
function runModel() {
  const d = derive(S.chem), c = CELLS[S.chem];
  const E = evaluate(S, { profiles: true });
  CYC = E.CYC; AG = E.AG; L = E.L; RC = E.RC; S.nomWh = E.nomWh;
  const capLeft = E.capLeft, nomWh = E.nomWh;
  // readouts
  $("r-make").textContent = `${L.make.toFixed(0)} kg CO₂e/kWh`;
  $("r-life").textContent = S.cycles ? `${(L.life * 1000).toFixed(0)} g CO₂e` : "– (no cycles yet)";
  $("r-cap").textContent = `${(capLeft * 100).toFixed(1)} % (${(S.cycles / 365).toFixed(1)} yr)`;
  $("r-eff").textContent = `${(CYC.eff * 100).toFixed(1)} %`;
  $("r-T").textContent = `${CYC.Tmax.toFixed(1)} °C`;
  $("r-tch").textContent = `${Math.round(CYC.tCharge / 60)} min`;
  $("cell-note").textContent = `${c.model} (${c.name}): ${d.Q.toFixed(2)} Ah, ${nomWh.toFixed(1)} Wh. 1 C ≈ full charge in an hour.`;
  const plating = CYC.phiNmin < 0;
  $("plating").hidden = !plating;
  $("plating").textContent = plating ? "⚠ Lithium-plating risk: charge slower or warm the cell." : "";
  $("chain-note").innerHTML = cite(CHAIN.note(S));
  drawLCA(); drawVT(); renderRecycle(); updateBars(); lensRefresh(); updateConds(); renderTakeaways();
  simT = Math.min(simT, CYC.tCycle);
}
function meanOCV() { return meanOCVof(S.chem); }
function schedule() { clearTimeout(runTimer); runTimer = setTimeout(runModel, 50); }


// ---------- plain-language takeaways (Part J), built from the live numbers ----------
const TK = (id, html) => { const el = $(id); if (el) el.innerHTML = `<b>What this means</b>${cite(html)}`; };
const ICE_KG_PER_KM = 38000 / 200000;   // IEA GEO 2024: 38 t CO₂-eq over a medium gasoline car's ~200,000 km life (cars bought in 2035)
function renderTakeaways() {
  if (!L || !CYC) return;
  const life = L.life * 1000, share = life / S.gridU * 100, km = L.make * 75 / ICE_KG_PER_KM;
  TK("tk-results", `${share < 30 ? "The battery adds little" : "The battery adds a lot"} to each kWh: <b>+${life.toFixed(0)} g CO₂e</b> on top of the grid's ${S.gridU} g. Building a 75 kWh pack ≈ a gasoline car driving ${(Math.round(km / 100) * 100).toLocaleString()} km.[[iea_lca]]`);
  const top = L.stages.filter(x => x.group !== "use" && x.group !== "eol").sort((a, b) => b.kg - a.kg)[0];
  TK("tk-lca", `Biggest bar: <b>${top.label.toLowerCase()}</b> (${top.kg.toFixed(1)} of ${L.make.toFixed(1)} kg). ${top.key === "cellmfg" ? "A cleaner factory grid shrinks it most." : top.key === "lithium" ? (S.li === "rock" ? "Brine lithium would cut it." : "Brine is already the cleaner source.") : "Recycling these metals earns the green credit."}`);
  TK("tk-cell", CYC.phiNmin < 0 ? `<b>Too fast for the cold:</b> lithium may plate as metal. Charge slower or warm the cell.` : CYC.Tmax > 45 ? `<b>Fast charging runs hot:</b> ${CYC.Tmax.toFixed(0)} °C speeds aging. Charge slower or cool the cell.` : `<b>Gentle on the cell:</b> peak ${CYC.Tmax.toFixed(0)} °C. You get back ${(100 * CYC.eff).toFixed(0)} of every 100 units of energy you put in.`);
  const liKg = L.stages.find(x => x.key === "lithium").kg, other = S.li === "brine" ? "rock" : "brine", liOther = L.mats.liChem * EF_LI[S.chem][other];
  TK("tk-chain", `Lithium for 1 kWh: <b>${liKg.toFixed(1)} kg CO₂e</b> (from ${other}: ${liOther.toFixed(1)} kg).[[kelly]] Factory electricity adds ${(EF_MFG_KWH * S.gridF / 1000).toFixed(1)} kg; ${S.gridF > 300 ? "a cleaner grid would cut that." : "this grid is already clean."}`);
  const rec = RC.rows.reduce((a, r) => a + (r.rec ? r.g * r.rec : 0), 0);
  TK("tk-recycle", S.route === "none" ? `<b>Landfill wastes the metals</b> and risks fires. Try Hydro to see what comes back.` : `${L.eol < 0 ? "<b>Recycling saves carbon:</b>" : "<b>Recycling costs carbon here:</b>"} ${Math.round(rec)} g of metal per kWh back, net ${L.eol < 0 ? "−" : "+"}${Math.abs(L.eol).toFixed(1)} kg CO₂e. ${S.route === "pyro" ? "Smelting loses the lithium." : ""}`);
}
// ---------- charts ----------
function prepCanvas(c) {
  const dpr = devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight;
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  const g = c.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h); return [g, w, h];
}
let lcaRows = [];
function drawLCA() {
  const c = $("lca"); if (!c.clientWidth || !L) return;
  const [g, w, h] = prepCanvas(c);
  const rows = L.stages, lab = 128, pr = 40;
  const lo = Math.min(0, ...rows.map(r => r.kg)), hi = Math.max(...rows.map(r => r.kg), 1);
  const X = v => lab + (w - lab - pr) * (v - lo) / (hi - lo);
  const rh = (h - 18) / rows.length;
  g.font = "12px Barlow, sans-serif"; g.textBaseline = "middle";
  lcaRows = [];
  rows.forEach((r, i) => {
    const y = 4 + i * rh + rh / 2;
    g.fillStyle = css("--ink-2"); g.textAlign = "left"; g.fillText(r.label, 0, y);
    const x0 = X(0), x1 = X(r.kg);
    const bh = Math.min(14, rh - 6);
    g.fillStyle = r.kg < 0 ? css("--ok") : css("--signal");
    const xa = Math.min(x0, x1), wb = Math.max(Math.abs(x1 - x0), 1.5);
    g.beginPath(); g.roundRect ? g.roundRect(xa, y - bh / 2, wb, bh, r.kg < 0 ? [4, 0, 0, 4] : [0, 4, 4, 0]) : g.rect(xa, y - bh / 2, wb, bh); g.fill();
    g.fillStyle = css("--ink"); g.font = "11.5px JetBrains Mono, monospace";
    g.textAlign = "left"; g.fillText(`${r.kg >= 0 ? "" : "−"}${Math.abs(r.kg).toFixed(1)}`, Math.max(x0, x1) + 5, y);
    g.font = "12px Barlow, sans-serif";
    lcaRows.push({ y0: y - rh / 2, y1: y + rh / 2, r });
  });
  g.strokeStyle = css("--rule"); g.beginPath(); g.moveTo(X(0), 2); g.lineTo(X(0), h - 16); g.stroke();
  g.fillStyle = css("--ink-2"); g.font = "10.5px JetBrains Mono, monospace"; g.textAlign = "right";
  g.fillText("kg CO₂e per kWh of battery →", w - 2, h - 6);
  $("lca-legend").innerHTML = `<span><i class="sw" style="background:var(--signal)"></i>Emitted</span><span><i class="sw" style="background:var(--ok)"></i>Credit for recycled metal</span><span>Hover a bar for its source</span>`;
}
$("lca").addEventListener("mousemove", e => {
  const b = e.currentTarget.getBoundingClientRect(), y = e.clientY - b.top;
  const row = lcaRows.find(r => y >= r.y0 && y < r.y1);
  e.currentTarget.title = row ? uncite(`${row.r.label}: ${row.r.kg.toFixed(1)} kg CO₂e per kWh. ${row.r.how}`) : "";
});
// live trends (footer strip): one replayed charge cycle, with a cursor at the current moment
function trendChart(id, series, yfmt, rightAxis) {
  const c = $(id); if (!c || !c.clientWidth || !CYC) return;
  const [g, w, h] = prepCanvas(c);
  const tr = CYC.trace, tEnd = tr[tr.length - 1][0];
  const pl = 34, pr = rightAxis ? 34 : 8, pt = 5, pb = 15;
  const X = t => pl + (w - pl - pr) * t / tEnd;
  g.font = "10px JetBrains Mono, monospace"; g.lineWidth = 1;
  const s0 = series[0], Y0 = v => pt + (h - pt - pb) * (1 - (v - s0.lo) / (s0.hi - s0.lo));
  for (let k = 0; k <= 3; k++) {
    const v = s0.lo + (s0.hi - s0.lo) * k / 3, y = Y0(v);
    g.strokeStyle = css("--rule"); g.beginPath(); g.moveTo(pl, y); g.lineTo(w - pr, y); g.stroke();
    g.fillStyle = css("--ink-2"); g.textAlign = "right"; g.fillText(yfmt(v), pl - 4, y + 3);
    if (rightAxis) { const s1 = series[1], v1 = s1.lo + (s1.hi - s1.lo) * k / 3; g.textAlign = "left"; g.fillText(rightAxis(v1), w - pr + 4, y + 3); }
  }
  g.fillStyle = css("--ink-2");
  const hrs = tEnd / 3600, step = hrs > 6 ? 2 : 1;
  for (let t = 0; t <= hrs + 1e-9; t += step) { g.textAlign = t === 0 ? "left" : "center"; g.fillText(`${t} h`, X(t * 3600), h - 3); }
  series.forEach(s => {
    const Y = v => pt + (h - pt - pb) * (1 - (v - s.lo) / (s.hi - s.lo));
    g.beginPath();
    if (s.flat != null) { g.moveTo(pl, Y(s.flat)); g.lineTo(w - pr, Y(s.flat)); g.setLineDash([4, 3]); }
    else tr.forEach((r, i) => i ? g.lineTo(X(r[0]), Y(s.f(r))) : g.moveTo(X(r[0]), Y(s.f(r))));
    g.strokeStyle = s.col; g.lineWidth = s.flat != null ? 1 : 2; g.stroke(); g.setLineDash([]);
    if (s.flat == null) { const r = sample(simT); g.fillStyle = s.col; g.beginPath(); g.arc(X(simT), Y(s.f(r)), 3, 0, 7); g.fill(); }
  });
  g.strokeStyle = css("--ink"); g.lineWidth = 1; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(X(simT), pt); g.lineTo(X(simT), h - pb); g.stroke(); g.setLineDash([]);
}
function drawVT() {
  if (!CYC) return;
  const tr = CYC.trace, cc = CELLS[S.chem];
  trendChart("ts-v", [{ f: r => r[1], lo: cc.Vmin, hi: cc.Vmax, col: css("--accent") }], v => v.toFixed(1));
  const Ts = tr.map(r => r[3]), lo = Math.floor(Math.min(S.Tamb, ...Ts) - 1), hi = Math.ceil(Math.max(S.Tamb, ...Ts) + 1);
  trendChart("ts-t", [{ f: r => r[3], lo, hi, col: css("--signal") }, { flat: S.Tamb, lo, hi, col: css("--ink-2") }], v => v.toFixed(0));
  const Imax = Math.max(1, ...tr.map(r => Math.abs(r[5]))) * 1.1;
  trendChart("ts-q", [{ f: r => r[2] * 100, lo: 0, hi: 100, col: css("--ok") }, { f: r => r[5], lo: -Imax, hi: Imax, col: css("--warn") }], v => v.toFixed(0), v => v.toFixed(1));
}
function renderRecycle() {
  $("yield").innerHTML = `<tr><th>In 1 kWh of cells</th><th>Mass</th><th>Recovered</th></tr>` +
    RC.rows.map(r => `<tr><td>${r.el}</td><td>${r.g.toFixed(0)} g</td><td>${r.rec == null ? "–" : (r.rec * 100).toFixed(0) + " %"}</td></tr>`).join("");
  $("reagents").innerHTML = RC.reagents.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
  $("route-note").innerHTML = cite(RC.note);
  W.hydro.visible = true; W.pyro.visible = true;
  W.loopLine.visible = W.loopArrow.visible = S.route !== "none";
}

// ---------- footprint bars in 3D (Footprint view) ----------
let co2Mode = false;
const FP_SHORT = { lithium: "Lithium", metals: "Nickel + cobalt", graphite: "Graphite", foils: "Cu + Al foils", cellmfg: "Factory energy", use: "Charging losses (life)", eolproc: "Recycling process", eolcredit: "Recycling credit" };
let fpBars = [];
function updateBars() {
  while (W.bars.children.length) W.bars.children.pop();
  $("fplabels").innerHTML = ""; fpBars = [];
  if (!L) return;
  const mx = Math.max(...L.stages.map(s => Math.abs(s.kg)), 1);
  L.stages.forEach((s, i) => {
    const at = s.at === "ev" ? { x: AT.ev.x, z: EV_Z } : AT[s.at], hgt = 8 + 300 * Math.abs(s.kg) / mx;
    const col = s.kg < 0 ? "#2f9a5c" : new THREE.Color().setHSL(0.08 - 0.08 * Math.abs(s.kg) / mx, 0.85, 0.5).getStyle();
    const off = (L.stages.filter((t, j) => t.at === s.at && j < i).length) * 46;
    const b = new THREE.Mesh(new THREE.BoxGeometry(40, hgt, 40), new THREE.MeshStandardMaterial({ color: col, transparent: true, opacity: 0.85, roughness: 0.5 }));
    b.position.set(at.x - 60 + off, hgt / 2, (s.at === "ev" ? 0 : at.z) + 95); W.bars.add(b);
    const el = document.createElement("div"); el.className = "fpl" + (s.kg < 0 ? " credit" : "");
    el.innerHTML = `${s.key === "eolproc" && S.route === "none" ? "Landfill" : FP_SHORT[s.key] || s.label} <b>${s.kg < 0 ? "−" : ""}${Math.abs(s.kg).toFixed(1)}</b>`;
    $("fplabels").appendChild(el);
    fpBars.push({ el, pos: [b.position.x, hgt + 4, b.position.z] });
  });
  renderFpKey();
}
function renderFpKey() {
  if (!L) return;
  const use = L.stages.find(x => x.key === "use").kg, eol = L.eol;
  const top = L.stages.filter(x => x.group !== "use" && x.group !== "eol").sort((a, b) => b.kg - a.kg)[0];
  $("fpkey-body").innerHTML = `<p>Each column is the CO₂ released at that stage <b>for 1 kWh of battery capacity</b>, from mine to recycling. The number on it is in <b>kg CO₂e per kWh</b>.</p>
    <div class="fk-leg"><span class="sw" style="background:linear-gradient(90deg,hsl(29,85%,50%),hsl(0,85%,50%))"></span><span>Emitted: taller and redder = more CO₂</span>
    <span class="sw" style="background:#2f9a5c"></span><span>Credit: recycled metal replaces new mining</span></div>
    <p class="fk-tot">Making the cell ${L.make.toFixed(1)} · charging losses over its life ${use.toFixed(1)} · end of life ${eol < 0 ? "−" : "+"}${Math.abs(eol).toFixed(1)} kg CO₂e/kWh</p>
    <div class="takeaway"><b>What this means</b>To make the cell, <b>${top.label.toLowerCase()}</b> is the biggest column (${top.kg.toFixed(1)} kg). ${use > L.make ? `Over its life, the energy lost while charging adds even more (${use.toFixed(1)} kg), so a clean charging grid matters most.` : `Charging losses over its life add ${use.toFixed(1)} kg.`}</div>`;
}
function setCO2Mode(on) {
  co2Mode = on; W.bars.visible = on; $("fpkey").hidden = $("fplabels").hidden = !on;
  if (on) $("fpkey").open = stage.clientWidth > 860;
  $("mode-real").setAttribute("aria-pressed", String(!on)); $("mode-co2").setAttribute("aria-pressed", String(on));
  if (on && !lens) goTo("chain");
}
$("mode-real").onclick = () => setCO2Mode(false);
$("mode-co2").onclick = () => setCO2Mode(true);

// ---------- controls ----------
function bindRange(id, key, fmt, scale = 1) {
  const el = $(id), out = $(id + "-out");
  const upd = () => { S[key] = +el.value * scale; out.textContent = fmt(+el.value); schedule(); };
  el.addEventListener("input", upd); out.textContent = fmt(+el.value);
}
bindRange("crate", "C", v => `${v} C`);
bindRange("tamb", "Tamb", v => `${v} °C`);
bindRange("dod", "dod", v => `${v} %`, 0.01);
bindRange("cycles", "cycles", v => `${v.toLocaleString()}`);
bindRange("gridF", "gridF", v => `${v} g/kWh ${CHAIN.gridName(v)}`);
bindRange("gridU", "gridU", v => `${v} g/kWh ${CHAIN.gridName(v)}`);
function setChem(ch) {
  S.chem = ch; ["NMC", "LFP"].forEach(k => $("chem-" + k).setAttribute("aria-pressed", String(k === ch)));
  setLattice(Z, ch); schedule();
}
["NMC", "LFP"].forEach(k => $("chem-" + k).onclick = () => setChem(k));
function setLi(k) { S.li = k; $("li-brine").setAttribute("aria-pressed", String(k === "brine")); $("li-rock").setAttribute("aria-pressed", String(k === "rock")); schedule(); }
$("li-brine").onclick = () => setLi("brine"); $("li-rock").onclick = () => setLi("rock");
function setRoute(k) { S.route = k; ["hydro", "pyro", "none"].forEach(r => $("route-" + r).setAttribute("aria-pressed", String(r === k))); schedule(); }
["hydro", "pyro", "none"].forEach(r => $("route-" + r).onclick = () => setRoute(r));
$("reset").onclick = () => {
  Object.assign(S, DEF);
  $("speed").value = String(SPEED0); simT = 0;
  [["crate", 1], ["tamb", 25], ["dod", 80], ["cycles", 1500], ["gridF", 528], ["gridU", 384]].forEach(([id, v]) => { $(id).value = v; $(id).dispatchEvent(new Event("input")); });
  setChem("NMC"); setLi("brine"); setRoute("hydro"); setCO2Mode(false);
};

// ---------- views / zoom ladder ----------
const V3 = (a, dx, dy, dz) => [a.x + dx, a.y + dy, a.z + dz];
const HERO = new THREE.Vector3(AT.ev.x - 3 * EV_SCALE, 0, EV_Z - 1.6 * EV_SCALE);   // hero car in the scaled EV hub
const VIEWS = {
  chain:     { fit: 1, dir: [-0.66, 0.58, 0.48], c: [-15, 0, 0], sh: 900, label: "Supply chain: mine → refinery → materials → cell factory → EV → recycling" },
  mine:      { p: V3(AT.mine, 140, 230, 420), c: V3(AT.mine, 0, -10, 20), sh: 330, label: "Lithium from brine ponds and a hard-rock mine" },
  refinery:  { p: V3(AT.refinery, 150, 150, 300), c: V3(AT.refinery, 10, 5, -20), sh: 150, label: "Refinery: lithium carbonate and hydroxide" },
  materials: { p: V3(AT.materials, 130, 150, 290), c: V3(AT.materials, 0, 5, -15), sh: 150, label: "Cathode and anode materials plant" },
  factory:   { p: V3(AT.factory, 25, 175, 175), c: V3(AT.factory, 0, 0, -10), sh: 130, label: "Cell factory: coating, drying, winding, formation" },
  ev:        { p: [HERO.x + 4.5 * EV_SCALE, 3.2 * EV_SCALE, HERO.z + 6.5 * EV_SCALE], c: [HERO.x, 1.25, HERO.z], sh: 12 * EV_SCALE, see: true, label: "EV pack: about 4,000–8,000 cells under the floor" },
  module:    { p: V3(AT.module, 22, 20, 30), c: V3(AT.module, 0, 3, 0), sh: 30, label: "Module: cells, busbars and a cooling plate (drawn 10× real size)" },
  cell:      { p: V3(AT.cell, 62, 72, 120), c: V3(AT.cell, 2, 33, 0), sh: 90, label: "Cell cut open: copper, graphite, separator, cathode, aluminium (100×, layers thickened)" },
  particles: { p: V3(AT.particles, 26, 38, 84), c: V3(AT.particles, 0, 20, 0), sh: 80, label: "Electrode particles and lithium ions (about 2,000×)" },
  lattice:   { p: V3(AT.lattice, 34, 40, 62), c: V3(AT.lattice, 0, 12, 0), sh: 60, label: "Crystal lattice (about 50 million ×)" },
  recycle:   { p: V3(AT.recycle, 110, 180, 320), c: V3(AT.recycle, 10, 0, -25), sh: 170, label: "Recycling: discharge → shred → black mass → leach / smelt" },
};
let tween = null, viewName = "chain";
// stage outlines (ground corners and landmark tops) that the overview must show
const CHAIN_PTS = [], OVERVIEW_FOV = 13, FOV = 34;   // a long lens in the overview keeps the far stages nearly as large as the near ones
[["mine", -185, 145, -230, 290], ["refinery", -110, 110, -110, 70], ["materials", -100, 100, -105, 70], ["factory", -100, 100, -75, 60], ["ev", -120, 120, -100, 75], ["recycle", -120, 120, -110, 70]].forEach(([k, x0, x1, z0, z1]) => {
  const a = k === "ev" ? new THREE.Vector3(AT.ev.x, 0, EV_Z) : AT[k];
  for (const x of [x0, x1]) for (const z of [z0, z1]) for (const y of [0, k === "mine" ? 10 : 70]) CHAIN_PTS.push(new THREE.Vector3(a.x + x, y, a.z + z));
});
function fitChain(dir, c) {
  const w = stage.clientWidth, h = stage.clientHeight, open = !$("spotlist").classList.contains("collapsed") && w > 860;
  const L = open ? 236 : 16, Rr = w - 16, T = 74, B = h - 16;   // free pixel box
  const cam = camera.clone(); cam.aspect = camera.aspect; cam.fov = OVERVIEW_FOV; cam.clearViewOffset(); cam.updateProjectionMatrix();
  const right = new THREE.Vector3(), up = new THREE.Vector3(), q = new THREE.Vector3();
  let d = 1500; c = c.clone();
  for (let it = 0; it < 12; it++) {
    cam.position.copy(dir).multiplyScalar(d).add(c); cam.lookAt(c); cam.updateMatrixWorld();
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    CHAIN_PTS.forEach(P => { q.copy(P).project(cam); const px = (q.x + 1) / 2 * w, py = (1 - q.y) / 2 * h; x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); });
    const s = Math.max((x1 - x0) / (Rr - L), (y1 - y0) / (B - T));
    // shift the target so the outline's centre lands on the free box's centre (the view offset adds its own 110 px shift)
    const wpp = 2 * d * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) / h;
    const dx = ((x0 + x1) / 2 - ((L + Rr) / 2 - (open ? 110 : 0))) * wpp, dy = ((y0 + y1) / 2 - (T + B) / 2) * wpp;
    right.setFromMatrixColumn(cam.matrixWorld, 0); up.setFromMatrixColumn(cam.matrixWorld, 1);
    c.addScaledVector(right, dx).addScaledVector(up, -dy);
    d *= 0.35 + 0.65 * s;
  }
  return { c, p: dir.clone().multiplyScalar(d).add(c) };
}
function goTo(name, instant = false) {
  const v = VIEWS[name]; viewName = name;
  document.querySelectorAll("[data-view]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.view === name)));
  $("zoomlabel").textContent = name === "lattice" ? `${S.chem === "NMC" ? "NMC811 layered oxide" : "LiFePO₄ olivine"} lattice (about 50 million ×)` : name === "particles" ? `Particles: graphite gold = full of lithium · cathode dark blue = full of lithium (≈2,000×)` : v.label;
  W.heroBody.transparent = true; W.heroBody.opacity = v.see ? 0.25 : 1; W.heroBody.needsUpdate = true;
  const s = v.sh; Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: s * 0.05, far: s * 5 }); sun.shadow.camera.updateProjectionMatrix();
  let to;
  if (v.fit) {   // frame the whole chain in the area left free (beside the spots table, below the banner), whatever the window shape
    const portrait = camera.aspect < 0.9;   // phones: look along the chain so it recedes into the distance
    if (portrait) { to = { c: new THREE.Vector3(...v.c) }; to.p = new THREE.Vector3(0.78, 0.55, 0.3).normalize().multiplyScalar(1650).add(to.c); }
    else to = fitChain(new THREE.Vector3(...v.dir).normalize(), new THREE.Vector3(...v.c));
  } else {
    to = { p: new THREE.Vector3(...v.p), c: new THREE.Vector3(...v.c) };
    // phones: step back so the scene fits a tall, narrow view
    if (stage.clientWidth < stage.clientHeight) to.p.sub(to.c).multiplyScalar(1.45).add(to.c);
  }
  to.fov = v.fit && camera.aspect >= 0.9 ? OVERVIEW_FOV : FOV;
  const zoomOn = ["module", "cell", "particles", "lattice"].includes(name);
  [Z.module, Z.cell, Z.particles, Z.lattice].forEach(g => g.visible = zoomOn);
  if (instant || matchMedia("(prefers-reduced-motion: reduce)").matches) { camera.position.copy(to.p); controls.target.copy(to.c); camera.fov = to.fov; camera.updateProjectionMatrix(); controls.update(); return; }
  tween = { from: { p: camera.position.clone(), c: controls.target.clone(), fov: camera.fov }, to, t0: performance.now(), dur: 1600 };
}
document.querySelectorAll("[data-view]").forEach(b => b.onclick = () => goTo(b.dataset.view));

// ---------- learn by subject ----------
const esc = s => s.replace(/&(?!amp;)/g, "&amp;");
const R = (...n) => `<sup class="refsup">${n.map(k => `<a href="#ref-${k}" class="ref" data-ref="${k}">${k}</a>`).join(",")}</sup>`;
const courseLink = n => `<a class="course" href="https://guide.wisc.edu/search/?P=CBE%20${n}" target="_blank" rel="noopener" title="CBE ${n}: ${COURSE[n][1]}">${esc(COURSE[n][0])} ↗</a>`;
$("refs").innerHTML = REFS.map((r, i) => `<li id="ref-${i + 1}">${r}</li>`).join("");
import { REFLIST } from "./refs.js";
const RN = k => REFLIST.findIndex(r => r.key === k) + 1;
const cite = str => String(str).replace(/\[\[([\w,]+)\]\]/g, (m, ks) => R(...ks.split(",").map(RN)));
const uncite = str => String(str).replace(/\[\[([\w,]+)\]\]/g, (m, ks) => ` (ref. ${ks.split(",").map(RN).join(", ")})`);
const ctx = { get cur() { return CUR; }, S, get CYC() { return CYC; }, get AG() { return AG; }, get L() { return L; }, get RC() { return RC; }, R, CELLS, derive, AT, HERO, meanOCV };
const LENSES = buildLenses(ctx);
$("about").innerHTML = aboutHTML(ctx);
const lensNav = $("lenses"), lensCard = $("lens-card");
LENSES.forEach((Lz, i) => {
  const b = document.createElement("button");
  b.type = "button"; b.textContent = COURSE[Lz.n][0]; b.dataset.i = i; b.setAttribute("aria-pressed", "false");
  b.title = `See where ${COURSE[Lz.n][0]} shows up in this digital twin`;
  b.onclick = () => (lens && lens.i === i ? closeLens() : openLens(i));
  lensNav.appendChild(b);
});

// scroll an overlay's own body to an element (scrollIntoView would also scroll the page behind it)
function scrollInPanel(bodyId, elId) { const b = $(bodyId), el = $(elId); if (!b || !el) return; b.scrollTop = el.getBoundingClientRect().top - b.getBoundingClientRect().top + b.scrollTop - 8; }
// ---------- Courses panel (shared ChemE Digital Twins format) ----------
const crs = { open: false, aud: "student", kind: "all", hi: null };
const openSec = id => { const el = $(id); if (el.classList.contains("fold")) setFold(el, true); el.scrollIntoView({ block: "nearest", behavior: "smooth" }); };
const lensIdx = n => LENSES.findIndex(l => l.n === n);
const GO = {   // jump to the part of the application a course uses
  chain: () => { goTo("chain"); setCO2Mode(true); },
  mine: () => goTo("mine"),
  lca: () => { setCO2Mode(false); goTo("chain"); openSec("sec-results"); },
  factory: () => { goTo("factory"); openSec("sec-chain"); },
  cell: () => { goTo("cell"); openSec("sec-cell"); },
  module: () => { goTo("module"); openSec("sec-cell"); },
  particles: () => goTo("particles"),
  kinetics: () => openLens(lensIdx(430)),
  lattice: () => goTo("lattice"),
  ev: () => { goTo("ev"); openSec("sec-cell"); },
  recycle: () => { goTo("recycle"); openSec("sec-recycle"); },
};
const featById = Object.fromEntries(FEATURES.map(f => [f.id, f]));
const famCol = f => FAMILIES[f]?.[1] || "#888";
const PS_URL = "../problems/";
$("crs-sum").textContent = `Used in ${COURSES.length} courses (${COURSES.filter(c => c.core).length} core, ${COURSES.filter(c => !c.core).length} electives), each with a problem set.`;
function renderCourses() {
  const list = COURSES.filter(c => crs.kind === "all" || (crs.kind === "core" ? c.core : !c.core));
  const map = `<div class="crs-scroll"><table class="crs-map"><thead><tr><th></th>${list.map(c => `<th class="${crs.hi === c.n ? "hi" : ""}"><button type="button" data-c="${c.n}" title="${c.n}: ${c.title}">${c.n.replace("CBE ", "")}</button></th>`).join("")}</tr></thead>
    <tbody>${FEATURES.map(f => `<tr><td><button type="button" class="crs-go" data-go="${f.go}" title="Show this in the twin">${f.name}</button></td>${list.map(c => `<td class="${crs.hi === c.n ? "hi" : ""}">${c.features.includes(f.id) ? `<i style="background:${famCol(c.topics[0][1])}" title="${c.n} uses ${f.name}"></i>` : ""}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  const cards = list.map(c => `<article class="crs-card ${crs.hi === c.n ? "hi" : ""}" id="crs-${c.n.replace(/\s/g, "")}">
      <header><a href="https://guide.wisc.edu/search/?P=${encodeURIComponent(c.n)}" target="_blank" rel="noopener" title="${c.n} in the UW–Madison Guide">${c.n} ↗</a><span class="crs-term">${c.term}</span></header>
      <h5>${c.title}</h5>
      <div class="crs-topics">${c.topics.map(([t, fam]) => `<span><i style="background:${famCol(fam)}"></i>${t}</span>`).join("")}</div>
      <div class="crs-uses">${c.features.map(id => featById[id]).map(f => `<button type="button" class="crs-go" data-go="${f.go}">${f.name} →</button>`).join("")}</div>
      <p class="crs-act"><span>${crs.aud === "student" ? "Try this" : "Use in class"}</span>${crs.aud === "student" ? c.student : c.instructor}</p>
      <a class="crs-ps" href="${PS_URL}#battery-${c.n.replace("CBE ", "")}" target="_blank" rel="noopener">Problem set ↗</a>
    </article>`).join("");
  const fams = [...new Set(list.map(c => c.topics[0][1]).concat(list.flatMap(c => c.topics.map(t => t[1]))))];
  $("crsBody").innerHTML = `
    <p class="crs-intro"><b>One process, many courses:</b> this digital twin shows how balances, thermodynamics, transport, kinetics, materials, control and design work together in one real system, from the mine to the recycling plant.</p>
    <p class="crs-intro">${list.length} courses use this digital twin. Topic names follow the CBE Curriculum Navigator; click a feature to jump to it, or a course number to find its card.</p>
    <h4 class="crs-h">Course map <small>(rows: features of the twin · columns: courses, in curriculum order)</small></h4>${map}
    <p class="crs-intro"><b>Design problem:</b> <a class="crs-ps" href="${PS_URL}#battery-440" target="_blank" rel="noopener">Product design ↗</a> choose the cells for an electric delivery van, then weigh their carbon footprint and the cobalt they contain (CBE 440).</p>
    <p class="crs-intro"><a class="crs-ps" href="${PS_URL}#battery-Integrative" target="_blank" rel="noopener">Integrative problem ↗</a> one operating point followed through CBE 310, 250, 326, 470, 430 and 450.</p>
    <h4 class="crs-h">Courses</h4><div class="crs-grid">${cards}</div>
    <p class="crs-legend">${fams.map(k => `<span><i style="background:${famCol(k)}"></i>${FAMILIES[k][0]}</span>`).join("")}</p>`;
}
function toggleCourses(on = !crs.open) {
  crs.open = on; $("crsPanel").hidden = !on;
  if (on) { if (mdl.open) toggleModel(false); renderCourses(); $("crsClose").focus(); } else $("crs-open").focus({ preventScroll: true });
}
$("crs-open").onclick = () => toggleCourses(true);
$("crs-open-hdr").onclick = () => toggleCourses(true);
$("crsClose").onclick = () => toggleCourses(false);
$("crsAud").onclick = e => { const b = e.target.closest("button"); if (!b) return; crs.aud = b.dataset.a; $("crsAud").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); renderCourses(); };
$("crsKind").onclick = e => { const b = e.target.closest("button"); if (!b) return; crs.kind = b.dataset.k; $("crsKind").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); renderCourses(); };
$("crsBody").addEventListener("click", e => {
  const g = e.target.closest(".crs-go"); if (g) { toggleCourses(false); GO[g.dataset.go]?.(); return; }
  const h = e.target.closest("th button[data-c]"); if (h) { crs.hi = crs.hi === h.dataset.c ? null : h.dataset.c; renderCourses();
    scrollInPanel("crsBody", "crs-" + h.dataset.c.replace(/\s/g, "")); }
});

// ---------- ∑ Model panel ----------
const EQN = { "How much lithium is in a battery?": [18], "A mass balance on the recycling line": [22], "The cell as a computer model": [4, 6, 11],
  "Where the voltage comes from": [4, 15], "Lithium has to diffuse into the particles": [6, 7], "Fast charging warms the cell": [15, 16],
  "Separating metals with solvent extraction": [23], "Reactions at the particle surface": [11, 12, 13], "A slow side reaction ages the battery": [14],
  "Crystals that breathe lithium": [2, 3], "Life-cycle assessment: from cradle to grave": [19, 20, 21], "The cell factory runs on electricity": [19],
  "Choosing the end of life": [20], "The battery-management system": [17], "Batteries and the energy system": [21], "A plastic film keeps the electrodes apart": [10] };
const mdl = { open: false, eqs: null };
const KATEX_JS = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js";
let katexP = null;
let _lensEqs = null; const lensEqs = () => _lensEqs || (_lensEqs = equations(ctx));
function typesetIn(root) {
  loadKatex().then(texOutput).then(output => { root.querySelectorAll("[data-tex]").forEach(el => { if (!el.dataset.done) { window.katex.render(decodeURIComponent(el.dataset.tex), el, { displayMode: true, throwOnError: false, output }); el.dataset.done = "1"; } }); inlineTex(root); })
    .catch(() => root.querySelectorAll("[data-tex]").forEach(el => el.textContent = decodeURIComponent(el.dataset.tex)));
}
// KaTeX renders as HTML with its own fonts (shipped with the page, katex-fonts/); MathML only if those fonts fail
let _out = null;
function texOutput() {
  if (_out) return Promise.resolve(_out);
  if (!document.fonts?.load) return Promise.resolve(_out = "htmlAndMathml");
  return Promise.race([document.fonts.load("1em KaTeX_Main").then(() => document.fonts.check("1em KaTeX_Main")), new Promise(r => setTimeout(() => r(false), 4000))])
    .then(ok => (_out = ok ? "htmlAndMathml" : "mathml")).catch(() => (_out = "mathml"));
}
// hand-written HTML math -> TeX: X<sub>y</sub>, Greek letters, partial derivatives -> inline $...$ for KaTeX
const GREEK = { "η": "\\eta", "φ": "\\phi", "σ": "\\sigma", "ε": "\\varepsilon", "δ": "\\delta", "κ": "\\kappa", "ν": "\\nu", "ρ": "\\rho", "β": "\\beta", "Δ": "\\Delta" };
function mt(html) {
  if (!html) return html;
  return String(html)
    .replace(/∂U<sub>ocv<\/sub>\/∂T/g, "$\\partial U_{\\mathrm{ocv}}/\\partial T$")
    .replace(/(Ū|[A-Za-zηφσεδκνρβΔ]{1,3})<sub>([^<]+)<\/sub>/g, (m, b, sub) => {
      const base = b === "Ū" ? "\\bar U" : b.replace(/[ηφσεδκνρβΔ]/g, g => GREEK[g] + " ").trim();
      const sb = /^[A-Za-z]{2,}$/.test(sub) || /^[A-Za-z]+,[A-Za-z]+$/.test(sub) ? `\\mathrm{${sub}}` : sub.replace(/max/g, "\\max");
      return `$${base}_{${sb}}$`;
    });
}
function inlineTex(root) {
  if (!window.katex) return;
  const out = _out || "htmlAndMathml";
  root.querySelectorAll(".mdl-tab td, .mdl-live, .mdl-assumed, .lc-live, .lc-eq, #mdlBody > p, #mdlBody li").forEach(el => {
    if (!el.innerHTML.includes("$")) return;
    el.innerHTML = el.innerHTML.replace(/\$([^$]+)\$/g, (m, t) => { try { return window.katex.renderToString(t.replace(/&amp;/g, "&"), { throwOnError: false, output: out }); } catch (e) { return t; } });
  });
}
const loadKatex = () => katexP || (katexP = new Promise((ok, no) => { if (window.katex) return ok(); const sc = document.createElement("script"); sc.src = KATEX_JS; sc.onload = ok; sc.onerror = no; document.head.appendChild(sc); }));
// Part V pass 2: one shared helper turns math written as plain text (bare Greek variables, ΔX, Σ, I²R, single-letter
// assignments such as "h = 10") into KaTeX, wherever the text appears or is updated later. Units and chemical formulas stay text.
const GK = { "α": "\\alpha", "β": "\\beta", "γ": "\\gamma", "δ": "\\delta", "ε": "\\varepsilon", "η": "\\eta", "θ": "\\theta", "κ": "\\kappa", "λ": "\\lambda", "ν": "\\nu", "ρ": "\\rho", "σ": "\\sigma", "τ": "\\tau", "φ": "\\phi", "χ": "\\chi", "ψ": "\\psi", "ω": "\\omega" };
const PM = /(Δ[A-Za-z])|(Σ)(?=\s)|(I²R)|(?<=^|[\s(=:;,≈])([αβγδεηθκλνρστφχψω])(?=[\s,.;:)=≈]|$)|(?<=^|[\s(:;,])([A-Za-z])(?=\s?[=≈]\s?[−-]?\d)/g;
const PM_SKIP = ".katex, script, style, code, textarea, input, select, option, svg, canvas, #refs, a.ref, .refsup, [data-tex], #stage, #lenses, .stn";
function plainMath(root) {
  if (!window.katex || !root || root.nodeType !== 1 || root.closest(PM_SKIP)) return;
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentElement.closest(PM_SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  const hits = []; for (let n; (n = tw.nextNode());) { PM.lastIndex = 0; if (PM.test(n.textContent)) hits.push(n); }
  for (const n of hits) {
    const t = n.textContent, frag = document.createDocumentFragment(); let last = 0; PM.lastIndex = 0;
    for (let m; (m = PM.exec(t));) {
      const tex = m[1] ? "\\Delta " + m[1].slice(1) : m[2] ? "\\textstyle\\sum" : m[3] ? "I^2R" : m[4] ? GK[m[4]] : m[5];
      frag.append(t.slice(last, m.index)); const sp = document.createElement("span"); sp.className = "pm";
      sp.innerHTML = window.katex.renderToString(tex, { throwOnError: false, output: _out || "htmlAndMathml" }); frag.append(sp); last = m.index + m[0].length;
    }
    frag.append(t.slice(last)); n.replaceWith(frag);
  }
}
{ const q = new Set(); let raf = 0;
  const flush = () => { raf = 0; const els = [...q]; q.clear(); els.forEach(el => el?.isConnected && plainMath(el)); };
  const obs = new MutationObserver(ms => { for (const m of ms) q.add(m.target.nodeType === 3 ? m.target.parentElement : m.target); if (!raf) raf = setTimeout(flush, 30); });   // a timer, not rAF: also runs while the tab is in the background
  loadKatex().then(texOutput).then(() => { plainMath(document.body); obs.observe(document.body, { childList: true, subtree: true, characterData: true }); }).catch(() => {}); }
const refsOf = keys => keys.length ? R(...keys.map(RN)) : ` <span class="eq-num">(assumed)</span>`;
function renderModel() {
  const eqs = mdl.eqs = equations(ctx);
  // equation cards, football format (Part K): header · equation · ASSUMED line · symbols table · live line; grouped with Eq. ranges and course tags
  const GROUP_COURSES = { "Thermodynamics and electrochemistry": [310, "562E"], "Transport": [320, 255], "Kinetics": [430, "562E"], "Energy balance": [326, 310], "Control": [470], "Life cycle and recycling": [250, 450, 512] };
  const tag = n => COURSE[n] ? courseLink(n) : `<a class="course" href="https://guide.wisc.edu/search/?P=CBE%20${n}" target="_blank" rel="noopener" title="CBE ${n}">${n} ↗</a>`;
  const groups = [...new Set(eqs.map(q => q.g))];
  const eqHTML = groups.map(gname => {
    const list = eqs.filter(q => q.g === gname), a = list[0].n, b = list[list.length - 1].n;
    return `<h4 class="mdl-gh">${gname} <small>${a === b ? `Eq. (${a})` : `Eqs. (${a})–(${b})`}</small> ${(GROUP_COURSES[gname] || []).map(tag).join(" ")}</h4>` + list.map(q => `<article class="mdl-eq" id="eq-${q.n}">
      <div class="mdl-h"><span class="mdl-n">(${q.n})</span><span class="mdl-name">${q.name}${refsOf(q.refs)}</span><button class="btn mdl-go" type="button" data-go="${q.go}" title="Close the panel and show where this happens in the twin">Show in the twin ▸</button></div>
      <div class="mdl-tex" data-tex="${encodeURIComponent(q.tex)}"></div>
      ${q.badge ? `<p class="mdl-assumed"><span class="mdl-src">${q.badge[0]}</span>${mt(q.badge[1])}</p>` : q.note ? `<p class="mdl-assumed">${mt(q.note)}</p>` : ""}
      <div class="mdl-scroll"><table class="mdl-tab"><thead><tr><th>Symbol</th><th>Meaning</th><th>Units</th><th>Value or range</th></tr></thead><tbody>${q.sym.map(([sy, m, u, v]) => `<tr><td data-tex-inline="${encodeURIComponent(sy)}"></td><td>${mt(m)}</td><td>${u}</td><td>${mt(v)}</td></tr>`).join("")}</tbody></table></div>
      <p class="mdl-live" data-live="${q.n}"></p>
    </article>`).join("");
  }).join("");
  const srcOf = s => Array.isArray(s) ? R(...s.map(RN)).replace('class="refsup"', 'class="refsup" style="font-size:11px;line-height:1"') : `<i>${s}</i>`;
  const params = parameterRows().map(p => `<tr><td>${mt(p.sym)}</td><td>${p.name}</td><td class="num">${p.vn}</td><td class="num">${p.vl}</td><td>${p.u}</td><td>${srcOf(p.src)}</td></tr>`).join("");
  $("mdlBody").innerHTML = `
    <h4 class="crs-h">1 · What is modeled</h4>
    <p>One cylindrical lithium-ion cell, followed through its life cycle. <b>Cell:</b> a single particle model per electrode (states: lithium concentration in 20 spherical shells in each particle, and the cell temperature), driven by a current the twin chooses: discharge by the chosen depth, a 10-minute rest, then a constant-current, constant-voltage recharge. Two parameter sets: an NMC811/graphite LG M50 21700 cell and an LFP/graphite A123 26650 cell. <b>Aging:</b> SEI growth on graphite over the chosen number of daily cycles. <b>Life cycle:</b> a bottom-up carbon footprint per kWh of cells from the model's own material inventory, the factory grid, charging losses and the end-of-life route. <b>Inputs you can change:</b> chemistry, C-rate, outside temperature, depth of discharge, cycles, lithium source, factory and charging grids, recycling route. <b>Outputs:</b> voltage, temperature, heat, charge time, plating risk, capacity fade, round-trip efficiency, footprint by stage and per kWh delivered, material and reagent balances. The 3D plants are illustrations and are not modeled.</p>
    <h4 class="crs-h">2 · Governing equations <small>(numbers match the subject lenses' "Show the equation")</small></h4>${eqHTML}
    <h4 class="crs-h">3 · Parameters and data</h4>
    <div class="mdl-scroll"><table class="mdl-tab"><thead><tr><th>Symbol</th><th>Quantity</th><th>NMC (LG M50)</th><th>LFP (A123)</th><th>Units</th><th>Source</th></tr></thead><tbody>${params}</tbody></table></div>
    <p>Molar masses (g/mol): Li 6.94, Ni 58.693, Mn 54.938, Co 58.933, Fe 55.845, P 30.974, O 15.999, C 12.011; $F$ = 96,485.33 C/mol, $R$ = 8.3145 J/(mol K), $T_{\\mathrm{ref}}$ = 298.15 K.</p>
    <h4 class="crs-h">4 · Numerical method</h4>
    <ul>
      <li>Particle diffusion (6): finite volumes on 20 equal-width spherical shells; backward Euler in time with a 2 s step (shorter at the end of each phase), solved per particle with the Thomas tridiagonal algorithm. The surface concentration is extrapolated half a shell from the outer shell with the flux boundary condition (7).</li>
      <li>Overpotentials from the closed-form inverse of Butler–Volmer (11); voltage (4) is algebraic at each step.</li>
      <li>Temperature (15): explicit Euler with the same step, using the heat of that step.</li>
      <li>Empty-cell stoichiometries (5): bisection, 200 iterations. Constant-voltage current (17): secant iteration on a copy of the state, up to 40 iterations, to $|V-V_{\\max}|$ below 10<sup>−9</sup> V.</li>
      <li>One full cycle (about 1,000–6,000 steps) is computed when a setting changes and then replayed in the 3D view; aging (14) and the life-cycle sums (18)–(21) are closed-form.</li>
    </ul>
    <h4 class="crs-h">5 · Assumptions and limits</h4>
    <ul>
      <li>Single particle model: no salt-concentration gradients or potential drop distribution in the electrolyte beyond the lumped resistance (10); it underestimates losses and heat at high C-rates, especially above about 2 C.</li>
      <li>The LFP set's very slow cathode diffusion makes it reach the voltage limit early above about 2 C, more than real power cells do.</li>
      <li>Lumped temperature (no gradient inside the cell); assumed heat capacity; still-air cooling of a single can, so packs with cooling plates run cooler.</li>
      <li>Plating is flagged by criterion (13), not simulated; below about −50 mV the result is outside the model's range.</li>
      <li>Aging (14) is illustrative: only SEI growth, with example parameters and assumed temperature and depth-of-discharge effects; no cracking, loss of active material or plating losses.</li>
      <li>The footprint is a lower bound: cathode synthesis, electrolyte, separator, binder, can and pack parts are not counted; manganese, iron and phosphate have no factor in our sources. The LFP hydrometallurgy process value is borrowed from an NMC-type plant.</li>
      <li>Collector foils: thickness of the LG M50 also used for the LFP cell; foil area taken as half the electrode area (double-sided coating).</li>
    </ul>
    <h4 class="crs-h">6 · Validation</h4>
    <p class="takeaway"><b>In short</b>The page\'s JavaScript model and an independent Python version agree to a billionth of a volt, smaller time steps change nothing that matters, and the capacity, resistance, acid use and footprint land where published data say they should, with the footprint deliberately a lower bound.</p>
    <ul>
      <li><b>Independent implementation:</b> a separate Python version of equations (1)–(17) (scipy banded solver, Brent root finding), on 20 cases across both chemistries, 0.5–3 C, 0–40 °C, 50–100 % depth of discharge and up to 3,000 cycles: worst voltage difference 1.0 × 10<sup>−9</sup> V over every time step, worst relative difference 5 × 10<sup>−10</sup> in efficiency, peak and mean temperature, cycle time, depth reached and fade.</li>
      <li><b>Time step:</b> after 30 min at 1 C the cell temperature from 2 s steps, 0.25 s steps and an adaptive BDF solve of the same equations agree to 0.003 °C.</li>
      <li><b>Capacity:</b> lithium conservation (5) gives 5.10 Ah for the LG M50 (rated 5 Ah${R(RN("chen"))}) and 2.30 Ah for the A123 cell (data sheet 2.5 Ah nominal, 2.4 Ah minimum${R(RN("a123"))}).</li>
      <li><b>Resistance:</b> (10) gives 3.35 mΩ for the A123 cell at 25 °C, below its 6 mΩ data-sheet impedance at 1 kHz${R(RN("a123"))}; tab, contact and SEI resistances are not modeled.</li>
      <li><b>Mass balance:</b> the stoichiometric acid demand (22) for NMC is 0.70 kg per kg of cells, inside the 0.667–0.871 kg/kg reported for real hydrometallurgical plants${R(RN("hanna"))}.</li>
      <li><b>Footprint:</b> the counted stages give 33.5 kg CO₂e per kWh for the default NMC case, below the 75.5 kg from a full LCA${R(RN("mohr"))}, as expected for a lower bound.</li>
      <li><b>Problem answers:</b> every numerical answer in the problem sets is recomputed with these equations by <code>problems_check.mjs</code>.</li>
    </ul>`;
  refreshModelLive();
  loadKatex().then(texOutput).then(output => {
    $("mdlBody").querySelectorAll("[data-tex]").forEach(el => window.katex.render(decodeURIComponent(el.dataset.tex), el, { displayMode: true, throwOnError: false, output }));
    $("mdlBody").querySelectorAll("[data-tex-inline]").forEach(el => window.katex.render(decodeURIComponent(el.dataset.texInline), el, { throwOnError: false, output }));
    inlineTex($("mdlBody"));
  }).catch(() => {}).then(() => { if (mdl.pending) { const n = mdl.pending; scrollInPanel("mdlBody", "eq-" + n); (document.fonts?.ready || Promise.resolve()).then(() => scrollInPanel("mdlBody", "eq-" + n)); mdl.pending = null; } });
  if (!window.katex) loadKatex().catch(() => { $("mdlBody").querySelectorAll("[data-tex]").forEach(el => el.textContent = decodeURIComponent(el.dataset.tex)); $("mdlBody").querySelectorAll("[data-tex-inline]").forEach(el => el.textContent = decodeURIComponent(el.dataset.texInline)); });
}
function refreshModelLive() { if (!mdl.eqs || !CYC) return; $("mdlBody").querySelectorAll("[data-live]").forEach(el => { const q = mdl.eqs[+el.dataset.live - 1]; try { el.innerHTML = "Live: " + cite(mt(q.live())); } catch (err) { el.textContent = "Live: –"; } }); inlineTex($("mdlBody")); }
function toggleModel(on = !mdl.open, eqN = null) {
  mdl.open = on; $("mdlPanel").hidden = !on;
  if (on) { if (crs.open) toggleCourses(false); mdl.pending = eqN; renderModel(); $("mdlClose").focus({ preventScroll: true });
    if (eqN) { $("eq-" + eqN)?.classList.add("hi"); mdl.pending = eqN; } }
  else $("mdl-open").focus({ preventScroll: true });
}
$("mdl-open").onclick = () => toggleModel();
$("mdlClose").onclick = () => toggleModel(false);
$("mdlBody").addEventListener("click", e => { const g = e.target.closest(".mdl-go, .crs-go"); if (g && g.dataset.go) { toggleModel(false); GO[g.dataset.go]?.(); } });
const beacon = new THREE.Group(); scene.add(beacon); beacon.visible = false;
{ const mat = new THREE.MeshBasicMaterial({ color: "#e0262c", transparent: true, opacity: 0.9, depthTest: false });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3, 0.25, 12, 64).rotateX(Math.PI / 2), mat); ring.renderOrder = 10; beacon.add(ring); }
let lens = null, lensPrev = null;
function openLens(i, k = 0) {
  $("realworld").setAttribute("aria-pressed", "false");
  if (!lens) lensPrev = { view: viewName };
  lens = { i, k };
  lensNav.querySelectorAll("button[data-i]").forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.i === i)));
  showStop();
}
function showStop() {
  setTimeout(markSpotRow, 0);
  const Lz = LENSES[lens.i], St = Lz.stops[lens.k];
  goTo(St.view);
  beacon.position.set(...St.beacon); beacon.scale.setScalar(St.bs || 1); beacon.visible = true;
  document.querySelectorAll(".lens-hl").forEach(e => e.classList.remove("lens-hl"));
  if (St.panel) { const el = $(St.panel); if (el.classList.contains("fold")) setFold(el, true); el.classList.add("lens-hl"); }
  const last = lens.k === Lz.stops.length - 1;
  lensCard.innerHTML = `
    <div class="lc-top"><span class="lc-subject">${esc(COURSE[Lz.n][0])}</span><span class="lc-step">${Lz.stops.length > 1 ? `${lens.k + 1} of ${Lz.stops.length}` : ""}</span>
      <button class="lc-x" type="button" aria-label="Close">×</button></div>
    <h3>${St.title}</h3><p>${St.text}</p>
    <p class="lc-plain"><b>In plain words:</b> ${St.plain}</p>
    <details class="lc-eq"><summary>Show the equation</summary>${St.eqTex ? `<div class="lc-tex" data-tex="${encodeURIComponent(St.eqTex)}"></div>` : (EQN[St.title] || []).length ? EQN[St.title].map(n => { const q = lensEqs()[n - 1]; return `<div class="lc-tex" data-tex="${encodeURIComponent(q.tex)}"></div><p class="lc-eqrefs"><button type="button" class="lc-eqref" data-eq="${n}">Eq. (${n}) · ${q.name} · open in ∑ Model ▸</button></p>`; }).join("") : `<div>${St.eq}</div>`}</details>
    <p class="lc-live" id="lc-live"></p>
    ${St.noteFn || St.note ? `<p class="lc-note" id="lc-note">${cite(St.noteFn ? St.noteFn() : St.note)}</p>` : ""}
    <p class="lc-why"><b>Why it matters:</b> ${St.why}</p>
    <p class="lc-course">In college, you learn this in ${courseLink(Lz.n)}</p>
    ${researchLine(Lz.n)}
    <div class="lc-nav"><button class="btn" type="button" id="lc-back" ${lens.k === 0 ? "disabled" : ""}>Back</button>
      <button class="btn primary" type="button" id="lc-next">${last ? "Done" : "Next"}</button></div>`;
  lensCard.hidden = false; showCard();
  lensCard.querySelectorAll(".lc-eqref").forEach(b => b.onclick = () => toggleModel(true, +b.dataset.eq));
  lensCard.querySelectorAll("button[data-res]").forEach(b => b.onclick = () => toggleResearch(true, +b.dataset.res));
  const dt = lensCard.querySelector("details.lc-eq"); if (dt) dt.addEventListener("toggle", () => { if (dt.open) typesetIn(dt); });
  lensCard.querySelector(".lc-x").onclick = closeLens;
  $("lc-back").onclick = () => { if (lens.k > 0) { lens.k--; showStop(); } };
  $("lc-next").onclick = () => { if (last) closeLens(); else { lens.k++; showStop(); } };
  lensRefresh();
}
// cards dock at the top of the side panel: bring them into view
function showCard() { const a = document.querySelector("aside"); if (matchMedia("(max-width: 860px)").matches) lensCard.scrollIntoView({ block: "start" }); else a.scrollTop = 0; }
function lensRefresh() {
  if (!lens || !CYC) return; const St = LENSES[lens.i].stops[lens.k];
  const el = $("lc-live"); if (el) { el.innerHTML = cite(mt(St.live())); if (window.katex) inlineTex(lensCard); else loadKatex().then(() => inlineTex(lensCard)).catch(() => {}); }
  const nt = $("lc-note"); if (nt && St.noteFn) nt.innerHTML = cite(St.noteFn());
}
function closeLens() {
  if (!lens) return;
  lens = null; lensCard.hidden = true; beacon.visible = false; markSpotRow();
  document.querySelectorAll(".lens-hl").forEach(e => e.classList.remove("lens-hl"));
  lensNav.querySelectorAll("button[data-i]").forEach(b => b.setAttribute("aria-pressed", "false"));
  if (lensPrev) goTo(lensPrev.view);
}

// ---------- clean by default: folds, Conditions, references ----------
function setFold(sec, open) { sec.classList.toggle("collapsed", !open); const h = sec.querySelector(":scope > h2"); if (h) h.setAttribute("aria-expanded", String(open)); if (open) requestAnimationFrame(() => { drawVT(); drawLCA(); }); }
document.querySelectorAll("section.fold").forEach(sec => {
  const h = sec.querySelector(":scope > h2");
  h.tabIndex = 0; h.setAttribute("role", "button"); h.setAttribute("aria-expanded", "false");
  const toggle = () => setFold(sec, sec.classList.contains("collapsed"));
  h.addEventListener("click", e => { if (!e.target.closest("a")) toggle(); });
  h.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
});
let condOn = false;
$("cond-toggle").onclick = e => {
  condOn = e.currentTarget.getAttribute("aria-pressed") !== "true";
  e.currentTarget.setAttribute("aria-pressed", String(condOn));
  $("tag").hidden = !condOn; $("conds").hidden = !condOn;
  ["sec-cell", "sec-chain", "sec-recycle"].forEach(id => { const sec = $(id); if (sec.classList.contains("collapsed") === condOn) setFold(sec, condOn); });
  updateConds();
};
document.addEventListener("click", e => {
  const a = e.target.closest("a.ref"); if (!a) return;
  e.preventDefault();
  const li = $("ref-" + a.dataset.ref); if (!li) return;
  if (innerWidth < 860) { if (mdl.open) toggleModel(false); if (crs.open) toggleCourses(false); }
  setFold($("sec-refs"), true);
  li.scrollIntoView({ block: "center", behavior: "smooth" });
  li.classList.add("flash"); setTimeout(() => li.classList.remove("flash"), 1600);
});

// condition labels over the stations (hidden until Conditions is on)
const CONDS = [
  { pos: V3(AT.mine, -20, 40, -120), txt: () => `${S.li === "brine" ? "Lithium from brine" : "Lithium from rock"}${S.chem === "NMC" ? ` · nickel, cobalt ${stageKg("mine")}` : ""}` },
  { pos: V3(AT.refinery, 10, 50, -20), txt: () => `Lithium chemical · ${stageKg("refinery")}` },
  { pos: V3(AT.materials, 0, 44, -20), txt: () => `Graphite, foils · ${stageKg("materials")}` },
  { pos: V3(AT.factory, 0, 38, -10), txt: () => `Factory grid ${S.gridF} g/kWh · ${stageKg("factory")}` },
  { pos: V3(AT.ev, 0, 28, -10), txt: () => `Cell ${curV.toFixed(2)} V · ${curT.toFixed(1)} °C · ${(curSOC * 100).toFixed(0)} % · grid ${S.gridU} g/kWh` },
  { pos: V3(AT.recycle, 0, 50, -20), txt: () => `${{ hydro: "Hydrometallurgy", pyro: "Pyrometallurgy", none: "Landfill" }[S.route]} · net ${stageKg("recycle")}` },
];
const condEls = CONDS.map(() => { const d = document.createElement("div"); d.className = "cond"; $("conds").appendChild(d); return d; });
function stageKg(k) { if (!L) return ""; const s = L.stages.filter(x => x.at === k).reduce((a, b) => a + b.kg, 0); return `${s.toFixed(1)} kg CO₂e/kWh`; }
function updateConds() { if (!condOn) return; CONDS.forEach((c, i) => condEls[i].textContent = c.txt()); }

// ---------- Links to Research (Part N): cards from the coordinator's verified map (research.js) ----------
const res = { open: false };
function renderResearch(hi) {   // Part N update 6: one flat list, all topics treated equally; compact rows
  const card = (r, i) => `<article class="res-card${hi === i ? " hi" : ""}" id="res-${i}">
      <h5><a href="${r.page}" target="_blank" rel="noopener">${r.name} ↗</a></h5>
      <p class="res-where">Connects to: ${r.where}</p>
      <div class="res-areas">${r.areas.map(a => `<span>${a}</span>`).join("")}</div>
      <button class="btn" type="button" data-go="${r.go}"${r.lens != null ? ` data-lens="${r.lens}"` : ""} title="Close the panel and show where this connects in the twin">Show in the twin: ${r.place} ▸</button>
    </article>`;
  $("resBody").innerHTML = `<p class="crs-intro">Faculty in UW–Madison Chemical &amp; Biological Engineering whose research areas connect to parts of this digital twin.</p>`
    + `<div class="res-grid">${RESEARCH.map(card).join("")}</div>`
    + (CENTERS.length ? `<h4 class="res-grp res-centers-h">UW–Madison centers and programs</h4><div class="res-grid res-centers">${CENTERS.map(c => `<article class="res-card"><h5><a href="${c.url}" target="_blank" rel="noopener">${c.name} ↗</a></h5><p class="res-where">Connects to: ${c.where}</p></article>`).join("")}</div>` : "");
  if (hi != null) scrollInPanel("resBody", "res-" + hi);
}
function toggleResearch(on = !res.open, hi = null) {
  res.open = on; $("resPanel").hidden = !on;
  if (on) { if (crs.open) toggleCourses(false); if (mdl.open) toggleModel(false); if (!$("guidePanel").hidden) toggleGuide(false); renderResearch(hi); $("resClose").focus({ preventScroll: true }); }
}
if (RESEARCH.length) $("res-open-hdr").hidden = false;
$("res-open-hdr").onclick = () => toggleResearch();
$("resClose").onclick = () => toggleResearch(false);
$("resBody").addEventListener("click", e => { const b = e.target.closest("button[data-go]"); if (!b) return; toggleResearch(false); if (b.dataset.lens != null) openLens(LENSES.findIndex(l => l.n === +b.dataset.lens)); else GO[b.dataset.go]?.(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && res.open) toggleResearch(false); });
// lens cards: one line pointing to the matching research card
const researchLine = () => "";   // Part N simplified: no research lines on lens cards

// ---------- User guide (Part M) ----------
const GUIDE = `
  <p><b>What this is:</b> a live digital twin of a lithium-ion battery, from the mine to the recycling plant. A cell model and a life-cycle footprint run in your browser.</p>
  <h4>How to explore</h4>
  <ul><li><b>Overview</b> (Supply chain button): the whole chain, every spot numbered.</li><li><b>Click a numbered spot</b> or a row in the <b>ChemE spots</b> list to zoom in and open its card.</li><li><b>Drag</b> to orbit · <b>scroll</b> or pinch to zoom.</li><li><b>Camera buttons</b> (bottom): Mines → Recycling, and EV pack → Module → Cell → Particles → Crystal.</li></ul>
  <h4>Buttons</h4>
  <ul><li><b>Real world</b>: why batteries matter.</li><li><b>Conditions</b>: shows live values on the stages and opens the settings.</li><li><b>Subject chips</b> (Balances, Thermo…): a guided card for each college course.</li><li><b>Footprint view</b>: a labelled column on each stage shows its CO₂ in kg per kWh of battery; green is the recycling credit. The key (bottom right) explains it.</li><li><b>Pause</b> and <b>Speed</b>: replay one charge cycle.</li><li><b>⤢</b>: pop the side panel out; <b>⤡</b> docks it.</li></ul>
  <h4>Change conditions</h4>
  <ul><li><b>The cell</b>: chemistry (NMC or LFP), charging speed, outside temperature, depth of discharge, cycles.</li><li><b>Supply chain</b>: lithium from brine or rock, factory and charging grids.</li><li><b>End of life</b>: hydro, pyro or landfill.</li><li>Watch: footprint, temperature, capacity left, plating warning, the <b>What this means</b> boxes.</li></ul>
  <h4>Go deeper</h4>
  <ul><li><b>∑ Model</b>: every equation, symbol, parameter and source.</li><li><b>Links to Courses</b>: course map, cards and problem sets.</li><li><b>References</b>: numbered sources in the side panel.</li></ul>`;
function toggleGuide(on = $("guidePanel").hidden) { $("guidePanel").hidden = !on; if (on) { if (crs.open) toggleCourses(false); if (mdl.open) toggleModel(false); $("guideBody").innerHTML = GUIDE; $("guideClose").focus({ preventScroll: true }); } }
$("guide-open").onclick = () => { toggleGuide(); $("guide-open").classList.add("seen"); try { localStorage.setItem("twin-guide-seen", "1"); } catch (e) {} };
try { if (localStorage.getItem("twin-guide-seen")) $("guide-open").classList.add("seen"); } catch (e) {}
$("guideClose").onclick = () => toggleGuide(false);
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("guidePanel").hidden) toggleGuide(false); });

// ---------- pop-out side panel (Part M) ----------
const asideEl = document.querySelector("aside");
function setPopped(on) {
  document.body.classList.toggle("popped", on); $("popout").textContent = on ? "⤡" : "⤢"; $("popout").title = on ? "Dock the panel back on the right" : "Pop the panel out into a floating window";
  if (!on) { asideEl.style.left = asideEl.style.top = asideEl.style.width = asideEl.style.height = ""; }
  try { localStorage.setItem("battery-popped", on ? "1" : "0"); } catch (e) {}
  requestAnimationFrame(() => { resize(); drawVT(); drawLCA(); });
}
$("popout").onclick = () => setPopped(!document.body.classList.contains("popped"));
{ let drag = null;
  $("aside-bar").addEventListener("pointerdown", e => { if (!document.body.classList.contains("popped") || e.target.closest("button")) return; const r = asideEl.getBoundingClientRect(); drag = { dx: e.clientX - r.left, dy: e.clientY - r.top }; e.currentTarget.setPointerCapture(e.pointerId); });
  $("aside-bar").addEventListener("pointermove", e => { if (!drag) return; asideEl.style.left = `${Math.max(0, Math.min(innerWidth - 120, e.clientX - drag.dx))}px`; asideEl.style.top = `${Math.max(0, Math.min(innerHeight - 60, e.clientY - drag.dy))}px`; });
  $("aside-bar").addEventListener("pointerup", () => { drag = null; }); }
if (innerWidth > 860) { let p = false; try { p = localStorage.getItem("battery-popped") === "1"; } catch (e) {} if (p) setPopped(true); }

// ---------- real world ----------
function openIntro() {
  if (lens) closeLens();
  $("realworld").setAttribute("aria-pressed", "true"); beacon.visible = false;
  lensCard.innerHTML = introHTML(ctx);
  lensCard.hidden = false; showCard();
  const done = () => { lensCard.hidden = true; $("realworld").setAttribute("aria-pressed", "false"); try { localStorage.setItem("battery-intro-seen", "1"); } catch (e) {} };
  lensCard.querySelector(".lc-x").onclick = done; $("lc-next").onclick = done;
}
$("realworld").onclick = () => ($("realworld").getAttribute("aria-pressed") === "true" ? (lensCard.hidden = true, $("realworld").setAttribute("aria-pressed", "false")) : openIntro());
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if (crs.open) { toggleCourses(false); return; }
  if (mdl.open) { toggleModel(false); return; }
  if (lens) closeLens(); else if (!lensCard.hidden) { lensCard.hidden = true; $("realworld").setAttribute("aria-pressed", "false"); }
});

// ---------- ChemE spots ----------
const spotLayer = $("spots"), spotEls = [];
const SP = SPOTS(ctx, LENSES);
SP.forEach((Sp, i) => {
  const b = document.createElement("button"); b.type = "button"; b.className = "spot"; b.textContent = String(i + 1);
  b.setAttribute("aria-label", `ChemE spot ${i + 1}: ${Sp.name}`);
  const t = document.createElement("span"); t.textContent = Sp.name; b.appendChild(t);
  b.onclick = () => openLens(Sp.lens, Sp.stop || 0); spotLayer.appendChild(b); spotEls.push(b);
});
// ChemE spots are always on (Part M). In the overview each spot sits at its stage; close up, at its true place.
const SITE = { mine: [AT.mine.x - 20, 35, -60], refinery: [AT.refinery.x, 40, -20], materials: [AT.materials.x, 40, -20], factory: [AT.factory.x, 35, -10], ev: [AT.ev.x, 35, EV_Z], recycle: [AT.recycle.x, 45, -20], chain: [0, 10, 60] };
const STN = [["mine", "Mines & brine", [AT.mine.x - 20, 0, 110]], ["refinery", "Refinery", [AT.refinery.x, 0, 85]], ["materials", "Materials plant", [AT.materials.x, 0, 85]], ["factory", "Cell factory", [AT.factory.x, 0, 75]], ["ev", "EV charging", [AT.ev.x, 0, 90]], ["recycle", "Recycling", [AT.recycle.x, 0, 85]]];
const stnEls = STN.map(([, t]) => { const d = document.createElement("div"); d.className = "stn"; d.textContent = t; spotLayer.appendChild(d); return d; });
const leaders = $("leaders");
// spots table beside the stage
$("spotlist-ol").innerHTML = SP.map((Sp, i) => `<li><button type="button" data-i="${i}" title="${Sp.name}"><b>${i + 1}</b><span>${Sp.name}</span></button></li>`).join("");
$("spotlist-ol").onclick = e => { const b = e.target.closest("button[data-i]"); if (b) { const Sp = SP[+b.dataset.i]; openLens(Sp.lens, Sp.stop || 0); } };
function setSpotList(open) { $("spotlist").classList.toggle("collapsed", !open); $("spotlist-tg").setAttribute("aria-expanded", String(open)); frameOffset(); }
$("spotlist-tg").onclick = () => setSpotList($("spotlist").classList.contains("collapsed"));
function markSpotRow() { document.querySelectorAll("#spotlist-ol button").forEach(b => { const Sp = SP[+b.dataset.i]; b.classList.toggle("on", !!lens && lens.i === Sp.lens && lens.k === (Sp.stop || 0)); }); }
// keep the scene centred in the area the open spots table leaves free (desktop)
function frameOffset() {
  const w = stage.clientWidth, h = stage.clientHeight, open = !$("spotlist").classList.contains("collapsed") && w > 860;
  if (open) camera.setViewOffset(w, h, -110, 0, w, h); else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}
const _v = new THREE.Vector3();
function project(pos, maxDist) {
  _v.set(...pos); const dist = _v.distanceTo(camera.position); _v.project(camera);
  return { vis: _v.z < 1 && _v.z > -1 && Math.abs(_v.x) < 1.02 && Math.abs(_v.y) < 1.02 && dist < maxDist, x: (_v.x + 1) / 2 * stage.clientWidth, y: (1 - _v.y) / 2 * stage.clientHeight, dist };
}
function placeOverlays() {
  const camDist = camera.position.distanceTo(controls.target), overview = camDist > 900;
  W.landmarks.visible = camDist > 600;
  const placed = [], lines = [], stnR = [];
  const sr = stage.getBoundingClientRect(), Wd = stage.clientWidth, Ht = stage.clientHeight;
  const fixedBox = el => { const r = el.getBoundingClientRect(); return { x0: r.left - sr.left, x1: r.right - sr.left, y0: r.top - sr.top, y1: r.bottom - sr.top }; };
  const panels = [$("spotlist"), $("fpkey")].filter(el => !el.hidden && el.offsetWidth).map(fixedBox);   // spots under these are hidden
  STN.forEach(([, , pos], i) => { const p = project(pos, 1e9), el = stnEls[i]; const show = overview && p.vis; el.style.display = show ? "" : "none"; if (show) { const w = el.offsetWidth, h = el.offsetHeight; for (const b of panels) if (p.x + w / 2 > b.x0 && p.x - w / 2 < b.x1 && p.y + h > b.y0 && p.y < b.y1) p.x = b.x1 + w / 2 + 4; el.style.left = `${p.x}px`; el.style.top = `${p.y}px`; stnR.push({ x0: p.x - w / 2, x1: p.x + w / 2, y0: p.y, y1: p.y + h }); } });
  SP.forEach((Sp, i) => {
    const el = spotEls[i];
    const p = overview ? project(SITE[Sp.site], 1e9) : project(Sp.pos, Sp.maxD || Math.max(camDist * 2.2, 60));
    if (!p.vis) { el.style.display = "none"; return; }
    // fan out sideways in a row above the true point (then a second row), kept inside the stage
    const W0 = 20, W1 = stage.clientWidth - 20, clampX = v => Math.min(W1, Math.max(W0, v));
    const free = (x, y) => !placed.some(q => Math.hypot(q.x - x, q.y - y) < (q.r || 30)) && !stnR.some(b => x + 16 > b.x0 && x - 16 < b.x1 && y + 16 > b.y0 && y - 16 < b.y1);
    let x = p.x, y = p.y, k = 0;
    while (!free(x, y) && k < 32) { k++; const row = Math.floor((k - 1) / 4), j = (k - 1) % 4; x = clampX(p.x + (j % 2 ? 1 : -1) * Math.ceil((j + 1) / 2) * 32 - (j % 2 ? 16 : -16)); y = p.y - 26 - row * 32; }
    if (panels.some(b => x + 15 > b.x0 && x - 15 < b.x1 && y + 15 > b.y0 && y - 15 < b.y1)) { el.style.display = "none"; return; }
    placed.push({ x, y, r: 30 });
    if (k) lines.push(`<line x1="${x}" y1="${y}" x2="${p.x}" y2="${p.y}"/><circle cx="${p.x}" cy="${p.y}" r="2.5"/>`);
    el.style.display = ""; el.style.left = `${x}px`; el.style.top = `${y}px`;
  });
  // everything else avoids the spots, the stage names, the fixed panels and each other
  const boxes = placed.map(q => ({ x0: q.x - 15, x1: q.x + 15, y0: q.y - 15, y1: q.y + 15 }));
  stnEls.forEach(el => { if (el.style.display !== "none") { const w = el.offsetWidth, h = el.offsetHeight, x = parseFloat(el.style.left), y = parseFloat(el.style.top); boxes.push({ x0: x - w / 2, x1: x + w / 2, y0: y, y1: y + h }); } });
  const hit = (r, list) => list.some(b => r.x0 < b.x1 + 3 && r.x1 > b.x0 - 3 && r.y0 < b.y1 + 3 && r.y1 > b.y0 - 3);
  const fixed = [$("zoomlabel")];
  if (!$("spotlist").classList.contains("collapsed") || Wd <= 860) fixed.push($("spotlist"));
  if (!$("fpkey").hidden) fixed.push($("fpkey"));
  const fixedBoxes = fixed.map(fixedBox);
  // live tag: top-left if free, else the first free corner slot
  if (condOn) {
    const tg = $("tag"), sl = fixedBox($("spotlist")), zl = fixedBoxes[0];
    const fit = x => { tg.style.maxWidth = `${Wd - x - 12}px`; return [tg.offsetWidth, tg.offsetHeight]; };
    const slots = [[12, 12], [12, zl.y1 + 6], [sl.x1 + 8, zl.y1 + 6], [12, -1], [sl.x1 + 8, -1]];
    let pick = null, w = 0, h = 0;
    for (const [x, y0] of slots) { [w, h] = fit(x); const y = y0 < 0 ? Ht - h - 12 : y0; if (!hit({ x0: x, x1: x + w, y0: y, y1: y + h }, fixedBoxes)) { pick = [x, y]; break; } }
    if (!pick) { [w, h] = fit(sl.x1 + 8); pick = [sl.x1 + 8, zl.y1 + 6]; }
    tg.style.left = `${pick[0]}px`; tg.style.top = `${pick[1]}px`;
    fixedBoxes.push({ x0: pick[0], x1: pick[0] + w, y0: pick[1], y1: pick[1] + h });
  }
  boxes.push(...fixedBoxes);
  const DY = [0, -24, 24, -48, 48, -72, 72, -96, 96];
  function placeLabel(el, p, w, h) {   // el is drawn centred above (x, y): translate(-50%, -100%)
    for (const dy of DY) for (const dx of [0, -(w / 2 + 26), w / 2 + 26, -(w + 40), w + 40]) {
      const x = p.x + dx, y = p.y + dy, r = { x0: x - w / 2, x1: x + w / 2, y0: y - h, y1: y };
      if (r.x0 < 4 || r.x1 > Wd - 4 || r.y0 < 4 || r.y1 > Ht - 4 || hit(r, boxes)) continue;
      boxes.push(r);
      if (dx || dy) { const ex = Math.min(r.x1, Math.max(r.x0, p.x)), ey = Math.min(r.y1, Math.max(r.y0, p.y)); lines.push(`<line class="cl" x1="${ex}" y1="${ey}" x2="${p.x}" y2="${p.y}"/><circle class="cl" cx="${p.x}" cy="${p.y}" r="2"/>`); }
      el.style.display = ""; el.style.left = `${x}px`; el.style.top = `${y}px`; return true;
    }
    el.style.display = "none"; return false;
  }
  if (co2Mode) fpBars.forEach(({ el, pos }) => { const p = project(pos, 1e9); if (!p.vis) { el.style.display = "none"; return; } el.style.display = ""; placeLabel(el, p, el.offsetWidth, el.offsetHeight); });
  if (condOn) CONDS.forEach((c, i) => {
    const p = project(c.pos, Math.max(camDist * 2.2, 200)), el = condEls[i];
    if (!p.vis || camDist <= 40) { el.style.display = "none"; return; }
    el.style.display = ""; placeLabel(el, p, el.offsetWidth, el.offsetHeight);
  });
  const html = lines.join(""); if (leaders._h !== html) { leaders.innerHTML = html; leaders._h = html; }
}

// ---------- animation: replay the modelled cycle ----------
let CUR = { V: 0, T: 25, Q: 0, I: 0, xs: 0.5, ys: 0.5, Uocv: 0, etaN: 0, etaP: 0, R: 0 };
const SPEED0 = 120;   // default playback: 1 real s = 2 min of battery time, so a 1 C cycle (~2 h) replays in about a minute
let playing = !matchMedia("(prefers-reduced-motion: reduce)").matches, simT = 0, curV = 0, curT = 25, curSOC = 1, curI = 0, frameIdx = 0;
$("play").textContent = playing ? "Pause" : "Play";
$("play").onclick = () => { playing = !playing; $("play").textContent = playing ? "Pause" : "Play"; };
const colGr = [new THREE.Color("#3a3d42"), new THREE.Color("#d9a441")], colCa = [new THREE.Color("#e3e9f0"), new THREE.Color("#1f4e8c")];
const tmpC = new THREE.Color(), m4 = new THREE.Matrix4();
function sample(t) {
  const tr = CYC.trace; let lo = 0, hi = tr.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (tr[m][0] < t) lo = m; else hi = m; }
  return tr[hi];
}
function sampleProf(t) { const P = CYC.prof; let k = 0; while (k < P.length - 1 && P[k + 1].t <= t) k++; return P[k]; }
function animate(dtReal, now) {
  if (!CYC) return;
  if (playing) { simT += dtReal * +$("speed").value; if (simT > CYC.tCycle) simT = 0; }
  const r = sample(simT); [, curV, curSOC, curT, , curI] = r;
  CUR = { V: r[1], T: r[3], Q: r[4], I: r[5], xs: r[6], ys: r[7], Uocv: r[8], etaN: r[9], etaP: r[10], R: r[11] };
  const dir = Math.sign(curI);   // + discharge: ions anode → cathode
  const ph = now / 1000;
  // particles: shells coloured by lithium stoichiometry (6 drawn shells sample the 20 model shells)
  const P = sampleProf(simT);
  if (P) for (const side of ["n", "p"]) {
    const arr = P[side], cols = side === "n" ? colGr : colCa;
    const c = CELLS[S.chem][side], d = derive(S.chem);
    const lo = side === "n" ? d.x0 : c.x100, hi = side === "n" ? c.x100 : d.y0;
    Z.partShells[side].forEach(shells => shells.forEach((m, k) => {
      const idx = Math.min(19, Math.floor((19 - k * 3.4)));
      const f = THREE.MathUtils.clamp((arr[idx] - lo) / (hi - lo), 0, 1);
      m.material.color.copy(tmpC.copy(cols[0]).lerp(cols[1], f));
    }));
  }
  // ions crossing the separator: speed ∝ current
  const sp = Math.abs(curI) / derive(S.chem).Q;
  Z.ionSeed.forEach((s, i) => {
    s.ph = (s.ph + dtReal * 0.12 * sp * (dir || 0)) % 1; if (s.ph < 0) s.ph += 1;
    const x = -Z.PW / 2 + 3 + s.ph * (Z.PW - 6);
    m4.makeTranslation(x, s.y + Math.sin(ph * 2 + i) * 0.6, s.z); Z.ions.setMatrixAt(i, m4);
  });
  Z.ions.instanceMatrix.needsUpdate = true; Z.ions.visible = curI !== 0;
  Z.electrons.visible = curI !== 0;
  for (let i = 0; i < 12; i++) { let u = ((ph * 0.15 * sp * (dir || 0) + i / 12) % 1 + 1) % 1; Z.wire.getPointAt(u, _v); m4.makeTranslation(_v.x, _v.y, _v.z); Z.electrons.setMatrixAt(i, m4); }
  Z.electrons.instanceMatrix.needsUpdate = true;
  // cell cutaway: ions drift radially (toward cathode stripes when discharging)
  Z.cellIonSeed.forEach((s, i) => {
    s.ph = (s.ph + dtReal * 0.5 * sp * (dir || 0)) % 1; if (s.ph < 0) s.ph += 1;
    const rr = s.r0 + Math.sin(s.ph * Math.PI * 2) * 0.35, a = s.face ? Math.PI * 0.5 : 0;
    m4.makeTranslation(Math.sin(a) * rr + (s.face ? 0 : 0.05), s.y, Math.cos(a) * rr + (s.face ? 0.05 : 0)); Z.cellIons.setMatrixAt(i, m4);
  });
  Z.cellIons.instanceMatrix.needsUpdate = true; Z.cellIons.visible = curI !== 0;
  // lattice: lithium sites filled in proportion to the cathode's lithium content at the surface
  if (Z.liAtoms && P) Z.liAtoms.count = Math.round(THREE.MathUtils.clamp(P.ys, 0, 1) * Z.liCount);
  // module: cells tinted by temperature
  const hot = THREE.MathUtils.clamp((curT - S.Tamb) / 30, 0, 1);
  Z.modCells.forEach(c => c.material.color.setRGB(0.17 + 0.6 * hot, 0.37 - 0.15 * hot, 0.56 - 0.4 * hot));
  W.modules.forEach(m => m.material.emissive?.setRGB(0.5 * hot, 0.12 * hot, 0));
  // factory and plant motion
  W.webTex.offset.x -= dtReal * 0.6; W.rolls.forEach((r, i) => r.rotation.z -= dtReal * (i ? 0.8 : 1.1));
  W.winders.forEach(w => w.rotation.y += dtReal * 4);
  W.stirrers.forEach(s => s.rotation.y += dtReal * 3);
  W.saggers.forEach(s => { s.position.x += dtReal * 2; if (s.position.x > 55) s.position.x -= 140; });
  W.shredRot.forEach((s, i) => s.rotation.z += dtReal * (i ? -5 : 5));
  W.kiln.rotation.x += dtReal * 0.4;
  W.leds.forEach((l, i) => l.visible = ((ph * 0.7 + i * 0.37) % 1) > 0.15);
  W.furnaceGlow.material.color.setRGB(3.0, 0.9 + 0.15 * Math.sin(ph * 5), 0.2);
  W.crates.forEach(c => { c.userData.u = (c.userData.u + dtReal * 0.01) % 1; W.flow.getPointAt(c.userData.u, c.position); const seg = Math.min(4, Math.floor(c.userData.u * 5)); c.material = W.crateMats[seg]; c.lookAt(W.flow.getPointAt(Math.min(c.userData.u + 0.01, 1))); });
  { const u = (ph * 0.06) % 1; W.loop.getPointAt(u, W.loopArrow.position); const tng = W.loop.getTangentAt(u); W.loopArrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tng); }
  $("clock").textContent = `${curI > 0 ? "Discharging" : curI < 0 ? "Charging" : "Resting"} · ${fmtT(simT)}`;
  if (condOn) $("tag").textContent = `${S.chem} cell · ${curI > 0 ? "discharging" : curI < 0 ? "charging" : "resting"} at ${Math.abs(curI).toFixed(1)} A · ${curV.toFixed(3)} V · ${curT.toFixed(1)} °C · ${(curSOC * 100).toFixed(0)} % full`;
  if (++frameIdx % 10 === 0) { drawVT(); updateConds(); if (mdl.open) refreshModelLive(); }
}
const fmtT = s => `${Math.floor(s / 3600)} h ${String(Math.floor(s % 3600 / 60)).padStart(2, "0")} min`;

// ---------- loop ----------
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  R3.resize(w, h); camera.aspect = w / h; frameOffset(); drawVT(); drawLCA();
  const portrait = camera.aspect < 0.9;
  if (portrait !== lastPortrait && viewName === "chain" && !lens) goTo("chain", true);
  lastPortrait = portrait;
}
let lastPortrait = null;
new ResizeObserver(resize).observe(stage);
let last = performance.now();
renderer.setAnimationLoop(now => {
  const dt = Math.min((now - last) / 1000, 0.1); last = now;
  animate(dt, now);
  if (beacon.visible) { const k = 1 + 0.18 * Math.sin(now / 220); beacon.children[0].scale.set(k, 1, k); }
  if (tween) {
    const u = Math.min((now - tween.t0) / tween.dur, 1), e = u * u * (3 - 2 * u);
    camera.position.lerpVectors(tween.from.p, tween.to.p, e); controls.target.lerpVectors(tween.from.c, tween.to.c, e); if (tween.to.fov !== tween.from.fov) { camera.fov = tween.from.fov + (tween.to.fov - tween.from.fov) * e; camera.updateProjectionMatrix(); }
    if (u >= 1) tween = null;
  }
  const t = controls.target, shv = VIEWS[viewName].sh; sun.position.copy(SUN_DIR).multiplyScalar(shv * 2).add(t); sun.target.position.copy(t); sun.target.updateMatrixWorld();
  // depth range follows the distance being viewed (millimetre cells to kilometre landscape) so depth-based AO works
  const dv = camera.position.distanceTo(t); camera.near = Math.max(0.02, dv / 400); camera.far = 20000; camera.updateProjectionMatrix(); R3.setScale(dv);
  controls.update(); R3.render(); placeOverlays();
});


// ---------- problem-set setups: #ps=<course>-<k> ----------
function syncControls() {
  [["crate", S.C], ["tamb", S.Tamb], ["dod", Math.round(S.dod * 100)], ["cycles", S.cycles], ["gridF", S.gridF], ["gridU", S.gridU]].forEach(([id, v]) => { $(id).value = v; $(id).dispatchEvent(new Event("input")); });
  ["NMC", "LFP"].forEach(k => $("chem-" + k).setAttribute("aria-pressed", String(k === S.chem))); setLattice(Z, S.chem);
  $("li-brine").setAttribute("aria-pressed", String(S.li === "brine")); $("li-rock").setAttribute("aria-pressed", String(S.li === "rock"));
  ["hydro", "pyro", "none"].forEach(r => $("route-" + r).setAttribute("aria-pressed", String(r === S.route)));
}
function applySetup() {
  const m = /^#ps[-=]([0-9A-Za-z]+-\d+)$/.exec(location.hash); if (!m) return false;   // #ps-430-1 (current) or #ps=430-1 (older links)
  const P = SETUPS[m[1]]; if (!P) return false;
  if (lens) closeLens(); toggleCourses(false); toggleModel(false); lensCard.hidden = true; $("realworld").setAttribute("aria-pressed", "false");
  Object.assign(S, DEF, P.s); syncControls(); runModel();
  setCO2Mode(!!P.co2); goTo(P.view, true);
  (P.open || []).forEach(id => setFold($(id), true));
  $("speed").value = String(P.speed || SPEED0); simT = 0; return true;
}
window.addEventListener("hashchange", applySetup);
// ---------- start ----------
resize(); runModel(); setSpotList(stage.clientWidth > 860); goTo("chain", true);   // open on the supply-chain overview (Part M); the EV pack is one click away
if (!applySetup()) { let seen = false; try { seen = localStorage.getItem("battery-intro-seen") === "1"; } catch (e) {} if (!seen) openIntro(); }
window.__app = { W, RESEARCH, toggleResearch, placeOverlays, toggleModel, applySetup, toggleCourses, GO, S, get CYC() { return CYC; }, get L() { return L; }, get AG() { return AG; }, openLens, closeLens, openIntro, goTo, LENSES, camera, setChem };
