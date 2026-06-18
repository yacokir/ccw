# Live Research Execution Playbook

## Status And Scope

This document defines a research-grade live execution playbook for the Dynamic Hedge Overlay on BTC and ETH covered-call portfolios.

It is intended to guide initial live/manual testing only. It is not production execution, not an automated trading system, and not a validated economic model. The procedure translates current research assumptions into an auditable operating routine while Phase 4 Realistic Hedge Economics remains unresolved.

## Frozen Execution Assumptions

- Venue: Bybit.
- Assets: BTC and ETH.
- Base strategy: Weekly OTM05 Covered Call.
- Hedge instrument: USDT-settled perpetuals.
- Decision frequency: once per day.
- Decision time: 10:00 AM America/New_York, DST-aware.
- Hedge states:
  - `normal`: 0%.
  - `stress`: 30%.
  - `crisis`: 40%.
- Position management: maintain target positions and execute delta only.
- Same-day hedge activation: allowed.
- Exit rule: close hedge only after 2 consecutive `normal` days.
- Funding: ignored in v0.1.
- Fees: ignored in v0.1.
- Slippage: ignored in v0.1.
- Margin: assume sufficient collateral, with approximately USD 50 additional collateral per asset for initial research testing.

These assumptions are frozen for v0.1 live research logging. They should not be interpreted as evidence that the hedge is economically superior after real-world costs.

## T0 Initial Deployment Procedure

T0 establishes the initial covered-call position, risk state, and hedge state.

1. Run pre-flight checks:
   - Confirm Bybit access.
   - Confirm market data availability.
   - Confirm account balances and collateral.
   - Confirm option chain, selected expiry, and target OTM05 strike.
   - Confirm manual log is ready.
2. Record the baseline regime snapshot.
3. Buy the underlying asset.
4. Sell the weekly OTM05 call.
5. Determine the initial risk state from the latest available monitoring indicators.
6. Determine the required target hedge:
   - `normal`: 0%.
   - `stress`: 30%.
   - `crisis`: 40%.
7. Open the initial USDT perpetual hedge only if required.
8. Freeze the initial system state in the execution log.

The hedge is the last operation:

```text
Buy spot -> Sell call -> Determine state -> Hedge if needed
```

## Baseline Regime Snapshot

The baseline snapshot should be recorded before any initial hedge is opened.

Required fields:

- Timestamp.

For each asset, record:

- Spot price.
- 7d return.
- 30d return.
- 90d return.
- 30d realized volatility.
- EWMA.
- Historical VaR.
- `damage_state`.
- `alert_state`.
- Option strike.
- Expiry.
- Premium.
- Current hedge percentage.

## Daily Operating Procedure

The daily procedure runs once per asset at 10:00 AM America/New_York, DST-aware.

1. Update Daily MTM.
2. Update monitoring indicators.
3. Determine the current risk state.
4. Determine the target hedge percentage.
5. Calculate the hedge delta from the current hedge percentage.
6. Execute only the required delta.
7. Record all required log fields.
8. Do not rebalance intraday.

The operating rule is target-based. Existing hedge exposure is not closed and reopened when the target changes; only the difference between current hedge and target hedge should be traded.

## Hysteresis And Churn Control

The playbook uses simple hysteresis to reduce unnecessary hedge churn.

- Risk increases execute immediately.
- A move from `crisis` to `stress` reduces the hedge immediately.
- A move to `normal` does not close the hedge immediately.
- Hedge closure occurs only after 2 consecutive `normal` days.
- The normal-day counter resets to zero on any `stress` or `crisis` day.

This rule is operational, not economically validated. It is designed to make live research behavior auditable while avoiding rapid close/reopen cycles.

## Circuit Breakers

No trade should be executed if any circuit breaker is active:

- Daily MTM is unavailable.
- Monitoring indicators are stale.
- Bybit is unavailable.
- Market data appears abnormal.
- Collateral is insufficient.
- Connectivity is unstable.

If a circuit breaker blocks execution, record the intended target hedge, the skipped delta, the reason for the block, and the resulting unchanged hedge state.

## Logging Fields

Each decision should be logged with the following fields:

- Date.
- Decision timestamp.
- Asset.
- Spot price.
- Option strike.
- Expiry.
- Premium.
- `damage_state`.
- `alert_state`.
- Portfolio state.
- Current hedge.
- Target hedge.
- Executed delta.
- Resulting hedge.
- Normal counter.
- Comments.

Logs should preserve the difference between the model state, the intended target, the executed delta, and the resulting position.

## Limitations

This playbook is research-grade only and has material unresolved limitations:

- No funding modeled yet.
- No execution fee modeled yet.
- No slippage modeled yet.
- No liquidation model.
- No margin stress model.
- No proof of economic superiority.
- Phase 4 Realistic Hedge Economics remains unresolved.

The current procedure is suitable for controlled manual observation and audit logging. It should not be treated as a production hedge policy or as proof that Dynamic Hedge Overlay improves live after-cost performance.
