// ∑ Model panel content: every equation below is one that models.js (or scene.js for NDVI) actually evaluates,
// written with the code's symbols and units. ref: numbers in the page's single References list (app.js REFS).
// Items without a source are marked "assumed" (chosen or tuned for this twin).
import * as M from "./models.js";

const T = String.raw;
const gdd = (tx, tn) => Math.max(0, (Math.min(tx, 30) + Math.max(tn, 10)) / 2 - 10);   // same as models.js gddOf

// c = { R, ctl, day, fmt, dateOf, mid } -> live text
export const GROUPS = [
  { title: "Weather and soil water", subj: [250, 426, 255], eqs: [
    { name: "Extraterrestrial radiation", ref: [9], go: "lens:426",
      tex: T`R_a=\frac{24\cdot 60}{\pi}\,G_{sc}\,d_r\left[\omega_s\sin\varphi\sin\delta+\cos\varphi\cos\delta\sin\omega_s\right]`,
      sym: [["R_a", "solar radiation at the top of the atmosphere", "MJ m⁻² d⁻¹", "computed daily"], ["G_{sc}", "solar constant", "MJ m⁻² min⁻¹", "0.0820"],
        ["d_r", "inverse relative Earth–Sun distance", "–", "0.967–1.033 (FAO-56 eq. 23)"], ["\\omega_s", "sunset hour angle", "rad", "FAO-56 eq. 25"],
        ["\\varphi", "latitude (Madison)", "rad", "43.07° N"], ["\\delta", "solar declination", "rad", "FAO-56 eq. 24"]],
      live: c => `${c.dateOf(c.day)}: R_a = ${c.fmt(c.R.wx.ra[c.day], 1)} MJ m⁻² d⁻¹.` },
    { name: "Solar radiation at the ground (Ångström)", ref: [9], go: "lens:255",
      tex: T`R_s=\left(a_s+b_s\,\tfrac{n}{N}\right)R_a`,
      assumed: "Sunshine fraction n/N = 0.25 on wet days and 0.60 on dry days, chosen for Madison-like summer weather.",
      sym: [["R_s", "solar radiation reaching the ground", "MJ m⁻² d⁻¹", "computed daily"], ["a_s", "Ångström coefficient (overcast fraction)", "–", "0.25"], ["b_s", "Ångström coefficient", "–", "0.50"],
        ["n", "actual hours of bright sunshine", "h", "n/N = 0.25 (wet) or 0.60 (dry)"], ["N", "maximum possible daylight hours", "h", "from latitude and date"], ["R_a", "extraterrestrial radiation, Eq. (1)", "MJ m⁻² d⁻¹", "computed daily"]],
      live: c => `${c.dateOf(c.day)}: ${c.R.wx.wet[c.day] ? "wet" : "dry"} day, R_s = ${c.fmt(c.R.wx.rs[c.day], 1)} MJ m⁻² d⁻¹.` },
    { name: "Reference evapotranspiration (Hargreaves)", ref: [9], go: "lens:426",
      tex: T`ET_0=0.0023\,(T_{mean}+17.8)\,(T_{max}-T_{min})^{0.5}\;0.408\,R_a`,
      sym: [["ET_0", "reference evapotranspiration (well-watered grass)", "mm d⁻¹", "computed daily"], ["T_{mean}", "daily mean air temperature", "°C", "synthetic weather"],
        ["T_{max}", "daily maximum air temperature", "°C", "synthetic weather"], ["T_{min}", "daily minimum air temperature", "°C", "synthetic weather"],
        ["0.408", "1/λ: converts MJ m⁻² of energy to mm of evaporated water", "mm m² MJ⁻¹", "λ = 2.45 MJ kg⁻¹"], ["R_a", "extraterrestrial radiation, Eq. (1)", "MJ m⁻² d⁻¹", "computed daily"]],
      live: c => `${c.dateOf(c.day)}: T_max ${c.fmt(c.R.wx.tmax[c.day], 1)} °C, T_min ${c.fmt(c.R.wx.tmin[c.day], 1)} °C → ET₀ = ${c.fmt(c.R.wx.et0[c.day], 1)} mm/day.` },
    { name: "Crop coefficient from canopy cover", ref: [9], go: "lens:426",
      tex: T`f_c=1-e^{-k\,LAI},\qquad K_c=K_{c,ini}+\left(K_{c,mid}-K_{c,ini}\right)\min\!\left(1,\ \tfrac{f_c}{0.85}\right)`,
      assumed: "Interpolating K_c by canopy cover (reaching K_c,mid at 85 % cover) replaces FAO-56's fixed stage lengths; k is chosen, not cited.",
      sym: [["f_c", "fraction of the ground covered by leaves", "–", "0–1"], ["k", "canopy light-extinction coefficient", "–", "corn 0.65, soybean 0.55"], ["LAI", "leaf area index (leaf area per ground area)", "m² m⁻²", "0 to about 5"],
        ["K_c", "crop coefficient: crop water use relative to ET₀", "–", "computed daily"], ["K_{c,ini}", "crop coefficient for bare, young crop (FAO-56 Table 12)", "–", "corn 0.30, soybean 0.40"], ["K_{c,mid}", "crop coefficient at full canopy (FAO-56 Table 12)", "–", "corn 1.20, soybean 1.15"]],
      live: c => { const f = 1 - Math.exp(-0.65 * c.R.lai[c.day]); return `${c.dateOf(c.day)}: field LAI ${c.fmt(c.R.lai[c.day], 1)} → f_c = ${c.fmt(f, 2)}, K_c = ${c.fmt(0.3 + 0.9 * Math.min(1, f / 0.85), 2)}.`; } },
    { name: "Available water in the root zone", ref: [9], go: "lens:250:1",
      tex: T`TAW=1000\,(\theta_{FC}-\theta_{WP})\,Z_r\,w_z,\qquad RAW=p\,TAW`,
      assumed: "The zone water-holding factor w_z (a swale and a sandy knoll) is an illustrative field map.",
      sym: [["TAW", "total water the root zone can supply", "mm", "about 130–260"], ["\\theta_{FC}", "soil water content at field capacity (silt loam)", "m³ m⁻³", "0.32 (FAO-56 Table 19 range)"],
        ["\\theta_{WP}", "soil water content at wilting point", "m³ m⁻³", "0.14"], ["Z_r", "rooting depth (FAO-56 Table 22 range)", "m", "corn 1.2, soybean 1.0"],
        ["w_z", "zone water-holding factor", "–", "about 0.6–1.2"], ["RAW", "readily available water: what roots take up without stress", "mm", "p × TAW"], ["p", "depletion fraction before stress starts (Table 22)", "–", "corn 0.55 (+0.10 drought trait), soybean 0.50"]],
      live: c => { const r = c.mid().rec; return `Middle zone: TAW = ${c.fmt(r.TAW)} mm, RAW = ${c.fmt((M.CROPS.corn.p + M.TRAITS[c.ctl.trait].dp) * r.TAW)} mm.`; } },
    { name: "Water-stress coefficient", ref: [9], go: "lens:426",
      tex: T`K_s=\min\!\left(1,\ \frac{TAW-D_r}{(1-p)\,TAW}\right)\ \ (=1\ \text{while}\ D_r\le RAW),\qquad ET_c=K_s\,K_c\,ET_0`,
      sym: [["K_s", "water-stress coefficient (1 = no stress)", "–", "0–1"], ["TAW", "total available water, Eq. (5)", "mm", "about 130–260"], ["D_r", "root-zone depletion: water used since the soil was full", "mm", "0 to TAW"],
        ["p", "depletion fraction, Eq. (5)", "–", "0.50–0.65"], ["RAW", "readily available water, Eq. (5)", "mm", "p × TAW"], ["ET_c", "actual crop evapotranspiration", "mm d⁻¹", "computed daily"], ["K_c", "crop coefficient, Eq. (4)", "–", "0.30–1.20"], ["ET_0", "reference evapotranspiration, Eq. (3)", "mm d⁻¹", "computed daily"]],
      live: c => { const r = c.mid().rec; return `${c.dateOf(c.day)}, middle zone: D_r = ${c.fmt(r.Dr[c.day])} mm, K_s = ${c.fmt(r.ks[c.day], 2)}, ET_c = ${c.fmt(r.et[c.day], 1)} mm.`; } },
    { name: "Root-zone water balance", ref: [9], go: "lens:250:1",
      tex: T`D_{r,i}=D_{r,i-1}-(P-RO)_i-I_i+ET_{c,i}+DP_i,\qquad 0\le D_{r,i}\le TAW`,
      assumed: "Pivot rule: 25 mm whenever D_r exceeds 0.8 RAW (a simple on–off controller chosen for the twin).",
      sym: [["D_{r,i}", "root-zone depletion at the end of day i", "mm", "0 to TAW"], ["i", "day of the season", "–", "0 (Apr 1) to 213 (Oct 31)"], ["P", "rain", "mm d⁻¹", "synthetic weather"], ["RO", "surface runoff, Eq. (8)", "mm d⁻¹", "computed"],
        ["I", "irrigation from the pivot", "mm d⁻¹", "0 or 25"], ["ET_{c}", "crop evapotranspiration, Eq. (6)", "mm d⁻¹", "computed"], ["DP", "drainage below the roots: the water that would make D_r negative", "mm d⁻¹", "computed"], ["TAW", "total available water, Eq. (5)", "mm", "about 130–260"]],
      live: c => { const a = c.R.farm.agg; return `Season (field average): ${c.fmt(a.rain)} + ${c.fmt(a.irr)} − ${c.fmt(a.runoff)} − ${c.fmt(a.et)} − ${c.fmt(a.drain)} = ${c.fmt(a.rain + a.irr - a.runoff - a.et - a.drain)} mm change in storage.`; } },
    { name: "Runoff (SCS curve number)", ref: [38, 31], go: "lens:547",
      tex: T`RO=\frac{(P-I_a)^2}{P-I_a+S}\ \ (P>I_a),\qquad S=\frac{25400}{CN}-254,\quad I_a=0.2\,S`,
      assumed: "CN 75 with a cover crop is chosen; CN 78 is the TR-55 table value.",
      sym: [["RO", "surface runoff", "mm d⁻¹", "0 when P ≤ I_a"], ["P", "daily rain", "mm d⁻¹", "synthetic weather"], ["I_a", "initial abstraction: rain soaked up before runoff starts", "mm", "0.2 S = 14.3 at CN 78"],
        ["S", "potential maximum retention", "mm", "71.6 at CN 78"], ["CN", "curve number: row crops, straight row, good condition, soil group B", "–", "78 (75 with cover crop)"]],
      live: c => `Season runoff: ${c.fmt(c.R.farm.agg.runoff)} mm of ${c.fmt(c.R.farm.agg.rain)} mm rain (CN ${c.ctl.cover ? 75 : 78}).` },
  ] },
  { title: "Crop growth", subj: [255, 560], eqs: [
    { name: "Growing degree-days (corn method)", ref: [37], go: "lens:255",
      tex: T`GDD_i=\max\!\left(0,\ \frac{\min(T_{max},30)+\max(T_{min},10)}{2}-10\right)`,
      assumed: "Thermal times to silking and maturity (corn 750 and 1400 °C d; soybean 650 and 1200) are tuned so corn matures in a normal year.",
      sym: [["GDD_i", "growing degree-days gained on day i (summed from planting)", "°C d", "0 to 20 per day"], ["T_{max}", "daily maximum air temperature, capped at 30 °C", "°C", "synthetic weather"], ["T_{min}", "daily minimum air temperature, raised to the 10 °C base", "°C", "synthetic weather"]],
      live: c => { const p = M.CROPS.corn.plant - M.DOY0; let g = 0; for (let i = p; i <= c.day; i++) g += gdd(c.R.wx.tmax[i], c.R.wx.tmin[i]); return c.day < p ? "Corn is not planted yet (May 5)." : `Corn GDD since planting on ${c.dateOf(c.day)}: ${c.fmt(g)} °C d of ${M.CROPS.corn.gddMat}.`; } },
    { name: "Radiation-use-efficiency growth", ref: [11, 35], go: "lens:255",
      tex: T`\Delta W_i=0.01\;RUE\;R_{s,i}\left(1-e^{-k\,LAI_i}\right)\min\!\left(K_{s,i},\,F_{N,i}\right)`,
      assumed: "Soybean RUE (0.6 g/MJ), k, maximum LAI and the LAI curve are chosen, not cited.",
      sym: [["\\Delta W_i", "crop dry mass added on day i", "t ha⁻¹ d⁻¹", "0 to about 0.3"], ["0.01", "converts g m⁻² to t ha⁻¹", "", ""], ["RUE", "radiation-use efficiency: dry mass per unit of sunlight caught", "g MJ⁻¹", "corn 1.5 (refs: 1.5–1.86); soybean 0.6"],
        ["R_{s,i}", "solar radiation, Eq. (2)", "MJ m⁻² d⁻¹", "computed daily"], ["k", "light-extinction coefficient", "–", "corn 0.65, soybean 0.55"], ["LAI_i", "leaf area index", "m² m⁻²", "up to 5.2 (corn), 4.5 (soybean)"],
        ["K_{s,i}", "water-stress coefficient, Eq. (6)", "–", "0–1"], ["F_{N,i}", "nitrogen-stress factor, Eq. (11)", "–", "0–1"]],
      live: c => { const f = 1 - Math.exp(-0.65 * c.R.lai[c.day]); return `${c.dateOf(c.day)}: unstressed growth 1.5 × ${c.fmt(c.R.wx.rs[c.day], 1)} × ${c.fmt(f, 2)} = ${c.fmt(1.5 * c.R.wx.rs[c.day] * f, 1)} g m⁻² d⁻¹.`; } },
    { name: "Critical N curve and nitrogen nutrition index", ref: [10], go: "lens:250",
      tex: T`N_c=34\,W^{0.64}\ (W\ge 1),\ \ 34\,W\ (W<1),\quad NNI=\min\!\left(1.2,\frac{N_{up}}{N_c}\right),\quad F_N=\mathrm{clip}_{[0,1]}\frac{NNI-NNI_0}{0.95-NNI_0}`,
      assumed: "The stress threshold NNI₀ and the linear ramp to 0.95 are chosen for the twin.",
      sym: [["N_c", "critical N uptake: the least N for full growth (maize)", "kg N ha⁻¹", "computed"], ["W", "crop dry mass", "t ha⁻¹", "0 to about 25"], ["NNI", "nitrogen nutrition index", "–", "0–1.2"],
        ["N_{up}", "N taken up by the crop so far", "kg N ha⁻¹", "state"], ["F_N", "nitrogen-stress factor on growth", "–", "0–1"], ["NNI_0", "NNI at which growth stops", "–", "0.35; 0.25 N-efficient trait"]],
      live: c => { const r = c.mid().rec; return `${c.dateOf(c.day)}, middle zone: W = ${c.fmt(r.W[c.day], 1)} t/ha, N_up = ${c.fmt(r.nup[c.day])} kg/ha, NNI = ${c.fmt(r.nni[c.day], 2)}.`; } },
    { name: "Grain yield", ref: [], go: "lens:560",
      tex: T`Y=W\cdot HI_0\left[1-s\,(1-\bar K_{s,silk})\right](1-\ell_{pest})`,
      assumed: "Harvest index, pollination sensitivity and insect loss are illustrative values chosen for the twin.",
      sym: [["Y", "grain yield (dry matter)", "t ha⁻¹", "computed"], ["W", "crop dry mass at maturity", "t ha⁻¹", "computed"], ["HI_0", "harvest index: grain share of crop mass", "–", "corn 0.50, soybean 0.42"],
        ["s", "pollination sensitivity to water stress", "–", "0.6; 0.3 drought trait; soybean 0.4"], ["\\bar K_{s,silk}", "mean water-stress coefficient within ±100 °C d of silking", "–", "0–1"], ["\\ell_{pest}", "share of yield lost to insects", "–", "0.06 conventional, 0.01 Bt"]],
      live: c => `Field average: ${c.fmt(c.R.farm.agg.grainDM, 2)} t/ha dry grain = ${c.fmt(M.buAc(c.R.farm.agg.grainDM))} bu/acre (56 lb bushel at 15.5 % moisture).` },
  ] },
  { title: "Soil nitrogen", subj: [250, 320, 430, 311], eqs: [
    { name: "Mineral N balance (daily)", ref: [3], go: "lens:250",
      tex: T`N_{i}=N_{i-1}+F_i\,(1-f_{gas}-f_{nit})+m_i-L_i-R_{N,i}-D_i-U_i`,
      assumed: "Starting soil N (20 kg N/ha), the timing of the fertilizer passes and the form of each loss term are chosen for the twin.",
      sym: [["N_i", "soil mineral N (nitrate + ammonium) at the end of day i", "kg N ha⁻¹", "20 on Apr 1"], ["F_i", "fertilizer applied on day i", "kg N ha⁻¹", "fall, spring, or 40/60 split"],
        ["f_{gas}", "share lost as ammonia, Eq. (14)", "–", "0.11 (IPCC)"], ["f_{nit}", "share lost as N₂O during nitrification", "–", "0.004"], ["m_i", "net mineralization, Eq. (15)", "kg N ha⁻¹ d⁻¹", "computed"],
        ["L_i", "nitrate leaching, Eq. (16)", "kg N ha⁻¹ d⁻¹", "computed"], ["R_{N,i}", "N lost in runoff, Eq. (19)", "kg N ha⁻¹ d⁻¹", "computed"], ["D_i", "denitrification, Eq. (17)", "kg N ha⁻¹ d⁻¹", "computed"], ["U_i", "crop uptake, Eq. (18)", "kg N ha⁻¹ d⁻¹", "computed"]],
      live: c => { const a = c.R.farm.agg, mz = c.R.farm.zones.reduce((s, z) => s + z.res.tot.minz, 0) / c.R.farm.zones.length; return `Season: fertilizer ${c.fmt(a.fert)}, mineralized ${c.fmt(mz)}; crop ${c.fmt(a.nup)}, leached ${c.fmt(a.leach, 1)}, NH₃ ${c.fmt(M.N.fracGASF * a.fert, 1)}, denitrified ${c.fmt(a.den, 1)}, runoff ${c.fmt(a.nro, 1)} kg N/ha.`; } },
    { name: "Ammonia volatilization and nitrification N₂O", ref: [3], go: "lens:311",
      tex: T`N_{NH_3}=Frac_{GASF}\,F,\qquad N_2O_{nit}=f_{nit}\,F`,
      assumed: "f_nit = 0.004 is chosen; with Eq. (17) it brings a normal year near the IPCC 1 % default.",
      sym: [["N_{NH_3}", "N lost to the air as ammonia", "kg N ha⁻¹", "computed"], ["Frac_{GASF}", "share of synthetic fertilizer N volatilized", "–", "0.11 (IPCC 2019 default)"], ["F", "fertilizer N applied", "kg N ha⁻¹", "control"],
        ["N_2O_{nit}", "N₂O-N emitted during nitrification", "kg N ha⁻¹", "computed"], ["f_{nit}", "N₂O-N per kg fertilizer N from nitrification", "–", "0.004"]],
      live: c => `Applied ${c.fmt(c.R.farm.agg.fert)} kg N/ha → ${c.fmt(M.N.fracGASF * c.R.farm.agg.fert, 1)} kg N/ha as NH₃.` },
    { name: "Net mineralization", ref: [], go: "lens:250",
      tex: T`m=m_{pot}\;o_z\;2^{(T_{mean}-20)/10}\left(0.4+0.6\,\frac{TAW-D_r}{TAW}\right)`,
      assumed: "The rate, the temperature factor (Q₁₀ = 2) and the moisture factor are chosen and tuned for the twin.",
      sym: [["m", "net N released from soil organic matter", "kg N ha⁻¹ d⁻¹", "computed"], ["m_{pot}", "mineralization at 20 °C in moist soil", "kg N ha⁻¹ d⁻¹", "0.75"], ["o_z", "zone organic-matter factor", "–", "about 0.6–1.4 (field map)"],
        ["T_{mean}", "daily mean air temperature (0 below 0 °C)", "°C", "synthetic weather"], ["TAW", "total available water, Eq. (5)", "mm", "about 130–260"], ["D_r", "root-zone depletion, Eq. (7)", "mm", "0 to TAW"]],
      live: c => `Season mineralization, field average: ${c.fmt(c.R.farm.zones.reduce((s, z) => s + z.res.tot.minz, 0) / c.R.farm.zones.length)} kg N/ha.` },
    { name: "Nitrate leaching (well-mixed cell)", ref: [6], go: "lens:320",
      tex: T`L=0.9\,N\,\frac{DP}{W_{FC}+DP},\qquad W_{FC}=1000\,\theta_{FC}\,Z_r\,w_z,\qquad c_{NO_3}=\frac{100\,L_{yr}}{\sum DP+DP_{winter}}`,
      assumed: "The well-mixed-cell form, the 0.9 mobile share and the overwinter drainage are chosen; the 10 mg/L limit is the EPA standard.",
      sym: [["L", "nitrate leached on a day", "kg N ha⁻¹ d⁻¹", "computed"], ["0.9", "share of mineral N that is mobile nitrate", "–", "0.9"], ["N", "soil mineral N", "kg N ha⁻¹", "state"], ["DP", "drainage below the roots, Eq. (7)", "mm d⁻¹", "computed"],
        ["W_{FC}", "water held in the root zone at field capacity", "mm", "384 for an average zone"], ["\\theta_{FC}", "water content at field capacity", "m³ m⁻³", "0.32"], ["Z_r", "rooting depth", "m", "1.2"], ["w_z", "zone water-holding factor", "–", "about 0.6–1.2"],
        ["c_{NO_3}", "average nitrate-N in drainage water (limit 10)", "mg L⁻¹", "computed"], ["100", "converts kg ha⁻¹ per mm of water to mg L⁻¹", "", ""], ["L_{yr}", "nitrate leached over the year", "kg N ha⁻¹", "computed"], ["DP_{winter}", "overwinter drainage", "mm", "normal 150, wet 230, dry 90"]],
      live: c => `Leached over the year ${c.fmt(c.R.farm.agg.leach, 1)} kg N/ha → ${c.fmt(c.R.farm.agg.nitrate, 1)} mg/L nitrate-N.` },
    { name: "Denitrification and N₂O", ref: [3], go: "lens:250",
      tex: T`D=k_{den}\,N\,2^{(T_{mean}-20)/10}\left[\max\!\left(0,\frac{w-0.75}{0.25}\right)\right]^2,\qquad N_2O=r_{N_2O}\,D+f_{nit}F`,
      assumed: "k_den, the wetness threshold and r_N2O are chosen, scaled so a normal year emits close to the IPCC EF₁ of 1 %.",
      sym: [["D", "N lost as gas by denitrification (N₂ and N₂O)", "kg N ha⁻¹ d⁻¹", "computed"], ["k_{den}", "denitrification rate in saturated soil at 20 °C", "d⁻¹", "0.006"], ["N", "soil mineral N", "kg N ha⁻¹", "state"],
        ["T_{mean}", "daily mean air temperature", "°C", "synthetic weather"], ["w", "relative soil wetness, 1 − D_r/TAW", "–", "0–1"], ["N_2O", "N₂O-N emitted", "kg N ha⁻¹", "computed"],
        ["r_{N_2O}", "N₂O share of denitrified N", "–", "0.06"], ["f_{nit}", "nitrification N₂O factor, Eq. (14)", "–", "0.004"], ["F", "fertilizer N applied", "kg N ha⁻¹", "control"]],
      live: c => `Season: denitrified ${c.fmt(c.R.farm.agg.den, 1)}, N₂O ${c.fmt(c.R.farm.agg.n2o, 2)} kg N/ha = ${c.fmt(100 * c.R.farm.agg.n2o / Math.max(1, c.R.farm.agg.fert), 2)} % of applied N.` },
    { name: "Crop N uptake (saturating)", ref: [10], go: "lens:430",
      tex: T`U=\min\!\left(N_c-N_{up},\ u_{max}\,\tau\,\min\!\left(1,\tfrac{GDD}{500}\right)\frac{N}{N+K_N}\,(0.5+0.5\,K_s)\right)`,
      assumed: "u_max, K_N, the root-growth ramp and the water factor are chosen; the demand cap uses the cited critical-N curve.",
      sym: [["U", "N taken up by the crop on a day", "kg N ha⁻¹ d⁻¹", "computed"], ["N_c", "critical N uptake, Eq. (11)", "kg N ha⁻¹", "computed"], ["N_{up}", "N already taken up", "kg N ha⁻¹", "state"],
        ["u_{max}", "maximum uptake rate of a full root system", "kg N ha⁻¹ d⁻¹", "6.0"], ["\\tau", "trait factor", "–", "1.0; 1.3 N-efficient (illustrative)"], ["GDD", "growing degree-days since planting, Eq. (9)", "°C d", "0 to 1400"],
        ["N", "soil mineral N", "kg N ha⁻¹", "state"], ["K_N", "soil N at half the maximum rate", "kg N ha⁻¹", "25"], ["K_s", "water-stress coefficient, Eq. (6)", "–", "0–1"]],
      live: c => `${c.dateOf(c.day)}: soil N ${c.fmt(c.R.nmin[c.day])} kg/ha → maximum rate ${c.fmt(6 * c.R.nmin[c.day] / (c.R.nmin[c.day] + 25), 2)} kg N ha⁻¹ d⁻¹ before root, water and demand limits.` },
    { name: "N in runoff", ref: [], go: "lens:547",
      tex: T`R_N=0.02\,N\,\frac{RO}{RO+10}`,
      assumed: "The 2 % mixing-layer share and the 10 mm half-loss runoff are chosen for the twin.",
      sym: [["R_N", "N washed off in surface runoff", "kg N ha⁻¹ d⁻¹", "computed"], ["0.02", "share of mineral N in the thin surface mixing layer", "–", "0.02"], ["N", "soil mineral N", "kg N ha⁻¹", "state"], ["RO", "runoff, Eq. (8)", "mm d⁻¹", "computed"], ["10", "runoff at which half the maximum loss occurs", "mm", "10"]],
      live: c => `Season: ${c.fmt(c.R.farm.agg.nro, 2)} kg N/ha in runoff.` },
  ] },
  { title: "Economics and control", subj: [450, 470, 355], eqs: [
    { name: "Return over N cost and the variable-rate controller", ref: [5, 4], go: "lens:470",
      tex: T`\pi(r)=Y_{bu}(r)-\rho\;0.8922\,r,\qquad r_z^\star=\arg\max_{r\in\{0,10,\dots,260\}}\ \pi_z\!\left(r;\ \hat o_z,\hat w_z,\ \text{normal weather}\right)`,
      assumed: "The price ratio ρ = 0.10 and the ±8 % sensor error are chosen; the maximum-return-to-N idea follows the MRTN approach.",
      sym: [["\\pi", "return over nitrogen cost, in bushels of corn per acre", "bu acre⁻¹", "computed"], ["r", "nitrogen rate", "kg N ha⁻¹", "0–300"], ["Y_{bu}", "corn yield", "bu acre⁻¹", "computed"],
        ["\\rho", "price ratio: $ per lb N divided by $ per bushel", "–", "0.10"], ["0.8922", "converts kg ha⁻¹ to lb acre⁻¹", "", ""], ["r_z^\\star", "rate the controller chooses for zone z", "kg N ha⁻¹", "computed (96 zones)"],
        ["\\pi_z", "return predicted for zone z", "bu acre⁻¹", "computed"], ["\\hat o_z", "sensor estimate of the zone's organic-matter factor", "–", "true value ±8 %"], ["\\hat w_z", "sensor estimate of the zone's water-holding factor", "–", "true value ±8 %"]],
      live: c => `Uniform best rate (20 kg grid): ${c.R.best.rate} kg N/ha. Variable rate averages ${c.fmt(c.R.vr.agg.fert)} kg N/ha.` },
  ] },
  { title: "Energy", subj: [310, 512, 430], eqs: [
    { name: "Ammonia, energy and CO₂ behind the fertilizer", ref: [1, 8], go: "lens:310",
      tex: T`m_{NH_3}=m_N\,\frac{17.031}{14.007},\qquad E=e\,m_{NH_3},\qquad m_{CO_2}=2.4\,m_{NH_3}`,
      sym: [["m_{NH_3}", "ammonia needed to supply the field's N", "t", "computed"], ["m_N", "fertilizer N for the 32 ha corn field", "t", "rate × 32 ha"], ["17.031/14.007", "molar mass ratio NH₃ : N", "–", "1.216"],
        ["E", "energy to make the ammonia", "GJ", "computed"], ["e", "energy per tonne of NH₃: best gas plant, world average", "GJ t⁻¹", "28, 41"], ["m_{CO_2}", "CO₂ emitted making it (world average)", "t", "2.4 t per t NH₃"]],
      live: c => `${c.fmt(c.R.hb.tNH3, 2)} t NH₃ → ${c.fmt(c.R.hb.gjBest)}–${c.fmt(c.R.hb.gjAvg)} GJ, ${c.fmt(c.R.hb.co2, 1)} t CO₂.` },
    { name: "Digester electricity", ref: [27], go: "lens:430",
      tex: T`\dot V_{bg}=n_{cow}\,y_{bg},\qquad \dot V_{CH_4}=x_{CH_4}\,\dot V_{bg},\qquad P_e=\frac{\dot V_{CH_4}\,LHV\,\eta_e}{86.4}`,
      assumed: "Methane LHV (35.8 MJ/m³, a standard property value) and the 35 % engine efficiency are not from the cited references.",
      sym: [["\\dot V_{bg}", "biogas produced", "m³ d⁻¹", "computed"], ["n_{cow}", "number of cows", "–", "300"], ["y_{bg}", "biogas per cow", "m³ cow⁻¹ d⁻¹", "1.2"], ["\\dot V_{CH_4}", "methane produced", "m³ d⁻¹", "computed"],
        ["x_{CH_4}", "methane share of biogas", "–", "0.60"], ["P_e", "electrical power", "kW", "computed"], ["LHV", "lower heating value of methane", "MJ m⁻³", "35.8"], ["\\eta_e", "engine-generator efficiency", "–", "0.35"], ["86.4", "MJ per day in one kW", "MJ d⁻¹ kW⁻¹", "86.4"]],
      live: c => c.ctl.digester ? `${c.fmt(c.R.dairy.biogas)} m³/d biogas, ${c.fmt(c.R.dairy.ch4)} m³/d CH₄ → ${c.fmt(c.R.dairy.kw, 1)} kW.` : "Digester is off." },
    { name: "Grain drying heat", ref: [9], go: "lens:326",
      tex: T`m_w=W_g\left(\frac{x}{1-x}-\frac{0.155}{0.845}\right),\qquad Q=\frac{\lambda\,m_w}{\eta_d}`,
      assumed: "The field dry-down rule and the 50 % dryer efficiency are chosen; λ = 2.45 MJ/kg is the FAO-56 value; 15.5 % is the bushel standard.",
      sym: [["m_w", "water the dryer must remove", "kg ha⁻¹", "computed"], ["W_g", "dry grain yield", "kg ha⁻¹", "computed"], ["x", "harvest moisture (wet basis): 0.32 at maturity, drying in the field until Oct 25", "–", "0.17–0.35"],
        ["0.155", "target moisture for storage (wet basis)", "–", "15.5 %"], ["Q", "heat the burner must supply", "MJ ha⁻¹", "computed"], ["\\lambda", "latent heat of vaporization of water", "MJ kg⁻¹", "2.45"], ["\\eta_d", "dryer efficiency", "–", "0.50"]],
      live: c => `Harvest moisture ${c.fmt(100 * c.R.dry.moist, 1)} % → ${c.fmt(c.R.dry.water * M.FIELD_HA / 1000)} t water, ${c.fmt(c.R.dry.mj * M.FIELD_HA / 1000)} GJ for the field.` },
  ] },
  { title: "Phosphorus and the lake", subj: [547, 450, 250], eqs: [
    { name: "Field P loss: dissolved and on eroded soil", ref: [], go: "lens:547",
      tex: T`P_{\mathrm{d}}=\sum_i\left(0.004\,STP+\frac{p_m}{25}e^{-(i-i_m)/20}\right)\frac{RO_i}{100},\qquad P_{\mathrm{p}}=\sum_i 0.03\,RO_i^{1.3}\,C_i\,\frac{1.5\,(600+5\,STP)}{1000}`,
      assumed: "All coefficients in this phosphorus-loss model are illustrative, chosen to give realistic orders of magnitude.",
      sym: [["P_{\\mathrm{d}}", "dissolved P lost in runoff over the season", "kg P ha⁻¹", "computed"], ["i", "day of the season", "–", "0–213"], ["STP", "soil-test phosphorus", "ppm", "45 now"], ["p_m", "manure P spread", "kg P ha⁻¹ yr⁻¹", "computed"],
        ["i_m", "day manure is spread (10 days before planting)", "–", "24"], ["RO_i", "runoff on day i, Eq. (8)", "mm", "computed"], ["P_{\\mathrm{p}}", "P lost on eroded soil particles", "kg P ha⁻¹", "computed"],
        ["C_i", "soil-cover factor e^(−0.5 LAI), halved by a cover crop before July 2", "–", "0–1"], ["600+5\\,STP", "P in the soil; × 1.5 for P-rich fine particles", "mg kg⁻¹", "computed"]],
      live: c => `Season: ${c.fmt(c.R.ploss.dp, 3)} dissolved + ${c.fmt(c.R.ploss.pp, 3)} particulate = ${c.fmt(c.R.ploss.total, 3)} kg P/ha; soil lost ${c.fmt(c.R.ploss.sed, 2)} t/ha.` },
    { name: "Soil-test P build-up", ref: [], go: "lens:450",
      tex: T`\frac{d\,STP}{dt}=\frac{p_m-1000\,W_g\,c_{P,grain}}{18}`,
      assumed: "Manure P per cow, grain P and the soil P buffer are illustrative.",
      sym: [["STP", "soil-test phosphorus", "ppm", "45 now"], ["t", "time", "yr", "–"], ["p_m", "manure P spread: (300 cows × 0.07 kg P/d × 365 − exported) / 300 ha", "kg P ha⁻¹ yr⁻¹", "computed"],
        ["W_g", "dry grain yield", "t ha⁻¹", "computed"], ["c_{P,grain}", "P in grain dry matter", "kg kg⁻¹", "0.0027"], ["18", "kg P per ha needed to raise soil-test P by 1 ppm", "kg ha⁻¹ ppm⁻¹", "18"]],
      live: c => `Manure P ${c.fmt(c.R.dairy.pPerHa, 1)} kg/ha/yr; STP ${M.DAIRY.stp} → ${c.fmt(c.R.sp.stp10)} ppm in 10 years.` },
    { name: "Lake phosphorus (steady-state mass balance with settling)", ref: [39], go: "lens:547",
      tex: T`TP=\frac{W_P}{Q+v_s\,A_s},\qquad W_P=P_{loss}\,A_{farm}+W_{bg}`,
      assumed: "The lake's outflow, settling velocity, area, farmland and other load are illustrative.",
      sym: [["TP", "lake total phosphorus concentration", "µg L⁻¹", "computed"], ["W_P", "phosphorus load to the lake", "kg yr⁻¹", "computed"], ["Q", "outflow", "m³ yr⁻¹", "1.0 × 10⁸"], ["v_s", "apparent settling velocity of P", "m yr⁻¹", "12"],
        ["A_s", "lake surface area", "m²", "4.0 × 10⁷"], ["P_{loss}", "P lost per hectare of farmland, Eq. (24)", "kg P ha⁻¹ yr⁻¹", "computed"], ["A_{farm}", "farmland managed like this farm", "ha", "40,000"], ["W_{bg}", "P from other sources", "kg yr⁻¹", "5,000"]],
      live: c => `Load ${c.fmt(c.R.lake.load / 1000, 1)} t P/yr → TP = ${c.fmt(c.R.lake.tp)} µg/L.` },
    { name: "Carlson trophic state index", ref: [30], go: "lens:547",
      tex: T`TSI=14.42\ln TP+4.15,\qquad Chl=\exp\!\left(\frac{TSI-30.6}{9.81}\right)`,
      sym: [["TSI", "trophic state index (≥ 60: algae blooms)", "–", "computed"], ["TP", "lake total phosphorus, Eq. (26)", "µg L⁻¹", "computed"], ["Chl", "chlorophyll a with the same TSI", "µg L⁻¹", "computed"]],
      live: c => `TSI = ${c.fmt(c.R.lake.tsi, 1)}; matching chlorophyll ${c.fmt(c.R.lake.chl, 1)} µg/L.` },
  ] },
  { title: "Remote sensing (3D view only)", subj: [355], eqs: [
    { name: "Drone NDVI colours", ref: [19], go: "ndvi",
      tex: T`NDVI=\frac{NIR-Red}{NIR+Red}\ \approx\ 0.15+0.75\left(1-e^{-0.6\,LAI}\right)`,
      assumed: "The mapping from modeled LAI to NDVI (used only to colour the drone view) is illustrative; the NDVI definition is from USGS.",
      sym: [["NDVI", "normalized difference vegetation index", "–", "about 0.15–0.9"], ["NIR", "near-infrared reflectance", "–", "0–1"], ["Red", "red reflectance", "–", "0–1"], ["LAI", "leaf area index", "m² m⁻²", "0 to about 5"]],
      live: c => `Field LAI ${c.fmt(c.R.lai[c.day], 1)} → NDVI ≈ ${c.fmt(0.15 + 0.75 * (1 - Math.exp(-0.6 * c.R.lai[c.day])), 2)}.` },
  ] },
];

// every numeric constant in models.js, with source (ref numbers) or "assumed"
export const PARAMS = [
  ["Latitude", "43.07", "° N", "Madison, WI"],
  ["Season", "Apr 1 – Oct 31 (214 days)", "", "assumed"],
  ["Rain totals Apr–Oct: normal, wet, dry", "640, 900, 450", "mm", "assumed (Madison-like)"],
  ["Mean temperature", "8.5 + 15 sin(2π(doy − 108)/365) + anomaly", "°C", "assumed (Madison-like); AR(1) anomaly, φ = 0.7"],
  ["Diurnal range: wet, dry days", "8, 12.5", "°C", "assumed"],
  ["Ångström a<sub>s</sub>, b<sub>s</sub>", "0.25, 0.50", "–", "ref 9"],
  ["Latent heat λ", "2.45", "MJ kg⁻¹", "ref 9"],
  ["K<sub>c,ini</sub>, K<sub>c,mid</sub> corn; soybean", "0.30, 1.20; 0.40, 1.15", "–", "ref 9 (Table 12)"],
  ["θ<sub>FC</sub>, θ<sub>WP</sub> (silt loam)", "0.32, 0.14", "m³ m⁻³", "within ref 9 Table 19 ranges"],
  ["Z<sub>r</sub>, p: corn; soybean", "1.2 m, 0.55; 1.0 m, 0.50", "", "within ref 9 Table 22 ranges"],
  ["Curve number", "78 (75 with cover crop)", "–", "ref 31 (TR-55 table); cover-crop value assumed"],
  ["RUE corn; soybean", "1.5; 0.6", "g MJ⁻¹", "corn refs 11, 35; soybean assumed"],
  ["k corn; soybean", "0.65; 0.55", "–", "assumed"],
  ["LAI<sub>max</sub> corn; soybean", "5.2; 4.5", "m² m⁻²", "assumed"],
  ["GDD to maturity, to silking: corn; soybean", "1400, 750; 1200, 650", "°C d", "assumed (tuned so corn matures in a normal year)"],
  ["Base, upper temperatures for GDD", "10, 30", "°C", "ref 37"],
  ["Harvest index corn; soybean", "0.50; 0.42", "–", "assumed"],
  ["Planting day corn; soybean", "May 5; May 15", "", "assumed"],
  ["Critical N curve", "34 W<sup>0.64</sup>", "kg N ha⁻¹", "ref 10"],
  ["Starting soil mineral N", "20", "kg N ha⁻¹", "assumed"],
  ["m<sub>pot</sub>, u<sub>max</sub>, K<sub>N</sub>, k<sub>den</sub>", "0.75, 6.0, 25, 0.006", "kg ha⁻¹ d⁻¹, kg ha⁻¹ d⁻¹, kg ha⁻¹, d⁻¹", "assumed (tuned: ~219 bu/acre at 150 kg N, best rate near ref 4 guideline)"],
  ["r<sub>N₂O</sub>, f<sub>nit</sub>", "0.06, 0.004", "–", "assumed (tuned to ≈ IPCC EF₁ 1 %, ref 3)"],
  ["Frac<sub>GASF</sub>", "0.11", "–", "ref 3"],
  ["Split timing", "40 % at planting, 60 % 34 days later", "", "assumed"],
  ["Fall N overwinter: leaching, denitrification", "0.9(1 − e<sup>−DP<sub>w</sub>/W<sub>FC</sub></sup>), 8 %", "", "assumed"],
  ["Trait effects (insect loss, p, s, uptake, NNI<sub>0</sub>)", "see Grain yield, Crop N uptake", "", "illustrative; evidence in refs 13, 16, 17"],
  ["Price ratio ρ", "0.10", "$ lb⁻¹ / $ bu⁻¹", "assumed (MRTN approach, refs 4, 5)"],
  ["Sensor error", "uniform ±8 %", "", "assumed"],
  ["Haber–Bosch energy: best, average; CO₂", "28, 41 GJ t⁻¹; 2.4 t t⁻¹", "", "ref 1"],
  ["N≡N bond energy", "941", "kJ mol⁻¹", "ref 8"],
  ["Biogas per cow; CH₄ fraction", "1.2 m³ d⁻¹; 0.60", "", "ref 27"],
  ["Cows; cropland", "300; 300 ha", "", "assumed"],
  ["CH₄ LHV; generator efficiency", "35.8 MJ m⁻³; 0.35", "", "assumed (standard property value; typical engine)"],
  ["Manure P per cow; P recovery share", "0.07 kg d⁻¹; 0.5", "", "assumed"],
  ["Soil-test P; P buffer; grain P", "45 ppm; 18 kg ha⁻¹ ppm⁻¹; 0.0027", "", "assumed"],
  ["Lake: Q, v<sub>s</sub>, A<sub>s</sub>, farmland, other load", "1.0 × 10⁸ m³ yr⁻¹, 12 m yr⁻¹, 40 km², 40,000 ha, 5 t yr⁻¹", "", "illustrative"],
  ["Carlson TSI constants", "14.42, 4.15; 9.81, 30.6", "", "ref 30"],
  ["Dryer: harvest date, dry-down, target moisture, efficiency", "Oct 25; 0.005 T/15 per day; 15.5 %; 0.50", "", "assumed (15.5 % is the bushel standard)"],
  ["Corn bushel; soybean bushel", "25.40 kg at 15.5 %; 27.22 kg at 13 %", "", "standard trade units"],
  ["Corn field; zones", "32 ha; 12 × 8", "", "assumed"],
];

export const METHOD = [
  "Each of the 96 corn zones is simulated for 214 days with an explicit (forward Euler) daily step: Δt = 1 day. Within a day the order is fixed: fertilizer events, water balance (eqs. for runoff, irrigation, ET, drainage), soil-N processes in sequence (mineralization, leaching, runoff N, denitrification), then crop growth and uptake. No iteration or tolerance is needed; depletion is clipped to [0, TAW] and drainage takes the excess, which keeps the water balance exact.",
  "Field values are means over zones; the soybean field is one zone. The yield-response curve reruns all 96 zones at 0–300 kg N/ha in steps of 20; the variable-rate controller evaluates 27 rates (0–260, step 10) per zone with sensor-estimated soil and normal-year weather, about 2,600 seasons, cached per setting.",
  "Weather is synthetic: a seeded random-number generator (mulberry32) draws wet days, exponential rain amounts (rescaled to the year's total) and an AR(1) temperature anomaly, so every visitor sees the same three years.",
  "Phosphorus, lake, energy and drying results are algebraic post-processing of the season (no feedback to crop growth). Changing any control recomputes everything.",
];

export const ASSUMPTIONS = [
  "One-layer soil 'bucket': no water or nitrate profile with depth, no capillary rise, no preferential flow through cracks or tile drains. Leaching timing is right in direction but not in detail.",
  "Corn growth is radiation-limited and reduced by the worse of water or N stress; there is no explicit photosynthesis, CO₂ effect, frost, hail, weeds or disease. Trait effects are illustrative mechanisms, not measured gains.",
  "Soil-N rates (mineralization, denitrification, uptake) and the N₂O share are assumed and tuned to match a normal-year yield near 220 bu/acre, a most profitable rate near UW–Madison's guideline and N₂O near the IPCC 1 % default. They are not calibrated to measured Wisconsin fields.",
  "Weather is synthetic and Madison-like, not observed records; wet, normal and dry are three fixed scenarios, not a climate distribution.",
  "The variable-rate controller is open-loop: it plans once with normal weather and never updates with in-season measurements.",
  "Phosphorus, soil-test P, digester efficiency and the whole lake are illustrative: one well-mixed lake at steady state, with no internal loading from sediments, no stratification and no stream routing. Use the lake for direction and order of magnitude only.",
  "Results stop being trustworthy outside the ranges explored: N rates above 300 kg/ha, soils unlike a silt loam, other crops, other climates, or multi-year rotations (each season starts fresh).",
];

export const VALIDATION = [
  "Independent re-implementation: validate.py rewrites the model from these equations in Python/NumPy and compares 106 quantities over 1,152 control scenarios. Largest relative difference 1.4 × 10⁻¹³ (round-off). It found and fixed one bug: nitrification N₂O was not removed from soil N.",
  "Conservation: the season water balance (rain + irrigation = runoff + ET + drainage + change in storage) and the soil-N balance close to about 10⁻¹⁵ in every scenario.",
  "Problem-set answers: problems_check.mjs recomputes all 57 numeric answers from this model in the state each problem link loads.",
  "Plausibility against published numbers (not a fit to data): normal-year corn ≈ 219 bu/acre versus Wisconsin's record 2025 average of 188 (ref 12); soybean ≈ 51 versus 56 bu/acre; most profitable N rate ≈ 125 lb/acre versus UW–Madison's 120 lb/acre guideline for high-yield loamy soils after soybean (ref 4); N₂O ≈ 1.1 % of applied N versus the IPCC default of 1 % (ref 3); fall-applied N in a wet year gives drainage nitrate above the 10 mg/L standard (ref 6), consistent with Wisconsin well data (ref 7).",
];

// equation numbers used by each subject card (lens) stop, for "Show the equation" cross-links
export const LENS_EQ = { "250:0": ["Mineral N balance (daily)"], "250:1": ["Root-zone water balance"], "255:0": ["Radiation-use-efficiency growth"], "310:0": ["Ammonia, energy and CO₂ behind the fertilizer"],
  "311:0": ["Ammonia volatilization and nitrification N₂O"], "320:0": ["Nitrate leaching (well-mixed cell)"], "326:0": ["Grain drying heat"], "426:0": ["Reference evapotranspiration (Hargreaves)", "Water-stress coefficient"], "430:0": ["Digester electricity"], "450:0": ["Lake phosphorus (steady-state mass balance with settling)"],
  "470:0": ["Return over N cost and the variable-rate controller"], "512:0": ["Ammonia, energy and CO₂ behind the fertilizer", "Digester electricity"], "547:0": ["Field P loss: dissolved and on eroded soil", "Carlson trophic state index"],
  "560:0": ["Grain yield"] };

// ---------- LaTeX house style (Part L): applied to every model equation and symbol before KaTeX renders it ----------
// word subscripts and multi-letter names upright, chemical formulas upright, \dfrac in display, aligned line breaks
export function normTex(t, display = false) {
  const CHEM = /^(N_2O|NO_3|NH_3|NH_4|CH_4|CO_2|N_2|H_2)$/;
  t = t.replace(/_\{([^{}]+)\}/g, (m, body) => "_{" + body.split(",").map(p => (/^[A-Za-z]{2,}$/.test(p) || CHEM.test(p) ? `\\mathrm{${p}}` : p)).join(",") + "}");
  t = t.replace(/(?<!\\mathrm\{)(?<![\\A-Za-z])(TAW|RAW|LAI|RUE|GDD|ET|RO|DP|CN|NNI|HI|STP|TP|TSI|Chl|NDVI|NIR|Red|LHV|Frac)(?![A-Za-z])/g, "\\mathrm{$1}");
  t = t.replace(/(?<!\\mathrm\{)(?<![\\A-Za-z])(N_2O|NH_3|CO_2|CH_4|NO_3)/g, "\\mathrm{$1}");
  if (!display) return t;
  t = t.replace(/\\frac(?=\{)/g, "\\dfrac");
  // split "a = b,\qquad c = d" into aligned lines, aligned at the first top-level "="
  const parts = []; let depth = 0, cur = "";
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (ch === "{") depth++; if (ch === "}") depth--;
    const rest = t.slice(i);
    const m = depth === 0 && ch === "," && /^,\s*\\q?quad/.exec(rest);
    if (m) { parts.push(cur); cur = ""; i += m[0].length - 1; continue; }
    cur += ch;
  }
  parts.push(cur);
  if (parts.length < 2) return t;
  const amp = s => { let d = 0; for (let i = 0; i < s.length; i++) { const ch = s[i]; if (ch === "{" || ch === "(") d++; if (ch === "}" || ch === ")") d--; if (d === 0 && ch === "=") return s.slice(0, i) + "&" + s.slice(i); } return "&" + s; };
  return "\\begin{aligned}" + parts.map(p => amp(p.trim())).join(" \\\\[4pt] ") + "\\end{aligned}";
}

// lens "Show the equation" relations that are concepts rather than model equations (TeX)
export const LENS_TEX = {
  "310:0": T`\begin{aligned} &\mathrm{N_2} + 3\,\mathrm{H_2} \rightleftharpoons 2\,\mathrm{NH_3} \\[2pt] &\text{(exothermic; 4 moles of gas become 2)} \end{aligned}`,
  "311:0": T`\begin{aligned} &\mathrm{NH_4^+} \rightleftharpoons \mathrm{NH_3(aq)} + \mathrm{H^+} \\[2pt] &\mathrm{NH_3(aq)} \rightleftharpoons \mathrm{NH_3(g)}, \qquad p_{\mathrm{NH_3}} = H\,c_{\mathrm{NH_3}} \ \text{(Henry's law)} \end{aligned}`,
  "355:0": T`\begin{aligned} \mathrm{NDVI} &= \dfrac{\mathrm{NIR}-\mathrm{Red}}{\mathrm{NIR}+\mathrm{Red}} \\[4pt] \mathbb{E}[Y] &= \sum_{y\,\in\,\{\text{wet, normal, dry}\}} p_y\,Y_y \end{aligned}`,
  "430:0": T`X = \dfrac{k\,\tau}{1 + k\,\tau}, \qquad \tau = \dfrac{V}{Q} \qquad \text{(stirred tank, first-order breakdown)}`,
  "450:0": T`\begin{aligned} &\min\ \ \text{cost} + \text{damage}\!\left(P_{\mathrm{lake}}\right) \\[2pt] &\text{subject to mass balances and capacity limits} \end{aligned}`,
  "560:0": T`\begin{aligned} \text{DNA} &\xrightarrow{\ \text{transcription}\ } \text{mRNA} \\[2pt] &\xrightarrow{\ \text{translation}\ } \text{protein} \end{aligned}`,
  "560:1": T`\begin{aligned} &\mathrm{N_2} + 8\,\mathrm{H^+} + 8\,e^- + 16\,\mathrm{ATP} \\[2pt] &\quad\longrightarrow 2\,\mathrm{NH_3} + \mathrm{H_2} + 16\,\mathrm{ADP} + 16\,\mathrm{P_i} \end{aligned}`,
};
