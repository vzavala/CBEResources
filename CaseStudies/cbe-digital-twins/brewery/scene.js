// Brewery Digital Twin: 3D brewhouse and cellar (metres). Builds the scene and returns handles the app drives each frame.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry, normalFromHeight, rngFrom, fabric } from "./hq.js";

const phys = o => new THREE.MeshPhysicalMaterial(o);
const rnd = rngFrom(4711);

// ---------- procedural maps ----------
const brushed = normalFromHeight(256, 256, (g, w, h) => { const r = rngFrom(7); g.fillStyle = "#808080"; g.fillRect(0, 0, w, h); for (let i = 0; i < 2600; i++) { const v = 90 + r() * 80; g.fillStyle = `rgba(${v},${v},${v},.5)`; g.fillRect(0, r() * h, w, 1); } }, 1.2, [1, 6]);
const hammered = normalFromHeight(256, 256, (g, w, h) => { const r = rngFrom(9); g.fillStyle = "#808080"; g.fillRect(0, 0, w, h); for (let i = 0; i < 380; i++) { const x = r() * w, y = r() * h, q = 6 + r() * 9, gr = g.createRadialGradient(x, y, 0, x, y, q); gr.addColorStop(0, "rgba(40,40,40,.55)"); gr.addColorStop(1, "rgba(128,128,128,0)"); g.fillStyle = gr; g.fillRect(x - q, y - q, 2 * q, 2 * q); } }, 2.2, [6, 3]);
function floorTex() {
  const c = document.createElement("canvas"); c.width = c.height = 1024; const g = c.getContext("2d"), r = rngFrom(21);
  g.fillStyle = "#b9b3a8"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 26000; i++) { const v = 150 + r() * 70; g.fillStyle = `rgba(${v},${v - 4},${v - 12},.22)`; g.fillRect(r() * 1024, r() * 1024, 1 + r() * 2, 1 + r() * 2); }
  for (let i = 0; i < 60; i++) { const x = r() * 1024, y = r() * 1024, q = 30 + r() * 110, gr = g.createRadialGradient(x, y, 0, x, y, q); gr.addColorStop(0, "rgba(70,62,50,.10)"); gr.addColorStop(1, "rgba(70,62,50,0)"); g.fillStyle = gr; g.fillRect(x - q, y - q, 2 * q, 2 * q); }
  g.strokeStyle = "rgba(60,55,48,.35)"; g.lineWidth = 2; for (let k = 0; k <= 4; k++) { g.beginPath(); g.moveTo(k * 256, 0); g.lineTo(k * 256, 1024); g.moveTo(0, k * 256); g.lineTo(1024, k * 256); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 3); t.anisotropy = 8; return t;
}
function brickTex() {
  const c = document.createElement("canvas"); c.width = 512; c.height = 512; const g = c.getContext("2d"), r = rngFrom(33);
  g.fillStyle = "#cfc8bb"; g.fillRect(0, 0, 512, 512);
  for (let row = 0; row < 16; row++) for (let col = -1; col < 9; col++) { const x = col * 64 + (row % 2) * 32, y = row * 32, v = r(); g.fillStyle = `rgb(${178 + v * 30},${120 + v * 24},${98 + v * 20})`; g.fillRect(x + 2, y + 2, 60, 28); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(14, 3.2); t.anisotropy = 8; return t;
}
const softDot = (() => { const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d"), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,.9)"); gr.addColorStop(.5, "rgba(255,255,255,.35)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();

// ---------- materials ----------
const M = {
  steel: phys({ color: "#e4e8ec", metalness: 0.9, roughness: 0.3, normalMap: brushed, normalScale: new THREE.Vector2(0.3, 0.3), envMapIntensity: 2.4 }),
  steelDark: phys({ color: "#aab1b8", metalness: 0.85, roughness: 0.42, envMapIntensity: 2 }),
  copper: phys({ color: "#d98a55", metalness: 0.92, roughness: 0.24, envMapIntensity: 2.2, normalMap: hammered, normalScale: new THREE.Vector2(0.25, 0.25), clearcoat: 0.4, clearcoatRoughness: 0.3, envMapIntensity: 1.2 }),
  jacket: phys({ color: "#d3d9de", metalness: 0.9, roughness: 0.38, envMapIntensity: 2.2, normalMap: hammered, normalScale: new THREE.Vector2(0.5, 0.5), emissive: "#2a7fd0", emissiveIntensity: 0 }),
  paint: phys({ color: "#2f5d8a", metalness: 0.3, roughness: 0.5, clearcoat: 0.5 }),
  red: phys({ color: "#c5050c", metalness: 0.3, roughness: 0.45, clearcoat: 0.6 }),
  yellow: phys({ color: "#e0b020", metalness: 0.3, roughness: 0.5 }),
  rubber: phys({ color: "#1b1c1e", roughness: 0.9 }),
  glass: phys({ color: "#ffffff", roughness: 0.05, transmission: 0.95, thickness: 0.02, ior: 1.5, transparent: true, opacity: 0.35 }),
  grate: phys({ color: "#70767c", metalness: 0.9, roughness: 0.55 }),
  wood: phys({ color: "#8a6a45", roughness: 0.8 }),
  sack: fabric("#c9b48a"),
  keg: phys({ color: "#e2e6e9", metalness: 0.9, roughness: 0.28, envMapIntensity: 2.2, normalMap: brushed, normalScale: new THREE.Vector2(0.2, 0.2) }),
};
const shadow = m => { m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return m; };
const cyl = (rt, rb, h, mat, seg = 40, open = false) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), mat);

// dished-head vessel as a lathe: straight shell of radius r and height h, dished top, cone or dish bottom
function vesselGeo(r, h, cone = 0, dish = 0.22, th = Math.PI * 2, t0 = 0) {
  const pts = [new THREE.Vector2(0.03, -h / 2 - cone)];
  if (cone > 0) pts.push(new THREE.Vector2(r, -h / 2)); else for (let i = 1; i <= 8; i++) { const a = i / 8 * Math.PI / 2; pts.push(new THREE.Vector2(r * Math.sin(a), -h / 2 - dish * r * Math.cos(a))); }
  pts.push(new THREE.Vector2(r, h / 2));
  for (let i = 1; i <= 8; i++) { const a = i / 8 * Math.PI / 2; pts.push(new THREE.Vector2(r * Math.cos(a), h / 2 + dish * r * Math.sin(a))); }
  return new THREE.LatheGeometry(pts, 56, t0, th);
}
function pipe(points, rad = 0.05, mat = M.steel) {
  const g = new THREE.Group(), v = points.map(p => new THREE.Vector3(...p));
  for (let i = 0; i < v.length - 1; i++) { const a = v[i], b = v[i + 1], len = a.distanceTo(b), m = cyl(rad, rad, len, mat, 14); m.position.copy(a).lerp(b, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); g.add(m);
    const j = new THREE.Mesh(new THREE.SphereGeometry(rad * 1.12, 14, 10), mat); j.position.copy(b); g.add(j);
    if (len > 1.2) { const fl = cyl(rad * 1.7, rad * 1.7, 0.03, M.steelDark, 16); fl.position.copy(a).lerp(b, 0.5); fl.quaternion.copy(m.quaternion); g.add(fl); } }
  return shadow(g);
}
function legs(r, h, n = 4, y0 = 0) { const g = new THREE.Group(); for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + Math.PI / 4, l = cyl(0.06, 0.06, h, M.steelDark, 12); l.position.set(Math.cos(a) * r, y0 + h / 2, Math.sin(a) * r); const f = cyl(0.11, 0.11, 0.03, M.steelDark, 14); f.position.set(Math.cos(a) * r, y0 + 0.015, Math.sin(a) * r); g.add(l, f); } return g; }
function manway(r = 0.24) { const g = new THREE.Group(), ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.03, 10, 28), M.steelDark), door = cyl(r, r, 0.03, M.steel, 28); door.rotation.x = Math.PI / 2; g.add(ring, door); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, b = cyl(0.018, 0.018, 0.05, M.steelDark, 8); b.rotation.x = Math.PI / 2; b.position.set(Math.cos(a) * r, Math.sin(a) * r, 0.02); g.add(b); } return g; }
function lamp() { const g = new THREE.Group(), post = cyl(0.015, 0.015, 0.25, M.steelDark, 8), l = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 10), phys({ color: "#3a4a3f", emissive: "#35e07a", emissiveIntensity: 0 })); post.position.y = 0.125; l.position.y = 0.29; g.add(post, l); g.userData.light = l.material; return g; }
function handrail(x0, x1, y, z, posts = 6) { const g = new THREE.Group(); for (const yy of [y + 1.05, y + 0.55]) g.add(pipe([[x0, yy, z], [x1, yy, z]], 0.02, M.yellow)); for (let i = 0; i <= posts; i++) { const x = x0 + (x1 - x0) * i / posts; g.add(pipe([[x, y, z], [x, y + 1.05, z]], 0.02, M.yellow)); } return g; }
// A brewer at true scale. Everyone wears the same cap, glasses, apron and boots; o = { woman, h (height factor), skin (0-2), hair (colour), style ("ponytail" | "bun") }.
// The crew is a mix of women and men (Part W): women hold the technical posts at the kettle and at the fermenter.
function person(shirt, pose = "stand", o = {}) {
  const g = new THREE.Group(), cap = (r, l, m) => { const x = new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 6, 14), m); x.castShadow = true; return x; };
  const pants = fabric("#2b3440"), top = fabric(shirt), skin = phys({ color: ["#e6bfa0", "#c99878", "#8d5a3c"][o.skin ?? Math.floor(rnd() * 3)], roughness: 0.55, sheen: 0.3 }), boot = phys({ color: "#3b3f44", roughness: 0.5 });
  for (const sx of [-0.1, 0.1]) { const th = cap(0.075, 0.36, pants), sh = cap(0.06, 0.36, pants), b = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.1, 0.27, 3, 0.04), boot); th.position.set(sx, 0.72, 0); sh.position.set(sx, 0.3, 0); b.position.set(sx, 0.05, 0.04); b.castShadow = true; g.add(th, sh, b); }
  const torso = cap(0.17, 0.38, top); torso.scale.set(o.woman ? 0.9 : 1, 1, 0.72); torso.position.y = 1.2; g.add(torso);
  const apron = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.62, 0.03, 2, 0.012), fabric("#3a3d42")); apron.position.set(0, 1.0, 0.125); g.add(apron);
  const neck = cap(0.05, 0.05, skin); neck.position.y = 1.52; g.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.105, 20, 16), skin); head.scale.set(0.92, 1.1, 1); head.position.y = 1.66; head.castShadow = true; g.add(head);
  const hat = new THREE.Mesh(new THREE.SphereGeometry(0.112, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), fabric("#c5050c")); hat.position.y = 1.69; g.add(hat);
  const brim = cyl(0.07, 0.07, 0.012, hat.material, 16); brim.scale.set(1, 1, 1.3); brim.position.set(0, 1.7, 0.11); g.add(brim);
  const gl = new THREE.Mesh(new RoundedBoxGeometry(0.17, 0.035, 0.02, 2, 0.008), M.glass); gl.position.set(0, 1.665, 0.095); g.add(gl);
  for (const sx of [-1, 1]) { const up = cap(0.045, 0.24, top), lo = cap(0.04, 0.22, skin), hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), skin);
    if (pose === "check" && sx === 1) { up.position.set(0.23, 1.28, 0.1); up.rotation.x = -0.9; lo.position.set(0.23, 1.25, 0.32); lo.rotation.x = -1.5; hand.position.set(0.23, 1.26, 0.46); }
    else { up.position.set(sx * 0.23, 1.25, 0); up.rotation.z = sx * 0.08; lo.position.set(sx * 0.25, 0.97, 0.02); hand.position.set(sx * 0.255, 0.82, 0.03); }
    g.add(up, lo, hand); }
  // hair below the cap: short at the back for everyone; a ponytail or a bun where given
  const hairM = fabric(o.hair || "#3a2a1e"), back = new THREE.Mesh(new THREE.SphereGeometry(0.106, 18, 12), hairM); back.scale.set(0.93, o.woman ? 1.02 : 0.86, 0.9); back.position.set(0, o.woman ? 1.635 : 1.65, -0.022); g.add(back);
  if (o.style === "ponytail") { const tail = cap(0.032, 0.17, hairM); tail.position.set(0, 1.55, -0.125); tail.rotation.x = -0.35; g.add(tail); const tie = cyl(0.036, 0.036, 0.02, fabric("#c5050c"), 10); tie.position.set(0, 1.645, -0.11); tie.rotation.x = Math.PI / 2 - 0.35; g.add(tie); }
  if (o.style === "bun") { const bun = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 10), hairM); bun.position.set(0, 1.6, -0.165); bun.castShadow = true; g.add(bun); }
  if (o.h) g.scale.setScalar(o.h);
  return g;
}
function labelSprite(text, w = 1.6) {
  const c = document.createElement("canvas"); c.width = 640; c.height = 128; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false })); s.scale.set(w, w / 5, 1); s.renderOrder = 20;
  s.userData.set = txt => { if (s.userData.txt === txt) return; s.userData.txt = txt; const g = c.getContext("2d"); g.clearRect(0, 0, 640, 128); g.fillStyle = "rgba(255,255,255,.9)"; g.beginPath(); g.roundRect(4, 4, 632, 120, 22); g.fill(); g.fillStyle = "#1d2733"; g.font = "600 50px Barlow, system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(txt, 320, 66); t.needsUpdate = true; };
  s.userData.set(text); return s;
}

export function buildBrewery({ renderer, scene, overlay, low }) {
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.background = new THREE.Color("#dfe4e8"); scene.fog = new THREE.Fog("#dfe4e8", 60, 140);
  const A = {};   // anchors

  // ---- hall: floor, walls, windows, roof trusses ----
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(64, 34), phys({ map: floorTex(), roughness: 0.55, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.5 })); floor.rotation.x = -Math.PI / 2; floor.position.set(4, 0, 2); floor.receiveShadow = true; scene.add(floor);
  const wallM = phys({ map: brickTex(), roughness: 0.85 }), back = new THREE.Mesh(new THREE.BoxGeometry(64, 9, 0.4), wallM); back.position.set(4, 4.5, -7.2); back.receiveShadow = true; scene.add(back);
  const sideW = new THREE.Mesh(new THREE.BoxGeometry(0.4, 9, 34), phys({ color: "#e9e6df", roughness: 0.9 })); sideW.position.set(-28, 4.5, 2); scene.add(sideW);
  for (let i = 0; i < 7; i++) { const w = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.2, 0.08), phys({ color: "#bcd6ea", emissive: "#cfe6ff", emissiveIntensity: 0.55, roughness: 0.1 })); w.position.set(-18 + i * 7, 6.6, -6.96); scene.add(w);
    const fr = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.08, 0.14), M.steelDark); fr.position.set(-18 + i * 7, 6.6, -6.92); scene.add(fr); const fr2 = fr.clone(); fr2.rotation.z = Math.PI / 2; fr2.scale.x = 0.66; scene.add(fr2); }
  for (let i = 0; i < 8; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.35, 30), M.steelDark); b.position.set(-22 + i * 7.2, 8.9, 2); scene.add(b); }
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { const l = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.5), phys({ color: "#ffffff", emissive: "#fff6e0", emissiveIntensity: 1.6 })); l.position.set(-16 + i * 11, 8.6, -1 + j * 6); scene.add(l); }
  for (let i = 0; i < 5; i++) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.012, 0.22), M.grate); d.position.set(-12 + i * 7, 0.006, 2.2); scene.add(d); }
  for (const x of [-15.5, 2.6]) { const ln = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 12), phys({ color: "#e0b020", roughness: 0.6 })); ln.rotation.x = -Math.PI / 2; ln.position.set(x, 0.004, 1.5); scene.add(ln); }

  // ---- brewhouse platform ----
  const PY = 1.5, plat = new THREE.Mesh(new THREE.BoxGeometry(17, 0.08, 3.2), M.grate); plat.position.set(-7, PY, 0.2); plat.castShadow = plat.receiveShadow = true; scene.add(plat);
  for (let i = 0; i < 6; i++) for (const z of [-1.3, 1.7]) { const c = cyl(0.07, 0.07, PY, M.steelDark, 10); c.position.set(-15 + i * 3.2, PY / 2, z); c.castShadow = true; scene.add(c); }
  scene.add(shadow(handrail(-15.5, 1.5, PY + 0.04, 1.8, 10)));
  const stair = new THREE.Group(); for (let i = 0; i < 7; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.04, 0.28), M.grate); s.position.set(2.1 + i * 0.28, PY - (i + 1) * (PY / 7.5), 0.9); stair.add(s); } stair.add(pipe([[1.7, PY + 1.05, 1.45], [4.1, 1.05, 1.45]], 0.02, M.yellow), pipe([[1.7, PY + 1.05, 0.35], [4.1, 1.05, 0.35]], 0.02, M.yellow)); scene.add(shadow(stair));

  // ---- malt silo, mill and grist conveyor ----
  const silo = new THREE.Mesh(vesselGeo(1.25, 4.2, 1.6), M.steel); silo.position.set(-19.5, 5.2, -3.6); scene.add(shadow(silo)); scene.add(legs(1.15, 1.6).translateX(-19.5).translateZ(-3.6));
  const mill = new THREE.Mesh(new RoundedBoxGeometry(1.5, 1.3, 1.2, 4, 0.08), M.paint); mill.position.set(-17.2, 0.85, -1.2); scene.add(shadow(mill));
  const hopper = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.25, 0.8, 4), M.steel); hopper.rotation.y = Math.PI / 4; hopper.position.set(-17.2, 1.9, -1.2); scene.add(shadow(hopper));
  scene.add(pipe([[-19.5, 1.9, -3.6], [-19.5, 2.6, -1.2], [-17.2, 2.6, -1.2], [-17.2, 2.3, -1.2]], 0.1));
  scene.add(pipe([[-16.4, 0.9, -1.2], [-15.2, 4.9, -1.2], [-13.5, 4.9, -1.2], [-13.5, 4.3, -1.2]], 0.09));
  for (let i = 0; i < 9; i++) { const s = new THREE.Mesh(new RoundedBoxGeometry(0.75, 0.24, 0.5, 4, 0.1), M.sack); s.position.set(-20.6 + (i % 3) * 0.82, 0.2 + Math.floor(i / 3) * 0.25, 1.2 + (i % 2) * 0.05); s.rotation.y = (rnd() - 0.5) * 0.2; scene.add(shadow(s)); }
  const pal = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 1.0), M.wood); pal.position.set(-19.8, 0.06, 1.2); scene.add(pal);
  A.mill = new THREE.Vector3(-17.2, 2.4, -1.2);

  // ---- four brewhouse vessels on the platform ----
  const brewVessel = (x, r, h, mat, name, stack) => {
    const g = new THREE.Group(), sh = new THREE.Mesh(vesselGeo(r, h, 0, 0.3), mat); sh.position.y = 0.55 + h / 2 + 0.3 * r; g.add(sh);
    const band = cyl(r + 0.012, r + 0.012, 0.09, M.steelDark, 48, true); band.position.y = PY + 0.02; g.add(band);
    const top = 0.55 + h + 0.6 * r, mw = manway(0.26); mw.position.set(0, PY + 0.75, r * 0.985); g.add(mw);
    g.add(legs(r * 0.82, 0.55 + 0.3 * r - 0.2 * r, 4));
    if (stack) { const st = cyl(0.2, 0.26, 8.6 - top, M.steel, 20); st.position.y = top + (8.6 - top) / 2 - 0.1; g.add(st); }
    const lp = lamp(); lp.position.set(r * 0.72, PY + 0.04, r * 0.72); g.add(lp);
    const mot = cyl(0.16, 0.16, 0.4, M.paint, 16); mot.position.set(-r * 0.35, top + 0.05, 0); g.add(mot);
    g.position.set(x, 0, -0.4); scene.add(shadow(g)); A[name] = new THREE.Vector3(x, top + 0.2, -0.4); A[name + "Lamp"] = lp.userData.light; return g;
  };
  brewVessel(-13.5, 1.25, 2.3, M.copper, "mash", false);
  brewVessel(-9.7, 1.45, 2.0, M.steel, "lauter", false);
  brewVessel(-5.7, 1.3, 2.5, M.copper, "kettle", true);
  brewVessel(-2.1, 1.1, 2.1, M.steel, "whirl", false);
  // wort pipes between vessels and to the cooler
  scene.add(pipe([[-12.6, 0.75, 0.5], [-12.6, 0.4, 1.0], [-9.7, 0.4, 1.0], [-9.7, 0.7, 0.4]], 0.06), pipe([[-8.6, 0.75, 0.6], [-8.6, 0.4, 1.3], [-5.7, 0.4, 1.3], [-5.7, 0.7, 0.4]], 0.06), pipe([[-4.8, 0.75, 0.5], [-4.8, 0.4, 1.0], [-2.1, 0.4, 1.0], [-2.1, 0.7, 0.3]], 0.06), pipe([[-1.4, 0.75, 0.4], [-1.4, 0.4, 2.6], [0.6, 0.4, 2.6], [0.6, 0.7, 2.6]], 0.06));
  // spent-grain bin under the lauter tun
  const bin = new THREE.Mesh(new RoundedBoxGeometry(1.6, 0.9, 1.2, 3, 0.05), M.paint); bin.position.set(-9.7, 0.5, 3.3); scene.add(shadow(bin));
  const grain = new THREE.Mesh(new THREE.SphereGeometry(0.72, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), phys({ color: "#a98958", roughness: 1 })); grain.scale.set(1, 0.35, 0.75); grain.position.set(-9.7, 0.93, 3.3); scene.add(grain);
  scene.add(pipe([[-9.7, 0.9, 1.0], [-9.7, 1.2, 2.2], [-9.7, 1.25, 3.2]], 0.11, M.steelDark)); A.grain = new THREE.Vector3(-9.7, 1.5, 3.3);
  // steam above the kettle stack and mash tun
  const steamN = low ? 30 : 70, steamGeo = new THREE.BufferGeometry(), sp = new Float32Array(steamN * 3), sph = new Float32Array(steamN); for (let i = 0; i < steamN; i++) sph[i] = rnd();
  steamGeo.setAttribute("position", new THREE.BufferAttribute(sp, 3));
  const steam = new THREE.Points(steamGeo, new THREE.PointsMaterial({ map: softDot, size: 1.5, transparent: true, opacity: 0, depthWrite: false, color: "#ffffff", sizeAttenuation: true })); steam.frustumCulled = false; scene.add(steam);
  A.steam = new THREE.Vector3(-5.7, 8.9, -0.4);

  // ---- plate cooler ----
  const phe = new THREE.Group(); for (let i = 0; i < 26; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.95, 0.42), M.steel); p.position.set(-0.4 + i * 0.032, 0.85, 0); phe.add(p); }
  for (const x of [-0.46, 0.46]) { const e = new THREE.Mesh(new RoundedBoxGeometry(0.07, 1.15, 0.56, 2, 0.02), M.paint); e.position.set(x, 0.85, 0); phe.add(e); }
  for (const y of [0.4, 1.3]) for (const z of [-0.22, 0.22]) phe.add(pipe([[-0.5, y, z], [0.5, y, z]], 0.018, M.steelDark));
  phe.add(legs(0.4, 0.28, 4)); phe.position.set(1.0, 0, 2.6); scene.add(shadow(phe)); A.cooler = new THREE.Vector3(1.0, 1.6, 2.6);
  scene.add(pipe([[1.5, 1.2, 2.6], [2.4, 1.2, 2.6], [2.4, 3.6, 2.6], [2.4, 3.6, -3.0], [14.5, 3.6, -3.0]], 0.05), pipe([[1.5, 0.5, 2.8], [1.9, 0.5, 2.8], [1.9, 0.3, 4.4], [-13.5, 0.3, 4.4]], 0.045, M.red), pipe([[0.5, 1.2, 2.8], [0.2, 1.2, 3.4], [0.2, 0.25, 3.4]], 0.045, M.paint));

  // ---- fermenters (cylindroconical), first one can be cut open ----
  const FV = { r: 1.05, h: 3.6, cone: 1.5, y: 1.4 + 1.5 + 1.8 }, fvX = [5.2, 8.2, 11.2, 14.2], fvZ = -2.6;
  const liquid = phys({ color: "#c8892e", roughness: 0.25, transmission: 0, transparent: true, opacity: 0.92, emissive: "#3a2205", emissiveIntensity: 0.35 });
  const fvs = fvX.map((x, i) => {
    const g = new THREE.Group(), full = new THREE.Mesh(vesselGeo(FV.r, FV.h, FV.cone, 0.25), M.steel); full.position.y = FV.y; g.add(full);
    for (const yy of [0.9, -0.2, -1.2]) { const j = cyl(FV.r + 0.015, FV.r + 0.015, 0.75, i === 0 ? M.jacket : M.jacket, 48, true); j.position.y = FV.y + yy; g.add(j); }
    g.add(legs(FV.r * 0.9, FV.y - FV.h / 2 - 0.2, 4));
    const mw = manway(0.22); mw.position.set(0, FV.y - FV.h / 2 - 0.55, 0.62); mw.rotation.x = -0.6; g.add(mw);
    g.add(pipe([[0, FV.y + FV.h / 2 + 0.25, 0], [0, FV.y + FV.h / 2 + 0.55, 0], [0.9, FV.y + FV.h / 2 + 0.55, 0.9], [0.9, 0.9, 0.9]], 0.03));   // CO2 blow-off arm
    const bucket = cyl(0.16, 0.14, 0.32, phys({ color: "#e8eef2", roughness: 0.3, transmission: 0.6, transparent: true, opacity: 0.6 }), 16); bucket.position.set(0.9, 0.75, 0.9); g.add(bucket);
    g.add(pipe([[0, FV.y - FV.h / 2 - FV.cone, 0], [0, 0.35, 0], [0, 0.35, 1.2]], 0.045));
    const gauge = cyl(0.07, 0.07, 0.03, phys({ color: "#f4f4f0", roughness: 0.3 }), 20); gauge.rotation.x = Math.PI / 2; gauge.position.set(0.35, FV.y - 0.3, FV.r + 0.03); g.add(gauge);
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.2), phys({ color: "#ffffff", roughness: 0.5 })); tag.position.set(-0.3, FV.y - 0.3, FV.r + 0.022); g.add(tag);
    g.position.set(x, 0, fvZ); scene.add(shadow(g)); return { g, full };
  });
  // cutaway version of fermenter 1: back half shell + liquid + foam + sediment + bubbles
  const cut = new THREE.Group(); cut.position.set(fvX[0], 0, fvZ); cut.visible = false; scene.add(cut);
  const half = new THREE.Mesh(vesselGeo(FV.r, FV.h, FV.cone, 0.25, Math.PI, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: "#e4e8ec", metalness: 0.9, roughness: 0.35, envMapIntensity: 2.2, side: THREE.DoubleSide })); half.position.y = FV.y; cut.add(half);
  const lh = FV.h * 0.82, liq = new THREE.Mesh(vesselGeo(FV.r - 0.04, lh, FV.cone - 0.05, 0.02), liquid); liq.position.y = FV.y - (FV.h - lh) / 2; cut.add(liq);
  const foam = cyl(FV.r - 0.05, FV.r - 0.05, 0.3, phys({ color: "#f3ead2", roughness: 1 }), 40); foam.position.y = FV.y - FV.h / 2 + lh + 0.1; cut.add(foam);
  const sed = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.8, 32), phys({ color: "#d9cba8", roughness: 1 })); sed.rotation.x = Math.PI; sed.position.y = FV.y - FV.h / 2 - FV.cone + 0.42; cut.add(sed);
  const NB = low ? 60 : 160, bub = new THREE.InstancedMesh(new THREE.SphereGeometry(0.022, 8, 6), phys({ color: "#ffffff", roughness: 0.1, transparent: true, opacity: 0.75, emissive: "#ffffff", emissiveIntensity: 0.25 }), NB), bs = Array.from({ length: NB }, () => ({ a: rnd() * Math.PI * 2, r: Math.sqrt(rnd()) * (FV.r - 0.15), p: rnd(), s: 0.6 + rnd() * 0.9 })); cut.add(bub);
  const NY = low ? 80 : 220, yst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.014, 6, 5), phys({ color: "#efe2c0", roughness: 0.9 }), NY), ys = Array.from({ length: NY }, () => ({ a: rnd() * Math.PI * 2, r: Math.sqrt(rnd()) * (FV.r - 0.12), y: rnd(), ph: rnd() * 6.28 })); cut.add(yst);
  for (const yy of [0.9, -0.2, -1.2]) { const j = new THREE.Mesh(new THREE.CylinderGeometry(FV.r + 0.015, FV.r + 0.015, 0.75, 32, 1, true, Math.PI / 2, Math.PI), M.jacket); j.position.y = FV.y + yy; cut.add(j); }
  cut.add(legs(FV.r * 0.9, FV.y - FV.h / 2 - 0.2, 4)); shadow(cut);
  const fvLabel = labelSprite("–", 2.0); fvLabel.position.set(fvX[0], FV.y + FV.h / 2 + 1.0, fvZ + 0.6); overlay.add(fvLabel);
  A.fv = new THREE.Vector3(fvX[0], FV.y + 0.4, fvZ + FV.r + 0.05); A.fvTop = new THREE.Vector3(fvX[0] + 0.9, FV.y + FV.h / 2 + 0.6, fvZ + 0.9); A.jacket = new THREE.Vector3(fvX[0] + 0.75, FV.y - 0.2, fvZ + 0.78); A.cone = new THREE.Vector3(fvX[0], FV.y - FV.h / 2 - 0.9, fvZ + 0.5);
  // glycol header and chiller
  scene.add(pipe([[4.0, 7.3, -4.1], [15.6, 7.3, -4.1]], 0.06, M.paint), pipe([[15.6, 7.3, -4.1], [15.6, 7.3, 5.2], [22.5, 7.3, 5.2], [22.5, 1.9, 5.2]], 0.06, M.paint));
  fvX.forEach(x => scene.add(pipe([[x - 0.6, 7.3, -4.1], [x - 0.6, FV.y + 1.2, -3.5]], 0.03, M.paint)));
  const chill = new THREE.Mesh(new RoundedBoxGeometry(2.6, 1.8, 1.5, 4, 0.06), phys({ color: "#e9ecef", metalness: 0.4, roughness: 0.45 })); chill.position.set(22.5, 0.95, 5.2); scene.add(shadow(chill));
  for (const dx of [-0.65, 0.65]) { const f = cyl(0.5, 0.5, 0.08, M.steelDark, 24); f.position.set(22.5 + dx, 1.9, 5.2); scene.add(f); } A.glycol = new THREE.Vector3(22.5, 2.3, 5.2);

  // ---- bright tanks ----
  const btX = [17.6, 20.4]; btX.forEach(x => { const g = new THREE.Group(), s = new THREE.Mesh(vesselGeo(1.0, 2.6, 0, 0.3), M.steel); s.position.y = 2.6; g.add(s); g.add(legs(0.85, 1.0, 4)); const mw = manway(0.22); mw.position.set(0, 2.4, 0.985); g.add(mw); const sg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.6, 0.03), M.glass); sg.position.set(0.5, 2.6, 0.9); g.add(sg); g.position.set(x, 0, -2.6); scene.add(shadow(g)); });
  scene.add(pipe([[fvX[3], 0.35, -1.4], [16.2, 0.35, -1.4], [16.2, 0.35, -2.6], [17.0, 0.9, -2.6]], 0.045)); A.bright = new THREE.Vector3(17.6, 4.4, -2.0);
  const co2 = new THREE.Group(); for (let i = 0; i < 3; i++) { const b = cyl(0.14, 0.14, 1.5, phys({ color: "#5c6770", metalness: 0.7, roughness: 0.4 }), 18); b.position.set(i * 0.34, 0.75, 0); const c = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 10, 0, 6.3, 0, 1.6), b.material); c.position.set(i * 0.34, 1.5, 0); co2.add(b, c); } co2.position.set(22.0, 0, -3.6); scene.add(shadow(co2)); A.co2 = new THREE.Vector3(22.3, 1.9, -3.6);

  // ---- keg line ----
  const conv = new THREE.Mesh(new THREE.BoxGeometry(9, 0.1, 0.7), M.steelDark); conv.position.set(15.5, 0.75, 4.2); scene.add(shadow(conv));
  for (let i = 0; i < 10; i++) { const l = cyl(0.03, 0.03, 0.72, M.steelDark, 8); l.position.set(11.4 + i * 0.92, 0.36, 4.2 + (i % 2 ? 0.3 : -0.3)); scene.add(l); }
  for (let i = 0; i < 22; i++) { const r = cyl(0.035, 0.035, 0.66, M.steel, 10); r.rotation.x = Math.PI / 2; r.position.set(11.2 + i * 0.4, 0.83, 4.2); scene.add(r); }
  const filler = new THREE.Mesh(new RoundedBoxGeometry(1.5, 1.9, 1.2, 4, 0.06), M.steel); filler.position.set(13.2, 1.9, 4.2); scene.add(shadow(filler));
  const win = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), phys({ color: "#101820", emissive: "#2bd4a0", emissiveIntensity: 0.5 })); win.position.set(13.2, 2.2, 4.81); scene.add(win);
  scene.add(pipe([[18.6, 0.9, -1.6], [18.6, 0.35, 0.5], [13.2, 0.35, 3.3], [13.2, 2.9, 3.6]], 0.04));
  const kegGeo = new THREE.LatheGeometry([[0.03, 0], [0.19, 0], [0.2, 0.03], [0.205, 0.15], [0.2, 0.3], [0.205, 0.45], [0.2, 0.57], [0.19, 0.6], [0.03, 0.6]].map(p => new THREE.Vector2(...p)), 24);
  const NK = 40, kegs = new THREE.InstancedMesh(kegGeo, M.keg, NK); kegs.castShadow = true; scene.add(kegs);
  const kegPos = []; for (let i = 0; i < 9; i++) kegPos.push([14.6 + i * 0.52, 0.87, 4.2]); for (let l = 0; l < 2; l++) for (let i = 0; i < 16; i++) kegPos.push([20.9 + (i % 4) * 0.46, 0.14 + l * 0.62, 1.2 + Math.floor(i / 4) * 0.46]);
  const pal2 = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.12, 2.1), M.wood); pal2.position.set(21.6, 0.06, 1.9); scene.add(pal2); A.filler = new THREE.Vector3(13.2, 3.1, 4.2); A.kegs = new THREE.Vector3(21.6, 1.7, 1.9);
  const m4 = new THREE.Matrix4(); const setKegs = n => { for (let i = 0; i < NK; i++) { const p = kegPos[i] || [0, -9, 0]; m4.makeTranslation(...(i < n ? p : [0, -9, 0])); kegs.setMatrixAt(i, m4); } kegs.instanceMatrix.needsUpdate = true; };
  setKegs(0);

  // ---- people ----
  const P1 = person("#2f5d8a", "check", { woman: true, h: 0.95, skin: 2, hair: "#1c1512", style: "bun" }); P1.position.set(-7.6, PY + 0.04, 1.1); P1.rotation.y = Math.PI * 0.95; scene.add(shadow(P1));   // head brewer at the kettle
  const P2 = person("#5b6b4d", "check", { woman: true, h: 0.98, skin: 0, hair: "#6b4a2a", style: "ponytail" }); P2.position.set(6.6, 0, -0.9); P2.rotation.y = Math.PI * 1.25; scene.add(shadow(P2));   // cellar engineer taking a sample at the fermenter
  const P3 = person("#7a4a2c", "stand", { h: 1.03, skin: 1, hair: "#2a2320" }); P3.position.set(15.6, 0, 5.3); P3.rotation.y = Math.PI; scene.add(shadow(P3));   // packaging brewer at the keg line

  // ---- microscope view of yeast (far below the floor) ----
  const MIC = new THREE.Vector3(0, -40, 0), mic = new THREE.Group(); mic.position.copy(MIC); scene.add(mic);
  const field = new THREE.Mesh(new THREE.CircleGeometry(1.0, 64), new THREE.MeshBasicMaterial({ color: "#f3efdf" })); field.rotation.x = -Math.PI / 2; mic.add(field);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.0, 6, 64), new THREE.MeshBasicMaterial({ color: "#0c0d0f" })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; mic.add(ring);
  const cellM = phys({ color: "#e9d9a8", roughness: 0.35, transmission: 0.35, thickness: 0.05, transparent: true, opacity: 0.9, clearcoat: 0.6 });
  const NC = 150, cells = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 18, 14), cellM, NC * 2), cs = Array.from({ length: NC }, () => ({ x: (rnd() * 2 - 1) * 0.92, z: (rnd() * 2 - 1) * 0.92, a: rnd() * 6.28, bud: rnd(), dx: (rnd() - 0.5) * 0.02, dz: (rnd() - 0.5) * 0.02, s: 0.8 + rnd() * 0.5 })).filter(c => c.x * c.x + c.z * c.z < 0.8); mic.add(cells);
  const micLabel = labelSprite("yeast cells, 5–8 µm", 1.0); micLabel.position.set(MIC.x, MIC.y + 0.1, MIC.z + 0.82); overlay.add(micLabel);
  const micLight = new THREE.PointLight("#fff7e6", 6, 6); micLight.position.set(0, 1.4, 0.4); mic.add(micLight);
  A.yeast = new THREE.Vector3(MIC.x, MIC.y + 0.05, MIC.z);

  const VIEWS = {
    ferment:  { p: [9.4, 4.3, 9.6], c: [7.4, 3.9, -2.4], fov: 42 },
    brewhouse:{ p: [-6.5, 4.6, 10.5], c: [-7.6, 2.6, -0.4], fov: 42 },
    kettle:   { p: [-3.2, 3.3, 4.2], c: [-5.9, 2.9, -0.4], fov: 44 },
    cooler:   { p: [2.6, 1.9, 5.6], c: [1.0, 0.95, 2.6], fov: 40 },
    cellar:   { p: [15.2, 4.4, 9.5], c: [10.6, 3.2, -2.4], fov: 44 },
    packaging:{ p: [17.2, 3.0, 10.2], c: [16.6, 1.2, 3.6], fov: 42 },
    yeast:    { p: [MIC.x, MIC.y + 2.35, MIC.z + 0.01], c: [MIC.x, MIC.y, MIC.z], fov: 48 },
    overview: { p: [3.4, 15.5, 39.5], c: [3.4, 3.4, 0], fov: 40 },
  };

  const dummy = new THREE.Object3D(), amber = new THREE.Color(), hazeC = new THREE.Color("#e7d9a6"), LAMPS = { mash: "mashLamp", lauter: "lauterLamp", heat: "kettleLamp", boil: "kettleLamp", whirlpool: "whirlLamp" };
  const SRM = srm => amber.set(srm <= 4 ? "#e9b83c" : srm <= 9 ? "#d48a25" : "#a5541b");
  let cutOn = false;
  function setCutaway(on) { cutOn = on; cut.visible = on; fvs[0].g.visible = !on; }
  function update(V, dt, t) {
    // status lamps
    for (const k of ["mashLamp", "lauterLamp", "kettleLamp", "whirlLamp"]) A[k].emissiveIntensity = LAMPS[V.stage] === k ? 2.2 + Math.sin(t * 5) * 0.5 : 0;
    // steam: kettle while heating/boiling, a little from the mash tun
    const boil = V.stage === "boil" ? 1 : V.stage === "heat" ? 0.35 * V.frac : V.stage === "whirlpool" ? 0.25 : 0, mst = V.stage === "mash" ? 0.3 : 0, on = Math.max(boil, mst);
    steam.material.opacity += ((on > 0 ? 0.16 + 0.2 * on : 0) - steam.material.opacity) * Math.min(1, dt * 2);
    const src = boil >= mst ? A.steam : A.mash, pa = steamGeo.attributes.position.array;
    for (let i = 0; i < steamN; i++) { sph[i] = (sph[i] + dt * (0.12 + 0.1 * (i % 5) / 5)) % 1; const p = sph[i]; pa[i * 3] = src.x + Math.sin(i * 12.9 + t * 0.3) * (0.15 + p * 1.1); pa[i * 3 + 1] = src.y + p * 3.2; pa[i * 3 + 2] = src.z + Math.cos(i * 7.3 + t * 0.25) * (0.15 + p * 1.1); }
    steamGeo.attributes.position.needsUpdate = true;
    // fermenter contents
    const act = V.co2Rate || 0, inTank = V.part === "cellar";
    SRM(V.srm); liquid.color.copy(amber).lerp(hazeC, inTank ? 0.35 * (V.yeast ?? 0) : 0); liquid.opacity = inTank ? 0.93 : 0.25;
    foam.visible = inTank && act > 0.03; foam.scale.y = 0.3 + 1.6 * act; foam.position.y = FV.y - FV.h / 2 + lh + 0.15 * foam.scale.y;
    sed.visible = inTank; sed.scale.setScalar(0.25 + 0.75 * (V.settled ?? 0));
    M.jacket.emissiveIntensity = inTank ? 0.9 * (V.valve || 0) : 0;
    const y0 = FV.y - FV.h / 2 - FV.cone * 0.6, yTop = FV.y - FV.h / 2 + lh, nShow = Math.round(NB * Math.min(1, act * 1.2));
    for (let i = 0; i < NB; i++) { const b = bs[i]; b.p = (b.p + dt * b.s * (0.12 + 0.5 * act)) % 1; const yy = y0 + b.p * (yTop - y0), rr = Math.min(b.r, (FV.r - 0.15) * Math.min(1, 0.25 + (yy - y0) / FV.cone)); dummy.position.set(Math.cos(b.a) * rr, i < nShow && inTank ? yy : -9, Math.sin(b.a) * rr); dummy.scale.setScalar(0.6 + b.p * 0.9); dummy.updateMatrix(); bub.setMatrixAt(i, dummy.matrix); }
    bub.instanceMatrix.needsUpdate = true;
    const susp = inTank ? (V.yeast ?? 0) : 0, nY = Math.round(NY * susp);
    for (let i = 0; i < NY; i++) { const c = ys[i], yy = y0 + c.y * (yTop - y0) + Math.sin(t * 0.6 + c.ph) * 0.05, rr = Math.min(c.r, (FV.r - 0.12) * Math.min(1, 0.25 + (yy - y0) / FV.cone)); dummy.position.set(Math.cos(c.a + t * 0.05 * act) * rr, i < nY ? yy : -9, Math.sin(c.a + t * 0.05 * act) * rr); dummy.scale.setScalar(1); dummy.updateMatrix(); yst.setMatrixAt(i, dummy.matrix); }
    yst.instanceMatrix.needsUpdate = true;
    fvLabel.visible = inTank; if (inTank) fvLabel.userData.set(V.label || "");
    setKegs(Math.round(NK * (V.kegs || 0)));
    // microscope: more cells as the yeast grows; buds while it is active
    const nC = Math.round(cs.length * (0.35 + 0.65 * (V.yeastPop ?? 0.5)));
    cs.forEach((c, i) => { c.x += c.dx * dt * (0.4 + act); c.z += c.dz * dt * (0.4 + act); if (c.x * c.x + c.z * c.z > 0.85) { c.dx *= -1; c.dz *= -1; }
      dummy.position.set(c.x, i < nC ? 0.05 : -9, c.z); dummy.scale.set(c.s * 1.25, c.s * 0.8, c.s); dummy.rotation.set(0, c.a, 0); dummy.updateMatrix(); cells.setMatrixAt(i * 2, dummy.matrix);
      const bud = c.bud < 0.55 * (0.2 + act) && i < nC; dummy.position.set(c.x + Math.cos(c.a) * 0.06 * c.s, bud ? 0.05 : -9, c.z - Math.sin(c.a) * 0.06 * c.s); dummy.scale.setScalar(c.s * 0.55); dummy.updateMatrix(); cells.setMatrixAt(i * 2 + 1, dummy.matrix); });
    cells.count = cs.length * 2; cells.instanceMatrix.needsUpdate = true;
  }
  return { A, VIEWS, update, setCutaway, isCut: () => cutOn, FV, fvX, fvZ };
}
