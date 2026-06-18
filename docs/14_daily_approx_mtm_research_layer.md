# Daily Approximate MTM Research Layer

## Purpose

The Daily Approximate MTM Research Layer estimates daily BTC CCW valuation, returns, drawdowns, volatility, VaR, and tail behavior from historical BTC price data plus option OHLC or trade-price proxies.

This layer exists to support daily risk analysis, tail-event analysis, daily VaR research, volatility clustering research, and future intracycle hedge simulation. It does not provide official mark accounting, greek-aware hedging, true option portfolio risk modeling, or production-quality risk systems.

## Validated POC Scope

The current validated POC scope is intentionally narrow:

- Asset: BTC.
- Tenor: weekly.
- Moneyness: OTM10.
- Year: 2025.
- Snapshot: 10:00 New York time, converted consistently to UTC.

POC outputs are archived under:

```text
analysis/generated/poc/daily_mtm_ccw_2025/
```

This folder should remain a traceable validation slice and should not be overwritten by future generalized daily-risk runs.

## Methodology

The validated POC uses:

- BTC proxy: Deribit `BTC-PERPETUAL` 1-minute candle close at the daily snapshot.
- Option proxy: exact traded short-call option 1-minute OHLC close at the same snapshot.
- Option conversion: BTC-denominated option close converted to USD using the snapshot BTC price.
- Approximate valuation: `approximate_CCW_value = BTC_price - option_price_proxy_usd`.
- Daily returns: computed only across adjacent valid MTM observations.
- EWMA volatility: daily approximate CCW returns with `lambda = 0.94`.
- Historical VaR: empirical 5th percentile over a rolling 30 valid daily-return window.

Missing MTM gaps are kept visible. Synthetic cycles without exact observed option instruments are not bridged into adjacent daily returns.

## Validated Findings

Current BTC weekly OTM10 2025 findings support the layer as research-grade:

- Approximate daily MTM reconstruction is viable for exact observed option cycles.
- Daily return distributions are usable for exploratory risk research.
- Daily MTM exposes deeper intracycle drawdowns than cycle-level outputs alone.
- Volatility clustering and left-tail behavior are visible.
- Historical VaR appears more informative than EWMA alone for BTC stress persistence in this slice.
- Missing synthetic-cycle gaps remain an important continuity limitation.

These findings do not establish hedge effectiveness. They only validate that the daily-risk layer can support future research.

## Generalized Research Layer

The Daily Approximate MTM methodology has been generalized into a reusable runner and applied to:

- BTC Weekly OTM05 2025.
- BTC Weekly OTM10 2025.
- ETH Weekly OTM05 2025.
- ETH Weekly OTM03 2025.
- BTC Weekly OTM05 multi-year risk research for 2020 through 2025.

The generalized layer preserves the POC methodology: same snapshot convention, same underlying perpetual proxy, exact observed option 1-minute candles when available, visible gaps, no interpolation of synthetic cycles, EWMA volatility with `lambda = 0.94`, and rolling 30-observation historical VaR.

The original POC remains archived and should not be overwritten. Generalized outputs live under:

```text
analysis/generated/daily_mtm/
```

## Passive Hedge Monitoring Research

The Daily MTM layer now supports a Passive Hedge Monitoring research layer. This layer does not execute hedges. It classifies each valid Daily MTM observation into research states that can later be used for hedge simulation.

The key conceptual change is the separation between:

- `damage_state`: accumulated strategy damage, based on drawdown and underwater duration.
- `alert_state`: actionable daily risk, based on historical VaR, EWMA volatility, and recent tail-loss events.

The first monitoring attempts showed that direct thresholds on drawdown and underwater duration caused too many `stress` and `crisis` observations. The calibration sequence therefore evolved as follows:

- Initial thresholds confirmed that Daily MTM signals are useful, but `stress`/`crisis` were too frequent.
- `v0.3` separated accumulated damage from actionable alert state and made `crisis` rare and more meaningful.
- `v0.4b` further separated damage stress from actionable stress and is the current provisional research baseline.

`v0.4b` should be interpreted as sufficiently useful for future partial-hedge simulation research, not as a production hedge policy. The thresholds are still research assumptions and require validation against funding, basis, slippage, liquidity, margin, and collateral constraints.

## Hedge Simulation Research

The Daily MTM layer now supports a Hedge Simulation Research Layer built on top of Passive Hedge Monitoring `v0.4b`.

Completed research phases:

- Phase 3A: Partial Hedge Simulation And Preliminary Economic Evaluation.
- Phase 3B: Hedge Intensity Robustness.
- Phase 3C: Operational Robustness Validation.

The v01/v02 simulation used a proportional exposure proxy:

```text
hedged_return = ccw_return * (1 - hedge_ratio)
```

That proxy is retained only as a simplified first screen. It mechanically scales the CCW return stream and is not the preferred approximation for a short futures or perpetual overlay.

The v03 and v04 simulations use the current reference research formula:

```text
hedged_return = ccw_return - hedge_ratio * underlying_return
```

The `underlying_return` is reconstructed from the `underlying_price` already present in the Daily MTM artifacts, using the same valid daily snapshot path as the CCW return. This better approximates a short BTC underlying/perpetual overlay while preserving the approximate Daily MTM source methodology.

Current findings:

- The preliminary hedge benefit survived the move from v02 proportional proxy to v03 underlying-overlay.
- `stress30_crisis40` is the current primary research candidate.
- `stress25_crisis50` is retained as a conservative benchmark inherited from v01.
- Operational robustness testing showed that `A_immediate`, `B_delay_1_valid_mtm_day`, `D_confirmation`, and `F_delay_confirmation` remain useful scenarios for realistic economics.
- `C_delay_2_valid_mtm_days` remained superior to unhedged in the research artifacts, but showed material deterioration and should be treated as an operational latency limit.

These results are research-grade only. They do not establish hedge viability because funding, basis, slippage, margin, liquidity, collateral, instrument selection, liquidation risk, and execution mechanics remain excluded.

## Limitations

The current layer is approximate and exploratory:

- No official historical option marks.
- No historical greeks.
- No delta-aware hedge.
- No full option portfolio sensitivity model.
- Option OHLC/trade-price proxies may be stale, sparse, spread-distorted, or liquidity-distorted.
- Synthetic-cycle continuity gaps remain visible.
- No funding, slippage, liquidation, margin, basis, collateral, custody, or tax modeling.
- Passive monitoring states are not hedge instructions and should not be treated as final operational risk policy.
- Hedge simulation outputs are research approximations and do not yet model realistic hedge economics or instrument-specific PnL.

## Roadmap

Future work should proceed in this order:

1. Preserve the current POC artifact structure.
2. Build a generalized multi-year daily MTM framework.
3. Compare OTM05 against OTM10.
4. Compare 14d against weekly.
5. Evaluate hybrid VaR, including `max(EWMA VaR, Historical VaR)`.
6. Preserve Passive Hedge Monitoring `v0.4b` as the current research baseline for damage versus alert state.
7. Preserve Hedge Simulation v03 underlying-overlay as the reference research methodology.
8. Carry `stress30_crisis40` as the primary candidate and `stress25_crisis50` as the conservative benchmark.
9. Validate realistic hedge economics, including funding, basis, slippage, liquidity, margin, collateral, and instrument selection.
10. Simulate intracycle hedge-frequency alternatives.
11. Add latency sensitivity, execution assumptions, and hedge implementation research.
12. Add event-driven or crisis-trigger research only after simpler daily-risk behavior is understood.
13. Consider external historical option-mark providers, such as Tardis, for official marks, greeks, or fuller option-chain snapshots.
