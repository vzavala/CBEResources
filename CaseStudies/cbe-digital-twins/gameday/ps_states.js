// Problem-set setups: the state each #ps-<course>-<k> link (or older #ps=<course>-<k>) loads. Shared by the app (index.html applies it on load)
// and by problems_check.mjs (which computes every numeric answer from the same model with the same state).
// Fields: W = weather (afternoon high °C, afternoon RH %, cloud 0–1, wind m/s, rain mm/h, day of year),
// hour = clock (CDT, paused unless play: true), ctrl = app controls, P = player and drink settings,
// lens / spot = card to open, open = side-panel section to expand.
const HOT = { Thigh: 31, RH: 50, cloud: 0.05, wind: 2, rain: 0, doy: 250 };     // early-September noon game
const MILD = { Thigh: 17, RH: 55, cloud: 0.3, wind: 3.5, rain: 0, doy: 285 };   // mid-October afternoon
const COLD = { Thigh: 3, RH: 70, cloud: 0.6, wind: 5, rain: 0, doy: 327 };      // late-November night
const STORM = { Thigh: 27, RH: 85, cloud: 1, wind: 7, rain: 60, doy: 255 };     // September thunderstorm
const SNOW = { Thigh: -4, RH: 85, cloud: 1, wind: 3, rain: 3, doy: 345 };       // December snow game
const BASE = { surf: "rubber", age: 3, pad: true, snowRate: 1, pg0: 13.0, Tin: 21, bladder: "butyl", v0: 25, angle: 35, spin: 10, wdir: "tail",
  hv: 5.5, liner: "epp", foam: "eva", cut: 45, fab: "poly", tubeS: 0.23, tubeD: 0.15 };
const LINE = { role: "line", gear: "full", work: "game", drink: "sports", drinkRate: 800 };
const st = (W, hour, ctrl = {}, P = {}, extra = {}) => ({ W: { ...W, kick: hour }, hour, ctrl: { ...BASE, ...ctrl }, P: { ...LINE, ...P }, ...extra });

export const PS = {
  "150-1": st(HOT, 11, {}, {}, { open: "sec-every", play: false }),
  "250-1": st(STORM, 14.5, {}, {}, { spot: "base" }),
  "310-1": st(COLD, 18.5, { pg0: 12.5, Tin: 21.5 }, {}, { open: "sec-ball", spot: "ball" }),
  "311-1": st(HOT, 13, {}, {}, { lens: "CBE 311" }),
  "320-1": st(MILD, 14.5, { v0: 25, angle: 35, spin: 10, wdir: "tail" }, {}, { open: "sec-pass", spot: "pass" }),
  "320-2": st(STORM, 14.5, {}, {}, { spot: "base" }),
  "326-1": st(HOT, 13, { surf: "rubber" }, {}, { open: "sec-turf", spot: "turf" }),
  "326-2": st(HOT, 13, {}, { gear: "full", work: "game" }, { spot: "player" }),
  "426-1": st(MILD, 14.5, { bladder: "latex", pg0: 13.0 }, {}, { spot: "ball" }),
  "430-1": st(HOT, 13, { surf: "rubber" }, {}, { lens: "CBE 430" }),
  "440-1": st(MILD, 14.5, { hv: 5.5, liner: "epp" }, {}, { open: "sec-hel", spot: "helmet" }),
  "450-1": st(SNOW, 14, { snowRate: 1, surf: "grass" }, {}, { spot: "heating" }),
  "470-1": st(HOT, 11, {}, { gear: "full", work: "game", drink: "sports", drinkRate: 800 }, { open: "sec-pl", spot: "player" }),
  "470-2": st(COLD, 18.5, { pg0: 13.0, Tin: 21 }, {}, { open: "sec-ball", lens: "CBE 470" }),
  "512-1": st(SNOW, 14, { snowRate: 1, surf: "grass" }, {}, { spot: "heating" }),
  "540-1": st(MILD, 14.5, { foam: "eva" }, {}, { spot: "cleats" }),
  "547-1": st(HOT, 13, { fab: "poly" }, {}, { spot: "uniform" }),
  // integrative case: one hot September kickoff, one lineman, followed from the air to the drinking plan
  "int-1": st(HOT, 11, {}, { gear: "full", work: "game", drink: "sports", drinkRate: 800 }, { open: "sec-pl", spot: "player" }),
  // design problem (Part U): opens on the starting design, not the solution
  "560-2": st(HOT, 11, {}, { gear: "full", work: "game", drink: "water", drinkRate: 400 }, { open: "sec-lineman", spot: "drink" }),
  "560-1": st(MILD, 14.5, {}, { gear: "light", work: "game", drink: "water", drinkRate: 1200 }, { open: "sec-pl", spot: "drink" }),
};
