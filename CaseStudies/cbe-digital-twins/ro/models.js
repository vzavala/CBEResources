// Seawater reverse-osmosis (SWRO) plant models. Pure functions and one small dynamic class, no three.js.
// Units: pressures bar (gauge unless noted), concentrations kg/m³ (= g/L) in the membrane model, salinity S in g/kg,
// flows m³/h, flux LMH (L m⁻² h⁻¹), temperatures °C. Every constant marked "Typical" is a representative
// industry or literature value, not data for a particular plant or membrane product.

// ------------------------------------------------------------------ plant constants (all Typical)
export const PLANT = {
  trains: 6, vessels: 112, elems: 7,                 // per train: 112 pressure vessels × 7 elements (8-inch)
  elemArea: 37.2, elemLen: 1.016, leaves: 30,        // m² (400 ft²), m (40 in), membrane leaves per element
  spacerH: 0.71e-3, spacerEps: 0.89, chW: 19.6,      // feed spacer height (28 mil), porosity, total feed-channel width per element, m
  A25: 1.10, B25: 0.050,                             // LMH/bar water permeability, LMH salt permeability (new element, 25 °C)
  Bba25: 3.00, Bbor: 0.050,                          // LMH boric acid B(OH)₃ and borate B(OH)₄⁻
  EA: 2640, EB: 3500, EBA: 5000,                     // K, Arrhenius temperature factors for A, B, boric acid
  Pp: 0.5,                                           // bar g, permeate back-pressure
  Plp: 2.0,                                          // bar g, low-pressure feed after cartridge filters (HP pump and PX suction)
  PlpOut: 0.7,                                       // bar g, brine leaving the PX to the outfall
  pxMix: 0.03, pxLeak: 0.01,                         // PX volumetric mixing (brine into feed) and lubrication/leakage, fractions
  etaBoost: 0.80, etaMotor: 0.96,                    // booster pump, motors (with VFD)
  qMinBrine: 3.0, qMaxFeed: 17.0, maxElemRec: 0.15, maxCP: 1.20,    // per-vessel design limits, m³/h and fractions
  ufFlux: 60, ufArea: 77, ufRecovery: 0.94, ufRm: 1.2e12, ufCycle: 1800, ufCake: 0.6e12,   // LMH, m²/module, -, 1/m, s, 1/m per cycle
  intakeHead: 18, ufFeedBar: 2.5, productBar: 5.0, etaLP: 0.80,     // m, bar, bar, low-pressure pump+motor efficiency
  ports: 16, portD: 0.14, depthOut: 15,              // outfall diffuser: number of 60° ports, port diameter m, water depth m
};
export const VESSEL_AREA = PLANT.elemArea * PLANT.elems;           // 260.4 m²
export const DEFAULTS = { S: 35, T: 22, rec: 45, flux: 14, etaERD: 96, etaPump: 85, age: 2, foul: 5, pH: 8.0, erd: true, swing: true, grade: "std" };
export const REF = { S: 35, T: 25, rec: 45, flux: 14, age: 0, foul: 0 };   // normalisation reference (new membranes, design point)

const R = 8.314, BAR = 1e5, LMH = 1e-3 / 3600;   // J/mol K, Pa/bar, (m/s) per LMH
export const K = T => T + 273.15;

// ------------------------------------------------------------------ seawater properties
// Pure water density (Thiesen), seawater density linear in S (fit to Sharqawy et al. 2010 within 0.1 % for 0-70 g/kg, 10-40 °C).
export const rhoW = T => 1000 * (1 - (T + 288.9414) / (508929.2 * (T + 68.12963)) * (T - 3.9863) ** 2);
export const rhoSW = (S, T) => rhoW(T) + 0.765 * S;
// Viscosity, Sharqawy et al. (2010) eqs. 22-23; Pa s.
export function muSW(S, T) {
  const muw = 4.2844e-5 + 1 / (0.157 * (T + 64.993) ** 2 - 91.296), s = S / 1000;
  const a = 1.541 + 1.998e-2 * T - 9.52e-5 * T * T, b = 7.974 - 7.561e-2 * T + 4.724e-4 * T * T;
  return muw * (1 + a * s + b * s * s);
}
// Salt diffusivity: 1.5e-9 m²/s at 25 °C (NaCl, Typical), Stokes-Einstein scaling D ∝ T/μ.
export const Dsalt = (S, T) => 1.5e-9 * (K(T) / 298.15) * (muSW(S, 25) / muSW(S, T));
// Salinity g/kg from mass concentration kg/m³ (solve C = ρ(S) S / 1000).
export function SfromC(C, T) { const a = 0.765, b = rhoW(T); return (-b + Math.sqrt(b * b + 4 * a * 1000 * C)) / (2 * a); }
export const CfromS = (S, T) => rhoSW(S, T) * S / 1000;

// Ion molality and ionic strength (mol per kg water), reference seawater composition (Millero et al. 2008) scaled with S.
export function ions(S) { const f = S / 35 * 1000 / (1000 - S); return { m: 1.1601 * f, I: 0.6975 * f }; }   // 1.1601 and 0.6975 mol/kg-solution at S = 35
// Osmotic coefficient, "Pitzer-lite": the Pitzer single-electrolyte form with NaCl parameters evaluated at the seawater
// ionic strength, then scaled by 0.974 so φ(35 g/kg, 25 °C) = 0.902, the measured value for seawater (Millero & Leung 1976).
export function phiPitzer(I, T) {
  const t = T - 25, Aphi = 0.3915 + 4.68e-4 * t + 3.7e-6 * t * t, s = Math.sqrt(I);
  const phi = 1 - Aphi * s / (1 + 1.2 * s) + I * (0.0765 + 0.2664 * Math.exp(-2 * s)) + I * I * 0.00127;
  return 0.974 * phi;
}
// Osmotic pressure (bar): π = φ Σmᵢ ρw R T   (van't Hoff with an osmotic coefficient)
export function osmotic(S, T) {
  if (S <= 1e-6) return 0;
  const { m, I } = ions(S);
  return phiPitzer(I, T) * m * rhoW(T) * R * K(T) / BAR;
}
export const vantHoff = (S, T) => ions(S).m * rhoW(T) * R * K(T) / BAR;   // ideal, φ = 1
const piC = (C, T) => osmotic(SfromC(C, T), T);

// Temperature correction factors (Arrhenius form used by membrane makers), relative to 25 °C
export const TCF = (T, E) => Math.exp(E * (1 / 298.15 - 1 / K(T)));
// Ageing (irreversible) and fouling (reversible, cleaned by CIP) - Typical design allowances
export const ageA = age => 1 - 0.22 * (1 - Math.exp(-age / 3));            // ≈ 0.85 after 3 years
export const ageB = age => 1 + 0.10 * age;                                  // salt passage +10 %/year
// Generic membrane grades (assumed, Typical of the permeability-selectivity trade-off of polyamide RO membranes):
// a multiplies the water permeability A, b multiplies the salt and boron permeabilities.
export const GRADES = {
  hr:  { name: "High rejection", a: 0.75, b: 0.5 },
  std: { name: "Standard",       a: 1.0,  b: 1.0 },
  le:  { name: "Low energy",     a: 1.4,  b: 1.8 },
};
export function membrane(T, age, foul, grade = "std") {
  const ff = ageA(age) * (1 - foul / 100), G = GRADES[grade] || GRADES.std;
  return { A: PLANT.A25 * G.a * TCF(T, PLANT.EA) * ff, B: PLANT.B25 * G.b * TCF(T, PLANT.EB) * ageB(age), Bba: PLANT.Bba25 * G.b * TCF(T, PLANT.EBA) * ageB(age),
    Bbor: PLANT.Bbor * G.b * TCF(T, PLANT.EB) * ageB(age), ff, dpMul: 1 + 1.5 * foul / 100 };
}

// Boric acid dissociation constant in seawater (pK*_B ≈ 8.60 at 25 °C, 35 g/kg; Dickson 1990), Typical interpolation
export const pKaBoron = (S, T) => 9.24 - 0.64 * Math.sqrt(Math.max(0, S) / 35) - 0.008 * (T - 25);
export const borateFrac = (pH, S, T) => 1 / (1 + 10 ** (pKaBoron(S, T) - pH));

// ------------------------------------------------------------------ spacer-filled channel mass transfer and friction
// Schock & Miquel (1987): Sh = 0.065 Re^0.875 Sc^0.25, λ = 6.23 Re^-0.3 with d_h = 4ε / (2/h + (1-ε) 8/h)
export const DH = 4 * PLANT.spacerEps / (2 / PLANT.spacerH + (1 - PLANT.spacerEps) * 8 / PLANT.spacerH);
export const CH_AREA = PLANT.spacerEps * PLANT.spacerH * PLANT.chW;      // m², open feed-channel cross-section per element
export function channel(Q, S, T) {        // Q m³/h through one element
  const rho = rhoSW(S, T), mu = muSW(S, T), D = Dsalt(S, T), u = Q / 3600 / CH_AREA;
  const Re = rho * u * DH / mu, Sc = mu / (rho * D), Sh = 0.065 * Re ** 0.875 * Sc ** 0.25;
  return { rho, mu, D, u, Re, Sc, Sh, k: Sh * D / DH, lam: 6.23 * Math.max(Re, 1) ** -0.3 };
}

// ------------------------------------------------------------------ local solution-diffusion with film-theory polarisation
// Jw = A [ΔP − (π(Cm) − π(Cp))], Js = B (Cm − Cp), Cp = Js/Jw, (Cm − Cp)/(Cb − Cp) = exp(Jw/k).
// Eliminating Cp: Cm = Cb E / (1 − B(1 − E)/(Jw + B)), E = exp(Jw/k), Cp = B Cm/(Jw + B). Bisection on Jw.
export function localFlux(dP, Cb, T, A, B, k) {
  const Am = A * LMH, Bm = B * LMH, piB = piC(Cb, T);
  if (dP <= piB * 0.98 - 0.5 || Am <= 0) return { Jw: 0, Cm: Cb, Cp: Cb, cp: 1, ndp: dP - piB };
  const F = Jw => { const E = Math.exp(Jw / k), Cm = Cb * E / (1 - Bm * (1 - E) / (Jw + Bm)), Cp = Bm * Cm / (Jw + Bm);
    return { f: Jw - Am * (dP - piC(Cm, T) + piC(Cp, T)), Cm, Cp }; };
  let lo = 0, hi = Am * dP, Jw = Math.max(1e-9, Math.min(hi * 0.999, Am * (dP - piB * 1.1))), r = F(Jw);
  for (let it = 0; it < 30; it++) {
    if (r.f > 0) hi = Jw; else lo = Jw;
    const h = Math.max(1e-10, Jw * 1e-4), d = (F(Jw + h).f - r.f) / h;
    let Jn = Jw - r.f / d;
    if (!(Jn > lo && Jn < hi)) Jn = 0.5 * (lo + hi);
    const done = Math.abs(Jn - Jw) < 1e-12 + 1e-7 * Jw;
    Jw = Jn; r = F(Jw);
    if (done) break;
  }
  return { Jw, Cm: r.Cm, Cp: r.Cp, cp: r.Cm / Cb, ndp: Jw / Am };
}

// ------------------------------------------------------------------ one pressure vessel, element by element
// o: { Pf bar g, Qf m³/h, Cf kg/m³, T, mem: membrane(), Bf mg/L total boron, alpha borate fraction }
export const NC = 5;            // cells per element along the flow path
export function solveVessel(o) {
  const { T, mem } = o, a = PLANT.elemArea / NC, Lc = PLANT.elemLen / NC;
  let Q = o.Qf, C = o.Cf, P = o.Pf, Bt = o.Bf, Qp = 0, Ms = 0, Mb = 0;
  const el = [];
  for (let e = 0; e < PLANT.elems; e++) {
    const E = { Pin: P, Qin: Q, Cin: C, piIn: piC(C, T), Qp: 0, Ms: 0, Mb: 0, cpMax: 0, Re: 0, k: 0, u: 0, piM: 0, ndp: 0 };
    for (let c = 0; c < NC; c++) {
      const S = SfromC(C, T), ch = channel(Q, S, T);
      const r = localFlux(P - PLANT.Pp, C, T, mem.A, mem.B, ch.k);
      const q = r.Jw * a * 3600;                                     // m³/h permeate from this cell
      // boron: boric acid (weakly rejected) and borate (rejected like salt), same polarisation factor
      const Ex = Math.exp(r.Jw / ch.k), alpha = o.alpha, Jw = Math.max(r.Jw, 1e-12);
      const pass = Bx => { const Bm = Bx * LMH, Cm = Ex / (1 - Bm * (1 - Ex) / (Jw + Bm)); return Bm * Cm / (Jw + Bm); };   // Cp/Cb
      const bp = Bt * ((1 - alpha) * pass(mem.Bba) + alpha * pass(mem.Bbor));
      const ms = r.Cp * q, mb = bp * q;                              // kg/h salt, g/h boron (mg/L × m³/h = g/h)
      E.Qp += q; E.Ms += ms; E.Mb += mb; E.cpMax = Math.max(E.cpMax, r.cp);
      if (c === 2) { E.Re = ch.Re; E.k = ch.k; E.u = ch.u; E.piM = piC(r.Cm, T); E.ndp = r.ndp; E.Sh = ch.Sh; E.Sc = ch.Sc; E.Cm = r.Cm; E.Cb = C; E.Jw = r.Jw / LMH; }
      const Qn = Math.max(1e-6, Q - q);
      C = (Q * C - ms) / Qn; Bt = (Q * Bt - mb) / Qn; Q = Qn;
      P -= mem.dpMul * ch.lam * ch.rho * ch.u * ch.u / (2 * DH) * Lc / BAR;
    }
    E.Pout = P; E.Qout = Q; E.Cout = C; E.piOut = piC(C, T); E.flux = E.Qp / PLANT.elemArea * 1000; E.rec = E.Qp / E.Qin;
    E.Cp = E.Qp > 0 ? E.Ms / E.Qp : 0; E.Bp = E.Qp > 0 ? E.Mb / E.Qp : 0;
    Qp += E.Qp; Ms += E.Ms; Mb += E.Mb; el.push(E);
  }
  return { el, Qp, Qb: Q, Cb: C, Pb: P, Bb: Bt, Cp: Qp > 0 ? Ms / Qp : 0, Bp: Qp > 0 ? Mb / Qp : 0, dP: o.Pf - P, rec: Qp / o.Qf };
}

// Feed pressure that gives a target permeate flow at fixed feed flow (permeate is monotone in Pf)
export function pressureFor(QpTarget, base) {
  let lo = 5, hi = 120;
  for (let it = 0; it < 32; it++) { const m = 0.5 * (lo + hi); (solveVessel({ ...base, Pf: m }).Qp > QpTarget ? hi = m : lo = m); }
  return 0.5 * (lo + hi);
}

// ------------------------------------------------------------------ scaling: LSI (CaCO3) and CaSO4 saturation
// Feed ions at S = 35 (mg/L, Typical open-ocean water); scale with S. Alkalinity 117 mg/L as CaCO3 (2.34 meq/L).
export const FEED_IONS = { Ca: 412, Mg: 1284, Na: 10780, K: 399, Cl: 19350, SO4: 2712, HCO3: 142, alk: 117, B: 4.6 };
export function lsi(tds, T, caAsCaCO3, alkAsCaCO3, pH) {        // Langelier (1936) via the Carrier/APHA form
  const A = (Math.log10(Math.max(tds, 1)) - 1) / 10, B = -13.12 * Math.log10(K(T)) + 34.55;
  const C = Math.log10(Math.max(caAsCaCO3, 1e-3)) - 0.4, D = Math.log10(Math.max(alkAsCaCO3, 1e-3));
  const pHs = 9.3 + A + B - (C + D);
  return { pHs, lsi: pH - pHs, A, B, C, D };
}
// Gypsum: stoichiometric (conditional) solubility product vs ionic strength, extended Debye-Hückel form with a linear term
// calibrated so that S = 35 seawater at 25 °C is ≈ 27 % saturated (literature range 25-30 %). Temperature effect ignored
// (gypsum solubility changes < 10 % between 10 and 40 °C).
export function caso4Sat(S, CF, T) {
  const I = ions(S).I * CF, s = Math.sqrt(I), w = 1000 / (1000 - S);
  const mCa = 0.01028 * S / 35 * w * CF, mSO4 = 0.02823 * S / 35 * w * CF;          // mol/kg water
  const logKsp = -4.58 + 4.08 * s / (1 + 1.5 * s) + 0.1625 * I;
  return { sat: mCa * mSO4 / 10 ** logKsp, I, mCa, mSO4, Ksp: 10 ** logKsp };
}
export function scaling(S, T, pH, CF, pHshift = 0.15) {
  const k = S / 35, tdsB = S * rhoSW(S, T) * CF;              // mg/L
  const ca = FEED_IONS.Ca * k * CF * 2.497, alk = FEED_IONS.alk * k * CF;
  const L = lsi(tdsB, T, ca, alk, pH + pHshift), G = caso4Sat(S, CF, T);
  return { lsi: L.lsi, pHs: L.pHs, L, caso4: G.sat * 100, G, ca, alk, tds: tdsB };
}

// ------------------------------------------------------------------ thermodynamic minimum work of separation
// Reversible: W/Vp = (1/r) ∫0^r π(C_f/(1−x)) dx (perfect rejection); ideal-solution closed form π_f ln(1/(1−r))/r.
export function minWork(S, T, r) {
  const Cf = CfromS(S, T), n = 40; let s = 0;
  for (let i = 0; i <= n; i++) { const x = r * i / n, w = i === 0 || i === n ? 1 : (i % 2 ? 4 : 2); s += w * piC(Cf / (1 - x), T); }
  const real = s * r / (3 * n) / r, ideal = osmotic(S, T) * Math.log(1 / (1 - r)) / r, stage = piC(Cf / (1 - r), T);
  return { real, ideal, stage, kWh: v => v * BAR / 3.6e6 };      // bar = 1e5 J/m³ → kWh/m³ = bar / 36
}
export const barToKWh = b => b / 36;

// ------------------------------------------------------------------ full plant state for given inputs and feed pressure
export function plantState(inp, Pf, runtime = {}) {
  const T = inp.T, S = inp.S, r = inp.rec / 100, mem = membrane(T, inp.age, inp.foul, inp.grade);
  const QpV = inp.flux * VESSEL_AREA / 1000, QfV = QpV / r, nTr = runtime.trains ?? PLANT.trains;
  const nV = nTr * PLANT.vessels, Cf0 = CfromS(S, T), alpha = borateFrac(inp.pH, S, T), Bf = FEED_IONS.B * S / 35;
  // PX mixing raises the membrane feed salinity; iterate on brine concentration
  let Cf = Cf0 * (runtime.mix ?? 1), v = null, Bfm = Bf * (runtime.mix ?? 1);
  for (let it = 0; it < (runtime.iters ?? 2); it++) {
    v = solveVessel({ Pf, Qf: QfV, Cf, T, mem, Bf: Bfm, alpha });
    const xHP = inp.erd ? (v.Qb * (1 - PLANT.pxLeak)) / QfV : 0;      // fraction of membrane feed coming through the PX
    Cf = Cf0 + PLANT.pxMix * xHP * (v.Cb - Cf0); Bfm = Bf + PLANT.pxMix * xHP * (v.Bb - Bf);
  }
  const Qp = v.Qp * nV, Qf = QfV * nV, Qb = v.Qb * nV, rec = v.Qp / QfV;
  // energy: HP pump + PX + booster, or HP pump alone with brine throttled
  const etaP = inp.etaPump / 100, etaX = inp.etaERD / 100, em = PLANT.etaMotor;
  let Qhp, Qpx = 0, Ppx = 0, Whp, Wbst = 0;
  if (inp.erd) {
    Qpx = Qb * (1 - PLANT.pxLeak); Qhp = Qf - Qpx;
    Ppx = etaX * (v.Pb + PLANT.Plp) - PLANT.PlpOut;                    // η = Σ(PQ)out / Σ(PQ)in with balanced flows
    Whp = Qhp / 3600 * (Pf - PLANT.Plp) * BAR / (etaP * em); Wbst = Qpx / 3600 * Math.max(0, Pf - Ppx) * BAR / (PLANT.etaBoost * em);
  } else { Qhp = Qf; Whp = Qf / 3600 * (Pf - PLANT.Plp) * BAR / (etaP * em); }
  const secRO = (Whp + Wbst) / (Qp / 3600) / 3.6e6;                       // kWh/m³
  const secNoERD = Qf / 3600 * (Pf - PLANT.Plp) * BAR / (etaP * em) / (Qp / 3600) / 3.6e6;
  const recovered = inp.erd ? Qpx / 3600 * (Ppx - PLANT.Plp) * BAR : 0;  // W returned to the feed by the PX
  // low-pressure services
  const Quf = Qf / PLANT.ufRecovery, Qint = Quf * 1.02;
  const Wint = Qint / 3600 * 1025 * 9.81 * PLANT.intakeHead / PLANT.etaLP;
  const Wuf = Quf / 3600 * PLANT.ufFeedBar * BAR / PLANT.etaLP + Qf / 3600 * PLANT.Plp * BAR / PLANT.etaLP;  // UF feed + cartridge/LP feed
  const Wprod = Qp / 3600 * PLANT.productBar * BAR / PLANT.etaLP;
  const Wtot = Whp + Wbst + Wint + Wuf + Wprod, secPlant = Wtot / (Qp / 3600) / 3.6e6;
  const mw = minWork(S, T, rec);
  // product water
  const Sb = SfromC(v.Cb, T), CF = v.Cb / Cf0, tdsP = v.Cp * 1000;      // mg/L
  const sc = scaling(S, T, inp.pH, CF), sc0 = scaling(S, T, inp.pH, 1, 0);
  // brine outfall: 60° inclined dense jets (Roberts et al. 1997): z_t = 2.2 dF, x_i = 2.4 dF, S_i = 1.6 F
  const rhoB = rhoSW(Sb, T), rhoA = rhoSW(S, T), gp = 9.81 * (rhoB - rhoA) / rhoA, Ap = Math.PI * PLANT.portD ** 2 / 4;
  const uJet = Qb / 3600 / (PLANT.ports * Ap), Fr = uJet / Math.sqrt(Math.max(gp, 1e-4) * PLANT.portD);
  const out = { uJet, Fr, gp, rhoB, rhoA, rise: 2.2 * PLANT.portD * Fr, xi: 2.4 * PLANT.portD * Fr, Si: 1.6 * Fr };
  out.dS = (Sb - S) / out.Si;
  // warnings against design guidelines
  const warn = [];
  const lead = v.el[0], tail = v.el.at(-1);
  if (QfV > PLANT.qMaxFeed) warn.push(`Vessel feed ${QfV.toFixed(1)} m³/h above ${PLANT.qMaxFeed} m³/h`);
  if (v.Qb < PLANT.qMinBrine) warn.push(`Brine ${v.Qb.toFixed(2)} m³/h per vessel below ${PLANT.qMinBrine} m³/h minimum`);
  if (lead.rec > PLANT.maxElemRec) warn.push(`Lead element recovery ${(lead.rec * 100).toFixed(0)} % above 15 %`);
  if (Math.max(...v.el.map(e => e.cpMax)) > PLANT.maxCP) warn.push(`Polarisation factor above ${PLANT.maxCP}`);
  if (sc.lsi > 1.8) warn.push(`Brine LSI ${sc.lsi.toFixed(2)} above antiscalant limit ≈ 1.8`);
  if (sc.caso4 > 230) warn.push(`CaSO₄ ${sc.caso4.toFixed(0)} % saturation above antiscalant limit ≈ 230 %`);
  if (Pf > 82) warn.push(`Feed pressure ${Pf.toFixed(1)} bar above 82.7 bar element rating`);
  return { inp, Pf, mem, v, QpV, QfV, nV, nTr, Qp, Qf, Qb, rec, Cf0, Cfm: Cf, Sf: S, Sb, CF, tdsP, Bp: v.Bp, Bf, alpha,
    Qhp, Qpx, Ppx, Whp, Wbst, Wint, Wuf, Wprod, Wtot, secRO, secNoERD, secPlant, recovered, mw, Quf, Qint,
    mix: Cf / Cf0, sc, sc0, out, warn, piF: osmotic(S, T), piB: osmotic(Sb, T), lead, tail };
}

// Steady state for the inputs: solve Pf so permeate meets the flux set-point
export function steady(inp, runtime) {
  const T = inp.T, mem = membrane(T, inp.age, inp.foul, inp.grade), r = inp.rec / 100;
  const QpV = inp.flux * VESSEL_AREA / 1000, QfV = QpV / r, Cf0 = CfromS(inp.S, T);
  const base = { Qf: QfV, Cf: Cf0 * (1 + (inp.erd ? PLANT.pxMix * 0.5 * r / (1 - r) : 0)), T, mem, Bf: FEED_IONS.B * inp.S / 35, alpha: borateFrac(inp.pH, inp.S, T) };
  const Pf = pressureFor(QpV, base);
  return plantState(inp, Pf, { ...runtime, iters: 4 });
}

// Operator's normalised permeate flow (ASTM D4516 style): Qp × (NDP_ref/NDP) × (TCF_ref/TCF), using only what the plant
// instruments see: feed and brine pressure and conductivity, permeate conductivity, temperature. The average feed-side osmotic
// pressure is taken at the arithmetic mean of feed and brine concentration with an assumed polarisation factor 1.1.
export function normalise(st, ref) {
  const ndp = s => s.Pf - s.v.dP / 2 - PLANT.Pp - (1.1 * osmotic((s.Sf + s.Sb) / 2, s.inp.T) - osmotic(s.tdsP / 1000, s.inp.T));
  const n = st.v.Qp * (ndp(ref) / ndp(st)) * (TCF(ref.inp.T, PLANT.EA) / TCF(st.inp.T, PLANT.EA));
  return { ndp: ndp(st), ndpRef: ndp(ref), nq: n / ref.v.Qp, ff: st.mem.ff };
}

// ------------------------------------------------------------------ pretreatment and post-treatment unit models
export function pretreat(st, tCycle) {
  const T = st.inp.T, mu = muSW(st.Sf, T), Quf = st.Quf;
  // coagulation-flocculation: Camp-Stein G = sqrt(P/(μV)); FeCl3 at 2 mg/L as Fe (Typical)
  const Vfloc = Quf * 20 / 60, Gf = 40, Pfloc = Gf * Gf * mu * Vfloc, Vmix = Quf * 1 / 60, Gm = 800, Pmix = Gm * Gm * mu * Vmix;
  const fe = 2.0, fecl3 = fe * 162.2 / 55.85 * Quf * 24 / 1000;    // kg/d FeCl3
  // UF: resistance in series, cake grows linearly through each filtration cycle, backwash resets it
  const nMod = Math.round(PLANT.trains * PLANT.vessels * VESSEL_AREA * 14 / 0.45 / PLANT.ufRecovery / (PLANT.ufFlux * PLANT.ufArea) * 1.0);
  const J = Quf * 1000 / (nMod * PLANT.ufArea), ph = (tCycle % PLANT.ufCycle) / PLANT.ufCycle;
  const Rc = PLANT.ufCake * ph, tmp = mu * J * LMH * (PLANT.ufRm + Rc) / BAR;
  // chemicals
  const anti = 1.5, cl2 = 0.5, sbs = 1.34 * cl2 * 3;   // mg/L antiscalant, residual Cl2 to quench, SBS (3 × stoichiometric)
  return { Vfloc, Gf, Pfloc, Vmix, Gm, Pmix, camp: Gf * 20 * 60, fe, fecl3, nMod, J, Rc, tmp, ph, mu, anti, antiKg: anti * st.Qf * 24 / 1000, cl2, sbs, sbsKg: sbs * st.Qf * 24 / 1000 };
}
export function post(st) {
  const T = st.inp.T, Qp = st.Qp;
  // limestone (calcite) contactors fed with CO2: CaCO3 + CO2 + H2O → Ca²⁺ + 2 HCO3⁻; first-order approach to target
  const caT = 0.50, kc = 0.25, ebct = 12, approach = 1 - Math.exp(-kc * ebct), ca = caT * approach;   // mmol/L, 1/min, min
  const caco3 = ca * 100.09, co2 = ca * 44.01 * 1.3;                     // g/m³ dissolved; CO2 dose with 30 % excess
  const hard = ca * 100.09, alk = 2 * ca * 50.04 + 2, pH = 8.2, tds = st.tdsP + ca * 40.08 + 2 * ca * 61.02;
  const L = lsi(tds, T, hard, alk, pH);
  // chlorination with first-order bulk decay in storage
  const dose = 1.2, kd = 0.02, Vst = 2 * 28600, tau = Vst / Math.max(Qp, 1), resid = dose * Math.exp(-kd * tau);
  const hocl = 1 / (1 + 10 ** (pH - 7.54));
  return { caT, kc, ebct, approach, ca, caco3, co2, hard, alk, pH, tds, L, dose, kd, Vst, tau, resid, hocl,
    limeKg: caco3 * Qp * 24 / 1000, co2Kg: co2 * Qp * 24 / 1000, naoclKg: dose * Qp * 24 / 1000 };
}
export function intake(st) {
  // two HDPE intake pipes, 1.2 m bore, 1.2 km offshore; two velocity caps sized for 0.15 m/s entrance velocity
  const Q = st.Qint / 3600, D = 1.2, L = 1200, eps = 0.05e-3, A = Math.PI * D * D / 4, u = Q / 2 / A;
  const mu = muSW(st.Sf, st.inp.T), rho = rhoSW(st.Sf, st.inp.T), Re = rho * u * D / mu;
  const f = 0.25 / Math.log10(eps / (3.7 * D) + 5.74 / Re ** 0.9) ** 2;   // Swamee-Jain
  const hf = f * L / D * u * u / (2 * 9.81), capH = 0.6, capD = 6.0, uCap = Q / 2 / (Math.PI * capD * capH);
  return { Q, D, L, u, Re, f, hf, uCap, capH, capD, rho, mu };
}

// ------------------------------------------------------------------ dynamic plant: PI pressure control, diurnal swing, CIP
export class Plant {
  constructor() {
    this.inp = { ...DEFAULTS }; this.t = 0; this.trains = PLANT.trains;
    this.ref = steady({ ...DEFAULTS, ...REF, erd: true, pH: 8, etaERD: 96, etaPump: 85 });
    this.Kc = 30; this.tauI = 6; this.tauP = 6; this.cip = null; this.hist = [];
    this.init();
  }
  env(t) {          // seawater seen at the intake: diurnal temperature swing and semi-diurnal tide on salinity
    const h = t / 3600, on = this.inp.swing;
    return { T: this.inp.T + (on ? 1.2 * Math.sin(2 * Math.PI * (h - 9) / 24) : 0), S: this.inp.S + (on ? 0.35 * Math.sin(2 * Math.PI * h / 12.42) : 0) };
  }
  live() { const e = this.env(this.t); return { ...this.inp, T: e.T, S: e.S, foul: this.foulNow() }; }
  foulNow() { return this.inp.foul; }
  init() {
    this.st = steady(this.live(), { trains: this.trains }); this.Pf = this.Pcmd = this.st.Pf; this.bias = this.Pf; this.integ = 0;
    this.hist.length = 0; this.seedHistory(); this.lastRec = -1e9; this.record();
  }
  // the trend plots open with the previous 24 h: steady states every 15 min along the same daily sea cycle (env)
  seedHistory() {
    for (let tt = this.t - 24 * 3600; tt < this.t - 1; tt += 900) {
      const e = this.env(tt), s = steady({ ...this.inp, T: e.T, S: e.S, foul: this.foulNow() }, { trains: this.trains });
      this.hist.push({ t: tt, Pf: s.Pf, tds: s.tdsP, sec: s.secRO, T: e.T, Qp: s.Qp, B: s.Bp, nq: normalise(s, this.ref).nq });
    }
  }
  setpoint() { return this.inp.flux * VESSEL_AREA / 1000; }
  rt() { return { trains: this.trains, mix: this.st?.mix }; }
  step(dtTotal) {            // fine sub-steps resolve the pressure loop; long frames track the (fast) loop's steady state
    if (dtTotal > 8) return this.settle(dtTotal);
    let left = dtTotal;
    while (left > 1e-9) { const dt = Math.min(left, 2.0); this.sub(dt); left -= dt; }
  }
  sub(dt) {
    this.t += dt;
    this.cipTick(dt);
    const sp = this.setpoint(), e = (sp - this.st.v.Qp) / sp;
    this.integ += e * dt;
    this.Pcmd = Math.min(83, Math.max(10, this.bias + this.Kc * (e + this.integ / this.tauI)));
    this.Pf += (this.Pcmd - this.Pf) * (1 - Math.exp(-dt / this.tauP));
    this.st = plantState(this.live(), this.Pf, this.rt());
    this.record();
  }
  settle(dt) {
    this.t += dt; this.cipTick(dt);
    const L = this.live(), sp = this.setpoint(), g = 0.85 * this.st.mem.A * VESSEL_AREA / 1000;   // m³/h per bar, approx. gain
    let st = plantState(L, this.Pf, this.rt());
    for (let k = 0; k < 2; k++) { this.Pf = Math.min(83, Math.max(10, this.Pf + (sp - st.v.Qp) / g)); st = plantState(L, this.Pf, { ...this.rt(), mix: st.mix }); }
    this.Pcmd = this.Pf; this.integ = (this.Pf - this.bias) / this.Kc * this.tauI;
    this.st = st; this.record();
  }
  startCIP() { if (!this.cip) { this.cip = { t: 0, dur: 8 * 3600, f0: this.inp.foul }; this.trains = PLANT.trains - 1; } }
  cipTick(dt) {
    if (!this.cip) return;
    this.cip.t += dt; const u = Math.min(1, this.cip.t / this.cip.dur);
    this.inp.foul = this.cip.f0 * (1 - 0.85 * u);           // trains cleaned in rotation; 85 % of reversible fouling removed
    this.cipStage = u < 0.35 ? "Alkaline clean, pH 12, 35 °C (biofilm, organics)" : u < 0.5 ? "Rinse" : u < 0.85 ? "Acid clean, pH 2 (scale, metal oxides)" : "Final rinse and flush";
    if (u >= 1) { this.cip = null; this.trains = PLANT.trains; this.cipStage = ""; }
  }
  record() {
    if (this.t - this.lastRec < 120 && this.hist.length) return;
    this.lastRec = this.t; const s = this.st, e = this.env(this.t);
    this.hist.push({ t: this.t, Pf: s.Pf, tds: s.tdsP, sec: s.secRO, T: e.T, Qp: s.Qp, B: s.Bp, nq: normalise(s, this.ref).nq });
    while (this.hist.length && this.t - this.hist[0].t > 24 * 3600) this.hist.shift();
  }
}

// ------------------------------------------------------------------ everyday terms (conversion factors are Typical)
export const EVERYDAY = {
  gal: 3.785411784e-3,      // m³ per US gallon (exact)
  phone: 0.015,             // kWh to charge a smartphone, Typical
  led: 0.010,               // kW, one 10 W LED bulb
  drink: 2.0,               // L of drinking water per person per day, Typical
  house: 300,               // US gallons of water per household per day, Typical
  homeKWh: 29,              // kWh of electricity per US household per day, Typical
  grid: 0.4,                // kg CO₂ per kWh of grid electricity, Typical
  price: 0.10,              // $ per kWh industrial electricity, Typical
  nonEnergy: 0.70,          // $ per m³ capital, membranes, chemicals, labour, Typical
  bottled: 1.50,            // $ per gallon of bottled water bought by the gallon, Typical
};
export function everyday(st, pst) {
  const E = EVERYDAY, g = E.gal, kWhGal = st.secPlant * g, homes = st.Qp * 24 / (E.house * g);
  const costM3 = st.secPlant * E.price + E.nonEnergy;
  return {
    whGal: kWhGal * 1000, whGalRO: st.secRO * g * 1000, whGalMin: barToKWh(st.mw.real) * g * 1000,
    phones: kWhGal / E.phone, ledMin: kWhGal / E.led * 60,
    drinkWh: st.secPlant * E.drink / 1000 * 1000,
    homes, homeKWh: kWhGal * E.house, homeShare: kWhGal * E.house / E.homeKWh,
    seaGal: st.Qint / st.Qp, brineGal: st.Qb / st.Qp,
    saltSeaG: st.Sf * rhoSW(st.Sf, st.inp.T) / 1000 * g * 1000, saltProdG: pst.tds * g,
    costGal: costM3 * g, energyCostGal: st.secPlant * E.price * g, bottledX: E.bottled / (costM3 * g),
    co2Gal: kWhGal * E.grid * 1000,
  };
}
