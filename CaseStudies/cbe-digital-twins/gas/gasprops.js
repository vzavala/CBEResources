// Gas properties shared by the page and problems_check.mjs (no browser dependencies).
// Illustrative pipeline gas, chosen so that M matches the paper's 18 kg/kmol; critical constants and
// acentric factors from Poling, Prausnitz & O'Connell; Pitzer (Abbott) virial correlation from Smith, Van Ness, Abbott & Swihart.
export const GAS = [   // name, y, M (kg/kmol), Tc (K), pc (bar), omega, carbon atoms
  ["CH₄", 0.90, 16.04, 190.6, 46.0, 0.012, 1], ["C₂H₆", 0.05, 30.07, 305.3, 48.7, 0.100, 2], ["C₃H₈", 0.02, 44.10, 369.8, 42.5, 0.152, 3],
  ["N₂", 0.02, 28.01, 126.2, 33.9, 0.038, 0], ["CO₂", 0.01, 44.01, 304.1, 73.8, 0.224, 1],
];
const sumY = k => GAS.reduce((a, g) => a + g[1] * g[k], 0);
export const Mmix = sumY(2), Tpc = sumY(3), Ppc = sumY(4), Wmix = sumY(5), nC = sumY(6);     // Kay's rule pseudo-criticals
export const T0 = 293.15, Rg = 8.314, GAMMA = 2.34 / 1.85, BETA = (GAMMA - 1) / GAMMA, CO2_PER_KG = nC * 44.01 / Mmix;
// Pitzer (Abbott) virial correlation: z = 1 + (B0 + w B1) pr / Tr
export function pitzer(p, T = T0) {
  const Tr = T / Tpc, pr = p / Ppc;
  const B0 = 0.083 - 0.422 / Tr ** 1.6, B1 = 0.139 - 0.172 / Tr ** 4.2, B = B0 + Wmix * B1;
  const dB = 0.675 / Tr ** 2.6 + Wmix * 0.722 / Tr ** 5.2;
  const z = 1 + B * pr / Tr, dzdT = pr / Tpc * (dB / Tr - B / Tr ** 2);
  const CpMol = 2.34 * Mmix;                                       // J/(mol K)
  const muJT = Rg * T * T / (p * 1e5 * CpMol) * dzdT * 1e5;        // K/bar, (dT/dp)_h = RT^2/(p Cp) (dz/dT)_p
  return { z, Tr, pr, muJT, rho: p * 1e5 * Mmix / 1000 / (z * Rg * T) };
}
// lower heating value of the mixture, MJ/kg (heats of combustion: NIST WebBook, water as vapour)
export const LHV_MIX_ = GAS.reduce((a, g) => a + g[1] * ({ "CH₄": 802.3, "C₂H₆": 1428.6, "C₃H₈": 2043.1 }[g[0]] || 0), 0) / Mmix;
