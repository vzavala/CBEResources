// Summer Lab Distillation Digital Twin: UI, live stepping of the column model, charts, lenses, course map and the render loop.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { makePost } from "./post.js";
import { buildColumnScene, rampCSS } from "./scene.js";
import { newColumn, restore, summary, th, LAB_RUNS, BASE_RUN, DT, DISTURB } from "./sim.js";
import { INIT } from "./init_state.js";
import { REFS, ref, COURSE, FEATURES, COURSES, PS_LINK, LENSES, SPOTS, NAMES } from "./content.js";
import { CATALOG } from "./courses_data.js";
import { PS_SETUPS, buildSetup } from "./ps.js";
import { RESEARCH, CENTERS } from "./research_data.js";
import { makeModelPanel } from "./model_panel.js";
import { makePFD } from "./pfd.js";

const $ = id => document.getElementById(id);
const f0 = x => Math.round(x).toLocaleString("en-US"), f1 = x => x.toFixed(1), f2 = x => x.toFixed(2), C = k => k - 273.15;
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const put = (id, v, html) => { const el = $(id); if (!el || el.__v === v) return; el.__v = v; if (html) el.innerHTML = v; else el.textContent = v; };
const phone = () => matchMedia("(max-width: 860px)").matches;

// ---------------- model state ----------------
const WINDOW = 2400, SAMPLE = 10, DEFAULT_RATE = 20;     // trend window 40 min, one sample per 10 s of plant time
const S = { col: null, run: BASE_RUN, hist: [], events: [], pending: true, acc: 0, lastSample: -1e9, sum: null, settle: 0 };
const sample = t => { const c = S.col, N = c.N, op = c.cfg.operation; return { t, xD: c.x[0] * 100, zF: op.feedFlowLph > 0 ? op.feedX * 100 : 0, T1: C(c.T[1]), T4: C(c.T[4]), T5: C(c.T[5]), Tb: C(c.T[N + 1]),
  D: c.toLph(c.D, c.x[0], 298.15), B: c.toLph(c.B, c.x[N + 1], 298.15), R: Math.min(op.refluxRatio, 20), Qr: c.Qr / 1000 }; };
function prefill() { S.hist.length = 0; S.events.length = 0; const s0 = sample(0); for (let t = -WINDOW; t <= 0; t += SAMPLE) S.hist.push({ ...s0, t }); S.lastSample = 0; }
function loadColumn(c, run, { pending = false } = {}) { S.col = c; S.run = run; S.pending = pending; S.acc = 0; S.settle = 0; c.t = 0; prefill(); fitAxes(true); syncControls(); S.sum = summary(c); eqCache = null; refreshAll(true); }
const mark = label => { S.events.push({ t: S.col.t, label }); if (S.events.length > 12) S.events.shift(); S.settle = S.col.t; };
function stepModel(seconds) {
  const c = S.col; let n = Math.min(6000, Math.floor((S.acc += seconds) / DT)); S.acc -= n * DT; if (S.acc > 60) S.acc = 0;
  while (n-- > 0) {
    if (S.pending && c.t >= DISTURB.at) { S.pending = false; c.cfg.operation.feedX = DISTURB.feedX; mark(DISTURB.label); syncControls(); }
    c.step(DT);
    if (c.t - S.lastSample >= SAMPLE) { S.lastSample = c.t; S.hist.push(sample(c.t)); while (S.hist.length && S.hist[0].t < c.t - WINDOW - SAMPLE) S.hist.shift(); }
  }
  if (!Number.isFinite(c.x[0]) || !Number.isFinite(c.T[1])) { loadColumn(restore(newColumn(BASE_RUN), INIT[BASE_RUN]), BASE_RUN); }   // guard: never show a broken state
}

// ---------------- three.js scene ----------------
const stage = $("stage");
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, stencil: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.prepend(renderer.domElement);
const scene = new THREE.Scene(), overlay = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 200);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.52; controls.minDistance = 0.35; controls.maxDistance = 30;
scene.add(new THREE.HemisphereLight(0xffffff, 0xb8bec4, 0.9));   // lighting mood of the source twin: white fill, white key, cool rim
{ const rim = new THREE.DirectionalLight(0xdcecff, 0.5); rim.position.set(1, 4, -6); scene.add(rim); }
const SUN_DIR = new THREE.Vector3(0.45, 0.85, 0.65).normalize();
const sun = new THREE.DirectionalLight(0xffffff, 1.3); sun.castShadow = true;
const POST = makePost(renderer, scene, overlay, camera);
const LOW = POST.tier === "low";
sun.shadow.mapSize.setScalar(LOW ? 1024 : 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 4;
scene.add(sun, sun.target);
function fitShadow() {
  const t = controls.target, d = camera.position.distanceTo(t), ext = Math.min(9, Math.max(2.5, d * 0.8));
  sun.target.position.copy(t); sun.position.copy(t).addScaledVector(SUN_DIR, 30);
  const c = sun.shadow.camera; if (Math.abs(c.right - ext) > ext * 0.1) { Object.assign(c, { left: -ext, right: ext, top: ext, bottom: -ext, near: 5, far: 60 }); c.updateProjectionMatrix(); }
}
const SC = buildColumnScene({ renderer, scene, low: LOW, nTrays: 14, feedTray: 12 });
{ const A = SC.A, V = (a, dx, dy, dz) => A[a].clone().add(new THREE.Vector3(dx, dy, dz));   // anchors for name labels and extra spots
  Object.assign(A, { froth: new THREE.Vector3(0.12, SC.trayY(8) + 0.09, 0.17), reboilerLbl: V("reboiler", -0.34, -0.55, 0.1), traysLbl: new THREE.Vector3(0.75, SC.trayY(5) - 0.13, 0), condLbl: V("condenser", 0.25, 0.3, 0), splitLbl: V("splitter", 0.5, -0.02, 0),
    prodLbl: V("product", 0, -0.72, 0), botLbl: V("bottoms", 0.25, 0.5, 0), consoleLbl: V("console", 0, 0.35, 0) }); }
const beacon = new THREE.Group(); { const m = new THREE.MeshBasicMaterial({ color: "#e0262c", transparent: true, opacity: 0.9, depthTest: false, side: THREE.DoubleSide });
  beacon.add(new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 48), m), new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 48), m)); beacon.visible = false; beacon.renderOrder = 30; overlay.add(beacon); }
const VIEWS = SC.VIEWS; let tween = null;
function goTo(name, instant = false) {
  const v = VIEWS[name], to = { p: new THREE.Vector3(...v.p), c: new THREE.Vector3(...v.c), fov: v.fov };
  const asp = stage.clientWidth / Math.max(1, stage.clientHeight);
  if (name === "overview") { if (asp >= 1 && asp < 1.45) { to.p.set(0.3, 3.75, 12.6); to.c.set(-0.5, 3.25, 0); to.fov = 36; } else if (asp < 1.25) { to.p.set(1.2, 3.6, 15.5); to.c.set(0.3, 3.1, 0); to.fov = 38; } }
  else if (asp < 1.1) { to.p.sub(to.c).multiplyScalar(1.35).add(to.c); to.fov = v.fov + 6; }
  document.querySelectorAll(".views [data-view]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.view === name)));
  if (instant || matchMedia("(prefers-reduced-motion: reduce)").matches) { camera.position.copy(to.p); controls.target.copy(to.c); camera.fov = to.fov; camera.updateProjectionMatrix(); controls.update(); return; }
  tween = { from: { p: camera.position.clone(), c: controls.target.clone(), fov: camera.fov }, to, t0: performance.now(), dur: 1400 };
}
document.querySelectorAll(".views [data-view]").forEach(b => b.onclick = () => goTo(b.dataset.view));
let colorMode = "x";
function setMode(m) { colorMode = m; SC.setMode(m); if (S.col && S.sum) PFD.update(S.col, S.sum, m); document.querySelectorAll("#mode-seg button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.m === m)));
  $("cmap-bar").style.background = rampCSS(m); put("cmap-t", m === "T" ? "Liquid temperature" : "Ethanol in the liquid"); put("cmap-lo", m === "T" ? "78 °C" : "water"); put("cmap-hi", m === "T" ? "102 °C" : "85 mol %"); }
document.querySelectorAll("#mode-seg button").forEach(b => b.onclick = () => setMode(b.dataset.m));
const VS = { x: null, T: null, hcl: new Float64Array(16), froth: new Float64Array(16), flood: new Float64Array(16) };
function visual() {
  const c = S.col, N = c.N, op = c.cfg.operation; VS.x = c.x; VS.T = c.T;
  for (let i = 1; i <= N; i++) { const h = c.hyd[i]; VS.hcl[i] = h.hcl || 0.03; VS.froth[i] = h.froth || 0.05; VS.flood[i] = h.flood || 0; }
  VS.Vrel = c.V[N + 1] / 2; VS.Lrel = c.L[N] / 3; VS.refluxFrac = op.refluxRatio / (op.refluxRatio + 1); VS.Drel = c.D / 0.35; VS.vent = c.V[1] > 1e-6 ? c.vent / c.V[1] : 0; VS.level = c.reboilerLevel;
  return VS;
}

// ---------------- readouts ----------------
const clockText = t => { const s = Math.max(0, Math.floor(t)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return `Plant time ${h}:${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };
const AZ = th.azeotrope(101325).x;
function stateOf(s) {
  const c = S.col, h = S.hist, n = h.length, a = h[Math.max(0, n - 7)], b = h[n - 1];
  const moving = n > 7 && (Math.abs(b.xD - a.xD) > 0.08 || Math.abs(b.T4 - a.T4) > 0.08 || Math.abs(b.D - a.D) > 0.5);
  if (c.faults.heaterTrip || s.Qr < 100) return ["Steam off", "off"];
  if (s.vent > 0.02 * Math.max(s.V1, 1e-6)) return ["Venting", "off"];
  if (s.flood > 1) return ["Flooding", "off"];
  return moving ? ["Settling", "water"] : ["Steady", "go"];
}
function refreshAll(force) {
  const c = S.col, s = S.sum = summary(c), op = c.cfg.operation, tr = LAB_RUNS[S.run].totalReflux && op.feedFlowLph === 0;
  const [st, cls] = stateOf(s); put("r-state", st); { const cn = "status-chip " + cls; if ($("r-state").className !== cn) $("r-state").className = cn; }
  put("r-big", `${f1(s.xD * 100)} mol %<small>ethanol in the distillate</small>`, true); put("r-when", `${f0(s.abvD)} % alcohol by volume`);
  put("r-D", tr || s.Dlph < 0.05 ? "none (total reflux)" : `${f1(s.Dlph)} L/h`); put("r-B", `${f1(s.Blph)} L/h`);
  put("r-rec", s.F > 0 ? `${f1(Math.min(100, s.recovery * 100))} %` : "–"); put("r-T", `${f1(s.Ttop)} / ${f1(s.Tbot)} °C`);
  put("r-flood", `${f0(s.flood * 100)} % (tray ${s.floodTray})`); put("r-dp", `${f1(s.dP / 1000)} kPa`);
  put("r-qr", `${f1(s.Qr / 1000)} kW`); put("r-qc", `${f1(s.Qc / 1000)} kW`); put("r-ql", `${f1(s.Qloss / 1000)} kW`);
  put("r-kwh", Number.isFinite(s.kWhPerL) && s.Dlph > 0.05 ? `${f2(s.kWhPerL)} kWh/L` : "–"); put("r-mb", `${(s.massErr * 100).toFixed(2)} %`);
  put("clock", clockText(c.t));
  put("tag", `${st} · distillate ${f1(s.xD * 100)} mol % · reflux ${op.refluxRatio > 50 ? "total" : f1(op.refluxRatio)} · steam ${f0(s.Qr / 1000)} kW · feed ${f1(op.feedFlowLph / 60)} L/min at ${f1(op.feedX * 100)} mol %`);
  takeaways(s, st); loopReadouts(); followControls(); drawTrends(); drawSide(force); lensRefresh(); PFD.update(c, s, colorMode); if (MP.isOpen()) MP.refreshLive();
}

// ---------------- "What this means": plain-language takeaways built from the live numbers ----------------
const TK = (id, html) => put(id, html ? `<b>What this means</b>${html}` : "", true);
function takeaways(s, st) {
  const c = S.col, op = c.cfg.operation, feedABV = th.abv(op.feedX), R = op.refluxRatio, tot = R > 50;
  let t;
  if (st === "Steam off") t = "<b>No steam, no vapour:</b> nothing rises, so nothing is separated. Switch the steam back on.";
  else if (st === "Venting") t = `<b>The condenser cannot keep up:</b> ${f0(s.vent / Math.max(s.V1, 1e-6) * 100)} % of the vapour escapes by the vent, taking ethanol with it. Raise the cooling water.`;
  else if (st === "Flooding") t = `<b>Flooding:</b> vapour lifts froth to the tray above on tray ${s.floodTray}, and separation collapses. Lower the steam.`;
  else if (s.xD > AZ - 0.03) t = `The distillate is at ${f1(s.xD * 100)} mol %, close to the ${f1(AZ * 100)} mol % ceiling where vapour and liquid match. More trays or reflux cannot pass it.`;
  else t = `The column turns a ${f0(feedABV)} % ABV feed into ${f0(s.abvD)} % ABV, about ${f1(s.abvD / Math.max(1, feedABV))} times stronger. ${tot ? "At total reflux no product is drawn." : "More reflux makes it stronger but slower."}`;
  TK("tk-now", t);
  if (chart === "mt") TK("tk-chart", `Each step is one tray. Steps shrink where the curve nears the diagonal: at ${f1(AZ * 100)} mol % they vanish, which is why this column cannot make pure ethanol.`);
  else { const run = LAB_RUNS[S.run]; TK("tk-chart", `Dots are student samples from ${run.name}. The model puts the distillate at ${f1(s.xD * 100)} mol %; the lab measured ${f1(run.xD * 100)}. Details: ∑ Model, Validation.`); }
  TK("tk-operate", tot ? "At total reflux all condensed liquid returns to the column: the best separation these trays can give, with no product."
    : `At a reflux ratio of ${f1(R)}, ${f0(R / (R + 1) * 100)} % of the condensed liquid goes back down. Raise it for stronger product; lower it for more product per kW of steam.`);
  const cc = c.cfg.control, aT = cc.top.mode === "auto", aD = cc.tray.mode === "auto";
  TK("tk-control", aT && aD ? "Both temperature loops are on. They push on each other, because reflux and steam each move both temperatures."
    : aT ? `The loop holds tray 4 at ${f1(C(cc.top.sp))} °C by moving the reflux, now ${f1(R)}. That keeps the product strength steady when the feed changes.`
    : aD ? `The loop holds tray 5 at ${f1(C(cc.tray.sp))} °C by moving the steam, now ${f0(op.reboilerDuty / 1000)} kW.`
    : "Both temperature loops are in Manual: when the feed weakens the product weakens too, and nothing corrects it. Try tray 4 → reflux in Auto.");
  const share = s.Qr > 0 ? s.Qloss / s.Qr * 100 : 0, kettleMin = s.kWhPerL / 1.5 * 60;
  TK("tk-energy", s.Qr < 100 ? "" : `Almost all the steam heat leaves in the cooling water; ${f0(share)} % warms the room through the bare walls.${s.Dlph > 0.05 ? ` One litre of distillate takes ${f2(s.kWhPerL)} kWh, a 1.5 kW kettle running ${f0(kettleMin)} minutes.` : ""}`);
}

// ---------------- charts ----------------
function setupCanvas(c) { const r = c.getBoundingClientRect(), dpr = Math.min(devicePixelRatio, 2); if (r.width < 4 || r.height < 4) return null; const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr); if (c.width !== W || c.height !== H) { c.width = W; c.height = H; } const g = c.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, r.width, r.height); return { g, w: r.width, h: r.height }; }
const nice = (lo, hi, n = 4) => { const span = Math.max(1e-9, hi - lo), raw = span / n, p = Math.pow(10, Math.floor(Math.log10(raw))), step = [1, 2, 2.5, 5, 10].map(m => m * p).find(v => v >= raw); const a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step, t = []; for (let v = a; v <= b + step * 1e-6; v += step) t.push(+v.toFixed(6)); return { min: a, max: b, ticks: t }; };
// fixed, fitted axes (Part S): chosen for the standard feed upset, refitted only if a curve leaves the plot
const TREND = [
  { id: "c-x", L: { keys: ["xD"], def: [54, 72] }, R: { keys: ["zF"], def: [0, 20], color: "--ink-2" }, series: [["zF", "--ink-2", "R", 1.3, [4, 3]], ["xD", "--accent", "L", 2.2]] },
  { id: "c-T", L: { keys: ["T1", "T4", "T5", "Tb"], def: [76, 104] }, series: [["Tb", "--ink-2", "L", 1.3, [4, 3]], ["T1", "--signal", "L", 1.6], ["T5", "#b26a00", "L", 1.6], ["T4", "--accent", "L", 2.2]] },
  { id: "c-F", L: { keys: ["D", "B", "Qr"], def: [0, 150] }, R: { keys: ["R"], def: [0, 8], color: "#1f8a4c" }, series: [["Qr", "#b26a00", "L", 1.3, [4, 3]], ["B", "--signal", "L", 1.6], ["R", "#1f8a4c", "R", 1.6], ["D", "--accent", "L", 2.2]] },
];
function fitAxes(reset) {
  for (const ch of TREND) for (const ax of [ch.L, ch.R]) { if (!ax) continue; if (reset || !ax.cur) ax.cur = nice(ax.def[0], ax.def[1]);
    let lo = Infinity, hi = -Infinity; for (const p of S.hist) for (const k of ax.keys) { const v = p[k]; if (v < lo) lo = v; if (v > hi) hi = v; }
    if (lo < ax.cur.min - 1e-9 || hi > ax.cur.max + 1e-9) { const pad = Math.max(0.06 * (hi - lo), 0.02 * Math.abs(hi) + 0.5); ax.cur = nice(Math.min(lo - pad, ax.def[0] <= lo ? ax.def[0] : lo - pad), Math.max(hi + pad, ax.def[1] >= hi ? ax.def[1] : hi + pad)); } }
}
const col2 = c => c.startsWith("--") ? css(c) : c;
function drawTrends() {
  fitAxes(false); const tNow = S.col.t, t0 = tNow - WINDOW;
  for (const ch of TREND) {
    const cv = setupCanvas($(ch.id)); if (!cv) continue; const { g, w, h } = cv, m = { l: 34, r: ch.R ? 28 : 10, t: 17, b: 27 }, pw = w - m.l - m.r, phh = h - m.t - m.b;
    const X = t => m.l + (t - t0) / WINDOW * pw, Y = (v, ax) => m.t + phh - (v - ax.cur.min) / (ax.cur.max - ax.cur.min) * phh;
    g.font = "10.5px JetBrains Mono, monospace"; g.lineWidth = 1; g.strokeStyle = css("--rule"); g.fillStyle = css("--ink-2");
    g.textAlign = "right"; g.textBaseline = "middle"; for (const t of ch.L.cur.ticks) { const y = Y(t, ch.L); g.beginPath(); g.moveTo(m.l, y); g.lineTo(w - m.r, y); g.stroke(); g.fillText(String(t), m.l - 4, y); }
    if (ch.R) { g.textAlign = "left"; g.fillStyle = col2(ch.R.color); for (const t of ch.R.cur.ticks) g.fillText(String(t), w - m.r + 4, Y(t, ch.R)); g.fillStyle = css("--ink-2"); }
    g.textAlign = "center"; g.textBaseline = "top"; for (let tm = Math.ceil(t0 / 600) * 600; tm <= tNow; tm += 600) { const x = X(tm); if (x < m.l + 8 || x > w - m.r - 4) continue; g.fillText(String(Math.round(tm / 60)), x, h - m.b + 3); g.beginPath(); g.moveTo(x, h - m.b); g.lineTo(x, h - m.b + 3); g.stroke(); }
    g.fillText("plant time (min)", m.l + pw / 2, h - 12);
    g.save(); g.beginPath(); g.rect(m.l, m.t - 1, pw + 1, phh + 2); g.clip();
    for (const [key, color, axn, lw, dash] of ch.series) { const ax = axn === "R" ? ch.R : ch.L; g.strokeStyle = col2(color); g.lineWidth = lw; g.setLineDash(dash || []); g.beginPath(); let first = true;
      for (const p of S.hist) { if (p.t < t0 - SAMPLE) continue; const x = X(p.t), y = Y(p[key], ax); first ? g.moveTo(x, y) : g.lineTo(x, y); first = false; } g.stroke(); }
    g.setLineDash([]); g.restore();
    // event markers: a small arrow in the top margin with a short label, clear of the curves
    const placed = []; g.font = "600 10.5px Barlow Semi Condensed, sans-serif"; g.textBaseline = "middle";
    for (const ev of S.events) { const x = X(ev.t); if (x < m.l + 2 || x > w - m.r) continue; g.fillStyle = css("--accent"); g.strokeStyle = css("--accent"); g.lineWidth = 1; g.setLineDash([2, 3]); g.beginPath(); g.moveTo(x, m.t); g.lineTo(x, h - m.b); g.stroke(); g.setLineDash([]);
      g.beginPath(); g.moveTo(x, m.t + 1); g.lineTo(x - 4, m.t - 6); g.lineTo(x + 4, m.t - 6); g.closePath(); g.fill();
      }
    for (let k = S.events.length - 1; k >= 0; k--) { const ev = S.events[k], x = X(ev.t); if (x < m.l + 2 || x > w - m.r) continue;   // newest label first; a label that would touch another is left out (its arrow stays)
      const tw = g.measureText(ev.label).width, right = x + 7 + tw < w - 2, lx = right ? x + 7 : x - 7 - tw; if (lx < 2 || placed.some(p => lx < p[1] + 6 && lx + tw > p[0] - 6)) continue; placed.push([Math.min(lx, x - 5), Math.max(lx + tw, x + 5)]); g.fillStyle = css("--accent"); g.textAlign = "left"; g.fillText(ev.label, lx, m.t - 8); }
  }
}
// side chart: McCabe–Thiele staircase, or the tray profile with lab samples
let chart = "mt", eqCache = null, sideT = 0;
function setChart(c) { chart = c; document.querySelectorAll("#chart-seg button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.c === c)));
  put("side-legend", c === "mt" ? `<span><i class="sw" style="background:var(--ink)"></i>Equilibrium curve</span><span><i class="sw" style="background:var(--accent)"></i>Trays (one step each)</span><span><i class="dot" style="background:var(--signal)"></i>Feed tray</span>`
    : `<span><i class="sw" style="background:var(--accent)"></i>Ethanol, model (mol %)</span><span><i class="dot" style="background:var(--ink)"></i>Lab samples</span><span><i class="sw" style="background:var(--signal)"></i>Temperature (°C, right)</span>`, true); refreshAll(true); }
document.querySelectorAll("#chart-seg button").forEach(b => b.onclick = () => setChart(b.dataset.c));
function profTable() {
  if (!$("prof-data").open) return; const c = S.col, N = c.N, run = LAB_RUNS[S.run], row = (lbl, x, lab, T) => `<tr><td>${lbl}</td><td>${(x * 100).toFixed(2)}</td><td>${lab == null ? "–" : (lab * 100).toFixed(2)}</td><td>${T == null ? "–" : f1(C(T))}</td></tr>`;
  put("prof-table", `<thead><tr><th>Stage</th><th>Model (mol %)</th><th>${run.name} lab (mol %)</th><th>T (°C)</th></tr></thead><tbody>${row("Distillate", c.x[0], run.xD, null)}${Array.from({ length: N }, (_, k) => row("Tray " + (k + 1), c.x[k + 1], run.xTrays[k], c.T[k + 1])).join("")}${row("Bottoms", c.x[N + 1], run.xB, c.T[N + 1])}</tbody>`, true);
}
$("prof-data").addEventListener("toggle", () => profTable());
function drawSide(force) {
  const now = performance.now(); if (!force && now - sideT < 450) return; sideT = now; profTable();
  const cv = setupCanvas($("c-side")); if (!cv) return; const { g, w, h } = cv, c = S.col, N = c.N;
  g.font = "10.5px JetBrains Mono, monospace"; g.lineWidth = 1;
  if (chart === "mt") {
    const m = { l: 36, r: 10, t: 8, b: 30 }, pw = w - m.l - m.r, phh = h - m.t - m.b, X = v => m.l + v * pw, Y = v => m.t + phh - v * phh;
    if (!eqCache || eqCache.P !== c.cfg.operation.topPressure) eqCache = { P: c.cfg.operation.topPressure, pts: th.eqCurve(c.cfg.operation.topPressure, 50) };
    g.strokeStyle = css("--rule"); g.fillStyle = css("--ink-2"); g.textAlign = "right"; g.textBaseline = "middle";
    for (let v = 0; v <= 1.001; v += 0.2) { g.beginPath(); g.moveTo(m.l, Y(v)); g.lineTo(w - m.r, Y(v)); g.stroke(); g.fillText(v.toFixed(1), m.l - 4, Y(v)); }
    g.textAlign = "center"; g.textBaseline = "top"; for (let v = 0; v <= 1.001; v += 0.2) g.fillText(v.toFixed(1), X(v), h - m.b + 4);
    g.fillText("x, ethanol in the liquid (mole fraction)", m.l + pw / 2, h - 13);
    g.save(); g.translate(10, m.t + phh / 2); g.rotate(-Math.PI / 2); g.fillText("y, in the vapour", 0, -5); g.restore();
    g.strokeStyle = css("--ink-2"); g.setLineDash([3, 3]); g.beginPath(); g.moveTo(X(0), Y(0)); g.lineTo(X(1), Y(1)); g.stroke(); g.setLineDash([]);
    g.strokeStyle = css("--ink"); g.lineWidth = 1.6; g.beginPath(); eqCache.pts.forEach(([x, y], k) => k ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))); g.stroke();
    g.strokeStyle = css("--accent"); g.lineWidth = 1.6; g.beginPath(); g.moveTo(X(c.x[0]), Y(c.y[1]));
    for (let i = 1; i <= N; i++) { g.lineTo(X(c.x[i]), Y(c.y[i])); g.lineTo(X(c.x[i]), Y(c.y[i + 1])); } g.lineTo(X(c.x[N + 1]), Y(c.y[N + 1])); g.stroke();
    const ft = c.cfg.operation.feedTray; if (c.cfg.operation.feedFlowLph > 0) { g.fillStyle = css("--signal"); g.beginPath(); g.arc(X(c.x[ft]), Y(c.y[ft]), 3.5, 0, 7); g.fill(); }
    g.fillStyle = css("--accent"); g.beginPath(); g.arc(X(c.x[0]), Y(c.x[0]), 3, 0, 7); g.fill();
  } else {
    const m = { l: 34, r: 34, t: 8, b: 30 }, pw = w - m.l - m.r, phh = h - m.t - m.b, n = N + 1, X = i => m.l + (i - 0.5) / n * pw;
    let xmax = 0; for (let i = 0; i <= n; i++) xmax = Math.max(xmax, c.x[i] * 100); const run = LAB_RUNS[S.run]; xmax = Math.max(xmax, run.xD * 100, ...run.xTrays.map(v => v * 100));
    const ax = nice(0, Math.max(20, xmax * 1.05)), YL = v => m.t + phh - (v - ax.min) / (ax.max - ax.min) * phh, YR = v => m.t + phh - (v - 75) / 30 * phh;
    g.strokeStyle = css("--rule"); g.fillStyle = css("--ink-2"); g.textAlign = "right"; g.textBaseline = "middle"; for (const t of ax.ticks) { g.beginPath(); g.moveTo(m.l, YL(t)); g.lineTo(w - m.r, YL(t)); g.stroke(); g.fillText(String(t), m.l - 4, YL(t)); }
    g.textAlign = "left"; g.fillStyle = css("--signal"); for (const t of [75, 85, 95, 105]) g.fillText(String(t), w - m.r + 4, YR(t)); g.fillStyle = css("--ink-2");
    g.textAlign = "center"; g.textBaseline = "top"; for (let i = 1; i <= n; i++) if (i === 1 || i % 2 === 0 || i === n) g.fillText(i === n ? "R" : String(i), X(i), h - m.b + 4);
    g.fillText("tray, top to bottom (R = reboiler)", m.l + pw / 2, h - 13);
    g.strokeStyle = css("--signal"); g.lineWidth = 1.4; g.beginPath(); for (let i = 1; i <= n; i++) i === 1 ? g.moveTo(X(i), YR(C(c.T[i]))) : g.lineTo(X(i), YR(C(c.T[i]))); g.stroke();
    g.strokeStyle = css("--accent"); g.lineWidth = 2; g.beginPath(); for (let i = 1; i <= n; i++) i === 1 ? g.moveTo(X(i), YL(c.x[i] * 100)) : g.lineTo(X(i), YL(c.x[i] * 100)); g.stroke();
    g.fillStyle = css("--ink"); run.xTrays.forEach((v, k) => { g.beginPath(); g.arc(X(k + 1), YL(v * 100), 2.6, 0, 7); g.fill(); });
  }
}

// ---------------- lenses, spots, intro ----------------
const courseLink = n => `<a class="course" href="https://guide.wisc.edu/search/?P=CBE%20${n}" target="_blank" rel="noopener" title="CBE ${n}: ${COURSE[n][1]}">${COURSE[n][0].replace("&", "&amp;")} ↗</a>`;
const lensNav = $("lenses"), lensCard = $("lens-card");
LENSES.forEach((L, i) => {
  const b = document.createElement("button"); b.type = "button"; b.textContent = COURSE[L.n][0]; b.dataset.i = i;
  b.setAttribute("aria-pressed", "false"); b.title = `CBE ${L.n}: see where ${COURSE[L.n][0]} shows up in this digital twin`;
  b.onclick = () => (lens && lens.i === i ? closeLens() : openLens(i)); lensNav.appendChild(b);
});
const LIVE = {
  "0-0": s => `In ${f2(s.F)} mol/s = out ${f2(s.D)} + ${f2(s.B)} mol/s; ${f1(Math.min(100, s.recovery * 100))} % of the ethanol leaves at the top.`,
  "1-0": () => `Plant time ${f0(S.col.t)} s = ${f0(S.col.t / DT)} Euler steps of 0.1 s on 32 equations.`,
  "2-0": s => `${f1(s.Qr / 1000)} kW of steam boils ${f2(S.col.V[S.col.N + 1])} mol/s; the condenser removes ${f1(s.Qc / 1000)} kW.`,
  "3-0": () => { const c = S.col; return `Tray 1: liquid ${f1(c.x[1] * 100)} mol %, vapour above it ${f1(c.y[1] * 100)} mol %. Azeotrope: ${f1(AZ * 100)} mol %.`; },
  "4-0": s => `Walls lose ${f1(s.Qloss / 1000)} kW, ${f1(s.Qloss / Math.max(1, s.Qr) * 100)} % of the steam.`,
  "5-0": s => `Tray ${s.floodTray} is at ${f0(s.flood * 100)} % of flooding; froth ${f0((S.col.hyd[s.floodTray].froth || 0) * 1000)} mm of a 254 mm spacing.`,
  "5-1": s => `Condenser: ${f1(s.Qc / 1000)} kW removed of ${f1(S.col.condenserCapacity / 1000)} kW possible; water leaves at ${f1(C(S.col.cwOutT))} °C.`,
  "6-0": s => `${LAB_RUNS[S.run].name}: distillate model ${f1(s.xD * 100)}, lab ${f1(LAB_RUNS[S.run].xD * 100)} mol %.`,
  "7-0": s => `${stateOf(s)[0]}: distillate ${f1(s.xD * 100)} mol % at ${f1(s.Dlph)} L/h.`,
  "8-0": () => { const c = S.col; return `Tray 7: y* = ${f2(c.ystar[7])}, y = ${f2(c.y[7])}; Murphree efficiency ${f2(c.E[7])}.`; },
  "9-0": s => `Reflux ${s.R > 50 ? "total" : f1(s.R)}: ${f1(s.xD * 100)} mol %, ${f1(s.Dlph)} L/h, ${Number.isFinite(s.kWhPerL) ? f2(s.kWhPerL) : "–"} kWh per litre.`,
  "10-0": () => { const c = S.col, cc = c.cfg.control.top; return `Tray 4: ${f1(C(c.T[4]))} °C${cc.mode === "auto" ? `, set ${f1(C(cc.sp))} °C` : ""}; reflux ${f1(Math.min(c.cfg.operation.refluxRatio, 99))} (${cc.mode}).`; },
};
let lens = null, lensPrev = null;
function openLens(i, k = 0) {
  $("realworld").setAttribute("aria-pressed", "false");
  if (!lens) lensPrev = { p: camera.position.clone(), c: controls.target.clone(), fov: camera.fov };
  lens = { i, k }; lensNav.querySelectorAll("button[data-i]").forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.i === i))); showStop();
}
function showStop() {
  const L = LENSES[lens.i], St = L.stops[lens.k]; goTo(St.view);
  document.querySelectorAll(".lens-hl").forEach(e => e.classList.remove("lens-hl"));
  if (St.panel) { const el = $(St.panel); if (el.classList.contains("fold")) setFold(el, true); el.classList.add("lens-hl"); }
  if (St.beacon === "tray" || St.beacon === "trays") setChart("mt"); if (St.beacon === "sample") setChart("prof");
  const last = lens.k === L.stops.length - 1, EQN = MP.eqByNo(St.eq), res = RESEARCH.filter(r => r.lens && r.lens[0] === lens.i && (r.lens[1] || 0) === lens.k);
  lensCard.innerHTML = `
    <div class="lc-top"><span class="lc-subject">${COURSE[L.n][0].replace("&", "&amp;")}</span>
      <span class="lc-step">${L.stops.length > 1 ? `${lens.k + 1} of ${L.stops.length}` : ""}</span>
      <button class="lc-x" type="button" aria-label="Close">×</button></div>
    <h3>${St.title}</h3>
    <p>${St.text}</p>
    <p class="lc-plain"><b>Plainly:</b> ${St.plain}</p>
    <details class="lc-eq"><summary>Show the equation</summary><div><div class="lc-tex">${MP.tex(EQN.tex, true)}</div><p class="lc-eqref">Eq. (${EQN.no}) · ${EQN.name} · <button type="button" id="lc-model">open in ∑ Model ▸</button></p></div></details>
    <p class="lc-live" id="lc-live"></p>
    <p class="lc-why"><b>Why:</b> ${St.why}</p>
    <p class="lc-course">Course: ${courseLink(L.n)}</p>
    ${res.map(r => `<p class="lc-research">Research at UW–Madison: <button type="button" data-res="${r.id}">${r.name} (${r.areas[0].toLowerCase()}) ▸</button></p>`).join("")}
    <div class="lc-nav">
      <button class="btn" type="button" id="lc-back" ${lens.k === 0 ? "disabled" : ""}>Back</button>
      <button class="btn primary" type="button" id="lc-next">${last ? "Done" : "Next"}</button>
    </div>`;
  lensCard.hidden = false; showCard();
  lensCard.querySelector(".lc-x").onclick = closeLens;
  $("lc-back").onclick = () => { if (lens.k > 0) { lens.k--; showStop(); } };
  $("lc-next").onclick = () => { if (last) closeLens(); else { lens.k++; showStop(); } };
  $("lc-model").onclick = () => MP.toggle(true, "eq-" + EQN.no);
  lensCard.querySelectorAll("[data-res]").forEach(b => b.onclick = () => toggleResearch(true, b.dataset.res));
  const p = SC.A[St.beacon]; beacon.position.copy(p); beacon.scale.setScalar(["tray", "froth", "sample", "feed", "wall", "splitter"].includes(St.beacon) ? 0.14 : 0.32); beacon.visible = true;
  lensRefresh(); markSpot();
}
function showCard() { const a = document.querySelector("aside"); if (phone()) lensCard.scrollIntoView({ block: "start", behavior: "smooth" }); else a.scrollTo({ top: 0, behavior: "smooth" }); }
function lensRefresh() { if (!lens) return; const el = $("lc-live"); if (!el) return; const f = LIVE[`${lens.i}-${lens.k}`]; const v = f ? f(S.sum) : ""; if (el.__v !== v) { el.__v = v; el.innerHTML = MP.mathText(v.replace(/&/g, "&amp;").replace(/</g, "&lt;")); } }
function closeLens() {
  if (!lens) return; lens = null; markSpot(); lensCard.hidden = true; beacon.visible = false;
  document.querySelectorAll(".lens-hl").forEach(e => e.classList.remove("lens-hl"));
  lensNav.querySelectorAll("button[data-i]").forEach(b => b.setAttribute("aria-pressed", "false"));
  document.querySelectorAll(".views [data-view]").forEach(b => b.setAttribute("aria-pressed", "false"));
  if (lensPrev) tween = { from: { p: camera.position.clone(), c: controls.target.clone(), fov: camera.fov }, to: { p: lensPrev.p, c: lensPrev.c, fov: lensPrev.fov }, t0: performance.now(), dur: 1200 };
}
document.addEventListener("keydown", e => { if (e.key !== "Escape") return; if (!$("gd-panel").hidden) $("gd-panel").hidden = true; else if (resOpen) toggleResearch(false); else if (crsOpen) toggleCourses(false); else if (MP.isOpen()) MP.toggle(false); else if (lens) closeLens(); else if (!lensCard.hidden) { lensCard.hidden = true; $("realworld").setAttribute("aria-pressed", "false"); } });

function setFold(sec, open) { if (sec.classList.contains("collapsed") === !open) return; sec.classList.toggle("collapsed", !open); const h = sec.querySelector(":scope > h2"); if (h) h.setAttribute("aria-expanded", String(open)); }
document.querySelectorAll("section.fold").forEach(sec => {
  const h = sec.querySelector(":scope > h2"); h.tabIndex = 0; h.setAttribute("role", "button"); h.setAttribute("aria-expanded", "false");
  const toggle = () => setFold(sec, sec.classList.contains("collapsed"));
  h.addEventListener("click", e => { if (!e.target.closest("a")) toggle(); });
  h.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
});
$("cond-toggle").onclick = e => { const on = e.currentTarget.getAttribute("aria-pressed") !== "true"; e.currentTarget.setAttribute("aria-pressed", String(on)); $("tag").hidden = !on; setFold($("sec-operate"), on); setFold($("sec-control"), on); };
document.addEventListener("click", e => {
  const a = e.target.closest("a.ref"); if (!a) return; e.preventDefault();
  if (MP.isOpen()) { const li = document.getElementById("mref-" + a.dataset.ref); if (li) { li.scrollIntoView({ block: "center", behavior: "smooth" }); li.classList.add("flash"); setTimeout(() => li.classList.remove("flash"), 1600); } return; }
  const li = $("ref-" + a.dataset.ref); if (!li) return; setFold($("sec-refs"), true); li.scrollIntoView({ block: "center", behavior: "smooth" }); li.classList.add("flash"); setTimeout(() => li.classList.remove("flash"), 1600);
});
$("refs").innerHTML = REFS.map((r, i) => `<li id="ref-${i + 1}">${r}</li>`).join("");

function openIntro() {
  if (lens) closeLens();
  $("realworld").setAttribute("aria-pressed", "true"); beacon.visible = false;
  lensCard.innerHTML = `
    <div class="lc-top"><span class="lc-subject">Real world</span><button class="lc-x" type="button" aria-label="Close">×</button></div>
    <h3>Why is distillation chemical engineering?</h3>
    <p>Boil a mixture and the vapour is richer in the lighter part. Stack that step on 14 trays and weak ethanol becomes strong.</p>
    <ul class="lc-list">
      <li><b>Everywhere:</b> fuels, solvents, spirits and air gases are separated this way.</li>
      <li><b>Energy:</b> it runs on heat, so reflux and steam decide the cost.</li>
      <li><b>A hard limit:</b> ethanol–water stops at ${f1(AZ * 100)} mol %, the azeotrope${ref(11)}.</li>
    </ul>
    <p class="lc-why"><b>Chemical engineers</b> size the trays${ref(12)}, set the reflux and keep the product on spec.</p>
    <p class="lc-plain">This twin resembles the column in the department's summer lab, fitted to student runs${ref(17)}. In a few seconds the feed weakens: watch the trends.</p>
    <div class="lc-nav"><button class="btn primary" type="button" id="lc-next">Start exploring</button></div>`;
  lensCard.hidden = false; showCard();
  const done = () => { lensCard.hidden = true; $("realworld").setAttribute("aria-pressed", "false"); try { localStorage.setItem("distill-intro-seen", "1"); } catch (e) {} };
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
const spotTable = $("spot-table");
spotTable.innerHTML = `<button type="button" class="st-head" id="st-head" aria-expanded="true" title="Collapse or expand the list of ChemE spots"><span>ChemE spots</span><b>‹</b></button>` + SPOTS.map((Sp, i) => `<button type="button" class="st-row" data-s="${i}" title="${Sp.name}"><i>${i + 1}</i><span>${Sp.name}</span></button>`).join("");
function setSpotTable(min) { spotTable.classList.toggle("min", min); $("st-head").setAttribute("aria-expanded", String(!min)); $("st-head").querySelector("b").textContent = min ? "›" : "‹"; }
spotTable.onclick = e => { if (e.target.closest("#st-head")) return setSpotTable(!spotTable.classList.contains("min")); const r = e.target.closest(".st-row"); if (r) { const Sp = SPOTS[+r.dataset.s]; openLens(Sp.lens, Sp.k || 0); } };
setSpotTable(phone());
function markSpot() { SPOTS.forEach((Sp, i) => { const on = !!lens && lens.i === Sp.lens && lens.k === (Sp.k || 0); spotTable.children[i + 1].classList.toggle("on", on); spotEls[i].classList.toggle("on", on); }); }
const _v = new THREE.Vector3(), SPP = SPOTS.map(() => ({ x: 0, y: 0, tx: 0, ty: 0, vis: false }));
function placeSpots() {
  const w = stage.clientWidth, h = stage.clientHeight, R = 37, dist = camera.position.distanceTo(controls.target), far = dist > 5, mid = dist > 2.2;
  const proj = p => { _v.copy(p).project(camera); return _v.z < 1 && _v.z > -1 && Math.abs(_v.x) < 0.98 && Math.abs(_v.y) < 0.96; };
  SPOTS.forEach((Sp, i) => { const q = SPP[i]; q.vis = proj(SC.A[Sp.at]); q.tx = q.x = (_v.x + 1) / 2 * w; q.ty = q.y = (1 - _v.y) / 2 * h; if (mid && Sp.off) { q.x += Sp.off[0]; q.y += Sp.off[1]; } });   // unless zoomed right in, spots on the column sit beside it
  // spots that project close together are pushed apart and joined to their true position by a leader line
  for (let it = 0; it < 10; it++) for (let i = 0; i < SPP.length; i++) for (let j = i + 1; j < SPP.length; j++) { const a = SPP[i], b = SPP[j]; if (!a.vis || !b.vis) continue;
    let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy); if (d >= R) continue; if (d < 0.5) { dx = 1; dy = 0.3; d = 1; } if (Math.abs(dx) < 6) dx += (i % 2 ? 6 : -6); const m = (R - d) / 2 / d; a.x -= dx * m; a.y -= dy * m; b.x += dx * m; b.y += dy * m; }
  SPP.forEach((q, i) => { const el = spotEls[i], ln = lineEls[i], moved = q.vis && Math.hypot(q.x - q.tx, q.y - q.ty) > 5; el.style.display = q.vis ? "" : "none"; ln.style.display = moved ? "" : "none";
    if (q.vis) { el.style.left = `${q.x}px`; el.style.top = `${q.y}px`; } if (moved) { ln.setAttribute("x1", q.tx); ln.setAttribute("y1", q.ty); ln.setAttribute("x2", q.x); ln.setAttribute("y2", q.y); } });
  NAMES.forEach(([, at], i) => { const el = nameEls[i], vis = far && w > 700 && proj(SC.A[at]); el.style.display = vis ? "" : "none"; if (vis) { el.style.left = `${(_v.x + 1) / 2 * w}px`; el.style.top = `${(1 - _v.y) / 2 * h}px`; } });
}

// ---------------- jump actions (course map, ∑ Model, research) ----------------
const flash = id => { const el = $(id); el.classList.add("lens-hl"); setTimeout(() => el.classList.remove("lens-hl"), 1800); };
const openSec = id => { setFold($(id), true); $(id).scrollIntoView({ block: "start", behavior: "smooth" }); flash(id); };
const GO = {
  balances: () => openSec("sec-energy"), mccabe: () => { setChart("mt"); openSec("sec-chart"); }, profile: () => { setChart("prof"); openSec("sec-chart"); },
  tray: () => goTo("tray"), hyd: () => { goTo("tray"); openSec("sec-now"); }, heat: () => { goTo("condenser"); openSec("sec-energy"); }, trends: () => flash("trend-strip"),
  control: () => { goTo("console"); openSec("sec-control"); }, faults: () => openSec("sec-operate"), lab: () => { setChart("prof"); openSec("sec-operate"); }, products: () => goTo("products"),
  feed: () => goTo("feed"), reboiler: () => goTo("reboiler"), condenser: () => goTo("condenser"), column: () => goTo("column"),
  "m-vle": () => MP.toggle(true, "eq-4"), "m-num": () => MP.toggle(true, "m-num"), "m-val": () => MP.toggle(true, "m-val"),
};
const MP = makeModelPanel({ S, GO, courseLink, REFS, ref });
// process flow diagram beside the 3D view: on by default where there is room for both
const PFD = makePFD({ host: $("pfd-body"), go: k => (GO[k] ? GO[k]() : goTo(k)) });
function setPFD(on, save = true) { document.querySelector("main").classList.toggle("has-pfd", on); $("pfd-toggle").setAttribute("aria-pressed", String(on)); if (!phone()) setSpotTable(on); if (save) try { localStorage.setItem("distill-pfd", on ? "1" : "0"); } catch (e) {}
  if (on && phone() && save) $("pfd").scrollIntoView({ block: "start", behavior: "smooth" }); }
$("pfd-toggle").onclick = () => setPFD(!document.querySelector("main").classList.contains("has-pfd")); $("pfd-x").onclick = () => setPFD(false);
{ let v = null; try { v = localStorage.getItem("distill-pfd"); } catch (e) {} setPFD(v == null ? innerWidth >= 1150 : v === "1" && !phone(), false); }

// ---------------- Courses panel ----------------
const crs = { aud: "student", kind: "all", hi: null }; let crsOpen = false;
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
    <p><b>One process, many courses:</b> this digital twin shows how balances, thermodynamics, transport, mass transfer, statistics, control and design work together in one column.</p>
    <p>${list.length} courses use this digital twin. Topic names follow the CBE Curriculum Navigator; click a feature to jump to it, or a course number for its card.</p>
    <h3>Course map</h3>${matrix}
    <p><a class="crs-ps" href="../problems/#distill-Integrative" target="_blank" rel="noopener">Integrative problem ↗</a> one operating point through six courses.</p>
    <h3>Courses</h3><div class="crs-grid">${cards}</div>
    <p class="crs-legend">${fams.map(f => `<span><i style="background:${FAM[f].color}"></i>${FAM[f].label}</span>`).join("")}</p>`;
  MP.typesetIn($("crs-body"));
}
function toggleCourses(on) { crsOpen = on; $("crs-panel").hidden = !on; if (on) { renderCourses(); $("crs-close").focus(); } }
$("open-courses").onclick = () => toggleCourses(true); $("hdr-courses").onclick = () => toggleCourses(true); $("crs-close").onclick = () => toggleCourses(false);
$("crs-panel").addEventListener("click", e => { if (e.target.id === "crs-panel") toggleCourses(false); });
for (const [id, key] of [["crs-aud", "aud"], ["crs-kind", "kind"]]) $(id).onclick = e => { const b = e.target.closest("button"); if (!b) return; crs[key] = b.dataset.a || b.dataset.k; $(id).querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); renderCourses(); };
$("crs-body").addEventListener("click", e => {
  const g = e.target.closest("[data-go]"); if (g) { toggleCourses(false); GO[g.dataset.go](); return; }
  const h = e.target.closest("th[data-c]"); if (h) { crs.hi = crs.hi === +h.dataset.c ? null : +h.dataset.c; renderCourses(); document.getElementById("crs-" + h.dataset.c)?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }
});
$("crs-summary").textContent = `Used in ${COURSES.length} courses, each with a problem set.`;

// ---------------- Links to Research (Parts N, T) ----------------
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
    <h3>UW–Madison centers and programs</h3><div class="res-grid res-centers">${CENTERS.map(c => `<article class="crs-card res-card" id="cen-${c.id}">
      <h4><a href="${c.url}" target="_blank" rel="noopener">${c.name} ↗</a></h4>
      <p class="res-where"><b>Connects to:</b> ${c.where}</p>
    </article>`).join("")}</div>`;
  const c = id && $("res-" + id); if (c) { c.scrollIntoView({ block: "center" }); c.classList.add("hi"); } else $("res-close").focus();
}
$("hdr-research").onclick = () => toggleResearch(true); $("res-close").onclick = () => toggleResearch(false);
$("res-panel").addEventListener("click", e => { if (e.target.id === "res-panel") return toggleResearch(false); const g = e.target.closest("[data-go]"); if (g && GO[g.dataset.go]) { toggleResearch(false); GO[g.dataset.go](); } });

// ---------------- controls ----------------
const op = () => S.col.cfg.operation;
const FIELDS = {
  reflux: { get: () => Math.min(12, op().refluxRatio), set: v => { op().refluxRatio = v; S.col.ctl.top.bias = v; }, fmt: () => op().refluxRatio > 50 ? "total reflux" : f1(op().refluxRatio), ev: () => `Reflux ${f1(op().refluxRatio)}` },
  duty: { get: () => op().reboilerDuty / 1000, set: v => { op().reboilerDuty = v * 1000; S.col.ctl.tray.bias = v * 1000; }, fmt: () => `${f0(op().reboilerDuty / 1000)} kW`, ev: () => `Steam ${f0(op().reboilerDuty / 1000)} kW` },
  feedF: { get: () => op().feedFlowLph / 60, set: v => { op().feedFlowLph = v * 60; if (v > 0 && op().refluxRatio > 50) op().refluxRatio = 3.8; }, fmt: () => `${f1(op().feedFlowLph / 60)} L/min`, ev: () => `Feed ${f1(op().feedFlowLph / 60)} L/min` },
  feedX: { get: () => op().feedX * 100, set: v => { op().feedX = v / 100; S.pending = false; }, fmt: () => `${f1(op().feedX * 100)} mol % (${f0(th.abv(op().feedX))} % ABV)`, ev: () => `Feed ${f1(op().feedX * 100)} mol %` },
  feedT: { get: () => C(op().feedT), set: v => { op().feedT = v + 273.15; }, fmt: () => `${f0(C(op().feedT))} °C`, ev: () => `Feed ${f0(C(op().feedT))} °C` },
  cw: { get: () => op().coolingWaterLpm, set: v => { op().coolingWaterLpm = v; }, fmt: () => `${f1(op().coolingWaterLpm)} L/min`, ev: () => `Cooling ${f1(op().coolingWaterLpm)} L/min` },
  Erect: { get: () => op().murphreeFixed, set: v => { op().murphreeFixed = v; }, fmt: () => f2(op().murphreeFixed), ev: () => `Efficiency ${f2(op().murphreeFixed)}` },
  Estrip: { get: () => op().murphreeStrip, set: v => { op().murphreeStrip = v; }, fmt: () => f2(op().murphreeStrip), ev: () => `Efficiency ${f2(op().murphreeStrip)}` },
};
function followControls() { for (const id in FIELDS) { const F = FIELDS[id], el = $(id); if (document.activeElement !== el) { const v = String(+F.get().toFixed(3)); if (el.value !== v) el.value = v; } put(id + "-out", F.fmt()); } }
function syncControls() {
  followControls(); const c = S.col, cc = c.cfg.control;
  for (const name of ["top", "tray"]) { document.querySelectorAll(`[data-loop="${name}"] button`).forEach(b => b.setAttribute("aria-pressed", String(b.dataset.m === cc[name].mode)));
    $(name + "-Kc").value = cc[name].Kc; $(name + "-tauI").value = cc[name].tauI; $(name + "-sp").value = cc[name].sp == null ? "" : C(cc[name].sp).toFixed(1); }
  document.querySelectorAll("#faults button").forEach(b => b.setAttribute("aria-pressed", String(!!c.faults[b.dataset.f])));
  document.querySelectorAll("#runs button").forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.r === S.run)));
}
for (const id in FIELDS) { $(id).oninput = e => { FIELDS[id].set(+e.target.value); put(id + "-out", FIELDS[id].fmt()); }; $(id).onchange = () => { mark(FIELDS[id].ev()); refreshAll(true); }; }
$("runs").innerHTML = LAB_RUNS.map((r, k) => `<button class="btn" type="button" data-r="${k}" aria-pressed="false" title="Load the measured conditions of this lab run, at the model's steady state">${r.name}<small>${r.totalReflux ? "total reflux" : `feed ${f1(r.feedLpm)} L/min, reflux ${f1(r.L0 / r.D)}`}</small></button>`).join("");
$("runs").onclick = e => { const b = e.target.closest("button"); if (!b) return; const k = +b.dataset.r; loadColumn(restore(newColumn(k), INIT[k]), k); setChart("prof"); };
$("faults").onclick = e => { const b = e.target.closest("button"); if (!b) return; const f = b.dataset.f, on = !S.col.faults[f]; S.col.faults[f] = on; mark(`${b.textContent} ${on ? "" : "(cleared)"}`.trim()); syncControls(); refreshAll(true); };
document.querySelectorAll("[data-loop]").forEach(seg => seg.onclick = e => { const b = e.target.closest("button"); if (!b) return; const name = seg.dataset.loop; S.col.setLoopMode(name, b.dataset.m); mark(`${name === "top" ? "Reflux" : "Steam"} loop ${b.dataset.m}`); syncControls(); refreshAll(true); });
for (const name of ["top", "tray"]) {
  $(name + "-sp").onchange = e => { const v = parseFloat(e.target.value); if (Number.isFinite(v) && v > 60 && v < 110) { S.col.cfg.control[name].sp = v + 273.15; mark(`Set point ${f1(v)} °C`); } syncControls(); };
  for (const k of ["Kc", "tauI"]) $(`${name}-${k}`).onchange = e => { const v = parseFloat(e.target.value); if (Number.isFinite(v) && v > 0) S.col.cfg.control[name][k] = v; syncControls(); };
}
function loopReadouts() {
  const c = S.col, cc = c.cfg.control, o = c.cfg.operation;
  put("top-pv", `tray 4: ${f1(C(c.T[4]))} °C · reflux ${o.refluxRatio > 50 ? "total" : f2(o.refluxRatio)}`); put("tray-pv", `tray 5: ${f1(C(c.T[5]))} °C · steam ${f1(o.reboilerDuty / 1000)} kW`);
  put("lvl-pv", `Auto · level ${f0(c.reboilerLevel * 100)} % (set ${f0(o.reboilerLevelSP * 100)} %)`); void cc;
}
$("skip").onclick = () => { for (let k = 0; k < 6; k++) stepModel(300); S.acc = 0; refreshAll(true); };
$("redo").onclick = () => { const c = restore(newColumn(BASE_RUN), INIT[BASE_RUN]), old = S.col.cfg.control; for (const n of ["top", "tray"]) { Object.assign(c.cfg.control[n], { Kc: old[n].Kc, tauI: old[n].tauI }); }
  const modes = { top: old.top.mode, tray: old.tray.mode }; loadColumn(c, BASE_RUN, { pending: true }); for (const n of ["top", "tray"]) if (modes[n] === "auto") c.setLoopMode(n, "auto"); S.col.t = DISTURB.at - 20; prefillAt(S.col.t); syncControls(); setPlaying(true); flash("trend-strip"); };
function prefillAt(t) { const s0 = sample(t); S.hist.length = 0; for (let q = t - WINDOW; q <= t; q += SAMPLE) S.hist.push({ ...s0, t: q }); S.lastSample = t; }
let playing = true; const setPlaying = v => { playing = v; $("play").textContent = v ? "Pause" : "Play"; };
$("play").onclick = () => setPlaying(!playing);
$("reset").onclick = () => { $("rate").value = String(DEFAULT_RATE); loadColumn(restore(newColumn(BASE_RUN), INIT[BASE_RUN]), BASE_RUN, { pending: true }); $("ps-bar").hidden = true; setPlaying(true); goTo("overview"); };

// ---------------- problem-set set-ups (#ps-<course>-<k>, also #ps=<course>-<k>) ----------------
function applySetup() {
  const m = location.hash.match(/^#ps[-=]((?:\d+|int))-(\d+)/); if (!m) return false;
  const id = `${m[1]}-${m[2]}`, P = PS_SETUPS[id]; if (!P) return false;
  loadColumn(buildSetup(id), P.run); setPlaying(false); $("rate").value = String(P.speed || DEFAULT_RATE);
  if (P.chart) setChart(P.chart); if (P.panel) setFold($(P.panel), true); if (P.view) goTo(P.view, true);
  const pb = $("ps-bar"); pb.hidden = false; pb.innerHTML = `<b>Problem ${m[1] === "int" ? "Integrative" : "CBE " + m[1]}.${m[2]} loaded:</b> ${P.note}; paused. <a href="../problems/#distill-${m[1] === "int" ? "Integrative" : m[1]}" target="_blank" rel="noopener">Problem text ↗</a>`;
  try { localStorage.setItem("distill-intro-seen", "1"); } catch (e) {}
  return true;
}

// ---------------- trend strip (Part R): in the footer on desktop, right below the stage on phones ----------------
{ const strip = $("trend-strip"), mq = matchMedia("(max-width: 860px)"), foot = document.querySelector("footer");
  const place = () => { if (mq.matches) stage.after(strip); else foot.prepend(strip); requestAnimationFrame(() => refreshAll(true)); };
  mq.addEventListener("change", place); if (mq.matches) stage.after(strip); }

// ---------------- user guide, pop-out side panel ----------------
const guideSeen = () => { $("open-guide").classList.add("seen"); try { localStorage.setItem("twin-guide-seen", "1"); } catch (e) {} };
try { if (localStorage.getItem("twin-guide-seen") === "1") $("open-guide").classList.add("seen"); } catch (e) {}
$("open-guide").onclick = () => { guideSeen(); $("gd-panel").hidden = false; $("gd-close").focus(); };
$("gd-close").onclick = () => { $("gd-panel").hidden = true; };
$("gd-panel").addEventListener("click", e => { if (e.target.id === "gd-panel") $("gd-panel").hidden = true; });
const asideEl = document.querySelector("aside"), mainEl = document.querySelector("main"), popBtn = $("pop-btn");
function setPop(on, save = true) {
  if (phone()) on = false;
  asideEl.classList.toggle("popped", on); mainEl.classList.toggle("pop", on);
  popBtn.textContent = on ? "⤡" : "⤢"; popBtn.title = on ? "Dock this panel back at the right" : "Pop this panel out as a floating window"; popBtn.setAttribute("aria-label", popBtn.title);
  if (on) { const W = Math.min(620, innerWidth - 16); asideEl.style.width = W + "px"; asideEl.style.height = Math.round(innerHeight * 0.8) + "px"; asideEl.style.left = (innerWidth - W - 24) + "px"; asideEl.style.top = Math.round(innerHeight * 0.1) + "px"; }
  else asideEl.style.cssText = "";
  if (save) try { localStorage.setItem("distill-panel-pop", on ? "1" : "0"); } catch (e) {}
  requestAnimationFrame(() => resize());
}
popBtn.onclick = () => setPop(!asideEl.classList.contains("popped"));
$("aside-bar").addEventListener("pointerdown", e => {
  if (!asideEl.classList.contains("popped") || e.target.closest("button")) return; const r = asideEl.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top;
  const mv = ev => { asideEl.style.left = Math.max(0, Math.min(innerWidth - 80, ev.clientX - ox)) + "px"; asideEl.style.top = Math.max(0, Math.min(innerHeight - 40, ev.clientY - oy)) + "px"; };
  const up = () => { removeEventListener("pointermove", mv); removeEventListener("pointerup", up); }; addEventListener("pointermove", mv); addEventListener("pointerup", up); e.preventDefault();
});

// ---------------- loop ----------------
function resize() { const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); POST.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); refreshAll(true); }
setMode("x"); chart = "mt"; setChartLegendOnly();
function setChartLegendOnly() { const c = chart; chart = c; document.querySelectorAll("#chart-seg button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.c === c))); }
S.col = restore(newColumn(BASE_RUN), INIT[BASE_RUN]); prefill(); fitAxes(true); S.sum = summary(S.col);
syncControls(); setChart("mt"); goTo("overview", true);
document.querySelectorAll("[data-tex]").forEach(e => { e.innerHTML = MP.tex(e.dataset.tex); });   // static labels with math
new ResizeObserver(resize).observe(stage);
new ResizeObserver(() => refreshAll(true)).observe(asideEl);
const hadSetup = applySetup(); window.addEventListener("hashchange", applySetup);
try { if (localStorage.getItem("distill-panel-pop") === "1") setPop(true, false); } catch (e) {}
{ let seen = false; try { seen = localStorage.getItem("distill-intro-seen") === "1"; } catch (e) {} if (!seen && !hadSetup && !phone()) openIntro(); }

let last = performance.now(), uiT = 0;
renderer.setAnimationLoop(now => {
  const real = Math.min((now - last) / 1000, 1), dt = Math.min(real, 0.1); last = now;   // the model follows real time even when frames are slow
  if (playing) { stepModel(real * +$("rate").value); if (now - uiT > 240) { uiT = now; refreshAll(false); } }
  if (tween) { const u = Math.min((now - tween.t0) / tween.dur, 1), e = u * u * (3 - 2 * u);
    camera.position.lerpVectors(tween.from.p, tween.to.p, e); controls.target.lerpVectors(tween.from.c, tween.to.c, e); camera.fov = tween.from.fov + (tween.to.fov - tween.from.fov) * e; camera.updateProjectionMatrix(); if (u >= 1) tween = null; }
  SC.update(visual(), playing ? dt : 0, playing ? now / 1000 : uiT / 1000);
  if (beacon.visible) { beacon.quaternion.copy(camera.quaternion); const k = 1 + 0.15 * Math.sin(now / 220); beacon.children[0].scale.setScalar(k); }
  controls.update(); fitShadow(); POST.render(dt); placeSpots();
});
window.__twin = { S, goTo, openLens, closeLens, toggleCourses, toggleResearch, MP, setChart, setMode, camera, controls, renderer, scene, SC, applySetup, setPlaying, setPop, stepModel, refreshAll, loadColumn, POST, GO };
