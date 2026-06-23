# Live Research Snapshot

- Mode: ACTIVE_MONITORING_MANUAL.
- Venue: Bybit.
- Decision timestamp: 2026-06-22 10:00 America/New_York.
- Generated at: 2026-06-22T13:01:51.521Z.
- Status: research-grade, read-only, no orders placed.

## Asset Summary

| Asset | Data As Of | Spot | Damage | Alert | Current Hedge | Target Hedge | Delta | Execution State | Circuit Breaker | Reasons |
| --- | --- | ---: | --- | --- | ---: | ---: | ---: | --- | --- | --- |
| BTC | 2026-06-22 | 65,040.90 | stress | watch | 0% | 0% | 0% | NO_HEDGE | OK |  |
| ETH | 2026-06-22 | 1,763.40 | stress | stress | 30% | 30% | 0% | HEDGE_30 | OK |  |

## Details

### BTC

Spot: 65,040.90

Returns

- 7d: -1.88%.
- 30d: -15.21%.
- 90d: -7.77%.

Risk

Realized Vol:

- 2.27% daily.
- 43.33% annualized.

EWMA:

- 2.09% daily.
- 39.94% annualized.

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
- Distance to strike: 1.47%.
- Underlying qty: 1.5.
- Option qty: -1.5.
- Option entry premium: 295.00.
- Premium Status: EXECUTABLE_BYBIT.
- Observed premium: 516.58 USD.
- Premium source: bybit_registered_option_mark_price.
- Option bid / ask / mark / last: 515.00 / 520.00 / 516.58 / 555.00.
- Option MTM P&L: -332.37.
- Greeks delta / gamma / vega / theta: 0.347035 / 0.000163 / 24.482339 / -110.176141.
- Hedge instrument: BTCUSDT.
- Hedge qty: 0.
- Hedge entry price: N/A.
- Normal counter: 0.
- Comments: Research-grade read-only snapshot; no orders placed. watch_maps_to_no_hedge Live market data source: live\data\btc_live_metrics.json. Active monitoring uses Position Register source: live\position_register.json. Monitoring source: live\data\live_monitoring_signals.json. Daily MTM source count: 6.

### ETH

Spot: 1,763.40

Returns

- 7d: -1.77%.
- 30d: -16.69%.
- 90d: -18.18%.

Risk

Realized Vol:

- 3.28% daily.
- 62.66% annualized.

EWMA:

- 2.96% daily.
- 56.47% annualized.

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
- Distance to strike: 0.66%.
- Underlying qty: 30.
- Option qty: -30.
- Option entry premium: 16.90.
- Premium Status: EXECUTABLE_BYBIT.
- Observed premium: 30.37 USD.
- Premium source: bybit_registered_option_mark_price.
- Option bid / ask / mark / last: 30.10 / 30.30 / 30.37 / 30.30.
- Option MTM P&L: -404.02.
- Greeks delta / gamma / vega / theta: 0.467367 / 0.004567 / 0.715428 / -4.566245.
- Hedge instrument: ETHUSDT.
- Hedge qty: -9.
- Hedge entry price: 1,696.07.
- Normal counter: 0.
- Comments: Research-grade read-only snapshot; no orders placed. risk_state_executes_immediately Live market data source: live\data\eth_live_metrics.json. Active monitoring uses Position Register source: live\position_register.json. Monitoring source: live\data\live_monitoring_signals.json. Daily MTM source count: 1.

## Limitations

- This snapshot is a manual research aid, not production execution.
- Circuit breakers block trade recommendations when required data is missing, stale, or unavailable.
- Funding, fees, slippage, liquidation, and margin stress remain outside this v0.1 snapshot.
