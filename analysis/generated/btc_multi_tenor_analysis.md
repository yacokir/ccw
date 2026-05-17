# BTC Multi-Tenor Analysis

Generated: 2026-05-17T16:41:14.622Z

## Executive Summary

- Rows analyzed: 17; primary comparable rows: 16.
- Best overall tenor: weekly leads on average total return across comparable full-period variants.
- Best full-period total return: weekly otm10.
- BTC comparison: weekly otm10 ranks best versus BTC buy-and-hold by excess return. Most variants still trail BTC in total return during this BTC bull-heavy sample.
- Risk limitation: Drawdown, Sharpe, Sortino, rolling volatility, and worst-cycle metrics remain null because this layer reads consolidated summaries only, not per-run equity curves or trades.

## Tenor Summary

| tenor | variantCount | averageTotalReturnPct | averageCagrPct | averageObservedOptionCoveragePct | averageFallbackPenaltyProxy | bestTotalReturnVariant |
| --- | --- | --- | --- | --- | --- | --- |
| weekly | 6 | 827.305818 | 41.128528 | 72 | 28.410256 | otm10 |
| 14d | 5 | 611.912972 | 35.488245 | 74.433544 | 25.941456 | otm10 |
| monthly | 5 | 432.180976 | 29.812288 | 100 | 0.789473 | otm10 |

## Ranking Leaders

| ranking | leader | value |
| --- | --- | --- |
| best_total_return | weekly otm10 | 1109.021386 |
| best_cagr | weekly otm10 | 48.118556 |
| best_excess_vs_btc | weekly otm10 | 261.53757 |
| best_premium_efficiency | weekly otm03 | 73.316884 |
| best_option_coverage | monthly atm00 | 100 |
| best_return_adjusted_by_fallback_usage | weekly otm10 | 788.258277 |

## Best Moneyness Per Tenor

| tenor | moneyness_label | totalReturnPct | cagrPct | excessReturnVsBtcPct |
| --- | --- | --- | --- | --- |
| 14d | otm10 | 903.671998 | 43.678562 | 8.51744 |
| monthly | otm10 | 562.722051 | 34.571956 | -421.769853 |
| weekly | otm10 | 1109.021386 | 48.118556 | 261.53757 |

## Interpretations

- Premium vs upside tradeoff: weekly otm03 has the strongest net call-PnL density, while weekly otm10 best captures upside in total-return terms. Negative premium density means the short call leg was a net drag after settlements.
- Rebalance frequency impact: cycles_per_year exposes remarking frequency: weekly variants rebalance most often, 14d variants sit in the middle, and monthly variants remark least often. In this sample, lower frequency improved option coverage but did not automatically beat the best upside-preserving 14d/weekly variants.
- Liquidity/fallback effects: monthly atm00 has the highest observed option coverage. Fallback-adjusted rankings penalize theoretical and settlement fallback usage through fallback_penalty_proxy.
- Comparison versus BTC buy-and-hold: weekly otm10 ranks best versus BTC buy-and-hold by excess return. Most variants still trail BTC in total return during this BTC bull-heavy sample.

## Validation

- Date consistency issues: 0
- Detected inconsistencies: 0
- Warnings: 1

- No blocking inconsistencies detected.

## Future-Compatible Analytics

- Real drawdown analytics: read each run equity curve and compute peak-to-trough drawdown.
- Rolling volatility: calculate rolling return windows from equity curves.
- Equity curve analytics: normalize per-run capital paths and chain yearly segments.
- Monte Carlo simulations: resample cycle returns once per-cycle returns are loaded.
- Regime analysis: tag cycles by BTC trend, realized volatility, and drawdown regime.
