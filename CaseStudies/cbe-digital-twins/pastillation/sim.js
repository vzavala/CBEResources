// Port of gen_data() from github.com/zavalab/ML/Pastillation (pastillation/data/gen_data.py)
// for running the digital twin live in the browser. Same grid, boundary conditions, water-jet
// heat sink (helping.heat_sink), clog sampling, PID belt-speed law, clamps and update order.
//
// Units follow the simulator: u is temperature above T_0 = 72 F; one cell = one pastille pitch
// unit; one step = dt = 1 (0.5 s per gen_args docstring); speed in cells/step.
//
// The implicit (theta = 1) system A c = b is solved with 6 in-place (Gauss-Seidel) sweeps instead
// of spsolve. The interior diagonal is 1 + 4*alpha*dt = 1.0238 against off-diagonal row sum
// 0.0238, so every sweep cuts the error by at least ~43x; 6 sweeps reach ~1e-10 relative.

export const DEFAULTS = {
  Nx: 65, Ny: 637, nozzleYSpacing: 13, alpha: 5.95e-3, T0: 72, source: 140,
  // PID_BANK[:, 0] in gen_data.py
  Kp: 22.3199118, tI: 9.45040648, td: 0.0147050843, Tsp: 14, uBar: 2,
};

// Clog probability per nozzle row, P(chi), digitised from the paper's Fig. 3a.
// The simulator deposits a pastille when the GP prediction exceeds a uniform draw, i.e.
// with probability 1 - P(chi) (the scaled temperature in eq. 2.1).
export const FIG3A_CLOG = [0.27, 0.16, 0.09, 0.20, 0.12, 0.02, 0.05, 0.19, 0.14, 0.13, 0.16, 0.15,
  0.15, 0.16, 0.30, 0.37, 0.66, 0.82, 0.84, 0.52, 0.51, 0.59, 0.42, 0.30, 0.15, 0.14, 0.14, 0.13,
  0.20, 0.23, 0.18, 0.19];

// Small seeded random-number generator (mulberry32) so problem setups are reproducible.
// Pass it as opts.rand; the default is Math.random, as in the original (unseeded) simulator.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// heat_sink() constants
const RHO = 7850, V = 0.0234 ** 2 * 0.01 * 2, CP = 466, MW = 4 * 3.63 / 60 / 2 / 189, CPW = 4148, TW = 24.5;
export const SINK = MW * CPW / (RHO * V * CP);
export const SINK_PARAMS = { RHO, V, CP, MW, CPW, TW };

export class PastillationSim {
  constructor(opts = {}) {
    Object.assign(this, DEFAULTS, opts);
    const { Nx, Ny } = this;
    this.N = Nx * Ny;
    this.F = this.alpha;               // alpha*dt/dx^2, dx = dy = dt = 1
    this.diag = 1 + 4 * this.F;
    this.nNoz = Math.floor((Nx - 2) / 2);   // odd interior columns: 32
    this.depositProb = opts.depositProb || FIG3A_CLOG.map(p => 1 - p);
    this.rand = opts.rand || Math.random;
    this.mode = opts.mode || "pid";    // "pid" | "manual"
    this.manualSpeed = opts.manualSpeed || 2;
    // water-jet rows: q_y = arange(0, Ny, 13)[1:] and its +/-1 neighbours; q_x = 1..Nx-2
    this.sinkRow = new Uint8Array(Ny);
    for (let y = this.nozzleYSpacing; y < Ny; y += this.nozzleYSpacing)
      for (const d of [-1, 0, 1]) if (y + d >= 0 && y + d < Ny) this.sinkRow[y + d] = 1;
    this.forcedClog = new Int32Array(this.nNoz);   // steps remaining of an injected clog
    this.reset();
  }

  reset() {
    const { N, Ny } = this;
    this.u = new Float64Array(N);       // u_n (after shift), the state carried to the next step
    this.c = new Float64Array(N);       // field solved this step = the frame the simulator stores
    this.b = new Float64Array(N);
    this.flowN = new Uint8Array(N);     // flow_n (after shift)
    this.frameFlow = new Uint8Array(N); // flow stored with frame c
    this.position = [];
    this.n = 0;
    this.speed = this.uBar;
    this.e1 = 0; this.e2 = 0;           // error_history[n-1], [n-2] (zeros before the start)
    this.hist = { T: [], F: [], speed: [], sp: [], D: [] };   // D: pastilles placed in the new row
    this.forcedClog.fill(0);
    this.lastRow = 0;
  }

  injectClog(k0, k1, steps) {
    for (let k = Math.max(0, k0); k <= Math.min(this.nNoz - 1, k1); k++) this.forcedClog[k] = steps;
  }

  step() {
    const { Nx, Ny, u, b, c, flowN, F, diag } = this;
    const m = (i, j) => j * Nx + i;
    this.position.push(0);

    // top boundary (j = 0): new row of drops at the odd columns
    b[0] = 0;
    let k = -1, drops = 0;
    for (let i = 1; i < Nx - 1; i++) {
      const p = m(i, 0);
      if ((i + 1) % 2 === 0) {
        k++;
        let src = this.depositProb[k] > this.rand() ? 1 : 0;
        if (this.forcedClog[k] > 0) { src = 0; this.forcedClog[k]--; }
        flowN[p] = src; b[p] = this.source * src; u[p] = b[p]; drops += src;
      } else { flowN[p] = 0; b[p] = 0; u[p] = 0; }
    }
    b[m(Nx - 1, 0)] = 0;

    // interior rows: b = u_n + dt * heat_sink(u_n)  (theta = 1); edges held at 0
    for (let j = 1; j < Ny - 1; j++) {
      const r = j * Nx;
      b[r] = 0; b[r + Nx - 1] = 0;
      const sink = this.sinkRow[j];
      for (let i = 1; i < Nx - 1; i++) {
        const p = r + i;
        b[p] = u[p] + (sink ? -SINK * (5 / 9 * (u[p] + this.T0 - 32) - TW) : 0);
      }
    }
    // bottom boundary: carried over
    const rb = (Ny - 1) * Nx;
    for (let i = 0; i < Nx; i++) b[rb + i] = u[rb + i];

    // solve A c = b (boundary rows are identity)
    c.set(b);
    for (let s = 0; s < 6; s++) {
      for (let j = 1; j < Ny - 1; j++) {
        const r = j * Nx;
        for (let i = 1; i < Nx - 1; i++) {
          const p = r + i;
          c[p] = (b[p] + F * (c[p - 1] + c[p + 1] + c[p - Nx] + c[p + Nx])) / diag;
        }
      }
    }

    // measurement: mean temperature of the leading (oldest) row still on the belt
    let row = this.position[0];
    if (row > Ny - 1) {
      this.position = this.position.filter(q => q <= Ny - 1);
      row = this.position[0];
    }
    let sum = 0;
    for (let i = 0; i < Nx; i++) sum += c[row * Nx + i];
    const Tobs = sum / Nx;
    let flowSum = 0;
    for (let p = 0; p < this.N; p++) flowSum += flowN[p];
    const Fobs = flowSum / Ny * (this.n === 0 ? this.uBar : this.speed);

    // PID velocity form, as in gen_data (dt = 1)
    let speed;
    const e = this.Tsp - Tobs;
    if (this.mode === "pid") {
      let dsdt = this.Kp * (e - this.e1 + (1 / this.tI) * e + this.td * (e - 2 * this.e1 + this.e2));
      dsdt = Math.min(Math.max(-1, dsdt), 1);
      speed = Math.round(this.speed + dsdt);
    } else speed = Math.round(this.manualSpeed);
    speed = Math.min(Math.max(2, speed), 12);
    this.e2 = this.e1; this.e1 = e;
    this.speed = speed;
    this.lastRow = row;

    // store frame (pre-shift), then shift the belt by `speed` rows
    this.frameFlow.set(flowN);
    const sh = speed * Nx;
    flowN.copyWithin(sh, 0, this.N - sh); flowN.fill(0, 0, sh);
    u.set(c); u.copyWithin(sh, 0, this.N - sh); u.fill(0, 0, sh);
    for (let q = 0; q < this.position.length; q++) this.position[q] += speed;

    const H = this.hist;
    H.T.push(Tobs + this.T0); H.F.push(Fobs); H.speed.push(speed); H.sp.push(this.Tsp + this.T0); H.D.push(drops);
    this.n++;
    return { Tobs: Tobs + this.T0, Fobs, speed, row };
  }
}
