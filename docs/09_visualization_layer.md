# Visualization Layer

The visualization layer renders static PNG charts from existing generated BTC analysis outputs. It is a presentation layer only. It does not rerun backtests, regenerate source analysis datasets, modify strategy logic, or change historical findings.

## Generated Charts

Current generated charts are indexed in `analysis/generated/charts/btc_visualization_index.md`.

| Chart | Source concept | Interpretation |
| --- | --- | --- |
| `btc_total_return_by_tenor_moneyness.png` | Multi-tenor summary total return. | Compares cumulative return by tenor and moneyness. |
| `btc_cagr_by_tenor_moneyness.png` | Multi-tenor summary CAGR. | Compares annualized return from summary outputs. |
| `btc_max_drawdown_by_tenor_moneyness.png` | Deep-risk reconstructed equity drawdown. | Shows end-of-cycle max drawdown magnitude. |
| `btc_return_vs_drawdown_scatter.png` | Deep-risk reconstructed return and drawdown. | Compares return versus drawdown tradeoff by strategy. |
| `btc_sharpe_sortino_by_strategy.png` | Deep-risk simple cycle ratios. | Shows simple, non-annualized Sharpe and Sortino-style ratios. |
| `btc_rolling_return_by_tenor.png` | Rolling-risk one-year window return. | Shows monthly-bucketed average one-year rolling return by tenor. |
| `btc_rolling_drawdown_by_tenor.png` | Rolling-risk one-year window drawdown. | Shows monthly-bucketed average one-year rolling drawdown by tenor. |
| `btc_regime_return_heatmap.png` | Regime return analysis. | Shows average return by tenor and deterministic calendar regime. |

## How To Interpret The Charts

Bar charts compare cross-sectional values by tenor and moneyness. Higher return or CAGR bars indicate stronger generated summary performance. For drawdown magnitude, lower bars are better because deeper drawdowns are worse.

The return-versus-drawdown scatter should be read as a rough tradeoff view. Higher return with less negative drawdown is preferable, but the drawdown input is end-of-cycle reconstructed drawdown, not intracycle mark-to-market risk.

The Sharpe/Sortino chart is a cycle-based diagnostic view. It is not an annualized or tenor-normalized risk-adjusted ranking.

The regime heatmap shows deterministic calendar-regime behavior. Greener cells indicate stronger average regime return; redder cells indicate weaker periods.

## Rolling Aggregation

The rolling return and rolling drawdown charts use source rows from `analysis/generated/btc_rolling_risk_analysis.csv/json`.

The source fields are:

- date field: `windowEndDate`
- tenor field: `tenor`
- return value field: `windowReturnPct`
- drawdown value field: `rollingDrawdownPct`
- one-year filter: weekly `windowCycles = 52`, 14d `windowCycles = 26`, monthly `windowCycles = 12`

For readability, the chart layer groups rolling rows by `tenor + month`, averages values inside each month, uses month-start as the plotted date, and sorts each tenor series by plotted date. This produces one clean line per tenor and avoids dense raw-window line noise. The underlying rolling-risk analysis output remains unchanged.

## Chart Caveats

- Charts inherit all limitations of their source analysis artifacts.
- Rolling chart monthly bucketing is a visualization choice, not a new research dataset.
- The PNG renderer is intentionally simple and static.
- Axis ranges are data-driven and may be dominated by extreme observations.
- Current chart labels are concise and cannot carry every methodological caveat.
- Cycle-based volatility and simple Sharpe/Sortino charts should not be compared as annualized metrics.
- Regime charts use deterministic calendar regimes, not model-inferred market states.

## Visualization Limitations

The current visualization layer is adequate for first-pass inspection, but it is not a full dashboard. Planned improvements include richer labels, better date ticks, distribution views, optional outlier handling with explicit annotation, improved color/legend ergonomics, and interactive inspection once the methodology layer stabilizes.
