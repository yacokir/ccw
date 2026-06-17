# Daily MTM 2025 Consolidated Comparison

Generated: 2026-06-16T18:26:44.308Z

## Scope

- Inputs: existing Daily MTM JSON artifacts only.
- No new MTM generation and no backtests were run by this comparison step.
- Metrics are approximate research MTM metrics, not official portfolio accounting.

## Summary

| strategy | returns | mean | stdDev | p5 | p95 | maxDD | ewmaMax | worstVaR | gaps |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| BTC Weekly OTM05 2025 | 252 | -0.024831% | 1.854251% | -2.795671% | 2.527272% | -32.756283% | 2.983408% | 6.233757% | 91/1/0 |
| BTC Weekly OTM10 2025 | 254 | -0.02762% | 2.01973% | -3.21774% | 3.033942% | -32.537703% | 2.834352% | 5.765818% | 91/0/0 |
| ETH Weekly OTM05 2025 | 254 | 0.008396% | 3.178783% | -4.978757% | 4.53057% | -58.245352% | 5.089849% | 9.08889% | 91/0/0 |
| ETH Weekly OTM03 2025 | 254 | -0.005292% | 3.016369% | -4.741213% | 3.730427% | -57.717826% | 4.585918% | 8.829222% | 91/0/0 |

Gap format: synthetic or missing instrument rows / missing option rows / missing underlying rows.

## Answers

- Does ETH show significantly higher daily risk than BTC? Yes.
  - ETH OTM05 daily std dev 3.178783% vs BTC OTM05 1.854251%.
  - ETH OTM03 daily std dev 3.016369% vs BTC OTM05 1.854251%.
  - ETH max drawdowns -58.245352% / -57.717826% vs BTC -32.756283% / -32.537703%.
  - ETH worst VaR loss 9.08889% / 8.829222% vs BTC 6.233757% / 5.765818%.

- Is ETH OTM03 really more defensive than ETH OTM05? Yes, mildly in this daily MTM slice.
  - ETH OTM03 daily std dev 3.016369% vs ETH OTM05 3.178783%.
  - ETH OTM03 max drawdown -57.717826% vs ETH OTM05 -58.245352%.
  - ETH OTM03 worst VaR loss 8.829222% vs ETH OTM05 9.08889%.
  - ETH OTM03 p5 daily return -4.741213% vs ETH OTM05 -4.978757%.

- Is BTC OTM10 really more aggressive than BTC OTM05? Yes, but only mildly in this daily MTM slice.
  - BTC OTM10 daily std dev 2.01973% vs BTC OTM05 1.854251%.
  - BTC OTM10 p5 daily return -3.21774% vs BTC OTM05 -2.795671%.
  - BTC OTM10 mean VaR loss 3.081672% vs BTC OTM05 2.912307%.
  - BTC OTM10 max drawdown -32.537703% vs BTC OTM05 -32.756283%.

- Does Daily MTM change any important prior conclusion? No.
- It reinforces the value of intracycle risk monitoring, especially for ETH, but does not overturn the baseline hierarchy.

## Baseline Review

- Reconsider BTC Weekly OTM05 baseline? No.
- Reconsider ETH Weekly OTM05 baseline? No.
- BTC OTM05 remains reasonable as baseline: OTM10 does not show a cleaner daily risk profile in this slice.
- ETH OTM05 remains reasonable as provisional baseline: OTM03 is mildly more defensive on daily risk, but the difference is not large enough by itself to overturn the friction/operational baseline decision.
- Daily MTM adds intracycle risk evidence, especially ETH drawdown severity, but it does not contradict the existing baseline choices.

## Caveats

- All results inherit the Daily MTM caveats: option OHLC proxies, no official historical marks, no greeks, no funding, no slippage, no margin, and visible synthetic-cycle gaps.
- This is a single-year 2025 comparison, not a multi-year stability proof.
