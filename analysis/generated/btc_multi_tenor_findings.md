# BTC Multi-Tenor Findings

Generated from existing repository artifacts only. No new Deribit collection, assets, strategies, hedge optimization, or parameter optimization were used.

## Method

- Full-period returns, BTC returns, excess returns, CAGR, cycles and coverage come from `analysis/generated/btc_multi_tenor_analysis.csv`.
- Drawdown uses `worstRollingDrawdownPct` from `analysis/generated/btc_rolling_findings_summary.csv` because the consolidated summary layer does not store a full-period equity max drawdown.
- Volatility uses full-sample cycle-return standard deviation from `analysis/generated/btc_distribution_findings.csv`.
- Sharpe is a simple zero-risk-free cycle Sharpe: `meanCycleReturnPct / stdDevCycleReturnPct * sqrt(cycles_per_year)`.
- Consistency uses full calendar years 2020-2025 from each batch `summary.json`; partial 2026 is retained in the summary but excluded from consistency counts.
- Sideways regime is an annual classifier because the existing regime file has bull, bear, ETF/bull and recovery labels but no explicit sideways label. Annual BTC returns between -20% and +20% are classified as sideways.

## Headline Results

- Best absolute return: Weekly OTM10 at 1109.021386% total return.
- Best excess return vs BTC: Weekly OTM10 at 261.53757% excess return.
- Best cycle Sharpe proxy: Weekly OTM03 at 1.139046.
- Shallowest rolling drawdown: Weekly ITM05 at -39.836452%.
- Configurations beating BTC over the comparable full period: 14d OTM10, Weekly OTM03, Weekly OTM05, Weekly OTM10.

## Survivors

- Weekly OTM10 remains the strongest full-period candidate: highest return, highest excess return, and among the strongest risk-adjusted scores, but with the deepest rolling drawdown among the leading weekly OTM set.
- Weekly OTM05 also survives scrutiny: second-best full-period return/excess and slightly less severe drawdown than Weekly OTM10.
- Weekly OTM03 is a viable lower-moneyness survivor: positive full-period excess return with better drawdown than OTM05/OTM10, but lower total return.
- 14d OTM10 is the only non-weekly configuration that narrowly beats BTC on full-period excess return; it is worth keeping as a secondary candidate, not a replacement for weekly OTM.

## Dominated Or Weak Combinations

- 14d OTM03 is dominated by Weekly ATM00.
- 14d OTM05 is dominated by Weekly ATM00.
- 14d OTM07 is dominated by 14d OTM10.
- 14d OTM10 is dominated by Weekly OTM03.
- Monthly ATM00 is dominated by 14d OTM05.
- Monthly OTM03 is dominated by 14d ATM00.
- Monthly OTM05 is dominated by 14d OTM05.
- Monthly OTM07 is dominated by 14d OTM05.
- Monthly OTM10 is dominated by 14d OTM05.
- Weekly OTM07 is dominated by 14d OTM10.

## Tenor Read

- Longer tenors did not improve the main risk-adjusted picture in these artifacts. Monthly has cleaner observed option coverage, but lower full-period return, worse excess return, and lower Sharpe proxy than the best weekly variants.
- 14d improves over monthly in return and excess terms, but only 14d OTM10 crosses BTC full-period excess into positive territory.
- Weekly carries more fallback usage and higher rebalance frequency, yet still dominates the top return and excess-return rankings.

## Regime Read

- Bull years: Weekly OTM10 2286.219378%; Weekly OTM05 1620.174234%; Weekly OTM07 1435.889767%.
- Bear years: Weekly ITM05 10.702935%; 14d ATM00 2.866514%; Weekly ATM00 -10.538997%.
- Sideways years: Monthly OTM10 excess 24.290848%; Monthly OTM07 excess 22.357808%; Monthly OTM05 excess 22.020758%.
- Bear behavior favors lower moneyness: Weekly ITM05 and Weekly ATM00 hold up better in 2022, while high OTM variants give back more convex upside in drawdowns.
- Bull and recovery behavior favors higher OTM: Weekly OTM10 and Weekly OTM05 capture enough upside to lead the long-run sample.

## Practical Conclusion

The BTC expansion shortlist should stay narrow: Weekly OTM10, Weekly OTM05, Weekly OTM03, plus 14d OTM10 as the only longer-tenor candidate that survives full-period BTC comparison. Monthly variants are useful for liquidity/coverage reference, but they are not competitive enough to lead the next research phase.
