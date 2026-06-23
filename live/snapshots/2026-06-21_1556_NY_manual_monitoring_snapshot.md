# Live Research Snapshot

- Mode: ACTIVE_MONITORING_MANUAL.
- Venue: Bybit.
- Decision timestamp: 2026-06-21 10:00 America/New_York.
- Generated at: 2026-06-21T19:56:29.037Z.
- Status: research-grade, read-only, no orders placed.

## Asset Summary

| Asset | Data As Of | Spot | Damage | Alert | Current Hedge | Target Hedge | Delta | Execution State | Circuit Breaker | Reasons |
| --- | --- | ---: | --- | --- | ---: | ---: | ---: | --- | --- | --- |
| BTC | 2026-06-21 | 64,195.30 | stress | watch | 0% | 0% | 0% | NO_HEDGE | OK |  |
| ETH | 2026-06-21 | 1,733.74 | stress | stress | 30% | 30% | 0% | HEDGE_30 | OK |  |

## Details

### BTC

Spot: 64,195.30

Returns

- 7d: -2.31%.
- 30d: -14.98%.
- 90d: -9.41%.

Risk

Realized Vol:

- 2.22% daily.
- 42.32% annualized.

EWMA:

- 2.01% daily.
- 38.35% annualized.

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
- Days to expiration (DTE): 5.
- Selected option: BTC-26JUN26-66000-C-USDT.
- OTM05 target strike: 66,000.00.
- Distance to strike: 2.81%.
- Underlying qty: 1.5.
- Option qty: -1.5.
- Option entry premium: 295.00.
- Premium Status: EXECUTABLE_BYBIT.
- Observed premium: 373.46 USD.
- Premium source: bybit_registered_option_mark_price.
- Option bid / ask / mark / last: 370.00 / 375.00 / 373.46 / 380.00.
- Option MTM P&L: -117.69.
- Greeks delta / gamma / vega / theta: 0.250637 / 0.000125 / 22.694129 / -89.936754.
- Hedge instrument: BTCUSDT.
- Hedge qty: 0.
- Hedge entry price: N/A.
- Normal counter: 0.
- Comments: Research-grade read-only snapshot; no orders placed. watch_maps_to_no_hedge Live market data source: live\data\btc_live_metrics.json. Active monitoring uses Position Register source: live\position_register.json. Monitoring source: live\data\live_monitoring_signals.json. Daily MTM source count: 6.

### ETH

Spot: 1,733.74

Returns

- 7d: 0.52%.
- 30d: -16.05%.
- 90d: -19.39%.

Risk

Realized Vol:

- 3.23% daily.
- 61.67% annualized.

EWMA:

- 2.89% daily.
- 55.29% annualized.

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
- Days to expiration (DTE): 5.
- Selected option: ETH-26JUN26-1775-C-USDT.
- OTM05 target strike: 1,775.00.
- Distance to strike: 2.38%.
- Underlying qty: 30.
- Option qty: -30.
- Option entry premium: 16.90.
- Premium Status: EXECUTABLE_BYBIT.
- Observed premium: 24.29 USD.
- Premium source: bybit_registered_option_mark_price.
- Option bid / ask / mark / last: 24.30 / 24.40 / 24.29 / 24.70.
- Option MTM P&L: -221.71.
- Greeks delta / gamma / vega / theta: 0.362044 / 0.003692 / 0.722632 / -4.226694.
- Hedge instrument: ETHUSDT.
- Hedge qty: -9.
- Hedge entry price: 1,696.07.
- Normal counter: 0.
- Comments: Research-grade read-only snapshot; no orders placed. risk_state_executes_immediately Live market data source: live\data\eth_live_metrics.json. Active monitoring uses Position Register source: live\position_register.json. Monitoring source: live\data\live_monitoring_signals.json. Daily MTM source count: 1.

## Limitations

- This snapshot is a manual research aid, not production execution.
- Circuit breakers block trade recommendations when required data is missing, stale, or unavailable.
- Funding, fees, slippage, liquidation, and margin stress remain outside this v0.1 snapshot.
