# Daily Approximate MTM - BTC weekly OTM05 2022

Generated: 2026-06-16T19:13:17.130Z

## Scope

- Asset/strategy/year: BTC weekly OTM05 2022.
- Methodology label: approximate research MTM.
- Source run: runs\btc_2022-01-07_2022-12-31T08-00-00Z_otm05_step1000_longbtc_dyn_entry08h00_delay60m_deribitbtcusddeliveryprice_001.
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

- Runtime: 20.705s.
- Total daily rows: 357.
- Complete MTM rows: 252.
- Missing-data rows: 105 (29.411765%).
- Underlying price availability: 100%.
- Option OHLC availability among exact observed-instrument rows: 100%.
- Synthetic/missing-instrument rows: 105.
- Valid daily returns: 240.
- Historical VaR rows: 318.
- EWMA volatility rows: 356.

## Daily Risk Metrics

- First/last valid date: 2022-01-07 / 2022-12-29.
- Mean daily return: -0.396888%.
- Daily volatility: 3.091514%.
- Worst/best daily return: -13.3229% / 8.4423%.
- 5th/95th percentile daily return: -5.05406% / 4.63974%.
- Max daily drawdown: -63.4249%.
- Latest/max EWMA volatility: 1.596% / 4.6938%.
- Latest/worst historical VaR: -2.2192% / -8.5936%.

## Gaps

- Synthetic/missing instrument rows: 105.
- Missing option price rows with observed instrument: 0.
- Missing underlying price rows: 0.
| date | cycle_id | instrument_name | notes |
| --- | --- | --- | --- |
| 2022-02-04 | 5 | BTC-11FEB22-40000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2022-03-04 | 9 | BTC-11MAR22-44000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2022-04-08 | 14 | BTC-15APR22-46000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2022-05-06 | 18 | BTC-13MAY22-38000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2022-06-03 | 22 | BTC-10JUN22-32000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2022-07-08 | 27 | BTC-15JUL22-23000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2022-08-05 | 31 | BTC-12AUG22-24000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2022-09-09 | 36 | BTC-16SEP22-22000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2022-10-07 | 40 | BTC-14OCT22-21000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2022-11-04 | 44 | BTC-11NOV22-22000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2022-12-09 | 49 | BTC-16DEC22-18000-C | daily_return_not_computed_across_missing_mtm_gap |

## Caveats

- This is approximate research MTM, not official portfolio accounting.
- Option OHLC/trade-price proxies are imperfect and may be stale, sparse, spread-distorted, or liquidity-distorted.
- No Greeks, implied-volatility surface, delta-aware hedge, funding, slippage, margin, liquidation, or execution costs are modeled.
- Synthetic/theoretical cycles without an exact observed option instrument cannot be valued by this exact-option OHLC runner.
