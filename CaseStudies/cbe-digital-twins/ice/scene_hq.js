// High-quality scene helpers for the Lake Mendota Ice Digital Twin (Part H):
// procedural textures, sky + image-based lighting, post-processing with a quality tier,
// and builders for shanties, anglers, trees, ice chips, snow sparkle and the Madison skyline.
import * as THREE from "three";
import { Sky } from "three/addons/objects/Sky.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export const rngFrom = seed => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };

// ---------- procedural textures ----------
function canvasTex(w, h, draw, { srgb = true, repeat = [1, 1] } = {}) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 8; return t;
}
// normal map from a height field drawn into a canvas (red channel = height)
export function normalFromHeight(w, h, drawHeight, strength = 2, repeat = [1, 1]) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d");
  drawHeight(g, w, h);
  const src = g.getImageData(0, 0, w, h).data, out = g.createImageData(w, h), d = out.data;
  const H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength;
    const n = new THREE.Vector3(-dx, -dy, 1).normalize(), i = (y * w + x) * 4;
    d[i] = (n.x * 0.5 + 0.5) * 255; d[i + 1] = (n.y * 0.5 + 0.5) * 255; d[i + 2] = (n.z * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  g.putImageData(out, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 8; return t;
}
function blobs(g, w, h, n, rMin, rMax, seed, alpha = 0.15, light = true) {
  const r = rngFrom(seed);
  for (let i = 0; i < n; i++) {
    const x = r() * w, y = r() * h, rad = rMin + r() * (rMax - rMin), a = alpha * (0.4 + r());
    for (const [ox, oy] of [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h]]) {
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
      const col = light ? (r() < 0.5 ? 255 : 0) : 0;
      gr.addColorStop(0, `rgba(${col},${col},${col},${a})`); gr.addColorStop(1, `rgba(${col},${col},${col},0)`);
      g.fillStyle = gr; g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
    }
  }
}
export function snowMaps(repeat) {
  const map = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = "#f3f6f9"; g.fillRect(0, 0, w, h);
    const r = rngFrom(5);
    for (let i = 0; i < 700; i++) { const x = r() * w, y = r() * h, rad = 10 + r() * 60, tone = r() < 0.55 ? "214,224,236" : "255,255,255";
      const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(${tone},${0.05 + r() * 0.07})`); gr.addColorStop(1, `rgba(${tone},0)`); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
  }, { repeat });
  const normal = normalFromHeight(256, 256, (g, w, h) => {
    g.fillStyle = "#808080"; g.fillRect(0, 0, w, h); blobs(g, w, h, 420, 2, 18, 9, 0.18);
    const r = rngFrom(13); for (let i = 0; i < 60; i++) { g.strokeStyle = `rgba(255,255,255,${0.08 + r() * 0.1})`; g.lineWidth = 2 + r() * 4; const y = r() * h, x = r() * w; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 30, y - 8, x + 60, y + 8, x + 110, y); g.stroke(); }
  }, 2.2, repeat);
  const rough = canvasTex(128, 128, (g, w, h) => { g.fillStyle = "#e6e6e6"; g.fillRect(0, 0, w, h); blobs(g, w, h, 80, 4, 20, 21, 0.2); }, { srgb: false, repeat });
  return { map, normal, rough };
}
export function blackIceMaps(repeat) {
  const map = canvasTex(1024, 1024, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, "#28485a"); gr.addColorStop(1, "#1d3a4c"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const r = rngFrom(17);
    for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(235,245,255,${0.08 + r() * 0.35})`; g.beginPath(); g.ellipse(r() * w, r() * h, 0.6 + r() * 2.6, 0.6 + r() * 2.2, r() * 3, 0, 7); g.fill(); }
    for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(225,240,250,${0.15 + r() * 0.35})`; g.lineWidth = 0.6 + r() * 1.4; g.beginPath(); let x = r() * w, y = r() * h; g.moveTo(x, y);
      for (let k = 0; k < 7; k++) { x += (r() - 0.5) * 140; y += (r() - 0.5) * 140; g.lineTo(x, y); } g.stroke(); }
    blobs(g, w, h, 60, 40, 160, 23, 0.06);
  }, { repeat });
  const normal = normalFromHeight(512, 512, (g, w, h) => {
    g.fillStyle = "#808080"; g.fillRect(0, 0, w, h); const r = rngFrom(17);
    for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(30,30,30,${0.4})`; g.lineWidth = 1 + r() * 2; g.beginPath(); let x = r() * w, y = r() * h; g.moveTo(x, y); for (let k = 0; k < 7; k++) { x += (r() - 0.5) * 70; y += (r() - 0.5) * 70; g.lineTo(x, y); } g.stroke(); }
    blobs(g, w, h, 40, 30, 90, 31, 0.08);
  }, 3, repeat);
  return { map, normal };
}
// the cut face as real ice: clear dark ice with columnar bubble streaks, a white snow-ice band near the top
export function iceFaceTexture() {
  return canvasTex(512, 1024, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#5f8ea6"); gr.addColorStop(0.08, "#3d6c86"); gr.addColorStop(1, "#1e4560");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const r = rngFrom(41);
    for (let i = 0; i < 520; i++) { const x = r() * w, y0 = r() * h * 0.95, len = 20 + r() * 160; const a = 0.06 + r() * 0.22 * (1 - y0 / h);
      g.strokeStyle = `rgba(230,244,252,${a})`; g.lineWidth = 0.6 + r() * 1.6; g.beginPath(); g.moveTo(x, y0); g.lineTo(x + (r() - 0.5) * 6, y0 + len); g.stroke(); }
    for (let i = 0; i < 2200; i++) { const y = Math.pow(r(), 1.6) * h; g.fillStyle = `rgba(245,250,255,${0.12 + r() * 0.5})`; g.beginPath(); g.ellipse(r() * w, y, 0.7 + r() * 1.6, 1 + r() * 3.5, 0, 0, 7); g.fill(); }
    const top = g.createLinearGradient(0, 0, 0, h * 0.05); top.addColorStop(0, "rgba(255,255,255,0.85)"); top.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = top; g.fillRect(0, 0, w, h * 0.05);
    for (let k = 1; k < 6; k++) { g.fillStyle = "rgba(255,255,255,0.05)"; g.fillRect(0, h * (0.12 + k * 0.15), w, 2); }
  }, { repeat: [24, 1] });
}
export function plankTexture(seed) {
  return canvasTex(512, 512, (g, w, h) => {
    const r = rngFrom(seed); const n = 8, pw = w / n;
    for (let i = 0; i < n; i++) {
      const v = 200 + r() * 40; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(i * pw, 0, pw, h);
      for (let k = 0; k < 40; k++) { g.strokeStyle = `rgba(80,70,60,${0.05 + r() * 0.12})`; g.lineWidth = 0.6 + r() * 1.2; const x = i * pw + r() * pw; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + (r() - 0.5) * 8, h / 3, x + (r() - 0.5) * 8, 2 * h / 3, x + (r() - 0.5) * 6, h); g.stroke(); }
      g.fillStyle = "rgba(40,30,25,0.55)"; g.fillRect(i * pw, 0, 2.5, h);
      for (let k = 0; k < 2; k++) { g.fillStyle = "rgba(60,60,60,0.7)"; g.beginPath(); g.arc(i * pw + pw / 2, 30 + k * (h - 60), 2.5, 0, 7); g.fill(); }
    }
    blobs(g, w, h, 30, 20, 90, seed + 3, 0.12, false);   // weathering
    const gr = g.createLinearGradient(0, h * 0.75, 0, h); gr.addColorStop(0, "rgba(40,35,30,0)"); gr.addColorStop(1, "rgba(40,35,30,0.35)"); g.fillStyle = gr; g.fillRect(0, h * 0.75, w, h * 0.25);
  });
}
export const corrugatedNormal = normalFromHeight(256, 256, (g, w, h) => {
  for (let x = 0; x < w; x++) { const v = 128 + 120 * Math.sin(x / w * Math.PI * 2 * 12); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, 0, 1, h); }
}, 4);
export function facadeTexture(seed, base) {
  return canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h); const r = rngFrom(seed);
    const cols = 6 + Math.floor(r() * 4), rows = 14 + Math.floor(r() * 8), cw = w / cols, rh = h / rows;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const lit = r() < 0.12; g.fillStyle = lit ? "rgba(255,220,160,0.85)" : `rgba(40,55,70,${0.55 + r() * 0.3})`; g.fillRect(i * cw + cw * 0.2, j * rh + rh * 0.25, cw * 0.6, rh * 0.5); }
  });
}

// ---------- sky, sun and environment ----------
export function makeSky(renderer, scene, sunDir) {
  const sky = new Sky(); sky.scale.setScalar(20000);
  const u = sky.material.uniforms;
  u.turbidity.value = 2.0; u.rayleigh.value = 1.3; u.mieCoefficient.value = 0.003; u.mieDirectionalG.value = 0.82;
  u.sunPosition.value.copy(sunDir);
  scene.add(sky);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene(); const sky2 = new Sky(); sky2.scale.setScalar(20000);
  Object.keys(u).forEach(k => { if (sky2.material.uniforms[k]) sky2.material.uniforms[k].value = u[k].value; });
  envScene.add(sky2);
  // a bright snowy ground hemisphere in the environment so reflections pick up the white lake
  const groundEnv = new THREE.Mesh(new THREE.SphereGeometry(10000, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.85, 0.88, 0.92), side: THREE.BackSide }));
  envScene.add(groundEnv);
  const env = pmrem.fromScene(envScene, 0.02).texture;
  scene.environment = env;
  return { sky, env };
}

// ---------- post-processing with an automatic quality tier ----------
export function makePost(renderer, scene, overlay, camera) {
  const isPhone = innerWidth < 860 || matchMedia("(pointer: coarse)").matches;
  const state = { tier: isPhone ? "low" : "high", composer: null, gtao: null, bloom: null, smaa: null, frameMs: [], lowered: false };
  const size = new THREE.Vector2(); renderer.getSize(size);
  const rt = new THREE.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), { type: THREE.HalfFloatType, stencilBuffer: true, depthBuffer: true });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, Math.max(1, size.x), Math.max(1, size.y));
  gtao.blendIntensity = 1.0; composer.addPass(gtao);
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.22, 0.45, 0.93); composer.addPass(bloom);
  const ov = new RenderPass(overlay, camera); ov.clear = false; ov.clearDepth = true; composer.addPass(ov);
  composer.addPass(new OutputPass());
  const smaa = new SMAAPass(size.x * renderer.getPixelRatio(), size.y * renderer.getPixelRatio()); composer.addPass(smaa);
  Object.assign(state, { composer, gtao, bloom, smaa });
  state.apply = () => {
    gtao.enabled = state.tier === "high"; bloom.enabled = state.tier !== "low";
    renderer.setPixelRatio(Math.min(devicePixelRatio, state.tier === "low" ? 1.5 : 2));
  };
  state.setSize = (w, h) => { composer.setSize(w, h); };
  state.render = dt => {
    if (state.tier === "low") { renderer.autoClear = true; renderer.render(scene, camera); renderer.autoClear = false; renderer.clearDepth(); renderer.render(overlay, camera); renderer.autoClear = true; }
    else composer.render(dt);
    // adapt: average frame time over ~2 s
    state.frameMs.push(dt * 1000); if (state.frameMs.length > 120) state.frameMs.shift();
    if (state.frameMs.length === 120) {
      const avg = state.frameMs.reduce((a, b) => a + b, 0) / 120;
      if (avg > 30 && state.tier === "high") { state.tier = "medium"; state.frameMs = []; state.apply(); state.onTier?.(); }
      else if (avg > 40 && state.tier === "medium") { state.tier = "low"; state.frameMs = []; state.apply(); state.onTier?.(); }
    }
  };
  state.apply();
  return state;
}

// ---------- builders ----------
const phys = (o) => new THREE.MeshPhysicalMaterial(o);
export function fabric(color) { return phys({ color, roughness: 0.85, sheen: 0.6, sheenRoughness: 0.7, sheenColor: new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.35) }); }
const SKIN = ["#e6bfa0", "#c99878", "#8d5a3c", "#f0cdb4"];
// a well-proportioned angler (~1.78 m standing); pose "sit" sits on a bucket, "stand" jigs a rod
export function makeAngler(rand, pose, parkaColor, pantsColor = "#2b2f36", opts = {}) {
  const g = new THREE.Group();
  const parka = fabric(parkaColor), pants = fabric(pantsColor), boot = phys({ color: "#1e1a17", roughness: 0.6 }), skin = phys({ color: opts.elder ? "#ecccb4" : SKIN[Math.floor(rand() * SKIN.length)], roughness: 0.55, sheen: 0.3 });
  const hat = fabric(["#c0392b", "#2c3e50", "#d35400", "#7f8c8d"][Math.floor(rand() * 4)]);
  const cap = (r, l, m) => { const x = new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 6, 14), m); x.castShadow = true; return x; };
  const sit = pose === "sit";
  const hipY = sit ? 0.46 : 0.92;
  // legs
  for (const sx of [-0.1, 0.1]) {
    const thigh = cap(0.075, 0.34, pants), shin = cap(0.06, 0.34, pants), b = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.11, 0.28, 3, 0.04), boot);
    if (sit) { thigh.rotation.x = Math.PI / 2; thigh.position.set(sx, hipY, 0.2); shin.position.set(sx, 0.25, 0.4); b.position.set(sx, 0.055, 0.45); }
    else { thigh.position.set(sx, 0.7, 0); shin.position.set(sx, 0.3, 0); b.position.set(sx, 0.055, 0.04); }
    b.castShadow = true; g.add(thigh, shin, b);
  }
  // torso, hood, head
  const torso = cap(0.19, 0.36, parka); torso.scale.set(1, 1, 0.78); torso.position.y = hipY + 0.32; g.add(torso);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.05, 10, 20), parka); collar.rotation.x = Math.PI / 2; collar.position.y = hipY + 0.62; g.add(collar);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 16), skin); head.scale.set(0.92, 1.08, 1); head.position.y = hipY + 0.78; head.castShadow = true; g.add(head);
  if (opts.elder) {
    // tribute figure: white hair, tweed flat cap, glasses, Badger-red scarf
    const hair = phys({ color: "#eeeeea", roughness: 0.8, sheen: 0.6, sheenColor: new THREE.Color("#ffffff") });
    const back = new THREE.Mesh(new THREE.SphereGeometry(0.114, 20, 12, Math.PI * 0.55, Math.PI * 0.9, Math.PI * 0.3, Math.PI * 0.35), hair); back.position.y = hipY + 0.78; g.add(back);
    const tweed = fabric("#6b5e4b");
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.05, 20), tweed); crown.position.set(0.0, hipY + 0.87, -0.005); crown.rotation.x = -0.12; g.add(crown);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.012, 16, 1, false, -Math.PI / 2, Math.PI), tweed); brim.position.set(0, hipY + 0.855, 0.09); brim.scale.set(1.2, 1, 0.9); g.add(brim);
    const rim = phys({ color: "#222", metalness: 0.6, roughness: 0.3 });
    for (const sx of [-0.042, 0.042]) { const lens = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.004, 6, 18), rim); lens.position.set(sx, hipY + 0.795, 0.1); g.add(lens);
      const glass = new THREE.Mesh(new THREE.CircleGeometry(0.025, 16), phys({ color: "#cfe3ef", transmission: 0.9, roughness: 0.05, transparent: true, opacity: 0.35 })); glass.position.set(sx, hipY + 0.795, 0.101); g.add(glass); }
    const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.03, 6), rim); bridge.rotation.z = Math.PI / 2; bridge.position.set(0, hipY + 0.8, 0.102); g.add(bridge);
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.04, 10, 22), fabric("#c5050c")); scarf.rotation.x = Math.PI / 2; scarf.position.y = hipY + 0.64; g.add(scarf);
    const tail = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.26, 0.025, 2, 0.01), fabric("#c5050c")); tail.position.set(0.07, hipY + 0.5, 0.15); tail.rotation.z = 0.1; g.add(tail);
    // a copy of Transport Phenomena on the ice beside the bucket
    const book = new THREE.Group(); const cover = new THREE.Mesh(new RoundedBoxGeometry(0.17, 0.045, 0.24, 2, 0.006), phys({ color: "#1c2f5a", roughness: 0.6 }));
    const pages = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.036, 0.228), phys({ color: "#f3efe4", roughness: 0.9 })); pages.position.x = 0.006;
    book.add(cover, pages); book.position.set(-0.32, 0.024, 0.05); book.rotation.y = 0.5; g.add(book);
  } else {
    const beanie = new THREE.Mesh(new THREE.SphereGeometry(0.118, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hat); beanie.position.y = hipY + 0.8; g.add(beanie);
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), hat); pom.position.y = hipY + 0.93; g.add(pom);
  }
  // arms reaching forward to the rod
  for (const sx of [-0.23, 0.23]) {
    const upper = cap(0.06, 0.24, parka); upper.position.set(sx, hipY + 0.42, 0.06); upper.rotation.x = -0.5;
    const fore = cap(0.052, 0.22, parka); fore.position.set(sx * 0.7, hipY + 0.28, 0.24); fore.rotation.x = -1.25;
    const mitt = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), boot); mitt.position.set(sx * 0.55, hipY + 0.24, 0.38);
    g.add(upper, fore, mitt);
  }
  // rod and line to the hole
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.01, 0.75, 6), phys({ color: "#222", roughness: 0.3, clearcoat: 1 }));
  rod.position.set(0, hipY + 0.32, 0.65); rod.rotation.x = Math.PI / 2 - 0.35; g.add(rod);
  const tipY = hipY + 0.32 + Math.sin(0.35) * 0.37, tipZ = 0.65 + Math.cos(0.35) * 0.37;
  const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, tipY, tipZ), new THREE.Vector3(0, 0.0, tipZ + 0.02)]);
  g.add(new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: "#dddddd", transparent: true, opacity: 0.7 })));
  // bucket (seat or tackle) and the hole with a rim of shaved ice
  const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.38, 20, 1, false), phys({ color: rand() < 0.5 ? "#e8e8e8" : "#e67e22", roughness: 0.45, clearcoat: 0.3 }));
  bucket.castShadow = true; if (sit) bucket.position.set(0, 0.19, 0.0); else bucket.position.set(0.45, 0.19, -0.2); g.add(bucket);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.1, 24), new THREE.MeshBasicMaterial({ color: "#0b1d2b" })); hole.rotation.x = -Math.PI / 2; hole.position.set(0, 0.006, tipZ + 0.02); g.add(hole);
  const slush = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.24, 24), phys({ color: "#dfe9f0", roughness: 0.35, clearcoat: 0.6 })); slush.rotation.x = -Math.PI / 2; slush.position.set(0, 0.008, tipZ + 0.02); g.add(slush);
  // contact shadow
  const cs = new THREE.Mesh(new THREE.CircleGeometry(0.5, 24), new THREE.MeshBasicMaterial({ color: "#000", transparent: true, opacity: 0.18, depthWrite: false })); cs.rotation.x = -Math.PI / 2; cs.position.set(0, 0.004, 0.15); cs.renderOrder = 1; g.add(cs);
  return g;
}
// weathered plank shanty with a corrugated metal roof, door, glowing window, chimney and runners
const plankTex = [plankTexture(3), plankTexture(7), plankTexture(11)];
export function makeShanty(color, rand) {
  const g = new THREE.Group();
  const wood = phys({ color, map: plankTex[Math.floor(rand() * 3)], roughness: 0.82 });
  const W = 2.4 + rand() * 0.6, D = 1.8 + rand() * 0.6, H = 1.95;
  const body = new THREE.Mesh(new RoundedBoxGeometry(W, H, D, 3, 0.04), wood); body.position.y = H / 2 + 0.12; body.castShadow = true; body.receiveShadow = true; g.add(body);
  // roof: two corrugated sheets
  const metal = phys({ color: "#9aa3aa", metalness: 0.85, roughness: 0.42, normalMap: corrugatedNormal, normalScale: new THREE.Vector2(0.8, 0.8) });
  for (const s of [-1, 1]) {
    const sheet = new THREE.Mesh(new THREE.BoxGeometry(W + 0.2, 0.03, D / 2 + 0.25), metal);
    sheet.position.set(0, H + 0.12 + 0.2, s * (D / 4 + 0.02)); sheet.rotation.x = s * 0.38; sheet.castShadow = true; g.add(sheet);
  }
  const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, W + 0.2, 8), metal); ridge.rotation.z = Math.PI / 2; ridge.position.y = H + 0.12 + 0.33; g.add(ridge);
  // gables
  const gableShape = new THREE.Shape([new THREE.Vector2(-D / 2, 0), new THREE.Vector2(D / 2, 0), new THREE.Vector2(0, 0.38)]);
  for (const s of [-1, 1]) { const gb = new THREE.Mesh(new THREE.ShapeGeometry(gableShape), wood); gb.position.set(s * W / 2, H + 0.12, 0); gb.rotation.y = s * Math.PI / 2; g.add(gb); }
  const door = new THREE.Mesh(new RoundedBoxGeometry(0.72, 1.55, 0.05, 2, 0.02), phys({ color: new THREE.Color(color).multiplyScalar(0.7), map: plankTex[0], roughness: 0.8 }));
  door.position.set(W * 0.18, 0.12 + 0.8, D / 2 + 0.02); g.add(door);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), phys({ color: "#b8b8b8", metalness: 1, roughness: 0.3 })); knob.position.set(W * 0.18 + 0.27, 0.95, D / 2 + 0.06); g.add(knob);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.3), new THREE.MeshStandardMaterial({ color: "#2a1d10", emissive: "#ffb057", emissiveIntensity: 2.4 }));
  win.position.set(-W * 0.25, 1.35, D / 2 + 0.03); g.add(win);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.38, 0.03), phys({ color: "#e8e0d0", roughness: 0.7 })); frame.position.set(-W * 0.25, 1.35, D / 2 + 0.015); g.add(frame);
  const chim = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 12), phys({ color: "#5c6166", metalness: 1, roughness: 0.35 })); chim.position.set(-W * 0.32, H + 0.12 + 0.55, -D * 0.2); chim.castShadow = true; g.add(chim);
  const capC = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.08, 12), chim.material); capC.position.set(-W * 0.32, H + 0.12 + 1.05, -D * 0.2); g.add(capC);
  for (const s of [-1, 1]) { const run = new THREE.Mesh(new RoundedBoxGeometry(W + 0.3, 0.12, 0.12, 2, 0.04), phys({ color: "#4a3a2c", roughness: 0.8 })); run.position.set(0, 0.06, s * D * 0.38); g.add(run); }
  const cs = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.8, D + 0.8), new THREE.MeshBasicMaterial({ color: "#000", transparent: true, opacity: 0.16, depthWrite: false }));
  cs.rotation.x = -Math.PI / 2; cs.position.y = 0.004; cs.renderOrder = 1; g.add(cs);
  return g;
}
// transmissive ice chips left from drilling
export function makeIceChips(rand, n = 8) {
  const g = new THREE.Group();
  const mat = phys({ color: "#d8f0ff", transmission: 0.92, thickness: 0.08, ior: 1.31, roughness: 0.12, metalness: 0, clearcoat: 1, attenuationColor: new THREE.Color("#8fc6e0"), attenuationDistance: 0.4 });
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.04 + rand() * 0.06, 0), mat);
    m.scale.set(1 + rand(), 0.4 + rand() * 0.4, 1 + rand() * 0.6); const a = rand() * Math.PI * 2, r = 0.2 + rand() * 0.35;
    m.position.set(Math.cos(a) * r, 0.02, Math.sin(a) * r); m.rotation.set(rand(), rand() * 3, rand()); m.castShadow = true; g.add(m);
  }
  return g;
}
// spruce (three snow-dusted tiers) and bare deciduous trees, instanced
export function makeForest(points, rand) {
  const spruceN = points.filter(p => p.kind === "spruce").length, bareN = points.length - spruceN;
  const needle = phys({ color: "#24402f", roughness: 0.9 }), snowCap = phys({ color: "#f4f7fa", roughness: 0.9 }), bark = phys({ color: "#4f4237", roughness: 0.95 });
  const tiers = [0, 1, 2].map(k => new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 9), needle, spruceN));
  const caps = [0, 1, 2].map(k => new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 9), snowCap, spruceN));
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.5, 1, 1, 6), bark, spruceN + bareN);
  const branches = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.6, 1, 5), bark, bareN * 5);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler();
  let si = 0, ti = 0, bi = 0;
  for (const p of points) {
    const h = p.h;
    if (p.kind === "spruce") {
      [[0.25, 0.55, 0.36], [0.5, 0.45, 0.28], [0.72, 0.35, 0.19]].forEach(([y, hh, r], k) => {
        M.compose(new THREE.Vector3(p.x, p.y + h * y, p.z), Q.identity(), new THREE.Vector3(h * r, h * hh, h * r)); tiers[k].setMatrixAt(si, M);
        M.compose(new THREE.Vector3(p.x, p.y + h * (y + hh * 0.22), p.z), Q.identity(), new THREE.Vector3(h * r * 0.82, h * hh * 0.55, h * r * 0.82)); caps[k].setMatrixAt(si, M);
      });
      M.compose(new THREE.Vector3(p.x, p.y + h * 0.08, p.z), Q.identity(), new THREE.Vector3(h * 0.03, h * 0.16, h * 0.03)); trunks.setMatrixAt(ti++, M); si++;
    } else {
      M.compose(new THREE.Vector3(p.x, p.y + h * 0.4, p.z), Q.identity(), new THREE.Vector3(h * 0.025, h * 0.8, h * 0.025)); trunks.setMatrixAt(ti++, M);
      for (let k = 0; k < 5; k++) { E.set((rand() - 0.5) * 1.6 + 0.6, rand() * 6.3, (rand() - 0.5) * 0.6); Q.setFromEuler(E);
        M.compose(new THREE.Vector3(p.x, p.y + h * (0.5 + k * 0.08), p.z), Q, new THREE.Vector3(h * 0.012, h * 0.35, h * 0.012)); branches.setMatrixAt(bi++, M); }
    }
  }
  const g = new THREE.Group(); [...tiers, ...caps, trunks, branches].forEach(m => { m.castShadow = true; m.receiveShadow = true; g.add(m); });
  return g;
}
// snow sparkle: view-dependent glints that twinkle as the camera moves
export function makeSparkle(count, area, rand) {
  const pos = new Float32Array(count * 3), seed = new Float32Array(count);
  for (let i = 0; i < count; i++) { pos[i * 3] = area.x0 + rand() * (area.x1 - area.x0); pos[i * 3 + 1] = 0.004; pos[i * 3 + 2] = area.z0 + rand() * (area.z1 - area.z0); seed[i] = rand() * 1000; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("seed", new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uSun: { value: new THREE.Vector3(0, 1, 0) }, uPR: { value: 1 }, uOn: { value: 1 } },
    vertexShader: `attribute float seed; uniform vec3 uSun; uniform float uPR; varying float vA;
      void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vec3 v = normalize(cameraPosition - wp.xyz);
        vec3 n = normalize(vec3(sin(seed*1.7), 6.0 + sin(seed*3.1)*2.0, cos(seed*2.3)));
        float g = max(dot(reflect(-uSun, n), v), 0.0); vA = pow(g, 160.0);
        vec4 mv = viewMatrix * wp; gl_Position = projectionMatrix * mv; gl_PointSize = uPR * clamp(26.0 / -mv.z, 1.0, 5.0); }`,
    fragmentShader: `varying float vA; uniform float uOn; void main(){ vec2 c = gl_PointCoord - 0.5; float d = 1.0 - smoothstep(0.0, 0.5, length(c)); if (vA*d < 0.02) discard; gl_FragColor = vec4(vec3(3.0), vA * d * uOn); }`,
  });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; return pts;
}
// Madison skyline across the lake at ~3 km, with the State Capitol (dome top ≈ 87 m)
export function makeSkyline(rand, z0) {
  const g = new THREE.Group();
  const tones = ["#cfc9be", "#b9bec4", "#d8d2c6", "#a9a39a", "#c4b6a2"];
  const facades = tones.map((t, i) => facadeTexture(100 + i, t));
  const geo = new THREE.BoxGeometry(1, 1, 1);
  for (let i = 0; i < 70; i++) {
    const x = -1400 + rand() * 2800; if (Math.abs(x - 120) < 120) continue;
    const w = 20 + rand() * 40, d = 20 + rand() * 30, h = 10 + Math.pow(rand(), 1.6) * 52;
    const k = Math.floor(rand() * tones.length), tex = facades[k].clone(); tex.needsUpdate = true; tex.repeat.set(Math.max(1, w / 30), Math.max(1, h / 30));
    const m = new THREE.Mesh(geo, phys({ color: "#ffffff", map: tex, roughness: 0.8 })); m.scale.set(w, h, d);
    m.position.set(x, h / 2, z0 - rand() * 400); g.add(m);
  }
  // State Capitol: four wings, central block, colonnaded drum, dome, lantern
  const granite = phys({ color: "#e8e4da", roughness: 0.7 });
  const cap = new THREE.Group(); cap.position.set(120, 0, z0 - 180);
  for (const r of [0, Math.PI / 2]) { const wing = new THREE.Mesh(new THREE.BoxGeometry(135, 26, 34), granite); wing.position.y = 13; wing.rotation.y = r; cap.add(wing); }
  const core = new THREE.Mesh(new THREE.BoxGeometry(46, 34, 46), granite); core.position.y = 17; cap.add(core);
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(16, 17, 16, 40), granite); drum.position.y = 42; cap.add(drum);
  const cols = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.8, 0.8, 12, 8), granite, 24); const M = new THREE.Matrix4();
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; M.makeTranslation(Math.cos(a) * 18, 42, Math.sin(a) * 18); cols.setMatrixAt(i, M); } cap.add(cols);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(15, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), granite); dome.scale.y = 1.6; dome.position.y = 50; cap.add(dome);
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.4, 8, 16), granite); lantern.position.y = 77; cap.add(lantern);
  const statue = new THREE.Mesh(new THREE.ConeGeometry(1.2, 5, 8), phys({ color: "#c9a44a", metalness: 1, roughness: 0.3 })); statue.position.y = 84; cap.add(statue);
  g.add(cap);
  return g;
}
// gently rolling snowy terrain
export function makeTerrain(w, d, seg, heightFn, mat) {
  const geo = new THREE.PlaneGeometry(w, d, seg, seg); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, heightFn(p.getX(i), p.getZ(i)));
  geo.computeVertexNormals(); const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; return m;
}
export { RoundedBoxGeometry };

// ---------- Picnic Point winter woodland: bare oaks/maples/basswood with twig crowns, white and red pine, shrub thickets ----------
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
function twigTexture(seed, color) {
  const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d"); const r = rngFrom(seed);
  g.strokeStyle = color; g.lineCap = "round";
  const branch = (x, y, a, len, w, d) => {
    if (d === 0 || len < 2) return; const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
    g.lineWidth = w; g.globalAlpha = 0.55 + 0.45 * (d / 7); g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
    const n = 2 + (r() < 0.4 ? 1 : 0); for (let k = 0; k < n; k++) branch(x2, y2, a + (r() - 0.5) * 1.3, len * (0.62 + r() * 0.18), w * 0.66, d - 1);
  };
  for (let k = 0; k < 7; k++) branch(128 + (r() - 0.5) * 60, 256, -Math.PI / 2 + (r() - 0.5) * 1.2, 40 + r() * 20, 4, 7);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function hardwoodTemplate(rand, form) {
  // form: "oak" (broad, crooked limbs), "maple" (upright oval), "basswood" (tall, narrow)
  const parts = [];
  const seg = (p0, p1, r0, r1) => {
    const d = new THREE.Vector3().subVectors(p1, p0), L = d.length(); const geo = new THREE.CylinderGeometry(r1, r0, L, 6, 1);
    geo.translate(0, L / 2, 0); const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    geo.applyMatrix4(new THREE.Matrix4().compose(p0, q, new THREE.Vector3(1, 1, 1))); parts.push(geo);
  };
  const spread = form === "oak" ? 1.0 : form === "maple" ? 0.6 : 0.4, trunkH = form === "basswood" ? 0.45 : 0.32;
  const grow = (p, dir, len, r, depth) => {
    const end = p.clone().addScaledVector(dir, len); seg(p, end, r, r * 0.68);
    if (depth === 0) return;
    const n = depth === 3 ? 4 + Math.floor(rand() * 3) : 2 + Math.floor(rand() * 2);
    for (let k = 0; k < n; k++) {
      const yaw = rand() * Math.PI * 2, tilt = (0.35 + rand() * 0.55) * spread * (depth === 3 ? 1 : 0.8);
      const nd = dir.clone().applyAxisAngle(new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw)), tilt).normalize();
      if (form === "oak") nd.y *= 0.75 + rand() * 0.3; nd.normalize();
      grow(end.clone().lerp(p, rand() * 0.25), nd, len * (0.55 + rand() * 0.2), r * 0.6, depth - 1);
    }
  };
  seg(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, trunkH, 0), 0.035, 0.028);
  grow(new THREE.Vector3(0, trunkH, 0), new THREE.Vector3((rand() - 0.5) * 0.15, 1, 0).normalize(), 0.28, 0.026, 3);
  return mergeGeometries(parts);
}
export function makeWinterWoods(points, rand) {
  const g = new THREE.Group();
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), E = new THREE.Euler();
  const by = k => points.filter(p => p.kind === k);
  // bare hardwoods: 3 forms x 2 templates, bark tones per form; twig crowns as crossed alpha cards
  const forms = [["oak", "#4a4038"], ["maple", "#6b6762"], ["basswood", "#5b564f"]];
  const twig = [twigTexture(5, "#3e352e"), twigTexture(9, "#4d4540")];
  const crownGeo = (() => { const a = []; for (let k = 0; k < 3; k++) { const pl = new THREE.PlaneGeometry(1, 1); pl.rotateY(k * Math.PI / 3); pl.translate(0, 0.5, 0); a.push(pl); } return mergeGeometries(a); })();
  const hw = points.filter(p => ["oak", "maple", "basswood"].includes(p.kind));
  forms.forEach(([form, bark], fi) => {
    const list = hw.filter(p => p.kind === form); if (!list.length) return;
    const mat = new THREE.MeshStandardMaterial({ color: bark, roughness: 0.95 });
    for (let t = 0; t < 2; t++) {
      const sub = list.filter((_, i) => i % 2 === t); if (!sub.length) continue;
      const tm = new THREE.InstancedMesh(hardwoodTemplate(rngFrom(31 + fi * 7 + t), form), mat, sub.length); tm.castShadow = true;
      const cm = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ map: twig[t], alphaTest: 0.35, transparent: false, side: THREE.DoubleSide, roughness: 1, color: "#ffffff" }), sub.length);
      cm.castShadow = true;
      sub.forEach((p, i) => {
        const yaw = rand() * Math.PI * 2; Q.setFromEuler(E.set(0, yaw, 0)); S.setScalar(p.h); P.set(p.x, p.y, p.z);
        M.compose(P, Q, S); tm.setMatrixAt(i, M);
        const cw = form === "oak" ? 0.95 : form === "maple" ? 0.7 : 0.55;
        M.compose(P.clone().setY(p.y + p.h * (form === "basswood" ? 0.42 : 0.3)), Q, new THREE.Vector3(p.h * cw, p.h * 0.72, p.h * cw)); cm.setMatrixAt(i, M);
      });
      g.add(tm, cm);
    }
  });
  // white pine: tiered irregular clumps; red pine: tall clear trunk, crown at the top; both snow-dusted
  const needle = new THREE.MeshStandardMaterial({ color: "#2b4a36", roughness: 0.9 }), snowTop = new THREE.MeshStandardMaterial({ color: "#f2f6fa", roughness: 0.9 });
  const barkW = new THREE.MeshStandardMaterial({ color: "#4a3f37", roughness: 0.95 }), barkR = new THREE.MeshStandardMaterial({ color: "#8a5a3c", roughness: 0.9 });
  const clump = new THREE.IcosahedronGeometry(1, 1), trunk = new THREE.CylinderGeometry(0.5, 1, 1, 7);
  for (const [kind, bark, tiers, z0] of [["pine", barkW, 6, 0.2], ["redpine", barkR, 3, 0.62]]) {
    const list = by(kind); if (!list.length) continue;
    const tr = new THREE.InstancedMesh(trunk, bark, list.length), cl = new THREE.InstancedMesh(clump, needle, list.length * tiers), sn = new THREE.InstancedMesh(clump, snowTop, list.length * tiers);
    tr.castShadow = cl.castShadow = true; let k = 0;
    list.forEach((p, i) => {
      M.compose(P.set(p.x, p.y + p.h * 0.45, p.z), Q.identity(), S.set(p.h * 0.025, p.h * 0.9, p.h * 0.025)); tr.setMatrixAt(i, M);
      for (let t = 0; t < tiers; t++) {
        const f = z0 + (1 - z0) * (t / tiers) * 0.95, w = p.h * (kind === "pine" ? 0.26 * (1 - t / tiers * 0.7) : 0.18) * (0.8 + rand() * 0.4);
        const ox = (rand() - 0.5) * w * 0.6, oz = (rand() - 0.5) * w * 0.6;
        M.compose(P.set(p.x + ox, p.y + p.h * f, p.z + oz), Q.setFromEuler(E.set(0, rand() * 3, 0)), S.set(w, p.h * 0.06, w * (0.7 + rand() * 0.4))); cl.setMatrixAt(k, M);
        M.compose(P.set(p.x + ox, p.y + p.h * f + p.h * 0.035, p.z + oz), Q, S.set(w * 0.8, p.h * 0.025, w * 0.6)); sn.setMatrixAt(k, M); k++;
      }
    });
    g.add(tr, cl, sn);
  }
  // shrub thickets (buckthorn/honeysuckle/dogwood): small twig cards
  const sh = by("shrub");
  if (sh.length) {
    const smat = new THREE.MeshStandardMaterial({ map: twigTexture(17, "#5a3a2e"), alphaTest: 0.35, side: THREE.DoubleSide, roughness: 1 });
    const sm = new THREE.InstancedMesh(crownGeo, smat, sh.length);
    sh.forEach((p, i) => { M.compose(P.set(p.x, p.y - 0.1, p.z), Q.setFromEuler(E.set(0, rand() * 3, 0)), S.set(p.h * 1.3, p.h, p.h * 1.3)); sm.setMatrixAt(i, M); });
    g.add(sm);
  }
  return g;
}

// ---------- fish under the ice: yellow perch, bluegill, walleye, northern pike ----------
// Shaped (fusiform) bodies with a narrow tail stalk, species skins with scales, ray-patterned fins,
// glossy eyes, and a side-to-side body wave done in the vertex shader.
const FISH_SPEC = {
  perch:    { L: 0.22, H: 0.27, W: 0.13, hump: 0.12, blunt: 0.25, fork: 0.55, fin: "#d9772b", dors2: true,  spiny: true },
  bluegill: { L: 0.18, H: 0.50, W: 0.13, hump: 0.04, blunt: 0.55, fork: 0.25, fin: "#4a5a55", dors2: false, spiny: true },
  walleye:  { L: 0.46, H: 0.20, W: 0.12, hump: 0.04, blunt: 0.15, fork: 0.55, fin: "#7a6a3a", dors2: true,  spiny: true },
  pike:     { L: 0.75, H: 0.13, W: 0.10, hump: 0.0,  blunt: 0.05, fork: 0.35, fin: "#6f7a3a", dors2: false, spiny: false, backDorsal: true },
};
const scaleNormal = normalFromHeight(256, 256, (g, w, h) => {
  g.fillStyle = "#606060"; g.fillRect(0, 0, w, h);
  for (let row = 0; row < 12; row++) for (let col = 0; col < 13; col++) {
    const x = col * 20 + (row % 2) * 10, y = row * 22;
    const gr = g.createRadialGradient(x, y, 2, x, y, 14); gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.8, "#8a8a8a"); gr.addColorStop(1, "#505050");
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, 14, -Math.PI * 0.1, Math.PI * 1.1); g.fill();
  }
}, 2.5, [10, 5]);
function fishSkinTex(kind) {
  const c = document.createElement("canvas"); c.width = 512; c.height = 256; const g = c.getContext("2d"), W = 512, H = 256;
  const r = rngFrom(kind.length * 17);
  const pal = { perch: ["#3f4a1c", "#c2aa36", "#efe8d2"], bluegill: ["#2f403f", "#6f7c86", "#e6a24a"], walleye: ["#4a4220", "#ad9550", "#f1ece0"], pike: ["#24391d", "#4f6d33", "#ecebd6"] }[kind];
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, pal[0]); gr.addColorStop(0.42, pal[1]); gr.addColorStop(0.72, pal[1]); gr.addColorStop(0.86, pal[2]); gr.addColorStop(1, pal[2]);
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  if (kind === "perch") for (let k = 0; k < 7; k++) { const x = 70 + k * 52; const b = g.createLinearGradient(0, 0, 0, H * 0.75); b.addColorStop(0, "rgba(25,32,12,0.75)"); b.addColorStop(1, "rgba(25,32,12,0)");
    g.fillStyle = b; g.beginPath(); g.moveTo(x - 16, 0); g.lineTo(x + 16, 0); g.lineTo(x + 5, H * 0.72); g.lineTo(x - 5, H * 0.72); g.fill(); }
  if (kind === "bluegill") { for (let k = 0; k < 7; k++) { g.fillStyle = "rgba(40,45,70,0.25)"; g.fillRect(90 + k * 46, 0, 18, H * 0.75); }
    g.fillStyle = "rgba(10,10,20,0.95)"; g.beginPath(); g.ellipse(W * 0.72, H * 0.38, 16, 12, 0, 0, 7); g.fill();               // the dark "ear" flap
    const br = g.createLinearGradient(0, H * 0.6, 0, H); br.addColorStop(0, "rgba(230,140,40,0)"); br.addColorStop(1, "rgba(230,140,40,0.8)"); g.fillStyle = br; g.fillRect(W * 0.55, H * 0.6, W * 0.3, H * 0.4); }
  if (kind === "walleye") for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(30,28,12,${0.25 + r() * 0.3})`; g.beginPath(); g.ellipse(40 + r() * 400, r() * H * 0.55, 8 + r() * 18, 5 + r() * 10, r(), 0, 7); g.fill(); }
  if (kind === "pike") for (let k = 0; k < 120; k++) { g.fillStyle = `rgba(232,226,160,${0.65 + r() * 0.3})`; g.beginPath(); g.ellipse(30 + r() * 420, 20 + r() * H * 0.55, 6 + r() * 5, 2.5 + r() * 2, 0, 0, 7); g.fill(); }
  g.strokeStyle = "rgba(240,235,200,0.35)"; g.lineWidth = 2; g.beginPath(); g.moveTo(20, H * 0.47); g.quadraticCurveTo(W * 0.5, H * 0.36, W * 0.8, H * 0.42); g.stroke();   // lateral line
  g.strokeStyle = "rgba(20,20,10,0.45)"; g.lineWidth = 3; g.beginPath(); g.arc(W * 0.86, H * 0.5, H * 0.32, Math.PI * 0.6, Math.PI * 1.4); g.stroke();                  // gill cover
  const head = g.createLinearGradient(W * 0.85, 0, W, 0); head.addColorStop(0, "rgba(0,0,0,0)"); head.addColorStop(1, "rgba(0,0,0,0.25)"); g.fillStyle = head; g.fillRect(W * 0.85, 0, W * 0.15, H);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function finTex(color, spiny) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 128; const g = c.getContext("2d");
  const col = new THREE.Color(color), rgb = `${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)}`;
  const gr = g.createLinearGradient(0, 128, 0, 0); gr.addColorStop(0, `rgba(${rgb},0.85)`); gr.addColorStop(1, `rgba(${rgb},0.35)`); g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
  g.strokeStyle = spiny ? "rgba(30,25,15,0.7)" : `rgba(${rgb},1)`; g.lineWidth = spiny ? 2.5 : 1.5;
  for (let k = 0; k <= 16; k++) { g.beginPath(); g.moveTo(k * 16, 128); g.lineTo(k * 16 + 6, 0); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// fin from a polygon outline (x along the body, y up), textured with rays
function finMesh(points, mat) {
  const sh = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y))); const geo = new THREE.ShapeGeometry(sh, 8);
  const pos = geo.attributes.position, uv = geo.attributes.uv; geo.computeBoundingBox(); const bb = geo.boundingBox;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - bb.min.x) / (bb.max.x - bb.min.x || 1), (pos.getY(i) - bb.min.y) / (bb.max.y - bb.min.y || 1));
  return new THREE.Mesh(geo, mat);
}
export function makeFish(kind) {
  const sp = FISH_SPEC[kind], L = sp.L, Hh = L * sp.H, Ww = L * sp.W;
  // body: a sphere reshaped into a fish profile; x = length (head at +x), y = height, z = width
  const geo = new THREE.SphereGeometry(1, 64, 32); geo.rotateZ(-Math.PI / 2);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  const prof = t => {   // t: 0 tail .. 1 snout
    const peduncle = 0.22 + 0.78 * THREE.MathUtils.smoothstep(t, 0.0, 0.32);
    const nose = Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.98 + 0.02)), sp.blunt + 0.35);
    return Math.max(0.02, peduncle * nose);
  };
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), t = (x + 1) / 2, f = prof(t);
    const hump = sp.hump * Math.sin(Math.PI * THREE.MathUtils.clamp((t - 0.35) / 0.5, 0, 1)) * (y > 0 ? 1 : 0);
    pos.setXYZ(i, x * L / 2, (y * f + hump * f) * Hh, z * f * Ww);
    uv.setXY(i, t, 1 - (y + 1) / 2);
  }
  geo.computeVertexNormals();
  const skin = new THREE.MeshPhysicalMaterial({ map: fishSkinTex(kind), normalMap: scaleNormal, normalScale: new THREE.Vector2(0.35, 0.35), roughness: 0.32, clearcoat: 0.9, clearcoatRoughness: 0.2, iridescence: kind === "walleye" || kind === "perch" ? 0.25 : 0.12, iridescenceIOR: 1.4, sheen: 0.2 });
  const swim = { uTime: { value: 0 }, uPhase: { value: Math.random() * 6 }, uAmp: { value: kind === "pike" ? 0.06 : 0.1 }, uLen: { value: L } };
  skin.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, swim);
    sh.vertexShader = "uniform float uTime, uPhase, uAmp, uLen;\n" + sh.vertexShader.replace("#include <begin_vertex>",
      `#include <begin_vertex>
       float tt = clamp(0.5 - transformed.x / uLen, 0.0, 1.0);           // 0 at head .. 1 at tail
       transformed.z += uAmp * uLen * tt * tt * sin(6.0 * tt - uTime * 7.0 + uPhase);`);
  };
  const g = new THREE.Group();
  const body = new THREE.Mesh(geo, skin); body.castShadow = true; g.add(body);
  const finCol = new THREE.Color(sp.fin);
  const finMat = new THREE.MeshStandardMaterial({ map: finTex(sp.fin, sp.spiny), transparent: true, side: THREE.DoubleSide, roughness: 0.55, depthWrite: false, emissive: finCol, emissiveIntensity: 0.45, emissiveMap: null });
  const finMat2 = new THREE.MeshStandardMaterial({ map: finTex(sp.fin, false), transparent: true, side: THREE.DoubleSide, roughness: 0.55, depthWrite: false, emissive: finCol, emissiveIntensity: 0.45 });
  const top = x => Hh * prof((x / L) + 0.5) * 0.98;
  // dorsal fins
  if (sp.backDorsal) g.add(finMesh([[-L * 0.32, top(-L * 0.32)], [-L * 0.14, top(-L * 0.14)], [-L * 0.2, top(-L * 0.2) + Hh * 0.9]], finMat2));
  else {
    g.add(finMesh([[-L * 0.02, top(-L * 0.02)], [L * 0.22, top(L * 0.22)], [L * 0.16, top(L * 0.16) + Hh * (sp.spiny ? 0.7 : 0.5)], [L * 0.02, top(L * 0.02) + Hh * 0.55]], finMat));
    if (sp.dors2) g.add(finMesh([[-L * 0.27, top(-L * 0.27)], [-L * 0.04, top(-L * 0.04)], [-L * 0.08, top(-L * 0.08) + Hh * 0.55], [-L * 0.24, top(-L * 0.24) + Hh * 0.4]], finMat2));
  }
  // anal and pelvic fins (underside), pectoral pair behind the gills
  const bot = x => -top(x) * 0.9;
  g.add(finMesh([[-L * 0.28, bot(-L * 0.28)], [-L * 0.08, bot(-L * 0.08)], [-L * 0.14, bot(-L * 0.14) - Hh * 0.45]], finMat2));
  const pelvic = finMesh([[L * 0.12, bot(L * 0.12)], [L * 0.2, bot(L * 0.2)], [L * 0.1, bot(L * 0.12) - Hh * 0.45]], finMat2); g.add(pelvic);
  const pecs = [];
  for (const s of [-1, 1]) { const pec = finMesh([[0, 0], [L * 0.1, Hh * 0.08], [L * 0.02, -Hh * 0.35]], finMat2); pec.position.set(L * 0.28, -Hh * 0.15, s * Ww * 0.75); pec.rotation.y = s * 0.7 + Math.PI; g.add(pec); pecs.push(pec); }
  // caudal fin, forked by species, pivoting at the tail stalk
  const tail = new THREE.Group(); tail.position.x = -L * 0.5;
  const ff = sp.fork, th = Hh * 1.25;
  tail.add(finMesh([[0, -th * 0.12], [0, th * 0.12], [-L * 0.2, th], [-L * 0.2 * (1 - ff * 0.6), th * 0.15], [-L * 0.14 * (1 - ff), 0], [-L * 0.2 * (1 - ff * 0.6), -th * 0.15], [-L * 0.2, -th]], finMat2));
  g.add(tail);
  // eyes: dark pupil in a golden (walleye: glassy white) iris, with a clear cornea
  const irisMat = new THREE.MeshPhysicalMaterial({ color: kind === "walleye" ? "#e8e2c8" : "#c9a043", roughness: 0.3, emissive: kind === "walleye" ? "#5a5640" : "#000000" });
  const pupil = new THREE.MeshPhysicalMaterial({ color: "#050505", roughness: 0.05, clearcoat: 1 });
  for (const s of [-1, 1]) {
    const e = new THREE.Group(); e.position.set(L * 0.38, Hh * 0.22, s * Ww * 0.62);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(L * 0.04, 16, 12), irisMat); iris.scale.z = 0.5;
    const p = new THREE.Mesh(new THREE.SphereGeometry(L * 0.022, 12, 10), pupil); p.position.z = s * L * 0.016; p.scale.z = 0.5;
    e.add(iris, p); g.add(e);
  }
  // mouth line
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(Hh * 0.18, Hh * 0.025, 6, 12, Math.PI * 0.6), new THREE.MeshStandardMaterial({ color: "#2a2416", roughness: 0.6 }));
  mouth.position.set(L * 0.47, -Hh * 0.05, 0); mouth.rotation.set(Math.PI / 2, 0, Math.PI * 0.7); g.add(mouth);
  g.userData = {
    tail, L,
    update: t => {
      swim.uTime.value = t;
      // the caudal fin follows the body wave at the tail and flicks a little further
      const ph = swim.uPhase.value, zt = swim.uAmp.value * L * Math.sin(6.0 - t * 7.0 + ph);
      tail.position.z = zt; tail.rotation.y = -Math.cos(6.0 - t * 7.0 + ph) * 0.5;
      pecs.forEach((p, i) => { p.rotation.z = Math.sin(t * 3 + i) * 0.25; });
    },
  };
  return g;
}
