# BTC Risk Findings

Generated from existing backtest `trades.csv` files only. No new market data, assets, tenors, or strategies were introduced.

## Method

- Returns are reconstructed from per-cycle `return_pct` in each run `trades.csv`.
- BTC benchmark returns use the same cycle entry/exit prices as each strategy row.
- Drawdowns and underwater periods are measured on reconstructed cycle-end equity.
- Weekly VaR and Expected Shortfall use the historical 5th percentile and average of observations at or below that percentile. Monthly VaR compounds non-overlapping 4-week blocks for weekly series and 2-cycle blocks for 14d.
- Rolling risk uses 52 cycles for weekly/BTC and 26 cycles for 14d, matching the existing project convention for one-year windows.

## OTM05 vs OTM10

- Weekly OTM10 total return: 1109.021386% vs Weekly OTM05 1063.935479% (45.085907 percentage points higher).
- Weekly OTM10 max drawdown: -58.703496% vs Weekly OTM05 -51.150992% (7.552504 points deeper).
- Weekly OTM10 annualized volatility: 52.122613% vs Weekly OTM05 45.735715% (6.386898 points higher).
- Weekly OTM10 annualized Sharpe proxy: 1.045427 vs Weekly OTM05 1.112185.
- Weekly OTM10 95% weekly VaR/ES loss: 10.107217% / 17.407759% vs OTM05 9.307449% / 16.735581%.
- Weekly OTM10 spent 82.461538% of cycles underwater vs OTM05 80.923077%.

## Exposure

- Weekly OTM10 beta/correlation vs BTC: 0.804334 / 0.946346.
- Weekly OTM05 beta/correlation vs BTC: 0.663375 / 0.889494.
- OTM10 upside/downside capture: 91.185854% / 87.947969%.
- OTM05 upside/downside capture: 79.301114% / 73.78487%.

The strategies do not materially remove BTC exposure; they mostly reshape it. Both retain high BTC correlation and beta, while the short-call overlay trades upside participation for premium income and some downside cushioning.

## Benchmarks

- Weekly OTM03: 993.852091% total return, -43.065651% max drawdown, Sharpe 1.147626.
- 14d OTM10: 903.671998% total return on its 14d grid, -45.877646% max drawdown, Sharpe 1.073955.
- BTC Buy & Hold weekly benchmark: 847.483816% total return, -71.178211% max drawdown, Sharpe 0.899854.

## Recommendation

Prefer Weekly OTM05 as the risk-analysis baseline. Weekly OTM10 delivers more total return, but the additional return comes with deeper drawdowns, higher volatility, worse tail loss, and more time underwater. OTM10 remains attractive when maximizing long-run upside is the primary objective, but OTM05 is the better balanced candidate for continued research because its risk-adjusted profile is cleaner while still preserving strong outperformance.
