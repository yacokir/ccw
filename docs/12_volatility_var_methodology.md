# Volatility And VaR Methodology

## Purpose

This document describes the planned EWMA/VaR methodology for a future risk-budgeted cyclical hedge. The model is intended to size a partial BTC overlay hedge at each CCW roll using recent volatility and a maximum loss budget.

This is a design document. It does not claim that the model has been implemented, validated, or found superior to the fixed hedge frontier.

The purpose of the VaR layer is tail-risk mitigation and crisis-risk engineering. It is not intended to minimize ordinary volatility, create a market-neutral strategy, or eliminate BTC exposure. Any VaR-based hedge should be judged by whether it improves catastrophic downside behavior while preserving the baseline CCW return engine.

## EWMA Volatility

Exponentially weighted moving average volatility estimates recent realized volatility while giving newer observations more weight than older observations.

For a return series `r`, the variance estimate can be updated as:

```text
ewma_var_t = lambda * ewma_var_{t-1} + (1 - lambda) * r_t^2
ewma_vol_t = sqrt(ewma_var_t)
```

The parameter `lambda` controls memory decay:

- Higher `lambda` means slower decay, more residual memory, and smoother volatility estimates.
- Lower `lambda` means faster responsiveness to recent market moves, but noisier estimates.

Candidate lambda values for BTC research:

- `0.85`: faster response, less memory.
- `0.90`: intermediate response.
- `0.94`: slower response, common in risk-modeling references but potentially lagged during abrupt BTC volatility shifts.

The research should explicitly test whether the volatility estimate reacts quickly enough during drawdown regimes without becoming so reactive that it over-hedges after isolated shocks.

## Return Series Choice

The EWMA model may use BTC returns rather than CCW strategy returns.

BTC returns may be cleaner for a futures or perpetual hedge because the hedge instrument directly offsets BTC price exposure. CCW strategy returns include option premium, capped upside, strike selection, tenor effects, and fallback behavior. Those components are important to total strategy performance, but they may blur the volatility estimate used to size a direct BTC short hedge.

Using BTC returns also makes the hedge model easier to interpret:

```text
BTC volatility -> BTC exposure at risk -> BTC hedge ratio
```

Strategy-return volatility can still be studied as a diagnostic or alternative model, especially if future overlays hedge total strategy equity risk rather than BTC price exposure alone.

This return-series choice reinforces an important boundary: the current framework is a BTC overlay hedge, not a full option delta-aware hedge. It does not estimate the option book's dynamic delta or other greeks, and it does not model how implied volatility, skew, gamma, theta, or vega change the full covered-call portfolio value through time.

## VaR Logic

The planned model uses a simple parametric VaR approximation:

```text
VaR = z * EWMA_vol * net_exposure
```

Where:

- `z` is the confidence multiplier.
- `EWMA_vol` is the volatility estimate over the model horizon.
- `net_exposure` is the unhedged exposure remaining after the hedge.

For a 95% one-sided normal approximation:

```text
z = 1.65
```

This VaR estimate is a sizing tool, not a guarantee. BTC returns are not normally distributed, volatility is unstable, and realized losses can exceed model estimates.

VaR should also be interpreted as a risk-sizing input, not as the strategy objective. A lower modeled VaR is not automatically better if it requires hedge ratios that materially suppress the CCW return engine.

## Max-Loss-Budget Logic

The model sets a maximum loss budget as a percentage of the relevant capital or exposure base. Example candidate budgets:

- `5%`
- `10%`
- `15%`

The hedge ratio is chosen so that estimated VaR on the remaining net exposure does not exceed the selected budget, subject to a maximum hedge cap.

Starting from:

```text
z * EWMA_vol * net_exposure <= maxLossBudgetPct
```

If gross BTC exposure is normalized to `1`, then:

```text
net_exposure = 1 - hedgeRatio
```

Solving for the hedge ratio gives:

```text
hedgeRatio = 1 - maxLossBudgetPct / (z * EWMA_vol)
```

With bounds:

```text
hedgeRatio = clamp(1 - maxLossBudgetPct / (z * EWMA_vol), 0, maxHedge)
```

Candidate hedge caps:

- `60%`
- `80%`

The cap is important because the model should reduce left-tail exposure without fully neutralizing the BTC/CCW return engine.

Very low loss budgets can become economically incompatible with BTC yield-enhancement strategies. For example, a 5% max-loss budget may imply high hedge ratios during stress periods, particularly when EWMA volatility rises quickly. Such ratios can reduce tail exposure, but they may also remove much of the desired long-BTC exposure and damage the economic reason to run the CCW strategy.

Risk budgets should therefore be treated as research assumptions that require economic validation. They should be evaluated together with realized hedge ratios, cap binding frequency, foregone upside, funding and basis costs, and crisis-period path behavior.

## Cycle Timing

The hedge ratio is calculated at cycle entry, when the CCW position is rolled.

After the hedge ratio is selected, it remains fixed during the cycle:

```text
roll date
  -> compute EWMA volatility
  -> compute VaR-based hedge ratio
  -> enter or resize hedge
  -> hold fixed until next roll
```

The first version should not automatically adjust intracycle. Intracycle crisis response is separate future work and should be documented, implemented, and evaluated independently.

Current research raises a hypothesis that hedge latency may be more important than hedge sizing alone. A cycle-entry hedge can be directionally reasonable at inception but stale during a fast selloff. This may be more relevant for 14d cycles than weekly structures because weekly variants rebalance risk more frequently. This remains a hypothesis and should be tested with intracycle data before being treated as a conclusion.

## Candidate Parameter Grid

Initial research candidates:

| Parameter | Candidate values |
| --- | --- |
| `lambda` | `0.85`, `0.90`, `0.94` |
| `z` | `1.65` for 95% one-sided VaR |
| `maxLossBudgetPct` | `5%`, `10%`, `15%` |
| `maxHedge` | `60%`, `80%` |

These values are starting points for sensitivity analysis. They should not be optimized directly to maximize historical return.

## Interpretation Risks

The model has several important risks:

- Overfitting: selecting parameters because they performed best historically may produce fragile future behavior.
- Response lag: higher lambda values may under-hedge early in sudden volatility expansions.
- Whipsaw: lower lambda values may overreact after short-lived shocks.
- Distribution error: normal VaR can understate BTC tail risk.
- Horizon mismatch: volatility estimated from one return frequency may not match the CCW cycle horizon.
- Exposure mismatch: BTC price exposure, CCW equity exposure, and margin exposure may diverge.
- Greek mismatch: BTC overlay hedges do not dynamically hedge the option book's delta, gamma, vega, theta, or skew exposure.
- Economic mismatch: strict loss budgets may require hedge ratios that impair the baseline CCW edge.
- Missing costs: funding, basis, slippage, and liquidity stress can materially change hedge outcomes.

The cyclical hedge should therefore be compared against fixed `h10`, `h20`, and `h40` benchmarks, not judged only by its own historical performance.

## Daily Approximate MTM Extension

The Daily Approximate MTM extension has been validated for research purposes on BTC weekly OTM10 in 2025. It allows CCW returns and risk to be estimated at daily resolution using a consistent BTC price snapshot plus option OHLC or trade-price proxies.

The validated POC methodology is:

- Snapshot time: 10:00 New York time, converted consistently to UTC by date.
- BTC proxy: Deribit `BTC-PERPETUAL` 1-minute candle close at the snapshot.
- Option proxy: exact traded short-call option 1-minute OHLC close at the snapshot.
- Option conversion: BTC-denominated option close converted to USD using the snapshot BTC price.
- Valuation: `approximate_CCW_value = BTC_price - option_price_proxy_usd`.
- Daily returns: computed only across adjacent valid MTM observations; missing MTM gaps are not bridged.
- EWMA volatility: daily approximate CCW returns with `lambda = 0.94`.
- Historical VaR: empirical 5th percentile over a rolling 30 valid daily-return window.

Potential capabilities include:

- Daily CCW returns and drawdowns.
- Historical daily VaR.
- Daily realized volatility.
- Crisis path analysis.
- Approximate intracycle hedge-frequency simulation.

Current POC findings:

- Daily MTM exposes intracycle drawdown that cycle-level outputs compress.
- Daily returns show visible left-tail behavior and volatility clustering.
- Historical daily VaR appears more informative than EWMA alone for persistence of BTC stress in the validated slice.
- Missing synthetic-cycle gaps remain visible and materially affect continuity.

This layer should be handled conservatively. Option OHLC and trade-price proxies can be stale, sparse, liquidity-distorted, or influenced by wide spreads. They are not equivalent to official marks, executable mid prices, or full greek-aware valuations. Results from this layer should be labeled approximate MTM and used as research evidence rather than definitive portfolio accounting.

This extension does not include official historical marks, historical greeks, delta-aware hedging, funding, slippage, liquidation, margin, or production-quality risk accounting. Current POC outputs are archived under `analysis/generated/poc/daily_mtm_ccw_2025/` to keep them separate from future generalized daily-risk outputs. The dedicated reference document is `docs/14_daily_approx_mtm_research_layer.md`.

## Future Advanced VaR Extensions

Advanced VaR and tail-risk models are important future work, but they should be explored only after the baseline EWMA/VaR cyclical hedge has been implemented, validated, and compared against fixed hedge benchmarks.

Potential future extensions include:

- Historical VaR.
- Hybrid VaR using `max(EWMA VaR, Historical VaR)`.
- Generalized multi-year daily approximate MTM.
- OTM05 and 14d daily-risk comparison.
- Stressed VaR.
- Cornish-Fisher VaR.
- EVT / Extreme Value Theory approaches.
- Non-normal BTC tail modeling.
- Intracycle hedge-frequency simulation using daily approximate MTM.
- Event-driven or crisis-trigger hedge escalation.
- Full option mark and greek-aware hedging research using external historical providers such as Tardis.

The current methodology intentionally starts simple. A normal parametric VaR model is useful for transparent first-pass hedge sizing, but BTC return tails are highly non-normal and may not be well represented by a normal approximation. Production-grade tail modeling would likely require methods that address skew, excess kurtosis, volatility clustering, regime shifts, and extreme downside observations more directly.

These advanced methods should be treated as research extensions rather than replacements for the initial framework until the simpler cyclical hedge behavior is understood.
