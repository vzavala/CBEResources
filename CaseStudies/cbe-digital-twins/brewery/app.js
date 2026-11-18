// Brewery Digital Twin: UI, charts, lenses, course map, ∑ Model panel and the render loop.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { makePost } from "./hq.js";
import { buildBrewery } from "./scene.js";
import { C, GR, MW, STYLES, DEFAULTS, runBatch, stateAt, fermRates, henry, kIso, kDeg, muWort, sgOfPlato } from "./model.js";
import { REFS, ref, COURSE, FEATURES, COURSES, PS_LINK, LENSES, SPOTS, NAMES } from "./content.js";
import { CATALOG } from "./courses_data.js";
import { VALID } from "./validation_data.js";
import { PS_SETUPS, psIndex } from "./ps.js";
import { RESEARCH, CENTERS } from "./research_data.js";

const $ = id => document.getElementById(id);
const f1 = x => x.toFixed(1), f2 = x => x.toFixed(2), f0 = x => Math.round(x).toLocaleString("en-US");
const STAGE_NAME = { mash: "Mashing", lauter: "Lautering", heat: "Heating to the boil", boil: "Boiling", whirlpool: "Whirlpool", cool: "Cooling the wort", ferment: "Fermenting", rest: "Diacetyl rest", mature: "Cold conditioning" };
const STAGE_COL = { mash: "#c47a4a", lauter: "#a98958", heat: "#d9822b", boil: "#c5050c", whirlpool: "#8d949b", cool: "#1f6fd1", ferment: "#b26a00", rest: "#d48a25", mature: "#4e9ad6" };

// ---------------- state ----------------
const S = { inp: { ...DEFAULTS }, B: null, i: 0 };
function recompute(keep = true) {
  const frac = S.B && keep ? S.i / (S.B.timeline.n - 1) : null;
  S.B = runBatch(S.inp); const n = S.B.timeline.n;
  $("scrub").max = n - 1; S.i = frac === null ? S.B.timeline.nBrew + 72 : Math.min(n - 1, frac * (n - 1));
  drawStatic(); refreshAll();
}
const cur = () => stateAt(S.B, Math.floor(S.i));

// ---------------- three.js scene ----------------
const stage = $("stage");
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, stencil: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.78;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.prepend(renderer.domElement);
const scene = new THREE.Scene(), overlay = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 400);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.497; controls.minDistance = 0.6; controls.maxDistance = 60;
scene.add(new THREE.HemisphereLight("#f4f6fa", "#b9b0a2", 0.55));
const SUN_DIR = new THREE.Vector3(0.35, 0.82, 0.45).normalize();
const sun = new THREE.DirectionalLight("#fff3e2", 2.4); sun.castShadow = true;
const POST = makePost(renderer, scene, overlay, camera);
const LOW = POST.tier === "low";
sun.shadow.mapSize.setScalar(LOW ? 1024 : 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 4;
scene.add(sun, sun.target);
function fitShadow() {
  const t = controls.target, d = camera.position.distanceTo(t), ext = Math.min(26, Math.max(5, d * 0.95));
  sun.target.position.copy(t); sun.position.copy(t).addScaledVector(SUN_DIR, 60);
  const c = sun.shadow.camera; if (Math.abs(c.right - ext) > ext * 0.1) { Object.assign(c, { left: -ext, right: ext, top: ext, bottom: -ext, near: 10, far: 130 }); c.updateProjectionMatrix(); }
}
const BR = buildBrewery({ renderer, scene, overlay, low: LOW });
const beacon = new THREE.Group(); { const m = new THREE.MeshBasicMaterial({ color: "#e0262c", transparent: true, opacity: 0.9, depthTest: false, side: THREE.DoubleSide });
  const r1 = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 48), m), r2 = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 48), m); beacon.add(r1, r2); beacon.visible = false; beacon.renderOrder = 30; overlay.add(beacon); }
const VIEWS = BR.VIEWS; let tween = null, viewName = "overview";
function goTo(name, instant = false) {
  const v = VIEWS[name]; viewName = name; const to = { p: new THREE.Vector3(...v.p), c: new THREE.Vector3(...v.c), fov: v.fov };
  if (name === "overview") { const k = Math.max(1, 1.55 * stage.clientHeight / Math.max(1, stage.clientWidth)); to.p.sub(to.c).multiplyScalar(k).add(to.c); }   // pull back until the whole brewery fits the width
  else if (stage.clientWidth < stage.clientHeight * 1.1 && name !== "yeast") { to.p.sub(to.c).multiplyScalar(1.45).add(to.c); to.fov = v.fov + 8; }
  document.querySelectorAll(".views [data-view]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.view === name)));
  if (instant || matchMedia("(prefers-reduced-motion: reduce)").matches) { camera.position.copy(to.p); controls.target.copy(to.c); camera.fov = to.fov; camera.updateProjectionMatrix(); controls.update(); return; }
  tween = { from: { p: camera.position.clone(), c: controls.target.clone(), fov: camera.fov }, to, t0: performance.now(), dur: 1400 };
}
document.querySelectorAll(".views [data-view]").forEach(b => b.onclick = () => goTo(b.dataset.view));
function setCut(on) { BR.setCutaway(on); document.querySelectorAll("#cut-seg button").forEach(b => b.setAttribute("aria-pressed", String((b.dataset.c === "1") === on))); }
document.querySelectorAll("#cut-seg button").forEach(b => b.onclick = () => setCut(b.dataset.c === "1"));

// what the 3D scene shows for the current state
function visual() {
  const s = cur(), B = S.B, TL = B.timeline, V = { stage: s.stage, frac: s.frac || 0, part: s.part, srm: STYLES[S.inp.style]?.srm ?? 6 };
  if (s.part === "cellar") {
    const tReady = B.fz.tReady === null ? null : B.fz.tReady / 3600, cold = s.phase === "cold" && tReady !== null;
    V.co2Rate = cold ? 0 : s.co2Rate; V.valve = s.u; V.settled = cold ? Math.min(1, (s.tH - tReady) / (B.clearDays * 24)) : 0;
    V.yeast = cold ? 1 - V.settled : Math.min(1, 0.35 + 0.65 * s.att); V.yeastPop = (s.X - B.fz.X0) / Math.max(1, B.fz.y[3] - B.fz.X0);
    V.label = `${f1(Math.max(0, s.AE))} °P · ${f1(s.abv)} % alcohol · ${f1(s.T)} °C`;
    V.kegs = Math.max(0, (S.i - (TL.n - 1 - 30)) / 30);
  } else { V.co2Rate = 0; V.valve = 0; V.yeastPop = 0.1; V.kegs = 0; }
  return V;
}

// ---------------- readouts ----------------
function clockText(s) {
  if (s.part === "brew") { const h = Math.floor(s.tMin / 60), m = Math.round(s.tMin % 60); return `Brew day · ${h} h ${String(m).padStart(2, "0")} min`; }
  return `Day ${f1(s.tH / 24)} in the tank`;
}
const put = (id, v, html) => { const el = $(id); if (el.__v === v) return; el.__v = v; if (html) el.innerHTML = v; else el.textContent = v; };
function refreshAll() {
  const s = cur(), B = S.B, st = s.phase === "rest" ? "rest" : s.stage;
  put("r-stage", STAGE_NAME[st]); { const cn = "status-chip " + (s.part === "brew" ? "" : s.stage === "mature" ? "water" : "go"); if ($("r-stage").className !== cn) $("r-stage").className = cn; }
  put("clock", clockText(s)); $("scrub").value = Math.floor(S.i);
  if (s.part === "brew") { put("r-big", `${f1(B.OG)} °P<small>wort being made</small>`, true); put("r-when", `${STAGE_NAME[st]} at ${f1(s.T)} °C`); }
  else { put("r-big", `${f1(Math.max(0, s.AE))} °P<small>gravity now</small>`, true); put("r-when", `started at ${f1(B.OG)} °P`); }
  put("r-og", `${f1(B.OG)} °P <small>SG ${B.SG.toFixed(3)}</small>`, true);
  put("r-abv", s.part === "brew" ? "0.0 %" : `${f1(s.abv)} % by volume`);
  put("r-temp", s.part === "brew" ? `${f1(s.T)} °C` : `${f1(s.T)} °C <small>set ${f1(s.Tsp)}</small>`, true);
  put("r-sugar", s.part === "brew" ? "100 %" : `${f0((1 - s.att) * 100)} % of fermentable`);
  put("r-vdk", s.part === "brew" ? "–" : `${f2(s.V)} mg/L <small>${s.V < C.vdkLimit ? "below" : "above"} ${C.vdkLimit}</small>`, true);
  put("r-ready", B.readyDays === null ? "not within 40 days" : `day ${f1(B.readyDays)}`);
  put("tag", s.part === "brew" ? `${STAGE_NAME[st]} · ${f1(s.T)} °C · ${clockText(s)}` : `${STAGE_NAME[st]} · ${f1(s.T)} °C (set ${f1(s.Tsp)}) · valve ${f0(s.u * 100)} % · ${f1(Math.max(0, s.AE))} °P · ${f1(s.abv)} % ABV`);
  drawCursors(); takeawayNow(); lensRefresh(); if (mdlOpen) refreshModelLive(); rateNote();
}
function refreshBatch() {   // numbers that depend only on the inputs
  const B = S.B, i = S.inp;
  put("r-conv", `${f0(B.ms.conv * 100)} %`); put("r-fermsh", `${f0(B.ms.ferm * 100)} % of extract`);
  put("r-lauter", `${f0(B.lauterMin)} min <small>bed ${f0(B.bedDepth * 100)} cm</small>`, true); put("r-ibu", `${f0(B.IBU)} IBU <small>${f0(B.util * 100)} % used</small>`, true);
  put("r-evap", `${f0(B.mEvap)} kg of water`);
  put("r-peakq", `${f0(B.fz.peakQ * C.V)} W <small>hour ${f0(B.fz.tPeakQ / 3600)}</small>`, true); put("r-peakt", `${f1(Math.max(...B.fz.rec.T))} °C`);
  put("r-co2", `${f0(B.co2Kg)} kg <small>needs ${f0(B.co2AddKg)} to carbonate</small>`, true); put("r-pb", `${f2(B.pBright / 1e5 - 1.013)} bar gauge <small>at ${B.Tbright} °C</small>`, true);
  put("r-clear", `${f1(B.clearDays)} days`);
  put("r-water", `${f1(B.waterRatio)} L per L of beer`); put("r-heat", `${f1(B.thermalKWhHl)} kWh per hL`);
  put("r-rec", `${f0(B.Qrec / (B.QmashWater + B.QspargeWater) * 100)} % <small>of water heating</small>`, true); put("r-elec", `${f2(B.elecKWhHl)} kWh per hL`);
  put("r-co2hl", `${f1(B.co2KgHl)} kg per hL`); put("r-spent", `${f1(B.spentKgHl)} kg wet per hL`); put("r-pack", `${f1(B.Vpack * 10)} hL <small>${B.kegs} kegs</small>`, true);
  takeawayFerm(); takeawayBrew(); takeawayCellar(); takeawaySustain();
}

// ---------------- charts ----------------
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
function setupCanvas(c) { const r = c.getBoundingClientRect(), dpr = Math.min(devicePixelRatio, 2); if (r.width < 4) return null; const W = Math.max(10, Math.round(r.width * dpr)), H = Math.max(10, Math.round(r.height * dpr)); if (c.width !== W || c.height !== H) { c.width = W; c.height = H; } const g = c.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, r.width, r.height); return { g, w: r.width, h: r.height }; }
// generic line chart: left axis for most series, optional right axis; returns the x-scale for cursors
function lineChart(id, { x, xmax, xLabel, xTicks, L, Rax, series, marks = [] }) {
  const cv = setupCanvas($(id)); if (!cv) return null; const { g, w, h } = cv, m = { l: 34, r: Rax ? 30 : 8, t: 8, b: 26 };
  const X = v => m.l + v / xmax * (w - m.l - m.r), YL = v => h - m.b - (v - L.min) / (L.max - L.min) * (h - m.t - m.b), YR = v => h - m.b - (v - Rax.min) / (Rax.max - Rax.min) * (h - m.t - m.b);
  g.clearRect(0, 0, w, h); g.font = "10.5px JetBrains Mono, monospace"; g.fillStyle = css("--ink-2"); g.strokeStyle = css("--rule"); g.lineWidth = 1;
  g.textAlign = "right"; g.textBaseline = "middle"; for (const t of L.ticks) { g.beginPath(); g.moveTo(m.l, YL(t)); g.lineTo(w - m.r, YL(t)); g.stroke(); g.fillText(String(t), m.l - 4, YL(t)); }
  if (Rax) { g.textAlign = "left"; g.fillStyle = Rax.color; for (const t of Rax.ticks) g.fillText(String(t), w - m.r + 4, YR(t)); g.fillStyle = css("--ink-2"); }
  g.textAlign = "center"; g.textBaseline = "top"; for (const t of xTicks) g.fillText(String(t), X(t), h - m.b + 4);
  g.fillText(xLabel, m.l + (w - m.l - m.r) / 2, h - 11);
  for (const mk of marks) { g.strokeStyle = mk.color; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(X(mk.x), m.t); g.lineTo(X(mk.x), h - m.b); g.stroke(); g.setLineDash([]); }
  for (const sr of series) { const Y = sr.axis === "R" ? YR : sr.scale ? v => h - m.b - (v - sr.scale[0]) / (sr.scale[1] - sr.scale[0]) * (h - m.t - m.b) : YL; g.strokeStyle = sr.color; g.lineWidth = sr.width || 1.6; g.setLineDash(sr.dash || []); g.beginPath(); for (let k = 0; k < x.length; k++) { const px = X(x[k]), py = Y(sr.y[k]); k ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); g.setLineDash([]); }
  return { X, m, h, w };
}
const niceTicks = (max, n = 4) => { const step = [1, 2, 2.5, 5, 10, 20, 25, 50, 100, 200].find(s => max / s <= n) || 500; const t = []; for (let v = 0; v <= max + 1e-9; v += step) t.push(+v.toFixed(2)); return t; };
let CH = {};
function drawStatic() {
  const B = S.B, r = B.fz.rec, days = r.t.map(t => t / 24), dmax = days[days.length - 1], xt = niceTicks(dmax, 7).filter(v => Number.isInteger(v));
  const gl = k => (r[k] || []).map(v => v * MW[k] / 1000), Gs = gl("G"), Ms = gl("M"), Ns = gl("N"), ymax = Math.ceil(Math.max(Ms[0], Ns[0], Gs[0]) / 20) * 20;
  const abv = r.E.map(e => e * MW.E / 1000 / 7.893), amax = Math.max(6, Math.ceil(abv[abv.length - 1]));
  const marks = []; if (B.restDay !== null) marks.push({ x: B.restDay, color: "#d48a25" }); if (B.readyDays !== null) marks.push({ x: B.readyDays, color: "#4e9ad6" });
  CH.ferm = lineChart("c-ferm", { x: days, xmax: dmax, xLabel: "days in the tank", xTicks: xt, L: { min: 0, max: ymax, ticks: niceTicks(ymax) }, Rax: { min: 0, max: amax, ticks: niceTicks(amax, 3), color: css("--accent") }, marks,
    series: [{ y: r.T, color: css("--ink-2"), dash: [4, 3], width: 1.2, scale: [0, 25] }, { y: Gs, color: "#b26a00" }, { y: Ms, color: css("--signal") }, { y: Ns, color: "#1f8a4c" }, { y: abv, color: css("--accent"), axis: "R", width: 2.2 }] });
  const mc = B.ms.curve, mt = mc.map(p => p.t), pc = k => mc.map(p => p[k] * 100);
  CH.mash = lineChart("c-mash", { x: mt, xmax: mt[mt.length - 1], xLabel: "minutes in the mash tun", xTicks: niceTicks(mt[mt.length - 1], 6), L: { min: 0, max: 100, ticks: [0, 25, 50, 75, 100] },
    series: [{ y: pc("S"), color: css("--ink-2") }, { y: pc("D"), color: "#b26a00" }, { y: pc("b"), color: css("--signal"), dash: [4, 3] }, { y: pc("F"), color: css("--accent"), width: 2.2 }] });
  const tmax = Math.max(22, Math.ceil(Math.max(...r.T) / 2) * 2 + 2);
  CH.temp = lineChart("c-temp", { x: days, xmax: dmax, xLabel: "days in the tank", xTicks: xt, L: { min: -2, max: tmax, ticks: niceTicks(tmax, 4) }, Rax: { min: 0, max: 100, ticks: [0, 50, 100], color: css("--signal") },
    series: [{ y: r.u.map(u => u * 100), color: css("--signal"), axis: "R", width: 1.1 }, { y: r.Tsp, color: css("--ink-2"), dash: [4, 3] }, { y: r.T, color: css("--accent"), width: 2 }] });
  drawStageBar(); refreshBatch();
}
// stage bar: brew-day stages take the left 30 %, the cellar the rest
const BARSPLIT = 0.3;
function barX(i, w) { const TL = S.B.timeline; return i < TL.nBrew ? i / TL.nBrew * BARSPLIT * w : (BARSPLIT + (i - TL.nBrew) / Math.max(1, TL.nFerm - 1) * (1 - BARSPLIT)) * w; }
let barImg = null;
function drawStageBar() {
  const cv = setupCanvas($("stagebar")); if (!cv) return; const { g, w, h } = cv, B = S.B, TL = B.timeline; g.clearRect(0, 0, w, h); g.font = "600 10.5px Barlow Semi Condensed, sans-serif"; g.textBaseline = "middle";
  const seg = (i0, i1, key, label) => { const x0 = barX(i0, w), x1 = barX(i1, w); g.fillStyle = STAGE_COL[key]; g.fillRect(x0, 0, Math.max(1, x1 - x0 - 1), h); if (x1 - x0 > g.measureText(label).width + 8) { g.fillStyle = "#fff"; g.fillText(label, x0 + 4, h / 2 + 1); } };
  TL.stages.forEach(s => seg(s.t0, s.t1, s.name, { mash: "Mash", lauter: "Lauter", heat: "", boil: "Boil", whirlpool: "", cool: "Cool" }[s.name]));
  const ph = B.fz.rec.phase; let k0 = 0; for (let k = 1; k <= ph.length; k++) if (k === ph.length || ph[k] !== ph[k0]) { const key = ph[k0] === "cold" ? "mature" : ph[k0] === "rest" ? "rest" : "ferment"; seg(TL.nBrew + k0, TL.nBrew + k, key, { ferment: "Fermentation", rest: "Rest", mature: "Cold conditioning" }[key]); k0 = k; }
  barImg = g.getImageData(0, 0, cv.g.canvas.width, cv.g.canvas.height);
}
function drawCursors() {
  const s = cur(), bar = $("stagebar"), g = bar.getContext("2d"); if (barImg) { g.putImageData(barImg, 0, 0); const w = bar.getBoundingClientRect().width, x = barX(S.i, w); g.fillStyle = "#1d2733"; g.fillRect(x - 1.5, 0, 3, 40); g.fillStyle = "#fff"; g.fillRect(x - 0.5, 0, 1, 40); }
  for (const [id, key] of [["c-ferm", "ferm"], ["c-temp", "temp"]]) { const c = CH[key]; if (!c) continue; const cv = $(id), gg = cv.getContext("2d"); if (!c.img) c.img = gg.getImageData(0, 0, cv.width, cv.height); gg.putImageData(c.img, 0, 0);
    if (s.part === "cellar") { const dpr = cv.width / c.w, x = c.X(s.tH / 24); gg.save(); gg.setTransform(dpr, 0, 0, dpr, 0, 0); gg.strokeStyle = css("--ink"); gg.lineWidth = 1; gg.beginPath(); gg.moveTo(x, c.m.t); gg.lineTo(x, c.h - c.m.b); gg.stroke(); gg.restore(); } }
  if (CH.mash) { const c = CH.mash, cv = $("c-mash"), gg = cv.getContext("2d"); if (!c.img) c.img = gg.getImageData(0, 0, cv.width, cv.height); gg.putImageData(c.img, 0, 0);
    if (s.part === "brew" && s.stage === "mash") { const dpr = cv.width / c.w, x = c.X(s.tMin); gg.save(); gg.setTransform(dpr, 0, 0, dpr, 0, 0); gg.strokeStyle = css("--ink"); gg.beginPath(); gg.moveTo(x, c.m.t); gg.lineTo(x, c.h - c.m.b); gg.stroke(); gg.restore(); } }
}

// ---------------- "What this means": plain-language takeaways built from the live numbers ----------------
const TK = (id, html) => put(id, html ? `<b>What this means</b>${html}` : "", true);
const GLASS = 0.355;   // litres in a 12 oz glass
function takeawayNow() {
  const s = cur(), B = S.B, st = s.phase === "rest" ? "rest" : s.stage; let t;
  if (st === "mash") t = `Malt enzymes are cutting starch into sugar at ${f1(S.inp.mashT)} °C: ${f0((s.F || 0) * 100)} % is fermentable so far. No alcohol yet.`;
  else if (st === "lauter") t = `Sweet wort drains through the grain husks, its own filter, in about ${f0(B.lauterMin)} minutes.`;
  else if (st === "heat" || st === "boil") t = `Boiling sterilizes the wort, drives off ${f0(B.mEvap)} kg of water and turns hop acids bitter${s.I ? ` (${f1(s.I)} mg/L so far)` : ""}. It is the most energy-hungry step.`;
  else if (st === "whirlpool") t = "Spinning collects hop bits and proteins in the middle, like tea leaves in a stirred cup.";
  else if (st === "cool") t = `The wort cools from ${C.Twhirl1} °C in ${C.coolMin} minutes; the water leaves at ${f0(B.cool.TcwOut)} °C and is reused.`;
  else if (st === "mature") t = `Fermentation is done at ${f1(B.ABV)} % alcohol. Near 0 °C the yeast sinks in about ${f1(B.clearDays)} days and the beer clears.`;
  else if (s.T > s.Tsp + 2) t = `<b>Too warm:</b> the tank is at ${f1(s.T)} °C, ${f1(s.T - s.Tsp)} °C above target, so the yeast makes more off-flavours. Switch the cooling back on.`;
  else {
    const speed = s.co2Rate > 0.6 ? "at full speed" : s.co2Rate > 0.2 ? "steadily" : "slowly, near the end";
    t = `${st === "rest" ? "<b>Diacetyl rest:</b> the tank warms so the yeast clears the buttery flavour." : `The yeast is working ${speed}.`} ${f0((1 - s.att) * 100)} % of the sugar is left at ${f1(s.abv)} % alcohol${s.V >= C.vdkLimit ? `; diacetyl (${f2(s.V)} mg/L) is above the ${C.vdkLimit} mg/L taste limit, so it is <b>not ready</b>` : "; diacetyl is below the taste limit"}.${B.readyDays === null ? " This batch never finishes: warm it up or pitch more yeast." : ""}`;
  }
  TK("tk-now", t);
}
function takeawayFerm() {
  const B = S.B, tsp = B.wort.fermGL * GLASS / 4.2;
  if (B.readyDays === null) return TK("tk-ferm", "<b>This batch is stuck:</b> the sugar is not used up within 40 days. Raise the fermentation temperature or the pitch rate.");
  TK("tk-ferm", `Yeast eats glucose first, then maltose, then maltotriose. Roughly ${f0(tsp)} teaspoons of sugar per glass become a ${f1(B.ABV)} % beer in ${f1(B.readyDays)} days; warmer or more yeast is faster.`);
}
function takeawayBrew() {
  const B = S.B, T = S.inp.mashT, kind = T < 62 ? "low" : T > 67.5 ? "high" : "mid";
  const mash = kind === "low" ? `<b>Cool mash:</b> only ${f0(B.ms.conv * 100)} % of the starch dissolves at ${f1(T)} °C, so malt is wasted.`
    : kind === "high" ? `<b>Hot mash:</b> at ${f1(T)} °C the sugar-making enzyme dies early; only ${f0(B.ms.ferm * 100)} % can ferment, a fuller beer with less alcohol.`
    : `<b>Balanced mash:</b> at ${f1(T)} °C, ${f0(B.ms.ferm * 100)} % of the extract can ferment.`;
  const bit = B.IBU < 15 ? "barely bitter" : B.IBU < 30 ? "moderately bitter" : B.IBU < 50 ? "clearly bitter" : "very bitter";
  TK("tk-brew", `${mash} ${f0(B.IBU)} bitterness units: ${bit}.${B.lauterMin > 120 ? " Run-off is slow: the grain bed is deep." : ""}`);
}
function takeawayCellar() {
  const B = S.B, W = B.fz.peakQ * C.V, off = S.inp.control === "off", peakT = Math.max(...B.fz.rec.T);
  const ctl = off ? `<b>Cooling is off:</b> the tank warms itself to ${f1(peakT)} °C and makes more off-flavours.`
    : `At its peak the yeast gives off ${f0(W)} W, about ${W > 1500 ? "a space heater" : W > 600 ? "a microwave oven" : "a few light bulbs"}; the jacket holds the tank within ${f1(Math.max(0, peakT - (S.inp.fermT + S.inp.rest)))} °C of target.`;
  TK("tk-cellar", `${ctl} Fermentation makes ${f0(B.co2Kg / Math.max(1, B.co2AddKg))} times the CO₂ needed to carbonate the beer.`);
}
function takeawaySustain() {
  const B = S.B, phone = 0.015, perGlass = (B.thermalKWhHl + B.elecKWhHl) / 100 * GLASS, rec = B.Qrec / (B.QmashWater + B.QspargeWater) * 100;
  TK("tk-sustain", `Each glass takes about ${f1(B.waterRatio)} glasses of water and roughly ${f0(perGlass / phone)} phone charges of energy, mostly for the boil. The cooler returns ${f0(rec)} % of the water-heating need; real breweries use more${ref(13)} because cleaning and packaging are left out here.`);
}

// ---------------- lenses, spots, intro ----------------
const courseLink = n => `<a class="course" href="https://guide.wisc.edu/search/?P=CBE%20${n}" target="_blank" rel="noopener" title="CBE ${n}: ${COURSE[n][1]}">${COURSE[n][0].replace("&", "&amp;")} ↗</a>`;
const lensNav = $("lenses"), lensCard = $("lens-card");
LENSES.forEach((L, i) => {
  const b = document.createElement("button"); b.type = "button"; b.textContent = COURSE[L.n][0]; b.dataset.i = i;
  b.setAttribute("aria-pressed", "false"); b.title = `CBE ${L.n}: see where ${COURSE[L.n][0]} shows up in this digital twin`;
  b.onclick = () => (lens && lens.i === i ? closeLens() : openLens(i)); lensNav.appendChild(b);
});
const SCRUB = "Scrub to the fermentation.";
const LIVE = {
  250: () => { const B = S.B; return `${f0(S.inp.malt)} kg malt → ${f0(B.extractKettle)} kg extract (${f0(B.brewhouseYield * 100)} %), ${f0(B.spentWet)} kg wet spent grain.`; },
  255: () => { const s = cur(); return s.part === "cellar" ? `Hour ${f0(s.tH)}: glucose ${f1(s.G)}, maltose ${f1(s.M)}, maltotriose ${f1(s.N)}, ethanol ${f0(s.E)} mol/m³.` : SCRUB; },
  310: () => { const B = S.B; return `${f0(B.Qheat / 3.6e6)} kWh to reach the boil + ${f0(B.Qevap / 3.6e6)} kWh to evaporate ${f0(B.mEvap)} kg of water.`; },
  311: () => { const B = S.B; return `${f1(S.inp.vols)} volumes at ${B.Tbright} °C needs ${f2(B.pBright / 1e5)} bar absolute; ${f1(B.cEndFerm * 0.022414)} are already dissolved.`; },
  320: () => { const B = S.B; return `Bed ${f0(B.bedDepth * 100)} cm, ${f2(muWort(C.Tlauter, B.Ppre) * 1000)} mPa·s → ${f1(B.Qlauter * 60000)} L/min, ${f0(B.lauterMin)} min.`; },
  326: () => { const c = S.B.cool; return `ε = ${f2(c.eps)} (NTU ${f1(c.NTU)}): wort out ${f1(c.TwortOut)} °C, water out ${f1(c.TcwOut)} °C, ${f0(c.q / 1000)} kW.`; },
  426: () => { const B = S.B; return `${f0(B.co2Kg)} kg CO₂ made; ${f0(B.co2AddKg)} kg to dissolve; ${f0(B.extractMash - B.extractKettle)} kg extract left in the grain.`; },
  450: () => { const B = S.B; return B.tankDays ? `${f1(B.tankDays)} tank days → about ${f0(365 / (B.tankDays + 1))} batches a year; ${f1(B.waterRatio)} L water and ${f1(B.thermalKWhHl + B.elecKWhHl)} kWh per hL.` : "This batch does not finish."; },
  470: () => { const s = cur(); return s.part === "cellar" ? `T = ${f2(s.T)} °C, set ${f1(s.Tsp)} °C, valve ${f0(s.u * 100)} %, yeast heat ${f0(s.q * C.V)} W.` : SCRUB; },
};
const LIVE2 = {
  "7-0": () => { const s = cur(), B = S.B; return s.I !== undefined ? `${f1(s.A)} mg/L α-acids left, ${f1(s.I)} mg/L iso-α-acids made.` : `Boil ends with ${f1(B.isoWort)} mg/L iso-α-acids; ${f0(B.IBU)} IBU in the glass.`; },
  "7-1": () => { const s = cur(); return s.part === "cellar" ? `Yeast releases ${f0(s.q * C.V)} W; the jacket removes ${f0(s.qc * C.V)} W, valve ${f0(s.u * 100)} %.` : SCRUB; },
  "10-0": () => { const s = cur(); if (s.part !== "cellar") return SCRUB; const r = fermRates([s.G, s.M, s.N, s.X], s.T + 273.15); return `Uptake per hour: glucose ${(r.m1 * 3600).toFixed(4)}, maltose ${(r.m2 * 3600).toFixed(4)}, maltotriose ${(r.m3 * 3600).toFixed(4)}. Yeast up ${f0((s.X / S.B.fz.X0 - 1) * 100)} %.`; },
  "10-1": () => { const m = S.B.ms; return `Half-lives at ${f1(S.inp.mashT)} °C: β-amylase ${f0(Math.LN2 / m.kdb)} min, α-amylase ${f0(Math.LN2 / m.kda)} min.`; },
};
let lens = null, lensPrev = null;
function openLens(i, k = 0) {
  $("realworld").setAttribute("aria-pressed", "false");
  if (!lens) lensPrev = { p: camera.position.clone(), c: controls.target.clone(), fov: camera.fov, cut: BR.isCut() };
  lens = { i, k }; lensNav.querySelectorAll("button[data-i]").forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.i === i))); showStop();
}
function showStop() {
  const L = LENSES[lens.i], St = L.stops[lens.k];
  if (St.cut !== undefined) setCut(St.cut); goTo(St.view);
  document.querySelectorAll(".lens-hl").forEach(e => e.classList.remove("lens-hl"));
  if (St.panel) { const el = $(St.panel); if (el.classList.contains("fold")) setFold(el, true); el.classList.add("lens-hl"); }
  const last = lens.k === L.stops.length - 1;
  const EQN = eqByNo(+(St.eq.match(/\((\d+)\)/) || [0, 1])[1]);
  lensCard.innerHTML = `
    <div class="lc-top"><span class="lc-subject">${COURSE[L.n][0].replace("&", "&amp;")}</span>
      <span class="lc-step">${L.stops.length > 1 ? `${lens.k + 1} of ${L.stops.length}` : ""}</span>
      <button class="lc-x" type="button" aria-label="Close">×</button></div>
    <h3>${St.title}</h3>
    <p>${St.text}</p>
    <p class="lc-plain"><b>Plainly:</b> ${St.plain}</p>
    <details class="lc-eq"><summary>Show the equation</summary><div><div class="lc-tex">${texHTML(dispTex(EQN.tex), true)}</div><p class="lc-eqref">Eq. (${EQN.no}) · ${EQN.name} · <button type="button" id="lc-model">open in ∑ Model ▸</button></p></div></details>
    <p class="lc-live" id="lc-live"></p>
    <p class="lc-why"><b>Why:</b> ${St.why}</p>
    <p class="lc-course">Course: ${courseLink(L.n)}</p>
    ${RESEARCH.filter(r => r.lens && r.lens[0] === lens.i && (r.lens[1] || 0) === lens.k).map(r => `<p class="lc-research">Related research at UW–Madison: <button type="button" data-res="${r.id}">${r.name} ▸</button></p>`).join("")}
    <div class="lc-nav">
      <button class="btn" type="button" id="lc-back" ${lens.k === 0 ? "disabled" : ""}>Back</button>
      <button class="btn primary" type="button" id="lc-next">${last ? "Done" : "Next"}</button>
    </div>`;
  lensCard.hidden = false; showCard();
  lensCard.querySelector(".lc-x").onclick = closeLens;
  $("lc-back").onclick = () => { if (lens.k > 0) { lens.k--; showStop(); } };
  $("lc-next").onclick = () => { if (last) closeLens(); else { lens.k++; showStop(); } };
  $("lc-model").onclick = () => toggleModel(true, "eq-" + EQN.no);
  lensCard.querySelectorAll("[data-res]").forEach(b => b.onclick = () => toggleResearch(true, b.dataset.res));
  placeBeacon(); lensRefresh(); markSpot();
}
function showCard() { const a = document.querySelector("aside"); if (matchMedia("(max-width: 860px)").matches) lensCard.scrollIntoView({ block: "start", behavior: "smooth" }); else a.scrollTo({ top: 0, behavior: "smooth" }); }
function placeBeacon() { if (!lens) return; const p = BR.A[LENSES[lens.i].stops[lens.k].beacon]; beacon.position.copy(p); beacon.scale.setScalar(LENSES[lens.i].stops[lens.k].beacon === "yeast" ? 0.2 : 0.55); beacon.visible = true; }
function lensRefresh() { if (!lens) return; const el = $("lc-live"); if (!el) return; const L = LENSES[lens.i], f = LIVE2[`${lens.i}-${lens.k}`] || LIVE[L.n]; const v = f ? f() : ""; if (el.__v !== v) { el.__v = v; el.innerHTML = mathHTML(v); } }
function closeLens() {
  if (!lens) return; lens = null; markSpot(); lensCard.hidden = true; beacon.visible = false;
  document.querySelectorAll(".lens-hl").forEach(e => e.classList.remove("lens-hl"));
  lensNav.querySelectorAll("button[data-i]").forEach(b => b.setAttribute("aria-pressed", "false"));
  if (lensPrev) { setCut(lensPrev.cut); tween = { from: { p: camera.position.clone(), c: controls.target.clone(), fov: camera.fov }, to: { p: lensPrev.p, c: lensPrev.c, fov: lensPrev.fov }, t0: performance.now(), dur: 1200 }; }
}
document.addEventListener("keydown", e => { if (e.key === "Escape") { if (!$("gd-panel").hidden) $("gd-panel").hidden = true; else if (resOpen) toggleResearch(false); else if (crsOpen) toggleCourses(false); else if (mdlOpen) toggleModel(false); else if (lens) closeLens(); else if (!lensCard.hidden) { lensCard.hidden = true; $("realworld").setAttribute("aria-pressed", "false"); } } });

function setFold(sec, open) { sec.classList.toggle("collapsed", !open); const h = sec.querySelector(":scope > h2"); if (h) h.setAttribute("aria-expanded", String(open)); if (open) requestAnimationFrame(() => { drawStatic(); refreshAll(); }); }
document.querySelectorAll("section.fold").forEach(sec => {
  const h = sec.querySelector(":scope > h2"); h.tabIndex = 0; h.setAttribute("role", "button"); h.setAttribute("aria-expanded", "false");
  const toggle = () => setFold(sec, sec.classList.contains("collapsed"));
  h.addEventListener("click", e => { if (!e.target.closest("a")) toggle(); });
  h.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
});
$("cond-toggle").onclick = e => { const on = e.currentTarget.getAttribute("aria-pressed") !== "true"; e.currentTarget.setAttribute("aria-pressed", String(on)); $("tag").hidden = !on; setFold($("sec-recipe"), on); setFold($("sec-ferm"), on); };
document.addEventListener("click", e => {
  const a = e.target.closest("a.ref"); if (!a) return; e.preventDefault();
  if (mdlOpen) { const li = document.getElementById("mref-" + a.dataset.ref); if (li) { li.scrollIntoView({ block: "center", behavior: "smooth" }); li.classList.add("flash"); setTimeout(() => li.classList.remove("flash"), 1600); } return; }
  const li = $("ref-" + a.dataset.ref); if (!li) return; setFold($("sec-refs"), true); li.scrollIntoView({ block: "center", behavior: "smooth" }); li.classList.add("flash"); setTimeout(() => li.classList.remove("flash"), 1600);
});
$("refs").innerHTML = REFS.map((r, i) => `<li id="ref-${i + 1}">${r}</li>`).join("");

function openIntro() {
  if (lens) closeLens();
  $("realworld").setAttribute("aria-pressed", "true"); beacon.visible = false;
  lensCard.innerHTML = `
    <div class="lc-top"><span class="lc-subject">Real world</span><button class="lc-x" type="button" aria-label="Close">×</button></div>
    <h3>Why is a brewery chemical engineering?</h3>
    <p>Yeast turns grain sugar into alcohol and CO₂. A brewery is a small chemical plant: reactors, heat exchangers, filters, controls.</p>
    <ul class="lc-list">
      <li><b>Biotechnology:</b> the same tanks and models make insulin, vaccines and biofuels.</li>
      <li><b>Energy and water:</b> a small brewery measured about 13 L of water and 5.8 MJ per litre of beer${ref(13)}.</li>
      <li><b>Nothing wasted:</b> spent grain, about 85 % of by-products${ref(12)}, feeds cattle.</li>
    </ul>
    <p class="lc-why"><b>Chemical engineers</b> design the plant, model the fermentation${ref(1)} and keep every batch the same.</p>
    <p class="lc-plain">Click a numbered spot or press Play. Educational model; alcohol is for adults of legal age.</p>
    <div class="lc-nav"><button class="btn primary" type="button" id="lc-next">Start exploring</button></div>`;
  lensCard.hidden = false; showCard();
  const done = () => { lensCard.hidden = true; $("realworld").setAttribute("aria-pressed", "false"); try { localStorage.setItem("brewery-intro-seen", "1"); } catch (e) {} };
  lensCard.querySelector(".lc-x").onclick = done; $("lc-next").onclick = done;
}
$("realworld").onclick = () => ($("realworld").getAttribute("aria-pressed") === "true" ? (lensCard.hidden = true, $("realworld").setAttribute("aria-pressed", "false")) : openIntro());

const spotLayer = $("spots"), spotEls = [];
SPOTS.forEach((Sp, i) => {
  const b = document.createElement("button"); b.type = "button"; b.className = "spot"; b.textContent = String(i + 1); b.setAttribute("aria-label", `ChemE spot ${i + 1}: ${Sp.name}`);
  const t = document.createElement("span"); t.textContent = Sp.name; b.appendChild(t); b.onclick = () => openLens(Sp.lens, Sp.k || 0); spotLayer.appendChild(b); spotEls.push(b);
});
const spotLines = $("spot-lines"), lineEls = SPOTS.map(() => { const l = document.createElementNS("http://www.w3.org/2000/svg", "line"); spotLines.appendChild(l); return l; });
const nameEls = NAMES.map(([t, , up]) => { const e = document.createElement("span"); e.className = up ? "nm up" : "nm"; e.textContent = t; spotLayer.appendChild(e); return e; });
// spots table: the numbered list of spot titles along the left edge of the stage
const spotTable = $("spot-table");
spotTable.innerHTML = `<button type="button" class="st-head" id="st-head" aria-expanded="true" title="Collapse or expand the list of ChemE spots"><span>ChemE spots</span><b>‹</b></button>` + SPOTS.map((Sp, i) => `<button type="button" class="st-row" data-s="${i}" title="${Sp.name}"><i>${i + 1}</i><span>${Sp.name}</span></button>`).join("");
function setSpotTable(min) { spotTable.classList.toggle("min", min); $("st-head").setAttribute("aria-expanded", String(!min)); $("st-head").querySelector("b").textContent = min ? "›" : "‹"; }
spotTable.onclick = e => { if (e.target.closest("#st-head")) return setSpotTable(!spotTable.classList.contains("min")); const r = e.target.closest(".st-row"); if (r) { const Sp = SPOTS[+r.dataset.s]; openLens(Sp.lens, Sp.k || 0); } };
setSpotTable(matchMedia("(max-width: 860px)").matches);
function markSpot() { SPOTS.forEach((Sp, i) => { const on = !!lens && lens.i === Sp.lens && lens.k === (Sp.k || 0); spotTable.children[i + 1].classList.toggle("on", on); spotEls[i].classList.toggle("on", on); }); }
const _v = new THREE.Vector3(), SPP = SPOTS.map(() => ({ x: 0, y: 0, tx: 0, ty: 0, vis: false }));
function placeSpots() {
  const w = stage.clientWidth, h = stage.clientHeight, micro = camera.position.y < -10, R = 38;
  const proj = p => { _v.copy(p).project(camera); return _v.z < 1 && _v.z > -1 && Math.abs(_v.x) < 0.98 && Math.abs(_v.y) < 0.96; };
  SPOTS.forEach((Sp, i) => { const q = SPP[i]; q.vis = !micro && proj(BR.A[Sp.at]); q.tx = q.x = (_v.x + 1) / 2 * w; q.ty = q.y = (1 - _v.y) / 2 * h; });
  // spots that project close together are pushed apart and joined to their true position by a leader line
  for (let it = 0; it < 8; it++) for (let i = 0; i < SPP.length; i++) for (let j = i + 1; j < SPP.length; j++) { const a = SPP[i], b = SPP[j]; if (!a.vis || !b.vis) continue;
    let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy); if (d >= R) continue; if (d < 0.5) { dx = 1; dy = 0; d = 1; } const m = (R - d) / 2 / d; a.x -= dx * m; a.y -= dy * m; b.x += dx * m; b.y += dy * m; }
  SPP.forEach((q, i) => { const el = spotEls[i], ln = lineEls[i], moved = q.vis && Math.hypot(q.x - q.tx, q.y - q.ty) > 5; el.style.display = q.vis ? "" : "none"; ln.style.display = moved ? "" : "none";
    if (q.vis) { el.style.left = `${q.x}px`; el.style.top = `${q.y}px`; } if (moved) { ln.setAttribute("x1", q.tx); ln.setAttribute("y1", q.ty); ln.setAttribute("x2", q.x); ln.setAttribute("y2", q.y); } });
  NAMES.forEach(([, at], i) => { const el = nameEls[i], vis = !micro && proj(BR.A[at]) && camera.position.distanceTo(BR.A[at]) > 9; el.style.display = vis ? "" : "none"; if (vis) { el.style.left = `${(_v.x + 1) / 2 * w}px`; el.style.top = `${(1 - _v.y) / 2 * h}px`; } });
}

// ---------------- Courses panel ----------------
const crs = { aud: "student", kind: "all", hi: null }; let crsOpen = false;
const openSec = id => { setFold($(id), true); $(id).scrollIntoView({ block: "start", behavior: "smooth" }); flash(id); };
const GO = {
  mash: () => { goTo("brewhouse"); openSec("sec-recipe"); }, lauter: () => openLens(4), kettle: () => { goTo("kettle"); openSec("sec-recipe"); }, cooler: () => { goTo("cooler"); openSec("sec-sustain"); },
  ferm: () => { setCut(true); goTo("ferment"); }, chart: () => { openSec("sec-now"); flash("trend-strip"); }, control: () => { setCut(true); goTo("ferment"); openSec("sec-ferm"); }, yeast: () => goTo("yeast"),
  carb: () => { goTo("cellar"); openSec("sec-ferm"); }, pack: () => goTo("packaging"), sustain: () => openSec("sec-sustain"),
  "m-num": () => toggleModel(true, "m-num"), "m-val": () => toggleModel(true, "m-val"),
};
function flash(id) { const el = $(id); el.classList.add("lens-hl"); setTimeout(() => el.classList.remove("lens-hl"), 1800); }
const FAM = CATALOG.families, featName = Object.fromEntries(FEATURES.map(f => [f.id, f]));
const courseList = () => COURSES.map(c => ({ ...CATALOG.courses[c.n], ...c })).sort((a, b) => a.order - b.order || a.n - b.n);
function renderCourses() {
  const list = courseList().filter(c => crs.kind === "all" || c.kind === crs.kind);
  const famOf = c => FAM[CATALOG.courses[c.n].topics[c.topics[0]][1]].color;
  const matrix = `<div class="crs-scroll"><table class="crs-map"><thead><tr><th>Twin feature</th>${list.map(c => `<th data-c="${c.n}" class="${crs.hi === c.n ? "hi" : ""}" title="CBE ${c.n}: ${c.title}">${c.n}</th>`).join("")}</tr></thead>
    <tbody>${FEATURES.map(f => `<tr><td><button class="crs-go" type="button" data-go="${f.go}">${f.name}</button></td>${list.map(c => `<td class="${crs.hi === c.n ? "hi" : ""}">${c.features.includes(f.id) ? `<i style="background:${famOf(c)}"></i>` : ""}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  const cards = list.map(c => `<article class="crs-card ${crs.hi === c.n ? "hi" : ""}" id="crs-${c.n}">
      <header><a href="https://guide.wisc.edu/search/?P=CBE%20${c.n}" target="_blank" rel="noopener">CBE ${c.n} ↗</a><span class="crs-term">${c.term}${c.kind === "elective" ? "" : " · core"}</span></header>
      <h4>${c.title}</h4>
      <div class="crs-topics">${c.topics.map(t => { const [name, fam] = CATALOG.courses[c.n].topics[t]; return `<span style="--fc:${FAM[fam].color}">${name}</span>`; }).join("")}</div>
      <div class="crs-uses">${c.features.map(id => featName[id]).map(f => `<button type="button" data-go="${f.go}">${f.name} →</button>`).join("")}</div>
      <p class="crs-act"><span>${crs.aud === "student" ? "Try this" : "Use in class"}</span>${crs.aud === "student" ? c.student : c.instructor}</p>
      <a class="crs-ps" href="${PS_LINK(c.n)}" target="_blank" rel="noopener">Problem set ↗</a>
    </article>`).join("");
  const fams = [...new Set(list.flatMap(c => c.topics.map(t => CATALOG.courses[c.n].topics[t][1])))];
  $("crs-body").innerHTML = `
    <p><b>One process, many courses:</b> balances, thermodynamics, transport, kinetics, control, design and biochemical engineering in one brewery.</p>
    <p>${list.length} courses. Click a feature to jump to it, or a course number for its card.</p>
    <h3>Course map</h3>${matrix}
    <p><a class="crs-ps" href="../problems/#brewery-Integrative" target="_blank" rel="noopener">Integrative problem ↗</a> one amber lager through seven courses.</p>
    <p class="crs-design"><b>Design problem:</b> <a href="#ps-560-3">Design a fuller, lower-alcohol lager</a> (product design, Biochem). The link loads the starting recipe; the full text is in the Biochem problem set.</p>
    <h3>Courses</h3><div class="crs-grid">${cards}</div>
    <p class="crs-legend">${fams.map(f => `<span><i style="background:${FAM[f].color}"></i>${FAM[f].label}</span>`).join("")}</p>`;
  mathDOM($("crs-body"));
}
function toggleCourses(on) { crsOpen = on; $("crs-panel").hidden = !on; if (on) { renderCourses(); $("crs-close").focus(); } }
$("open-courses").onclick = () => toggleCourses(true); $("hdr-courses").onclick = () => toggleCourses(true); $("crs-close").onclick = () => toggleCourses(false);
$("crs-panel").addEventListener("click", e => { if (e.target.id === "crs-panel") toggleCourses(false); });
for (const [id, key] of [["crs-aud", "aud"], ["crs-kind", "kind"]]) $(id).onclick = e => { const b = e.target.closest("button"); if (!b) return; crs[key] = b.dataset.a || b.dataset.k; $(id).querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); renderCourses(); };
$("crs-body").addEventListener("click", e => {
  const g = e.target.closest("[data-go]"); if (g) { toggleCourses(false); GO[g.dataset.go](); return; }
  if (e.target.closest(".crs-design a")) { toggleCourses(false); return; }
  const h = e.target.closest("th[data-c]"); if (h) { crs.hi = crs.hi === +h.dataset.c ? null : +h.dataset.c; renderCourses(); document.getElementById("crs-" + h.dataset.c)?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }
});
$("crs-summary").textContent = `${COURSES.length} courses, each with a problem set.`;

// ---------------- ∑ Model panel ----------------
let mdlOpen = false;
const T = String.raw;
// ---------- math typesetting (Part L): KaTeX HTML with KaTeX fonts; MathML if the fonts cannot load ----------
let KX_OUT = "html"; const kxCache = new Map();
function texHTML(src, display = false) {
  const esc = `<code>${src.replace(/</g, "&lt;")}</code>`;
  if (!window.katex) return esc;
  const key = KX_OUT + (display ? "D" : "I") + src; let h = kxCache.get(key); if (h) return h;
  try { h = window.katex.renderToString(src, { displayMode: display, output: KX_OUT, throwOnError: false, strict: "ignore" }); } catch (e) { h = esc; }
  kxCache.set(key, h); return h;
}
if (document.fonts && document.fonts.load) document.fonts.load("1em KaTeX_Main").then(l => { if (!l.length) { KX_OUT = "mathml"; kxCache.clear(); if (mdlOpen) renderModel(); } }).catch(() => {});
const GREEK = { "α": "\\alpha", "β": "\\beta", "ε": "\\varepsilon", "η": "\\eta", "λ": "\\lambda", "μ": "\\mu", "ρ": "\\rho", "τ": "\\tau", "φ": "\\varphi", "Δ": "\\Delta", "ℓ": "\\ell", "ė": "\\dot e" };
const grk = x => x.replace(/[α-ωΔℓė]/g, c => (GREEK[c] || c) + " ");
function symTeX(tok) {
  if (/^[\d.]+$/.test(tok)) return tok;
  const m = tok.match(/^(.+?)_(.+)$/); let base = m ? m[1] : tok; const sub = m ? m[2] : null;
  base = /^[A-Za-z]{2,}$/.test(base) && base !== "UA" ? `\\mathrm{${base}}` : grk(base);
  if (!sub) return base;
  return `${base}_{${sub.split(",").map(q => q === "CO₂" ? "\\mathrm{CO_2}" : (/^[a-z]{2,}$/.test(q) || /^[A-Za-z]{3,}$/.test(q)) ? `\\mathrm{${q}}` : grk(q)).join(",")}}`;
}
// symbols and small exponentials written in running text (k_α, C_min, e^{0.045 P}) are typeset inline, so they match the equations
const inlineMath = str => String(str).replace(/([A-Za-zα-ωΔ]'?)_([A-Za-z0-9α-ω]+)|e\^\{([^}]*)\}|e\^\(([^)]*)\)/g, (m, b, sub, x1, x2) => b ? texHTML(symTeX(m)) : texHTML(`e^{${(x1 ?? x2).replace(/−/g, "-").replace(/ /g, "\\,")}}`));
// One shared helper for math written in running text (Part V): subscripted variables (C_min, k₁), small exponentials, standalone Greek
// variables (ε, Δp) and one-letter variables in "x = …" are typeset with KaTeX so a symbol looks the same everywhere.
// Units and chemical names stay plain: CO₂, H₂O, m³, °C, α-acids, β-amylase, "1 s = 6 min".
const MATH_RE = /(Δ?[A-Za-zα-ω]'?_[A-Za-z0-9α-ω]+)|e\^\{([^}]*)\}|e\^\(([^)]*)\)|(?<![A-Za-z₀-₉])(?![OCN])([A-Za-zα-ω])([₀-₉]+)(?![A-Za-z₀-₉])|(?<![A-Za-zα-ω-])(Δ?[α-ω]|Δ[A-Za-z])(?![A-Za-zα-ω-])|(?<=^|[\s(;,:→])(?<!\d\s)([A-Za-z])(?= = )/g;
const SUBD = { "₀": 0, "₁": 1, "₂": 2, "₃": 3, "₄": 4, "₅": 5, "₆": 6, "₇": 7, "₈": 8, "₉": 9 };
const mathTok = (m, sym, x1, x2, ub, ud, gk, one) => m === "H₂" ? m : sym ? texHTML(symTeX(sym)) : x1 !== undefined || x2 !== undefined ? texHTML(`e^{${(x1 ?? x2).replace(/−/g, "-").replace(/ /g, "\\,")}}`)
  : ub ? texHTML(`${grk(ub)}_{${[...ud].map(c => SUBD[c]).join("")}}`) : gk ? texHTML(grk(gk)) : texHTML(one);
const mathHTML = str => String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(MATH_RE, mathTok);
function mathDOM(root) {   // typeset math found in the text nodes of an element that is already on the page
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), todo = []; let n;
  while ((n = tw.nextNode())) { const el = n.parentElement; if (!el || el.closest(".katex, script, style, select, option, code, [data-nomath]")) continue; MATH_RE.lastIndex = 0; if (MATH_RE.test(n.nodeValue)) todo.push(n); }
  for (const t of todo) { const sp = document.createElement("span"); sp.innerHTML = mathHTML(t.nodeValue); t.replaceWith(...sp.childNodes); }
}
const symHTML = str => str.split(", ").map(t => texHTML(symTeX(t))).join(", ");
const paramSym = str => str.split(", ").map(t => (t.includes("_") || t === "ΔH") && !/\s/.test(t) ? texHTML(symTeX(t)) : t).join(", ");
// display form: \dfrac, and long chains of equations broken into left-aligned lines
function dispTex(tex) {
  let t = tex.replace(/\\frac/g, "\\dfrac");
  if (t.includes("\\begin{aligned}")) return t;
  const parts = t.split(/,\s*\\qquad\s*/);
  if (parts.length > 1 && t.length > 105) t = `\\begin{aligned}&${parts.join(" \\\\[5pt] &")}\\end{aligned}`;
  return t;
}
const eqByNo = no => EQ.flatMap(g => g.items).find(x => x.no === no);
const GROUP_COURSES = [[250], [560, 430], [320, 326], [310], [430], [560, 430, 255], [470], [311, 426], [450]];
// rows added so that every symbol in an equation has a row
const MORE = {
  1: [["m_malt", "malt in the brew", "kg", "600–1300 (slider)"], ["V_pre", "wort collected in the kettle", "m³", "computed"], ["V_grain", "water held by the spent grain", "m³", "1.0 L per kg of malt (assumed)"], ["V_mash, V_sparge", "mash water and sparge water", "m³", "3.0 L per kg of malt (assumed); sparge by difference"]],
  2: [["SG", "specific gravity at 20 °C", "–", "1.03–1.07"], ["ρ_w", "density of water at 20 °C", "kg/L", "0.998"]],
  3: [["k_α, k_β", "rate constants of α- and β-amylase, from (5)", "1/min", "0.16, 0.075 at 65 °C (assumed)"], ["t", "time in the mash", "min", "0 to the mash time"]],
  4: [["a, b", "activity of α- and β-amylase", "–", "1 at mash-in"], ["t", "time in the mash", "min", "0 to the mash time"]],
  5: [["k", "any of the four mash rate constants", "1/min", "computed"], ["T", "mash temperature", "K", "331–345 (58–72 °C)"], ["R", "gas constant", "J/mol·K", "8.314"]],
  6: [["Q", "wort flow through the bed", "m³/s", "computed"], ["L", "depth of the grain bed", "m", "computed"], ["m_malt", "malt in the brew", "kg", "600–1300 (slider)"], ["V_pre", "wort collected in the kettle", "m³", "computed"], ["t_L", "time to run off the wort", "s", "computed"]],
  10: [["q", "heat moved from the wort to the water", "W", "computed"], ["ε", "effectiveness of the exchanger", "–", "0–1"], ["NTU", "number of transfer units", "–", "computed"], ["T_w,in", "wort inlet, at the end of the whirlpool", "°C", "92"]],
  20: [["v", "settling speed", "m/s", "computed"], ["g", "acceleration of gravity", "m/s²", "9.81"], ["t_clear", "time to clear the tank", "s", "computed"]],
  7: [["Q_K", "heat into the kettle", "J", "computed"], ["m", "wort in the kettle", "kg", "computed"], ["m_evap", "water boiled off, from (8)", "kg", "computed"]],
  8: [["V_pre, V_hot", "wort before and after the boil", "m³", "computed"], ["m_evap", "water boiled off", "kg", "computed"], ["ρ_100", "density of water at 100 °C", "kg/m³", "958"]],
  21: [["COP", "heat removed per unit of electricity", "–", "computed"], ["W_el", "compressor electricity", "J", "computed"], ["Q_cool", "heat removed by the glycol", "J", "computed"]],
  9: [["k_1, k_2", "isomerization and degradation rate constants", "1/min", "0.0125, 0.0031 at 100 °C"], ["t", "time in the kettle and whirlpool", "min", "30–120 boil + 20 whirlpool"]],
  11: [["r_G, r_M, r_N", "uptake rates of the three sugars", "mol/m³·s", "computed"]],
  12: [["k_i, K_i, K'_i", "rate, saturation and inhibition constants", "1/s, mol/m³", "computed"], ["R", "gas constant", "J/mol·K", "8.314"], ["T", "beer temperature", "K", "273–298"]],
  13: [["X", "yeast", "mol/m³", "solved"], ["μ_i", "specific uptake rate of sugar i", "1/s", "computed"], ["r_i", "uptake rates, from (11)", "mol/m³·s", "computed"], ["t", "time", "s", "0–40 days"]],
  14: [["E", "ethanol", "mol/m³", "solved"], ["r_G, r_M, r_N", "uptake rates, from (11)", "mol/m³·s", "computed"], ["t", "time", "s", "0–40 days"]],
  15: [["ρc_p", "heat capacity of the beer per volume", "J/m³·K", "about 4.2 × 10⁶ (c_p assumed 4000 J/kg·K)"], ["T", "beer temperature", "°C", "solved"], ["u", "glycol valve opening, from (16)", "–", "0–1"], ["r_G, r_M, r_N", "uptake rates, from (11)", "mol/m³·s", "computed"]],
  17: [["μ_X", "specific growth rate of the yeast, from (13)", "1/s", "computed"], ["X", "yeast", "mol/m³", "solved"], ["T", "beer temperature", "K", "solved"], ["R", "gas constant", "J/mol·K", "8.314"]],
  16: [["T", "beer temperature", "°C", "solved"], ["t", "time", "h", "0–40 days"]],
  18: [["c", "dissolved CO₂", "mol/m³", "computed"], ["H", "Henry solubility at the beer temperature", "mol/m³·Pa", "computed"], ["T", "beer temperature", "K", "273–277"]],
  19: [["c_EtOH", "ethanol concentration", "g/L", "computed"], ["ABV", "alcohol by volume", "%", "3–8"]],
  22: [["w", "water used per volume of beer", "L/L", "computed"], ["e_th", "fuel heat per volume of beer", "J/m³", "computed"], ["V_mash, V_sparge", "mash water and sparge water", "m³", "computed"], ["Q_water", "heat to warm the mash and sparge water", "J", "computed"], ["Q_rec", "heat recovered from the wort cooler", "J", "computed"], ["Q_K", "kettle heat, from (7)", "J", "computed"], ["Q_cooler", "heat removed in the wort cooler, from (10)", "J", "computed"]],
};
const EQ = [
  { group: "Balances: brewhouse", items: [
    { no: 1, name: "Extract balance from malt to kettle", tex: T`m_E = m_{\mathrm{malt}}\; e\; x_{\mathrm{conv}}\; \eta_L, \qquad V_{\mathrm{pre}} + V_{\mathrm{grain}} = V_{\mathrm{mash}} + V_{\mathrm{sparge}}`,
      sym: [["m_E", "extract reaching the kettle", "kg", "computed"], ["e", "extract potential of the malt", "kg/kg", "0.80 (assumed)"], ["x_conv", "share of starch converted in the mash, from (3)", "–", "0–1"], ["η_L", "extract recovered by lautering and sparging", "–", "0.93 (assumed)"]],
      go: ["mash", "Recipe & brew day"], refs: [12], live: () => { const B = S.B; return `Now: ${f0(S.inp.malt)} × 0.80 × ${f2(B.ms.conv)} × 0.93 = ${f0(B.extractKettle)} kg extract; water in ${f2(B.mashWater + B.spargeWater)} m³ = wort ${f2(B.Vpre)} + held by grain ${f2(B.grainAbsorb)} m³.`; } },
    { no: 2, name: "Degrees Plato and specific gravity", tex: T`\mathrm{SG} = 1 + \frac{P}{258.6 - 227.1\,P/258.2}, \qquad c_E = 10\,P\;\mathrm{SG}\;\rho_w`,
      sym: [["P", "extract, g per 100 g of wort", "°P", "8–18"], ["c_E", "extract concentration (with ρ_w in kg/L, in g/L)", "g/L", "computed"]], go: ["chart", "This batch"], refs: [11], live: () => `Now: ${f2(S.B.OG)} °P → SG ${S.B.SG.toFixed(4)}, ${f0(S.B.wort.extractGL)} g/L extract, of which ${f0(S.B.wort.fermGL)} g/L is fermentable.` },
  ] },
  { group: "Enzyme kinetics: mashing (reduced model, illustrative parameters)", items: [
    { no: 3, name: "Starch to dextrins to fermentable sugar", tex: T`\frac{dS}{dt} = -k_\alpha a\,(S - S_{\mathrm{ng}}), \qquad \frac{dD}{dt} = (1-\varphi-\lambda)\,k_\alpha a\,(S - S_{\mathrm{ng}}) - k_\beta\, b\, D, \qquad \frac{dF}{dt} = \varphi\,k_\alpha a\,(S - S_{\mathrm{ng}}) + k_\beta\, b\, D`,
      sym: [["S, D, F", "starch, convertible dextrins, fermentable sugar (shares of the malt starch)", "–", "solved"], ["a, b", "activity of α- and β-amylase", "–", "1 at mash-in"], ["φ, λ", "share cut straight to fermentable sugar; share left as limit dextrins", "–", "0.24, 0.20 (assumed)"], ["S_ng", "starch that does not gelatinize, 1/(1 + e^{(T−58)/1.2})", "–", "assumed"]],
      go: ["mash", "Mash chart"], refs: [8, 9], live: () => { const m = S.B.ms; return `Now, ${f1(S.inp.mashT)} °C for ${S.inp.mashMin} min: ${f0(m.conv * 100)} % converted, ${f0(m.ferm * 100)} % of the extract fermentable.`; } },
    { no: 4, name: "Thermal deactivation of the enzymes", tex: T`\frac{da}{dt} = -k_{d\alpha}\,a, \qquad \frac{db}{dt} = -k_{d\beta}\,b`,
      sym: [["k_dα, k_dβ", "deactivation rate constants at 65 °C", "1/min", "0.002, 0.022 (assumed)"]], go: ["mash", "Mash chart"], refs: [8, 9], live: () => { const m = S.B.ms; return `Now: half-lives ${f0(Math.LN2 / m.kda)} min (α-amylase) and ${f0(Math.LN2 / m.kdb)} min (β-amylase).`; } },
    { no: 5, name: "Temperature dependence of the mash rate constants", tex: T`k(T) = k_{65}\,\exp\!\left[-\frac{E}{R}\left(\frac{1}{T} - \frac{1}{338.15\,\mathrm{K}}\right)\right]`,
      sym: [["E", "activation energies for k_α, k_β, k_dα, k_dβ", "kJ/mol", "50, 40, 230, 260 (assumed)"], ["k_65", "k_α, k_β at 65 °C", "1/min", "0.16, 0.075 (assumed)"]], go: ["mash", "Recipe & brew day"], refs: [8] },
  ] },
  { group: "Transport: lautering, cooling, settling", items: [
    { no: 6, name: "Darcy flow through the grain bed", tex: T`Q = \frac{k\,A\,\Delta p}{\mu\,L}, \qquad L = \frac{v_b\,m_{\mathrm{malt}}}{A}, \qquad t_L = \frac{V_{\mathrm{pre}}}{Q}`,
      sym: [["k", "permeability of the grain bed", "m²", "1.4 × 10⁻¹¹ (assumed)"], ["A", "lauter tun area", "m²", "5.0"], ["Δp", "pressure difference across the bed", "Pa", "3000 (assumed)"], ["μ", "wort viscosity at 75 °C: water × e^{0.045 P}", "Pa·s", "assumed sugar factor"], ["v_b", "bed volume per kg of malt", "m³/kg", "1.9 × 10⁻³ (assumed)"]],
      go: ["lauter", "Lens: Transport"], refs: [16], live: () => { const B = S.B; return `Now: L = ${f2(B.bedDepth)} m, μ = ${f2(muWort(C.Tlauter, B.Ppre) * 1000)} mPa·s → Q = ${f1(B.Qlauter * 60000)} L/min, t = ${f0(B.lauterMin)} min.`; } },
    { no: 10, name: "Wort cooler: effectiveness–NTU, counterflow", tex: T`q = \varepsilon\, C_{\min}\,(T_{w,\mathrm{in}} - T_{c,\mathrm{in}}), \qquad \varepsilon = \frac{1 - e^{-\mathrm{NTU}(1 - C_r)}}{1 - C_r\, e^{-\mathrm{NTU}(1 - C_r)}}, \qquad \mathrm{NTU} = \frac{UA}{C_{\min}}`,
      sym: [["UA", "plate exchanger conductance", "W/K", "87 500 (assumed: 25 m² at 3500 W/m²K)"], ["C_min, C_r", "smaller heat-capacity rate and the ratio C_min/C_max", "W/K, –", "computed"], ["T_c,in", "cooling-water inlet", "°C", "5–25"]],
      go: ["cooler", "Plate cooler"], refs: [15], live: () => { const c = S.B.cool; return `Now: NTU = ${f1(c.NTU)}, C_r = ${f2(c.Cr)}, ε = ${c.eps.toFixed(3)} → q = ${f0(c.q / 1000)} kW; wort ${C.Twhirl1} → ${f1(c.TwortOut)} °C, water ${S.inp.cwT} → ${f1(c.TcwOut)} °C.`; } },
    { no: 20, name: "Stokes settling of yeast in the cold tank", tex: T`v = \frac{d^2\,\Delta\rho\,g}{18\,\mu}, \qquad t_{\mathrm{clear}} = \frac{H}{v}`,
      sym: [["d", "yeast floc diameter (single cell 6 μm)", "m", "30 × 10⁻⁶ (assumed)"], ["Δρ", "yeast minus beer density", "kg/m³", "90 (assumed)"], ["μ", "beer viscosity at 0 °C", "Pa·s", "2.9 × 10⁻³ (assumed)"], ["H", "liquid height", "m", "3.0"]],
      go: ["pack", "Kegs"], refs: [16], live: () => { const B = S.B; return `Now: flocs settle at ${f0(B.vFloc * 3.6e6)} mm/h and clear the tank in ${f1(B.clearDays)} days; single cells at ${f1(B.vCell * 3.6e6)} mm/h would need ${f0(C.hTank / B.vCell / 86400)} days.`; } },
  ] },
  { group: "Thermodynamics and energy", items: [
    { no: 7, name: "Kettle heat duty", tex: T`Q_K = m\,c_p\,(T_b - T_L) + m_{\mathrm{evap}}\,\Delta h_{\mathrm{vap}}`,
      sym: [["c_p", "wort specific heat", "J/kg·K", "4000 (assumed)"], ["T_b, T_L", "boiling and lautering temperatures", "°C", "100, 75"], ["Δh_vap", "latent heat of water at 100 °C", "J/kg", "2.257 × 10⁶"]], go: ["kettle", "Kettle"], refs: [15],
      live: () => { const B = S.B; return `Now: ${f0(B.Qheat / 3.6e6)} kWh sensible + ${f0(B.Qevap / 3.6e6)} kWh latent.`; } },
    { no: 8, name: "Evaporation in the boil", tex: T`V_{\mathrm{pre}} = \frac{V_{\mathrm{hot}}}{1 - \dot e\, t_b}, \qquad m_{\mathrm{evap}} = \rho_{100}\, V_{\mathrm{pre}}\,\dot e\, t_b`,
      sym: [["ė", "evaporation rate", "1/h", "0.06 (assumed)"], ["t_b", "boil time", "h", "0.5–2"]], go: ["kettle", "Kettle"], refs: [], live: () => `Now: ${f2(S.B.Vpre)} m³ into the kettle, ${f0(S.B.mEvap)} kg boiled off.` },
    { no: 21, name: "Refrigeration: coefficient of performance", tex: T`\mathrm{COP} = \eta_C\,\frac{T_{\mathrm{evap}}}{T_{\mathrm{cond}} - T_{\mathrm{evap}}}, \qquad W_{\mathrm{el}} = \frac{Q_{\mathrm{cool}}}{\mathrm{COP}}`,
      sym: [["η_C", "fraction of the Carnot COP achieved", "–", "0.5 (assumed)"], ["T_evap, T_cond", "evaporating and condensing temperatures", "K", "265.15, 308.15 (assumed)"]], go: ["sustain", "Water, energy & co-products"], refs: [], live: () => { const B = S.B; return `Now: COP = ${f2(B.COP)}; ${f0(B.coolJ / 3.6e6)} kWh of cooling → ${f0(B.elecJ / 3.6e6)} kWh of electricity.`; } },
  ] },
  { group: "Kinetics: hops", items: [
    { no: 9, name: "Isomerization and degradation of hop α-acids", tex: T`\frac{dA}{dt} = -k_1 A, \qquad \frac{dI}{dt} = k_1 A - k_2 I, \qquad k_1 = 7.9\times10^{11}\,e^{-11858/T}\ \mathrm{min^{-1}}, \qquad k_2 = 4.1\times10^{12}\,e^{-12994/T}\ \mathrm{min^{-1}}`,
      sym: [["A, I", "α-acids and iso-α-acids in the wort", "mg/L", "solved"], ["T", "wort temperature", "K", "373 in the boil, 371→365 in the whirlpool"], ["IBU", "0.6 × I at the cold wort volume", "mg/L", "0.6 kept (assumed)"]],
      go: ["kettle", "Kettle"], refs: [6], live: () => { const B = S.B; return `Now: ${f1(B.A0)} mg/L α-acids at the start, ${f1(B.isoWort)} mg/L iso-α-acids in the cold wort, ${f0(B.IBU)} IBU in the glass.`; } },
  ] },
  { group: "Biochemical engineering: fermentation (Gee–Ramirez)", items: [
    { no: 11, name: "Uptake of the three sugars", tex: T`r_G = \frac{k_G\,G}{K_G + G}\,X, \qquad r_M = \frac{k_M\,M}{K_M + M}\,\frac{K'_G}{K'_G + G}\,X, \qquad r_N = \frac{k_N\,N}{K_N + N}\,\frac{K'_G}{K'_G + G}\,\frac{K'_M}{K'_M + M}\,X`,
      sym: [["G, M, N", "glucose, maltose, maltotriose", "mol/m³", "solved"], ["X", "yeast", "mol/m³", "solved"], ["k_i", "maximum specific uptake rates", "1/s", "from (12)"], ["K_i, K'_i", "saturation and inhibition constants", "mol/m³", "from (12)"]],
      go: ["ferm", "Fermenter cutaway"], refs: [1, 3], live: () => { const s = cur(); if (s.part !== "cellar") return "Scrub to the fermentation."; const r = fermRates([s.G, s.M, s.N, s.X], s.T + 273.15); return `Now at ${f1(s.T)} °C: r_G = ${(r.m1 * s.X * 3600).toFixed(2)}, r_M = ${(r.m2 * s.X * 3600).toFixed(2)}, r_N = ${(r.m3 * s.X * 3600).toFixed(2)} mol/m³·h; K'_G = ${f0(r.IG)} mol/m³.`; } },
    { no: 12, name: "Arrhenius temperature dependence of every kinetic parameter", tex: T`k_i = A_i\,e^{-E_i/RT}, \qquad K_i = A_{K,i}\,e^{-E_{K,i}/RT}, \qquad K'_i = A'_{K,i}\,e^{-E'_{K,i}/RT}`,
      sym: [["A_i, E_i", "frequency factors and activation energies", "1/s or mol/m³; J/mol", "parameter table below"]], go: ["control", "Fermentation & cellar"], refs: [1, 3], live: () => { const a = fermRates([1, 1, 1, 1], 285.15), b = fermRates([1, 1, 1, 1], 293.15); return `From 12 to 20 °C: k_G × ${f1(b.kG / a.kG)}, k_M × ${f1(b.kM / a.kM)}, k_N × ${f1(b.kN / a.kN)}.`; } },
    { no: 13, name: "Yeast growth", tex: T`\frac{dX}{dt} = \left(Y_{XG}\,\mu_G + Y_{XM}\,\mu_M + Y_{XN}\,\mu_N\right)\frac{K_X}{K_X + (X - X_0)^2}\;X, \qquad \mu_i = r_i/X`,
      sym: [["Y_Xi", "yeast yield on each sugar", "mol/mol", "0.134, 0.268, 0.402"], ["K_X", "growth inhibition constant", "mol²/m⁶", "3.65 × 10⁵"], ["X_0", "yeast pitched", "mol/m³", "200 × pitch rate (assumed)"]], go: ["yeast", "Yeast"], refs: [1, 3],
      live: () => { const B = S.B; return `This batch: yeast grows from ${f0(B.fz.X0)} to ${f0(B.fz.y[3])} mol/m³ (${f0((B.fz.y[3] / B.fz.X0 - 1) * 100)} % more).`; } },
    { no: 14, name: "Ethanol and CO₂", tex: T`\frac{dE}{dt} = Y_{EG}\,r_G + Y_{EM}\,r_M + Y_{EN}\,r_N, \qquad n_{\mathrm{CO_2}} = n_E`,
      sym: [["Y_Ei", "ethanol yield on each sugar", "mol/mol", "1.92, 3.84, 5.76"], ["n_CO₂", "CO₂ formed, one per ethanol (stoichiometry)", "mol/m³", "assumed 1:1"]], go: ["chart", "Fermentation chart"], refs: [1, 3],
      live: () => { const B = S.B; return `This batch: ${f0(B.sugarUsedKg)} kg sugar → ${f0(B.ethKg)} kg ethanol + ${f0(B.co2Kg)} kg CO₂; ${f1(B.carbonClosure * 100)} % of the sugar carbon.`; } },
    { no: 15, name: "Energy balance on the fermenter", tex: T`\begin{aligned}\rho c_p \frac{dT}{dt} ={}& \Delta H_G\, r_G + \Delta H_M\, r_M + \Delta H_N\, r_N \\[5pt] & -\, u\,(UA)_j\,(T - T_{\mathrm{gly}}) + (UA)_\ell\,(T_{\mathrm{cellar}} - T)\end{aligned}`,
      sym: [["ΔH_i", "heat released per mole of sugar", "kJ/mol", "91.2, 226.3, 361.3"], ["(UA)_j", "jacket conductance per m³ of beer", "W/m³·K", "480 (assumed)"], ["(UA)_ℓ", "heat gain from the cellar per m³", "W/m³·K", "1.6 (assumed)"], ["T_gly, T_cellar", "glycol and cellar temperatures", "°C", "−4, 15 (assumed)"]],
      go: ["control", "Fermentation & cellar"], refs: [1, 3], live: () => { const s = cur(); return s.part === "cellar" ? `Now: heat made ${f0(s.q)} W/m³, jacket ${f0(s.qc)} W/m³, T = ${f2(s.T)} °C.` : "Scrub to the fermentation."; } },
    { no: 17, name: "Diacetyl (vicinal diketones): made with growth, reduced by yeast", tex: T`\frac{dV}{dt} = Y_V\,\mu_X\,X - r_V(T)\,V\,X, \qquad r_V = r_{V,12}\,\exp\!\left[-\frac{E_V}{R}\left(\frac{1}{T} - \frac{1}{285.15}\right)\right]`,
      sym: [["V", "diacetyl", "mg/L", "solved"], ["Y_V", "diacetyl formed per yeast grown", "mg/L per mol/m³", "0.05 (illustrative)"], ["r_V,12, E_V", "reduction rate at 12 °C and activation energy", "m³/mol·s, kJ/mol", "4.6 × 10⁻⁸, 70 (illustrative)"], ["threshold", "taste threshold in lager", "mg/L", "0.1–0.2"]],
      go: ["chart", "This batch"], refs: [2, 4, 7], live: () => { const B = S.B, s = cur(); return `This batch: peak ${f2(B.fz.peakV)} mg/L${s.part === "cellar" ? `, now ${f2(s.V)} mg/L` : ""}; ready (below ${C.vdkLimit} mg/L with 3 % sugar left) on ${B.readyDays === null ? "no day within 40" : "day " + f1(B.readyDays)}.`; } },
  ] },
  { group: "Control", items: [
    { no: 16, name: "PI temperature controller on the glycol valve", tex: T`u = \mathrm{sat}_{[0,1]}\!\left[K_c\,(T - T_{\mathrm{sp}}) + \frac{K_c}{\tau_I}\int_0^t (T - T_{\mathrm{sp}})\,dt'\right]`,
      sym: [["u", "glycol valve opening", "–", "0–1"], ["K_c, τ_I", "controller gain and integral time", "1/K, h", "2.0, 2.0 (assumed tuning; adjustable)"], ["T_sp", "set point: fermentation, then + rest, then 0 °C", "°C", "from the recipe"]],
      go: ["control", "Fermentation & cellar"], refs: [], live: () => { const s = cur(); return s.part === "cellar" ? `Now: error ${f2(s.T - s.Tsp)} K → valve ${f0(s.u * 100)} %. The integral stops accumulating while the valve is saturated (anti-windup).` : "Scrub to the fermentation."; } },
  ] },
  { group: "Mixtures: carbonation and beer analysis", items: [
    { no: 18, name: "Henry's law for CO₂", tex: T`c = H(T)\,p, \qquad H(T) = H_{298}\,\exp\!\left[2400\left(\frac{1}{T} - \frac{1}{298.15}\right)\right], \qquad \mathrm{volumes} = 0.022414\,c`,
      sym: [["H_298", "Henry solubility of CO₂ in water at 25 °C", "mol/m³·Pa", "3.3 × 10⁻⁴"], ["p", "absolute CO₂ pressure", "Pa", "computed"], ["volumes", "litres of CO₂ (0 °C, 1 atm) per litre of beer", "–", "2.0–3.0"]],
      go: ["carb", "Fermentation & cellar"], refs: [10], live: () => { const B = S.B; return `Now: H(${B.Tbright} °C) = ${henry(B.Tbright).toExponential(2)} mol/m³·Pa → ${f2(B.pBright / 1e5)} bar absolute (${f2(B.pBright / 1e5 - 1.013)} bar gauge) for ${f1(S.inp.vols)} volumes.`; } },
    { no: 19, name: "Real and apparent extract, alcohol by volume", tex: T`\mathrm{RE} = 0.1808\,\mathrm{OE} + 0.8192\,\mathrm{AE}, \qquad \mathrm{ABV} = \frac{c_{\mathrm{EtOH}}}{7.893}`,
      sym: [["OE, RE, AE", "original, real and apparent extract", "°P", "computed"], ["7.893", "ethanol density at 20 °C ÷ 100", "g/L per %", "789.3 g/L ÷ 100"]], go: ["chart", "This batch"], refs: [11], live: () => { const B = S.B; return `This batch: OE ${f1(B.OG)}, RE ${f1(B.RE)}, AE ${f1(B.AE)} °P; ${f2(B.ABV)} % ABV; apparent attenuation ${f0(B.ADF)} %.`; } },
  ] },
  { group: "Design and sustainability", items: [
    { no: 22, name: "Water and energy intensity", tex: T`w = \frac{V_{\mathrm{mash}} + V_{\mathrm{sparge}} + c_w V_{\mathrm{pack}}}{V_{\mathrm{pack}}}, \qquad e_{\mathrm{th}} = \frac{Q_{\mathrm{water}} - Q_{\mathrm{rec}} + Q_K}{\eta_b\,V_{\mathrm{pack}}}, \qquad Q_{\mathrm{rec}} = \min(0.9\,Q_{\mathrm{cooler}},\,Q_{\mathrm{water}})`,
      sym: [["c_w", "cleaning and utility water per volume of beer", "–", "2.5 (assumed)"], ["η_b", "boiler efficiency", "–", "0.80 (assumed)"], ["V_pack", "beer packaged, 94 % of the cold wort", "m³", "6 % loss (assumed)"]], go: ["sustain", "Water, energy & co-products"], refs: [13, 14],
      live: () => { const B = S.B; return `Now: ${f2(B.waterRatio)} L/L; ${f1(B.thermalKWhHl)} kWh/hL of heat (${f1(B.thermalNoRec / 3.6e6 / B.hl)} without heat recovery); ${f1(B.gasCO2KgHl)} kg CO₂/hL from natural gas.`; } },
  ] },
];
const PARAMS = [
  ["A_G, A_M, A_N", "frequency factors of the maximum uptake rates", "9.51 × 10¹¹, 3.68 × 10³, 11.0", "1/s", ref(3)],
  ["E_G, E_M, E_N", "activation energies of the uptake rates", "94.6, 47.3, 30.0", "kJ/mol", ref(3)],
  ["A_K", "frequency factors of K_G, K_M, K_N", "2.09 × 10⁻⁵³, 3.40 × 10⁻⁹, 2.34 × 10⁻¹²", "mol/m³", ref(3)],
  ["E_K", "activation energies of K_G, K_M, K_N", "−287, −60.3, −83.3", "kJ/mol", ref(3)],
  ["A'_K, E'_K", "inhibition constants K'_G and K'_M", "1.36 × 10¹⁰, 1.42 × 10²⁴; 42.7, 110", "mol/m³; kJ/mol", ref(3)],
  ["Y_X, Y_E, K_X", "yields and growth inhibition constant", "see (13), (14)", "", ref(3)],
  ["ΔH", "heats of reaction for glucose, maltose, maltotriose", "91.2, 226.3, 361.3", "kJ/mol", ref(3)],
  ["X_0", "yeast pitched at 1× pitch rate", "200", "mol/m³", "assumed; sets the time scale of the fermentation"],
  ["sugar split", "glucose : maltose : maltotriose in the fermentable sugar, by mass", "15 : 65 : 20", "%", "assumed typical wort"],
  ["non-carbohydrate", "share of the extract that never ferments (protein, minerals)", "8", "%", "assumed"],
  ["k_1, k_2", "hop isomerization and degradation", "7.9 × 10¹¹ e^(−11858/T), 4.1 × 10¹² e^(−12994/T)", "1/min", ref(6)],
  ["mash constants", "k_α, k_β, k_dα, k_dβ, E, φ, λ, gelatinization", "see (3)–(5)", "", `illustrative, chosen so that β-amylase is the more heat-labile enzyme and fermentability falls above about 66 °C${ref(8, 9)}`],
  ["Y_V, r_V, E_V", "diacetyl constants", "see (17)", "", `illustrative: structure from the Gee–Ramirez flavour model${ref(2, 4)}; values chosen for a peak near 0.6 mg/L that clears in days`],
  ["diacetyl threshold", "taste threshold in lager", "0.1 (range 0.1–0.2)", "mg/L", ref(7)],
  ["H_298, d ln H/d(1/T)", "Henry solubility of CO₂ in water", "3.3 × 10⁻⁴, 2400", "mol/m³·Pa, K", `${ref(10)}; beer is treated as water`],
  ["e, η_L", "malt extract potential and lauter recovery", "0.80, 0.93", "–", "assumed typical values"],
  ["liquor ratio", "mash water per kg of malt; water held by spent grain", "3.0, 1.0", "L/kg", "assumed"],
  ["c_p", "specific heats of water, wort and malt", "4180, 4000, 1700", "J/kg·K", "water: standard; wort and malt assumed"],
  ["UA values", "wort cooler, tank jacket, tank heat gain", "87 500 W/K; 480, 1.6 W/m³·K", "", "assumed equipment sizes"],
  ["K_c, τ_I", "PI controller tuning", "2.0, 2.0", "1/K, h", "assumed; adjustable"],
  ["losses", "beer lost to yeast, trub and filtration; iso-α-acids lost", "6 %; 40 %", "", "assumed"],
  ["utilities", "boiler efficiency, Carnot fraction, cleaning water", "0.80, 0.5, 2.5 hL/hL", "", "assumed"],
  ["emission factor", "CO₂ from natural-gas heat", "0.181", "kg/kWh", ref(14)],
  ["brew length", "cold wort per brew; one brew fills one fermenter", "5.0", "m³", "chosen size"],
];
function renderModel() {
  const V = VALID, py = V.python;
  $("mdl-body").innerHTML = `
    <h3>1. What is modeled</h3>
    <p>One 50 hL brew, followed as a batch from mash-in to the keg. The states are the starch, dextrins, fermentable sugar and enzyme activities in the mash; the hop α- and iso-α-acids in the kettle; and, in the fermenter, glucose, maltose, maltotriose, yeast, ethanol, diacetyl and temperature. A visitor can change the malt bill, mash temperature, hops, boil time, fermentation temperature, yeast pitch rate, diacetyl rest, cold-conditioning time, carbonation level, cooling-water temperature and the cooling controller. Outputs are the wort gravity, bitterness, the sugar, alcohol and temperature curves, the day the beer is ready, and the water, energy and co-products per hectolitre. The fermentation follows the published model of Gee and Ramirez${ref(1, 2)} for a lager yeast, with the parameter values tabulated in ${ref(3)}.</p>
    <h3>2. Governing equations</h3>
    ${EQ.map((G, gi) => { const nos = G.items.map(e => e.no), run = nos.every((n, k) => k === 0 || n === nos[k - 1] + 1);
      return `<h4 class="mdl-grp">${G.group} <small>${nos.length === 1 ? `Eq. (${nos[0]})` : run ? `Eqs. (${nos[0]})–(${nos[nos.length - 1]})` : `Eqs. ${nos.map(n => `(${n})`).join(", ")}`}</small><span class="mdl-courses">${GROUP_COURSES[gi].map(courseLink).join("")}</span></h4>${G.items.map(e => {
        const rows = [...e.sym, ...(MORE[e.no] || []).filter(r => !e.sym.some(q => q[0] === r[0]))], txt = rows.map(r => r[3]).join(" ") + G.group;
        const tag = [/assumed/.test(txt) ? "Assumed" : "", /illustrative/.test(txt) ? "Illustrative" : ""].filter(Boolean);
        return `<div class="mdl-eq" id="eq-${e.no}">
        <div class="mdl-h"><span class="mdl-n">(${e.no})</span><span class="mdl-name">${e.name}${e.refs.length ? ref(...e.refs) : ""}</span><button class="btn mdl-go" type="button" data-go="${e.go[0]}" title="${e.go[1]}">Show in the twin ▸</button></div>
        <div class="mdl-tex">${texHTML(dispTex(e.tex), true)}</div>
        ${tag.length ? `<p class="mdl-assumed">${tag.map(x => `<span class="mdl-src">${x}</span>`).join("")}Values marked ${tag.join(" or ").toLowerCase()} in the table are typical figures chosen for this twin, not measurements.</p>` : ""}
        <div class="mdl-scroll"><table class="mdl-tab"><thead><tr><th>Symbol</th><th>Meaning</th><th>Units</th><th>Value or range</th></tr></thead><tbody>${rows.map(r => `<tr><td>${r[0] === "threshold" ? "threshold" : symHTML(r[0])}</td><td>${inlineMath(r[1])}</td><td>${r[2]}</td><td>${inlineMath(r[3])}</td></tr>`).join("")}</tbody></table></div>
        ${e.live ? `<p class="mdl-live" data-live="${e.no}"></p>` : ""}
      </div>`; }).join("")}`; }).join("")}
    <h3>3. Parameters and data</h3>
    <div class="mdl-scroll"><table class="mdl-tab"><thead><tr><th>Symbol</th><th>Meaning</th><th>Value</th><th>Units</th><th>Source</th></tr></thead><tbody>
      ${PARAMS.map(p => `<tr><td>${paramSym(p[0])}</td><td>${inlineMath(p[1])}</td><td>${inlineMath(p[2])}</td><td>${p[3]}</td><td>${p[4]}</td></tr>`).join("")}</tbody></table></div>
    <h3 id="m-num">4. Numerical method</h3>
    <ul class="mdl-list">
      <li>The whole batch is recomputed whenever an input changes, then played back. It takes a few milliseconds.</li>
      <li>Mash (3)–(4): explicit Euler with a 0.1-minute step. Hops (9): explicit Euler with a 0.1-minute step through the boil and a whirlpool that cools linearly from 98 to 92 °C; at 60 minutes it is within ${(V.hops.relDiff * 100).toFixed(2)} % of the analytic solution.</li>
      <li>Fermenter (11)–(17): ten coupled ordinary differential equations (three sugars, yeast, ethanol, temperature, diacetyl, the controller integral and two energy totals) integrated with classical fourth-order Runge–Kutta at a fixed step of 120 s for up to 40 days. Quartering the step to 30 s changes the final alcohol by ${Math.abs(V.timestep.ABV_120s - V.timestep.ABV_30s).toExponential(0)} % ABV.</li>
      <li>Phase logic: the diacetyl rest starts when 25 % of the fermentable sugar is left; the beer is called ready when 3 % is left and diacetyl is below 0.1 mg/L; the set point then drops to 0 °C and the yeast is taken to be inactive.</li>
      <li>Algebraic steps (1), (2), (6)–(8), (10), (18)–(22) are evaluated directly; the Plato–gravity relation is inverted by fixed-point iteration.</li>
    </ul>
    <h3>5. Assumptions and limits</h3>
    <ul class="mdl-list">
      <li>The fermentation parameters were fitted to isothermal lager fermentations${ref(1)}. Using them for an ale at 18–22 °C is an extrapolation; the pale-ale preset shows the trend, not a calibrated ale yeast.</li>
      <li>The mash is a reduced two-enzyme model with illustrative constants; it reproduces the direction and rough size of the effect of mash temperature, not a particular malt. Proteins, pH and mash thickness are left out.</li>
      <li>The yeast pitch (X₀), the sugar split of the wort and the diacetyl constants are assumed. Times to finish therefore show trends, and should not be read as predictions for a real yeast strain.</li>
      <li>The fermenter is perfectly mixed, with no gradients or CO₂ supersaturation. Amino acids, esters, fusel alcohols and acetaldehyde are not modeled.</li>
      <li>CO₂ is formed one-for-one with ethanol; its solubility in beer is taken as that in water; pressure in the fermenter is atmospheric.</li>
      <li>Bitterness is taken as 60 % of the iso-α-acids in the wort; hop-acid solubility limits and late hop additions are left out.</li>
      <li>Water and energy cover brewing, wort cooling and tank cooling only. Cleaning steam, packaging, lighting and building losses are left out, which is why the totals are well below measured breweries${ref(13)}.</li>
      <li>This is an educational model of a generic brewery, not a tool for commercial recipe or safety decisions.</li>
    </ul>
    <h3 id="m-val">6. Validation</h3>
    <p class="takeaway"><b>What this means</b>In short: the twin conserves mass, carbon and energy to within rounding; its fermentation code matches an independent Python solution to ten digits; and its alcohol yield is 96 % of the theoretical maximum. What it cannot claim is agreement with a specific brewery: several inputs are assumed, and against one set of pilot-scale ale data its alcohol yield is about 25 % higher.</p>
    <div class="sym-wrap"><table class="sym"><thead><tr><th>Check</th><th>Twin</th><th>Reference</th><th>Difference</th></tr></thead><tbody>
      <tr><td>Carbon balance on the fermenter: carbon in ethanol + CO₂ against carbon in the sugar used</td><td>${V.carbon.cOut_molC_m3} mol C/m³</td><td>${V.carbon.cIn_molC_m3} mol C/m³</td><td>${(V.carbon.closure * 100).toFixed(1)} %; the other ${(100 - V.carbon.closure * 100).toFixed(1)} % is new yeast and by-products</td></tr>
      <tr><td>Mass balance (lager): sugar ${V.massBalance.sugarUsed_kg} kg + hydrolysis water ${V.massBalance.hydrolysisWater_kg} kg</td><td>ethanol ${V.massBalance.ethanol_kg} + CO₂ ${V.massBalance.co2_kg} kg</td><td>${(V.massBalance.sugarUsed_kg + V.massBalance.hydrolysisWater_kg).toFixed(1)} kg</td><td>${V.massBalance.other_kg} kg (${V.massBalance.other_pct} %) to yeast and by-products</td></tr>
      <tr><td>Ethanol yield against the stoichiometric maximum (Gay-Lussac), glucose / maltose / maltotriose</td><td>${V.yield.model_g_g.G} / ${V.yield.model_g_g.M} / ${V.yield.model_g_g.N} g/g</td><td>${V.yield.theoretical_g_g.G} / ${V.yield.theoretical_g_g.M} / ${V.yield.theoretical_g_g.N} g/g</td><td>${(V.yield.ratio * 100).toFixed(0)} % of the maximum</td></tr>
      <tr><td>Ethanol yield against pilot-scale ale fermentations${ref(4)}</td><td>${V.yield.batch_g_g.toFixed(2)} g/g</td><td>${V.yield.pilotAle_g_g} g/g (fitted ${texHTML("k_E/k_S")})</td><td>twin is ${f0((V.yield.batch_g_g / V.yield.pilotAle_g_g - 1) * 100)} % higher</td></tr>
      <tr><td>Energy balance on the fermenter: heat made + cellar gain − jacket = sensible change</td><td>${V.energy.generated_MJ_m3} + ${V.energy.cellarGain_MJ_m3} − ${V.energy.jacket_MJ_m3} MJ/m³</td><td>${V.energy.sensible_MJ_m3} MJ/m³</td><td>residual ${V.energy.residual_pct} % of the jacket duty</td></tr>
      <tr><td>Fermentation kinetics: JavaScript (RK4, 60 s) against Python SciPy LSODA, isothermal 12 °C, 7 days</td><td>ethanol ${V.isothermal.h168.E.toFixed(4)} mol/m³</td><td>${py ? py.E168_py.toFixed(4) : "–"} mol/m³</td><td>worst relative difference ${py ? py.worstRelDiff.toExponential(1) : "–"}</td></tr>
      <tr><td>Time step: 120 s against 30 s (lager)</td><td>${V.timestep.ABV_120s} % ABV; ready at ${V.timestep.ready_120s_h} h</td><td>${V.timestep.ABV_30s} % ABV; ${V.timestep.ready_30s_h} h</td><td>below 0.01 %</td></tr>
      <tr><td>Hop iso-α-acids after 60 min at 100 °C: numerical against analytic</td><td>${V.hops.iso60_numeric} mg/L</td><td>${V.hops.iso60_analytic} mg/L</td><td>${(V.hops.relDiff * 100).toFixed(2)} %; α-acid half-life ${V.hops.halfLife_min} min</td></tr>
      <tr><td>Wort cooler: heat lost by wort against heat gained by water</td><td>${V.cooler.wortSide_kW} kW</td><td>${V.cooler.waterSide_kW} kW</td><td>0</td></tr>
      <tr><td>Brewhouse: extract and water balances</td><td>${V.brewhouse.toKettle_kg} + ${V.brewhouse.unconverted_kg} + ${V.brewhouse.leftInGrain_kg} kg; ${V.brewhouse.waterOut_m3} m³</td><td>${V.brewhouse.extractPotential_kg} kg; ${V.brewhouse.waterIn_m3} m³</td><td>0</td></tr>
      <tr><td>Water and energy against a measured microbrewery${ref(13)}</td><td>${V.sustain.water_L_L} L/L; ${V.sustain.thermal_MJ_L} MJ/L heat; ${V.sustain.electric_MJ_L} MJ/L electricity</td><td>12.8 L/L; 4.2 MJ/L; 1.6 MJ/L</td><td>twin is far lower: see limits</td></tr>
    </tbody></table></div>
    <p class="note">Carbonation check: (18) gives ${V.carbonation.gauge_kPa_2p5vol_2C} kPa gauge (${V.carbonation.gauge_psi} psi) for 2.5 volumes at 2 °C. Scripts: <code>validate.mjs</code>, <code>validate_py.py</code> and <code>problems_check.mjs</code> in the twin's folder.</p>
    <h3>References</h3>
    <ol class="refs">${REFS.map((r, i) => `<li id="mref-${i + 1}">${r}</li>`).join("")}</ol>`;
  mathDOM($("mdl-body")); refreshModelLive();
}
function refreshModelLive() { document.querySelectorAll("#mdl-body [data-live]").forEach(el => { const e = EQ.flatMap(g => g.items).find(x => x.no === +el.dataset.live), v = e.live(); if (el.__v !== v) { el.__v = v; el.innerHTML = mathHTML(v); } }); }
function toggleModel(on, anchorId) {
  mdlOpen = on; $("mdl-panel").hidden = !on;
  if (on) { renderModel(); if (anchorId) requestAnimationFrame(() => $(anchorId)?.scrollIntoView({ block: "start" })); else $("mdl-close").focus(); }
}
$("open-model").onclick = () => toggleModel(true); $("mdl-close").onclick = () => toggleModel(false);
$("mdl-panel").addEventListener("click", e => { if (e.target.id === "mdl-panel") toggleModel(false); const g = e.target.closest("[data-go]"); if (g && GO[g.dataset.go]) { toggleModel(false); GO[g.dataset.go](); } });

// ---------------- controls ----------------
const FIELDS = { malt: v => `${v} kg`, mashT: v => `${(+v).toFixed(1)} °C`, hops: v => `${v} g per hL · ${S.inp.alpha} % α-acids`, boilMin: v => `${v} min`, fermT: v => `${(+v).toFixed(1)} °C`, pitch: v => `${v}× normal`,
  rest: v => +v === 0 ? "none" : `+${v} °C`, coldDays: v => `${v} days at 0 °C`, vols: v => `${(+v).toFixed(1)} volumes of CO₂`, cwT: v => `${v} °C` };
function syncControls() {
  for (const id in FIELDS) { $(id).value = S.inp[id]; $(id + "-out").textContent = FIELDS[id](S.inp[id]); }
  $("Kc").value = S.inp.Kc; $("tauI").value = S.inp.tauI;
  document.querySelectorAll("#ctl-seg button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.m === S.inp.control)));
  document.querySelectorAll("#styles button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.s === S.inp.style)));
}
for (const id in FIELDS) $(id).oninput = e => { S.inp[id] = +e.target.value; S.inp.style = "custom"; syncControls(); recompute(true); };
$("styles").innerHTML = Object.entries(STYLES).map(([k, s]) => `<button class="btn" type="button" data-s="${k}" aria-pressed="false">${s.name}</button>`).join("");
$("styles").onclick = e => { const b = e.target.closest("button"); if (!b) return; S.inp = { ...S.inp, ...STYLES[b.dataset.s], style: b.dataset.s }; syncControls(); recompute(true); };
document.querySelectorAll("#ctl-seg button").forEach(b => b.onclick = () => { S.inp.control = b.dataset.m; syncControls(); recompute(true); });
for (const id of ["Kc", "tauI"]) $(id).onchange = e => { const v = parseFloat(e.target.value); if (Number.isFinite(v) && v > 0) { S.inp[id] = v; recompute(true); } else e.target.value = S.inp[id]; };
$("scrub").oninput = e => { S.i = +e.target.value; refreshAll(); };
// Default playback (Part S): one real second is 6 minutes of the brew day (1-minute samples) or 5 hours in the cellar (30-minute samples),
// so the brew day plays in about 48 s and the cellar in about 96 s: one batch in roughly two and a half minutes at 1×.
var BREW_RATE = 6, CELLAR_RATE = 10;
function rateNote() { if (!S.B) return; const r = +$("rate").value, brew = S.i < S.B.timeline.nBrew, v = brew ? BREW_RATE * r : CELLAR_RATE * r / 2; put("rate-note", `1 s = ${+v.toFixed(1)} ${brew ? "min" : "h"}`); }
$("rate").onchange = rateNote;
let playing = !matchMedia("(prefers-reduced-motion: reduce)").matches;
const setPlaying = v => { playing = v; $("play").textContent = v ? "Pause" : "Play"; }; setPlaying(playing);
$("play").onclick = () => setPlaying(!playing);
$("reset").onclick = () => { S.i = 0; setPlaying(true); goTo("brewhouse"); refreshAll(); };

// ---------------- problem-set setups (#ps-<course>-<k>) ----------------
function applySetup() {
  const m = location.hash.match(/^#ps[-=]((?:\d+|int))-(\d+)/); if (!m) return false;
  const id = `${m[1]}-${m[2]}`, P = PS_SETUPS[id]; if (!P) return false;
  S.inp = { ...DEFAULTS, ...P.inp }; syncControls(); recompute(false); S.i = psIndex(S.B, P.at); setPlaying(false);
  if (P.cut !== undefined) setCut(P.cut); if (P.panel) setFold($(P.panel), true); if (P.view) goTo(P.view, true);
  const pb = $("ps-bar"); pb.hidden = false; pb.innerHTML = `<b>Problem ${m[1] === "int" ? "Integrative" : "CBE " + m[1]}.${m[2]} loaded:</b> ${STYLES[P.inp.style]?.name || "custom recipe"}, paused at ${clockText(cur()).toLowerCase()}. <a href="../problems/#brewery-${m[1] === "int" ? "Integrative" : m[1]}" target="_blank" rel="noopener">Problem text ↗</a>`;
  try { localStorage.setItem("brewery-intro-seen", "1"); } catch (e) {}
  refreshAll(); return true;
}

// ---------------- Links to Research (Part N): cards come only from research_data.js ----------------
let resOpen = false;
function toggleResearch(on, id) {
  resOpen = on; $("res-panel").hidden = !on; if (!on) return;
  $("res-body").innerHTML = `<p>Research in UW–Madison Chemical &amp; Biological Engineering that connects to this digital twin.</p>
    <div class="res-grid">${RESEARCH.map(r => `<article class="crs-card res-card" id="res-${r.id}">
      <h4><a href="${r.url}" target="_blank" rel="noopener">${r.name} ↗</a></h4>
      <p class="res-where"><b>Connects to:</b> ${r.where}</p>
      <div class="res-areas">${r.areas.slice(0, 3).map(a => `<span>${a}</span>`).join("")}</div>
      <div class="res-go"><button class="btn mdl-go" type="button" data-go="${r.go}" title="Close the panel and show where this connects in the twin">Show in the twin ▸</button></div>
    </article>`).join("")}</div>
    ${CENTERS.length ? `<h3>UW–Madison centers and programs</h3><div class="res-grid res-centers">${CENTERS.map(c => `<article class="crs-card res-card" id="cen-${c.id}">
      <h4><a href="${c.url}" target="_blank" rel="noopener">${c.name} ↗</a></h4>
      <p class="res-where"><b>Connects to:</b> ${c.where}</p>
    </article>`).join("")}</div>` : ""}`;
  const c = id && $("res-" + id); if (c) { c.scrollIntoView({ block: "center" }); c.classList.add("hi"); } else $("res-close").focus();
}
$("hdr-research").hidden = RESEARCH.length === 0;   // the button appears once verified cards exist
$("hdr-research").onclick = () => toggleResearch(true); $("res-close").onclick = () => toggleResearch(false);
$("res-panel").addEventListener("click", e => { if (e.target.id === "res-panel") return toggleResearch(false); const g = e.target.closest("[data-go]"); if (g && GO[g.dataset.go]) { toggleResearch(false); GO[g.dataset.go](); } });

// ---------------- trend strip (Part R): in the footer on desktop, in the page flow right below the stage on phones ----------------
{ const strip = $("trend-strip"), mq = matchMedia("(max-width: 860px)"), foot = document.querySelector("footer");
  const place = () => { if (mq.matches) stage.after(strip); else foot.prepend(strip); requestAnimationFrame(() => { drawStatic(); drawCursors(); }); };
  mq.addEventListener("change", place); if (mq.matches) stage.after(strip); }

// symbols in fixed page text marked with data-tex are typeset like the equations
document.querySelectorAll("[data-tex]").forEach(e => { e.innerHTML = texHTML(e.dataset.tex); });

// ---------------- user guide, pop-out side panel ----------------
const guideSeen = () => { $("open-guide").classList.add("seen"); try { localStorage.setItem("twin-guide-seen", "1"); } catch (e) {} };
try { if (localStorage.getItem("twin-guide-seen") === "1") $("open-guide").classList.add("seen"); } catch (e) {}
$("open-guide").onclick = () => { guideSeen(); $("gd-panel").hidden = false; $("gd-close").focus(); };
$("gd-close").onclick = () => { $("gd-panel").hidden = true; };
$("gd-panel").addEventListener("click", e => { if (e.target.id === "gd-panel") $("gd-panel").hidden = true; });
const asideEl = document.querySelector("aside"), mainEl = document.querySelector("main"), popBtn = $("pop-btn");
function setPop(on, save = true) {
  if (matchMedia("(max-width: 860px)").matches) on = false;
  asideEl.classList.toggle("popped", on); mainEl.classList.toggle("pop", on);
  popBtn.textContent = on ? "⤡" : "⤢"; popBtn.title = on ? "Dock this panel back at the right" : "Pop this panel out as a floating window"; popBtn.setAttribute("aria-label", popBtn.title);
  if (on) { const W = Math.min(620, innerWidth - 16); asideEl.style.width = W + "px"; asideEl.style.height = Math.round(innerHeight * 0.8) + "px"; asideEl.style.left = (innerWidth - W - 24) + "px"; asideEl.style.top = Math.round(innerHeight * 0.1) + "px"; }
  else asideEl.style.cssText = "";
  if (save) try { localStorage.setItem("brewery-panel-pop", on ? "1" : "0"); } catch (e) {}
  requestAnimationFrame(() => resize());
}
popBtn.onclick = () => setPop(!asideEl.classList.contains("popped"));
$("aside-bar").addEventListener("pointerdown", e => {
  if (!asideEl.classList.contains("popped") || e.target.closest("button")) return; const r = asideEl.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top;
  const mv = ev => { asideEl.style.left = Math.max(0, Math.min(innerWidth - 80, ev.clientX - ox)) + "px"; asideEl.style.top = Math.max(0, Math.min(innerHeight - 40, ev.clientY - oy)) + "px"; };
  const up = () => { removeEventListener("pointermove", mv); removeEventListener("pointerup", up); }; addEventListener("pointermove", mv); addEventListener("pointerup", up); e.preventDefault();
});

// ---------------- loop ----------------
function resize() { const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); POST.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); drawStatic(); refreshAll(); }
syncControls(); recompute(false); setCut(true); goTo("overview", true);
new ResizeObserver(resize).observe(stage);
new ResizeObserver(() => { drawStatic(); drawCursors(); }).observe(document.querySelector("aside"));
const hadSetup = applySetup(); window.addEventListener("hashchange", applySetup);
{ const qv = new URLSearchParams(location.search).get("view"); if (qv && VIEWS[qv]) goTo(qv, true); }   // ?view=kettle opens on that camera (used for checks and links)
try { if (localStorage.getItem("brewery-panel-pop") === "1") setPop(true, false); } catch (e) {}
{ let seen = false; try { seen = localStorage.getItem("brewery-intro-seen") === "1"; } catch (e) {} if (!seen && !hadSetup && !matchMedia("(max-width: 860px)").matches) openIntro(); }   // phones open on the overview itself

let last = performance.now();
renderer.setAnimationLoop(now => {
  const dt = Math.min((now - last) / 1000, 0.1); last = now;
  if (playing) {
    const before = Math.floor(S.i), TL = S.B.timeline; S.i += dt * +$("rate").value * (S.i < TL.nBrew ? BREW_RATE : CELLAR_RATE);
    if (S.i >= TL.n - 1) S.i = 0;
    if (Math.floor(S.i) !== before) refreshAll();
  }
  if (tween) { const u = Math.min((now - tween.t0) / tween.dur, 1), e = u * u * (3 - 2 * u);
    camera.position.lerpVectors(tween.from.p, tween.to.p, e); controls.target.lerpVectors(tween.from.c, tween.to.c, e); camera.fov = tween.from.fov + (tween.to.fov - tween.from.fov) * e; camera.updateProjectionMatrix(); if (u >= 1) tween = null; }
  BR.update(visual(), dt, now / 1000);
  if (beacon.visible) { beacon.quaternion.copy(camera.quaternion); const k = 1 + 0.15 * Math.sin(now / 220); beacon.children[0].scale.setScalar(k); }
  controls.update(); fitShadow(); POST.render(dt); placeSpots();
});
window.__twin = { S, recompute, refreshAll, goTo, openLens, closeLens, toggleCourses, toggleModel, setCut, camera, controls, renderer, scene, BR, LENSES, PS_SETUPS, applySetup, setPlaying, POST, setPop, placeSpots, toggleResearch, RESEARCH };
