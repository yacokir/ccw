# BTC Hedge Frontier Phase 1 Findings

Generated: 2026-05-19T17:51:22.671Z

## Scope

- Analysis-only post-processing of existing BTC CCW OTM10 weekly and 14d baseline runs.
- Hedge ratios: h00, h10, h20, h30, h40.
- Hedge is fixed, always on, and rebalanced only at natural CCW roll boundaries.
- No baseline backtests are rerun and the execution engine is unchanged.

## Methodology Caveats

- Funding, basis, borrow, liquidation risk, margin mechanics, slippage, and intracycle mark-to-market are ignored in Phase 1.
- The perpetual hedge is approximated as short BTC exposure over each CCW cycle.
- Results preserve existing option selection, entry, fallback, and settlement methodology from the unhedged baseline trades.
- Drawdown and rolling metrics are end-of-cycle metrics and may understate intracycle stress.

## Observations

- weekly: baseline weekly h00 total return is 1105.281681%, CAGR 48.046249%, max drawdown -58.712432%, and ulcer index 26.92249.
- weekly: shallowest max drawdown is weekly h40 at -32.489717%.
- weekly: lowest ulcer index is weekly h40 at 12.778769.
- weekly: highest CAGR remains weekly h00 at 48.046249%.
- weekly: highest return-over-drawdown ratio is weekly h00 at 18.825343.
- weekly: h20 changes CAGR by -7.44826 percentage points and max drawdown by 13.222158 percentage points versus h00.
- weekly: h40 changes CAGR by -16.740605 percentage points and max drawdown by 26.222715 percentage points versus h00.
- 14d: baseline 14d h00 total return is 898.693088%, CAGR 43.566325%, max drawdown -45.877646%, and ulcer index 17.225457.
- 14d: shallowest max drawdown is 14d h40 at -27.502357%.
- 14d: lowest ulcer index is 14d h40 at 8.606148.
- 14d: highest CAGR remains 14d h00 at 43.566325%.
- 14d: highest return-over-drawdown ratio is 14d h00 at 19.58891.
- 14d: h20 changes CAGR by -9.99304 percentage points and max drawdown by 8.966739 percentage points versus h00.
- 14d: h40 changes CAGR by -21.287994 percentage points and max drawdown by 18.375289 percentage points versus h00.
- weekly: best one-year rolling drawdown observation is weekly_otm10_h40 at -7.547742%.
- weekly: in the fixed 2022 bear regime, shallowest regime drawdown is weekly_otm10_h40 at -31.492653%.
- 14d: best one-year rolling drawdown observation is 14d_otm10_h40 at -6.023692%.
- 14d: in the fixed 2022 bear regime, shallowest regime drawdown is 14d_otm10_h40 at -18.172948%.

## Interpretations

- The hedge frontier should be read as an end-of-cycle risk overlay test, not a full perpetual trading simulation.
- Improvement in drawdown or ulcer index at small hedge ratios indicates reduced long-delta exposure, but the same hedge can mechanically reduce upside capture in strong BTC regimes.
- A hedge ratio is economically interesting only if the risk improvement is large enough to justify the observed CAGR and total-return drag under these simplified assumptions.
- Weekly and 14d rows are comparable only as CCW cycle systems; their cycle counts differ, and simple Sharpe/Sortino values remain cycle-based rather than annualized.

## Hypotheses

- If h10 or h20 materially lowers drawdown and ulcer index while preserving most CAGR, it may define the first candidate survivability sweet spot for later funding-aware research.
- If h30 or h40 dominates drawdown metrics but causes steep CAGR compression, the frontier likely becomes too defensive for a structurally long BTC CCW objective.
- 14d may tolerate small fixed hedges differently from weekly because it has fewer rolls and a different premium/upside tradeoff, but Phase 1 is not sufficient to infer a dynamic hedge policy.

## Conservative Reading

- Treat any apparent sweet spot as a candidate for later validation, not as an implementable hedge policy.
- Phase 1 asks whether fixed partial hedging is worth researching further; it does not model the operational reality of perpetual hedging.
