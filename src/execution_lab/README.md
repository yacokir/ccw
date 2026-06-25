# Execution Laboratory

## Purpose

This folder contains Track B execution laboratory foundations.

Track B is experimental only, paper-environment only, non-production, and fully isolated from Track A. It must not interact with the current manual live pilot, live monitoring workflows, live position register, reports, snapshots, or existing monitoring scripts.

## Current Scope

Sprint 0A includes:

- A local configuration template.
- A read-only Bybit demo connectivity probe.
- Isolated JSON snapshots under `analysis/generated/execution_lab/`.

The probe does not place, cancel, amend, or modify orders. It does not adjust demo funds. It does not call Track A live monitoring scripts.

Sprint 0B adds demo-funds research:

- A separate Bybit demo funds probe.
- Dry-run as the default mode.
- Optional tiny USDT reduction only when an explicit command-line flag is provided.
- Optional target-balance reduction only when both target and confirmation flags are provided.
- Isolated JSON snapshots under `analysis/generated/execution_lab/`.

Sprint 0B does not place, cancel, amend, or modify orders. It does not call Track A live monitoring scripts and does not touch `live/`.

Sprint 0C adds capital-readiness research:

- A capital snapshot script for the current Bybit demo account.
- A normalized accounting model for account equity, available balance, margin, positions, open orders, and exposure.
- Research vocabulary for future minimum theoretical capital, minimum operational capital, recommended capital, and comfortable capital.
- No capital conclusions.

Sprint 0C is read-only. It does not adjust demo funds, place orders, cancel orders, amend orders, call Track A live monitoring scripts, or touch `live/`.

Sprint 0D adds pre-trade simulation research:

- A read-only simulation for a minimum BTC covered-call starting point.
- Target underlying quantity: `0.01 BTC`.
- Estimated underlying notional and simple hedge notionals.
- Preliminary capability fields limited to observable account and market data.

Sprint 0D sends no POST requests. It does not place orders, cancel orders, amend orders, adjust demo funds, call Track A live monitoring scripts, or touch `live/`.

Sprint 0D.1 adds instrument feasibility research:

- Reads observable Bybit demo instrument specifications for BTC spot, BTC perpetual, and BTC options.
- Extracts minimum quantity, quantity step, tick size, leverage filters, settlement assets, and supported option expiries where available.
- Checks whether the `0.01 BTC` target appears compatible with observable spot and option quantity constraints.
- Does not infer hidden venue behavior.

Sprint 0D.1 sends no POST requests. It does not place orders, cancel orders, amend orders, adjust demo funds, call Track A live monitoring scripts, or touch `live/`.

## Local Configuration

Copy the example config:

```text
src/execution_lab/execution_lab_config.example.json
```

to the local ignored file:

```text
src/execution_lab/execution_lab_config.json
```

Then fill in Bybit demo credentials:

```json
{
  "environment": "demo",
  "baseUrl": "https://api-demo.bybit.com",
  "apiKey": "YOUR_DEMO_API_KEY",
  "apiSecret": "YOUR_DEMO_API_SECRET",
  "recvWindow": 5000
}
```

The real config file is ignored by Git. Do not commit real credentials.

## Read-Only Probe

Run:

```text
node src/execution_lab/bybit_demo_readonly_probe.js
```

The probe reads:

- Wallet balances.
- Linear positions.
- Option positions.
- Spot open orders.
- Linear open orders.
- Option open orders.
- Recent spot fills.
- Recent linear fills.
- Recent option fills.

It writes a timestamped snapshot to:

```text
analysis/generated/execution_lab/
```

## Demo Funds Probe

Sprint 0B studies the Bybit demo funds endpoint in a conservative way.

Bybit documents the Demo Trading Service funds endpoint as:

```text
POST /v5/account/demo-apply-money
```

The documented `adjustType` behavior is:

- `0`: add demo funds.
- `1`: reduce demo funds.

This lab script hardcodes reduce-only behavior for actual calls. It only supports `USDT` and never calls order endpoints.

Dry-run:

```text
node src/execution_lab/bybit_demo_funds_probe.js
```

Tiny USDT reduction test:

```text
node src/execution_lab/bybit_demo_funds_probe.js --reduce-test-usdt=10
```

Target-balance dry-run:

```text
node src/execution_lab/bybit_demo_funds_probe.js --target-usdt=2000
```

Confirmed target-balance reduction:

```text
node src/execution_lab/bybit_demo_funds_probe.js --target-usdt=2000 --confirm-target-reduction
```

Do not run reduction commands casually. The endpoint has side effects in the Bybit demo account. Use dry-run first and review the generated snapshot before any test or target reduction.

Target-balance mode:

- Reads the current USDT wallet balance.
- If current balance is above target, calculates `current - target`.
- If confirmation is missing, prints and snapshots what it would do without POST.
- If confirmation is present, reduces USDT by the calculated amount.
- If current balance is below target, aborts because this script never adds funds.

The funds probe writes timestamped snapshots to:

```text
analysis/generated/execution_lab/
```

Snapshots include:

- Mode.
- Requested reduction.
- Before wallet.
- After wallet when an actual reduction is run.
- Warnings.
- API response when a POST is called.

Safety constraints:

- Demo environment only.
- `https://api-demo.bybit.com` only.
- USDT only.
- Reduce only, never add.
- Maximum one-off test reduction: 10 USDT.
- Minimum target balance: 500 USDT.
- Maximum target balance: 50000 USDT.
- Target reduction requires `--confirm-target-reduction`.
- No order endpoints.
- No Track A files.
- No `live/` files.
- Real credentials must never be committed.

## Capital Snapshot

Sprint 0C establishes the accounting model and research vocabulary for future capital requirements work.

Run:

```text
node src/execution_lab/bybit_capital_snapshot.js
```

The capital snapshot reads:

- Wallet balances.
- Account equity.
- Available balance.
- Collateral fields when available.
- Margin fields when available.
- Positions.
- Open orders.

It writes a timestamped snapshot to:

```text
analysis/generated/execution_lab/
```

The normalized snapshot includes:

- `account`: account equity, wallet balance, available balance, margin balance, free collateral, margin in use, position count, and open order count.
- `strategyCapitalModel`: strategy allocated capital, capital in use, capital available, intended exposure, executed exposure, and unreconciled exposure.
- `research`: minimum theoretical capital, minimum operational capital, recommended capital, and comfortable capital.

The research fields intentionally remain `null` or `not determined`. Sprint 0C establishes structure only. It does not produce production sizing recommendations, client allocation rules, or trading recommendations.

## Pre-Trade Simulation

Sprint 0D provides a read-only exploratory simulation for a possible minimum BTC covered-call experiment.

Run:

```text
node src/execution_lab/bybit_pretrade_simulation.js
```

The simulation reads:

- Wallet balances.
- Account equity and available balance.
- BTC spot and linear market data.
- BTC spot, linear, and option instrument specifications when available.
- Current positions.
- Current open orders.

It writes a timestamped snapshot to:

```text
analysis/generated/execution_lab/
```

The simulation estimates:

- Underlying notional for `0.01 BTC`.
- Capital consumed by the underlying purchase only.
- Remaining USDT capital after the underlying estimate.
- Covered-call contract quantity placeholder.
- 30% and 40% hedge notionals.

This is an exploratory framework only. It sends no orders, draws no margin conclusions, and performs no strategy execution. Covered-call and hedge support may remain `unknown` when they require option margin, hedge margin, liquidity, or execution assumptions not directly observed by the script.

## Instrument Feasibility

Sprint 0D.1 checks minimum-position feasibility using observable exchange metadata only.

Run:

```text
node src/execution_lab/bybit_instrument_feasibility.js
```

The script reads:

- Wallet balances.
- BTC spot ticker and instrument specification.
- BTC perpetual ticker and instrument specification.
- BTC option instrument specifications when available.

It writes a timestamped snapshot to:

```text
analysis/generated/execution_lab/
```

The script reports whether the minimum BTC covered-call components appear feasible from visible constraints:

- Minimum underlying quantity.
- Minimum option quantity.
- Combined minimum covered-call quantity.

The result is observational only. It does not estimate margin, does not infer hidden exchange behavior, does not place orders, and does not produce final feasibility conclusions.

## Boundaries

This folder is not a production execution system. It is not a strategy automation system. It is not part of Track A manual live monitoring.
