# BTC Phase 1 Findings

## 1. Executive Summary

BTC Phase 1 moved the CCW project from exploratory backtesting toward a structured multi-layer research framework. The current evidence shows that tenor selection is a first-order variable for BTC covered-call behavior.

The strongest observed total-return configuration in the generated full-period comparison is weekly OTM10. Weekly variants lead average total return and average CAGR across comparable full-period rows, while 14d behaves as an intermediate tenor and monthly lags on total return despite stronger observed option coverage.

Risk conclusions are more nuanced. The deep-risk and rolling layers show that cycle-based volatility, drawdown pressure, and rolling-window persistence differ by tenor. These metrics are not yet annualized or fully normalized across tenors, so they should support interpretation rather than final risk-adjusted ranking.

## 2. Research Scope

Phase 1 covers BTC covered-call configurations across:

- weekly, 14d, and monthly tenors
- ATM, OTM, and ITM moneyness variants where available
- full-period and partial-period rows, with primary conclusions based on full-period comparable rows
- summary-level performance, reconstructed equity risk, rolling-risk behavior, regime behavior, and static visualizations

The scope is BTC only. ETH replication is a future phase.

## 3. Methodology Summary

The research stack uses saved generated outputs rather than rerunning backtests:

- Multi-tenor analysis reads consolidated batch summaries.
- Deep-risk analysis reconstructs normalized equity from saved annual run `trades.csv` files.
- Rolling-risk analysis builds tenor-aware rolling windows from realized cycle returns.
- Regime analysis assigns cycles to fixed calendar regimes by `entry_date`.
- Visualization charts render existing generated analysis outputs.

Current primary rolling windows approximate one year: weekly 52 cycles, 14d 26 cycles, monthly 12 cycles. Current visual rolling lines are monthly-bucketed averages by tenor for readability; the source rolling data remains unchanged.

## 4. Main Findings

### Observations

Weekly dominates the current full-period return comparison. The generated multi-tenor analysis reports weekly as the best overall tenor by average total return across comparable full-period variants.

Tenor-level summary from the generated multi-tenor analysis:

| Tenor | Average total return | Average CAGR | Average observed option coverage | Best variant |
| --- | ---: | ---: | ---: | --- |
| weekly | 827.305818% | 41.128528% | 72.000000% | OTM10 |
| 14d | 611.912972% | 35.488245% | 74.433544% | OTM10 |
| monthly | 432.180976% | 29.812288% | 100.000000% | OTM10 |

The best full-period total-return row is weekly OTM10 at 1109.021386% total return and 48.118556% CAGR. Weekly OTM10 also leads excess return versus BTC in the generated ranking layer.

The best moneyness per tenor is OTM10 in the current generated output:

| Tenor | Best moneyness | Total return | CAGR | Excess return vs BTC |
| --- | --- | ---: | ---: | ---: |
| weekly | OTM10 | 1109.021386% | 48.118556% | 261.537570% |
| 14d | OTM10 | 903.671998% | 43.678562% | 8.517440% |
| monthly | OTM10 | 562.722051% | 34.571956% | -421.769853% |

### Interpretations

The current results suggest that BTC covered-call performance is highly sensitive to repricing frequency. Weekly resets appear to help the strategy re-anchor strikes after large BTC moves, especially in a bull-heavy sample.

Wider OTM strikes appear to preserve more upside participation than tighter strikes. In this phase, OTM10 leads total return in every tenor, while weekly OTM03 is stronger on premium-efficiency style ranking but does not lead total return.

### Hypotheses

The monthly underperformance may reflect stale-strike exposure. Longer cap duration can hurt a covered-call strategy when BTC rallies quickly, even when option coverage is better.

The 14d tenor may represent an intermediate repricing regime. It does not dominate the return frontier, but it often sits between weekly and monthly in rolling behavior.

These are hypotheses, not causal proof. They require further validation through normalized risk metrics, annualized comparisons, and future cross-asset replication.

## 5. Tenor Frontier Interpretation

The current frontier is return-led rather than final risk-adjusted. Weekly OTM10 is the primary total-return leader, and weekly OTM05 is also strong. The 14d OTM10 row is meaningful because it slightly exceeds BTC buy-and-hold over its sample while sitting below weekly OTM10. Monthly OTM10 is the best monthly variant but trails both BTC and the shorter-tenor leaders in the current bull-heavy period.

The frontier should be interpreted as:

- weekly: strongest observed return frontier, but not automatically the best risk-adjusted choice
- 14d: intermediate tenor with strong positive rolling-window frequency
- monthly: weaker total-return frontier, better observed option coverage, and lower severe rolling drawdown window frequency in the rolling findings

## 6. Regime Behavior

The generated regime analysis uses fixed calendar regimes and assigns cycles by entry date. Reported leaders are:

- Bull 2020-2021: weekly OTM10 with 450.655861% return
- Bear 2022: weekly ITM05 with 10.702935% return
- Recovery/transition 2023: 14d OTM10 with 105.336397% return
- ETF/bull 2024-2025: weekly OTM10 with 116.249245% return

Observation: weekly OTM10 leads major bull-style regimes in the generated regime layer.

Interpretation: wider weekly calls likely preserved upside while still repricing frequently enough to harvest premium and avoid stale caps.

Hypothesis: defensive moneyness may matter more in adverse regimes, as suggested by weekly ITM05 leading the 2022 bear segment. This needs deeper validation because regime windows, cycle counts, and tenor coverage differ.

## 7. Rolling-Risk Behavior

The rolling findings summary reports:

- weekly has the highest average one-year rolling window return at 58.521227%.
- 14d has the highest positive rolling-window frequency at 82.192147%.
- 14d has the most stable rolling returns by standard deviation of window returns at 52.926731 percentage points.
- weekly has the lowest average rolling volatility at 5.322504 percentage points, using cycle-return volatility.
- monthly has the lowest severe drawdown window frequency at the -20% threshold, at 55.692308%.

These observations are based on overlapping rolling windows. They describe persistence and path behavior, not independent samples.

## 8. Risk-Return Tradeoffs

The current BTC research does not support a single final risk-adjusted winner. Weekly OTM10 is the leading return configuration, but current Sharpe, Sortino, and volatility fields are cycle-based and tenor-dependent. Monthly may show better behavior on some drawdown-frequency measures while still trailing on total return. The 14d tenor shows a useful middle profile, including high positive-window frequency and relatively stable rolling returns.

The practical research conclusion is that weekly OTM10 is the leading return candidate, while 14d and monthly remain important for robustness, drawdown, and implementation sensitivity analysis.

## 9. Key Limitations

- Cycle-based volatility is not annualized.
- Current Sharpe and Sortino are not tenor-normalized.
- Current Sortino uses downside dispersion, not classic downside deviation around a target return.
- Drawdown is end-of-cycle only and does not model intracycle underwater risk.
- Rolling windows overlap.
- Regime assignment by entry date can blur transition periods.
- No fees, slippage, funding, custody, or bid/ask realism is included in the core generated outputs.
- Settlement and option data fallback behavior remain important approximations.
- The BTC sample is bull-heavy, which may favor shorter repricing and wider OTM structures.

## 10. Future Work

- Add annualized and tenor-normalized risk metrics.
- Add classic downside deviation and target-return Sortino variants.
- Extend the stabilized methodology to ETH.
- Build cross-asset BTC/ETH comparison.
- Improve visualization for rolling and distribution analytics.
- Add Monte Carlo analysis using realized cycle-return distributions.
- Study CSP, collars, futures hedging, and other overlays.
- Add intracycle risk modeling and realism layers for fees, slippage, funding, and execution constraints.
