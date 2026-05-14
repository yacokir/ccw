# Weekly BTC Baseline Closure Plan

## Purpose

This document defines the remaining work required to consider the BTC weekly covered call baseline sufficiently consolidated before expanding the project into additional dimensions such as:

- new tenors
- new assets
- hedge architectures
- advanced realism layers

The primary objective is to fully understand the behavior, robustness, and execution-adjusted characteristics of the current baseline before increasing system complexity.

---

# 1. Current Baseline State

## Strategy

Current baseline strategy:

- BTC covered call
- weekly cycle
- period: 2020–2026

---

## Implemented Moneyness Variants

Completed variants:

- itm05
- atm00
- otm03
- otm05
- otm07
- otm10

---

## Implemented Execution Friction Models

### Uniform Friction Model

Applies a constant premium haircut across all trades.

### Moneyness-Dependent Friction Model

Applies differentiated premium haircuts depending on strike moneyness.

---

## Structural Migrations Completed

Completed:

- run naming migration
- analysis folder migration
- friction analysis organization
- standardized batch structure

---

# 2. Existing Outputs

Current outputs include:

- raw strategy outputs
- execution friction summaries
- batch analysis outputs
- strike-level results
- moneyness-adjusted comparisons

Current structure:

```text
runs/batches/<batch_name>/analysis/execution_friction/
```

Including:

```text
uniform/
moneyness/
```

Current outputs:

```text
execution_friction_uniform_summary.*
execution_friction_moneyness_summary.*
```

---

# 3. Required Work to Close the Weekly BTC Baseline

The following sections define the mandatory work required before considering the BTC weekly baseline consolidated.

---

# 3.1 Baseline Comparison Layer

## Objective

Create a consolidated comparison framework across:

- raw
- uniform friction
- moneyness friction

for all BTC weekly strike variants.

---

## Planned Script

```text
src/scripts/build_weekly_baseline_comparison.js
```

---

## Target Metrics

### Performance

- total return
- annual return
- CAGR maybe
- degradation vs raw

### Execution

- applied average haircut
- premium haircut impact
- adjusted capital
- execution-adjusted return

### Trade Activity

- trade count
- assignment frequency maybe
- participation consistency

### Premium Dependence

- average premium
- premium contribution
- premium sensitivity

---

## Planned Outputs

```text
docs/analysis/generated/weekly_btc_baseline_comparison.csv
docs/analysis/generated/weekly_btc_baseline_comparison.json
docs/analysis/generated/weekly_btc_baseline_comparison.md
```

---

# 3.2 Initial Risk Layer

## Objective

Add an initial risk analysis framework for the weekly BTC baseline.

---

## Planned Script

```text
src/scripts/build_weekly_baseline_risk.js
```

---

## Required Metrics

### Core Risk

- max drawdown
- equity curve
- rolling returns
- return volatility

### Optional / Secondary

- downside deviation
- ulcer index
- CVaR

Optional metrics should not block baseline closure.

---

## Planned Outputs

```text
docs/analysis/generated/weekly_btc_risk_summary.csv
docs/analysis/generated/weekly_btc_risk_summary.json
docs/analysis/generated/weekly_btc_risk_summary.md
```

---

# 3.3 Qualitative Strategy Interpretation

## Objective

Produce a qualitative interpretation layer on top of the quantitative outputs.

The goal is not only to measure returns, but to understand which strike structures appear more robust and realistically executable.

---

## Planned Report

```text
docs/analysis/weekly_btc_baseline_report.md
```

---

## Core Questions

### Friction Robustness

- Which strike survives friction best?
- Which strike degrades least?
- Which strike is most execution-sensitive?

### Premium Dependence

- Which strike depends most on premium?
- Which strike behaves more directionally?

### Structural Robustness

- Which strike appears most robust overall?
- Does farther OTM actually improve execution-adjusted robustness?
- Is ITM carry sufficiently compensated?

### Execution Realism

- Which strike appears most realistically executable?
- Which strike appears least dependent on idealized fills?

---

# 4. Official Metrics for Weekly BTC Baseline

The following metrics become part of the official baseline comparison framework.

---

## Performance Metrics

- total return
- annual return
- CAGR maybe
- execution-adjusted return

---

## Risk Metrics

- max drawdown
- rolling returns
- volatility
- downside volatility maybe

---

## Execution Metrics

- average premium haircut
- degradation vs raw
- adjusted capital impact

---

## Activity Metrics

- trade count
- participation consistency
- assignment frequency maybe

---

# 5. Closure Criteria

The weekly BTC baseline is considered consolidated when all items below are completed.

---

## Mandatory Checklist

```text
[ ] Consolidated comparison layer completed
[ ] Risk layer completed
[ ] Friction-adjusted comparisons completed
[ ] Official outputs generated
[ ] Methodology documented
[ ] Qualitative interpretation report completed
[ ] Reproducible scripts finalized
```

---

# 6. Explicit Non-Goals for This Phase

The following items are intentionally excluded from the weekly BTC baseline closure scope.

These items belong to future research phases and should not delay baseline consolidation.

---

## Not Required for Baseline Closure

### Tenor Expansion

- 2-week cycles
- monthly cycles

### Asset Expansion

- ETH
- SOL
- XRP

### Advanced Execution Modeling

- tenor-dependent friction
- volatility-dependent friction
- liquidity-aware friction
- observed bid/ask snapshots
- order-book depth modeling
- partial fill assumptions

### Settlement Refinement

- official Deribit TWAP settlement
- delivery price datasets

### Realism Layer

- actual spot BTC ownership modeling
- BTC yield deployment
- premium reinvestment
- fees
- custody constraints
- operational constraints
- collateral realism

### Hedge Architecture

- collars
- futures overlays
- regime hedging
- covered put writer
- semi-fixed USD income overlays

---

# 7. Post-Baseline Roadmap

After weekly BTC baseline consolidation, future phases may include the following expansions.

---

# Phase 2 — Tenor Expansion

Planned:

- 2-week cycles
- monthly cycles

Comparison dimensions:

- return
- drawdown
- volatility
- turnover
- premium yield
- settlement behavior

---

# Phase 3 — Asset Expansion

Planned order:

1. ETH
2. SOL
3. XRP

Selection criteria:

- liquidity quality
- options availability
- spread quality
- execution realism

---

# Phase 4 — Execution Realism Expansion

Possible future additions:

- tenor-dependent friction
- volatility-dependent friction
- bid/ask modeling
- liquidity-aware friction
- volume/open-interest adjustments
- partial fill assumptions

---

# Phase 5 — Settlement Refinement

Current simplification:

```text
08:00 UTC candle open proxy
```

Future refinement:

- official Deribit delivery price
- TWAP settlement methodology
- delivery price datasets

---

# Phase 6 — Realism Layer

Planned future additions:

- actual spot BTC ownership
- BTC carry/yield deployment
- premium reinvestment
- fees
- custody/exchange modeling
- cash balance management
- collateral realism

---

# Phase 7 — Hedge Architecture

Potential future research:

- collars
- dynamic futures hedges
- regime-based hedging
- covered put writer
- semi-fixed USD income overlays

---

# 8. General Research Principle

Current priority:

Fully understand the weekly BTC baseline before introducing excessive dimensional complexity.

Avoid premature combinatorial explosion across:

- assets
- tenors
- moneyness
- hedge structures
- execution models
- realism layers

The baseline should first become:

- reproducible
- interpretable
- comparable
- risk-aware
- execution-aware

before broader system expansion.