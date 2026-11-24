// Temperature unit switch (°C | °F). Display only: the model always works in °C and kelvin.
// The same file is copied into each twin that offers the switch.
//
// How it works: page text is written in °C as before. When °F is chosen, a rewriter walks the visible text and converts
// every "<number> °C" (and ranges such as "20 to 24 °C" or "45–50 °C") to °F, and bare "°C" unit labels to "°F".
// A temperature DIFFERENCE is written in the source as "°C" followed by the invisible word-joiner character (U+2060):
// it converts by 9/5 without the 32 offset. Canvases are not text, so drawing code uses U.T(), U.dT() and U.sym().
// Anything inside an element matching SKIP keeps °C and kelvin (equations, parameter tables, references, exam questions).
const KEY = "twin-temp-unit", WJ = "⁠";
let unit = "C", SKIP = ".no-unit, .katex, script, style, textarea";
const subs = new Set(), seen = new WeakMap();

export const U = {
  get unit() { return unit; },
  T: c => unit === "F" ? c * 9 / 5 + 32 : c,          // absolute temperature, °C in, display unit out
  dT: d => unit === "F" ? d * 9 / 5 : d,              // temperature difference
  toC: v => unit === "F" ? (v - 32) * 5 / 9 : v,      // a number the visitor typed, back to °C
  sym: () => "°" + unit,
  on: f => { subs.add(f); },
};

const NUM = "([-−]?\\d+(?:\\.\\d+)?)";
const RANGE = new RegExp(NUM + "(\\s*(?:to|and|–)\\s*)" + NUM + "(\\s*)°C(" + WJ + "?)", "g"), ONE = new RegExp(NUM + "(\\s*)°C(" + WJ + "?)", "g");
function num(s, diff) { const dec = (s.split(".")[1] || "").length, c = parseFloat(s.replace("−", "-")), f = diff ? c * 9 / 5 : c * 9 / 5 + 32; return f.toFixed(dec).replace("-", "−"); }
function toF(text) {
  if (text.indexOf("°C") < 0) return text;
  return text.replace(RANGE, (m, a, sep, b, sp, d) => `${num(a, d)}${sep}${num(b, d)}${sp}°F`)
    .replace(ONE, (m, a, sp, d) => `${num(a, d)}${sp}°F`)
    .replace(/(.{0,4})°C/g, (m, pre) => /[\/·]\s*$|per\s$/.test(pre) ? m : pre + "°F");   // bare unit labels; "per °C" and "/°C" stay
}
function fix(node) {
  const p = node.parentElement; if (!p || p.closest(SKIP)) return;
  const e = seen.get(node), src = e && e.out === node.data ? e.src : node.data;
  if (unit === "C" && !e && src.indexOf(WJ) < 0) return;
  const out = (unit === "F" ? toF(src) : src).split(WJ).join("");
  seen.set(node, { src, out }); if (out !== node.data) node.data = out;
}
function walk(root) {
  if (root.nodeType === 3) { fix(root); return; }
  if (root.nodeType !== 1) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) fix(n);
}

function setUnit(u, seg) {
  const prev = unit; unit = u === "F" ? "F" : "C";
  try { localStorage.setItem(KEY, unit); } catch (e) {}
  if (seg) seg.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.u === unit)));
  walk(document.body); subs.forEach(f => { try { f(unit, prev); } catch (e) { console.error(e); } });
}

// def: "C" or "F" when the visitor has not chosen; mount: element that receives the switch; skip: extra selectors that keep °C.
export function initUnits({ def = "C", mount, skip = "" }) {
  if (skip) SKIP += ", " + skip;
  let u = def; try { const s = localStorage.getItem(KEY); if (s === "C" || s === "F") u = s; } catch (e) {}
  const seg = document.createElement("span"); seg.className = "seg unit-seg no-unit"; seg.setAttribute("role", "group"); seg.setAttribute("aria-label", "Temperature unit");
  seg.innerHTML = `<button type="button" data-u="C" title="Show temperatures in degrees Celsius">°C</button><button type="button" data-u="F" title="Show temperatures in degrees Fahrenheit">°F</button>`;
  seg.onclick = e => { const b = e.target.closest("button"); if (b && b.dataset.u !== unit) setUnit(b.dataset.u, seg); };
  const st = document.createElement("style"); st.textContent = ".unit-seg { margin-left: auto; flex: none; } .unit-seg button { padding: 3px 9px; text-transform: none; letter-spacing: 0; }"; document.head.append(st);
  if (mount) mount.append(seg);
  new MutationObserver(ms => { for (const m of ms) { if (m.type === "characterData") fix(m.target); else m.addedNodes.forEach(walk); } })
    .observe(document.body, { childList: true, subtree: true, characterData: true });
  setUnit(u, seg);
}
