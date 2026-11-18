// Modern Agriculture: the 3D farm. A stylised southern-Wisconsin dairy and crop farm (1 unit = 1 m),
// plus three zoom scenes placed far below the farm: soil column with roots, plant cell, molecules.
import * as THREE from "three";
import { Sky } from "three/addons/objects/Sky.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export const CORN = { x0: 60, x1: 700, z0: -440, z1: 60 };
export const SOY = { x0: -660, x1: -60, z0: -440, z1: 60 };
export const PIVOT = { x: 380, z: -190, r: 235 };
export const LAKE = { x: 1010, z: 330, rx: 270, rz: 200 };
export const MICRO = { soil: new THREE.Vector3(0, -5000, 0), cell: new THREE.Vector3(0, -5000, 3000), mol: new THREE.Vector3(0, -5000, 6000) };

const rnd = (() => { let a = 7; return () => { a = (a * 16807) % 2147483647; return (a - 1) / 2147483646; }; })();

function canvasTex(w, h, draw, rep = [1, 1], srgb = true) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function noiseFill(g, w, h, base, amp, n = 9000, size = 2) {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    const v = (rnd() - 0.5) * amp;
    g.fillStyle = v > 0 ? `rgba(255,255,240,${v / 100})` : `rgba(20,15,5,${-v / 100})`;
    g.fillRect(rnd() * w, rnd() * h, size * (0.5 + rnd()), size * (0.5 + rnd()));
  }
}

// tileable value noise (period = grid cells) for procedural height, roughness and normal maps
function tileNoise(seed = 1) {
  const N = 128, v = new Float32Array(N * N); let a = seed * 9973 + 7;
  for (let i = 0; i < N * N; i++) { a = (a * 16807) % 2147483647; v[i] = a / 2147483647; }
  const f = t => t * t * (3 - 2 * t);
  return (x, y, cells) => {   // x, y in [0,1); cells = lattice cells across the tile (<= 128)
    cells = Math.min(cells, N);
    const X = x * cells, Y = y * cells, i = Math.floor(X), j = Math.floor(Y), u = f(X - i), w = f(Y - j);
    const g = (ii, jj) => v[((jj % cells + cells) % cells) * N + ((ii % cells + cells) % cells)];
    return (g(i, j) * (1 - u) + g(i + 1, j) * u) * (1 - w) + (g(i, j + 1) * (1 - u) + g(i + 1, j + 1) * u) * w;
  };
}
const NZ1 = tileNoise(3), NZ2 = tileNoise(11);
const fbm = (x, y, base = 4, oct = 4) => { let s = 0, amp = 0.5; for (let o = 0; o < oct; o++) { s += amp * NZ1(x, y, base << o); amp *= 0.5; } return s; };
// height function h(u, v) in [0,1] -> tangent-space normal map (linear data, repeat-wrapped)
function normalTex(size, hfn, rep = [1, 1], strength = 3) {
  const c = document.createElement("canvas"); c.width = c.height = size; const g = c.getContext("2d"), img = g.createImageData(size, size);
  const H = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) H[y * size + x] = hfn(x / size, y / size);
  const at = (x, y) => H[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let nx = (at(x - 1, y) - at(x + 1, y)) * strength, ny = (at(x, y - 1) - at(x, y + 1)) * strength, nz = 1;
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const k = 4 * (y * size + x); img.data[k] = (nx * 0.5 + 0.5) * 255; img.data[k + 1] = (-ny * 0.5 + 0.5) * 255; img.data[k + 2] = (nz * 0.5 + 0.5) * 255; img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.anisotropy = 8; t.colorSpace = THREE.NoColorSpace;
  return t;
}
// grey-scale roughness map (linear) from a value function in [0,1]
function greyTex(size, fn, rep = [1, 1]) {
  const c = document.createElement("canvas"); c.width = c.height = size; const g = c.getContext("2d"), img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const v = Math.max(0, Math.min(255, fn(x / size, y / size) * 255)), k = 4 * (y * size + x); img.data[k] = img.data[k + 1] = img.data[k + 2] = v; img.data[k + 3] = 255; }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.anisotropy = 8; t.colorSpace = THREE.NoColorSpace;
  return t;
}
const tri = x => 1 - 2 * Math.abs(x - Math.floor(x) - 0.5);   // triangle wave 0..1

export function buildWorld(scene, renderer, { lite = false } = {}) {
  const world = new THREE.Group(); scene.add(world);
  const box = (sx, sy, sz) => new THREE.BoxGeometry(sx, sy, sz);
  const rb2 = (sx, sy, sz, r) => new RoundedBoxGeometry(sx, sy, sz, 2, r ?? Math.min(sx, sy, sz) * 0.2);
  function add(geo, mat, x = 0, y = 0, z = 0, parent = world, shadow = true) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
    m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m;
  }
  const std = (color, rough = 0.8, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });

  // ---------- sky, sun and image-based lighting ----------
  const sunDir = new THREE.Vector3(-520, 560, 420).normalize();
  const skyOpts = { turbidity: 2.6, rayleigh: 2.0, mieCoefficient: 0.004, mieDirectionalG: 0.82 };
  const makeSky = sc => { const k = new Sky(); k.scale.setScalar(sc); const u = k.material.uniforms; u.turbidity.value = skyOpts.turbidity; u.rayleigh.value = skyOpts.rayleigh; u.mieCoefficient.value = skyOpts.mieCoefficient; u.mieDirectionalG.value = skyOpts.mieDirectionalG; u.sunPosition.value.copy(sunDir); return k; };
  const SKY = new THREE.Color("#cfd6da");             // fog colour matched to the sky near the horizon
  scene.background = null;
  scene.fog = new THREE.Fog(SKY, 1500, 9500);
  world.add(makeSky(7000));
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envFarm, envMicro;
  {
    const es = new THREE.Scene(); es.add(makeSky(900));
    const gnd = new THREE.Mesh(new THREE.CircleGeometry(800, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: "#3e4a2a" })); gnd.position.y = -2; es.add(gnd);
    envFarm = pmrem.fromScene(es, 0.02).texture;
    envMicro = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
    scene.environment = envFarm;
  }
  scene.add(new THREE.HemisphereLight("#dfe9f3", "#4f5c34", 0.2));
  const sun = new THREE.DirectionalLight("#ffe3bd", 4.0);
  const SH = lite ? 1024 : 2048, SR = 230;            // shadow map size and half-width (m) of the box that follows the view
  sun.castShadow = true; sun.shadow.mapSize.set(SH, SH);
  Object.assign(sun.shadow.camera, { left: -SR, right: SR, top: SR, bottom: -SR, near: 10, far: 2400 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.35; sun.shadow.radius = 3;
  sun.position.copy(sunDir).multiplyScalar(1000); sun.target.position.set(0, 0, 0);
  scene.add(sun, sun.target);
  const _snap = new THREE.Vector3();
  function followShadow(t) {                           // keep the tight shadow box centred on what the camera looks at (snapped to texels)
    const step = 2 * SR / SH;
    _snap.set(Math.round(t.x / step) * step, 0, Math.round(t.z / step) * step);
    if (_snap.distanceToSquared(sun.target.position) < 1e-6) return;
    sun.target.position.copy(_snap); sun.position.copy(sunDir).multiplyScalar(1000).add(_snap);
  }
  function setShadowSize(n) { sun.shadow.mapSize.set(n, n); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  // polygon offset: the farm's ground layers lie a few cm apart, so each layer gets its own depth bias
  const po = (mat, k) => Object.assign(mat, { polygonOffset: true, polygonOffsetFactor: -k, polygonOffsetUnits: -4 * k });

  // ---------- summer cumulus: soft billboard clouds, flat grey bases and sunlit tops ----------
  {
    const cloudTex = (seed) => canvasTex(256, 160, (g, w, h) => {
      const r2 = mulberry32c(seed);
      for (let k = 0; k < 26; k++) {
        const x = w * (0.2 + 0.6 * r2()), y = h * (0.35 + 0.35 * r2()) - (Math.abs(x - w / 2) / w) * h * 0.25, rad = 22 + 34 * r2();
        const gr = g.createRadialGradient(x, y - rad * 0.25, 0, x, y, rad);
        gr.addColorStop(0, "rgba(255,255,255,0.95)"); gr.addColorStop(0.55, "rgba(246,248,250,0.75)"); gr.addColorStop(1, "rgba(220,226,232,0)");
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
      }
      const base = g.createLinearGradient(0, h * 0.45, 0, h);       // shaded flat base
      base.addColorStop(0, "rgba(160,170,184,0)"); base.addColorStop(1, "rgba(150,160,176,0.55)");
      g.globalCompositeOperation = "source-atop"; g.fillStyle = base; g.fillRect(0, 0, w, h);
    }, [1, 1]);
    const texes = [1, 2, 3, 4, 5].map(cloudTex);
    for (let i = 0; i < 70; i++) {
      const a2 = rnd() * 6.283, d = 1500 + rnd() * 4500, sz = 450 + rnd() * 900;
      const m = new THREE.SpriteMaterial({ map: texes[i % 5], transparent: true, depthWrite: false, depthTest: false, fog: false, opacity: 0.92, color: new THREE.Color(1.15, 1.15, 1.15) });
      const sp = new THREE.Sprite(m); sp.scale.set(sz, sz * 0.62, 1); sp.layers.set(1);   // overlay pass: keeps AO from treating the quads as solid
      sp.position.set(200 + Math.cos(a2) * d, 700 + rnd() * 900 + d * 0.06, Math.sin(a2) * d); sp.renderOrder = -1; world.add(sp);
    }
  }
  function mulberry32c(a2) { return () => { a2 |= 0; a2 = a2 + 0x6D2B79F5 | 0; let t = Math.imul(a2 ^ a2 >>> 15, 1 | a2); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  // ---------- distant farmsteads, silos and tree lines (depth cues toward the horizon) ----------
  {
    const barnR = new THREE.MeshStandardMaterial({ color: "#8e2a22", roughness: 0.8 }), roofG = new THREE.MeshStandardMaterial({ color: "#6d7378", roughness: 0.5, metalness: 0.5 });
    const whiteM = new THREE.MeshStandardMaterial({ color: "#e6e4de", roughness: 0.8 }), siloM = new THREE.MeshStandardMaterial({ color: "#b9b6ae", roughness: 0.85 }), binM = new THREE.MeshStandardMaterial({ color: "#c7ccd0", roughness: 0.35, metalness: 0.8 });
    const treeM = new THREE.MeshStandardMaterial({ color: "#3e5a2a", roughness: 0.95 });
    const treeG = new THREE.IcosahedronGeometry(1, 1);
    const trees = new THREE.InstancedMesh(treeG, treeM, 900); let nt = 0;
    const tree = (x, z, r) => { if (nt < 900) trees.setMatrixAt(nt++, _m4.compose(new THREE.Vector3(x, r * 1.2, z), new THREE.Quaternion(), new THREE.Vector3(r, r * 1.3, r))); };
    const _m4 = new THREE.Matrix4();
    for (let k = 0; k < 14; k++) {
      const a2 = k / 14 * 6.283 + rnd() * 0.3, d = 1700 + rnd() * 2600, cx = 200 + Math.cos(a2) * d, cz = Math.sin(a2) * d * 0.9, ry = rnd() * 3;
      const f = new THREE.Group(); f.position.set(cx, 0, cz); f.rotation.y = ry; world.add(f);
      const bw = 14 + rnd() * 8, bl = 26 + rnd() * 20;
      const b = new THREE.Mesh(new THREE.BoxGeometry(bw, 8, bl), rnd() < 0.7 ? barnR : whiteM); b.position.y = 4; f.add(b);
      const sh = new THREE.Shape(); sh.moveTo(-bw / 2 - 0.5, 0); sh.lineTo(0, 6); sh.lineTo(bw / 2 + 0.5, 0); sh.lineTo(-bw / 2 - 0.5, 0);
      const rf = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: bl + 1, bevelEnabled: false }).translate(0, 8, -bl / 2 - 0.5), roofG); f.add(rf);
      const h = new THREE.Mesh(new THREE.BoxGeometry(10, 7, 9), whiteM); h.position.set(bw + 18, 3.5, 6); f.add(h);
      for (let q = 0; q < 1 + (rnd() * 3 | 0); q++) { const sh2 = 16 + rnd() * 10; const si = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, sh2, 16), rnd() < 0.5 ? siloM : binM); si.position.set(-bw / 2 - 6 - q * 8, sh2 / 2, -6 + q * 2); f.add(si); }
      for (let q = 0; q < 14; q++) tree(cx + (rnd() - 0.5) * 120, cz + (rnd() - 0.5) * 120, 4 + rnd() * 4);
    }
    for (let k = 0; k < 10; k++) {                                   // field-edge tree lines and windbreaks
      const a2 = rnd() * 6.283, d = 1400 + rnd() * 3200, x0 = 200 + Math.cos(a2) * d, z0 = Math.sin(a2) * d, dir = rnd() * 3.14, L = 300 + rnd() * 600;
      for (let t = 0; t < L; t += 9) tree(x0 + Math.cos(dir) * t + (rnd() - 0.5) * 4, z0 + Math.sin(dir) * t + (rnd() - 0.5) * 4, 4 + rnd() * 3);
    }
    trees.count = nt; world.add(trees);
  }

  // ---------- procedural surface detail (normal / roughness maps) ----------
  const NM = {
    grass: normalTex(256, (u, v) => fbm(u, v, 8, 4), [400, 400], 2.2),
    soil: normalTex(256, (u, v) => 0.7 * fbm(u, v, 16, 3) + 0.3 * tri(u * 6), [80, 60], 2.5),
    concrete: normalTex(256, (u, v) => fbm(u, v, 16, 4) * 0.6 + 0.4 * NZ2(u, v, 64), [3, 3], 1.6),
    corrRoof: normalTex(128, (u, v) => 0.5 + 0.5 * Math.sin(2 * Math.PI * 6 * u), [1, 1], 4),
    boards: normalTex(256, (u, v) => (tri(u * 8) > 0.08 ? 1 : 0) * (0.9 + 0.1 * fbm(u, v, 8, 3)), [1, 1], 3),
    binRib: normalTex(128, (u, v) => 0.5 + 0.5 * Math.sin(2 * Math.PI * 8 * v), [1, 30], 3.5),
    water: normalTex(256, (u, v) => 0.6 * fbm(u, v, 4, 4) + 0.4 * NZ2(u, v, 16), [30, 30], 2.0),
    tread: normalTex(128, (u, v) => (tri(u * 10 + (v > 0.5 ? 0.25 : 0)) > 0.5 ? 1 : 0), [1, 1], 4),
    paint: normalTex(128, (u, v) => fbm(u, v, 32, 2) * 0.15, [2, 2], 1),
  };
  const RM = {
    grass: greyTex(128, (u, v) => 0.82 + 0.18 * fbm(u, v, 8, 3), [400, 400]),
    concrete: greyTex(128, (u, v) => 0.75 + 0.25 * fbm(u, v, 16, 3), [3, 3]),
    brushed: greyTex(128, (u, v) => 0.28 + 0.14 * NZ2(u * 0.02, v, 64), [1, 4]),
    grime: greyTex(128, (u, v) => 0.55 + 0.35 * v * fbm(u, v, 8, 3), [1, 1]),
  };

  // ---------- ground ----------
  const grassTex = canvasTex(512, 512, (g, w, h) => {
    noiseFill(g, w, h, "#647a40", 24, 16000, 3);
    for (let i = 0; i < 60; i++) { const x = rnd() * w, y = rnd() * h, r = 20 + rnd() * 60, gr = g.createRadialGradient(x, y, 0, x, y, r);   // drier and lusher patches
      const c = rnd() < 0.5 ? "120,128,70" : "70,96,48"; gr.addColorStop(0, `rgba(${c},0.35)`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  }, [160, 160]);
  add(new THREE.PlaneGeometry(8000, 8000).rotateX(-Math.PI / 2), std("#ffffff", 1, 0, { map: grassTex, normalMap: NM.grass, normalScale: new THREE.Vector2(0.6, 0.6), roughnessMap: RM.grass }), 0, -0.05, 0, world, false).castShadow = false;
  // neighbouring fields (patchwork to the horizon)
  const patchCols = ["#8a7a52", "#6f8a3c", "#9a8d5a", "#5f7d36", "#b0a26a", "#78904a"];
  for (let i = 0; i < 70; i++) {
    const x = (rnd() - 0.5) * 6000, z = (rnd() - 0.5) * 6000;
    if (Math.abs(x - 200) < 1200 && Math.abs(z) < 800) continue;
    const m = add(new THREE.PlaneGeometry(300 + rnd() * 400, 250 + rnd() * 350).rotateX(-Math.PI / 2), po(std(patchCols[i % 6], 0.95), 1), x, 0.06, z, world, false);
    m.rotation.y = (rnd() - 0.5) * 0.1;
  }
  // gravel lane and yard
  const gravel = std("#ffffff", 0.95, 0, { map: canvasTex(256, 256, (g, w, h) => noiseFill(g, w, h, "#a59c8c", 40, 6000, 2), [1, 60]) });
  po(gravel, 2); add(new THREE.PlaneGeometry(7, 1000).rotateX(-Math.PI / 2), gravel, 0, 0.2, -60, world, false);
  add(new THREE.PlaneGeometry(7, 1600).rotateX(-Math.PI / 2).rotateY(Math.PI / 2), gravel, 0, 0.2, 400, world, false);
  add(new THREE.PlaneGeometry(330, 120).rotateX(-Math.PI / 2), po(std("#ffffff", 0.95, 0, { map: canvasTex(256, 256, (g, w, h) => noiseFill(g, w, h, "#b3ad9e", 30, 6000, 2), [6, 3]), normalMap: NM.concrete, normalScale: new THREE.Vector2(0.35, 0.35) }), 1), -20, 0.12, 240, world, false);

  // ---------- crop fields: ground textures (rows + canopy colour per zone) ----------
  // Field ground: a low-res zone map (rgb = canopy colour, a = canopy cover) drives a shader that draws
  // brown soil with furrows and residue, green crop bands along each 76 cm row that widen as the canopy
  // closes, and bare sprayer tramlines (wheel tracks every 36 m). Far away the bands average to the cover.
  const soilTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = "#4b3a2a"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { const v = rnd(); g.fillStyle = v < 0.5 ? `rgba(30,22,14,${0.15 + 0.2 * rnd()})` : `rgba(120,96,70,${0.1 + 0.15 * rnd()})`; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1 + rnd() * 3); }
    for (let r = 0; r < 10; r++) { const x = (r + 0.5) * w / 10; const gr = g.createLinearGradient(x - w / 20, 0, x + w / 20, 0);   // ridge (row) and furrow shading
      gr.addColorStop(0, "rgba(20,14,8,0.35)"); gr.addColorStop(0.5, "rgba(140,110,80,0.18)"); gr.addColorStop(1, "rgba(20,14,8,0.35)"); g.fillStyle = gr; g.fillRect(x - w / 20, 0, w / 10, h); }
    for (let i = 0; i < 420; i++) { g.strokeStyle = `rgba(${190 + rnd() * 30 | 0},${165 + rnd() * 25 | 0},${115 + rnd() * 25 | 0},${0.55 + 0.35 * rnd()})`; g.lineWidth = 1 + rnd() * 2.2;   // last year's stover
      const x = rnd() * w, y = rnd() * h, a2 = rnd() * 6.28, l = 6 + rnd() * 22; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a2) * l, y + Math.sin(a2) * l); g.stroke(); }
  }, [1, 1]);
  const soilN = normalTex(256, (u, v) => 0.75 * (0.5 + 0.5 * Math.cos(2 * Math.PI * 10 * u)) + 0.25 * fbm(u, v, 16, 3), [1, 1], 3);
  function fieldMat(map, F, tram) {
    const m = po(std("#ffffff", 0.95, 0, { map, normalMap: soilN, normalScale: new THREE.Vector2(0.7, 0.7) }), 3);
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, { tSoil: { value: soilTex }, uX0: { value: F.x0 }, uTram: { value: tram ? 1 : 0 } });
      sh.vertexShader = "varying vec3 vWPos;\n" + sh.vertexShader.replace("#include <fog_vertex>", "#include <fog_vertex>\n vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      sh.fragmentShader = "varying vec3 vWPos;\nuniform sampler2D tSoil;\nuniform float uX0;\nuniform float uTram;\n" + sh.fragmentShader
        .replace("#include <normal_fragment_maps>", `#ifdef USE_NORMALMAP_TANGENTSPACE
  { vec3 mapN = texture2D( normalMap, vWPos.xz / 7.6 ).xyz * 2.0 - 1.0; mapN.xy *= normalScale; normal = normalize( tbn * mapN ); }
#endif`)
        .replace("#include <map_fragment>", `
  vec4 zone = texture2D( map, vMapUv );
  vec3 soil = texture2D( tSoil, vWPos.xz / 7.6 ).rgb;
  float rp = fract( ( vWPos.x - uX0 ) / 0.76 );
  float dRow = abs( rp - 0.5 ) * 2.0;
  float w = clamp( zone.a, 0.0, 1.0 );
  float fw = fwidth( rp );
  float band = 1.0 - smoothstep( w - fw, w + fw, dRow );
  band = mix( band, w, smoothstep( 0.08, 0.35, fw ) );
  float tp = mod( vWPos.x - uX0 - 18.0, 36.0 ); tp = min( tp, 36.0 - tp );
  band *= 1.0 - uTram * ( 1.0 - smoothstep( 0.22, 0.34, abs( tp - 1.5 ) ) );
  diffuseColor.rgb *= mix( soil, zone.rgb * vec3( 0.78, 0.82, 0.74 ), band * 0.9 );`);
    };
    return m;
  }
  function fieldCanvas(F, cols, rows, tram) {
    const c = document.createElement("canvas"); c.width = cols * 8; c.height = rows * 8;
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.LinearFilter; t.premultiplyAlpha = false;
    const mesh = add(new THREE.PlaneGeometry(F.x1 - F.x0, F.z1 - F.z0).rotateX(-Math.PI / 2), fieldMat(t, F, tram), (F.x0 + F.x1) / 2, 0.06, (F.z0 + F.z1) / 2, world, false);
    return { c, t, mesh, cols, rows };
  }
  const cornGround = fieldCanvas(CORN, 12, 8, true), soyGround = fieldCanvas(SOY, 1, 1, false);
  function paintField(fg, colors, rowSpacingPx, cover) {
    const g = fg.c.getContext("2d"), W = fg.c.width, H = fg.c.height, img = g.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = Math.min(fg.rows - 1, Math.floor(y / H * fg.rows)) * fg.cols + Math.min(fg.cols - 1, Math.floor(x / W * fg.cols)), col = colors[k], o = 4 * (y * W + x);
      img.data[o] = col[0] * 255; img.data[o + 1] = col[1] * 255; img.data[o + 2] = col[2] * 255; img.data[o + 3] = Math.min(1, Math.max(0, cover[k])) * 255;
    }
    g.putImageData(img, 0, 0); fg.t.needsUpdate = true;
  }

  // ---------- corn and soybean plants (instanced) ----------
  // near-field corn: 10 broad, arching, slightly twisted leaves, a branched tassel and an ear (unit height; scaled per plant)
  function denseCornGeo() {
    const parts = [new THREE.CylinderGeometry(0.008, 0.014, 1, 6).translate(0, 0.5, 0)];
    for (let k = 0; k < 10; k++) {
      const len = 0.82 - Math.abs(k - 4) * 0.06, wdt = 0.16;
      const leaf = new THREE.PlaneGeometry(wdt, len, 1, 6), p = leaf.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const v = (p.getY(i) + len / 2) / len, x = p.getX(i) * (1 - 0.75 * v) * (0.6 + 0.4 * Math.sin(Math.PI * Math.min(1, v + 0.15)));
        const rise = 0.11 * Math.sin(Math.PI * 0.7 * v) - 0.13 * v * v * v, twist = 0.5 * v;
        p.setXYZ(i, x * Math.cos(twist), rise + x * Math.sin(twist) * 0.4 - Math.abs(x) * 0.3, v * len);
      }
      leaf.computeVertexNormals();
      leaf.rotateY(k * 2.39996 + (k % 2) * Math.PI).translate(0, 0.14 + k * 0.072, 0);
      parts.push(leaf);
    }
    for (let k = 0; k < 6; k++) { const c = new THREE.CylinderGeometry(0.003, 0.004, 0.16, 3).translate(0, 0.08, 0).rotateZ(0.5 + 0.15 * (k % 2)).rotateY(k * 1.05); c.translate(0, 0.94, 0); parts.push(c); }
    parts.push(new THREE.CylinderGeometry(0.003, 0.006, 0.2, 4).translate(0, 1.0, 0));                     // tassel spike
    parts.push(new THREE.CylinderGeometry(0.02, 0.014, 0.12, 6).rotateZ(0.35).translate(0.025, 0.52, 0));  // ear
    return mergeGeos(parts);
  }
  function cornGeo() {
    const parts = [];
    const stalk = new THREE.CylinderGeometry(0.012, 0.018, 1, 5).translate(0, 0.5, 0); parts.push(stalk);
    for (let k = 0; k < 7; k++) {
      const len = 0.42 - Math.abs(k - 3) * 0.03, wdt = 0.07;
      const leaf = new THREE.PlaneGeometry(wdt, len, 1, 5);
      const p = leaf.attributes.position;
      for (let i = 0; i < p.count; i++) {                          // arch the blade out and down
        const v = (p.getY(i) + len / 2) / len;
        p.setXYZ(i, p.getX(i) * (1 - 0.6 * v), 0.35 * len * Math.sin(Math.PI * 0.8 * v) - 0.12 * v * v, v * len);
      }
      leaf.computeVertexNormals();
      leaf.rotateY(k * 2.4 + (k % 2) * Math.PI).translate(0, 0.18 + k * 0.09, 0);
      parts.push(leaf);
    }
    parts.push(new THREE.ConeGeometry(0.03, 0.12, 5).translate(0, 1.05, 0));        // tassel
    parts.push(new THREE.CylinderGeometry(0.022, 0.016, 0.14, 6).rotateZ(0.5).translate(0.03, 0.5, 0));   // ear
    return mergeGeos(parts);
  }
  function mergeGeos(list) {
    let nv = 0, ni = 0;
    const gs = list.map(g => g.index ? g : g); gs.forEach(g => { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; });
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), idx = new Uint32Array(ni);
    let ov = 0, oi = 0;
    for (const g of gs) {
      pos.set(g.attributes.position.array, ov * 3); nor.set(g.attributes.normal.array, ov * 3);
      if (g.index) { for (let i = 0; i < g.index.count; i++) idx[oi + i] = g.index.array[i] + ov; oi += g.index.count; }
      else { for (let i = 0; i < g.attributes.position.count; i++) idx[oi + i] = i + ov; oi += g.attributes.position.count; }
      ov += g.attributes.position.count;
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute("position", new THREE.BufferAttribute(pos, 3)); out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    out.setIndex(new THREE.BufferAttribute(idx, 1)); return out;
  }
  const plantMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.62, metalness: 0, side: THREE.DoubleSide, normalMap: NM.paint, envMapIntensity: 0.8 });
  const SP = lite ? 6 : 2.5;
  function plantField(F, geo, zoneOf, sx = SP, sz = SP, jit = 1.2) {
    const pts = [];
    for (let x = F.x0 + sx / 2; x < F.x1; x += sx) for (let z = F.z0 + sz / 2; z < F.z1; z += sz)
      pts.push([x + (rnd() - 0.5) * jit * (sx / SP), z + (rnd() - 0.5) * jit, rnd() * 6.28, 0.85 + rnd() * 0.3]);
    const im = new THREE.InstancedMesh(geo, plantMat, pts.length);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    im.setColorAt(0, new THREE.Color()); im.instanceColor.setUsage(THREE.DynamicDrawUsage);
    im.castShadow = false; im.receiveShadow = false;
    world.add(im);
    return { im, pts, zone: pts.map(p => zoneOf(p[0], p[1])) };
  }
  const cornZone = (x, z) => Math.min(11, Math.floor((x - CORN.x0) / (CORN.x1 - CORN.x0) * 12)) + 12 * Math.min(7, Math.floor((z - CORN.z0) / (CORN.z1 - CORN.z0) * 8));
  const cGeo = cornGeo();
  const corn = plantField(CORN, cGeo, cornZone);
  // a patch at real row spacing (30 in = 0.76 m) where the close-up camera looks
  corn.im.receiveShadow = true;
  // tramlines: no plants in the sprayer's wheel tracks (wheels 1.5 m either side of each 36 m pass)
  const onTram = x => { let t = ((x - CORN.x0 - 18) % 36 + 36) % 36; t = Math.min(t, 36 - t); return Math.abs(t - 1.5) < 0.4; };
  corn.pts.forEach(p => { if (onTram(p[0])) p[3] = 0; });
  // dense near-field stand at real spacing (76 cm rows, 18 cm in-row) that follows the camera's target
  const DR = 32, dense = lite ? null : (() => {
    const nRow = Math.ceil(2 * DR / 0.76) + 1, nIn = Math.ceil(2 * DR / 0.18) + 1;
    const im = new THREE.InstancedMesh(denseCornGeo(), plantMat, nRow * nIn);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.setColorAt(0, new THREE.Color()); im.instanceColor.setUsage(THREE.DynamicDrawUsage);
    im.castShadow = true; im.receiveShadow = true; im.count = 0; im.frustumCulled = false; world.add(im);
    return { im, pts: [], zone: [], cx: 1e9, cz: 1e9, on: false };
  })();
  let lastCorn = null;
  function layoutDense(cx, cz) {
    const D = dense; D.pts = []; D.zone = []; D.cx = cx; D.cz = cz;
    const r0 = Math.floor((cx - DR - CORN.x0) / 0.76), z0 = Math.floor((cz - DR - CORN.z0) / 0.18);
    const r = mulberry(1);
    for (let i = 0; i * 0.76 <= 2 * DR; i++) {
      const x = CORN.x0 + 0.38 + (r0 + i) * 0.76; if (x < CORN.x0 + 0.3 || x > CORN.x1 - 0.3 || onTram(x)) continue;
      for (let j = 0; j * 0.18 <= 2 * DR; j++) {
        const zi = z0 + j, z = CORN.z0 + 0.09 + zi * 0.18; if (z < CORN.z0 + 0.2 || z > CORN.z1 - 0.2) continue;
        const h = hash2(r0 + i, zi);
        if (h < 0.04) continue;                                    // a few gaps, as in a real stand
        const edge = Math.min(1, (DR - Math.max(Math.abs(x - cx), Math.abs(z - cz))) / 9); if (hash2(zi + 11, r0 + i + 5) > edge) continue;   // dither out over the last 9 m
        D.pts.push([x + (hash2(zi, r0 + i) - 0.5) * 0.05, z + (h - 0.5) * 0.06, h * 6.283, 0.9 + 0.18 * hash2(zi + 7, r0 + i + 3)]);
        D.zone.push(cornZone(x, z));
      }
    }
    D.im.count = D.pts.length;
  }
  function hash2(a2, b2) { let h = (a2 * 374761393 + b2 * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function mulberry(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
  // show the dense patch when the camera is close to the corn; hide the coarse plants under it
  function followDetail(target, camPos) {
    if (!dense) return;
    const inField = target.x > CORN.x0 - DR && target.x < CORN.x1 + DR && target.z > CORN.z0 - DR && target.z < CORN.z1 + DR;
    const near = camPos.distanceTo(target) < 140;
    const on = inField && near;
    const cx = target.x + 0.5 * (camPos.x - target.x), cz = target.z + 0.5 * (camPos.z - target.z);   // centred between target and camera: covers the foreground
    if (on && (Math.abs(cx - dense.cx) > 6 || Math.abs(cz - dense.cz) > 6 || !dense.on)) { layoutDense(cx, cz); dense.on = true; refreshCorn(); }
    else if (!on && dense.on) { dense.on = false; dense.im.count = 0; refreshCorn(); }
  }
  function refreshCorn() {
    if (!lastCorn) return;
    const [hC, cC] = lastCorn;
    corn.pts.forEach(p => { if (p[3] !== 0) p[4] = dense && dense.on && Math.abs(p[0] - dense.cx) < DR - 7 && Math.abs(p[1] - dense.cz) < DR - 7 ? 1 : 0; });
    setPlants(corn, hC, 1.5, cC);
    if (dense && dense.on) setPlants(dense, hC, 0.46, cC);
  }
  const soy = plantField(SOY, new THREE.IcosahedronGeometry(0.5, 1).translate(0, 0.5, 0), () => 0);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color(), _e = new THREE.Euler();
  function setPlants(F, h, wide, colors) {
    for (let i = 0; i < F.pts.length; i++) {
      const [x, z, r, sc, hide] = F.pts[i], hz = h[F.zone[i]];
      const vis = hz > 0.02 && sc > 0 && !hide;
      _p.set(x, 0, z); _q.setFromEuler(_e.set(0, r, 0));
      _s.set(vis ? wide * sc * (0.4 + 0.6 * Math.min(1, hz / 0.5)) : 0, vis ? hz * sc : 0, vis ? wide * sc * (0.4 + 0.6 * Math.min(1, hz / 0.5)) : 0);
      F.im.setMatrixAt(i, _m.compose(_p, _q, _s));
      const c = colors[F.zone[i]]; F.im.setColorAt(i, _c.setRGB(c[0] * (0.92 + 0.16 * ((i * 7919) % 13) / 13), c[1], c[2], THREE.SRGBColorSpace));
    }
    F.im.instanceMatrix.needsUpdate = true; F.im.instanceColor.needsUpdate = true;
  }

  // ---------- trees ----------
  {
    const spots = [];
    for (let x = -330; x <= 300; x += 12) spots.push([x + (rnd() - 0.5) * 5, 395 + (rnd() - 0.5) * 6]);             // windbreak south of the yard
    for (let z = 120; z <= 390; z += 12) spots.push([-335 + (rnd() - 0.5) * 6, z]);
    for (let i = 0; i < 160; i++) spots.push([-1100 + rnd() * 380, -700 + rnd() * 500]);                             // woodlots
    for (let i = 0; i < 120; i++) spots.push([800 + rnd() * 500, -800 + rnd() * 300]);
    for (let i = 0; i < 140; i++) { const t = rnd(); const s = streamPt(t); spots.push([s[0] + (rnd() - 0.5) * 50, s[1] + (rnd() < 0.5 ? -1 : 1) * (14 + rnd() * 16)]); }
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.42, 1, 8).translate(0, 0.5, 0), std("#5b4532", 0.95, 0, { normalMap: NM.boards }), spots.length);
    const crownGeo = new THREE.IcosahedronGeometry(1, 3);           // lumpy, leafy crown: displaced sphere
    { const p = crownGeo.attributes.position, v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = 0.78 + 0.32 * fbm(0.5 + 0.5 * Math.atan2(v.z, v.x) / Math.PI, 0.5 + 0.5 * v.y, 4, 3) + 0.08 * Math.sin(9 * v.x) * Math.sin(7 * v.z); v.multiplyScalar(n); if (v.y < -0.3) v.y = -0.3 + (v.y + 0.3) * 0.4; p.setXYZ(i, v.x, v.y, v.z); }
      crownGeo.computeVertexNormals(); }
    const crown = new THREE.InstancedMesh(crownGeo, std("#ffffff", 0.9, 0, { normalMap: NM.grass, normalScale: new THREE.Vector2(1.2, 1.2) }), spots.length);
    spots.forEach(([x, z], i) => {
      const h = 9 + rnd() * 9, r = 3 + rnd() * 3;
      trunk.setMatrixAt(i, _m.compose(_p.set(x, 0, z), _q.identity(), _s.set(1, h * 0.55, 1)));
      crown.setMatrixAt(i, _m.compose(_p.set(x, h * 0.6, z), _q.setFromEuler(_e.set(0, rnd() * 6, 0)), _s.set(r, r * (1.1 + rnd() * 0.4), r)));
      crown.setColorAt(i, _c.set(["#3f6a2a", "#4d7a30", "#355e27", "#5a7f35", "#46702c", "#62803a"][i % 6]).multiplyScalar(0.85 + 0.3 * rnd()));
    });
    trunk.castShadow = crown.castShadow = true; world.add(trunk, crown);
  }

  // ---------- stream and lake ----------
  function streamPt(t) {                       // t in 0..1, west to east, returns [x, z]
    const x = -1500 + t * 2800;
    return [x, 100 + 22 * Math.sin(x / 140) + 10 * Math.sin(x / 47) + (x > 800 ? (x - 800) * 0.35 : 0)];
  }
  const waterTex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = "#808080"; g.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { g.strokeStyle = `rgba(255,255,255,${0.05 + rnd() * 0.1})`; g.beginPath(); const x = rnd() * w, y = rnd() * h; g.moveTo(x, y); g.quadraticCurveTo(x + 6, y - 2, x + 14, y); g.stroke(); } }, [8, 8], false);
  const streamMat = po(new THREE.MeshPhysicalMaterial({ color: "#3f5f62", roughness: 0.08, metalness: 0, normalMap: NM.water, normalScale: new THREE.Vector2(0.35, 0.35), clearcoat: 0.6, clearcoatRoughness: 0.1 }), 5);
  {
    const N = 260, pos = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, [x, z] = streamPt(t), [x2, z2] = streamPt(Math.min(1, t + 0.001));
      const dx = x2 - x, dz = z2 - z, L = Math.hypot(dx, dz) || 1, nx = -dz / L, nz = dx / L, w = 5 + 4 * t;
      pos.push(x + nx * w, 0.22, z + nz * w, x - nx * w, 0.22, z - nz * w);
      if (i < N) { const a = 2 * i; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const uv = []; for (let i = 0; i <= N; i++) uv.push(i / 6, 0, i / 6, 1); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    add(g, streamMat, 0, 0, 0, world, false);
    // grassy buffer strip along the banks
    const bpos = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, [x, z] = streamPt(t), [x2, z2] = streamPt(Math.min(1, t + 0.001));
      const dx = x2 - x, dz = z2 - z, L = Math.hypot(dx, dz) || 1, nx = -dz / L, nz = dx / L, w = 22;
      bpos.push(x + nx * w, 0.07, z + nz * w, x - nx * w, 0.07, z - nz * w);
    }
    const bg = new THREE.BufferGeometry(); bg.setAttribute("position", new THREE.Float32BufferAttribute(bpos, 3)); bg.setIndex(idx); bg.computeVertexNormals();
    add(bg, po(std("#56783a", 0.95, 0, { normalMap: NM.grass }), 4), 0, -0.01, 0, world, false);
  }
  const lakeMat = po(new THREE.MeshPhysicalMaterial({ color: "#2f5b73", roughness: 0.06, metalness: 0, normalMap: NM.water, normalScale: new THREE.Vector2(0.25, 0.25), clearcoat: 0.8, clearcoatRoughness: 0.08 }), 6);
  const lakeMesh = add(new THREE.CircleGeometry(1, 96).rotateX(-Math.PI / 2), lakeMat, LAKE.x, 0.3, LAKE.z, world, false);
  lakeMesh.scale.set(LAKE.rx, 1, LAKE.rz);
  add(new THREE.CircleGeometry(1, 96).rotateX(-Math.PI / 2), po(std("#c8b98e", 0.95, 0, { normalMap: NM.soil }), 3), LAKE.x, 0.06, LAKE.z, world, false).scale.set(LAKE.rx + 10, 1, LAKE.rz + 10);
  // algae scum patches (opacity follows the lake's trophic state)
  const scumAlpha = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = "#000"; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 40; k++) {
      const x = w / 2 + (rnd() - 0.5) * w * 0.5, y = h / 2 + (rnd() - 0.5) * h * 0.5, r = 8 + rnd() * 26;
      const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, "rgba(255,255,255,0.5)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }
  }, [1, 1], false);
  const scumMat = po(new THREE.MeshStandardMaterial({ color: "#5f8f2a", roughness: 0.9, transparent: true, opacity: 0, depthWrite: false, alphaMap: scumAlpha }), 7);
  for (let i = 0; i < 28; i++) {
    const a = rnd() * 6.28, r = 0.1 + 0.5 * rnd();
    const m = add(new THREE.PlaneGeometry(90 + rnd() * 80, 90 + rnd() * 80).rotateX(-Math.PI / 2), scumMat, LAKE.x + Math.cos(a) * r * LAKE.rx, 0.42, LAKE.z + Math.sin(a) * r * LAKE.rz, world, false);
    m.rotation.y = rnd() * 3;
  }
  // small dock and boat on the lake
  add(box(3, 0.4, 30), std("#8b6b4a", 0.8), LAKE.x - 300, 0.6, LAKE.z - 40);
  add(box(2.2, 0.9, 5), std("#d8dde2", 0.4), LAKE.x - 250, 0.4, LAKE.z - 10);
  // tile-drain outlet from the corn field to the stream
  add(new THREE.CylinderGeometry(0.4, 0.4, 3, 12).rotateX(Math.PI / 2), std("#2f3235", 0.5), 380, 0.3, 82);

  // ---------- farmstead ----------
  const boardsN = NM.boards.clone(); boardsN.repeat.set(6, 1); boardsN.needsUpdate = true;
  const red = std("#962820", 0.78, 0, { normalMap: boardsN, normalScale: new THREE.Vector2(0.7, 0.7) }), white = std("#eceae4", 0.7, 0, { normalMap: NM.paint }),
    roofGray = std("#6a7076", 1, 0.65, { normalMap: NM.corrRoof, normalScale: new THREE.Vector2(0.9, 0.9), roughnessMap: RM.brushed }),
    steel = std("#cdd2d6", 1, 0.9, { roughnessMap: RM.brushed, normalMap: NM.paint }),
    concrete = std("#bdb8ad", 1, 0, { normalMap: NM.concrete, normalScale: new THREE.Vector2(0.5, 0.5), roughnessMap: RM.concrete }), darkSteel = std("#4f565d", 0.45, 0.7), green = std("#5d7a5b", 0.7), curtain = std("#d9dfe2", 0.85, 0, { transparent: true, opacity: 0.85 });
  function gable(w, d, h, mat) {   // roof prism spanning x = w, along z = d
    const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(0, h); s.lineTo(w / 2, 0); s.lineTo(-w / 2, 0);
    return new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2), mat);
  }
  // free-stall dairy barn (long, low, curtain sides)
  const barn = new THREE.Group(); barn.position.set(10, 0, 210); world.add(barn);
  add(box(120, 4.2, 34), curtain, 0, 2.1, 0, barn);
  add(box(120, 1.0, 34.2), white, 0, 0.5, 0, barn);
  for (let x = -60; x <= 60; x += 10) for (const z of [-17, 17]) add(box(0.5, 4.4, 0.5), white, x, 2.2, z, barn);
  { const r = gable(36, 122, 7, roofGray); r.rotation.y = Math.PI / 2; r.position.y = 4.2; r.castShadow = true; barn.add(r); }
  add(box(122, 0.6, 2.4), darkSteel, 0, 11.3, 0, barn);                  // ridge vent
  for (const x of [-61, 61]) add(box(0.6, 4.2, 34), white, x, 2.1, 0, barn);
  // classic red gambrel barn
  const old = new THREE.Group(); old.position.set(-120, 0, 205); world.add(old);
  add(box(18, 8, 34), red, 0, 4, 0, old);
  {
    const s = new THREE.Shape(); s.moveTo(-9.6, 0); s.lineTo(-7.5, 4.5); s.lineTo(0, 8); s.lineTo(7.5, 4.5); s.lineTo(9.6, 0); s.lineTo(-9.6, 0);
    const r = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 35, bevelEnabled: false }).translate(0, 0, -17.5), roofGray); r.position.y = 8; r.castShadow = true; old.add(r);
    const gs = new THREE.Shape(); gs.moveTo(-9, 0); gs.lineTo(-7, 4.2); gs.lineTo(0, 7.6); gs.lineTo(7, 4.2); gs.lineTo(9, 0);
    for (const z of [-17.05, 17.05]) { const e = new THREE.Mesh(new THREE.ShapeGeometry(gs), red); e.position.set(0, 8, z); if (z < 0) e.rotation.y = Math.PI; old.add(e); }
  }
  for (const z of [-17.1, 17.1]) { add(box(6, 6, 0.3), white, 0, 3, z, old); add(box(5.2, 5.2, 0.32), red, 0, 3, z, old); }
  // concrete stave silos
  for (const [x, z, h] of [[-95, 175, 24], [-84, 175, 21]]) {
    add(new THREE.CylinderGeometry(3.6, 3.6, h, 28), concrete, x, h / 2, z);
    add(new THREE.SphereGeometry(3.7, 24, 10, 0, 6.29, 0, Math.PI / 2), steel, x, h, z);
    for (let y = 2; y < h; y += 1.6) add(new THREE.TorusGeometry(3.62, 0.05, 4, 28).rotateX(Math.PI / 2), darkSteel, x, y, z, world, false);
  }
  // grain bins, dryer tower and bucket elevator
  const bins = new THREE.Group(); bins.position.set(-215, 0, 150); world.add(bins);
  const binTex = canvasTex(64, 64, (g, w, h) => { g.fillStyle = "#c9ced2"; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 4) { g.fillStyle = "rgba(0,0,0,0.13)"; g.fillRect(0, y, w, 1.6); } }, [16, 10]);
  const binRib = NM.binRib.clone(); binRib.repeat.set(1, 5); binRib.needsUpdate = true;
  const binMat = std("#c9ced2", 0.3, 0.85, { normalMap: binRib, normalScale: new THREE.Vector2(0.6, 0.6), roughnessMap: RM.brushed });
  const binPos = [[-22, 0, 9], [0, 0, 10], [22, 0, 9], [0, 26, 7.5]];
  for (const [x, z, r] of binPos) {
    const h = r * 1.5;
    add(new THREE.CylinderGeometry(r, r, h, 36), binMat, x, h / 2, z, bins);
    add(new THREE.ConeGeometry(r * 1.03, r * 0.55, 36), steel, x, h + r * 0.27, z, bins);
    add(new THREE.CylinderGeometry(0.8, 0.8, 0.8, 12), steel, x, h + r * 0.55 + 0.3, z, bins);
  }
  const dryer = new THREE.Group(); dryer.position.set(28, 0, 30); bins.add(dryer);
  add(box(4, 20, 4), steel, 0, 10, 0, dryer);
  add(box(4.4, 3, 4.4), std("#d0a03a", 0.5, 0.3), 0, 1.5, 0, dryer);           // burner / fan housing
  add(new THREE.CylinderGeometry(1.3, 1.3, 1.2, 20).rotateZ(Math.PI / 2), darkSteel, -2.6, 2, 0, dryer);
  add(box(1.6, 38, 1.6), steel, -10, 19, 22, bins);                               // bucket elevator leg
  add(box(3, 2, 3), steel, -10, 38.5, 22, bins);
  for (const [x, z, r] of binPos) {
    const a = new THREE.Vector3(-10, 37, 22), b = new THREE.Vector3(x, r * 1.5 + r * 0.55 + 0.5, z);
    const d = b.clone().sub(a); const t = add(new THREE.CylinderGeometry(0.25, 0.25, d.length(), 8), steel, 0, 0, 0, bins);
    t.position.copy(a).add(b).multiplyScalar(0.5); t.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  }
  const dryerHeat = add(new THREE.SphereGeometry(1.2, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffb04a").multiplyScalar(25), transparent: true, opacity: 0 }), 0, 1.6, 2.4, dryer, false);
  // farmhouse and machine shed
  const house = new THREE.Group(); house.position.set(-245, 0, 300); world.add(house);
  add(box(14, 7, 10), white, 0, 3.5, 0, house);
  { const r = gable(15, 11, 4.5, std("#3e4247", 0.6)); r.position.y = 7; r.rotation.y = Math.PI / 2; r.castShadow = true; house.add(r); }
  add(box(15, 6, 34), std("#8a9096", 0.5, 0.6), -180, 3, 300);
  { const r = gable(16, 35, 3, roofGray); r.position.set(-180, 6, 300); r.castShadow = true; world.add(r); }
  // cows in the exercise lot (Holsteins: white body with black patches)
  {
    const nCow = lite ? 18 : 36;
    const body = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.42, 1.2, 4, 8).rotateZ(Math.PI / 2), std("#f2f0ea", 0.8), nCow);
    const patch = new THREE.InstancedMesh(new THREE.SphereGeometry(0.36, 10, 8), std("#1d1d1d", 0.8), nCow * 2);
    const head = new THREE.InstancedMesh(box(0.45, 0.45, 0.32), std("#202020", 0.8), nCow);
    const legs = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.07, 0.8, 5), std("#e9e5dc", 0.8), nCow * 4);
    for (let i = 0; i < nCow; i++) {
      const x = -45 + rnd() * 90, z = 240 + rnd() * 28, r = rnd() * 6.28;
      const base = new THREE.Matrix4().compose(_p.set(x, 0, z), _q.setFromEuler(_e.set(0, r, 0)), _s.set(1, 1, 1));
      const put = (im, k, lx, ly, lz, sx = 1, sy = 1, sz = 1) => im.setMatrixAt(k, new THREE.Matrix4().multiplyMatrices(base, new THREE.Matrix4().compose(_p.set(lx, ly, lz), _q.identity(), _s.set(sx, sy, sz))));
      put(body, i, 0, 1.2, 0);
      put(patch, 2 * i, 0.2, 1.35, 0.22, 1.2, 0.8, 0.6); put(patch, 2 * i + 1, -0.4, 1.3, -0.2, 1, 0.9, 0.7);
      put(head, i, 1.05, 1.35, 0);
      put(legs, 4 * i, 0.5, 0.4, 0.22); put(legs, 4 * i + 1, 0.5, 0.4, -0.22); put(legs, 4 * i + 2, -0.5, 0.4, 0.22); put(legs, 4 * i + 3, -0.5, 0.4, -0.22);
    }
    [body, patch, head, legs].forEach(m => { m.castShadow = true; world.add(m); });
    // fence around the lot
    for (let x = -50; x <= 50; x += 4) for (const z of [236, 272]) add(box(0.15, 1.3, 0.15), std("#6c5a46", 0.9), x, 0.65, z, world, false);
    for (const z of [236, 272]) for (const y of [0.7, 1.15]) add(box(100, 0.08, 0.08), std("#6c5a46", 0.9), 0, y, z, world, false);
  }
  // manure storage: earthen basin with liquid manure
  const store = new THREE.Group(); store.position.set(150, 0, 300); world.add(store);
  {
    const s = new THREE.Shape(); s.moveTo(-40, -26); s.lineTo(40, -26); s.lineTo(40, 26); s.lineTo(-40, 26); s.lineTo(-40, -26);
    const hole = new THREE.Path(); hole.moveTo(-34, -20); hole.lineTo(-34, 20); hole.lineTo(34, 20); hole.lineTo(34, -20); hole.lineTo(-34, -20); s.holes.push(hole);
    add(new THREE.ExtrudeGeometry(s, { depth: 2, bevelEnabled: true, bevelThickness: 0.8, bevelSize: 3, bevelSegments: 2 }).rotateX(-Math.PI / 2), std("#6f8a46", 0.95), 0, 0, 0, store);
    add(new THREE.PlaneGeometry(70, 42).rotateX(-Math.PI / 2), std("#4a3a26", 0.35, 0.05, { bumpMap: waterTex, bumpScale: 0.4 }), 0, 1.2, 0, store, false);
  }
  // anaerobic digester: two concrete tanks with gas-holding membrane domes, engine-generator, flare
  const digester = new THREE.Group(); digester.position.set(70, 0, 320); world.add(digester);
  for (const x of [-16, 16]) {
    add(new THREE.CylinderGeometry(12, 12, 6, 40), concrete, x, 3, 0, digester);
    add(new THREE.SphereGeometry(12, 32, 12, 0, 6.29, 0, Math.PI / 2).scale(1, 0.55, 1), std("#7f9a86", 0.6), x, 6, 0, digester);
  }
  add(box(12, 3, 3), green, 0, 1.5, 18, digester);                                 // engine-generator container
  add(new THREE.CylinderGeometry(0.3, 0.3, 6, 10), darkSteel, 4, 6, 18, digester);   // exhaust
  add(new THREE.CylinderGeometry(0.25, 0.25, 8, 10), darkSteel, 30, 4, 14, digester); // flare stack
  const flame = add(new THREE.ConeGeometry(0.5, 2, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffa733").multiplyScalar(30), transparent: true, opacity: 0.85, toneMapped: true }), 30, 9, 14, digester, false);
  for (const x of [-16, 16]) { const p = add(new THREE.CylinderGeometry(0.3, 0.3, 30, 8).rotateZ(Math.PI / 2), darkSteel, 0, 2, 10, digester); p.position.x = x / 2; }
  add(new THREE.CylinderGeometry(0.35, 0.35, 70, 8).rotateZ(Math.PI / 2).rotateY(0.4), darkSteel, 50, 1, -12, digester);   // pipe from the barn

  // ---------- center pivot over the corn field ----------
  const pivot = new THREE.Group(); pivot.position.set(PIVOT.x, 0, PIVOT.z); world.add(pivot);
  add(new THREE.CylinderGeometry(0.6, 1.0, 5, 10), steel, 0, 2.5, 0, pivot);
  const arm = new THREE.Group(); arm.position.y = 4.4; pivot.add(arm);
  const galv = std("#b7bdc1", 0.4, 0.85);
  add(new THREE.CylinderGeometry(0.22, 0.22, PIVOT.r, 10).rotateZ(Math.PI / 2), galv, PIVOT.r / 2, 0, 0, arm);
  for (let x = 48; x <= PIVOT.r; x += 47) {
    for (const s of [-1, 1]) { const l = add(new THREE.CylinderGeometry(0.1, 0.1, 4.8, 6), galv, x, -2.3, s * 1.5, arm); l.rotation.x = s * 0.33; }
    for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.75, 0.75, 0.5, 14).rotateX(Math.PI / 2), std("#26282b", 0.9), x, -3.65, s * 2.4, arm);
    for (let k = 0; k < 6; k++) add(new THREE.CylinderGeometry(0.04, 0.04, 2.0, 4), galv, x - 8 - k * 6.5, -1.0, 0, arm, false);
  }
  const sprayPts = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: "#d6ecff", size: 0.6, transparent: true, opacity: 0.7, depthWrite: false }));
  {
    const n = 1400, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { p[3 * i] = 10 + rnd() * (PIVOT.r - 10); p[3 * i + 1] = -rnd() * 3.5; p[3 * i + 2] = (rnd() - 0.5) * 4; }
    sprayPts.geometry.setAttribute("position", new THREE.BufferAttribute(p, 3));
  }
  arm.add(sprayPts);

  // ---------- autonomous tractor with sprayer boom ----------
  // self-propelled high-clearance sprayer (generic, unbranded): red body, glass cab, tall narrow row-crop tyres
  // on a 3.0 m track (they run in the tramlines), 36 m boom with nozzles every 50 cm and flat-fan sprays
  const tractor = new THREE.Group(); world.add(tractor);
  const sprayFans = new THREE.Group();
  {
    const rb = (x, y, z, r = 0.1) => new RoundedBoxGeometry(x, y, z, 3, r);
    const paint = new THREE.MeshPhysicalMaterial({ color: "#b5121b", roughness: 0.32, metalness: 0.1, clearcoat: 0.9, clearcoatRoughness: 0.1 });
    const blackP = std("#1c1e21", 0.55, 0.3), frame = std("#2a2d31", 0.5, 0.6), chrome = std("#d8dcdf", 0.2, 1.0);
    const tireN = NM.tread.clone(); tireN.repeat.set(14, 1); tireN.needsUpdate = true;
    const tire = std("#17181a", 0.9, 0, { normalMap: tireN, normalScale: new THREE.Vector2(1.8, 1.8) }), hub = std("#8f969c", 0.35, 0.85);
    const glass = new THREE.MeshPhysicalMaterial({ color: "#20303a", roughness: 0.03, metalness: 0, transparent: true, opacity: 0.32, clearcoat: 1, envMapIntensity: 1.5, depthWrite: false });
    const Y = 1.9;                                                   // underside of the main frame: high crop clearance
    add(rb(0.9, 0.45, 6.6, 0.06), frame, 0, Y + 0.2, 0, tractor);    // main frame rail
    add(rb(2.2, 1.05, 2.3, 0.22), paint, 0, Y + 0.95, 2.35, tractor);   // engine hood (front)
    add(rb(2.0, 0.08, 0.5, 0.04), blackP, 0, Y + 0.72, 3.52, tractor);  // grille
    for (const s2 of [-1, 1]) add(rb(0.34, 0.12, 0.06, 0.03), new THREE.MeshBasicMaterial({ color: new THREE.Color("#fff4d6").multiplyScalar(1.4) }), s2 * 0.75, Y + 1.15, 3.52, tractor, false);
    add(rb(2.0, 0.3, 2.0, 0.08), paint, 0, Y + 0.6, 0.4, tractor);      // cab base
    // cab: posts, glass, roof, seat, steering wheel, joystick armrest
    for (const [x, z] of [[-0.9, 1.35], [0.9, 1.35], [-0.9, -0.55], [0.9, -0.55]]) add(new THREE.CylinderGeometry(0.045, 0.045, 1.65, 8), blackP, x, Y + 1.58, z, tractor);
    add(rb(1.84, 1.6, 1.94, 0.05), glass, 0, Y + 1.56, 0.4, tractor, false);
    add(rb(2.1, 0.18, 2.2, 0.08), paint, 0, Y + 2.46, 0.4, tractor);
    add(rb(0.55, 0.12, 0.5, 0.05), std("#2b2b2b", 0.8), 0, Y + 1.05, 0.15, tractor);         // seat cushion
    add(rb(0.55, 0.7, 0.12, 0.05), std("#2b2b2b", 0.8), 0, Y + 1.38, -0.12, tractor);        // seat back
    add(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 8).rotateX(-0.6), blackP, 0, Y + 1.15, 0.85, tractor);   // steering column
    add(new THREE.TorusGeometry(0.19, 0.022, 8, 24).rotateX(Math.PI / 2 - 0.6), blackP, 0, Y + 1.35, 0.98, tractor);   // steering wheel
    add(rb(0.12, 0.25, 0.5, 0.04), blackP, 0.38, Y + 1.1, 0.25, tractor);                     // armrest with joystick
    add(rb(0.3, 0.2, 0.05, 0.02), std("#0d1b2a", 0.2, 0.2, { emissive: new THREE.Color("#2a6fb0"), emissiveIntensity: 0.6 }), 0.55, Y + 1.5, 1.1, tractor, false);   // guidance display
    for (const s2 of [-1, 1]) { add(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6).rotateZ(Math.PI / 2), blackP, s2 * 1.18, Y + 1.9, 1.3, tractor); add(rb(0.08, 0.3, 0.2, 0.03), blackP, s2 * 1.45, Y + 1.9, 1.3, tractor); }   // mirrors
    add(new THREE.CylinderGeometry(0.08, 0.1, 1.2, 10), chrome, 0.85, Y + 1.9, 2.9, tractor);     // exhaust stack
    for (let k = 0; k < 5; k++) add(rb(0.5, 0.04, 0.24, 0.02), frame, -1.25, 0.5 + k * 0.42, 0.9, tractor);   // ladder to the cab
    for (const y of [0.5, 2.3]) add(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 6), frame, -1.5, y / 2 + 0.6, 0.9, tractor, false);
    // GPS receiver dome on the roof, camera/sensor domes on the boom
    add(new THREE.CylinderGeometry(0.2, 0.22, 0.1, 20), std("#e8e8e4", 0.4), 0, Y + 2.62, 0.4, tractor);
    add(new THREE.SphereGeometry(0.2, 20, 10, 0, 6.29, 0, Math.PI / 2), std("#f2f2ee", 0.35), 0, Y + 2.66, 0.4, tractor);
    add(rb(1.4, 0.08, 0.12, 0.03), std("#f0b323", 0.4, 0.3, { emissive: new THREE.Color("#f0b323"), emissiveIntensity: 0.3 }), 0, Y + 2.6, 1.42, tractor, false);   // light bar
    // product tank in a red cradle behind the cab
    add(new THREE.CylinderGeometry(1.0, 1.0, 2.6, 36).rotateX(Math.PI / 2).scale(1, 0.85, 1), std("#e9e7e0", 0.3, 0, { normalMap: NM.paint }), 0, Y + 1.15, -2.0, tractor);
    add(new THREE.CylinderGeometry(0.22, 0.22, 0.12, 16), blackP, 0, Y + 2.0, -1.6, tractor);
    for (const z of [-3.1, -0.9]) add(rb(2.1, 0.5, 0.2, 0.05), paint, 0, Y + 0.6, z, tractor);
    // legs and tall, narrow row-crop tyres (380/90R46: ~1.9 m diameter, 0.38 m wide)
    for (const s2 of [-1, 1]) for (const z of [2.3, -2.6]) {
      add(rb(0.22, 1.2, 0.3, 0.05), frame, s2 * 1.5, Y - 0.1, z, tractor);
      add(rb(1.4, 0.2, 0.3, 0.05), frame, s2 * 0.85, Y + 0.25, z, tractor);
      add(new THREE.CylinderGeometry(0.95, 0.95, 0.38, 40).rotateZ(Math.PI / 2), tire, s2 * 1.5, 0.95, z, tractor);
      add(new THREE.CylinderGeometry(0.62, 0.62, 0.4, 24).rotateZ(Math.PI / 2), hub, s2 * 1.5, 0.95, z, tractor, false);
      for (let k = 0; k < 10; k++) { const a2 = k * Math.PI / 5; add(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 6).rotateZ(Math.PI / 2), frame, s2 * 1.72, 0.95 + 0.4 * Math.sin(a2), z + 0.4 * Math.cos(a2), tractor, false); }
      add(rb(0.5, 0.06, 1.6, 0.03), paint, s2 * 1.5, 2.0, z, tractor);    // fender
    }
    // 36 m boom: centre section, folding truss wings, breakaway tips, 50 cm nozzle spacing
    add(rb(3.2, 0.5, 0.4, 0.06), paint, 0, 1.7, -3.9, tractor);
    for (const s2 of [-1, 1]) {
      for (const y of [1.25, 1.95]) add(rb(16.4, 0.08, 0.08, 0.02), frame, s2 * 9.8, y, -3.95, tractor);
      for (let x = 1.8; x < 18; x += 1.6) { const d = add(new THREE.CylinderGeometry(0.025, 0.025, 0.85, 4), frame, s2 * x, 1.6, -3.95, tractor, false); d.rotation.z = (Math.round(x / 1.6) % 2 ? 0.75 : -0.75); }
    }
    const nozzle = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.025, 0.012, 0.12, 6), std("#e04b1f", 0.5), 72);
    const fanGeo = new THREE.ConeGeometry(0.42, 0.95, 16, 1, true).scale(1, 1, 0.12).translate(0, -0.55, 0);
    const fanMat = new THREE.MeshBasicMaterial({ color: "#f4f9ff", transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide });
    const fans = new THREE.InstancedMesh(fanGeo, fanMat, 72);
    for (let i = 0; i < 72; i++) { const x = -17.75 + i * 0.5; nozzle.setMatrixAt(i, _m.compose(_p.set(x, 1.12, -3.95), _q.identity(), _s.set(1, 1, 1))); fans.setMatrixAt(i, _m.compose(_p.set(x, 1.08, -3.95), _q.identity(), _s.set(1, 1, 1))); }
    tractor.add(nozzle); sprayFans.add(fans); tractor.add(sprayFans);
    for (const x of [-12, -6, 6, 12]) add(new THREE.SphereGeometry(0.12, 14, 8), std("#1b1d20", 0.15, 0.4), x, 2.08, -3.8, tractor);   // camera sensors on the boom
  }
  const boomSpray = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: "#eaf5ff", size: 0.35, transparent: true, opacity: 0.6, depthWrite: false }));
  { const n = 600, p = new Float32Array(n * 3); for (let i = 0; i < n; i++) { p[3 * i] = (rnd() - 0.5) * 36; p[3 * i + 1] = 0.25 + rnd() * 0.8; p[3 * i + 2] = -3.95 + (rnd() - 0.5) * 0.5; } boomSpray.geometry.setAttribute("position", new THREE.BufferAttribute(p, 3)); }
  tractor.add(boomSpray);
  // GPS guidance lines (passes 36 m apart)
  const gpsLines = new THREE.Group(); world.add(gpsLines);
  for (let x = CORN.x0 + 18; x < CORN.x1; x += 36) {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, 3.2, CORN.z0 + 10), new THREE.Vector3(x, 3.2, CORN.z1 - 10)]);
    gpsLines.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: "#7fd3ff", transparent: true, opacity: 0.55 })));
  }
  gpsLines.visible = false;

  // ---------- drone ----------
  const drone = new THREE.Group(); world.add(drone);
  const rotors = [];
  {
    const dm = std("#2c3136", 0.4, 0.4);
    add(box(0.5, 0.18, 0.5), dm, 0, 0, 0, drone);
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + k * Math.PI / 2;
      const armm = add(box(0.9, 0.05, 0.08), dm, Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4, drone); armm.rotation.y = -a;
      const r = add(new THREE.CylinderGeometry(0.32, 0.32, 0.02, 16), new THREE.MeshStandardMaterial({ color: "#9aa3aa", transparent: true, opacity: 0.45 }), Math.cos(a) * 0.8, 0.08, Math.sin(a) * 0.8, drone, false);
      rotors.push(r);
    }
    add(new THREE.SphereGeometry(0.1, 10, 8), std("#111", 0.2), 0, -0.15, 0.15, drone);
    drone.scale.setScalar(4);    // drawn larger than life so it reads at farm scale
  }
  const droneCone = add(new THREE.ConeGeometry(28, 50, 4, 1, true), new THREE.MeshBasicMaterial({ color: "#9be15d", transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }), 0, 0, 0, world, false);
  droneCone.visible = false;

  // ---------- field sensors and weather station ----------
  const probes = [[200, -100], [520, -330], [600, -40], [-350, -200]];
  for (const [x, z] of probes) {
    add(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), darkSteel, x, 1.1, z);
    add(box(0.8, 0.04, 0.6), std("#1d2a44", 0.3, 0.3), x, 2.2, z).rotation.x = -0.5;     // small solar panel
    add(box(0.3, 0.4, 0.2), white, x, 1.4, z);
  }
  const ws = new THREE.Group(); ws.position.set(-40, 0, 130); world.add(ws);
  add(new THREE.CylinderGeometry(0.07, 0.07, 6, 8), galv, 0, 3, 0, ws);
  for (let k = 0; k < 3; k++) { const a = k * 2.09; add(new THREE.SphereGeometry(0.12, 8, 6), white, Math.cos(a) * 0.4, 6.1, Math.sin(a) * 0.4, ws); }
  add(new THREE.CylinderGeometry(0.18, 0.22, 0.6, 10), white, 0, 4.2, 0.3, ws);

  // ---------- equipment details: ladders, rails, flanges, bolts, supports ----------
  const railMat = std("#d9b43a", 0.5, 0.4);                       // safety-yellow handrails
  const tube = (r, a, b, mat, parent = world) => {
    const d = b.clone().sub(a), m = add(new THREE.CylinderGeometry(r, r, d.length(), 8), mat, 0, 0, 0, parent, false);
    m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return m;
  };
  function ladder(parent, x, z, y0, y1, face, cage = false) {     // face: outward angle (rad); rails 0.45 m apart, rungs every 0.3 m
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = face; parent.add(g);
    for (const s2 of [-0.225, 0.225]) add(new THREE.CylinderGeometry(0.025, 0.025, y1 - y0, 6), darkSteel, s2, (y0 + y1) / 2, 0, g, false);
    const n = Math.floor((y1 - y0) / 0.3), rung = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.016, 0.016, 0.45, 5).rotateZ(Math.PI / 2), darkSteel, n);
    for (let i = 0; i < n; i++) rung.setMatrixAt(i, _m.compose(_p.set(0, y0 + 0.3 * (i + 0.5), 0), _q.identity(), _s.set(1, 1, 1)));
    g.add(rung);
    if (cage) for (let y = y0 + 2.4; y < y1; y += 0.9) add(new THREE.TorusGeometry(0.38, 0.018, 4, 16, Math.PI).rotateX(Math.PI / 2), darkSteel, 0, y, 0.02, g, false);
    return g;
  }
  function ringRail(parent, x, y, z, r, mat = railMat) {             // top handrail with posts
    add(new THREE.TorusGeometry(r, 0.03, 6, 48).rotateX(Math.PI / 2), mat, x, y + 1.05, z, parent, false);
    add(new THREE.TorusGeometry(r, 0.02, 6, 48).rotateX(Math.PI / 2), mat, x, y + 0.55, z, parent, false);
    const n = Math.max(8, Math.round(2 * Math.PI * r / 1.8)), post = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.025, 0.025, 1.05, 5).translate(0, 0.525, 0), mat, n);
    for (let i = 0; i < n; i++) { const a2 = i / n * 2 * Math.PI; post.setMatrixAt(i, _m.compose(_p.set(x + r * Math.cos(a2), y, z + r * Math.sin(a2)), _q.identity(), _s.set(1, 1, 1))); }
    parent.add(post);
  }
  function flange(parent, a, dir, r) {                               // pipe flange with a bolt circle
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    const f = add(new THREE.CylinderGeometry(r * 1.9, r * 1.9, 0.08, 20), darkSteel, 0, 0, 0, parent, false); f.position.copy(a); f.quaternion.copy(q);
    const bolts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 6), std("#8a9096", 0.4, 0.8), 8);
    for (let i = 0; i < 8; i++) { const a2 = i * Math.PI / 4, off = new THREE.Vector3(r * 1.55 * Math.cos(a2), 0, r * 1.55 * Math.sin(a2)).applyQuaternion(q); bolts.setMatrixAt(i, _m.compose(_p.copy(a).add(off), q, _s.set(1, 1, 1))); }
    parent.add(bolts);
  }
  // grain bins: side ladders, roof rail at the peak, aeration fans, stiffener bands
  for (const [x, z, r] of binPos) {
    const h = r * 1.5;
    ladder(bins, x + r + 0.12, z, 0.3, h, Math.PI / 2, true);
    ringRail(bins, x, h + r * 0.55 - 0.1, z, 1.2);
    add(new THREE.CylinderGeometry(0.6, 0.6, 0.9, 16).rotateZ(Math.PI / 2), std("#9aa2a8", 0.4, 0.8), x - r - 0.45, 0.9, z, bins);   // aeration fan
    add(new THREE.TorusGeometry(0.62, 0.05, 6, 16).rotateY(Math.PI / 2), darkSteel, x - r - 0.9, 0.9, z, bins, false);
    for (const y of [0.15, h * 0.33, h * 0.66]) add(new THREE.TorusGeometry(r + 0.03, 0.05, 4, 40).rotateX(Math.PI / 2), darkSteel, x, y, z, bins, false);
  }
  // dryer tower: platform with rails and a ladder
  add(rb2(5.2, 0.12, 5.2), darkSteel, 0, 20.1, 0, dryer);
  ringRail(dryer, 0, 20.15, 0, 3.0);
  ladder(dryer, 2.2, 0, 3.0, 20.1, Math.PI / 2, true);
  // concrete silos: caged ladders and chute
  for (const [x, z, h] of [[-95, 175, 24], [-84, 175, 21]]) { ladder(world, x, z + 3.75, 0.4, h, 0, true); }
  // digester: top rail on each tank, flanged gas pipes on supports
  for (const x of [-16, 16]) {
    ringRail(digester, x, 6, 0, 12.2);
    ladder(digester, x, 12.15, 0.2, 6, 0);
  }
  for (const x of [-8, 8]) { const a2 = new THREE.Vector3(x - 1, 2, 10), b2 = new THREE.Vector3(x + 1, 2, 10); flange(digester, a2, new THREE.Vector3(1, 0, 0), 0.3); flange(digester, b2, new THREE.Vector3(1, 0, 0), 0.3); }
  for (let x = -14; x <= 14; x += 4) { add(rb2(0.15, 1.7, 0.15), darkSteel, x, 0.85, 10, digester); add(rb2(0.6, 0.1, 0.15), darkSteel, x, 1.7, 10, digester); }
  // people: farm staff, women and men in the same work clothes and hi-vis vests, realistic proportions (Part W)
  // o: { w: woman's build, h: height in m, skin, hair colour, style: "short" | "pony" | "bun", cap colour }
  function person(x, z, ry, shirt = "#2f4a6e", vest = "#e7e246", pose = 0, o = {}) {
    const { w = false, h = 1.75, skin: skinC = "#c8946d", hair = "#2b1d14", style = "short", cap = "#7a2a24" } = o;
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; g.scale.setScalar(h / 1.75); world.add(g);
    const skin = new THREE.MeshPhysicalMaterial({ color: skinC, roughness: 0.55, sheen: 0.4, sheenRoughness: 0.6, sheenColor: new THREE.Color(skinC).lerp(new THREE.Color("#f0b090"), 0.4) });
    const denim = new THREE.MeshPhysicalMaterial({ color: "#2b3a52", roughness: 0.85, sheen: 0.5, sheenColor: new THREE.Color("#55688a") });
    const cloth = new THREE.MeshPhysicalMaterial({ color: shirt, roughness: 0.8, sheen: 0.5, sheenColor: new THREE.Color(shirt).multiplyScalar(1.4) });
    const hairM = std(hair, 0.75), hiVis = std(vest, 0.6), boot = std("#3a2a1c", 0.7);
    const sh = w ? 0.225 : 0.25, hip = w ? 0.105 : 0.1, tx = w ? 1.0 : 1.1;   // shoulder half-width, leg spacing, torso width
    for (const s2 of [-1, 1]) {
      const leg = add(new THREE.CapsuleGeometry(w ? 0.072 : 0.075, 0.72, 4, 10), denim, s2 * hip, 0.48, 0, g); leg.rotation.x = s2 * pose * 0.25;
      add(rb2(0.11, 0.09, 0.26), boot, s2 * hip, 0.05, 0.05, g);
      const arm = add(new THREE.CapsuleGeometry(w ? 0.046 : 0.05, 0.53, 4, 8), cloth, s2 * sh, 1.17, 0, g); arm.rotation.z = s2 * 0.08; arm.rotation.x = -s2 * pose * 0.3;
      add(new THREE.SphereGeometry(0.05, 10, 8), skin, s2 * (sh + 0.02), 0.86, 0, g);
    }
    add(new THREE.CapsuleGeometry(0.16, 0.36, 6, 12).scale(tx, 1, 0.75), cloth, 0, 1.18, 0, g);   // torso
    add(new THREE.CapsuleGeometry(0.168, 0.3, 6, 12).scale(tx + 0.02, 1, 0.78), hiVis, 0, 1.22, 0, g, false);   // vest
    add(new THREE.CylinderGeometry(0.045, 0.05, 0.08, 10), skin, 0, 1.49, 0, g);                 // neck
    add(new THREE.SphereGeometry(0.105, 18, 14).scale(0.9, 1.08, 0.95), skin, 0, 1.63, 0.01, g); // head
    add(new THREE.SphereGeometry(0.112, 16, 10, Math.PI, Math.PI, 0, Math.PI * 0.62).scale(0.93, 1.05, 0.98), hairM, 0, 1.635, -0.006, g, false);   // hair under the cap (back and sides only)
    if (style === "pony") { const t = add(new THREE.CapsuleGeometry(0.04, 0.2, 4, 8), hairM, 0, 1.5, -0.13, g, false); t.rotation.x = 0.25; }
    if (style === "long") add(new THREE.CapsuleGeometry(0.1, 0.13, 6, 12).scale(1.02, 1, 0.55), hairM, 0, 1.5, -0.05, g, false);   // shoulder-length hair, visible beside the neck
    if (style === "pony") add(new THREE.SphereGeometry(0.04, 10, 8), hairM, 0, 1.62, -0.11, g, false);   // tie point
    if (style === "bun") add(new THREE.SphereGeometry(0.065, 12, 10), hairM, 0, 1.6, -0.12, g, false);
    add(new THREE.SphereGeometry(0.115, 18, 10, 0, 6.29, 0, Math.PI / 2), std(cap, 0.7), 0, 1.66, 0, g);   // cap
    add(new THREE.CylinderGeometry(0.09, 0.09, 0.015, 16, 1, false, -0.9, 1.8), std(cap, 0.7), 0, 1.67, 0.08, g, false);   // cap brim
    return g;
  }
  // three women and three men in technical roles; heights, hair and skin tones vary
  person(-200, 168, 0.6, "#3c5a3a", "#e7e246", 0.6, { w: true, h: 1.66, skin: "#8d5a3b", hair: "#1a1110", style: "bun" });          // checking the grain bins (moisture probe)
  person(-196, 170, -2.4, "#5a3a32", "#f08a2a", 0, { h: 1.80, skin: "#e2b48e", hair: "#6b4a2b", cap: "#33465e" });
  person(18, 232, 1.2, "#2f4a6e", "#e7e246", 0.4, { h: 1.72, skin: "#5c3b26", hair: "#120c0a" });                                    // at the barn
  person(-38, 133, -0.4, "#444", "#e7e246", 0, { w: true, h: 1.62, skin: "#f0c8a4", hair: "#b07a3e", style: "pony", cap: "#33465e" });  // reading the weather station
  person(352, 62, 2.6, "#3a4f6a", "#e7e246", 0.5, { h: 1.77, skin: "#b9825a", hair: "#2b1d14" });                                     // walking the corn rows near the close-up view

  // ---------- autonomy and GPS remote control ----------
  // amber "autonomous mode" strobe on the cab roof (green while under remote control)
  const strobeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffb020").multiplyScalar(3) });
  const strobe = add(new THREE.SphereGeometry(0.13, 12, 8), strobeMat, -0.75, 4.55, 1.3, tractor, false);
  // RTK GPS base station on a tripod at the farmstead: it broadcasts corrections by radio so the sprayer knows its position to centimetres
  const base = new THREE.Group(); base.position.set(-20, 0, 110); world.add(base);
  for (let k = 0; k < 3; k++) { const a2 = k * 2.094, leg = add(new THREE.CylinderGeometry(0.03, 0.03, 2.1, 6), darkSteel, Math.cos(a2) * 0.45, 1.0, Math.sin(a2) * 0.45, base, false); leg.rotation.set(Math.sin(a2) * 0.22, 0, -Math.cos(a2) * 0.22); }
  add(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 8), darkSteel, 0, 2.6, 0, base, false);
  add(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 20), std("#f2f2ee", 0.4), 0, 3.42, 0, base);
  add(new THREE.SphereGeometry(0.19, 20, 10, 0, 6.29, 0, Math.PI / 2), std("#f2f2ee", 0.35), 0, 3.45, 0, base);
  add(new THREE.CylinderGeometry(0.015, 0.015, 1.4, 6), std("#111", 0.4), 0.35, 3.1, 0, base, false);      // radio whip antenna
  add(new RoundedBoxGeometry(0.4, 0.3, 0.2, 2, 0.04), std("#2a2d31", 0.5), 0, 1.3, 0.12, base);         // receiver + radio box
  // radio links: base station → sprayer (corrections), tablet → sprayer (remote commands); dashed, animated
  const linkGeo = () => new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, 1)]);
  const rtkLink = new THREE.Line(linkGeo(), new THREE.LineDashedMaterial({ color: "#f0b323", dashSize: 3, gapSize: 2.5, transparent: true, opacity: 0.85 }));
  const rcLink = new THREE.Line(linkGeo(), new THREE.LineDashedMaterial({ color: "#1fb26a", dashSize: 2, gapSize: 1.5, transparent: true, opacity: 0.9 }));
  rtkLink.frustumCulled = rcLink.frustumCulled = false; world.add(rtkLink, rcLink); rcLink.visible = false;
  // planned GPS line ahead of the sprayer on its current pass
  const pathMat = new THREE.MeshBasicMaterial({ color: "#2fd07a", transparent: true, opacity: 0.55, depthWrite: false });
  const pathLine = add(new THREE.PlaneGeometry(0.35, 1).rotateX(-Math.PI / 2), pathMat, 0, 0.55, 0, world, false);
  // the operator who can take over remotely, with a tablet, at the field's south edge
  const operator = person(300, 72, Math.PI * 0.85, "#2f4a6e", "#e7e246", 0, { w: true, h: 1.68, skin: "#c68642", hair: "#24180f", style: "long" });
  add(new RoundedBoxGeometry(0.26, 0.18, 0.02, 2, 0.01), std("#111", 0.2, 0.3, { emissive: new THREE.Color("#3a7bd5"), emissiveIntensity: 0.5 }), 0, 1.15, 0.3, operator, false).rotation.x = -0.9;
  const rc = { on: false, throttle: 0, steer: 0, x: 0, z: 0, h: 0, v: 0 };
  const pose = { x: 0, z: 0, h: 0, v: 0, k: 0, nPass: 1, dir: 1, remote: false, xte: 0 };
  function setRemote(on) {
    rc.on = on; pose.remote = on;
    if (on) { rc.x = tractor.position.x; rc.z = tractor.position.z; rc.h = tractor.rotation.y; rc.throttle = 0; rc.steer = 0; rc.v = 0; }
    strobeMat.color.set(on ? "#28d17c" : "#ffb020").multiplyScalar(3);
    rcLink.visible = on; pathLine.visible = !on;
  }

  // ---------- nutrient losses made visible ----------
  // Ammonia (and other N gases) escaping from the corn field: an illustrative plume. The gases are invisible;
  // particle density follows the model's ammonia loss after each fertilizer pass.
  const puff = canvasTex(64, 64, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, "rgba(255,255,255,0.9)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, h); }, [1, 1], false);
  const NH3N = lite ? 900 : 2200;
  const gasPlume = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: "#c9b6ff", size: 24, map: puff, alphaMap: puff, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true }));
  const nh3Seed = new Float32Array(NH3N * 4);
  { const p = new Float32Array(NH3N * 3); for (let i = 0; i < NH3N; i++) { p[3 * i] = CORN.x0 + rnd() * (CORN.x1 - CORN.x0); p[3 * i + 1] = rnd() * 22; p[3 * i + 2] = CORN.z0 + rnd() * (CORN.z1 - CORN.z0); nh3Seed[4 * i] = 1.5 + rnd() * 2.5; nh3Seed[4 * i + 1] = rnd() * 6.28; } gasPlume.geometry.setAttribute("position", new THREE.BufferAttribute(p, 3)); }
  gasPlume.visible = false; gasPlume.frustumCulled = false; world.add(gasPlume);
  // Runoff: a muddy sheet from the field's south edge down to the stream, the stream turning brown,
  // and a sediment plume spreading into the lake where the stream enters it.
  const flowTex = canvasTex(128, 128, (g, w, h) => { g.fillStyle = "rgba(0,0,0,0)"; g.clearRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { const x = rnd() * w, y = rnd() * h, l = 6 + rnd() * 18; g.strokeStyle = `rgba(255,255,255,${0.25 + 0.5 * rnd()})`; g.lineWidth = 1 + rnd() * 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 4, y + l); g.stroke(); } }, [24, 2], false);
  let runSheet = null;
  const runMat = po(new THREE.MeshBasicMaterial({ color: "#7a5532", transparent: true, opacity: 0, depthWrite: false, alphaMap: flowTex }), 8);
  {
    const pos = [], uv = [], idx = [], N = 64;
    for (let i = 0; i <= N; i++) {
      const x = CORN.x0 + (CORN.x1 - CORN.x0) * i / N, zs = (() => { let best = 1e9, zz = 100; for (let t = 0; t <= 1; t += 0.002) { const q = streamPt(t); const d = Math.abs(q[0] - x); if (d < best) { best = d; zz = q[1]; } } return zz; })();
      pos.push(x, 0.32, CORN.z1 + 0.5, x, 0.32, zs - 6); uv.push(i / N, 0, i / N, 1);
      if (i < N) { const a2 = 2 * i; idx.push(a2, a2 + 1, a2 + 2, a2 + 1, a2 + 3, a2 + 2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    runSheet = add(g, runMat, 0, 0, 0, world, false); runSheet.renderOrder = 2;
  }
  // where the stream enters the lake
  let inlet = [LAKE.x - LAKE.rx, LAKE.z];
  for (let t = 0; t <= 1; t += 0.001) { const q = streamPt(t); if (((q[0] - LAKE.x) / LAKE.rx) ** 2 + ((q[1] - LAKE.z) / LAKE.rz) ** 2 < 0.92) { inlet = q; break; } }
  const plumeAlpha = canvasTex(128, 128, (g, w, h) => { for (let k = 0; k < 18; k++) { const x = w / 2 + (rnd() - 0.5) * w * 0.35, y = h / 2 + (rnd() - 0.5) * h * 0.35, r = 18 + rnd() * 40; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, "rgba(255,255,255,0.55)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
    const img = g.getImageData(0, 0, w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const r = Math.hypot(x - w / 2 + 0.5, y - h / 2 + 0.5) / (w / 2), f = Math.max(0, 1 - r * r) ** 1.5, k = 4 * (y * w + x); for (let c = 0; c < 3; c++) img.data[k + c] *= f; } g.putImageData(img, 0, 0); }, [1, 1], false);
  const plumeMat = po(new THREE.MeshBasicMaterial({ color: "#8a6a3c", transparent: true, opacity: 0, depthWrite: false, alphaMap: plumeAlpha }), 9);
  const lakePlume = add(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), plumeMat, inlet[0], 0.46, inlet[1], world, false);
  lakePlume.renderOrder = 3;
  const inDir = (() => { const dx = LAKE.x - inlet[0], dz = LAKE.z - inlet[1], l = Math.hypot(dx, dz); return [dx / l, dz / l]; })();
  const streamBase = streamMat.color.clone(), streamMud = new THREE.Color("#6e5434");

  // ---------- rain ----------
  const rainN = lite ? 2500 : 6000;
  const streak = canvasTex(32, 32, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.5, "rgba(255,255,255,0.9)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(w / 2 - 1, 0, 2, h); }, [1, 1], false);
  const rain = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: "#d4e2ee", size: 1.6, map: streak, alphaMap: streak, transparent: true, opacity: 0.6, depthWrite: false }));
  { const p = new Float32Array(rainN * 3); for (let i = 0; i < rainN; i++) { p[3 * i] = (rnd() - 0.5) * 900; p[3 * i + 1] = rnd() * 300; p[3 * i + 2] = (rnd() - 0.5) * 900; } rain.geometry.setAttribute("position", new THREE.BufferAttribute(p, 3)); }
  rain.visible = false; world.add(rain);

  // ======================================================================
  // zoom scenes (far below the farm; the camera flies there)
  // ======================================================================
  const micro = new THREE.Group(); scene.add(micro); micro.visible = false;
  function label(text, x, y, z, parent, size = 0.6, color = "#1d2733", bg = "rgba(255,255,255,0.86)") {
    const c = document.createElement("canvas"), g = c.getContext("2d"), fs = 44;
    g.font = `600 ${fs}px Barlow, system-ui, sans-serif`;
    const lines = text.split("\n"), w = Math.max(...lines.map(l => g.measureText(l).width)) + 36, h = lines.length * fs * 1.2 + 24;
    c.width = Math.ceil(w); c.height = Math.ceil(h);
    g.font = `600 ${fs}px Barlow, system-ui, sans-serif`;
    g.fillStyle = bg; g.beginPath(); g.roundRect(0, 0, c.width, c.height, 18); g.fill();
    g.fillStyle = color; g.textBaseline = "top"; lines.forEach((l, i) => g.fillText(l, 18, 12 + i * fs * 1.2));
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, depthWrite: false, transparent: true, toneMapped: false, fog: false }));
    s.layers.set(1);   // drawn in an overlay pass after post-processing, so AO, bloom and tone mapping leave the text crisp
    s.scale.set(size * lines.length * c.width / c.height, size * lines.length, 1); s.position.set(x, y, z); s.renderOrder = 20; parent.add(s); return s;
  }

  // --- soil column with roots ---
  const soilG = new THREE.Group(); soilG.position.copy(MICRO.soil); micro.add(soilG);
  const layerCols = [["#3a2a1c", 0.35], ["#6b4a2c", 0.55], ["#93714a", 0.9]];
  let ytop = 0;
  for (const [col, th] of layerCols) {
    const tex = canvasTex(256, 128, (g, w, h) => noiseFill(g, w, h, col, 55, 3000, 3), [3, 1]);
    add(box(3, th, 1.6), std("#ffffff", 0.95, 0, { map: tex }), 0, ytop - th / 2, -0.8, soilG, false);
    ytop -= th;
  }
  add(new THREE.CylinderGeometry(0.06, 0.06, 1.62, 16).rotateX(Math.PI / 2), std("#2f3235", 0.5), 1.0, -1.45, -0.79, soilG, false);   // drain tile
  { const cp = corn.im.geometry.clone(); const m = add(cp, std("#4c8a2e", 0.7, 0, { side: THREE.DoubleSide }), -0.4, 0, -0.1, soilG, false); m.scale.set(1.4, 2.2, 1.4); }
  {
    const rootMat = std("#e7dcc4", 0.8);
    const grow = (p, dir, len, depth) => {
      if (depth > 4 || len < 0.06) return;
      const pts = [p.clone()]; let q = p.clone(), d = dir.clone();
      for (let k = 0; k < 6; k++) { d.add(new THREE.Vector3((rnd() - 0.5) * 0.5, -0.15, 0)).normalize(); d.z = 0; q = q.clone().addScaledVector(d, len / 6); if (q.y < -1.75) q.y = -1.75; q.z = 0.02 + 0.03 * rnd(); pts.push(q); }
      add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.012 * (5 - depth) * 0.6, 5, false), rootMat, 0, 0, 0, soilG, false);
      for (let k = 2; k < pts.length; k += 2) if (rnd() < 0.8) grow(pts[k], new THREE.Vector3((rnd() - 0.5) * 2, -0.6, (rnd() - 0.5)).normalize(), len * 0.55, depth + 1);
    };
    for (let k = 0; k < 7; k++) grow(new THREE.Vector3(-0.4, -0.02, 0.03), new THREE.Vector3((k - 3) * 0.3, -0.8, 0).normalize(), 1.1, 0);
  }
  const soilParticles = [];
  const mkParticles = (n, color, size) => {
    const p = new Float32Array(n * 3); for (let i = 0; i < n; i++) { p[3 * i] = (rnd() - 0.5) * 2.8; p[3 * i + 1] = -rnd() * 1.75; p[3 * i + 2] = 0.03 + rnd() * 0.02; }
    const pts = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color, size, depthWrite: false }));
    pts.geometry.setAttribute("position", new THREE.BufferAttribute(p, 3)); soilG.add(pts); soilParticles.push(pts); return pts;
  };
  const waterDots = mkParticles(260, "#5fb4ff", 0.05), nitrateDots = mkParticles(120, "#ff9d2e", 0.07), uptakeDots = mkParticles(80, "#7be36a", 0.06);
  label("Topsoil: organic matter\nslowly releases nitrogen", 0.75, 0.32, 0.1, soilG, 0.12);
  label("Nitrate (NO₃⁻, orange) moves\ndown with water (blue)", 0.8, -0.75, 0.1, soilG, 0.12);
  label("Roots take up water\nand nitrogen (green)", -1.0, -1.3, 0.1, soilG, 0.12);
  label("Drain tile → stream", 1.0, -1.65, 0.1, soilG, 0.14);

  // --- plant cell ---
  const cellG = new THREE.Group(); cellG.position.copy(MICRO.cell); micro.add(cellG);
  add(box(8, 5, 5), new THREE.MeshPhysicalMaterial({ color: "#a8d08d", roughness: 0.4, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }), 0, 0, 0, cellG, false);
  add(new THREE.BoxGeometry(8.1, 5.1, 5.1), new THREE.MeshBasicMaterial({ color: "#5e8f3d", wireframe: true, transparent: true, opacity: 0.25 }), 0, 0, 0, cellG, false);
  add(new THREE.SphereGeometry(1.6, 32, 16).scale(1.3, 0.9, 0.9), new THREE.MeshPhysicalMaterial({ color: "#bcd8f0", roughness: 0.2, transparent: true, opacity: 0.35, depthWrite: false }), 1.2, 0.2, 0, cellG, false);   // vacuole
  add(new THREE.SphereGeometry(0.85, 32, 16), std("#8a6aa8", 0.5), -2.4, 0.6, 0.3, cellG, false);   // nucleus
  add(new THREE.SphereGeometry(0.3, 16, 8), std("#5c3f7a", 0.5), -2.25, 0.75, 0.9, cellG, false);
  for (let k = 0; k < 14; k++) {
    const g = new THREE.Group(); g.position.set(-3.4 + rnd() * 6.8, -2 + rnd() * 4, -1.9 + rnd() * 3.8);
    if (Math.hypot((g.position.x - 1.2) / 2.1, g.position.y / 1.4) < 1) g.position.x += 2.4;
    g.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); cellG.add(g);
    add(new THREE.SphereGeometry(0.42, 20, 12).scale(1.6, 0.7, 0.9), std("#3f8f2f", 0.5), 0, 0, 0, g, false);
    for (let s = -2; s <= 2; s++) add(new THREE.CylinderGeometry(0.12, 0.12, 0.22, 12), std("#1f6420", 0.6), s * 0.18, 0, 0.18, g, false);
  }
  for (let k = 0; k < 6; k++) add(new THREE.CapsuleGeometry(0.12, 0.3, 4, 8).rotateZ(rnd() * 3), std("#d58a3a", 0.6), -3 + rnd() * 6, -2 + rnd() * 4, -1.5 + rnd() * 3, cellG, false);
  label("Chloroplasts: sunlight + CO₂ + water → sugar", 0.3, 3.0, 2.6, cellG, 0.32);
  label("Nucleus: DNA, including\nany added trait gene", -2.3, -1.7, 2.6, cellG, 0.24);
  label("Vacuole: water store\n(it shrinks in drought)", 2.3, -1.9, 2.6, cellG, 0.24);

  // --- molecules ---
  const molG = new THREE.Group(); molG.position.copy(MICRO.mol); micro.add(molG);
  const Nmat = std("#3b6fd6", 0.35), Hmat = std("#f2f2f2", 0.4), bondMat = std("#c9ced4", 0.4);
  const atom = (r, mat, x, y, z, par) => add(new THREE.SphereGeometry(r, 32, 16), mat, x, y, z, par, false);
  const bond = (a, b, r, par, off = new THREE.Vector3()) => {
    const A = new THREE.Vector3(...a).add(off), B = new THREE.Vector3(...b).add(off), d = B.clone().sub(A);
    const m = add(new THREE.CylinderGeometry(r, r, d.length(), 12), bondMat, 0, 0, 0, par, false);
    m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  };
  const n2 = new THREE.Group(); n2.position.set(-4.5, 1.6, 0); molG.add(n2);
  atom(0.42, Nmat, -0.62, 0, 0, n2); atom(0.42, Nmat, 0.62, 0, 0, n2);
  for (const o of [[0, 0.16, 0], [0, -0.08, 0.14], [0, -0.08, -0.14]]) bond([-0.62, 0, 0], [0.62, 0, 0], 0.06, n2, new THREE.Vector3(...o));
  label("N≡N triple bond:\n941 kJ/mol to break", -4.5, 3.2, 0, molG, 0.55);
  const nh3 = new THREE.Group(); nh3.position.set(0, 1.6, 0); molG.add(nh3);
  atom(0.55, Nmat, 0, 0.15, 0, nh3);
  for (let k = 0; k < 3; k++) { const a = k * 2.094; const h = [Math.cos(a) * 0.9, -0.3, Math.sin(a) * 0.9]; atom(0.32, Hmat, ...h, nh3); bond([0, 0.15, 0], h, 0.07, nh3); }
  label("Ammonia, NH₃: the start\nof nitrogen fertilizer", 0, 3.2, 0, molG, 0.55);
  // enzyme (illustrative blob: a folded chain of amino acids)
  const enz = new THREE.Group(); enz.position.set(4.6, 1.4, 0); molG.add(enz);
  {
    const pts = []; let q = new THREE.Vector3();
    for (let k = 0; k < 90; k++) { q = q.clone().add(new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(0.7)); q.clampLength(0, 1.3); pts.push(q); }
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 400, 0.11, 8, false), std("#d5a23a", 0.5), 0, 0, 0, enz, false);
    atom(0.22, std("#b5452f", 0.4), 0.2, 0.1, 0.6, enz);   // metal cluster (Fe-Mo cofactor)
  }
  label("Nitrogenase enzyme (soybean\nroot nodules) splits N₂ gently", 4.8, 3.2, 0, molG, 0.55);
  // DNA double helix
  const dna = new THREE.Group(); dna.position.set(0, -2.1, 0); molG.add(dna);
  {
    const base = ["#e2574c", "#3fae5a", "#3f7fd6", "#e6c13a"];
    for (let k = 0; k < 40; k++) {
      const x = -6 + k * 0.3, a = k * 0.6;
      const p1 = [x, Math.cos(a) * 0.9, Math.sin(a) * 0.9], p2 = [x, -Math.cos(a) * 0.9, -Math.sin(a) * 0.9];
      atom(0.13, std("#8c96a0", 0.4), ...p1, dna); atom(0.13, std("#8c96a0", 0.4), ...p2, dna);
      const mid = [x, 0, 0];
      const m1 = add(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 8), std(base[k % 4], 0.5), 0, 0, 0, dna, false);
      const m2 = add(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 8), std(base[(k + 2) % 4], 0.5), 0, 0, 0, dna, false);
      for (const [m, p] of [[m1, p1], [m2, p2]]) { const A = new THREE.Vector3(...p), B = new THREE.Vector3(...mid); m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.sub(A).normalize()); }
    }
  }
  label("DNA: a gene is the recipe for one protein (for example Bt Cry or CspB)", 0, -3.7, 0, molG, 0.6);

  // ======================================================================
  // per-frame state
  // ======================================================================
  const st = { nh3: 0, runoff: 0, lakeP: 0, spraying: false, irrigating: false, raining: 0, digesterOn: true, ndvi: false, tsi: 60, gps: false, precision: false };
  let droneT = 0, tractorT = 0;
  function tick(dt, now, rate) {
    // tractor: back-and-forth along 36 m passes over the corn field
    const passLen = CORN.z1 - CORN.z0 - 40, nPass = Math.floor((CORN.x1 - CORN.x0) / 36);
    if (rc.on) {
      // remote control: throttle and steering from the operator's tablet (real time, not simulation time)
      const vt = rc.throttle * 3.3;                               // up to 3.3 m/s (12 km/h)
      rc.v += (vt - rc.v) * Math.min(1, dt * 1.5);
      rc.h += rc.steer * 0.45 * dt * Math.sign(rc.v || 0) * Math.min(1, Math.abs(rc.v) / 0.8);
      rc.x = Math.min(CORN.x1 + 15, Math.max(CORN.x0 - 15, rc.x + Math.sin(rc.h) * rc.v * dt));
      rc.z = Math.min(CORN.z1 + 15, Math.max(CORN.z0 - 15, rc.z + Math.cos(rc.h) * rc.v * dt));
      tractor.position.set(rc.x, 0, rc.z); tractor.rotation.y = rc.h;
      Object.assign(pose, { x: rc.x, z: rc.z, h: rc.h, v: rc.v });
      const t = ((rc.x - CORN.x0 - 18) % 36 + 36) % 36; pose.xte = Math.min(t, 36 - t); pose.k = Math.round((rc.x - CORN.x0 - 18) / 36);
    } else {
      if (st.hold !== "tractor") tractorT += dt * 4.5;
      const total = passLen * nPass, s = tractorT % total, k = Math.floor(s / passLen), u = (s % passLen);
      const x = CORN.x0 + 18 + k * 36, dir = k % 2 ? 1 : -1, z = dir > 0 ? CORN.z0 + 20 + u : CORN.z1 - 20 - u;
      tractor.position.set(x, 0, z); tractor.rotation.y = dir > 0 ? 0 : Math.PI;
      Object.assign(pose, { x, z, h: tractor.rotation.y, v: st.hold === "tractor" ? 0 : 4.5, k, nPass, dir, xte: 0.01 + 0.01 * Math.sin(now / 700) });
      // planned line: from the sprayer to the end of this pass
      const zEnd = dir > 0 ? CORN.z1 - 20 : CORN.z0 + 20, len = Math.abs(zEnd - z);
      pathLine.position.set(x, 0.55, (z + zEnd) / 2 + dir * 2); pathLine.scale.set(1, 1, Math.max(0.1, len - 4));
    }
    strobe.visible = Math.floor(now / 450) % 2 === 0;
    { const tp = tractor.position, b = base.position;
      const set = (L, ax, ay, az) => { const p = L.geometry.attributes.position; p.setXYZ(0, ax, ay, az); p.setXYZ(1, tp.x + Math.sin(tractor.rotation.y) * 0.4, 4.6, tp.z + Math.cos(tractor.rotation.y) * 0.4); p.needsUpdate = true; L.computeLineDistances(); L.material.dashOffset = -now / 120; };
      set(rtkLink, b.x, 4.4, b.z); if (rc.on) set(rcLink, operator.position.x, 1.2, operator.position.z); }
    boomSpray.visible = st.spraying; sprayFans.visible = st.spraying;
    // ammonia plume: rises, drifts with the wind (to the north-east), wraps; strength from st.nh3 (0..1)
    gasPlume.visible = st.nh3 > 0.01; gasPlume.material.opacity = Math.min(0.13, 0.03 + 0.12 * st.nh3);
    if (gasPlume.visible) {
      const P = gasPlume.geometry.attributes.position, nShow = Math.round(NH3N * Math.min(1, 0.15 + st.nh3));
      gasPlume.geometry.setDrawRange(0, nShow);
      for (let i = 0; i < nShow; i++) {
        let y = P.getY(i) + dt * nh3Seed[4 * i] * Math.min(rate, 7) * 0.35;
        let x = P.getX(i) + dt * 1.2 * Math.min(rate, 7), z = P.getZ(i) - dt * 0.6 * Math.min(rate, 7) + Math.sin(now / 900 + nh3Seed[4 * i + 1]) * 0.03;
        if (y > 22) { y = 0.5; x = CORN.x0 + rnd() * (CORN.x1 - CORN.x0); z = CORN.z0 + rnd() * (CORN.z1 - CORN.z0); }
        P.setXYZ(i, x, y, z);
      }
      P.needsUpdate = true;
    }
    // runoff: muddy sheet flows toward the stream, stream turns brown, sediment plume in the lake
    runMat.opacity = Math.min(0.75, 0.9 * st.runoff); runSheet.visible = runMat.opacity > 0.01; lakePlume.visible = st.lakeP > 0.01; flowTex.offset.y -= dt * 0.25 * Math.min(rate, 7);
    streamMat.color.copy(streamBase).lerp(streamMud, Math.min(1, st.runoff * 1.2));
    plumeMat.opacity = Math.min(0.5, 0.15 + 0.4 * st.lakeP); const ps = 25 + 75 * Math.min(1, st.lakeP); lakePlume.scale.set(ps, 1, ps * 0.8);
    lakePlume.position.set(inlet[0] + inDir[0] * ps * 0.85, 0.46, inlet[1] + inDir[1] * ps * 0.85);
    // drone: lawnmower pattern 50 m up
    if (st.hold !== "drone") droneT += dt * 9;
    const dl = CORN.z1 - CORN.z0 - 60, dn = 6, dtot = dl * dn, ds = droneT % dtot, dk = Math.floor(ds / dl), du = ds % dl;
    const dx = CORN.x0 + 60 + dk * (CORN.x1 - CORN.x0 - 120) / (dn - 1), dz = dk % 2 ? CORN.z0 + 30 + du : CORN.z1 - 30 - du;
    drone.position.set(dx, 50 + Math.sin(now / 900) * 0.8, dz);
    rotors.forEach(r => (r.rotation.y += dt * 60));
    droneCone.visible = st.ndvi; droneCone.position.set(dx, 25, dz);
    // pivot
    if (st.irrigating) arm.rotation.y -= dt * 0.08 * Math.min(rate, 4);
    sprayPts.visible = st.irrigating;
    // digester
    digester.visible = st.digesterOn;
    flame.visible = st.digesterOn; flame.scale.set(1, 0.85 + 0.3 * Math.sin(now / 90) * Math.sin(now / 37), 1);
    // water movement
    waterTex.offset.x = (now / 40000) % 1;
    // rain
    rain.visible = st.raining > 0;
    if (rain.visible) {
      const p = rain.geometry.attributes.position, fall = dt * 140;
      for (let i = 0; i < rainN; i++) { let y = p.array[3 * i + 1] - fall; if (y < 0) y += 300; p.array[3 * i + 1] = y; }
      p.needsUpdate = true;
    }
    // soil particles
    if (micro.visible) {
      const mv = (pts, vx, vy, toRoot) => {
        const p = pts.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) {
          let x = p.array[3 * i], y = p.array[3 * i + 1];
          if (toRoot) { x += (-0.4 - x) * dt * 0.6; y += (0.05 - y) * dt * 0.3; if (Math.abs(x + 0.4) < 0.05) { x = (rnd() - 0.5) * 2.8; y = -0.2 - rnd() * 1.3; } }
          else { y -= vy * dt; x += vx * dt * (rnd() - 0.5); if (y < -1.75) { y = 0; x = (rnd() - 0.5) * 2.8; } }
          p.array[3 * i] = x; p.array[3 * i + 1] = y;
        }
        p.needsUpdate = true;
      };
      mv(waterDots, 0.3, 0.05 + st.drainRate * 0.6, false);
      mv(nitrateDots, 0.2, 0.02 + st.drainRate * 0.35, false);
      mv(uptakeDots, 0, 0, true);
      n2.rotation.y += dt * 0.4; nh3.rotation.y += dt * 0.5; enz.rotation.y += dt * 0.25; dna.rotation.x += dt * 0.3;
    }
  }
  st.drainRate = 0;
  tick(0, 0, 1);   // place the tractor and drone before the first frame

  // ---------- data → scene ----------
  const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const hex = h => { const c = new THREE.Color(h); return [c.r, c.g, c.b].map(v => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)); };
  const GREEN = hex("#3f7a26"), YEL = hex("#a7a23f"), TAN = hex("#c8a966"), SOIL = hex("#4a3726");
  const ndviCol = v => {                       // brown -> yellow -> green
    const s = [[0.1, hex("#8c5a2b")], [0.35, hex("#d9c14a")], [0.6, hex("#9cc94a")], [0.85, hex("#1f7a2a")]];
    if (v <= s[0][0]) return s[0][1];
    for (let i = 1; i < s.length; i++) if (v <= s[i][0]) return lerp3(s[i - 1][1], s[i][1], (v - s[i - 1][0]) / (s[i][0] - s[i - 1][0]));
    return s[s.length - 1][1];
  };
  // d: day index; zones: [{lai:Float32Array, ks:Float32Array}], mat: maturity day (or -1), soyRec
  function showDay(d, zones, cornMat, soyRec, soyMat, cornGddFrac, soyGddFrac) {
    const n = zones.length, hC = new Float64Array(n), cC = [], cov = new Float64Array(n);
    for (let k = 0; k < n; k++) {
      const lai = zones[k].lai[d], ks = zones[k].ks[d];
      const ndvi = 0.15 + 0.75 * (1 - Math.exp(-0.6 * lai));
      hC[k] = lai > 0 ? 2.7 * Math.min(1, cornGddFrac[k] * 1.6) : 0;
      cov[k] = 1 - Math.exp(-0.65 * lai);
      let col = lerp3(YEL, GREEN, Math.min(1, Math.max(0, ks)) * Math.min(1, lai / 2.5 + 0.3));
      if (cornMat[k] >= 0 && d > cornMat[k]) col = lerp3(col, TAN, Math.min(1, (d - cornMat[k]) / 12));
      cC.push(st.ndvi ? ndviCol(ndvi) : col);
    }
    lastCorn = [hC, cC]; refreshCorn();
    paintField(cornGround, cC, 6, st.ndvi ? cov.map(() => 1) : cov.map(c => Math.min(1, c * 1.15)));
    const sl = soyRec.lai[d], sks = soyRec.ks[d];
    let scol = lerp3(YEL, hex("#4f8a2c"), Math.min(1, sks) * Math.min(1, sl / 2 + 0.3));
    if (soyMat >= 0 && d > soyMat) scol = lerp3(scol, hex("#b98d4a"), Math.min(1, (d - soyMat) / 10));
    if (st.ndvi) scol = ndviCol(0.15 + 0.75 * (1 - Math.exp(-0.6 * sl)));
    setPlants(soy, [sl > 0 ? 0.95 * Math.min(1, soyGddFrac * 1.8) : 0], 1.9, [scol]);
    paintField(soyGround, [scol], 7, [st.ndvi ? 1 : 1 - Math.exp(-0.55 * sl)]);
  }
  function setLake(tsi) {
    st.tsi = tsi;
    const t = Math.min(1, Math.max(0, (tsi - 45) / 30));
    lakeMat.color.set("#3d6f8c").lerp(new THREE.Color("#4f7f3a"), t);
    scumMat.opacity = Math.max(0, Math.min(1, (tsi - 56) / 12));
  }
  function setDryer(on) { dryerHeat.material.opacity = on ? 0.8 : 0; }

  // image-based light: full for metals, half for paint, soil and plants (keeps contrast under the bright sky)
  scene.traverse(o => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; ms.forEach(m => { if (m.isMeshStandardMaterial && m.envMapIntensity === 1) m.envMapIntensity = m.metalness > 0.5 ? 1.0 : 0.5; }); });
  return {
    st, tick, showDay, setLake, setDryer, gpsLines, micro, world, MICRO, envFarm, envMicro, followShadow, setShadowSize, followDetail, inlet, rc, pose, setRemote,
    sunLight: sun, tractor, drone, objects: { barn, digester, store, bins, pivot, ws },
  };
}
