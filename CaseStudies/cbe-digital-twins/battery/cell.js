// Lithium-ion cell model: single particle model (SPM) + lumped ohmic resistance + lumped thermal balance,
// with Arrhenius temperature dependence, and solvent-diffusion-limited SEI growth for aging.
// Parameter values are taken from PyBaMM's parameter sets (Sulzer et al. 2021):
//   NMC: LG M50 21700 (NMC811 / graphite-SiOx), Chen et al. 2020; Arrhenius energies for diffusion and
//        the entropic coefficients from O'Regan et al. 2022.
//   LFP: A123 26650 (LiFePO4 / graphite), Prada et al. 2013 set (graphite from Chen 2020, LFP OCP Afshar 2017,
//        LFP kinetics Kashkooli 2017).
//   Electrolyte conductivity vs temperature: Landesfeind & Gasteiger 2019 (EC:EMC 3:7) for both cells.
//   SEI: solvent-diffusion-limited growth (Ploehn et al. 2004) with PyBaMM's example SEI parameters.
// Every number not from those sets is listed in ASSUMED below and labelled in the page.

export const F = 96485.33212, Rg = 8.314462618, TREF = 298.15;

// ---------- open-circuit potentials and entropic coefficients ----------
const ocpGraphite = x => 1.9793 * Math.exp(-39.3631 * x) + 0.2482 - 0.0909 * Math.tanh(29.8538 * (x - 0.1234))
  - 0.04478 * Math.tanh(14.9159 * (x - 0.2769)) - 0.0205 * Math.tanh(30.4444 * (x - 0.6103));
const ocpNMC = y => -0.8090 * y + 4.4875 - 0.0428 * Math.tanh(18.5138 * (y - 0.5542))
  - 17.7326 * Math.tanh(15.7890 * (y - 0.3117)) + 17.5842 * Math.tanh(15.9308 * (y - 0.3120));
const ocpLFP = y => 3.4077 - 0.020269 * y + 0.5 * Math.exp(-150 * y) - 0.9 * Math.exp(-30 * (1 - y));
const dUdT_graphite = x => (-0.1112 * x + 0.02914 + 0.3561 * Math.exp(-((x - 0.08309) ** 2) / 0.004616)) / 1000;
const dUdT_NMC = y => (0.04006 * Math.exp(-((y - 0.2828) ** 2) / 0.0009855) - 0.06656 * Math.exp(-((y - 0.8032) ** 2) / 0.02179)) / 1000;

// electrolyte conductivity, S/m (Landesfeind & Gasteiger 2019, EC:EMC 3:7)
export function kappaE(ce, T) {
  const c = ce / 1000, [p1, p2, p3, p4, p5, p6] = [0.521, 228, -1.06, 0.353, -0.00359, 0.00148];
  const A = p1 * (1 + (T - p2)), B = 1 + p3 * Math.sqrt(c) + p4 * (1 + p5 * Math.exp(1000 / T)) * c;
  const C = 1 + c ** 4 * (p6 * Math.exp(1000 / T));
  return A * c * B / C / 10;
}
export const arr = (E, T) => Math.exp(E / Rg * (1 / TREF - 1 / T));

// ---------- the two cells ----------
// A = electrode area (m²); L = thickness (m); eps = active volume fraction; R = particle radius (m);
// cmax (mol/m³); D (m²/s); k0 kinetic constant ((A/m²)(m³/mol)^1.5); Ek kinetic activation energy (J/mol);
// ED diffusion activation energy (J/mol); x100 = stoichiometry at 100 % charge.
export const CELLS = {
  NMC: {
    name: "NMC811 / graphite", model: "LG M50 21700", Qnom: 5.0, Vmax: 4.2, Vmin: 2.5, ce: 1000,
    A: 0.065 * 1.58, Ls: 12e-6, epsSep: 0.47,
    n: { L: 85.2e-6, eps: 0.75, por: 0.25, R: 5.86e-6, cmax: 33133, D: 3.3e-14, k0: 6.48e-7, Ek: 35000, ED: 2092 * Rg, sigma: 215, bruggS: 0, x100: 29866 / 33133, U: ocpGraphite, dUdT: dUdT_graphite },
    p: { L: 75.6e-6, eps: 0.665, por: 0.335, R: 5.22e-6, cmax: 63104, D: 4e-15, k0: 3.42e-6, Ek: 17800, ED: 1449 * Rg, sigma: 0.18, bruggS: 0, x100: 17038 / 63104, U: ocpNMC, dUdT: dUdT_NMC },
    hA: 10 * 0.00531, // heat-transfer coefficient 10 W/m²K × cooling area (Chen 2020 set)
    radius: 0.0105, height: 0.0700,
  },
  LFP: {
    name: "LFP / graphite", model: "A123 26650", Qnom: 2.3, Vmax: 3.6, Vmin: 2.0, ce: 1200,
    A: 0.6 * 0.3, Ls: 25e-6, epsSep: 0.45,
    n: { L: 34e-6, eps: 0.58, por: 0.36, R: 5e-6, cmax: 30555, D: 3e-15, k0: 6.48e-7, Ek: 35000, ED: 0, sigma: 215, bruggS: 1.5, x100: 0.81, U: ocpGraphite, dUdT: dUdT_graphite },
    p: { L: 80e-6, eps: 0.374, por: 0.426, R: 5e-8, cmax: 22806, D: 5.9e-18, k0: 6e-7, Ek: 39570, ED: 0, sigma: 0.33795074, bruggS: 1.5, x100: 0.0038, U: ocpLFP, dUdT: () => 0 },
    hA: 10 * (2 * Math.PI * 0.013 * 0.065 + 2 * Math.PI * 0.013 ** 2), // same h, 26650 can surface
    radius: 0.013, height: 0.065,
  },
};
// Assumptions not in the parameter sets (shown in the page as assumptions)
export const ASSUMED = {
  mass: { NMC: 0.06838, LFP: 0.076 }, // kg: LG M50 measured by Chen et al. 2020; A123 26650 datasheet
  cp: 1000,                           // J/(kg K), lumped cell heat capacity (assumed)
  E_SEI: 30000,                       // J/mol, activation energy of SEI growth (illustrative)
  dodBoost: 1.0,                      // extra SEI growth from cracking, × DOD² (illustrative)
};
// SEI parameters (PyBaMM example set; Ploehn 2004 solvent-diffusion model)
export const SEI = { Vbar: 9.585e-05, cSol: 2636.0, Dsol: 2.5e-22, L0: 5e-09, ratio: 2.0 };

// ---------- derived quantities: 0 % stoichiometry from lithium conservation, capacity ----------
function bisect(f, a, b) { let fa = f(a); for (let i = 0; i < 200; i++) { const m = 0.5 * (a + b), fm = f(m); if ((fm > 0) === (fa > 0)) { a = m; fa = fm; } else b = m; } return 0.5 * (a + b); }
export function derive(ch) {
  const c = CELLS[ch];
  if (c._d) return c._d;
  const capN = F * c.n.eps * c.n.L * c.A * c.n.cmax, capP = F * c.p.eps * c.p.L * c.A * c.p.cmax; // C per unit stoichiometry
  // discharge by charge q: x = x100 - q/capN, y = y100 + q/capP; stop where OCV = Vmin
  const ocv = q => c.p.U(c.p.x100 + q / capP) - c.n.U(c.n.x100 - q / capN);
  const qmax = Math.min(c.n.x100 * capN, (1 - c.p.x100) * capP) * 0.999999;
  const q0 = bisect(q => ocv(q) - c.Vmin, 0, qmax);
  const d = { capN, capP, Q: q0 / 3600, x0: c.n.x100 - q0 / capN, y0: c.p.x100 + q0 / capP,
    aN: 3 * c.n.eps / c.n.R, aP: 3 * c.p.eps / c.p.R };
  c._d = d; return d;
}
// OCV vs state of charge (0..1) at the fresh-cell stoichiometry window
export function ocvAt(ch, soc) {
  const c = CELLS[ch], d = derive(ch);
  const x = d.x0 + soc * (c.n.x100 - d.x0), y = d.y0 + soc * (c.p.x100 - d.y0);
  return c.p.U(y) - c.n.U(x);
}

// ohmic resistance (Ω): electrolyte through separator + 1/3 of each electrode, plus 1/3 of each solid matrix
export function rOhm(ch, T) {
  const c = CELLS[ch], k = kappaE(c.ce, T);
  const re = c.n.L / (3 * k * c.n.por ** 1.5) + c.Ls / (k * c.epsSep ** 1.5) + c.p.L / (3 * k * c.p.por ** 1.5);
  const rs = c.n.L / (3 * c.n.sigma * c.n.eps ** c.n.bruggS) + c.p.L / (3 * c.p.sigma * c.p.eps ** c.p.bruggS);
  return (re + rs) / c.A;
}

// ---------- spherical diffusion, finite volumes, backward Euler (tridiagonal solve) ----------
const NSH = 20;
function makeGrid(R) {
  const r = Array.from({ length: NSH + 1 }, (_, i) => R * i / NSH);
  const V = [], Af = [];
  for (let i = 0; i < NSH; i++) V.push((r[i + 1] ** 3 - r[i] ** 3) / 3);         // per steradian
  for (let i = 0; i <= NSH; i++) Af.push(r[i] ** 2);
  return { r, V, Af, dr: R / NSH };
}
function stepParticle(c, g, D, jOut, dt) {
  // (c_i^{n+1} - c_i^n) V_i / dt = D A_{i+1}(c_{i+1}-c_i)/dr - D A_i (c_i - c_{i-1})/dr ;  outer face flux -jOut·A_N
  const n = NSH, a = new Float64Array(n), b = new Float64Array(n), cc = new Float64Array(n), d = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const wL = i > 0 ? D * g.Af[i] / g.dr : 0, wR = i < n - 1 ? D * g.Af[i + 1] / g.dr : 0;
    a[i] = -wL * dt / g.V[i]; cc[i] = -wR * dt / g.V[i]; b[i] = 1 + (wL + wR) * dt / g.V[i];
    d[i] = c[i] - (i === n - 1 ? jOut * g.Af[n] * dt / g.V[i] : 0);
  }
  for (let i = 1; i < n; i++) { const m = a[i] / b[i - 1]; b[i] -= m * cc[i - 1]; d[i] -= m * d[i - 1]; }
  const out = new Float64Array(n); out[n - 1] = d[n - 1] / b[n - 1];
  for (let i = n - 2; i >= 0; i--) out[i] = (d[i] - cc[i] * out[i + 1]) / b[i];
  return out;
}
const surf = (c, g, D, jOut) => c[NSH - 1] - jOut * (g.dr / 2) / D;   // linear extrapolation to the surface

// exchange-current density (A/m²), Chen/Prada form with Arrhenius
export const i0 = (e, ce, cs, T) => e.k0 * arr(e.Ek, T) * Math.sqrt(ce * Math.max(cs, 1e-9) * Math.max(e.cmax - cs, 1e-9));

// ---------- one state of the cell ----------
export function newCell(ch, soc = 1, capFrac = 1) {
  const c = CELLS[ch], d = derive(ch);
  // aging: lithium lost to the SEI leaves the graphite less full at the top of charge (capFrac = remaining capacity)
  const x = d.x0 + soc * (c.n.x100 - d.x0) * capFrac, y = c.p.x100 + (1 - soc) * (d.y0 - c.p.x100) * capFrac;
  return { ch, gn: makeGrid(c.n.R), gp: makeGrid(c.p.R), cn: new Float64Array(NSH).fill(x * c.n.cmax), cp: new Float64Array(NSH).fill(y * c.p.cmax), T: null };
}

// one implicit step of length dt (s) at current I (A, + discharge). Returns the voltage and heat terms.
export function step(st, I, dt, Tamb, P) {
  const c = CELLS[st.ch], d = derive(st.ch);
  const T = st.T;
  const Dn = c.n.D * arr(c.n.ED, T), Dp = c.p.D * arr(c.p.ED, T);
  const jn = I / (F * d.aN * c.n.L * c.A), jp = -I / (F * d.aP * c.p.L * c.A);   // mol/(m² s) out of particle
  st.cn = stepParticle(st.cn, st.gn, Dn, jn, dt);
  st.cp = stepParticle(st.cp, st.gp, Dp, jp, dt);
  const csn = surf(st.cn, st.gn, Dn, jn), csp = surf(st.cp, st.gp, Dp, jp);
  const xs = csn / c.n.cmax, ys = csp / c.p.cmax;
  const i0n = i0(c.n, c.ce, csn, T), i0p = i0(c.p, c.ce, csp, T);
  const etaN = 2 * Rg * T / F * Math.asinh(F * jn / (2 * i0n)), etaP = 2 * Rg * T / F * Math.asinh(F * jp / (2 * i0p));
  const R = rOhm(st.ch, T);
  const Uocv = c.p.U(ys) - c.n.U(xs);
  const V = Uocv + etaP - etaN - I * R;
  const dUdT = c.p.dUdT(ys) - c.n.dUdT(xs);
  const Qirr = I * (Uocv - V), Qrev = -I * T * dUdT;
  const Cth = P.mass * P.cp;
  st.T = T + dt * (Qirr + Qrev - c.hA * (T - Tamb)) / Cth;   // explicit for the lumped temperature
  // bulk (average) stoichiometry -> state of charge
  let sn = 0, vn = 0; for (let i = 0; i < NSH; i++) { sn += st.cn[i] * st.gn.V[i]; vn += st.gn.V[i]; }
  const xbar = sn / vn / c.n.cmax;
  const soc = (xbar - d.x0) / (c.n.x100 - d.x0);
  return { V, Uocv, etaN, etaP, R, Qirr, Qrev, xs, ys, soc, xbar, phiN: c.n.U(xs) + etaN };
}

// ---------- a full cycle: discharge by DOD, short rest, charge back ----------
// opts: { ch, C, TambC, dod (0..1), capFrac, dt, mass, cp }
export function cycle(opts) {
  const { ch, C, TambC, dod, capFrac = 1, dt = 2 } = opts;
  const c = CELLS[ch], d = derive(ch);
  const P = { mass: opts.mass ?? ASSUMED.mass[ch], cp: opts.cp ?? ASSUMED.cp };
  const Tamb = TambC + 273.15;
  const Q = d.Q * capFrac, I = C * d.Q;          // C-rate relative to the fresh cell's capacity
  const st = newCell(ch, 1, capFrac); st.T = Tamb;
  const trace = [], prof = [];
  const snap = (t, r) => { if (opts.profiles && (!prof.length || t - prof[prof.length - 1].t >= 30)) prof.push({ t, n: Array.from(st.cn, v => v / c.n.cmax), p: Array.from(st.cp, v => v / c.p.cmax), xs: r.xs, ys: r.ys }); };
  let t = 0, Eout = 0, Ein = 0, qOut = 0, qIn = 0, Qheat = 0, Tmax = Tamb, phase = "discharge", stopReason = "";
  const target = dod * Q * 3600;
  // discharge
  while (qOut < target) {
    const h = Math.min(dt, (target - qOut) / I);
    const r = step(st, I, h, Tamb, P); t += h; qOut += I * h; Eout += r.V * I * h; Qheat += (r.Qirr + r.Qrev) * h;
    Tmax = Math.max(Tmax, st.T);
    trace.push([t, r.V, r.soc, st.T - 273.15, r.Qirr + r.Qrev, I, r.xs, r.ys, r.Uocv, r.etaN, r.etaP, r.R]); snap(t, r);
    if (r.V <= c.Vmin) { stopReason = "hit the low-voltage limit"; break; }
  }
  const dodReached = qOut / (Q * 3600);
  // rest 10 min
  for (let k = 0; k < 300 / dt; k++) { const r = step(st, 0, dt, Tamb, P); t += dt; trace.push([t, r.V, r.soc, st.T - 273.15, r.Qirr + r.Qrev, 0, r.xs, r.ys, r.Uocv, r.etaN, r.etaP, r.R]); snap(t, r); }
  const tChargeStart = t;
  // charge back: constant current (CC) until the upper voltage limit, then constant voltage (CV)
  // until the current falls to C/20 or the charge taken out is back in
  phase = "charge"; let hitV = false, tCV = 0;
  const clone = s => ({ ...s, cn: s.cn.slice(), cp: s.cp.slice() });
  const Icut = d.Q / 20;
  let Ic = I, phiNmin = Infinity;
  while (qIn < qOut - 1e-9) {
    let h = Math.min(dt, (qOut - qIn) / Ic);
    if (hitV) {
      // CV: secant search for the charging current that holds V = Vmax over this step
      const vOf = Ich => step(clone(st), -Ich, h, Tamb, P).V - c.Vmax;
      let a = Ic, b = Ic * 0.9, fa = vOf(a), fb = vOf(b);
      for (let k = 0; k < 40 && Math.abs(fb) > 1e-9 && fb !== fa; k++) { const n = b - fb * (b - a) / (fb - fa); a = b; fa = fb; b = Math.min(Math.max(n, 1e-6), I); fb = vOf(b); }
      Ic = b; if (Ic < Icut) break;
      h = Math.min(dt, (qOut - qIn) / Ic); tCV += h;
    }
    const r = step(st, -Ic, h, Tamb, P); t += h; phiNmin = Math.min(phiNmin, r.phiN); qIn += Ic * h; Ein += r.V * Ic * h; Qheat += (r.Qirr + r.Qrev) * h;
    Tmax = Math.max(Tmax, st.T);
    trace.push([t, r.V, r.soc, st.T - 273.15, r.Qirr + r.Qrev, -Ic, r.xs, r.ys, r.Uocv, r.etaN, r.etaP, r.R]); snap(t, r);
    if (!hitV && r.V >= c.Vmax) hitV = true;
  }
  // time-averaged temperature over the cycle (drives aging)
  let Tavg = 0; for (let k = 1; k < trace.length; k++) Tavg += (trace[k][3] + trace[k - 1][3]) / 2 * (trace[k][0] - trace[k - 1][0]);
  Tavg = Tavg / (trace[trace.length - 1][0] - trace[0][0]);
  return {
    trace, prof, I, Q, Eout, Ein, eff: Eout / Ein * (qIn / qOut), Qheat, Tmax: Tmax - 273.15, Tavg,
    dodReached, chargeFrac: qIn / qOut, hitV, tCV, phiNmin, stopReason, tCycle: t, tCharge: t - tChargeStart,
  };
}

// ---------- aging: SEI growth on the graphite (solvent-diffusion limited) ----------
// L² = L0² + 2 Vbar cSol D(T) (1 + boost·DOD²) t ;  lithium lost = ratio × (L − L0)/Vbar per m² of graphite surface
export function seiLoss(ch, tSeconds, TC, dod) {
  const c = CELLS[ch], d = derive(ch);
  const T = TC + 273.15;
  const Deff = SEI.Dsol * arr(ASSUMED.E_SEI, T) * (1 + ASSUMED.dodBoost * dod * dod);
  const L = Math.sqrt(SEI.L0 ** 2 + 2 * SEI.Vbar * SEI.cSol * Deff * tSeconds);
  const area = d.aN * c.n.L * c.A;                               // graphite surface area, m²
  const molLi = SEI.ratio * (L - SEI.L0) / SEI.Vbar * area;
  const capLost = molLi * F / 3600;                              // Ah
  return { L, capLost, frac: Math.min(capLost / d.Q, 0.95) };
}
// capacity after N cycles at the given conditions (each cycle takes tCycle; a day holds at most 1 cycle)
// Use pattern (assumed): one cycle per day; the cell spends the cycle at its cycle-average temperature and the
// rest of the day resting at ambient. Time at each temperature is converted to equivalent time at 25 °C.
export function aging(ch, N, cyc, dod, TambC) {
  const tc = Math.min(cyc.tCycle, 86400);
  const tEq = N * (tc * arr(ASSUMED.E_SEI, cyc.Tavg + 273.15) + (86400 - tc) * arr(ASSUMED.E_SEI, TambC + 273.15));
  return { ...seiLoss(ch, tEq, 25, dod), years: N / 365 };
}
