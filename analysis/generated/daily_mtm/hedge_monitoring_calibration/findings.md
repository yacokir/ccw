# Passive Hedge Monitoring Threshold Calibration

Generated: 2026-06-17T09:52:37.632Z

## Scope

- Inputs: existing BTC Weekly OTM05 Daily MTM artifacts, 2020-2025.
- No hedge execution.
- No Daily MTM regeneration.
- Goal: reduce over-alerting while preserving early warning before large drawdowns.

## Configuration Comparison

| configId | normalDays | watchDays | stressDays | crisisDays | stressOrCrisisPct | crisisPct | transitionCount | maxStressEpisodeDays | maxCrisisEpisodeDays | stressDrawdownLeadPct | bullRecoveryCrisisPct | recommended |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| current_v0_1 | 375 | 213 | 295 | 1266 | 72.638436 | 58.911121 | 181 | 30 | 309 | 100 | 55.261324 | false |
| less_aggressive_crisis_v0_2_candidate | 376 | 215 | 328 | 1230 | 72.498837 | 57.235924 | 181 | 30 | 309 | 100 | 53.797909 | false |
| confirmation_based_v0_2_recommended | 393 | 217 | 352 | 1187 | 71.614705 | 55.234993 | 184 | 38 | 309 | 100 | 51.777003 | true |

## Recommendation

Recommended threshold set: confirmation_based_v0_2_recommended.

- Rationale: it reduces crisis dominance, prevents underwater duration from forcing crisis alone, and keeps large drawdowns preceded by watch/stress signals.
- Drawdown remains the primary risk signal.
- VaR confirms stress and tail persistence.
- EWMA remains useful context/sizing, but not a standalone crisis driver.

## Key Findings

- Current thresholds over-alert: stress/crisis occupies too much of the sample.
- Less aggressive crisis thresholds help, but duration can still dominate.
- Confirmation-based thresholds provide the cleanest v0.2 candidate because crisis requires more severe price/risk evidence.
- Bull and recovery regimes still produce alerts, which is expected for BTC, but crisis no longer dominates solely because the strategy remains underwater.

## v0.2 Proposed Threshold Behavior

- Drawdown: watch -20%, stress -40%, crisis -60%.
- VaR loss: watch 6%, stress 10%, crisis 12%.
- EWMA: watch 4.25%, stress 6%, crisis 8%.
- Underwater duration: watch 14d, stress 21d, crisis 35d, but duration cannot trigger crisis alone.

## Next Checks Before Hedge Simulation

- Inspect state transitions around 2020 crash, 2021 drawdowns, and 2022 bear market.
- Test whether stress is early enough without keeping the system permanently escalated.
- Consider requiring drawdown plus VaR confirmation for any future hedge action.
- Keep this as monitoring only until funding, basis, custody, slippage, and hedge latency are modeled.

## Yearly Details

| year | regime | normalDays | watchDays | stressDays | crisisDays | stressOrCrisisPct | crisisPct | transitionCount | maxStressEpisodeDays | maxCrisisEpisodeDays | stressDrawdownLeadPct |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2020 | Bull market | 94 | 24 | 75 | 164 | 66.946779 | 45.938375 | 29 | 38 | 151 | 100 |
| 2021 | Bull market | 23 | 39 | 36 | 266 | 82.967033 | 73.076923 | 33 | 10 | 160 | 100 |
| 2022 | Bear market | 2 | 4 | 36 | 315 | 98.319328 | 88.235294 | 8 | 30 | 309 | 100 |
| 2023 | Recovery | 117 | 64 | 49 | 127 | 49.29972 | 35.57423 | 38 | 10 | 77 | 0 |
| 2024 | ETF/Bull | 79 | 32 | 60 | 186 | 68.907563 | 52.10084 | 34 | 19 | 126 | 0 |
| 2025 | Mixed | 78 | 54 | 96 | 129 | 63.02521 | 36.134454 | 42 | 26 | 83 | 0 |
