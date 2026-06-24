# Strategy Capital Requirements

## Purpose And Scope

This document defines a research-only framework for empirical study of strategy capital requirements.

It exists to support Track B capital requirements research while preserving the separation from Track A research, backtesting, manual live pilot, and monitoring infrastructure.

No conclusions have been reached. This document provides research structure only.

This document does not provide:

- Production sizing recommendations.
- Client allocation rules.
- Trading recommendations.
- Investment advice.
- Margin or liquidation guarantees.
- Evidence that any strategy is suitable for production trading.

## Research Status

Capital requirements are unresolved.

Existing CCW and hedge-overlay research has not yet fully modeled:

- Initial margin.
- Maintenance margin.
- Collateral buffers.
- Hedge capital requirements.
- Stress and liquidation buffers.
- Fees.
- Funding.
- Slippage.
- Basis.
- Partial fills.
- Venue-specific account constraints.

Until those items are studied empirically, no strategy-level capital recommendation should be treated as final.

## Track Boundary

This document belongs to Track B.

Track B is experimental only, paper-environment only, non-production, isolated from the manual live pilot, and not allowed to interact with current live monitoring workflows or automatically execute strategies.

Track A live monitoring artifacts may inspire research questions, but they should not be used as a production capital engine.

## Capital Definitions

### Minimum Theoretical Capital

Minimum theoretical capital is the lowest capital amount that appears sufficient under simplified model assumptions.

It may ignore operational buffers, venue constraints, funding, fees, slippage, liquidation risk, and partial fills. It is useful only as a lower-bound research reference.

### Minimum Operational Capital

Minimum operational capital is the lowest capital amount that appears sufficient after adding basic operational constraints.

It should consider:

- Initial margin.
- Maintenance margin.
- Expected fees.
- Expected funding.
- Basic slippage.
- Minimum order sizes.
- Collateral availability.
- Expected hedge requirements.

It is still not a production recommendation.

### Recommended Capital

Recommended capital is a future research output that would include empirically tested buffers for ordinary operating conditions.

No recommended capital level has been selected.

### Comfortable Capital

Comfortable capital is a future research output that would include additional buffers for stressed conditions, operational delays, and adverse basis or funding environments.

No comfortable capital level has been selected.

## Margin Concepts

### Initial Margin

Initial margin is the capital or collateral required to open a position.

Research should measure how initial margin changes across:

- Asset.
- Instrument.
- Strategy.
- Hedge ratio.
- Volatility regime.
- Venue account type.
- Portfolio margin assumptions, where applicable.

### Maintenance Margin

Maintenance margin is the capital or collateral required to keep a position open.

Research should study how maintenance margin behaves under adverse price movement, changing volatility, hedge losses, and option mark changes.

## Collateral Buffers

Collateral buffers are capital amounts held above estimated margin requirements.

Potential buffer categories:

- Normal operating buffer.
- Funding buffer.
- Fee buffer.
- Slippage buffer.
- Basis buffer.
- Gap-risk buffer.
- Liquidation buffer.
- Operational-delay buffer.

The correct buffer size is an empirical research question.

## Hedge Capital Requirements

Hedge overlays create capital requirements that differ from unhedged CCW exposure.

Research should estimate capital needed for:

- Opening hedge exposure.
- Maintaining hedge exposure.
- Increasing hedge exposure during stress.
- Reducing hedge exposure after risk normalizes.
- Absorbing hedge losses during sharp reversals.
- Handling funding payments.
- Handling basis between spot, perpetuals, futures, and option settlement.

Hedge capital should be studied separately from base covered-call capital before any combined capital conclusion is drawn.

## Stress And Liquidation Buffers

Stress buffers should account for adverse moves that occur before a strategy can rebalance, reduce exposure, or reconcile state.

Research scenarios should include:

- Sharp underlying price moves.
- Volatility spikes.
- Funding rate shocks.
- Wide spreads.
- Partial fills.
- Venue outages.
- Delayed reconciliation.
- Stale marks.
- Cross-strategy collateral conflict.

Liquidation buffers should be modeled conservatively and should not depend on perfect execution.

## Strategy-Level Capital Allocation

Each strategy should have an explicit capital allocation model.

Research should distinguish:

- Account equity.
- Strategy allocated capital.
- Free collateral.
- Reserved collateral.
- Margin in use.
- Intended exposure.
- Executed exposure.
- Unreconciled exposure.
- Available capital after buffers.

Multi-strategy accounts require additional research because strategies may compete for the same collateral.

## Exposure And Account State Reconciliation

Capital research must reconcile the relationship between intended exposure, executed exposure, account equity, and available collateral.

Required concepts:

- Intended exposure: what the strategy or paper execution model wanted.
- Executed exposure: what the paper or venue state says exists.
- Account equity: total account value under the relevant venue/account model.
- Available collateral: capital available for new orders, margin, and buffers.
- Reserved collateral: capital intentionally unavailable because it supports existing risk.
- Reconciliation difference: mismatch between intended and executed state.

No performance or capital conclusion should be trusted while exposure reconciliation is unresolved.

## Impact Of Costs And Execution Frictions

Capital requirements must eventually include the impact of:

- Fees.
- Funding.
- Slippage.
- Basis.
- Partial fills.
- Minimum order sizes.
- Failed orders.
- Delayed orders.
- Stale orders.
- Mark-price differences.
- Settlement differences.

These factors can change both realized performance and required capital buffers.

## Research Methodology

Suggested research sequence:

1. Define strategy exposure units.
2. Define theoretical minimum capital.
3. Add initial and maintenance margin assumptions.
4. Add expected fees, funding, and slippage.
5. Add hedge capital requirements.
6. Add stress and liquidation buffers.
7. Add partial-fill and delayed-fill assumptions.
8. Reconcile intended exposure, executed exposure, account equity, and available collateral.
9. Compare capital outcomes across assets, strategies, and regimes.
10. Document open questions before drawing conclusions.

## Required Outputs

Future research artifacts should preserve:

- Strategy name.
- Asset.
- Instrument set.
- Account model.
- Capital definition used.
- Initial margin estimate.
- Maintenance margin estimate.
- Collateral buffer estimate.
- Hedge capital estimate.
- Stress buffer estimate.
- Liquidation buffer estimate.
- Fee, funding, slippage, and basis assumptions.
- Partial-fill assumptions.
- Reconciliation status.
- Limitations.

## Non-Goals

This document does not define:

- Production capital sizing.
- Client allocation rules.
- Trade recommendations.
- Exchange account setup rules.
- Regulatory capital treatment.
- Tax treatment.
- Final liquidation policy.
- Final hedge policy.

## Open Questions

- What is the correct capital base for CCW: spot notional, option margin, account equity, or strategy allocated capital?
- How much collateral is required when hedge exposure increases during stress?
- How should funding shocks be converted into capital buffers?
- How should basis between spot, perpetuals, futures, and option settlement be modeled?
- How much extra capital is needed for partial fills and delayed reconciliation?
- How should multi-strategy collateral conflicts be resolved?
- What capital threshold should trigger a circuit breaker in paper research?
- Which capital metrics are stable enough to compare across assets?

## Current Conclusion

No conclusions have been reached.

Capital requirements remain an open research topic. Any future estimate must be labeled with its assumptions, limitations, and reconciliation status before it can be used for comparison. None of the concepts in this document should be interpreted as production sizing, client allocation, or trading advice.
