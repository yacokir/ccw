# Volatility And VaR Methodology

## Purpose

This document describes the planned EWMA/VaR methodology for a future risk-budgeted cyclical hedge. The model is intended to size a partial BTC hedge at each CCW roll using recent volatility and a maximum loss budget.

This is a design document. It does not claim that the model has been implemented, validated, or found superior to the fixed hedge frontier.

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
- Missing costs: funding, basis, slippage, and liquidity stress can materially change hedge outcomes.

The cyclical hedge should therefore be compared against fixed `h10`, `h20`, and `h40` benchmarks, not judged only by its own historical performance.

## Future Advanced VaR Extensions

Advanced VaR and tail-risk models are important future work, but they should be explored only after the baseline EWMA/VaR cyclical hedge has been implemented, validated, and compared against fixed hedge benchmarks.

Potential future extensions include:

- Historical VaR.
- Stressed VaR.
- Cornish-Fisher VaR.
- EVT / Extreme Value Theory approaches.
- Non-normal BTC tail modeling.

The current methodology intentionally starts simple. A normal parametric VaR model is useful for transparent first-pass hedge sizing, but BTC return tails are highly non-normal and may not be well represented by a normal approximation. Production-grade tail modeling would likely require methods that address skew, excess kurtosis, volatility clustering, regime shifts, and extreme downside observations more directly.

These advanced methods should be treated as research extensions rather than replacements for the initial framework until the simpler cyclical hedge behavior is understood.
