# Hedge Frontier Research Phase 1 Architecture

## Purpose

Hedge Frontier Research Phase 1 evaluates whether a fixed always-on partial BTC perpetual hedge improves the risk-adjusted profile of the BTC CCW system.

This phase is intentionally simple. It is an analysis-only post-processing layer over existing BTC CCW baseline artifacts.

## Scope

Included:

- BTC only.
- Tenors: weekly and 14d.
- Moneyness: OTM10 only.
- Hedge ratios: 0%, 10%, 20%, 30%, 40%.
- Hedge rebalance only at the natural CCW roll.
- Existing option selection, entry, fallback, and settlement methodology preserved.

Excluded:

- Dynamic hedge ratios.
- Volatility targeting.
- Regime-aware hedge activation.
- Intracycle hedge rebalance.
- Adaptive delta hedging.
- Predictive timing models.
- Machine learning.
- Monte Carlo.
- Funding, basis, liquidation, margin, and leverage mechanics.

## Layer Placement

The hedge layer lives in the analysis layer, not the execution engine.

Primary files:

- `src/scripts/btc_hedge_frontier_utils.js`
- `src/scripts/build_btc_hedge_frontier_phase1.js`
- `src/scripts/build_btc_hedge_visualizations.js`

This preserves backward compatibility because no existing run output, backtest engine behavior, run index, or baseline artifact format is modified.

## Data Flow

Existing baseline artifacts:

```text
runs/batches/**/summary.json
  -> referenced annual runs/**/trades.csv
  -> hedge reconstruction
  -> generated hedge analysis outputs
  -> generated hedge charts
```

The hedge layer reads saved baseline cycle facts:

- entry date
- exit date
- `S_entry`
- `S_exit`
- `pnl_call`
- `btc_position`
- baseline capital path

It then reconstructs a hedged capital path per hedge ratio.

## Hedge Model

At each CCW roll:

```text
btc_position = hedged_capital_before / S_entry
hedge_btc = hedge_ratio * btc_position
pnl_hedge = -hedge_btc * (S_exit - S_entry)
pnl_total_hedged = pnl_underlying + pnl_call + pnl_hedge
capital_after = capital_before + pnl_total_hedged
```

The hedge is fixed during the cycle and rebalanced at the next natural CCW roll.

## Naming

Hedge labels:

- `h00`
- `h10`
- `h20`
- `h30`
- `h40`

Strategy labels:

- `weekly_otm10_h00`
- `weekly_otm10_h20`
- `14d_otm10_h30`

Generated outputs use the prefix:

```text
btc_hedge_frontier_phase1_*
```

Generated charts use the prefix:

```text
btc_hedge_*
```

## Runtime Impact

Phase 1 does not rerun backtests and does not call external market data.

Expected runtime is low because the scripts read existing local CSV/JSON artifacts and perform deterministic arithmetic.

## Compatibility

Backward compatibility is preserved by design:

- No execution-engine rewrite.
- No changes to `runStrategy`.
- No changes to baseline batch output naming.
- No changes to `runs/index.csv`.
- No changes to existing generated analysis outputs except the visualization index gaining a Hedge Frontier section.

