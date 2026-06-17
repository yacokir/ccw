# Daily Approximate MTM - ETH weekly OTM03 2025

Generated: 2026-06-16T18:19:28.746Z

## Scope

- Asset/strategy/year: ETH weekly OTM03 2025.
- Methodology label: approximate research MTM.
- Source run: runs\eth_2025-01-03_2025-12-31T08-00-00Z_x03_step50_longbtc_dyn_entry08h00_delay60m_deribitethusddeliveryprice_001.
- Underlying proxy: ETH-PERPETUAL.
- Snapshot: 10:00 New York time.

## Methodology

- Valuation: approximate_CCW_value = underlying_price - option_price_proxy_usd.
- Underlying proxy: Deribit public/get_tradingview_chart_data ETH-PERPETUAL 1-minute candle close at the daily 10:00 NY snapshot.
- Option proxy: Deribit public/get_tradingview_chart_data exact traded option instrument 1-minute candle close at the daily 10:00 NY snapshot.
- Option currency handling: Option candle close is treated as ETH-denominated option premium and converted to USD using the snapshot ETH-PERPETUAL close.
- Daily returns: Computed only from adjacent calendar-day valid approximate_CCW_value observations; missing MTM gaps are not bridged into a single daily return.
- EWMA volatility: Daily EWMA volatility over approximate CCW returns with lambda = 0.94.
- Historical VaR: Empirical 5th percentile over the previous 30 valid daily returns. Current-day return is excluded from the VaR window.

## Validation

- Runtime: 21.21s.
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
- Mean daily return: -0.005296%.
- Daily volatility: 3.016367%.
- Worst/best daily return: -11.8014% / 13.1621%.
- 5th/95th percentile daily return: -4.74122% / 3.73039%.
- Max daily drawdown: -57.7178%.
- Latest/max EWMA volatility: 2.3889% / 4.5859%.
- Latest/worst historical VaR: -2.8317% / -8.8292%.

## Gaps

- Synthetic/missing instrument rows: 91.
- Missing option price rows with observed instrument: 0.
- Missing underlying price rows: 0.
| date | cycle_id | instrument_name | notes |
| --- | --- | --- | --- |
| 2025-02-07 | 6 | ETH-14FEB25-2800-C | daily_return_not_computed_across_missing_mtm_gap |
| 2025-03-07 | 10 | ETH-14MAR25-2250-C | daily_return_not_computed_across_missing_mtm_gap |
| 2025-04-04 | 14 | ETH-11APR25-1850-C | daily_return_not_computed_across_missing_mtm_gap |
| 2025-05-09 | 19 | ETH-16MAY25-2450-C | daily_return_not_computed_across_missing_mtm_gap |
| 2025-06-06 | 23 | ETH-13JUN25-2550-C | daily_return_not_computed_across_missing_mtm_gap |
| 2025-07-04 | 27 | ETH-11JUL25-2600-C | daily_return_not_computed_across_missing_mtm_gap |
| 2025-08-08 | 32 | ETH-15AUG25-4050-C | daily_return_not_computed_across_missing_mtm_gap |
| 2025-09-05 | 36 | ETH-12SEP25-4550-C | daily_return_not_computed_across_missing_mtm_gap |
| 2025-10-03 | 40 | ETH-10OCT25-4600-C | daily_return_not_computed_across_missing_mtm_gap |
| 2025-11-07 | 45 | ETH-14NOV25-3450-C | daily_return_not_computed_across_missing_mtm_gap |
| 2025-12-05 | 49 | ETH-12DEC25-3250-C | daily_return_not_computed_across_missing_mtm_gap |

## Caveats

- This is approximate research MTM, not official portfolio accounting.
- Option OHLC/trade-price proxies are imperfect and may be stale, sparse, spread-distorted, or liquidity-distorted.
- No Greeks, implied-volatility surface, delta-aware hedge, funding, slippage, margin, liquidation, or execution costs are modeled.
- Synthetic/theoretical cycles without an exact observed option instrument cannot be valued by this exact-option OHLC runner.
