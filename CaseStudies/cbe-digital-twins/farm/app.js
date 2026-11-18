import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import * as M from "./models.js";
import { buildWorld, CORN, SOY, PIVOT, LAKE as LAKE3, MICRO } from "./scene.js";
import KIT from "./coursedata.js";
import { FEATURES, COURSES } from "./courses.js";
import { PS, psCtl } from "./ps.js";
import * as MD from "./modeldoc.js";
import { RESEARCH, CENTERS } from "./researchdata.js";

const $ = id => document.getElementById(id);
const fmt = (v, d = 0) => (Number.isFinite(v) ? v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }) : "–");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dateOf = d => { const t = new Date(Date.UTC(2025, 0, 1) + (M.DOY0 + d - 1) * 864e5); return `${MONTHS[t.getUTCMonth()]} ${t.getUTCDate()}`; };
const sup = (...n) => `<sup class="refsup">${n.map(k => `<a href="#ref-${k}" class="ref" data-ref="${k}">${k}</a>`).join(",")}</sup>`;

// ---------- courses ----------
const COURSE_SHORT = { 150: "Intro", 250: "Balances", 255: "Modeling", 310: "Thermo", 311: "Mixtures", 320: "Transport", 326: "Fluids & Heat",
  355: "Statistics", 426: "Mass Transfer", 430: "Kinetics & Reactors", 450: "Design", 470: "Control", 512: "Energy", 547: "Colloids", 560: "Biochem" };
const kitCourse = n => KIT.courses.find(c => c.n === `CBE ${n}`);
const COURSE = Object.fromEntries(Object.entries(COURSE_SHORT).map(([n, s]) => [n, [`${n} ${s}`, kitCourse(n).title]]));
const esc = s => s.replace(/&/g, "&amp;");
const courseLink = n => `<a class="course" href="https://guide.wisc.edu/search/?P=CBE%20${n}" target="_blank" rel="noopener" title="CBE ${n}: ${COURSE[n][1]}">${esc(COURSE[n][0])} ↗</a>`;
document.querySelectorAll("[data-courses]").forEach(el => { el.outerHTML = el.dataset.courses.split(" ").map(courseLink).join(" "); });

// ---------- references (every source opened while building this twin; the single list cited by the page and the ∑ Model panel) ----------
const REFS = [
  `IEA. <i>Ammonia Technology Roadmap</i>, Executive Summary, 2021 (about 2 % of final energy, 450 Mt CO₂/yr; 2.4 t CO₂ and ~41 GJ per t NH₃ on average; best gas plants 28 GJ/t; ~70 % used for fertilizer). <a href="https://www.iea.org/reports/ammonia-technology-roadmap/executive-summary" target="_blank" rel="noopener">Link ↗</a>`,
  `J. W. Erisman, M. A. Sutton, J. Galloway, Z. Klimont, W. Winiwarter. "How a century of ammonia synthesis changed the world." <i>Nature Geoscience</i> 1, 636–639, 2008. <a href="https://doi.org/10.1038/ngeo325" target="_blank" rel="noopener">Link ↗</a>`,
  `IPCC. <i>2019 Refinement to the 2006 IPCC Guidelines</i>, Vol. 4, Ch. 11: N₂O emissions from managed soils (EF₁ = 0.010; Frac<sub>GASF</sub> = 0.11; Frac<sub>LEACH</sub> = 0.24). <a href="https://www.ipcc-nggip.iges.or.jp/public/2019rf/pdf/4_Volume4/19R_V4_Ch11_Soils_N2O_CO2.pdf" target="_blank" rel="noopener">Link ↗</a>`,
  `C. A. M. Laboski, J. B. Peters. <i>Nutrient Application Guidelines for Field, Vegetable, and Fruit Crops in Wisconsin</i> (A2809). UW–Madison Extension, 2012 (Table 6.1, MRTN N rates for corn). <a href="https://cropsandsoils.extension.wisc.edu/files/2026/03/A2809-web.pdf" target="_blank" rel="noopener">Link ↗</a>`,
  `J. E. Sawyer. "Corn Nitrogen Rate Calculator Website." Iowa State University Soil Fertility, 2020 (maximum return to nitrogen, MRTN). <a href="https://www.agronext.iastate.edu/soilfertility/currenttopics/CNRCandUpdate_2-21-2020.pdf" target="_blank" rel="noopener">Link ↗</a>`,
  `U.S. EPA. National Primary Drinking Water Regulations (nitrate 10 mg/L as N; blue-baby syndrome in infants). <a href="https://www.epa.gov/ground-water-and-drinking-water/national-primary-drinking-water-regulations" target="_blank" rel="noopener">Link ↗</a>`,
  `Wisconsin DNR, Groundwater Coordinating Council. Research highlights (about 10 % of private well samples exceed the nitrate standard; ~90 % of N inputs to groundwater from agriculture). <a href="https://dnr.wisconsin.gov/topic/Groundwater/GCC/researchHighlights.html" target="_blank" rel="noopener">Link ↗</a>`,
  `P. R. Varadwaj, H. M. Marques, I. Grabowski. "Ammonia synthesis over transition metal catalysts." <i>Int. J. Mol. Sci.</i> 26, 4670, 2025 (iron catalyst, 375–500 °C, 200–300 atm; N≡N 941 kJ/mol). <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC12112505/" target="_blank" rel="noopener">Link ↗</a>`,
  `R. G. Allen, L. S. Pereira, D. Raes, M. Smith. <i>Crop Evapotranspiration</i>, FAO Irrigation and Drainage Paper 56, 1998 (eqs. 21, 23–25, 35, 52, 82–85; Tables 12, 19 and 22; λ = 2.45 MJ/kg). <a href="https://www.fao.org/4/x0490e/x0490e00.htm" target="_blank" rel="noopener">Link ↗</a>`,
  `G. Lemaire, I. Ciampitti. "Crop mass and N status as prerequisite covariables for unraveling nitrogen use efficiency." <i>Plants</i> 9, 1309, 2020 (maize critical N uptake 34 W<sup>0.64</sup>, after Plénet &amp; Lemaire 2000). <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC7599764/" target="_blank" rel="noopener">Link ↗</a>`,
  `C. D. Messina et al. "Radiation use efficiency increased over a century of maize breeding in the US corn belt." <i>J. Exp. Bot.</i> 73, 5503–5513, 2022 (maize RUE 1.5–1.86 g/MJ of intercepted solar radiation). <a href="https://doi.org/10.1093/jxb/erac212" target="_blank" rel="noopener">Link ↗</a>`,
  `Wisconsin DATCP / USDA NASS. <i>Wisconsin Farm Reporter</i>, January 2026 (2025 records: corn 188.0 bu/acre, soybeans 56.0 bu/acre). <a href="https://datcp.wi.gov/Documents2/WisconsinFarmReporter202601.pdf" target="_blank" rel="noopener">Link ↗</a>`,
  `National Academies of Sciences, Engineering, and Medicine. <i>Genetically Engineered Crops: Experiences and Prospects</i>, 2016 (report brief). <a href="https://nap.nationalacademies.org/resource/23395/GE-crops-report-brief.pdf" target="_blank" rel="noopener">Link ↗</a>`,
  `USDA ERS. "Recent Trends in GE Adoption," updated Dec 2025 (Bt corn 87 % of U.S. corn acres in 2025). <a href="https://www.ers.usda.gov/data-products/adoption-of-genetically-engineered-crops-in-the-united-states/recent-trends-in-ge-adoption" target="_blank" rel="noopener">Link ↗</a>`,
  `USDA. "About the Coordinated Framework" for the regulation of biotechnology (USDA APHIS, EPA, FDA). <a href="https://usbiotechnologyregulation.mrp.usda.gov/biotechnologygov/about" target="_blank" rel="noopener">Link ↗</a>`,
  `B. E. Tabashnik et al. "Dual mode of action of Bt proteins." <i>Scientific Reports</i> 5, 15107, 2015. <a href="https://doi.org/10.1038/srep15107" target="_blank" rel="noopener">Link ↗</a>`,
  `USDA APHIS. Plant Pest Risk Assessment for MON 87460 corn (cold shock protein B, cspB, from <i>Bacillus subtilis</i>). <a href="https://www.aphis.usda.gov/brs/aphisdocs/09_05501p_dpra.pdf" target="_blank" rel="noopener">Link ↗</a>`,
  `J. McFadden, E. Njuki, T. Griffin. <i>Precision Agriculture in the Digital Era: Recent Adoption on U.S. Farms</i>. USDA ERS EIB-248, 2023. <a href="https://www.ers.usda.gov/publications/pub-details?pubid=105893" target="_blank" rel="noopener">Link ↗</a>`,
  `U.S. Geological Survey. "Landsat Normalized Difference Vegetation Index" (NDVI = (NIR − Red)/(NIR + Red)). <a href="https://www.usgs.gov/landsat-missions/landsat-normalized-difference-vegetation-index" target="_blank" rel="noopener">Link ↗</a>`,
  `A. M. Sampat, G. J. Ruiz-Mercado, V. M. Zavala. "Economic and environmental analysis for advancing sustainable management of livestock waste: a Wisconsin case study." <i>ACS Sustainable Chem. Eng.</i> 6, 6018–6031, 2018. <a href="https://doi.org/10.1021/acssuschemeng.7b04657" target="_blank" rel="noopener">Link ↗</a>`,
  `Y. Hu, A. M. Sampat, G. J. Ruiz-Mercado, V. M. Zavala. "Logistics network management of livestock waste for spatiotemporal control of nutrient pollution in water bodies." <i>ACS Sustainable Chem. Eng.</i> 7, 18359–18374, 2019 (Upper Yahara watershed case study). <a href="https://doi.org/10.1021/acssuschemeng.9b03920" target="_blank" rel="noopener">Link ↗</a>`,
  `A. M. Sampat, Y. Hu, M. Sharara, H. Aguirre-Villegas, G. Ruiz-Mercado, R. A. Larson, V. M. Zavala. "Coordinated management of organic waste and derived products." <i>Computers &amp; Chemical Engineering</i> 128, 352–363, 2019. <a href="https://doi.org/10.1016/j.compchemeng.2019.06.008" target="_blank" rel="noopener">Link ↗</a>`,
  `E. Martín-Hernández, Y. Hu, V. M. Zavala, M. Martín, G. J. Ruiz-Mercado. "Analysis of incentive policies for phosphorus recovery at livestock facilities in the Great Lakes area." <i>Resources, Conservation and Recycling</i> 177, 105973, 2022. <a href="https://doi.org/10.1016/j.resconrec.2021.105973" target="_blank" rel="noopener">Link ↗</a>`,
  `Clean Lakes Alliance. "Phosphorus" (one pound of phosphorus can create about 500 pounds of wet algae). <a href="https://www.cleanlakesalliance.org/phosphorus/" target="_blank" rel="noopener">Link ↗</a>`,
  `UW–Madison Center for Limnology. "What causes the algae blooms in Madison's lakes?" <i>Water Blogged</i>, June 11, 2018. <a href="https://blog.limnology.wisc.edu/2018/06/11/what-causes-the-algae-blooms-in-madisons-lakes/" target="_blank" rel="noopener">Link ↗</a>`,
  `K. A. Tyrrell. "Heavier rains and manure mean more algae blooms." UW–Madison College of Letters &amp; Science, June 11, 2018. <a href="https://ls.wisc.edu/news/heavier-rains-and-manure-mean-more-algae-blooms" target="_blank" rel="noopener">Link ↗</a>`,
  `E. Homan et al. "Biogas from Manure." Penn State Extension, 2026 (about 1.2 m³ biogas per cow per day; ~60 % methane). <a href="https://extension.psu.edu/biogas-from-manure" target="_blank" rel="noopener">Link ↗</a>`,
  `P. A. Topper, R. E. Graves, T. Richard. "Fate of Nutrients and Pathogens During Anaerobic Digestion of Dairy Manure." Penn State Extension, 2026. <a href="https://extension.psu.edu/fate-of-nutrients-and-pathogens-during-anaerobic-digestion-of-dairy-manure" target="_blank" rel="noopener">Link ↗</a>`,
  `U.S. EPA AgSTAR. "AgSTAR Data and Trends" (400 operating livestock digesters in the U.S. as of June 2024, 343 on dairies). <a href="https://www.epa.gov/agstar/agstar-data-and-trends" target="_blank" rel="noopener">Link ↗</a>`,
  `R. E. Carlson. "A trophic state index for lakes." <i>Limnol. Oceanogr.</i> 22, 361–369, 1977, as given by NALMS, "Trophic State Equations." <a href="https://www.nalms.org/secchidipin/monitoring-methods/trophic-state-equations/" target="_blank" rel="noopener">Link ↗</a>`,
  `Minnesota Pollution Control Agency. "Stormwater runoff coefficients / curve numbers for different land uses" (adapted from USDA TR-55; row crops, straight row, good, soil group B: CN 78). <a href="https://stormwater.pca.state.mn.us/stormwater_runoff_coefficientscurve_numbers_for_different_land_uses" target="_blank" rel="noopener">Link ↗</a>`,
  `FAO. News release for <i>The State of Food Security and Nutrition in the World 2026</i> (about 645 million people faced hunger in 2025). <a href="https://www.fao.org/newsroom/detail/un-report--global-hunger-levels-ease-for-third-consecutive-year-as-regional-disparities-persist/en" target="_blank" rel="noopener">Link ↗</a>`,
  `USDA ERS. "Ag and Food Sectors and the Economy," updated Apr 2026 (5.5 % of U.S. GDP in 2023; farms 0.8 %). <a href="https://www.ers.usda.gov/data-products/ag-and-food-statistics-charting-the-essentials/ag-and-food-sectors-and-the-economy" target="_blank" rel="noopener">Link ↗</a>`,
  `S. Lowder, T. Raney, J. Skoet (FAO). "The global distribution of smallholder and family farms." CGAP, 2014 (84 % of the world's 570+ million farms are under 2 ha and operate about 12 % of farmland). <a href="https://www.cgap.org/blog/global-distribution-of-smallholder-and-family-farms" target="_blank" rel="noopener">Link ↗</a>`,
  `J. L. Lindquist, T. J. Arkebauer, D. T. Walters, K. G. Cassman, A. Dobermann. "Maize radiation use efficiency under optimal growth conditions." <i>Agronomy Journal</i> 97, 72–78, 2005. <a href="https://digitalcommons.unl.edu/agronomyfacpub/92" target="_blank" rel="noopener">Link ↗</a>`,
  `University of Wisconsin–Madison. <i>Guide</i>: Chemical and Biological Engineering (CBE) courses. <a href="https://guide.wisc.edu/courses/cbe/" target="_blank" rel="noopener">Link ↗</a>`,
  `G. S. McMaster, W. W. Wilhelm. "Growing degree-days: one equation, two interpretations." <i>Agricultural and Forest Meteorology</i> 87, 291–300, 1997 (corn method: T<sub>max</sub> capped at 30 °C, T<sub>min</sub> raised to the 10 °C base). <a href="https://doi.org/10.1016/S0168-1923(97)00027-0" target="_blank" rel="noopener">Link ↗</a>`,
  `USDA Soil Conservation Service. <i>Urban Hydrology for Small Watersheds</i>, Technical Release 55 (TR-55), 2nd ed., 1986 (runoff equation Q = (P − I<sub>a</sub>)²/(P − I<sub>a</sub> + S), I<sub>a</sub> = 0.2S, curve numbers). <a href="https://ponce.sdsu.edu/tr55.pdf" target="_blank" rel="noopener">Link ↗</a>`,
  `S. C. Chapra. <i>Surface Water-Quality Modeling</i>. McGraw-Hill, 1997 (well-mixed lake phosphorus budget with an apparent settling velocity).`,
];
$("refs").innerHTML = REFS.map((r, i) => `<li id="ref-${i + 1}">${r}</li>`).join("");

// ---------- renderer and scene ----------
const stage = $("stage");
const lite = matchMedia("(max-width: 860px)").matches;
// quality tier: "high" = ambient occlusion + bloom + SMAA; "low" (phones, few cores, or slow frames) = plain render
const QUALITY = { tier: lite || (navigator.hardwareConcurrency || 8) <= 4 ? "low" : "high", pr: Math.min(devicePixelRatio, lite ? 1.5 : 2) };
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
renderer.setPixelRatio(QUALITY.pr);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.5;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 16000);
// post-processing (high tier): render → ground-truth AO → subtle bloom (only the flare and dryer flame exceed the threshold) → tone map/sRGB → SMAA
const composer = new EffectComposer(renderer);
const gtao = new GTAOPass(scene, camera, 1, 1);
gtao.updateGtaoMaterial({ radius: 3.0, distanceExponent: 1.5, thickness: 2.0, scale: 1.0, samples: 12, distanceFallOff: 1.0 });
gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
gtao.blendIntensity = 0.85;
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.3, 0.45, 9.0);   // threshold above the sky's linear radiance: only the flare and dryer flame bloom
const smaa = new SMAAPass(1, 1);
composer.addPass(new RenderPass(scene, camera)); composer.addPass(gtao); composer.addPass(bloom); composer.addPass(new OutputPass()); composer.addPass(smaa);
function render() {
  if (QUALITY.tier === "high") composer.render(); else renderer.render(scene, camera);
  // overlay: 3D text labels (layer 1) on top, without background, fog or post-processing
  const bg = scene.background, fog = scene.fog; scene.background = null; scene.fog = null;
  renderer.autoClear = false; camera.layers.set(1); renderer.render(scene, camera); camera.layers.set(0); renderer.autoClear = true;
  scene.background = bg; scene.fog = fog;
}
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.48; controls.maxDistance = 3500;
const W3 = buildWorld(scene, renderer, { lite });

// ---------- model state ----------
const ctl = { rate: 150, timing: "split", irrigate: false, year: "normal", trait: "bt", precision: false, cover: false, digester: true, recovery: false };
const maps = M.fieldMaps();
let R = null;                  // current results
let day = 0, dayF = 0, shownDay = -1;

function compute() {
  const rep = M.farmReport(ctl, maps);
  const { farm, soy, lake } = rep;
  // per-day field averages for the chart and readouts
  const n = farm.zones.length, avg = k => { const a = new Float64Array(M.NDAYS); for (const z of farm.zones) for (let d = 0; d < M.NDAYS; d++) a[d] += z.res.rec[k][d] / n; return a; };
  const water = new Float64Array(M.NDAYS);
  for (const z of farm.zones) for (let d = 0; d < M.NDAYS; d++) water[d] += (1 - z.res.rec.Dr[d] / z.res.rec.TAW) / n;
  // running max LAI per zone (plant height does not shrink as leaves age)
  const hFrac = farm.zones.map(z => { const a = new Float32Array(M.NDAYS); let m = 0; for (let d = 0; d < M.NDAYS; d++) { m = Math.max(m, z.res.rec.lai[d]); a[d] = Math.min(1, m / 3.2); } return a; });
  let sm = 0; const soyH = new Float32Array(M.NDAYS); for (let d = 0; d < M.NDAYS; d++) { sm = Math.max(sm, soy.rec.lai[d]); soyH[d] = Math.min(1, sm / 2.8); }
  // daily signals for the 3D loss illustrations
  const fertAvg = farm.agg.fert, ev = M.schedule(1, ctl.timing).events, tau = 2;
  const nh3Day = new Float64Array(M.NDAYS), lakeMem = new Float64Array(M.NDAYS);
  for (const [e, frac] of ev) for (let d = e; d < M.NDAYS; d++) nh3Day[d] += M.N.fracGASF * frac * fertAvg * Math.exp(-(d - e) / tau) / tau;
  let mem = 0; for (let d = 0; d < M.NDAYS; d++) { mem = mem * Math.exp(-1 / 10) + rep.ploss.daily[d]; lakeMem[d] = mem; }
  const extra = { nh3Day, lakeMem };
  R = { ...rep, ...extra, lai: avg("lai"), nmin: avg("nmin"), nup: avg("nup"), leachCum: avg("leach"), water, hFrac, soyH, wx: M.weather(ctl.year) };
  W3.st.digesterOn = ctl.digester;
  W3.st.precision = ctl.precision;
  W3.setLake(lake.tsi);
  shownDay = -1;
  updateStatic();
}

// ---------- readouts ----------
const kgLb = v => `${fmt(v)} kg/ha (${fmt(M.lbAc(v))} lb/acre)`;
function stageOf(d) {
  const r = R.farm.zones[4 * M.NX + 6].res, C = M.CROPS.corn, plantI = C.plant - M.DOY0;
  if (d < plantI) return "not planted yet";
  if (r.matI >= 0 && d >= r.matI) return d >= 298 - M.DOY0 ? "harvested" : "mature, drying down";
  // estimate GDD from the weather to name the stage
  let g = 0; const w = R.wx;
  for (let i = plantI; i <= d; i++) g += Math.max(0, (Math.min(w.tmax[i], 30) + Math.max(w.tmin[i], 10)) / 2 - 10);
  if (g < 60) return "seed sprouting";
  if (g < C.gddSilk - 60) return `growing leaves (V${Math.max(1, Math.round(g / 45))})`;
  if (g < C.gddSilk + 60) return "silking (pollination)";
  return "filling kernels";
}
function updateStatic() {
  const a = R.farm.agg, u = R.uni.agg, v = R.vr.agg;
  $("rate-out").textContent = ctl.precision ? "set by controller" : kgLb(ctl.rate);
  $("r-yield").textContent = `${fmt(M.buAc(a.grainDM))} bu/acre`;
  $("r-soy").textContent = `${fmt(M.buAc(R.soy.grainDM, "soy"))} bu/acre`;
  $("r-et").textContent = `${fmt(a.et)} mm`;
  $("r-irr").textContent = `${fmt(a.irr)} mm`;
  $("r-stress").textContent = `${fmt(a.stressDays)} days`;
  $("r-drain").textContent = `${fmt(a.drain)} mm in season`;
  $("r-years").textContent = `${fmt(M.buAc(R.years.wet))} · ${fmt(M.buAc(R.years.normal))} · ${fmt(M.buAc(R.years.dry))}`;
  $("trait-note").innerHTML = {
    conv: "No insect trait: insects cost an illustrative 6 % of yield.",
    bt: "Bt protein kills specific larvae: insect loss drops to 1 % (illustrative). Refuges slow resistance." + sup(13, 16),
    drought: "Adds the cspB gene (MON 87460)." + sup(17) + " Illustrative: tolerates drier soil, loses less at pollination.",
    nue: "Experimental, not sold: roots take up N 30 % faster (illustrative).",
  }[ctl.trait];
  $("r-napp").textContent = kgLb(a.fert);
  $("r-nup").textContent = `${fmt(a.nup)} kg/ha`;
  $("r-nre").textContent = `${fmt(100 * a.recovery)} %`;
  $("r-leach").textContent = `${fmt(a.leach, 1)} kg N/ha`;
  const no3 = a.nitrate;
  $("r-no3").innerHTML = `<span class="${no3 > 10 ? "alarm-t" : "ok-t"}">${fmt(no3, 1)} mg/L</span> (limit 10)${sup(6)}`;
  $("r-air").textContent = `${fmt(M.N.fracGASF * a.fert, 1)} · ${fmt(a.n2o, 2)} kg N/ha`;
  $("r-nro").textContent = `${fmt(a.nro, 1)} kg N/ha`;
  $("r-vr-n").textContent = `${fmt(v.fert)} vs ${fmt(u.fert)} kg/ha (${v.fert <= u.fert ? "−" : "+"}${fmt(Math.abs(100 * (1 - v.fert / u.fert)))} %)`;
  $("r-vr-y").textContent = `${M.buAc(v.grainDM) >= M.buAc(u.grainDM) ? "+" : "−"}${fmt(Math.abs(M.buAc(v.grainDM) - M.buAc(u.grainDM)), 1)} bu/acre`;
  $("r-vr-l").textContent = `${v.leach <= u.leach ? "−" : "+"}${fmt(Math.abs(v.leach - u.leach), 1)} kg N/ha`;
  const ret = x => M.buAc(x.grainDM) - M.PRICE_RATIO * M.lbAc(x.fert);
  $("r-vr-r").textContent = `${ret(v) >= ret(u) ? "+" : "−"}${fmt(Math.abs(ret(v) - ret(u)), 1)} bu/acre equivalent`;
  const h = R.hb;
  $("r-hb-n").textContent = `${fmt(a.fert * M.FIELD_HA / 1000, 1)} t N`;
  $("r-hb-nh3").textContent = `${fmt(h.tNH3, 1)} t NH₃`;
  $("r-hb-gj").textContent = `${fmt(h.gjBest)} · ${fmt(h.gjAvg)} GJ`;
  $("r-hb-co2").textContent = `${fmt(h.co2, 1)} t CO₂`;
  $("r-moist").textContent = `${fmt(100 * R.dry.moist, 1)} %`;
  $("r-dry").textContent = `${fmt(R.dry.mj * M.FIELD_HA / 1000)} GJ for the field (${fmt(R.dry.water * M.FIELD_HA / 1000)} t of water)`;
  const d = R.dairy;
  $("r-biogas").textContent = ctl.digester ? `${fmt(d.biogas)} · ${fmt(d.ch4)} m³/day` : "digester off";
  $("r-kw").textContent = ctl.digester ? `${fmt(d.kw)} kW (${fmt(d.mwhYr)} MWh/yr)` : "–";
  $("r-pman").textContent = `${fmt(d.pManure / 1000, 1)} t P/yr`;
  $("r-pha").textContent = `${fmt(d.pPerHa, 1)} kg P/ha/yr${d.pExport ? ` (${fmt(d.pExport / 1000, 1)} t exported)` : ""}`;
  $("r-stp").textContent = `${fmt(M.DAIRY.stp)} → ${fmt(R.sp.stp10)} ppm`;
  $("recovery").disabled = !ctl.digester;
  const p = R.ploss, L = R.lake;
  $("r-ploss").textContent = `${fmt(p.total, 2)} kg P/ha`;
  $("r-psplit").textContent = `${fmt(p.dp, 2)} · ${fmt(p.pp, 2)}`;
  $("r-sed").textContent = `${fmt(p.sed, 2)} t/ha`;
  $("r-load").textContent = `${fmt(L.load / 1000, 1)} t P/yr`;
  $("r-tp").textContent = `${fmt(L.tp)} µg/L`;
  $("r-tsi").innerHTML = `<span class="${L.tsi >= 60 ? "alarm-t" : L.tsi >= 50 ? "warn-t" : "ok-t"}">${fmt(L.tsi)}</span>`;
  $("lake-note").innerHTML = L.tsi >= 60
    ? "TSI ≥ 60: blue-green algae and scums." + sup(30)
    : L.tsi >= 50 ? "TSI 50–60: green water in summer." + sup(30) : "TSI < 50: clearer water." + sup(30);
  $("r-lake").innerHTML = `<span class="${L.tsi >= 60 ? "alarm-t" : L.tsi >= 50 ? "warn-t" : "ok-t"}">${L.tsi >= 60 ? "algae blooms likely" : L.tsi >= 50 ? "green, well-fed" : "fairly clear"}</span> (TSI ${fmt(L.tsi)})`;
  // nitrogen fates (season, field average)
  const nh3 = M.N.fracGASF * a.fert, n2 = a.den * (1 - M.N.rN2O), nf = [
    ["Crop", a.nup, "var(--ok)"], ["NH₃", nh3, "#8f6ad8"], ["N₂O", a.n2o, "#c2185b"], ["N₂", n2, "#9aa3ad"],
    ["Leached", a.leach, "var(--signal)"], ["Runoff", a.nro, "#8a6a3c"]];
  const bar = (id, legId, parts) => { const tot = parts.reduce((s2, p2) => s2 + Math.max(0, p2[1]), 0) || 1;
    $(id).innerHTML = parts.map(([lab, v, col]) => `<i style="width:${100 * Math.max(0, v) / tot}%;background:${col}" title="${lab}: ${fmt(v, 1)}"></i>`).join("");
    $(legId).innerHTML = parts.map(([lab, v, col]) => `<span><i class="sw" style="background:${col};height:8px;width:8px;border-radius:2px"></i>${lab} ${fmt(v, v < 10 ? 1 : 0)}</span>`).join(""); };
  bar("nbar", "nleg", nf);
  $("r-air-tot").textContent = `${fmt(nh3 + a.n2o + n2, 1)} kg N/ha (${fmt(100 * (nh3 + a.n2o + n2) / Math.max(1, a.fert))} % of fertilizer)`;
  $("r-water-tot").textContent = `${fmt(a.leach + a.nro, 1)} kg N/ha`;
  const pIn = R.dairy.pPerHa, pCrop = R.sp.removed, pLost = R.ploss.total, pBal = pIn - pCrop - pLost;
  bar("pbar", "pleg", [["Grain", pCrop, "var(--ok)"], ...(pBal > 0 ? [["Soil build-up", pBal, "#b08a5a"]] : []), ["Dissolved", R.ploss.dp, "var(--signal)"], ["On soil", R.ploss.pp, "#7a5532"]]);
  $("r-p-soil").textContent = `${pBal >= 0 ? "+" : "−"}${fmt(Math.abs(pBal), 1)} kg P/ha/yr`;
  $("r-p-lake").textContent = `${fmt(pLost, 2)} kg P/ha`;
  $("r-p-load").textContent = `${fmt(R.lake.load / 1000, 1)} t P/yr → TSI ${fmt(R.lake.tsi)}`;
  // resource footprint per tonne of corn (15.5 % moisture)
  const Y = a.grainDM / 0.845, kgN = a.fert / Y, kgNH3 = kgN * 17.031 / 14.007, mjFert = kgNH3 * 41, mjDry = R.dry.mj / Y;
  const nT = (v, d = 0) => fmt(v, d).replace(/,/g, "{,}");
  const U = u => `\\,\\mathrm{${u}}`;
  $("foot").innerHTML = [
    ["Yield", `${fmt(Y, 1)} t/ha`, `\\dfrac{${nT(a.grainDM, 2)}${U("t\\ dry/ha")}}{0.845}`],
    ["Land", `${fmt(10000 / Y)} m²`, `\\dfrac{1}{${nT(Y, 1)}${U("t/ha")}} = ${nT(1 / Y, 3)}${U("ha")}`],
    ["Fertilizer N", `${fmt(kgN, 1)} kg N`, `\\dfrac{${nT(a.fert)}${U("kg\\,N/ha")}}{${nT(Y, 1)}${U("t/ha")}};\\ \\ \\times \\tfrac{17.031}{14.007} = ${nT(kgNH3, 1)}${U("kg\\,NH_3")}`],
    ["Crop water (rain)", `${fmt(a.et * 10 / Y)} m³`, `\\dfrac{${nT(a.et)}${U("mm")} \\times 10${U("m^3/(ha\\,mm)")}}{${nT(Y, 1)}${U("t/ha")}}`],
    ["Irrigation", `${fmt(a.irr * 10 / Y)} m³`, `\\dfrac{${nT(a.irr)}${U("mm")} \\times 10}{${nT(Y, 1)}}`],
    ["N manufacture", `${fmt(mjFert)} MJ`, `${nT(kgNH3, 1)}${U("kg\\,NH_3")} \\times 41${U("MJ/kg")}`],
    ["Grain drying", `${fmt(mjDry)} MJ`, `\\dfrac{${nT(R.dry.mj)}${U("MJ/ha")}}{${nT(Y, 1)}${U("t/ha")}}\\ \\ (x = ${nT(100 * R.dry.moist, 1)}\\,\\%)`],
    ["Total energy", `${fmt((mjFert + mjDry) / 1000, 2)} GJ`, `${nT(mjFert)} + ${nT(mjDry)}${U("MJ")}`],
    ["CO₂ (N manufacture)", `${fmt(kgNH3 * 2.4)} kg`, `${nT(kgNH3, 1)}${U("kg\\,NH_3")} \\times 2.4`],
    ["N lost", `${fmt((nh3 + a.n2o + n2 + a.leach + a.nro) / Y, 1)} kg N`, `\\dfrac{${nT(nh3 + a.n2o + n2 + a.leach + a.nro, 1)}${U("kg\\,N/ha")}}{${nT(Y, 1)}${U("t/ha")}}`],
  ].map(([k, v, calc]) => `<dt>${k}</dt><dd>${v}<small>${texHTML(calc, false)}</small></dd>`).join("");
  takeaways();
  drawCurve(); drawMaps(); drawTrend();
}
function updateDay(d) {
  const w = R.wx;
  let rainSum = 0; for (let i = 0; i <= d; i++) rainSum += w.rain[i];
  $("r-date").textContent = dateOf(d);
  $("clock").textContent = `${dateOf(d)} · day ${d + 1} of ${M.NDAYS}`;
  $("day").value = d;
  $("r-stage").textContent = stageOf(d);
  $("r-rain").textContent = `${fmt(w.rain[d])} · ${fmt(rainSum)} mm`;
  $("r-water").textContent = `${fmt(100 * R.water[d])} %`;
  $("r-nsoil").textContent = `${fmt(R.nmin[d])} kg N/ha`;
  const z = R.farm.zones, n = z.length;
  W3.showDay(d, z.map((zz, k) => ({ lai: zz.res.rec.lai, ks: zz.res.rec.ks })), z.map(zz => zz.res.matI), R.soy.rec, R.soy.matI,
    R.hFrac.map(a => a[d]), R.soyH[d]);
  // events on this day: rain, irrigation, fertilizer passes, grain drying after harvest
  W3.st.raining = w.rain[d] > 1 ? w.rain[d] : 0;
  let irr = 0; for (const zz of z) irr += zz.res.rec.irr[d] / n;
  W3.st.irrigating = irr > 0.5 || (ctl.irrigate && (() => { for (let i = Math.max(0, d - 2); i <= d; i++) { let s = 0; for (const zz of z) s += zz.res.rec.irr[i]; if (s / n > 0.5) return true; } return false; })());
  const sch = M.schedule(ctl.rate, ctl.timing);
  W3.st.spraying = sch.events.some(([e]) => Math.abs(d - e) <= 2) && ctl.rate > 0;
  let dr = 0; for (const zz of z) dr += zz.res.rec.drain[d] / n; W3.st.drainRate = Math.min(1, dr / 10);
  W3.setDryer(d >= 298 - M.DOY0);
  takeawaysDay(d);
  W3.st.nh3 = Math.min(1, R.nh3Day[d] / 5); W3.st.runoff = Math.min(1, R.ploss.daily[d] / 0.08); W3.st.lakeP = Math.min(1, R.lakeMem[d] / 0.15);
  let ro = 0; for (const zz of z) ro += zz.res.rec.runoff[d] / n;
  $("loss-today").innerHTML = `<b>${dateOf(d)}:</b> NH₃ ${R.nh3Day[d] > 0.05 ? `${fmt(R.nh3Day[d], 1)} kg N/ha/day` : "≈ 0"} · runoff ${ro > 0.05 ? `${fmt(ro, 1)} mm, ${fmt(1000 * R.ploss.daily[d])} g P/ha` : "none"}`;
  // status tag and condition labels
  $("tag").textContent = `${dateOf(d)} · ${fmt((w.tmax[d] + w.tmin[d]) / 2)} °C · rain ${fmt(w.rain[d])} mm · ET₀ ${fmt(w.et0[d], 1)} mm${W3.st.spraying ? " · applying N" : ""}${W3.st.irrigating ? " · irrigating" : ""}`;
  condText = {
    corn: `<b>Corn</b> water ${fmt(100 * R.water[d])} % · soil N ${fmt(R.nmin[d])} kg/ha`,
    soy: `<b>Soybeans</b> leaf area ${fmt(R.soy.rec.lai[d], 1)}`,
    barn: `<b>300 cows</b> · manure ${fmt(R.dairy.pManure / 1000, 1)} t P/yr`,
    dig: ctl.digester ? `<b>Digester</b> ${fmt(R.dairy.biogas)} m³ biogas/day · ${fmt(R.dairy.kw)} kW` : "<b>No digester</b>",
    stream: `<b>Stream</b> field P loss ${fmt(R.ploss.total, 2)} kg/ha/yr`,
    lake: `<b>Lake</b> TP ${fmt(R.lake.tp)} µg/L · TSI ${fmt(R.lake.tsi)}`,
    air: R.nh3Day[d] > 0.05 ? `<b>Ammonia to air</b> ${fmt(R.nh3Day[d], 1)} kg N/ha today · ${fmt(M.N.fracGASF * R.farm.agg.fert, 1)} this season` : `<b>Ammonia to air</b> ${fmt(M.N.fracGASF * R.farm.agg.fert, 1)} kg N/ha this season`,
    inlet: R.ploss.daily[d] > 0.0005 ? `<b>Runoff to lake</b> ${fmt(1000 * R.ploss.daily[d])} g P/ha today from the field` : `<b>Runoff to lake</b> ${fmt(R.ploss.total, 2)} kg P/ha this year`,
    pivot: `<b>Pivot</b> ${ctl.irrigate ? `${fmt(R.farm.agg.irr)} mm this season` : "off"}`,
    drone: `<b>Drone</b> NDVI ${fmt(0.15 + 0.75 * (1 - Math.exp(-0.6 * R.lai[d])), 2)}`,
    bins: `<b>Dryer</b> harvest moisture ${fmt(100 * R.dry.moist)} %`,
  };
  for (const k in condEls) condEls[k].innerHTML = condText[k];
  drawTrend();
  lensRefresh();
}

// ---------- charts (canvas, kit tokens) ----------
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function setupCanvas(c) {
  const r = c.getBoundingClientRect(), dpr = Math.min(devicePixelRatio, 2);
  if (!r.width) return null;
  c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
  const g = c.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); return { g, w: r.width, h: r.height };
}
function drawTrend() {
  if (!R) return;
  const n = M.NDAYS, months = [0, 30, 61, 91, 122, 153, 183], mn = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"];
  const panel = (id, top, unit, draw) => {
    const S = setupCanvas($(id)); if (!S) return;
    const { g, w, h } = S, L = 30, Rr = 6, T = 6, B = 16, X = i => L + (w - L - Rr) * i / (n - 1), Y = f => h - B - (h - B - T) * f;
    g.clearRect(0, 0, w, h);
    g.font = `10.5px ${css("--font-data")}`; g.fillStyle = css("--ink-2"); g.strokeStyle = css("--rule"); g.lineWidth = 1;
    [0, 0.5, 1].forEach(f => { g.beginPath(); g.moveTo(L, Y(f) + .5); g.lineTo(w - Rr, Y(f) + .5); g.stroke(); g.textAlign = "right"; g.fillText(String(+(top * f).toFixed(1)), L - 4, Y(f) + 3.5); });
    g.textAlign = "left"; mn.forEach((m, k) => g.fillText(m, X(months[k]) + 2, h - 3));
    draw(g, X, Y, h, B, T);
    g.strokeStyle = css("--accent"); g.lineWidth = 1.5; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(X(day), T); g.lineTo(X(day), h - B); g.stroke(); g.setLineDash([]);
  };
  const line = (g, X, Y, arr, scale, col) => { g.strokeStyle = col; g.lineWidth = 1.8; g.beginPath(); for (let i = 0; i < n; i++) { const y = Y(Math.min(1, arr[i] / scale)); i ? g.lineTo(X(i), y) : g.moveTo(X(i), y); } g.stroke(); };
  panel("tr-water", 100, "%", (g, X, Y) => {
    g.globalAlpha = 0.45; g.fillStyle = css("--ink-2");
    for (let i = 0; i < n; i++) if (R.wx.rain[i] > 0.5) { const top = Y(Math.min(1, R.wx.rain[i] / 40)), base = Y(0); g.fillRect(X(i) - 0.8, top, 1.6, base - top); }
    g.globalAlpha = 1; line(g, X, Y, R.water, 1, css("--signal"));
  });
  panel("tr-lai", 6, "", (g, X, Y) => line(g, X, Y, R.lai, 6, css("--ok")));
  panel("tr-n", 160, "kg/ha", (g, X, Y) => line(g, X, Y, R.nmin, 160, css("--warn")));
}
function drawCurve() {
  if (!R) return;
  const S = setupCanvas($("curve")); if (!S) return;
  const { g, w, h } = S, pts = R.curve, pl = 30, pr = 30, pt = 14, pb = 30;
  const X = r => pl + (w - pl - pr) * r / 300, ymax = 260, lmax = Math.max(40, ...pts.map(p => p.leach)) * 1.1;
  const Y = v => pt + (h - pt - pb) * (1 - v / ymax), YL = v => pt + (h - pt - pb) * (1 - v / lmax);
  g.clearRect(0, 0, w, h); g.font = `10.5px ${css("--font-data")}`; g.fillStyle = css("--ink-2");
  for (const r of [0, 100, 200, 300]) g.fillText(String(r), X(r) - 8, h - 17);
  g.fillText("bu/ac", 0, 10); g.fillText("kg N", w - 28, 10);
  g.textAlign = "center"; g.fillText("N rate (kg N/ha)", pl + (w - pl - pr) / 2, h - 3); g.textAlign = "right";
  for (const v of [Math.round(lmax / 2 / 5) * 5]) g.fillText(String(v), w - 2, YL(v) + 3); g.textAlign = "left";
  for (const v of [100, 200]) { g.fillText(String(v), 2, Y(v) + 3); g.strokeStyle = css("--rule"); g.beginPath(); g.moveTo(pl, Y(v)); g.lineTo(w - pr, Y(v)); g.stroke(); }
  g.strokeStyle = css("--ink-2"); g.setLineDash([3, 3]); g.beginPath(); g.moveTo(X(R.best.rate), pt); g.lineTo(X(R.best.rate), h - pb); g.stroke(); g.setLineDash([]);
  const ln = (f, col) => { g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(X(p.rate), f(p)) : g.moveTo(X(p.rate), f(p)))); g.stroke(); };
  ln(p => Y(M.buAc(p.grainDM)), css("--accent")); ln(p => YL(p.leach), css("--signal"));
  const a = R.farm.agg; g.fillStyle = css("--accent"); g.beginPath(); g.arc(X(Math.min(300, a.fert)), Y(M.buAc(a.grainDM)), 4, 0, 7); g.fill();
}
function drawMaps() {
  if (!R) return;
  const z = R.farm.zones, nC = $("map-n").getContext("2d"), yC = $("map-y").getContext("2d");
  const ramp = (t, a, b) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * Math.max(0, Math.min(1, t)))).join(",")})`;
  z.forEach((zz, k) => {
    const i = k % M.NX, j = Math.floor(k / M.NX);
    nC.fillStyle = ramp(R.vr.rates[k] / 220, [238, 232, 213], [36, 87, 166]); nC.fillRect(i, j, 1, 1);
    yC.fillStyle = ramp((M.buAc(zz.grainDM) - 80) / 170, [180, 120, 40], [47, 125, 79]); yC.fillRect(i, j, 1, 1);
  });
}


// ---------- "What this means": plain-language takeaways built from the live numbers ----------
const TK = (id, html) => { const el = $(id); if (el) el.innerHTML = `<b>What this means</b>${html}`; };
const POOL = 2500;      // m³ in an Olympic pool (50 × 25 × 2 m minimum), roughly
const HOME_KWH = 10000; // kWh a typical U.S. home uses in a year, roughly
function takeawaysDay(d) {
  const z = R.farm.zones, n = z.length;
  let taw = 0; for (const zz of z) taw += zz.res.rec.TAW / n;
  const ks = z.reduce((s2, zz) => s2 + zz.res.rec.ks[d], 0) / n;
  const st = ks < 0.95 ? "<b>The corn is thirsty today</b> and slowing down." : R.water[d] > 0.97 ? "<b>The soil is soaked:</b> extra rain drains below the roots, carrying nitrate." : "<b>The corn has enough water today.</b>";
  TK("tk-live", `${st} The root zone holds water like a pool ${fmt(R.water[d] * taw / 10)} cm deep over the field.`);
}
function takeaways() {
  const a = R.farm.agg, Y = a.grainDM / 0.845, bu = M.buAc(a.grainDM), wet = M.buAc(R.years.wet), dry = M.buAc(R.years.dry), nor = M.buAc(R.years.normal);
  const water = a.stressDays >= 30 && bu < 0.9 * Math.max(wet, nor, 200) ? `<b>Drought cut the yield to ${fmt(bu)} bu/acre.</b>` : bu < 180 ? `<b>Nitrogen, not water, limited the yield (${fmt(bu)} bu/acre).</b>` : `<b>Water was mostly enough (${fmt(bu)} bu/acre).</b>`;
  TK("tk-season", `${water} The crop used ${fmt(a.et * 10 / POOL, 1)} Olympic pools of water per hectare; ${ctl.irrigate ? "the pivot protects the dry-year yield." : `a dry year drops yield ${fmt(100 * (1 - dry / nor))} %: try irrigation.`}`);
  const best = R.best.rate, rate = ctl.rate;
  const rateTxt = ctl.precision ? `<b>The controller averages ${fmt(a.fert)} kg N/ha.</b>` : Math.abs(rate - best) <= 10 ? `<b>${fmt(rate)} kg N/ha is near the best rate (${fmt(best)}).</b>` : rate > best ? `<b>${fmt(rate)} kg N/ha is more than pays</b> (best ${fmt(best)}); the extra leaks away.` : `<b>${fmt(rate)} kg N/ha leaves yield behind</b> (best ${fmt(best)}).`;
  TK("tk-n", `${rateTxt} Drainage nitrate is ${fmt(a.nitrate, 1)} mg/L, ${a.nitrate > 10 ? "<b>above</b> the 10 mg/L limit: split it or add a cover crop." : "under the 10 mg/L limit."}`);
  const nh3 = M.N.fracGASF * a.fert, n2 = a.den * (1 - M.N.rN2O), air = nh3 + a.n2o + n2, algae = R.ploss.total * M.FIELD_HA * 500;
  const pBal = R.dairy.pPerHa - R.sp.removed - R.ploss.total;
  TK("tk-loss", `<b>${fmt(air)} kg N/ha went to the air</b> (${fmt(100 * air / Math.max(1, a.fert))} % of the fertilizer). The field's lost phosphorus can grow ${fmt(algae / 1000, 1)} t of algae; soil P is ${pBal < 0 ? "falling, good for the lake" : "building up: ship manure P away"}.`);
  const V = R.vr.agg, U = R.uni.agg, saved = (U.fert - V.fert) * M.FIELD_HA / 1000;
  TK("tk-prec", saved > 0 ? `<b>Variable rate saves ${fmt(100 * (1 - V.fert / U.fert))} % of the N</b> (${fmt(saved, 2)} t) at almost the same yield. It plans for normal weather, so wet or dry years can fool it.` : `<b>Here variable rate uses more N</b>: with fall application it adds extra for winter losses. Split timing is the better fix.`);
  const gjF = R.hb.gjAvg, gjD = R.dry.mj * M.FIELD_HA / 1000, homes = (gjF + gjD) * 1e9 / 3.6e6 / HOME_KWH;
  TK("tk-energy", `<b>${gjD > gjF ? "Drying takes more energy than making the fertilizer" : "Fertilizer takes more energy than drying"}</b> (${fmt(gjF)} vs ${fmt(gjD)} GJ). Together: roughly ${fmt(homes)} homes' electricity for a year.`);
  const m2 = 10000 / Y, mjT = Y > 0 ? (a.fert / Y * 17.031 / 14.007 * 41 + R.dry.mj / Y) : 0;
  TK("tk-foot", `<b>A tonne of corn needs ${fmt(m2 / 261, 1)} tennis courts of land</b>, ${fmt(a.et * 10 / Y)} m³ of water and energy like ${fmt(mjT / 34)} L of gasoline (roughly). Higher yield shrinks all three.`);
  const d = R.dairy;
  TK("tk-dairy", ctl.digester ? `<b>The digester makes ${fmt(d.kw)} kW</b>, roughly ${fmt(d.mwhYr * 1000 / HOME_KWH)} homes' worth. It keeps the phosphorus: ${ctl.recovery ? "recovery ships half away." : "turn on recovery to ship half away."}` : `<b>Without the digester, the manure's energy is wasted.</b> It could make about ${fmt(M.DAIRY.cows * M.DAIRY.biogasCow * M.DAIRY.ch4Frac * M.DAIRY.lhv * M.DAIRY.eff / 86.4)} kW.`);
  const L = R.lake;
  TK("tk-lake", `${L.tsi >= 60 ? "<b>The lake is overfed: expect algae blooms.</b>" : L.tsi >= 50 ? "<b>The lake is well fed: green in summer.</b>" : "<b>The lake is fairly clear.</b>"} ${fmt(L.load / 1000, 1)} t of P a year can grow roughly ${fmt(L.load * 500 / 1000)} t of algae; cover crops plus recovery cut it most.`);
}
// ---------- controls ----------
const segBind = (attr, key, conv = v => v) => document.querySelectorAll(`[data-${attr}]`).forEach(b => b.onclick = () => {
  ctl[key] = conv(b.dataset[attr]);
  document.querySelectorAll(`[data-${attr}]`).forEach(x => x.setAttribute("aria-pressed", String(x === b)));
  rerun();
});
segBind("year", "year"); segBind("timing", "timing"); segBind("prec", "precision", v => v === "1");
let rerunT = null;
function rerun() { clearTimeout(rerunT); rerunT = setTimeout(() => { compute(); updateDay(day); }, 30); }
$("rate").oninput = e => { ctl.rate = +e.target.value; $("rate-out").textContent = kgLb(ctl.rate); rerun(); };
$("irrigate").onchange = e => { ctl.irrigate = e.target.checked; rerun(); };
$("cover").onchange = e => { ctl.cover = e.target.checked; rerun(); };
$("trait").onchange = e => { ctl.trait = e.target.value; rerun(); };
$("digester").onchange = e => { ctl.digester = e.target.checked; if (!ctl.digester) { ctl.recovery = false; $("recovery").checked = false; } rerun(); };
$("recovery").onchange = e => { ctl.recovery = e.target.checked; rerun(); };
$("day").oninput = e => { day = +e.target.value; dayF = day; updateDay(day); };
$("reset").onclick = () => { day = 0; dayF = 0; updateDay(0); };
function setNDVI(on) {
  $("ndvi-legend").hidden = !on;
  W3.st.ndvi = on; $("mode-farm").setAttribute("aria-pressed", String(!on)); $("mode-ndvi").setAttribute("aria-pressed", String(on));
  shownDay = -1; updateDay(day);
}
$("mode-farm").onclick = () => setNDVI(false);
$("mode-ndvi").onclick = () => setNDVI(true);

// ---------- camera views ----------
const V = (x, y, z) => [x, y, z];
const mv = (o, x, y, z) => [o.x + x, o.y + y, o.z + z];
const VIEWS = {
  farm:    { p: V(40, 760, 1330), c: V(300, 0, -20), fov: 46 },   // overview: field, sprayer, farmstead, bins, stream and lake all in frame
  field:   { p: V(352, 3.4, 74), c: V(372, 1.6, 10), fov: 55 },
  tractor: { p: V(160, 45, 130), c: V(380, 0, -160) },
  open:    { p: V(160, 45, 130), c: V(380, 0, -160) },   // opening view: corn field with the tractor at work (not held still)
  drone:   { p: V(120, 190, 260), c: V(380, 20, -190) },
  barn:    { p: V(-70, 60, 480), c: V(60, 4, 270) },
  digester:{ p: V(170, 38, 430), c: V(70, 4, 320), sr: 25 },
  dryer:   { p: V(-330, 38, 270), c: V(-205, 10, 170), sr: 25 },
  lake:    { p: V(520, 150, 640), c: V(900, 0, 280), sr: 150 },
  soil:    { p: mv(MICRO.soil, 1.2, 0.2, 4.4), c: mv(MICRO.soil, 0, -0.55, 0), micro: true, fov: 45 },
  cell:    { p: mv(MICRO.cell, 0, 1.2, 15.5), c: mv(MICRO.cell, 0, 0, 0), micro: true },
  mol:     { p: mv(MICRO.mol, 0, 0.4, 17), c: mv(MICRO.mol, 0, 0.4, 0), micro: true },
};
let tween = null, inMicro = false;
const SKY = new THREE.Color("#c9dbe8"), DEEP = new THREE.Color("#e9eef2"), fogSaved = scene.fog;
function setMicro(on) {
  inMicro = on; W3.micro.visible = on; W3.world.visible = !on;
  scene.fog = on ? null : fogSaved; scene.background = on ? DEEP : null;   // farm: the Sky mesh is the background
  scene.environment = on ? W3.envMicro : W3.envFarm;
  camera.near = on ? 0.01 : 0.5; camera.far = on ? 400 : 16000; camera.updateProjectionMatrix();
  gtao.updateGtaoMaterial({ radius: on ? 0.25 : 3.0, thickness: on ? 0.2 : 2.0 });
  controls.maxPolarAngle = on ? Math.PI : Math.PI * 0.48;
  controls.maxDistance = on ? 40 : 3500;
}
function goTo(name, instant = false) {
  document.querySelectorAll("[data-view]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.view === name)));
  let v = VIEWS[name];
  if (name === "farm" && stage.clientWidth < stage.clientHeight * 1.05) v = { p: [420, 1150, 1650], c: [420, 0, -10], fov: 48 };   // portrait: whole farm and lake   // portrait screens
  // machines move: frame them where they are now and hold them still while you look
  W3.st.hold = name === "tractor" ? "tractor" : name === "drone" ? "drone" : null;
  if (name === "tractor") { const t = W3.tractor.position; v = { p: [t.x - 50, 20, t.z + 42], c: [t.x, 2, t.z], sr: 14 }; }
  if (name === "open") { const t = W3.tractor.position; v = { p: [t.x - 26, 8, t.z + 24], c: [t.x + 6, 1.4, t.z - 10], fov: 45 }; }
  if (name === "drone") { const t = W3.drone.position; v = { p: [t.x - 90, t.y + 40, t.z + 110], c: [t.x, 10, t.z - 20] }; }
  const to = { p: new THREE.Vector3(...v.p), c: new THREE.Vector3(...v.c), fov: v.fov || 40 };
  if (false && v.sr) {   // (cards now dock in the side panel; no need to slide the view)
    const right = new THREE.Vector3().subVectors(to.c, to.p).cross(new THREE.Vector3(0, 1, 0)).normalize();
    to.p.addScaledVector(right, -v.sr); to.c.addScaledVector(right, -v.sr);
  }
  const micro = !!v.micro;
  if (micro !== inMicro || instant || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    setMicro(micro);
    camera.position.copy(to.p); controls.target.copy(to.c); camera.fov = to.fov; camera.updateProjectionMatrix(); controls.update(); tween = null; return;
  }
  tween = { from: { p: camera.position.clone(), c: controls.target.clone(), fov: camera.fov }, to, t0: performance.now(), dur: 1500 };
}
document.querySelectorAll("[data-view]").forEach(b => { b.setAttribute("aria-pressed", "false"); b.onclick = () => goTo(b.dataset.view); });

// ---------- condition labels (hidden until "Conditions") ----------
const COND_POS = {
  corn: [380, 12, -250], soy: [-360, 8, -200], barn: [10, 16, 210], dig: [70, 16, 320], stream: [380, 4, 96],
  lake: [LAKE3.x, 6, LAKE3.z], pivot: [PIVOT.x, 10, PIVOT.z], drone: null, bins: [-215, 30, 160],
  air: [520, 40, -120], inlet: [W3.inlet[0], 6, W3.inlet[1]],
};
let condText = {};
const condEls = {};
for (const k in COND_POS) { const e = document.createElement("div"); e.className = "clab"; $("labels").appendChild(e); condEls[k] = e; }

// ---------- learn by subject ----------
const midRec = () => R.farm.zones[4 * M.NX + 6].res;
const Z = () => R.farm.agg;
const LENSES = [
  { n: 250, stops: [{
    view: "field", beacon: [360, 1, -60], bs: 3, panel: "sec-n",
    title: "Follow the nitrogen",
    text: "N enters as fertilizer and from soil organic matter. It leaves in the crop, to groundwater, to the air and in runoff.",
    plain: "N in = N out + N left in the soil.",
    eq: "N<sub>fert</sub> + N<sub>soil OM</sub> = N<sub>crop</sub> + N<sub>leached</sub> + N<sub>NH₃</sub> + N<sub>denitrified</sub> + N<sub>runoff</sub> + ΔN<sub>soil</sub>",
    live: () => { const a = Z(), mz = R.farm.zones.reduce((s, z) => s + z.res.tot.minz, 0) / R.farm.zones.length; return `In: ${fmt(a.fert)} fertilizer + ${fmt(mz)} from soil. Out: crop ${fmt(a.nup)}, leached ${fmt(a.leach, 1)}, ammonia ${fmt(M.N.fracGASF * a.fert, 1)}, denitrified ${fmt(a.den, 1)}, runoff ${fmt(a.nro, 1)} (kg N/ha).`; },
    why: "About 1 in 10 Wisconsin private wells exceeds the nitrate standard." + sup(7),
  }, {
    view: "soil", beacon: [0, -0.9, 0.05], bs: 0.04, micro: "soil", panel: "sec-season",
    title: "The water balance under your feet",
    text: "The soil is a bucket: rain and irrigation fill it. Plants, runoff and drainage empty it.",
    plain: "Change in soil water = rain + irrigation − runoff − plant use − drainage.",
    eq: "D<sub>r,i</sub> = D<sub>r,i−1</sub> − (P − RO)<sub>i</sub> − I<sub>i</sub> + ET<sub>c,i</sub> + DP<sub>i</sub>   (FAO-56 eq. 85)" + sup(9),
    live: () => { const a = Z(); return `This season: rain ${fmt(a.rain)} mm + irrigation ${fmt(a.irr)} = runoff ${fmt(a.runoff)} + ET ${fmt(a.et)} + drainage ${fmt(a.drain)} + change in soil storage ${fmt(a.rain + a.irr - a.runoff - a.et - a.drain)} mm.`; },
    why: "Water often limits yield, and drainage carries nitrate away.",
  }] },
  { n: 255, stops: [{
    view: "field", beacon: [360, 1, -60], bs: 3, panel: "sec-live",
    title: "A crop model, one day at a time",
    text: "Each day, leaves turn sunlight into plant mass; water or N shortage slows it. About half the corn's mass ends up as grain.",
    plain: "Growth = sunlight caught × efficiency × (1 − worst stress).",
    eq: "ΔW = RUE · R<sub>s</sub> · (1 − e<sup>−k·LAI</sup>) · min(K<sub>s</sub>, F<sub>N</sub>),  RUE ≈ 1.5 g/MJ" + sup(11) + "  ·  yield = HI · W",
    live: () => { const d = day; return `Day ${d + 1}: leaf area index ${fmt(R.lai[d], 1)}, sunlight ${fmt(R.wx.rs[d], 1)} MJ/m². Final crop mass ${fmt(midRec().W, 1)} t/ha → ${fmt(M.buAc(Z().grainDM))} bu/acre.`; },
    why: "Models test choices in seconds instead of seasons." + sup(35),
  }] },
  { n: 310, stops: [{
    view: "mol", beacon: [-4.5, 1.6, 0], bs: 0.12, micro: "mol", panel: "sec-energy",
    title: "Breaking the strongest bond",
    text: "Air is 78 % N₂, held by a 941 kJ/mol triple bond that plants cannot break." + sup(8) + " Haber–Bosch forces it to react with hydrogen over iron at 375–500 °C and 200–300 atm.",
    plain: "4 gas molecules become 2: pressure pushes toward ammonia; the catalyst adds speed.",
    eq: "N₂ + 3 H₂ ⇌ 2 NH₃   (exothermic; fewer moles of gas)",
    live: () => `This field's fertilizer: ${fmt(R.hb.tNH3, 1)} t of ammonia, made with ${fmt(R.hb.gjBest)}–${fmt(R.hb.gjAvg)} GJ of energy.`,
    why: "Haber–Bosch nitrogen fed about 48 % of humanity in 2008." + sup(2),
  }] },
  { n: 311, stops: [{
    view: "tractor", beacon: [380, 2, -160], bs: 1.4, panel: "sec-loss",
    title: "Ammonia slipping into the air",
    text: "Fertilizer N can escape as ammonia gas, more on warm, moist surfaces. The IPCC default loss is 11 %." + sup(3),
    plain: "Like fizz leaving a soda.",
    eq: "NH₄⁺ ⇌ NH₃(aq) + H⁺ ;  NH₃(aq) ⇌ NH₃(g)   (Henry's law: p = H · c)",
    live: () => `Lost as ammonia here: ${fmt(M.N.fracGASF * Z().fert, 1)} kg N/ha of ${fmt(Z().fert)} applied (IPCC default share).`,
    why: "Lost ammonia is paid-for fertilizer, and it forms fine particles downwind.",
  }] },
  { n: 320, stops: [{
    view: "soil", beacon: [0.6, -0.7, 0.05], bs: 0.04, micro: "soil", panel: "sec-n",
    title: "Nitrate on the move",
    text: "Nitrate dissolves in soil water and does not stick to soil. Drainage carries it below the roots to wells and streams.",
    plain: "Nitrate lost = drainage × nitrate concentration.",
    eq: "L = N<sub>min</sub> · DP / (W<sub>FC</sub> + DP)   (well-mixed soil layer)",
    live: () => `Leached this year: ${fmt(Z().leach)} kg N/ha; drainage water averages ${fmt(Z().nitrate, 1)} mg/L nitrate-N (drinking-water limit 10).`,
    why: "Above 10 mg/L, nitrate in drinking water can harm infants." + sup(6),
  }] },
  { n: 326, stops: [{
    view: "dryer", beacon: [-187, 2, 180], bs: 3, panel: "sec-energy",
    title: "Drying a mountain of grain",
    text: "Corn is harvested at 20–30 % moisture and dried to 15.5 % to store. Hot air carries the water out.",
    plain: "Heat = water removed × heat to evaporate ÷ dryer efficiency.",
    eq: "Q = m<sub>water</sub> · Δh<sub>vap</sub> / η,  Δh<sub>vap</sub> ≈ 2.45 MJ/kg",
    live: () => `Harvest moisture ${fmt(100 * R.dry.moist, 1)} % → remove ${fmt(R.dry.water * M.FIELD_HA / 1000)} t of water from this field: about ${fmt(R.dry.mj * M.FIELD_HA / 1000)} GJ of heat.`,
    note: "Dryer efficiency (50 %) and field drydown are illustrative.",
    why: "Drying is one of a corn farm's biggest energy uses.",
  }] },
  { n: 355, stops: [{
    view: "drone", beacon: [380, 2, -190], bs: 6, panel: "sec-season",
    title: "Every year is different",
    text: "Seed and fertilizer are chosen before the weather is known. The drone map shows the field is uneven too.",
    plain: "Good choices work on average and don't fail badly in a bad year.",
    eq: "NDVI = (NIR − Red) / (NIR + Red)" + sup(19) + "  ·  expected yield = Σ p<sub>year</sub> · yield<sub>year</sub>",
    live: () => `Yield with today's choices: wet ${fmt(M.buAc(R.years.wet))}, normal ${fmt(M.buAc(R.years.normal))}, dry ${fmt(M.buAc(R.years.dry))} bu/acre.`,
    why: "Most U.S. corn and soybean acres now use GPS guidance." + sup(18),
  }] },
  { n: 426, stops: [{
    view: "field", beacon: [360, 2.5, -60], bs: 3, panel: "sec-season",
    title: "Leaves that breathe out water",
    text: "Leaves open pores to take in CO₂ and lose water vapour. With soil evaporation this is ET, the field's biggest water outflow.",
    plain: "Water use = weather's drying power × crop factor × dryness penalty.",
    eq: "ET<sub>c</sub> = K<sub>s</sub> · K<sub>c</sub> · ET<sub>0</sub>,  ET<sub>0</sub> = 0.0023 (T + 17.8) √(T<sub>max</sub> − T<sub>min</sub>) R<sub>a</sub>  (Hargreaves; FAO-56 also gives the full Penman–Monteith equation)" + sup(9),
    live: () => `Today: ET₀ ${fmt(R.wx.et0[day], 1)} mm; corn crop factor peaks at 1.20. Season crop water use: ${fmt(Z().et)} mm.`,
    why: "Knowing crop water use avoids over-irrigating.",
  }] },
  { n: 430, stops: [{
    view: "digester", beacon: [70, 8, 320], bs: 5, panel: "sec-dairy",
    title: "A reactor full of microbes",
    text: "Without oxygen, microbes turn manure into biogas, about 60 % methane." + sup(27) + " An engine burns it for electricity.",
    plain: "Longer in the tank and faster microbes mean more gas.",
    eq: "Continuous stirred tank, first-order breakdown: X = kτ / (1 + kτ),  τ = V / Q",
    live: () => ctl.digester ? `${fmt(R.dairy.biogas)} m³ biogas per day from 300 cows → ${fmt(R.dairy.kw)} kW of electricity.` : "The digester is off. Turn it on in the Dairy panel.",
    why: "Digesters make energy but keep the N and P in the manure." + sup(28),
  }] },
  { n: 450, stops: [{
    view: "farm", beacon: [70, 3, 300], bs: 14, panel: "sec-lake",
    title: "Designing the whole system",
    text: "Manure, fertilizer, crops, digester and lake form one system. Zavala-lab models find phosphorus recovery pays only with the right incentives." + sup(20, 21, 23),
    plain: "Feed the cows, grow the crops, pay the bills, keep the lake clean.",
    eq: "minimize cost + damage(P to lake)  subject to mass balances and capacity limits",
    live: () => `Now: ${fmt(R.dairy.pPerHa, 1)} kg P/ha spread, field loss ${fmt(R.ploss.total, 2)} kg P/ha, lake TSI ${fmt(R.lake.tsi)}. Try digester + nutrient recovery + cover crop.`,
    why: "Agriculture is the main phosphorus source for Madison's Yahara lakes." + sup(25),
  }] },
  { n: 470, stops: [{
    view: "tractor", beacon: [380, 2, -160], bs: 1.4, panel: "sec-prec",
    title: "A tractor with a controller",
    text: "The autonomous sprayer follows GPS lines 36 m apart. A controller sets each zone's fertilizer rate from sensor data.",
    plain: "Measure, compare with crop need, adjust, repeat.",
    eq: "N<sub>zone</sub> = argmax<sub>N</sub> [ price<sub>corn</sub> · Y(N | soil<sub>zone</sub>) − price<sub>N</sub> · N ]",
    live: () => { const v = R.vr.agg, u = R.uni.agg; return `Variable rate: ${fmt(v.fert)} kg N/ha, ${fmt(M.buAc(v.grainDM))} bu/acre, ${fmt(v.leach)} kg leached. Uniform ${fmt(ctl.rate)}: ${fmt(u.fert)} kg N/ha, ${fmt(M.buAc(u.grainDM))} bu/acre, ${fmt(u.leach)} kg leached.`; },
    why: "Fertilizer only where it pays saves money and keeps N out of water.",
  }] },
  { n: 512, stops: [{
    view: "digester", beacon: [70, 3, 338], bs: 4, panel: "sec-energy",
    title: "Energy in, energy out",
    text: "Ammonia uses about 2 % of world final energy and emits about 450 Mt CO₂ a year." + sup(1) + " The digester turns manure into electricity.",
    plain: "Compare the field's fertilizer energy with the farm's manure power.",
    eq: "E<sub>NH₃</sub> = m<sub>NH₃</sub> · e<sub>NH₃</sub>,  e = 28 GJ/t (best gas plant) to ~41 GJ/t (world average)" + sup(1),
    live: () => `Fertilizer for this field: ${fmt(R.hb.gjBest)}–${fmt(R.hb.gjAvg)} GJ. Digester: ${ctl.digester ? `${fmt(R.dairy.mwhYr * 3.6)} GJ of electricity a year` : "off"}.`,
    why: "Green ammonia and more digesters can cut farm emissions.",
  }] },
  { n: 547, stops: [{
    view: "lake", beacon: [LAKE3.x - 40, 2, LAKE3.z], bs: 6, panel: "sec-lake",
    title: "Phosphorus rides on tiny particles",
    text: "Phosphate sticks to clay particles. Heavy rain washes soil, and its phosphorus, into the stream and lake." + sup(26),
    plain: "Keep the soil on the field and the phosphorus stays too.",
    eq: "P<sub>runoff</sub> = C<sub>dissolved</sub> · Q<sub>runoff</sub> + P<sub>soil</sub> · ER · sediment;  TSI = 14.42 ln(TP) + 4.15" + sup(30),
    live: () => `This year: ${fmt(R.ploss.dp, 2)} kg P/ha dissolved + ${fmt(R.ploss.pp, 2)} on eroded soil. Lake TP ${fmt(R.lake.tp)} µg/L, TSI ${fmt(R.lake.tsi)}.`,
    why: "One pound of phosphorus can grow about 500 pounds of algae." + sup(24) + " Zavala-lab models link manure management to phosphorus in the Upper Yahara lakes." + sup(21),
  }] },
  { n: 560, stops: [{
    view: "cell", beacon: [-2.4, 0.6, 0.3], bs: 0.25, micro: "cell", panel: "sec-season",
    title: "Inside a corn leaf cell",
    text: "Chloroplasts make sugar; the nucleus holds the DNA. A seed trait is an added gene, such as Bt's Cry gene or cspB." + sup(17),
    plain: "Gene → RNA → protein → trait.",
    eq: "DNA →(transcription)→ mRNA →(translation)→ protein",
    live: () => `Seed now: ${M.TRAITS[ctl.trait].label}. Yield ${fmt(M.buAc(Z().grainDM))} bu/acre in a ${M.YEARS[ctl.year].label.toLowerCase()} year.`,
    why: "Bt corn covered 87 % of U.S. corn acres in 2025." + sup(14),
  }, {
    view: "mol", beacon: [0, -2.1, 0], bs: 0.2, micro: "mol", panel: "sec-season",
    title: "From DNA to a protein that protects the plant",
    text: "Bt corn's Cry protein binds receptors only certain larvae have." + sup(16) + " Soybean nodules use nitrogenase to split N₂ at soil temperature.",
    plain: "Bt cut insecticide use, but resistance arose where refuges were skipped.",
    eq: "N₂ + 8 H⁺ + 8 e⁻ + 16 ATP → 2 NH₃ + H₂ + 16 ADP + 16 Pᵢ   (nitrogenase)",
    live: () => `Insect loss in this model: ${fmt(100 * M.TRAITS[ctl.trait].pest)} % (illustrative).`,
    why: "The National Academies found no added health risk from commercial GE crops." + sup(13),
  }] },
];
const lensNav = $("lenses"), lensCard = $("lens-card");
LENSES.forEach((L, i) => {
  const b = document.createElement("button");
  b.type = "button"; b.textContent = COURSE_SHORT[L.n]; b.dataset.i = i; b.setAttribute("aria-pressed", "false");
  b.title = `CBE ${L.n}: ${COURSE[L.n][1]}. See where it shows up on the farm`;
  b.onclick = () => (lens && lens.i === i ? closeLens() : openLens(i));
  lensNav.appendChild(b);
});
const beacon = new THREE.Group(); scene.add(beacon); beacon.visible = false;
{
  const mat = new THREE.MeshBasicMaterial({ color: "#e0262c", transparent: true, opacity: 0.9, depthTest: false, fog: false });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(4, 0.35, 12, 64).rotateX(Math.PI / 2), mat); ring.renderOrder = 10; beacon.add(ring);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(6.5, 0.2, 12, 64).rotateX(Math.PI / 2), mat.clone()); ring2.material.opacity = 0.5; ring2.renderOrder = 10; beacon.add(ring2);
}
let lens = null, lensPrev = null, beaconScale = 1;
function openLens(i, k = 0) {
  $("realworld").setAttribute("aria-pressed", "false");
  if (!lens) lensPrev = { p: camera.position.clone(), c: controls.target.clone(), fov: camera.fov, micro: inMicro };
  lens = { i, k };
  lensNav.querySelectorAll("button[data-i]").forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.i === i)));
  showStop();
}
// cards dock at the top of the side panel: bring them into view (desktop: scroll the panel; phones: scroll the page)
let introAtLoad = false;
function showCard() { const a = document.querySelector("aside"); if (matchMedia("(max-width: 860px)").matches) lensCard.scrollIntoView({ block: "start", behavior: "smooth" }); else a.scrollTo({ top: 0, behavior: "smooth" }); }
function showStop() {
  const L = LENSES[lens.i], S = L.stops[lens.k];
  goTo(S.view);
  const base = S.micro ? MICRO[S.micro] : new THREE.Vector3();
  if (S.view === "tractor") { const t = W3.tractor.position; S.beacon = [t.x, 1.5, t.z]; }
  if (S.view === "drone") { const t = W3.drone.position; S.beacon = [t.x, t.y - 2, t.z]; }
  beacon.position.set(base.x + S.beacon[0], base.y + S.beacon[1], base.z + S.beacon[2]); beaconScale = S.bs || 1; beacon.visible = true;
  document.querySelectorAll(".lens-hl").forEach(e => e.classList.remove("lens-hl"));
  if (S.panel) { const el = $(S.panel); if (el.classList.contains("fold")) setFold(el, true); el.classList.add("lens-hl"); }
  const last = lens.k === L.stops.length - 1;
  lensCard.innerHTML = `
    <div class="lc-top"><span class="lc-subject" title="CBE ${L.n}">${esc(COURSE_SHORT[L.n])}</span>
      <span class="lc-step">${L.stops.length > 1 ? `${lens.k + 1} of ${L.stops.length}` : ""}</span>
      <button class="lc-x" type="button" aria-label="Close">×</button></div>
    <h3>${S.title}</h3>
    <p>${S.text}</p>
    <p class="lc-plain"><b>In plain words:</b> ${S.plain}</p>
    <details class="lc-eq"><summary>Show the equation</summary>${MD.LENS_TEX[`${L.n}:${lens.k}`] ? `<div class="lc-tex">${TEXN(MD.LENS_TEX[`${L.n}:${lens.k}`], true)}</div>` : ""}${(MD.LENS_EQ[`${L.n}:${lens.k}`] || []).map(nm => `<div class="lc-tex">${TEXN(EQBYNAME[nm].tex, true)}</div><button type="button" class="lc-eqref" data-n="${EQNUM[nm]}">Eq. (${EQNUM[nm]}) · ${nm} · open in ∑ Model ▸</button>`).join("")}${!MD.LENS_TEX[`${L.n}:${lens.k}`] && !(MD.LENS_EQ[`${L.n}:${lens.k}`] || []).length ? `<div>${S.eq}</div>` : ""}</details>
    <p class="lc-live" id="lc-live"></p>
    ${S.note ? `<p class="lc-note">${S.note}</p>` : ""}
    <p class="lc-why"><b>Why it matters:</b> ${S.why}</p>
    <p class="lc-course">In college, you learn this in ${courseLink(L.n)}</p>
    <div class="lc-nav">
      <button class="btn" type="button" id="lc-back" ${lens.k === 0 ? "disabled" : ""}>Back</button>
      <button class="btn primary" type="button" id="lc-next">${last ? "Done" : "Next"}</button>
    </div>`;
  lensCard.hidden = false; showCard(); markActiveSpot();
  lensCard.querySelectorAll("details").forEach(d => d.addEventListener("toggle", () => fitTex(d))); fitTex(lensCard);
  lensCard.querySelector(".lc-x").onclick = closeLens;
  $("lc-back").onclick = () => { if (lens.k > 0) { lens.k--; showStop(); } };
  $("lc-next").onclick = () => { if (last) closeLens(); else { lens.k++; showStop(); } };
  lensRefresh();
}
function lensRefresh() { if (!lens || !R) return; const el = $("lc-live"); if (el) el.textContent = LENSES[lens.i].stops[lens.k].live(); }
function closeLens() {
  if (!lens) return;
  lens = null; lensCard.hidden = true; beacon.visible = false; W3.st.hold = null; markActiveSpot();
  document.querySelectorAll(".lens-hl").forEach(e => e.classList.remove("lens-hl"));
  lensNav.querySelectorAll("button[data-i]").forEach(b => b.setAttribute("aria-pressed", "false"));
  if (lensPrev) {
    if (lensPrev.micro !== inMicro) { setMicro(lensPrev.micro); camera.position.copy(lensPrev.p); controls.target.copy(lensPrev.c); camera.fov = lensPrev.fov; camera.updateProjectionMatrix(); }
    else tween = { from: { p: camera.position.clone(), c: controls.target.clone(), fov: camera.fov }, to: { p: lensPrev.p, c: lensPrev.c, fov: lensPrev.fov }, t0: performance.now(), dur: 1200 };
  }
}
document.addEventListener("keydown", e => { if (e.key === "Escape" && lens) closeLens(); });
function setFold(sec, open) { sec.classList.toggle("collapsed", !open); const h = sec.querySelector(":scope > h2"); if (h) h.setAttribute("aria-expanded", String(open)); if (open) requestAnimationFrame(() => { drawCurve(); drawMaps(); }); }
document.querySelectorAll("section.fold").forEach(sec => {
  const h = sec.querySelector(":scope > h2");
  h.tabIndex = 0; h.setAttribute("role", "button"); h.setAttribute("aria-expanded", "false");
  const toggle = () => setFold(sec, sec.classList.contains("collapsed"));
  h.addEventListener("click", e => { if (!e.target.closest("a")) toggle(); });
  h.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
});
let condOn = false;
$("cond-toggle").onclick = e => {
  condOn = e.currentTarget.getAttribute("aria-pressed") !== "true";
  e.currentTarget.setAttribute("aria-pressed", String(condOn));
  $("tag").hidden = !condOn; $("labels").hidden = !condOn; W3.gpsLines.visible = condOn;
  ["sec-season", "sec-n", "sec-loss", "sec-dairy"].forEach(id => setFold($(id), condOn));
};
document.addEventListener("click", e => {
  const a = e.target.closest("a.ref"); if (!a) return;
  e.preventDefault();
  const li = $("ref-" + a.dataset.ref); if (!li) return;
  closeModel(); closeCourses();
  setFold($("sec-refs"), true);
  li.scrollIntoView({ block: "center", behavior: "smooth" });
  li.classList.add("flash"); setTimeout(() => li.classList.remove("flash"), 1600);
});

// ---------- Real world ----------
function openIntro() {
  if (lens) closeLens();
  $("realworld").setAttribute("aria-pressed", "true");
  beacon.visible = false;
  lensCard.innerHTML = `
    <div class="lc-top"><span class="lc-subject">Real world</span>
      <button class="lc-x" type="button" aria-label="Close">×</button></div>
    <h3>What goes into a modern farm?</h3>
    <p>A Wisconsin farm: 300 cows, corn and soybeans, a digester, grain bins and a lake downstream. Press Play to grow a season.</p>
    <ul class="lc-list">
      <li><b>Food:</b> 645 million people faced hunger in 2025;${sup(32)} Haber–Bosch N feeds about half of humanity.${sup(2)}</li>
      <li><b>Energy:</b> ammonia uses ~2 % of world energy, 450 Mt CO₂/yr.${sup(1)}</li>
      <li><b>Water:</b> 1 in 10 Wisconsin wells exceeds the nitrate limit;${sup(7)} farm P feeds Lake Mendota's algae.${sup(25)}</li>
      <li><b>Small farms:</b> 84 % of farms are under 2 ha.${sup(34)}</li>
    </ul>
    <p class="lc-why"><b>ChemE role:</b> cleaner ammonia, digesters, nutrient recovery, sensors and controllers, watershed planning.${sup(20, 21)}</p>
    <div class="lc-nav"><button class="btn primary" type="button" id="lc-next">Start exploring</button></div>`;
  lensCard.hidden = false; if (!introAtLoad) showCard();
  const done = () => { lensCard.hidden = true; $("realworld").setAttribute("aria-pressed", "false"); try { localStorage.setItem("ag-intro-seen", "1"); } catch (e) {} };
  lensCard.querySelector(".lc-x").onclick = done;
  $("lc-next").onclick = done;
}
$("realworld").onclick = () => ($("realworld").getAttribute("aria-pressed") === "true" ? (lensCard.hidden = true, $("realworld").setAttribute("aria-pressed", "false")) : openIntro());
document.addEventListener("keydown", e => { if (e.key === "Escape" && !lens && !lensCard.hidden) { lensCard.hidden = true; $("realworld").setAttribute("aria-pressed", "false"); } });

// ---------- ChemE spots ----------
const LI = n => LENSES.findIndex(L => L.n === n);
const SPOTS = [
  { short: "Nitrogen balance", name: "Corn field: follow the nitrogen", lens: LI(250), pos: () => [300, 12, -120] },
  { short: "Crop model", name: "Weather station: a crop model", lens: LI(255), pos: () => [-40, 9, 130] },
  { short: "Haber–Bosch ammonia", name: "Fertilizer tank: Haber–Bosch", lens: LI(310), pos: () => { const p = W3.tractor.position; return [p.x, 6, p.z]; } },
  { short: "Nitrate leaching", name: "Soil: nitrate on the move", lens: LI(320), pos: () => [200, 4, -100] },
  { short: "Grain dryer", name: "Grain dryer: heat and air", lens: LI(326), pos: () => [-187, 24, 180] },
  { short: "Drone crop map", name: "Drone: crop map and uncertainty", lens: LI(355), pos: () => { const p = W3.drone.position; return [p.x, p.y + 6, p.z]; } },
  { short: "Evapotranspiration", name: "Leaves: evapotranspiration", lens: LI(426), pos: () => [520, 8, -330] },
  { short: "Digester microbes", name: "Digester: a microbial reactor", lens: LI(430), pos: () => [54, 16, 320] },
  { short: "Energy in and out", name: "Generator: energy in and out", lens: LI(512), pos: () => [70, 9, 338] },
  { short: "Variable-rate sprayer", name: "Sprayer: variable-rate control", lens: LI(470), pos: () => { const p = W3.tractor.position; return [p.x + 10, 8, p.z]; } },
  { short: "Phosphorus to the lake", name: "Stream and lake: phosphorus", lens: LI(547), pos: () => [LAKE3.x - 200, 8, LAKE3.z - 60] },
  { short: "Whole-farm design", name: "Barn and manure: whole-system design", lens: LI(450), pos: () => [150, 10, 300] },
  { short: "Seed traits and DNA", name: "Seed: from DNA to trait", lens: LI(560), pos: () => [110, 6, -400] },
];
// short 3D name labels for the main parts of the farm (hidden where they would sit on a spot)
const NAMES = [["Corn", [380, 4, -200]], ["Soybeans", [-360, 3, -260]], ["Sprayer", null], ["Dairy barn", [10, 14, 210]], ["Digester", [70, 12, 320]],
  ["Grain bins", [-215, 30, 150]], ["Stream", [600, 2, 130]], ["Lake", [LAKE3.x + 60, 2, LAKE3.z + 40]], ["Manure basin", [150, 4, 300]]];
const spotLayer = $("spots"), spotEls = [], nameEls = [];
const leaderSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); leaderSvg.setAttribute("class", "leaders"); spotLayer.appendChild(leaderSvg);
SPOTS.forEach((S, i) => {
  const b = document.createElement("button");
  b.type = "button"; b.className = "spot"; b.textContent = String(i + 1);
  b.setAttribute("aria-label", `ChemE spot ${i + 1}: ${S.name}`);
  const t = document.createElement("span"); t.textContent = S.short; b.appendChild(t);
  b.onclick = () => openLens(S.lens);
  spotLayer.appendChild(b); spotEls.push(b);
});
NAMES.forEach(([n]) => { const e = document.createElement("div"); e.className = "nlab"; e.textContent = n; spotLayer.appendChild(e); nameEls.push(e); });
// spots table along the left edge of the stage
const spotTable = $("spot-table");
spotTable.querySelector("ol").innerHTML = SPOTS.map((S, i) => `<li><button type="button" data-s="${i}" title="${S.name}"><i>${i + 1}</i><span>${S.short}</span></button></li>`).join("");
spotTable.querySelector("ol").onclick = e => { const b = e.target.closest("button[data-s]"); if (b) openLens(SPOTS[+b.dataset.s].lens); };
spotTable.querySelector(".st-toggle").onclick = () => { const c = spotTable.classList.toggle("collapsed"); spotTable.querySelector(".st-toggle").setAttribute("aria-expanded", String(!c)); };
if (matchMedia("(max-width: 860px)").matches) spotTable.classList.add("collapsed");
function markActiveSpot() { spotTable.querySelectorAll("button[data-s]").forEach(b => b.classList.toggle("on", !!lens && SPOTS[+b.dataset.s].lens === lens.i)); }
const _sv = new THREE.Vector3();
function screenOf(pos) {
  _sv.set(...pos).project(camera);
  const w = stage.clientWidth, h = stage.clientHeight;
  const vis = _sv.z < 1 && _sv.z > -1 && Math.abs(_sv.x) < 1.02 && Math.abs(_sv.y) < 1.02;
  return vis ? [(_sv.x + 1) / 2 * w, (1 - _sv.y) / 2 * h] : null;
}
function project(pos, el) {
  const q = screenOf(pos); el.style.display = q ? "" : "none";
  if (q) { el.style.left = `${q[0]}px`; el.style.top = `${q[1]}px`; }
}
function placeOverlays() {
  // spots: true screen positions, then push apart any two closer than D px; a leader line joins a moved spot to its true place
  const D = 36, P = SPOTS.map(S => (inMicro ? null : screenOf(S.pos()))), Q = P.map(p => (p ? [p[0], p[1]] : null));
  for (let it = 0; it < 40; it++) {
    let moved = false;
    for (let i = 0; i < Q.length; i++) for (let j = i + 1; j < Q.length; j++) {
      if (!Q[i] || !Q[j]) continue;
      let dx = Q[j][0] - Q[i][0], dy = Q[j][1] - Q[i][1], d = Math.hypot(dx, dy);
      if (d < D) { if (d < 0.01) { dx = 0; dy = 1; d = 1; } const push = (D - d) / 2 + 0.5; Q[i][0] -= dx / d * push; Q[i][1] -= dy / d * push; Q[j][0] += dx / d * push; Q[j][1] += dy / d * push; moved = true; }
    }
    if (!moved) break;
  }
  let lines = "";
  SPOTS.forEach((S, i) => {
    const el = spotEls[i];
    if (!Q[i]) { el.style.display = "none"; return; }
    el.style.display = ""; el.style.left = `${Q[i][0]}px`; el.style.top = `${Q[i][1]}px`;
    if (Math.hypot(Q[i][0] - P[i][0], Q[i][1] - P[i][1]) > 3) lines += `<line x1="${P[i][0]}" y1="${P[i][1]}" x2="${Q[i][0]}" y2="${Q[i][1]}"/><circle cx="${P[i][0]}" cy="${P[i][1]}" r="2.5"/>`;
  });
  leaderSvg.innerHTML = lines;
  // name labels: shown in the farm view only, hidden where they would sit on a spot
  NAMES.forEach(([n, pos], k) => {
    const el = nameEls[k]; const p = pos || [W3.tractor.position.x, 9, W3.tractor.position.z];
    const q = inMicro ? null : screenOf(p);
    const clash = q && Q.some(s => s && Math.abs(s[0] - q[0]) < 46 && Math.abs(s[1] - q[1]) < 26);
    if (!q || clash) { el.style.display = "none"; return; }
    el.style.display = ""; el.style.left = `${q[0]}px`; el.style.top = `${q[1]}px`;
  });
  if (condOn) for (const k in condEls) {
    if (inMicro) { condEls[k].style.display = "none"; continue; }
    const p = k === "drone" ? [W3.drone.position.x, W3.drone.position.y + 14, W3.drone.position.z] : COND_POS[k];
    project(p, condEls[k]);
  }
}

// ---------- Courses panel: features × CBE courses (shared ChemE Digital Twins format) ----------
const PS_URL = "../problems/";
const FAM = KIT.families;
const crs = { aud: "student", kind: "all", hi: null };
const featById = Object.fromEntries(FEATURES.map(f => [f.id, f]));
const CRS = COURSES.map(c => ({ ...c, kit: KIT.courses.find(k => k.n === c.n) }))
  .sort((a, b) => a.kit.order - b.kit.order || a.n.localeCompare(b.n, "en", { numeric: true }));
const topicOf = (c, id) => c.kit.topics.find(t => t.id === id);
const famColor = fam => (FAM[fam] ? FAM[fam].color : "var(--ink-2)");
$("crs-summary").textContent = `Used in ${CRS.length} courses, from first-year to electives.`;
function jump(go) {
  closeCourses(); $("mdl-panel").hidden = true;
  const [kind, a, b] = go.split(":");
  if (kind === "lens") openLens(LI(+a), b ? +b : 0);
  else if (kind === "sec") { setFold($(a), true); $(a).scrollIntoView({ block: "start", behavior: "smooth" }); }
}
// Part U: design problems (problems_check.mjs computes their answers); each setup link opens the starting design
const DESIGN = [
  { n: "CBE 560", id: "560-2", kind: "Product", what: "a seed-and-nitrogen package that holds yield in dry years, with its CO₂ per tonne of grain and what it means for neighbours' wells" },
];
function renderCourses() {
  const list = CRS.filter(c => crs.kind === "all" || (crs.kind === "core" ? c.kit.kind === "core" : c.kit.kind !== "core"));
  const num = c => c.n.replace("CBE ", "");
  const head = list.map(c => `<th scope="col" class="${crs.hi === c.n ? "hi" : ""}"><button type="button" class="crs-col" data-c="${c.n}" title="${c.n}: ${c.kit.title}">${num(c)}</button></th>`).join("");
  const rows = FEATURES.map(f => `<tr><th scope="row"><button type="button" class="crs-go" data-go="${f.go}">${f.name}</button></th>${list.map(c => {
    const on = c.features.includes(f.id), col = famColor(topicOf(c, c.topics[0]).family);
    return `<td class="${crs.hi === c.n ? "hi" : ""}">${on ? `<i style="background:${col}" title="${c.n} uses ${f.name}"></i>` : ""}</td>`; }).join("")}</tr>`).join("");
  const cards = list.map(c => `<article class="crs-card${crs.hi === c.n ? " hi" : ""}" id="crs-${num(c)}">
      <header><a href="${KIT.courseUrl.replace("{num}", num(c))}" target="_blank" rel="noopener" title="${c.n}: ${c.kit.title} (course guide)">${c.n} ↗</a><span class="crs-term">${c.kit.term}</span></header>
      <h4>${c.kit.title}</h4>
      <div class="crs-topics">${c.topics.map(id => { const t = topicOf(c, id); return `<span><i style="background:${famColor(t.family)}"></i>${t.name}</span>`; }).join("")}</div>
      <div class="crs-uses"><span>Uses</span>${c.features.map(id => featById[id]).map(f => `<button type="button" class="crs-go" data-go="${f.go}">${f.name} →</button>`).join("")}</div>
      <p class="crs-act"><b>${crs.aud === "student" ? "Try this" : "Use in class"}</b>${crs.aud === "student" ? c.student : c.instructor}</p>
      <a class="crs-ps" href="${PS_URL}#farm-${num(c)}" target="_blank" rel="noopener">Problem set ↗</a>${DESIGN.filter(d => d.n === c.n).map(d => ` <span class="crs-design" title="This course's problem set includes a ${d.kind.toLowerCase()} design problem">Design: ${d.kind.toLowerCase()}</span>`).join("")}
    </article>`).join("");
  const fams = [...new Set(list.flatMap(c => c.topics.map(id => topicOf(c, id).family)))];
  $("crs-body").innerHTML = `
    <p class="crs-one"><b>One process, many courses:</b> this digital twin shows how balances, thermodynamics, transport, kinetics, statistics, control and design work together in a real system.</p>
    <p class="crs-intro">${list.length} courses use this digital twin. Topic names follow the CBE Curriculum Navigator; click a feature to jump to it, or a course number to find its card.</p>
    <h3>Course map <small>rows: farm features · columns: courses, in curriculum order</small></h3>
    <div class="crs-scroll"><table class="crs-map"><thead><tr><th></th>${head}</tr></thead><tbody>${rows}</tbody></table></div>
    <p class="crs-int"><a href="${PS_URL}#farm-Integrative" target="_blank" rel="noopener">Integrative problem ↗</a> One field's nitrogen followed through CBE 250 → 310 → 320 → 470 → 450 on a single operating point.</p>
    <div class="crs-des"><b>Design problem</b> <span>Start from a need and numeric specs, try alternatives in the twin, choose and justify.</span><ul>${DESIGN.map(d => `<li><span class="crs-design">${d.kind}</span> ${d.n}: ${d.what}. <a href="${PS_URL}#farm-${d.n.replace("CBE ", "")}" target="_blank" rel="noopener">Problem ↗</a> · <a href="#ps-${d.id}">Open the starting design</a></li>`).join("")}</ul></div>
    <h3>Courses</h3>
    <div class="crs-grid">${cards}</div>
    <p class="crs-legend">${fams.map(k => `<span><i style="background:${famColor(k)}"></i>${FAM[k].label}</span>`).join("")}</p>`;
}
function openCourses() { renderCourses(); $("crs-panel").hidden = false; $("crs-panel").querySelector(".crs-x").focus(); }
function closeCourses() { $("crs-panel").hidden = true; }
$("crs-open").onclick = openCourses;
$("crs-open2").onclick = () => { closeModel(); $("crs-panel").hidden ? openCourses() : closeCourses(); };
$("crs-panel").querySelector(".crs-x").onclick = closeCourses;
for (const [id, key, attr] of [["crs-aud", "aud", "a"], ["crs-kind", "kind", "k"]]) $(id).onclick = e => {
  const b = e.target.closest("button"); if (!b) return;
  crs[key] = b.dataset[attr]; $(id).querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); renderCourses();
};
$("crs-body").onclick = e => {
  const g = e.target.closest(".crs-go"); if (g) { jump(g.dataset.go); return; }
  const h = e.target.closest(".crs-col");
  if (h) { crs.hi = crs.hi === h.dataset.c ? null : h.dataset.c; renderCourses(); document.getElementById("crs-" + h.dataset.c.replace("CBE ", ""))?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }
};
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("crs-panel").hidden) { e.stopImmediatePropagation(); closeCourses(); } }, true);

// ---------- ∑ Model panel: governing equations (KaTeX → MathML), parameters, method, assumptions, validation ----------
const EQNUM = {}, EQBYNAME = {}; { let n = 0; for (const g of MD.GROUPS) for (const e of g.eqs) { EQNUM[e.name] = ++n; EQBYNAME[e.name] = e; } }
// KaTeX HTML output with the shipped KaTeX fonts (Part L); falls back to MathML if the fonts cannot load
const KOPT = { output: "html" };
const texHTML = (t, display) => {
  try { if (window.katex) return window.katex.renderToString(t, { displayMode: display, output: KOPT.output, throwOnError: false }); } catch (e) {}
  return `<code>${t.replace(/</g, "&lt;")}</code>`;
};
const TEXN = (t, display) => texHTML(MD.normTex(t, display), display);
// Part V: a display equation wider than its box first shrinks to fit (down to 68 %), and only then scrolls inside the box
function fitTex(root) {
  if (!root) return;
  root.querySelectorAll(".lc-tex, .mdl-tex").forEach(b => {
    b.style.fontSize = ""; const cw = b.clientWidth; if (!cw) return;
    const w = b.scrollWidth; if (w <= cw + 1) return;
    b.style.fontSize = (parseFloat(getComputedStyle(b).fontSize) * Math.max(0.68, (cw - 2) / w)).toFixed(2) + "px";
  });
}
addEventListener("resize", () => { if (!$("mdl-panel").hidden) fitTex($("mdl-panel")); if (!lensCard.hidden) fitTex(lensCard); });
// live lines: typeset model symbols written like R_a, K_c, T_max, N_up, D_r, ET₀, f_c, F_N, TP in running text
const liveTex = str => str.replace(/ET₀/g, "\u0000ET_0\u0000").replace(/\b([A-Za-zθ]{1,2})_([A-Za-z0-9]{1,4})\b/g, (m) => `\u0000${m}\u0000`)
  .split("\u0000").map((seg, i) => (i % 2 ? texHTML(MD.normTex(seg.replace(/_([A-Za-z0-9]{2,})/, "_{$1}"), false), false) : seg)).join("");
if (document.fonts && document.fonts.load) {
  document.fonts.load("1em KaTeX_Main").then(() => document.fonts.load("italic 1em KaTeX_Math")).then(() => {
    if (!document.fonts.check("1em KaTeX_Main")) throw new Error("no KaTeX font");
  }).catch(() => { KOPT.output = "mathml"; if (!$("mdl-panel").hidden) renderModel(); if (lens) showStop(); updateStatic(); });
}
const mdlCtx = () => ({ R, ctl, day, fmt, dateOf, mid: midRec });
function renderModel() {
  const c = mdlCtx();
  const eqHTML = e => `<article class="mdl-eq" id="eq-${EQNUM[e.name]}">
      <div class="mdl-h"><span class="mdl-n">(${EQNUM[e.name]})</span><span class="mdl-name">${e.name}${e.ref.length ? sup(...e.ref) : ""}</span><button type="button" class="btn mdl-go" data-go="${e.go}" title="Close the panel and show where this happens on the farm">Show in the twin ▸</button></div>
      <div class="mdl-tex">${TEXN(e.tex, true)}</div>
      ${e.assumed || !e.ref.length ? `<p class="mdl-assumed"><span class="mdl-src">assumed</span>${e.assumed || "Form chosen for this twin; no single cited source."}</p>` : ""}
      <div class="mdl-scroll"><table class="mdl-tab"><thead><tr><th>Symbol</th><th>Meaning</th><th>Units</th><th>Value or range</th></tr></thead><tbody>
        ${e.sym.map(([sy, m, u, v]) => `<tr><td>${TEXN(sy, false)}</td><td>${m}</td><td>${u}</td><td>${v}</td></tr>`).join("")}</tbody></table></div>
      <p class="mdl-live"><b>Now:</b> ${(() => { try { return liveTex(e.live(c)); } catch (err) { return "–"; } })()}</p>
    </article>`;
  let first = 1;
  const groupsHTML = MD.GROUPS.map(g => { const a0 = first; first += g.eqs.length; return `<h4 class="mdl-group">${g.title} <small>${first - 1 > a0 ? `Eqs. (${a0})–(${first - 1})` : `Eq. (${a0})`}</small> ${(g.subj || []).map(n => courseLink(n)).join(" ")}</h4>${g.eqs.map(eqHTML).join("")}`; }).join("");
  const refN = s => s.replace(/refs? ([\d, ]+)/g, (m, ns) => "ref " + ns.split(/,\s*/).map(k => `<a href="#ref-${k}" class="ref" data-ref="${k}">${k}</a>`).join(", "));
  $("mdl-body").innerHTML = `
    <section><h3>1 · What is modeled</h3>
      <p>The system boundary is one Wisconsin farm for one growing season (April 1 to October 31): a 32 ha corn field split into 96 management zones, a soybean field, 300 dairy cows with a manure digester, a grain dryer, and the lake downstream of 40,000 ha of farms managed the same way. <b>States</b> (per zone, daily): root-zone water depletion, soil mineral nitrogen, crop dry mass, leaf area, crop N uptake and thermal time. <b>Inputs you can change</b>: N rate and timing, uniform or variable rate, weather year, irrigation, seed trait, cover crop, digester and nutrient recovery. <b>Outputs</b>: yield, water and nitrogen balances with each loss pathway, nitrate in drainage, N₂O, fertilizer energy and CO₂, drying heat, biogas power, phosphorus loss and the lake's trophic state.</p>
      <p class="mdl-note">Equations without a source are labelled <span class="mdl-assumed">assumed form</span>; parameters say whether they come from a reference or were assumed. Symbols and units match models.js.</p></section>
    <section><h3>2 · Governing equations</h3>${groupsHTML}</section>
    <section><h3>3 · Parameters and data</h3><div class="mdl-scroll"><table class="mdl-tab"><thead><tr><th>Parameter</th><th>Value</th><th>Units</th><th>Source</th></tr></thead><tbody>
      ${MD.PARAMS.map(([n, v, u, s]) => `<tr><td>${n}</td><td>${v}</td><td>${u}</td><td>${refN(s).replace(/(assumed|illustrative)/, '<span class="mdl-assumed">$1</span>')}</td></tr>`).join("")}</tbody></table></div></section>
    <section><h3>4 · Numerical method</h3>${MD.METHOD.map(t => `<p>${t}</p>`).join("")}</section>
    <section><h3>5 · Assumptions and limits</h3><ul>${MD.ASSUMPTIONS.map(t => `<li>${t}</li>`).join("")}</ul></section>
    <section><h3>6 · Validation</h3><div class="takeaway"><b>In short</b>The code does what the equations say (a separate Python version agrees to 13 digits, and no water or nitrogen goes missing), and its answers land near real Wisconsin numbers for yield, the best nitrogen rate and N₂O. Several soil and lake parameters are assumed, so trust the directions and sizes of effects more than the exact values.</div><ul>${MD.VALIDATION.map(t => `<li>${refN(t)}</li>`).join("")}</ul></section>`;
}
function openModel(n) {
  closeCourses(); renderModel(); $("mdl-panel").hidden = false;
  fitTex($("mdl-panel"));
  if (n) { const el = $("eq-" + n); if (el) { el.scrollIntoView({ block: "start" }); el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1600); } }
  else { $("mdl-body").scrollTop = 0; $("mdl-panel").querySelector(".mdl-x").focus(); }
}
function closeModel() { $("mdl-panel").hidden = true; }
$("mdl-open").onclick = () => ($("mdl-panel").hidden ? openModel() : closeModel());
$("mdl-panel").querySelector(".mdl-x").onclick = closeModel;
$("mdl-body").addEventListener("click", e => {
  const g = e.target.closest(".mdl-go"); if (!g) return;
  closeModel(); if (g.dataset.go === "ndvi") { setNDVI(true); goTo("drone"); } else jump(g.dataset.go);
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("mdl-panel").hidden) { e.stopImmediatePropagation(); closeModel(); } }, true);
document.addEventListener("click", e => { const b = e.target.closest(".lc-eqref"); if (b) openModel(+b.dataset.n); });

// ---------- problem-set setups: #ps=<course>-<k> (also #ps-<course>-<k>) ----------
function syncControls() {
  $("rate").value = ctl.rate; $("rate-out").textContent = ctl.precision ? "set by controller" : kgLb(ctl.rate);
  for (const k of ["irrigate", "cover", "digester", "recovery"]) $(k).checked = !!ctl[k];
  $("trait").value = ctl.trait;
  const seg = (attr, val) => document.querySelectorAll(`[data-${attr}]`).forEach(x => x.setAttribute("aria-pressed", String(x.dataset[attr] === val)));
  seg("year", ctl.year); seg("timing", ctl.timing); seg("prec", ctl.precision ? "1" : "0");
}
function applySetup() {
  const m = /^#ps[=-](\d{3}-\d+|int-\d+)$/.exec(location.hash); if (!m || !PS[m[1]]) return false;
  const S = PS[m[1]];
  Object.assign(ctl, psCtl(m[1])); syncControls(); compute();
  playing = false; playBtn.textContent = "Play";
  day = S.day; dayF = S.day; shownDay = -1; updateDay(day);
  if (lens) closeLens();
  lensCard.hidden = true; $("realworld").setAttribute("aria-pressed", "false"); closeCourses(); closeModel();
  document.querySelectorAll("section.fold").forEach(sec => setFold(sec, (S.open || []).includes(sec.id)));
  if (S.lens) openLens(LI(S.lens), S.stop || 0); else goTo(S.view || "farm");
  return true;
}
window.addEventListener("hashchange", applySetup);


// ---------- autonomous sprayer: GPS readouts and remote control ----------
const LAT0 = 43.07, LON0 = -89.40;   // Madison, WI (scene origin)
const drive = { remote: false, keys: new Set() };
function setDrive(remote) {
  drive.remote = remote; W3.setRemote(remote);
  document.querySelectorAll("[data-drive]").forEach(b => b.setAttribute("aria-pressed", String((b.dataset.drive === "remote") === remote)));
  $("rc-pad").hidden = !remote;
  if (remote) { if (lens) closeLens(); const t = W3.tractor.position; camera.position.set(t.x - 34, 16, t.z + 30); controls.target.set(t.x, 1.5, t.z); tween = null; setMicro(false); }
}
document.querySelectorAll("[data-drive]").forEach(b => b.onclick = () => setDrive(b.dataset.drive === "remote"));
const rcPress = (k, on) => {
  const r = W3.rc; if (!drive.remote) return;
  if (k === "up" && on) r.throttle = Math.min(1, r.throttle + 0.25);
  if (k === "down" && on) r.throttle = Math.max(-0.5, r.throttle - 0.25);
  if (k === "stop" && on) { r.throttle = 0; r.steer = 0; }
  if (k === "left") r.steer = on ? 1 : 0;
  if (k === "right") r.steer = on ? -1 : 0;
};
document.querySelectorAll("[data-rc]").forEach(b => {
  const k = b.dataset.rc;
  b.addEventListener("pointerdown", e => { e.preventDefault(); rcPress(k, true); b.setAttribute("aria-pressed", "true"); });
  for (const ev of ["pointerup", "pointerleave", "pointercancel"]) b.addEventListener(ev, () => { if (k === "left" || k === "right") rcPress(k, false); b.setAttribute("aria-pressed", "false"); });
});
const KEYMAP = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", " ": "stop" };
document.addEventListener("keydown", e => {
  if (!drive.remote || !KEYMAP[e.key] || (e.target.closest && e.target.closest("input, select, textarea"))) return;
  e.preventDefault(); if (e.repeat && (KEYMAP[e.key] === "up" || KEYMAP[e.key] === "down")) return; rcPress(KEYMAP[e.key], true);
});
document.addEventListener("keyup", e => { if (drive.remote && (e.key === "ArrowLeft" || e.key === "ArrowRight")) rcPress(KEYMAP[e.key], false); });
let gpsT = 0, lastTr = null;
function gpsTick(now) {
  // remote mode: keep the camera following the sprayer
  const tp = W3.tractor.position;
  if (drive.remote && lastTr && !inMicro) { const dx = tp.x - lastTr.x, dz = tp.z - lastTr.z; camera.position.x += dx; camera.position.z += dz; controls.target.x += dx; controls.target.z += dz; }
  lastTr = { x: tp.x, z: tp.z };
  if (now - gpsT < 250) return; gpsT = now;
  const P = W3.pose, lat = LAT0 - P.z / 111320, lon = LON0 + P.x / (111320 * Math.cos(LAT0 * Math.PI / 180));
  const hdg = ((180 - P.h * 180 / Math.PI) % 360 + 360) % 360, card = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(hdg / 45) % 8];
  $("g-mode").innerHTML = drive.remote ? '<span class="ok-t">Remote</span>' : "Autonomous";
  $("g-pos").textContent = `${lat.toFixed(6)}° N, ${Math.abs(lon).toFixed(6)}° W`;
  $("g-head").textContent = `${fmt(hdg)}° ${card} · ${fmt(Math.abs(P.v) * 3.6, 1)} km/h${P.v < -0.05 ? " (reverse)" : ""}`;
  $("g-pass").textContent = `${Math.min(P.nPass, Math.max(1, P.k + 1))} of ${P.nPass}`;
  $("g-xte").innerHTML = drive.remote ? `<span class="${P.xte > 1.5 ? "warn-t" : "ok-t"}">${fmt(P.xte, 1)} m</span>${P.xte > 1.5 ? " (crushing crop)" : ""}` : `<span class="ok-t">${fmt(100 * P.xte, 1)} cm</span>`;
}


// ---------- Links to Research (Part N): cards from the coordinator's verified map (TwinKit/research.json) ----------
RESEARCH.forEach(c => { c.lens = c.spot && SPOTS[c.spot - 1] ? SPOTS[c.spot - 1].lens : -1; });
if (RESEARCH.length) { $("res-open").hidden = false; }
function renderResearch() {
  $("res-body").innerHTML = `<p class="crs-intro">Research in UW–Madison Chemical &amp; Biological Engineering that connects to this digital twin.</p>
    <div class="res-grid">${RESEARCH.map((c, i) => `<article class="res-row" id="res-${i}">
      <div class="res-top"><a href="${c.url}" target="_blank" rel="noopener">${c.name} ↗</a></div>
      <p class="res-where">Connects to: ${c.where}</p>
      <div class="res-areas">${c.areas.map(a => `<span>${a}</span>`).join("")}</div>
      ${c.lens >= 0 ? `<button type="button" class="btn mdl-go res-go" data-l="${c.lens}" title="Close the panel and show this part of the twin">Show in the twin ▸</button>` : ""}
    </article>`).join("")}</div>
    ${CENTERS.length ? `<h3 class="res-grp">UW–Madison centers and programs</h3>
    <div class="res-grid res-centers">${CENTERS.map(c => `<article class="res-row">
      <div class="res-top"><a href="${c.url}" target="_blank" rel="noopener">${c.name} ↗</a></div>
      <p class="res-where">Connects to: ${c.where}</p>
    </article>`).join("")}</div>` : ""}`;
}
function openResearch(i) { closeCourses(); $("mdl-panel").hidden = true; renderResearch(); $("res-panel").hidden = false; if (i != null) { const el = $("res-" + i); if (el) { el.scrollIntoView({ block: "center" }); el.classList.add("hi"); } } }
$("res-open").onclick = () => ($("res-panel").hidden ? openResearch() : ($("res-panel").hidden = true));
$("res-panel").querySelector(".res-x").onclick = () => { $("res-panel").hidden = true; };
$("res-body").addEventListener("click", e => { const b = e.target.closest(".res-go"); if (b) { $("res-panel").hidden = true; openLens(+b.dataset.l); } });
document.addEventListener("click", e => { const a = e.target.closest("[data-res]"); if (a) { e.preventDefault(); openResearch(+a.dataset.res); } });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("res-panel").hidden) { e.stopImmediatePropagation(); $("res-panel").hidden = true; } }, true);
// ---------- Part M: user guide and pop-out panel ----------
try { if (localStorage.getItem("twin-guide-seen")) $("guide-open").classList.add("seen"); } catch (e) {}
$("guide-open").onclick = () => { $("guide-open").classList.add("seen"); try { localStorage.setItem("twin-guide-seen", "1"); } catch (e) {} const g = $("guide-panel"); g.hidden = !g.hidden; if (!g.hidden) { closeCourses(); $("mdl-panel").hidden = true; g.querySelector(".guide-x").focus(); } };
$("guide-panel").querySelector(".guide-x").onclick = () => { $("guide-panel").hidden = true; };
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("guide-panel").hidden) { e.stopImmediatePropagation(); $("guide-panel").hidden = true; } }, true);
const asideEl = document.querySelector("aside");
function setPopped(on) {
  document.body.classList.toggle("popped", on);
  $("pop-btn").textContent = on ? "⤡" : "⤢"; $("pop-btn").setAttribute("aria-label", on ? "Dock panel" : "Pop out panel"); $("pop-btn").title = on ? "Dock the panel back beside the 3D view" : "Pop the panel out into a floating window (drag its title bar, resize from the corner)";
  if (!on) { asideEl.style.left = asideEl.style.top = asideEl.style.right = asideEl.style.width = asideEl.style.height = ""; }
  try { localStorage.setItem("ag-popped", on ? "1" : "0"); } catch (e) {}
  requestAnimationFrame(() => { resize(); drawTrend(); drawCurve(); });
}
$("pop-btn").onclick = () => setPopped(!document.body.classList.contains("popped"));
{ let drag = null;
  $("aside-bar").addEventListener("pointerdown", e => { if (!document.body.classList.contains("popped") || e.target.closest("button")) return; const r = asideEl.getBoundingClientRect(); drag = { dx: e.clientX - r.left, dy: e.clientY - r.top }; $("aside-bar").setPointerCapture(e.pointerId); });
  $("aside-bar").addEventListener("pointermove", e => { if (!drag) return; asideEl.style.right = "auto"; asideEl.style.left = `${Math.max(0, Math.min(innerWidth - 120, e.clientX - drag.dx))}px`; asideEl.style.top = `${Math.max(0, Math.min(innerHeight - 60, e.clientY - drag.dy))}px`; });
  $("aside-bar").addEventListener("pointerup", () => { drag = null; }); }
try { if (localStorage.getItem("ag-popped") === "1" && !matchMedia("(max-width: 860px)").matches) setPopped(true); } catch (e) {}
// ---------- playback ----------
let playing = !matchMedia("(prefers-reduced-motion: reduce)").matches;
const playBtn = $("play");
playBtn.textContent = playing ? "Pause" : "Play";
playBtn.onclick = () => { playing = !playing; if (playing && day >= M.NDAYS - 1) { day = 0; dayF = 0; } playBtn.textContent = playing ? "Pause" : "Play"; };

compute();
day = 68; dayF = 68;   // open on June 8, the sidedress day: the sprayer is applying nitrogen over knee-high corn (Restart season goes back to April 1)
updateDay(day);
goTo("farm", true);
if (!applySetup()) { let seen = false; try { seen = localStorage.getItem("ag-intro-seen") === "1"; } catch (e) {} if (!seen) { introAtLoad = true; openIntro(); introAtLoad = false; } }

// drop to the low tier automatically if the high tier runs slowly (median of ~3 s of frames after the scene settles)
const qs = { t0: 0, frames: [] };
function qualityWatch(now) {
  if (QUALITY.tier !== "high" || qs.done || document.hidden) return;
  if (!qs.t0) { qs.t0 = now + 2500; return; }
  if (now < qs.t0) return;
  qs.frames.push(now);
  if (now - qs.t0 > 3000) {
    const fps = (qs.frames.length - 1) / ((now - qs.t0) / 1000); qs.done = true;
    if (fps >= 5 && fps < 35) {   // below 5 fps the tab is throttled (hidden or backgrounded), not slow
      QUALITY.tier = "low"; if (fps < 22) { QUALITY.pr = 1; renderer.setPixelRatio(1); resize(); } W3.setShadowSize(1024); }
  }
}
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); drawTrend(); drawCurve();
  composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h);
}
new ResizeObserver(resize).observe(stage); resize();

let last = performance.now();
renderer.setAnimationLoop(now => {
  const dt = Math.min((now - last) / 1000, 0.1); last = now;
  if (playing) {
    dayF += dt * +$("speed").value;
    if (dayF >= M.NDAYS - 1) { dayF = M.NDAYS - 1; playing = false; playBtn.textContent = "Play"; }
    const d = Math.floor(dayF);
    if (d !== day) { day = d; }
  }
  if (day !== shownDay) { shownDay = day; updateDay(day); }
  W3.tick(dt, now, +$("speed").value);
  if (tween) {
    const u = Math.min((now - tween.t0) / tween.dur, 1), e = u * u * (3 - 2 * u);
    camera.position.lerpVectors(tween.from.p, tween.to.p, e);
    controls.target.lerpVectors(tween.from.c, tween.to.c, e);
    camera.fov = tween.from.fov + (tween.to.fov - tween.from.fov) * e; camera.updateProjectionMatrix();
    if (u >= 1) tween = null;
  }
  if (beacon.visible) { const k = beaconScale * (1 + 0.18 * Math.sin(now / 220)); beacon.scale.set(k, beaconScale, k); }
  controls.update();
  if (!inMicro) { W3.followShadow(controls.target); W3.followDetail(controls.target, camera.position); }
  gpsTick(now);
  render(); qualityWatch(now);
  placeOverlays();
});
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { drawTrend(); drawCurve(); });
new MutationObserver(() => { drawTrend(); drawCurve(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
window.__app = { placeOverlays, setDrive, QUALITY, render, composer, ctl, compute, applySetup, openCourses, openModel, openLens, closeLens, LENSES, goTo, camera, controls, renderer, scene, W3, get R() { return R; }, setDay: d => { day = d; dayF = d; } };
