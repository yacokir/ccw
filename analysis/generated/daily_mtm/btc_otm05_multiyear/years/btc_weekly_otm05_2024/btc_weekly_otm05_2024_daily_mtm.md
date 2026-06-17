# Daily Approximate MTM - BTC weekly OTM05 2024

Generated: 2026-06-16T19:14:11.114Z

## Scope

- Asset/strategy/year: BTC weekly OTM05 2024.
- Methodology label: approximate research MTM.
- Source run: runs\btc_2024-01-05_2024-12-31T08-00-00Z_otm05_step1000_longbtc_dyn_entry08h00_delay60m_deribitbtcusddeliveryprice_001.
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

- Runtime: 20.599s.
- Total daily rows: 357.
- Complete MTM rows: 252.
- Missing-data rows: 105 (29.411765%).
- Underlying price availability: 100%.
- Option OHLC availability among exact observed-instrument rows: 100%.
- Synthetic/missing-instrument rows: 105.
- Valid daily returns: 240.
- Historical VaR rows: 311.
- EWMA volatility rows: 356.

## Daily Risk Metrics

- First/last valid date: 2024-01-05 / 2024-12-26.
- Mean daily return: 0.302093%.
- Daily volatility: 2.142412%.
- Worst/best daily return: -6.247% / 11.0854%.
- 5th/95th percentile daily return: -3.681145% / 3.442065%.
- Max daily drawdown: -23.4192%.
- Latest/max EWMA volatility: 2.4495% / 3.355%.
- Latest/worst historical VaR: -2.0734% / -4.9591%.

## Gaps

- Synthetic/missing instrument rows: 105.
- Missing option price rows with observed instrument: 0.
- Missing underlying price rows: 0.
| date | cycle_id | instrument_name | notes |
| --- | --- | --- | --- |
| 2024-02-09 | 6 | BTC-16FEB24-48000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2024-03-08 | 10 | BTC-15MAR24-71000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2024-04-05 | 14 | BTC-12APR24-70000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2024-05-03 | 18 | BTC-10MAY24-62000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2024-06-07 | 23 | BTC-14JUN24-75000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2024-07-05 | 27 | BTC-12JUL24-57000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2024-08-09 | 32 | BTC-16AUG24-64000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2024-09-06 | 36 | BTC-13SEP24-59000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2024-10-04 | 40 | BTC-11OCT24-64000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2024-11-08 | 45 | BTC-15NOV24-80000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2024-12-06 | 49 | BTC-13DEC24-103000-C | daily_return_not_computed_across_missing_mtm_gap |

## Caveats

- This is approximate research MTM, not official portfolio accounting.
- Option OHLC/trade-price proxies are imperfect and may be stale, sparse, spread-distorted, or liquidity-distorted.
- No Greeks, implied-volatility surface, delta-aware hedge, funding, slippage, margin, liquidation, or execution costs are modeled.
- Synthetic/theoretical cycles without an exact observed option instrument cannot be valued by this exact-option OHLC runner.
