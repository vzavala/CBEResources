// Lava Lamp Digital Twin: page logic. Model in model.js, text in content.js, 3D in scene.js, charts in plot.js.
import { U, initUnits } from "./units.js";
import * as M from "./model.js";
import { REFS, SPOTS, CARDS, REALWORLD, TOPICS, INVESTIGATIONS, FAM, FEATURES, COURSES, EQ_GROUPS, PARAM_ROWS, LIMITS, RESEARCH, CENTERS } from "./content.js";
import { makeScene } from "./scene.js";
import { plot } from "./plot.js";
import { initPhase, PH, kitchenMasses, oilSplit } from "./phase_ui.js";
import * as PE from "./phase.js";
import { SALT } from "./phase_data.js";

const PS_URL = "../problems/", APP = "lamp";   // problem-set page of the collection
const $ = id => document.getElementById(id);
const fx = (v, d = 1) => Number.isFinite(v) ? v.toFixed(d) : "–";
const hm = t => { const m = Math.floor(t / 60); return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min` : `${m} min ${String(Math.floor(t % 60)).padStart(2, "0")} s`; };
const K = (t, d = false) => { try { return window.katex.renderToString(t, { displayMode: d, output: "html", throwOnError: false }); } catch (e) { return t; } };
const rich = s => String(s).replace(/\$([^$]+)\$/g, (m, t) => K(t)).replace(/\[(\d+)\]/g, (m, n) => `<sup class="refsup"><a href="#ref-${n}" class="ref" data-ref="${n}">${n}</a></sup>`);
const DS = [0.020, 0.023, 0.025, 0.027, 0.030, 0.032], BCOL = ["#c5050c", "#1f6fd1", "#1f8a4c", "#b26a00", "#7a3fb5", "#0e8f9a"];
const St = { shake: null, clearH: 3, hD: [], cond: M.normCond({}), Tb: 22, Tt: 22, t: 0, blobs: [], running: true, speed: 10, hT: [], hZ: [], first: null, mode: "warm", card: null, tour: null, mine: { eta: null }, t0: 0 };
const lab = makeScene($("lamp-pane"), DS.length, $("blob-pane"));   // the blob pane is optional: off until "Blob view" is pressed

// ====================== simulation ======================
function resetBlobs(T) { St.blobs = DS.map(d => ({ z: 0, T, d, v: 0 })); }
// shake: the wax becomes N0 droplets that merge by second-order kinetics until six blobs are left (model.js)
function shakeNow() { const N0 = M.shakeN0(M.waxVolume(DS)); St.shake = { t: 0, N0, kN0: M.shakeRate(N0, St.clearH * 3600), N: N0, d: M.SHAKE.d0 }; St.hD = [{ t: 0, d: M.SHAKE.d0 * 1000 }]; St.running = true; if (St.speed < 60) { St.speed = 60; $("rate").value = "60"; } syncUI(); }
function stepShake(h) { const k = St.shake; k.t += h; k.N = M.shakeN(k.N0, k.kN0, k.t); k.d = M.shakeD(k.N0, k.N); if (k.t - St.hD[St.hD.length - 1].t >= 10) St.hD.push({ t: k.t, d: k.d * 1000 }); if (k.N <= M.SHAKE.nEnd) { St.shake = null; St.lastShake = { t: k.t }; resetBlobs(St.Tb); { const dd = lab.shakeDrops(); St.blobs.forEach((b, i) => { const q = dd[i]; if (q) { b.z = Math.min(St.cond.H, Math.max(0, q.u * St.cond.H)); b.T = M.liqT(b.z, St.Tb, St.Tt, St.cond.H); } }); }   /* the six blobs start where the last six droplets were */ St.hZ = []; if (St.speed > 10) { St.speed = 10; $("rate").value = "10"; } } }
function advance(dtLab, record = true) { let left = dtLab; while (left > 1e-9) { const h = Math.min(left, 2); const s = M.stepT({ Tb: St.Tb, Tt: St.Tt }, St.cond, h); St.Tb = s.Tb; St.Tt = s.Tt; if (St.shake) { stepShake(h); St.t += h; left -= h; if (record && St.t - (St.hT.length ? St.hT[St.hT.length - 1].t : -1e9) >= 10) St.hT.push({ t: St.t, Tb: St.Tb, Tt: St.Tt }); continue; }
    for (const b of St.blobs) { const z0 = b.z, n = M.stepBlob(b, St.Tb, St.Tt, St.cond, h, b.d); b.z = n.z; b.T = n.T; b.v = (b.z - z0) / h; if (St.first == null && b.z > 0.02 && St.mode === "cold") St.first = St.t + h; }
    St.t += h; left -= h; if (record && St.t - (St.hT.length ? St.hT[St.hT.length - 1].t : -1e9) >= 10) { St.hT.push({ t: St.t, Tb: St.Tb, Tt: St.Tt }); St.hZ.push({ t: St.t, z: St.blobs.map(b => b.z) }); if (St.hT.length > 4000) { St.hT.splice(0, 1000); St.hZ.splice(0, 1000); } } } }
function startCold() { St.shake = null; St.mode = "cold"; St.t = 0; St.t0 = 0; St.Tb = St.Tt = St.cond.Tr; St.hT = []; St.hZ = []; St.first = null; resetBlobs(St.cond.Tr); advance(1e-6); St.running = true; if (St.speed < 60) { St.speed = 60; $("rate").value = "60"; } syncUI(); }
function jumpWarm() { St.shake = null; St.mode = "warm"; const s = M.steady(St.cond); St.Tb = s.Tb; St.Tt = s.Tt; St.hT = []; St.hZ = []; St.first = null; resetBlobs(s.Tt); St.blobs.forEach((b, i) => { b.T = s.Tt + (s.Tb - s.Tt) * (i / DS.length); }); St.t = 6 * 3600 - 1500; St.t0 = St.t; advance(1500); St.running = true; if (St.speed > 10) { St.speed = 10; $("rate").value = "10"; } syncUI(); }
function setCond(c) { St.cond = M.normCond({ ...St.cond, ...c }); syncControls(); drawMap(); syncUI(); }
const regimeNow = () => { if (St.shake) return "shaken"; const r = M.regime(St.Tb, St.Tt, St.cond); if (r === "cold" && M.regimeSteady(St.cond) !== "cold" && St.mode === "cold") return "warming"; return r; };
const RNAME = { shaken: "Shaken", cold: "Too cold", warming: "Warming up", flowing: "Flowing", overheated: "Overheated" }, RCLS = { shaken: "warm", cold: "cold", warming: "warm", flowing: "go", overheated: "hot" };

// ====================== controls and readouts ======================
function syncControls() { const c = St.cond; $("pw").value = c.P; $("tr").value = c.Tr; $("tx").value = c.Tx; $("eta").value = c.eta; $("bw").value = c.bW * 1e4; $("bl").value = c.bL * 1e4; $("cd").value = c.Cd; $("bw-out").textContent = `${fx(c.bW * 1e4)} × 10⁻⁴ /K`; $("bl-out").textContent = `${fx(c.bL * 1e4)} × 10⁻⁴ /K`; $("cd-out").textContent = `${c.Cd}`;
  $("pw-out").textContent = `${c.P} W`; $("tr-out").textContent = `${c.Tr} °C`; $("tx-out").textContent = `${c.Tx} °C`; $("eta-out").textContent = `${Math.round(c.eta * 100)} %`; }
function TK(id, html) { const el = $(id); if (!el) return; const h = html ? `<b>What this means</b>${html}` : ""; if (el.innerHTML !== h) el.innerHTML = h; }
let perCache = { key: "", per: null, rise: null, warm: null, win: null };
function derived() { const c = St.cond, key = JSON.stringify(c); if (perCache.key !== key) perCache = { key, per: M.cyclePeriod(c), rise: M.riseTime(c), warm: M.warmupMin(c), win: M.windowTr(c) }; return perCache; }
function syncUI() { const c = St.cond, r = regimeNow(), d = derived(), ss = M.steady(c), st = $("r-status"); st.textContent = RNAME[r]; st.className = "status-chip " + RCLS[r];
  $("r-t").textContent = hm(St.t); $("r-tb").textContent = `${fx(St.Tb)} °C`; $("r-tt").textContent = `${fx(St.Tt)} °C`; $("r-tx").textContent = `${c.Tx} °C`;
  $("r-first").textContent = St.mode !== "cold" ? "start from cold to time it" : St.first != null ? hm(St.first) : "not yet"; $("r-per").textContent = d.per ? `${fx(d.per / 60)} min` : "no flow";
  $("clock").textContent = hm(St.t); $("play").textContent = St.running ? "Pause" : "Play";
  $("tag").textContent = `${c.P} W · room ${c.Tr} °C · bottom ${fx(St.Tb)} °C · top ${fx(St.Tt)} °C · match ${c.Tx} °C`;
  const sr = M.regime(ss.Tb, ss.Tt, c); let s;
  $("r-shake").textContent = St.shake ? `${Math.round(St.shake.N).toLocaleString("en-US")} droplets, about ${fx(St.shake.d * 1000)} mm` : St.lastShake ? `gathered again in ${hm(St.lastShake.t)}` : "not shaken"; $("clear-out").textContent = `${St.clearH} h`;
  if (r === "shaken") { const k = St.shake; s = `${hm(k.t)} after the shake: ${Math.round(k.N).toLocaleString("en-US")} droplets of about ${fx(k.d * 1000)} mm. Merging is fast at first, when droplets are crowded, and slows as fewer are left. The liquid clears as they grow.`; }
  else if (r === "warming") s = `The bottom must pass ${c.Tx} °C before wax can float. Expect the first blob about ${fx(d.warm / 60)} h after switch-on.`;
  else if (sr === "cold") s = `The bottom settles at ${fx(ss.Tb)} °C, below the ${c.Tx} °C the wax needs to float. Try a stronger bulb or a warmer room${c.fan ? ", or switch the fan off" : ""}.`;
  else if (sr === "overheated") s = `Even the top settles at ${fx(ss.Tt)} °C, above ${c.Tx} °C, so warm wax never becomes heavy enough to sink. Use a weaker bulb or a cooler room.`;
  else s = `Bottom ${fx(ss.Tb)} °C, top ${fx(ss.Tt)} °C: the matching point (${c.Tx} °C) sits between them, so wax rises warm and sinks cool, about once every ${fx(d.per / 60, 0)} min per blob.`;
  TK("tk-now", s);
  const gap = M.dRho(ss.Tb, ss.Tb, c.Tx, c.bW, c.bL), pk = 1000 * gap / M.PARAMS.rhoX; TK("tk-prop", c.bW <= c.bL ? "The wax now expands no more than the liquid, so heating never makes it the lighter one: no blobs can rise. A lamp needs a wax that swells more than its liquid." : `At the bottom the wax is ${fx(Math.abs(gap), 1)} kg/m³ ${gap > 0 ? "lighter" : "heavier"} than the liquid (${fx(Math.abs(pk), 1)} parts per thousand). A bigger difference in expansion gives a bigger push; more drag makes blobs slower${d.rise ? `: now ${fx(d.rise, 0)} s to the top` : ""}.`);
  drawStrip(); }
for (const [id, key, k] of [["pw", "P", 1], ["tr", "Tr", 1], ["tx", "Tx", 1], ["eta", "eta", 1], ["bw", "bW", 1e-4], ["bl", "bL", 1e-4], ["cd", "Cd", 1]]) $(id).oninput = e => setCond({ [key]: +e.target.value * k });
$("prop-reset").onclick = () => { setCond({ Tx: M.PARAMS.Tx, bW: M.PARAMS.betaW, bL: M.PARAMS.betaL, Cd: M.PARAMS.Cd, eta: M.PARAMS.eta }); jumpWarm(); };
$("col-wax").oninput = $("col-liq").oninput = () => lab.setColors($("col-wax").value, $("col-liq").value);
// thermal camera view: false colours from the model's temperatures, with a colour scale over the stage
function setView(mode) { const on = mode === "thermal"; document.querySelectorAll("#view-seg button").forEach(b => b.setAttribute("aria-pressed", b.dataset.v === mode)); lab.setThermal(on); $("th-scale").hidden = !on; }
$("view-seg").onclick = e => { const v = e.target.dataset?.v; if (v) setView(v); };
{ const [lo, hi] = lab.thermalRange; $("th-bar").style.background = `linear-gradient(90deg, ${lab.thermalStops.map(([u, c]) => `${c} ${Math.round(u * 100)}%`).join(", ")})`; $("th-lo").textContent = `${lo} °C`; $("th-hi").textContent = `${hi} °C`; }
$("shake").onclick = shakeNow; $("clear").oninput = e => { St.clearH = +e.target.value; if (St.shake) St.shake.kN0 = M.shakeRate(St.shake.N0, St.clearH * 3600); syncUI(); };
$("cold").onclick = startCold; $("warm").onclick = jumpWarm; $("play").onclick = () => { St.running = !St.running; syncUI(); }; $("rate").onchange = e => { St.speed = +e.target.value; };
$("reset").onclick = () => { St.cond = M.normCond({}); St.mine.eta = null; $("col-wax").value = "#7a3fe0"; $("col-liq").value = "#e6eeff"; lab.setColors("#7a3fe0", "#e6eeff"); syncControls(); jumpWarm(); drawMap(); renderMine(); lab.goView("overview"); closeCard(); };
$("inv-list").innerHTML = INVESTIGATIONS.map(v => `<li><b>${v.q}</b><span>${rich(v.how)}</span><div class="row"><button class="btn" type="button" data-inv="${v.id}">${v.mine ? "Go to My real lamp" : v.go ? "Open the Phase lab" : "Set it up"}</button></div></li>`).join("");
$("inv-list").onclick = e => { const b = e.target.closest("button[data-inv]"); if (!b) return; const v = INVESTIGATIONS.find(x => x.id === b.dataset.inv); if (v.mine) { $("sec-mine").scrollIntoView({ behavior: "smooth", block: "start" }); return; } if (v.go) { jump(v.go); return; } if (v.shake) { setCond(v.set); jumpWarm(); shakeNow(); return; } setCond(v.set); v.cold ? startCold() : jumpWarm(); $("sec-setup").scrollIntoView({ block: "nearest" }); };

// ====================== conditions map ======================
const MP = [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60], MT = [34, 31, 28, 25, 22, 19, 16, 13, 10], MCOL = { cold: "#cfe0f7", flowing: "#bfe5cc", overheated: "#f6c7c9" };
let mapGeo = null;
const mTr = () => U.toC(+$("m-tr").value), setMTr = c => { const F = U.unit === "F", el = $("m-tr"); el.min = F ? 41 : 5; el.max = F ? 104 : 40; el.step = F ? 1 : 0.5; el.value = F ? Math.round(U.T(c)) : Math.round(c * 2) / 2; };   // the "my real lamp" room temperature is typed in the unit on show
function drawMap() { const cv = $("map"), w = cv.clientWidth, h = cv.clientHeight; if (!w) return; const d = Math.min(devicePixelRatio || 1, 2); cv.width = w * d; cv.height = h * d; const g = cv.getContext("2d"); g.setTransform(d, 0, 0, d, 0, 0);
  const pad = { l: 44, r: 6, t: 6, b: 30 }, cw = (w - pad.l - pad.r) / MP.length, ch = (h - pad.t - pad.b) / MT.length; mapGeo = { pad, cw, ch }; g.clearRect(0, 0, w, h); g.fillStyle = "#fff"; g.fillRect(0, 0, w, h);
  MT.forEach((Tr, j) => MP.forEach((P, i) => { g.fillStyle = MCOL[M.regimeSteady({ ...St.cond, P, Tr })]; g.fillRect(pad.l + i * cw + 0.5, pad.t + j * ch + 0.5, cw - 1, ch - 1); }));
  g.fillStyle = "#5d6875"; g.font = '10.5px "JetBrains Mono", monospace'; g.textAlign = "center"; g.textBaseline = "top"; MP.forEach((P, i) => { if (i % 2 === 0) g.fillText(P, pad.l + (i + 0.5) * cw, h - pad.b + 3); });
  g.textAlign = "right"; g.textBaseline = "middle"; MT.forEach((Tr, j) => { if (j % 2 === 0) g.fillText(Math.round(U.T(Tr)), pad.l - 4, pad.t + (j + 0.5) * ch); });
  g.fillStyle = "#1d2733"; g.font = "500 11px Barlow, sans-serif"; g.textAlign = "center"; g.textBaseline = "bottom"; g.fillText("bulb power, W", pad.l + (w - pad.l - pad.r) / 2, h - 1); g.save(); g.translate(10, pad.t + (h - pad.t - pad.b) / 2); g.rotate(-Math.PI / 2); g.textBaseline = "middle"; g.fillText("room, " + U.sym(), 0, 0); g.restore();
  const X = P => pad.l + ((P - 10) / 5 + 0.5) * cw, Y = Tr => pad.t + ((34 - Tr) / 3 + 0.5) * ch; g.fillStyle = "#1d2733"; g.beginPath(); g.arc(X(St.cond.P), Y(St.cond.Tr), 5, 0, 6.283); g.fill(); g.strokeStyle = "#fff"; g.lineWidth = 1.5; g.stroke();
  const mp = +$("m-p").value, mt = mTr(); if ($("m-flow").value || $("m-warm").value) { g.fillStyle = "#c5050c"; g.font = "700 16px Barlow, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("★", Math.max(pad.l + 6, Math.min(w - 8, X(mp))), Math.max(pad.t + 6, Math.min(h - pad.b - 6, Y(mt)))); }
  const win = derived().win; TK("tk-map", win ? `With this ${St.cond.P} W bulb the lamp flows in rooms from about ${fx(win[0], 0)} to ${fx(win[1], 0)} °C. Makers recommend 20 to 24 °C. Click a square to try it.` : `No room between 10 and 34 °C makes this ${St.cond.P} W bulb work${St.cond.fan ? " with the fan on" : ""}. Click a green square to see one that does.`); }
$("map").onclick = e => { if (!mapGeo) return; const r = $("map").getBoundingClientRect(), i = Math.floor((e.clientX - r.left - mapGeo.pad.l) / mapGeo.cw), j = Math.floor((e.clientY - r.top - mapGeo.pad.t) / mapGeo.ch); if (i < 0 || j < 0 || i >= MP.length || j >= MT.length) return; setCond({ P: MP[i], Tr: Math.min(35, MT[j]) }); jumpWarm(); };

// ====================== my real lamp ======================
function rise10(cond) { const c = M.normCond(cond), s = M.steady(c); if (M.regime(s.Tb, s.Tt, c) !== "flowing") return null; let b = { z: 0, T: s.Tb }, t = 0; while (b.z < 0.10 && t < 3000) { b = M.stepBlob(b, s.Tb, s.Tt, c, 0.5); t += 0.5; } return t < 3000 ? t : null; }
function renderMine() { const P = +$("m-p").value, Tr = mTr(), flow = $("m-flow").value, ow = +$("m-warm").value || null, or = +$("m-rise").value || null, base = { ...St.cond, P, Tr, eta: St.mine.eta ?? St.cond.eta }, reg = M.regimeSteady(base), mw = M.warmupMin(base), mr = rise10(base);
  const pct = (a, b) => a && b ? `${a > b ? "+" : ""}${fx(100 * (a - b) / b, 0)} %` : "–", rn = { flowing: "flows", cold: "stays down", overheated: "stays up" };
  $("mine-out").innerHTML = `<table class="lg-tab"><thead><tr><th>Quantity</th><th>My lamp</th><th>Twin${St.mine.eta ? " (tuned)" : ""}</th><th>Twin − lamp</th></tr></thead><tbody>
    <tr><td>When warm, the wax</td><td>${flow ? rn[flow] : "–"}</td><td>${rn[reg]}</td><td>${flow ? (flow === reg ? "agrees" : "disagrees") : "–"}</td></tr>
    <tr><td>First blob, min</td><td>${ow ?? "–"}</td><td>${mw ? fx(mw, 0) : "never"}</td><td>${pct(mw, ow)}</td></tr>
    <tr><td>Climb 10 cm, s</td><td>${or ?? "–"}</td><td>${mr ? fx(mr, 0) : "no flow"}</td><td>${pct(mr, or)}</td></tr></tbody></table>`;
  let s = ""; if (!flow && !ow && !or) s = "Enter what you measured. The twin uses the same bulb power and room temperature as your lamp.";
  else if (St.mine.eta) s = `Tuned: ${Math.round(St.mine.eta * 100)} % of the bulb's heat reaches the liquid (it was ${Math.round(M.PARAMS.eta * 100)} %). ${or && mr ? (Math.abs(mr - or) / or < 0.3 ? "The tuned twin then predicts your blob time within 30 %: a real test passed." : "But it still misses your blob time by more than 30 %: the blob model (drag, size) needs work, not the heating.") : "Now time a blob: that is a test the tuning did not use."}`;
  else if (flow && flow !== reg) s = `The twin says the wax ${rn[reg]}, but yours ${rn[flow]}. Your lamp's recipe or heat loss differs from the assumed one: try the fluid-property sliders.`;
  else s = `${flow ? "The twin agrees on whether it flows. " : ""}${ow && mw ? `Its warm-up is ${fx(Math.abs(100 * (mw - ow) / ow), 0)} % ${mw > ow ? "longer" : "shorter"} than yours. Tune one number to fit it, then test the blob time.` : "Add your warm-up time to tune the twin."}`;
  TK("tk-mine", s); drawMap(); }
for (const id of ["m-p", "m-tr", "m-flow", "m-warm", "m-rise"]) $(id).oninput = () => { St.mine.eta = null; renderMine(); };
$("m-tune").onclick = () => { const ow = +$("m-warm").value; if (!ow) { TK("tk-mine", "Enter the minutes to the first rising blob first."); return; } const e = M.fitEta(ow, { ...St.cond, P: +$("m-p").value, Tr: mTr() }); if (e == null) { TK("tk-mine", "Even with all the bulb's heat reaching the liquid, the twin cannot warm up that fast. Check the bulb power and the timing."); return; } St.mine.eta = e; renderMine(); };
$("m-use").onclick = () => { setCond({ P: Math.max(10, Math.min(60, Math.round(+$("m-p").value / 5) * 5)), Tr: Math.max(10, Math.min(35, Math.round(mTr()))), ...(St.mine.eta ? { eta: St.mine.eta } : {}) }); jumpWarm(); };

// ====================== footer charts ======================
function drawStrip() { const c = St.cond, cold = St.mode === "cold", d = derived(), W = cold ? Math.max(60 * (d.warm ? d.warm * 1.5 : 240), St.t) : 1500, x1 = cold ? W : Math.max(St.t, St.t0 + W), x0 = cold ? 0 : x1 - W, u = cold ? 3600 : 60, ss = M.steady(c);
  const hT = St.hT.filter(p => p.t >= x0), lo = Math.min(c.Tr, 20) - 2, hi = Math.max(ss.Tb, c.Tx, ...hT.map(p => p.Tb)) + 4;
  plot($("ch-t"), { series: [{ pts: hT.map(p => [p.t / u, U.T(p.Tb)]), color: "#c5050c" }, { pts: hT.map(p => [p.t / u, U.T(p.Tt)]), color: "#1f6fd1" }], xr: [x0 / u, x1 / u], yr: [U.T(lo), U.T(hi)], xl: cold ? "time since switch-on, h" : "time since switch-on, min", hlines: [{ y: U.T(c.Tx), color: "#5d6875" }], marks: cold && St.first != null ? [{ x: St.first / u, label: "first blob" }] : [] });
  if (St.shake) { $("lbl-z").textContent = "Droplet size after the shake, mm"; $("lbl-z").nextElementSibling.textContent = "typical droplet"; plot($("ch-z"), { series: [{ pts: St.hD.map(p => [p.t / 60, p.d]), color: "#c5050c" }], xr: [0, St.clearH * 60], yr: [0, 30], xl: "time since the shake, min" }); return; } $("lbl-z").textContent = "Blob height, cm"; $("lbl-z").nextElementSibling.textContent = "One line per blob";
  const zx0 = Math.max(x0, x1 - 1500), hZ = St.hZ.filter(p => p.t >= zx0); plot($("ch-z"), { series: DS.map((_, i) => ({ pts: hZ.map(p => [(p.t - (cold ? 0 : 0)) / 60, p.z[i] * 100]), color: BCOL[i], w: 1.4 })), xr: [zx0 / 60, x1 / 60], yr: [0, c.H * 100 + 1], xl: "time since switch-on, min" }); }

// ====================== screens in the 3D scene ======================
function drawScreens() { let s = lab.screens.thermo, g = s.canvas.getContext("2d"); g.fillStyle = "#d9e2d2"; g.fillRect(0, 0, 256, 160); g.fillStyle = "#1c2420"; g.font = "700 78px 'JetBrains Mono', monospace"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(`${Math.round(U.T(St.cond.Tr))}${U.sym()}`, 128, 76); g.font = "600 20px Barlow, sans-serif"; g.fillText("ROOM", 128, 136); s.tex.needsUpdate = true;
  s = lab.screens.notes; g = s.canvas.getContext("2d"); g.fillStyle = "#fbfaf4"; g.fillRect(0, 0, 256, 340); g.strokeStyle = "#c9d6e8"; for (let y = 60; y < 330; y += 26) { g.beginPath(); g.moveTo(14, y); g.lineTo(242, y); g.stroke(); } g.fillStyle = "#1d2733"; g.font = "700 22px Barlow, sans-serif"; g.textAlign = "left"; g.fillText("My real lamp", 16, 38); g.font = "500 17px Barlow, sans-serif";
  [`bulb: ${$("m-p").value} W`, `room: ${$("m-tr").value} ${U.sym()}`, `first blob: ${$("m-warm").value || "__"} min`, `10 cm climb: ${$("m-rise").value || "__"} s`, `flows? ${$("m-flow").selectedOptions[0]?.text || "–"}`].forEach((t, i) => g.fillText(t, 18, 80 + i * 26)); s.tex.needsUpdate = true; }

// ====================== spots and cards ======================
const spotEls = SPOTS.map((s, i) => { const b = document.createElement("button"); b.className = "spot"; b.type = "button"; b.innerHTML = `${i + 1}<span>${s.title}</span>`; b.setAttribute("aria-label", `Spot ${i + 1}: ${s.title}`); b.onclick = () => openSpot(s.id); $("spots").appendChild(b); return b; });
$("spot-list").innerHTML = SPOTS.map((s, i) => `<li><button type="button" data-spot="${s.id}"><i>${i + 1}</i><span>${s.title}</span></button></li>`).join("");
$("spot-list").onclick = e => { const b = e.target.closest("button"); if (b) openSpot(b.dataset.spot); };
$("st-toggle").onclick = () => { const on = $("spot-table").classList.toggle("collapsed"); $("st-toggle").setAttribute("aria-expanded", !on); $("st-toggle").lastElementChild.textContent = on ? "›" : "‹"; };
if (matchMedia("(max-width: 860px)").matches) $("st-toggle").click();
function placeSpots() { const W = $("lamp-pane").clientWidth, H = $("lamp-pane").clientHeight, pos = SPOTS.map(s => lab.project(lab.A[s.id])), out = pos.map(p => ({ x: p.x, y: p.y })), R = 36; let lines = "";
  for (let pass = 0; pass < 8; pass++) for (let i = 0; i < out.length; i++) for (let j = 0; j < i; j++) { const dx = out[i].x - out[j].x, dy = out[i].y - out[j].y, d = Math.hypot(dx, dy); if (d < R) { const ux = d > 0.5 ? dx / d : (i % 2 ? 1 : -1), uy = d > 0.5 ? dy / d : -0.3, m = (R - d) / 2 + 0.5; out[i].x += ux * m; out[i].y += uy * m; out[j].x -= ux * m; out[j].y -= uy * m; } }
  SPOTS.forEach((s, i) => { const p = pos[i], el = spotEls[i], vis = !p.behind && p.x > 8 && p.x < W - 8 && p.y > 8 && p.y < H - 8; el.style.display = vis ? "" : "none"; if (!vis) return; el.style.left = out[i].x + "px"; el.style.top = out[i].y + "px"; if (!document.body.classList.contains("spots-off") && Math.hypot(out[i].x - p.x, out[i].y - p.y) > 6) lines += `<line x1="${out[i].x}" y1="${out[i].y}" x2="${p.x}" y2="${p.y}"/><circle cx="${p.x}" cy="${p.y}" r="3"/>`; });
  // the red frame on the lamp and the two lines to the blob view: "you are zoomed in here"
  const f = lab.focusInfo(); if (St.multi && f.ok && f.rpx > 2 && !matchMedia("(max-width: 860px)").matches) { const r = Math.max(9, f.rpx); lines += `<rect class="zoom" x="${f.x - r}" y="${f.y - r}" width="${2 * r}" height="${2 * r}" rx="3"/><line class="zoom" x1="${f.x + r}" y1="${f.y - r}" x2="${W}" y2="0"/><line class="zoom" x1="${f.x + r}" y1="${f.y + r}" x2="${W}" y2="${H}"/>`; }
  if ($("spot-leaders").innerHTML !== lines) $("spot-leaders").innerHTML = lines; }
// ---------- blob view: which blob, and what is happening at its surface ----------
function pickFocus() { if (St.shake) return -1; if (St.focusPick != null) return St.focusPick; let best = St.focusAuto ?? 0, bv = 0; St.blobs.forEach((b, i) => { const v = Math.abs(b.v || 0); if (v > bv) { bv = v; best = i; } }); if (bv > 1e-4) St.focusAuto = best; return St.focusAuto ?? 0; }
$("bv-next").onclick = () => { St.focusPick = ((St.focusPick ?? pickFocus()) + 1) % DS.length; updateBlobView(); };
function updateBlobView() { const i = pickFocus(), c = St.cond, R = $("bv-read"), A = $("bv-arrows"); let rows, title, up = 0, drag = 0;
  if (i < 0) { const k = St.shake; title = "Blob view: droplets after the shake"; rows = [["Droplets", Math.round(k.N).toLocaleString("en-US")], ["Typical size", `${fx(k.d * 1000)} mm`], ["Liquid here", `${fx((St.Tb + St.Tt) / 2)} °C`]]; }
  else { const b = St.blobs[i], Tl = M.liqT(b.z, St.Tb, St.Tt, c.H), rw = M.rhoWx(b.T, c.Tx, c.bW), rl = M.rhoLx(Tl, c.Tx, c.bL), gap = rl - rw, v = b.v || 0, state = b.z <= 0 ? "resting in the pool, warming" : b.z >= c.H ? "resting at the top, cooling" : v > 0 ? "rising" : "sinking";
    title = `Blob view: blob ${i + 1}, ${state}`; up = Math.max(-1, Math.min(1, gap / 4)); drag = Math.abs(v) > 1e-4 ? -Math.sign(v) * Math.min(1, Math.abs(v) / 0.02) : 0;
    rows = [["Wax here", `${fx(b.T)} °C`], ["Liquid here", `${fx(Tl)} °C`], ["Wax density", `${fx(rw, 1)} kg/m³`], ["Liquid density", `${fx(rl, 1)} kg/m³`], [gap >= 0 ? "Wax is lighter by" : "Wax is heavier by", `${fx(Math.abs(gap), 1)} kg/m³`], ["Speed", `${fx(Math.abs(v) * 1000)} mm/s ${v > 1e-4 ? "up" : v < -1e-4 ? "down" : ""}`]]; }
  if ($("bv-title").textContent !== title) $("bv-title").textContent = title; const h = rows.map(r => `<dt>${r[0]}</dt><dd>${r[1]}</dd>`).join(""); if (R.innerHTML !== h) R.innerHTML = h;
  const arrow = (x, len, col, label) => { if (Math.abs(len) < 0.03) return ""; const y0 = 75, y1 = 75 - len * 55, s = Math.sign(len); return `<line x1="${x}" y1="${y0}" x2="${x}" y2="${y1 + s * 7}" stroke="${col}" stroke-width="4" stroke-linecap="round"/><path d="M${x - 7} ${y1 + s * 9} L${x} ${y1} L${x + 7} ${y1 + s * 9} Z" fill="${col}"/><text x="${x}" y="${s > 0 ? y0 + 13 : y0 - 6}" text-anchor="middle" font-size="9" font-weight="600" fill="${col}">${label}</text>`; };
  const svg = arrow(17, up, "#c5050c", up >= 0 ? "push up" : "pull down") + arrow(44, drag, "#1f6fd1", "drag"); if (A.innerHTML !== svg) A.innerHTML = svg; }
function openSpot(id) { const s = SPOTS.find(x => x.id === id); if (!s) return; St.tour = null; setChips(null); lab.goView(s.view); showCard(s.card); }
const eqByN = n => EQ_GROUPS.flatMap(g => g.eqs).find(q => q.n === n);
function phaseLive() { const m = kitchenMasses(PH.k), r = PE.saltSplit(SALT, m.mW, m.mA, m.mS), cl = PE.saltCloud(SALT, m.mW, m.mA), o = PH.o, tot = o.water + o.eth + o.oil, q = tot ? oilSplit(o) : null;
  return { oil: q ? (q.two ? `your mix (${o.water} g water, ${o.eth} g ethanol, ${o.oil} g oil) splits into two layers` : "your mix is one liquid") : "empty", oil2: q && q.two ? `layers: ${fx(q.layers[1].vol, 0)} mL on top of ${fx(q.layers[0].vol, 0)} mL; ${fx(100 * q.beta, 0)} % of the moles in the oil layer` : "one liquid: no split to compute",
    kit: cl ? `your kitchen mix needs about ${fx(cl)} g of salt for a second layer; it has ${fx(m.mS)} g` : "your kitchen mix never splits", kit2: r.layers.length === 2 ? `top ${fx(r.layers[1].vol, 0)} mL, bottom ${fx(r.layers[0].vol, 0)} mL` : "one liquid" }; }
function liveCtx() { const c = St.cond, d = derived(), ss = M.steady(c); return { ph: phaseLive(), ...c, Tb: St.Tb, Tt: St.Tt, out: M.heatOut(St.Tb, St.Tt, c), sTb: ss.Tb, sTt: ss.Tt, rw: M.rhoWx(St.Tb, c.Tx, c.bW), rl: M.rhoLx(St.Tb, c.Tx, c.bL), regime: RNAME[regimeNow()].toLowerCase(), rise: d.rise, per: d.per, warm: d.warm, win: d.win, shake: St.shake ? `now: ${Math.round(St.shake.N).toLocaleString("en-US")} droplets of ${fx(St.shake.d * 1000)} mm, ${hm(St.shake.t)} after the shake` : `press Shake it: ${Math.round(M.shakeN0(M.waxVolume(DS))).toLocaleString("en-US")} droplets of 2 mm to start with`, mine: St.mine.eta ? `tuned share of bulb heat: ${Math.round(St.mine.eta * 100)} %` : "enter a warm-up time in My real lamp and press Tune" }; }
const CARD_LIVE = { heat: L => `${L.P} W bulb: ${fx(L.eta * L.P)} W reaches the liquid`, dens: L => `at the bottom (${fx(L.Tb)} °C): wax ${fx(L.rw, 1)}, liquid ${fx(L.rl, 1)} kg/m³`, blob: L => L.rise ? `a 25 mm blob climbs in about ${fx(L.rise, 0)} s` : "no blob is rising at these conditions",
  top: L => `top ${fx(L.Tt)} °C; wax sinks below ${L.Tx} °C`, loss: L => `${fx(L.out)} W leaving through the glass now`, window: L => L.win ? `this bulb works from ${fx(L.win[0], 0)} to ${fx(L.win[1], 0)} °C` : "no working room temperature for this bulb", phase: L => L.ph.kit, shake: L => L.shake, times: L => `twin: first blob after ${L.warm ? fx(L.warm, 0) + " min" : "never"}; climb ${L.rise ? fx(L.rise, 0) + " s" : "none"}`, mine: L => L.mine };
function showCard(id) { const c = CARDS[id]; if (!c) return; St.card = id; const el = $("lens-card"), tour = St.tour, k = tour ? tour.ids.indexOf(id) : -1, q = c.eq ? eqByN(c.eq) : null;
  el.innerHTML = `<div class="lc-top"><span class="lc-subject">${c.rw ? "Real world" : tour ? tour.label : "Lab spot"}</span>${tour ? `<span class="lc-step">${k + 1} of ${tour.ids.length}</span>` : ""}<button class="lc-x" type="button" aria-label="Close">×</button></div>
    <h3>${c.title}</h3><p>${rich(c.text)}</p><p class="lc-plain"><b>In plain words:</b> ${rich(c.plain)}</p>
    ${q ? `<details class="lc-eq"><summary>Show the equation</summary><div class="lc-tex">${K(q.tex, true)}</div><p class="lc-eqref">Eq. (${q.n}) · ${q.name} · <button type="button" data-go="model:${q.n}">open in ∑ Model ▸</button></p></details>` : ""}
    ${c.live ? `<p class="lc-live" id="lc-live"></p>` : ""}<p class="lc-why"><b>Why it matters:</b> ${rich(c.why)}</p>
    ${c.std ? `<p class="lc-course">In college, you learn this in <a class="course" href="https://guide.wisc.edu/search/?P=CBE%20${c.std.slice(4)}" target="_blank" rel="noopener" title="${(COURSES.find(k => "CBE " + k.n === c.std) || {}).title || ""}">${c.std} ↗</a> <button class="crs-go" type="button" data-go="crs" style="color:var(--signal)">Course map ▸</button></p>` : ""}
    ${RESEARCH.map((R, i) => R.cards.includes(id) ? `<p class="lc-course">Research at UW–Madison: <button class="crs-go" type="button" data-go="res:${i}" style="color:var(--signal)">Prof. ${R.name} ▸</button> (${R.area})</p>` : "").join("")}
    ${c.action ? `<div class="row"><button class="btn cta" type="button" data-go="${c.action[1]}">${c.action[0]}</button></div>` : ""}
    ${tour ? `<div class="lc-nav"><button class="btn" type="button" data-nav="-1" ${k === 0 ? "disabled" : ""}>Back</button><button class="btn primary" type="button" data-nav="1">${k === tour.ids.length - 1 ? "Done" : "Next"}</button></div>` : ""}`;
  el.hidden = false; updateCardLive(); if (matchMedia("(max-width: 860px)").matches) el.scrollIntoView({ behavior: "smooth", block: "nearest" }); else $("side").scrollTop = 0; }
function updateCardLive() { const c = CARDS[St.card], el = $("lc-live"); if (c?.live && el) { const s = CARD_LIVE[c.live](liveCtx()); if (el.textContent !== s) el.textContent = s; } }
function closeCard() { St.card = null; St.tour = null; $("lens-card").hidden = true; setChips(null); }
$("lens-card").onclick = e => { const b = e.target.closest("button"); if (!b) return; if (b.classList.contains("lc-x")) closeCard(); else if (b.dataset.go) jump(b.dataset.go); else if (b.dataset.nav) { const t = St.tour, k = t.ids.indexOf(St.card) + +b.dataset.nav; if (k >= t.ids.length) closeCard(); else tourStep(k); } };
function tourStep(k) { const id = St.tour.ids[k], s = SPOTS.find(x => x.id === CARDS[id].spot); lab.goView(s.view); showCard(id); }
function startTour(label, ids, chip) { St.tour = { label, ids }; setChips(chip); tourStep(0); }
function setChips(id) { document.querySelectorAll("#lenses button[data-topic], #realworld").forEach(b => b.setAttribute("aria-pressed", (b.dataset.topic || "rw") === id)); }
TOPICS.forEach(t => { const b = document.createElement("button"); b.type = "button"; b.dataset.topic = t.id; b.textContent = t.label; b.title = `CBE ${t.id}: ${(COURSES.find(k => String(k.n) === t.id) || {}).title || ""}`; b.setAttribute("aria-pressed", "false"); b.onclick = () => b.getAttribute("aria-pressed") === "true" ? closeCard() : startTour(t.label, t.cards, t.id); $("lenses").appendChild(b); });
$("realworld").onclick = () => $("realworld").getAttribute("aria-pressed") === "true" ? closeCard() : startTour("Real world", REALWORLD, "rw");
// optional multiscale view: the lamp beside a zoomed view of one blob
function setMulti(on) { St.multi = !!on; document.body.classList.toggle("multi", St.multi); $("multi-toggle").setAttribute("aria-pressed", St.multi); lab.resize(); lab.resizeBlob(); if (St.multi) updateBlobView(); drawStrip(); }
$("multi-toggle").onclick = () => setMulti(!St.multi);
setTimeout(() => setMulti(true), 0);   // lamp and blob view together by default (user preference); the button turns the blob view off
// numbered spots are off until asked for (user request): the lamp stays uncluttered
function setSpots(on) { document.body.classList.toggle("spots-off", !on); $("spots-toggle").setAttribute("aria-pressed", on); }
$("spots-toggle").onclick = () => setSpots(document.body.classList.contains("spots-off")); setSpots(false);
$("cond-toggle").onclick = () => { const on = $("cond-toggle").getAttribute("aria-pressed") !== "true"; $("cond-toggle").setAttribute("aria-pressed", on); $("tag").hidden = !on; };
document.querySelectorAll(".views button").forEach(b => b.onclick = () => lab.goView(b.dataset.view));

// ====================== overlays, folds, references, pop-out ======================
const OV = { guide: "guide-panel", crs: "crs-panel", model: "mdl-panel", phase: "ph-panel", res: "res-panel" };
const drawPhase = initPhase(() => ({ wax: $("col-wax").value, liq: $("col-liq").value }));
function openOv(k) { for (const id of Object.values(OV)) $(id).hidden = id !== OV[k]; if (k === "model") buildModel(); if (k === "crs") renderCourses(); if (k === "phase") drawPhase(); $(OV[k]).scrollTop = 0; }
function closeOv() { for (const id of Object.values(OV)) $(id).hidden = true; }
document.querySelectorAll(".overlay").forEach(o => o.addEventListener("click", e => { if (e.target === o || e.target.closest("[data-close]")) closeOv(); }));
addEventListener("keydown", e => { if (e.key === "Escape") closeOv(); });
$("open-guide").onclick = () => { openOv("guide"); $("open-guide").classList.add("seen"); try { localStorage.setItem("twin-guide-seen", "1"); } catch (e) {} };
try { if (localStorage.getItem("twin-guide-seen")) $("open-guide").classList.add("seen"); } catch (e) {}
$("open-model").onclick = () => openOv("model"); $("hdr-courses").onclick = $("open-courses").onclick = () => openOv("crs"); $("open-phase").onclick = () => openOv("phase");
function jump(go) { const [k, v] = String(go).split(":"); if (k === "spot") { closeOv(); openSpot(v); } else if (k === "sec") { closeOv(); const el = $("sec-" + v); el.classList.remove("collapsed"); el.scrollIntoView({ behavior: "smooth", block: "start" }); el.classList.add("lens-hl"); setTimeout(() => el.classList.remove("lens-hl"), 1800); } else if (k === "model") { openOv("model"); if (v) { const el = $("eq-" + v); if (el) { el.scrollIntoView({ block: "center" }); el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1600); } } } else if (k === "crs") openOv("crs"); else if (k === "card") { closeOv(); St.tour = null; setChips(null); showCard(v); } else if (k === "res") { openOv("res"); const el = $("res-" + v); if (el) { el.scrollIntoView({ block: "nearest" }); el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1600); } } else if (k === "phase") { if (v) PH.tab = v; openOv("phase"); } }
document.addEventListener("click", e => { const a = e.target.closest("a.ref"); if (a) { e.preventDefault(); closeOv(); $("sec-refs").classList.remove("collapsed"); const li = $("ref-" + a.dataset.ref); if (li) { li.scrollIntoView({ block: "center" }); li.classList.add("flash"); setTimeout(() => li.classList.remove("flash"), 1600); } } });
$("refs").innerHTML = REFS.map((r, i) => `<li id="ref-${i + 1}">${r}</li>`).join("");
document.querySelectorAll("section.fold > h2").forEach(h => { h.tabIndex = 0; h.setAttribute("role", "button"); const tg = () => h.parentElement.classList.toggle("collapsed"); h.onclick = tg; h.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tg(); } }; });
function setPopped(on) { document.body.classList.toggle("popped", on); $("pop-btn").textContent = on ? "⤡" : "⤢"; $("pop-btn").title = on ? "Dock the panel back" : "Pop the panel out into a floating window"; if (!on) $("side").style.left = $("side").style.top = $("side").style.right = ""; try { localStorage.setItem("lamp-panel-popped", on ? "1" : "0"); } catch (e) {} setTimeout(onResize, 30); }
$("pop-btn").onclick = () => setPopped(!document.body.classList.contains("popped"));
{ let drag = null; const side = $("side"), bar = $("panel-bar"); bar.addEventListener("pointerdown", e => { if (!document.body.classList.contains("popped") || e.target.closest("button")) return; const r = side.getBoundingClientRect(); drag = { dx: e.clientX - r.left, dy: e.clientY - r.top }; bar.setPointerCapture(e.pointerId); });
  bar.addEventListener("pointermove", e => { if (!drag) return; side.style.left = Math.max(0, Math.min(innerWidth - 120, e.clientX - drag.dx)) + "px"; side.style.top = Math.max(0, Math.min(innerHeight - 60, e.clientY - drag.dy)) + "px"; side.style.right = "auto"; }); bar.addEventListener("pointerup", () => { drag = null; }); }
try { if (localStorage.getItem("lamp-panel-popped") === "1" && !matchMedia("(max-width: 860px)").matches) setPopped(true); } catch (e) {}

let mdlBuilt = false;
function buildModel() { if (!mdlBuilt) { mdlBuilt = true; const refsup = a => (a || []).map(n => `<sup class="refsup"><a href="#ref-${n}" class="ref" data-ref="${n}">${n}</a></sup>`).join("");
    const card = q => `<div class="mdl-eq" id="eq-${q.n}"><div class="mdl-h"><span class="mdl-n">(${q.n})</span><span class="mdl-name">${q.name}${refsup(q.refs)}</span><button class="btn mdl-go" type="button" data-go="${q.jump}">Show in the twin ▸</button></div>
      <div class="mdl-tex">${K(q.tex, true)}</div>${q.assumed ? `<p class="mdl-assumed"><span class="mdl-src">Assumed</span>${rich(q.assumed)}</p>` : ""}${q.std ? `<p class="mdl-assumed"><span class="mdl-src" style="background:var(--ink-2)">Standard method</span>${rich(q.std)}</p>` : ""}
      <div class="mdl-scroll"><table class="mdl-tab"><thead><tr><th>Symbol</th><th>Meaning</th><th>Units</th><th>Value or range</th></tr></thead><tbody>${q.sym.map(s => `<tr><td>${K(s[0])}</td><td>${rich(s[1])}</td><td>${rich(s[2])}</td><td>${rich(s[3])}</td></tr>`).join("")}</tbody></table></div><p class="mdl-live" data-live="${q.n}"></p></div>`;
    $("mdl-body").innerHTML = `<h3>What is modeled</h3><p>The liquid in the globe as two zones (bottom and top) heated by the bulb and cooled by room air, the densities of wax and liquid, and six wax blobs that rise when lighter and sink when heavier. You set the bulb power, the room temperature, a fan, and the properties of the two fluids (expansion, matching temperature, drag). Outputs: temperatures, whether the lamp flows, warm-up time and blob timing.</p>
      <h3>Governing equations</h3>${EQ_GROUPS.map(g => `<h4 class="mdl-group">${g.name} <span class="note">${g.range}</span><span class="course" style="cursor:default">${g.tag}</span></h4>${g.eqs.map(card).join("")}`).join("")}
      <h3>Parameters and data</h3><div class="mdl-scroll"><table class="mdl-tab"><thead><tr><th>Quantity</th><th>Value</th><th>Units</th><th>Source</th></tr></thead><tbody>${PARAM_ROWS.map(r => `<tr><td>${rich(r[0])}</td><td>${r[1]}</td><td>${r[2]}</td><td>${rich(r[3]).replace(/^(ASSUMED|ILLUSTRATIVE)/, '<span class="mdl-src">$1</span>')}</td></tr>`).join("")}</tbody></table></div>
      <h3>Numerical method</h3><p>The heat balance is advanced with a fourth-order Runge–Kutta method in steps of 2 s or less; each blob's height and temperature are advanced in steps of 0.25 s. Steady temperatures and the conditions map use the closed-form solution.</p>
      <h3>Assumptions and limits</h3><ul class="mdl-list">${LIMITS.map(l => `<li>${rich(l)}</li>`).join("")}</ul>
      <h3>Validation</h3><p class="takeaway"><b>What this means</b>In short: the lamp maths is checked but the lamp itself is not; the Phase lab is checked against published measurements. The equations conserve energy and the solver is accurate, but no published measurements of a real lamp were found to compare with. Your own lamp is the validation.</p>
      <p class="note">A script (<code>model_check.mjs</code>, 32 checks) confirms: heat out equals heat in at steady state (15.0 W for the 25 W bulb), the time integration converges to the closed-form temperatures, energy stored plus lost equals energy supplied within 0.5 %, the densities cross at the matching temperature, the three regimes appear where expected, and the tuning step recovers a known value. Against makers' guidance: warm-up of 3.0 h (makers: 1 to 3 h, or 2 to 3 h) and a working room range of 16 to 26 °C (makers: 20 to 24 °C). Phase lab: the NRTL calculation reproduces the ten measured tie-lines for water, ethanol and castor oil to 0.9 % by mass on average (root mean square), with equal activities in both layers to 11 digits; the salt calculation returns each of the five measured tie-lines exactly at its midpoint.</p>
      <h3>References</h3><ol class="refs">${REFS.map(r => `<li>${r}</li>`).join("")}</ol>`;
    $("mdl-body").onclick = e => { const b = e.target.closest("button[data-go]"); if (b) jump(b.dataset.go); }; }
  updateModelLive(); }
function updateModelLive() { if ($("mdl-panel").hidden) return; const L = liveCtx(); document.querySelectorAll("#mdl-body [data-live]").forEach(el => { const q = eqByN(+el.dataset.live), s = q.live ? q.live(L) : ""; if (el.textContent !== s) el.textContent = s; }); }
// ---------- Courses panel (Part A of the collection's shared format) ----------
const crs = { aud: "student", kind: "all", hi: null };
function renderCourses() { const list = COURSES.filter(c => crs.kind === "all" || c.kind === crs.kind), famOf = c => FAM[c.topics[0][1]][1];
  const matrix = `<div class="crs-scroll"><table class="crs-map"><thead><tr><th>Twin feature</th>${list.map(c => `<th data-c="${c.n}" class="${crs.hi === c.n ? "hi" : ""}" title="CBE ${c.n}: ${c.title}">${c.n}</th>`).join("")}</tr></thead>
    <tbody>${FEATURES.map(f => `<tr><td><button class="crs-go" type="button" data-go="${f.go}">${f.name}</button></td>${list.map(c => `<td class="${crs.hi === c.n ? "hi" : ""}">${c.features.includes(f.id) ? `<i style="background:${famOf(c)}"></i>` : ""}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  const cards = list.map(c => `<article class="crs-card ${crs.hi === c.n ? "hi" : ""}" id="crs-${c.n}">
      <header><a href="https://guide.wisc.edu/search/?P=CBE%20${c.n}" target="_blank" rel="noopener">CBE ${c.n} ↗</a><span class="crs-term">${c.term}${c.kind === "elective" ? "" : " · core"}</span></header>
      <h4>${c.title}</h4>
      <div class="crs-topics">${c.topics.map(([name, fam]) => `<span style="--fc:${FAM[fam][1]}">${name}</span>`).join("")}</div>
      <div class="crs-uses">${c.features.map(id => FEATURES.find(f => f.id === id)).map(f => `<button type="button" data-go="${f.go}">${f.name} →</button>`).join("")}</div>
      <p class="crs-act"><span>${crs.aud === "student" ? "Try this" : "Use in class"}</span>${crs.aud === "student" ? c.student : c.instructor}</p>
      <a class="crs-ps" href="${PS_URL}#${APP}-${c.n}" target="_blank" rel="noopener">Problem set ↗</a>
    </article>`).join("");
  const fams = [...new Set(list.flatMap(c => c.topics.map(t => t[1])))];
  $("crs-body").innerHTML = `<p><b>One process, many courses:</b> this digital twin shows how modeling, thermodynamics of mixtures, transport, heat transfer, kinetics, dynamics and statistics work together in one lamp.</p>
    <p>${list.length} courses use this digital twin. Topic names follow the CBE Curriculum Navigator; click a feature to jump to it, or a course number to find its card.</p>
    <h3>Course map</h3>${matrix}
    <p><a class="crs-ps" href="${PS_URL}#${APP}-Integrative" target="_blank" rel="noopener">Integrative problem ↗</a> one evening with the lamp through five courses.</p>
    <h3>Courses</h3><div class="crs-grid">${cards}</div>
    <p class="crs-legend">${fams.map(f => `<span><i style="background:${FAM[f][1]}"></i>${FAM[f][0]}</span>`).join("")}</p>`; }
$("res-body").innerHTML = RESEARCH.map((R, i) => `<article class="crs-card res-card" id="res-${i}"><h4 style="margin:0"><a href="${R.page}" target="_blank" rel="noopener">${R.name} ↗</a></h4><p class="res-where">Connects to: ${R.where}</p><div class="res-areas">${R.areas.slice(0, 3).map(a => `<span>${a}</span>`).join("")}</div><div class="res-go"><button class="btn mdl-go" type="button" data-go="${R.go[1]}" title="Close the panel and show where this connects in the twin">Show in the twin: ${R.go[0]} ▸</button></div></article>`).join("");
$("res-centers").innerHTML = CENTERS.map(([n, u, w]) => `<article class="crs-card res-card"><h4 style="margin:0"><a href="${u}" target="_blank" rel="noopener">${n} ↗</a></h4><p class="res-where">Connects to: ${w}</p></article>`).join("");
$("res-body").addEventListener("click", e => { const b = e.target.closest("button[data-go]"); if (b) jump(b.dataset.go); });
$("open-res").onclick = () => openOv("res");
$("crs-summary").textContent = `Used in ${COURSES.length} courses, from process modeling to colloid science.`;
$("crs-body").addEventListener("click", e => { const b = e.target.closest("button[data-go]"); if (b) { jump(b.dataset.go); return; } const th = e.target.closest("th[data-c]"); if (th) { crs.hi = +th.dataset.c; renderCourses(); document.getElementById("crs-" + crs.hi)?.scrollIntoView({ block: "center" }); } });
for (const [id, key] of [["crs-aud", "aud"], ["crs-kind", "kind"]]) $(id).onclick = e => { const b = e.target.closest("button"); if (!b) return; crs[key] = b.dataset.a || b.dataset.k; $(id).querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); renderCourses(); };

// ---------- problem-set set-ups: #ps-<course>-<k> puts the twin in the state a problem needs ----------
const PS = { "255-1": () => { setCond({ P: 25, Tr: 22 }); startCold(); }, "311-1": () => { PH.tab = "oil"; Object.assign(PH.o, { water: 40, eth: 20, oil: 40 }); openOv("phase"); }, "311-2": () => { PH.tab = "kitchen"; Object.assign(PH.k, { rub: 50, strength: 70, water: 50, salt: 15 }); openOv("phase"); },
  "320-1": () => { setCond({ P: 25, Tr: 22 }); jumpWarm(); setMulti(true); }, "326-1": () => { setCond({ P: 25, Tr: 22 }); jumpWarm(); openSpot("glass"); }, "326-2": () => { setCond({ P: 25, Tr: 22, Tx: 45 }); jumpWarm(); jump("sec:map"); },
  "355-1": () => { $("m-p").value = 25; setMTr(21); $("m-warm").value = 150; $("m-rise").value = ""; $("m-flow").value = "flowing"; St.mine.eta = null; renderMine(); jump("sec:mine"); }, "430-1": () => { setCond({ P: 25, Tr: 22 }); jumpWarm(); St.clearH = 3; $("clear").value = 3; shakeNow(); },
  "470-1": () => { setCond({ P: 25, Tr: 22 }); startCold(); }, "470-2": () => { setCond({ P: 25, Tr: 22 }); jumpWarm(); jump("sec:map"); }, "547-1": () => { setCond({ P: 25, Tr: 22 }); jumpWarm(); St.clearH = 3; $("clear").value = 3; shakeNow(); }, "int-1": () => { setCond({ P: 25, Tr: 22 }); startCold(); } };
function readHash() { const m = location.hash.match(/^#ps[-=]((?:\d+|int)-\d+)/); if (m && PS[m[1]]) { closeOv(); PS[m[1]](); return true; } return false; }
addEventListener("hashchange", readHash);

// ====================== main loop ======================
function onResize() { lab.resize(); lab.resizeBlob(); drawStrip(); drawMap(); if (!$("ph-panel").hidden) drawPhase(); }
addEventListener("resize", onResize); new ResizeObserver(() => { lab.resize(); lab.resizeBlob(); }).observe($("stage"));
let last = performance.now(), acc = 0, acc2 = 0;
function frame(now) { const dt = Math.min(0.1, (now - last) / 1000); last = now; if (St.running) advance(dt * St.speed);
  const H = St.cond.H, r = M.regime(St.Tb, St.Tt, St.cond), nb = St.blobs.length;
  lab.update({ Tx: St.cond.Tx, focus: pickFocus(), shake: St.shake ? { n: St.shake.N, d: St.shake.d, cloud: M.shakeCloud(St.shake.N0, St.shake.N) } : null, Tb: St.Tb, Tt: St.Tt, Tr: St.cond.Tr, blobs: St.shake ? [] : St.blobs.map(b => ({ u: b.z / H, d: b.d, v: b.v, T: b.T })), regime: r, melt: Math.max(0, Math.min(1, (St.Tb - M.PARAMS.Tm + 4) / 6)), glowK: Math.min(1.3, St.cond.P / 25), poolK: St.shake ? Math.min(1, (St.shake.d / 0.027) ** 3) : St.blobs.filter(b => b.z <= 0).length / nb, topK: St.shake ? 0 : St.blobs.filter(b => b.z >= H).length / nb, fan: St.cond.fan }, dt, now / 1000); lab.render(dt); if (St.multi) lab.renderBlob(dt); placeSpots();
  acc += dt; acc2 += dt; if (acc > 0.3) { acc = 0; syncUI(); if (St.multi) updateBlobView(); } if (acc2 > 1) { acc2 = 0; updateCardLive(); updateModelLive(); drawScreens(); }
  requestAnimationFrame(frame); }
U.on((u, prev) => { const v = +$("m-tr").value, c = prev === "F" ? (v - 32) * 5 / 9 : v; setMTr(c); drawMap(); drawStrip(); drawScreens(); renderMine(); });
initUnits({ def: "C", mount: $("sec-setup").querySelector("h2"), skip: "#mdl-panel, .refs, .lc-eq" });
syncControls(); jumpWarm(); drawMap(); renderMine(); drawScreens(); document.fonts?.ready.then(() => { drawScreens(); drawMap(); drawStrip(); });
requestAnimationFrame(frame); setTimeout(readHash, 50);
window.__twin = { St, M, lab, setMulti, setSpots, updateBlobView, shakeNow, setView, PH, phaseTabs: ["kitchen", "oil"], jump, openOv, closeOv, showCard, startTour, setCond, startCold, jumpWarm, placeSpots, advance };
