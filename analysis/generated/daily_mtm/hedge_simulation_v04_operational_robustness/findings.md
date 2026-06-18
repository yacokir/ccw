# Partial Hedge Simulation v0.4 Operational Robustness

Generated: 2026-06-18T08:57:25.507Z

## Scope

- Strategy: BTC Weekly OTM05.
- Inputs: existing Daily Approximate MTM, Passive Hedge Monitoring v0.4b, and v03 underlying-overlay methodology.
- No new Daily MTM and no backtests.
- Classification: research-grade only.

## Formula

```text
hedged_daily_return = ccw_daily_return - hedge_ratio * underlying_daily_return
```

Still excluded: funding, basis, slippage, margin, liquidity, collateral, specific hedge instrument, liquidation, and execution constraints.

## Unhedged Baseline

| validReturnDays | totalReturnPct | CAGRpct | maxDrawdownPct | volatilityPct | historicalVaRPct | ewmaMaxPct |
| --- | --- | --- | --- | --- | --- | --- |
| 1480 | 51.442572 | 7.194406 | -80.891376 | 2.909341 | -4.180938 | 7.713906 |

## Scenario Summary

| scenarioId | configId | totalReturnPct | CAGRpct | maxDrawdownPct | volatilityPct | historicalVaRPct | pctDaysHedged | averageHedgeRatioPct | averageActivationDurationDays | returnEffect | drawdownReductionPctPoints | varReductionPctPoints | paretoCandidate |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A_immediate | stress30_crisis40 | 91.849644 | 11.523269 | -74.47765 | 2.63692 | -3.768169 | 20.135135 | 6.155405 | 16.555556 | return improved | 6.413725 | 0.412769 | true |
| B_delay_1_valid_mtm_day | stress30_crisis40 | 84.140212 | 10.760228 | -75.358439 | 2.640777 | -3.781987 | 20.067568 | 6.135135 | 16.5 | return improved | 5.532937 | 0.398951 | false |
| C_delay_2_valid_mtm_days | stress30_crisis40 | 64.901157 | 8.733051 | -77.049401 | 2.643837 | -3.781987 | 20 | 6.121622 | 17.411765 | return improved | 3.841974 | 0.398951 | false |
| D_confirmation | stress30_crisis40 | 87.569434 | 11.102857 | -75.090181 | 2.645529 | -3.781987 | 18.918919 | 5.790541 | 25.454545 | return improved | 5.801195 | 0.398951 | false |
| E_gradual_deescalation | stress30_crisis40 | 91.849644 | 11.523269 | -74.47765 | 2.63692 | -3.768169 | 20.135135 | 6.155405 | 16.555556 | return improved | 6.413725 | 0.412769 | true |
| F_delay_confirmation | stress30_crisis40 | 71.063873 | 9.402918 | -76.461316 | 2.648222 | -3.781987 | 18.851351 | 5.77027 | 25.363636 | return improved | 4.43006 | 0.398951 | false |
| G_delay_confirmation_gradual_exit | stress30_crisis40 | 71.063873 | 9.402918 | -76.461316 | 2.648222 | -3.781987 | 18.851351 | 5.77027 | 25.363636 | return improved | 4.43006 | 0.398951 | false |
| A_immediate | stress25_crisis50 | 81.825963 | 10.525986 | -76.037493 | 2.663877 | -3.798788 | 20.135135 | 5.320946 | 16.555556 | return improved | 4.853882 | 0.382151 | false |
| B_delay_1_valid_mtm_day | stress25_crisis50 | 79.339498 | 10.27153 | -76.248046 | 2.666546 | -3.875478 | 20.067568 | 5.304054 | 16.5 | return improved | 4.643329 | 0.30546 | false |
| C_delay_2_valid_mtm_days | stress25_crisis50 | 62.196186 | 8.432429 | -77.803891 | 2.667219 | -3.875478 | 20 | 5.304054 | 17.411765 | return improved | 3.087485 | 0.30546 | false |
| D_confirmation | stress25_crisis50 | 78.426377 | 10.177347 | -76.51823 | 2.671148 | -3.876212 | 18.918919 | 5.016892 | 25.454545 | return improved | 4.373145 | 0.304727 | false |
| E_gradual_deescalation | stress25_crisis50 | 81.825963 | 10.525986 | -76.037493 | 2.663877 | -3.798788 | 20.135135 | 5.320946 | 16.555556 | return improved | 4.853882 | 0.382151 | false |
| F_delay_confirmation | stress25_crisis50 | 68.646866 | 9.14263 | -77.138595 | 2.672901 | -3.875478 | 18.851351 | 5 | 25.363636 | return improved | 3.752781 | 0.30546 | false |
| G_delay_confirmation_gradual_exit | stress25_crisis50 | 68.646866 | 9.14263 | -77.138595 | 2.672901 | -3.875478 | 18.851351 | 5 | 25.363636 | return improved | 3.752781 | 0.30546 | false |

## Rankings

| ranking | rank | scenarioId | configId | metricValue | totalReturnPct | maxDrawdownPct | historicalVaRPct | returnEffect | paretoCandidate |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| best_total_return | 1 | A_immediate | stress30_crisis40 | 91.849644 | 91.849644 | -74.47765 | -3.768169 | return improved | true |
| best_total_return | 2 | E_gradual_deescalation | stress30_crisis40 | 91.849644 | 91.849644 | -74.47765 | -3.768169 | return improved | true |
| best_total_return | 3 | D_confirmation | stress30_crisis40 | 87.569434 | 87.569434 | -75.090181 | -3.781987 | return improved | false |
| best_total_return | 4 | B_delay_1_valid_mtm_day | stress30_crisis40 | 84.140212 | 84.140212 | -75.358439 | -3.781987 | return improved | false |
| best_total_return | 5 | A_immediate | stress25_crisis50 | 81.825963 | 81.825963 | -76.037493 | -3.798788 | return improved | false |
| best_max_drawdown | 1 | A_immediate | stress30_crisis40 | -74.47765 | 91.849644 | -74.47765 | -3.768169 | return improved | true |
| best_max_drawdown | 2 | E_gradual_deescalation | stress30_crisis40 | -74.47765 | 91.849644 | -74.47765 | -3.768169 | return improved | true |
| best_max_drawdown | 3 | D_confirmation | stress30_crisis40 | -75.090181 | 87.569434 | -75.090181 | -3.781987 | return improved | false |
| best_max_drawdown | 4 | B_delay_1_valid_mtm_day | stress30_crisis40 | -75.358439 | 84.140212 | -75.358439 | -3.781987 | return improved | false |
| best_max_drawdown | 5 | A_immediate | stress25_crisis50 | -76.037493 | 81.825963 | -76.037493 | -3.798788 | return improved | false |
| best_historical_var | 1 | A_immediate | stress30_crisis40 | -3.768169 | 91.849644 | -74.47765 | -3.768169 | return improved | true |
| best_historical_var | 2 | E_gradual_deescalation | stress30_crisis40 | -3.768169 | 91.849644 | -74.47765 | -3.768169 | return improved | true |
| best_historical_var | 3 | B_delay_1_valid_mtm_day | stress30_crisis40 | -3.781987 | 84.140212 | -75.358439 | -3.781987 | return improved | false |
| best_historical_var | 4 | C_delay_2_valid_mtm_days | stress30_crisis40 | -3.781987 | 64.901157 | -77.049401 | -3.781987 | return improved | false |
| best_historical_var | 5 | D_confirmation | stress30_crisis40 | -3.781987 | 87.569434 | -75.090181 | -3.781987 | return improved | false |
| pareto_candidates | 1 | A_immediate | stress30_crisis40 | 91.849644 | 91.849644 | -74.47765 | -3.768169 | return improved | true |
| pareto_candidates | 2 | E_gradual_deescalation | stress30_crisis40 | 91.849644 | 91.849644 | -74.47765 | -3.768169 | return improved | true |

## Pareto Candidates

| scenarioId | configId | totalReturnPct | maxDrawdownPct | volatilityPct | historicalVaRPct | pctDaysHedged | averageHedgeRatioPct | returnEffect |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A_immediate | stress30_crisis40 | 91.849644 | -74.47765 | 2.63692 | -3.768169 | 20.135135 | 6.155405 | return improved |
| E_gradual_deescalation | stress30_crisis40 | 91.849644 | -74.47765 | 2.63692 | -3.768169 | 20.135135 | 6.155405 | return improved |

## Main Findings

- Best total return: A_immediate / stress30_crisis40 at 91.849644%.
- Best max drawdown: A_immediate / stress30_crisis40 at -74.47765%.
- Best historical VaR: A_immediate / stress30_crisis40 at -3.768169%.
- stress30_crisis40 robust scenarios: 7 of 7.
- stress25_crisis50 robust scenarios: 7 of 7.
- Pareto candidate count: 2.

## Interpretation

- If delayed or confirmation-based scenarios remain above unhedged with lower drawdown and VaR, the signal is less dependent on near-perfect timing.
- Gradual de-escalation is useful if it improves stability without excessive hedge persistence.
- Scenarios that require much more hedge exposure for weaker return, drawdown, and VaR are dominated for this research stage.

## Yearly Summary

| year | regime | scenarioId | totalReturnPct | maxDrawdownPct | historicalVaRPct | pctDaysHedged | averageHedgeRatioPct | returnEffect |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2020 | Bull market | A_immediate | 49.209144 | -51.827328 | -2.789744 | 12.598425 | 3.779528 | return sacrificed |
| 2021 | Bull market | A_immediate | -19.824221 | -48.570244 | -6.294472 | 30.364372 | 9.797571 | return improved |
| 2022 | Bear market | A_immediate | -55.223827 | -57.94776 | -3.996334 | 65.833333 | 19.75 | return improved |
| 2023 | Recovery | A_immediate | 109.602398 | -18.240579 | -2.762413 | 0 | 0 | return improved |
| 2024 | ETF/Bull | A_immediate | 94.121329 | -15.374203 | -3.681167 | 0.416667 | 0.125 | return sacrificed |
| 2025 | Mixed | A_immediate | -11.975027 | -27.67166 | -2.795671 | 12.698413 | 3.809524 | return sacrificed |
| 2020 | Bull market | B_delay_1_valid_mtm_day | 44.925366 | -52.748295 | -2.789744 | 12.598425 | 3.779528 | return sacrificed |
| 2021 | Bull market | B_delay_1_valid_mtm_day | -21.562177 | -49.055121 | -6.544129 | 29.959514 | 9.676113 | return improved |
| 2022 | Bear market | B_delay_1_valid_mtm_day | -55.811202 | -58.513468 | -4.165529 | 65.833333 | 19.75 | return improved |
| 2023 | Recovery | B_delay_1_valid_mtm_day | 108.902444 | -18.240579 | -2.762413 | 0.404858 | 0.121457 | return sacrificed |
| 2024 | ETF/Bull | B_delay_1_valid_mtm_day | 95.522036 | -15.374203 | -3.681167 | 0.416667 | 0.125 | return improved |
| 2025 | Mixed | B_delay_1_valid_mtm_day | -10.251483 | -27.426744 | -2.795671 | 12.301587 | 3.690476 | return sacrificed |
| 2020 | Bull market | C_delay_2_valid_mtm_days | 41.403373 | -53.540862 | -2.789744 | 12.598425 | 3.779528 | return sacrificed |
| 2021 | Bull market | C_delay_2_valid_mtm_days | -26.239327 | -50.240203 | -6.798139 | 29.554656 | 9.595142 | return sacrificed |
| 2022 | Bear market | C_delay_2_valid_mtm_days | -56.233819 | -58.971289 | -4.165529 | 65.833333 | 19.75 | return improved |
| 2023 | Recovery | C_delay_2_valid_mtm_days | 108.826706 | -18.240579 | -2.762413 | 0.809717 | 0.242915 | return sacrificed |
| 2024 | ETF/Bull | C_delay_2_valid_mtm_days | 95.073744 | -15.374203 | -3.681167 | 0.416667 | 0.125 | return sacrificed |
| 2025 | Mixed | C_delay_2_valid_mtm_days | -11.322068 | -27.628192 | -2.795671 | 11.904762 | 3.571429 | return sacrificed |
| 2020 | Bull market | D_confirmation | 46.356559 | -52.748295 | -2.789744 | 12.204724 | 3.661417 | return sacrificed |
| 2021 | Bull market | D_confirmation | -20.681386 | -48.522703 | -6.294472 | 27.530364 | 8.947368 | return improved |
| 2022 | Bear market | D_confirmation | -55.826179 | -58.513468 | -4.165529 | 65.416667 | 19.625 | return improved |
| 2023 | Recovery | D_confirmation | 109.602398 | -18.240579 | -2.762413 | 0 | 0 | return improved |
| 2024 | ETF/Bull | D_confirmation | 95.324089 | -15.374203 | -3.681167 | 0 | 0 | return improved |
| 2025 | Mixed | D_confirmation | -10.657574 | -27.426744 | -2.795671 | 9.52381 | 2.857143 | return sacrificed |
| 2020 | Bull market | E_gradual_deescalation | 49.209144 | -51.827328 | -2.789744 | 12.598425 | 3.779528 | return sacrificed |
| 2021 | Bull market | E_gradual_deescalation | -19.824221 | -48.570244 | -6.294472 | 30.364372 | 9.797571 | return improved |
| 2022 | Bear market | E_gradual_deescalation | -55.223827 | -57.94776 | -3.996334 | 65.833333 | 19.75 | return improved |
| 2023 | Recovery | E_gradual_deescalation | 109.602398 | -18.240579 | -2.762413 | 0 | 0 | return improved |
| 2024 | ETF/Bull | E_gradual_deescalation | 94.121329 | -15.374203 | -3.681167 | 0.416667 | 0.125 | return sacrificed |
| 2025 | Mixed | E_gradual_deescalation | -11.975027 | -27.67166 | -2.795671 | 12.698413 | 3.809524 | return sacrificed |
| 2020 | Bull market | F_delay_confirmation | 42.494489 | -53.540862 | -2.789744 | 12.204724 | 3.661417 | return sacrificed |
| 2021 | Bull market | F_delay_confirmation | -24.236722 | -50.179468 | -6.798139 | 27.125506 | 8.825911 | return sacrificed |
| 2022 | Bear market | F_delay_confirmation | -56.298843 | -58.971289 | -4.165529 | 65.416667 | 19.625 | return improved |
| 2023 | Recovery | F_delay_confirmation | 108.902444 | -18.240579 | -2.762413 | 0.404858 | 0.121457 | return sacrificed |
| 2024 | ETF/Bull | F_delay_confirmation | 95.324089 | -15.374203 | -3.681167 | 0 | 0 | return improved |
| 2025 | Mixed | F_delay_confirmation | -11.139405 | -27.689906 | -2.795671 | 9.126984 | 2.738095 | return sacrificed |
| 2020 | Bull market | G_delay_confirmation_gradual_exit | 42.494489 | -53.540862 | -2.789744 | 12.204724 | 3.661417 | return sacrificed |
| 2021 | Bull market | G_delay_confirmation_gradual_exit | -24.236722 | -50.179468 | -6.798139 | 27.125506 | 8.825911 | return sacrificed |
| 2022 | Bear market | G_delay_confirmation_gradual_exit | -56.298843 | -58.971289 | -4.165529 | 65.416667 | 19.625 | return improved |
| 2023 | Recovery | G_delay_confirmation_gradual_exit | 108.902444 | -18.240579 | -2.762413 | 0.404858 | 0.121457 | return sacrificed |
| 2024 | ETF/Bull | G_delay_confirmation_gradual_exit | 95.324089 | -15.374203 | -3.681167 | 0 | 0 | return improved |
| 2025 | Mixed | G_delay_confirmation_gradual_exit | -11.139405 | -27.689906 | -2.795671 | 9.126984 | 2.738095 | return sacrificed |
