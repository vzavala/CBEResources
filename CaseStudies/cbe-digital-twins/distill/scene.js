// 3D scene of the Summer Lab Distillation Digital Twin: a generic pilot-scale sieve-tray column in a teaching-lab bay.
// Glass tray sections with steel flanges, reboiler pot, overhead condenser, reflux splitter, feed tank and preheater,
// product receivers, a walkway and a console. Proportions are those of a pilot column; it is not a copy of any equipment.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { brushedMaps, sieveTex, gratingTex, canvasTex, rngFrom } from "./post.js";

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
// data colour scales, the same as in the source distillation twin: liquid by ethanol fraction (water blue -> ethanol amber, HSL blend,
// full scale at 85 mol %) or by temperature (351 K blue -> 375 K red, HSL blend)
const CW = new THREE.Color(0x3d8bff), CE = new THREE.Color(0xffb84a), CC = new THREE.Color(0x2f6bff), CH = new THREE.Color(0xff3b2f);
export const colorX = (x, out = new THREE.Color()) => out.copy(CW).lerpHSL(CE, Math.pow(Math.min(1, Math.max(0, x / 0.85)), 0.7));
export const colorT = (Tc, out = new THREE.Color()) => out.copy(CC).lerpHSL(CH, Math.min(1, Math.max(0, (Tc + 273.15 - 351) / 24)));
export const rampCSS = which => { const c = new THREE.Color(), st = []; for (let k = 0; k <= 10; k++) { which === "T" ? colorT(77.85 + 2.4 * k, c) : colorX(0.085 * k, c); st.push(`#${c.getHexString()} ${k * 10}%`); } return `linear-gradient(90deg, ${st.join(", ")})`; };

export function buildColumnScene({ renderer, scene, low, nTrays = 14, feedTray = 12 }) {
  const N = nTrays, R = 0.2, S = 0.27, Y0 = 1.42, YT = Y0 + N * S;
  const trayY = i => Y0 + (N - i) * S + 0.03;                 // deck height of tray i (1 = top)
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.background = new THREE.Color(0xdde3e8); scene.fog = new THREE.Fog(0xdde3e8, 18, 40);
  const bm = brushedMaps([3, 3]);
  // materials: colours and finishes follow the source distillation twin (src/scene/plant.js, lab.js), so the scene reads as the same lab
  const M = {
    steel: new THREE.MeshStandardMaterial({ color: 0xb8bec6, metalness: 0.85, roughness: 0.28, normalMap: bm.normal, normalScale: new THREE.Vector2(0.2, 0.2), envMapIntensity: 1.4 }),
    ss: new THREE.MeshStandardMaterial({ color: 0xd9dee3, metalness: 0.8, roughness: 0.25, envMapIntensity: 1.5 }),           // stainless tanks
    dark: new THREE.MeshStandardMaterial({ color: 0x6d737b, metalness: 0.8, roughness: 0.4 }),            // dark steel: bolts, valve bodies
    black: new THREE.MeshStandardMaterial({ color: 0x1d2024, roughness: 0.5 }),
    flange: new THREE.MeshStandardMaterial({ color: 0xc5050c, metalness: 0.35, roughness: 0.35 }),        // red flanges
    frame: new THREE.MeshStandardMaterial({ color: 0x9aa2aa, metalness: 0.45, roughness: 0.5 }),          // painted-steel mezzanine
    rail: new THREE.MeshStandardMaterial({ color: 0x9aa2aa, metalness: 0.45, roughness: 0.5 }),
    tread: new THREE.MeshStandardMaterial({ color: 0x2b2d31, roughness: 0.85 }),
    clad: new THREE.MeshStandardMaterial({ color: 0xa3a9b0, roughness: 0.9 }),                            // insulated utility lines
    alu: new THREE.MeshStandardMaterial({ color: 0xd9dde2, metalness: 0.6, roughness: 0.45 }),
    cw: new THREE.MeshStandardMaterial({ color: 0x2f62b5, metalness: 0.4, roughness: 0.45 }),
    pump: new THREE.MeshStandardMaterial({ color: 0x2f6fd6, metalness: 0.4, roughness: 0.5 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.13, roughness: 0.04, metalness: 0, envMapIntensity: 1.4, side: THREE.DoubleSide, depthWrite: false }),
    floor: new THREE.MeshStandardMaterial({ map: canvasTex(256, 256, (g, w, h) => { g.fillStyle = "#c3c8cd"; g.fillRect(0, 0, w, h); const r = rngFrom(3); for (let k = 0; k < 1400; k++) { g.fillStyle = `rgba(0,0,0,${r() * 0.035})`; g.fillRect(r() * w, r() * h, 2, 2); } g.strokeStyle = "rgba(0,0,0,0.08)"; g.lineWidth = 2; g.strokeRect(0, 0, w, h); }, { repeat: [12, 6] }), roughness: 0.35, metalness: 0.05 }),   // light grey epoxy
    wall: new THREE.MeshStandardMaterial({ color: 0xe9ecef, roughness: 0.9 }),
    rubber: new THREE.MeshStandardMaterial({ color: "#22262a", roughness: 0.85 }),
    deck: new THREE.MeshStandardMaterial({ map: sieveTex(), color: 0xa9b0b8, metalness: 0.8, roughness: 0.3 }),
    desk: new THREE.MeshStandardMaterial({ color: 0xe9ebee, roughness: 0.6 }),
    coat: new THREE.MeshPhysicalMaterial({ color: "#f4f5f7", roughness: 0.85, sheen: 0.5, sheenRoughness: 0.7 }),
    pants: new THREE.MeshStandardMaterial({ color: "#2c3642", roughness: 0.9 }),
    hat: new THREE.MeshStandardMaterial({ color: "#f7f7f5", roughness: 0.45 }),
    lens: new THREE.MeshPhysicalMaterial({ color: "#dfeaf2", transparent: true, opacity: 0.55, roughness: 0.05 }),
    red: new THREE.MeshStandardMaterial({ color: 0xc5050c, roughness: 0.5, metalness: 0.3 }),
  };
  const liquidMat = () => new THREE.MeshPhysicalMaterial({ color: "#3aa0c8", roughness: 0.12, metalness: 0, transparent: true, opacity: 0.93, envMapIntensity: 1.0 });
  const root = new THREE.Group(); scene.add(root);
  const add = (geo, mat, x = 0, y = 0, z = 0, sh = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = sh; m.receiveShadow = true; root.add(m); return m; };
  const cyl = (r, h, mat, x, y, z, seg = 28) => add(new THREE.CylinderGeometry(r, r, h, seg), mat, x, y, z);
  // straight pipe runs with spherical elbows
  const UP = V3(0, 1, 0);
  function pipe(pts, r, mat) {
    for (let k = 0; k < pts.length; k++) { const p = pts[k]; if (k > 0 && k < pts.length - 1) add(new THREE.SphereGeometry(r * 1.08, 14, 10), mat, p.x, p.y, p.z);
      if (k === 0) continue; const a = pts[k - 1], d = p.clone().sub(a), m = add(new THREE.CylinderGeometry(r, r, d.length(), 14), mat, (a.x + p.x) / 2, (a.y + p.y) / 2, (a.z + p.z) / 2); m.quaternion.setFromUnitVectors(UP, d.normalize()); }
  }
  const valve = (x, y, z) => { cyl(0.05, 0.09, M.dark, x, y, z, 12); const h = add(new THREE.TorusGeometry(0.055, 0.012, 8, 18), M.red, x, y + 0.1, z); h.rotation.x = Math.PI / 2; cyl(0.008, 0.08, M.steel, x, y + 0.06, z, 6); };

  // ---- room ----
  const floor = add(new THREE.PlaneGeometry(18, 9), M.floor, 0.6, 0, 1.6, false); floor.rotation.x = -Math.PI / 2;
  add(new THREE.BoxGeometry(18, 8, 0.1), M.wall, 0.6, 4, -1.75, false);
  for (let k = 0; k < 5; k++) add(new THREE.BoxGeometry(0.12, 8, 0.14), M.wall, -6.6 + k * 3.6, 4, -1.66, false);   // pilasters
  add(new THREE.BoxGeometry(18, 0.16, 0.03), M.dark, 0.6, 0.08, -1.69, false);
  // wall headers: steam (clad) and cooling water (blue)
  pipe([V3(-7.5, 6.35, -1.5), V3(8.5, 6.35, -1.5)], 0.07, M.clad); pipe([V3(-7.5, 6.05, -1.5), V3(8.5, 6.05, -1.5)], 0.05, M.cw); pipe([V3(-7.5, 5.85, -1.5), V3(8.5, 5.85, -1.5)], 0.05, M.cw);
  for (let k = 0; k < 6; k++) add(new THREE.BoxGeometry(0.05, 0.75, 0.2), M.frame, -6 + k * 2.7, 6.1, -1.6);

  // ---- column: glass tray sections, flanges, trays ----
  const flangeGeo = new THREE.CylinderGeometry(R * 1.3, R * 1.3, 0.035, 36), boltGeo = new THREE.CylinderGeometry(0.009, 0.009, 0.06, 6);
  const bolts = new THREE.InstancedMesh(boltGeo, M.dark, (N + 1) * 10); bolts.castShadow = true; root.add(bolts); const dm = new THREE.Object3D(); let nb = 0;
  for (let k = 0; k <= N; k++) { const y = Y0 + k * S; add(flangeGeo, M.flange, 0, y, 0);
    for (let b = 0; b < 10; b++) { const a = b / 10 * Math.PI * 2; dm.position.set(Math.cos(a) * R * 1.17, y, Math.sin(a) * R * 1.17); dm.updateMatrix(); bolts.setMatrixAt(nb++, dm.matrix); } }
  const glass = add(new THREE.CylinderGeometry(R, R, N * S, 40, 1, true), M.glass, 0, Y0 + N * S / 2, 0, false); glass.renderOrder = 5;
  const trays = [], deckGeo = new THREE.CircleGeometry(R * 0.985, 40), liqGeo = new THREE.CylinderGeometry(R * 0.95, R * 0.95, 1, 36), frothGeo = new THREE.CylinderGeometry(R * 0.94, R * 0.94, 1, 28);
  for (let i = 1; i <= N; i++) {
    const y = trayY(i), side = i % 2 ? 1 : -1;
    const d = add(deckGeo, M.deck, 0, y, 0); d.rotation.x = -Math.PI / 2;
    add(new THREE.BoxGeometry(0.006, 0.03, R * 1.5), M.steel, side * R * 0.62, y + 0.015, 0);                 // outlet weir
    add(new THREE.BoxGeometry(0.005, S - 0.07, R * 1.5), M.steel, side * R * 0.66, y - (S - 0.07) / 2 - 0.004, 0); // downcomer apron below this tray
    const liq = add(liqGeo, liquidMat(), 0, y, 0, false), froth = add(frothGeo, new THREE.MeshStandardMaterial({ color: "#ffffff", transparent: true, opacity: 0.5, roughness: 0.9, depthWrite: false }), 0, y, 0, false);
    const fall = add(new THREE.BoxGeometry(0.012, S - 0.05, R * 0.9), liquidMat(), side * R * 0.8, y - (S - 0.05) / 2, 0, false);
    cyl(0.012, 0.07, M.steel, 0, y + 0.07, R + 0.035, 8).rotation.x = Math.PI / 2;                           // sample port
    trays.push({ i, y, liq, froth, fall });
  }
  // top head, vapour line, bottom cone
  const head = add(new THREE.SphereGeometry(R * 1.02, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), M.steel, 0, YT + 0.02, 0); head.scale.y = 0.7;
  add(new THREE.CylinderGeometry(R * 1.02, 0.4, 0.3, 36), M.steel, 0, Y0 - 0.15, 0);
  // ---- reboiler pot ----
  const RBY = 0.82; cyl(0.44, 0.66, M.steel, 0, RBY, 0, 40);
  for (const s of [1, -1]) { const e = add(new THREE.SphereGeometry(0.44, 36, 14, 0, Math.PI * 2, 0, Math.PI / 2), M.steel, 0, RBY + s * 0.33, 0); e.scale.y = 0.4 * s; }
  for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 + 0.5; cyl(0.028, 0.5, M.frame, Math.cos(a) * 0.36, 0.25, Math.sin(a) * 0.36, 10); }
  cyl(0.47, 0.06, M.alu, 0, RBY - 0.05, 0, 40); cyl(0.47, 0.06, M.alu, 0, RBY + 0.12, 0, 40);                  // steam jacket bands
  // sight glass with the reboiler level
  cyl(0.034, 0.5, M.glass, 0.24, RBY, 0.45, 14); const sight = add(new THREE.CylinderGeometry(0.025, 0.025, 1, 12), liquidMat(), 0.24, RBY - 0.25, 0.45, false);
  // steam in (clad, from the wall header) and condensate out
  pipe([V3(-0.9, 6.35, -1.5), V3(-0.9, 1.0, -1.5), V3(-0.9, 1.0, -0.45), V3(-0.4, 1.0, -0.2)], 0.045, M.clad); valve(-0.9, 1.9, -1.5);
  pipe([V3(0.25, 0.42, -0.2), V3(0.6, 0.42, -0.9), V3(0.6, 0.12, -0.9), V3(0.6, 0.12, -1.6)], 0.022, M.steel);
  // bottoms line -> cooler -> bottoms tank
  pipe([V3(0, 0.5, 0), V3(0, 0.3, 0), V3(1.5, 0.3, 0), V3(1.5, 0.3, -0.75), V3(2.55, 0.3, -0.75), V3(2.55, 0.75, -0.75)], 0.028, M.steel); valve(0.9, 0.3, 0);
  // ---- condenser, vent, reflux splitter ----
  const CXp = 1.2, CY = YT + 0.55;
  pipe([V3(0, YT + 0.1, 0), V3(0, CY + 0.28, 0), V3(CXp - 0.3, CY + 0.28, 0), V3(CXp - 0.3, CY + 0.15, 0)], 0.05, M.steel);
  const shell = cyl(0.17, 1.05, M.steel, CXp, CY, 0, 36); shell.rotation.z = Math.PI / 2;
  for (const s of [1, -1]) { const c = cyl(0.2, 0.05, M.steel, CXp + s * 0.5, CY, 0, 36); c.rotation.z = Math.PI / 2; const e = add(new THREE.SphereGeometry(0.17, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.steel, CXp + s * 0.53, CY, 0); e.rotation.z = -s * Math.PI / 2; e.scale.y = 0.5; }
  for (const s of [1, -1]) add(new THREE.BoxGeometry(0.06, 0.5, 0.3), M.frame, CXp + s * 0.32, CY - 0.4, -0.25);    // saddle brackets to the walkway frame
  pipe([V3(CXp + 0.62, CY, 0), V3(CXp + 0.85, CY, 0), V3(CXp + 0.85, CY, -1.5), V3(CXp + 0.85, 5.85, -1.5)], 0.035, M.cw);
  pipe([V3(CXp - 0.62, CY, 0), V3(CXp - 0.62, CY, -0.6), V3(CXp - 0.62, 6.05, -0.6), V3(CXp - 0.62, 6.05, -1.5)], 0.035, M.cw);
  pipe([V3(CXp + 0.3, CY + 0.15, 0), V3(CXp + 0.3, CY + 0.5, 0)], 0.022, M.steel);                              // vent
  const SPY = CY - 0.62; pipe([V3(CXp, CY - 0.16, 0), V3(CXp, SPY + 0.13, 0)], 0.022, M.steel);
  cyl(0.1, 0.26, M.glass, CXp, SPY, 0, 24); cyl(0.105, 0.02, M.steel, CXp, SPY + 0.13, 0, 24); cyl(0.105, 0.02, M.steel, CXp, SPY - 0.13, 0, 24);
  const funnel = add(new THREE.ConeGeometry(0.035, 0.1, 14, 1, true), M.steel, CXp, SPY + 0.04, 0); funnel.rotation.x = Math.PI;
  const drip = add(new THREE.CylinderGeometry(0.007, 0.007, 0.12, 6), liquidMat(), CXp, SPY - 0.06, 0, false);
  const TR1 = trayY(1) + 0.12;
  pipe([V3(CXp - 0.05, SPY - 0.13, 0), V3(CXp - 0.05, TR1, 0), V3(R, TR1, 0)], 0.02, M.steel);                   // reflux return
  pipe([V3(CXp + 0.05, SPY - 0.13, 0), V3(CXp + 0.05, SPY - 0.3, 0), V3(2.55, SPY - 0.3, 0), V3(2.55, SPY - 0.3, 0.55), V3(2.55, 0.95, 0.55)], 0.02, M.steel);   // distillate
  // ---- product receivers: glass vessels with a rising level ----
  function receiver(x, z, lbl) { cyl(0.3, 0.75, M.glass, x, 0.575, z, 32); cyl(0.32, 0.04, M.red, x, 0.2, z, 32); cyl(0.31, 0.03, M.ss, x, 0.95, z, 32);
    for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; cyl(0.02, 0.2, M.red, x + Math.cos(a) * 0.25, 0.1, z + Math.sin(a) * 0.25, 8); }
    return add(new THREE.CylinderGeometry(0.285, 0.285, 1, 30), liquidMat(), x, 0.22, z, false); }
  const recD = receiver(2.55, 0.55), recB = receiver(2.55, -0.75);
  // ---- feed tank, pump, preheater, feed line ----
  const FY = trayY(feedTray) + 0.1;
  cyl(0.42, 1.0, M.ss, -2.6, 0.9, 0.1, 40); { const e = add(new THREE.SphereGeometry(0.42, 36, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.ss, -2.6, 1.4, 0.1); e.scale.y = 0.35; }
  for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + 0.78; cyl(0.025, 0.42, M.red, -2.6 + Math.cos(a) * 0.34, 0.21, 0.1 + Math.sin(a) * 0.34, 10); }
  add(new RoundedBoxGeometry(0.34, 0.2, 0.2, 3, 0.03), M.pump, -1.85, 0.17, 0.55); cyl(0.09, 0.1, M.steel, -1.62, 0.17, 0.55, 20).rotation.z = Math.PI / 2; add(new THREE.BoxGeometry(0.6, 0.05, 0.3), M.frame, -1.8, 0.04, 0.55);
  pipe([V3(-2.6, 0.42, 0.1), V3(-2.6, 0.17, 0.1), V3(-2.6, 0.17, 0.55), V3(-2.05, 0.17, 0.55)], 0.026, M.steel);
  const PHX = -1.05; pipe([V3(-1.6, 0.17, 0.55), V3(-1.6, 0.6, 0.55), V3(-1.6, 0.6, 0), V3(-1.6, FY, 0), V3(PHX - 0.36, FY, 0)], 0.022, M.steel);
  const ph = cyl(0.085, 0.62, M.alu, PHX, FY, 0, 24); ph.rotation.z = Math.PI / 2; for (const s of [1, -1]) cyl(0.1, 0.03, M.steel, PHX + s * 0.31, FY, 0, 24).rotation.z = Math.PI / 2;
  pipe([V3(PHX + 0.33, FY, 0), V3(-R, FY, 0)], 0.022, M.steel); valve(-0.45, FY, 0);
  pipe([V3(PHX, FY + 0.08, 0), V3(PHX, FY + 0.35, 0), V3(PHX, FY + 0.35, -1.5)], 0.02, M.clad);                    // steam to the preheater
  // ---- walkway behind the column, handrail, stairs ----
  const WY = 3.1, deckMat = new THREE.MeshStandardMaterial({ color: 0x8c949c, metalness: 0.7, roughness: 0.45, alphaMap: gratingTex([26, 6]), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide });
  const wd = add(new THREE.PlaneGeometry(5.2, 1.25), deckMat, 0.6, WY, -1.02); wd.rotation.x = -Math.PI / 2;
  add(new THREE.BoxGeometry(5.2, 0.12, 0.05), M.frame, 0.6, WY - 0.06, -0.4); add(new THREE.BoxGeometry(5.2, 0.12, 0.05), M.frame, 0.6, WY - 0.06, -1.63);
  for (const x of [-1.95, 0.6, 3.15]) for (const z of [-0.42, -1.6]) add(new THREE.BoxGeometry(0.09, WY, 0.09), M.frame, x, WY / 2, z);
  const railPts = []; for (let x = -2; x <= 3.21; x += 0.65) railPts.push(x);
  railPts.forEach(x => cyl(0.02, 1.05, M.rail, x, WY + 0.525, -0.4, 8)); pipe([V3(-2, WY + 1.05, -0.4), V3(3.2, WY + 1.05, -0.4)], 0.022, M.rail); pipe([V3(-2, WY + 0.55, -0.4), V3(3.2, WY + 0.55, -0.4)], 0.016, M.rail);
  add(new THREE.BoxGeometry(0.3, 0.07, 0.12), M.frame, 0, Y0 + 7.3 * S, -0.3); add(new THREE.BoxGeometry(0.3, 0.07, 0.12), M.frame, 0, Y0 + 12.6 * S, -0.3);   // column supports
  const nSt = 13, run = 0.27, SX = 3.62, SZ0 = -0.4; for (let k = 0; k < nSt; k++) add(new THREE.BoxGeometry(0.8, 0.035, run + 0.02), M.tread, SX, WY - (k + 1) * WY / nSt, SZ0 + (k + 0.5) * run);
  for (const x of [SX - 0.42, SX + 0.42]) { const st = add(new THREE.BoxGeometry(0.04, 0.18, Math.hypot(nSt * run, WY) + 0.1), M.frame, x, WY / 2 - 0.1, SZ0 + nSt * run / 2); st.rotation.x = Math.atan2(WY, nSt * run); }
  add(new THREE.BoxGeometry(0.9, 0.05, 1.25), M.frame, SX, WY - 0.02, -1.02); for (const z of [-0.42, -1.6]) add(new THREE.BoxGeometry(0.09, WY, 0.09), M.frame, SX + 0.4, WY / 2, z);
  for (const x of [SX - 0.42, SX + 0.42]) { pipe([V3(x, WY + 1.0, SZ0), V3(x, 1.0, SZ0 + nSt * run)], 0.02, M.rail); for (let k = 0; k <= 3; k++) cyl(0.018, 1.0, M.rail, x, WY - k * WY / 3 + 0.5, SZ0 + k * nSt * run / 3, 8); }
  pipe([V3(SX + 0.42, WY + 1.05, -0.4), V3(SX + 0.42, WY + 1.05, -1.6)], 0.022, M.rail);
  // ---- console with a screen, and a person for scale ----
  const KX = -3.9, KZ = 0.9; add(new RoundedBoxGeometry(1.2, 0.9, 0.6, 3, 0.03), M.desk, KX, 0.45, KZ); add(new RoundedBoxGeometry(1.3, 0.05, 0.7, 2, 0.02), M.black, KX, 0.93, KZ);
  const scrTex = canvasTex(256, 160, (g, w, h) => { g.fillStyle = "#10202c"; g.fillRect(0, 0, w, h); g.strokeStyle = "#5fd08a"; g.lineWidth = 2; g.beginPath(); for (let x = 0; x < w; x += 4) g.lineTo(x, 50 + 14 * Math.sin(x / 22) * Math.exp(-x / 180)); g.stroke();
    g.strokeStyle = "#f0b040"; g.beginPath(); for (let x = 0; x < w; x += 4) g.lineTo(x, 105 - 22 * (1 - Math.exp(-x / 60))); g.stroke(); g.fillStyle = "#9fb4c4"; for (let k = 0; k < 5; k++) g.fillRect(12 + k * 50, 132, 34, 14); });
  const mon = add(new RoundedBoxGeometry(0.7, 0.45, 0.04, 2, 0.01), M.black, KX, 1.32, KZ - 0.12); const scr = add(new THREE.PlaneGeometry(0.64, 0.39), new THREE.MeshStandardMaterial({ map: scrTex, emissive: "#ffffff", emissiveMap: scrTex, emissiveIntensity: 0.55, roughness: 0.3 }), KX, 1.32, KZ - 0.097, false); cyl(0.03, 0.14, M.dark, KX, 1.02, KZ - 0.12, 10); void mon; void scr;
  // people (Part W): an engineer at the console and an operator taking a sample at the column; same lab coat, hard hat and safety glasses
  function person({ x, z, rot, h, skin, hair, tail, build = 1, reach = 0 }) {
    const P = new THREE.Group(), k = h / 1.76; P.position.set(x, 0, z); P.rotation.y = rot; P.scale.setScalar(k); root.add(P);
    const sk = new THREE.MeshPhysicalMaterial({ color: skin, roughness: 0.6, sheen: 0.3 }), hr = new THREE.MeshStandardMaterial({ color: hair, roughness: 0.8 });
    const part = (geo, mat, px, py, pz) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.castShadow = true; P.add(m); return m; };
    for (const sd of [1, -1]) { part(new THREE.CapsuleGeometry(0.072 * build, 0.72, 6, 12), M.pants, sd * 0.095, 0.45, 0); part(new RoundedBoxGeometry(0.105, 0.07, 0.25, 2, 0.02), M.rubber, sd * 0.095, 0.04, 0.04);
      const up = sd === 1 && reach, arm = part(new THREE.CapsuleGeometry(0.046 * build, 0.5, 6, 10), M.coat, sd * 0.235 * build, up ? 1.3 : 1.17, up ? 0.2 : 0.03); arm.rotation.z = sd * 0.1; if (up) arm.rotation.x = -1.25;
      part(new THREE.SphereGeometry(0.046, 12, 10), sk, sd * 0.26 * build, up ? 1.38 : 0.86, up ? 0.48 : 0.04);
      if (up) part(new THREE.CylinderGeometry(0.028, 0.028, 0.1, 12), M.glass, sd * 0.26 * build, 1.42, 0.52); }
    part(new THREE.CapsuleGeometry(0.165 * build, 0.42, 8, 16), M.coat, 0, 1.2, 0).scale.z = 0.72; part(new THREE.CylinderGeometry(0.185 * build, 0.2 * build, 0.34, 16), M.coat, 0, 0.86, 0).scale.z = 0.7;
    part(new THREE.CylinderGeometry(0.047, 0.052, 0.08, 12), sk, 0, 1.55, 0); part(new THREE.SphereGeometry(0.102, 20, 16), sk, 0, 1.67, 0).scale.set(0.92, 1.08, 1);
    part(new THREE.SphereGeometry(0.108, 18, 12, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.4), hr, 0, 1.675, -0.012);                       // hair below the hard hat
    if (tail) { part(new THREE.SphereGeometry(0.04, 12, 10), hr, 0, 1.64, -0.115); const t = part(new THREE.CapsuleGeometry(0.028, 0.2, 6, 10), hr, 0, 1.5, -0.13); t.rotation.x = 0.12; }   // tied-back ponytail
    const hat = part(new THREE.SphereGeometry(0.116, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.hat, 0, 1.71, 0); hat.scale.y = 0.82; part(new THREE.CylinderGeometry(0.136, 0.136, 0.012, 20), M.hat, 0, 1.71, 0.025);
    part(new RoundedBoxGeometry(0.17, 0.045, 0.02, 2, 0.008), M.lens, 0, 1.68, 0.098);                                                           // safety glasses
    return P;
  }
  person({ x: KX + 0.1, z: KZ + 0.72, rot: Math.PI * 0.94, h: 1.66, skin: "#b9805c", hair: "#2b1d16", tail: true, build: 0.9 });                    // engineer at the console
  person({ x: 1.0, z: 0.3, rot: -Math.PI / 2, h: 1.82, skin: "#8a5a3c", hair: "#15120f", build: 1.04, reach: 1 });                             // operator taking a sample
  // ---- animated parts: bubbles on trays, vent plume ----
  const NB = low ? 8 : 16, bub = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.05, transparent: true, opacity: 0.55, envMapIntensity: 1.5 }), N * NB); bub.frustumCulled = false; root.add(bub);
  const rnd = rngFrom(99), BB = []; for (let i = 0; i < N; i++) for (let k = 0; k < NB; k++) { const a = rnd() * 6.283, r = Math.sqrt(rnd()) * R * 0.78; BB.push({ i, x: Math.cos(a) * r * 0.75, z: Math.sin(a) * r, ph: rnd(), sp: 0.7 + rnd() * 0.8, sz: 0.006 + rnd() * 0.007 }); }
  const plume = []; { const pg = new THREE.SphereGeometry(1, 10, 8); for (let k = 0; k < 6; k++) { const m = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ color: "#ffffff", transparent: true, opacity: 0.0, roughness: 1, depthWrite: false })); m.position.set(CXp + 0.3, CY + 0.55, 0); root.add(m); plume.push(m); } }

  const A = {
    reboiler: V3(0.34, RBY + 0.05, 0.3), trays: V3(0, trayY(3) + 0.1, R), tray: V3(-0.02, trayY(6) + 0.06, R), wall: V3(-R, trayY(9) + 0.12, 0.02), feed: V3(-R - 0.1, FY, 0.02), sample: V3(0.02, trayY(2) + 0.07, R + 0.08),
    condenser: V3(CXp + 0.1, CY, 0.17), splitter: V3(CXp, SPY, 0.1), product: V3(2.55, 0.7, 0.85), bottoms: V3(2.55, 0.7, -0.45), console: V3(KX, 1.4, KZ), feedTank: V3(-2.6, 1.0, 0.52), preheater: V3(PHX, FY + 0.02, 0.09),
    top: V3(0, YT + 0.3, 0), colMid: V3(0, Y0 + N * S / 2, 0), walkway: V3(1.9, WY + 0.6, -0.5),
  };
  const VIEWS = {
    overview: { p: [0.9, 3.6, 11.9], c: [0.05, 3.22, 0], fov: 33 },
    column: { p: [1.5, 4.3, 3.6], c: [0.1, 3.9, 0], fov: 40 },
    tray: { p: [0.62, trayY(7) + 0.42, 1.25], c: [0, trayY(7) + 0.1, 0], fov: 40 },
    feed: { p: [-0.9, FY + 0.7, 2.3], c: [-0.45, FY + 0.1, 0], fov: 40 },
    reboiler: { p: [1.5, 1.5, 2.6], c: [0.1, 0.95, 0], fov: 40 },
    condenser: { p: [2.2, CY + 0.5, 2.7], c: [0.9, CY - 0.25, 0], fov: 40 },
    products: { p: [3.9, 1.7, 3.0], c: [2.4, 0.7, 0], fov: 40 },
    console: { p: [-2.9, 2.0, 4.4], c: [-3.7, 1.2, 0.9], fov: 40 },
  };

  const col = new THREE.Color(), WHITE = new THREE.Color("#ffffff"), o = new THREE.Object3D(); let mode = "x", recT = 0;
  const tint = (mat, x, Tk) => { (mode === "T" ? colorT(Tk - 273.15, col) : colorX(x, col)); mat.color.copy(col); };
  function update(Vs, dt, t) {
    const vapour = Math.min(1.6, Vs.Vrel);
    for (const tr of trays) { const i = tr.i, h = Math.max(0.004, Vs.hcl[i]), f = Math.max(h, Math.min(S - 0.05, Vs.froth[i]));
      tint(tr.liq.material, Vs.x[i], Vs.T[i]); tr.liq.scale.y = h; tr.liq.position.y = tr.y + h / 2;
      tr.froth.scale.y = Math.max(0.001, f - h); tr.froth.position.y = tr.y + h + (f - h) / 2; tr.froth.material.opacity = vapour > 0.02 ? (Vs.flood[i] > 1 ? 0.8 : 0.5) : 0; tr.froth.material.color.copy(tr.liq.material.color).lerp(WHITE, 0.45);
      tr.fall.visible = Vs.Lrel > 0.02; tr.fall.material.color.copy(tr.liq.material.color); tr.f = f; }
    for (let k = 0; k < BB.length; k++) { const b = BB[k], tr = trays[b.i], u = (t * b.sp * (0.6 + vapour) + b.ph * 7) % 1, s = vapour > 0.02 ? b.sz * (0.7 + 0.6 * vapour) : 0;
      o.position.set(b.x - (tr.i % 2 ? 1 : -1) * 0.02, tr.y + 0.006 + u * Math.max(0.02, tr.f - 0.004), b.z); o.scale.setScalar(s); o.updateMatrix(); bub.setMatrixAt(k, o.matrix); }
    bub.instanceMatrix.needsUpdate = true;
    const lv = Math.max(0.02, Math.min(1, Vs.level)) * 0.48; sight.scale.y = lv; sight.position.y = RBY - 0.25 + lv / 2; tint(sight.material, Vs.x[N + 1], Vs.T[N + 1]);
    // swinging funnel: on the reflux side for R/(R+1) of each 6 s cycle
    const cyc = (t % 6) / 6, toReflux = cyc < Vs.refluxFrac; funnel.rotation.z = (toReflux ? 1 : -1) * 0.5; drip.position.x = CXp + (toReflux ? -0.05 : 0.05); drip.visible = Vs.Vrel > 0.02 && Vs.vent < 0.9; tint(drip.material, Vs.x[0], Vs.T[0]);
    // receivers fill slowly and empty again (a visual loop, not a model state)
    recT = (recT + dt * 0.012 * (0.3 + Vs.Drel)) % 1; const hD = 0.05 + 0.6 * recT, hB = 0.05 + 0.6 * ((recT * 1.7) % 1);
    recD.scale.y = hD; recD.position.y = 0.22 + hD / 2; tint(recD.material, Vs.x[0], 298); recD.visible = Vs.Drel > 0.001; recB.scale.y = hB; recB.position.y = 0.22 + hB / 2; tint(recB.material, Vs.x[N + 1], 298);
    plume.forEach((m, k) => { const u = (t * 0.35 + k / plume.length) % 1; m.position.y = CY + 0.55 + u * 0.9; m.position.x = CXp + 0.3 + u * 0.25; m.scale.setScalar(0.05 + u * 0.22); m.material.opacity = Vs.vent > 0.01 ? 0.5 * (1 - u) * Math.min(1, Vs.vent * 3 + 0.3) : 0; });
  }
  return { A, VIEWS, update, setMode: m => { mode = m; }, trayY, N };
}
