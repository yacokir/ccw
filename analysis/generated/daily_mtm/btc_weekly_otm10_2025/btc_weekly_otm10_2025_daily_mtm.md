# Daily Approximate MTM - BTC weekly OTM10 2025

Generated: 2026-06-16T17:36:39.376Z

## Scope

- Asset/strategy/year: BTC weekly OTM10 2025.
- Methodology label: approximate research MTM.
- Source run: runs\btc_2025-01-03_2025-12-31T08-00-00Z_otm10_step1000_longbtc_dyn_entry08h00_delay60m_deribitbtcusddeliveryprice_001.
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

- Runtime: 21.271s.
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

- First/last valid date: 2025-01-03 / 2025-12-25.
- Mean daily return: -0.027616%.
- Daily volatility: 2.019728%.
- Worst/best daily return: -8.6538% / 6.4917%.
- 5th/95th percentile daily return: -3.217705% / 3.033935%.
- Max daily drawdown: -32.5377%.
- Latest/max EWMA volatility: 2.0697% / 2.8344%.
- Latest/worst historical VaR: -3.4712% / -5.7658%.

## Gaps

- Synthetic/missing instrument rows: 91.
- Missing option price rows with observed instrument: 0.
- Missing underlying price rows: 0.
| date | cycle_id | instrument_name | notes |
| --- | --- | --- | --- |
| 2025-02-07 | 6 | BTC-14FEB25-106000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2025-03-07 | 10 | BTC-14MAR25-97000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2025-04-04 | 14 | BTC-11APR25-92000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2025-05-09 | 19 | BTC-16MAY25-115000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2025-06-06 | 23 | BTC-13JUN25-114000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2025-07-04 | 27 | BTC-11JUL25-120000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2025-08-08 | 32 | BTC-15AUG25-129000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2025-09-05 | 36 | BTC-12SEP25-124000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2025-10-03 | 40 | BTC-10OCT25-130000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2025-11-07 | 45 | BTC-14NOV25-112000-C | daily_return_not_computed_across_missing_mtm_gap |
| 2025-12-05 | 49 | BTC-12DEC25-100000-C | daily_return_not_computed_across_missing_mtm_gap |

## Caveats

- This is approximate research MTM, not official portfolio accounting.
- Option OHLC/trade-price proxies are imperfect and may be stale, sparse, spread-distorted, or liquidity-distorted.
- No Greeks, implied-volatility surface, delta-aware hedge, funding, slippage, margin, liquidation, or execution costs are modeled.
- Synthetic/theoretical cycles without an exact observed option instrument cannot be valued by this exact-option OHLC runner.
