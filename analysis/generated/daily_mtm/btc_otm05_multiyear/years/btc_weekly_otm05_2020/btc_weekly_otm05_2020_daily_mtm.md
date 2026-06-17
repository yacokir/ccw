# Daily Approximate MTM - BTC weekly OTM05 2020

Generated: 2026-06-16T19:12:09.866Z

## Scope

- Asset/strategy/year: BTC weekly OTM05 2020.
- Methodology label: approximate research MTM.
- Source run: runs\btc_2020-01-03_2020-12-31T08-00-00Z_otm05_step1000_longbtc_dyn_entry08h00_delay60m_deribitbtcusddeliveryprice_001.
- Underlying proxy: BTC-PERPETUAL.
- Snapshot: 10:00 New York time.

## Methodology

- Valuation: approximate_CCW_value = underlying_price - option_price_proxy_usd.
- Underlying proxy: Deribit public/get_tradingview_chart_data BTC-PERPETUAL 1-minute candle close at the daily 10:00 NY snapshot.
- Option proxy: Deribit public/get_tradingview_chart_data exact traded option instrument 1-minute candle close at the daily 10:00 NY snapshot.
- Option currency handling: Option candle close is treated as BTC-denominated option premium and converted to USD using the snapshot BTC-PERPETUAL close.
- Daily returns: Computed only from adjacent calendar-day valid approximate_CCW_value observations; missing MTM gaps are not bridged into a single daily return.
- EWMA volatility: Daily EWMA volatility over approximate CCW returns with lambda = 0.94.
- Historical VaR: Empirical 5th percentile over the previous 30 valid daily returns. Current-day return is excluded from the VaR window.

## Validation

- Runtime: 21.932s.
- Total daily rows: 357.
- Complete MTM rows: 266.
- Missing-data rows: 91 (25.490196%).
- Underlying price availability: 100%.
- Option OHLC availability among exact observed-instrument rows: 100%.
- Synthetic/missing-instrument rows: 91.
- Valid daily returns: 254.
- Historical VaR rows: 318.
- EWMA volatility rows: 356.

## Daily Risk Metrics

- First/last valid date: 2020-01-03 / 2020-12-24.
- Mean daily return: 0.21707%.
- Daily volatility: 3.044786%.
- Worst/best daily return: -24.3296% / 13.4136%.
- 5th/95th percentile daily return: -2.834675% / 3.73862%.
- Max daily drawdown: -54.0365%.
- Latest/max EWMA volatility: 3.5007% / 7.0095%.
- Latest/worst historical VaR: -1.7832% / -9.9992%.

## Gaps

- Synthetic/missing instrument rows: 91.
- Missing option price rows with observed instrument: 0.
- Missing underlying price rows: 0.
| date | cycle_id | instrument_name | notes |
| --- | --- | --- | --- |
| 2020-02-07 | 6 | BTC-14FEB20-10000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2020-03-06 | 10 | BTC-13MAR20-10000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2020-04-03 | 14 | BTC-10APR20-7000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2020-05-08 | 19 | BTC-15MAY20-10000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2020-06-05 | 23 | BTC-12JUN20-10000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2020-07-03 | 27 | BTC-10JUL20-10000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2020-08-07 | 32 | BTC-14AUG20-12000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2020-09-04 | 36 | BTC-11SEP20-11000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2020-10-09 | 41 | BTC-16OCT20-11000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2020-11-06 | 45 | BTC-13NOV20-17000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2020-12-04 | 49 | BTC-11DEC20-20000-C | daily_return_not_computed_across_missing_mtm_gap |

## Caveats

- This is approximate research MTM, not official portfolio accounting.
- Option OHLC/trade-price proxies are imperfect and may be stale, sparse, spread-distorted, or liquidity-distorted.
- No Greeks, implied-volatility surface, delta-aware hedge, funding, slippage, margin, liquidation, or execution costs are modeled.
- Synthetic/theoretical cycles without an exact observed option instrument cannot be valued by this exact-option OHLC runner.
