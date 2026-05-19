# Analysis Glossary

This glossary defines the major fields used by the BTC CCW analysis outputs. Percent fields are expressed in percentage points unless otherwise stated. Cross-tenor comparisons require care because weekly, 14d, and monthly cycles have different time units.

## Common Identity Fields

| Field | Meaning | Notes |
| --- | --- | --- |
| `asset` | Underlying asset, currently BTC in the consolidated BTC outputs. | Future ETH outputs should preserve the same field. |
| `tenor` | Option reset tenor, such as `weekly`, `14d`, or `monthly`. | Tenor changes cycle length and affects comparability of cycle-based metrics. |
| `moneyness_label` | Human-readable strike distance label, such as `atm00`, `otm10`, or `itm05`. | Prefer this field over folder-name parsing. |
| `xOtm` | Numeric moneyness distance used by the run/configuration. | Interpretation depends on label direction; use with `moneyness_label`. |
| `source_batch_name` | Batch artifact that supplied the row. | Useful for traceability. |
| `comparison_scope` | Whether the row is full-period comparable or partial-period/traceability only. | Primary rankings generally use `full_period`. |
| `warnings` | Serialized warning or diagnostic notes. | Empty warnings do not imply methodological perfection. |

## Multi-Tenor Analysis Fields

| Field | Meaning | Interpretation and limitations |
| --- | --- | --- |
| `startYear`, `endYear` | Calendar years covered by the row. | Partial rows may not be comparable with full-period rows. |
| `startDate`, `endDate` | Date range covered by the row. | Use to confirm sample alignment. |
| `sample_years` | Approximate sample length in years. | Used for CAGR-style calculations. |
| `totalReturnPct` | Strategy total return from batch summaries. | Summary-level metric; not path-aware by itself. |
| `btcReturnPct` | BTC buy-and-hold return over the comparable sample. | Benchmark return for the same period where available. |
| `excessReturnVsBtcPct` | Strategy total return minus BTC return. | Positive values indicate outperformance versus BTC over the sample. |
| `cagrPct` | Compounded annual growth rate. | More comparable across different sample lengths than total return. |
| `return_vs_btc_ratio` | Strategy return divided by BTC return. | Can be unstable when benchmark return is small or negative. |
| `premium_to_underlying_pnl_ratio` | Call premium/PnL relationship to underlying PnL. | Useful for decomposing premium contribution versus spot exposure. |
| `annualized_return_per_cycle` | Summary-level return scaled by cycle cadence. | Current use should be treated cautiously until normalization is formalized. |
| `excess_return_per_year` | BTC-relative excess return divided by sample years. | Helps compare samples with different lengths. |
| `option_coverage_efficiency` | Relationship between return and observed option coverage. | Coverage quality is still constrained by available option data. |
| `fallback_penalty_proxy` | Proxy penalty for theoretical or settlement fallback usage. | Not a direct realized trading cost. |
| `fallback_adjusted_return_score` | Return score adjusted by fallback penalty proxy. | Ranking aid, not a final risk-adjusted metric. |
| `cycles_per_year` | Approximate annual cycle frequency. | Weekly, 14d, and monthly rows differ materially. |
| `premium_capture_density` | Premium capture relative to cycle/opportunity base. | Higher values do not necessarily imply higher total return. |
| `underlying_capture_ratio` | Strategy participation in underlying BTC performance. | Important for covered-call upside-cap interpretation. |
| `totalPnL`, `totalPnLCall`, `totalPnLUnderlying` | PnL decomposition. | Units follow source summaries; compare within consistent artifacts. |
| `totalCycles` | Number of strategy cycles. | Tenor-dependent and not directly comparable as a risk metric. |
| `observedOptionCoveragePct` | Share of cycles using observed option data. | Higher coverage reduces reliance on approximation. |
| `theoreticalFallbackCoveragePct` | Share of cycles using theoretical option fallback. | Indicates data/model dependency. |
| `settlementFallbackCoveragePct` | Share of cycles using settlement fallback. | Indicates settlement approximation dependency. |
| `maxDrawdownPct`, `sharpeRatio`, `sortinoRatio`, `worstCycleReturnPct` | Reserved or summary-level risk fields. | In the multi-tenor summary layer these may be null; use deep-risk outputs for current risk analysis. |

## Equity Risk Analysis Fields

| Field | Meaning | Interpretation and limitations |
| --- | --- | --- |
| `cycleCount` | Number of realized cycles reconstructed from trades. | Tenor-dependent. |
| `reconstructedTotalReturnPct` | Total return from compounded reconstructed cycle returns. | Path-aware at cycle resolution. |
| `summaryTotalReturnPct` | Total return from summary artifact. | Used for reconciliation. |
| `returnDifferencePct` | Difference between reconstructed and summary returns. | Diagnostic field; large differences require review. |
| `maxDrawdownPct` | Worst end-of-cycle peak-to-trough drawdown. | Negative percentage; no intracycle drawdown. |
| `maxDrawdownDurationCycles` | Longest drawdown duration in cycles. | Cycle units differ by tenor. |
| `averageDrawdownPct` | Average end-of-cycle drawdown. | Negative values indicate average underwater depth. |
| `ulcerIndex` | Square root of mean squared drawdown percentages. | Penalizes depth and persistence of drawdowns. |
| `volatilityOfCycleReturns` | Sample standard deviation of cycle returns. | Not annualized; not directly comparable across tenors without normalization. |
| `downsideVolatility` | Sample standard deviation of negative cycle returns. | Downside dispersion, not classic downside deviation. |
| `SharpeSimple` | Average cycle return divided by cycle-return volatility. | No risk-free rate, no annualization, tenor-dependent. |
| `SortinoSimple` | Average cycle return divided by downside dispersion. | Not classic Sortino until downside deviation target is formalized. |
| `returnOverMaxDrawdown` | Return divided by max drawdown magnitude. | Useful rough tradeoff metric; sensitive to drawdown methodology. |
| `worstCycleReturnPct`, `bestCycleReturnPct` | Worst and best realized cycle return. | Cycle length differs by tenor. |
| `positiveCyclePct`, `negativeCyclePct` | Share of cycles with positive/negative return. | Frequency metric, not magnitude-aware. |
| `averageCycleReturnPct`, `medianCycleReturnPct` | Mean and median cycle returns. | Not annualized. |
| `source_summary_path` | Source summary used for reconstruction. | Traceability field. |

## Rolling Risk Analysis Fields

| Field | Meaning | Interpretation and limitations |
| --- | --- | --- |
| `windowCycles` | Number of cycles in the rolling window. | Primary one-year comparison uses weekly 52, 14d 26, monthly 12. |
| `windowStartSequence`, `windowEndSequence` | Cycle sequence boundaries. | Defines rolling window position. |
| `windowStartDate`, `windowEndDate` | Date boundaries of the rolling window. | Visualization buckets by month using `windowEndDate`; source rows remain daily/cycle-timed. |
| `rollingAverageCycleReturnPct` | Arithmetic average cycle return inside the window. | Cycle-based, not annualized. |
| `rollingVolatilityPct` | Sample standard deviation of cycle return percentages inside the window. | Tenor-dependent. |
| `rollingDownsideVolatilityPct` | Sample standard deviation of negative cycle returns inside the window. | Downside dispersion, not classic downside deviation. |
| `rollingDrawdownPct` | Worst reconstructed end-of-cycle drawdown inside the window. | Negative percentage; no intracycle path. |
| `windowReturnPct` | Compounded return over the rolling window. | Primary rolling return metric. |

## Rolling Findings Summary Fields

| Field | Meaning | Interpretation and limitations |
| --- | --- | --- |
| `row_type` | Summary row category. | Distinguishes tenor, regime, or other grouped findings. |
| `rollingWindowCount` | Number of rolling windows included. | Windows overlap and are not independent. |
| `averageWindowReturnPct` | Average `windowReturnPct`. | Describes rolling-window return level. |
| `stdevWindowReturnPct` | Standard deviation of rolling-window returns. | Persistence/variability measure, not annualized volatility. |
| `positiveWindowPct`, `negativeWindowPct` | Share of rolling windows above/below zero return. | Overlapping windows can inflate persistence. |
| `averageRollingVolatilityPct` | Average rolling cycle-return volatility. | Cycle-based, not annualized. |
| `stdevRollingVolatilityPct` | Variability of rolling volatility over time. | Measures stability of volatility path. |
| `p90RollingVolatilityPct` | 90th percentile rolling volatility. | Used to define elevated volatility regions. |
| `maxRollingVolatilityPct` | Highest rolling volatility observed. | Sensitive to crisis windows. |
| `volatilitySpikeThresholdPct` | Threshold for volatility-spike classification. | Typically derived from each configuration's own distribution. |
| `volatilitySpikeCount` | Count of spike windows. | Overlapping windows are not independent. |
| `volatilitySpikeBearPct` | Share of spike windows ending in bear regime. | Uses window end date for regime assignment. |
| `longestElevatedVolatilityRun` | Longest run of elevated volatility windows. | Measured in rolling-window observations. |
| `averageRollingDrawdownPct` | Average rolling drawdown. | Negative values indicate underwater pressure. |
| `stdevRollingDrawdownPct` | Variability of rolling drawdown. | Lower may indicate steadier drawdown path, not necessarily lower risk. |
| `worstRollingDrawdownPct` | Most negative rolling drawdown. | End-of-cycle only. |
| `severeDrawdownWindowPct` | Share of windows crossing the severe drawdown threshold. | Current threshold is -20%. |
| `longestDrawdownRun`, `longestSevereDrawdownRun` | Longest drawdown/severe-drawdown persistence runs. | Based on overlapping windows. |
| `averageRegimeReturnSpreadPct` | Average spread across regime returns. | Measures regime sensitivity. |
| `bestRegime`, `worstRegime` | Best/worst regime labels for grouped row. | Calendar regime definitions are deterministic. |
| `notes` | Human-readable caveats or row notes. | May include interpretation hints. |

## Regime Analysis Fields

| Field | Meaning | Interpretation and limitations |
| --- | --- | --- |
| `regime` | Regime identifier. | Deterministic calendar regime. |
| `regime_label` | Human-readable regime label. | Examples include `bear_2022` and `etf_bull_2024_2025`. |
| `regime_start`, `regime_end` | Calendar boundaries. | Assignment uses cycle `entry_date`. |
| `cycleCount` | Number of cycles assigned to the regime. | Tenor-dependent and can vary by coverage. |
| `returnPct` | Compounded return inside the regime. | Not annualized unless separately stated. |
| `volatilityPct` | Sample standard deviation of cycle returns inside the regime. | Cycle-based, not annualized. |
| `drawdownPct` | Worst end-of-cycle drawdown inside the regime. | Negative percentage. |
| `hitRatePct` | Share of cycles with positive return. | Frequency metric only. |
| `averageCycleReturnPct` | Arithmetic average cycle return in the regime. | Not annualized. |

## Cycle Distribution Fields

| Field | Meaning | Interpretation and limitations |
| --- | --- | --- |
| `meanCycleReturnPct`, `medianCycleReturnPct` | Mean and median realized cycle return. | Tenor-dependent. |
| `stdDevCycleReturnPct` | Cycle-return standard deviation. | Not annualized. |
| `skewness` | Distribution asymmetry. | Sensitive to outliers. |
| `excessKurtosis` | Tail heaviness relative to normal distribution. | Unstable with small samples. |
| `interquartileRangePct` | 75th percentile minus 25th percentile. | Robust spread measure. |
| `p05CycleReturnPct`, `p25CycleReturnPct`, `p75CycleReturnPct`, `p95CycleReturnPct` | Cycle-return percentiles. | Describe distribution tails and middle spread. |
| `tailConcentrationPct` | Tail contribution/concentration metric from generated analysis. | Interpret with source methodology. |
| `severeLossFrequencyPct` | Share of cycles below severe-loss threshold. | Threshold appears in `severeLossThresholdPct`. |
| `severeLossThresholdPct` | Severe-loss cutoff. | Percentage threshold. |
| `cappedUpsideFrequencyPct` | Share of cycles above capped-upside threshold. | Used to study upside-cap behavior. |
| `cappedUpsideThresholdPct` | Capped-upside threshold. | Percentage threshold. |
| `histogramMinPct`, `histogramMaxPct`, `histogramBinCount`, `histogramCounts` | Histogram metadata and bin counts. | Useful for visualization and distribution review. |

## Comparability Rules

- Total return is only directly comparable when sample periods align.
- CAGR is better than total return for different sample lengths, but still depends on available data and assumptions.
- Cycle volatility, cycle Sharpe, cycle Sortino, cycle drawdown duration, and positive cycle frequency are tenor-dependent.
- Use reconstructed equity risk outputs for path-aware risk conclusions; do not infer drawdown from the summary-only multi-tenor layer.
- Use full-period rows for primary rankings unless partial-period behavior is explicitly being studied.
