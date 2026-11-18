// 3D world for the Lithium-Ion Battery application: a supply-chain landscape (1 unit = 1 m) with stations from the
// lithium mines to the recycling plant, plus "zoom" stations floating above the EV for the module, the cell,
// the electrode particles and the crystal lattice (each drawn enlarged, with its true size in the label).
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { buildCar, buildPack, contactShadow } from "./car.js";


export const EV_SCALE = 2, EV_Z = -50;   // EV hub drawn 2.5x and set back from the road
export const AT = {
  // stages pulled close together so each reads clearly from the overview (Part M)
  mine: new THREE.Vector3(-650, 0, 0), refinery: new THREE.Vector3(-385, 0, 0), materials: new THREE.Vector3(-135, 0, 0),
  factory: new THREE.Vector3(115, 0, 0), ev: new THREE.Vector3(365, 0, 0), recycle: new THREE.Vector3(620, 0, 0),
  // zoom stations (enlarged)
  module: new THREE.Vector3(450, 260, -700), cell: new THREE.Vector3(700, 260, -700), particles: new THREE.Vector3(950, 260, -700), lattice: new THREE.Vector3(1200, 260, -700),
};

export function canvasTex(w, h, draw, rep = [1, 1]) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

// ---------- procedural surface detail (Part H): height fields → normal and roughness maps, real-world repeats ----------
function hfield(w, h, draw) { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); g.fillStyle = "#808080"; g.fillRect(0, 0, w, h); draw(g, w, h); return c; }
function texFrom(c, rep) { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.colorSpace = THREE.NoColorSpace; t.anisotropy = 8; return t; }
function normalFrom(hc, k, rep) {
  const w = hc.width, h = hc.height, src = hc.getContext("2d").getImageData(0, 0, w, h).data;
  const out = document.createElement("canvas"); out.width = w; out.height = h; const g = out.getContext("2d"); const img = g.createImageData(w, h);
  const H = (x, y) => src[((((y % h) + h) % h) * w + (((x % w) + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * k, dy = (H(x, y + 1) - H(x, y - 1)) * k, l = Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
    img.data[i] = (-dx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (dy / l * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0); return texFrom(out, rep);
}
const rnd = Math.random;
const H_BRUSH = hfield(256, 256, (g, w, h) => { for (let i = 0; i < 1400; i++) { const v = 90 + rnd() * 80 | 0; g.fillStyle = `rgba(${v},${v},${v},.35)`; g.fillRect(0, rnd() * h, w, 0.6 + rnd()); } });
const H_SPECK = hfield(256, 256, (g, w, h) => { for (let i = 0; i < 9000; i++) { const v = rnd() * 255 | 0; g.fillStyle = `rgba(${v},${v},${v},.5)`; const r = 0.5 + rnd() * 1.6; g.fillRect(rnd() * w, rnd() * h, r, r); } });
const H_PEEL = hfield(128, 128, (g, w, h) => { for (let i = 0; i < 700; i++) { const v = 100 + rnd() * 60 | 0; g.fillStyle = `rgba(${v},${v},${v},.25)`; g.beginPath(); g.arc(rnd() * w, rnd() * h, 2 + rnd() * 5, 0, 7); g.fill(); } });
const H_ASPH = hfield(256, 256, (g, w, h) => { for (let i = 0; i < 16000; i++) { const v = rnd() * 255 | 0; g.fillStyle = `rgba(${v},${v},${v},.7)`; const r = 0.6 + rnd() * 2.2; g.fillRect(rnd() * w, rnd() * h, r, r); } });
const ROUGH = (c, lo, hi, rep) => { const o = document.createElement("canvas"); o.width = c.width; o.height = c.height; const g = o.getContext("2d"); g.drawImage(c, 0, 0); const d = g.getImageData(0, 0, o.width, o.height); for (let i = 0; i < d.data.length; i += 4) { const v = lo + (hi - lo) * d.data[i] / 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v * 255; } g.putImageData(d, 0, 0); return texFrom(o, rep); };
export const DETAIL = {
  brushN: normalFrom(H_BRUSH, 2.2, [3, 3]), brushR: ROUGH(H_BRUSH, 0.7, 1.15, [3, 3]),
  speckN: normalFrom(H_SPECK, 3.0, [8, 8]), speckR: ROUGH(H_SPECK, 0.8, 1.0, [8, 8]),
  peelN: normalFrom(H_PEEL, 1.5, [6, 6]),
  asphN: normalFrom(H_ASPH, 2.0, [120, 80]), asphR: ROUGH(H_ASPH, 0.82, 1.0, [120, 80]),
};
const speck = (base, dark, light, n = 5000, s = 2) => (g, w, h) => {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) { g.fillStyle = Math.random() < .5 ? dark : light; g.globalAlpha = Math.random() * .35; g.fillRect(Math.random() * w, Math.random() * h, s, s); }
  g.globalAlpha = 1;
};
const M = (o) => new THREE.MeshStandardMaterial(o);
const steel = M({ color: "#c9ced4", metalness: 1, roughness: 0.32, roughnessMap: DETAIL.brushR, normalMap: DETAIL.brushN, normalScale: new THREE.Vector2(0.25, 0.25) });
const galv = M({ color: "#a3a9ad", metalness: 0.85, roughness: 0.48, roughnessMap: DETAIL.speckR, normalMap: DETAIL.speckN, normalScale: new THREE.Vector2(0.15, 0.15) });
const paintBlue = M({ color: "#2f5f9a", roughness: 0.5, metalness: 0.3, normalMap: DETAIL.peelN, normalScale: new THREE.Vector2(0.12, 0.12) });
const paintYellow = M({ color: "#e0a526", roughness: 0.48, metalness: 0.3, normalMap: DETAIL.peelN, normalScale: new THREE.Vector2(0.12, 0.12) });
const paintGrey = M({ color: "#6b7177", roughness: 0.6, metalness: 0.2, normalMap: DETAIL.peelN, normalScale: new THREE.Vector2(0.1, 0.1) });
const concrete = M({ color: "#b9b7b0", roughness: 0.95, map: canvasTex(256, 256, speck("#b9b7b0", "#77756f", "#e3e1da", 6000), [6, 6]), normalMap: DETAIL.speckN, normalScale: new THREE.Vector2(0.5, 0.5), roughnessMap: DETAIL.speckR });
const cladding = M({ color: "#d8dcdf", roughness: 0.6, metalness: 0.3, map: canvasTex(128, 128, (g, w, h) => { g.fillStyle = "#d8dcdf"; g.fillRect(0, 0, w, h); g.fillStyle = "#b9bfc4"; for (let x = 0; x < w; x += 8) g.fillRect(x, 0, 2, h); }, [10, 2]) });

// bevelled box: real equipment has rounded edges
export function rbox(w, h, d) { const r = Math.min(w, h, d) * 0.12; return r < 0.01 ? new THREE.BoxGeometry(w, h, d) : new RoundedBoxGeometry(w, h, d, 2, r); }
function mesh(geo, mat, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  if (parent) parent.add(m); return m;
}
const boltGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.12, 6), railM = M({ color: "#e0a526", roughness: 0.5, metalness: 0.3 });
function boltRing(parent, R, y, n) {
  const im = new THREE.InstancedMesh(boltGeo, steel, n), m4 = new THREE.Matrix4();
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; m4.makeTranslation(Math.cos(a) * R, y, Math.sin(a) * R); im.setMatrixAt(i, m4); }
  parent.add(im); return im;
}
function tank(parent, x, z, r, h, mat = steel, cone = false) {
  const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
  const y0 = cone ? r : 0;
  mesh(new THREE.CylinderGeometry(r, r, h, 48), mat, 0, h / 2 + y0, 0, g);
  mesh(new THREE.SphereGeometry(r, 48, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat, 0, h + y0, 0, g).scale.y = 0.3;
  // body flanges with bolt rings, and a manway on the shell
  for (const fy of [y0 + 0.15, y0 + h * 0.5, y0 + h - 0.1]) { mesh(new THREE.TorusGeometry(r + 0.06, 0.09, 8, 48).rotateX(Math.PI / 2), steel, 0, fy, 0, g).castShadow = false; boltRing(g, r + 0.12, fy, Math.max(16, Math.round(r * 8))); }
  const mw = mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.35, 24).rotateZ(Math.PI / 2), steel, r + 0.12, y0 + 1.1, 0, g);
  // top platform handrail (posts + ring) and a caged ladder up the side
  const topY = h + y0 + r * 0.3;
  mesh(new THREE.TorusGeometry(r * 0.75, 0.035, 6, 48).rotateX(Math.PI / 2), railM, 0, topY + 1.05, 0, g).castShadow = false;
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.05, 6), railM, Math.cos(a) * r * 0.75, topY + 0.52, Math.sin(a) * r * 0.75, g).castShadow = false; }
  const lad = new THREE.Group(); lad.position.set(-r - 0.35, 0, 0); g.add(lad);
  const LH = topY + 1;
  for (const dz of [-0.22, 0.22]) mesh(new THREE.CylinderGeometry(0.03, 0.03, LH, 6), railM, 0, LH / 2, dz, lad);
  const rungs = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.018, 0.018, 0.44, 5).rotateX(Math.PI / 2), railM, Math.floor(LH / 0.3)); const m4 = new THREE.Matrix4();
  for (let i = 0; i < rungs.count; i++) { m4.makeTranslation(0, 0.3 * (i + 1), 0); rungs.setMatrixAt(i, m4); } lad.add(rungs);
  for (let y = 2.4; y < LH; y += 0.9) mesh(new THREE.TorusGeometry(0.4, 0.02, 4, 16, Math.PI).rotateY(Math.PI / 2), railM, -0.05, y, 0, lad).castShadow = false;
  if (cone) { mesh(new THREE.ConeGeometry(r, r, 48).rotateX(Math.PI), mat, 0, r / 2, 0, g); for (const a of [0, 2.1, 4.2]) mesh(new THREE.CylinderGeometry(0.25, 0.25, r * 1.2, 8), paintGrey, Math.cos(a) * r * 0.9, r * 0.6, Math.sin(a) * r * 0.9, g); }
  else for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4; mesh(rbox(0.6, 0.35, 0.6), concrete, Math.cos(a) * r * 0.7, -0.05, Math.sin(a) * r * 0.7, g); }
  return g;
}
// people: simple but proportioned (1.75 m), hard hat and hi-vis vest for plant workers
const SKIN = {};   // one material per skin tone, shared by all figures with that tone
const skinOf = c => SKIN[c] || (SKIN[c] = new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.6, sheen: 0.15, sheenColor: new THREE.Color("#e8b090") }));
const skinM = skinOf("#a86f4c");
export function person(parent, x, z, ry = 0, opts = {}) {
  // ~1.75 m figure: tapered limbs (cylinders with rounded joints), shaped torso (lathe), shoulders, neck, hands, feet
  // opts: woman (narrower shoulders and waist, hair tied back), h (height scale), skin (tone), hairStyle ("bun" | "pony" | "short")
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; g.scale.setScalar(opts.h || (opts.woman ? 0.95 : 1)); parent.add(g);
  const skinM = skinOf(opts.skin || "#a86f4c"), W = !!opts.woman;
  const fold = new THREE.Vector2(0.18, 0.18);
  const cloth = new THREE.MeshPhysicalMaterial({ color: opts.pants || "#2d3a4f", roughness: 0.88, sheen: 0.2, sheenColor: new THREE.Color("#6f7f95"), normalMap: DETAIL.peelN, normalScale: fold });
  const top = new THREE.MeshPhysicalMaterial({ color: opts.shirt || "#e6e8ea", roughness: 0.82, sheen: 0.15, sheenColor: new THREE.Color("#8090a0"), normalMap: DETAIL.peelN, normalScale: fold });
  const shoe = M({ color: "#202124", roughness: 0.6 });
  const limb = (r0, r1, len, mat) => { const gg = new THREE.Group(); const c = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, len, 14), mat); c.position.y = -len / 2; c.castShadow = true; gg.add(c); const j = new THREE.Mesh(new THREE.SphereGeometry(r0, 14, 10), mat); j.castShadow = true; gg.add(j); return gg; };
  const step = opts.step || 0;
  for (const sd of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(0, 0.93, sd * 0.095); hip.rotation.z = sd * step; g.add(hip);
    const thigh = limb(0.085, 0.06, 0.45, cloth); hip.add(thigh);
    const knee = new THREE.Group(); knee.position.y = -0.45; knee.rotation.z = -Math.abs(step) * 0.6; thigh.add(knee);
    const shin = limb(0.058, 0.042, 0.42, cloth); knee.add(shin);
    const foot = mesh(rbox(0.25, 0.07, 0.095), shoe, 0.06, -0.455, 0, knee);
  }
  // torso: lathe profile from hips to shoulders (front-back flattened)
  const prof = (W ? [[0.0, 0.0], [0.16, 0.0], [0.17, 0.08], [0.135, 0.24], [0.15, 0.38], [0.175, 0.5], [0.175, 0.54], [0.11, 0.6], [0.0, 0.62]] : [[0.0, 0.0], [0.15, 0.0], [0.165, 0.08], [0.15, 0.22], [0.165, 0.38], [0.2, 0.5], [0.2, 0.54], [0.12, 0.6], [0.0, 0.62]]).map(([r, y]) => new THREE.Vector2(r, y));
  const torso = mesh(new THREE.LatheGeometry(prof, 24), top, 0, 0.9, 0, g); torso.scale.set(0.62, 1, 1);
  if (opts.vest) { const v = mesh(new THREE.LatheGeometry(prof.slice(1, 7).map(p => new THREE.Vector2(p.x * 1.06, p.y)), 24, 0, Math.PI * 2), M({ color: opts.vest, roughness: 0.6, emissive: opts.vest, emissiveIntensity: 0.06 }), 0, 0.9, 0, g); v.scale.set(0.64, 1, 1.02); }
  for (const sd of [-1, 1]) {   // arms hang slightly away from the body with a soft elbow
    const sh = new THREE.Group(); sh.position.set(0, 1.42, sd * (W ? 0.178 : 0.2)); sh.rotation.x = sd * 0.12; sh.rotation.z = -sd * step * 0.8; g.add(sh);
    const upper = limb(0.052, 0.044, 0.3, top); sh.add(upper);
    const el = new THREE.Group(); el.position.y = -0.3; el.rotation.z = 0.18; upper.add(el);
    const fore = limb(0.042, 0.033, 0.26, opts.short ? skinM : top); el.add(fore);
    mesh(new THREE.SphereGeometry(0.045, 12, 10), skinM, 0, -0.29, 0, el).scale.set(0.8, 1.25, 0.55);   // hand
  }
  mesh(new THREE.CylinderGeometry(0.048, 0.056, 0.09, 12), skinM, 0, 1.55, 0, g);   // neck
  const head = mesh(new THREE.SphereGeometry(0.1, 24, 18), skinM, 0.01, 1.68, 0, g); head.scale.set(0.92, 1.18, 0.86);
  mesh(new THREE.SphereGeometry(0.06, 14, 10), skinM, 0.045, 1.625, 0, g).scale.set(0.9, 0.7, 1.2);   // jaw
  const hairM = M({ color: opts.hair || "#3b2a20", roughness: 0.9 }), style = opts.hairStyle || (W ? "pony" : "short");
  if (style === "bun") mesh(new THREE.SphereGeometry(0.05, 14, 10), hairM, -0.1, 1.66, 0, g);
  if (style === "pony") { const pt = mesh(new THREE.CylinderGeometry(0.03, 0.012, 0.2, 10), hairM, -0.11, 1.56, 0, g); pt.rotation.z = -0.25; mesh(new THREE.SphereGeometry(0.035, 12, 8), hairM, -0.095, 1.66, 0, g); }
  if (opts.tablet) mesh(rbox(0.16, 0.22, 0.015), M({ color: "#1f2a36", roughness: 0.4 }), 0.22, 1.12, 0.12, g).rotation.set(0.2, 0, -0.9);   // tablet / clipboard in hand
  if (opts.hat) { mesh(new THREE.SphereGeometry(0.118, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), M({ color: opts.hat, roughness: 0.35 }), 0.01, 1.72, 0, g).scale.set(1.05, 0.95, 1); mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.01, 24), M({ color: opts.hat, roughness: 0.35 }), 0.035, 1.725, 0, g); }
  else mesh(new THREE.SphereGeometry(0.104, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2.1), hairM, -0.005, 1.7, 0, g).scale.set(0.95, 1.05, 0.9);
  return g;
}
const WORKER = { vest: "#f2c300", hat: "#f5f5f2", shirt: "#3f5f86", pants: "#2b2f36" };
// trees: varied deciduous crowns on trunks, instanced
export function trees(scene, pts) {
  // tapered trunk; canopy = cluster of jittered icospheres merged into one mesh, leaf-coloured per instance
  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.3, 3.2, 9); trunkGeo.translate(0, 1.6, 0);
  const parts = [];
  for (const [ox, oy, oz, r] of [[0, 4.4, 0, 1.9], [0.9, 4.0, 0.4, 1.3], [-0.8, 4.1, -0.5, 1.4], [0.2, 5.3, -0.2, 1.3], [-0.3, 3.7, 0.9, 1.1]]) {
    const ge = new THREE.IcosahedronGeometry(r, 3); const p = ge.attributes.position;
    for (let i = 0; i < p.count; i++) { const k = 1 + (Math.sin(p.getX(i) * 5.1) * Math.cos(p.getZ(i) * 4.3) + Math.sin(p.getY(i) * 6.7)) * 0.06; p.setXYZ(i, p.getX(i) * k + ox, p.getY(i) * k + oy, p.getZ(i) * k + oz); }
    parts.push(ge);
  }
  const crownGeo = mergeGeometries(parts); crownGeo.computeVertexNormals();
  const trunk = new THREE.InstancedMesh(trunkGeo, M({ color: "#5b4636", roughness: 0.95, normalMap: DETAIL.speckN, normalScale: new THREE.Vector2(0.8, 0.8) }), pts.length);
  const crown = new THREE.InstancedMesh(crownGeo, M({ color: "#ffffff", roughness: 0.85, normalMap: DETAIL.speckN, normalScale: new THREE.Vector2(1.2, 1.2) }), pts.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  pts.forEach(([x, z, s], i) => {
    q.setFromEuler(new THREE.Euler(0, Math.random() * 6.3, 0));
    m4.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(s, s, s)); trunk.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(s * (0.9 + Math.random() * 0.25), s * (0.9 + Math.random() * 0.3), s * (0.9 + Math.random() * 0.25))); crown.setMatrixAt(i, m4);
    crown.setColorAt(i, c.setHSL(0.22 + Math.random() * 0.08, 0.38 + Math.random() * 0.2, 0.24 + Math.random() * 0.1));
  });
  trunk.castShadow = crown.castShadow = true; trunk.receiveShadow = crown.receiveShadow = true;
  scene.add(trunk, crown); return [trunk, crown];
}
function pipe(parent, pts, r = 0.4, mat = galv) {
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)), false, "catmullrom", 0.05);
  return mesh(new THREE.TubeGeometry(curve, 60, r, 8), mat, 0, 0, 0, parent);
}
function label3D(text, w = 40) {
  const tex = canvasTex(512, 96, (g, W, H) => { g.fillStyle = "rgba(247,248,249,0.92)"; g.fillRect(0, 0, W, H); g.fillStyle = "#1b2229"; let fs = 46; do { g.font = `600 ${fs}px Barlow, sans-serif`; fs -= 2; } while (g.measureText(text).width > W - 24 && fs > 14); g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, W / 2, H / 2 + 2); });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false })); s.scale.set(w, w * 96 / 512, 1); return s;
}

function lab(text, w, x, y, z) { const s = label3D(text, w); s.position.set(x, y, z); s.visible = false; return s; }
// a dark border under each plant plot gives contrast against the pale ground
function plotFrame(parent, w, d, x, z) { const f = new THREE.Mesh(new THREE.PlaneGeometry(w + 14, d + 14).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: "#4a463f", roughness: 1 })); f.position.set(x, 0.03, z); f.receiveShadow = true; parent.add(f); }
export function buildWorld(scene) {
  const W = { anim: [] };
  // ---------- ground: dry desert to the west (mines), farmland/industrial to the east ----------
  const groundTex = canvasTex(1024, 256, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, w, 0); grd.addColorStop(0, "#ad8b5c"); grd.addColorStop(0.25, "#a88a62"); grd.addColorStop(0.4, "#8d8c6e"); grd.addColorStop(1, "#788766");
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 30000; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? "60,50,35" : "255,245,225"},${Math.random() * .12})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  });
  // hole for the open pit
  const gs = new THREE.Shape([new THREE.Vector2(-5000, -4000), new THREE.Vector2(5000, -4000), new THREE.Vector2(5000, 4000), new THREE.Vector2(-5000, 4000)]);
  const PIT = { x: AT.mine.x + 40, z: 190, r: 95 };
  const hole = new THREE.Path(); hole.absarc(PIT.x, -PIT.z, PIT.r, 0, Math.PI * 2, true); gs.holes.push(hole);
  const gGeo = new THREE.ShapeGeometry(gs, 64).rotateX(-Math.PI / 2);
  groundTex.wrapS = groundTex.wrapT = THREE.ClampToEdgeWrapping;
  { const p = gGeo.attributes.position, uv = []; for (let i = 0; i < p.count; i++) uv.push((p.getX(i) + 1300) / 2800, (p.getZ(i) + 900) / 1800); gGeo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); }
  const ground = new THREE.Mesh(gGeo, M({ color: "#ffffff", roughness: 1, map: groundTex }));
  ground.receiveShadow = true; scene.add(ground);
  // road along the chain
  const road = mesh(new THREE.PlaneGeometry(1500, 22).rotateX(-Math.PI / 2), M({ color: "#33363a", roughness: 0.9 }), -10, 0.05, 60, scene); road.castShadow = false;
  const dash = canvasTex(256, 16, (g, w, h) => { g.fillStyle = "rgba(0,0,0,0)"; g.clearRect(0, 0, w, h); g.fillStyle = "#e8e2c8"; g.fillRect(0, 6, 128, 4); }, [80, 1]);
  mesh(new THREE.PlaneGeometry(1500, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: dash, transparent: true }), -10, 0.08, 60, scene);
  // distant mountains behind the salt flat (Andes-like backdrop)
  const rock = M({ color: "#6a5646", roughness: 1, flatShading: true });
  const snow = M({ color: "#b9bcc0", roughness: 1, flatShading: true });
  [[-1350, -1250, 210, 260], [-1150, -1350, 260, 330], [-950, -1300, 180, 220], [-760, -1380, 230, 300], [-1550, -1000, 160, 180]].forEach(([x, z, r, h]) => {
    const c = mesh(new THREE.ConeGeometry(r, h, 9, 3), rock, x, h / 2, z, scene); c.rotation.y = x;
    const s = mesh(new THREE.ConeGeometry(r * 0.28, h * 0.28, 9, 1), snow, x, h * 0.86 + 1, z, scene); s.rotation.y = x;
  });

  // ---------- 1. MINES: salt-flat brine ponds + hard-rock (spodumene) open pit ----------
  const mine = new THREE.Group(); mine.position.copy(AT.mine); scene.add(mine);
  plotFrame(mine, 330, 210, -20, -120);
  mesh(new THREE.PlaneGeometry(330, 210).rotateX(-Math.PI / 2), M({ color: "#ece9e1", roughness: 1, map: canvasTex(256, 256, speck("#ece9e1", "#c9c2b2", "#ffffff", 9000), [4, 3]) }), -20, 0.1, -120, mine).castShadow = false;
  // evaporation ponds: brine grows more concentrated (blue → green → yellow) as water evaporates
  const pondCols = ["#1f8fd0", "#14a9c4", "#19b8a8", "#4cc27a", "#b9cc2a", "#f2c81c"];
  W.ponds = [];
  pondCols.forEach((col, i) => {
    const r = Math.floor(i / 3), c = i % 3;
    const x = -125 + c * 90, z = -170 + r * 75;
    mesh(rbox(84, 1.2, 68), M({ color: "#d9d3c4", roughness: 1 }), x, 0.6, z, mine);
    const water = mesh(rbox(78, 0.4, 62), new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.08, metalness: 0, clearcoat: 1, transparent: true, opacity: 0.9 }), x, 1.15, z, mine);
    water.castShadow = false; W.ponds.push(water);
  });
  // brine wells and pumps
  for (let i = 0; i < 4; i++) { mesh(new THREE.CylinderGeometry(1.2, 1.2, 6, 12), paintBlue, -160 + i * 25, 3, -60, mine); mesh(rbox(3, 3, 3), paintYellow, -160 + i * 25, 7, -60, mine); }
  pipe(mine, [[-160, 2, -60], [-100, 2, -55], [-40, 2, -55], [-125, 2, -150]], 0.6);
  // open pit: terraced benches cut into the ground
  const benches = [];
  for (let k = 0; k <= 8; k++) { const r = PIT.r - k * 9.5, y = -k * 6; benches.push(new THREE.Vector2(r, y), new THREE.Vector2(r - 3.5, y)); if (k < 8) benches.push(new THREE.Vector2(r - 4, y - 6)); }
  benches.reverse();
  const pitGeo = new THREE.LatheGeometry(benches.map(v => new THREE.Vector2(v.x, v.y)), 72);
  const pitMat = M({ color: "#9a8a76", roughness: 1, side: THREE.DoubleSide, map: canvasTex(256, 256, speck("#9a8a76", "#5d5246", "#cdbfa9", 9000), [8, 2]) });
  const pit = mesh(pitGeo, pitMat, PIT.x - AT.mine.x, 0, PIT.z, mine); pit.castShadow = false;
  mesh(new THREE.CircleGeometry(PIT.r - 8 * 9.5 - 3.5, 40).rotateX(-Math.PI / 2), M({ color: "#6f8d84", roughness: 0.2 }), PIT.x - AT.mine.x, -47.8, PIT.z, mine);
  // haul road ramp, haul trucks, ore stockpile (spodumene is pale green-grey), crusher
  function truck(x, y, z, ry) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; mine.add(g);
    mesh(rbox(9, 3, 5.5), paintYellow, 0, 3.2, 0, g); mesh(rbox(3, 3, 5.5), paintYellow, 5.6, 4, 0, g);
    mesh(rbox(6, 2.5, 6), M({ color: "#8d8a80", roughness: 1 }), -1, 5.5, 0, g);
    for (const [wx, wz] of [[-3, 2.8], [-3, -2.8], [4.5, 2.8], [4.5, -2.8]]) mesh(new THREE.CylinderGeometry(1.6, 1.6, 1.4, 16).rotateX(Math.PI / 2), M({ color: "#222", roughness: 0.9 }), wx, 1.6, wz, g);
    return g;
  }
  W.truck = truck(PIT.x - AT.mine.x - 40, 0, PIT.z - 110, 0.2);
  truck(PIT.x - AT.mine.x + 20, -36, PIT.z + 30, 1.6);
  const pile = mesh(new THREE.ConeGeometry(28, 22, 24), M({ color: "#a9b3a3", roughness: 1, map: canvasTex(128, 128, speck("#a9b3a3", "#6f7a6c", "#dfe6da", 4000)) }), 120, 11, 120, mine);
  mesh(rbox(16, 14, 12), paintGrey, 150, 7, 60, mine);
  const conv = mesh(rbox(60, 1, 2.5), galv, 135, 12, 90, mine); conv.rotation.y = 1.1; conv.rotation.z = 0.25;
  mine.add(lab("Brine ponds", 49, -35, 30 + 14, -205));
  mine.add(lab("Hard-rock mine", 49, PIT.x - AT.mine.x, 34 + 14, PIT.z - 110));

  // ---------- 2. REFINERY: roasting kiln, leach and purification tanks, crystallizer, product silos ----------
  const ref = new THREE.Group(); ref.position.copy(AT.refinery); scene.add(ref);
  plotFrame(ref, 220, 170, 0, -20); mesh(rbox(220, 0.6, 170), concrete, 0, 0.3, -20, ref).castShadow = false;
  const kiln = new THREE.Group(); kiln.position.set(-40, 10, -60); kiln.rotation.z = -0.04; ref.add(kiln);
  const kilnBody = mesh(new THREE.CylinderGeometry(4.5, 4.5, 110, 40, 1, true).rotateZ(Math.PI / 2), M({ color: "#8a5a3c", roughness: 0.6, metalness: 0.5, side: THREE.DoubleSide }), 0, 0, 0, kiln);
  W.kiln = kilnBody;
  for (const x of [-40, 0, 40]) { mesh(new THREE.TorusGeometry(4.8, 0.6, 10, 40).rotateY(Math.PI / 2), steel, x, 0, 0, kiln); mesh(rbox(4, 8, 10), concrete, x, -7, 0, kiln); }
  W.kilnGlow = mesh(new THREE.CircleGeometry(4.4, 32).rotateY(Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.1, 0.25) }), 55.2, 0, 0, kiln);
  mesh(rbox(12, 22, 14), paintGrey, -62, 11, -60, ref);
  mesh(new THREE.CylinderGeometry(2, 2.6, 55, 16), M({ color: "#d0ccc4", roughness: 0.8 }), -62, 30, -72, ref);
  [[10, 10, 6, 12], [28, 10, 6, 12], [46, 10, 6, 12], [10, 30, 5, 10], [28, 30, 5, 10]].forEach(([x, z, r, h]) => tank(ref, x, z, r, h, steel));
  tank(ref, 70, 20, 8, 18, M({ color: "#e7e9ea", metalness: 0.5, roughness: 0.4 }), true);   // crystallizer
  for (let i = 0; i < 3; i++) tank(ref, 65 + i * 15, -50, 5, 22, M({ color: "#eef0f0", metalness: 0.2, roughness: 0.5 }), true);  // product silos
  for (let i = 0; i < 12; i++) mesh(rbox(1.4, 1.4, 1.4), M({ color: "#f6f6f2", roughness: 0.9 }), 30 + (i % 4) * 2, 0.9 + Math.floor(i / 8) * 1.4, -35 + Math.floor(i / 4) % 2 * 2, ref);
  pipe(ref, [[16, 8, 10], [16, 14, 0], [60, 14, 0], [70, 16, 14]], 0.5);
  pipe(ref, [[-60, 22, -60], [-10, 18, -30], [10, 14, 10]], 0.5);
  ref.add(lab("Lithium refinery", 49, 10, 42 + 14, -20));

  // ---------- 3. MATERIALS: cathode co-precipitation reactors + roller-hearth calcination kiln; graphite anode ----------
  const mat = new THREE.Group(); mat.position.copy(AT.materials); scene.add(mat);
  plotFrame(mat, 200, 160, 0, -20); mesh(rbox(200, 0.6, 160), concrete, 0, 0.3, -20, mat).castShadow = false;
  // stirred-tank reactors (precursor: mixed Ni-Mn-Co hydroxide)
  W.stirrers = [];
  for (let i = 0; i < 4; i++) {
    const t = tank(mat, -60 + i * 18, -50, 5.5, 12, M({ color: "#d9dde0", metalness: 0.6, roughness: 0.35 }));
    mesh(rbox(2.5, 2.5, 2.5), paintBlue, 0, 15.5, 0, t);
    const sh = mesh(new THREE.CylinderGeometry(0.2, 0.2, 4, 8), steel, 0, 18, 0, t); W.stirrers.push(sh);
  }
  // roller-hearth kiln: long insulated tunnel with ceramic saggers rolling through
  const rhk = new THREE.Group(); rhk.position.set(10, 0, 20); mat.add(rhk);
  mesh(rbox(110, 6, 8), M({ color: "#d4d0c8", roughness: 0.8 }), 0, 4, 0, rhk);
  mesh(rbox(110, 1, 9), paintBlue, 0, 7.5, 0, rhk);
  W.kilnSlot = mesh(rbox(108, 1.2, 0.3), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.0, 0.3) }), 0, 4, 4.05, rhk);
  W.saggers = [];
  for (let i = 0; i < 14; i++) { const s = mesh(rbox(2.6, 1.2, 2.6), M({ color: "#c9a27e", roughness: 0.9 }), -70 + i * 10, 1.2, 0, rhk); W.saggers.push(s); }
  // graphite anode material: black powder in big bags
  for (let i = 0; i < 8; i++) mesh(rbox(1.8, 1.8, 1.8), M({ color: "#26282b", roughness: 0.9 }), 60 + (i % 4) * 2.4, 1.5, -50 + Math.floor(i / 4) * 2.4, mat);
  mesh(rbox(60, 18, 40), cladding, 50, 9, -70, mat);
  mat.add(lab("Cathode & anode materials", 62, 0, 36 + 14, -20));

  // ---------- 4. CELL FACTORY: open-roof hall with coating line, drying oven, calender, winder, dry room, formation ----------
  const fac = new THREE.Group(); fac.position.copy(AT.factory); scene.add(fac);
  plotFrame(fac, 200, 120, 0, -10); mesh(rbox(200, 0.6, 120), M({ color: "#8f979d", roughness: 0.35, metalness: 0.1 }), 0, 0.3, -10, fac).castShadow = false;
  const wallM = M({ color: "#e8eaec", roughness: 0.7, side: THREE.DoubleSide });
  mesh(rbox(200, 14, 1), wallM, 0, 7, -70, fac); mesh(rbox(1, 14, 120), wallM, -100, 7, -10, fac); mesh(rbox(1, 14, 120), wallM, 100, 7, -10, fac);
  mesh(rbox(200, 3, 1), wallM, 0, 1.5, 50, fac);
  for (let x = -90; x <= 90; x += 30) mesh(rbox(0.8, 0.8, 120), galv, x, 14, -10, fac);
  // coating line: unwind roll → slot-die → 60 m drying oven → rewind roll
  const coat = new THREE.Group(); coat.position.set(-20, 0, -40); coat.scale.set(1.45, 2.2, 3); fac.add(coat);
  const foil = M({ color: "#d7b07a", metalness: 0.9, roughness: 0.25 });
  W.rolls = [];
  W.rolls.push(mesh(new THREE.CylinderGeometry(1.6, 1.6, 2, 32).rotateX(Math.PI / 2), foil, -50, 3, 0, coat));
  W.rolls.push(mesh(new THREE.CylinderGeometry(2.2, 2.2, 2, 32).rotateX(Math.PI / 2), M({ color: "#2b2d30", roughness: 0.6 }), 52, 3, 0, coat));
  const webTex = canvasTex(256, 16, (g, w, h) => { g.fillStyle = "#2d2f33"; g.fillRect(0, 0, w, h); g.fillStyle = "#3d4046"; for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 6, h); }, [30, 1]);
  W.webTex = webTex;
  mesh(new THREE.PlaneGeometry(102, 1.6).rotateX(-Math.PI / 2), M({ map: webTex, roughness: 0.6, side: THREE.DoubleSide }), 1, 4.6, 0, coat);
  mesh(rbox(2, 3, 3), steel, -40, 6, 0, coat);   // slot die
  mesh(rbox(70, 5, 5), M({ color: "#f0f1f2", roughness: 0.6 }), 5, 5.5, 0, coat);   // drying oven
  for (let x = -25; x <= 35; x += 10) mesh(new THREE.CylinderGeometry(0.6, 0.6, 3, 10), galv, x, 9.5, 0, coat);
  // calender: two big polished rollers
  mesh(new THREE.CylinderGeometry(1.8, 1.8, 3, 32).rotateX(Math.PI / 2), steel, 65, 3, -15, fac).position.y = 2;
  mesh(new THREE.CylinderGeometry(1.8, 1.8, 3, 32).rotateX(Math.PI / 2), steel, 65, 5.7, -15, fac);
  // dry room (low-humidity enclosure) with winders
  const dry = mesh(rbox(40, 8, 30), new THREE.MeshPhysicalMaterial({ color: "#cfe3f2", transparent: true, opacity: 0.35, roughness: 0.1 }), 60, 4, 25, fac); dry.castShadow = false;
  W.winders = [];
  for (let i = 0; i < 3; i++) W.winders.push(mesh(new THREE.CylinderGeometry(1.2, 1.2, 1.5, 24), M({ color: "#1f2124", roughness: 0.4 }), 50 + i * 10, 2.5, 25, fac));
  // formation racks: thousands of cells getting their first charge
  const rackM = M({ color: "#5d646b", roughness: 0.6 }), ledOn = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.6, 0.55) });
  W.leds = [];
  for (let r = 0; r < 4; r++) {
    const g = new THREE.Group(); g.position.set(-80 + r * 16, 0, 25); g.scale.setScalar(1.4); fac.add(g);
    mesh(rbox(10, 10, 4), rackM, 0, 5, 0, g);
    for (let s = 0; s < 4; s++) { const l = mesh(rbox(8, 0.3, 0.1), ledOn, 0, 2 + s * 2.2, 2.05, g); W.leds.push(l); }
  }
  fac.add(lab("Cell factory", 42, 0, 30 + 14, -10));

  // ---------- 5. EV: charging hub with cars; one car with see-through body and the pack under the floor ----------
  const ev = new THREE.Group(); ev.position.set(AT.ev.x, 0, EV_Z); ev.scale.setScalar(EV_SCALE); scene.add(ev);
  const asphalt = M({ color: "#ffffff", roughness: 0.9, roughnessMap: DETAIL.asphR, normalMap: DETAIL.asphN, normalScale: new THREE.Vector2(0.35, 0.35), map: canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = "#6d6f72"; g.fillRect(0, 0, w, h);   // mid-grey binder (albedo ≈ 0.15) with fine, low-contrast aggregate
    for (let i = 0; i < 60000; i++) { const v = rnd(); g.fillStyle = v < 0.5 ? `rgba(70,70,72,${0.12 + rnd() * 0.14})` : `rgba(140,138,133,${0.12 + rnd() * 0.16})`; const r = 0.5 + rnd() * 0.9; g.fillRect(rnd() * w, rnd() * h, r, r); }
    for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(40,40,42,${0.025 + rnd() * 0.03})`; g.beginPath(); g.ellipse(rnd() * w, rnd() * h, 20 + rnd() * 60, 10 + rnd() * 30, rnd() * 3, 0, 7); g.fill(); }   // faint wear patches
  }, [60, 40]) });
  const pad = mesh(rbox(120, 0.4, 80), asphalt, 0, 0.2, -10, ev); pad.castShadow = false;
  const wornTex = canvasTex(64, 512, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = "#f1efe6"; g.fillRect(0, 0, w, h); g.globalCompositeOperation = "destination-out"; for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,0,0,${0.3 + rnd() * 0.7})`; const r = 1 + rnd() * 4; g.fillRect(rnd() * w, rnd() * h, r, r); } }, [1, 1]);
  const paintM = new THREE.MeshStandardMaterial({ color: "#ffffff", map: wornTex, transparent: true, roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false });
  for (let i = 0; i < 6; i++) mesh(new THREE.PlaneGeometry(0.14, 5.4).rotateX(-Math.PI / 2), paintM, -18 + i * 6, 0.41, -1.6, ev).castShadow = false;   // bay lines between cars
  mesh(new THREE.PlaneGeometry(36, 0.14).rotateX(-Math.PI / 2), paintM.clone(), -3, 0.41, 1.1, ev).castShadow = false;
  // EV bay symbol on the hero bay
  mesh(new THREE.PlaneGeometry(1.6, 1.6).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: canvasTex(128, 128, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = "#3f9d5a"; g.fillRect(0, 0, w, h); g.fillStyle = "#ffffff"; g.beginPath(); g.moveTo(70, 14); g.lineTo(38, 70); g.lineTo(62, 70); g.lineTo(52, 114); g.lineTo(92, 52); g.lineTo(66, 52); g.closePath(); g.fill(); }), roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 }), -3, 0.415, 0.2, ev).castShadow = false;
  // curb and planted strip behind the chargers
  mesh(rbox(40, 0.18, 1.2), concrete, -3, 0.49, -6.2, ev);
  mesh(rbox(44, 0.3, 6), M({ color: "#4f7a3a", roughness: 0.95, normalMap: DETAIL.speckN, normalScale: new THREE.Vector2(0.8, 0.8), map: canvasTex(128, 128, speck("#4f7a3a", "#36562a", "#7aa25a", 4000, 2), [12, 2]) }), -3, 0.3, -10, ev);
  function car(x, z, color, xray = false) {
    const { g, paint } = buildCar(color, { xray }); g.position.set(x, 0.4, z); ev.add(g);
    const sh = contactShadow(5.4, 2.6, xray ? 0.5 : 0.6); sh.position.set(x, 0.415, z); sh.rotation.y = Math.PI / 2; ev.add(sh);
    return { g, bodyM: paint };
  }
  const cols = ["#9aa3ab", "#1f3350", "#e9e9e6", "#8a1c24", "#2a2d31"];
  for (let i = 0; i < 5; i++) if (i !== 2) { const c = car(-15 + i * 6, -1.6, cols[i]); c.g.rotation.y = Math.PI / 2; }
  const hero = car(-3, -1.6, "#9e0b12", true); hero.g.rotation.y = Math.PI / 2; W.heroBody = hero.bodyM; W.heroXray = true;
  // battery pack under the floor, seen through the x-ray paint
  const PK = buildPack(); PK.p.position.set(0, 0.3, 0); hero.g.add(PK.p); W.pack = PK.p; W.modules = PK.modules;
  // chargers: plinth, pedestal with display, holster and cable; hero car is plugged in
  const chBody = M({ color: "#f2f3f4", roughness: 0.35, metalness: 0.1, normalMap: DETAIL.peelN, normalScale: new THREE.Vector2(0.05, 0.05) }), chFace = M({ color: "#23272c", roughness: 0.3, metalness: 0.2 });
  const screen = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.45, 1.7, 0.85) });
  const bollSteel = M({ color: "#b9bec3", metalness: 1, roughness: 0.3, normalMap: DETAIL.brushN, normalScale: new THREE.Vector2(0.2, 0.2) }), sleeve = M({ color: "#f2c300", roughness: 0.45 });
  const plug = M({ color: "#1d2024", roughness: 0.35, metalness: 0.2 });
  for (let i = 0; i < 5; i++) {
    const c = new THREE.Group(); c.position.set(-15 + i * 6, 0.58, -5.9); ev.add(c);
    mesh(rbox(0.8, 0.12, 0.55), concrete, 0, 0.06, 0, c);
    for (const [bx, bz] of [[-0.3, -0.18], [0.3, -0.18], [-0.3, 0.18], [0.3, 0.18]]) mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.03, 6), steel, bx, 0.135, bz, c).castShadow = false;   // anchor bolts
    mesh(rbox(0.56, 1.9, 0.34), chBody, 0, 1.07, 0, c);
    mesh(rbox(0.46, 1.1, 0.02), chFace, 0, 1.25, 0.175, c);
    mesh(new THREE.PlaneGeometry(0.32, 0.22), screen, 0, 1.55, 0.187, c).castShadow = false;
    mesh(rbox(0.13, 0.22, 0.12), chFace, 0.2, 1.02, 0.22, c);                         // holster
    for (const sd of [-1, 1]) { mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.95, 20), bollSteel, sd * 0.75, 0.475, 0.65, c); mesh(new THREE.CylinderGeometry(0.073, 0.073, 0.3, 20), sleeve, sd * 0.75, 0.7, 0.65, c); mesh(new THREE.SphereGeometry(0.07, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), bollSteel, sd * 0.75, 0.95, 0.65, c); }
    if (i === 2) {   // hero car plugged in: cable from the pedestal to the charge port on the rear quarter
      const pts = [new THREE.Vector3(0.18, 0.95, 0.2), new THREE.Vector3(0.3, 0.3, 0.6), new THREE.Vector3(0.55, 0.12, 1.6), new THREE.Vector3(0.75, 0.25, 2.6), new THREE.Vector3(0.82, 0.55, 3.25), new THREE.Vector3(0.85, 0.6, 3.38)];
      mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.028, 10), plug, 0, 0, 0, c);
      const con = mesh(rbox(0.09, 0.12, 0.16), plug, 0.85, 0.6, 3.42, c); con.rotation.x = -0.3;
    } else {   // holstered connector with a cable loop hanging beside the pedestal
      mesh(rbox(0.09, 0.15, 0.1), plug, 0.2, 1.17, 0.27, c);
      mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.2, 1.1, 0.22), new THREE.Vector3(0.36, 0.55, 0.3), new THREE.Vector3(0.3, 0.3, 0.2), new THREE.Vector3(0.24, 0.6, 0.12), new THREE.Vector3(0.22, 0.9, 0.05)]), 40, 0.026, 8), plug, 0, 0, 0, c);
    }
  }
  // canopy: steel columns and beams, solar roof, LED strips
  const frame = M({ color: "#d4d8dc", metalness: 0.7, roughness: 0.35, normalMap: DETAIL.brushN, normalScale: new THREE.Vector2(0.15, 0.15) });
  for (const x of [-21, -9, 3, 15]) { mesh(rbox(0.3, 4.4, 0.3), frame, x, 2.6, -7.2, ev); mesh(rbox(0.5, 0.2, 0.5), steel, x, 0.5, -7.2, ev); }
  mesh(rbox(46, 0.35, 0.4), frame, -3, 4.75, -7.2, ev);
  for (const x of [-21, -9, 3, 15]) { const b2 = mesh(rbox(0.25, 0.3, 9.5), frame, x, 4.9, -3.4, ev); b2.rotation.x = 0.1; }
  const cellTex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = "#13203a"; g.fillRect(0, 0, w, h); g.strokeStyle = "#5c6f8f"; g.lineWidth = 1.5; for (let x = 0; x <= w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y <= h; y += 52) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } }, [2, 2]);
  const pv = new THREE.MeshPhysicalMaterial({ color: "#ffffff", map: cellTex, metalness: 0.3, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 });
  for (let i = 0; i < 8; i++) { const p = mesh(rbox(5.4, 0.08, 9.4), pv, -21.6 + i * 5.6, 5.15, -3.4, ev); p.rotation.x = 0.1; }
  const led = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.0, 2.0, 1.9) });
  for (const x of [-15, -9, -3, 3, 9]) { const l = mesh(rbox(0.12, 0.04, 5), led, x, 4.6, -3.4, ev); l.castShadow = false; }
  // people: a driver by the hero car and a passer-by
  person(ev, -1.25, -4.3, 2.6, { shirt: "#232a33", pants: "#2f4d75", hair: "#1e1611", woman: true, skin: "#6b4430", hairStyle: "bun" }); { const cs = contactShadow(0.9, 0.9, 0.5); cs.position.set(-1.25, 0.415, -4.3); ev.add(cs); }
  person(ev, -11.2, 2.6, 2.2, { shirt: "#7a2e2a", pants: "#334a6b", hair: "#4a3020", step: 0.18, skin: "#d9a882", h: 1.03 }); { const cs = contactShadow(1.0, 1.0, 0.5); cs.position.set(-11.2, 0.415, 2.6); ev.add(cs); }
  // trees around the hub
  trees(ev, [[-26, -12, 1.1], [-20, -13, 0.9], [-12, -12.5, 1.2], [-4, -13, 1], [5, -12, 1.15], [12, -13, 0.95], [20, -12, 1.05], [28, -10, 1.2], [-30, 4, 1], [30, 6, 1.1], [-32, 14, 0.9], [26, 18, 1]]);
  ev.add(lab("Using it: EV charging", 42, 0, 20 + 14, -10));

  // ---------- 6. RECYCLING: discharge, shredder, black mass, leach tanks, mixer-settlers, precipitation; furnace ----------
  const rec = new THREE.Group(); rec.position.copy(AT.recycle); scene.add(rec);
  plotFrame(rec, 240, 170, 0, -20); mesh(rbox(240, 0.6, 170), concrete, 0, 0.3, -20, rec).castShadow = false;
  // spent packs on pallets
  for (let i = 0; i < 6; i++) mesh(rbox(2.7, 0.3, 1.6), M({ color: "#41464c", roughness: 0.6 }), -95 + (i % 3) * 3.4, 0.8 + Math.floor(i / 3) * 0.4, 20, rec);
  // discharge bath (salt water)
  mesh(rbox(14, 3, 8), M({ color: "#7d858c" }), -80, 1.5, 0, rec);
  mesh(rbox(13, 0.3, 7), new THREE.MeshPhysicalMaterial({ color: "#5a8fa3", roughness: 0.1, transparent: true, opacity: 0.9 }), -80, 3.0, 0, rec);
  // shredder with hopper and conveyor
  mesh(rbox(10, 9, 10), paintYellow, -55, 4.5, 0, rec);
  mesh(new THREE.CylinderGeometry(7, 3, 6, 4, 1, true), M({ color: "#c9a227", side: THREE.DoubleSide }), -55, 12, 0, rec).rotation.y = Math.PI / 4;
  W.shredRot = [mesh(new THREE.CylinderGeometry(1.4, 1.4, 9, 8).rotateX(Math.PI / 2), M({ color: "#555", metalness: 0.6, roughness: 0.4 }), -57, 9.5, 0, rec), mesh(new THREE.CylinderGeometry(1.4, 1.4, 9, 8).rotateX(Math.PI / 2), M({ color: "#555", metalness: 0.6, roughness: 0.4 }), -53, 9.5, 0, rec)];
  // black mass bags
  for (let i = 0; i < 6; i++) mesh(rbox(1.8, 1.8, 1.8), M({ color: "#1c1d1f", roughness: 0.95 }), -40 + (i % 3) * 2.2, 0.9 + Math.floor(i / 3) * 1.8, 14, rec);
  // hydrometallurgy: leach tanks, solvent-extraction mixer-settler train, precipitation tanks
  W.hydro = new THREE.Group(); rec.add(W.hydro);
  for (let i = 0; i < 3; i++) { const t = tank(W.hydro, -20 + i * 13, -10, 5, 9, M({ color: "#cfd6d9", metalness: 0.4, roughness: 0.4 })); mesh(rbox(2, 2, 2), paintBlue, 0, 11.5, 0, t); }
  W.settlers = [];
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group(); g.position.set(28 + i * 9, 0, -10); W.hydro.add(g);
    mesh(rbox(3, 3, 3), M({ color: "#d8dcdd", roughness: 0.5 }), -3, 1.5, 0, g);   // mixer
    mesh(rbox(6, 2.2, 4), M({ color: "#d8dcdd", roughness: 0.5 }), 1.5, 1.1, 0, g);   // settler
    const org = mesh(rbox(5.8, 0.6, 3.8), M({ color: ["#3b8a4a", "#3b8a4a", "#8a3b6f", "#8a3b6f", "#6b8fb0", "#6b8fb0"][i], roughness: 0.2 }), 1.5, 2.0, 0, g); W.settlers.push(org);
  }
  for (let i = 0; i < 3; i++) tank(W.hydro, 90 + i * 12, -10, 4.5, 10, M({ color: "#e4e6e6", metalness: 0.3, roughness: 0.5 }), true);
  pipe(W.hydro, [[-20, 12, -10], [10, 12, -10], [28, 4, -10]], 0.4); pipe(W.hydro, [[80, 3, -10], [90, 14, -10]], 0.4);
  // pyrometallurgy: smelting furnace with glowing tap and offgas stack
  W.pyro = new THREE.Group(); W.pyro.position.set(10, 0, -60); rec.add(W.pyro);
  mesh(new THREE.CylinderGeometry(9, 10, 18, 32), M({ color: "#6a5546", roughness: 0.7, metalness: 0.4 }), 0, 9, 0, W.pyro);
  mesh(new THREE.CylinderGeometry(1.8, 2.4, 50, 16), M({ color: "#bbb6ad", roughness: 0.9 }), 14, 25, -6, W.pyro);
  W.furnaceGlow = mesh(rbox(3, 2, 0.4), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 0.9, 0.2) }), 0, 3, 10.1, W.pyro);
  W.ladle = mesh(new THREE.CylinderGeometry(2.4, 1.8, 3, 20), M({ color: "#3a3330", roughness: 0.6 }), 0, 1.5, 14, W.pyro);
  rec.add(lab("Recycling plant", 49, 0, 40 + 14, -20));

  // plant workers for scale (1.75 m), and trees along the road
  person(scene, AT.refinery.x + 22, AT.refinery.z + 18, 0.6, { ...WORKER, skin: "#8d5a3b", h: 1.02 }); person(scene, AT.refinery.x + 25, AT.refinery.z + 17, 3.6, { ...WORKER, vest: "#ff7a1a", woman: true, skin: "#e2b48f", hair: "#7a4a24", tablet: true });
  person(scene, AT.materials.x - 40, AT.materials.z - 36, 1.2, { ...WORKER, woman: true, skin: "#5a3a28", hair: "#151010", hairStyle: "bun", h: 0.97 }); person(scene, AT.materials.x + 30, AT.materials.z + 26, -0.4, { ...WORKER, step: 0.2, skin: "#c99572" });
  person(scene, AT.factory.x - 10, AT.factory.z - 30, 0.3, { ...WORKER, vest: null, hat: null, shirt: "#e8eaec", pants: "#e8eaec", hair: "#2a2a2a", woman: true, skin: "#f0c8a8", hairStyle: "bun", tablet: true }); person(scene, AT.factory.x + 40, AT.factory.z + 10, 2.0, { ...WORKER, skin: "#7c4f35", h: 0.98 });
  person(scene, AT.recycle.x - 60, AT.recycle.z + 8, 1.0, { ...WORKER, woman: true, skin: "#b07a55", hair: "#2a1d14", tablet: true, h: 0.93 }); person(scene, AT.recycle.x + 20, AT.recycle.z - 2, -2.0, { ...WORKER, vest: "#ff7a1a", skin: "#6e4630", h: 1.04 });
  person(scene, AT.mine.x + 150, AT.mine.z + 80, 0.8, { ...WORKER, woman: true, skin: "#c08a64", hair: "#3a2416" });
  { const pts = []; for (let x = -470; x <= 740; x += 26) for (const z of [82, 95]) if (Math.abs(x - AT.ev.x) > 40 && Math.random() < 0.7) pts.push([x + (Math.random() - 0.5) * 8, z + (Math.random() - 0.5) * 5, 0.9 + Math.random() * 0.5]); trees(scene, pts); }

  // ---------- material flow: crates moving along the road between stations, plus the recycling loop back ----------
  { const sh = new THREE.Shape([[-18, -5], [6, -5], [6, -11], [20, 0], [6, 11], [6, 5], [-18, 5]].map(([x, y]) => new THREE.Vector2(x, y)));
    const arrM = new THREE.MeshStandardMaterial({ color: "#c5050c", roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -3 });
    const st = [AT.mine, AT.refinery, AT.materials, AT.factory, AT.ev, AT.recycle];
    for (let i = 0; i < st.length - 1; i++) { const a = new THREE.Mesh(new THREE.ShapeGeometry(sh).rotateX(-Math.PI / 2), arrM); a.position.set((st[i].x + st[i + 1].x) / 2, 0.12, 60); a.receiveShadow = true; scene.add(a); } }
  const flowPts = [AT.mine, AT.refinery, AT.materials, AT.factory, AT.ev, AT.recycle].map(v => new THREE.Vector3(v.x, 1.4, 60));
  const flow = new THREE.CatmullRomCurve3(flowPts);
  const crateM = [M({ color: "#d9d2c0" }), M({ color: "#f3f3ef" }), M({ color: "#2b2d31" }), M({ color: "#4b5157" }), M({ color: "#2f5f9a" })];
  W.crates = [];
  for (let i = 0; i < 26; i++) { const c = mesh(rbox(5, 2.6, 2.6), crateM[0], 0, 0, 0, scene); c.userData.u = i / 26; W.crates.push(c); }
  W.crateMats = crateM; W.flow = flow;
  // closed loop: recovered metals go back to the materials plant (dashed arc, shown when recycling)
  const loop = new THREE.CatmullRomCurve3([new THREE.Vector3(AT.recycle.x - 40, 2, -110), new THREE.Vector3(AT.ev.x, 60, -200), new THREE.Vector3(AT.factory.x, 70, -210), new THREE.Vector3(AT.materials.x + 40, 2, -110)]);
  const loopLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(loop.getPoints(120)), new THREE.LineDashedMaterial({ color: "#2f7d4f", dashSize: 10, gapSize: 7, linewidth: 2 }));
  loopLine.computeLineDistances(); scene.add(loopLine); W.loopLine = loopLine;
  W.loopArrow = new THREE.Mesh(new THREE.ConeGeometry(5, 12, 16), new THREE.MeshBasicMaterial({ color: "#2f7d4f" })); scene.add(W.loopArrow); W.loop = loop;

  // ---------- overview landmarks: big, simple silhouettes so each stage reads at a glance from far away (hidden close up) ----------
  { const L = new THREE.Group(); W.landmarks = L; scene.add(L);
    const g0 = (at, z = 0) => { const g = new THREE.Group(); g.position.set(at.x, 0, at.z + z); L.add(g); return g; };
    const flat = c => M({ color: c, roughness: 0.75, metalness: 0.05 });
    const glow = c => new THREE.MeshBasicMaterial({ color: c });
    const cyl = (p, r, h, mat, x, z, y0 = 0, seg = 28) => mesh(new THREE.CylinderGeometry(r, r, h, seg), mat, x, y0 + h / 2, z, p);
    const box = (p, w, h, d, mat, x, z, y0 = 0) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y0 + h / 2, z, p);
    const white = flat("#f1f2f2"), red = flat("#c5050c"), dark = flat("#3b3f44");
    // 2. refinery: two tall columns, a row of big white tanks, two red-and-white stacks
    { const g = g0(AT.refinery, -20);
      for (const [x, z, h] of [[-75, -40, 70], [-55, -48, 58]]) { cyl(g, 6, h, flat("#c9ced4"), x, z); for (let y = 12; y < h; y += 14) cyl(g, 7.2, 1.6, dark, x, z, y); }
      for (let i = 0; i < 4; i++) { cyl(g, 15, 22, white, -10 + i * 34, 35); cyl(g, 15.3, 3, red, -10 + i * 34, 35, 16); }
      for (const x of [55, 80]) { cyl(g, 4, 95, white, x, -50, 0, 18); for (const y of [70, 85]) cyl(g, 4.2, 6, red, x, -50, y, 18); } }
    // 3. materials: two long rotary kilns with glowing ends, plus black graphite silos
    { const g = g0(AT.materials, -20);
      for (const z of [-30, 10]) { const k = mesh(new THREE.CylinderGeometry(9, 9, 150, 32).rotateZ(Math.PI / 2), flat("#9a5a32"), -5, 14, z, g); k.rotation.z = -0.04;
        mesh(new THREE.CircleGeometry(8.6, 32).rotateY(Math.PI / 2), glow(new THREE.Color(3.2, 1.2, 0.3)), 70.3, 11, z, g);
        for (const x of [-50, 0, 50]) box(g, 6, 8, 20, flat("#8f8b84"), x, z); }
      for (let i = 0; i < 3; i++) cyl(g, 9, 40, flat("#24262a"), -60 + i * 22, 55); }
    // 4. cell factory: a long white hall with a light-blue clean-room roof
    { const g = g0(AT.factory, -10);
      box(g, 196, 24, 112, white, 0, 0);
      for (let i = 0; i < 6; i++) box(g, 26, 2.5, 96, flat("#8fc3e6"), -80 + i * 32, 0, 24);
      box(g, 196, 3, 4, red, 0, 57, 16);
      for (const x of [-60, 0, 60]) cyl(g, 3.5, 12, flat("#c9ced4"), x, -40, 24, 16); }
    // 5. EV charging: a solar canopy row (dark blue) and an oversized red car out front
    { const g = g0({ x: AT.ev.x, z: EV_Z });
      for (const x of [-70, -10, 50]) { for (const dx of [-22, 22]) cyl(g, 1.6, 22, white, x + dx, -30, 0, 10); const r = box(g, 56, 2.5, 34, flat("#1b2c4c"), x, -18, 22); r.rotation.x = 0.12; box(g, 56, 1, 2, flat("#7fd18c"), x, -1, 21); }
      const { g: car } = buildCar("#c5050c"); car.scale.setScalar(9); car.rotation.y = Math.PI / 2 - 0.35; car.position.set(5, 0.4, 42); g.add(car);
      for (const x of [-30, -12]) { box(g, 4, 14, 3, white, x, 34); box(g, 3, 4, 0.4, glow(new THREE.Color(0.4, 1.7, 0.8)), x, 35.8, 9); } }
    // 6. recycling: yellow shredder with hopper, inclined conveyor, three big green leach tanks and a stack
    { const g = g0(AT.recycle, -20);
      box(g, 34, 26, 30, flat("#e0a526"), -75, 10);
      const hop = mesh(new THREE.CylinderGeometry(22, 9, 16, 4, 1, true), M({ color: "#c9912a", roughness: 0.7, side: THREE.DoubleSide }), -75, 34, 10, g); hop.rotation.y = Math.PI / 4;
      const cv = box(g, 70, 3, 6, flat("#7b8187"), -30, 10, 0); cv.position.y = 16; cv.rotation.z = -0.32;
      for (let i = 0; i < 3; i++) { cyl(g, 14, 26, flat("#d8e4de"), 15 + i * 33, 15); mesh(new THREE.CircleGeometry(12.5, 28).rotateX(-Math.PI / 2), flat("#3fae62"), 15 + i * 33, 26.2, 15, g); }
      cyl(g, 4, 80, white, 95, -55, 0, 18); cyl(g, 4.2, 6, red, 95, -55, 68, 18);
      box(g, 40, 3, 26, flat("#2f7d4f"), -10, -55, 0); }
    L.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  }

  // ---------- footprint bars (LCA view): one column per life-cycle stage, at its station ----------
  W.bars = new THREE.Group(); W.bars.visible = false; scene.add(W.bars);
  return W;
}

// ---------- zoom stations ----------
export function buildZoom(scene) {
  const Z = {};
  // MODULE: 4 × 12 cylindrical cells between busbars, on a cooling plate (shown 10× larger)
  const mod = new THREE.Group(); mod.position.copy(AT.module); scene.add(mod); Z.module = mod;
  const S = 10;  // 1 unit = 10 cm here (cells drawn at 10× real size)
  Z.modCells = [];
  const canM = new THREE.MeshStandardMaterial({ color: "#2b5f8f", metalness: 0.5, roughness: 0.35 });
  for (let i = 0; i < 12; i++) for (let j = 0; j < 4; j++) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.105 * S, 0.105 * S, 0.70 * S, 28), canM.clone()); c.position.set((i - 5.5) * 0.23 * S, 0.35 * S + 0.05 * S, (j - 1.5) * 0.23 * S); c.castShadow = true; mod.add(c); Z.modCells.push(c);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * S, 0.06 * S, 0.02 * S, 20), new THREE.MeshStandardMaterial({ color: "#d0d4d8", metalness: 0.9, roughness: 0.2 })); top.position.set(c.position.x, 0.71 * S + 0.05 * S, c.position.z); mod.add(top);
  }
  for (let j = 0; j < 4; j++) { const b = new THREE.Mesh(new THREE.BoxGeometry(2.8 * S, 0.02 * S, 0.05 * S), new THREE.MeshStandardMaterial({ color: "#c98a4b", metalness: 0.9, roughness: 0.25 })); b.position.set(0, 0.77 * S, (j - 1.5) * 0.23 * S); mod.add(b); }
  Z.coolPlate = new THREE.Mesh(new THREE.BoxGeometry(3 * S, 0.05 * S, 1.05 * S), new THREE.MeshStandardMaterial({ color: "#5aa0d8", metalness: 0.5, roughness: 0.35 })); Z.coolPlate.position.y = 0.025 * S; mod.add(Z.coolPlate);
  // coolant channels
  for (let k = 0; k < 4; k++) { const ch = new THREE.Mesh(new THREE.BoxGeometry(3 * S, 0.02 * S, 0.04 * S), new THREE.MeshBasicMaterial({ color: "#8fd0ff" })); ch.position.set(0, 0.055 * S, (k - 1.5) * 0.23 * S + 0.115 * S); mod.add(ch); }

  // CELL: 21700-type cylinder (shown 100× larger) with a cutaway showing the wound layers
  const cell = new THREE.Group(); cell.position.copy(AT.cell); scene.add(cell); Z.cell = cell;
  const R = 10.5, H = 70;   // 1 unit = 1 mm × 100 => drawn in units of 0.1 m per mm... (labelled as enlarged)
  const can = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 64, 1, true, Math.PI * 0.5, Math.PI * 1.5), new THREE.MeshStandardMaterial({ color: "#2b5f8f", metalness: 0.5, roughness: 0.35, side: THREE.DoubleSide }));
  can.position.y = H / 2; cell.add(can); Z.can = can;
  const capM = new THREE.MeshStandardMaterial({ color: "#c9ced3", metalness: 0.9, roughness: 0.25 });
  const capTop = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 1.2, 64, 1, false, Math.PI * 0.5, Math.PI * 1.5), capM); capTop.position.y = H + 0.6; cell.add(capTop);
  const nub = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 1.5, 32), capM); nub.position.y = H + 1.9; cell.add(nub);
  const capBot = capTop.clone(); capBot.position.y = -0.6; cell.add(capBot);
  // wound layers: anode (graphite, dark grey) on copper, separator (white), cathode (black) on aluminium
  const layerMats = { cu: new THREE.MeshStandardMaterial({ color: "#c47a3e", metalness: 0.9, roughness: 0.3, side: THREE.DoubleSide }),
    an: new THREE.MeshStandardMaterial({ color: "#3e4247", roughness: 0.8, side: THREE.DoubleSide }),
    sep: new THREE.MeshStandardMaterial({ color: "#f2f2ee", roughness: 0.9, side: THREE.DoubleSide }),
    ca: new THREE.MeshStandardMaterial({ color: "#16181b", roughness: 0.7, side: THREE.DoubleSide }),
    al: new THREE.MeshStandardMaterial({ color: "#d6d9dc", metalness: 0.9, roughness: 0.3, side: THREE.DoubleSide }) };
  Z.layerMats = layerMats;
  const seq = ["cu", "an", "sep", "ca", "al", "ca", "sep", "an"];
  // layers drawn about 10× thicker than real so they can be seen (a real cell has dozens of wraps)
  let r = 1.6; const dr = 0.95;
  while (r < R - 0.5) {
    for (const k of seq) {
      if (r >= R - 0.5) break;
      const th = k === "cu" || k === "al" ? 0.3 : k === "sep" ? 0.28 : dr;
      const sh = new THREE.Mesh(new THREE.CylinderGeometry(r + th, r + th, H - 2, 48, 1, true, Math.PI * 0.5, Math.PI * 1.5), layerMats[k]); sh.position.y = H / 2; cell.add(sh);
      // cut faces: thin boxes along the two cut planes so each layer shows as a stripe
      for (const ang of [Math.PI * 0.5, 0]) {
        const f = new THREE.Mesh(new THREE.PlaneGeometry(th, H - 2), layerMats[k]);
        const rr = r + th / 2;
        f.position.set(Math.sin(ang) * rr, H / 2, Math.cos(ang) * rr); f.rotation.y = ang + Math.PI / 2; cell.add(f);
      }
      r += th;
    }
  }
  // ions on the cut face (move outward/inward between anode and cathode stripes)
  const ionM = new THREE.MeshBasicMaterial({ color: "#ffd84a" });
  Z.cellIons = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 10, 8), ionM, 160); cell.add(Z.cellIons);
  Z.cellIonSeed = Array.from({ length: 160 }, () => ({ y: 3 + Math.random() * (H - 6), r0: 2.4 + Math.random() * (R - 3.2), ph: Math.random(), face: Math.random() < .5 ? 0 : 1 }));

  // PARTICLES: a slice through the electrode sandwich (shown 2000× larger): Cu foil | graphite | separator | cathode | Al foil
  const pt = new THREE.Group(); pt.position.copy(AT.particles); scene.add(pt); Z.particles = pt;
  const PW = 60, PH = 40, PD = 30;   // world units: 1 unit = 1 µm × 2000 = 2 mm on screen
  const bx = (w, x, col, op = 1) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, PH, PD), new THREE.MeshStandardMaterial({ color: col, metalness: col === "#c47a3e" || col === "#d6d9dc" ? 0.9 : 0, roughness: 0.4, transparent: op < 1, opacity: op })); m.position.set(x, PH / 2, 0); pt.add(m); return m; };
  bx(1.2, -PW / 2 - 0.6, "#c47a3e"); bx(1.6, PW / 2 + 0.8, "#d6d9dc");
  Z.sepSlab = bx(4, 0, "#f2f2ee", 0.35);
  // particles: spheres with cut faces coloured by lithium concentration (inner shells drawn as nested hemispheres)
  Z.partShells = { n: [], p: [] };
  function particle(side, cx, cy, cz, rad) {
    const g = new THREE.Group(); g.position.set(cx, cy, cz); pt.add(g);
    const shells = [];
    for (let k = 0; k < 6; k++) {
      const rr = rad * (6 - k) / 6;
      const m = new THREE.Mesh(new THREE.SphereGeometry(rr, 28, 18, 0, Math.PI), new THREE.MeshStandardMaterial({ color: "#888", roughness: 0.55, side: THREE.DoubleSide }));
      m.rotation.y = Math.PI; g.add(m); shells.push(m);   // dome behind, cut face toward the viewer
    }
    Z.partShells[side].push(shells);
  }
  // graphite particles (left, between x=-30 and -2) and cathode particles (right, x=2..30)
  const rnd = (a, b) => a + Math.random() * (b - a);
  for (let i = 0; i < 9; i++) particle("n", -24 + (i % 3) * 10 + rnd(-1.5, 1.5), 7 + Math.floor(i / 3) * 12 + rnd(-1, 1), rnd(-6, 6), rnd(4.2, 5.2));
  for (let i = 0; i < 9; i++) particle("p", 6 + (i % 3) * 10 + rnd(-1.5, 1.5), 7 + Math.floor(i / 3) * 12 + rnd(-1, 1), rnd(-6, 6), rnd(3.6, 4.6));
  // electrolyte haze
  const elec = new THREE.Mesh(new THREE.BoxGeometry(PW, PH, PD), new THREE.MeshPhysicalMaterial({ color: "#bfe3ff", transparent: true, opacity: 0.12, roughness: 0.1, depthWrite: false })); elec.position.y = PH / 2; pt.add(elec);
  Z.ions = new THREE.InstancedMesh(new THREE.SphereGeometry(0.55, 12, 10), new THREE.MeshBasicMaterial({ color: "#ffd84a" }), 90); pt.add(Z.ions);
  Z.ionSeed = Array.from({ length: 90 }, () => ({ y: rnd(2, PH - 2), z: rnd(-PD / 2 + 2, PD / 2 - 2), ph: Math.random() }));
  Z.PW = PW;
  // electrons in the external circuit: a wire arc over the top
  const wire = new THREE.CatmullRomCurve3([new THREE.Vector3(-PW / 2 - 0.6, PH, 0), new THREE.Vector3(-PW / 2, PH + 14, 0), new THREE.Vector3(PW / 2, PH + 14, 0), new THREE.Vector3(PW / 2 + 0.8, PH, 0)]);
  pt.add(new THREE.Mesh(new THREE.TubeGeometry(wire, 60, 0.35, 8), new THREE.MeshStandardMaterial({ color: "#c47a3e", metalness: 0.9, roughness: 0.3 })));
  Z.wire = wire;
  Z.electrons = new THREE.InstancedMesh(new THREE.SphereGeometry(0.6, 10, 8), new THREE.MeshBasicMaterial({ color: "#5ab0ff" }), 12); pt.add(Z.electrons);

  // LATTICE: built per chemistry (see setLattice)
  const lat = new THREE.Group(); lat.position.copy(AT.lattice); scene.add(lat); Z.lattice = lat;
  Z.liAtoms = null;
  return Z;
}

// layered NMC (O3: alternating Li and transition-metal layers between oxygen layers) or olivine LFP (simplified)
export function setLattice(Z, chem) {
  const lat = Z.lattice;
  while (lat.children.length) { const c = lat.children.pop(); c.geometry?.dispose(); }
  const sph = (r) => new THREE.SphereGeometry(r, 20, 14);
  const add = (geo, col, pts, metal = 0.1) => { const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: col, roughness: 0.35, metalness: metal }), pts.length); const m4 = new THREE.Matrix4(); pts.forEach((p, i) => { m4.makeTranslation(p[0], p[1], p[2]); im.setMatrixAt(i, m4); }); im.castShadow = true; lat.add(im); return im; };
  const a = 5.6, n = 5;
  if (chem === "NMC") {
    const O = [], TM = [[], [], []], Li = [];
    for (let L = 0; L < 7; L++) {
      const y = L * 4.6, shift = (L % 3) * a / 3;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const x = (i + j * 0.5) * a - n * a * 0.75 + shift, z = j * a * 0.866 - n * a * 0.43;
        if (L % 2 === 0) { O.push([x, y, z]); }
        else if (L % 4 === 1) { const r = (i * 7 + j * 3) % 10; TM[r < 8 ? 0 : r < 9 ? 1 : 2].push([x, y, z]); }   // 8:1:1 Ni:Mn:Co
        else Li.push([x, y, z]);
      }
    }
    add(sph(1.5), "#d84a3a", O);
    add(sph(1.15), "#3fa45b", TM[0], 0.4); add(sph(1.15), "#8a5bbd", TM[1], 0.4); add(sph(1.15), "#2f6fd0", TM[2], 0.4);
    Z.liAtoms = add(sph(0.95), "#e8e3d8", Li, 0.6); Z.liPts = Li;
    Z.latLegend = "red = oxygen · green = nickel · purple = manganese · blue = cobalt · white = lithium (layers of lithium between layers of metal oxide)";
  } else {
    // olivine LiFePO4 (simplified): zig-zag chains of iron (brown) linked by phosphate (purple P with red O), lithium in straight channels
    const Fe = [], P = [], O = [], Li = [];
    for (let i = 0; i < 6; i++) for (let k = 0; k < 6; k++) for (let L = 0; L < 3; L++) {
      const x = i * 5 - 12.5, z = k * 5 - 12.5, y = L * 10;
      Fe.push([x + (k % 2) * 1.2, y + 2, z]);
      P.push([x + 2.5, y + 6, z + 2.5]);
      for (const [dx, dy, dz] of [[1.5, 0, 0], [-1.5, 0, 0], [0, 1.5, 0], [0, 0, 1.5]]) O.push([x + 2.5 + dx, y + 6 + dy, z + 2.5 + dz]);
      Li.push([x + 2.5, y + 2, z]);
    }
    add(sph(1.3), "#9a5b2e", Fe, 0.4); add(sph(1.0), "#8a5bbd", P); add(sph(0.75), "#d84a3a", O);
    Z.liAtoms = add(sph(0.9), "#e8e3d8", Li, 0.6); Z.liPts = Li;
    Z.latLegend = "brown = iron · purple = phosphorus · red = oxygen · white = lithium (lithium sits in straight tunnels; simplified olivine)";
  }
  Z.liCount = Z.liPts.length;
}
