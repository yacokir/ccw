# Feature Summary

- Implemented a post-processing execution friction analyzer for CCW backtest outputs.
- Added research documentation for weekly BTC baseline interpretation and execution friction assumptions.
- Added one-time migration utilities for analysis output structure and run folder naming.
- Main objective: evaluate whether weekly BTC covered-call results survive approximate execution-friction assumptions without changing or rerunning the core backtest.
- Final behavior: friction analysis reads existing run outputs, writes model-specific summaries under `analysis/execution_friction/<model>/`, and leaves raw run files unchanged.

# Metadata

- Generated: 2026-05-13
- Author: Codex

# Scope Boundary

This handoff covers only:

- execution friction analysis
- naming migration
- analysis folder migration

It does NOT include:

- risk layer
- tenor expansion
- asset expansion
- hedge architecture
- advanced execution realism

# Repository State

- Branch: `main`
- Last known commit: `a64632d`
- Feature status: partial / experimental

# Files Created

- `src/scripts/analyze_execution_friction.js`
- `src/scripts/migrate_analysis_structure.js`
- `src/scripts/migrate_run_naming.js`
- `docs/analysis/README.md`
- `docs/analysis/weekly_btc_baseline.md`
- `docs/analysis/execution_friction.md`
- `docs/handoffs/weekly_baseline_execution_friction_handoff.md`

# Files Modified

- `README.md`
- `docs/ROADMAP.md`
- `docs/DECISIONS_CURRENT.md`
- `docs/analysis/weekly_btc_baseline.md`
- `docs/analysis/execution_friction.md`
- `src/scripts/analyze_execution_friction.js`

# Key Design Decisions

- Kept execution friction as post-processing, not part of core backtest logic.
- Preserved raw outputs: `trades.csv`, `summary.json`, and `equity_curve.csv` are not modified.
- Supported two friction models:
  - `uniform`: fixed stress/sensitivity haircut scenarios.
  - `moneyness`: dynamic haircut selected from relative moneyness buckets.
- Wrote outputs under `analysis/execution_friction/<model>/` for both single runs and batches.
- Preserved legacy generic friction filenames while also writing model-specific filenames.
- Batch `TOTAL` rows chain returns but do not sum `adjustedFinalCapital`.
- Moneyness friction assumptions are research approximations, not calibrated bid/ask estimates.

# Inputs Used

- Single-run inputs:
  - `runs/<run_name>/trades.csv`
  - `runs/<run_name>/summary.json`
- Batch inputs:
  - `runs/batches/<batch_name>/summary.json`
  - `annualResults[].savedRun.runPath`
  - Each referenced run folder's `trades.csv` and `summary.json`
- Migration inputs:
  - `runs/index.csv`
  - `runs/batches/*/summary.json`
  - `runs/batches/*/summary.csv`
  - Existing old friction folders under `runs/batches/*/friction/`

# Outputs Generated

- Uniform model:
  - `analysis/execution_friction/uniform/execution_friction_uniform_summary.csv`
  - `analysis/execution_friction/uniform/execution_friction_uniform_summary.json`
  - legacy aliases: `execution_friction_summary.csv/json`
- Moneyness model:
  - `analysis/execution_friction/moneyness/execution_friction_moneyness_summary.csv`
  - `analysis/execution_friction/moneyness/execution_friction_moneyness_summary.json`
  - legacy aliases: `execution_friction_summary.csv/json`
- Migration scripts can create:
  - `index.csv.bak`
  - `summary.json.bak`
  - `summary.csv.bak`
- Analysis docs now capture baseline findings, caveats, and future metric placeholders.

# Known Limitations

- No order book simulation.
- No explicit fee model.
- No dynamic hedging model.
- Uniform haircuts are stress tests, not calibrated execution estimates.
- Moneyness-dependent haircuts are conceptual and not calibrated from historical bid/ask data.
- Analyzer outputs summary rows only; it does not write per-trade adjusted friction files.
- Moneyness model uses average exported `relativeMoneyness` and `appliedHaircutPct` at row level.

# Pending Improvements

- Calibrate friction using bid/ask snapshots or observed spreads.
- Add tenor-, volume-, volatility-, and liquidity-dependent friction assumptions.
- Add consistent upside/downside capture, premium yield, drawdown efficiency, and convexity retention metrics.
- Add per-trade friction detail output if deeper diagnostics are needed.
- Re-run comparison across 2-week and monthly tenors.

# Open Questions

- Should execution friction become liquidity-aware later?
- Should adjusted capital chain between yearly runs?
- Should future friction calibration use bid/ask snapshots?

# Commands Used

```powershell
node --check src\scripts\analyze_execution_friction.js
node --check src\scripts\migrate_analysis_structure.js
node --check src\scripts\migrate_run_naming.js
rg -n "Baseline Hardening|friction|execution_friction" docs src -S
git status --short
```

Example runtime commands:

```powershell
node src\scripts\analyze_execution_friction.js --run=runs\<run_name> --model=uniform
node src\scripts\analyze_execution_friction.js --run=runs\<run_name> --model=moneyness
node src\scripts\analyze_execution_friction.js --batch=runs\batches\<batch_name> --model=moneyness
node src\scripts\migrate_analysis_structure.js --dryRun
node src\scripts\migrate_run_naming.js --dryRun
```

# Validation Status

## Validated

- syntax checks
- output path generation
- migration path consistency
- filename/path migration logic

## Not Validated

- full batch reruns
- numerical result verification
- production-scale consistency checks
- execution-friction calibration realism

# Next Recommended Steps

- Run both friction models for each completed weekly BTC batch.
- Compare `uniform` vs `moneyness` results in `docs/analysis/weekly_btc_baseline.md`.
- Add consistent capture/drawdown/premium-yield metrics before closing the weekly BTC baseline.
