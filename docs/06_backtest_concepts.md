# Backtest Concepts for CCW

This document defines the key concepts used by the CCW backtest project: Trade, Run, Config, Equity Curve, and Summary.

## Trade

A `Trade` represents one weekly cycle of a position under the strategy. Every trade covers a single week from entry to exit and captures both option and underlying exposure. A `Trade` represents a self-contained capital transition from `capital_before` to `capital_after`. Each trade also includes dynamic position sizing based on current capital, so capital evolves over time and affects position size.

### Typical trade fields

- `cycle`: sequential index of the trade within the run
- `entry_date`: date when the trade is opened
- `exit_date`: date when the trade is closed
- `expiry`: option expiry date for the trade
- `has_call`: boolean flag indicating whether the trade includes a call option
- `option_instrument`: option identifier (e.g. `BTC-10OCT25-126000-C`)
- `underlying`: underlying asset price source used for `S`, such as `BTC-PERPETUAL` or `BTC_USD` index
- `strike`: option strike price
- `S_entry`: underlying spot price (index or perpetual) at trade entry
- `S_exit`: underlying spot price (index or perpetual) at trade exit
- `C_entry`: option premium or cost at entry
- `payoff`: cash payoff of the option leg at exit
- `pnl_call`: profit and loss from the option leg
- `pnl_underlying`: profit and loss from the underlying position
- `pnl_total`: total profit and loss for the trade (`pnl_call + pnl_underlying`)
- `capital_before`: portfolio value at the start of the trade
- `capital_after`: portfolio value at the end of the trade
- `btc_position`: amount of BTC held at entry after position sizing
- `return_pct`: trade return as a percentage, defined as `pnl_total / capital_before`
- `weekly_vol`: standard deviation of log returns of the underlying between `entry_date` and `exit_date`, using a fixed resolution such as hourly candles
- `fallback_mode`: describes behavior when no option is available (for example, `long_btc`)

### Notes

- A single `Trade` should represent one complete weekly execution cycle.
- `payoff` is generally derived from the option settlement or mark-to-market at `exit_date`.
- `return_pct` is calculated relative to `capital_before` and reflects trade-level performance normalized to starting capital.
- Position sizing is dynamic: the trade size is determined from current capital, and capital evolves over time as each trade closes.

## Run

A `Run` is one complete backtest execution using a fixed set of parameters. A run includes:

- `config`: the fixed backtest settings used for the execution
- `trades`: the list of weekly trade results produced by the backtest
- `equity curve`: the cumulative portfolio performance over time
- `summary`: aggregate metrics describing the run outcome

### Run lifecycle

1. Define the `config` parameters
2. Generate weekly `trades` from the rules and data
3. Compute the `equity curve` from trade outcomes
4. Produce a `summary` with aggregated performance statistics

## Suggested run output structure

A practical output layout for a single run is:

```
runs/
  <run_name>/
    config.json
    trades.csv
    equity_curve.csv
    summary.json
```

### File responsibilities

- `config.json`: stores the run parameters and strategy settings
- `trades.csv`: stores the row-level weekly trade data
- `equity_curve.csv`: stores the time series of cumulative capital or portfolio value
- `summary.json`: stores aggregated statistics and diagnostics for the run

## Run name conventions

`run_name` should be descriptive and include the key parameters that define the execution. A good run name should typically include:

- asset
- start date
- end date
- OTM percentage
- fallback mode
- sizing mode
- sequential suffix when needed to distinguish multiple runs with the same main parameters

### Example run name patterns

- `btc_2023-01-01_2024-01-01_10pct_otm_fallbackA_sizeVOL_01`
- `eth_2024-04-01_2024-10-01_15pct_otm_fallbackB_sizeFIX`

## Practical guidance

- Keep each run folder self-contained so results can be replayed and compared easily.
- Use `trades.csv` for detailed per-week analysis and `equity_curve.csv` for portfolio-level trend review.
- Keep `summary.json` lightweight and focused on overall performance metrics.
- If multiple runs use the same core config but different seeds, sizing, or fallback behavior, add a sequential suffix to keep names unique.

## Summary

In this project, a `Trade` is one weekly execution cycle, and a `Run` is one full backtest execution. The run should always include a fixed `config`, a detailed set of `trades`, an `equity curve`, and a compact `summary`. The output layout should be organized under `runs/<run_name>/`, with `run_name` encoding the key backtest parameters.
