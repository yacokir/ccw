# Risk Glossary

This glossary defines terms used in the CCW risk and hedging framework. The definitions are research-oriented and should be read alongside the methodology documents and generated analysis caveats.

| Term | Definition |
| --- | --- |
| Hedge ratio | The fraction of gross BTC exposure offset by a hedge. A 20% hedge ratio means the strategy keeps roughly 80% net BTC exposure before other effects. |
| Short perp hedge | A short BTC perpetual position used to offset part of the strategy's long BTC exposure. It may reduce losses during BTC declines but can lose money when BTC rises. |
| Net BTC exposure | Long BTC exposure minus short futures or perpetual hedge exposure. It represents the remaining directional BTC exposure after hedging. |
| EWMA volatility | Exponentially weighted moving average volatility. It estimates recent volatility while assigning more weight to newer returns. |
| Lambda | The EWMA decay parameter. Higher lambda keeps more memory and responds more slowly; lower lambda responds faster but can be noisier. |
| VaR | Value at Risk. A model estimate of loss over a specified horizon and confidence level. In this project it is a sizing tool, not a guarantee. |
| Max-loss budget | The maximum modeled loss percentage the hedge model is allowed to tolerate before increasing hedge exposure, subject to caps. |
| Risk budget | The amount of risk intentionally allocated to a strategy, position, or overlay. In this framework it is closely related to the max-loss budget used for hedge sizing. |
| Z-score | The confidence multiplier used in parametric VaR. A one-sided 95% normal VaR commonly uses approximately `1.65`. |
| Cyclical hedge | A hedge sized at the CCW roll and held fixed until the next roll. The planned EWMA/VaR hedge is cyclical in its first version. |
| Fixed hedge frontier | The implemented analysis-only hedge layer that tests fixed always-on hedge ratios such as `h00`, `h10`, `h20`, `h30`, and `h40`. |
| Intracycle diagnostic | A future monitoring or alert layer that evaluates conditions between CCW rolls. It is separate from the first cyclical EWMA/VaR hedge model. |
| Drawdown | The decline from a prior equity peak to a later trough. Current project drawdowns are generally based on reconstructed end-of-cycle equity unless otherwise stated. |
| Ulcer index | A drawdown severity metric calculated from the squared drawdown path. It penalizes both depth and persistence of being underwater. |
| Downside dispersion | The sample dispersion of negative returns only. Current project usage may differ from classic downside deviation around a target return. |
| Downside deviation | Dispersion of returns below a specified minimum acceptable return. It is commonly used in Sortino-style metrics. |
| Basis risk | The risk that futures or perpetual prices diverge from spot BTC prices, causing hedge performance to differ from the intended spot offset. |
| Funding cost | Payments associated with perpetual futures funding rates. Funding can materially affect the realized cost or benefit of a short perp hedge. |
| Liquidation risk | The risk that leveraged or margined hedge positions are forcibly closed due to insufficient collateral or adverse mark-to-market movement. |
| Slippage | The difference between expected execution price and realized execution price. Slippage can increase during stressed or illiquid market conditions. |
| Regime risk | The risk that strategy behavior changes across market environments such as bull markets, bear markets, volatility expansions, or recovery periods. |
| Left-tail risk | The risk of rare or severe downside outcomes. Hedging in this framework primarily targets left-tail exposure rather than full return stabilization. |
