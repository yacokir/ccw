# Baseline Registry

This registry records frozen CCW research baselines. A frozen baseline is a reproducible strategy definition: it captures the objective, data assumptions, execution timing, pricing model, fallback behavior, and known limitations at a point in the project.

## Baseline-v1-weekly-income

Status: frozen

### Objective

`Baseline-v1-weekly-income` models a weekly BTC covered-call strategy primarily as an income/yield-enhancement strategy.

The intent is closer to covered-call or dividend-style income investing than to pure BTC directional outperformance. BTC return is important context, but it is not the sole benchmark or the only measure of success. The strategy is meant to study whether systematic option premium collection can improve the income profile of BTC exposure, with future work potentially targeting more stable USD-denominated income streams.

### Current Assumptions

- Strategy: BTC covered call.
- Cycle frequency: weekly.
- Entry: Friday 08:00 UTC.
- Exit: Friday 08:00 UTC.
- Date boundary: `endDate` is the maximum allowed exit timestamp.
- Date-only `endDate`: interpreted at the current exit time, currently 08:00 UTC.
- Default OTM selection: `xOtm = 0.05`.
- Default strike grid: generated around target strike using current `strikeStep` and `strikeRange`.
- Default fallback when no call can be priced: remain long BTC for that week.

### Pricing Sources

- BTC exposure proxy: `BTC-PERPETUAL`.
- BTC exposure entry price: `S_entry` from `BTC-PERPETUAL`.
- BTC exposure exit price: `S_exit` from `BTC-PERPETUAL`.
- Observed option premiums: Deribit option OHLC, currently interpreted as BTC-denominated premium.
- Internal premium unit: `C_entry` remains BTC-denominated.
- Premium USD value: `C_entry * S_entry`.

### Settlement Logic

- Option payoff uses a separate settlement concept: `S_settlement`.
- Intended settlement source: official Deribit delivery settlement prices.
- Delivery prices represent Deribit's official option expiration settlement/TWAP process.
- `S_settlement` should refer to the official delivery settlement price for the option expiry.
- Settlement timestamps are daily expiry settlement records, not candle timestamps.
- If official delivery data is unavailable during transition, the system may explicitly fall back to `BTC-PERPETUAL` exit price as temporary compatibility logic.
- Former approach: Deribit `btc_usd` index chart data from `public/get_index_chart_data` normalized into candle-like rows. This is deprecated/experimental because the endpoint does not support arbitrary historical timestamp lookup as needed for reliable backtesting.

### Execution Timing

- Entry cycle: Friday 08:00 UTC.
- Exit cycle: Friday 08:00 UTC, seven days after entry for normal weekly cycles.
- Option entry delay: observed option entry may use the first available option candle within `maxEntryDelayMinutes`.
- Default `maxEntryDelayMinutes`: 60.
- Run identity includes execution timing and max entry delay.

### Option Pricing Fallback Logic

Observed option pricing is always preferred.

Theoretical fallback is allowed when:

- no observed option instrument is discovered for the intended expiry/strike area;
- an observed option instrument exists but no usable option entry candle is found;
- an observed option candle exists but the open price is missing, zero, non-positive, or invalid.

Fallback model:

- Black-76 call pricing.
- `riskFreeRate = 0`.
- Dynamic `timeToExpiryYears = (exitTime - entryTime) / (365 * 24 * 60 * 60 * 1000)`.
- Black-76 output is USD-denominated.
- Theoretical USD premium is converted to BTC units:

`theoreticalPremiumBtc = theoreticalPremiumUsd / S_entry`

Synthetic theoretical entries are allowed when no observed option instrument is discovered. These entries must not pretend a real Deribit instrument existed: `option_instrument` remains null, and diagnostics must flag the entry as synthetic/theoretical.

### Volatility Model

- Realized volatility estimator: Garman-Klass.
- Input source: hourly `BTC-PERPETUAL` OHLC candles.
- Lookback: 14 days.
- Annualization: `24 * 365` periods.
- Lookback is backward-looking only and must not include candles after the option entry timestamp.
- This volatility assumption is tied to the current weekly strategy horizon.

### Current Known Limitations

- No liquidity modeling: volume, spread, slippage, and market depth are ignored.
- Manual option discovery still relies on instrument naming heuristics.
- No fallback to the next observed valid strike yet.
- Delivery-price integration may still be in transition in code, but it is the intended settlement architecture.
- Deprecated `btc_usd` index-chart proxy is not the final official option delivery methodology.
- Basis risk between `BTC-PERPETUAL` and official delivery settlement is visible but not yet analyzed as a standalone metric.
- Theoretical option entries reduce missing-data bias but are not observed executable market prices.
- Fees, custody, venue constraints, and operational frictions are not modeled.
- Current BTC exposure is proxied through `BTC-PERPETUAL`, not a realistic spot BTC ownership layer.
- Premium deployment/reinvestment is not modeled beyond current capital accounting.
- BTC yield deployment is not modeled.

### Accepted Future Refinement Layers

- Complete official Deribit delivery price / TWAP settlement integration.
- Realistic spot BTC ownership layer.
- BTC yield deployment.
- Premium reinvestment/deployment.
- Fees, custody, venue, and execution realism.
- Liquidity filters and next-valid-strike fallback.
- Basis-risk analysis between exposure price and settlement index.
- More stable USD-denominated income targets and reporting.
- Horizon-specific volatility calibration for longer-dated strategies.
