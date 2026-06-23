# Live Position Timeline

- Generated at: 2026-06-22T18:16:13.456Z.
- Source: archived live snapshots and position artifacts only.
- Status: read-only accounting view; no orders placed.

## Summary

- Number of archived days: 4.
- First snapshot date: 2026-06-18.
- Latest snapshot date: 2026-06-22.
- Spreadsheet view: live/LIVE_POSITION_TIMELINE.csv.
- BTC regime history: 2026-06-18: stress; 2026-06-19: watch; 2026-06-21: watch; 2026-06-22: watch.
- ETH regime history: 2026-06-18: stress; 2026-06-19: stress; 2026-06-21: stress; 2026-06-22: stress.
- Hedge target changes: 2026-06-19 BTC: 30% -> 0%.
- No stale/fallback days detected.

## Daily Overview

| Date | Asset | Price | Regime | Target | Current | Exec | DTE | Option PnL | Net PnL |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-18 | BTC | 62,992.20 | stress | 30% | 0% | HEDGE_30 | 8 | N/A | N/A |
| 2026-06-18 | ETH | 1,712.00 | stress | 30% | 0% | HEDGE_30 | 8 | N/A | N/A |
| 2026-06-19 | BTC | 62,840.80 | watch | 0% | 0% | NO_HEDGE | 7 | N/A | N/A |
| 2026-06-19 | ETH | 1,694.94 | stress | 30% | 0% | HEDGE_30 | 7 | N/A | N/A |
| 2026-06-21 | BTC | 63,971.50 | watch | 0% | 0% | NO_HEDGE | 5 | -77.66 | N/A |
| 2026-06-21 | ETH | 1,722.31 | stress | 30% | 30% | HEDGE_30 | 5 | -132.92 | N/A |
| 2026-06-22 | BTC | 64,629.40 | watch | 0% | 0% | NO_HEDGE | 4 | -146.86 | N/A |
| 2026-06-22 | ETH | 1,744.96 | stress | 30% | 30% | HEDGE_30 | 4 | -103.23 | N/A |

## By Asset

### BTC

| Date | Price | Regime | Target | Current | Action | Exec | DTE | Strike | Option PnL | Net PnL | Warnings |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-18 | 62,992.20 | stress | 30% | 0% | SELL BTCUSDT PERP (30% of spot exposure) | HEDGE_30 | 8 | 66,000.00 | N/A | N/A | N/A |
| 2026-06-19 | 62,840.80 | watch | 0% | 0% | NO ACTION | NO_HEDGE | 7 | 66,000.00 | N/A | N/A | N/A |
| 2026-06-21 | 63,971.50 | watch | 0% | 0% | NO ACTION | NO_HEDGE | 5 | 66,000.00 | -77.66 | N/A | N/A |
| 2026-06-22 | 64,629.40 | watch | 0% | 0% | NO ACTION | NO_HEDGE | 4 | 66,000.00 | -146.86 | N/A | Underlying entry price unavailable; underlying and net PnL are not currently calculable. |

### ETH

| Date | Price | Regime | Target | Current | Action | Exec | DTE | Strike | Option PnL | Net PnL | Warnings |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-18 | 1,712.00 | stress | 30% | 0% | SELL ETHUSDT PERP (30% of spot exposure) | HEDGE_30 | 8 | 1,800.00 | N/A | N/A | N/A |
| 2026-06-19 | 1,694.94 | stress | 30% | 0% | SELL ETHUSDT PERP (30% of spot exposure) | HEDGE_30 | 7 | 1,775.00 | N/A | N/A | N/A |
| 2026-06-21 | 1,722.31 | stress | 30% | 30% | NO ACTION | HEDGE_30 | 5 | 1,775.00 | -132.92 | N/A | N/A |
| 2026-06-22 | 1,744.96 | stress | 30% | 30% | NO ACTION | HEDGE_30 | 4 | 1,775.00 | -103.23 | N/A | Underlying entry price unavailable; underlying and net PnL are not currently calculable. |

## Premium Source Detail

| Date | Asset | Expiry | Strike | Premium Status | Premium Source |
| --- | --- | --- | --- | --- | --- |
| 2026-06-18 | BTC | 2026-06-26 | 66,000.00 | EXECUTABLE_BYBIT | bybit_bid_ask_mid |
| 2026-06-18 | ETH | 2026-06-26 | 1,800.00 | EXECUTABLE_BYBIT | bybit_bid_ask_mid |
| 2026-06-19 | BTC | 2026-06-26 | 66,000.00 | EXECUTABLE_BYBIT | bybit_bid_ask_mid |
| 2026-06-19 | ETH | 2026-06-26 | 1,775.00 | EXECUTABLE_BYBIT | bybit_bid_ask_mid |
| 2026-06-21 | BTC | 2026-06-26 | 66,000.00 | EXECUTABLE_BYBIT | bybit_registered_option_mark_price |
| 2026-06-21 | ETH | 2026-06-26 | 1,775.00 | EXECUTABLE_BYBIT | bybit_registered_option_mark_price |
| 2026-06-22 | BTC | 2026-06-26 | 66,000.00 | EXECUTABLE_BYBIT | bybit_registered_option_mark_price |
| 2026-06-22 | ETH | 2026-06-26 | 1,775.00 | EXECUTABLE_BYBIT | bybit_registered_option_mark_price |

## Notes

- Approximate PnL is populated only when the required accounting entry fields and market marks are available.
- Option marks come from archived live position monitoring when available; no theoretical option model is used.
- Missing fields remain N/A.
