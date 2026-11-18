// Modern Agriculture: farm models that run live in the browser.
// Daily time step over one growing season (Apr 1 - Oct 31) plus a simple off-season (Nov - Mar).
// Pure functions, no DOM: the same file runs in Node for the validation against validate.py.
// Parameters marked ASSUMED are illustrative choices, not values taken from a cited model.

export const LAT = 43.07;            // Madison, WI (deg N)
export const DOY0 = 91, NDAYS = 214; // Apr 1 .. Oct 31
export const NX = 12, NZ = 8;        // precision-agriculture grid over the corn field (96 zones)
export const FIELD_HA = 32;          // corn field shown in 3D (ASSUMED size)

// ---------- weather: synthetic, Madison-like (ASSUMED shape; totals set per year type) ----------
export const YEARS = {
  normal: { seed: 11, pwet: 0.33, total: 640, dT: 0.0, winterDrain: 150, label: "Normal" },
  wet:    { seed: 23, pwet: 0.40, total: 900, dT: -0.5, winterDrain: 230, label: "Wet" },
  dry:    { seed: 37, pwet: 0.24, total: 450, dT: 1.2, winterDrain: 90, label: "Dry", summerDry: true },
};

export function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// FAO-56 eq. 21: extraterrestrial radiation (MJ m-2 d-1)
export function extraRad(doy, lat = LAT) {
  const phi = lat * Math.PI / 180;
  const dr = 1 + 0.033 * Math.cos(2 * Math.PI * doy / 365);
  const dec = 0.409 * Math.sin(2 * Math.PI * doy / 365 - 1.39);
  const ws = Math.acos(-Math.tan(phi) * Math.tan(dec));
  return 24 * 60 / Math.PI * 0.0820 * dr * (ws * Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.sin(ws));
}

const wxCache = {};
export function weather(type) {
  if (wxCache[type]) return wxCache[type];
  const Y = YEARS[type], rnd = mulberry32(Y.seed);
  const rain = new Float64Array(NDAYS), tmax = new Float64Array(NDAYS), tmin = new Float64Array(NDAYS),
    rs = new Float64Array(NDAYS), et0 = new Float64Array(NDAYS), ra = new Float64Array(NDAYS), wet = new Uint8Array(NDAYS);
  let anom = 0, sum = 0;
  for (let i = 0; i < NDAYS; i++) {
    const doy = DOY0 + i;
    const u = rnd(), ue = rnd(), u1 = rnd(), u2 = rnd();     // always four draws per day
    let pw = Y.pwet;
    if (Y.summerDry && doy >= 182 && doy <= 232) pw *= 0.45;  // July - mid-August dry spell
    wet[i] = u < pw ? 1 : 0;
    rain[i] = wet[i] ? -Math.log(1 - ue) : 0;
    sum += rain[i];
    const z = Math.sqrt(-2 * Math.log(1 - u1)) * Math.cos(2 * Math.PI * u2);
    anom = 0.7 * anom + 0.714 * 3.0 * z;
    const tm = 8.5 + 15 * Math.sin(2 * Math.PI * (doy - 108) / 365) + Y.dT + anom;
    const dtr = wet[i] ? 8 : 12.5;
    tmax[i] = tm + dtr / 2; tmin[i] = tm - dtr / 2;
    ra[i] = extraRad(doy);
    rs[i] = (0.25 + 0.5 * (wet[i] ? 0.25 : 0.6)) * ra[i];                  // FAO-56 eq. 35 (Angstrom)
    et0[i] = 0.0023 * (tm + 17.8) * Math.sqrt(tmax[i] - tmin[i]) * 0.408 * ra[i]; // FAO-56 eq. 52 (Hargreaves)
  }
  const k = Y.total / sum;
  for (let i = 0; i < NDAYS; i++) rain[i] *= k;
  return (wxCache[type] = { rain, tmax, tmin, rs, et0, ra, wet });
}

// ---------- crops, soil and traits ----------
export const CROPS = {
  corn: { plant: 125, gddMat: 1400, gddSilk: 750, laiMax: 5.2, k: 0.65, rue: 1.5, hi: 0.50,
          kcIni: 0.30, kcMid: 1.20, p: 0.55, zr: 1.2 },
  soy:  { plant: 135, gddMat: 1200, gddSilk: 650, laiMax: 4.5, k: 0.55, rue: 0.6, hi: 0.42,
          kcIni: 0.40, kcMid: 1.15, p: 0.50, zr: 1.0 },
};
export const SOIL = { thFC: 0.32, thWP: 0.14, CN: 78, CNcover: 75 };   // silt loam, row crops straight row good, group B
export const N = {
  init: 20,         // kg N/ha mineral N on Apr 1 (ASSUMED)
  mpot: 0.75,       // kg N/ha/d net mineralization at 20 C, moist soil (ASSUMED)
  umax: 6.0,        // kg N/ha/d maximum uptake by a full root system (ASSUMED)
  km: 25,           // kg N/ha mineral N at half the maximum uptake rate (ASSUMED)
  kden: 0.006,      // denitrification rate at saturation, 20 C (1/d, ASSUMED)
  rN2O: 0.06,       // N2O share of denitrified N (ASSUMED, scaled so a normal year is near the IPCC 1 % default)
  nitN2O: 0.004,    // N2O-N per kg fertilizer N from nitrification (ASSUMED)
  fracGASF: 0.11,   // share of fertilizer N lost to air as ammonia (IPCC 2019 default)
};
export const TRAITS = {
  conv:    { label: "Conventional", pest: 0.06, dp: 0, silkSens: 0.6, uptake: 1.0, nni0: 0.35 },
  bt:      { label: "Bt insect-resistant", pest: 0.01, dp: 0, silkSens: 0.6, uptake: 1.0, nni0: 0.35 },
  drought: { label: "Bt + drought-tolerant", pest: 0.01, dp: 0.10, silkSens: 0.3, uptake: 1.0, nni0: 0.35 },
  nue:     { label: "Bt + N-efficient (experimental)", pest: 0.01, dp: 0, silkSens: 0.6, uptake: 1.3, nni0: 0.25 },
};

export const runoffCN = (P, CN) => {            // SCS curve number, mm
  const S = 25400 / CN - 254, Ia = 0.2 * S;
  return P > Ia ? (P - Ia) * (P - Ia) / (P - Ia + S) : 0;
};
export const ncrit = W => (W < 1 ? 34 * W : 34 * Math.pow(W, 0.64));   // critical N uptake, kg N/ha (W in t/ha)
export function laiPot(g, laiMax) {
  const rise = laiMax / (1 + Math.exp(-12 * (g - 0.3)));
  return g <= 0.7 ? rise : rise * (1 - 0.6 * Math.min(1, ((g - 0.7) / 0.3)) ** 2);
}
const gddOf = (tx, tn) => Math.max(0, (Math.min(tx, 30) + Math.max(tn, 10)) / 2 - 10);

// ---------- one field zone, one season ----------
// o: {crop, year, events:[[dayIndex, kgN]], fall:kgN, irrigate, trait, cover, om, whc, manureDay, record}
export function season(o) {
  const C = CROPS[o.crop], T = TRAITS[o.trait || "conv"], wx = weather(o.year), Y = YEARS[o.year];
  const isCorn = o.crop === "corn";
  const om = o.om ?? 1, whc = o.whc ?? 1;
  const TAW = 1000 * (SOIL.thFC - SOIL.thWP) * C.zr * whc, WFC = 1000 * SOIL.thFC * C.zr * whc;
  const p = C.p + (isCorn ? T.dp : 0), RAW = p * TAW, CN = o.cover ? SOIL.CNcover : SOIL.CN;
  const plantI = C.plant - DOY0;
  // fall-applied N: overwinter losses before Apr 1
  let fallLeach = 0, fallDen = 0, fallVol = 0, Nmin = N.init;
  if (o.fall > 0) {
    fallVol = N.fracGASF * o.fall;
    const left = o.fall - fallVol;
    fallLeach = 0.9 * left * (1 - Math.exp(-Y.winterDrain / WFC));
    fallDen = 0.08 * (left - fallLeach);
    Nmin += left - fallLeach - fallDen - N.nitN2O * o.fall;     // nitrification N2O leaves the soil pool
  }
  let Dr = 0, LAI = 0, W = 0, Nup = 0, gdd = 0, silkS = 0, silkN = 0, matI = -1;
  let tot = { vol: fallVol, rain: 0, irr: 0, et: 0, drain: 0, runoff: 0, leach: 0, nro: 0, den: 0,
    n2o: N.nitN2O * (o.fall || 0) + N.rN2O * fallDen, minz: 0, fert: o.fall || 0, stressDays: 0 };
  const rec = o.record ? { lai: new Float32Array(NDAYS), Dr: new Float32Array(NDAYS), ks: new Float32Array(NDAYS), nmin: new Float32Array(NDAYS),
    nup: new Float32Array(NDAYS), W: new Float32Array(NDAYS), leach: new Float32Array(NDAYS), drain: new Float32Array(NDAYS), runoff: new Float32Array(NDAYS),
    irr: new Float32Array(NDAYS), nni: new Float32Array(NDAYS), et: new Float32Array(NDAYS), TAW } : null;
  const ev = o.events || [];
  for (let i = 0; i < NDAYS; i++) {
    for (const [d, kg] of ev) if (d === i) { Nmin += kg * (1 - N.fracGASF - N.nitN2O); tot.vol += N.fracGASF * kg; tot.fert += kg; tot.n2o += N.nitN2O * kg; }
    const tmean = (wx.tmax[i] + wx.tmin[i]) / 2;
    const planted = i >= plantI && matI < 0;
    // ----- water (FAO-56 root-zone depletion) -----
    const P = wx.rain[i], RO = runoffCN(P, CN);
    let irr = 0;
    if (o.irrigate && planted && Dr > 0.8 * RAW) irr = 25;
    const f = 1 - Math.exp(-C.k * LAI);
    const Kc = C.kcIni + (C.kcMid - C.kcIni) * Math.min(1, f / 0.85);
    const Ks = Dr <= RAW ? 1 : Math.max(0, (TAW - Dr) / ((1 - p) * TAW));
    const ET = Ks * Kc * wx.et0[i];
    Dr = Dr - (P - RO) - irr + ET;
    let DP = 0;
    if (Dr < 0) { DP = -Dr; Dr = 0; }
    if (Dr > TAW) Dr = TAW;
    tot.rain += P; tot.irr += irr; tot.et += ET; tot.drain += DP; tot.runoff += RO;
    if (planted && Ks < 1) tot.stressDays++;
    // ----- soil nitrogen -----
    const fT = tmean > 0 ? Math.pow(2, (tmean - 20) / 10) : 0;
    const wfrac = 1 - Dr / TAW;
    const mz = N.mpot * om * fT * (0.4 + 0.6 * wfrac);
    Nmin += mz; tot.minz += mz;
    const L = DP > 0 ? 0.9 * Nmin * DP / (WFC + DP) : 0;
    Nmin -= L;
    const nro = RO > 0 ? 0.02 * Nmin * RO / (RO + 10) : 0;
    Nmin -= nro;
    const den = Nmin * N.kden * fT * Math.max(0, (wfrac - 0.75) / 0.25) ** 2;
    Nmin -= den;
    tot.leach += L; tot.nro += nro; tot.den += den; tot.n2o += N.rN2O * den;
    // ----- crop -----
    let nni = 1;
    if (planted) {
      const g0 = gdd / C.gddMat;
      gdd += gddOf(wx.tmax[i], wx.tmin[i]);
      const g1 = Math.min(1, gdd / C.gddMat);
      if (isCorn) {
        const nc = ncrit(Math.max(W, 0.05));
        nni = Math.min(1.2, Nup / nc);
      }
      const Fn = isCorn ? Math.min(1, Math.max(0, (nni - T.nni0) / (0.95 - T.nni0))) : 1;
      const s = Math.min(Ks, Fn);
      if (LAI === 0) LAI = laiPot(0, C.laiMax) * 0.5;
      const lp0 = laiPot(g0, C.laiMax), lp1 = laiPot(g1, C.laiMax);
      if (lp1 >= lp0) LAI += (lp1 - lp0) * s; else LAI *= lp1 / lp0;
      const f1 = 1 - Math.exp(-C.k * LAI);
      W += C.rue * wx.rs[i] * f1 * s * 0.01;
      if (Math.abs(gdd - C.gddSilk) < 100) { silkS += Ks; silkN++; }
      if (isCorn) {
        const demand = Math.max(0, ncrit(Math.max(W, 0.05)) - Nup);
        const rootF = Math.min(1, gdd / 500);
        const up = Math.min(demand, N.umax * T.uptake * rootF * Nmin / (Nmin + N.km) * (0.5 + 0.5 * Ks));
        Nmin -= up; Nup += up;
      }
      if (gdd >= C.gddMat) matI = i;
    }
    if (rec) {
      rec.lai[i] = LAI; rec.Dr[i] = Dr; rec.ks[i] = Ks; rec.nmin[i] = Nmin; rec.nup[i] = Nup; rec.W[i] = W;
      rec.leach[i] = tot.leach; rec.drain[i] = DP; rec.runoff[i] = RO; rec.irr[i] = irr; rec.nni[i] = nni; rec.et[i] = ET;
    }
  }
  // ----- harvest -----
  const silkKs = silkN ? silkS / silkN : 1;
  const hi = C.hi * (1 - (isCorn ? T.silkSens : 0.4) * (1 - silkKs));
  const pest = isCorn ? T.pest : 0;
  const grainDM = W * hi * (1 - pest);                         // t/ha dry matter
  // ----- off-season after harvest: leftover nitrate meets winter drainage -----
  const coverUp = o.cover ? Math.min(0.6 * Nmin, 45) : 0;
  const offLeach = 0.9 * (Nmin - coverUp) * (1 - Math.exp(-Y.winterDrain / WFC));
  return {
    W, grainDM, hi, silkKs, LAI, Nup, Nres: Nmin, matI, gdd, TAW, WFC,
    tot, fallLeach, fallDen, coverUp, offLeach,
    leachYear: tot.leach + fallLeach + offLeach, rec,
  };
}

// ---------- unit helpers ----------
export const buAc = (dm, crop = "corn") => crop === "corn"
  ? dm * 1000 / 0.845 * 0.4047 / 25.40     // corn: 56 lb (25.40 kg) bushel at 15.5 % moisture
  : dm * 1000 / 0.87 * 0.4047 / 27.22;     // soybean: 60 lb (27.22 kg) bushel at 13 % moisture
export const lbAc = kgha => kgha * 0.8922;

// ---------- heterogeneous corn field (ASSUMED smooth patterns) ----------
export function fieldMaps() {
  const om = new Float64Array(NX * NZ), whc = new Float64Array(NX * NZ), err1 = new Float64Array(NX * NZ), err2 = new Float64Array(NX * NZ);
  const r = mulberry32(2024);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const x = (i + 0.5) / NX, z = (j + 0.5) / NZ, c = j * NX + i;
    // a darker, wetter swale running across the field and a sandy knoll in one corner
    const swale = Math.exp(-(((z - 0.35 - 0.25 * x) / 0.16) ** 2));
    const knoll = Math.exp(-(((x - 0.82) / 0.2) ** 2 + ((z - 0.78) / 0.22) ** 2));
    om[c] = 0.85 + 0.55 * swale - 0.25 * knoll + 0.06 * Math.sin(7 * x + 2 * z);
    whc[c] = 1.0 + 0.18 * swale - 0.38 * knoll + 0.05 * Math.cos(5 * z - 3 * x);
    err1[c] = (r() - 0.5) * 0.16; err2[c] = (r() - 0.5) * 0.16;   // sensor error, +/-8 %
  }
  return { om, whc, err1, err2 };
}

// split / spring / fall application schedule for a total rate
export function schedule(rate, timing) {
  const plantI = CROPS.corn.plant - DOY0;
  if (timing === "fall") return { fall: rate, events: [] };
  if (timing === "spring") return { fall: 0, events: [[plantI - 5, rate]] };
  return { fall: 0, events: [[plantI, 0.4 * rate], [plantI + 34, 0.6 * rate]] };   // ~V6 sidedress
}

// variable-rate controller: for each zone, run the crop model with the sensor estimates of the soil
// and normal-year weather, and choose the most profitable N rate (corn price vs fertilizer price)
export const PRICE_RATIO = 0.10;   // $ per lb N / $ per bushel
const vrCache = {};
export function vrRates(ctl, maps) {
  const key = [ctl.timing, ctl.trait, ctl.cover, ctl.irrigate].join("|");
  if (vrCache[key]) return vrCache[key];
  const n = NX * NZ, out = new Float64Array(n);
  for (let c = 0; c < n; c++) {
    const base = { crop: "corn", year: "normal", irrigate: ctl.irrigate, trait: ctl.trait, cover: ctl.cover,
      om: maps.om[c] * (1 + maps.err1[c]), whc: maps.whc[c] * (1 + maps.err2[c]) };
    let best = -1e9, bestR = 0;
    for (let r = 0; r <= 260; r += 10) {
      const y = season({ ...base, ...schedule(r, ctl.timing) });
      const ret = buAc(y.grainDM) - PRICE_RATIO * lbAc(r);
      if (ret > best + 1e-9) { best = ret; bestR = r; }
    }
    out[c] = bestR;
  }
  return (vrCache[key] = out);
}

// ---------- whole-farm run for the current controls ----------
// ctl: {rate, timing, irrigate, year, trait, precision, cover, digester, recovery}
export function runFarm(ctl, opts = {}) {
  const maps = opts.maps || fieldMaps(), n = NX * NZ;
  const rates = ctl.precision ? vrRates(ctl, maps) : new Float64Array(n).fill(ctl.rate);
  const zones = [];
  const agg = { grainDM: 0, fert: 0, leach: 0, n2o: 0, nup: 0, nup0: 0, runoff: 0, drain: 0, irr: 0, den: 0, nro: 0, et: 0, rain: 0, stressDays: 0, grainDM0: 0 };
  for (let c = 0; c < n; c++) {
    const sch = schedule(rates[c], ctl.timing);
    const base = { crop: "corn", year: ctl.year, irrigate: ctl.irrigate, trait: ctl.trait, cover: ctl.cover, om: maps.om[c], whc: maps.whc[c] };
    const r = season({ ...base, ...sch, record: !!opts.record });
    const r0 = season({ ...base, fall: 0, events: [] });
    zones.push({ rate: rates[c], grainDM: r.grainDM, leach: r.leachYear, nup: r.Nup, lai: r.rec ? r.rec.lai : null, ks: r.rec ? r.rec.ks : null, res: r });
    agg.grainDM += r.grainDM / n; agg.grainDM0 += r0.grainDM / n; agg.fert += r.tot.fert / n; agg.leach += r.leachYear / n;
    agg.n2o += r.tot.n2o / n; agg.nup += r.Nup / n; agg.nup0 += r0.Nup / n; agg.runoff += r.tot.runoff / n; agg.drain += r.tot.drain / n;
    agg.irr += r.tot.irr / n; agg.den += (r.tot.den + r.fallDen) / n; agg.nro += r.tot.nro / n; agg.et += r.tot.et / n; agg.rain += r.tot.rain / n;
    agg.stressDays += r.tot.stressDays / n;
  }
  agg.recovery = agg.fert > 0 ? (agg.nup - agg.nup0) / agg.fert : 0;        // fertilizer N recovery efficiency
  agg.nitrate = agg.drain > 0 ? 100 * agg.leach / (agg.drain + YEARS[ctl.year].winterDrain) : 0;   // mg N/L in drainage
  return { zones, agg, rates, maps };
}

// yield response to N rate (field mean), for the diminishing-returns chart
export function responseCurve(ctl, maps) {
  const pts = [];
  for (let r = 0; r <= 300; r += 20) {
    const a = runFarm({ ...ctl, rate: r }, { maps }).agg;
    pts.push({ rate: r, grainDM: a.grainDM, leach: a.leach, fert: a.fert });
  }
  return pts;
}

// ---------- soybean field (no N fertilizer: root nodules fix N) ----------
export function runSoy(ctl) {
  return season({ crop: "soy", year: ctl.year, irrigate: ctl.irrigate, trait: "conv", cover: ctl.cover, fall: 0, events: [], record: true });
}

// ---------- Haber-Bosch: fertilizer N back to ammonia, gas and CO2 ----------
export const HB = { gjBest: 28, gjAvg: 41, co2Avg: 2.4 };   // IEA Ammonia Technology Roadmap 2021: best gas plants; world average
export function haberBosch(kgN) {
  const tNH3 = kgN * 17.031 / 14.007 / 1000;
  const stoichCO2 = tNH3 * (3 / 8) * 44.01 / 17.031;   // CH4 + 2H2O -> CO2 + 4H2 ; N2 + 3H2 -> 2NH3
  return { tNH3, gjBest: tNH3 * HB.gjBest, gjAvg: tNH3 * HB.gjAvg, co2: tNH3 * HB.co2Avg, stoichCO2 };
}

// ---------- dairy: manure, digester, phosphorus ----------
export const DAIRY = {
  cows: 300, cropHa: 300,
  biogasCow: 1.2,   // m3 biogas per cow per day (Penn State Extension)
  ch4Frac: 0.6,     // methane share of biogas (Penn State Extension)
  lhv: 35.8,        // MJ per m3 CH4
  eff: 0.35,        // engine-generator electrical efficiency (ASSUMED)
  pCow: 0.07,       // kg P excreted per cow per day (ASSUMED)
  pRecov: 0.5,      // share of manure P exported by solids separation / P recovery (ASSUMED)
  stp: 45,          // soil test P, ppm (ASSUMED)
  grainP: 0.0027,   // kg P per kg grain dry matter (ASSUMED)
};
export function dairy(ctl) {
  const D = DAIRY;
  const biogas = ctl.digester ? D.cows * D.biogasCow : 0;               // m3/day
  const ch4 = biogas * D.ch4Frac;
  const kw = ch4 * D.lhv * D.eff / 86.4;                                 // MJ/day -> kW
  const pManure = D.cows * D.pCow * 365;                                 // kg P/yr
  const pExport = ctl.digester && ctl.recovery ? D.pRecov * pManure : 0;
  const pPerHa = (pManure - pExport) / D.cropHa;
  return { ch4, biogas, kw, mwhYr: kw * 8.76, pManure, pExport, pPerHa };
}

// field P runoff for the season (kg P/ha): dissolved + attached to eroded soil (ASSUMED coefficients).
// Soil test P (STP) is averaged over the next 10 years of the current manure practice.
export function soilP(pPerHa, grainDM) {
  const removed = grainDM * 1000 * DAIRY.grainP;                          // kg P/ha/yr in harvested grain
  const perYr = (pPerHa - removed) / 18;                                 // ppm per year (18 kg P/ha per ppm, ASSUMED)
  return { removed, perYr, stp10: DAIRY.stp + 10 * perYr, stpAvg: DAIRY.stp + 5 * perYr };
}
export function phosphorus(ctl, rec, pPerHa, stp, daily = null) {   // daily: optional Float64Array(NDAYS), receives kg P/ha lost each day
  const wx = weather(ctl.year);
  const manI = CROPS.corn.plant - DOY0 - 10;   // manure spread ~10 days before planting
  let dp = 0, pp = 0, sed = 0;
  for (let i = 0; i < NDAYS; i++) {
    const RO = rec.runoff[i];
    if (RO <= 0) continue;
    const fresh = i >= manI ? Math.exp(-(i - manI) / 20) * pPerHa / 25 : 0;
    const drp = 0.004 * stp + 1.0 * fresh;                               // mg/L
    dp += drp * RO * 10 / 1000;                                          // RO mm over 1 ha = 10 m3 per mm
    const Cf = (ctl.cover && i < 92 ? 0.5 : 1) * Math.exp(-0.5 * rec.lai[i]);   // cover-crop residue and canopy protect the soil
    const s = 0.03 * Math.pow(RO, 1.3) * Cf;                             // t soil/ha
    sed += s;
    pp += s * (600 + 5 * stp) * 1.5 / 1000;                              // kg P/ha (fine soil is P-rich)
    if (daily) daily[i] += drp * RO * 10 / 1000 + s * (600 + 5 * stp) * 1.5 / 1000;
  }
  return { dp, pp, total: dp + pp, sed, wx: !!wx };
}

// lake: steady-state total P (Chapra-style mass balance) and Carlson trophic state
export const LAKE = { farmHa: 40000, background: 5000, Q: 1.0e8, area: 4.0e7, vs: 12 };
export function lake(pLossPerHa) {
  const load = pLossPerHa * LAKE.farmHa + LAKE.background;               // kg P/yr
  const tp = load * 1e9 / ((LAKE.Q + LAKE.vs * LAKE.area) * 1000);       // ug/L
  const tsi = 14.42 * Math.log(tp) + 4.15;
  const chl = Math.exp((tsi - 30.6) / 9.81);                             // chlorophyll with the same TSI
  return { load, tp, tsi, chl };
}

// grain drying: water to evaporate from harvest moisture down to 15.5 %
export function drying(grainDM, matI, year) {
  const wx = weather(year), harvest = 298 - DOY0;
  let m = 0.32;
  if (matI < 0) m = 0.35;
  else for (let i = matI + 1; i <= harvest && i < NDAYS; i++) m -= 0.005 * Math.max(0, (wx.tmax[i] + wx.tmin[i]) / 2) / 15;
  m = Math.max(0.17, m);
  const water = grainDM * 1000 * (m / (1 - m) - 0.155 / 0.845);          // kg water per ha
  const mj = Math.max(0, water) * 2.45 / 0.5;                            // latent heat / dryer efficiency (ASSUMED 50 %)
  return { moist: m, water: Math.max(0, water), mj };
}

// ---------- everything the app shows for one set of controls (used by app.js and problems_check.mjs) ----------
export function farmReport(ctl, maps = fieldMaps(), opts = {}) {
  const farm = runFarm(ctl, { maps, record: true });
  const uni = ctl.precision ? runFarm({ ...ctl, precision: false }, { maps }) : farm;
  const vr = ctl.precision ? farm : runFarm({ ...ctl, precision: true }, { maps });
  const soy = runSoy(ctl);
  const dm = dairy(ctl);
  const sp = soilP(dm.pPerHa, farm.agg.grainDM);
  const ploss = { dp: 0, pp: 0, total: 0, sed: 0 };
  const pDay = new Float64Array(NDAYS);
  for (const z of farm.zones) { const p = phosphorus(ctl, z.res.rec, dm.pPerHa, sp.stpAvg, pDay); for (const k in ploss) ploss[k] += p[k] / farm.zones.length; }
  for (let i = 0; i < NDAYS; i++) pDay[i] /= farm.zones.length;
  ploss.daily = pDay;
  const lk = lake(ploss.total);
  const hb = haberBosch(farm.agg.fert * FIELD_HA);
  const midZone = farm.zones[4 * NX + 6].res;
  const dry = drying(farm.agg.grainDM, midZone.matI, ctl.year);
  const curve = responseCurve({ ...ctl, precision: false }, maps);
  let best = null;
  for (const p of curve) { const ret = buAc(p.grainDM) - PRICE_RATIO * lbAc(p.rate); if (!best || ret > best.ret) best = { rate: p.rate, ret }; }
  const years = {};
  for (const y of ["wet", "normal", "dry"]) years[y] = y === ctl.year ? farm.agg.grainDM : runFarm({ ...ctl, year: y }, { maps }).agg.grainDM;
  return { farm, uni, vr, soy, dairy: dm, sp, ploss, lake: lk, hb, dry, curve, best, years };
}
