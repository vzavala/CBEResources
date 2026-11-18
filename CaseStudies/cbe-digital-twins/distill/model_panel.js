// ∑ Model panel: every equation the code solves (model/column.js, model/thermo.js), as football-style cards (Part K) in KaTeX HTML (Part L),
// then parameters, numerical method, assumptions and validation against the lab runs.
import { th, LAB_RUNS, LAB_META, CALIBRATION, DT } from "./sim.js";
import { VALID } from "./validation_data.js";

const T = String.raw, $ = id => document.getElementById(id);
const f0 = x => Math.round(x).toLocaleString("en-US"), f1 = x => x.toFixed(1), f2 = x => x.toFixed(2), f3 = x => x.toFixed(3), f4 = x => x.toFixed(4), C = k => k - 273.15;

// ---------- math typesetting: KaTeX HTML with KaTeX fonts; MathML if the fonts cannot load ----------
let KX_OUT = "html"; const kxCache = new Map();
function tex(src, display = false) {
  const esc = `<code>${src.replace(/</g, "&lt;")}</code>`; if (!window.katex) return esc;
  const key = KX_OUT + (display ? "D" : "I") + src; let h = kxCache.get(key); if (h) return h;
  try { h = window.katex.renderToString(src, { displayMode: display, output: KX_OUT, throwOnError: false, strict: "ignore" }); } catch (e) { h = esc; }
  kxCache.set(key, h); return h;
}

// ---------- one shared helper for math written as plain text (Part V): variable symbols, subscripted variables and standalone Greek
// variables are typeset with KaTeX wherever they appear; units and chemical formulas stay plain text.
const GREEK = { "α": "\\alpha", "γ": "\\gamma", "ε": "\\varepsilon", "η": "\\eta", "ψ": "\\psi", "φ": "\\varphi", "σ": "\\sigma", "τ": "\\tau", "ρ": "\\rho", "Δ": "\\Delta " };
const SUBD = "₀₁₂₃₄₅₆₇₈₉";
const MATH_RE = /(?<![A-Za-z0-9_])(?:(?:Δ?[A-Za-z]|[αγεηψφστρ])(?:_[A-Za-z0-9σ]+(?:,[a-z]+)?|[₀-₉]+|\*(?![A-Za-z]))|Δ[A-Za-z](?![a-z])|[αγεηψφτ](?![A-Za-zα-ω]))/g;
function tokTeX(tok) {
  const g = x => x.replace(/[αγεηψφστρΔ]/g, ch => GREEK[ch]);
  if (tok.endsWith("*")) return g(tok.slice(0, -1)) + "^{*}";
  let m = tok.match(/^(.+?)([₀-₉]+)$/); if (m) return `${g(m[1])}_{${[...m[2]].map(ch => SUBD.indexOf(ch)).join("")}}`;
  m = tok.match(/^(.+?)_(.+)$/); if (!m) return g(tok);
  const sub = m[2].split(",").map(q => /^[a-z]{3,}$/.test(q) ? `\\mathrm{${q}}` : g(q)).join(",");
  return `${g(m[1])}_{${sub}}`;
}
export const mathText = str => str.replace(MATH_RE, t => tex(tokTeX(t)));          // for strings that become innerHTML
export function typesetIn(root) {                                                  // for content already in the page; returns the count typeset
  if (!root) return 0; let n = 0; const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), nodes = []; let t;
  while ((t = w.nextNode())) { if (!t.parentElement.closest(".katex, code, a, script, style, select, .refs")) { MATH_RE.lastIndex = 0; if (MATH_RE.test(t.nodeValue)) nodes.push(t); } }
  for (const node of nodes) { const span = document.createElement("span"); span.innerHTML = node.nodeValue.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(MATH_RE, tok => { n++; return tex(tokTeX(tok)); }); node.replaceWith(...span.childNodes); }
  return n;
}

export function makeModelPanel({ S, GO, courseLink, REFS, ref }) {
  let open = false, stg = 12, plainTypeset = 0;
  if (document.fonts && document.fonts.load) document.fonts.load("1em KaTeX_Main").then(l => { if (!l.length) { KX_OUT = "mathml"; kxCache.clear(); if (open) render(); } }).catch(() => {});
  const col = () => S.col, hy = () => S.col.hyd[stg];
  const c = () => S.col;   // short alias used in the live lines
  const EQ = [
    { group: "Stage balances", courses: [250, 255], items: [
      { no: 1, name: "Total mole balance on a stage", refs: [12], go: ["feed", "Feed tray"], tex: T`\frac{dM_i}{dt} = L_{i-1} + V_{i+1} + F_i - L_i - V_i`,
        sym: [[T`M_i`, "liquid held on stage i (0 = condenser and splitter, 1–14 = trays, 15 = reboiler)", "mol", "solved"], [T`t`, "time", "s", "–"], [T`L_i`, "liquid leaving stage i, downward", "mol/s", "computed, Eq. (11)"], [T`V_i`, "vapour leaving stage i, upward", "mol/s", "computed, Eq. (3)"], [T`F_i`, "feed to stage i; zero except on tray 12", "mol/s", "0–3.5"]],
        live: () => { const q = c(), i = stg, Fi = i === q.cfg.operation.feedTray ? q.feed.F : 0; return `Stage ${i}: ${f4(q.L[i - 1])} + ${f4(q.V[i + 1])} + ${f4(Fi)} − ${f4(q.L[i])} − ${f4(q.V[i])} = ${(q.L[i - 1] + q.V[i + 1] + Fi - q.L[i] - q.V[i]).toExponential(1)} mol/s`; } },
      { no: 2, name: "Ethanol balance on a stage", refs: [12], go: ["profile", "Tray profile"], tex: T`\frac{d(M_i x_i)}{dt} = L_{i-1}x_{i-1} + V_{i+1}y_{i+1} + F_i z_F - L_i x_i - V_i y_i`,
        sym: [[T`x_i`, "ethanol mole fraction in the liquid on stage i", "–", "solved"], [T`y_i`, "ethanol mole fraction in the vapour leaving stage i", "–", "Eq. (9)"], [T`z_F`, "ethanol mole fraction in the feed", "–", "0.02–0.30"], [T`M_i,\,L_i,\,V_i,\,F_i,\,t`, "as in Eq. (1)", "", ""]],
        live: () => { const q = c(), i = stg; return `Stage ${i}: x = ${f4(q.x[i])}, y = ${f4(q.y[i])}; dx/dt = ${q.dxdt[i].toExponential(1)} 1/s`; } },
      { no: 3, name: "Energy balance on a stage, solved for the vapour flow", refs: [12], go: ["balances", "Energy & balances"],
        tex: T`V_i\,(H_i - h_i) = V_{i+1}(H_{i+1}-h_i) + L_{i-1}(h_{i-1}-h_i) + F_i\,(h_F-h_i) - Q_{\mathrm{loss},i} - M_i\,\frac{\partial h^{\mathrm{sat}}}{\partial x}\,\frac{dx_i}{dt}`,
        sym: [[T`H_i`, "molar enthalpy of the vapour leaving stage i", "J/mol", "Eq. (7)"], [T`h_i`, "molar enthalpy of the liquid on stage i, at its bubble point", "J/mol", "Eq. (7)"], [T`h_F`, "molar enthalpy of the feed", "J/mol", "Eq. (7)"], [T`Q_{\mathrm{loss},i}`, "heat lost through the wall of stage i", "W", "Eq. (18)"], [T`\partial h^{\mathrm{sat}}/\partial x`, "slope of the saturated-liquid enthalpy with composition", "J/mol", "by finite difference"], [T`V_i,\,L_i,\,F_i,\,M_i,\,x_i,\,t`, "as in Eqs. (1) and (2)", "", ""]],
        live: () => { const q = c(), i = stg; return `Stage ${i}: H = ${f0(q.H[i])}, h = ${f0(q.h[i])} J/mol → V = ${f4(q.V[i])} mol/s`; } },
    ] },
    { group: "Phase equilibrium", courses: [311], items: [
      { no: 4, name: "Modified Raoult's law and the bubble point", refs: [12], go: ["mccabe", "McCabe–Thiele diagram"], tex: T`y_k^{*}\,P = x_k\,\gamma_k(x,T)\,P_k^{\mathrm{sat}}(T), \qquad \sum_k x_k\,\gamma_k\,P_k^{\mathrm{sat}}(T_i) = P_i`,
        sym: [[T`y_k^{*}`, "vapour mole fraction of component k in equilibrium with the liquid (k = 1 ethanol, 2 water)", "–", "computed"], [T`P,\,P_i`, "pressure; pressure on stage i", "Pa", "101–111 kPa"], [T`x_k`, "liquid mole fraction of component k", "–", "0–1"], [T`\gamma_k`, "activity coefficient", "–", "Eq. (6)"], [T`P_k^{\mathrm{sat}}`, "vapour pressure of pure k", "Pa", "Eq. (5)"], [T`T,\,T_i`, "temperature; bubble-point temperature of stage i, by Newton's method", "K", "351–376"]],
        live: () => { const q = c(), i = stg, [g1, g2] = th.gammas(q.x[i], q.T[i]); return `Stage ${i}: ${f4(q.x[i])}·${f3(g1)}·${f1(th.psat(0, q.T[i]) / 1000)} + ${f4(1 - q.x[i])}·${f3(g2)}·${f1(th.psat(1, q.T[i]) / 1000)} = ${f2(q.P[i] / 1000)} kPa → T = ${f2(C(q.T[i]))} °C, y* = ${f4(q.ystar[i])}`; } },
      { no: 5, name: "Antoine vapour pressure", refs: [2], go: ["m-val", "Validation"], tex: T`\log_{10} P_k^{\mathrm{sat}} = A_k - \frac{B_k}{T + C_k}`,
        sym: [[T`P_k^{\mathrm{sat}}`, "vapour pressure of pure k (here in mmHg)", "mmHg", "computed"], [T`T`, "temperature (here in °C)", "°C", "78–103"], [T`A_k,\,B_k,\,C_k`, "Antoine constants", "–, °C, °C", "ethanol 8.20417, 1642.89, 230.300; water 8.07131, 1730.63, 233.426"]],
        live: () => { const q = c(), i = stg; return `At ${f2(C(q.T[i]))} °C: ethanol ${f1(th.psat(0, q.T[i]) / 1000)} kPa, water ${f1(th.psat(1, q.T[i]) / 1000)} kPa`; } },
      { no: 6, name: "NRTL activity coefficients", refs: [1], go: ["m-val", "Validation"],
        tex: T`\begin{aligned}\ln\gamma_1 &= x_2^2\left[\tau_{21}\left(\frac{G_{21}}{x_1+x_2G_{21}}\right)^{2} + \frac{\tau_{12}\,G_{12}}{(x_2+x_1G_{12})^{2}}\right] \\[5pt] \ln\gamma_2 &= x_1^2\left[\tau_{12}\left(\frac{G_{12}}{x_2+x_1G_{12}}\right)^{2} + \frac{\tau_{21}\,G_{21}}{(x_1+x_2G_{21})^{2}}\right] \\[5pt] \tau_{ij} &= a_{ij} + \frac{b_{ij}}{T}, \qquad G_{ij} = e^{-\alpha\,\tau_{ij}}\end{aligned}`,
        sym: [[T`\gamma_1,\,\gamma_2`, "activity coefficients of ethanol and water", "–", "1–6"], [T`x_1,\,x_2`, "liquid mole fractions of ethanol and water", "–", "0–1"], [T`\tau_{ij},\,G_{ij}`, "NRTL interaction terms", "–", "computed"], [T`a_{ij},\,b_{ij}`, "binary parameters", "–, K", "a₁₂ −0.8009, a₂₁ 3.4578, b₁₂ 246.18, b₂₁ −586.0809"], [T`\alpha`, "non-randomness parameter", "–", "0.3"], [T`T`, "temperature", "K", "351–376"]],
        live: () => { const q = c(), i = stg, [g1, g2] = th.gammas(q.x[i], q.T[i]); return `Stage ${i}: γ₁ = ${f3(g1)}, γ₂ = ${f3(g2)}; relative volatility ${f2(th.relVol(q.x[i], q.T[i]))}`; } },
    ] },
    { group: "Enthalpy", courses: [310], items: [
      { no: 7, name: "Liquid and vapour enthalpy", refs: [2, 3], go: ["reboiler", "Reboiler"],
        tex: T`\begin{aligned} h &= \Big(\sum_k x_k\,c_{p,k}\Big)(T - T_{\mathrm{ref}}) + h^{E}, \qquad h^{E} = -R\,T^{2}\,\frac{\partial\,(g^{E}/RT)}{\partial T} \\[5pt] H &= \sum_k y_k\left[c_{p,k}\,(T-T_{\mathrm{ref}}) + \Delta H_{\mathrm{vap},k}(T)\right], \qquad \Delta H_{\mathrm{vap},k}(T) = \Delta H_{\mathrm{vap},k}(T_b)\left(\frac{T_c-T}{T_c-T_b}\right)^{0.38}\end{aligned}`,
        sym: [[T`h,\,H`, "molar enthalpy of liquid and of vapour", "J/mol", "computed"], [T`x_k,\,y_k`, "liquid and vapour mole fractions", "–", "0–1"], [T`c_{p,k}`, "liquid heat capacity of pure k", "J/mol·K", "ethanol 112.4, water 75.3"], [T`T`, "temperature", "K", "–"], [T`T_{\mathrm{ref}}`, "reference temperature (pure liquids)", "K", "298.15"], [T`h^{E},\,g^{E}`, "excess enthalpy and excess Gibbs energy, from Eq. (6)", "J/mol", "computed"], [T`R`, "gas constant", "J/mol·K", "8.314"], [T`\Delta H_{\mathrm{vap},k}`, "heat of vaporization of pure k (Watson relation)", "J/mol", "at the boiling point: ethanol 38 560, water 40 660"], [T`T_b,\,T_c`, "normal boiling point and critical temperature of pure k", "K", "ethanol 351.44, 513.9; water 373.15, 647.1"]],
        live: () => { const q = c(), i = stg; return `At ${f2(C(q.T[i]))} °C: ΔH_vap ethanol ${f0(th.dHvap(0, q.T[i]))}, water ${f0(th.dHvap(1, q.T[i]))} J/mol; excess enthalpy ${f0(th.hExcess(q.x[i], q.T[i]))} J/mol`; } },
      { no: 8, name: "Thermal condition of the feed", refs: [12], go: ["feed", "Feed tray"], tex: T`q = \frac{H^{\mathrm{dew}} - h_F}{H^{\mathrm{dew}} - h^{\mathrm{bub}}}`,
        sym: [[T`q`, "liquid fraction of the feed (above 1 for a subcooled feed)", "–", "1.0–1.2"], [T`H^{\mathrm{dew}}`, "enthalpy of the feed as saturated vapour", "J/mol", "computed"], [T`h^{\mathrm{bub}}`, "enthalpy of the feed as saturated liquid", "J/mol", "computed"], [T`h_F`, "enthalpy of the feed as it enters", "J/mol", "computed"]],
        live: () => { const f = c().feed; return `Feed at ${f1(C(f.Tf))} °C (bubble point ${f1(C(f.Tbub))} °C): q = ${f3(f.q)}`; } },
    ] },
    { group: "Tray efficiency", courses: [426, 320], items: [
      { no: 9, name: "Murphree vapour efficiency", refs: [4, 12], go: ["tray", "Sieve tray"], tex: T`y_i = y_{i+1} + E_i\,\big(y_i^{*} - y_{i+1}\big)`,
        sym: [[T`y_i`, "ethanol mole fraction in the vapour leaving tray i", "–", "computed"], [T`y_{i+1}`, "the same for the vapour entering from the tray below", "–", "computed"], [T`E_i`, "Murphree vapour efficiency of tray i", "–", "Eq. (10)"], [T`y_i^{*}`, "vapour in equilibrium with the liquid on tray i", "–", "Eq. (4)"]],
        live: () => { const q = c(), i = Math.min(14, Math.max(1, stg)); return `Tray ${i}: ${f4(q.y[i + 1])} + ${f2(q.E[i])}·(${f4(q.ystar[i])} − ${f4(q.y[i + 1])}) = ${f4(q.y[i])}`; } },
      { no: 10, name: "Fitted efficiency with entrainment and weeping corrections", refs: [6, 9], go: ["lab", "Lab runs"], assumed: "The entrainment fraction ψ is this model's own curve fit of Fair's chart, and the 0.85 weeping factor is a modelling choice.",
        tex: T`E_i = \frac{E_0}{1 + E_0\,\psi/(1-\psi)}\,\big(1 - 0.85\,W\big), \qquad \psi = 0.4\,f^{5}\left(\frac{0.05}{F_{LV}}\right)^{0.4}`,
        sym: [[T`E_i`, "Murphree vapour efficiency of tray i", "–", "0–1"], [T`E_0`, "efficiency fitted to the lab runs: trays above the feed, trays below it", "–", "0.90, 1.00"], [T`\psi`, "fraction of liquid entrained upward (limited to 0–0.6)", "–", "computed"], [T`W`, "weeping fraction", "–", "Eq. (14)"], [T`f`, "fraction of flooding", "–", "Eq. (13)"], [T`F_{LV}`, "liquid–vapour flow parameter", "–", "Eq. (13)"]],
        live: () => { const i = Math.min(14, Math.max(1, stg)), h = c().hyd[i]; return `Tray ${i}: E₀ = ${f2(h.E0)}, ψ = ${f4(h.psi)}, W = ${f2(h.weep)} → E = ${f3(c().E[i])}`; } },
    ] },
    { group: "Tray hydraulics and limits", courses: [326], items: [
      { no: 11, name: "Liquid height and flow over the weir (Francis)", refs: [8], go: ["tray", "Sieve tray"], tex: T`h_{cl} = \frac{M_i\,\bar M}{\rho_L\,A_a}, \qquad h_{ow} = h_{cl} - h_w, \qquad Q_L = 1.84\,l_w\,h_{ow}^{1.5}, \qquad L_i = \frac{Q_L\,\rho_L}{\bar M}`,
        sym: [[T`h_{cl}`, "clear-liquid height on the tray", "m", "0.03–0.05"], [T`M_i`, "liquid held on the tray", "mol", "solved"], [T`\bar M`, "mean molar mass of the liquid", "kg/mol", "0.018–0.040"], [T`\rho_L`, "liquid density", "kg/m³", "800–960"], [T`A_a`, "active (bubbling) area", "m²", "0.0259"], [T`h_{ow}`, "liquid crest over the weir", "m", "computed"], [T`h_w`, "weir height", "m", "0.0254"], [T`Q_L`, "liquid volume flow over the weir", "m³/s", "computed"], [T`l_w`, "weir length", "m", "0.148"], [T`L_i`, "liquid leaving the tray", "mol/s", "computed"]],
        live: () => { const i = Math.min(14, Math.max(1, stg)), h = c().hyd[i]; return `Tray ${i}: h_cl = ${f1(h.hcl * 1000)} mm, crest ${f2(h.how * 1000)} mm → L = ${f3(c().L[i])} mol/s`; } },
      { no: 12, name: "Tray pressure drop", refs: [8], go: ["hyd", "Column now"], tex: T`h_d = \frac{u_h^{2}}{2g}\,\frac{\rho_V}{\rho_L}\,\frac{1}{C_o^{2}}, \qquad h_\sigma = \frac{4\,\sigma}{\rho_L\,g\,d_h}, \qquad \Delta P_i = \rho_L\,g\,(h_d + h_{cl} + h_\sigma), \qquad P_{i+1} = P_i + \Delta P_i`,
        sym: [[T`h_d`, "dry-tray head loss through the holes", "m of liquid", "computed"], [T`u_h`, "vapour velocity through the holes", "m/s", "5–25"], [T`g`, "acceleration of gravity", "m/s²", "9.807"], [T`\rho_V,\,\rho_L`, "vapour and liquid densities", "kg/m³", "0.6–1.5; 800–960"], [T`C_o`, "orifice coefficient", "–", "0.73 (assumed)"], [T`h_\sigma`, "head to form bubbles against surface tension", "m", "computed"], [T`\sigma`, "surface tension", "N/m", "0.02–0.06"], [T`d_h`, "hole diameter", "m", "0.0032 (assumed)"], [T`\Delta P_i`, "pressure drop across tray i", "Pa", "300–700"], [T`h_{cl}`, "clear-liquid height, Eq. (11)", "m", ""], [T`P_i`, "pressure on stage i", "Pa", "computed"]],
        live: () => { const i = Math.min(14, Math.max(1, stg)), h = c().hyd[i]; return `Tray ${i}: u_h = ${f1(h.uh)} m/s, h_d = ${f1(h.hd * 1000)} mm, h_σ = ${f1(h.hsig * 1000)} mm → ΔP = ${f0(h.dP)} Pa; column total ${f2((c().P[15] - c().P[1]) / 1000)} kPa`; } },
      { no: 13, name: "Jet flooding", refs: [9, 10, 11], go: ["hyd", "Column now"], assumed: "The factor of 1.4 on the flooding velocity was set during calibration so the measured runs stay below flooding; it was not measured.",
        tex: T`\begin{aligned} F_{LV} &= \frac{L\,\bar M_L}{V\,\bar M_V}\sqrt{\frac{\rho_V}{\rho_L}}, \qquad C_{sb} = 0.0105 + 0.1496\,S^{0.755}\,e^{-1.463\,F_{LV}^{0.842}} \\[5pt] u_f &= \varphi_f\,C_{sb}\,f_h\left(\frac{\sigma}{0.020}\right)^{0.2}\sqrt{\frac{\rho_L-\rho_V}{\rho_V}}, \qquad f = \frac{u_N}{u_f}\end{aligned}`,
        sym: [[T`F_{LV}`, "liquid–vapour flow parameter", "–", "0.01–0.1"], [T`L,\,V`, "liquid and vapour molar flows on the tray", "mol/s", "computed"], [T`\bar M_L,\,\bar M_V`, "mean molar masses of liquid and vapour", "kg/mol", "computed"], [T`\rho_V,\,\rho_L`, "vapour and liquid densities", "kg/m³", "computed"], [T`C_{sb}`, "capacity parameter at flooding", "m/s", "computed"], [T`S`, "tray spacing", "m", "0.254"], [T`u_f`, "vapour velocity at flooding, on the net area", "m/s", "computed"], [T`\varphi_f`, "calibration factor", "–", "1.4 (assumed)"], [T`f_h`, "hole-area correction, 5 × open area + 0.5, limited to 0.6–1", "–", "1.0"], [T`\sigma`, "surface tension", "N/m", "computed"], [T`f`, "fraction of flooding", "–", "0.2–1"], [T`u_N`, "vapour velocity on the net area", "m/s", "computed"]],
        live: () => { const i = Math.min(14, Math.max(1, stg)), h = c().hyd[i]; return `Tray ${i}: F_LV = ${f3(h.FLV)}, C_sb = ${f3(h.Csb)} m/s, u_f = ${f2(h.uFlood)} m/s, u_N = ${f2(h.uN)} m/s → ${f0(h.flood * 100)} % of flooding`; } },
      { no: 14, name: "Weeping", refs: [8], go: ["hyd", "Column now"], assumed: "K₂ is this model's curve fit of the weep-point chart in ref. 8.",
        tex: T`u_{h,\min} = \frac{K_2 - 0.90\,(25.4 - d_h)}{\sqrt{\rho_V}}, \qquad K_2 = 31.3 - 3.5\,e^{-(h_w + h_{ow})/30}, \qquad W = \max\!\left(0,\ \frac{u_{h,\min}-u_h}{u_{h,\min}}\right)`,
        sym: [[T`u_{h,\min}`, "lowest hole velocity that holds the liquid up", "m/s", "computed"], [T`K_2`, "weep-point constant", "–", "28–31"], [T`d_h`, "hole diameter (here in mm)", "mm", "3.2 (assumed)"], [T`\rho_V`, "vapour density", "kg/m³", "computed"], [T`h_w,\,h_{ow}`, "weir height and crest (here in mm)", "mm", "25.4; computed"], [T`W`, "weeping fraction", "–", "0–1"], [T`u_h`, "vapour velocity through the holes", "m/s", "computed"]],
        live: () => { const i = Math.min(14, Math.max(1, stg)), h = c().hyd[i]; return `Tray ${i}: u_h,min = ${f1(h.uhMin)} m/s, u_h = ${f1(h.uh)} m/s → W = ${f2(h.weep)}`; } },
      { no: 15, name: "Froth height and downcomer backup", refs: [7, 8], go: ["tray", "Sieve tray"], assumed: "The head loss under the downcomer apron is used as coded in the source twin.",
        tex: T`\phi_e = \exp\!\big(-12.55\,K_s^{0.91}\big), \qquad K_s = u_N\sqrt{\frac{\rho_V}{\rho_L-\rho_V}}, \qquad h_f = \frac{h_{cl}}{\phi_e}, \qquad h_{db} = h_{cl} + \frac{\Delta P_i}{\rho_L\,g} + h_{da}`,
        sym: [[T`\phi_e`, "effective froth density (liquid fraction of the froth)", "–", "0.1–0.6"], [T`K_s`, "density-corrected vapour velocity", "m/s", "computed"], [T`u_N`, "vapour velocity on the net area", "m/s", "computed"], [T`\rho_V,\,\rho_L`, "vapour and liquid densities", "kg/m³", "computed"], [T`h_f`, "froth height, capped at the tray spacing", "m", "0.05–0.25"], [T`h_{cl}`, "clear-liquid height, Eq. (11)", "m", ""], [T`h_{db}`, "liquid backup in the downcomer", "m", "computed"], [T`\Delta P_i`, "tray pressure drop, Eq. (12)", "Pa", ""], [T`g`, "acceleration of gravity", "m/s²", "9.807"], [T`h_{da}`, "head loss under the downcomer apron", "m", "computed"]],
        live: () => { const i = Math.min(14, Math.max(1, stg)), h = c().hyd[i]; return `Tray ${i}: froth ${f0(h.froth * 1000)} mm of ${254} mm; downcomer backup ${f0(h.hdb * 1000)} mm (${f0(h.dcFlood * 100)} % of its limit)`; } },
    ] },
    { group: "Condenser, reflux splitter and heat loss", courses: [326, 320], items: [
      { no: 16, name: "Condenser: effectiveness–NTU", refs: [13], go: ["condenser", "Condenser"], tex: T`\varepsilon = 1 - e^{-UA/C_{cw}}, \qquad Q_{\mathrm{avail}} = \varepsilon\,C_{cw}\,(T_{\mathrm{bub}} - T_{cw}), \qquad Q_C = \min\!\big(V_1\,[H_1 - h(y_1, T_{\mathrm{refl}})],\ Q_{\mathrm{avail}}\big)`,
        sym: [[T`\varepsilon`, "effectiveness with a condensing vapour on one side", "–", "0–1"], [T`UA`, "condenser conductance", "W/K", "5000 (assumed)"], [T`C_{cw}`, "heat-capacity rate of the cooling water", "W/K", "70–2100"], [T`Q_{\mathrm{avail}}`, "most heat the water can remove", "W", "computed"], [T`T_{\mathrm{bub}}`, "bubble point of the condensate", "K", "about 351.8"], [T`T_{cw}`, "cooling-water inlet temperature", "K", "286.3"], [T`Q_C`, "heat removed; if the vapour needs more, the rest is vented", "W", "computed"], [T`V_1,\,H_1,\,y_1`, "flow, enthalpy and composition of the vapour from tray 1", "mol/s, J/mol, –", "computed"], [T`h(y_1, T_{\mathrm{refl}})`, "enthalpy of the subcooled reflux", "J/mol", "Eq. (7)"]],
        live: () => { const q = c(), o = q.cfg.operation, Cw = (q.faults.coolingWaterFail ? 0 : o.coolingWaterLpm / 60) * 4180, e = Cw > 0 ? 1 - Math.exp(-o.condenserUA / Cw) : 0; return `C_cw = ${f0(Cw)} W/K, ε = ${f3(e)}, Q_avail = ${f1(q.condenserCapacity / 1000)} kW; Q_C = ${f1(q.Qc / 1000)} kW; vented ${f3(q.vent)} mol/s`; } },
      { no: 17, name: "Reflux splitter", refs: [12], go: ["condenser", "Reflux splitter"], assumed: "The 15 s drain time of the small condensate holdup is a modelling choice.",
        tex: T`L_0 = \frac{R}{R+1}\,\frac{M_0}{\tau}, \qquad D = \frac{1}{R+1}\,\frac{M_0}{\tau}`,
        sym: [[T`L_0`, "reflux returned to tray 1", "mol/s", "computed"], [T`R`, "reflux ratio set on the splitter", "–", "0.5–12, or total reflux"], [T`M_0`, "condensate held in the condenser and splitter", "mol", "solved"], [T`\tau`, "drain time of that holdup", "s", "15 (assumed)"], [T`D`, "distillate product", "mol/s", "computed"]],
        live: () => { const q = c(), R = q.cfg.operation.refluxRatio; return `R = ${R > 50 ? "total" : f2(R)}: L₀ = ${f4(q.L[0])}, D = ${f4(q.D)} mol/s; internal reflux on tray 1 is ${f4(q.L[1])} mol/s`; } },
      { no: 18, name: "Heat loss through the wall", refs: [13, 17], go: ["balances", "Energy & balances"], tex: T`Q_{\mathrm{loss},i} = U_w\,A_w\,(T_i - T_{\mathrm{amb}})`,
        sym: [[T`Q_{\mathrm{loss},i}`, "heat lost from stage i to the room", "W", "120–180 per tray"], [T`U_w`, "wall heat-transfer coefficient", "W/m²·K", "9.29 (lab workbook)"], [T`A_w`, "outside area per tray section, with flanges", "m²", "0.235 (lab workbook)"], [T`T_i`, "temperature of stage i", "K", "351–376"], [T`T_{\mathrm{amb}}`, "room temperature", "K", "293.7"]],
        live: () => { const q = c(), i = Math.min(14, Math.max(1, stg)); return `Tray ${i}: 9.29 × 0.235 × (${f1(C(q.T[i]))} − 20.6) = ${f0(q.Qloss[i])} W; all stages ${f2(q.Qloss.reduce((a, b) => a + b, 0) / 1000)} kW`; } },
    ] },
    { group: "Control", courses: [470], items: [
      { no: 19, name: "Level controller on the bottoms flow", refs: [14], go: ["control", "Control loops"], assumed: "Tuning chosen for this column, not taken from the lab.",
        tex: T`B = B_0 + K_c\left(e + \frac{1}{\tau_I}\int_0^{t} e\,dt'\right), \qquad e = \ell - \ell_{sp}`,
        sym: [[T`B`, "bottoms flow, limited to 0–B_max", "mol/s", "computed"], [T`B_0`, "bias, the expected bottoms flow", "mol/s", "F − D of the lab run"], [T`K_c`, "controller gain", "mol/s per unit level", "2 F (assumed)"], [T`e`, "level error", "–", "computed"], [T`\tau_I`, "integral time", "s", "300 (assumed)"], [T`t`, "time", "s", "–"], [T`\ell,\,\ell_{sp}`, "reboiler level and its set point, as fractions of the working volume", "–", "set point 0.6"]],
        live: () => { const q = c(); return `Level ${f3(q.reboilerLevel)} (set ${f2(q.cfg.operation.reboilerLevelSP)}) → B = ${f3(q.B)} mol/s`; } },
      { no: 20, name: "Temperature controllers with anti-windup", refs: [14, 15], go: ["control", "Control loops"], assumed: "Tunings chosen for this column by step tests on the model.",
        tex: T`u = u_0 + K_c\left(e + \frac{1}{\tau_I}\int_0^{t} e\,dt'\right), \qquad e = \pm\,(T_j - T_{sp})`,
        sym: [[T`u`, "controller output: the reflux ratio (loop on tray 4) or the steam duty (loop on tray 5), held within limits", "– or W", "0.2–20; 0–120 000"], [T`u_0`, "output at the moment the loop was switched to Auto", "– or W", "–"], [T`K_c`, "controller gain", "1/K or W/K", "0.6; 1500 (assumed)"], [T`e`, "error; + for the reflux loop, − for the steam loop", "K", "computed"], [T`\tau_I`, "integral time; the integral stops while the output is at a limit", "s", "240; 300 (assumed)"], [T`t`, "time", "s", "–"], [T`T_j`, "temperature of the controlled tray", "K", "measured in the model"], [T`T_{sp}`, "set point", "K", "the value at switch-over, or typed"]],
        live: () => { const q = c(), cc = q.cfg.control; return `Tray 4: ${f2(C(q.T[4]))} °C, reflux loop ${cc.top.mode}${cc.top.mode === "auto" ? `, set ${f2(C(cc.top.sp))} °C` : ""}; tray 5: ${f2(C(q.T[5]))} °C, steam loop ${cc.tray.mode}`; } },
    ] },
    { group: "Calibration and performance", courses: [355, 424, 450], items: [
      { no: 21, name: "Least-squares fit of the two tray efficiencies", refs: [17], go: ["lab", "Lab runs"], tex: T`\min_{E_r,\,E_s}\ \sum_{r=1}^{4}\ \sum_{j=1}^{16} \big(x^{\mathrm{model}}_{r,j} - x^{\mathrm{lab}}_{r,j}\big)^{2}, \qquad \mathrm{RMSE} = \sqrt{\frac{\mathrm{SSE}}{n}}`,
        sym: [[T`E_r,\,E_s`, "Murphree efficiencies above and below the feed tray", "–", "fitted: 0.90, 1.00"], [T`r`, "lab run", "–", "1–4"], [T`j`, "sample: 14 trays, distillate, bottoms", "–", "1–16"], [T`x^{\mathrm{model}}_{r,j}`, "model liquid mole fraction at steady state", "–", "computed"], [T`x^{\mathrm{lab}}_{r,j}`, "measured liquid mole fraction, from sample density", "–", "lab workbook"], [T`\mathrm{SSE},\,n`, "sum of squared errors and number of samples", "–, –", `n = ${VALID.nAll}`], [T`\mathrm{RMSE}`, "root-mean-square error", "–", String(VALID.rmseAll)]],
        live: () => { const r = VALID.runs[S.run], q = c(); return `${r.name}: RMSE ${r.rmse} at the fitted values; now E_r = ${f2(q.cfg.operation.murphreeFixed)}, E_s = ${f2(q.cfg.operation.murphreeStrip)}`; } },
      { no: 22, name: "Recovery and energy per litre of product", refs: [12], go: ["balances", "Energy & balances"], tex: T`\eta = \frac{D\,x_D}{F\,z_F}, \qquad e_D = \frac{Q_R}{\dot V_D}`,
        sym: [[T`\eta`, "share of the ethanol fed that leaves in the distillate", "–", "0–1"], [T`D,\,F`, "distillate and feed molar flows", "mol/s", "computed"], [T`x_D,\,z_F`, "ethanol mole fractions in distillate and feed", "–", "computed"], [T`e_D`, "steam heat per volume of distillate", "kWh/L", "computed"], [T`Q_R`, "reboiler duty", "kW", "15–110"], [T`\dot V_D`, "distillate volume flow at 25 °C", "L/h", "computed"]],
        live: () => { const s = S.sum; return `η = ${f1(Math.min(100, s.recovery * 100))} %; e_D = ${f1(s.Qr / 1000)} kW ÷ ${f1(s.Dlph)} L/h = ${Number.isFinite(s.kWhPerL) ? f2(s.kWhPerL) : "–"} kWh/L`; } },
    ] },
  ];
  const all = EQ.flatMap(g => g.items), eqByNo = no => all.find(e => e.no === no) || all[0];
  const geo = LAB_META.column, F = CALIBRATION;
  const PARAMS = [
    ["Column", "14 sieve trays plus a reboiler; inside diameter; tray spacing; weir height; feed on tray 12", `${geo.diameter_m} m; ${geo.traySpacing_m} m; ${geo.weirHeight_m} m`, `lab workbook${ref(17)}`],
    ["Wall loss", "wall coefficient and area per tray; reboiler coefficient and area", `${geo.Un_Wm2K.toFixed(2)} W/m²·K, ${geo.An_m2.toFixed(3)} m²; ${geo.Ureb_Wm2K.toFixed(2)} W/m²·K, ${geo.Areb_m2.toFixed(2)} m²`, `lab workbook${ref(17)}`],
    ["Tray efficiency", "Murphree vapour efficiency above and below the feed", `${F.E_rect.toFixed(2)}, ${F.E_strip.toFixed(2)}`, `fitted to the four runs${ref(17)}, Eq. (21)`],
    ["Boil-up duty", "set per run so the model reflux flow matches the reflux rotameter", VALID.runs.map(r => `${r.duty}`).join(", ") + " kW", `fitted; steam meter read ${VALID.runs.map(r => r.steamLab).join(", ")} kW`],
    ["Tray deck", "hole diameter; open area; downcomer area; orifice coefficient", "3.2 mm; 10 %; 10 %; 0.73", "assumed: no deck drawing was available"],
    ["Flooding factor", "multiplier on the flooding velocity, Eq. (13)", "1.4", "assumed, so the measured runs stay below flooding"],
    ["Reboiler and condenser", "reboiler working volume; condenser conductance", "40 L; 5000 W/K", "assumed"],
    ["Antoine constants", "ethanol and water, Eq. (5)", "see Eq. (5)", `widely tabulated values, form as in${ref(2)}; not traced to one primary table; checked against handbook data${ref(11)}`],
    ["NRTL parameters", "ethanol (1) – water (2), Eq. (6)", "see Eq. (6)", `as used in the source twin, which attributes them to a process-simulator databank; model form${ref(1)}; checked against handbook data${ref(11)}`],
    ["Pure-component data", "boiling point, critical temperature, heat of vaporization, liquid heat capacity", "see Eq. (7)", `standard values${ref(2)}`],
    ["Liquid density, viscosity, surface tension", "simple temperature and composition fits used for the hydraulics", "–", "assumed fits, as coded in the source twin"],
    ["Alcohol by volume", "density of ethanol–water mixtures at 20 °C, used to convert mole fraction to % ABV", "table, 21 points", `${ref(16)}`],
    ["Controller tuning", "level loop; tray 4 → reflux; tray 5 → steam", "see Eqs. (19), (20)", "assumed; adjustable in the panel"],
    ["Splitter drain time", "Eq. (17)", "15 s", "assumed"],
  ];

  function drawRun(cv, run, vr) {
    const r = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio, 2); if (r.width < 4) return; cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); const w = r.width, h = r.height, m = { l: 30, r: 6, t: 16, b: 26 }, n = 15, pw = w - m.l - m.r, phh = h - m.t - m.b;
    const X = i => m.l + (i - 0.5) / n * pw, Y = v => m.t + phh - v / 0.8 * phh, ink2 = getComputedStyle(document.documentElement).getPropertyValue("--ink-2"), rule = getComputedStyle(document.documentElement).getPropertyValue("--rule");
    g.font = "10px JetBrains Mono, monospace"; g.fillStyle = ink2; g.strokeStyle = rule; g.lineWidth = 1; g.textAlign = "right"; g.textBaseline = "middle";
    for (const t of [0, 0.2, 0.4, 0.6, 0.8]) { g.beginPath(); g.moveTo(m.l, Y(t)); g.lineTo(w - m.r, Y(t)); g.stroke(); g.fillText(t.toFixed(1), m.l - 3, Y(t)); }
    g.textAlign = "center"; g.textBaseline = "top"; for (const i of [1, 5, 10, 15]) g.fillText(i === 15 ? "R" : String(i), X(i), h - m.b + 3); g.fillText("tray", m.l + pw / 2, h - 12);
    g.textAlign = "left"; g.textBaseline = "alphabetic"; g.font = "600 11px Barlow Semi Condensed, sans-serif"; g.fillStyle = "#1d2733"; g.fillText(`${run.name}: ${run.totalReflux ? "total reflux" : "reflux " + (run.L0 / run.D).toFixed(1)} · RMSE ${vr.rmse}`, m.l, 11);
    g.strokeStyle = "#c5050c"; g.lineWidth = 1.8; g.beginPath(); for (let i = 1; i <= 15; i++) i === 1 ? g.moveTo(X(i), Y(vr.x[i])) : g.lineTo(X(i), Y(vr.x[i])); g.stroke();
    g.fillStyle = "#1d2733"; run.xTrays.forEach((v, k) => { g.beginPath(); g.arc(X(k + 1), Y(v), 2.4, 0, 7); g.fill(); });
  }
  function render() {
    const V = VALID, N = 14;
    $("mdl-body").innerHTML = `
      <h3>1. What is modeled</h3>
      <p>A 14-tray sieve column with a reboiler, a total condenser and a reflux splitter, separating ethanol and water at room pressure. The states are the liquid holdup and its ethanol content on each of 16 stages (32 in all). A visitor can change the reflux ratio, steam duty, feed flow, feed strength and temperature, cooling water, the two tray efficiencies, three faults and two temperature controllers. Outputs are the compositions, temperatures and flows on every tray, the product strength, the energy use and how close each tray is to flooding. The model and its calibration are those of the department's distillation twin; the geometry and four sets of measurements come from student runs in the summer lab${ref(17)}.</p>
      <h3>2. Governing equations</h3>
      <p class="mdl-stage"><label for="mdl-stg">Live lines are shown for</label><select id="mdl-stg">${Array.from({ length: N }, (_, k) => `<option value="${k + 1}" ${k + 1 === stg ? "selected" : ""}>tray ${k + 1}${k + 1 === 12 ? " (feed)" : ""}</option>`).join("")}</select><span>Stages: 0 condenser and splitter, 1–14 trays from the top, 15 reboiler.</span></p>
      ${EQ.map(G => { const nos = G.items.map(e => e.no);
        return `<h4 class="mdl-grp">${G.group} <small>${nos.length === 1 ? `Eq. (${nos[0]})` : `Eqs. (${nos[0]})–(${nos[nos.length - 1]})`}</small><span class="mdl-courses">${G.courses.map(courseLink).join("")}</span></h4>${G.items.map(e => `<div class="mdl-eq" id="eq-${e.no}">
          <div class="mdl-h"><span class="mdl-n">(${e.no})</span><span class="mdl-name">${e.name}${e.refs.length ? ref(...e.refs) : ""}</span><button class="btn mdl-go" type="button" data-go="${e.go[0]}" title="${e.go[1]}">Show in the twin ▸</button></div>
          <div class="mdl-tex">${tex(e.tex.replace(/\\frac/g, "\\dfrac"), true)}</div>
          ${e.assumed ? `<p class="mdl-assumed"><span class="mdl-src">Assumed</span>${e.assumed}</p>` : ""}
          <div class="mdl-scroll"><table class="mdl-tab"><thead><tr><th>Symbol</th><th>Meaning</th><th>Units</th><th>Value or range</th></tr></thead><tbody>${e.sym.map(r => `<tr><td>${tex(r[0])}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join("")}</tbody></table></div>
          <p class="mdl-live" data-live="${e.no}"></p>
        </div>`).join("")}`; }).join("")}
      <h3>3. Parameters and data</h3>
      <div class="mdl-scroll"><table class="mdl-tab"><thead><tr><th>Item</th><th>Meaning</th><th>Value</th><th>Source</th></tr></thead><tbody>
        ${PARAMS.map(p => `<tr><td>${p[0]}</td><td>${p[1]}</td><td>${p[2]}</td><td>${p[3]}</td></tr>`).join("")}</tbody></table></div>
      <p class="note">Lab data: ${LAB_RUNS.length} runs (two at total reflux, two with feed), ${V.nAll} liquid compositions from sample densities, plus flows, top and bottom temperatures, and steam and cooling-water meter readings${ref(17)}.</p>
      <h3 id="m-num">4. Numerical method</h3>
      <ul class="mdl-list">
        <li>Eqs. (1) and (2) are 32 ordinary differential equations, stepped with explicit Euler at Δt = ${DT} s: ${f0(3600 / DT)} steps per hour of plant time.</li>
        <li>Each step first solves the algebraic part: bubble points (4) by Newton's method on temperature (tolerance 10⁻⁷ K, started from the last value), then liquid flows (11), vapour flows from the energy balances (3) from the reboiler upward, the condenser (16), and the hydraulics (12)–(15).</li>
        <li>The holdup term in (3) uses the composition change of the previous step, which avoids an algebraic loop; the enthalpy slope is refreshed every 20 steps.</li>
        <li>Controllers (19) and (20) are updated every step, with the integral frozen while the output is at a limit.</li>
        <li>The page opens from a stored steady state (3 h of plant time, computed ahead of time by <code>gen_init.mjs</code>).</li>
        <li>Halving the step to 0.05 s changes the steady distillate composition from ${V.step.xD_01} to ${V.step.xD_005}.</li>
      </ul>
      <h3>5. Assumptions and limits</h3>
      <ul class="mdl-list">
        <li>Vapour holdup is neglected; liquid on every stage is perfectly mixed and at its bubble point; the vapour phase is an ideal gas.</li>
        <li>One efficiency for all trays above the feed and one for all below. The best values differ from run to run, so the pair is a compromise.</li>
        <li>The hole size, open area, flooding factor, reboiler volume and condenser conductance were assumed, not measured. Flooding and weeping are therefore indications, not predictions for a real column.</li>
        <li>The boil-up of each run is set from the reflux rotameter. The steam and cooling-water meters disagree with it (see Validation), so absolute energy numbers carry that uncertainty.</li>
        <li>Start-up from a cold, empty column, tray drying and pressure dynamics are not modeled. The cold start in the problem sets begins with every stage hot and at the feed composition.</li>
        <li>This is a generic educational model that resembles the lab column. It is not a copy of that equipment and must not be used for operating or safety decisions.</li>
      </ul>
      <h3 id="m-val">6. Validation</h3>
      <p class="takeaway"><b>What this means</b>In short: the thermodynamics match handbook data within ${V.vle.maxDy.toFixed(3)} in vapour mole fraction, and mass and energy close to rounding. Against ${V.nAll} lab samples the typical error is ${V.rmseAll.toFixed(2)} in mole fraction: the tray profiles are captured, but the model distillate is about 0.07 too rich in Runs 1 and 2.</p>
      <div class="mdl-scroll"><table class="mdl-tab"><thead><tr><th>Check</th><th>Twin</th><th>Reference</th><th>Difference</th></tr></thead><tbody>
        <tr><td>Ethanol–water equilibrium at 1 atm, ${V.vle.n} points${ref(11)}</td><td>NRTL + Antoine</td><td>handbook data</td><td>largest error ${V.vle.maxDy} in y, ${V.vle.maxDT} K in T</td></tr>
        <tr><td>Azeotrope at 1 atm${ref(11)}</td><td>${(V.vle.azX * 100).toFixed(1)} mol %, ${V.vle.azT} °C (${V.vle.azABV} % ABV)</td><td>about 89.4 mol %, 78.2 °C</td><td>0.3 mol %</td></tr>
        <tr><td>Mass balance at steady state (Run 2 conditions)</td><td>out ${V.bal.massOut} kg/h</td><td>in ${V.bal.massIn} kg/h</td><td>below 0.001 %</td></tr>
        <tr><td>Ethanol balance</td><td>out ${V.bal.ethOut} mol/s</td><td>in ${V.bal.ethIn} mol/s</td><td>${Math.abs(V.bal.ethOut - V.bal.ethIn).toExponential(0)} mol/s</td></tr>
        <tr><td>Energy balance: steam + feed = condenser + walls + products</td><td>out ${V.bal.energyOut} kW</td><td>in ${V.bal.energyIn} kW</td><td>${V.bal.relE.toExponential(0)} relative</td></tr>
        ${V.runs.map(r => `<tr><td>${r.name} (${LAB_RUNS.find(q => q.name === r.name).totalReflux ? "total reflux" : "with feed"}): liquid compositions, ${r.n} samples${ref(17)}</td><td>distillate ${r.xD}, bottoms ${r.xB}; ${r.Ttop} / ${r.Tbot} °C</td><td>distillate ${r.xDlab}, bottoms ${r.xBlab}; ${r.TtopLab} / ${r.TbotLab} °C</td><td>RMSE ${r.rmse}; worst tray ${r.worstTray} (${r.worstErr > 0 ? "+" : ""}${r.worstErr})</td></tr>`).join("")}
        <tr><td>All four runs</td><td colspan="2">${V.nAll} samples, efficiencies ${V.fit.E_rect} and ${V.fit.E_strip} (fitted ${V.fit.fittedOn})</td><td>RMSE ${V.rmseAll}</td></tr>
        <tr><td>Energy meters against the model, Runs 1–4</td><td>boil-up ${V.runs.map(r => r.duty).join(", ")} kW; condenser ${V.runs.map(r => r.Qc).join(", ")} kW</td><td>steam meter ${V.runs.map(r => r.steamLab).join(", ")} kW; cooling water ${V.runs.map(r => r.QcwLab).join(", ")} kW</td><td>meters read lower than the duty the measured reflux needs</td></tr>
      </tbody></table></div>
      <div class="val-grid">${LAB_RUNS.map((r, k) => `<canvas data-run="${k}" aria-label="${r.name}: model line against lab samples of liquid ethanol mole fraction on each tray"></canvas>`).join("")}</div>
      <p class="takeaway"><b>What this means</b>Red lines are the model, dots are student samples (ethanol mole fraction in the liquid on each tray). The shape and position of the composition front are right; the top two trays are where the model is too rich.</p>
      <p class="note">Scripts in the twin's folder: <code>validate.mjs</code> (these numbers), <code>gen_init.mjs</code>, <code>problems_check.mjs</code>.</p>
      <h3>References</h3>
      <ol class="refs">${REFS.map((r, i) => `<li id="mref-${i + 1}">${r}</li>`).join("")}</ol>`;
    $("mdl-stg").onchange = e => { stg = +e.target.value; refreshLive(); };
    document.querySelectorAll("#mdl-body canvas[data-run]").forEach(cv => { const k = +cv.dataset.run; drawRun(cv, LAB_RUNS[k], VALID.runs[k]); });
    refreshLive(); plainTypeset = typesetIn($("mdl-body"));
  }
  function refreshLive() { document.querySelectorAll("#mdl-body [data-live]").forEach(el => { const e = eqByNo(+el.dataset.live); let v; try { v = "Now: " + e.live(); } catch (err) { v = ""; } if (el.__v !== v) { el.__v = v; el.innerHTML = mathText(v.replace(/&/g, "&amp;").replace(/</g, "&lt;")); } }); }
  function toggle(on, anchorId) { open = on; $("mdl-panel").hidden = !on; if (on) { render(); if (anchorId) requestAnimationFrame(() => $(anchorId)?.scrollIntoView({ block: "start" })); else $("mdl-close").focus(); } }
  $("open-model").onclick = () => toggle(true); $("mdl-close").onclick = () => toggle(false);
  $("mdl-panel").addEventListener("click", e => { if (e.target.id === "mdl-panel") toggle(false); const g = e.target.closest("[data-go]"); if (g && GO[g.dataset.go]) { toggle(false); GO[g.dataset.go](); } });
  void hy; void col;
  return { toggle, isOpen: () => open, refreshLive, eqByNo, mathText, typesetIn, plainCount: () => plainTypeset, tex: (s, d) => tex(s.replace(/\\frac/g, "\\dfrac"), d), EQ };
}
