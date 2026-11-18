// Thermodynamic property package for the ethanol (1) / water (2) system.
//
//   VLE:        modified Raoult's law  y_i P = x_i * gamma_i * Psat_i(T)
//   Activity:   NRTL (Aspen Plus VLE-IG binary parameters, tau_ij = a_ij + b_ij / T)
//   Psat:       Antoine (mmHg, degC)
//   Enthalpy:   liquid Cp + NRTL excess enthalpy, vapour = liquid + Watson-corrected dHvap
//   Properties: liquid density, viscosity and surface tension for hydraulics/efficiency
//
// Reference state for enthalpy: pure liquids at 298.15 K. Units: SI (J, mol, K, Pa).

export const R = 8.314462618; // J/(mol K)
export const T_REF = 298.15;
export const ATM = 101325;

export const COMP = [
  {
    name: 'Ethanol', formula: 'C2H5OH', MW: 0.04607, // kg/mol
    antoine: { A: 8.20417, B: 1642.89, C: 230.300 }, // log10(P mmHg) = A - B/(T[C] + C)
    Tc: 513.9, Tb: 351.44, dHvapTb: 38560, // J/mol at normal boiling point
    CpL: 112.4, // J/(mol K)
    CpV: 65.6,
    rho: (T) => 806.4 - 0.85 * (T - 273.15), // kg/m3
    mu: null,
    sigma: (T) => (24.05 - 0.0832 * (T - 273.15)) * 1e-3, // N/m
  },
  {
    name: 'Water', formula: 'H2O', MW: 0.018015,
    antoine: { A: 8.07131, B: 1730.63, C: 233.426 },
    Tc: 647.1, Tb: 373.15, dHvapTb: 40660,
    CpL: 75.3,
    CpV: 33.6,
    rho: (T) => 1000 - 0.0178 * Math.pow(Math.abs(T - 277.15), 1.7),
    mu: null,
    sigma: (T) => (75.83 - 0.1477 * (T - 273.15)) * 1e-3,
  },
];

// Liquid viscosity, Pa s.  Andrade fits: ethanol 1.07 cP @25C, 0.44 cP @80C; water 0.89 cP @25C, 0.355 cP @80C
COMP[0].mu = (T) => 1e-3 * Math.exp(-5.641 + 1702.0 / T);
COMP[1].mu = (T) => 1e-3 * Math.exp(-6.023 + 1761.0 / T);

// NRTL binary parameters (1 = ethanol, 2 = water)
export const NRTL = { a12: -0.8009, a21: 3.4578, b12: 246.18, b21: -586.0809, alpha: 0.3 };

export function psat(i, T) {
  const { A, B, C } = COMP[i].antoine;
  return Math.pow(10, A - B / (T - 273.15 + C)) * 133.322368; // Pa
}

export function dlnPsat_dT(i, T) {
  const { B, C } = COMP[i].antoine;
  const tc = T - 273.15 + C;
  return Math.LN10 * B / (tc * tc);
}

// Activity coefficients [g1, g2] for liquid mole fraction x1 of ethanol at T (K)
export function gammas(x1, T) {
  const x2 = 1 - x1;
  const { a12, a21, b12, b21, alpha } = NRTL;
  const t12 = a12 + b12 / T;
  const t21 = a21 + b21 / T;
  const G12 = Math.exp(-alpha * t12);
  const G21 = Math.exp(-alpha * t21);
  const d1 = x1 + x2 * G21;
  const d2 = x2 + x1 * G12;
  const lng1 = x2 * x2 * (t21 * (G21 / d1) ** 2 + t12 * G12 / (d2 * d2));
  const lng2 = x1 * x1 * (t12 * (G12 / d2) ** 2 + t21 * G21 / (d1 * d1));
  return [Math.exp(lng1), Math.exp(lng2)];
}

// Excess Gibbs energy / RT
function gE_RT(x1, T) {
  const [g1, g2] = gammas(x1, T);
  return x1 * Math.log(g1) + (1 - x1) * Math.log(g2);
}

// Excess enthalpy (J/mol) from Gibbs-Helmholtz: hE = -R T^2 d(gE/RT)/dT
export function hExcess(x1, T) {
  if (x1 <= 0 || x1 >= 1) return 0;
  const dT = 0.01;
  const d = (gE_RT(x1, T + dT) - gE_RT(x1, T - dT)) / (2 * dT);
  return -R * T * T * d;
}

// Bubble point temperature at pressure P (Pa). Returns {T, y1 (equilibrium), K}
export function bubbleT(x1, P, Tguess = 360) {
  let T = Tguess;
  for (let it = 0; it < 50; it++) {
    const [g1, g2] = gammas(x1, T);
    const p1 = x1 * g1 * psat(0, T);
    const p2 = (1 - x1) * g2 * psat(1, T);
    const f = p1 + p2 - P;
    // d/dT ignoring weak gamma(T) dependence (Newton still converges quadratically enough)
    const df = p1 * dlnPsat_dT(0, T) + p2 * dlnPsat_dT(1, T);
    const step = f / df;
    T -= Math.max(-20, Math.min(20, step));
    if (Math.abs(step) < 1e-7) break;
  }
  const [g1, g2] = gammas(x1, T);
  const p1 = x1 * g1 * psat(0, T);
  const p2 = (1 - x1) * g2 * psat(1, T);
  return { T, y1: p1 / (p1 + p2), g1, g2 };
}

// Dew point temperature for vapour composition y1 at P. Returns {T, x1}
export function dewT(y1, P, Tguess = 360) {
  let x1 = y1 * 0.5, T = Tguess;
  for (let it = 0; it < 100; it++) {
    const [g1, g2] = gammas(x1, T);
    const s = y1 * P / (g1 * psat(0, T)) + (1 - y1) * P / (g2 * psat(1, T));
    // s should equal 1;  adjust T (ln s ~ -dlnPsat/dT * dT)
    const dl = (y1 * P / (g1 * psat(0, T))) * dlnPsat_dT(0, T) + ((1 - y1) * P / (g2 * psat(1, T))) * dlnPsat_dT(1, T);
    const step = (s - 1) / dl;
    T += Math.max(-20, Math.min(20, step));
    const xn = (y1 * P / (g1 * psat(0, T))) / s;
    x1 = Math.min(1, Math.max(0, xn));
    if (Math.abs(step) < 1e-7) break;
  }
  return { T, x1 };
}

export function dHvap(i, T) {
  const c = COMP[i];
  const tr = Math.max(0, (c.Tc - T) / (c.Tc - c.Tb));
  return c.dHvapTb * Math.pow(tr, 0.38);
}

// Molar liquid enthalpy (J/mol)
export function hLiq(x1, T) {
  const cp = x1 * COMP[0].CpL + (1 - x1) * COMP[1].CpL;
  return cp * (T - T_REF) + hExcess(x1, T);
}

// Molar vapour enthalpy (J/mol), ideal gas mixture
export function hVap(y1, T) {
  return y1 * (COMP[0].CpL * (T - T_REF) + dHvap(0, T)) + (1 - y1) * (COMP[1].CpL * (T - T_REF) + dHvap(1, T));
}

export function mw(x1) { return x1 * COMP[0].MW + (1 - x1) * COMP[1].MW; }

// Liquid density (kg/m3), ideal molar-volume mixing
export function rhoL(x1, T) {
  const v = x1 * COMP[0].MW / COMP[0].rho(T) + (1 - x1) * COMP[1].MW / COMP[1].rho(T);
  return mw(x1) / v;
}

// Ideal gas vapour density (kg/m3)
export function rhoV(y1, T, P) { return P * mw(y1) / (R * T); }

// Liquid viscosity (Pa s), Grunberg-Nissan with interaction term (ethanol-water has a viscosity maximum)
export function muL(x1, T) {
  const G12 = 1.9; // fitted to reproduce the maximum near x ~ 0.2-0.3
  const x2 = 1 - x1;
  return Math.exp(x1 * Math.log(COMP[0].mu(T)) + x2 * Math.log(COMP[1].mu(T)) + x1 * x2 * G12);
}

// Liquid surface tension (N/m). Aqueous-organic mixtures are dominated by the organic at the surface;
// use a Szyszkowski-like nonlinear blend.
export function sigmaL(x1, T) {
  const sw = COMP[1].sigma(T), se = COMP[0].sigma(T);
  const f = Math.pow(1 - x1, 6);
  return se + (sw - se) * f;
}

// Relative volatility alpha_12 at x1, T
export function relVol(x1, T) {
  const [g1, g2] = gammas(x1, T);
  return (g1 * psat(0, T)) / (g2 * psat(1, T));
}

// Search for the minimum-boiling azeotrope at P
export function azeotrope(P = ATM) {
  let lo = 0.5, hi = 0.99;
  const f = (x) => { const b = bubbleT(x, P); return b.y1 - x; };
  for (let i = 0; i < 60; i++) {
    const m = 0.5 * (lo + hi);
    if (f(m) > 0) lo = m; else hi = m;
  }
  const x = 0.5 * (lo + hi);
  return { x, T: bubbleT(x, P).T };
}

// Equilibrium curve sampled for plotting (x, y*) at pressure P
export function eqCurve(P = ATM, n = 60) {
  const pts = [];
  let T = 370;
  for (let k = 0; k <= n; k++) {
    const x = k / n;
    const b = bubbleT(x, P, T);
    T = b.T;
    pts.push([x, b.y1, b.T]);
  }
  return pts;
}

// ---------------------------------------------------------------- alcoholic strength (distillery units)
// Density of ethanol-water mixtures at 20 C vs ethanol mass fraction (CRC Handbook / OIML tables), kg/m3.
// Captures the volume contraction on mixing, which an ideal-mixing estimate would miss.
const RHO20 = [
  [0.00, 998.20], [0.05, 989.38], [0.10, 981.87], [0.15, 975.17], [0.20, 968.64], [0.25, 961.68], [0.30, 953.82],
  [0.35, 945.00], [0.40, 935.18], [0.45, 924.64], [0.50, 913.84], [0.55, 902.58], [0.60, 891.10], [0.65, 879.45],
  [0.70, 867.66], [0.75, 855.63], [0.80, 843.41], [0.85, 830.94], [0.90, 818.08], [0.95, 804.50], [1.00, 789.30],
];
export function massFrac(x1) { const m1 = x1 * COMP[0].MW; return m1 / (m1 + (1 - x1) * COMP[1].MW); }
export function rho20(w) {
  const t = Math.min(1, Math.max(0, w)) / 0.05, k = Math.min(RHO20.length - 2, Math.floor(t)), f = t - k;
  return RHO20[k][1] + f * (RHO20[k + 1][1] - RHO20[k][1]);
}
// % alcohol by volume at 20 C from the ethanol mole fraction
export function abv(x1) { const w = massFrac(x1); return 100 * w * rho20(w) / 789.30; }
