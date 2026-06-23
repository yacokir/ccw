# Live Research Snapshot

- Mode: ACTIVE_MONITORING_MANUAL.
- Venue: Bybit.
- Decision timestamp: 2026-06-22 10:00 America/New_York.
- Generated at: 2026-06-22T15:43:06.488Z.
- Status: research-grade, read-only, no orders placed.

## Asset Summary

| Asset | Data As Of | Spot | Damage | Alert | Current Hedge | Target Hedge | Delta | Execution State | Circuit Breaker | Reasons |
| --- | --- | ---: | --- | --- | ---: | ---: | ---: | --- | --- | --- |
| BTC | 2026-06-22 | 65,066.00 | stress | watch | 0% | 0% | 0% | NO_HEDGE | OK |  |
| ETH | 2026-06-22 | 1,754.82 | stress | stress | 30% | 30% | 0% | HEDGE_30 | OK |  |

## Details

### BTC

Spot: 65,066.00

Returns

- 7d: -1.84%.
- 30d: -15.18%.
- 90d: -7.73%.

Risk

Realized Vol:

- 2.27% daily.
- 43.36% annualized.

EWMA:

- 2.09% daily.
- 40.00% annualized.

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
- Distance to strike: 1.44%.
- Underlying qty: 1.5.
- Underlying entry price: N/A.
- Underlying unrealized PnL: N/A.
- Option qty: -1.5.
- Option entry premium: 295.00.
- Premium received: 442.50.
- Premium Status: EXECUTABLE_BYBIT.
- Observed premium: 502.24 USD.
- Premium source: bybit_registered_option_mark_price.
- Option bid / ask / mark / last: 495.00 / 500.00 / 502.24 / 490.00.
- Option MTM P&L: -310.87.
- Greeks delta / gamma / vega / theta: 0.347298 / 0.000168 / 24.135990 / -110.232770.
- Hedge instrument: BTCUSDT.
- Hedge qty: 0.
- Hedge entry price: N/A.
- Hedge mark price: N/A.
- Hedge unrealized PnL approx: N/A.
- Net unrealized PnL approx: N/A.
- Option warning: Underlying entry price is unavailable; underlying PnL is N/A.
- Option warning: Underlying entry price is unavailable; underlying unrealized PnL is N/A.
- Normal counter: 0.
- Comments: Research-grade read-only snapshot; no orders placed. watch_maps_to_no_hedge Live market data source: live\data\btc_live_metrics.json. Active monitoring uses Position Register source: live\position_register.json. Monitoring source: live\data\live_monitoring_signals.json. Daily MTM source count: 6.

### ETH

Spot: 1,754.82

Returns

- 7d: -2.24%.
- 30d: -17.09%.
- 90d: -18.58%.

Risk

Realized Vol:

- 3.26% daily.
- 62.31% annualized.

EWMA:

- 2.92% daily.
- 55.87% annualized.

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
- Distance to strike: 1.15%.
- Underlying qty: 30.
- Underlying entry price: N/A.
- Underlying unrealized PnL: N/A.
- Option qty: -30.
- Option entry premium: 16.90.
- Premium received: 507.00.
- Premium Status: EXECUTABLE_BYBIT.
- Observed premium: 25.10 USD.
- Premium source: bybit_registered_option_mark_price.
- Option bid / ask / mark / last: 24.80 / 25.10 / 25.10 / 24.30.
- Option MTM P&L: -246.12.
- Greeks delta / gamma / vega / theta: 0.423169 / 0.004696 / 0.690483 / -4.437152.
- Hedge instrument: ETHUSDT.
- Hedge qty: -9.
- Hedge entry price: 1,696.07.
- Hedge mark price: 1,754.81.
- Hedge unrealized PnL approx: -528.66.
- Net unrealized PnL approx: N/A.
- Option warning: Underlying entry price is unavailable; underlying PnL is N/A.
- Option warning: Underlying entry price is unavailable; underlying unrealized PnL is N/A.
- Normal counter: 0.
- Comments: Research-grade read-only snapshot; no orders placed. risk_state_executes_immediately Live market data source: live\data\eth_live_metrics.json. Active monitoring uses Position Register source: live\position_register.json. Monitoring source: live\data\live_monitoring_signals.json. Daily MTM source count: 1.

## Limitations

- This snapshot is a manual research aid, not production execution.
- Circuit breakers block trade recommendations when required data is missing, stale, or unavailable.
- Funding, fees, slippage, liquidation, and margin stress remain outside this v0.1 snapshot.
