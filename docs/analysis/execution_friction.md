# Execution Friction Analysis

## Current Model

Execution friction is currently modeled as a simple option premium haircut applied after the core backtest has already produced frictionless run outputs.

For each trade, the analyzer estimates the premium received from the option leg, reduces that premium by the selected haircut, and subtracts the haircut amount from call PnL and total PnL. The original run files remain unchanged.

## Default Scenarios

- Optimistic: `0.05` = 5%
- Intermediate stress: `0.10` = 10%
- Conservative: `0.20` = 20%

`haircutPct` is expressed as a decimal, so `0.05` means a 5% haircut to the option premium.

## Purpose

This is a first-order stress and sensitivity tool. It helps test whether apparent strategy edge survives plausible bid/ask spread, slippage, and execution quality assumptions.

It is not a full bid/ask simulator. It does not model order book depth, partial fills, time-varying spreads, separate entry/exit execution, market impact, or liquidity constraints.

## Planned Moneyness-Dependent Friction Model

Uniform premium haircuts were useful as first-order stress tests, but they are unlikely to represent execution quality equally across all strikes. Observed Deribit liquidity suggests execution quality varies materially by moneyness.

Near-ATM and moderately OTM front-week strikes appear materially more liquid, while farther OTM strikes may exhibit larger percentage spreads and lower liquidity. A moneyness-dependent haircut model may therefore be a more economically plausible approximation than applying one uniform haircut to every option trade.

Preliminary conceptual mapping:

| Relative Moneyness | Preliminary Haircut Assumption |
| --- | --- |
| ITM >= 5% | 4% |
| ATM +/-2% | 4% |
| OTM 2-5% | 6% |
| OTM 5-8% | 8% |
| OTM 8-12% | 10% |
| OTM >12% | 15% |

These are research assumptions only. They are not calibrated from historical bid/ask data and should not be treated as execution estimates.

Future work may incorporate:

- Tenor-dependent friction.
- Observed option volume.
- Bid/ask snapshots.
- Volatility regime effects.
- Order book depth.

## Future Work

Future versions may use moneyness-dependent, tenor-dependent, volatility-dependent, or liquidity-dependent haircuts. This could better reflect the reality that deep ITM/OTM options and low-volume expiries may have wider effective execution costs than liquid near-ATM contracts.
