// Text content: courses, references, subject lenses, ChemE spots, the Real world card and About.
// Numbers marked with a reference come from that source; every other number is computed live by the model.
import { REFLIST } from "./refs.js";
import { CELLS, derive, rOhm, kappaE, SEI, ASSUMED } from "./cell.js";

export const COURSE = {
  250: ["Balances", "Process Synthesis"], 255: ["Modeling", "Introduction to Chemical Process Modeling"],
  310: ["Thermo", "Chemical Process Thermodynamics"], 311: ["Mixtures", "Thermodynamics of Mixtures"],
  320: ["Transport", "Introductory Transport Phenomena"], 326: ["Fluids & Heat", "Momentum and Heat Transfer Operations"],
  426: ["Mass Transfer", "Mass Transfer Operations"], 430: ["Kinetics & Reactors", "Chemical Kinetics and Reactor Design"],
  440: ["Materials", "Chemical Engineering Materials"], 450: ["Design", "Process Design"],
  470: ["Control", "Process Dynamics and Control"], 512: ["Energy", "Energy Technology and Sustainability"],
  540: ["Polymers", "Polymer Science and Technology"], "562E": ["Electrochemistry", "Special Topics: Electrochemistry"],
};
// references are kept by key; numbers follow the order of REFLIST
const KEYS = REFLIST.map(r => r.key);
export const REFS = REFLIST.map(r => r.html);
const N = k => { const i = KEYS.indexOf(k); if (i < 0) throw new Error("missing ref " + k); return i + 1; };

const f0 = v => Math.round(v).toLocaleString(), f1 = v => v.toFixed(1), f2 = v => v.toFixed(2);
const chemName = S => S.chem === "NMC" ? "NMC811" : "LFP";

export function buildLenses(X) {
  const { S } = X, R = (...k) => X.R(...k.map(N));
  const c = () => CELLS[S.chem], d = () => derive(S.chem);
  const L = () => X.L, CY = () => X.CYC;
  const B = (at, dx, dy, dz) => [at.x + dx, at.y + dy, at.z + dz];

  // Part M: short card text (title, two short sentences, one plain line, one-sentence why)
  const SHORT = {
    "How much lithium is in a battery?": { text: "Every lithium atom in the cell was mined and refined. Counting the cathode's crystal sites gives the metal per kWh.", plain: "Atoms in = atoms in the product.", why: "Millions of car packs a year make lithium, nickel and cobalt supply a global issue." + R("iea_gevo") },
    "A mass balance on the recycling line": { text: "Black mass dissolves in sulfuric acid with peroxide; close to 99 % of the metal goes into solution." + R("larouche") + " The balanced reaction sets the least acid to buy.", plain: "Moles of metal × moles of reagent per mole = reagent needed.", why: "Reagents cost money and make salt waste, so plants aim for more metal with less chemical." + R("harper") },
    "The cell as a computer model": { text: "Each electrode is one typical particle: lithium diffuses inside and reacts at the surface." + R("pybamm", "chen") + " The page solves it in 2-second steps and replays the cycle.", plain: "Voltage = cathode potential − anode potential − losses.", why: "Car makers design and control cells with models like this." },
    "Where the voltage comes from": { text: "Lithium has lower energy in the cathode crystal than in graphite. That energy per electron is the voltage; NMC holds lithium tighter than LFP." + R("chen", "prada"), plain: "Voltage = energy released per electron.", why: "Higher voltage means more energy per kilogram; LFP trades some for cost and life." + R("iea_gevo") },
    "Concentrating brine in the sun": { text: "Salty groundwater under salt flats is pumped into ponds and the sun evaporates the water. Other salts crystallize; lithium stays dissolved and concentrates." + R("usgs_li", "kelly"), plain: "Less water, saltier brine, until salts fall out.", why: "Brine lithium emits less CO₂ than rock, but uses water in very dry places." + R("kelly") },
    "Lithium has to diffuse into the particles": { text: "Inside a particle lithium moves only by diffusion. In fast charging the surface fills before the centre (gold = full graphite).", plain: "Fill time ≈ radius² ÷ diffusivity.", why: "Smaller particles mean faster charging." },
    "Fast charging warms the cell": { text: "Current through the cell's resistance makes heat, plus a little from the chemistry. Heat in faster than out warms the cell.", plain: "Heat stored = heat made − heat lost.", why: "Heat speeds aging and, in the worst case, thermal runaway." + R("fire") },
    "Separating metals with solvent extraction": { text: "Mixer-settlers stir the metal solution with an oily extractant that grabs some metals more than others." + R("larouche") + " Stage after stage pulls each metal out.", plain: "Each stage takes a share; more stages take nearly all.", why: "Pure metal salts go straight back into new cathodes." },
    "Reactions at the particle surface": { text: "Lithium reacts at each particle surface (Butler–Volmer), slower in the cold." + R("chen") + " Charge cold and fast and lithium can plate out as metal.", plain: "Cold reactions need a bigger push.", why: "Battery systems slow charging in the cold to prevent plating." },
    "A slow side reaction ages the battery": { text: "A thin film (SEI) grows on graphite and locks away lithium." + R("ploehn", "pybamm") + " Heat speeds it up.", plain: "The film grows like √time: fast at first, then slower.", why: "Longer life means fewer batteries per kWh delivered." + R("afdc") },
    "Crystals that breathe lithium": { text: "In NMC, lithium sits in sheets between metal-oxide layers; in LFP, in straight tunnels." + R("chen", "prada") + " Charging empties the sites (white atoms).", plain: "The cathode is a hotel for lithium.", why: "NMC packs more energy; LFP is cheaper and now over half of new EV batteries." + R("iea_gevo", "bnef") },
    "Life-cycle assessment: from cradle to grave": { text: "A life-cycle assessment adds the CO₂ of every step, from mine to recycling. In one NMC pack study, cathode powder was 39 % of the total." + R("dai", "mohr"), plain: "Footprint = Σ amount × emissions per unit.", why: "It decides how much an EV really cuts emissions." + R("iea_lca") },
    "The cell factory runs on electricity": { text: "Coating, drying, dry rooms and formation use about 30 MJ of electricity and 140 MJ of steam per kWh of cells." + R("dai") + " A clean grid makes a cleaner battery.", plain: "Factory footprint = electricity × grid CO₂.", why: "Factories move to clean power, and the EU requires footprint declarations." + R("eu_reg") },
    "Choosing the end of life": { text: "Smelting loses lithium to slag; leaching recovers it but uses more chemicals." + R("bruckner", "hanna") + " Landfill wastes the metals.", plain: "Recovered metal earns a CO₂ credit.", why: "The EU sets minimum recovery for lithium, cobalt, nickel and copper." + R("eu_reg") },
    "The battery-management system": { text: "The BMS charges at constant current, then holds the voltage as the current tapers (CC–CV). It also guards every cell's voltage and temperature.", plain: "Measure, compare, adjust, many times a second.", why: "Good control allows fast charging without damage." },
    "Batteries and the energy system": { text: "An EV is only as clean as its factory and its charging grid." + R("iea_gevo", "ember") + " Batteries also store solar and wind power.", plain: "Per kWh = battery share + losses × grid CO₂.", why: "Cleaner grids and cheaper batteries spread the benefit." + R("bnef") },
    "A plastic film keeps the electrodes apart": { text: "A porous polyolefin separator lets ions through but not electrons. A polymer binder glues particles to the foils.", plain: "More open pores, less resistance.", why: "Some separators melt shut when hot: a built-in fuse." },
  };
  return [
    { n: 250, stops: [{
      view: "refinery", beacon: B(X.AT.refinery, 70, 1, 20), bs: 4, panel: "sec-results",
      title: "How much lithium is in a battery?",
      text: "A mass balance follows atoms: every lithium atom that shuttles back and forth in the cell had to be mined, refined and built into the cathode. Counting the cathode's crystal sites in this model's cell tells us how much lithium, nickel, cobalt or iron one kilowatt-hour (kWh) of battery needs.",
      plain: "Material in = material in the product + material lost. Count the atoms and you know what the mine must supply.",
      eq: "n<sub>cathode</sub> = ε<sub>p</sub> L<sub>p</sub> A c<sub>max</sub> (mol),  m<sub>Li</sub> = n<sub>cathode</sub> × 6.94 g/mol,  per kWh = m / E<sub>cell</sub>",
      live: () => `This ${chemName(S)} cell holds ${f1(L().mats.cathPerCell)} g of cathode material. Per kWh of cells: ${f0(L().mats.cathode * 1000)} g cathode, ${f0(L().mats.li * 1000)} g lithium (${f0(L().mats.li * 5.323 * 1000)} g lithium carbonate equivalent), ${f0(L().mats.graphite * 1000)} g graphite${S.chem === "NMC" ? `, ${f0(L().mats.Ni * 1000)} g nickel, ${f0(L().mats.Co * 1000)} g cobalt` : ""}.`,
      why: "Multiply by a 60–100 kWh car pack and millions of cars a year, and you see why lithium, nickel and cobalt supply became a global concern" + R("iea_gevo") + ". Mass balances also show how much a recycling plant can recover.",
    }, {
      view: "recycle", beacon: B(X.AT.recycle, -20, 1, -10), bs: 5, panel: "sec-recycle",
      title: "A mass balance on the recycling line",
      text: "In hydrometallurgy, shredded electrode powder (black mass) is dissolved in sulfuric acid with hydrogen peroxide; close to 99 % of the metal dissolves." + R("larouche") + " Writing the balanced equation tells us the least acid and peroxide the plant must buy; then sodium hydroxide and sodium carbonate pull the metals back out as solids.",
      plain: "Balance the reaction, then scale it up: moles of metal × moles of reagent per mole = reagent needed.",
      eq: "2 LiMO₂ + 3 H₂SO₄ + H₂O₂ → Li₂SO₄ + 2 MSO₄ + 4 H₂O + O₂ (NMC);  2 LiFePO₄ + H₂SO₄ + H₂O₂ → Li₂SO₄ + 2 FePO₄ + 2 H₂O (LFP);  Li₂SO₄ + Na₂CO₃ → Li₂CO₃ + Na₂SO₄",
      live: () => `Least reagent per kWh of ${chemName(S)} cells: ${X.RC.stoich.map(([k, v]) => `${k} ${f2(v)} kg`).join(", ")}.`,
      note: () => `Stoichiometric minimum for NMC: ${(X.RC.stoich[0][1] / X.RC.mats.cellMass).toFixed(2)} kg of acid per kg of cells${X.S.chem === "NMC" ? "" : " (for NMC; this is LFP)"}. Real NMC plants: 0.67–0.87 kg acid and 0.83–1.04 kg peroxide per kg of pack, so acid is close to the minimum, while peroxide is used far beyond it.` + R("hanna"),
      why: "Reagents cost money and carry their own carbon and waste (sodium sulfate salt). Engineers design the flowsheet to recover more metal with less chemical and water." + R("harper"),
    }] },
    { n: 255, stops: [{
      view: "cell", beacon: B(X.AT.cell, 0, 72, 0), bs: 5, panel: "sec-cell",
      title: "The cell as a computer model",
      text: "This page runs a single particle model: each electrode is treated as one typical particle. Lithium diffuses inside the particles, reacts at their surfaces, and the voltage is what is left after the losses. The computer solves it in about 2-second time steps, then replays the cycle in the 3D view." + R("pybamm", "chen"),
      plain: "Voltage = cathode potential − anode potential − the losses from pushing current.",
      eq: "V = U<sub>p</sub>(y<sub>s</sub>) − U<sub>n</sub>(x<sub>s</sub>) + η<sub>p</sub> − η<sub>n</sub> − I R<sub>ohm</sub>(T)",
      live: () => `${chemName(S)} at ${S.C} C and ${S.Tamb} °C: ${f0(CY().trace.length)} time steps for one ${f1(CY().tCycle / 3600)} h cycle; average discharge voltage ${f2(CY().Eout / (S.dod * d().Q * 3600))} V. An independent Python version of the same equations agrees to about 1 nanovolt.`,
      why: "Car makers use models like this inside battery-management software and to design cells on a computer before building them, saving years of testing.",
    }] },
    { n: 310, stops: [{
      view: "lattice", beacon: B(X.AT.lattice, 0, 30, 0), bs: 5, panel: "sec-cell",
      title: "Where the voltage comes from",
      text: "Lithium is far happier (lower in energy) sitting in the cathode crystal than in graphite. That difference in Gibbs free energy, per electron moved, is the cell voltage. NMC holds lithium more tightly than LFP, so NMC cells run at a higher voltage." + R("chen", "prada"),
      plain: "Voltage = how much energy each electron releases when lithium moves from the anode to the cathode.",
      eq: "ΔG = −F U<sub>ocv</sub> (per mole of Li),   U<sub>ocv</sub> = U<sub>p</sub>(y) − U<sub>n</sub>(x);  reversible heat: Q<sub>rev</sub> = −I T ∂U<sub>ocv</sub>/∂T",
      live: () => `${chemName(S)}: average open-circuit voltage ${f2(X.meanOCV())} V, so ${f0(X.meanOCV() * 96485 / 1000)} kJ per mole of lithium moved.`,
      why: "Higher voltage means more energy per kilogram, which is why most long-range cars have used nickel-rich cathodes, while cheaper, longer-lived LFP has spread fast in cars and grid storage." + R("iea_gevo"),
    }] },
    { n: 311, stops: [{
      view: "mine", beacon: B(X.AT.mine, -35, 2, -135), bs: 18, panel: "sec-chain",
      title: "Concentrating brine in the sun",
      text: "Under salt flats in Chile, Argentina and China lies very salty groundwater (brine) that holds a little lithium. It is pumped into shallow ponds and the sun evaporates the water. As water leaves, other salts reach their solubility limit and crystallize on the pond floor, while the lithium stays dissolved and gets more concentrated. The other big source is hard rock (spodumene), mined mostly in Australia and roasted and refined, often in China." + R("usgs_li", "kelly"),
      plain: "Take away water and every dissolved salt gets more concentrated, until the least soluble ones fall out as crystals.",
      eq: "c<sub>Li</sub> = c<sub>Li,0</sub> × V<sub>0</sub>/V  (lithium stays in solution);  a salt crystallizes when its ion product ≥ K<sub>sp</sub>",
      eqTex: String.raw`\begin{aligned}&c_{\mathrm{Li}}=c_{\mathrm{Li},0}\,\dfrac{V_0}{V}\quad\text{(lithium stays in solution)}\\ &\text{a salt crystallizes when } \textstyle\prod a_i^{\nu_i}\ge K_{\mathrm{sp}}\end{aligned}`,
      live: () => X.L.liNote,
      why: "Lithium chemicals from brine emit several times less CO₂ than those from rock, but the ponds sit in some of the driest places on Earth, where water is precious to local communities and ecosystems." + R("kelly") + " Engineers are developing ways to pull lithium from brine without large ponds.",
    }] },
    { n: 320, stops: [{
      view: "particles", beacon: B(X.AT.particles, -14, 42, 0), bs: 4, panel: "sec-cell",
      title: "Lithium has to diffuse into the particles",
      text: "Inside each particle, lithium moves only by diffusion: slowly, from crowded places to empty ones. During fast charging the surface of a graphite particle fills up before the centre does. The cut-open particles show this: gold is graphite full of lithium.",
      plain: "Time to fill a particle ≈ (its radius)² ÷ how fast lithium diffuses. Half the size, a quarter of the time.",
      eq: "∂c/∂t = (1/r²) ∂/∂r ( r² D ∂c/∂r ),   −D ∂c/∂r |<sub>R</sub> = j,   τ = R²/D",
      live: () => { const n = c().n, p = c().p; return `Graphite particle ${f1(n.R * 1e6)} µm: τ ≈ ${f0(n.R ** 2 / n.D / 60)} min. Cathode particle ${p.R < 1e-6 ? f0(p.R * 1e9) + " nm" : f1(p.R * 1e6) + " µm"}: τ ≈ ${f0(p.R ** 2 / p.D / 60)} min (at 25 °C).`; },
      note: "LFP particles are made tiny (tens of nanometres) because lithium diffuses so slowly in LFP.",
      why: "Making smaller or better-connected particles lets cars charge faster. The same diffusion math describes drug release from pills and dopants in computer chips.",
    }] },
    { n: 326, stops: [{
      view: "module", beacon: B(X.AT.module, 0, 1, 0), bs: 6, panel: "sec-cell",
      title: "Fast charging warms the cell",
      text: "Pushing current through the cell's resistance makes heat, like a toaster wire. A little extra heat is taken in or given out by the chemistry itself (entropic heat). The cell sheds heat to the air or the cooling plate. Heat in faster than it leaves → the cell warms.",
      plain: "Change in stored heat = heat made − heat removed. Heat made grows with the current squared.",
      eq: "m c<sub>p</sub> dT/dt = I (U<sub>ocv</sub> − V) − I T ∂U<sub>ocv</sub>/∂T − h A<sub>s</sub> (T − T<sub>∞</sub>)",
      live: () => `${S.C} C at ${S.Tamb} °C air: peak ${f1(CY().Tmax)} °C, ${f1(CY().Qheat / 1000)} kJ of heat per cell per cycle. Round trip efficiency ${f1(CY().eff * 100)} %.`,
      note: "Cooling here is still air around a single cell (h = 10 W/m² K); packs with liquid cooling plates stay cooler. The cell's heat capacity is an assumed 1,000 J/(kg K).",
      why: "Too hot speeds up aging and, in the worst case, can trigger thermal runaway, a fire that feeds itself. Good thermal design is a big part of battery safety." + R("fire"),
    }] },
    { n: 426, stops: [{
      view: "recycle", beacon: B(X.AT.recycle, 50, 4, -10), bs: 6, panel: "sec-recycle",
      title: "Separating metals with solvent extraction",
      text: "After leaching, nickel, cobalt, manganese and lithium are all dissolved together in water. In mixer-settlers, the water is stirred with an oil-like solvent (extractants such as Cyanex 272 or D2EHPA) that grabs some metals more than others; then the two liquids separate like oil and vinegar. Repeating stage after stage pulls each metal out in turn." + R("larouche"),
      plain: "Each stage moves a fixed share of a metal into the solvent; enough stages in a row get almost all of it.",
      eq: "D = C<sub>org</sub>/C<sub>aq</sub>,  extraction factor E = D·(O/A);  fraction left after n ideal counter-current stages = (E − 1)/(E<sup>n+1</sup> − 1)",
      live: () => { const E = 3; return [1, 2, 3, 4, 6].map(n => `${n} stage${n > 1 ? "s" : ""}: ${((1 - (E - 1) / (E ** (n + 1) - 1)) * 100).toFixed(n > 3 ? 2 : 1)} %`).join(" · ") + " of the metal recovered (example with E = 3)."; },
      note: "The extraction factor E = 3 is an illustrative value for the stage calculation.",
      why: "Solvent extraction makes battery-grade metal salts pure enough to go straight back into new cathodes, closing the loop.",
    }] },
    { n: 430, stops: [{
      view: "particles", beacon: B(X.AT.particles, -2, 2, 0), bs: 4, panel: "sec-cell",
      title: "Reactions at the particle surface",
      text: "Lithium ions must shed their shell of solvent and pick up an electron at each particle surface. The rate follows the Butler–Volmer law, and like most reactions it slows sharply in the cold (Arrhenius). Charge a cold cell too fast and graphite's potential can drop below lithium metal's, so lithium plates out as metal instead of slipping into the graphite." + R("chen"),
      plain: "Reactions need a push (overpotential); in the cold they need a bigger push.",
      eq: "i = 2 i₀ sinh(F η / 2 R T),   i₀ = k₀ e<sup>−E<sub>a</sub>/R (1/T − 1/T<sub>ref</sub>)</sup> √(c<sub>e</sub> c<sub>s</sub>(c<sub>max</sub> − c<sub>s</sub>))",
      live: () => `${chemName(S)} graphite: E<sub>a</sub> = ${f0(c().n.Ek / 1000)} kJ/mol, so its reaction is ${(Math.exp(c().n.Ek / 8.314 * (1 / 263.15 - 1 / 298.15))).toFixed(1)}× slower at −10 °C than at 25 °C. This cycle: lowest graphite potential while charging ${f0(CY().phiNmin * 1000)} mV vs lithium ${CY().phiNmin < 0 ? "→ plating risk" : "→ no plating"}.`,
      note: "Below about −50 mV the simple model is outside its range; read it as \"plating risk\", not an exact number.",
      why: "Battery-management systems slow down charging in the cold for exactly this reason; plated lithium wastes capacity and can grow into short circuits.",
    }, {
      view: "particles", beacon: B(X.AT.particles, -24, 14, 0), bs: 4, panel: "sec-results",
      title: "A slow side reaction ages the battery",
      text: "On graphite, a little electrolyte reacts and builds a thin film called the SEI (solid–electrolyte interphase). The film protects the graphite, but it keeps growing slowly, and every bit of it locks away lithium for good. Heat speeds it up." + R("ploehn", "pybamm") + " A car battery is usually retired with around 70 % or more of its capacity left, and can then serve for years in less demanding jobs." + R("afdc"),
      plain: "The film grows like the square root of time, so a battery loses capacity fastest when it is new, then more slowly.",
      eq: "dL/dt = V̄ c<sub>sol</sub> D<sub>sol</sub>(T) / L  →  L² = L₀² + 2 V̄ c<sub>sol</sub> D<sub>sol</sub> t;  lithium lost = 2 (L − L₀)/V̄ × graphite surface area",
      live: () => `After ${f0(S.cycles)} daily cycles at ${S.Tamb} °C (cycles averaging ${f1(CY().Tavg)} °C): film ${f0(X.AG.L * 1e9)} nm thick, ${f1(X.AG.frac * 100)} % of the capacity lost.`,
      note: "Illustrative: the SEI parameters are PyBaMM's example values; the activation energy (30 kJ/mol) and the extra growth with deeper cycles are assumptions, not fitted to these cells.",
      why: "Longer life means fewer batteries to make per kWh delivered, the single biggest lever on a battery's footprint per use.",
    }] },
    { n: 440, stops: [{
      view: "lattice", beacon: B(X.AT.lattice, 0, -1, 0), bs: 6, panel: "sec-cell",
      title: "Crystals that breathe lithium",
      text: () => `Cathodes are crystals with spaces for lithium. In layered NMC, lithium sits in flat sheets between layers of nickel, manganese and cobalt oxide; in LFP (lithium iron phosphate), it sits in straight tunnels. Charging pulls lithium out; the white atoms disappear and come back as the cell cycles.` + R("chen", "prada"),
      plain: "The cathode is a hotel for lithium: rooms empty during charging and fill up again during use.",
      eq: "NMC811: LiNi<sub>0.8</sub>Mn<sub>0.1</sub>Co<sub>0.1</sub>O₂ ⇌ Li<sub>1−y</sub>Ni<sub>0.8</sub>Mn<sub>0.1</sub>Co<sub>0.1</sub>O₂ + y Li⁺ + y e⁻;  LFP: LiFePO₄ ⇌ FePO₄ + Li⁺ + e⁻",
      live: () => `${chemName(S)}: the cathode cycles between ${f0(c().p.x100 * 100)} % and ${f0(d().y0 * 100)} % of its lithium sites filled. Theoretical capacity ${f0(96485 / (S.chem === "NMC" ? 97.28 : 157.76) / 3.6)} mAh per gram.`,
      why: "NMC packs more energy into each kilogram, but uses nickel and cobalt; about 73 % of mined cobalt comes from one country, the Democratic Republic of the Congo." + R("usgs_co") + " LFP uses abundant iron and phosphate and is cheaper, and it now makes up over half of new EV batteries." + R("iea_gevo", "bnef"),
    }] },
    { n: 450, stops: [{
      view: "chain", beacon: [0, 3, 0], bs: 60, panel: "sec-results",
      title: "Life-cycle assessment: from cradle to grave",
      text: "A life-cycle assessment (LCA) adds up the energy, carbon dioxide (CO₂e: all greenhouse gases counted as CO₂) and water for every step: mining, refining, making materials, building cells, using them and recycling them. Engineers use it to find where a product's footprint really comes from, so they fix the biggest parts first. In a full study of an NMC pack, the cathode powder was 39 % of the greenhouse gases, aluminium 17 % and cell production 19 %." + R("dai", "mohr"),
      plain: "Total footprint = sum over every step of (amount of material or energy) × (emissions per unit).",
      eq: "GWP = Σ<sub>stages</sub> m<sub>i</sub> × EF<sub>i</sub>;   per kWh delivered = (GWP<sub>make</sub> + GWP<sub>end of life</sub>) / E<sub>life</sub> + (1/η − 1) × grid intensity",
      live: () => `Making 1 kWh of ${chemName(S)} cells: ${f0(L().make)} kg CO₂e; biggest step: ${L().top}. Over ${f0(S.cycles)} cycles it delivers ${f0(L().lifeKWh)} kWh per kWh of battery → ${f0(L().life * 1000)} g CO₂e per kWh delivered (of which charging losses ${f0(L().useLoss * 1000)} g).`,
      note: () => L().caveat,
      why: "LCA decides whether an electric car really cuts emissions, and by how much, depending on where it is built and charged; for a medium car bought in 2035, the IEA projects that a gasoline car emits about two and a half times as much over its life as an electric one." + R("iea_lca") + " It is also how governments set rules for battery carbon footprints." + R("eu_reg"),
    }, {
      view: "factory", beacon: B(X.AT.factory, -25, 10, -40), bs: 6, panel: "sec-chain",
      title: "The cell factory runs on electricity",
      text: "Coating electrodes, drying off the solvent in long ovens, keeping dry rooms bone-dry and giving every cell its first slow charge (formation) take about 30 MJ of electricity and 140 MJ of steam per kWh of cells in one detailed study. So the same factory makes a much lower-carbon battery on a clean grid than on a coal-heavy one." + R("dai", "ember"),
      plain: "Factory footprint = electricity per kWh of cells × grams of CO₂ per kWh of grid electricity.",
      eq: "GWP<sub>cell mfg</sub> = e<sub>mfg</sub> × CI<sub>grid</sub>",
      live: () => L().mfgNote,
      why: "Battery makers are building factories next to hydro, wind and solar power partly for this reason, and rules like the EU Batteries Regulation now require carbon-footprint declarations." + R("eu_reg"),
    }, {
      view: "recycle", beacon: B(X.AT.recycle, 10, 2, -60), bs: 8, panel: "sec-recycle",
      title: "Choosing the end of life",
      text: "At the end of life, the choice of process matters. Smelting (pyrometallurgy) at about 1,450 °C is simple and takes mixed scrap, but loses lithium, aluminium and manganese to the slag. Leaching (hydrometallurgy) recovers more, including lithium, but uses more chemicals and water. Landfilling wastes the metals and risks fires and leaks." + R("harper", "bruckner", "hanna"),
      plain: "Recovered metal replaces newly mined metal, so it earns a credit on the footprint.",
      eq: "GWP<sub>EoL</sub> = process emissions − Σ (recovered mass × footprint of the virgin metal it replaces)",
      live: () => L().eolNote,
      why: "Recycling cuts mining, keeps critical minerals at home, and is now required: the EU sets minimum recovery of lithium, cobalt, nickel and copper." + R("eu_reg"),
    }] },
    { n: 470, stops: [{
      view: "ev", beacon: [X.HERO.x, 0.6, X.HERO.z], bs: 1.5, panel: "sec-cell",
      title: "The battery-management system",
      text: "A battery-management system (BMS) is the pack's control computer. It charges at constant current until the voltage reaches the limit, then holds that voltage and lets the current taper off (CC–CV). It also watches every cell's voltage and temperature and cuts power if something goes wrong.",
      plain: "Measure, compare with the limit, adjust the current, again and again many times a second.",
      eq: "CC: I = C·Q until V = V<sub>max</sub>;  CV: choose I so V(I) = V<sub>max</sub>; stop when I < Q/20",
      live: () => `${chemName(S)} at ${S.C} C: ${f0(CY().tCharge / 60)} min to recharge ${f0(S.dod * 100)} %, of which ${f0(CY().tCV / 60)} min at constant voltage.`,
      why: "Smart control makes fast charging possible without plating lithium or overheating, and lets the pack last for many years.",
    }] },
    { n: 512, stops: [{
      view: "ev", beacon: [X.HERO.x - 15, 1.2, X.HERO.z - 11], bs: 2.5, panel: "sec-chain",
      title: "Batteries and the energy system",
      text: "An electric car is only as clean as the electricity that charges it and the factory that built its battery. Batteries also store solar and wind power for when the sun is down and the wind is calm, and grid-scale battery storage is growing fast." + R("iea_gevo", "ember"),
      plain: "Footprint per kWh delivered = battery footprint ÷ lifetime energy + losses × grid carbon.",
      eq: "g CO₂e/kWh<sub>delivered</sub> = (GWP<sub>make</sub> + GWP<sub>EoL</sub>)/E<sub>life</sub> + CI<sub>grid</sub> (1/η − 1)",
      live: () => L().gridNote,
      why: "Cleaner grids shrink both the factory and the charging footprint. Cheaper batteries also make electric cars and home storage affordable to more people." + R("bnef"),
    }] },
    { n: 540, stops: [{
      view: "cell", beacon: B(X.AT.cell, 0, 36, 0), bs: 4, panel: "sec-cell",
      title: "A plastic film keeps the electrodes apart",
      text: "Between anode and cathode sits the separator: a polyethylene or polypropylene film thinner than a hair, full of tiny pores filled with liquid electrolyte. Ions pass through the pores; electrons cannot. A polymer binder (PVDF) glues the particles to the metal foils.",
      plain: "More open, less twisty pores let ions through more easily: less resistance, less heat.",
      eq: "κ<sub>eff</sub> = κ ε<sup>1.5</sup> (Bruggeman);   R<sub>sep</sub> = L<sub>sep</sub> / (κ ε<sup>1.5</sup> A)",
      live: () => { const cc = c(), k = kappaE(cc.ce, S.Tamb + 273.15); return `${f0(cc.Ls * 1e6)} µm separator, ${f0(cc.epsSep * 100)} % open pores; electrolyte conducts ${f2(k)} S/m at ${S.Tamb} °C → separator adds ${f2(cc.Ls / (k * cc.epsSep ** 1.5) / cc.A * 1000)} mΩ of the cell's ${f2(rOhm(S.chem, S.Tamb + 273.15) * 1000)} mΩ.`; },
      why: "Some separators melt and close their pores if the cell overheats, shutting the current off: a polymer safety fuse. Binders made without toxic solvents are a current sustainability goal.",
    }] },
  ].map(Lz => ({ ...Lz, stops: Lz.stops.map(s => ({ ...s, text: typeof s.text === "function" ? s.text() : s.text, note: typeof s.note === "function" ? undefined : s.note, noteFn: typeof s.note === "function" ? s.note : null })) }))
   .map(Lz => ({ ...Lz, stops: Lz.stops.map(s => SHORT[s.title] ? { ...s, ...SHORT[s.title] } : s) }));
}

export function SPOTS(X, LENSES) {
  // short titles (shown in the spots table), in supply-chain order; `site` is where the spot sits in the overview
  const idx = n => LENSES.findIndex(l => l.n === n);
  const B = (at, dx, dy, dz) => [at.x + dx, at.y + dy, at.z + dz];
  return [
    { name: "Brine ponds", lens: idx(311), site: "mine", pos: B(X.AT.mine, -35, 4, -135) },
    { name: "Refinery: lithium per kWh", lens: idx(250), site: "refinery", pos: B(X.AT.refinery, 70, 30, 20) },
    { name: "Materials: cathode crystals", lens: idx(440), site: "materials", pos: B(X.AT.materials, 10, 12, 20) },
    { name: "Cell factory energy", lens: idx(450), stop: 1, site: "factory", pos: B(X.AT.factory, -25, 12, -40) },
    { name: "EV: charging control", lens: idx(470), site: "ev", pos: [X.HERO.x, 4, X.HERO.z], maxD: 200 },
    { name: "Charger and the grid", lens: idx(512), site: "ev", pos: [X.HERO.x - 15, 5.5, X.HERO.z - 11], maxD: 200 },
    { name: "Module: heat and cooling", lens: idx(326), site: "ev", pos: B(X.AT.module, 0, 10, 0), maxD: 400 },
    { name: "Cell: the computer model", lens: idx(255), site: "ev", pos: B(X.AT.cell, 0, 74, 0), maxD: 400 },
    { name: "Separator film", lens: idx(540), site: "ev", pos: B(X.AT.cell, 6, 40, 6), maxD: 400 },
    { name: "Particles: lithium diffusion", lens: idx(320), site: "ev", pos: B(X.AT.particles, -14, 42, 0), maxD: 400 },
    { name: "Reactions and aging", lens: idx(430), site: "ev", pos: B(X.AT.particles, 0, 46, 0), maxD: 400 },
    { name: "Where voltage comes from", lens: idx(310), site: "ev", pos: B(X.AT.lattice, 14, 30, 0), maxD: 400 },
    { name: "Leaching: mass balance", lens: idx(250), stop: 1, site: "recycle", pos: B(X.AT.recycle, -7, 16, -10) },
    { name: "Solvent extraction", lens: idx(426), site: "recycle", pos: B(X.AT.recycle, 50, 8, -10) },
    { name: "Smelt or leach?", lens: idx(450), stop: 2, site: "recycle", pos: B(X.AT.recycle, 10, 22, -60) },
    { name: "Life-cycle footprint", lens: idx(450), site: "chain", pos: [0, 6, 60] },
  ];
}
export { introHTML, aboutHTML } from "./text.js";
