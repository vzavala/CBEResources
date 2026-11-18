// Real world card and About section
import { REFLIST } from "./refs.js";
const N = k => REFLIST.findIndex(r => r.key === k) + 1;
const R = (...k) => `<sup class="refsup">${k.map(x => `<a href="#ref-${N(x)}" class="ref" data-ref="${N(x)}">${N(x)}</a>`).join(",")}</sup>`;

export function introHTML(X) {
  return `
    <div class="lc-top"><span class="lc-subject">Real world</span><button class="lc-x" type="button" aria-label="Close">×</button></div>
    <h3>Why is a battery a chemical engineering story?</h3>
    <ul class="lc-list">
      <li><b>Everywhere:</b> 20 million+ electric cars sold in 2025; batteries also store solar and wind power.${R("iea_gevo")}</li>
      <li><b>Minerals:</b> 73 % of mined cobalt comes from one country; child labour is reported there.${R("usgs_co", "dol")}</li>
      <li><b>Climate and water:</b> rock lithium emits more CO₂ than brine; brine uses desert water.${R("kelly")}</li>
      <li><b>Safety and cost:</b> hot cells can catch fire; packs cost about $108 per kWh.${R("fire", "bnef")}</li>
    </ul>
    <p><b>Chemical engineers</b> design the mines, refineries, cell factories, battery controls and recycling plants.</p>
    <p class="lc-plain">Click a numbered spot or a subject above. The <b>User guide</b> explains every button.</p>
    <div class="lc-nav"><button class="btn primary" type="button" id="lc-next">Start exploring</button></div>`;
}

export function aboutHTML(X) {
  return `
    <p class="note"><b>An integrative case study</b> for UW–Madison CBE students: balances, thermodynamics, transport, kinetics, materials, control and design in one system.</p>
    <p class="note"><b>Cell model:</b> single particle model with PyBaMM parameter sets${R("pybamm")} for the LG M50 NMC811 cell${R("chen", "oregan")} and the A123 LFP cell${R("prada")}; lumped heat balance${R("bernardi")}; CC–CV charging. Matches an independent Python version to 1 nV. Full equations: <b>∑ Model</b>.</p>
    <p class="note"><b>Aging</b> is illustrative (SEI growth only${R("ploehn")}). <b>Footprint</b> is a lower bound (cathode synthesis, electrolyte, separator, can and pack not counted; a full study found 75.5 kg CO₂e/kWh${R("mohr")}). 3D plants are illustrations.</p>`;
}
