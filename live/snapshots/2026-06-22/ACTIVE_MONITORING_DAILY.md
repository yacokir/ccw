# Active Monitoring Daily

- Generated at: 2026-06-22T18:16:13.305Z.
- Snapshot date: 2026-06-22.
- Decision timestamp: 2026-06-22 10:00 America/New_York.
- Mode: ACTIVE_MONITORING_DAILY.
- Status: read-only research aid; no orders placed.

## Operator Summary

| Asset | Price | Damage | Alert | EWMA Daily | Historical VaR | Current Hedge | Target Hedge | Execution State | Today Action | Circuit Breaker |
| --- | ---: | --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- |
| BTC | 64,629.40 | stress | watch | 2.04% | -4.19% | 0% | 0% | NO_HEDGE | NO ACTION | OK |
| ETH | 1,744.96 | stress | stress | 2.89% | -5.37% | 30% | 30% | HEDGE_30 | NO ACTION | OK |

## Asset Details

### BTC

- Asset: BTC.
- Current price: 64,629.40.
- Data as of: 2026-06-22.
- Market data source: live_refresh.
- Realized vol daily / annualized: 2.24% / 42.79%.
- EWMA daily / annualized: 2.04% / 39.05%.
- Historical VaR: -4.19%.
- Damage state / alert state: stress / watch.
- Current hedge / target hedge / delta: 0% / 0% / 0%.
- Execution state: NO_HEDGE.
- Today action: NO ACTION.
- Selected option: BTC-26JUN26-66000-C-USDT.
- Expiry / DTE: 2026-06-26 / 4.
- Strike: 66,000.00.
- Days since entry: 4.
- Underlying entry / unrealized PnL: N/A / N/A.
- Premium: 392.91 USD.
- Premium received: 442.50.
- Premium status / source: EXECUTABLE_BYBIT / bybit_registered_option_mark_price.
- Option bid / ask / mark / last: 395.00 / 400.00 / 392.91 / 385.00.
- Option unrealized PnL approx: -146.86.
- Hedge mark / unrealized PnL approx: N/A / N/A.
- Net unrealized PnL approx: N/A.
- Circuit breaker: OK.
- Warning: Underlying entry price unavailable; underlying and net PnL are not currently calculable.

### ETH

- Asset: ETH.
- Current price: 1,744.96.
- Data as of: 2026-06-22.
- Market data source: live_refresh.
- Realized vol daily / annualized: 3.24% / 61.96%.
- EWMA daily / annualized: 2.89% / 55.28%.
- Historical VaR: -5.37%.
- Damage state / alert state: stress / stress.
- Current hedge / target hedge / delta: 30% / 30% / 0%.
- Execution state: HEDGE_30.
- Today action: NO ACTION.
- Selected option: ETH-26JUN26-1775-C-USDT.
- Expiry / DTE: 2026-06-26 / 4.
- Strike: 1,775.00.
- Days since entry: 4.
- Underlying entry / unrealized PnL: N/A / N/A.
- Premium: 20.34 USD.
- Premium received: 507.00.
- Premium status / source: EXECUTABLE_BYBIT / bybit_registered_option_mark_price.
- Option bid / ask / mark / last: 20.40 / 20.50 / 20.34 / 20.50.
- Option unrealized PnL approx: -103.23.
- Hedge mark / unrealized PnL approx: 1,745.08 / -441.09.
- Net unrealized PnL approx: N/A.
- Circuit breaker: OK.
- Warning: Underlying entry price unavailable; underlying and net PnL are not currently calculable.

## Snapshot Archive

- Date folder: live/snapshots/2026-06-22/.
- Snapshot JSON: live/snapshots/2026-06-22_daily_monitoring_snapshot.json.
- Snapshot markdown: live/snapshots/2026-06-22_daily_monitoring_snapshot.md.

## Notes

- Missing fields are shown as N/A.
- This report consolidates existing live artifacts and snapshot fields only.
- Manual execution decisions remain outside this script.
