// Physics and economics for the campus decarbonization twin.
// One synthetic Madison weather year (8,760 hours) drives hourly heating, cooling and electricity loads that are
// calibrated to the annual demands in the CBE 450 case-study data sheet. A scenario (a set of technology choices)
// is dispatched hour by hour with energy balances on heat, chilled water and electricity; the results give
// emissions, energy use, peaks, load-duration curves and annualized cost / NPV against the current campus.
// Every constant is tagged in the tour or the notes as case-study data, Typical (literature) or Assumption.

export const NH = 8760;
export const LAT = 43.07;                       // Madison, °N

// ---------- case-study demands (CBE 450 data sheet, 2024) ----------
export const CASE = {
  elec_MWh: 402637,          // purchased electricity for buildings (excludes chillers here, see notes)
  steam_t: 1.0426e9 / 1000,  // t/yr of steam delivered to buildings
  steam_GJt: 2.0,            // GJ of usable heat per t of steam (1,000 kPa, data sheet)
  chw_t: 2.434e10 / 1000,    // t/yr of chilled water
  chw_kJkg: 60,              // kJ/kg removed per kg of chilled water (data sheet ≈ 14 K rise)
  fleet_km: 7.296e6, fleet_n: 912, km_per_gal: 40, kgCO2_gal: 8.89,
  transport_kt: 36,          // case-study figure: transportation total (fleet + commuting + other)
  figure_kt: { power: 240, heating: 134, cooling: 90, transport: 36, total: 500 },
  students: 50000, floor_m2: 2.3e6, area_km2: 3.6,
};
export const HEAT_GWh = CASE.steam_t * CASE.steam_GJt / 3600;          // ≈ 579 GWh_th/yr
export const COOL_GWh = CASE.chw_t * CASE.chw_kJkg / 3.6e6;            // ≈ 406 GWh_th/yr

// ---------- fuels, grid and prices ----------
export const EF = { ng: 0.181, rng: 0.07, h2: 0, gasoline: 8.89e-3 };  // t CO2 per MWh (HHV); gasoline t/gal
export const FUELS = {
  ng: { name: "Natural gas", ef: 0.181, price: 17.1 },                       // $5.0/MMBtu delivered
  blend: { name: "Natural gas + 20 vol% green H₂", ef: 0.181 * 0.929, price: 0, h2share: 0.071 },
  rng: { name: "Renewable natural gas", ef: 0.07, price: 136 },              // $40/MMBtu
  h2: { name: "100 % green H₂ (on-site electrolysis)", ef: 0, price: 0, h2share: 1 },
};
export const PRICE = { elec: 99.8, demand: 15, export: 30, gas_gal: 3.10, h2_kWh_kg: 55, h2_HHV_kWh_kg: 39.4, ng_MMBtu: 5.0 };

// ---------- deterministic random numbers ----------
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const gauss = r => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
const mean = a => { let s = 0; for (const v of a) s += v; return s / a.length; };
export const doyOf = h => Math.floor(h / 24), hodOf = h => h % 24;
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MDAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export function dateStr(h) { let d = doyOf(h), m = 0; while (d >= MDAYS[m]) { d -= MDAYS[m]; m++; } return `${MONTHS[m]} ${d + 1}`; }

// ---------- sun ----------
export function sunPos(doy, hod) {
  const dec = 23.45 * Math.sin(2 * Math.PI * (284 + doy) / 365) * Math.PI / 180, ha = (hod - 12) * 15 * Math.PI / 180, la = LAT * Math.PI / 180;
  const se = Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(ha), el = Math.asin(se);
  const az = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(la) - Math.tan(dec) * Math.cos(la));   // from south, + west
  return { el, az, elDeg: el * 180 / Math.PI };
}

// ---------- weather year ----------
export const WX = (() => {
  const r = rng(450), T = new Float32Array(NH), Twb = new Float32Array(NH), RH = new Float32Array(NH), ghi = new Float32Array(NH), wind = new Float32Array(NH), pv = new Float32Array(NH);
  const anom = new Float32Array(366), cloud = new Float32Array(366); let a = 0;
  for (let d = 0; d < 366; d++) { const win = 0.5 + 0.5 * Math.cos(2 * Math.PI * (d - 20) / 365), sig = 3.0 + 3.2 * win;
    a = 0.72 * a + Math.sqrt(1 - 0.72 * 0.72) * sig * gauss(r); anom[d] = a;
    cloud[d] = Math.min(1, Math.max(0, 0.5 + 0.12 * win + 0.3 * gauss(r))); }
  let x = 0, y = 0;
  for (let h = 0; h < NH; h++) {
    const d = h / 24, di = Math.floor(d), u = d - di, an = anom[di] * (1 - u) + anom[di + 1] * u, cl = cloud[di], hod = h % 24;
    const Tday = 7.9 - 15.2 * Math.cos(2 * Math.PI * (d - 20) / 365) + an, amp = 3.5 + 2.5 * (1 - cl);
    T[h] = Tday - amp * Math.cos(2 * Math.PI * (hod - 4) / 24);
    RH[h] = Math.min(98, Math.max(30, 72 + 14 * Math.cos(2 * Math.PI * (hod - 4) / 24) + 8 * cl));
    const t = T[h], rh = RH[h];
    Twb[h] = t * Math.atan(0.151977 * Math.sqrt(rh + 8.313659)) + Math.atan(t + rh) - Math.atan(rh - 1.676331) + 0.00391838 * rh ** 1.5 * Math.atan(0.023101 * rh) - 4.686035;
    const s = sunPos(di, hod + 0.5), se = Math.sin(s.el);
    ghi[h] = se > 0.01 ? 1098 * se * Math.exp(-0.057 / se) * (0.85 - 0.62 * cl) : 0;
    const cellT = t + ghi[h] / 800 * 25; pv[h] = ghi[h] / 1000 * 1.12 * (1 - 0.004 * (cellT - 25));
    x = 0.97 * x + Math.sqrt(1 - 0.97 * 0.97) * gauss(r); y = 0.97 * y + Math.sqrt(1 - 0.97 * 0.97) * gauss(r);
    const vm = 7.2 + 1.0 * Math.cos(2 * Math.PI * (d - 20) / 365), v = vm * Math.sqrt(x * x + y * y) / 1.2533;
    wind[h] = v < 3 || v > 25 ? 0 : v >= 12 ? 1 : (v ** 3 - 27) / (1728 - 27);
  }
  // capacity factors scaled to Typical values: fixed-tilt PV in Madison ≈ 14.5 % (AC); wind 36 % (case data sheet)
  const kp = 0.145 / mean(pv), kw = 0.36 / mean(wind);
  for (let h = 0; h < NH; h++) { pv[h] *= kp; wind[h] = Math.min(1, wind[h] * kw); }
  let Tmin = 99, Tmax = -99; for (const v of T) { Tmin = Math.min(Tmin, v); Tmax = Math.max(Tmax, v); }
  return { T, Twb, RH, ghi, wind, pv, Tmin, Tmax, Tmean: mean(T) };
})();

// ---------- hourly demand shapes calibrated to the case-study totals ----------
export const LOAD = (() => {
  const { T, ghi } = WX, heat = new Float32Array(NH), cool = new Float32Array(NH), elec = new Float32Array(NH);
  const Hb = 30, Cb = 26;     // MW: reheat, hot water and lab heat; lab and data-centre cooling (Assumption)
  let sH = 0, sC = 0, sE = 0;
  for (let h = 0; h < NH; h++) { sH += Math.max(0, 18 - T[h]); sC += Math.max(0, T[h] - 12) + ghi[h] / 1500; }
  const UAh = (HEAT_GWh * 1000 - Hb * NH) / sH, UAc = (COOL_GWh * 1000 - Cb * NH) / sC;
  for (let h = 0; h < NH; h++) {
    const d = doyOf(h), hod = hodOf(h), wk = (d + 1) % 7 < 5, occ = wk && hod >= 8 && hod < 18 ? 1 : wk && hod >= 6 && hod < 22 ? 0.5 : 0.15;
    heat[h] = Hb + UAh * Math.max(0, 18 - T[h]) * (0.92 + 0.12 * occ);
    cool[h] = Cb + UAc * (Math.max(0, T[h] - 12) + ghi[h] / 1500);
    elec[h] = 34 + 16 * occ + 0.6 * Math.max(0, T[h] - 18);
  }
  const kH = HEAT_GWh * 1000 / heat.reduce((a, b) => a + b, 0), kE = CASE.elec_MWh / elec.reduce((a, b) => a + b, 0);
  for (let h = 0; h < NH; h++) { heat[h] *= kH; elec[h] *= kE; }
  return { heat, cool, elec, UAh: UAh * kH, UAc, Hb: Hb * kH, Cb };
})();

// Calibration (2026-11-12) against the PSC FY2024 Energy Use in State Facilities report for UW–Madison
// (18.83 kWh/GSF and 1.34 therm/GSF over 23.14 M GSF): steam-boiler efficiency 0.82 → 0.85, steam-chiller COP 0.8 → 1.2,
// electric share of chillers 0.35 → 0.5. Building demands stay at the case-data values.
export const CAL = { year: "FY2024", elec_GWh: 23144475 * 18.83 / 1e6, fuel_GWh: 23144475 * 1.34 * 0.1 / 3.412 / 1000, before: { etaB: 0.82, absCOP: 0.8, elecChill: 0.35 } };

// ---------- equipment physics ----------
// Carnot-fraction COP with approach temperatures (°C in, COP out)
export function copHeat(Tsup, Tsrc, eta = 0.5) { const Tc = Tsup + 3 + 273.15, Te = Tsrc - 5 + 273.15; return Math.min(7, Math.max(1, eta * Tc / Math.max(5, Tc - Te))); }
export function copCool(Tcond, Tchw = 6, eta = 0.6) { const Te = Tchw - 2 + 273.15, Tc = Tcond + 273.15; return Math.min(10, Math.max(2, eta * Te / Math.max(3, Tc - Te))); }
export const ABS_COP = 1.2;      // steam-driven chillers, cooling per unit of steam heat: mostly steam-turbine-driven centrifugals (Typical 0.7–1.3). Calibrated: see CAL
export const ASHP_MIN_T = -20;    // °C, cold-climate air-source cutoff (Typical)

// distribution networks (supply/return °C, boiler efficiency HHV, loss factor for traps/leaks/aging, pumping Δp)
export const DIST = {
  steam: { name: "Steam 180 °C / condensate 85 °C", Ts: 180, Tr: 85, Tamb: 30, k: 0.045, aging: 1.8, etaB: 0.85, dp: 0, hp: false, absorb: true },
  hw70: { name: "Hot water 70 °C / 40 °C", Ts: 70, Tr: 40, Tamb: 10, k: 0.027, aging: 1.15, etaB: 0.90, dp: 400, hp: true, absorb: false },
  hw50: { name: "Low-temperature water 50 °C / 25 °C", Ts: 50, Tr: 25, Tamb: 10, k: 0.027, aging: 1.1, etaB: 0.94, dp: 450, hp: true, absorb: false },
};
export const NET = { km: 25, r1: 0.15, r2: 0.225 };     // trench length (Assumption), pipe and insulation outer radii (m)
export function netLoss(dk) {   // MW lost from supply + return pipes, cylindrical insulation
  const D = DIST[dk], Rp = Math.log(NET.r2 / NET.r1) / (2 * Math.PI * D.k);     // m·K/W
  const qs = (D.Ts - D.Tamb) / Rp, qr = (D.Tr - D.Tamb) / Rp;                    // W/m
  return { qs, qr, Rp, MW: (qs + qr) * NET.km * 1000 * D.aging / 1e6 };
}
export const BORE = { L: 200, s: 6, qmax: 45, Rb: 0.16, Tg0: 10, k: 2.4, rhoc: 2.3e6, cost: 25000, g: 6 };   // m, m, W/m, m·K/W, °C, W/mK, J/m³K, $/bore

// ---------- technology costs (CAPEX $, O&M $/yr, life yr). Sources in the tour and notes. ----------
export const COST = {
  solar: { capex: 1.331e6, om: 22e3, life: 30, unit: "MW" },
  wind: { capex: 2.634e6, om: 36e3, life: 25, unit: "MW" },
  nuclear: { capex: 15e6, om: 350e3, life: 40, fuel: 10, unit: "MW", cf: 0.93 },
  hp: { capex: 0.6e6, om: 15e3, life: 25, unit: "MW_th" },
  ashp: { capex: 0.75e6, om: 20e3, life: 20, unit: "MW_th" },
  chiller: { capex: 0.4e6, om: 20e3, life: 30, unit: "MW_th" },
  tesH: { capex: 30e3, om: 300, life: 40, unit: "MWh_th" },
  tesC: { capex: 25e3, om: 250, life: 40, unit: "MWh_th" },
  batt: { capex: 465e3, om: 12e3, life: 15, unit: "MWh" },
  chp: { capex: 1.6e6, om: 25e3, life: 30, unit: "MW_e" },
  conv: { network: 250e6, perM2: 60, life: 40 },            // steam → hot water conversion (Assumption)
  eff: { perM2per10: 25, life: 20 },                          // retrofits: $/m² per 10 % saved (Assumption)
  ev: { perVeh: 18e3, life: 12 },                            // incremental vehicle + charger (Typical)
  commute: { perPct: 0.15e6 },                               // $/yr per 1 % commuter shift (Assumption)
  ccs: { perTyr: 713, op: 22, storage: 25, life: 25, regen: 0.83, elec: 0.11, rate: 0.9 },   // $/(t/yr); $/t; $/t; MWh_th/t; MWh_e/t
  electrolyzer: { capex: 1.7e6, om: 40e3, life: 20 },        // $/MW_e
};
export const crf = (r, n) => r === 0 ? 1 / n : r * (1 + r) ** n / ((1 + r) ** n - 1);
export const pvf = (r, n) => r === 0 ? n : (1 - (1 + r) ** -n) / r;
export const lcoe = (k, cf, r) => { const c = COST[k]; return (c.capex * crf(r, c.life) + c.om) / (8760 * cf) + (c.fuel || 0); };

// ---------- scenarios ----------
export const BASE = { name: "Current campus", grid: 0.56, eff: 0, dist: "steam", hr: 0, gshp: 0, bores: 0, ashp: 0, tesH: 0, tesC: 0, elecChill: 0.5,
  chp: 0, fuel: "ng", ccs: 0, solar: 0.04, wind: 0, nuclear: 0, batt: 0, ev: 0.07, commute: 0, cprice: 0, rate: 0.06 };
export const SCENARIOS = {
  base: { ...BASE, blurb: "How the campus runs today: gas boilers make steam for heating, some chillers also run on steam, electricity comes from the grid, and the vehicles burn gasoline." },
  renew: { ...BASE, name: "Renewables first", solar: 120, wind: 60, batt: 80, elecChill: 1, ev: 0.6, eff: 5, blurb: "The first step most student teams chose: buy or build solar and wind power, add batteries, switch chillers to electricity and move to electric vehicles. It cuts the electricity's carbon but leaves gas heating untouched." },
  ccs: { ...BASE, name: "Renewables + carbon capture", solar: 120, wind: 60, batt: 80, elecChill: 1, ev: 0.6, eff: 5, ccs: 1, blurb: "The renewables plan, plus equipment that catches about 90 % of the CO₂ from the boiler chimneys so it can be stored underground. Many teams used this as their middle step." },
  elec: { ...BASE, name: "Electrified heat", dist: "hw70", hr: 60, gshp: 90, bores: 2600, ashp: 40, tesH: 1000, tesC: 400, elecChill: 1, solar: 150, wind: 60, batt: 120, ev: 0.8, eff: 10, blurb: "Replace steam with hot water so heat pumps can do most of the heating, using heat from the ground (a geothermal borefield), the air and the cooling system, with big storage tanks. Gas boilers only help on the coldest hours." },
  netzero: { ...BASE, name: "Net zero: electric + microreactor", grid: 0.11, dist: "hw50", hr: 70, gshp: 110, bores: 3200, ashp: 60, tesH: 2000, tesC: 600, elecChill: 1, fuel: "rng", solar: 250, wind: 60, nuclear: 10, batt: 400, ev: 1, commute: 30, eff: 15, blurb: "Go further: cooler 50 °C hot water, more heat pumps and storage, a small 10 MW nuclear reactor, renewable gas for the few remaining boilers, and a grid about 80 % cleaner, as the utility plans for 2030." },
  h2: { ...BASE, name: "Net zero via hydrogen", grid: 0.11, fuel: "h2", elecChill: 1, solar: 250, wind: 60, batt: 120, ev: 1, commute: 30, eff: 10, blurb: "Keep the steam system but burn hydrogen made on campus from water and electricity. It needs a lot of electricity, so it is only as clean as the grid. Most teams found this the most expensive option." },
};

// ---------- hourly dispatch ----------
export function simulate(cfgIn) {
  const c = { ...BASE, ...cfgIn }, D = DIST[c.dist], { T, Twb, pv, wind } = WX, eff = 1 - c.eff / 100;
  const fuel = FUELS[c.fuel];
  const a = n => new Float32Array(NH);
  const o = { heatLoad: a(), coolLoad: a(), elecLoad: a(), hrQ: a(), gsQ: a(), asQ: a(), tesHd: a(), chpQ: a(), boilQ: a(), copHR: a(), copGS: a(), copAS: a(), copCh: a(),
    elChQ: a(), stChQ: a(), gsCool: a(), tesCd: a(), solar: a(), windP: a(), nuc: a(), chpE: a(), battD: a(), battC: a(), grid: a(), exportP: a(), hpP: a(), chP: a(), pumpP: a(), evP: a(), h2P: a(), ccsP: a(), co2: a(), tesHs: a(), tesCs: a(), battS: a() };
  const loss = D.hp || c.dist === "steam" ? netLoss(c.dist).MW : 0;
  const hpOK = D.hp, hrCap = hpOK ? c.hr : 0, gsCap = hpOK ? c.gshp : 0, asCap = hpOK ? c.ashp : 0;
  const elecChillFrac = D.absorb ? c.elecChill : 1, chillCOPst = ABS_COP;
  const bL = BORE.L * Math.max(1, c.bores), qmaxField = c.bores * BORE.L * BORE.qmax / 1e6;  // MW extraction limit
  // ground temperature: long-term drift from the annual imbalance (computed after a first pass; two passes)
  let Tg = BORE.Tg0, drift = 0, Eext = 0, Erej = 0;
  const evKm = CASE.fleet_km * c.ev, evMWh = evKm * 0.29 / 1000;   // 0.29 kWh/km (case data sheet, light trucks)
  const chpEtaE = 0.33, chpEtaT = 0.45;
  // electrolysis for hydrogen fuel: flat load sized to the annual hydrogen energy needed (iterated twice)
  let h2MW = 0, sumFuel = 0, ccsCaptured = 0;
  for (let pass = 0; pass < 2; pass++) {
    let sH = 0, sC = 0, sB = 0; Eext = 0; Erej = 0; sumFuel = 0; ccsCaptured = 0;
    for (let h = 0; h < NH; h++) {
      const hod = h % 24;
      let H = LOAD.heat[h] * eff + loss, C = LOAD.cool[h] * eff, E = LOAD.elec[h] * eff;
      o.heatLoad[h] = H; o.coolLoad[h] = C;
      // ---- heat ----
      const cHR = copHeat(D.Ts, 13, 0.55), cGS = copHeat(D.Ts, Tg - 3, 0.5), cAS = T[h] > ASHP_MIN_T ? copHeat(D.Ts, T[h], 0.45) : 0;
      o.copHR[h] = hpOK ? cHR : 0; o.copGS[h] = hpOK ? cGS : 0; o.copAS[h] = hpOK ? cAS : 0;
      let need = H, hpE = 0;
      // heat recovery: evaporator draws on the chilled-water return, so it is limited by the coincident cooling load
      const hr = Math.min(hrCap, need, hrCap > 0 ? C / (1 - 1 / cHR) : 0); need -= hr; hpE += hr / (cHR || 1);
      const coolByHR = hr * (1 - 1 / (cHR || 1));
      // ground source: borefield extraction limit q'max
      const gsMax = gsCap > 0 ? Math.min(gsCap, qmaxField * cGS / (cGS - 1)) : 0, gs = Math.min(gsMax, need); need -= gs; hpE += gs / (cGS || 1); Eext += gs * (1 - 1 / (cGS || 1));
      // hot-water storage discharge
      let tesH = 0; if (c.tesH > 0 && need > 0) { tesH = Math.min(need, sH, c.tesH / 6); sH -= tesH; need -= tesH; }
      const as = cAS > 0 ? Math.min(asCap, need) : 0; need -= as; hpE += as / (cAS || 1);
      // spare heat-pump capacity charges storage
      if (c.tesH > 0) { const spare = Math.min(gsMax - gs, c.tesH / 6), q = Math.max(0, Math.min(spare, c.tesH - sH)); if (q > 0) { sH += q * 0.98; hpE += q / (cGS || 1); Eext += q * (1 - 1 / (cGS || 1)); } sH *= 0.9998; }
      // CHP heat, then boilers
      const chpQ = c.chp > 0 ? Math.min(need, c.chp / chpEtaE * chpEtaT) : 0; need -= chpQ; const chpE = chpQ / chpEtaT * chpEtaE;
      // ---- cooling ----
      let Cn = Math.max(0, C - coolByHR), tesC = 0;
      const Tcond = Twb[h] + 9, cCh = copCool(Tcond), cGsC = copCool(Tg + 8, 6, 0.55);
      o.copCh[h] = cCh;
      // ground-coupled cooling first (heat pumps reversed): cheapest cooling, and it recharges the borefield
      const gsC = gsCap > 0 ? Math.min(Math.max(0, gsCap - gs), Cn, 1.5 * qmaxField * cGsC / (cGsC + 1)) : 0; Cn -= gsC; Erej += gsC * (1 + 1 / cGsC);
      if (c.tesC > 0) { if (hod >= 11 && hod < 19) { tesC = Math.min(Cn, sC, c.tesC / 7); sC -= tesC; Cn -= tesC; } }
      const elCh = Cn * elecChillFrac, stCh = Cn - elCh;
      let chE = elCh / cCh + gsC / cGsC;
      if (c.tesC > 0 && (hod >= 22 || hod < 7)) { const q = Math.min(c.tesC / 9, c.tesC - sC); if (q > 0) { sC += q * 0.97; chE += q / copCool(Twb[h] + 9) * 1.05; } }
      need += stCh / chillCOPst;                                  // steam for absorption chillers
      // boilers (with capture regeneration steam if CCS)
      const boilQ = Math.max(0, need);
      let fuelB = boilQ / D.etaB, fuelC = chpQ > 0 ? chpQ / chpEtaT : 0, fuelT = fuelB + fuelC, regen = 0, capt = 0, ccsE = 0;
      if (c.ccs) { const ef = fuel.ef, g = COST.ccs.rate * ef * COST.ccs.regen / D.etaB; fuelT = fuelT / (1 - g); capt = COST.ccs.rate * ef * fuelT; regen = capt * COST.ccs.regen; ccsE = capt * COST.ccs.elec; }
      sumFuel += fuelT; ccsCaptured += capt;
      // pumping: chilled water (Δp 500 kPa, case data) and hot water; η = 0.75
      const pumpP = (C / (4.186 * 7) * 500 / 0.75 + (D.dp ? H / (4.186 * (D.Ts - D.Tr)) * D.dp / 0.75 : 0)) / 1000;  // MW
      // ---- electricity ----
      const evP = (hod >= 20 || hod < 6) ? evMWh / (365 * 10) : 0;
      const sol = c.solar * pv[h], wnd = c.wind * wind[h], nuc = c.nuclear * COST.nuclear.cf;
      let load = E + hpE + chE + pumpP + evP + ccsE + h2MW, gen = sol + wnd + nuc + chpE, net = load - gen;
      o.solar[h] = sol; o.windP[h] = wnd; o.nuc[h] = nuc; o.chpE[h] = chpE; o.hpP[h] = hpE; o.chP[h] = chE; o.pumpP[h] = pumpP; o.evP[h] = evP; o.ccsP[h] = ccsE; o.h2P[h] = h2MW; o.elecLoad[h] = load;
      o.hrQ[h] = hr; o.gsQ[h] = gs; o.asQ[h] = as; o.tesHd[h] = tesH; o.chpQ[h] = chpQ; o.boilQ[h] = boilQ; o.elChQ[h] = elCh; o.stChQ[h] = stCh; o.gsCool[h] = gsC + coolByHR; o.tesCd[h] = tesC;
      o.tesHs[h] = sH; o.tesCs[h] = sC;
      o.fuel = o.fuel || a(); o.fuel[h] = fuelT; o.capt = o.capt || a(); o.capt[h] = capt; o.netPre = o.netPre || a(); o.netPre[h] = net;
    }
    // battery: peak shaving around each day's mean net import, plus charging from surplus
    sB = 0; const P = c.batt / 4;
    for (let d = 0; d < 365; d++) {
      let m = 0; for (let k = 0; k < 24; k++) m += Math.max(0, o.netPre[d * 24 + k]); m /= 24;
      for (let k = 0; k < 24; k++) { const h = d * 24 + k; let net = o.netPre[h], dis = 0, ch = 0;
        if (c.batt > 0) { if (net < 0) { ch = Math.min(P, -net, (c.batt - sB) / 0.94); } else if (net > m * 1.05) { dis = Math.min(P, sB, net - m * 1.05); } else if (net < m * 0.95) { ch = Math.min(P, m * 0.95 - net, (c.batt - sB) / 0.94); } }
        sB += ch * 0.94 - dis; net += ch - dis; o.battC[h] = ch; o.battD[h] = dis; o.battS[h] = sB;
        o.grid[h] = Math.max(0, net); o.exportP[h] = Math.max(0, -net); }
    }
    // ground drift after 25 years: mean net heat flux per metre of bore through a long-term g-function,
    // ΔT = q'/(2πk)·g, g ≈ 6 for a large rectangular field at 25 years (Assumption). Mean over life feeds the COP.
    if (c.bores > 0) { const qnet = (Erej - Eext) * 1e6 / NH / (c.bores * BORE.L); drift = Math.max(-15, Math.min(15, qnet / (2 * Math.PI * BORE.k) * BORE.g)); Tg = BORE.Tg0 + drift / 2; }
    // hydrogen: annual H2 energy (HHV) → electrolyser MW at 50 kWh/kg, running flat
    const hs = fuel.h2share || 0; const h2MWh = sumFuel * hs; const kg = h2MWh * 1000 / PRICE.h2_HHV_kWh_kg; h2MW = kg * PRICE.h2_kWh_kg / 1000 / NH;
    o.h2kg = kg; o.h2MW = h2MW;
    if (!hs && c.bores === 0) break;
  }
  o.drift25 = c.bores > 0 ? drift : 0; o.qnet = c.bores > 0 ? (Erej - Eext) * 1e6 / NH / (c.bores * BORE.L) : 0; o.Tg = Tg; o.Eext = Eext; o.Erej = Erej; o.netLossMW = loss; o.cfg = c;
  return finish(o, c);
}

// ---------- annual results: emissions, energy, peaks, cost ----------
function finish(o, c) {
  const fuel = FUELS[c.fuel], sum = x => x.reduce((s, v) => s + v, 0), max = x => x.reduce((s, v) => Math.max(s, v), 0);
  const R = { cfg: c };
  // transport: fleet (case data) + commuting and other (case figure remainder), reduced by EVs and commuter shift
  const fleetKt = CASE.fleet_km / CASE.km_per_gal * CASE.kgCO2_gal / 1e6, otherKt = CASE.transport_kt - fleetKt;
  const gasGal = CASE.fleet_km * (1 - c.ev) / CASE.km_per_gal;
  // allocate grid emissions per hour to uses in proportion to their electricity (after on-site generation)
  let cP = 0, cH = 0, cC = 0, cT = 0, cX = 0;
  for (let h = 0; h < NH; h++) {
    const L = o.elecLoad[h], gi = o.grid[h] * c.grid;
    const fH = (o.hpP[h] + o.ccsP[h] + o.pumpP[h] * 0.3) / L, fC = (o.chP[h] + o.pumpP[h] * 0.7) / L, fT = o.evP[h] / L, fX = o.h2P[h] / L;
    const fuelCO2 = o.fuel[h] * fuel.ef - o.capt[h];
    const steamShare = o.stChQ[h] > 0 ? (o.stChQ[h] / ABS_COP) / (o.boilQ[h] + o.chpQ[h] || 1) : 0;
    cH += gi * fH + fuelCO2 * (1 - steamShare) + gi * fX * (1 - steamShare);
    cC += gi * fC + fuelCO2 * steamShare + gi * fX * steamShare;
    cT += gi * fT; cP += gi * (1 - fH - fC - fT - fX);
    o.co2[h] = gi + fuelCO2;
  }
  cT += gasGal * CASE.kgCO2_gal / 1000 + otherKt * 1000 * (1 - c.commute / 100);
  R.kt = { power: cP / 1000, heating: cH / 1000, cooling: cC / 1000, transport: cT / 1000 };
  R.kt.total = R.kt.power + R.kt.heating + R.kt.cooling + R.kt.transport;
  R.captured_kt = sum(o.capt) / 1000;
  // energy
  R.gridMWh = sum(o.grid); R.exportMWh = sum(o.exportP); R.fuelMWh = sum(o.fuel); R.solarMWh = sum(o.solar); R.windMWh = sum(o.windP); R.nucMWh = sum(o.nuc);
  R.elecLoadMWh = sum(o.elecLoad); R.hpMWh = sum(o.hpP); R.chMWh = sum(o.chP); R.pumpMWh = sum(o.pumpP); R.h2MWh = sum(o.h2P);
  R.heatMWh = sum(o.heatLoad); R.boilMWh = sum(o.boilQ); R.elecHeatMWh = sum(o.hrQ) + sum(o.gsQ) + sum(o.asQ) + sum(o.tesHd);
  R.siteGWh = (R.gridMWh + R.fuelMWh + gasGal * 0.0337 + R.solarMWh + R.windMWh + R.nucMWh) / 1000;
  R.peakGrid = max(o.grid); R.peakHeat = max(o.heatLoad); R.peakBoil = max(o.boilQ); R.peakCool = max(o.coolLoad); R.peakElec = max(o.elecLoad);
  R.lossMWh = o.netLossMW * NH;
  R.copGSavg = R.hpMWh > 0 ? (sum(o.gsQ) + sum(o.hrQ) + sum(o.asQ)) / Math.max(1, R.hpMWh - 0) : 0;
  // monthly peak imports for demand charges
  let dem = 0; { let h = 0; for (const md of MDAYS) { let m = 0; for (let k = 0; k < md * 24; k++, h++) m = Math.max(m, o.grid[h]); dem += m * 1000 * PRICE.demand; } }
  // ---- cost ----
  const r = c.rate, base = BASE, items = [];
  const add = (name, capex, life, om = 0) => { if (capex > 0 || om > 0) items.push({ name, capex, ann: capex * crf(r, life) + om }); };
  const d = (k, v0) => Math.max(0, c[k] - (v0 ?? base[k]));
  add("Solar PV", d("solar") * COST.solar.capex, COST.solar.life, c.solar * COST.solar.om);
  add("Wind", d("wind") * COST.wind.capex, COST.wind.life, c.wind * COST.wind.om);
  add("Microreactor", c.nuclear * COST.nuclear.capex, COST.nuclear.life, c.nuclear * COST.nuclear.om + R.nucMWh * COST.nuclear.fuel);
  const hpOn = DIST[c.dist].hp;
  add("Heat pumps (HR + ground)", hpOn ? (c.hr + c.gshp) * COST.hp.capex : 0, COST.hp.life, hpOn ? (c.hr + c.gshp) * COST.hp.om : 0);
  add("Air-source heat pumps", hpOn ? c.ashp * COST.ashp.capex : 0, COST.ashp.life, hpOn ? c.ashp * COST.ashp.om : 0);
  add("Geothermal borefield", hpOn ? c.bores * BORE.cost : 0, 50);
  add("Hot-water storage", hpOn ? c.tesH * COST.tesH.capex : 0, COST.tesH.life, hpOn ? c.tesH * COST.tesH.om : 0);
  add("Chilled-water storage", c.tesC * COST.tesC.capex, COST.tesC.life, c.tesC * COST.tesC.om);
  const elecChill = DIST[c.dist].absorb ? c.elecChill : 1, newCh = Math.max(0, elecChill - base.elecChill) * max(o.coolLoad);
  add("Electric chillers (replacing steam-driven)", newCh * COST.chiller.capex, COST.chiller.life);
  add("Batteries", c.batt * COST.batt.capex, COST.batt.life, c.batt * COST.batt.om);
  add("Campus CHP", c.chp * COST.chp.capex, COST.chp.life, c.chp * COST.chp.om);
  add("Steam → hot water conversion", c.dist !== "steam" ? COST.conv.network + COST.conv.perM2 * CASE.floor_m2 * (c.dist === "hw50" ? 1.4 : 1) : 0, COST.conv.life);
  add("Building retrofits", c.eff / 10 * COST.eff.perM2per10 * CASE.floor_m2, COST.eff.life);
  add("EV fleet + chargers", d("ev") * CASE.fleet_n * COST.ev.perVeh, COST.ev.life);
  add("Commuter programme", 0, 1, c.commute * COST.commute.perPct);
  add("Carbon capture (amine)", c.ccs ? R.captured_kt * 1000 * COST.ccs.perTyr : 0, COST.ccs.life, c.ccs ? R.captured_kt * 1000 * (COST.ccs.op + COST.ccs.storage) : 0);
  add("Electrolysers", o.h2MW * COST.electrolyzer.capex, COST.electrolyzer.life, o.h2MW * COST.electrolyzer.om);
  // operating purchases
  const elecCost = R.gridMWh * PRICE.elec + dem - R.exportMWh * PRICE.export;
  const fuelPrice = c.fuel === "ng" || c.fuel === "blend" ? FUELS.ng.price * (1 - (FUELS[c.fuel].h2share || 0)) : c.fuel === "rng" ? FUELS.rng.price : 0;
  const fuelCost = R.fuelMWh * fuelPrice, gasCost = gasGal * PRICE.gas_gal, co2Cost = R.kt.total * 1000 * c.cprice;
  R.items = items; R.capex = items.reduce((s, i) => s + i.capex, 0); R.annCap = items.reduce((s, i) => s + i.ann, 0);
  R.opex = { elec: elecCost, demand: dem, fuel: fuelCost, gasoline: gasCost, carbon: co2Cost };
  R.annual = R.annCap + elecCost + fuelCost + gasCost + co2Cost;     // $/yr
  R.omTot = items.reduce((s, i) => s + i.ann, 0) - items.reduce((s, i) => s + i.capex * crf(r, lifeOf(i.name)), 0);
  R.r = r;
  return Object.assign(o, { R });
}
const LIFE = { "Solar PV": 30, Wind: 25, Microreactor: 40, "Heat pumps (HR + ground)": 25, "Air-source heat pumps": 20, "Geothermal borefield": 50, "Hot-water storage": 40, "Chilled-water storage": 40, "Electric chillers (replacing steam-driven)": 30, Batteries: 15, "Campus CHP": 30, "Steam → hot water conversion": 40, "Building retrofits": 20, "EV fleet + chargers": 12, "Commuter programme": 1, "Carbon capture (amine)": 25, Electrolysers: 20 };
const lifeOf = n => LIFE[n] || 25;

// comparison against the current campus: NPV over 25 years, abatement cost
export function compare(R, R0, years = 25) {
  const r = R.r, op = x => x.annual - x.annCap + x.omTot, opS = op(R), op0 = op(R0);
  const npv = -(R.capex - R0.capex) + (op0 - opS) * pvf(r, years);
  const dE = R0.kt.total - R.kt.total, dC = R.annual - R0.annual;
  return { npv, abate: dE > 0.5 ? dC / (dE * 1000) : NaN, cut: dE / R0.kt.total, dAnnual: dC, opS, op0 };
}

// load-duration curve: sorted descending, sampled
export function ldc(arr, n = 120) { const s = Float32Array.from(arr).sort().reverse(), out = []; for (let i = 0; i < n; i++) out.push(s[Math.floor(i / (n - 1) * (NH - 1))]); return out; }
