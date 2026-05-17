# BTC Regime Analysis

Generated: 2026-05-17T16:35:56.084Z

## Methodology

- Regimes are fixed calendar segments: Bull 2020-2021, Bear 2022, Recovery/transition 2023, ETF/bull 2024-2025.
- Cycles are assigned by `entry_date` from `trades.csv`.
- Return is compounded from realized cycle returns inside each regime.
- Volatility is sample standard deviation of cycle return percentages.
- Drawdown is the worst end-of-cycle peak-to-trough drawdown inside the regime.
- Hit rate is the percentage of cycles with positive return.

## Regime Leaders

- Bull: weekly otm10 (450.655861% return).
- Bear: weekly itm05 (10.702935% return).
- Recovery/transition: 14d otm10 (105.336397% return).
- ETF/bull regime: weekly otm10 (116.249245% return).
