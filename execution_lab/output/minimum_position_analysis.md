# Execution Laboratory - Minimum Position Analysis

Generated at: 2026-06-25T15:26:52.112Z

## Scope

- Track B only.
- Bybit Demo only.
- Read-only GET calls only.
- No orders, no fund adjustments, no Track A integration.

## Observable Minimums

- BTC options found: 720
- Minimum option qty: 0.01
- Qty step: 0.01
- Tick size: 5
- Minimum theoretical capital: 592.93 USDT
- Minimum operational capital: 622.58 USDT

## Scenario Analysis

| Underlying | Approx Notional | Option Qty | Est. Capital | Capital Remaining | Feasible |
| --- | ---: | ---: | ---: | ---: | --- |
| 0.01 BTC | 592.93 USDT | 0.01 | 622.58 USDT | 1377.42 USDT | YES |
| 0.02 BTC | 1185.87 USDT | 0.02 | 1245.16 USDT | 754.84 USDT | YES |
| 0.05 BTC | 2964.67 USDT | 0.05 | 3112.9 USDT | -1112.9 USDT | NO |
| 0.1 BTC | 5929.34 USDT | 0.1 | 6225.81 USDT | -4225.81 USDT | NO |

## Limitations

- Instrument metadata is observable exchange metadata only and does not prove order acceptance.
- Capital estimates use BTC notional plus a simple 5% operational buffer and do not model option margin.
- Fees, bid/ask spread, slippage, liquidity, exercise/settlement behavior, and hidden account constraints are not included.
- Covered-call feasibility assumes option quantity maps directly to BTC underlying quantity; this must be validated before any execution research.
- This script is non-production and sends no order or fund-adjustment requests.

