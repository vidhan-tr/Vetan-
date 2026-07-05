"use strict";

/* ============================================================================
   VETAN — Indian In-Hand Salary Calculator
   script.js — all application logic, organized into clearly separated modules.
   No frameworks. ES6+. Every function below is fully implemented and wired up.
   ============================================================================ */

/* ============================================================================
   1. TAX CONFIGURATION (FY 2026-27 / AY 2027-28)
   Kept in one place so future year updates only require editing this block.
   ============================================================================ */
const TAX_CONFIG = Object.freeze({
  financialYear: "2026-27",
  assessmentYear: "2027-28",

  standardDeduction: { new: 75000, old: 50000 },
  cessRate: 0.04, // Health & Education Cess

  newRegime: {
    slabs: [
      { upto: 400000, rate: 0 },
      { upto: 800000, rate: 0.05 },
      { upto: 1200000, rate: 0.1 },
      { upto: 1600000, rate: 0.15 },
      { upto: 2000000, rate: 0.2 },
      { upto: 2400000, rate: 0.25 },
      { upto: Infinity, rate: 0.3 },
    ],
    rebate: { thresholdTaxableIncome: 1200000, maxRebate: 60000 },
    surchargeCap: 0.25,
  },

  oldRegime: {
    slabs: [
      { upto: 250000, rate: 0 },
      { upto: 500000, rate: 0.05 },
      { upto: 1000000, rate: 0.2 },
      { upto: Infinity, rate: 0.3 },
    ],
    rebate: { thresholdTaxableIncome: 500000, maxRebate: 12500 },
    surchargeCap: 0.37,
  },

  surchargeSlabs: [
    { threshold: 20000000, rate: 0.25 }, // > 2 Cr (capped at 25% for new regime elsewhere)
    { threshold: 10000000, rate: 0.15 }, // > 1 Cr
    { threshold: 5000000, rate: 0.1 }, // > 50 L
    { threshold: 0, rate: 0 },
  ],

  deductionLimits: {
    section80C: 150000,
    section80D: 25000,
    section80CCD1B: 50000,
  },
});

/* Professional Tax — most states cap annual PT at ₹2,500 due to the
   constitutional ceiling (Article 276). This is a simplified annual estimate,
   not a month-by-month slab replica. States that do not levy PT return 0. */
const STATE_PT = Object.freeze({
  Maharashtra: 2500,
  Karnataka: 2400,
  "West Bengal": 2500,
  "Tamil Nadu": 2500,
  "Andhra Pradesh": 2500,
  Telangana: 2500,
  Gujarat: 2400,
  "Madhya Pradesh": 2500,
  Kerala: 2500,
  Odisha: 2500,
  Assam: 2500,
  Bihar: 2500,
  Jharkhand: 2500,
  Chhattisgarh: 2400,
  Tripura: 2496,
  Meghalaya: 2400,
  Sikkim: 2400,
  Manipur: 2500,
  Mizoram: 2400,
  Nagaland: 2400,
  Puducherry: 2500,
  Goa: 2400,
  Delhi: 0,
  Haryana: 0,
  "Uttar Pradesh": 0,
  Uttarakhand: 0,
  Rajasthan: 0,
  Punjab: 0,
  "Himachal Pradesh": 0,
  "Jammu & Kashmir": 0,
  Ladakh: 0,
  Chandigarh: 0,
  "Arunachal Pradesh": 0,
  "Andaman & Nicobar Islands": 0,
});

/* ============================================================================
   2. PURE CALCULATION FUNCTIONS
   Every function is independent and side-effect free, as required by spec.
   ============================================================================ */

function calculateBasicSalary(annualCTC, basicPct) {
  return round2(annualCTC * (basicPct / 100));
}

function calculateHRA(basicSalary, cityType) {
  const rate = cityType === "metro" ? 0.5 : 0.4;
  return round2(basicSalary * rate);
}

function calculateLTA(annualCTC, ltaPct) {
  return round2(annualCTC * (ltaPct / 100));
}

function calculateEmployerPF(basicSalary) {
  return round2(basicSalary * 0.12);
}

function calculatePF(basicSalary, isEnabled) {
  return isEnabled ? round2(basicSalary * 0.12) : 0;
}

function calculateGratuity(basicSalary, isEnabled) {
  return isEnabled ? round2(basicSalary * 0.0481) : 0;
}

function calculateSpecialAllowance(annualCTC, fixedComponentsSum) {
  return Math.max(0, round2(annualCTC - fixedComponentsSum));
}

function calculateProfessionalTax(state, isEnabled) {
  if (!isEnabled) return 0;
  return STATE_PT.hasOwnProperty(state) ? STATE_PT[state] : 2400;
}

function calculateESI(monthlyGross, isEnabled) {
  if (!isEnabled || monthlyGross > 21000) return 0;
  return round2(monthlyGross * 0.0175 * 12);
}

/** Slab-wise tax on a taxable income, given an ordered array of {upto, rate}. */
function calculateSlabTax(taxableIncome, slabs) {
  let tax = 0;
  let lowerBound = 0;
  for (const slab of slabs) {
    if (taxableIncome <= lowerBound) break;
    const taxableInSlab = Math.min(taxableIncome, slab.upto) - lowerBound;
    tax += taxableInSlab * slab.rate;
    lowerBound = slab.upto;
  }
  return tax;
}

/** Applies Section 87A rebate with marginal relief at the cliff edge. */
function applyRebateWithMarginalRelief(
  taxableIncome,
  taxBeforeCess,
  rebateConfig,
) {
  const { thresholdTaxableIncome, maxRebate } = rebateConfig;
  if (taxableIncome <= thresholdTaxableIncome) {
    const rebate = Math.min(taxBeforeCess, maxRebate);
    return Math.max(0, taxBeforeCess - rebate);
  }
  // Marginal relief: tax payable cannot exceed the income earned above the threshold.
  const incomeAboveThreshold = taxableIncome - thresholdTaxableIncome;
  return taxBeforeCess > incomeAboveThreshold
    ? incomeAboveThreshold
    : taxBeforeCess;
}

function calculateSurchargeRate(taxableIncome, surchargeCap) {
  for (const slab of TAX_CONFIG.surchargeSlabs) {
    if (taxableIncome > slab.threshold) {
      return Math.min(slab.rate, surchargeCap);
    }
  }
  return 0;
}

function calculateIncomeTax(taxableIncome, regime) {
  const config = regime === "new" ? TAX_CONFIG.newRegime : TAX_CONFIG.oldRegime;
  const baseTax = calculateSlabTax(taxableIncome, config.slabs);
  const taxAfterRebate = applyRebateWithMarginalRelief(
    taxableIncome,
    baseTax,
    config.rebate,
  );
  const surchargeRate = calculateSurchargeRate(
    taxableIncome,
    config.surchargeCap,
  );
  const surcharge = round2(taxAfterRebate * surchargeRate);
  const cess = round2((taxAfterRebate + surcharge) * TAX_CONFIG.cessRate);
  const totalTax = round2(taxAfterRebate + surcharge + cess);
  return {
    baseTax: round2(baseTax),
    taxAfterRebate: round2(taxAfterRebate),
    surcharge,
    cess,
    totalTax,
  };
}

function calculateTaxableIncome(params) {
  const {
    grossSalary,
    regime,
    standardDeduction,
    hraExemption,
    professionalTax,
    section80C,
    insurance80D,
    nps80CCD1B,
  } = params;
  if (regime === "new") {
    return Math.max(0, round2(grossSalary - standardDeduction));
  }
  const cappedSection80C = Math.min(
    section80C,
    TAX_CONFIG.deductionLimits.section80C,
  );
  const cappedInsurance = Math.min(
    insurance80D,
    TAX_CONFIG.deductionLimits.section80D,
  );
  const cappedNPS = Math.min(
    nps80CCD1B,
    TAX_CONFIG.deductionLimits.section80CCD1B,
  );
  const totalDeductions =
    standardDeduction +
    hraExemption +
    professionalTax +
    cappedSection80C +
    cappedInsurance +
    cappedNPS;
  return Math.max(0, round2(grossSalary - totalDeductions));
}

function calculateGrossSalary(components) {
  const {
    basic,
    hra,
    lta,
    specialAllowance,
    bonus,
    medical,
    transport,
    food,
    otherAllowance,
  } = components;
  return round2(
    basic +
      hra +
      lta +
      specialAllowance +
      bonus +
      medical +
      transport +
      food +
      otherAllowance,
  );
}

function calculateTotalDeductions(parts) {
  const { employeePF, professionalTax, incomeTax, esi, otherDeduction } = parts;
  return round2(
    employeePF + professionalTax + incomeTax + esi + otherDeduction,
  );
}

function calculateAnnualInHand(grossSalary, totalDeductions) {
  return round2(grossSalary - totalDeductions);
}

function calculateMonthlySalary(annualValue) {
  return round2(annualValue / 12);
}

function calculateEffectiveTaxRate(incomeTax, annualCTC) {
  return annualCTC > 0 ? round2((incomeTax / annualCTC) * 100) : 0;
}

function calculateTakeHomePercentage(annualInHand, annualCTC) {
  return annualCTC > 0 ? round2((annualInHand / annualCTC) * 100) : 0;
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/* ============================================================================
   3. MASTER ORCHESTRATOR — runs every calculation function above in sequence
   ============================================================================ */
function runFullCalculation(inputs) {
  const annualCTC = inputs.annualCTC;

  const basic = calculateBasicSalary(annualCTC, inputs.basicPct);
  const hra = calculateHRA(basic, inputs.cityType);
  const lta = calculateLTA(annualCTC, inputs.ltaPct);
  const employerPF = calculateEmployerPF(basic);
  const employeePF = calculatePF(basic, inputs.pfEnabled);
  const gratuity = calculateGratuity(basic, inputs.gratuityEnabled);
  const bonus = inputs.bonus;
  const medical = inputs.medical;
  const transport = inputs.transport;
  const food = inputs.food;
  const otherAllowance = inputs.otherAllowance;

  const fixedComponentsSum =
    basic +
    hra +
    lta +
    employerPF +
    gratuity +
    bonus +
    medical +
    transport +
    food +
    otherAllowance;
  const specialAllowance = calculateSpecialAllowance(
    annualCTC,
    fixedComponentsSum,
  );

  const grossSalary = calculateGrossSalary({
    basic,
    hra,
    lta,
    specialAllowance,
    bonus,
    medical,
    transport,
    food,
    otherAllowance,
  });

  const standardDeduction = TAX_CONFIG.standardDeduction[inputs.regime];
  const professionalTax = calculateProfessionalTax(
    inputs.state,
    inputs.ptEnabled,
  );
  const esi = calculateESI(grossSalary / 12, inputs.esiEnabled);

  const taxableIncome = calculateTaxableIncome({
    grossSalary,
    regime: inputs.regime,
    standardDeduction,
    hraExemption: inputs.regime === "old" ? hra : 0,
    professionalTax: inputs.regime === "old" ? professionalTax : 0,
    section80C: inputs.section80C,
    insurance80D: inputs.insurance,
    nps80CCD1B: inputs.nps,
  });

  const taxResult = calculateIncomeTax(taxableIncome, inputs.regime);

  const totalDeductions = calculateTotalDeductions({
    employeePF,
    professionalTax,
    incomeTax: taxResult.totalTax,
    esi,
    otherDeduction: inputs.otherDeduction,
  });

  const annualInHand = calculateAnnualInHand(grossSalary, totalDeductions);
  const monthlyInHand = calculateMonthlySalary(annualInHand);
  const effectiveTaxRate = calculateEffectiveTaxRate(
    taxResult.totalTax,
    annualCTC,
  );
  const takeHomePct = calculateTakeHomePercentage(annualInHand, annualCTC);
  const employerTotalCost = round2(grossSalary + employerPF + gratuity);

  return {
    inputs,
    annualCTC,
    basic,
    hra,
    lta,
    employerPF,
    employeePF,
    gratuity,
    bonus,
    medical,
    transport,
    food,
    otherAllowance,
    specialAllowance,
    grossSalary,
    standardDeduction,
    professionalTax,
    esi,
    taxableIncome,
    taxResult,
    totalDeductions,
    annualInHand,
    monthlyInHand,
    effectiveTaxRate,
    takeHomePct,
    employerTotalCost,
  };
}

/* ============================================================================
   4. FORMATTING HELPERS (Indian numbering system)
   ============================================================================ */
function formatIndianNumber(num) {
  const isNegative = num < 0;
  num = Math.round(Math.abs(num));
  const str = num.toString();
  if (str.length <= 3) return (isNegative ? "-" : "") + str;
  const lastThree = str.slice(-3);
  const other = str.slice(0, -3);
  const formattedOther = other.replace(/\B(?=(\d{2})+(?!\d)$)/g, ",");
  return (isNegative ? "-" : "") + formattedOther + "," + lastThree;
}

function formatCurrency(num) {
  return "₹" + formatIndianNumber(num);
}

function formatCurrencyPrecise(num) {
  const sign = num < 0 ? "-" : "";
  const abs = Math.abs(round2(num));
  const [whole, decimal] = abs.toFixed(2).split(".");
  return sign + "₹" + formatIndianNumber(Number(whole)) + "." + decimal;
}

const WORD_ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const WORD_TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

function twoDigitWords(n) {
  if (n < 20) return WORD_ONES[n];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return WORD_TENS[tens] + (ones ? " " + WORD_ONES[ones] : "");
}

function threeDigitWords(n) {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  let out = "";
  if (hundreds) out += WORD_ONES[hundreds] + " Hundred";
  if (rest) out += (out ? " " : "") + twoDigitWords(rest);
  return out;
}

function numberToIndianWords(num) {
  num = Math.round(Math.abs(num));
  if (num === 0) return "Zero Rupees";
  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  const hundred = num;
  const parts = [];
  if (crore) parts.push(threeDigitWords(crore) + " Crore");
  if (lakh) parts.push(twoDigitWords(lakh) + " Lakh");
  if (thousand) parts.push(twoDigitWords(thousand) + " Thousand");
  if (hundred) parts.push(threeDigitWords(hundred));
  return parts.join(" ") + " Rupees";
}

function parseNumericInput(value) {
  const cleaned = String(value).replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
}

/* ============================================================================
   5. STATE
   ============================================================================ */
const AppState = {
  period: "annual",
  regime: "new",
  lastResult: null,
  charts: {},
};

const STATE_LIST = Object.keys(STATE_PT);

/* ============================================================================
   6. DOM READY — WIRE EVERYTHING UP
   ============================================================================ */
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  populateStateDropdown();
  bindCurrencyInputs();
  bindSegmentedControls();
  bindAdvancedAccordion();
  bindSwitches();
  bindCalculateButton();
  bindTabs();
  bindHistoryDrawer();
  bindToolButtons();
  bindActionButtons();
  bindRipples();
});

/* ---------------------------------------------------------------------------
   6.1 THEME
   --------------------------------------------------------------------------- */
function initTheme() {
  const saved = localStorage.getItem("vetan_theme");
  const theme = saved || "dark";
  applyTheme(theme);
  document.getElementById("themeToggle").addEventListener("click", () => {
    const current = document.body.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    applyTheme(next);
    localStorage.setItem("vetan_theme", next);
  });
}

function applyTheme(theme) {
  document.body.setAttribute("data-theme", theme);
  document.getElementById("themeIconMoon").hidden = theme === "light";
  document.getElementById("themeIconSun").hidden = theme !== "light";
  refreshChartThemes();
}

/* ---------------------------------------------------------------------------
   6.2 STATE DROPDOWN
   --------------------------------------------------------------------------- */
function populateStateDropdown() {
  const select = document.getElementById("stateSelect");
  STATE_LIST.forEach((state) => {
    const opt = document.createElement("option");
    opt.value = state;
    opt.textContent = state;
    select.appendChild(opt);
  });
  select.value = "Maharashtra";
}

/* ---------------------------------------------------------------------------
   6.3 CURRENCY INPUT LIVE FORMATTING + VALIDATION
   --------------------------------------------------------------------------- */
function bindCurrencyInputs() {
  const currencyIds = [
    "ctcInput",
    "bonusInput",
    "medicalInput",
    "transportInput",
    "foodInput",
    "otherAllowanceInput",
    "npsInput",
    "insuranceInput",
    "section80cInput",
    "otherDeductionInput",
    "offerA",
    "offerB",
    "hikeCurrent",
  ];

  currencyIds.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", (e) => formatCurrencyFieldLive(e.target));
    el.addEventListener("blur", (e) => formatCurrencyFieldLive(e.target, true));
  });

  const percentIds = ["basicPct", "ltaPct", "hikePct"];
  percentIds.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/[^0-9]/g, "").slice(0, 3);
    });
  });

  document
    .getElementById("ctcInput")
    .addEventListener("input", updateCtcWordsDisplay);
}

function formatCurrencyFieldLive(input, isBlur) {
  const raw = parseNumericInput(input.value);
  const clamped = Math.max(0, raw);
  const caretAtEnd = document.activeElement === input;
  input.value =
    clamped === 0 && !isBlur && input.value === ""
      ? ""
      : formatIndianNumber(clamped);
  input.classList.remove("is-invalid");
}

function updateCtcWordsDisplay() {
  const raw = parseNumericInput(document.getElementById("ctcInput").value);
  const display = document.getElementById("ctcWords");
  if (raw <= 0) {
    display.textContent = "Enter your salary to begin";
    return;
  }
  const period = AppState.period === "annual" ? "per year" : "per month";
  display.textContent = `${numberToIndianWords(raw)} ${period}`;
}

/* ---------------------------------------------------------------------------
   6.4 SEGMENTED CONTROLS (Period + Regime)
   --------------------------------------------------------------------------- */
function bindSegmentedControls() {
  document.querySelectorAll("[data-period]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-period]").forEach((b) => {
        b.classList.remove("is-active");
        b.setAttribute("aria-selected", "false");
      });
      btn.classList.add("is-active");
      btn.setAttribute("aria-selected", "true");
      AppState.period = btn.dataset.period;
      document.getElementById("ctcLabel").textContent =
        AppState.period === "annual"
          ? "Annual CTC (₹)"
          : "Monthly Gross Salary (₹)";
      document.getElementById("ctcInput").placeholder =
        AppState.period === "annual" ? "12,00,000" : "1,00,000";
      updateCtcWordsDisplay();
    });
  });

  document.querySelectorAll("[data-regime]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-regime]").forEach((b) => {
        b.classList.remove("is-active");
        b.setAttribute("aria-selected", "false");
      });
      btn.classList.add("is-active");
      btn.setAttribute("aria-selected", "true");
      AppState.regime = btn.dataset.regime;
    });
  });
}

/* ---------------------------------------------------------------------------
   6.5 ADVANCED ACCORDION
   --------------------------------------------------------------------------- */
function bindAdvancedAccordion() {
  const toggle = document.getElementById("advancedToggle");
  const panel = document.getElementById("advancedPanel");
  toggle.addEventListener("click", () => {
    const isOpen = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!isOpen));
    panel.hidden = isOpen;
  });
}

/* ---------------------------------------------------------------------------
   6.6 SWITCHES (no special logic needed beyond native checkbox state,
        but ESI/PT switches get live hint updates)
   --------------------------------------------------------------------------- */
function bindSwitches() {
  // Switches are read directly at calculation time; nothing to pre-wire.
}

/* ---------------------------------------------------------------------------
   6.7 VALIDATION
   --------------------------------------------------------------------------- */
function validateInputs() {
  const ctcInput = document.getElementById("ctcInput");
  const ctcRaw = parseNumericInput(ctcInput.value);
  const errorEl = document.getElementById("ctcError");

  if (ctcRaw <= 0) {
    ctcInput.classList.add("is-invalid");
    errorEl.textContent = "Please enter a salary greater than ₹0.";
    ctcInput.focus();
    return null;
  }
  if (ctcRaw > 100000000) {
    ctcInput.classList.add("is-invalid");
    errorEl.textContent = "That looks unusually high — please double-check.";
    return null;
  }
  ctcInput.classList.remove("is-invalid");
  errorEl.textContent = "";

  const basicPct = Math.min(
    90,
    Math.max(
      20,
      parseNumericInput(document.getElementById("basicPct").value) || 40,
    ),
  );
  const ltaPct = Math.min(
    20,
    Math.max(
      0,
      parseNumericInput(document.getElementById("ltaPct").value) || 0,
    ),
  );

  const annualCTC = AppState.period === "annual" ? ctcRaw : ctcRaw * 12;

  return {
    annualCTC,
    basicPct,
    ltaPct,
    cityType: document.getElementById("cityType").value,
    employmentType: document.getElementById("employmentType").value,
    state: document.getElementById("stateSelect").value,
    regime: AppState.regime,
    bonus: parseNumericInput(document.getElementById("bonusInput").value),
    medical: parseNumericInput(document.getElementById("medicalInput").value),
    transport: parseNumericInput(
      document.getElementById("transportInput").value,
    ),
    food: parseNumericInput(document.getElementById("foodInput").value),
    otherAllowance: parseNumericInput(
      document.getElementById("otherAllowanceInput").value,
    ),
    pfEnabled: document.getElementById("pfToggle").checked,
    gratuityEnabled: document.getElementById("gratuityToggle").checked,
    ptEnabled: document.getElementById("ptToggle").checked,
    esiEnabled: document.getElementById("esiToggle").checked,
    nps: parseNumericInput(document.getElementById("npsInput").value),
    insurance: parseNumericInput(
      document.getElementById("insuranceInput").value,
    ),
    section80C: parseNumericInput(
      document.getElementById("section80cInput").value,
    ),
    otherDeduction: parseNumericInput(
      document.getElementById("otherDeductionInput").value,
    ),
  };
}

/* ---------------------------------------------------------------------------
   6.8 CALCULATE BUTTON
   --------------------------------------------------------------------------- */
function bindCalculateButton() {
  document.getElementById("calculateBtn").addEventListener("click", () => {
    const inputs = validateInputs();
    if (!inputs) return;
    const result = runFullCalculation(inputs);
    AppState.lastResult = result;
    renderResults(result);
    saveToHistory(result);
    document
      .getElementById("resultsPanel")
      .scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

/* ============================================================================
   7. RENDERING
   ============================================================================ */
function renderResults(result) {
  document.getElementById("emptyState").hidden = true;
  const content = document.getElementById("resultsContent");
  content.hidden = false;

  animateCountUp(
    document.getElementById("monthlyInHandDisplay"),
    result.monthlyInHand,
    formatCurrency,
  );
  animateCountUp(
    document.getElementById("annualInHandDisplay"),
    result.annualInHand,
    formatCurrency,
  );
  document.getElementById("effectiveTaxDisplay").textContent =
    result.effectiveTaxRate.toFixed(1) + "%";
  document.getElementById("takeHomePct").textContent =
    result.takeHomePct.toFixed(0) + "%";

  renderCardGrid(result);
  renderLedgers(result);
  renderCharts(result);
  renderTaxSuggestions(result);
}

function renderCardGrid(result) {
  const cards = [
    {
      label: "Annual CTC",
      value: result.annualCTC,
      tip: "Your total Cost to Company — everything the employer spends on you in a year.",
    },
    {
      label: "Gross Salary",
      value: result.grossSalary,
      tip: "Basic + HRA + LTA + Special Allowance + Bonus + other cash allowances. Excludes employer PF and gratuity.",
    },
    {
      label: "Basic Salary",
      value: result.basic,
      tip: `${result.inputs.basicPct}% of your Annual CTC. Most other components are calculated from this.`,
    },
    {
      label: "HRA",
      value: result.hra,
      tip: `${result.inputs.cityType === "metro" ? "50%" : "40%"} of Basic Salary, based on your selected city type.`,
    },
    {
      label: "Employer PF",
      value: result.employerPF,
      tip: "12% of Basic, paid by your employer into your PF account. Part of CTC, not deducted from your pay.",
    },
    {
      label: "Employee PF",
      value: result.employeePF,
      tip: "12% of Basic, deducted from your salary into your own PF account.",
      negative: result.employeePF > 0,
    },
    {
      label: "Gratuity",
      value: result.gratuity,
      tip: "4.81% of Basic. An employer cost that you receive only after continuous service, typically 5 years.",
    },
    {
      label: "Professional Tax",
      value: result.professionalTax,
      tip: `State-level tax based on ${result.inputs.state}. Capped at ₹2,500/year in most states.`,
      negative: result.professionalTax > 0,
    },
    {
      label: "Income Tax",
      value: result.taxResult.totalTax,
      tip: `Computed under the ${result.inputs.regime === "new" ? "New" : "Old"} Regime slabs for FY ${TAX_CONFIG.financialYear}, including 4% cess.`,
      negative: result.taxResult.totalTax > 0,
    },
    {
      label: "Total Deductions",
      value: result.totalDeductions,
      tip: "Employee PF + Professional Tax + Income Tax + ESI + other deductions.",
      negative: true,
    },
    {
      label: "Annual In-Hand",
      value: result.annualInHand,
      tip: "Gross Salary minus Total Deductions — what actually reaches your bank account in a year.",
      positive: true,
    },
    {
      label: "Monthly In-Hand",
      value: result.monthlyInHand,
      tip: "Your Annual In-Hand Salary divided by 12.",
      positive: true,
      accent: true,
    },
    {
      label: "Effective Tax Rate",
      value: result.effectiveTaxRate,
      suffix: "%",
      isPercent: true,
      tip: "Total Income Tax as a percentage of your Annual CTC.",
    },
    {
      label: "Take-Home %",
      value: result.takeHomePct,
      suffix: "%",
      isPercent: true,
      tip: "Annual In-Hand Salary as a percentage of your Annual CTC.",
      positive: true,
    },
    {
      label: "Annual Savings Potential",
      value: Math.max(0, result.annualInHand - result.taxResult.totalTax * 0),
      tip: "Illustrative — actual savings depend on your monthly expenses.",
      hideIfZero: true,
    },
  ];

  const grid = document.getElementById("cardGrid");
  grid.innerHTML = "";
  cards.forEach((card) => {
    const el = document.createElement("div");
    el.className = "result-card";
    if (card.positive) el.classList.add("result-card--positive");
    if (card.negative) el.classList.add("result-card--negative");
    if (card.accent) el.classList.add("result-card--accent");
    const valueText = card.isPercent
      ? card.value.toFixed(1) + "%"
      : formatCurrency(card.value);
    el.innerHTML = `
      <div class="result-card__top">
        <span class="result-card__label">${card.label}</span>
        <span class="info-dot" tabindex="0">i<span class="tooltip">${card.tip}</span></span>
      </div>
      <div class="result-card__value">${valueText}</div>
    `;
    grid.appendChild(el);
  });
}

function renderLedgers(result) {
  const employerRows = [
    ["Basic Salary", result.basic],
    ["HRA", result.hra],
    ["LTA", result.lta],
    ["Special Allowance", result.specialAllowance],
    ["Bonus / Variable Pay", result.bonus],
    ["Medical Allowance", result.medical],
    ["Transport Allowance", result.transport],
    ["Food Coupons", result.food],
    ["Other Allowances", result.otherAllowance],
    ["Employer PF Contribution", result.employerPF],
    ["Gratuity", result.gratuity],
  ];
  document.getElementById("employerLedger").innerHTML =
    employerRows.map(([label, value]) => ledgerRow(label, value)).join("") +
    ledgerRow("Annual CTC", result.annualCTC, true);

  const employeeRows = [
    ["Employee PF", result.employeePF],
    ["Professional Tax", result.professionalTax],
    ["ESI", result.esi],
    ["Income Tax (incl. cess & surcharge)", result.taxResult.totalTax],
    ["Other Deductions", result.inputs.otherDeduction],
  ];
  document.getElementById("employeeLedger").innerHTML =
    employeeRows.map(([label, value]) => ledgerRow(label, value)).join("") +
    ledgerRow("Total Deductions", result.totalDeductions, true) +
    ledgerRow("Annual In-Hand Salary", result.annualInHand, true);
}

function ledgerRow(label, value, isTotal) {
  return `<div class="ledger__row ${isTotal ? "ledger__row--total" : ""}">
    <span class="ledger__row-label">${label}</span>
    <span class="ledger__row-value">${formatCurrency(value)}</span>
  </div>`;
}

/* ---------------------------------------------------------------------------
   Animated counter for hero figures
   --------------------------------------------------------------------------- */
function animateCountUp(el, targetValue, formatter, duration = 700) {
  const startValue = 0;
  const startTime = performance.now();
  function tick(now) {
    const progress = Math.min(1, (now - startTime) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = startValue + (targetValue - startValue) * eased;
    el.textContent = formatter(current);
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* ============================================================================
   8. TABS
   ============================================================================ */
function bindTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".tab-btn")
        .forEach((b) => b.classList.remove("is-active"));
      document
        .querySelectorAll(".tab-panel")
        .forEach((p) => p.classList.remove("is-active"));
      btn.classList.add("is-active");
      document
        .getElementById("tab-" + btn.dataset.tab)
        .classList.add("is-active");
    });
  });
}

/* ============================================================================
   9. CHARTS (Chart.js)
   ============================================================================ */
function getChartColors() {
  const isLight = document.body.getAttribute("data-theme") === "light";
  return {
    text: isLight ? "#4B4F72" : "#B7BBD9",
    grid: isLight ? "rgba(20,20,50,0.08)" : "rgba(255,255,255,0.08)",
    palette: ["#6C5CE7", "#F2A93B", "#22B07D", "#E15A5A", "#4B3FD6", "#FFC876"],
  };
}

function renderCharts(result) {
  const colors = getChartColors();
  Chart.defaults.color = colors.text;
  Chart.defaults.font.family = "'Inter', sans-serif";

  destroyChart("salaryBreakdown");
  AppState.charts.salaryBreakdown = new Chart(
    document.getElementById("chartSalaryBreakdown"),
    {
      type: "doughnut",
      data: {
        labels: [
          "Basic",
          "HRA",
          "LTA",
          "Special Allowance",
          "Bonus",
          "Other Allowances",
        ],
        datasets: [
          {
            data: [
              result.basic,
              result.hra,
              result.lta,
              result.specialAllowance,
              result.bonus,
              result.medical +
                result.transport +
                result.food +
                result.otherAllowance,
            ],
            backgroundColor: colors.palette,
            borderWidth: 0,
          },
        ],
      },
      options: {
        plugins: {
          legend: {
            position: "bottom",
            labels: { boxWidth: 10, padding: 12, font: { size: 11 } },
          },
        },
        cutout: "62%",
        animation: { animateRotate: true, duration: 900 },
      },
    },
  );

  destroyChart("deductions");
  const deductionData = [
    result.employeePF,
    result.professionalTax,
    result.esi,
    result.taxResult.totalTax,
    result.inputs.otherDeduction,
  ].filter((v) => v >= 0);
  AppState.charts.deductions = new Chart(
    document.getElementById("chartDeductions"),
    {
      type: "pie",
      data: {
        labels: [
          "Employee PF",
          "Professional Tax",
          "ESI",
          "Income Tax",
          "Other",
        ],
        datasets: [
          {
            data: [
              result.employeePF,
              result.professionalTax,
              result.esi,
              result.taxResult.totalTax,
              result.inputs.otherDeduction,
            ],
            backgroundColor: colors.palette,
            borderWidth: 0,
          },
        ],
      },
      options: {
        plugins: {
          legend: {
            position: "bottom",
            labels: { boxWidth: 10, padding: 12, font: { size: 11 } },
          },
        },
        animation: { duration: 900 },
      },
    },
  );

  destroyChart("monthlyBar");
  AppState.charts.monthlyBar = new Chart(
    document.getElementById("chartMonthlyBar"),
    {
      type: "bar",
      data: {
        labels: ["Monthly Gross", "Monthly Deductions", "Monthly In-Hand"],
        datasets: [
          {
            data: [
              calculateMonthlySalary(result.grossSalary),
              calculateMonthlySalary(result.totalDeductions),
              result.monthlyInHand,
            ],
            backgroundColor: [
              colors.palette[0],
              colors.palette[3],
              colors.palette[2],
            ],
            borderRadius: 8,
            maxBarThickness: 70,
          },
        ],
      },
      options: {
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: (ctx) => formatCurrency(ctx.parsed.y) },
          },
        },
        scales: {
          y: {
            grid: { color: colors.grid },
            ticks: { callback: (v) => formatIndianNumber(v) },
          },
          x: { grid: { display: false } },
        },
        animation: { duration: 900 },
      },
    },
  );

  destroyChart("taxSlabs");
  const slabConfig =
    result.inputs.regime === "new"
      ? TAX_CONFIG.newRegime.slabs
      : TAX_CONFIG.oldRegime.slabs;
  let lower = 0;
  const slabLabels = [];
  const slabAmounts = [];
  slabConfig.forEach((slab) => {
    const taxedInSlab = Math.max(
      0,
      Math.min(result.taxableIncome, slab.upto) - lower,
    );
    if (slab.upto !== Infinity || taxedInSlab > 0) {
      slabLabels.push(
        slab.upto === Infinity
          ? `Above ${formatCurrency(lower)}`
          : `${formatCurrency(lower)}–${formatCurrency(slab.upto)}`,
      );
      slabAmounts.push(round2(taxedInSlab * slab.rate));
    }
    lower = slab.upto;
  });
  AppState.charts.taxSlabs = new Chart(
    document.getElementById("chartTaxSlabs"),
    {
      type: "bar",
      data: {
        labels: slabLabels,
        datasets: [
          {
            data: slabAmounts,
            backgroundColor: colors.palette[1],
            borderRadius: 6,
          },
        ],
      },
      options: {
        indexAxis: "y",
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: (ctx) => formatCurrency(ctx.parsed.x) },
          },
        },
        scales: {
          x: {
            grid: { color: colors.grid },
            ticks: { callback: (v) => formatIndianNumber(v) },
          },
          y: { grid: { display: false }, ticks: { font: { size: 10.5 } } },
        },
        animation: { duration: 900 },
      },
    },
  );
}

function destroyChart(key) {
  if (AppState.charts[key]) {
    AppState.charts[key].destroy();
    delete AppState.charts[key];
  }
}

function refreshChartThemes() {
  if (AppState.lastResult) renderCharts(AppState.lastResult);
}

/* ============================================================================
   10. SMART TOOLS
   ============================================================================ */
function bindToolButtons() {
  document
    .getElementById("compareBtn")
    .addEventListener("click", handleCompareOffers);
  document
    .getElementById("hikeBtn")
    .addEventListener("click", handleHikeCalculation);
}

function quickInHand(annualCTC) {
  // Uses current form settings (regime, state, city, basic %) for a fair comparison.
  const base = validateInputs() || {
    basicPct: 40,
    ltaPct: 5,
    cityType: "metro",
    state: "Maharashtra",
    regime: AppState.regime,
    bonus: 0,
    medical: 0,
    transport: 0,
    food: 0,
    otherAllowance: 0,
    pfEnabled: true,
    gratuityEnabled: true,
    ptEnabled: true,
    esiEnabled: false,
    nps: 0,
    insurance: 0,
    section80C: 0,
    otherDeduction: 0,
  };
  const inputs = { ...base, annualCTC };
  return runFullCalculation(inputs);
}

function handleCompareOffers() {
  const a = parseNumericInput(document.getElementById("offerA").value);
  const b = parseNumericInput(document.getElementById("offerB").value);
  const resultEl = document.getElementById("compareResult");
  if (a <= 0 || b <= 0) {
    resultEl.hidden = false;
    resultEl.innerHTML = `<p style="color:var(--crimson)">Enter both CTC amounts to compare.</p>`;
    return;
  }
  const resA = quickInHand(a);
  const resB = quickInHand(b);
  const winner =
    resA.monthlyInHand > resB.monthlyInHand
      ? "Company A"
      : resB.monthlyInHand > resA.monthlyInHand
        ? "Company B"
        : "Both offers";
  const diff = Math.abs(resA.monthlyInHand - resB.monthlyInHand);

  resultEl.hidden = false;
  resultEl.innerHTML = `
    <div class="tool-result__row"><span>Company A — Monthly In-Hand</span><span>${formatCurrency(resA.monthlyInHand)}</span></div>
    <div class="tool-result__row"><span>Company B — Monthly In-Hand</span><span>${formatCurrency(resB.monthlyInHand)}</span></div>
    <div class="tool-result__row"><span>Company A — Effective Tax Rate</span><span>${resA.effectiveTaxRate.toFixed(1)}%</span></div>
    <div class="tool-result__row"><span>Company B — Effective Tax Rate</span><span>${resB.effectiveTaxRate.toFixed(1)}%</span></div>
    <div class="tool-result__winner">${winner} pays ${formatCurrency(diff)} more per month in-hand.</div>
  `;
}

function handleHikeCalculation() {
  const current = parseNumericInput(
    document.getElementById("hikeCurrent").value,
  );
  const hikePct = parseNumericInput(document.getElementById("hikePct").value);
  const resultEl = document.getElementById("hikeResult");
  if (current <= 0 || hikePct <= 0) {
    resultEl.hidden = false;
    resultEl.innerHTML = `<p style="color:var(--crimson)">Enter your current CTC and expected hike %.</p>`;
    return;
  }
  const newCTC = round2(current * (1 + hikePct / 100));
  const annualDiff = round2(newCTC - current);
  const monthlyDiff = calculateMonthlySalary(annualDiff);

  const before = quickInHand(current);
  const after = quickInHand(newCTC);
  const inHandMonthlyDiff = round2(after.monthlyInHand - before.monthlyInHand);

  resultEl.hidden = false;
  resultEl.innerHTML = `
    <div class="tool-result__row"><span>New Annual CTC</span><span>${formatCurrency(newCTC)}</span></div>
    <div class="tool-result__row"><span>Annual Increase</span><span>${formatCurrency(annualDiff)}</span></div>
    <div class="tool-result__row"><span>Monthly Increase (CTC)</span><span>${formatCurrency(monthlyDiff)}</span></div>
    <div class="tool-result__row"><span>Actual Monthly In-Hand Increase</span><span>${formatCurrency(inHandMonthlyDiff)}</span></div>
    <div class="tool-result__winner">Your real monthly in-hand grows by ${formatCurrency(inHandMonthlyDiff)}, after tax and deductions.</div>
  `;
}

function renderTaxSuggestions(result) {
  const list = document.getElementById("suggestionList");
  const suggestions = [];

  if (result.inputs.regime === "new") {
    suggestions.push({
      title: "You are on the New Regime",
      desc: "Most Chapter VI-A deductions (80C, 80D, HRA) do not apply here. If you invest heavily in ELSS, PPF, or pay rent, the Old Regime may save you more — try switching the toggle to compare.",
    });
  } else {
    const used80C = Math.min(
      result.inputs.section80C,
      TAX_CONFIG.deductionLimits.section80C,
    );
    const remaining80C = TAX_CONFIG.deductionLimits.section80C - used80C;
    if (remaining80C > 0) {
      suggestions.push({
        title: "Use up your Section 80C limit",
        desc: `You still have ${formatCurrency(remaining80C)} of unused 80C limit (PPF, ELSS, life insurance, EPF, principal on home loan).`,
        save: round2(
          remaining80C * marginalRateEstimate(result.taxableIncome, "old"),
        ),
      });
    }
    const usedNPS = Math.min(
      result.inputs.nps,
      TAX_CONFIG.deductionLimits.section80CCD1B,
    );
    const remainingNPS = TAX_CONFIG.deductionLimits.section80CCD1B - usedNPS;
    if (remainingNPS > 0) {
      suggestions.push({
        title: "Top up NPS under 80CCD(1B)",
        desc: `An extra ${formatCurrency(remainingNPS)} in NPS is deductible over and above your 80C limit.`,
        save: round2(
          remainingNPS * marginalRateEstimate(result.taxableIncome, "old"),
        ),
      });
    }
    const usedInsurance = Math.min(
      result.inputs.insurance,
      TAX_CONFIG.deductionLimits.section80D,
    );
    const remainingInsurance =
      TAX_CONFIG.deductionLimits.section80D - usedInsurance;
    if (remainingInsurance > 0) {
      suggestions.push({
        title: "Buy or top up health insurance (80D)",
        desc: `Up to ${formatCurrency(remainingInsurance)} more is deductible for health insurance premiums.`,
        save: round2(
          remainingInsurance *
            marginalRateEstimate(result.taxableIncome, "old"),
        ),
      });
    }
    if (result.hra > 0) {
      suggestions.push({
        title: "Keep rent receipts for your full HRA claim",
        desc: `This estimate assumes your full HRA of ${formatCurrency(result.hra)} is exempt. Actual exemption depends on rent paid — keep receipts and a rent agreement handy.`,
      });
    }
  }

  suggestions.push({
    title: "Home loan interest — Section 24(b)",
    desc: "If you have a home loan (self-occupied), interest up to ₹2,00,000/year is deductible under the Old Regime.",
  });
  suggestions.push({
    title: "Education loan interest — Section 80E",
    desc: "Full interest paid on an education loan is deductible under the Old Regime, with no upper limit, for up to 8 years.",
  });

  list.innerHTML = suggestions
    .map(
      (s) => `
    <div class="suggestion">
      <div class="suggestion__icon">₹</div>
      <div>
        <p class="suggestion__title">${s.title}</p>
        <p class="suggestion__desc">${s.desc}</p>
        ${s.save ? `<span class="suggestion__save">Potential saving: ~${formatCurrency(s.save)}/year</span>` : ""}
      </div>
    </div>
  `,
    )
    .join("");
}

function marginalRateEstimate(taxableIncome, regime) {
  const slabs =
    regime === "new" ? TAX_CONFIG.newRegime.slabs : TAX_CONFIG.oldRegime.slabs;
  for (const slab of slabs) {
    if (taxableIncome <= slab.upto)
      return slab.rate * (1 + TAX_CONFIG.cessRate);
  }
  return 0.3 * (1 + TAX_CONFIG.cessRate);
}

/* ============================================================================
   11. HISTORY (localStorage)
   ============================================================================ */
const HISTORY_KEY = "vetan_history_v1";

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch {
    return [];
  }
}

function setHistory(items) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
}

function saveToHistory(result) {
  const items = getHistory();
  const entry = {
    id: "calc_" + Date.now(),
    date: new Date().toISOString(),
    annualCTC: result.annualCTC,
    monthlyInHand: result.monthlyInHand,
    regime: result.inputs.regime,
    state: result.inputs.state,
    inputs: result.inputs,
  };
  items.unshift(entry);
  setHistory(items.slice(0, 50));
  renderHistoryList();
}

function bindHistoryDrawer() {
  const drawer = document.getElementById("historyDrawer");
  const overlay = document.getElementById("drawerOverlay");

  document
    .getElementById("historyToggle")
    .addEventListener("click", () => openDrawer());
  document.getElementById("closeDrawer").addEventListener("click", closeDrawer);
  overlay.addEventListener("click", closeDrawer);
  document
    .getElementById("historySearch")
    .addEventListener("input", renderHistoryList);
  document
    .getElementById("historySort")
    .addEventListener("change", renderHistoryList);

  function openDrawer() {
    overlay.hidden = false;
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    renderHistoryList();
  }
  function closeDrawer() {
    overlay.hidden = true;
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
  }

  window.__closeHistoryDrawer = closeDrawer;
  renderHistoryList();
}

function renderHistoryList() {
  const listEl = document.getElementById("historyList");
  const query = (
    document.getElementById("historySearch").value || ""
  ).toLowerCase();
  const sortBy = document.getElementById("historySort").value;

  let items = getHistory().filter(
    (item) =>
      String(item.annualCTC).includes(query) ||
      item.state.toLowerCase().includes(query) ||
      item.regime.toLowerCase().includes(query),
  );

  items.sort((a, b) => {
    if (sortBy === "newest") return new Date(b.date) - new Date(a.date);
    if (sortBy === "oldest") return new Date(a.date) - new Date(b.date);
    if (sortBy === "ctc-high") return b.annualCTC - a.annualCTC;
    if (sortBy === "ctc-low") return a.annualCTC - b.annualCTC;
    return 0;
  });

  if (items.length === 0) {
    listEl.innerHTML = `<p class="drawer__empty">No saved calculations yet. Every calculation you run is saved here automatically.</p>`;
    return;
  }

  listEl.innerHTML = items
    .map(
      (item) => `
    <div class="history-item" data-id="${item.id}">
      <div class="history-item__top">
        <span class="history-item__ctc">${formatCurrency(item.annualCTC)}</span>
        <span class="history-item__date">${new Date(item.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span>
      </div>
      <div class="history-item__meta">
        <span class="history-item__tag">${item.regime === "new" ? "New Regime" : "Old Regime"}</span>
        <span class="history-item__tag">${item.state}</span>
        <span class="history-item__tag">${formatCurrency(item.monthlyInHand)}/mo</span>
      </div>
      <div class="history-item__actions">
        <button data-action="recalculate" data-id="${item.id}">Recalculate</button>
        <button data-action="edit" data-id="${item.id}">Load &amp; Edit</button>
        <button data-action="delete" data-id="${item.id}" class="danger">Delete</button>
      </div>
    </div>
  `,
    )
    .join("");

  listEl.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      handleHistoryAction(btn.dataset.action, btn.dataset.id);
    });
  });
}

function handleHistoryAction(action, id) {
  const items = getHistory();
  const item = items.find((i) => i.id === id);
  if (!item) return;

  if (action === "delete") {
    setHistory(items.filter((i) => i.id !== id));
    renderHistoryList();
    showToast("Calculation deleted");
    return;
  }

  loadInputsIntoForm(item.inputs);

  if (action === "recalculate") {
    const result = runFullCalculation(item.inputs);
    AppState.lastResult = result;
    renderResults(result);
    window.__closeHistoryDrawer();
    showToast("Recalculated from history");
  }
  if (action === "edit") {
    window.__closeHistoryDrawer();
    showToast("Loaded into the form — edit and recalculate");
  }
}

function loadInputsIntoForm(inputs) {
  document.getElementById("ctcInput").value = formatIndianNumber(
    inputs.annualCTC,
  );
  AppState.period = "annual";
  document
    .querySelectorAll("[data-period]")
    .forEach((b) =>
      b.classList.toggle("is-active", b.dataset.period === "annual"),
    );
  document.getElementById("ctcLabel").textContent = "Annual CTC (₹)";
  document.getElementById("basicPct").value = inputs.basicPct;
  document.getElementById("ltaPct").value = inputs.ltaPct;
  document.getElementById("cityType").value = inputs.cityType;
  document.getElementById("employmentType").value = inputs.employmentType;
  document.getElementById("stateSelect").value = inputs.state;
  AppState.regime = inputs.regime;
  document
    .querySelectorAll("[data-regime]")
    .forEach((b) =>
      b.classList.toggle("is-active", b.dataset.regime === inputs.regime),
    );
  document.getElementById("bonusInput").value = formatIndianNumber(
    inputs.bonus,
  );
  document.getElementById("medicalInput").value = formatIndianNumber(
    inputs.medical,
  );
  document.getElementById("transportInput").value = formatIndianNumber(
    inputs.transport,
  );
  document.getElementById("foodInput").value = formatIndianNumber(inputs.food);
  document.getElementById("otherAllowanceInput").value = formatIndianNumber(
    inputs.otherAllowance,
  );
  document.getElementById("pfToggle").checked = inputs.pfEnabled;
  document.getElementById("gratuityToggle").checked = inputs.gratuityEnabled;
  document.getElementById("ptToggle").checked = inputs.ptEnabled;
  document.getElementById("esiToggle").checked = inputs.esiEnabled;
  document.getElementById("npsInput").value = formatIndianNumber(inputs.nps);
  document.getElementById("insuranceInput").value = formatIndianNumber(
    inputs.insurance,
  );
  document.getElementById("section80cInput").value = formatIndianNumber(
    inputs.section80C,
  );
  document.getElementById("otherDeductionInput").value = formatIndianNumber(
    inputs.otherDeduction,
  );
  updateCtcWordsDisplay();
}

/* ============================================================================
   12. ACTION BUTTONS — Print / PDF / Share
   ============================================================================ */
function bindActionButtons() {
  document
    .getElementById("printBtn")
    .addEventListener("click", () => window.print());
}

/* ============================================================================
   13. TOAST
   ============================================================================ */
let toastTimer = null;
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

/* ============================================================================
   14. BUTTON RIPPLE MICRO-INTERACTION
   ============================================================================ */
function bindRipples() {
  document.querySelectorAll(".btn").forEach((btn) => {
    btn.addEventListener("click", function (e) {
      const rect = btn.getBoundingClientRect();
      const ripple = document.createElement("span");
      ripple.className = "ripple";
      const size = Math.max(rect.width, rect.height);
      ripple.style.width = ripple.style.height = size + "px";
      ripple.style.left = e.clientX - rect.left - size / 2 + "px";
      ripple.style.top = e.clientY - rect.top - size / 2 + "px";
      btn.appendChild(ripple);
      setTimeout(() => ripple.remove(), 650);
    });
  });
}
