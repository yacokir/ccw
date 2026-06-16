# ETH Regime Analysis

Generated: 2026-06-16T08:44:29.7360127Z

## Methodology

- Regimes are fixed calendar segments: Bull 2020-2021, Bear 2022, Recovery/transition 2023, ETF/bull 2024-2025.
- Cycles are assigned by `entry_date` from `trades.csv`.
- Return is compounded from realized cycle returns inside each regime.
- Volatility is sample standard deviation of cycle return percentages.
- Drawdown is the worst end-of-cycle peak-to-trough drawdown inside the regime.
- Hit rate is the percentage of cycles with positive return.

## Regime Leaders

- Bull: weekly otm05 (1670.679012% return).
- Bear: weekly otm03 (-37.841647% return).
- Recovery/transition: weekly otm05 (48.506666% return).
- ETF/bull regime: weekly otm03 (28.165654% return).
