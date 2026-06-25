# Execution Laboratory

## First Minimum Covered Call Acceptance Test

Generated at: 2026-06-25T18:39:18.670Z
Mode: EXECUTE

Initial Capital: 2000 USDT

## Underlying Purchase

Status: EXECUTION_SUCCESS_COVERAGE_SUFFICIENT
Requested BTC Purchase: 0.011
Order Submitted: YES
Order Filled: NO
Executed BTC Purchase: 0
BTC Before: 0
BTC After: 0.010989
BTC Delta: 0.010989
BTC Balance Increased: YES
USDT Before: 2000
USDT After: 1346.1699
USDT Delta: -653.8301
BTC Net Received: 0.010989
Fees: {}
Execution Success: YES
Coverage Sufficient: YES
BTC Position: 0.010989
Average Price: unknown
Order ID: 2245435441799236864

## Option Sale

Status: FAILED
Option Sale Attempted: NO
Short Call Instrument: BTC-26JUN26-62500-C-USDT
Premium: unknown
Order ID: unknown

## Account State

Margin Used: 0 USDT
Available Capital: 1346.1699 USDT
Final Positions: 0

## Warnings

- None.

## Limitations

- Default mode is read-only and does not empirically test order acceptance.
- Execute mode is Demo-only but places real Demo orders and intentionally does not manage or unwind positions.
- The script is fail-fast and has no retries; transient API or matching-engine behavior may require manual review.
- Spot BTC is confirmed through wallet BTC balance because spot holdings are not represented like derivatives positions.
- Spot buy execution and covered-call coverage are tracked separately because fees may be charged in BTC.
- Option premium is estimated from execution-list execValue when available.
- No Track A files, live monitoring workflows, strategy automation, schedulers, or continuous loops are used.

