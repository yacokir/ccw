# Live Research Snapshot

- Mode: t0.
- Venue: Bybit.
- Decision timestamp: 2026-06-19 10:00 America/New_York.
- Generated at: 2026-06-19T12:53:03.694Z.
- Status: research-grade, read-only, no orders placed.

## Asset Summary

| Asset | Data As Of | Spot | Damage | Alert | Current Hedge | Target Hedge | Delta | Execution State | Circuit Breaker | Reasons |
| --- | --- | ---: | --- | --- | ---: | ---: | ---: | --- | --- | --- |
| BTC | 2026-06-19 | 62,840.80 | stress | watch | 0% | 0% | 0% | NO_HEDGE | OK |  |
| ETH | 2026-06-19 | 1,694.94 | stress | stress | 0% | 30% | 30% | HEDGE_30 | OK |  |

## Details

### BTC

Spot: 62,840.80

Returns

- 7d: -1.11%.
- 30d: -18.93%.
- 90d: -8.76%.

Risk

Realized Vol:

- 2.19% daily.
- 41.92% annualized.

EWMA:

- 2.10% daily.
- 40.09% annualized.

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

- Option expiry: 2026-06-26.
- Days to expiration (DTE): 7.
- Selected option: BTC-26JUN26-66000-C-USDT.
- OTM05 target strike: 66,000.00.
- Premium Status: EXECUTABLE_BYBIT.
- Observed premium: 262.50 USD.
- Premium source: bybit_bid_ask_mid.
- Option bid / ask / mark / last: 260.00 / 265.00 / 263.27 / 210.00.
- Normal counter: 0.
- Comments: Research-grade read-only snapshot; no orders placed. watch_maps_to_no_hedge Live market data source: live\data\btc_live_metrics.json. Live option discovery source: live\data\live_option_discovery.json. Monitoring source: live\data\live_monitoring_signals.json. Daily MTM source count: 6.

### ETH

Spot: 1,694.94

Returns

- 7d: 1.76%.
- 30d: -20.37%.
- 90d: -18.64%.

Risk

Realized Vol:

- 3.21% daily.
- 61.35% annualized.

EWMA:

- 3.05% daily.
- 58.27% annualized.

Historical VaR (95%, 1D):

- -5.45%.
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

- Option expiry: 2026-06-26.
- Days to expiration (DTE): 7.
- Selected option: ETH-26JUN26-1775-C-USDT.
- OTM05 target strike: 1,775.00.
- Premium Status: EXECUTABLE_BYBIT.
- Observed premium: 17.55 USD.
- Premium source: bybit_bid_ask_mid.
- Option bid / ask / mark / last: 17.50 / 17.60 / 17.64 / 14.50.
- Normal counter: 0.
- Comments: Research-grade read-only snapshot; no orders placed. risk_state_executes_immediately Live market data source: live\data\eth_live_metrics.json. Live option discovery source: live\data\live_option_discovery.json. Monitoring source: live\data\live_monitoring_signals.json. Daily MTM source count: 1.

## Limitations

- This snapshot is a manual research aid, not production execution.
- Circuit breakers block trade recommendations when required data is missing, stale, or unavailable.
- Funding, fees, slippage, liquidation, and margin stress remain outside this v0.1 snapshot.
