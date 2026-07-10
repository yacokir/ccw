# Cycle 01 Plan

This plan is for preparation only. Do not execute this cycle until the planned Friday T0 and after the feasibility decision is explicitly recorded.

## Cycle Identity

- Pilot ID: `2026-07_minimum_capital_pilot`
- Cycle ID:
- Planned T0:
- Planned Expiry:
- Strategy: Weekly OTM05 covered call

## Asset Candidates

| Asset | Candidate? | Rationale | Notes |
| --- | --- | --- | --- |
| BTC |  |  |  |
| ETH |  |  |  |

## Feasibility Inputs

- Minimum Viable Option Size:
- Expected Underlying Requirement:
- Expected Premium:
- Expected Margin / Buffer:
- Hedge State at T0:
- Target Hedge:

## Feasibility Decision

- Decision: `PENDING`
- Decision timestamp:
- Selected asset(s):
- Sizing approved:
- Required buffer available:
- Reason:

## Execution Checklist

- [ ] Initial state document completed after account reset.
- [ ] T0 discovery run reviewed.
- [ ] Option candidate expiry and strike reviewed.
- [ ] Minimum contract size and underlying requirement confirmed.
- [ ] Premium is acceptable for the small-account test.
- [ ] Margin and buffer remain acceptable after proposed spot and option legs.
- [ ] Hedge state and target hedge reviewed.
- [ ] Manual execution plan reviewed before any trade.
- [ ] No automated order placement expected from CCW scripts.

## Do Not Execute Conditions

- [ ] Account was not reset or initial state is incomplete.
- [ ] Starting capital materially differs from the target and has not been explained.
- [ ] Option minimum size requires too much underlying for the capital base.
- [ ] Margin / buffer is insufficient after the proposed position.
- [ ] Bybit Demo data or account sync is unavailable when needed for review.
- [ ] T0 discovery output is stale, incomplete, or inconsistent.
- [ ] The operator cannot update the Position Register immediately after manual execution.
- [ ] Any unexpected open option, perpetual, or hedge position exists.

## Position Register Update Checklist

- [ ] Cycle ID recorded.
- [ ] Asset recorded.
- [ ] Underlying quantity and entry price recorded.
- [ ] Short call symbol, expiry, strike, quantity, and premium recorded.
- [ ] Cycle accounting reference price recorded.
- [ ] Hedge instrument and hedge quantity recorded, if applicable.
- [ ] Manual notes added for any deviations.
- [ ] Active monitoring can identify the registered cycle.
