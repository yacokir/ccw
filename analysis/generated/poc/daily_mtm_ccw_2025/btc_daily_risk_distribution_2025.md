# BTC Daily Risk Distribution Study - 2025

Generated: 2026-05-25T13:32:28.754Z

## Scope

- BTC weekly OTM10, year 2025 only.
- Source: analysis\generated\poc_daily_mtm_ccw_2025.json.
- Uses existing Daily Approximate MTM output only; no baseline backtests, hedge logic, or unrelated analyses were rerun.

## Validation

- Runtime: 0.028s.
- Input rows: 357.
- Complete MTM rows: 266.
- Valid adjacent daily return rows: 254.
- EWMA rows: 265.
- Historical VaR rows: 234.
- Missing MTM rows: 91.

## Daily Return Distribution

- Mean / median / std dev: -0.02762% / 0.169219% / 2.01973%.
- Skewness / excess kurtosis: -0.68256 / 2.595904.
- Percentiles p1/p5/p10: -6.912764% / -3.21774% / -2.414855%.
- Percentiles p90/p95/p99: 2.094003% / 3.033942% / 4.385662%.

## Tail Events

### Loss Frequency

| thresholdPct | count | frequencyPct |
| --- | --- | --- |
| -2 | 38 | 14.96063 |
| -3 | 14 | 5.511811 |
| -5 | 4 | 1.574803 |
| -7 | 3 | 1.181102 |

### Gain Frequency

| thresholdPct | count | frequencyPct |
| --- | --- | --- |
| 2 | 27 | 10.629921 |
| 3 | 14 | 5.511811 |
| 5 | 2 | 0.787402 |

### Largest Loss Dates

| date | cycle_id | dailyReturnPct | ewmaVolPct | historicalVarLossPct | drawdownPct | BTC_price |
| --- | --- | --- | --- | --- | --- | --- |
| 2025-02-25 | 8 | -8.653824 | 2.631157 | 2.618889 | -18.413613 | 86446 |
| 2025-10-11 | 41 | -7.711738 | 2.169721 | 1.722264 | -9.922663 | 112433.5 |
| 2025-11-21 | 47 | -7.449814 | 2.834352 | 4.731536 | -32.528274 | 84760.5 |
| 2025-11-14 | 46 | -6.436512 | 2.479391 | 4.731536 | -22.928353 | 96306 |
| 2025-10-17 | 42 | -4.946082 | 2.48408 | 3.059521 | -15.407487 | 105725 |

## EWMA Volatility

- Min / median / max: 1.100983% / 1.974398% / 2.834352%.
| thresholdPct | count | frequencyPct |
| --- | --- | --- |
| 2 | 126 | 47.54717 |
| 3 | 0 | 0 |
| 4 | 0 | 0 |
| 5 | 0 | 0 |

## Historical VaR

- Loss magnitude min / median / max: 1.539302% / 2.791146% / 5.765818%.
| thresholdPct | count | frequencyPct |
| --- | --- | --- |
| 3 | 90 | 38.461538 |
| 5 | 28 | 11.965812 |
| 7 | 0 | 0 |
| 10 | 0 | 0 |

## Drawdown Path

- Max drawdown: -32.537703%.
- Drawdown expansion days: 126 (47.368421%).
- Days at or below -10% drawdown: 102 (38.345865%).

### Largest Drawdown Episodes

| startDate | endDate | length | minDrawdownPct | recovered |
| --- | --- | --- | --- | --- |
| 2025-11-07 | 2025-11-27 | 21 | -32.537703 | false |
| 2025-12-05 | 2025-12-25 | 21 | -30.41235 | false |
| 2025-04-04 | 2025-04-24 | 21 | -26.427287 | true |
| 2025-03-07 | 2025-03-27 | 21 | -23.372131 | true |
| 2025-02-07 | 2025-02-27 | 21 | -20.041641 | true |

## Crisis Period Identification

- Early March to early April 2025: repeated large daily losses, elevated drawdown, and rising EWMA/VaR within the MTM subset.
- Early November 2025: deepest drawdown region in the daily MTM path, partly adjacent to a missing synthetic-cycle gap.

## Observations

- The daily MTM subset contains 254 adjacent valid daily returns from 357 daily rows.
- Worst adjacent daily return is -8.653824% and best adjacent daily return is 6.491679%.
- Daily return standard deviation is 2.01973%, with max drawdown -32.537703%.
- On complete MTM rows, EWMA volatility exceeds 3% on 0 rows and historical VaR loss magnitude exceeds 3% on 90 rows.

## Interpretations

- The daily layer appears economically meaningful because it exposes intracycle drawdown, volatility clustering, and tail observations that cycle-level reporting compresses.
- The risk layer is usable for monitoring-style research, but the missing synthetic-cycle gaps reduce continuity and should remain visible in any future simulation.
- Historical VaR and EWMA react to realized daily stress, but this study does not test whether a hedge would have improved outcomes.

## Hypotheses

- Future intracycle hedge research may be more sensitive to timing and missing-data continuity than to summary distribution metrics alone.
- Daily MTM stress windows may help identify when crisis-trigger or higher-frequency risk controls should be simulated, after costs and liquidity are modeled.
- A fuller option data source could reduce synthetic-cycle gaps and improve continuity of daily risk estimates.

## Caveats

- Approximate MTM only.
- No official historical marks.
- No Greeks and no delta-aware hedge.
- OHLC/trade-price proxies may be stale, sparse, spread-distorted, or liquidity-distorted.
- Missing synthetic cycles are excluded from daily return calculations.
- This is a 2025 BTC weekly OTM10 daily MTM subset only.
