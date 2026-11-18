// Brewery Digital Twin: process model from grain to glass. No DOM, no three.js: runs in the browser and in node.
// Units: SI unless stated. Temperatures in °C at the interface, K inside Arrhenius terms.
// Equation numbers (n) match the ∑ Model panel.

export const R = 8.314;                      // J/mol·K
export const MW = { G: 180.16, M: 342.30, N: 504.44, E: 46.07, C: 44.01 };   // g/mol: glucose, maltose, maltotriose, ethanol, CO2
export const CARBON = { G: 6, M: 12, N: 18, E: 2, C: 1 };                   // carbon atoms per molecule

// Fermentation kinetics of Gee & Ramirez (lager yeast), SI values as tabulated in ref. 3. k = A exp(-E/RT).
export const GR = {
  AG: 9.51e11, EG: 9.46e4, AM: 3.68e3, EM: 4.73e4, AN: 1.10e1, EN: 3.00e4,                          // max uptake rates, 1/s, J/mol
  AKG: 2.09e-53, EKG: -2.87e5, AKM: 3.40e-9, EKM: -6.03e4, AKN: 2.34e-12, EKN: -8.33e4,            // saturation constants, mol/m3
  AIG: 1.36e10, EIG: 4.27e4, AIM: 1.42e24, EIM: 1.10e5,                                              // inhibition constants K', mol/m3
  YXG: 0.134, YXM: 0.268, YXN: 0.402, YEG: 1.92, YEM: 3.84, YEN: 5.76, KX: 3.65e5,                  // yields mol/mol; KX mol2/m6
  dHG: 91.2e3, dHM: 226.3e3, dHN: 361.3e3,                                                           // heat released, J/mol sugar
};
export const arr = (A, E, TK) => A * Math.exp(-E / (R * TK));

// Constants. "assumed" values are listed with reasons in the ∑ Model parameter table.
export const C = {
  V: 5.0,                 // m3 of cold wort per brew (50 hL), fixed brew length
  rhoW: 998,              // kg/m3 water at 20 °C
  cpW: 4180, cpWort: 4000, cpMalt: 1700,   // J/kg·K
  hfg: 2257e3,            // J/kg, water at 100 °C
  extract: 0.80,          // kg extract per kg malt, fully converted (assumed typical)
  liquor: 3.0,            // L mash water per kg malt (assumed)
  etaL: 0.93,             // extract recovered in lautering and sparging (assumed)
  nonCarb: 0.08,          // share of extract that is not carbohydrate and never ferments (assumed)
  split: { G: 0.15, M: 0.65, N: 0.20 },   // mass split of fermentable sugars (assumed typical wort)
  // mashing (illustrative reduced model): rate constants at 65 °C in 1/min and activation energies in J/mol
  mash: { Tref: 65, ka: 0.16, Ea: 50e3, kb: 0.075, Eb: 40e3, kda: 0.002, Eda: 230e3, kdb: 0.022, Edb: 260e3, phi: 0.24, lim: 0.20, Tgel: 58, wgel: 1.2 },
  // lautering
  bedL: 1.9e-3,           // m3 of grain bed per kg malt (assumed)
  tunA: 5.0,              // m2 lauter tun area
  perm: 1.4e-11,          // m2 bed permeability (assumed)
  dPbed: 3000,            // Pa allowed across the bed (assumed)
  Tlauter: 75,
  // kettle
  Tboil: 100, heatUp: 25, // °C; minutes to bring the kettle to the boil (assumed)
  // hops: Malowicki & Shellhammer first-order kinetics, 1/min with T in K
  hop: { A1: 7.9e11, B1: 11858, A2: 4.1e12, B2: 12994, keep: 0.6 },   // keep: share of iso-alpha acids surviving to the glass (assumed)
  whirl: 20, Twhirl0: 98, Twhirl1: 92,   // whirlpool minutes and temperatures (assumed)
  // wort cooler (counterflow plate exchanger)
  UAcool: 87.5e3,         // W/K (assumed: 25 m2 at 3500 W/m2K)
  coolMin: 45,            // minutes to run off the wort
  cwRatio: 1.1,           // cooling-water to wort volume ratio (assumed)
  // fermenter
  X0: 200,                // mol/m3 yeast at 1x pitch (assumed reference pitch)
  UAj: 480,               // W/m3·K jacket conductance per m3 of beer (assumed: 8 m2 at 300 W/m2K on 5 m3)
  UAloss: 1.6,            // W/m3·K heat gain from the cellar (assumed, insulated tank)
  Tgly: -4, Tcellar: 15,  // °C
  Kc: 2.0, tauI: 2.0,     // PI cooling controller: valve fraction per K, hours (assumed tuning)
  // diacetyl (illustrative parameters; structure from Gee & Ramirez as reviewed in ref. 4)
  YV: 0.05,               // mg/L of diacetyl per mol/m3 of yeast grown
  rV12: 4.6e-8, EV: 70e3, // reduction rate m3/mol·s at 12 °C and activation energy (assumed)
  doneLeft: 0.03,         // fermentation is called finished when 3 % of the fermentable sugar is left (assumed)
  vdkLimit: 0.1,          // mg/L, lager flavour threshold (lower end of 0.1-0.2)
  // carbonation: Henry's law for CO2 in water
  H298: 3.3e-4, HT: 2400, // mol/m3·Pa at 298.15 K; d ln H / d(1/T) in K
  patm: 101325,
  // maturation: Stokes settling of yeast flocs
  dFloc: 30e-6, dCell: 6e-6, dRho: 90, hTank: 3.0, muBeer0: 2.9e-3,   // m, m, kg/m3, m, Pa·s at 0 °C (assumed)
  // losses, utilities, sustainability
  loss: 0.06,             // beer lost with yeast, trub and filtration (assumed)
  boilerEff: 0.80,        // (assumed)
  copFrac: 0.5, Tcond: 35, Tevap: -8,   // refrigeration: fraction of Carnot COP (assumed), condensing and evaporating °C
  cleanWater: 2.5,        // hL of cleaning and utility water per hL of beer (assumed)
  spentMoist: 0.78,       // water share of wet spent grain (assumed)
  efGas: 0.181,           // kg CO2 per kWh of natural gas heat (EPA)
  kegL: 50,
};

export const STYLES = {
  lager: { name: "American lager", malt: 780, mashT: 64, mashMin: 60, hops: 60, alpha: 6, boilMin: 60, fermT: 11, pitch: 1.0, rest: 3, coldDays: 10, vols: 2.6, srm: 3 },
  ale:   { name: "Pale ale", malt: 950, mashT: 66, mashMin: 60, hops: 130, alpha: 10, boilMin: 60, fermT: 19, pitch: 1.0, rest: 0, coldDays: 3, vols: 2.4, srm: 8 },
  amber: { name: "Wisconsin-style amber lager", malt: 980, mashT: 67, mashMin: 60, hops: 110, alpha: 6, boilMin: 75, fermT: 10.5, pitch: 1.0, rest: 3, coldDays: 14, vols: 2.5, srm: 14 },
};
export const DEFAULTS = { style: "lager", ...STYLES.lager, evap: 6, cwT: 12, control: "auto", Kc: C.Kc, tauI: C.tauI };

// ---------- wort properties ----------
// (2) specific gravity from degrees Plato (standard brewing conversion)
export const sgOfPlato = P => 1 + P / (258.6 - 227.1 * P / 258.2);
export const extractGL = P => P * sgOfPlato(P) * C.rhoW / 100;                 // g extract per L of wort
export function platoOfExtract(gL) { let P = gL / 10; for (let i = 0; i < 30; i++) P = gL * 100 / (sgOfPlato(P) * C.rhoW); return P; }
// viscosity of water (Vogel form), Pa·s, and of wort (assumed sugar factor)
export const muWater = T => 2.414e-5 * Math.pow(10, 247.8 / (T + 273.15 - 140));
export const muWort = (T, P) => muWater(T) * Math.exp(0.045 * P);

// ---------- (3)-(5) mashing: starch -> dextrins -> fermentable sugars by alpha- and beta-amylase ----------
export function mash(Tc, minutes, dt = 0.1) {
  const m = C.mash, TK = Tc + 273.15, Tr = m.Tref + 273.15, f = E => Math.exp(-E / R * (1 / TK - 1 / Tr));
  const ka = m.ka * f(m.Ea), kb = m.kb * f(m.Eb), kda = m.kda * f(m.Eda), kdb = m.kdb * f(m.Edb);
  const gel = 1 / (1 + Math.exp(-(Tc - m.Tgel) / m.wgel));       // share of starch that gelatinizes at this temperature
  let S = 1, D = 0, F = 0, L = 0, a = 1, b = 1; const out = [];   // L: limit dextrins that beta-amylase cannot cut
  const n = Math.round(minutes / dt);
  for (let i = 0; i <= n; i++) {
    if (i % Math.round(1 / dt) === 0) out.push({ t: i * dt, S, D: D + L, F, a, b });
    const rS = ka * a * Math.max(0, S - (1 - gel)), rD = kb * b * D;
    S -= rS * dt; D += ((1 - m.phi - m.lim) * rS - rD) * dt; L += m.lim * rS * dt; F += (m.phi * rS + rD) * dt; a -= kda * a * dt; b -= kdb * b * dt;
  }
  const conv = 1 - S, ferm = (F / (F + D + L || 1)) * (1 - C.nonCarb);   // fermentable share of the dissolved extract
  return { curve: out, conv, ferm, a, b, gel, ka, kb, kda, kdb };
}

// ---------- (9) hop isomerization and degradation ----------
export const kIso = TK => C.hop.A1 * Math.exp(-C.hop.B1 / TK);   // 1/min
export const kDeg = TK => C.hop.A2 * Math.exp(-C.hop.B2 / TK);   // 1/min
function hopStep(st, Tc, dtMin) { const k1 = kIso(Tc + 273.15), k2 = kDeg(Tc + 273.15); const dA = -k1 * st.A, dI = k1 * st.A - k2 * st.I; st.A += dA * dtMin; st.I += dI * dtMin; }

// ---------- (10) wort cooler: effectiveness-NTU, counterflow ----------
export function cooler(TwortIn, TcwIn, P) {
  const mw = C.V * sgOfPlato(P) * C.rhoW / (C.coolMin * 60), Cw = mw * C.cpWort;         // wort side, W/K
  const mc = C.cwRatio * C.V * C.rhoW / (C.coolMin * 60), Cc = mc * C.cpW;               // water side
  const Cmin = Math.min(Cw, Cc), Cmax = Math.max(Cw, Cc), Cr = Cmin / Cmax, NTU = C.UAcool / Cmin;
  const e = Math.exp(-NTU * (1 - Cr)), eps = Cr > 0.999 ? NTU / (1 + NTU) : (1 - e) / (1 - Cr * e);
  const q = eps * Cmin * (TwortIn - TcwIn);                                               // W
  return { eps, NTU, Cr, q, TwortOut: TwortIn - q / Cw, TcwOut: TcwIn + q / Cc, Cw, Cc, Q: q * C.coolMin * 60, mHot: mc * C.coolMin * 60 };
}

// ---------- (11)-(17) fermentation: Gee & Ramirez sugar uptake, growth, ethanol, heat; PI jacket cooling; diacetyl ----------
export function fermRates(y, TK) {
  const [G, M, N, X] = y, P = GR;
  const kG = arr(P.AG, P.EG, TK), kM = arr(P.AM, P.EM, TK), kN = arr(P.AN, P.EN, TK);
  const KG = arr(P.AKG, P.EKG, TK), KM = arr(P.AKM, P.EKM, TK), KN = arr(P.AKN, P.EKN, TK), IG = arr(P.AIG, P.EIG, TK), IM = arr(P.AIM, P.EIM, TK);
  const g = Math.max(G, 0), m = Math.max(M, 0), n = Math.max(N, 0);
  const m1 = kG * g / (KG + g), m2 = kM * m / (KM + m) * IG / (IG + g), m3 = kN * n / (KN + n) * IG / (IG + g) * IM / (IM + m);   // 1/s
  return { m1, m2, m3, kG, kM, kN, KG, KM, KN, IG, IM };
}
export const henry = Tc => C.H298 * Math.exp(C.HT * (1 / (Tc + 273.15) - 1 / 298.15));   // (18) mol/m3·Pa

export function ferment(wort, inp, opts = {}) {
  const dt = opts.dt || 120, maxDays = opts.maxDays || 40, rho = sgOfPlato(wort.OG) * C.rhoW, rcp = rho * C.cpWort;
  const X0 = C.X0 * inp.pitch, S0 = wort.G + wort.M + wort.N;
  let y = [wort.G, wort.M, wort.N, X0, 0, inp.fermT + 273.15, 0, 0, 0, 0];   // G M N X E T V(diacetyl) I(integral) Qcool(J/m3) Qgen(J/m3)
  const Kc = inp.Kc ?? C.Kc, tauI = (inp.tauI ?? C.tauI) * 3600, auto = inp.control !== "off";
  let phase = "primary", tRest = null, tReady = null, tEnd = null, peakV = 0, peakQ = 0, peakU = 0, tPeakQ = 0, Qloss = 0;
  const tsp = () => phase === "cold" ? 0 : (phase === "rest" ? inp.fermT + inp.rest : inp.fermT);
  const deriv = (s, Tsp) => {
    const TK = s[5], r = fermRates(s, TK), X = s[3];
    const rG = r.m1 * X, rM = r.m2 * X, rN = r.m3 * X;
    const cold = phase === "cold" ? 0 : 1;                           // yeast has settled out: no more growth or uptake
    const mux = (GR.YXG * r.m1 + GR.YXM * r.m2 + GR.YXN * r.m3) * GR.KX / (GR.KX + (X - X0) ** 2);
    const qgen = (GR.dHG * rG + GR.dHM * rM + GR.dHN * rN) * cold;   // W/m3
    const err = (TK - 273.15) - Tsp;
    let u = auto ? Kc * err + (Kc / tauI) * s[7] : 0; const sat = u > 1 || u < 0; u = Math.min(1, Math.max(0, u));
    const qc = u * C.UAj * (TK - 273.15 - C.Tgly), ql = C.UAloss * (C.Tcellar - (TK - 273.15));
    const rV = C.rV12 * Math.exp(-C.EV / R * (1 / TK - 1 / 285.15));
    return { d: [-rG * cold, -rM * cold, -rN * cold, mux * X * cold, (GR.YEG * rG + GR.YEM * rM + GR.YEN * rN) * cold, opts.isothermal ? 0 : (qgen - qc + ql) / rcp,
      C.YV * mux * X * cold - rV * s[6] * X * cold, (sat && Math.sign(err) === Math.sign(u - 0.5)) ? 0 : err, qc, qgen], u, qgen, qc, ql };
  };
  const rec = { t: [], G: [], M: [], N: [], X: [], E: [], T: [], Tsp: [], u: [], q: [], qc: [], V: [], phase: [] };
  const every = Math.round(1800 / dt), nMax = Math.round(maxDays * 86400 / dt);
  for (let i = 0; i <= nMax; i++) {
    const t = i * dt, Tsp = tsp();
    const k1 = deriv(y, Tsp);
    if (i % every === 0) { rec.t.push(t / 3600); rec.G.push(y[0]); rec.M.push(y[1]); rec.N.push(y[2]); rec.X.push(y[3]); rec.E.push(y[4]); rec.T.push(y[5] - 273.15); rec.Tsp.push(Tsp); rec.u.push(k1.u); rec.q.push(k1.qgen); rec.qc.push(k1.qc); rec.V.push(y[6]); rec.phase.push(phase); }
    if (k1.qgen > peakQ) { peakQ = k1.qgen; tPeakQ = t; } if (phase !== "cold" && k1.qc > peakU) peakU = k1.qc; if (y[6] > peakV) peakV = y[6];
    // phase logic
    const left = (y[0] + y[1] + y[2]) / S0;
    if (phase === "primary" && inp.rest > 0 && left < 0.25) { phase = "rest"; tRest = t; }
    if (phase !== "cold" && tReady === null && left < C.doneLeft && y[6] < C.vdkLimit) { tReady = t; phase = "cold"; }
    if (tReady !== null && t >= tReady + inp.coldDays * 86400) { tEnd = t; break; }
    // RK4
    const add = (a, k, h) => a.map((v, j) => v + k[j] * h);
    const k2 = deriv(add(y, k1.d, dt / 2), Tsp), k3 = deriv(add(y, k2.d, dt / 2), Tsp), k4 = deriv(add(y, k3.d, dt), Tsp);
    y = y.map((v, j) => v + dt / 6 * (k1.d[j] + 2 * k2.d[j] + 2 * k3.d[j] + k4.d[j]));
    Qloss += (k1.ql) * dt;
  }
  const E = y[4], used = { G: wort.G - y[0], M: wort.M - y[1], N: wort.N - y[2] };
  return { rec, y, X0, tRest, tReady, tEnd, peakV, peakQ, tPeakQ, peakU, Qcool: y[8], Qgen: y[9], Qloss, E, used, rho, rcp, T0: inp.fermT, Tend: y[5] - 273.15, ready: tReady !== null };
}

// ---------- the whole batch ----------
export function runBatch(inpIn = {}, opts = {}) {
  const inp = { ...DEFAULTS, ...inpIn };
  // (1) mash-in and conversion
  const ms = mash(inp.mashT, inp.mashMin);
  const extractPot = inp.malt * C.extract, extractMash = extractPot * ms.conv, extractKettle = extractMash * C.etaL;   // kg
  const OG = platoOfExtract(extractKettle * 1000 / (C.V * 1000)), SG = sgOfPlato(OG);
  const mashWater = inp.malt * C.liquor / 1000;                                       // m3
  // (6) lautering: Darcy flow through the grain bed
  const evapFrac = inp.evap / 100 * inp.boilMin / 60, Vhot = C.V / 0.96;             // 4 % shrinkage on cooling (assumed)
  const Vpre = Vhot / (1 - evapFrac), bedDepth = C.bedL * inp.malt / C.tunA;
  const Ppre = platoOfExtract(extractKettle * 1000 / (Vpre * 1000));
  const Qlauter = C.perm * C.tunA * C.dPbed / (muWort(C.Tlauter, Ppre) * bedDepth);   // m3/s
  const lauterMin = Vpre / Qlauter / 60;
  const grainAbsorb = inp.malt * 1.0 / 1000;                                          // m3 water held by the spent grain (assumed 1 L/kg)
  const spargeWater = Math.max(0, Vpre + grainAbsorb - mashWater);
  // (7)-(8) boil: evaporation and energy
  const mPre = Vpre * sgOfPlato(Ppre) * C.rhoW * 0.975, mEvap = Vpre * evapFrac * 958;    // kg (hot densities)
  const Qheat = mPre * C.cpWort * (C.Tboil - C.Tlauter), Qevap = mEvap * C.hfg;
  // (9) hops through boil and whirlpool
  const hop = { A: inp.hops * inp.alpha / 100 * 1000 * (C.V * 10) / (Vhot * 1000), I: 0 };   // mg/L alpha acids at knock-out volume basis
  const A0 = hop.A, hopCurve = [];
  for (let t = 0; t <= inp.boilMin; t++) { hopCurve.push({ t, A: hop.A, I: hop.I, T: C.Tboil }); if (t < inp.boilMin) for (let k = 0; k < 10; k++) hopStep(hop, C.Tboil, 0.1); }
  for (let t = 1; t <= C.whirl; t++) { const Tw = C.Twhirl0 + (C.Twhirl1 - C.Twhirl0) * t / C.whirl; for (let k = 0; k < 10; k++) hopStep(hop, Tw, 0.1); hopCurve.push({ t: inp.boilMin + t, A: hop.A, I: hop.I, T: Tw }); }
  const isoWort = hop.I * Vhot / C.V, IBU = isoWort * C.hop.keep, util = IBU / (inp.hops * inp.alpha / 100 * 1000 * 10 / 1000 || 1);
  // (10) wort cooler
  const cool = cooler(C.Twhirl1, inp.cwT, OG);
  const Qtrim = Math.max(0, cool.TwortOut - inp.fermT) * cool.Cw * C.coolMin * 60;    // J removed by glycol to reach pitching temperature
  // wort sugars, mol/m3
  const fermGL = extractGL(OG) * ms.ferm;
  const wort = { OG, SG, G: fermGL * C.split.G / MW.G * 1000, M: fermGL * C.split.M / MW.M * 1000, N: fermGL * C.split.N / MW.N * 1000, fermGL, extractGL: extractGL(OG) };
  // fermentation and maturation
  const fz = ferment(wort, inp, opts);
  const EgL = fz.E * MW.E / 1000, ABV = EgL / 7.893;
  const sugarLeft = (fz.y[0] * MW.G + fz.y[1] * MW.M + fz.y[2] * MW.N) / 1000;
  const REgL = wort.extractGL - wort.fermGL + sugarLeft, RE = platoOfExtract(REgL), AE = (RE - 0.1808 * OG) / 0.8192;   // (19) Balling
  const FGsg = sgOfPlato(Math.max(AE, 0)), RDF = (1 - RE / OG) * 100, ADF = (1 - AE / OG) * 100;
  // balances on the fermenter
  const sugarUsedKg = (fz.used.G * MW.G + fz.used.M * MW.M + fz.used.N * MW.N) / 1000 * C.V;
  const ethKg = EgL * C.V, co2Mol = fz.E, co2Kg = co2Mol * MW.C / 1000 * C.V;
  const cIn = fz.used.G * 6 + fz.used.M * 12 + fz.used.N * 18, cOut = fz.E * 2 + co2Mol * 1;
  // (18) carbonation
  const cSat = henry(fz.rec.T[fz.rec.T.length - 1] > 5 ? fz.T0 : 0) * C.patm, cEndFerm = henry(inp.rest > 0 ? inp.fermT + inp.rest : inp.fermT) * C.patm;
  const cTarget = inp.vols / 0.022414, Tbright = 2, pBright = cTarget / henry(Tbright), co2AddKg = Math.max(0, cTarget - cEndFerm) * MW.C / 1000 * C.V;
  // (20) Stokes settling in the cold tank
  const vFloc = C.dFloc ** 2 * C.dRho * 9.81 / (18 * C.muBeer0), vCell = C.dCell ** 2 * C.dRho * 9.81 / (18 * C.muBeer0);
  const clearDays = C.hTank / vFloc / 86400, clarity = Math.min(1, inp.coldDays / clearDays);
  // packaging
  const Vpack = C.V * (1 - C.loss), kegs = Math.floor(Vpack * 1000 / C.kegL), servings = Math.round(Vpack * 1000 / 0.355);
  // utilities and sustainability
  const QmashWater = mashWater * C.rhoW * C.cpW * (inp.mashT + 6 - 12) + inp.malt * C.cpMalt * (inp.mashT - 15);   // strike water 6 K above mash (assumed), supply at 12 °C
  const QspargeWater = spargeWater * C.rhoW * C.cpW * (76 - 12);
  const hotNeed = QmashWater + QspargeWater, Qrec = Math.min(cool.Q * 0.9, hotNeed);     // hot water from the cooler offsets water heating (10 % storage loss, assumed)
  const thermalJ = (hotNeed - Qrec + Qheat + Qevap) / C.boilerEff, thermalNoRec = (hotNeed + Qheat + Qevap) / C.boilerEff;
  const COP = C.copFrac * (C.Tevap + 273.15) / (C.Tcond - C.Tevap);
  const Qcrash = fz.rcp * C.V * Math.max(0, (inp.rest > 0 ? inp.fermT + inp.rest : inp.fermT) - 0);
  const coolJ = fz.Qcool * C.V + Qtrim, elecJ = coolJ / COP;
  const waterIn = mashWater + spargeWater + C.cleanWater * Vpack, waterRatio = waterIn / Vpack;
  const spentDry = inp.malt * 0.96 - extractMash, spentWet = spentDry / (1 - C.spentMoist);   // malt at 4 % moisture (assumed)
  const hl = Vpack * 10;
  const days = fz.tEnd !== null ? fz.tEnd / 86400 : null;
  return { inp, ms, wort, fz, hopCurve, cool,
    extractPot, extractMash, extractKettle, brewhouseYield: extractKettle / inp.malt, OG, SG, mashWater, spargeWater, grainAbsorb, Vpre, Vhot, Ppre, bedDepth, Qlauter, lauterMin,
    evapFrac, mEvap, Qheat, Qevap, A0, isoWort, IBU, util, Qtrim,
    EgL, ABV, RE, AE, FGsg, RDF, ADF, sugarLeft, sugarUsedKg, ethKg, co2Kg, cIn, cOut, carbonClosure: cOut / cIn, ethYield: ethKg / sugarUsedKg,
    cEndFerm, cTarget, pBright, Tbright, co2AddKg, vFloc, vCell, clearDays, clarity, Vpack, kegs, servings,
    QmashWater, QspargeWater, Qrec, thermalJ, thermalNoRec, COP, Qcrash, coolJ, elecJ, waterIn, waterRatio, spentDry, spentWet, hl,
    thermalKWhHl: thermalJ / 3.6e6 / hl, elecKWhHl: elecJ / 3.6e6 / hl, co2KgHl: co2Kg / hl, spentKgHl: spentWet / hl, gasCO2KgHl: thermalJ / 3.6e6 * C.efGas / hl,
    tankDays: days, readyDays: fz.tReady !== null ? fz.tReady / 86400 : null, restDay: fz.tRest !== null ? fz.tRest / 86400 : null,
    timeline: timeline(inp, lauterMin, fz) };
}

// stage boundaries: brew day in minutes, then the cellar in hours
function timeline(inp, lauterMin, fz) {
  const st = [["mash", inp.mashMin], ["lauter", lauterMin], ["heat", C.heatUp], ["boil", inp.boilMin], ["whirlpool", C.whirl], ["cool", C.coolMin]];
  let t = 0; const stages = st.map(([name, dur]) => { const s = { name, t0: t, t1: t + dur }; t += dur; return s; });
  const brewMin = t, fermH = fz.rec.t[fz.rec.t.length - 1];
  return { stages, brewMin, fermH, nBrew: Math.ceil(brewMin), nFerm: fz.rec.t.length, n: Math.ceil(brewMin) + fz.rec.t.length };
}

// state at timeline index i (0..n-1): brew-day minutes first, then fermentation samples every 30 min
export function stateAt(B, i) {
  const TL = B.timeline, inp = B.inp;
  if (i < TL.nBrew) {
    const t = i, s = TL.stages.find(x => t < x.t1) || TL.stages[TL.stages.length - 1], f = Math.min(1, (t - s.t0) / (s.t1 - s.t0));
    const o = { part: "brew", stage: s.name, frac: f, tMin: t };
    if (s.name === "mash") { const c = B.ms.curve[Math.min(B.ms.curve.length - 1, Math.round(t))]; Object.assign(o, c, { T: inp.mashT }); }
    else if (s.name === "lauter") o.T = C.Tlauter;
    else if (s.name === "heat") o.T = C.Tlauter + (C.Tboil - C.Tlauter) * f;
    else if (s.name === "boil" || s.name === "whirlpool") { const k = Math.min(B.hopCurve.length - 1, Math.max(0, Math.round(t - TL.stages[3].t0))); Object.assign(o, { T: B.hopCurve[k].T, A: B.hopCurve[k].A, I: B.hopCurve[k].I }); }
    else o.T = C.Twhirl1 + (B.cool.TwortOut - C.Twhirl1) * f;
    return o;
  }
  const k = Math.min(B.fz.rec.t.length - 1, i - TL.nBrew), r = B.fz.rec, S0 = B.wort.G + B.wort.M + B.wort.N, S = r.G[k] + r.M[k] + r.N[k];
  const sugGL = (r.G[k] * MW.G + r.M[k] * MW.M + r.N[k] * MW.N) / 1000, RE = platoOfExtract(B.wort.extractGL - B.wort.fermGL + sugGL), AE = (RE - 0.1808 * B.OG) / 0.8192;
  return { part: "cellar", stage: r.phase[k] === "cold" ? "mature" : "ferment", phase: r.phase[k], k, tH: r.t[k], T: r.T[k], Tsp: r.Tsp[k], u: r.u[k], q: r.q[k], qc: r.qc[k],
    G: r.G[k], M: r.M[k], N: r.N[k], X: r.X[k], E: r.E[k], V: r.V[k], att: 1 - S / S0, RE, AE, sg: sgOfPlato(Math.max(AE, 0)), abv: r.E[k] * MW.E / 1000 / 7.893,
    co2Rate: r.q[k] / (B.fz.peakQ || 1) };
}
