// Render quality helpers (Part H): procedural textures and post-processing with an automatic quality tier.
// makePost follows the collection's shared helper (ambient occlusion, subtle bloom, SMAA; drops passes on slow frames).
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

export const rngFrom = seed => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
export function canvasTex(w, h, draw, { srgb = true, repeat = [1, 1] } = {}) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 8; return t;
}
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
// brushed stainless: fine streaks along one direction
export function brushedMaps(repeat = [1, 1]) {
  const draw = (g, w, h) => { g.fillStyle = "#808080"; g.fillRect(0, 0, w, h); const r = rngFrom(7);
    for (let i = 0; i < 2600; i++) { const v = 90 + r() * 80; g.strokeStyle = `rgba(${v},${v},${v},${0.25 + r() * 0.35})`; g.lineWidth = 0.5 + r(); const y = r() * h, x = r() * w, l = 30 + r() * 160; g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y); g.stroke(); } };
  return { normal: normalFromHeight(256, 256, draw, 0.9, repeat), rough: canvasTex(256, 256, (g, w, h) => { draw(g, w, h); g.fillStyle = "rgba(120,120,120,.55)"; g.fillRect(0, 0, w, h); }, { srgb: false, repeat }) };
}
export function concreteMaps(repeat = [4, 4]) {
  const speck = (g, w, h, seed, base) => { g.fillStyle = base; g.fillRect(0, 0, w, h); const r = rngFrom(seed);
    for (let i = 0; i < 5000; i++) { const v = 120 + r() * 110; g.fillStyle = `rgba(${v},${v},${v},${0.05 + r() * 0.12})`; g.beginPath(); g.arc(r() * w, r() * h, 0.5 + r() * 2.4, 0, 7); g.fill(); }
    for (let i = 0; i < 40; i++) { const x = r() * w, y = r() * h, rad = 30 + r() * 110, gr = g.createRadialGradient(x, y, 0, x, y, rad), c = r() < 0.5 ? 60 : 235; gr.addColorStop(0, `rgba(${c},${c},${c},.07)`); gr.addColorStop(1, `rgba(${c},${c},${c},0)`); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); } };
  return { map: canvasTex(512, 512, (g, w, h) => { speck(g, w, h, 11, "#b9bcc0"); g.strokeStyle = "rgba(70,74,80,.5)"; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2); }, { repeat }),
    normal: normalFromHeight(256, 256, (g, w, h) => speck(g, w, h, 19, "#808080"), 1.4, repeat) };
}
// perforated sieve deck: holes on a triangular pitch (alpha map + colour)
export function sieveTex() {
  return canvasTex(256, 256, (g, w, h) => { g.fillStyle = "#c9ced3"; g.fillRect(0, 0, w, h); g.fillStyle = "#30363c";
    for (let j = 0; j < 22; j++) for (let i = 0; i < 22; i++) { g.beginPath(); g.arc((i + (j % 2) * 0.5) * 12 + 4, j * 12 + 4, 2.6, 0, 7); g.fill(); } }, { repeat: [1, 1] });
}
export function gratingTex(repeat) {
  return canvasTex(128, 128, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = "#fff"; for (let i = 0; i < 8; i++) { g.fillRect(i * 16, 0, 4, h); } for (let j = 0; j < 4; j++) g.fillRect(0, j * 32, w, 5); }, { srgb: false, repeat });
}

export function makePost(renderer, scene, overlay, camera) {
  const isPhone = innerWidth < 860 || matchMedia("(pointer: coarse)").matches;
  const state = { tier: isPhone ? "low" : "high", frameMs: [] };
  const size = new THREE.Vector2(); renderer.getSize(size);
  const rt = new THREE.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), { type: THREE.HalfFloatType, stencilBuffer: true, depthBuffer: true });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, Math.max(1, size.x), Math.max(1, size.y));
  gtao.blendIntensity = 0.7; composer.addPass(gtao);
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.16, 0.4, 0.95); composer.addPass(bloom);
  const ov = new RenderPass(overlay, camera); ov.clear = false; ov.clearDepth = true; composer.addPass(ov);
  composer.addPass(new OutputPass());
  const smaa = new SMAAPass(size.x * renderer.getPixelRatio(), size.y * renderer.getPixelRatio()); composer.addPass(smaa);
  state.apply = () => { gtao.enabled = state.tier === "high"; bloom.enabled = state.tier !== "low"; renderer.setPixelRatio(Math.min(devicePixelRatio, state.tier === "low" ? 1.5 : 2)); };
  state.setSize = (w, h) => composer.setSize(w, h);
  state.render = dt => {
    if (state.tier === "low") { renderer.autoClear = true; renderer.render(scene, camera); renderer.autoClear = false; renderer.clearDepth(); renderer.render(overlay, camera); renderer.autoClear = true; }
    else composer.render(dt);
    state.frameMs.push(dt * 1000); if (state.frameMs.length > 120) state.frameMs.shift();
    if (state.frameMs.length === 120) { const avg = state.frameMs.reduce((a, b) => a + b, 0) / 120;
      if (avg > 30 && state.tier === "high") { state.tier = "medium"; state.frameMs = []; state.apply(); }
      else if (avg > 40 && state.tier === "medium") { state.tier = "low"; state.frameMs = []; state.apply(); } }
  };
  state.apply();
  return state;
}
