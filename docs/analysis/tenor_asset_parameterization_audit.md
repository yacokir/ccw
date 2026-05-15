# Current Hardcoded Assumptions

## BTC assumptions

- The core strategy defaults to BTC exposure through `BTC-PERPETUAL` and BTC option settlement through `DERIBIT_BTC_USD_DELIVERY_PRICE`.
- Deribit delivery settlement mapping is BTC-only: `DERIBIT_BTC_USD_DELIVERY_PRICE` resolves to `btc_usd`.
- The theoretical volatility source is hardcoded to `BTC-PERPETUAL`, so theoretical option fallback is not asset-aware.
- Observed option instrument names are constructed as `BTC-${expiry}-${strike}-C`.
- Fallback settlement explicitly resolves to `BTC-PERPETUAL` and documents that fallback as BTC exposure pricing.
- Capital sizing, logs, trade fields, and summaries use BTC-specific names such as `btc_position`, `initialBtcPrice`, `finalBtcPrice`, and `btcReturnPct`.
- Run naming infers the asset from `underlyingPriceSource` and collapses anything containing `BTC` to `btc`.
- Generated baseline comparison hardcodes `asset: BTC`.
- Data adapters and diagnostics default to BTC or BTC-specific underlyings:
  - Deribit instruments default to `currency = 'BTC'`.
  - OKX options default to `BTC-USD`.
  - Binance/OKX diagnostic scripts build BTC option symbols.

## Weekly tenor assumptions

- The core cycle generator is `generateFridayCycles`, which creates seven-day cycles only.
- `endDate` is treated as a completed weekly-cycle boundary.
- Summary metrics are named in weeks: `callWeeks`, `totalWeeks`, `observedOptionWeeks`, `theoreticalFallbackWeeks`, `syntheticOptionWeeks`, and related missing-data week counters.
- Volatility reporting is named `annualizedVolatilityOfWeeklyReturns`.
- Trade output includes `weekly_vol`.
- Batch progress uses `week=current/total`.
- Generated baseline comparison hardcodes `tenor: weekly`.
- The current baseline documentation defines the frozen strategy as weekly BTC covered call.

## Friday expiration logic

- Core cycles start on the first Friday on or after `startDate`.
- Each core cycle exits exactly seven days later, also on Friday.
- Current entry and exit defaults are Friday 08:00 UTC.
- Yearly batches start each year at `firstFridayOfYear(year)`.
- Diagnostic option-activity scripts search for nearest Friday expiries.
- Option expiry codes are derived from the computed Friday exit date, not from an exchange expiry calendar query.

## Naming assumptions

- Run names start with the inferred asset label, currently producing names like `btc_2020-01-03_...`.
- Run names do not include `tenor`; weekly behavior is implicit.
- Batch names use `batch_years_${moneyness}_${startYear}_${endYear}` and do not include asset or tenor.
- The weekly baseline comparison script writes `analysis/generated/weekly_btc_baseline_comparison.csv`.
- Batch folders in `runs/batches/` are currently weekly BTC by convention only.
- Existing analysis and batch helper `.bat` files reference those moneyness-only batch names.

## Batch structure assumptions

- `run_batch_years.js` creates one batch per moneyness across year slices.
- Each annual run is generated from the first Friday through the year-end/current-date completed boundary.
- Batch summaries aggregate weekly counters and weekly volatility fields.
- Friction analysis accepts an existing run or batch path and is mostly generic, but its current batch callers pass weekly BTC batch directories.
- `build_weekly_baseline_comparison.js` expects exactly six moneyness batches named `batch_years_<moneyness>_2020_2026`.

# Affected Files

- `src/scripts/test_discovery.js`: Core strategy engine. Contains BTC settlement mapping, BTC theoretical volatility source, Friday weekly cycle generation, BTC option instrument naming, BTC-specific fallback settlement, weekly counters, and BTC-specific summary names. This is the highest-impact file for future asset/tenor support.
- `src/scripts/run_backtest.js`: CLI/config wrapper and run persistence. Defaults to BTC sources, builds BTC-oriented run names, writes index columns with BTC/weekly names, and preserves legacy-aware duplicate detection.
- `src/scripts/run_batch_years.js`: Yearly batch runner. Encodes first-Friday starts, yearly weekly slices, moneyness-only batch names, weekly progress text, and weekly summary fields.
- `src/scripts/build_weekly_baseline_comparison.js`: Analysis generator dedicated to the current weekly BTC baseline. Hardcodes moneyness batch names, output filename, `asset: BTC`, and `tenor: weekly`.
- `src/scripts/analyze_execution_friction.js`: Friction analysis layer. Mostly asset/tenor agnostic because it reads `trades.csv`, but it depends on current trade columns such as `S_entry`, `C_entry_btc`, `btc_position`, and batch summary shape.
- `src/data/deribit.js`: Data adapter. Generic OHLC and delivery-price functions are reusable, but `fetchInstruments` defaults to BTC.
- `src/data/discovery.js`: Option selection utilities. Mostly generic, but currently unused for exchange-driven tenor selection in the core engine.
- `src/data/okx_options.js`: OKX adapter defaults to `BTC-USD`.
- Diagnostic scripts under `src/scripts/test_*.js`: Several scripts hardcode BTC and nearest-Friday logic. These are research/diagnostic utilities, not the production baseline path, but they will become misleading if reused for ETH/SOL/XRP or non-weekly tenors.
- Batch helper files: `friction_sweeps.bat`, `rerun_all_execution_friction.bat`, `corrige_dires.bat`, `cleanup_legacy_execution_friction_files.bat`, and `apagaDuplicados.bat` reference current batch layout or execution-friction output names.
- `runs/index.csv`: Current persistent index schema includes BTC/weekly field names and run paths.
- `runs/batches/*/summary.*`: Existing batch summaries use moneyness-only batch names and weekly counters.
- `analysis/generated/weekly_btc_baseline_comparison.csv`: Current generated comparison already has `asset` and `tenor` columns, but values are fixed to `BTC` and `weekly`.
- Documentation: `docs/BASELINE_REGISTRY.md`, `docs/DECISIONS_CURRENT.md`, `docs/06_backtest_concepts.md`, `docs/analysis/weekly_btc_baseline.md`, and `docs/ROADMAP.md` explicitly define or discuss the frozen weekly BTC baseline.

# Refactor Risk Assessment

- Core cycle generation: high risk. Changing Friday/seven-day logic directly can alter every historical trade and break the frozen baseline.
- Option instrument construction: high risk. Asset-specific symbol formats differ across venues, and BTC is currently embedded in the Deribit instrument name.
- Settlement source mapping: high risk. BTC delivery settlement is explicitly mapped; ETH/SOL/XRP require verified source naming and possibly venue support differences.
- Theoretical volatility source: medium risk. It is isolated, but changing it affects fallback pricing and therefore historical returns whenever observed options are missing or invalid.
- Summary/index field names: medium risk. The names are BTC/weekly-specific, but many existing scripts and CSVs rely on them.
- Run naming: medium risk. Adding asset/tenor names can break duplicate detection, existing paths, and analysis scripts unless legacy naming is preserved.
- Batch naming and folder layout: medium risk. Existing batch helpers and generated reports assume `batch_years_<moneyness>_<years>`.
- Friction analysis: low to medium risk. The math is mostly generic, but it assumes current trade columns and BTC-denominated premium/position fields.
- Data adapters: low to medium risk. Generic request functions are reusable; defaults and symbol formatting need parameterization.
- Documentation-only baseline references: low risk. These should remain as frozen baseline documentation, with new docs added for parameterized behavior.
- Diagnostic scripts: low risk. They can be updated later or marked as BTC-weekly diagnostics.

# Recommended Refactor Strategy

Use an additive configuration layer first, and keep the existing BTC weekly defaults as the compatibility profile.

1. Introduce a normalized strategy parameter object without changing behavior:
   - `asset = 'BTC'`
   - `tenor = 'weekly'`
   - current BTC source defaults
   - current Friday 08:00 UTC timing
   - current seven-day cycle length
   - current naming behavior unless an explicit v2 naming mode is enabled

2. Extract calendar/cycle generation behind a small interface:
   - Keep the current implementation as `weeklyFridayCycles`.
   - Do not implement biweekly/monthly yet.
   - Make `runStrategy` call the interface with `tenor`, while `weekly` returns exactly today's cycle list.

3. Extract asset/venue metadata:
   - Asset code: `BTC`, future `ETH`, `SOL`, `XRP`.
   - Exposure source: default `BTC-PERPETUAL`.
   - Settlement source: default `DERIBIT_BTC_USD_DELIVERY_PRICE`.
   - Delivery index: default `btc_usd`.
   - Option instrument formatter: default Deribit `BTC-${expiry}-${strike}-C`.
   - Premium unit: current observed Deribit premium convention.

4. Keep legacy output columns for BTC weekly:
   - Continue writing `btc_position`, `initialBtcPrice`, `finalBtcPrice`, `btcReturnPct`, `callWeeks`, and `totalWeeks`.
   - Add generic aliases only after the baseline has regression coverage, for example `asset_position`, `initialUnderlyingPrice`, `underlyingReturnPct`, `callCycles`, and `totalCycles`.

5. Add new naming helpers without switching existing outputs:
   - Current names stay valid for the frozen baseline.
   - A future v2 naming scheme can include `asset` and `tenor`, for example `btc_weekly_2020-01-03_...`.
   - Batch names can evolve to `batch_years_btc_weekly_otm05_2020_2026`, while readers support old names.

6. Treat `build_weekly_baseline_comparison.js` as a frozen baseline report generator:
   - Do not generalize it prematurely.
   - Later add a separate comparison builder that accepts `asset`, `tenor`, and batch paths.

# Recommended Parameter Model

A minimal parameter model should separate research intent from venue-specific implementation details:

```js
{
  strategy: 'covered_call',
  asset: 'BTC',
  tenor: 'weekly',
  moneyness: 0.05,
  start_year: 2020,
  end_year: 2026,
  entry: {
    weekday: 'friday',
    hour_utc: 8,
    minute_utc: 0
  },
  exit: {
    weekday: 'friday',
    hour_utc: 8,
    minute_utc: 0
  },
  market: {
    venue: 'deribit',
    underlying_price_source: 'BTC-PERPETUAL',
    option_settlement_price_source: 'DERIBIT_BTC_USD_DELIVERY_PRICE',
    delivery_index: 'btc_usd',
    option_symbol_asset: 'BTC'
  },
  strike: {
    step: 1000,
    range: 3000
  },
  fallback: {
    mode: 'long_btc',
    theoretical_vol_source: 'BTC-PERPETUAL',
    theoretical_vol_lookback_days: 14
  }
}
```

For CLI compatibility, keep accepting current arguments:

- `--xOtm`
- `--startYear`
- `--endYear`
- `--underlying` / `--underlyingPriceSource`
- `--optionSettlementPriceSource`
- `--strikeStep`
- `--strikeRange`

Then add aliases without changing defaults:

- `--asset=BTC`
- `--tenor=weekly`
- `--moneyness=0.05`

# Backward Compatibility Concerns

- Duplicate detection in `runs/index.csv` currently does not include `asset` or `tenor` explicitly. If aliases are added, they must normalize to the same identity as the existing BTC weekly config.
- Existing run paths omit tenor. Automatically switching to names with tenor would cause current analysis scripts to miss historical runs.
- Existing batch paths omit asset and tenor. Batch readers and `.bat` helpers depend on `batch_years_<moneyness>_2020_2026`.
- Existing CSV/JSON schemas use weekly and BTC-specific field names. Renaming them would break:
  - friction analysis,
  - weekly baseline comparison,
  - handoff docs,
  - generated CSV consumers,
  - existing `runs/index.csv`.
- Existing baseline report output is explicitly named `weekly_btc_baseline_comparison.csv`. A generalized report should not overwrite it.
- Current theoretical fallback assumes BTC volatility and BTC premium conversion. Reusing it for ETH/SOL/XRP without asset metadata would silently price with the wrong source.
- Current settlement fallback resolves to `BTC-PERPETUAL`. For non-BTC assets, this would be materially wrong unless parameterized.
- Current Friday expiry logic assumes weekly Friday-to-Friday availability. Biweekly/monthly support should use an expiry-selection policy, not just a larger day count.
- Diagnostic scripts may appear to support option activity checks but are BTC/Friday-specific; they should not be treated as generic validation.

# Recommended Next Steps

1. Add regression checks for current BTC weekly behavior before refactoring:
   - cycle count for known date ranges,
   - first/last cycle boundaries,
   - run name for a known config,
   - batch name for a known moneyness/year range,
   - core summary field presence.

2. Add a small config normalizer:
   - Defaults must reproduce today's `runStrategy({})`.
   - `asset=BTC` and `tenor=weekly` should be explicit in normalized config.
   - Existing `underlyingPriceSource` and `optionSettlementPriceSource` should override asset defaults.

3. Extract BTC asset metadata:
   - Keep only BTC metadata initially.
   - Move settlement mapping, option symbol asset, delivery index, and theoretical vol source behind this metadata.

4. Extract weekly cycle generation:
   - Move current `generateFridayCycles` behavior behind `getCycleSchedule(config)`.
   - Preserve the same function internally for `tenor='weekly'`.
   - Do not add biweekly/monthly selection yet.

5. Add generic aliases while retaining legacy fields:
   - Internally prefer `cycle`, `totalCycles`, `callCycles`, and `underlyingReturnPct`.
   - Continue exporting legacy weekly/BTC fields for current outputs.

6. Create a v2 naming proposal but do not switch defaults:
   - Add helper tests for both legacy and proposed names.
   - Let future multi-asset/multi-tenor runs opt into v2 names after analysis readers are ready.

7. Generalize batch metadata before batch paths:
   - Add `asset`, `tenor`, `moneyness`, `startYear`, and `endYear` to new batch summary metadata.
   - Keep current folder names for BTC weekly until all readers can resolve both old and new naming.

8. Only after the above, implement new tenors/assets one at a time:
   - BTC biweekly first, because asset plumbing remains constant.
   - BTC monthly next, because expiry-selection complexity increases.
   - ETH weekly next, because tenor remains constant while asset metadata changes.
   - SOL/XRP later, after verifying venue data, option symbol conventions, strike grids, and settlement availability.
