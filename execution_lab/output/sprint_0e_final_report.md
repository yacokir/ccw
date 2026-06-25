# Execution Laboratory

## Sprint 0E Final Report

Environment:
Demo

Objective:
Validate minimum covered call execution feasibility.

Result:
SUCCESS

Final Conclusion:
"0.01 BTC covered call is operationally feasible on Bybit Demo."

## Structure

Underlying:
+0.010989 BTC

Short Call:
-0.01 BTC-26JUN26-62500-C-USDT

Option Instrument:
BTC-26JUN26-62500-C-USDT

Option Quantity:
0.01

Average Option Price:
10

## Wallet State

BTC: 0.010989
USDT: 1346.2639
ETH: 0
USDC: 0

## Account State

Available Balance: 1314.57010566
Equity: 1994.54930259
Margin Utilization: 0.01488585
Initial Margin: 29.69055364
Maintenance Margin: 18.99377265

Positions:
1

Open Orders:
0

## Position

- Category: option
- Symbol: BTC-26JUN26-62500-C-USDT
- Side: Sell
- Size: 0.01
- Avg Price: 10
- Position IM: 29.73479902
- Position MM: 19.0220775

## Operational Findings

- Bybit Demo accepted a minimum BTC covered-call structure.
- Spot fee was charged in BTC.
- Buying exactly 0.01 BTC was insufficient after fee; 0.011 BTC produced net coverage above 0.01 BTC.
- Short call position was detected with size 0.01 and avgPrice 10.
- Open orders were 0 after the test.

## Bugs Found

- Immediate fill/order-history classification was too brittle.
- Option orderLinkId exceeded Bybit's 36-character limit.
- Baseline clean reduced excess assets but initially did not restore USDT to 2000 when below target.

## Bugs Fixed

- Separated order submission, fill detection, BTC balance delta, execution success, and coverage sufficiency.
- Shortened option-sale orderLinkId prefix.
- Extended baseline clean to add missing USDT and reconcile to the 2000 USDT target.

## Lessons Learned

- Covered-call acceptance requires net BTC coverage, not gross BTC order quantity.
- Wallet deltas and position detection are important execution evidence.
- Option acceptance is observable through the short option position.
- This remains paper-only and non-production.

## Research Conclusions

- Minimum covered call acceptance is operationally feasible in Bybit Demo.
- This does not validate production execution, expiry handling, assignment, settlement, close workflow, roll workflow, or risk automation.

## Final Conclusion

"0.01 BTC covered call is operationally feasible on Bybit Demo."
