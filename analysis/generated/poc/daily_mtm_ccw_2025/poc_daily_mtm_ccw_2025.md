# Daily Approximate MTM CCW Prototype - BTC Weekly OTM10 2025

Generated: 2026-05-25T12:44:30.830Z

## Scope

- Asset/strategy/year: BTC weekly OTM10 2025.
- Source run: runs\btc_2025-01-03_2025-12-31T08-00-00Z_otm10_step1000_longbtc_dyn_entry08h00_delay60m_deribitbtcusddeliveryprice_001.
- Snapshot: 10:00 New York time (14:00 UTC during New York daylight saving time and 15:00 UTC during New York standard time).
- Purpose: one-year prototype only; no hedge framework, delta-aware hedge, greeks engine, execution-engine change, or unrelated research rerun.

## Methodology

- Valuation: approximate_CCW_value = BTC_price - option_price_proxy_usd.
- BTC proxy: Deribit public/get_tradingview_chart_data BTC-PERPETUAL 1-minute candle close at the daily 10:00 NY snapshot.
- Option proxy: Deribit public/get_tradingview_chart_data exact traded option instrument 1-minute candle close at the daily 10:00 NY snapshot.
- Option currency handling: BTC option candle close is treated as BTC-denominated option premium and converted to USD using the snapshot BTC-PERPETUAL close.
- EWMA volatility: Daily EWMA volatility over approximate CCW returns with lambda = 0.94.
- Historical VaR: Empirical 5th percentile over the previous 30 valid daily returns. Current-day return is excluded from the VaR window.

## Validation

- Runtime: 20.925s.
- Total daily rows: 357.
- Complete MTM rows: 266.
- Missing-data rows: 91 (25.490196%).
- BTC price availability: 100%.
- Option OHLC availability among exact observed-instrument rows: 100%.
- Synthetic/missing-instrument rows: 91.
- Valid daily returns: 254.
- Historical VaR rows: 318.
- Suspicious jumps with absolute daily return >= 10%: 0.

## Daily Return And Drawdown Metrics

- First/last valid date: 2025-01-03 / 2025-12-25.
- Mean daily return: -0.027616%.
- Daily volatility: 2.019728%.
- Worst/best daily return: -8.6538% / 6.4917%.
- 5th/95th percentile daily return: -3.217705% / 3.033935%.
- Max daily drawdown: -32.5377%.
- Max absolute daily return: 8.6538%.

## Assessment

- Approximate MTM viable in this prototype: yes.
- Option OHLC appears usable: yes.
- Daily return distribution usable for future research: yes.
- Runtime manageable: yes.

## Suspicious Jumps

- No absolute daily returns >= 10% were observed.

## Caveats

- This is approximate MTM, not official portfolio accounting.
- Option OHLC/trade-price proxies are imperfect and may be stale, sparse, spread-distorted, or liquidity-distorted.
- No Greeks, implied-volatility surface, delta-aware hedge, funding, slippage, margin, liquidation, or execution costs are modeled.
- Previously tested public Deribit endpoints did not provide official historical point-in-time option Greeks/marks for this use case.
- Synthetic/theoretical cycles without an exact observed option instrument cannot be valued by this exact-option OHLC prototype.
