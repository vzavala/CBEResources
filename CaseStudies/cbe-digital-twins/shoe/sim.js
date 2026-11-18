// Running-shoe midsole twin: the model.
// Four parts, all plain functions so they can be checked against validate.py:
//  1. foam mechanics  - Gibson-Ashby cellular-solid scaling + closed-cell gas term + densification
//  2. footstrike      - vertical spring-mass runner (leg spring in series with a viscoelastic foam)
//  3. foam making     - supercritical CO2 / N2 physical foaming: Henry's-law solubility, classical
//                       nucleation, gas expansion inside a temperature window
//  4. durability      - illustrative loss of resilience with mileage (not from a cited model)
// SI units inside; the page converts for display.

export const G = 9.81, P_ATM = 0.101325e6, R_GAS = 8.314, K_B = 1.380649e-23;

// Solid-polymer inputs. Moduli are representative model inputs, not measured values for any branded
// foam. Loss factors are calibrated so that a 70 kg runner at 4:00/km on the default density gets the
// midsole energy returns measured by Hoogkamer et al. (2018): PEBA 87.0 %, TPU 75.9 %, EVA 65.5 %.
export const FOAMS = {
  PEBA: { label: "PEBA (supercritical foam)", rhoS: 1010, Es: 80e6, tanD: 0.0446, wear: 0.6, rho: 100 },
  TPU:  { label: "TPU (bead foam)",           rhoS: 1200, Es: 60e6, tanD: 0.1016, wear: 0.3, rho: 200 },
  EVA:  { label: "EVA (classic foam)",        rhoS: 950,  Es: 40e6, tanD: 0.1704, wear: 0.8, rho: 200 },
  // Supercritical, nitrogen-foamed EVA as used in stability daily trainers. No energy-return
  // measurement is used: its loss factor and default density are assumptions, between classic EVA and PEBA.
  SCEVA: { label: "Supercritical EVA (N₂-foamed)", rhoS: 950, Es: 40e6, tanD: 0.085, wear: 0.6, rho: 130 },
};

// Midsole geometry (assumptions): 35 mm thick under the loaded area, 120 cm2 loaded area.
export const SHOE = { h: 0.035, A: 0.012, plateArea: 1.25 };
// Leg stiffness per kg of body mass, rising with speed (assumed coefficients; runners stiffen their
// legs as they speed up, and heavier runners have stiffer legs).
export function kLeg(u, mass) { return mass * Math.max(220, 330 + 60 * (u - 3)); }

// ---------- 1. foam mechanics ----------
// phi: relative density rho*/rho_s.  Returns stress (Pa) at engineering strain eps.
export function foamProps(foam, rho, miles = 0) {
  const F = FOAMS[foam];
  const phi = rho / F.rhoS;
  const age = 1 - Math.exp(-miles / 400);                 // 0 new -> 1 worn (illustrative)
  const Estar = F.Es * phi * phi * (1 + 0.15 * age);      // Gibson-Ashby: E*/Es = phi^2 (packs stiffer)
  const sigEl = 0.05 * Estar;                             // elastic collapse plateau: 0.05 Es phi^2
  const epsD = 1 - 1.4 * phi;                             // densification strain
  const tanD = F.tanD * (1 + F.wear * age);               // more energy lost as the foam ages
  return { phi, Estar, sigEl, epsD, tanD };
}
export function stress(p, eps) {
  if (eps <= 0) return 0;
  const e = Math.min(eps, p.epsD - 1e-4);
  const cell = p.sigEl * Math.tanh(p.Estar * e / p.sigEl);          // cell-wall bending, then buckling
  const gas = P_ATM * e / (1 - e - p.phi);                          // trapped gas compressed (closed cells)
  const dens = Math.pow(p.epsD / (p.epsD - e), 1.5);                // cells touching: densification
  return (cell + gas) * dens;
}

// ---------- 2. footstrike ----------
// Body mass m (kg) moves down y during contact; the leg spring (kLeg) carries force F = kLeg (y - xf),
// the foam compresses xf with Kelvin-Voigt damping:  c dxf/dt = F - Ff(xf).
// Touchdown speed comes from the flight time between steps; contact time is found by iteration.
export const FLIGHT = 0.35;
export function cadenceHz(u) { return (150 + 6 * u) / 60; }   // steps/min rising with speed (assumed)

// Barefoot: the heel pad replaces the midsole as the cushion. Linear spring at the heel pad's end-of-loading
// stiffness measured in vivo, 212 N/mm (Wearing & Smeathers 2011); loss factor calibrated so the pad dissipates
// 66 % of the energy put into it (energy dissipating ratio 0.66, same study) for the default runner.
export const HEEL_PAD = { k: 212e3, tanD: 0.614, h: 0.0177 };   // h: nominal unloaded thickness (10.7 mm limit / 0.605 strain, De Clercq 1994), display only
export function footstrike({ mass, u, foam, rho, plate, miles, h = SHOE.h, kGround = Infinity }, opts = {}) {
  const bare = foam === "BARE";
  const p = bare ? { phi: 0, Estar: 0, sigEl: 0, epsD: 1, tanD: HEEL_PAD.tanD } : foamProps(foam, rho, miles);
  if (bare) h = HEEL_PAD.h;
  const A = SHOE.A * (plate && !bare ? SHOE.plateArea : 1);
  const Ff = bare ? (x => HEEL_PAD.k * x) : (x => stress(p, x / h) * A);
  const kf0 = bare ? HEEL_PAD.k : p.Estar * A / h;
  const kL = 1 / (1 / kLeg(u, mass) + 1 / kGround);              // leg spring in series with the ground (rigid by default)
  const kS = 1 / (1 / kL + 1 / kf0);
  const w = Math.sqrt(kS / mass);
  const c = p.tanD * kf0 / w;
  const f = cadenceHz(u), tStep = 1 / f;
  const dt = opts.dt || 2e-5;
  // touchdown speed from the flight phase between steps (assumed: in the air 35 % of each step)
  const v0 = G * FLIGHT * tStep / 2;
  const out = contact(mass, v0, Ff, c, kL, dt, opts.record);
  const stepLen = u / f;
  const stepsPerKm = 1000 / stepLen;
  return {
    ...out, f, cadence: f * 60, stepLen, stepsPerKm, props: p, c, kf0, kS, kL, h,
    lrBW: out.LR / (mass * G),
    R: out.Wout / out.Win,
    peakBW: out.Fmax / (mass * G),
    kJperKm: out.Wout * stepsPerKm / 1000,
    kJperMarathon: out.Wout * stepsPerKm * 42.195 / 1000,
  };
}

function contact(m, v0, Ff, c, kL, dt, record) {
  // state: y, v (body), x (foam)
  const rhs = (y, v, x) => {
    const F = Math.max(kL * (y - x), 0);
    return [v, G - F / m, (F - Ff(Math.max(x, 0))) / c];
  };
  let y = 0, v = v0, x = 0, t = 0, Win = 0, Wout = 0, Fmax = 0, xmax = 0, rising = false, J = 0;
  const trace = [], Fs = [0];
  for (let n = 0; n < 200000; n++) {
    const k1 = rhs(y, v, x);
    const k2 = rhs(y + dt / 2 * k1[0], v + dt / 2 * k1[1], x + dt / 2 * k1[2]);
    const k3 = rhs(y + dt / 2 * k2[0], v + dt / 2 * k2[1], x + dt / 2 * k2[2]);
    const k4 = rhs(y + dt * k3[0], v + dt * k3[1], x + dt * k3[2]);
    const yn = y + dt / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
    const vn = v + dt / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    let xn = x + dt / 6 * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
    if (xn < 0) xn = 0;
    const F0 = Math.max(kL * (y - x), 0), F1 = Math.max(kL * (yn - xn), 0);
    const Fm = 0.5 * (F0 + F1), dx = xn - x;
    if (dx > 0) Win += Fm * dx; else Wout -= Fm * dx;
    J += Fm * dt;                                                      // impulse of the leg force (N s)
    y = yn; v = vn; x = xn; t += dt;
    Fs.push(F1);
    if (F1 > Fmax) Fmax = F1;
    if (x > xmax) xmax = x;
    if (record && n % 50 === 0) trace.push([t, F1, x]);
    // take-off: rising and the leg nearly unloaded (the foam's losses are made up by the runner's
    // muscles in real running, so the body never returns exactly to touchdown height here)
    if (rising && (F1 < 0.05 * m * G || v > 0)) break;
    if (v < 0) rising = true;
  }
  // average loading rate between 20 % and 80 % of peak force on the rising side (linear interpolation)
  let i = 1; const cross = lvl => { while (i < Fs.length && Fs[i] < lvl) i++; return (i - 1 + (lvl - Fs[i - 1]) / (Fs[i] - Fs[i - 1])) * dt; };
  const t20 = cross(0.2 * Fmax), t80 = cross(0.8 * Fmax);
  const LR = 0.6 * Fmax / (t80 - t20);
  return { tc: t, Win, Wout, Fmax, xmax, v0, trace, LR, J };
}

// ---------- 2b. impact shock (empirical, not part of the spring-mass model) ----------
// The spring-mass model has a massless leg, so it has no impact transient. The heel-strike transient is taken
// from measurements (Lieberman et al. 2010, rearfoot strikers): shod 1.74 BW rising at 69.7 BW/s, barefoot
// 1.89 BW at 463.1 BW/s. For a shoe, the measured shod rate is scaled by this model's loading rate relative to
// the default shoe for the same runner, so a softer cushion sends a weaker shock. Up the body the shock is
// attenuated: lower back (about hip level) 21.0 / 75.9 = 0.277 of the distal-tibia peak (Macdermid et al. 2017);
// the knee value is interpolated between them (assumption). Travel delays are illustrative.
export const IMPACT = { shod: { F: 1.74, LR: 69.7 }, bare: { F: 1.89, LR: 463.1 } };
export const SHOCK_UP = { foot: { a: 1, delay: 0 }, knee: { a: 0.61, delay: 0.004 }, hip: { a: 0.277, delay: 0.010 } };
export function impactShock(run, refRun, bare = false) {
  const m = bare ? IMPACT.bare : IMPACT.shod;
  const LR = bare ? m.LR : m.LR * run.lrBW / refRun.lrBW;           // BW/s
  const Tr = m.F / LR;                                                // rise time to the transient peak (s)
  // transient force F(t) = F [(t/Tr) exp(1 - t/Tr)]^2: peaks at Tr with mean rise rate F/Tr, mostly over within about 3 Tr
  const g = u => u * Math.exp(1 - u);
  const Fi = t => t <= 0 ? 0 : m.F * g(t / Tr) ** 2;
  const rate = t => t <= 0 ? 0 : 2 * m.F / Tr * g(t / Tr) * Math.exp(1 - t / Tr) * (1 - t / Tr);
  const at = (site, t) => SHOCK_UP[site].a * Math.max(rate(t - SHOCK_UP[site].delay), 0);
  return { F: m.F, LR, Tr, Fi, rate, at };
}

// ---------- 3. foam making (supercritical physical foaming) ----------
export const GASES = {
  CO2: { label: "CO₂", M: 0.044, Href: 0.008, Q: 15e3, D373: 6e-10 },   // Href: g gas / g polymer / MPa at 100 C
  N2:  { label: "N₂",  M: 0.028, Href: 0.0009, Q: 3e3, D373: 9e-10 },
};
export const FOAMING = { Tref: 373.15, Tsoft: 110, Tcoll: 160, etaMax: 0.25, gamma0: 0.03, Fhet: 0.003,
  N0: 1e9, sheet: 0.010, Ed: 30e3, rhoS: 1010 };

const sig = z => 1 / (1 + Math.exp(-z));
export function foaming({ gas, P, Tc }) {
  const g = GASES[gas], C = FOAMING;
  const T = Tc + 273.15;
  // Henry's law: dissolved gas proportional to pressure; less dissolves when hotter
  const H = g.Href * Math.exp(g.Q / R_GAS * (1 / T - 1 / C.Tref));
  const w = Math.min(H * P, 0.25);                                   // g gas per g polymer
  // soak time for a sheet to fill with gas (diffusion): t ~ L^2 / (4 D)
  const D = g.D373 * Math.exp(-C.Ed / R_GAS * (1 / T - 1 / C.Tref));
  const tSat = C.sheet * C.sheet / (4 * D);
  // nucleation: dissolved gas lowers surface tension; bigger pressure drop -> many more bubbles
  const gamma = C.gamma0 * (1 - w / 0.3);
  const B = 16 * Math.PI * gamma ** 3 * C.Fhet / (3 * K_B * T) / 1e12;   // in MPa^2
  const Nc = C.N0 * Math.exp(-B / (P * P));                         // cells per cm3 of solid polymer
  // expansion: dissolved gas becomes gas at 1 atm; the polymer only holds it in a temperature window
  const nPerCm3 = w * (C.rhoS / 1000) / (g.M * 1000);                // mol gas per cm3 polymer
  const Vg = nPerCm3 * R_GAS * T / P_ATM * 1e6;                      // cm3 gas at 1 atm per cm3 polymer
  const eta = C.etaMax * sig((Tc - C.Tsoft) / 5) * (1 - 0.7 * sig((Tc - C.Tcoll) / 6));
  const ER = Math.min(1 + eta * Vg, 20);
  const rho = C.rhoS / ER;                                           // kg/m3
  const Nf = Nc / ER;                                                // cells per cm3 of foam
  const coarsen = 1 + 2 * sig((Tc - C.Tcoll) / 6);
  const dCell = Math.cbrt(6 * (1 - 1 / ER) / (Math.PI * Math.max(Nf, 1))) * 1e4 * coarsen;   // micrometres
  return { w, H, D, tSat, gamma, B, Nc, Vg, eta, ER, rho, dCell };
}

// ---------- 5. distance: footstrikes and foam life ----------
// Footstrikes (both feet) over d km at the run's step frequency and speed.
export const footstrikes = (run, km) => km * run.stepsPerKm;
// Ground stiffness under the foot: rigid circular punch on an elastic half-space (Boussinesq), k = 2 a E / (1 - nu^2),
// with the contact radius a from the loaded area. E and nu for each surface are typical values (assumed).
export const SURFACES = {
  rigid:   { label: "Rigid ground (model default)", E: Infinity, nu: 0.3 },
  concrete:{ label: "Concrete sidewalk", E: 30e9, nu: 0.2 },
  asphalt: { label: "Asphalt road", E: 5e9, nu: 0.35 },
  hotasph: { label: "Asphalt on a hot day", E: 1e9, nu: 0.4 },
  dirt:    { label: "Packed dirt trail", E: 50e6, nu: 0.35 },
};
export const groundK = (key, A = SHOE.A) => { const s = SURFACES[key], a = Math.sqrt(A / Math.PI); return s.E === Infinity ? Infinity : 2 * a * s.E / (1 - s.nu * s.nu); };
// Shoe distance (km) at which the energy return of a new shoe falls to `frac` of its new value, by bisection
// on the illustrative wear curve (Eq. 10). Returns Infinity if it stays above the threshold up to 3000 km.
export function distanceToReturn(base, frac = 0.9) {
  const R = km => footstrike({ ...base, miles: km }).R, target = frac * R(0);
  let lo = 0, hi = 3000;
  if (R(hi) >= target) return Infinity;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (R(m) >= target) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
