# Passive Hedge Monitoring Calibration v0.4

Generated: 2026-06-17T11:31:07.695Z

## Scope

- Inputs: existing BTC Weekly OTM05 Daily MTM artifacts, 2020-2025.
- No hedge execution and no Daily MTM regeneration.
- Conceptual change: separate damage stress from actionable stress.
- Crisis rule remains based on v0.3b.

## Configuration Comparison

| configId | normalDays | watchDays | stressDays | crisisDays | stressOrCrisisPct | crisisPct | damageStressOrCrisisPct | transitionCount | maxStressEpisodeDays | maxCrisisEpisodeDays | largeDrawdownLeadPct | largeDrawdownFalseNegativePct | stressYearsFalseNegativePct | bullRecoveryStressOrCrisisPct | bullRecoveryCrisisPct | recommended |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| v04a_confirmation_stress | 810 | 1090 | 231 | 18 | 11.586785 | 0.837599 | 53.978595 | 132 | 21 | 3 | 100 | 0 | 0 | 8.362369 | 1.254355 | false |
| v04b_actionable_stress_recommended | 810 | 1027 | 294 | 18 | 14.518381 | 0.837599 | 53.978595 | 110 | 21 | 3 | 100 | 0 | 0 | 7.874564 | 1.254355 | true |
| v04c_regime_stress | 810 | 1256 | 65 | 18 | 3.862262 | 0.837599 | 53.978595 | 68 | 15 | 3 | 100 | 0 | 0 | 5.365854 | 1.254355 | false |

## Recommendation

Recommended v0.4 set: v04b_actionable_stress_recommended.

- v0.4b is closest to the target operational band while preserving lead before large drawdowns.
- It treats drawdown stress as actionable stress, and also catches drawdown watch plus VaR/tail confirmation.
- v0.4a remains too broad.
- v0.4c is cleaner but likely too late/narrow for partial hedge research.

## Operational Usefulness

- v0.4b looks useful enough for a first partial-hedge simulation research pass.
- It is still not a live hedge policy because funding, basis, slippage, custody, and hedge latency are not modeled.
- Crisis remains rare and discriminative; stress becomes materially more selective than v0.3.

## Recommended Variant Yearly Detail

| year | regime | normalDays | watchDays | stressDays | crisisDays | stressOrCrisisPct | crisisPct | damageStressOrCrisisPct | transitionCount | maxStressEpisodeDays | maxCrisisEpisodeDays | largeDrawdownLeadPct | largeDrawdownFalseNegativePct |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2020 | Bull market | 161 | 163 | 33 | 0 | 9.243697 | 0 | 51.540616 | 9 | 18 | 0 | 100 | 0 |
| 2021 | Bull market | 134 | 151 | 61 | 18 | 21.703297 | 4.945055 | 50.274725 | 36 | 18 | 3 | 100 | 0 |
| 2022 | Bear market | 40 | 151 | 166 | 0 | 46.498599 | 0 | 82.633053 | 21 | 21 | 0 | 100 | 0 |
| 2023 | Recovery | 207 | 150 | 0 | 0 | 0 | 0 | 36.97479 | 7 | 0 | 0 | 0 | 0 |
| 2024 | ETF/Bull | 131 | 225 | 1 | 0 | 0.280112 | 0 | 51.260504 | 9 | 1 | 0 | 0 | 0 |
| 2025 | Mixed | 137 | 187 | 33 | 0 | 9.243697 | 0 | 51.260504 | 28 | 8 | 0 | 0 | 0 |
