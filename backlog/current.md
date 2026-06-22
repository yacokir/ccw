# Current Backlog

## 1. Overview

Este backlog contém as tarefas atuais do sistema, com foco na evolução das camadas Data e Execution.

As tarefas podem ser ajustadas conforme o sistema evolui.

---

## 2. Current Priorities

### 2.1 Data Layer

- Implementar coleta de dados históricos  
- Definir fonte(s) de dados (API, dataset, etc.)  
- Validar estrutura básica dos dados (timestamps, preços)  
- Implementar normalização inicial do dataset  

---

### 2.2 Execution Layer

- Implementar estrutura básica do backtester  
- Definir estrutura de trade (entrada, saída, resultado)  
- Implementar primeiro modelo simples de execução  

---

## 3. Execution Scenarios

- Implementar execução **08 → 08** (base inicial)  
- Preparar estrutura para suportar múltiplos cenários  

---

## 4. Data Issues (To Investigate)

- Identificar presença de gaps nos dados  
- Avaliar necessidade de fallback de preço  
- Medir possíveis delays entre sinal e execução  

---

## 5. Next Steps (Short-Term)

1. Conseguir rodar o sistema ponta a ponta (mesmo que simples)  
2. Gerar primeiros trades  
3. Validar consistência básica dos resultados  

---

## 6. Notes

- Priorizar funcionamento antes de otimização  
- Evitar complexidade prematura  
- Ajustes são esperados durante a execução

---

## 7. Future Cleanup

- Normalize non-weekly run naming from compact `xNN` labels to explicit `atm`/`otm`/`itm` moneyness labels across tenors and future assets, while preserving existing indexed artifacts and avoiding breakage in `runs/index.csv`, batch summaries, and analysis scripts.

---

## 8. Completed BTC Research

The following BTC research phases are complete and preserved under `analysis/generated/`:

- BTC weekly baseline consolidation.
- BTC tenor comparison across weekly, 14d, and monthly.
- BTC multi-tenor consolidation and ranking.
- BTC risk analysis phase for Weekly OTM03, Weekly OTM05, Weekly OTM10, BTC buy-and-hold, and 14d OTM10.
- BTC robustness validation.
- BTC friction analysis.
- BTC yearly stability analysis.
- BTC regime transition analysis.
- BTC implementation review.

BTC research conclusion:

- Weekly remains the preferred tenor.
- Weekly OTM05 is the validated BTC baseline and default reference framework.
- Weekly OTM10 is retained as the aggressive return-maximizing alternative.
- Weekly OTM03 is retained as a defensive validation/reference configuration.
- 14d OTM10 remains useful as a secondary benchmark, but 14d does not justify replacing weekly.
- Monthly does not justify further BTC research at this stage.
- The BTC baseline research phase is substantially complete.

---

## 8.5 Completed ETH Research

The following ETH research phases are complete and preserved under `runs/batches/` and `analysis/generated/`:

- ETH infrastructure validation.
- ETH observed/synthetic coverage validation.
- ETH Weekly moneyness research across ATM00, OTM03, OTM05, OTM07, and OTM10.
- ETH Weekly robustness validation for OTM03 vs OTM05.
- ETH 14d and Monthly tenor exploration across ATM00, OTM03, OTM05, and OTM10.

ETH research conclusion:

- Weekly clearly dominates 14d and monthly by return.
- 14d is not a primary ETH candidate at this stage.
- Monthly is not a primary ETH candidate at this stage.
- Weekly OTM03 produced the highest historical gross return.
- Weekly OTM05 produced a very close return profile, with only a small annualized gap versus OTM03.
- Weekly OTM05 performed better under realistic and stress friction assumptions.
- Weekly OTM05 has lower operational burden, won more individual years, and is methodologically aligned with the validated BTC baseline.
- ETH Weekly OTM05 is the provisional ETH baseline.
- ETH Weekly OTM03 remains the primary comparative variant.

Baseline rationale:

Although ETH Weekly OTM03 had the highest historical gross return, its advantage over OTM05 is relatively small when annualized. Considering OTM05's better performance under friction and stress, its greater operational simplicity, its victory in more individual years, and its compatibility with the BTC baseline, the project adopts ETH Weekly OTM05 as the provisional baseline.

This does not mean OTM03 is inferior. It means the current evidence is not strong enough to justify a methodological divergence between BTC and ETH.

---

## 9. Remaining BTC Research

- Document BTC conclusions in a stable final research memo before expanding to new assets.
- Preserve simple, auditable comparison tables for OTM03, OTM05, OTM10, BTC buy-and-hold, and 14d OTM10.
- Add annualized risk metric normalization only where it clarifies existing BTC conclusions.
- Keep OTM05 as the default BTC baseline for any future risk, hedge, fee, slippage, or MTM work.
- Use OTM10 only when explicitly studying aggressive upside capture or return maximization.

---

## 10. Research Framework Roadmap

The BTC CCW project is transitioning from exploratory backtesting to a structured quantitative research framework. The roadmap below preserves existing generated outputs and historical conclusions while prioritizing methodology stability.

### 10.1 Methodology Normalization

- Formalize which metrics are summary-level, reconstructed-equity, rolling-window, regime, and visualization-only.
- Keep full-period and partial-period rows clearly separated in rankings and conclusions.
- Prefer structured metadata fields such as `asset`, `tenor`, `moneyness_label`, `xOtm`, and `comparison_scope` over folder-name parsing.

### 10.2 Annualization Layer

- Add annualized volatility, Sharpe, Sortino, and related risk-adjusted metrics.
- Preserve current cycle-based metrics for traceability.
- Add tenor-normalized comparisons so weekly, 14d, and monthly outputs can be compared more directly.

### 10.3 ETH Replication

- Replicate the stabilized BTC methodology on ETH.
- Reuse the same analysis layers, glossary conventions, and caveat structure.
- Compare ETH results against BTC only after methodology parity exists.
- Keep ETH staking/carry excluded from baseline replication and evaluate it separately in the Carry, Staking, And Reinvestment Layer.

### 10.35 Carry, Staking, And Reinvestment Layer

After BTC and ETH baseline methodology is stabilized, evaluate additional return sources that may coexist with the covered-call strategy.

#### Carry On Underlying Holdings

Study the impact of passive yield earned on the underlying asset while serving as the CCW position.

BTC sensitivity examples:

- +1% annual carry
- +2% annual carry
- +3% annual carry

ETH sensitivity examples:

- +3% annual carry
- +4% annual carry
- +5% annual carry

Model carry as an independent return component applied to the underlying holdings.

#### Premium Reinvestment

Study the impact of reinvesting option premiums into additional units of the underlying asset.

Research goals:

- Position growth over time.
- Compounding effects.
- Impact on CAGR, drawdowns, and long-term wealth accumulation.
- Interaction between reinvestment and different tenors/moneyness levels.

#### Cash Yield

Study yield earned on accumulated cash or premium balances before reinvestment.

Examples:

- Stablecoin yield.
- Treasury-like yield assumptions.
- Conservative money-market assumptions.

Expected to be materially less important than premium reinvestment.

#### Research Principles

- Keep baseline CCW results unchanged and fully comparable.
- Treat carry and reinvestment as implementation-layer enhancements rather than core strategy logic.
- Preserve separation between:
  - Strategy alpha (covered call premiums).
  - Underlying asset appreciation.
  - Carry/staking yield.
  - Premium reinvestment effects.
- Prioritize analysis in the following order:
  1. Underlying carry/staking.
  2. Premium reinvestment.
  3. Cash yield.

### 10.4 Cross-Asset Comparison

- Build BTC/ETH comparison views after ETH replication.
- Separate asset effects from tenor and moneyness effects.
- Avoid expanding to additional assets before BTC/ETH methodology is stable.

### 10.5 Visualization Improvements

- Improve rolling charts, date ticks, legends, and distribution views.
- Add explicit outlier annotation where extreme observations dominate axes.
- Keep visual aggregation documented and separate from source analysis datasets.

### 10.6 Monte Carlo Layer

- Add future Monte Carlo analysis based on realized cycle-return distributions.
- Use it to study path dependency, tail outcomes, drawdown persistence, and strategy robustness.
- Treat Monte Carlo results as scenario analysis, not historical fact.

### 10.7 CSP, Collars, And Hedging Overlays

- Study cash-secured puts, collars, futures hedges, and regime-based hedging overlays after the baseline CCW methodology is stable.
- Keep overlay research separate from baseline results so historical BTC CCW conclusions remain traceable.

### 10.8 Intracycle Risk Modeling

- Preserve the validated Daily Approximate MTM POC for BTC weekly OTM10 2025 under `analysis/generated/poc/daily_mtm_ccw_2025/`.
- Treat the Daily Approximate MTM layer as research-grade only: useful for daily risk, tail-event, VaR, volatility-clustering, and future intracycle hedge simulation research, but not official mark accounting.
- Add generalized intracycle mark-to-market risk when suitable price paths and option OHLC proxies are available.
- Distinguish end-of-cycle reconstructed drawdown from intracycle underwater risk.
- Keep synthetic-cycle MTM gaps visible and avoid bridging missing observations into adjacent daily returns.
- Preserve Passive Hedge Monitoring `v0.4b` as the current research baseline for separating `damage_state` from `alert_state`.
- Treat `damage_state` as accumulated damage context based on drawdown and underwater duration.
- Treat `alert_state` as actionable current-risk context based on VaR, EWMA, and recent tail events.
- Keep Passive Hedge Monitoring as diagnostic only until hedge economics are explicitly simulated.
- Extend realism layers for fees, slippage, funding, custody, and execution constraints.

---

### 10.9 Hedge Monitoring And Simulation Layer

#### Phase 1: Passive Hedge Monitoring

Status: complete for research.

- Build passive daily risk-state artifacts from existing Daily MTM outputs.
- Separate accumulated damage context from actionable alert state.
- Preserve baseline CCW and Daily MTM outputs.

#### Phase 2: Threshold Calibration

Status: complete for research.

- Calibrate thresholds across Passive Hedge Monitoring variants.
- Select `v0.4b` as the current research baseline.
- Treat thresholds as research assumptions, not final operational policy.

#### Phase 3A: Partial Hedge Simulation And Preliminary Economic Evaluation

Status: complete for research.

- Test hedge intensity by `alert_state`.
- Compare unhedged versus hedged Daily MTM paths.
- Preserve baseline outputs and avoid mutating historical Daily MTM artifacts.
- Measure CAGR.
- Measure total return.
- Measure max drawdown.
- Measure underwater duration.
- Measure VaR.
- Measure volatility.
- Measure risk-adjusted metrics.
- Measure hedge activation frequency.
- Measure percentage of days spent hedged.
- Measure protection efficiency ratio: drawdown reduction / return sacrificed.
- Evaluate economic benefit versus simplified hedge assumptions.
- Use these metrics to evaluate the economic efficiency of simple hedge rules before realistic costs are introduced.
- Exclude funding, basis, slippage, margin, and liquidity costs at this stage.

#### Phase 3B: Hedge Intensity Robustness And Preliminary Economic Evaluation

Status: complete for research.

- Quantify return sacrificed versus risk reduction.
- Evaluate protection efficiency.
- Compare hedged and unhedged paths.
- Identify candidate hedge intensities.
- Validate whether the v01 result depends specifically on `stress=25%` and `crisis=50%`.
- Preserve `stress25_crisis50` as a conservative benchmark inherited from v01.
- Identify `stress30_crisis40` as the current primary candidate from the research grid.

#### Phase 3C: Operational Robustness Validation

Status: complete for research.

- Test timing robustness using immediate execution, 1 valid MTM day delay, 2 valid MTM day delay, confirmation, and combined delay/confirmation scenarios.
- Validate that the preliminary benefit does not depend exclusively on perfect execution timing.
- Treat 2 valid MTM day delay as an operational latency limit: still superior to unhedged in this research pass, but materially degraded.
- Preserve `A_immediate`, `B_delay_1_valid_mtm_day`, `D_confirmation`, and `F_delay_confirmation` as scenarios worth carrying into realistic economics.
- Keep all results labeled research-grade only.

#### Phase 4: Realistic Hedge Economics

Status: next research phase; required before operational interpretation.

- Live research execution playbook added in `docs/16_live_research_execution_playbook.md` for initial manual BTC/ETH Dynamic Hedge Overlay testing.
- Phase 3.5A live research snapshot generator added as a read-only manual execution aid.
- ETH Passive Hedge Monitoring v0.4b artifacts added for live snapshot `damage_state` and `alert_state` support, using the available ETH Weekly OTM05 2025 Daily MTM artifact only; this is not yet full multi-year ETH monitoring parity.
- Phase 4 remains pending and is still required before operational or economic validation.
- Next step: optionally create manual log templates, then implement realistic hedge economics when ready.

##### Phase 4A: Economic Assumptions

- Compare perpetual versus futures.
- Add funding assumptions.
- Add basis assumptions.
- Add margin requirements.

##### Phase 4B: Execution Assumptions

- Add slippage assumptions.
- Add execution latency assumptions.
- Add partial fill assumptions.
- Add liquidity constraints.
- Add collateral requirements.

##### Phase 4C: Economic Simulation

- Simulate CCW.
- Simulate Dynamic Hedge Overlay.
- Simulate realistic costs.
- Validate whether the preliminary hedge benefit survives realistic economics.

##### Additional Phase 4 Research

- Add instrument selection research: perpetual, future, and option overlay candidates.
- Add latency sensitivity.
- Add execution assumptions.
- Add hedge implementation research.

#### Current Phase 3 Conclusions

- The preliminary hedge benefit survived Phase 3A, Phase 3B, and Phase 3C.
- Current evidence suggests the hedge overlay is capturing structural periods of elevated risk, not only exploiting near-perfect timing assumptions.
- The research hedge reduced max drawdown, VaR, and volatility versus unhedged in the tested configurations.
- Aggregate return was superior to unhedged in the simplified research methodology.
- Aggregate return improvement does not imply return improvement in every individual year. 2020 and 2025 showed sacrificed return in selected scenarios, while other years were mixed.
- The benefit remained present under plausible operational frictions, including 1 valid MTM day delay, confirmation requirements, and delay plus confirmation.
- The v02 proportional formula is retained only as a simplified proxy:

```text
hedged_return = ccw_return * (1 - hedge_ratio)
```

- The v03 underlying-overlay formula is the reference methodology going forward:

```text
hedged_return = ccw_return - hedge_ratio * underlying_return
```

- `stress30_crisis40` is the current primary candidate.
- `stress25_crisis50` remains the conservative benchmark inherited from v01.
- The benefit does not appear to depend exclusively on perfect execution, but latency matters materially.
- The project has evolved from covered-call backtesting toward a Dynamic Covered Call Risk Management Framework: Covered Call plus Daily Risk Engine plus Regime Detection plus Adaptive Hedge Overlay.

#### Phase 5: Advanced Dynamic Hedging

Status: future research.

- Test hedge-frequency experiments.
- Evaluate event-driven escalation.
- Evaluate regime-aware hedging.
- Evaluate adaptive hedge intensity.

---

## 12. Phase 3.5 Live Workflow

Status: live pilot workflow support complete for current research needs.

- T0 discovery split completed.
- Active daily monitoring split completed.
- Active manual monitoring split completed.
- Position Register operational workflow completed.
- Daily scheduler wrapper completed.

Future work:

- Historical position/cycle storage.
- Long-term operational audit trail.

---

## 11. Risk & Hedging Roadmap

The risk and hedging roadmap separates the implemented fixed hedge frontier from future adaptive and discretionary risk-management layers. The strategic objective is to preserve the BTC CCW return engine while reducing tail-risk destruction and catastrophic crisis damage. It is not to minimize volatility, market-neutralize the strategy, or eliminate BTC exposure.

Current hedge research should be treated as a BTC overlay hedge. It approximately hedges BTC downside exposure, but it is not a true option delta-aware hedge and does not dynamically model option greeks or full option portfolio sensitivity.

Research interpretation should remain conservative:

- Weekly BTC OTM05 is the primary BTC risk-analysis baseline.
- Weekly BTC OTM10 remains structurally strong as an aggressive return-maximizing variant, but its additional return comes with deeper drawdowns, higher volatility, worse VaR/Expected Shortfall, and more time underwater.
- Weekly BTC OTM03 remains a defensive validation/reference configuration.
- Very low max-loss budgets, such as 5%, may require high stress-period hedge ratios and may be economically incompatible with the CCW edge.
- Hedge latency may be a key unresolved issue, especially for 14d cycles, but this is a hypothesis rather than a confirmed conclusion.
- The Daily Approximate MTM POC validated BTC weekly OTM10 2025 daily valuation reconstruction for research purposes, but it is not production-grade accounting and does not include greeks, official marks, funding, slippage, liquidation, or margin.
- Daily MTM exposed deeper intracycle drawdowns, visible volatility clustering, left-tail behavior, and historical VaR persistence beyond cycle-level outputs.
- Passive Hedge Monitoring calibration showed that raw drawdown/underwater thresholds can over-alert.
- The current monitoring research baseline is `v0.4b`, which separates accumulated damage from actionable alert state.
- `v0.4b` is considered sufficiently useful for future partial-hedge simulation research, but it is not a final hedge policy and does not execute hedge actions.
- Hedge Simulation research Phases 3A, 3B, and 3C showed that the partial hedge hypothesis remains promising under the research-grade underlying-overlay methodology.
- The v03 underlying-overlay formula supersedes the v02 proportional formula as the hedge simulation reference.
- `stress30_crisis40` is the current primary hedge-intensity candidate; `stress25_crisis50` remains a conservative benchmark.
- Operational robustness testing suggests the benefit is not purely dependent on perfect timing, although latency materially degrades results.

- Validate fixed hedge frontier outputs.
- Document fixed hedge findings.
- Implement risk-budgeted cyclical EWMA/VaR hedge.
- Compare EWMA/VaR hedge against fixed `h10`, `h20`, and `h40` benchmarks.
- Evaluate historical/empirical VaR.
- Evaluate hybrid VaR using `max(EWMA VaR, Historical VaR)`.
- Design the generalized daily approximate MTM CCW layer using BTC spot/index/perp price plus option OHLC or trade-price proxies.
- Use the validated POC as the reference slice for daily CCW returns, daily drawdowns, historical daily VaR, EWMA volatility, crisis path analysis, and approximate intracycle hedge simulations.
- Caveat daily MTM outputs clearly because option proxies may be stale, sparse, spread-distorted, or liquidity-limited.
- Generalize daily MTM only after preserving POC output structure and methodology traceability.
- Use OTM05 as the default comparison target when generalizing the daily layer.
- Add 14d comparison after weekly daily-MTM behavior is understood.
- Implement passive monitoring artifacts around the selected `v0.4b` state model when ready to version this layer.
- Build a Hedge Simulation Layer that tests partial hedge actions by `alert_state`.
- Run partial hedge experiments by `alert_state`, preserving the unhedged baseline and Daily MTM methodology.
- Validate realistic hedge economics after funding, basis, slippage, liquidity, margin, collateral, and instrument-selection assumptions are introduced.
- Compare perpetual, future, and option overlay implementation candidates.
- Model latency sensitivity and execution assumptions explicitly.
- Simulate intracycle hedge-frequency alternatives to test whether hedge latency matters more than hedge sizing.
- Add funding and basis realism.
- Add intracycle diagnostic and alert layer.
- Eventually test event-driven or crisis-trigger hedge escalation.
- Evaluate full option mark and greek-aware hedging only if suitable external historical data providers, such as Tardis, are available.
- Extend future Monte Carlo research with hedged and unhedged variants.
