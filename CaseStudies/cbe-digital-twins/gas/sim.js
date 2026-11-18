// Gas network model of Zavala (2014), "Stochastic optimal control model for natural gas networks",
// Computers & Chemical Engineering 64:103-113 (Sections 2-3, Appendix A).
//   (2.6a)  dp/dt = -c1 df/dx
//   (2.6b)  df/dt = -c2 dp/dx - c3 f|f|/p
// discretized as in (3.11b)-(3.11c): implicit Euler in time, Nx points per link,
//   (p[t+1,k]-p[t,k])/dtau = -c1 (f[t+1,k+1]-f[t+1,k])/dx
//   (f[t+1,k]-f[t,k])/dtau = -c2 (p[t+1,k+1]-p[t+1,k])/dx - c3 f[t+1,k]|f[t+1,k]|/p[t+1,k]
// network: node balances (3.11a), link boundary conditions (3.11d)-(3.11g),
// active links: p_l(0) = theta_snd(l) + dtheta_l (3.11h), power P_l = c4 f_in ((theta+dtheta)/theta)^beta - 1) (3.11i).
// Supply pressures fixed (4.15), demand flows fixed; boost pressures dtheta are the controls.
// A discharge-pressure set-point mode (closed loop on dtheta, the practical setting noted at the end
// of Section 3) is offered as an option, with dtheta >= 0 (4.18f) and P <= P_U (4.18a) enforced by an
// active set. Internal units: p in bar, f in kg/s (the paper's SCMx10^4/h scaling is linear and does
// not change the solution), x in m, t in s, power in kW.

export const BAR = 1e5;
export const RHO_N = 0.72;                       // kg/m3 at normal conditions (Table 4)
export const kgs_to_MMSCMd = f => f / RHO_N * 86400 / 1e6;
export const MMSCMd_to_kgs = q => q * 1e6 * RHO_N / 86400;

// Appendix A / Table 4 constants. z and the rugosity are not listed in the paper's tables;
// z = 0.8 and eps = 0.012 mm give c = 370 m/s and lambda = 0.0084 (typical for 36" steel line pipe).
export function paperParams() {
  const cp = 2.34, cv = 1.85, z = 0.8, R = 8314, M = 18, Tgas = 293.15, D = 0.914, eps = 0.012e-3;
  const gamma = cp / cv;
  return {
    cp, cv, gamma, beta: (gamma - 1) / gamma, z, R, M, Tgas, D, eps,
    c: Math.sqrt(gamma * z * R * Tgas / M),
    lambda: Math.pow(2 * Math.log10(3.7 * D / eps), -2),
    Nx: 10,                 // points per link (Section 5)
    dt: 1800,               // paper uses 30 min; the twin defaults to finer steps for animation
    PU: 3000,               // kW, max compressor power (Section 5)
    thetaSupply: 57,        // bar (Section 5)
    thetaDemandMin: 39,     // bar
    thetaSuctionMin: 34,    // bar
    // Section 5 quotes a nominal 24e6 SCM/day but runs its scenarios at a nominal 10e6 SCM/day with
    // steps to {11, 12, 13}e6 SCM/day; 10e6 is used here (24e6 would need ~7 MW per station, far
    // above the 3000 kW limit, with the friction factor above).
    demandNominal: MMSCMd_to_kgs(10),
  };
}

// Fig. 1: 13 nodes, 12 links in series; compressors at n2..n11 drive links l2..l11; supply at n1,
// demand at n13. 1600 km in total, 100 km between compressors; the two passive end links are
// assumed to share the remaining 600 km equally.
export function paperNetwork() {
  const nodes = [], links = [];
  for (let i = 1; i <= 13; i++) nodes.push({ id: `n${i}`, type: i === 1 ? "supply" : i === 13 ? "demand" : "junction" });
  for (let l = 1; l <= 12; l++) {
    links.push({ id: `l${l}`, from: `n${l}`, to: `n${l + 1}`, L: (l === 1 || l === 12) ? 300e3 : 100e3, active: l >= 2 && l <= 11 });
  }
  return { nodes, links };
}

// ---------- dense LU with row-extent tracking (banded cost for locally ordered systems) ----------
function luSolve(A, b, n, ext) {
  for (let i = 0; i < n; i++) {             // last nonzero column of each row
    let e = 0; for (let j = n - 1; j >= 0; j--) if (A[i * n + j] !== 0) { e = j; break; }
    ext[i] = e;
  }
  for (let k = 0; k < n; k++) {
    let piv = -1, mx = 0;
    for (let i = k; i < n; i++) { const v = Math.abs(A[i * n + k]); if (v > mx) { mx = v; piv = i; } }
    if (piv < 0 || !isFinite(mx)) return false;
    if (piv !== k) {
      const e = Math.max(ext[k], ext[piv]);
      for (let j = k; j <= e; j++) { const t = A[k * n + j]; A[k * n + j] = A[piv * n + j]; A[piv * n + j] = t; }
      let t = b[k]; b[k] = b[piv]; b[piv] = t; t = ext[k]; ext[k] = ext[piv]; ext[piv] = t;
    }
    const akk = A[k * n + k], ek = ext[k];
    for (let i = k + 1; i < n; i++) {
      const aik = A[i * n + k];
      if (aik === 0) continue;
      const l = aik / akk; A[i * n + k] = 0;
      for (let j = k + 1; j <= ek; j++) A[i * n + j] -= l * A[k * n + j];
      b[i] -= l * b[k];
      if (ek > ext[i]) ext[i] = ek;
    }
  }
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i];
    for (let j = i + 1; j <= ext[i]; j++) s -= A[i * n + j] * b[j];
    b[i] = s / A[i * n + i];
  }
  return true;
}

export class GasNetwork {
  constructor(net = paperNetwork(), params = paperParams()) {
    this.net = net; this.P = { ...params };
    const { c, D, lambda, Nx } = this.P;
    this.A = Math.PI * D * D / 4;
    this.c1 = c * c / (this.A * BAR);                       // bar/s per (kg/s)/m
    this.c2 = this.A * BAR;                                 // (kg/s)/s per bar/m
    this.c3 = 8 * lambda * c * c * this.A / (Math.PI ** 2 * D ** 5) / BAR;   // = lambda c^2/(2 D A) / BAR
    this.c4 = this.P.cp * this.P.Tgas;                      // kW per kg/s
    // unknowns interleaved per link: [p_0, f_0, p_1, f_1, ...] (keeps the Jacobian banded)
    let off = 0;
    this.links = net.links.map(ll => {
      const N = Nx, o = { ...ll, N, dx: ll.L / (N - 1), o: off };
      off += 2 * N; return o;
    });
    this.n = off;
    this.linkById = Object.fromEntries(this.links.map(l => [l.id, l]));
    this.nodes = net.nodes.map(nd => ({ ...nd, in: [], out: [] }));
    this.nodeById = Object.fromEntries(this.nodes.map(n => [n.id, n]));
    for (const l of this.links) { this.nodeById[l.from].out.push(l); this.nodeById[l.to].in.push(l); }
    // compressor (one per active link, at its sending node)
    this.comps = this.links.filter(l => l.active).map((l, i) => ({
      id: `CS-${i + 1}`, link: l, node: this.nodeById[l.from],
      mode: "boost", boost: 2.0, pset: 55, active: "boost", dtheta: 2.0, PU: this.P.PU,
    }));
    for (const c of this.comps) c.link.comp = c;
    // equation ordering follows the chain: node eqs of l.from, then l's PDE rows
    this.order = [];
    const done = new Set();
    for (const l of this.links) {
      if (!done.has(l.from)) { this.order.push({ node: this.nodeById[l.from] }); done.add(l.from); }
      this.order.push({ link: l });
    }
    for (const nd of this.nodes) if (!done.has(nd.id)) this.order.push({ node: nd });
    this.x = new Float64Array(this.n);
    this.xold = new Float64Array(this.n);
    this.J = new Float64Array(this.n * this.n);
    this.R = new Float64Array(this.n);
    this.ext = new Int32Array(this.n);
    this.dxv = new Float64Array(this.n);
    this.t = 0;
    this.thetaSupply = this.P.thetaSupply;
    this.demand = Object.fromEntries(this.nodes.filter(n => n.type === "demand").map(n => [n.id, this.P.demandNominal]));
    this.newtonIters = 0;
  }

  ip(l, k) { return l.o + 2 * k; }      // index of p_l,k
  if_(l, k) { return l.o + 2 * k + 1; } // index of f_l,k

  // reference pressure index for node theta: the end of an inlet link, or a passive outlet link
  thetaIx(nd) {
    if (nd.in.length) return this.ip(nd.in[0], nd.in[0].N - 1);
    const pas = nd.out.find(l => !l.active);
    return pas ? this.ip(pas, 0) : -1;
  }

  assemble(dt) {
    const { x, xold, J, R, n } = this; J.fill(0);
    const inv = isFinite(dt) ? 1 / dt : 0;
    const { beta } = this.P;
    let r = 0;
    const add = (col, v) => { J[r * n + col] += v; };
    for (const item of this.order) {
      if (item.link) {
        const l = item.link, { N, dx } = l;
        for (let k = 0; k < N - 1; k++) {
          const pk = this.ip(l, k), fk = this.if_(l, k), pk1 = this.ip(l, k + 1), fk1 = this.if_(l, k + 1);
          // (3.11b)
          R[r] = (x[pk] - xold[pk]) * inv + this.c1 * (x[fk1] - x[fk]) / dx;
          add(pk, inv); add(fk1, this.c1 / dx); add(fk, -this.c1 / dx); r++;
          // (3.11c)
          const f = x[fk], p = x[pk], af = Math.abs(f);
          R[r] = (x[fk] - xold[fk]) * inv + this.c2 * (x[pk1] - x[pk]) / dx + this.c3 * f * af / p;
          add(fk, inv + 2 * this.c3 * af / p); add(pk1, this.c2 / dx); add(pk, -this.c2 / dx - this.c3 * f * af / (p * p)); r++;
        }
        continue;
      }
      const nd = item.node, th = this.thetaIx(nd);
      // pressure conditions (3.11f)-(3.11h): every link end at the node relates to theta_n
      const ends = [...nd.in.map(l => ({ l, ix: this.ip(l, l.N - 1), act: false })),
                    ...nd.out.map(l => ({ l, ix: this.ip(l, 0), act: l.active }))];
      for (const e of ends) {
        if (e.ix === th) continue;
        if (!e.act) { R[r] = x[e.ix] - x[th]; add(e.ix, 1); add(th, -1); r++; continue; }
        const c = e.l.comp;
        if (c.active === "boost") { R[r] = x[e.ix] - x[th] - c.dtheta; add(e.ix, 1); add(th, -1); }
        else if (c.active === "pset") { R[r] = x[e.ix] - c.pset; add(e.ix, 1); }
        else {   // "power": c4 f_in ((p_out/theta)^beta - 1) = P_U   (scaled by 1/P_U)
          const fi = this.if_(e.l, 0), q = x[e.ix] / x[th], qb = Math.pow(q, beta), s = this.c4 / c.PU;
          R[r] = s * x[fi] * (qb - 1) - 1;
          add(fi, s * (qb - 1));
          add(e.ix, s * x[fi] * beta * qb / x[e.ix]);
          add(th, -s * x[fi] * beta * qb / x[th]);
        }
        r++;
      }
      if (nd.type === "supply") { R[r] = x[th] - this.thetaSupply; add(th, 1); r++; }   // (4.15); supply flow free
      else {                                                       // (3.11a) with (3.11d)-(3.11e)
        let s = 0;
        for (const l of nd.in) { const ix = this.if_(l, l.N - 1); s += x[ix]; add(ix, 1); }
        for (const l of nd.out) { const ix = this.if_(l, 0); s -= x[ix]; add(ix, -1); }
        s -= this.demand[nd.id] || 0;                              // d_j at any node with customers (3.11a)
        R[r] = s; r++;
      }
    }
    if (r !== n) throw new Error(`system not square: ${r} equations, ${n} unknowns`);
  }

  newton(dt, tol = 1e-11, maxit = 40) {
    const { n, dxv } = this;
    for (let it = 1; it <= maxit; it++) {
      this.assemble(dt);
      for (let i = 0; i < n; i++) dxv[i] = -this.R[i];
      if (!luSolve(this.J, dxv, n, this.ext)) return -1;
      let step = 1;
      for (const l of this.links) for (let k = 0; k < l.N; k++) {   // keep pressures positive
        const p = this.x[this.ip(l, k)], d = dxv[this.ip(l, k)];
        if (p + step * d < 0.3 * p) step = Math.min(step, -0.7 * p / d);
      }
      let mx = 0;
      for (let i = 0; i < n; i++) { this.x[i] += step * dxv[i]; mx = Math.max(mx, Math.abs(step * dxv[i]) / (1 + Math.abs(this.x[i]))); }
      if (!this.x.every(Number.isFinite)) return -1;
      if (mx < tol && step === 1) { this.newtonIters = it; return it; }
    }
    return -1;
  }

  compPower(c) {
    const th = this.x[this.thetaIx(c.node)], po = this.x[this.ip(c.link, 0)], fi = this.x[this.if_(c.link, 0)];
    return this.c4 * fi * (Math.pow(po / th, this.P.beta) - 1);
  }

  // active set for the set-point mode: dtheta >= 0 and P <= P_U
  solve(dt) {
    for (const c of this.comps) c.active = c.mode;
    for (let pass = 0; pass < 6; pass++) {
      const it = this.newton(dt);
      if (it < 0) return it;
      let changed = false;
      for (const c of this.comps) {
        if (c.mode !== "pset") continue;
        const th = this.x[this.thetaIx(c.node)], po = this.x[this.ip(c.link, 0)];
        if (c.active === "pset") {
          if (po - th < 0) { c.active = "boost"; c.dtheta = 0; changed = true; }
          else if (this.compPower(c) > c.PU * (1 + 1e-9)) { c.active = "power"; changed = true; }
        } else if (c.active === "power" && po > c.pset) { c.active = "pset"; changed = true; }
        else if (c.active === "boost" && c.dtheta === 0 && c.pset > th) { c.active = "pset"; changed = true; }
      }
      if (!changed) return it;
    }
    return 0;
  }

  syncBoosts() {   // dtheta actually applied (for set-point mode it is an output)
    for (const c of this.comps) {
      if (c.mode === "boost") c.dtheta = c.boost;
    }
  }

  // consistent initial condition (4.17): steady state with fixed boosts, supply pressure, demands
  initSteady() {
    this.syncBoosts();
    const d = Object.values(this.demand).reduce((a, b) => a + b, 0);
    let p = this.thetaSupply;
    for (const l of this.links) for (let k = 0; k < l.N; k++) { this.x[this.ip(l, k)] = p; this.x[this.if_(l, k)] = d; }
    this.xold.set(this.x);
    let it = this.solve(Infinity);
    if (it < 0) {              // pseudo-transient continuation as a fallback
      for (const l of this.links) for (let k = 0; k < l.N; k++) { this.x[this.ip(l, k)] = p; this.x[this.if_(l, k)] = d; }
      for (let i = 0; i < 300; i++) { this.xold.set(this.x); if (this.solve(3600) < 0) break; }
      it = this.solve(Infinity);
    }
    this.xold.set(this.x); this.t = 0;
    this.update();
    return it;
  }

  step(dt = this.P.dt) {
    this.syncBoosts();
    const save = Float64Array.from(this.x);
    this.xold.set(this.x);
    const it = this.solve(dt);
    if (it < 0) { this.x.set(save); return it; }
    this.t += dt;
    this.update();
    return it;
  }

  update() {
    const { x } = this, { c } = this.P;
    let pack = 0;
    this.state = {};
    for (const l of this.links) {
      const p = [], f = [];
      for (let k = 0; k < l.N; k++) { p.push(x[this.ip(l, k)]); f.push(x[this.if_(l, k)]); }
      let m = 0;
      for (let k = 0; k < l.N - 1; k++) m += p[k] * l.dx;   // the mass the discretized balance (3.11b) conserves exactly
      m *= this.A * BAR / (c * c);                      // line pack, kg
      const rho = p.map(v => v * BAR / (c * c));
      const vel = f.map((v, k) => v / (rho[k] * this.A));
      this.state[l.id] = { p, f, rho, vel, pack: m };
      pack += m;
    }
    this.linepack = pack;
    this.compState = {};
    for (const cc of this.comps) {
      const th = x[this.thetaIx(cc.node)], po = x[this.ip(cc.link, 0)];
      if (cc.mode === "pset") cc.dtheta = po - th;
      this.compState[cc.id] = { suction: th, discharge: po, dtheta: po - th, ratio: po / th,
        flow: x[this.if_(cc.link, 0)], power: this.compPower(cc), active: cc.active };
    }
    this.supplyFlow = x[this.if_(this.links[0], 0)];
    const dn = this.nodes.find(n => n.type === "demand");
    this.demandPressure = x[this.thetaIx(dn)];
    this.nodeP = Object.fromEntries(this.nodes.map(nd => [nd.id, x[this.thetaIx(nd)]]));
  }
}
