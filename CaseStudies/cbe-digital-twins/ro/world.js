// Static 3D world for the SWRO desalination twin: coast, seabed, open-sea intake, intake pump station, coagulation and
// flocculation, UF pretreatment, cartridge filters and dosing, RO hall (6 trains: HP pump, pressure exchangers, booster,
// 112-vessel rack), CIP skid, limestone/CO2 post-treatment, chlorination, product storage and the brine outfall diffuser.
// Scene units are metres, everything at true scale (no compression). x points inland, the shoreline is x = 0, the sea
// surface is y = 0 and the plant pad sits at y = P0. Layout and equipment sizes are Typical for a 60 000 m³/d plant.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { PLANT } from "./models.js";

export const P0 = 4;                       // plant pad elevation above mean sea level, m
export const TRAIN_Z = [-40, -24, -8, 8, 24, 40];
export const RACK = { x0: 272, len: 7.9, pitch: 0.34, cols: 14, rows: 8, y0: P0 + 0.75 };
export const INTAKE_XZ = [[-900, -265], [-900, -235]];
export const DIFF = { x0: -700, x1: -790, z: 250, risers: 8 };

// ---------- deterministic noise ----------
function hash2(i, j) { let h = (i * 374761393 + j * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, z) {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash2(i, j), b = hash2(i + 1, j), c = hash2(i, j + 1), d = hash2(i + 1, j + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, z, oct = 5) { let s = 0, a = 0.5, f = 1; for (let o = 0; o < oct; o++) { s += a * vnoise(x * f, z * f); f *= 2.03; a *= 0.5; } return s; }
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ground height: seabed sloping 2 % to 25 m, beach and berm up to the pad, arid hills inland, flat plant pad
export function groundY(x, z) {
  if (x < 0) return -Math.min(25, 0.6 + 0.02 * -x) + 0.7 * (fbm(x / 70, z / 70, 3) - 0.5) * smooth(-40, -200, x);
  const pad = (1 - smooth(500, 580, x)) * (1 - smooth(190, 270, Math.abs(z)));
  const hills = 34 * fbm(x / 700 + 3, z / 700, 4) * smooth(80, 800, x) + 5 * (fbm(x / 140, z / 140, 3) - 0.5) * smooth(60, 260, x);
  const shore = -0.4 + (P0 + 0.4) * smooth(0, 55, x);
  return shore + (1 - pad) * hills * smooth(40, 120, x);
}

// ---------- textures and materials ----------
function canvasTex(w, h, draw, rep = [1, 1]) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function noiseTex(base, spread, n = 2600, rep = [1, 1], w = 256) {
  return canvasTex(w, w, (g, W, H) => {
    g.fillStyle = base; g.fillRect(0, 0, W, H);
    for (let i = 0; i < n; i++) { const a = Math.random() * spread; g.fillStyle = Math.random() < 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`; g.fillRect(Math.random() * W, Math.random() * H, 1 + Math.random() * 2, 1 + Math.random() * 2); }
  }, rep);
}
const ribTex = canvasTex(128, 128, (g, W, H) => {
  g.fillStyle = "#d6d8d4"; g.fillRect(0, 0, W, H);
  for (let x = 0; x < W; x += 16) { const gr = g.createLinearGradient(x, 0, x + 16, 0); gr.addColorStop(0, "#bfc2be"); gr.addColorStop(0.35, "#eceeea"); gr.addColorStop(0.7, "#cdd0cc"); gr.addColorStop(1, "#b4b7b3"); g.fillStyle = gr; g.fillRect(x, 0, 16, H); }
}, [8, 1]);
const fenceTex = canvasTex(64, 64, (g, W, H) => {
  g.clearRect(0, 0, W, H); g.strokeStyle = "rgba(190,196,200,0.95)"; g.lineWidth = 1.6;
  for (let i = -64; i < 128; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 64, 64); g.stroke(); g.beginPath(); g.moveTo(i + 64, 0); g.lineTo(i, 64); g.stroke(); }
});
const grateTex = canvasTex(64, 64, (g, W, H) => { g.fillStyle = "#5c6266"; g.fillRect(0, 0, W, H); g.fillStyle = "#2a2e31"; for (let x = 0; x < W; x += 8) g.fillRect(x, 0, 4, H); for (let y = 0; y < H; y += 16) g.fillRect(0, y, W, 2); }, [4, 4]);
const finTex = canvasTex(64, 64, (g, W, H) => { for (let x = 0; x < W; x += 6) { g.fillStyle = "#38506a"; g.fillRect(x, 0, 3, H); g.fillStyle = "#24384c"; g.fillRect(x + 3, 0, 3, H); } }, [10, 1]);
const calciteTex = noiseTex("#e8e4da", 0.25, 6000, [3, 3]);
const screenTex = canvasTex(64, 64, (g, W, H) => { g.fillStyle = "#8b9196"; g.fillRect(0, 0, W, H); g.strokeStyle = "#3a3f43"; g.lineWidth = 1; for (let i = 0; i < W; i += 4) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, H); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(W, i); g.stroke(); } }, [3, 8]);

// procedural height fields → normal maps and roughness maps, repeated at real-world scale
function heightCanvas(w, draw) { const c = document.createElement("canvas"); c.width = c.height = w; const g = c.getContext("2d"); draw(g, w); return c; }
function normalFrom(cv, strength = 2, rep = [1, 1]) {
  const w = cv.width, src = cv.getContext("2d").getImageData(0, 0, w, w).data, out = document.createElement("canvas"); out.width = out.height = w;
  const g = out.getContext("2d"), img = g.createImageData(w, w), H = (x, y) => src[(((y + w) % w) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength, l = Math.hypot(dx, dy, 1), o = (y * w + x) * 4;
    img.data[o] = (-dx / l * 0.5 + 0.5) * 255; img.data[o + 1] = (-dy / l * 0.5 + 0.5) * 255; img.data[o + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(out); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.anisotropy = 8; return t;
}
function roughFrom(cv, rep = [1, 1]) { const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.anisotropy = 8; return t; }
const brushedH = heightCanvas(256, (g, w) => { g.fillStyle = "#808080"; g.fillRect(0, 0, w, w); for (let i = 0; i < 1400; i++) { const y = Math.random() * w, a = 0.05 + Math.random() * 0.12; g.fillStyle = Math.random() < 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`; g.fillRect(0, y, w, 0.6 + Math.random()); } });
const speckH = heightCanvas(256, (g, w) => { g.fillStyle = "#808080"; g.fillRect(0, 0, w, w); for (let i = 0; i < 9000; i++) { const a = Math.random() * 0.35; g.fillStyle = Math.random() < 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`; const r = 0.5 + Math.random() * 1.6; g.beginPath(); g.arc(Math.random() * w, Math.random() * w, r, 0, 7); g.fill(); } });
const peelH = heightCanvas(128, (g, w) => { g.fillStyle = "#808080"; g.fillRect(0, 0, w, w); for (let i = 0; i < 2600; i++) { const a = Math.random() * 0.12; g.fillStyle = Math.random() < 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`; g.beginPath(); g.arc(Math.random() * w, Math.random() * w, 1 + Math.random() * 2.5, 0, 7); g.fill(); } });
const rippleH = heightCanvas(256, (g, w) => { g.fillStyle = "#808080"; g.fillRect(0, 0, w, w); for (let i = 0; i < 220; i++) { const x = Math.random() * w, y = Math.random() * w, r = 6 + Math.random() * 26, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(255,255,255,${0.1 + Math.random() * 0.15})`); gr.addColorStop(1, "rgba(128,128,128,0)"); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); } });
const DET = {
  brushedN: normalFrom(brushedH, 1.2, [3, 3]), brushedR: roughFrom(brushedH, [3, 3]),
  concreteN: normalFrom(speckH, 1.6, [4, 4]), concreteR: roughFrom(speckH, [4, 4]),
  peelN: normalFrom(peelH, 0.8, [6, 6]),
  waterN: normalFrom(rippleH, 3, [60, 80]),
};
const S = (o) => new THREE.MeshStandardMaterial(o);
const metal = (color, rough, o = {}) => S({ color, roughness: rough, metalness: 1, normalMap: DET.brushedN, normalScale: new THREE.Vector2(0.25, 0.25), roughnessMap: DET.brushedR, ...o });
const paint = (color, rough = 0.45, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: rough, metalness: 0.15, clearcoat: 0.35, clearcoatRoughness: 0.35, normalMap: DET.peelN, normalScale: new THREE.Vector2(0.15, 0.15), ...o });
export const M = {
  gravel: S({ color: "#bdb5a6", roughness: 0.97, map: noiseTex("#bdb5a6", 0.2, 9000, [40, 30]) }),
  concrete: S({ color: "#c9c5bc", roughness: 0.92, map: noiseTex("#c9c5bc", 0.1, 3000, [2, 2]), normalMap: DET.concreteN, normalScale: new THREE.Vector2(0.5, 0.5), roughnessMap: DET.concreteR }),
  concreteDark: S({ color: "#9d998f", roughness: 0.94, normalMap: DET.concreteN, normalScale: new THREE.Vector2(0.6, 0.6), roughnessMap: DET.concreteR }),
  siding: S({ color: "#e9e7e0", roughness: 0.55, metalness: 0.3, map: ribTex }),
  sidingBlue: S({ color: "#cfdbe6", roughness: 0.55, metalness: 0.3, map: ribTex }),
  roof: S({ color: "#8e9aa2", roughness: 0.5, metalness: 0.5 }),
  trim: paint("#1f6f8b", 0.5),
  steel: metal("#8b9196", 0.42),
  galv: metal("#b7bcbf", 0.45),
  duplex: metal("#c8ccce", 0.3),
  darkSteel: S({ color: "#4a5056", roughness: 0.5, metalness: 0.7 }),
  yellow: paint("#e0b123", 0.5),
  white: paint("#eeeeea", 0.45),
  frp: new THREE.MeshPhysicalMaterial({ color: "#e9e4d4", roughness: 0.38, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
  pumpBlue: paint("#2b5f8e", 0.38),
  motor: paint("#3b6f99", 0.45, { map: finTex }),
  red: S({ color: "#b8352c", roughness: 0.45, metalness: 0.3 }),
  green: S({ color: "#3d7a4f", roughness: 0.5, metalness: 0.2 }),
  brown: S({ color: "#6e4a2c", roughness: 0.6, metalness: 0.2 }),
  grate: S({ map: grateTex, roughness: 0.7, metalness: 0.6 }),
  screen: S({ map: screenTex, roughness: 0.6, metalness: 0.7 }),
  calcite: S({ map: calciteTex, color: "#f2efe6", roughness: 0.95 }),
  fence: S({ map: fenceTex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.6 }),
  asphalt: S({ color: "#5a5d5f", roughness: 0.95 }),
  glass: S({ color: "#2d3d48", roughness: 0.1, metalness: 0.6 }),
  tankWhite: paint("#e6e3da", 0.5),
  hdpe: S({ color: "#1e2226", roughness: 0.6, metalness: 0, normalMap: DET.peelN, normalScale: new THREE.Vector2(0.2, 0.2) }),
  basinWater: S({ color: "#6f7e5e", roughness: 0.12, metalness: 0.1 }),
  clearWater: S({ color: "#5b93a6", roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.8 }),
  led: S({ color: "#1f7a3a", emissive: "#2bd96b", emissiveIntensity: 1.6 }),
  ledAmber: S({ color: "#7a5a12", emissive: "#ffb21f", emissiveIntensity: 0 }),
  buoy: S({ color: "#f0c419", roughness: 0.5, metalness: 0.1 }),
};
// stream pipe materials (recoloured by salinity in the page)
export const PM = {
  sea: S({ color: "#cdbf98", roughness: 0.55, metalness: 0.1 }),       // GRP, low pressure seawater
  feed: metal("#c3c7ca", 0.3),     // super duplex, high pressure
  brine: metal("#a5abaf", 0.32),
  brineLP: S({ color: "#b9ad8a", roughness: 0.55, metalness: 0.1 }),
  perm: S({ color: "#3f7fb5", roughness: 0.45, metalness: 0.1 }),
  prod: S({ color: "#3a6ea5", roughness: 0.45, metalness: 0.2 }),
};
export const STREAM_DEFAULT = Object.fromEntries(Object.entries(PM).map(([k, m]) => [k, m.color.clone()]));

// ---------- helpers ----------
const V = (x, y, z) => new THREE.Vector3(x, y, z);
function mesh(geo, mat, x = 0, y = 0, z = 0, parent, shadow = true) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; if (parent) parent.add(m); return m;
}
const box = (w, h, d) => { const m = Math.min(w, h, d); return m < 0.08 ? new THREE.BoxGeometry(w, h, d) : new RoundedBoxGeometry(w, h, d, 2, Math.min(0.06, m * 0.12)); };
const cyl = (r, h, s = 24, r2 = r) => new THREE.CylinderGeometry(r2, r, h, s);
function pipeBetween(a, b, r, mat, parent, seg = 16) {
  const A = a.isVector3 ? a : V(...a), B = b.isVector3 ? b : V(...b), d = B.clone().sub(A), L = d.length();
  if (L < 1e-3) return null;
  const m = mesh(cyl(r, L, seg), mat, 0, 0, 0, parent);
  m.position.copy(A).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); return m;
}
function run(points, r, mat, parent, seg = 16) {     // polyline of pipes with ball joints
  const P = points.map(p => p.isVector3 ? p : V(...p));
  for (let i = 0; i < P.length - 1; i++) pipeBetween(P[i], P[i + 1], r, mat, parent, seg);
  for (let i = 1; i < P.length - 1; i++) mesh(new THREE.SphereGeometry(r, seg, 10), mat, P[i].x, P[i].y, P[i].z, parent);
  if (r >= 0.12 && P.length > 2) for (let i = 1; i < P.length - 1; i++) for (const [A, B] of [[P[i - 1], P[i]], [P[i + 1], P[i]]]) {
    const d = B.clone().sub(A); const L = d.length(); if (L < r * 4) continue; d.normalize();
    const c = B.clone().addScaledVector(d, -r * 1.6), q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d);
    const fl = mesh(cyl(r * 1.45, r * 0.22, 24), M.steel, c.x, c.y, c.z, parent); fl.quaternion.copy(q);
    if (r >= 0.3) for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2, off = V(Math.cos(a) * r * 1.25, 0, Math.sin(a) * r * 1.25).applyQuaternion(q);
      const bt = mesh(cyl(r * 0.06, r * 0.42, 6), M.darkSteel, c.x + off.x, c.y + off.y, c.z + off.z, parent); bt.quaternion.copy(q); }
  }
  return P;
}
function handrail(parent, x0, z0, x1, z1, y) {     // posts every 1.5 m, top rail at 1.1 m, mid rail at 0.55 m, kick plate
  const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 1.5));
  for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, z = z0 + (z1 - z0) * i / n; mesh(cyl(0.025, 1.1, 8), M.yellow, x, y + 0.55, z, parent); }
  for (const h of [1.1, 0.55]) pipeBetween([x0, y + h, z0], [x1, y + h, z1], 0.022, M.yellow, parent, 8);
  const k = mesh(new THREE.BoxGeometry(L, 0.1, 0.01), M.yellow, (x0 + x1) / 2, y + 0.05, (z0 + z1) / 2, parent); k.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
}
const SKIN = ["#8d5a3b", "#c58c62", "#e2b48f", "#6a4128", "#f0c9a5"];
const HAIR = ["#2a1d15", "#0f0d0c", "#6b3a22", "#b98d52", "#3b2f2a"];
// operator or engineer, about 1.62–1.82 m: boots, coverall, hi-vis vest, gloves, hard hat; o.woman gives a narrower build and hair (ponytail or bun) under the hat
function person(parent, x, y, z, rot = 0, k = 0, pose = "stand", o = {}) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; parent.add(g); g.scale.setScalar(o.h || 1);
  const W = !!o.woman, sh = W ? 0.215 : 0.24, tw = W ? 1.04 : 1.15, lx = W ? 0.09 : 0.1;
  const cloth = S({ color: ["#2f4a6b", "#38404a", "#2c5a46"][k % 3], roughness: 0.85 }), vest = S({ color: "#e9f227", roughness: 0.7, emissive: "#20240a" });
  const skin = S({ color: SKIN[k % SKIN.length], roughness: 0.6 }), boot = S({ color: "#1d1b19", roughness: 0.8 }), hat = paint(k % 2 ? "#f4f4f2" : "#f2c230", 0.35);
  const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 4, 10);
  for (const sx of [-lx, lx]) {
    mesh(cap(0.07, 0.72), cloth, sx, 0.47, 0, g);                         // legs, hip at about 0.9 m
    const b = mesh(new THREE.BoxGeometry(0.11, 0.08, 0.26), boot, sx, 0.04, 0.04, g);
  }
  mesh(cap(0.15, 0.36), cloth, 0, 1.17, 0, g).scale.set(tw, 1, 0.75);     // torso
  mesh(cap(0.155, 0.3), vest, 0, 1.2, 0, g).scale.set(tw + 0.01, 0.9, 0.78);  // hi-vis vest over it
  for (const sx of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(sx * sh, 1.42, 0); arm.rotation.z = sx * 0.12; if (pose === "point" && sx > 0) arm.rotation.x = -1.1; if (pose === "sample" && sx > 0) { arm.rotation.x = -0.75; arm.rotation.z = 0.02; } g.add(arm);
    if (pose === "sample" && sx > 0) { mesh(cyl(0.032, 0.13, 12), S({ color: "#eef3f6", roughness: 0.25, transparent: true, opacity: 0.85 }), 0, -0.7, 0.02, arm); mesh(cyl(0.034, 0.03, 12), S({ color: "#1e5fa8", roughness: 0.5 }), 0, -0.62, 0.02, arm); }   // sample bottle
    mesh(cap(0.05, 0.52), cloth, 0, -0.3, 0, arm); mesh(new THREE.SphereGeometry(0.055, 10, 8), S({ color: "#d9a426", roughness: 0.7 }), 0, -0.62, 0, arm);
  }
  mesh(cap(0.05, 0.06), skin, 0, 1.53, 0, g);                              // neck
  mesh(new THREE.SphereGeometry(0.105, 16, 12), skin, 0, 1.64, 0, g).scale.set(0.95, 1.1, 1);
  if (W) { const hair = S({ color: HAIR[o.hair ?? k % HAIR.length], roughness: 0.75 });
    mesh(new THREE.SphereGeometry(0.114, 16, 12, Math.PI * 0.78, Math.PI * 1.44, Math.PI * 0.28, Math.PI * 0.52), hair, 0, 1.648, -0.006, g);   // hair at the back and sides only (face left clear), under the hat
    if (o.bun) mesh(new THREE.SphereGeometry(0.055, 12, 10), hair, 0, 1.6, -0.12, g);
    else { const pt = mesh(cap(0.034, 0.16), hair, 0, 1.5, -0.125, g); pt.rotation.x = 0.25; } }                                    // ponytail
  mesh(new THREE.SphereGeometry(0.125, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), hat, 0, 1.69, 0, g);
  mesh(cyl(0.15, 0.015, 20), hat, 0, 1.69, 0.02, g);
  return g;
}
function building(parent, x0, x1, z0, z1, h, wall = M.siding, opts = {}) {
  const g = new THREE.Group(); parent.add(g);
  const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, t = 0.3;
  const walls = {
    n: mesh(box(w, h, t), wall, cx, P0 + h / 2, z0, g), s: mesh(box(w, h, t), wall, cx, P0 + h / 2, z1, g),
    w: mesh(box(t, h, d), wall, x0, P0 + h / 2, cz, g), e: mesh(box(t, h, d), wall, x1, P0 + h / 2, cz, g),
  };
  for (const k of ["n", "s", "w", "e"]) { const tr = mesh(box(k === "w" || k === "e" ? t + 0.1 : w + 0.2, 0.5, k === "w" || k === "e" ? d + 0.2 : t + 0.1), M.trim, 0, 0, 0, g); tr.position.copy(walls[k].position); tr.position.y = P0 + h - 0.25; }
  const roof = new THREE.Group(); g.add(roof);
  mesh(box(w + 1, 0.4, d + 1), M.roof, cx, P0 + h + 0.2, cz, roof);
  if (opts.vents) for (let i = 0; i < opts.vents; i++) mesh(box(2.2, 1, 2.2), M.galv, x0 + w * (i + 0.5) / opts.vents, P0 + h + 0.9, cz, roof);
  // roll-up doors and windows on the long sides
  for (const zz of [z0 - 0.17, z1 + 0.17]) for (let i = 0; i < (opts.doors ?? 1); i++) mesh(box(4.5, 5, 0.06), M.galv, x0 + w * (i + 0.5) / (opts.doors ?? 1), P0 + 2.5, zz, g, false);
  return { group: g, roof, walls };
}
function tank(parent, x, z, r, h, mat = M.tankWhite, y0 = P0, roofKind = "cone") {
  const g = new THREE.Group(); g.position.set(x, y0, z); parent.add(g);
  mesh(cyl(r, h, 48), mat, 0, h / 2, 0, g);
  if (roofKind === "cone") mesh(cyl(r + 0.1, r * 0.18, 48, 0.4), mat, 0, h + r * 0.09, 0, g);
  else if (roofKind === "flat") mesh(cyl(r + 0.05, 0.12, 48), mat, 0, h + 0.06, 0, g);
  mesh(cyl(r + 0.4, 0.3, 48), M.concrete, 0, 0.15, 0, g);
  return g;
}
function hTank(parent, x, y, z, r, L, mat = M.tankWhite, axis = "x") {     // horizontal bullet tank on saddles
  const g = new THREE.Group(); g.position.set(x, y, z); if (axis === "z") g.rotation.y = Math.PI / 2; parent.add(g);
  mesh(cyl(r, L, 40).rotateZ(Math.PI / 2), mat, 0, 0, 0, g);
  for (const s of [-1, 1]) { const c = mesh(new THREE.SphereGeometry(r, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat, s * L / 2, 0, 0, g); c.rotation.z = -s * Math.PI / 2; }
  for (const s of [-0.32, 0.32]) mesh(box(0.5, r + 0.3, r * 1.6), M.concrete, s * L, -r * 0.75, 0, g);
  return g;
}
function fence(parent, x0, x1, z0, z1, h = 2.4) {
  const g = new THREE.Group(); parent.add(g);
  const side = (ax, az, bx, bz) => {
    const L = Math.hypot(bx - ax, bz - az), m = mesh(new THREE.PlaneGeometry(L, h), M.fence.clone(), (ax + bx) / 2, P0 + h / 2, (az + bz) / 2, g, false);
    m.material.map = M.fence.map.clone(); m.material.map.repeat.set(L / 1.2, h / 1.2); m.material.map.needsUpdate = true;
    m.rotation.y = -Math.atan2(bz - az, bx - ax);
    for (let s = 0; s <= L; s += 3) mesh(cyl(0.04, h + 0.2, 6), M.galv, ax + (bx - ax) * s / L, P0 + h / 2, az + (bz - az) * s / L, g, false);
  };
  side(x0, z0, x1, z0); side(x1, z0, x1, z1); side(x1, z1, x0, z1); side(x0, z1, x0, z0);
  return g;
}
function seabedRun(a, b, lift, n = 40) {        // points following the seabed from a to b ([x, z]), y = ground + lift
  const pts = [];
  for (let i = 0; i <= n; i++) { const x = a[0] + (b[0] - a[0]) * i / n, z = a[1] + (b[1] - a[1]) * i / n; pts.push(V(x, Math.min(groundY(x, z) + lift, x > -60 ? groundY(x, z) - 1.2 : 1e9), z)); }
  return pts;
}
function bake(root, keep) {
  root.updateMatrixWorld(true);
  const groups = new Map(), done = [];
  root.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || !o.geometry.index || o.geometry.attributes.color) return;
    for (let p = o; p; p = p.parent) if (keep.has(p)) return;
    const key = o.material.uuid + (o.castShadow ? "s" : "n");
    if (!groups.has(key)) groups.set(key, { mat: o.material, cast: o.castShadow, geos: [] });
    const g = new THREE.BufferGeometry(), src = o.geometry;
    g.setAttribute("position", src.attributes.position.clone()); g.setAttribute("normal", src.attributes.normal.clone());
    g.setAttribute("uv", src.attributes.uv ? src.attributes.uv.clone() : new THREE.Float32BufferAttribute(new Float32Array(src.attributes.position.count * 2), 2));
    g.setIndex(src.index.clone()); g.applyMatrix4(o.matrixWorld);
    groups.get(key).geos.push(g); done.push(o);
  });
  for (const o of done) o.parent.remove(o);
  for (const { mat, cast, geos } of groups.values()) {
    const m = new THREE.Mesh(mergeGeometries(geos, false), mat); m.castShadow = cast; m.receiveShadow = true; root.add(m);
    geos.forEach(g => g.dispose());
  }
}
export function glowTex(color) {
  return canvasTex(64, 64, (g, W, H) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, color); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, W, H); });
}

// =====================================================================================
export function buildWorld(scene) {
  const root = new THREE.Group(); scene.add(root);
  const streams = [], rotors = { intake: [], hp: [], boost: [], floc: [], mixer: [], cip: [], product: [], uf: [], blower: [] };
  const roofs = [], anchors = {}, labels = {};
  const stream = (id, kind, pts, r, q, n = 1, density = 1) => { const s = { id, kind, pts: pts.map(p => p.isVector3 ? p : V(...p)), r, q, n, density }; streams.push(s); return s; };

  // ---------------- terrain, sea, pad ----------------
  { const W = 4400, D = 3400, nx = 260, nz = 200, g = new THREE.PlaneGeometry(W, D, nx, nz).rotateX(-Math.PI / 2);
    g.translate(-200, 0, 0);
    const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
    const sea = new THREE.Color("#8b8466"), sand = new THREE.Color("#d9c9a1"), scrub = new THREE.Color("#a8996d"), dry = new THREE.Color("#c4ad80"), dark = new THREE.Color("#7c7350");
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), y = groundY(x, z); p.setY(i, y);
      const n = fbm(x / 60, z / 60, 3);
      if (x < -8) c.copy(sea).lerp(sand, Math.max(0, 0.45 + y / 30) * 0.6 + 0.2 * n);
      else if (x < 60) c.copy(sand).lerp(dry, smooth(20, 60, x));
      else c.copy(dry).lerp(scrub, smooth(0.35, 0.7, n)).lerp(dark, smooth(0.6, 0.85, fbm(x / 25, z / 25, 2)) * 0.6);
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
    const t = mesh(g, S({ vertexColors: true, roughness: 0.97, map: noiseTex("#ffffff", 0.18, 9000, [60, 60]) }), 0, 0, 0, root, false); t.receiveShadow = true;
  }
  const water = mesh(new THREE.PlaneGeometry(2600, 3400, 1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshPhysicalMaterial({ color: "#1f5d73", roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, normalMap: DET.waterN, normalScale: new THREE.Vector2(0.35, 0.35), transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false }), -1300 + 12, 0, 0, root, false);
  water.renderOrder = 2;
  // surf line
  mesh(new THREE.PlaneGeometry(6, 3400).rotateX(-Math.PI / 2), S({ color: "#e8f0f0", transparent: true, opacity: 0.55, roughness: 0.6, depthWrite: false }), 6, 0.05, 0, root, false);
  // plant pad (gravel), roads
  mesh(box(470, 0.3, 380), M.gravel, 285, P0 - 0.13, 0, root, false).receiveShadow = true;
  for (const [x, z, w, d] of [[285, 155, 470, 8], [285, -155, 470, 8], [228, 0, 8, 300], [320, 75, 170, 8], [470, 0, 8, 300], [100, 0, 8, 300]])
    mesh(box(w, 0.32, d), M.asphalt, x, P0 - 0.1, z, root, false).receiveShadow = true;
  fence(root, 52, 520, -175, 175);

  // ---------------- 1. open-sea intake: two velocity caps, HDPE lines to shore ----------------
  INTAKE_XZ.forEach(([x, z], k) => {
    const y = groundY(x, z), g = new THREE.Group(); g.position.set(x, y, z); root.add(g);
    mesh(box(10, 1.2, 10), M.concreteDark, 0, 0.3, 0, g);
    mesh(cyl(1.0, 3.2, 32), M.concreteDark, 0, 1.6, 0, g);
    mesh(cyl(3.0, 0.45, 48), M.concreteDark, 0, 3.2 + 0.6 + 0.22, 0, g);                 // the cap
    mesh(cyl(2.2, 0.3, 48), M.concreteDark, 0, 3.05, 0, g);                              // inlet floor ring
    for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; mesh(cyl(0.06, 0.62, 8), M.darkSteel, Math.cos(a) * 2.9, 3.5, Math.sin(a) * 2.9, g); }   // bar screen
    // marker buoy at the surface
    const b = mesh(cyl(0.6, 1.4, 16), M.buoy, x + 12, 0.3, z, root); mesh(cyl(0.05, 1.5, 6), M.darkSteel, x + 12, 1.6, z, root);
    anchors["cap" + k] = V(x, y + 3.5, z);
    const pts = [V(x, y + 3.5, z), V(x, y + 1.2, z), ...seabedRun([x + 2, z], [-4, -95 + k * 20], 0.75, 60), V(40, P0 - 3, -95 + k * 20), V(64, P0 - 3, -95 + k * 20)];
    run(pts.slice(1, -2).filter(p => p.y > groundY(p.x, p.z) - 0.2), 0.65, M.hdpe, root, 18);
    stream("intake" + k, "sea", pts, 0.6, "Qint", 2, 0.25);
  });

  // ---------------- 2. intake pump station: band screens, vertical turbine pumps ----------------
  { const B = building(root, 60, 92, -112, -62, 9, M.sidingBlue, { doors: 1, vents: 2 }); roofs.push(B);
    const g = B.group;
    mesh(box(30, 0.4, 46), M.grate, 76, P0 + 0.05, -87, g, false);
    for (let i = 0; i < 4; i++) {          // travelling band screens
      const z = -104 + i * 6.3;
      for (const dz of [-1.5, 1.5]) mesh(box(0.3, 8.5, 0.3), M.steel, 66, P0 + 3.2, z + dz, g);
      mesh(box(0.25, 7.6, 2.8), M.screen, 66, P0 + 2.4, z, g);
      mesh(box(1.6, 1.4, 3.4), M.pumpBlue, 66, P0 + 7.6, z, g);
    }
    for (let i = 0; i < 4; i++) {          // vertical turbine pumps with motors on discharge heads
      const z = -102 + i * 6, x = 78;
      mesh(cyl(0.7, 1.4, 24), M.pumpBlue, x, P0 + 0.7, z, g);
      mesh(cyl(0.95, 2.4, 32), M.motor, x, P0 + 2.6, z, g);
      const fan = mesh(cyl(0.6, 0.25, 16), M.yellow, x, P0 + 3.95, z, g); rotors.intake.push(fan);
      for (let b = 0; b < 3; b++) mesh(box(1.1, 0.05, 0.12), M.darkSteel, 0, 0.14, 0, fan).rotation.y = b * Math.PI / 3;
      run([[x + 0.7, P0 + 0.8, z], [86, P0 + 0.8, z], [86, P0 + 0.8, -87]], 0.32, PM.sea, g);
    }
    anchors.intakePS = V(76, P0 + 9, -87);
  }
  const seaHeader = run([[86, P0 + 0.8, -87], [95, P0 + 0.8, -87], [95, P0 + 0.8, -80], [108, P0 + 3.5, -80]], 0.55, PM.sea, root);
  stream("toCoag", "sea", [[66, P0 - 3, -85], [78, P0 + 0.8, -96], [86, P0 + 0.8, -96], ...seaHeader.slice(1).map(p => p.toArray())], 0.5, "Qint", 1, 1);

  // ---------------- 3. coagulation (rapid mix) and flocculation basins, 2 trains ----------------
  const flocW = [];
  for (const [t, zc] of [[0, -95], [1, -70]]) {
    const g = new THREE.Group(); root.add(g); const H = 5, wall = 0.4, zw = 10;
    const basin = (x0, x1, water, label) => {
      const cx = (x0 + x1) / 2, w = x1 - x0;
      for (const zz of [zc - zw / 2, zc + zw / 2]) mesh(box(w + wall, H, wall), M.concrete, cx, P0 + H / 2, zz, g);
      for (const xx of [x0, x1]) mesh(box(wall, H, zw), M.concrete, xx, P0 + H / 2, zc, g);
      const s = mesh(new THREE.PlaneGeometry(w - wall, zw - wall).rotateX(-Math.PI / 2), water, cx, P0 + H - 0.5, zc, g, false); s.receiveShadow = true;
      return cx;
    };
    const cm = basin(110, 117, S({ color: "#7b7458", roughness: 0.15 }));
    const sh = mesh(cyl(0.08, 4, 8), M.steel, cm, P0 + 3, zc, g); const imp = new THREE.Group(); imp.position.set(cm, P0 + 1.6, zc); g.add(imp);
    for (let b = 0; b < 4; b++) mesh(box(1.6, 0.4, 0.06), M.steel, 0, 0, 0, imp).rotation.y = b * Math.PI / 4;
    rotors.mixer.push(imp); mesh(box(7.2, 0.3, 1.2), M.grate, cm, P0 + H + 0.1, zc, g); mesh(cyl(0.45, 1.1, 16), M.motor, cm, P0 + H + 0.8, zc, g);
    const tint = ["#73745a", "#6c7a64", "#628070"];
    for (let s = 0; s < 3; s++) {
      const x0 = 118 + s * 12.6, cx = basin(x0, x0 + 12, S({ color: tint[s], roughness: 0.12 }));
      // horizontal-shaft paddle flocculator, tapered energy (G 60 → 40 → 20 s⁻¹)
      const wheel = new THREE.Group(); wheel.position.set(cx, P0 + 2.2, zc); g.add(wheel);
      mesh(cyl(0.07, zw - 0.6, 8).rotateX(Math.PI / 2), M.steel, 0, 0, 0, wheel);
      for (let k = 0; k < 3; k++) for (let a = 0; a < 4; a++) {
        const arm = new THREE.Group(); arm.rotation.z = a * Math.PI / 2; arm.position.z = -3 + k * 3; wheel.add(arm);
        mesh(box(0.06, 3.6, 0.08), M.steel, 0, 0, 0, arm);
        for (const r of [1.2, 1.7]) mesh(box(0.25, 0.04, 1.8), M.brown, 0, r, 0, arm);
      }
      rotors.floc.push({ o: wheel, k: [1.0, 0.7, 0.4][s] }); flocW.push(wheel);
    }
    mesh(box(48, 0.3, 1.2), M.grate, 135, P0 + H + 0.1, zc + zw / 2 + 0.6, g);
    handrail(g, 111, zc + zw / 2 + 1.15, 159, zc + zw / 2 + 1.15, P0 + H + 0.25);
  }
  anchors.coag = V(135, P0 + 5, -82);
  stream("coag", "sea", [[108, P0 + 4.3, -80], [112, P0 + 4.5, -82], [156, P0 + 4.5, -82], [162, P0 + 3, -50], [165, P0 + 1.2, -38]], 0.4, "Qint", 1, 1.2);
  run([[157, P0 + 4.5, -82], [162, P0 + 3, -50], [165, P0 + 1.2, -38]], 0.55, PM.sea, root);

  // ---------------- 4. UF: 6 racks of pressurised hollow-fibre modules under a canopy ----------------
  const ufInst = (() => {
    const g = new THREE.Group(); root.add(g);
    const x0 = 110, x1 = 176, z0 = -40, z1 = 36, h = 9;
    for (let x = x0; x <= x1; x += 11) for (const z of [z0, z1]) mesh(box(0.4, h, 0.4), M.steel, x, P0 + h / 2, z, g);
    const roof = new THREE.Group(); g.add(roof); mesh(box(x1 - x0 + 2, 0.35, z1 - z0 + 2), M.roof, (x0 + x1) / 2, P0 + h, (z0 + z1) / 2, roof); roofs.push({ roof, walls: {} });
    mesh(box(x1 - x0, 0.25, z1 - z0), M.concrete, (x0 + x1) / 2, P0 + 0.1, (z0 + z1) / 2, g, false);
    const perRow = 105, rows = 12, n = perRow * rows;
    const geo = cyl(0.125, 2.0, 16), capGeo = cyl(0.14, 0.18, 16);
    const housing = new THREE.InstancedMesh(geo, M.white, n), caps = new THREE.InstancedMesh(capGeo, M.trim, n * 2);
    housing.castShadow = true; housing.receiveShadow = true; caps.castShadow = true;
    const m4 = new THREE.Matrix4(); let k = 0, kc = 0;
    for (let rk = 0; rk < 6; rk++) {
      const zr = -30 + rk * 11.5;
      for (const dz of [-0.45, 0.45]) {
        for (let i = 0; i < perRow; i++) {
          const x = 117 + i * 0.4, y = P0 + 1.6;
          m4.makeTranslation(x, y, zr + dz); housing.setMatrixAt(k++, m4);
          m4.makeTranslation(x, y - 1.05, zr + dz); caps.setMatrixAt(kc++, m4); m4.makeTranslation(x, y + 1.05, zr + dz); caps.setMatrixAt(kc++, m4);
        }
        run([[116.5, P0 + 0.45, zr + dz * 2.2], [159.5, P0 + 0.45, zr + dz * 2.2]], 0.16, PM.sea, g);     // feed header (bottom)
        run([[116.5, P0 + 2.85, zr + dz * 2.2], [159.5, P0 + 2.85, zr + dz * 2.2]], 0.14, M.galv, g);   // filtrate header (top)
      }
      for (const x of [116.3, 138, 159.8]) mesh(box(0.15, 3.2, 1.6), M.steel, x, P0 + 1.6, zr, g);
      run([[165, P0 + 1.2, zr], [159.5, P0 + 0.45, zr]], 0.25, PM.sea, g);
      run([[159.5, P0 + 2.85, zr], [168, P0 + 3.5, zr], [168, P0 + 3.5, -40]], 0.22, PM.sea, g);
    }
    run([[165, P0 + 1.2, -38], [165, P0 + 1.2, 30]], 0.5, PM.sea, g);
    // blowers and backwash pumps
    for (let i = 0; i < 3; i++) { mesh(box(2.2, 1.6, 1.6), M.pumpBlue, 172, P0 + 0.8, 8 + i * 6, g); const f = mesh(cyl(0.5, 0.2, 16).rotateZ(Math.PI / 2), M.yellow, 173.2, P0 + 0.9, 8 + i * 6, g); rotors.blower.push(f); }
    anchors.uf = V(140, P0 + 3, -1);
    return { housing, caps, n, perRow };
  })();
  root.add(ufInst.housing, ufInst.caps);
  stream("uf", "sea", [[165, P0 + 1.2, -38], [165, P0 + 1.2, -4], [159.5, P0 + 0.45, -7], [117, P0 + 0.45, -7], [117, P0 + 2.85, -7], [159.5, P0 + 2.85, -7], [168, P0 + 3.5, -7], [168, P0 + 3.5, -40], [190, P0 + 3, -70]], 0.18, "Quf", 12, 0.5);
  run([[168, P0 + 3.5, -40], [180, P0 + 3.5, -55], [190, P0 + 6.5, -70]], 0.5, PM.sea, root);

  // UF filtrate tank and cartridge filters
  tank(root, 200, -80, 13, 7, M.concrete, P0, "flat"); anchors.ufTank = V(200, P0 + 8, -80);
  const cart = new THREE.Group(); root.add(cart);
  for (let i = 0; i < 12; i++) {
    const z = -27 + i * 4.9, x = 212;
    mesh(cyl(0.7, 2.6, 32), M.duplex, x, P0 + 2.0, z, cart);
    const top = mesh(new THREE.SphereGeometry(0.7, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.duplex, x, P0 + 3.3, z, cart);
    mesh(cyl(0.72, 0.15, 32), M.steel, x, P0 + 3.3, z, cart);
    for (const a of [0, 2.1, 4.2]) mesh(cyl(0.05, 0.8, 6), M.steel, x + Math.cos(a) * 0.55, P0 + 0.4, z + Math.sin(a) * 0.55, cart);
    run([[x - 0.7, P0 + 2.6, z], [207.5, P0 + 2.6, z]], 0.14, PM.sea, cart); run([[x + 0.7, P0 + 1.2, z], [216.5, P0 + 1.2, z]], 0.14, PM.sea, cart);
  }
  run([[207.5, P0 + 2.6, -60], [207.5, P0 + 2.6, 30]], 0.42, PM.sea, root); run([[216.5, P0 + 1.2, -28], [216.5, P0 + 1.2, 28]], 0.42, PM.sea, root);
  run([[200, P0 + 1, -67], [204, P0 + 1, -60], [207.5, P0 + 2.6, -60]], 0.45, PM.sea, root);
  for (let i = 0; i < 4; i++) { mesh(box(2.4, 1.3, 1.3), M.pumpBlue, 202, P0 + 0.65, -64 + i * 1.8 - 2, root); }   // LP feed pumps
  anchors.cart = V(212, P0 + 3.5, 0);
  stream("cart", "sea", [[190, P0 + 1, -70], [204, P0 + 1, -60], [207.5, P0 + 2.6, -60], [207.5, P0 + 2.6, 0], [212, P0 + 2.6, 0], [212, P0 + 1.2, 0], [216.5, P0 + 1.2, 0], [216.5, P0 + 1.2, 28], [236, P0 + 1.2, 28]], 0.3, "Qf", 1, 1);
  run([[216.5, P0 + 1.2, 28], [228, P0 + 1.2, 28], [238, P0 + 1.2, 28], [238, P0 + 1.2, -48]], 0.42, PM.sea, root);

  // chemical dosing bund: FeCl3, antiscalant, SBS, NaOH
  { const g = new THREE.Group(); root.add(g);
    for (const [x0, z0, x1, z1] of [[112, 46, 160, 46], [160, 46, 160, 82], [160, 82, 112, 82], [112, 82, 112, 46]]) { const L = Math.hypot(x1 - x0, z1 - z0); const w = mesh(box(L, 1.0, 0.3), M.concrete, (x0 + x1) / 2, P0 + 0.5, (z0 + z1) / 2, g); w.rotation.y = -Math.atan2(z1 - z0, x1 - x0); }
    const chem = [["FeCl₃", "#6b3a1e", 2.2, 5.5], ["FeCl₃", "#6b3a1e", 2.2, 5.5], ["Antiscalant", "#e3e3dc", 1.8, 4.2], ["Antiscalant", "#e3e3dc", 1.8, 4.2], ["SBS", "#ece8d6", 1.8, 4.2], ["SBS", "#ece8d6", 1.8, 4.2], ["NaOH", "#dfe6ea", 1.6, 4], ["H₂SO₄", "#d8d2c4", 1.6, 4]];
    chem.forEach(([n, c, r, h], i) => { const t = tank(g, 118 + (i % 4) * 11, 54 + Math.floor(i / 4) * 18, r, h, S({ color: c, roughness: 0.55, metalness: 0.1 }), P0, "cone");
      mesh(cyl(r + 0.02, 0.35, 32), [M.brown, M.green, M.yellow, M.trim][Math.floor(i / 2)], 0, h * 0.7, 0, t, false); });
    mesh(box(10, 1.6, 2.2), M.white, 136, P0 + 0.8, 63, g); mesh(box(10.4, 0.2, 2.6), M.roof, 136, P0 + 2.8, 63, g);
    for (let i = 0; i < 6; i++) mesh(box(0.6, 0.5, 0.5), M.pumpBlue, 132 + i * 1.6, P0 + 1.85, 63, g);
    anchors.dosing = V(136, P0 + 5, 64);
  }
  // dosing lines: FeCl3 to the rapid mix, antiscalant and SBS to the cartridge filter inlet
  run([[136, P0 + 1.5, 62], [104, P0 + 1.5, 62], [104, P0 + 1.5, -82], [110, P0 + 5.3, -82]], 0.05, M.brown, root);
  run([[140, P0 + 1.6, 62], [204, P0 + 1.6, 62], [204, P0 + 1.6, -56]], 0.04, M.green, root);
  run([[142, P0 + 1.7, 62], [205, P0 + 1.7, 62], [205, P0 + 1.7, -56]], 0.04, M.yellow, root);

  // ---------------- 5. RO hall: 6 trains ----------------
  const ro = building(root, 234, 306, -58, 58, 13, M.siding, { doors: 3, vents: 6 }); roofs.push(ro);
  const hall = ro.group;
  mesh(box(72, 0.25, 116), M.concrete, 270, P0 + 0.1, 0, hall, false);
  // overhead crane
  for (const z of [-56, 56]) mesh(box(72, 0.5, 0.4), M.steel, 270, P0 + 11, z, hall);
  mesh(box(1.0, 0.9, 112), M.yellow, 262, P0 + 11, 0, hall); mesh(box(1.4, 1.0, 1.6), M.yellow, 262, P0 + 10.4, -8, hall);
  // vessel geometry: 7 segments (one per element) along x, vertex-coloured per element by the page
  const NE = PLANT.elems, segLen = RACK.len / NE;
  const vGeo = (() => {
    const parts = [];
    for (let e = 0; e < NE; e++) { const g = cyl(0.135, segLen, 18, 0.135).rotateZ(Math.PI / 2); g.translate(RACK.x0 + 0.15 + segLen * (e + 0.5) - RACK.x0, 0, 0); parts.push(g); }
    const pos = [], nrm = [], idx = [], col = []; let off = 0;
    parts.forEach((g, e) => { const p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nrm.push(n.getX(i), n.getY(i), n.getZ(i)); col.push(0.9, 0.88, 0.82); }
      const ix = g.index.array; for (let i = 0; i < ix.length; i++) idx.push(ix[i] + off); off += p.count; });
    const G = new THREE.BufferGeometry(); G.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); G.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
    G.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); G.setIndex(idx); G.userData.vertsPerSeg = parts[0].attributes.position.count; return G;
  })();
  const vMat = S({ vertexColors: true, roughness: 0.4, metalness: 0.05 });
  const nV = PLANT.trains * PLANT.vessels;
  const vessels = new THREE.InstancedMesh(vGeo, vMat, nV), ends = new THREE.InstancedMesh(cyl(0.15, 0.22, 18).rotateZ(Math.PI / 2), M.white, nV * 2);
  vessels.castShadow = vessels.receiveShadow = true; ends.castShadow = true;
  const trains = [];
  { const m4 = new THREE.Matrix4(); let k = 0, ke = 0;
    TRAIN_Z.forEach((zt, ti) => {
      const g = new THREE.Group(); hall.add(g); const T = { z: zt, group: g };
      // rack frame
      const zw = (RACK.cols - 1) * RACK.pitch, ytop = RACK.y0 + (RACK.rows - 1) * RACK.pitch;
      for (const x of [RACK.x0 + 0.6, RACK.x0 + RACK.len / 2, RACK.x0 + RACK.len - 0.3]) for (const s of [-1, 1]) mesh(box(0.15, ytop - P0 + 0.5, 0.15), M.trim, x, (ytop + P0 + 0.5) / 2, zt + s * (zw / 2 + 0.3), g);
      for (let rr = 0; rr <= RACK.rows; rr += 2) for (const x of [RACK.x0 + 0.6, RACK.x0 + RACK.len / 2, RACK.x0 + RACK.len - 0.3]) mesh(box(0.12, 0.08, zw + 0.7), M.trim, x, RACK.y0 - RACK.pitch / 2 + rr * RACK.pitch, zt, g);
      for (let r = 0; r < RACK.rows; r++) for (let c = 0; c < RACK.cols; c++) {
        const y = RACK.y0 + r * RACK.pitch, z = zt - zw / 2 + c * RACK.pitch;
        m4.makeTranslation(RACK.x0, y, z); vessels.setMatrixAt(k++, m4);
        m4.makeTranslation(RACK.x0 + 0.12, y, z); ends.setMatrixAt(ke++, m4); m4.makeTranslation(RACK.x0 + RACK.len + 0.12, y, z); ends.setMatrixAt(ke++, m4);
      }
      // feed manifold (west end, vertical), brine manifold (east end), permeate headers (blue, both ends)
      const xf = RACK.x0 - 0.35, xb = RACK.x0 + RACK.len + 0.35;
      run([[xf, P0 + 0.4, zt - zw / 2 - 0.6], [xf, P0 + 0.4, zt + zw / 2 + 0.6]], 0.2, PM.feed, g);
      for (let c = 0; c < RACK.cols; c += 1) { pipeBetween([xf, P0 + 0.4, zt - zw / 2 + c * RACK.pitch], [xf, ytop, zt - zw / 2 + c * RACK.pitch], 0.06, PM.feed, g, 8); }
      run([[xb, P0 + 0.4, zt - zw / 2 - 0.6], [xb, P0 + 0.4, zt + zw / 2 + 0.6]], 0.17, PM.brine, g);
      for (let c = 0; c < RACK.cols; c += 1) { pipeBetween([xb, P0 + 0.4, zt - zw / 2 + c * RACK.pitch], [xb, ytop, zt - zw / 2 + c * RACK.pitch], 0.05, PM.brine, g, 8); }
      for (const x of [xf - 0.35, xb + 0.35]) { run([[x, ytop + 0.45, zt - zw / 2], [x, ytop + 0.45, zt + zw / 2 + 0.5]], 0.15, PM.perm, g); for (let c = 0; c < RACK.cols; c += 2) pipeBetween([x, RACK.y0, zt - zw / 2 + c * RACK.pitch], [x, ytop + 0.45, zt - zw / 2 + c * RACK.pitch], 0.035, PM.perm, g, 6); }
      // HP pump (ring-section multistage) and motor
      const hp = new THREE.Group(); hp.position.set(248, P0 + 0.9, zt + 1.8); g.add(hp);
      mesh(box(9.5, 0.3, 1.8), M.darkSteel, 1.6, -0.75, 0, hp);
      mesh(cyl(0.48, 2.6, 32).rotateZ(Math.PI / 2), M.duplex, 0, 0, 0, hp);
      for (let s = 0; s < 6; s++) mesh(cyl(0.53, 0.12, 32).rotateZ(Math.PI / 2), M.steel, -1.1 + s * 0.44, 0, 0, hp);
      mesh(cyl(0.55, 0.5, 24), M.duplex, -1.0, 0.6, 0, hp); mesh(cyl(0.3, 0.9, 24), M.duplex, 1.0, 0.75, 0, hp);
      mesh(cyl(0.38, 0.9, 24).rotateZ(Math.PI / 2), M.yellow, 1.9, 0, 0, hp);
      mesh(cyl(0.85, 3.2, 40).rotateZ(Math.PI / 2), M.motor, 4.0, 0.15, 0, hp);
      const fan = mesh(cyl(0.6, 0.12, 24).rotateZ(Math.PI / 2), M.darkSteel, 5.68, 0.15, 0, hp); for (let b = 0; b < 4; b++) mesh(box(0.04, 1.0, 0.12), M.yellow, 0.07, 0, 0, fan).rotation.x = b * Math.PI / 4;
      rotors.hp.push(fan); T.hp = hp;
      // PX array: 16 units, 2 rows × 8, along x, between HP/LP manifolds
      const px = new THREE.Group(); px.position.set(258, P0, zt - 2.2); g.add(px); T.px = px; T.pxRings = [];
      for (let i = 0; i < 16; i++) { const zz = (i % 8) * 0.45 - 1.6, yy = 0.9 + Math.floor(i / 8) * 0.6;
        mesh(cyl(0.16, 1.15, 20).rotateZ(Math.PI / 2), M.white, 1.4, yy, zz, px);
        for (const s of [-1, 1]) mesh(cyl(0.2, 0.12, 20).rotateZ(Math.PI / 2), M.duplex, 1.4 + s * 0.6, yy, zz, px);
        const ring = mesh(new THREE.TorusGeometry(0.17, 0.02, 6, 20).rotateY(Math.PI / 2), M.trim, 1.4, yy, zz, px); T.pxRings.push(ring); }
      for (const [x, r, m] of [[0.6, 0.16, PM.feed], [2.2, 0.16, PM.brine]]) for (const yy of [0.9, 1.5]) pipeBetween([x, yy, -1.9], [x, yy, 1.8], r * 0.8, m, px, 12);
      mesh(box(3.4, 0.2, 4.0), M.darkSteel, 1.4, 0.35, -0.0, px);
      // booster (circulation) pump
      const bst = new THREE.Group(); bst.position.set(264.5, P0 + 0.7, zt - 2.2); g.add(bst);
      mesh(cyl(0.38, 0.9, 24).rotateZ(Math.PI / 2), M.duplex, 0, 0, 0, bst); mesh(cyl(0.45, 1.6, 24).rotateZ(Math.PI / 2), M.motor, 1.3, 0, 0, bst);
      const bf = mesh(cyl(0.3, 0.08, 16).rotateZ(Math.PI / 2), M.yellow, 2.15, 0, 0, bst); rotors.boost.push(bf); T.boost = bst;
      mesh(box(3, 0.25, 1.2), M.darkSteel, 0.7, -0.55, 0, bst);
      // piping: LP header → HP pump → feed manifold; LP header → PX; PX HP out → booster → feed manifold; brine → PX → outfall; permeate → post
      run([[238, P0 + 1.2, zt + 1.8], [246.7, P0 + 1.2, zt + 1.8], [247, P0 + 1.5, zt + 1.8]], 0.2, PM.sea, g);
      run([[249, P0 + 1.65, zt + 1.8], [249, P0 + 2.2, zt + 1.8], [269, P0 + 2.2, zt + 1.8], [269, P0 + 0.4, zt + 1.8], [xf, P0 + 0.4, zt + 1.8]], 0.16, PM.feed, g);
      run([[238, P0 + 1.2, zt - 4.4], [258.6, P0 + 1.2, zt - 4.4], [258.6, P0 + 0.9, zt - 4.1]], 0.18, PM.sea, g);
      run([[258.6, P0 + 1.5, zt - 2.2], [264.5, P0 + 1.5, zt - 2.2], [264.5, P0 + 0.7, zt - 2.2]], 0.14, PM.feed, g);
      run([[265.5, P0 + 0.7, zt - 2.2], [268, P0 + 0.7, zt - 2.2], [268, P0 + 0.4, zt - 2.2], [xf, P0 + 0.4, zt - 2.2]], 0.14, PM.feed, g);
      run([[xb, P0 + 0.4, zt - 2.6], [xb + 0.9, P0 + 0.4, zt - 2.6], [xb + 0.9, P0 + 0.1, zt - 4.9], [260.2, P0 + 0.1, zt - 4.9], [260.2, P0 + 1.5, zt - 4.1]], 0.13, PM.brine, g);
      run([[260.2, P0 + 0.9, zt + 1.7], [260.2, P0 + 0.9, zt + 3.4], [241, P0 + 0.9, zt + 3.4]], 0.16, PM.brineLP, g);
      run([[xb + 0.35, ytop + 0.45, zt + zw / 2 + 0.5], [xb + 0.35, ytop + 0.45, zt + zw / 2 + 1.4], [303, ytop + 0.45, zt + zw / 2 + 1.4]], 0.18, PM.perm, g);
      T.anchor = V(RACK.x0 + RACK.len / 2, ytop + 1.2, zt);
      trains.push(T);
      const yMid = RACK.y0 + 3 * RACK.pitch, zMid = zt - zw / 2 + 6 * RACK.pitch;
      stream("lp" + ti, "sea", [[238, P0 + 1.2, zt + 1.8], [246.7, P0 + 1.2, zt + 1.8], [247, P0 + 1.5, zt + 1.8]], 0.18, "QhpT", 1, 1.6);
      stream("hp" + ti, "feed", [[249, P0 + 1.65, zt + 1.8], [249, P0 + 2.2, zt + 1.8], [269, P0 + 2.2, zt + 1.8], [269, P0 + 0.4, zt + 1.8], [xf, P0 + 0.4, zt + 1.8]], 0.14, "QhpT", 1, 1.6);
      stream("pxlp" + ti, "sea", [[238, P0 + 1.2, zt - 4.4], [258.6, P0 + 1.2, zt - 4.4], [258.6, P0 + 0.9, zt - 4.1]], 0.16, "QpxT", 1, 1.6);
      stream("pxhp" + ti, "feed", [[258.6, P0 + 1.5, zt - 2.2], [264.5, P0 + 1.5, zt - 2.2], [265.5, P0 + 0.7, zt - 2.2], [268, P0 + 0.7, zt - 2.2], [268, P0 + 0.4, zt - 2.2], [xf, P0 + 0.4, zt - 2.2]], 0.12, "QpxT", 1, 1.6);
      stream("vessel" + ti, "feed", [[xf, P0 + 0.4, zMid], [xf, yMid, zMid], [RACK.x0 + 0.2, yMid, zMid + 0.17], [RACK.x0 + RACK.len, yMid, zMid + 0.17], [xb, yMid, zMid], [xb, P0 + 0.4, zMid]], 0.05, "QfV", 1, 2);
      stream("brine" + ti, "brine", [[xb, P0 + 0.4, zt - 2.6], [xb + 0.9, P0 + 0.4, zt - 2.6], [xb + 0.9, P0 + 0.1, zt - 4.9], [260.2, P0 + 0.1, zt - 4.9], [260.2, P0 + 1.5, zt - 4.1]], 0.12, "QbT", 1, 1.6);
      stream("brlp" + ti, "brine", [[260.2, P0 + 0.9, zt + 1.7], [260.2, P0 + 0.9, zt + 3.4], [241, P0 + 0.9, zt + 3.4]], 0.14, "QbT", 1, 1.6);
      stream("perm" + ti, "perm", [[RACK.x0 + 1, yMid, zMid], [xb + 0.35, yMid, zMid], [xb + 0.35, ytop + 0.45, zt], [xb + 0.35, ytop + 0.45, zt + zw / 2 + 1.4], [303, ytop + 0.45, zt + zw / 2 + 1.4]], 0.15, "QpT", 1, 1.6);
    });
  }
  hall.add(vessels, ends);
  // collectors: brine to the outfall (west wall), permeate to post-treatment (east wall)
  const ytop = RACK.y0 + (RACK.rows - 1) * RACK.pitch;
  run([[241, P0 + 0.9, -48], [241, P0 + 0.9, 62], [241, P0 + 0.9, 120]], 0.45, PM.brineLP, root);
  run([[303, ytop + 0.45, -36], [303, ytop + 0.45, 46], [303, P0 + 1.5, 46], [303, P0 + 1.5, 62], [335, P0 + 1.5, 62], [335, P0 + 1.5, -2], [340, P0 + 4, -2]], 0.4, PM.perm, root);
  anchors.ro = V(278, P0 + 6, 0); anchors.hp = V(250, P0 + 2, -8); anchors.px = V(259.5, P0 + 1.5, -10.2); anchors.rack = V(276, P0 + 2.5, -8);

  // ---------------- 6. CIP skid ----------------
  const cip = (() => {
    const g = new THREE.Group(); root.add(g);
    mesh(box(18, 0.3, 14), M.concrete, 320, P0 + 0.1, 42, g, false);
    for (const [x, z] of [[311.5, 35.5], [328.5, 35.5], [311.5, 48.5], [328.5, 48.5]]) mesh(box(0.3, 6, 0.3), M.steel, x, P0 + 3, z, g);
    const roof = new THREE.Group(); g.add(roof); mesh(box(19, 0.25, 15), M.roof, 320, P0 + 6.1, 42, roof); roofs.push({ roof, walls: {} });
    tank(g, 315, 40, 1.7, 3.6, M.duplex, P0 + 0.3, "flat"); tank(g, 320, 40, 1.7, 3.6, M.duplex, P0 + 0.3, "flat");
    mesh(cyl(1.75, 0.6, 32), M.red, 315, P0 + 1.4, 40, g, false);   // heater jacket band on the hot tank
    const pump = new THREE.Group(); pump.position.set(324.5, P0 + 0.8, 45); g.add(pump);
    mesh(cyl(0.35, 0.8, 24).rotateZ(Math.PI / 2), M.duplex, 0, 0, 0, pump); mesh(cyl(0.42, 1.3, 24).rotateZ(Math.PI / 2), M.motor, 1.1, 0, 0, pump);
    const f = mesh(cyl(0.28, 0.07, 16).rotateZ(Math.PI / 2), M.yellow, 1.8, 0, 0, pump); rotors.cip.push(f);
    mesh(cyl(0.45, 1.8, 24), M.duplex, 320, P0 + 1.2, 46, g);
    const led = mesh(new THREE.SphereGeometry(0.15, 12, 8), M.ledAmber.clone(), 323, P0 + 2.4, 49, g);
    run([[315, P0 + 0.6, 42], [324.5, P0 + 0.6, 45]], 0.1, M.duplex, g);
    const line = run([[323.7, P0 + 0.8, 45], [323.7, P0 + 0.8, 52], [305, P0 + 0.8, 52], [284, P0 + 0.8, 46]], 0.12, M.duplex, g);
    anchors.cip = V(320, P0 + 4, 42);
    return { group: g, led, line };
  })();

  // ---------------- 7. post-treatment: limestone contactors with CO2, chlorination ----------------
  { const g = new THREE.Group(); root.add(g); const H = 4.5;
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) {
      const x0 = 342 + c * 10.5, z0 = -68 + r * 30, cx = x0 + 5, cz = z0 + 12;
      for (const zz of [z0, z0 + 24]) mesh(box(10.4, H, 0.35), M.concrete, cx, P0 + H / 2, zz, g);
      for (const xx of [x0, x0 + 10]) mesh(box(0.35, H, 24), M.concrete, xx, P0 + H / 2, cz, g);
      mesh(box(9.6, 0.4, 23.6), M.calcite, cx, P0 + 2.6, cz, g, false);
      mesh(new THREE.PlaneGeometry(9.6, 23.6).rotateX(-Math.PI / 2), M.clearWater, cx, P0 + 3.8, cz, g, false);
    }
    mesh(box(42, 0.3, 1.2), M.grate, 363, P0 + H + 0.1, -40, g);
    for (const dz of [-0.55, 0.55]) handrail(g, 342, -40 + dz, 384, -40 + dz, P0 + H + 0.25);
    hTank(g, 356, P0 + 2.0, 20, 1.5, 14, M.white); mesh(box(3, 3.2, 2), M.galv, 366, P0 + 1.6, 26, g);      // CO2 bullet and vaporiser
    tank(g, 380, 18, 1.7, 4, S({ color: "#e9edf0", roughness: 0.5 }), P0, "cone"); tank(g, 385, 18, 1.7, 4, S({ color: "#e9edf0", roughness: 0.5 }), P0, "cone");
    run([[356, P0 + 1, 13], [356, P0 + 1, -6], [360, P0 + 4.2, -8]], 0.06, M.white, g);
    anchors.post = V(363, P0 + 5, -40); anchors.co2 = V(356, P0 + 4, 20); anchors.cl2 = V(382, P0 + 5, 18);
  }
  run([[340, P0 + 4, -2], [345, P0 + 4.2, -8]], 0.4, PM.perm, root);
  run([[386, P0 + 3, -40], [400, P0 + 3, -40], [400, P0 + 3, 0], [412, P0 + 3, 0]], 0.42, PM.prod, root);
  run([[383, P0 + 1, 18], [400, P0 + 1, 18], [400, P0 + 3, 4]], 0.04, M.yellow, root);
  stream("toPost", "perm", [[303, ytop + 0.45, 46], [303, P0 + 1.5, 46], [303, P0 + 1.5, 62], [335, P0 + 1.5, 62], [335, P0 + 1.5, -2], [345, P0 + 4.2, -8], [345, P0 + 3.8, -44], [384, P0 + 3.8, -44]], 0.3, "Qp", 1, 1);

  // ---------------- 8. product water storage and transfer pumps ----------------
  const tanks = [tank(root, 440, -50, 22, 16, M.tankWhite), tank(root, 440, 50, 22, 16, M.tankWhite)];
  tanks.forEach(t => { for (let i = 0; i < 20; i++) { const a = -0.6 + i * 0.055, y = 0.5 + i * 0.78; mesh(box(1, 0.08, 1.2), M.galv, Math.cos(a) * 22.6, y, Math.sin(a) * 22.6, t, false).rotation.y = -a; }
    mesh(cyl(22.05, 1.2, 64, 22.05), M.trim, 0, 15, 0, t, false); });
  run([[412, P0 + 3, 0], [418, P0 + 1, 0], [418, P0 + 1, -50], [418, P0 + 1, 50]], 0.42, PM.prod, root);
  const ps = building(root, 470, 486, -8, 8, 6, M.sidingBlue, { doors: 1 }); roofs.push(ps);
  for (let i = 0; i < 4; i++) { const p = mesh(cyl(0.5, 1.4, 24).rotateZ(Math.PI / 2), M.pumpBlue, 476, P0 + 0.8, -5 + i * 3.3, ps.group); const f = mesh(cyl(0.35, 0.08, 16).rotateZ(Math.PI / 2), M.yellow, 477.2, P0 + 0.8, -5 + i * 3.3, ps.group); rotors.product.push(f); }
  run([[462, P0 + 1, -50], [466, P0 + 1, 0], [470, P0 + 1, 0]], 0.45, PM.prod, root); run([[462, P0 + 1, 50], [466, P0 + 1, 0]], 0.45, PM.prod, root);
  run([[486, P0 + 1, 0], [560, P0 - 1, 0], [900, groundY(900, 0) - 1, 0]], 0.5, PM.prod, root);
  anchors.tanks = V(440, P0 + 18, 0); anchors.product = V(478, P0 + 7, 0);
  stream("prod", "prod", [[384, P0 + 3.8, -44], [386, P0 + 3, -40], [400, P0 + 3, -40], [400, P0 + 3, 0], [412, P0 + 3, 0], [418, P0 + 1, 0], [418, P0 + 1, -50], [440, P0 + 2, -50], [462, P0 + 1, -50], [466, P0 + 1, 0], [470, P0 + 1, 0], [486, P0 + 1, 0], [560, P0 - 1, 0]], 0.35, "Qp", 1, 1);

  // ---------------- 9. brine outfall and diffuser ----------------
  const ports = [];
  { const g = new THREE.Group(); root.add(g);
    const { x0, x1, z, risers } = DIFF;
    const land = [V(241, P0 + 0.9, 120), V(60, P0 - 1.5, 120), V(20, -1.8, 120)];
    const sea = seabedRun([0, 120], [x0, z], 0.55, 60);
    run(land, 0.5, PM.brineLP, g);
    const visible = sea.filter(p => p.y > groundY(p.x, p.z) - 0.2);
    run(visible, 0.5, M.hdpe, g, 18);
    const diff = seabedRun([x0, z], [x1, z], 0.55, 10); run(diff, 0.42, M.hdpe, g, 18);
    for (let i = 0; i < risers; i++) {
      const x = x0 + (x1 - x0) * (i + 0.5) / risers, y = groundY(x, z) + 0.55;
      mesh(box(2.2, 1.2, 2.2), M.concreteDark, x, y - 0.4, z, g);
      pipeBetween([x, y, z], [x, y + 1.6, z], 0.18, M.hdpe, g, 12);
      mesh(cyl(0.3, 0.4, 16), M.hdpe, x, y + 1.7, z, g);
      for (const s of [-1, 1]) {      // two 60° ports per riser, pointing across the diffuser
        const a = V(x, y + 1.75, z + s * 0.3), dir = V(0, Math.sin(Math.PI / 3), s * Math.cos(Math.PI / 3));
        pipeBetween(a, a.clone().addScaledVector(dir, 0.6), 0.07, M.darkSteel, g, 10);
        ports.push({ pos: a.clone().addScaledVector(dir, 0.6), dir, s });
      }
    }
    const b = mesh(cyl(0.6, 1.4, 16), M.buoy, (x0 + x1) / 2, 0.3, z + 18, root); mesh(cyl(0.05, 1.5, 6), M.darkSteel, (x0 + x1) / 2, 1.6, z + 18, root);
    anchors.outfall = V((x0 + x1) / 2, groundY((x0 + x1) / 2, z) + 2, z);
    stream("brineOut", "brine", [[241, P0 + 0.9, -40], [241, P0 + 0.9, 120], ...land.slice(1).map(p => p.toArray()), ...sea.slice(1).map(p => p.toArray()), ...diff.slice(1).map(p => p.toArray())], 0.42, "Qb", 1, 0.25);
  }

  // ---------------- 10. admin, substation, details ----------------
  { const a = building(root, 180, 214, 92, 108, 7, M.siding, { doors: 2 }); roofs.push(a);
    for (let i = 0; i < 10; i++) mesh(box(2.2, 1.4, 0.08), M.glass, 182 + i * 3.2, P0 + 4.2, 108.2, a.group, false);
    const sub = new THREE.Group(); root.add(sub);
    mesh(box(40, 0.3, 26), M.gravel, 300, P0 + 0.05, 105, sub, false);
    for (let i = 0; i < 3; i++) { const x = 288 + i * 12; mesh(box(4, 3.6, 3), M.green, x, P0 + 1.8, 100, sub); for (let f = 0; f < 6; f++) mesh(box(0.1, 2.8, 2.8), M.green, x - 2.2 - f * 0.25, P0 + 1.8, 100, sub);
      for (let b = 0; b < 3; b++) mesh(cyl(0.12, 1.4, 10), M.white, x - 1 + b, P0 + 4.3, 100, sub); }
    for (let i = 0; i < 4; i++) { const x = 286 + i * 10; mesh(cyl(0.2, 14, 8), M.galv, x, P0 + 7, 114, sub); mesh(box(0.3, 0.3, 6), M.galv, x, P0 + 13, 114, sub); }
    fence(root, 280, 320, 92, 118, 2.2);
    // cars
    for (let i = 0; i < 9; i++) { const c = mesh(box(4.4, 1.4, 1.8), S({ color: ["#9aa3a8", "#2f4b66", "#e4e2dc", "#7a2f2a"][i % 4], roughness: 0.3, metalness: 0.6 }), 182 + i * 3.2, P0 + 0.75, 124, root); c.rotation.y = Math.PI / 2; }
    // light poles
    for (const [x, z] of [[230, -150], [330, -150], [430, -150], [230, 150], [330, 150], [430, 150]]) { mesh(cyl(0.12, 12, 8), M.galv, x, P0 + 6, z, root); mesh(box(1.2, 0.3, 0.5), M.darkSteel, x, P0 + 12, z, root); }
  }

  // operators (scale cues): RO hall aisles, walkways, UF canopy, CIP skid, product pumps
  // operators and engineers, women and men (Part W): women lead at the HP pump, take samples at the racks and the CIP skid, work the UF walkway and post-treatment
  [[254, P0, -12.5, 1.2, 0, "point", { woman: true, h: 0.95, hair: 1 }], [255.5, P0, -13.2, -2.0, 1, "stand", { h: 1.03 }],
   [270, P0, 15.5, 0.4, 2, "sample", { woman: true, h: 0.93, hair: 0, bun: true }], [262, P0, 32.4, 2.6, 3, "stand", { h: 0.98 }], [244, P0, -30, -0.9, 4, "stand", { h: 1.01 }],
   [140, P0 + 5.25, -83.8, 0, 1, "stand", { woman: true, h: 0.97, hair: 2 }], [150, P0, 8, 1.6, 2, "point", { h: 1.04 }], [318, P0 + 0.25, 46, -1.2, 0, "sample", { woman: true, h: 0.96, hair: 3, bun: true }],
   [474, P0, 3, 2.2, 3, "stand", { h: 0.99 }], [363, P0 + 4.75, -40, 1.57, 4, "stand", { woman: true, h: 0.94, hair: 4 }]]
    .forEach(([x, y, z, r, k, pose, o]) => person(root, x, y, z, r, k, pose, o));
  // merge static meshes by material so the plant draws in a few hundred calls instead of thousands
  const keep = new Set([water, cip.led, ...rotors.intake, ...rotors.hp, ...rotors.boost, ...rotors.mixer, ...rotors.cip, ...rotors.product, ...rotors.blower, ...rotors.floc.map(f => f.o)]);
  for (const B of roofs) { keep.add(B.roof); if (B.walls.s) keep.add(B.walls.s); }
  for (const T of trains) for (const r of T.pxRings) keep.add(r);
  bake(root, keep);
  const bounds = { cx: 160, cz: 20 };
  return { root, water, streams, rotors, roofs, anchors, trains, vessels, vGeo, ufInst, cip, ports, flocW, bounds, tanks, NE };
}
