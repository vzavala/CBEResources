// The Human Body: whole-body model. Organs are unit operations in one connected plant.
// Time unit: minutes. One body: 70 kg, skin area 1.8258 m² (the defaults of the Gagge model).
// Sub-models:
//   activity  -> oxygen use and heat made (Compendium METs, 1 MET = 3.5 mL O2/kg/min)
//   skin/core -> Gagge two-node thermoregulation (exact port of pythermalcomfort's loop, 1-min steps)
//   heart     -> organ beds draw flow (Poiseuille resistances), heart supplies the sum
//   lungs     -> alveolar gas equation + Hill O2 curve + O2 diffusion along a lung capillary (Bohr integration)
//   kidneys   -> filtration = filtration fraction × renal plasma flow; urine set by water balance
//   liver     -> well-stirred reactor with Michaelis–Menten caffeine breakdown
//   gut/blood -> meal glucose absorption + Bergman minimal model with insulin secretion
//   drug      -> one-compartment caffeine pharmacokinetics with first-order absorption
export const P = {
  mass: 70, bsa: 1.8258, age: 17,
  // activity levels (Compendium of Physical Activities codes in sim notes); v = air speed over the body, m/s
  ACT: {
    rest: { met: 1.0, v: 0.1, label: "Sitting quietly", code: "07021" },
    walk: { met: 3.8, v: 1.39, label: "Walking 2.8–3.4 mph", code: "17190" },
    jog: { met: 8.5, v: 2.28, label: "Jogging 5 mph", code: "12030" },
    run: { met: 9.3, v: 2.72, label: "Marathon pace, 6 mph", code: "12050" },
  },
  clo: 0.3,                 // light running clothes (assumed)
  kJperLO2: 20.92,          // energy per litre of O2 used: about 5 kcal
  RER: 0.8,                 // CO2 made / O2 used (mixed diet, assumed)
  VO2max: 45,               // mL/kg/min, a moderately fit young person (assumed)
  // circulation: resting flow to each organ bed, L/min (sums to resting cardiac output)
  BEDS: { brain: 0.75, heart: 0.25, muscle: 1.2, skin: 0.5, kidneys: 1.1, gut: 1.4, other: 0.6 },   // OpenStax Table 20.3, rest
  BEDSMAX: { heart: 0.75, kidneys: 0.6, gut: 0.6, other: 0.4 },                                     // same table, maximal exercise
  MAP0: 93,                 // mean arterial pressure at rest, mmHg
  SV0: 70, SVmax: 110,      // stroke volume at rest and in exercise, mL (assumed)
  Emus: 0.85,               // fraction of O2 that working muscle pulls out of its blood (assumed)
  // blood and lungs
  Hb: 15, Hct: 0.45,
  FIO2: 0.2093, PH2O: 47,
  Vc0: 75, Vcmax: 200,      // lung capillary blood volume, mL: 75 in use at rest, ~200 in all capillaries
  kDL: 0.4,                 // DL/Vc: DLO2 ≈ 30 mL/(min·mmHg) at rest with 75 mL
  // kidneys and water
  FF: 0.2, osmLoad: 880,    // filtration fraction; solutes to excrete, mOsm/day (set so urine ≈ 1.5 L/day when hydrated)
  TBWfrac: 0.6, Posm0: 287, // total body water fraction of mass; normal plasma osmolality, mOsm/kg
  UosmMin: 50, UosmMax: 1200, PosmLo: 280, PosmHi: 295,
  kDrink: 0.05,             // 1/min, water leaves the gut into blood (assumed)
  metWater: 0.23,           // L/day of water made by burning food (OpenStax §26.2: about 230 mL)
  // caffeine (one compartment)
  cafVd: 0.6, cafHalf: 4, cafKa: 0.075, cafF: 1, cafKm: 58, // L/kg; h; 1/min (peak ≈ 45 min); -; mg/L (CYP1A2 Km 300 µM × 194 g/mol)
  // glucose–insulin (Bergman minimal model + secretion) and meal absorption
  Gb: 80, Ib: 7, p1: 0.0317, p2: 0.0123, p3: 4.92e-6, n: 0.2659, gam: 0.15, h: 80, VG: 117 / 70, // healthy set (Saleem & Iqbal 2024); VolG 117 dL (Roy & Parker 2007); gam calibrated
  AG: 0.8, tmaxG: 40,       // carbohydrate bioavailability; gut time constant, min (Hovorka 2004)
};

// ---------- surroundings ----------
export function baroP(alt) { const h = alt / 1000; return Math.exp(6.63268 - 0.1112 * h - 0.00149 * h * h); }   // mmHg, West 1996 model atmosphere
export const psatTorr = T => Math.exp(18.6686 - 4030.183 / (T + 235));               // as in pythermalcomfort
export function activityVO2(act) { return P.ACT[act].met * 3.5 * P.mass; }           // mL O2 / min
export function heatW(VO2) { return VO2 / 1000 * P.kJperLO2 * 1000 / 60; }            // W

// ---------- thermoregulation: Gagge two-node model (one-minute explicit steps) ----------
export function gaggeInit(met = 1) {
  return { t_skin: 33.7, t_core: 36.8, m_bl: 6.3, alfa: 0.1, e_skin: 0.1 * met, m: null, e_rsw: 0, e_diff: 0, e_max: 0, m_rsw: 0, m_rsw_reg: 0, w: 0.06, w_max: 0.59, q_sensible: 0, q_res: 0, c_res: 0 };
}
// env: { tdb, tr, v, rh, met, clo, p_atm (Pa) }; standing posture; wme = 0
export function gaggeStep(st, env, opts = {}) {
  const { tdb, tr, met, clo } = env, wme = 0, body_weight = 70, met_factor = 58.2, sbc = 0.000000056697;
  const c_sw = 170, c_dil = 120, c_str = 0.5, tsn = 33.7, tcn = 36.8, alfa0 = 0.1, tbn = alfa0 * tsn + (1 - alfa0) * tcn, sbfn = 6.3;
  const max_sbf = 90, max_sw = 500, vp = env.rh * psatTorr(tdb) / 100;
  const air = Math.max(env.v, 0.1), patm = (env.p_atm ?? 101325) / 101325;
  const r_clo = 0.155 * clo, f_a_cl = 1 + 0.15 * clo, lr = 2.2 / patm, rm = (met - wme) * met_factor;
  if (st.m == null) st.m = met * met_factor;
  const m0 = met * met_factor;
  const i_cl = clo > 0 ? 0.45 : 1;
  const w_max = clo > 0 ? 0.59 * Math.pow(air, -0.08) : 0.38 * Math.pow(air, -0.29);
  let h_cc = Math.max(3.0 * Math.pow(patm, 0.53), 8.600001 * Math.pow(air * patm, 0.53));
  if (met > 0.85) h_cc = Math.max(h_cc, 5.66 * Math.pow(met - 0.85, 0.39));
  // as upstream, h_r, r_a and t_op carry over from the previous minute (they seed the clothing-temperature loop)
  let h_r = st.h_r ?? 4.7, h_t = h_r + h_cc, r_a = st.r_a ?? 1 / (f_a_cl * h_t), t_op = st.t_op ?? (h_r * tr + h_cc * tdb) / h_t;
  if (st.h_r == null) { r_a = 1 / (f_a_cl * (4.7 + h_cc)); t_op = (4.7 * tr + h_cc * tdb) / (4.7 + h_cc); }
  st.q_res = 0.0023 * m0 * (44 - vp); st.c_res = 0.0014 * m0 * (34 - tdb);
  let { t_skin, t_core, m_bl, alfa, e_skin } = st;
  let t_cl = (r_a * t_skin + r_clo * t_op) / (r_a + r_clo);
  for (let it = 0; ; it++) {
    h_r = 4 * 0.95 * sbc * Math.pow((t_cl + tr) / 2 + 273.15, 3) * 0.73;
    h_t = h_r + h_cc; r_a = 1 / (f_a_cl * h_t); t_op = (h_r * tr + h_cc * tdb) / h_t;
    const nw = (r_a * t_skin + r_clo * t_op) / (r_a + r_clo);
    const done = Math.abs(nw - t_cl) <= 0.01; t_cl = nw; if (done || it > 150) break;
  }
  const q_sensible = (t_skin - t_op) / (r_a + r_clo);
  const hf_cs = (t_core - t_skin) * (5.28 + 1.163 * m_bl);
  const s_core = st.m - hf_cs - st.q_res - st.c_res - wme, s_skin = hf_cs - q_sensible - e_skin;
  const tc_sk = 0.97 * alfa * body_weight, tc_cr = 0.97 * (1 - alfa) * body_weight;
  t_skin += s_skin * P.bsa / (tc_sk * 60); t_core += s_core * P.bsa / (tc_cr * 60);
  const t_body = alfa * t_skin + (1 - alfa) * t_core;
  const sk = t_skin - tsn, warm_sk = Math.max(sk, 0), colds = Math.max(-sk, 0);
  const cr = t_core - tcn, c_warm = Math.max(cr, 0), c_cold = Math.max(-cr, 0), warm_b = Math.max(t_body - tbn, 0);
  m_bl = Math.max(Math.min((sbfn + c_dil * c_warm) / (1 + c_str * colds), max_sbf), 0.5);
  let m_rsw = Math.min(c_sw * warm_b * Math.exp(warm_sk / 10.7), max_sw);
  if (opts.noControl) { m_bl = sbfn; m_rsw = 0; }   // temperature control switched off (demonstration): fixed skin blood flow, no sweating, no shivering
  let e_rsw = 0.68 * m_rsw;
  const r_ea = 1 / (lr * f_a_cl * h_cc), r_ecl = r_clo / (lr * i_cl);
  let e_max = (psatTorr(t_skin) - vp) / (r_ea + r_ecl); if (e_max === 0) e_max = 0.001;
  let p_rsw = e_rsw / e_max, w = 0.06 + 0.94 * p_rsw, e_diff = w * e_max - e_rsw;
  if (w > w_max) {
    w = w_max;
    p_rsw = opts.legacyCap ? w_max / 0.94 : (w_max - 0.06) / 0.94;
    e_rsw = p_rsw * e_max; e_diff = 0.06 * (1 - p_rsw) * e_max;
  }
  if (e_max < 0) { e_diff = 0; e_rsw = 0; w = w_max; }
  e_skin = e_rsw + e_diff;
  const m_rsw_evap = e_rsw / 0.68;
  st.m = rm + (opts.noControl ? 0 : 19.4 * colds * c_cold);
  st.shiver = opts.noControl ? 0 : 19.4 * colds * c_cold;
  alfa = 0.0417737 + 0.7451833 / (m_bl + 0.585417);
  Object.assign(st, { t_skin, t_core, m_bl, alfa, e_skin, e_rsw, e_diff, e_max, w, w_max, q_sensible, m_rsw_reg: m_rsw, m_rsw: m_rsw_evap, t_op, h_r, r_a, h_cc, r_clo });
  return st;
}

// ---------- blood oxygen ----------
export const HILL = { n: 2.7, P50: 26.8 };                                           // Dash & Bassingthwaighte 2010
export const sat = Pm => { const x = Math.pow(Math.max(Pm, 0) / HILL.P50, HILL.n); return x / (1 + x); };   // Hill equation
const dsat = Pm => { const s = sat(Pm); return HILL.n * s * (1 - s) / Math.max(Pm, 1e-9); };
export const O2content = Pm => 1.34 * P.Hb * sat(Pm) + 0.003 * Pm;                  // mL O2 / dL blood
function PfromContent(C) { let lo = 0, hi = 700; for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; (O2content(m) < C ? lo = m : hi = m); } return (lo + hi) / 2; }

// Alveolar PCO2 falls at altitude because people breathe harder in thin air. West et al. 1983 found it falls
// approximately linearly with barometric pressure, to 7.5 mmHg on the Everest summit (253 mmHg); acclimatized climbers.
export function paco2(Pb) { return Math.min(40, 7.5 + (40 - 7.5) * (Pb - 253) / (760 - 253)); }
// O2 uptake along one lung capillary: dP/dt = (DL/Vc)(PA − P) / (dC/dP); returns the PO2 profile
export function lungCapillary(PA, Pv, tTransit, kDL, n = 400) {
  const f = Pm => kDL / 60 * (PA - Pm) / ((1.34 * P.Hb * dsat(Pm) + 0.003) / 100);   // per second; content per mL
  let Pm = Pv; const dt = tTransit / n, prof = [[0, Pm]];
  for (let i = 0; i < n; i++) {
    const k1 = f(Pm), k2 = f(Pm + dt / 2 * k1), k3 = f(Pm + dt / 2 * k2), k4 = f(Pm + dt * k3);
    Pm += dt / 6 * (k1 + 2 * k2 + 2 * k3 + k4); if (i % 20 === 19) prof.push([(i + 1) * dt, Pm]);
  }
  return { Pend: Pm, prof };
}
export function lungs(Pb, VO2, CO) {
  const PIO2 = P.FIO2 * (Pb - P.PH2O), PaCO2 = paco2(Pb), PAO2 = PIO2 - PaCO2 / P.RER;
  const VCO2 = P.RER * VO2, VA = 0.863 * VCO2 / PaCO2;                                   // L/min (BTPS)
  const Vc = Math.min(P.Vcmax, P.Vc0 + (P.Vcmax - P.Vc0) * Math.max(0, CO - 5) / 20);
  const tT = Vc / (CO * 1000) * 60;                                                    // s
  let Ca = O2content(Math.max(PAO2, 1)), cap = null, Pv = 0, Cv = 0, ok = true;
  for (let it = 0; it < 200; it++) {
    Cv = Ca - VO2 / (CO * 10);
    if (Cv <= 0.2) { Cv = 0.2; ok = false; }
    Pv = PfromContent(Cv);
    cap = lungCapillary(PAO2, Pv, tT, P.kDL);
    const Cn = O2content(cap.Pend);
    if (Math.abs(Cn - Ca) < 1e-10) { Ca = Cn; break; }
    Ca = Cn;
  }
  const Pa = cap.Pend, Pmid = cap.prof.find(p => p[1] > PAO2 - 1);
  return { Pb, PIO2, PaCO2, PAO2, VA, VCO2, Vc, tT, Pa, Sa: sat(Pa), Ca, Pv, Sv: sat(Pv), Cv, prof: cap.prof, tEq: Pmid ? Pmid[0] : null, sustain: ok, DL: P.kDL * Vc };
}

// ---------- circulation: organ beds draw flow; the heart supplies the total ----------
export function circulation(VO2, Ca, skinFlow, deficitL) {
  const VO2rest = P.ACT.rest.met * 3.5 * P.mass, VO2max = P.VO2max * P.mass;
  const effort = Math.min(1, Math.max(0, (VO2 - VO2rest) / (VO2max - VO2rest)));     // fraction of reserve
  const B = P.BEDS, Q = {};
  Q.brain = B.brain;
  Q.muscle = B.muscle + Math.max(0, VO2 - VO2rest) / (P.Emus * Ca * 10);              // Fick: extra O2 / O2 removed per L
  Q.skin = skinFlow;
  const X = P.BEDSMAX;
  for (const k of ["kidneys", "gut", "other", "heart"]) Q[k] = B[k] + (X[k] - B[k]) * effort;   // straight line rest -> max
  const CO = Object.values(Q).reduce((a, b) => a + b, 0);
  const MAP = P.MAP0 + 10 * effort;                                                     // mild rise in exercise (assumed)
  const fluid = Math.max(0.8, 1 - deficitL / (P.TBWfrac * P.mass));
  const SV = (P.SV0 + (P.SVmax - P.SV0) * Math.min(1, effort / 0.4)) * fluid;
  const HR = CO * 1000 / SV;
  const R = {}, rad = {}, CO0 = Object.values(B).reduce((a, b) => a + b, 0);
  for (const k in Q) { R[k] = MAP / Q[k]; rad[k] = Math.pow((P.MAP0 / B[k]) / R[k], 0.25); }
  return { Q, CO, CO0, MAP, SV, HR, effort, R, rad, TPR: MAP / CO };
}
// blood is shear-thinning: Carreau model (Cho & Kensey 1991 constants)
export const CARREAU = { mu0: 0.056, muInf: 0.00345, lam: 3.313, n: 0.3568 };
export const bloodVisc = g => CARREAU.muInf + (CARREAU.mu0 - CARREAU.muInf) * Math.pow(1 + (CARREAU.lam * g) ** 2, (CARREAU.n - 1) / 2);
export function poiseuille(Qlmin, r, L, mu) { const Q = Qlmin / 60000; return { dP: 8 * mu * L * Q / (Math.PI * r ** 4) / 133.322, shear: 4 * Q / (Math.PI * r ** 3) }; }

// ---------- kidneys ----------
export function kidney(RBF, deficitL) {
  const TBW0 = P.TBWfrac * P.mass, Posm = P.Posm0 * TBW0 / (TBW0 - deficitL);
  const u = Math.min(1, Math.max(0, (Posm - P.PosmLo) / (P.PosmHi - P.PosmLo)));
  const Uosm = P.UosmMin + (P.UosmMax - P.UosmMin) * u;
  const RPF = RBF * (1 - P.Hct), GFR = P.FF * RPF;                                       // L/min
  const urine = P.osmLoad / 1440 / Uosm;                                                 // L/min
  return { Posm, Uosm, RPF, GFR, urine, reabsorbed: 1 - urine / GFR };
}

// ---------- liver: well-stirred reactor with Michaelis–Menten enzyme ----------
export function caffeineCLlin() { return Math.LN2 / (P.cafHalf * 60) * P.cafVd * P.mass; }   // L/min at low dose
export function liverCL(C, QH, QH0) {
  const CL0 = caffeineCLlin(), CLint0 = CL0 * QH0 / (QH0 - CL0);       // intrinsic clearance at low dose
  const Vmax = CLint0 * P.cafKm, CLint = Vmax / (P.cafKm + C);          // mg/min ; L/min
  return { CL: QH * CLint / (QH + CLint), CLint, Vmax, E: CLint / (QH + CLint) };
}


// ---------- where the heat comes from: organ heat production ----------
// Resting specific metabolic rates K_i (kcal/kg/day, Elia) and organ masses of 21–30-year-olds averaging 70.0 kg (Wang et al. 2010)
export const ORGAN_K = { brain: 240, heart: 440, liver: 200, kidneys: 440, muscle: 13, adipose: 4.5, residual: 12 };
export const ORGAN_MASS = { brain: 1.33, heart: 0.31, liver: 1.35, kidneys: 0.28, muscle: 25.0, adipose: 18.4, residual: 22.8 };
// Split today's metabolic heat M among organs: resting shares from K_i·m_i, heart work scaling with MAP·CO, extra exercise heat to muscle
export function organHeat(now) {
  const kc = Object.fromEntries(Object.keys(ORGAN_K).map(k => [k, ORGAN_K[k] * ORGAN_MASS[k]]));
  const tot = Object.values(kc).reduce((a, b) => a + b, 0), Mrest = heatW(activityVO2("rest"));
  const H = Object.fromEntries(Object.keys(kc).map(k => [k, Mrest * kc[k] / tot]));
  const c = now.circ, heartRest = H.heart;
  H.heart = heartRest * (c.CO * c.MAP) / (c.CO0 * P.MAP0);
  H.muscle += Math.max(0, now.M - Mrest - (H.heart - heartRest));
  H.total = Object.keys(kc).reduce((a, k) => a + H[k], 0);
  H.kcalPerDayRest = tot; H.Mrest = Mrest;
  return H;
}
// ---------- each organ bed as a reactor: O2 in with arterial blood, O2 used, CO2 made ----------
// Organ heat -> O2 use (V̇O2,i = H_i/ε_O2); liver goes to the "other" bed (liver, spleen); adipose + residual split by flow among gut, skin, other
export function bedGas(now) {
  const H = organHeat(now), Q = now.circ.Q, Ca = now.lung.Ca, ml = W => W / (P.kJperLO2 * 1000) * 60 * 1000;   // W -> mL O2/min
  const rest = H.adipose + H.residual, qs = Q.gut + Q.skin + Q.other;
  const heatBed = { brain: H.brain, heart: H.heart, muscle: H.muscle, kidneys: H.kidneys,
    gut: rest * Q.gut / qs, skin: rest * Q.skin / qs, other: H.liver + rest * Q.other / qs };
  const beds = {};
  for (const k of Object.keys(heatBed)) {
    const VO2 = ml(heatBed[k]), Cv = Ca - VO2 / (Q[k] * 10);
    beds[k] = { Q: Q[k], heat: heatBed[k], VO2, VCO2: P.RER * VO2, Cv, ext: VO2 / (Q[k] * 10 * Ca) };
  }
  const VO2 = Object.values(beds).reduce((a, b) => a + b.VO2, 0);
  const Cmix = Object.values(beds).reduce((a, b) => a + b.Q * b.Cv, 0) / now.circ.CO;
  return { beds, VO2, VCO2: P.RER * VO2, Cmix, CaLung: Ca, CvLung: now.lung.Cv, pumpW: now.circ.MAP * 133.322 * now.circ.CO / 60000 };
}
// ---------- temperature-control demonstration: the same day with feedback on and off ----------
// Scenario: list of [minute from, activity, air °C, humidity %]; returns minute-by-minute core/skin temperatures and heat terms (W).
export const THERMO_SCENARIOS = {
  exercise: { label: "Jog for an hour at 22 °C", steps: [[0, "rest", 22, 50], [30, "jog", 22, 50], [90, "rest", 22, 50]], minutes: 240 },
  hot: { label: "Sit in a 40 °C, humid room", steps: [[0, "rest", 40, 60]], minutes: 240 },
  cold: { label: "Sit in a 5 °C room in light clothes", steps: [[0, "rest", 5, 50]], minutes: 240 },
};
export function thermoRun(scn, noControl) {
  const st = gaggeInit(1), out = [];
  for (let t = 1; t <= scn.minutes; t++) {
    let seg = scn.steps[0]; for (const sg of scn.steps) if (t - 1 >= sg[0]) seg = sg;
    const [, act, tdb, rh] = seg, A = P.ACT[act], M = heatW(activityVO2(act)), met = M / (58.2 * P.bsa);
    gaggeStep(st, { tdb, tr: tdb, v: A.v, rh, met, clo: P.clo, p_atm: 101325 }, { noControl });
    const Ab = P.bsa;
    out.push({ t, act, tdb, Tc: st.t_core, Ts: st.t_skin, M: M + st.shiver * Ab, shiver: st.shiver * Ab, dry: st.q_sensible * Ab, evap: st.e_skin * Ab, breath: (st.q_res + st.c_res) * Ab, mbl: st.m_bl, sweat: st.m_rsw_reg * Ab });
  }
  return out;
}

// ---------- heat balance and the local skin temperature a thermal camera sees ----------
export const C_BODY = 0.97 * 3600;   // J/(kg·K): body heat capacity 0.97 W·h/(kg·K), as in the Gagge model
export function heatBalance(now) {
  const th = now.th, A = P.bsa, dry = th.q_sensible * A, evap = th.e_skin * A, breath = (th.q_res + th.c_res) * A;
  const S = now.M - dry - evap - breath;
  return { M: now.M, dry, evap, breath, S, dTdt: S / (P.mass * C_BODY) * 3600, noCool: now.M / (P.mass * C_BODY) * 3600 };
}
// Local skin balance at a place where the body (or limb) has radius r: core heat carried by tissue and blood = heat lost to air.
// Thinner parts (fingers, nose, ears, feet) have a larger convection coefficient, h ∝ D^-0.4 for forced flow across cylinders.
export function skinLocalT(now, r, rRef) {
  if (now.th.h_cc == null) return now.th.t_skin;   // before the first one-minute step
  const th = now.th, Kb = 5.28 + 1.163 * th.m_bl, hc = th.h_cc * Math.pow(r / rRef, -0.4), ht = hc + th.h_r;
  const E = th.e_skin * hc / th.h_cc;
  return (Kb * th.t_core + ht * th.t_op - E) / (Kb + ht);
}

// ---------- dynamic states (RK4 within each minute) ----------
// y = [G, X, I, D1, D2, cafGut, cafBody, waterGut, deficit, bladder]
export function deriv(y, u) {
  const [G, X, I, D1, D2, Ag, Ab, Wg, D, Bl] = y, d = new Array(10).fill(0);
  const VGdl = P.VG * P.mass, Ra = D2 / P.tmaxG;                                       // mg/min
  d[0] = -(P.p1 + X) * G + P.p1 * P.Gb + Ra / VGdl;
  d[1] = -P.p2 * X + P.p3 * (I - P.Ib);
  d[2] = -P.n * (I - P.Ib) + P.gam * Math.max(G - P.h, 0);
  d[3] = -D1 / P.tmaxG; d[4] = D1 / P.tmaxG - D2 / P.tmaxG;
  const Vd = P.cafVd * P.mass, C = Ab / Vd, liv = liverCL(C, u.QH, u.QH0);
  d[5] = -P.cafKa * Ag; d[6] = P.cafF * P.cafKa * Ag - liv.CL * C;
  d[7] = -P.kDrink * Wg;
  d[8] = u.waterOut - P.kDrink * Wg - P.metWater / 1440;
  d[9] = u.urine;
  return d;
}
export function rk4(y, u, dt) {
  const k1 = deriv(y, u), y2 = y.map((v, i) => v + dt / 2 * k1[i]), k2 = deriv(y2, u), y3 = y.map((v, i) => v + dt / 2 * k2[i]);
  const k3 = deriv(y3, u), y4 = y.map((v, i) => v + dt * k3[i]), k4 = deriv(y4, u);
  return y.map((v, i) => v + dt / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}

// ---------- the whole body ----------
export class Body {
  constructor(cfg = {}) {
    this.cfg = { act: "rest", tdb: 22, rh: 50, alt: 0, startDef: 0, ...cfg };
    this.reset();
  }
  reset() {
    this.t = 0;                                    // minutes since start (start = 8:00)
    this.th = gaggeInit(1);
    this.y = [P.Gb, 0, P.Ib, 0, 0, 0, 0, 0, this.cfg.startDef ?? 0, 0];
    this.tot = { heatKJ: 0, foodKJ: 0, O2L: 0, CO2L: 0, sweatL: 0, urineL: 0, drankL: 0 };
    this.events = [];
    this.update(0);
  }
  eat(gCarb) { this.y[3] += P.AG * gCarb * 1000; this.tot.foodKJ += gCarb * 17; this.events.push([this.t, "meal", gCarb]); }  // 17 kJ/g carbohydrate
  coffee(mg) { this.y[5] += mg; this.events.push([this.t, "caffeine", mg]); }
  drink(L) { this.y[7] += L; this.tot.drankL += L; this.events.push([this.t, "water", L]); }
  void() { this.y[9] = 0; }
  // algebraic part: everything that depends only on the current states
  update(dtMin) {
    const c = this.cfg, A = P.ACT[c.act], VO2 = activityVO2(c.act), M = heatW(VO2);
    const met = M / (58.2 * P.bsa), Pb = baroP(c.alt);
    const env = { tdb: c.tdb, tr: c.tdb, v: A.v, rh: c.rh, met, clo: P.clo, p_atm: Pb * 133.322 };
    if (dtMin > 0) gaggeStep(this.th, env);
    const th = this.th, skinFlow = th.m_bl * P.bsa / 60;                               // L/min
    // circulation and lungs depend on each other through arterial O2 content
    let Ca = 20, circ, lung;
    for (let k = 0; k < 30; k++) {
      circ = circulation(VO2, Ca, skinFlow, this.y[8]);
      lung = lungs(Pb, VO2, circ.CO);
      if (Math.abs(lung.Ca - Ca) < 1e-9) break; Ca = lung.Ca;
    }
    const kid = kidney(circ.Q.kidneys, this.y[8]);
    const lam = 0.68 * 3600;                                                            // J per g of sweat
    const sweatLmin = th.m_rsw_reg * P.bsa / 1000 / 60;                                // sweat made, L/min
    const breathLmin = th.q_res * P.bsa / lam / 1000 * 60;                             // breath water, L/min
    const diffLmin = th.e_diff * P.bsa / lam / 1000 * 60;
    this.now = { env, A, VO2, M, met, Pb, th, circ, lung, kid, sweatLmin, breathLmin, diffLmin,
      waterOut: sweatLmin + breathLmin + diffLmin + kid.urine, QH: circ.Q.gut, QH0: P.BEDS.gut };
    return this.now;
  }
  step() {                                         // advance one minute
    const n0 = this.update(1);
    const u = { QH: n0.QH, QH0: n0.QH0, waterOut: n0.waterOut, urine: n0.kid.urine };
    for (let i = 0; i < 4; i++) this.y = rk4(this.y, u, 0.25);
    this.t += 1;
    const T = this.tot; T.heatKJ += n0.M * 60 / 1000; T.O2L += n0.VO2 / 1000; T.CO2L += n0.lung.VCO2 / 1000;
    T.sweatL += n0.sweatLmin; T.urineL += n0.kid.urine;
    this.update(0);
  }
  get caffeineC() { return this.y[6] / (P.cafVd * P.mass); }                         // mg/L
  get glucose() { return this.y[0]; }
}
