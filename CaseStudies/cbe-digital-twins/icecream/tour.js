// Guided tour of the ice cream line: stops with specs, live readings, "Equations at work" with UW–Madison CBE
// course tags, detailed cutaway models (numbered callouts, cutaway clip, exploded view) and the course map.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { LM, TG_PRIME, PLANT, PACKAGES, nh3, recrystRate, perGallon } from "./models.js";

const f0 = v => Math.round(v).toLocaleString(), f1 = v => v.toFixed(1), f2 = v => v.toFixed(2), f3 = v => v.toFixed(3);
const I = v => `<i>${v}</i>`;

// ---------- courses (titles confirmed from guide.wisc.edu search results, Nov 2026; see README) ----------
export const COURSES = {
  "CBE 250": ["Process Synthesis", "c250", "Balances"],
  "CBE 310": ["Chemical Process Thermodynamics", "c310", "Thermo"],
  "CBE 311": ["Thermodynamics of Mixtures", "c311", "Mixtures"],
  "CBE 320": ["Introductory Transport Phenomena", "c320", "Transport"],
  "CBE 326": ["Momentum and Heat Transfer Operations", "c326", "Fluids & Heat"],
  "CBE 426": ["Mass Transfer Operations", "c426", "Mass Transfer"],
  "CBE 430": ["Chemical Kinetics and Reactor Design", "c430", "Kinetics & Reactors"],
  "CBE 440": ["Chemical Engineering Materials", "cel", "Materials"],
  "CBE 450": ["Process Design", "c450", "Design"],
  "CBE 470": ["Process Dynamics and Control", "c470", "Control"],
  "CBE 540": ["Polymer Science and Technology", "cel", "Polymers"],
  "CBE 547": ["Colloid and Interface Science", "cel", "Colloids"],
  "CBE 560": ["Biochemical Engineering", "cel", "Biochem"],
  "FOOD SCI 511": ["Chemistry and Technology of Dairy Products", "cfs", "Food Science"],
  "FOOD SCI 410": ["Food Chemistry", "cfs", "Food Science"],
};
export const courseURL = c => `https://guide.wisc.edu/search/?P=${encodeURIComponent(c)}`;
// tag(c): a link chip to the course's catalog entry; tag(c, false): plain chip (inside buttons)
export const courseLabel = c => COURSES[c]?.[2] ?? c;
export const tag = (c, link = true) => { const [title, cls] = COURSES[c] ?? [c, "cel"], ttl = `${c}: ${title}`;
  return link ? `<a class="course" href="${courseURL(c)}" target="_blank" rel="noopener" title="${ttl}">${courseLabel(c)} ↗</a>`
              : `<span class="course" title="${ttl}">${courseLabel(c)}</span>`; };
export const seen = c => `<a class="course" href="${courseURL(c)}" target="_blank" rel="noopener" title="${c}: ${COURSES[c]?.[0] ?? ""}">Seen in ${courseLabel(c)} ↗</a>`;
const eq = (courses, html, note) => ({ courses, html, note });

// ---------- materials & helpers for detail models ----------
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.5, ...o });
const MT = {
  ss: () => mat("#d3d8dc", { metalness: 0.6, roughness: 0.3 }),
  nickel: () => mat("#b9b7ae", { metalness: 0.95, roughness: 0.2 }),
  dark: () => mat("#454b50", { metalness: 0.7, roughness: 0.45 }),
  card: () => mat("#c5050c", { metalness: 0.2, roughness: 0.45 }),
  blue: () => mat("#2f5d86", { metalness: 0.4, roughness: 0.4 }),
  yellow: () => mat("#e2b42a", { metalness: 0.2, roughness: 0.5 }),
  insul: () => mat("#f0eee8", { metalness: 0, roughness: 0.8 }),
  white: () => mat("#f3f5f6", { metalness: 0.05, roughness: 0.5 }),
  ice: () => mat("#e8f4fb", { metalness: 0, roughness: 0.15, transparent: true, opacity: 0.75 }),
  nh3: () => mat("#7fb6d6", { metalness: 0, roughness: 0.1, transparent: true, opacity: 0.45 }),
  gasket: (c) => mat(c, { metalness: 0, roughness: 0.7 }),
  ceramic: () => mat("#e9e3d6", { metalness: 0, roughness: 0.3 }),
  carbide: () => mat("#6d7176", { metalness: 0.9, roughness: 0.3 }),
  creamy: () => mat("#f3ead2", { metalness: 0, roughness: 0.6 }),
};
function add(parent, geo, m, x = 0, y = 0, z = 0) { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; parent.add(o); return o; }
const cyl = (r, h, s = 40, r2 = r, open = false) => new THREE.CylinderGeometry(r2, r, h, s, 1, open);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
function tube(rOut, rIn, len, seg = 64) { const p = [[rIn, -len / 2], [rOut, -len / 2], [rOut, len / 2], [rIn, len / 2], [rIn, -len / 2]].map(([a, b]) => new THREE.Vector2(a, b)); return new THREE.LatheGeometry(p, seg); }
const alongX = g => g.rotateZ(-Math.PI / 2);
function pipe(parent, a, b, r, m, seg = 16) { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), L = d.length(); const o = add(parent, cyl(r, L, seg), m); o.position.copy(A).addScaledVector(d, 0.5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return o; }
function shell(o) { o.userData.shell = true; return o; }
function label(parts, name, x, y, z) { parts.push([name, new THREE.Vector3(x, y, z)]); }
function tracers(parent, n, color, size, vc = false) {
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); if (vc) g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const m = new THREE.PointsMaterial({ color: vc ? "#ffffff" : color, vertexColors: vc, size, sizeAttenuation: true, transparent: true, opacity: 0.95, depthWrite: false });
  const p = new THREE.Points(g, m); p.frustumCulled = false; parent.add(p);
  const R = () => new Float32Array(n).map(() => Math.random());
  return { pos, col, geo: g, n, mat: m, u: R(), a: R(), b: R() };
}
// temperature colour (shared with the plant view): −40 deep blue … 0 pale … 85 red
export function tcol(T, out = new THREE.Color()) {
  const S = [[-40, "#1d3f8f"], [-20, "#3b7dc4"], [-5, "#9cc8e8"], [4, "#e9eef0"], [40, "#f2b27a"], [85, "#b8222b"]];
  if (T <= S[0][0]) return out.set(S[0][1]);
  for (let i = 1; i < S.length; i++) if (T <= S[i][0]) { const u = (T - S[i - 1][0]) / (S[i][0] - S[i - 1][0]); return out.set(S[i - 1][1]).lerp(new THREE.Color(S[i][1]), u); }
  return out.set(S.at(-1)[1]);
}

// ===================================================================================
// detailed models: each returns { group, parts, update(dt, live), fit, explodeAxis }
// ===================================================================================

// 1. Scraped-surface freezer (freezing cylinder with ammonia jacket, dasher, blades, air injection)
function freezerModel(R) {
  const g = new THREE.Group(), parts = [], L = 1.2, rb = PLANT.Dbar / 2, rd = PLANT.Ddash / 2;
  shell(add(g, alongX(tube(0.19, 0.16, L, 64)), MT.insul()));                    // insulation + outer jacket
  shell(add(g, alongX(tube(0.125, 0.118, L, 64)), MT.ss()));                     // jacket wall
  const nh3m = MT.nh3(); shell(add(g, alongX(tube(0.118, rb + 0.006, L - 0.02, 64)), nh3m));   // flooded NH3 annulus
  shell(add(g, alongX(tube(rb + 0.006, rb, L, 64)), MT.nickel()));               // freezing cylinder (nickel)
  const iceL = shell(add(g, alongX(tube(rb, rb - 0.0025, L - 0.05, 64)), MT.ice()));    // scraped ice film at the wall
  for (const s of [-1, 1]) shell(add(g, alongX(cyl(0.19, 0.03, 64)), MT.ss(), s * (L / 2 + 0.015), 0, 0));
  // dasher: solid core, support bars, two floating scraper blades
  const dash = new THREE.Group(); g.add(dash);
  add(dash, alongX(cyl(rd, L - 0.04, 48)), MT.ss());
  for (const s of [-1, 1]) add(dash, alongX(cyl(0.02, 0.35, 20)), MT.ss(), s * (L / 2 + 0.17), 0, 0);
  for (let k = 0; k < 2; k++) {
    const a = k * Math.PI, bar = new THREE.Group(); bar.rotation.x = a; dash.add(bar);
    for (const x of [-0.45, -0.15, 0.15, 0.45]) add(bar, box(0.02, rb - rd - 0.01, 0.015), MT.ss(), x, (rb + rd) / 2 - 0.004, 0);
    const blade = add(bar, box(L - 0.08, 0.004, 0.028), MT.carbide(), 0, rb - 0.006, 0.008); blade.rotation.x = 0.35;
  }
  // beater (whipping) rods inside the hollow dasher zone, counter-rotating in real machines
  // drive: motor + gearbox at the left, outlet head at the right
  const drive = new THREE.Group(); drive.position.x = -L / 2 - 0.45; g.add(drive);
  add(drive, alongX(cyl(0.12, 0.35, 32)), MT.blue(), -0.1, 0, 0); add(drive, box(0.18, 0.26, 0.26), MT.dark(), 0.18, 0, 0);
  const head = new THREE.Group(); head.position.x = L / 2 + 0.12; g.add(head);
  add(head, alongX(cyl(0.12, 0.14, 40)), MT.ss()); pipe(head, [0.05, 0.08, 0], [0.05, 0.32, 0], 0.025, MT.ss());
  // inlets: mix and air injection (bottom left), NH3 liquid feed and vapour return
  const inl = new THREE.Group(); g.add(inl);
  pipe(inl, [-L / 2 + 0.06, -0.12, 0], [-L / 2 + 0.06, -0.34, 0], 0.022, MT.ss());
  pipe(inl, [-L / 2 + 0.18, -0.12, 0.05], [-L / 2 + 0.18, -0.3, 0.12], 0.008, MT.yellow());
  pipe(inl, [-0.3, -0.19, 0], [-0.3, -0.4, 0], 0.03, MT.insul()); pipe(inl, [0.35, 0.19, 0], [0.35, 0.45, 0], 0.045, MT.insul());
  const nh3b = tracers(g, 260, "#dff1fb", 0.006);
  const mix = tracers(g, 1600, "#ffffff", 0.013, true);
  label(parts, "Freezing cylinder, nickel, 180 mm ID", 0, rb, 0);
  label(parts, "Flooded ammonia jacket (boiling NH₃)", -0.2, 0.115, 0);
  label(parts, "Ice film scraped from the wall", 0.3, -rb + 0.004, 0.01);
  label(parts, "Floating scraper blades (2)", -0.1, rb - 0.01, 0.01);
  label(parts, "Solid dasher core (sets annulus volume)", 0.1, 0, rd);
  label(parts, "Mix inlet from ageing tanks", -L / 2 + 0.06, -0.3, 0);
  label(parts, "Air injection (overrun control)", -L / 2 + 0.18, -0.27, 0.1);
  label(parts, "Drive motor and gearbox", -L / 2 - 0.5, 0.1, 0);
  label(parts, "Outlet head: ice cream at draw temperature", L / 2 + 0.12, 0.25, 0);
  label(parts, "NH₃ vapour return to compressor suction", 0.35, 0.42, 0);
  label(parts, "Insulation and outer jacket", -0.45, 0.19, 0);
  return {
    group: g, parts, fit: 2.3, explodeAxis: "x",
    update(dt, live) {
      const rpm = PLANT.Ndash, I = live.I ?? 0.3, Tin = 4, Td = live.Tdraw ?? -5.5;
      dash.rotation.x += dt * rpm / 60 * Math.PI * 2 * 0.25;            // shown at 1/4 speed
      iceL.material.opacity = 0.3 + 0.6 * Math.min(1, I / 0.45);
      const c = new THREE.Color();
      for (let i = 0; i < mix.n; i++) {
        mix.u[i] += dt * 0.08; if (mix.u[i] > 1) mix.u[i] -= 1;
        const u = mix.u[i], r = rd + 0.004 + mix.a[i] * (rb - rd - 0.008), an = mix.b[i] * Math.PI * 2 + dash.rotation.x * 0.7 + u * 6;
        mix.pos.set([-L / 2 + 0.03 + u * (L - 0.06), Math.cos(an) * r, Math.sin(an) * r], i * 3);
        const T = Tin + (Td - Tin) * Math.min(1, u * 1.3); tcol(T, c); if (mix.a[i] > 0.7 && u > 0.2) c.set("#ffffff");   // air cells
        mix.col.set([c.r, c.g, c.b], i * 3);
      }
      mix.geo.attributes.position.needsUpdate = true; mix.geo.attributes.color.needsUpdate = true;
      for (let i = 0; i < nh3b.n; i++) {
        nh3b.u[i] += dt * (0.3 + 0.5 * nh3b.a[i]); if (nh3b.u[i] > 1) { nh3b.u[i] = 0; nh3b.b[i] = Math.random(); }
        const an = nh3b.b[i] * Math.PI * 2, r = rb + 0.012 + nh3b.u[i] * 0.02 * Math.abs(Math.sin(an));
        nh3b.pos.set([-L / 2 + 0.05 + nh3b.a[i] * (L - 0.1), Math.sin(an) * r + nh3b.u[i] * 0.02, Math.cos(an) * r], i * 3);
      }
      nh3b.geo.attributes.position.needsUpdate = true;
    },
  };
}

// 2. HTST plate heat exchanger (plate counts from the live sizing)
function plateModel(R) {
  const g = new THREE.Group(), parts = [], ht = R.ht;
  const nR = Math.min(70, ht.nReg), nH = Math.min(30, ht.nHeat), nC = Math.min(40, ht.nCool), pitch = 0.012;
  const chev = (() => { const c = document.createElement("canvas"); c.width = 64; c.height = 256; const x = c.getContext("2d"); x.fillStyle = "#808080"; x.fillRect(0, 0, 64, 256);
    x.strokeStyle = "#ffffff"; x.lineWidth = 3; for (let y = -64; y < 320; y += 12) { x.beginPath(); x.moveTo(0, y); x.lineTo(32, y + 16); x.lineTo(64, y); x.stroke(); }
    const t = new THREE.CanvasTexture(c); return t; })();
  const pm = mat("#e3e7ea", { metalness: 0.6, roughness: 0.35, bumpMap: chev, bumpScale: 0.003 });
  const gk = { reg: MT.gasket("#4a4d50"), heat: MT.gasket("#8a2b22"), cool: MT.gasket("#244c78") };
  let x = -0.9;
  const frameF = shell(add(g, box(0.08, 1.35, 0.62), MT.ss(), x - 0.06, 0.68, 0));
  const sections = [["reg", nR], ["heat", nH], ["cool", nC]], secX = {};
  for (const [s, n] of sections) {
    secX[s] = [x];
    for (let k = 0; k < n; k++) {
      const pl = new THREE.Group(); pl.position.set(x + 0.005, 0.68, 0); g.add(pl);
      add(pl, box(0.004, 1.1, 0.45), pm).castShadow = false;
      for (const [yy, zz, hh, dd] of [[0, 0.232, 1.12, 0.016], [0, -0.232, 1.12, 0.016], [0.555, 0, 0.016, 0.48], [-0.555, 0, 0.016, 0.48]]) add(pl, box(0.006, hh, dd), gk[s], 0, yy, zz).castShadow = false;
      x += pitch; }
    secX[s].push(x);
    if (s !== "cool") { add(g, box(0.05, 1.3, 0.6), MT.dark(), x + 0.03, 0.68, 0); x += 0.07; }
  }
  const pressP = shell(add(g, box(0.07, 1.25, 0.6), MT.ss(), x + 0.05, 0.68, 0));
  const xEnd = x + 0.4;
  add(g, box(0.1, 1.45, 0.62), MT.ss(), xEnd, 0.73, 0);
  shell(add(g, box(xEnd - (-0.96), 0.08, 0.08), MT.dark(), (xEnd - 0.96) / 2, 1.42, 0));
  add(g, box(xEnd + 0.96, 0.05, 0.05), MT.dark(), (xEnd - 0.96) / 2, 0.08, 0);
  for (const z of [-0.33, 0.33]) for (const y of [0.15, 1.2]) add(g, alongX(cyl(0.012, x + 1.1, 10)), MT.dark(), (x - 0.98) / 2 + 0.05, y, z);
  // ports on the frame plate
  for (const [y, z] of [[0.3, -0.15], [1.05, -0.15], [0.3, 0.15], [1.05, 0.15]]) add(g, alongX(cyl(0.035, 0.18, 20)), MT.ss(), -1.07, y, z);
  // flow tracers: product and service streams between plates, alternating channels
  const flow = tracers(g, 1600, "#fff", 0.012, true);
  const xs = s => secX[s];
  label(parts, "Fixed frame plate with product and media ports", -0.98, 1.1, 0.2);
  label(parts, `Regeneration: ${nR} plates, raw mix ⇄ pasteurised mix`, (xs("reg")[0] + xs("reg")[1]) / 2, 1.24, 0.1);
  label(parts, `Heating: ${nH} plates, hot water`, (xs("heat")[0] + xs("heat")[1]) / 2, 1.24, 0.1);
  label(parts, `Cooling: ${nC} plates, ice water`, (xs("cool")[0] + xs("cool")[1]) / 2, 1.24, 0.1);
  label(parts, "Connection grid (section divider with ports)", xs("reg")[1] + 0.03, 0.4, 0.3);
  label(parts, "Chevron-pressed 316 plate, 0.5 mm, EPDM gasket", xs("reg")[0] + 0.05, 0.68, 0.22);
  label(parts, "Pressure plate", x + 0.05, 0.68, 0.3);
  label(parts, "Carrying bar", 0, 1.42, 0);
  label(parts, "Tightening bolts set the pack length", 0, 0.15, 0.33);
  return {
    group: g, parts, fit: 2.4, explodeAxis: "x",
    update(dt, live) {
      const c = new THREE.Color(), T = live.htT || {};
      for (let i = 0; i < flow.n; i++) {
        flow.u[i] += dt * 0.35; if (flow.u[i] > 1) flow.u[i] -= 1;
        const sIdx = flow.a[i] < 0.6 ? "reg" : flow.a[i] < 0.75 ? "heat" : "cool", [x0, x1] = secX[sIdx];
        const ch = Math.floor(flow.b[i] * Math.max(1, (x1 - x0) / pitch)), xx = x0 + (ch + 0.5) * pitch, odd = ch % 2;
        const up = odd ? 1 - flow.u[i] : flow.u[i], y = 0.18 + up * 1.0, z = Math.sin(flow.u[i] * 30 + ch) * 0.15;
        flow.pos.set([xx, y, z], i * 3);
        let t;
        if (sIdx === "reg") t = odd ? T.hotIn + (T.hotOut - T.hotIn) * (1 - up) : T.rawIn + (T.rawOut - T.rawIn) * up;
        else if (sIdx === "heat") t = odd ? T.hw : T.rawOut + (T.heated - T.rawOut) * up;
        else t = odd ? 1 + 3 * up : T.hotOut + (4 - T.hotOut) * up;
        tcol(t ?? 20, c); flow.col.set([c.r, c.g, c.b], i * 3);
      }
      flow.geo.attributes.position.needsUpdate = true; flow.geo.attributes.color.needsUpdate = true;
    },
  };
}

// 3. Two-stage homogenising valve head (true size, ~0.3 m)
function homogValveModel(R) {
  const g = new THREE.Group(), parts = [], hom = R.hom;
  const gap = Math.max(0.0006, hom.gap * 12);                                   // gap drawn ×12 so it is visible
  shell(add(g, box(0.16, 0.16, 0.16), MT.ss(), 0, 0, 0));                         // valve block
  // first stage (y up): seat, forcer, impact ring, hydraulic actuator
  const s1 = new THREE.Group(); g.add(s1);
  add(s1, tube(0.03, 0.012, 0.03, 48), MT.carbide(), 0, 0.095, 0);               // seat
  const forcer = add(s1, cyl(0.03, 0.035, 48, 0.026), MT.carbide(), 0, 0.11 + 0.0175 + gap, 0);
  add(s1, tube(0.04, 0.034, 0.03, 48), MT.ceramic(), 0, 0.11 + gap, 0);           // impact ring
  shell(add(s1, tube(0.06, 0.042, 0.12, 48), MT.ss(), 0, 0.17, 0));             // bonnet
  add(s1, cyl(0.045, 0.1, 40), MT.card(), 0, 0.3, 0);                            // hydraulic actuator
  add(s1, cyl(0.012, 0.12, 16), MT.ss(), 0, 0.2, 0);
  // second stage, offset along x, lower pressure
  const s2 = new THREE.Group(); s2.position.set(0.25, 0, 0); g.add(s2);
  shell(add(s2, box(0.12, 0.12, 0.12), MT.ss()));
  add(s2, tube(0.025, 0.01, 0.025, 40), MT.carbide(), 0, 0.072, 0);
  add(s2, cyl(0.025, 0.03, 40, 0.022), MT.carbide(), 0, 0.085 + 0.015 + gap * 0.4, 0);
  shell(add(s2, tube(0.05, 0.035, 0.1, 40), MT.ss(), 0, 0.14, 0)); add(s2, cyl(0.035, 0.08, 32), MT.blue(), 0, 0.24, 0);
  pipe(g, [0.08, 0.02, 0], [0.19, 0.02, 0], 0.012, MT.ss());
  // plunger pump manifold below (inlet)
  const pm = new THREE.Group(); pm.position.y = -0.2; g.add(pm);
  shell(add(pm, box(0.42, 0.12, 0.16), MT.ss()));
  const plungers = [-0.12, 0, 0.12].map(x => add(pm, alongX(cyl(0.018, 0.2, 20)).rotateY(Math.PI / 2), MT.ceramic(), x, 0, 0.16));
  pipe(g, [0, -0.14, 0], [0, 0.08, 0], 0.012, MT.ss());
  const jet = tracers(g, 900, "#fff", 0.0022, true);
  label(parts, "1st-stage seat (tungsten carbide)", 0.03, 0.095, 0);
  label(parts, `Valve forcer · gap ≈ ${f0(hom.gap * 1e6)} µm (drawn ×12)`, 0, 0.13, 0.02);
  label(parts, "Impact ring", 0.04, 0.11, 0);
  label(parts, `Hydraulic actuator sets P₁ = ${f1(hom.P1)} MPa`, 0, 0.3, 0.04);
  label(parts, `2nd stage, P₂ = ${f1(hom.P2)} MPa: breaks fat clusters`, 0.25, 0.1, 0.02);
  label(parts, "Ceramic plungers (3) of the positive-displacement pump", 0, -0.2, 0.2);
  label(parts, "Valve block (outlet to holding tube)", -0.08, 0, 0.08);
  return {
    group: g, parts, fit: 0.75, explodeAxis: "y",
    update(dt, live) {
      const t = performance.now() / 1000; plungers.forEach((p, k) => p.position.z = 0.16 + 0.03 * Math.sin(t * 6 + k * 2.094));
      const c = new THREE.Color(), dRaw = hom.d32raw, d = hom.d32;
      for (let i = 0; i < jet.n; i++) {
        jet.u[i] += dt * 0.5; if (jet.u[i] > 1) jet.u[i] -= 1;
        const u = jet.u[i], an = jet.b[i] * Math.PI * 2; let x, y, z, after;
        if (u < 0.45) { const k = u / 0.45; x = (jet.a[i] - 0.5) * 0.015; y = -0.14 + k * 0.245; z = (jet.b[i] - 0.5) * 0.015; after = false; }
        else if (u < 0.65) { const k = (u - 0.45) / 0.2, r = 0.012 + k * 0.03; x = Math.cos(an) * r; y = 0.11 + gap / 2; z = Math.sin(an) * r; after = k > 0.4; }
        else { const k = (u - 0.65) / 0.35; x = Math.cos(an) * 0.045 + k * 0.2; y = 0.11 - k * 0.09; z = Math.sin(an) * 0.045 * (1 - k); after = true; }
        jet.pos.set([x, y, z], i * 3);
        c.set(after ? "#fff4cf" : "#e4b85a"); jet.col.set([c.r, c.g, c.b], i * 3);
      }
      jet.mat.size = 0.0035; jet.geo.attributes.position.needsUpdate = true; jet.geo.attributes.color.needsUpdate = true;
    },
  };
}

// 4. Deep-freeze room (hardening and storage at −20 °F): cutaway panels, ceiling evaporators, racks of cups and tubs
function roomModel(R) {
  const g = new THREE.Group(), parts = [], w = 8, d = 6, h = 4;
  for (const [x, z, ww, dd] of [[0, -d / 2, w, 0.15], [0, d / 2, w, 0.15], [-w / 2, 0, 0.15, d], [w / 2, 0, 0.15, d]]) shell(add(g, box(ww, h, dd), MT.white(), x, h / 2, z));
  shell(add(g, box(w, 0.15, d), MT.white(), 0, h, 0));
  add(g, box(w, 0.08, d), mat("#d9dcde", { metalness: 0, roughness: 0.7 }), 0, 0.04, 0);
  // panel section (insulation core) shown at the cut edge
  add(g, box(w, h, 0.15), mat("#f1d46b", { metalness: 0, roughness: 0.9 }), 0, h / 2, -d / 2 - 0.16).visible = false;
  // ceiling evaporator: finned coil + fans
  const ev = new THREE.Group(); ev.position.set(0, h - 0.6, -d / 2 + 0.7); g.add(ev);
  add(ev, box(3.6, 0.8, 1.0), MT.white());
  for (let k = 0; k < 30; k++) add(ev, box(0.01, 0.7, 0.9), MT.ss(), -1.6 + k * 0.11, 0, 0.05).castShadow = false;
  const fans = []; for (let f = 0; f < 3; f++) { const fan = new THREE.Group(); fan.position.set(-1.1 + f * 1.1, 0, 0.52); ev.add(fan); add(fan, tube(0.36, 0.33, 0.08, 32).rotateX(Math.PI / 2), MT.dark()); for (let b = 0; b < 5; b++) { const bl = add(fan, box(0.06, 0.55, 0.02), MT.ss()); bl.rotation.z = b / 5 * Math.PI * 2; } fans.push(fan); }
  const frost = add(ev, box(3.62, 0.82, 1.02), new THREE.MeshStandardMaterial({ color: "#f8fcff", roughness: 1, transparent: true, opacity: 0.2 }));
  // racks: accumulation shelves with pints, pallets of 3-gallon tubs
  const shelves = new THREE.Group(); g.add(shelves);
  for (let t = 0; t < 3; t++) add(shelves, box(3.0, 0.05, 2.0), MT.ss(), -2.0, 0.6 + t * 0.9, 0.6);
  for (const x of [-3.5, -0.5]) for (const z of [-0.4, 1.6]) add(shelves, box(0.05, 2.6, 0.05), MT.ss(), x, 1.3, z);
  const NC = 3 * 14 * 9, cups = new THREE.InstancedMesh(cyl(0.045, 0.085, 12, 0.042), MT.card(), NC); cups.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(NC * 3), 3); g.add(cups);
  const M4 = new THREE.Matrix4(); let n = 0, slots = [];
  for (let t = 0; t < 3; t++) for (let a = 0; a < 14; a++) for (let b = 0; b < 9; b++) { M4.makeTranslation(-3.3 + a * 0.2, 0.67 + t * 0.9, -0.2 + b * 0.2); cups.setMatrixAt(n++, M4); slots.push(t); }
  const pal = new THREE.Group(); pal.position.set(2.0, 0, 0.8); g.add(pal); add(pal, box(1.2, 0.14, 1.0), MT.dark(), 0, 0.07, 0);
  for (let l = 0; l < 2; l++) for (let a = 0; a < 4; a++) for (let b = 0; b < 3; b++) add(pal, cyl(0.133, 0.255, 20, 0.125), MT.card(), -0.42 + a * 0.28, 0.27 + l * 0.27, -0.3 + b * 0.3);
  add(g, box(0.15, 2.4, 1.6), MT.yellow(), w / 2, 1.2, 1.5);
  const air = tracers(g, 900, "#bfe0ff", 0.035);
  label(parts, "Insulated panels (PIR core, stainless or coated steel skins)", 0, h, -d / 2);
  label(parts, "Ceiling evaporator: ammonia boils inside the finned coil", 0, h - 0.6, -d / 2 + 0.7);
  label(parts, "Fans: high air speed = 'wind chill' (higher h)", -1.1, h - 0.6, -d / 2 + 1.25);
  label(parts, "Frost on the fins, cleared by hot-gas defrost", 1.2, h - 1.0, -d / 2 + 1.1);
  label(parts, "Pints hardening on open shelves (air on every side)", -2.0, 2.4, 0.6);
  label(parts, "3-gallon tubs on a pallet (slowest to harden)", 2.0, 0.8, 0.8);
  label(parts, "Door with strip curtain from the filling room", w / 2, 1.6, 1.5);
  const C = new THREE.Color();
  return {
    group: g, parts, fit: 11, explodeAxis: "x",
    update(dt, live) {
      for (const f of fans) f.rotation.z += dt * 14;
      frost.material.opacity = 0.15 + 0.5 * Math.min(1, Math.max(0, (-(live.Thard ?? -29) - 15) / 25));
      const hist = live.hardHist || [], tC = live.tCore || 3600;
      for (let i = 0; i < NC; i++) { const th = ((i * 7919) % NC) / NC * tC / 3600; let T = live.Tdraw ?? -6; for (const hh of hist) { if (hh[0] > th) break; T = hh[1]; } tcol(T, C); C.lerp(new THREE.Color("#c5050c"), 0.3); cups.setColorAt(i, C); }
      cups.instanceColor.needsUpdate = true;
      for (let i = 0; i < air.n; i++) { air.u[i] += dt * 0.3; if (air.u[i] > 1) air.u[i] -= 1; const u = air.u[i];
        const x = -3.5 + air.a[i] * 7, y = u < 0.5 ? h - 0.9 - u * 2 * (h - 1.2) : 0.3 + (u - 0.5) * 2 * (h - 1.5), z = u < 0.5 ? -d / 2 + 1.2 + u * 2 * (d - 2) : d / 2 - 0.8 - (u - 0.5) * 2 * (d - 2);
        air.pos.set([x, y, z + (air.b[i] - 0.5) * 0.5], i * 3); }
      air.geo.attributes.position.needsUpdate = true;
    },
  };
}

// 5. Ammonia screw compressor (twin rotors, slide valve, oil injection)
function rotorGeo(lobes, rRoot, rTip, len, twist, concave) {
  const sh = new THREE.Shape(), n = 240;
  for (let k = 0; k <= n; k++) { const th = k / n * Math.PI * 2, c = Math.cos(lobes * th);
    const r = concave ? rTip - (rTip - rRoot) * Math.pow(Math.max(0, c), 0.6) : rRoot + (rTip - rRoot) * Math.pow(Math.max(0, c), 0.5);
    const x = Math.cos(th) * r, y = Math.sin(th) * r; k ? sh.lineTo(x, y) : sh.moveTo(x, y); }
  const geo = new THREE.ExtrudeGeometry(sh, { depth: len, steps: 48, bevelEnabled: false, curveSegments: 1 });
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const a = v.z / len * twist; p.setXYZ(i, v.x * Math.cos(a) - v.y * Math.sin(a), v.x * Math.sin(a) + v.y * Math.cos(a), v.z - len / 2); }
  geo.computeVertexNormals(); geo.rotateY(Math.PI / 2); return geo;
}
function compressorModel(R) {
  const g = new THREE.Group(), parts = [], L = 0.9;
  const male = new THREE.Group(); male.position.set(0, 0.11, 0); g.add(male);
  add(male, rotorGeo(4, 0.06, 0.13, L, Math.PI * 1.6, false), mat("#c3c8cb", { metalness: 1, roughness: 0.22 }));
  add(male, alongX(cyl(0.035, L + 0.5, 24)), MT.ss());
  const female = new THREE.Group(); female.position.set(0, -0.12, 0); g.add(female);
  add(female, rotorGeo(6, 0.075, 0.12, L, -Math.PI * 1.07, true), mat("#aeb4b8", { metalness: 1, roughness: 0.25 }));
  add(female, alongX(cyl(0.035, L + 0.4, 24)), MT.ss());
  // casing (two overlapping bores) and end covers
  shell(add(g, alongX(tube(0.19, 0.135, L, 64)), MT.card(), 0, 0.11, 0));
  shell(add(g, alongX(tube(0.18, 0.125, L, 64)), MT.card(), 0, -0.12, 0));
  for (const s of [-1, 1]) shell(add(g, box(0.06, 0.62, 0.42), MT.card(), s * (L / 2 + 0.03), 0, 0));
  // slide valve under the rotors (capacity control)
  const slide = add(g, box(0.45, 0.05, 0.12), MT.yellow(), 0.15, -0.005, -0.15);
  // suction (top, inlet end) and discharge (bottom, outlet end) ports
  shell(add(g, cyl(0.1, 0.25, 32), MT.card(), -0.25, 0.38, 0)); add(g, cyl(0.14, 0.04, 32), MT.dark(), -0.25, 0.51, 0);
  shell(add(g, cyl(0.08, 0.22, 32), MT.card(), 0.3, -0.38, 0)); add(g, cyl(0.12, 0.04, 32), MT.dark(), 0.3, -0.5, 0);
  // motor coupling and oil injection line
  const cpl = new THREE.Group(); cpl.position.set(-L / 2 - 0.35, 0.11, 0); g.add(cpl);
  add(cpl, alongX(cyl(0.09, 0.12, 24)), MT.yellow()); add(cpl, alongX(cyl(0.22, 0.5, 40)), MT.blue(), -0.4, 0, 0);
  pipe(g, [0, 0.3, 0.2], [0.2, 0.3, 0.2], 0.012, MT.dark()); pipe(g, [0.2, 0.3, 0.2], [0.2, 0.15, 0.17], 0.012, MT.dark());
  const gas = tracers(g, 900, "#fff", 0.008, true);
  label(parts, "Male rotor, 4 lobes (driven)", 0, 0.24, 0.05);
  label(parts, "Female rotor, 6 flutes", 0.1, -0.24, 0.05);
  label(parts, "Casing, 2 intersecting bores", -0.2, 0.3, -0.1);
  label(parts, "Suction port: NH₃ vapour from the surge drum", -0.25, 0.5, 0);
  label(parts, "Discharge port to oil separator", 0.3, -0.5, 0);
  label(parts, "Slide valve: 10–100 % capacity control", 0.15, -0.005, -0.15);
  label(parts, "Oil injection: seals, cools, lubricates", 0.2, 0.3, 0.2);
  label(parts, "Coupling to 2-pole motor", -L / 2 - 0.35, 0.2, 0);
  return {
    group: g, parts, fit: 2.0, explodeAxis: "x",
    update(dt, live) {
      const sp = dt * 6;
      male.rotation.x += sp; female.rotation.x -= sp * 4 / 6; cpl.rotation.x += sp;
      slide.position.x = 0.15 - 0.2 * (1 - (live.load ?? 0.7));
      const c = new THREE.Color(), Ts = live.Te ?? -30, Td = live.T2 ?? 90;
      for (let i = 0; i < gas.n; i++) {
        gas.u[i] += dt * 0.2; if (gas.u[i] > 1) gas.u[i] -= 1;
        const u = gas.u[i], an = gas.b[i] * Math.PI * 2 + u * 9, top = gas.a[i] > 0.5;
        let x, y, z;
        if (u < 0.15) { x = -0.25 + (gas.a[i] - 0.5) * 0.1; y = 0.5 - u / 0.15 * 0.35; z = (gas.b[i] - 0.5) * 0.15; }
        else if (u < 0.85) { const k = (u - 0.15) / 0.7, r = 0.09 + 0.02 * gas.a[i]; x = -L / 2 + 0.05 + k * (L - 0.1); y = (top ? 0.11 : -0.12) + Math.cos(an) * r * (1 - 0.4 * k); z = Math.sin(an) * r * (1 - 0.4 * k); }
        else { const k = (u - 0.85) / 0.15; x = 0.3 + (gas.a[i] - 0.5) * 0.1; y = -0.2 - k * 0.3; z = (gas.b[i] - 0.5) * 0.12; }
        gas.pos.set([x, y, z], i * 3);
        tcol(u < 0.15 ? Ts : u > 0.85 ? Td : Ts + (Td - Ts) * Math.pow((u - 0.15) / 0.7, 2), c); gas.col.set([c.r, c.g, c.b], i * 3);
      }
      gas.geo.attributes.position.needsUpdate = true; gas.geo.attributes.color.needsUpdate = true;
    },
  };
}

// ===================================================================================
// tour stops
// ===================================================================================
export const STOPS = [
  { id: "receiving", title: "Drive-through milk intake bay", where: "Shared by the dairy plant and the Center for Dairy Research",
    role: "Milk tankers drive straight through the building. Staff climb a staircase with a harness and safety cage to open the tank hatch (it must vent as milk is pumped out), test the load, and pump it into chilled, agitated holding tanks. Much of the milk comes from the university's own dairy herd, about 0.2 miles away.",
    specs: [["Typical load", "≈ 8,000 lb (3,600 kg) of milk per truck", "B"], ["Bay", "Drive-through, staircase, harness and cage", "B"], ["Milk source", "Wisconsin cows, incl. the campus herd 0.2 mi away", "B"], ["Holding tanks", "Agitated, insulated, ≤ 4 °C"], ["Unloading", "Centrifugal pump with air eliminator and flowmeter"]],
    live: R => ({ rows: [["Mix fat / MSNF / sugar", `${f1(R.p.fat)} / ${f1(R.p.msnf)} / ${f1(R.p.sugar)} %`], ["Cream needed (40 % fat)", `${f0(R.p.fat / 40 * 1000)} kg per t mix`], ["Liquid sugar (67 °Brix)", `${f0(R.p.sugar / 0.67 * 10)} kg per t mix`], ["Mix to make per 8 h shift", `${f1(PLANT.Qmix * 8 / 1000)} m³`]] }) },
  { id: "batching", title: "Powder blender and mix tanks", where: "Mix room (green hygiene zone)",
    role: "Dry and liquid ingredients are combined in a powder blender, heated to 110 °F (43 °C), and agitated for 15 minutes so the powders dissolve and hydrate. Choosing amounts of cream, skim milk, powder and sugar to hit the fat, MSNF and sugar targets is a mass-balance problem: open Product design to see it solved.",
    specs: [["Blend temperature", "110 °F (43 °C)", "B"], ["Agitation", "15 min", "B"], ["Blend tanks", "2 × 2000 L, jacketed, agitated"], ["Powder blender", "High-shear, recirculating"]],
    live: R => ({ rows: [["Total solids", `${f1(R.c.TS)} %`], ["Water", `${f1(R.c.water)} %`], ["Mix density", `${f0(R.c.rho)} kg/m³`], ["Heat capacity", `${f2(R.c.cp)} kJ/kg K`], ["Ingredient cost", `$${f2(R.eco.mixKg)} per kg mix`]] }) },
  { id: "htst", title: "HTST plate pasteuriser", where: "Process room · regeneration, heating, holding tube, cooling", model: plateModel,
    role: "Continuous pasteurisation in a compact plate unit. The warm, homogenised mix is heated further by the hot pasteurised mix (regeneration), brought to 180 °F with hot water, held in a tube for 15 s, then cooled back through regeneration and with ice water to below 40 °F. A flow-diversion valve sends under-temperature mix back to the balance tank. Staff run it from touchscreens.",
    specs: [["Pasteurisation", "≥ 180 °F (82.2 °C) for ≥ 15 s, then cooled below 40 °F", "B"], ["Capacity", `${PLANT.Qpast} L/h mix`], ["Legal minimum, frozen-dessert mix", "79.4 °C / 25 s or 82.2 °C / 15 s (US PMO)"], ["Milk minimum, for reference", "71.7 °C / 15 s"], ["Regeneration effectiveness", `${PLANT.epsRegen * 100} %`], ["U, plates", "3000–3500 W/m² K"], ["Plate area", "0.25 m² per plate"], ["Holding tube", "2\" sanitary, ID 47.5 mm, sloped upward"]],
    live: R => { const h = R.ht; return { rows: [["Mix in → regen out", `${f1(h.Tin)} → ${f1(h.Tr)} °C`], ["Hold temperature", `${f1(h.Thold)} °C (${f0(h.Thold * 9 / 5 + 32)} °F)`], ["Hold", `${f1(R.p.tHold)} s in ${f1(h.Ltube)} m tube`], ["Heat recovered by regeneration", `${f0(h.regenSave * 100)} % (${f0(h.Qreg)} kW)`], ["Log reductions, L. monocytogenes", `${f0(h.logRed)}`], ["Meets US PMO for mix", h.pmo ? "yes" : "NO, divert"]], htT: { rawIn: h.Tin, rawOut: h.Tr, heated: h.Th, hw: h.Thw, hotIn: h.Thold, hotOut: h.Tc1 } }; } },
  { id: "homog", title: "Two-stage homogeniser", where: "Process room · on the warm blend, before pasteurisation", model: homogValveModel,
    role: "As in Babcock's published method, the warm (110 °F) blend is homogenised before it is pasteurised. A three-plunger pump forces the mix through a narrow valve gap at high pressure. The jet's turbulence and cavitation break fat globules from about 3.5 µm to under 1 µm, and milk proteins and emulsifiers adsorb onto the new fat surface. The second stage, at about 20 % of the first-stage pressure, breaks up clusters of globules.",
    specs: [["Position", "After blending, before pasteurisation", "B"], ["Type", "3-plunger pump, 2-stage valves"], ["Pressure", "1st 14–20 MPa, 2nd ≈ 3–4 MPa"], ["Capacity", `${PLANT.Qpast} L/h`], ["Motor", "≈ 22 kW"], ["Valve materials", "Tungsten carbide seat and forcer, ceramic plungers"]],
    live: R => { const h = R.hom; return { rows: [["P₁ / P₂", `${f1(h.P1)} / ${f1(h.P2)} MPa`], ["Fat globule d₃₂", `${f2(h.d32raw)} → ${f2(h.d32)} µm`], ["Fat surface area", `${f1(h.S / 1e6 * 1000)} m² per litre`], ["Gap jet velocity", `${f0(h.vGap)} m/s`], ["Valve gap", `${f0(h.gap * 1e6)} µm`], ["Hydraulic power", `${f1(h.power)} kW`]] }; } },
  { id: "ageing", title: "Ageing tanks", where: "Tank room under the observation deck · 4 °C",
    role: "The pasteurised mix is stored to hydrate for at least 16 hours at about 4 °C, in a cluster of stainless tanks that visitors can watch from the observation deck. Fat inside each globule partly crystallises, proteins and stabilisers hydrate, and emulsifiers displace some protein from the fat surface. Aged mix whips better in the freezer and gives drier, more stable ice cream.",
    specs: [["Ageing time", "≥ 16 h", "B"], ["Visible from", "Observation deck with slanted windows", "B"], ["Tanks", "6 × ≈ 8 m³, jacketed, agitated, stainless access frame"], ["Temperature", "2–5 °C"], ["Agitation", "Slow anchor or propeller, avoids churning"]],
    live: R => { const a = R.age; return { rows: [["Ageing time", `${f1(R.p.tAge)} h`], ["Solid fat in globules", `${f0(a.sfc * 100)} % (equilibrium ${f0(a.SFCeq * 100)} %)`], ["Protein hydration", `${f0(a.hydr * 100)} %`], ["Apparent viscosity, 4 °C", `${f0(a.visc.eta * 1000)} mPa s`], ["Flow index n", f2(a.visc.n)]] }; } },
  { id: "freezer", title: "Continuous freezer (SSHE)", where: "Freezing room · scraped-surface heat exchanger with ammonia jacket", model: freezerModel,
    role: "Here the mix becomes ice cream. Flavour or colour is added to the aged mix (for the chocolate recipe, the cocoa is already blended into the mix), which then enters the continuous freezer with filtered air, metered for 80 % overrun: one gallon of mix becomes 1.8 gallons of ice cream. The mix enters a nickel cylinder chilled by boiling ammonia. Ice forms as a film on the wall, and two scraper blades on the rotating dasher shave it off about 14 times a second, seeding the product with millions of small ice crystals. The dasher shear also breaks the air into small cells and partly coalesces fat around them. About half the water freezes before the draw, at about 20 °F (−6.7 °C).",
    specs: [["Mix in → ice cream out", "35 °F → 20 °F (2 → −6.7 °C)", "B"], ["Overrun", "80 % (1 gal mix → 1.8 gal)", "B"], ["Air", "Filtered, injected", "B"], ["Capacity (assumed)", `${PLANT.Qmix} L/h mix ≈ ${PLANT.Qmix * 1.8} L/h ice cream`], ["Cylinder", "150 mm ID × 0.9 m, nickel"], ["Dasher", "Solid, 100 mm, 2 floating blades, 420 rpm"], ["Barrel pressure", "4 bar abs"], ["Refrigerant", "Flooded NH₃, −25 to −32 °C"], ["Motor", "≈ 15 kW"]],
    live: R => { const z = R.fz, d = R.dyn || {}; return { rows: [["Draw temperature (live)", `${f2(d.Tdraw ?? z.Tdraw)} °C, set ${f1(R.p.Tdraw)}`], ["Water frozen at draw", `${f0(z.iceOfWater * 100)} %`], ["Heat removed", `${f1(z.Qprod)} kW + dasher ${f1(z.Pdash)} kW`], ["Residence time", `${f0(z.tau)} s`], ["Inside coefficient h (penetration)", `${f0(z.hIn)} W/m² K`], ["NH₃ evaporating (live)", `${f1(d.Te ?? z.Tevap)} °C`], ["Apparent viscosity at draw", `${f1(z.eta)} Pa s`], ["Overrun (live)", `${f0(d.OR ?? R.p.overrun)} %`]], I: z.I, Tdraw: d.Tdraw ?? z.Tdraw }; } },
  { id: "filler", title: "Inclusions and filling", where: "Freezing and filling room (red hygiene zone)",
    role: "Inclusions, variegates and swirls are added to the ice cream stream: for the chocolate recipe, a fudge swirl from the variegate pump and dark chocolate flakes from the feeder. An inline filler then portions it by volume into red paper pints and smaller cups, and a second station fills 3-gallon tubs for the Dairy Store's dipping cabinets. Because filling is by volume, overrun control decides both legal weight and cost.",
    specs: [["Containers", "Pints, smaller cups, 3-gallon tubs", "B"], ["Inclusions", "Added after the freezer (feeder, variegate pump)", "B"], ["Filler", "Inline cup filler with lidder"], ["Pint", "≈ 90 mm dia × 85 mm, paperboard"]],
    live: R => { const s = R.std, g = perGallon(R); return { rows: [["Ice cream", `${f0(R.eco.icLh)} L/h · ${f0(R.eco.icLh / 0.473 / 60)} pints/min`], ["One gallon every", `${f1(g.secPerGal)} s`], ["Density", `${f3(s.rhoIC)} kg/L`], ["Net weight per pint", `${f0(s.rhoIC * 473)} g`], ["Electricity per gallon", `${f2(g.kWhE)} kWh ≈ ${f0(g.phones)} phone charges`], ["Cost per litre", `$${f2(R.eco.totalL)} (ingredients ${f2(R.eco.ingL)})`], ["Legal standard (21 CFR 135.110)", s.items.every(i => i[1]) ? "met" : "NOT met"]] }; } },
  { id: "tunnel", title: "Deep freezer: hardening", where: "One large freezer room · −20 °F air", model: roomModel,
    role: "Filled pints and tubs leave the filler soft, at about 20 °F. They go into the plant's deep freezer, set to −20 °F with fans strong enough to give a −40 °F wind chill, until the core reaches −18 °C (0 °F). The room is about the size of a modest banquet room and replaced three smaller freezers in the renovation. Fast hardening matters: no new crystals form here, so slow freezing lets the existing crystals grow coarse.",
    specs: [["Air temperature", "−20 °F (−29 °C), wind chill −40 °F", "B"], ["Size", "About a modest banquet room (one room)", "B"], ["Packages", "Pints and 3-gallon tubs", "B"], ["Room size (assumed)", "16 × 22 × 6 m"], ["h at package surface", `${PLANT.hAir} W/m² K + paperboard ${PLANT.Rcarton} m² K/W`], ["Defrost", "Hot gas, every 8–12 h"]],
    live: R => { const h = R.hard; return { rows: [["Air temperature", `${f1(R.p.Thard)} °C (${f0(R.p.Thard * 9 / 5 + 32)} °F)`], ["Package", h.pk.name], ["Time to core −18 °C", `${f2(h.tCore / 3600)} h`], ["Thermal conductivity", `${f2(h.k0)} → ${f2(h.k18)} W/m K`], ["Ice-crystal size: draw → hardened", `${f0(R.fz.Lice)} → ${f0(R.q.Lhard)} µm`], ["Hardening refrigeration load", `${f0(R.loads[1].Q)} kW`]], hardHist: h.hist, tCore: h.tCore, Thard: R.p.Thard, Tdraw: R.fz.Tdraw }; } },
  { id: "store", title: "Storage and the Dairy Store", where: "Deep freezer → Dairy Store dipping cabinets",
    role: "Hardened ice cream stays in the deep freezer until it goes to the Dairy Store, where it sits in a cooler to warm slightly so it can be scooped; Madisonians order tens of thousands of cones a year. Even here the ice slowly recrystallises: small crystals melt and large ones grow, driven by temperature swings and curvature. Below the glass transition of the freeze-concentrated serum (Tg′ ≈ −32 °C) the serum is a glass and the process all but stops.",
    specs: [["Storage", "Deep freezer, −20 °F", "B"], ["Before serving", "Warmed slightly in the Dairy Store cooler", "B"], ["Dipping temperature", "≈ −14 to −12 °C (6–10 °F)"], ["Envelope UA + infiltration", `${PLANT.storeUA} kW/K`]],
    live: R => { const q = R.q; return { rows: [["Storage temperature", `${f1(R.p.Tstore)} °C`], ["Above Tg′ by", `${f1(R.p.Tstore - TG_PRIME)} K`], ["Recrystallisation rate", `${f3(recrystRate(R.p.Tstore, R.p.stab))} µm³/s`], ["Ice crystals after 4 weeks", `${f0(q.Lstore)} µm`], ["Air cells after 4 weeks", `${f0(q.Dstore)} µm`], ["Refrigeration load", `${f0(R.loads[2].Q)} kW`]] }; } },
  { id: "mroom", title: "Ammonia refrigeration plant", where: "Machine room (assumed layout; not described publicly)", model: compressorModel,
    role: "Every kilowatt removed from the ice cream ends up here. (The plant's actual refrigeration system is not described publicly; this is a Typical ammonia system.) Oil-injected screw compressors pull ammonia vapour from the low-pressure side and compress it to condensing pressure. Low temperatures use two stages with an intercooler. Ammonia is a natural refrigerant with zero ozone-depletion and global-warming potential, but it is toxic, so these rooms have detectors, ventilation and emergency shutdowns.",
    specs: [["Refrigerant", "R-717 (ammonia), ODP 0, GWP 0"], ["Compressors", "3 × oil-injected screw, slide-valve capacity control"], ["Condensing", `${PLANT.Tcond} °C (evaporative condensers)`], ["Isentropic efficiency", `${PLANT.etaIs}`], ["Low temperature", "Two-stage with flash intercooler below −25 °C"]],
    live: R => { const L = R.loads[0], e = R.energy; return { rows: [["Total refrigeration", `${f0(e.Qtot)} kW (${f0(e.Qtot / 3.517)} TR)`], ["Compressor power", `${f0(e.Wcomp)} kW`], ["Plant COP", f2(e.COP)], ["Freezer suction", `${f1(L.Te)} °C · ${f2(L.cyc.pe)} bar · COP ${f2(L.cyc.COP)}`], ["Condensing", `${PLANT.Tcond} °C · ${f2(L.cyc.pc)} bar`], ["Discharge temperature", `${f0(L.cyc.T2)} °C`]], Te: L.Te, T2: L.cyc.T2, load: Math.min(1, e.Wcomp / 300) }; } },
  { id: "condenser", title: "Evaporative condensers", where: "Roof-level platform · heat rejection",
    role: "The condensers reject the heat taken from the product plus the compressor work. Water sprayed over the ammonia coils evaporates into the fan-driven air, so heat leaves mostly as latent heat of water vapour. That is why the plume is visible on a cold day.",
    specs: [["Units", "2 × induced-draft, 1 fan each"], ["Design wet bulb", "24 °C (Madison summer design, Typical)"], ["Water use", "≈ 1.6 L per kWh rejected"]],
    live: R => { const e = R.energy; return { rows: [["Heat rejected", `${f0(e.Qcond)} kW`], ["= refrigeration + work", `${f0(e.Qtot)} + ${f0(e.Wcomp)} kW`], ["Water evaporated", `${f0(e.Qcond / 2443 * 3600)} kg/h`]] }; } },
  { id: "cip", title: "Clean-in-place (CIP)", where: "CIP skid · water, caustic, acid",
    role: "At the end of a run, the HTST, freezer and lines are cleaned without dismantling. The sequence is a water rinse, then hot caustic to dissolve protein and fat deposits, then acid to remove milkstone (calcium phosphate). Results depend on time, temperature, chemistry and turbulence (Sinner's circle).",
    specs: [["Caustic", "1.0–2.0 % NaOH, 75–80 °C, 20–30 min"], ["Acid", "0.5–1.0 % HNO₃/H₃PO₄, 60–70 °C, 10–20 min"], ["Velocity", "≥ 1.5 m/s in all lines"], ["Run length before CIP", "8–10 h (HTST fouling)"]],
    live: R => { const v = 1.8, D = 0.0475, Re = 1000 * v * D / 0.4e-3; return { rows: [["Cleaning velocity, 2\" line", `${f1(v)} m/s`], ["Re at 75 °C", f0(Re)], ["Wall shear stress", `${f1(0.079 * Math.pow(Re, -0.25) / 2 * 1000 * v * v * 4 / 4)} Pa`], ["Volume per circuit", "≈ 1.5 m³"]] }; } },
  { id: "micro", title: "From a pint to the microstructure", where: "From 10 cm down to 1 µm, and back out to the plant", micro: true,
    role: "Start with a pint as you buy it, then zoom in. Ice cream is a frozen foam, an emulsion and a suspension all at once. Air cells (20–60 µm) are held by a partly coalesced fat network. Ice crystals (20–50 µm) sit in a freeze-concentrated sugar syrup that is still liquid at −18 °C. Every slider in the twin changes this structure; open the microstructure view to see how.",
    specs: [["Air cells", "20–60 µm, ≈ 50 % of volume at 100 % overrun"], ["Ice crystals", "20–50 µm, 25–30 % of volume at −18 °C"], ["Fat globules", "0.5–2 µm, partly coalesced around air"], ["Unfrozen serum", "≈ 20 % of volume, 60–70 % solids at −18 °C"]],
    live: R => { const q = R.q; return { rows: [["Ice crystals (stored)", `${f0(q.Lstore)} µm`], ["Air cells (stored)", `${f0(q.Dstore)} µm`], ["Destabilised fat", `${f0(q.PC)} %`], ["Meltdown, 45 min at 22 °C", `${f0(q.melt)} %`], ["Water frozen at −18 °C", `${f0(R.ft.ice(-18) / (R.c.water / 100) * 100)} %`]] }; } },
];

// ---------- equations at work, with live numbers ----------
const TH = {
  receiving: R => [
    eq(["CBE 250"], `${I("m")}<sub>cream</sub> ${I("x")}<sub>f,cream</sub> + ${I("m")}<sub>milk</sub> ${I("x")}<sub>f,milk</sub> = ${I("m")}<sub>mix</sub> ${I("x")}<sub>f,mix</sub>`, `Component mass balance on fat. With 40 % cream and 3.5 % milk, one tonne of ${f1(R.p.fat)} % mix needs about ${f0(Math.max(0, (R.p.fat - 3.5) / (40 - 3.5)) * 1000)} kg cream if milk supplies the rest of the liquid (before adding powder and sugar).`),
    eq(["CBE 430", "CBE 560"], `${I("N")}(${I("t")}) = ${I("N")}<sub>0</sub> e<sup>${I("μt")}</sup>, ${I("t")}<sub>d</sub> = ln2/μ`, "Why raw milk is held at 4 °C or colder: bacterial growth is first-order in cell count, and the specific growth rate μ falls sharply with temperature (psychrotrophs double in roughly 8–12 h at 4 °C versus under 1 h at 30 °C, Typical)."),
  ],
  batching: R => { const c = R.c; return [
    eq(["CBE 250"], `${I("x")}<sub>w</sub> = 1 − ${I("x")}<sub>fat</sub> − ${I("x")}<sub>MSNF</sub> − ${I("x")}<sub>sugar</sub> − ${I("x")}<sub>stab</sub> − ${I("x")}<sub>emul</sub>`, `Composition closure: water = ${f1(c.water)} %, total solids ${f1(c.TS)} %. Lactose = 54.5 % of MSNF = ${f1(c.lact)} %, protein = 36 % of MSNF = ${f1(c.prot)} %.`),
    eq(["CBE 310"], `1/ρ = Σ ${I("x")}<sub>i</sub>/ρ<sub>i</sub>`, `Ideal (additive-volume) mixing: ρ = ${f0(c.rho)} kg/m³.`),
    eq(["CBE 310"], `${I("c")}<sub>p</sub> = Σ ${I("x")}<sub>i</sub>${I("c")}<sub>p,i</sub>`, `Choi–Okos-type mixing rule: c<sub>p</sub> = ${f2(c.cp)} kJ/kg K (water 4.18, fat 1.98, protein 2.0, sugars 1.55).`),
    eq(["CBE 450"], `cost/L = Σ ${I("x")}<sub>i</sub>${I("p")}<sub>i</sub> · ρ<sub>mix</sub>/(1 + OR)`, `$${f2(R.eco.mixKg)} per kg mix × ${f3(R.std.rhoIC)} kg/L = $${f2(R.eco.ingL)} per litre of ice cream in ingredients. Overrun is sold air: each 10 % of overrun cuts ingredient cost per litre by about ${f0(10 / (100 + R.p.overrun) * 100)} %. Prices Typical.`),
  ]; },
  htst: R => { const h = R.ht; return [
    eq(["CBE 430", "CBE 560"], `d${I("N")}/d${I("t")} = −${I("k")}${I("N")}, ${I("D")} = ln10/${I("k")}`, `First-order thermal death. ${LM.name}: D<sub>72</sub> = ${LM.D72} s, z = ${LM.z} °C (Typical, in milk; sugar and fat make it more heat resistant).`),
    eq(["CBE 430"], `${I("F")}<sub>72</sub> = ∫ 10<sup>(${I("T")} − 72)/${I("z")}</sup> d${I("t")}`, `At ${f1(h.Thold)} °C for ${R.p.tHold} s: lethal rate ${f1(h.L)} → F<sub>72</sub> = ${f0(h.F72)} s → ${f0(h.logRed)} log reductions. Regulators credit only the holding tube, at the fastest-particle time.`),
    eq(["CBE 326", "CBE 250"], `${I("Q")}<sub>regen</sub> = ${I("ṁc")}<sub>p</sub>(${I("T")}<sub>r</sub> − ${I("T")}<sub>raw</sub>), ε = (${I("T")}<sub>r</sub> − ${I("T")}<sub>raw</sub>)/(${I("T")}<sub>hold</sub> − ${I("T")}<sub>raw</sub>)`, `Balanced counter-flow, ε = ${PLANT.epsRegen}: warm homogenised mix goes ${f1(h.Tin)} → ${f1(h.Tr)} °C, recovering ${f0(h.Qreg)} kW, which is ${f0(h.regenSave * 100)} % of the heating duty. NTU = ε/(1−ε) = ${f2(h.NTUreg)}.`),
    eq(["CBE 326"], `${I("A")} = ${I("Q")}/(${I("U")}ΔT<sub>lm</sub>)`, `Areas: regeneration ${f1(h.Areg)} m² (ΔT = ${f1(h.Thold - h.Tr)} K throughout, since the capacity rates are equal), heating ${f1(h.Aheat)} m², cooling ${f1(h.Acool)} m² → ${h.nReg} + ${h.nHeat} + ${h.nCool} plates of 0.25 m².`),
    eq(["CBE 320"], `Re = ρ${I("v")}${I("D")}/μ, ${I("v")}<sub>max</sub> = 2${I("v̄")} (laminar)`, `Holding tube: v̄ = ${f2(h.v)} m/s, μ ≈ ${f0(h.mu * 1000)} mPa s at ${f0(h.Thold)} °C → Re = ${f0(h.Re)} (${h.laminar ? "laminar, so the fastest particle moves at 2v̄" : "turbulent, v<sub>max</sub> ≈ 1.22 v̄"}). L = v<sub>max</sub>t = ${f1(h.Ltube)} m.`),
    eq(["CBE 470"], `if ${I("T")}<sub>hold,out</sub> < ${I("T")}<sub>legal</sub> → divert`, "Safety interlock: the flow-diversion valve is a discrete control action written into regulation, alongside the temperature PID on the hot-water set and a recorder-controller that logs the hold temperature."),
  ]; },
  homog: R => { const h = R.hom, c = R.c; return [
    eq(["CBE 320", "CBE 310"], `${I("v")}<sub>gap</sub> = (2Δ${I("P")}/ρ)<sup>1/2</sup>`, `Bernoulli: Δ${I("P")} = ${f1(h.P1)} MPa accelerates the mix to ${f0(h.vGap)} m/s through a ${f0(h.gap * 1e6)} µm gap.`),
    eq(["CBE 320", "CBE 547"], `${I("d")}<sub>max</sub> ∼ (σ/ρ)<sup>3/5</sup> ε<sup>−2/5</sup> ⇒ ${I("d")}<sub>32</sub> ∝ ${I("P")}<sup>−0.6</sup>`, `Kolmogorov–Hinze breakup in the turbulent jet (energy dissipation ε grows with pressure). Walstra's scaling gives d<sub>32</sub> = ${f2(h.d32)} µm at ${f1(h.P1)} MPa, down from ${f2(h.d32raw)} µm.`),
    eq(["CBE 547"], `${I("S")} = 6φ/${I("d")}<sub>32</sub>, Γ = ${I("c")}<sub>protein</sub>/${I("S")}`, `New fat surface ${f1(h.S / 1e6 * 1000)} m²/L (φ = ${f3(c.phiFat)}). Protein available: ${f1(h.gamma)} mg/m², several times the 3–10 mg/m² needed to cover it, so casein and whey proteins coat the new interface right away.`),
    eq(["CBE 310"], `Δ${I("T")} = Δ${I("P")}/(ρ${I("c")}<sub>p</sub>)`, `First law for an adiabatic throttle on a liquid: all of the flow work is dissipated, so the mix warms by ${f2(R.ht.dTh)} K (${f1(PLANT.Tblend)} → ${f1(R.ht.Tin)} °C into the HTST). Hydraulic power ${f1(h.power)} kW = QΔP.`),
  ]; },
  ageing: R => { const a = R.age; return [
    eq(["CBE 430", "CBE 540"], `${I("X")}(${I("t")}) = 1 − exp[−(${I("t")}/τ)<sup>${I("n")}</sup>]`, `Avrami crystallisation of fat inside the globules, τ = ${a.tau} h, n = ${a.n} (Typical for emulsified milk fat). After ${f1(R.p.tAge)} h: X = ${f2(a.X)}, solid fat ${f0(a.sfc * 100)} %.`),
    eq(["CBE 320", "CBE 540"], `τ = ${I("K")}γ̇<sup>${I("n")}</sup>, η<sub>app</sub> = ${I("K")}γ̇<sup>${I("n")}−1</sup>`, `Power-law (shear-thinning) mix: η<sub>app</sub>(50 s⁻¹) = ${f0(a.visc.eta * 1000)} mPa s, n = ${f2(a.visc.n)}, K = ${f2(a.visc.K)} Pa sⁿ. Stabiliser polysaccharides (guar, locust bean gum, carrageenan) give the shear thinning.`),
    eq(["CBE 547"], `η<sub>r</sub> = (1 − φ/φ<sub>m</sub>)<sup>−[η]φ<sub>m</sub></sup>`, `Krieger–Dougherty for the fat emulsion: φ = ${f3(R.c.phiFat)}, φ<sub>m</sub> = 0.64 → η<sub>r</sub> = ${f2(Math.pow(1 - R.c.phiFat / 0.64, -2.5 * 0.64))}.`),
    eq(["CBE 430"], `${I("H")}(${I("t")}) = 1 − e<sup>−${I("t")}/τ<sub>h</sub></sup>`, `Protein and stabiliser hydration, first order, τ<sub>h</sub> ≈ 1 h: ${f0(a.hydr * 100)} % complete, adding about ${f0(25 * a.hydr)} % to viscosity.`),
  ]; },
  freezer: R => { const z = R.fz, c = R.c, d = R.dyn || {}; return [
    eq(["CBE 311"], `ln ${I("a")}<sub>w</sub> = ln(1 − ${I("x")}<sub>s</sub>) − ${I("K")}${I("x")}<sub>s</sub>² = ln ${I("a")}<sub>ice</sub>(${I("T")})`, `Freezing-point depression with Norrish non-ideality (K = 6.47 for sucrose) plus milk salts. Initial freezing point ${f2(R.ft.f.Tf)} °C; at the draw (${f1(z.Tdraw)} °C) ${f0(z.iceOfWater * 100)} % of the water is ice and the serum is ${f0(z.xs * 100)} % sugars.`),
    eq(["CBE 250", "CBE 310"], `${I("Q")} = ${I("ṁ")}[${I("h")}(${I("T")}<sub>in</sub>) − ${I("h")}(${I("T")}<sub>draw</sub>)] + ${I("W")}<sub>dasher</sub>`, `${f3(z.m)} kg/s × ${f1(z.dH)} kJ/kg = ${f1(z.Qprod)} kW, plus ${f1(z.Pdash)} kW of dasher work that the ammonia must also remove: Q = ${f1(z.Qref)} kW. Latent heat is ${f0(z.I * R.ft.f.Lf(z.Tdraw) / z.dH * 100)} % of the duty.`),
    eq(["CBE 320", "CBE 326"], `${I("h")} = 2(${I("kρc")}<sub>p</sub>${I("n")}<sub>b</sub>${I("N")}/π)<sup>1/2</sup>`, `Penetration theory for a scraped surface (Harriott): every blade pass, ${f1(PLANT.nBlades * PLANT.Ndash / 60)} times a second, removes the boundary layer. Using an apparent c<sub>p</sub> = ${f0(z.cpApp / 1000)} kJ/kg K that includes latent heat gives h = ${f0(z.hIn)} W/m² K and U = ${f0(z.U)} W/m² K.`),
    eq(["CBE 326"], `${I("T")}<sub>NH₃</sub> = ${I("T̄")} − ${I("Q")}/(${I("UA")})`, `A = ${f2(z.Ab)} m², enthalpy-weighted product mean ${f1(z.Tmean)} °C → evaporating temperature ${f1(z.Tevap)} °C (${f2(nh3.psat(z.Tevap))} bar).`),
    eq(["CBE 310"], `${I("V̇")}<sub>air,barrel</sub> = OR·${I("V̇")}<sub>mix</sub>·(${I("P")}<sub>atm</sub>/${I("P")}<sub>b</sub>)(${I("T̄")}/${I("T")}<sub>draw</sub>)`, `Ideal gas: ${f0(R.p.overrun)} % overrun needs ${f2(z.mAir * 3600)} kg/h of air; compressed to ${PLANT.Pbar} bar in the barrel it adds only ${f0(z.Qair * 3.6e6)} L/h. Residence time τ = V/Q = ${f0(z.tau)} s.`),
    eq(["CBE 320"], `${I("P")} = η<sub>app</sub>γ̇²${I("V")}`, `Viscous dissipation in the annulus: γ̇ ≈ ${f0(z.gdot)} s⁻¹, η<sub>app</sub> = ${f1(z.eta)} Pa s (ice and air raise it steeply), giving ${f1(z.Pvisc)} kW + 2 kW scraping. A colder draw stiffens the product and raises the power.`),
    eq(["CBE 547"], `Ca = η γ̇ ${I("R")}/σ = Ca<sub>c</sub>`, `Taylor breakup of air cells: σ ≈ 45 mN/m, Ca<sub>c</sub> ≈ 0.6 → D ≈ ${f0(z.DTaylor)} µm at nominal shear; this model uses a tempered scaling D = ${f0(z.Dair)} µm.`),
    eq(["CBE 470"], `${I("u")} = ${I("K")}<sub>c</sub>[${I("e")} + (1/τ<sub>I</sub>)∫${I("e")} d${I("t")}]`, `PI control of the draw temperature (live ${f2(d.Tdraw ?? z.Tdraw)} °C) by moving the ammonia suction pressure, with mix-flow disturbances. Overrun is a ratio control: air mass flow = r·mix flow. Real freezers often control "viscosity" via dasher motor current instead.`),
  ]; },
  filler: R => { const s = R.std; return [
    eq(["CBE 250"], `OR = (${I("V")}<sub>ice cream</sub> − ${I("V")}<sub>mix</sub>)/${I("V")}<sub>mix</sub>`, `${f0(R.p.overrun)} % overrun: ${f0(PLANT.Qmix)} L/h mix → ${f0(R.eco.icLh)} L/h ice cream, density ${f3(s.rhoIC)} kg/L.`),
    eq(["CBE 450"], `ρ<sub>ic</sub> ≥ 0.539 kg/L, solids ≥ 0.192 kg/L`, `US standard of identity (21 CFR 135.110) caps overrun: 4.5 lb/gal minimum weight. Here ${s.items.map(i => `${i[0].split(" ")[0]} ${i[1] ? "✓" : "✗"}`).join(", ")}.`),
    eq(["CBE 450"], `cost/L = ingredients + energy + packaging`, `$${f2(R.eco.ingL)} + $${f3(R.eco.enL)} (${f3(R.eco.kWhL)} kWh/L at $${0.10}/kWh) + $${f2(R.eco.packL)} = $${f2(R.eco.totalL)} per litre (Typical prices).`),
    eq(["CBE 470"], `fill mass = ρ<sub>ic</sub>·${I("V")}<sub>fill</sub>`, "A volumetric filler turns any overrun drift into weight drift, so checkweighers feed back to the overrun set-point (cascade control)."),
  ]; },
  tunnel: R => { const h = R.hard, k = h.k18, L = Math.min(...h.half), Bi = h.Ueff * L / k; return [
    eq(["CBE 320"], `ρ ∂${I("H")}/∂${I("t")} = ∇·(${I("k")}(${I("T")})∇${I("T")})`, `Enthalpy method: one equation covers sensible and latent heat. It is solved here in 3-D on an octant of the package (10 × 7 × 5 cells; a round pint is approximated by a square section of side 0.85 D). The core reaches −18 °C after ${f2(h.tCore / 3600)} h in ${f0(R.p.Thard)} °C air.`),
    eq(["CBE 326"], `Bi = ${I("UL")}/${I("k")}, 1/${I("U")} = 1/${I("h")} + ${I("R")}<sub>carton</sub>`, `U = ${f1(h.Ueff)} W/m² K, half-thickness ${f0(L * 1000)} mm, k = ${f2(k)} W/m K → Bi = ${f2(Bi)}. Since Bi is neither ≪ 1 nor ≫ 1, both the air side and conduction inside the carton matter.`),
    eq(["CBE 320", "CBE 540"], `${I("k")} = ${I("k")}<sub>c</sub>[2${I("k")}<sub>c</sub> + ${I("k")}<sub>d</sub> − 2φ(${I("k")}<sub>c</sub> − ${I("k")}<sub>d</sub>)]/[2${I("k")}<sub>c</sub> + ${I("k")}<sub>d</sub> + φ(${I("k")}<sub>c</sub> − ${I("k")}<sub>d</sub>)]`, `Maxwell–Eucken, applied twice (ice in serum, then air in that matrix). Air at φ = ${f2(R.fz.phiAir)} insulates: k rises only from ${f2(h.k0)} to ${f2(h.k18)} W/m K as ice forms.`),
    eq(["CBE 430", "CBE 540"], `${I("L")}³ − ${I("L")}<sub>0</sub>³ = ∫${I("k")}<sub>r</sub>(${I("T")}) d${I("t")}, log(${I("k")}<sub>r</sub>/${I("k")}<sub>r,ref</sub>) = ${I("C")}<sub>1</sub>Δ/(${I("C")}<sub>2</sub> + Δ)`, `Ripening with WLF kinetics above Tg′ (C₁ = 17.44, C₂ = 51.6 K). There is no new nucleation, so crystals first grow with the ice fraction (${f0(R.fz.Lice)} → ${f0(R.q.Lgrow)} µm). Ripening during hardening then adds more, to ${f0(R.q.Lhard)} µm.`),
  ]; },
  store: R => { const d = R.p.Tstore - TG_PRIME; return [
    eq(["CBE 540", "CBE 311"], `${I("T")}<sub>store</sub> − ${I("T")}<sub>g</sub>′ = ${f1(d)} K`, `Glass transition of the maximally freeze-concentrated serum, Tg′ ≈ ${TG_PRIME} °C (Typical; set by sugar type). Below it the serum is a glass and diffusion stops. Above it, rates follow WLF: at ${f0(R.p.Tstore)} °C the recrystallisation rate is ${f3(recrystRate(R.p.Tstore, R.p.stab) / recrystRate(-18, R.p.stab))}× the −18 °C rate.`),
    eq(["CBE 311", "CBE 547"], `Δμ ∝ 2γ${I("V")}<sub>m</sub>/${I("r")}`, "Gibbs–Thomson: small crystals have a slightly lower melting point than large ones, so mass moves from small to large (Ostwald ripening). Temperature cycling at the store door speeds this up through melt–refreeze."),
    eq(["CBE 326"], `${I("Q")} = ${I("UA")}(${I("T")}<sub>amb</sub> − ${I("T")}<sub>store</sub>) + ${I("Q")}<sub>internal</sub>`, `${PLANT.storeUA} kW/K × ${f0(PLANT.Tamb - R.p.Tstore)} K + ${PLANT.storeFix} kW (fans, lights, doors) = ${f0(R.loads[2].Q)} kW. A colder store costs more energy but slows recrystallisation.`),
  ]; },
  mroom: R => { const L = R.loads[0], cy = L.cyc; return [
    eq(["CBE 310"], `COP = ${I("Q")}<sub>L</sub>/${I("W")} ≤ ${I("T")}<sub>L</sub>/(${I("T")}<sub>H</sub> − ${I("T")}<sub>L</sub>)`, `Freezer duty: COP = ${f2(cy.COP)} vs Carnot ${f2(cy.carnot)} (${f0(cy.COP / cy.carnot * 100)} % of ideal). Whole plant: ${f0(R.energy.Qtot)} kW of cooling for ${f0(R.energy.Wcomp)} kW of compressor power.`),
    eq(["CBE 311"], `log₁₀ ${I("P")}<sup>sat</sup> = ${I("A")} − ${I("B")}/(${I("T")} + ${I("C")})`, `Antoine (NIST): evaporating at ${f1(L.Te)} °C → ${f2(cy.pe)} bar; condensing at ${PLANT.Tcond} °C → ${f2(cy.pc)} bar. Pressure ratio ${f1(cy.pc / cy.pe)}${cy.stages === 2 ? `, so two stages split at p<sub>i</sub> = (p<sub>e</sub>p<sub>c</sub>)<sup>½</sup> = ${f2(cy.pi)} bar (${f1(cy.Ti)} °C)` : ""}.`),
    eq(["CBE 310"], `${I("w")}<sub>s</sub> = ${I("c")}<sub>p</sub>${I("T")}<sub>1</sub>[(${I("P")}<sub>2</sub>/${I("P")}<sub>1</sub>)<sup>(γ−1)/γ</sup> − 1], ${I("w")} = ${I("w")}<sub>s</sub>/η<sub>s</sub>`, `Ideal-gas isentropic compression of the vapour (γ = 1.29, within a few % of ammonia tables), η<sub>s</sub> = ${PLANT.etaIs}. Discharge ≈ ${f0(cy.T2)} °C, which is why NH₃ screws are oil-injected and oil-cooled.`),
    eq(["CBE 250"], `${I("ṁ")}<sub>H</sub>${I("h")}<sub>f</sub>(${I("T")}<sub>c</sub>) + ${I("ṁ")}<sub>L</sub>${I("h")}<sub>2L</sub> = ${I("ṁ")}<sub>H</sub>${I("h")}<sub>g</sub>(${I("T")}<sub>i</sub>) + ${I("ṁ")}<sub>L</sub>${I("h")}<sub>f</sub>(${I("T")}<sub>i</sub>)`, cy.stages === 2 ? `Energy balance on the open flash intercooler: the high stage must pump ${f2(cy.mH)} kg per kg of low-stage flow.` : "Single stage at this suction temperature; two-stage is used for the −40 °C tunnel."),
    eq(["CBE 450"], `${I("W")}<sub>total</sub> = Σ ${I("Q")}<sub>j</sub>/COP<sub>j</sub>`, R.loads.map(l => `${l.name} ${f0(l.Q)} kW @ ${f0(l.Te)} °C → ${f0(l.W)} kW`).join("; ") + "."),
  ]; },
  condenser: R => [
    eq(["CBE 310"], `${I("Q")}<sub>H</sub> = ${I("Q")}<sub>L</sub> + ${I("W")}`, `First law for the cycle: ${f0(R.energy.Qtot)} + ${f0(R.energy.Wcomp)} = ${f0(R.energy.Qcond)} kW rejected.`),
    eq(["CBE 426"], `${I("Q")} = ${I("ṁ")}<sub>air</sub>(${I("h")}<sub>out</sub> − ${I("h")}<sub>in</sub>), ${I("ṁ")}<sub>evap</sub> ≈ ${I("Q")}/λ`, `Humidification of the air stream (Merkel analysis): ≈ ${f0(R.energy.Qcond / 2443 * 3600)} kg/h of water evaporates (Δh<sub>vap</sub>(25 °C) = 2443 kJ/kg). Wet-bulb temperature, not dry-bulb, limits the condensing temperature.`),
  ],
  cip: R => [
    eq(["CBE 320"], `τ<sub>w</sub> = ${I("f")}ρ${I("v")}²/2, ${I("f")} = 0.079 Re<sup>−1/4</sup>`, "Turbulent wall shear removes softened deposits; 1.5 m/s is the long-standing rule of thumb for CIP velocity."),
    eq(["CBE 430"], `${I("k")} = ${I("A")}e<sup>−${I("E")}<sub>a</sub>/${I("RT")}</sup>`, "Caustic hydrolysis of protein deposits roughly doubles in rate per 10 K, which is why caustic runs at 75–80 °C. Above about 2 % NaOH, deposits swell into a gel and cleaning slows."),
    eq(["CBE 326"], `1/${I("U")}(${I("t")}) = 1/${I("U")}<sub>0</sub> + ${I("R")}<sub>f</sub>(${I("t")})`, `Fouling resistance builds in the HTST heating section, where β-lactoglobulin denatures and calcium phosphate precipitates. The hot-water ΔT creeps up until CIP is due. Current heating U assumed clean: ${f0(3500)} W/m² K.`),
  ],
  micro: R => { const q = R.q, c = R.c; return [
    eq(["CBE 311"], `Δ${I("T")}<sub>f</sub> ≈ ${I("K")}<sub>f</sub>${I("b")} (dilute), ${I("K")}<sub>f</sub> = 1.86 K kg/mol`, `Colligative property. Sucrose + lactose ${f1(c.SE)} g per ${f1(c.water)} g water → ${f2(c.SE / 342.3 / c.water * 1000)} mol/kg → ideal ΔT ≈ ${f2(1.86 * c.SE / 342.3 / c.water * 1000)} K. With Norrish non-ideality and milk salts: T<sub>f</sub> = ${f2(R.ft.f.Tf)} °C.`),
    eq(["CBE 311", "CBE 540"], `${I("x")}<sub>s,serum</sub>(${I("T")}) → ${I("C")}<sub>g</sub>′ ≈ 0.8 at ${I("T")}<sub>g</sub>′`, `Freeze concentration: as ice forms, the serum concentrates until it vitrifies. At −18 °C, ${f0(R.ft.ice(-18) / (c.water / 100) * 100)} % of the water is frozen.`),
    eq(["CBE 547"], `Δ${I("P")} = 2γ/${I("R")}`, `Laplace pressure drives gas from small to large air cells (disproportionation). A shell of partly coalesced fat (${f0(q.PC)} % destabilised) resists it: air cells ${f0(q.Dair)} → ${f0(q.Dstore)} µm after 4 weeks.`),
    eq(["CBE 547", "FOOD SCI 511"], `meltdown ↓ as destabilised fat ↑`, `The fat network holds the shape as the ice melts. The trend model gives ${f0(q.melt)} % dripped after 45 min at 22 °C (indicative).`),
  ]; },
};
STOPS.forEach(s => s.thermo = TH[s.id]);
// plain-language introductions for prospective students (the technical role text stays behind a toggle)
const PLAIN = {
  receiving: "Milk trucks drive right into the building. Workers test each load, then pump the cold milk into big steel tanks. Much of the milk comes from UW–Madison's own cows, about 0.2 miles away.",
  batching: "This is where the recipe is mixed. Milk, cream, milk powder and sugar are blended warm (110 °F) so everything dissolves, like stirring sugar into warm tea. Engineers calculate exact amounts so every batch tastes the same.",
  htst: "This machine heats the mix to 180 °F for 15 seconds to kill harmful germs, then cools it right back down. Clever plumbing lets the hot mix warm up the cold mix coming in, which saves energy.",
  homog: "A powerful pump squeezes the warm mix through a gap thinner than a hair. That smashes the fat into tiny droplets that can't separate out, which keeps the ice cream smooth.",
  ageing: "The mix rests in cold tanks for at least 16 hours. Meanwhile the fat firms up and the proteins soak up water, which helps the ice cream whip up and hold its shape. Visitors can watch from the observation deck above.",
  freezer: "This is where mix becomes ice cream. Inside a cold steel tube, spinning blades scrape off ice as it forms while air is whipped in. About half the water freezes, and the ice cream comes out soft, like soft-serve, at about 20 °F.",
  filler: "Mix-ins are added here (for the chocolate recipe: ribbons of fudge and dark chocolate flakes), then machines fill pints and big 3-gallon tubs. Containers are filled by volume, so the amount of air decides how much each pint weighs.",
  tunnel: "The soft ice cream goes into a deep freezer at −20 °F, where strong fans blow like a freezing wind. It hardens from the outside in. Freezing fast keeps the ice crystals tiny, so the ice cream stays smooth.",
  store: "The ice cream stays frozen until it reaches the dipping store, where it is warmed slightly so it can be scooped. Even in the freezer, ice crystals slowly grow, so colder storage keeps it creamier for longer.",
  mroom: "All the cold in the plant comes from here. Compressors push ammonia around a loop, just like the refrigerant in your fridge, carrying heat out of the freezers. (This room is a typical design.)",
  condenser: "The heat taken out of the ice cream is released outdoors here. Water sprayed over the coils evaporates and carries the heat away, the same way sweating cools you down.",
  cip: "After production, hot cleaning solutions are pumped through every pipe and machine without taking them apart. Keeping everything clean is essential for food safety.",
  micro: "Zoom from a pint you could buy at the store down to a slice thinner than a hair. You'll see air bubbles, ice crystals and the fat that holds them together. Every slider in the twin changes what you see here.",
};
STOPS.forEach(s => s.plain = PLAIN[s.id]);


// ---------- course map (side panel): course → concept → stop ----------
export const COURSE_MAP = [
  ["CBE 250", "Recipe mass balances; overrun and throughput; plant energy balance", "batching"],
  ["CBE 250", "Flash-intercooler and freezer energy balances", "freezer"],
  ["CBE 310", "First law: freezer duty, homogeniser temperature rise", "freezer"],
  ["CBE 310", "Vapour-compression refrigeration, COP vs Carnot", "mroom"],
  ["CBE 310", "Heat rejection: Q_H = Q_L + W", "condenser"],
  ["CBE 311", "Freezing-point depression, Norrish activity, ice curve", "freezer"],
  ["CBE 311", "Colligative properties, freeze concentration", "micro"],
  ["CBE 311", "Ammonia vapour pressure (Antoine), two-stage pressures", "mroom"],
  ["CBE 320", "Penetration theory at a scraped surface", "freezer"],
  ["CBE 320", "Transient conduction with phase change (enthalpy method)", "tunnel"],
  ["CBE 320", "Laminar holding tube, fastest particle", "htst"],
  ["CBE 320", "Bernoulli jet and turbulent drop breakup", "homog"],
  ["CBE 326", "Plate heat exchanger sizing, regeneration, NTU", "htst"],
  ["CBE 326", "Overall U, Biot number, cold-store loads", "tunnel"],
  ["CBE 326", "Fouling resistance and CIP", "cip"],
  ["CBE 426", "Evaporative condenser (humidification)", "condenser"],
  ["CBE 430", "First-order thermal death, D, z and F-values", "htst"],
  ["CBE 430", "Avrami fat crystallisation, hydration kinetics", "ageing"],
  ["CBE 430", "Arrhenius cleaning chemistry", "cip"],
  ["CBE 450", "Cost per litre, overrun economics, standards", "filler"],
  ["CBE 450", "Refrigeration power by duty", "mroom"],
  ["CBE 470", "Draw-temperature PI loop, overrun ratio control", "freezer"],
  ["CBE 470", "Flow-diversion interlock", "htst"],
  ["CBE 440", "Ice as a crystalline material; nickel freezer wall", "tunnel"],
  ["CBE 540", "Glass transition Tg′, WLF kinetics, stabiliser polymers", "store"],
  ["CBE 540", "Shear-thinning (power-law) mix rheology", "ageing"],
  ["CBE 547", "Emulsions, interfacial area, protein coverage", "homog"],
  ["CBE 547", "Foams: Taylor breakup, Laplace pressure, partial coalescence", "micro"],
  ["CBE 560", "Microbial growth and thermal death", "receiving"],
  ["FOOD SCI 511", "Dairy chemistry: lactose, milk proteins, meltdown", "micro"],
];

// ===================================================================================
// detail viewer: its own renderer, cutaway clipping, numbered callouts (from the gas twin)
// ===================================================================================
export class DetailViewer {
  constructor(host) {
    this.host = host; this.canvas = host.querySelector("canvas"); this.callouts = host.querySelector(".callouts");
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = true; this.renderer.localClippingEnabled = true;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color("#ffffff");
    this.scene.environment = new THREE.PMREMGenerator(this.renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    const sun = new THREE.DirectionalLight("#ffffff", 1.6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    this.sun = sun; this.scene.add(sun, new THREE.HemisphereLight("#eef3f7", "#4a4540", 1.0));
    this.floor = new THREE.Mesh(new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: "#eeeeee", roughness: 0.95 }));
    this.floor.receiveShadow = true; this.scene.add(this.floor);
    this.grid = new THREE.GridHelper(2, 20, "#cfcfcf", "#e0e0e0"); this.scene.add(this.grid);
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.01, 500);
    this.controls = new OrbitControls(this.camera, this.canvas); this.controls.enableDamping = true; this.controls.autoRotateSpeed = 0.6;
    this.clip = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
    this.cut = true; this.open = false; this.model = null;
    new ResizeObserver(() => this.resize()).observe(host);
  }
  resize() { const r = this.host.getBoundingClientRect(); if (!r.width) return; this.renderer.setSize(r.width, r.height, false); this.camera.aspect = r.width / r.height; this.camera.updateProjectionMatrix(); }
  show(stop, R) {
    if (this.model) { this.scene.remove(this.model.group); this.model.group.traverse(o => { o.geometry?.dispose?.(); }); }
    const m = stop.model(R); this.model = m; this.scene.add(m.group);
    const shells = []; m.group.traverse(o => { if (o.userData.shell) { o.material = o.material.clone(); o.material.side = THREE.DoubleSide; shells.push(o); } }); this.shells = shells;
    const bb = new THREE.Box3().setFromObject(m.group), c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3());
    const Rr = Math.max(sz.x, sz.z) * 0.8 + sz.length() * 0.2;
    this.floor.scale.setScalar(Rr); this.floor.position.y = bb.min.y - 0.002; this.grid.scale.setScalar(Rr); this.grid.position.y = bb.min.y;
    this.sun.position.set(c.x + Rr, c.y + Rr * 1.6, c.z + Rr * 1.2); this.sun.target.position.copy(c); this.scene.add(this.sun.target);
    Object.assign(this.sun.shadow.camera, { left: -Rr, right: Rr, top: Rr, bottom: -Rr, near: 0.01, far: Rr * 6 }); this.sun.shadow.camera.updateProjectionMatrix();
    this.cz = 0; this.resize();
    const d = (m.fit ?? sz.length()) * Math.min(1.8, Math.max(1, 1.45 / Math.max(0.3, this.camera.aspect))) * 1.1;
    this.camera.position.set(c.x + d * 0.55, c.y + d * 0.35, c.z + d * 0.85); this.controls.target.copy(c);
    this.camera.near = d / 300; this.camera.far = d * 40; this.camera.updateProjectionMatrix();
    this.setCut(this.cut);
    const kids = m.group.children.filter(o => !o.isPoints && !o.isLine && !o.isInstancedMesh);
    const ctr = c.clone(); this.explode = 0; this.explodeT = this.explodeT ?? 0;
    this.kids = kids.map(o => { const b = new THREE.Box3().setFromObject(o), oc = b.getCenter(new THREE.Vector3()), dd = oc.clone().sub(ctr);
      const ax = m.explodeAxis ?? "x", dir = new THREE.Vector3();
      if (o.userData.shell) { if (ax === "y") dir.z = Math.max(sz.z, 0.2) * 1.2; else dir.y = Math.max(sz.y, 0.4) * 0.9; }
      else dir[ax] = dd[ax] * 0.8;
      return { o, home: o.position.clone(), dir, oc }; });
    this.partKid = m.parts.map(([, p]) => { let best = null, bd = 1e9; for (const k of this.kids) { if (k.o.userData.shell) continue; const dd = k.oc.distanceTo(p); if (dd < bd) { bd = dd; best = k; } } return best; });
    this.callouts.innerHTML = m.parts.map(([n], i) => `<button class="co" data-i="${i}"><b>${i + 1}</b><span>${n}</span></button>`).join("");
    this.coEls = [...this.callouts.children];
    this.coEls.forEach(el => el.onclick = () => this.focus(+el.dataset.i));
    this.focusT = null; this.open = true; this.resize();
    return m;
  }
  focus(i) {
    const p = this.partPos(i), d = Math.max(0.15, (this.model.fit ?? 6) * 0.35), dir = this.camera.position.clone().sub(this.controls.target).normalize();
    this.focusT = { t: 0, p0: this.camera.position.clone(), t0: this.controls.target.clone(), t1: p.clone(), p1: p.clone().addScaledVector(dir, d) };
    this.coEls.forEach((el, j) => el.classList.toggle("on", j === i)); this.onFocus?.(i);
  }
  partPos(i) { const k = this.partKid[i], p = this.model.parts[i][1].clone(); if (k) p.add(k.o.position).sub(k.home); return p; }
  setExplode(on) { this.explodeT = on ? 1 : 0; }
  setCut(on) { this.cut = on; for (const o of this.shells || []) { o.material.clippingPlanes = on ? [this.clip] : []; o.material.needsUpdate = true; } }
  render(dt, live) {
    if (!this.open || !this.model) return;
    this.model.update?.(dt, live || {});
    this.explode += (this.explodeT - this.explode) * Math.min(1, dt * 3);
    for (const k of this.kids) k.o.position.copy(k.home).addScaledVector(k.dir, this.explode);
    if (this.focusT) { const f = this.focusT; f.t = Math.min(1, f.t + dt / 1.1); const u = f.t * f.t * (3 - 2 * f.t);
      this.camera.position.lerpVectors(f.p0, f.p1, u); this.controls.target.lerpVectors(f.t0, f.t1, u); if (f.t >= 1) this.focusT = null; }
    this.controls.update();
    const sgn = this.camera.position.z >= this.cz ? 1 : -1;
    this.clip.normal.set(0, 0, -sgn); this.clip.constant = sgn * this.cz;
    this.renderer.render(this.scene, this.camera);
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight, P = new THREE.Vector3();
    this.model.parts.forEach(([, p], i) => {
      P.copy(this.partPos(i)).applyMatrix4(this.model.group.matrixWorld).project(this.camera); const el = this.coEls[i];
      const vis = P.z < 1 && Math.abs(P.x) < 1.05 && Math.abs(P.y) < 1.05;
      el.style.display = vis ? "" : "none"; if (vis) el.style.transform = `translate(${(P.x * 0.5 + 0.5) * w}px, ${(-P.y * 0.5 + 0.5) * h}px)`;
    });
  }
}
