// Static 3D world for the football twin: Camp Randall Stadium, Madison, modelled after aerial and field-level
// photographs (Wikimedia Commons) and UW campus maps. Field north–south; one continuous 46-row lower bowl;
// the 1966 west upper deck overhanging it, with its cream fascia, rim lights and the glass press box on top;
// the 2005 suites along the east rim; the Student-Athlete Performance Center's curved arcade and the 50 × 170 ft
// video board at the north end; the 1930 Field House with its red hipped roof behind the south stands; McClain
// Center and the Shell (white vaults) to the east, Breese Terrace houses to the west, the engineering campus north.
// Positions and sizes are approximate, not surveyed. Units are metres; x north, z east, y up.
// End zones read WISCONSIN in plain block lettering; no logos (Motion W, Bucky Badger) are used.
import * as THREE from "three";

const YD = 0.9144;
export const FIELD = { L: 120 * YD, W: 160 / 3 * YD, EZ: 10 * YD, goal: 50 * YD, end: 60 * YD, half: 80 / 3 * YD };
export const CARDINAL = "#c5050c";
// stand plan: rounded rectangle path around the field and the lower-bowl step profile
export const BOWL = { ax: 60, az: 32.5, rc: 22, h0: 1.4, rows: 46, tread: 0.84, riser: 0.42 };
BOWL.D = BOWL.rows * BOWL.tread; BOWL.H = BOWL.h0 + BOWL.rows * BOWL.riser;
// west upper deck (1966): overhangs the back of the lower bowl, cream fascia, press box on top
export const DECK = { d0: 25.5, y0: 19.5, fascia: 2.2, rows: 30, tread: 0.85, riser: 0.6 };
DECK.Db = DECK.d0 + DECK.rows * DECK.tread; DECK.Hb = DECK.y0 + DECK.fascia + DECK.rows * DECK.riser;
export const PRESS = { x: 30, d0: DECK.Db - 9, d1: DECK.Db + 0.6, y0: DECK.Hb + 1.4, y1: DECK.Hb + 12 };
export const EAST = { d0: BOWL.D + 0.3, d1: BOWL.D + 12, y: 31 };          // 2005 suites along the east rim
export const NORTH = { d0: BOWL.D + 0.4, d1: BOWL.D + 14, y: 22 };         // Student-Athlete Performance Center arcade
export const FH = { x: -BOWL.ax - BOWL.D - 0.6 - 24, dx: 46, dz: 80, wall: 18, ridge: 30 };   // Field House (1930)

function mulberry(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rand = mulberry(11);
function canvasTex(w, h, draw, rep = [1, 1]) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const brickTex = canvasTex(256, 256, (g, W, H) => {
  g.fillStyle = "#8c8279"; g.fillRect(0, 0, W, H);
  for (let r = 0; r < 16; r++) for (let c = -1; c < 9; c++) {
    const x = c * 32 + (r % 2) * 16, y = r * 16, k = rand();
    g.fillStyle = `rgb(${150 + k * 40 | 0},${62 + k * 22 | 0},${48 + k * 14 | 0})`; g.fillRect(x + 1, y + 1, 30, 14);
  }
}, [1, 1]);
const brick = (rx, ry, o = {}) => { const t = brickTex.clone(); t.repeat.set(rx, ry); t.needsUpdate = true; return withDetail(mat("#ffffff", { map: t, ...o }), BRICKN, [rx * 2, ry * 2], 0.5); };
const archTex = canvasTex(256, 256, (g, W, H) => {        // one 8 m × 8 m bay: brick, limestone trim, tall arched window
  g.drawImage(brickTex.image, 0, 0); g.drawImage(brickTex.image, 0, 128, 256, 128);
  const cx = W / 2, top = H * 0.2, bot = H * 0.95, hw = W * 0.2;
  g.fillStyle = "#d9cfb8"; g.beginPath(); g.moveTo(cx - hw - 8, bot); g.lineTo(cx - hw - 8, top + hw); g.arc(cx, top + hw, hw + 8, Math.PI, 0); g.lineTo(cx + hw + 8, bot); g.fill();
  g.fillStyle = "#26323d"; g.beginPath(); g.moveTo(cx - hw, bot); g.lineTo(cx - hw, top + hw); g.arc(cx, top + hw, hw, Math.PI, 0); g.lineTo(cx + hw, bot); g.fill();
  g.fillStyle = "rgba(255,255,255,0.18)"; g.fillRect(cx - 2, top, 4, bot - top); g.fillRect(cx - hw, top + hw + 30, 2 * hw, 3);
  g.fillStyle = "#d9cfb8"; g.fillRect(0, H * 0.96, W, H * 0.04);
}, [1, 1]);
const arch = (rx, ry, o = {}) => { const t = archTex.clone(); t.repeat.set(rx, ry); t.needsUpdate = true; return mat("#ffffff", { map: t, roughness: 0.85, ...o }); };
const concreteTex = canvasTex(128, 128, (g, W, H) => { g.fillStyle = "#a9a7a1"; g.fillRect(0, 0, W, H); for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(${rand() < 0.5 ? "255,255,255" : "0,0,0"},${rand() * 0.07})`; g.fillRect(rand() * W, rand() * H, 2, 2); } }, [20, 20]);
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.05, ...o });

// ---------------------------------------------------------------- procedural surface detail (Part H)
// Tileable value noise → height field → tangent-space normal map and a roughness map, built on canvases (no downloads).
function tileNoise(N, cells, seed) {
  const rnd = mulberry(seed), g = Array.from({ length: cells * cells }, rnd), out = new Float32Array(N * N), sm = t => t * t * (3 - 2 * t);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const fx = x / N * cells, fy = y / N * cells, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = sm(fx - x0), ty = sm(fy - y0);
    const v = (i, j) => g[((j % cells + cells) % cells) * cells + ((i % cells + cells) % cells)];
    out[y * N + x] = (v(x0, y0) * (1 - tx) + v(x0 + 1, y0) * tx) * (1 - ty) + (v(x0, y0 + 1) * (1 - tx) + v(x0 + 1, y0 + 1) * tx) * ty;
  }
  return out;
}
function detailMaps(N, { octaves = [[8, 0.5], [32, 0.3], [128, 0.2]], streak = 0, strength = 2, rough = [0.8, 0.15], seed = 3, rep = [1, 1] }) {
  const h = new Float32Array(N * N);
  octaves.forEach(([c, a], k) => { const n = tileNoise(N, c, seed + k * 17); for (let i = 0; i < h.length; i++) h[i] += a * n[i]; });
  if (streak) { const n = tileNoise(N, 64, seed + 99); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) h[y * N + x] += streak * n[(y * 7 % N) * N + x]; }   // grain along one direction (turf blades, brushed finish)
  const mk = fill => { const c = document.createElement("canvas"); c.width = c.height = N; const g = c.getContext("2d"), im = g.createImageData(N, N); fill(im.data); g.putImageData(im, 0, 0);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.anisotropy = 8; return t; };
  const H = (x, y) => h[((y + N) % N) * N + ((x + N) % N)];
  const normalMap = mk(d => { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength, L = Math.hypot(dx, dy, 1), i = 4 * (y * N + x);
    d[i] = (-dx / L * 0.5 + 0.5) * 255; d[i + 1] = (dy / L * 0.5 + 0.5) * 255; d[i + 2] = (1 / L * 0.5 + 0.5) * 255; d[i + 3] = 255; } });
  const roughnessMap = mk(d => { for (let i = 0; i < N * N; i++) { const v = Math.min(1, Math.max(0, rough[0] + rough[1] * (h[i] - 0.5) * 2)) * 255; d[4 * i] = d[4 * i + 1] = d[4 * i + 2] = v; d[4 * i + 3] = 255; } });
  return { normalMap, roughnessMap };
}
const withDetail = (m, maps, rep, scale = 0.6) => { const n = maps.normalMap.clone(), r = maps.roughnessMap.clone(); n.repeat.set(...rep); r.repeat.set(...rep); n.needsUpdate = r.needsUpdate = true;
  Object.assign(m, { normalMap: n, roughnessMap: r, normalScale: new THREE.Vector2(scale, scale), roughness: 1 }); m.needsUpdate = true; return m; };
// panel joints and standing seams: lines at constant u (sweep u runs 1 unit per 2 m along the path)
function seamTex(base, line, perU, across = 0) { return canvasTex(256, 256, (g, W, H) => { g.fillStyle = base; g.fillRect(0, 0, W, H);
  g.fillStyle = line; for (let i = 0; i < perU; i++) g.fillRect(i * W / perU, 0, 3, H); if (across) for (let j = 0; j < across; j++) g.fillRect(0, j * H / across, W, 2);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,0,0,${rand() * 0.05})`; g.fillRect(rand() * W, rand() * H, 2, 2); } }); }
const CONC = detailMaps(256, { strength: 3, rough: [0.88, 0.1], seed: 5 });
const TURF = detailMaps(256, { octaves: [[16, 0.3], [64, 0.35], [256, 0.35]], streak: 0.6, strength: 4, rough: [0.85, 0.12], seed: 9 });
const GRASS = detailMaps(256, { octaves: [[8, 0.4], [32, 0.3], [128, 0.3]], strength: 3, rough: [0.95, 0.05], seed: 13 });
const BRICKN = detailMaps(128, { octaves: [[16, 0.6], [64, 0.4]], strength: 2, rough: [0.9, 0.08], seed: 21 });
// soft round contact shadow (multiplied under people and equipment)
const contactTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  gr.addColorStop(0, "rgba(0,0,0,0.55)"); gr.addColorStop(0.6, "rgba(0,0,0,0.18)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const contactMat = new THREE.MeshBasicMaterial({ map: contactTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
const contactGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

// signed distance outside the rounded-rectangle stand path
export function bowlDist(x, z) {
  const qx = Math.abs(x) - (BOWL.ax - BOWL.rc), qz = Math.abs(z) - (BOWL.az - BOWL.rc);
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - BOWL.rc;
}
// height of the stands at a plan point (for ray-marched field shade)
export function bowlNormal(x, z) {
  const qx = Math.abs(x) - (BOWL.ax - BOWL.rc), qz = Math.abs(z) - (BOWL.az - BOWL.rc);
  if (qx > 0 && qz > 0) { const L = Math.hypot(qx, qz); return [Math.sign(x) * qx / L, Math.sign(z) * qz / L]; }
  return qx > qz ? [Math.sign(x), 0] : [0, Math.sign(z)];
}
export function standHeight(x, z) {
  const d = bowlDist(x, z), [nx, nz] = bowlNormal(x, z); let h = 0;
  if (d >= 0 && d <= BOWL.D + 0.3) h = BOWL.h0 + Math.floor(d / BOWL.tread) * BOWL.riser + BOWL.riser;
  if (nz < -0.55 && d >= DECK.d0 - 0.5 && d <= DECK.Db + 0.6) h = Math.max(h, Math.min(DECK.Hb + 1.4, DECK.y0 + DECK.fascia + Math.max(0, d - DECK.d0) / DECK.tread * DECK.riser));
  if (nz < -0.55 && Math.abs(x) < PRESS.x && d >= PRESS.d0 && d <= PRESS.d1) h = Math.max(h, PRESS.y1);
  if (nz > 0.55 && d >= EAST.d0 && d <= EAST.d1) h = Math.max(h, EAST.y);
  if (nx > 0.55 && d >= NORTH.d0 && d <= NORTH.d1) h = Math.max(h, NORTH.y);
  if (x > BOWL.ax + BOWL.D + 1 && x < BOWL.ax + BOWL.D + 4 && Math.abs(z) < 27) h = Math.max(h, NORTH.y + 17);   // video board
  if (Math.abs(x - FH.x) < FH.dx / 2 && Math.abs(z) < FH.dz / 2) h = Math.max(h, FH.ridge);
  return h;
}

// ---------------------------------------------------------------- field canvas
function drawField(g, Wc, Hc, ppm, x0, z0) {
  const X = x => (x - x0) * ppm, Z = z => (z - z0) * ppm;
  // turf: two-tone 5-yard bands, apron darker
  g.fillStyle = "#2d5a2a"; g.fillRect(0, 0, Wc, Hc);
  for (let k = -10; k < 10; k++) { g.fillStyle = k % 2 ? "#41803a" : "#30632b"; g.fillRect(X(k * 5 * YD), Z(-FIELD.half), 5 * YD * ppm + 1, FIELD.W * ppm); }   // mowing stripes: blades laid toward / away from the viewer
  // wear: scuffed infill between the hashes and around the 40s (lighter, browner), soft-edged
  { const hz0 = FIELD.half - 60 * 0.3048; for (let i = 0; i < 900; i++) { const x = (rand() - 0.5) * 2 * 42 * YD, z = (rand() - 0.5) * 2 * hz0 * 0.9, rr = (0.6 + rand() * 1.6) * ppm;
      const gr = g.createRadialGradient(X(x), Z(z), 0, X(x), Z(z), rr); gr.addColorStop(0, "rgba(120,110,70,0.16)"); gr.addColorStop(1, "rgba(120,110,70,0)"); g.fillStyle = gr; g.fillRect(X(x) - rr, Z(z) - rr, 2 * rr, 2 * rr); } }
  // end zones
  g.fillStyle = CARDINAL;
  g.fillRect(X(FIELD.goal), Z(-FIELD.half), FIELD.EZ * ppm, FIELD.W * ppm); g.fillRect(X(-FIELD.end), Z(-FIELD.half), FIELD.EZ * ppm, FIELD.W * ppm);
  for (const [sx, word] of [[1, "WISCONSIN"], [-1, "WISCONSIN"]]) {
    g.save(); g.translate(X(sx * (FIELD.goal + FIELD.EZ / 2)), Z(0)); g.rotate(sx * Math.PI / 2);
    g.font = `800 ${5.2 * ppm}px "Saira Semi Condensed", "Arial Narrow", sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = `800 ${6.0 * ppm}px "Saira Semi Condensed", "Arial Narrow", sans-serif`; g.letterSpacing = `${0.5 * ppm}px`;
    g.lineWidth = 0.18 * ppm; g.strokeStyle = "#5a0000"; g.fillStyle = "#ffffff";
    g.strokeText(word, 0, 0, 42 * ppm); g.fillText(word, 0, 0, 42 * ppm); g.restore();
  }
  // grass texture flecks
  for (let i = 0; i < 260000; i++) { const x = rand() * Wc, y = rand() * Hc; g.fillStyle = `rgba(${rand() < 0.5 ? "255,255,230" : "0,20,0"},${rand() * 0.06})`; g.fillRect(x, y, 1.5, 1.5); }
  // lines: 4-inch (0.1 m) white
  const lw = 0.1 * ppm; g.fillStyle = "#f4f4ef";
  const vline = (x, za, zb, w = lw) => g.fillRect(X(x) - w / 2, Z(za), w, (zb - za) * ppm);
  const hline = (z, xa, xb, w = lw) => g.fillRect(X(xa), Z(z) - w / 2, (xb - xa) * ppm, w);
  g.fillRect(X(-FIELD.end) - 0.6 * ppm, Z(-FIELD.half) - 0.6 * ppm, FIELD.L * ppm + 1.2 * ppm, 1.2 * ppm);       // 6-ft wide white border
  g.fillRect(X(-FIELD.end) - 0.6 * ppm, Z(FIELD.half) - 0.6 * ppm, FIELD.L * ppm + 1.2 * ppm, 1.2 * ppm);
  g.fillRect(X(-FIELD.end) - 0.6 * ppm, Z(-FIELD.half), 1.2 * ppm, FIELD.W * ppm); g.fillRect(X(FIELD.end) - 0.6 * ppm, Z(-FIELD.half), 1.2 * ppm, FIELD.W * ppm);
  for (let y = -50; y <= 50; y += 5) vline(y * YD, -FIELD.half, FIELD.half, y % 50 === 0 ? 0.2 * ppm : lw);
  // hash marks (NCAA: 60 ft from each sideline) and sideline ticks every yard
  const hz = FIELD.half - 60 * 0.3048;
  for (let y = -49; y <= 49; y++) { if (y % 5 === 0) continue; const x = y * YD;
    for (const z of [-hz, hz]) vline(x, z - 0.305, z + 0.305);
    vline(x, -FIELD.half + 0.1, -FIELD.half + 0.71); vline(x, FIELD.half - 0.71, FIELD.half - 0.1); }
  // two-point tries marks
  for (const s of [-1, 1]) hline(0, s * (FIELD.goal - 3 * YD) - 0.3, s * (FIELD.goal - 3 * YD) + 0.3);
  // numbers (6 ft tall, tops 9 yd from the sideline) with direction arrows
  g.font = `600 ${1.83 * ppm * 1.25}px "Saira Semi Condensed", "Arial Narrow", sans-serif`; g.textAlign = "center"; g.textBaseline = "alphabetic";
  for (let y = -40; y <= 40; y += 10) {
    const label = String(50 - Math.abs(y)), x = y * YD;
    for (const s of [1, -1]) {
      g.save(); g.translate(X(x), Z(s * (FIELD.half - 9 * YD + (s > 0 ? 1.83 : -1.83) * 0)) ); if (s < 0) g.rotate(Math.PI);
      g.fillStyle = "#f4f4ef"; g.fillText(label.split("").join(" "), 0, 1.83 * ppm);
      if (y !== 0) { const dir = (y < 0 ? -1 : 1) * (s < 0 ? -1 : 1), ax = dir * 2.2 * ppm; g.beginPath(); g.moveTo(ax + dir * 0.55 * ppm, 0.95 * ppm); g.lineTo(ax, 0.6 * ppm); g.lineTo(ax, 1.3 * ppm); g.fill(); }
      g.restore();
    }
  }
  // team-area boxes on both sidelines between the 25-yard lines
  g.strokeStyle = "#f4f4ef"; g.lineWidth = 0.1 * ppm; g.setLineDash([0.6 * ppm, 0.6 * ppm]);
  for (const s of [-1, 1]) { const z1 = s * (FIELD.half + 1.83), z2 = s * (FIELD.half + 7.3); g.strokeRect(X(-25 * YD), Z(Math.min(z1, z2)), 50 * YD * ppm, Math.abs(z2 - z1) * ppm); }
  g.setLineDash([]);
}

// ---------------------------------------------------------------- stand sweep
function pathPoints(step = 1.0) {   // rounded rectangle, counter-clockwise, with outward normals
  const { ax, az, rc } = BOWL, P = [], sx = ax - rc, sz = az - rc;
  const seg = (x0, z0, x1, z1, nx, nz) => { const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / step)); for (let i = 0; i < n; i++) P.push([x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n, nx, nz]); };
  // explicit order: east side (z = +az) going +x, NE corner, north end going −z, NW corner, west side going −x, SW corner, south end, SE corner
  seg(-sx, az, sx, az, 0, 1); arcCW(sx, sz, Math.PI / 2, 0);
  seg(ax, sz, ax, -sz, 1, 0); arcCW(sx, -sz, 0, -Math.PI / 2);
  seg(sx, -az, -sx, -az, 0, -1); arcCW(-sx, -sz, -Math.PI / 2, -Math.PI);
  seg(-ax, -sz, -ax, sz, -1, 0); arcCW(-sx, sz, Math.PI, Math.PI / 2);
  P.push(P[0]);
  return P;
  function arcCW(cx, cz, a0, a1) { const n = Math.round(rc * Math.PI / 2 / step); for (let i = 0; i < n; i++) { const a = a0 + (a1 - a0) * i / n; P.push([cx + rc * Math.cos(a), cz + rc * Math.sin(a), Math.cos(a), Math.sin(a)]); } }
}
function sweep(path, profile, material) {     // profile: [[d, y]] outward distance and height; flat-shaded strips
  const pos = [], uv = [], S = [0];
  for (let i = 1; i < path.length; i++) S.push(S[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  for (let i = 0; i < path.length - 1; i++) {
    const [x0, z0, nx0, nz0] = path[i], [x1, z1, nx1, nz1] = path[i + 1];
    for (let j = 0; j < profile.length - 1; j++) {
      const [d0, y0] = profile[j], [d1, y1] = profile[j + 1];
      const a = [x0 + nx0 * d0, y0, z0 + nz0 * d0], b = [x1 + nx1 * d0, y0, z1 + nz1 * d0], c = [x1 + nx1 * d1, y1, z1 + nz1 * d1], e = [x0 + nx0 * d1, y1, z0 + nz0 * d1];
      pos.push(...a, ...e, ...c, ...a, ...c, ...b);
      const u0 = S[i] / 2, u1 = S[i + 1] / 2, v0 = (y0 + d0) / 1, v1 = (y1 + d1) / 1;
      uv.push(u0, v0, u0, v1, u1, v1, u0, v0, u1, v1, u1, v0);
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  const m = new THREE.Mesh(g, material); m.castShadow = m.receiveShadow = true; return m;
}
function stepProfile(d0, y0, rows, tread, riser, front, back) {
  const p = [[d0, 0], [d0, y0 + front]];
  for (let k = 0; k < rows; k++) { p.push([d0 + k * tread, y0 + (k + 1) * riser], [d0 + (k + 1) * tread, y0 + (k + 1) * riser]); }
  const D = d0 + rows * tread, H = y0 + rows * riser;
  p.push([D, H + back], [D + 0.4, H + back], [D + 0.4, 0]);
  return p;
}

// ---------------------------------------------------------------- people
// ---------------------------------------------------------------- people
// Wisconsin home set (per the uniform diagram on Wikipedia, "Wisconsin badgers football unif.png"): white helmet with a
// cardinal facemask, cardinal jersey with white numbers and three white sleeve stripes, white pants with a cardinal side
// stripe, black socks and cleats. Logos (Motion W, conference and maker marks) are deliberately left off.
// Visitors: a generic white road set with navy trim, navy pants and helmet.
const KIT = {
  home: { jersey: CARDINAL, num: "#ffffff", numEdge: "#ffffff", sleeve: "#ffffff", collar: "#ffffff", pants: "#f4f4f2", stripe: CARDINAL, socks: "#151515", shoes: "#151515", helmet: "#f5f5f3", mask: "#a3070d", gloves: "#f2f2f2" },
  away: { jersey: "#f4f4f6", num: "#1d2a44", numEdge: "#1d2a44", sleeve: "#1d2a44", collar: "#1d2a44", pants: "#1d2a44", stripe: "#c9a227", socks: "#f2f2f2", shoes: "#f2f2f2", helmet: "#1d2a44", mask: "#9aa0a6", gloves: "#1d2a44" },
};
const ROSTER = { home: [62, 74, 55, 68, 77, 87, 16, 28, 11, 81, 2], away: [97, 92, 95, 99, 44, 52, 41, 23, 7, 31, 3] };   // OL×5, TE, QB, RB, WR×3 | DL×4, LB×3, DB×4
const SKIN = ["#5c3b28", "#8d5a3b", "#a8714a", "#c58c62", "#e0b08c", "#f0c9a5"];
const texCache = new Map();
function jerseyTex(kit, num) {      // torso wrap: number on front (u = 0.25) and back (u = 0.75), V-collar at the top front
  const key = `j${kit.jersey}${num}`; if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement("canvas"); c.width = 512; c.height = 256; const g = c.getContext("2d");
  g.fillStyle = kit.jersey; g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`; g.fillRect(Math.random() * 512, Math.random() * 256, 2, 2); }   // mesh texture
  g.fillStyle = kit.collar; g.beginPath(); g.moveTo(128 - 34, 0); g.lineTo(128, 40); g.lineTo(128 + 34, 0); g.lineTo(128 + 24, 0); g.lineTo(128, 26); g.lineTo(128 - 24, 0); g.fill();
  g.fillRect(0, 0, 512, 6);
  g.font = "800 112px 'Saira Semi Condensed', 'Arial Narrow', sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  for (const u of [128, 384]) { g.lineWidth = 6; g.strokeStyle = kit.numEdge; g.fillStyle = kit.num; g.fillText(String(num), u, 140, 150); g.strokeText(String(num), u, 140, 150); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; texCache.set(key, t); return t;
}
function sleeveTex(kit) {          // three stripes near the cuff
  const key = `s${kit.jersey}`; if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement("canvas"); c.width = 64; c.height = 128; const g = c.getContext("2d");
  g.fillStyle = kit.jersey; g.fillRect(0, 0, 64, 128); g.fillStyle = kit.sleeve; for (const y of [84, 98, 112]) g.fillRect(0, y, 64, 7);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; texCache.set(key, t); return t;
}
function pantsTex(kit, side) {     // side stripe on the outer seam only (u = 0 is +z, u = 0.5 is −z)
  const key = `p${kit.pants}${side}`; if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement("canvas"); c.width = 128; c.height = 64; const g = c.getContext("2d");
  g.fillStyle = kit.pants; g.fillRect(0, 0, 128, 64); g.fillStyle = kit.stripe;
  const u = side > 0 ? 0 : 64; g.fillRect(u - 3, 0, 6, 64); if (u === 0) g.fillRect(125, 0, 3, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; texCache.set(key, t); return t;
}
const lathe = (pts, seg = 20) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
export function makePlayer(team, idx, role) {
  const kit = KIT[team], num = ROSTER[team][idx % 11], line = role === "line" || (role === undefined && (team === "home" ? idx < 5 : idx < 4));
  const W = line ? 1.16 : 1.0;                                       // linemen are broader
  const g = new THREE.Group(), m = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.65, metalness: 0.02, ...o });
  const skin = m(SKIN[(idx * 7 + (team === "home" ? 1 : 4)) % SKIN.length], { roughness: 0.55 });
  const mesh = (geo, mat, parent, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };
  // hips and upper body pivot (for a crouch)
  const blob = new THREE.Mesh(contactGeo, contactMat); blob.scale.set(1.1 * W, 1, 1.1 * W); blob.position.y = 0.012; blob.renderOrder = 1; g.add(blob);
  const hips = new THREE.Group(); hips.position.y = 0.98; g.add(hips);
  const upper = new THREE.Group(); hips.add(upper);
  // legs: thigh group at the hip, shin group at the knee
  const legs = [];
  for (const s of [-1, 1]) {
    const thigh = new THREE.Group(); thigh.position.set(0, 0, s * 0.11 * W); hips.add(thigh);
    mesh(lathe([[0.001, -0.47], [0.07, -0.46], [0.085, -0.3], [0.095, -0.12], [0.1, 0], [0.001, 0.02]]), m("#fff", { map: pantsTex(kit, s) }), thigh).scale.set(W, 1, W);
    mesh(new THREE.SphereGeometry(0.075, 14, 10), m(kit.pants), thigh, 0.02, -0.44, 0).scale.set(1, 0.8, 0.95);   // knee pad
    const shin = new THREE.Group(); shin.position.y = -0.46; thigh.add(shin);
    mesh(lathe([[0.001, -0.44], [0.045, -0.43], [0.05, -0.3], [0.065, -0.16], [0.06, -0.04], [0.065, 0], [0.001, 0.01]]), m(kit.socks), shin).scale.set(W, 1, W);
    const shoe = mesh(new THREE.CapsuleGeometry(0.055, 0.17, 4, 10).rotateZ(Math.PI / 2), m(kit.shoes, { roughness: 0.4 }), shin, 0.05, -0.47, 0); shoe.scale.set(1, 0.75, 0.95 * W);
    legs.push({ thigh, shin });
  }
  mesh(new THREE.SphereGeometry(0.17, 18, 12), m(kit.pants), hips, 0, -0.02, 0).scale.set(0.82 * W, 0.7, 1.12 * W);      // seat of the pants
  mesh(new THREE.CylinderGeometry(0.17, 0.16, 0.06, 18), m("#1a1a1a"), hips, 0, 0.06, 0).scale.set(0.8 * W, 1, 1.1 * W); // belt
  // torso: jersey stretched over shoulder pads
  const torso = mesh(new THREE.CylinderGeometry(0.2, 0.165, 0.56, 28, 1, true), m("#fff", { map: jerseyTex(kit, num), side: THREE.DoubleSide }), upper, 0, 0.36, 0);
  torso.scale.set(0.72 * W, 1, 1.18 * W); torso.userData.torso = true;
  const padsM = m(kit.jersey);
  mesh(new THREE.SphereGeometry(0.2, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), padsM, upper, 0, 0.6, 0).scale.set(0.8 * W, 0.45, 1.5 * W);   // pads under jersey
  for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(0.1, 14, 10), padsM, upper, 0, 0.6, s * 0.24 * W).scale.set(1.05, 0.75, 1.0);     // shoulder caps
  // neck and head in helmet
  mesh(new THREE.CylinderGeometry(0.06, 0.065, 0.1, 12), skin, upper, 0.0, 0.7, 0);
  const helm = new THREE.Group(); helm.position.set(0.01, 0.84, 0); upper.add(helm);
  const shellM = m(kit.helmet, { roughness: 0.25, metalness: 0.15 });
  mesh(new THREE.SphereGeometry(0.135, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.68), shellM, helm).scale.set(1.12, 1.0, 0.98);
  mesh(new THREE.SphereGeometry(0.11, 16, 12), skin, helm, 0.03, -0.02, 0);                  // face behind the mask
  const maskM = m(kit.mask, { roughness: 0.35, metalness: 0.4 });
  for (const [y, r] of [[-0.005, 0.15], [-0.05, 0.145], [-0.095, 0.12]]) { const bar = mesh(new THREE.TorusGeometry(r, 0.008, 6, 20, Math.PI * 0.75), maskM, helm, 0, y, 0); bar.rotation.set(Math.PI / 2, 0, -Math.PI * 0.375); }
  const vbar = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 6), maskM, helm, 0.145, -0.05, 0);
  for (const s of [-1, 1]) mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.01, 12).rotateX(Math.PI / 2), m("#d9d9d9"), helm, -0.01, -0.03, s * 0.132);   // ear holes
  mesh(new THREE.TorusGeometry(0.07, 0.008, 6, 14, Math.PI), m("#e8e8e8"), helm, 0.06, -0.12, 0).rotation.set(Math.PI / 2, 0, Math.PI / 2);   // chin strap
  // arms: shoulder group, elbow group
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(0, 0.6, s * 0.29 * W); upper.add(sh);
    const sleeve = mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.2, 14, 1, true), m("#fff", { map: sleeveTex(kit), side: THREE.DoubleSide }), sh, 0, -0.1, 0); sleeve.scale.set(W, 1, W);
    mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.12, 12), skin, sh, 0, -0.25, 0).scale.set(W, 1, W);
    const el = new THREE.Group(); el.position.y = -0.3; sh.add(el); el.rotation.z = 0.35;
    mesh(new THREE.CylinderGeometry(0.048, 0.04, 0.26, 12), skin, el, 0, -0.13, 0).scale.set(W, 1, W);
    mesh(new THREE.SphereGeometry(0.05, 12, 8), m(kit.gloves), el, 0, -0.29, 0).scale.set(0.9, 1.15, 0.7);
    sh.rotation.x = s * 0.12; arms.push(sh);
  }
  // stance: linemen crouch, skill players stand ready
  const hip = line ? 0.55 : 0.18, lean = line ? -0.55 : -0.12;
  upper.rotation.z = lean; for (const L of legs) { L.thigh.rotation.z = hip; L.shin.rotation.z = -hip * 1.6; }
  g.position.y = 0; hips.position.y = 0.98 - (line ? 0.13 : 0.02);
  g.userData = { legL: legs[0].thigh, legR: legs[1].thigh, shinL: legs[0].shin, shinR: legs[1].shin, armL: arms[0], armR: arms[1], upper, hip, lean, phase: rand() * 6, num };
  return g;
}
export function lemonGeometry(a, b, seg = 40) {
  const R = (a * a + b * b) / (2 * b), d = R - b, pts = [];
  for (let i = 0; i <= 32; i++) { const x = -a + 2 * a * i / 32; pts.push(new THREE.Vector2(Math.max(1e-4, Math.sqrt(R * R - x * x) - d), x)); }
  return new THREE.LatheGeometry(pts, seg);     // long axis along y
}
export function ballTexture() {     // pebbled leather with white NCAA stripes and laces
  return canvasTex(512, 256, (g, W, H) => {
    g.fillStyle = "#7a3b1c"; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 9000; i++) { const k = rand(); g.fillStyle = `rgba(${k < 0.5 ? "40,14,4" : "170,90,50"},${0.25 + rand() * 0.3})`; g.beginPath(); g.arc(rand() * W, rand() * H, 1 + rand() * 1.4, 0, 7); g.fill(); }
    g.fillStyle = "#f3f1ea"; g.fillRect(0, H * 0.17, W * 0.5, H * 0.05); g.fillRect(0, H * 0.78, W * 0.5, H * 0.05);
    g.fillStyle = "#2a1306"; for (const u of [0, 0.25, 0.5, 0.75]) g.fillRect(u * W - 1, 0, 2, H);
    g.fillStyle = "#f8f6f0"; g.fillRect(W * 0.115, H * 0.36, 6, H * 0.28); for (let i = 0; i < 8; i++) g.fillRect(W * 0.09, H * (0.38 + i * 0.033), W * 0.06, 4);
  });
}

// ---------------------------------------------------------------- the neighbourhood (approximate, from campus maps)
function addSurroundings(scene, W, mark, glassM) {
  const asphalt = mat("#3d3f42", { roughness: 0.95 }), walk = mat("#b9b5ac", { roughness: 0.95 }), paint = new THREE.MeshBasicMaterial({ color: "#d9c25a" });
  const road = (x0, z0, x1, z1, w, m = asphalt, name) => {
    const L = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(z1 - z0, x1 - x0);
    const r = new THREE.Mesh(new THREE.PlaneGeometry(L, w).rotateX(-Math.PI / 2), m); r.position.set((x0 + x1) / 2, 0.01, (z0 + z1) / 2); r.rotation.y = -a; r.receiveShadow = true; scene.add(r);
    if (m === asphalt) { const c = new THREE.Mesh(new THREE.PlaneGeometry(L, 0.15).rotateX(-Math.PI / 2), paint); c.position.set((x0 + x1) / 2, 0.02, (z0 + z1) / 2); c.rotation.y = -a; scene.add(c); }
    if (name) mark(name, x0 + (x1 - x0) * 0.82, 2, z0 + (z1 - z0) * 0.82);
  };
  road(152, -330, 152, 330, 12, asphalt, "Engineering Drive");
  road(-178, -330, -178, 330, 14, asphalt, "South street");
  road(-330, -100, 330, -100, 11, asphalt, "West street");
  road(-330, 150, 330, 150, 12, asphalt, "North avenue");
  road(-160, 150, -330, -20, 12, asphalt, "Diagonal street");
  road(132, -100, 132, 150, 5, walk, "Stadium walkway");
  // parked cars along the kerbs (instanced body + cabin, varied paint), and lane markings are on the road texture
  { const spots = []; const along = (x0, z0, x1, z1, off, gap) => { const L = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / L, uz = (z1 - z0) / L;
      for (let t = 8; t < L - 8; t += gap) { if (rand() < 0.22) continue; for (const sd of [-1, 1]) if (rand() > 0.15) spots.push([x0 + ux * t - uz * off * sd, z0 + uz * t + ux * off * sd, Math.atan2(ux, uz)]); } };
    along(152, -330, 152, 330, 4.6, 6.2); along(-178, -330, -178, 330, 5.4, 6.2); along(-330, -100, 330, -100, 4.2, 6.2); along(-330, 150, 330, 150, 4.6, 6.2);
    const kept = spots.filter(([x, z]) => Math.abs(x) > 128 || Math.abs(z) > 100);       // not inside the stadium block
    const bodyG = new THREE.BoxGeometry(1.8, 0.75, 4.5); bodyG.translate(0, 0.55, 0);
    const cabG = new THREE.BoxGeometry(1.6, 0.6, 2.4); cabG.translate(0, 1.2, -0.2);
    const paintM = new THREE.MeshPhysicalMaterial({ color: "#ffffff", metalness: 0.5, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.1 });
    const cabM = new THREE.MeshPhysicalMaterial({ color: "#1d242b", metalness: 0.3, roughness: 0.1, clearcoat: 1 });
    const bi = new THREE.InstancedMesh(bodyG, paintM, kept.length), ci = new THREE.InstancedMesh(cabG, cabM, kept.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
    const cols = ["#f2f2f0", "#1c1f24", "#8a9097", "#b3b8bd", "#7a0d12", "#2c4a6e", "#d9d6cf", "#3f4a3c"];
    kept.forEach(([x, z, a], i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a); m4.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(1, 1, 0.9 + rand() * 0.2));
      bi.setMatrixAt(i, m4); ci.setMatrixAt(i, m4); bi.setColorAt(i, col.set(cols[Math.floor(rand() * cols.length)])); });
    bi.castShadow = ci.castShadow = true; scene.add(bi, ci); }
  // Camp Randall Memorial Park and Arch at the north-east corner (Randall Avenue)
  const park = new THREE.Mesh(new THREE.PlaneGeometry(36, 60).rotateX(-Math.PI / 2), mat("#5f7a4a", { roughness: 1 })); park.position.set(126, -0.02, 112); park.receiveShadow = true; scene.add(park);
  mark("Memorial park", 120, 3, 112);
  { const sh = new THREE.Shape(); sh.moveTo(-7, 0); sh.lineTo(7, 0); sh.lineTo(7, 11); sh.lineTo(-7, 11); sh.lineTo(-7, 0);
    const hole = new THREE.Path(); hole.moveTo(-3, 0); hole.lineTo(3, 0); hole.lineTo(3, 5.5); hole.absarc(0, 5.5, 3, 0, Math.PI, false); hole.lineTo(-3, 0); sh.holes.push(hole);
    const stone = mat("#cbc2ab", { roughness: 0.85 });
    const g = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 3.5, bevelEnabled: false }), stone); g.position.set(140, 0, 138); g.rotation.y = Math.PI / 2; g.castShadow = g.receiveShadow = true; scene.add(g);
    const cor = new THREE.Mesh(new THREE.BoxGeometry(4.3, 1, 15), stone); cor.position.set(141.8, 11.5, 138); cor.castShadow = true; scene.add(cor);
    mark("Memorial arch", 142, 15, 138); }
  // engineering campus north of Engineering Drive
  const block = (x0, x1, z0, z1, h, m, name) => { const b = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, h, z1 - z0), m); b.position.set((x0 + x1) / 2, h / 2, (z0 + z1) / 2); b.castShadow = b.receiveShadow = true; scene.add(b); if (name) mark(name, (x0 + x1) / 2, h + 4, (z0 + z1) / 2); return b; };
  const bandBrick = (w, h) => { const c = document.createElement("canvas"); c.width = 256; c.height = 256; const g = c.getContext("2d");
    g.drawImage(brickTex.image, 0, 0); g.fillStyle = "#2a3540"; for (let y = 30; y < 256; y += 64) g.fillRect(0, y, 256, 22); g.fillStyle = "#d9cfb8"; for (let y = 26; y < 256; y += 64) g.fillRect(0, y, 256, 4);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(w / 8, h / 16); t.colorSpace = THREE.SRGBColorSpace; return mat("#ffffff", { map: t, roughness: 0.85 }); };
  block(166, 192, -90, 60, 22, bandBrick(150, 22), "Engineering Hall (home of CBE)");
  block(192, 250, 20, 46, 18, bandBrick(60, 18));
  block(168, 198, 82, 142, 18, bandBrick(60, 18), "Mechanical Engineering");
  block(176, 228, 176, 246, 24, mat("#9fb3c2", { roughness: 0.15, metalness: 0.5 }), "Engineering Centers Building");
  block(210, 244, -60, -10, 30, bandBrick(50, 30), "Engineering Research Building");
  // white barrel-vaulted practice halls east of the stadium: McClain Center (north) and the Shell (south)
  const vault = (x0, x1, z0, z1, h, name) => { const L = x1 - x0, w = z1 - z0, r = w / 2;
    const v = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 48, 1, false, -Math.PI / 2, Math.PI).rotateZ(Math.PI / 2), mat("#f1f1ee", { roughness: 0.45 }));
    v.scale.set(1, h / r, 1); v.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2); v.castShadow = v.receiveShadow = true; scene.add(v);
    const base = new THREE.Mesh(new THREE.BoxGeometry(L, 3, w), mat("#8f8a82")); base.position.set((x0 + x1) / 2, 1.5, (z0 + z1) / 2); scene.add(base);
    mark(name, (x0 + x1) / 2, h + 5, (z0 + z1) / 2); };
  vault(0, 104, 86, 140, 22, "Indoor practice facility");
  vault(-130, -24, 86, 140, 20, "Indoor sports center");
  // south-east: long white apartment block beyond Regent Street
  block(-222, -200, 40, 190, 30, mat("#ecebe6", { roughness: 0.6 }));
  // houses: west of Breese Terrace and south of Regent Street (gabled, instanced)
  const lots = [];
  for (let x = -160; x <= 140; x += 17) for (let z = -116; z >= -330; z -= 21) lots.push([x, z]);
  for (let x = -192; x >= -330; x -= 19) for (let z = -300; z <= 330; z += 17) if (!(z > 30 && z < 200 && x > -232)) lots.push([x, z]);
  const n = lots.length, bodyG = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), roofG = new THREE.CylinderGeometry(0.62, 0.62, 1, 3).rotateX(-Math.PI / 2);   // triangular prism, ridge along z
  const bodies = new THREE.InstancedMesh(bodyG, mat("#ffffff", { roughness: 0.8 }), n), roofs = new THREE.InstancedMesh(roofG, mat("#ffffff", { roughness: 0.7 }), n);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color(), wall = ["#e8e2d4", "#c9b79a", "#9db0bf", "#b9584a", "#f2efe8", "#8e9c7e", "#d6c9a9"], rf = ["#3e3a37", "#5a4636", "#55595e", "#6b2f2a"];
  lots.forEach(([x, z], i) => { const w = 8 + rand() * 4, d = 10 + rand() * 4, h = 6 + rand() * 3, yaw = (rand() < 0.5 ? 0 : Math.PI / 2) + (rand() - 0.5) * 0.05;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    m4.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(w, h, d)); bodies.setMatrixAt(i, m4); bodies.setColorAt(i, col.set(wall[i % wall.length]));
    m4.compose(new THREE.Vector3(x, h + 1.24, z), q, new THREE.Vector3(w * 1.0, 4, d * 1.05)); roofs.setMatrixAt(i, m4); roofs.setColorAt(i, col.set(rf[i % rf.length])); });
  bodies.castShadow = bodies.receiveShadow = roofs.castShadow = true; scene.add(bodies, roofs);
  mark("Neighbourhood houses", -20, 14, -170);
  // trees: the park, the street edges, Badger Way
  const spots = [];
  for (let i = 0; i < 25; i++) spots.push([112 + rand() * 30, 86 + rand() * 54]);
  for (let x = -160; x <= 140; x += 12) { spots.push([x, -94 + rand() * 2]); spots.push([x, -107 - rand() * 2]); }
  for (let z = -90; z <= 145; z += 14) spots.push([158, z + 5]);
  for (let z = -300; z <= 330; z += 15) spots.push([-187, z]);
  for (let x = -160; x <= 140; x += 13) spots.push([x, 158]);
  const tg = new THREE.IcosahedronGeometry(1, 3), tpos = tg.attributes.position, tv = new THREE.Vector3();
  for (let i = 0; i < tpos.count; i++) { tv.fromBufferAttribute(tpos, i); const k = 1 + 0.08 * Math.sin(tv.x * 5.1 + tv.y * 3.7) * Math.cos(tv.z * 4.3 - tv.y * 2.1); tpos.setXYZ(i, tv.x * k, tv.y * k, tv.z * k); }
  tg.computeVertexNormals();     // lumpy crown instead of a faceted ball
  const tm = withDetail(mat("#ffffff"), GRASS, [3, 3], 1.2), inst = new THREE.InstancedMesh(tg, tm, spots.length);
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.28, 1, 8).translate(0, 0.5, 0), mat("#4a3b2e", { roughness: 0.95 }), spots.length);
  spots.forEach(([x, z], i) => { const s = 3.5 + ((i * 7919) % 100) / 100 * 3; m4.compose(new THREE.Vector3(x, 0, z), q.identity(), new THREE.Vector3(1 + s * 0.12, s * 1.1, 1 + s * 0.12)); trunks.setMatrixAt(i, m4); });
  trunks.castShadow = true; scene.add(trunks);
  const greens = ["#4b6b3a", "#5d7a3f", "#3f5c33", "#6a7f45", "#56703c"];
  spots.forEach(([x, z], i) => { const s = 3.5 + ((i * 7919) % 100) / 100 * 3, rot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 6.28);
    m4.compose(new THREE.Vector3(x, s * 1.1 + s * 0.95, z), rot, new THREE.Vector3(s * (0.9 + rand() * 0.25), s * (1.0 + rand() * 0.3), s * (0.9 + rand() * 0.25))); inst.setMatrixAt(i, m4);
    inst.setColorAt(i, col.set(greens[Math.floor(rand() * greens.length)])); });
  inst.castShadow = true; scene.add(inst);
}

// ---------------------------------------------------------------- the world
export function buildWorld(scene) {
  const W = {};
  // ground around the stadium
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400).rotateX(-Math.PI / 2), withDetail(mat("#56634a"), GRASS, [350, 350], 0.9));
  ground.position.y = -0.05; ground.receiveShadow = true; scene.add(ground);
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(300, 186).rotateX(-Math.PI / 2), withDetail(mat("#8f8c86", { map: concreteTex }), CONC, [75, 46], 0.7));
  plaza.position.set(-2, -0.03, -7); plaza.receiveShadow = true; scene.add(plaza);
  // field: 128 m × 66 m canvas at 24 px/m
  const ppm = 24, FX = 128, FZ = 66;
  const fc = document.createElement("canvas"); fc.width = FX * ppm; fc.height = FZ * ppm;
  drawField(fc.getContext("2d"), fc.width, fc.height, ppm, -FX / 2, -FZ / 2);
  const ftex = new THREE.CanvasTexture(fc); ftex.colorSpace = THREE.SRGBColorSpace; ftex.anisotropy = 16;
  W.fieldMat = withDetail(mat("#ffffff", { map: ftex }), TURF, [128, 66], 0.55);   // blade grain at about 1 m per tile
  W.thermalCanvas = document.createElement("canvas"); W.thermalCanvas.width = 128; W.thermalCanvas.height = 66;
  W.thermalTex = new THREE.CanvasTexture(W.thermalCanvas); W.thermalTex.colorSpace = THREE.SRGBColorSpace; W.thermalTex.magFilter = THREE.LinearFilter;
  W.thermalMat = new THREE.MeshBasicMaterial({ map: W.thermalTex });
  W.field = new THREE.Mesh(new THREE.PlaneGeometry(FX, FZ).rotateX(-Math.PI / 2), W.fieldMat); W.field.receiveShadow = true; scene.add(W.field);
  W.fieldSize = [FX, FZ];
  // lower bowl: one continuous ring of 46 rows, grey concrete with aluminium bleachers
  const path = pathPoints(1.0);
  const concM = withDetail(mat("#c9c7c1", { map: concreteTex, side: THREE.DoubleSide }), CONC, [1, 1], 0.6);
  scene.add(sweep(path, stepProfile(0, BOWL.h0, BOWL.rows, BOWL.tread, BOWL.riser, 0, 1.1), concM));
  scene.add(sweep(path, [[-0.25, 0], [-0.25, BOWL.h0 + 0.3], [0.02, BOWL.h0 + 0.3]], mat("#b9b7b1", { side: THREE.DoubleSide })));
  scene.add(sweep(path, [[-0.3, 0.15], [-0.3, 1.15]], mat(CARDINAL, { roughness: 0.6, side: THREE.DoubleSide })));          // red wall padding
  // galvanised handrail on the front wall: top rail, mid rail and posts every 2 m
  { const railM = mat("#aeb4b9", { metalness: 0.9, roughness: 0.35 }), yT = BOWL.h0 + 1.25;
    scene.add(sweep(path, [[-0.12, yT - 0.05], [-0.12, yT]], railM)); scene.add(sweep(path, [[-0.12, yT - 0.5], [-0.12, yT - 0.47]], railM));
    const posts = path.filter((_, i) => i % 2 === 0), pg = new THREE.CylinderGeometry(0.025, 0.025, 0.95, 6), pi = new THREE.InstancedMesh(pg, railM, posts.length), m4 = new THREE.Matrix4();
    posts.forEach(([x, z, nx, nz], i) => { m4.makeTranslation(x - nx * 0.12, BOWL.h0 + 0.3 + 0.475, z - nz * 0.12); pi.setMatrixAt(i, m4); }); scene.add(pi); }
  scene.add(sweep(pathPoints(2), [[BOWL.D + 0.5, 0], [BOWL.D + 0.5, BOWL.H + 1.4]], withDetail(mat("#bdbab3", { map: concreteTex, side: THREE.DoubleSide }), CONC, [1, 1], 0.6)));
  // aisles every ~ 14 m
  { const aisleM = mat("#e2e0db"); const gA = new THREE.BoxGeometry(1.1, 0.08, 1); const n = Math.floor(path.length / 14);
    const inst = new THREE.InstancedMesh(gA, aisleM, n * BOWL.rows), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(); let k = 0;
    for (let i = 0; i < n; i++) { const [x, z, nx, nz] = path[i * 14]; q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(nx, nz));
      for (let r = 0; r < BOWL.rows; r++) { const d = (r + 0.5) * BOWL.tread; m4.compose(new THREE.Vector3(x + nx * d, BOWL.h0 + (r + 1) * BOWL.riser + 0.04, z + nz * d), q, new THREE.Vector3(1, 1, BOWL.tread)); inst.setMatrixAt(k++, m4); } }
    inst.receiveShadow = true; scene.add(inst); W.aisleIdx = new Set(); for (let i = 0; i < n; i++) for (let j = -1; j <= 1; j++) W.aisleIdx.add(i * 14 + j); }
  const sub = (test, step = 1) => pathPoints(step).filter(p => test(p[2], p[3]));
  const glassM = new THREE.MeshPhysicalMaterial({ color: "#2c3e4f", roughness: 0.05, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05, reflectivity: 0.9, envMapIntensity: 1.6 });
  W.landmarks = [];
  const mark = (name, x, y, z) => W.landmarks.push([name, new THREE.Vector3(x, y, z)]);
  // ---- west upper deck (1966) overhanging the lower bowl, white back shell, cream fascia with the stadium name
  const deckPath = sub((nx, nz) => nz < -0.55);
  W.deckPath = deckPath;
  { const prof = [[BOWL.D + 0.3, 0], [BOWL.D + 0.3, BOWL.H + 1.0], [DECK.d0, DECK.y0]];
    for (const p of stepProfile(DECK.d0, DECK.y0 + DECK.fascia, DECK.rows, DECK.tread, DECK.riser, 0, 1.4).slice(1, -1)) prof.push(p);
    prof.push([DECK.Db + 0.6, DECK.Hb + 1.4], [DECK.Db + 0.6, 0]);
    scene.add(sweep(deckPath, prof, withDetail(mat("#dcdad4", { map: concreteTex, side: THREE.DoubleSide }), CONC, [1, 1], 0.6)));
    // fascia strip with lettering (canvas mapped along the deck length)
    let L = 0; for (let i = 1; i < deckPath.length; i++) L += Math.hypot(deckPath[i][0] - deckPath[i - 1][0], deckPath[i][1] - deckPath[i - 1][1]);
    const fc = document.createElement("canvas"); fc.width = 4096; fc.height = 64; const g = fc.getContext("2d");
    g.fillStyle = "#e8dfc6"; g.fillRect(0, 0, 4096, 64); g.fillStyle = "#a3070d"; g.font = "700 40px 'Saira Semi Condensed', 'Arial Narrow', sans-serif"; g.textBaseline = "middle"; g.textAlign = "center";
    const items = ["35 AMECHE", "80 SCHREINER", "GAMEDAY CHEME", "40 HIRSCH", "33 DAYNE", "83 SHAFER", "88 RICHTER"];
    items.forEach((t, i) => g.fillText(t, 4096 * (i + 0.5) / items.length, 34));
    const ft = new THREE.CanvasTexture(fc); ft.colorSpace = THREE.SRGBColorSpace; ft.wrapS = THREE.RepeatWrapping; ft.repeat.set(-2 / L, 1); ft.anisotropy = 8;
    const fas = sweep(deckPath, [[DECK.d0 - 0.06, DECK.y0], [DECK.d0 - 0.06, DECK.y0 + DECK.fascia]], new THREE.MeshStandardMaterial({ map: ft, roughness: 0.7, side: THREE.DoubleSide }));
    const uv = fas.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) > DECK.y0 + DECK.d0 + 1 ? 1 : 0); uv.needsUpdate = true; scene.add(fas);
    // concourse openings under the deck (dark band across the back of the lower bowl)
    scene.add(sweep(deckPath, [[BOWL.D + 0.25, BOWL.H + 1.0], [BOWL.D + 0.25, DECK.y0 - 0.3]], mat("#3a3d42", { side: THREE.DoubleSide })));
  }
  // press box on top of the upper deck: three glass levels, light banks on the roof
  const pzc = -(BOWL.az + (PRESS.d0 + PRESS.d1) / 2);
  { const body = new THREE.Mesh(new THREE.BoxGeometry(2 * PRESS.x, PRESS.y1 - PRESS.y0, PRESS.d1 - PRESS.d0), mat("#e4e3df", { roughness: 0.5 })); body.position.set(0, (PRESS.y0 + PRESS.y1) / 2, pzc); body.castShadow = body.receiveShadow = true; scene.add(body);
    for (const y of [PRESS.y0 + 1.8, PRESS.y0 + 5.0, PRESS.y0 + 8.2]) { const gl = new THREE.Mesh(new THREE.BoxGeometry(2 * PRESS.x - 0.6, 2.4, 0.3), glassM); gl.position.set(0, y, pzc + (PRESS.d1 - PRESS.d0) / 2 + 0.05); scene.add(gl); }
    { const n = Math.floor(2 * PRESS.x / 1.5), mg = new THREE.BoxGeometry(0.12, 2.5, 0.12), mi = new THREE.InstancedMesh(mg, mat("#cfd3d6", { metalness: 0.8, roughness: 0.3 }), n * 3), m4 = new THREE.Matrix4(); let k = 0;
      for (const y of [PRESS.y0 + 1.8, PRESS.y0 + 5.0, PRESS.y0 + 8.2]) for (let i = 0; i < n; i++) { m4.makeTranslation(-PRESS.x + 0.75 + i * 1.5, y, pzc + (PRESS.d1 - PRESS.d0) / 2 + 0.25); mi.setMatrixAt(k++, m4); }
      scene.add(mi); }
    mark("Upper deck and press box", 0, PRESS.y1 + 9, pzc); }
  // ---- east rim suites (2005): glass face to the field, dark roof, brick with arches toward Randall Avenue
  const eastPath = sub((nx, nz) => nz > 0.55);
  scene.add(sweep(eastPath, [[EAST.d0, BOWL.H + 1.2], [EAST.d0, EAST.y]], glassM));
  { const t = seamTex("#8d939a", "#5e646b", 2); t.colorSpace = THREE.SRGBColorSpace;
    scene.add(sweep(eastPath, [[EAST.d0 - 0.3, EAST.y], [EAST.d1 + 0.3, EAST.y]], mat("#ffffff", { map: t, metalness: 0.55, roughness: 0.42, side: THREE.DoubleSide })));
    scene.add(sweep(eastPath, [[EAST.d0 - 0.3, EAST.y], [EAST.d0 - 0.3, EAST.y + 1.1]], mat("#c9c7c1", { side: THREE.DoubleSide })));   // parapet
    const units = eastPath.filter((_, i) => i % 9 === 4), ug = new THREE.BoxGeometry(3.2, 1.8, 2.6), um = mat("#b8bcc0", { metalness: 0.4, roughness: 0.5 }), ui = new THREE.InstancedMesh(ug, um, units.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    units.forEach(([x, z, nx, nz], i) => { const d = (EAST.d0 + EAST.d1) / 2 + 2; q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(nx, nz)); m4.compose(new THREE.Vector3(x + nx * d, EAST.y + 0.9, z + nz * d), q, new THREE.Vector3(1, 1, 1)); ui.setMatrixAt(i, m4); });
    ui.castShadow = true; scene.add(ui); }
  scene.add(sweep(eastPath, [[EAST.d1, EAST.y], [EAST.d1, 0]], arch(0.25, 1 / 15.5, { side: THREE.DoubleSide })));
  scene.add(sweep(eastPath, [[EAST.d0, BOWL.H + 1.2], [EAST.d1, BOWL.H + 1.2]], mat("#3a3d42", { side: THREE.DoubleSide })));
  mark("East suites", 0, EAST.y + 8, BOWL.az + (EAST.d0 + EAST.d1) / 2);
  // ---- north: Student-Athlete Performance Center, a curved brick arcade of tall arches, video board on top
  const northPath = sub((nx, nz) => nx > 0.55);
  scene.add(sweep(northPath, [[NORTH.d1, 0], [NORTH.d1, NORTH.y]], arch(0.25, 1 / NORTH.y, { side: THREE.DoubleSide })));
  { const t = seamTex("#d9d3c3", "#b3ad9f", 1, 3); t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(1, 0.25);
    scene.add(sweep(northPath, [[NORTH.d0, NORTH.y], [NORTH.d1 + 0.3, NORTH.y]], withDetail(mat("#ffffff", { map: t, side: THREE.DoubleSide }), CONC, [1, 1], 0.5)));
    scene.add(sweep(northPath, [[NORTH.d1 + 0.3, NORTH.y], [NORTH.d1 + 0.3, NORTH.y + 1.1]], mat("#c9c7c1", { side: THREE.DoubleSide })));
    // flags along the north rim: cardinal and white
    const fm = [mat(CARDINAL, { side: THREE.DoubleSide, roughness: 0.8 }), mat("#f4f2ec", { side: THREE.DoubleSide, roughness: 0.8 })], poleM = mat("#c7ccd0", { metalness: 0.8, roughness: 0.3 });
    northPath.filter((_, i) => i % 10 === 5).forEach(([x, z, nx, nz], i) => { const px = x + nx * (NORTH.d1 + 0.1), pz = z + nz * (NORTH.d1 + 0.1);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 9, 8), poleM); pole.position.set(px, NORTH.y + 4.5, pz); scene.add(pole);
      const fg = new THREE.PlaneGeometry(2.6, 1.6, 8, 1), fp = fg.attributes.position; for (let k = 0; k < fp.count; k++) fp.setZ(k, 0.18 * Math.sin((fp.getX(k) + 1.3) * 2.4));
      fg.computeVertexNormals(); const f = new THREE.Mesh(fg, fm[i % 2]); f.position.set(px, NORTH.y + 8.0, pz - 1.3); f.rotation.y = Math.PI / 2; f.castShadow = true; scene.add(f); }); }
  mark("North end building", BOWL.ax + NORTH.d1, NORTH.y + 26, 0);
  // video board (50 × 170 ft) over the north end, facing the field
  const sbC = document.createElement("canvas"); sbC.width = 1536; sbC.height = 443;
  const sbT = new THREE.CanvasTexture(sbC); sbT.colorSpace = THREE.SRGBColorSpace;
  const sbx = BOWL.ax + BOWL.D + 2.5, sby = NORTH.y + 9;
  { const fr = new THREE.Mesh(new THREE.BoxGeometry(1.6, 16.5, 54), mat("#1e2125", { metalness: 0.4 })); fr.position.set(sbx, sby, 0); fr.castShadow = true; scene.add(fr);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(52, 15), new THREE.MeshBasicMaterial({ map: sbT, toneMapped: false })); scr.rotation.y = -Math.PI / 2; scr.position.set(sbx - 0.82, sby, 0); scene.add(scr);
    // outward face: an LED board. Text is drawn at the LED grid resolution, then each LED is a round dot on a black face.
    const NX = 260, NY = 75, src = document.createElement("canvas"); src.width = NX; src.height = NY; const sg = src.getContext("2d");
    const grd = sg.createLinearGradient(0, 0, 0, NY); grd.addColorStop(0, "#7a0408"); grd.addColorStop(1, "#c5050c"); sg.fillStyle = grd; sg.fillRect(0, 0, NX, NY);
    sg.fillStyle = "#ffffff"; sg.textAlign = "center"; sg.textBaseline = "middle"; sg.font = "700 17px 'Saira Semi Condensed', 'Arial Narrow', sans-serif"; sg.fillText("HOME OF THE", NX / 2, NY * 0.33);
    sg.font = "800 22px 'Saira Semi Condensed', 'Arial Narrow', sans-serif"; sg.fillText("WISCONSIN BADGERS", NX / 2, NY * 0.68);
    const px = sg.getImageData(0, 0, NX, NY).data, P = 6, bc = document.createElement("canvas"); bc.width = NX * P; bc.height = NY * P; const g = bc.getContext("2d");
    g.fillStyle = "#050607"; g.fillRect(0, 0, bc.width, bc.height);
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const k = 4 * (j * NX + i); g.fillStyle = `rgb(${px[k]},${px[k + 1]},${px[k + 2]})`; g.beginPath(); g.arc(i * P + P / 2, j * P + P / 2, P * 0.36, 0, 7); g.fill(); }
    const bt = new THREE.CanvasTexture(bc); bt.colorSpace = THREE.SRGBColorSpace; bt.anisotropy = 8;
    const back = new THREE.Mesh(new THREE.PlaneGeometry(52, 15), new THREE.MeshStandardMaterial({ color: "#000000", emissive: "#ffffff", emissiveMap: bt, emissiveIntensity: 1.25, roughness: 0.35, metalness: 0.1 }));
    back.rotation.y = Math.PI / 2; back.position.set(sbx + 0.82, sby, 0); scene.add(back);
    const steel = mat("#2a2e33", { metalness: 0.7, roughness: 0.45 });
    const cat = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.25, 56), steel); cat.position.set(sbx, sby - 8.4, 0); cat.castShadow = true; scene.add(cat);             // service catwalk
    for (const side of [-1, 1]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 56), steel); rail.position.set(sbx + side * 1.75, sby - 7.3, 0); scene.add(rail); }
    for (const z of [-22, -11, 0, 11, 22]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.8, sby - 8.5 - NORTH.y + 0.5, 0.8), steel); leg.position.set(sbx, (sby - 8.5 + NORTH.y) / 2, z); leg.castShadow = true; scene.add(leg); } }
  W.board = { canvas: sbC, tex: sbT };
  // ---- light rows along the upper-deck rim and on the press box; light standards at the south corners
  const lampM = new THREE.MeshStandardMaterial({ color: "#dfe6ea", emissive: "#fff6dc", emissiveIntensity: 0, roughness: 0.3 }); W.lampMat = lampM;
  { const n = Math.floor(deckPath.length / 3), inst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.9, 0.5), lampM, n), m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    for (let i = 0; i < n; i++) { const [x, z, nx, nz] = deckPath[i * 3]; q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(nx, nz)); m4.compose(new THREE.Vector3(x + nx * (DECK.Db + 0.2), DECK.Hb + 2.4, z + nz * (DECK.Db + 0.2)), q, new THREE.Vector3(1, 1, 1)); inst.setMatrixAt(i, m4); }
    scene.add(inst); }
  const bank = (x, y, z, w = 9) => { const b = new THREE.Group(); b.position.set(x, y, z); scene.add(b);
    b.add(new THREE.Mesh(new THREE.BoxGeometry(w, 4.2, 0.4), mat("#5f646a", { metalness: 0.6 })));
    for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.25, 14).rotateX(Math.PI / 2), lampM); l.position.set(-w / 2 + 0.9 + i * (w - 1.8) / 5, -1.3 + j * 1.3, 0.3); b.add(l); }
    b.lookAt(0, 0, 0); return b; };
  for (const x of [-18, 18]) bank(x, PRESS.y1 + 3, pzc, 14);
  for (const z of [-1, 1]) { const px = -BOWL.ax - BOWL.D + 4, pz = z * (BOWL.az + 14);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 46, 12), mat("#8a8f94", { metalness: 0.6 })); pole.position.set(px, 23, pz); pole.castShadow = true; scene.add(pole); bank(px + 1, 47, pz, 10); }
  // ---- UW Field House (1930) behind the south stands: brick, tall windows, red hipped roof
  { const fh = new THREE.Group(); fh.position.set(FH.x, 0, 0); scene.add(fh);
    const walls = new THREE.Mesh(new THREE.BoxGeometry(FH.dx, FH.wall, FH.dz), arch(FH.dz / 8, FH.wall / 12)); walls.position.y = FH.wall / 2; walls.castShadow = walls.receiveShadow = true; fh.add(walls);
    const hx = FH.dx / 2 + 0.8, hz = FH.dz / 2 + 0.8, r = FH.ridge, y0 = FH.wall, rz = hz - hx;   // hip roof: ridge along z
    const P = [[-hx, y0, -hz], [hx, y0, -hz], [hx, y0, hz], [-hx, y0, hz], [0, r, -rz], [0, r, rz]], tri = [[0, 4, 1], [1, 4, 5], [1, 5, 2], [2, 5, 3], [3, 5, 4], [3, 4, 0]];
    const pos = []; for (const t of tri) for (const k of t) pos.push(...P[k]);
    const rg = new THREE.BufferGeometry(); rg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); rg.computeVertexNormals();
    const roof = new THREE.Mesh(rg, mat("#9c3f2c", { roughness: 0.7, side: THREE.DoubleSide })); roof.castShadow = true; fh.add(roof);
    mark("Field house", FH.x, FH.ridge + 6, 0); }
  addSurroundings(scene, W, mark, glassM);
  // crowd: one instanced figure per occupied seat
  { const seats = [];
    for (let i = 0; i < path.length - 1; i += 1) { if (W.aisleIdx.has(i)) continue; const [x, z, nx, nz] = path[i];
      for (let r = 0; r < BOWL.rows; r++) { const d = (r + 0.55) * BOWL.tread; seats.push([x + nx * d, BOWL.h0 + (r + 1) * BOWL.riser, z + nz * d, Math.atan2(-nx, -nz), x, z]); seats.push([x + nx * d + nz * 0.5, BOWL.h0 + (r + 1) * BOWL.riser, z + nz * d - nx * 0.5, Math.atan2(-nx, -nz), x, z]); } }
    for (const [x, z, nx, nz] of W.deckPath) for (let r = 0; r < DECK.rows; r++) { const d = DECK.d0 + (r + 0.55) * DECK.tread, y = DECK.y0 + DECK.fascia + (r + 1) * DECK.riser;
      for (const o of [-0.25, 0.25]) seats.push([x + nx * d + nz * o, y, z + nz * d - nx * o, Math.atan2(-nx, -nz), x, z]); }
    const geo = new THREE.BoxGeometry(0.42, 0.8, 0.32); geo.translate(0, 0.4, 0);
    const inst = new THREE.InstancedMesh(geo, mat("#ffffff", { roughness: 0.9 }), seats.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
    const palette = [CARDINAL, CARDINAL, CARDINAL, "#a5060c", "#d82a2a", "#f2f0ea", "#f2f0ea", "#2b2b2b", "#57606a"];
    seats.forEach((s, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s[3]); const h = 0.9 + rand() * 0.2;
      m4.compose(new THREE.Vector3(s[0], s[1], s[2]), q, new THREE.Vector3(1, h, 1)); inst.setMatrixAt(i, m4);
      const visitors = s[4] < -46 && s[4] > -62 && s[5] < -18 && s[5] > -34;   // a small visitors' block in the SW corner
      col.set(visitors ? (rand() < 0.75 ? "#1d2a44" : "#e8e8ec") : palette[Math.floor(rand() * palette.length)]); inst.setColorAt(i, col);
    });
    inst.receiveShadow = true; scene.add(inst); W.crowd = inst; W.seatCount = seats.length; }
  // goalposts (NCAA: crossbar 10 ft, uprights 18 ft 6 in apart), gooseneck behind the end line
  const yel = mat("#f2c618", { roughness: 0.4, metalness: 0.3 });
  for (const s of [-1, 1]) { const gp = new THREE.Group(); gp.position.set(s * FIELD.end, 0, 0); scene.add(gp);
    const add = (geo, x, y, z) => { const o = new THREE.Mesh(geo, yel); o.position.set(x, y, z); o.castShadow = true; gp.add(o); return o; };
    add(new THREE.CylinderGeometry(0.11, 0.13, 3.05, 12), s * 1.8, 1.52, 0); add(new THREE.CylinderGeometry(0.1, 0.1, 1.8, 12).rotateZ(Math.PI / 2), s * 0.9, 3.05, 0);
    add(new THREE.CylinderGeometry(0.08, 0.08, 5.64, 12).rotateX(Math.PI / 2), 0, 3.05, 0);
    for (const z of [-2.82, 2.82]) add(new THREE.CylinderGeometry(0.055, 0.06, 9.1, 10), 0, 3.05 + 4.55, z);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.8, 14), mat(CARDINAL)); pad.position.set(s * 1.8, 0.9, 0); pad.castShadow = true; gp.add(pad); }
  // players: home offence at its own 30 going north, visitors on defence
  W.players = []; const los = -20 * YD;
  const off = [[0, 0], [0, -1.6], [0, 1.6], [0, -3.2], [0, 3.2], [0.0, 5.2], [-6.4, 0], [-5.5, -1.6], [0, -16], [-1, 14], [-1, 19]];
  const def = [[1.3, -0.8], [1.3, 0.8], [1.3, -2.6], [1.3, 2.6], [4.5, -3], [4.5, 0], [4.5, 3.4], [7, -15], [7, 14], [13, -6], [14, 7]];
  off.forEach(([dx, dz], i) => { const p = makePlayer("home", i); p.position.set(los - 0.6 + dx, 0, dz); scene.add(p); W.players.push(p); });
  def.forEach(([dx, dz], i) => { const p = makePlayer("away", i); p.position.set(los + dx, 0, dz); p.rotation.y = Math.PI; scene.add(p); W.players.push(p); });
  W.qb = W.players[6]; W.wr = W.players[9]; W.los = los;
  // the ball, its trail and a landing marker
  const bt = ballTexture();
  W.ball = new THREE.Mesh(lemonGeometry(0.1413, 0.0854), mat("#ffffff", { map: bt, roughness: 0.55 })); W.ball.castShadow = true; scene.add(W.ball);
  W.trail = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: "#ffe9a8", transparent: true, opacity: 0.85 })); scene.add(W.trail);
  W.vacTrail = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: "#9fd3ff", dashSize: 0.8, gapSize: 0.6, transparent: true, opacity: 0.7 })); scene.add(W.vacTrail);
  W.marker = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.95, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: "#ffe9a8", transparent: true, opacity: 0.8 })); W.marker.position.y = 0.02; scene.add(W.marker);
  // team benches and drink coolers along both sidelines
  { const benchM = mat("#9aa3ab", { metalness: 0.6, roughness: 0.4 }), coolM = mat(CARDINAL, { roughness: 0.35 }), lidM = mat("#f2f2f0", { roughness: 0.4 });
    for (const s of [-1, 1]) {
      for (let x = -20; x <= 20; x += 5) { const b = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.45, 0.45), benchM); b.position.set(x, 0.45, s * (FIELD.half + 6.4)); b.castShadow = true; scene.add(b); }
      for (const x of [-24, 24]) { const t = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.75, 0.8), mat("#3b4148")); t.position.set(x, 0.375, s * (FIELD.half + 5.2)); t.castShadow = true; scene.add(t);
        for (const dx of [-0.5, 0.5]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.55, 20), coolM); c.position.set(x + dx, 1.03, s * (FIELD.half + 5.2)); c.castShadow = true; scene.add(c);
          const l = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.06, 20), lidM); l.position.set(x + dx, 1.33, s * (FIELD.half + 5.2)); scene.add(l); } } } }
  W.cooler = new THREE.Vector3(-24, 1, -(FIELD.half + 5.2));
  // precipitation
  { const n = 6000, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) pos.set([(rand() - 0.5) * 200, rand() * 60, (rand() - 0.5) * 140], i * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    W.precip = new THREE.Points(g, new THREE.PointsMaterial({ color: "#cfd9e2", size: 0.12, transparent: true, opacity: 0.6, depthWrite: false })); W.precip.frustumCulled = false; scene.add(W.precip); }
  return W;
}
