# Daily Approximate MTM Research Layer

## Purpose

The Daily Approximate MTM Research Layer estimates daily BTC CCW valuation, returns, drawdowns, volatility, VaR, and tail behavior from historical BTC price data plus option OHLC or trade-price proxies.

This layer exists to support daily risk analysis, tail-event analysis, daily VaR research, volatility clustering research, and future intracycle hedge simulation. It does not provide official mark accounting, greek-aware hedging, true option portfolio risk modeling, or production-quality risk systems.

## Validated POC Scope

The current validated POC scope is intentionally narrow:

- Asset: BTC.
- Tenor: weekly.
- Moneyness: OTM10.
- Year: 2025.
- Snapshot: 10:00 New York time, converted consistently to UTC.

POC outputs are archived under:

```text
analysis/generated/poc/daily_mtm_ccw_2025/
```

This folder should remain a traceable validation slice and should not be overwritten by future generalized daily-risk runs.

## Methodology

The validated POC uses:

- BTC proxy: Deribit `BTC-PERPETUAL` 1-minute candle close at the daily snapshot.
- Option proxy: exact traded short-call option 1-minute OHLC close at the same snapshot.
- Option conversion: BTC-denominated option close converted to USD using the snapshot BTC price.
- Approximate valuation: `approximate_CCW_value = BTC_price - option_price_proxy_usd`.
- Daily returns: computed only across adjacent valid MTM observations.
- EWMA volatility: daily approximate CCW returns with `lambda = 0.94`.
- Historical VaR: empirical 5th percentile over a rolling 30 valid daily-return window.

Missing MTM gaps are kept visible. Synthetic cycles without exact observed option instruments are not bridged into adjacent daily returns.

## Validated Findings

Current BTC weekly OTM10 2025 findings support the layer as research-grade:

- Approximate daily MTM reconstruction is viable for exact observed option cycles.
- Daily return distributions are usable for exploratory risk research.
- Daily MTM exposes deeper intracycle drawdowns than cycle-level outputs alone.
- Volatility clustering and left-tail behavior are visible.
- Historical VaR appears more informative than EWMA alone for BTC stress persistence in this slice.
- Missing synthetic-cycle gaps remain an important continuity limitation.

These findings do not establish hedge effectiveness. They only validate that the daily-risk layer can support future research.

## Limitations

The current layer is approximate and exploratory:

- No official historical option marks.
- No historical greeks.
- No delta-aware hedge.
- No full option portfolio sensitivity model.
- Option OHLC/trade-price proxies may be stale, sparse, spread-distorted, or liquidity-distorted.
- Synthetic-cycle continuity gaps remain visible.
- No funding, slippage, liquidation, margin, basis, collateral, custody, or tax modeling.

## Roadmap

Future work should proceed in this order:

1. Preserve the current POC artifact structure.
2. Build a generalized multi-year daily MTM framework.
3. Compare OTM05 against OTM10.
4. Compare 14d against weekly.
5. Evaluate hybrid VaR, including `max(EWMA VaR, Historical VaR)`.
6. Simulate intracycle hedge-frequency alternatives.
7. Add event-driven or crisis-trigger research only after simpler daily-risk behavior is understood.
8. Consider external historical option-mark providers, such as Tardis, for official marks, greeks, or fuller option-chain snapshots.
