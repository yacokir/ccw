# Live Research Execution Playbook

## Status And Scope

This document defines a research-grade live execution playbook for the Dynamic Hedge Overlay on BTC and ETH covered-call portfolios.

It is intended to guide initial live/manual testing only. It is not production execution, not an automated trading system, and not a validated economic model. The procedure translates current research assumptions into an auditable operating routine while Phase 4 Realistic Hedge Economics remains unresolved.

The current live pilot is read-only from the system side. It may retrieve account, market, position, execution, and order-history data, but it does not place orders, cancel orders, modify orders, transfer funds, or withdraw funds.

## Live Workflow Modes

The live pilot separates opening research from active monitoring.

### T0_DISCOVERY

`T0_DISCOVERY` is used only before opening a new covered-call cycle.

- It may run live option discovery.
- It may select the weekly OTM05 option instrument.
- It may generate a T0 discovery snapshot.
- After manual execution, the operator initializes or updates the local Position Register.

### ACTIVE_MONITORING_DAILY

`ACTIVE_MONITORING_DAILY` is used for the once-daily operating check.

- It uses Bybit read-only account synchronization when available.
- It falls back to the local Position Register when account data is unavailable.
- It never performs option discovery.
- It monitors the actual registered instruments.
- It generates the daily monitoring snapshot.
- It generates the recommended static HTML operator reports under `live/reports/`.

### ACTIVE_MONITORING_MANUAL

`ACTIVE_MONITORING_MANUAL` is used for ad hoc checks.

- It uses Bybit read-only account synchronization when available.
- It falls back to the local Position Register when account data is unavailable.
- It never performs option discovery.
- It monitors the actual registered instruments.
- It may be run on demand outside the daily decision time.

After T0, active monitoring must not automatically select a new option. The registered option instrument is the operational source of truth for the active cycle.

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

The optional Phase 3.5A helper script `src/scripts/generate_live_research_snapshot.js` can be used to create a read-only manual decision snapshot under `live/snapshots/`. It reads BTC and ETH Passive Hedge Monitoring v0.4b signal artifacts where available. The current ETH v0.4b artifact uses only the available ETH Weekly OTM05 2025 Daily MTM artifact; this is sufficient to support the live snapshot generator, but it is not yet full multi-year ETH monitoring parity. The helper does not place orders and should preserve circuit breakers when required data is missing, stale, or unavailable.

Snapshot volatility metrics are displayed in both daily and annualized form, using `sqrt(365)` for crypto annualization. Historical VaR is displayed as a 95% one-day empirical historical VaR. The expected tail frequency is an interpretation aid only and does not represent a forecast.

Snapshots may also expose presentation-only decision aids such as `execution_state`, `today_action`, stale-data warnings, and Markdown-oriented numeric formatting. These fields improve manual readability and do not alter model behavior, hedge targets, circuit breakers, or execution assumptions.

Phase 3.5B/3.5C adds an incremental read-only refresh helper, `src/scripts/refresh_live_research_data.js`, for public same-day BTC/ETH price refresh before snapshot generation. The refresh layer writes current price, recent public daily price history, and spot-risk metrics under `live/data/` only. It does not refresh options, recalculate live monitoring states, place orders, or alter hedge methodology.

Phase 3.5D adds `src/scripts/build_live_monitoring_signals.js`, which applies the existing v0.4b monitoring thresholds to the live price-history proxy and writes same-day `damage_state` and `alert_state` under `live/data/`. This remains a research-grade monitoring aid and does not recalibrate thresholds, refresh options, or add execution logic.

Phase 3.5E adds read-only live option discovery for T0 support. The option discovery layer selects the nearest available weekly call around the OTM05 target strike from public option-chain data, records any available public premium fields, and leaves premium null with warnings when unavailable. It does not place orders or validate executable pricing.

## Configuration

Live account synchronization is configured from the local project `.env` file when present:

```text
BYBIT_ENV=demo
BYBIT_API_KEY=
BYBIT_API_SECRET=
BYBIT_ACCOUNT_DIAGNOSTICS=false
BYBIT_RECV_WINDOW=5000
```

Supported `BYBIT_ENV` values are:

- `mainnet`
- `demo`
- `testnet`

Configuration loading order is:

```text
OS environment variables
-> .env
-> script defaults
```

Existing OS environment variables are never overwritten by `.env`. The `.env` file is local operational configuration and must not contain committed secrets.

## Bybit Read-Only Account Synchronization

Active monitoring can synchronize account state from Bybit V5 authenticated read-only endpoints. The sync layer retrieves:

- Wallet balances.
- Spot balances.
- Perpetual positions.
- Option positions.
- Executions.
- Order history.

The current account-sync metadata is carried into `live/data/live_position_monitoring.json`, daily/manual snapshots, and the operator reports. It includes the account-sync environment, base URL, availability, timestamp, and warnings.

If credentials are missing, permissions are insufficient, or Bybit is unavailable, the workflow emits warnings and continues from local Position Register values. This fallback is intentional and should not stop monitoring, report generation, or snapshot generation.

The current Demo Trading environment uses:

```text
BYBIT_ENV=demo
base_url=https://api-demo.bybit.com
```

## Live Accounting Reconstruction

The live accounting layer reconstructs current approximate PnL from synchronized account data and public marks. It is operational monitoring, not a production ledger.

For each active BTC or ETH position, the system attempts to reconstruct:

- `underlying_entry_price`
- `underlying_entry_ts`
- `underlying_cost_basis`
- `underlying_market_value`
- `underlying_unrealized_pnl`
- `option_unrealized_pnl`
- `hedge_unrealized_pnl`
- `net_unrealized_pnl`

Underlying cost basis is reconstructed from synced spot buy executions using weighted average acquisition cost:

```text
average_entry_price = sum(fill_price * fill_qty) / sum(fill_qty)
```

The first implementation is deliberately simple and auditable. It assumes:

- Buy fills only.
- No inventory depletion.
- No partial-disposal accounting.
- No multiple-lot inventory accounting.

If spot executions are unavailable, the workflow falls back to existing Position Register values. If neither account data nor local values can provide an entry price, the report preserves `N/A` and emits the existing warning.

Approximate current net unrealized PnL is:

```text
underlying_unrealized_pnl
+ option_unrealized_pnl
+ hedge_unrealized_pnl
```

The optional accounting fields in `live/position_register.json` are persistence/fallback fields only. They should not be interpreted as a full historical ledger.

## Position Register

The active live pilot uses:

```text
live/position_register.json
```

This file is local operational state. It is ignored by Git, mutable by the operator, and should contain only currently `ACTIVE` positions required for daily or manual monitoring.

When Bybit account synchronization is available, the account API is the preferred source for balances, positions, executions, and order-history-derived accounting fields. The Position Register remains the fallback source and the place where optional accounting persistence fields may be stored.

It is not a historical position database and does not define retention, audit, or closed-cycle storage. Those topics remain future work.

The versioned template is:

```text
live/position_register.example.json
```

The template documents the expected fields only. It should not contain pilot-specific position data.

## Snapshot Naming

Current live snapshots use mode-specific names:

- T0 discovery: `YYYY-MM-DD_t0_discovery_snapshot.*`.
- Daily monitoring: `YYYY-MM-DD_daily_monitoring_snapshot.*`.
- Manual monitoring: `YYYY-MM-DD_HHMM_NY_manual_monitoring_snapshot.*`.

Legacy `*_live_snapshot.*` files may exist from earlier pilot runs, but the current workflow does not generate new files with that naming convention.

## Operator Reports

The preferred daily operator interface is the static HTML report set:

```text
live/reports/ACTIVE_MONITORING_DAILY.html
live/reports/LIVE_POSITION_TIMELINE.html
```

These files are generated locally by the daily monitoring workflow, require no web server, and are fully offline. They are also archived into the matching `live/snapshots/YYYY-MM-DD/` folder.

The markdown reports and CSV export remain available as auxiliary artifacts:

```text
live/ACTIVE_MONITORING_DAILY.md
live/LIVE_POSITION_TIMELINE.md
live/LIVE_POSITION_TIMELINE.csv
```

The HTML reports are intended for the daily one-minute operator review. Markdown and CSV are retained for compatibility, audit, and spreadsheet workflows.

Current reports expose both monitoring state and live accounting context, including:

- Underlying entry price.
- Underlying PnL.
- Option PnL.
- Hedge PnL.
- Net PnL.
- Account-sync environment.
- Account-sync availability.
- Account-sync base URL.
- Account-sync timestamp.

Older archived snapshots and timeline rows may show:

```text
Underlying entry price unavailable; underlying and net PnL are not currently calculable.
```

Those rows are historical artifacts generated before cost-basis reconstruction existed, or during runs where required account data was unavailable. They should not be treated as current errors unless the latest monitoring artifact shows the same warning.

## Daily Automation Wrapper

The optional Windows Task Scheduler wrapper is:

```text
run_live_monitoring_daily_auto.bat
```

It calls the existing daily monitoring workflow only when the current New York date does not already have a daily monitoring snapshot. If the daily snapshot already exists, the wrapper logs that fact and exits successfully without running monitoring again.

Wrapper logs are written under:

```text
logs/live_monitoring/
```

The dry operational check is:

```text
run_live_monitoring_daily_auto_check.bat
```

The check verifies required files and JavaScript syntax, reports the expected daily snapshot path, and does not execute monitoring, generate snapshots, or update `live/data/`.

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
- Live accounting reconstruction is approximate and currently uses simple weighted-average spot buy cost basis without lot depletion or partial-disposal accounting.

The current procedure is suitable for controlled manual observation and audit logging. It should not be treated as a production hedge policy or as proof that Dynamic Hedge Overlay improves live after-cost performance.
