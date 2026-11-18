// Physics for the football teaching twin. Pure functions and small integrators, no three.js.
// SI units inside (K or °C as named, Pa or kPa as named). Every constant that is not a physical
// constant is a "Typical" value from the literature range noted beside it; the README lists them.

export const SIG = 5.670374e-8, G = 9.80665, RU = 8.314462;
export const P_ATM = 98.3;                  // kPa, mean station pressure in Madison (≈ 265 m elevation)
export const LAT = 43.07, LON = -89.41;     // Madison, WI
export const K = c => c + 273.15;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const PSI = 6.894757;                // kPa per psi

// ---------------------------------------------------------------- moist air (CBE 310 / 311)
export const psat = T => 0.61094 * Math.exp(17.625 * T / (T + 243.04));        // kPa, Magnus (Alduchov–Eskridge), T in °C
export function dewPoint(pv) { const a = Math.log(pv / 0.61094); return 243.04 * a / (17.625 - a); }
export function moistAir(T, RH, p = P_ATM) {
  const pv = RH / 100 * psat(T), pd = p - pv;
  const rho = (pd * 28.965 + pv * 18.015) / (RU * K(T));                          // kg/m³ (kPa·g/mol / (J/mol/K·K))
  const w = 0.622 * pv / (p - pv);                                                 // humidity ratio, kg water / kg dry air
  return { pv, pd, rho, w, q: w / (1 + w), Td: dewPoint(Math.max(1e-4, pv)), rhoDry: p * 28.965 / (RU * K(T)) };
}
// wet-bulb from the psychrometer equation pv = psat(Tw) − γ p (T − Tw), solved by bisection
export function wetBulb(T, RH, p = P_ATM) {
  const pv = RH / 100 * psat(T), gam = 6.53e-4;
  let lo = T - 40, hi = T;
  for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; (psat(m) - gam * p * (T - m) > pv) ? hi = m : lo = m; }
  return (lo + hi) / 2;
}
export const muWater = T => 2.414e-5 * 10 ** (247.8 / (K(T) - 140));               // Pa·s (Vogel form)
export const latent = T => 2501e3 - 2370 * T;                                     // J/kg

// ---------------------------------------------------------------- sun and sky over Madison
export function sunPos(doy, hourCDT) {
  const B = 2 * Math.PI * (doy - 81) / 364, EoT = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
  const solarT = hourCDT + (4 * (LON - 15 * -5) + EoT) / 60;
  const dec = 23.45 * Math.PI / 180 * Math.sin(2 * Math.PI * (284 + doy) / 365), H = (solarT - 12) * 15 * Math.PI / 180, lat = LAT * Math.PI / 180;
  const sel = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H), el = Math.asin(sel);
  let az = Math.acos(clamp((Math.sin(dec) - sel * Math.sin(lat)) / (Math.cos(el) * Math.cos(lat)), -1, 1));
  if (H > 0) az = 2 * Math.PI - az;
  return { el, az, elDeg: el * 180 / Math.PI, azDeg: az * 180 / Math.PI };
}
// clear-sky beam (Meinel with Kasten–Young air mass), diffuse ≈ 10 %; clouds by Kasten–Czeplak
export function irradiance(el, cloud) {
  if (el <= 0) return { dir: 0, dif: 0, glob: 0, dni: 0 };
  const e = el * 180 / Math.PI, AM = 1 / (Math.sin(el) + 0.50572 * (e + 6.07995) ** -1.6364);
  const dniC = 1361 * 0.7 ** (AM ** 0.678), globC = 1.1 * dniC * Math.sin(el);
  const glob = globC * (1 - 0.75 * cloud ** 3.4), dir = dniC * Math.sin(el) * (1 - cloud) ** 1.5;
  return { dir: Math.min(dir, glob), dif: Math.max(0, glob - Math.min(dir, glob)), glob, dni: dniC * (1 - cloud) ** 1.5 };
}
// downwelling long-wave: Brutsaert clear-sky emissivity, cloud correction (1 + 0.22 c²)
export function skyLW(T, pv, cloud) {
  const eps = Math.min(1, 1.24 * (pv * 10 / K(T)) ** (1 / 7) * (1 + 0.22 * cloud * cloud));
  return { L: eps * SIG * K(T) ** 4, eps, Tsky: K(T) * eps ** 0.25 - 273.15 };
}
export const hConv = v => 5.7 + 3.8 * v;              // W/m²K, flat surface in wind (McAdams)

// ---------------------------------------------------------------- weather over the day
// Air temperature follows a cosine between the daily low (03:00) and the afternoon high (15:00).
// Water vapour pressure is held at the value set by the afternoon RH, so RH rises as it cools.
export function weatherAt(W, hour) {
  const swing = 10 * (1 - 0.6 * W.cloud) * (W.rain > 0 ? 0.5 : 1);
  const Ta = W.Thigh - swing / 2 * (1 - Math.cos(2 * Math.PI * (hour - 15) / 24));
  const pv = Math.min(psat(W.Thigh) * W.RH / 100, psat(Ta));
  const RH = 100 * pv / psat(Ta);
  const s = sunPos(W.doy, hour), I = irradiance(s.el, W.cloud), sky = skyLW(Ta, pv, W.cloud);
  return { hour, Ta, RH, pv, sun: s, I, sky, v: W.wind, rain: W.rain, Tmean: W.Thigh - swing / 2 };
}

// ---------------------------------------------------------------- playing surfaces
export const SURF = {
  rubber: { name: "Synthetic · sand + crumb rubber", alb: 0.08, eps: 0.93, C: 30e3, kd: 3, rs: Infinity,
    H: 0.045, E0: 0.62e6, eD: 0.62, eta: 900, drain: [["Infill (sand + SBR rubber)", 0.045, 1.5e-4], ["Perforated carpet backing", 0.004, 2e-6], ["Shock pad (drainage channels)", 0.015, 2e-3], ["Open-graded stone base", 0.15, 1e-2]] },
  organic: { name: "Synthetic · organic (cork/coconut) infill", alb: 0.16, eps: 0.94, C: 34e3, kd: 5, rs: 900,
    H: 0.045, E0: 0.70e6, eD: 0.60, eta: 1000, drain: [["Infill (sand + cork/coconut)", 0.045, 1.0e-4], ["Perforated carpet backing", 0.004, 2e-6], ["Shock pad (drainage channels)", 0.015, 2e-3], ["Open-graded stone base", 0.15, 1e-2]] },
  grass: { name: "Natural grass · sand root zone", alb: 0.23, eps: 0.97, C: 60e3, kd: 10, rs: 70,
    H: 0.05, E0: 0.62e6, eD: 0.55, eta: 1400, drain: [["Thatch and turf", 0.02, 2e-5], ["Sand root zone (USGA-style)", 0.30, 6e-5], ["Choker / gravel blanket", 0.10, 5e-3]] },
};

// surface energy balance: net(Ts) = absorbed solar + sky LW − emitted LW − convection − evaporation − ground conduction
export function surfFlux(Ts, w, s, shade = false) {
  const S = shade ? w.I.dif : w.I.glob, h = hConv(w.v);
  const air = moistAir(w.Ta, w.RH), rhoA = air.rho;
  const sw = (1 - s.alb) * S, lwIn = s.eps * w.sky.L, lwOut = s.eps * SIG * K(Ts) ** 4, conv = h * (Ts - w.Ta);
  let LE = 0;
  const rs = w.rain > 0 ? 0 : s.rs;
  if (rs < Infinity) {
    const ra = rhoA * 1006 / h, qs = 0.622 * psat(Ts) / (P_ATM - 0.378 * psat(Ts)), qa = 0.622 * w.pv / (P_ATM - 0.378 * w.pv);
    LE = rhoA * (qs - qa) / (ra + rs) * latent(Ts);
  }
  const gnd = s.kd * (Ts - w.Tmean);
  return { net: sw + lwIn - lwOut - conv - LE - gnd, sw, lwIn, lwOut, conv, LE, gnd, S };
}
export function surfSteady(w, s, shade) {
  let lo = w.Ta - 25, hi = w.Ta + 70;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; surfFlux(m, w, s, shade).net > 0 ? lo = m : hi = m; }
  return (lo + hi) / 2;
}
// transient over a day: C dTs/dt = net. Two days are run and the second is kept (periodic state).
export function surfDay(W, key, shade = false) {
  const s = SURF[key], dt = 120, out = new Float32Array(24 * 30 + 1);
  let Ts = W.Thigh - 8;
  for (let day = 0; day < 2; day++) for (let k = 0; k < 24 * 30; k++) {
    const hr = k * dt / 3600, w = weatherAt(W, hr);
    if (day === 1) out[k] = Ts;
    Ts += dt * surfFlux(Ts, w, s, shade).net / s.C;
  }
  out[24 * 30] = out[0];
  return out;   // every 2 min
}
export const sampleDay = (arr, hour) => { const x = clamp(hour, 0, 24) * 30, i = Math.min(arr.length - 2, Math.floor(x)), u = x - i; return arr[i] * (1 - u) + arr[i + 1] * u; };

// ---------------------------------------------------------------- impact attenuation (ASTM F1936 / F355-A)
// 9.1 kg flat missile with a 129 cm² face dropped 0.61 m. The surface is a compressible layer of thickness H:
// σ = E ε / (1 − ε/εD)² + η ε̇ (hyperfoam-like densification plus viscous loss); E rises with compaction and in cold.
export function gmax({ surf, age = 0, Ts = 20, pad = true }) {
  const s = SURF[surf], m = 9.1, A = 0.0129, v0 = Math.sqrt(2 * G * 0.61);
  let H = s.H, E = s.E0;
  if (surf !== "grass") { if (!pad) { H -= 0.015; E *= 1.5; } E *= 1 + 0.16 * age; H *= Math.max(0.7, 1 - 0.025 * age); E *= Math.exp(-0.012 * (Ts - 20)); }
  else { E *= 1 + 0.08 * age; if (Ts < 0) E *= 1 + 6 * Math.min(1, -Ts / 4); }        // frozen root zone gets very hard
  let x = 0, v = v0, t = 0, amax = 0, xmax = 0; const dt = 2e-6, ts = [], as = [];
  const force = (x, v) => { const e = x / H, r = Math.max(0.02, 1 - e / s.eD); return A * (E * e / (r * r) + s.eta * v / H * Math.max(0, Math.min(1, x / 0.002))); };
  for (let n = 0; n < 40000; n++) {
    const f = force(x, v), a = f / m;                   // accelerometer reads contact force / mass
    if (n % 50 === 0) { ts.push(t * 1000); as.push(a / G); }
    amax = Math.max(amax, a); xmax = Math.max(xmax, x);
    const acc = G - f / m; v += acc * dt; x += v * dt; t += dt;
    if (x < 0) break;
  }
  return { g: amax / G, xmax, H, E, t: ts, a: as, v0, rebound: -v / v0 };
}

// ---------------------------------------------------------------- drainage (Darcy, layers in series)
export function drainage(surf, rainMMh) {
  const L = SURF[surf].drain, Ht = L.reduce((a, l) => a + l[1], 0), R = L.reduce((a, l) => a + l[1] / l[2], 0);
  const Keq = Ht / R, cap = Keq * 3.6e6;                         // m/s → mm/h at unit gradient
  const q = Math.min(rainMMh, cap) / 3.6e6, vDarcy = q, runoff = Math.max(0, rainMMh - cap);
  return { layers: L, Ht, Keq, cap, vDarcy, runoff, ponding: rainMMh > cap };
}

// ---------------------------------------------------------------- polyethylene fibre UV ageing (first-order, Arrhenius)
// Tensile retention R = exp(−k t), k = k_ref (UV/UV_ref) exp[−Ea/R (1/T − 1/T_ref)], k_ref set so R = 50 % after 8 seasons at 25 °C.
export function fibreLife(Tmean, uvRel = 1) {
  const kref = Math.log(2) / 8, Ea = 50e3, k = kref * uvRel * Math.exp(-Ea / RU * (1 / K(Tmean) - 1 / K(25)));
  return { k, half: Math.log(2) / k };
}

// ---------------------------------------------------------------- the football: geometry
// A football is close to a "lemon": a circular arc revolved about the long axis. Half-length a, max radius b.
export const BALL = { a: 0.1413, b: 0.0854, mass: 0.41, cp: 1500, Ix: 0.0019 };
{
  const { a, b } = BALL, R = (a * a + b * b) / (2 * b), d = R - b; let V = 0, S = 0; const n = 400;
  for (let i = 0; i < n; i++) { const x = (i + 0.5) / n * a, r = Math.sqrt(R * R - x * x) - d; V += Math.PI * r * r * a / n; S += 2 * 2 * Math.PI * r * R / Math.sqrt(R * R - x * x) * a / n; }
  Object.assign(BALL, { Rarc: R, dArc: d, V: 2 * V * 0.97, S, Aproj: Math.PI * b * b, longCirc: 4 * R * Math.asin(a / R), shortCirc: 2 * Math.PI * b });
}
export const lemonR = x => { const { Rarc: R, dArc: d, a } = BALL; return Math.abs(x) >= a ? 0 : Math.sqrt(R * R - x * x) - d; };

// ideal gas at fixed volume: (p_g + p_atm)/T is constant
export const gaugeAt = (pg0psi, T0, T1) => (pg0psi + P_ATM / PSI) * K(T1) / K(T0) - P_ATM / PSI;

// lumped ball temperature: m c dT/dt = h A (T∞ − T) + α S A_proj; a wet ball heads for the wet-bulb temperature
export function ballThermal(w) {
  const air = moistAir(w.Ta, w.RH), mu = 1.8e-5, k = 0.026, D = Math.cbrt(6 * BALL.V / Math.PI), v = Math.max(0.5, w.v);
  const Re = air.rho * v * D / mu, Nu = 2 + (0.4 * Re ** 0.5 + 0.06 * Re ** (2 / 3)) * 0.71 ** 0.4, h = Nu * k / D;
  const Tinf = w.rain > 0 ? wetBulb(w.Ta, w.RH) : w.Ta, Tsun = 0.75 * w.I.glob * 0.5 * BALL.Aproj / (h * BALL.S);
  return { h, Re, tau: BALL.mass * BALL.cp / (h * BALL.S), Teq: Tinf + Tsun, Tinf };
}

// solution–diffusion permeation of O2 and N2 through the bladder (CBE 426)
// 1 Barrer = 3.348e-16 mol·m/(m²·s·Pa). Values at 25 °C (Typical, polymer handbook ranges).
export const BLADDERS = {
  butyl: { name: "Butyl rubber (IIR)", O2: 1.3, N2: 0.33, CO2: 5.2, d: 1.2e-3, Ep: 45e3, D_N2: 4.5e-12 },
  latex: { name: "Natural rubber latex", O2: 23.3, N2: 8.1, CO2: 153, d: 1.0e-3, Ep: 30e3, D_N2: 1.1e-10 },
};
export function permeation(bl, pg0psi, Tc, days = 60) {
  const B = BLADDERS[bl], BARRER = 3.348e-16, T = K(Tc), f = Math.exp(-B.Ep / RU * (1 / T - 1 / 298.15));
  const A = BALL.S * 0.97, V = BALL.V, pout = P_ATM * 1000;
  let p = (pg0psi * PSI + P_ATM) * 1000, nO = 0.21 * p * V / (RU * T), nN = 0.79 * p * V / (RU * T);
  const out = [{ d: 0, pg: pg0psi, yO2: 0.21 }], dt = 3600;
  for (let k = 1; k <= days * 24; k++) {
    const n = nO + nN; p = n * RU * T / V;
    nO -= dt * B.O2 * BARRER * f * A * (p * nO / n - 0.21 * pout) / B.d;
    nN -= dt * B.N2 * BARRER * f * A * (p * nN / n - 0.79 * pout) / B.d;
    if (k % 24 === 0) { const pp = (nO + nN) * RU * T / V; out.push({ d: k / 24, pg: (pp / 1000 - P_ATM) / PSI, yO2: nO / (nO + nN) }); }
  }
  const lag = B.d * B.d / (6 * B.D_N2);
  return { pts: out, perDay: out[0].pg - out[1].pg, lagH: lag / 3600, f };
}

// ---------------------------------------------------------------- the spiral pass (CBE 320 drag + gyroscopic yaw of repose)
export const AERO = { Cd0: 0.10, Cd90: 0.75, CNa: 0.20, CMa: 0.40, CLs: 1.0, L: 2 * BALL.a };
export function flight({ v0 = 25, angle = 35, spin = 10, Ta = 20, RH = 50, wind = [0, 0], hand = 1, h0 = 1.9 }) {
  const rho = moistAir(Ta, RH).rho, A = BALL.Aproj, m = BALL.mass, w = 2 * Math.PI * spin, th = angle * Math.PI / 180;
  let s = [0, h0, 0, v0 * Math.cos(th), v0 * Math.sin(th), 0];
  const out = [], info = { maxAlpha: 0 };
  const deriv = (s) => {
    const vr = [s[3] - wind[0], s[4], s[5] - wind[1]], V = Math.hypot(...vr), q = 0.5 * rho * V * V;
    const vh = vr.map(c => c / V), vg = Math.hypot(s[3], s[4], s[5]);
    // gravity turn rate of the flight path and the gyroscopic yaw of repose it induces (nose to the right for clockwise spin)
    const gdot = G * Math.sqrt(Math.max(0, 1 - (s[4] / vg) ** 2)) / vg;
    const alpha = Math.min(0.35, BALL.Ix * w * gdot / Math.max(1e-6, q * A * AERO.L * AERO.CMa));
    info.maxAlpha = Math.max(info.maxAlpha, alpha);
    let r = [-vh[2], 0, vh[0]]; const rn = Math.hypot(...r) || 1; r = r.map(c => c / rn * hand);        // v̂ × ŷ: thrower's right
    const Cd = AERO.Cd0 + (AERO.Cd90 - AERO.Cd0) * Math.sin(alpha) ** 2;
    const FD = vh.map(c => -q * A * Cd * c), FN = r.map(c => q * A * AERO.CNa * alpha * c);
    // Magnus: spin axis ê = cosα v̂ + sinα r̂, force along ê × v̂ = sinα (r̂ × v̂), C = CLs·S·sinα, S = ωb/V
    const rxv = [r[1] * vh[2] - r[2] * vh[1], r[2] * vh[0] - r[0] * vh[2], r[0] * vh[1] - r[1] * vh[0]], Sp = w * BALL.b / V;
    const FM = rxv.map(c => q * A * AERO.CLs * Sp * Math.sin(alpha) * c * hand);
    return [s[3], s[4], s[5], (FD[0] + FN[0] + FM[0]) / m, (FD[1] + FN[1] + FM[1]) / m - G, (FD[2] + FN[2] + FM[2]) / m];
  };
  const dt = 0.004; let t = 0;
  while (s[1] > 0 && t < 8) {
    if (out.length === 0 || Math.round(t / dt) % 5 === 0) out.push({ t, x: s[0], y: s[1], z: s[2], v: Math.hypot(s[3], s[4], s[5]) });
    const k1 = deriv(s), s2 = s.map((c, i) => c + dt / 2 * k1[i]), k2 = deriv(s2), s3 = s.map((c, i) => c + dt / 2 * k2[i]), k3 = deriv(s3), s4 = s.map((c, i) => c + dt * k3[i]), k4 = deriv(s4);
    s = s.map((c, i) => c + dt / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])); t += dt;
  }
  out.push({ t, x: s[0], y: Math.max(0, s[1]), z: s[2], v: Math.hypot(s[3], s[4], s[5]) });
  // vacuum reference
  const vac = [], T = (v0 * Math.sin(th) + Math.sqrt((v0 * Math.sin(th)) ** 2 + 2 * G * h0)) / G;
  for (let i = 0; i <= 60; i++) { const tt = T * i / 60; vac.push({ x: v0 * Math.cos(th) * tt, y: h0 + v0 * Math.sin(th) * tt - G * tt * tt / 2 }); }
  const L = out.at(-1);
  return { pts: out, vac, range: L.x, drift: L.z, tof: L.t, vLand: L.v, rho, maxAlpha: info.maxAlpha, apex: Math.max(...out.map(p => p.y)), Re: rho * v0 * 2 * BALL.b / 1.8e-5, vacRange: vac.at(-1).x };
}

// ---------------------------------------------------------------- helmet impact (headform on a liner)
// Crushable-foam constitutive law (Gibson–Ashby shape) with strain-rate and temperature dependence:
// σ = σp(ε̇,T) [tanh(ε/εy) + β (ε/εD)³/(1 − ε/εD)],  σp = σ0 (1 + C ln(1 + ε̇/1 s⁻¹)) exp(−κ (T − 20))
// Unloading follows a fraction u of the loading stress (hysteresis = energy absorbed).
export const LINERS = {
  epp: { name: "EPP foam pads", s0: 0.114e6, C: 0.07, eY: 0.05, eD: 0.74, beta: 0.30, u: 0.22, kap: 0.012, H: 0.050 },
  vn: { name: "Vinyl-nitrile foam", s0: 0.100e6, C: 0.10, eY: 0.06, eD: 0.70, beta: 0.35, u: 0.45, kap: 0.020, H: 0.046 },
  tpu: { name: "TPU lattice / cones", s0: 0.072e6, C: 0.19, eY: 0.07, eD: 0.72, beta: 0.40, u: 0.55, kap: 0.009, H: 0.052 },
  none: { name: "Shell only, no liner", s0: 0, H: 0 },
};
// The curved shell meets the pads over a contact patch that grows with crush, A = A0 (1 + xf/xA), and the polycarbonate
// shell flexes as a spring in series with the liner: x = xf + F/ks (quasi-static split of the deflection each step).
export function helmetImpact({ v = 5.5, liner = "epp", T = 20, m = 4.9, A0 = 0.020, xA = 0.020 }) {
  const L = LINERS[liner], dt = 2e-6, ks = 0.45e6; let x = 0, u = v, t = 0, xmax = 0, amax = 0, emax = 0, xf = 0, ed = 0;
  const ts = [], as = [], xs = [], Fs = [];
  const sp = e => L.s0 * Math.exp(-L.kap * (T - 20)) * (Math.tanh(e / L.eY) + L.beta * Math.min(e / L.eD, 0.95) ** 3 / (1 - Math.min(e / L.eD, 0.95)) + 40 * Math.max(0, e / L.eD - 0.95));
  const foamF = (xf, ed) => { const e = xf / L.H, A = A0 * (1 + xf / xA);
    return ed >= 0 ? A * sp(e) * (1 + L.C * Math.log(1 + ed)) : A * L.u * sp(emax) * (e / Math.max(1e-6, emax)) ** 3; };
  for (let n = 0; n < 40000; n++) {
    let F;
    if (liner === "none") F = 1.6e6 * x + 150 * u;
    else {
      ed = u / L.H; let lo = 0, hi = Math.max(0, x);
      for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; (mid + foamF(mid, ed) / ks > x) ? hi = mid : lo = mid; }
      xf = (lo + hi) / 2; emax = Math.max(emax, xf / L.H);   // strain rate is taken from the closing speed (stable)
      F = foamF(xf, ed);
    }
    F = Math.max(0, F);
    const a = F / m; if (n % 25 === 0) { ts.push(t * 1000); as.push(a / G); xs.push(x * 1000); Fs.push(F); }
    amax = Math.max(amax, a); xmax = Math.max(xmax, x);
    u -= a * dt; x += u * dt; t += dt;
    if (x <= 0 && u < 0) break;
  }
  // HIC15 and NOCSAE Severity Index on the sampled pulse (a in g, t in s)
  const n = ts.length, cum = [0]; for (let i = 1; i < n; i++) cum.push(cum[i - 1] + (as[i] + as[i - 1]) / 2 * (ts[i] - ts[i - 1]) / 1000);
  let hic = 0, w = [0, 0];
  for (let i = 0; i < n; i += 2) for (let j = i + 2; j < n; j += 2) { const T2 = (ts[j] - ts[i]) / 1000; if (T2 > 0.015) break; const val = T2 * ((cum[j] - cum[i]) / T2) ** 2.5; if (val > hic) { hic = val; w = [ts[i], ts[j]]; } }
  let SI = 0; for (let i = 1; i < n; i++) SI += ((as[i] + as[i - 1]) / 2) ** 2.5 * (ts[i] - ts[i - 1]) / 1000;
  const vOut = Math.abs(u);
  return { g: amax / G, hic, SI, win: w, t: ts, a: as, x: xs, F: Fs, xmax, strain: L.H ? emax : 0, shellMM: (xmax - emax * (L.H || 0)) * 1000, dur: ts.at(-1), KE: 0.5 * m * v * v, eAbs: 1 - (vOut / v) ** 2, vOut, bottom: L.H ? emax > 0.93 * L.eD : true };
}

// ---------------------------------------------------------------- shoe foams and traction
export const FOAMS = {
  eva: { name: "EVA foam", Es: 40e6, rhoS: 940, rho: 200, tand: 0.17, kT: 0.020 },
  etpu: { name: "Expanded TPU beads", Es: 25e6, rhoS: 1200, rho: 250, tand: 0.09, kT: 0.010 },
  peba: { name: "PEBA foam", Es: 80e6, rhoS: 1010, rho: 100, tand: 0.05, kT: 0.008 },
};
export function midsole(key, Tc, mass) {
  const f = FOAMS[key], E = f.Es * (f.rho / f.rhoS) ** 2 * Math.exp(-f.kT * (Tc - 20)), zeta = f.tand / 2;
  const e = Math.exp(-Math.PI * zeta / Math.sqrt(1 - zeta * zeta)), F = 2.5 * mass * G, sig = F / 0.008, strain = Math.min(0.7, sig / E);
  return { E, ret: e * e, e, strain, sig, F };
}
export function traction(surf, Tc, wet) {
  const base = { rubber: 1.25, organic: 1.15, grass: 1.05 }[surf];
  let mu = base * (wet ? (surf === "grass" ? 0.78 : 0.9) : 1);
  if (surf === "grass" && Tc < 0) mu *= 0.6;
  if (surf !== "grass" && Tc < 0) mu *= 0.9;
  const rot = { rubber: 42, organic: 38, grass: 30 }[surf] * (mu / base);     // N·m peak rotational torque, Typical
  return { mu, rot };
}
export function cutDemand(angleDeg, v = 6, stance = 0.25, kv = 2.0) {
  const dv = 2 * v * Math.sin(angleDeg * Math.PI / 360), a = dv / stance;
  return { dv, a, mu: a / (kv * G) };
}

// ---------------------------------------------------------------- fabrics: capillary wicking and drying
export const FABRICS = {
  poly: { name: "Polyester knit, hydrophilic finish", r: 2e-6, theta: 55, regain: 0.004, hold: 0.6 },
  cotton: { name: "Cotton jersey", r: 1e-6, theta: 25, regain: 0.085, hold: 1.9 },
  nylon: { name: "Nylon/spandex compression", r: 1.5e-6, theta: 60, regain: 0.04, hold: 0.8 },
};
export function wicking(key, Tskin = 33) {
  const F = FABRICS[key], gam = 0.0685, mu = muWater(Tskin), c = Math.cos(F.theta * Math.PI / 180);
  const D = F.r * gam * c / (2 * mu);                 // Lucas–Washburn: h² = D t
  return { D, h60: Math.sqrt(D * 60), jurin: 2 * gam * c / (1000 * G * F.r), mu, F };
}
export function evapFlux(w, Tsurf, v) {   // kg/m²s via Chilton–Colburn analogy
  const h = 8.3 * Math.max(0.3, v) ** 0.6, air = moistAir(w.Ta, w.RH), hm = h / (air.rho * 1006 * 0.85 ** (2 / 3));
  const rvs = psat(Tsurf) * 1000 * 0.018015 / (RU * K(Tsurf)), rva = w.pv * 1000 * 0.018015 / (RU * K(w.Ta));
  return { m: Math.max(0, hm * (rvs - rva)), hm, h, rvs, rva };
}

// ---------------------------------------------------------------- drinks
export const DRINKS = {
  water: { name: "Water", cho: 0, na: 0, k: 0, parts: [] },
  sports: { name: "Sports drink, 6 % carbohydrate", cho: 6, na: 20, k: 3, parts: [["sucrose", 30 / 342.3], ["glucose", 30 / 180.16], ["Na⁺", 0.020], ["Cl⁻", 0.020], ["K⁺", 0.003], ["citrate/phosphate", 0.010]] },
  ors: { name: "Oral rehydration solution (WHO)", cho: 1.35, na: 75, k: 20, parts: [["glucose", 0.075], ["Na⁺", 0.075], ["Cl⁻", 0.065], ["K⁺", 0.020], ["citrate", 0.010]] },
  soda: { name: "Soft drink, 11 % sugar", cho: 11, na: 2, k: 0, parts: [["glucose + fructose", 110 / 180.16], ["Na⁺", 0.002], ["acids", 0.01]] },
};
for (const d of Object.values(DRINKS)) d.osm = 1000 * d.parts.reduce((a, p) => a + p[1], 0);   // mOsm/kg (ideal, dilute)

// ---------------------------------------------------------------- the player: heat balance, sweating and fluids
export const ROLES = {
  line: { name: "Offensive lineman", m: 140, h: 1.93 },
  wr: { name: "Wide receiver", m: 90, h: 1.85 },
};
export const GEAR = {
  full: { name: "Full uniform, pads and helmet", Icl: 1.3, Re: 0.035 },
  shells: { name: "Shells: helmet and shoulder pads", Icl: 0.9, Re: 0.024 },
  light: { name: "Shorts and T-shirt", Icl: 0.5, Re: 0.015 },
};
export const WORK = { rest: ["Sideline, standing", 90], game: ["Game average (intermittent)", 200], drills: ["Hard drills", 480] };
export const duBois = (m, h) => 0.202 * m ** 0.425 * h ** 0.725;
export function heatBalance(env, P, Tc = 37, Tsk = 35) {
  const R = ROLES[P.role], Gr = GEAR[P.gear], A = duBois(R.m, R.h), M = WORK[P.work][1];
  const dyn = P.work === "rest" ? 0.85 : 0.6;                                                        // pumping by movement (ISO 9920)
  const Icl = Gr.Icl * 0.155 * dyn, fcl = 1 + 0.31 * Gr.Icl, vr = Math.max(0.5, env.v) + (P.work === "rest" ? 0 : 1.5);
  const hc = 8.3 * vr ** 0.6, hr = 4.7;
  const Tmrt = (K(env.Ta) ** 4 + 0.7 * (0.3 * env.I.dni + 0.5 * env.I.dif + 0.5 * 0.15 * env.I.glob) / (0.95 * SIG)) ** 0.25 - 273.15;   // ISO 7726 style, projected-area factor 0.3
  const To = (hc * env.Ta + hr * Tmrt) / (hc + hr);
  const CR = (Tsk - To) / (Icl + 1 / (fcl * (hc + hr)));
  const he = 16.5 * hc, Emax = (psat(Tsk) - env.pv) / (Gr.Re * dyn + 1 / (fcl * he));
  const res = 0.0014 * M * (34 - env.Ta) + 0.0173 * M * (5.87 - env.pv);
  const Ereq = M - CR - res;
  return { A, M, CR, Emax, Ereq, res, Tmrt, To, hc, wreq: Ereq / Math.max(1, Emax), Tc, mass: R.m };
}
// Thermoregulation as a proportional controller on core temperature (CBE 470):
// sweat command SW = Kp (Tc − Tset), capped; evaporation E = min(λ SW / A, Emax); body heat storage drives Tc.
export class Player {
  constructor() { this.reset(); }
  reset(P) { this.out = null; this.Tc = 37.0; this.sweat = 0; this.drunk = 0; this.absorbed = 0; this.stomach = 0; this.cho = 0; this.t = 0; this.P = P || this.P; this.NaK = null; this.hist = []; this.loss = 0; }
  step(dt, env, P) {
    this.P = P; const R = ROLES[P.role], D = DRINKS[P.drink];
    if (this.NaK === null) { this.TBW0 = 0.6 * R.m; this.TBW = this.TBW0; this.NaK = (140 + 25.6) / 1.11 * this.TBW; }
    const hb = heatBalance(env, P, this.Tc, Math.min(36.5, 35 + 0.6 * (this.Tc - 37))), A = hb.A, Tset = 36.9, Kp = 0.33e-3 * (R.m / 140);       // kg/s per K
    const lam = latent(35), swMax = 2.5 / 3600;                                                          // 2.5 L/h ceiling
    const SW = Math.min(swMax, Math.max(0, Kp * (this.Tc - Tset)));
    const E = Math.min(SW * lam / A, Math.max(0, hb.Emax));
    const S = (hb.M - hb.CR - hb.res - E) * A;                                                            // W stored
    this.Tc += dt * S / (R.m * 3490 * 0.85);
    // dripping sweat (not evaporated) still leaves the body
    this.sweat += SW * dt;
    // drinking at a set rate during the game, emptying from stomach (water t½ 15 min; energy-limited at 3 kcal/min)
    const drinkIn = P.drinkRate / 3.6e6 * dt;                                                            // L this step (mL/h input)
    this.drunk += drinkIn; this.stomach += drinkIn;
    const kWater = Math.LN2 / (15 * 60) * Math.min(1, 350 / Math.max(1, D.osm));
    const ed = D.cho * 10 * 4 / 1000;                                                                     // kcal/mL
    let empty = kWater * this.stomach * dt; if (ed > 0) empty = Math.min(empty, 3 / 60 / ed * dt / 1000);
    empty = Math.min(empty, this.stomach); this.stomach -= empty; this.absorbed += empty; this.cho += empty * D.cho * 10;
    this.TBW += empty - SW * dt; this.NaK += empty * (D.na + D.k) - SW * dt * (40 + 5);
    this.t += dt;
    const lossKg = this.sweat - this.absorbed - this.stomach;
    this.out = { ...hb, SW: SW * 3600, E, S, lossPct: 100 * lossKg / R.m, Na: 1.11 * this.NaK / this.TBW - 25.6, choRate: 0 };
    return this.out;
  }
}

// ---------------------------------------------------------------- under-field heating and snow melt (ASHRAE method)
export function snowMelt(w, snowCmH, Ar = 1, geo = {}) {   // geo: { s: tube spacing m, d: depth m } (defaults 0.23, 0.15)
  if (w.Ta >= 3) return { qs: 0, qm: 0, qh: 0, qe: 0, q: 0, Tf: w.Ta, Q: 0, flow: 0, gas: 0, UA: 0, SL: 0, active: false };   // system off above 3 °C air
  const mw = snowCmH / 3600, Ts = 0.5, h = hConv(w.v);           // kg/m²s: 1 cm/h of 10:1 snow = 1 mm/h of water
  const qs = mw * (2100 * Math.max(0, -w.Ta) + 4186 * Ts), qm = mw * 334e3;
  const qh = h * (Ts - w.Ta) + 0.95 * (SIG * K(Ts) ** 4 - w.sky.L);
  const air = moistAir(w.Ta, w.RH), hm = h / (air.rho * 1006 * 0.85 ** (2 / 3)), rv = (p, T) => p * 1000 * 0.018015 / (RU * K(T));
  const qe = hm * Math.max(0, rv(psat(Ts), Ts) - rv(w.pv, w.Ta)) * 2.5e6;
  const q = qs + qm + Ar * (qh + qe);
  // buried tube array (D 25 mm, spacing 0.23 m, depth 0.15 m) in sand, k = 1.2 W/mK: conduction shape factor
  const Dp = 0.025, s = geo.s ?? 0.23, d = geo.d ?? 0.15, k = 1.2, SL = 2 * Math.PI / Math.log(2 * s / (Math.PI * Dp) * Math.sinh(2 * Math.PI * d / s));
  const UA = k * SL / s, Tf = Ts + q / UA, area = 7400;
  const Q = q * area, cpG = 3700, dT = 10, flow = Q / (cpG * dT), gas = Q / 0.9 / 50e6 * 3600;          // kg/h natural gas (LHV 50 MJ/kg)
  const tubeKm = area / s / 1000;   // km of tubing under the heated area
  return { qs, qm, qh, qe, q, Tf, Q, flow, gas, UA, SL, tubeKm, s, d, active: true };
}

// WBGT outdoors = 0.7 Tnwb + 0.2 Tg + 0.1 Ta. Black globe (150 mm) from its own heat balance; natural wet bulb ≈ psychrometric
// wet bulb plus a radiation term (simplified; Liljegren's full model is more involved).
export function wbgt(w) {
  const Tw = wetBulb(w.Ta, w.RH), D = 0.15, v = Math.max(0.3, w.v), hg = 6.3 * v ** 0.6 / D ** 0.4;
  const Sabs = 0.95 * (w.I.dir / Math.max(0.1, Math.sin(Math.max(0.05, w.sun.el))) * 0.25 + w.I.dif * 0.5 + 0.2 * w.I.glob * 0.5);
  let lo = w.Ta - 5, hi = w.Ta + 40;
  for (let i = 0; i < 50; i++) { const Tg = (lo + hi) / 2, net = Sabs + 0.95 * 0.5 * (w.sky.L + SIG * K(w.Ta) ** 4) - 0.95 * SIG * K(Tg) ** 4 - hg * (Tg - w.Ta); net > 0 ? lo = Tg : hi = Tg; }
  const Tg = (lo + hi) / 2, Tnwb = Tw + 0.0021 * w.I.glob + Math.max(0, 1.93 - 0.42 * v) * Math.min(1, w.I.glob / 200);   // Hunter & Minyard (1999) form
  return { wbgt: 0.7 * Tnwb + 0.2 * Tg + 0.1 * w.Ta, Tg, Tnwb, Tw };
}
