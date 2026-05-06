# Current Baseline - CCW System

## Execution
- Weekly cycles (Friday-based)
- Entry: configurable (default 08:00 UTC)
- Exit: currently fixed at 08:00 UTC (to be generalized)
- `endDate` is a completed-cycle boundary: a weekly cycle is included only if its exit datetime is `<= endDate`
- Date-only `endDate` values (`YYYY-MM-DD`) are interpreted at the current exit time, currently `08:00 UTC`; full timestamps are preserved exactly

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

### Option entry pricing fallback

Observed option candles remain the preferred source for option entry premium. When a valid option entry candle is missing, the planned fallback is theoretical pricing rather than silently dropping the covered-call leg.

For the MVP, the theoretical fallback model is Black-76 call pricing using a Garman-Klass realized volatility estimate from `BTC-PERPETUAL` OHLC. Interest rates and BTC yield are ignored for now because their expected impact is small relative to the current data-quality and execution-timing uncertainties.

This fallback exists to reduce missing-data bias. It does not mean the trade was actually observed or executable at that theoretical price. Any theoretical entry price must be explicitly flagged in trade output and must never be mixed silently with observed option candles.

### Pricing model rationale

The backtest separates the price used to value BTC exposure from the price used to settle the option payoff.

`BTC-PERPETUAL` is currently used for BTC exposure because the strategy is modeled as staying long BTC between weekly entry and exit. The perpetual market provides a continuous, liquid proxy for executable BTC exposure during the holding period. It is not intended to represent the official option settlement price.

Deribit option payoff should reference a BTC/USD settlement/index source because listed option expiration is tied to Deribit's index/delivery mechanism, not to the perpetual contract mark. Using the perpetual for option payoff would mix two different markets: one for holding BTC exposure and one for determining the option's intrinsic value at expiry.

This creates basis risk: `BTC-PERPETUAL` and the BTC/USD settlement index can differ at the same timestamp. That difference is part of the research problem and should remain visible in trade output through `S_exit` for BTC exposure and `S_settlement` for option payoff.

Official Deribit delivery price / 30-min TWAP is not implemented yet because it requires a dedicated data path and validation against Deribit's delivery methodology. For the MVP, `BTC_USD` OHLC is used as a clearly named settlement proxy so results are reproducible while the exact delivery-price implementation is still pending.

## Known Limitations (Accepted for MVP)
- No liquidity modeling (volume, spread, slippage ignored)
- Manual option discovery (instrument naming heuristics)
- No fallback to next valid strike yet
- No official Deribit delivery price / 30-min TWAP usage yet
- Settlement proxy may fall back to the BTC exposure exit price if the index proxy is unavailable; this must be visible in trade output
- Basis risk between `BTC-PERPETUAL` and the settlement/index proxy is measured implicitly but not yet analyzed as a separate risk metric
- Theoretical option pricing fallback is a planned MVP decision, not implemented yet

## Pending Improvements
- Support execution modes: 08->08, 16->16, 08->16
- Use proper instrument discovery (exchange APIs)
- Add liquidity filters and fallback logic
- Implement Black-76 / Garman-Klass theoretical option entry fallback with explicit trade flags
- Improve accounting clarity (capital vs premium handling)
- Add risk metrics (drawdown, volatility, benchmark vs BTC)
- Monte Carlo simulation
