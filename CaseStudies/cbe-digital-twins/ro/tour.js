// Equipment tour for the SWRO twin: stops (where to fly, what the unit does, its specification, live readings from the
// models, the course-level equations with live numbers) and detailed procedural 3D cutaway models shown in a separate viewer.
// Detailed models are at true size in metres. Spec values tagged "Twin" are the design basis the twin's models use (each
// itself a Typical industry choice); "Typical" values are representative industry figures the model does not use.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { MEMBRANE_STOPS } from "./membrane.js";
import { PLANT, VESSEL_AREA, DH, CH_AREA, osmotic, vantHoff, ions, phiPitzer, TCF, pKaBoron, rhoSW, muSW, Dsalt, SfromC, barToKWh, FEED_IONS } from "./models.js";

// ---------- UW-Madison CBE courses (titles checked against two catalog sources; links are the Guide's per-course search) ----------
export const COURSES = {
  "CBE 250": ["Process Synthesis", "#56687a"],
  "CBE 310": ["Chemical Process Thermodynamics", "#2f6fb0"],
  "CBE 311": ["Thermodynamics of Mixtures", "#7b4fa6"],
  "CBE 320": ["Introductory Transport Phenomena", "#23824a"],
  "CBE 326": ["Momentum and Heat Transfer Operations", "#1f7f80"],
  "CBE 426": ["Mass Transfer Operations", "#b5562b"],
  "CBE 430": ["Chemical Kinetics and Reactor Design", "#a8326e"],
  "CBE 440": ["Chemical Engineering Materials", "#6d6a2a"],
  "CBE 450": ["Process Design", "#9a6a08"],
  "CBE 470": ["Process Dynamics and Control", "#3d4fa8"],
  "CBE 540": ["Polymer Science and Technology", "#8a4f2b"],
  "CBE 547": ["Introduction to Colloid and Interface Science", "#5e6266"],
};
export const courseURL = c => `https://guide.wisc.edu/search/?P=${encodeURIComponent(c)}`;
export const LABEL = { "CBE 250": "Balances", "CBE 255": "Modeling", "CBE 310": "Thermo", "CBE 311": "Mixtures", "CBE 320": "Transport", "CBE 324": "Transport Lab", "CBE 326": "Fluids & Heat", "CBE 355": "Statistics", "CBE 424": "Unit Ops Lab", "CBE 426": "Mass Transfer", "CBE 430": "Kinetics & Reactors", "CBE 440": "Materials", "CBE 450": "Design", "CBE 470": "Control", "CBE 512": "Energy", "CBE 540": "Polymers", "CBE 547": "Colloids", "CBE 560": "Biochem" };
export const fullCourse = c => `${c}: ${(COURSES[c] || [c])[0]}`;
export const tag = c => `<a class="course" href="${courseURL(c)}" target="_blank" rel="noopener" title="${fullCourse(c)}">${LABEL[c] || c} ↗</a>`;
export const seen = tag;
const eq = (courses, html, note) => ({ courses, html, note });
const f0 = v => Math.round(v).toLocaleString("en-US"), f1 = v => v.toFixed(1), f2 = v => v.toFixed(2), f3 = v => v.toFixed(3);
const sci = v => { const e = Math.floor(Math.log10(Math.abs(v))); return String.raw`\(${(v / 10 ** e).toFixed(2)}\times10^{${e}}\)`; };

// ---------- materials and geometry helpers ----------
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.5, ...o });
const MT = {
  steel: () => mat("#9aa1a6", { metalness: 0.85, roughness: 0.35 }),
  duplex: () => mat("#c3c8cb", { metalness: 0.95, roughness: 0.25 }),
  dark: () => mat("#4a5157", { metalness: 0.7, roughness: 0.5 }),
  frp: () => mat("#e8e1cc", { metalness: 0.05, roughness: 0.45 }),
  white: () => mat("#f0efea", { metalness: 0.05, roughness: 0.4 }),
  blue: () => mat("#2b5f8e", { metalness: 0.4, roughness: 0.4 }),
  yellow: () => mat("#e0b123", { metalness: 0.2, roughness: 0.5 }),
  black: () => mat("#202326", { metalness: 0.1, roughness: 0.6 }),
  ceramic: () => mat("#f3f1ea", { metalness: 0.0, roughness: 0.25 }),
  amber: () => mat("#c58b2a", { metalness: 0.1, roughness: 0.35 }),
  bronze: () => mat("#b48a4a", { metalness: 0.9, roughness: 0.3 }),
  motor: () => mat("#3b6f99", { metalness: 0.4, roughness: 0.45 }),
};
function add(parent, geo, m, x = 0, y = 0, z = 0) { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; parent.add(o); return o; }
const cyl = (r, h, s = 40, r2 = r, open = false) => new THREE.CylinderGeometry(r2, r, h, s, 1, open);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
function tube(rOut, rIn, len, seg = 56) {   // thick-walled tube along y
  return new THREE.LatheGeometry([[rIn, -len / 2], [rOut, -len / 2], [rOut, len / 2], [rIn, len / 2], [rIn, -len / 2]].map(([a, b]) => new THREE.Vector2(a, b)), seg);
}
const alongX = g => g.rotateZ(-Math.PI / 2);
function pipe(parent, a, b, r, m, seg = 20) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), L = d.length();
  const o = add(parent, cyl(r, L, seg), m); o.position.copy(A).addScaledVector(d, 0.5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return o;
}
function shell(o) { o.userData.shell = true; return o; }
function label(parts, name, x, y, z) { parts.push([name, new THREE.Vector3(x, y, z)]); }
function tracers(parent, n, color, size) {
  const pos = new Float32Array(n * 3), g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ color, size, sizeAttenuation: true, transparent: true, opacity: 0.95, depthWrite: false });
  const p = new THREE.Points(g, m); p.frustumCulled = false; parent.add(p);
  return { pos, geo: g, n, mat: m, pts: p, u: new Float32Array(n).map(() => Math.random()), a: new Float32Array(n).map(() => Math.random()), b: new Float32Array(n).map(() => Math.random()) };
}
function texNet(color, bg = null) {
  const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d");
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, 64, 64); }
  g.strokeStyle = color; g.lineWidth = 5; for (let i = -64; i <= 64; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 64, 64); g.stroke(); g.beginPath(); g.moveTo(i + 64, 0); g.lineTo(i, 64); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
const fluxColor = (v, lo, hi, out = new THREE.Color()) => { const t = Math.min(1, Math.max(0, (v - lo) / (hi - lo))); return out.setHSL(0.6 - 0.6 * t, 0.65, 0.5); };

// ===================================================================================
// detailed models: each returns { group, parts: [[name, Vector3]], update(dt, live), actions, fit, explodeAxis }
// ===================================================================================

// 1. Spiral-wound element (8-inch, 40-inch long), cut open to show the leaves
function elementModel() {
  const g = new THREE.Group(), parts = [], L = 1.016, R = 0.0985, rt = 0.0195, NL = 6, turns = 1.6;
  const p = (R - rt - 0.004) / turns, blk = p / NL, x0 = -L / 2 + 0.035, x1 = L / 2 - 0.035;
  const memM = mat("#f6f4ec", { metalness: 0, roughness: 0.55, side: THREE.DoubleSide });
  const carM = mat("#3a3f44", { metalness: 0, roughness: 0.8, side: THREE.DoubleSide });
  const spT = texNet("#2f74c0"); spT.repeat.set(30, 40);
  const spM = mat("#4f8fd6", { metalness: 0, roughness: 0.6, side: THREE.DoubleSide, map: spT, transparent: true, alphaTest: 0.35 });
  const glueM = mat("#d9a441", { metalness: 0, roughness: 0.5, side: THREE.DoubleSide });
  function ribbon(i, off, m, xa = x0, xb = x1, nth = 220) {
    const th0 = 2 * Math.PI * i / NL, pos = [], uv = [], idx = [];
    for (let k = 0; k <= nth; k++) {
      const ph = 2 * Math.PI * turns * k / nth, th = th0 + ph, r = rt + 0.004 + p * ph / (2 * Math.PI) + off * blk;
      const y = Math.cos(th) * r, z = Math.sin(th) * r; pos.push(xa, y, z, xb, y, z); uv.push(0, ph / 6, 1, ph / 6);
      if (k < nth) { const a = 2 * k; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    return shell(add(g, geo, m));
  }
  const roll = new THREE.Group(); g.add(roll);
  for (let i = 0; i < NL; i++) {
    const add2 = (o) => { g.remove(o); roll.add(o); return o; };
    add2(ribbon(i, 0.0, memM)); add2(ribbon(i, 0.3, carM)); add2(ribbon(i, 0.6, memM)); add2(ribbon(i, 0.82, spM));
    add2(ribbon(i, 0.3, glueM, x0 - 0.012, x0)); add2(ribbon(i, 0.3, glueM, x1, x1 + 0.012));     // glue lines seal the envelope edges
  }
  // cross-section face at x = 0 in the cut-away octant (y > 0, z > 0), visible when the cutaway is on
  const xsec = new THREE.Group(); g.add(xsec);
  const strip = (i, off, w, m) => {
    const th0 = 2 * Math.PI * i / NL, nth = 400, runs = []; let cur = null;
    for (let k = 0; k <= nth; k++) {
      const ph = 2 * Math.PI * turns * k / nth, th = th0 + ph, tm = ((th % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      if (tm > 0.01 && tm < Math.PI / 2 - 0.01) { if (!cur) runs.push(cur = []); cur.push(ph); } else cur = null;
    }
    for (const run of runs) {
      const pos = [], idx = [];
      run.forEach((ph, k) => { const th = th0 + ph, r = rt + 0.004 + p * ph / (2 * Math.PI) + off * blk; for (const rr of [r, r + w * blk]) pos.push(-0.0006, Math.cos(th) * rr, Math.sin(th) * rr); if (k) { const a = 2 * k; idx.push(a - 2, a - 1, a, a - 1, a + 1, a); } });
      const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
      const o = new THREE.Mesh(geo, m); xsec.add(o);
    }
  };
  const flat = c => new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide });
  for (let i = 0; i < NL; i++) { strip(i, 0.0, 0.22, flat("#f4f2ea")); strip(i, 0.24, 0.3, flat("#30353a")); strip(i, 0.56, 0.22, flat("#f4f2ea")); strip(i, 0.8, 0.2, flat("#3f86d6")); }
  { const q = (r0, r1, c) => { const geo = new THREE.RingGeometry(r0, r1, 24, 1, 0, Math.PI / 2); geo.rotateY(-Math.PI / 2); const o = new THREE.Mesh(geo, flat(c)); o.position.x = -0.0006; o.rotation.x = 0; xsec.add(o); return o; };
    q(rt - 0.003, rt, "#d8d4c8"); q(R + 0.0005, R + 0.0035, "#c9bb8d"); }
  // permeate collection tube with holes
  const tubeM = mat("#d8d4c8", { metalness: 0.05, roughness: 0.4 });
  add(g, alongX(tube(rt, rt - 0.003, L + 0.09)), tubeM);
  for (let k = 0; k < 14; k++) add(g, alongX(cyl(0.0035, 0.004, 10)).rotateX(Math.PI / 2), mat("#1d2226", { metalness: 0 }), -0.42 + k * 0.065, 0, -rt);
  // outer fibreglass wrap
  shell(add(g, alongX(tube(R + 0.0035, R + 0.0005, L - 0.02)), mat("#c9bb8d", { metalness: 0.05, roughness: 0.4, transparent: true, opacity: 0.92 })));
  // anti-telescoping devices and brine seal
  const atdM = MT.black();
  const atds = [];
  for (const s of [-1, 1]) {
    const atd = new THREE.Group(); atd.position.x = s * (L / 2 - 0.005); g.add(atd); atds.push(atd);
    add(atd, alongX(tube(R + 0.004, R - 0.008, 0.03)), atdM); add(atd, alongX(tube(rt + 0.012, rt, 0.03)), atdM);
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2, sp = add(atd, box(0.03, R - rt - 0.02, 0.008), atdM, 0, Math.cos(a) * (R + rt) / 2, Math.sin(a) * (R + rt) / 2); sp.rotation.x = -a; }
  }
  add(atds[0], new THREE.TorusGeometry(R + 0.006, 0.0045, 10, 64).rotateY(Math.PI / 2), mat("#111", { metalness: 0, roughness: 0.7 }), 0.005, 0, 0);
  // the unrolled leaf (action): one envelope laid flat beside the roll
  const leaf = new THREE.Group(); leaf.position.set(0, 0, -0.32); g.add(leaf); leaf.visible = false;
  const LW = 0.62;
  add(leaf, box(L - 0.07, 0.002, LW), memM, 0, 0.012, 0); add(leaf, box(L - 0.07, 0.003, LW), carM, 0, 0.007, 0); add(leaf, box(L - 0.07, 0.002, LW), memM, 0, 0.002, 0);
  add(leaf, box(L - 0.07, 0.0015, LW), spM, 0, 0.022, 0);
  for (const s of [-1, 1]) add(leaf, box(0.012, 0.012, LW), glueM, s * (L / 2 - 0.035), 0.007, 0);
  add(leaf, box(L - 0.07, 0.012, 0.012), glueM, 0, 0.007, -LW / 2);
  // flow tracers: feed axially in the spacer channels, permeate spiralling inward in the carrier, then out of the tube
  const feed = tracers(g, 700, "#7fc4ff", 0.0055), perm = tracers(g, 500, "#ffffff", 0.0045);
  const ph0 = new Float32Array(perm.n).map(() => Math.random() * 2 * Math.PI * turns);
  label(parts, "Permeate tube (perforated)", 0, rt * 0.7, rt * 0.7);
  label(parts, "Membrane leaf: polyamide / polysulfone / polyester", 0, 0.05, 0.035);
  label(parts, "Feed spacer, 28 mil (0.71 mm)", 0, 0.025, 0.07);
  label(parts, "Permeate carrier (tricot)", 0, 0.068, 0.045);
  label(parts, "Glue lines seal 3 envelope edges", x1 + 0.006, 0.08, -0.02);
  label(parts, "Anti-telescoping device (ATD)", L / 2, -0.06, 0.06);
  label(parts, "Brine seal (U-cup)", -L / 2, R, 0.0);
  label(parts, "Fibreglass outer wrap", -0.35, -R, -0.02);
  let t = 0, unroll = 0, unrollT = 0;
  return {
    group: g, parts, fit: 0.75, explodeAxis: "x", wedge: true, camDir: [0.9, 0.42, 0.5], target: [0.02, 0.03, 0.03], onCut: on => { xsec.visible = on; },
    actions: [{ label: "Unroll a leaf", fn: b => { unrollT = unrollT ? 0 : 1; b.setAttribute("aria-pressed", String(!!unrollT)); } }],
    update(dt, live) {
      t += dt; unroll += (unrollT - unroll) * Math.min(1, dt * 3); leaf.visible = unroll > 0.02; leaf.scale.set(1, 1, Math.max(0.02, unroll)); leaf.position.z = -0.12 - 0.33 * unroll;
      const u = (live.u ?? 0.15), jw = (live.flux ?? 14);
      for (let i = 0; i < feed.n; i++) {
        feed.u[i] += dt * u * 0.9; if (feed.u[i] > 1) { feed.u[i] -= 1; feed.a[i] = Math.random(); feed.b[i] = Math.random(); }
        const li = Math.floor(feed.b[i] * NL), ph = feed.a[i] * 2 * Math.PI * turns, th = 2 * Math.PI * li / NL + ph, r = rt + 0.004 + p * ph / (2 * Math.PI) + 0.9 * blk;
        feed.pos.set([x0 + (x1 - x0) * feed.u[i], Math.cos(th) * r, Math.sin(th) * r], i * 3);
      }
      for (let i = 0; i < perm.n; i++) {
        perm.u[i] += dt * jw / 14 * 0.25; if (perm.u[i] > 1) { perm.u[i] -= 1; perm.a[i] = Math.random(); ph0[i] = Math.random() * 2 * Math.PI * turns; perm.b[i] = Math.random(); }
        const li = Math.floor(perm.b[i] * NL), xs = x0 + (x1 - x0) * perm.a[i];
        let x, y, z;
        if (perm.u[i] < 0.75) { const ph = ph0[i] * (1 - perm.u[i] / 0.75), th = 2 * Math.PI * li / NL + ph, r = rt + 0.004 + p * ph / (2 * Math.PI) + 0.3 * blk; x = xs; y = Math.cos(th) * r; z = Math.sin(th) * r; }
        else { const k = (perm.u[i] - 0.75) / 0.25, a = perm.b[i] * 6.28; x = xs + (L / 2 + 0.05 - xs) * k; y = Math.cos(a) * rt * 0.6; z = Math.sin(a) * rt * 0.6; }
        perm.pos.set([x, y, z], i * 3);
      }
      feed.geo.attributes.position.needsUpdate = perm.geo.attributes.position.needsUpdate = true;
    },
  };
}

// 2. Pressure vessel with 7 elements, coloured by live flux
function vesselModel() {
  const g = new THREE.Group(), parts = [], Lv = 7.9, Ro = 0.127, Ri = 0.1025, Le = 1.016, gap = 0.012;
  shell(add(g, alongX(tube(Ro, Ri, Lv - 0.3)), MT.frp()));
  const els = [], x0 = -(7 * Le + 6 * gap) / 2;
  for (let e = 0; e < 7; e++) {
    const xc = x0 + Le / 2 + e * (Le + gap), m = mat("#e8e2cf", { metalness: 0.05, roughness: 0.5 });
    const o = add(g, alongX(cyl(0.1, Le - 0.04, 40)), m, xc, 0, 0); els.push(o);
    for (const s of [-1, 1]) add(o, alongX(tube(0.1, 0.03, 0.03)), MT.black(), s * (Le / 2 - 0.02), 0, 0).rotation.z = 0;
    if (e < 6) add(g, alongX(cyl(0.024, 0.14, 16)), MT.dark(), xc + Le / 2 + gap / 2, 0, 0);       // interconnector with O-rings
  }
  // heads: bearing plate, locking ring, side ports (feed upstream, brine downstream), permeate ports
  for (const s of [-1, 1]) {
    const hd = new THREE.Group(); hd.position.x = s * (Lv / 2 - 0.2); g.add(hd);
    add(hd, alongX(cyl(Ri, 0.08, 40)), MT.white(), 0, 0, 0); add(hd, alongX(tube(Ri, Ri - 0.012, 0.03)), MT.steel(), s * 0.06, 0, 0);
    add(hd, alongX(cyl(0.03, 0.22, 20)), mat("#3f7fb5", { metalness: 0.2 }), s * 0.14, 0, 0);
    add(hd, cyl(0.045, 0.22, 20), MT.duplex(), -s * 0.12, Ro + 0.08, 0); add(hd, cyl(0.075, 0.04, 24), MT.steel(), -s * 0.12, Ro + 0.2, 0);
  }
  add(g, alongX(tube(0.1, 0.03, 0.05)), MT.dark(), x0 + 7 * (Le + gap) - gap + 0.03, 0, 0);    // thrust cone at the downstream end
  for (const x of [-2.6, 2.6]) { add(g, box(0.06, 0.32, 0.36), MT.steel(), x, -0.04, 0); add(g, box(0.1, 0.04, 0.4), MT.steel(), x, -0.18, 0); }
  add(g, box(Lv, 0.06, 0.4), MT.dark(), 0, -0.23, 0);
  const feed = tracers(g, 900, "#7fc4ff", 0.02), perm = tracers(g, 300, "#ffffff", 0.016);
  label(parts, "FRP pressure vessel, 1200 psi (82.7 bar)", -1.0, Ro, 0);
  label(parts, "Side-entry feed port", -Lv / 2 + 0.32, Ro + 0.2, 0);
  label(parts, "Element 1 (lead): highest flux", x0 + Le / 2, 0.1, 0);
  label(parts, "Interconnector, O-rings", x0 + Le + gap / 2, 0, 0);
  label(parts, "Element 7 (tail): highest salinity", x0 + 6.5 * (Le + gap), 0.1, 0);
  label(parts, "Brine port", Lv / 2 - 0.32, Ro + 0.2, 0);
  label(parts, "Permeate port (both heads)", Lv / 2 - 0.06, 0, 0);
  label(parts, "Bearing plate and locking ring", -Lv / 2 + 0.2, -0.08, 0);
  label(parts, "Thrust cone", x0 + 7 * (Le + gap), 0, 0);
  let colorBy = "flux";
  return {
    group: g, parts, fit: 6.5, explodeAxis: "x",
    actions: [{ label: "Colour: flux", fn: b => { colorBy = colorBy === "flux" ? "salinity" : "flux"; b.textContent = "Colour: " + colorBy; } }],
    update(dt, live) {
      const el = live.el || [];
      els.forEach((o, e) => { const E = el[e]; if (!E) return; colorBy === "flux" ? fluxColor(E.flux, 4, 26, o.material.color) : fluxColor(SfromC(E.Cout, live.T ?? 22), 35, 70, o.material.color); });
      for (let i = 0; i < feed.n; i++) {
        const x = -Lv / 2 + 0.3 + feed.u[i] * (Lv - 0.6), e = Math.min(6, Math.max(0, Math.floor((x - x0) / (Le + gap)))), E = el[e];
        const v = (E ? E.u : 0.15) * 0.9; feed.u[i] += dt * v / (Lv - 0.6) * 6; if (feed.u[i] > 1) feed.u[i] -= 1;
        const r = Math.sqrt(feed.a[i]) * 0.07 + 0.03, a = feed.b[i] * 6.283; feed.pos.set([x, Math.cos(a) * r, Math.sin(a) * r], i * 3);
      }
      for (let i = 0; i < perm.n; i++) { perm.u[i] += dt * 0.25; if (perm.u[i] > 1) perm.u[i] -= 1; const s = perm.b[i] < 0.5 ? -1 : 1, xs = x0 + perm.a[i] * 7 * (Le + gap); perm.pos.set([xs + (s * Lv / 2 - xs) * perm.u[i], 0, 0], i * 3); }
      feed.geo.attributes.position.needsUpdate = perm.geo.attributes.position.needsUpdate = true;
    },
  };
}

// 3. High-pressure pump: ring-section multistage centrifugal pump with its motor
function hpPumpModel() {
  const g = new THREE.Group(), parts = [], dx = MT.duplex(), st = MT.steel();
  shell(add(g, alongX(tube(0.42, 0.36, 1.9)), dx));
  for (let s = 0; s < 7; s++) shell(add(g, alongX(tube(0.45, 0.41, 0.06)), st, -0.9 + s * 0.3, 0, 0));
  for (const [x, nm] of [[-1.15, "s"], [1.15, "d"]]) { shell(add(g, alongX(tube(0.42, 0.12, 0.4)), dx, x, 0, 0)); shell(add(g, tube(0.17, 0.14, 0.5), dx, x, 0.6, 0)); add(g, cyl(0.26, 0.05, 32), st, x, 0.86, 0); }
  const rot = new THREE.Group(); g.add(rot);
  add(rot, alongX(cyl(0.05, 3.4, 24)), st, 0.2, 0, 0);
  const impM = mat("#d5d9dc", { metalness: 1, roughness: 0.2 });
  for (let s = 0; s < 6; s++) {
    const x = -0.75 + s * 0.3, imp = new THREE.Group(); imp.position.x = x; rot.add(imp);
    add(imp, alongX(cyl(0.3, 0.03, 40)), impM); add(imp, alongX(cyl(0.3, 0.02, 40, 0.12)), impM, 0.05, 0, 0);
    for (let b = 0; b < 7; b++) { const a = b / 7 * Math.PI * 2; for (let k = 0; k < 4; k++) { const r = 0.09 + k * 0.05, th = a + k * 0.18; const bl = add(imp, box(0.05, 0.008, 0.06), impM, 0.025, Math.cos(th) * r, Math.sin(th) * r); bl.rotation.x = -th + 0.4; } }
    add(g, alongX(tube(0.38, 0.32, 0.035)), MT.steel(), x + 0.12, 0, 0);                   // diffuser ring
  }
  add(rot, alongX(cyl(0.14, 0.18, 32)), MT.dark(), 1.05, 0, 0);                             // balance drum
  for (const s of [-1, 1]) { add(g, alongX(tube(0.13, 0.05, 0.2)), mat("#2f9a78", { metalness: 0.6 }), s * 1.45 + (s > 0 ? 0.0 : 0), 0, 0); add(g, alongX(tube(0.16, 0.05, 0.22)), MT.bronze(), s * 1.72, 0, 0); add(g, box(0.3, 0.5, 0.5), MT.blue(), s * 1.72, -0.15, 0); }
  add(rot, alongX(cyl(0.12, 0.2, 32)), MT.yellow(), -2.0, 0, 0);
  const mot = new THREE.Group(); mot.position.x = -3.2; g.add(mot);
  add(mot, alongX(cyl(0.6, 1.9, 48)), MT.motor()); for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; add(mot, box(1.7, 0.08, 0.025), MT.motor(), 0, Math.cos(a) * 0.62, Math.sin(a) * 0.62).rotation.x = -a; }
  add(mot, box(0.5, 0.35, 0.45), MT.motor(), 0, 0.75, 0);
  const fan = add(mot, alongX(cyl(0.45, 0.05, 24)), MT.dark(), -1.0, 0, 0);
  add(g, box(5.6, 0.12, 1.2), MT.dark(), -1.2, -0.75, 0); for (const x of [-3.2, -0.6, 0.6]) add(g, box(0.4, 0.5, 0.8), MT.dark(), x, -0.45, 0);
  const water = tracers(g, 900, "#7fc4ff", 0.02);
  label(parts, "Suction, ≈ 2 bar", -1.15, 0.86, 0);
  label(parts, "Discharge, ≈ 60 bar", 1.15, 0.86, 0);
  label(parts, "6 impellers, duplex stainless", -0.45, 0.25, 0);
  label(parts, "Diffuser and return channels", -0.18, -0.34, 0);
  label(parts, "Balance drum (axial thrust)", 1.05, 0.12, 0);
  label(parts, "Mechanical seal", 1.45, 0.12, 0);
  label(parts, "Bearing housing", 1.72, 0.3, 0);
  label(parts, "Coupling", -2.0, 0.13, 0);
  label(parts, "Motor with VFD, TEFC", -3.2, 0.8, 0);
  label(parts, "Ring-section casing, tie-bolted", 0.3, 0.45, 0);
  return {
    group: g, parts, fit: 5.0, explodeAxis: "x",
    update(dt, live) {
      const sp = live.speed ?? 1; rot.rotation.x += dt * 14 * sp; fan.rotation.x += dt * 14 * sp;
      for (let i = 0; i < water.n; i++) {
        water.u[i] += dt * 0.12 * sp; if (water.u[i] > 1) water.u[i] -= 1; const u = water.u[i];
        let x, y, z; const a = water.b[i] * 6.283 + u * 30;
        if (u < 0.12) { const k = u / 0.12; x = -1.15 + (water.a[i] - 0.5) * 0.2; y = 0.8 - k * 0.75; z = (water.b[i] - 0.5) * 0.2; }
        else if (u < 0.88) { const k = (u - 0.12) / 0.76, st = Math.floor(k * 6), f = k * 6 - st, r = 0.1 + 0.25 * Math.sin(Math.PI * f); x = -0.8 + st * 0.3 + f * 0.25; y = Math.cos(a) * r; z = Math.sin(a) * r; }
        else { const k = (u - 0.88) / 0.12; x = 1.15 + (water.a[i] - 0.5) * 0.2; y = 0.05 + k * 0.75; z = (water.b[i] - 0.5) * 0.2; }
        water.pos.set([x, y, z], i * 3);
      }
      water.geo.attributes.position.needsUpdate = true;
    },
  };
}

// 4. Isobaric pressure exchanger: ceramic rotor with 12 ducts turning between two end covers
function pxModel() {
  const g = new THREE.Group(), parts = [], Rr = 0.1, Lr = 0.3, nd = 12, rd = 0.022, rc = 0.063;
  const sh = new THREE.Shape(); sh.absarc(0, 0, Rr, 0, Math.PI * 2, false);
  const hub = new THREE.Path(); hub.absarc(0, 0, 0.022, 0, Math.PI * 2, true); sh.holes.push(hub);
  for (let i = 0; i < nd; i++) { const a = i / nd * Math.PI * 2, h = new THREE.Path(); h.absarc(Math.cos(a) * rc, Math.sin(a) * rc, rd, 0, Math.PI * 2, true); sh.holes.push(h); }
  const rg = new THREE.ExtrudeGeometry(sh, { depth: Lr, bevelEnabled: false, curveSegments: 28 }); rg.translate(0, 0, -Lr / 2); rg.rotateY(Math.PI / 2);
  const rotor = new THREE.Group(); g.add(rotor);
  shell(add(rotor, rg, MT.ceramic()));
  const brM = mat("#b9772e", { metalness: 0, roughness: 0.3, transparent: true, opacity: 0.9 }), swM = mat("#3c8fd6", { metalness: 0, roughness: 0.3, transparent: true, opacity: 0.9 }), mixM = mat("#7a5aa8", { metalness: 0, roughness: 0.4 });
  const ducts = [];
  for (let i = 0; i < nd; i++) {
    const a = i / nd * Math.PI * 2, y = Math.cos(a) * rc, z = Math.sin(a) * rc;
    const sw = add(rotor, alongX(cyl(rd * 0.96, 1, 16)), swM, 0, y, z), br = add(rotor, alongX(cyl(rd * 0.96, 1, 16)), brM, 0, y, z), mx = add(rotor, alongX(cyl(rd * 0.97, 0.012, 16)), mixM, 0, y, z);
    ducts.push({ a, sw, br, mx });
  }
  add(g, alongX(cyl(0.012, Lr + 0.14, 16)), MT.steel());                                       // centre tie rod
  shell(add(g, alongX(tube(Rr + 0.012, Rr + 0.002, Lr + 0.01)), MT.ceramic()));               // sleeve
  const covM = MT.ceramic();
  for (const s of [-1, 1]) {
    const c = add(g, alongX(cyl(Rr + 0.012, 0.04, 48)), covM, s * (Lr / 2 + 0.025), 0, 0);
    for (const [y0, m] of [[1, s < 0 ? swM : brM], [-1, s < 0 ? swM : brM]]) add(g, alongX(new THREE.RingGeometry(rc - rd, rc + rd, 24, 1, y0 > 0 ? 0.2 : Math.PI + 0.2, Math.PI - 0.4)).rotateX(0), m, s * (Lr / 2 + 0.046), 0, 0).rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2;
  }
  shell(add(g, alongX(tube(0.16, 0.135, 0.62)), mat("#e8e2cf", { metalness: 0.05, roughness: 0.4 })));     // FRP pressure housing
  for (const s of [-1, 1]) {
    shell(add(g, alongX(cyl(0.165, 0.06, 48)), MT.duplex(), s * 0.34, 0, 0));
    add(g, alongX(cyl(0.045, 0.16, 24)), MT.duplex(), s * 0.45, 0.075, 0);    // HP port (upper)
    add(g, alongX(cyl(0.055, 0.16, 24)), MT.duplex(), s * 0.45, -0.075, 0);   // LP port (lower)
    for (const y of [0.075, -0.075]) add(g, alongX(cyl(0.075, 0.025, 24)), MT.steel(), s * 0.53, y, 0);
  }
  label(parts, "Alumina rotor, 12 ducts, ≈ 1200 rpm", 0, Rr * 0.6, 0);
  label(parts, "Ceramic sleeve (bearing)", 0.08, -Rr - 0.01, 0);
  label(parts, "End cover: HP/LP ports", -Lr / 2 - 0.03, 0.06, 0);
  label(parts, "HP brine in", 0.53, 0.075, 0);
  label(parts, "LP brine out", 0.53, -0.075, 0);
  label(parts, "LP seawater in", -0.53, -0.075, 0);
  label(parts, "HP seawater out", -0.53, 0.075, 0);
  label(parts, "Brine/seawater interface", 0.03, -rc, 0);
  label(parts, "Pressure housing, FRP", 0.18, 0.15, 0);
  let ang = 0;
  return {
    group: g, parts, fit: 1.3, explodeAxis: "x", camDir: [0.55, 0.4, 0.75],
    update(dt, live) {
      ang += dt * (live.spin ?? 1) * 2.2; rotor.rotation.x = ang;
      for (const d of ducts) {
        // in the upper half (HP side) brine pushes in from +x; in the lower half (LP) seawater pushes the brine back out
        const ph = ((d.a + ang) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI), s = Math.sin(ph);
        const xi = -0.12 * s - 0.0 * (live.mix ?? 0);                   // interface position along the duct
        const l1 = xi + Lr / 2, l2 = Lr / 2 - xi;
        d.sw.scale.set(Math.max(0.001, l1), 1, 1); d.sw.position.x = -Lr / 2 + l1 / 2;
        d.br.scale.set(Math.max(0.001, l2), 1, 1); d.br.position.x = Lr / 2 - l2 / 2; d.mx.position.x = xi;
      }
    },
  };
}

// 5. Pressurised hollow-fibre UF module (vertical), outside-in filtration
function ufModel() {
  const g = new THREE.Group(), parts = [], H = 2.0, Rh = 0.125, Ri = 0.115;
  shell(add(g, tube(Rh, Ri, H - 0.3), mat("#eeeee8", { metalness: 0.05, roughness: 0.4, transparent: true, opacity: 0.95 })));
  for (const s of [-1, 1]) {
    shell(add(g, cyl(Rh + 0.012, 0.2, 40), MT.blue(), 0, s * (H / 2 - 0.08), 0));
    add(g, cyl(Ri, 0.1, 40), MT.amber(), 0, s * (H / 2 - 0.22), 0);                // epoxy potting
    add(g, cyl(0.05, 0.16, 20), MT.blue(), 0, s * (H / 2 + 0.08), 0);              // axial ports
  }
  add(g, alongX(cyl(0.05, 0.18, 20)), MT.blue(), Rh + 0.08, -H / 2 + 0.12, 0);       // feed / air inlet (side, bottom)
  add(g, alongX(cyl(0.05, 0.18, 20)), MT.blue(), Rh + 0.08, H / 2 - 0.12, 0);        // concentrate / air outlet (side, top)
  // fibres: drawn 4x thicker and fewer than the ~9 000 in a real module
  const nF = 420, fGeo = cyl(0.0026, H - 0.42, 6), fM = mat("#f6f6f2", { metalness: 0, roughness: 0.6 }), fib = new THREE.InstancedMesh(fGeo, fM, nF);
  const m4 = new THREE.Matrix4(), fpos = [];
  for (let i = 0; i < nF; i++) { const r = Math.sqrt((i + 0.5) / nF) * (Ri - 0.006), a = i * 2.39996; fpos.push([Math.cos(a) * r, Math.sin(a) * r]); m4.makeTranslation(Math.cos(a) * r, 0, Math.sin(a) * r); fib.setMatrixAt(i, m4); }
  fib.castShadow = true; g.add(fib); fib.userData.shell = false;
  const cakeM = mat("#8a7a52", { metalness: 0, roughness: 0.9, transparent: true, opacity: 0 }), cake = new THREE.InstancedMesh(cyl(0.0036, H - 0.42, 6), cakeM, nF);
  for (let i = 0; i < nF; i++) { m4.makeTranslation(fpos[i][0], 0, fpos[i][1]); cake.setMatrixAt(i, m4); } g.add(cake);
  const feed = tracers(g, 500, "#b49a5a", 0.008), filt = tracers(g, 300, "#bfeaff", 0.007);
  label(parts, "Hollow fibre, PVDF, 0.03 µm pores, ≈ 1.3 mm OD", 0.03, 0.2, 0);
  label(parts, "Cake layer (backwashed off)", -0.06, -0.3, 0);
  label(parts, "Epoxy potting", 0, H / 2 - 0.22, 0);
  label(parts, "Filtrate outlet (fibre lumen)", 0, H / 2 + 0.16, 0);
  label(parts, "Feed and air-scour inlet", Rh + 0.16, -H / 2 + 0.12, 0);
  label(parts, "Concentrate / air outlet", Rh + 0.16, H / 2 - 0.12, 0);
  label(parts, "Housing, PVC-U, 8 in × 80 in", 0, -0.6, -Rh);
  return {
    group: g, parts, fit: 2.3, explodeAxis: "y",
    update(dt, live) {
      const ph = live.cycle ?? 0.5, bw = ph < 0.03;
      cakeM.opacity = 0.75 * ph; cakeM.transparent = true;
      for (let i = 0; i < feed.n; i++) {
        feed.u[i] += dt * (bw ? -0.6 : 0.18); if (feed.u[i] > 1) feed.u[i] -= 1; if (feed.u[i] < 0) feed.u[i] += 1;
        const f = fpos[Math.floor(feed.a[i] * nF)], r = 0.006 * (1 - ph * 0.4), a = feed.b[i] * 6.283;
        feed.pos.set([f[0] + Math.cos(a) * r, -H / 2 + 0.25 + feed.u[i] * (H - 0.5), f[1] + Math.sin(a) * r], i * 3);
      }
      for (let i = 0; i < filt.n; i++) { filt.u[i] += dt * (bw ? -0.5 : 0.3); if (filt.u[i] > 1) filt.u[i] -= 1; if (filt.u[i] < 0) filt.u[i] += 1; const f = fpos[Math.floor(filt.a[i] * nF)]; filt.pos.set([f[0], -H / 2 + 0.25 + filt.u[i] * (H - 0.25), f[1]], i * 3); }
      feed.geo.attributes.position.needsUpdate = filt.geo.attributes.position.needsUpdate = true;
    },
  };
}

// ===================================================================================
// tour stops. ctx c: { st (plant state), p (Plant), pre (pretreat), post, intake, norm }
// spec rows: [label, value, "D" twin design basis | "T" typical]
// ===================================================================================
const m3d = q => f0(q * 24);
export const STOPS = [
  {
    id: "intake", title: "Open-sea intake", where: "900 m offshore, 19 m deep",
    role: "Two concrete heads on the seabed, 19 m down. A wide cap keeps inflow slow and sideways so fish can escape. Two pipes carry water ashore by gravity, far from the brine outfall.",
    specs: [["Intake heads", "2 velocity caps, 6 m dia., 0.6 m opening", "D"], ["Entrance velocity", "≤ 0.15 m/s (fish protection)", "T"], ["Intake lines", "2 × HDPE, 1.2 m bore, ≈ 1 km", "D"], ["Depth", "≈ 19 m, inlet 3 m above seabed", "D"], ["Distance to outfall", "≈ 540 m", "D"], ["Shock chlorination", "Intermittent NaOCl at the heads", "T"]],
    live: c => { const k = c.intake; return { rows: [["Intake flow", `${m3d(c.st.Qint)} m³/d · ${f2(k.Q)} m³/s`], ["Cap entrance velocity", `${f3(k.uCap)} m/s`], ["Line velocity", `${f2(k.u)} m/s`], ["Head loss", `${f2(k.hf)} m`], ["Seawater", `${f1(c.st.Sf)} g/kg · ${f1(c.st.inp.T)} °C`]] }; },
  },
  {
    id: "intakePS", title: "Intake pump station", where: "Shore · wet well, band screens and pumps",
    role: "3 mm band screens catch seaweed, jellyfish and litter. Four pumps lift the water to pretreatment: the first of several pumping steps that set power use.",
    specs: [["Screens", "4 band screens, 3 mm mesh", "T"], ["Pumps", "4 vertical turbine (3 + 1 standby)", "T"], ["Total head", "18 m", "D"], ["Pump + motor efficiency", "80 %", "D"], ["Materials", "Super duplex/bronze bowls, epoxy-lined", "T"]],
    live: c => ({ rows: [["Flow", `${m3d(c.st.Qint)} m³/d`], ["Power", `${f0(c.st.Wint / 1000)} kW`], ["Specific energy", `${f3(c.st.Wint / (c.st.Qp / 3600) / 3.6e6)} kWh/m³ product`]] }),
  },
  {
    id: "coag", title: "Coagulation and flocculation", where: "Pretreatment · 2 trains of 3-stage flocculators",
    role: "Particles too small to filter and too light to settle. Ferric chloride cancels the charge that keeps them apart; slow paddles let them collide and clump into flocs.",
    specs: [["Coagulant", "FeCl₃, 2 mg/L as Fe", "D"], ["Rapid mix", "G ≈ 800 s⁻¹, ≈ 1 min", "D"], ["Flocculation", "3 stages, G 60 → 40 → 20 s⁻¹, 20 min", "D"], ["pH", "≈ 7.5–8 (Fe consumes alkalinity)", "T"], ["Basins", "Concrete, 2 × (6 m + 3 × 12 m) × 10 m", "D"]],
    live: c => { const p = c.pre; return { rows: [["Flow", `${m3d(c.st.Quf)} m³/d`], ["FeCl₃ use", `${f0(p.fecl3)} kg/d`], ["Flocculator volume", `${f0(p.Vfloc)} m³`], [String.raw`Paddle power (\(G\) = 40 s⁻¹)`, `${f2(p.Pfloc / 1000)} kW`]] }; },
  },
  {
    id: "uf", title: "Ultrafiltration pretreatment", where: "UF canopy · 6 racks of pressurised modules", model: ufModel,
    role: "Hollow PVDF fibres with 0.03 µm pores strip out flocs, bacteria and silt to protect the RO membranes. Every 30 min the flow reverses, with air scour, to shed the cake.",
    specs: [["Modules", "≈ 1250 × 77 m² PVDF, outside-in", "D"], ["Design flux", "60 LMH at 20 °C", "D"], [String.raw`Clean resistance \(R_m\)`, String.raw`\(1.2\times10^{12}\) m⁻¹ (≈ 300 LMH/bar)`, "D"], ["Backwash", "1 min every 30 min, air scour", "D"], ["Recovery", "94 %", "D"], ["Filtrate quality", String.raw`\(\mathrm{SDI}_{15}\) < 3, turbidity < 0.1 NTU`, "T"], ["Chem. enhanced backwash", "Daily, NaOCl then acid", "T"]],
    live: c => { const p = c.pre; return { rows: [["Flux", `${f1(p.J)} LMH`], ["TMP", `${f2(p.tmp)} bar`], [String.raw`Cake resistance \(R_c\)`, `${sci(p.Rc + 1)} m⁻¹`], ["Cycle time", `${f0(p.ph * 30)} of 30 min`], ["Filtrate", `${m3d(c.st.Qf)} m³/d`]], cycle: p.ph }; },
  },
  {
    id: "cart", title: "Cartridge filters and dosing", where: "Cartridge filters, chemical bund",
    role: "5 µm cartridges: last safety net before the HP pumps. Bisulfite removes chlorine (it attacks the membranes); antiscalant stops brine minerals forming scale.",
    specs: [["Cartridge filters", "12 vessels, 5 µm PP", "D"], ["Change-out", String.raw`At \(\Delta p\) ≈ 1 bar (2–3 months)`, "T"], ["Antiscalant", "Phosphonate, 1.5 mg/L", "D"], ["Sodium bisulfite", "3 × stoichiometric on 0.5 mg/L Cl₂", "D"], ["Interlock", "ORP < 300 mV", "T"]],
    live: c => { const p = c.pre, s = c.st.sc; return { rows: [["Brine LSI (CaCO₃)", `${f2(s.lsi)} (feed ${f2(c.st.sc0.lsi)})`], ["Brine CaSO₄ saturation", `${f0(s.caso4)} % (feed ${f0(c.st.sc0.caso4)} %)`], ["Concentration factor", `${f2(c.st.CF)}`], ["Antiscalant", `${f0(p.antiKg)} kg/d`], ["SBS", `${f0(p.sbsKg)} kg/d (${f2(p.sbs)} mg/L)`]] }; },
  },
  {
    id: "hp", title: "High-pressure pump", where: "RO hall · one per train", model: hpPumpModel,
    role: "Raises the feed to ≈ 60 bar. Carries only ≈ 45 % of the flow; the ERDs pressurise the rest. A controller trims its speed to hold production.",
    specs: [["Type", "Multistage BB4, 6 stages", "T"], ["Material", "Super duplex (PREN > 40)", "T"], ["Efficiency", "Slider (85 % default)", "D"], ["Motor", "≈ 2.5 MW, 6.6 kV, VFD, 96 %", "D"], ["Element rating", "82.7 bar (1200 psi)", "T"]],
    live: c => { const s = c.st, n = s.nTr; return { rows: [["Flow per train", `${f0(s.Qhp / n)} m³/h`], ["Suction → discharge", `${f1(PLANT.Plp)} → ${f1(s.Pf)} bar`], ["Shaft power per train", `${f0(s.Whp / n / 1000 * PLANT.etaMotor)} kW`], ["Electrical, all trains", `${f2(s.Whp / 1e6)} MW`], [String.raw`Controller output \(p_{\mathrm{cmd}}\)`, `${f1(c.p.Pcmd)} bar`]], speed: s.Qhp / (s.Qf * 0.46 + 1e-9) }; },
  },
  {
    id: "px", title: "Pressure exchangers (ERD)", where: "RO hall · 16 per train", model: pxModel,
    role: "Brine leaves the membranes still at high pressure. A spinning ceramic rotor lets it push directly on seawater, returning most of its energy. Without ERDs: ≈ 2× the electricity.",
    specs: [["Device", "Rotary isobaric PX, ≈ 70 m³/h each", "T"], ["Efficiency", "Slider (96 % default)", "D"], ["Mixing", "3 % (raises feed salinity)", "D"], ["Leakage", "1 % of brine", "D"], ["Booster pump", "80 %, ≈ 3 bar", "D"], ["Rotor", "Alumina, ≈ 1200 rpm, one moving part", "T"]],
    live: c => { const s = c.st; return s.inp.erd ? { rows: [["Brine in (HP)", `${f1(s.v.Pb)} bar · ${f0(s.Qb / s.nTr)} m³/h per train`], ["Seawater out (HP)", `${f1(s.Ppx)} bar`], ["Booster rise", `${f1(s.Pf - s.Ppx)} bar · ${f0(s.Wbst / 1000)} kW total`], ["Power recovered", `${f2(s.recovered / 1e6)} MW`], ["Membrane feed salinity", `${f2(SfromC(s.Cfm, s.inp.T))} g/kg (intake ${f2(s.Sf)})`]], spin: 1 } : { rows: [["ERD", "Bypassed: brine throttled"], ["Power wasted", `${f2(s.Qb / 3600 * s.v.Pb * 1e5 / 1e6)} MW`]], spin: 0 }; },
  },
  {
    id: "vessel", title: "RO train and pressure vessel", where: "RO hall · 112 vessels per train", model: vesselModel,
    role: "Seven elements in series per tube: feed in, permeate out the centre pipe, brine out the far end. Each element sees saltier feed and makes less, which limits recovery.",
    specs: [["Trains", "6 × 112 vessels × 7 = 4704 elements", "D"], ["Vessel", "8 in FRP, side ports, 82.7 bar", "T"], ["Area per vessel", `${f1(VESSEL_AREA)} m²`, "D"], ["Limits per vessel", "Feed ≤ 17, brine ≥ 3 m³/h; element recovery ≤ 15 %; CP ≤ 1.2", "D"], ["Configuration", "1 pass, 1 stage", "D"]],
    live: c => { const s = c.st, v = s.v; return { rows: [["Feed pressure", String.raw`${f1(s.Pf)} bar · \(\Delta p\) vessel ${f2(v.dP)} bar`], ["Feed / brine per vessel", `${f2(s.QfV)} / ${f2(v.Qb)} m³/h`], ["Lead / tail flux", `${f1(s.lead.flux)} / ${f1(s.tail.flux)} LMH`], ["Recovery", `${f1(s.rec * 100)} %`], ["Normalised permeate flow", String.raw`${f1(c.norm.nq * 100)} % of new (model \(A/A_0\) ${f1(c.norm.ff * 100)} %)`]], el: v.el, T: s.inp.T }; },
  },
  {
    id: "element", title: "Spiral-wound membrane element", where: "Inside every vessel · 37 m² each", model: elementModel,
    role: "≈ 30 membrane envelopes wound round a perforated pipe. Feed flows axially between them; water crosses the film far faster than salt, then spirals in to the centre pipe.",
    specs: [["Size", "8 × 40 in (201 × 1016 mm)", "D"], ["Active area", "37.2 m² (400 ft²)", "D"], [String.raw`Water permeability \(A\)`, "1.1 LMH/bar at 25 °C (new)", "D"], [String.raw`Salt permeability \(B\)`, "0.05 LMH at 25 °C (new)", "D"], ["Boric acid permeability", "3.0 LMH at 25 °C", "D"], ["Feed spacer", "0.71 mm, porosity 0.89", "D"], ["Rejection", "≈ 99.7–99.8 % (test)", "T"], ["Chlorine tolerance", "< 1000 ppm·h", "T"]],
    live: c => { const E = c.st.lead; return { rows: [["Lead element flux", `${f1(E.flux)} LMH`], ["Crossflow velocity", `${f3(E.u)} m/s · Re ${f0(E.Re)}`], [String.raw`Mass transfer coefficient \(k\)`, `${f0(E.k * 3.6e6)} LMH`], [String.raw`Polarisation \(C_m/C_b\)`, `${f3(E.cpMax)}`], ["Permeate (lead)", `${f0(E.Cp * 1000)} mg/L TDS · ${f2(E.Bp)} mg/L B`]], u: E.u, flux: E.flux }; },
  },
  {
    id: "cip", title: "Clean-in-place skid", where: "Beside the RO hall",
    role: "Biofilm, organics and particles foul the membranes over weeks. CIP takes one train offline and recirculates warm alkaline, then acid, solution. Fouling is mostly reversed; ageing is not.",
    specs: [["Tanks", "2 × 25 m³ (one heated)", "T"], ["Alkaline clean", "NaOH, pH 12, 35 °C, 1–2 h", "T"], ["Acid clean", "Citric or HCl, pH 2", "T"], ["Trigger", String.raw`Flow −10 %, \(\Delta p\) +15 % or salt passage +10 %`, "T"], ["In this model", "85 % of reversible fouling in 8 h, 1 train off", "D"]],
    live: c => ({ rows: [["Reversible fouling", `${f1(c.st.inp.foul)} % flux loss`], [String.raw`Feed-channel \(\Delta p\) factor`, `${f2(c.st.mem.dpMul)}`], ["Normalised permeate flow", `${f1(c.norm.nq * 100)} %`], ["CIP", c.p.cip ? `Running · ${c.p.cipStage} · ${f0((c.p.cip.dur - c.p.cip.t) / 60)} min left` : "Idle (press Start CIP)"]] }),
  },
  {
    id: "post", title: "Remineralisation and chlorination", where: "Post-treatment · limestone contactors",
    role: "RO water is corrosive and tastes flat. Limestone beds plus CO₂ add calcium back; a small chlorine dose protects it in the network.",
    specs: [["Contactors", "8 cells, calcite 1–3 mm, EBCT 12 min", "D"], ["Target", "Ca²⁺ 0.5 mmol/L (50 mg/L as CaCO₃), alkalinity ≈ 50", "D"], ["CO₂", "Liquid, 30 % excess", "D"], ["Final pH", "8.2 (NaOH trim)", "D"], ["Chlorine", "1.2 mg/L as Cl₂ (NaOCl)", "D"], ["Goals", "LSI ≈ 0 ± 0.5, B < 2.4 mg/L (WHO), TDS < 500 mg/L", "T"]],
    live: c => { const p = c.post; return { rows: [["Calcium added", `${f3(p.ca)} mmol/L (${f0(p.approach * 100)} % of target)`], ["Limestone / CO₂ use", `${f1(p.limeKg / 1000)} / ${f1(p.co2Kg / 1000)} t/d`], ["Product TDS", `${f0(p.tds)} mg/L`], ["Product LSI", `${f2(p.L.lsi)}`], ["Boron", `${f2(c.st.Bp)} mg/L`]] }; },
  },
  {
    id: "tanks", title: "Product water storage", where: "2 × 28 600 m³ steel tanks",
    role: "≈ 1 day of production. Buffers daily demand swings and gives chlorine contact time before the city network.",
    specs: [["Tanks", "2 × 45 m dia. × 18 m, steel, epoxy lined", "D"], ["Volume", "57 200 m³ (≈ 1 day)", "D"], ["Chlorine decay", "First order, k ≈ 0.02 h⁻¹", "D"], ["Product pumps", "4 × split-case, 5 bar", "D"]],
    live: c => { const p = c.post; return { rows: [["Product flow", `${m3d(c.st.Qp)} m³/d`], ["Residence time", `${f1(p.tau)} h`], ["Chlorine out", `${f2(p.resid)} mg/L`], ["Product pumping", `${f0(c.st.Wprod / 1000)} kW`]] }; },
  },
  {
    id: "outfall", title: "Brine outfall and diffuser", where: "700 m offshore, 15 m deep",
    role: "Brine is ≈ 2× sea salinity and denser, so it sinks. 16 seabed ports jet it up at 60°, mixing it with ≈ 30× its volume of seawater before it lands.",
    specs: [["Diffuser", "8 risers × 2 ports, 0.14 m, 60° up", "D"], ["Length", "90 m, normal to coast", "D"], ["Outfall pipe", "HDPE, ≈ 1 m bore, 750 m", "D"], ["Mixing-zone target", String.raw`\(\Delta S\) < 5 % (≈ 1.5–2 g/kg) at edge`, "T"], ["Jet model", "60° dense jets (Roberts, Ferrier & Daviero 1997)", "D"]],
    live: c => { const o = c.st.out; return { rows: [["Brine", `${m3d(c.st.Qb)} m³/d · ${f1(c.st.Sb)} g/kg`], ["Port velocity", `${f2(o.uJet)} m/s`], [String.raw`Densimetric Froude \(F\)`, `${f1(o.Fr)}`], ["Jet rise / impact distance", `${f1(o.rise)} m / ${f1(o.xi)} m`], ["Impact dilution, excess salinity", `${f0(o.Si)} : 1 · +${f2(o.dS)} g/kg`]] }; },
  },
];

// ---------- equations at work, per stop (live numbers plugged in) ----------
const TH = {
  intake: c => { const k = c.intake, s = c.st;
    return [
      eq(["CBE 250"], String.raw`Q_{\mathrm{intake}} = \dfrac{1.02\,Q_p}{r\,r_{\mathrm{UF}}}`, String.raw`${m3d(s.Qp)} m³/d product, \(r\) = ${f1(s.rec * 100)} %, UF 94 %, +2 % services → ${m3d(s.Qint)} m³/d from the sea.`),
      eq(["CBE 320"], String.raw`u = \dfrac{Q}{\pi D H}`, `${f2(k.Q / 2)} m³/s through a 6 m × 0.6 m ring → ${f3(k.uCap)} m/s (limit 0.15 m/s).`),
      eq(["CBE 326", "CBE 320"], String.raw`\begin{aligned} h_f &= f\,\dfrac{L}{D}\,\dfrac{u^2}{2g} \\ \dfrac{1}{\sqrt{f}} &= -2\log_{10}\!\left(\dfrac{\varepsilon}{3.7D} + \dfrac{5.74}{\mathrm{Re}^{0.9}}\right) \end{aligned}`, String.raw`Swamee–Jain: \(\mathrm{Re}\) = ${sci(k.Re)}, \(f\) = ${f3(k.f)}, ${f2(k.u)} m/s over 1.2 km → \(h_f\) = ${f2(k.hf)} m wet-well drawdown.`),
    ]; },
  intakePS: c => { const s = c.st, Q = s.Qint / 3600;
    return [
      eq(["CBE 326"], String.raw`P = \dfrac{\rho g Q H}{\eta}`, `${f2(Q)} m³/s × 18 m at 80 % → ${f0(s.Wint / 1000)} kW (${f2(s.Wint / (s.Qp / 3600) / 3.6e6)} kWh/m³ product).`),
      eq(["CBE 326"], String.raw`Q \propto N,\quad H \propto N^2,\quad P \propto N^3`, "10 % slower → 27 % less power: hence variable-speed drives."),
    ]; },
  coag: c => { const p = c.pre;
    return [
      eq(["CBE 547", "CBE 326"], String.raw`G = \sqrt{\dfrac{P}{\mu V}},\qquad \text{Camp number } G\,t`, String.raw`\(G\) = 40 s⁻¹ in ${f0(p.Vfloc)} m³ (\(\mu\) = ${f2(p.mu * 1000)} mPa·s) → ${f2(p.Pfloc / 1000)} kW; \(Gt\) = ${f0(p.camp)} (usual 10⁴–10⁵).`),
      eq(["CBE 547"], String.raw`\mathrm{Fe^{3+} + 3\,H_2O \rightarrow Fe(OH)_3(s) + 3\,H^+}`, `Fe(OH)₃ sweeps colloids into flocs; Fe³⁺ collapses the double layer. ${f2(p.fe)} mg/L Fe uses ${f2(p.fe / 55.85 * 3 * 50)} mg/L alkalinity as CaCO₃.`),
      eq(["CBE 430"], String.raw`\dfrac{dN}{dt} = -\dfrac{4}{\pi}\,\alpha\,\phi\,G\,N`, String.raw`First order at fixed floc fraction \(\phi\): count decays exponentially with \(Gt\), so basins are sized on Camp number.`),
    ]; },
  uf: c => { const p = c.pre;
    return [
      eq(["CBE 426"], String.raw`J = \dfrac{\mathrm{TMP}}{\mu\,(R_m + R_c)}`, String.raw`\(J\) = ${f1(p.J)} LMH, \(\mu\) = ${f2(p.mu * 1000)} mPa·s, \(R_m\) = \(1.2\times10^{12}\), \(R_c\) = ${sci(p.Rc + 1)} m⁻¹ → TMP ${f2(p.tmp)} bar; sawtooth between backwashes.`),
      eq(["CBE 320", "CBE 326"], String.raw`\alpha = \dfrac{180\,(1 - \varepsilon)}{\rho_p\,d_p^2\,\varepsilon^3}`, String.raw`Carman–Kozeny: fine particles, compact cake (small \(\varepsilon\)) raise it sharply; good flocculation slows the TMP rise.`),
      eq(["CBE 426"], String.raw`\mathrm{SDI}_{15} = \dfrac{100\,(1 - t_i/t_f)}{15}`, "ASTM D4189: time for 500 mL through 0.45 µm, before and after 15 min. RO needs < 3–4; UF filtrate usually < 2."),
      eq(["CBE 540"], String.raw`\mathrm{PVDF}\!:\quad -\!\left[\mathrm{CH_2{-}CF_2}\right]_n\!-`, "Phase-inversion PVDF fibres tolerate chlorine and acid; polyamide does not."),
    ]; },
  cart: c => { const s = c.st, sc = s.sc, L = sc.L, G = sc.G;
    return [
      eq(["CBE 311"], String.raw`\mathrm{LSI} = \mathrm{pH} - \mathrm{pH}_s,\quad \mathrm{pH}_s = 9.3 + A + B - (C + D)`, String.raw`Brine: TDS ${f0(sc.tds)} mg/L (\(A\) = ${f3(L.A)}), ${f1(s.inp.T)} °C (\(B\) = ${f3(L.B)}), Ca ${f0(sc.ca)}, alkalinity ${f0(sc.alk)} mg/L as CaCO₃ → \(\mathrm{pH}_s\) = ${f2(L.pHs)}; pH ≈ feed + 0.15 → LSI ${f2(sc.lsi)}. Stiff–Davis reads lower in seawater.`),
      eq(["CBE 311"], String.raw`\Omega = \dfrac{\gamma^2\,m_{\mathrm{Ca}}\,m_{\mathrm{SO_4}}}{K_{sp}} = \dfrac{m_{\mathrm{Ca}}\,m_{\mathrm{SO_4}}}{K^{*}_{sp}(I)}`, String.raw`\(I\) = ${f2(G.I)} mol/kg, \(m_{\mathrm{Ca}}m_{\mathrm{SO_4}}\) = ${sci(G.mCa * G.mSO4)}, \(K^{*}_{sp}\) = ${sci(G.Ksp)} → ${f0(sc.caso4)} %. Lower \(\gamma\) at high \(I\): more gypsum dissolves.`),
      eq(["CBE 250"], String.raw`\mathrm{CF} = \dfrac{C_b}{C_f} \approx \dfrac{1 - r\cdot\mathrm{SP}}{1 - r}`, String.raw`At \(r\) = ${f1(s.rec * 100)} % every brine ion is ×${f2(s.CF)}.`),
      eq(["CBE 430"], String.raw`\mathrm{Na_2S_2O_5 + 2\,HOCl + H_2O \rightarrow 2\,NaHSO_4 + 2\,HCl}`, `1.34 mg metabisulfite per mg Cl₂, near-instant. Dose ${f2(c.pre.sbs)} mg/L.`),
    ]; },
  hp: c => { const s = c.st, e = (c.p.setpoint() - s.v.Qp) / c.p.setpoint();
    return [
      eq(["CBE 326", "CBE 310"], String.raw`W = \dfrac{Q\,\Delta p}{\eta_{\mathrm{pump}}\,\eta_{\mathrm{motor}}}`, `${f0(s.Qhp)} m³/h × (${f1(s.Pf)} − ${f1(PLANT.Plp)}) bar / (${f2(s.inp.etaPump / 100)} × 0.96) = ${f2(s.Whp / 1e6)} MW.`),
      eq(["CBE 470"], String.raw`\begin{aligned} p_{\mathrm{cmd}} &= \bar{p} + K_c\left[e + \dfrac{1}{\tau_I}\int_0^t e\,dt'\right] \\ \tau_p\,\dfrac{dp_f}{dt} &= p_{\mathrm{cmd}} - p_f \end{aligned}`, String.raw`PI on pump speed: \(K_c\) = ${c.p.Kc} bar, \(\tau_I\) = ${c.p.tauI} s, lag \(\tau_p\) = ${c.p.tauP} s. Error ${f2(e * 100)} %, \(p_{\mathrm{cmd}}\) = ${f1(c.p.Pcmd)} bar. Move the flux set-point to test it.`),
      eq(["CBE 440"], String.raw`\mathrm{PREN} = \%\mathrm{Cr} + 3.3\,\%\mathrm{Mo} + 16\,\%\mathrm{N}`, "Super duplex (25 % Cr, 3.5 % Mo, 0.25 % N): PREN ≈ 41 for warm, chloride-rich HP seawater; 316L (≈ 24) pits."),
    ]; },
  px: c => { const s = c.st, mw = s.mw;
    return [
      eq(["CBE 310"], String.raw`\eta_{\mathrm{PX}} = \dfrac{\sum (pQ)_{\mathrm{out}}}{\sum (pQ)_{\mathrm{in}}}`, s.inp.erd ? String.raw`\(\eta_{\mathrm{PX}}\) = ${f2(s.inp.etaERD)} %: brine ${f1(s.v.Pb)} bar; seawater ${f1(PLANT.Plp)} → ${f1(s.Ppx)} bar; booster adds ${f1(s.Pf - s.Ppx)} bar.` : "ERD bypassed: brine energy throttled away."),
      eq(["CBE 450"], String.raw`\mathrm{SEC} = \dfrac{\sum W}{Q_p}`, `RO ${f2(s.secRO)} kWh/m³ (no ERD: ${f2(s.secNoERD)}); whole plant ${f2(s.secPlant)} kWh/m³.`),
      eq(["CBE 311", "CBE 310"], String.raw`\dfrac{W_{\min}}{V_p} = \dfrac{1}{r}\int_0^{r} \pi\!\left(\dfrac{C_f}{1 - x}\right) dx \;\approx\; \dfrac{\pi_f}{r}\,\ln\dfrac{1}{1 - r}`, String.raw`At \(r\) = ${f1(s.rec * 100)} %: ${f3(barToKWh(mw.real))} kWh/m³ (ideal ${f3(barToKWh(mw.ideal))}); single stage, above brine \(\pi\): ≥ ${f3(barToKWh(mw.stage))}. Plant uses ${f1(s.secRO / barToKWh(mw.real))}× the minimum.`),
      eq(["CBE 250"], String.raw`C_{f,\mathrm{mem}} = C_f + x_{\mathrm{mix}}\,\dfrac{Q_{\mathrm{PX}}}{Q_f}\,\left(C_b - C_f\right)`, `3 % rotor mixing: membrane feed ${f2(SfromC(s.Cfm, s.inp.T))} vs ${f2(s.Sf)} g/kg.`),
    ]; },
  vessel: c => { const s = c.st, v = s.v, E1 = s.lead, E7 = s.tail, n = c.norm;
    return [
      eq(["CBE 426", "CBE 250"], String.raw`\begin{aligned} Q_{k+1} &= Q_k - J_{w,k}\,a \\ Q_{k+1}C_{k+1} &= Q_k C_k - J_{s,k}\,a \end{aligned}`, `5 cells per element: flux ${f1(E1.flux)} → ${f1(E7.flux)} LMH (element 1 → 7) as bulk \\(\\pi\\) rises ${f1(E1.piIn)} → ${f1(E7.piOut)} bar.`),
      eq(["CBE 326"], String.raw`\Delta p = \lambda\,\dfrac{\rho u^2}{2 d_h}\,L,\qquad \lambda = 6.23\,\mathrm{Re}^{-0.3}`, String.raw`Schock & Miquel 1987, \(d_h\) = ${f2(DH * 1000)} mm: vessel \(\Delta p\) = ${f2(v.dP)} bar${s.mem.dpMul > 1.01 ? `, raised ${f0((s.mem.dpMul - 1) * 100)} % by fouling` : ""}.`),
      eq(["CBE 430"], String.raw`A(T) = A_{25}\,\exp\!\left[2640\left(\dfrac{1}{298} - \dfrac{1}{T}\right)\right]`, `${f1(s.inp.T)} °C: TCF ${f3(TCF(s.inp.T, PLANT.EA))} (water), ${f3(TCF(s.inp.T, PLANT.EB))} (salt). Warmer: less pressure, more salt and boron.`),
      eq(["CBE 470", "CBE 426"], String.raw`Q_N = Q_p\,\dfrac{\mathrm{NDP}_{\mathrm{ref}}}{\mathrm{NDP}}\,\dfrac{\mathrm{TCF}_{\mathrm{ref}}}{\mathrm{TCF}}`, String.raw`ASTM D4516 style: NDP ${f1(n.ndp)} vs ${f1(n.ndpRef)} bar ref → ${f1(n.nq * 100)} %. True \(A/A_0\) ${f1(n.ff * 100)} %: biased by the feed–brine NDP average.`),
    ]; },
  element: c => { const s = c.st, E = s.lead, T = s.inp.T, S = s.Sf, io = ions(S), phi = phiPitzer(io.I, T);
    return [
      eq(["CBE 311"], String.raw`\pi = \varphi\,\Bigl(\sum_i m_i\Bigr)\,\rho_w R T`, String.raw`\(\sum_i m_i\) = ${f3(io.m)}, \(I\) = ${f3(io.I)} mol/kg. Pitzer (NaCl, scaled to \(\varphi\) = 0.902 at 35 g/kg): \(\varphi\) = ${f3(phi)} → \(\pi\) = ${f2(osmotic(S, T))} bar (ideal: ${f2(vantHoff(S, T))}).`),
      eq(["CBE 426"], String.raw`\begin{aligned} J_w &= A\left[\Delta p - \bigl(\pi(C_m) - \pi(C_p)\bigr)\right] \\ J_s &= B\,(C_m - C_p),\qquad C_p = \dfrac{J_s}{J_w} \end{aligned}`, String.raw`Lead element: \(A\) = ${f3(s.mem.A)} LMH/bar, NDP ${f1(E.ndp)} bar → \(J_w\) = ${f1(E.Jw)} LMH; \(B\) = ${f3(s.mem.B)} LMH → ${f0(E.Cp * 1000)} mg/L. \(J_s\) ignores pressure, so more flux dilutes the permeate.`),
      eq(["CBE 426", "CBE 320"], String.raw`\dfrac{C_m - C_p}{C_b - C_p} = \exp\!\left(\dfrac{J_w}{k}\right)`, String.raw`\(k\) = ${f0(E.k * 3.6e6)} LMH, \(J_w\) = ${f1(E.Jw)} LMH → wall ${f1((E.cpMax - 1) * 100)} % saltier than bulk; \(\pi(C_m)\) = ${f1(E.piM)} bar.`),
      eq(["CBE 320", "CBE 426"], String.raw`\mathrm{Sh} = \dfrac{k\,d_h}{D} = 0.065\,\mathrm{Re}^{0.875}\,\mathrm{Sc}^{0.25}`, String.raw`Schock & Miquel 1987: \(u\) = ${f3(E.u)} m/s, Re ${f0(E.Re)}, Sc ${f0(E.Sc)}, \(d_h\) = ${f2(DH * 1000)} mm → Sh ${f1(E.Sh)}.`),
      eq(["CBE 311"], String.raw`\mathrm{B(OH)_3 + H_2O \rightleftharpoons B(OH)_4^- + H^+},\qquad \mathrm{p}K^{*} = ${f2(pKaBoron(S, T))}`, String.raw`pH ${f2(s.inp.pH)}: ${f1(s.alpha * 100)} % is borate (rejected); boric acid passes (\(B\) ≈ ${f2(s.mem.Bba)} LMH). Boron ${f2(s.Bf)} → ${f2(s.Bp)} mg/L, ${f1((1 - s.Bp / s.Bf) * 100)} % rejection. Fix: pH 10 second pass.`),
      eq(["CBE 540"], String.raw`m\text{-phenylenediamine} + \text{trimesoyl chloride} \rightarrow \text{cross-linked polyamide}`, "100–200 nm polyamide skin on polysulfone on polyester. Chlorine attacks the amide bonds: hence bisulfite."),
    ]; },
  cip: c => { const s = c.st;
    return [
      eq(["CBE 310"], String.raw`Q = m\,c_p\,\Delta T`, `25 m³ from ${f0(s.inp.T)} to 35 °C: ${f0(25000 * 4.18 * Math.max(0, 35 - s.inp.T) / 3600)} kWh.`),
      eq(["CBE 430"], String.raw`k = k_0\,\exp\!\left(-\dfrac{E_a}{RT}\right)`, "Alkali hydrolyses biofilm and organics; acid dissolves carbonate and iron. Warmer is faster, up to the 35–45 °C membrane limit."),
      eq(["CBE 426"], String.raw`A = A_0\,(1 - f_{\mathrm{age}})\,(1 - f_{\mathrm{foul}})`, String.raw`Ageing ${f1((1 - s.mem.ff / (1 - s.inp.foul / 100)) * 100)} % (${f1(s.inp.age)} yr, permanent) + fouling ${f1(s.inp.foul)} % (CIP removes). Fouling adds ${f0((s.mem.dpMul - 1) * 100)} % to channel \(\Delta p\).`),
    ]; },
  post: c => { const p = c.post;
    return [
      eq(["CBE 430"], String.raw`\mathrm{CaCO_3(s) + CO_2 + H_2O \rightarrow Ca^{2+} + 2\,HCO_3^-}`, `Per mmol Ca: 100 mg CaCO₃ + 44 mg CO₂. ${f3(p.ca)} mmol/L × ${m3d(c.st.Qp)} m³/d → ${f1(p.limeKg / 1000)} t/d calcite, ${f1(p.co2Kg / 1000)} t/d CO₂ (30 % excess).`),
      eq(["CBE 430"], String.raw`\dfrac{C_{\mathrm{Ca}}}{C^{*}_{\mathrm{Ca}}} = 1 - \exp\!\left(-k_c\,\tau_{\mathrm{EBCT}}\right)`, String.raw`First order: \(k_c\) = ${p.kc} min⁻¹, \(\tau_{\mathrm{EBCT}}\) = ${p.ebct} min → ${f0(p.approach * 100)} % of target.`),
      eq(["CBE 311"], String.raw`\mathrm{LSI} = \mathrm{pH} - \mathrm{pH}_s`, `TDS ${f0(p.tds)} mg/L, hardness ${f0(p.hard)}, alkalinity ${f0(p.alk)} mg/L as CaCO₃, pH ${f1(p.pH)} → LSI ${f2(p.L.lsi)}. ≈ 0: no scaling, no attack on cement linings.`),
      eq(["CBE 311"], String.raw`\mathrm{HOCl \rightleftharpoons H^+ + OCl^-},\qquad \mathrm{p}K_a = 7.54`, `pH ${f1(p.pH)}: ${f0(p.hocl * 100)} % of free chlorine is HOCl (stronger disinfectant).`),
    ]; },
  tanks: c => { const p = c.post;
    return [
      eq(["CBE 250", "CBE 470"], String.raw`\tau = \dfrac{V}{Q},\qquad \dfrac{dV}{dt} = Q_{\mathrm{in}} - Q_{\mathrm{out}}`, String.raw`${f0(p.Vst)} m³ at ${m3d(c.st.Qp)} m³/d → \(\tau\) = ${f1(p.tau)} h. Level integrates supply − demand: needs feedback control.`),
      eq(["CBE 430"], String.raw`C = C_0\,\exp(-k_d\,\tau)`, String.raw`Plug flow: ${f2(p.dose)} × exp(−${p.kd} × ${f1(p.tau)}) = ${f2(p.resid)} mg/L. CSTR: \(C_0/(1 + k_d\tau)\) = ${f2(p.dose / (1 + p.kd * p.tau))} mg/L.`),
    ]; },
  outfall: c => { const o = c.st.out, s = c.st;
    return [
      eq(["CBE 311"], String.raw`\rho_b = \rho_w(T) + 0.765\,S`, String.raw`Brine ${f1(s.Sb)} g/kg: ${f1(o.rhoB)} vs ${f1(o.rhoA)} kg/m³ sea; \(g' = g\,\Delta\rho/\rho\) = ${f3(o.gp)} m/s².`),
      eq(["CBE 320"], String.raw`F = \dfrac{u}{\sqrt{g' d}}`, String.raw`${f0(s.Qb)} m³/h through 16 × 0.14 m ports → \(u\) = ${f2(o.uJet)} m/s, \(F\) = ${f1(o.Fr)}: inertia beats buoyancy, so the jet mixes before sinking.`),
      eq(["CBE 320", "CBE 326"], String.raw`\dfrac{z_t}{dF} = 2.2,\quad \dfrac{x_i}{dF} = 2.4,\quad \dfrac{S_i}{F} = 1.6`, `60° dense jet (Roberts et al. 1997): rise ${f1(o.rise)} m in ${PLANT.depthOut} m depth (no surfacing), impact at ${f1(o.xi)} m, dilution ${f0(o.Si)}:1.`),
      eq(["CBE 250"], String.raw`\Delta S = \dfrac{S_b - S_a}{S_i}`, `Excess salinity at impact +${f2(o.dS)} g/kg (${f1(o.dS / s.Sf * 100)} % above ambient).`),
    ]; },
};
STOPS.forEach(s => s.thermo = TH[s.id]);
STOPS.splice(STOPS.findIndex(s => s.id === "element") + 1, 0, ...MEMBRANE_STOPS);   // zoom: channel and membrane, then molecules

// course map for the side panel: [course, topic, stop]
export const COURSE_MAP = [
  ["CBE 250", "Water/salt balances, recovery, CF", "intake"],
  ["CBE 250", "PX mixing recycle; storage residence time", "px"],
  ["CBE 310", "Pump energy balance; CIP heating", "hp"],
  ["CBE 310", "ERD efficiency; minimum work", "px"],
  ["CBE 311", "Osmotic pressure: van't Hoff, Pitzer", "element"],
  ["CBE 311", "Activity, LSI, gypsum saturation", "cart"],
  ["CBE 311", "Boron and HOCl speciation", "element"],
  ["CBE 320", "Spacer Sherwood correlation", "element"],
  ["CBE 320", "Dense jets, densimetric Froude", "outfall"],
  ["CBE 320", "Intake continuity, Carman–Kozeny", "intake"],
  ["CBE 326", "Pipe friction, Darcy–Weisbach", "intake"],
  ["CBE 326", "Pump power and affinity laws", "intakePS"],
  ["CBE 326", "Spacer-channel pressure drop", "vessel"],
  ["CBE 426", "Solution–diffusion fluxes", "element"],
  ["CBE 426", "Concentration polarisation", "element"],
  ["CBE 426", "Element-by-element vessel model", "vessel"],
  ["CBE 426", "UF resistance in series, SDI", "uf"],
  ["CBE 430", "Arrhenius correction of A, B", "vessel"],
  ["CBE 430", "Calcite dissolution, chlorine decay", "post"],
  ["CBE 430", "Orthokinetic flocculation rate", "coag"],
  ["CBE 440", "Super duplex, PREN", "hp"],
  ["CBE 450", "Specific energy, ERD", "px"],
  ["CBE 470", "PI pressure control", "hp"],
  ["CBE 470", "Normalised permeate flow", "vessel"],
  ["CBE 540", "Polyamide TFC, PVDF", "element"],
  ["CBE 540", "Interfacial polymerisation", "molecular"],
  ["CBE 310", "Water chemical potential, activity", "molecular"],
  ["CBE 426", "Solution–diffusion: D·K, selectivity", "molecular"],
  ["CBE 426", "Boundary layer C(y), δ = D/k", "membrane"],
  ["CBE 311", "Dehydration, Donnan exclusion", "molecular"],
  ["CBE 547", "Coagulation, double layer", "coag"],
];

// ===================================================================================
// detail viewer: its own renderer, cutaway clipping, exploded view, numbered callouts
// ===================================================================================
export class DetailViewer {
  constructor(host) {
    this.host = host; this.canvas = host.querySelector("canvas"); this.callouts = host.querySelector(".callouts");
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true; this.renderer.localClippingEnabled = true;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color("#eef0f2");
    this.scene.environment = new THREE.PMREMGenerator(this.renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    const sun = new THREE.DirectionalLight("#ffffff", 1.6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    this.sun = sun; this.scene.add(sun, new THREE.HemisphereLight("#dfe8f0", "#3a3530", 0.6));
    this.floor = new THREE.Mesh(new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: "#eeeeee", roughness: 0.95 }));
    this.floor.receiveShadow = true; this.scene.add(this.floor);
    this.grid = new THREE.GridHelper(2, 20, "#c8c8c8", "#dddddd"); this.scene.add(this.grid);
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.01, 500);
    this.controls = new OrbitControls(this.camera, this.canvas); this.controls.enableDamping = true; this.controls.autoRotateSpeed = 0.6;
    this.clip = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0); this.clipY = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0); this.clipX = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
    this.cut = true; this.open = false; this.model = null;
    new ResizeObserver(() => this.resize()).observe(host);
  }
  resize() { const r = this.host.getBoundingClientRect(); if (!r.width) return; this.renderer.setSize(r.width, r.height, false); this.camera.aspect = r.width / r.height; this.camera.updateProjectionMatrix(); }
  show(stop) {
    if (this.model) { this.scene.remove(this.model.group); this.model.group.traverse(o => o.geometry?.dispose?.()); }
    const tok = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();   // follow the page theme
    this.scene.background.set(tok("--bg") || "#eef0f2"); this.floor.material.color.set(tok("--chip") || "#e2e7ec");
    const m = stop.model(); this.model = m; this.scene.add(m.group);
    const shells = []; m.group.traverse(o => { if (o.userData.shell && o.material) { o.material = o.material.clone(); o.material.side = THREE.DoubleSide; shells.push(o); } }); this.shells = shells;
    const bb = new THREE.Box3().setFromObject(m.group), c0 = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3()), c = m.target ? new THREE.Vector3(...m.target) : c0;
    const R = Math.max(sz.x, sz.z, sz.y * 0.6) * 0.8 + 0.3;
    this.floor.scale.setScalar(R); this.floor.position.y = bb.min.y - 0.002; this.grid.scale.setScalar(R); this.grid.position.y = bb.min.y;
    this.sun.position.set(c.x + R, c.y + R * 1.6, c.z + R * 1.2); this.sun.target.position.copy(c); this.scene.add(this.sun.target);
    Object.assign(this.sun.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 0.05, far: R * 6 }); this.sun.shadow.camera.updateProjectionMatrix();
    this.cz = 0; this.resize();
    const d = (m.fit ?? sz.length()) * Math.min(1.8, Math.max(1, 1.45 / Math.max(0.3, this.camera.aspect))) * 1.1;
    const cd = new THREE.Vector3(...(m.camDir ?? [0.5, 0.32, 0.85])).normalize().multiplyScalar(d * 1.03);
    this.camera.position.copy(c).add(cd); this.controls.target.copy(c);
    this.camera.near = d / 300; this.camera.far = d * 40; this.camera.updateProjectionMatrix();
    this.setCut(this.cut);
    const kids = m.group.children.filter(o => !o.isPoints && !o.isLine && !o.isInstancedMesh && !o.userData.noExplode);
    const ctr = c0.clone(); this.explode = 0; this.explodeT = this.explodeT ?? 0;
    const ax = m.explodeAxis ?? "x";
    this.kids = kids.map(o => { const b = new THREE.Box3().setFromObject(o), oc = b.getCenter(new THREE.Vector3()), dd = oc.clone().sub(ctr), dir = new THREE.Vector3();
      if (o.userData.shell) { if (ax === "x") dir.z = -Math.max(sz.y, sz.z, 0.2) * 1.4; else dir.x = Math.max(sz.x, 0.2) * 1.8; }
      else dir[ax] = dd[ax] * 0.8;
      return { o, home: o.position.clone(), dir, oc }; });
    this.partKid = m.parts.map(([, p]) => { let best = null, bd = 1e9; for (const k of this.kids) { if (k.o.userData.shell) continue; const q = k.oc.distanceTo(p); if (q < bd) { bd = q; best = k; } } return best; });
    this.callouts.innerHTML = m.parts.map(([n], i) => `<button class="co" data-i="${i}"><b>${i + 1}</b><span>${n}</span></button>`).join("");
    this.coEls = [...this.callouts.children]; this.coEls.forEach(el => el.onclick = () => this.focus(+el.dataset.i));
    this.focusT = null; this.open = true; this.resize();
    return m;
  }
  focus(i) {
    const p = this.partPos(i), d = Math.max(0.25, (this.model.fit ?? 2) * 0.35), dir = this.camera.position.clone().sub(this.controls.target).normalize();
    this.focusT = { t: 0, p0: this.camera.position.clone(), t0: this.controls.target.clone(), t1: p.clone(), p1: p.clone().addScaledVector(dir, d) };
    this.coEls.forEach((el, j) => el.classList.toggle("on", j === i)); this.onFocus?.(i);
  }
  partPos(i) { const k = this.partKid[i], p = this.model.parts[i][1].clone(); if (k) p.add(k.o.position).sub(k.home); return p; }
  setExplode(on) { this.explodeT = on ? 1 : 0; }
  setCut(on) { this.cut = on; const w = this.model?.wedge; for (const o of this.shells || []) { o.material.clippingPlanes = on ? (w ? [this.clip, this.clipY, this.clipX] : [this.clip]) : []; o.material.clipIntersection = !!w; o.material.needsUpdate = true; } this.model?.onCut?.(on); }
  render(dt, live) {
    if (!this.open || !this.model) return;
    this.model.update?.(dt, live || {});
    this.explode += (this.explodeT - this.explode) * Math.min(1, dt * 3);
    for (const k of this.kids) k.o.position.copy(k.home).addScaledVector(k.dir, this.explode);
    if (this.focusT) { const f = this.focusT; f.t = Math.min(1, f.t + dt / 1.1); const u = f.t * f.t * (3 - 2 * f.t);
      this.camera.position.lerpVectors(f.p0, f.p1, u); this.controls.target.lerpVectors(f.t0, f.t1, u); if (f.t >= 1) this.focusT = null; }
    this.controls.update();
    const sgn = this.camera.position.z >= this.cz ? 1 : -1;      // remove the half of each shell nearest the camera
    this.clip.normal.set(0, 0, -sgn); this.clip.constant = sgn * this.cz;
    this.renderer.render(this.scene, this.camera);
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight, P = new THREE.Vector3();
    this.model.parts.forEach((_, i) => {
      P.copy(this.partPos(i)).applyMatrix4(this.model.group.matrixWorld).project(this.camera); const el = this.coEls[i];
      const vis = P.z < 1 && Math.abs(P.x) < 1.05 && Math.abs(P.y) < 1.05;
      el.style.display = vis ? "" : "none"; if (vis) el.style.transform = `translate(${(P.x * 0.5 + 0.5) * w}px, ${(-P.y * 0.5 + 0.5) * h}px)`;
    });
  }
}
