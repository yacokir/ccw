# Weekly BTC Baseline Comparison — Initial Observations

Source:

```text
analysis/generated/weekly_btc_baseline_comparison.csv
```

Status:

Initial qualitative observations only.
These are not final conclusions because the current comparison layer does not yet include:

- drawdown
- volatility
- rolling returns
- downside behavior
- crash sensitivity
- risk-adjusted metrics

---

# 1. Raw Performance Increases Toward OTM

Initial observation:

Raw strategy performance appears to improve significantly as strike selection moves farther OTM.

Examples observed:

- itm05 ≈ 370% total return
- atm00 ≈ 607%
- otm03 ≈ 994%

Higher OTM variants likely continue this pattern.

---

# 2. Friction Sensitivity Appears Lower for OTM Strikes

The comparison suggests that farther OTM strikes may survive execution friction better than ITM structures.

Examples:

## itm05

- raw ≈ 370%
- uniform adjusted ≈ -42%
- degradation ≈ 111%

## atm00

- adjusted ≈ 176%
- degradation ≈ 71%

## otm03

- adjusted ≈ 528%
- degradation ≈ 47%

Initial interpretation:

```text
Farther OTM strikes may be structurally more robust to execution friction.
```

This appears true even under higher moneyness-dependent haircut assumptions.

---

# 3. Moneyness Friction Model Appears More Realistic Than Uniform Model

Observed behavior:

The moneyness-dependent friction model produces substantially less degradation than the flat 10% uniform haircut model.

Example:

## otm03

- uniform adjusted ≈ 528%
- moneyness adjusted ≈ 702%

Initial interpretation:

```text
Uniform friction may be excessively pessimistic.
```

or:

```text
Differentiated friction assumptions by moneyness may better reflect actual execution conditions.
```

This remains a research hypothesis, not a validated market conclusion.

---

# 4. Premium Maximization Does Not Yet Appear Dominant

Initial observation:

Higher-premium structures (such as itm05) do not currently appear superior after friction adjustments.

Examples:

- itm05 receives substantially larger premiums
- but also degrades heavily under friction
- and remains inferior to several OTM structures in adjusted return

Initial interpretation:

```text
Upside preservation may matter more than premium maximization.
```

At least during the 2020–2026 BTC market regime.

---

# 5. Important Caveat — Risk Layer Still Missing

Current observations are incomplete because the project still lacks a dedicated risk layer.

Missing metrics include:

- max drawdown
- volatility
- rolling returns
- downside deviation
- crash behavior
- path dependency analysis

Possible future outcome:

```text
ITM structures may exhibit substantially lower risk even with lower returns.
```

Therefore:

```text
Current observations should not yet be interpreted as proof that OTM structures are universally superior.
```

Only that:

```text
OTM structures currently appear more robust in execution-adjusted return terms.
```

---

# 6. CAGR Interpretation

Observed behavior:

- Raw rows use CAGR calculated from raw returns.
- Friction rows use CAGR calculated from friction-adjusted returns.

This appears methodologically correct.

Examples:

## itm05 raw

- total_return ≈ 370%
- cagr ≈ 27.6%

## itm05 uniform

- adjusted_return ≈ -42%
- cagr ≈ -8.3%

This confirms that friction-adjusted CAGR is being calculated consistently from adjusted performance rather than raw performance.