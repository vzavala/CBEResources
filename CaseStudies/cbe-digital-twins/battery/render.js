// Rendering pipeline (Part H): physical sky + image-based lighting from it, soft shadows, and an EffectComposer with
// ground-truth ambient occlusion, subtle bloom for hot or glowing things, SMAA and the output (tone-mapping) pass.
// An automatic quality tier drops AO and bloom on phones or slow frames and lowers the shadow map and pixel ratio.
import * as THREE from "three";
import { Sky } from "three/addons/objects/Sky.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

export const SUN_DIR = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 38), THREE.MathUtils.degToRad(35));

export function setupRendering(renderer, scene, camera, sun) {
  const phone = matchMedia("(max-width: 860px)").matches || (navigator.maxTouchPoints > 0 && Math.min(screen.width, screen.height) < 820);
  const Q = { phone, ao: !phone, bloom: !phone, ratio: Math.min(devicePixelRatio, phone ? 1.5 : 2) };
  renderer.setPixelRatio(Q.ratio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  sun.shadow.mapSize.set(phone ? 1024 : 2048, phone ? 1024 : 2048);

  // physical sky (Preetham) and an environment map built from it
  const sky = new Sky(); sky.scale.setScalar(18000);
  const u = sky.material.uniforms;
  u.turbidity.value = 5.5; u.rayleigh.value = 1.4; u.mieCoefficient.value = 0.004; u.mieDirectionalG.value = 0.82;
  u.sunPosition.value.copy(SUN_DIR);
  scene.add(sky);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene(); const sky2 = new Sky(); sky2.scale.setScalar(1000);
  Object.entries(u).forEach(([k, v]) => { if (sky2.material.uniforms[k]) sky2.material.uniforms[k].value = v.value?.clone ? v.value.clone() : v.value; });
  envScene.add(sky2);
  scene.environment = pmrem.fromScene(envScene, 0.02).texture;
  scene.background = null;
  scene.fog = new THREE.Fog("#c4d2e0", 5000, 16000);   // matched to the sky near the horizon
  sun.color.set("#fff1dc"); sun.intensity = 3.0;

  // post-processing
  let composer = null, gtao = null, bloom = null, smaa = null;
  function build(w, h) {
    composer = new EffectComposer(renderer);
    composer.setPixelRatio(Q.ratio); composer.setSize(w, h);
    composer.addPass(new RenderPass(scene, camera));
    if (Q.ao) {
      gtao = new GTAOPass(scene, camera, w, h);
      gtao.output = GTAOPass.OUTPUT.Default; gtao.blendIntensity = 0.85;
      gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1.0, scale: 1.0, samples: 12 });
      gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
      composer.addPass(gtao);
    }
    if (Q.bloom) { bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.3, 0.4, 1.5); composer.addPass(bloom); }   // only lights and hot metal (HDR > 1.5) glow
    composer.addPass(new OutputPass());
    smaa = new SMAAPass(w * Q.ratio, h * Q.ratio); composer.addPass(smaa);
  }
  let size = [1, 1];
  const api = {
    Q,
    resize(w, h) { size = [w, h]; renderer.setSize(w, h, false); if (!Q.phone) { if (composer) composer.setSize(w, h); else build(w, h); } },
    // AO radius follows the scale being looked at (metres at the EV, hundreds of metres at the overview)
    setScale(d) { if (gtao) { gtao.enabled = d < 400; if (gtao.enabled) gtao.updateGtaoMaterial({ radius: THREE.MathUtils.clamp(d * 0.035, 0.08, 12) }); } },   // AO only for close views
    render() {
      if (Q.phone || !composer) renderer.render(scene, camera); else composer.render();
      monitor();
    },
  };
  // automatic quality tier: watch the frame rate for a few seconds at a time
  let frames = 0, t0 = performance.now(), downgrades = 0;
  function monitor() {
    frames++; const now = performance.now();
    if (now - t0 < 3000) return;
    const fps = frames * 1000 / (now - t0); frames = 0; t0 = now;
    if (document.hidden || fps > 38 || downgrades > 2) return;
    downgrades++;
    if (Q.ao) { Q.ao = false; composer = null; build(...size); }
    else if (Q.ratio > 1) { Q.ratio = 1; renderer.setPixelRatio(1); composer = null; if (!Q.phone) build(...size); }
    else if (Q.bloom) { Q.bloom = false; composer = null; build(...size); }
  }
  return api;
}
