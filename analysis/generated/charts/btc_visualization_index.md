# BTC Visualization Index

Generated static PNG charts from existing BTC analysis outputs.

## Charts

### Total Return By Tenor And Moneyness

- File: [btc_total_return_by_tenor_moneyness.png](./btc_total_return_by_tenor_moneyness.png)
- Represents: Full-period BTC CCW total return from the multi-tenor analysis.
- Interpretation: Higher bars indicate stronger cumulative return; compare moneyness within and across tenors.

### CAGR By Tenor And Moneyness

- File: [btc_cagr_by_tenor_moneyness.png](./btc_cagr_by_tenor_moneyness.png)
- Represents: Full-period compounded annual growth rate from the multi-tenor analysis.
- Interpretation: Higher bars indicate higher annualized return, using summary-level CAGR.

### Max Drawdown By Tenor And Moneyness

- File: [btc_max_drawdown_by_tenor_moneyness.png](./btc_max_drawdown_by_tenor_moneyness.png)
- Represents: Maximum end-of-cycle drawdown magnitude from reconstructed equity.
- Interpretation: Lower bars are better; higher bars indicate deeper peak-to-trough losses.

### Return Vs Max Drawdown Scatter

- File: [btc_return_vs_drawdown_scatter.png](./btc_return_vs_drawdown_scatter.png)
- Represents: Reconstructed total return versus maximum drawdown for each full-period strategy.
- Interpretation: Upper-right is higher return with less negative drawdown; far-left points carry deeper drawdowns.

### Sharpe/Sortino Comparison

- File: [btc_sharpe_sortino_by_strategy.png](./btc_sharpe_sortino_by_strategy.png)
- Represents: Simple per-cycle Sharpe and Sortino values from equity risk analysis.
- Interpretation: Useful as a rough consistency view, but not annualized or tenor-normalized.

### Rolling One-Year Return By Tenor

- File: [btc_rolling_return_by_tenor.png](./btc_rolling_return_by_tenor.png)
- Represents: Monthly-bucketed average rolling one-year return by tenor across full-period moneyness variants.
- Interpretation: Shows persistence and regime dependence of return edge over time.

### Rolling Drawdown By Tenor

- File: [btc_rolling_drawdown_by_tenor.png](./btc_rolling_drawdown_by_tenor.png)
- Represents: Monthly-bucketed average rolling drawdown by tenor across full-period moneyness variants.
- Interpretation: Lower lines indicate deeper rolling drawdown pressure.

### Regime Return Heatmap

- File: [btc_regime_return_heatmap.png](./btc_regime_return_heatmap.png)
- Represents: Average regime return by tenor from regime analysis.
- Interpretation: Greener cells indicate stronger average regime return; redder cells indicate weaker periods.

## Methodology Caveats

- Charts read existing generated analysis outputs only; no backtests or batch runs are executed.
- Rolling charts use one-year tenor-aware windows: weekly 52 cycles, 14d 26 cycles, monthly 12 cycles.
- Rolling chart lines are monthly-bucketed averages by tenor for readability; source analysis data remains unchanged.
- Volatility metrics in the source artifacts are cycle-based and not annualized.
- Current Sharpe/Sortino values are simple per-cycle ratios and are not tenor-normalized.
- Drawdown charts use end-of-cycle reconstructed equity and may understate intracycle risk.
- Regime windows are deterministic calendar regimes used by the analysis layer.

## Distribution Charts

Distribution charts are generated from existing cycle-distribution, regime, and equity-risk artifacts. Metrics are cycle-based and are not annualized.

### Cycle-Return Histogram By Tenor

- File: [btc_distribution_histogram_by_tenor.png](./btc_distribution_histogram_by_tenor.png)
- Represents: Approximate cycle-return histogram frequency by tenor, aggregated from stored histogram bins.
- Interpretation: Compares distribution mass across cycle-return ranges; bins are approximated from existing generated histogram counts.

### Cycle-Return Histogram By Moneyness

- File: [btc_distribution_histogram_by_moneyness.png](./btc_distribution_histogram_by_moneyness.png)
- Represents: Approximate cycle-return histogram frequency by moneyness, aggregated across available tenors.
- Interpretation: Compares how strike distance shifts distribution mass; available moneyness coverage differs by tenor.

### Cycle-Return Percentiles

- File: [btc_distribution_percentiles.png](./btc_distribution_percentiles.png)
- Represents: Tenor-level average p1, p5, p25, median, p75, p95, and p99 cycle-return structure.
- Interpretation: Shows left and right tail shape by tenor; p1 and p99 are estimated from stored histogram bins.

### Skewness And Kurtosis Comparison

- File: [btc_distribution_shape_metrics.png](./btc_distribution_shape_metrics.png)
- Represents: Tenor-level average cycle-return skewness and excess kurtosis.
- Interpretation: Negative skewness indicates left-tail asymmetry; high excess kurtosis indicates fat-tailed cycle returns.

### Tail-Frequency Comparison

- File: [btc_distribution_tail_frequency.png](./btc_distribution_tail_frequency.png)
- Represents: Tenor-level average severe-loss and extreme-upside cycle frequencies.
- Interpretation: Compares how often cycles fall into left-tail or right-tail flags defined by the source distribution artifact.

### Regime-Conditioned Distribution Heatmap

- File: [btc_distribution_regime_heatmap.png](./btc_distribution_regime_heatmap.png)
- Represents: Regime proxy view using average cycle return by tenor and deterministic calendar regime.
- Interpretation: Shows regime-conditioned cycle-return tendency; current regime artifact does not include true regime percentiles/skew/kurtosis.

### Distribution Metric Caveats

- p1 and p99 are estimated from stored histogram bins because the generated distribution artifact does not contain raw cycle returns.
- Histogram charts are approximate aggregations from per-strategy histogram bins.
- Regime-conditioned distribution heatmap uses regime proxy metrics; true regime percentiles, skewness, and kurtosis require per-cycle regime-tagged rows.
- Tail frequencies and concentration metrics are cycle-based and should not be interpreted as annualized risk.

## Hedge Frontier Phase 1 Charts

Hedge Frontier Phase 1 charts are generated from analysis-only fixed hedge post-processing outputs.

- Dedicated index: [btc_hedge_frontier_index.md](./btc_hedge_frontier_index.md)
- Hedge Return Vs Drawdown: [btc_hedge_return_vs_drawdown.png](./btc_hedge_return_vs_drawdown.png)
- CAGR By Hedge Ratio: [btc_hedge_cagr_by_ratio.png](./btc_hedge_cagr_by_ratio.png)
- Max Drawdown By Hedge Ratio: [btc_hedge_max_drawdown_by_ratio.png](./btc_hedge_max_drawdown_by_ratio.png)
- Ulcer Index By Hedge Ratio: [btc_hedge_ulcer_by_ratio.png](./btc_hedge_ulcer_by_ratio.png)
- Rolling Drawdown By Hedge Ratio: [btc_hedge_rolling_drawdown.png](./btc_hedge_rolling_drawdown.png)
- Bear Regime Drawdown Heatmap: [btc_hedge_regime_heatmap.png](./btc_hedge_regime_heatmap.png)

### Hedge Chart Caveats

- These charts do not include funding, basis, liquidation, or margin mechanics.
- Results are fixed-ratio, roll-rebalanced hedge simulations over existing CCW baseline cycles.

## Daily Approximate MTM Risk Charts

Daily risk charts are archived from the BTC weekly OTM10 2025 Daily Approximate MTM prototype only. The POC artifact set is stored under `analysis/generated/poc/daily_mtm_ccw_2025/` to keep it separate from future generalized daily-risk outputs.

- Daily MTM POC summary: [poc_daily_mtm_ccw_2025.md](../poc/daily_mtm_ccw_2025/poc_daily_mtm_ccw_2025.md)
- Daily Risk Distribution Study: [btc_daily_risk_distribution_2025.md](../poc/daily_mtm_ccw_2025/btc_daily_risk_distribution_2025.md)
- Daily Return Histogram: [btc_daily_return_histogram_2025.png](../poc/daily_mtm_ccw_2025/charts/btc_daily_return_histogram_2025.png)
- EWMA Volatility Through Time: [btc_daily_ewma_timeseries_2025.png](../poc/daily_mtm_ccw_2025/charts/btc_daily_ewma_timeseries_2025.png)
- Historical VaR Through Time: [btc_daily_var_timeseries_2025.png](../poc/daily_mtm_ccw_2025/charts/btc_daily_var_timeseries_2025.png)
- Daily Drawdown Curve: [btc_daily_drawdown_curve_2025.png](../poc/daily_mtm_ccw_2025/charts/btc_daily_drawdown_curve_2025.png)
- Tail Event Frequency: [btc_daily_tail_frequency_2025.png](../poc/daily_mtm_ccw_2025/charts/btc_daily_tail_frequency_2025.png)

### Daily MTM Risk Caveats

- Approximate MTM only; option OHLC/trade-price proxies may be imperfect.
- No official historical marks, Greeks, delta-aware hedge, funding, slippage, or margin mechanics are included.
- Scope is BTC weekly OTM10 2025 only; missing synthetic cycles remain excluded from adjacent daily-return calculations.
- The archived POC should remain traceable as a validation slice and should not be overwritten by future generalized daily-risk runs.
