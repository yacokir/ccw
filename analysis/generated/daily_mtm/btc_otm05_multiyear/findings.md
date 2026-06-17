# BTC Weekly OTM05 Daily MTM Multi-Year Risk Analysis

Generated: 2026-06-16T19:16:29.400Z

## Scope

- Strategy: BTC Weekly OTM05.
- Years: 2020 through 2025.
- Inputs: annual Daily MTM JSON artifacts only.
- Methodology: unchanged Daily Approximate MTM methodology.
- Purpose: risk-management regime analysis, not strategy ranking.

## Yearly Results

| year | regime | returns | stdDev | maxDD | worstDay | p5 | ewmaP95 | varP95 | varWorst | uwPct | lt5 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2020 | Bull market | 254 | 3.044786% | -54.036507% | -24.329604% | -2.834669% | 6.058869% | 9.999168% | 9.999168% | 80.827068% | 7 |
| 2021 | Bull market | 247 | 4.258365% | -52.446788% | -18.002004% | -8.343169% | 6.806541% | 11.580766% | 11.780346% | 88.803089% | 21 |
| 2022 | Bear market | 240 | 3.091512% | -63.424948% | -13.322949% | -5.054033% | 4.327759% | 6.382518% | 8.593602% | 97.619048% | 14 |
| 2023 | Recovery | 247 | 2.366133% | -18.902711% | -8.948255% | -2.762413% | 4.206047% | 3.477927% | 4.233107% | 79.150579% | 2 |
| 2024 | ETF/Bull | 240 | 2.142412% | -23.419236% | -6.247014% | -3.681167% | 2.727671% | 4.959088% | 4.959088% | 82.142857% | 3 |
| 2025 | Mixed | 252 | 1.854251% | -32.756283% | -8.626384% | -2.795671% | 2.538125% | 5.680092% | 6.233757% | 91.320755% | 5 |

## Regime Comparison

- Deepest daily drawdown: 2022 (Bear market) at -63.424948%.
- Highest daily volatility: 2021 (Bull market) with daily std dev 4.258365%.
- Worst historical VaR loss: 2021 (Bull market) at 11.780346%.
- Calmest daily-volatility year: 2025.

## Answers

- Does daily risk change significantly across years? Yes. Daily volatility, drawdown depth, VaR loss, and tail-day counts vary materially by regime.
- Is max daily drawdown structural or regime dependent? Both. The strategy is structurally exposed to intracycle underwater paths, but bear/stress years amplify the depth sharply.
- Is daily VaR structural or regime dependent? Both. VaR exists in every year, but the worst VaR loss and p95 VaR zones rise materially in stress regimes.
- Is daily volatility structural or regime dependent? Both. Daily volatility is always visible, but regime controls the intensity.
- Clearly more dangerous regimes: 2022 Bear market, 2021 Bull market, 2021 Bull market.

## Threshold Evidence

- EWMA watch zone around 4.266903%; stress zone around 6.058869%; observed max 7.712212%.
- VaR loss watch zone around 6.031305%; stress zone around 9.999168%; observed worst 11.780346%.
- Drawdown zones: watch around -20%, stress around -35%, crisis around -50%; observed worst -63.424948%.

These are evidence-based research zones, not final hedge triggers.

## Risk Management Conclusions

- Daily MTM risk signals are structural but strongly regime-amplified.
- Drawdown and underwater persistence are likely the most intuitive hedge-control inputs because they measure path damage directly.
- Historical VaR is useful as a stress-persistence signal and may be more actionable than EWMA alone when losses cluster.
- EWMA is useful as a volatility state variable, especially for sizing or throttle intensity, but it should not be the only trigger.
- Large loss counts below -5% help identify regimes where reactive hedge timing may matter more than static hedge size.

## Future Hedge Layer Recommendations

- Start with monitoring rules before trading rules: EWMA zone, VaR zone, drawdown zone, and underwater duration.
- Test simple risk-reduction overlays triggered by drawdown and confirmed by VaR/EWMA, rather than a purely EWMA-only trigger.
- Treat drawdown below -20% as an early warning, below -35% as stress, and below -50% as crisis for research simulations.
- Evaluate whether hedges should activate on persistent VaR loss above the stress zone rather than one-day shocks alone.
- Keep synthetic-cycle gaps visible in all hedge simulations; do not bridge missing MTM observations.

## Caveats

- Approximate research MTM only.
- No official historical option marks, greeks, funding, slippage, margin, liquidation, or hedge execution costs.
- Single-strategy risk analysis; not a cross-strategy ranking.
