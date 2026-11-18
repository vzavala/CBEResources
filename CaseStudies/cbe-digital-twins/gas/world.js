// Static 3D world for the gas pipeline twin: terrain, pipeline route (buried / above ground),
// compressor stations, valve sites, river crossing, supply plant and delivery site.
// Scene units are metres. Equipment is modelled at true size; the 1600 km route is compressed
// along its length (about 1 : 250) so the whole line fits in one landscape.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { CUSTOMERS } from "./customers.js";

export const ROUTE_SCALE = 250;          // real metres per scene metre along the line
const LINK_KM = [300, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 300];
export const PIPE_R = 0.457;             // 36" line

// ---------- deterministic noise ----------
function mulberry(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rand = mulberry(7);
function hash2(i, j) { let h = (i * 374761393 + j * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, z) {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash2(i, j), b = hash2(i + 1, j), c = hash2(i, j + 1), d = hash2(i + 1, j + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, z, oct = 5) { let s = 0, a = 0.5, f = 1; for (let o = 0; o < oct; o++) { s += a * vnoise(x * f, z * f); f *= 2.03; a *= 0.5; } return s; }
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------- nearest-point grid for polylines ----------
class PolyGrid {
  constructor(xs, zs, cell = 60) {
    this.xs = xs; this.zs = zs; this.cell = cell; this.map = new Map();
    for (let i = 0; i < xs.length; i++) {
      const k = `${Math.floor(xs[i] / cell)},${Math.floor(zs[i] / cell)}`;
      (this.map.get(k) || this.map.set(k, []).get(k)).push(i);
    }
  }
  nearest(x, z, rad = 2) {
    const ci = Math.floor(x / this.cell), cj = Math.floor(z / this.cell);
    let best = -1, bd = Infinity;
    for (let a = -rad; a <= rad; a++) for (let b = -rad; b <= rad; b++) {
      const L = this.map.get(`${ci + a},${cj + b}`); if (!L) continue;
      for (const i of L) { const dx = this.xs[i] - x, dz = this.zs[i] - z, d = dx * dx + dz * dz; if (d < bd) { bd = d; best = i; } }
    }
    return [best, Math.sqrt(bd)];
  }
}

// ---------- materials ----------
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
const ribTex = canvasTex(128, 128, (g, W, H) => {   // ribbed metal siding
  g.fillStyle = "#cfd2cf"; g.fillRect(0, 0, W, H);
  for (let x = 0; x < W; x += 16) { const gr = g.createLinearGradient(x, 0, x + 16, 0); gr.addColorStop(0, "#b9bcb9"); gr.addColorStop(0.35, "#e6e8e5"); gr.addColorStop(0.7, "#c7cac7"); gr.addColorStop(1, "#aeb1ae"); g.fillStyle = gr; g.fillRect(x, 0, 16, H); }
}, [6, 1]);
const fenceTex = canvasTex(64, 64, (g, W, H) => {   // chain link
  g.clearRect(0, 0, W, H); g.strokeStyle = "rgba(190,196,200,0.95)"; g.lineWidth = 1.6;
  for (let i = -64; i < 128; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 64, 64); g.stroke(); g.beginPath(); g.moveTo(i + 64, 0); g.lineTo(i, 64); g.stroke(); }
}, [1, 1]);
const louverTex = canvasTex(64, 64, (g, W, H) => { g.fillStyle = "#8f9496"; g.fillRect(0, 0, W, H); for (let y = 0; y < H; y += 8) { g.fillStyle = "#5d6264"; g.fillRect(0, y, W, 3); } }, [1, 1]);

// Part H: procedural surface maps (height -> normal map, plus roughness maps), sized to real-world detail
function heightCanvas(w, draw) { const c = document.createElement("canvas"); c.width = c.height = w; const g = c.getContext("2d"); g.fillStyle = "#808080"; g.fillRect(0, 0, w, w); draw(g, w); return c; }
function normalTex(hc, strength = 2, rep = [1, 1]) {
  const w = hc.width, src = hc.getContext("2d").getImageData(0, 0, w, w).data;
  const c = document.createElement("canvas"); c.width = c.height = w; const g = c.getContext("2d"), out = g.createImageData(w, w);
  const H = (x, y) => src[(((y + w) % w) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1), k = (y * w + x) * 4;
    out.data[k] = (-dx / l * 0.5 + 0.5) * 255; out.data[k + 1] = (dy / l * 0.5 + 0.5) * 255; out.data[k + 2] = (1 / l * 0.5 + 0.5) * 255; out.data[k + 3] = 255;
  }
  g.putImageData(out, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.anisotropy = 8; t.colorSpace = THREE.NoColorSpace; return t;
}
function dataTex(hc, rep = [1, 1]) { const t = new THREE.CanvasTexture(hc); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.anisotropy = 8; t.colorSpace = THREE.NoColorSpace; return t; }
const rr = mulberry(31);
const pebbles = heightCanvas(256, (g, w) => {            // gravel: ~2 m tile of 2-5 cm stones
  for (let i = 0; i < 2600; i++) { const x = rr() * w, y = rr() * w, r = 1.5 + rr() * 3.5, gr = g.createRadialGradient(x, y, 0, x, y, r);
    const v = 150 + rr() * 90 | 0; gr.addColorStop(0, `rgb(${v},${v},${v})`); gr.addColorStop(1, "rgba(60,60,60,0)"); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
});
const gravelCol = canvasTex(256, 256, (g, W) => {
  g.fillStyle = "#a9a59c"; g.fillRect(0, 0, W, W);
  const r2 = mulberry(31);
  for (let i = 0; i < 2600; i++) { const x = r2() * W, y = r2() * W, r = 1.5 + r2() * 3.5, t = r2(); r2(); r2();
    const c = t < 0.3 ? [150, 146, 138] : t < 0.6 ? [184, 180, 170] : t < 0.85 ? [128, 124, 118] : [196, 186, 168];
    g.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`; g.beginPath(); g.arc(x, y, r * 0.8, 0, 7); g.fill(); }
}, [90, 60]);
const speckle = (n, a, sz = 2) => heightCanvas(256, (g, w) => { for (let i = 0; i < n; i++) { const v = 128 + (rr() - 0.5) * a | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(rr() * w, rr() * w, 1 + rr() * sz, 1 + rr() * sz); } });
const concreteH = speckle(9000, 120, 2);
const brushedH = heightCanvas(256, (g, w) => { for (let i = 0; i < 900; i++) { const v = 128 + (rr() - 0.5) * 70 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(rr() * w, rr() * w, 20 + rr() * 120, 1); } });
const paintH = speckle(5000, 40, 3);
const grassH = heightCanvas(256, (g, w) => { for (let i = 0; i < 7000; i++) { const x = rr() * w, y = rr() * w, v = 110 + rr() * 120 | 0; g.strokeStyle = `rgb(${v},${v},${v})`; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rr() - 0.5) * 3, y - 2 - rr() * 5); g.stroke(); } });
const ribH = heightCanvas(128, (g, w) => { for (let x = 0; x < w; x += 16) { const gr = g.createLinearGradient(x, 0, x + 16, 0); gr.addColorStop(0, "#404040"); gr.addColorStop(0.35, "#e0e0e0"); gr.addColorStop(0.7, "#a0a0a0"); gr.addColorStop(1, "#404040"); g.fillStyle = gr; g.fillRect(x, 0, 16, w); } });
const N = {
  gravel: normalTex(pebbles, 3, [90, 60]), concrete: normalTex(concreteH, 1.2, [3, 3]), brushed: normalTex(brushedH, 0.6, [2, 2]),
  paint: normalTex(paintH, 0.5, [2, 2]), grass: normalTex(grassH, 2.5, [140, 140]), rib: normalTex(ribH, 4, [6, 1]), asphalt: normalTex(speckle(12000, 150, 1.5), 2, [4, 16]),
};
const R = { brushed: dataTex(brushedH, [2, 2]), paint: dataTex(paintH, [2, 2]), concrete: dataTex(concreteH, [3, 3]) };
// painted steel: low metalness (paint is a dielectric), satin clearcoat, faint orange-peel normal
const painted = (color, extra = {}) => new THREE.MeshPhysicalMaterial({ color, metalness: 0.25, roughness: 0.5, roughnessMap: R.paint, normalMap: N.paint, normalScale: new THREE.Vector2(0.35, 0.35), clearcoat: 0.35, clearcoatRoughness: 0.35, ...extra });
export const M = {
  gravel: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1, map: gravelCol, normalMap: N.gravel, normalScale: new THREE.Vector2(1.4, 1.4) }),
  concrete: new THREE.MeshStandardMaterial({ color: "#c2c0ba", roughness: 0.92, map: noiseTex("#c2c0ba", 0.1, 3000, [2, 2]), normalMap: N.concrete, normalScale: new THREE.Vector2(0.6, 0.6) }),
  siding: new THREE.MeshStandardMaterial({ color: "#e4e2da", roughness: 0.5, metalness: 0.35, map: ribTex, normalMap: N.rib, normalScale: new THREE.Vector2(0.9, 0.9) }),
  roof: new THREE.MeshStandardMaterial({ color: "#7d8a92", roughness: 0.45, metalness: 0.55, roughnessMap: R.brushed }),
  trim: painted("#2f5d7c"),
  door: painted("#9aa3a8", { metalness: 0.45 }),
  louver: new THREE.MeshStandardMaterial({ map: louverTex, roughness: 0.6, metalness: 0.5 }),
  steel: new THREE.MeshStandardMaterial({ color: "#8b9196", roughness: 0.42, metalness: 0.85, roughnessMap: R.brushed, normalMap: N.brushed, normalScale: new THREE.Vector2(0.3, 0.3) }),
  galv: new THREE.MeshStandardMaterial({ color: "#b7bcbf", roughness: 0.4, metalness: 0.85, roughnessMap: R.brushed, normalMap: N.brushed, normalScale: new THREE.Vector2(0.25, 0.25) }),
  darkSteel: new THREE.MeshStandardMaterial({ color: "#4a5056", roughness: 0.5, metalness: 0.7 }),
  stack: new THREE.MeshStandardMaterial({ color: "#7b7f80", roughness: 0.55, metalness: 0.75 }),
  yellow: painted("#e0b123", { metalness: 0.15 }),
  vessel: painted("#d9dad5"),
  turbine: painted("#d6d9d6"),
  compBlue: painted("#2e5f8f", { metalness: 0.35 }),
  red: painted("#b8352c"),
  fence: new THREE.MeshStandardMaterial({ map: fenceTex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.6 }),
  fanBlade: new THREE.MeshStandardMaterial({ color: "#3b3f42", roughness: 0.5, metalness: 0.5 }),
  coolerFin: new THREE.MeshStandardMaterial({ color: "#a8adb0", roughness: 0.6, metalness: 0.7, map: louverTex }),
  water: new THREE.MeshStandardMaterial({ color: "#3b5f73", roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
  trunk: new THREE.MeshStandardMaterial({ color: "#5a4636", roughness: 0.9 }),
  conifer: new THREE.MeshStandardMaterial({ color: "#3d5a38", roughness: 0.92 }),
  broadleaf: new THREE.MeshStandardMaterial({ color: "#58773f", roughness: 0.92 }),
  roofRed: new THREE.MeshStandardMaterial({ color: "#8a4b3c", roughness: 0.8 }),
  wallWarm: new THREE.MeshStandardMaterial({ color: "#d8cfbf", roughness: 0.85 }),
  lamp: new THREE.MeshStandardMaterial({ color: "#fffbe8", emissive: "#fff3d0", emissiveIntensity: 1.5 }),
  ledGreen: new THREE.MeshStandardMaterial({ color: "#1f7a3a", emissive: "#2bd96b", emissiveIntensity: 0 }),
  ledAmber: new THREE.MeshStandardMaterial({ color: "#7a5a12", emissive: "#ffb21f", emissiveIntensity: 0 }),
  asphalt: new THREE.MeshStandardMaterial({ color: "#8a8d90", roughness: 0.93, map: noiseTex("#6e7174", 0.12, 6000, [4, 16]) }),
  glass: new THREE.MeshPhysicalMaterial({ color: "#2c3a44", metalness: 0, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, ior: 1.5, reflectivity: 0.6, envMapIntensity: 1.4 }),
  grating: new THREE.MeshStandardMaterial({ color: "#7e8487", metalness: 0.7, roughness: 0.55, map: louverTex }),
  vest: new THREE.MeshStandardMaterial({ color: "#ff7a1a", roughness: 0.7, emissive: "#ff5a00", emissiveIntensity: 0.05 }),
  cloth: new THREE.MeshStandardMaterial({ color: "#2d3a4f", roughness: 0.9 }),
  skin: new THREE.MeshStandardMaterial({ color: "#b5866a", roughness: 0.65 }),
  // Part W: varied skin tones and hair for the station crews
  skins: ["#8d5a3b", "#e0b48f", "#5c3a26", "#c99572", "#a8704f"].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.65 })),
  hairs: ["#1c1410", "#3b2416", "#6b3a1c", "#0e0c0b", "#8a6a3e"].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 })),
  hat: painted("#f4f4f2"),
  boot: new THREE.MeshStandardMaterial({ color: "#3a2a1e", roughness: 0.8 }),
  truck: painted("#e9ebec", { metalness: 0.5, clearcoat: 0.9, clearcoatRoughness: 0.08 }),
  tire: new THREE.MeshStandardMaterial({ color: "#1d1e20", roughness: 0.85 }),
};

function mesh(geo, mat, x = 0, y = 0, z = 0, parent, shadow = true) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
  m.castShadow = shadow; m.receiveShadow = true; if (parent) parent.add(m); return m;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
// rounded (bevelled) box: real equipment has rounded edges that catch the light
const rbox = (w, h, d, r = 0.06) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 3, h / 3, d / 3));
const BOLT = new THREE.CylinderGeometry(1, 1, 1, 6);
// bolt circle on a flange face: n hex nuts, instanced
function boltRing(parent, x, y, z, R, n, size, axis = "x") {
  const im = new THREE.InstancedMesh(BOLT, M.darkSteel, n), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2, c = Math.cos(a) * R, s = Math.sin(a) * R;
    e.set(0, 0, axis === "x" ? Math.PI / 2 : 0); if (axis === "z") e.set(Math.PI / 2, 0, 0); q.setFromEuler(e);
    const pos = axis === "x" ? new THREE.Vector3(x, y + c, z + s) : new THREE.Vector3(x + c, y + s, z);
    m4.compose(pos, q, new THREE.Vector3(size, size * 2.6, size)); im.setMatrixAt(k, m4); }
  im.castShadow = false; im.receiveShadow = true; parent.add(im); return im;
}
// pipe flange pair with bolts at x (mainline along x)
function flangeJoint(parent, x, y, z, r) {
  for (const s of [-1, 1]) { const f = mesh(cyl(r * 1.42, r * 0.16, 32), M.galv, x + s * r * 0.09, y, z, parent); f.rotation.z = Math.PI / 2; }
  boltRing(parent, x, y, z, r * 1.22, 16, r * 0.07, "x");
}
// guard rail: top rail, knee rail, posts every 1.5 m, toe board (OSHA 1.07 m)
function handrail(parent, pts, y0, mat = M.yellow) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    pipeBetween([ax, y0 + 1.07, az], [bx, y0 + 1.07, bz], 0.025, mat, parent, 6);
    pipeBetween([ax, y0 + 0.55, az], [bx, y0 + 0.55, bz], 0.02, mat, parent, 6);
    const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 1.5));
    for (let k = 0; k <= n; k++) { const t = k / n; pipeBetween([ax + (bx - ax) * t, y0, az + (bz - az) * t], [ax + (bx - ax) * t, y0 + 1.07, az + (bz - az) * t], 0.022, mat, parent, 6); }
  }
}
// caged ladder from y0 to y1 at (x, z), facing +x
function ladder(parent, x, z, y0, y1, face = 0) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = face; parent.add(g);
  for (const s of [-1, 1]) pipeBetween([0, y0, s * 0.23], [0, y1 + 1.1, s * 0.23], 0.025, M.yellow, g, 6);
  const n = Math.floor((y1 - y0) / 0.3), rung = new THREE.InstancedMesh(cyl(0.016, 0.46, 6), M.galv, n), m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
  for (let k = 0; k < n; k++) rung.setMatrixAt(k, m4.compose(new THREE.Vector3(0, y0 + 0.3 * (k + 1), 0), q, new THREE.Vector3(1, 1, 1)));
  g.add(rung);
  for (let y = y0 + 2.2; y < y1 + 1; y += 0.9) { const h = mesh(new THREE.TorusGeometry(0.38, 0.015, 4, 16, Math.PI), M.yellow, 0.36, y, 0, g, false); h.rotation.set(Math.PI / 2, 0, Math.PI / 2); h.rotation.order = "YXZ"; h.rotation.set(Math.PI / 2, 0, -Math.PI / 2); }
  return g;
}
// ribbon of width w along a polyline [[x,z],...], at height y(x,z); used for streets and tire tracks
function ribbon(pts, w, mat, yAt, uScale = 1) {
  const v = [], uv = [], idx = []; let acc = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    if (i > 0) acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const [x, z] = pts[i], y = yAt(x, z);
    v.push(x - dz * w / 2, y, z + dx * w / 2, x + dz * w / 2, y, z - dx * w / 2); uv.push(0, acc / uScale, 1, acc / uScale);
    if (i > 0) { const o = (i - 1) * 2; idx.push(o, o + 2, o + 1, o + 1, o + 2, o + 3); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; return m;
}
const trackTex = canvasTex(64, 256, (g, W, H) => { g.clearRect(0, 0, W, H); for (const x0 of [8, 46]) { for (let y = 0; y < H; y += 3) { g.fillStyle = `rgba(70,62,52,${0.35 + Math.random() * 0.35})`; g.fillRect(x0 + Math.random() * 2, y, 9 + Math.random() * 2, 2); } } }, [1, 1]);
const trackMat = new THREE.MeshStandardMaterial({ map: trackTex, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 });
function signTex(text, sub) { return canvasTex(512, 96, (g, W, H) => { g.fillStyle = "#f4f4f1"; g.fillRect(0, 0, W, H); g.fillStyle = "#c5050c"; g.fillRect(0, 0, 14, H); g.fillStyle = "#1d2733"; g.font = "700 46px Arial, sans-serif"; g.fillText(text, 30, 52); g.font = "400 24px Arial, sans-serif"; g.fillStyle = "#5d6875"; g.fillText(sub, 30, 84); }); }
// a worker at true size (1.76 m at h = 1): boots, legs, torso with hi-vis vest, arms, head, hair, hard hat.
// Part W: o = { h: height scale, skin, hair, woman }. Women wear the same coveralls, vest, boots and hard hat;
// they have slightly narrower shoulders and a low bun or ponytail below the hat. No other differences.
const P_LEG = new THREE.CapsuleGeometry(0.075, 0.72, 4, 10), P_ARM = new THREE.CapsuleGeometry(0.055, 0.5, 4, 10), P_TORSO = new THREE.CapsuleGeometry(0.17, 0.36, 6, 14);
function worker(parent, x, z, rot = 0, pose = 0, o = {}) {
  const { h = 1, skin = M.skin, hair = M.hairs[0], woman = false } = o;
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; g.scale.setScalar(h); parent.add(g);
  for (const s of [-1, 1]) {
    const leg = mesh(P_LEG, M.cloth, 0, 0.47, s * 0.1, g); leg.rotation.x = s * pose * 0.25;
    mesh(rbox(0.26, 0.09, 0.11, 0.03), M.boot, 0.04, 0.045, s * 0.1, g);
    const arm = mesh(P_ARM, s > 0 && pose === 2 ? M.cloth : M.vest, 0, 1.12, s * (woman ? 0.215 : 0.24), g); arm.rotation.x = s * 0.12; if (pose === 2 && s > 0) { arm.rotation.z = -1.1; arm.position.set(0.2, 1.3, 0.24); }
  }
  mesh(P_TORSO, M.vest, 0, 1.2, 0, g).scale.set(0.75, 1, woman ? 1.02 : 1.15);
  mesh(cyl(0.05, 0.1, 10), skin, 0, 1.53, 0, g);
  mesh(new THREE.SphereGeometry(0.1, 16, 12), skin, 0, 1.64, 0, g).scale.set(1, 1.15, 0.95);
  mesh(new THREE.SphereGeometry(0.106, 16, 10, Math.PI / 2, Math.PI), hair, -0.008, 1.645, 0, g).scale.set(1, 1.1, 0.98);   // hair at the back of the head
  if (woman) { mesh(new THREE.SphereGeometry(0.055, 12, 10), hair, -0.112, 1.585, 0, g); mesh(new THREE.CapsuleGeometry(0.034, 0.17, 4, 8), hair, -0.13, 1.47, 0, g).rotation.z = 0.12; }   // gathered hair: low bun and ponytail
  mesh(new THREE.SphereGeometry(0.125, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.hat, 0, 1.69, 0, g);
  mesh(cyl(0.15, 0.015, 20), M.hat, 0.02, 1.69, 0, g);
  return g;
}
// pickup truck at true size (5.9 m x 2.0 m)
function pickup(parent, x, z, rot = 0) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; parent.add(g);
  mesh(rbox(5.9, 0.75, 2.0, 0.18), M.truck, 0, 0.85, 0, g);
  mesh(rbox(2.6, 0.85, 1.92, 0.22), M.truck, 0.45, 1.62, 0, g);
  mesh(rbox(2.3, 0.6, 1.94, 0.12), M.glass, 0.45, 1.68, 0, g);
  mesh(rbox(2.2, 0.5, 1.9, 0.06), M.darkSteel, -1.75, 1.42, 0, g);
  for (const [wx, wz] of [[1.85, 0.86], [1.85, -0.86], [-1.75, 0.86], [-1.75, -0.86]]) { const w = mesh(cyl(0.4, 0.28, 20), M.tire, wx, 0.4, wz, g); w.rotation.x = Math.PI / 2; mesh(cyl(0.22, 0.29, 12), M.galv, wx, 0.4, wz, g).rotation.x = Math.PI / 2; }
  return g;
}
const cyl = (r, h, s = 24, r2 = r) => new THREE.CylinderGeometry(r2, r, h, s);

// pipe between two points (local), radius r
function pipeBetween(a, b, r, mat, parent, seg = 16) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), L = d.length();
  const m = mesh(cyl(r, L, seg), mat, 0, 0, 0, parent);
  m.position.copy(A).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}
function elbowPath(points, r, mat, parent) {   // polyline of straight pipes with ball joints
  for (let i = 0; i < points.length - 1; i++) pipeBetween(points[i], points[i + 1], r, mat, parent);
  for (let i = 1; i < points.length - 1; i++) mesh(new THREE.SphereGeometry(r, 16, 10), mat, ...points[i], parent);
}
function flangeValve(parent, x, y, z, r, axis = "x", actuator = true) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  mesh(new THREE.SphereGeometry(r * 1.55, 20, 14), M.steel, 0, 0, 0, g);
  for (const s of [-1, 1]) { const f = mesh(cyl(r * 1.45, r * 0.35, 32), M.steel, s * r * 1.5, 0, 0, g); f.rotation.z = Math.PI / 2; boltRing(g, s * r * 1.5, 0, 0, r * 1.25, 12, r * 0.08, "x"); }
  if (actuator) {
    mesh(cyl(r * 0.35, r * 1.4, 12), M.steel, 0, r * 1.9, 0, g);
    mesh(rbox(r * 2.4, r * 1.3, r * 1.6, r * 0.15), M.yellow, 0, r * 2.9, 0, g);
    const hw = mesh(new THREE.TorusGeometry(r * 0.75, r * 0.08, 8, 24), M.red, 0, r * 2.9, r * 1.1, g); hw.rotation.y = 0;
  }
  if (axis === "z") g.rotation.y = Math.PI / 2;
  return g;
}

// fence around rectangle [x0,x1]x[z0,z1] at height 0 (local), with a gate gap on +z side
function fence(parent, x0, x1, z0, z1, h = 2.4, gate = null) {
  const posts = [];
  const side = (ax, az, bx, bz) => {
    const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 3));
    const pan = mesh(new THREE.PlaneGeometry(L, h), M.fence, (ax + bx) / 2, h / 2, (az + bz) / 2, parent, false);
    pan.rotation.y = -Math.atan2(bz - az, bx - ax);
    M.fence.map.repeat.set(1, 1);
    const tex = pan.material.map; pan.geometry.attributes.uv.array.forEach((v, i, a) => { a[i] = i % 2 === 0 ? v * L / 1.2 : v * h / 1.2; });
    pipeBetween([ax, h, az], [bx, h, bz], 0.03, M.galv, parent, 6);
    for (let i = 0; i <= n; i++) posts.push([ax + (bx - ax) * i / n, az + (bz - az) * i / n]);
    return tex;
  };
  if (gate) { side(x0, z1, gate[0], z1); side(gate[1], z1, x1, z1); } else side(x0, z1, x1, z1);
  side(x0, z0, x1, z0); side(x0, z0, x0, z1); side(x1, z0, x1, z1);
  const pg = cyl(0.045, h + 0.3, 6);
  const inst = new THREE.InstancedMesh(pg, M.galv, posts.length);
  posts.forEach(([x, z], i) => inst.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, (h + 0.3) / 2, z)));
  inst.castShadow = true; parent.add(inst);
}

// ---------- compressor station (local frame: x along flow, y up, z lateral; pad top y = 0; mainline at y = PIPE_Y) ----------
export const STATION = { x0: -92, x1: 92, z0: -58, z1: 62, PIPE_Y: 1.3 };
function buildStation(name) {
  const g = new THREE.Group(); g.name = name;
  const { x0, x1, z0, z1, PIPE_Y } = STATION;
  const pad = mesh(box(x1 - x0 + 8, 0.6, z1 - z0 + 8), M.gravel, 0, -0.28, (z0 + z1) / 2, g, false);
  pad.receiveShadow = true;
  fence(g, x0, x1, z0, z1, 2.4, [40, 52]);
  // access road
  mesh(box(10, 0.1, 40), M.asphalt, 46, 0.03, z1 + 20, g, false);

  // compressor building straddling the mainline
  const B = new THREE.Group(); g.add(B);
  const bw = 44, bd = 22, bh = 10.5;
  mesh(box(bw + 1, 0.4, bd + 1), M.concrete, 0, 0.2, 0, B);
  const walls = {};
  walls.back = mesh(box(bw, bh, 0.3), M.siding, 0, bh / 2, -bd / 2, B);
  walls.front = mesh(box(bw, bh, 0.3), M.siding, 0, bh / 2, bd / 2, B);
  walls.left = mesh(box(0.3, bh, bd), M.siding, -bw / 2, bh / 2, 0, B);
  walls.right = mesh(box(0.3, bh, bd), M.siding, bw / 2, bh / 2, 0, B);
  const roof = new THREE.Group(); B.add(roof);
  for (const s of [-1, 1]) { const r = mesh(box(bw + 1.2, 0.25, bd / 2 + 0.9), M.roof, 0, bh + 0.75, s * (bd / 4 + 0.2), roof); r.rotation.x = s * 0.13; }
  mesh(box(bw + 1.3, 0.5, 0.5), M.trim, 0, bh + 1.3, 0, roof);
  for (const s of [-1, 1]) mesh(box(bw + 0.6, 0.35, 0.35), M.trim, 0, bh, s * bd / 2, roof);
  // doors & louvers on the front (+z) wall
  const front = new THREE.Group(); B.add(front);
  for (const dx of [-14, 0, 14]) mesh(box(5, 6, 0.12), M.door, dx, 3, bd / 2 + 0.2, front);
  for (const dx of [-7, 7, -20, 20]) mesh(box(3, 1.8, 0.12), M.louver, dx, 7.6, bd / 2 + 0.2, front);
  mesh(box(1.1, 2.3, 0.12), M.trim, 20.5, 1.15, bd / 2 + 0.2, front);
  // roof equipment: turbine exhaust stacks with silencers, air-intake filter houses
  const stacks = [];
  for (const [i, dx] of [-13, 0, 13].entries()) {
    mesh(rbox(4.2, 3.2, 4.2, 0.1), M.galv, dx, bh + 2.6, -5.5, roof);
    const st = mesh(cyl(1.15, 9, 28), M.stack, dx, bh + 8.2, -5.5, roof);
    mesh(cyl(1.35, 0.4, 28), M.darkSteel, dx, bh + 12.8, -5.5, roof);
    stacks.push(new THREE.Vector3(dx, bh + 13.2, -5.5));
    mesh(rbox(5, 3.6, 3.2, 0.1), M.siding, dx, bh + 2.9, 5, roof);
    mesh(box(5.1, 2.6, 0.15), M.louver, dx, bh + 2.9, 6.7, roof);
  }
  // three turbine-compressor packages inside (visible in cutaway)
  const units = [];
  for (const [i, dz] of [-6.5, 0, 6.5].entries()) {
    const u = new THREE.Group(); u.position.set(0, 0.4, dz); B.add(u);
    mesh(box(22, 0.6, 3.6), M.darkSteel, 0, 0.3, 0, u);
    mesh(rbox(11, 3.3, 3.2, 0.12), M.turbine, -4.5, 2.25, 0, u);            // gas turbine enclosure
    mesh(box(2.2, 0.5, 3.4), M.trim, -4.5, 4.05, 0, u);
    const shaft = mesh(cyl(0.35, 3, 12), M.steel, 2.6, 1.9, 0, u); shaft.rotation.z = Math.PI / 2;
    const cc = mesh(cyl(1.25, 3.8, 28), M.compBlue, 6.2, 1.9, 0, u); cc.rotation.z = Math.PI / 2;   // centrifugal compressor barrel
    mesh(cyl(0.45, 2.2, 16), M.compBlue, 6.2, 3.6, 0, u);
    const led = mesh(new THREE.SphereGeometry(0.28, 12, 8), M.ledGreen.clone(), -9.5, 4.2, 0, u, false);
    const ring = mesh(new THREE.TorusGeometry(0.5, 0.12, 8, 20), M.steel, 2.6, 1.9, 0, u); ring.rotation.y = Math.PI / 2;
    units.push({ group: u, led, ring });
  }
  // station piping inside the building: suction line overhead to a header over the compressor
  // nozzles, discharge header at floor level back to the mainline. Materials are tinted with the
  // live suction / discharge pressure by the page.
  const sucMat = M.galv.clone(), disMat = M.galv.clone();
  for (const m of [sucMat, disMat]) { m.metalness = 0.35; m.roughness = 0.42; }
  elbowPath([[-bw / 2 - 1, PIPE_Y, 0], [-bw / 2 + 1.5, PIPE_Y, 0], [-bw / 2 + 1.5, 7.4, 0], [6.6, 7.4, 0]], PIPE_R * 0.9, sucMat, B);
  pipeBetween([6.6, 7.4, -6.9], [6.6, 7.4, 6.9], PIPE_R * 0.8, sucMat, B);
  for (const dz of [-6.5, 0, 6.5]) pipeBetween([6.6, 7.4, dz], [6.6, 4.3, dz], 0.3, sucMat, B);
  for (const dz of [-6.5, 0, 6.5]) elbowPath([[8.4, 2.3, dz], [10.6, 2.3, dz], [10.6, PIPE_Y, dz]], 0.3, disMat, B);
  pipeBetween([10.6, PIPE_Y, -6.9], [10.6, PIPE_Y, 6.9], PIPE_R * 0.8, disMat, B);
  elbowPath([[10.6, PIPE_Y, 0], [bw / 2 + 1, PIPE_Y, 0]], PIPE_R * 0.9, disMat, B);
  // suction scrubbers (vertical separators) upstream of the building
  for (const dz of [-14, 14]) {
    const v = new THREE.Group(); v.position.set(-50, 0, dz); g.add(v);
    mesh(cyl(1.4, 8, 32), M.vessel, 0, 5.2, 0, v);
    mesh(new THREE.SphereGeometry(1.4, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.vessel, 0, 9.2, 0, v).scale.y = 0.5;
    mesh(new THREE.SphereGeometry(1.4, 32, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.vessel, 0, 1.2, 0, v).scale.y = 0.5;
    for (let a = 0; a < 4; a++) mesh(cyl(0.12, 1.2, 8), M.darkSteel, Math.cos(a * Math.PI / 2 + 0.78) * 1.1, 0.6, Math.sin(a * Math.PI / 2 + 0.78) * 1.1, v);
    for (let y = 1; y < 9.5; y += 0.4) mesh(box(0.5, 0.04, 0.04), M.yellow, 1.62, y, 0, v, false);   // ladder rungs
    for (const s of [-1, 1]) pipeBetween([1.55, 0.6, s * 0.28], [1.55, 9.6, s * 0.28], 0.03, M.yellow, v, 6);
    // inlet from mainline, outlet to suction header
    elbowPath([[0, 7, 0], [0, 7, -Math.sign(dz) * 3], [0, PIPE_Y, -Math.sign(dz) * 3], [0, PIPE_Y, -dz + Math.sign(dz) * 0.5]].map(([x, y, z]) => [x, y, z]), 0.28, M.galv, v);
    flangeValve(v, 0, PIPE_Y, -Math.sign(dz) * 6, 0.28, "z", true);
    elbowPath([[1.4, 2.4, 0], [6, 2.4, 0], [6, PIPE_Y + 1.6, 0], [26, PIPE_Y + 1.6, 0], [26, PIPE_Y + 1.6, -dz * 0.45]], 0.24, M.galv, v);
  }
  // suction & discharge station valves on the mainline (yellow gear operators)
  flangeValve(g, -70, PIPE_Y, 0, PIPE_R, "x", true);
  flangeValve(g, 72, PIPE_Y, 0, PIPE_R, "x", true);
  // station bypass with closed mainline block valve
  elbowPath([[-82, -1.2, 0], [-82, PIPE_Y, 0.01], [-82, PIPE_Y, 34], [82, PIPE_Y, 34], [82, PIPE_Y, 0.01], [82, -1.2, 0]].slice(1, 5), PIPE_R * 0.92, M.galv, g);
  for (const xx of [-82, 82]) mesh(new THREE.SphereGeometry(PIPE_R, 16, 10), M.galv, xx, PIPE_Y, 0, g);
  flangeValve(g, 0, PIPE_Y, 34, PIPE_R, "x", true);
  mesh(box(1.4, 0.4, 0.8), M.red, 0, PIPE_Y + 2.3, 34, g, false);       // closed tag
  // pig launcher/receiver barrels
  for (const [xx, zz] of [[-76, 22], [76, 22]]) {
    const pg = mesh(cyl(0.65, 9, 24), M.galv, xx, PIPE_Y, zz, g); pg.rotation.x = Math.PI / 2;
    mesh(cyl(0.85, 0.5, 24), M.darkSteel, xx, PIPE_Y, zz + Math.sign(zz) * 4.6, g).rotation.x = Math.PI / 2;
    pipeBetween([xx, PIPE_Y, zz - 4.5], [xx, PIPE_Y, 34], 0.3, M.galv, g);
  }
  // aerial gas coolers (fin-fan) downstream of the building
  const fans = [];
  const C = new THREE.Group(); C.position.set(48, 0, -32); g.add(C);
  for (const cx of [-12, 0, 12]) for (const cz of [-5, 5]) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(box(0.35, 7, 0.35), M.darkSteel, cx + sx * 5.6, 3.5, cz + sz * 4.6, C);
  }
  mesh(box(36, 1.1, 20), M.coolerFin, 0, 7.6, 0, C);                       // tube bundles
  mesh(box(36.4, 0.4, 20.4), M.darkSteel, 0, 7.0, 0, C);
  for (const cx of [-12, 0, 12]) for (const cz of [-5, 5]) {
    mesh(cyl(4.1, 1.6, 40, 4.1).translate(0, 0, 0), M.galv, cx, 9.0, cz, C);
    const fan = new THREE.Group(); fan.position.set(cx, 8.7, cz); C.add(fan);
    for (let b = 0; b < 4; b++) { const bl = mesh(box(3.8, 0.06, 0.55), M.fanBlade, 0, 0, 0, fan, false); bl.rotation.y = b * Math.PI / 4 * 2 / 2 * 2; bl.position.set(Math.cos(b * Math.PI / 2) * 1.95, 0, Math.sin(b * Math.PI / 2) * 1.95); bl.rotation.y = -b * Math.PI / 2; bl.rotation.x = 0.25; }
    mesh(cyl(0.45, 0.6, 16), M.darkSteel, 0, 0, 0, fan, false);
    fans.push(fan);
  }
  // headers between mainline and coolers
  elbowPath([[30, PIPE_Y, -0.8], [30, PIPE_Y, -14], [34, PIPE_Y + 6.4, -22], [34, 7.6, -27]], 0.42, M.galv, g);
  elbowPath([[66, 7.6, -27], [66, PIPE_Y + 3, -16], [66, PIPE_Y, -0.8]], 0.42, M.galv, g);
  elbowPath([[-26, PIPE_Y, 0.8], [-26, PIPE_Y, 8], [-22.5, PIPE_Y, 8]], 0.34, M.galv, g);
  elbowPath([[22.5, PIPE_Y, -8], [26, PIPE_Y, -8], [26, PIPE_Y, -0.8]], 0.34, M.galv, g);
  // blowdown vent stack, fuel-gas skid, control building, lights, sign
  pipeBetween([-62, 0, -46], [-62, 16, -46], 0.32, M.stack, g);
  for (let y = 4; y < 16; y += 5) for (let a = 0; a < 3; a++) pipeBetween([-62, y, -46], [-62 + Math.cos(a * 2.1) * 4, 0, -46 + Math.sin(a * 2.1) * 4], 0.02, M.galv, g, 4);
  elbowPath([[-62, 0.6, -46], [-62, 0.6, -24], [-40, 0.6, -24]], 0.16, M.galv, g);
  const fg = mesh(rbox(7, 2.2, 3, 0.12), M.vessel, -30, 1.1, -42, g);
  mesh(cyl(0.5, 3.8, 16), M.vessel, -34, 1.9, -42, g).rotation.z = Math.PI / 2;
  const cb = new THREE.Group(); cb.position.set(64, 0, 44); g.add(cb);
  mesh(rbox(14, 4, 9, 0.08), M.wallWarm, 0, 2, 0, cb);
  mesh(rbox(14.6, 0.35, 9.6, 0.06), M.roof, 0, 4.15, 0, cb);
  for (const dx of [-4, 0, 4]) { mesh(box(1.8, 1.1, 0.1), M.glass, dx, 2.4, 4.52, cb, false); mesh(box(2.0, 0.08, 0.2), M.concrete, dx, 1.8, 4.55, cb, false); }
  mesh(box(1.0, 2.15, 0.08), M.door, 5.6, 1.08, 4.52, cb, false);
  mesh(box(1.6, 0.12, 1.4), M.concrete, 5.6, 0.06, 5.2, cb);
  pickup(cb, -2, 9.5, 0.04);
  const sign = mesh(new THREE.PlaneGeometry(5.2, 0.98), new THREE.MeshStandardMaterial({ map: signTex(`${name} CONTROL`, "Compressor station · authorized only"), roughness: 0.6 }), 1.5, 3.35, 4.53, cb, false);
  mesh(box(2, 0.2, 2.6), M.galv, 3.5, 4.5, -1.5, cb);
  mesh(cyl(0.05, 9, 6), M.galv, -6, 4.5, -3, cb);           // radio mast
  for (const [lx, lz] of [[x0 + 3, z0 + 3], [x1 - 3, z0 + 3], [x0 + 3, z1 - 3], [x1 - 3, z1 - 3], [0, z1 - 3], [0, z0 + 3]]) {
    pipeBetween([lx, 0, lz], [lx, 10, lz], 0.1, M.galv, g, 8);
    mesh(box(1.2, 0.25, 0.5), M.lamp, lx, 10, lz, g, false);
  }
  // pipe supports along the mainline in the yard
  const sup = [];
  for (let x = x0 + 4; x <= x1 - 4; x += 6) if (Math.abs(x) > bw / 2 + 1) sup.push(x);
  const sg = box(0.7, PIPE_Y - PIPE_R, 1.4);
  const si = new THREE.InstancedMesh(sg, M.concrete, sup.length);
  sup.forEach((x, i) => si.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, (PIPE_Y - PIPE_R) / 2, 0)));
  si.castShadow = si.receiveShadow = true; g.add(si);
  const sad = new THREE.InstancedMesh(box(0.5, 0.12, PIPE_R * 2.3), M.darkSteel, sup.length);
  sup.forEach((x, i) => sad.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, PIPE_Y - PIPE_R - 0.04, 0)));
  sad.castShadow = sad.receiveShadow = true; g.add(sad);
  for (const xx of [-86, -60, -34, 34, 58, 84]) flangeJoint(g, xx, PIPE_Y, 0, PIPE_R);
  // cooler platform: grating walkway, guard rail and caged ladder
  mesh(box(37, 0.06, 1.2), M.grating, 48, 7.2, -32 + 10.8, g, false);
  handrail(g, [[48 - 18.5, -32 + 11.4], [48 + 18.5, -32 + 11.4]], 7.2);
  ladder(g, 48 + 18.9, -32 + 10.8, 0, 7.2, 0);
  // roof guard rail on the compressor building
  handrail(B, [[-bw / 2 + 0.4, -bd / 2 + 0.4], [bw / 2 - 0.4, -bd / 2 + 0.4]], bh + 0.1);
  ladder(B, -bw / 2 - 0.45, -bd / 2 + 3, 0, bh, Math.PI);
  // pressure gauges on the scrubbers' outlets
  for (const dz of [-14, 14]) { const gg = mesh(cyl(0.16, 0.06, 24), M.galv, -48.4, 2.9, dz, g, false); gg.rotation.z = Math.PI / 2; mesh(cyl(0.13, 0.065, 24), M.hat, -48.38, 2.9, dz, g, false).rotation.z = Math.PI / 2; }
  // concrete pads under skids and vessels
  for (const dz of [-14, 14]) mesh(rbox(5.2, 0.3, 5.2, 0.05), M.concrete, -50, 0.12, dz, g);
  mesh(rbox(9, 0.3, 5, 0.05), M.concrete, -30, 0.12, -42, g);
  mesh(rbox(38, 0.25, 22, 0.05), M.concrete, 48, 0.1, -32, g);
  for (const xx of [-76, 76]) mesh(rbox(3, 0.25, 11, 0.05), M.concrete, xx, 0.1, 22, g);
  // scrubber top platforms with guard rails; the existing rungs are the ladders up to them
  for (const dz of [-14, 14]) {
    mesh(cyl(2.3, 0.08, 32), M.grating, -50, 10.0, dz, g, false);
    const ring = []; for (let k = 0; k <= 16; k++) { const a = k / 16 * Math.PI * 2; ring.push([-50 + Math.cos(a) * 2.25, dz + Math.sin(a) * 2.25]); }
    handrail(g, ring, 10.04);
  }
  // tire tracks on the gravel: gate -> control building, and the service lane through the yard
  const curve = []; for (let k = 0; k <= 24; k++) { const t = k / 24; curve.push([46 + (60 - 46) * t * t, 66 - (66 - 51) * t]); }
  g.add(ribbon(curve, 2.2, trackMat, () => 0.045, 6));
  const lane = []; for (let x = 44; x >= -70; x -= 4) lane.push([x, 47 + Math.sin(x / 23) * 0.6]);
  g.add(ribbon(lane, 2.2, trackMat, () => 0.045, 6));
  // people: operators doing rounds, true size. Part W: a mixed crew at every station (2 women, 3 men);
  // the woman in the pair is the one pointing out the equipment. Skin, hair and height vary from station to station.
  { const k = [...name].reduce((a, ch) => a + ch.charCodeAt(0), 0), pick = (arr, i) => arr[(k + i) % arr.length];
    const crew = [
      { x: -44, z: 18, r: -0.6, pose: 1, woman: false, h: 1.02 }, { x: -45.2, z: 17.2, r: 0.9, pose: 2, woman: true, h: 0.95 },
      { x: 24, z: 13, r: 2.4, pose: 1, woman: true, h: 0.97 }, { x: 60, z: 39, r: 1.6, pose: 0, woman: false, h: 0.99 }, { x: 40, z: -20, r: -1.2, pose: 1, woman: false, h: 1.04 }];
    crew.forEach((c, i) => worker(g, c.x, c.z, c.r, c.pose, { woman: c.woman, h: c.h, skin: pick(M.skins, i * 2), hair: pick(M.hairs, i * 3 + 1) })); }
  return { group: g, fans, stacks, units, roof, walls, frontDetail: front, building: B, sucMat, disMat };
}

// ---------- valve site ----------
function buildValveSite() {
  const g = new THREE.Group();
  mesh(box(30, 0.5, 18), M.gravel, 0, -0.22, 0, g, false);
  fence(g, -14, 14, -8, 8, 2.2, [6, 10]);
  flangeValve(g, 0, 1.0, 0, PIPE_R, "x", true);
  for (const s of [-1, 1]) {
    elbowPath([[s * 3.5, 1.0, 0], [s * 3.5, 1.0, -2.4], [s * 3.5, 3.4, -2.4]], 0.14, M.galv, g);
    flangeValve(g, s * 3.5, 2.6, -2.4, 0.14, "x", false);
    mesh(cyl(0.14, 0.3, 10).rotateX(0), M.galv, s * 3.5, 3.6, -2.4, g);
  }
  mesh(box(0.9, 1.4, 0.5), M.vessel, 9, 0.7, -5, g);               // RTU cabinet
  const sp = mesh(box(1.6, 0.05, 1.0), new THREE.MeshStandardMaterial({ color: "#1d2a44", roughness: 0.2, metalness: 0.6 }), 9, 2.5, -5, g, false); sp.rotation.x = -0.6;
  pipeBetween([9, 0, -5.4], [9, 2.4, -5.4], 0.05, M.galv, g, 6);
  for (const x of [-9, -5, 5, 9]) mesh(box(0.6, 0.55, 1.2), M.concrete, x, 0.27, 0, g);
  return g;
}

// ---------- supply / processing plant (n1) ----------
function buildSupplyPlant() {
  const g = new THREE.Group();
  mesh(box(220, 0.6, 170), M.gravel, -40, -0.28, 0, g, false);
  fence(g, -150, 70, -85, 85, 2.6, [20, 34]);
  for (const [x, z, r, h] of [[-110, -40, 2.2, 34], [-100, -40, 1.6, 26], [-90, -40, 1.8, 30]]) {
    mesh(cyl(r, h, 32), M.vessel, x, h / 2, z, g);
    for (let y = 6; y < h; y += 6) mesh(new THREE.TorusGeometry(r + 0.4, 0.08, 6, 32).rotateX(Math.PI / 2), M.yellow, x, y, z, g, false);
  }
  for (const [x, z] of [[-115, 30], [-80, 30], [-45, 30]]) { mesh(cyl(11, 12, 48), M.vessel, x, 6, z, g); mesh(cyl(11.2, 0.6, 48, 3), M.vessel, x, 12.3, z, g); }
  for (let i = 0; i < 8; i++) { const p = mesh(cyl(0.7, 60, 18), M.galv, -40 + i * 3, 1.2, -60, g); p.rotation.z = Math.PI / 2; }   // slug catcher
  mesh(box(30, 9, 18), M.siding, -10, 4.5, 50, g); mesh(box(31, 0.4, 19), M.roof, -10, 9.2, 50, g);
  pipeBetween([-135, 0, 70], [-135, 55, 70], 0.5, M.stack, g);   // flare stack
  for (let a = 0; a < 3; a++) pipeBetween([-135, 40, 70], [-135 + Math.cos(a * 2.1) * 14, 0, 70 + Math.sin(a * 2.1) * 14], 0.05, M.galv, g, 4);
  // export meter run feeding the mainline (mainline leaves along +x at y = 1.2)
  for (const dz of [-3, 0, 3]) pipeBetween([-10, 1.2, dz], [40, 1.2, dz], 0.32, M.galv, g);
  pipeBetween([40, 1.2, -3], [40, 1.2, 3], 0.4, M.galv, g);
  pipeBetween([40, 1.2, 0], [70, 1.2, 0], PIPE_R, M.galv, g);
  mesh(box(8, 3.5, 12), M.wallWarm, 15, 1.75, 12, g);
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex("#ffb347"), color: "#ffcf7a", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  flame.position.set(-135, 58, 70); flame.scale.set(6, 9, 1); g.add(flame);
  return { group: g, flame };
}

// ---------- delivery (n13): Metro city gate; the skyline is built by buildSkyline ----------
function buildDelivery() {
  const g = new THREE.Group();
  mesh(box(160, 0.6, 120), M.gravel, 30, -0.28, -10, g, false);
  fence(g, -55, 110, -70, 50, 2.6, [60, 74]);
  pipeBetween([-60, 1.2, 0], [0, 1.2, 0], PIPE_R, M.galv, g);
  // city gate: three regulator / meter runs, line heater, odorant, control house
  for (const dz of [-4, 0, 4]) { pipeBetween([0, 1.2, dz], [30, 1.2, dz], 0.3, M.galv, g); flangeValve(g, 15, 1.2, dz, 0.3, "x", true); }
  pipeBetween([0, 1.2, -4], [0, 1.2, 4], 0.4, M.galv, g); pipeBetween([30, 1.2, -4], [30, 1.2, 4], 0.4, M.galv, g);
  mesh(box(10, 3.5, 7), M.wallWarm, 15, 1.75, -14, g);
  const htr = mesh(cyl(1.6, 9, 24), M.vessel, 45, 2.2, -16, g); htr.rotation.z = Math.PI / 2;
  pipeBetween([45, 4.0, -16], [45, 9, -16], 0.3, M.stack, g);
  mesh(cyl(0.9, 2.2, 16), M.vessel, 60, 1.1, 14, g);
  // distribution mains leave the gate toward the city (side -z of the route at the end of the line)
  for (const dz of [-3, 3]) pipeBetween([30, 1.2, dz], [30, 1.2, -60], 0.35, M.galv, g);
  return { group: g, stacks: [] };
}

// ---------- customer sites (local frame: +z away from the pipeline, the lateral arrives at z = -110) ----------
const winTex = canvasTex(64, 128, (g, W, H) => {
  g.fillStyle = "#1a1d20"; g.fillRect(0, 0, W, H);
  for (let y = 4; y < H; y += 10) for (let x = 4; x < W; x += 10) { g.fillStyle = Math.random() < 0.55 ? "#ffd98a" : "#2a2f35"; g.fillRect(x, y, 6, 6); }
}, [1, 1]);
function gateSkid(g, z0 = -100) {        // pressure regulation and metering at the site entrance
  pipeBetween([0, 1.0, z0 - 10], [0, 1.0, z0 + 12], 0.25, M.galv, g);
  for (const dx of [-2, 2]) { pipeBetween([dx, 1.0, z0 - 3], [dx, 1.0, z0 + 6], 0.2, M.galv, g); flangeValve(g, dx, 1.0, z0 + 1.5, 0.2, "z", true); }
  pipeBetween([-2, 1.0, z0 - 3], [2, 1.0, z0 - 3], 0.25, M.galv, g); pipeBetween([-2, 1.0, z0 + 6], [2, 1.0, z0 + 6], 0.25, M.galv, g);
  mesh(box(5, 3, 4), M.wallWarm, 6, 1.5, z0, g);
  mesh(box(20, 0.4, 26), M.gravel, 0, -0.1, z0 + 1, g, false);
}
function lattice(g, x, z, h) {           // simple transmission tower
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) pipeBetween([x + a * 2.4, 0, z + b * 2.4], [x + a * 0.6, h, z + b * 0.6], 0.12, M.galv, g, 5);
  pipeBetween([x - 7, h * 0.85, z], [x + 7, h * 0.85, z], 0.15, M.galv, g, 5); pipeBetween([x - 5, h * 0.65, z], [x + 5, h * 0.65, z], 0.15, M.galv, g, 5);
}
const SITE_BUILDERS = {
  town(st) {
    const g = new THREE.Group(); gateSkid(g, -300);
    pipeBetween([0, 0.2, -290], [0, 0.2, -60], 0.2, M.yellow, g);   // distribution main, shown at grade
    const glow = new THREE.MeshStandardMaterial({ color: "#d8cfbf", roughness: 0.85, emissive: "#ffcf80", emissiveIntensity: 0 });
    // a small centre: shops, school, water tower
    for (const [x, z, w, h, d] of [[0, 0, 40, 9, 24], [55, 20, 30, 7, 30], [-50, -10, 34, 12, 22], [10, 70, 60, 8, 30]]) mesh(box(w, h, d), glow, x, h / 2, z, g);
    mesh(cyl(1.2, 30, 12), M.galv, -90, 15, 60, g); mesh(new THREE.SphereGeometry(7, 20, 12), M.vessel, -90, 32, 60, g);
    return { group: g, glow, houses: Math.min(520, Math.round(st.homes / 300)), houseR: [120, 560] };
  },
  ccgt(st) {
    const g = new THREE.Group(); gateSkid(g);
    mesh(box(200, 0.5, 170), M.gravel, 0, -0.2, 20, g, false); fence(g, -100, 100, -70, 105, 2.6, [-10, 6]);
    mesh(box(64, 26, 30), M.siding, -20, 13, 10, g); mesh(box(65, 0.6, 31), M.roof, -20, 26.3, 10, g);       // turbine hall (GT + ST)
    const stacks = [];
    for (const dx of [-36, -4]) { mesh(box(14, 24, 32), M.vessel, dx, 12, 44, g); mesh(cyl(3, 52, 32), M.stack, dx, 26, 64, g); stacks.push(new THREE.Vector3(dx, 53, 64)); }
    // air-cooled condenser on legs with fans
    for (let k = 0; k < 5; k++) for (const sz of [-1, 1]) pipeBetween([40 + k * 10, 0, 10 + sz * 9], [40 + k * 10, 18, 10 + sz * 9], 0.5, M.darkSteel, g, 8);
    mesh(box(50, 1.5, 22), M.galv, 60, 18.5, 10, g);
    for (let k = 0; k < 5; k++) { const a = mesh(box(9.8, 9, 0.3), M.coolerFin, 60 - 20 + k * 10, 23.5, 4, g); a.rotation.x = 0.55; const b2 = mesh(box(9.8, 9, 0.3), M.coolerFin, 60 - 20 + k * 10, 23.5, 16, g); b2.rotation.x = -0.55; }
    for (let k = 0; k < 4; k++) mesh(box(9, 8, 7), M.galv, -70, 4, -30 + k * 14, g);                       // step-up transformers
    for (let k = 0; k < 4; k++) lattice(g, -110 - k * 110, -20, 38);
    return { group: g, stacks };
  },
  peaker(st) {
    const g = new THREE.Group(); gateSkid(g);
    mesh(box(130, 0.5, 120), M.gravel, 0, -0.2, 0, g, false); fence(g, -65, 65, -60, 60, 2.6, [-8, 8]);
    const stacks = [];
    for (const dx of [-22, 22]) {
      mesh(box(24, 6, 7), M.turbine, dx, 3, 0, g);                       // gas turbine package
      mesh(box(8, 8, 9), M.galv, dx - 15, 6, 0, g);                       // inlet filter house
      mesh(cyl(2.6, 22, 24), M.stack, dx + 14, 11, 0, g); stacks.push(new THREE.Vector3(dx + 14, 22.5, 0));
      mesh(box(7, 6, 5), M.galv, dx, 3, 22, g);                           // generator step-up transformer
    }
    mesh(box(16, 5, 10), M.wallWarm, 0, 2.5, -35, g);
    for (let k = 0; k < 3; k++) lattice(g, 0, 90 + k * 120, 32);
    return { group: g, stacks };
  },
  ammonia(st) {
    const g = new THREE.Group(); gateSkid(g, -130);
    mesh(box(260, 0.5, 220), M.gravel, 0, -0.2, 20, g, false); fence(g, -130, 130, -90, 130, 2.6, [-10, 6]);
    // primary reformer: radiant box with catalyst tube rows, convection section and stack
    mesh(box(46, 20, 22), M.vessel, -60, 10, 0, g); mesh(box(46, 0.6, 23), M.roof, -60, 20.3, 0, g);
    for (let k = 0; k < 10; k++) mesh(cyl(0.25, 4, 8), M.steel, -80 + k * 4.4, 22, 0, g);
    mesh(box(14, 26, 14), M.galv, -28, 13, 0, g);
    const stacks = []; mesh(cyl(2.4, 62, 24), M.stack, -14, 31, 0, g); stacks.push(new THREE.Vector3(-14, 63, 0));
    mesh(cyl(2.6, 26, 24), M.vessel, 0, 13, 30, g);                            // secondary reformer
    mesh(cyl(2.6, 44, 24), M.vessel, 25, 22, 30, g); mesh(cyl(2.1, 38, 24), M.vessel, 38, 19, 30, g);   // CO2 absorber / stripper
    mesh(cyl(1.9, 28, 24), M.vessel, 60, 14, 0, g);                            // ammonia converter
    mesh(box(30, 12, 18), M.siding, 60, 6, -40, g);                            // syngas compressor house
    for (const dx of [95, 118]) mesh(new THREE.SphereGeometry(9, 28, 18), M.vessel, dx, 11, 60, g);    // NH3 storage spheres
    for (let k = 0; k < 3; k++) { mesh(box(14, 12, 14), M.wallWarm, -60 + k * 15, 6, 80, g); mesh(cyl(4.5, 4, 20), M.galv, -60 + k * 15, 14, 80, g); }   // cooling tower cells
    pipeBetween([110, 0, -60], [110, 70, -60], 0.6, M.stack, g);
    for (const z of [-15, -12]) pipeBetween([-40, 8, z], [80, 8, z], 0.5, M.galv, g);    // pipe rack
    return { group: g, stacks };
  },
  dairy(st) {
    const g = new THREE.Group(); gateSkid(g);
    mesh(box(170, 0.5, 130), M.gravel, 0, -0.2, 20, g, false);
    mesh(box(90, 12, 50), new THREE.MeshStandardMaterial({ color: "#f3f1ec", roughness: 0.6 }), 0, 6, 25, g);
    mesh(box(91, 0.6, 51), new THREE.MeshStandardMaterial({ color: "#c5050c", roughness: 0.55 }), 0, 12.3, 25, g);
    for (let k = 0; k < 4; k++) mesh(cyl(2.6, 18, 24), M.galv, -38 + k * 7, 9, -12, g);    // milk silos
    mesh(box(16, 9, 12), M.siding, 55, 4.5, 0, g); const stacks = []; mesh(cyl(1.0, 24, 16), M.stack, 60, 12, 0, g); stacks.push(new THREE.Vector3(60, 24.5, 0));
    for (let k = 0; k < 3; k++) mesh(box(8, 2.5, 4), M.coolerFin, -20 + k * 12, 13.8, 30, g);   // ammonia refrigeration condensers
    for (let k = 0; k < 3; k++) { mesh(box(13, 3.5, 2.6), new THREE.MeshStandardMaterial({ color: "#e8e8e8" }), 20 + k * 6, 2.2, 60, g).rotation.y = Math.PI / 2; }
    return { group: g, stacks };
  },
};
const ROOFS = ["#5b5f63", "#6e6259", "#7a4a3a", "#45484d", "#8a6a50", "#5e3b30", "#6b6f72", "#844d3c"].map(c => new THREE.Color(c));
const WALLS = ["#f3efe6", "#e6e1d6", "#d9d6cf", "#ece4d4", "#d5dbe0", "#e9dfcf", "#c9c3b8"].map(c => new THREE.Color(c));
const streetMat = new THREE.MeshStandardMaterial({ color: "#7c7f82", roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1 });
export const yardMat = new THREE.MeshStandardMaterial({ color: "#6f8a4a", roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1 });
function placeHouses(scene, built, st, heightAt, rowAt) {
  const tr = mulberry(st.node * 97 + 3), houses = [];
  for (let t = 0; t < 20000 && houses.length < built.houses; t++) {
    const r = built.houseR[0] + Math.sqrt(tr()) * (built.houseR[1] - built.houseR[0]), a = tr() * Math.PI * 2;
    const x = st.x + Math.cos(a) * r, z = st.z + Math.sin(a) * r;
    if (rowAt(x, z) < 40) continue;
    // streets on a loose grid
    const gx = ((x - st.x) % 46 + 46) % 46, gz = ((z - st.z) % 34 + 34) % 34; if (gx < 8 || gz < 6) continue;
    houses.push([st.x + Math.round((x - st.x) / 23) * 23 + 4, z, tr()]);
  }
  const roofMat = M.roofRed.clone(); roofMat.color.set("#ffffff"); roofMat.roughness = 0.75;
  const wallMat = built.glow; wallMat.color.set("#f4f1ea");   // shared, so the evening window glow still follows demand
  const hb = new THREE.InstancedMesh(rbox(9, 5, 7, 0.12).translate(0, 2.5, 0), wallMat, houses.length);
  const hr = new THREE.InstancedMesh(new THREE.ConeGeometry(6.9, 3, 4).rotateY(Math.PI / 4).scale(1, 1, 0.8).translate(0, 6.5, 0), roofMat, houses.length);
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), p4 = new THREE.Vector3(), s4 = new THREE.Vector3(1, 1, 1), Y = new THREE.Vector3(0, 1, 0);
  const trees = [], yards = [];
  houses.forEach(([x, z, r], j) => {
    const big = tr() < 0.035, rot = st.rot + (r > 0.5 ? 0 : Math.PI / 2) + (tr() - 0.5) * 0.25;
    const sx = big ? 2.6 + tr() : 0.8 + tr() * 0.55, sy = big ? 1.4 + tr() * 0.4 : (tr() < 0.35 ? 1.25 : 0.9 + tr() * 0.15), sz = big ? 2.0 + tr() * 0.6 : 0.8 + tr() * 0.5;
    q4.setFromAxisAngle(Y, rot); const y = heightAt(x, z);
    m4.compose(p4.set(x, y, z), q4, s4.set(sx, sy, sz)); hb.setMatrixAt(j, m4);
    m4.compose(p4.set(x, y + (big ? 0 : 0), z), q4, big ? s4.set(0, 0, 0) : s4.set(sx, sy, sz)); hr.setMatrixAt(j, m4);
    hb.setColorAt(j, WALLS[Math.floor(tr() * WALLS.length)]); hr.setColorAt(j, ROOFS[Math.floor(tr() * ROOFS.length)]);
    if (!big) { const nt = tr() < 0.7 ? 1 + Math.floor(tr() * 2) : 0; for (let k = 0; k < nt; k++) { const a = tr() * 6.28, d = 8 + tr() * 4; trees.push([x + Math.cos(a) * d, z + Math.sin(a) * d, 0.55 + tr() * 0.6]); } }
    if (!big && tr() < 0.5) yards.push([x, z, rot]);
  });
  hb.castShadow = hr.castShadow = true; hb.receiveShadow = hr.receiveShadow = true; scene.add(hb, hr);
  // garden trees among the houses
  const ballG = new THREE.IcosahedronGeometry(3.2, 1).translate(0, 5.6, 0), trunkG = cyl(0.25, 3, 6).translate(0, 1.5, 0);
  const tb = new THREE.InstancedMesh(ballG, M.broadleaf, trees.length), tt = new THREE.InstancedMesh(trunkG, M.trunk, trees.length), tc = new THREE.Color();
  trees.forEach(([x, z, sc], k) => { m4.compose(p4.set(x, heightAt(x, z), z), q4.setFromAxisAngle(Y, k), s4.set(sc, sc * (0.9 + 0.2 * ((k * 37) % 7) / 7), sc)); tb.setMatrixAt(k, m4); tt.setMatrixAt(k, m4); tb.setColorAt(k, tc.setHSL(0.2 + ((k * 13) % 9) / 100, 0.36, 0.26 + ((k * 7) % 10) / 100)); });
  tb.castShadow = tt.castShadow = true; tb.receiveShadow = true; scene.add(tb, tt);
  // mown back yards: slightly greener rectangles behind half of the houses
  const yg = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), ym = new THREE.InstancedMesh(yg, yardMat, yards.length);
  yards.forEach(([x, z, rot], k) => { m4.compose(p4.set(x, heightAt(x, z) + 0.06, z), q4.setFromAxisAngle(Y, rot), s4.set(18, 1, 14)); ym.setMatrixAt(k, m4); });
  ym.receiveShadow = true; scene.add(ym);
  // streets between the house columns and rows (every other gap), draped on the terrain
  const R = built.houseR[1] + 20, yAt = (x, z) => heightAt(x, z) + 0.12;
  const lay = (a0, a1, fixed, alongZ) => {
    let run = [];
    const flush = () => { if (run.length > 2) scene.add(ribbon(run, 7, streetMat, yAt, 20)); run = []; };
    for (let a = a0; a <= a1; a += 15) { const x = alongZ ? fixed : a, z = alongZ ? a : fixed; if (rowAt(x, z) < 36) { flush(); continue; } run.push([x, z]); }
    flush();
  };
  for (let k = -Math.ceil(R / 46); k <= Math.ceil(R / 46); k++) { const dx = 46 * k + 15.5; if (Math.abs(dx) >= R) continue; const h = Math.sqrt(R * R - dx * dx); lay(st.z - h, st.z + h, st.x + dx, true); }
  for (let k = -Math.ceil(R / 102); k <= Math.ceil(R / 102); k++) { const dz = 102 * k + 3; if (Math.abs(dz) >= R) continue; const h = Math.sqrt(R * R - dz * dz); lay(st.x - h, st.x + h, st.z + dz, false); }
  built.houseCount = houses.length;
}
function buildSkyline(group, heightAt, st) {
  // downtown towers about 1 km beyond the city gate, suburbs around them
  const scene = group.parent, tr = mulberry(1313);
  const cx = st.x + st.nx * 1050, cz = st.z + st.nz * 1050;
  const glow = new THREE.MeshStandardMaterial({ color: "#d9dde2", roughness: 0.35, metalness: 0.5, emissive: "#ffd98a", emissiveMap: winTex, emissiveIntensity: 0 });
  const n = 70, im = new THREE.InstancedMesh(box(1, 1, 1).translate(0, 0.5, 0), glow, n), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  for (let k = 0; k < n; k++) {
    const r = Math.sqrt(tr()) * 260, a = tr() * Math.PI * 2, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    const h = 25 + (1 - r / 260) * 140 * tr() + 15 * tr();
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), st.rot); m4.compose(p.set(x, heightAt(x, z), z), q, sc.set(22 + tr() * 20, h, 22 + tr() * 20)); im.setMatrixAt(k, m4);
  }
  im.castShadow = true; im.receiveShadow = true; scene.add(im);
  const built = { glow, houses: 520, houseR: [330, 900], skylineCenter: [cx, cz] };
  placeHouses(scene, built, { ...st, x: cx, z: cz }, heightAt, () => 99);
  return built;
}

export function glowTex(color) {
  return canvasTex(64, 64, (g, W, H) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, color); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, W, H); });
}
export const smokeTex = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(235,236,238,0.75)"); gr.addColorStop(0.6, "rgba(225,226,228,0.3)"); gr.addColorStop(1, "rgba(220,220,220,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });

// =====================================================================================
export function buildWorld(scene) {
  // ---- 1. route centreline (scene XZ) ----
  // a straight west-to-east line with gentle bends, so deliveries along the way read in order
  const ctrl = [[-3200, 0], [-2500, 70], [-1800, -40], [-1100, 55], [-400, -35], [300, 50], [1000, -45], [1700, 40], [2400, -30], [3200, 0]];
  const curve = new THREE.CatmullRomCurve3(ctrl.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, "centripetal");
  const LC0 = curve.getLength();
  const totalKm = LINK_KM.reduce((a, b) => a + b, 0);
  const sceneLen = totalKm * 1000 / ROUTE_SCALE;           // 6400 m
  const NS = Math.round(sceneLen / 2) + 1;                  // 2 m samples
  const raw = curve.getSpacedPoints(NS - 1);
  const k = sceneLen / LC0;                                 // rescale layout to the target length
  const X = new Float32Array(NS), Z = new Float32Array(NS);
  raw.forEach((p, i) => { X[i] = p.x * k; Z[i] = p.z * k; });
  const cumKm = [0]; LINK_KM.forEach(v => cumKm.push(cumKm.at(-1) + v));
  const nodeIdx = cumKm.map(km => Math.round(km / totalKm * (NS - 1)));
  // straighten around every node so yards sit on straight pipe
  const straightHalf = 55, blend = 45;                      // samples (2 m each)
  for (let n = 0; n < nodeIdx.length; n++) {
    const c = nodeIdx[n], i0 = Math.max(0, c - 4), i1 = Math.min(NS - 1, c + 4);
    let tx = X[i1] - X[i0], tz = Z[i1] - Z[i0]; const tl = Math.hypot(tx, tz); tx /= tl; tz /= tl;
    for (let i = Math.max(0, c - straightHalf - blend); i <= Math.min(NS - 1, c + straightHalf + blend); i++) {
      const d = Math.abs(i - c), w = d <= straightHalf ? 1 : 1 - smooth(0, 1, (d - straightHalf) / blend);
      const sx = X[c] + tx * (i - c) * 2, sz = Z[c] + tz * (i - c) * 2;
      X[i] = X[i] + (sx - X[i]) * w; Z[i] = Z[i] + (sz - Z[i]) * w;
    }
  }
  const S = new Float32Array(NS);                           // arc length (scene m)
  for (let i = 1; i < NS; i++) S[i] = S[i - 1] + Math.hypot(X[i] - X[i - 1], Z[i] - Z[i - 1]);
  // tangent / lateral
  const TX = new Float32Array(NS), TZ = new Float32Array(NS);
  for (let i = 0; i < NS; i++) { const a = Math.max(0, i - 1), b = Math.min(NS - 1, i + 1); const dx = X[b] - X[a], dz = Z[b] - Z[a], l = Math.hypot(dx, dz); TX[i] = dx / l; TZ[i] = dz / l; }

  // ---- 1b. customer sites beside the line and their laterals ----
  const sites = CUSTOMERS.map(c => {
    const i = Math.min(NS - 1, nodeIdx[c.node - 1] + Math.round(c.along / 2)), nx = -TZ[i] * c.side, nz = TX[i] * c.side;
    const x = X[i] + nx * c.offset, z = Z[i] + nz * c.offset;
    // lateral: leaves the yard at its upstream end, runs out sideways, then to the site gate
    const i0 = Math.max(0, nodeIdx[c.node - 1] - 44), lat = [];
    if (c.offset > 0) {
      const ax = X[i0] + nx * 70, az = Z[i0] + nz * 70;
      for (let t = 0; t <= 1.0001; t += 0.05) lat.push([X[i0] + (ax - X[i0]) * t, Z[i0] + (az - Z[i0]) * t]);
      const gx = x - nx * 110, gz = z - nz * 110;
      for (let t = 0.05; t <= 1.0001; t += 0.05) lat.push([ax + (gx - ax) * t, az + (gz - az) * t]);
    }
    return { ...c, i, x, z, nx, nz, rot: -Math.atan2(nz, nx) + Math.PI / 2, lat };
  });
  const LX = [], LZ = []; for (const st of sites) for (const [x, z] of st.lat) { LX.push(x); LZ.push(z); }
  const latGrid = new PolyGrid(Float32Array.from(LX.length ? LX : [1e9]), Float32Array.from(LZ.length ? LZ : [1e9]), 60);

  // ---- 2. river crossing link l7 ----
  const rIdx = Math.round(nodeIdx[6] + 0.62 * (nodeIdx[7] - nodeIdx[6]));
  const RX = [], RZ = [];
  { const nx = -TZ[rIdx], nz = TX[rIdx];
    for (let t = -12000; t <= 12000; t += 8) {
      const w = 90 * Math.sin(t / 420) + 50 * Math.sin(t / 170 + 1.3);
      RX.push(X[rIdx] + nx * t + TX[rIdx] * w * (1 - Math.exp(-(t * t) / 4e4) * 0.9) + TX[rIdx] * 0.4 * t * 0.15);
      RZ.push(Z[rIdx] + nz * t + TZ[rIdx] * w * (1 - Math.exp(-(t * t) / 4e4) * 0.9) + TZ[rIdx] * 0.4 * t * 0.15);
    } }
  const riverGrid = new PolyGrid(Float32Array.from(RX), Float32Array.from(RZ), 60);
  const PAD_R = { ccgt: 150, peaker: 110, ammonia: 190, dairy: 130 };
  const Hbase = (x, z) => 22 * fbm(x / 1400, z / 1400, 5) + 7 * fbm(x / 300 + 7, z / 300, 3) - 14;
  const riverLevel = RX.map((x, i) => Hbase(x, RZ[i]));
  for (let pass = 0; pass < 3; pass++) for (let i = 1; i < riverLevel.length - 1; i++) riverLevel[i] = Math.min(riverLevel[i], 0.5 * (riverLevel[i - 1] + riverLevel[i + 1]));
  const riverSmooth = riverLevel.map((_, i) => { let s = 0, n = 0; for (let j = Math.max(0, i - 25); j <= Math.min(riverLevel.length - 1, i + 25); j++) { s += riverLevel[j]; n++; } return s / n - 6; });
  const H1 = (x, z) => {
    let h = Hbase(x, z);
    const [ri, rd] = riverGrid.nearest(x, z, 2);
    if (ri >= 0 && rd < 120) { const tgt = riverSmooth[ri] - 2.4 + 12 * smooth(20, 80, rd); h = Math.min(h, tgt); }
    return h;
  };
  for (const st of sites) if (PAD_R[st.kind]) { st.padR = PAD_R[st.kind]; st.padH = H1(st.x, st.z); }
  // ---- 3. route grade g(s): smoothed terrain, flat pads at nodes ----
  const G0 = new Float32Array(NS); for (let i = 0; i < NS; i++) G0[i] = H1(X[i], Z[i]);
  const G = new Float32Array(NS);
  { const w = 30; for (let i = 0; i < NS; i++) { let s = 0, n = 0; for (let j = Math.max(0, i - w); j <= Math.min(NS - 1, i + w); j++) { s += G0[j]; n++; } G[i] = s / n; } }
  const padH = nodeIdx.map(c => G[c] + 0.4);
  for (let n = 0; n < nodeIdx.length; n++) {
    const c = nodeIdx[n];
    for (let i = Math.max(0, c - 120); i <= Math.min(NS - 1, c + 120); i++) {
      const d = Math.abs(i - c) * 2, w = 1 - smooth(100, 230, d);
      G[i] = G[i] + (padH[n] - G[i]) * w;
    }
  }
  // corridor half-width (yards wider)
  const HW = new Float32Array(NS).fill(14);
  for (const c of nodeIdx) for (let i = Math.max(0, c - 110); i <= Math.min(NS - 1, c + 110); i++) HW[i] = 95;
  for (const c of [nodeIdx[0], nodeIdx[12]]) for (let i = Math.max(0, c - 150); i <= Math.min(NS - 1, c + 150); i++) HW[i] = 120;
  const routeGrid = new PolyGrid(X, Z, 60);
  const heightAt = (x, z) => {
    let h = H1(x, z);
    const [i, d] = routeGrid.nearest(x, z, 3);
    if (i >= 0) {
      // exclude the river crossing from the flattening: let the valley cut under the pipe bridge
      const nearRiver = Math.abs(i - rIdx) < 30;
      const w = smooth(HW[i], HW[i] + 70, d);
      if (!nearRiver) h = G[i] + (h - G[i]) * w;
      else h = Math.min(h, G[i] + (h - G[i]) * w);
    }
    for (const st of sites) if (st.padR) {           // level ground under plant sites
      const d = Math.hypot(x - st.x, z - st.z); if (d < st.padR + 120) h = st.padH + (h - st.padH) * smooth(st.padR, st.padR + 120, d);
    }
    return h;
  };
  const rowAt = (x, z) => { const [i, d] = routeGrid.nearest(x, z, 3); const [j, dl] = latGrid.nearest(x, z, 2); return Math.min(i < 0 ? 999 : d - HW[i] + 14, j < 0 ? 999 : dl + 6); };

  // ---- 4. pipe elevation: buried, yards, valve sites, river span ----
  const OFF = new Float32Array(NS).fill(-1.7);              // pipe centre below grade
  const ABOVE = new Uint8Array(NS), CUT = new Uint8Array(NS);
  const setWin = (c, half, ramp, off, flag = 1) => {
    for (let i = Math.max(0, c - half - ramp); i <= Math.min(NS - 1, c + half + ramp); i++) {
      const d = Math.abs(i - c); const w = d <= half ? 1 : 1 - smooth(0, 1, (d - half) / ramp);
      OFF[i] = OFF[i] + (off - OFF[i]) * w; if (w > 0.6) ABOVE[i] = flag;
    }
  };
  for (let n = 1; n <= 11; n++) setWin(nodeIdx[n], 46, 5, STATION.PIPE_Y);      // compressor yards (+-92 m)
  setWin(nodeIdx[0], 70, 5, 1.2); setWin(nodeIdx[12], 30, 5, 1.2);
  const valveIdx = [];
  for (let l = 0; l < 12; l++) {
    const fracs = l === 0 || l === 11 ? [0.33, 0.66] : [0.5];
    for (const f of fracs) { const c = Math.round(nodeIdx[l] + f * (nodeIdx[l + 1] - nodeIdx[l])); if (Math.abs(c - rIdx) > 60) { valveIdx.push(c); setWin(c, 6, 4, 1.0); } }
  }
  // cutaway windows in every compressor yard: suction side and discharge side
  for (let n = 1; n <= 10; n++) {
    const c = nodeIdx[n];
    for (let i = c - 33; i <= c - 13; i++) CUT[i] = 1;
    for (let i = c + 13; i <= c + 40; i++) CUT[i] = 1;
  }
  const HIDE = new Uint8Array(NS);              // mainline inside compressor buildings (replaced by station piping)
  for (let n = 1; n <= 10; n++) for (let i = nodeIdx[n] - 11; i <= nodeIdx[n] + 11; i++) HIDE[i] = 1;
  const Y = new Float32Array(NS);
  for (let i = 0; i < NS; i++) Y[i] = G[i] + OFF[i];
  // river span: level pipe bridge
  const spanHalf = 22;
  const bankY = Math.max(G[rIdx - spanHalf - 6], G[rIdx + spanHalf + 6], riverSmooth[riverGrid.nearest(X[rIdx], Z[rIdx], 2)[0]] + 6) + 2.4;
  for (let i = rIdx - spanHalf - 10; i <= rIdx + spanHalf + 10; i++) {
    const d = Math.abs(i - rIdx), w = d <= spanHalf ? 1 : 1 - smooth(0, 1, (d - spanHalf) / 10);
    Y[i] = Y[i] + (bankY - Y[i]) * w; if (w > 0.5) ABOVE[i] = 1;
  }
  for (let i = rIdx - 6; i <= rIdx + 6; i++) CUT[i] = 0;

  // sample -> (link, fraction) for the model fields
  const LINK = new Uint8Array(NS), FR = new Float32Array(NS);
  for (let l = 0; l < 12; l++) for (let i = nodeIdx[l]; i <= nodeIdx[l + 1]; i++) { LINK[i] = l; FR[i] = (i - nodeIdx[l]) / (nodeIdx[l + 1] - nodeIdx[l]); }

  // ---- 5. terrain mesh ----
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < NS; i++) { minX = Math.min(minX, X[i]); maxX = Math.max(maxX, X[i]); minZ = Math.min(minZ, Z[i]); maxZ = Math.max(maxZ, Z[i]); }
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2, TW = maxX - minX + 26000, TD = maxZ - minZ + 22000;
  const SX = 640, SZ = Math.round(SX * TD / TW);
  const tg = new THREE.PlaneGeometry(TW, TD, SX, SZ); tg.rotateX(-Math.PI / 2); tg.translate(cx, 0, cz);
  const pos = tg.attributes.position, col = new Float32Array(pos.count * 3);
  const cGrass = new THREE.Color("#7b8f55"), cDry = new THREE.Color("#a49a6a"), cField = new THREE.Color("#8f9c5a"), cDark = new THREE.Color("#55693f"), cRow = new THREE.Color("#a7ad80"), cMud = new THREE.Color("#5b5340"), cReed = new THREE.Color("#4f6a3a"), tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = heightAt(x, z);
    pos.setY(i, h);
    // patchwork of fields
    const fx = Math.floor((x + 5000) / 210 + 0.5 * vnoise(x / 400, z / 400)), fz = Math.floor((z + 5000) / 160);
    const fv = hash2(fx, fz);
    tmp.copy(cGrass).lerp(fv < 0.33 ? cDry : fv < 0.66 ? cField : cGrass, 0.7);
    tmp.lerp(cDark, smooth(0.52, 0.66, fbm(x / 600 + 3, z / 600 - 2, 4)) * 0.8);
    tmp.multiplyScalar(0.97 + 0.06 * vnoise(x / 25, z / 25));
    const rd = rowAt(x, z);
    tmp.lerp(cRow, (1 - smooth(10, 22, rd)) * 0.55);
    const [ri, rdd] = riverGrid.nearest(x, z, 2); if (ri >= 0) { tmp.lerp(cReed, (1 - smooth(30, 70, rdd)) * 0.7); tmp.lerp(cMud, (1 - smooth(18, 34, rdd)) * 0.95); }
    col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
  }
  tg.setAttribute("color", new THREE.BufferAttribute(col, 3));
  tg.computeVertexNormals();
  const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97, map: noiseTex("#ffffff", 0.07, 16000, [700, 700]), normalMap: N.grass, normalScale: new THREE.Vector2(0.7, 0.7) });
  N.grass.repeat.set(2400, 2400);
  const terrain = new THREE.Mesh(tg, terrainMat); terrain.receiveShadow = true; scene.add(terrain);

  // water ribbon
  { const v = [], idx = [];
    for (let i = 0; i < RX.length; i++) {
      const a = Math.max(0, i - 1), b = Math.min(RX.length - 1, i + 1); let dx = RX[b] - RX[a], dz = RZ[b] - RZ[a]; const l = Math.hypot(dx, dz); dx /= l; dz /= l;
      const y = riverSmooth[i] - 0.7, w = 24;
      v.push(RX[i] - dz * w, y, RZ[i] + dx * w, RX[i] + dz * w, y, RZ[i] - dx * w);
      if (i > 0) { const o = (i - 1) * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
    }
    const wg = new THREE.BufferGeometry(); wg.setAttribute("position", new THREE.Float32BufferAttribute(v, 3)); wg.setIndex(idx); wg.computeVertexNormals();
    const water = new THREE.Mesh(wg, M.water); water.receiveShadow = true; scene.add(water); }

  // ---- 6. places along the route ----
  const placeAt = (i, obj, yOverride) => {
    obj.position.set(X[i], yOverride ?? G[i], Z[i]);
    obj.rotation.y = -Math.atan2(TZ[i], TX[i]);
    scene.add(obj); return obj;
  };
  const stations = [];
  for (let n = 1; n <= 10; n++) {
    const st = buildStation(`CS-${n}`);
    placeAt(nodeIdx[n], st.group, padH[n]);
    st.node = n; st.idx = nodeIdx[n];
    // exhaust plumes
    st.puffs = [];
    for (const sp of st.stacks) for (let q = 0; q < 7; q++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0 }));
      s.userData = { base: sp.clone(), phase: q / 7 }; st.group.add(s); st.puffs.push(s);
    }
    stations.push(st);
  }
  // fix building/station local pad height (stations placed at pad height, pipe in local y = PIPE_Y)
  for (const c of valveIdx) placeAt(c, buildValveSite());
  const n12 = buildValveSite(); n12.scale.set(1.25, 1, 1.25); placeAt(nodeIdx[11], n12, padH[11]);
  const supply = buildSupplyPlant(); placeAt(nodeIdx[0] + 35, supply.group, padH[0]);
  const delivery = buildDelivery(); placeAt(nodeIdx[12] - 0, delivery.group, padH[12]);
  const customers = sites.map(st => {
    let built;
    if (st.kind === "metro") built = { group: delivery.group, ...buildSkyline(delivery.group, heightAt, st) };
    else {
      built = SITE_BUILDERS[st.kind](st);
      built.group.position.set(st.x, heightAt(st.x, st.z), st.z); built.group.rotation.y = st.rot; scene.add(built.group);
      if (built.houses) placeHouses(scene, built, st, heightAt, rowAt);
    }
    built.puffs = [];
    for (const sp of built.stacks || []) for (let q = 0; q < 7; q++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0 }));
      s.userData = { base: sp.clone(), phase: q / 7 }; built.group.add(s); built.puffs.push(s);
    }
    return { ...st, ...built };
  });
  // the Madison-size city's own gas power plants (shown in the cold snap scenario): a campus cogeneration plant
  // like MGE's West Campus Cogeneration Facility, beyond the houses on the far side from the pipeline
  const cityPlant = (() => {
    const st = sites.find(q => q.id === "townB"), b = SITE_BUILDERS.ccgt(st), g = b.group;
    const x = st.x + st.nx * 760 + st.nz * 260, z = st.z + st.nz * 760 - st.nx * 260;
    g.scale.setScalar(0.62); g.position.set(x, heightAt(x, z), z); g.rotation.y = st.rot + Math.PI; g.visible = false; scene.add(g);
    const puffs = [];
    for (const sp of b.stacks) for (let q = 0; q < 7; q++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0 })); s.userData = { base: sp.clone(), phase: q / 7 }; g.add(s); puffs.push(s); }
    return { group: g, puffs, center: new THREE.Vector3(st.x, heightAt(st.x, st.z), st.z) };
  })();
  // lateral marker posts
  { const pts = []; for (const st of sites) for (let k = 3; k < st.lat.length - 1; k += 2) pts.push(st.lat[k]);
    const pm = new THREE.InstancedMesh(cyl(0.09, 1.7, 8), M.yellow, pts.length), m = new THREE.Matrix4();
    pts.forEach(([x, z], j) => { m.makeTranslation(x, heightAt(x, z) + 0.85, z); pm.setMatrixAt(j, m); }); scene.add(pm); }
  delivery.puffs = [];
  for (const sp of []) for (let q = 0; q < 8; q++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0 }));
    s.userData = { base: sp.clone(), phase: q / 8 }; delivery.group.add(s); delivery.puffs.push(s);
  }

  // ---- 7. supports, river piers, marker posts (instanced) ----
  const sup = [], piers = [], posts = [];
  for (let i = 0; i < NS; i += 3) {
    const inYard = nodeIdx.some(c => Math.abs(i - c) < 50);
    if (ABOVE[i] && !inYard && Math.abs(i - rIdx) > spanHalf + 4 && Y[i] - G[i] > 0.6) sup.push(i);
  }
  for (let i = rIdx - spanHalf; i <= rIdx + spanHalf; i += 9) piers.push(i);
  let side = 1;
  for (let i = 0; i < NS; i += 40) {
    if (ABOVE[i] || nodeIdx.some(c => Math.abs(i - c) < 120) || Math.abs(i - rIdx) < 40) continue;
    side = -side; posts.push([X[i] - TZ[i] * 5 * side, Z[i] + TX[i] * 5 * side]);
  }
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), s4 = new THREE.Vector3(), p4 = new THREE.Vector3();
  const supMesh = new THREE.InstancedMesh(box(1.2, 1, 0.8), M.concrete, sup.length);
  sup.forEach((i, j) => { const h = Y[i] - PIPE_R - G[i] + 0.3; q4.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.atan2(TZ[i], TX[i])); m4.compose(p4.set(X[i], G[i] - 0.3 + h / 2, Z[i]), q4, s4.set(1, h, 1)); supMesh.setMatrixAt(j, m4); });
  supMesh.castShadow = supMesh.receiveShadow = true; scene.add(supMesh);
  const pierMesh = new THREE.InstancedMesh(cyl(0.7, 1, 16), M.concrete, piers.length);
  piers.forEach((i, j) => { const gy = heightAt(X[i], Z[i]) - 2, h = Y[i] - PIPE_R - gy; m4.compose(p4.set(X[i], gy + h / 2, Z[i]), q4.identity(), s4.set(1, h, 1)); pierMesh.setMatrixAt(j, m4); });
  pierMesh.castShadow = pierMesh.receiveShadow = true; scene.add(pierMesh);
  const capMesh = new THREE.InstancedMesh(box(2.2, 0.4, 1.4), M.darkSteel, piers.length);
  piers.forEach((i, j) => { q4.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.atan2(TZ[i], TX[i]) + Math.PI / 2); m4.compose(p4.set(X[i], Y[i] - PIPE_R - 0.2, Z[i]), q4, s4.set(1, 1, 1)); capMesh.setMatrixAt(j, m4); });
  scene.add(capMesh);
  const postMesh = new THREE.InstancedMesh(cyl(0.09, 1.7, 8), M.yellow, posts.length);
  const capPost = new THREE.InstancedMesh(cyl(0.11, 0.25, 8), M.red, posts.length);
  posts.forEach(([x, z], j) => { const h = heightAt(x, z); m4.makeTranslation(x, h + 0.85, z); postMesh.setMatrixAt(j, m4); m4.makeTranslation(x, h + 1.75, z); capPost.setMatrixAt(j, m4); });
  postMesh.castShadow = true; scene.add(postMesh, capPost);
  // span handrail
  { const a = rIdx - spanHalf - 2, b = rIdx + spanHalf + 2;
    for (const s of [-1, 1]) { const pts = []; for (let i = a; i <= b; i += 2) pts.push(new THREE.Vector3(X[i] - TZ[i] * 1.0 * s, Y[i] + 0.9, Z[i] + TX[i] * 1.0 * s)); const c2 = new THREE.CatmullRomCurve3(pts); const tm = new THREE.Mesh(new THREE.TubeGeometry(c2, pts.length * 2, 0.04, 6), M.yellow); scene.add(tm); }
  }

  // ---- 8. trees and a town near the delivery site ----
  const treesC = [], treesB = [];
  const tr = mulberry(11);
  for (let t = 0; t < 90000 && treesC.length + treesB.length < 12000; t++) {
    const x = cx + (tr() - 0.5) * (maxX - minX + 4000), z = cz + (tr() - 0.5) * 4400;
    const forest = fbm(x / 600 + 3, z / 600 - 2, 4);
    if (forest < 0.5 && tr() > 0.04) continue;
    if (rowAt(x, z) < 30) continue;
    if (sites.some(st => Math.hypot(x - st.x, z - st.z) < (st.kind === "town" ? 700 : st.kind === "metro" ? 0 : 260))) continue;
    if (Math.hypot(x - X[NS - 1] + TZ[NS - 1] * 900, z - Z[NS - 1] - TX[NS - 1] * 900) < 900) continue;
    const [ri, rdd] = riverGrid.nearest(x, z, 2); if (ri >= 0 && rdd < 26) continue;
    const h = heightAt(x, z), sc = 0.7 + tr() * 0.8;
    (tr() < 0.55 ? treesC : treesB).push([x, h, z, sc, tr() * 6.28]);
  }
  const coneG = new THREE.ConeGeometry(2.6, 9, 7).translate(0, 7.5, 0), trunkG = cyl(0.35, 3.2, 6).translate(0, 1.6, 0), ballG = new THREE.IcosahedronGeometry(3.6, 1).translate(0, 6.8, 0);
  const iC = new THREE.InstancedMesh(coneG, M.conifer, treesC.length), iB = new THREE.InstancedMesh(ballG, M.broadleaf, treesB.length), iT = new THREE.InstancedMesh(trunkG, M.trunk, treesC.length + treesB.length);
  const tc = new THREE.Color();
  [...treesC, ...treesB].forEach(([x, h, z, s, r], j) => {
    q4.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r); m4.compose(p4.set(x, h, z), q4, s4.set(s, s, s));
    iT.setMatrixAt(j, m4);
    if (j < treesC.length) { iC.setMatrixAt(j, m4); iC.setColorAt(j, tc.setHSL(0.3 + tr() * 0.05, 0.3, 0.26 + tr() * 0.08)); }
    else { iB.setMatrixAt(j - treesC.length, m4); iB.setColorAt(j - treesC.length, tc.setHSL(0.2 + tr() * 0.08, 0.38, 0.3 + tr() * 0.1)); }
  });
  for (const im of [iC, iB, iT]) { im.castShadow = true; im.receiveShadow = true; scene.add(im); }
  // hedgerows on the field boundaries (same field grid as the terrain colours), around each station
  { const hedge = [], hr2 = mulberry(77), R = 900;
    const ok = (x, z) => rowAt(x, z) > 24 && !stations.some(st => Math.hypot(x - st.group.position.x, z - st.group.position.z) < 150)
      && !sites.some(st => Math.hypot(x - st.x, z - st.z) < (st.kind === "town" ? 620 : st.kind === "metro" ? 0 : 320)) && !(riverGrid.nearest(x, z, 2)[1] < 30);
    for (const st of stations) { const cx = st.group.position.x, cz = st.group.position.z;
      for (let zl = Math.ceil((cz - R + 5000) / 160) * 160 - 5000; zl < cz + R; zl += 160) for (let x = cx - R; x < cx + R; x += 8) { if (hr2() < 0.12) continue; const z = zl + (hr2() - 0.5) * 2; if (ok(x, z)) hedge.push([x, z, 0.6 + hr2() * 0.7]); }
      for (let k = Math.floor((cx - R + 5000) / 210); k < (cx + R + 5000) / 210; k++) for (let z = cz - R; z < cz + R; z += 8) {
        let x = 210 * k - 5000; for (let it = 0; it < 3; it++) x = 210 * (k - 0.5 * vnoise(x / 400, z / 400)) - 5000;
        if (hr2() < 0.12) continue; if (ok(x, z)) hedge.push([x, z, 0.6 + hr2() * 0.7]); } }
    const hg = new THREE.IcosahedronGeometry(2.4, 0).translate(0, 1.9, 0), hm = new THREE.InstancedMesh(hg, M.broadleaf, hedge.length), hc = new THREE.Color();
    hedge.forEach(([x, z, sc], k) => { q4.setFromAxisAngle(new THREE.Vector3(0, 1, 0), k * 1.7); m4.compose(p4.set(x, heightAt(x, z) - 0.3, z), q4, s4.set(sc * 1.2, sc, sc * 1.2)); hm.setMatrixAt(k, m4); hm.setColorAt(k, hc.setHSL(0.22 + ((k * 13) % 8) / 100, 0.34, 0.22 + ((k * 7) % 9) / 100)); });
    hm.castShadow = true; hm.receiveShadow = true; scene.add(hm); }
  return {
    NS, X, Y, Z, G, S, TX, TZ, ABOVE, CUT, HIDE, LINK, FR, nodeIdx, valveIdx, rIdx, padH,
    stations, supply, delivery, terrain, heightAt, customers, rowAt, cityPlant,
    bounds: { cx, cz, TW, TD }, sceneLen,
  };
}
