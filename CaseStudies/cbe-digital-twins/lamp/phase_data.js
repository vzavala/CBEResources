// Lava Lamp Digital Twin: published data for the Phase lab. Every number here is from the cited source; nothing is fitted by us.

// ---- System 1: water (0) + ethanol (1) + castor oil (2) at 295.15 K ----
// NRTL parameters and tie-lines: Hasan, Yeganeh, Ciric, Chen, Vasquez, Urena-Benavides, J. Chem. Thermodyn. 180 (2023) 107007,
// doi:10.1016/j.jct.2023.107007 (Tables 2, 7, 8). Mole-fraction basis; castor oil as one pseudo-component of 984.4 g/mol.
// tau values are dimensionless at 295.15 K; G_ij = exp(-alpha_ij tau_ij). Water-ethanol pair as given in the paper (from a process simulator's databank).
const set = (t12, t21, a12, t13, t31, a13, t23, t32, a23) => ({ tau: [[0, t12, t13], [t21, 0, t23], [t31, t32, 0]], alpha: [[0, a12, a13], [a12, 0, a23], [a13, a23, 0]] });
const M1 = set(2.271349, -0.1869, 0.3031, 43.4028, 4.0821, 0.1275, 88.3423, 1.6555, 0.2698);   // fitted to the paper's analysis method 1
const M2 = set(2.271349, -0.1869, 0.3031, 43.6208, 3.3082, 0.1243, 39.0507, 1.2839, 0.2256);   // fitted to method 2
const mk = (P, label) => ({ id: "oil", label, names: ["water", "ethanol", "castor oil"], T: 295.15, MW: [18.015, 46.07, 984.4], rho: [998, 789, 952], heavyIdx: 0, alpha: P.alpha, tau: (i, j) => P.tau[i][j] });
export const OIL = mk(M1, "method 1 parameters"), OIL2 = mk(M2, "method 2 parameters");
// measured tie-lines, mass percent [water, ethanol, oil]: oil-rich phase, then water-rich phase (Table 2, method 1)
export const OIL_TIES = [
  [[2.67, 0.95, 96.38], [97.27, 2.73, 0.0020]], [[3.27, 1.96, 94.77], [88.40, 11.59, 0.0029]], [[3.66, 4.14, 92.20], [80.65, 19.35, 0.0034]], [[4.31, 5.51, 90.18], [75.9, 24.1, 0.0045]], [[4.82, 6.77, 88.40], [71.61, 28.39, 0.0064]],
  [[5.17, 10.10, 84.72], [62.12, 37.87, 0.0105]], [[5.54, 11.82, 82.64], [57.6, 42.4, 0.0123]], [[5.31, 13.13, 81.56], [54.86, 45.13, 0.0168]], [[5.79, 13.21, 81.00], [52.7, 47.2, 0.0204]], [[5.96, 18.22, 75.83], [44.1, 55.8, 0.0529]] ];
// density of ethanol-water mixtures at 20 °C, kg/m3 against mass percent ethanol (The Engineering ToolBox)
export const EW_RHO = [[0, 998], [20, 969], [40, 935], [50, 914], [60, 891], [70, 868], [80, 843], [100, 789]];

// ---- System 2: water + 2-propanol (isopropyl alcohol, IPA) + sodium chloride at 21 °C ----
// S. Ataee-Ataabadi, "The Phase Behaviour of Isopropanol/Water/NaCl Mixtures at Atmospheric Pressure", MSc thesis, Lakehead University, 2023.
// Mass fractions. Two-liquid boundary (Eq. 4.1): wIPA = exp(A wS^2 + B wS + C); salt-saturation boundary (Eq. 4.2): wIPA = D wS + E.
export const SALT = { T: 21, A: -18.472, B: -7.761, C: -0.170, D: -3.285, E: 0.799, sMin: 0.029, sMax: 0.217, plait: { s: 0.078, a: 0.401 }, solWater: 0.2642,
  // measured tie-lines (Table B1): [salt, IPA] in the water-rich (bottom) layer, then in the alcohol-rich (top) layer
  ties: [[[0.124, 0.240], [0.044, 0.525]], [[0.128, 0.226], [0.042, 0.538]], [[0.159, 0.155], [0.028, 0.633]], [[0.187, 0.102], [0.022, 0.688]], [[0.201, 0.085], [0.018, 0.707]]],
  rhoW: 998, rhoA: 785, rhoSapp: 2874,      // kg/m3: water and IPA (20 °C); apparent density of dissolved NaCl from a 20 % brine of 1147.8 kg/m3
  wRub: 0.647 };                            // mass fraction of IPA in "70 % by volume" rubbing alcohol if volumes add (our estimate)
