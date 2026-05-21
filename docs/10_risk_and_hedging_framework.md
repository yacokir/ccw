# Risk And Hedging Framework

## Purpose

This document defines the risk and hedging framework for the BTC CCW research project. It separates the current baseline strategy and fixed hedge frontier from future risk-budgeted hedge research, while preserving the existing historical findings and generated artifacts.

The framework is intended to make hedge design explicit before implementation. It describes objectives, hedge architecture, candidate instruments, methodological boundaries, and the roadmap for future risk controls.

## Strategy And Hedge Layers

### Baseline CCW

The baseline covered-call strategy is the core return engine. It owns BTC, sells calls according to the configured tenor and moneyness, and evaluates realized strategy outcomes at cycle resolution.

Baseline CCW results should remain the reference point for all overlay research. Hedging studies should be compared against the unhedged baseline without mutating baseline run outputs or historical conclusions.

### Fixed Partial Hedge Frontier

The fixed hedge frontier is the already implemented phase-1 hedge overlay. It tests always-on partial BTC hedge ratios:

- `h00`
- `h10`
- `h20`
- `h30`
- `h40`

This layer currently covers weekly and 14d OTM10 BTC CCW variants. It is analysis-only post-processing over saved baseline artifacts. The hedge ratio is fixed by configuration, rebalanced at the natural CCW roll, and held constant through the cycle.

The fixed frontier is a benchmark and diagnostic layer. It answers whether simple partial hedging improves drawdown, volatility, and risk-adjusted behavior, but it does not adapt the hedge ratio to volatility, VaR, market regime, or a changing loss budget.

### Risk-Budgeted Cyclical Hedge

The planned risk-budgeted cyclical hedge is a future model that computes the hedge ratio at each CCW roll using volatility, VaR, and a maximum loss budget.

The hedge ratio is calculated at cycle entry. After the roll, the hedge remains fixed until the next CCW cycle. The first version is not an intracycle emergency hedge, not a continuous delta hedge, and not an automatic crisis-response engine.

The intended design is:

```text
cycle entry / roll
  -> estimate volatility
  -> compute VaR-based net exposure target
  -> derive hedge ratio
  -> hold hedge ratio fixed until next roll
```

### Future Intracycle Discretionary Diagnostics

Intracycle crisis management is a separate future layer. It may include diagnostics, alerts, stress flags, or discretionary overlays based on intracycle market conditions.

This layer should not be conflated with the first VaR/EWMA cyclical hedge model. The cyclical hedge determines a hedge ratio at roll time; future intracycle diagnostics would monitor conditions between rolls and may support discretionary decisions or later dynamic overlays.

## Risk Objectives

The primary risk objectives are:

- Reduce violent drawdowns.
- Improve strategy survivability during sharp BTC selloffs.
- Preserve part of the BTC/CCW upside engine.
- Avoid over-hedging that converts the strategy into a low-upside or structurally short-risk product.
- Keep hedge logic interpretable and auditable.

The framework is not designed to eliminate all losses. A hedge can reduce left-tail exposure while still allowing material drawdowns, especially when assumptions about volatility, funding, basis, execution, or liquidity are incomplete.

## Hedge Philosophy

The hedge is not intended to fully delta-neutralize the BTC position. Full neutralization would likely destroy a significant part of the strategy's desired long-BTC exposure and could obscure the economics of the covered-call engine.

The preferred hedge philosophy is partial risk control:

- The CCW strategy remains structurally linked to BTC upside.
- The hedge reduces left-tail exposure during adverse BTC moves.
- The hedge ratio should be capped to limit over-hedging.
- Hedge design should favor robust, explainable rules over optimized historical fit.

A useful hedge should improve survivability and reduce severe path risk without erasing the reason for holding the strategy.

## Hedge Instruments

### Primary Candidate: BTC Perpetuals Or Futures

BTC perpetuals or futures are the primary hedge candidate for the next research phase because they provide direct short BTC exposure and can be mapped cleanly to net BTC exposure.

This makes them a natural candidate for volatility and VaR-based hedge sizing:

```text
net BTC exposure = long BTC exposure - short futures/perp hedge exposure
```

The current research has not yet modeled funding, basis, liquidation, margin, exchange constraints, or stressed liquidity. These must be added before interpreting futures or perpetual hedges as fully tradeable production systems.

### Future Alternatives

Future research may test:

- Protective puts.
- Collars.
- Cash-secured puts.
- Option-based crash hedges.
- Hybrid futures/options overlays.

These alternatives may offer more convex downside protection, but they introduce option premium cost, strike selection, expiry selection, liquidity, implied volatility, and assignment/exercise considerations. They should be evaluated as separate overlay families rather than merged into the first futures/perp hedge model.

## Current Limitations

The current hedge research and planned cyclical model should be interpreted with the following limitations:

- Funding costs are ignored so far.
- Futures/perpetual basis is ignored.
- Liquidation and margin mechanics are ignored.
- Intracycle mark-to-market risk is not modeled.
- Slippage and liquidity stress are not modeled.
- Exchange constraints and collateral management are not modeled.
- Tax, custody, and operational risks are not modeled.
- Current drawdown analytics are primarily end-of-cycle, not full intracycle underwater paths.

These limitations are material. A hedge that appears attractive in analysis-only reconstruction may behave differently once funding, basis, margin, and stressed execution are included.

## Roadmap

The near-term research path is:

1. Validate the fixed hedge frontier outputs.
2. Document fixed hedge findings and benchmark behavior.
3. Implement a risk-budgeted cyclical EWMA/VaR hedge.
4. Compare the cyclical hedge against fixed `h10`, `h20`, and `h40` benchmarks.
5. Add funding, basis, margin, and slippage realism.
6. Add intracycle diagnostic and alert research.
7. Test discretionary or dynamic crisis overlays only after the simpler cyclical hedge is understood.
8. Extend future Monte Carlo work to include hedged and unhedged variants.

Each stage should preserve traceability between baseline CCW results, fixed frontier outputs, and future adaptive hedge outputs.
