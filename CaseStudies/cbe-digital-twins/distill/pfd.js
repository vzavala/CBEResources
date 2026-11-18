// Process flow diagram of the column, drawn beside the 3D view and updated with the live model numbers.
// Material streams are dark, cooling water blue, energy amber, control signals dashed. Clicking a unit moves the 3D camera to it.
import { colorX, colorT } from "./scene.js";

const f0 = x => Math.round(x).toLocaleString("en-US"), f1 = x => x.toFixed(1), C = k => k - 273.15;
const X0 = 158, X1 = 206, CX = 182, YT = 112, YB = 404;   // column outline in viewBox units

export function makePFD({ host, go, N = 14 }) {
  const pitch = (YB - YT) / N, ty = i => YT + (i - 0.5) * pitch;   // centre line of tray i (1 = top)
  const name = (x, y, t, a = "start") => `<text class="pf-n" x="${x}" y="${y}" text-anchor="${a}">${t}</text>`;
  const val = (x, y, k, a = "start", cls = "") => `<text class="pf-v ${cls}" x="${x}" y="${y}" text-anchor="${a}" data-k="${k}">–</text>`;
  const kW = (x, y, k) => `<g class="pf-e"><rect x="${x}" y="${y - 13}" width="68" height="18" rx="5"/><text x="${x + 34}" y="${y}" text-anchor="middle" data-k="${k}">–</text></g>`;
  const valve = (x, y, c = "") => `<path class="pf-valve ${c}" d="M${x - 6},${y - 5} L${x + 6},${y + 5} V${y - 5} L${x - 6},${y + 5} Z"/>`;
  const bubble = (x, y, t, k, tip) => `<g class="pf-ctl" data-go="control" data-k="${k}"><title>${tip}</title><circle cx="${x}" cy="${y}" r="11"/><text x="${x}" y="${y + 3.5}" text-anchor="middle">${t}</text></g>`;
  const trays = Array.from({ length: N }, (_, k) => `<rect data-tray="${k + 1}" x="${X0 + 1.5}" y="${(YT + k * pitch + 1).toFixed(1)}" width="${X1 - X0 - 3}" height="${(pitch - 2).toFixed(1)}"/>`).join("");
  const y4 = ty(4), y5 = ty(5);
  host.innerHTML = `<svg viewBox="0 0 380 512" role="img" aria-label="Process flow diagram of the column with live flows, compositions and heat duties">
    <defs>${[["ink", "#1d2733"], ["water", "#1f6fd1"], ["energy", "#b26a00"], ["alarm", "#c5050c"]].map(([n, c]) => `<marker id="pf-a-${n}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0.8 L10,5 L0,9.2 Z" fill="${c}"/></marker>`).join("")}</defs>

    <!-- overhead vapour, condenser, reflux and distillate -->
    <path class="pf-s" d="M${CX},${YT} V52 H262" marker-end="url(#pf-a-ink)"/>
    <path class="pf-s" d="M282,72 V124"/>
    <path class="pf-s" d="M282,124 H${X1}" marker-end="url(#pf-a-ink)"/>
    <path class="pf-s" data-k="lineD" d="M282,124 H354" marker-end="url(#pf-a-ink)"/>
    <circle class="pf-node" cx="282" cy="124" r="3"/>
    <path class="pf-w" d="M372,60 H300" marker-end="url(#pf-a-water)"/><path class="pf-w" d="M300,44 H372" marker-end="url(#pf-a-water)"/>
    <g class="pf-unit" data-go="condenser"><title>Condenser: show it in the 3D view</title><circle cx="282" cy="52" r="20"/><path class="pf-w" d="M266,58 L274,44 L282,60 L290,44 L298,58" fill="none"/></g>
    <g data-k="vent" style="display:none"><path class="pf-alarm" d="M282,32 V8" marker-end="url(#pf-a-alarm)"/><text class="pf-v alarm" x="290" y="18" data-k="ventT">Vent</text></g>
    ${name(192, 24, "Condenser")}${kW(192, 43, "Qc")}
    ${name(378, 85, "Cooling water", "end")}${val(378, 101, "cw", "end", "water")}
    ${name(212, 84, "Reflux")}${val(212, 100, "L0")}${val(212, 116, "R", "start", "sub")}
    ${name(294, 141, "Distillate")}${val(294, 157, "D")}${val(294, 173, "xD", "start", "hi")}

    <!-- column -->
    <g class="pf-unit" data-go="column"><title>Column: show the trays in the 3D view</title>
      <path class="pf-shell" d="M${X0},${YB} V${YT} Q${CX},${YT - 22} ${X1},${YT} V${YB} Z"/><g class="pf-trays">${trays}</g>
      <text class="pf-tn" x="${X0 - 5}" y="${ty(1) + 3.5}" text-anchor="end">1</text><text class="pf-tn" x="${X0 - 5}" y="${ty(N) + 3.5}" text-anchor="end">${N}</text></g>
    ${name(150, 86, "Top", "end")}${val(150, 102, "Ttop", "end", "sub")}
    <g class="pf-loss"><path d="M${X1 + 3},262 q5,-5 10,0 t10,0" marker-end="url(#pf-a-energy)"/><path d="M${X1 + 3},278 q5,-5 10,0 t10,0" marker-end="url(#pf-a-energy)"/><path d="M${X1 + 3},294 q5,-5 10,0 t10,0" marker-end="url(#pf-a-energy)"/></g>
    ${name(240, 268, "Wall loss")}${kW(240, 287, "Ql")}

    <!-- feed and preheater -->
    <g data-k="lineF"><path class="pf-s" d="M12,0 H${X0}" data-k="feedPath" marker-end="url(#pf-a-ink)"/>
      <g class="pf-unit" data-go="feed" data-k="pre"><title>Feed and preheater: show them in the 3D view</title><circle cx="84" cy="0" r="11"/><path class="pf-en" d="M76,4 L81,-5 L87,5 L92,-4" fill="none"/></g></g>
    <g data-k="feedLbl">${name(12, -48, "Feed")}${val(12, -33, "F")}${val(12, -17, "zF", "start", "hi")}${name(12, 26, "Preheater")}${val(12, 41, "Tf", "start", "sub")}</g>

    <!-- reboiler, steam and bottoms -->
    <path class="pf-en" d="M12,446 H150" marker-end="url(#pf-a-energy)"/>
    <g class="pf-unit" data-go="reboiler"><title>Reboiler: show it in the 3D view</title><rect class="pf-shell" data-k="reb" x="146" y="${YB}" width="72" height="64" rx="12"/><path class="pf-en" d="M152,446 l6,-8 l8,16 l8,-16 l8,16 l8,-16 l8,16 l6,-8" fill="none"/></g>
    ${name(12, 468, "Steam")}${kW(12, 487, "Qr")}
    ${name(CX, 484, "Reboiler", "middle")}${val(CX, 499, "Tbot", "middle", "sub")}
    <path class="pf-s" d="M218,456 H354" marker-end="url(#pf-a-ink)"/>
    ${name(294, 473, "Bottoms")}${val(294, 489, "B")}${val(294, 505, "xB", "start", "hi")}

    <!-- control loops: sensor tap, controller, dashed signal to its valve -->
    <path class="pf-tap" d="M${X1},${y4} H233"/><path class="pf-sig" d="M244,${y4 - 11} V130"/>${valve(244, 124)}
    ${bubble(244, y4, "TC", "tcTop", "Tray 4 temperature controller: moves the reflux")}
    <path class="pf-tap" d="M${X0},${y5} H147"/><path class="pf-sig" d="M136,${y5 + 11} V440"/>${valve(136, 446, "en")}
    ${bubble(136, y5, "TC", "tcTray", "Tray 5 temperature controller: moves the steam")}
    <path class="pf-tap" d="M218,424 H251"/><path class="pf-sig" d="M262,435 V450"/>${valve(262, 456)}
    ${bubble(262, 424, "LC", "lc", "Reboiler level controller: moves the bottoms flow")}
  </svg>
  <p class="pf-legend"><span><i class="ln ink"></i>Material</span><span><i class="ln water"></i>Cooling water</span><span><i class="ln energy"></i>Energy</span><span><i class="ln sig"></i>Control</span></p>`;

  const svg = host.querySelector("svg"), K = {}; svg.querySelectorAll("[data-k]").forEach(e => { K[e.dataset.k] = e; });
  const trayEls = [...svg.querySelectorAll("[data-tray]")];
  const put = (k, v) => { const e = K[k]; if (e.__v !== v) { e.__v = v; e.textContent = v; } };
  const cls = (k, c, on) => { const e = K[k]; if (e.__c !== on) { e.__c = on; e.classList.toggle(c, on); } };
  K.lc.classList.add("auto");
  svg.addEventListener("click", e => { const g = e.target.closest("[data-go]"); if (g) go(g.dataset.go); });
  let feedTray = -1; const col = { set: (c) => `#${c.getHexString()}` };

  function update(c, s, mode) {
    const op = c.cfg.operation, n = c.N, tot = op.refluxRatio > 50 || s.Dlph < 0.05, feedOn = op.feedFlowLph > 0;
    if (op.feedTray !== feedTray) { feedTray = op.feedTray; const y = ty(feedTray).toFixed(1); K.lineF.setAttribute("transform", `translate(0,${y})`); K.feedLbl.setAttribute("transform", `translate(0,${y})`); }
    trayEls.forEach((el, k) => { const i = k + 1, h = col.set(mode === "T" ? colorT(C(c.T[i])) : colorX(c.x[i])); if (el.__f !== h) { el.__f = h; el.setAttribute("fill", h); } });
    { const h = col.set(mode === "T" ? colorT(C(c.T[n + 1])) : colorX(c.x[n + 1])); if (K.reb.__f !== h) { K.reb.__f = h; K.reb.style.fill = h; } }
    put("F", feedOn ? `${f1(op.feedFlowLph)} L/h` : "no feed"); put("zF", feedOn ? `${f1(op.feedX * 100)} mol %` : ""); cls("lineF", "off", !feedOn);
    put("Tf", feedOn ? `${f0(C(op.feedT))} °C${s.Qpre > 50 ? ` · ${f1(s.Qpre / 1000)} kW` : ""}` : "–");
    put("D", tot ? "none" : `${f1(s.Dlph)} L/h`); put("xD", `${f1(s.xD * 100)} mol %`); cls("lineD", "off", tot);
    put("L0", `${f1(c.toLph(s.L0, c.x[0], 298.15))} L/h`); put("R", op.refluxRatio > 50 ? "total reflux" : `ratio ${f1(op.refluxRatio)}`);
    put("B", `${f1(s.Blph)} L/h`); put("xB", `${(s.xB * 100).toFixed(s.xB < 0.01 ? 2 : 1)} mol %`);
    put("Qr", `${f1(s.Qr / 1000)} kW`); put("Qc", `${f1(s.Qc / 1000)} kW`); put("Ql", `${f1(s.Qloss / 1000)} kW`);
    put("cw", c.faults.coolingWaterFail ? "off" : `${f1(op.coolingWaterLpm)} L/min`);
    put("Ttop", `${f1(s.Ttop)} °C`); put("Tbot", `${f1(s.Tbot)} °C`);
    const vent = s.vent > 0.02 * Math.max(s.V1, 1e-6); if (K.vent.__on !== vent) { K.vent.__on = vent; K.vent.style.display = vent ? "" : "none"; } if (vent) put("ventT", `Vent ${f0(s.vent / s.V1 * 100)} %`);
    cls("tcTop", "auto", c.cfg.control.top.mode === "auto"); cls("tcTray", "auto", c.cfg.control.tray.mode === "auto");
  }
  return { update };
}
