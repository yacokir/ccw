# Minimum Capital Live Pilot

Pilot ID:
2026-07_minimum_capital_pilot

Status:
Preparation

Lifecycle:
Preparation
-> Cycle 01
-> Additional Cycles
-> Pilot Review

## Purpose

This pilot validates whether the CCW live/manual workflow is operationally viable from a small starting capital base of approximately 2,000 USDT in Bybit Demo.

The prior live pilot validated the operating mechanics on a larger demo account: active monitoring, expiry handling, Bybit USDT option cash settlement, `DELIVERY` transaction-log interpretation, preservation of UA spot after expiry, Current Cycle Accounting, Portfolio / Lifetime Accounting, reports, and the CCW Live Console. This new phase starts after that validation because its question is different: not "does the workflow function?", but "can it function with minimum practical capital?"

## Hypothesis

A small-account CCW pilot can be operated manually with Weekly OTM05 covered calls if position sizing, margin, buffer, and operational discipline are conservative enough.

This pilot is not intended to optimize returns or introduce new rules. It is a capital-feasibility and operating-friction test.

## Success Criteria

The pilot will be considered operationally successful if:

- it can be operated with approximately 2,000 USDT;
- the minimum option size is operationally viable;
- margin and buffer remain comfortable during the cycle;
- the hedge can be managed according to the playbook;
- no relevant operational blockers prevent repeating several weekly cycles.

These are operational criteria, not rigid performance metrics.

## Scope

- Target initial capital: approximately 2,000 USDT.
- Venue: Bybit.
- Environment: Demo.
- Base strategy: Weekly OTM05.
- Execution style: manual / read-only system support.
- Focus: sizing, margin, buffer, option availability, and checklist discipline.

## Operating Calendar

- Wednesday / Thursday: preparation, dry simulation, account reset verification, and checklist review only.
- Friday: first planned T0 for the normal weekly cycle.

No new cycle should be opened during preparation days.

## Documentation Boundary

This folder is intentionally small. It does not add an operations log, ledger, database, historical JSON, or new architecture. It should expand only if the live/manual operation grows or a real operational need appears.

## Files

- `initial_state.md`: template for recording the post-reset demo account state before the first T0.
- `cycle_01_plan.md`: planning checklist for the first minimum-capital cycle.
