// Small canvas plotting helper shared with the Kinetics Lab twin (same code).
function ticks(a, b, n = 5) { const span = b - a || 1, raw = span / n, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p, st = (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p, out = []; for (let v = Math.ceil(a / st - 1e-9) * st; v <= b + 1e-9 * span; v += st) out.push(Math.abs(v) < st * 1e-9 ? 0 : v); return out; }
const tickFmt = (v, st) => { const a = Math.abs(v); if (a !== 0 && (a >= 1e5 || a < 1e-3)) return v.toExponential(0).replace("e", "e"); const d = Math.max(0, Math.min(4, -Math.floor(Math.log10(st) + 1e-9))); return v.toFixed(d); };
function rangeOf(series, k, pad = 0.06) { let a = Infinity, b = -Infinity; for (const s of series) for (const p of s.pts) { if (Number.isFinite(p[k])) { a = Math.min(a, p[k]); b = Math.max(b, p[k]); } } if (!Number.isFinite(a)) { a = 0; b = 1; } if (a === b) { a -= 0.5; b += 0.5; } const m = (b - a) * pad; return [a - m, b + m]; }
export function plotCtx(g, W, H, o) {
  const fs = o.fs || 11, pad = { l: o.padL ?? 46, r: 10, t: o.title ? 20 : 8, b: o.xl ? 30 : 18 }, xr = o.xr || rangeOf(o.series, 0, 0), yr = o.yr || rangeOf(o.series, 1);
  const X = v => pad.l + (v - xr[0]) / (xr[1] - xr[0]) * (W - pad.l - pad.r), Y = v => H - pad.b - (v - yr[0]) / (yr[1] - yr[0]) * (H - pad.t - pad.b);
  g.clearRect(0, 0, W, H); g.fillStyle = o.bg || "#fff"; g.fillRect(0, 0, W, H);
  g.font = `${fs}px "JetBrains Mono", monospace`; g.lineWidth = 1; g.strokeStyle = "#e1e5ea"; g.fillStyle = "#5d6875";
  const xt = ticks(xr[0], xr[1], Math.max(3, Math.floor(W / 90))), yt = ticks(yr[0], yr[1], Math.max(3, Math.floor(H / 42)));
  g.textAlign = "center"; g.textBaseline = "top"; for (const v of xt) { g.beginPath(); g.moveTo(X(v), pad.t); g.lineTo(X(v), H - pad.b); g.stroke(); g.fillText(tickFmt(v, xt[1] - xt[0] || 1), X(v), H - pad.b + 3); }
  g.textAlign = "right"; g.textBaseline = "middle"; for (const v of yt) { g.beginPath(); g.moveTo(pad.l, Y(v)); g.lineTo(W - pad.r, Y(v)); g.stroke(); g.fillText(tickFmt(v, yt[1] - yt[0] || 1), pad.l - 4, Y(v)); }
  g.strokeStyle = "#9aa4af"; g.strokeRect(pad.l, pad.t, W - pad.l - pad.r, H - pad.t - pad.b);
  g.font = `500 ${fs}px Barlow, sans-serif`; g.fillStyle = "#1d2733";
  if (o.xl) { g.textAlign = "center"; g.textBaseline = "bottom"; g.fillText(o.xl, pad.l + (W - pad.l - pad.r) / 2, H - 1); }
  if (o.yl) { g.save(); g.translate(10, pad.t + (H - pad.t - pad.b) / 2); g.rotate(-Math.PI / 2); g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(o.yl, 0, 0); g.restore(); }
  if (o.title) { g.textAlign = "left"; g.textBaseline = "top"; g.font = `600 ${fs + 1}px Barlow, sans-serif`; g.fillText(o.title, pad.l, 3); }
  g.save(); g.beginPath(); g.rect(pad.l, pad.t, W - pad.l - pad.r, H - pad.t - pad.b); g.clip();
  for (const b of o.bands || []) { g.fillStyle = b.color; g.beginPath(); b.hi.forEach((p, i) => i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1]))); for (let i = b.lo.length - 1; i >= 0; i--) g.lineTo(X(b.lo[i][0]), Y(b.lo[i][1])); g.closePath(); g.fill(); }
  for (const hl of o.hlines || []) { g.strokeStyle = hl.color || "#9aa4af"; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(pad.l, Y(hl.y)); g.lineTo(W - pad.r, Y(hl.y)); g.stroke(); g.setLineDash([]); }
  for (const s of o.series) { const col = s.color || "#c5050c"; g.strokeStyle = col; g.fillStyle = col; g.lineWidth = s.w || 1.8; g.setLineDash(s.dash || []);
    if (s.mode !== "dots") { g.beginPath(); let pen = false; for (const p of s.pts) { if (!Number.isFinite(p[1])) { pen = false; continue; } pen ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1])); pen = true; } g.stroke(); }
    g.setLineDash([]); if (s.mode === "dots" || s.mode === "both") for (const p of s.pts) { if (!Number.isFinite(p[1])) continue; g.beginPath(); g.arc(X(p[0]), Y(p[1]), s.r || 2.2, 0, 6.283); g.fill(); } }
  for (const h of o.handles || []) { g.fillStyle = "#fff"; g.strokeStyle = "#c5050c"; g.lineWidth = 2.5; g.beginPath(); g.arc(X(h[0]), Y(h[1]), 7, 0, 6.283); g.fill(); g.stroke(); }
  g.restore();
  for (const m of o.marks || []) { g.strokeStyle = m.color || "#5d6875"; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(X(m.x), pad.t); g.lineTo(X(m.x), H - pad.b); g.stroke(); g.setLineDash([]); g.fillStyle = m.color || "#5d6875"; g.font = `600 ${fs}px Barlow, sans-serif`; g.textAlign = m.x > (xr[0] + xr[1]) / 2 ? "right" : "left"; g.textBaseline = "top"; g.fillText(m.label, X(m.x) + (g.textAlign === "left" ? 4 : -4), pad.t + 3 + (m.row || 0) * (fs + 2)); }
  if (o.legend) { g.font = `500 ${fs}px Barlow, sans-serif`; g.textBaseline = "middle"; g.textAlign = "left"; let ly = pad.t + 9; const lw = Math.max(...o.legend.map(l => g.measureText(l[0]).width)) + 26, lx = o.legendLeft ? pad.l + 6 : W - pad.r - lw - 4;
    g.fillStyle = "rgba(255,255,255,.88)"; g.fillRect(lx - 3, pad.t + 2, lw + 4, o.legend.length * (fs + 4) + 4);
    for (const [name, col, dash] of o.legend) { g.strokeStyle = col; g.lineWidth = 2; g.setLineDash(dash || []); g.beginPath(); g.moveTo(lx, ly); g.lineTo(lx + 16, ly); g.stroke(); g.setLineDash([]); g.fillStyle = "#1d2733"; g.fillText(name, lx + 21, ly); ly += fs + 4; } }
  return { X, Y, iX: px => xr[0] + (px - pad.l) / (W - pad.l - pad.r) * (xr[1] - xr[0]), iY: py => yr[0] + (H - pad.b - py) / (H - pad.t - pad.b) * (yr[1] - yr[0]), xr, yr };
}
export function plot(cv, o) { if (!cv) return null; const w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return null; const d = Math.min(devicePixelRatio || 1, 2); if (cv.width !== Math.round(w * d) || cv.height !== Math.round(h * d)) { cv.width = Math.round(w * d); cv.height = Math.round(h * d); } const g = cv.getContext("2d"); g.setTransform(d, 0, 0, d, 0, 0); return plotCtx(g, w, h, o); }

