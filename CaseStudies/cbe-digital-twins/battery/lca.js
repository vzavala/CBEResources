// Life-cycle footprint of the battery, per kWh of cell capacity (cradle to grave), built bottom-up:
//   material masses come from the cell model itself (crystal sites × molar mass, foil thickness × area),
//   and each mass or energy is multiplied by a published emission factor. Stages without a published factor
//   are listed as "not counted", and the total is compared with a full LCA (Mohr et al. 2020).
import { CELLS, derive } from "./cell.js";

// ---- molar masses (g/mol) ----
const MW = { Li: 6.94, Ni: 58.693, Mn: 54.938, Co: 58.933, Fe: 55.845, P: 30.974, O: 15.999, C: 12.011,
  LiOH_H2O: 41.96, Li2CO3: 73.89, H2SO4: 98.08, H2O2: 34.01, NaOH: 40.00, Na2CO3: 105.99 };
const CATH = { NMC: { M: 6.94 + 0.8 * 58.693 + 0.1 * 54.938 + 0.1 * 58.933 + 2 * 15.999, Ni: 0.8, Mn: 0.1, Co: 0.1 },
  LFP: { M: 6.94 + 55.845 + 30.974 + 4 * 15.999, Fe: 1, P: 1 } };

// ---- published factors ----
export const EF = {
  // Kelly et al. 2021, Table 6: kg CO2e, MJ and m³ fresh water per kg (per t → per kg) of lithium chemical, cradle to
  // gate (brine: Chile; rock: Australian spodumene refined in China); midpoints of the reported ranges.
  // NMC811 cathodes are made from lithium hydroxide, LFP from lithium carbonate.
  li: { NMC: { chem: "LiOH·H₂O", M: MW.LiOH_H2O, perLi: 1, brine: 7.1, rock: 15.7, waterBrine: 40.5, waterRock: 69, MJbrine: 79.75, MJrock: 187.2 },
        LFP: { chem: "Li₂CO₃", M: MW.Li2CO3, perLi: 0.5, brine: 2.9, rock: 20.4, waterBrine: 24.15, waterRock: 77, MJbrine: 33, MJrock: 218 } },
  // Dai et al. 2019, Table 3 (GREET 2018), kg CO2e per kg
  Ni: 8.1, Co: 27.0, graphite: 4.9, Al: 8.4, Cu: 3.1,
  // Dai et al. 2019: cell production uses 30 MJ electricity + 140 MJ steam per kWh of cell
  mfgElecKWh: 30 / 3.6, mfgSteamMJ: 140,
  // EPA GHG Emission Factors Hub 2025: natural gas 53.06 kg CO2, 1 g CH4, 0.1 g N2O per mmBtu (GWP 28, 265)
  ngPerMJ: (53.06 + 0.001 * 28 + 0.0001 * 265) / 1055.06,
  boilerEff: 0.8,                                  // assumed
  hydroPerKgCAM: 6.1,                              // Machala et al. 2025: kg CO2e per kg cathode-equivalent material, recycled batteries
  pyroPerKgCell: (1.47 + 2.82) / 2,                // Hanna et al. 2025: literature range 1.47–2.82 kg CO2e per kg battery
};
// recovery fractions by route
export const RECOVER = {
  hydro: { Ni: 0.95, Co: 0.95, Cu: 0.95, Li: 0.92, Mn: 0.95, Al: null, graphite: null, Fe: null, P: null },   // Machala 2025 (Ni, Co 95 %, Li 92 %); Brückner 2020 (Co, Cu, Ni losses < 5 %)
  pyro:  { Ni: 0.95, Co: 0.95, Cu: 0.95, Li: 0, Mn: 0, Al: 0, graphite: 0, Fe: null, P: null },               // Brückner 2020: > 95 % Co, Cu, Ni; Li, Al, Mn to slag
  none:  {},
};
// grid carbon intensity, Ember yearly data 2025 (g CO2e/kWh)
export const GRIDS = [["Norway", 28], ["Sweden", 35], ["the EU", 211], ["the US", 384], ["the world average", 460], ["China", 528], ["Poland", 591], ["India", 671]];
const gridName = v => { let best = GRIDS[0]; for (const g of GRIDS) if (Math.abs(g[1] - v) < Math.abs(best[1] - v)) best = g; return Math.abs(best[1] - v) <= 20 ? `like ${best[0]}` : ""; };
export const CELL_MASS = { NMC: 0.06838, LFP: 0.076 };   // kg: LG M50 (Chen et al. 2020), A123 26650 (datasheet)

// ---- material inventory per kWh of cells, from the cell model ----
export function inventory(chem, nomWh) {
  const c = CELLS[chem];
  const nCath = c.p.eps * c.p.L * c.A * c.p.cmax;         // mol of cathode formula units in one cell
  const nC6 = c.n.eps * c.n.L * c.A * c.n.cmax;            // mol of C6 sites
  const foilA = c.A / 2;                                   // double-sided coatings: foil area is half the electrode-pair area
  const per = 1000 / nomWh;                                // cells per kWh
  const k = CATH[chem], kg = g => g / 1000 * per;
  return {
    cells: per, cellMass: CELL_MASS[chem] * per,
    cathode: kg(nCath * k.M), li: kg(nCath * MW.Li), graphite: kg(nC6 * 6 * MW.C),
    Ni: kg(nCath * (k.Ni || 0) * MW.Ni), Mn: kg(nCath * (k.Mn || 0) * MW.Mn), Co: kg(nCath * (k.Co || 0) * MW.Co),
    Fe: kg(nCath * (k.Fe || 0) * MW.Fe), P: kg(nCath * (k.P || 0) * MW.P),
    Cu: kg(foilA * 12e-6 * 8960 * 1000), Al: kg(foilA * 16e-6 * 2700 * 1000),
    nCathPerKWh: nCath * per, cathPerCell: nCath * k.M,
  };
}

export const CHAIN = {
  gridName: v => gridName(v),
  note: S => `Grid examples (g CO₂/kWh): Norway 28, EU 211, US 384, China 528, India 671.[[ember]]`,
};

export function lca(S) {
  const m = inventory(S.chem, S.nomWh), L = EF.li[S.chem];
  const liChem = m.li / MW.Li * L.perLi * L.M;             // kg lithium chemical per kWh
  const efLi = L[S.li];
  const st = [];
  const add = (key, label, group, at, kg, how) => st.push({ key, label, group, at, kg, how });
  add("lithium", `Lithium (as ${L.chem})`, "raw", "refinery", liChem * efLi, `${liChem.toFixed(2)} kg ${L.chem} × ${efLi} kg CO₂e/kg from ${S.li === "brine" ? "brine" : "rock"} [[kelly]].`);
  if (S.chem === "NMC") add("metals", "Nickel and cobalt", "raw", "mine", m.Ni * EF.Ni + m.Co * EF.Co, `${m.Ni.toFixed(2)} kg nickel × 8.1 + ${m.Co.toFixed(2)} kg cobalt × 27.0 kg CO₂e/kg [[dai]].`);
  add("graphite", "Graphite", "materials", "materials", m.graphite * EF.graphite, `${m.graphite.toFixed(2)} kg × 4.9 kg CO₂e/kg [[dai]].`);
  add("foils", "Copper + Al foil", "materials", "materials", m.Cu * EF.Cu + m.Al * EF.Al, `${m.Cu.toFixed(2)} kg copper × 3.1 + ${m.Al.toFixed(2)} kg aluminium × 8.4 kg CO₂e/kg [[dai]].`);
  const mfgE = EF.mfgElecKWh * S.gridF / 1000, mfgS = EF.mfgSteamMJ / EF.boilerEff * EF.ngPerMJ;
  add("cellmfg", "Cell factory energy", "cellmfg", "factory", mfgE + mfgS, `${EF.mfgElecKWh.toFixed(1)} kWh electricity × ${S.gridF} g/kWh + 140 MJ of steam from natural gas (boiler 80 % efficient, assumed)[[dai,epa]].`);
  const lifeKWh = S.lifeWh / S.nomWh;                      // kWh delivered per kWh of capacity
  const lossKWh = lifeKWh * (1 / S.eff - 1);
  add("use", "Charging losses (life)", "use", "ev", lossKWh * S.gridU / 1000, `${lifeKWh.toFixed(0)} kWh delivered; ${(100 / S.eff - 100).toFixed(1)} % extra drawn from a ${S.gridU} g/kWh grid (the model's round-trip efficiency).`);
  const R = RECOVER[S.route];
  let proc = 0, credit = 0; const rec = [];
  if (S.route === "hydro") proc = EF.hydroPerKgCAM * m.cathode * 0.95;
  if (S.route === "pyro") proc = EF.pyroPerKgCell * m.cellMass;
  const cr = (el, mass, ef, name) => { const f = R[el]; if (f) { credit += f * mass * ef; rec.push(name); } };
  if (S.route !== "none") {
    cr("Ni", m.Ni, EF.Ni, "nickel"); cr("Co", m.Co, EF.Co, "cobalt"); cr("Cu", m.Cu, EF.Cu, "copper");
    if (R.Li) { credit += R.Li * liChem * efLi; rec.push("lithium"); }
  }
  add("eolproc", S.route === "none" ? "Landfill" : "Recycling process", "eol", "recycle", proc,
    S.route === "hydro" ? `6.1 kg CO₂e per kg of recovered cathode material (industrial plant)[[machala]] × ${(m.cathode * 0.95).toFixed(2)} kg.` : S.route === "pyro" ? `${EF.pyroPerKgCell.toFixed(2)} kg CO₂e per kg of cells (middle of 1.47–2.82)[[hanna]] × ${m.cellMass.toFixed(2)} kg.` : "Transport and landfill emissions not counted.");
  add("eolcredit", "Recycling credit", "eol", "recycle", -credit, S.route === "none" ? "Nothing recovered." : `Recovered ${rec.join(", ")} replace newly mined material, at the same factors used above.`);

  const make = st.filter(s => s.group !== "use" && s.group !== "eol").reduce((a, s) => a + s.kg, 0);
  const eol = proc - credit;
  const life = lifeKWh > 0 ? (make + eol) / lifeKWh + (1 / S.eff - 1) * S.gridU / 1000 : Infinity;
  const top = st.filter(s => s.kg > 0 && s.group !== "use" && s.group !== "eol").sort((a, b) => b.kg - a.kg)[0];
  const water = liChem * (S.li === "brine" ? L.waterBrine : L.waterRock);           // litres (m³/t = L/kg)
  const liMJ = liChem * (S.li === "brine" ? L.MJbrine : L.MJrock);
  return {
    stages: st, make, eol, life, lifeKWh, useLoss: (1 / S.eff - 1) * S.gridU / 1000, top: `${top.label.toLowerCase()} (${top.kg.toFixed(1)} kg)`,
    mats: { cathode: m.cathode, li: m.li, graphite: m.graphite, Ni: m.Ni, Co: m.Co, Cu: m.Cu, Al: m.Al, cellMass: m.cellMass, liChem, cathPerCell: m.cathPerCell },
    water, liMJ,
    caveat: `Counted: lithium, ${S.chem === "NMC" ? "nickel, cobalt, " : ""}graphite, foils and factory energy. Not counted, for lack of a factor in our sources: ${S.chem === "NMC" ? "manganese" : "iron and phosphate"}, making the cathode powder (reactors and kilns), electrolyte, separator, binder, can and pack parts. A full study found 75.5 kg CO₂e per kWh for NMC cells [[mohr]], so read this sum as a lower bound.`,
    mfgNote: `${EF.mfgElecKWh.toFixed(1)} kWh of electricity per kWh of cells × ${S.gridF} g CO₂/kWh = ${mfgE.toFixed(1)} kg CO₂e, plus ${mfgS.toFixed(1)} kg from natural-gas steam for drying and dry rooms. The electricity part would be ${(EF.mfgElecKWh * 0.028).toFixed(1)} kg on Norway's grid and ${(EF.mfgElecKWh * 0.671).toFixed(1)} kg on India's.`,
    eolNote: S.route === "none" ? `Landfill: no credit, and ${((m.Ni + m.Co + m.li + m.Cu) * 1000).toFixed(0)} g of nickel, cobalt, lithium and copper per kWh are thrown away.` : `${S.route === "hydro" ? "Hydrometallurgy" : "Pyrometallurgy"} on ${S.chem}: process ${proc.toFixed(1)} kg CO₂e, credit −${credit.toFixed(1)} kg → net ${eol >= 0 ? "+" : "−"}${Math.abs(eol).toFixed(1)} kg CO₂e per kWh.${S.route === "pyro" && S.chem === "LFP" ? " LFP has little valuable metal to recover, so smelting adds more than it saves, as a published study also found.[[mohr]]" : ""}${S.route === "hydro" && S.chem === "LFP" ? " Our sources give no LFP-specific plant value, so the process uses the NMC-type plant's value per kg of cathode material, likely too high for LFP." : ""}`,
    gridNote: `On a ${S.gridU} g/kWh grid, each kWh the battery delivers carries ${((1 / S.eff - 1) * S.gridU).toFixed(0)} g of charging losses plus ${lifeKWh > 0 ? ((make + eol) / lifeKWh * 1000).toFixed(0) : "–"} g for building and recycling the battery (spread over ${lifeKWh.toFixed(0)} kWh delivered per kWh of battery), on top of the ${S.gridU} g of the electricity itself.`,
    liNote: `This ${S.chem === "NMC" ? "NMC811" : "LFP"} battery needs ${liChem.toFixed(2)} kg of ${L.chem} per kWh. Made from ${S.li === "brine" ? "brine" : "spodumene rock"}: ${(liChem * efLi).toFixed(1)} kg CO₂e, ${liMJ.toFixed(0)} MJ of energy and ${water.toFixed(0)} L of fresh water (the brine water evaporated in the ponds is not counted).[[kelly]]`,
  };
}

// ---- end-of-life table and stoichiometric reagent needs ----
export function recycling(route, chem, nomWh) {
  const m = inventory(chem, nomWh), R = RECOVER[route];
  const n = m.nCathPerKWh, kg = (mol, M) => mol * M / 1000;
  const rows = (chem === "NMC" ? [["Lithium", m.li, "Li"], ["Nickel", m.Ni, "Ni"], ["Manganese", m.Mn, "Mn"], ["Cobalt", m.Co, "Co"]] : [["Lithium", m.li, "Li"], ["Iron", m.Fe, "Fe"], ["Phosphorus", m.P, "P"]])
    .concat([["Graphite", m.graphite, "graphite"], ["Copper", m.Cu, "Cu"], ["Aluminium", m.Al, "Al"]])
    .map(([el, mass, k]) => ({ el, g: mass * 1000, rec: route === "none" ? 0 : (R[k] ?? null) }));
  // NMC: 2 LiMO2 + 3 H2SO4 + H2O2 -> Li2SO4 + 2 MSO4 + 4 H2O + O2 ; LFP: 2 LiFePO4 + H2SO4 + H2O2 -> Li2SO4 + 2 FePO4 + 2 H2O
  const acid = chem === "NMC" ? 1.5 * n : 0.5 * n, perox = 0.5 * n;
  const stoich = [["H₂SO₄", kg(acid, MW.H2SO4)], ["H₂O₂", kg(perox, MW.H2O2)], ["Na₂CO₃", kg(0.5 * n, MW.Na2CO3)]].concat(chem === "NMC" ? [["NaOH", kg(2 * n, MW.NaOH)]] : []);
  const perKgCell = v => v / m.cellMass;
  const reagents = route === "hydro" ? [
    ["Acid, least needed", `${stoich[0][1].toFixed(2)} kg H₂SO₄/kWh`],
    ["…per kg of cells", `${perKgCell(stoich[0][1]).toFixed(2)} kg`],
    ["Peroxide, least needed", `${stoich[1][1].toFixed(2)} kg H₂O₂/kWh`],
    ["Soda ash, for Li₂CO₃", `${stoich[2][1].toFixed(2)} kg Na₂CO₃/kWh`],
    ...(chem === "NMC" ? [["Caustic, for Ni-Mn-Co", `${stoich[3][1].toFixed(2)} kg NaOH/kWh`]] : []),
    ["Real plants, NMC (per kg)", "H₂SO₄ 0.67–0.87 · H₂O₂ 0.83–1.04"],
  ] : route === "pyro" ? [["Furnace", "≈ 1,450 °C, lime, silica, coke"], ["Energy, studies", "12–62 MJ per kg of battery"]] : [["Recovered", "nothing"]];
  const note = route === "hydro" ? "Shred → leach → solvent extraction → precipitate. Recovers Ni, Co 95 %, Li 92 %.[[larouche,machala,bruckner]]" :
    route === "pyro" ? "Smelt → Ni-Co-Cu alloy (95 %); lithium, aluminium and manganese go to slag.[[bruckner,harper]]" :
    "Landfill: metals wasted; fire and leak risk.";
  return { rows, reagents, note, stoich, mats: m };
}
