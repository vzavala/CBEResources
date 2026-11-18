// 3D campus built from public geometry, in metres (x east, z south, y up), origin at Bascom Hall.
// Sources (see campus_data.js): building footprints and names from the official UW–Madison campus map (map.wisc.edu);
// floor counts where tagged, other buildings, Lakes Mendota, Monona and Wingra, streets and the Lakeshore Path from
// OpenStreetMap (© OpenStreetMap contributors, ODbL). Terrain relief, plant stacks and towers, utility routes and every
// scenario asset (solar farm, heat-pump plant, borefield, tanks, batteries, capture, electrolysers, reactor) are
// stylised or assumed and labelled as such.
import * as THREE from "three";
import { DATA } from "./campus_data.js";
import { facadeMaterial, surfaceMaps, MAT, rbox, stack, coolingCell, pipeRack, transformer, railRect, railRing, ladder, flanges, trees, personGeometry, carGeometry } from "./realism.js";

export const CARDINAL = "#c5050c";
const PL = DATA.places;
const at = (name, fx, fz) => PL[name] ? [PL[name][0], PL[name][1]] : [fx, fz];
export const SITES = {
  bascom: at("Bascom Hall", 0, 0), union: at("Memorial Union", 360, -119), library: at("Library Mall", 520, 30), eng: at("Engineering Hall", -487, 395),
  stadium: at("Camp Randall Stadium", -678, 587), hospital: at("University Hospital", -2246, -114),
  charter: at("Charter Street Heating and Cooling Plant", -56, 558), walnut: at("Walnut Street Heating and Cooling Plant", -1623, 111),
  wccf: at("West Campus Cogeneration Facility", -1601, 31), fields: at("Bruce Family Recreation Fields", -1610, -270),
  capitol: at("Wisconsin State Capitol", 1640, 72), picnic: at("Picnic Point", -1580, -1255),
};
const R = (s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; })(1848);
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.02, ...o });
function add(parent, geo, m, x = 0, y = 0, z = 0, shadow = true) { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = shadow; o.receiveShadow = true; parent.add(o); return o; }
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (r, h, s = 24, r2 = r) => new THREE.CylinderGeometry(r2, r, h, s);

// ---------- water mask: lakes rasterised once from the OpenStreetMap outlines ----------
const MASK = { x0: -9000, z0: -9000, size: 18000, n: 2048 };
const maskData = (() => {
  const c = document.createElement("canvas"); c.width = c.height = MASK.n; const g = c.getContext("2d"), k = MASK.n / MASK.size;
  g.fillStyle = "#000"; g.fillRect(0, 0, MASK.n, MASK.n); g.fillStyle = "#fff";
  for (const L of DATA.lakes) { const r = L.r; g.beginPath(); for (let i = 0; i < r.length; i += 2) { const x = (r[i] - MASK.x0) * k, y = (r[i + 1] - MASK.z0) * k; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); g.fill("evenodd"); }
  const d = g.getImageData(0, 0, MASK.n, MASK.n).data, out = new Uint8Array(MASK.n * MASK.n); for (let i = 0; i < out.length; i++) out[i] = d[i * 4] > 127 ? 1 : 0; return out;
})();
export function isLand(x, z) { const k = MASK.n / MASK.size, i = Math.floor((x - MASK.x0) * k), j = Math.floor((z - MASK.z0) * k); if (i < 0 || j < 0 || i >= MASK.n || j >= MASK.n) return true; return !maskData[j * MASK.n + i]; }
// terrain: the Bascom Hill drumlin and Observatory Hill as smooth bumps (stylised relief, not surveyed)
export function hgt(x, z) {
  if (!isLand(x, z)) return -4;
  return 2 + 24 * Math.exp(-(((x + 60) / 240) ** 2) - ((z + 10) / 170) ** 2) + 16 * Math.exp(-(((x + 380) / 210) ** 2) - ((z + 120) / 140) ** 2) + 3 * Math.sin(x / 520) * Math.cos(z / 410);
}

// ---------- extrusion of footprint polygons into one merged mesh ----------
function extrudeInto(acc, ring, y0, h, wall, roof, seed = Math.random()) {
  // ring: [[x,z],...] (any winding). Walls + flat roof; vertex colours.
  let a = 0; for (let i = 0; i < ring.length; i++) { const [x0, z0] = ring[i], [x1, z1] = ring[(i + 1) % ring.length]; a += x0 * z1 - x1 * z0; }
  const pts = a > 0 ? ring : ring.slice().reverse();     // counter-clockwise in (x, z)
  const y1 = y0 + h, P = acc.p, N = acc.n, C = acc.c, F = acc.f; let run = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[(i + 1) % pts.length], dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz) || 1, nx = dz / L, nz = -dx / L;
    const q = [[x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y0, z0], [x1, y1, z1], [x0, y1, z0]];
    const fu = [[run, 0], [run + L, 0], [run + L, h], [run, 0], [run + L, h], [run, h]];
    q.forEach((v, k) => { P.push(...v); N.push(-nx, 0, -nz); C.push(wall.r, wall.g, wall.b); F.push(fu[k][0], fu[k][1], seed); });
    run += L;
  }
  const tri = THREE.ShapeUtils.triangulateShape(pts.map(([x, z]) => new THREE.Vector2(x, z)), []);
  for (const t of tri) for (const k of [t[0], t[2], t[1]]) { P.push(pts[k][0], y1, pts[k][1]); N.push(0, 1, 0); C.push(roof.r, roof.g, roof.b); F.push(pts[k][0], pts[k][1], seed); }
}
function toMesh(acc, m) {
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(acc.p, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(acc.n, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(acc.c, 3)); g.setAttribute("fuv", new THREE.Float32BufferAttribute(acc.f, 3));
  const o = new THREE.Mesh(g, m); o.castShadow = o.receiveShadow = true; return o;
}

export function buildWorld(scene) {
  const W = { labels: [] };
  const lbl = (name, sub, x, y, z, key) => { const L = { name, sub, p: new THREE.Vector3(x, y, z), key }; W.labels.push(L); return L; };

  // ---------- ground ----------
  const N = 300, GS = 14000, g = new THREE.PlaneGeometry(GS, GS, N, N).rotateX(-Math.PI / 2), p = g.attributes.position, col = new Float32Array(p.count * 3);
  W.groundBase = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) - 400, z = p.getZ(i) - 200, y = hgt(x, z); p.setXYZ(i, x, y, z);
    const c = isLand(x, z) ? new THREE.Color().setHSL(0.25 + 0.035 * Math.sin(x / 90) * Math.cos(z / 70), 0.42, 0.16 + 0.025 * Math.sin(x / 47 + z / 53)) : new THREE.Color("#5d6a5e");
    col.set([c.r, c.g, c.b], i * 3);
  }
  W.groundBase.set(col); g.setAttribute("color", new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
  { const gm = surfaceMaps("grass", GS / 28); W.ground = add(scene, g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, map: gm.map, roughnessMap: gm.rough, normalMap: gm.normal, normalScale: new THREE.Vector2(0.8, 0.8) }), 0, 0, 0, false); }
  { const wm = surfaceMaps("water", GS * 1.6 / 90); W.waterNormal = wm.normal; W.waterMat = new THREE.MeshPhysicalMaterial({ color: "#2f5f7f", roughness: 0.07, metalness: 0, normalMap: wm.normal, normalScale: new THREE.Vector2(0.35, 0.35), clearcoat: 0.6, clearcoatRoughness: 0.05 }); }
  W.water = add(scene, new THREE.PlaneGeometry(GS * 1.6, GS * 1.6).rotateX(-Math.PI / 2), W.waterMat, 0, -0.3, 0, false);

  // ---------- streets and the Lakeshore Path (OpenStreetMap), one ribbon mesh ----------
  { const P = [], C = [], U = [], road = new THREE.Color("#6a6b6f"), path = new THREE.Color("#b49a72");
    W.roads = []; W.streets = {};
    for (const rd of DATA.roads) {
      const pts = []; for (let i = 0; i < rd.p.length; i += 2) pts.push([rd.p[i], rd.p[i + 1]]);
      if (rd.w >= 11 && pts.length > 1) W.roads.push(pts);
      if (rd.n) (W.streets[rd.n] ||= []).push(pts);
      const cc = rd.w <= 3 ? path : road, hw = rd.w / 2;
      for (let i = 0; i < pts.length - 1; i++) { const [x0, z0] = pts[i], [x1, z1] = pts[i + 1], L = Math.hypot(x1 - x0, z1 - z0) || 1, nx = -(z1 - z0) / L * hw, nz = (x1 - x0) / L * hw;
        const y0 = Math.max(hgt(x0, z0), 0.2) + 0.35, y1 = Math.max(hgt(x1, z1), 0.2) + 0.35;
        const v = [[x0 - nx, y0, z0 - nz], [x1 - nx, y1, z1 - nz], [x1 + nx, y1, z1 + nz], [x0 - nx, y0, z0 - nz], [x1 + nx, y1, z1 + nz], [x0 + nx, y0, z0 + nz]];
        const L0 = Math.hypot(x1 - x0, z1 - z0) / 6, uu = [[0, 0], [L0, 0], [L0, 1], [0, 0], [L0, 1], [0, 1]];
        v.forEach((q, k) => { P.push(...q); C.push(cc.r, cc.g, cc.b); U.push(uu[k][0], uu[k][1] * rd.w / 6); }); } }
    const rg = new THREE.BufferGeometry(); rg.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); rg.setAttribute("color", new THREE.Float32BufferAttribute(C, 3)); rg.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2)); rg.computeVertexNormals();
    const am = surfaceMaps("asphalt", 1);
    const rm = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, map: am.map, roughnessMap: am.rough, normalMap: am.normal, normalScale: new THREE.Vector2(0.6, 0.6), side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 })); rm.receiveShadow = true; scene.add(rm);
  }

  // ---------- university buildings from the official map ----------
  const PAL = { lab: "#a5533f", hospital: "#c2bcb0", residence: "#b8a07a", education: "#c7b493", office: "#d8ccb0", assembly: "#b9a58a", athletic: "#9aa0a6", stadium: "#9b4a3a", food: "#c9a77d", parking: "#8e8f92", greenhouse: "#cfe3d9", storage: "#9a9690", plant: "#8c4b3b" };
  const acc = { p: [], n: [], c: [], f: [] }, cc = new THREE.Color(), roofC = new THREE.Color();
  const share = (() => { let s = 0; for (const b of DATA.uw) if (!b.nonUW && b.type !== "plant") s += b.gsf * b.eui; return s; })();
  W.B = DATA.uw.map(b => {
    const ring = []; for (const [x, z] of b.r) ring.push([x, z]);
    let ymin = 1e9; for (const [x, z] of ring) ymin = Math.min(ymin, hgt(x, z)); const y0 = Math.max(ymin, 0.5) - 0.5;
    const start = acc.p.length / 3; cc.set(b.nonUW ? "#bdb6aa" : PAL[b.type] || "#c7b493"); roofC.copy(cc).multiplyScalar(b.type === "stadium" ? 1 : 0.82); if (b.type === "stadium") roofC.set("#3d7a3a");
    extrudeInto(acc, ring, y0, b.h, cc, roofC, R());
    return { ...b, y0, top: y0 + b.h, color: cc.getHex(), roof: roofC.getHex(), v0: start, v1: acc.p.length / 3, campus: !b.nonUW && b.type !== "plant", share: !b.nonUW && b.type !== "plant" ? b.gsf * b.eui / share : 0, intensity: b.eui / 65.8 };
  });
  W.uwMesh = toMesh(acc, facadeMaterial()); scene.add(W.uwMesh);
  W.colorAttr = W.uwMesh.geometry.attributes.color; W.triB = new Int16Array(acc.p.length / 9);
  W.B.forEach((b, i) => { for (let t = b.v0 / 3; t < b.v1 / 3; t++) W.triB[t] = i; });
  W.setBuildingColor = (i, wallC) => { const b = W.B[i], a = W.colorAttr.array, roof = new THREE.Color(b.roof); const isRoofTint = wallC.getHex() !== b.color;
    for (let v = b.v0; v < b.v1; v++) { const top = W.uwMesh.geometry.attributes.normal.array[v * 3 + 1] > 0.5, c = isRoofTint || !top ? wallC : roof; a[v * 3] = c.r; a[v * 3 + 1] = c.g; a[v * 3 + 2] = c.b; } };
  W.flushColors = () => { W.colorAttr.needsUpdate = true; };

  // ---------- other buildings (OpenStreetMap), one mesh ----------
  { const a2 = { p: [], n: [], c: [], f: [] }, pal = ["#b9aa98", "#a89c8c", "#c4b8a6", "#9d968c", "#b8a48f", "#8f8a84"], w = new THREE.Color(), r2 = new THREE.Color();
    for (const rec of DATA.city) { const h = rec[0], ring = []; for (let i = 1; i < rec.length; i += 2) ring.push([rec[i], rec[i + 1]]);
      const [x, z] = ring[0]; if (!isLand(x, z)) continue; w.set(pal[Math.floor(R() * pal.length)]); r2.copy(w).multiplyScalar(0.8);
      extrudeInto(a2, ring, Math.max(hgt(x, z), 0.5) - 0.5, h, w, r2, R()); }
    W.cityMesh = toMesh(a2, W.uwMesh.material); W.cityMesh.receiveShadow = true; scene.add(W.cityMesh); }

  // rooftop PV candidates: flat roofs of university buildings (largest first)
  const roofs = W.B.filter(b => b.campus && b.type !== "stadium" && b.area > 400).sort((a, b) => b.area - a.area);
  W.roofPV = new THREE.InstancedMesh(box(1, 0.4, 1), mat("#1d2a44", { roughness: 0.3, metalness: 0.4 }), roofs.length);
  { const m4 = new THREE.Matrix4(); roofs.forEach((b, i) => { const s = Math.sqrt(b.area) * 0.62; m4.compose(new THREE.Vector3(b.c[0], b.top + 0.4, b.c[1]), new THREE.Quaternion(), new THREE.Vector3(s, 1, s)); W.roofPV.setMatrixAt(i, m4); }); }
  W.roofArea = roofs.map(b => b.area * 0.4); W.roofPV.count = 0; W.roofPV.castShadow = false; scene.add(W.roofPV);

  // ---------- landmarks: the Bascom Hall dome and the Capitol dome on their real footprints ----------
  const white = mat("#eeece6"), steel = mat("#a9adb2", { metalness: 0.6, roughness: 0.4 }), dark = mat("#3a3c40");
  { const b = W.B.find(q => q.name === "Bascom Hall"); if (b) { add(scene, cyl(8, 7, 24), mat("#d9cfb8"), b.c[0], b.top + 3.5, b.c[1]); add(scene, new THREE.SphereGeometry(8, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat("#7f8a86", { metalness: 0.4 }), b.c[0], b.top + 7, b.c[1]); } }
  { const [x, z] = SITES.capitol, y = hgt(x, z) + 30; add(scene, cyl(20, 30, 32), white, x, y + 15, z); add(scene, new THREE.SphereGeometry(18, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), white, x, y + 30, z); add(scene, cyl(3, 14, 12), white, x, y + 54, z); lbl("Wisconsin State Capitol", "", x, y + 75, z, null); }

  // labels: landmarks and the biggest energy users (by estimated energy)
  const topB = (name, sub, key) => { const b = W.B.find(q => q.name === name); if (b) lbl(name, sub, b.c[0], b.top + 18, b.c[1], key); };
  topB("Bascom Hall", "", "bascom"); topB("Memorial Union", "", null); topB("Camp Randall Stadium", "", null); topB("Engineering Hall", "", null);
  topB("University Hospital", "UW Health, not in campus totals", null);
  W.B.filter(b => b.campus).sort((a, b) => b.share - a.share).slice(0, 3).forEach(b => { if (!W.labels.some(L => L.name === b.name)) lbl(b.name, "large energy user", b.c[0], b.top + 18, b.c[1], null); });
  lbl("Lake Mendota", "", -400, 10, -1400, null); lbl("Picnic Point", "", SITES.picnic[0], 12, SITES.picnic[1], null);

  // ---------- energy assets: real plant footprints, stylised stacks and towers ----------
  W.stacks = []; W.towers = [];
  function plantGear(site, stacks, towers) {
    const b = W.B.find(q => q.type === "plant" && Math.hypot(q.c[0] - SITES[site][0], q.c[1] - SITES[site][1]) < 120);
    const [x, z] = b ? b.c : SITES[site], y = b ? b.top : hgt(x, z) + 25;
    const G = new THREE.Group(); scene.add(G);
    stacks.forEach(([sx, sz, sh, sr]) => { stack(G, x + sx, y - 10, z + sz, sr, sh); W.stacks.push({ p: new THREE.Vector3(x + sx, y - 10 + sh, z + sz), site }); });
    towers.forEach(([tx, tz, n]) => { const gy0 = Math.max(hgt(x + tx, z + tz), 0.5);
      for (let k = 0; k < n; k++) { const cx = x + tx + k * 13, cz = z + tz; coolingCell(G, cx, gy0, cz, 12); W.towers.push({ p: new THREE.Vector3(cx, gy0 + 14, cz), site }); }
      ladder(G, MAT.galv(), x + tx - 6.9, gy0, gy0 + 10.4, z + tz, 0);
      const ex = x + tx + (n - 1) * 6.5, ez = z + tz - 7.5, f = 0.55; pipeRack(G, ex, ez, ex + (x - ex) * f, ez + (z - ez) * f, gy0); });
    return { x, y, z };
  }
  const ch = plantGear("charter", [[18, -8, 55, 3.4], [26, 8, 55, 3.4]], [[-60, 55, 5]]);
  const wa = plantGear("walnut", [[15, 0, 45, 3.2]], [[-10, 70, 4]]);
  const wc = plantGear("wccf", [[20, -10, 40, 3.6], [20, 10, 40, 3.6]], [[-60, -40, 6]]);
  lbl("Charter Street Heating and Cooling Plant", "gas boilers · chillers", ch.x, ch.y + 60, ch.z, "charter");
  lbl("Walnut Street Heating and Cooling Plant", "gas boilers · chillers", wa.x, wa.y + 55, wa.z, "walnut");
  lbl("West Campus Cogeneration Facility", "≈150 MW gas CHP", wc.x, wc.y + 45, wc.z, "wccf");

  // free-spot finder for assumed new assets: avoid building footprints (coarse 8 m grid)
  const occ = new Set(), cell = 8, key = (i, j) => i * 100003 + j;
  const mark = ring => { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [x, z] of ring) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    for (let i = Math.floor(x0 / cell); i <= Math.floor(x1 / cell); i++) for (let j = Math.floor(z0 / cell); j <= Math.floor(z1 / cell); j++) occ.add(key(i, j)); };
  W.B.forEach(b => mark(b.r)); for (const rec of DATA.city) { const ring = []; for (let i = 1; i < rec.length; i += 2) ring.push([rec[i], rec[i + 1]]); mark(ring); }
  const free = ([tx, tz], w, d) => { for (let r = 0; r < 600; r += 8) for (let a = 0; a < 16; a++) { const x = tx + r * Math.cos(a * Math.PI / 8), z = tz + r * Math.sin(a * Math.PI / 8); let ok = isLand(x, z);
      for (let i = Math.floor((x - w / 2) / cell); ok && i <= Math.floor((x + w / 2) / cell); i++) for (let j = Math.floor((z - d / 2) / cell); ok && j <= Math.floor((z + d / 2) / cell); j++) if (occ.has(key(i, j))) ok = false;
      if (ok) { mark([[x - w / 2, z - d / 2], [x + w / 2, z + d / 2]]); return [x, z]; } } return [tx, tz]; };
  SITES.hpPlant = free([ch.x + 80, ch.z + 60], 64, 40); SITES.ashp = free([ch.x + 90, ch.z - 70], 80, 30); SITES.ccs = free([ch.x - 70, ch.z + 40], 40, 40);
  SITES.electro = free([ch.x - 100, ch.z + 110], 56, 40); SITES.substation = free([ch.x + 30, ch.z + 150], 70, 50); SITES.battery = free([SITES.substation[0] + 80, SITES.substation[1]], 90, 60);
  SITES.tesH = free([wa.x + 60, wa.z + 110], 70, 70); SITES.tesC = free([ch.x + 20, ch.z + 150], 50, 50); SITES.reactor = free([wc.x - 140, wc.z + 90], 50, 40);
  SITES.chpNew = free([wa.x + 90, wa.z + 40], 50, 30);
  SITES.fuelYard = free([ch.x - 60, ch.z + 95], 26, 18);
  { // stylised fuel yard beside the Charter Street plant: backup fuel-oil tanks on saddles, a gas metering skid, piping, handrails
    const [x, z] = SITES.fuelYard, y = Math.max(hgt(x, z), 0.5), G = new THREE.Group(); G.position.set(x, y, z); scene.add(G);
    add(G, rbox(26, 0.4, 18, 0.1), MAT.concrete("#a9a59c"), 0, 0.2, 0, false);
    for (const tz of [-4.5, 4.5]) { const tank = add(G, new THREE.CapsuleGeometry(2.2, 12, 6, 24).rotateZ(Math.PI / 2), MAT.painted("#e4e1d8"), -2, 3.2, tz);
      for (const sx of [-5, 1, 7]) add(G, rbox(0.8, 1.4, 3.6, 0.08), MAT.concrete("#9d998f"), -2 + sx - 1, 1.0, tz);
      flanges(G, MAT.galv(), MAT.galv(), -2, tz, 0.35, [5.6]); ladder(G, MAT.galv(), 6.6, 0.4, 5.4, tz, 0); }
    add(G, rbox(5, 2.2, 3, 0.1), MAT.painted("#e0b52a"), 9.5, 1.5, 0);
    for (const yy of [1.2, 2.0]) add(G, new THREE.CylinderGeometry(0.18, 0.18, 9, 12).rotateZ(Math.PI / 2), MAT.painted("#e0b52a"), 9.5, yy, -5.5);
    railRect(G, MAT.galv(), 0, 0.4, 0, 25.5, 17.5);
    lbl("Fuel yard", "stylised: backup oil tanks, gas metering", x, y + 18, z, null); }
  SITES.solarFarm = [-3600, 2300]; SITES.windFarm = [-6500, 900];

  { // substation (generic location: the real substations serving campus are not mapped here) and incoming line
    const [x, z] = SITES.substation, y = hgt(x, z), G = new THREE.Group(); G.position.set(x, y, z); scene.add(G);
    add(G, box(70, 0.5, 50), mat("#9a9a94"), 0, 0.25, 0);
    for (let k = 0; k < 3; k++) transformer(G, -22 + k * 22, 0.5, 0);
    railRect(G, MAT.galv(), 0, 0.5, 0, 68, 48);
    lbl("Substation", "generic location", x, y + 30, z, "grid");
    const pyl = mat("#9fa3a6", { metalness: 0.5 }), pts = [new THREE.Vector3(x, y + 9, z)];
    for (let k = 0; k < 8; k++) { const px = x + 40 + k * 60, pz = z + 160 + k * 380, py = hgt(px, pz); const Pg = new THREE.Group(); Pg.position.set(px, py, pz); scene.add(Pg); add(Pg, cyl(0.6, 36, 6, 2.8), pyl, 0, 18, 0); add(Pg, box(18, 0.8, 0.8), pyl, 0, 32, 0); pts.push(new THREE.Vector3(px, py + 32, pz)); }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: "#2a2a2a" })));
  }

  // ---------- scenario assets (all Assumption) ----------
  const S = W.scen = {}, m4 = new THREE.Matrix4();
  const grp = k => { const [x, z] = SITES[k], y = hgt(x, z), G = new THREE.Group(); G.position.set(x, y, z); scene.add(G); return G; };
  { const G = grp("hpPlant"); add(G, rbox(60, 18, 34, 0.4), MAT.concrete("#d7d2c6"), 0, 9, 0); add(G, rbox(60.4, 1.6, 34.4, 0.3), MAT.painted(CARDINAL), 0, 18.8, 0); railRect(G, MAT.galv(), 0, 19.6, 0, 58, 32);
    for (let k = 0; k < 4; k++) add(G, cyl(1.2, 30, 16).rotateZ(Math.PI / 2), MAT.galv(), 0, 3 + k * 2.8, 18.5); pipeRack(G, -28, 22, 28, 22, 0, 4);
    S.hp = G; lbl("Heat-recovery heat pumps", "Assumption: new plant", G.position.x, G.position.y + 40, G.position.z, "heatpump"); }
  { const G = grp("ashp"); for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) { add(G, rbox(10, 4, 6, 0.25), MAT.painted("#c9ccd0"), -30 + i * 12, 2, -8 + j * 8); add(G, cyl(2.2, 0.6, 16), dark, -30 + i * 12, 4.3, -8 + j * 8); } S.ashp = G; }
  { const [x, z] = SITES.fields, y = hgt(x, z); S.boreMax = 4000; S.bores = new THREE.InstancedMesh(cyl(0.5, 0.6, 8), mat("#e0e0e0"), S.boreMax);
    for (let i = 0; i < S.boreMax; i++) { const a = i % 80, b = Math.floor(i / 80); m4.makeTranslation(x - 160 + a * 4 + (b % 2) * 2, Math.max(hgt(x - 160 + a * 4, z - 110 + b * 4.4), 0.5) + 0.4, z - 110 + b * 4.4); S.bores.setMatrixAt(i, m4); }
    S.bores.count = 0; scene.add(S.bores);
    S.boreCols = add(scene, box(320, 200, 220), new THREE.MeshBasicMaterial({ color: "#d98a3a", transparent: true, opacity: 0.12, depthWrite: false }), x, y - 100, z, false); S.boreCols.visible = false;
    lbl("Geothermal borefield", "Assumption: under the recreation fields", x, y + 25, z, "borefield"); }
  { const [x, z] = SITES.tesH, y = hgt(x, z); S.tesH = add(scene, cyl(1, 1, 64), MAT.painted("#e7dcc4"), x, y, z); S.tesHy = y; lbl("Hot-water storage tank", "Assumption", x, y + 50, z, "tes");
    const [x2, z2] = SITES.tesC, y2 = hgt(x2, z2); S.tesC = add(scene, cyl(1, 1, 64), MAT.painted("#cdd8de"), x2, y2, z2); S.tesCy = y2; }
  { const [x, z] = SITES.battery, y = hgt(x, z); S.battMax = 120; S.batt = new THREE.InstancedMesh(rbox(12.2, 2.9, 2.4, 0.12), MAT.painted("#e8e8e8"), S.battMax); S.batt.castShadow = S.batt.receiveShadow = true;
    for (let i = 0; i < S.battMax; i++) { m4.makeTranslation(x + (i % 6) * 14 - 35, y + 1.45, z + Math.floor(i / 6) * 4 - 40); S.batt.setMatrixAt(i, m4); } S.batt.count = 0; scene.add(S.batt); }
  { const G = grp("ccs"); const ss = MAT.stainless(), gv = MAT.galv(); add(G, cyl(7, 55, 32), ss, 0, 27.5, 0); add(G, cyl(4, 40, 24), ss, 18, 20, 0); add(G, rbox(30, 8, 20, 0.3), MAT.painted("#c2c4c6"), 8, 4, 18);
    flanges(G, gv, gv, 0, 0, 7, [12, 24, 36, 48]); flanges(G, gv, gv, 18, 0, 4, [10, 20, 30]);
    for (const yy of [18, 36, 52]) { add(G, new THREE.RingGeometry(7, 8.6, 40).rotateX(-Math.PI / 2), gv, 0, yy, 0, false).material.side = THREE.DoubleSide; railRing(G, gv, 0, yy, 0, 8.5); }
    ladder(G, gv, -7.5, 0, 53, 0, Math.PI / 2); S.ccs = G; lbl("CO₂ capture", "Assumption: amine absorber + stripper", G.position.x, G.position.y + 70, G.position.z, "ccs"); }
  { const G = grp("electro"); add(G, rbox(50, 12, 26, 0.35), MAT.painted("#dfe3e6"), 0, 6, 0); railRect(G, MAT.galv(), 0, 12, 0, 48, 24); for (let k = 0; k < 4; k++) add(G, cyl(3, 22, 16).rotateZ(Math.PI / 2), white, 0, 3, 22 + k * 7); S.electro = G; lbl("Electrolysers", "Assumption: green H₂", G.position.x, G.position.y + 30, G.position.z, "h2"); }
  { const G = grp("reactor"); add(G, rbox(40, 14, 30, 0.4), MAT.concrete("#c9ccc4"), 0, 7, 0); add(G, cyl(9, 12, 24), mat("#e9e6de"), 0, 20, 0); add(G, new THREE.SphereGeometry(9, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat("#e9e6de"), 0, 26, 0); S.reactor = G; lbl("Microreactor", "Assumption: 10 MW class", G.position.x, G.position.y + 45, G.position.z, null); }
  { const G = grp("chpNew"); add(G, rbox(40, 16, 22, 0.4), MAT.concrete("#cfcac0"), 0, 8, 0); stack(G, 15, 0, 0, 2.8, 36); S.chp = G; W.stacks.push({ p: new THREE.Vector3(G.position.x + 15, G.position.y + 36, G.position.z), site: "chp" }); }
  { const [x, z] = SITES.solarFarm, y = hgt(x, z); S.farmMax = 3000; S.farm = new THREE.InstancedMesh(box(4, 0.15, 2.2), mat("#1f2c47", { roughness: 0.25, metalness: 0.5 }), S.farmMax); const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.6, 0, 0));
    for (let i = 0; i < S.farmMax; i++) { const a = i % 100, b = Math.floor(i / 100); m4.compose(new THREE.Vector3(x - 260 + a * 5.2, y + 1.6, z - 120 + b * 8), q, new THREE.Vector3(1, 1, 1)); S.farm.setMatrixAt(i, m4); }
    S.farm.count = 0; scene.add(S.farm); S.farmLbl = lbl("Solar farm", "", x, y + 30, z, "solar");
    S.turbines = [];
    for (let k = 0; k < 24; k++) { const tx = SITES.windFarm[0] + (k % 6) * 420 + (Math.floor(k / 6) % 2) * 200, tz = SITES.windFarm[1] - 900 + Math.floor(k / 6) * 520, ty = hgt(tx, tz);
      const T = new THREE.Group(); T.position.set(tx, ty, tz); scene.add(T); add(T, cyl(2, 90, 12, 3.4), white, 0, 45, 0); add(T, box(10, 4, 4), white, 0, 91, 0);
      const rot = new THREE.Group(); rot.position.set(6, 91, 0); T.add(rot); for (let b = 0; b < 3; b++) { const bl = add(rot, box(0.8, 55, 2.4).translate(0, 27, 0), white, 0, 0, 0); bl.rotation.x = b * 2.094; } T.userData.rot = rot; T.visible = false; S.turbines.push(T); }
    S.windLbl = lbl("Wind farm", "PPA, off campus", SITES.windFarm[0] + 1000, 160, SITES.windFarm[1] - 200, "solar"); }

  // ---------- utility networks: approximate routes along real streets (the tunnel maps are not public) ----------
  W.netGroup = new THREE.Group(); W.netGroup.visible = false; scene.add(W.netGroup);
  W.heatMat = new THREE.MeshBasicMaterial({ color: "#e0402a" }); W.coolMat = new THREE.MeshBasicMaterial({ color: "#2f86d6" });
  W.flowPaths = { heat: [], cool: [] };
  const ROUTES = { heat: ["University Avenue", "West Johnson Street", "North Charter Street", "Observatory Drive", "Linden Drive", "Walnut Street", "Campus Drive", "North Park Street", "West Dayton Street", "Engineering Drive", "Highland Avenue"],
    cool: ["University Avenue", "North Charter Street", "Walnut Street", "West Johnson Street", "Campus Drive", "Linden Drive"] };
  for (const [kind, names] of Object.entries(ROUTES)) for (const nm of names) for (const pts of W.streets[nm] || []) {
    const inside = pts.filter(([x, z]) => x > -2450 && x < 700 && z > -450 && z < 900); if (inside.length < 2) continue;
    const off = kind === "heat" ? 3 : -3, v = inside.map(([x, z]) => new THREE.Vector3(x + off, Math.max(hgt(x, z), 0.5) + (kind === "heat" ? 6 : 9), z + off));
    const curve = new THREE.CatmullRomCurve3(v, false, "catmullrom", 0.05), len = curve.getLength(); if (len < 30) continue;
    W.netGroup.add(new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(8, Math.round(len / 25)), kind === "heat" ? 2.6 : 2.2, 6), kind === "heat" ? W.heatMat : W.coolMat));
    W.flowPaths[kind].push({ curve, len });
  }
  lbl("Utility routes", "approximate, along streets", -600, 40, 240, null).hideUnlessNet = true;
  { const n = 900, pos = new Float32Array(n * 3), geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    W.flow = new THREE.Points(geo, new THREE.PointsMaterial({ size: 9, vertexColors: true, sizeAttenuation: true, depthWrite: false })); W.flow.frustumCulled = false; W.netGroup.add(W.flow);
    W.flowU = new Float32Array(n).map(() => R()); W.flowK = new Uint8Array(n).map((_, i) => i % 2); W.flowL = new Uint16Array(n).map(() => Math.floor(R() * 999)); }

  // ---------- plumes ----------
  { const n = 1600, pos = new Float32Array(n * 3), geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const c = document.createElement("canvas"); c.width = c.height = 64; const gg = c.getContext("2d"), rg = gg.createRadialGradient(32, 32, 0, 32, 32, 32); rg.addColorStop(0, "rgba(255,255,255,0.9)"); rg.addColorStop(1, "rgba(255,255,255,0)"); gg.fillStyle = rg; gg.fillRect(0, 0, 64, 64);
    W.plume = new THREE.Points(geo, new THREE.PointsMaterial({ size: 26, map: new THREE.CanvasTexture(c), transparent: true, opacity: 0.55, depthWrite: false, color: "#f4f4f2" })); W.plume.frustumCulled = false; scene.add(W.plume);
    W.plumeU = new Float32Array(n).map(() => R()); W.plumeS = new Uint16Array(n).map(() => Math.floor(R() * 999)); W.plumeR = new Float32Array(n * 2).map(() => R() - 0.5); }

  // ---------- trees (stylised placement: campus open land away from buildings and streets; Picnic Point and the lakeshore wooded) ----------
  { const rc = new Set(), rcell = 7, rk = (i, j) => i * 100003 + j;
    for (const rd of DATA.roads) for (let i = 0; i + 3 < rd.p.length; i += 2) { const x0 = rd.p[i], z0 = rd.p[i + 1], x1 = rd.p[i + 2], z1 = rd.p[i + 3], L = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(L / 4), pad = rd.w / 2 + 2;
      for (let k = 0; k <= n; k++) { const x = x0 + (x1 - x0) * k / n, z = z0 + (z1 - z0) * k / n; for (let a = -pad; a <= pad; a += rcell) for (let b = -pad; b <= pad; b += rcell) rc.add(rk(Math.floor((x + a) / rcell), Math.floor((z + b) / rcell))); } }
    const clear = (x, z) => !occ.has(key(Math.floor(x / cell), Math.floor(z / cell))) && !rc.has(rk(Math.floor(x / rcell), Math.floor(z / rcell)));
    const nz = (x, z) => 0.5 + 0.25 * Math.sin(x / 130 + Math.cos(z / 170) * 2) + 0.25 * Math.sin(z / 90 - x / 210);
    const spots = [], fx = SITES.fields, st = SITES.stadium;
    for (let t = 0; t < 60000 && spots.length < 9000; t++) {
      const x = -3200 + R() * 5600, z = -1700 + R() * 3300; if (!isLand(x, z) || !clear(x, z)) continue;
      if (Math.hypot(x - fx[0], z - fx[1]) < 260 || Math.hypot(x - st[0], z - st[1]) < 140) continue;
      const wood = Math.exp(-((x - SITES.picnic[0]) ** 2 + (z - SITES.picnic[1]) ** 2) / 2.5e5) + (z < -250 && !isLand(x, z - 120) ? 0.8 : 0) + (Math.hypot(x + 380, z + 120) < 260 ? 0.5 : 0);
      if (R() > 0.12 + 0.45 * nz(x, z) + wood) continue;
      spots.push({ x, z, y: Math.max(hgt(x, z), 0.3), r: 3 + R() * 3.5, a: R() * 6.28, h: R(), ever: R() < 0.22 }); }
    W.trees = trees(scene, spots); }

  // ---------- people walking on the Lakeshore Path, campus paths and sidewalks (illustrative) ----------
  { const walks = []; for (const rd of DATA.roads) { const pts = []; for (let i = 0; i < rd.p.length; i += 2) pts.push([rd.p[i], rd.p[i + 1]]);
      if (pts.length < 2) continue; const [x, z] = pts[0]; if (x < -2600 || x > 1200 || z < -900 || z > 1100) continue;
      if (rd.w <= 3) walks.push({ pts, off: 0.8 }); else if (rd.w < 14) walks.push({ pts, off: rd.w / 2 + 1.5 }); }
    const n = 700, pg = personGeometry(), skinTones = ["#f1d2b6", "#e0b48f", "#c68e62", "#9c6a43", "#6e4a2f", "#4a3121"], shirts = ["#c5050c", "#1f3a68", "#2d2f33", "#e9e6df", "#5a7d4e", "#8a5a9e", "#d98a3a", "#3b6e8f", "#7a2430", "#b8b8b8"];
    W.people = new THREE.InstancedMesh(pg.body, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), n);
    W.heads = new THREE.InstancedMesh(pg.skin, new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.6 }), n);
    const c = new THREE.Color(); W.walk = { paths: walks, u: new Float32Array(n).map(() => R()), p: new Uint16Array(n).map(() => Math.floor(R() * walks.length)), dir: new Int8Array(n).map(() => R() < 0.5 ? 1 : -1), side: new Float32Array(n).map(() => R() < 0.5 ? 1 : -1), sp: new Float32Array(n).map(() => 1.1 + R() * 0.5), s: new Float32Array(n).map(() => 0.92 + R() * 0.16) };
    // a mix of women and men: about half are women (most with longer hair, slightly narrower shoulders), varied height, hair and skin tone
    const hairCols = ["#1c1714", "#2e2119", "#4a3424", "#6b4a2f", "#8a5a34", "#b98e5a", "#d3b384", "#8c8c8c"], hairMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.75 });
    W.hairS = new THREE.InstancedMesh(pg.hairShort, hairMat, n); W.hairL = new THREE.InstancedMesh(pg.hairLong, hairMat, n);
    W.walk.woman = new Uint8Array(n).map(() => R() < 0.5 ? 1 : 0); W.walk.longHair = new Uint8Array(n).map((_, i) => W.walk.woman[i] ? (R() < 0.8 ? 1 : 0) : (R() < 0.08 ? 1 : 0));
    for (let i = 0; i < n; i++) { if (W.walk.woman[i]) W.walk.s[i] *= 0.95; W.people.setColorAt(i, c.set(shirts[Math.floor(R() * shirts.length)])); W.heads.setColorAt(i, c.set(skinTones[Math.floor(R() * skinTones.length)]));
      const hc = c.set(hairCols[Math.floor(R() * hairCols.length)]); W.hairS.setColorAt(i, hc); W.hairL.setColorAt(i, hc); }
    for (const o of [W.people, W.heads, W.hairS, W.hairL]) { o.castShadow = true; o.frustumCulled = false; scene.add(o); } }

  // ---------- street lights along campus streets (illustrative spacing, 40 m); heads glow at night ----------
  { const spots = [];
    for (const rd of DATA.roads) { if (rd.w < 8) continue; for (let i = 0; i + 3 < rd.p.length; i += 2) { const x0 = rd.p[i], z0 = rd.p[i + 1], x1 = rd.p[i + 2], z1 = rd.p[i + 3], L = Math.hypot(x1 - x0, z1 - z0);
      if (x0 < -2600 || x0 > 1400 || z0 < -800 || z0 > 1300) continue;
      for (let s0 = 20 * R(); s0 < L; s0 += 40) { const u = s0 / L, side = (Math.floor(s0 / 40) % 2) ? 1 : -1, nx = -(z1 - z0) / L, nz = (x1 - x0) / L, off = rd.w / 2 + 1.2;
        spots.push([x0 + (x1 - x0) * u + nx * off * side, z0 + (z1 - z0) * u + nz * off * side, Math.atan2(nz * side, nx * side)]); } } }
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
    const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.11, 8, 6).translate(0, 4, 0), MAT.painted("#2f3236"), spots.length);
    W.lampMat = new THREE.MeshStandardMaterial({ color: "#d9d6cc", emissive: "#ffcf8a", emissiveIntensity: 0, roughness: 0.4 });
    const head = new THREE.InstancedMesh(rbox(0.9, 0.18, 0.4, 0.06).translate(-0.5, 8, 0), W.lampMat, spots.length);
    spots.forEach(([x, z, a], i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a); m4.compose(new THREE.Vector3(x, Math.max(hgt(x, z), 0.2), z), q, one); pole.setMatrixAt(i, m4); head.setMatrixAt(i, m4); });
    pole.castShadow = true; scene.add(pole, head); W.nLamps = spots.length; }

  // vehicles on the main streets (true size: 4.5 m long)
  { const n = 160; W.cars = new THREE.InstancedMesh(carGeometry(), new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.5, clearcoat: 1, clearcoatRoughness: 0.08 }), n); W.cars.castShadow = true; W.cars.frustumCulled = false; W.carU = new Float32Array(n).map(() => R()); W.carR = new Uint16Array(n).map(() => Math.floor(R() * W.roads.length)); W.carEV = new Float32Array(n).map(() => R()); scene.add(W.cars); }
  return W;
}

// ---------- scenario → scene ----------
export function applyScenario(W, c, R) {
  const S = W.scen, hp = c.dist !== "steam";
  let roofMW = Math.min(c.solar, 36), need = roofMW * 1e6 / 200, k = 0; while (need > 0 && k < W.roofArea.length) { need -= W.roofArea[k]; k++; } W.roofPV.count = c.solar > 0.5 ? k : 0;
  S.farm.count = Math.round(Math.min(S.farmMax, Math.max(0, c.solar - 36) / 250 * S.farmMax)); S.farmLbl.sub = c.solar > 36 ? `${Math.round(c.solar - 36)} MW, off campus (generic location)` : ""; S.farmLbl.hide = c.solar <= 36;
  const nT = Math.min(24, Math.round(c.wind / 3)); S.turbines.forEach((t, i) => t.visible = i < nT); S.windLbl.hide = nT === 0; S.windLbl.sub = `${Math.round(c.wind)} MW, PPA off campus`;
  S.hp.visible = hp && c.hr + c.gshp > 0; S.ashp.visible = hp && c.ashp > 0;
  S.bores.count = hp ? Math.min(S.boreMax, Math.round(c.bores)) : 0; S.boreCols.scale.set(1, 1, Math.max(0.05, Math.min(1, S.bores.count / S.boreMax)));
  const tank = (o, MWh, dT, y0) => { const V = MWh * 3.6e9 / (4186 * 1000 * dT), H = Math.min(40, Math.max(12, Math.cbrt(V) * 1.1)), r = Math.sqrt(V / (Math.PI * H)); o.visible = MWh > 0; o.scale.set(r, H, r); o.position.y = y0 + H / 2; return { V, H, r }; };
  W.tankH = tank(S.tesH, hp ? c.tesH : 0, c.dist === "hw50" ? 25 : 30, S.tesHy); W.tankC = tank(S.tesC, c.tesC, 8, S.tesCy);
  S.batt.count = Math.min(S.battMax, Math.ceil(c.batt / 4));
  S.ccs.visible = !!c.ccs; S.electro.visible = c.fuel === "h2" || c.fuel === "blend"; S.reactor.visible = c.nuclear > 0; S.chp.visible = c.chp > 0;
  W.heatMat.color.set(c.dist === "steam" ? "#e0402a" : c.dist === "hw70" ? "#ef8a2c" : "#e9b43a");
  for (const L of W.labels) if (L.key === "ccs") L.hide = !c.ccs; else if (L.key === "h2") L.hide = !S.electro.visible; else if (L.key === "heatpump") L.hide = !S.hp.visible; else if (L.key === "borefield") L.hide = !S.bores.count; else if (L.key === "tes") L.hide = !S.tesH.visible;
  for (const L of W.labels) if (L.name === "Microreactor") L.hide = !c.nuclear;
}
