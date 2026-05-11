# Weekly BTC Baseline Analysis

## Objective

Interpret the completed weekly BTC covered-call sweeps before expanding across tenors, assets, hedge variants, or more realistic execution layers.

This note summarizes current research observations only. It is not a production performance claim.

## Runs Analyzed

Strategy groups currently reviewed:

- ITM 5%
- ATM
- OTM 3%
- OTM 5%
- OTM 7%
- OTM 10%

The analysis compares raw frictionless backtest outputs with execution-friction sensitivity outputs generated from the post-processing premium haircut analyzer.

## Raw Results Overview

The weekly BTC sweeps show a clear structural tradeoff across moneyness. ITM and ATM variants rely more heavily on option premium harvesting, while farther OTM variants preserve more participation in BTC upside.

This distinction matters because the 2020-2026 sample includes unusually strong secular BTC trends. Strategies that retained more upside participation benefited from that environment, while more aggressive premium monetization variants gave up more convex upside in exchange for higher recurring option income and more downside cushioning.

## Execution Friction Sensitivity

The current execution-friction model applies a uniform haircut to option premium received. The default scenarios are 5%, 10%, and 20% premium haircuts.

These haircuts should be interpreted as stress and sensitivity scenarios, not as estimates of actual Deribit execution quality. Real Deribit front-week BTC option liquidity appears materially better than the harshest assumptions used here, especially for more liquid strikes. Future work should consider moneyness-dependent and liquidity-dependent friction assumptions rather than a single uniform haircut.

Observed friction sensitivity declines substantially as strategies move farther OTM. This is economically intuitive: ITM and ATM strategies depend more on premium harvesting, so haircutting premium has a larger impact. Farther OTM strategies depend more on BTC upside participation, so the premium haircut has less influence on total returns.

## Moneyness Comparison: ITM / ATM / OTM

| Strategy | Premium Dependence | Convexity Preservation | Bear Protection | Friction Sensitivity | Preliminary Interpretation |
| --- | --- | --- | --- | --- | --- |
| ITM 5% | Very high | Low | High | Very high | Most defensive and premium-driven; useful for bear-regime protection, but most exposed to execution assumptions. |
| ATM | High | Low to moderate | Moderate to high | High | Aggressive premium monetization; less upside participation than OTM variants. |
| OTM 3% | Moderate to high | Moderate | Moderate | Moderate | Balanced but still materially premium-sensitive. |
| OTM 5% | Moderate | Moderate to high | Moderate | Moderate to low | Transitional profile between premium harvesting and upside participation. |
| OTM 7% | Lower | High | Lower to moderate | Low | Appears relatively robust to current friction assumptions while preserving more BTC upside. |
| OTM 10% | Low | Very high | Lower | Very low | Behaves closer to long BTC plus yield enhancement than aggressive covered-call monetization. |

## Observed Regime Dependence

Bull regimes favored farther OTM strategies because they preserved more BTC upside participation. In these periods, the opportunity cost of selling calls closer to spot became more visible.

Bear regimes favored ATM and ITM strategies because larger premium income partially cushioned downside moves. This does not eliminate BTC drawdown risk, but it changes the path and magnitude of losses relative to more upside-preserving OTM variants.

The 2020-2026 sample likely over-rewards convex upside preservation because BTC experienced an unusually strong secular trend during the period. More balanced conclusions require additional market regimes, asset comparisons, and tenor comparisons.

## Key Preliminary Findings

- ITM and ATM strategies depend much more heavily on option premium harvesting.
- Farther OTM strategies depend more on BTC upside participation.
- As moneyness moves farther OTM, sensitivity to execution friction decreases substantially.
- ITM strategies provided better downside protection during bear regimes such as 2022.
- Farther OTM strategies preserved more convex upside during bull regimes.
- OTM 7% and OTM 10% appeared especially robust to the current friction assumptions.
- OTM 10% behaved economically closer to `long BTC + yield enhancement`.
- ATM and ITM behaved more like aggressive premium monetization strategies.

These findings are preliminary and should be re-tested across additional execution assumptions, tenors, and market regimes.

## Risks And Caveats

- Results are historical and regime-dependent.
- Weekly BTC results from 2020-2026 include unusually strong secular BTC trends.
- There is no explicit fee model yet.
- There is no dynamic hedging layer yet.
- There is no realistic order book or bid/ask simulation yet.
- The current friction model uses a uniform premium haircut and does not vary by moneyness, tenor, volume, spread, or market regime.
- Results should not be interpreted as deployable production performance.

## Potential Future Metrics

Future analysis should add more consistent metrics across all runs. Candidate dimensions include:

- Upside capture ratio vs BTC.
- Downside capture ratio.
- Premium yield contribution.
- Drawdown efficiency.
- Risk-adjusted returns.
- Capital efficiency.
- Convexity retention.

These metrics are not yet implemented consistently across all runs, so current interpretation remains mostly comparative and qualitative.

## Open Questions

- Which OTM level offers the best tradeoff between premium income and upside participation after more realistic execution assumptions?
- Should execution friction vary by moneyness, expiry liquidity, observed volume, or option delta?
- Do 2-week and monthly cycles preserve the same moneyness tradeoffs?
- How much of the apparent edge survives explicit fees, custody assumptions, and venue constraints?
- Would dynamic hedging improve drawdown behavior without destroying the yield profile?
