# Passive Hedge Monitoring Layer - BTC Weekly OTM05

Generated: 2026-06-17T09:38:46.220Z

## Scope

- Inputs: existing BTC Weekly OTM05 Daily MTM artifacts, 2020-2025.
- Purpose: answer "what risk state is the strategy in today?"
- Explicit non-goal: decide or execute a hedge.
- Thresholds are preliminary research thresholds, not production rules.

## State Counts

- Normal: 375
- Watch: 214
- Stress: 294
- Crisis: 1266
- Stress or crisis share: 72.591903%

## Yearly Alert Summary

| year | regime | normal | watch | stress | crisis | stressPct | maxStressEp | maxCrisisEp | firstStress | firstCrisis |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2020 | Bull market | 89 | 24 | 47 | 197 | 68.347339% | 15 | 153 | 2020-01-23 | 2020-02-20 |
| 2021 | Bull market | 21 | 39 | 36 | 268 | 83.516484% | 10 | 162 | 2021-01-14 | 2021-01-11 |
| 2022 | Bear market | 2 | 4 | 36 | 315 | 98.319328% | 30 | 309 | 2022-01-09 | 2022-01-07 |
| 2023 | Recovery | 113 | 64 | 42 | 138 | 50.420168% | 7 | 79 | 2023-01-08 | 2023-01-06 |
| 2024 | ETF/Bull | 78 | 30 | 59 | 190 | 69.747899% | 19 | 128 | 2024-01-19 | 2024-03-19 |
| 2025 | Mixed | 72 | 53 | 74 | 158 | 64.985994% | 14 | 85 | 2025-01-03 | 2025-02-27 |

## Questions

1. Days by state: normal 375, watch 214, stress 294, crisis 1266.
2. Most stress days: 2025. Most crisis days: 2022.
3. Longest stress episode: 30 days. Longest crisis episode: 309 days.
4. Alerts before large drawdowns: 100% of stress-drawdown rows had a prior watch-or-worse signal in the previous 7 valid rows.
5. Threshold reasonableness: Moderate: 2020/2021 bull years still produce many stress/crisis alerts because upside regimes can contain violent intracycle drawdowns.
6. Redundancy:
   - drawdown and underwater duration are correlated but not identical; duration adds persistence.
   - VaR and EWMA overlap as stress indicators, but VaR captures loss persistence more directly.
   - daily return threshold is noisy alone and is best used as a tail-frequency input.
7. Most useful future hedge signals:
   - drawdown state
   - VaR loss state
   - underwater duration
   - recent tail-loss frequency
   - EWMA as sizing/context signal
8. Hysteresis reduced noise: yes. Raw stress/crisis share 62.540717% vs final 72.591903%.
9. Obvious adjustments before hedge simulation:
   - Require confirmation before acting on watch alerts.
   - Use drawdown plus VaR or drawdown plus duration for stress escalation.
   - Consider asset/regime-specific calibration before live hedge simulation.
   - Keep crisis thresholds conservative until funding, basis, slippage, and hedge latency are modeled.

## Recommendations

- Keep this as a passive monitoring layer first.
- Use drawdown as the primary state signal.
- Use VaR and underwater duration as confirmation signals.
- Use EWMA as sizing/context for future hedge research, not as the sole trigger.
- Treat daily-return shocks as noisy unless they cluster.
- Do not bridge Daily MTM data gaps in future hedge simulations.

## Limitations

- Approximate MTM only; no official option marks or greeks.
- No funding, basis, slippage, custody, margin, liquidation, or hedge execution costs.
- Thresholds are calibrated from BTC OTM05 2020-2025 and may not transfer to ETH or other strategies.
- Hysteresis is intentionally simple and should be validated before any hedge simulation.
