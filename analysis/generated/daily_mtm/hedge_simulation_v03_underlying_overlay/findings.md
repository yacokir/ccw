# Partial Hedge Simulation v0.3 Underlying Overlay

Generated: 2026-06-18T08:49:37.016Z

## Scope

- Strategy: BTC Weekly OTM05.
- Inputs: existing Daily Approximate MTM and Passive Hedge Monitoring v0.4b artifacts.
- No new Daily MTM and no backtests.
- Classification: research-grade only.

## Methodology Review

The v01/v02 formula was:

```text
hedged_daily_return = ccw_daily_return * (1 - hedge_ratio)
```

That is a proportional reduction of the CCW return stream. It is useful as a first proxy, but it is not the closest approximation to a short futures/perpetual overlay.

The v03 formula is:

```text
hedged_daily_return = ccw_daily_return - hedge_ratio * underlying_daily_return
```

This is closer to a short BTC-PERPETUAL/futures overlay because the hedge PnL is linked to the underlying BTC return, not to the CCW return itself.

The Daily MTM artifacts contain `underlying_price`, so `underlying_daily_return` is reconstructed between the same valid daily snapshots used by the CCW daily return. Missing CCW return rows remain excluded.

## Unhedged Baseline

| validReturnDays | totalReturnPct | CAGRpct | maxDrawdownPct | volatilityPct | historicalVaRPct | ewmaMaxPct |
| --- | --- | --- | --- | --- | --- | --- |
| 1480 | 51.442572 | 7.194406 | -80.891376 | 2.909341 | -4.180938 | 7.713906 |

## v03 Grid Summary

| configId | totalReturnPct | CAGRpct | maxDrawdownPct | volatilityPct | historicalVaRPct | averageHedgeRatioPct | returnEffect | drawdownReductionPctPoints | varReductionPctPoints | paretoCandidate |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| stress10_crisis40 | 60.605735 | 8.253717 | -79.393872 | 2.783709 | -3.99344 | 2.358108 | return improved | 1.497504 | 0.187498 | false |
| stress10_crisis50 | 58.855452 | 8.055333 | -79.618438 | 2.777721 | -3.99344 | 2.472973 | return improved | 1.272938 | 0.187498 | false |
| stress10_crisis60 | 57.017449 | 7.845039 | -79.854258 | 2.773401 | -3.987591 | 2.587838 | return improved | 1.037117 | 0.193347 | false |
| stress20_crisis40 | 75.940947 | 9.918941 | -77.024683 | 2.705711 | -3.800924 | 4.256757 | return improved | 3.866692 | 0.380014 | false |
| stress20_crisis50 | 74.02354 | 9.717506 | -77.275069 | 2.699551 | -3.800924 | 4.371622 | return improved | 3.616307 | 0.380014 | false |
| stress20_crisis60 | 72.010038 | 9.503977 | -77.538003 | 2.695107 | -3.792343 | 4.486486 | return improved | 3.353373 | 0.388595 | false |
| stress25_crisis40 | 83.829338 | 10.728905 | -75.773472 | 2.670118 | -3.798788 | 5.206081 | return improved | 5.117903 | 0.382151 | false |
| stress25_crisis50 | 81.825963 | 10.525986 | -76.037493 | 2.663877 | -3.798788 | 5.320946 | return improved | 4.853882 | 0.382151 | false |
| stress25_crisis60 | 79.722185 | 10.310883 | -76.314746 | 2.659374 | -3.781987 | 5.435811 | return improved | 4.576629 | 0.398951 | false |
| stress30_crisis40 | 91.849644 | 11.523269 | -74.47765 | 2.63692 | -3.768169 | 6.155405 | return improved | 6.413725 | 0.412769 | true |
| stress30_crisis50 | 89.758864 | 11.318895 | -74.755793 | 2.630601 | -3.768169 | 6.27027 | return improved | 6.135582 | 0.412769 | true |
| stress30_crisis60 | 87.5633 | 11.102249 | -75.047876 | 2.626041 | -3.764845 | 6.385135 | return improved | 5.8435 | 0.416094 | true |

## v02 vs v03 Comparison

| configId | v02ProportionalTotalReturnPct | v03OverlayTotalReturnPct | v03MinusV02ReturnPctPoints | v02DrawdownReductionPctPoints | v03DrawdownReductionPctPoints | v03MinusV02DrawdownReductionPctPoints | v02VarReductionPctPoints | v03VarReductionPctPoints | v03MinusV02VarReductionPctPoints |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| stress10_crisis40 | 63.387472 | 60.605735 | -2.781737 | 1.770954 | 1.497504 | -0.27345 | 0.190657 | 0.187498 | -0.003159 |
| stress10_crisis50 | 61.707153 | 58.855452 | -2.851701 | 1.556223 | 1.272938 | -0.283285 | 0.190657 | 0.187498 | -0.003159 |
| stress10_crisis60 | 59.969936 | 57.017449 | -2.952487 | 1.334221 | 1.037117 | -0.297104 | 0.190657 | 0.193347 | 0.00269 |
| stress20_crisis40 | 82.173827 | 75.940947 | -6.23288 | 4.487256 | 3.866692 | -0.620564 | 0.216557 | 0.380014 | 0.163457 |
| stress20_crisis50 | 80.300304 | 74.02354 | -6.276764 | 4.24459 | 3.616307 | -0.628283 | 0.216557 | 0.380014 | 0.163457 |
| stress20_crisis60 | 78.363342 | 72.010038 | -6.353304 | 3.993707 | 3.353373 | -0.640334 | 0.216557 | 0.388595 | 0.172038 |
| stress25_crisis40 | 92.088228 | 83.829338 | -8.25889 | 5.946483 | 5.117903 | -0.82858 | 0.383079 | 0.382151 | -0.000928 |
| stress25_crisis50 | 90.112743 | 81.825963 | -8.28678 | 5.68881 | 4.853882 | -0.834928 | 0.383079 | 0.382151 | -0.000928 |
| stress25_crisis60 | 88.070366 | 79.722185 | -8.348181 | 5.422412 | 4.576629 | -0.845783 | 0.383079 | 0.398951 | 0.015872 |
| stress30_crisis40 | 102.350973 | 91.849644 | -10.501329 | 7.475784 | 6.413725 | -1.062059 | 0.416093 | 0.412769 | -0.003324 |
| stress30_crisis50 | 100.269944 | 89.758864 | -10.51108 | 7.202384 | 6.135582 | -1.066802 | 0.416093 | 0.412769 | -0.003324 |
| stress30_crisis60 | 98.118448 | 87.5633 | -10.555148 | 6.919725 | 5.8435 | -1.076225 | 0.416093 | 0.416094 | 0.000001 |

## Main Findings

- v03 configs with return improvement versus unhedged: 12 of 12.
- v03 configs with positive drawdown reduction: 12 of 12.
- v03 configs with positive VaR reduction: 12 of 12.
- Best v03 total return: stress30_crisis40 at 91.849644%.
- Best v03 max drawdown: stress30_crisis40 at -74.47765%.
- Best v03 historical VaR: stress30_crisis60 at -3.764845%.
- v02 stress30_crisis40 exceeded unhedged by 50.908401 p.p.; v03 stress30_crisis40 exceeded unhedged by 40.407072 p.p.

## Interpretation

- v01/v02 should be treated as a simplified proportional-exposure proxy.
- v03 is the better research reference for future hedge economics because it approximates a short underlying/perp overlay.
- If v03 remains materially positive, the signal is less likely to be just an artifact of proportional scaling.
- This still excludes funding, basis, slippage, liquidity, margin, collateral, liquidation, and execution timing.

## Pareto Candidates

| configId | totalReturnPct | maxDrawdownPct | volatilityPct | historicalVaRPct | returnEffect |
| --- | --- | --- | --- | --- | --- |
| stress30_crisis40 | 91.849644 | -74.47765 | 2.63692 | -3.768169 | return improved |
| stress30_crisis50 | 89.758864 | -74.755793 | 2.630601 | -3.768169 | return improved |
| stress30_crisis60 | 87.5633 | -75.047876 | 2.626041 | -3.764845 | return improved |
