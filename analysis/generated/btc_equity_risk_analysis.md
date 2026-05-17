# BTC Equity Risk Analysis

Generated: 2026-05-17T16:36:14.953Z

## Methodology

- Each batch configuration is reconstructed by reading saved annual run `trades.csv` files from `summary.json` metadata.
- Cycle return is `return_pct` from `trades.csv`; if absent, it is `capital_after / capital_before - 1`.
- Normalized equity starts at 1.0 and compounds sequential cycle returns in chronological order.
- Drawdown is `equity / running_peak - 1`, reported in percent as a negative value.
- `ulcerIndex` is the square root of the mean squared drawdown percentages.
- `SharpeSimple` is average cycle return divided by sample standard deviation of cycle returns, with no risk-free rate and no annualization.
- `SortinoSimple` is average cycle return divided by sample standard deviation of negative cycle returns.
- Metrics remain null when the denominator or required source data is unavailable.

## Limitations

- This layer uses realized cycle-to-cycle returns, not intracycle mark-to-market paths.
- Drawdowns are end-of-cycle drawdowns and may understate intracycle underwater risk.
- Partial-period rows are included for traceability but flagged outside primary comparisons.
