# BTC Rolling-Risk Findings Summary

Generated: 2026-05-17T23:43:02.686Z

## Findings

- weekly (58.521227%) has the highest average one-year rolling window return across tenor averages.
- 14d (82.192147%) has the highest positive rolling-window frequency across tenor averages.
- 14d (52.926731 pp) has the most stable rolling returns by standard deviation of window returns.
- weekly (1.26867 pp) has the most stable rolling volatility path by standard deviation of rolling volatility.
- 14d (10.846751 pp) has the most stable rolling drawdown path by standard deviation of rolling drawdown.
- weekly (5.322504 pp) has the lowest average rolling volatility, using cycle-return percentage point volatility.
- monthly (55.692308%) has the lowest severe-drawdown window frequency at the -20% rolling drawdown threshold.
- monthly (91.428572%) has the largest share of top-decile volatility windows ending in the 2022 bear regime.
- The summary-level total-return leader remains weekly otm10, while the simple cycle Sharpe leader is monthly atm00.

## Tenor Summary

| tenor | windowCycles | averageWindowReturnPct | positiveWindowPct | averageRollingVolatilityPct | stdevRollingVolatilityPct | averageRollingDrawdownPct | worstRollingDrawdownPct | severeDrawdownWindowPct |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 14d | 26 | 53.162989 | 82.192147 | 7.306175 | 1.738328 | -26.103196 | -45.935641 | 69.157338 |
| monthly | 12 | 43.754554 | 78.153846 | 9.604581 | 2.564749 | -22.753582 | -56.811391 | 55.692308 |
| weekly | 52 | 58.521227 | 80.656934 | 5.322504 | 1.26867 | -26.911098 | -58.394092 | 65.450121 |

## Hypotheses

- Weekly return dominance appears tied to stronger rolling upside participation, but the rolling layer suggests that dominance comes with more unstable drawdown behavior than lower-frequency tenors.
- 14d behaves like an intermediate repricing regime in several rolling measures, sitting between weekly and monthly on return, volatility, or drawdown behavior depending on the metric.
- Monthly volatility damping is not universal across all rolling measures and needs annualized normalization before being treated as a risk-adjusted conclusion.

## Regime Behavior

| regime_label | tenor | averageWindowReturnPct | positiveWindowPct | averageRollingVolatilityPct | averageRollingDrawdownPct | severeDrawdownWindowPct |
| --- | --- | --- | --- | --- | --- | --- |
| bear_2022 | 14d | 11.29598 | 61.788618 | 8.863636 | -35.587393 | 100 |
| bear_2022 | monthly | -17.205658 | 30 | 12.933392 | -39.520269 | 100 |
| bear_2022 | weekly | 20.602774 | 64.705882 | 6.555463 | -38.46264 | 97.712418 |
| bull_2020_2021 | 14d | 121.941016 | 100 | 8.935692 | -29.341869 | 84.615385 |
| bull_2020_2021 | monthly | 119.333219 | 100 | 10.449553 | -20.381679 | 66.153846 |
| bull_2020_2021 | weekly | 154.787864 | 100 | 6.727252 | -31.14724 | 87.820513 |
| etf_bull_2024_2025 | 14d | 63.284939 | 99.596774 | 5.874729 | -18.229816 | 48.387097 |
| etf_bull_2024_2025 | monthly | 54.743461 | 100 | 7.660277 | -13.81771 | 27.5 |
| etf_bull_2024_2025 | weekly | 63.445936 | 97.222222 | 4.132722 | -17.698501 | 39.705882 |
| recovery_transition_2023 | 14d | 25.75136 | 74.796748 | 6.791466 | -24.689529 | 52.03252 |
| recovery_transition_2023 | monthly | 14.768464 | 65 | 9.626767 | -25.02737 | 45 |
| recovery_transition_2023 | weekly | 11.615056 | 62.091503 | 5.16254 | -26.164181 | 50.980392 |

## Methodology Notes

- Primary rolling comparison uses tenor-aware one-year windows: weekly 52 cycles, 14d 26 cycles, monthly 12 cycles.
- Rolling volatility is the sample standard deviation of cycle return percentages inside a rolling window.
- These volatility metrics are cycle-based, not annualized.
- Current Sharpe and Sortino inputs in the deep-risk layer are tenor-dependent and not annualized.
- Volatility spike analysis uses each configuration's top decile of rolling volatility windows and measures how many end in the 2022 bear regime.
- Severe drawdown windows use a simple -20% rolling drawdown threshold.
- Observations describe measured output behavior; hypotheses are interpretive and should not be treated as causal proof.

## Limitations

- Rolling windows overlap, so persistence metrics describe rolling-window persistence rather than independent samples.
- Window end date is used for regime assignment, which can blur transitions when a window spans two regimes.
- Cycle-volatility values are not directly comparable to annualized volatility until tenor-normalized columns are added.
- The layer is still summary/interpretation only and does not inspect intracycle mark-to-market paths.
