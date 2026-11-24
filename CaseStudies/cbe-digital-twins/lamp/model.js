// Lava Lamp Digital Twin: physical model. Pure functions, no graphics.
// A two-zone heat balance of the liquid (bottom and top), densities of wax and liquid that cross at one temperature,
// and wax blobs that rise when lighter than the liquid around them and sink when heavier.
// Units: SI inside (K differences, °C for temperatures, m, kg, s, W). Every constant is listed in PARAMS with a source tag:
// "ref:<n>" (References in content.js), "assumed" or "illustrative". See the ∑ Model panel.

export const PARAMS = {
  g: 9.81,                  // m/s2
  // geometry of the liquid column: a typical mid-size lamp (assumed)
  H: 0.25, D: 0.08,         // m
  // liquid (treated as water)
  rhoX: 990,                // kg/m3: density of both wax and liquid at the crossover temperature (water near 45 °C)
  betaL: 4.2e-4,            // 1/K volumetric expansion of water near 45 °C
  cL: 4180, kL: 0.63,       // J/(kg K), W/(m K)
  // wax
  betaW: 7.6e-4,            // 1/K volumetric expansion of molten paraffin wax
  cW: 2100,                 // J/(kg K)
  Tm: 38,                   // °C: below this the wax is too stiff to flow (assumed)
  Tx: 45,                   // °C: crossover temperature set by the maker's recipe (assumed)
  // heat
  eta: 0.60,                // share of the bulb's power that ends up in the liquid (assumed)
  h: 10,                    // W/(m2 K): air film on the glass, natural convection plus radiation (typical range)
  G: 0.90,                  // W/K: heat carried from the bottom zone to the top zone by mixing and blobs (assumed)
  split: 0.35,              // share of the liquid in the bottom zone (assumed)
  Cd: 8.0,                  // drag coefficient of a blob (assumed)
  dBlob: 0.025,             // m: typical blob diameter (assumed)
};

export function normCond(c = {}) { return { P: +(c.P ?? 25), Tr: +(c.Tr ?? 22), fan: !!c.fan, eta: +(c.eta ?? PARAMS.eta), Tx: +(c.Tx ?? PARAMS.Tx), H: +(c.H ?? PARAMS.H), bW: +(c.bW ?? PARAMS.betaW), bL: +(c.bL ?? PARAMS.betaL), Cd: +(c.Cd ?? PARAMS.Cd) }; }
export function geom(H = PARAMS.H) { const D = PARAMS.D, side = Math.PI * D * H, V = Math.PI * D * D / 4 * H, m = PARAMS.rhoX * V, s = PARAMS.split;
  return { side, V, m, Ab: s * side, At: (1 - s) * side + Math.PI * D * D / 4, Cb: s * m * PARAMS.cL, Ct: (1 - s) * m * PARAMS.cL }; }
export const hAir = c => PARAMS.h * (c.fan ? 2 : 1);     // a fan or draught roughly doubles the air-film coefficient (illustrative)

// ---------- heat balance ----------
// Cb dTb/dt = eta P - G (Tb - Tt) - h Ab (Tb - Tr);   Ct dTt/dt = G (Tb - Tt) - h At (Tt - Tr)
export function dT(Tb, Tt, cond) { const c = normCond(cond), g = geom(c.H), h = hAir(c), G = PARAMS.G;
  return [(c.eta * c.P - G * (Tb - Tt) - h * g.Ab * (Tb - c.Tr)) / g.Cb, (G * (Tb - Tt) - h * g.At * (Tt - c.Tr)) / g.Ct]; }
export function stepT(s, cond, dt) { // classical Runge-Kutta, sub-steps of at most 20 s
  const n = Math.max(1, Math.ceil(dt / 20)), hh = dt / n; let { Tb, Tt } = s;
  for (let i = 0; i < n; i++) { const k1 = dT(Tb, Tt, cond), k2 = dT(Tb + hh / 2 * k1[0], Tt + hh / 2 * k1[1], cond), k3 = dT(Tb + hh / 2 * k2[0], Tt + hh / 2 * k2[1], cond), k4 = dT(Tb + hh * k3[0], Tt + hh * k3[1], cond);
    Tb += hh / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]); Tt += hh / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]); }
  return { Tb, Tt }; }
// steady temperatures (closed form)
export function steady(cond) { const c = normCond(cond), g = geom(c.H), h = hAir(c), G = PARAMS.G, dTb = c.eta * c.P / (h * g.Ab + G * h * g.At / (G + h * g.At));
  return { Tb: c.Tr + dTb, Tt: c.Tr + dTb * G / (G + h * g.At) }; }
export function heatOut(Tb, Tt, cond) { const c = normCond(cond), g = geom(c.H), h = hAir(c); return h * g.Ab * (Tb - c.Tr) + h * g.At * (Tt - c.Tr); }

// ---------- densities ----------
export function rhoL(T) { return PARAMS.rhoX * (1 - PARAMS.betaL * (T - PARAMS.Tx)); }
export function rhoLx(T, Tx, bL = PARAMS.betaL) { return PARAMS.rhoX * (1 - bL * (T - Tx)); }
export function rhoWx(T, Tx, bW = PARAMS.betaW) { return PARAMS.rhoX * (1 - bW * (T - Tx)); }
export const liqT = (z, Tb, Tt, H) => Tb + (Tt - Tb) * Math.min(1, Math.max(0, z / H));
// buoyancy of a wax blob at temperature T sitting in liquid at Tl: positive means it rises
export function dRho(T, Tl, Tx, bW = PARAMS.betaW, bL = PARAMS.betaL) { return rhoLx(Tl, Tx, bL) - rhoWx(T, Tx, bW); }

// ---------- regimes ----------
// cold: the bottom never gets warm enough for wax to melt and become lighter than the liquid
// flowing: warm enough at the bottom to rise, cool enough at the top to sink
// overheated: even the top is warmer than the crossover, so the wax stays up
export function regime(Tb, Tt, cond) { const c = normCond(cond), need = Math.max(c.Tx, PARAMS.Tm); if (c.bW <= c.bL) return "cold";   // wax that expands no more than the liquid never becomes the lighter one on heating
  if (Tb <= need) return "cold"; if (Tt >= c.Tx) return "overheated"; return "flowing"; }
export function regimeSteady(cond) { const s = steady(cond); return regime(s.Tb, s.Tt, cond); }

// ---------- one blob ----------
// state: { z (m, 0 = resting on the wax pool, H = top), T (°C) }
export function blobTau(d = PARAMS.dBlob) { return PARAMS.rhoX * PARAMS.cW * d * d / (12 * PARAMS.kL); }      // s: lumped sphere, conduction limit (Nu = 2)
export function blobSpeed(drho, d = PARAMS.dBlob, Cd = PARAMS.Cd) { return Math.sign(drho) * Math.sqrt(4 * PARAMS.g * d * Math.abs(drho) / (3 * Cd * PARAMS.rhoX)); }   // m/s, quadratic drag
export function stepBlob(b, Tb, Tt, cond, dt, d = PARAMS.dBlob) { const c = normCond(cond), tau = blobTau(d), n = Math.max(1, Math.ceil(dt / 0.25)), hh = dt / n; let { z, T } = b;
  for (let i = 0; i < n; i++) { const Tl = liqT(z, Tb, Tt, c.H), atBottom = z <= 0, atTop = z >= c.H;
    T += (atBottom ? 2 : 1) * (Tl - T) / tau * hh;                                   // in the pool the blob touches the hot base: heats twice as fast (assumed)
    let v = T > PARAMS.Tm ? blobSpeed(dRho(T, Tl, c.Tx, c.bW, c.bL), d, c.Cd) : (z > 0 ? -0.01 : 0);     // stiff wax just settles
    if (atBottom && v < 0) v = 0; if (atTop && v > 0) v = 0;
    z = Math.min(c.H, Math.max(0, z + v * hh)); }
  return { z, T }; }
// period of one blob's round trip at fixed zone temperatures (s); null if it does not circulate
export function cyclePeriod(cond, Tb, Tt, d = PARAMS.dBlob) { const c = normCond(cond), s = Tb == null ? steady(c) : { Tb, Tt }; if (regime(s.Tb, s.Tt, c) !== "flowing") return null;
  let b = { z: 0, T: s.Tt }, t = 0, wasDown = true; const leaves = [];
  while (t < 6000 && leaves.length < 4) { b = stepBlob(b, s.Tb, s.Tt, c, 1, d); t += 1; if (wasDown && b.z > 0.02 * c.H) { leaves.push(t); wasDown = false; } if (b.z <= 0) wasDown = true; }
  return leaves.length >= 3 ? leaves[leaves.length - 1] - leaves[leaves.length - 2] : null; }
// time for a blob to rise from the pool to the top (s), at steady temperatures
export function riseTime(cond, d = PARAMS.dBlob) { const c = normCond(cond), s = steady(c); if (regime(s.Tb, s.Tt, c) !== "flowing") return null; let b = { z: 0, T: s.Tb }, t = 0; while (b.z < c.H && t < 3000) { b = stepBlob(b, s.Tb, s.Tt, c, 0.5, d); t += 0.5; } return t < 3000 ? t : null; }

// ---------- warm-up from cold ----------
// minutes from switching on (everything at room temperature) until the bottom zone passes the temperature at which wax first rises
export function warmupMin(cond) { const c = normCond(cond), need = Math.max(c.Tx, PARAMS.Tm), ss = steady(c); if (ss.Tb <= need) return null;
  let s = { Tb: c.Tr, Tt: c.Tr }, t = 0; while (s.Tb < need && t < 40 * 3600) { s = stepT(s, c, 20); t += 20; } return t / 60; }
export function history(cond, hours = 4, dtS = 60) { const c = normCond(cond); let s = { Tb: c.Tr, Tt: c.Tr }; const out = [{ t: 0, ...s }]; for (let t = dtS; t <= hours * 3600; t += dtS) { s = stepT(s, c, dtS); out.push({ t, ...s }); } return out; }

// ---------- map of conditions ----------
export function regimeMap(base = {}, Ps = [10, 15, 20, 25, 30, 35, 40, 50, 60], Trs = [10, 14, 18, 22, 26, 30, 34]) { return Trs.map(Tr => Ps.map(P => ({ P, Tr, r: regimeSteady({ ...base, P, Tr }) }))); }
// working window in room temperature for a given bulb (°C): [coldest room that still flows, warmest]
export function windowTr(cond) { const c = normCond(cond); let lo = null, hi = null; for (let Tr = -5; Tr <= 45; Tr += 0.1) { if (regimeSteady({ ...c, Tr }) === "flowing") { if (lo == null) lo = Tr; hi = Tr; } } return lo == null ? null : [Math.round(lo * 10) / 10, Math.round(hi * 10) / 10]; }

// ---------- compare with a real lamp ----------
// find the share of bulb heat (eta) that makes the model's warm-up match an observed warm-up time (minutes); bisection
export function fitEta(obsMin, cond) { let lo = 0.2, hi = 1.0; const f = e => { const w = warmupMin({ ...cond, eta: e }); return w == null ? Infinity : w; }; if (f(hi) > obsMin) return null; if (f(lo) < obsMin) return lo;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (f(mid) > obsMin) lo = mid; else hi = mid; } return (lo + hi) / 2; }

// ---------- after a shake: tiny droplets that merge again ----------
// Shaking breaks the wax into droplets of diameter d0. Two droplets must meet to merge, so the number of droplets N falls
// by second-order kinetics, dN/dt = -kc N^2, which gives N(t) = N0 / (1 + kc N0 t). Wax volume is conserved, so the mean
// diameter grows as d = d0 (N0/N)^(1/3). kc is not known for a real lamp: it is set from the time the visitor says the lamp
// takes to gather its wax again (illustrative).
export const SHAKE = { d0: 0.002, nEnd: 6 };                       // m: droplet size right after the shake (assumed); blobs left when it has gathered
export function waxVolume(ds) { return ds.reduce((a, d) => a + Math.PI * d * d * d / 6, 0); }                  // m3
export function shakeN0(Vw, d0 = SHAKE.d0) { return Vw / (Math.PI * d0 * d0 * d0 / 6); }
export function shakeRate(N0, clearS, nEnd = SHAKE.nEnd) { return (N0 / nEnd - 1) / clearS; }                  // kc N0, 1/s
export function shakeN(N0, kN0, t) { return N0 / (1 + kN0 * t); }
export function shakeD(N0, N, d0 = SHAKE.d0) { return d0 * Math.cbrt(N0 / N); }
// cloudiness: total droplet surface relative to just after the shake, N d^2 / (N0 d0^2) = (N/N0)^(1/3)
export function shakeCloud(N0, N) { return Math.cbrt(N / N0); }
