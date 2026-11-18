// Lake Mendota Ice Digital Twin: scene, model coupling, charts and panels.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { makeSky, makePost, snowMaps, blackIceMaps, iceFaceTexture, makeShanty, makeAngler, makeIceChips, makeForest, makeWinterWoods, makeFish, makeSparkle, makeSkyline, makeTerrain, rngFrom, RoundedBoxGeometry } from "./scene_hq.js";
import { PROPS, DEFAULTS, hAir, surfaceR, stefanH, runWinter, freezeUpIndex, SAFETY, IN, safetyLevel, firstDayAtLeast, neumannLambda } from "./model.js";
import { MADISON } from "./data/madison_winters.js";
import { MENDOTA } from "./data/mendota_ice.js";
import { REFS, ref, COURSE, FEATURES, COURSES, PS_LINK, LENSES, SPOTS } from "./content.js";
import { CATALOG } from "./courses_data.js";
import { VALID } from "./validation_data.js";
import { FIT_POINTS } from "./data/fit_points.js";

const $ = id => document.getElementById(id);
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const NDAYS = 196, BOOK_ON = 49;                       // Nov 1 .. May 15; textbook freeze-up Dec 20 (median ice-on)
const fmtDate = (w, i) => { const d = new Date(Date.UTC(+w.slice(0, 4), 10, 1 + i)); return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }); };
const dayIdx = (w, iso) => Math.round((Date.parse(iso) - Date.parse(`${w.slice(0, 4)}-11-01`)) / 864e5);
const inch = m => m / IN;
const f1 = x => x.toFixed(1);

// ---------------- data ----------------
const WKEYS = Object.keys(MADISON.winters).filter(w => MENDOTA.winters.find(r => r.w === w && r.on)).sort();
const recOf = w => MENDOTA.winters.find(r => r.w === w);

// ---------------- state ----------------
const S = {
  mode: "real", winter: "2013-14", dT: 0, snowFrac: DEFAULTS.snowFrac, wind: DEFAULTS.wind,
  Ta: -10, snowCm: 0, day: 0, run: null, days: null, iceOn: null,
};
function weatherDays() {
  if (S.mode === "book") return Array.from({ length: NDAYS }, () => ({ T: S.Ta, snow: S.snowCm }));
  const W = MADISON.winters[S.winter];
  return W.T.map((T, i) => ({ T: T + S.dT, snow: W.snow[i] }));
}
function recompute(keepDay = true) {
  S.days = weatherDays();
  if (S.mode === "book") S.iceOn = BOOK_ON;
  else {
    const on0 = dayIdx(S.winter, recOf(S.winter).on);
    S.iceOn = S.dT ? freezeUpIndex(MADISON.winters[S.winter].T, on0, S.dT) : on0;
  }
  const opts = { wind: S.wind, snowFrac: S.mode === "book" ? 1 : S.snowFrac };
  S.run = S.iceOn === null ? null : runWinter(S.days, S.iceOn, opts);
  if (!keepDay) S.day = S.iceOn === null ? 0 : Math.max(0, S.iceOn - 6);
  $("scrub").max = NDAYS - 1;
  updateNote(); drawSeason(); refreshAll();
}

// ---------------- three.js scene (Part H: physical sky, IBL, soft shadows, post-processing) ----------------
const stage = $("stage");
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, stencil: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.56;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.prepend(renderer.domElement);
const scene = new THREE.Scene();
const overlay = new THREE.Scene();          // labels, ruler, callout and beacon: drawn after AO, never shaded
const HORIZON = new THREE.Color("#c9d6e3");
scene.fog = new THREE.Fog(HORIZON, 2500, 16000);
const SUN_DIR = new THREE.Vector3(-0.42, 0.30, -0.86).normalize();   // low winter sun, slightly behind the view: glints and long shadows
const { env } = makeSky(renderer, scene, SUN_DIR);
const camera = new THREE.PerspectiveCamera(38, 1, 0.02, 16000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.495; controls.minDistance = 0.4; controls.maxDistance = 900;
scene.add(new THREE.HemisphereLight("#dfe9f7", "#9aa6b2", 0.22));
const sun = new THREE.DirectionalLight("#fff1dc", 3.2);
sun.castShadow = true;
const POST = makePost(renderer, scene, overlay, camera);
sun.shadow.mapSize.setScalar(POST.tier === "low" ? 1024 : 2048);
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3;
scene.add(sun, sun.target);
function fitShadow() {   // keep a tight shadow box around what the camera is looking at
  const t = controls.target, d = camera.position.distanceTo(t), ext = Math.min(140, Math.max(4, d * 0.9));
  sun.target.position.copy(t); sun.position.copy(t).addScaledVector(SUN_DIR, 300);
  const c = sun.shadow.camera; if (Math.abs(c.right - ext) > ext * 0.1) { Object.assign(c, { left: -ext, right: ext, top: ext, bottom: -ext, near: 50, far: 600 }); c.updateProjectionMatrix(); }
}
const SNOW = snowMaps([60, 60]), BLACK = blackIceMaps([12, 12]);
const LAKE = 400, HALF = LAKE / 2, WDEPTH = 8;   // lake block (m); front face z = +HALF is the cutaway
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...o });
// temperature texture for the ice front face (vertical: top row = ice surface)
const profCanvas = document.createElement("canvas"); profCanvas.width = 1; profCanvas.height = 64;
const profTex = new THREE.CanvasTexture(profCanvas); profTex.colorSpace = THREE.SRGBColorSpace;
const waterCanvas = document.createElement("canvas"); waterCanvas.width = 1; waterCanvas.height = 64;
{ const g = waterCanvas.getContext("2d"), gr = g.createLinearGradient(0, 0, 0, 64);
  gr.addColorStop(0, "#2f6690"); gr.addColorStop(0.4, "#245580"); gr.addColorStop(1, "#163a5c");
  g.fillStyle = gr; g.fillRect(0, 0, 1, 64); }
const waterTex = new THREE.CanvasTexture(waterCanvas); waterTex.colorSpace = THREE.SRGBColorSpace;

const iceTop = new THREE.MeshPhysicalMaterial({ color: "#ffffff", map: BLACK.map, normalMap: BLACK.normal, normalScale: new THREE.Vector2(0.25, 0.25), roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.3 });
const iceSide = new THREE.MeshPhysicalMaterial({ color: "#6f9bb3", roughness: 0.1, clearcoat: 1 });
const iceFrontTemp = new THREE.MeshBasicMaterial({ map: profTex, toneMapped: false });
const iceFrontReal = new THREE.MeshPhysicalMaterial({ map: iceFaceTexture(), roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.03, emissive: "#0d2a3a", emissiveIntensity: 0.6, envMapIntensity: 1.1 });
let iceFront = iceFrontReal;
const ice = new THREE.Mesh(new THREE.BoxGeometry(LAKE, 1, LAKE), [iceSide, iceSide, iceTop, iceSide, iceFront, iceSide]);
function setFace(real) { iceFront = real ? iceFrontReal : iceFrontTemp; ice.material[4] = iceFront; S.face = real ? "real" : "temp"; document.querySelectorAll("#face-seg button").forEach(b => b.setAttribute("aria-pressed", String((b.dataset.f === "real") === real))); }
ice.receiveShadow = true; scene.add(ice);
const snowMat = new THREE.MeshPhysicalMaterial({ color: "#f3f6fa", map: SNOW.map, normalMap: SNOW.normal, normalScale: new THREE.Vector2(1.7, 1.7), roughnessMap: SNOW.rough, roughness: 0.92, sheen: 0.4, sheenColor: new THREE.Color("#dfeaff"), sheenRoughness: 0.6 });
const snow = new THREE.Mesh(new THREE.BoxGeometry(LAKE, 1, LAKE), snowMat); snow.receiveShadow = true; scene.add(snow);
const waterFront = new THREE.MeshBasicMaterial({ map: waterTex, toneMapped: false, transparent: true, opacity: 0.38, depthWrite: false });
const waterSide = std("#24506f", { roughness: 0.2 });
const openWater = new THREE.MeshPhysicalMaterial({ color: "#1d3b50", roughness: 0.05, metalness: 0, clearcoat: 1, envMapIntensity: 1.2 });
const water = new THREE.Mesh(new THREE.BoxGeometry(LAKE, WDEPTH, LAKE), [waterSide, waterSide, openWater, waterSide, waterFront, waterSide]);
scene.add(water);
// lake bottom hint and front-face labels
function labelSprite(text, w = 3.2, color = "#0f1a24", bg = "rgba(255,255,255,.88)") {
  const c = document.createElement("canvas"); c.width = 512; c.height = 128;
  const g = c.getContext("2d"); g.fillStyle = bg; g.beginPath(); g.roundRect(4, 4, 504, 120, 22); g.fill();
  g.fillStyle = color; g.font = "600 54px Barlow, system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, 256, 66);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false })); s.scale.set(w, w / 4, 1); s.renderOrder = 20; return s;
}
const lblWater = labelSprite("lake water, 0–4 °C", 0.42); overlay.add(lblWater);
const lblIce = labelSprite("ice", 0.2); overlay.add(lblIce);
const lblSnow = labelSprite("snow", 0.2); overlay.add(lblSnow);
// measuring stick on the cut face: 36 in, inches on the left, centimetres on the right
const RULER_IN = 36, RULER_LEN = RULER_IN * 0.0254;
const rulerFace = (() => {
  const c = document.createElement("canvas"); c.width = 160; c.height = 1440; const g = c.getContext("2d");
  g.fillStyle = "rgba(255,255,255,0.93)"; g.fillRect(0, 0, 160, 1440);
  g.fillStyle = "#1d2733"; g.strokeStyle = "#1d2733"; g.textBaseline = "middle";
  const py = 1440 / RULER_IN;
  for (let i = 0; i <= RULER_IN; i++) { const y = i * py, L = i % 6 === 0 ? 46 : i % 2 === 0 ? 28 : 18; g.lineWidth = i % 6 ? 2 : 4; g.beginPath(); g.moveTo(0, y); g.lineTo(L, y); g.stroke();
    if (i % 6 === 0 && i > 0 && i < RULER_IN) { g.font = "700 30px Barlow Semi Condensed, Arial Narrow, sans-serif"; g.fillText(`${i} in`, 52, y); } }
  const pc = 1440 / (RULER_LEN * 100);
  for (let k = 0; k <= RULER_LEN * 100; k += 1) { const y = k * pc; if (k % 5) continue; const L = k % 10 ? 14 : 30; g.lineWidth = k % 10 ? 2 : 3; g.beginPath(); g.moveTo(160, y); g.lineTo(160 - L, y); g.stroke();
    if (k % 20 === 0 && k > 0 && k < RULER_LEN * 100 - 5) { g.font = "600 22px JetBrains Mono, monospace"; g.textAlign = "right"; g.fillText(`${k}cm`, 158 - 32, y); g.textAlign = "left"; } }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
})();
const RULER_X = -0.62;
const rulerMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.16, RULER_LEN), new THREE.MeshBasicMaterial({ map: rulerFace, transparent: true, toneMapped: false, depthWrite: false }));
rulerMesh.position.set(RULER_X, -RULER_LEN / 2, HALF + 0.012); rulerMesh.renderOrder = 15; overlay.add(rulerMesh);
// red thickness bracket and a live callout next to the stick
const bracketMat = new THREE.MeshBasicMaterial({ color: "#c5050c", toneMapped: false });
const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.012, 1, 0.004), bracketMat);
const capTop = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.008, 0.004), bracketMat), capBot = capTop.clone();
overlay.add(bracket, capTop, capBot);
// crisp lines on the cut face: ice top (white) and the freezing front (dark)
const frontLine = new THREE.Mesh(new THREE.BoxGeometry(LAKE, 0.006, 0.004), new THREE.MeshBasicMaterial({ color: "#0b2236", toneMapped: false }));
const topLine = new THREE.Mesh(new THREE.BoxGeometry(LAKE, 0.004, 0.004), new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false }));
overlay.add(frontLine, topLine);
const calloutCanvas = document.createElement("canvas"); calloutCanvas.width = 512; calloutCanvas.height = 200;
const calloutTex = new THREE.CanvasTexture(calloutCanvas); calloutTex.colorSpace = THREE.SRGBColorSpace;
const callout = new THREE.Sprite(new THREE.SpriteMaterial({ map: calloutTex, depthTest: false, toneMapped: false })); callout.renderOrder = 25; callout.scale.set(0.42, 0.164, 1); overlay.add(callout);
let calloutText = "";
function drawCallout(h) {
  const t = h > 0 ? `${(h / 0.0254).toFixed(1)} in|${(h * 100).toFixed(1)} cm of ice` : "open water|no ice yet";
  if (t === calloutText) return; calloutText = t;
  const g = calloutCanvas.getContext("2d"); g.clearRect(0, 0, 512, 200);
  g.fillStyle = "rgba(255,255,255,0.95)"; g.strokeStyle = "#c5050c"; g.lineWidth = 6; g.beginPath(); g.roundRect(6, 6, 500, 188, 22); g.fill(); g.stroke();
  const [a, b] = t.split("|"); g.textAlign = "center"; g.fillStyle = "#c5050c"; g.font = "700 92px Barlow Semi Condensed, Arial Narrow, sans-serif"; g.fillText(a, 256, 92);
  g.fillStyle = "#1d2733"; g.font = "600 44px Barlow, sans-serif"; g.fillText(b, 256, 160); calloutTex.needsUpdate = true;
}

// ---- the wider lake, shores, forest and the Madison skyline ----
const rng = rngFrom(7);
const farLake = new THREE.Mesh(new THREE.PlaneGeometry(9000, 6000), snowMat); farLake.rotation.x = -Math.PI / 2; farLake.position.set(0, -0.003, -2800); farLake.receiveShadow = true; scene.add(farLake);
const sideLake = new THREE.Mesh(new THREE.PlaneGeometry(4000, 800), snowMat); sideLake.rotation.x = -Math.PI / 2; sideLake.position.set(2200, -0.003, 0); scene.add(sideLake);
const nearShoreMat = new THREE.MeshPhysicalMaterial({ color: "#ffffff", map: SNOW.map, normalMap: SNOW.normal, roughness: 0.95 });
const noise = (x, z) => Math.sin(x * 0.013) * Math.cos(z * 0.011) + 0.5 * Math.sin(x * 0.031 + z * 0.023);
// Picnic Point-like shore: a wooded finger of land reaching out into the lake on the left of the view
const PP = { a: new THREE.Vector2(-HALF - 60, 260), b: new THREE.Vector2(-260, -1150) };   // base and tip of the point
function landDist(X, Z) {   // > 0 on land: metres inside the shoreline
  const shore = (-HALF - 40 + 25 * Math.sin(Z / 140) + 12 * Math.sin(Z / 47)) - X;
  const ab = PP.b.clone().sub(PP.a), t = Math.max(0, Math.min(1, new THREE.Vector2(X, Z).sub(PP.a).dot(ab) / ab.lengthSq()));
  const c = PP.a.clone().addScaledVector(ab, t), half = 70 * (1 - t) + 22 * t + 10 * Math.sin(t * 19);
  return Math.max(shore, half - Math.hypot(X - c.x, Z - c.y));
}
const landH = (X, Z) => { const d = landDist(X, Z); return d < 0 ? -1.5 : Math.min(1, d / 18) * (1.2 + Math.max(0, (-HALF - 60 - X) / 300) * 18 + noise(X, Z) * 1.2); };
const NS = { cx: -705, cz: -555, w: 1110, d: 1490 };   // world X -1260..-150, Z -1300..190 (never in front of the cut face)
const nearShore = makeTerrain(NS.w, NS.d, 200, (x, z) => landH(x + NS.cx, z + NS.cz), nearShoreMat);
nearShore.position.set(NS.cx, 0, NS.cz); scene.add(nearShore);
const farShore = makeTerrain(9000, 1400, 120, (x, z) => 2 + Math.max(0, (-z + 700) / 1400) * 40 + noise(x * 0.4, z * 0.4) * 14, nearShoreMat);
farShore.position.set(0, 0, -3400); scene.add(farShore);
const eastShore = makeTerrain(1200, 3600, 60, (x, z) => 1 + Math.max(0, (x + 600) / 1200) * 30 + noise(x * 0.5, z * 0.5) * 8, nearShoreMat);
eastShore.position.set(3600, 0, -1200); scene.add(eastShore);
{
  // species mix of the Lakeshore Nature Preserve: mostly bare oaks, maples and basswood, some white and red pine, shrub thickets
  const pick = r => r < 0.34 ? "oak" : r < 0.56 ? "maple" : r < 0.72 ? "basswood" : r < 0.82 ? "pine" : r < 0.88 ? "redpine" : "shrub";
  const pts = [];
  for (let i = 0; i < 9000 && pts.length < 2200; i++) {
    const X = -1260 + rng() * 1110, Z = -1300 + rng() * 1490, d = landDist(X, Z); if (d < 4) continue;
    let kind = pick(rng()); if (d < 12 && rng() < 0.6) kind = "shrub";
    const h = kind === "shrub" ? 1.5 + rng() * 2 : kind === "redpine" ? 18 + rng() * 8 : kind === "pine" ? 14 + rng() * 10 : 13 + rng() * 9;
    pts.push({ x: X, z: Z, y: landH(X, Z), h, kind });
  }
  for (let i = 0; i < 1600; i++) { const x = -4200 + rng() * 8400, z = -2780 - rng() * 500; pts.push({ x, z, y: 2 + Math.max(0, (-(z + 3400) + 700) / 1400) * 40, h: 14 + rng() * 8, kind: pick(rng() * 0.88) }); }
  for (let i = 0; i < 500; i++) { const x = 3050 + rng() * 500, z = -2800 + rng() * 3200; pts.push({ x, z, y: 1 + Math.max(0, (x - 3000) / 1200) * 30, h: 14 + rng() * 8, kind: pick(rng() * 0.88) }); }
  scene.add(makeWinterWoods(pts, rng));
}
scene.add(makeSkyline(rng, -2900));

// ---- on the ice: shanties, anglers, vehicles (shown only when the ice is thick enough) ----
const onIce = new THREE.Group(); scene.add(onIce);
const shanties = [], anglers = [], vehicles = {};
const SHANTY = [["#9c3b31", -30, 40], ["#3f5f7f", -12, 28], ["#4a6b45", 8, 46], ["#b98a3e", 26, 30], ["#6e5a86", 44, 52], ["#8a8f96", -48, 64], ["#9c3b31", 60, 22], ["#3f5f7f", -8, 112], ["#b98a3e", 18, 128]];
for (const [c, x, z] of SHANTY) { const g = makeShanty(c, rng); g.position.set(x, 0, z); g.rotation.y = rng() * 0.8 - 0.4; onIce.add(g); shanties.push(g); }
const PARKA = ["#b23a2e", "#1f4e79", "#c9761c", "#2e6b3a", "#3a3f46", "#7a2e4f"];
const ANGLER = [[4.3, 149.4, "sit"], [-6, 120, "stand"], [16, 98, "sit"], [-22, 84, "stand"], [32, 70, "sit"], [-36, 104, "sit"], [-24, 44, "stand"], [12, 52, "sit"], [34, 38, "stand"], [-6, 36, "sit"], [9.6, 146.2, "stand"], [0.8, 145.8, "sit"], [6.6, 142.6, "stand"]];
// the four named anglers (index into ANGLER): Olaf, Bob, Warren, Ed — each with a parka of his own
const NAMED = [{ name: "Olaf", i: 10, parka: "#7a2e1f", rot: 2.9 }, { name: "Bob", i: 0 }, { name: "Warren", i: 11, parka: "#2e5a3a", rot: 1.9 }, { name: "Ed", i: 12, parka: "#c77a1c", rot: 3.5 }];
ANGLER.forEach(([x, z, pose], i) => { const nm = NAMED.find(n => n.i === i && n.parka);
  const g = i === 0 ? makeAngler(rng, pose, "#2f3a4a", "#2b2f36", { elder: true }) : makeAngler(rng, pose, nm ? nm.parka : PARKA[i % PARKA.length]);
  g.position.set(x, 0, z); g.rotation.y = i === 0 ? 2.4 : nm ? nm.rot : rng() * Math.PI * 2; onIce.add(g); anglers.push(g); });
// under the ice: a deep-water backdrop and fish swimming just behind the see-through cut face
const waterBack = new THREE.Mesh(new THREE.PlaneGeometry(LAKE, WDEPTH), new THREE.MeshBasicMaterial({ map: waterTex, toneMapped: false, color: "#8aa9c4" }));
scene.add(waterBack);
const FISH = [];
[["perch", 6], ["bluegill", 5], ["walleye", 2], ["pike", 1]].forEach(([k, n]) => { for (let i = 0; i < n; i++) {
  const f = makeFish(k); f.userData.kind = k; f.userData.ph = rng() * 10; f.userData.sp = (k === "pike" ? 0.12 : 0.25) * (0.6 + rng() * 0.8) * (rng() < 0.5 ? -1 : 1);
  f.userData.x0 = (rng() - 0.5) * 6; f.userData.z = HALF - 0.4 - rng() * 2.6; f.userData.d = 0.15 + rng() * 0.75; f.userData.amp = 0.6 + rng() * 2.5; scene.add(f); FISH.push(f); } });
// name tag over the tribute angler (Prof. R. Byron Bird): small, readable at any distance
NAMED.forEach(n => { n.el = document.createElement("div"); n.el.className = "name-tag"; n.el.textContent = n.name; n.el.setAttribute("aria-hidden", "true"); $("stage").appendChild(n.el); });
const PLACE_TAGS = [["Madison skyline", new THREE.Vector3(120, 110, -3080)]].map(([t, p]) => {
  const el = document.createElement("div"); el.className = "name-tag place"; el.textContent = t; el.setAttribute("aria-hidden", "true"); $("stage").appendChild(el); return { el, p }; });   // plain red text over the scene, kept clear of the ChemE spots
const _bob = new THREE.Vector3();
const hb2 = h => h;
const SPARKLE = makeSparkle(POST.tier === "low" ? 15000 : 60000, { x0: -90, x1: 90, z0: -40, z1: HALF - 0.3 }, rng);
SPARKLE.material.uniforms.uSun.value.copy(SUN_DIR); scene.add(SPARKLE);
// the featured auger hole near the camera: walls show the true ice thickness
const SHIFT = 26;   // the village and anglers sit 26 m closer to the cutaway than they were built, for a readable overview
onIce.position.z = SHIFT;
const HOLE = new THREE.Vector3(6, 0, 150 + SHIFT);
// The hole is seen through a stencil mask, because the ice slab itself is a solid box.
const HR = 0.11;
const rulerCanvas = document.createElement("canvas"); rulerCanvas.width = 8; rulerCanvas.height = 64;
{ const g = rulerCanvas.getContext("2d"); g.fillStyle = "#cfe8f6"; g.fillRect(0, 0, 8, 64); g.fillStyle = "#3d6f8f"; g.fillRect(0, 0, 8, 4); }
const rulerTex = new THREE.CanvasTexture(rulerCanvas); rulerTex.wrapS = rulerTex.wrapT = THREE.RepeatWrapping; rulerTex.colorSpace = THREE.SRGBColorSpace;
const stIn = { stencilWrite: true, stencilRef: 1, stencilFunc: THREE.EqualStencilFunc, stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp, stencilZPass: THREE.KeepStencilOp, depthTest: false };
const holeMask = new THREE.Mesh(new THREE.CircleGeometry(HR, 32), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, stencilWrite: true, stencilRef: 1, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp }));
holeMask.rotation.x = -Math.PI / 2; holeMask.renderOrder = 40;
const holeWall = new THREE.Mesh(new THREE.CylinderGeometry(HR, HR, 1, 32, 1, true), new THREE.MeshBasicMaterial({ map: rulerTex, side: THREE.BackSide, ...stIn }));
holeWall.renderOrder = 42;
const holeWater = new THREE.Mesh(new THREE.CircleGeometry(HR, 32), new THREE.MeshBasicMaterial({ color: "#0f2c40", ...stIn }));
holeWater.rotation.x = -Math.PI / 2; holeWater.renderOrder = 41;
const holeRim = new THREE.Mesh(new THREE.RingGeometry(HR, HR + 0.06, 32), std("#c9d8e3")); holeRim.rotation.x = -Math.PI / 2;
const auger = new THREE.Group();
{ const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.3, 8), std("#9aa3ab", { metalness: 0.8, roughness: 0.3 })); shaft.position.y = 0.65;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.22), std("#c0392b")); head.position.y = 1.35;
  auger.add(shaft, head); auger.position.set(HOLE.x + 0.5, 0, HOLE.z - 0.25); auger.rotation.z = 0.5; }
const ruler = new THREE.Group();
scene.add(holeMask, holeWall, holeWater, holeRim, auger, ruler);
const chips = makeIceChips(rng, 10); chips.position.set(HOLE.x, 0, HOLE.z - SHIFT); onIce.add(chips);
// vehicles
function vehicle(kind) {
  const g = new THREE.Group();
  if (kind === "sled") {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 2.4), std("#1f6fb2", { roughness: 0.5 })); b.position.y = 0.45;
    const ws = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.35, 0.05), std("#333", { transparent: true, opacity: 0.6 })); ws.position.set(0, 0.85, 0.5); ws.rotation.x = -0.4;
    const ski = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 2.6), std("#222")); ski.position.y = 0.1;
    g.add(b, ws, ski);
  } else {
    const L = kind === "truck" ? 5.6 : 4.3, H = kind === "truck" ? 1.9 : 1.45, col = kind === "truck" ? "#5b6770" : "#a23b3b";
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, H * 0.55, L), std(col, { roughness: 0.4, metalness: 0.3 })); body.position.y = 0.45 + H * 0.27;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.75, H * 0.45, kind === "truck" ? 2.2 : 2.4), std("#2d3238", { roughness: 0.2, metalness: 0.4 })); cab.position.set(0, 0.45 + H * 0.77, kind === "truck" ? 0.9 : 0);
    g.add(body, cab);
    for (const sx of [-0.85, 0.85]) for (const sz of [-L * 0.33, L * 0.33]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.25, 16), std("#1b1b1b")); w.rotation.z = Math.PI / 2; w.position.set(sx, 0.36, sz); g.add(w);
    }
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  onIce.add(g); return g;
}
vehicles.sled = vehicle("sled"); vehicles.sled.position.set(-14, 0, 118); vehicles.sled.rotation.y = 0.9;
vehicles.car = vehicle("car"); vehicles.car.position.set(30, 0, 92); vehicles.car.rotation.y = -0.5;
vehicles.truck = vehicle("truck"); vehicles.truck.position.set(-40, 0, 40); vehicles.truck.rotation.y = 0.3;
// thin-ice warning sign on the near shore and a record board, a weather mast
function signboard(lines, w, h, bg, fg) {
  const c = document.createElement("canvas"); c.width = 512; c.height = Math.round(512 * h / w);
  const g = c.getContext("2d"); g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = fg; g.textAlign = "center"; g.textBaseline = "middle";
  lines.forEach((ln, i) => { g.font = `700 ${ln[1]}px Barlow Semi Condensed, Arial Narrow, sans-serif`; g.fillText(ln[0], 256, c.height * (i + 1) / (lines.length + 1)); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const grp = new THREE.Group();
  const board = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), [std("#ddd"), std("#ddd"), std("#ddd"), std("#ddd"), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }), std("#ddd")]);
  board.position.y = 1.2 + h / 2; board.castShadow = true;
  for (const sx of [-w / 2 + 0.1, w / 2 - 0.1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.3 + h, 6), std("#4b3b2c")); p.position.set(sx, (1.3 + h) / 2, -0.06); grp.add(p); }
  grp.add(board); return grp;
}
const warnSign = signboard([["THIN ICE", 120], ["STAY OFF", 84]], 1.6, 1.0, "#c5050c", "#ffffff");
warnSign.position.set(-HALF - 3, 0, 150); warnSign.rotation.y = Math.PI / 2; scene.add(warnSign);
const recordBoard = signboard([["LAKE MENDOTA ICE", 60], ["records since the 1850s", 44]], 2.4, 1.2, "#f3efe6", "#26313a");
recordBoard.position.set(9, 0, 184); recordBoard.rotation.y = -0.3; scene.add(recordBoard);
const mast = new THREE.Group();
{ const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 6, 8), std("#9aa3ab", { metalness: 0.7, roughness: 0.35 })); p.position.y = 3;
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.3), std("#e8e8e8")); box.position.set(0, 1.6, 0.18);
  const cups = new THREE.Group(); cups.position.y = 6.1;
  for (let i = 0; i < 3; i++) { const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 5), std("#555")); arm.rotation.z = Math.PI / 2; arm.position.x = 0.25; const cup = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 6, 0, Math.PI), std("#333")); cup.position.x = 0.5; const a = new THREE.Group(); a.add(arm, cup); a.rotation.y = i * Math.PI * 2 / 3; cups.add(a); }
  mast.add(p, box, cups); mast.position.set(-11, 0, 182); mast.userData.cups = cups; scene.add(mast); }
// wind streaks over the ice
const N_WIND = 160;
const windGeo = new THREE.BufferGeometry(); const windPos = new Float32Array(N_WIND * 6);
for (let i = 0; i < N_WIND; i++) { const x = (rng() - 0.5) * LAKE, y = 0.3 + rng() * 4, z = (rng() - 0.5) * LAKE; windPos.set([x, y, z, x + 2, y, z], i * 6); }
windGeo.setAttribute("position", new THREE.BufferAttribute(windPos, 3));
const windLines = new THREE.LineSegments(windGeo, new THREE.LineBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.55 }));
scene.add(windLines);

// beacon for lens stops
const beacon = new THREE.Group(); beacon.visible = false; overlay.add(beacon);
{ const mat = new THREE.MeshBasicMaterial({ color: "#e0262c", transparent: true, opacity: 0.9, depthTest: false });
  const r1 = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 10, 48).rotateX(Math.PI / 2), mat); r1.renderOrder = 30;
  const r2 = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.05, 10, 48).rotateX(Math.PI / 2), mat.clone()); r2.material.opacity = 0.5; r2.renderOrder = 30;
  beacon.add(r1, r2); }

// anchors used by spots, lenses and beacons (depend on the current ice and snow)
function anchor(key) {
  const h = curH(), s = curSnow();
  switch (key) {
    case "front": return [new THREE.Vector3(0.55, -h, HALF + 0.01), 0.07];
    case "ice": return [new THREE.Vector3(0.15, -h / 2, HALF + 0.01), 0.07];
    case "snow": return [new THREE.Vector3(-0.25, s + 0.02, HALF - 0.3), 0.1];
    case "water": return [new THREE.Vector3(0.95, -h - 0.7, HALF + 0.01), 0.1];
    case "wind": return [new THREE.Vector3(-16, 3, 128 + SHIFT), 3];
    case "hole": return [HOLE.clone().setY(0.02), 0.35];
    case "station": return [mast.position.clone().setY(6.2), 1.2];
    case "shore": return [recordBoard.position.clone().setY(2.6), 1.6];
  }
}

const VIEWS = {
  edge:    { p: [0.55, 0.42, HALF + 1.9], c: [-0.45, -0.32, HALF - 1.2], fov: 46 },
  lake:    { p: [-0.3, 1.9, 206.2], c: [-1.6, 0.1, 176], fov: 58 },   // centred on the ice-edge ruler and thickness reading   // overview: ice edge, Bob, auger hole, village, far shore
  village: { p: [13, 3.6, 158.5 + SHIFT], c: [4.5, 0.6, 143 + SHIFT], fov: 46 },   // Olaf, Bob, Warren and Ed in the foreground, the village behind
  hole:    { p: [HOLE.x + 0.28, 0.62, HOLE.z + 0.36], c: [HOLE.x, -0.12, HOLE.z], fov: 42 },
  cutaway: { p: [-0.4, -0.3, HALF + 1.55], c: [-0.4, -0.36, HALF], fov: 45 },
};
let tween = null;
function goTo(name, instant = false) {
  const v = VIEWS[name]; const to = { p: new THREE.Vector3(...v.p), c: new THREE.Vector3(...v.c), fov: v.fov };
  if (name === "lake" && stage.clientWidth < stage.clientHeight * 1.1) { to.p.z += 10; to.p.y += 2.5; to.fov = 78; }   // narrow screens: keep every spot in frame
  if ((name === "edge" || name === "cutaway") && stage.clientWidth < stage.clientHeight * 1.1) {   // narrow screens: keep the stick and callout in frame
    to.p.x -= 0.45; to.c.x -= 0.45; to.p.z += 0.5; to.fov = v.fov + 12;
  }
  markView(name);
  if (instant || matchMedia("(prefers-reduced-motion: reduce)").matches) { camera.position.copy(to.p); controls.target.copy(to.c); camera.fov = to.fov; camera.updateProjectionMatrix(); controls.update(); return; }
  tween = { from: { p: camera.position.clone(), c: controls.target.clone(), fov: camera.fov }, to, t0: performance.now(), dur: 1400 };
}
function markView(name) { document.querySelectorAll(".views [data-view]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.view === name))); }
document.querySelectorAll("[data-view]").forEach(b => b.onclick = () => goTo(b.dataset.view));

// ---------------- per-day values ----------------
const curIdx = () => Math.min(NDAYS - 1, Math.max(0, Math.floor(S.day)));
function curH() { const r = S.run; if (!r) return 0; const i = curIdx(); return r.h[i] || 0; }
function curSnow() { const r = S.run; if (!r) return 0; return r.snow[curIdx()] || 0; }
const isOpen = () => curH() <= 0;
// colormap for ice temperature, -20 .. 0 °C (dark violet -> white-blue)
const CMAP = ["#1d1160", "#3557c9", "#4fa3e0", "#9ad7f2", "#e6f7ff"].map(c => new THREE.Color(c));
function tcolor(T) { const u = Math.min(1, Math.max(0, (T + 15) / 15)) * (CMAP.length - 1); const i = Math.min(CMAP.length - 2, Math.floor(u)); return CMAP[i].clone().lerp(CMAP[i + 1], u - i); }
function drawProfiles() {
  const r = S.run, i = curIdx(); const prof = r && r.prof[i];
  const pc = $("prof"), g = pc && pc.getContext("2d"), gi = profCanvas.getContext("2d");
  for (let x = 0; x < 256; x++) {
    let T = 0;
    if (prof) { const u = x / 255 * (prof.length - 1), j = Math.min(prof.length - 2, Math.floor(u)); T = prof[j] + (prof[j + 1] - prof[j]) * (u - j); }
    if (g) { g.fillStyle = prof ? "#" + tcolor(T).getHexString() : "#7a8a99"; g.fillRect(x, 0, 1, 1); }
  }
  for (let y = 0; y < 64; y++) {
    let T = 0;
    if (prof) { const u = y / 63 * (prof.length - 1), j = Math.min(prof.length - 2, Math.floor(u)); T = prof[j] + (prof[j + 1] - prof[j]) * (u - j); }
    gi.fillStyle = "#" + tcolor(T).getHexString(); gi.fillRect(0, y, 1, 1);
  }
  profTex.needsUpdate = true;
}
function updateScene() {
  const h = curH(), s = curSnow(), open = isOpen();
  ice.visible = !open; snow.visible = !open && s > 0.002;
  ice.scale.y = Math.max(h, 0.001); ice.position.y = -h / 2;
  snow.scale.y = Math.max(s, 0.001); snow.position.y = s / 2;
  water.position.y = -h - WDEPTH / 2;
  water.material[2].color.set(open ? "#355d78" : "#2a4d66");
  // white top when snowy, bluish clear ice otherwise
  farLake.material = sideLake.material = open ? openWater : (s > 0.002 ? snowMat : iceTop);
  SPARKLE.visible = !open && s > 0.002; SPARKLE.position.y = s;
  lblWater.position.set(0.55, -h - 0.22, HALF + 0.05);
  lblIce.position.set(0.25, -h / 2, HALF + 0.05); lblIce.visible = !open && h > 0.08;
  lblSnow.position.set(0.25, s + 0.06, HALF + 0.05); lblSnow.visible = snow.visible;
  const hb = Math.max(h, 0.002);
  bracket.visible = capTop.visible = capBot.visible = !open;
  bracket.scale.y = hb; bracket.position.set(RULER_X - 0.11, -hb / 2, HALF + 0.02);
  capTop.position.set(RULER_X - 0.11, 0, HALF + 0.02); capBot.position.set(RULER_X - 0.11, -hb, HALF + 0.02);
  callout.position.set(RULER_X - 0.36, open ? -0.1 : -hb / 2, HALF + 0.05); drawCallout(open ? 0 : h);
  callout.visible = false; lblWater.visible = false;   // replaced by the large on-screen labels below
  $("ice-big").innerHTML = open ? `<b>Open water</b><span>no ice yet</span>` : `<b>${f1(inch(h))} in</b><span>${(h * 100).toFixed(1)} cm of ice</span>`;
  frontLine.visible = topLine.visible = !open; frontLine.position.set(0, -hb, HALF + 0.004); topLine.position.set(0, 0, HALF + 0.004);
  holeMask.visible = holeWall.visible = holeWater.visible = holeRim.visible = auger.visible = !open && h > 0.03;
  holeWall.scale.y = Math.max(h + s, 0.001); holeWall.position.set(HOLE.x, (s - h) / 2, HOLE.z);
  rulerTex.repeat.set(1, (h + s) / IN); rulerTex.offset.y = -((s) / IN) % 1;
  holeWater.position.set(HOLE.x, -h - 0.03, HOLE.z); holeRim.position.set(HOLE.x, s + 0.004, HOLE.z); holeMask.position.set(HOLE.x, s + 0.006, HOLE.z);
  const lvl = open ? 0 : safetyLevel(h);
  const walk = lvl >= 1;
  anglers.forEach(a => { a.visible = walk; });
  shanties.forEach(g => { g.visible = walk; });
  vehicles.sled.visible = lvl >= 2; vehicles.car.visible = lvl >= 4; vehicles.truck.visible = lvl >= 6;
  onIce.position.y = s;
  warnSign.visible = !walk;
  drawProfiles();
}

// ---------------- readouts ----------------
function inchCm(m) { return `${f1(inch(m))} in · ${Math.round(m * 100)} cm`; }
function refreshAll() {
  const r = S.run, i = curIdx(), w = S.mode === "book" ? "2025-26" : S.winter;
  const h = curH(), open = isOpen(), d = S.days[i];
  $("r-h").innerHTML = open ? "Open water" : `${f1(inch(h))} in<small>${(h * 100).toFixed(1)} cm</small>`;
  $("r-date").textContent = `${fmtDate(w, i)}${S.mode === "real" ? `, winter ${S.winter}` : ", textbook winter"}`;
  const lvl = open ? -1 : safetyLevel(h), chip = $("r-status");
  chip.textContent = open ? (S.iceOn !== null && i < S.iceOn ? "Not frozen yet" : r && r.open !== null && i >= r.open ? "Ice out" : "Open water") : SAFETY[lvl].short;
  chip.className = "status-chip " + (open ? "water" : lvl === 0 ? "off" : "go");
  $("r-air").textContent = `${f1(d.T)} °C`;
  $("r-snow").textContent = open ? "–" : `${(curSnow() * 100).toFixed(1)} cm`;
  $("r-stefan").textContent = r && r.hStefan[i] !== null ? inchCm(r.hStefan[i]) : "–";
  const iw = r ? firstDayAtLeast(r.h, 4 * IN) : null;
  $("r-walk").textContent = iw === null ? "not this winter" : `${fmtDate(w, iw)}, day ${iw - S.iceOn + 1} of ice`;
  if (r) { const hh = r.h.map(x => x || 0), pk = Math.max(...hh); $("r-peak").textContent = pk > 0 ? `${f1(inch(pk))} in, ${fmtDate(w, hh.indexOf(pk))}` : "–"; }
  else $("r-peak").textContent = "never froze";
  const rec = S.mode === "real" ? recOf(S.winter) : null;
  const mOn = S.iceOn === null ? "no freeze" : fmtDate(w, S.iceOn), mOff = r && r.open !== null ? fmtDate(w, r.open) : "after May 15";
  $("r-onoff").textContent = `${mOn} → ${mOff}`; $("r-onoff").title = rec ? `Record: ${fmtDate(w, dayIdx(w, rec.on))} → ${fmtDate(w, dayIdx(w, rec.off))}` : "";
  const q = r && !open ? r.qBot[i] : 0;
  $("tag").textContent = `${fmtDate(w, i)} · air ${f1(d.T)} °C · wind ${S.wind} m/s · snow on ice ${(curSnow() * 100).toFixed(1)} cm · ice ${(h * 100).toFixed(1)} cm · heat out ${q.toFixed(0)} W/m²`;
  $("clock").textContent = fmtDate(w, i);
  $("scrub").value = i;
  updateScene(); drawSeasonCursor(); lensRefresh(); if (mdlOpen) refreshModelLive();
  takeawayNow(); takeawayWeather();
}
function updateNote() {
  let t;
  if (S.mode === "book") t = `Textbook: ${S.Ta} °C daily from 20 Dec${ref(15)}.`;
  else {
    const rec = recOf(S.winter);
    t = `${S.winter}${ref(10)}: froze ${fmtDate(S.winter, dayIdx(S.winter, rec.on))}, opened ${fmtDate(S.winter, dayIdx(S.winter, rec.off))}${ref(9)}.`;
    if (S.dT) t += S.iceOn === null ? ` At +${S.dT} °C it never freezes.` : ` At +${S.dT} °C it freezes ${fmtDate(S.winter, S.iceOn)}.`;
  }
  $("weather-note").innerHTML = t;
}

// ---------------- charts ----------------
function setupCanvas(c) { const r = c.getBoundingClientRect(), dpr = Math.min(devicePixelRatio, 2); c.width = Math.max(10, Math.round(r.width * dpr)); c.height = Math.max(10, Math.round(r.height * dpr)); const g = c.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); return [g, r.width, r.height]; }
let seasonGeom = null;
function drawSeason() {
  const c = $("season"); const [g, W, H] = setupCanvas(c); g.clearRect(0, 0, W, H);
  const r = S.run, pad = { l: 28, r: 44, t: 16, b: 18 };
  const AT_AT = 36;   // in: a faculty in-joke, drawn like the truck line but not part of the safety guide
  const ymax = Math.max(AT_AT + 2, ...(r ? r.h.concat(r.hStefan, r.hQS).filter(x => x !== null).map(inch) : [0])) * 1.05;
  const X = i => pad.l + (W - pad.l - pad.r) * i / (NDAYS - 1), Y = v => H - pad.b - (H - pad.t - pad.b) * v / ymax;
  seasonGeom = { X, Y, pad, W, H };
  g.font = "10.5px JetBrains Mono, monospace"; g.fillStyle = css("--ink-2"); g.strokeStyle = css("--rule"); g.lineWidth = 1;
  // month grid
  const months = [["Nov", 0], ["Dec", 30], ["Jan", 61], ["Feb", 92], ["Mar", 120], ["Apr", 151], ["May", 181]];
  for (const [m, i] of months) { g.beginPath(); g.moveTo(X(i), pad.t); g.lineTo(X(i), H - pad.b); g.stroke(); g.fillText(m, X(i) + 2, H - 5); }
  for (let v = 0; v <= ymax; v += ymax > 40 ? 10 : 5) { if (Y(v) > pad.t + 4) g.fillText(String(v), 2, Y(v) + 3); }
  g.fillText("inches", 2, 10);
  // safety thresholds: dashed lines, labels in the right margin, spread so they never touch
  g.setLineDash([4, 4]); g.strokeStyle = css("--warn");
  const th = [[4, "walk"], [9, "car"], [13, "truck"]].filter(([v]) => v <= ymax);
  for (const [v] of th) { g.beginPath(); g.moveTo(pad.l, Y(v)); g.lineTo(W - pad.r, Y(v)); g.stroke(); }
  g.setLineDash([]);
  const ly = th.map(([v]) => Y(v) + 3);
  for (let k = 1; k < ly.length; k++) if (ly[k - 1] - ly[k] < 11) ly[k] = ly[k - 1] - 11;
  g.fillStyle = css("--warn"); th.forEach(([, lab], k) => g.fillText(lab, W - pad.r + 4, ly[k]));
  g.setLineDash([1, 4]); g.strokeStyle = css("--accent"); g.lineWidth = 1.2; g.beginPath(); g.moveTo(pad.l, Y(AT_AT)); g.lineTo(W - pad.r, Y(AT_AT)); g.stroke(); g.setLineDash([]); g.lineWidth = 1;
  g.fillStyle = css("--accent"); g.fillText("AT-AT", W - pad.r + 4, Y(AT_AT) + 3);
  if (!r) { g.fillStyle = css("--ink-2"); g.fillText("No ice this winter at this warming.", pad.l + 10, H / 2); takeawaySeason(); return; }
  const line = (arr, color, w, dash = []) => {
    g.beginPath(); g.setLineDash(dash); let on = false;
    arr.forEach((v, i) => { if (v === null) { on = false; return; } const x = X(i), y = Y(inch(v)); if (!on) { g.moveTo(x, y); on = true; } else g.lineTo(x, y); });
    g.strokeStyle = color; g.lineWidth = w; g.stroke(); g.setLineDash([]);
  };
  line(r.hStefan, css("--ink-2"), 1.6, [3, 3]);
  line(r.hQS, css("--signal"), 1.6);
  line(r.h, css("--accent"), 2.2);
  if (S.mode === "real" && !S.dT) { // observed ice-on / ice-off
    const rec = recOf(S.winter); g.fillStyle = css("--ink");
    for (const iso of [rec.on, rec.off]) { const x = X(dayIdx(S.winter, iso)), y = H - pad.b; g.beginPath(); g.moveTo(x, y - 7); g.lineTo(x - 4, y); g.lineTo(x + 4, y); g.closePath(); g.fill(); }
  }
  // observed thickness points
  for (const [w, iso, cm, refn] of [["2011-12", "2012-02-29", 17, 13], ["2013-14", "2014-02-07", 61, 14]]) {
    if (S.mode !== "real" || S.winter !== w || S.dT) continue;
    const i = dayIdx(w, iso); g.fillStyle = css("--ink"); g.strokeStyle = "#fff"; g.lineWidth = 1.5; g.beginPath(); g.arc(X(i), Y(cm / 2.54), 4.5, 0, 7); g.fill(); g.stroke();
  }
  const fitOn = S.fitPts && S.mode === "real" && !S.dT && S.winter === FIT_POINTS.w;   // problem 355-3: synthetic points (model + noise), drawn as hollow diamonds
  if (fitOn) { g.strokeStyle = css("--ink"); g.fillStyle = "#fff"; g.lineWidth = 1.6;
    for (const p of FIT_POINTS.pts) { const x = X(p.i), y = Y(p.cm / 2.54); g.beginPath(); g.moveTo(x, y - 5); g.lineTo(x + 5, y); g.lineTo(x, y + 5); g.lineTo(x - 5, y); g.closePath(); g.fill(); g.stroke(); } }
  $("lg-fit").hidden = !fitOn;
  const meas = S.mode === "real" && !S.dT && (S.winter === "2011-12" || S.winter === "2013-14");
  $("lg-meas").hidden = !meas; $("lg-rec").hidden = !(S.mode === "real" && !S.dT);
  seasonImg = g.getImageData(0, 0, c.width, c.height);
  drawSeasonCursor(); takeawaySeason();
}
let seasonImg = null;
function drawSeasonCursor() {
  const c = $("season"); if (!seasonImg || !seasonGeom) return;
  const g = c.getContext("2d"); g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.putImageData(seasonImg, 0, 0); g.restore();
  const { X, pad, H } = seasonGeom, x = X(curIdx());
  g.strokeStyle = css("--ink"); g.lineWidth = 1; g.beginPath(); g.moveTo(x, pad.t); g.lineTo(x, H - pad.b); g.stroke();
  const h = curH(); if (h > 0) { g.fillStyle = css("--accent"); g.beginPath(); g.arc(x, seasonGeom.Y(inch(h)), 3.5, 0, 7); g.fill(); }
}
// observed record and trend
const RECORD = MENDOTA.winters.filter(r => r.days).map(r => [+r.w.slice(0, 4), r.days, r.w]);
const TREND = (() => { const n = RECORD.length, mx = RECORD.reduce((a, p) => a + p[0], 0) / n, my = RECORD.reduce((a, p) => a + p[1], 0) / n;
  const b1 = RECORD.reduce((a, p) => a + (p[0] - mx) * (p[1] - my), 0) / RECORD.reduce((a, p) => a + (p[0] - mx) ** 2, 0), b0 = my - b1 * mx;
  const res = RECORD.map(p => p[1] - (b0 + b1 * p[0])), sd = Math.sqrt(res.reduce((a, x) => a + x * x, 0) / (n - 2));
  return { b0, b1, n, sd, first: RECORD[0][0], last: RECORD[n - 1][0] }; })();
function drawRecord() {
  const [g, W, H] = setupCanvas($("record")); g.clearRect(0, 0, W, H);
  const pad = { l: 30, r: 8, t: 16, b: 16 }, x0 = 1850, x1 = 2030, y1 = 170;
  const X = y => pad.l + (W - pad.l - pad.r) * (y - x0) / (x1 - x0), Y = v => H - pad.b - (H - pad.t - pad.b) * v / y1;
  g.font = "10.5px JetBrains Mono, monospace"; g.fillStyle = css("--ink-2"); g.strokeStyle = css("--rule");
  for (const y of [1860, 1900, 1940, 1980, 2020]) { g.beginPath(); g.moveTo(X(y), pad.t); g.lineTo(X(y), H - pad.b); g.stroke(); g.fillText(String(y), X(y) - 13, H - 3); }
  for (const v of [0, 50, 100, 150]) g.fillText(String(v), 2, Y(v) + 3);
  g.fillText("days of ice per winter", 2, 10);
  for (const [y, d, w] of RECORD) { g.fillStyle = w === S.winter && S.mode === "real" ? css("--accent") : css("--signal"); g.globalAlpha = w === S.winter ? 1 : 0.6; g.beginPath(); g.arc(X(y), Y(d), w === S.winter ? 4 : 2, 0, 7); g.fill(); }
  g.globalAlpha = 1; g.strokeStyle = css("--accent"); g.lineWidth = 2; g.beginPath();
  g.moveTo(X(TREND.first), Y(TREND.b0 + TREND.b1 * TREND.first)); g.lineTo(X(TREND.last), Y(TREND.b0 + TREND.b1 * TREND.last)); g.stroke();
  $("record-note").innerHTML = `<b>Observed</b>, ${TREND.first}–${TREND.last + 1}${ref(9)}: about <b>${Math.abs(TREND.b1 * 100).toFixed(0)} fewer ice days per century</b>.`; takeawayRecord();
}
// warming scenarios on the 1990–2020 winters, with the current snow and wind settings
const NORMALS = WKEYS.filter(w => +w.slice(0, 4) >= 1990 && +w.slice(0, 4) <= 2019);
let WARM = null, warmJob = 0;
function computeWarm() {
  const job = ++warmJob, dTs = [0, 1, 2, 3, 4], acc = dTs.map(() => ({ peak: 0, walk: 0, never: 0 }));
  let k = 0;
  const step = () => {
    if (job !== warmJob) return;
    const t0 = performance.now();
    while (k < NORMALS.length * dTs.length && performance.now() - t0 < 25) {
      const w = NORMALS[k % NORMALS.length], j = Math.floor(k / NORMALS.length), dT = dTs[j];
      const Wd = MADISON.winters[w], on0 = dayIdx(w, recOf(w).on), on = dT ? freezeUpIndex(Wd.T, on0, dT) : on0;
      if (on === null) acc[j].never++;
      else {
        const res = runWinter(Wd.T.map((T, i) => ({ T: T + dT, snow: Wd.snow[i] })), on, { wind: S.wind, snowFrac: S.snowFrac, N: 16, keepProf: false });
        const h = res.h.map(x => x || 0), pk = Math.max(...h);
        acc[j].peak += pk; acc[j].walk += h.filter(x => x >= 4 * IN).length; if (pk < 4 * IN) acc[j].never++;
      }
      k++;
    }
    if (k < NORMALS.length * dTs.length) setTimeout(step, 0);
    else { WARM = dTs.map((dT, j) => ({ dT, peak: acc[j].peak / NORMALS.length, walk: acc[j].walk / NORMALS.length, never: acc[j].never })); drawWarm(); }
  };
  step();
}
function drawWarm() {
  const [g, W, H] = setupCanvas($("warm")); g.clearRect(0, 0, W, H);
  if (!WARM) { g.fillStyle = css("--ink-2"); g.font = "12px Barlow, sans-serif"; g.fillText("Running 150 warmer winters…", 10, H / 2); return; }
  const pad = { l: 30, r: 30, t: 16, b: 18 }, n = WARM.length, bw = (W - pad.l - pad.r) / n;
  const ymax = Math.ceil(inch(WARM[0].peak) / 5) * 5 + 2, dmax = Math.ceil(WARM[0].walk / 20) * 20 + 10;
  const Y = v => H - pad.b - (H - pad.t - pad.b) * v / ymax, Yd = v => H - pad.b - (H - pad.t - pad.b) * v / dmax;
  g.font = "10.5px JetBrains Mono, monospace";
  WARM.forEach((s, j) => {
    const x = pad.l + j * bw, hot = S.mode === "real" && Math.round(S.dT) === s.dT;
    g.fillStyle = css("--signal"); g.globalAlpha = hot ? 1 : 0.7; g.fillRect(x + bw * 0.18, Y(inch(s.peak)), bw * 0.64, H - pad.b - Y(inch(s.peak))); g.globalAlpha = 1;
    g.fillStyle = "#fff"; g.textAlign = "center"; g.fillText(`${f1(inch(s.peak))}`, x + bw / 2, H - pad.b - 5); g.textAlign = "left";
    g.fillStyle = css("--ink-2"); g.fillText(`+${s.dT} °C`, x + bw * 0.2, H - 4);
  });
  g.strokeStyle = css("--accent"); g.fillStyle = css("--accent"); g.lineWidth = 2; g.beginPath();
  WARM.forEach((s, j) => { const x = pad.l + j * bw + bw / 2; if (j) g.lineTo(x, Yd(s.walk)); else g.moveTo(x, Yd(s.walk)); }); g.stroke();
  WARM.forEach((s, j) => { const x = pad.l + j * bw + bw / 2; g.beginPath(); g.arc(x, Yd(s.walk), 3, 0, 7); g.fill(); });
  g.fillStyle = css("--ink-2"); g.fillText("thickest ice, in", 2, 10); g.fillStyle = css("--accent"); g.textAlign = "right"; g.fillText("walkable days", W - 2, 10); g.textAlign = "left";
  const a = WARM[0], b = WARM[2], per = (inch(a.peak) - inch(WARM[1].peak));
  $("warm-note").innerHTML = `<b>Model:</b> 1990–2020 winters, 0–4 °C warmer. Bars: peak ice (in); red: walkable days.`; takeawayWarm();
}


// ---------------- "What this means": plain-language takeaways built from the live numbers ----------------
const TK = (id, html) => { const el = $(id); if (el) el.innerHTML = html ? `<b>What this means</b>${html}` : ""; };
const pucks = m => Math.max(1, Math.round(inch(m)));          // a hockey puck is roughly 1 in thick
function takeawayNow() {
  const r = S.run, i = curIdx(), h = curH(), w = S.mode === "book" ? "2025-26" : S.winter;
  if (!r) return TK("tk-now", "Too warm to freeze this winter: no ice at all. Lower the warming slider.");
  if (h <= 0) {
    const before = S.iceOn !== null && i < S.iceOn;
    return TK("tk-now", before ? `Still open water: the lake must shed its summer heat first. It freezes on ${fmtDate(w, S.iceOn)}.`
      : "Ice out: spring air melted it from the top. Scrub back to midwinter.");
  }
  const q = r.qBot[i], rate = q / (PROPS.rhoI * PROPS.L) * 86400 * 100, lvl = safetyLevel(h), prev = r.h[Math.max(0, i - 3)] || 0;
  const trend = h < prev - 0.002 ? "thinning" : rate > 0.05 ? "growing" : "holding steady";
  const safe = lvl === 0 ? `<b>Not safe yet:</b> ${f1(inch(h))} in, under the 4 in walking guide.`
    : lvl < 4 ? `<b>Safe on foot, not for cars:</b> ${f1(inch(h))} in, about ${pucks(h)} stacked hockey pucks.`
    : `<b>Thick enough for vehicles:</b> ${f1(inch(h))} in, about ${pucks(h)} stacked hockey pucks.`;
  const why = trend === "growing" ? `Growing ${rate.toFixed(2)} cm a day, about a pencil's width.`
    : trend === "thinning" ? "Thinning: the air is above freezing." : "Barely growing: mild air or a snow blanket.";
  TK("tk-now", `${safe} ${why}`);
}
function takeawaySeason() {
  const r = S.run, w = S.mode === "book" ? "2025-26" : S.winter;
  if (!r) return TK("tk-season", "No curve: at this warming the lake never freezes.");
  const hh = r.h.map(x => x || 0), pk = Math.max(...hh), ip = hh.indexOf(pk), st = r.hStefan[ip] || 0, iw = firstDayAtLeast(r.h, 4 * IN);
  const cut = st > 0 ? Math.round((1 - pk / st) * 100) : 0;
  TK("tk-season", `Fast, then slower: thick ice insulates. Peak ${f1(inch(pk))} in (${fmtDate(w, ip)})${iw === null ? "; never walkable" : `; walkable ${fmtDate(w, iw)}`}. Snow and air: ${cut}% thinner than textbook.`);
}
function takeawayWeather() {
  const s = curSnow(), eqSnow = PROPS.kI * s / DEFAULTS.kSnow, eqAir = PROPS.kI / hAir(S.wind);
  const big = eqSnow > 0.2;
  TK("tk-weather", `${big ? "<b>Thick snow blanket:</b>" : s > 0.002 ? "<b>Thin snow:</b>" : "<b>Bare ice:</b>"} ${(s * 100).toFixed(1)} cm of snow insulates like ${(eqSnow * 100).toFixed(0)} cm of ice; still air adds ${(eqAir * 100).toFixed(0)} cm more. ${big ? "Less snow or more wind would freeze it faster." : "A fresh snowfall would slow freezing."}`);
}
function takeawayRecord() {
  const first = TREND.b0 + TREND.b1 * TREND.first, last = TREND.b0 + TREND.b1 * TREND.last, lost = first - last;
  const rec = S.mode === "real" ? recOf(S.winter) : null, exp = rec ? TREND.b0 + TREND.b1 * +S.winter.slice(0, 4) : null;
  const vs = rec ? ` ${S.winter}: ${rec.days} days, ${rec.days >= exp ? `${Math.round(rec.days - exp)} above` : `${Math.round(exp - rec.days)} below`} the trend.` : "";
  TK("tk-record", `Measured: about ${Math.round(lost)} fewer ice days (${Math.round(lost / 7)} weeks) than in the 1850s.${vs}`);
}
function takeawayWarm() {
  if (!WARM) return TK("tk-warm", "");
  const a = WARM[0], b = WARM[2], per = inch(a.peak) - inch(WARM[1].peak), lostDays = a.walk - b.walk;
  TK("tk-warm", `Each +1 °C: about ${f1(per)} in less peak ice. +2 °C: ${Math.round(lostDays)} fewer walkable days (${Math.round(lostDays / 7)} weekends).`);
}

// ---------------- KaTeX: HTML output with the bundled fonts; MathML only if the fonts fail ----------------
const KOPT = { output: "html" };
if (document.fonts && document.fonts.load) document.fonts.load("1em KaTeX_Main").then(f => { if (!f.length) { KOPT.output = "mathml"; rerenderMath(); } }).catch(() => { KOPT.output = "mathml"; });
const esc = t => t.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
function texHTML(tex, display = false) { return window.katex ? window.katex.renderToString(tex, { displayMode: display, output: KOPT.output, throwOnError: false }) : esc(tex); }
const mathify = str => String(str).replace(/\$([^$]+)\$/g, (_, t) => texHTML(t));     // inline $...$ → KaTeX
function renderTexIn(root) {
  root.querySelectorAll("[data-tex]").forEach(el => { el.innerHTML = texHTML(decodeURIComponent(el.dataset.tex), el.dataset.inline !== "1"); });
}
function rerenderMath() { if (mdlOpen) renderModel(); if (lens) showStop(); if (crsOpen) renderCourses(); }
// ---------------- lenses, spots, intro ----------------
const courseLink = n => `<a class="course" href="https://guide.wisc.edu/search/?P=CBE%20${n}" target="_blank" rel="noopener" title="CBE ${n}: ${COURSE[n][1]}">${COURSE[n][0].replace("&", "&amp;")} ↗</a>`;
const lensNav = $("lenses"), lensCard = $("lens-card");
LENSES.forEach((L, i) => {
  const b = document.createElement("button"); b.type = "button"; b.textContent = COURSE[L.n][0]; b.dataset.i = i;
  b.setAttribute("aria-pressed", "false"); b.title = `See where ${COURSE[L.n][0]} shows up in this digital twin`;
  b.onclick = () => (lens && lens.i === i ? closeLens() : openLens(i)); lensNav.appendChild(b);
});
const LIVE = {   // live lines for lens stops
  250: () => { const i = curIdx(), r = S.run; if (!r || isOpen()) return "No ice right now: scrub to a frozen day."; const q = r.qBot[i]; return `Now: ${q.toFixed(0)} W/m² out → +${(q / (PROPS.rhoI * PROPS.L) * 86400 * 100).toFixed(2)} cm/day.`; },
  255: () => `${DEFAULTS.N} layers, 1 h steps; matches the exact solution to ${(Math.abs(VALID["neumann_Ts-10"].relErr) * 100).toFixed(3)} %.`,
  310: () => { const i = curIdx(), T = Math.min(0, S.days[i].T); return `Now: $\\mathrm{Ste}$ = ${(PROPS.cpI * (0 - T) / PROPS.L).toFixed(3)}: latent heat is ${T < 0 ? Math.round(PROPS.L / (PROPS.cpI * -T)) : "∞"}× sensible heat.`; },
  320: () => { const r = S.run, i = curIdx(); if (!r || isOpen()) return "No ice right now."; return `Now: ${(r.S[i] / 86400).toFixed(0)} °C·days of cold → Stefan ${f1(inch(r.hStefan[i]))} in; live model ${f1(inch(curH()))} in.`; },
  326: () => `Now: ${S.wind} m/s → $h_a$ = ${hAir(S.wind).toFixed(1)} W/(m²·K), like ${(PROPS.kI / hAir(S.wind) * 100).toFixed(0)} cm of ice.`,
  355: () => `Trend ${(TREND.b1 * 100).toFixed(1)} days/century; scatter ±${TREND.sd.toFixed(0)} days.`,
  450: () => { const r = S.run, w = S.mode === "book" ? "2025-26" : S.winter; if (!r) return "No safe ice this winter."; const a = firstDayAtLeast(r.h, 4 * IN), b = firstDayAtLeast(r.h, 13 * IN); return `Walk: ${a === null ? "never" : fmtDate(w, a)} · truck (13 in): ${b === null ? "never" : fmtDate(w, b)}.`; },
};
const LIVE_SNOW = () => { const s = curSnow(); return `Now: ${(s * 100).toFixed(1)} cm of snow insulates like ${(PROPS.kI * s / DEFAULTS.kSnow * 100).toFixed(0)} cm of ice.`; };
let lens = null, lensPrev = null;
function openLens(i, k = 0) {
  $("realworld").setAttribute("aria-pressed", "false");
  if (!lens) lensPrev = { p: camera.position.clone(), c: controls.target.clone(), fov: camera.fov };
  lens = { i, k };
  lensNav.querySelectorAll("button[data-i]").forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.i === i)));
  showStop();
}
function showStop() {
  const L = LENSES[lens.i], St = L.stops[lens.k];
  goTo(St.view);
  if (St.face) setFace(St.face === "real");
  document.querySelectorAll(".lens-hl").forEach(e => e.classList.remove("lens-hl"));
  if (St.panel) { const el = $(St.panel); if (el.classList.contains("fold")) setFold(el, true); el.classList.add("lens-hl"); }
  const last = lens.k === L.stops.length - 1;
  lensCard.innerHTML = `
    <div class="lc-top"><span class="lc-subject">${COURSE[L.n][0].replace("&", "&amp;")}</span>
      <span class="lc-step">${L.stops.length > 1 ? `${lens.k + 1} of ${L.stops.length}` : ""}</span>
      <button class="lc-x" type="button" aria-label="Close">×</button></div>
    <h3>${St.title}</h3>
    <p>${mathify(St.text)}</p>
    <p class="lc-plain"><b>In short:</b> ${mathify(St.plain)}</p>
    <details class="lc-eq"><summary>Show the equation</summary>${St.eqNo && EQ_BY_NO[St.eqNo] ? `<div class="lc-tex" data-tex="${encodeURIComponent(EQ_BY_NO[St.eqNo].tex)}"></div><p class="lc-eqref">Eq. (${St.eqNo}) · ${EQ_BY_NO[St.eqNo].name} · <button type="button" data-eqno="${St.eqNo}">open in ∑ Model ▸</button></p>` : `<div>${St.eq}</div>`}</details>
    <p class="lc-live" id="lc-live"></p>
    <p class="lc-why"><b>Why:</b> ${mathify(St.why)}</p>
    <p class="lc-course">Learn it in ${courseLink(L.n)}</p>
    <div class="lc-nav">
      <button class="btn" type="button" id="lc-back" ${lens.k === 0 ? "disabled" : ""}>Back</button>
      <button class="btn primary" type="button" id="lc-next">${last ? "Done" : "Next"}</button>
    </div>`;
  lensCard.hidden = false; showCard();
  lensCard.querySelector(".lc-x").onclick = closeLens;
  $("lc-back").onclick = () => { if (lens.k > 0) { lens.k--; showStop(); } };
  $("lc-next").onclick = () => { if (last) closeLens(); else { lens.k++; showStop(); } };
  renderTexIn(lensCard);
  { const b = lensCard.querySelector("[data-eqno]"); if (b) b.onclick = () => toggleModel(true, "eq-" + b.dataset.eqno); }
  placeBeacon(); lensRefresh();
}
function showCard() { const a = document.querySelector("aside"); if (matchMedia("(max-width: 860px)").matches) lensCard.scrollIntoView({ block: "start", behavior: "smooth" }); else a.scrollTo({ top: 0, behavior: "smooth" }); }
function placeBeacon() {
  if (!lens) return; const [p, sz] = anchor(LENSES[lens.i].stops[lens.k].beacon);
  beacon.position.copy(p); beacon.scale.setScalar(sz); beacon.visible = true;
}
function lensRefresh() {
  if (!lens) return; const el = $("lc-live"); if (!el) return;
  const L = LENSES[lens.i]; el.innerHTML = mathify(esc(L.n === 320 && lens.k === 1 ? LIVE_SNOW() : LIVE[L.n]()));
  placeBeacon();
}
function closeLens() {
  if (!lens) return;
  lens = null; lensCard.hidden = true; beacon.visible = false; if (typeof markSpotRow === "function") markSpotRow(-1);
  document.querySelectorAll(".lens-hl").forEach(e => e.classList.remove("lens-hl"));
  lensNav.querySelectorAll("button[data-i]").forEach(b => b.setAttribute("aria-pressed", "false"));
  if (lensPrev) tween = { from: { p: camera.position.clone(), c: controls.target.clone(), fov: camera.fov }, to: { p: lensPrev.p, c: lensPrev.c, fov: lensPrev.fov }, t0: performance.now(), dur: 1200 };
}
document.addEventListener("keydown", e => { if (e.key === "Escape") { if (crsOpen) toggleCourses(false); else if (mdlOpen) toggleModel(false); else if (lens) closeLens(); else if (!lensCard.hidden) { lensCard.hidden = true; $("realworld").setAttribute("aria-pressed", "false"); } } });

function setFold(sec, open) { sec.classList.toggle("collapsed", !open); const h = sec.querySelector(":scope > h2"); if (h) h.setAttribute("aria-expanded", String(open)); if (open && sec.querySelector("canvas.chart")) requestAnimationFrame(() => { if (sec.id === "sec-now") drawSeason(); if (sec.id === "sec-climate") { drawRecord(); drawWarm(); } }); }
document.querySelectorAll("section.fold").forEach(sec => {
  const h = sec.querySelector(":scope > h2"); h.tabIndex = 0; h.setAttribute("role", "button"); h.setAttribute("aria-expanded", "false");
  const toggle = () => setFold(sec, sec.classList.contains("collapsed"));
  h.addEventListener("click", e => { if (!e.target.closest("a")) toggle(); });
  h.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
});
$("cond-toggle").onclick = e => {
  const on = e.currentTarget.getAttribute("aria-pressed") !== "true";
  e.currentTarget.setAttribute("aria-pressed", String(on)); $("tag").hidden = !on; setFold($("sec-weather"), on);
};
document.addEventListener("click", e => {
  const a = e.target.closest("a.ref"); if (!a) return; e.preventDefault();
  if (mdlOpen) { const li = document.getElementById("mref-" + a.dataset.ref); if (li) { li.scrollIntoView({ block: "center", behavior: "smooth" }); li.classList.add("flash"); setTimeout(() => li.classList.remove("flash"), 1600); } return; }
  const li = $("ref-" + a.dataset.ref); if (!li) return;
  setFold($("sec-refs"), true); li.scrollIntoView({ block: "center", behavior: "smooth" });
  li.classList.add("flash"); setTimeout(() => li.classList.remove("flash"), 1600);
});
$("refs").innerHTML = REFS.map((r, i) => `<li id="ref-${i + 1}">${r}</li>`).join("");

function openIntro() {
  if (lens) closeLens();
  lensNav.querySelectorAll("button[data-i]").forEach(b => b.setAttribute("aria-pressed", "false"));
  $("realworld").setAttribute("aria-pressed", "true"); beacon.visible = false;
  lensCard.innerHTML = `
    <div class="lc-top"><span class="lc-subject">Real world</span><button class="lc-x" type="button" aria-label="Close">×</button></div>
    <h3>Why care how thick the lake ice is?</h3>
    <p>Each winter Lake Mendota freezes and fills with ice anglers, skaters and iceboats. Madison has logged its freeze and thaw dates since the 1850s${ref(9)}.</p>
    <ul class="lc-list">
      <li><b>Safety:</b> about 4 in of clear ice to walk on, much more for trucks${ref(11)}.</li>
      <li><b>Climate:</b> about a month less ice than in the 1850s${ref(15)}.</li>
      <li><b>ChemE:</b> the same physics freezes food, casts metals and freeze-dries medicines${ref(1)}.</li>
    </ul>
    <p class="lc-plain">Press Play, or click a numbered spot.</p>
    <div class="lc-nav"><button class="btn primary" type="button" id="lc-next">Start exploring</button></div>`;
  lensCard.hidden = false; showCard();
  const done = () => { lensCard.hidden = true; $("realworld").setAttribute("aria-pressed", "false"); try { localStorage.setItem("ice-intro-seen", "1"); } catch (e) {} };
  lensCard.querySelector(".lc-x").onclick = done; $("lc-next").onclick = done;
}
$("realworld").onclick = () => ($("realworld").getAttribute("aria-pressed") === "true" ? (lensCard.hidden = true, $("realworld").setAttribute("aria-pressed", "false")) : openIntro());

const spotLayer = $("spots"), spotEls = [];
SPOTS.forEach((Sp, i) => {
  const b = document.createElement("button"); b.type = "button"; b.className = "spot"; b.textContent = String(i + 1);
  b.setAttribute("aria-label", `ChemE spot ${i + 1}: ${Sp.name}`);
  const t = document.createElement("span"); t.textContent = Sp.name; b.appendChild(t);
  b.onclick = () => openLens(Sp.lens, Sp.k || 0); spotLayer.appendChild(b); spotEls.push(b);
});
const spotsOn = true;
const _v = new THREE.Vector3();
function placeSpots() {
  const w = stage.clientWidth, h = stage.clientHeight, pts = [];
  SPOTS.forEach((Sp, i) => {
    const [p] = anchor(Sp.at); _v.copy(p).project(camera);
    const dist = camera.position.distanceTo(p);
    const near = ["front", "ice", "snow", "water", "hole"].includes(Sp.at);
    const atCut = camera.position.z > HALF + 0.3 && camera.position.y < 1.5;
    const vis = _v.z < 1 && _v.z > -1 && Math.abs(_v.x) < 1.02 && Math.abs(_v.y) < 1.02 && (!near || dist < 90) && (!atCut || ["front", "ice", "snow", "water"].includes(Sp.at)) && (Sp.at !== "hole" || dist > 3);
    pts.push({ i, vis, x: (_v.x + 1) / 2 * w, y: (1 - _v.y) / 2 * h });
  });
  // push apart spots closer than 38 px; remember the true position for a leader line
  const shown = pts.filter(q => q.vis); shown.forEach(q => { q.tx = q.x; q.ty = q.y; });
  const clearLabels = () => { for (const el of [$("ice-big"), $("water-big"), ...NAMED.map(n => n.el)]) { if (!el || el.style.display === "none") continue;
    const sr = stage.getBoundingClientRect(), r = el.getBoundingClientRect(), L = r.left - sr.left - 18, R = r.right - sr.left + 18, T = r.top - sr.top - 18, B = r.bottom - sr.top + 18;
    shown.forEach(q => { if (q.x > L && q.x < R && q.y > T && q.y < B) { const d = [q.x - L, R - q.x, q.y - T, B - q.y], m = Math.min(...d); if (m === d[0]) q.x = L; else if (m === d[1]) q.x = R; else if (m === d[2]) q.y = T; else q.y = B; } }); } };
  clearLabels();
  for (let it = 0; it < 60; it++) {
    let moved = false;
    for (let a = 0; a < shown.length; a++) for (let b = a + 1; b < shown.length; b++) {
      const A = shown[a], B = shown[b], dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy);
      if (d < 54) { const ux = d > 0.5 ? dx / d : 0.6, uy = d > 0.5 ? dy / d : -0.8, push = (54 - d) / 2 + 0.5; A.x -= ux * push; A.y -= uy * push; B.x += ux * push; B.y += uy * push; moved = true; }
    }
    clearLabels();
    if (!moved && it > 2) break;
  }
  clearLabels();
  let svg = "";
  pts.forEach(q => {
    const el = spotEls[q.i]; el.style.display = q.vis ? "" : "none";
    if (!q.vis) return;
    el.style.left = `${q.x}px`; el.style.top = `${q.y}px`;
    if (Math.hypot(q.x - q.tx, q.y - q.ty) > 6) svg += `<line x1="${q.tx}" y1="${q.ty}" x2="${q.x}" y2="${q.y}"/><circle cx="${q.tx}" cy="${q.ty}" r="2.5"/>`;
  });
  if (svg !== placeSpots.last) { $("spot-leaders").innerHTML = svg; placeSpots.last = svg; }
}


// ---------------- spots table (always-on ChemE spots) ----------------
$("spot-list").innerHTML = SPOTS.map((Sp, i) => `<li><button type="button" data-i="${i}" title="${Sp.name}"><i>${i + 1}</i><span>${Sp.name}</span></button></li>`).join("");
$("spot-list").addEventListener("click", e => { const b = e.target.closest("button[data-i]"); if (!b) return; const Sp = SPOTS[+b.dataset.i]; openLens(Sp.lens, Sp.k || 0); markSpotRow(+b.dataset.i); });
function markSpotRow(i) { $("spot-list").querySelectorAll("button").forEach(b => b.setAttribute("aria-current", String(+b.dataset.i === i))); }
const stT = $("spot-table");
function setSpotTable(open) { stT.classList.toggle("collapsed", !open); $("st-toggle").setAttribute("aria-expanded", String(open)); $("st-toggle").lastElementChild.textContent = open ? "‹" : "›"; }
$("st-toggle").onclick = () => setSpotTable(stT.classList.contains("collapsed"));
setSpotTable(!matchMedia("(max-width: 860px)").matches);
spotEls.forEach((el, i) => el.addEventListener("click", () => markSpotRow(i)));

// ---------------- user guide ----------------
let guideOpen = false;
function toggleGuide(on) { guideOpen = on; $("guide-panel").hidden = !on; if (on) $("guide-close").focus(); }
$("open-guide").onclick = () => { toggleGuide(true); $("open-guide").classList.add("seen"); try { localStorage.setItem("twin-guide-seen", "1"); } catch (e) {} };
try { if (localStorage.getItem("twin-guide-seen")) $("open-guide").classList.add("seen"); } catch (e) {}
$("guide-close").onclick = () => toggleGuide(false);
$("guide-panel").addEventListener("click", e => { if (e.target.id === "guide-panel") toggleGuide(false); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && guideOpen) toggleGuide(false); });

// ---------------- pop-out side panel ----------------
const side = $("side");
function setPopped(on) {
  document.body.classList.toggle("popped", on); $("pop-btn").textContent = on ? "⤡" : "⤢";
  $("pop-btn").title = on ? "Dock the panel back" : "Pop the panel out into a floating window";
  if (!on) side.style.left = side.style.top = side.style.right = side.style.width = side.style.height = "";
  try { localStorage.setItem("ice-panel-popped", on ? "1" : "0"); } catch (e) {}
  requestAnimationFrame(() => { resize(); });
}
$("pop-btn").onclick = () => setPopped(!document.body.classList.contains("popped"));
{ let drag = null;
  $("panel-bar").addEventListener("pointerdown", e => { if (!document.body.classList.contains("popped") || e.target.closest("button")) return; const r = side.getBoundingClientRect(); drag = { dx: e.clientX - r.left, dy: e.clientY - r.top }; $("panel-bar").setPointerCapture(e.pointerId); });
  $("panel-bar").addEventListener("pointermove", e => { if (!drag) return; side.style.right = "auto"; side.style.left = `${Math.max(0, Math.min(innerWidth - 120, e.clientX - drag.dx))}px`; side.style.top = `${Math.max(0, Math.min(innerHeight - 60, e.clientY - drag.dy))}px`; });
  $("panel-bar").addEventListener("pointerup", () => { drag = null; }); }
try { if (localStorage.getItem("ice-panel-popped") === "1" && !matchMedia("(max-width: 860px)").matches) setPopped(true); } catch (e) {}

// ---------------- Courses panel ----------------
const crs = { aud: "student", kind: "all", hi: null }; let crsOpen = false;
const GO = {
  cutaway: () => goTo("cutaway"), hole: () => goTo("village"),
  chart: () => { $("sec-now").scrollIntoView({ block: "start", behavior: "smooth" }); flash("sec-now"); },
  front: () => openLens(0), water: () => openLens(2), weather: () => { setFold($("sec-weather"), true); $("sec-weather").scrollIntoView({ block: "start", behavior: "smooth" }); flash("sec-weather"); },
  climate: () => { setFold($("sec-climate"), true); $("sec-climate").scrollIntoView({ block: "start", behavior: "smooth" }); flash("sec-climate"); },
  "m-num": () => toggleModel(true, "m-num"), "m-val": () => toggleModel(true, "m-val"),
};
function flash(id) { const el = $(id); el.classList.add("lens-hl"); setTimeout(() => el.classList.remove("lens-hl"), 1800); }
const FAM = CATALOG.families, featName = Object.fromEntries(FEATURES.map(f => [f.id, f]));
const courseList = () => COURSES.map(c => ({ ...CATALOG.courses[c.n], ...c })).sort((a, b) => a.order - b.order || a.n - b.n);
function renderCourses() {
  const list = courseList().filter(c => crs.kind === "all" || c.kind === crs.kind);
  const famOf = c => FAM[c.topics.length ? CATALOG.courses[c.n].topics[c.topics[0]][1] : "transport"].color;
  const matrix = `<div class="crs-scroll"><table class="crs-map"><thead><tr><th>Twin feature</th>${list.map(c => `<th data-c="${c.n}" class="${crs.hi === c.n ? "hi" : ""}" title="CBE ${c.n}: ${c.title}">${c.n}</th>`).join("")}</tr></thead>
    <tbody>${FEATURES.map(f => `<tr><td><button class="crs-go" type="button" data-go="${f.go}">${f.name}</button></td>${list.map(c => `<td class="${crs.hi === c.n ? "hi" : ""}">${c.features.includes(f.id) ? `<i style="background:${famOf(c)}"></i>` : ""}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  const cards = list.map(c => `<article class="crs-card ${crs.hi === c.n ? "hi" : ""}" id="crs-${c.n}">
      <header><a href="https://guide.wisc.edu/search/?P=CBE%20${c.n}" target="_blank" rel="noopener">CBE ${c.n} ↗</a><span class="crs-term">${c.term}${c.kind === "elective" ? "" : " · core"}</span></header>
      <h4>${c.title}</h4>
      <div class="crs-topics">${c.topics.slice(0, 2).map(t => { const [name, fam] = CATALOG.courses[c.n].topics[t]; return `<span style="--fc:${FAM[fam].color}">${name}</span>`; }).join("")}</div>
      <p class="crs-act"><span>${crs.aud === "student" ? "Try this" : "Use in class"}</span>${mathify(crs.aud === "student" ? c.student : c.instructor)}</p>
      ${c.design ? `<p class="crs-act crs-design"><span>Design · ${c.design.kind}</span>${c.design.text} <a href="#ps-${c.design.ps}">Open the starting design ▸</a></p>` : ""}
      <a class="crs-ps" href="${PS_LINK(c.n)}" target="_blank" rel="noopener">Problem set ↗</a>
    </article>`).join("");
  const fams = [...new Set(list.flatMap(c => c.topics.map(t => CATALOG.courses[c.n].topics[t][1])))];
  $("crs-body").innerHTML = `
    <p><b>One process, many courses:</b> balances, thermo, transport, modeling, statistics and design on one frozen lake.</p>
    <p>${list.length} courses. Click a feature to jump to it, or a course number to find its card.</p>
    <h3>Course map</h3>${matrix}
    <p><a class="crs-ps" href="../problems/#ice-Integrative" target="_blank" rel="noopener">Integrative problem ↗</a> one day on Mendota through five courses.</p>
    <h3>Courses</h3><div class="crs-grid">${cards}</div>
    <p class="crs-legend">${fams.map(f => `<span><i style="background:${FAM[f].color}"></i>${FAM[f].label}</span>`).join("")}</p>`;
}
function toggleCourses(on) { crsOpen = on; $("crs-panel").hidden = !on; if (on) { renderCourses(); $("crs-close").focus(); } }
$("open-courses").onclick = () => toggleCourses(true);
$("hdr-courses").onclick = () => toggleCourses(true);
document.querySelectorAll("#face-seg button").forEach(b => b.onclick = () => setFace(b.dataset.f === "real"));
$("crs-close").onclick = () => toggleCourses(false);
$("crs-panel").addEventListener("click", e => { if (e.target.id === "crs-panel" || e.target.closest(".crs-design a")) toggleCourses(false); });
for (const [id, key] of [["crs-aud", "aud"], ["crs-kind", "kind"]]) $(id).onclick = e => { const b = e.target.closest("button"); if (!b) return; crs[key] = b.dataset.a || b.dataset.k; $(id).querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); renderCourses(); };
$("crs-body").addEventListener("click", e => {
  const g = e.target.closest("[data-go]"); if (g) { toggleCourses(false); GO[g.dataset.go](); return; }
  const h = e.target.closest("th[data-c]"); if (h) { crs.hi = crs.hi === +h.dataset.c ? null : +h.dataset.c; renderCourses(); document.getElementById("crs-" + h.dataset.c)?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }
});
$("crs-summary").textContent = `Used in ${COURSES.length} courses, first year to Process Design.`;


// ---------------- Links to Research (TwinKit Part N, simplified) ----------------
// From TwinKit/research.json, byTwin["ice"]: name linked to the official page, general research areas, where it shows in the twin.
const RESEARCH = [   // research.json byTwin["ice"], alphabetical by last name; first 3 areas as listed (a machine-learning tag kept visible)
  { name: "Rose Cersonsky", url: "https://engineering.wisc.edu/directory/profile/rose-cersonsky/",
    where: "how ice forms at the molecular scale",
    areas: ["Molecular modeling and simulation", "Applied mathematics and machine learning", "Self-assembly of complex building blocks"],
    jump: ["Freezing front", "front"] },
  { name: "Michael D. Graham", url: "https://engineering.wisc.edu/directory/profile/mike-graham/",
    where: "fluid and heat transport",
    areas: ["Fluid dynamics", "Blood flow at the cellular level", "Machine learning in fluid dynamics"],
    jump: ["Ice edge", "cutaway"] },
  { name: "Brian Pfleger", url: "https://engineering.wisc.edu/directory/profile/brian-pfleger/",
    where: "cyanobacteria (blue-green algae) in the lake",
    areas: ["Metabolic engineering", "Synthetic biology", "Biotechnology"],
    jump: ["Lake water", "water"] },
];
let resOpen = false;
function renderResearch() {   // one flat list, all topics treated equally (Part N update 6)
  $("res-body").innerHTML = `<div class="crs-grid res-grid">${RESEARCH.map((R, i) => `<article class="crs-card res-card" id="res-${i}">
      <h4><a href="${R.url}" target="_blank" rel="noopener">${R.name} ↗</a></h4>
      <p class="res-where">Connects to: ${R.where}</p>
      <div class="res-areas">${R.areas.slice(0, 3).map(a => `<span>${a}</span>`).join("")}</div>
      <div class="res-go"><button class="btn mdl-go" type="button" data-go="${R.jump[1]}" title="Close the panel and show this place in the twin">Show in the twin: ${R.jump[0]} ▸</button></div>
    </article>`).join("")}</div>
    <h3 class="res-h res-centers-h">UW–Madison centers and programs</h3>
    <div class="crs-grid res-grid res-centers">${CENTERS.map(([n, u, w]) => `<article class="crs-card res-card"><h4><a href="${u}" target="_blank" rel="noopener">${n} ↗</a></h4><p class="res-where">Connects to: ${w}</p></article>`).join("")}</div>`;
}
const CENTERS = [   // from TwinKit/centers.json byTwin["ice"]: topical links only
  ["Center for Limnology", "https://limnology.wisc.edu/", "lake science, Lake Mendota monitoring"],
  ["North Temperate Lakes Long-Term Ecological Research (NTL-LTER)", "https://lter.limnology.wisc.edu/", "long-term records for Wisconsin lakes"],
  ["Wisconsin State Climatology Office", "https://climatology.nelson.wisc.edu/", "keeper of Lake Mendota ice records"],
  ["Center for Climatic Research", "https://ccr.nelson.wisc.edu/", "climate system research"],
];
function toggleResearch(on) { resOpen = on; $("res-panel").hidden = !on; if (on) { renderResearch(); $("res-close").focus(); } }
$("btn-res").onclick = () => toggleResearch(true);
$("res-close").onclick = () => toggleResearch(false);
$("res-panel").addEventListener("click", e => { if (e.target.id === "res-panel") return toggleResearch(false); const g = e.target.closest("[data-go]"); if (g) { toggleResearch(false); GO[g.dataset.go](); } });
document.addEventListener("keydown", e => { if (e.key === "Escape" && resOpen) toggleResearch(false); });

// ---------------- ∑ Model panel ----------------
let mdlOpen = false;
// ∑ Model equations, football-twin card format: header, typeset equation, ASSUMED line, one row per symbol, live line.
// sym rows: [TeX symbol, meaning, units, value or range]
const LIVE_Q = () => { const r = S.run, i = curIdx(); if (!r || isOpen()) return "No ice on this day."; const q = r.qBot[i]; return `Now: $k\\,\\partial T/\\partial z$ at the front = ${q.toFixed(1)} W/m² → $dh/dt$ = ${(q / (PROPS.rhoI * PROPS.L) * 86400 * 100).toFixed(2)} cm/day.`; };
const EQ = [
  { group: "Transport: heat conduction in the ice", courses: [320, 326], items: [
    { no: 1, name: "Transient heat conduction in the ice", tex: String.raw`\rho\, c_p\, \dfrac{\partial T}{\partial t} = k\, \dfrac{\partial^2 T}{\partial z^2}, \qquad 0 < z < h(t)`,
      sym: [[String.raw`\rho`, "ice density", "kg/m³", "916.2"], [String.raw`c_p`, "ice specific heat", "J/(kg·K)", "2050"], [String.raw`T(z,t)`, "ice temperature", "°C", "solved, −25 to 0"], [String.raw`t`, "time", "s", "1 h steps"],
            [String.raw`k`, "ice thermal conductivity", "W/(m·K)", "2.22"], [String.raw`z`, "depth below the ice surface", "m", "0 to h"], [String.raw`h(t)`, "ice thickness", "m", "solved"]],
      go: ["cutaway", "Cutaway"], refs: [1, 4], live: () => { const r = S.run, i = curIdx(); const p = r && r.prof[i]; return p ? `Now: surface ${f1(p[0])} °C, middle ${f1(p[p.length >> 1])} °C, bottom ${f1(p[p.length - 1])} °C across ${(curH() * 100).toFixed(1)} cm of ice.` : "No ice on this day."; } },
    { no: 2, name: "Freezing front at the melting point", tex: String.raw`T\big(h(t),\,t\big) = T_f = 0\ ^\circ\mathrm{C}`,
      sym: [[String.raw`T`, "ice temperature", "°C", "–"], [String.raw`h(t)`, "ice thickness (position of the freezing front)", "m", "solved"], [String.raw`t`, "time", "s", "–"], [String.raw`T_f`, "freezing point of fresh water", "°C", "0"]],
      go: ["cutaway", "Cutaway"], refs: [2, 4], live: () => isOpen() ? "No ice on this day." : `Now: the ice bottom sits at ${(curH() * 100).toFixed(1)} cm depth, held at 0 °C.` },
  ] },
  { group: "Balances: energy at the moving front and at the surface", courses: [250, 320, 326], items: [
    { no: 3, name: "Stefan condition (energy balance on the freezing front)", tex: String.raw`\rho L\, \dfrac{dh}{dt} = k \left.\dfrac{\partial T}{\partial z}\right|_{z=h} - q_w`,
      assumed: "$q_w = 0$ by default: the heat reaching the ice from the lake water is taken as negligible in midwinter.",
      sym: [[String.raw`\rho`, "ice density", "kg/m³", "916.2"], [String.raw`L`, "latent heat of fusion", "J/kg", "334 000"], [String.raw`h`, "ice thickness", "m", "solved"], [String.raw`t`, "time", "s", "–"],
            [String.raw`k`, "ice thermal conductivity", "W/(m·K)", "2.22"], [String.raw`\partial T/\partial z`, "temperature gradient in the ice at the front", "K/m", "computed"], [String.raw`q_w`, "heat from the lake water to the ice bottom", "W/m²", "0 (assumed)"]],
      go: ["front", "Lens: Balances"], refs: [2, 1, 4], live: LIVE_Q },
    { no: 4, name: "Surface: conduction meets air film and snow in series", tex: String.raw`\begin{aligned} k \left.\dfrac{\partial T}{\partial z}\right|_{z=0} &= U\,(T_s - T_a) \\ \dfrac{1}{U} &= \dfrac{1}{h_a} + \dfrac{d_s}{k_s} \end{aligned}`,
      assumed: "$k_s = 0.20$ W/(m·K) is a typical value for seasonal snow; $d_s$ is 10 % of the airport snow depth, fitted to two measured thicknesses.",
      sym: [[String.raw`k`, "ice thermal conductivity", "W/(m·K)", "2.22"], [String.raw`\partial T/\partial z`, "temperature gradient at the ice surface", "K/m", "computed"], [String.raw`U`, "overall surface heat-transfer coefficient", "W/(m²·K)", "computed"],
            [String.raw`T_s`, "ice-surface temperature", "°C", "solved"], [String.raw`T_a`, "air temperature (daily mean)", "°C", "Madison data"], [String.raw`h_a`, "air-film coefficient", "W/(m²·K)", "eq. (5)"], [String.raw`d_s`, "snow depth on the ice", "m", "0–0.05"], [String.raw`k_s`, "snow thermal conductivity", "W/(m·K)", "0.20 (assumed)"]],
      go: ["weather", "Winter & weather"], refs: [3, 5], live: () => { const s = curSnow(), R = surfaceR(S.wind, s, DEFAULTS.kSnow); return `Now: $1/h_a$ = ${(1 / hAir(S.wind)).toFixed(3)}, $d_s/k_s$ = ${(s / DEFAULTS.kSnow).toFixed(3)} → $1/U$ = ${R.toFixed(3)} m²·K/W, $U$ = ${(1 / R).toFixed(1)} W/(m²·K).`; } },
    { no: 5, name: "Air-film coefficient from wind speed (Jürges, in McAdams' form)", tex: String.raw`h_a = 5.7 + 3.8\,V \qquad \left(h_a \text{ in } \mathrm{W\,m^{-2}\,K^{-1}},\; V \text{ in } \mathrm{m\,s^{-1}}\right)`,
      assumed: "Default wind 4 m/s; the correlation was fitted for V < 5 m/s, so higher winds are an extrapolation.",
      sym: [[String.raw`h_a`, "air-film heat-transfer coefficient", "W/(m²·K)", "5.7–51"], [String.raw`V`, "wind speed over the ice", "m/s", "0–12, default 4"]],
      go: ["weather", "Winter & weather"], refs: [6], live: () => `Now: $V$ = ${S.wind} m/s → $h_a$ = ${hAir(S.wind).toFixed(1)} W/(m²·K).` },
    { no: 10, name: "Surface melting", tex: String.raw`\begin{aligned} T_s &= T_f \\ \rho L \left(\dfrac{dh}{dt}\right)_{\mathrm{top}} &= -\left[\, U\,(T_a - T_f) + k \left.\dfrac{\partial T}{\partial z}\right|_{z=0} \right] \end{aligned}`,
      sym: [[String.raw`T_s`, "ice-surface temperature, held at the melting point", "°C", "0"], [String.raw`T_f`, "freezing point", "°C", "0"], [String.raw`\rho`, "ice density", "kg/m³", "916.2"], [String.raw`L`, "latent heat of fusion", "J/kg", "334 000"],
            [String.raw`\left(\frac{dh}{dt}\right)_{\mathrm{top}}`, "thinning from the top", "m/s", "solved (≤ 0)"], [String.raw`U`, "overall surface coefficient", "W/(m²·K)", "eq. (4)"], [String.raw`T_a`, "air temperature, above 0 °C", "°C", "Madison data"], [String.raw`k\,\partial T/\partial z`, "heat conducted into the colder ice below", "W/m²", "computed"]],
      go: ["chart", "Season chart"], refs: [4], live: () => { const d = S.days[curIdx()]; return d.T > 0 && !isOpen() ? `Now: air ${f1(d.T)} °C, so the top of the ice is melting.` : "Now: the air is below freezing, so no surface melting."; } },
  ] },
  { group: "Thermodynamics and closed-form solutions", courses: [310, 320, 255], items: [
    { no: 6, name: "Freezing degree-time", tex: String.raw`S(t) = \int_{t_0}^{t} \left(T_f - T_a(t')\right) dt'`,
      sym: [[String.raw`S`, "accumulated cold since freeze-up (floored at 0)", "°C·s", "from data"], [String.raw`t_0`, "freeze-up time", "s", "from the record"], [String.raw`t`, "time", "s", "–"], [String.raw`T_f`, "freezing point", "°C", "0"], [String.raw`T_a`, "air temperature", "°C", "Madison data"], [String.raw`t'`, "integration variable (time)", "s", "–"]],
      go: ["chart", "Season chart"], refs: [4], live: () => { const r = S.run, i = curIdx(); return r ? `Now: $S$ = ${(r.S[i] / 86400).toFixed(0)} °C·day.` : "–"; } },
    { no: 7, name: "Quasi-steady growth with constant surface resistance", tex: String.raw`\begin{aligned} \dfrac{h^2}{2k} + \dfrac{h}{U} &= \dfrac{S}{\rho L} \\ h &= -\dfrac{k}{U} + \sqrt{\left(\dfrac{k}{U}\right)^{2} + \dfrac{2kS}{\rho L}} \end{aligned}`,
      sym: [[String.raw`h`, "ice thickness", "m", "computed"], [String.raw`k`, "ice thermal conductivity", "W/(m·K)", "2.22"], [String.raw`U`, "overall surface coefficient", "W/(m²·K)", "eq. (4)"], [String.raw`S`, "freezing degree-time", "°C·s", "eq. (6)"], [String.raw`\rho`, "ice density", "kg/m³", "916.2"], [String.raw`L`, "latent heat of fusion", "J/kg", "334 000"]],
      go: ["chart", "Season chart (blue)"], refs: [3, 1], live: () => { const r = S.run, i = curIdx(); return r && r.hQS[i] !== null ? `Now: ${f1(inch(r.hQS[i]))} in, against ${f1(inch(curH()))} in from the transient model (integrated day by day with that day's $U$).` : "–"; } },
    { no: 8, name: "Stefan's law (no surface resistance)", tex: String.raw`h = \sqrt{\dfrac{2kS}{\rho L}}`,
      sym: [[String.raw`h`, "ice thickness (limit of (7) for U → ∞)", "m", "computed"], [String.raw`k`, "ice thermal conductivity", "W/(m·K)", "2.22"], [String.raw`S`, "freezing degree-time", "°C·s", "eq. (6)"], [String.raw`\rho`, "ice density", "kg/m³", "916.2"], [String.raw`L`, "latent heat of fusion", "J/kg", "334 000"]],
      go: ["chart", "Season chart (grey)"], refs: [2, 4], live: () => { const r = S.run, i = curIdx(); return r && r.hStefan[i] !== null ? `Now: ${f1(inch(r.hStefan[i]))} in.` : "–"; } },
    { no: 9, name: "Neumann's exact solution (used for validation)", tex: String.raw`\begin{aligned} h &= 2\lambda\sqrt{\alpha t}, \qquad \lambda\, e^{\lambda^2} \operatorname{erf}\lambda = \dfrac{\mathrm{Ste}}{\sqrt{\pi}} \\ \mathrm{Ste} &= \dfrac{c_p\,(T_f - T_s)}{L}, \qquad \alpha = \dfrac{k}{\rho\, c_p} \end{aligned}`,
      sym: [[String.raw`h`, "ice thickness", "m", "exact"], [String.raw`\lambda`, "growth constant", "–", "solved by bisection"], [String.raw`\alpha`, "thermal diffusivity of ice", "m²/s", "1.18 × 10⁻⁶"], [String.raw`t`, "time", "s", "–"], [String.raw`\mathrm{Ste}`, "Stefan number: sensible vs latent heat", "–", "0.03–0.15"],
            [String.raw`c_p`, "ice specific heat", "J/(kg·K)", "2050"], [String.raw`T_f`, "freezing point", "°C", "0"], [String.raw`T_s`, "fixed surface temperature", "°C", "−5 to −20"], [String.raw`L`, "latent heat of fusion", "J/kg", "334 000"], [String.raw`k`, "ice thermal conductivity", "W/(m·K)", "2.22"], [String.raw`\rho`, "ice density", "kg/m³", "916.2"]],
      go: ["m-val", "Validation"], refs: [4], live: () => `For $T_s$ = −10 °C: $\\mathrm{Ste}$ = ${(PROPS.cpI * 10 / PROPS.L).toFixed(4)}, $\\lambda$ = ${neumannLambda(PROPS.cpI * 10 / PROPS.L).toFixed(5)}.` },
  ] },
  { group: "Modeling and statistics", courses: [255, 355], items: [
    { no: 11, name: "Front-fixing (Landau) transform used by the solver", tex: String.raw`\begin{aligned} \xi &= \dfrac{z}{h(t)}, \qquad 0 \le \xi \le 1 \\ \dfrac{\partial T}{\partial t} &= \dfrac{\alpha}{h^2}\dfrac{\partial^2 T}{\partial \xi^2} + \xi\,\dfrac{\dot h}{h}\,\dfrac{\partial T}{\partial \xi} \end{aligned}`,
      sym: [[String.raw`\xi`, "scaled depth (0 at the surface, 1 at the front)", "–", "24 intervals"], [String.raw`z`, "depth below the ice surface", "m", "0 to h"], [String.raw`h`, "ice thickness", "m", "solved"], [String.raw`T`, "ice temperature", "°C", "solved"], [String.raw`t`, "time", "s", "1 h steps"], [String.raw`\alpha`, "thermal diffusivity", "m²/s", "1.18 × 10⁻⁶"], [String.raw`\dot h`, "growth rate of the ice", "m/s", "computed"]],
      go: ["m-num", "Numerical method"], refs: [4], live: () => isOpen() ? "No ice on this day." : `Now: each of the 24 grid layers is ${(curH() * 100 / 24).toFixed(2)} cm thick.` },
    { no: 12, name: "Freeze-up date under warming", tex: String.raw`\begin{aligned} &\sum_{i < n_{\mathrm{on}}(\Delta T)} \max\!\left(0,\; T_f - T_i - \Delta T\right) \\ &\qquad \ge\; \sum_{i < n_{\mathrm{on}}^{\mathrm{obs}}} \max\!\left(0,\; T_f - T_i\right) \end{aligned}`,
      assumed: "A modeling rule, not from a source: the lake needs the same accumulated cold to freeze in a warmer winter as it did in the real one.",
      sym: [[String.raw`n_{\mathrm{on}}(\Delta T)`, "freeze-up day in the warmer winter", "day", "computed"], [String.raw`T_f`, "freezing point", "°C", "0"], [String.raw`T_i`, "daily mean air temperature on day i", "°C", "Madison data"], [String.raw`\Delta T`, "uniform warming added to every day", "°C", "0–4"], [String.raw`n_{\mathrm{on}}^{\mathrm{obs}}`, "observed freeze-up day", "day", "from the record"]],
      go: ["climate", "Climate change"], refs: [9], live: () => S.mode === "real" ? `Now: ${S.winter} at +${S.dT} °C freezes ${S.iceOn === null ? "never" : fmtDate(S.winter, S.iceOn)} (observed ${fmtDate(S.winter, dayIdx(S.winter, recOf(S.winter).on))}).` : "Textbook mode: freeze-up fixed at 20 Dec." },
    { no: 13, name: "Trend in days of ice cover", tex: String.raw`\begin{aligned} D_j &= \beta_0 + \beta_1\, y_j + \varepsilon_j \\ \hat\beta &= \arg\min_{\beta_0,\,\beta_1} \sum_j \left(D_j - \beta_0 - \beta_1 y_j\right)^2 \end{aligned}`,
      sym: [[String.raw`D_j`, "days of ice cover in winter j", "day", "21–161"], [String.raw`\beta_0`, "intercept", "day", "fitted"], [String.raw`\beta_1`, "trend (slope)", "day/yr", "fitted"], [String.raw`y_j`, "first year of winter j", "yr", `${TREND.first}–${TREND.last}`], [String.raw`\varepsilon_j`, "year-to-year scatter", "day", "residual"], [String.raw`\hat\beta`, "least-squares estimates of the $\\beta$'s", "–", `${TREND.n} winters`]],
      go: ["climate", "Climate change"], refs: [9], live: () => `Now: $\\beta_1$ = ${TREND.b1.toFixed(3)} day/yr (${(TREND.b1 * 100).toFixed(1)} days per century); residual s.d. ${TREND.sd.toFixed(1)} days.` },
  ] },
];
const EQ_BY_NO = Object.fromEntries(EQ.flatMap(g => g.items).map(e => [e.no, e]));
const PARAMS = [
  ["$\\rho$", "ice density at 0 °C", "916.2", "kg/m³", ref(7)], ["$k$", "ice thermal conductivity at 0 °C", "2.22", "W/m·K", ref(7)],
  ["$c_p$", "ice specific heat at 0 °C", "2050", "J/kg·K", ref(7)], ["$L$", "latent heat of fusion", "334 000", "J/kg", ref(8)],
  ["$T_f$", "freezing point", "0", "°C", ""], ["$5.7,\\ 3.8$", "wind correlation coefficients (5)", "5.7 W/m²K; 3.8 J/m³K", "", ref(6)],
  ["$k_s$", "snow conductivity", "0.20", "W/m·K", `assumed; measured values for seasonal snow vary about tenfold${ref(5)}`],
  ["$f_s$", "share of the land snow depth lying on the lake ice", "0.10", "–", `fitted to two measured Mendota thicknesses${ref(13, 14)}; wind sweeps snow off open ice`],
  ["$V$", "wind speed", "4", "m/s", "assumed typical value; adjustable"], ["$q_w$", "water-to-ice heat flux", "0", "W/m²", "assumed; small under winter ice"],
  ["$T_a,\\ d_s$", "daily mean air temperature and snow depth, Madison", "1948–2026", "°C, cm", ref(10)],
  ["ice-on, ice-off", "Lake Mendota freeze and thaw dates", "1855–2026", "date", ref(9)],
  ["thresholds", "4, 5, 7, 9, 11, 13, 16, 20 in of new clear ice", "", "in", ref(11)],
];
function renderModel() {
  const V = VALID;
  $("mdl-body").innerHTML = `
    <h3>1. What is modeled</h3>
    <p>A one-dimensional column through the ice cover of Lake Mendota, from the snow surface to the ice–water interface. The state is the temperature profile in the ice, $T(z,t)$, and the ice thickness $h(t)$. Inputs are the daily mean air temperature and snow depth for a real Madison winter (or a constant "textbook" winter), the share of that snow lying on the lake, the wind speed and an optional uniform warming $\\Delta T$. Outputs are the ice thickness and temperature profile each day, the dates the ice passes safety thresholds, and, for 30 recent winters, how warming changes the thickest ice and the number of walkable days. The idea follows the classic quasi-steady lake-ice exercise in Bird, Stewart and Lightfoot${ref(1)}; the twin also solves the full transient problem to show when the quasi-steady shortcut holds.</p>
    <h3>2. Governing equations</h3>
    ${EQ.map(G => { const nos = G.items.map(e => e.no); return `<h4 class="mdl-group">${G.group} · Eqs. (${Math.min(...nos)})–(${Math.max(...nos)}) <span class="mdl-courses">${G.courses.map(courseLink).join(" ")}</span></h4>${G.items.map(e => `
      <div class="mdl-eq" id="eq-${e.no}">
        <div class="mdl-h"><span class="mdl-n">(${e.no})</span><span class="mdl-name">${e.name}${ref(...e.refs)}</span><button class="btn mdl-go" type="button" data-go="${e.go[0]}" title="${e.go[1]}">Show in the twin ▸</button></div>
        <div class="mdl-tex" data-tex="${encodeURIComponent(e.tex)}"></div>
        ${e.assumed ? `<p class="mdl-assumed"><span class="mdl-src">Assumed</span>${e.assumed}</p>` : ""}
        <div class="mdl-scroll"><table class="mdl-tab"><thead><tr><th>Symbol</th><th>Meaning</th><th>Units</th><th>Value or range</th></tr></thead><tbody>${e.sym.map(x => `<tr><td><span class="mdl-sym" data-inline="1" data-tex="${encodeURIComponent(x[0])}"></span></td><td>${x[1]}</td><td>${x[2]}</td><td>${x[3]}</td></tr>`).join("")}</tbody></table></div>
        ${e.live ? `<p class="mdl-live" data-live="${e.no}"></p>` : ""}
      </div>`).join("")}`; }).join("")}
    <h3>3. Parameters and data</h3>
    <div class="sym-wrap"><table class="sym"><thead><tr><th>Symbol</th><th>Meaning</th><th>Value</th><th>Units</th><th>Source</th></tr></thead><tbody>
      ${PARAMS.map(p => `<tr><td>${mathify(p[0])}</td><td>${p[1]}</td><td>${p[2]}</td><td>${p[3]}</td><td>${p[4]}</td></tr>`).join("")}</tbody></table></div>
    <h3 id="m-num">4. Numerical method</h3>
    <ul class="mdl-list">
      <li>Equations (1)–(4) and (10) are solved on the front-fixed grid (11): ${DEFAULTS.N} equal intervals in $\\xi$ from the ice surface ($\\xi = 0$) to the freezing front ($\\xi = 1$), so the grid stretches as the ice grows.</li>
      <li>Time step 1 hour (24 steps per day of weather; each day's air temperature and snow depth are held constant). Fully implicit (backward Euler) in $T$ with central differences in $\\xi$; the tridiagonal system is solved exactly by the Thomas algorithm.</li>
      <li>The surface condition (4) uses a ghost node; the front speed $\\dot h$ in (11) is lagged one step, and (3) uses a second-order one-sided gradient at the front.</li>
      <li>If the implicit solve would put the surface above 0 °C, the step is repeated with $T_s = T_f$ and the excess heat melts ice from the top (10). The ice is declared open once it is thinner than 2 mm; it does not refreeze later in the same winter.</li>
      <li>The closed forms (7) and (8) are updated once per day with that day's air temperature and resistance; (7) is integrated exactly over each day.</li>
      <li>Grid check: refining from 24 to 48 intervals changes the 7 Feb 2014 thickness by less than 0.01 cm (${V.convergence_2014_02_07.N24_cm} vs ${V.convergence_2014_02_07.N48_cm} cm).</li>
    </ul>
    <h3>5. Assumptions and limits</h3>
    <ul class="mdl-list">
      <li>One-dimensional and uniform across the lake: real ice varies near shores, inlets, springs and pressure ridges. Safety must always be checked on site${ref(12)}.</li>
      <li>All ice is clear (black) ice. Snow-ice ("white ice") that forms when snow loads push water up through cracks is not modeled; it is weaker${ref(11)}.</li>
      <li>Snow is a thin, heat-capacity-free resistance with fixed conductivity; its depth on the lake is a fixed share of the airport snow depth. This is the least certain input.</li>
      <li>Daily mean air temperature drives the surface; sunlight, longwave radiation and rain are not modeled separately. Melting in spring is therefore only approximate.</li>
      <li>The water under the ice is at the freezing point at the interface and supplies no heat ($q_w = 0$ by default).</li>
      <li>Warming scenarios add the same $\\Delta T$ to every day of a real winter and keep its snow; freeze-up follows rule (12). They are sensitivity tests, not climate forecasts.</li>
    </ul>
    <h3 id="m-val">6. Validation</h3>
    <p class="takeaway"><b>What this means</b>In short: the solver matches the exact textbook solution to within 0.01 %, the simple "square-root" formula is only 0.5–2 % off, and with the fitted snow share the twin lands within about 3 cm of the two measured Mendota thicknesses. Spring melt is the weakest part (ice-off dates are typically off by about 19 days).</p>
    <div class="sym-wrap"><table class="sym"><thead><tr><th>Check</th><th>Twin</th><th>Reference</th><th>Difference</th></tr></thead><tbody>
      ${[-5, -10, -20].map(t => { const v = V[`neumann_Ts${t}`]; return `<tr><td>Transient model vs Neumann exact solution (9), surface at ${t} °C, 60 days</td><td>${v.numeric_cm} cm</td><td>${v.exact_cm} cm</td><td>${(v.relErr * 100).toFixed(4)} %</td></tr>`; }).join("")}
      ${[-5, -10, -20].map(t => { const v = V[`neumann_Ts${t}`]; return `<tr><td>Quasi-steady Stefan's law (8) vs exact (9), ${t} °C</td><td>${v.stefanQS_cm} cm</td><td>${v.exact_cm} cm</td><td>+${(v.qsVsExact * 100).toFixed(1)} % (≈ $\\mathrm{Ste}/6$)</td></tr>`; }).join("")}
      <tr><td>Transient model vs quasi-steady (7), −10 °C, 10 cm snow, 4 m/s, 60 days</td><td>${V.snow10cm_60d.numeric_cm} cm</td><td>${V.snow10cm_60d.quasiSteady_cm} cm</td><td>${(V.snow10cm_60d.relDiff * 100).toFixed(1)} %</td></tr>
      <tr><td>Lake Mendota, 29 Feb 2012${ref(13)}</td><td>${(V["obs_2012-02-29"]["snowFrac0.1"] ?? 19.9)} cm</td><td>17 cm (measured)</td><td>fit point</td></tr>
      <tr><td>Lake Mendota, early Feb 2014${ref(14)}</td><td>${(V["obs_2014-02-07"]["snowFrac0.1"] ?? 62.1)} cm</td><td>"about two feet" ≈ 61 cm</td><td>fit point</td></tr>
      <tr><td>Ice-off date, hindcast of ${V.hindcastIceOff.winters} winters 1948–2026 (ice-on from the record)${ref(9)}</td><td colspan="2">mean error ${V.hindcastIceOff.meanErrDays} days, RMSE ${V.hindcastIceOff.rmseDays} days</td><td>spring melt is approximate</td></tr>
    </tbody></table></div>
    <p class="note">Snow share $f_s = 0.10$ minimizes the error at the two measured thicknesses (19.9 and 62.1 cm against 17 and 61 cm); with no snow the model gives 22.2 and 74.7 cm, and with half the land snow 14.8 and 33.4 cm. Scripts: <code>validate.mjs</code> and <code>climate.mjs</code> in the twin's folder.</p>
    <h3>References</h3>
    <ol class="refs">${REFS.map((r, i) => `<li id="mref-${i + 1}">${r}</li>`).join("")}</ol>`;
  $("mdl-body").querySelectorAll("p, li, td").forEach(el => { if (el.innerHTML.includes("$") && !el.querySelector("[data-tex]")) el.innerHTML = mathify(el.innerHTML); });
  renderTexIn($("mdl-body"));
  refreshModelLive();
}
function refreshModelLive() {
  document.querySelectorAll("#mdl-body [data-live]").forEach(el => { const e = EQ_BY_NO[+el.dataset.live]; el.innerHTML = mathify(esc(e.live())); });
}
function toggleModel(on, anchorId) {
  mdlOpen = on; $("mdl-panel").hidden = !on;
  if (on) { renderModel(); if (anchorId) requestAnimationFrame(() => { const el = $(anchorId); if (!el) return; el.scrollIntoView({ block: "start" }); if (el.classList.contains("mdl-eq")) { el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1800); } }); else $("mdl-close").focus(); }
}
$("open-model").onclick = () => toggleModel(true);
$("mdl-close").onclick = () => toggleModel(false);
$("mdl-panel").addEventListener("click", e => { if (e.target.id === "mdl-panel") toggleModel(false); const g = e.target.closest("[data-go]"); if (g && GO[g.dataset.go] && !g.dataset.go.startsWith("m-")) { toggleModel(false); GO[g.dataset.go](); } else if (g) GO[g.dataset.go](); });
// let lens equations jump to the model panel
lensCard.addEventListener("click", e => { if (e.target.closest(".lc-eq summary")) return; });

// ---------------- controls ----------------
$("winter").innerHTML = WKEYS.slice().reverse().map(w => { const r = recOf(w); return `<option value="${w}">${w} · ${r.days} days of ice</option>`; }).join("");
$("winter").value = S.winter;
function setMode(m) {
  S.mode = m; $("mode-real").setAttribute("aria-pressed", String(m === "real")); $("mode-book").setAttribute("aria-pressed", String(m === "book"));
  $("real-box").hidden = m !== "real"; $("book-box").hidden = m !== "book"; recompute(false); drawRecord(); drawWarm();
}
$("mode-real").onclick = () => setMode("real"); $("mode-book").onclick = () => setMode("book");
$("winter").onchange = e => { S.winter = e.target.value; recompute(false); drawRecord(); };
const bindRange = (id, fmt, apply, warm = false) => { $(id).oninput = e => { const v = +e.target.value; $(id + "-out").textContent = fmt(v); apply(v); recompute(true); if (warm) { WARM = null; drawWarm(); clearTimeout(bindRange.t); bindRange.t = setTimeout(computeWarm, 400); } else drawWarm(); }; };
bindRange("warming", v => `+${v.toFixed(1)} °C`, v => { S.dT = v; });
bindRange("snowfrac", v => `${v} %`, v => { S.snowFrac = v / 100; }, true);
bindRange("wind", v => `${v} m/s`, v => { S.wind = v; }, true);
bindRange("tair", v => `${v < 0 ? "−" + -v : v} °C`, v => { S.Ta = v; });
bindRange("snowcm", v => `${v} cm`, v => { S.snowCm = v; });
$("scrub").oninput = e => { S.day = +e.target.value; refreshAll(); };
$("reset").onclick = () => { S.day = S.iceOn === null ? 0 : Math.max(0, S.iceOn - 6); playing = true; $("play").textContent = "Pause"; refreshAll(); };
let playing = !matchMedia("(prefers-reduced-motion: reduce)").matches;
$("play").textContent = playing ? "Pause" : "Play";
$("play").onclick = () => { playing = !playing; $("play").textContent = playing ? "Pause" : "Play"; };
function syncControls() {
  for (const [id, v, fmt] of [["warming", S.dT, v => `+${v.toFixed(1)} °C`], ["snowfrac", Math.round(S.snowFrac * 100), v => `${v} %`], ["wind", S.wind, v => `${v} m/s`], ["tair", S.Ta, v => `${v < 0 ? "−" + -v : v} °C`], ["snowcm", S.snowCm, v => `${v} cm`]]) { $(id).value = v; $(id + "-out").textContent = fmt(v); }
  $("winter").value = S.winter; $("mode-real").setAttribute("aria-pressed", String(S.mode === "real")); $("mode-book").setAttribute("aria-pressed", String(S.mode === "book"));
  $("real-box").hidden = S.mode !== "real"; $("book-box").hidden = S.mode !== "book";
}

// ---------------- problem-set setups (#ps-<course>-<k>) ----------------
export const PS_SETUPS = {
  "150-1": { mode: "real", winter: "2013-14", dT: 0, day: 30 },
  "250-1": { mode: "book", Ta: -10, snowCm: 0, wind: 4, day: 49 + 30, pause: true },
  "255-1": { mode: "book", Ta: -10, snowCm: 5, wind: 4, day: 49 + 59, pause: true },
  "255-2": { mode: "real", winter: "2011-12", dT: 0, day: 120, pause: true, panel: "sec-weather" },
  "310-1": { mode: "book", Ta: -10, snowCm: 0, wind: 4, day: 49 + 59, pause: true, view: "cutaway" },
  "320-1": { mode: "book", Ta: -10, snowCm: 0, wind: 12, day: 49 + 29, pause: true },
  "320-2": { mode: "book", Ta: -10, snowCm: 10, wind: 4, day: 49 + 59, pause: true, view: "cutaway" },
  "324-1": { mode: "real", winter: "2013-14", dT: 0, day: 98, pause: true },
  "326-1": { mode: "real", winter: "2013-14", dT: 0, wind: 1, day: 98, pause: true, panel: "sec-weather" },
  "355-1": { mode: "real", winter: "2025-26", dT: 0, day: 61, pause: true, panel: "sec-climate" },
  "355-2": { mode: "real", winter: "2025-26", dT: 0, day: 61, pause: true, panel: "sec-climate" },
  "450-3": { mode: "real", winter: "2020-21", dT: 0, snowFrac: 0.10, day: 92, pause: true, panel: "sec-weather" },
  "355-3": { mode: "real", winter: "2013-14", dT: 0, day: 119, pause: true, panel: "sec-weather", fit: true },
  "450-1": { mode: "real", winter: "2013-14", dT: 0, day: 61, pause: true },
  "450-2": { mode: "real", winter: "2013-14", dT: 2, day: 61, pause: true },
  "int-1": { mode: "real", winter: "2013-14", dT: 0, day: 85, pause: true, view: "edge", face: "temp" },
  "512-1": { mode: "real", winter: "2013-14", dT: 0, day: 61, pause: true, panel: "sec-climate" },
};
function applySetup() {
  const m = location.hash.match(/^#ps[-=]((?:\d+|int))-(\d+)/); if (!m) return false;
  const P = PS_SETUPS[`${m[1]}-${m[2]}`]; if (!P) return false;
  S.fitPts = !!P.fit; S.mode = P.mode; if (P.winter) S.winter = P.winter; S.dT = P.dT ?? 0; S.wind = P.wind ?? DEFAULTS.wind; S.snowFrac = P.snowFrac ?? DEFAULTS.snowFrac;
  if (P.Ta !== undefined) S.Ta = P.Ta; if (P.snowCm !== undefined) S.snowCm = P.snowCm;
  syncControls(); recompute(true); S.day = P.day; if (P.pause) { playing = false; $("play").textContent = "Play"; }
  if (P.panel) setFold($(P.panel), true); if (P.view) goTo(P.view, true); if (P.face) setFace(P.face === "real");
  try { localStorage.setItem("ice-intro-seen", "1"); } catch (e) {}
  refreshAll(); return true;
}

// ---------------- loop ----------------
function redrawCharts() { drawSeason(); drawRecord(); drawWarm(); }
function resize() { const w = stage.clientWidth, h = stage.clientHeight; renderer.setSize(w, h, false); POST.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); redrawCharts(); }
new ResizeObserver(resize).observe(stage);
new ResizeObserver(() => redrawCharts()).observe(document.querySelector("aside"));
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", redrawCharts);

syncControls(); recompute(false); { const iw = S.run && firstDayAtLeast(S.run.h, 4 * IN); if (iw !== null && iw !== undefined) { S.day = iw; refreshAll(); } } goTo("lake", true); resize();   // open on the first walkable day: the anglers are out
const hadSetup = applySetup();
window.addEventListener("hashchange", applySetup);
{ let seen = false; try { seen = localStorage.getItem("ice-intro-seen") === "1"; } catch (e) {} if (!seen && !hadSetup) openIntro(); }
computeWarm();

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1); last = now;
  if (playing) {
    const before = curIdx(); S.day += dt * +$("rate").value;
    if (S.day >= NDAYS - 1) { const iw = S.run && firstDayAtLeast(S.run.h, 4 * IN); S.day = iw != null ? iw : S.iceOn === null ? 0 : Math.max(0, S.iceOn - 6); }
    if (curIdx() !== before) refreshAll();
  }
  if (tween) {
    const u = Math.min((now - tween.t0) / tween.dur, 1), e = u * u * (3 - 2 * u);
    camera.position.lerpVectors(tween.from.p, tween.to.p, e); controls.target.lerpVectors(tween.from.c, tween.to.c, e);
    camera.fov = tween.from.fov + (tween.to.fov - tween.from.fov) * e; camera.updateProjectionMatrix(); if (u >= 1) tween = null;
  }
  // wind streaks drift with the wind
  const v = S.wind * dt * 1.5; const P = windGeo.attributes.position.array;
  for (let i = 0; i < N_WIND; i++) { let x = P[i * 6] + v; if (x > HALF) x -= LAKE; P[i * 6] = x; P[i * 6 + 3] = x + 0.6 + S.wind * 0.35; P[i * 6 + 1] = P[i * 6 + 4] = P[i * 6 + 1]; }
  windGeo.attributes.position.needsUpdate = true; windLines.visible = S.wind > 0; windLines.material.opacity = Math.min(0.6, 0.1 + S.wind * 0.05);
  mast.userData.cups.rotation.y += dt * S.wind * 1.2;
  { const h = curH(), open = isOpen(), t = now / 1000;
    waterBack.position.set(0, -h - WDEPTH / 2, HALF - 3.2);
    FISH.forEach(f => { const u = f.userData, x = u.x0 + Math.sin(t * u.sp + u.ph) * u.amp, dx = Math.cos(t * u.sp + u.ph) * u.sp;
      f.position.set(x, -h - u.d - 0.05 * Math.sin(t * 0.7 + u.ph), u.z); f.rotation.y = dx >= 0 ? 0 : Math.PI; u.update(t); f.visible = !open; });
    const inCut = camera.position.z > HALF && camera.position.y < 0.1;   // cutaway: camera below the ice, no name tags
    PLACE_TAGS.forEach(({ el, p }) => { _v.copy(p).project(camera); const ok = !inCut && _v.z < 1 && _v.z > -1 && Math.abs(_v.x) < 0.95 && Math.abs(_v.y) < 0.95 && camera.position.distanceTo(p) > 25;
      el.style.display = ok ? "" : "none"; if (ok) { el.style.left = `${(_v.x + 1) / 2 * stage.clientWidth}px`; el.style.top = `${(1 - _v.y) / 2 * stage.clientHeight}px`; } });
    { // large on-screen ice-thickness and water labels, anchored to the cut face
      const W = stage.clientWidth, Hs = stage.clientHeight, hh = Math.max(curH(), 0.002), front = camera.position.z > HALF + 0.2;
      const put = (el, p, minX) => { _v.copy(p).project(camera); const ok = front && _v.z < 1 && _v.z > -1 && Math.abs(_v.x) < 1.1 && Math.abs(_v.y) < 0.95;
        el.style.display = ok ? "" : "none"; if (ok) { el.style.left = `${Math.max(minX, (_v.x + 1) / 2 * W)}px`; el.style.top = `${(1 - _v.y) / 2 * Hs}px`; } };
      put($("ice-big"), new THREE.Vector3(RULER_X - 0.14, -hb2(hh) / 2, HALF + 0.02), 170);
      put($("water-big"), new THREE.Vector3(-0.15, -hh - 0.62, HALF + 0.02), 120);
    }
    { // name tags for Olaf, Bob, Warren and Ed: red text, kept clear of the spots and of each other
      const W = stage.clientWidth, Hs = stage.clientHeight, placed = [];
      const tags = NAMED.map(n => { anglers[n.i].getWorldPosition(_bob); _bob.y += 1.45; _v.copy(_bob).project(camera);
        return { n, ok: anglers[n.i].visible && !open && !inCut && _v.z < 1 && _v.z > -1 && Math.abs(_v.x) < 1 && Math.abs(_v.y) < 1, x: (_v.x + 1) / 2 * W, y: (1 - _v.y) / 2 * Hs }; });
      tags.sort((a, b) => b.y - a.y).forEach(t => {
        if (!t.ok) { t.n.el.style.display = "none"; return; }
        const w = 8 * t.n.name.length + 10;
        for (let pass = 0; pass < 4; pass++) {
          for (const el of spotEls) { if (el.style.display === "none") continue; const sx = parseFloat(el.style.left), sy = parseFloat(el.style.top); if (Math.abs(sx - t.x) < 18 + w / 2 && Math.abs(sy - t.y) < 30) t.y = sy - 34; }
          for (const q of placed) if (Math.abs(q.x - t.x) < (q.w + w) / 2 + 4 && Math.abs(q.y - t.y) < 18) t.y = q.y - 18;
        }
        placed.push({ x: t.x, y: t.y, w }); t.n.el.style.display = ""; t.n.el.style.left = `${t.x}px`; t.n.el.style.top = `${t.y}px`;
      });
    } }
  if (beacon.visible) { const k = 1 + 0.18 * Math.sin(now / 220); beacon.children.forEach(c => c.scale.set(k, 1, k)); }
  controls.update(); fitShadow(); SPARKLE.material.uniforms.uPR.value = renderer.getPixelRatio(); POST.render(dt); placeSpots();
}
renderer.setAnimationLoop(frame);
window.__twin = { toggleResearch, RESEARCH, frame, S, recompute, refreshAll, goTo, openLens, closeLens, toggleCourses, toggleModel, camera, controls, renderer, scene, LENSES, PS_SETUPS, applySetup, setPlaying: v => { playing = v; } };
