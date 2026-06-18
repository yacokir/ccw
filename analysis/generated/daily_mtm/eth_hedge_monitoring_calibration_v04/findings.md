# ETH Passive Hedge Monitoring Calibration v0.4

Generated: 2026-06-18T17:46:55.804Z

## Scope

- Inputs: existing ETH Weekly OTM05 Daily MTM artifact for 2025.
- Methodology: BTC Passive Hedge Monitoring v0.4b thresholds and state rules, replicated without threshold changes.
- No hedge execution and no Daily MTM regeneration.
- This is research-grade support for live/manual snapshot generation, not a production hedge policy.

## Configuration Comparison

| configId | normalDays | watchDays | stressDays | crisisDays | stressOrCrisisPct | crisisPct | damageStressOrCrisisPct | transitionCount | maxStressEpisodeDays | maxCrisisEpisodeDays | largeDrawdownLeadPct | largeDrawdownFalseNegativePct | recommended |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| v04a_confirmation_stress | 109 | 138 | 110 | 0 | 30.812325 | 0 | 65.266106 | 30 | 21 | 0 | 100 | 0 | false |
| v04b_actionable_stress_recommended | 109 | 134 | 114 | 0 | 31.932773 | 0 | 65.266106 | 30 | 21 | 0 | 100 | 0 | true |
| v04c_regime_stress | 109 | 248 | 0 | 0 | 0 | 0 | 65.266106 | 6 | 0 | 0 | 100 | 0 | false |

## Recommendation

Recommended v0.4 set: v04b_actionable_stress_recommended.

- v0.4b is retained because it is the current BTC research baseline.
- ETH calibration is limited by the currently available ETH Daily MTM scope.
- Funding, basis, slippage, custody, margin, and hedge latency remain outside this layer.

## Recommended Variant Yearly Detail

| year | regime | normalDays | watchDays | stressDays | crisisDays | stressOrCrisisPct | crisisPct | damageStressOrCrisisPct | transitionCount | maxStressEpisodeDays | maxCrisisEpisodeDays | largeDrawdownLeadPct | largeDrawdownFalseNegativePct |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2025 | Mixed | 109 | 134 | 114 | 0 | 31.932773 | 0 | 65.266106 | 30 | 21 | 0 | 100 | 0 |
