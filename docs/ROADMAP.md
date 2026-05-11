# CCW Development Roadmap

This roadmap sequences CCW research so the project does not expand across asset, tenor, moneyness, hedge, and realism dimensions before the baseline is understood.

## Sequencing Principle

- First understand the weekly BTC baseline.
- Then compare tenors.
- Then expand assets.
- Then add hedge, risk, and realism layers.
- Avoid expanding asset x tenor x moneyness x hedge dimensions too early.

## Phase 1 - Baseline Hardening

- Finish weekly BTC sweeps:
  - OTM 3%.
  - OTM 5%.
  - ATM.
  - ITM 5%.
- Analyze execution friction as a post-processing layer first, not inside the core backtest:
  - preserve frictionless raw backtest outputs;
  - add analyzer for option premium haircut sensitivity;
  - default haircut scenarios: 5%, 10%, 20%;
  - support single-run mode and batch mode;
  - save friction outputs under each run or batch folder;
  - do not modify original `trades.csv`, `summary.json`, or `equity_curve.csv`;
  - use this first to test whether the strategy edge survives realistic bid/ask/slippage assumptions.
- Treat the execution-friction layer as a first-order approximation, not a full bid/ask simulator.
- Produce the first qualitative interpretation of the weekly BTC strategy.

## Phase 2 - Tenor Surface

- Implement 2-week cycles.
- Implement monthly cycles.
- Compare weekly vs 2-week vs monthly on:
  - return;
  - volatility;
  - drawdown;
  - premium yield;
  - turnover;
  - synthetic ratio;
  - settlement fallback.

## Phase 3 - Asset Expansion

- Extend the framework first to ETH.
- Later evaluate SOL and XRP depending on option availability and liquidity.

## Phase 4 - Risk Architecture

- Investigate collars.
- Investigate dynamic futures hedge / regime-based hedging.
- Add richer risk metrics:
  - max drawdown;
  - rolling returns;
  - downside deviation;
  - CVaR / ulcer index if useful.

## Phase 5 - Realism Layer

- Model actual spot BTC ownership instead of only the `BTC-PERPETUAL` proxy.
- Model BTC yield/deployment while held.
- Model premium deployment, reinvestment, or withdrawal.
- Add fees, custody/exchange venue, cash/coin balances, and operational constraints.
