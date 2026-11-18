// EV body by lofting superellipse cross-sections (lower body + glass greenhouse), wheels with tyres and rims,
// lights, and an "x-ray" paint for the hero car: clear-coated paint that is opaque at grazing angles (the silhouette)
// and fades to transparent where you look straight through it, so the battery pack under the floor shows.
import * as THREE from "three";

const SE = (t, n) => Math.sign(t) * Math.pow(Math.abs(t), 2 / n);   // superellipse helper
function loft(stations, ring, segs = 40) {
  // stations: [{x, w, yc, hh, top}] ; ring(k) builds the cross-section for station k; returns BufferGeometry
  const pos = [], idx = [], uv = [];
  stations.forEach((s, i) => {
    for (let j = 0; j <= segs; j++) {
      const th = s.top ? Math.PI * j / segs : 2 * Math.PI * j / segs;   // top: half section from one side over the roof
      const c = Math.cos(th), sn = Math.sin(th);
      const z = s.w * SE(c, s.n || 5), y = s.yc + s.hh * SE(s.top ? sn : sn, s.n || 5);
      pos.push(s.x, y, z); uv.push(i / (stations.length - 1), j / segs);
    }
  });
  const R = segs + 1;
  for (let i = 0; i < stations.length - 1; i++) for (let j = 0; j < segs; j++) { const a = i * R + j, b = a + R; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// mid-size EV: 4.70 m long, 1.86 m wide, 1.45 m high, 2.88 m wheelbase
export function carBody() {
  const L = 4.7, N = 48, lower = [], upper = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, x = -L / 2 + u * L;
    const e = Math.min(u, 1 - u) / 0.11, r = e >= 1 ? 1 : Math.sqrt(Math.max(0, 1 - (1 - e) ** 2));   // rounded nose and tail closing to a point
    const y0 = 0.30 + 0.06 * (1 - smooth(0.08, 0.2, u)) + 0.06 * (1 - smooth(0.85, 0.95, u));
    const yb = 0.92 + 0.05 * (1 - smooth(0.0, 0.4, u)) - 0.12 * (1 - smooth(1.0, 0.84, u));   // u = 0 is the tail (x < 0); bonnet lower at the front
    lower.push({ x, w: Math.max(0.93 * r, 0.004), yc: (y0 + yb) / 2, hh: Math.max((yb - y0) / 2 * (0.4 + 0.6 * r), 0.004), n: 6 });
  }
  // greenhouse from the windscreen base (u ≈ 0.36 from the front) to the rear screen (u ≈ 0.86 from the front); car faces +x
  const G = 32;
  for (let i = 0; i <= G; i++) {
    const v = i / G, x = 1.05 - v * 2.95;   // from windscreen base (x = 1.05) back to the tail (x = -1.9)
    const front = smooth(0.0, 0.32, v), back = 1 - smooth(0.72, 1.0, v);
    const roof = 0.93 + 0.52 * Math.min(front, back) ** 0.8;
    upper.push({ x, w: 0.78 - 0.04 * (1 - Math.min(front, back)), yc: 0.93, hh: Math.max(roof - 0.93, 0.02), n: 4, top: true });
  }
  return { lower: loft(lower, null, 48), upper: loft(upper, null, 32) };
}

export function xrayPaint(color) {
  const m = new THREE.MeshPhysicalMaterial({ color, metalness: 0.1, roughness: 0.4, clearcoat: 0.7, clearcoatRoughness: 0.08, envMapIntensity: 0.45, transparent: true, depthWrite: true, side: THREE.FrontSide });
  m.onBeforeCompile = sh => {
    // opaque clear-coat paint above the beltline; below it the body fades to an x-ray (edges kept) so the pack shows
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying float vCarY;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvCarY = position.y;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying float vCarY;").replace("#include <dithering_fragment>", `#include <dithering_fragment>
      float xr = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.2);
      float below = 1.0 - smoothstep(0.80, 0.95, vCarY);
      gl_FragColor.a = mix(mix(1.0, mix(0.05, 0.9, xr), below), 1.0, step(0.99, opacity));`);   // opacity 1 = solid paint (views other than the EV pack)
  };
  m.customProgramCacheKey = () => "xray-belt";
  return m;
}

export function buildCar(color, opts = {}) {
  const g = new THREE.Group();
  const { lower, upper } = carBody();
  const paint = opts.xray ? xrayPaint(color) : new THREE.MeshPhysicalMaterial({ color, metalness: 0.6, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.05 });
  const glass = new THREE.MeshPhysicalMaterial({ color: "#1a2430", metalness: 0, roughness: 0.03, clearcoat: 1, transparent: true, opacity: opts.xray ? 0.55 : 0.85, depthWrite: false, side: THREE.FrontSide });
  const body = new THREE.Mesh(lower, paint), gh = new THREE.Mesh(upper, glass);
  body.castShadow = !opts.xray; gh.castShadow = !opts.xray; g.add(body, gh);
  // roof panel (painted) over the glass, pillars implied by the paint band
  const roof = new THREE.Mesh(upper.clone().scale(0.97, 1.004, 0.86).translate(-0.05, 0.004, 0), paint); roof.renderOrder = 2; g.add(roof);
  // wheel arches (dark liners), tyres, five-spoke rims
  const liner = new THREE.MeshStandardMaterial({ color: "#121314", roughness: 0.9, side: THREE.DoubleSide });
  const tyre = new THREE.MeshStandardMaterial({ color: "#1b1b1d", roughness: 0.82 }), rim = new THREE.MeshStandardMaterial({ color: "#c3c8cd", metalness: 1, roughness: 0.22 });
  for (const wx of [1.44, -1.44]) for (const sd of [1, -1]) {
    const arch = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.24, 32, 1, true, Math.PI / 2 - 1.25, 2.5).rotateX(Math.PI / 2), liner);
    arch.position.set(wx, 0.36, sd * 0.8); g.add(arch);
    const w = new THREE.Group(); w.position.set(wx, 0.35, sd * 0.8); g.add(w);
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.1, 18, 40), tyre); t.castShadow = true; w.add(t);
    w.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.17, 32).rotateX(Math.PI / 2), rim));
    for (let k = 0; k < 5; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.045, 0.03), rim); sp.position.z = sd * 0.09; sp.rotation.z = k * 2 * Math.PI / 5; w.add(sp); }
    w.add(Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.19, 12).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: "#2a2c30", metalness: 0.8, roughness: 0.3 }))));
  }
  // lights: LED headlight strips and full-width tail bar (HDR so they bloom a little)
  const head = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.8, 2.8, 2.6) }), tail = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.07, 0.05) });
  for (const sd of [1, -1]) { const h = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.42), head); h.position.set(2.2, 0.74, sd * 0.55); h.rotation.y = sd * 0.35; g.add(h); }
  for (const sd of [1, -1]) { const tb = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.34), tail); tb.position.set(-2.24, 0.86, sd * 0.5); tb.rotation.y = -sd * 0.35; g.add(tb); }
  // mirrors and door handles
  for (const sd of [1, -1]) { const mi = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8).scale(1.2, 0.8, 1), paint); mi.position.set(0.85, 1.0, sd * 0.97); g.add(mi); }
  return { g, paint };
}

// battery pack: casing with rim, 12 modules showing rows of cylindrical cells, copper busbars, cooling plate, HV connectors
export function buildPack() {
  const p = new THREE.Group();
  const alu = new THREE.MeshStandardMaterial({ color: "#a7adb3", metalness: 0.9, roughness: 0.35 });
  const tray = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.05, 1.62), alu); tray.position.y = -0.02; p.add(tray);
  for (const [w, d, x, z] of [[2.9, 0.04, 0, 0.79], [2.9, 0.04, 0, -0.79], [0.04, 1.62, 1.43, 0], [0.04, 1.62, -1.43, 0]]) { const r = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, d), alu); r.position.set(x, 0.06, z); p.add(r); }
  const plate = new THREE.Mesh(new THREE.BoxGeometry(2.76, 0.025, 1.5), new THREE.MeshStandardMaterial({ color: "#4f93cc", metalness: 0.6, roughness: 0.35 })); plate.position.y = 0.02; p.add(plate);
  const modM = new THREE.MeshStandardMaterial({ color: "#2f3439", roughness: 0.5, metalness: 0.4 });
  const modules = [], cellGeo = new THREE.CylinderGeometry(0.0105 * 2.2, 0.0105 * 2.2, 0.01, 10);   // cell tops (drawn slightly enlarged)
  const cellsPer = 6 * 9, cells = new THREE.InstancedMesh(cellGeo, new THREE.MeshStandardMaterial({ color: "#b9bec3", metalness: 0.9, roughness: 0.3 }), 12 * cellsPer);
  const m4 = new THREE.Matrix4(); let k = 0;
  const bus = new THREE.MeshStandardMaterial({ color: "#c98a4b", metalness: 1, roughness: 0.28 });
  for (let i = 0; i < 12; i++) {
    const mx = -1.1 + (i % 6) * 0.44, mz = (Math.floor(i / 6) - 0.5) * 0.72;
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.11, 0.66), modM); m.position.set(mx, 0.09, mz); m.castShadow = true; p.add(m); modules.push(m);
    for (let a = 0; a < 6; a++) for (let b = 0; b < 9; b++) { m4.makeTranslation(mx - 0.15 + a * 0.06, 0.15, mz - 0.27 + b * 0.0675); cells.setMatrixAt(k++, m4); }
    for (let a = 0; a < 3; a++) { const bb = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.008, 0.6), bus); bb.position.set(mx - 0.12 + a * 0.12, 0.16, mz); p.add(bb); }
  }
  p.add(cells);
  const hv = new THREE.MeshStandardMaterial({ color: "#f07a1a", roughness: 0.45 });
  for (const zz of [-0.36, 0.36]) p.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-1.32, 0.17, zz), new THREE.Vector3(0, 0.19, zz * 0.97), new THREE.Vector3(1.32, 0.17, zz)]), 24, 0.02, 8), hv));
  for (const zz of [-0.18, 0.18]) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 0.1), hv); c.position.set(1.47, 0.07, zz); p.add(c); }   // HV connectors at the front
  return { p, modules };
}

// soft contact shadow: a radial-gradient decal under cars and people
let shadowTex = null;
export function contactShadow(w, d, strength = 0.55) {
  if (!shadowTex) {
    const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(0.55, "rgba(0,0,0,.45)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); shadowTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: strength, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
  m.renderOrder = 1; return m;
}
