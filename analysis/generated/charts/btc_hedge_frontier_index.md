# BTC Hedge Frontier Visualization Index

Generated static PNG charts for Hedge Frontier Research Phase 1.

## Charts

### Hedge Return Vs Drawdown

- File: [btc_hedge_return_vs_drawdown.png](./btc_hedge_return_vs_drawdown.png)
- Represents: CAGR versus maximum end-of-cycle drawdown for weekly and 14d OTM10 hedge variants.
- Interpretation: Useful for seeing the hedge frontier shape; upper-right is better return with shallower drawdown.

### CAGR By Hedge Ratio

- File: [btc_hedge_cagr_by_ratio.png](./btc_hedge_cagr_by_ratio.png)
- Represents: CAGR by tenor and fixed hedge ratio.
- Interpretation: Shows how much upside is given up as hedge ratio increases.

### Max Drawdown By Hedge Ratio

- File: [btc_hedge_max_drawdown_by_ratio.png](./btc_hedge_max_drawdown_by_ratio.png)
- Represents: Maximum drawdown magnitude by tenor and fixed hedge ratio.
- Interpretation: Lower bars are better; larger hedges should mechanically reduce long-delta drawdown pressure.

### Ulcer Index By Hedge Ratio

- File: [btc_hedge_ulcer_by_ratio.png](./btc_hedge_ulcer_by_ratio.png)
- Represents: Ulcer index by tenor and fixed hedge ratio.
- Interpretation: Lower bars indicate lower average squared drawdown pressure in the end-of-cycle path.

### Rolling Drawdown By Hedge Ratio

- File: [btc_hedge_rolling_drawdown.png](./btc_hedge_rolling_drawdown.png)
- Represents: One-year rolling drawdown for h00, h20, and h40 overlays.
- Interpretation: Shows whether hedge variants reduce rolling drawdown pressure consistently through time.

### Bear Regime Drawdown Heatmap

- File: [btc_hedge_regime_heatmap.png](./btc_hedge_regime_heatmap.png)
- Represents: 2022 bear-regime drawdown by tenor and hedge ratio.
- Interpretation: Greener cells indicate shallower drawdown in the fixed 2022 regime window.

## Caveats

- Charts read generated hedge Phase 1 outputs only; no baseline backtests are rerun.
- Funding, basis, liquidation risk, margin mechanics, and intracycle hedge rebalance are ignored.
- Drawdown uses end-of-cycle reconstructed equity and may understate intracycle stress.
- Hedge ratios are fixed always-on short BTC perpetual proxies.
