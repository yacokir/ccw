# Backtest Concepts for CCW

This document defines the key concepts used by the CCW backtest project: Trade, Run, Config, Equity Curve, Summary, and the distinction between BTC exposure pricing and option settlement pricing.

## Pricing Sources

The CCW backtest uses two separate BTC price concepts:

- `underlyingPriceSource`: price source for BTC exposure entry and exit. In the current MVP this defaults to `BTC-PERPETUAL`, which is a temporary proxy for holding BTC through the weekly cycle.
- `optionSettlementPriceSource`: price source for option expiration payoff. In the current MVP this defaults to Deribit `btc_usd` index chart data normalized into a candle-like proxy until official Deribit delivery price / 30-min TWAP support is implemented.

The separation is important for reproducibility. BTC PnL should come from the market used to represent BTC exposure, while option payoff should come from the settlement/index source used by the option contract. The difference between these two prices is basis risk and should not be hidden by reusing one price for both legs.

## Trade

A `Trade` represents one weekly cycle of a position under the strategy. Every trade covers a single week from entry to exit and captures both option and underlying exposure. A `Trade` represents a self-contained capital transition from `capital_before` to `capital_after`. Each trade also includes dynamic position sizing based on current capital, so capital evolves over time and affects position size.

### Option entry price sources

Observed option candles are the preferred source for `C_entry`. If the entry candle is missing, the planned MVP fallback is theoretical pricing: Black-76 for call value, with volatility estimated using Garman-Klass realized volatility from `BTC-PERPETUAL` OHLC.

For the current weekly CCW strategy horizon, the planned MVP volatility input is hourly `BTC-PERPETUAL` OHLC candles over a 14-day lookback window, annualized with `24 * 365` periods. The lookback window is intentionally backward-looking only: it must end before or at the option entry timestamp and must not include future candles.

The theoretical fallback is intended to reduce missing-data bias in research runs. It should not be interpreted as an observed or executable market quote. Interest rates and BTC yield are ignored for MVP unless later evidence shows they materially affect results.

This volatility assumption is horizon-specific. Longer-dated strategies may require different lookback windows, sampling frequency, and calibration against observed option prices.

Any trade using theoretical pricing must be explicitly marked in the trade output. Observed and theoretical option prices must be distinguishable in every run artifact.

### Option premium currency

Historical Deribit option premium candles are currently treated as BTC-denominated prices. The current backtester expects `C_entry` in BTC terms, so premium value in USD is computed as `C_entry * S_entry`.

Black-76 theoretical prices are USD-denominated in this project because `forwardPrice`, `strike`, and payoff are modeled in USD. When theoretical entry pricing is integrated, the conversion should happen outside the Black-76 model:

`theoreticalPremiumBtc = theoreticalPremiumUsd / S_entry`

The Black-76 module should remain a pure pricing model. The pricing/backtest integration layer is responsible for converting units and recording whether the entry premium came from an observed BTC-denominated option candle or a theoretical USD-denominated model output converted into BTC.

### Typical trade fields

- `cycle`: sequential index of the trade within the run
- `entry_date`: date when the trade is opened
- `exit_date`: date when the trade is closed
- `expiry`: option expiry date for the trade
- `has_call`: boolean flag indicating whether the trade includes a call option
- `option_instrument`: option identifier (e.g. `BTC-10OCT25-126000-C`)
- `underlying`: legacy field for the BTC exposure price source
- `underlying_price_source`: price source used for BTC exposure entry/exit
- `option_settlement_price_source`: configured price source used for option payoff
- `option_settlement_price_source_resolved`: actual source resolved by the implementation
- `option_settlement_price_is_proxy`: boolean flag indicating whether the settlement price is a proxy rather than official delivery/TWAP
- `option_settlement_price_note`: diagnostic note for proxy/fallback behavior
- `strike`: option strike price
- `S_entry`: BTC exposure price at trade entry
- `S_exit`: BTC exposure price at trade exit
- `S_settlement`: settlement/index price used to compute option payoff
- `C_entry`: legacy option premium field, currently expected in BTC terms
- `C_entry_btc`: option entry premium in BTC terms
- `C_entry_usd`: option entry premium value in USD terms
- `C_entry_source`: source of the option entry price, for example `observed_ohlc_open` or `theoretical_black76`
- `option_entry_price_currency`: source currency of the option entry price before any conversion, for example `BTC` or `USD`
- `option_entry_price_source`: explicit source label for the option entry price
- `C_entry_is_theoretical`: boolean flag indicating whether `C_entry` came from theoretical fallback
- `C_entry_model`: theoretical pricing model used when applicable, for example `black76`
- `C_entry_vol_model`: volatility estimator used when applicable, for example `garman_klass`
- `payoff`: cash payoff of the option leg at expiry, based on `S_settlement`
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
- `payoff` should be derived from `S_settlement`, not `S_exit`. `S_exit` belongs to BTC exposure PnL; `S_settlement` belongs to option intrinsic value.
- If official Deribit delivery price / 30-min TWAP is unavailable, the run should clearly identify the settlement proxy used.
- If the settlement proxy is unavailable and the implementation falls back to the BTC exposure exit price, that fallback must be explicit in trade output.
- If `C_entry` comes from theoretical fallback, that fact must be explicit in trade output; theoretical prices must not be silently combined with observed option candles.
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

### Date range semantics

`startDate` determines the first eligible Friday entry. `endDate` is the maximum allowed exit timestamp, not the last allowed entry date. A weekly cycle is included only after its exit datetime is computed and confirmed to be `<= endDate`.

If `endDate` is provided as a date-only string such as `2025-12-26`, it is interpreted at the current/default cycle exit time, currently `2025-12-26T08:00:00Z`. If `endDate` includes an explicit timestamp, that timestamp is preserved exactly; for example, `2025-12-26T00:00:00Z` remains midnight UTC.

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
- BTC exposure price source
- option settlement price source
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
