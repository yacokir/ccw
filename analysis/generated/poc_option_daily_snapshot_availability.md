# Option Daily Snapshot Availability POC

Generated: 2026-05-24T21:26:17.965Z

## Scope

- Asset: BTC
- Tenor/moneyness/year: weekly OTM10 2025
- Source run: runs\btc_2025-01-03_2025-12-31T08-00-00Z_otm10_step1000_longbtc_dyn_entry08h00_delay60m_deribitbtcusddeliveryprice_001
- Snapshot times: 08:00, 14:00, 16:00 UTC
- Purpose: data-availability validation only; no MTM framework, hedge logic, or backtest rerun.

## Results

- Observed option trades tested: 38
- Total snapshot attempts: 798
- Successful historical mark snapshots: 0 (0%)
- Greek completeness: 0 (0%)
- Underlying price availability: 100%
- Option trade OHLC availability: 100%
- Recent trade endpoint availability: 0%
- Best timestamp by mark availability: 08:00 UTC (0%)
- Marks without recent trade in trailing 24h: 0 (0% of marks)

## Mark History Failure Reasons

| reason | count | pct_of_requests |
| --- | --- | --- |
| instrument_is_not_active | 798 | 100 |

## Timestamp Comparison

| quality_rank | snapshot_time_utc | total_requests | successful_snapshots | availability_pct | underlying_price_availability_pct | greek_completeness_pct | recent_trade_availability_pct | marks_without_recent_trade_24h |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 08:00 | 266 | 0 | 0 | 100 | 0 | 0 | 0 |
| 2 | 14:00 | 266 | 0 | 0 | 100 | 0 | 0 | 0 |
| 3 | 16:00 | 266 | 0 | 0 | 100 | 0 | 0 | 0 |

## Missing Rate By Field

| field | found_count | missing_count | found_pct | missing_pct |
| --- | --- | --- | --- | --- |
| mark_price | 0 | 798 | 0 | 100 |
| mark_iv | 0 | 798 | 0 | 100 |
| delta | 0 | 798 | 0 | 100 |
| gamma | 0 | 798 | 0 | 100 |
| theta | 0 | 798 | 0 | 100 |
| vega | 0 | 798 | 0 | 100 |
| underlying_price | 798 | 0 | 100 | 0 |

## Interpretation

- Exact option snapshots retrievable: no successful historical mark snapshots were retrieved.
- Official historical marks usable for full daily MTM: not proven by this slice; coverage is below the 90% practical threshold used by this POC.
- Official historical Greeks usable for daily MTM: no. Deribit public historical mark history does not include mark IV or Greeks, and public/ticker is current/live rather than historical point-in-time.
- Trade OHLC can be retrieved for these exact expired options, but this POC does not treat trade OHLC as a mark-price substitute because it lacks mark IV, Greeks, timestamped theoretical valuation, and quote/mark semantics.
- Major retention/API gap: public/get_mark_price_history rejected every tested expired exact instrument as inactive, so the official mark endpoint did not support this 2025 reconstruction slice.
- External provider need: High for historical IV/Greeks and broad option-chain snapshots. Providers such as Tardis or other Deribit historical options vendors would likely solve this if they store full ticker/order-book snapshots with mark_iv, greeks, underlying/index price, and timestamps.

## Limitations

- Deribit public/get_mark_price_history returns mark price only and only for a subset of options used in volatility index calculations.
- Deribit public/ticker exposes mark_iv and greeks for current/live instruments, but no official public historical point-in-time IV/Greek snapshot endpoint was found.
- This POC does not reconstruct Greeks from Black-Scholes; it tests whether official historical point-in-time values are directly obtainable.
- The run has synthetic fallback cycles with no observed option_instrument; those are excluded because there is no exact traded option to query.
- If Deribit returns empty mark history for an instrument, this script records that as unavailable rather than substituting trade OHLC as a mark.

## Deribit API References

- https://docs.deribit.com/api-reference/market-data/public-get_mark_price_history
- https://docs.deribit.com/api-reference/market-data/public-ticker
