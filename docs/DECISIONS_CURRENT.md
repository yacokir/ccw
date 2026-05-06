# Current Baseline - CCW System

## Execution
- Weekly cycles (Friday-based)
- Entry: configurable (default 08:00 UTC)
- Exit: currently fixed at 08:00 UTC (to be generalized)

## Strategy
- Covered Call (BTC)
- Strike selection: % OTM
- Default fallback: stay long BTC when no call is available

## Data
- BTC exposure entry/exit price: `BTC-PERPETUAL` (temporary proxy for holding BTC)
- Option settlement/payoff price: separate settlement/index price concept
- Current option settlement proxy: Deribit BTC USD index OHLC proxy (`BTC_USD`), pending official delivery price / 30-min TWAP implementation
- Option data via Deribit OHLC
- Fill assumption: candle open

## Known Limitations (Accepted for MVP)
- No liquidity modeling (volume, spread, slippage ignored)
- Manual option discovery (instrument naming heuristics)
- No fallback to next valid strike yet
- No official Deribit delivery price / 30-min TWAP usage yet
- Settlement proxy may fall back to the BTC exposure exit price if the index proxy is unavailable; this must be visible in trade output

## Pending Improvements
- Support execution modes: 08->08, 16->16, 08->16
- Use proper instrument discovery (exchange APIs)
- Add liquidity filters and fallback logic
- Improve accounting clarity (capital vs premium handling)
- Add risk metrics (drawdown, volatility, benchmark vs BTC)
- Monte Carlo simulation
