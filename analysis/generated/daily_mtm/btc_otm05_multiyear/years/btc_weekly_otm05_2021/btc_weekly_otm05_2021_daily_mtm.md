# Daily Approximate MTM - BTC weekly OTM05 2021

Generated: 2026-06-16T19:12:43.899Z

## Scope

- Asset/strategy/year: BTC weekly OTM05 2021.
- Methodology label: approximate research MTM.
- Source run: runs\btc_2021-01-01_2021-12-31T08-00-00Z_otm05_step1000_longbtc_dyn_entry08h00_delay60m_deribitbtcusddeliveryprice_001.
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

- Runtime: 21.323s.
- Total daily rows: 364.
- Complete MTM rows: 259.
- Missing-data rows: 105 (28.846154%).
- Underlying price availability: 100%.
- Option OHLC availability among exact observed-instrument rows: 100%.
- Synthetic/missing-instrument rows: 105.
- Valid daily returns: 247.
- Historical VaR rows: 318.
- EWMA volatility rows: 356.

## Daily Risk Metrics

- First/last valid date: 2021-01-08 / 2021-12-30.
- Mean daily return: -0.007631%.
- Daily volatility: 4.258362%.
- Worst/best daily return: -18.002% / 17.5146%.
- 5th/95th percentile daily return: -8.34315% / 6.05256%.
- Max daily drawdown: -52.4468%.
- Latest/max EWMA volatility: 3.0108% / 7.7122%.
- Latest/worst historical VaR: -5.5284% / -11.7803%.

## Gaps

- Synthetic/missing instrument rows: 105.
- Missing option price rows with observed instrument: 0.
- Missing underlying price rows: 0.
| date | cycle_id | instrument_name | notes |
| --- | --- | --- | --- |
| 2021-02-05 | 6 | BTC-12FEB21-40000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2021-03-05 | 10 | BTC-12MAR21-50000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2021-04-09 | 15 | BTC-16APR21-62000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2021-05-07 | 19 | BTC-14MAY21-58000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2021-06-04 | 23 | BTC-11JUN21-38000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2021-07-09 | 28 | BTC-16JUL21-35000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2021-08-06 | 32 | BTC-13AUG21-43000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2021-09-03 | 36 | BTC-10SEP21-52000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2021-10-08 | 41 | BTC-15OCT21-58000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2021-11-05 | 45 | BTC-12NOV21-65000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2021-12-03 | 49 | BTC-10DEC21-60000-C | daily_return_not_computed_across_missing_mtm_gap |

## Caveats

- This is approximate research MTM, not official portfolio accounting.
- Option OHLC/trade-price proxies are imperfect and may be stale, sparse, spread-distorted, or liquidity-distorted.
- No Greeks, implied-volatility surface, delta-aware hedge, funding, slippage, margin, liquidation, or execution costs are modeled.
- Synthetic/theoretical cycles without an exact observed option instrument cannot be valued by this exact-option OHLC runner.
