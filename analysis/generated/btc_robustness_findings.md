# BTC Robustness Findings

Generated from existing weekly BTC backtest outputs only. No new market data, assets, tenors, or strategies were introduced.

## Friction Assumptions

- Idealized: no fees or slippage.
- Realistic: 0.03% option opening fee capped at 12.5% of premium, 0.015% delivery fee on assigned calls, and 5% premium/slippage haircut.
- Stress: 2x fees, 10% premium/slippage haircut, and 2.5 bp underlying slippage on assigned calls.

These are first-order Deribit-style implementation assumptions, not a full order-book simulator.

## Friction Result

- Realistic OTM05: 725.432847% return, -122.050969% excess vs BTC, Sharpe 0.992699, drawdown -52.807922%.
- Realistic OTM10: 891.807211% return, 44.323395% excess vs BTC, Sharpe 0.985014, drawdown -60.148921%.
- Realistic OTM03: 601.790416% return, -245.693399% excess vs BTC, Sharpe 0.978644, drawdown -45.580881%.
- BTC benchmark: 847.483816% return, Sharpe 0.899854, drawdown -71.178211%.

OTM05 remains the best baseline after realistic costs. OTM10 still leads on absolute return, but OTM05 keeps the cleaner risk-adjusted and drawdown profile.

## Yearly Stability

- OTM05 2020-2025 average annual return: 65.050552%, annual-return stdev 69.21357%, positive years 83.333333%.
- OTM10 2020-2025 average annual return: 75.236643%, annual-return stdev 84.708068%, positive years 83.333333%.
- OTM03 2020-2025 average annual return: 57.414977%, annual-return stdev 53.506538%, positive years 83.333333%.

OTM10 is more return-concentrated and more cyclical. OTM03 is the defensive reference. OTM05 sits in the middle with strong returns and less fragile risk than OTM10.

## Regime Transitions

- Bull to bear drawdown: OTM05 -51.150992%, OTM10 -56.877685%, OTM03 -43.065651%, BTC -65.758362%.
- Bear to bull return: OTM05 39.234667%, OTM10 43.083001%, OTM03 43.359163%, BTC 50.654449%.

OTM03 is the most defensive transition reference and slightly leads the bear-to-bull rebound window. OTM10 carries the deepest transition drawdowns. OTM05 remains the balanced middle ground, with stronger long-run return than OTM03 and less transition risk than OTM10.

## Implementation Reality

- OTM05 estimated actions/year: 63.528593, assignment frequency 24%, synthetic option cycles 28%.
- OTM10 estimated actions/year: 56.592469, assignment frequency 10.461538%, synthetic option cycles 28%.
- OTM03 estimated actions/year: 68.257769, assignment frequency 33.230769%, synthetic option cycles 28%.

Operationally, all weekly variants require similar opening cadence. OTM05 is a practical middle ground: less BTC-like and less tail-exposed than OTM10, without giving up as much upside as OTM03.

## Final Answer

Weekly OTM05 remains the preferred BTC baseline. No robustness evidence justifies replacing it with OTM10 or OTM03. OTM10 should remain the aggressive return-maximizing variant, and OTM03 should remain the defensive/reference configuration.
