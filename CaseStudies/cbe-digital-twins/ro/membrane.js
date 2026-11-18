// Zooming past the element: the feed channel and membrane cross-section (millimetres to nanometres), and a molecular
// window into the polyamide active layer. Two tour stops with 3D models, live diagrams (inline SVG) and equations.
// Display geometry is NOT to scale where noted; true dimensions are given in the callouts and diagrams.
import * as THREE from "three";
import { PLANT, osmotic, SfromC, Dsalt, rhoW, K, pKaBoron } from "./models.js";

const LMH = 1e-3 / 3600, Rg = 8.314, VW = 1.8e-5;           // (m/s) per LMH, J/mol K, m³/mol partial molar volume of water
const f0 = v => Math.round(v).toLocaleString("en-US"), f1 = v => v.toFixed(1), f2 = v => v.toFixed(2), f3 = v => v.toFixed(3);
const sci = v => { const e = Math.floor(Math.log10(Math.abs(v))); return String.raw`\(${(v / 10 ** e).toFixed(2)}\times10^{${e}}\)`; };
const eq = (courses, html, note) => ({ courses, html, note });
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, ...o });
function add(parent, geo, m, x = 0, y = 0, z = 0) { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; parent.add(o); return o; }
function label(parts, name, x, y, z) { parts.push([name, new THREE.Vector3(x, y, z)]); }
function canvasTex(w, h, draw) { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
function rnd(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

// live numbers shared by the two stops (lead element, mid-length)
export function membraneState(st) {
  const E = st.lead, T = st.inp.T, S = st.Sf, D = Dsalt(SfromC(E.Cb, T), T), Jw = E.Jw * LMH, k = E.k;
  const delta = D / k, Cb = E.Cb, Cm = E.Cm, Cp = E.Cp;
  const A = st.mem.A * LMH / 1e5, B = st.mem.B * LMH, ell = 150e-9, RT = Rg * K(T);
  const DwKw = A * RT * ell / VW, DsKs = B * ell, pi = osmotic(S, T), aw = Math.exp(-pi * 1e5 * VW / RT);
  const rej = Bx => { const Bm = Bx * LMH; return Jw / (Jw + Bm); };      // intrinsic rejection relative to the wall
  return { E, T, S, D, Jw, k, delta, Cb, Cm, Cp, A, B, ell, RT, DwKw, DsKs, sel: DwKw / DsKs, pi, aw, piM: E.piM, ndp: E.ndp,
    rNaCl: rej(st.mem.B), rBA: rej(st.mem.Bba), rBor: rej(st.mem.Bbor), rObs: 1 - Cp / Cb, alpha: st.alpha, pH: st.inp.pH,
    coo: 1 / (1 + 10 ** (4.5 - st.inp.pH)), pKa: pKaBoron(S, T), Pf: E.Pin, Pp: PLANT.Pp };
}

// ===================================================================================
// 1. Feed channel and membrane cross-section (display in mm; layer thicknesses NOT to scale)
// ===================================================================================
export function membraneModel() {
  const g = new THREE.Group(), parts = [], W = 3.2, Dz = 2.4;
  const Y = { car: [0, 0.32], pet: [0.32, 0.64], psf: [0.64, 0.88], pa: [0.88, 0.93], ch0: 0.93, ch1: 1.64 };
  const side = c => mat(c);
  const face = (tex, c) => mat(c, { map: tex });
  // front-face cross-section textures (SEM-style sketches)
  const tricot = canvasTex(256, 64, (x, w, h) => { x.fillStyle = "#3b3f44"; x.fillRect(0, 0, w, h); x.strokeStyle = "#5a6066"; x.lineWidth = 3; for (let i = 0; i < w; i += 16) { x.beginPath(); x.ellipse(i + 8, h / 2, 7, h / 2 - 6, 0, 0, 7); x.stroke(); } });
  const pet = canvasTex(256, 64, (x, w, h) => { x.fillStyle = "#efe9d8"; x.fillRect(0, 0, w, h); const r = rnd(3); for (let i = 0; i < 70; i++) { x.fillStyle = r() < 0.5 ? "#d9d0b8" : "#fbf7ec"; x.beginPath(); x.arc(r() * w, r() * h, 3 + r() * 5, 0, 7); x.fill(); x.strokeStyle = "#c9bf9f"; x.stroke(); } });
  const psf = canvasTex(256, 64, (x, w, h) => { x.fillStyle = "#d7dadd"; x.fillRect(0, 0, w, h); x.fillStyle = "#8f979e"; const r = rnd(9);
    for (let i = 4; i < w; i += 11) { const top = 10 + r() * 6, wd = 3 + r() * 3; x.beginPath(); x.moveTo(i, top); x.quadraticCurveTo(i + wd * 1.5, h * 0.6, i + wd * 0.5, h); x.lineTo(i - wd * 0.5, h); x.quadraticCurveTo(i - wd * 1.5, h * 0.6, i, top); x.fill(); }
    for (let i = 0; i < 160; i++) { x.fillStyle = "#b9bec3"; x.fillRect(r() * w, r() * 9, 1.5, 1.5); } });
  const box = (y0, y1, c, tex, name) => { const h = y1 - y0, m = [side(c), side(c), side(c), side(c), tex ? face(tex, "#ffffff") : side(c), side(c)];
    const o = add(g, new THREE.BoxGeometry(W, h, Dz), m, 0, (y0 + y1) / 2, 0); o.name = name; return o; };
  box(...Y.car, "#3b3f44", tricot, "carrier"); box(...Y.pet, "#efe9d8", pet, "polyester"); box(...Y.psf, "#d7dadd", psf, "polysulfone");
  // polyamide: thin skin with ridge-and-valley top surface
  { const geo = new THREE.PlaneGeometry(W, Dz, 96, 72).rotateX(-Math.PI / 2), p = geo.attributes.position, r = rnd(5);
    const bumps = Array.from({ length: 90 }, () => [r() * W - W / 2, r() * Dz - Dz / 2, 0.06 + r() * 0.08, 0.008 + r() * 0.02]);
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); let y = 0; for (const [bx, bz, s, a] of bumps) y += a * Math.exp(-((x - bx) ** 2 + (z - bz) ** 2) / (s * s)); p.setY(i, Y.pa[1] + Math.min(0.045, y)); }
    geo.computeVertexNormals();
    const pa = new THREE.Group(); pa.name = "polyamide"; g.add(pa);
    add(pa, geo, mat("#e8c46a", { roughness: 0.35, side: THREE.DoubleSide }));
    add(pa, new THREE.BoxGeometry(W, Y.pa[1] - Y.pa[0], Dz), mat("#e2bd5c"), 0, (Y.pa[0] + Y.pa[1]) / 2, 0); }
  // feed spacer: two layers of filaments at ±45° (polypropylene), each trimmed to the block edges
  const spM = mat("#3f86d6", { roughness: 0.4 });
  const sp = new THREE.Group(); sp.name = "spacer"; g.add(sp);
  const rf = (Y.ch1 - Y.ch0) / 4 * 0.92;
  for (const [lay, ang] of [[0, Math.PI / 4], [1, -Math.PI / 4]]) for (let k = -6; k <= 6; k++) {
    const dx = Math.cos(ang), dz = -Math.sin(ang), px = -dz * k * 0.75, pz = dx * k * 0.75;
    let t0 = -1e9, t1 = 1e9;
    for (const [p, d, lim] of [[px, dx, W / 2 - 0.02], [pz, dz, Dz / 2 - 0.02]]) { const a = (-lim - p) / d, b = (lim - p) / d; t0 = Math.max(t0, Math.min(a, b)); t1 = Math.min(t1, Math.max(a, b)); }
    if (t1 - t0 < 0.2) continue;
    const tm = (t0 + t1) / 2, o = add(sp, new THREE.CylinderGeometry(rf, rf, t1 - t0, 16).rotateZ(Math.PI / 2), spM, px + dx * tm, Y.ch0 + (Y.ch1 - Y.ch0) / 4 + lay * (Y.ch1 - Y.ch0) / 2, pz + dz * tm);
    o.rotation.y = ang;
  }
  // concentration boundary layer: stacked translucent sheets, thickness from δ = D/k (scaled with the channel)
  const bl = new THREE.Group(); bl.name = "boundary"; g.add(bl); const blM = [];
  for (let i = 0; i < 8; i++) { const m = new THREE.MeshBasicMaterial({ color: "#7a2fa8", transparent: true, opacity: 0.16 * (1 - i / 8), depthWrite: false, side: THREE.DoubleSide });
    const o = new THREE.Mesh(new THREE.PlaneGeometry(W, Dz).rotateX(-Math.PI / 2), m); o.position.y = Y.ch0 + 0.01 + i / 8; bl.add(o); blM.push(o); }
  // the facing leaf of the next envelope, semi-transparent
  const top = add(g, new THREE.BoxGeometry(W, 0.05, Dz), mat("#f4f2ea", { transparent: true, opacity: 0.35, depthWrite: false }), 0, Y.ch1 + 0.025, 0); top.name = "nextleaf"; top.castShadow = false;
  // tracers: salt ions (purple) carried along x and crowding at the wall; water (cyan) permeating down into the carrier
  const mk = (n, color, size) => { const pos = new Float32Array(n * 3), geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const p = new THREE.Points(geo, new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.95, depthWrite: false })); p.frustumCulled = false; g.add(p); return { pos, geo, n, u: new Float32Array(n).map(Math.random), a: new Float32Array(n).map(Math.random), b: new Float32Array(n).map(Math.random) }; };
  const salt = mk(900, "#8e3fbf", 0.03), water = mk(400, "#3fc6e8", 0.028);
  const H = Y.ch1 - Y.ch0;
  label(parts, "Feed channel, 0.71 mm (28 mil)", -1.2, Y.ch0 + H * 0.75, Dz / 2);
  label(parts, "Feed spacer (PP) mixes the flow", 0.6, Y.ch0 + rf, 0.2);
  label(parts, "Boundary layer, δ = D/k", 1.1, Y.ch0 + 0.05, Dz / 2);
  label(parts, "Polyamide, 0.1–0.2 µm, ridge-and-valley", -0.4, Y.pa[1] + 0.02, Dz / 2);
  label(parts, "Polysulfone support ≈ 40 µm, not selective", 0.9, (Y.psf[0] + Y.psf[1]) / 2, Dz / 2);
  label(parts, "Polyester backing ≈ 100 µm", -0.9, (Y.pet[0] + Y.pet[1]) / 2, Dz / 2);
  label(parts, "Permeate carrier (tricot) ≈ 0.25 mm", 0.2, (Y.car[0] + Y.car[1]) / 2, Dz / 2);
  label(parts, "Next leaf (membrane on both sides)", -0.4, Y.ch1 + 0.05, 0);
  return {
    group: g, parts, fit: 4.6, explodeAxis: "y", camDir: [0.45, 0.42, 0.9],
    update(dt, live) {
      const m = live.m; if (!m) return;
      const dDisp = Math.min(0.9, m.delta / (PLANT.spacerH)) * H, cpx = m.Cm / m.Cb;      // displayed δ, true fraction of the channel
      blM.forEach((o, i) => { o.position.y = Y.ch0 + 0.004 + dDisp * i / 8; o.material.opacity = Math.min(0.5, 0.22 * (cpx - 1) / 0.15) * (1 - i / 8); });
      const u = 0.35 * (m.E.u / 0.17);
      for (let i = 0; i < salt.n; i++) {
        // sample height so that density follows C(y) = Cb + (Cm − Cb) exp(−y/δ) in display units
        const yy = salt.b[i] < (cpx - 1) / (cpx - 1 + 3) ? -Math.log(1 - salt.a[i] * 0.95) * dDisp * 0.6 : salt.a[i] * H;
        const v = u * (0.25 + 4 * Math.min(1, yy / H) * (1 - Math.min(1, yy / H)));
        salt.u[i] += dt * v / W; if (salt.u[i] > 1) salt.u[i] -= 1;
        salt.pos.set([-W / 2 + salt.u[i] * W, Y.ch0 + 0.01 + Math.min(H - 0.02, yy), -Dz / 2 + ((i * 0.618) % 1) * Dz], i * 3);
      }
      const vw = 0.12 * (m.E.Jw / 14);
      for (let i = 0; i < water.n; i++) {
        water.u[i] += dt * vw; if (water.u[i] > 1) { water.u[i] -= 1; water.a[i] = Math.random(); water.b[i] = Math.random(); }
        const t = water.u[i], x = -W / 2 + water.a[i] * W, z = -Dz / 2 + water.b[i] * Dz;
        const y = t < 0.85 ? Y.ch0 + 0.2 - (t / 0.85) * (Y.ch0 + 0.2 - Y.car[1] * 0.5) : Y.car[1] * 0.5;
        water.pos.set([t < 0.85 ? x : x + (t - 0.85) * 6, y, z], i * 3);
      }
      salt.geo.attributes.position.needsUpdate = water.geo.attributes.position.needsUpdate = true;
    },
  };
}

// ===================================================================================
// 2. Molecular window into the polyamide (display in nm): a 3 nm slab of a 150 nm layer
// ===================================================================================
export function molecularModel() {
  const g = new THREE.Group(), parts = [], X = 3.6, Z = 2.2, T0 = 0, T1 = 3, FEED = 7, PERM = -3;
  const r = rnd(11);
  // cross-linked network: trifunctional (TMC) and difunctional (MPD) nodes joined by amide bonds
  const net = new THREE.Group(); net.name = "polyamide"; g.add(net);
  const nodes = [], nN = 80;
  for (let i = 0; i < nN; i++) nodes.push(new THREE.Vector3((r() * 2 - 1) * X, T0 + 0.2 + r() * (T1 - T0 - 0.4), (r() * 2 - 1) * Z));
  const tmcM = mat("#d9a63a", { roughness: 0.4 }), mpdM = mat("#5b7fbf", { roughness: 0.4 }), bondM = mat("#c8c2b0", { roughness: 0.5 });
  const sph = new THREE.SphereGeometry(0.13, 14, 10), bondG = new THREE.CylinderGeometry(0.04, 0.04, 1, 8);
  nodes.forEach((p, i) => add(net, sph, i % 2 ? mpdM : tmcM, p.x, p.y, p.z));
  const seen = new Set();
  nodes.forEach((p, i) => {
    const near = nodes.map((q, j) => [p.distanceTo(q), j]).filter(([d, j]) => j !== i).sort((a, b) => a[0] - b[0]).slice(0, i % 2 ? 2 : 3);
    for (const [d, j] of near) { const key = Math.min(i, j) + "-" + Math.max(i, j); if (seen.has(key) || d > 1.6) continue; seen.add(key);
      const o = add(net, bondG, bondM); o.position.copy(p).add(nodes[j]).multiplyScalar(0.5); o.scale.y = d; o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), nodes[j].clone().sub(p).normalize()); }
  });
  // unreacted carboxylic groups at the surface, ionised (–COO⁻) at seawater pH
  const cooM = mat("#d64545", { emissive: "#5a0000", emissiveIntensity: 0.4 });
  for (let i = 0; i < 12; i++) add(net, new THREE.SphereGeometry(0.1, 10, 8), cooM, (r() * 2 - 1) * X, T1 - 0.05 + r() * 0.15, (r() * 2 - 1) * Z);
  // translucent slab outline
  const slab = add(g, new THREE.BoxGeometry(2 * X, T1 - T0, 2 * Z), mat("#e8c46a", { transparent: true, opacity: 0.08, depthWrite: false }), 0, (T0 + T1) / 2, 0); slab.castShadow = false; slab.name = "slab";
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(2 * X, T1 - T0, 2 * Z)), new THREE.LineBasicMaterial({ color: "#b38a2a" })); edges.position.y = (T0 + T1) / 2; g.add(edges); edges.userData.noExplode = true;
  // molecules: water (instanced O and H), hydrated Na⁺ and Cl⁻, boric acid
  const nW = 160, O = new THREE.InstancedMesh(new THREE.SphereGeometry(0.15, 10, 8), mat("#e04848", { roughness: 0.3 }), nW), Hh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 8, 6), mat("#f4f4f4", { roughness: 0.3 }), nW * 2);
  g.add(O, Hh); O.frustumCulled = Hh.frustumCulled = false;
  const W = Array.from({ length: nW }, () => ({ p: new THREE.Vector3((r() * 2 - 1) * X, PERM + r() * (FEED - PERM), (r() * 2 - 1) * Z), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 6, r() * 6, r() * 6)) }));
  const ion = (core, rc, rs, n, sign) => Array.from({ length: n }, () => { const grp = new THREE.Group(); g.add(grp);
    add(grp, new THREE.SphereGeometry(rc, 16, 12), mat(core, { roughness: 0.3 }));
    const sh = add(grp, new THREE.SphereGeometry(rs, 20, 14), mat("#9fd8ff", { transparent: true, opacity: 0.18, depthWrite: false })); sh.castShadow = false;
    grp.position.set((r() * 2 - 1) * X, T1 + 0.5 + r() * (FEED - T1 - 0.5), (r() * 2 - 1) * Z); grp.userData.noExplode = true; return { o: grp, rs, sign, state: 0 }; });
  const na = ion("#8e44ad", 0.10, 0.36, 7, 1), cl = ion("#2ecc71", 0.18, 0.33, 7, -1);
  const ba = Array.from({ length: 5 }, () => { const grp = new THREE.Group(); g.add(grp); add(grp, new THREE.SphereGeometry(0.1, 12, 8), mat("#f08bb4"));
    for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; add(grp, new THREE.SphereGeometry(0.12, 10, 8), mat("#e04848"), Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2); }
    grp.position.set((r() * 2 - 1) * X, T1 + 0.5 + r() * (FEED - T1 - 0.5), (r() * 2 - 1) * Z); grp.userData.noExplode = true; return { o: grp, state: 0 }; });
  label(parts, "TMC + MPD network: 3 nm of a ≈ 150 nm layer", -2.6, 1.5, Z);
  label(parts, "–COO⁻ groups: negative surface", 1.8, T1, Z);
  label(parts, "Water: dissolves, then diffuses", -1.5, 5.2, 0);
  label(parts, "Hydrated Na⁺, ≈ 0.72 nm", 2.2, 5.5, 0);
  label(parts, "Hydrated Cl⁻, ≈ 0.66 nm", -2.4, 4.4, 0);
  label(parts, "B(OH)₃: neutral, partly passes", 0.5, 6.2, 0);
  label(parts, "Feed side (C_m)", 3.2, 6.8, -Z);
  label(parts, "Permeate side", 3.2, -2.5, -Z);
  const m4 = new THREE.Matrix4(), e = new THREE.Vector3(), hq = new THREE.Vector3(), S1 = new THREE.Vector3(1, 1, 1);
  const wrap = p => { if (p.x > X) p.x -= 2 * X; if (p.x < -X) p.x += 2 * X; if (p.z > Z) p.z = Z - (p.z - Z); if (p.z < -Z) p.z = -Z - (p.z + Z); };
  const jiggle = (p, s, dt) => { p.x += (Math.random() - 0.5) * s * Math.sqrt(dt) * 3; p.y += (Math.random() - 0.5) * s * Math.sqrt(dt) * 3; p.z += (Math.random() - 0.5) * s * Math.sqrt(dt) * 3; };
  return {
    group: g, parts, fit: 13, explodeAxis: "y", camDir: [0.35, 0.3, 0.9],
    update(dt, live) {
      const m = live.m; if (!m) return; dt = Math.min(dt, 0.05);
      const drift = 0.8 * (m.E.Jw / 14);
      W.forEach((w, i) => {
        const p = w.p, inM = p.y < T1 && p.y > T0;
        jiggle(p, inM ? 0.25 : 0.7, dt); p.y -= drift * dt * (inM ? 1.4 : 1); wrap(p);
        if (p.y < PERM) { p.y = FEED; p.x = (Math.random() * 2 - 1) * X; }
        if (p.y > FEED) p.y = FEED;
        w.q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(dt * 3, dt * 2, 0)));
        m4.compose(p, w.q, S1); O.setMatrixAt(i, m4);
        for (const [k, s] of [[0, 1], [1, -1]]) { hq.set(0.09 * s, 0.07, 0).applyQuaternion(w.q).add(p); m4.compose(hq, w.q, S1); Hh.setMatrixAt(i * 2 + k, m4); }
      });
      O.instanceMatrix.needsUpdate = Hh.instanceMatrix.needsUpdate = true;
      // ions bounce off the surface; passage probability per contact scaled from the model's salt passage (exaggerated)
      const pIon = Math.min(0.5, 40 * (1 - m.rNaCl)), pBA = Math.min(0.9, 1.2 * (1 - m.rBA));
      for (const it of [...na, ...cl].map(o => ({ ...o, p: pIon, shell: o.rs })).concat(ba.map(o => ({ ...o, p: pBA, shell: 0.3 })))) {
        const src = [...na, ...cl, ...ba].find(o => o.o === it.o), P = it.o.position;
        if (src.state === 0) {
          jiggle(P, 0.7, dt); P.y -= drift * 0.4 * dt; wrap(P);
          if (P.y < T1 + it.shell) { if (Math.random() < it.p * dt * 6) src.state = 1; else P.y = T1 + it.shell + (T1 + it.shell - P.y); }
          if (P.y > FEED) P.y = FEED;
        } else {
          jiggle(P, 0.15, dt); P.y -= drift * 0.9 * dt; wrap(P);
          if (P.y < PERM) { P.set((Math.random() * 2 - 1) * X, FEED, (Math.random() * 2 - 1) * Z); src.state = 0; }
        }
      }
    },
  };
}

// ===================================================================================
// diagrams (inline SVG coloured from the page's tokens)
// ===================================================================================
const svg = (w, h, body) => `<svg viewBox="0 0 ${w} ${h}" role="img" style="width:100%;height:auto;display:block;font:11px var(--font-data);fill:var(--ink-2)">${body}</svg>`;
const T = (x, y, s, o = "") => `<text x="${x}" y="${y}" ${o}>${s}</text>`;
function ladder() {
  const items = [["H₂O", 2.8e-10], ["Polyamide", 1.5e-7], ["Support", 4e-5], ["Channel", 7.1e-4], ["Element", 1.016], ["Vessel", 7.9], ["Plant", 470]];
  const x = v => 20 + (Math.log10(v) + 10) / 13 * 290;
  let b = `<line x1="20" y1="40" x2="310" y2="40" stroke="var(--rule)" stroke-width="2"/>`;
  for (const [n, v] of [["1 nm", 1e-9], ["1 µm", 1e-6], ["1 mm", 1e-3], ["1 m", 1], ["1 km", 1e3]]) b += `<line x1="${x(v)}" y1="36" x2="${x(v)}" y2="44" stroke="var(--ink-2)"/>` + T(x(v), 58, n, 'text-anchor="middle"');
  items.forEach(([n, v], i) => { b += `<circle cx="${x(v)}" cy="40" r="4" fill="var(--accent)"/>` + T(x(v), i % 2 ? 26 : 16, n, 'text-anchor="middle" style="fill:var(--ink)"'); });
  return { title: "Scales: water molecule to plant, 12 decades (log)", svg: svg(330, 64, b) };
}
function cpProfile(m) {
  // broken y-axis: the upper band spans the bulk-to-wall rise, the lower band holds the near-zero permeate
  const w = 330, h = 176, x0 = 70, x1 = 318, yb = 150, yt = 22, yu = 112, L = 3 * m.delta, dC = m.Cm - m.Cb;
  const lo = m.Cb - 0.9 * dC, hi = m.Cm + 0.35 * dC;
  const X = y => x0 + y / L * (x1 - x0), Y = c => yu - (c - lo) / (hi - lo) * (yu - yt), yP = yb - 8;
  let path = "";
  for (let i = 0; i <= 60; i++) { const y = L * i / 60, c = y < m.delta ? m.Cp + (m.Cm - m.Cp) * Math.exp(-m.Jw * y / m.D) : m.Cb; path += (i ? "L" : "M") + X(y).toFixed(1) + " " + Y(c).toFixed(1); }
  let b = `<rect x="52" y="${yt}" width="16" height="${yb - yt}" fill="#e2bd5c"/>` + T(60, yb + 14, "membrane", 'text-anchor="middle"');
  b += `<line x1="${x0}" y1="${yb}" x2="${x1}" y2="${yb}" stroke="var(--rule)"/><line x1="${X(m.delta)}" y1="${yt}" x2="${X(m.delta)}" y2="${yb}" stroke="var(--ink-2)" stroke-dasharray="3 3"/>`;
  b += `<rect x="${x0}" y="${yt}" width="${X(m.delta) - x0}" height="${yb - yt}" fill="var(--accent)" opacity="0.06"/>`;
  for (const xx of [24, 40]) b += `<path d="M${xx} ${yu + 4} l6 -4 M${xx} ${yu + 9} l6 -4" stroke="var(--ink-2)"/>`;   // axis break marks
  b += `<path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2"/>`;
  b += `<line x1="6" y1="${yP}" x2="52" y2="${yP}" stroke="var(--series-a)" stroke-width="2"/>` + T(6, yP - 5, `C<tspan dy="3" font-size="8">p</tspan><tspan dy="-3"> ${f2(m.Cp)} g/L</tspan>`, 'style="fill:var(--ink)"');
  b += T(x0 + 6, Y(m.Cm) - 7, `C<tspan dy="3" font-size="8">m</tspan><tspan dy="-3"> ${f1(m.Cm)} g/L</tspan>`, 'style="fill:var(--ink)"') + T(x1 - 4, Y(m.Cb) - 6, `C<tspan dy="3" font-size="8">b</tspan><tspan dy="-3"> ${f1(m.Cb)} g/L</tspan>`, 'text-anchor="end" style="fill:var(--ink)"');
  b += T(X(m.delta) + 4, yb - 6, `δ = D/k = ${f0(m.delta * 1e6)} µm`) + T(x1, yb + 14, `${f0(L * 1e6)} µm from the wall →`, 'text-anchor="end"');
  b += T(6, 12, "permeate side") + T(x1 - 2, 12, "feed side", 'text-anchor="end"');
  return { title: "Concentration polarisation, lead element (broken axis): salt piles up at the wall until back-diffusion balances it", svg: svg(w, h, b) };
}
function sdProfile(m) {
  const w = 330, h = 190, xa = 110, xb = 190, L = 20, R = 318;
  let b = `<rect x="${xa}" y="10" width="${xb - xa}" height="${h - 32}" fill="#e2bd5c" opacity="0.35"/>` + T((xa + xb) / 2, h - 8, `polyamide, ℓ ≈ 150 nm`, 'text-anchor="middle"') + T(L, h - 8, "feed") + T(R, h - 8, "permeate", 'text-anchor="end"');
  const rows = [
    ["Pressure p", [[L, 30], [xb, 30], [xb, 58], [R, 58]], `${f1(m.Pf)} bar`, `${f1(m.Pp)} bar`, "uniform inside: the drop is at the permeate face"],
    ["Water chemical potential μ_w", [[L, 88], [xa, 88], [xb, 112], [R, 112]], "high", "low", "falls smoothly: water diffuses down its gradient"],
    ["Salt concentration", [[L, 132], [xa, 132], [xa, 142], [xb, 160], [R, 160]], `C_m ${f1(m.Cm)}`, `C_p ${f2(m.Cp)}`, "K_s·C_m → K_s·C_p inside (K_s ≪ 1)"],
  ];
  for (const [n, pts, a, c, note] of rows) {
    b += `<polyline points="${pts.map(p => p.join(",")).join(" ")}" fill="none" stroke="var(--accent)" stroke-width="2"/>`;
    b += T(L, pts[0][1] - 6, n, 'style="fill:var(--ink)"') + T(L + 2, pts[0][1] + 12, a) + T(R, pts.at(-1)[1] - 6, c, 'text-anchor="end"');
  }
  b += T(R, 22, `Δπ = ${f1(m.piM)} bar at the wall`, 'text-anchor="end"');
  return { title: "Solution–diffusion (Wijmans & Baker 1995): pressure uniform inside; water diffuses down a chemical-potential gradient, no pore flow", svg: svg(w, h, b) };
}
function sizes() {
  const sc = 70, it = [["H₂O", 0.28, "#e04848", 30], ["Cl⁻(aq)", 0.66, "#2ecc71", 92], ["Na⁺(aq)", 0.72, "#8e44ad", 160], ["small pore", 0.4, "none", 228], ["large pore", 0.8, "none", 294]];
  let b = "";
  for (const [n, d, c, x] of it) b += `<circle cx="${x}" cy="40" r="${d * sc / 2}" fill="${c}" ${c === "none" ? 'stroke="var(--ink-2)" stroke-dasharray="3 2"' : 'opacity="0.75"'}/>` + T(x, 88, n, 'text-anchor="middle" font-size="10" style="fill:var(--ink)"') + T(x, 101, `${d} nm`, 'text-anchor="middle" font-size="10"');
  return { title: "To scale: hydrated ions (Nightingale 1959) vs polyamide pores from positron annihilation (Typical). Charge and dehydration energy matter, not size alone", svg: svg(330, 106, b) };
}
function rejBars(m) {
  const rows = [["NaCl, intrinsic (vs wall)", m.rNaCl], ["NaCl, observed (vs bulk)", m.rObs], ["Borate B(OH)₄⁻", m.rBor], ["Boric acid B(OH)₃", m.rBA], ["Water", 0]];
  let b = ""; const x0 = 0, x1 = 270;
  rows.forEach(([n, v], i) => { const y = 4 + i * 30; b += T(0, y + 9, n, 'style="fill:var(--ink)"') + `<rect x="${x0}" y="${y + 13}" width="${x1 - x0}" height="10" fill="var(--chip)"/><rect x="${x0}" y="${y + 13}" width="${(x1 - x0) * v}" height="10" fill="var(--accent)"/>` + T(x1 + 6, y + 22, `${f1(v * 100)} %`); });
  return { title: `Lead-element rejection, \\(R = J_w/(J_w + B)\\). pH ${f2(m.pH)}: ${f0(m.alpha * 100)} % of boron is borate`, svg: svg(330, 154, b) };
}

// ===================================================================================
// the two tour stops
// ===================================================================================
export const MEMBRANE_STOPS = [
  {
    id: "membrane", title: "Feed channel and membrane", where: "Zoom: 3 mm of one leaf, layers not to scale", model: membraneModel,
    role: "Feed flows in a 0.71 mm channel held open by a plastic net. Membrane = fabric backing + porous support + a selective film ≈ 1000× thinner than a hair. Rejected salt piles up at the film, so the pump works harder.",
    specs: [["Feed channel", "0.71 mm (28 mil), spacer porosity 0.89", "D"], ["Polyamide skin", "0.1–0.2 µm, ridge-and-valley", "T"], ["Polysulfone support", "≈ 40 µm, finger-like voids", "T"], ["Polyester backing", "≈ 100 µm non-woven", "T"], ["Permeate carrier", "Tricot, ≈ 0.25 mm", "T"], ["Display", String.raw`Layers exaggerated; \(\delta\) to scale with the channel`, "D"]],
    live: c => { const m = membraneState(c.st); return { rows: [[String.raw`Boundary layer \(\delta = D/k\)`, `${f0(m.delta * 1e6)} µm (${f0(m.delta / PLANT.spacerH * 100)} % of channel)`], ["Wall vs bulk salinity", `${f1(m.Cm)} vs ${f1(m.Cb)} g/L (×${f3(m.Cm / m.Cb)})`], ["Water flux", `${f1(m.E.Jw)} LMH = ${f2(m.Jw * 1e6)} µm/s`], ["Crossflow / permeation speed", `${f3(m.E.u)} m/s / ${f2(m.Jw * 1e6)} µm/s = ${f0(m.E.u / m.Jw)}`], ["Net driving pressure", `${f1(m.ndp)} bar`]], m }; },
    diagrams: c => { const m = membraneState(c.st); return [ladder(), cpProfile(m), sdProfile(m)]; },
    thermo: c => { const m = membraneState(c.st);
      return [
        eq(["CBE 426", "CBE 320"], String.raw`\begin{aligned} J_w C - D\,\dfrac{dC}{dy} &= J_w C_p \\ \Rightarrow\; C(y) - C_p &= (C_m - C_p)\,e^{-J_w y/D} \end{aligned}`, String.raw`Convection to the wall = back-diffusion + leakage. \(D\) = ${sci(m.D)} m²/s, \(J_w\) = ${f2(m.Jw * 1e6)} µm/s → decay length \(D/J_w\) = ${f0(m.D / m.Jw * 1e6)} µm > \(\delta\) = ${f0(m.delta * 1e6)} µm: mild, \(C_m/C_b\) = ${f3(m.Cm / m.Cb)}.`),
        eq(["CBE 320", "CBE 426"], String.raw`\delta = \dfrac{D}{k},\qquad k = \dfrac{\mathrm{Sh}\,D}{d_h}`, String.raw`Sh = ${f1(m.E.Sh)}, \(k\) = ${f0(m.k * 3.6e6)} LMH → \(\delta\) = ${f0(m.delta * 1e6)} µm. Spacers and crossflow thin it; slower tail elements have thicker films.`),
        eq(["CBE 426"], String.raw`\Delta\pi_{\mathrm{eff}} = \pi(C_m) - \pi(C_p),\qquad \mathrm{NDP} = \Delta p - \Delta\pi_{\mathrm{eff}}`, `Pump beats the wall value, ${f1(m.piM)} bar, not the bulk. Polarisation costs ${f2(osmotic(SfromC(m.Cm, m.T), m.T) - osmotic(SfromC(m.Cb, m.T), m.T))} bar.`),
        eq(["CBE 320"], String.raw`\mathrm{Re} = \dfrac{\rho\,u\,d_h}{\mu},\qquad \dfrac{u}{J_w}`, `Re = ${f0(m.E.Re)}: laminar; spacers shed eddies. Crossflow is ${f0(m.E.u / m.Jw)}× the permeation speed.`),
      ]; },
  },
  {
    id: "molecular", title: "Inside the polyamide", where: "Zoom: a 3 nm window of the active layer", model: molecularModel,
    role: "A tangled polymer net with gaps a few water molecules wide. Water dissolves in and hops through. Charged, hydrated salt ions are mostly turned back; small, neutral boric acid slips through more.",
    specs: [["Chemistry", "MPD + TMC, interfacial polymerisation", "T"], ["Thickness", "≈ 150 nm (used in derived coefficients)", "D"], ["Free volume", "Pores ≈ 0.4 nm (network), ≈ 0.8 nm (aggregate), PALS", "T"], ["Surface charge", String.raw`–COO⁻, \(\mathrm{p}K_a\) ≈ 4.5: ionised at seawater pH`, "T"], ["Water uptake", "≈ 10–20 % by mass", "T"], ["Display", "Schematic; salt passage ≈ 10⁴× exaggerated", "D"]],
    live: c => { const m = membraneState(c.st); return { rows: [["Feed water activity", String.raw`\(a_w\) = ${f3(m.aw)}`], [String.raw`\(D_wK_w\) (water)`, `${sci(m.DwKw)} m²/s`], [String.raw`\(D_sK_s\) (salt)`, `${sci(m.DsKs)} m²/s`], ["Water/salt selectivity", `${sci(m.sel)}`], ["Ionised carboxyl groups", `${f0(m.coo * 100)} % at pH ${f2(m.pH)}`]], m }; },
    diagrams: c => { const m = membraneState(c.st); return [sizes(), rejBars(m)]; },
    thermo: c => { const m = membraneState(c.st);
      return [
        eq(["CBE 310", "CBE 311"], String.raw`\mu_w = \mu_w^{\circ} + RT\ln a_w + \bar{V}_w\,(p - p^{\circ})`, String.raw`Salt lowers \(a_w\) to ${f3(m.aw)}. Equal \(\mu_w\) at equilibrium defines \(\pi = -(RT/\bar{V}_w)\ln a_w\) = ${f1(m.pi)} bar; \(\Delta p > \pi\) drives water across.`),
        eq(["CBE 426"], String.raw`J_w = \dfrac{D_w K_w \bar{V}_w}{\ell R T}\,(\Delta p - \Delta\pi) = A\,(\Delta p - \Delta\pi)`, String.raw`Water dissolves (\(K_w\)) and diffuses (\(D_w\)). \(A\) = ${f2(c.st.mem.A)} LMH/bar, \(\ell\) = 150 nm → \(D_wK_w\) = ${sci(m.DwKw)} m²/s; at 15 % uptake \(D_w\) ≈ ${sci(m.DwKw / 0.15)} m²/s, ≈ 1/5 of bulk self-diffusion.`),
        eq(["CBE 426"], String.raw`J_s = \dfrac{D_s K_s}{\ell}\,(C_m - C_p) = B\,\Delta C`, String.raw`\(B\) = ${f3(c.st.mem.B)} LMH → \(D_sK_s\) = ${sci(m.DsKs)} m²/s. Selectivity \(D_wK_w/D_sK_s\) ≈ ${sci(m.sel)}, mostly from the tiny \(K_s\).`),
        eq(["CBE 311", "CBE 547"], String.raw`K_s \propto \exp\!\left(-\dfrac{\Delta G_{\mathrm{dehyd}}}{RT}\right)\cdot(\text{Donnan exclusion})`, `Ions must shed hydration (Na⁺ 0.72 nm vs ≈ 0.4 nm gaps) and face fixed charge: ${f0(m.coo * 100)} % of –COO⁻ ionised at pH ${f2(m.pH)} excludes Cl⁻; Na⁺ follows (electroneutrality).`),
        eq(["CBE 311"], String.raw`\mathrm{B(OH)_3 + H_2O \rightleftharpoons B(OH)_4^- + H^+},\qquad \mathrm{p}K^{*} = ${f2(m.pKa)}`, `Neutral boric acid: no shell, no charge. Intrinsic rejection ${f1(m.rBA * 100)} % vs ${f1(m.rBor * 100)} % for borate.`),
        eq(["CBE 540"], String.raw`n\,\mathrm{MPD} + m\,\mathrm{TMC} \rightarrow \text{polyamide} + \mathrm{HCl};\quad \text{cross-linking degree} \approx 0.6\text{--}0.9`, "Water/hexane interface, diffusion-limited: film self-limits at ≈ 100–200 nm, ridge-and-valley. Unreacted acyl chlorides hydrolyse to charged –COOH."),
      ]; },
  },
];
