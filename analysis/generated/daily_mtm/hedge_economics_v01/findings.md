# Realistic Hedge Economics v01

Generated: 2026-06-19T10:11:13.654Z

## Scope

- Strategy: BTC Weekly OTM05, 2020-2025.
- Classification: research-grade only.
- No live workflow changes, no Daily MTM changes, no monitoring threshold changes, and no hedge rule changes.
- No order book simulation, liquidation engine, margin calls, or production execution assumptions.

## Methodology

```text
gross_hedged_return = ccw_return - hedge_ratio * underlying_return
net_hedged_return = gross_hedged_return - trading_fees - slippage + funding_effect + basis_effect + collateral_effect
```

- Fees and slippage are always costs and are applied only when the target hedge ratio changes.
- v01 does not assume daily notional rebalancing: equity drift at an unchanged hedge ratio does not create synthetic fee or slippage costs.
- Funding, basis, and collateral effects preserve sign; positive values improve return and negative values reduce return.
- Funding is applied daily on hedge notional. Historical Bybit funding is aggregated by UTC date when available.
- Signal timing follows the v04 research convention: the latest prior valid MTM alert state is applied to the next valid daily return, avoiding same-day lookahead.

## Funding Data

- Historical funding used for BASE: yes.
- Funding source: Bybit public /v5/market/funding/history.
- Funding rows: 6322.
- Funding date count: 2108.
- Funding fetch error: none.

## Unhedged Baseline

| validReturnDays | totalReturnPct | CAGRpct | maxDrawdownPct | volatilityPct | historicalVaRPct | ewmaMaxPct |
| --- | --- | --- | --- | --- | --- | --- |
| 1480 | 51.442572 | 7.194406 | -80.891376 | 2.909341 | -4.180938 | 7.713906 |

## Scenario Summary

| policyId | economicScenarioId | gross_hedged_return_pct | net_hedged_return_pct | net_CAGRpct | net_maxDrawdownPct | net_historicalVaRPct | total_fees | total_slippage | total_funding | total_basis_effect | total_collateral_effect | net_implementation_cost | net_return_effect |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| stress30_crisis40 | BASE | 91.849636 | 90.721344 | 11.413209 | -74.481454 | -3.768169 | 0.009798 | 0.003561 | 0.004062 | 0 | 0 | 0.009297 | return improved |
| stress30_crisis40 | CONSERVATIVE | 91.849636 | 84.3173 | 10.778051 | -75.122768 | -3.768169 | 0.009597 | 0.008726 | -0.017122 | -0.008569 | 0 | 0.044014 | return improved |
| stress30_crisis40 | STRESS | 91.849636 | 75.832641 | 9.907611 | -75.94699 | -3.768169 | 0.009317 | 0.016939 | -0.041813 | -0.025103 | 0.004188 | 0.088984 | return improved |
| stress25_crisis50 | BASE | 81.825957 | 80.603387 | 10.401236 | -76.084319 | -3.798412 | 0.009178 | 0.003338 | 0.002889 | 0 | 0 | 0.009627 | return improved |
| stress25_crisis50 | CONSERVATIVE | 81.825957 | 75.332082 | 9.855175 | -76.613368 | -3.799162 | 0.009035 | 0.00821 | -0.014525 | -0.007255 | 0 | 0.039025 | return improved |
| stress25_crisis50 | STRESS | 81.825957 | 68.19317 | 9.093426 | -77.306142 | -3.799725 | 0.008828 | 0.016039 | -0.035549 | -0.021333 | 0.003545 | 0.078204 | return improved |

## Dominant Components

| component | total |
| --- | --- |
| total_funding | -0.102058 |
| total_basis_effect | -0.06226 |
| total_slippage | 0.056813 |
| total_fees | 0.055753 |
| total_collateral_effect | 0.007733 |

## Research Questions

1. Did the overlay reduce risk gross? Yes across all scenarios.
2. Did the overlay still reduce risk net? Yes across all scenarios by drawdown and VaR.
3. Did net return remain superior to unhedged? Yes across all scenarios.
4. Which components dominated? Largest absolute aggregate component: total_funding (-0.102058).
5. Did the result survive BASE, CONSERVATIVE, and STRESS? Yes in this research-grade v01.
6. Did stress30_crisis40 remain better than stress25_crisis50? Best net return: stress30_crisis40 / BASE; best net drawdown: stress30_crisis40 / BASE.
7. Assumptions to replace next: funding should move from public daily aggregation/proxies to fully aligned funding intervals; basis should use observed perp/spot or futures basis; slippage should become liquidity/notional-aware; collateral effects should use actual collateral yield or borrowing economics.

## Yearly Summary

| year | regime | policyId | economicScenarioId | net_hedged_return_pct | net_maxDrawdownPct | net_historicalVaRPct | net_implementation_cost | net_return_effect |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2020 | Bull market | stress30_crisis40 | BASE | 48.899762 | -51.839173 | -2.789744 | 0.001689 | return sacrificed |
| 2021 | Bull market | stress30_crisis40 | BASE | -20.00414 | -48.572406 | -6.297414 | 0.002874 | return improved |
| 2022 | Bear market | stress30_crisis40 | BASE | -55.137926 | -57.85002 | -3.997137 | -0.001429 | return improved |
| 2023 | Recovery | stress30_crisis40 | BASE | 109.555762 | -18.240579 | -2.762413 | 0.00012 | return sacrificed |
| 2024 | ETF/Bull | stress30_crisis40 | BASE | 94.040897 | -15.374203 | -3.681167 | 0.000484 | return sacrificed |
| 2025 | Mixed | stress30_crisis40 | BASE | -12.226068 | -27.738253 | -2.795671 | 0.005559 | return sacrificed |
| 2020 | Bull market | stress30_crisis40 | CONSERVATIVE | 48.684264 | -51.862011 | -2.789744 | 0.002737 | return sacrificed |
| 2021 | Bull market | stress30_crisis40 | CONSERVATIVE | -20.83368 | -48.847139 | -6.300322 | 0.015527 | return improved |
| 2022 | Bear market | stress30_crisis40 | CONSERVATIVE | -55.886526 | -58.475016 | -3.996784 | 0.009795 | return improved |
| 2023 | Recovery | stress30_crisis40 | CONSERVATIVE | 109.537108 | -18.240579 | -2.762413 | 0.000164 | return sacrificed |
| 2024 | ETF/Bull | stress30_crisis40 | CONSERVATIVE | 93.98191 | -15.374203 | -3.681167 | 0.000814 | return sacrificed |
| 2025 | Mixed | stress30_crisis40 | CONSERVATIVE | -12.669248 | -27.919514 | -2.795671 | 0.014977 | return sacrificed |
| 2020 | Bull market | stress30_crisis40 | STRESS | 47.999065 | -51.897044 | -2.789744 | 0.006323 | return sacrificed |
| 2021 | Bull market | stress30_crisis40 | STRESS | -21.894287 | -49.15494 | -6.305872 | 0.031528 | return sacrificed |
| 2022 | Bear market | stress30_crisis40 | STRESS | -56.834143 | -59.299532 | -3.997137 | 0.023135 | return improved |
| 2023 | Recovery | stress30_crisis40 | STRESS | 109.506018 | -18.240579 | -2.762413 | 0.000232 | return sacrificed |
| 2024 | ETF/Bull | stress30_crisis40 | STRESS | 93.897751 | -15.374203 | -3.681167 | 0.001256 | return sacrificed |
| 2025 | Mixed | stress30_crisis40 | STRESS | -13.254273 | -28.150209 | -2.795671 | 0.02651 | return sacrificed |
| 2020 | Bull market | stress25_crisis50 | BASE | 49.702326 | -52.383904 | -2.789744 | 0.001413 | return sacrificed |
| 2021 | Bull market | stress25_crisis50 | BASE | -21.699716 | -50.276564 | -6.514571 | 0.00451 | return sacrificed |
| 2022 | Bear market | stress25_crisis50 | BASE | -57.05589 | -59.643625 | -4.181284 | -0.001145 | return improved |
| 2023 | Recovery | stress25_crisis50 | BASE | 109.563535 | -18.240579 | -2.762413 | 0.000094 | return sacrificed |
| 2024 | ETF/Bull | stress25_crisis50 | BASE | 94.254723 | -15.374203 | -3.681167 | 0.000379 | return sacrificed |
| 2025 | Mixed | stress25_crisis50 | BASE | -11.866079 | -27.791377 | -2.795671 | 0.004376 | return sacrificed |
| 2020 | Bull market | stress25_crisis50 | CONSERVATIVE | 49.52166 | -52.402777 | -2.789744 | 0.002289 | return sacrificed |
| 2021 | Bull market | stress25_crisis50 | CONSERVATIVE | -22.466429 | -50.547188 | -6.523726 | 0.016271 | return sacrificed |
| 2022 | Bear market | stress25_crisis50 | CONSERVATIVE | -57.654154 | -60.143142 | -4.181284 | 0.007851 | return improved |
| 2023 | Recovery | stress25_crisis50 | CONSERVATIVE | 109.54799 | -18.240579 | -2.762413 | 0.000129 | return sacrificed |
| 2024 | ETF/Bull | stress25_crisis50 | CONSERVATIVE | 94.205551 | -15.374203 | -3.681167 | 0.000642 | return sacrificed |
| 2025 | Mixed | stress25_crisis50 | CONSERVATIVE | -12.236984 | -27.942345 | -2.795671 | 0.011843 | return sacrificed |
| 2020 | Bull market | stress25_crisis50 | STRESS | 48.94723 | -52.431729 | -2.789744 | 0.005287 | return sacrificed |
| 2021 | Bull market | stress25_crisis50 | STRESS | -23.508596 | -50.885113 | -6.540351 | 0.032079 | return sacrificed |
| 2022 | Bear market | stress25_crisis50 | STRESS | -58.413782 | -60.791978 | -4.181284 | 0.018602 | return improved |
| 2023 | Recovery | stress25_crisis50 | STRESS | 109.522081 | -18.240579 | -2.762413 | 0.000183 | return sacrificed |
| 2024 | ETF/Bull | stress25_crisis50 | STRESS | 94.135389 | -15.374203 | -3.681167 | 0.000993 | return sacrificed |
| 2025 | Mixed | stress25_crisis50 | STRESS | -12.727109 | -28.134574 | -2.795671 | 0.02106 | return sacrificed |

## Limitations

- Liquidity is assumed sufficient for current research size.
- Required margin is tracked, but liquidation and margin calls are not modeled.
- Funding is aggregated by UTC date rather than exact intraday hedge holding windows.
- Basis and collateral effects are scenario assumptions, not observed market data.
- Results are not production execution guidance.