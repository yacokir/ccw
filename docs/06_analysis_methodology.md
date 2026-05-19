# Analysis Methodology

This document describes the current BTC CCW analysis methodology. It consolidates the research layers that sit downstream of saved runs and generated batch outputs. It does not redefine strategy behavior, execution logic, or historical conclusions.

## 1. Analysis Layers

### Batch Summaries

Batch summaries are the first consolidated view of saved backtest runs. They collect run-level outputs such as total return, BTC benchmark return, PnL decomposition, cycle counts, option coverage, fallback usage, and warning metadata.

Batch summaries are useful for broad comparison, but they do not by themselves provide path-aware risk metrics unless downstream analysis reconstructs cycle returns from saved trades.

### Multi-Tenor Analysis

The multi-tenor layer compares BTC CCW configurations across tenor and moneyness using generated batch summaries. It currently covers weekly, 14d, and monthly variants, with primary rankings focused on full-period comparable rows.

This layer is best suited for return, CAGR, BTC-relative return, option coverage, fallback-adjusted scoring, and high-level tenor frontier interpretation. It is not the source of reconstructed equity drawdown or rolling-risk paths.

### Deep-Risk Analysis

The deep-risk layer reconstructs normalized equity from saved annual run `trades.csv` files referenced by batch `summary.json` metadata. It converts cycle returns into a compounded equity path and derives drawdown, cycle-return distribution, simple Sharpe/Sortino, positive/negative cycle frequency, and related risk metrics.

This layer is the current source of path-aware end-of-cycle risk analytics.

### Rolling-Risk Analysis

The rolling-risk layer builds tenor-aware rolling windows from realized cycle returns. Current primary rolling comparisons use approximate one-year windows:

- weekly: 52 cycles
- 14d: 26 cycles
- monthly: 12 cycles

It reports rolling compounded return, rolling cycle-return volatility, rolling downside dispersion, and rolling drawdown inside each window.

### Regime Analysis

The regime layer segments realized cycles into deterministic calendar regimes:

- Bull 2020-2021
- Bear 2022
- Recovery/transition 2023
- ETF/bull 2024-2025

Cycles are assigned by `entry_date`. Return is compounded from cycle returns inside each regime, and volatility, drawdown, hit rate, and average cycle return are computed within that regime.

### Visualization Layer

The visualization layer renders static PNG charts from existing generated analysis outputs. It is presentation-only. It does not rerun backtests, alter source analysis datasets, or change methodology.

Rolling line charts are monthly-bucketed averages by tenor for readability. The source rolling-risk rows remain unchanged.

## 2. Metric Categories

### Return Metrics

Return metrics describe cumulative or annualized performance at the strategy, tenor, moneyness, regime, or rolling-window level. Examples include `totalReturnPct`, `reconstructedTotalReturnPct`, `cagrPct`, `windowReturnPct`, `returnPct`, and `excessReturnVsBtcPct`.

### Drawdown Metrics

Drawdown metrics describe peak-to-trough loss in reconstructed equity or rolling/regime windows. Current drawdown calculations are based on end-of-cycle reconstructed equity, not intracycle mark-to-market paths. Examples include `maxDrawdownPct`, `averageDrawdownPct`, `ulcerIndex`, `rollingDrawdownPct`, and `drawdownPct`.

### Volatility Metrics

Current volatility metrics use cycle return percentages. They are sample standard deviations of observed cycle returns and are not annualized. Examples include `volatilityOfCycleReturns`, `downsideVolatility`, `rollingVolatilityPct`, `rollingDownsideVolatilityPct`, and `volatilityPct`.

### Rolling Metrics

Rolling metrics describe behavior inside overlapping tenor-aware windows. They measure rolling return, rolling volatility, rolling downside dispersion, rolling drawdown, severe drawdown frequency, volatility spike behavior, and rolling-window positivity.

### Regime Metrics

Regime metrics describe behavior inside fixed calendar regimes. They include regime return, regime volatility, regime drawdown, hit rate, and average cycle return by tenor and moneyness.

### Cycle Metrics

Cycle metrics describe the distribution of realized per-cycle returns. They include mean, median, standard deviation, percentiles, skewness, excess kurtosis, tail concentration, severe-loss frequency, capped-upside frequency, best/worst cycle, and positive/negative cycle frequency.

## 3. Current Methodology

### Reconstructed Equity Logic

The deep-risk layer reads saved annual run `trades.csv` files through batch `summary.json` metadata. Normalized equity starts at `1.0` and compounds realized cycle returns in chronological order:

```text
equity_next = equity_current * (1 + cycle_return)
```

The reconstructed total return is derived from the final normalized equity value. It is compared with summary-level return where available, and differences are retained as diagnostics.

### Cycle-Return Reconstruction

Cycle return is read from `return_pct` in `trades.csv` when available. If that field is absent, it is reconstructed from `capital_after / capital_before - 1`.

Cycle returns are the base input for reconstructed equity, deep-risk metrics, rolling windows, regime analysis, and cycle distribution analysis.

### Rolling Window Construction

Rolling windows are built from sequential cycle returns. The window length is tenor-aware:

- weekly windows use 13, 26, and 52 cycles in the source rolling artifact, with 52 cycles used for primary one-year comparisons.
- 14d windows use 6, 13, and 26 cycles in the source rolling artifact, with 26 cycles used for primary one-year comparisons.
- monthly windows use 3, 6, and 12 cycles in the source rolling artifact, with 12 cycles used for primary one-year comparisons.

Each window has a start/end sequence and start/end date. Rolling return compounds cycle returns inside the window. Rolling volatility is sample standard deviation of cycle return percentages inside the window. Rolling drawdown is the worst end-of-cycle peak-to-trough loss inside that window.

### Regime Segmentation Methodology

Regimes are deterministic calendar segments, not model-inferred market states. Cycles are assigned to regimes by `entry_date`. A cycle belongs to the regime containing its entry date, even if its holding period spans a transition boundary.

This keeps regime assignment reproducible and simple, but it can blur regime transitions.

### Drawdown Methodology

Drawdown is computed from reconstructed end-of-cycle equity:

```text
drawdown = equity / running_peak - 1
```

It is reported as a percentage and normally appears as a negative value. Maximum drawdown is the most negative value observed. Drawdown duration is counted in cycles. Ulcer index is the square root of the mean squared drawdown percentages.

This methodology does not model intracycle underwater behavior.

### Rolling Aggregation Methodology

The source rolling-risk artifact keeps all generated rolling windows. For visualization only, rolling line charts aggregate rows to one line per tenor by grouping `tenor + month` using `windowEndDate`, averaging the plotted value inside each month, and plotting the month-start date. This monthly bucketing reduces visual noise and diagonal artifacts while preserving the source rolling dataset.

Current rolling charts use:

- date field: `windowEndDate`
- tenor field: `tenor`
- return field: `windowReturnPct`
- drawdown field: `rollingDrawdownPct`
- one-year filter: weekly `windowCycles = 52`, 14d `windowCycles = 26`, monthly `windowCycles = 12`

## 4. Important Current Limitations

- Cycle-based volatility is not annualized.
- Sharpe and Sortino are tenor-dependent because they use cycle return units.
- Current Sortino denominator is the sample standard deviation of negative cycle returns, which is downside dispersion, not classic downside deviation around a minimum acceptable return.
- Drawdown is based on end-of-cycle reconstructed equity; there is no intracycle drawdown modeling.
- Rolling windows overlap, so rolling observations are not independent samples.
- Settlement and option availability still involve approximations and fallback behavior.
- Fees, slippage, funding, custody, exchange constraints, and financing costs are not yet modeled in the core outputs.
- Partial-period rows are retained for traceability but should not be mixed into primary full-period rankings without explicit labeling.
- Regime assignment by entry date can blur windows or cycles that span regime boundaries.
- Historical folder and run naming conventions are not fully normalized across weekly, 14d, and monthly artifacts; analysis should rely on structured fields rather than folder-name parsing.

## 5. Planned Methodology Improvements

- Add annualized return, volatility, Sharpe, and Sortino fields.
- Add tenor-normalized volatility and risk-adjusted metrics for fairer cross-tenor comparison.
- Replace or supplement current Sortino with classic downside deviation around an explicit target return.
- Improve visualization for dense rolling and distribution views.
- Replicate the stabilized BTC methodology on ETH.
- Add cross-asset comparison after ETH replication.
- Add a future Monte Carlo layer based on realized cycle-return distributions.
- Study CSP, collars, futures hedging, and other hedging overlays.
- Add intracycle risk modeling when suitable price paths and option marks are available.
- Add fees, slippage, funding, and other realism layers without mutating historical raw outputs.
