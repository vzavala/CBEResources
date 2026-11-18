// ∑ Model panel: every equation below is one the code in sim.js solves (function named in `code`),
// written with the code's symbols and units. Rendered with KaTeX (MathML output) when the panel opens.
import { P, liverCL, bloodVisc, sat, baroP, heatW, activityVO2, caffeineCLlin, organHeat, bedGas, heatBalance, ORGAN_K, ORGAN_MASS } from "./sim.js";

const f = (x, d = 1) => Number(x).toFixed(d);
// Each equation: n, group, name, tex, syms [symbol (TeX), meaning, units, value], go (jump), live(ctx), refs, code
export function equations(ctx) {
  const N = () => ctx.body.now, b = ctx.body, c = () => N().circ, l = () => N().lung, k = () => N().kid, th = () => N().th;
  const A = () => P.ACT[b.cfg.act];
  return [
    // ---------------- balances ----------------
    { n: 1, group: "Activity and whole-body balances", name: "Oxygen use from activity", code: "activityVO2",
      tex: String.raw`\dot V_{O_2} = \mathrm{MET}\times 3.5\,\tfrac{\text{mL}}{\text{kg}\cdot\text{min}}\times m`,
      syms: [["\\dot V_{O_2}", "oxygen uptake", "mL/min", "245–2280"], ["\\mathrm{MET}", "metabolic equivalent of the activity", "–", "1.0, 3.8, 8.5, 9.3"], ["3.5", "O₂ use of 1 MET per kg", "mL/(kg·min)", "3.5"], ["m", "body mass", "kg", "70"]], assumed: "Body mass 70 kg is the twin's reference person, not a measured individual.",
      go: "activity", refs: ["compendium"], live: () => `${A().met} × 3.5 × 70 = ${f(activityVO2(b.cfg.act), 0)} mL/min` },
    { n: 2, group: "Activity and whole-body balances", name: "Metabolic heat", code: "heatW",
      tex: String.raw`M = \dot V_{O_2}\,\varepsilon_{O_2},\qquad \varepsilon_{O_2}= 20.92\ \text{kJ/L}\ (\approx 5\ \text{kcal/L})`,
      syms: [["M", "metabolic heat rate (no external work)", "W", "85–794"], ["\\dot V_{O_2}", "oxygen uptake, (1)", "L/min", "0.25–2.28"], ["\\varepsilon_{O_2}", "energy released per litre of O₂", "kJ/L", "20.92"]],
      go: "activity", refs: ["franklin2026"], live: () => `${f(N().VO2 / 1000, 3)} L/min × 20.92 kJ/L ÷ 60 = ${f(N().M, 0)} W` },
    { n: 3, group: "Activity and whole-body balances", name: "Body water balance (deficit D)", code: "deriv[8]",
      tex: String.raw`\frac{dD}{dt} = \dot m_{\text{sweat}} + \dot m_{\text{breath}} + \dot m_{\text{diff}} + \dot U - k_d W_g - \dot m_{\text{met}}`,
      syms: [["D", "water deficit (positive = short)", "L", "−1 to 3"], ["t", "time", "min", "–"], ["\\dot m_{\\text{sweat}}", "regulatory sweat made, from (9)", "L/min", "0–0.015"], ["\\dot m_{\\text{breath}}", "water lost in breath, E_res of (10) divided by the latent heat", "L/min", "small"], ["\\dot m_{\\text{diff}}", "water diffusing through the skin, from (8)", "L/min", "small"], ["\\dot U", "urine flow, (26)", "L/min", "≈0.001"], ["k_d", "gut absorption rate, (4)", "1/min", "0.05"], ["W_g", "drunk water still in the gut", "L", "0–0.5"], ["\\dot m_{\\text{met}}", "water made by burning food", "L/day", "0.23"]],
      go: "readouts", refs: ["os-fluid", "gagge1986"], live: () => `D = ${f(b.y[8], 3)} L; losses now ${f(N().waterOut * 60000, 0)} mL/h (sweat ${f(N().sweatLmin * 60000, 0)}, urine ${f(k().urine * 60000, 0)})` },
    { n: 4, group: "Activity and whole-body balances", name: "Water leaving the gut", code: "deriv[7]",
      tex: String.raw`\frac{dW_g}{dt} = -k_d\,W_g`,
      syms: [["W_g", "drunk water still in the gut", "L", "0–0.5"], ["t", "time", "min", "–"], ["k_d", "absorption rate constant", "1/min", "0.05"]], assumed: "k_d = 0.05 /min, chosen so drunk water is mostly absorbed within about an hour; not from a cited measurement.",
      go: "food", refs: [], live: () => `W_g = ${f(b.y[7], 3)} L` },
    // ---------------- thermoregulation ----------------
    { n: 5, group: "Thermoregulation: Gagge two-node model", name: "Core energy balance", code: "gaggeStep",
      tex: String.raw`0.97\,(1-\alpha)\,m\,\frac{dT_{cr}}{dt}\cdot\frac{60}{A_D} = M' - (5.28 + 1.163\,\dot m_{bl})(T_{cr}-T_{sk}) - E_{res} - C_{res}`,
      syms: [["0.97", "specific heat of body tissue", "W·h/(kg·K)", "0.97"], ["\\alpha", "skin mass fraction, 0.0418 + 0.745/(ṁ_bl + 0.585)", "–", "0.04–0.1"], ["m", "body mass", "kg", "70"], ["T_{cr}", "core temperature", "°C", "36–41"], ["t", "time", "min", "1-min steps"], ["60", "minutes per hour (rates are per minute)", "min/h", "60"], ["A_D", "skin area", "m²", "1.8258"], ["M'", "metabolic rate per area, including shivering", "W/m²", "47–440"], ["5.28", "tissue conductance, core to skin", "W/(m²·K)", "5.28"], ["1.163", "heat carried per litre of blood per kelvin", "W·h/(L·K)", "1.163"], ["\\dot m_{bl}", "skin blood flow, (9)", "L/(h·m²)", "0.5–90"], ["T_{sk}", "mean skin temperature", "°C", "26–38"], ["E_{res}", "latent heat lost in breath, (10)", "W/m²", "–"], ["C_{res}", "sensible heat lost in breath, (10)", "W/m²", "–"]],
      go: "heat", refs: ["gagge1986", "ptc2020"], live: () => `T_cr = ${f(th().t_core, 2)} °C, T_sk = ${f(th().t_skin, 2)} °C, core→skin ${f((th().t_core - th().t_skin) * (5.28 + 1.163 * th().m_bl) * P.bsa, 0)} W` },
    { n: 6, group: "Thermoregulation: Gagge two-node model", name: "Skin energy balance", code: "gaggeStep",
      tex: String.raw`0.97\,\alpha\,m\,\frac{dT_{sk}}{dt}\cdot\frac{60}{A_D} = (5.28 + 1.163\,\dot m_{bl})(T_{cr}-T_{sk}) - (C+R) - E_{sk}`,
      syms: [["0.97", "specific heat of body tissue", "W·h/(kg·K)", "0.97"], ["\\alpha", "skin mass fraction, as in (5)", "–", "0.04–0.1"], ["m", "body mass", "kg", "70"], ["T_{sk}", "mean skin temperature", "°C", "26–38"], ["t", "time", "min", "1-min steps"], ["A_D", "skin area", "m²", "1.8258"], ["\\dot m_{bl}", "skin blood flow, (9)", "L/(h·m²)", "0.5–90"], ["T_{cr}", "core temperature", "°C", "36–41"], ["C+R", "dry heat loss, (7)", "W/m²", "–"], ["E_{sk}", "evaporative heat loss from skin, (8)", "W/m²", "–"]],
      go: "heat", refs: ["gagge1986", "ptc2020"], live: () => `dry loss ${f(th().q_sensible * P.bsa, 0)} W, evaporation ${f(th().e_skin * P.bsa, 0)} W` },
    { n: 7, group: "Thermoregulation: Gagge two-node model", name: "Dry heat loss (convection + radiation)", code: "gaggeStep",
      tex: String.raw`C+R = \frac{T_{sk}-T_{o}}{R_a + 0.155\,I_{cl}},\quad h_c=\max\!\left(3p^{0.53},\,8.6(vp)^{0.53},\,5.66(\mathrm{met}-0.85)^{0.39}\right),\quad h_r = 4(0.95)\sigma\,\bar T^3(0.73)`,
      syms: [["C+R", "dry heat loss by convection and radiation", "W/m²", "–"], ["T_{sk}", "mean skin temperature", "°C", "–"], ["T_o", "operative temperature, (h_r T_r + h_c T_a)/(h_r + h_c)", "°C", "air temperature here"], ["R_a", "resistance of the air layer, 1/(f_cl (h_c + h_r))", "m²·K/W", "–"], ["0.155", "clothing resistance per clo", "m²·K/W", "0.155"], ["I_{cl}", "clothing insulation", "clo", "0.3"], ["h_c", "convective heat transfer coefficient", "W/(m²·K)", "3–25"], ["p", "air pressure", "atm", "0.5–1"], ["v", "air speed over the body (walking or running speed)", "m/s", "0.1–2.72"], ["\\mathrm{met}", "metabolic rate in met units (58.2 W/m²)", "met", "0.8–7.5"], ["h_r", "radiative heat transfer coefficient", "W/(m²·K)", "≈4.7"], ["\\sigma", "Stefan–Boltzmann constant", "W/(m²·K⁴)", "5.67 × 10⁻⁸"], ["\\bar T", "mean of clothing surface and radiant temperature", "K", "≈300"], ["0.95", "clothing emissivity", "–", "0.95"], ["0.73", "share of skin area that radiates (standing)", "–", "0.73"]], assumed: "Clothing insulation 0.3 clo, and air speed equal to the walking or running speed.",
      go: "activity", refs: ["gagge1986", "ptc2020"], live: () => `air ${b.cfg.tdb} °C, ${A().v} m/s → dry loss ${f(th().q_sensible * P.bsa, 0)} W` },
    { n: 8, group: "Thermoregulation: Gagge two-node model", name: "Evaporation and skin wettedness", code: "gaggeStep",
      tex: String.raw`E_{max}=\frac{p_{s}(T_{sk})-\phi\,p_{s}(T_a)}{1/(LR\,f_{cl}h_c)+0.155I_{cl}/(LR\,i_{cl})},\quad w=0.06+0.94\frac{E_{rsw}}{E_{max}}\le w_{max},\quad E_{sk}=wE_{max}`,
      syms: [["E_{max}", "maximum evaporation the air can take", "W/m²", "–"], ["p_s(T)", "water vapor pressure at T, exp(18.6686 − 4030.183/(T + 235))", "mmHg", "–"], ["T_{sk}", "mean skin temperature", "°C", "–"], ["\\phi", "relative humidity", "–", "0.1–0.95"], ["T_a", "air temperature", "°C", "−5 to 40"], ["LR", "Lewis ratio, 2.2/p", "K/mmHg", "2.2 at 1 atm"], ["f_{cl}", "clothing area factor, 1 + 0.15 I_cl", "–", "1.045"], ["h_c", "convective coefficient, (7)", "W/(m²·K)", "–"], ["I_{cl}", "clothing insulation", "clo", "0.3"], ["i_{cl}", "clothing vapor permeation efficiency", "–", "0.45"], ["w", "skin wettedness", "–", "0.06–w_max"], ["E_{rsw}", "heat removed by evaporating regulatory sweat, (9)", "W/m²", "–"], ["w_{max}", "largest wettedness, 0.59 v^−0.08 (clothed)", "–", "0.54–0.71"], ["E_{sk}", "evaporative heat loss from skin", "W/m²", "–"]],
      go: "heat", refs: ["gagge1986", "ptc2020"], live: () => `E_max = ${f(th().e_max * P.bsa, 0)} W, w = ${f(th().w, 2)} (limit ${f(th().w_max, 2)})` },
    { n: 9, group: "Thermoregulation: Gagge two-node model", name: "Temperature control: skin blood flow and sweating (controller)", code: "gaggeStep",
      tex: String.raw`\dot m_{bl}=\frac{6.3+120\,(T_{cr}-36.8)^+}{1+0.5\,(33.7-T_{sk})^+},\qquad \dot m_{rsw}=170\,(T_b-36.49)^+\,e^{(T_{sk}-33.7)^+/10.7},\qquad E_{rsw}=0.68\,\dot m_{rsw}`,
      syms: [["\\dot m_{bl}", "skin blood flow", "L/(h·m²)", "0.5–90"], ["6.3", "resting skin blood flow", "L/(h·m²)", "6.3"], ["120", "vasodilation gain", "L/(h·m²·K)", "120"], ["T_{cr}", "core temperature", "°C", "–"], ["36.8", "core set point", "°C", "36.8"], ["0.5", "vasoconstriction gain", "1/K", "0.5"], ["33.7", "skin set point", "°C", "33.7"], ["T_{sk}", "mean skin temperature", "°C", "–"], ["\\dot m_{rsw}", "regulatory sweat rate", "g/(h·m²)", "0–500"], ["170", "sweating gain", "g/(h·m²·K)", "170"], ["T_b", "mean body temperature, αT_sk + (1−α)T_cr", "°C", "–"], ["36.49", "mean body set point", "°C", "36.49"], ["10.7", "skin-temperature scale for sweating", "K", "10.7"], ["E_{rsw}", "heat removed by evaporating that sweat", "W/m²", "–"], ["0.68", "latent heat of sweat", "W·h/g", "0.68 (≈2450 J/g; ref. gives 2426)"], ["(x)^+", "max(x, 0): the controller acts only on one side", "–", "–"]],
      go: "heat", refs: ["gagge1986", "ptc2020", "baker2019"], live: () => `ṁ_bl = ${f(th().m_bl, 1)} L/(h·m²), sweat ${f(th().m_rsw_reg * P.bsa, 0)} g/h` },
    { n: 10, group: "Thermoregulation: Gagge two-node model", name: "Heat and water lost in breath", code: "gaggeStep",
      tex: String.raw`E_{res}=0.0023\,M\,(44-\phi\,p_s(T_a)),\qquad C_{res}=0.0014\,M\,(34-T_a)`,
      syms: [["E_{res}", "latent (water vapor) heat lost in breath", "W/m²", "–"], ["0.0023", "latent breathing coefficient", "1/mmHg", "0.0023"], ["M", "metabolic rate per area", "W/m²", "–"], ["44", "vapor pressure of exhaled air", "mmHg", "44"], ["\\phi", "relative humidity", "–", "–"], ["p_s(T_a)", "vapor pressure at air temperature", "mmHg", "–"], ["C_{res}", "sensible heat lost in breath", "W/m²", "–"], ["0.0014", "sensible breathing coefficient", "1/K", "0.0014"], ["34", "temperature of exhaled air", "°C", "34"], ["T_a", "air temperature", "°C", "–"]],
      go: "heat", refs: ["gagge1986", "ptc2020"], live: () => `E_res = ${f(th().q_res * P.bsa, 1)} W, C_res = ${f(th().c_res * P.bsa, 1)} W` },
    // ---------------- circulation ----------------
    { n: 11, group: "Heart and blood flow", name: "Effort and organ-bed flows", code: "circulation",
      tex: String.raw`e=\frac{\dot V_{O_2}-\dot V_{O_2,rest}}{\dot V_{O_2,max}-\dot V_{O_2,rest}},\qquad Q_i = Q_{i,rest} + (Q_{i,max}-Q_{i,rest})\,e\quad(i=\text{heart, kidneys, gut, other})`,
      syms: [["e", "fraction of the O₂ reserve in use", "–", "0–1"], ["\\dot V_{O_2}", "oxygen uptake, (1)", "mL/min", "–"], ["\\dot V_{O_2,rest}", "oxygen uptake sitting quietly", "mL/min", "245"], ["\\dot V_{O_2,max}", "maximal oxygen uptake, 45 mL/kg/min × 70 kg", "mL/min", "3150"], ["Q_i", "flow to organ bed i", "L/min", "–"], ["Q_{i,rest}", "flow at rest: heart 0.25, kidneys 1.1, gut 1.4, other 0.6", "L/min", "Table 20.3"], ["Q_{i,max}", "flow at maximal exercise: 0.75, 0.6, 0.6, 0.4", "L/min", "Table 20.3"]], assumed: "Straight-line change of each flow between the cited rest and maximal values; V̇O₂,max = 45 mL/kg/min.",
      go: "heart", refs: ["os-cv"], live: () => `e = ${f(c().effort, 2)}; kidneys ${f(c().Q.kidneys, 2)}, gut ${f(c().Q.gut, 2)}, heart ${f(c().Q.heart, 2)} L/min` },
    { n: 12, group: "Heart and blood flow", name: "Muscle flow by the Fick principle", code: "circulation",
      tex: String.raw`Q_{m}=Q_{m,rest}+\frac{\dot V_{O_2}-\dot V_{O_2,rest}}{E_m\,C_{aO_2}}`,
      syms: [["Q_m", "blood flow to skeletal muscle", "L/min", "1.2–15"], ["Q_{m,rest}", "muscle flow at rest", "L/min", "1.2"], ["\\dot V_{O_2}", "oxygen uptake, (1)", "mL/min", "–"], ["\\dot V_{O_2,rest}", "oxygen uptake at rest", "mL/min", "245"], ["E_m", "share of arterial O₂ working muscle extracts", "–", "0.85"], ["C_{aO_2}", "arterial O₂ content, (20), × 10 to give mL per L", "mL O₂/L", "≈195"]], assumed: "Muscle O₂ extraction E_m = 0.85.",
      go: "heart", refs: [], live: () => `Q_m = ${f(c().Q.muscle, 2)} L/min` },
    { n: 13, group: "Heart and blood flow", name: "The heart supplies the total", code: "circulation",
      tex: String.raw`CO=\sum_i Q_i = HR\times SV,\qquad SV=\big[SV_0+(SV_{max}-SV_0)\min(1,e/0.4)\big]\max\!\left(0.8,\,1-\tfrac{D}{0.6\,m}\right)`,
      syms: [["CO", "cardiac output", "L/min", "5.4–21"], ["Q_i", "flow to each organ bed, (11)–(12) and skin from (9)", "L/min", "–"], ["HR", "heart rate (warning above 208 − 0.7 × age)", "beats/min", "–"], ["SV", "stroke volume", "mL", "70–110"], ["SV_0", "stroke volume at rest", "mL", "70"], ["SV_{max}", "stroke volume in exercise", "mL", "110"], ["e", "fraction of the O₂ reserve in use, (11)", "–", "0–1"], ["0.4", "effort at which stroke volume reaches its maximum", "–", "0.4"], ["D", "water deficit, (3)", "L", "–"], ["0.6", "body water as a fraction of mass", "–", "0.6"], ["m", "body mass", "kg", "70"]], assumed: "Stroke volume 70 → 110 mL, reached at 40 % of the O₂ reserve and falling with water loss.",
      go: "heart", refs: ["os-cv", "tanaka2001"], live: () => `${f(c().CO, 2)} L/min = ${f(c().HR, 0)} /min × ${f(c().SV, 0)} mL` },
    { n: 14, group: "Heart and blood flow", name: "Hagen–Poiseuille resistance of each bed", code: "circulation, poiseuille",
      tex: String.raw`R_i=\frac{MAP}{Q_i},\qquad \Delta P=\frac{8\mu L Q}{\pi r^4}\ \Rightarrow\ \frac{r_i}{r_{i,rest}}=\left(\frac{R_{i,rest}}{R_i}\right)^{1/4}`,
      syms: [["R_i", "flow resistance of organ bed i", "mmHg·min/L", "–"], ["MAP", "mean arterial pressure, 93 + 10e", "mmHg", "93–103"], ["Q_i", "flow to organ bed i", "L/min", "–"], ["\\Delta P", "pressure drop along a vessel", "Pa", "–"], ["\\mu", "blood viscosity, (15)", "Pa·s", "–"], ["L", "vessel length", "m", "–"], ["Q", "volumetric flow", "m³/s", "–"], ["r", "vessel radius", "m", "–"], ["r_{i,rest}", "radius at rest", "m", "–"], ["R_{i,rest}", "resistance at rest, 93 mmHg / Q_i,rest", "mmHg·min/L", "–"]], assumed: "Mean pressure rising 10 mmHg at full effort.",
      go: "heart", refs: ["os-cv"], live: () => `muscle: R = ${f(c().R.muscle, 1)} mmHg·min/L, r/r_rest = ${f(c().rad.muscle, 2)}` },
    { n: 15, group: "Heart and blood flow", name: "Shear-thinning blood (Carreau)", code: "bloodVisc",
      tex: String.raw`\mu(\dot\gamma)=\mu_\infty+(\mu_0-\mu_\infty)\left[1+(\lambda\dot\gamma)^2\right]^{(n-1)/2}`,
      syms: [["\\mu(\\dot\\gamma)", "blood viscosity at shear rate γ̇", "Pa·s", "0.0035–0.056"], ["\\dot\\gamma", "shear rate", "1/s", "1–500"], ["\\mu_\\infty", "viscosity at very high shear", "Pa·s", "0.00345"], ["\\mu_0", "viscosity at zero shear", "Pa·s", "0.056"], ["\\lambda", "time constant", "s", "3.313"], ["n", "power-law index", "–", "0.3568"]],
      go: "heart", refs: ["zhou2018", "cho1991"], live: () => `μ(1 s⁻¹) = ${f(bloodVisc(1) * 1000, 1)} mPa·s, μ(500 s⁻¹) = ${f(bloodVisc(500) * 1000, 2)} mPa·s` },
    // ---------------- lungs ----------------
    { n: 16, group: "Lungs and gas exchange", name: "Air pressure with altitude (model atmosphere)", code: "baroP",
      tex: String.raw`P_B=\exp\!\left(6.63268-0.1112\,h-0.00149\,h^2\right)`,
      syms: [["P_B", "barometric pressure", "mmHg", "760–380"], ["h", "altitude", "km", "0–5.5"]],
      go: "activity", refs: ["west1996"], live: () => `h = ${f(b.cfg.alt / 1000, 1)} km → P_B = ${f(l().Pb, 1)} mmHg` },
    { n: 17, group: "Lungs and gas exchange", name: "Alveolar CO₂ falls with air pressure", code: "paco2",
      tex: String.raw`P_{A}CO_2=\min\!\left(40,\ 7.5+32.5\,\frac{P_B-253}{760-253}\right)`,
      syms: [["P_ACO_2", "alveolar CO₂ partial pressure (acclimatized)", "mmHg", "40 → 7.5"], ["40", "sea-level value", "mmHg", "40"], ["7.5", "value on the Everest summit", "mmHg", "7.5"], ["32.5", "drop between sea level and the summit", "mmHg", "32.5"], ["P_B", "barometric pressure, (16)", "mmHg", "–"], ["253", "summit barometric pressure", "mmHg", "253"], ["760", "sea-level barometric pressure", "mmHg", "760"]],
      go: "lungs", refs: ["west1983"], live: () => `P_ACO₂ = ${f(l().PaCO2, 1)} mmHg` },
    { n: 18, group: "Lungs and gas exchange", name: "Alveolar gas equation", code: "lungs",
      tex: String.raw`P_{A}O_2=F_{I}O_2\,(P_B-47)-\frac{P_{A}CO_2}{R}`,
      syms: [["P_AO_2", "alveolar O₂ partial pressure", "mmHg", "–"], ["F_IO_2", "O₂ fraction in air", "–", "0.2093"], ["P_B", "barometric pressure, (16)", "mmHg", "–"], ["47", "water vapor pressure at 37 °C", "mmHg", "47"], ["P_ACO_2", "alveolar CO₂, (17)", "mmHg", "–"], ["R", "respiratory exchange ratio", "–", "0.8"]], assumed: "R = 0.8 for a mixed diet.",
      go: "lungs", refs: ["ortiz2019", "os-resp"], live: () => `0.2093 × (${f(l().Pb, 0)} − 47) − ${f(l().PaCO2, 1)}/0.8 = ${f(l().PAO2, 1)} mmHg` },
    { n: 19, group: "Lungs and gas exchange", name: "Alveolar ventilation", code: "lungs",
      tex: String.raw`\dot V_A = 0.863\,\frac{\dot V_{CO_2}}{P_{A}CO_2},\qquad \dot V_{CO_2}=R\,\dot V_{O_2}`,
      syms: [["\\dot V_A", "fresh air reaching the air sacs (BTPS)", "L/min", "–"], ["0.863", "unit-conversion constant (STPD to BTPS)", "mmHg·L/mL", "0.863"], ["\\dot V_{CO_2}", "CO₂ production", "mL/min", "–"], ["P_ACO_2", "alveolar CO₂, (17)", "mmHg", "–"], ["R", "respiratory exchange ratio", "–", "0.8"], ["\\dot V_{O_2}", "oxygen uptake, (1)", "mL/min", "–"]], assumed: "The 0.863 conversion constant (STPD to BTPS) is a standard value not taken from a cited source here.",
      go: "lungs", refs: [], live: () => `V̇_A = ${f(l().VA, 1)} L/min` },
    { n: 20, group: "Lungs and gas exchange", name: "Hemoglobin O₂ curve (Hill) and O₂ content", code: "sat, O2content",
      tex: String.raw`S=\frac{(P/P_{50})^{n}}{1+(P/P_{50})^{n}},\qquad C=1.34\,[Hb]\,S+0.003\,P`,
      syms: [["S", "hemoglobin O₂ saturation", "–", "0–1"], ["P", "blood O₂ partial pressure", "mmHg", "–"], ["P_{50}", "pressure at half saturation", "mmHg", "26.8"], ["n", "Hill coefficient", "–", "2.7"], ["C", "O₂ content of blood", "mL O₂/dL", "–"], ["1.34", "O₂ bound per gram of hemoglobin", "mL O₂/g", "1.34"], ["[Hb]", "hemoglobin concentration", "g/dL", "15"], ["0.003", "dissolved O₂ per mmHg", "mL O₂/(dL·mmHg)", "0.003"]],
      go: "molecules", refs: ["dash2010", "loyola-abg"], live: () => `P_a = ${f(l().Pa, 1)} mmHg → S = ${f(l().Sa * 100, 1)} %, C_a = ${f(l().Ca, 2)} mL/dL` },
    { n: 21, group: "Lungs and gas exchange", name: "O₂ uptake along a lung capillary (Fick's law, Bohr integration)", code: "lungCapillary",
      tex: String.raw`V_c\,\frac{dC}{dt}=D_L\,(P_{A}O_2-P),\ \ \frac{dP}{dt}=\frac{(D_L/V_c)(P_AO_2-P)}{dC/dP},\ \ t\in[0,\tau],\ \ \tau=\frac{V_c}{CO},\ \ D_L=0.4\,V_c`,
      syms: [["V_c", "lung capillary blood volume, 75 + 125 (CO − 5)/20, at most 200", "mL", "75–200"], ["C", "O₂ content, (20)", "mL O₂/mL", "–"], ["t", "time since blood entered the capillary", "s", "0–τ"], ["D_L", "O₂ diffusing capacity", "mL/(min·mmHg)", "30 at rest"], ["P_AO_2", "alveolar O₂, (18)", "mmHg", "–"], ["P", "capillary blood O₂ pressure", "mmHg", "–"], ["dC/dP", "slope of the content curve, from (20)", "mL/(mL·mmHg)", "–"], ["\\tau", "transit time", "s", "0.47–0.86"], ["CO", "cardiac output, (13)", "mL/s", "–"], ["0.4", "D_L per mL of capillary blood", "mL/(min·mmHg·mL)", "0.4"]], assumed: "Capillary volume rising linearly with cardiac output from 75 to 200 mL, with D_L/V_c held at 0.4.",
      go: "lungs", refs: ["hsia2016", "loyola"], live: () => `τ = ${f(l().tT, 2)} s; ${l().tEq != null ? `within 1 mmHg after ${f(l().tEq, 2)} s` : `leaves ${f(l().PAO2 - l().Pa, 1)} mmHg short`}` },
    { n: 22, group: "Lungs and gas exchange", name: "Mixed venous blood (Fick)", code: "lungs",
      tex: String.raw`C_v=C_a-\frac{\dot V_{O_2}}{CO}`,
      syms: [["C_v", "mixed venous O₂ content", "mL/dL", "–"], ["C_a", "arterial O₂ content, (20)–(21)", "mL/dL", "–"], ["\\dot V_{O_2}", "oxygen uptake, (1)", "mL/min", "–"], ["CO", "cardiac output, (13)", "dL/min", "–"]],
      go: "lungs", refs: ["loyola-abg"], live: () => `C_v = ${f(l().Cv, 2)} mL/dL (P_v = ${f(l().Pv, 1)} mmHg)` },
    // ---------------- kidneys ----------------
    { n: 23, group: "Kidneys and body water", name: "Glomerular filtration", code: "kidney",
      tex: String.raw`GFR = FF\cdot RBF\,(1-Hct)`,
      syms: [["GFR", "glomerular filtration rate", "mL/min", "80–121"], ["FF", "filtration fraction", "–", "0.20"], ["RBF", "kidney blood flow, (11)", "L/min", "0.6–1.1"], ["Hct", "hematocrit", "–", "0.45"]], assumed: "Filtration fraction 0.20 and hematocrit 0.45.",
      go: "kidney", refs: ["os-kid"], live: () => `0.2 × ${f(c().Q.kidneys, 2)} × 0.55 = ${f(k().GFR * 1000, 0)} mL/min` },
    { n: 24, group: "Kidneys and body water", name: "Plasma osmolality (solutes conserved)", code: "kidney",
      tex: String.raw`P_{osm}=P_{osm,0}\,\frac{TBW_0}{TBW_0-D},\qquad TBW_0=0.6\,m`,
      syms: [["P_{osm}", "plasma osmolality", "mOsm/kg", "–"], ["P_{osm,0}", "normal plasma osmolality", "mOsm/kg", "287"], ["TBW_0", "total body water", "L", "42"], ["D", "water deficit, (3)", "L", "–"], ["0.6", "body water fraction of mass", "–", "0.6"], ["m", "body mass", "kg", "70"]],
      go: "kidney", refs: ["os-fluid", "medline-uosm"], live: () => `P_osm = ${f(k().Posm, 1)} mOsm/kg` },
    { n: 25, group: "Kidneys and body water", name: "Urine concentration (ADH response)", code: "kidney",
      tex: String.raw`U_{osm}=50+1150\,\mathrm{clip}\!\left(\frac{P_{osm}-280}{295-280},0,1\right)`,
      syms: [["U_{osm}", "urine osmolality", "mOsm/kg", "50–1200"], ["50", "most dilute urine", "mOsm/kg", "50"], ["1150", "range up to the most concentrated (1200)", "mOsm/kg", "1150"], ["P_{osm}", "plasma osmolality, (24)", "mOsm/kg", "–"], ["280,\\ 295", "plasma osmolality at the ends of the map", "mOsm/kg", "280, 295"], ["\\mathrm{clip}", "keep the fraction between 0 and 1", "–", "–"]], assumed: "Straight-line map between plasma 280 and 295 mOsm/kg (the 50–1200 urine range is cited).",
      go: "kidney", refs: ["medline-uosm", "os-kid"], live: () => `U_osm = ${f(k().Uosm, 0)} mOsm/kg` },
    { n: 26, group: "Kidneys and body water", name: "Urine flow from the solute load", code: "kidney",
      tex: String.raw`\dot U=\frac{L_{osm}}{U_{osm}},\qquad \text{reabsorbed}=1-\frac{\dot U}{GFR}`,
      syms: [["\\dot U", "urine flow", "L/min", "–"], ["L_{osm}", "solutes excreted per day", "mOsm/day", "880"], ["U_{osm}", "urine osmolality, (25)", "mOsm/kg", "–"], ["GFR", "filtration rate, (23)", "L/min", "–"]], assumed: "Solute load 880 mOsm/day, calibrated so urine is about 1.5 L/day when hydrated.",
      go: "kidney", refs: ["os-fluid"], live: () => `U̇ = ${f(k().urine * 60000, 1)} mL/h; ${f(k().reabsorbed * 100, 2)} % of filtered water reabsorbed` },
    // ---------------- liver and caffeine ----------------
    { n: 27, group: "Liver and caffeine (pharmacokinetics)", name: "One-compartment caffeine model", code: "deriv[5], deriv[6]",
      tex: String.raw`\frac{dA_g}{dt}=-k_aA_g,\qquad V\frac{dC}{dt}=F\,k_aA_g-CL_H(C)\,C,\qquad V=0.6\,m`,
      syms: [["A_g", "caffeine in the gut", "mg", "–"], ["t", "time", "min", "–"], ["k_a", "absorption rate constant", "1/min", "0.075"], ["V", "volume of distribution, 0.6 L/kg × m", "L", "42"], ["C", "blood caffeine concentration", "mg/L", "–"], ["F", "bioavailability", "–", "1"], ["CL_H(C)", "liver clearance, (28)–(29)", "L/min", "≈0.12"], ["0.6", "volume of distribution per kg", "L/kg", "0.6"], ["m", "body mass", "kg", "70"]], assumed: "k_a = 0.075 /min, chosen so the peak falls at about 45 min (inside the cited 30–60 min).",
      go: "pk", refs: ["caf-rev"], live: () => `C = ${f(b.caffeineC, 2)} mg/L, gut ${f(b.y[5], 1)} mg` },
    { n: 28, group: "Liver and caffeine (pharmacokinetics)", name: "Well-stirred liver", code: "liverCL",
      tex: String.raw`CL_H=\frac{Q_H\,CL_{int}}{Q_H+CL_{int}},\qquad E=\frac{CL_{int}}{Q_H+CL_{int}}`,
      syms: [["CL_H", "liver clearance of caffeine", "L/min", "≈0.11–0.12"], ["Q_H", "liver blood flow (gut bed), (11)", "L/min", "0.6–1.4"], ["CL_{int}", "intrinsic clearance, (29)", "L/min", "≈0.13"], ["E", "share removed in one pass", "–", "≈0.08"]],
      go: "liver", refs: ["wellstirred", "tuloup"], live: () => { const q = liverCL(b.caffeineC, N().QH, N().QH0); return `Q_H = ${f(N().QH, 2)} L/min → CL_H = ${f(q.CL * 1000, 1)} mL/min, E = ${f(q.E * 100, 2)} %`; } },
    { n: 29, group: "Liver and caffeine (pharmacokinetics)", name: "Michaelis–Menten enzyme (CYP1A2)", code: "liverCL",
      tex: String.raw`CL_{int}(C)=\frac{V_{max}}{K_m+C},\qquad V_{max}=K_m\,CL_{int,0},\quad CL_{int,0}=\frac{CL_0Q_{H,0}}{Q_{H,0}-CL_0},\quad CL_0=\frac{\ln 2}{t_{1/2}}V`,
      syms: [["CL_{int}(C)", "intrinsic clearance at concentration C", "L/min", "–"], ["V_{max}", "maximum enzyme rate", "mg/min", "≈7.7"], ["K_m", "Michaelis constant, 300 µM × 194.19 g/mol", "mg/L", "58"], ["C", "blood caffeine concentration", "mg/L", "–"], ["CL_{int,0}", "intrinsic clearance at low dose", "L/min", "≈0.13"], ["CL_0", "clearance at low dose", "L/min", "≈0.12"], ["Q_{H,0}", "liver blood flow at rest", "L/min", "1.4"], ["t_{1/2}", "low-dose half-life", "h (converted to min)", "4"], ["V", "volume of distribution", "L", "42"]],
      go: "liver", refs: ["mm1913", "thomas2026", "caf-rev"], live: () => `rate = V_max C/(K_m + C) at ${f(b.caffeineC / (P.cafKm + b.caffeineC) * 100, 1)} % of V_max` },
    // ---------------- glucose ----------------
    { n: 30, group: "Glucose and insulin (control)", name: "Meal absorption: two tanks in series", code: "deriv[3], deriv[4]",
      tex: String.raw`\frac{dD_1}{dt}=-\frac{D_1}{t_{max}},\quad \frac{dD_2}{dt}=\frac{D_1-D_2}{t_{max}},\quad R_a=\frac{D_2}{t_{max}},\quad D_1(0^+)=D_1(0)+A_G\,m_{carb}`,
      syms: [["D_1,\\ D_2", "glucose in the first and second gut tank", "mg", "–"], ["t", "time", "min", "–"], ["t_{max}", "time to peak appearance", "min", "40"], ["R_a", "glucose appearance in blood", "mg/min", "0–552"], ["A_G", "carbohydrate bioavailability", "–", "0.8"], ["m_{carb}", "carbohydrate eaten", "mg", "75 000 per meal"]],
      go: "food", refs: ["hovorka2004", "wilinska2010"], live: () => `R_a = ${f(b.y[4] / P.tmaxG, 0)} mg/min` },
    { n: 31, group: "Glucose and insulin (control)", name: "Bergman minimal model with insulin secretion", code: "deriv[0..2]",
      tex: String.raw`\frac{dG}{dt}=-(p_1+X)G+p_1G_b+\frac{R_a}{V_G},\quad \frac{dX}{dt}=-p_2X+p_3(I-I_b),\quad \frac{dI}{dt}=-n(I-I_b)+\gamma\,(G-h)^+`,
      syms: [["G", "blood glucose", "mg/dL", "–"], ["t", "time", "min", "–"], ["p_1", "glucose effectiveness", "1/min", "0.0317"], ["X", "remote insulin action", "1/min", "–"], ["G_b", "basal glucose", "mg/dL", "80"], ["R_a", "glucose from the gut, (30)", "mg/min", "–"], ["V_G", "glucose distribution volume", "dL", "117"], ["p_2", "decay rate of insulin action", "1/min", "0.0123"], ["p_3", "gain from insulin to action", "(µU/mL)⁻¹·min⁻²", "4.92 × 10⁻⁶"], ["I", "plasma insulin", "µU/mL", "–"], ["I_b", "basal insulin", "µU/mL", "7"], ["n", "insulin clearance rate", "1/min", "0.2659"], ["\\gamma", "insulin secretion gain", "µU/mL/min per mg/dL", "0.15"], ["h", "glucose threshold for secretion", "mg/dL", "80"], ["(x)^+", "max(x, 0)", "–", "–"]], assumed: "Secretion gain γ = 0.15 and threshold h = 80 mg/dL, calibrated so 75 g of glucose gives a normal 2-hour value.",
      go: "glucose", refs: ["bergman1979", "saleem2024", "roy2007"], live: () => `G = ${f(b.glucose, 1)} mg/dL, I = ${f(b.y[2], 2)} µU/mL, X = ${b.y[1].toExponential(2)} /min` },
    // ---------- heat sources, organ reactors, thermal camera ----------
    { n: 32, group: "Heat sources, organ reactors and the thermal camera", name: "Heat made by each organ", code: "organHeat",
      tex: String.raw`H_i = M_{rest}\,\frac{K_i m_i}{\sum_j K_j m_j},\quad H_{heart}=H_{heart,rest}\frac{MAP\cdot CO}{MAP_0\cdot CO_0},\quad H_{muscle}=H_{muscle,rest}+M-M_{rest}-\Delta H_{heart}`,
      syms: [["H_i", "heat made by organ i", "W", "–"], ["M_{rest}", "resting heat, (2)", "W", "85"], ["K_i", "resting heat per kg of organ i", "kcal/(kg·day)", "240, 440, 200, 440, 13, 4.5, 12"], ["m_i", "organ mass (adults 21–30 y, 70.0 kg)", "kg", "1.33, 0.31, 1.35, 0.28, 25.0, 18.4, 22.8"], ["H_{heart}", "heart heat", "W", "7–30"], ["H_{heart,rest}", "heart heat at rest", "W", "7.1"], ["MAP", "mean arterial pressure, (14)", "mmHg", "–"], ["CO", "cardiac output, (13)", "L/min", "–"], ["MAP_0", "resting mean pressure", "mmHg", "93"], ["CO_0", "resting cardiac output", "L/min", "5.8"], ["H_{muscle}", "skeletal muscle heat", "W", "19–710"], ["H_{muscle,rest}", "muscle heat at rest", "W", "18.7"], ["M", "metabolic heat now, (2)", "W", "–"], ["\\Delta H_{heart}", "extra heart heat above rest", "W", "–"]], assumed: "Heart heat scaling with MAP·CO, and adipose plus residual heat split among the gut, skin and other beds by blood flow.",
      go: "heat", refs: ["wang2010"], live: () => { const H = organHeat(N()); return `muscle ${f(H.muscle, 0)} W, brain ${f(H.brain, 0)}, liver ${f(H.liver, 0)}, heart ${f(H.heart, 1)}, kidneys ${f(H.kidneys, 1)}; total ${f(H.total, 0)} W`; } },
    { n: 33, group: "Heat sources, organ reactors and the thermal camera", name: "Each organ bed as an O₂-consuming reactor", code: "bedGas",
      tex: String.raw`\dot V_{O_2,i}=\frac{H_i}{\varepsilon_{O_2}},\qquad C_{v,i}=C_a-\frac{\dot V_{O_2,i}}{Q_i},\qquad \dot V_{CO_2,i}=R\,\dot V_{O_2,i},\qquad \sum_i Q_iC_{v,i}=CO\,C_v`,
      syms: [["\\dot V_{O_2,i}", "O₂ used by organ bed i", "mL/min", "–"], ["H_i", "heat made in that bed, (32)", "W", "–"], ["\\varepsilon_{O_2}", "energy per litre of O₂", "kJ/L", "20.92"], ["C_{v,i}", "O₂ content of blood leaving bed i", "mL/dL", "–"], ["C_a", "arterial O₂ content", "mL/dL", "–"], ["Q_i", "flow to bed i", "L/min (×10 for dL)", "–"], ["\\dot V_{CO_2,i}", "CO₂ made by bed i", "mL/min", "–"], ["R", "respiratory exchange ratio", "–", "0.8"], ["CO", "cardiac output", "L/min", "–"], ["C_v", "mixed venous O₂ content, (22)", "mL/dL", "–"]],
      go: "heart", refs: ["wang2010"], live: () => { const G = bedGas(N()); return `Σ V̇O₂,i = ${f(G.VO2, 0)} mL/min; mixed venous ${f(G.Cmix, 3)} vs (22) ${f(G.CvLung, 3)} mL/dL; muscle extracts ${f(G.beds.muscle.ext * 100, 0)} %`; } },
    { n: 34, group: "Heat sources, organ reactors and the thermal camera", name: "Local skin temperature (thermal camera)", code: "skinLocalT",
      tex: String.raw`(5.28+1.163\,\dot m_{bl})(T_{cr}-T)=h_t(r)(T-T_o)+E(r),\quad h_c(r)=h_c\left(\frac{r}{r_{ref}}\right)^{-0.4},\quad E(r)=E_{sk}\frac{h_c(r)}{h_c}`,
      syms: [["5.28", "tissue conductance, core to skin", "W/(m²·K)", "5.28"], ["1.163", "heat carried per litre of blood per kelvin", "W·h/(L·K)", "1.163"], ["\\dot m_{bl}", "skin blood flow, (9)", "L/(h·m²)", "–"], ["T_{cr}", "core temperature", "°C", "–"], ["T", "local skin temperature, shifted so its average equals T_sk of (6)", "°C", "–"], ["h_t(r)", "local heat transfer coefficient, h_c(r) + h_r", "W/(m²·K)", "–"], ["T_o", "operative temperature, (7)", "°C", "–"], ["E(r)", "local evaporative loss", "W/m²", "–"], ["h_c(r)", "local convective coefficient", "W/(m²·K)", "–"], ["h_c", "body-average convective coefficient, (7)", "W/(m²·K)", "–"], ["r", "local body radius (finger 0.6 cm … torso about 15 cm)", "cm", "0.6–17"], ["r_{ref}", "radius giving the body-average h_c", "cm", "computed"], ["-0.4", "exponent for forced flow across a cylinder (h ∝ D^−0.4)", "–", "−0.4"], ["E_{sk}", "body-average evaporative loss, (8)", "W/m²", "–"]], assumed: "Exponent −0.4 from forced flow across cylinders; the map is shifted so its average equals T_sk.",
      go: "heat", refs: [], live: () => `mean skin ${f(N().th.t_skin, 1)} °C; h_c ${f(N().th.h_cc, 1)} W/(m²K)` },
    { n: 35, group: "Heat sources, organ reactors and the thermal camera", name: "Whole-body heat storage", code: "heatBalance",
      tex: String.raw`S=M-(C+R)-E_{sk}-(E_{res}+C_{res}),\qquad \frac{d\bar T}{dt}=\frac{S}{m\,c_p},\quad c_p=0.97\ \text{W\,h/(kg\,K)}`,
      syms: [["S", "heat stored in the body", "W", "–"], ["M", "metabolic heat, (2)", "W", "–"], ["C+R", "dry heat loss, (7) × A_D", "W", "–"], ["E_{sk}", "evaporative loss, (8) × A_D", "W", "–"], ["E_{res}", "latent loss in breath, (10) × A_D", "W", "–"], ["C_{res}", "sensible loss in breath, (10) × A_D", "W", "–"], ["\\bar T", "mean body temperature", "°C", "–"], ["t", "time", "h", "–"], ["m", "body mass", "kg", "70"], ["c_p", "body heat capacity", "W·h/(kg·K)", "0.97 (3.49 kJ/(kg·K))"]],
      go: "heat", refs: ["gagge1986", "ptc2020"], live: () => { const B = heatBalance(N()); return `S = ${f(B.M, 0)} − ${f(B.dry, 0)} − ${f(B.evap, 0)} − ${f(B.breath, 0)} = ${f(B.S, 0)} W → ${f(B.dTdt, 2)} °C/h (no cooling: ${f(B.noCool, 1)} °C/h)`; } },
  ];
}

// Parameters: [name, symbol, value, units, source ref id or null, note]
export const PARAMS = [
  ["Body mass; skin area", "m; A_D", "70; 1.8258", "kg; m²", "ptc2020", "the defaults of the Gagge model code"],
  ["Age (for the heart-rate warning)", "–", "17", "years", null, "assumed: a high-school visitor"],
  ["Activity METs (sitting, walking 2.8–3.4 mph, running 5 and 6 mph)", "MET", "1.0, 3.8, 8.5, 9.3", "–", "compendium", "codes 07021, 17190, 12030, 12050"],
  ["Air speed over the body", "v", "0.1, 1.39, 2.28, 2.72", "m/s", null, "assumed: the walking or running speed"],
  ["Energy per litre of O₂", "ε_O₂", "20.92", "kJ/L", "franklin2026", "about 5 kcal/L"],
  ["Clothing insulation", "I_cl", "0.3", "clo", null, "assumed: light running clothes"],
  ["Gagge set points; vasodilation, constriction, sweat gains", "–", "36.8, 33.7 °C; 120, 0.5, 170", "–", "ptc2020", "from the <code>two_nodes_gagge</code> source"],
  ["Respiratory exchange ratio", "R", "0.8", "–", null, "assumed: mixed diet"],
  ["Maximal O₂ uptake", "V̇O₂max", "45", "mL/(kg·min)", null, "assumed: a moderately fit young person"],
  ["Organ blood flows at rest: brain, heart, muscle, skin, kidneys, gut, other", "Q_i,rest", "0.75, 0.25, 1.2, 0.5, 1.1, 1.4, 0.6", "L/min", "os-cv", "Table 20.3"],
  ["Flows at maximal exercise: heart, kidneys, gut, other", "Q_i,max", "0.75, 0.6, 0.6, 0.4", "L/min", "os-cv", "Table 20.3"],
  ["Mean arterial pressure at rest (+10 mmHg at full effort)", "MAP", "93", "mmHg", null, "assumed: typical value"],
  ["Stroke volume at rest and in exercise", "SV₀, SV_max", "70, 110", "mL", null, "assumed; rest value within OpenStax's 55–100 mL"],
  ["Muscle O₂ extraction", "E_m", "0.85", "–", null, "assumed"],
  ["Hemoglobin; hematocrit", "[Hb]; Hct", "15; 0.45", "g/dL; –", "loyola-abg", "Hb from the worked example; Hct assumed"],
  ["O₂ binding: Hill n, P50", "n, P₅₀", "2.7, 26.8", "–, mmHg", "dash2010", ""],
  ["O₂ fraction; water vapor pressure", "F_IO₂; P_H₂O", "0.2093; 47", "–; mmHg", "os-resp", ""],
  ["Lung capillary volume at rest, maximum", "V_c", "75, 200", "mL", "loyola", "75 mL (Loyola); about 200 mL anatomical (Hsia)"],
  ["Diffusing capacity per capillary volume", "D_L/V_c", "0.4", "mL/(min·mmHg·mL)", "hsia2016", "D_LO₂ ≈ 30 at rest with 75 mL"],
  ["Filtration fraction", "FF", "0.20", "–", null, "assumed; gives GFR 121 mL/min vs about 125 (OpenStax)"],
  ["Total body water fraction", "TBW/m", "0.6", "–", "os-fluid", "50–60 % in adults"],
  ["Normal plasma osmolality", "P_osm,0", "287", "mOsm/kg", "medline-uosm", "within 275–295"],
  ["Urine osmolality range; plasma range of the map", "U_osm", "50–1200; 280–295", "mOsm/kg", "medline-uosm", "urine range cited; map endpoints assumed"],
  ["Daily solute load", "L_osm", "880", "mOsm/day", "os-fluid", "calibrated so urine ≈ 1.5 L/day"],
  ["Water made by burning food", "ṁ_met", "0.23", "L/day", "os-fluid", "about 230 mL/day"],
  ["Gut water absorption", "k_d", "0.05", "1/min", null, "assumed"],
  ["Caffeine volume; half-life", "V; t½", "0.6 L/kg; 4 h", "–", "caf-rev", "0.5–0.75 L/kg; about 4 h"],
  ["Caffeine absorption rate", "k_a", "0.075", "1/min", "caf-rev", "chosen so the peak falls at about 45 min, inside the cited 30–60 min"],
  ["CYP1A2 Michaelis constant", "K_m", "58", "mg/L", "thomas2026", "300 µM, purified enzyme"],
  ["Liver blood flow at rest", "Q_H,0", "1.4", "L/min", "os-cv", "gastrointestinal flow; cf. about 1.5 L/min in PK models"],
  ["Minimal model (healthy): p₁, p₂, p₃, n, G_b, I_b", "–", "0.0317, 0.0123, 4.92×10⁻⁶, 0.2659, 80, 7", "1/min …", "saleem2024", "Table 2"],
  ["Glucose distribution volume", "V_G", "117", "dL", "roy2007", ""],
  ["Insulin secretion gain; threshold", "γ; h", "0.15; 80", "µU/mL/min per mg/dL; mg/dL", null, "assumed: γ calibrated so 75 g gives a normal 2-h value (124 mg/dL, normal ≤ 140)"],
  ["Meal absorption: bioavailability, t_max", "A_G, t_max", "0.8, 40 min", "–", "hovorka2004", ""],
  ["Organ resting heat rates K_i", "K_i", "240, 440, 200, 440, 13, 4.5, 12", "kcal/(kg·day)", "wang2010", "brain, heart, liver, kidneys, muscle, adipose, residual (Elia)"],
  ["Organ masses (adults 21–30 y, mean 70.0 kg)", "m_i", "1.33, 0.31, 1.35, 0.28, 25.0, 18.4, 22.8", "kg", "wang2010", ""],
  ["Convection exponent with local radius", "–", "−0.4", "–", null, "assumed: forced flow across cylinders, h ∝ D^−0.4"],
  ["Adipose + residual heat split among gut, skin and other beds", "–", "by blood flow", "–", null, "assumed"],
  ["Energy in carbohydrate (for the balance only)", "–", "17", "kJ/g", null, "assumed: standard food-energy value"],
];

export const METHOD = [
  "One simulated minute per step. Each step: (a) the Gagge model advances one explicit Euler step of 1 min, as in its reference code, including the inner fixed-point loop for clothing temperature (tolerance 0.01 °C), with the previous minute's radiative coefficient as the starting guess; (b) circulation and lungs are solved together by fixed-point iteration on arterial O₂ content (tolerance 10⁻⁹ mL/dL, at most 30 passes); (c) the ten ODE states (glucose, insulin action, insulin, two gut glucose tanks, caffeine in gut and body, gut water, water deficit, bladder) advance by classical RK4 with four 0.25 min sub-steps, holding (b)'s flows constant over the minute.",
  "Lung capillary (21): RK4 with 400 steps over the transit time; the venous starting point comes from inverting (20) by bisection (80 halvings), and the arterial content is iterated to a fixed point (tolerance 10⁻¹⁰ mL/dL).",
  "Meals, caffeine and water are added to their gut tanks at the start of a minute. Playback runs 1, 5 or 20 simulated minutes per real second; results do not depend on the playback speed.",
];
export const ASSUMPTIONS = [
  "One healthy 70 kg, 17-year-old body; no differences by sex, size, fitness or health are modeled. This is an educational model, not medical advice.",
  "Temperature: a two-node (core and skin) body with one skin temperature; the Gagge model was built for comfort studies, so at hard effort in hot, humid air its core temperatures (above about 39.5 °C) are indicative only.",
  "Circulation is algebraic (no heartbeat dynamics, no blood volume shifts); flows change in a straight line with effort between OpenStax's rest and maximal values; muscle flow follows O₂ demand; MAP and stroke volume follow assumed curves. Heart rate above the age maximum is flagged, not limited.",
  "Lungs: one representative capillary, no shunt or ventilation–perfusion mismatch; alveolar CO₂ follows acclimatized climbers at all altitudes, so sudden ascents are not represented.",
  "Kidneys: no hormone dynamics; urine concentration follows plasma osmolality instantly through a straight-line map; sodium and other solutes are not tracked separately.",
  "Caffeine: one compartment, all elimination by the liver; the whole-body Michaelis constant is not known, so the purified-enzyme value is used.",
  "Glucose: Bergman minimal model with a proportional secretion term (without the time factor of the original IVGTT form); exercise does not change glucose use in this model.",
  "Sweat: all regulatory sweat is counted as water lost, whether it evaporates or drips; salt loss is ignored.",
];

// ---------- Part L typesetting rules applied to every equation and symbol ----------
// chemical formulas upright; word subscripts (two or more letters) upright; multi-letter variable names italic as one symbol;
// display equations use \dfrac and break into left-aligned lines at the separators between sub-equations.
const ACRO = ["CO", "HR", "SV", "MAP", "GFR", "RBF", "FF", "Hct", "CL", "TBW", "LR", "RQ"];
function splitTop(s, sepRe) {   // split at separators that are not inside braces
  const out = []; let depth = 0, last = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]; if (ch === "{") depth++; else if (ch === "}") depth--;
    else if (depth === 0) { const m = s.slice(i).match(sepRe); if (m && m.index === 0) { out.push(s.slice(last, i)); i += m[0].length - 1; last = i + 1; } }
  }
  out.push(s.slice(last)); return out;
}
function subsUpright(s) {   // _{...}: wrap word tokens (2+ letters) in \mathrm
  let out = "", i = 0;
  while (i < s.length) {
    if (s[i] === "_" && s[i + 1] === "{") {
      let depth = 0, j = i + 1; for (; j < s.length; j++) { if (s[j] === "{") depth++; else if (s[j] === "}") { depth--; if (!depth) break; } }
      const inner = s.slice(i + 2, j);
      const parts = inner.split(",").map(t => /^[A-Za-z]{2,}$/.test(t.trim()) && !ACRO.includes(t.trim()) ? `\\mathrm{${t.trim()}}` : subsUpright(t));
      out += "_{" + parts.join(",") + "}"; i = j + 1;
    } else { out += s[i]; i++; }
  }
  return out;
}
export function texNorm(tex, display = false) {
  // protect text-like groups so their contents are not rewritten
  const keep = [];
  let t = tex.replace(/\\(?:text|mathrm|mathit|operatorname)\{[^{}]*\}/g, m => { keep.push(m); return `\u0000${keep.length - 1}\u0000`; });
  t = t.replace(/_A(CO_2|O_2)/g, "_{A}$1").replace(/_I(O_2)/g, "_{I}$1");
  t = t.replace(/(?<![A-Za-z\\])(CO_2|O_2)/g, m => { keep.push(`\\mathrm{${m}}`); return `\u0000${keep.length - 1}\u0000`; });
  t = subsUpright(t);
  t = t.replace(new RegExp(`(?<![\\\\A-Za-z])(${ACRO.join("|")})(?![A-Za-z])`, "g"), "\\mathit{$1}");
  for (let k = 0; k < 3; k++) t = t.replace(/\u0000(\d+)\u0000/g, (_, n) => keep[+n]);
  if (display) {
    t = t.replace(/\\frac\{/g, "\\dfrac{");
    const lines = splitTop(t, /^,?\\qquad\s*|^,\\quad\s*|^,\\ \\ /).map(x => x.trim()).filter(Boolean);
    if (lines.length > 1) t = `\\begin{aligned}${lines.map(x => "&" + x).join("\\\\[3pt]")}\\end{aligned}`;
  }
  return t;
}
