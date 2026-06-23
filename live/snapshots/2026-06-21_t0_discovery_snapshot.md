# Live Research Snapshot

- Mode: T0_DISCOVERY.
- Venue: Bybit.
- Decision timestamp: 2026-06-21 10:00 America/New_York.
- Generated at: 2026-06-21T21:06:16.522Z.
- Status: research-grade, read-only, no orders placed.

## Asset Summary

| Asset | Data As Of | Spot | Damage | Alert | Current Hedge | Target Hedge | Delta | Execution State | Circuit Breaker | Reasons |
| --- | --- | ---: | --- | --- | ---: | ---: | ---: | --- | --- | --- |
| BTC | 2026-06-21 | 63,778.30 | stress | watch | 0% | 0% | 0% | NO_HEDGE | OK |  |
| ETH | 2026-06-21 | 1,719.81 | stress | stress | 0% | 30% | 30% | HEDGE_30 | OK |  |

## Details

### BTC

Spot: 63,778.30

Returns

- 7d: -2.94%.
- 30d: -15.54%.
- 90d: -10.00%.

Risk

Realized Vol:

- 2.21% daily.
- 42.29% annualized.

EWMA:

- 2.02% daily.
- 38.51% annualized.

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

- Cycle ID: .
- Option expiry: 2026-06-26.
- Days to expiration (DTE): 5.
- Selected option: BTC-26JUN26-67000-C-USDT.
- OTM05 target strike: 67,000.00.
- Distance to strike: 5.05%.
- Underlying qty: .
- Option qty: .
- Option entry premium: N/A.
- Premium Status: EXECUTABLE_BYBIT.
- Observed premium: 152.50 USD.
- Premium source: bybit_bid_ask_mid.
- Option bid / ask / mark / last: 150.00 / 155.00 / 152.05 / 150.00.
- Option MTM P&L: N/A.
- Greeks delta / gamma / vega / theta: N/A / N/A / N/A / N/A.
- Hedge instrument: .
- Hedge qty: .
- Hedge entry price: N/A.
- Option warning: No option expiry found inside the target 6-9 day weekly window.
- Option warning: Used nearest later weekly Friday expiry as fallback.
- Normal counter: 0.
- Comments: Research-grade read-only snapshot; no orders placed. watch_maps_to_no_hedge Live market data source: live\data\btc_live_metrics.json. Live option discovery source: live\data\live_option_discovery.json. Monitoring source: live\data\live_monitoring_signals.json. Daily MTM source count: 6.

### ETH

Spot: 1,719.81

Returns

- 7d: -0.29%.
- 30d: -16.72%.
- 90d: -20.04%.

Risk

Realized Vol:

- 3.23% daily.
- 61.69% annualized.

EWMA:

- 2.91% daily.
- 55.53% annualized.

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
- current_hedge: 0%.
- target_hedge: 30%.
- delta: 30%.
- today_action: SELL ETHUSDT PERP (30% of spot exposure).

Position

- Cycle ID: .
- Option expiry: 2026-06-26.
- Days to expiration (DTE): 5.
- Selected option: ETH-26JUN26-1800-C-USDT.
- OTM05 target strike: 1,800.00.
- Distance to strike: 4.66%.
- Underlying qty: .
- Option qty: .
- Option entry premium: N/A.
- Premium Status: EXECUTABLE_BYBIT.
- Observed premium: 13.45 USD.
- Premium source: bybit_bid_ask_mid.
- Option bid / ask / mark / last: 13.40 / 13.50 / 13.44 / 13.50.
- Option MTM P&L: N/A.
- Greeks delta / gamma / vega / theta: N/A / N/A / N/A / N/A.
- Hedge instrument: .
- Hedge qty: .
- Hedge entry price: N/A.
- Option warning: No option expiry found inside the target 6-9 day weekly window.
- Option warning: Used nearest later weekly Friday expiry as fallback.
- Normal counter: 0.
- Comments: Research-grade read-only snapshot; no orders placed. risk_state_executes_immediately Live market data source: live\data\eth_live_metrics.json. Live option discovery source: live\data\live_option_discovery.json. Monitoring source: live\data\live_monitoring_signals.json. Daily MTM source count: 1.

## Limitations

- This snapshot is a manual research aid, not production execution.
- Circuit breakers block trade recommendations when required data is missing, stale, or unavailable.
- Funding, fees, slippage, liquidation, and margin stress remain outside this v0.1 snapshot.
