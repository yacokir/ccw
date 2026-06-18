# Partial Hedge Simulation v0.2 Grid

Generated: 2026-06-18T08:37:56.329Z

## Scope

- Strategy: BTC Weekly OTM05.
- Period: Daily Approximate MTM multi-year artifacts, 2020-2025.
- Monitoring input: Passive Hedge Monitoring v0.4b recommended signals.
- Classification: research-grade only.
- No new Daily MTM, no backtests, no funding, no basis, no slippage, no margin, no liquidity, and no collateral modeling.

## Methodology

The simulation preserves the v0.1 timing convention: the `alert_state` from the previous valid Daily MTM observation is applied to the next valid daily return.

Formula:

```text
hedged_daily_return = unhedged_daily_return * (1 - hedge_ratio)
```

When `return_sacrificed <= 0`, the result is marked as `return improved` and protection efficiency is not forced into an artificial ratio.

## Baseline Unhedged

| validReturnDays | totalReturnPct | CAGRpct | maxDrawdownPct | volatilityPct | historicalVaRPct | ewmaMaxPct |
| --- | --- | --- | --- | --- | --- | --- |
| 1480 | 51.442572 | 7.194406 | -80.891376 | 2.909341 | -4.180938 | 7.713906 |

## Grid Summary

| configId | totalReturnPct | CAGRpct | maxDrawdownPct | volatilityPct | historicalVaRPct | pctDaysHedged | averageHedgeRatioPct | returnSacrificedPct | returnEffect | drawdownReductionPctPoints | varReductionPctPoints | paretoCandidate |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| stress10_crisis40 | 63.387472 | 8.565335 | -79.120422 | 2.791555 | -3.990281 | 20.135135 | 2.358108 | -11.9449 | return improved | 1.770953 | 0.190657 | false |
| stress10_crisis50 | 61.707153 | 8.377634 | -79.335153 | 2.78522 | -3.990281 | 20.135135 | 2.472973 | -10.264581 | return improved | 1.556222 | 0.190657 | false |
| stress10_crisis60 | 59.969936 | 8.181862 | -79.557155 | 2.78003 | -3.990281 | 20.135135 | 2.587838 | -8.527365 | return improved | 1.33422 | 0.190657 | false |
| stress20_crisis40 | 82.173827 | 10.561354 | -76.40412 | 2.715878 | -3.964381 | 20.135135 | 4.256757 | -30.731255 | return improved | 4.487256 | 0.216557 | false |
| stress20_crisis50 | 80.300304 | 10.370202 | -76.646786 | 2.709368 | -3.964381 | 20.135135 | 4.371622 | -28.857733 | return improved | 4.24459 | 0.216557 | false |
| stress20_crisis60 | 78.363342 | 10.17083 | -76.897669 | 2.704033 | -3.964381 | 20.135135 | 4.486486 | -26.92077 | return improved | 3.993707 | 0.216557 | false |
| stress25_crisis40 | 92.088228 | 11.546473 | -74.944893 | 2.680659 | -3.797859 | 20.135135 | 5.206081 | -40.645657 | return improved | 5.946483 | 0.383079 | false |
| stress25_crisis50 | 90.112743 | 11.353618 | -75.202566 | 2.674064 | -3.797859 | 20.135135 | 5.320946 | -38.670172 | return improved | 5.688809 | 0.383079 | false |
| stress25_crisis60 | 88.070366 | 11.15247 | -75.468964 | 2.66866 | -3.797859 | 20.135135 | 5.435811 | -36.627795 | return improved | 5.422411 | 0.383079 | false |
| stress30_crisis40 | 102.350973 | 12.522577 | -73.415592 | 2.64728 | -3.764845 | 20.135135 | 6.155405 | -50.908402 | return improved | 7.475784 | 0.416094 | true |
| stress30_crisis50 | 100.269944 | 12.328034 | -73.688992 | 2.640602 | -3.764845 | 20.135135 | 6.27027 | -48.827372 | return improved | 7.202383 | 0.416094 | true |
| stress30_crisis60 | 98.118448 | 12.125126 | -73.971651 | 2.635131 | -3.764845 | 20.135135 | 6.385135 | -46.675876 | return improved | 6.919725 | 0.416094 | true |

## Rankings

| ranking | rank | configId | metricValue | totalReturnPct | maxDrawdownPct | historicalVaRPct | volatilityPct | returnEffect | paretoCandidate |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| best_total_return | 1 | stress30_crisis40 | 102.350973 | 102.350973 | -73.415592 | -3.764845 | 2.64728 | return improved | true |
| best_total_return | 2 | stress30_crisis50 | 100.269944 | 100.269944 | -73.688992 | -3.764845 | 2.640602 | return improved | true |
| best_total_return | 3 | stress30_crisis60 | 98.118448 | 98.118448 | -73.971651 | -3.764845 | 2.635131 | return improved | true |
| best_total_return | 4 | stress25_crisis40 | 92.088228 | 92.088228 | -74.944893 | -3.797859 | 2.680659 | return improved | false |
| best_total_return | 5 | stress25_crisis50 | 90.112743 | 90.112743 | -75.202566 | -3.797859 | 2.674064 | return improved | false |
| best_max_drawdown | 1 | stress30_crisis40 | -73.415592 | 102.350973 | -73.415592 | -3.764845 | 2.64728 | return improved | true |
| best_max_drawdown | 2 | stress30_crisis50 | -73.688992 | 100.269944 | -73.688992 | -3.764845 | 2.640602 | return improved | true |
| best_max_drawdown | 3 | stress30_crisis60 | -73.971651 | 98.118448 | -73.971651 | -3.764845 | 2.635131 | return improved | true |
| best_max_drawdown | 4 | stress25_crisis40 | -74.944893 | 92.088228 | -74.944893 | -3.797859 | 2.680659 | return improved | false |
| best_max_drawdown | 5 | stress25_crisis50 | -75.202566 | 90.112743 | -75.202566 | -3.797859 | 2.674064 | return improved | false |
| best_historical_var | 1 | stress30_crisis40 | -3.764845 | 102.350973 | -73.415592 | -3.764845 | 2.64728 | return improved | true |
| best_historical_var | 2 | stress30_crisis50 | -3.764845 | 100.269944 | -73.688992 | -3.764845 | 2.640602 | return improved | true |
| best_historical_var | 3 | stress30_crisis60 | -3.764845 | 98.118448 | -73.971651 | -3.764845 | 2.635131 | return improved | true |
| best_historical_var | 4 | stress25_crisis40 | -3.797859 | 92.088228 | -74.944893 | -3.797859 | 2.680659 | return improved | false |
| best_historical_var | 5 | stress25_crisis50 | -3.797859 | 90.112743 | -75.202566 | -3.797859 | 2.674064 | return improved | false |
| pareto_candidates | 1 | stress30_crisis40 | 102.350973 | 102.350973 | -73.415592 | -3.764845 | 2.64728 | return improved | true |
| pareto_candidates | 2 | stress30_crisis50 | 100.269944 | 100.269944 | -73.688992 | -3.764845 | 2.640602 | return improved | true |
| pareto_candidates | 3 | stress30_crisis60 | 98.118448 | 98.118448 | -73.971651 | -3.764845 | 2.635131 | return improved | true |

## Pareto Candidates

| configId | totalReturnPct | maxDrawdownPct | volatilityPct | historicalVaRPct | returnEffect |
| --- | --- | --- | --- | --- | --- |
| stress30_crisis40 | 102.350973 | -73.415592 | 2.64728 | -3.764845 | return improved |
| stress30_crisis50 | 100.269944 | -73.688992 | 2.640602 | -3.764845 | return improved |
| stress30_crisis60 | 98.118448 | -73.971651 | 2.635131 | -3.764845 | return improved |

## Main Findings

- v0.1 reference configuration stress25_crisis50 returned 90.112743% with max drawdown -75.202566% and VaR -3.797859%.
- Best total return: stress30_crisis40 at 102.350973%.
- Best max drawdown: stress30_crisis40 at -73.415592%.
- Best historical VaR: stress30_crisis40 at -3.764845%.
- All grid configurations marked return improved: true.
- Crisis intensity monotonicity by stress slice: false.
- Pareto candidate count: 3.

## Yearly Best Return Configurations

| year | regime | configId | totalReturnPct | maxDrawdownPct | historicalVaRPct | pctDaysHedged | averageHedgeRatioPct | returnEffect |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2020 | Bull market | stress10_crisis40 | 51.739804 | -53.911913 | -2.834669 | 12.598425 | 1.259843 | return sacrificed |
| 2021 | Bull market | stress30_crisis40 | -15.954628 | -48.344107 | -6.418077 | 30.364372 | 9.797571 | return improved |
| 2022 | Bear market | stress30_crisis40 | -55.594866 | -58.214571 | -3.995636 | 65.833333 | 19.75 | return improved |
| 2023 | Recovery | stress10_crisis40 | 109.602398 | -18.240579 | -2.762413 | 0 | 0 | return improved |
| 2024 | ETF/Bull | stress10_crisis40 | 95.103561 | -15.374203 | -3.681167 | 0.416667 | 0.041667 | return sacrificed |
| 2025 | Mixed | stress10_crisis40 | -10.179753 | -28.715172 | -2.795671 | 12.698413 | 1.269841 | return sacrificed |

## Interpretation

- The preliminary economic value does not appear to depend only on the v0.1 stress25/crisis50 setting.
- Higher stress intensity generally increases protection in the stressed years but can modestly reduce return in calmer years.
- Because this model uses proportional exposure reduction, results should be interpreted as a robustness screen rather than hedge economics.
- The next step should test realistic hedge PnL with funding, basis, slippage, margin, liquidity, and collateral assumptions before any operational conclusion.
