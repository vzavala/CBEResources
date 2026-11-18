// The Human Body: 3D scene. A stylized, anatomically sensible body (1 unit = 1 cm, feet at y = 0,
// facing +z, the body's left side at +x) with organs, vessels and flows, plus one zoom station
// placed beside it: lung tissue, a red blood cell, molecules, a kidney nephron and a liver cell.
import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

export const AT = {
  rbc: new THREE.Vector3(720, 120, 0),
};

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const INFERNO = [[0.0874,0.0446,0.2248],[0.1834,0.0403,0.355],[0.2778,0.0424,0.4144],[0.3728,0.0739,0.4324],[0.4599,0.1061,0.4298],[0.5534,0.1391,0.4118],[0.6401,0.1714,0.3811],[0.7299,0.2128,0.3339],[0.8071,0.2627,0.2789],[0.878,0.3321,0.2123],[0.9296,0.4115,0.1454],[0.9673,0.5091,0.0687],[0.986,0.6158,0.0256],[0.9856,0.7208,0.1122],[0.9662,0.8362,0.2615],[0.9464,0.9372,0.4586],[0.9618,0.9759,0.5719]];
export function inferno(u, out = new THREE.Color()) {
  u = Math.min(Math.max(u, 0), 1) * (INFERNO.length - 1);
  const i = Math.min(Math.floor(u), INFERNO.length - 2), f = u - i, a = INFERNO[i], b = INFERNO[i + 1];
  return out.setRGB(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, THREE.SRGBColorSpace);
}

// ---------- geometry helpers ----------
// sweep an elliptical cross-section along a path; rx(s) = half-width, rz(s) = half-depth
function sweep(points, rx, rz = rx, { seg = 64, rad = 28, cap = true, up = V(0, 0, 1) } = {}) {
  const curve = new THREE.CatmullRomCurve3(points, false, "centripetal");
  const pos = [], nor = [], idx = [];
  const t = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), p = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    const s = i / seg;
    curve.getPointAt(s, p); curve.getTangentAt(s, t);
    a.crossVectors(up, t); if (a.lengthSq() < 1e-6) a.set(1, 0, 0); a.normalize();
    b.crossVectors(t, a).normalize();
    const w = rx(s), d = rz(s);
    for (let j = 0; j <= rad; j++) {
      const th = 2 * Math.PI * j / rad, c = Math.cos(th), sn = Math.sin(th);
      pos.push(p.x + a.x * w * c + b.x * d * sn, p.y + a.y * w * c + b.y * d * sn, p.z + a.z * w * c + b.z * d * sn);
      const nx = a.x * c / Math.max(w, 1e-3) + b.x * sn / Math.max(d, 1e-3), ny = a.y * c / Math.max(w, 1e-3) + b.y * sn / Math.max(d, 1e-3), nz = a.z * c / Math.max(w, 1e-3) + b.z * sn / Math.max(d, 1e-3);
      const l = Math.hypot(nx, ny, nz) || 1; nor.push(nx / l, ny / l, nz / l);
    }
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < rad; j++) {
    const k = i * (rad + 1) + j, k2 = k + rad + 1;
    idx.push(k, k2, k + 1, k2, k2 + 1, k + 1);
  }
  if (cap) for (const [i, sgn] of [[0, -1], [seg, 1]]) {
    curve.getPointAt(i / seg, p); curve.getTangentAt(i / seg, t);
    const c0 = pos.length / 3; pos.push(p.x, p.y, p.z); nor.push(t.x * sgn, t.y * sgn, t.z * sgn);
    for (let j = 0; j < rad; j++) { const k = i * (rad + 1) + j; sgn > 0 ? idx.push(c0, k, k + 1) : idx.push(c0, k + 1, k); }
  }
  // make the triangle winding agree with the outward normals (some paths come out mirrored)
  { const P = i => new THREE.Vector3(pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]), mid = Math.floor(seg / 2) * (rad + 1) + 1;
    const a = P(mid), b = P(mid + rad + 1), c = P(mid + 1), gn = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a));
    if (gn.dot(new THREE.Vector3(nor[3 * mid], nor[3 * mid + 1], nor[3 * mid + 2])) < 0) for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } }
  const uv = new Float32Array(pos.length / 3 * 2);
  for (let i = 0; i <= seg; i++) for (let j = 0; j <= rad; j++) { const k = i * (rad + 1) + j; uv[2 * k] = i / seg * 3; uv[2 * k + 1] = j / rad; }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  const arad = new Float32Array(pos.length / 3);   // local radius (cm) at each vertex, for the thermal-camera skin model
  for (let i = 0; i <= seg; i++) { const s = i / seg, r = (rx(s) + rz(s)) / 2; for (let j = 0; j <= rad; j++) arad[i * (rad + 1) + j] = r; }
  if (cap) { arad[(seg + 1) * (rad + 1)] = (rx(0) + rz(0)) / 2; arad[(seg + 1) * (rad + 1) + 1] = (rx(1) + rz(1)) / 2; }
  g.setAttribute("arad", new THREE.BufferAttribute(arad, 1));
  g.setIndex(idx);
  return g;
}
function blob(r, sx, sy, sz, amp = 0.06, freq = 3, detail = 4, seed = 1) {
  // welded icosphere (smooth normals), spherical uv for the surface-detail maps
  let g0 = new THREE.IcosahedronGeometry(r, detail); g0.deleteAttribute("normal"); g0.deleteAttribute("uv");
  const g = mergeVertices(g0), p = g.attributes.position, v = new THREE.Vector3();
  { const uv = new Float32Array(p.count * 2); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).normalize(); uv[2 * i] = 0.5 + Math.atan2(v.z, v.x) / (2 * Math.PI); uv[2 * i + 1] = 0.5 + Math.asin(v.y) / Math.PI; } g.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); }
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(freq * v.x / r + seed) * Math.sin(freq * v.y / r + 2 * seed) * Math.sin(freq * v.z / r + 3 * seed);
    v.multiplyScalar(1 + amp * n); p.setXYZ(i, v.x * sx, v.y * sy, v.z * sz);
  }
  g.computeVertexNormals(); return g;
}
const tubeAlong = (pts, r, seg = 80, closed = false) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed, "centripetal"), seg, r, 14, closed);
const lerp = (a, b, u) => a + (b - a) * u;
function profile(stops) {   // piecewise-smooth interpolation of [s, value] stops
  return s => {
    for (let i = 0; i < stops.length - 1; i++) if (s <= stops[i + 1][0]) {
      const u = (s - stops[i][0]) / (stops[i + 1][0] - stops[i][0]), e = u * u * (3 - 2 * u);
      return lerp(stops[i][1], stops[i + 1][1], e);
    }
    return stops.at(-1)[1];
  };
}

// anatomical glass body: transmissive physical material with a fresnel rim so the outline stays crisp.
// Exposes uColor / uRim / uOpacity like the earlier shader (uOpacity 0..1 maps to how see-through it is).
function skinMaterial() {
  const m = new THREE.MeshPhysicalMaterial({ color: "#e9f0f6", roughness: 0.04, metalness: 0, transmission: 0.9, thickness: 1.2, ior: 1.33,
    attenuationColor: new THREE.Color("#b9c9da"), attenuationDistance: 160, clearcoat: 0.15, clearcoatRoughness: 0.05, specularIntensity: 0.5, envMapIntensity: 0.25 });
  const rim = new THREE.Color("#5b7590"), rimStr = { value: 0.75 };
  m.onBeforeCompile = sh => {
    sh.uniforms.uRimColor = { value: rim }; sh.uniforms.uRimStr = rimStr;
    sh.fragmentShader = "uniform vec3 uRimColor; uniform float uRimStr;\n" + sh.fragmentShader.replace("#include <dithering_fragment>",
      "float fr = pow(1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0), 3.0);\n gl_FragColor.rgb = mix(gl_FragColor.rgb, uRimColor, fr * uRimStr);\n#include <dithering_fragment>");
  };
  let op = 0.42;
  m.uniforms = { uColor: { value: m.color }, uRim: { value: rim },
    uOpacity: { get value() { return op; }, set value(v) { op = v; m.transmission = Math.min(1, Math.max(0.6, 1.08 - 0.3 * v)); m.roughness = v < 0.2 ? 0.015 : 0.025; rimStr.value = v < 0.2 ? 0.4 : 0.75; } } };
  m.uniforms.uOpacity.value = op;
  return m;
}
// ---------- procedural surface detail (no texture downloads): tileable value noise -> normal + roughness maps ----------
function noiseField(n, octaves, seed) {
  let r = seed; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  const h = new Float32Array(n * n);
  for (let o = 0; o < octaves; o++) {
    const cells = 4 << o, amp = 1 / (1 << o), g = Array.from({ length: cells * cells }, rnd);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const fx = x / n * cells, fy = y / n * cells, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty), at = (i, j) => g[((j % cells) * cells) + (i % cells)];
      const a = at(x0, y0), b = at(x0 + 1, y0), c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1);
      h[y * n + x] += amp * ((a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy);
    }
  }
  return h;
}
function surfaceMaps(n = 256, octaves = 5, seed = 7, bump = 3.5, rLo = 0.3, rHi = 0.6, rep = 3) {
  const h = noiseField(n, octaves, seed), cn = document.createElement("canvas"), cr = document.createElement("canvas");
  cn.width = cn.height = cr.width = cr.height = n;
  const gn = cn.getContext("2d"), gr = cr.getContext("2d"), dn = gn.createImageData(n, n), dr = gr.createImageData(n, n);
  let mn = Infinity, mx = -Infinity; for (const v of h) { mn = Math.min(mn, v); mx = Math.max(mx, v); }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const H = (i, j) => h[((j + n) % n) * n + ((i + n) % n)];
    const dx = (H(x + 1, y) - H(x - 1, y)) * bump, dy = (H(x, y + 1) - H(x, y - 1)) * bump, l = Math.hypot(dx, dy, 1), k = 4 * (y * n + x);
    dn.data[k] = (-dx / l * 0.5 + 0.5) * 255; dn.data[k + 1] = (-dy / l * 0.5 + 0.5) * 255; dn.data[k + 2] = (1 / l * 0.5 + 0.5) * 255; dn.data[k + 3] = 255;
    const u = (h[y * n + x] - mn) / (mx - mn), rv = (rLo + (rHi - rLo) * u) * 255;
    dr.data[k] = dr.data[k + 1] = dr.data[k + 2] = rv; dr.data[k + 3] = 255;
  }
  gn.putImageData(dn, 0, 0); gr.putImageData(dr, 0, 0);
  const tn = new THREE.CanvasTexture(cn), tr = new THREE.CanvasTexture(cr);
  for (const t of [tn, tr]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.anisotropy = 4; }
  return { normalMap: tn, roughnessMap: tr };
}
// wet living tissue: clearcoat film, soft sheen (subsurface feel), fine bumpy surface
// Part M: museum-model look. Organs are smooth, matte-satin shapes in pale, desaturated tones (no wet film, no tissue texture);
// colour is reserved for what is active (emissive glow set in app.js).
const MUTED = (color, sat = 0.3) => { const c = new THREE.Color(color), h = {}; c.getHSL(h); return c.setHSL(h.h, h.s * sat, 0.6 + 0.3 * h.l); };
const wet = (color, extra = {}) => { const { sheen, sheenColor, normalScale, roughness, ...rest } = extra;
  return new THREE.MeshPhysicalMaterial({ color: MUTED(color), roughness: 0.62, clearcoat: 0.25, clearcoatRoughness: 0.5, envMapIntensity: 0.6, ...rest }); };

export function buildWorld(scene) {
  const W = { flows: [] };
  const body = new THREE.Group(); scene.add(body); W.body = body;

  // ---------- floor: a round exam platform ----------
  // exam platform: satin resin top, brushed-steel bevelled rim, a soft blue light ring, contact shadow under the feet
  const resin = surfaceMaps(256, 4, 3, 1.2, 0.35, 0.55, 6);
  const floorMat = new THREE.MeshPhysicalMaterial({ color: "#c3c9d0", roughness: 1, roughnessMap: resin.roughnessMap, normalMap: resin.normalMap, normalScale: new THREE.Vector2(0.15, 0.15), clearcoat: 0.35, clearcoatRoughness: 0.4 });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(60, 60, 3, 128), floorMat); disc.position.y = -1.5; disc.receiveShadow = true; scene.add(disc);
  const steel = new THREE.MeshStandardMaterial({ color: "#c9ced4", metalness: 1, roughness: 0.32 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(61.2, 1.6, 20, 160).rotateX(Math.PI / 2), steel); rim.position.y = -1.2; rim.castShadow = true; rim.receiveShadow = true; scene.add(rim);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(62.5, 64, 1.6, 128), steel); base.position.y = -2.6; scene.add(base);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(58.6, 0.35, 8, 160).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: "#b8c4d0", emissive: "#9fb3c8", emissiveIntensity: 0.6 })); ring.position.y = 0.08; scene.add(ring);
  { const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d"), gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    gr.addColorStop(0, "rgba(20,24,30,0.55)"); gr.addColorStop(0.55, "rgba(20,24,30,0.18)"); gr.addColorStop(1, "rgba(20,24,30,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    for (const sx of [-1, 1]) { const cs = new THREE.Mesh(new THREE.PlaneGeometry(14, 26).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false })); cs.position.set(sx * 9.5, 0.06, 6); cs.userData.noAO = true; scene.add(cs); } }
  const ground = new THREE.Mesh(new THREE.CircleGeometry(3000, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: "#c2c8cf", roughness: 1, envMapIntensity: 0 })); ground.position.y = -3; ground.receiveShadow = true; scene.add(ground);
  W.floor = [disc, rim, base, ring, ground];

  // ---------- skin shell ----------
  const skinMat = skinMaterial(); W.skinMat = skinMat;
  const skinParts = [];
  const addSkin = g => { const m = new THREE.Mesh(g, skinMat); m.userData.noAO = true; body.add(m); skinParts.push(m); return m; };
  // Part M silhouette: 7.5 heads tall (175 cm, head 23.3 cm). Landmarks: chin 152, shoulders 144, nipples 129, elbows and waist 107,
  // crotch 85 (half height), wrists 86, fingertips 67, knees 49, ankles 8. Smooth sweeps, mirror-symmetric.
  // torso, from the base of the neck down to the crotch (half-widths and half-depths in cm)
  const tY = s => 147 - 63 * s;   // s = 0 at y 147, 1 at y 84
  const sOf = y => (147 - y) / 63;
  addSkin(sweep([V(0, 147, -0.6), V(0, 136, 0), V(0, 124, 0.4), V(0, 110, 0.2), V(0, 96, 0), V(0, 84, -0.2)],
    profile([[0, 6.2], [sOf(145), 10.5], [sOf(141.5), 15.0], [sOf(137), 16.2], [sOf(126), 15.4], [sOf(116), 14.2], [sOf(107), 13.2], [sOf(97), 15.8], [sOf(91), 16.6], [sOf(87), 14.4], [1, 9.5]]),
    profile([[0, 5.6], [sOf(144.5), 7.2], [sOf(138), 9.6], [sOf(128), 11.0], [sOf(118), 10.4], [sOf(107), 9.6], [sOf(97), 10.2], [sOf(91), 10.6], [sOf(87), 9.6], [1, 6.0]]), { seg: 110, rad: 44 }));
  // head (chin to crown) and neck
  addSkin(sweep([V(0, 149.5, 1.6), V(0, 154, 1.4), V(0, 160, 0.9), V(0, 166, 0.2), V(0, 171.5, -0.4), V(0, 175, -0.6)],
    profile([[0, 4.4], [0.12, 6.2], [0.32, 7.1], [0.58, 7.6], [0.82, 6.9], [0.94, 4.6], [1, 0.4]]),
    profile([[0, 4.2], [0.12, 7.4], [0.32, 9.4], [0.58, 9.9], [0.82, 8.6], [0.94, 5.6], [1, 0.4]]), { seg: 72, rad: 40 }));
  addSkin(sweep([V(0, 144, -0.8), V(0, 149, -0.4), V(0, 155, -0.4)], profile([[0, 6.6], [0.3, 5.4], [1, 5.2]]), profile([[0, 6.0], [0.3, 5.6], [1, 5.6]]), { seg: 24, rad: 32 }));
  const nose = new THREE.Mesh(new THREE.CapsuleGeometry(0.9, 2.0, 6, 12).rotateX(Math.PI / 2 - 0.35), skinMat); nose.position.set(0, 160.5, 9.9); nose.userData.noAO = true; nose.userData.r = 0.9; body.add(nose); skinParts.push(nose);
  for (const sx of [-1, 1]) { const ear = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), skinMat); ear.scale.set(0.6, 2.8, 1.5); ear.position.set(sx * 7.6, 162, 0.2); ear.userData.noAO = true; ear.userData.r = 0.7; body.add(ear); skinParts.push(ear); }
  for (const sx of [-1, 1]) {
    // arm: shoulder cap -> deltoid -> elbow (y 107) -> wrist (y 86)
    addSkin(sweep([V(sx * 14.5, 145.2, -0.4), V(sx * 18.6, 143, -0.5), V(sx * 21.0, 136, -0.7), V(sx * 22.0, 124, -1.0), V(sx * 22.8, 107, -0.6), V(sx * 23.8, 96, 0.6), V(sx * 24.6, 86, 1.6)],
      profile([[0, 3.2], [0.07, 5.0], [0.16, 5.3], [0.42, 4.2], [0.66, 3.3], [0.75, 3.6], [0.91, 2.7], [1, 2.4]]),
      profile([[0, 3.6], [0.07, 5.4], [0.16, 5.2], [0.42, 4.3], [0.66, 3.6], [0.75, 3.8], [0.91, 2.2], [1, 1.9]]), { seg: 80, rad: 28 }));
    // hand: a smooth mitten with a thumb
    addSkin(sweep([V(sx * 24.6, 86.5, 1.6), V(sx * 24.9, 80, 2.2), V(sx * 25.0, 73, 2.6), V(sx * 24.9, 67.5, 2.6)],
      profile([[0, 2.4], [0.3, 4.0], [0.75, 4.0], [1, 2.6]]), profile([[0, 1.9], [0.3, 1.6], [0.75, 1.3], [1, 0.9]]), { seg: 28, rad: 20, up: V(1, 0, 0) }));
    { const t = new THREE.Mesh(new THREE.CapsuleGeometry(0.75, 3.8, 6, 12), skinMat); t.position.set(sx * 24.2, 79.5, 5.4); t.rotation.set(0.55, 0, sx * 0.2); t.userData.noAO = true; t.userData.r = 0.75; body.add(t); skinParts.push(t); }
    // leg: hip -> knee (y 49) -> ankle (y 8)
    addSkin(sweep([V(sx * 9.2, 93, 0), V(sx * 8.9, 72, 0.6), V(sx * 8.4, 49, 0.6), V(sx * 8.4, 34, -0.6), V(sx * 8.4, 18, -0.8), V(sx * 8.4, 7, -1.4)],
      profile([[0, 8.6], [0.14, 8.0], [0.33, 6.6], [0.5, 4.9], [0.55, 4.9], [0.66, 5.4], [0.84, 3.7], [1, 3.0]]),
      profile([[0, 9.0], [0.14, 8.6], [0.33, 7.0], [0.5, 5.2], [0.55, 5.4], [0.66, 6.2], [0.84, 4.0], [1, 3.3]]), { seg: 84, rad: 32 }));
    // foot: heel to toes, about 26 cm long
    addSkin(sweep([V(sx * 8.4, 6.5, -4.2), V(sx * 8.6, 3.6, -1), V(sx * 9.0, 2.6, 8), V(sx * 9.4, 2.0, 15.5), V(sx * 9.6, 1.9, 19)],
      profile([[0, 3.1], [0.3, 3.7], [0.75, 4.4], [1, 2.4]]), profile([[0, 3.9], [0.3, 3.3], [0.75, 1.9], [1, 1.1]]), { seg: 28, rad: 20, up: V(1, 0, 0) }));
  }
  W.skinParts = skinParts;
  // thermal-camera skin: vertex colours from the local skin temperature (set in app.js), drawn without lighting
  W.thermMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false });
  W.thermR = [];
  for (const m of skinParts) {
    const g = m.geometry, n = g.attributes.position.count;
    if (!g.attributes.arad) { const a = new Float32Array(n).fill(m.userData.r || 1); g.setAttribute("arad", new THREE.BufferAttribute(a, 1)); }
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    m.userData.glass = m.material;
  }

  // sweat droplets sampled on the skin surface
  {
    const n = 420, geo = new THREE.SphereGeometry(0.55, 8, 6);
    const mat = new THREE.MeshPhysicalMaterial({ color: "#dff2ff", roughness: 0.05, transmission: 0.6, transparent: true, opacity: 0.85, clearcoat: 1 });
    const drops = new THREE.InstancedMesh(geo, mat, n); drops.count = 0; drops.renderOrder = 21;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), nn = new THREE.Vector3();
    const torso = skinParts[0].geometry, head = skinParts[1].geometry;
    for (let i = 0; i < n; i++) {
      const g = i % 3 === 0 ? head : i % 3 === 1 ? torso : skinParts[2 + (i % 4)].geometry;
      const P = g.attributes.position, N = g.attributes.normal, k = Math.floor(Math.random() * (P.count - 2));
      p.fromBufferAttribute(P, k); nn.fromBufferAttribute(N, k); p.addScaledVector(nn, 0.3);
      if (g === head && p.y < 150) p.y += 10;
      sc.setScalar(0.6 + Math.random() * 0.8); m4.compose(p, q, sc); drops.setMatrixAt(i, m4);
    }
    body.add(drops); W.drops = drops;
  }

  // ---------- skeleton hints: spine, ribs, pelvis ----------
  const boneMat = new THREE.MeshPhysicalMaterial({ color: "#eef0f2", roughness: 0.55, clearcoat: 0.2, envMapIntensity: 0.6 });
  for (let y = 92; y <= 150; y += 2.6) {
    const v = new THREE.Mesh(new THREE.CylinderGeometry(1.5 + (150 - y) * 0.012, 1.5 + (150 - y) * 0.012, 1.9, 12), boneMat);
    v.position.set(0, y, -7.6 + 2.2 * Math.sin((y - 92) / 58 * Math.PI) * 0.6); body.add(v);
  }
  const ribs = new THREE.Group(); body.add(ribs); W.ribs = ribs;
  for (let k = 0; k < 9; k++) {
    const y = 138 - k * 3.2, w = 11 + 3.6 * Math.sin(Math.min(k / 5, 1) * Math.PI / 2), d = 8.5 + 1.5 * Math.sin(Math.min(k / 4, 1) * Math.PI / 2);
    for (const sx of [-1, 1]) {
      const pts = []; for (let i = 0; i <= 14; i++) { const a = -Math.PI / 2 + Math.PI * 0.82 * i / 14; pts.push(V(sx * w * Math.cos(a) * 0.98, y - 2.2 * Math.sin(Math.PI * i / 14), d * Math.sin(a) * 0.95 + 0.5)); }
      const r = new THREE.Mesh(tubeAlong(pts, 0.3, 30), boneMat); ribs.add(r);
    }
  }
  const pelvis = new THREE.Mesh(new THREE.TorusGeometry(10, 2.2, 10, 40, Math.PI * 1.25).rotateX(Math.PI / 2 - 0.5).rotateY(Math.PI * 0.125 + Math.PI), boneMat);
  pelvis.position.set(0, 88, -1); pelvis.scale.set(1.25, 1, 0.85); body.add(pelvis);

  // ---------- organs ----------
  const O = {}; W.organs = O;
  const organ = (name, geo, mat, pos, rot = [0, 0, 0]) => { const m = new THREE.Mesh(geo, mat); m.position.copy(pos); m.rotation.set(...rot); m.castShadow = true; body.add(m); O[name] = m; return m; };
  // brain: folded cortex (sulci from a ridged pattern) and a midline fissure
  const brainGeo = (() => { const g = blob(1, 6.6, 5.4, 8.2, 0, 1, 6, 2), p = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = v.clone().normalize();
      const w = Math.sin(9 * n.x + 2.2 * Math.sin(7 * n.y)) * Math.sin(9 * n.y + 2.2 * Math.sin(7 * n.z)) * Math.sin(9 * n.z + 2.2 * Math.sin(7 * n.x));
      const fold = 1 - 0.07 * Math.exp(-(w * w) / 0.012) - 0.12 * Math.exp(-(n.x * n.x) / 0.0025) * Math.max(0, n.y + 0.2);
      v.multiplyScalar(fold); p.setXYZ(i, v.x, v.y, v.z); }
    g.computeVertexNormals(); return g; })();
  organ("brain", brainGeo, wet("#d6a09c", { sheen: 0.5, sheenColor: new THREE.Color("#f0c4bd") }), V(0, 166.5, -0.4));
  // lungs: two lobed sponges with a notch for the heart on the left
  const lungMat = wet("#c9606e", { sheen: 0.3, sheenColor: new THREE.Color("#f2a9b3") });
  const lungGeo = sx => {
    const g = blob(1, 7.2, 12.5, 7.8, 0.04, 6, 5, sx > 0 ? 4 : 1), p = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      if (v.y < 0) v.y *= 0.72;                                            // flattened base on the diaphragm
      v.x *= 1 - 0.35 * Math.max(0, (v.y - 4) / 12);                       // narrow apex
      if (sx > 0 && v.x < -2 && v.y < 2 && v.z > -1) v.x += 2.4 * Math.min(1, (-2 - v.x) / 4);  // cardiac notch
      const ob = v.y * 0.78 + v.z * 0.62 - 0.5;                              // oblique fissure: upper and lower lobes
      const hz = sx < 0 ? v.y - 3 + 0.25 * v.z : 99;                         // right lung: horizontal fissure (middle lobe)
      const groove = 0.75 * Math.exp(-(ob * ob) / 0.35) + (v.z > -1 ? 0.6 * Math.exp(-(hz * hz) / 0.3) : 0);
      const r0 = Math.hypot(v.x, v.z) || 1; v.x *= 1 - groove / (r0 + 6); v.z *= 1 - groove / (r0 + 6);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals(); return g;
  };
  organ("lungR", lungGeo(-1), lungMat, V(-8.4, 124, -0.5));
  organ("lungL", lungGeo(1), lungMat, V(8.2, 123, -0.5));
  const airMat = wet("#d9c9bf", { roughness: 0.5 });
  organ("trachea", tubeAlong([V(0, 151, 1.5), V(0, 142, 1.2), V(0, 133, 0.6)], 1.15, 30), airMat, V(0, 0, 0));
  for (const sx of [-1, 1]) {
    const g = tubeAlong([V(0, 133, 0.6), V(sx * 3.5, 130.5, 0.2), V(sx * 6.5, 127, -0.4), V(sx * 8, 122, -0.6)], 0.75, 30);
    const m = new THREE.Mesh(g, airMat); body.add(m);
  }
  // heart
  const heartGeo = blob(1, 4.8, 5.6, 4.3, 0.07, 4, 5, 3); heartGeo.translate(0, -1.2, 0);
  organ("heart", heartGeo, wet("#7c0f19", { sheen: 0.3 }), V(3.2, 119, 3.6), [0.15, 0.25, 0.55]);
  { // coronary arteries and cardiac veins on the heart surface (they beat with it)
    const onHeart = (a0, a1, y0, y1, k = 1.04) => { const pts = []; for (let i = 0; i <= 16; i++) { const u = i / 16, a = lerp(a0, a1, u), y = lerp(y0, y1, u);
      const rr = Math.sqrt(Math.max(0.05, 1 - (y / 5.6) ** 2)); pts.push(V(4.8 * rr * Math.cos(a) * k, y - 1.2, 4.3 * rr * Math.sin(a) * k)); } return pts; };
    [[1.2, 1.9, 4.5, -4.6, "#c3202c"], [0.6, -0.9, 4.2, 0.5, "#c3202c"], [2.4, 3.3, 4.3, -3.8, "#3b3a8a"], [-0.4, -1.4, 3.6, -3.2, "#c3202c"]].forEach(([a0, a1, y0, y1, c]) =>
      O.heart.add(new THREE.Mesh(tubeAlong(onHeart(a0, a1, y0, y1), 0.2, 40), wet(c))));
  }
  // diaphragm
  const dia = new THREE.Mesh(new THREE.SphereGeometry(16, 40, 16, 0, Math.PI * 2, 0, Math.PI * 0.32), new THREE.MeshStandardMaterial({ color: "#b55a50", roughness: 0.7, transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false }));
  dia.scale.set(1, 0.5, 0.7); dia.position.set(0, 104, 0); dia.visible = false; body.add(dia); O.diaphragm = dia;
  // liver: a wedge, large on the right
  const liverGeo = blob(1, 10.5, 6.2, 7.2, 0.05, 3, 5, 5), lp = liverGeo.attributes.position, lv = new THREE.Vector3();
  for (let i = 0; i < lp.count; i++) { lv.fromBufferAttribute(lp, i); const u = (lv.x + 10.5) / 21; lv.y *= lerp(1.15, 0.45, u); lv.y += lerp(0, 2.2, u); lp.setXYZ(i, lv.x, lv.y, lv.z); }
  liverGeo.computeVertexNormals();
  organ("liver", liverGeo, wet("#6b2219", { sheen: 0.3 }), V(-4.5, 106.5, 1.2), [0, 0, -0.12]);
  organ("gallbladder", blob(1, 1.4, 2.4, 1.3, 0.03), wet("#5c7a3a"), V(-5, 101, 6.5), [0, 0, 0.4]);
  // stomach: a J-shaped sac on the left
  const stomachPts = [V(1.5, 113, -1), V(4.5, 111, 1), V(8.5, 107, 3), V(9.2, 101.5, 4), V(6.5, 97.5, 4.5), V(2, 97.5, 4), V(-1.5, 99, 3)];
  organ("stomach", sweep(stomachPts, profile([[0, 1.2], [0.2, 3.6], [0.45, 4.6], [0.7, 3.6], [1, 1.6]]), profile([[0, 1.2], [0.2, 3.2], [0.45, 4.0], [0.7, 3.2], [1, 1.5]]), { seg: 50, rad: 22, up: V(0, 0, 1) }), wet("#d27c69"), V(0, 0, 0));
  organ("esophagus", tubeAlong([V(0, 150, -1.5), V(0.4, 135, -3), V(1, 120, -2.5), V(1.5, 113, -1)], 0.9, 30), wet("#d88b80"), V(0, 0, 0));
  organ("pancreas", sweep([V(-3, 99.5, -1.5), V(2, 100, -2), V(7, 101.5, -2.5)], s => lerp(1.7, 0.9, s), s => lerp(1.3, 0.8, s), { seg: 20, rad: 14 }), wet("#e8c08e"), V(0, 0, 0));
  // intestines: a coiled small intestine framed by the large intestine
  {
    const pts = []; let x = -1.5, y = 96, z = 4;
    for (let i = 0; i < 46; i++) { const a = i * 0.9; pts.push(V(6.5 * Math.sin(a * 0.73) + 0.6 * Math.sin(a * 3.1), 95 - i * 0.33 + 2 * Math.sin(a * 1.9), 3.6 + 2.2 * Math.cos(a * 1.3))); }
    organ("smallInt", tubeAlong(pts, 1.25, 600), wet("#d6806d", { normalScale: new THREE.Vector2(0.8, 0.8) }), V(0, 0, 0));
    organ("largeInt", tubeAlong([V(-8, 81, 3), V(-9.6, 88, 3), V(-9.8, 96, 2.5), V(-6, 99, 4), V(0, 98.6, 5), V(6, 99.2, 4), V(9.6, 97, 2.5), V(9.8, 88, 2.5), V(8.5, 81.5, 3), V(4, 79, 2.5), V(0.5, 78, 1)], 2.2, 160), wet("#b9634c", { normalScale: new THREE.Vector2(0.9, 0.9) }), V(0, 0, 0));
  }
  // kidneys (behind the gut), ureters and bladder
  const kidGeo = (() => { const g = blob(1, 2.9, 5.3, 2.4, 0.03, 3, 4, 6), p = g.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); if (v.x < 0) v.x *= 1 - 0.45 * Math.exp(-(v.y * v.y) / 6); p.setXYZ(i, v.x, v.y, v.z); } g.computeVertexNormals(); return g; })();
  for (const sx of [-1, 1]) {
    const k = organ(sx < 0 ? "kidneyR" : "kidneyL", kidGeo, wet("#7a2421", { roughness: 0.42 }), V(sx * 6.6, sx < 0 ? 100.5 : 102.5, -5.8), [0, sx < 0 ? Math.PI : 0, sx * 0.18]);
    const u = new THREE.Mesh(tubeAlong([V(sx * 5.4, 98, -5), V(sx * 4.6, 90, -4), V(sx * 4.2, 82, -1.5), V(sx * 2.2, 77.5, 2)], 0.35, 40), wet("#e6d48a")); body.add(u);
  }
  O.kidneys = [O.kidneyR, O.kidneyL];
  organ("bladder", new THREE.SphereGeometry(3.4, 28, 20), wet("#e3c25c", { sheen: 0.2 }), V(0, 77, 3));
  // working muscles: thighs and calves glow with effort
  // skeletal muscle: spindle-shaped bellies with fibre striations (noise stretched along the muscle); glow with effort
  const muscleMat = new THREE.MeshPhysicalMaterial({ color: "#cdd4db", roughness: 0.6, clearcoat: 0.2, clearcoatRoughness: 0.5, emissive: "#c5050c", emissiveIntensity: 0 });
  W.muscleMat = muscleMat;
  const spindle = (pts, w, d) => new THREE.Mesh(sweep(pts, profile([[0, 0.25 * w], [0.18, 0.8 * w], [0.5, w], [0.82, 0.75 * w], [1, 0.2 * w]]), profile([[0, 0.25 * d], [0.18, 0.8 * d], [0.5, d], [0.82, 0.75 * d], [1, 0.2 * d]]), { seg: 40, rad: 20 }), muscleMat);
  for (const sx of [-1, 1]) {
    [ spindle([V(sx * 8.2, 89, 3.2), V(sx * 9.2, 74, 4.6), V(sx * 9.6, 55, 3.6)], 3.0, 2.6),     // rectus femoris
      spindle([V(sx * 11.6, 86, 1.2), V(sx * 12.6, 72, 1.8), V(sx * 11.4, 56, 2.0)], 2.6, 2.6),  // vastus lateralis
      spindle([V(sx * 6.4, 80, 2.4), V(sx * 7.0, 66, 3.0), V(sx * 8.0, 55, 2.6)], 2.3, 2.3),    // vastus medialis
      spindle([V(sx * 9.4, 88, -4.2), V(sx * 9.6, 72, -4.8), V(sx * 9.4, 55, -3.6)], 3.2, 2.6),  // hamstrings
      spindle([V(sx * 10.6, 49, -3.4), V(sx * 10.4, 38, -4.4), V(sx * 9.8, 22, -2.6)], 2.0, 2.5),// gastrocnemius (lateral head)
      spindle([V(sx * 8.0, 49, -3.4), V(sx * 8.2, 38, -4.6), V(sx * 8.8, 22, -2.6)], 2.0, 2.5),  // gastrocnemius (medial head)
      spindle([V(sx * 10.4, 46, 2.2), V(sx * 10.2, 32, 2.4), V(sx * 9.6, 14, 1.4)], 1.4, 1.3),   // tibialis anterior
    ].forEach(m => { m.castShadow = true; body.add(m); });
  }

  // ---------- blood vessels ----------
  const artMat = wet("#b3121c", { sheen: 0.35, sheenColor: new THREE.Color("#ff8a8a") }), veinMat = wet("#2c4a9c", { sheen: 0.35, sheenColor: new THREE.Color("#9fb6ff") });
  const vessels = { art: [], vein: [] };
  const vessel = (kind, pts, r) => {   // arteries taper away from the heart, veins widen toward it
    const c = new THREE.CatmullRomCurve3(pts, false, "centripetal"), tap = kind === "art" ? s => r * (1 - 0.42 * s) : s => r * (0.6 + 0.4 * s);
    const m = new THREE.Mesh(sweep(pts, tap, tap, { seg: Math.max(24, pts.length * 14), rad: 12 }), kind === "art" ? artMat : veinMat);
    m.castShadow = true; body.add(m); vessels[kind].push({ curve: c, len: c.getLength(), r }); return m; };
  // aorta: up from the heart, over the arch, down the back to the pelvis
  vessel("art", [V(2.6, 121, 3.4), V(1.6, 126.5, 2.8), V(0, 129, 0), V(-0.8, 127, -4), V(-0.9, 118, -5.4), V(-0.8, 105, -5.4), V(-0.4, 94, -4.4)], 1.15);
  for (const sx of [-1, 1]) {
    vessel("art", [V(-0.4, 94, -4.4), V(sx * 4.5, 90, -2.5), V(sx * 8.4, 84, 0), V(sx * 9.5, 64, 1.6), V(sx * 9.4, 48, -0.8), V(sx * 9.1, 26, -1.4), V(sx * 9.2, 8, 0.5), V(sx * 9.6, 3, 9)], 0.75);
    vessel("art", [V(sx * 1.2, 128.8, 0.6), V(sx * 2.4, 140, 1), V(sx * 2.8, 151, 1.6), V(sx * 3.2, 160, 1.5), V(sx * 1.5, 166, 1)], 0.5);
    vessel("art", [V(sx * 0.6, 128.6, 0), V(sx * 9, 137, -0.6), V(sx * 18.5, 135.5, -0.6), V(sx * 21.3, 120, -0.4), V(sx * 22.8, 104, 0.6), V(sx * 23.6, 88, 2), V(sx * 24, 74, 2.8)], 0.55);
    vessel("art", [V(-0.8, 103, -5.2), V(sx * 3.4, 102, -5.8), V(sx * 5, 101.5, -5.6)], 0.42);   // renal arteries
    vessel("vein", [V(sx * 9.8, 3, 7), V(sx * 9.6, 9, -1.8), V(sx * 9.6, 30, 0.6), V(sx * 9.9, 50, 1.4), V(sx * 10, 66, 2.4), V(sx * 8.8, 84, 1.4), V(sx * 4.2, 90.5, -1.6), V(1.6, 94.2, -3.6)], 0.8);
    vessel("vein", [V(sx * 24.4, 74, 3.4), V(sx * 24.2, 88, 2.8), V(sx * 23.4, 104, 1.6), V(sx * 22, 120, 0.8), V(sx * 19, 135, 0.4), V(sx * 9, 138, 0.8), V(sx * 1.6, 132, 1.2)], 0.55);
    vessel("vein", [V(sx * 2, 166, 2), V(sx * 4.2, 158, 2.2), V(sx * 4, 147, 2), V(sx * 1.8, 134, 1.4)], 0.55);
    vessel("vein", [V(sx * 5, 100.5, -4.6), V(sx * 3.2, 101, -4.4), V(1.8, 101.5, -4)], 0.45);
  }
  vessel("vein", [V(1.6, 94.2, -3.6), V(1.9, 104, -4), V(1.6, 112, -1.5), V(1.6, 116.5, 2.2)], 1.25);   // inferior vena cava
  vessel("vein", [V(0, 134, 1.2), V(0.6, 126, 1.6), V(1.6, 120.5, 2.6)], 1.1);                       // superior vena cava
  // portal flow: gut -> liver, and hepatic artery
  vessel("vein", [V(2, 92, 3), V(0, 97, 1.5), V(-2.5, 102, 1), V(-4.5, 105, 1.2)], 0.6);
  vessel("art", [V(-0.8, 110, -5.2), V(-2.4, 108, -2), V(-4, 106, 0.4)], 0.35);
  // lungs: pulmonary artery (blue blood) and pulmonary veins (red blood)
  for (const sx of [-1, 1]) {
    vessel("vein", [V(3.4, 123, 4.6), V(2, 125.8, 2.6), V(sx * 4.5, 125.2, 0.2), V(sx * 7.5, 124, -0.4)], 0.6);
    vessel("art", [V(sx * 7.6, 120, 0.4), V(sx * 4.6, 120.5, 1.2), V(1.4, 120, 2.4)], 0.5);
  }
  W.vessels = vessels;
  // blood cells streaming through the vessels
  const flowMesh = (kind, color, per) => {
    const list = vessels[kind], n = list.reduce((a, v) => a + Math.max(4, Math.round(v.len / per)), 0);
    const m = new THREE.InstancedMesh(new THREE.SphereGeometry(0.42, 8, 6), new THREE.MeshBasicMaterial({ color }), n);
    const items = []; list.forEach(v => { const k = Math.max(4, Math.round(v.len / per)); for (let i = 0; i < k; i++) items.push({ v, u: Math.random() }); });
    m.frustumCulled = false; m.renderOrder = 15; m.material.depthTest = false; m.material.transparent = true; m.material.opacity = 0.9;
    body.add(m); return { m, items };
  };
  W.flowArt = flowMesh("art", "#d9737a", 4.5); W.flowVein = flowMesh("vein", "#8fa3c4", 4.5);
  // air moving in and out of the windpipe
  {
    const n = 60, m = new THREE.InstancedMesh(new THREE.SphereGeometry(0.35, 6, 4), new THREE.MeshBasicMaterial({ color: "#3d8fd6", transparent: true, opacity: 0.9, depthTest: false }), n);
    const curves = [-1, 1].map(sx => new THREE.CatmullRomCurve3([V(0, 160, 10.6), V(0, 157, 6), V(0, 151, 1.5), V(0, 133, 0.6), V(sx * 6.5, 127, -0.4), V(sx * 8.5, 121, -0.4), V(sx * 9, 116, -0.3)]));
    m.frustumCulled = false; m.renderOrder = 16; body.add(m);
    W.air = { m, items: Array.from({ length: n }, (_, i) => ({ c: curves[i % 2], u: Math.random() * 0.98, jitter: V(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5) })) };
  }
  // heat leaving the skin: rising shimmer particles
  {
    const n = 120, m = new THREE.InstancedMesh(new THREE.SphereGeometry(0.7, 6, 4), new THREE.MeshBasicMaterial({ color: "#ffb36b", transparent: true, opacity: 0.55, depthWrite: false }), n);
    m.frustumCulled = false; m.renderOrder = 22; body.add(m);
    W.heat = { m, items: Array.from({ length: n }, () => ({ x: (Math.random() - 0.5) * 44, y: 10 + Math.random() * 160, z: (Math.random() - 0.5) * 22, a: Math.random() })) };
  }

  // ---------- zoom station: one red blood cell, cut open to show hemoglobin ----------
  {
    const g = new THREE.Group(); g.position.copy(AT.rbc); scene.add(g); W.rbcStation = g;
    const big = new THREE.Mesh(rbcGeometry(36, Math.PI * 1.45), new THREE.MeshPhysicalMaterial({ color: "#a3121a", roughness: 0.5, clearcoat: 0.4, side: THREE.DoubleSide, envMapIntensity: 0.4 }));
    big.rotation.x = 0.35; g.add(big); W.bigRbc = big;
    const hb = new THREE.InstancedMesh(blob(1, 1, 1, 1, 0.15, 5, 2), new THREE.MeshStandardMaterial({ roughness: 0.5 }), 260);
    hb.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(260 * 3), 3);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(); let n = 0;
    while (n < 260) {
      const r = 32 * Math.sqrt(Math.random()), a = Math.random() * Math.PI * 2;
      const th = rbcHalfThick(r / 36) * 36 - 1.2; if (th < 0.6) continue;
      const y = (Math.random() * 2 - 1) * (th - 0.6);
      const p = V(r * Math.cos(a), y, r * Math.sin(a)).applyAxisAngle(V(1, 0, 0), 0.35);
      q.setFromEuler(new THREE.Euler(Math.random() * 3, Math.random() * 3, 0)); m4.compose(p, q, V(1, 1, 1).multiplyScalar(Math.min(1.1, th * 0.8))); hb.setMatrixAt(n++, m4);
    }
    g.add(hb); W.rbcHb = hb;
    // vessel wall: a translucent half-tube behind the cell (blood flows along x)
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(70, 70, 260, 64, 1, true, Math.PI * 0.5, Math.PI).rotateZ(Math.PI / 2),
      new THREE.MeshPhysicalMaterial({ color: "#e8c9c4", roughness: 0.7, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    wall.position.set(0, 0, -6); g.add(wall);
    // oxygen molecules (two red atoms) bound on hemoglobin near the cut face, and carbon dioxide (grey carbon, two pale oxygens) in plasma
    const o2 = new THREE.InstancedMesh(o2Geometry(1.6), new THREE.MeshStandardMaterial({ color: "#ff3b30", roughness: 0.3 }), 14);
    const hbm = new THREE.Matrix4(), hp = new THREE.Vector3();
    // put the O2 molecules on hemoglobin that faces the viewer (the open cut), so they can be seen
    const toCam = V(-0.7, 0.35, 0.62).normalize()   /* the open wedge of the lathe (phi 1.45π–2π) faces -x, +z */, order = [...Array(260).keys()].map(i => { hb.getMatrixAt(i, hbm); return [i, hp.setFromMatrixPosition(hbm).dot(toCam)]; }).sort((a, b) => b[1] - a[1]).map(x => x[0]);
    for (let i = 0; i < 14; i++) { hb.getMatrixAt(order[i * 2], hbm); hp.setFromMatrixPosition(hbm).add(V(0, 2.2, 0)); m4.compose(hp, q.setFromEuler(new THREE.Euler(0, i, 0.3 * i)), V(1, 1, 1)); o2.setMatrixAt(i, m4); }
    g.add(o2); W.rbcO2 = o2;
    const co2 = new THREE.Group(); g.add(co2);
    const cMat = new THREE.MeshStandardMaterial({ color: "#59606a", roughness: 0.4 }), oMat = new THREE.MeshStandardMaterial({ color: "#f2a49c", roughness: 0.4 });
    [[-52, 18, 8], [50, -16, 10], [-44, -26, 14], [56, 22, 4], [0, -40, 18], [-8, 42, 6], [34, 40, 12]].forEach(([x, y, z], i) => {
      const m = new THREE.Group(); m.add(new THREE.Mesh(new THREE.SphereGeometry(1.5, 14, 10), cMat));
      for (const sx of [-1, 1]) { const o = new THREE.Mesh(new THREE.SphereGeometry(1.3, 14, 10), oMat); o.position.x = sx * 2.4; m.add(o); }
      m.position.set(x, y, z); m.rotation.set(i, i * 0.7, 0); co2.add(m); });
    W.rbcCO2 = co2;
    // label anchors (local coordinates): membrane rim, one hemoglobin, one O2, one CO2, plasma gap, vessel wall
    const anchor = {};
    { const rim = V(36 * Math.cos(Math.PI * 1.6), 0, 36 * Math.sin(Math.PI * 1.6)).applyAxisAngle(V(1, 0, 0), 0.35); anchor.membrane = rim; }
    hb.getMatrixAt(order[9], hbm); anchor.hemoglobin = new THREE.Vector3().setFromMatrixPosition(hbm);
    o2.getMatrixAt(0, hbm); anchor.oxygen = new THREE.Vector3().setFromMatrixPosition(hbm);
    anchor.co2 = V(50, -16, 10); anchor.plasma = V(-40, 34, 14); anchor.wall = V(-150, -55, -49.3);   /* on the half-tube: y² + (z + 6)² = 70² */
    W.rbcAnchors = anchor;
  }
  return W;
}

// biconcave red-cell profile (Evans–Fung shape), radius R
function rbcHalfThick(x) { x = Math.min(Math.abs(x), 1); return 0.5 * Math.sqrt(1 - x * x) * (0.207 + 2.003 * x * x - 1.123 * x ** 4); }
function rbcGeometry(R, phi = Math.PI * 2) {
  const pts = []; const n = 40;
  for (let i = 0; i <= n; i++) { const x = Math.sin(Math.PI / 2 * i / n); pts.push(new THREE.Vector2(Math.max(x * R, 1e-3), rbcHalfThick(x) * R)); }
  for (let i = n; i >= 0; i--) { const x = Math.sin(Math.PI / 2 * i / n); pts.push(new THREE.Vector2(Math.max(x * R, 1e-3), -rbcHalfThick(x) * R)); }
  const g = new THREE.LatheGeometry(pts, 64, 0, phi); g.computeVertexNormals(); return g;
}
function o2Geometry(r) {
  const a = new THREE.SphereGeometry(r, 12, 8).translate(-r * 0.62, 0, 0), b = new THREE.SphereGeometry(r, 12, 8).translate(r * 0.62, 0, 0);
  return mergeGeos([a, b]);
}
function mergeGeos(list) {
  const pos = [], nor = [], idx = []; let off = 0;
  for (const g of list) {
    const gi = g.index ? g : g; const p = gi.attributes.position, n = gi.attributes.normal;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); }
    if (gi.index) for (let i = 0; i < gi.index.count; i++) idx.push(gi.index.getX(i) + off); else for (let i = 0; i < p.count; i++) idx.push(i + off);
    off += p.count;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx); return g;
}
