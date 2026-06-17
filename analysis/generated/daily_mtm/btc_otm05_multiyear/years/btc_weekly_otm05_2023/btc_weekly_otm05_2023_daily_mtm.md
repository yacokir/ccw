# Daily Approximate MTM - BTC weekly OTM05 2023

Generated: 2026-06-16T19:13:45.673Z

## Scope

- Asset/strategy/year: BTC weekly OTM05 2023.
- Methodology label: approximate research MTM.
- Source run: runs\btc_2023-01-06_2023-12-31T08-00-00Z_otm05_step1000_longbtc_dyn_entry08h00_delay60m_deribitbtcusddeliveryprice_001.
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

- Runtime: 20.876s.
- Total daily rows: 357.
- Complete MTM rows: 259.
- Missing-data rows: 98 (27.45098%).
- Underlying price availability: 100%.
- Option OHLC availability among exact observed-instrument rows: 100%.
- Synthetic/missing-instrument rows: 98.
- Valid daily returns: 247.
- Historical VaR rows: 318.
- EWMA volatility rows: 356.

## Daily Risk Metrics

- First/last valid date: 2023-01-06 / 2023-12-28.
- Mean daily return: 0.326958%.
- Daily volatility: 2.366134%.
- Worst/best daily return: -8.9483% / 20.1372%.
- 5th/95th percentile daily return: -2.76243% / 3.39684%.
- Max daily drawdown: -18.9027%.
- Latest/max EWMA volatility: 1.458% / 5.7204%.
- Latest/worst historical VaR: -2.4204% / -4.2331%.

## Gaps

- Synthetic/missing instrument rows: 98.
- Missing option price rows with observed instrument: 0.
- Missing underlying price rows: 0.
| date | cycle_id | instrument_name | notes |
| --- | --- | --- | --- |
| 2023-02-03 | 5 | BTC-10FEB23-25000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2023-03-03 | 9 | BTC-10MAR23-23000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2023-04-07 | 14 | BTC-14APR23-29000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2023-05-05 | 18 | BTC-12MAY23-31000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2023-06-09 | 23 | BTC-16JUN23-28000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2023-07-07 | 27 | BTC-14JUL23-32000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2023-08-04 | 31 | BTC-11AUG23-31000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2023-09-08 | 36 | BTC-15SEP23-28000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2023-10-06 | 40 | BTC-13OCT23-29000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2023-11-03 | 44 | BTC-10NOV23-36000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2023-12-08 | 49 | BTC-15DEC23-45000-C | daily_return_not_computed_across_missing_mtm_gap |

## Caveats

- This is approximate research MTM, not official portfolio accounting.
- Option OHLC/trade-price proxies are imperfect and may be stale, sparse, spread-distorted, or liquidity-distorted.
- No Greeks, implied-volatility surface, delta-aware hedge, funding, slippage, margin, liquidation, or execution costs are modeled.
- Synthetic/theoretical cycles without an exact observed option instrument cannot be valued by this exact-option OHLC runner.
