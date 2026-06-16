# ETH Weekly OTM03 Robustness Findings

Generated from existing ETH weekly backtest outputs only. No new assets, tenors, moneyness studies, Daily MTM, or methodology changes were introduced.

## Friction Assumptions

- Idealized: no fees or slippage.
- Realistic: 0.03% option opening fee capped at 12.5% of premium, 0.015% delivery fee on assigned calls, and 5% premium/slippage haircut.
- Stress: 2x fees, 10% premium/slippage haircut, and 2.5 bp underlying slippage on assigned calls.

## Friction Result

- Idealized OTM03: 1290.846577% return, Sharpe 1.080559, drawdown -58.526438%.
- Idealized OTM05: 1200.535835% return, Sharpe 1.032497, drawdown -61.440019%.
- Realistic OTM03: 667.240167% return, -393.314036% excess vs ETH, Sharpe 0.904085, drawdown -60.496555%.
- Realistic OTM05: 697.258403% return, -363.2958% excess vs ETH, Sharpe 0.895642, drawdown -62.876889%.
- Stress OTM03: 308.63323% return, Sharpe 0.716525, drawdown -65.11497%.
- Stress OTM05: 375.353486% return, Sharpe 0.750578, drawdown -64.29961%.
- ETH benchmark: 1060.554204% return, Sharpe 0.886039, drawdown -73.705059%.

Friction weakens the OTM03 case. OTM03 wins raw/idealized return and drawdown versus OTM05, but OTM05 wins under realistic and stress friction assumptions.

## Yearly Stability

- OTM03 2020-2025 average annual return: 105.047655%, annual-return stdev 155.149203%, positive years 83.333333%.
- OTM05 2020-2025 average annual return: 112.949064%, annual-return stdev 169.963622%, positive years 66.666667%.
- OTM03 wins 2022, 2025, and 2026; OTM05 wins 2020, 2021, 2023, and 2024.

OTM03 is steadier by positive-year count and annual-return dispersion, but OTM05 has the higher average annual return over complete years.

## Regime Analysis

- Bull 2020-2021: OTM05 leads, 1670.679012% vs OTM03 1497.110564%.
- Bear 2022: OTM03 leads, -37.841647% vs OTM05 -45.465143%.
- Recovery/transition 2023: OTM05 leads, 48.506666% vs OTM03 38.881466%.
- ETF/bull 2024-2025: OTM03 leads, 28.165654% vs OTM05 25.560461%.

The regime result is split 2-2. OTM03 is better in bear and later ETF/bull conditions; OTM05 is better in the early bull and 2023 recovery windows.

## Regime Transitions

- Bull to bear: OTM05 return 1.114243% vs OTM03 -0.459352%; OTM03 drawdown -58.526438% vs OTM05 -61.440019%.
- Bear to bull: OTM03 return 53.62454% vs OTM05 52.022974%; OTM03 drawdown -17.515443% vs OTM05 -21.782509%.

OTM03 has better transition drawdowns and slightly better bear-to-bull rebound, but OTM05 slightly preserves return better in the bull-to-bear window.

## Implementation Reality

- OTM03 estimated actions/year: 71.124362, assignment frequency 38.787879%, synthetic option cycles 27.878788%.
- OTM05 estimated actions/year: 66.931441, assignment frequency 30.606061%, synthetic option cycles 27.878788%.

Implementation favors OTM05: same synthetic dependence, fewer assignments, and fewer estimated trading actions.

## Final Answer

Weekly OTM03 should not yet be promoted as a fully robust ETH baseline. It remains the raw-return leader and a strong defensive/stability candidate, but the robustness evidence is mixed: OTM05 wins realistic/stress friction, has lower operational burden, wins four of seven calendar years, and leads in two of four fixed regimes.

Recommendation: keep ETH Weekly OTM03 as the leading provisional candidate only under idealized/no-friction assumptions; for a robust baseline decision, treat OTM03 and OTM05 as co-finalists until friction assumptions are either accepted, refined, or validated against execution data.
