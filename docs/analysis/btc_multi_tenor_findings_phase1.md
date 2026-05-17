# 1. Overview

This document summarizes the first BTC multi-tenor quantitative research phase for the CCW covered-call research system.

The objective was to compare BTC covered-call behavior across different option reset tenors and moneyness levels, using the current batch-generated summaries and consolidated comparison layer. Tenor comparison matters because covered-call performance is not determined only by strike distance. Repricing frequency, upside cap duration, option availability, fallback usage, and BTC trend behavior can materially change the realized return profile.

Covered tenors:

- Weekly
- 14d
- Monthly

Covered moneyness configurations:

- ATM
- OTM03
- OTM05
- OTM07
- OTM10
- ITM05 where applicable

# 2. Methodology

The findings rely on the generated artifacts below:

- `analysis/generated/btc_multi_tenor_risk_summary.csv`
- `analysis/generated/btc_multi_tenor_risk_summary.json`
- `analysis/generated/btc_multi_tenor_analysis.csv`
- `analysis/generated/btc_multi_tenor_analysis.json`
- `analysis/generated/btc_multi_tenor_analysis.md`

The analysis uses batch-level summary outputs, not reconstructed trade-level or equity-curve data. Each row represents a generated batch configuration with fields such as tenor, moneyness, total return, BTC buy-and-hold return, excess return versus BTC, CAGR, PnL decomposition, cycle count, observed option coverage, fallback usage, and fallback-adjusted score.

Primary rankings exclude incomplete or partial-period runs. In the current comparison layer, the 14d OTM05 2026-only row and the monthly OTM05 2020-only row are flagged as `partial_period_excluded_from_primary_rankings`. The main quantitative conclusions therefore use the full-period comparable rows.

Current limitations:

- The analysis is summary-level only.
- True drawdown and equity-curve metrics are not yet available in this layer.
- `maxDrawdownPct`, `sharpeRatio`, `sortinoRatio`, and `worstCycleReturnPct` are currently empty.
- Rolling risk and realized path behavior cannot yet be inferred from these summaries alone.

Naming note:

- Legacy weekly runs use explicit labels such as `atm00`, `otm03`, `otm05`, `otm07`, `otm10`, and `itm05`.
- Newer non-weekly runs may use compact `xNN` naming in run artifacts.
- The analysis relies on structured metadata such as `tenor`, `moneyness_label`, and `xOtm`, rather than folder-name parsing.

# 3. Main Quantitative Findings

### Observations

Weekly dominated the first full-period comparison. The generated analysis reports weekly as the best overall tenor by average total return across comparable full-period variants.

Tenor-level averages from the consolidated analysis:

| Tenor | Variant count | Average total return | Average CAGR | Average observed option coverage | Best variant |
| --- | ---: | ---: | ---: | ---: | --- |
| Weekly | 6 | 827.305818% | 41.128528% | 72.000000% | OTM10 |
| 14d | 5 | 611.912972% | 35.488245% | 74.433544% | OTM10 |
| Monthly | 5 | 432.663659% | 29.834105% | 100.000000% | OTM10 |

The 14d tenor behaved as an intermediate regime. Its average return and CAGR sat between weekly and monthly, and its best full-period result, 14d OTM10, produced 903.671998% total return and 43.678562% CAGR.

Monthly underperformed in the current full-period BTC sample. Monthly variants had complete observed option coverage in the full-period rows, but this did not translate into better total return. The best monthly full-period result, monthly OTM10, produced 562.722051% total return and 34.571956% CAGR, trailing the best 14d and weekly variants.

OTM05 and OTM10 were strongest overall among the comparable variants. Weekly OTM05 returned 1063.935479% with 47.233962% CAGR, while weekly OTM10 returned 1109.021386% with 48.118556% CAGR.

Weekly OTM10 was the leading configuration in the current ranking layer:

| Ranking field | Leader | Value |
| --- | --- | ---: |
| Best total return | Weekly OTM10 | 1109.021386% |
| Best CAGR | Weekly OTM10 | 48.118556% |
| Best excess return vs BTC | Weekly OTM10 | 261.537570% |
| Best fallback-adjusted return score | Weekly OTM10 | 788.258277 |

Weekly OTM10 also exceeded BTC buy-and-hold over its comparable sample, with BTC returning 847.483816% and the strategy producing 261.537570% excess return versus BTC. 14d OTM10 also slightly exceeded BTC over its sample, with 903.671998% total return versus BTC at 895.154558%, or 8.517440% excess return.

### Moneyness Notes

The highest total-return result in each tenor was OTM10:

| Tenor | Best moneyness | Total return | CAGR | Excess return vs BTC |
| --- | --- | ---: | ---: | ---: |
| Weekly | OTM10 | 1109.021386% | 48.118556% | 261.537570% |
| 14d | OTM10 | 903.671998% | 43.678562% | 8.517440% |
| Monthly | OTM10 | 562.722051% | 34.571956% | -421.769853% |

Weekly OTM03 had the strongest premium efficiency in the generated ranking layer at 73.316884, but it did not lead on total return. This distinction matters because premium capture and total portfolio performance were not identical objectives in this sample.

# 4. Economic Interpretation

### Observations

The realized comparison shows a strong relationship between tenor and total return. Weekly variants had the highest average total return and average CAGR, 14d variants formed a middle band, and monthly variants lagged despite higher option coverage.

The best-performing configurations also tended to preserve more upside than ATM or tighter strikes. OTM10 led every tenor by total return, while OTM05 was also strong in the weekly set.

### Hypotheses

Repricing frequency appears economically important for BTC. Weekly calls reset more frequently, allowing the strategy to re-anchor strikes after large BTC moves. In a volatile, upward-trending asset, this may reduce the damage from being locked into a stale cap after a sharp rally.

BTC convexity capture may favor shorter tenors and wider OTM strikes. OTM10 likely gave the underlying more room to participate in upside moves while still collecting option premium. OTM05 also performed strongly, suggesting the best region may be a balance between premium income and retained upside rather than maximum premium collection.

The monthly underperformance is consistent with a stale strike problem. A monthly call can cap the portfolio for a longer period after BTC rallies, and the strategy cannot reset the strike until the next cycle. Even with complete observed option coverage, the longer upside cap may have outweighed the operational benefit of fewer fallbacks.

The results also show the theta capture versus upside cap trade-off. Tighter strikes can improve premium capture, but they may sell too much upside in strong BTC regimes. Wider OTM strikes collect less immediate premium, but in this phase they better preserved participation in BTC's large directional moves.

These interpretations are hypotheses drawn from the summary-level outputs. They should be validated with equity curves, cycle returns, drawdown paths, and regime-tagged analysis before being treated as final causal explanations.

# 5. Limitations

The strongest current conclusion is comparative: in the available full-period summary data, weekly BTC configurations, especially weekly OTM10 and weekly OTM05, outperformed the tested 14d and monthly configurations on total return and CAGR.

The current evidence is not yet sufficient for a complete risk conclusion. The generated analysis explicitly reports that drawdown, Sharpe, Sortino, rolling volatility, and worst-cycle metrics remain null because the comparison layer reads consolidated summaries rather than per-run equity curves or trades.

Known limitations:

- Drawdown metrics are still incomplete.
- Sharpe and Sortino values are placeholders with no computed values in the current artifacts.
- No equity-curve reconstruction has been performed in this analysis layer.
- No regime segmentation has been applied.
- No Monte Carlo analysis has been performed.
- The analyzed BTC sample is relatively bull-heavy and trend-driven, which may favor shorter repricing tenors and wider OTM strikes.
- Summary-level PnL decomposition does not reveal path dependency, timing of losses, underwater duration, or cycle-level tail behavior.

Therefore, the total-return ranking is already informative, but risk-adjusted superiority still requires deeper validation.

# 6. Next Research Steps

The next research phase should move from summary comparison into path-aware risk analysis:

- Reconstruct normalized equity curves for each full-period configuration.
- Compute true peak-to-trough drawdown and underwater duration.
- Analyze cycle-return distributions by tenor and moneyness.
- Segment results by BTC regime, including trend, drawdown, and realized volatility environments.
- Add rolling risk metrics, including rolling return, rolling volatility, and rolling excess return versus BTC.
- Study volatility clustering and its relationship to option coverage, fallback usage, and capped-upside outcomes.

These steps should be completed before expanding the same research framework to ETH, because the BTC phase is still missing the risk layer needed to judge robustness.

# 7. Conclusions

Phase 1 establishes that tenor selection is a first-order research variable for BTC CCW. In the current generated outputs, weekly configurations materially outperformed 14d and monthly configurations on total return and CAGR, while 14d behaved as an intermediate regime and monthly lagged.

Weekly currently appears comparatively superior in the present BTC sample because it combines frequent strike repricing with enough upside participation when strikes are placed farther OTM. The strongest observed configuration was weekly OTM10, which led total return, CAGR, excess return versus BTC, and fallback-adjusted return score.

The project should now move into deep risk analysis before expanding to ETH. The return findings are strong enough to guide the next phase, but they are not yet enough to make final risk-adjusted conclusions without equity-curve reconstruction, drawdown analysis, cycle-return distributions, and regime segmentation.
