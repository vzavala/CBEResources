// Problem-set setups. A link ending in #ps=<course>-<k> puts the body in exactly this state:
// conditions, a water deficit, events (eat / coffee / drink at minute t), and minutes already run.
// The app then pauses so every student reads the same numbers. problems_check.mjs uses the same
// function, so the answers in problems.json come from the same model state.
export const SETUPS = {
  "150-1": { cfg: { act: "jog" }, run: 0, view: "body", open: ["sec-act"] },
  "250-1": { cfg: { act: "jog", tdb: 25 }, run: 60, view: "body", lens: [0, 0] },
  "255-1": { cfg: { act: "rest" }, events: [[0, "coffee", 200]], run: 0, view: "body", open: ["sec-food"] },
  "310-1": { cfg: { act: "run", tdb: 30, rh: 40 }, run: 45, view: "body", heat: true, lens: [2, 0] },
  "311-1": { cfg: { act: "rest" }, def: 1.0, run: 0, view: "organs", open: ["sec-organs"] },
  "320-1": { cfg: { act: "rest", alt: 3000 }, run: 0, view: "organs", lens: [3, 0] },
  "320-2": { cfg: { act: "jog", alt: 4500 }, run: 5, view: "organs", lens: [3, 1] },
  "326-1": { cfg: { act: "jog" }, run: 30, view: "organs", lens: [4, 1] },
  "426-1": { cfg: { act: "run" }, run: 20, view: "organs", lens: [5, 0] },
  "430-1": { cfg: { act: "rest" }, events: [[0, "coffee", 200]], run: 60, view: "organs", lens: [6, 0] },
  "430-2": { cfg: { act: "rest" }, events: [[0, "coffee", 500]], run: 0, view: "organs", lens: [6, 1] },
  "470-1": { cfg: { act: "jog" }, run: 0, view: "body", open: ["sec-act"] },
  "470-d1": { cfg: { act: "run", tdb: 30, rh: 50 }, run: 0, view: "body", heat: true, open: ["sec-act", "sec-heat"] },
  "470-2": { cfg: { act: "rest" }, events: [[0, "eat", 75]], run: 0, view: "body", lens: [7, 1] },
  "int-1": { cfg: { act: "run", tdb: 28, rh: 50 }, run: 45, view: "body", heat: true, open: ["sec-act", "sec-organs"] },
  "560-1": { cfg: { act: "rest" }, events: [[0, "eat", 75]], run: 40, view: "organs", lens: [8, 0] },
};
const DEFAULT_CFG = { act: "rest", tdb: 22, rh: 50, alt: 0 };
// Put `body` in the setup's state. onStep(body) is called after every simulated minute.
export function applySetup(body, S, onStep = () => {}) {
  Object.assign(body.cfg, DEFAULT_CFG, S.cfg || {}, { startDef: S.def ?? 0 });
  body.reset();
  const ev = S.events || [], run = S.run || 0;
  const fire = t => ev.filter(e => e[0] === t).forEach(([, kind, amount]) => kind === "eat" ? body.eat(amount) : kind === "coffee" ? body.coffee(amount) : body.drink(amount));
  for (let t = 0; t < run; t++) { fire(t); body.step(); onStep(body); }
  fire(run);
  body.update(0);
  return body;
}
