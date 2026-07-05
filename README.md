<div align="center">

# 🇮🇳 Vetan — Indian In-Hand Salary & Income Tax Calculator

**Know your real take-home, not just your CTC.**

A production-quality, single-page web app that calculates real monthly and yearly
in-hand salary for Indian employees, with a full breakdown of every deduction.

[![Made with HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white)](#)
[![Made with CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white)](#)
[![Vanilla JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=flat-square&logo=javascript&logoColor=black)](#)
[![No Frameworks](https://img.shields.io/badge/frameworks-none-success?style=flat-square)](#)
[![Tax Year](https://img.shields.io/badge/FY-2026--27%20(AY%202027--28)-4B3FD6?style=flat-square)](#)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)](#contributing)

[Live Demo](#) · [Report Bug](../../issues) · [Request Feature](../../issues)

</div>

---


## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Folder Structure](#folder-structure)
- [How the Calculation Works](#how-the-calculation-works)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)
- [Author](#author)

---

## Overview

Most salary calculators show a number with no explanation. **Vetan** is designed
to be trustworthy first: every figure on the dashboard has an information
tooltip explaining exactly how it was derived, using the latest Government of
India income tax slabs for **FY 2026-27 (AY 2027-28)**, under both the **Old**
and **New** tax regimes.

The interface is styled as a modern fintech dashboard — a "salary slip" input
panel on the left, a live results dashboard with charts on the right — with
full dark/light theming, glassmorphism, and micro-interactions. No React, no
build step, no `node_modules`. Open `index.html` and it runs.

---

## Features

<details open>
<summary><strong>💰 Core calculator</strong></summary>

- Switch between **Annual CTC** and **Monthly Gross Salary** entry
- Employment type (Private / Government / Contract / Freelancer)
- State selector driving **Professional Tax**
- **Old vs New tax regime** toggle, calculated independently and instantly comparable
- Configurable Basic %, LTA %, bonus, medical/transport/food allowances, other allowances
- Toggle Employee PF, Gratuity, Professional Tax, and ESI on or off
- Voluntary NPS, insurance premium, Section 80C and other deductions (Old Regime)
- Real-time Indian-format currency inputs (₹12,00,000) with in-words display and validation
</details>

<details>
<summary><strong>🧮 Calculation engine</strong></summary>

Fully modular, independent functions for every step: `calculateBasicSalary`,
`calculateHRA`, `calculateLTA`, `calculatePF`, `calculateGratuity`,
`calculateProfessionalTax`, `calculateESI`, `calculateSlabTax`,
`calculateIncomeTax` (with Section 87A rebate + marginal relief + surcharge),
`calculateTaxableIncome`, `calculateGrossSalary`, `calculateTotalDeductions`,
`calculateAnnualInHand`, `calculateMonthlySalary`, `calculateEffectiveTaxRate`,
`calculateTakeHomePercentage`.

Tax slabs and limits live in a single frozen `TAX_CONFIG` object so future
Budget updates mean editing one place, not hunting through logic.
</details>

<details>
<summary><strong>📊 Output dashboard</strong></summary>

- Full card grid: CTC, Gross, Basic, HRA, PF (employer + employee), Gratuity,
  Professional Tax, ESI, Income Tax, Total Deductions, Annual/Monthly In-Hand,
  Effective Tax Rate, Take-Home %
- Employer Cost Breakdown and Employee Deduction Breakdown ledgers
- Every metric has a hover/focus tooltip explaining the calculation
</details>

<details>
<summary><strong>📈 Interactive charts (Chart.js)</strong></summary>

- Salary breakdown doughnut chart
- Deductions pie chart
- Monthly Gross vs Deductions vs In-Hand bar chart
- Tax-by-slab horizontal bar chart
</details>

<details>
<summary><strong>🛠️ Smart tools</strong></summary>

- **Offer Comparison** — compare two CTC offers on real in-hand pay, not headline numbers
- **Salary Hike Calculator** — see the actual in-hand impact of a hike %, not just the CTC delta
- **Tax Saving Suggestions** — dynamic 80C / 80D / NPS / HRA / home-loan / education-loan tips based on your inputs
- **Salary slip export** — Print, download as PDF (via jsPDF), or share a summary
</details>

<details>
<summary><strong>🕘 History</strong></summary>

- Every calculation is auto-saved to `localStorage`
- Search, sort (newest/oldest/CTC high–low), recalculate, edit, or delete past entries
</details>

<details>
<summary><strong>🎨 Design & accessibility</strong></summary>

- Dark mode and light mode, remembered across visits
- Glassmorphism cards, soft shadows, rounded corners, smooth transitions
- Button ripple, card hover lift, animated counters, animated charts
- Fully responsive: mobile, tablet, and desktop layouts
- Keyboard-navigable, visible focus states, ARIA labels, semantic HTML
- Respects `prefers-reduced-motion`
</details>

---

## Tech Stack

| Layer | Technology |
|---|---|
| Markup | HTML5 (semantic, ARIA-labelled) |
| Styling | CSS3 — custom properties, `color-mix()`, grid/flexbox, glassmorphism, print styles |
| Logic | Vanilla JavaScript ES6+ — arrow functions, template literals, modular functions |
| Charts | [Chart.js](https://www.chartjs.org/) (via CDN) |
| PDF export | [jsPDF](https://github.com/parallax/jsPDF) (via CDN) |
| Storage | Browser `localStorage` (calculation history & theme preference) |

No package manager, no bundler, no framework — by design.

---

## Getting Started

### Prerequisites
Just a modern browser and (for charts/PDF export) an internet connection, since
Chart.js and jsPDF load from `cdnjs.cloudflare.com`.

### Installation

```bash
git clone https://github.com/vidhan-tr/vetan-salary-calculator.git
cd vetan
```

### Running it

Open `index.html` directly in a browser, or serve it locally so relative paths
behave exactly as they would in production:

```bash
npx serve .
# or
python3 -m http.server 8000
```

Then visit `http://localhost:PORT` in your browser.

---

## Folder Structure

```
vetan-salary-calculator/
├── index.html      # Markup: input panel, results dashboard, history drawer
├── style.css        # Design tokens, layout, themes, animations, responsive rules
├── script.js        # Tax config, calculation engine, rendering, charts, tools
├── assets/          # Icons, screenshots, and other static assets
└── README.md
```

---

## How the Calculation Works

1. **Basic Salary** = Basic % × Annual CTC
2. **HRA** = 50% of Basic (metro) or 40% of Basic (non-metro)
3. **LTA** = LTA % × Annual CTC
4. **Employer PF** = 12% of Basic (employer cost, not deducted from pay)
5. **Employee PF** = 12% of Basic (deducted from pay, optional toggle)
6. **Gratuity** = 4.81% of Basic (employer cost, optional toggle)
7. **Special Allowance** = remaining CTC after all fixed components
8. **Gross Salary** = Basic + HRA + LTA + Special Allowance + Bonus + Allowances
9. **Taxable Income** = Gross − Standard Deduction − (Old Regime: HRA exemption, Professional Tax, 80C, 80D, 80CCD(1B))
10. **Income Tax** = slab-wise tax → Section 87A rebate with marginal relief → surcharge → 4% Health & Education Cess
11. **Annual In-Hand** = Gross Salary − (Employee PF + Professional Tax + ESI + Income Tax + Other Deductions)
12. **Monthly In-Hand** = Annual In-Hand ÷ 12

All tax slabs, standard deduction amounts, and rebate thresholds are defined
once in the `TAX_CONFIG` object in `script.js` for FY 2026-27 (AY 2027-28), so
updating them for a future Budget is a single, well-contained edit.

> **Disclaimer:** This tool provides estimates for informational purposes only
> and is not a substitute for professional tax advice. Professional Tax is
> approximated using common state maximums rather than exact monthly slabs.

---

## Roadmap

- [ ] AI-assisted salary prediction based on role, experience, and location
- [ ] Resume analyzer and offer-letter analyzer
- [ ] Salary negotiation tips engine
- [ ] Crowd-sourced company salary database
- [ ] GST calculator
- [ ] EMI calculator
- [ ] Investment & retirement planner
- [ ] Income Tax Return (ITR) estimator

See the [open issues](../../issues) for a full list of proposed features.

---

## Contributing

Contributions make the open-source community a great place to learn and build.
Any contribution you make is **greatly appreciated**.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please keep the "no frameworks" philosophy intact — this project is meant to
demonstrate strong fundamentals in HTML, CSS, and vanilla JavaScript.

---

## License

Distributed under the MIT License. See `LICENSE` for more information.

---

## Author

Built as a portfolio-grade FinTech engineering project demonstrating tax
calculation logic, financial UI/UX design, and vanilla JavaScript architecture
without frameworks.

<div align="center">

If this project helped you, consider giving it a ⭐ on GitHub!

</div>
