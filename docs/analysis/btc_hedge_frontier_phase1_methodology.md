# BTC Hedge Frontier Phase 1 Methodology

## Research Question

Does a fixed always-on partial BTC perpetual hedge improve the risk-adjusted profile of BTC CCW without destroying too much upside convexity?

Phase 1 is a screening study. It identifies whether the hedge idea deserves deeper research. It is not an implementation-ready perpetual hedging model.

## Baseline

The baseline is the existing BTC CCW framework:

- weekly OTM10
- 14d OTM10

The baseline artifacts are read from existing batch summaries and referenced annual `trades.csv` files. No baseline backtests are rerun.

## Hedge Ratios

The tested fixed hedge ratios are:

- 0%
- 10%
- 20%
- 30%
- 40%

The 0% variant is the unhedged baseline reconstructed through the same hedge analysis layer.

## Hedge Interpretation

The hedge ratio represents the percentage of BTC spot exposure hedged via short BTC perpetual.

Examples:

```text
0% hedge:
+1 BTC spot
-1 call
0 short perp

20% hedge:
+1 BTC spot
-1 call
-0.2 BTC perpetual

40% hedge:
+1 BTC spot
-1 call
-0.4 BTC perpetual
```

## Cycle Reconstruction

For each cycle:

```text
btc_position = capital_before / S_entry
hedge_btc = hedge_ratio * btc_position
pnl_underlying = btc_position * (S_exit - S_entry)
pnl_call = btc_position * baseline_per_btc_call_pnl
pnl_hedge = -hedge_btc * (S_exit - S_entry)
pnl_total_hedged = pnl_underlying + pnl_call + pnl_hedge
capital_after = capital_before + pnl_total_hedged
```

Capital is recursively updated through the hedged path. This means a hedge ratio can change future cycle sizing through its effect on prior capital.

## Preserved Methodology

The hedge layer preserves:

- baseline option instrument selection
- observed option entry prices
- theoretical option fallback
- synthetic option fallback
- Deribit delivery settlement methodology
- settlement fallback behavior
- natural CCW roll schedule

## Simplifying Assumptions

Phase 1 explicitly ignores:

- funding
- basis
- liquidation risk
- borrow cost
- margin mechanics
- leverage mechanics
- intracycle hedge rebalance
- intracycle mark-to-market stress
- execution slippage on the perpetual hedge

The perpetual hedge is treated as a short BTC exposure that tracks BTC over the cycle.

## Metrics

Primary comparison metrics:

- CAGR
- total return
- max drawdown
- ulcer index
- return over max drawdown
- skewness
- excess kurtosis
- left-tail frequency
- severe loss frequency
- rolling drawdown
- rolling stability
- regime performance

Tail thresholds:

- left-tail frequency: cycles at or below -5%
- severe loss frequency: cycles at or below -10%

These thresholds are simple Phase 1 diagnostics, not final risk limits.

## Findings Style

Findings must remain separated into:

- observations: what the generated metrics show
- interpretations: conservative meaning of those observations
- hypotheses: what may be worth testing next

The findings should avoid claiming economic realism because funding, basis, liquidation, margin, and intracycle mechanics are not modeled.

## Conservative Reading

Phase 1 can support statements like:

- a hedge ratio reduced end-of-cycle drawdown in the reconstructed path
- a hedge ratio reduced ulcer index
- a hedge ratio reduced CAGR or total return
- a hedge ratio may be worth deeper research

Phase 1 should not support statements like:

- a hedge ratio is deployable
- a hedge ratio is optimal in live perpetual markets
- a hedge ratio solves liquidation or margin risk
- a hedge ratio should be dynamically activated

