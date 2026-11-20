// Lake-ice growth model for the Lake Mendota Ice Fishing Digital Twin.
//
// Three models of the same physics, so they can be compared on screen:
//  1. Stefan's law (quasi-steady, no surface resistance):         h = sqrt(2 k S / (rho L))
//  2. Quasi-steady with series resistances (air film + snow), the closed form used by Ashton (1989):
//                                                                 h^2/(2k) + R h = S/(rho L)
//  3. Transient 1-D conduction in the ice with a moving freezing front (Stefan problem), solved by
//     finite differences on a front-fixed (Landau) grid, with an air-film + snow resistance at the top.
// S = accumulated freezing degree-time, integral of (T_f - T_air) dt [°C·s].
//
// Units: SI throughout (m, s, W, J, °C). Depth z points down from the ice surface.

export const PROPS = {
  rhoI: 916.2,   // ice density at 0 °C, kg/m3            (Engineering ToolBox, Ice - Thermal Properties)
  kI: 2.22,      // ice thermal conductivity at 0 °C, W/m/K (same)
  cpI: 2050,     // ice specific heat at 0 °C, J/kg/K      (same)
  L: 334e3,      // latent heat of fusion, J/kg            (Engineering ToolBox, Latent Heat of Melting)
  Tf: 0,         // freezing point of fresh water, °C
};
export const DEFAULTS = {
  wind: 4,         // m/s, assumed typical winter wind over the lake
  kSnow: 0.20,     // W/m/K, assumed; inside the measured range for seasonal snow (Sturm et al. 1997)
  snowFrac: 0.1,   // fraction of the airport snow depth lying on the lake ice; fitted to two measured Mendota thicknesses (see validate.mjs)
  qw: 0,           // W/m2, heat from the lake water to the ice bottom, assumed 0 by default
  N: 24,           // grid nodes across the ice
};

// Air-film heat-transfer coefficient, W/m2/K: McAdams' form of the Jürges correlation (V in m/s).
export const hAir = V => 5.7 + 3.8 * V;

// Surface resistance R [m2·K/W] = air film + snow layer in series.
export const surfaceR = (wind, snow, kSnow) => 1 / hAir(wind) + snow / kSnow;

// (1) Stefan's law
export function stefanH(S, P = PROPS) { return S > 0 ? Math.sqrt(2 * P.kI * S / (P.rhoI * P.L)) : 0; }
// (2) Quasi-steady with constant surface resistance R
export function quasiSteadyH(S, R, P = PROPS) {
  if (S <= 0) return 0;
  const a = P.kI * R;
  return -a + Math.sqrt(a * a + 2 * P.kI * S / (P.rhoI * P.L));
}

// Neumann's exact similarity solution for constant surface temperature Ts < Tf (one-phase Stefan problem,
// water at the freezing point): h = 2 lambda sqrt(alpha t), lambda e^{lambda^2} erf(lambda) = Ste/sqrt(pi).
export function erf(x) {   // Abramowitz & Stegun 7.1.26 is too coarse for validation; use a series/continued fraction
  const s = Math.sign(x); x = Math.abs(x);
  if (x < 3) {
    let sum = x, term = x, n = 0;
    while (Math.abs(term) > 1e-17 * Math.abs(sum)) { n++; term *= -x * x / n; sum += term / (2 * n + 1); }
    return s * 2 / Math.sqrt(Math.PI) * sum;
  }
  // continued fraction for erfc at large x
  let f = 0; for (let k = 60; k >= 1; k--) f = k / 2 / (x + f);
  return s * (1 - Math.exp(-x * x) / Math.sqrt(Math.PI) / (x + f));
}
export function neumannLambda(Ste) {
  let lo = 1e-9, hi = 3;
  const g = l => l * Math.exp(l * l) * erf(l) - Ste / Math.sqrt(Math.PI);
  for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (g(m) > 0) hi = m; else lo = m; }
  return (lo + hi) / 2;
}
export function neumannH(Ts, t, P = PROPS) {
  const Ste = P.cpI * (P.Tf - Ts) / P.L, alpha = P.kI / (P.rhoI * P.cpI);
  return 2 * neumannLambda(Ste) * Math.sqrt(alpha * t);
}

// (3) Transient moving-boundary model
export class IceSim {
  constructor(opts = {}) {
    Object.assign(this, DEFAULTS, opts);
    this.P = opts.P || PROPS;
    this.reset(opts.h0 ?? 0.002);
  }
  reset(h0 = 0.002) {
    const N = this.N;
    this.h = h0;               // ice thickness, m
    this.T = new Float64Array(N + 1);   // node temperatures, xi = j/N, T[N] = Tf at the ice-water interface
    this.T.fill(this.P.Tf);
    this.dhdt = 0;
    this.t = 0;
    this.melted = 0;           // m melted at the top so far
    this.qTop = 0;             // heat flux leaving the ice top to the air, W/m2
    this.qBot = 0;             // heat conducted up from the freezing front, W/m2
    this.Tsurf = this.P.Tf;
    this.open = h0 <= 0;
  }
  // Advance dt seconds with air temperature Ta [°C], snow depth on the ice snow [m], wind [m/s].
  // Bottom: Stefan condition rho L dh/dt = k dT/dz|_h - qw. Top: Robin, -k dT/dz|_0 = U (Ta - T0) with
  // U = 1/R; when that would warm the surface above Tf, the surface is held at Tf and the excess melts ice.
  step(dt, Ta, snow = 0, wind = this.wind) {
    const { N, P } = this;
    if (this.open) {   // open water: refreeze only if forced by the caller (h set again)
      this.t += dt; return;
    }
    const k = P.kI, alpha = k / (P.rhoI * P.cpI), dxi = 1 / N;
    const U = 1 / surfaceR(wind, snow, this.kSnow);
    let h = this.h;
    const v = this.dhdt;                 // front speed, lagged one step
    const a = new Float64Array(N + 1), b = new Float64Array(N + 1), c = new Float64Array(N + 1), d = new Float64Array(N + 1);
    const D = alpha * dt / (h * h * dxi * dxi);
    const build = (topDirichlet) => {
      // interior: dT/dt = alpha/h^2 T_xixi + xi (h'/h) T_xi, implicit in T (Landau front-fixing transform)
      for (let j = 1; j < N; j++) {
        const A = j * dxi * v * dt / (2 * h * dxi);
        a[j] = -D + A; b[j] = 1 + 2 * D; c[j] = -D - A; d[j] = this.T[j];
      }
      a[N] = 0; b[N] = 1; c[N] = 0; d[N] = P.Tf;               // ice-water interface at the freezing point
      if (topDirichlet) { b[0] = 1; c[0] = 0; d[0] = P.Tf; }
      else {   // Robin top, ghost node T_{-1} = T_1 - B (T_0 - Ta), B = 2 h dxi U / k
        const B = 2 * h * dxi * U / k;
        b[0] = 1 + 2 * D + D * B; c[0] = -2 * D; d[0] = this.T[0] + D * B * Ta;
      }
    };
    build(false);
    let T = thomas(a, b, c, d, N + 1);
    let topMelt = 0;
    if (T[0] > P.Tf) {   // surface reaches the melting point: hold it at Tf, melt with the excess heat
      build(true);
      T = thomas(a, b, c, d, N + 1);
      const qIn = U * (Ta - P.Tf);                               // from air (through snow) to the surface
      const qCond = k * (T[0] - T[1]) / (h * dxi);               // conducted down into the ice (>= 0 when ice below is colder)
      topMelt = Math.max(0, qIn - qCond) / (P.rhoI * P.L);       // m/s
    }
    this.T.set(T);
    // bottom: second-order one-sided gradient
    const dTdz = (3 * T[N] - 4 * T[N - 1] + T[N - 2]) / (2 * h * dxi);
    this.qBot = k * dTdz;
    const growth = (this.qBot - this.qw) / (P.rhoI * P.L);       // m/s at the bottom
    this.dhdt = growth - topMelt;
    this.Tsurf = T[0];
    this.qTop = topMelt > 0 ? 0 : U * (T[0] - Ta);
    h = h + this.dhdt * dt;
    this.melted += topMelt * dt;
    this.t += dt;
    if (h <= 0.002) { this.h = 0; this.open = true; return; }
    this.h = h;
  }
}

function thomas(a, b, c, d, n) {
  const cp = new Float64Array(n), dp = new Float64Array(n), x = new Float64Array(n);
  cp[0] = c[0] / b[0]; dp[0] = d[0] / b[0];
  for (let i = 1; i < n; i++) {
    const m = b[i] - a[i] * cp[i - 1];
    cp[i] = c[i] / m; dp[i] = (d[i] - a[i] * dp[i - 1]) / m;
  }
  x[n - 1] = dp[n - 1];
  for (let i = n - 2; i >= 0; i--) x[i] = dp[i] - cp[i] * x[i + 1];
  return x;
}

// Run a whole winter from daily data. days: array of {T (°C), snow (cm, airport)}; iceOn: index of the
// freeze-up day. Returns daily arrays of the three models.
export function runWinter(days, iceOn, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const sim = new IceSim(o);
  const out = { h: [], hStefan: [], hQS: [], S: [], snow: [], Tsurf: [], prof: [], qBot: [], open: null, iceOn };
  let S = 0, qsH = 0, hS = 0;
  const sub = 24, dt = 86400 / sub;
  for (let i = 0; i < days.length; i++) {
    const Ta = days[i].T, snow = (days[i].snow || 0) / 100 * o.snowFrac;
    if (i < iceOn) { out.h.push(null); out.hStefan.push(null); out.hQS.push(null); out.S.push(0); out.snow.push(snow); out.Tsurf.push(null); out.prof.push(null); out.qBot.push(0); continue; }
    for (let k = 0; k < sub; k++) sim.step(dt, Ta, snow, o.wind);
    // analytic comparisons: integrate freezing degree-time (melting days reduce S, floored at 0)
    S = Math.max(0, S + (PROPS.Tf - Ta) * 86400);
    hS = stefanH(S);
    // quasi-steady with today's resistance: integrate dh/dt = dT/(rho L (h/k + R)) exactly over the day
    const R = surfaceR(o.wind, snow, o.kSnow);
    if (Ta < PROPS.Tf) {
      const c0 = qsH * qsH / (2 * PROPS.kI) + R * qsH + (PROPS.Tf - Ta) * 86400 / (PROPS.rhoI * PROPS.L);
      qsH = -PROPS.kI * R + Math.sqrt((PROPS.kI * R) ** 2 + 2 * PROPS.kI * c0);
    } else {
      qsH = Math.max(0, qsH - Math.max(0, Ta - PROPS.Tf) / R * 86400 / (PROPS.rhoI * PROPS.L));
    }
    out.h.push(sim.h); out.hStefan.push(hS); out.hQS.push(qsH); out.S.push(S); out.snow.push(snow); out.Tsurf.push(sim.open ? null : sim.Tsurf);
    out.prof.push(sim.open || o.keepProf === false ? null : Float32Array.from(sim.T)); out.qBot.push(sim.open ? 0 : sim.qBot);
    if (sim.open && out.open === null) out.open = i;
  }
  return out;
}

// Freeze-up rule used for warming scenarios (assumed): the lake freezes once it has accumulated the same
// freezing degree-days since Nov 1, sum of max(0, Tf - T), as it had by the observed ice-on day (index on0).
export function freezeUpIndex(T, on0, dT) {
  let F = 0; for (let i = 0; i < on0; i++) F += Math.max(0, PROPS.Tf - T[i]);
  let G = 0;
  for (let i = 0; i < T.length; i++) { G += Math.max(0, PROPS.Tf - (T[i] + dT)); if (G >= F) return i; }
  return null;
}
// Ice-safety guide (Minnesota DNR, general ice thickness guidelines, new clear ice only), inches.
export const SAFETY = [
  { inch: 0, label: "Stay off", short: "Stay off" },
  { inch: 4, label: "Ice fishing or other activities on foot", short: "Walk & fish" },
  { inch: 5, label: "Snowmobile or small ATV", short: "Snowmobile" },
  { inch: 7, label: "Side-by-side ATV", short: "Side-by-side" },
  { inch: 9, label: "Small car or SUV", short: "Small car" },
  { inch: 11, label: "Medium SUV or small truck", short: "Small truck" },
  { inch: 13, label: "Medium truck", short: "Medium truck" },
  { inch: 16, label: "Heavy-duty truck", short: "Heavy truck" },
  { inch: 20, label: "Heavy-duty truck with wheelhouse shelter", short: "Truck + shelter" },
];
export const IN = 0.0254;
export function safetyLevel(h) { let k = 0; SAFETY.forEach((s, i) => { if (h >= s.inch * IN - 1e-9) k = i; }); return k; }
// First day index with thickness >= x metres (or null)
export function firstDayAtLeast(h, x) { for (let i = 0; i < h.length; i++) if (h[i] !== null && h[i] >= x) return i; return null; }

// ---------------- Night-time surface energy balance with longwave radiation (eqs. 14-17) ----------------
// A separate calculator: the season model above is unchanged. Skin ice on calm, already-cold surface water.
export const RAD = { sigma: 5.670374419e-8,   // Stefan-Boltzmann constant, W/(m2 K4) (CODATA 2018, NIST)
  epsS: 0.96 };                                // emissivity of water / ice surface (Engineering ToolBox: water 0.95-0.963, smooth ice 0.966)
const K0 = 273.15;
export const satVP = T => 6.112 * Math.exp(17.67 * T / (T + 243.5));                       // hPa, T in °C (Bolton 1980)
export const epsClear = (Ta, RH) => 1.24 * Math.pow((RH / 100) * satVP(Ta) / (Ta + K0), 1 / 7);   // clear sky (Brutsaert 1975), e_a in hPa, T in K
export const epsSky = (Ta, RH, cloud) => cloud + (1 - cloud) * epsClear(Ta, RH);           // cloud fraction 0-1 (Crawford & Duchon 1999 form)
// Net heat leaving a surface held at Ts (°C): longwave out minus longwave absorbed from the sky minus convective gain from the air
export function netLoss(Ts, { Ta, RH, cloud, wind }) {
  const e = epsSky(Ta, RH, cloud), qRad = RAD.epsS * RAD.sigma * ((Ts + K0) ** 4 - e * (Ta + K0) ** 4), qConv = hAir(wind) * (Ta - Ts);
  return { qRad, qConv, qNet: qRad - qConv };
}
export function nightBalance(p) {
  const e = epsSky(p.Ta, p.RH, p.cloud), Tsky = Math.pow(e, 0.25) * (p.Ta + K0) - K0;
  const at0 = netLoss(0, p);                                        // surface water at the freezing point
  const growth = Math.max(0, at0.qNet) * 12 * 3600 / (PROPS.rhoI * PROPS.L) * 1000;   // mm of skin ice in a 12-h night if nothing else supplies heat
  let T = p.Ta;                                                     // equilibrium skin temperature with no heat from below (Newton)
  for (let i = 0; i < 40; i++) { const f = netLoss(T, p).qNet, d = 4 * RAD.epsS * RAD.sigma * (T + K0) ** 3 + hAir(p.wind); T -= f / d; }
  let lo = -20, hi = 25;                                            // warmest air temperature with net loss at 0 °C still >= 0
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (netLoss(0, { ...p, Ta: m }).qNet >= 0) lo = m; else hi = m; }
  return { eClear: epsClear(p.Ta, p.RH), eSky: e, Tsky, ea: p.RH / 100 * satVP(p.Ta), ha: hAir(p.wind), ...at0, freezes: at0.qNet > 0, growth, Tskin: T, skin: netLoss(T, p), TaMax: lo };
}
export const NIGHT_DEFAULT = { Ta: 3, RH: 70, cloud: 0, wind: 1 };   // illustrative clear, light-wind night
