# Passive Hedge Monitoring Calibration v0.3

Generated: 2026-06-17T10:02:17.407Z

## Scope

- Inputs: existing BTC Weekly OTM05 Daily MTM artifacts, 2020-2025.
- No hedge execution and no Daily MTM regeneration.
- Conceptual change: separate accumulated damage from actionable alert state.

## Configuration Comparison

| configId | normalDays | watchDays | stressDays | crisisDays | stressOrCrisisPct | crisisPct | damageStressOrCrisisPct | transitionCount | maxStressEpisodeDays | maxCrisisEpisodeDays | largeDrawdownLeadPct | largeDrawdownFalseNegativePct | bullRecoveryStressOrCrisisPct | bullRecoveryCrisisPct | recommended |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| v03a_drawdown_crisis_plus_var_stress | 542 | 152 | 1439 | 16 | 67.70591 | 0.744532 | 53.978595 | 173 | 199 | 2 | 100 | 0 | 62.369338 | 0.905923 | false |
| v03b_drawdown_stress_plus_var_stress_plus_tail | 542 | 152 | 1422 | 33 | 67.70591 | 1.535598 | 53.978595 | 183 | 199 | 3 | 100 | 0 | 62.369338 | 2.090592 | true |
| v03c_var_or_ewma_crisis_with_drawdown_watch | 542 | 152 | 1439 | 16 | 67.70591 | 0.744532 | 53.978595 | 173 | 199 | 2 | 100 | 0 | 62.369338 | 0.905923 | false |

## Recommendation

Recommended v0.3 set: v03b_drawdown_stress_plus_var_stress_plus_tail.

- This is the most operationally useful of the tested variants because it sharply reduces crisis dominance while preserving watch/stress lead before large drawdowns.
- It should still be treated as research, not an executable hedge policy.
- Crisis now means acute stress on top of damage, not merely persistent underwater damage.

## Interpretation

- v0.3a is conservative and still too crisis-heavy because drawdown crisis plus VaR stress can persist.
- v0.3b gives the cleanest actionable interpretation: crisis requires drawdown stress, VaR stress, and recent tail events.
- v0.3c is too dependent on rare acute VaR/EWMA crisis and may understate drawdown-driven stress.
- Damage state can remain elevated for long periods, but alert state becomes more discriminating.

## Recommended Variant Yearly Detail

| year | regime | normalDays | watchDays | stressDays | crisisDays | stressOrCrisisPct | crisisPct | damageStressOrCrisisPct | transitionCount | maxStressEpisodeDays | maxCrisisEpisodeDays | largeDrawdownLeadPct | largeDrawdownFalseNegativePct |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2020 | Bull market | 124 | 11 | 219 | 3 | 62.184874 | 0.840336 | 51.540616 | 23 | 146 | 2 | 100 | 0 |
| 2021 | Bull market | 45 | 46 | 246 | 27 | 75 | 7.417582 | 50.274725 | 56 | 100 | 3 | 100 | 0 |
| 2022 | Bear market | 5 | 5 | 344 | 3 | 97.19888 | 0.840336 | 82.633053 | 15 | 199 | 1 | 100 | 0 |
| 2023 | Recovery | 159 | 32 | 166 | 0 | 46.498599 | 0 | 36.97479 | 29 | 84 | 0 | 0 | 0 |
| 2024 | ETF/Bull | 104 | 19 | 234 | 0 | 65.546218 | 0 | 51.260504 | 27 | 140 | 0 | 0 | 0 |
| 2025 | Mixed | 105 | 39 | 213 | 0 | 59.663866 | 0 | 51.260504 | 33 | 83 | 0 | 0 | 0 |

## Operational Readiness

- v0.3 is much closer to operationally useful than v0.1/v0.2.
- It is still a monitoring research layer because it does not include funding, basis, hedge cost, hedge latency, liquidity, margin, or execution realism.
- The next step should inspect transition timing around 2020 crash, 2021 drawdowns, and 2022 bear market before simulating hedge actions.
