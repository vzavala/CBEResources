// Ice cream line process models. Pure functions, no three.js: mix formulation in, every unit's state out.
// Units: temperatures °C, mass fractions as % of mix unless noted, SI elsewhere. Each block cites its basis;
// constants marked "Typical" are representative industry or literature values, not plant data.

// Process set-points follow Babcock Hall Dairy Plant's public description (Babcock Dairy Store, "Ice Cream 101"):
// blend at 110 °F, homogenise, pasteurise ≥ 180 °F for ≥ 15 s, cool < 40 °F, hydrate ≥ 16 h, 80 % overrun,
// draw ≈ 20 °F, harden in a −20 °F deep freezer. The recipe itself is not public: composition is Typical.
// Default product: a generic chocolate ice cream with a fudge swirl and dark chocolate flakes (typical, illustrative). Its base is cream, milk, sugar, Dutch cocoa, skim milk,
// stabiliser and vanilla. Percentages below are Typical for a premium chocolate mix (Goff & Hartel 2013): extra sugar
// to balance cocoa bitterness, ≈ 3 % cocoa. Swirl and flake loadings are Assumed (Babcock does not publish them).
export const DEFAULTS = {
  fat: 14, msnf: 9.5, sugar: 17, cocoa: 3, stab: 0.25, emul: 0.15, // % w/w of mix (Typical)
  swirl: 10, flake: 3,                                           // % of finished weight, added after the freezer (Assumed)
  overrun: 80, Tdraw: -6.7, Phom: 17, Thard: -29,               // %, °C (20 °F), MPa (1st stage, Typical), °C air (−20 °F)
  Tpast: 82.2, tHold: 15, tAge: 16, Tstore: -29,                 // °C (180 °F), s, h, °C
  pkg: "pint",
};
export const PACKAGES = {      // round paper containers, modelled as square-section boxes of side 0.85·D (same wall distance)
  pint: { name: "Pint", L: 0.473, D: 0.090, H: 0.085, cost: 0.10 },
  tub3: { name: "3-gallon tub", L: 11.36, D: 0.265, H: 0.255, cost: 1.20 },
};
export const PRESETS = {
  badger: { label: "Chocolate", fat: 14, msnf: 9.5, sugar: 17, cocoa: 3, stab: 0.25, emul: 0.15, swirl: 10, flake: 3, overrun: 80, Tdraw: -6.7, Phom: 17, Thard: -29 },
  standard: { label: "Classic vanilla", fat: 12, msnf: 11, sugar: 15, cocoa: 0, stab: 0.30, emul: 0.15, swirl: 0, flake: 0, overrun: 80, Tdraw: -6.7, Phom: 17, Thard: -29 },
  premium: { label: "Premium", fat: 16, msnf: 9.5, sugar: 16, cocoa: 0, stab: 0.15, emul: 0.15, swirl: 0, flake: 0, overrun: 50, Tdraw: -6, Phom: 14, Thard: -38 },
  economy: { label: "Economy", fat: 10, msnf: 11.5, sugar: 14, cocoa: 0, stab: 0.40, emul: 0.15, swirl: 0, flake: 0, overrun: 120, Tdraw: -5, Phom: 18, Thard: -32 },
  lowfat: { label: "Light", fat: 4, msnf: 12.5, sugar: 15, cocoa: 0, stab: 0.45, emul: 0.15, swirl: 0, flake: 0, overrun: 90, Tdraw: -5.5, Phom: 20, Thard: -35 },
};

// ---------------------------------------------------------------- constants
const T0K = 273.15, Rgas = 8.314;
const M_W = 18.015, M_DIS = 342.3;          // water; sucrose and lactose (both disaccharides)
export const PLANT = {                        // Typical sizing for a mid-size continuous line
  Qpast: 2000,          // L/h mix through the HTST (Typical for a pilot-scale plant; Babcock's capacities are not published)
  Qmix: 500,            // L/h mix to the freezer (≈ 900 L/h ice cream at 80 % overrun)
  Tblend: 43,           // °C blend temperature (110 °F, Babcock)
  Traw: 43,             // °C mix into regeneration (blend temperature; homogeniser heat added in htst())
  Tcold: 4,             // °C mix out of the cooler, into the ageing tanks
  epsRegen: 0.85,       // regeneration effectiveness
  holdID: 0.0475,       // m, 2-inch sanitary tube
  Dbar: 0.15, Lbar: 0.9, Ddash: 0.10, Ndash: 420, nBlades: 2,  // freezer barrel and dasher
  Pbar: 4.0,            // bar abs in the barrel
  hNH3: 8000,           // W/m²K flooded ammonia boiling in the jacket
  wall: 0.006, kWall: 60,                                       // m, W/mK nickel barrel wall
  hAir: 20, Rcarton: 0.006,                                     // W/m²K in a fan-driven freezer room, m²K/W paperboard
  Tcond: 35, etaIs: 0.75,                                       // °C condensing, compressor isentropic efficiency
  storeUA: 0.35, Tamb: 20, storeFix: 6,                         // kW/K envelope+infiltration (≈ 15 × 18 × 6 m room), °C, kW fans/lights/doors
};

// ---------------------------------------------------------------- composition
export function composition(p) {
  const lact = 0.545 * p.msnf, prot = 0.36 * p.msnf, ash = 0.08 * p.msnf;
  const cocoa = p.cocoa || 0;                                   // Dutch cocoa: insoluble solids, ≈ 11 % cocoa butter (Typical)
  const water = 100 - p.fat - p.msnf - p.sugar - cocoa - p.stab - p.emul;
  const TS = 100 - water;
  // density from additive specific volumes (Typical component densities, kg/L)
  const v = p.fat / 0.93 + p.msnf / 1.58 + p.sugar / 1.59 + (p.stab + p.emul) / 1.5 + cocoa / 1.45 + water / 1.0;
  const rho = 100 / v * 1000;                                   // kg/m³
  // Choi–Okos-type heat capacity above freezing, kJ/kg K
  const carb = p.sugar + lact + p.stab, oth = p.msnf - lact - prot - ash;
  const cp = (4.18 * water + 1.98 * p.fat + 2.0 * (prot + oth) + 1.55 * carb + 1.1 * ash + 1.9 * p.emul + 1.6 * cocoa) / 100;
  const SE = p.sugar + lact;                                    // g disaccharide per 100 g mix
  const phiFat = p.fat / 0.93 / v;                              // fat volume fraction
  const phiCocoa = cocoa / 1.45 / v;                            // cocoa particle volume fraction
  return { lact, prot, ash, water, TS, rho, cp, SE, phiFat, phiCocoa };
}

// ---------------------------------------------------------------- freezing curve
// ln a_w of ice relative to supercooled water (Fontan & Chirife fit): ln a_w = 9.6934e-3 T + 4.761e-6 T²
const lnAwIce = T => 9.6934e-3 * T + 4.761e-6 * T * T;
const tFromLnAw = la => { const a = 4.761e-6, b = 9.6934e-3; return (-b + Math.sqrt(b * b + 4 * a * la)) / (2 * a); };
const NORRISH_K = 6.47;                                        // sucrose, Typical (Norrish 1966)
// freezing temperature of the serum when Wu g of water per 100 g mix remain unfrozen
function serumTf(c, msnf, Wu) {
  const ns = c.SE / M_DIS, nw = Wu / M_W, xs = ns / (ns + nw);
  const lnAw = Math.log(1 - xs) - NORRISH_K * xs * xs;
  const tSE = tFromLnAw(lnAw);
  const salts = 2.37 * msnf / Wu;                              // milk salts, empirical (Goff & Hartel 2013)
  return tSE - salts;
}
export const TG_PRIME = -32;     // °C, Tg' of a sucrose/lactose ice cream serum (Typical, Levine & Slade / Goff)
export function freezing(p, c = composition(p)) {
  const W = c.water, Wg = 0.25 * c.SE + 0.25 * c.prot;          // unfreezable water at Cg' ≈ 0.80 (Typical)
  const Tf = serumTf(c, p.msnf, W);
  const ice = T => {                                            // kg ice per kg mix at T
    if (T >= Tf) return 0;
    const Tm = Math.max(T, TG_PRIME);
    let lo = Wg, hi = W;
    if (serumTf(c, p.msnf, lo) > Tm) return (W - Wg) / 100;
    for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (serumTf(c, p.msnf, m) > Tm) hi = m; else lo = m; }
    return (W - (lo + hi) / 2) / 100;
  };
  const xs = c.TS / 100, xw = W / 100, cps = (c.cp * 100 - 4.18 * W) / c.TS;
  const Lf = T => 333.6 + 2.11 * T;                            // kJ/kg latent heat (falls with T: Δcp ice/water)
  const Tref = -40;
  // enthalpy per kg mix relative to all-liquid at −40 °C, minus latent heat of the ice present
  const H = T => (xs * cps + xw * 4.18) * (T - Tref) - ice(T) * Lf(T);
  return { Tf, ice, H, Wg, maxIce: (W - Wg) / 100, Lf, cps };
}

// tabulated version for the hot loops
export function freezeTable(p) {
  const c = composition(p), f = freezing(p, c), T = [], I = [], H = [];
  for (let t = -55; t <= 90.001; t += 0.25) { T.push(t); I.push(f.ice(t)); H.push(f.H(t)); }
  const at = (arr, t) => { const x = (Math.min(90, Math.max(-55, t)) + 55) / 0.25, k = Math.min(arr.length - 2, Math.floor(x)), u = x - k; return arr[k] + (arr[k + 1] - arr[k]) * u; };
  const Tof = h => { let lo = 0, hi = H.length - 1; if (h <= H[0]) return T[0]; if (h >= H[hi]) return T[hi];
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (H[m] > h) hi = m; else lo = m; } return T[lo] + (h - H[lo]) / (H[hi] - H[lo]) * 0.25; };
  return { c, f, T, I, H, ice: t => at(I, t), Hof: t => at(H, t), Tof };
}

// ---------------------------------------------------------------- viscosity
const etaWater = TK => 2.414e-5 * 10 ** (247.8 / (TK - 140));   // Pa s (Vogel form, valid to supercooled water)
function etaSerum(T, xSugar, cStab) {                              // sugar solution + stabiliser, Pa s at ~50 1/s
  const base = etaWater(T + T0K) * Math.exp(4.06 * xSugar / (1 - 0.8 * Math.min(0.9, xSugar)));
  return base * (1 + 60 * Math.pow(Math.max(0, cStab), 1.6));
}
const kd = (phi, pm = 0.64) => Math.pow(1 - Math.min(phi, 0.97 * pm) / pm, -2.5 * pm);   // Krieger–Dougherty
export function mixViscosity(p, c, T, hydr = 1) {
  const xs = c.SE / (c.SE + c.water), cSt = p.stab / (c.water + c.SE) * 100;
  const eta = etaSerum(T, xs, cSt) * kd(c.phiFat + (c.phiCocoa || 0)) * kd(0.1) * (1 + 0.25 * hydr);
  const n = 1 - 0.55 * p.stab / (p.stab + 0.15);                 // power-law index (shear thinning from stabiliser)
  return { eta, n, K: eta * 50 ** (1 - n) };
}

// ---------------------------------------------------------------- HTST
export const LM = { D72: 1.5, z: 6.5, name: "Listeria monocytogenes" };   // D at 72 °C (s), z (°C): Typical, in milk
export function htst(p, c) {
  const P = PLANT, m = P.Qpast / 3600 / 1000 * c.rho, C = m * c.cp;          // kg/s, kW/K
  const dTh = p.Phom * 1e6 / (c.rho * c.cp * 1000);                          // homogeniser temperature rise
  const Thold = p.Tpast, Th = Thold, Tin = P.Traw + dTh;                   // homogenised warm (after blending), before the HTST
  const Tr = Tin + P.epsRegen * (Thold - Tin), Tc1 = Thold - (Tr - Tin);
  const Qreg = C * (Tr - Tin), Qheat = C * (Th - Tr), Qcool = C * (Tc1 - P.Tcold), Qhom = C * dTh;
  // section areas, counter-current, U Typical for viscous mix in chevron plates
  const lmtd = (a, b) => Math.abs(a - b) < 1e-6 ? a : (a - b) / Math.log(a / b);
  const Ureg = 3000, Uheat = 3500, Ucool = 3000, Ap = 0.25;
  const Areg = Qreg * 1000 / (Ureg * (Thold - Tr));
  const Thw = Th + 4, Cw = 2 * C, Thw2 = Thw - Qheat / Cw;                  // hot water 4 K over, 2× capacity rate
  const Aheat = Qheat * 1000 / (Uheat * lmtd(Thw - Th, Thw2 - Tr));
  const Tiw = 1, Ciw = 3 * C, Tiw2 = Tiw + Qcool / Ciw;                       // ice water 1 °C, 3× capacity rate
  const Acool = Qcool * 1000 / (Ucool * lmtd(Tc1 - Tiw2, P.Tcold - Tiw));
  const plates = A => Math.ceil(A / Ap);
  // holding tube
  const Q = P.Qpast / 3600 / 1000, A = Math.PI * P.holdID ** 2 / 4, v = Q / A;
  const mu = mixViscosity(p, c, Thold, 1).eta;
  const Re = c.rho * v * P.holdID / mu, laminar = Re < 2100, vmax = v * (laminar ? 2 : 1.22);
  const Ltube = vmax * p.tHold;
  // lethality, holding tube only (as regulators credit it), at the fastest-particle residence time
  const L = 10 ** ((Thold - 72) / LM.z), F72 = p.tHold * L, logRed = F72 / LM.D72;
  const pmo = (Thold >= 79.4 && p.tHold >= 25) || (Thold >= 82.2 && p.tHold >= 15);
  const milkMin = Thold >= 71.7 && p.tHold >= 15;
  // temperature profile along the flow path (product), for the chart
  return { m, C, dTh, Tin, Thold, Th, Tr, Tc1, Qreg, Qheat, Qcool, Qhom, Areg, Aheat, Acool, Thw, Thw2, Tiw, Tiw2,
    nReg: plates(Areg), nHeat: plates(Aheat), nCool: plates(Acool), v, Re, laminar, vmax, Ltube, mu, L, F72, logRed, pmo, milkMin,
    regenSave: Qreg / (Qreg + Qheat), NTUreg: P.epsRegen / (1 - P.epsRegen) };
}

// ---------------------------------------------------------------- homogeniser
export function homogenizer(p, c) {
  const P1 = p.Phom, P2 = 0.2 * P1;                             // second stage ≈ 20 % of the first (Typical)
  const d32raw = 3.4;                                           // µm, raw milk fat (Typical)
  const d32 = Math.min(d32raw, 0.95 * Math.pow(P1 / 10, -0.6) * (1 + 0.025 * Math.max(0, p.fat - 10)));   // Walstra: d ∝ P^-0.6
  const S = 6 * c.phiFat / (d32 * 1e-6);                        // m² fat surface per m³ mix
  const protKgM3 = c.prot / 100 * c.rho, gamma = protKgM3 / S * 1e6;       // mg protein available per m² of new surface
  const vGap = Math.sqrt(2 * P1 * 1e6 / c.rho);                 // m/s jet velocity in the valve gap (Bernoulli)
  const Q = PLANT.Qpast / 3600 / 1000, Dv = 0.03, gap = Q / (Math.PI * Dv * vGap);
  const power = Q * P1 * 1e6 / 1000;                             // kW hydraulic
  const nPerL = c.phiFat / (Math.PI / 6 * (d32 * 1e-6) ** 3) / 1000;      // globules per litre (monodisperse estimate)
  return { P1, P2, d32, d32raw, S, gamma, vGap, gap, power, motor: power / 0.85, nPerL };
}

// ---------------------------------------------------------------- ageing
export function ageing(p, c, t = p.tAge) {
  const SFCeq = 0.62 / (1 + Math.exp((4 - 17) / 4.5));            // milk fat solid fat content at 4 °C (Typical curve)
  const tau = 0.8, n = 2;                                          // h, Avrami for emulsified milk fat (Typical)
  const X = 1 - Math.exp(-Math.pow(t / tau, n));
  const hydr = 1 - Math.exp(-t / 1.0);                            // protein / stabiliser hydration, τ ≈ 1 h
  const sfc = SFCeq * X;
  const visc = mixViscosity(p, c, 4, hydr);
  const curve = []; for (let h = 0; h <= 12.001; h += 0.25) curve.push([h, SFCeq * (1 - Math.exp(-Math.pow(h / tau, n))), 1 - Math.exp(-h / 1.0)]);
  return { SFCeq, X, sfc, hydr, visc, tau, n, curve, sfcAt: T => 0.62 / (1 + Math.exp((T - 17) / 4.5)) };
}

// ---------------------------------------------------------------- freezer (scraped-surface heat exchanger)
export function freezer(p, c, ft, age, overrideTdraw) {
  const P = PLANT, Tdraw = overrideTdraw ?? p.Tdraw, Tin = P.Tcold;
  const m = P.Qmix / 3600 / 1000 * c.rho;                         // kg/s mix
  const I = ft.ice(Tdraw), dH = ft.Hof(Tin) - ft.Hof(Tdraw);      // kg ice/kg mix, kJ/kg
  const Qprod = m * dH;                                           // kW
  // enthalpy-weighted mean product temperature in the barrel
  let s = 0, n = 40; for (let k = 0; k < n; k++) { const h = ft.Hof(Tin) - dH * (k + 0.5) / n; s += ft.Tof(h); } const Tmean = s / n;
  // geometry and residence time
  const Ab = Math.PI * P.Dbar * P.Lbar, Vann = Math.PI / 4 * (P.Dbar ** 2 - P.Ddash ** 2) * P.Lbar;
  const OR = p.overrun / 100, Qm = P.Qmix / 3600 / 1000;
  const Qair = OR * Qm * (1.01325 / P.Pbar) * ((Tmean + T0K) / (Tdraw + T0K));
  const tau = Vann / (Qm + Qair);
  const rhoAir = 1.01325e5 / (287 * (Tdraw + T0K)), mAir = OR * Qm * rhoAir;          // kg/s air
  // scraped-surface heat transfer: penetration theory (Harriott), apparent heat capacity of freezing mix
  const cpApp = dH / Math.max(0.5, Tin - Tdraw) * 1000, kMix = 0.5;
  const fScrape = P.nBlades * P.Ndash / 60;
  const hIn = 2 * Math.sqrt(kMix * c.rho * cpApp * fScrape / Math.PI);
  const U = 1 / (1 / hIn + P.wall / P.kWall + 1 / P.hNH3);
  // apparent viscosity at the draw: freeze-concentrated serum × ice (KD) × air × fat
  const Wu = c.water / 100 - I, xs = (c.SE / 100) / (c.SE / 100 + Wu), cSt = p.stab / 100 / (c.SE / 100 + Wu) * 100;
  const phiIce = (I / 0.917) / (1 / (c.rho / 1000)), phiAir = OR / (1 + OR);
  const etaS = etaSerum(Tdraw, xs, cSt) * (1 + 0.25 * age.hydr);
  const eta = etaS * kd(phiIce, 0.66) * kd(c.phiFat) * (1 + phiAir);
  const vTip = Math.PI * P.Dbar * P.Ndash / 60, gdot = vTip / ((P.Dbar - P.Ddash) / 2);
  const Pvisc = eta * gdot * gdot * Vann / 1000, Pdash = Pvisc + 2.0;                 // kW, + 2 kW scraping/no-load (Typical)
  const Qref = Qprod + Pdash + 0.5;                                                    // + barrel heat leak
  const Tevap = Tmean - Qref * 1000 / (U * Ab);
  // structure at the draw
  const sigma = 0.045, CaC = 0.6;                                                      // N/m, critical capillary number
  const DTaylor = 2 * CaC * sigma / (eta * gdot) * 1e6;                                // µm, Taylor breakup at nominal shear
  const Dair = 40 * Math.pow(DTaylor / 40, 0.4);                                       // tempered: partial breakup, empirical exponent
  const Lice = 24 * Math.pow(tau / 50, 0.2) * Math.exp(0.08 * (Tdraw + 5.5));            // µm, empirical scaling (Typical)
  return { m, Tin, Tdraw, I, dH, Qprod, Tmean, Ab, Vann, tau, Qair, mAir, rhoAir, cpApp, hIn, U, Wu, xs, phiIce, phiAir,
    etaS, eta, vTip, gdot, Pvisc, Pdash, Qref, Tevap, Dair, DTaylor, Lice, iceOfWater: I / (c.water / 100) };
}

// ---------------------------------------------------------------- hardening: 3-D enthalpy-method conduction in a carton
export function hardening(p, c, ft, Tstart, Tair = p.Thard, opts = {}) {
  const P = PLANT, OR = p.overrun / 100, rho = c.rho / (1 + OR);           // kg/m³ ice cream
  const pk = PACKAGES[p.pkg] || PACKAGES.pint;
  const [Lx, Ly, Lz] = [0.85 * pk.D, 0.85 * pk.D, pk.H].map(v => v / 2);  // octant by symmetry
  const nx = 10, ny = 7, nz = 5, dx = Lx / nx, dy = Ly / ny, dz = Lz / nz, N = nx * ny * nz;
  const phiA = OR / (1 + OR);
  const kOf = T => {                                                      // Maxwell–Eucken twice: ice in serum, air in matrix
    const I = ft.ice(T), phiI = (I / 0.917) / (1 / (c.rho / 1000)), ks = 0.45, ki = 2.22 + 0.0094 * -Math.min(0, T) * 0.5;
    const km = ks * (2 * ks + ki + 2 * phiI * (ki - ks)) / (2 * ks + ki - phiI * (ki - ks));
    const ka = 0.024; return km * (2 * km + ka - 2 * phiA * (km - ka)) / (2 * km + ka + phiA * (km - ka));
  };
  const kT = []; for (let t = -55; t <= 5; t += 0.5) kT.push(kOf(t));
  const kAt = T => { const x = (Math.min(5, Math.max(-55, T)) + 55) / 0.5, i = Math.min(kT.length - 2, Math.floor(x)); return kT[i] + (kT[i + 1] - kT[i]) * (x - i); };
  const Hv = new Float64Array(N).fill(ft.Hof(Tstart) * 1000 * rho), T = new Float64Array(N).fill(Tstart), k = new Float64Array(N);
  const Ueff = 1 / (1 / P.hAir + P.Rcarton);
  const id = (i, j, l) => (l * ny + j) * nx + i;
  const dt = Math.min(30, 0.8 * rho * 1900 / (2 * 1.2 * (1 / (dx * dx) + 1 / (dy * dy) + 1 / (dz * dz)))), tMax = opts.tMax ?? 72 * 3600;
  const hist = [], core = id(0, 0, 0), corner = id(nx - 1, ny - 1, nz - 1), Kx = 1 / (dx * dx), Ky = 1 / (dy * dy), Kz = 1 / (dz * dz);
  let t = 0, tCore = null, ripen = 0, ripenAvg = 0;
  const kRate = T => recrystRate(T, p.stab);
  const dH = new Float64Array(N);
  while (t < tMax) {
    for (let q = 0; q < N; q++) k[q] = kAt(T[q]);
    for (let l = 0; l < nz; l++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const q = id(i, j, l); let s = 0;
      const nb = (qq, K) => { const kf = 2 * k[q] * k[qq] / (k[q] + k[qq]); s += kf * (T[qq] - T[q]) * K; };
      if (i > 0) nb(id(i - 1, j, l), Kx); if (i < nx - 1) nb(id(i + 1, j, l), Kx); else s += (Tair - T[q]) / (1 / Ueff + dx / (2 * k[q])) / dx;
      if (j > 0) nb(id(i, j - 1, l), Ky); if (j < ny - 1) nb(id(i, j + 1, l), Ky); else s += (Tair - T[q]) / (1 / Ueff + dy / (2 * k[q])) / dy;
      if (l > 0) nb(id(i, j, l - 1), Kz); if (l < nz - 1) nb(id(i, j, l + 1), Kz); else s += (Tair - T[q]) / (1 / Ueff + dz / (2 * k[q])) / dz;
      dH[q] = s * dt;
    }
    let Tsum = 0;
    for (let q = 0; q < N; q++) { Hv[q] += dH[q]; T[q] = ft.Tof(Hv[q] / rho / 1000); Tsum += T[q]; }
    t += dt;
    ripen += kRate(T[core]) * dt; ripenAvg += kRate(Tsum / N) * dt;
    if (t - (hist.at(-1)?.[0] ?? -1) * 3600 >= 60) hist.push([t / 3600, T[core], T[corner], Tsum / N]);
    if (tCore === null && T[core] <= -18) { tCore = t; if (!opts.full) break; }
  }
  const Tmean = T.reduce((a, b) => a + b, 0) / N;
  const Hout = Hv.reduce((a, b) => a + b, 0) / N / rho / 1000;
  return { tCore, hist, rho, Tmean, Hout, ripen, ripenAvg, Ueff, k0: kAt(Tstart), k18: kAt(-18), pk, half: [Lx, Ly, Lz] };
}

// recrystallisation (Ostwald ripening / accretion) rate constant, µm³/s, WLF kinetics above Tg'
export function recrystRate(T, stab = 0.3) {
  if (T <= TG_PRIME) return 0;
  const d = T - TG_PRIME, dref = -18 - TG_PRIME;
  const logShift = 17.44 * d / (51.6 + d) - 17.44 * dref / (51.6 + dref);     // log10 rate(T)/rate(−18 °C)
  return 0.042 * Math.pow(10, logShift) * 2.5 / (1 + 1.5 * stab / 0.3);       // 0.042 µm³/s at −18 °C, 0.3 % stabiliser
}

// ---------------------------------------------------------------- ammonia refrigeration
const R_NH3 = 8.314 / 17.031, K_NH3 = 1.29, CP_NH3 = K_NH3 * R_NH3 / (K_NH3 - 1);   // kJ/kg K (ideal-gas vapour)
export const nh3 = {
  psat: T => 10 ** (4.86886 - 1113.928 / (T + T0K - 10.409)),   // bar, NIST Antoine (164–371 K)
  hf: T => 200 + 4.6 * T + 0.0021 * T * T,                       // kJ/kg sat. liquid (IIR reference, 200 at 0 °C)
  hfg: T => 1262.2 - 3.55 * T - 0.0083 * T * T,                  // kJ/kg latent heat (fit to tables, ±1 %)
  Tsat: P => 1113.928 / (4.86886 - Math.log10(P)) + 10.409 - T0K,
};
nh3.hg = T => nh3.hf(T) + nh3.hfg(T);
function compress(Te, pHi, eta) {           // saturated vapour at Te compressed to pHi
  const T1 = Te + T0K, p1 = nh3.psat(Te), T2s = T1 * Math.pow(pHi / p1, (K_NH3 - 1) / K_NH3);
  const ws = CP_NH3 * (T2s - T1), w = ws / eta;
  return { ws, w, h1: nh3.hg(Te), h2: nh3.hg(Te) + w, T2: Te + w / CP_NH3, T2s: T2s - T0K };
}
export function nh3Cycle(Te, Tc = PLANT.Tcond, eta = PLANT.etaIs) {
  const pe = nh3.psat(Te), pc = nh3.psat(Tc);
  const carnot = (Te + T0K) / (Tc - Te);
  if (Te > -25) {                                                   // single stage
    const c = compress(Te, pc, eta), RE = nh3.hg(Te) - nh3.hf(Tc);
    return { stages: 1, pe, pc, RE, w: c.w, COP: RE / c.w, carnot, T2: c.T2,
      pts: [[nh3.hf(Tc), pe], [nh3.hg(Te), pe], [c.h2, pc], [nh3.hf(Tc), pc], [nh3.hf(Tc), pe]] };
  }
  // two stage with open flash intercooler at the geometric-mean pressure
  const pi = Math.sqrt(pe * pc), Ti = nh3.Tsat(pi);
  const L = compress(Te, pi, eta), H = compress(Ti, pc, eta);
  const mL = 1, mH = mL * (L.h2 - nh3.hf(Ti)) / (nh3.hg(Ti) - nh3.hf(Tc));
  const RE = nh3.hg(Te) - nh3.hf(Ti), W = mL * L.w + mH * H.w;
  return { stages: 2, pe, pc, pi, Ti, RE, w: W, COP: RE / W, carnot, T2: H.T2, T2L: L.T2, mH,
    pts: [[nh3.hf(Ti), pe], [nh3.hg(Te), pe], [L.h2, pi], [nh3.hg(Ti), pi], [H.h2, pc], [nh3.hf(Tc), pc], [nh3.hf(Tc), pi], [nh3.hf(Ti), pi], [nh3.hf(Ti), pe]] };
}

// ---------------------------------------------------------------- quality outcomes
export function quality(p, c, hom, age, fz, hard, storeWeeks = 4) {
  // fat partial coalescence (destabilised fat, %): needs solid fat after ageing, shear, ice crowding; emulsifier promotes
  const s = age.sfc / 0.5, S = Math.min(1, s * Math.exp(1 - s));
  const G = Math.min(1.4, Math.pow(hom.d32 / 0.7, 0.8)), E = 0.5 + Math.min(0.7, p.emul / 0.3);
  const Sh = Math.pow(fz.eta * fz.gdot / (14 * 126), 0.3) * Math.pow(fz.I / 0.31, 1.0);
  const PC = Math.min(75, 30 * S * G * E * Sh * Math.sqrt(p.fat / 12) * (p.fat > 0.5 ? 1 : 0));
  // ice crystals: no new nuclei after the draw, so crystals grow with the ice fraction; then ripen (WLF kinetics)
  const ft = fz._ft, Ihard = ft.ice(-18), Istore = ft.ice(p.Tstore);
  const Lgrow = fz.Lice * Math.cbrt(Math.max(Ihard, fz.I) / fz.I);
  const Lhard = Math.cbrt(Lgrow ** 3 + hard.ripen);
  const kS = recrystRate(p.Tstore, p.stab), tS = storeWeeks * 7 * 86400;
  const Lstore = Math.cbrt(Lhard ** 3 * Math.max(Istore, Ihard) / Ihard + kS * tS);
  // air cells: coarsen by disproportionation, slowed by a partially coalesced fat network
  const shield = Math.max(0.25, 1 - PC / 45);
  const Dhard = Math.cbrt(fz.Dair ** 3 + 1.5 * hard.ripen * shield);
  const Dstore = Math.cbrt(Dhard ** 3 + 1.5 * kS * tS * shield);
  // meltdown: % dripped after 45 min at 22 °C (indicative trend model)
  const OR = p.overrun / 100;
  const melt = Math.max(3, Math.min(95, 80 * Math.exp(-PC / 28) * (1.5 - 0.5 * OR) / (1 + 0.8 * p.stab / 0.3)));
  const flags = [];
  if (Lstore > 50) flags.push(["Icy, coarse texture", `ice crystals ${Lstore.toFixed(0)} µm > 50 µm detection threshold`]);
  if (Dstore > 80) flags.push(["Coarse, open body", `air cells ${Dstore.toFixed(0)} µm`]);
  if (PC > 50) flags.push(["Buttery / churned fat", `${PC.toFixed(0)} % destabilised fat`]);
  if (PC < 12 && p.fat >= 6) flags.push(["Wet, fast meltdown", "too little fat structure to stabilise the air"]);
  const lactW = c.lact / c.water * 100;
  if (lactW > 10) flags.push(["Sandiness risk", `lactose ${lactW.toFixed(1)} g per 100 g water (rule of thumb ≲ 10)`]);
  return { PC, Lgrow, Lhard, Lstore, Dair: fz.Dair, Dhard, Dstore, melt, flags, lactW, Ihard, Istore };
}

export function standards(p, c, OR = p.overrun / 100) {
  const rhoIC = c.rho / (1 + OR) / 1000;                          // kg/L
  const solidsPerL = rhoIC * c.TS / 100;
  // bulky flavours: cocoa solids count 2.5 × their weight; limits apply to the remainder, never below 8 % / 16 %
  const bulky = 2.5 * (p.cocoa || 0), fatMin = Math.max(8, 0.10 * (100 - bulky)), msMin = Math.max(16, 0.20 * (100 - bulky));
  const lim = (x, base) => bulky ? `${x.toFixed(1)} % (${base} of the mix after the 2.5 × cocoa allowance)` : `${base}`;
  return { rhoIC, solidsPerL, bulky, items: [            // US 21 CFR 135.110 (ice cream)
    [`Milkfat ≥ ${lim(fatMin, "10 %")}`, p.fat >= fatMin - 1e-9, `${p.fat.toFixed(1)} %`],
    [`Total milk solids ≥ ${lim(msMin, "20 %")}`, p.fat + p.msnf >= msMin - 1e-9, `${(p.fat + p.msnf).toFixed(1)} %`],
    ["Weight ≥ 4.5 lb/gal (0.539 kg/L)", rhoIC >= 0.539, `${rhoIC.toFixed(3)} kg/L`],
    ["Food solids ≥ 1.6 lb/gal (0.192 kg/L)", solidsPerL >= 0.192, `${solidsPerL.toFixed(3)} kg/L`],
  ] };
}

// ---------------------------------------------------------------- economics (Typical US wholesale, order of magnitude)
export const PRICES = { fat: 6.0, msnf: 2.8, sugar: 1.0, cocoa: 5.0, stab: 12, emul: 6, swirl: 3.0, flake: 6.0, kWh: 0.10 };   // $/kg, $/kWh (Typical; cocoa, swirl, flake Assumed)
// inclusions: % of finished weight → kg added per kg of frozen base
export const inclPerBase = p => { const x = ((p.swirl || 0) + (p.flake || 0)) / 100; return { swirl: (p.swirl || 0) / 100 / (1 - x), flake: (p.flake || 0) / 100 / (1 - x) }; };
export function economics(p, c, fz, energy) {
  const mixKg = (p.fat * PRICES.fat + p.msnf * PRICES.msnf + p.sugar * PRICES.sugar + (p.cocoa || 0) * PRICES.cocoa + p.stab * PRICES.stab + p.emul * PRICES.emul) / 100;
  const ib = inclPerBase(p), inclKg = ib.swirl * PRICES.swirl + ib.flake * PRICES.flake;   // $ per kg of frozen base
  const OR = p.overrun / 100, kgPerL = c.rho / 1000 / (1 + OR), ingL = (mixKg + inclKg) * kgPerL;
  const icLh = PLANT.Qmix * (1 + OR), kWhL = energy.total / icLh, enL = kWhL * PRICES.kWh;
  const pk = PACKAGES[p.pkg] || PACKAGES.pint, packL = pk.cost / pk.L;
  return { mixKg, ingL, kWhL, enL, packL, totalL: ingL + enL + packL, icLh };
}

// ---------------------------------------------------------------- whole plant
export function computeAll(p) {
  const ft = freezeTable(p), c = ft.c;
  const ht = htst(p, c), hom = homogenizer(p, c), age = ageing(p, c);
  const fz = freezer(p, c, ft, age); fz._ft = ft;
  const hard = hardening(p, c, ft, fz.Tdraw + 0.5);
  const q = quality(p, c, hom, age, fz, hard);
  // refrigeration loads (kW of cooling) and compressor power
  const OR = p.overrun / 100, mIC = fz.m;                                        // product mass flow = mix mass flow
  const Qhard = mIC * (ft.Hof(fz.Tdraw + 0.5) - hard.Hout) + 8 + 2;               // + room fans 8 kW, conveyor/doors 2 kW (Typical)
  const Qstore = PLANT.storeUA * (PLANT.Tamb - p.Tstore) + PLANT.storeFix;
  const Qwater = ht.Qcool * PLANT.Qmix / PLANT.Qpast + 3;                         // ice water averaged: HTST runs Qmix/Qpast of the time; + ageing tanks
  const loads = [
    { id: "freezer", name: "Freezer barrel", Q: fz.Qref, Te: fz.Tevap },
    { id: "hardening", name: "Hardening tunnel", Q: Qhard, Te: p.Thard - 8 },
    { id: "store", name: "Cold store", Q: Qstore, Te: p.Tstore - 8 },
    { id: "water", name: "Ice water (HTST cooler, ageing), averaged", Q: Qwater, Te: -2 },
  ];
  for (const L of loads) { L.cyc = nh3Cycle(L.Te); L.W = L.Q / L.cyc.COP; }
  const Wcomp = loads.reduce((a, L) => a + L.W, 0), Qtot = loads.reduce((a, L) => a + L.Q, 0);
  const Qcond = Qtot + Wcomp;
  const energy = { Wcomp, Qtot, Qcond, COP: Qtot / Wcomp, dasher: fz.Pdash, homog: hom.motor, heat: ht.Qheat,
    total: Wcomp + fz.Pdash + hom.motor * PLANT.Qmix / PLANT.Qpast + 12 };       // homogeniser share by throughput; 12 kW pumps, filler, controls (Typical)
  const eco = economics(p, c, fz, energy), std = standards(p, c);
  return { p, c, ft, ht, hom, age, fz, hard, q, loads, energy, eco, std };
}

// ---------------------------------------------------------------- product design: recipe from ingredients (mass balance)
// Ingredient compositions, % w/w (Typical US dairy ingredients; Goff & Hartel 2013, ch. 3; USDA FoodData Central)
export const INGREDIENTS = {
  cream: { name: "Cream, 40 % fat", fat: 40, msnf: 5.4, sugar: 0, role: "Milk fat: creaminess, body, and the partly coalesced fat network that holds the air", source: "Fresh cream separated from whole milk" },
  skim: { name: "Skim milk", fat: 0.1, msnf: 9.0, sugar: 0, role: "Water carrier plus milk proteins and lactose", source: "Skimmed milk from the separator" },
  nfdm: { name: "Nonfat dry milk (skim milk powder)", fat: 0.8, msnf: 96, sugar: 0, role: "Raises MSNF: proteins stabilise fat and air, lactose adds body", source: "Spray-dried skim milk" },
  sugar: { name: "Sucrose (cane or beet sugar)", fat: 0, msnf: 0, sugar: 100, role: "Sweetness and freezing-point depression: sets how soft the ice cream is at −18 °C", source: "Granulated or 67 °Brix liquid sugar" },
  stab: { name: "Stabiliser blend (guar, locust bean gum, carrageenan)", fat: 0, msnf: 0, sugar: 0, role: "Viscosity, smooth melt, slows ice recrystallisation; carrageenan prevents whey separation", source: "Plant seed gums and red seaweed extract" },
  emul: { name: "Emulsifier (mono- and diglycerides, polysorbate 80)", fat: 0, msnf: 0, sugar: 0, role: "Displaces protein from fat globules so fat partly coalesces in the freezer: drier, stiffer ice cream", source: "From vegetable oils" },
  water: { name: "Water", fat: 0, msnf: 0, sugar: 0, role: "Balance, when skim milk alone would bring too much MSNF", source: "Potable water" },
  cocoa: { name: "Cocoa, processed with alkali (Dutch)", fat: 0, msnf: 0, sugar: 0, role: "Chocolate flavour and dark colour; insoluble solids that thicken the mix. Counts as a bulky flavour in the legal standard", source: "Roasted cacao beans, pressed (10–12 % cocoa butter left) and alkalised" },
  swirl: { name: "Fudge swirl (variegate)", role: "Ribbons of fudge pumped in after the freezer; typically sugar, milk, chocolate liquor, corn syrup, nonfat dry milk, butter", source: "Cooked fudge sauce, added cold at the variegator" },
  flake: { name: "Dark chocolate flakes", role: "Crunch; coconut-oil based so they stay snappy but melt in the mouth", source: "Typically sugar, coconut oil, cocoa, soy lecithin; added at the ingredient feeder" },
  vanilla: { name: "Vanilla extract (single fold)", role: "Flavour, dosed at about 0.5 % of mix (Typical)", source: "Ethanol extract of cured vanilla beans" },
};
// Solve C (cream), S (skim), N (powder) or W (water) from: fat, MSNF and total-mass balances (CBE 250)
export function recipe(p) {
  const I = INGREDIENTS, rest = p.sugar + (p.cocoa || 0) + p.stab + p.emul;     // kg per 100 kg mix
  const solve3 = (A, b) => {   // Cramer's rule
    const det = M => M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
    const D = det(A); return [0, 1, 2].map(k => det(A.map((row, i) => row.map((v, j) => j === k ? b[i] : v))) / D);
  };
  // fat:   .40C + .001S + .008N = fat ; MSNF: .054C + .09S + .96N = msnf ; mass: C + S + N = 100 − rest
  let [C, S, N] = solve3([[.40, .001, .008], [.054, .09, .96], [1, 1, 1]], [p.fat, p.msnf, 100 - rest]);
  let W = 0, mode = "powder";
  if (N < 0) { mode = "water"; [C, S, W] = solve3([[.40, .001, 0], [.054, .09, 0], [1, 1, 1]], [p.fat, p.msnf, 100 - rest]); N = 0; }
  const ok = C >= -1e-6 && S >= -1e-6 && W >= -1e-6;
  const rows = [["cream", C], ["skim", S], ["nfdm", N], ["water", W], ["sugar", p.sugar], ["cocoa", p.cocoa || 0], ["stab", p.stab], ["emul", p.emul]].filter(r => r[1] > 1e-6);
  return { rows: rows.map(([k, m]) => ({ key: k, ...I[k], pct: m })), ok, mode };
}

// ---------------------------------------------------------------- per gallon, in everyday terms
export const GAL = 3.785;    // L
export const EVERYDAY = {    // Typical conversion factors, stated on the page
  phone: 0.015,              // kWh per smartphone full charge
  led: 0.010,                // kWh per hour for a 10 W LED bulb
  ev: 0.30,                  // kWh per mile, electric car
  gridCO2: 0.45,             // kg CO2 per kWh, Upper Midwest grid (Typical)
  gasCO2: 0.181,             // kg CO2 per kWh of natural gas burned (HHV basis ≈ 53 kg/MMBtu)
  carCO2: 0.40,              // kg CO2 per mile, average gasoline car
  boilerEff: 0.85,
  scoop: 0.1183,             // L, a 1/2-cup serving
  hvap25: 2443,              // kJ/kg water at 25 °C = (285.830 − 241.826) kJ/mol / 18.015 g/mol (NIST WebBook)
  Kf: 1.859,                 // K kg/mol = M_w / 9.6934e-3 from the ice-activity relation (Ferro Fontán & Chirife 1981)
  milkFat: 3.5, milkMSNF: 8.7, milkRho: 1.03,   // whole milk
};
export function perGallon(R) {
  const E = EVERYDAY, p = R.p, OR = p.overrun / 100, galPerH = R.eco.icLh / GAL;
  const kWhE = R.energy.total / galPerH;                                // electricity, process loads
  const mixLperGal = GAL / (1 + OR), mixKg = mixLperGal * R.c.rho / 1000;
  const kWhTh = R.ht.Qheat * (mixLperGal / (PLANT.Qpast)) * 1 / E.boilerEff;   // natural gas for the HTST heater (kWh per gallon)
  const heatOut = R.energy.Qtot / galPerH * 3600 / 1000;                 // MJ removed by refrigeration per gallon
  const co2 = kWhE * E.gridCO2 + kWhTh * E.gasCO2;
  const fatKg = mixKg * p.fat / 100, milkGal = fatKg / (GAL * E.milkRho * E.milkFat / 100);
  const serveKg = R.std.rhoIC * E.scoop;
  const ib = inclPerBase(p), xi = ib.swirl + ib.flake;                   // kg inclusions per kg frozen base
  // kcal/100 g: base by Atwater (cocoa ≈ 2.3 kcal/g, USDA); fudge swirl ≈ 3.5, dark chocolate flakes ≈ 5.2 (Typical)
  const kBase = 9 * p.fat + 4 * (p.msnf * 0.9 + p.sugar) + 2.3 * (p.cocoa || 0);
  const kcal = serveKg * 1000 * (kBase + 350 * ib.swirl + 520 * ib.flake) / (1 + xi) / 100;
  return { kWhE, kWhTh, heatOut, co2, mixKg, mixLperGal, airL: GAL - mixLperGal, airFrac: OR / (1 + OR), fatKg, milkGal,
    sugarTsp: mixKg * p.sugar / 100 * 1000 / 4.2, scoops: GAL / E.scoop, kcal, serveG: serveKg * 1000,
    phones: kWhE / E.phone, ledH: kWhE / E.led, evMi: kWhE / E.ev, carMi: co2 / E.carCO2, secPerGal: 3600 / galPerH,
    swirlG: R.std.rhoIC * GAL * 1000 * ib.swirl, flakeG: R.std.rhoIC * GAL * 1000 * ib.flake, cocoaG: mixKg * (p.cocoa || 0) * 10,
    costGal: R.eco.totalL * GAL, ingGal: R.eco.ingL * GAL, weightLb: R.std.rhoIC * GAL * 2.2046 };
}

// ---------------------------------------------------------------- problem-set setups (#ps=<course>-<k>)
// Each setup resets to DEFAULTS, loads the Classic vanilla recipe (PS_BASE: the problems were written for it, so their
// answers do not move when the twin's default flavour changes), applies `params`, then opens `go`.
export const PS_BASE = { fat: 12, msnf: 11, sugar: 15, cocoa: 0, stab: 0.30, emul: 0.15, swirl: 0, flake: 0 };
export const PS_SETUPS = {
  "250-1": { params: {}, go: "design" },
  "255-1": { params: {}, go: "freeze" },
  "310-1": { params: {}, go: "refrig" },
  "311-1": { params: {}, go: "freeze" },
  "311-2": { params: {}, go: "refrig" },
  "320-1": { params: { pkg: "pint" }, go: "hardening" },
  "320-2": { params: {}, go: "freezer" },
  "326-1": { params: {}, go: "htst" },
  "426-1": { params: {}, go: "refrig" },
  "430-1": { params: {}, go: "htst" },
  "430-2": { params: {}, go: "htst" },
  "450-1": { params: {}, go: "cost" },
  "470-1": { params: {}, go: "control" },
  "540-1": { params: {}, go: "quality" },
  "547-1": { params: {}, go: "homog" },
  "560-1": { params: {}, go: "htst" },
  "int-1": { params: {}, go: "freezer", flavour: "badger" },
  "450-2": { params: {}, go: "design" },     // design (product): starts from the Classic vanilla recipe   // integrative: chocolate recipe at the twin's default point (no PS_BASE)
};
