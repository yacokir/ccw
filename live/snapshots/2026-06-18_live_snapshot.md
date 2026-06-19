# Live Research Snapshot

- Mode: t0.
- Venue: Bybit.
- Decision timestamp: 2026-06-18 10:00 America/New_York.
- Generated at: 2026-06-19T01:29:08.010Z.
- Status: research-grade, read-only, no orders placed.

## Asset Summary

| Asset | Data As Of | Spot | Damage | Alert | Current Hedge | Target Hedge | Delta | Execution State | Circuit Breaker | Reasons |
| --- | --- | ---: | --- | --- | ---: | ---: | ---: | --- | --- | --- |
| BTC | 2026-06-18 | 63,042.40 | stress | stress | 0% | 30% | 30% | HEDGE_30 | OK |  |
| ETH | 2026-06-18 | 1,717.35 | stress | watch | 0% | 0% | 0% | NO_HEDGE | OK |  |

## Details

### BTC

Spot: 63,042.40

Returns

- 7d: -0.88%.
- 30d: -17.92%.
- 90d: -10.55%.

Risk

Realized Vol:

- 2.19% daily.
- 41.82% annualized.

EWMA:

- 2.15% daily.
- 41.11% annualized.

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
- Selected option: BTC-26JUN26-66000-C.
- OTM05 target strike: 66,000.00.
- Premium Status: INDICATIVE_DERIBIT.
- Observed premium: 327.82 USD.
  (Indicative research price, not an executable Bybit quote.)
- Premium source: deribit_bid_ask_mid_underlying_converted_to_usd.
- Option bid / ask / mark / last: 308.91 / 346.73 / 334.12 / 308.91.
- Option warning: No live call option instruments found in public Bybit instrument list.
- Option warning: Bybit option discovery unavailable; used Deribit public option fallback.
- Normal counter: 0.
- Comments: Research-grade read-only snapshot; no orders placed. risk_state_executes_immediately Live market data source: live\data\btc_live_metrics.json. Live option discovery source: live\data\live_option_discovery.json. Monitoring source: live\data\live_monitoring_signals.json. Daily MTM source count: 6.

### ETH

Spot: 1,717.35

Returns

- 7d: 2.66%.
- 30d: -18.65%.
- 90d: -19.94%.

Risk

Realized Vol:

- 3.20% daily.
- 61.23% annualized.

EWMA:

- 3.12% daily.
- 59.64% annualized.

Historical VaR (95%, 1D):

- -5.45%.
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
- Days to expiration (DTE): 8.
- Selected option: ETH-26JUN26-1800-C.
- OTM05 target strike: 1,800.00.
- Premium Status: INDICATIVE_DERIBIT.
- Observed premium: 18.89 USD.
  (Indicative research price, not an executable Bybit quote.)
- Premium source: deribit_bid_ask_mid_underlying_converted_to_usd.
- Option bid / ask / mark / last: 18.03 / 19.75 / 19.58 / 18.89.
- Option warning: No live call option instruments found in public Bybit instrument list.
- Option warning: Bybit option discovery unavailable; used Deribit public option fallback.
- Normal counter: 0.
- Comments: Research-grade read-only snapshot; no orders placed. watch_maps_to_no_hedge Live market data source: live\data\eth_live_metrics.json. Live option discovery source: live\data\live_option_discovery.json. Monitoring source: live\data\live_monitoring_signals.json. Daily MTM source count: 1.

## Limitations

- This snapshot is a manual research aid, not production execution.
- Circuit breakers block trade recommendations when required data is missing, stale, or unavailable.
- Funding, fees, slippage, liquidation, and margin stress remain outside this v0.1 snapshot.
