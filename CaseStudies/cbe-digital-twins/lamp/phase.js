// Lava Lamp Digital Twin: liquid-liquid phase equilibrium ("Phase lab"). Pure functions, no graphics.
// NRTL activity coefficients, a tangent-plane stability test, and an isothermal two-liquid flash (Rachford-Rice),
// for any number of components. Compositions are mole fractions inside; helpers convert to and from masses.
// System data (interaction parameters, molar masses, densities) live in phase_data.js with their sources.

export const Rgas = 8.314462618;   // J/(mol K)

// tau and G matrices at temperature T (K) from a system definition:
//   sys.tau(i, j, T) returns tau_ij (dimensionless); sys.alpha[i][j] is the non-randomness factor
export function nrtlMatrices(sys, T) { const n = sys.names.length, tau = [], G = [];
  for (let i = 0; i < n; i++) { tau.push([]); G.push([]); for (let j = 0; j < n; j++) { const t = i === j ? 0 : sys.tau(i, j, T); tau[i].push(t); G[i].push(Math.exp(-(sys.alpha[i][j] || 0) * t)); } }
  return { tau, G, n }; }
// ln(gamma_i) by the NRTL equation (Renon and Prausnitz)
export function lnGamma(x, m) { const { tau, G, n } = m, S = new Array(n), C = new Array(n), out = new Array(n);
  for (let j = 0; j < n; j++) { let s = 0, c = 0; for (let k = 0; k < n; k++) { s += G[k][j] * x[k]; c += x[k] * tau[k][j] * G[k][j]; } S[j] = s; C[j] = c; }
  for (let i = 0; i < n; i++) { let v = C[i] / S[i]; for (let j = 0; j < n; j++) v += x[j] * G[i][j] / S[j] * (tau[i][j] - C[j] / S[j]); out[i] = v; }
  return out; }
// molar Gibbs energy of mixing divided by RT (ideal + excess)
export function gMix(x, m) { const lg = lnGamma(x, m); let g = 0; for (let i = 0; i < x.length; i++) if (x[i] > 1e-300) g += x[i] * (Math.log(x[i]) + lg[i]); return g; }

// Michelsen tangent-plane test. Returns { stable, W } where W is the best trial phase (unnormalised) if unstable.
export function stability(z, m) { const n = z.length, zz = z.map(v => Math.max(v, 1e-12)), lgz = lnGamma(zz, m), d = zz.map((v, i) => Math.log(v) + lgz[i]); let best = null;
  for (let s = 0; s < n; s++) { let W = zz.map((v, i) => i === s ? 0.98 : 0.02 / (n - 1));
    for (let it = 0; it < 400; it++) { const sum = W.reduce((a, b) => a + b, 0), w = W.map(v => v / sum), lg = lnGamma(w, m); let change = 0; const Wn = W.map((v, i) => { const nv = Math.exp(d[i] - lg[i]); change = Math.max(change, Math.abs(nv - v)); return nv; }); W = Wn; if (change < 1e-12) break; }
    const sum = W.reduce((a, b) => a + b, 0), w = W.map(v => v / sum), dist = Math.max(...w.map((v, i) => Math.abs(v - zz[i])));
    if (sum > 1 + 1e-8 && dist > 1e-5 && (!best || sum > best.sum)) best = { sum, W, w }; }
  return { stable: !best, W: best ? best.w : null }; }

function rachfordRice(z, Kv) { const f = b => z.reduce((s, zi, i) => s + zi * (Kv[i] - 1) / (1 + b * (Kv[i] - 1)), 0); if (f(0) <= 0 || f(1) >= 0) return null; let lo = 0, hi = 1; for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (f(mid) > 0) lo = mid; else hi = mid; } return (lo + hi) / 2; }
// Two-liquid flash at fixed T: overall mole fractions z. Returns { two: false } or { two: true, beta (mole fraction of the feed in phase II), xI, xII }.
// Phase I is the one richer in component `heavyIdx` (default 0, usually water).
export function lleFlash(z, m, opt = {}) { const n = z.length, st = stability(z, m); if (st.stable) return { two: false, x: z.slice() };
  let Kv = st.W.map((w, i) => w / Math.max(z[i], 1e-14)), beta = 0.5, xI = z.slice(), xII = st.W.slice(), ok = false;
  for (let it = 0; it < 2000; it++) { const b = rachfordRice(z, Kv); if (b == null) { // push the K-values apart from the trial phase and retry once
      if (it > 0) break; Kv = Kv.map(k => k > 1 ? k * 2 : k / 2); continue; }
    beta = b; xI = z.map((zi, i) => zi / (1 + beta * (Kv[i] - 1))); xII = xI.map((x, i) => x * Kv[i]); const sI = xI.reduce((a, c) => a + c, 0), sII = xII.reduce((a, c) => a + c, 0); xI = xI.map(v => v / sI); xII = xII.map(v => v / sII);
    const lI = lnGamma(xI, m), lII = lnGamma(xII, m); let ch = 0; const Kn = Kv.map((k, i) => { const nk = Math.exp(lI[i] - lII[i]); ch = Math.max(ch, Math.abs(Math.log(nk / k))); return nk; }); Kv = Kn; if (ch < 1e-11) { ok = true; break; } }
  if (!ok || Math.max(...xI.map((v, i) => Math.abs(v - xII[i]))) < 1e-6 || beta <= 1e-9 || beta >= 1 - 1e-9) return { two: false, x: z.slice(), failed: !ok };
  const h = opt.heavyIdx ?? 0; if (xI[h] < xII[h]) { [xI, xII] = [xII, xI]; beta = 1 - beta; }
  return { two: true, beta, xI, xII }; }

// ---------- conversions ----------
export const massToMole = (w, MW) => { const n = w.map((v, i) => v / MW[i]), s = n.reduce((a, b) => a + b, 0); return n.map(v => v / s); };
export const moleToMass = (x, MW) => { const w = x.map((v, i) => v * MW[i]), s = w.reduce((a, b) => a + b, 0); return w.map(v => v / s); };
// density of a liquid mixture assuming volumes add (kg/m3); w = mass fractions, rho = pure densities
export const mixDensity = (w, rho) => 1 / w.reduce((s, v, i) => s + v / rho[i], 0);

// Split of a feed given as masses (g): returns layers with mass, volume (mL, additive volumes), density and composition
export function splitMasses(masses, sys, T) { const m = nrtlMatrices(sys, T), tot = masses.reduce((a, b) => a + b, 0), w = masses.map(v => v / tot), z = massToMole(w, sys.MW), r = lleFlash(z, m, { heavyIdx: sys.heavyIdx ?? 0 });
  const layer = (x, molFrac) => { const wl = moleToMass(x, sys.MW), Mbar = x.reduce((s, v, i) => s + v * sys.MW[i], 0); return { x, w: wl, Mbar, molFrac, rho: mixDensity(wl, sys.rho) }; };
  if (!r.two) { const L = layer(z, 1); return { two: false, layers: [{ ...L, mass: tot, vol: tot / L.rho * 1000 }] }; }
  const A = layer(r.xI, 1 - r.beta), B = layer(r.xII, r.beta), mA = A.molFrac * A.Mbar, mB = B.molFrac * B.Mbar, fA = mA / (mA + mB);
  const out = [{ ...A, mass: tot * fA, vol: tot * fA / A.rho * 1000 }, { ...B, mass: tot * (1 - fA), vol: tot * (1 - fA) / B.rho * 1000 }]; out.sort((p, q) => q.rho - p.rho);   // bottom layer first
  return { two: true, layers: out, beta: r.beta }; }

// Binodal curve by marching: feeds on the line between an immiscible binary mixture (components a and b, equal moles) and pure solute s.
// Returns tie lines [{ xI, xII }] and an estimate of the plait point.
export function binodal(sys, T, a, b, s, steps = 60) { const m = nrtlMatrices(sys, T), n = sys.names.length, ties = []; let last = null;
  for (let k = 0; k <= steps * 4; k++) { const f = k / steps * 0.25 * 4 / 4, fs = k / (steps * 4) * 0.98, z = new Array(n).fill(0); z[s] = fs; z[a] = (1 - fs) / 2; z[b] = (1 - fs) / 2; void f; const r = lleFlash(z, m, { heavyIdx: a }); if (!r.two) { if (ties.length) break; else continue; } ties.push({ xI: r.xI, xII: r.xII, fs }); last = r; }
  const plait = last ? last.xI.map((v, i) => (v + last.xII[i]) / 2) : null; return { ties, plait }; }

// ====================== salt + isopropyl alcohol + water (measured boundary and tie-lines; mass fractions) ======================
// S = data object from phase_data.js. ws = salt, wa = alcohol; water is the rest.
export const saltBinodal = (S, ws) => Math.exp(S.A * ws * ws + S.B * ws + S.C);            // alcohol fraction on the two-liquid boundary
export const saltSatLine = (S, ws) => S.D * ws + S.E;                                      // beyond this line solid salt remains
export const saltDensity = (S, ws, wa) => 1 / ((1 - ws - wa) / S.rhoW + wa / S.rhoA + ws / S.rhoSapp);   // kg/m3, volumes taken as additive
// tie-line family: u = 0 is the plait point, u = 1 the saltiest measured tie-line; ends interpolated linearly between measured tie-lines
function saltNodes(S) { const t = S.ties.slice().sort((p, q) => p[0][0] - q[0][0]), s0 = S.plait.s, s1 = t[t.length - 1][0][0]; return [{ u: 0, aq: [S.plait.s, S.plait.a], org: [S.plait.s, S.plait.a] }, ...t.map(([aq, org]) => ({ u: (aq[0] - s0) / (s1 - s0), aq, org }))]; }
export function saltTie(S, u) { const N = saltNodes(S); u = Math.min(1, Math.max(0, u)); let k = 1; while (k < N.length - 1 && N[k].u < u) k++; const a = N[k - 1], b = N[k], f = (u - a.u) / (b.u - a.u || 1), mix = (p, q) => [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f]; return { aq: mix(a.aq, b.aq), org: mix(a.org, b.org) }; }
// feed given as masses in grams: water, alcohol, salt
export function saltSplit(S, mW, mA, mS) { const tot = mW + mA + mS; if (tot <= 0) return { kind: "empty", layers: [] };
  let ws = mS / tot, wa = mA / tot, solid = 0; const one = () => ({ kind: "one", solid, layers: [{ name: "one liquid", ws, wa, mass: tot - solid, rho: saltDensity(S, ws, wa), vol: (tot - solid) / saltDensity(S, ws, wa) * 1000 }] });
  // with almost no alcohol the limit is the solubility of salt in water
  if (wa < 0.02 && ws > S.solWater) { solid = (mS - S.solWater * (mW + mA) / (1 - S.solWater)); const t2 = tot - solid; ws = (mS - solid) / t2; wa = mA / t2; return { ...one(), kind: "one+solid" }; }
  // find the tie-line through the feed (scan the family, then bisect); inside the measured range this is interpolation between measured tie-lines
  const proj = (t, F) => { const dx = t.org[0] - t.aq[0], dy = t.org[1] - t.aq[1]; return ((F[0] - t.aq[0]) * dx + (F[1] - t.aq[1]) * dy) / (dx * dx + dy * dy || 1); };
  const cross = (u, F) => { const t = saltTie(S, u); return (t.org[0] - t.aq[0]) * (F[1] - t.aq[1]) - (t.org[1] - t.aq[1]) * (F[0] - t.aq[0]); };
  const find = F => { let prev = cross(0.01, F); for (let k = 1; k <= 200; k++) { const u1 = 0.01 + 0.99 * k / 200, c = cross(u1, F); if (prev === 0 || prev * c < 0) { let lo = 0.01 + 0.99 * (k - 1) / 200, hi = u1; for (let i = 0; i < 50; i++) { const mid = (lo + hi) / 2; if (cross(mid, F) * prev > 0) lo = mid; else hi = mid; } const u = (lo + hi) / 2, f = proj(saltTie(S, u), F); if (f > 0 && f < 1) return u; } prev = c; } return null; };
  let kind = "two", u = find([ws, wa]), beyond = false;
  if (u == null) { // not on any measured or interpolated tie-line: either one liquid, or past the saltiest measured tie-line (towards saturation)
    const t1 = saltTie(S, 1), f1 = proj(t1, [ws, wa]), side = cross(1, [ws, wa]); if (!(side < 0 && f1 > 0 && f1 < 1 && ws >= S.sMin)) return one(); u = 1; beyond = true; }
  if (wa > saltSatLine(S, ws)) { // remove salt until the liquid part sits on the saturation line
    let lo = 0, hi = mS; for (let i = 0; i < 60; i++) { const d = (lo + hi) / 2, t2 = mW + mA + d; if (mA / t2 > saltSatLine(S, d / t2)) hi = d; else lo = d; } const dis = (lo + hi) / 2; solid = mS - dis; const t2 = mW + mA + dis; ws = dis / t2; wa = mA / t2; kind = "two+solid"; u = find([ws, wa]) ?? 1; beyond = true; }
  const F = [ws, wa], t = saltTie(S, u), fOrg = Math.min(1, Math.max(0, proj(t, F))), liq = tot - solid;
  const L = (name, p, m) => ({ name, ws: p[0], wa: p[1], mass: m, rho: saltDensity(S, p[0], p[1]), vol: m / saltDensity(S, p[0], p[1]) * 1000 });
  return { kind, solid, u, beyond, tie: t, layers: [L("salty water layer (bottom)", t.aq, liq * (1 - fOrg)), L("alcohol layer (top)", t.org, liq * fOrg)] }; }
// grams of salt at which a second layer first appears, for given grams of water and alcohol; null if it never does
export function saltCloud(S, mW, mA) { const two = g => saltSplit(S, mW, mA, g).kind !== "one", gMax = 0.3 * (mW + mA); if (!two(gMax) && !two(gMax / 2) && !two(gMax / 4)) return null; let hi = [gMax / 4, gMax / 2, gMax].find(two), lo = 0; for (let i = 0; i < 50; i++) { const mid = (lo + hi) / 2; if (two(mid)) hi = mid; else lo = mid; } return hi; }
// piecewise-linear table lookup (used for the density of ethanol-water mixtures)
export const interp = (tab, x) => { if (x <= tab[0][0]) return tab[0][1]; for (let i = 1; i < tab.length; i++) if (x <= tab[i][0]) return tab[i - 1][1] + (tab[i][1] - tab[i - 1][1]) * (x - tab[i - 1][0]) / (tab[i][0] - tab[i - 1][0]); return tab[tab.length - 1][1]; };
