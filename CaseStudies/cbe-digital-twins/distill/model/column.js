// Dynamic, rigorous tray-by-tray model of a sieve-tray distillation column (ethanol / water).
//
// Stage indexing:   0 = total condenser + reflux splitter,  1..N = trays (top -> bottom),  N+1 = reboiler
// Flow naming:      L[i] = liquid leaving stage i (downwards),  V[i] = vapour leaving stage i (upwards)
//
// Per tray i the model solves
//   dM_i/dt      = L[i-1] + V[i+1] + F_i - L[i] - V[i]                         (total mole balance)
//   d(M x)_i/dt  = L[i-1] x[i-1] + V[i+1] y[i+1] + F_i z_F - L[i] x[i] - V[i] y[i]  (component balance)
//   energy       : V[i] from the tray enthalpy balance incl. holdup term M dh/dt and wall heat loss
//   VLE          : T_i = bubble point of x_i at P_i (NRTL + Antoine), y*_i
//   Murphree     : y_i = y_{i+1} + E_MV,i (y*_i - y_{i+1})   (E from O'Connell, entrainment, weeping)
//   Hydraulics   : L[i] from Francis weir formula on the clear-liquid height,
//                  tray dP = dry orifice + liquid head + surface tension head, P_{i+1} = P_i + dP_i
//                  flooding (Fair, Lygeros-Magoulas fit), weeping (Sutherland/Sinnott), downcomer backup

import * as th from './thermo.js';
import { DEFAULT_CONFIG, cloneConfig } from './config.js';

const g = 9.80665;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Chord length (weir length) for a circular segment of given area fraction
function weirLengthFor(D, areaFrac) {
  // area fraction of segment with half-angle th: (th - sin th cos th)/pi
  let lo = 0, hi = Math.PI / 2;
  for (let k = 0; k < 60; k++) {
    const m = 0.5 * (lo + hi);
    const f = (m - Math.sin(m) * Math.cos(m)) / Math.PI;
    if (f < areaFrac) lo = m; else hi = m;
  }
  return D * Math.sin(0.5 * (lo + hi));
}

export class Column {
  constructor(cfg = DEFAULT_CONFIG) {
    this.cfg = cloneConfig(cfg);
    this.reset();
  }

  // ---------------------------------------------------------------- geometry
  computeGeometry() {
    const G = this.cfg.geometry;
    const A = Math.PI * G.diameter ** 2 / 4;
    const Ad = G.downcomerAreaFrac * A;
    this.geo = {
      A, Ad,
      An: A - Ad,              // net area (flooding basis)
      Aa: A - 2 * Ad,          // active (bubbling) area
      Ah: G.holeAreaFrac * (A - 2 * Ad),
      lw: weirLengthFor(G.diameter, G.downcomerAreaFrac),
      nHoles: Math.round(G.holeAreaFrac * (A - 2 * Ad) / (Math.PI * G.holeDiameter ** 2 / 4)),
      wallAreaPerTray: Math.PI * G.diameter * G.traySpacing,
    };
  }

  reset() {
    this.computeGeometry();
    const N = this.cfg.geometry.nTrays;
    this.N = N;
    const n = N + 2;
    const mk = (v = 0) => new Float64Array(n).fill(v);
    this.t = 0;
    this.M = mk(); this.x = mk(); this.T = mk(360); this.P = mk(this.cfg.operation.topPressure);
    this.y = mk(); this.ystar = mk(); this.h = mk(); this.H = mk(); this.dhdx = mk(); this.dxdt = mk(); this.dhdt = mk(); this.nStep = 0;
    this.L = mk(); this.V = mk(); this.E = mk(0.6); this.Qloss = mk();
    this.effMult = mk(1);  // fault injection: per-stage efficiency multiplier
    this.hyd = Array.from({ length: n }, () => ({}));
    this.levelInt = 0;
    this.Bman = 0.05;                       // bottoms flow used when the level loop is in manual (mol/s)
    this.ctl = { tray: { I: 0, bias: this.cfg.operation.reboilerDuty }, top: { I: 0, bias: this.cfg.operation.refluxRatio } }; // bumpless after a reset
    this.faults = { coolingWaterFail: false, heaterTrip: false, foaming: false };

    const op = this.cfg.operation;
    const z = op.feedX;
    // start hot: every stage at the feed composition, trays filled just over the weir
    for (let i = 0; i < n; i++) {
      this.x[i] = z;
      const b = th.bubbleT(z, op.topPressure);
      this.T[i] = b.T;
    }
    const xmol = (vol, x, T) => vol * th.rhoL(x, T) / th.mw(x);
    for (let i = 1; i <= N; i++) this.M[i] = xmol(this.geo.Aa * (this.cfg.geometry.weirHeight + 0.0006), z, this.T[i]);
    this.M[0] = 1.0; // condensate in the condenser / splitter (drains with tau = 15 s)
    this.M[N + 1] = xmol(this.cfg.geometry.reboilerVolume * op.reboilerLevelSP, z, this.T[N + 1]);
    this.B = 0; this.D = 0; this.vent = 0; this.subcool = op.refluxSubcool; this.Qc = 0; this.Qr = op.reboilerDuty;
    this.history = [];
    this.events = [];
    // converge the initial pressure profile / flows without integrating
    for (let k = 0; k < 5; k++) this.updateAlgebraic(0);
  }

  setGeometry(patch) {
    Object.assign(this.cfg.geometry, patch);
    this.reset();
  }

  // ---------------------------------------------------------------- feed
  feedState() {
    const op = this.cfg.operation;
    const Pf = this.P[op.feedTray] || op.topPressure;
    const bub = th.bubbleT(op.feedX, Pf);
    const Tf = Math.min(op.feedT, bub.T);
    const rho = th.rhoL(op.feedX, Math.min(op.feedT, 293.15 + 5));
    const F = op.feedFlowLph / 1000 / 3600 * rho / th.mw(op.feedX); // mol/s
    const hF = th.hLiq(op.feedX, Tf);
    const hBub = th.hLiq(op.feedX, bub.T);
    const dew = th.dewT(op.feedX, Pf, bub.T + 3);
    const HDew = th.hVap(op.feedX, dew.T);
    const q = (HDew - hF) / (HDew - hBub);
    const Qpre = F * (hF - th.hLiq(op.feedX, op.ambientT));
    return { F, hF, Tf, Tbub: bub.T, q, Qpre, z: op.feedX };
  }

  // ---------------------------------------------------------------- algebraic part
  // Computes temperatures, equilibrium, efficiencies, flows (liquid hydraulics + energy balances)
  updateAlgebraic(dt) {
    const N = this.N, G = this.cfg.geometry, op = this.cfg.operation, geo = this.geo;
    const n = N + 2;

    // 1. VLE and enthalpies on every stage
    for (let i = 0; i < n; i++) {
      const b = th.bubbleT(this.x[i], this.P[i], this.T[i]);
      this.T[i] = b.T;
      this.ystar[i] = b.y1;
      this.h[i] = th.hLiq(this.x[i], b.T);
    }
    // reflux leaves the splitter subcooled (subcooling from the last condenser evaluation)
    this.h[0] = th.hLiq(this.x[0], this.T[0] - this.subcool);
    // Holdup energy term M dh/dt.  On a tray at its bubble point h = h_sat(x, P); pressure moves fast and
    // is quasi-static, so dh/dt is evaluated along the saturation curve: dh/dt = (dh_sat/dx) * dx/dt,
    // with dx/dt from the previous step's component balance (avoids an algebraic feedback loop).
    if ((this.nStep++ % 20) === 0) {
      for (let i = 0; i < n; i++) {
        const dx = 1e-4, xa = Math.max(0, this.x[i] - dx), xb = Math.min(1, this.x[i] + dx);
        const ta = th.bubbleT(xa, this.P[i], this.T[i]).T, tb = th.bubbleT(xb, this.P[i], this.T[i]).T;
        this.dhdx[i] = (th.hLiq(xb, tb) - th.hLiq(xa, ta)) / (xb - xa);
      }
    }
    for (let i = 0; i < n; i++) this.dhdt[i] = this.dhdx[i] * this.dxdt[i];

    // 2. Liquid flows leaving trays: Francis weir on clear liquid height
    for (let i = 1; i <= N; i++) {
      const rho = th.rhoL(this.x[i], this.T[i]);
      const MW = th.mw(this.x[i]);
      const hcl = this.M[i] * MW / rho / geo.Aa;
      const how = Math.max(0, hcl - G.weirHeight);
      const Q = 1.84 * geo.lw * Math.pow(how, 1.5);
      this.L[i] = Q * rho / MW;
      Object.assign(this.hyd[i], { rhoL: rho, MWL: MW, hcl, how, QL: Q });
    }

    // 3. Wall heat losses
    const hw = op.insulated ? this.cfg.heatLoss.hInsulated : this.cfg.heatLoss.hBare;
    const HL = this.cfg.heatLoss, wallA = HL.wallAreaPerTray ?? geo.wallAreaPerTray; // calibrated area may include flanges
    for (let i = 1; i <= N; i++) this.Qloss[i] = hw * wallA * (this.T[i] - op.ambientT);
    const rebUA = HL.rebUA ?? (op.insulated ? 1.5 : 10) * 0.12;   // W/K, reboiler + bottoms piping to the room
    this.Qloss[N + 1] = rebUA * (this.T[N + 1] - op.ambientT);

    // 4. Reboiler: bottoms flow by PI level controller
    const reb = N + 1;
    const rhoB = th.rhoL(this.x[reb], this.T[reb]);
    const volB = this.M[reb] * th.mw(this.x[reb]) / rhoB;
    this.reboilerLevel = volB / G.reboilerVolume;
    const e = this.reboilerLevel - op.reboilerLevelSP;
    if (dt > 0) this.levelInt = clamp(this.levelInt + e * dt, -2000, 2000);
    const lc = this.ctlCfg().level, Kc = lc.Kc, tauI = lc.tauI; // mol/s per unit level, s
    const bias = lc.bias ?? 0.05, Bmax = lc.Bmax ?? 0.5;          // scaled up for larger columns (calibrated build)
    if (lc.mode === 'auto') this.B = clamp(Kc * (e + this.levelInt / tauI) + bias, 0, Bmax);
    else { this.B = this.Bman; this.levelInt = (this.Bman - bias) / Kc * tauI - e * tauI; } // track for bumpless return to auto
    if (this.reboilerLevel < 0.05) this.B = 0;

    // 5. Murphree vapour compositions, bottom-up
    this.y[reb] = this.ystar[reb];
    for (let i = N; i >= 1; i--) {
      const E = this.E[i];
      this.y[i] = this.y[i + 1] + E * (this.ystar[i] - this.y[i + 1]);
    }
    for (let i = 1; i <= reb; i++) this.H[i] = th.hVap(this.y[i], this.T[i]);

    // 6. Energy balances -> vapour flows, bottom-up
    const feed = this.feed = this.feedState();
    this.Qr = this.faults.heaterTrip ? 0 : op.reboilerDuty;
    // Proper form accounting for mass leaving as vapour: L h_N + Q = V H + B h_B + d(Mh)/dt,
    // with d(Mh)/dt = h dM/dt + M dh/dt and dM/dt = L - V - B  ->  V (H - h) = L (h_N - h) + Q - Qloss - M dh/dt
    this.V[reb] = Math.max(0, (this.L[N] * (this.h[N] - this.h[reb]) + this.Qr - this.Qloss[reb]
      - this.M[reb] * this.dhdt[reb]) / (this.H[reb] - this.h[reb]));

    for (let i = N; i >= 1; i--) {
      const Fi = (i === op.feedTray) ? feed.F : 0;
      const Lin = this.L[i - 1];
      const hin = this.h[i - 1];
      // V_i (H_i - h_i) = V_{i+1}(H_{i+1} - h_i) + L_{i-1}(h_{i-1} - h_i) + F (h_F - h_i) - Qloss - M dh/dt
      const num = this.V[i + 1] * (this.H[i + 1] - this.h[i]) + Lin * (hin - this.h[i])
        + Fi * (feed.hF - this.h[i]) - this.Qloss[i] - this.M[i] * this.dhdt[i];
      this.V[i] = Math.max(0, num / (this.H[i] - this.h[i]));
    }

    // 7. Condenser + reflux splitter
    this.condenser(dt);

    // 8. Pressure profile, flooding, weeping, entrainment, efficiency
    this.hydraulics();
  }

  condenser() {
    const op = this.cfg.operation;
    const V1 = this.V[1], y1 = this.y[1];
    const Pc = op.topPressure;
    const bub = th.bubbleT(y1, Pc, this.T[1]);
    const Hv = this.H[1];
    const mcw = this.faults.coolingWaterFail ? 0 : op.coolingWaterLpm / 60; // kg/s
    const Ccw = mcw * 4180;
    const eps = Ccw > 0 ? 1 - Math.exp(-op.condenserUA / Ccw) : 0;
    const Qavail = eps * Ccw * Math.max(0, bub.T - op.coolingWaterT);
    const hSat = th.hLiq(y1, bub.T);
    const Qsat = V1 * (Hv - hSat);
    let Trefl = bub.T - op.refluxSubcool;
    let Qfull = V1 * (Hv - th.hLiq(y1, Trefl));
    let Vc = V1, vent = 0, Qc;
    if (Qavail >= Qfull) { Qc = Qfull; }
    else if (Qavail >= Qsat) {
      // partial subcooling only
      const cp = y1 * th.COMP[0].CpL + (1 - y1) * th.COMP[1].CpL;
      Trefl = bub.T - (Qavail - Qsat) / Math.max(1e-9, V1 * cp);
      Qc = Qavail;
    } else {
      Vc = Qsat > 0 ? V1 * Qavail / Qsat : 0;
      vent = V1 - Vc; Trefl = bub.T; Qc = Qavail;
    }
    this.Qc = Qc; this.vent = vent; this.Vc = Vc; this.Trefl = Trefl;
    this.cwOutT = op.coolingWaterT + (Ccw > 0 ? Qc / Ccw : 0);
    this.condenserCapacity = Qavail;
    // reflux splitter: condensate drains from the small holdup with time constant tau
    const tau = 15; // s
    const out = this.M[0] / tau;
    const R = op.refluxRatio;
    this.L[0] = out * R / (R + 1);
    this.D = out / (R + 1);
    // reflux leaves the splitter subcooled by the amount the condenser could provide
    this.subcool = Math.max(0, bub.T - Trefl);
    this.TreflActual = this.T[0] - this.subcool;
  }

  hydraulics() {
    const N = this.N, G = this.cfg.geometry, op = this.cfg.operation, geo = this.geo;
    this.P[0] = op.topPressure;
    this.P[1] = op.topPressure; // negligible vapour-line loss to the vented condenser
    for (let i = 1; i <= N; i++) {
      const hy = this.hyd[i];
      const Vup = this.V[i + 1], yv = this.y[i + 1], Tv = this.T[i + 1];
      const rhoV = th.rhoV(yv, Tv, this.P[i + 1] || this.P[i]);
      const MWV = th.mw(yv);
      const Qv = Vup * MWV / rhoV; // m3/s
      const uh = Qv / geo.Ah;
      const uN = Qv / geo.An;
      const rhoL = hy.rhoL;
      const sigma = th.sigmaL(this.x[i], this.T[i]) * (this.faults.foaming ? 0.6 : 1);
      // dry tray drop (orifice), m liquid
      const hd = (uh * uh / (2 * g)) * (rhoV / rhoL) / (G.orificeCoeff ** 2);
      const hsig = 4 * sigma / (rhoL * g * G.holeDiameter);
      const ht = hd + hy.hcl + hsig;
      const dP = rhoL * g * ht;
      // Flooding (Fair; Lygeros & Magoulas curve fit)
      const Lmass = this.L[i] * hy.MWL, Vmass = Vup * MWV;
      const FLV = Vmass > 1e-9 ? (Lmass / Vmass) * Math.sqrt(rhoV / rhoL) : 0;
      const Csb = 0.0105 + 0.1496 * Math.pow(G.traySpacing, 0.755) * Math.exp(-1.463 * Math.pow(Math.max(FLV, 1e-4), 0.842));
      const holeCorr = clamp(5 * G.holeAreaFrac + 0.5, 0.6, 1.0);
      const foamFactor = this.faults.foaming ? 0.75 : 1.0;
      const uFlood = (G.floodFactor ?? 1) * Csb * holeCorr * foamFactor * Math.pow(sigma / 0.020, 0.2) * Math.sqrt((rhoL - rhoV) / rhoV); // floodFactor: calibration knob
      const flood = uN / uFlood;
      // Weeping (Sinnott / Eduljee)
      const hmm = (G.weirHeight + hy.how) * 1000;
      const K2 = 31.3 - 3.5 * Math.exp(-hmm / 30);
      const uhMin = (K2 - 0.90 * (25.4 - G.holeDiameter * 1000)) / Math.sqrt(rhoV);
      const weep = uh < uhMin ? clamp((uhMin - uh) / uhMin, 0, 1) : 0;
      // Entrainment (approximate fit of Fair's chart) and Colburn correction
      const psi = clamp(0.4 * Math.pow(flood, 5) * Math.pow(0.05 / Math.max(FLV, 0.005), 0.4), 0, 0.6);
      // Downcomer backup (clear liquid) and flooding check, aerated factor 0.5
      const hda = 0.165 * Math.pow(hy.QL / (geo.lw * Math.max(G.weirHeight - 0.010, 0.005)), 2) / (2 * g) * 2;
      const hdb = hy.hcl + ht + hda;
      const dcFlood = (hdb / 0.5) / (G.traySpacing + G.weirHeight);
      // Froth height (Bennett et al. effective froth density)
      const Ks = uN * Math.sqrt(rhoV / Math.max(rhoL - rhoV, 1));
      const phi = Math.exp(-12.55 * Math.pow(Math.max(Ks, 1e-6), 0.91));
      const froth = Math.min(G.traySpacing, hy.hcl / Math.max(phi, 0.05));

      // Tray efficiency
      const alpha = th.relVol(this.x[i], this.T[i]);
      const mu = th.muL(this.x[i], this.T[i]) * 1000; // cP
      // fixed mode: one value, or separate rectifying / stripping values (stripping = trays below the feed tray)
      const Efix = (op.murphreeStrip != null && op.feedFlowLph > 0 && i > op.feedTray) ? op.murphreeStrip : op.murphreeFixed;
      let E0 = op.efficiencyMode === 'fixed' ? Efix : clamp(0.492 * Math.pow(alpha * mu, -0.245), 0.2, 0.95);
      E0 *= this.effMult[i];
      let E = E0 / (1 + E0 * psi / (1 - psi));                    // Colburn entrainment correction
      E *= (1 - 0.85 * weep);                                      // weeping bypass
      if (flood > 1) E *= clamp(1 - (flood - 1) * 3, 0.05, 1);    // flooded tray loses separation
      if (Vup < 1e-6) E = 0;
      this.E[i] = clamp(E, 0, 1);

      Object.assign(hy, { rhoV, Qv, uh, uN, hd, hsig, ht, dP, FLV, uFlood, flood, uhMin, weep, psi, hdb, dcFlood, froth, alpha, mu, E0, sigma, Csb });
      this.P[i + 1] = this.P[i] + dP;
    }
  }

  // ---------------------------------------------------------------- integration
  step(dt) {
    const N = this.N, op = this.cfg.operation, reb = N + 1;
    this.runControllers(dt);
    this.updateAlgebraic(dt);
    const feed = this.feed;
    const dM = new Float64Array(N + 2), dMx = new Float64Array(N + 2);
    // condenser/splitter
    dM[0] = this.Vc - this.L[0] - this.D;
    dMx[0] = this.Vc * this.y[1] - (this.L[0] + this.D) * this.x[0];
    for (let i = 1; i <= N; i++) {
      const Fi = (i === op.feedTray) ? feed.F : 0;
      dM[i] = this.L[i - 1] + this.V[i + 1] + Fi - this.L[i] - this.V[i];
      dMx[i] = this.L[i - 1] * this.x[i - 1] + this.V[i + 1] * this.y[i + 1] + Fi * feed.z
        - this.L[i] * this.x[i] - this.V[i] * this.y[i];
    }
    dM[reb] = this.L[N] - this.V[reb] - this.B;
    dMx[reb] = this.L[N] * this.x[N] - this.V[reb] * this.y[reb] - this.B * this.x[reb];

    for (let i = 0; i <= reb; i++) {
      const Mx = this.M[i] * this.x[i] + dMx[i] * dt;
      this.M[i] = Math.max(1e-4, this.M[i] + dM[i] * dt);
      const xn = clamp(Mx / this.M[i], 0, 1);
      this.dxdt[i] = (xn - this.x[i]) / dt;
      this.x[i] = xn;
    }
    this.t += dt;
  }

  // ---------------------------------------------------------------- control layer
  ctlCfg() {
    if (!this.cfg.control) this.cfg.control = JSON.parse(JSON.stringify(DEFAULT_CONFIG.control));
    return this.cfg.control;
  }
  // Loop definitions: process variable, output (manipulated variable) and its limits.
  // tray loop is reverse acting (T low -> more duty); top loop is direct acting (T high -> more reflux).
  loopDef(name) {
    const op = this.cfg.operation, c = this.ctlCfg()[name], N = this.N;
    const tray = Math.max(1, Math.min(N, c.tray));
    if (name === 'tray') return { c, tray, pv: this.T[tray], get: () => op.reboilerDuty, set: (v) => { op.reboilerDuty = v; }, lo: 0, hi: c.hi ?? 30000, sign: -1 };   // hi: per-column limit (the only change from the source file)
    return { c, tray, pv: this.T[tray], get: () => op.refluxRatio, set: (v) => { op.refluxRatio = v; }, lo: 0.2, hi: 20, sign: 1 };
  }
  // Switch a temperature loop between manual and auto without a bump: the output starts from its
  // current value, and an empty setpoint takes the current measurement.
  setLoopMode(name, mode) {
    const d = this.loopDef(name), st = this.ctl[name];
    d.c.mode = mode;
    if (mode === 'auto') { st.bias = d.get(); st.I = 0; if (d.c.sp == null || !Number.isFinite(d.c.sp)) d.c.sp = d.pv; }
  }
  setLevelMode(mode) { const lc = this.ctlCfg().level; if (mode === 'manual') this.Bman = this.B; lc.mode = mode; }
  runControllers(dt) {
    for (const name of ['tray', 'top']) {
      const d = this.loopDef(name), st = this.ctl[name];
      st.pv = d.pv; st.sp = d.c.sp; st.tray = d.tray;
      if (d.c.mode !== 'auto') { st.out = d.get(); continue; }
      const e = d.sign * (d.pv - d.c.sp);          // sign makes both loops "error > 0 -> raise output"
      const u = st.bias + d.c.Kc * (e + st.I / d.c.tauI);
      const sat = (u >= d.hi && e > 0) || (u <= d.lo && e < 0);
      if (!sat) st.I += e * dt;                      // conditional integration (anti-windup)
      st.out = clamp(st.bias + d.c.Kc * (e + st.I / d.c.tauI), d.lo, d.hi);
      d.set(st.out);
    }
  }

  // Advance by `seconds` using sub-steps of at most dtMax
  advance(seconds, dtMax = 0.1) {
    let rem = seconds;
    while (rem > 1e-9) {
      const dt = Math.min(dtMax, rem);
      this.step(dt);
      rem -= dt;
      this.record(); // keeps a 5 s trend history even during fast-forward
    }
  }

  record() {
    const last = this.history[this.history.length - 1];
    if (last && this.t - last.t < 5) return;
    if (last && this.t < last.t) this.history.length = 0;
    const N = this.N;
    this.history.push({ t: this.t, xD: this.x[0], xB: this.x[N + 1], Ttop: this.T[1], Tbot: this.T[N + 1],
      D: this.D, B: this.B, Qr: this.Qr, Qc: this.Qc,
      Dlph: this.toLph(this.D, this.x[0], 298.15), Blph: this.toLph(this.B, this.x[N + 1], 298.15), dP: this.P[N + 1] - this.P[1], Tfeed: this.T[this.cfg.operation.feedTray],
      R: this.cfg.operation.refluxRatio, level: this.reboilerLevel,
      Ttc: this.ctl.tray.pv, SPtc: this.ctlCfg().tray.mode === 'auto' ? this.ctlCfg().tray.sp : null,
      Tic: this.ctl.top.pv, SPic: this.ctlCfg().top.mode === 'auto' ? this.ctlCfg().top.sp : null });
    if (this.history.length > 12000) this.history.shift(); // ~16 h at 5 s resolution
  }

  // ---------------------------------------------------------------- reporting
  balances() {
    const N = this.N, f = this.feed;
    const MWD = th.mw(this.x[0]), MWB = th.mw(this.x[N + 1]);
    const ventMW = th.mw(this.y[1]);
    return {
      F: f.F, D: this.D, B: this.B, vent: this.vent,
      massIn: f.F * th.mw(f.z), massOut: this.D * MWD + this.B * MWB + this.vent * ventMW,
      ethIn: f.F * f.z, ethOut: this.D * this.x[0] + this.B * this.x[N + 1] + this.vent * this.y[1],
      ethRecovery: f.F * f.z > 0 ? this.D * this.x[0] / (f.F * f.z) : 0,
      Qr: this.Qr, Qc: this.Qc, Qpre: f.Qpre, Qloss: this.Qloss.reduce((a, b) => a + b, 0),
      energyIn: this.Qr + f.F * f.hF,
      energyOut: this.Qc + this.Qloss.reduce((a, b) => a + b, 0) + this.D * this.h[0] + this.B * this.h[N + 1]
        + this.vent * this.H[1],
    };
  }

  // Overall volumetric rates in L/h for display
  toLph(molps, x, T) { return molps * th.mw(x) / th.rhoL(x, T) * 1000 * 3600; }

  stageInfo(i) {
    const N = this.N;
    const base = { index: i, T: this.T[i], P: this.P[i], x: this.x[i], y: this.y[i], ystar: this.ystar[i], M: this.M[i],
      L: this.L[i], V: this.V[i], Qloss: this.Qloss[i] };
    if (i >= 1 && i <= N) return { kind: 'tray', ...base, E: this.E[i], hyd: { ...this.hyd[i] }, isFeed: i === this.cfg.operation.feedTray };
    if (i === 0) return { kind: 'condenser', ...base, Qc: this.Qc, vent: this.vent, Trefl: this.TreflActual, cwOutT: this.cwOutT, D: this.D, capacity: this.condenserCapacity };
    return { kind: 'reboiler', ...base, Qr: this.Qr, B: this.B, level: this.reboilerLevel };
  }
}

export function runToSteadyState(col, seconds = 4 * 3600, dt = 0.1) {
  const chunk = 60;
  for (let s = 0; s < seconds; s += chunk) col.advance(chunk, dt);
  return col;
}
