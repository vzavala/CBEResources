// Procedural dairy plant at true scale (metres; x = process direction, y up, z depth), laid out after public photos of
// Babcock Hall Dairy Plant (UW–Madison news and Grow magazine, 2023): a long red-brown brick hall with ribbon windows and
// the taller Center for Dairy Research addition (brick with a white louvred top band and a glass corner tower); inside,
// white insulated panel walls and ceilings, colour-coded hygiene floors (green, yellow, red), a drive-through milk intake
// bay, a cluster of stainless tanks under a slanted-glass observation deck, overhead stainless pipe racks with blue-topped
// valve clusters, a pint filler, and one large deep-freeze room. Room sizes and positions are assumptions.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const M = {};
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.2, ...o });
function texCanvas(w, h, draw) { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; }
function brickTex(rows = 16) {
  return texCanvas(256, 256, (g, w, h) => {
    g.fillStyle = "#c9bfb2"; g.fillRect(0, 0, w, h);
    const bh = h / rows, bw = 48;
    for (let r = 0; r < rows; r++) for (let k = -1; k < w / bw + 1; k++) {
      const x = k * bw + (r % 2) * bw / 2, y = r * bh, v = 0.86 + Math.random() * 0.24;
      g.fillStyle = `rgb(${Math.round(160 * v)},${Math.round(84 * v)},${Math.round(62 * v)})`; g.fillRect(x + 1.2, y + 1.2, bw - 2.4, bh - 2.4);
    }
  });
}
function concreteTex() { return texCanvas(256, 256, (g, w, h) => { g.fillStyle = "#b1b1ac"; g.fillRect(0, 0, w, h); for (let i = 0; i < 2600; i++) { const v = 150 + Math.random() * 60; g.fillStyle = `rgba(${v},${v},${v - 6},0.25)`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } g.strokeStyle = "rgba(80,80,80,0.3)"; g.strokeRect(0, 0, w, h); }); }
function panelTex() { return texCanvas(128, 128, (g, w, h) => { g.fillStyle = "#f4f5f4"; g.fillRect(0, 0, w, h); g.fillStyle = "#e1e3e2"; for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 1.5, h); }); }
function louvreTex() { return texCanvas(128, 128, (g, w, h) => { g.fillStyle = "#e9ecee"; g.fillRect(0, 0, w, h); g.fillStyle = "#b9bfc4"; for (let y = 4; y < h; y += 8) g.fillRect(0, y, w, 3); g.fillStyle = "#f8f9fa"; g.fillRect(0, 0, 3, h); }); }
function glassBlockTex() { return texCanvas(128, 128, (g, w, h) => { g.fillStyle = "#9fb7cc"; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 16) { g.fillStyle = `rgba(220,235,248,${0.5 + Math.random() * 0.3})`; g.fillRect(x + 2, y + 2, 12, 12); } }); }
// Part H: procedural detail maps (generated in canvas, nothing downloaded)
function dataTex(w, h, draw, srgb = false) { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; }
function brushedRough() { return dataTex(512, 512, (g, w, h) => { g.fillStyle = "rgb(205,205,205)"; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2400; i++) { const y = Math.random() * h, v = 170 + Math.random() * 70; g.fillStyle = `rgba(${v},${v},${v},0.35)`; g.fillRect(0, y, w, 0.6 + Math.random()); }
  for (let i = 0; i < 40; i++) { const x = Math.random() * w, y = Math.random() * h; g.fillStyle = "rgba(255,255,255,0.25)"; g.beginPath(); g.ellipse(x, y, 6 + Math.random() * 20, 2 + Math.random() * 5, 0, 0, 6.3); g.fill(); } }); }
function brushedNormal() { return dataTex(512, 512, (g, w, h) => { g.fillStyle = "rgb(128,128,255)"; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 1600; i++) { const y = Math.random() * h, d = (Math.random() - 0.5) * 40; g.fillStyle = `rgb(128,${128 + d | 0},250)`; g.fillRect(0, y, w, 0.8); } }); }
function speckleRough(base = 110, amp = 70) { return dataTex(256, 256, (g, w, h) => { g.fillStyle = `rgb(${base},${base},${base})`; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++) { const v = base + (Math.random() - 0.5) * amp; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); }
  for (let i = 0; i < 30; i++) { const v = Math.min(255, base + 30); g.fillStyle = `rgba(${v},${v},${v},0.25)`; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 8 + Math.random() * 30, 0, 6.3); g.fill(); } }); }
function speckleNormal() { return dataTex(256, 256, (g, w, h) => { g.fillStyle = "rgb(128,128,255)"; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 5000; i++) { g.fillStyle = `rgb(${128 + (Math.random() - 0.5) * 50 | 0},${128 + (Math.random() - 0.5) * 50 | 0},245)`; g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); } }); }
function seamNormal() { return dataTex(128, 128, (g, w, h) => { g.fillStyle = "rgb(128,128,255)"; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 16) { g.fillStyle = "rgb(90,128,240)"; g.fillRect(x, 0, 1, h); g.fillStyle = "rgb(166,128,240)"; g.fillRect(x + 1, 0, 1, h); } }); }
function initMats() {
  if (M.ss) return;
  const bR = brushedRough(), bN = brushedNormal(); bR.repeat.set(2, 2); bN.repeat.set(2, 2);
  M.ss = new THREE.MeshPhysicalMaterial({ color: "#d3d7da", metalness: 1, roughness: 0.34, roughnessMap: bR, normalMap: bN, normalScale: new THREE.Vector2(0.25, 0.25), envMapIntensity: 1.15, clearcoat: 0.15, clearcoatRoughness: 0.4 });
  M.ssDark = new THREE.MeshPhysicalMaterial({ color: "#9aa2a8", metalness: 1, roughness: 0.45, roughnessMap: bR, normalMap: bN, normalScale: new THREE.Vector2(0.3, 0.3) });
  M.white = std("#f3f4f3", { metalness: 0.05, roughness: 0.55, roughnessMap: speckleRough(235, 30) });
  M.red = std("#c5050c", { metalness: 0.25, roughness: 0.45 });   // painted steel
  M.blue = std("#2f5d86", { metalness: 0.3, roughness: 0.5 });
  M.valveBlue = std("#1f5fbf", { metalness: 0.2, roughness: 0.4 });
  M.yellow = std("#e2b42a", { metalness: 0.2, roughness: 0.55 });
  M.dark = std("#3b4146", { metalness: 0.6, roughness: 0.5 });
  M.rubber = std("#1d1f21", { metalness: 0, roughness: 0.9 });
  M.glass = new THREE.MeshPhysicalMaterial({ color: "#d6e8f2", metalness: 0, roughness: 0.04, transmission: 0.9, ior: 1.5, thickness: 0.01, transparent: true, opacity: 0.45 });
  M.insul = std("#f2f2ef", { metalness: 0, roughness: 0.75 });
  M.grass = std("#8fb07e", { metalness: 0, roughness: 0.95 });
  M.asphalt = std("#5a5d60", { metalness: 0, roughness: 0.95 });
  const fR = speckleRough(225, 50), fN = speckleNormal(); fR.repeat.set(30, 30); fN.repeat.set(30, 30);
  const floor = (c, r) => std(c, { metalness: 0.02, roughness: r, roughnessMap: fR, normalMap: fN, normalScale: new THREE.Vector2(0.15, 0.15) });
  M.floorG = floor("#6f9a6a", 0.45);   // hygiene zones (epoxy-painted floor)
  M.floorY = floor("#dcb93a", 0.45);
  M.floorR = floor("#c0392b", 0.55);     // red zone band
  M.floorW = floor("#d9dcde", 0.6);
  M.pallet = std("#a07a4a", { metalness: 0, roughness: 0.85 });
  M.bag = std("#e8e1cf", { metalness: 0, roughness: 0.95 });
  M.cup = std("#4a2c1d", { metalness: 0, roughness: 0.6 });       // chocolate cartons: dark chocolate brown paperboard
  M.lid = std("#3b2416", { metalness: 0, roughness: 0.55 });
  M.ssPolish = new THREE.MeshPhysicalMaterial({ color: "#e3e6e9", metalness: 1, roughness: 0.18, envMapIntensity: 1.25, clearcoat: 0.3, clearcoatRoughness: 0.15 });   // sanitary tubing, polished
  M.water = std("#3d6f9e", { metalness: 0.3, roughness: 0.4 });     // painted utility water line
  M.frost = new THREE.MeshPhysicalMaterial({ color: "#f3f8fc", roughness: 0.95, metalness: 0, sheen: 1, sheenColor: new THREE.Color("#ffffff"), normalMap: speckleNormal(), normalScale: new THREE.Vector2(1.2, 1.2) });
  M.motor = std("#55708a", { metalness: 0.35, roughness: 0.42 });   // painted motor and gearbox
  M.poly = new THREE.MeshPhysicalMaterial({ color: "#eef6fa", metalness: 0, roughness: 0.05, transmission: 0.92, ior: 1.58, thickness: 0.006, transparent: true, opacity: 0.28, depthWrite: false });
  M.chain = std("#2b2f33", { metalness: 0.1, roughness: 0.55 });    // plastic table-top chain
  M.led = new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#fffaf0", emissiveIntensity: 2.2 });
  M.screen = new THREE.MeshStandardMaterial({ color: "#0b1a26", emissive: "#2a7fb8", emissiveIntensity: 0.5 });
  M.safety = std("#f2c230", { metalness: 0, roughness: 0.5 });
  M.grate = std("#ffffff", { map: dataTex(64, 64, (g, w, h) => { g.fillStyle = "#3a3f44"; g.fillRect(0, 0, w, h); g.fillStyle = "#b9c0c6"; for (let x = 2; x < w; x += 8) g.fillRect(x, 0, 3, h); }, true), metalness: 0.9, roughness: 0.4 });
  { const c = document.createElement("canvas"); c.width = 512; c.height = 128; const x = c.getContext("2d");
    x.fillStyle = "#3b2416"; x.fillRect(0, 0, 512, 128); x.fillStyle = "#f3e7d3"; x.fillRect(0, 10, 512, 6); x.fillRect(0, 112, 512, 6);
    x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = "#f3e7d3"; x.font = "italic 700 34px Georgia, serif";
    for (const cx of [128, 384]) { x.fillText("Chocolate", cx, 52); x.font = "600 15px Arial"; x.fillText("CHOCOLATE ICE CREAM · 1 PINT", cx, 88); x.font = "italic 700 34px Georgia, serif"; }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    M.carton = new THREE.MeshStandardMaterial({ color: "#ffffff", map: t, roughness: 0.55 }); M.tub = M.carton; }
  M.lidM = M.lid;
  { const c = document.createElement("canvas"); c.width = c.height = 512; const x = c.getContext("2d");     // quarry tile, 150 mm, with grout
    x.fillStyle = "#8d877d"; x.fillRect(0, 0, 512, 512);
    for (let r = 0; r < 8; r++) for (let k = 0; k < 8; k++) { const v = 0.94 + Math.random() * 0.1; x.fillStyle = `rgb(${190 * v | 0},${183 * v | 0},${172 * v | 0})`; x.fillRect(k * 64 + 2, r * 64 + 2, 60, 60);
      for (let s = 0; s < 40; s++) { x.fillStyle = `rgba(120,110,100,${Math.random() * 0.25})`; x.fillRect(k * 64 + 2 + Math.random() * 58, r * 64 + 2 + Math.random() * 58, 1.5, 1.5); } }
    M.tileMap = new THREE.CanvasTexture(c); M.tileMap.colorSpace = THREE.SRGBColorSpace; M.tileMap.wrapS = M.tileMap.wrapT = THREE.RepeatWrapping; M.tileMap.anisotropy = 8;
    const r = document.createElement("canvas"); r.width = r.height = 512; const y = r.getContext("2d"); y.fillStyle = "#f0f0f0"; y.fillRect(0, 0, 512, 512);   // grout rough, tile wet-glossy
    for (let a = 0; a < 8; a++) for (let k = 0; k < 8; k++) { y.fillStyle = "#4a4a4a"; y.fillRect(k * 64 + 2, a * 64 + 2, 60, 60); }
    for (let s = 0; s < 60; s++) { y.fillStyle = "rgba(20,20,20,0.5)"; y.beginPath(); y.ellipse(Math.random() * 512, Math.random() * 512, 20 + Math.random() * 60, 10 + Math.random() * 30, Math.random() * 3, 0, 6.3); y.fill(); }   // wet patches
    M.tileRough = new THREE.CanvasTexture(r); M.tileRough.wrapS = M.tileRough.wrapT = THREE.RepeatWrapping; }
  const bt = brickTex(); bt.repeat.set(10, 3); M.brick = std("#ffffff", { map: bt, roughness: 0.85, metalness: 0 });
  const bt2 = brickTex(); bt2.repeat.set(6, 5); M.brick2 = std("#ffffff", { map: bt2, roughness: 0.85, metalness: 0 });
  const ct = concreteTex(); ct.repeat.set(40, 40); M.concrete = std("#ffffff", { map: ct, roughness: 0.9, metalness: 0 });
  const pt = panelTex(); pt.repeat.set(8, 1); const sN = seamNormal(); sN.repeat.set(8, 1); M.panel = std("#ffffff", { map: pt, normalMap: sN, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.55, metalness: 0.05 });
  const lt = louvreTex(); lt.repeat.set(8, 1); M.louvre = std("#ffffff", { map: lt, roughness: 0.5, metalness: 0.3 });
  const gb = glassBlockTex(); gb.repeat.set(10, 2); M.glassBlock = std("#ffffff", { map: gb, roughness: 0.2, metalness: 0.1 });
}

function add(parent, geo, m, x = 0, y = 0, z = 0) { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; parent.add(o); return o; }
const cyl = (r, h, s = 32, r2 = r) => new THREE.CylinderGeometry(r2, r, h, s);
// bevelled boxes: real equipment has rounded edges; radius ≈ 8 % of the smallest side, at most 3 cm
const box = (w, h, d) => { const r = Math.min(0.03, Math.min(w, h, d) * 0.08); return r > 0.004 && Math.max(w, h, d) < 40 ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d); };
const BOLT = new THREE.CylinderGeometry(0.012, 0.012, 0.03, 6), CARTON = new THREE.CylinderGeometry(0.045, 0.039, 0.085, 28);
const flangeGeo = new Map();   // shared flange geometry per pipe radius
function flanges(parent, A, B, r, m) {
  if (r < 0.018 || r > 0.2) return; const k = r.toFixed(3); if (!flangeGeo.has(k)) flangeGeo.set(k, new THREE.CylinderGeometry(r * 1.45, r * 1.45, r * 0.5, 24));
  const d = B.clone().sub(A).normalize(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
  for (const P of [A, B]) { const f = new THREE.Mesh(flangeGeo.get(k), m === M.insul || m === M.water ? M.ssDark : M.ssPolish); f.position.copy(P).addScaledVector(d, P === A ? r * 0.6 : -r * 0.6); f.quaternion.copy(q); f.castShadow = false; f.receiveShadow = true; parent.add(f); } }
function pipe(parent, a, b, r, m, seg = 12) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), L = d.length();
  const o = add(parent, cyl(r, L, seg), m); o.position.copy(A).addScaledVector(d, 0.5);
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); o.castShadow = false; if (L > 1.2) flanges(parent, A, B, r, m); return o;
}
function polyPipe(parent, pts, r, m) { const out = []; for (let i = 0; i < pts.length - 1; i++) out.push(pipe(parent, pts[i], pts[i + 1], r, m)); for (let i = 1; i < pts.length - 1; i++) add(parent, new THREE.SphereGeometry(r, 10, 8), m, ...pts[i]); return out; }
function legs(parent, x, z, r, h, n = 4, m = M.ss) { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + Math.PI / 4; add(parent, cyl(0.04, h, 8), m, x + Math.cos(a) * r, h / 2, z + Math.sin(a) * r); } }
function tank(parent, x, z, D, H, o = {}) {
  const g = new THREE.Group(); g.position.set(x, o.y ?? 0, z); parent.add(g);
  const lift = o.legs ?? 0.6, m = o.mat ?? M.ss;
  if (lift) legs(g, 0, 0, D * 0.42, lift + 0.05, 4, m);
  add(g, cyl(D / 2, H, 40), m, 0, lift + H / 2, 0);
  const head = new THREE.SphereGeometry(D / 2, 40, 12, 0, Math.PI * 2, 0, Math.PI / 2); head.scale(1, 0.25, 1);
  add(g, head, m, 0, lift + H, 0); const bot = head.clone(); bot.rotateX(Math.PI); add(g, bot, m, 0, lift, 0);
  if (o.agitator) { add(g, cyl(0.15, 0.4, 20), M.blue, 0, lift + H + D * 0.13 + 0.2, 0); add(g, box(0.35, 0.1, 0.35), M.ssDark, 0, lift + H + D * 0.13, 0); }
  if (o.manway) { add(g, cyl(0.2, 0.08, 20), M.ssDark, D * 0.2, lift + H + D * 0.1, 0); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; add(g, cyl(0.014, 0.05, 6), M.ssDark, D * 0.2 + Math.cos(a) * 0.17, lift + H + D * 0.1 + 0.05, Math.sin(a) * 0.17); } }
  // weld seams where the heads meet the shell, and a mid-height girth seam
  for (const y of [lift, lift + H, lift + H / 2]) { const s = new THREE.Mesh(new THREE.TorusGeometry(D / 2 + 0.002, 0.008, 6, 48), M.ssDark); s.rotation.x = Math.PI / 2; s.position.y = y; g.add(s); }
  g.userData = { D, H, lift };
  return g;
}
function label(list, key, name, pos) { list.push({ key, name, pos: new THREE.Vector3(...pos) }); }
// simple standing person (for scale)
// Part W: people are a mix of women and men, with varied height, skin tone and hair, in the same work clothing and safety gear.
// o: { woman, skin, hair, h (height scale), net (hair net + safety glasses for staff), sample (holds a sample bottle) }
function person(parent, x, z, ry = 0, coat = "#ffffff", o = {}) {
  const { woman = false, skin: sk = "#d9b08c", hair = "#3a2a1f", h = 1, net = true, sample = false } = o;
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; g.scale.setScalar(h); parent.add(g);
  // ≈ 1.75 m at h = 1, in proportion: legs 0.85, torso 0.6, head 0.23
  const cm = new THREE.MeshPhysicalMaterial({ color: coat, roughness: 0.85, sheen: 0.6, sheenRoughness: 0.8, sheenColor: new THREE.Color("#ffffff") });
  const pants = new THREE.MeshPhysicalMaterial({ color: "#2e3a4a", roughness: 0.9, sheen: 0.4, sheenRoughness: 0.9 });
  const skin = new THREE.MeshPhysicalMaterial({ color: sk, roughness: 0.55, sheen: 0.3, sheenColor: new THREE.Color("#f2c7a5") });
  const hm = std(hair, { metalness: 0, roughness: 0.8 });
  const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 6, 12);
  const boot = std("#f4f4f1", { metalness: 0, roughness: 0.35 }), sole = std("#1e2124", { metalness: 0, roughness: 0.9 });
  const hipX = woman ? 0.095 : 0.1, sh = woman ? 0.215 : 0.235;
  for (const sx of [-hipX, hipX]) { add(g, cap(0.066, 0.62), pants, sx, 0.5, 0); add(g, cyl(0.072, 0.3, 14), boot, sx, 0.2, 0); add(g, box(0.115, 0.09, 0.25), boot, sx, 0.075, 0.05); add(g, box(0.12, 0.03, 0.27), sole, sx, 0.015, 0.05); }   // legs, rubber boots
  const torso = add(g, cap(woman ? 0.155 : 0.17, 0.42), cm, 0, 1.17, 0); torso.scale.set(woman ? 0.95 : 1, 1, 0.68);
  add(g, cap(0.15, 0.25), cm, 0, 0.92, 0).scale.set(woman ? 1.16 : 1.1, 1, 0.78);   // coat skirt (wider at the hips for women)
  for (const sx of [-1, 1]) { const arm = add(g, cap(woman ? 0.046 : 0.05, 0.5), cm, sx * sh, 1.14, 0); arm.rotation.z = sx * 0.08; add(g, new THREE.SphereGeometry(0.046, 10, 8), net ? std("#3d7fd6", { metalness: 0, roughness: 0.5 }) : skin, sx * (sh + 0.02), 0.84, 0.01); }   // gloves (staff) or hands
  if (sample) { add(g, cyl(0.022, 0.09, 12), M.glass, sh + 0.02, 0.93, 0.05); add(g, cyl(0.024, 0.02, 12), M.red, sh + 0.02, 0.985, 0.05); }   // sample bottle
  add(g, cyl(woman ? 0.045 : 0.05, 0.08, 10), skin, 0, 1.5, 0);   // neck
  const head = add(g, new THREE.SphereGeometry(woman ? 0.1 : 0.105, 20, 16), skin, 0, 1.63, 0); head.scale.set(0.9, 1.1, 0.95);
  if (net) {
    add(g, new THREE.SphereGeometry(0.112, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), std("#f6f6f4", { metalness: 0, roughness: 0.95 }), 0, 1.66, -0.005);   // hair net
    const band = add(g, new THREE.TorusGeometry(0.104, 0.012, 6, 24, Math.PI), hm, 0, 1.655, -0.005); band.rotation.x = Math.PI / 2; band.rotation.z = Math.PI;   // hair showing under the net
    if (woman) { add(g, new THREE.SphereGeometry(0.068, 16, 12), hm, 0, 1.6, -0.125);   // hair gathered in a bun, seen through the net
      add(g, new THREE.SphereGeometry(0.074, 16, 12), new THREE.MeshStandardMaterial({ color: "#f6f6f4", roughness: 0.95, transparent: true, opacity: 0.45 }), 0, 1.6, -0.125); }
    add(g, box(0.17, 0.035, 0.02), new THREE.MeshPhysicalMaterial({ color: "#cfe6f2", transmission: 0.6, roughness: 0.05, transparent: true, opacity: 0.6 }), 0, 1.645, 0.095);   // safety glasses
    add(g, box(0.18, 0.012, 0.022), std("#20262b", { metalness: 0.2 }), 0, 1.665, 0.095);
  } else {
    add(g, new THREE.SphereGeometry(0.11, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hm, 0, 1.655, -0.01);   // hair
    if (woman) { const long = add(g, cap(0.08, 0.2), hm, 0, 1.5, -0.06); long.scale.set(1.15, 1, 0.7); }   // longer hair to the shoulders
  }
  return g;
}

// =======================================================================================
export function buildWorld(scene) {
  initMats();
  const W = { labels: [], spin: [], walls: [], roofs: [], product: [], nh3: [], stations: {}, tunnelShell: [] };
  const root = new THREE.Group(); scene.add(root);
  const B = { x0: -38, xC: -10, x1: 74, z0: -18, z1: 6, h: 9, hC: 16 };     // Babcock Hall block and CDR addition

  // ---------- site: Linden Drive in front, sidewalks, lawn ----------
  add(root, new THREE.PlaneGeometry(700, 700).rotateX(-Math.PI / 2), M.grass, 20, -0.03, 0).receiveShadow = true;
  add(root, new THREE.PlaneGeometry(150, 56).rotateX(-Math.PI / 2), M.concrete, 18, -0.01, -8).receiveShadow = true;
  add(root, new THREE.PlaneGeometry(220, 12).rotateX(-Math.PI / 2), M.asphalt, 18, 0.0, 26).receiveShadow = true;     // street
  for (let x = -90; x < 128; x += 6) add(root, new THREE.PlaneGeometry(3, 0.15).rotateX(-Math.PI / 2), M.yellow, x, 0.01, 26);

  // ---------- floors by hygiene zone (inside the envelope) ----------
  const floor = (x0, x1, z0, z1, m) => add(root, new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), m, (x0 + x1) / 2, 0.012, (z0 + z1) / 2);
  floor(-37, -24, -17.5, 5.5, M.concrete);       // intake bay (drive-through)
  // quarry-tile floors with a wet sheen; the hygiene zone colour is a thin border band (green, yellow, red)
  const tileFloor = (x0, x1, z0, z1, zm) => { const m = new THREE.MeshPhysicalMaterial({ color: "#ffffff", map: M.tileMap.clone(), roughnessMap: M.tileRough.clone(), roughness: 0.55, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.25 });
    for (const t of [m.map, m.roughnessMap]) { t.repeat.set((x1 - x0) / 1.2, (z1 - z0) / 1.2); t.needsUpdate = true; }
    floor(x0, x1, z0, z1, m);
    if (zm) for (const [a, b, c, d] of [[x0 + 0.3, x1 - 0.3, z0 + 0.3, z0 + 0.42], [x0 + 0.3, x1 - 0.3, z1 - 0.42, z1 - 0.3], [x0 + 0.3, x0 + 0.42, z0 + 0.3, z1 - 0.3], [x1 - 0.42, x1 - 0.3, z0 + 0.3, z1 - 0.3]])
      add(root, new THREE.PlaneGeometry(b - a, d - c).rotateX(-Math.PI / 2), zm, (a + b) / 2, 0.015, (c + d) / 2).castShadow = false; };
  tileFloor(-24, 5, -17.5, 5.5, M.floorG);       // raw milk + mix room (green zone)
  tileFloor(5, 24, -17.5, 5.5, M.floorY);        // process room (yellow)
  tileFloor(24, 57, -17.5, 5.5, M.floorR);       // tank room, freezing and filling (red, highest hygiene)
  tileFloor(57, 73.5, -17.5, 5.5, null);         // deep freezer and Dairy Store

  // ---------- envelope: brick outside, white insulated panels inside ----------
  const wall = (x, z, w, d, h, o = {}) => { const m = add(root, box(w, h, d), o.mat ?? M.brick, x, (o.y0 ?? 0) + h / 2, z); m.userData.front = !!o.front; W.walls.push(m); return m; };
  // Babcock Hall: back (z0) and front (z1) walls, east end
  wall((B.xC + B.x1) / 2, B.z0, B.x1 - B.xC, 0.4, B.h);
  wall((B.xC + B.x1) / 2, B.z1, B.x1 - B.xC, 0.4, B.h, { front: true });
  wall(B.x1, 0, 0.4, B.z1 - B.z0, B.h);
  // ribbon windows (front and back) in the upper storey
  for (const [z, fr] of [[B.z0 - 0.22, false], [B.z1 + 0.22, true]]) { const r = add(root, box(B.x1 - B.xC - 4, 1.3, 0.08), M.glass, (B.xC + B.x1) / 2, 6.8, z); r.userData.front = fr; W.walls.push(r);
    for (let x = B.xC + 4; x < B.x1 - 2; x += 3) { const m = add(root, box(0.12, 1.4, 0.12), M.white, x, 6.8, z); m.userData.front = fr; W.walls.push(m); } }
  // inner panel lining on the back wall (white insulated panels) and glass-block band in the process room
  add(root, box(B.x1 - B.xC - 1, 5.5, 0.08), M.panel, (B.xC + B.x1) / 2, 2.75, B.z0 + 0.25);
  add(root, box(18, 1.6, 0.06), M.glassBlock, 14.5, 2.6, B.z0 + 0.3);
  // CDR addition: taller brick block with white louvred mechanical band and a glass corner stair tower
  wall((B.x0 + B.xC) / 2, B.z0, B.xC - B.x0, 0.4, B.hC, { mat: M.brick2 });
  wall(B.x0, (B.z0 + B.z1) / 2, 0.4, B.z1 - B.z0, B.hC, { mat: M.brick2 });
  wall((B.x0 + B.xC) / 2 + 7, B.z1, B.xC - B.x0 - 14, 0.4, B.hC, { mat: M.brick2, front: true });
  wall(B.xC, (B.z0 + B.z1) / 2, 0.4, B.z1 - B.z0, B.hC - B.h, { mat: M.brick2, y0: B.h });      // shared wall above the hall roof
  for (const [x, z, w, d, fr] of [[(B.x0 + B.xC) / 2, B.z0 - 0.25, B.xC - B.x0, 0.1, false], [B.x0 - 0.25, 0, 0.1, B.z1 - B.z0, false], [(B.x0 + B.xC) / 2, B.z1 + 0.25, B.xC - B.x0, 0.1, true]]) { const l = add(root, box(w, 3, d), M.louvre, x, B.hC - 1.6, z); l.userData.front = fr; W.walls.push(l); }
  { const t = add(root, box(4.5, B.hC + 0.6, 4.5), M.glass, B.x0 + 2.2, (B.hC + 0.6) / 2, B.z1 - 2.2); t.userData.front = true; W.walls.push(t);
    for (const [dx, dz] of [[-2.25, -2.25], [2.25, -2.25], [-2.25, 2.25], [2.25, 2.25]]) { const p = add(root, box(0.15, B.hC + 0.6, 0.15), M.white, B.x0 + 2.2 + dx, (B.hC + 0.6) / 2, B.z1 - 2.2 + dz); p.userData.front = true; W.walls.push(p); }
    for (let y = 4; y < B.hC; y += 4) { const p = add(root, box(4.6, 0.12, 4.6), M.white, B.x0 + 2.2, y, B.z1 - 2.2); p.userData.front = true; W.walls.push(p); } }
  // roofs (hidden in "open building")
  const r1 = add(root, box(B.x1 - B.xC + 0.6, 0.35, B.z1 - B.z0 + 0.6), M.dark, (B.xC + B.x1) / 2, B.h + 0.15, 0); r1.userData.deck = true; W.roofs.push(r1);
  const r2 = add(root, box(B.xC - B.x0 + 0.6, 0.35, B.z1 - B.z0 + 0.6), M.dark, (B.x0 + B.xC) / 2, B.hC + 0.15, 0); r2.userData.deck = true; W.roofs.push(r2);
  // interior partitions (white panels, 4.5 m), with door openings
  const part = (x, z0, z1, gaps = []) => { let z = z0; for (const [a, b] of [...gaps, [z1, z1]]) { if (a > z) add(root, box(0.12, 4.5, a - z), M.panel, x, 2.25, (z + a) / 2); z = b; } };
  part(-24, -17.8, 5.8, [[-4, 1]]);            // intake bay | raw milk room (pass-through for hose)
  part(5, -17.8, 5.8, [[-3, 1]]);              // mix | process
  part(24, -6, 5.8, [[-3, 1]]);                 // process | tank room (open under the deck)
  // drive-through roll-up doors (front and back), yellow frames
  for (const z of [B.z0, B.z1]) for (const dx of [-3.6, 3.6]) add(root, box(0.3, 5.2, 0.5), M.yellow, -30.5 + dx, 2.6, z);

  // ---------- 1. drive-through intake bay: tanker inside, staircase and safety cage ----------
  { const tr = new THREE.Group(); tr.position.set(-30.5, 0, -4); tr.rotation.y = Math.PI / 2; root.add(tr);
    add(tr, cyl(1.1, 10, 40).rotateZ(Math.PI / 2), M.ss, 0, 2.3, 0);
    for (const s of [-1, 1]) add(tr, new THREE.SphereGeometry(1.1, 32, 12).scale(0.25, 1, 1), M.ss, s * 5, 2.3, 0);
    add(tr, box(10.5, 0.3, 2.2), M.dark, 0, 1.1, 0);
    for (const x of [-3.8, -2.6, 3.4]) for (const z of [-0.9, 0.9]) add(tr, cyl(0.5, 0.35, 24).rotateX(Math.PI / 2), M.rubber, x, 0.5, z);
    const cab = new THREE.Group(); cab.position.x = 7.1; tr.add(cab);
    add(cab, box(2.6, 2.6, 2.4), M.red, 0.3, 2.1, 0); add(cab, box(2.4, 1.0, 2.3), M.glass, 0.5, 2.9, 0); add(cab, box(3.6, 0.4, 2.3), M.dark, 0.2, 0.8, 0);
    for (const x of [-0.8, 1.2]) for (const z of [-1, 1]) add(cab, cyl(0.5, 0.35, 24).rotateX(Math.PI / 2), M.rubber, x, 0.5, z);
    // staircase + cage platform alongside the tank top
    const st = new THREE.Group(); st.position.set(-27.4, 0, -4); root.add(st);
    for (let k = 0; k < 12; k++) add(st, box(0.9, 0.06, 0.3), M.yellow, 0, 0.3 + k * 0.3, -4 + k * 0.28);
    add(st, box(1.2, 0.1, 6), M.yellow, 0, 3.6, 2.2);
    for (const z of [-0.6, 1, 2.6, 4.2]) add(st, box(0.06, 1.1, 0.06), M.yellow, -0.55, 4.15, z);
    add(st, box(0.06, 0.06, 5.6), M.yellow, -0.55, 4.7, 2.2);
    add(root, box(0.6, 1.6, 0.4), M.white, -25, 0.8, 3);          // receiving control panel
    W.stations.receiving = new THREE.Vector3(-30.5, 2, -4);
  }
  label(W.labels, "receiving", "Milk intake bay", [-30.5, 6.4, -4]);
  // raw milk, cream and liquid sugar tanks (indoors)
  W.silos = [];
  for (const [x, z, D, H] of [[-20, -12, 2.6, 4.6], [-20, -6, 2.6, 4.6], [-15, -12, 2.0, 3.6], [-15, -6, 2.0, 3.6]]) W.silos.push(tank(root, x, z, D, H, { legs: 0.6, agitator: true, manway: true }));
  // dry ingredients: bags on pallets next to the powder blender
  for (let i = 0; i < 3; i++) { const px = -8 + i * 1.4, pz = -14; add(root, box(1.2, 0.15, 1.0), M.pallet, px, 0.08, pz); for (let l = 0; l < 4; l++) for (let b = 0; b < 2; b++) add(root, box(0.55, 0.16, 0.9), M.bag, px - 0.3 + b * 0.6, 0.25 + l * 0.17, pz); }

  // ---------- 2. mix room: powder blender + blend tanks (110 °F) ----------
  W.mixTanks = [-5, -1].map(x => tank(root, x, -8, 2.0, 2.4, { legs: 0.7, agitator: true, manway: true }));
  W.mixTanks.forEach(t => { const a = new THREE.Group(); a.position.y = t.userData.lift + t.userData.H + 0.55; t.add(a); W.spin.push({ o: a, w: 1.5 }); });
  { const g = new THREE.Group(); g.position.set(-3, 0, -2.5); root.add(g);
    add(g, box(1.3, 0.8, 0.8), M.ss, 0, 0.4, 0); add(g, cyl(0.35, 0.55, 24, 0.12), M.ss, 0, 1.12, 0); add(g, box(0.9, 0.05, 0.6), M.ssDark, 0, 0.82, 0);
    add(g, cyl(0.18, 0.45, 18).rotateZ(Math.PI / 2), M.blue, 0.85, 0.45, 0); W.stations.batching = new THREE.Vector3(-3, 1.5, -6); }
  label(W.labels, "batching", "Powder blender & mix tanks", [-3, 4.6, -6]);

  // ---------- 3. process room: homogeniser (first, warm), HTST plate unit, holding tube, CIP ----------
  const HX = 14;
  { const g = new THREE.Group(); g.position.set(8.5, 0, -9); root.add(g); W.homog = g;
    add(g, box(2.0, 1.3, 1.2), M.ss, 0, 0.75, 0);               // enclosed stainless cabinet
    add(g, box(2.1, 0.12, 1.3), M.dark, 0, 0.06, 0);
    add(g, box(0.45, 0.55, 0.9), M.ss, 1.25, 1.05, 0);
    add(g, cyl(0.1, 0.5, 16), M.ss, 1.3, 1.6, 0.25); add(g, cyl(0.08, 0.4, 16), M.ss, 1.3, 1.55, -0.25);
    add(g, cyl(0.05, 0.25, 12), M.dark, 1.3, 1.95, 0.25);
    const fly = new THREE.Group(); fly.position.set(-0.6, 1.0, 0.65); g.add(fly); add(fly, cyl(0.3, 0.06, 24).rotateX(Math.PI / 2), M.dark); W.spin.push({ o: fly, w: 12, axis: "z" });
    W.stations.homog = new THREE.Vector3(8.5, 1, -9);
  }
  label(W.labels, "homog", "Homogeniser", [8.5, 3.0, -9]);
  { const g = new THREE.Group(); g.position.set(HX, 0, -9); root.add(g); W.plate = g;    // compact HTST skid
    add(g, box(3.4, 0.12, 1.5), M.ssDark, 0, 0.06, 0);
    add(g, box(0.18, 1.7, 0.8), M.ss, -1.1, 0.95, 0); add(g, box(0.18, 1.7, 0.8), M.ss, 0.6, 0.95, 0);
    for (let x = -0.98; x < 0.48; x += 0.022) add(g, box(0.006, 1.3, 0.6), M.ss, x, 0.95, 0).castShadow = false;
    add(g, box(1.9, 0.1, 0.1), M.ssDark, -0.25, 1.75, 0);
    add(g, box(0.9, 1.6, 0.5), M.ss, 1.3, 0.9, 0.3); add(g, box(0.5, 0.4, 0.03), new THREE.MeshStandardMaterial({ color: "#0d2333", emissive: "#2a7fb8", emissiveIntensity: 0.6 }), 1.3, 1.3, 0.56);   // touchscreen panel
    add(g, cyl(0.25, 0.8, 20), M.ss, -0.6, 0.55, 0.65); add(g, cyl(0.15, 0.4, 16).rotateZ(Math.PI / 2), M.blue, 0, 0.3, 0.65);  // hot-water set
  }
  { const g = new THREE.Group(); g.position.set(HX - 1.6, 0, -5.5); root.add(g); W.holdTube = g;
    const pts = [], runs = 6, L = 3.0; for (let k = 0; k < runs; k++) { const y = 0.6 + k * 0.18; pts.push([k % 2 ? L : 0, y, 0], [k % 2 ? 0 : L, y + 0.06, 0]); }
    polyPipe(g, pts, 0.026, M.ss); for (const x of [0.1, L - 0.1]) add(g, box(0.06, 1.8, 0.06), M.dark, x, 0.9, 0);
    add(g, cyl(0.09, 0.35, 16), M.ss, L + 0.5, 1.7, 0); add(g, cyl(0.11, 0.22, 16), M.white, L + 0.5, 2.0, 0);
  }
  label(W.labels, "htst", "HTST pasteuriser", [HX, 3.6, -9]);
  W.stations.htst = new THREE.Vector3(HX, 1.2, -8);

  // ---------- 4. tank room: ageing tank cluster, ladder frame, valve matrix, observation deck above ----------
  const AX = 28;
  W.ageTanks = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) W.ageTanks.push(tank(root, AX + i * 2.5, -10 + j * 2.6, 2.1, 2.8, { legs: 0.5, agitator: true, manway: true }));
  W.ageTanks.forEach(t => { const a = new THREE.Group(); a.position.y = t.userData.lift + t.userData.H + 0.75; t.add(a); add(a, box(0.4, 0.04, 0.07), M.ssDark); W.spin.push({ o: a, w: 0.8 }); });
  { // stainless access frame with ladder (as in the photo)
    const g = new THREE.Group(); root.add(g);
    for (const x of [AX - 1.4, AX + 6.4]) for (const z of [-11.5, -5.9]) add(g, cyl(0.035, 4.6, 8), M.ss, x, 2.3, z);
    for (const y of [1.2, 2.6, 4.0, 4.6]) { add(g, cyl(0.03, 7.8, 8).rotateZ(Math.PI / 2), M.ss, AX + 2.5, y, -5.9); add(g, cyl(0.03, 7.8, 8).rotateZ(Math.PI / 2), M.ss, AX + 2.5, y, -11.5); }
    for (let k = 0; k < 14; k++) add(g, cyl(0.02, 0.5, 6).rotateZ(Math.PI / 2), M.ss, AX + 6.6, 0.3 + k * 0.32, -5.9);
    // valve matrix on top: many parallel lines with blue-topped mix-proof valves
    for (let k = 0; k < 7; k++) { const z = -11 + k * 0.85; pipe(g, [AX - 1.5, 4.9, z], [AX + 7, 4.9, z], 0.03, M.ss); }
    for (let i = 0; i < 6; i++) for (let k = 0; k < 7; k += 2) { const x = AX - 0.8 + i * 1.3, z = -11 + k * 0.85; add(g, cyl(0.06, 0.32, 12), M.ss, x, 5.15, z); add(g, cyl(0.07, 0.14, 12), M.valveBlue, x, 5.38, z); }
  }
  label(W.labels, "ageing", "Ageing tanks · 4 °C", [AX + 2.5, 7.0, -8.5]);
  W.stations.ageing = new THREE.Vector3(AX + 2.5, 2, -8.5);
  // overhead stainless pipe rack running the length of the plant
  for (let k = 0; k < 6; k++) pipe(root, [-22, 5.6 + (k % 2) * 0.15, -15.6 + k * 0.32], [56, 5.6 + (k % 2) * 0.15, -15.6 + k * 0.32], 0.035, k === 2 ? M.insul : M.ss);
  for (let x = -20; x < 56; x += 6) add(root, box(0.08, 0.08, 2.4), M.ssDark, x, 5.5, -14.8);
  // observation deck: corridor above the back wall with slanted glass looking down into the plant
  { const g = new THREE.Group(); root.add(g);
    const x0 = 5, x1 = 46, zc = -16.2;
    const deck = add(g, box(x1 - x0, 0.25, 3.4), M.white, (x0 + x1) / 2, 6.0, zc); deck.userData.deck = true;
    for (let x = x0; x < x1; x += 2.5) { const pane = add(g, box(2.4, 2.2, 0.05), M.glass, x + 1.25, 7.15, zc + 1.9); pane.rotation.x = -0.35; pane.castShadow = false;
      add(g, box(0.08, 2.3, 0.08), M.white, x, 7.15, zc + 1.9).rotation.x = -0.35; }
    add(g, box(x1 - x0, 0.15, 0.3), M.white, (x0 + x1) / 2, 6.05, zc + 1.75);
    for (const [x, c, o] of [[12, "#c5050c", { woman: true, skin: "#8d5a3b", hair: "#1f1a17", h: 0.95 }], [13.2, "#2f6fb0", { skin: "#f1c9a5", hair: "#6b4a2b", h: 1.03 }], [26, "#e2b42a", { woman: true, skin: "#d9b08c", hair: "#b08a50", h: 0.97 }],
      [27, "#ffffff", { woman: true, skin: "#e8bf9a", hair: "#9a958e", h: 0.93 }], [38, "#5a7f4a", { skin: "#5c3a24", hair: "#1f1a17", h: 1.0 }]]) { const p = person(g, x, zc - 0.3, Math.PI, c, { net: false, ...o }); p.position.y = 6.12; }
    W.deck = g;
  }
  label(W.labels, "deck", "Observation deck", [25, 9.0, -16]);

  // ---------- 5. freezing and filling room: continuous freezer, ingredient feeder, pint and 3-gallon filling ----------
  // Modelled after typical dairy-plant equipment (scraped-surface freezer, inclusion feeder, inline cup filler); sizes Typical.
  const FX = 44;
  const bolts = (g, n, R, x, y, z, axis = "x", m = M.ssDark) => { for (let i = 0; i < n; i++) { const a = i / n * 6.283; const b = new THREE.Mesh(BOLT, m);
      if (axis === "x") { b.rotation.z = Math.PI / 2; b.position.set(x, y + Math.cos(a) * R, z + Math.sin(a) * R); } else { b.rotation.x = Math.PI / 2; b.position.set(x + Math.cos(a) * R, y + Math.sin(a) * R, z); } g.add(b); } };
  const feet = (g, pts, h = 0.22) => { for (const [x, z] of pts) { add(g, box(0.06, h, 0.06), M.ss, x, h / 2 + 0.04, z); add(g, cyl(0.012, 0.05, 8), M.ssDark, x, 0.035, z); add(g, cyl(0.045, 0.018, 20), M.ssDark, x, 0.009, z); } };
  const triClamp = (g, x, y, z, r, axis = "x") => { const t = new THREE.Mesh(new THREE.TorusGeometry(r * 1.45, r * 0.22, 8, 28), M.ssPolish); if (axis === "x") t.rotation.y = Math.PI / 2; else if (axis === "y") t.rotation.x = Math.PI / 2; t.position.set(x, y, z); g.add(t);
    const wn = add(g, box(0.012, 0.05, 0.012), M.ssPolish, x, y + r * 1.75, z); wn.castShadow = false; };
  const handValve = (g, x, y, z, r, m = M.ssPolish) => { add(g, new THREE.SphereGeometry(r * 1.6, 16, 12), m, x, y, z); add(g, cyl(0.008, 0.12, 8), M.ssDark, x, y + 0.08, z); const w = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.008, 6, 20), M.red); w.rotation.x = Math.PI / 2; w.position.set(x, y + 0.14, z); g.add(w); };
  // room finishes: stainless kick plate on the panel wall, LED high-bay fixtures, overhead pipe rack
  add(root, box(33, 0.32, 0.03), M.ssPolish, 40.5, 0.16, B.z0 + 0.31);
  add(root, box(0.03, 0.32, 11.5), M.ssPolish, 24.08, 0.16, 0);
  for (let x = 28; x <= 56; x += 6) for (const z of [-13, -6, 1.5]) { const g = new THREE.Group(); g.position.set(x, 5.3, z); root.add(g);
    for (const dx of [-0.5, 0.5]) add(g, cyl(0.006, 0.9, 6), M.ssDark, dx, 0.5, 0);
    add(g, box(1.25, 0.07, 0.32), M.ssDark, 0, 0, 0); const l = add(g, box(1.15, 0.012, 0.24), M.led, 0, -0.04, 0); l.castShadow = false; }
  for (let x = 27; x <= 56; x += 3) { for (const dz of [-0.6, 0.6]) add(root, cyl(0.008, 1.6, 6), M.ssDark, x, 5.0, -8 + dz); add(root, box(0.05, 0.05, 1.4), M.ssDark, x, 4.2, -8); }
  for (const [dz, r, m, y] of [[-0.45, 0.025, M.ssPolish, 4.25], [-0.15, 0.038, M.ssPolish, 4.27], [0.15, 0.05, M.water, 4.28], [0.45, 0.07, M.insul, 4.3]])
    for (let x = 26; x < 56; x += 6) pipe(root, [x, y + r, -8 + dz], [Math.min(56, x + 6), y + r, -8 + dz], r, m, 16);

  // continuous (scraped-surface) freezer: barrel along x at y = 1.85 (the product line runs on its axis)
  { const g = new THREE.Group(); g.position.set(FX, 0, -2); root.add(g); W.freezerG = g;
    feet(g, [[-1.1, -0.4], [1.1, -0.4], [-1.1, 0.4], [1.1, 0.4]]);
    add(g, box(2.4, 1.2, 0.95), M.ss, 0, 0.86, 0);
    for (const x of [-0.6, 0.6]) { add(g, box(1.1, 1.0, 0.012), M.ssDark, x, 0.86, 0.478).scale.set(1, 1, 0.5); add(g, box(0.03, 0.18, 0.03), M.ssPolish, x + 0.45, 0.9, 0.5); }   // access doors + handles
    for (let k = 0; k < 6; k++) add(g, box(0.4, 0.015, 0.01), M.dark, 0.6, 0.45 + k * 0.04, 0.49);   // louvre
    for (const x of [-0.55, 0.55]) add(g, box(0.14, 0.4, 0.38), M.ss, x, 1.62, 0);   // saddles
    add(g, cyl(0.215, 1.5, 48).rotateZ(Math.PI / 2), M.ssPolish, 0, 1.85, 0);     // insulated jacket, polished cladding
    for (const x of [-0.4, 0, 0.4]) { const s = new THREE.Mesh(new THREE.TorusGeometry(0.217, 0.006, 6, 48), M.ssDark); s.rotation.y = Math.PI / 2; s.position.set(x, 1.85, 0); g.add(s); }
    for (const sx of [-1, 1]) { add(g, cyl(0.245, 0.05, 48).rotateZ(Math.PI / 2), M.ss, sx * 0.775, 1.85, 0); bolts(g, 12, 0.21, sx * 0.805, 1.85, 0, "x"); add(g, cyl(0.06, 0.06, 24).rotateZ(Math.PI / 2), M.ssPolish, sx * 0.83, 1.85, 0); }
    triClamp(g, -0.88, 1.85, 0, 0.03); triClamp(g, 0.88, 1.85, 0, 0.03);
    // dasher drive: motor with cooling fins, gearbox, belt guard to the rear end cap
    const mot = add(g, cyl(0.13, 0.42, 32).rotateZ(Math.PI / 2), M.motor, -0.55, 1.62, -0.33);
    for (let k = 0; k < 7; k++) { const f = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.006, 4, 32), M.motor); f.rotation.y = Math.PI / 2; f.position.set(-0.72 + k * 0.05, 1.62, -0.33); g.add(f); }
    add(g, cyl(0.1, 0.06, 24).rotateZ(Math.PI / 2), M.ssDark, -0.32, 1.62, -0.33);
    add(g, box(0.26, 0.3, 0.3), M.motor, -0.95, 1.62, -0.33); add(g, box(0.1, 0.42, 0.62), M.ss, -0.95, 1.75, -0.08);
    // ammonia: frosted liquid supply (cold) and wet suction return, each with a hand valve
    add(g, cyl(0.1, 0.55, 24), M.frost, 0, 2.38, -0.2); add(g, new THREE.SphereGeometry(0.11, 16, 10), M.frost, 0, 2.1, -0.2).scale.set(1, 0.6, 1);
    handValve(g, 0, 2.72, -0.2, 0.04, M.frost);
    polyPipe(g, [[0.45, 2.05, -0.08], [0.45, 2.6, -0.08], [0.45, 2.6, -0.6], [0.45, 4.2, -0.6]], 0.06, M.insul); handValve(g, 0.45, 2.4, -0.08, 0.035);
    // air injection: filtered air line from the cabinet to the mix inlet, with a filter bowl and needle valve
    polyPipe(g, [[-0.9, 1.3, 0.49], [-0.9, 1.6, 0.49], [-1.0, 1.6, 0.25], [-1.0, 2.2, 0.03]], 0.009, M.ssPolish);
    add(g, cyl(0.035, 0.12, 16), M.glass, -0.9, 1.42, 0.52); handValve(g, -1.0, 1.9, 0.18, 0.012);
    // mix inlet valve on the drop from the ageing tanks
    handValve(g, -1.0, 2.75, 0, 0.03);
    // control cabinet on a pedestal, facing the aisle: HMI with live draw temperature, e-stop, stack light
    const cg = new THREE.Group(); cg.position.set(-1.75, 0, 0.75); g.add(cg);
    add(cg, cyl(0.05, 1.0, 16), M.ss, 0, 0.5, 0); add(cg, cyl(0.16, 0.02, 24), M.ssDark, 0, 0.01, 0);
    add(cg, box(0.62, 0.72, 0.24), M.ss, 0, 1.38, 0);
    const hc = document.createElement("canvas"); hc.width = 320; hc.height = 220; const hx = hc.getContext("2d"); const ht = new THREE.CanvasTexture(hc); ht.colorSpace = THREE.SRGBColorSpace;
    W.hmi = add(cg, new THREE.PlaneGeometry(0.46, 0.32), new THREE.MeshStandardMaterial({ color: "#000000", emissive: "#ffffff", emissiveMap: ht, emissiveIntensity: 0.55, roughness: 0.2 }), 0, 1.42, 0.122);
    W.hmiDraw = (Td, OR, Te) => { hx.fillStyle = "#0b1a26"; hx.fillRect(0, 0, 320, 220); hx.fillStyle = "#1f6fa8"; hx.fillRect(0, 0, 320, 34);
      hx.fillStyle = "#ffffff"; hx.font = "600 20px Arial"; hx.fillText("FREEZER 1 · RUN", 12, 24); hx.fillStyle = "#7fd17f"; hx.beginPath(); hx.arc(296, 17, 8, 0, 6.3); hx.fill();
      hx.fillStyle = "#9fb3c4"; hx.font = "16px Arial"; hx.fillText("DRAW TEMPERATURE", 14, 64); hx.fillStyle = "#ffffff"; hx.font = "700 54px Arial"; hx.fillText(`${Td.toFixed(1)} °C`, 14, 120);
      hx.fillStyle = "#9fb3c4"; hx.font = "17px Arial"; hx.fillText(`Overrun ${OR.toFixed(0)} %`, 14, 160); hx.fillText(`NH3 ${Te.toFixed(1)} °C`, 170, 160);
      hx.fillStyle = "#24435a"; hx.fillRect(14, 182, 292, 14); hx.fillStyle = "#4fb3ff"; hx.fillRect(14, 182, 292 * Math.min(1, Math.max(0, (-Td - 3) / 5)), 14); ht.needsUpdate = true; };
    W.hmiDraw(-6.7, 80, -21.5);
    add(cg, cyl(0.03, 0.03, 20).rotateX(Math.PI / 2), M.red, 0.22, 1.13, 0.13); add(cg, cyl(0.04, 0.02, 20).rotateX(Math.PI / 2), M.yellow, 0.22, 1.13, 0.12);
    for (const [k, c] of [[0, "#2fa84f"], [1, "#f0b429"], [2, "#d33"]]) add(cg, cyl(0.035, 0.06, 16), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: k === 0 ? 1.2 : 0.1 }), 0.2, 1.78 + k * 0.065, 0);
    W.stations.freezer = new THREE.Vector3(FX, 1.6, -2);
  }
  label(W.labels, "freezer", "Continuous freezer", [FX, 3.3, -2]);
  // ingredient feeder (dark chocolate flakes: hopper + auger) and variegate pump with a fudge kettle (chocolate recipe swirl)
  { const g = new THREE.Group(); g.position.set(FX + 3, 0, -2); root.add(g);
    feet(g, [[-0.4, -0.3], [0.4, -0.3], [-0.4, 0.3], [0.4, 0.3]], 0.9);
    add(g, box(0.9, 0.08, 0.7), M.ss, 0, 1.0, 0);
    add(g, box(0.7, 0.3, 0.42), M.ss, 0, 1.5, 0);                                     // inclusion chamber on the product line
    add(g, cyl(0.42, 0.55, 4, 0.12).rotateY(Math.PI / 4), M.ssPolish, -0.15, 2.18, -0.05);   // hopper
    add(g, box(0.6, 0.02, 0.6), M.poly, -0.15, 2.46, -0.05);
    const aug = add(g, cyl(0.07, 0.62, 24), M.ssPolish, 0.12, 1.75, -0.05); aug.rotation.z = -0.9;
    add(g, cyl(0.09, 0.22, 24).rotateZ(Math.PI / 2), M.motor, 0.5, 1.98, -0.05);
    triClamp(g, -0.4, 1.5, 0, 0.03); triClamp(g, 0.4, 1.6, 0, 0.03);
    // fudge kettle + lobe pump
    const k = tank(g, 0.95, 0.75, 0.6, 0.55, { legs: 0.55, mat: M.ssPolish, agitator: true });
    add(g, box(0.25, 0.2, 0.2), M.ss, 0.6, 0.35, 0.55); add(g, cyl(0.07, 0.2, 20).rotateZ(Math.PI / 2), M.motor, 0.78, 0.35, 0.55);
    polyPipe(g, [[0.6, 0.45, 0.55], [0.6, 1.2, 0.55], [0.25, 1.4, 0.2]], 0.02, M.ssPolish);
    W.stations.feeder = new THREE.Vector3(FX + 3, 1.2, -2); }
  label(W.labels, "feeder", "Ingredient feeder", [FX + 3, 2.8, -2]);
  const FIL = FX + 7;
  { const g = new THREE.Group(); g.position.set(FIL, 0, -2); root.add(g);   // inline cup filler: denester, filling head, lidder, guarding
    feet(g, [[-1.5, -0.45], [1.5, -0.45], [-1.5, 0.45], [1.5, 0.45], [0, -0.45], [0, 0.45]]);
    add(g, box(3.2, 0.62, 1.0), M.ss, 0, 0.57, 0);
    add(g, box(3.3, 0.04, 0.26), M.chain, 0, 0.9, 0.05);
    for (const z of [-0.03, 0.13]) { add(g, cyl(0.006, 3.3, 8).rotateZ(Math.PI / 2), M.ssPolish, 0, 1.0, z); for (let x = -1.5; x <= 1.5; x += 0.5) add(g, box(0.01, 0.1, 0.01), M.ssDark, x, 0.95, z); }
    const row = new THREE.InstancedMesh(CARTON, M.carton, 14), m4 = new THREE.Matrix4();
    for (let i = 0; i < 14; i++) { m4.makeTranslation(-1.45 + i * 0.2, 0.965, 0.05); row.setMatrixAt(i, m4); } row.castShadow = true; g.add(row);
    // denester (carton magazine) at the in-feed
    add(g, cyl(0.046, 0.5, 24), M.carton, -1.25, 1.28, 0.05); for (let a = 0; a < 3; a++) add(g, cyl(0.006, 0.6, 6), M.ssPolish, -1.25 + Math.cos(a * 2.1) * 0.06, 1.3, 0.05 + Math.sin(a * 2.1) * 0.06);
    // filling head: manifold, two nozzles, valve actuators
    add(g, box(0.34, 0.14, 0.26), M.ssPolish, -0.3, 1.72, 0.05); for (const dx of [-0.08, 0.08]) { add(g, cyl(0.02, 0.45, 16), M.ssPolish, -0.3 + dx, 1.42, 0.05); add(g, cyl(0.035, 0.14, 16), M.ssPolish, -0.3 + dx, 1.86, 0.05); }
    // lidder: lid magazine and press
    add(g, cyl(0.05, 0.34, 24), M.lidM, 0.6, 1.45, 0.05); add(g, box(0.2, 0.08, 0.2), M.ss, 0.6, 1.2, 0.05); add(g, cyl(0.02, 0.2, 12), M.ssPolish, 0.6, 1.33, 0.05);
    // guarding: stainless frame with clear polycarbonate panels
    for (const x of [-1.6, -0.55, 0.55, 1.6]) for (const z of [-0.5, 0.5]) add(g, box(0.04, 1.2, 0.04), M.ss, x, 1.48, z);
    for (const z of [-0.5, 0.5]) add(g, box(3.24, 0.04, 0.04), M.ss, 0, 2.08, z); for (const x of [-1.6, 1.6]) add(g, box(0.04, 0.04, 1.0), M.ss, x, 2.08, 0);
    for (const z of [-0.5, 0.5]) { const pc = add(g, box(3.16, 1.12, 0.008), M.poly, 0, 1.5, z); pc.castShadow = false; }
    add(g, box(0.008, 1.12, 0.96), M.poly, 1.6, 1.5, 0).castShadow = false;
    // operator panel on a swing arm
    add(g, cyl(0.02, 0.5, 10).rotateZ(Math.PI / 2), M.ssPolish, 1.85, 1.6, 0.4); add(g, box(0.3, 0.24, 0.08), M.ss, 2.1, 1.6, 0.4); add(g, new THREE.PlaneGeometry(0.22, 0.15), M.screen, 2.1, 1.62, 0.442);
    // 3-gallon tub filling station beside it
    feet(g, [[-0.25, 1.35], [0.65, 1.35], [-0.25, 2.05], [0.65, 2.05]]);
    add(g, box(1.0, 0.55, 0.9), M.ss, 0.2, 0.55, 1.7); add(g, cyl(0.04, 0.7, 16), M.ssPolish, 0.2, 1.3, 1.7); triClamp(g, 0.2, 1.62, 1.7, 0.03, "y");
    for (let k = 0; k < 4; k++) add(g, cyl(0.135, 0.255, 32, 0.13), M.tub, -0.9 + k * 0.32, 0.93, 1.7);
    W.stations.filler = new THREE.Vector3(FIL, 1.2, -2);
  }
  label(W.labels, "filler", "Pint & tub filling", [FIL, 3.0, -2]);
  // floor: yellow walkway lines and stainless drains
  for (const [x0, x1, z] of [[36, 56.5, 1.4], [36, 56.5, -5.2]]) add(root, new THREE.PlaneGeometry(x1 - x0, 0.1).rotateX(-Math.PI / 2), M.safety, (x0 + x1) / 2, 0.016, z).castShadow = false;
  for (const [x, z] of [[FX + 1.6, -0.5], [FIL - 1.8, 0.4], [38, -3], [FX - 2.2, -4.2], [FIL + 2.5, -3.6]]) { add(root, new THREE.PlaneGeometry(0.34, 0.34).rotateX(-Math.PI / 2), M.ssDark, x, 0.015, z).castShadow = false; add(root, new THREE.PlaneGeometry(0.28, 0.28).rotateX(-Math.PI / 2), M.grate, x, 0.017, z).castShadow = false; }
  person(root, FIL - 0.5, -0.6, 0.2, "#ffffff", { skin: "#c68a5e", hair: "#2a1d14", h: 1.02 });
  person(root, FX - 1.85, 0.05, -0.3, "#ffffff", { woman: true, skin: "#8d5a3b", hair: "#1f1a17", h: 0.96 });   // operator at the freezer's control console
  person(root, HX + 1.6, -3.7, 0, "#ffffff", { woman: true, skin: "#f1c9a5", hair: "#6b4a2b", h: 0.98, sample: true });   // engineer taking a mix sample at the pasteuriser

  // ---------- 6. deep freezer room (−20 °F): hardening and storage, "the size of a modest banquet room" ----------
  const TX = 65.2, TZ = -6;
  { const g = new THREE.Group(); g.position.set(TX, 0, TZ); root.add(g); W.tunnel = g;
    const w = 16, d = 16, h = 6;
    for (const [x, z, ww, dd, fr] of [[0, -d / 2, w, 0.2, 0], [0, d / 2, w, 0.2, 1], [-w / 2, 0, 0.2, d, 0], [w / 2, 0, 0.2, d, 0]]) { const o = add(g, box(ww, h, dd), M.panel, x, h / 2, z); o.userData.front = !!fr; W.tunnelShell.push(o); }
    const top = add(g, box(w, 0.2, d), M.white, 0, h, 0); top.userData.deck = true; W.tunnelShell.push(top);
    add(g, box(0.25, 2.6, 2.2), M.yellow, -w / 2, 1.3, 4);         // door (strip curtain) from the filling room
    // ceiling evaporator units with fans ("wind chill")
    W.evaps = [];
    for (let k = 0; k < 3; k++) { const u = new THREE.Group(); u.position.set(-4 + k * 4, h - 0.8, -d / 2 + 1.0); g.add(u);
      add(u, box(3.2, 0.9, 1.1), M.white); for (let f = 0; f < 3; f++) { const fan = new THREE.Group(); fan.position.set(-1 + f, 0, 0.58); u.add(fan); add(fan, cyl(0.38, 0.05, 20).rotateX(Math.PI / 2), M.dark); for (let b = 0; b < 4; b++) { const bl = add(fan, box(0.06, 0.6, 0.02), M.ss); bl.rotation.z = b * Math.PI / 4; } W.spin.push({ o: fan, w: 22, axis: "z" }); }
      W.evaps.push(u); }
    W.frost = add(g, box(12.2, 0.95, 1.15), new THREE.MeshStandardMaterial({ color: "#f6fbff", roughness: 1, transparent: true, opacity: 0 }), 0, h - 0.8, -d / 2 + 1.0);
    // pallets of red pints and 3-gallon tubs
    const cupGeo = cyl(0.045, 0.085, 10, 0.042), tubGeo = cyl(0.133, 0.255, 14, 0.125);
    const stacks = []; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) stacks.push([-5.5 + i * 2.2, 0.8 + j * 1.6, (i + j) % 2]);
    const nT = stacks.filter(s => s[2]).length * 16 * 2, nC = stacks.filter(s => !s[2]).length * 100;
    const tubs = new THREE.InstancedMesh(tubGeo, M.cup, nT), cups = new THREE.InstancedMesh(cupGeo, M.cup, nC);
    const M4 = new THREE.Matrix4(); let it = 0, ic = 0;
    for (const [x, z, isTub] of stacks) { add(g, box(1.2, 0.14, 1.0), M.pallet, x, 0.07, z);
      if (isTub) { for (let l = 0; l < 2; l++) for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) { M4.makeTranslation(x - 0.42 + a * 0.28, 0.27 + l * 0.27, z - 0.36 + b * 0.24); tubs.setMatrixAt(it++, M4); } }
      else { for (let l = 0; l < 4; l++) for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) { M4.makeTranslation(x - 0.4 + a * 0.2, 0.19 + l * 0.09, z - 0.4 + b * 0.2); cups.setMatrixAt(ic++, M4); } } }
    tubs.count = it; cups.count = ic; g.add(tubs, cups);
    W.stations.tunnel = new THREE.Vector3(TX, 2, TZ);
  }
  label(W.labels, "tunnel", "Deep freezer (−20 °F)", [TX, 7.4, TZ]);
  // Dairy Store at the front (glass storefront, dipping cabinet)
  { const g = new THREE.Group(); g.position.set(65, 0, 9.9); root.add(g); W.store = g;
    const sroof = add(g, box(16.4, 0.3, 8), M.dark, 0, 4.6, 0.3); sroof.userData.deck = true; W.roofs.push(sroof);
    for (const x of [-8, 8]) add(g, box(0.3, 4.5, 8), M.brick, x, 2.25, 0.3);
    add(g, box(16, 0.08, 7.6), M.white, 0, 0.02, 0);
    add(g, box(16, 4.5, 0.12), M.panel, 0, 2.25, -3.8);
    const sf = add(g, box(16, 3.2, 0.08), M.glass, 0, 1.8, 4.4); sf.userData.front = true; W.walls.push(sf);
    add(g, box(5.5, 1.0, 1.0), M.red, -2, 0.5, -1.5); add(g, box(5.5, 0.35, 1.0), M.glass, -2, 1.18, -1.5);       // dipping cabinet
    for (let k = 0; k < 8; k++) add(g, cyl(0.13, 0.2, 14), M.cup, -4.3 + k * 0.65, 0.95, -1.5);
    for (const [x, z] of [[3, 1], [5.5, 1], [3, 2.8], [5.5, 2.8]]) { add(g, cyl(0.45, 0.04, 20), M.white, x, 0.75, z); add(g, cyl(0.05, 0.75, 8), M.dark, x, 0.37, z); }
    person(g, -2, 0.2, Math.PI, "#c5050c", { net: false, skin: "#b9875e", hair: "#1f1a17", h: 0.92 }); person(g, -0.6, 0.4, Math.PI + 0.3, "#2f6fb0", { net: false, woman: true, skin: "#f1c9a5", hair: "#b08a50", h: 0.97 });
    person(g, -2.4, -2.4, 0, "#ffffff", { woman: true, skin: "#5c3a24", hair: "#1f1a17", h: 0.95 });   // staff serving behind the cabinet
    W.stations.store = new THREE.Vector3(65, 1.5, 9.9);
  }
  label(W.labels, "store", "Dairy Store", [65, 5.6, 9.9]);

  // ---------- 7. refrigeration machine room (behind the hall) + evaporative condensers (assumed; not described publicly) ----------
  const MX = 30, MZ = -27;
  { const g = new THREE.Group(); g.position.set(MX, 0, MZ); root.add(g); W.mroom = g;
    add(g, new THREE.PlaneGeometry(24, 13).rotateX(-Math.PI / 2), M.concrete, 0, 0.02, 0);
    const mw = (x, z, w, d, fr) => { const o = add(g, box(w, 5.5, d), M.brick, x, 2.75, z); o.userData.front = !!fr; W.walls.push(o); };
    mw(0, -6.5, 24, 0.3, 1); mw(-12, 0, 0.3, 13); mw(12, 0, 0.3, 13); mw(0, 6.5, 24, 0.3);
    for (let k = 0; k < 2; k++) { const p = new THREE.Group(); p.position.set(-5 + k * 7, 0, -1.5); g.add(p);
      add(p, box(4.4, 0.3, 1.8), M.dark, 0, 0.15, 0); add(p, cyl(0.42, 1.4, 28).rotateZ(Math.PI / 2), M.blue, -1.3, 0.8, 0);
      add(p, box(1.0, 0.75, 0.75), M.red, 0.2, 0.72, 0); add(p, cyl(0.38, 1.8, 28).rotateZ(Math.PI / 2), M.red, 1.2, 1.35, -0.2);
      const cpl = new THREE.Group(); cpl.position.set(-0.45, 0.8, 0); p.add(cpl); add(cpl, cyl(0.18, 0.18, 16).rotateZ(Math.PI / 2), M.yellow); W.spin.push({ o: cpl, w: 30, axis: "x" }); }
    add(g, cyl(0.6, 4.4, 28).rotateZ(Math.PI / 2), M.yellow, -3, 1.0, 4); legs(g, -3, 4, 0.45, 0.4);
    add(g, cyl(0.8, 3.0, 28).rotateZ(Math.PI / 2), M.insul, 5, 1.5, 3.8);
    W.stations.mroom = new THREE.Vector3(MX, 1.5, MZ);
  }
  label(W.labels, "mroom", "Ammonia machine room", [MX, 7, MZ]);
  W.plumes = [];
  { const g = new THREE.Group(); g.position.set(MX + 16, 0, MZ); root.add(g);
    const c = new THREE.Group(); g.add(c); add(c, box(3.2, 4, 4.4), M.ssDark, 0, 2, 0); add(c, box(3.3, 0.3, 4.5), M.red, 0, 4.15, 0);
    const fan = new THREE.Group(); fan.position.set(0, 4.35, 0); c.add(fan); add(fan, cyl(1.25, 0.06, 32), M.dark);
    for (let b = 0; b < 5; b++) { const arm = new THREE.Group(); arm.rotation.y = b / 5 * Math.PI * 2; fan.add(arm); add(arm, box(1.1, 0.03, 0.24), M.ss, 0.55, 0.05, 0); }
    W.spin.push({ o: fan, w: 10, axis: "y" }); add(c, cyl(1.3, 0.6, 32), M.ssDark, 0, 4.6, 0);
    const puffMat = new THREE.SpriteMaterial({ color: "#ffffff", transparent: true, opacity: 0.25, depthWrite: false });
    for (let i = 0; i < 12; i++) { const s = new THREE.Sprite(puffMat.clone()); s.userData = { base: new THREE.Vector3(MX + 16, 5.1, MZ), phase: Math.random() }; root.add(s); W.plumes.push(s); }
    W.stations.condenser = new THREE.Vector3(MX + 16, 3, MZ);
  }
  label(W.labels, "condenser", "Evaporative condenser", [MX + 16, 7.2, MZ]);

  // ---------- 8. CIP skid (process room) ----------
  { const g = new THREE.Group(); g.position.set(15, 0, 2.5); root.add(g);
    [-1.5, 0, 1.5].forEach(x => tank(g, x, 0, 1.1, 1.7, { legs: 0.4, manway: true }));
    add(g, box(4.4, 0.15, 1.9), M.ssDark, 0, 0.07, 0); add(g, cyl(0.17, 0.45, 18).rotateZ(Math.PI / 2), M.blue, 0, 0.35, 1.15);
    for (const [x, c] of [[-1.5, "#2f5d86"], [0, "#c5050c"], [1.5, "#e2b42a"]]) add(g, cyl(0.57, 0.14, 40), std(c), x, 1.25, 0);
    W.stations.cip = new THREE.Vector3(15, 1.2, 2.5);
  }
  label(W.labels, "cip", "CIP skid", [15, 3.4, 2.5]);

  // ---------- product route (tracers coloured by temperature) ----------
  const route = [
    [-29.5, 1.2, 4, "raw"], [-29.5, 3.4, 4, "raw"], [-20, 3.4, 4, "raw"], [-20, 6.1, -9, "raw"], [-15, 5.0, -9, "raw"],
    [-5, 5.0, -8, "raw"], [-5, 3.6, -8, "blend"], [-1, 3.6, -8, "blend"], [-1, 2.2, -10.5, "blend"], [8.5, 2.2, -10.5, "blend"],
    [9.75, 1.6, -9.25, "homog"], [9.75, 2.6, -7.6, "homog"], [HX - 1.1, 2.6, -7.6, "regenIn"], [HX - 0.5, 1.4, -8.6, "regenOut"],
    [HX + 0.2, 1.4, -8.6, "heated"], [HX + 0.2, 2.4, -5.5, "heated"], [HX - 1.6, 1.7, -5.5, "hold0"], [HX + 1.4, 1.0, -5.5, "hold1"],
    [HX + 1.9, 1.7, -5.5, "hold1"], [HX + 1.9, 2.4, -7.6, "hold1"], [HX - 1.0, 2.0, -9.4, "regenHot"], [HX - 0.3, 0.6, -9.4, "regenHotOut"],
    [HX + 0.5, 0.6, -9.4, "cooled"], [HX + 0.5, 3.3, -7.2, "cooled"], [AX, 3.3, -7.2, "cooled"], [AX, 4.6, -9, "aged"],
    [AX + 5, 4.6, -9, "aged"], [AX + 5, 3.3, -2.0, "aged"], [FX - 1.0, 3.3, -2, "aged"], [FX - 1.0, 1.85, -2, "aged"],
    [FX + 0.9, 1.85, -2, "draw"], [FX + 3, 1.5, -2, "draw"], [FIL - 0.3, 1.9, -2, "draw"],
  ];
  W.route = route;
  for (let i = 0; i < route.length - 1; i++) { const a = route[i], b = route[i + 1]; if (["regenIn", "regenOut", "regenHot", "hold0"].includes(a[3]) && a[1] < 1.5) continue; W.product.push(pipe(root, a.slice(0, 3), b.slice(0, 3), 0.03, M.ssPolish)); }
  // ammonia lines (insulated) from machine room to the freezer and the deep freezer room
  for (const pts of [[[MX, 3.2, MZ + 6.5], [MX, 7.6, MZ + 6.5], [MX, 7.6, -6], [FX, 7.6, -6], [FX, 2.1, -2.2]], [[MX + 5, 3.2, MZ + 6.5], [MX + 5, 8, MZ + 6.5], [MX + 5, 8, -15], [TX, 8, -15], [TX, 6.2, TZ - 9]]]) W.nh3.push(...polyPipe(root, pts, 0.08, M.insul));
  // conveyor: filler → strip-curtain door of the deep freezer, then an accumulation rack inside (serpentine on 3 tiers)
  const conv = [[FIL + 1.6, 0.95, -2], [TX - 8, 0.95, -2]];
  const rack = []; const lanes = 6, tiers = 3, zA = TZ - 6.5, zB = TZ + 3.5;
  for (let t = 0; t < tiers; t++) for (let k = 0; k < lanes; k++) { const x = TX - 7 + k * 0.9 + t * 0.0, y = 0.95 + t * 1.0, za = (k + t * lanes) % 2 ? zB : zA, zb = (k + t * lanes) % 2 ? zA : zB; rack.push([x, y, za], [x, y, zb]); }
  W.cartonPath = [...conv, [TX - 7, 0.95, -2], ...rack];
  add(root, box(conv[1][0] - conv[0][0], 0.08, 0.45), M.dark, (conv[0][0] + conv[1][0]) / 2, 0.88, -2);
  for (let t = 0; t < tiers; t++) { const y = 0.88 + t * 1.0; add(root, box(lanes * 0.9, 0.06, zB - zA + 0.4), M.ssDark, TX - 7 + (lanes - 1) * 0.45, y, (zA + zB) / 2); }
  for (const x of [TX - 7.4, TX - 7 + lanes * 0.9 - 0.5]) for (const z of [zA - 0.2, zB + 0.2]) add(root, box(0.06, 3, 0.06), M.ssDark, x, 1.5, z);
  // pint cups (instanced) riding the path
  const N = 320;
  const cups = new THREE.InstancedMesh(CARTON, M.carton, N); cups.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  cups.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3); root.add(cups);
  const lids = new THREE.InstancedMesh(cyl(0.047, 0.01, 28), M.lid, N); lids.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(lids);
  W.cartons = { mesh: cups, lids, N };
  const P = W.cartonPath, segL = []; let tot = 0; for (let i = 0; i < P.length - 1; i++) { const l = Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1], P[i + 1][2] - P[i][2]); segL.push(l); tot += l; }
  W.cartonSeg = { segL, tot, convLen: segL[0] + segL[1] };
  W.X = { HX, AX, FX, FIL, TX, TZ, MX, MZ }; W.B = B;
  return W;
}

// cup path: s in [0, 1) along conveyor then the accumulation rack inside the deep freezer; returns the phase
export function cartonPos(W, s, out) {
  const P = W.cartonPath, { segL, tot, convLen } = W.cartonSeg; let d = s * tot;
  for (let i = 0; i < segL.length; i++) { if (d <= segL[i] || i === segL.length - 1) { const k = Math.min(1, d / segL[i]); out.set(P[i][0] + (P[i + 1][0] - P[i][0]) * k, P[i][1] + (P[i + 1][1] - P[i][1]) * k + 0.045, P[i][2] + (P[i + 1][2] - P[i][2]) * k); break; } d -= segL[i]; }
  return s * tot < convLen ? "conveyor" : "room";
}
export function roomFrac(W, s) { const { tot, convLen } = W.cartonSeg; return Math.max(0, (s * tot - convLen) / (tot - convLen)); }
