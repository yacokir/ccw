# Live Research Snapshot

- Mode: t0.
- Venue: Bybit.
- Decision timestamp: 2026-06-18 10:00 America/New_York.
- Generated at: 2026-06-18T17:47:02.434Z.
- Status: research-grade, read-only, no orders placed.

## Asset Summary

| Asset | Data As Of | Spot | Damage | Alert | Current Hedge % | Target Hedge % | Delta Recommendation % | Circuit Breaker | Reasons |
| --- | --- | ---: | --- | --- | ---: | ---: | ---: | --- | --- |
| BTC | 2025-12-25 | 87712.5 | stress | watch | 0 | 0 | 0 | NO_TRADE | Daily MTM stale or not current decision date; Monitoring indicators stale |
| ETH | 2025-12-25 | 2934 | stress | watch | 0 | 0 | 0 | NO_TRADE | Daily MTM stale or not current decision date; Monitoring indicators stale |

## Details

### BTC

- Spot price: 87712.5.
- 7d / 30d / 90d return: -0.787255% / 1.351937% / -20.082639%.
- 30d realized volatility: 2.368054%.
- EWMA: 1.966008%.
- Historical VaR: -2.65866%.
- Option expiry / OTM05 target strike / observed premium: 26DEC25 / 92000 / 17.5425.
- Normal counter: 0.
- Comments: Research-grade read-only snapshot; no orders placed. watch_maps_to_no_hedge Monitoring source: analysis\generated\daily_mtm\hedge_monitoring_calibration_v04\signals_v04_recommended.csv. Daily MTM source count: 6.

### ETH

- Spot price: 2934.
- 7d / 30d / 90d return: -0.562597% / 2.137436% / -26.233218%.
- 30d realized volatility: 3.318229%.
- EWMA: 2.573526%.
- Historical VaR: -3.35224%.
- Option expiry / OTM05 target strike / observed premium: 26DEC25 / 3100 / 0.2934.
- Normal counter: 0.
- Comments: Research-grade read-only snapshot; no orders placed. watch_maps_to_no_hedge Monitoring source: analysis\generated\daily_mtm\eth_hedge_monitoring_calibration_v04\signals_v04_recommended.csv. Daily MTM source count: 1.

## Limitations

- This snapshot is a manual research aid, not production execution.
- Circuit breakers block trade recommendations when required data is missing, stale, or unavailable.
- Funding, fees, slippage, liquidation, and margin stress remain outside this v0.1 snapshot.
