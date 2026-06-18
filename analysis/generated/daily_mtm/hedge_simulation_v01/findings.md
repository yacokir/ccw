# Partial Hedge Simulation v0.1

Generated: 2026-06-17T19:31:12.811Z

## Scope

- Strategy: BTC Weekly OTM05.
- Period: Daily Approximate MTM multi-year artifacts, 2020-2025.
- Monitoring input: Passive Hedge Monitoring v0.4b recommended signals.
- Classification: research-grade only.
- This is not an operational hedge policy and does not suggest a real hedge.

## Policy

| alert_state | hedge_ratio |
| --- | --- |
| normal | 0% |
| watch | 0% |
| stress | 25% |
| crisis | 50% |

## Methodology

The simulation applies the hedge ratio from the previous valid Daily MTM `alert_state` to the next valid daily return. This avoids same-day lookahead from alert fields that may include the current daily return.

Formula:

```text
hedged_daily_return = unhedged_daily_return * (1 - hedge_ratio)
```

Simplifying assumption: the hedge is modeled as proportional exposure reduction on the Daily MTM return stream. No specific hedge instrument is modeled.

Excluded from this version: funding, basis, slippage, margin, liquidity, collateral, liquidation risk, exchange constraints, and option-greek-aware hedge behavior.

## Aggregate Comparison

| series | validReturnDays | totalReturnPct | CAGRpct | maxDrawdownPct | volatilityPct | historicalVaRPct | ewmaMaxPct | pctDaysHedged | averageHedgeRatioPct | returnSacrificedPct | drawdownReductionPctPoints | protectionEfficiencyRatio |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| unhedged | 1480 | 51.442572 | 7.194406 | -80.891376 | 2.909341 | -4.180938 | 7.713906 |  |  |  |  |  |
| hedged_v01 | 1480 | 90.112791 | 11.353622 | -75.202563 | 2.674064 | -3.797859 | 6.810413 | 20.135135 | 5.320946 | -38.670219 | 5.688813 |  |

## Yearly Hedged Summary

| year | regime | totalReturnPct | maxDrawdownPct | volatilityPct | historicalVaRPct | pctDaysHedged | averageHedgeRatioPct | returnSacrificedPct | drawdownReductionPctPoints | protectionEfficiencyRatio |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2020 | Bull market | 49.178648 | -52.173042 | 2.884632 | -2.834669 | 12.598425 | 3.149606 | 4.184933 | 2.876686 | 0.687391 |
| 2021 | Bull market | -18.217701 | -49.917539 | 3.751983 | -6.739009 | 30.364372 | 9.311741 | -3.474549 | 3.869259 |  |
| 2022 | Bear market | -57.431915 | -59.944777 | 2.632574 | -4.181284 | 65.833333 | 16.458333 | -8.308442 | 7.819579 |  |
| 2023 | Recovery | 109.602398 | -18.240579 | 2.366133 | -2.762413 | 0 | 0 | 0 | 0 |  |
| 2024 | ETF/Bull | 94.772768 | -15.374203 | 2.142023 | -3.681167 | 0.416667 | 0.104167 | 0.551321 | 0 | 0 |
| 2025 | Mixed | -10.332149 | -27.488555 | 1.789071 | -2.795671 | 12.698413 | 3.174603 | 0.237618 | 2.040449 | 8.587099 |

## Main Findings

- The v0.1 hedge was active on 20.135135% of valid return days with an average hedge ratio of 5.320946%.
- Aggregate total return moved from 51.442572% unhedged to 90.112791% hedged.
- Aggregate max drawdown moved from -80.891376% unhedged to -75.202563% hedged.
- Aggregate volatility moved from 2.909341% to 2.674064%.
- Aggregate historical VaR moved from -4.180938% to -3.797859%.
- No aggregate return was sacrificed in this simplified model; hedged total return exceeded unhedged by 38.670219 percentage points.
- Protection efficiency ratio is not defined because the simplified hedge did not sacrifice aggregate return.
- Years with clear drawdown help: 2020 (2.876686 pp DD reduction), 2021 (3.869259 pp DD reduction), 2022 (7.819579 pp DD reduction), 2025 (2.040449 pp DD reduction).
- Years where hedge looked mostly unnecessary by activation: 2023 (0% hedged days), 2024 (0.416667% hedged days).

## Interpretation

- The result should be read as a first economic screen, not as evidence of final hedge viability.
- A positive risk reduction with limited return sacrifice would justify realistic hedge economics in Phase 4.
- A weak or unstable protection-efficiency ratio would suggest revisiting hedge intensity or alert-state mapping before adding costs.

## Limitations

- Proportional exposure reduction is a simplification and may not match futures/perpetual hedge PnL.
- The model uses previous valid Daily MTM state to avoid lookahead, but it does not model execution timing within the day.
- Missing Daily MTM gaps remain inherited from the source artifacts.
- Costs and implementation constraints are intentionally excluded.
- BTC overlay hedge behavior may diverge from full CCW portfolio sensitivity because option greeks are not modeled.
