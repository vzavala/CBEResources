// Default configuration for the lab column. Every geometric / operating parameter lives here so the
// twin can later be calibrated against plant data by editing (or fitting) these values.

export const DEFAULT_CONFIG = {
  geometry: {
    nTrays: 12,              // sieve trays, numbered 1 (top) .. nTrays (bottom)
    diameter: 0.15,          // m, column internal diameter (~6" glass sections, from the lab photo)
    traySpacing: 0.20,       // m
    weirHeight: 0.025,       // m
    downcomerAreaFrac: 0.10, // fraction of cross-section taken by one downcomer
    holeDiameter: 0.002,     // m
    holeAreaFrac: 0.04,      // hole area / active area
    trayThickness: 0.0015,   // m
    orificeCoeff: 0.73,      // dry-tray discharge coefficient
    shellHeight: 3.0,        // m, overall column height (for rendering)
    reboilerVolume: 0.020,   // m3 liquid working volume (20 L)
  },
  operation: {
    feedFlowLph: 18.0,       // L/h liquid feed
    feedX: 0.10,             // mole fraction ethanol in feed
    feedT: 343.15,           // K (70 C)  -- feed preheater outlet
    feedTray: 5,             // tray number receiving feed (1 = top)
    reboilerDuty: 10000,     // W
    refluxRatio: 6.0,        // L/D set on the reflux splitter
    topPressure: 101325,     // Pa (atmospheric vented condenser)
    refluxSubcool: 5.0,      // K below the bubble point of the condensate
    coolingWaterLpm: 6.0,    // L/min
    coolingWaterT: 293.15,   // K
    condenserUA: 450,        // W/K
    ambientT: 295.15,        // K
    insulated: true,
    efficiencyMode: 'oconnell', // 'oconnell' (per-tray, from local alpha & viscosity) or 'fixed'
    murphreeFixed: 0.65,
    reboilerLevelSP: 0.6,    // fraction of reboiler working volume
  },
  // Basic regulatory control layer (PI loops). 'auto' = controller moves the output, 'manual' = operator sets it.
  control: {
    level: { mode: 'auto', Kc: 0.5, tauI: 300 },                      // LIC-101: reboiler level -> bottoms flow (mol/s per unit level)
    tray: { mode: 'manual', tray: 7, sp: null, Kc: 500, tauI: 900 },   // TIC-107: most duty-sensitive tray T -> reboiler duty (W/K, s)
    top: { mode: 'manual', tray: 4, sp: null, Kc: 4, tauI: 1500 },     // TIC-104: rectifying-tray T -> reflux ratio (1/K, s)
  },
  heatLoss: {
    hBare: 9.0,              // W/m2K  bare glass section to room
    hInsulated: 0.9,         // W/m2K  with jacket insulation
  },
};

export function cloneConfig(c = DEFAULT_CONFIG) { return JSON.parse(JSON.stringify(c)); }
