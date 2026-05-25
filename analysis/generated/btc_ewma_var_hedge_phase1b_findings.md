# BTC EWMA/VaR Hedge Phase 1B Findings

Generated: 2026-05-21T09:46:59.509Z

## Scope

- Analysis-only post-processing of existing BTC CCW OTM10 weekly and 14d baseline runs.
- EWMA volatility uses BTC cycle returns, not CCW strategy returns.
- Hedge ratio is calculated at cycle entry / CCW roll and remains fixed until the next roll.
- No baseline backtests were rerun and no execution logic was changed.

## Methodology

- Lambdas: 0.9, 0.94.
- Risk budgets: 5%, 10%, 15%.
- VaR multiplier: z = 1.65.
- Warm-up: first 12 BTC cycle returns initialize sample variance; no EWMA/VaR hedge is applied during warm-up.
- Hedge ratio: `1 - maxLossBudgetPct / (z * ewmaVol)`, lower-bounded at zero with no hard maximum cap.

## Observations

- weekly: shallowest EWMA/VaR max drawdown is weekly_otm10_ewma094_var10 at -46.933694%.
- weekly: lowest EWMA/VaR ulcer index is weekly_otm10_ewma09_var5 at 12.226338.
- weekly: highest EWMA/VaR CAGR is weekly_otm10_ewma09_var15 at 42.046379%.
- weekly: highest observed hedge ratio is 81.541306% in weekly_otm10_ewma09_var5.
- 14d: shallowest EWMA/VaR max drawdown is 14d_otm10_ewma094_var15 at -45.877646%.
- 14d: lowest EWMA/VaR ulcer index is 14d_otm10_ewma09_var10 at 11.996487.
- 14d: highest EWMA/VaR CAGR is 14d_otm10_ewma094_var15 at 28.069105%.
- 14d: highest observed hedge ratio is 86.477552% in 14d_otm10_ewma09_var5.
- Across all EWMA/VaR variants, hedge ratios above 100% occurred in 0 cycle rows.

## Interpretations

- EWMA/VaR Phase 1B is a cyclical sizing model: it sets the hedge ratio at the CCW roll and holds it fixed until the next roll.
- Lower risk budgets should generally imply more frequent or larger hedges, but the realized benefit depends on whether the volatility estimate rises before or after the damaging BTC move.
- Comparison against fixed h10, h20, and h40 benchmarks should be read as a benchmark test of adaptive sizing, not as a production hedge recommendation.

## Hypotheses

- If EWMA/VaR improves drawdown or ulcer index versus h00 without excessive return drag versus h10/h20, it may justify a funding-aware Phase 2.
- If EWMA/VaR lags major BTC drawdowns, lower lambda values or stressed volatility inputs may need study before considering more complex tail models.
- If no-hard-cap hedge ratios become operationally large, a later version should test explicit hedge caps and margin constraints.

## Limitations

- Normal VaR likely underestimates BTC tail risk and should be treated as a transparent first-pass sizing tool only.
- EWMA/VaR is a sizing model, not a guarantee that realized cycle losses stay within the selected risk budget.
- Funding, basis, liquidation, margin, collateral, slippage, and stressed liquidity are not modeled.
- The hedge has no intracycle adjustment and no emergency hedge behavior.
- There is no hard hedge cap in this version; hedge ratios above 100%, if observed, are diagnostic outputs rather than automatically valid live trading behavior.
