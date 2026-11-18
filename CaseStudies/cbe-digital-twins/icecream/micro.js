// Microstructure viewer: a slab of ice cream (or a cube of mix) at micrometre scale. Particle sizes and volume
// fractions come from the process model; particles are packed by overlap relaxation.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

// seeded RNG so a stage looks the same each time it is opened with the same settings
function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
function lognorm(r, mean, cv) { const s2 = Math.log(1 + cv * cv), mu = Math.log(mean) - s2 / 2; let u = 0, v = 0; while (!u) u = r(); v = r(); return Math.exp(mu + Math.sqrt(s2) * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)); }

// pack spheres in a box [0,Lx]×[0,Ly]×[0,Lz] (µm); allow a small overlap fraction ov
function pack(items, L, r, iters = 80, ov = 0.12) {
  for (const p of items) { p.x = r() * L[0]; p.y = r() * L[1]; p.z = p.rad + r() * Math.max(0, L[2] - 2 * p.rad); }
  const n = items.length;
  for (let it = 0; it < iters; it++) {
    let moved = 0;
    for (let i = 0; i < n; i++) { const a = items[i];
      for (let j = i + 1; j < n; j++) { const b = items[j];
        let dx = b.x - a.x, dy = b.y - a.y; const dz = b.z - a.z;
        if (dx > L[0] / 2) dx -= L[0]; else if (dx < -L[0] / 2) dx += L[0];
        if (dy > L[1] / 2) dy -= L[1]; else if (dy < -L[1] / 2) dy += L[1];
        const d2 = dx * dx + dy * dy + dz * dz, rr = (a.rad + b.rad) * (1 - ov);
        if (d2 < rr * rr && d2 > 1e-9) { const d = Math.sqrt(d2), push = (rr - d) / d * 0.5; a.x -= dx * push; a.y -= dy * push; a.z -= dz * push; b.x += dx * push; b.y += dy * push; b.z += dz * push; moved++; }
      } }
    for (const p of items) { p.x = (p.x + L[0]) % L[0]; p.y = (p.y + L[1]) % L[1]; p.z = Math.min(L[2] - p.rad * 0.3, Math.max(p.rad * 0.3, p.z)); }
    if (!moved) break;
  }
  return items;
}

export class MicroViewer {
  constructor(host) {
    this.host = host; this.canvas = host.querySelector("canvas"); this.info = host.querySelector(".minfo");
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color("#ffffff");
    this.scene.environment = new THREE.PMREMGenerator(this.renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    const key = new THREE.DirectionalLight("#fff6e8", 1.4); key.position.set(1, 2, 1.5); this.scene.add(key, new THREE.HemisphereLight("#ffffff", "#8a8070", 0.8));
    this.buildContainer(); this.mode = "micro"; this.journey = null; this.fade = host.querySelector(".mfade"); this.scaleEl = host.querySelector(".mscale");
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 5000);
    this.controls = new OrbitControls(this.camera, this.canvas); this.controls.enableDamping = true; this.controls.autoRotateSpeed = 0.5;
    this.group = new THREE.Group(); this.scene.add(this.group);
    this.open = false; this.stage = "draw"; this.key = "";
    new ResizeObserver(() => this.resize()).observe(host);
  }
  resize() { const r = this.host.getBoundingClientRect(); if (!r.width) return; this.renderer.setSize(r.width, r.height, false); this.camera.aspect = r.width / r.height; this.camera.updateProjectionMatrix(); }
  clear() { for (const o of [...this.group.children]) { this.group.remove(o); o.traverse(m => { m.geometry?.dispose?.(); m.material?.dispose?.(); }); } }

  // R = computeAll result
  build(R, stage = this.stage) {
    this.stage = stage; this.setFlavour?.((R.p.cocoa || 0) > 0);
    const key = stage + JSON.stringify(R.p);
    if (key === this.key) return; this.key = key;
    this.clear();
    const r = rng(1234 + Math.round(R.p.overrun * 7 + R.p.Phom * 13 + R.p.fat * 31 + R.p.Tdraw * 97));
    if (stage === "mix") return this.buildMix(R, r);
    const q = R.q, c = R.c, OR = R.p.overrun / 100;
    const T = { draw: R.fz.Tdraw, hard: -18, store: R.p.Tstore }[stage];
    const Lice = { draw: R.fz.Lice, hard: q.Lhard, store: q.Lstore }[stage];
    const Dair = { draw: q.Dair, hard: q.Dhard, store: q.Dstore }[stage];
    const I = R.ft.ice(T);
    // volume fractions per unit volume of ice cream
    const phiA = OR / (1 + OR), vMix = 1 - phiA;                  // mix (incl. its ice) occupies 1 − φa
    const iceVolPerMixVol = (I / 0.917) * (c.rho / 1000);
    const phiI = vMix * iceVolPerMixVol, phiF = vMix * c.phiFat, phiS = Math.max(0, 1 - phiA - phiI - phiF);
    const L = [300, 300, 90], V = L[0] * L[1] * L[2];
    const items = [];
    const addPop = (kind, phi, mean, cv) => { let vol = 0; const target = phi * V; while (vol < target && items.length < 900) { const d = Math.max(4, lognorm(r, mean, cv)); items.push({ kind, rad: d / 2 }); vol += Math.PI / 6 * d ** 3; } };
    addPop("air", phiA, Dair, 0.45); addPop("ice", phiI, Lice, 0.4);
    pack(items, L, r, 90, 0.15);
    const g = this.group; g.position.set(-L[0] / 2, -L[2] / 2, -L[1] / 2);
    // serum: translucent amber slab (freeze-concentrated sugar syrup)
    const serumM = new THREE.MeshPhysicalMaterial({ color: "#d8b46a", roughness: 0.25, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
    const serum = new THREE.Mesh(new THREE.BoxGeometry(L[0], L[2], L[1]), serumM); serum.position.set(L[0] / 2, L[2] / 2, L[1] / 2); g.add(serum);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(serum.geometry), new THREE.LineBasicMaterial({ color: "#b89a5a" })); edges.position.copy(serum.position); g.add(edges);
    // ice: rounded irregular crystals
    const iceGeo = new THREE.SphereGeometry(1, 24, 16); { const p = iceGeo.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const s = 1 + 0.16 * Math.sin(v.x * 3.1 + 0.5) * Math.cos(v.y * 2.7 + v.z * 2.2); p.setXYZ(i, v.x * s, v.y * s * 0.85, v.z * s); } iceGeo.computeVertexNormals(); }
    const iceM = new THREE.MeshPhysicalMaterial({ color: "#bfe2fb", roughness: 0.08, metalness: 0, transmission: 0, transparent: true, opacity: 0.88, clearcoat: 1, clearcoatRoughness: 0.1, flatShading: false });
    const airGeo = new THREE.SphereGeometry(1, 28, 18);
    const airM = new THREE.MeshPhysicalMaterial({ color: "#9fb0bf", roughness: 0.05, metalness: 0, transparent: true, opacity: 0.3, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false });
    const ices = items.filter(i => i.kind === "ice"), airs = items.filter(i => i.kind === "air");
    const mI = new THREE.InstancedMesh(iceGeo, iceM, ices.length), mA = new THREE.InstancedMesh(airGeo, airM, airs.length);
    const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), S = new THREE.Vector3(), P = new THREE.Vector3();
    ices.forEach((p, k) => { E.set(r() * 6, r() * 6, r() * 6); Q.setFromEuler(E); S.set(p.rad, p.rad * (0.8 + 0.3 * r()), p.rad); P.set(p.x, p.z, p.y); M4.compose(P, Q, S); mI.setMatrixAt(k, M4); });
    airs.forEach((p, k) => { Q.identity(); S.setScalar(p.rad); P.set(p.x, p.z, p.y); M4.compose(P, Q, S); mA.setMatrixAt(k, M4); });
    mA.renderOrder = 2; g.add(mI, mA);
    // fat: partly coalesced fat clusters on the air-cell surfaces (drawn ×3 size, ~1/50 of the real number)
    const nPer = Math.round(4 + 40 * q.PC / 40), fatPts = [];
    for (const a of airs) for (let k = 0; k < nPer; k++) { const u = r() * 2 - 1, th = r() * Math.PI * 2, s = Math.sqrt(1 - u * u); fatPts.push([a.x + a.rad * s * Math.cos(th), a.z + a.rad * u, a.y + a.rad * s * Math.sin(th)]); }
    const free = Math.round(250 * (1 - q.PC / 75)); for (let k = 0; k < free; k++) fatPts.push([r() * L[0], r() * L[2], r() * L[1]]);
    const fatM = new THREE.MeshStandardMaterial({ color: "#f2c84b", roughness: 0.4 }), fatG = new THREE.SphereGeometry(1, 10, 8);
    const mF = new THREE.InstancedMesh(fatG, fatM, fatPts.length);
    fatPts.forEach((p, k) => { Q.identity(); S.setScalar(1.6 * (0.7 + r() * 0.6)); P.set(...p); M4.compose(P, Q, S); mF.setMatrixAt(k, M4); });
    g.add(mF);
    this.scaleBar(L[0], 100);
    this.fitCam(L);
    const pct = v => (v * 100).toFixed(0) + " %";
    this.info.innerHTML = `<b>${{ draw: "At the draw", hard: "Hardened, core −18 °C", store: `After 4 weeks at ${R.p.Tstore.toFixed(0)} °C` }[stage]}</b> · slab 300 × 300 × 90 µm · ${T.toFixed(1)} °C<br>
      <span class="sw air"></span>air ${pct(phiA)} · ${Dair.toFixed(0)} µm &nbsp;<span class="sw ice"></span>ice ${pct(phiI)} · ${Lice.toFixed(0)} µm &nbsp;<span class="sw fat"></span>fat ${pct(phiF)} · ${R.q.PC.toFixed(0)} % destabilised &nbsp;<span class="sw ser"></span>serum ${pct(phiS)}<br>
      <small>Sizes and volume fractions are from the model; air cells and crystals are drawn as rounded shapes with up to 15 % overlap (real cells deform against each other). Fat clusters are drawn ×3 size at about 1/50 of their number.</small>`;
  }
  buildMix(R, r) {
    const h = R.hom, c = R.c, L = [10, 10, 10], V = 1000, g = this.group; g.position.set(-5, -5, -5);
    const items = []; let vol = 0; const target = c.phiFat * V;
    while (vol < target && items.length < 2500) { const d = Math.max(0.12, lognorm(r, h.d32 * 0.75, 0.55)); items.push({ kind: "fat", rad: d / 2 }); vol += Math.PI / 6 * d ** 3; }
    pack(items, L, r, 40, 0.0);
    const serum = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshPhysicalMaterial({ color: "#efe6cf", roughness: 0.3, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide }));
    serum.position.set(5, 5, 5); g.add(serum);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(serum.geometry), new THREE.LineBasicMaterial({ color: "#b89a5a" })); edges.position.copy(serum.position); g.add(edges);
    const m = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshPhysicalMaterial({ color: "#f5d77a", roughness: 0.3, clearcoat: 0.6 }), items.length);
    const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3();
    items.forEach((p, k) => { S.setScalar(p.rad); P.set(p.x, p.z, p.y); M4.compose(P, Q, S); m.setMatrixAt(k, M4); });
    g.add(m);
    // casein micelles (~0.15 µm) as fine points
    const nC = 1800, pos = new Float32Array(nC * 3); for (let i = 0; i < nC * 3; i++) pos[i] = r() * 10;
    const pg = new THREE.BufferGeometry(); pg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.add(new THREE.Points(pg, new THREE.PointsMaterial({ color: "#8a8f96", size: 0.12, sizeAttenuation: true, transparent: true, opacity: 0.7 })));
    this.scaleBar(10, 2);
    this.fitCam(L);
    this.info.innerHTML = `<b>Aged mix, before freezing</b> · cube 10 µm · 4 °C<br><span class="sw fat"></span>fat globules d₃₂ ${h.d32.toFixed(2)} µm, ${(c.phiFat * 100).toFixed(1)} % by volume, ${(h.nPerL / 1e15).toFixed(1)}×10¹⁵ per litre · solid fat ${(R.age.sfc * 100).toFixed(0)} % &nbsp;<span class="sw cas"></span>casein micelles ≈ 0.15 µm<br>
      <small>Globule sizes are sampled from a log-normal distribution with the homogeniser's d₃₂; numbers and volume fraction are true to scale. Raise the homogeniser pressure to watch the globules shrink.</small>`;
  }
  scaleBar(Lx, len) {
    const g = new THREE.Group(); const m = new THREE.MeshBasicMaterial({ color: "#1f1f1f" });
    const b = new THREE.Mesh(new THREE.BoxGeometry(len, Lx * 0.006, Lx * 0.006), m); b.position.set(len / 2, -Lx * 0.03, -Lx * 0.03); g.add(b);
    for (const x of [0, len]) { const t = new THREE.Mesh(new THREE.BoxGeometry(Lx * 0.004, Lx * 0.03, Lx * 0.004), m); t.position.set(x, -Lx * 0.03, -Lx * 0.03); g.add(t); }
    const c = document.createElement("canvas"); c.width = 256; c.height = 64; const x = c.getContext("2d"); x.fillStyle = "#1f1f1f"; x.font = "600 40px 'IBM Plex Mono', monospace"; x.textAlign = "center"; x.fillText(`${len} µm`, 128, 46);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false })); sp.scale.set(Lx * 0.16, Lx * 0.04, 1); sp.position.set(len / 2, -Lx * 0.08, -Lx * 0.03); g.add(sp);
    this.group.add(g);
  }
  fitCam(L) {
    const d = Math.max(...L) * Math.max(2.0, 2.4 / Math.max(0.5, this.camera.aspect));
    this.camera.position.set(d * 0.55, d * 0.6, d * 0.75); this.controls.target.set(0, 0, 0); this.camera.near = d / 500; this.camera.far = d * 40; this.camera.updateProjectionMatrix();
    this.fitD = d; this.microDir = this.camera.position.clone().normalize();
  }

  // ---------- the pint, as people see it (metres) ----------
  buildContainer() {
    const sc = new THREE.Scene(); sc.background = new THREE.Color("#ffffff"); this.cscene = sc;
    sc.environment = this.scene.environment;
    const sun = new THREE.DirectionalLight("#fff6ea", 2.0); sun.position.set(0.4, 0.9, 0.5); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -0.3, right: 0.3, top: 0.3, bottom: -0.3, near: 0.05, far: 3 }); sc.add(sun, new THREE.HemisphereLight("#ffffff", "#c9c2b8", 0.9));
    this.renderer.shadowMap.enabled = true;
    const table = new THREE.Mesh(new THREE.CircleGeometry(1.2, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: "#f3f1ee", roughness: 0.9 })); table.receiveShadow = true; sc.add(table);
    // red paper pint (90 mm top, 85 mm tall) with white bands; generic label, no logo
    const lab = document.createElement("canvas"); lab.width = 1024; lab.height = 256; const x = lab.getContext("2d");
    x.fillStyle = "#c5050c"; x.fillRect(0, 0, 1024, 256); x.fillStyle = "#ffffff"; x.fillRect(0, 0, 1024, 22); x.fillRect(0, 234, 1024, 22);
    const lt = new THREE.CanvasTexture(lab); lt.colorSpace = THREE.SRGBColorSpace;
    const drawLabel = name => {   // flavour name follows the recipe (Chocolate when cocoa > 0)
      x.fillStyle = "#c5050c"; x.fillRect(0, 0, 1024, 256); x.fillStyle = "#ffffff"; x.fillRect(0, 0, 1024, 22); x.fillRect(0, 234, 1024, 22);
      x.font = `italic 700 ${name.length > 8 ? 76 : 92}px 'STIX Two Text', Georgia, serif`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(name, 256, 118); x.fillText(name, 768, 118);
      x.font = "600 26px 'Saira Semi Condensed', Arial, sans-serif"; x.fillText("ICE CREAM · 1 PINT (473 mL)", 256, 196); x.fillText("ICE CREAM · 1 PINT (473 mL)", 768, 196);
      lt.needsUpdate = true; };
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.039, 0.085, 64, 1, true), new THREE.MeshStandardMaterial({ map: lt, roughness: 0.55, side: THREE.DoubleSide }));
    cup.position.y = 0.0425; cup.castShadow = true; sc.add(cup);
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.039, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: "#c5050c" })); bottom.position.y = 0.001; sc.add(bottom);
    // ice cream: domed, scooped surface with fine texture (displaced); vanilla-bean flecks, or chocolate flakes + fudge swirl
    const wr = rng(11), WAVES = []; for (let k = 0; k < 14; k++) { const f = 120 + 900 * wr() ** 1.5, th = wr() * 6.283; WAVES.push([f * Math.cos(th), f * Math.sin(th), wr() * 6.283, 0.0016 * Math.pow(120 / f, 0.9)]); }
    const ic = new THREE.SphereGeometry(0.0445, 192, 96, 0, Math.PI * 2, 0, Math.PI / 2); ic.scale(1, 0.32, 1);
    { const p = ic.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const r = Math.hypot(v.x, v.z);
        let n = 0; for (const [fx, fz, ph, a] of WAVES) n += a * Math.sin(v.x * fx + v.z * fz + ph);
        const scoop = -0.007 * Math.exp(-((v.x - 0.012) ** 2 + (v.z + 0.008) ** 2) / 0.00028);
        p.setY(i, v.y + (r < 0.043 ? n + scoop : 0)); } ic.computeVertexNormals(); }
    const grain = document.createElement("canvas"); grain.width = grain.height = 256; { const gx = grain.getContext("2d"), im = gx.createImageData(256, 256); for (let i = 0; i < im.data.length; i += 4) { const v = 110 + Math.random() * 145; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; } gx.putImageData(im, 0, 0); }
    const gt = new THREE.CanvasTexture(grain); gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(60, 60);
    const icm = new THREE.Mesh(ic, new THREE.MeshStandardMaterial({ color: "#f4e7c6", roughness: 0.72, bumpMap: gt, bumpScale: 0.00025 })); icm.position.y = 0.081; icm.castShadow = icm.receiveShadow = true; sc.add(icm); this.icSurf = icm;
    const fl = [], r = rng(7); for (let i = 0; i < 260; i++) { const a = r() * 6.283, rr = Math.sqrt(r()) * 0.04, y = 0.081 + 0.0445 * 0.32 * Math.sqrt(Math.max(0, 1 - (rr / 0.0445) ** 2)); fl.push(Math.cos(a) * rr, y + 0.0005, Math.sin(a) * rr); }
    const fg = new THREE.BufferGeometry(); fg.setAttribute("position", new THREE.Float32BufferAttribute(fl, 3)); const flM = new THREE.PointsMaterial({ color: "#3a2a1c", size: 0.0007, sizeAttenuation: true }); sc.add(new THREE.Points(fg, flM));
    // fudge swirl: dark ribbons lying in the surface (shown for the chocolate recipe)
    const swirl = new THREE.Group(), swM = new THREE.MeshStandardMaterial({ color: "#2b1810", roughness: 0.35 }); sc.add(swirl);
    const yS = rr => 0.081 + 0.0445 * 0.32 * Math.sqrt(Math.max(0, 1 - (rr / 0.0445) ** 2));
    for (let k = 0; k < 3; k++) { const pts = []; for (let t = 0; t <= 1; t += 0.02) { const a = k * 2.1 + t * 4.2, rr = 0.006 + 0.032 * t; pts.push(new THREE.Vector3(Math.cos(a) * rr, yS(rr) + 0.0002 + 0.0006 * Math.sin(t * 19 + k), Math.sin(a) * rr)); }
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.0014, 8, false), swM); swirl.add(tube); }
    this.setFlavour = choc => { if (this._choc === choc) return; this._choc = choc; drawLabel(choc ? "Chocolate" : "Vanilla");
      icm.material.color.set(choc ? "#5b3a26" : "#f4e7c6"); flM.color.set(choc ? "#1a0f08" : "#3a2a1c"); flM.size = choc ? 0.0016 : 0.0007; swirl.visible = choc; };
    this.setFlavour(true);
    // lid leaning on the pint, and a spoon
    const lid = new THREE.Group(); lid.position.set(-0.085, 0.0125, 0.04); sc.add(lid);
    const lidTop = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.047, 0.004, 48), new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.5 })); lidTop.castShadow = true; lid.add(lidTop);
    const lidRim = new THREE.Mesh(new THREE.CylinderGeometry(0.0475, 0.0475, 0.012, 48, 1, true), new THREE.MeshStandardMaterial({ color: "#c5050c", side: THREE.DoubleSide })); lidRim.position.y = -0.006; lid.add(lidRim); lidTop.position.y = 0;
    const spoon = new THREE.Group(); spoon.position.set(0.06, 0.003, 0.07); spoon.rotation.y = -0.9; sc.add(spoon);
    const sm = new THREE.MeshStandardMaterial({ color: "#d9dde0", metalness: 0.95, roughness: 0.2 });
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.014, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), sm); bowl.scale.set(1, 0.35, 0.7); bowl.position.y = 0.005; spoon.add(bowl);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.002, 0.008), sm); handle.position.set(0.065, 0.004, 0); spoon.add(handle);
    this.ccam = new THREE.PerspectiveCamera(35, 1, 0.0002, 10);
    this.cTarget = new THREE.Vector3(0.012, 0.081 + 0.0445 * 0.32 - 0.006, -0.008);      // a spot in the scoop
    this.cDir = new THREE.Vector3(0.45, 0.62, 0.75).normalize();
  }
  // ---------- powers-of-ten journey: pint → microstructure → (later) back out to the plant ----------
  startJourney(R, onPlant) { this.mode = "container"; this.journey = { phase: "hold", t: 0, R, onPlant }; this.controls.enabled = false; this.key = ""; this.build(R, this.stage === "mix" ? "draw" : this.stage); }
  zoomOut(onPlant) { this.journey = { phase: "microOut", t: 0, onPlant: onPlant ?? this.journey?.onPlant }; this.controls.enabled = false; }
  stepJourney(dt) {
    const J = this.journey; if (!J) return; J.t += dt;
    const ease = u => u * u * (3 - 2 * u), lerpLog = (a, b, u) => a * Math.pow(b / a, u);
    const setC = d => { this.ccam.position.copy(this.cTarget).addScaledVector(this.cDir, d); this.ccam.lookAt(this.cTarget); this.ccam.near = d / 50; this.ccam.far = d * 60 + 2; this.ccam.updateProjectionMatrix(); this.fieldM = 2 * d * Math.tan(17.5 * Math.PI / 180); };
    const setM = d => { this.camera.position.copy(this.microDir).multiplyScalar(d); this.controls.target.set(0, 0, 0); this.camera.lookAt(0, 0, 0); this.camera.near = d / 500; this.camera.far = d * 40; this.camera.updateProjectionMatrix(); this.fieldM = 2 * d * Math.tan(17.5 * Math.PI / 180) * 1e-6; };
    let fade = 0;
    if (J.phase === "hold") { this.mode = "container"; this.cDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), dt * 0.15); setC(0.34); if (J.t > 2.5) { J.phase = "zoomIn"; J.t = 0; } }
    else if (J.phase === "zoomIn") { const u = Math.min(1, J.t / 4.5); setC(lerpLog(0.34, 0.0015, ease(u))); fade = Math.max(0, (u - 0.8) / 0.2); if (u >= 1) { J.phase = "microIn"; J.t = 0; this.mode = "micro"; } }
    else if (J.phase === "microIn") { const u = Math.min(1, J.t / 3); setM(lerpLog(this.fitD * 6, this.fitD, ease(u))); fade = Math.max(0, 1 - u / 0.25); if (u >= 1) { this.journey = null; this.controls.enabled = true; } }
    else if (J.phase === "microOut") { this.mode = "micro"; const u = Math.min(1, J.t / 2); setM(lerpLog(this.fitD, this.fitD * 6, ease(u))); fade = Math.max(0, (u - 0.75) / 0.25); if (u >= 1) { J.phase = "out"; J.t = 0; this.mode = "container"; } }
    else if (J.phase === "out") { const u = Math.min(1, J.t / 3.5); setC(lerpLog(0.0015, 0.5, ease(u))); fade = Math.max(0, 1 - u / 0.2); if (u >= 1) { this.journey = null; this.controls.enabled = true; J.onPlant?.(); } }
    if (this.fade) this.fade.style.opacity = fade;
  }
  fieldText() { const f = this.fieldM ?? 0; return f >= 0.01 ? `${(f * 100).toFixed(f >= 0.1 ? 0 : 1)} cm` : f >= 1e-3 ? `${(f * 1000).toFixed(1)} mm` : `${(f * 1e6).toFixed(0)} µm`; }
  render(dt) {
    if (!this.open) return;
    this.stepJourney(dt);
    if (this.scaleEl) this.scaleEl.textContent = this.mode === "container" ? `Field of view ≈ ${this.fieldText()}` : `Field of view ≈ ${this.journey ? this.fieldText() : Math.round(2 * this.camera.position.length() * Math.tan(17.5 * Math.PI / 180)) + " µm"}`;
    if (this.info) this.info.style.visibility = this.mode === "container" ? "hidden" : "visible";
    if (this.mode === "container") { this.ccam.aspect = this.camera.aspect; this.ccam.updateProjectionMatrix(); this.renderer.render(this.cscene, this.ccam); return; }
    if (!this.journey) this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
