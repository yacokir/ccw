# Live Research Snapshot

- Mode: ACTIVE_MONITORING_DAILY.
- Venue: Bybit.
- Decision timestamp: 2026-06-22 10:00 America/New_York.
- Generated at: 2026-06-22T18:16:13.305Z.
- Status: research-grade, read-only, no orders placed.

## Asset Summary

| Asset | Data As Of | Spot | Damage | Alert | Current Hedge | Target Hedge | Delta | Execution State | Circuit Breaker | Reasons |
| --- | --- | ---: | --- | --- | ---: | ---: | ---: | --- | --- | --- |
| BTC | 2026-06-22 | 64,629.40 | stress | watch | 0% | 0% | 0% | NO_HEDGE | OK |  |
| ETH | 2026-06-22 | 1,744.96 | stress | stress | 30% | 30% | 0% | HEDGE_30 | OK |  |

## Details

### BTC

Spot: 64,629.40

Returns

- 7d: -2.50%.
- 30d: -15.75%.
- 90d: -8.35%.

Risk

Realized Vol:

- 2.24% daily.
- 42.79% annualized.

EWMA:

- 2.04% daily.
- 39.05% annualized.

Historical VaR (95%, 1D):

- -4.19%.
- Estimated one-day loss threshold derived from recent historical returns.
- Approximately 5% of observed days experienced losses worse than this level.

Expected Tail Frequency:

- ~1 day every 20 days.

Monitoring

- damage_state: stress.
- alert_state: watch.

Execution

- execution_state: NO_HEDGE.
- current_hedge: 0%.
- target_hedge: 0%.
- delta: 0%.
- today_action: NO ACTION.

Position

- Cycle ID: 2026-06-18_weekly_otm05_bybit.
- Option expiry: 2026-06-26.
- Days to expiration (DTE): 4.
- Selected option: BTC-26JUN26-66000-C-USDT.
- OTM05 target strike: 66,000.00.
- Distance to strike: 2.12%.
- Underlying qty: 1.5.
- Underlying entry price: N/A.
- Underlying unrealized PnL: N/A.
- Option qty: -1.5.
- Option entry premium: 295.00.
- Premium received: 442.50.
- Premium Status: EXECUTABLE_BYBIT.
- Observed premium: 392.91 USD.
- Premium source: bybit_registered_option_mark_price.
- Option bid / ask / mark / last: 395.00 / 400.00 / 392.91 / 385.00.
- Option MTM P&L: -146.86.
- Greeks delta / gamma / vega / theta: 0.284363 / 0.000150 / 21.704952 / -107.127728.
- Hedge instrument: BTCUSDT.
- Hedge qty: 0.
- Hedge entry price: N/A.
- Hedge mark price: N/A.
- Hedge unrealized PnL approx: N/A.
- Net unrealized PnL approx: N/A.
- Option warning: Underlying entry price unavailable; underlying and net PnL are not currently calculable.
- Normal counter: 0.
- Comments: Research-grade read-only snapshot; no orders placed. watch_maps_to_no_hedge Live market data source: live\data\btc_live_metrics.json. Active monitoring uses Position Register source: live\position_register.json. Monitoring source: live\data\live_monitoring_signals.json. Daily MTM source count: 6.

### ETH

Spot: 1,744.96

Returns

- 7d: -2.79%.
- 30d: -17.56%.
- 90d: -19.04%.

Risk

Realized Vol:

- 3.24% daily.
- 61.96% annualized.

EWMA:

- 2.89% daily.
- 55.28% annualized.

Historical VaR (95%, 1D):

- -5.37%.
- Estimated one-day loss threshold derived from recent historical returns.
- Approximately 5% of observed days experienced losses worse than this level.

Expected Tail Frequency:

- ~1 day every 20 days.

Monitoring

- damage_state: stress.
- alert_state: stress.

Execution

- execution_state: HEDGE_30.
- current_hedge: 30%.
- target_hedge: 30%.
- delta: 0%.
- today_action: NO ACTION.

Position

- Cycle ID: 2026-06-18_weekly_otm05_bybit.
- Option expiry: 2026-06-26.
- Days to expiration (DTE): 4.
- Selected option: ETH-26JUN26-1775-C-USDT.
- OTM05 target strike: 1,775.00.
- Distance to strike: 1.72%.
- Underlying qty: 30.
- Underlying entry price: N/A.
- Underlying unrealized PnL: N/A.
- Option qty: -30.
- Option entry premium: 16.90.
- Premium received: 507.00.
- Premium Status: EXECUTABLE_BYBIT.
- Observed premium: 20.34 USD.
- Premium source: bybit_registered_option_mark_price.
- Option bid / ask / mark / last: 20.40 / 20.50 / 20.34 / 20.50.
- Option MTM P&L: -103.23.
- Greeks delta / gamma / vega / theta: 0.373588 / 0.004687 / 0.654869 / -4.278852.
- Hedge instrument: ETHUSDT.
- Hedge qty: -9.
- Hedge entry price: 1,696.07.
- Hedge mark price: 1,745.08.
- Hedge unrealized PnL approx: -441.09.
- Net unrealized PnL approx: N/A.
- Option warning: Underlying entry price unavailable; underlying and net PnL are not currently calculable.
- Normal counter: 0.
- Comments: Research-grade read-only snapshot; no orders placed. risk_state_executes_immediately Live market data source: live\data\eth_live_metrics.json. Active monitoring uses Position Register source: live\position_register.json. Monitoring source: live\data\live_monitoring_signals.json. Daily MTM source count: 1.

## Limitations

- This snapshot is a manual research aid, not production execution.
- Circuit breakers block trade recommendations when required data is missing, stale, or unavailable.
- Funding, fees, slippage, liquidation, and margin stress remain outside this v0.1 snapshot.
