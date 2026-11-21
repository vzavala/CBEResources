// Realistic-render helpers (Part H): procedural textures, a facade shader, trees, people, vehicles and plant
// equipment detail. Everything is generated in code: no downloaded textures or models.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export const FX = { uNight: { value: 0 }, uSnow: { value: 0 }, uPlain: { value: 0 } };
const rng = (s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; })(2026);

// ---------- procedural textures ----------
function valueNoise(n, cells, seed) {   // tileable value noise, n×n, fractal sum of octaves
  const out = new Float32Array(n * n); let amp = 1, tot = 0;
  for (let o = 0; o < 5; o++, amp *= 0.5) {
    const c = cells << o, g = new Float32Array(c * c); for (let i = 0; i < g.length; i++) g[i] = rng();
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const fx = x / n * c, fy = y / n * c, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const a = g[(iy % c) * c + ix % c], b = g[(iy % c) * c + (ix + 1) % c], d = g[((iy + 1) % c) * c + ix % c], e = g[((iy + 1) % c) * c + (ix + 1) % c];
      out[y * n + x] += amp * ((a * (1 - sx) + b * sx) * (1 - sy) + (d * (1 - sx) + e * sx) * sy);
    }
    tot += amp;
  }
  for (let i = 0; i < out.length; i++) out[i] /= tot; return out;
}
function canvasTex(n, px, srgb = true, repeat = 1) {
  const c = document.createElement("canvas"); c.width = c.height = n; const g = c.getContext("2d"), im = g.createImageData(n, n);
  for (let i = 0; i < n * n; i++) { const [r, gg, b] = px(i % n, Math.floor(i / n), i); im.data.set([r, gg, b, 255], i * 4); }
  g.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 8; return t;
}
function normalTex(h, n, strength, repeat = 1) {
  return canvasTex(n, (x, y) => { const H = (i, j) => h[((j + n) % n) * n + (i + n) % n];
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength, l = Math.hypot(dx, dy, 1);
    return [(-dx / l * 0.5 + 0.5) * 255, (dy / l * 0.5 + 0.5) * 255, (1 / l * 0.5 + 0.5) * 255]; }, false, repeat);
}
export function surfaceMaps(kind, repeat) {
  const n = 256, h = valueNoise(n, kind === "grass" ? 16 : kind === "water" ? 6 : 32, 1);
  const tone = { grass: [0.78, 1.0], asphalt: [0.7, 1.0], concrete: [0.82, 1.0], water: [1, 1], metal: [0.85, 1.0] }[kind];
  const map = canvasTex(n, (x, y, i) => { const v = 255 * (tone[0] + (tone[1] - tone[0]) * h[i]); return [v, v, v]; }, true, repeat);
  const rough = canvasTex(n, (x, y, i) => { const v = 255 * (0.75 + 0.25 * h[(i * 7) % (n * n)]); return [v, v, v]; }, false, repeat);
  const normal = normalTex(h, n, { grass: 6, asphalt: 3, concrete: 2, water: 5, metal: 1.2 }[kind], repeat);
  return { map, rough, normal };
}

// ---------- building facades: windows, floor bands, grime, roof gravel, roof snow, lit windows at night ----------
// The geometry carries `fuv` = (metres along the wall, metres above the base, per-building seed); roofs carry (x, z, seed).
export function facadeMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.0 });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, FX);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute vec3 fuv; varying vec3 vFac; varying float vRoof; varying vec3 vWP;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvFac = fuv; vRoof = step(0.5, normal.y); vWP = (modelMatrix * vec4(position, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", `#include <common>
uniform float uNight, uSnow, uPlain; varying vec3 vFac; varying float vRoof; varying vec3 vWP;
float fh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float fn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(fh(i), fh(i + vec2(1, 0)), f.x), mix(fh(i + vec2(0, 1)), fh(i + vec2(1, 1)), f.x), f.y); }`)
      .replace("#include <color_fragment>", `#include <color_fragment>
float sd = vFac.z, wall = 1.0 - vRoof;
vec2 cellSz = vec2(3.0 + 1.6 * fract(sd * 7.31), 3.6 + 0.8 * fract(sd * 3.17));
vec2 cl = vFac.xy / cellSz, ff = fract(cl), cid = floor(cl);
float ww = 0.5 + 0.32 * fract(sd * 5.7), wh = 0.48 + 0.24 * fract(sd * 9.1);
vec2 aa = max(fwidth(cl), vec2(1e-4));
float wx = smoothstep(0.5 - ww * 0.5 - aa.x, 0.5 - ww * 0.5 + aa.x, ff.x) * (1.0 - smoothstep(0.5 + ww * 0.5 - aa.x, 0.5 + ww * 0.5 + aa.x, ff.x));
float wy = smoothstep(0.32 - aa.y, 0.32 + aa.y, ff.y) * (1.0 - smoothstep(0.32 + wh - aa.y, 0.32 + wh + aa.y, ff.y));
float far = clamp(max(aa.x, aa.y) * 3.0 - 0.6, 0.0, 1.0);
float win = wall * mix(wx * wy, ww * wh * 0.85, far) * (1.0 - uPlain * 0.8);
float wallTex = (0.9 + 0.16 * fn(vFac.xy * vec2(0.35, 0.8) + sd * 40.0)) * (1.0 - 0.16 * exp(-clamp(vFac.y * wall, 0.0, 60.0) / 2.2)) * (1.0 - 0.1 * (1.0 - smoothstep(0.0, 0.07 + aa.y, ff.y)) * (1.0 - far));
float roofTex = 0.82 + 0.3 * fn(vWP.xz * 0.45) * fn(vWP.xz * 0.07 + 3.0);
diffuseColor.rgb *= mix(1.0, mix(wallTex, roofTex, vRoof), 1.0 - uPlain * 0.7);
vec3 glass = vec3(0.045, 0.06, 0.075) + 0.05 * fh(cid + sd * 13.0);
diffuseColor.rgb = mix(diffuseColor.rgb, glass, win);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.8, 0.83, 0.88), vRoof * uSnow * (1.0 - uPlain) * (0.75 + 0.25 * fn(vWP.xz * 0.3)));`)
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.08, win); roughnessFactor = mix(roughnessFactor, 0.6, vRoof * uSnow);")
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
{ float hgt = -0.18 * wall * wx * wy * (1.0 - far) + 0.02 * fn(vFac.xy * 4.0 + sd);
  vec2 dH = vec2(dFdx(hgt), dFdy(hgt));
  vec3 sX = dFdx(-vViewPosition), sY = dFdy(-vViewPosition), R1 = cross(sY, normal), R2 = cross(normal, sX);
  float det = dot(sX, R1) * faceDirection; vec3 grad = sign(det) * (dH.x * R1 + dH.y * R2);
  vec3 nn = abs(det) * normal - grad; if (abs(det) > 1e-12 && dot(nn, nn) > 1e-20) normal = normalize(nn); }`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
float lit = step(0.68, fh(cid * 1.37 + sd * 91.0));   // about a third of the windows lit, warm and soft (accents, not floodlight)
totalEmissiveRadiance += win * mix(lit, 0.16, far) * uNight * vec3(1.0, 0.72, 0.4) * 1.7;`);
  };
  m.customProgramCacheKey = () => "facade-v5";
  return m;
}

// ---------- materials with real-world values ----------
const maps = {};
const M_ = (kind, rep) => (maps[kind + rep] ||= surfaceMaps(kind, rep));
export const MAT = {
  concrete: (color = "#b9b4aa") => { const t = M_("concrete", 2); return new THREE.MeshStandardMaterial({ color, roughness: 0.92, roughnessMap: t.rough, normalMap: t.normal, normalScale: new THREE.Vector2(0.5, 0.5), map: t.map }); },
  painted: (color) => { const t = M_("metal", 1); return new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.35, roughnessMap: t.rough }); },
  galv: () => { const t = M_("metal", 2); return new THREE.MeshStandardMaterial({ color: "#b4b9be", roughness: 0.42, metalness: 1, roughnessMap: t.rough, normalMap: t.normal, normalScale: new THREE.Vector2(0.3, 0.3) }); },
  stainless: () => new THREE.MeshPhysicalMaterial({ color: "#c9cdd1", roughness: 0.3, metalness: 1, anisotropy: 0.7, anisotropyRotation: Math.PI / 2 }),
  rubber: () => new THREE.MeshStandardMaterial({ color: "#1b1c1e", roughness: 0.92 }),
  soot: () => new THREE.MeshStandardMaterial({ color: "#2b2a28", roughness: 0.95 }),
  safety: () => new THREE.MeshStandardMaterial({ color: "#e0b52a", roughness: 0.55, metalness: 0.2 }),
};

// ---------- small geometry helpers ----------
export const rbox = (w, h, d, r = Math.min(w, h, d) * 0.08) => new RoundedBoxGeometry(w, h, d, 2, Math.max(0.02, r));
function put(G, geo, mat, x, y, z, shadow = true) { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = shadow; o.receiveShadow = true; G.add(o); return o; }
// handrail around a rectangle (top rail, knee rail, posts every ~1.8 m)
export function railRect(G, mat, x, y, z, w, d) {
  const parts = [];
  for (const [ax, az, len, rot] of [[0, -d / 2, w, 0], [0, d / 2, w, 0], [-w / 2, 0, d, Math.PI / 2], [w / 2, 0, d, Math.PI / 2]]) {
    for (const hy of [1.07, 0.55]) { const g = new THREE.CylinderGeometry(0.03, 0.03, len, 6).rotateZ(Math.PI / 2).rotateY(rot); g.translate(x + ax, y + hy, z + az); parts.push(g); }
    const n = Math.max(2, Math.round(len / 1.8)); for (let k = 0; k <= n; k++) { const t = -len / 2 + k * len / n, g = new THREE.CylinderGeometry(0.025, 0.025, 1.07, 6); g.translate(x + (rot ? ax : ax + t), y + 0.535, z + (rot ? az + t : az)); parts.push(g); }
  }
  put(G, mergeGeometries(parts), mat, 0, 0, 0, false);
}
export function railRing(G, mat, x, y, z, r) {
  const parts = [new THREE.TorusGeometry(r, 0.03, 4, 48).rotateX(Math.PI / 2).translate(x, y + 1.07, z), new THREE.TorusGeometry(r, 0.025, 4, 48).rotateX(Math.PI / 2).translate(x, y + 0.55, z)];
  const n = Math.round(2 * Math.PI * r / 1.8); for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; parts.push(new THREE.CylinderGeometry(0.025, 0.025, 1.07, 5).translate(x + r * Math.cos(a), y + 0.535, z + r * Math.sin(a))); }
  put(G, mergeGeometries(parts), mat, 0, 0, 0, false);
}
export function ladder(G, mat, x, y0, y1, z, rot = 0) {
  const parts = [], h = y1 - y0;
  for (const s of [-0.22, 0.22]) parts.push(new THREE.CylinderGeometry(0.03, 0.03, h, 5).translate(s, y0 + h / 2, 0));
  for (let yy = y0 + 0.3; yy < y1; yy += 0.3) parts.push(new THREE.CylinderGeometry(0.015, 0.015, 0.44, 4).rotateZ(Math.PI / 2).translate(0, yy, 0));
  for (let yy = y0 + 2.2; yy < y1 - 0.5; yy += 0.9) parts.push(new THREE.TorusGeometry(0.38, 0.02, 3, 12, Math.PI).rotateX(Math.PI / 2).translate(0, yy, 0.02));   // safety cage
  const g = mergeGeometries(parts).rotateY(rot); put(G, g, mat, x, 0, z, false);
}
// flanges with bolt circles on a vertical pipe or stack of radius r at the given heights (bolts instanced)
export function flanges(G, mat, boltMat, x, z, r, heights) {
  const parts = [], bolts = [];
  for (const y of heights) { parts.push(new THREE.CylinderGeometry(r + 0.12, r + 0.12, 0.22, 32).translate(x, y, z));
    const n = Math.max(8, Math.round(r * 10)); for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; bolts.push(new THREE.Vector3(x + (r + 0.07) * Math.cos(a), y, z + (r + 0.07) * Math.sin(a))); } }
  put(G, mergeGeometries(parts), mat, 0, 0, 0, false);
  const B = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.025, 0.025, 0.34, 6), boltMat, bolts.length), m4 = new THREE.Matrix4();
  bolts.forEach((p, i) => { m4.makeTranslation(p.x, p.y, p.z); B.setMatrixAt(i, m4); }); G.add(B);
}

// ---------- plant equipment ----------
// A steel-lined concrete stack with flange joints, a soot band, a platform with handrail and a caged ladder.
export function stack(G, x, yBase, z, r, h) {
  const conc = MAT.concrete("#c4bfb5"), galv = MAT.galv(), dark = MAT.soot();
  put(G, new THREE.CylinderGeometry(r * 0.82, r, h, 32), conc, x, yBase + h / 2, z);
  put(G, new THREE.CylinderGeometry(r * 0.83, r * 0.83, 2.5, 32), dark, x, yBase + h - 1.2, z, false);
  const ys = []; for (let yy = yBase + 6; yy < yBase + h - 4; yy += 7) ys.push(yy);
  flanges(G, galv, galv, x, z, r * (1 - 0.18 * 0.5), ys.slice(0, 2));
  const yp = yBase + h * 0.78, rp = r * 0.86 + 1.4;
  const ring = new THREE.RingGeometry(r * 0.86, rp, 40, 1).rotateX(-Math.PI / 2); put(G, ring, galv, x, yp, z, false).material.side = THREE.DoubleSide;
  railRing(G, galv, x, yp, z, rp - 0.05);
  ladder(G, galv, x + r + 0.45, yBase, yp + 1.1, z, Math.PI / 2);
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; put(G, new THREE.BoxGeometry(0.15, 1.2, 1.4).rotateY(-a), galv, x + (r * 0.86 + 0.7) * Math.cos(a), yp - 0.6, z + (r * 0.86 + 0.7) * Math.sin(a), false); }
}
// A cross-flow cooling-tower cell: concrete basin, louvred casing, fan deck with handrail and a flared fan stack.
const louvreMat = (() => { const t = canvasTex(64, (x, y) => { const v = (y % 8) < 5 ? 150 : 70; return [v, v, v]; }, true, 1); t.repeat.set(1, 4);
  const n = normalTex(new Float32Array(64 * 64).map((_, i) => ((Math.floor(i / 64) % 8) / 8)), 64, 4, 1); n.repeat.set(1, 4);
  return new THREE.MeshStandardMaterial({ color: "#c8cbc6", map: t, normalMap: n, roughness: 0.7, metalness: 0.1 }); })();
export function coolingCell(G, x, y, z, s = 12) {
  const conc = MAT.concrete("#bcb8ae"), galv = MAT.galv(), frp = MAT.painted("#9aa3a8");
  put(G, rbox(s + 0.6, 1.4, s + 0.6, 0.15), conc, x, y + 0.7, z);
  put(G, rbox(s, s * 0.72, s, 0.25), louvreMat, x, y + 1.4 + s * 0.36, z);
  const deck = y + 1.4 + s * 0.72; put(G, rbox(s + 0.3, 0.35, s + 0.3, 0.08), frp, x, deck + 0.17, z);
  const prof = [[s * 0.36, 0], [s * 0.34, 0.6], [s * 0.33, 1.6], [s * 0.36, 2.6], [s * 0.4, 3.2]].map(([a, b]) => new THREE.Vector2(a, b));
  const shroud = put(G, new THREE.LatheGeometry(prof, 40), frp, x, deck + 0.35, z); shroud.material = frp.clone(); shroud.material.side = THREE.DoubleSide;
  put(G, new THREE.CylinderGeometry(s * 0.33, s * 0.33, 0.1, 28), MAT.soot(), x, deck + 1.3, z, false);
  railRect(G, galv, x, deck + 0.35, z, s, s);
}
// Pipe rack between two points: steel bents every 6 m and three insulated pipes with flanges every 12 m.
export function pipeRack(G, x0, z0, x1, z1, yBase, H = 6) {
  const steel = MAT.painted("#6d7a86"), clad = MAT.galv(), dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz), a = Math.atan2(dz, dx), ux = dx / L, uz = dz / L, px = -uz, pz = ux;
  const parts = [];
  for (let s = 0; s <= L; s += 6) { const cx = x0 + ux * s, cz = z0 + uz * s;
    for (const o of [-1.6, 1.6]) parts.push(new THREE.BoxGeometry(0.3, H, 0.3).translate(cx + px * o, yBase + H / 2, cz + pz * o));
    parts.push(new THREE.BoxGeometry(0.3, 0.35, 3.6).rotateY(-a).translate(cx, yBase + H, cz)); }
  put(G, mergeGeometries(parts), steel, 0, 0, 0);
  const fl = [];
  [[-1.0, 0.45], [0, 0.35], [1.0, 0.35]].forEach(([o, r]) => {
    const g = new THREE.CylinderGeometry(r, r, L, 16).rotateZ(Math.PI / 2).rotateY(-a); put(G, g, clad, x0 + ux * L / 2 + px * o, yBase + H + 0.2 + r, z0 + uz * L / 2 + pz * o);
    for (let s = 6; s < L; s += 12) fl.push(new THREE.CylinderGeometry(r + 0.1, r + 0.1, 0.18, 16).rotateZ(Math.PI / 2).rotateY(-a).translate(x0 + ux * s + px * o, yBase + H + 0.2 + r, z0 + uz * s + pz * o));
  });
  if (fl.length) put(G, mergeGeometries(fl), steel, 0, 0, 0, false);
}
// A transformer with radiator fins and three bushings with insulator sheds.
export function transformer(G, x, y, z) {
  const body = MAT.painted("#7d8a7a"), por = new THREE.MeshStandardMaterial({ color: "#8a5a3c", roughness: 0.25, metalness: 0 });
  put(G, rbox(8, 5, 4.5, 0.2), body, x, y + 2.5, z);
  const fins = []; for (let k = 0; k < 14; k++) for (const s of [-1, 1]) fins.push(new THREE.BoxGeometry(0.08, 3.6, 1.2).translate(x - 3.4 + k * 0.52, y + 2.4, z + s * 2.85));
  put(G, mergeGeometries(fins), body, 0, 0, 0, false);
  const sheds = []; for (let j = 0; j < 3; j++) { const bx = x - 2.4 + j * 2.4; sheds.push(new THREE.CylinderGeometry(0.15, 0.2, 2.4, 10).translate(bx, y + 6.2, z));
    for (let k = 0; k < 7; k++) sheds.push(new THREE.CylinderGeometry(0.34, 0.34, 0.06, 14).translate(bx, y + 5.2 + k * 0.3, z)); }
  put(G, mergeGeometries(sheds), por, 0, 0, 0);
}

// ---------- trees: deciduous and evergreen, instanced, with per-instance size and colour ----------
function blob(geo, amp) { const p = geo.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = 1 + amp * (Math.sin(v.x * 5.1 + v.y * 2.3) * Math.cos(v.z * 4.7 - v.y * 1.9)); p.setXYZ(i, v.x * k, v.y * k, v.z * k); } geo.computeVertexNormals(); return geo; }
export function trees(scene, spots) {
  const decid = spots.filter(s => !s.ever), ever = spots.filter(s => s.ever), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  const crown = mergeGeometries([blob(new THREE.IcosahedronGeometry(1, 2), 0.12), blob(new THREE.IcosahedronGeometry(0.7, 1), 0.15).translate(0.45, 0.35, 0.2), blob(new THREE.IcosahedronGeometry(0.65, 1), 0.15).translate(-0.4, 0.25, -0.3)]);
  const leafD = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.85 }), leafE = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.9 });
  const bark = new THREE.MeshStandardMaterial({ color: "#4a3b2f", roughness: 0.95 });
  const D = new THREE.InstancedMesh(crown, leafD, decid.length), E = new THREE.InstancedMesh(blob(new THREE.ConeGeometry(1, 1, 9, 4).translate(0, 0.5, 0), 0.08), leafE, ever.length);
  const T = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.26, 1, 6).translate(0, 0.5, 0), bark, spots.length);
  let ti = 0;
  decid.forEach((s, i) => { const r = s.r, th = r * 0.9; q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.a);
    m4.compose(new THREE.Vector3(s.x, s.y + th + r * 0.75, s.z), q, new THREE.Vector3(r, r * 0.9, r)); D.setMatrixAt(i, m4); D.setColorAt(i, c.setHSL(0.25 + 0.06 * s.h, 0.42, 0.2 + 0.07 * s.h));
    m4.compose(new THREE.Vector3(s.x, s.y, s.z), q, new THREE.Vector3(r * 0.7, th + r * 0.5, r * 0.7)); T.setMatrixAt(ti++, m4); });
  ever.forEach((s, i) => { const r = s.r * 0.75, H = s.r * 3.2; m4.compose(new THREE.Vector3(s.x, s.y + 1.2, s.z), q.identity(), new THREE.Vector3(r, H, r)); E.setMatrixAt(i, m4); E.setColorAt(i, c.setHSL(0.36 + 0.04 * s.h, 0.35, 0.13 + 0.04 * s.h));
    m4.compose(new THREE.Vector3(s.x, s.y, s.z), q, new THREE.Vector3(r * 0.6, 1.6, r * 0.6)); T.setMatrixAt(ti++, m4); });
  for (const o of [D, E, T]) { o.castShadow = true; o.receiveShadow = true; scene.add(o); }
  // seasons: deciduous crowns thin and turn grey-brown in winter
  // seasons: bare in winter, fresh light green in spring, deep green in summer, red-orange-yellow in fall
  const base = D.instanceColor.array.slice(), n = base.length / 3, fall = new Float32Array(base.length), fresh = new Float32Array(base.length), bare = new Float32Array(base.length);
  for (let i = 0; i < n; i++) { const r = (i * 0.618034) % 1;
    c.setHSL(0.015 + 0.12 * r, 0.72, 0.3 + 0.08 * r); fall.set([c.r, c.g, c.b], i * 3);
    c.setHSL(0.24 + 0.03 * r, 0.5, 0.32); fresh.set([c.r, c.g, c.b], i * 3);
    c.set("#7a6d60").multiplyScalar(0.85 + 0.3 * r); bare.set([c.r, c.g, c.b], i * 3); }
  const sm = (a, b, x) => Math.min(1, Math.max(0, (x - a) / (b - a)));
  let lastKey = "";
  return { D, E, T,
    // weights by day of year (Madison): leaf-out late April to mid May, colour in October, bare from early November
    setSeason(doy) {
      const leaf = sm(108, 135, doy) * (1 - sm(296, 312, doy)), col = sm(268, 292, doy), spring = 1 - sm(135, 165, doy);
      const key = [leaf, col, spring].map(v => Math.round(v * 20)).join(); if (key === lastKey) return; lastKey = key;
      const a = D.instanceColor.array;
      for (let i = 0; i < a.length; i++) { const green = base[i] + (fresh[i] - base[i]) * spring, onTree = green + (fall[i] - green) * col; a[i] = bare[i] + (onTree - bare[i]) * leaf; }
      D.instanceColor.needsUpdate = true; leafD.roughness = 0.95 - 0.1 * leaf; },
    setWinter(w) { this.setSeason(w > 0.5 ? 15 : 200); } };
}

// ---------- people (1.75 m, adult proportions) and cars (true size) ----------
function colored(geo, c) { if (geo.index) geo = geo.toNonIndexed(); const n = geo.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set(c, i * 3); geo.setAttribute("color", new THREE.BufferAttribute(a, 3)); geo.deleteAttribute("uv"); return geo; }
export function personGeometry() {
  const P = [], pants = [0.32, 0.32, 0.36], shirt = [1, 1, 1];
  for (const s of [-1, 1]) { P.push(colored(new THREE.CapsuleGeometry(0.075, 0.72, 3, 8).translate(s * 0.095, 0.45, 0), pants)); P.push(colored(new THREE.CapsuleGeometry(0.05, 0.5, 3, 6).rotateZ(s * 0.06).translate(s * 0.25, 1.12, 0), shirt)); P.push(colored(new THREE.BoxGeometry(0.11, 0.07, 0.26).translate(s * 0.095, 0.035, 0.04), [0.12, 0.12, 0.12])); }
  P.push(colored(new THREE.CapsuleGeometry(0.17, 0.36, 4, 10).scale(1, 1, 0.62).translate(0, 1.16, 0), shirt));
  const body = mergeGeometries(P);
  const skin = mergeGeometries([new THREE.SphereGeometry(0.105, 12, 10).scale(0.9, 1.1, 1).translate(0, 1.64, 0), new THREE.CylinderGeometry(0.045, 0.05, 0.1, 8).translate(0, 1.5, 0),
    new THREE.SphereGeometry(0.045, 8, 6).translate(-0.27, 0.84, 0), new THREE.SphereGeometry(0.045, 8, 6).translate(0.27, 0.84, 0)].map(g => { g.deleteAttribute("uv"); return g; }));
  const noUV = g => { g.deleteAttribute("uv"); return g; };
  const hairShort = mergeGeometries([noUV(new THREE.SphereGeometry(0.112, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55).scale(0.95, 0.85, 1.02).translate(0, 1.655, 0))]);
  const hairLong = mergeGeometries([noUV(new THREE.SphereGeometry(0.118, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.6).scale(0.97, 0.9, 1.04).translate(0, 1.655, 0)),
    noUV(new THREE.CylinderGeometry(0.118, 0.13, 0.22, 14, 1, true).translate(0, 1.55, 0))]);
  return { body, skin, hairShort, hairLong };
}
export function carGeometry() {
  const body = [1, 1, 1], glass = [0.08, 0.09, 0.1], tyre = [0.05, 0.05, 0.05], P = [];
  P.push(colored(new RoundedBoxGeometry(4.5, 0.72, 1.8, 3, 0.22).translate(0, 0.62, 0), body));
  P.push(colored(new RoundedBoxGeometry(2.4, 0.62, 1.62, 3, 0.25).translate(-0.25, 1.22, 0), glass));
  P.push(colored(new RoundedBoxGeometry(2.0, 0.08, 1.5, 1, 0.03).translate(-0.25, 1.53, 0), body));
  for (const sx of [-1.45, 1.45]) for (const sz of [-0.82, 0.82]) P.push(colored(new THREE.CylinderGeometry(0.33, 0.33, 0.22, 14).rotateX(Math.PI / 2).translate(sx, 0.33, sz), tyre));
  for (const sz of [-0.6, 0.6]) P.push(colored(new THREE.BoxGeometry(0.05, 0.12, 0.3).translate(2.25, 0.75, sz), [1.6, 1.5, 1.3]));
  return mergeGeometries(P.map(g => { if (g.attributes.uv) g.deleteAttribute("uv"); return g; }));
}
