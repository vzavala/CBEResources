// Lava Lamp Digital Twin: the 3D scene, a desk at home in the evening (three.js r0.160). Graphics only; numbers come from model.js via app.js.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { MarchingCubes } from "three/addons/objects/MarchingCubes.js";

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
function canvasTex(w, h, draw, repeat) { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); } return t; }
function rnd(seed) { let a = seed; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; }

export function makeScene(stage, NBLOB = 6, blobStage = null) {
  const phone = innerWidth < 860 || matchMedia("(pointer: coarse)").matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.setPixelRatio(Math.min(devicePixelRatio, phone ? 1.5 : 2));
  stage.prepend(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color("#8f96a3");
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.03).texture; scene.environmentIntensity = 0.4;
  const camera = new THREE.PerspectiveCamera(34, 1.5, 0.05, 40);
  const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = 0.08; controls.minDistance = 0.3; controls.maxDistance = 5; controls.maxPolarAngle = Math.PI * 0.52;
  scene.add(new THREE.HemisphereLight("#dfe6ff", "#8a7a66", 0.32));
  const key = new THREE.DirectionalLight("#ffe9cf", 1.05); key.position.set(-1.8, 3.2, 2.6); key.target.position.set(0, 0.8, 0); key.castShadow = true; key.shadow.mapSize.setScalar(phone ? 1024 : 2048); Object.assign(key.shadow.camera, { left: -1.8, right: 1.8, top: 1.6, bottom: -1.2, near: 0.5, far: 9 }); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.01; scene.add(key, key.target);

  const std = o => new THREE.MeshStandardMaterial(o), phys = o => new THREE.MeshPhysicalMaterial(o);
  const wood = (base, a, b, seed) => canvasTex(256, 256, (g, w, h) => { g.fillStyle = base; g.fillRect(0, 0, w, h); const r = rnd(seed); for (let i = 0; i < 110; i++) { g.strokeStyle = r() > 0.5 ? a : b; g.globalAlpha = 0.3; g.lineWidth = 1 + r() * 2; const y = r() * h; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w / 3, y + 6 * (r() - 0.5), 2 * w / 3, y + 6 * (r() - 0.5), w, y + 4 * (r() - 0.5)); g.stroke(); } });
  const floorT = wood("#a88462", "#8f6c4d", "#bb9772", 3); floorT.wrapS = floorT.wrapT = THREE.RepeatWrapping; floorT.repeat.set(5, 5);
  const deskT = wood("#d6b98f", "#c2a172", "#e3caa3", 8); deskT.wrapS = deskT.wrapT = THREE.RepeatWrapping; deskT.repeat.set(2, 1);
  const M = { floor: std({ map: floorT, roughness: 0.6 }), wall: std({ color: "#e4e2dc", roughness: 0.95 }), desk: std({ map: deskT, roughness: 0.5 }), white: std({ color: "#f3f3f0", roughness: 0.5 }), dark: std({ color: "#2b2e33", roughness: 0.6 }),
    alu: std({ color: "#d8dbde", metalness: 1, roughness: 0.3, envMapIntensity: 2.6, roughnessMap: canvasTex(256, 64, (g, w, h) => { g.fillStyle = "#8c8c8c"; g.fillRect(0, 0, w, h); const r = rnd(31); for (let i = 0; i < 900; i++) { g.fillStyle = r() > 0.5 ? "#a8a8a8" : "#727272"; g.fillRect(0, r() * h, w, 0.6 + r()); } }) }), steel: std({ color: "#aeb4ba", metalness: 1, roughness: 0.35 }), rubber: std({ color: "#1b1b1d", roughness: 0.9 }), paper: std({ color: "#fbfaf4", roughness: 0.8 }),
    glass: phys({ color: "#dff1f6", roughness: 0.03, transparent: true, opacity: 0.06, envMapIntensity: 2.4, clearcoat: 1, clearcoatRoughness: 0.02, depthWrite: false, side: THREE.DoubleSide }) };
  // make the glass readable: nearly clear when seen face-on, clearly visible where it curves away (its outline), as real glass looks
  M.glass.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace("#include <color_fragment>", "#include <color_fragment>\n{ float fr = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 2.0); diffuseColor.a = mix(0.035, 0.78, fr); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.78, 0.86), 0.55 * fr); }"); };
  const root = new THREE.Group(); scene.add(root);
  const add = (geo, mat, x, y, z, shadow = true, parent = root) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m; };
  const box = (w, h, d, mat, x, y, z, r = 0.008, parent = root) => add(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2.01, h / 2.01, d / 2.01)), mat, x, y, z, true, parent);
  const cyl = (r1, r2, h, mat, x, y, z, seg = 28, parent = root) => add(new THREE.CylinderGeometry(r1, r2, h, seg), mat, x, y, z, true, parent);

  // ---------- room ----------
  add(new THREE.PlaneGeometry(7, 6), M.floor, 0, 0, 0.6, false).rotation.x = -Math.PI / 2;
  add(new THREE.PlaneGeometry(7, 3), M.wall, 0, 1.5, -0.75, false); const lw = add(new THREE.PlaneGeometry(6, 3), M.wall, -3.2, 1.5, 0.6, false); lw.rotation.y = Math.PI / 2; const rw = add(new THREE.PlaneGeometry(6, 3), M.wall, 3.2, 1.5, 0.6, false); rw.rotation.y = -Math.PI / 2;
  box(7, 0.09, 0.02, M.white, 0, 0.045, -0.74, 0.004);
  // window with an evening sky, frame and curtains
  const sky = canvasTex(256, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#27406e"); gr.addColorStop(0.6, "#7d6fa3"); gr.addColorStop(1, "#f0a56b"); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = "#1c2433"; const r = rnd(5); let x = 0; while (x < w) { const bw = 14 + r() * 30, bh = 20 + r() * 50; g.fillRect(x, h - bh, bw, bh); x += bw; } g.fillStyle = "#ffd98a"; for (let i = 0; i < 26; i++) g.fillRect(r() * w, h - 8 - r() * 45, 2, 3); });
  add(new THREE.PlaneGeometry(1.0, 1.1), std({ map: sky, emissive: "#ffffff", emissiveMap: sky, emissiveIntensity: 0.45, roughness: 0.4 }), -1.15, 1.75, -0.745, false);
  for (const [w, h, x, y] of [[1.1, 0.05, -1.15, 2.32], [1.1, 0.05, -1.15, 1.18], [0.05, 1.19, -1.68, 1.75], [0.05, 1.19, -0.62, 1.75], [0.03, 1.1, -1.15, 1.75], [1.0, 0.03, -1.15, 1.75]]) box(w, h, 0.04, M.white, x, y, -0.73, 0.006);
  const curt = std({ color: "#6f86a8", roughness: 0.95, side: THREE.DoubleSide }); for (const x of [-1.82, -0.48]) { const c = add(new THREE.PlaneGeometry(0.34, 1.35, 12, 1), curt, x, 1.72, -0.7, false); const p = c.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, 0.025 * Math.sin(p.getX(i) * 60)); c.geometry.computeVertexNormals(); }
  cyl(0.012, 0.012, 1.7, M.steel, -1.15, 2.42, -0.69, 10).rotation.z = Math.PI / 2;
  // wall shelf with books, and a cork board
  box(1.1, 0.03, 0.2, M.desk, 1.25, 1.75, -0.64, 0.006); { const r = rnd(12), cols = ["#b8443a", "#3d6a9e", "#d9a13b", "#4c8c5a", "#7a5ea8", "#30323a", "#d7d2c4"]; let x = 0.78; for (let i = 0; i < 11; i++) { const w = 0.025 + r() * 0.03, h = 0.17 + r() * 0.08; box(w, h, 0.14, std({ color: cols[i % cols.length], roughness: 0.75 }), x + w / 2, 1.765 + h / 2, -0.64, 0.003).rotation.z = i === 10 ? -0.25 : 0; x += w + 0.004; } }
  const cork = canvasTex(256, 200, (g, w, h) => { g.fillStyle = "#c69a62"; g.fillRect(0, 0, w, h); const r = rnd(2); for (let i = 0; i < 1500; i++) { g.fillStyle = r() > 0.5 ? "#b3854f" : "#d6ae78"; g.fillRect(r() * w, r() * h, 2, 2); } const notes = [["#fff59a", 20, 22], ["#bfe3ff", 96, 30], ["#ffd0d6", 170, 18], ["#d9f7c4", 60, 110], ["#ffffff", 150, 104]]; for (const [c, x, y] of notes) { g.fillStyle = c; g.fillRect(x, y, 62, 62); g.fillStyle = "rgba(0,0,0,.35)"; for (let k = 0; k < 4; k++) g.fillRect(x + 8, y + 14 + k * 11, 30 + 14 * r(), 2); g.fillStyle = "#c5050c"; g.beginPath(); g.arc(x + 31, y + 6, 4, 0, 6.3); g.fill(); } });
  box(0.86, 0.66, 0.025, M.desk, 0.15, 1.72, -0.735, 0.006); add(new THREE.PlaneGeometry(0.8, 0.6), std({ map: cork, roughness: 0.9 }), 0.15, 1.72, -0.72, false);

  // ---------- desk ----------
  const DY = 0.75; box(1.9, 0.035, 0.78, M.desk, 0, DY - 0.0175, -0.25, 0.01); for (const [x, z] of [[-0.9, -0.59], [0.9, -0.59], [-0.9, 0.09], [0.9, 0.09]]) box(0.05, DY - 0.035, 0.05, M.white, x, (DY - 0.035) / 2, z, 0.006); box(0.5, 0.36, 0.7, M.white, 0.66, DY - 0.22, -0.25, 0.008); for (const y of [DY - 0.13, DY - 0.31]) box(0.44, 0.15, 0.012, M.desk, 0.66, y, 0.106, 0.004);

  // ---------- the lamp ----------
  const LX = 0, LZ = -0.28, BH = 0.115, GH = 0.28, CH = 0.055, GY = DY + BH;                // base height, globe height, cap height
  const lamp = new THREE.Group(); lamp.position.set(LX, DY, LZ); root.add(lamp);
  // classic silhouette: hourglass base of spun metal, tall tapered globe, pointed cap
  const baseM = add(new THREE.LatheGeometry([[0.001, 0], [0.064, 0], [0.066, 0.006], [0.058, 0.02], [0.03, 0.07], [0.029, 0.078], [0.044, BH - 0.004], [0.046, BH], [0.001, BH]].map(p => new THREE.Vector2(p[0], p[1])), 56), M.alu, 0, 0, 0, true, lamp);
  // inside radius of the globe at height u = 0..1
  const gr = u => u < 0.07 ? 0.036 + 0.014 * Math.sin(Math.PI / 2 * u / 0.07) : 0.050 - 0.027 * (u - 0.07) / 0.93;   // straight taper, as on the real lamp filmed by the user
  // The glass and the liquid stop just inside the cap rim (UC). The cap tapers faster than the globe, so anything drawn higher would poke out through its side.
  const UC = 0.735, gprof = []; for (let i = 0; i <= 28; i++) { const u = UC * i / 28; gprof.push(new THREE.Vector2(gr(u) + 0.003, u * GH)); }
  const glass = add(new THREE.LatheGeometry(gprof, 48), M.glass, 0, BH, 0, false, lamp); glass.renderOrder = 5;
  const capM = add(new THREE.LatheGeometry([[gr(0.7) + 0.004, 0], [gr(0.7) + 0.0045, 0.004], [0.0165, 0.118], [0.0155, 0.122], [0.001, 0.122]].map(p => new THREE.Vector2(p[0], p[1])), 48), M.alu, 0, BH + GH * 0.7, 0, true, lamp);   // the cap covers the top third of the glass
  for (const [u, rr] of [[0.012, 0.0016], [0.7, 0.0012]]) { const ring = add(new THREE.TorusGeometry(gr(u) + 0.0032, rr, 8, 64), M.alu, 0, BH + u * GH, 0, false, lamp); ring.rotation.x = Math.PI / 2; }
  { const hl = [], n = 24; for (let i = 0; i <= n; i++) { const u = 0.06 + 0.6 * i / n; hl.push(new THREE.Vector3(-(gr(u) + 0.0034) * 0.62, u * GH, (gr(u) + 0.0034) * 0.785)); }
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hl), 32, 0.0016, 6), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.55, depthWrite: false }), 0, BH, 0, false, lamp).renderOrder = 6; }
  // liquid: slightly smaller lathe, tinted, lit from below
  const lprof = []; for (let i = 0; i <= 28; i++) { const u = (UC - 0.01) * i / 28; lprof.push(new THREE.Vector2(Math.max(0.001, gr(u)), u * GH)); } lprof.unshift(new THREE.Vector2(0.001, 0)); lprof.push(new THREE.Vector2(0.001, GH * (UC - 0.01)));
  { const lid = add(new THREE.CircleGeometry(gr(UC) + 0.0034, 40), new THREE.MeshBasicMaterial({ color: "#1a1c1f", side: THREE.DoubleSide }), 0, BH + GH * UC, 0, false, lamp); lid.rotation.x = -Math.PI / 2; }   // dark underside of the cap, so nothing shows through it from below
  const liqMat = phys({ color: "#e6eeff", roughness: 0.05, transparent: true, opacity: 0.2, emissive: "#e6eeff", emissiveIntensity: 0.25, depthWrite: false, side: THREE.DoubleSide });
  const liquid = add(new THREE.LatheGeometry(lprof, 48), liqMat, 0, BH + 0.002, 0, false, lamp); liquid.renderOrder = 3;
  const marble = m => { m.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vWaxP;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvWaxP = position;");
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vWaxP;").replace("#include <color_fragment>", "#include <color_fragment>\n{ vec3 q = vWaxP * 9.0; float n = sin(q.y * 2.3 + 2.2 * sin(q.x * 1.9 + q.z * 1.3) + 1.4 * sin(q.z * 2.7 - q.y * 0.8)); n = 0.5 + 0.5 * n; float f2 = 0.5 + 0.5 * sin(q.x * 11.0 + 3.0 * sin(q.y * 7.0)) * sin(q.z * 9.0 + q.y * 5.0); diffuseColor.rgb *= (0.6 + 0.8 * n * n) * (0.9 + 0.2 * f2); }"); }; return m; };
  const waxMat = marble(phys({ color: "#7a3fe0", roughness: 0.28, clearcoat: 0.3, clearcoatRoughness: 0.3, envMapIntensity: 0.25, emissive: "#7a3fe0", emissiveIntensity: 0.9 })), waxCold = marble(phys({ color: "#5c35a6", roughness: 0.8, emissive: "#20202a", emissiveIntensity: 0.2 }));
  // the bulb shining up through the bottom of the globe: a bright plate that the bloom pass turns into the white glow seen on the real lamp
  const plate = add(new THREE.CircleGeometry(0.034, 32), std({ color: "#ffffff", emissive: "#ffffff", emissiveIntensity: 2.2 }), 0, BH + 0.004, 0, false, lamp); plate.rotation.x = -Math.PI / 2;
  const pool = add(new THREE.SphereGeometry(1, 32, 20), waxMat, 0, BH + 0.012, 0, false, lamp), topPool = add(new THREE.SphereGeometry(1, 32, 20), waxMat, 0, BH + GH * 0.93, 0, false, lamp);
  const blobs = Array.from({ length: NBLOB }, () => add(new THREE.SphereGeometry(1, 28, 20), waxMat, 0, BH + 0.05, 0, false, lamp));
  // smooth wax: one continuous surface (marching cubes over a sum of soft balls), so blobs neck, pinch off and merge instead of popping.
  // Phones keep the simple spheres.
  let mc = null; const SC = GH / 2 + 0.012, ISO = 80, SUB = 12, ballS = r => (ISO + SUB) * (r / (2 * SC)) ** 2;
  if (!phone) try { mc = new MarchingCubes(84, waxMat, false, true, 180000); waxMat.vertexColors = true; waxCold.vertexColors = true; mc.isolation = ISO; mc.scale.setScalar(SC); mc.position.set(0, BH + GH / 2, 0); mc.frustumCulled = false; mc.renderOrder = 2; lamp.add(mc); blobs.forEach(b => { b.visible = false; }); pool.visible = false; topPool.visible = false; } catch (e) { mc = null; }
  const bpos = []; let focusI = -1;
  // Gaussian blobs: each ball adds a smooth bell-shaped bump to the field, so surfaces, necks and merges come out rounder than with the
  // library's 1/d^2 balls. The surface of a lone ball still sits at radius r.
  function gball(c, r, col) { const N = mc.size, ru = r / (2 * SC), sig = ru / 1.1, A = ISO * Math.exp(ru * ru / (2 * sig * sig)), R3 = 3.2 * sig, R32 = R3 * R3, f = mc.field, pal = mc.palette, i2 = 1 / (2 * sig * sig);
    const x0 = Math.max(1, Math.floor((c[0] - R3) * N)), x1 = Math.min(N - 2, Math.ceil((c[0] + R3) * N)), y0 = Math.max(1, Math.floor((c[1] - R3) * N)), y1 = Math.min(N - 2, Math.ceil((c[1] + R3) * N)), z0 = Math.max(1, Math.floor((c[2] - R3) * N)), z1 = Math.min(N - 2, Math.ceil((c[2] + R3) * N));
    for (let z = z0; z <= z1; z++) { const dz = z / N - c[2], zo = z * N * N; for (let y = y0; y <= y1; y++) { const dy = y / N - c[1], yo = zo + y * N; for (let x = x0; x <= x1; x++) { const dx = x / N - c[0], d2 = dx * dx + dy * dy + dz * dz; if (d2 > R32) continue; const w = Math.exp(-d2 * i2), id = yo + x; f[id] += A * w;
          if (pal) { const q = d2 / R32, cw = 1 - q * q * q; pal[id * 3] += col.r * cw; pal[id * 3 + 1] += col.g * cw; pal[id * 3 + 2] += col.b * cw; } } } } }
  const sm = Array.from({ length: NBLOB }, () => ({ u: 0, v: 0, init: false })), smP = { pool: 1, top: 0 };
  // droplets after a shake: up to NP small spheres stand for the (many more) droplets of the model
  const NP = phone ? 220 : 520, dropMat = std({ color: "#7a3fe0", roughness: 0.4, emissive: "#7a3fe0", emissiveIntensity: 0.5 }), drops = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 18, 14), dropMat, NP); drops.frustumCulled = false; drops.count = 0; drops.renderOrder = 2; lamp.add(drops);
  const dr = rnd(404), DP = Array.from({ length: NP }, () => ({ u: dr(), a: dr() * 6.283, rf: Math.sqrt(dr()), ph: dr() * 6.283, sp: 0.5 + dr() })), dO = new THREE.Object3D(), liqBase = { col: new THREE.Color(), op: 0.1, em: new THREE.Color() }, waxCol = new THREE.Color("#7a3fe0");
  const VD = { on: false, list: [], ref: 0, lastN: 0 };
  const coil = add(new THREE.TorusGeometry(0.022, 0.002, 6, 24), M.steel, 0, BH + 0.006, 0, false, lamp); coil.rotation.x = Math.PI / 2;
  const bulb = new THREE.PointLight("#f2f5ff", 0.6, 1.6, 2); bulb.position.set(0, BH + 0.03, 0); lamp.add(bulb);
  const glow = new THREE.PointLight("#9a7bff", 0.5, 1.2, 2); glow.position.set(0, BH + GH * 0.5, 0.09); lamp.add(glow);
  // cord and plug switch
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(LX - 0.05, DY + 0.01, LZ - 0.03), V3(LX - 0.2, DY + 0.004, LZ - 0.12), V3(LX - 0.45, DY + 0.004, LZ - 0.2), V3(LX - 0.6, DY + 0.004, LZ - 0.33)]), 30, 0.003, 6), M.rubber, 0, 0, 0);
  box(0.05, 0.016, 0.022, M.white, LX - 0.32, DY + 0.008, LZ - 0.16, 0.004).rotation.y = 0.4;

  // ---------- ruler stand behind the lamp (to time a blob over a marked height) ----------
  const rulerT = canvasTex(64, 512, (g, w, h) => { g.fillStyle = "#f6e9a8"; g.fillRect(0, 0, w, h); g.fillStyle = "#3a3320"; for (let i = 0; i <= 30; i++) { const y = h - 6 - i * (h - 12) / 30; g.fillRect(0, y, i % 5 ? 14 : 26, i % 5 ? 1.5 : 2.5); if (i % 5 === 0) { g.font = "600 15px Arial"; g.fillText(String(i), 32, y + 5); } } });
  box(0.035, 0.31, 0.004, std({ map: rulerT, roughness: 0.6 }), LX + 0.105, DY + BH + 0.15, LZ - 0.02, 0.001); box(0.06, 0.012, 0.05, M.dark, LX + 0.105, DY + 0.006, LZ - 0.02, 0.003); box(0.008, BH, 0.008, M.dark, LX + 0.105, DY + BH / 2, LZ - 0.026, 0.002);

  // ---------- room thermometer, phone timer, notebook, fan, mug ----------
  const thC = document.createElement("canvas"); thC.width = 256; thC.height = 160; const thT = new THREE.CanvasTexture(thC); thT.colorSpace = THREE.SRGBColorSpace;
  const TXp = -0.25; const tbody = box(0.1, 0.075, 0.03, M.white, TXp, DY + 0.045, -0.18, 0.01); tbody.rotation.x = -0.3; const tface = add(new THREE.PlaneGeometry(0.082, 0.05), std({ map: thT, emissive: "#ffffff", emissiveMap: thT, emissiveIntensity: 0.3, roughness: 0.4 }), TXp, DY + 0.049, -0.1635, false); tface.rotation.x = -0.3; box(0.05, 0.01, 0.045, M.white, TXp, DY + 0.005, -0.2, 0.003);
  const phC = document.createElement("canvas"); phC.width = 256; phC.height = 512; const phT = new THREE.CanvasTexture(phC); phT.colorSpace = THREE.SRGBColorSpace;
  // (the phone timer and the fan were removed at the user's request: the scene is about the lamp)
  const nb = new THREE.Group(); nb.position.set(-0.03, DY, -0.07); nb.scale.setScalar(0.8); nb.rotation.y = -0.25; root.add(nb); box(0.2, 0.012, 0.27, std({ color: "#c5050c", roughness: 0.7 }), 0, 0.006, 0, 0.004, nb);
  const noteC = document.createElement("canvas"); noteC.width = 256; noteC.height = 340; const noteT = new THREE.CanvasTexture(noteC); noteT.colorSpace = THREE.SRGBColorSpace; const pg = add(new THREE.PlaneGeometry(0.19, 0.255), std({ map: noteT, roughness: 0.85 }), 0, 0.0135, 0, false, nb); pg.rotation.x = -Math.PI / 2;
  const pen = cyl(0.004, 0.004, 0.14, std({ color: "#f2c230", roughness: 0.5 }), 0.1, DY + 0.006, -0.04, 8); pen.rotation.set(Math.PI / 2, 0, 1.2);
  cyl(0.036, 0.03, 0.085, std({ color: "#3d6a9e", roughness: 0.4 }), -0.42, DY + 0.043, -0.45, 24); add(new THREE.TorusGeometry(0.022, 0.006, 8, 16, Math.PI), std({ color: "#3d6a9e", roughness: 0.4 }), -0.457, DY + 0.045, -0.45).rotation.z = Math.PI / 2;

  const A = { base: V3(LX, DY + 0.07, LZ + 0.06), pool: V3(LX - 0.03, GY + 0.03, LZ + 0.04), blob: V3(LX + 0.02, GY + 0.14, LZ + 0.05), top: V3(LX, GY + 0.19, LZ + 0.04), glass: V3(LX - 0.062, GY + 0.16, LZ + 0.02),
    room: V3(TXp, DY + 0.1, -0.18), timer: V3(LX + 0.105, GY + 0.2, LZ - 0.015), notes: V3(-0.03, DY + 0.03, -0.1) };
  const VIEWS = { overview: { p: [0.05, 1.14, 0.62], c: [-0.01, 0.975, -0.26], fov: 34, fitW: phone ? 0.5 : 0.8 }, lamp: { p: [0.12, DY + 0.36, 0.5], c: [0.0, DY + 0.25, LZ], fov: 34, fitW: 0.52 }, base: { p: [0.1, DY + 0.2, 0.25], c: [0.0, DY + 0.1, LZ], fov: 34, fitW: 0.32 },
    top: { p: [0.1, DY + 0.5, 0.2], c: [0.0, DY + 0.36, LZ], fov: 34, fitW: 0.3 }, desk: { p: [0.05, DY + 0.55, 0.75], c: [0.0, DY + 0.08, -0.15], fov: 34, fitW: 1.1 } };

  const size = new THREE.Vector2(1, 1); let composer = null, bloom = null, tier = phone ? "low" : "high", ready = false; const frames = [];
  try { const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 }); composer = new EffectComposer(renderer, rt); composer.addPass(new RenderPass(scene, camera)); bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.05, 0.12, 1.6); composer.addPass(bloom); composer.addPass(new OutputPass()); composer.addPass(new SMAAPass(4, 4)); } catch (e) { composer = null; tier = "low"; }
  let tween = null, autoView = "overview"; controls.addEventListener("start", () => { autoView = null; });
  function viewPose(name) { const v = VIEWS[name] || VIEWS.overview, c = V3(...v.c), p = V3(...v.p), d = p.clone().sub(c), need = v.fitW / (2 * Math.tan(THREE.MathUtils.degToRad(v.fov / 2)) * camera.aspect); if (d.length() < need) d.setLength(Math.min(4.6, need)); return { p: c.clone().add(d), c }; }
  function goView(name, instant) { autoView = name; const to = viewPose(name); if (instant) { camera.position.copy(to.p); controls.target.copy(to.c); controls.update(); tween = null; return; } tween = { p0: camera.position.clone(), c0: controls.target.clone(), ...to, u: 0 }; }
  function resize() { const w = Math.max(2, stage.clientWidth), h = Math.max(2, stage.clientHeight); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); size.set(w, h); if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); } if (autoView && !tween && ready) goView(autoView, true); }
  // state: { blobs: [{ u (0..1 height), d (m), T }], regime, on, P, fan, glowK 0..1, poolK 0..1 (share of wax resting at the bottom), topK }
  function update(s, dt, t) {
    if (tween) { tween.u = Math.min(1, tween.u + dt / 0.9); const e = tween.u < 0.5 ? 2 * tween.u * tween.u : 1 - 2 * (1 - tween.u) ** 2; camera.position.lerpVectors(tween.p0, tween.p, e); controls.target.lerpVectors(tween.c0, tween.c, e); if (tween.u >= 1) tween = null; }
    controls.update();
    const warm = s.regime !== "cold" || s.melt > 0.05, mat = th ? thWax : warm ? waxMat : waxCold; pool.material = mat; let bc = WHITE;
    if (th) { // false colours from the model's temperatures
      const g = thC2.getContext("2d"), gd = g.createLinearGradient(0, 64, 0, 0); for (let k = 0; k <= 8; k++) gd.addColorStop(k / 8, "#" + tcol(s.Tb + (s.Tt - s.Tb) * Math.min(1, k / 8 / 0.7), cB).getHexString()); g.fillStyle = gd; g.fillRect(0, 0, 2, 64); thTex.needsUpdate = true;
      thAmb.color.copy(tcol(s.Tr, cB)); thBase.color.copy(tcol(s.Tb, cB)); thCap.color.copy(tcol(s.Tt, cB)); pool.material = thPool; thPool.color.copy(tcol(s.Tb, cB)); topPool.material = thTop; thTop.color.copy(tcol(s.Tt, cB)); }
    else topPool.material = mat;
    waxMat.emissiveIntensity = 0.12 + 0.5 * s.glowK; liqMat.emissiveIntensity = 0.02 * s.glowK; bulb.intensity = 0.08 * s.glowK; glow.intensity = 0.05 * s.glowK; plate.material.emissiveIntensity = 0.75 * Math.min(1.2, s.glowK); plate.visible = s.glowK > 0.02;
    // low-pass filter what is drawn (0.45 s) so motion and pool sizes change smoothly at any playback speed
    const kf = 1 - Math.exp(-dt / 0.45); smP.pool += (s.poolK - smP.pool) * kf; smP.top += (s.topK - smP.top) * kf;
    s.blobs.forEach((b, i) => { const q = sm[i]; if (!q.init) { q.u = b.u; q.init = true; } const u0 = q.u; q.u += (b.u - q.u) * kf; q.v += ((q.u - u0) / Math.max(dt, 1e-3) - q.v) * kf; });
    // shaken lamp: cloudy liquid full of droplets; the big blobs are gone until the wax has gathered again
    focusI = s.focus ?? -1;
    const sh = s.shake, cloud = sh ? sh.cloud : 0; liqMat.color.copy(liqBase.col).lerp(waxCol, 0.55 * cloud); liqMat.opacity = liqBase.op + (0.8 - liqBase.op) * cloud; liqMat.emissive.copy(liqBase.em).lerp(waxCol, 0.5 * cloud);
    // Droplets after a shake. Each drawn droplet is a real object: when the model says there are fewer droplets, two neighbours drift
    // together and become one bigger droplet (volumes add), so the coarsening is continuous to the eye. While the model has more droplets
    // than can be drawn, the drawn ones stand for the crowd and all grow at the model's typical size.
    const yTop2 = GH * 0.7; let fluid = null;
    if (sh) { if (!VD.on || sh.n > VD.lastN + 1) { VD.on = true; VD.ref = 0; VD.list = DP.map(q => ({ off: q.u - 0.5, u: 0.03 + 0.94 * q.u, a: q.a, rf: q.rf, ph: q.ph, sp: q.sp, vol: 1, alive: true, to: null, mt: 0 })); } VD.lastN = sh.n;
      const L = VD.list, want = Math.max(1, Math.min(NP, Math.round(sh.n))); let alive = 0, free = 0; for (const q of L) if (q.alive) { alive++; if (!q.to) free++; }
      if (sh.n > NP) VD.ref = sh.d; else if (!VD.ref) VD.ref = sh.d;
      const pos = q => { const rm = Math.max(0.0015, gr(q.u * 0.7) - 0.005); return [Math.cos(q.a) * rm * q.rf, q.u, Math.sin(q.a) * rm * q.rf]; };
      // start merges until the number of droplets that will remain matches the model (a limited number per frame)
      let budget = 24; while (free > want && budget-- > 0) { let i = Math.floor(Math.random() * L.length), tries = 0; while ((!L[i].alive || L[i].to) && tries++ < L.length) i = (i + 1) % L.length; const qi = L[i]; if (!qi.alive || qi.to) break;
        const pi = pos(qi); let best = null, bd = 1e9; for (const qj of L) { if (qj === qi || !qj.alive || qj.to) continue; const pj = pos(qj), d2 = (pi[0] - pj[0]) ** 2 + ((pi[1] - pj[1]) * yTop2) ** 2 + (pi[2] - pj[2]) ** 2; if (d2 < bd) { bd = d2; best = qj; } }
        if (!best) break; const small = qi.vol <= best.vol ? qi : best, big = small === qi ? best : qi; small.to = big; small.mt = 0; small.e = 0; small.v0 = small.vol; free--; }
      if (free > want + 60) for (const q of L) { if (free <= want + 60) break; if (q.alive && !q.to) { q.alive = false; free--; } }     // far behind (very fast playback): drop the surplus at once
      const rOf = q => sh.n > NP ? sh.d / 2 : VD.ref / 2 * Math.cbrt(Math.max(q.vol, 1e-4)); let rSum = 0; for (const q of L) if (q.alive) rSum += rOf(q);
      // once droplets are big enough for the grid, draw them all as one fluid surface, so two droplets touch, neck and fuse instead of popping
      // Where droplets go (from the model's own density law): a small droplet takes the temperature of the liquid around it, so it is lighter
      // than the liquid low in the globe (warmer than the matching temperature) and heavier high up. Droplets therefore gather around the
      // height where the liquid is at the matching temperature, and the bigger they are the faster they get there. Crowded together, they touch and fuse.
      const uStar = s.Tb <= s.Tx ? 0.04 : s.Tt >= s.Tx ? 0.96 : Math.min(0.96, Math.max(0.04, (s.Tb - s.Tx) / Math.max(0.1, s.Tb - s.Tt))), rMean = rSum / Math.max(1, alive), width = Math.min(1, Math.max(0.1, 1 - (rMean - 0.001) / 0.009));
      const useMC = !!mc && (alive <= 70 || (alive <= 340 && rSum / Math.max(1, alive) >= 0.0042)); let k = 0; fluid = useMC ? [] : null;
      for (const q of L) { if (!q.alive) continue; const big = Math.min(1, rOf(q) / 0.011);
        if (q.to) { // a merger takes about 2 s on screen: the pair drift together while wax flows steadily from the smaller droplet into the larger
          const g = q.to; if (!g.alive) { q.to = null; } else { q.mt += dt / 2.0; const m = Math.min(1, q.mt), e = m * m * (3 - 2 * m), give = q.v0 * (e - q.e); q.e = e; q.vol -= give; g.vol += give;
            const rate = Math.min(1, dt * 2.2 * (0.35 + 1.5 * m)), w = q.vol / (q.vol + g.vol + 1e-9); let da = g.a - q.a; da = Math.atan2(Math.sin(da), Math.cos(da));
            const du = g.u - q.u, drf = g.rf - q.rf; q.u += du * rate * (1 - w); q.a += da * rate * (1 - w); q.rf += drf * rate * (1 - w); g.u -= du * rate * w; g.a -= da * rate * w; g.rf -= drf * rate * w;
            if (m >= 1) { q.alive = false; continue; } } }
        else { q.a += 0.07 * q.sp * dt; const ut = Math.min(0.97, Math.max(0.03, uStar + q.off * 0.94 * width)); q.u = Math.min(0.97, Math.max(0.03, q.u + (ut - q.u) * Math.min(1, dt * 0.5) + dt * 0.01 * Math.sin(t * 0.33 * q.sp + q.ph))); void big; }
        const r = Math.min(rOf(q), gr(q.u * 0.7) - 0.004), P3 = pos(q), y = 0.012 + P3[1] * (yTop2 - 0.02);
        if (useMC) fluid.push([P3[0], y, P3[2], r]); else if (k < NP) { dO.position.set(P3[0], BH + y, P3[2]); dO.scale.setScalar(r); dO.updateMatrix(); drops.setMatrixAt(k++, dO.matrix); } }
      drops.count = useMC ? 0 : k; drops.material = th ? thPool : dropMat; dropMat.emissiveIntensity = 0.15 + 0.45 * s.glowK; drops.instanceMatrix.needsUpdate = true; sm.forEach(q => { q.init = false; }); }
    else { drops.count = 0; VD.on = false; }
    if (mc) { mc.material = mat; mc.reset(); const toU = (x, y, z) => [0.5 + x / (2 * SC), 0.5 + (y - GH / 2) / (2 * SC), 0.5 + z / (2 * SC)];
      bc = th ? tcol(s.Tb, cA) : WHITE; const rp = (0.02 + 0.016 * smP.pool) * (sh ? Math.max(0.15, Math.cbrt(Math.min(1, s.poolK))) : 1), pb = toU(0, 0.012 + rp * 0.3, 0); gball(pb, rp, bc);
      const yTop = GH * 0.7 + 0.004, rt = 0.012 + 0.012 * smP.top, pt = toU(0, yTop - rt * 0.2, 0); bc = th ? tcol(s.Tt, cA) : WHITE; if (smP.top > 0.02) gball(pt, Math.min(rt, gr(0.7) - 0.002), bc);
      s.blobs.forEach((b, i) => { const q = sm[i], uu = q.u * 0.72, rmax = gr(uu) - 0.004, wob = 1 + 0.07 * Math.sin(t * 0.9 + i * 2.1), r = Math.min(b.d * 0.72 * wob, rmax), a = i * 2.4 + t * 0.1, edge = Math.min(1, q.u / 0.15, (1 - q.u) / 0.15), off = Math.max(0, rmax - r) * 0.6 * Math.max(0, edge);
        bc = th ? tcol(b.T ?? s.Tb, cA) : WHITE; const y = 0.014 + q.u * (yTop - 0.02), x = Math.cos(a) * off, z = Math.sin(a) * off, c = toU(x, y, z); bpos[i] = { x, y: BH + y, z, r, u: q.u }; gball(c, r, bc);
        const c1 = toU(x + r * 0.45 * Math.sin(t * 0.7 + i), y + r * 0.55 * Math.cos(t * 0.5 + i * 1.7), z + r * 0.4 * Math.cos(t * 0.6 + i)); gball(c1, r * 0.62, bc);   // a second lobe: lumpy, slowly changing shapes
        // a strand of wax back to where the blob came from, thinning until it pinches off
        const up = q.v >= 0, prog = up ? q.u : 1 - q.u; if (prog > 0.02 && prog < 0.55 && Math.abs(q.v) > 0.002) { const y0 = up ? 0.02 : yTop - 0.01, thin = 1 - prog / 0.55; for (let k = 1; k <= 4; k++) { const f = k / 5, yy = y + (y0 - y) * f, cc = toU(x * (1 - f), yy, z * (1 - f)); gball(cc, Math.min(r * (0.55 - 0.07 * k) * (0.35 + 0.65 * thin), gr(Math.max(0, yy / GH)) - 0.004), bc); } } });
      if (fluid) { bc = th ? tcol((s.Tb + s.Tt) / 2, cA) : WHITE; for (const d of fluid) gball(toU(d[0], d[1], d[2]), d[3], bc); }
      // keep the wax inside the glass: where blobs gather, their fields add and the surface would swell through the wall and the cap.
      // The field is faded to zero over two cells just inside the inner wall, and above the cap rim.
      { const N = mc.size, f = mc.field, w = 2 / N, k = 2 * SC;
        for (let y = 1; y < N - 1; y++) { const u = ((y / N - 0.5) * k + GH / 2) / GH, top = u > UC ? 0 : 1, rm = Math.max(0, gr(Math.min(1, Math.max(0, u))) - 0.0012) / k, r0 = Math.max(0, rm - w), r02 = r0 * r0;
          for (let z = 1; z < N - 1; z++) { const dz = z / N - 0.5, zo = z * N * N + y * N; for (let x = 1; x < N - 1; x++) { const id = zo + x; if (f[id] <= 0) continue; if (!top) { f[id] = 0; continue; } const dx = x / N - 0.5, d2 = dx * dx + dz * dz; if (d2 <= r02) continue; const r = Math.sqrt(d2); f[id] *= r >= rm ? 0 : (rm - r) / w; } } } }
      mc.update(); }
    else { const pr = 0.024 + 0.014 * smP.pool; pool.scale.set(pr, 0.012 + 0.018 * smP.pool, pr); pool.position.y = BH + 0.008 + pool.scale.y * 0.6;
      const tr = 0.01 + 0.011 * smP.top; topPool.visible = smP.top > 0.02; topPool.scale.set(tr, 0.006 + 0.022 * smP.top, tr); topPool.position.y = BH + GH * 0.945 - topPool.scale.y * 0.7;
      s.blobs.forEach((b, i) => { const m = blobs[i], q = sm[i]; if (!m) return; if (th) { if (!m.userData.th) m.userData.th = new THREE.MeshBasicMaterial(); m.material = m.userData.th; m.material.color.copy(tcol(b.T ?? s.Tb, cB)); } else m.material = mat; const fade = Math.min(1, q.u / 0.08, (1 - q.u) / 0.08); m.visible = fade > 0.02; if (!m.visible) return; const rmax = gr(q.u) - 0.006, r = Math.min(b.d / 2, rmax) * Math.min(1, 0.4 + 0.6 * fade), a = i * 2.4 + t * 0.15, off = Math.max(0, rmax - r) * 0.55;
        m.position.set(Math.cos(a) * off, BH + 0.01 + q.u * GH * 0.93, Math.sin(a) * off); bpos[i] = { x: m.position.x, y: m.position.y, z: m.position.z, r, u: q.u }; const st = 1 + Math.min(0.3, Math.abs(q.v) * 5); m.scale.set(r / Math.sqrt(st), r * st, r / Math.sqrt(st)); }); }
  }
  function render(dt) { if (bloom) bloom.enabled = !th; if (composer && tier !== "low") composer.render(dt); else renderer.render(scene, camera);
    frames.push(dt * 1000); if (frames.length > 120) frames.shift(); if (frames.length === 120) { const avg = frames.reduce((a, b) => a + b, 0) / 120; if (avg > 34 && tier === "high") { tier = "low"; frames.length = 0; } } }
  // ---------- blob view: a second, close-up camera on one blob, drawn in its own pane beside the lamp ----------
  let r2 = null, cam2 = null, env2 = null; const fT = V3(LX, DY + BH + 0.05, LZ), fP = V3(LX + 0.03, DY + BH + 0.07, LZ + 0.12), wantT = V3(), wantP = V3(), fInfo = { x: 0, y: 0, rpx: 0, r: 0.0125, ok: false };
  if (blobStage) try { r2 = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); r2.outputColorSpace = THREE.SRGBColorSpace; r2.toneMapping = THREE.ACESFilmicToneMapping; r2.toneMappingExposure = 0.9; r2.setPixelRatio(Math.min(devicePixelRatio, 1.5)); blobStage.prepend(r2.domElement); cam2 = new THREE.PerspectiveCamera(40, 1, 0.002, 8); env2 = new THREE.PMREMGenerator(r2).fromScene(new RoomEnvironment(), 0.03).texture; } catch (e) { r2 = null; }
  function resizeBlob() { if (!r2) return; const w = Math.max(2, blobStage.clientWidth), h = Math.max(2, blobStage.clientHeight); r2.setSize(w, h, false); cam2.aspect = w / h; cam2.updateProjectionMatrix(); }
  function renderBlob(dt) { const b = bpos[focusI], has = focusI >= 0 && b, r = has ? b.r : 0.02;
    const rest = has && (b.u < 0.08 || b.u > 0.92);      // a blob resting inside the pool or the top mass: step back and look at that surface instead
    if (has && !rest) wantT.set(LX + b.x, DY + b.y, LZ + b.z); else if (has && b.u <= 0.5) wantT.set(LX, DY + BH + 0.035, LZ); else if (has) wantT.set(LX, DY + BH + GH * 0.66, LZ); else wantT.set(LX, DY + BH + GH * 0.3, LZ);
    const dist = rest ? 0.2 : has ? r * 8 + 0.045 : 0.2; wantP.copy(wantT).add(V3(0.3, 0.1, 1).normalize().multiplyScalar(dist)); const k = 1 - Math.exp(-dt / 0.25); fT.lerp(wantT, k); fP.lerp(wantP, k);
    fInfo.ok = !!has; fInfo.r = r; const c = project(wantT); fInfo.x = c.x; fInfo.y = c.y; pv2.copy(wantT).add(V3(0, r * 1.25, 0)); const c2 = project(pv2); fInfo.rpx = Math.abs(c2.y - c.y);
    if (!r2) return; cam2.position.copy(fP); cam2.lookAt(fT); const e1 = scene.environment; scene.environment = env2; r2.render(scene, cam2); scene.environment = e1; }   // each renderer needs its own reflection map
  const pv2 = new THREE.Vector3();
  const pv = new THREE.Vector3(); function project(v) { pv.copy(v).project(camera); return { x: (pv.x * 0.5 + 0.5) * size.x, y: (-pv.y * 0.5 + 0.5) * size.y, behind: pv.z > 1 }; }
  ready = true; resize(); resizeBlob(); goView("overview", true);
  // ---------- thermal view: false colour by temperature (an "iron" palette), 15 to 65 °C ----------
  const TLO = 15, THI = 65, STOPS = [[0, "#0b0726"], [0.16, "#3b0f70"], [0.34, "#8c2981"], [0.52, "#de4968"], [0.7, "#fe9f6d"], [0.86, "#fde68a"], [1, "#ffffff"]].map(([u, c]) => [u, new THREE.Color(c)]);
  const cA = new THREE.Color(), cB = new THREE.Color(), WHITE = new THREE.Color("#ffffff");
  function tcol(T, out) { const u = Math.min(1, Math.max(0, (T - TLO) / (THI - TLO))); let k = 1; while (k < STOPS.length - 1 && STOPS[k][0] < u) k++; const a = STOPS[k - 1], b = STOPS[k]; return out.copy(a[1]).lerp(b[1], (u - a[0]) / (b[0] - a[0])); }
  const thC2 = document.createElement("canvas"); thC2.width = 2; thC2.height = 64; const thTex = new THREE.CanvasTexture(thC2); thTex.colorSpace = THREE.SRGBColorSpace;
  const thAmb = std({ roughness: 1, metalness: 0 }), thBase = std({ roughness: 1 }), thCap = std({ roughness: 1 }), thLiq = new THREE.MeshBasicMaterial({ map: thTex, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }), thWax = new THREE.MeshBasicMaterial({ vertexColors: !!mc }), thPool = new THREE.MeshBasicMaterial(), thTop = new THREE.MeshBasicMaterial();
  let th = false; const keep = new Map(), bg0 = scene.background.clone();
  function setThermal(on) { th = !!on; scene.background.set(th ? "#0b0726" : bg0);
    root.traverse(o => { if (!o.isMesh || o === mc || o === drops || blobs.includes(o) || o === pool || o === topPool) return; if (th) { if (!keep.has(o)) keep.set(o, o.material); o.material = o === liquid ? thLiq : o === baseM ? thBase : o === capM ? thCap : thAmb; if (o === glass || o === plate) o.visible = false; } else if (keep.has(o)) { o.material = keep.get(o); if (o === glass) o.visible = true; } });
    scene.environmentIntensity = th ? 0.9 : 0.4; }
  const glowCol = new THREE.Color();
  function setColors(wax, liq) { waxMat.color.set(wax).multiplyScalar(0.55); waxMat.emissive.set(wax).multiplyScalar(0.8); waxCold.color.set(wax).multiplyScalar(0.8); waxCol.set(wax); dropMat.color.set(wax).multiplyScalar(0.6); dropMat.emissive.set(wax).multiplyScalar(0.8); liqMat.color.set(liq); liqMat.emissive.set(liq); { const c = new THREE.Color(liq), chroma = Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b); liqMat.opacity = 0.025 + 0.5 * chroma; liqMat.emissive.multiplyScalar(0.3 + 0.7 * chroma); liqBase.col.copy(liqMat.color); liqBase.op = liqMat.opacity; liqBase.em.copy(liqMat.emissive); } /* clear liquids stay clear, strong colours show */ glowCol.set(liq).lerp(new THREE.Color(wax), 0.5); glow.color.copy(glowCol); bulb.color.set(liq).lerp(new THREE.Color("#ffffff"), 0.6); }
  setColors("#7a3fe0", "#e6eeff");
  return { renderer, camera, controls, A, VIEWS, update, render, resize, goView, project, GH, setColors, setThermal, shakeDrops: () => VD.list.filter(q => q.alive).map(q => ({ u: q.u, vol: q.vol })).sort((p, q) => q.vol - p.vol), renderBlob, resizeBlob, focusInfo: () => fInfo, thermalRange: [TLO, THI], thermalStops: STOPS.map(([u, c]) => [u, "#" + c.getHexString()]), screens: { thermo: { canvas: thC, tex: thT }, phone: { canvas: phC, tex: phT }, notes: { canvas: noteC, tex: noteT } } };
}
