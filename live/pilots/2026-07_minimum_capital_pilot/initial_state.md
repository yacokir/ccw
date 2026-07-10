# Initial State

This template should be filled only after the Bybit Demo account is reset or otherwise prepared for the Minimum Capital Live Pilot.

Do not use this document as evidence of readiness until the account reset evidence and balances are recorded.

## Pilot Identity

- Pilot ID: `2026-07_minimum_capital_pilot`
- Pilot Name: Minimum Capital Live Pilot
- Start Date: 2026-07-10
- Venue: Bybit
- Environment: Demo
- Target Initial Capital: ~2,000 USDT
- Actual Initial Capital: 2052.3495327 total equity

## Account Reset Evidence

- Reset / preparation timestamp: 2026-07-10T13:04:22.096Z
- Evidence source: `node src/execution_lab/bybit_demo_funds_probe.js --baseline-clean` dry run
- Screenshot / export reference: `execution_lab/output/laboratory_baseline.md`
- Notes: No confirmed baseline-clean was executed. Actual capital is slightly above the 2,000 USDT target and accepted as operationally close enough.

## Starting Balances

### Spot Balances

| Asset | Balance | Notes |
| --- | ---: | --- |
| BTC | 0 | Confirmed absent in wallet readout; treated as zero. |
| ETH | 0 | Confirmed absent in wallet readout; treated as zero. |
| Other | 0 | No other non-zero coins reported. |

### Stablecoin Balances

- USDT balance: 2053.84062099
- USDC balance: 0

## Baseline

- Account Equity: 2052.3495327
- Available Margin: 2052.3495327
- Free Collateral: 2052.3495327
- Total Wallet Balance: 2052.3495327
- Margin Used: 0

## Existing Positions

- Open option positions: 0
- Open perpetual positions: 0
- Existing hedges: 0

## Notes

- Account state notes: Positions count 0; open orders count 0; margin used 0.
- Known limitations: USDT wallet balance is not total account capital; use total equity / total wallet balance for readiness.
- Manual confirmations required: Confirm no new orders or balance changes occurred before Cycle 01 execution.

## Operator Checklist

- [x] Demo account reset or prepared for the new pilot.
- [x] No unintended open option positions.
- [x] No unintended open perpetual positions.
- [x] Stablecoin balance reconciled against the target initial capital.
- [x] Spot balances recorded.
- [x] Margin / collateral availability reviewed.
- [x] No new cycle opened during preparation.
- [ ] Cycle 01 plan reviewed before T0.
