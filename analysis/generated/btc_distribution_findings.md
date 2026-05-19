# BTC Cycle-Return Distribution Findings

Generated: 2026-05-19T10:58:45.879Z

## Methodology

- Reads existing generated outputs only: `btc_cycle_distribution_analysis`, `btc_regime_analysis`, and `btc_equity_risk_analysis`.
- Distribution metrics are cycle-based and are not annualized.
- p5, p25, median, p75, and p95 come from the source cycle-distribution artifact.
- p1 and p99 are estimated from stored histogram bins because raw per-cycle returns are not present in the generated distribution artifact.
- Regime-conditioned rows use regime-level proxy metrics because the current regime artifact does not include regime-conditioned percentiles, skewness, or kurtosis.

## Tenor Summary

| tenor | meanCycleReturnPct | stdDevCycleReturnPct | p01Est | p05 | median | p95 | p99Est | skewness | excessKurtosis | severeLossFrequencyPct | leftTailConcentrationPct |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| weekly | 0.86454 | 5.832528 | -20.670209 | -8.479479 | 1.894423 | 7.49945 | 11.052964 | -2.45853 | 13.628287 | 4.153846 | 44.999334 |
| 14d | 1.574371 | 8.022172 | -27.047915 | -13.855941 | 3.488304 | 10.147941 | 13.847469 | -1.684812 | 4.354553 | 5.037975 | 46.198781 |
| monthly | 2.747375 | 10.105241 | -24.431164 | -18.2375 | 6.163134 | 14.280776 | 17.027871 | -1.113711 | 0.660064 | 5.263158 | 39.776882 |

## Observations

- monthly has the widest average cycle-return dispersion by standard deviation (10.105 pp), while weekly has the narrowest (5.833 pp).
- weekly has the highest average excess kurtosis (13.628), indicating the strongest fat-tail signal in the cycle-based distribution layer.
- Average skewness is most negative for weekly (-2.459) and least negative for monthly (-1.114).
- 14d has the highest average left-tail concentration (46.199%), while weekly has the highest estimated right-tail concentration (30.83%).
- monthly has the highest average severe-loss frequency (5.263%).
- In the regime proxy layer, monthly has the highest average 2022 bear volatility (12.567 pp), and monthly has the deepest average 2022 bear drawdown (-45.185%).

## Interpretations

- Weekly and 14d distributions should be compared as cycle-based distributions, not annualized risk distributions.
- Negative skewness across tenor summaries indicates that adverse cycle outcomes are larger or more concentrated than upside cycle outcomes in the current reconstructed return sample.
- High excess kurtosis and left-tail concentration indicate that a small number of adverse cycles contribute disproportionately to negative-return magnitude.

## Hypotheses

- 14d may smooth some distribution shape metrics relative to weekly/monthly, but the evidence is mixed and should not be treated as proof until annualized and intracycle metrics are added.
- OTM10 has average skewness of -1.032 across tenors, suggesting wider strikes change upside participation but do not eliminate left-tail asymmetry in the current cycle-return sample.
- Monthly may behave like compressed carry in some views because it has fewer, longer cycles; this requires tenor-normalized volatility and tail metrics before becoming a formal conclusion.
- The 2022 bear regime appears to intensify downside clustering in regime proxy metrics, but current regime outputs do not contain true regime-conditioned percentiles or skew/kurtosis.

## Regime Proxy Summary

| tenor | regime | avgReturnPct | avgVolatilityPct | avgDrawdownPct | avgHitRatePct |
| --- | --- | ---: | ---: | ---: | ---: |
| weekly | bull_2020_2021 | 324.644849 | 7.327791 | -43.426552 | 72.653722 |
| weekly | bear_2022 | -23.009424 | 6.263205 | -42.427574 | 56.20915 |
| weekly | recovery_transition_2023 | 65.439842 | 3.846845 | -13.73567 | 71.24183 |
| weekly | etf_bull_2024_2025 | 80.105683 | 4.441896 | -26.059041 | 65.686274 |
| 14d | bull_2020_2021 | 197.63045 | 9.788509 | -42.732693 | 73.333333 |
| 14d | bear_2022 | -15.866734 | 8.672387 | -41.39686 | 57.495652 |
| 14d | recovery_transition_2023 | 77.043571 | 4.755085 | -10.383893 | 76.382609 |
| 14d | etf_bull_2024_2025 | 67.856825 | 6.595221 | -26.034398 | 64.116667 |
| monthly | bull_2020_2021 | 132.487307 | 11.6586 | -25.613596 | 73.333333 |
| monthly | bear_2022 | -25.516562 | 12.56657 | -45.185012 | 51.666667 |
| monthly | recovery_transition_2023 | 56.982676 | 6.730314 | -10.991928 | 71.666667 |
| monthly | etf_bull_2024_2025 | 80.484866 | 8.104622 | -20.058538 | 70.833333 |

## Limitations

- Cycle-return distributions are not annualized and are not directly comparable to annual volatility.
- Tenors have different cycle lengths and cycle counts.
- Histogram-derived p1/p99 values are estimates, not exact percentiles.
- Current regime-conditioned distribution analysis is proxy-based; true regime percentiles require per-cycle regime-tagged rows.
- No intracycle mark-to-market distribution is modeled.
- No fees, slippage, funding, or execution-friction distributions are included.
