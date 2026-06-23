# Risk And Hedging Framework

## Purpose

This document defines the risk and hedging framework for the BTC CCW research project. It separates the current baseline strategy and fixed hedge frontier from future risk-budgeted hedge research, while preserving the existing historical findings and generated artifacts.

The framework is intended to make hedge design explicit before implementation. It describes objectives, hedge architecture, candidate instruments, methodological boundaries, and the roadmap for future risk controls.

## Strategic Direction

The baseline BTC CCW strategy is the core object of study and currently appears structurally strong in the weekly OTM10 configuration, with OTM05 also remaining a plausible candidate for further study. Risk management should therefore be evaluated as an overlay on an already viable return engine, not as a replacement for it.

The project objective is not to minimize volatility, create a market-neutral system, or eliminate BTC exposure. The objective is to preserve the CCW return engine while reducing tail-risk destruction, improving risk-adjusted behavior, reducing catastrophic crisis damage, and testing whether risk management adds value after costs and implementation constraints.

This distinction is central. A hedge that produces smoother returns by suppressing the original CCW edge may be unattractive even if it improves isolated risk metrics. Hedge research should therefore report both the risk benefit and the economic cost to the baseline strategy.

## Strategy And Hedge Layers

### Baseline CCW

The baseline covered-call strategy is the core return engine. It owns BTC, sells calls according to the configured tenor and moneyness, and evaluates realized strategy outcomes at cycle resolution.

Baseline CCW results should remain the reference point for all overlay research. Hedging studies should be compared against the unhedged baseline without mutating baseline run outputs or historical conclusions.

### Fixed Partial Hedge Frontier

The fixed hedge frontier is the already implemented phase-1 hedge overlay. It tests always-on partial BTC hedge ratios:

- `h00`
- `h10`
- `h20`
- `h30`
- `h40`

This layer currently covers weekly and 14d OTM10 BTC CCW variants. It is analysis-only post-processing over saved baseline artifacts. The hedge ratio is fixed by configuration, rebalanced at the natural CCW roll, and held constant through the cycle.

The fixed frontier is a benchmark and diagnostic layer. It answers whether simple partial hedging improves drawdown, volatility, and risk-adjusted behavior, but it does not adapt the hedge ratio to volatility, VaR, market regime, or a changing loss budget.

### Risk-Budgeted Cyclical Hedge

The planned risk-budgeted cyclical hedge is a future model that computes the hedge ratio at each CCW roll using volatility, VaR, and a maximum loss budget.

The hedge ratio is calculated at cycle entry. After the roll, the hedge remains fixed until the next CCW cycle. The first version is not an intracycle emergency hedge, not a continuous delta hedge, and not an automatic crisis-response engine.

The intended design is:

```text
cycle entry / roll
  -> estimate volatility
  -> compute VaR-based net exposure target
  -> derive hedge ratio
  -> hold hedge ratio fixed until next roll
```

### Future Intracycle Discretionary Diagnostics

Intracycle crisis management is a separate future layer. It may include diagnostics, alerts, stress flags, or discretionary overlays based on intracycle market conditions.

This layer should not be conflated with the first VaR/EWMA cyclical hedge model. The cyclical hedge determines a hedge ratio at roll time; future intracycle diagnostics would monitor conditions between rolls and may support discretionary decisions or later dynamic overlays.

### Passive Hedge Monitoring Layer

The Passive Hedge Monitoring Layer is the first research bridge between generalized Daily Approximate MTM and future hedge simulation. It does not execute hedges, size positions, or change baseline CCW results. Its purpose is to answer a narrower daily question:

```text
In what risk state is the strategy today?
```

The current research design separates two state concepts:

- `damage_state`: accumulated damage context based primarily on MTM drawdown and underwater duration.
- `alert_state`: actionable current-risk context based primarily on historical VaR, EWMA volatility, and recent tail-loss events, interpreted in the presence of damage.

The two states answer different questions:

```text
damage_state answers: "How damaged are we?"
alert_state answers: "How urgently should we react?"
```

`damage_state` represents accumulated damage context. `alert_state` represents the urgency and actionability of current risk. They are complementary, but they are not equivalent: a strategy can remain deeply damaged without being in an acute actionable alert state, and an actionable alert can occur before the deepest drawdown has been reached.

This separation became necessary because the first threshold sets produced excessive `stress`/`crisis` days. Drawdown and underwater duration are valuable context, but they should not by themselves imply acute crisis for hundreds of days. The monitoring layer therefore treats deep drawdown as damage context, while acute alerts require recent confirmation from VaR, EWMA, or tail events.

The current research baseline is `v0.4b`, selected after threshold calibration on BTC Weekly OTM05 Daily MTM multi-year artifacts. It is considered sufficiently useful for future partial-hedge simulation research, but it is not a final operational policy and it does not authorize or execute any hedge.

Current interpretation:

- `normal`: no material actionable alert.
- `watch`: damage or risk context worth monitoring.
- `stress`: actionable risk is elevated enough to support future partial-hedge simulation.
- `crisis`: rare acute/extreme risk state requiring deep damage plus recent stress confirmation.

The thresholds and state rules remain preliminary research assumptions. They should be validated against hedge economics, funding, basis, slippage, liquidity, and implementation constraints before any live risk action is considered.

### BTC Overlay Hedge Versus Option Delta Hedge

The current hedge research should be interpreted as a BTC overlay hedge, not as a true option delta-aware hedge.

The framework approximately hedges BTC downside exposure using BTC-linked instruments such as futures or perpetuals. It does not dynamically hedge option greeks, compute the full option portfolio delta, or model changes in gamma, vega, theta, skew, or implied volatility across the option book.

This distinction matters because a covered-call portfolio is not identical to spot BTC. The option leg changes total strategy sensitivity through time and across price paths. Current overlay results can still be useful for crisis mitigation research, but they should not be described as full option portfolio hedging.

### Hedge Simulation Research Layer

The Hedge Simulation Research Layer uses Daily Approximate MTM and Passive Hedge Monitoring states to test whether simple partial hedge rules appear economically promising before realistic hedge costs are introduced.

The completed Phase 3 research sequence is:

- Phase 3A: Partial Hedge Simulation And Preliminary Economic Evaluation.
- Phase 3B: Hedge Intensity Robustness.
- Phase 3C: Operational Robustness Validation.

The initial v01/v02 simulation used a proportional exposure-reduction proxy:

```text
hedged_return = ccw_return * (1 - hedge_ratio)
```

This proxy is useful as a first screen, but it should not be treated as the reference model for a short futures or perpetual overlay.

The current reference research methodology is the v03 underlying-overlay formula:

```text
hedged_return = ccw_return - hedge_ratio * underlying_return
```

This better approximates a short BTC perpetual or futures overlay because hedge PnL is tied to BTC underlying returns rather than mechanically scaled CCW returns.

Current research conclusions:

- The preliminary hedge benefit survived the move from v02 proportional proxy to v03 underlying-overlay.
- Current evidence suggests the hedge overlay is capturing structural periods of elevated risk, not merely exploiting near-perfect timing assumptions.
- Tested hedge rules reduced max drawdown, historical VaR, and volatility versus unhedged in the research artifacts.
- Aggregate return was higher than unhedged in this simplified research layer.
- Aggregate return improvement does not imply return improvement in every individual year. Some years, including 2020 and 2025 in selected scenarios, sacrificed return, while year-level behavior remained mixed.
- `stress30_crisis40` is the current primary candidate.
- `stress25_crisis50` remains a conservative benchmark inherited from v01.
- Operational robustness testing showed that the benefit does not appear to depend exclusively on perfect execution.
- The benefit remained present under plausible operational frictions, including 1 valid MTM day delay, confirmation requirements, and delay plus confirmation.
- Latency matters: 1 valid MTM day delay remained robust, while 2 valid MTM days remained above unhedged but showed material deterioration and should be treated as an operational latency limit.
- `A_immediate`, `B_delay_1_valid_mtm_day`, `D_confirmation`, and `F_delay_confirmation` remained useful and should be carried into realistic economics.

Strategically, the project has evolved from covered-call backtesting toward a Dynamic Covered Call Risk Management Framework:

```text
Covered Call
+ Daily Risk Engine
+ Regime Detection
+ Adaptive Hedge Overlay
```

These results are research-grade only. They do not include funding, basis, slippage, margin, liquidity, collateral, liquidation risk, instrument selection, or real execution assumptions. They justify Phase 4 realistic hedge economics; they do not establish a production hedge policy.

The current evidence is sufficient to justify realistic economic modeling, but insufficient to claim economic superiority of the hedge overlay after real-world implementation costs. The hedge appears promising and survived the methodological validations completed so far, but it has not yet been shown to remain superior after funding, basis, slippage, margin, liquidity, collateral, and instrument-specific implementation costs.

## Risk Objectives

The primary risk objectives are:

- Reduce violent drawdowns.
- Improve strategy survivability during sharp BTC selloffs.
- Preserve part of the BTC/CCW upside engine.
- Avoid over-hedging that converts the strategy into a low-upside or structurally short-risk product.
- Keep hedge logic interpretable and auditable.

The hedge layer is best understood as tail-risk mitigation, crisis overlay, and risk engineering. It is not a continuous volatility suppression layer and is not intended to force market neutrality.

The framework is not designed to eliminate all losses. A hedge can reduce left-tail exposure while still allowing material drawdowns, especially when assumptions about volatility, funding, basis, execution, or liquidity are incomplete.

## Hedge Philosophy

The hedge is not intended to fully delta-neutralize the BTC position. Full neutralization would likely destroy a significant part of the strategy's desired long-BTC exposure and could obscure the economics of the covered-call engine.

The preferred hedge philosophy is partial risk control:

- The CCW strategy remains structurally linked to BTC upside.
- The hedge reduces left-tail exposure during adverse BTC moves.
- The hedge ratio should be capped to limit over-hedging.
- Hedge design should favor robust, explainable rules over optimized historical fit.

A useful hedge should improve survivability and reduce severe path risk without erasing the reason for holding the strategy.

Very low max-loss budgets may be economically incompatible with BTC yield-enhancement strategies. For example, a 5% VaR-style loss budget can require very high hedge ratios during stress periods, which may neutralize too much of the long BTC exposure and impair the premium-harvesting return engine.

Risk budgets therefore cannot be chosen arbitrarily. They must remain economically compatible with the CCW return engine and should be interpreted alongside hedge ratios, capped exposure, foregone upside, funding costs, and stress-period behavior.

## Hedge Instruments

### Primary Candidate: BTC Perpetuals Or Futures

BTC perpetuals or futures are the primary hedge candidate for the next research phase because they provide direct short BTC exposure and can be mapped cleanly to net BTC exposure.

This makes them a natural candidate for volatility and VaR-based hedge sizing:

```text
net BTC exposure = long BTC exposure - short futures/perp hedge exposure
```

The current research has not yet modeled funding, basis, liquidation, margin, exchange constraints, or stressed liquidity. These must be added before interpreting futures or perpetual hedges as fully tradeable production systems.

### Future Alternatives

Future research may test:

- Protective puts.
- Collars.
- Cash-secured puts.
- Option-based crash hedges.
- Hybrid futures/options overlays.

These alternatives may offer more convex downside protection, but they introduce option premium cost, strike selection, expiry selection, liquidity, implied volatility, and assignment/exercise considerations. They should be evaluated as separate overlay families rather than merged into the first futures/perp hedge model.

## Current Limitations

The current hedge research and planned cyclical model should be interpreted with the following limitations:

- Funding costs are ignored so far.
- Futures/perpetual basis is ignored.
- Liquidation and margin mechanics are ignored.
- Intracycle mark-to-market risk is not modeled.
- Slippage and liquidity stress are not modeled.
- Exchange constraints and collateral management are not modeled.
- Tax, custody, and operational risks are not modeled.
- Current drawdown analytics are primarily end-of-cycle, not full intracycle underwater paths.
- Current hedge logic approximates BTC exposure and does not model full option portfolio greek sensitivity.
- Passive hedge monitoring states are research diagnostics only and do not yet execute, size, or validate hedge trades.
- Passive hedge monitoring thresholds are calibrated on historical Daily MTM artifacts and may be regime-dependent.
- Hedge simulation results are research-grade and do not yet include funding, basis, slippage, margin, liquidity, collateral, or specific hedge-instrument mechanics.
- The current hedge simulation reference is an underlying-overlay approximation, not full futures/perpetual accounting.

These limitations are material. A hedge that appears attractive in analysis-only reconstruction may behave differently once funding, basis, margin, and stressed execution are included.

## Daily Approximate MTM CCW Layer

The Daily Approximate MTM CCW Layer is now validated for research purposes on the BTC weekly OTM10 2025 slice. It remains approximate, exploratory, and not production-grade portfolio accounting.

The purpose of this layer is to support:

- Daily risk analysis.
- Tail-event analysis.
- Daily VaR research.
- Volatility clustering research.
- Future intracycle hedge simulation research.

It does not provide official mark accounting, greek-aware hedging, true option portfolio risk modeling, or production-quality risk controls.

The candidate inputs are:

- BTC spot, index, or perpetual proxy price at a consistent daily snapshot.
- Option OHLC or trade-price proxy for the exact short call.

The validated POC used BTC weekly OTM10 for 2025, a 10:00 New York daily snapshot, Deribit `BTC-PERPETUAL` 1-minute candle close as the BTC proxy, and the exact traded option instrument's 1-minute OHLC close as the option proxy. Because BTC option candles are BTC-denominated, the option close was converted to USD using the same snapshot BTC price.

The core approximation is:

```text
approximate_CCW_value = BTC_price - option_price_proxy_usd
```

Daily returns are computed only across adjacent valid MTM observations. Missing MTM gaps, especially synthetic-cycle gaps with no exact observed option instrument, remain visible and are not bridged into a single daily return.

The validated layer currently supports:

- Daily CCW returns.
- Daily drawdowns.
- Historical daily VaR.
- Daily realized volatility.
- Daily EWMA volatility.
- Tail-event clustering analysis.
- Crisis path analysis.
- Approximate intracycle hedge simulations.
- Passive hedge monitoring calibration.

Current findings from the BTC weekly OTM10 2025 POC:

- Approximate daily MTM reconstruction appears viable for exact observed option cycles.
- Daily MTM exposes deeper intracycle drawdowns than cycle-level outputs alone.
- Volatility clustering and left-tail behavior are visible in the daily layer.
- Historical daily VaR appears more informative than EWMA alone for BTC stress persistence in this slice.
- Missing synthetic-cycle gaps remain important and visible.

This should remain clearly labeled as approximate MTM. Option OHLC and trade-price proxies can be stale, sparse, wide-spread, or liquidity-distorted. They may not match executable marks, mid prices, exchange settlement marks, or greek-aware valuations. No official historical marks, historical greeks, delta-aware option hedge, funding, slippage, liquidation, or margin mechanics are included.

Current POC outputs are archived under:

```text
analysis/generated/poc/daily_mtm_ccw_2025/
```

The dedicated reference document is `docs/14_daily_approx_mtm_research_layer.md`.

Future generalized daily-risk outputs should use separate names or folders so this validated one-year POC remains traceable.

## Current Research Hypotheses

Current evidence suggests a hypothesis that hedge latency may be a larger problem than hedge sizing alone. A hedge ratio chosen only at cycle entry can become stale during abrupt BTC selloffs, especially for longer cycles.

This is not a confirmed conclusion. It should be tested by comparing weekly and 14d structures, evaluating intracycle paths where data allows, and separating the effect of hedge timing from hedge size. Weekly structures may naturally adapt risk faster because they rebalance more often, while 14d cycles may suffer from slower risk adaptation during crisis regimes.

## Roadmap

The near-term research path is:

1. Validate the fixed hedge frontier outputs.
2. Document fixed hedge findings and benchmark behavior.
3. Implement a risk-budgeted cyclical EWMA/VaR hedge.
4. Compare the cyclical hedge against fixed `h10`, `h20`, and `h40` benchmarks.
5. Evaluate historical/empirical VaR.
6. Evaluate hybrid VaR such as `max(EWMA VaR, Historical VaR)`.
7. Generalize the daily approximate MTM framework beyond the validated BTC weekly OTM10 2025 POC.
8. Compare OTM05 and 14d daily-risk behavior after the generalized layer is designed.
9. Evaluate hybrid VaR using daily approximate MTM, including `max(EWMA VaR, Historical VaR)`.
10. Preserve Passive Hedge Monitoring `v0.4b` as the current research baseline for damage versus alert state interpretation.
11. Preserve Hedge Simulation v03 underlying-overlay as the reference research methodology for partial hedge simulations.
12. Carry `stress30_crisis40` as the current primary candidate and `stress25_crisis50` as a conservative benchmark.
13. Phase 4A: define realistic economic assumptions, including perpetual versus futures, funding, basis, and margin requirements.
14. Phase 4B: define execution assumptions, including execution latency, partial fills, liquidity constraints, and collateral requirements.
15. Phase 4C: simulate CCW plus Dynamic Hedge Overlay with realistic costs.
16. Model latency sensitivity, execution assumptions, and hedge implementation details explicitly.
17. Simulate intracycle hedge-frequency alternatives using daily MTM paths.
18. Add funding, basis, margin, and slippage realism.
19. Add intracycle diagnostic and alert research.
20. Evaluate event-driven or crisis-trigger hedge escalation only after simpler hedge layers are understood.
21. Study full option mark and greek-aware hedging if external historical providers, such as Tardis, can supply sufficient data.
22. Extend future Monte Carlo work to include hedged and unhedged variants.

Each stage should preserve traceability between baseline CCW results, fixed frontier outputs, and future adaptive hedge outputs.
