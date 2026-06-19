# Live Research Snapshot

- Mode: t0.
- Venue: Bybit.
- Decision timestamp: 2026-06-18 10:00 America/New_York.
- Generated at: 2026-06-19T01:55:45.663Z.
- Status: research-grade, read-only, no orders placed.

## Asset Summary

| Asset | Data As Of | Spot | Damage | Alert | Current Hedge | Target Hedge | Delta | Execution State | Circuit Breaker | Reasons |
| --- | --- | ---: | --- | --- | ---: | ---: | ---: | --- | --- | --- |
| BTC | 2026-06-18 | 62,992.20 | stress | stress | 0% | 30% | 30% | HEDGE_30 | OK |  |
| ETH | 2026-06-18 | 1,712.00 | stress | stress | 0% | 30% | 30% | HEDGE_30 | OK |  |

## Details

### BTC

Spot: 62,992.20

Returns

- 7d: -0.96%.
- 30d: -17.99%.
- 90d: -10.62%.

Risk

Realized Vol:

- 2.19% daily.
- 41.86% annualized.

EWMA:

- 2.16% daily.
- 41.20% annualized.

Historical VaR (95%, 1D):

- -4.19%.
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
- today_action: SELL BTCUSDT PERP (30% of spot exposure).

Position

- Option expiry: 2026-06-26.
- Days to expiration (DTE): 8.
- Selected option: BTC-26JUN26-66000-C-USDT.
- OTM05 target strike: 66,000.00.
- Premium Status: EXECUTABLE_BYBIT.
- Observed premium: 327.50 USD.
- Premium source: bybit_bid_ask_mid.
- Option bid / ask / mark / last: 325.00 / 330.00 / 323.29 / 325.00.
- Normal counter: 0.
- Comments: Research-grade read-only snapshot; no orders placed. risk_state_executes_immediately Live market data source: live\data\btc_live_metrics.json. Live option discovery source: live\data\live_option_discovery.json. Monitoring source: live\data\live_monitoring_signals.json. Daily MTM source count: 6.

### ETH

Spot: 1,712.00

Returns

- 7d: 2.34%.
- 30d: -18.90%.
- 90d: -20.19%.

Risk

Realized Vol:

- 3.21% daily.
- 61.31% annualized.

EWMA:

- 3.13% daily.
- 59.86% annualized.

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
- Days to expiration (DTE): 8.
- Selected option: ETH-26JUN26-1800-C-USDT.
- OTM05 target strike: 1,800.00.
- Premium Status: EXECUTABLE_BYBIT.
- Observed premium: 18.55 USD.
- Premium source: bybit_bid_ask_mid.
- Option bid / ask / mark / last: 18.50 / 18.60 / 18.46 / 18.20.
- Normal counter: 0.
- Comments: Research-grade read-only snapshot; no orders placed. risk_state_executes_immediately Live market data source: live\data\eth_live_metrics.json. Live option discovery source: live\data\live_option_discovery.json. Monitoring source: live\data\live_monitoring_signals.json. Daily MTM source count: 1.

## Limitations

- This snapshot is a manual research aid, not production execution.
- Circuit breakers block trade recommendations when required data is missing, stale, or unavailable.
- Funding, fees, slippage, liquidation, and margin stress remain outside this v0.1 snapshot.
