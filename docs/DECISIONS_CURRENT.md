# Current Baseline – CCW System

## Execution
- Weekly cycles (Friday-based)
- Entry: configurable (default 08:00 UTC)
- Exit: currently fixed at 08:00 UTC (to be generalized)

## Strategy
- Covered Call (BTC)
- Strike selection: % OTM
- Default fallback: stay long BTC when no call is available

## Data
- Underlying: Deribit BTC index (temporary proxy)
- Option data via Deribit OHLC
- Fill assumption: candle open

## Known Limitations (Accepted for MVP)
- No liquidity modeling (volume, spread, slippage ignored)
- Manual option discovery (instrument naming heuristics)
- No fallback to next valid strike yet
- No settlement price (TWAP) usage yet

## Pending Improvements
- Support execution modes: 08→08, 16→16, 08→16
- Use proper instrument discovery (exchange APIs)
- Add liquidity filters and fallback logic
- Improve accounting clarity (capital vs premium handling)
- Add risk metrics (drawdown, volatility, benchmark vs BTC)
- Monte Carlo simulation