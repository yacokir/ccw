const fs = require('fs');
const path = require('path');

const {
  REPO_ROOT,
  OUTPUT_DIR,
  PHASE1_TENORS,
  PHASE1_X_OTM,
  PHASE1_MONEYNESS_LABEL,
  LEFT_TAIL_THRESHOLD_PCT,
  SEVERE_LOSS_THRESHOLD_PCT,
  objectsToCsv,
  optionalNumber,
  roundNumber,
  mean,
  sampleStdDev,
  loadPhase1BaselineItems,
  reconstructHedgedCycles,
  REGIMES
} = require('./btc_hedge_frontier_utils');

const {
  parseDate,
  yearsBetween,
  median,
  percentile,
  pct,
  buildNormalizedEquity,
  drawdownStats,
  compoundReturnPct
} = require('./btc_deep_risk_utils');

const PREFIX = 'btc_ewma_var_hedge_phase1b';
const OUTPUT_COMPARISON_CSV = path.join(OUTPUT_DIR, `${PREFIX}_comparison.csv`);
const OUTPUT_COMPARISON_JSON = path.join(OUTPUT_DIR, `${PREFIX}_comparison.json`);
const OUTPUT_CYCLES_CSV = path.join(OUTPUT_DIR, `${PREFIX}_cycles.csv`);
const OUTPUT_CYCLES_JSON = path.join(OUTPUT_DIR, `${PREFIX}_cycles.json`);
const OUTPUT_ROLLING_CSV = path.join(OUTPUT_DIR, `${PREFIX}_rolling.csv`);
const OUTPUT_ROLLING_JSON = path.join(OUTPUT_DIR, `${PREFIX}_rolling.json`);
const OUTPUT_REGIME_CSV = path.join(OUTPUT_DIR, `${PREFIX}_regime.csv`);
const OUTPUT_REGIME_JSON = path.join(OUTPUT_DIR, `${PREFIX}_regime.json`);
const OUTPUT_DISTRIBUTION_CSV = path.join(OUTPUT_DIR, `${PREFIX}_distribution.csv`);
const OUTPUT_DISTRIBUTION_JSON = path.join(OUTPUT_DIR, `${PREFIX}_distribution.json`);
const OUTPUT_FINDINGS_MD = path.join(OUTPUT_DIR, `${PREFIX}_findings.md`);

const LAMBDAS = [0.90, 0.94];
const RISK_BUDGETS = [0.05, 0.10, 0.15];
const Z_SCORE = 1.65;
const WARMUP_CYCLES = 12;
const BENCHMARK_LABELS = ['h00', 'h10', 'h20', 'h40'];

const COMPARISON_COLUMNS = [
  'asset',
  'tenor',
  'moneyness_label',
  'xOtm',
  'model',
  'lambda',
  'riskBudgetPct',
  'zScore',
  'warmupCycles',
  'strategy_label',
  'source_batch_name',
  'comparison_scope',
  'startYear',
  'endYear',
  'startDate',
  'endDate',
  'cycleCount',
  'hedgedCycleCount',
  'warmupCycleCount',
  'totalReturnPct',
  'cagrPct',
  'maxDrawdownPct',
  'maxDrawdownDurationCycles',
  'averageDrawdownPct',
  'ulcerIndex',
  'returnOverMaxDrawdown',
  'averageCycleReturnPct',
  'volatilityOfCycleReturns',
  'worstCycleReturnPct',
  'bestCycleReturnPct',
  'positiveCyclePct',
  'negativeCyclePct',
  'skewness',
  'excessKurtosis',
  'leftTailFrequencyPct',
  'leftTailThresholdPct',
  'severeLossFrequencyPct',
  'severeLossThresholdPct',
  'averageHedgeRatio',
  'medianHedgeRatio',
  'maxHedgeRatio',
  'averageHedgeRatioPct',
  'medianHedgeRatioPct',
  'maxHedgeRatioPct',
  'pctCyclesHedged',
  'hedgeRatioAbove100PctCycleCount',
  'hedgeRatioAbove100Pct',
  'totalPnlHedge',
  'benchmark_h00_totalReturnPct',
  'benchmark_h00_cagrPct',
  'benchmark_h00_maxDrawdownPct',
  'benchmark_h00_ulcerIndex',
  'benchmark_h00_returnOverMaxDrawdown',
  'delta_vs_h00_totalReturnPct',
  'delta_vs_h00_cagrPct',
  'delta_vs_h00_maxDrawdownPct',
  'delta_vs_h00_ulcerIndex',
  'delta_vs_h10_totalReturnPct',
  'delta_vs_h10_cagrPct',
  'delta_vs_h10_maxDrawdownPct',
  'delta_vs_h10_ulcerIndex',
  'delta_vs_h20_totalReturnPct',
  'delta_vs_h20_cagrPct',
  'delta_vs_h20_maxDrawdownPct',
  'delta_vs_h20_ulcerIndex',
  'delta_vs_h40_totalReturnPct',
  'delta_vs_h40_cagrPct',
  'delta_vs_h40_maxDrawdownPct',
  'delta_vs_h40_ulcerIndex',
  'warnings'
];

const CYCLE_COLUMNS = [
  'asset',
  'tenor',
  'moneyness_label',
  'model',
  'lambda',
  'riskBudgetPct',
  'zScore',
  'strategy_label',
  'source_batch_name',
  'sequence',
  'year',
  'entry_date',
  'exit_date',
  'S_entry',
  'S_exit',
  'btcReturn',
  'btcReturnPct',
  'ewmaVol',
  'ewmaVolPct',
  'VaR_pct',
  'hedgeRatio',
  'hedgeRatioPct',
  'isWarmup',
  'isHedged',
  'capital_before',
  'capital_after',
  'btc_position',
  'hedge_btc',
  'pnl_underlying_unhedged',
  'pnl_call_hedged_path',
  'pnl_hedge',
  'pnl_total_hedged',
  'returnPct',
  'source_cycle_returnPct'
];

const ROLLING_COLUMNS = [
  'asset',
  'tenor',
  'moneyness_label',
  'model',
  'lambda',
  'riskBudgetPct',
  'strategy_label',
  'source_batch_name',
  'comparison_scope',
  'windowCycles',
  'windowStartSequence',
  'windowEndSequence',
  'windowStartDate',
  'windowEndDate',
  'rollingAverageCycleReturnPct',
  'rollingVolatilityPct',
  'rollingDownsideVolatilityPct',
  'rollingDrawdownPct',
  'rollingStabilityPct',
  'windowReturnPct',
  'averageHedgeRatio',
  'maxHedgeRatio',
  'pctCyclesHedged'
];

const REGIME_COLUMNS = [
  'asset',
  'regime',
  'regime_label',
  'regime_start',
  'regime_end',
  'tenor',
  'moneyness_label',
  'model',
  'lambda',
  'riskBudgetPct',
  'strategy_label',
  'source_batch_name',
  'comparison_scope',
  'cycleCount',
  'returnPct',
  'volatilityPct',
  'drawdownPct',
  'ulcerIndex',
  'hitRatePct',
  'averageCycleReturnPct',
  'averageHedgeRatio',
  'medianHedgeRatio',
  'maxHedgeRatio',
  'pctCyclesHedged'
];

const DISTRIBUTION_COLUMNS = [
  'asset',
  'tenor',
  'moneyness_label',
  'model',
  'lambda',
  'riskBudgetPct',
  'strategy_label',
  'source_batch_name',
  'comparison_scope',
  'cycleCount',
  'meanCycleReturnPct',
  'medianCycleReturnPct',
  'stdDevCycleReturnPct',
  'skewness',
  'excessKurtosis',
  'p05CycleReturnPct',
  'p25CycleReturnPct',
  'p75CycleReturnPct',
  'p95CycleReturnPct',
  'leftTailFrequencyPct',
  'leftTailThresholdPct',
  'severeLossFrequencyPct',
  'severeLossThresholdPct'
];

function strategyLabel(tenor, lambda, riskBudget) {
  return `${tenor}_${PHASE1_MONEYNESS_LABEL}_ewma${String(lambda).replace('.', '')}_var${Math.round(riskBudget * 100)}`;
}

function cagrPct(totalReturnPct, startDate, endDate) {
  const years = yearsBetween(startDate, endDate);
  const total = optionalNumber(totalReturnPct);
  if (years === null || years <= 0 || total === null || total <= -100) return null;
  return ((1 + total / 100) ** (1 / years) - 1) * 100;
}

function sampleVariance(values) {
  const sd = sampleStdDev(values);
  return sd === null ? null : sd ** 2;
}

function clampLower(value, lower) {
  return Number.isFinite(value) ? Math.max(lower, value) : lower;
}

function skewness(values) {
  const nums = values.filter(Number.isFinite);
  if (nums.length < 3) return null;
  const avg = mean(nums);
  const sd = sampleStdDev(nums);
  if (!sd) return null;
  const n = nums.length;
  const thirdMoment = nums.reduce((sum, value) => sum + ((value - avg) / sd) ** 3, 0);
  return (n / ((n - 1) * (n - 2))) * thirdMoment;
}

function excessKurtosis(values) {
  const nums = values.filter(Number.isFinite);
  if (nums.length < 4) return null;
  const avg = mean(nums);
  const sd = sampleStdDev(nums);
  if (!sd) return null;
  const n = nums.length;
  const fourthMoment = nums.reduce((sum, value) => sum + ((value - avg) / sd) ** 4, 0);
  return ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * fourthMoment
    - (3 * (n - 1) ** 2) / ((n - 2) * (n - 3));
}

function distributionStats(cycles) {
  const returns = cycles.map(cycle => cycle.returnPct).filter(Number.isFinite);
  return {
    meanCycleReturnPct: mean(returns),
    medianCycleReturnPct: median(returns),
    stdDevCycleReturnPct: sampleStdDev(returns),
    skewness: skewness(returns),
    excessKurtosis: excessKurtosis(returns),
    p05CycleReturnPct: percentile(returns, 0.05),
    p25CycleReturnPct: percentile(returns, 0.25),
    p75CycleReturnPct: percentile(returns, 0.75),
    p95CycleReturnPct: percentile(returns, 0.95),
    leftTailFrequencyPct: pct(returns.filter(value => value <= LEFT_TAIL_THRESHOLD_PCT).length, returns.length),
    leftTailThresholdPct: LEFT_TAIL_THRESHOLD_PCT,
    severeLossFrequencyPct: pct(returns.filter(value => value <= SEVERE_LOSS_THRESHOLD_PCT).length, returns.length),
    severeLossThresholdPct: SEVERE_LOSS_THRESHOLD_PCT
  };
}

function cycleReturnStats(cycles) {
  const returns = cycles.map(cycle => cycle.returnPct).filter(Number.isFinite);
  const negatives = returns.filter(value => value < 0);
  const avg = mean(returns);
  const vol = sampleStdDev(returns);
  return {
    averageCycleReturnPct: avg,
    volatilityOfCycleReturns: vol,
    worstCycleReturnPct: returns.length ? Math.min(...returns) : null,
    bestCycleReturnPct: returns.length ? Math.max(...returns) : null,
    positiveCyclePct: pct(returns.filter(value => value > 0).length, returns.length),
    negativeCyclePct: pct(negatives.length, returns.length)
  };
}

function btcReturnForCycle(cycle) {
  const sEntry = optionalNumber(cycle.S_entry);
  const sExit = optionalNumber(cycle.S_exit);
  if (sEntry === null || sExit === null || sEntry <= 0) return null;
  return sExit / sEntry - 1;
}

function perBtcCallPnl(cycle) {
  const pnlCall = optionalNumber(cycle.pnl_call_hedged_path);
  const btcPosition = optionalNumber(cycle.btc_position);
  if (pnlCall === null || btcPosition === null || btcPosition === 0) return 0;
  return pnlCall / btcPosition;
}

function hedgeRatioFromVol(ewmaVol, riskBudget) {
  const denominator = Z_SCORE * ewmaVol;
  if (!Number.isFinite(denominator) || denominator <= 0) return 0;
  return clampLower(1 - riskBudget / denominator, 0);
}

function reconstructEwmaVarCycles(item, lambda, riskBudget) {
  const baseline = reconstructHedgedCycles(item, 0);
  const sourceCycles = baseline.cycles;
  const warnings = [...baseline.warnings];
  const btcReturns = sourceCycles.map(btcReturnForCycle);
  const warmupReturns = btcReturns.slice(0, WARMUP_CYCLES);
  const warmupAvailable = warmupReturns.length === WARMUP_CYCLES && warmupReturns.every(Number.isFinite);
  const initialVariance = warmupAvailable ? sampleVariance(warmupReturns) : null;
  const rows = [];
  let ewmaVariance = initialVariance;
  let capital = null;

  if (!warmupAvailable || initialVariance === null) {
    warnings.push('warmup_unavailable_or_invalid');
  }

  for (let index = 0; index < sourceCycles.length; index++) {
    const cycle = sourceCycles[index];
    const sEntry = optionalNumber(cycle.S_entry);
    const sExit = optionalNumber(cycle.S_exit);
    if (sEntry === null || sExit === null || sEntry <= 0) {
      warnings.push(`missing_or_invalid_spot_price_cycle_${cycle.sequence}`);
      continue;
    }

    if (capital === null) capital = optionalNumber(cycle.capital_before) ?? sEntry;

    if (index > WARMUP_CYCLES && Number.isFinite(btcReturns[index - 1]) && Number.isFinite(ewmaVariance)) {
      ewmaVariance = lambda * ewmaVariance + (1 - lambda) * btcReturns[index - 1] ** 2;
    }

    const isWarmup = index < WARMUP_CYCLES;
    const ewmaVol = !isWarmup && Number.isFinite(ewmaVariance) ? Math.sqrt(ewmaVariance) : null;
    const varPct = ewmaVol === null ? null : Z_SCORE * ewmaVol * 100;
    const hedgeRatio = isWarmup ? 0 : hedgeRatioFromVol(ewmaVol, riskBudget);
    const capitalBefore = capital;
    const btcPosition = capitalBefore / sEntry;
    const hedgeBtc = hedgeRatio * btcPosition;
    const pnlUnderlying = btcPosition * (sExit - sEntry);
    const pnlCall = btcPosition * perBtcCallPnl(cycle);
    const pnlHedge = -hedgeBtc * (sExit - sEntry);
    const pnlTotal = pnlUnderlying + pnlCall + pnlHedge;
    const capitalAfter = capitalBefore + pnlTotal;
    const returnDecimal = capitalBefore > 0 ? pnlTotal / capitalBefore : null;

    rows.push({
      asset: item.asset,
      tenor: item.tenor,
      moneyness_label: PHASE1_MONEYNESS_LABEL,
      xOtm: PHASE1_X_OTM,
      model: 'ewma_var_cyclical_hedge_phase1b',
      lambda,
      riskBudgetPct: riskBudget * 100,
      zScore: Z_SCORE,
      warmupCycles: WARMUP_CYCLES,
      strategy_label: strategyLabel(item.tenor, lambda, riskBudget),
      source_batch_name: item.summary.batchName,
      comparison_scope: item.comparison_scope,
      sequence: cycle.sequence,
      year: cycle.year,
      entry_date: cycle.entry_date,
      exit_date: cycle.exit_date,
      S_entry: sEntry,
      S_exit: sExit,
      btcReturn: btcReturns[index],
      btcReturnPct: Number.isFinite(btcReturns[index]) ? btcReturns[index] * 100 : null,
      ewmaVol,
      ewmaVolPct: ewmaVol === null ? null : ewmaVol * 100,
      VaR_pct: varPct,
      hedgeRatio,
      hedgeRatioPct: hedgeRatio * 100,
      isWarmup,
      isHedged: hedgeRatio > 0,
      capital_before: capitalBefore,
      capital_after: capitalAfter,
      btc_position: btcPosition,
      hedge_btc: hedgeBtc,
      pnl_underlying_unhedged: pnlUnderlying,
      pnl_call_hedged_path: pnlCall,
      pnl_hedge: pnlHedge,
      pnl_total_hedged: pnlTotal,
      returnDecimal,
      returnPct: returnDecimal === null ? null : returnDecimal * 100,
      source_cycle_returnPct: optionalNumber(cycle.source_cycle_returnPct)
    });

    capital = capitalAfter;
  }

  return { cycles: rows, warnings, initialVariance };
}

function benchmarkKey(tenor, hedgeLabel) {
  return `${tenor}_${hedgeLabel}`;
}

function loadFixedBenchmarks() {
  const benchmarkPath = path.join(OUTPUT_DIR, 'btc_hedge_frontier_phase1_comparison.csv');
  if (!fs.existsSync(benchmarkPath)) return {};
  const { readCsv } = require('./btc_deep_risk_utils');
  const rows = readCsv(benchmarkPath);
  return rows.reduce((acc, row) => {
    const hedgeLabel = row.hedgeLabel;
    if (BENCHMARK_LABELS.includes(hedgeLabel)) {
      acc[benchmarkKey(row.tenor, hedgeLabel)] = row;
    }
    return acc;
  }, {});
}

function benchmarkDeltas(row, benchmarks) {
  const result = {};
  for (const label of BENCHMARK_LABELS) {
    const benchmark = benchmarks[benchmarkKey(row.tenor, label)];
    for (const field of ['totalReturnPct', 'cagrPct', 'maxDrawdownPct', 'ulcerIndex']) {
      const key = `delta_vs_${label}_${field}`;
      result[key] = benchmark ? roundNumber(optionalNumber(row[field]) - optionalNumber(benchmark[field])) : null;
    }
  }

  const h00 = benchmarks[benchmarkKey(row.tenor, 'h00')];
  if (h00) {
    result.benchmark_h00_totalReturnPct = roundNumber(optionalNumber(h00.totalReturnPct));
    result.benchmark_h00_cagrPct = roundNumber(optionalNumber(h00.cagrPct));
    result.benchmark_h00_maxDrawdownPct = roundNumber(optionalNumber(h00.maxDrawdownPct));
    result.benchmark_h00_ulcerIndex = roundNumber(optionalNumber(h00.ulcerIndex));
    result.benchmark_h00_returnOverMaxDrawdown = roundNumber(optionalNumber(h00.returnOverMaxDrawdown));
  }
  return result;
}

function summaryMetrics(item, lambda, riskBudget, cycles, warnings, benchmarks) {
  const validCycles = cycles.filter(cycle => Number.isFinite(cycle.returnDecimal));
  const totalReturnPct = compoundReturnPct(validCycles);
  const equity = buildNormalizedEquity(validCycles);
  const drawdown = drawdownStats(equity);
  const maxDrawdownMagnitude = drawdown.maxDrawdownPct === null ? null : Math.abs(drawdown.maxDrawdownPct);
  const hedgeRatios = validCycles.map(cycle => cycle.hedgeRatio).filter(Number.isFinite);
  const hedgedCycles = validCycles.filter(cycle => cycle.hedgeRatio > 0);
  const above100 = validCycles.filter(cycle => cycle.hedgeRatio > 1);
  const dist = distributionStats(validCycles);
  const cycleStats = cycleReturnStats(validCycles);
  const totalRow = item.totalRow || {};
  const row = {
    asset: item.asset,
    tenor: item.tenor,
    moneyness_label: PHASE1_MONEYNESS_LABEL,
    xOtm: PHASE1_X_OTM,
    model: 'ewma_var_cyclical_hedge_phase1b',
    lambda,
    riskBudgetPct: riskBudget * 100,
    zScore: Z_SCORE,
    warmupCycles: WARMUP_CYCLES,
    strategy_label: strategyLabel(item.tenor, lambda, riskBudget),
    source_batch_name: item.summary.batchName,
    comparison_scope: item.comparison_scope,
    startYear: item.summary.startYear,
    endYear: item.summary.endYear,
    startDate: totalRow.startDate,
    endDate: totalRow.endDate,
    cycleCount: validCycles.length,
    hedgedCycleCount: hedgedCycles.length,
    warmupCycleCount: validCycles.filter(cycle => cycle.isWarmup).length,
    totalReturnPct,
    cagrPct: cagrPct(totalReturnPct, totalRow.startDate, totalRow.endDate),
    maxDrawdownPct: drawdown.maxDrawdownPct,
    maxDrawdownDurationCycles: drawdown.maxDrawdownDurationCycles,
    averageDrawdownPct: drawdown.averageDrawdownPct,
    ulcerIndex: drawdown.ulcerIndex,
    returnOverMaxDrawdown: maxDrawdownMagnitude ? totalReturnPct / maxDrawdownMagnitude : null,
    ...cycleStats,
    ...dist,
    averageHedgeRatio: mean(hedgeRatios),
    medianHedgeRatio: median(hedgeRatios),
    maxHedgeRatio: hedgeRatios.length ? Math.max(...hedgeRatios) : null,
    averageHedgeRatioPct: mean(hedgeRatios) === null ? null : mean(hedgeRatios) * 100,
    medianHedgeRatioPct: median(hedgeRatios) === null ? null : median(hedgeRatios) * 100,
    maxHedgeRatioPct: hedgeRatios.length ? Math.max(...hedgeRatios) * 100 : null,
    pctCyclesHedged: pct(hedgedCycles.length, validCycles.length),
    hedgeRatioAbove100PctCycleCount: above100.length,
    hedgeRatioAbove100Pct: pct(above100.length, validCycles.length),
    totalPnlHedge: validCycles.reduce((sum, cycle) => sum + (optionalNumber(cycle.pnl_hedge) || 0), 0),
    warnings: [...new Set(warnings)]
  };
  return roundRow({ ...row, ...benchmarkDeltas(row, benchmarks) }, COMPARISON_COLUMNS);
}

function windowSizesForTenor(tenor) {
  return tenor === '14d' ? [6, 13, 26] : [13, 26, 52];
}

function compoundPctFromReturns(returns) {
  if (!returns.length) return null;
  return (returns.reduce((product, value) => product * (1 + value / 100), 1) - 1) * 100;
}

function rollingDrawdownPct(returns) {
  let equity = 1;
  let peak = 1;
  let maxDrawdown = 0;
  for (const value of returns) {
    equity *= (1 + value / 100);
    peak = Math.max(peak, equity);
    maxDrawdown = Math.min(maxDrawdown, peak > 0 ? (equity / peak - 1) * 100 : 0);
  }
  return maxDrawdown;
}

function rollingRowsForCycles(cycles) {
  const validCycles = cycles.filter(cycle => Number.isFinite(cycle.returnPct));
  const rows = [];
  const tenor = validCycles[0] ? validCycles[0].tenor : 'weekly';
  for (const windowCycles of windowSizesForTenor(tenor)) {
    if (validCycles.length < windowCycles) continue;
    for (let index = windowCycles - 1; index < validCycles.length; index++) {
      const slice = validCycles.slice(index - windowCycles + 1, index + 1);
      const returns = slice.map(cycle => cycle.returnPct);
      const hedgeRatios = slice.map(cycle => cycle.hedgeRatio).filter(Number.isFinite);
      const first = slice[0];
      const last = slice[slice.length - 1];
      rows.push(roundRow({
        asset: first.asset,
        tenor: first.tenor,
        moneyness_label: first.moneyness_label,
        model: first.model,
        lambda: first.lambda,
        riskBudgetPct: first.riskBudgetPct,
        strategy_label: first.strategy_label,
        source_batch_name: first.source_batch_name,
        comparison_scope: 'full_period',
        windowCycles,
        windowStartSequence: first.sequence,
        windowEndSequence: last.sequence,
        windowStartDate: first.entry_date,
        windowEndDate: last.exit_date,
        rollingAverageCycleReturnPct: mean(returns),
        rollingVolatilityPct: sampleStdDev(returns),
        rollingDownsideVolatilityPct: sampleStdDev(returns.filter(value => value < 0)),
        rollingDrawdownPct: rollingDrawdownPct(returns),
        rollingStabilityPct: pct(returns.filter(value => value > 0).length, returns.length),
        windowReturnPct: compoundPctFromReturns(returns),
        averageHedgeRatio: mean(hedgeRatios),
        maxHedgeRatio: hedgeRatios.length ? Math.max(...hedgeRatios) : null,
        pctCyclesHedged: pct(slice.filter(cycle => cycle.hedgeRatio > 0).length, slice.length)
      }, ROLLING_COLUMNS));
    }
  }
  return rows;
}

function cycleInRegime(cycle, regime) {
  const date = parseDate(cycle.entry_date || cycle.exit_date);
  const start = parseDate(regime.start);
  const end = parseDate(regime.end);
  return date && start && end && date >= start && date <= end;
}

function regimeRowsForCycles(cycles) {
  const rows = [];
  for (const regime of REGIMES) {
    const regimeCycles = cycles.filter(cycle => cycleInRegime(cycle, regime));
    const validCycles = regimeCycles.filter(cycle => Number.isFinite(cycle.returnDecimal));
    if (!validCycles.length) continue;
    const equity = buildNormalizedEquity(validCycles);
    const drawdown = drawdownStats(equity);
    const returns = validCycles.map(cycle => cycle.returnPct).filter(Number.isFinite);
    const hedgeRatios = validCycles.map(cycle => cycle.hedgeRatio).filter(Number.isFinite);
    const first = validCycles[0];
    rows.push(roundRow({
      asset: first.asset,
      regime: regime.name,
      regime_label: regime.label,
      regime_start: regime.start,
      regime_end: regime.end,
      tenor: first.tenor,
      moneyness_label: first.moneyness_label,
      model: first.model,
      lambda: first.lambda,
      riskBudgetPct: first.riskBudgetPct,
      strategy_label: first.strategy_label,
      source_batch_name: first.source_batch_name,
      comparison_scope: 'full_period',
      cycleCount: validCycles.length,
      returnPct: compoundReturnPct(validCycles),
      volatilityPct: sampleStdDev(returns),
      drawdownPct: drawdown.maxDrawdownPct,
      ulcerIndex: drawdown.ulcerIndex,
      hitRatePct: pct(returns.filter(value => value > 0).length, returns.length),
      averageCycleReturnPct: mean(returns),
      averageHedgeRatio: mean(hedgeRatios),
      medianHedgeRatio: median(hedgeRatios),
      maxHedgeRatio: hedgeRatios.length ? Math.max(...hedgeRatios) : null,
      pctCyclesHedged: pct(validCycles.filter(cycle => cycle.hedgeRatio > 0).length, validCycles.length)
    }, REGIME_COLUMNS));
  }
  return rows;
}

function distributionRowForSummary(row) {
  return roundRow({
    asset: row.asset,
    tenor: row.tenor,
    moneyness_label: row.moneyness_label,
    model: row.model,
    lambda: row.lambda,
    riskBudgetPct: row.riskBudgetPct,
    strategy_label: row.strategy_label,
    source_batch_name: row.source_batch_name,
    comparison_scope: row.comparison_scope,
    cycleCount: row.cycleCount,
    meanCycleReturnPct: row.meanCycleReturnPct,
    medianCycleReturnPct: row.medianCycleReturnPct,
    stdDevCycleReturnPct: row.stdDevCycleReturnPct,
    skewness: row.skewness,
    excessKurtosis: row.excessKurtosis,
    p05CycleReturnPct: row.p05CycleReturnPct,
    p25CycleReturnPct: row.p25CycleReturnPct,
    p75CycleReturnPct: row.p75CycleReturnPct,
    p95CycleReturnPct: row.p95CycleReturnPct,
    leftTailFrequencyPct: row.leftTailFrequencyPct,
    leftTailThresholdPct: row.leftTailThresholdPct,
    severeLossFrequencyPct: row.severeLossFrequencyPct,
    severeLossThresholdPct: row.severeLossThresholdPct
  }, DISTRIBUTION_COLUMNS);
}

function roundRow(row, columns = null) {
  const rounded = { ...row };
  const keys = columns || Object.keys(rounded);
  for (const key of keys) {
    if (typeof rounded[key] === 'number') rounded[key] = roundNumber(rounded[key]);
  }
  return rounded;
}

function roundCycleRow(cycle) {
  return roundRow(cycle, CYCLE_COLUMNS);
}

function bestBy(rows, field, direction = 'max') {
  const candidates = rows.filter(row => optionalNumber(row[field]) !== null);
  candidates.sort((a, b) => optionalNumber(a[field]) - optionalNumber(b[field]));
  return direction === 'min' ? candidates[0] : candidates[candidates.length - 1];
}

function buildFindings(comparisonRows) {
  const observations = [];
  const interpretations = [];
  const hypotheses = [];
  const limitations = [];

  for (const tenor of PHASE1_TENORS) {
    const rows = comparisonRows.filter(row => row.tenor === tenor);
    const bestDrawdown = bestBy(rows, 'maxDrawdownPct', 'max');
    const bestCagr = bestBy(rows, 'cagrPct', 'max');
    const highestHedge = bestBy(rows, 'maxHedgeRatio', 'max');
    const lowestUlcer = bestBy(rows, 'ulcerIndex', 'min');
    if (bestDrawdown) observations.push(`${tenor}: shallowest EWMA/VaR max drawdown is ${bestDrawdown.strategy_label} at ${bestDrawdown.maxDrawdownPct}%.`);
    if (lowestUlcer) observations.push(`${tenor}: lowest EWMA/VaR ulcer index is ${lowestUlcer.strategy_label} at ${lowestUlcer.ulcerIndex}.`);
    if (bestCagr) observations.push(`${tenor}: highest EWMA/VaR CAGR is ${bestCagr.strategy_label} at ${bestCagr.cagrPct}%.`);
    if (highestHedge) observations.push(`${tenor}: highest observed hedge ratio is ${highestHedge.maxHedgeRatioPct}% in ${highestHedge.strategy_label}.`);
  }

  const above100 = comparisonRows.reduce((sum, row) => sum + (optionalNumber(row.hedgeRatioAbove100PctCycleCount) || 0), 0);
  observations.push(`Across all EWMA/VaR variants, hedge ratios above 100% occurred in ${above100} cycle rows.`);

  interpretations.push('EWMA/VaR Phase 1B is a cyclical sizing model: it sets the hedge ratio at the CCW roll and holds it fixed until the next roll.');
  interpretations.push('Lower risk budgets should generally imply more frequent or larger hedges, but the realized benefit depends on whether the volatility estimate rises before or after the damaging BTC move.');
  interpretations.push('Comparison against fixed h10, h20, and h40 benchmarks should be read as a benchmark test of adaptive sizing, not as a production hedge recommendation.');

  hypotheses.push('If EWMA/VaR improves drawdown or ulcer index versus h00 without excessive return drag versus h10/h20, it may justify a funding-aware Phase 2.');
  hypotheses.push('If EWMA/VaR lags major BTC drawdowns, lower lambda values or stressed volatility inputs may need study before considering more complex tail models.');
  hypotheses.push('If no-hard-cap hedge ratios become operationally large, a later version should test explicit hedge caps and margin constraints.');

  limitations.push('Normal VaR likely underestimates BTC tail risk and should be treated as a transparent first-pass sizing tool only.');
  limitations.push('EWMA/VaR is a sizing model, not a guarantee that realized cycle losses stay within the selected risk budget.');
  limitations.push('Funding, basis, liquidation, margin, collateral, slippage, and stressed liquidity are not modeled.');
  limitations.push('The hedge has no intracycle adjustment and no emergency hedge behavior.');
  limitations.push('There is no hard hedge cap in this version; hedge ratios above 100%, if observed, are diagnostic outputs rather than automatically valid live trading behavior.');

  return { observations, interpretations, hypotheses, limitations };
}

function buildMarkdown(analysis) {
  return [
    '# BTC EWMA/VaR Hedge Phase 1B Findings',
    '',
    `Generated: ${analysis.generatedAt}`,
    '',
    '## Scope',
    '',
    '- Analysis-only post-processing of existing BTC CCW OTM10 weekly and 14d baseline runs.',
    '- EWMA volatility uses BTC cycle returns, not CCW strategy returns.',
    '- Hedge ratio is calculated at cycle entry / CCW roll and remains fixed until the next roll.',
    '- No baseline backtests were rerun and no execution logic was changed.',
    '',
    '## Methodology',
    '',
    `- Lambdas: ${LAMBDAS.join(', ')}.`,
    `- Risk budgets: ${RISK_BUDGETS.map(value => `${value * 100}%`).join(', ')}.`,
    `- VaR multiplier: z = ${Z_SCORE}.`,
    `- Warm-up: first ${WARMUP_CYCLES} BTC cycle returns initialize sample variance; no EWMA/VaR hedge is applied during warm-up.`,
    '- Hedge ratio: `1 - maxLossBudgetPct / (z * ewmaVol)`, lower-bounded at zero with no hard maximum cap.',
    '',
    '## Observations',
    '',
    analysis.findings.observations.map(item => `- ${item}`).join('\n'),
    '',
    '## Interpretations',
    '',
    analysis.findings.interpretations.map(item => `- ${item}`).join('\n'),
    '',
    '## Hypotheses',
    '',
    analysis.findings.hypotheses.map(item => `- ${item}`).join('\n'),
    '',
    '## Limitations',
    '',
    analysis.findings.limitations.map(item => `- ${item}`).join('\n'),
    ''
  ].join('\n');
}

function buildAnalysis() {
  const startedAt = Date.now();
  const { items, skipped } = loadPhase1BaselineItems();
  const benchmarks = loadFixedBenchmarks();
  const comparisonRows = [];
  const cycleRows = [];
  const rollingRows = [];
  const regimeRows = [];
  const distributionRows = [];

  for (const item of items) {
    for (const lambda of LAMBDAS) {
      for (const riskBudget of RISK_BUDGETS) {
        const reconstructed = reconstructEwmaVarCycles(item, lambda, riskBudget);
        const summary = summaryMetrics(item, lambda, riskBudget, reconstructed.cycles, reconstructed.warnings, benchmarks);
        comparisonRows.push(summary);
        cycleRows.push(...reconstructed.cycles.map(roundCycleRow));
        rollingRows.push(...rollingRowsForCycles(reconstructed.cycles));
        regimeRows.push(...regimeRowsForCycles(reconstructed.cycles));
        distributionRows.push(distributionRowForSummary(summary));
      }
    }
  }

  comparisonRows.sort((a, b) => (
    PHASE1_TENORS.indexOf(a.tenor) - PHASE1_TENORS.indexOf(b.tenor)
    || a.lambda - b.lambda
    || a.riskBudgetPct - b.riskBudgetPct
  ));

  const generatedAt = new Date().toISOString();
  const hedgeRatioAboveOneRows = cycleRows.filter(row => optionalNumber(row.hedgeRatio) > 1);
  const findings = buildFindings(comparisonRows);

  return {
    generatedAt,
    runtimeMs: Date.now() - startedAt,
    inputs: {
      source: 'runs/batches/**/summary.json and referenced annual trades.csv files',
      baselineFilter: 'BTC, weekly/14d, OTM10, full-period 2020-2026 batches',
      fixedBenchmarks: 'analysis/generated/btc_hedge_frontier_phase1_comparison.csv'
    },
    methodology: {
      model: 'EWMA/VaR cyclical short BTC futures/perpetual proxy',
      ewma: 'Classic recursive EWMA over BTC cycle returns with first 12 BTC cycle returns used as initial sample variance.',
      warmup: `No EWMA/VaR hedge is applied for the first ${WARMUP_CYCLES} cycles. Cycle ${WARMUP_CYCLES + 1} uses the initialized variance.`,
      update: 'ewmaVar_t = lambda * ewmaVar_{t-1} + (1 - lambda) * btcReturn_{t-1}^2 after the first post-warm-up cycle.',
      var: `VaR_pct = ${Z_SCORE} * ewmaVol * 100.`,
      hedgeRatio: 'hedgeRatio = max(0, 1 - maxLossBudgetPct / (z * ewmaVol)); no hard maximum cap in Phase 1B.',
      exclusions: [
        'baseline backtest rerun',
        'execution-engine changes',
        'intracycle adjustment',
        'emergency hedge',
        'daily volatility',
        'funding',
        'basis',
        'liquidation and margin',
        'slippage'
      ],
      tailThresholds: {
        leftTailThresholdPct: LEFT_TAIL_THRESHOLD_PCT,
        severeLossThresholdPct: SEVERE_LOSS_THRESHOLD_PCT
      }
    },
    validation: {
      tenors: PHASE1_TENORS,
      lambdas: LAMBDAS,
      riskBudgetsPct: RISK_BUDGETS.map(value => value * 100),
      variantCount: comparisonRows.length,
      expectedVariantCount: PHASE1_TENORS.length * LAMBDAS.length * RISK_BUDGETS.length,
      cycleRowCount: cycleRows.length,
      rollingRowCount: rollingRows.length,
      regimeRowCount: regimeRows.length,
      distributionRowCount: distributionRows.length,
      warmupCycles: WARMUP_CYCLES,
      hedgeRatioAboveOneRowCount: hedgeRatioAboveOneRows.length,
      hedgeRatioAboveOneMax: hedgeRatioAboveOneRows.length
        ? Math.max(...hedgeRatioAboveOneRows.map(row => optionalNumber(row.hedgeRatio)).filter(Number.isFinite))
        : null,
      fixedBenchmarksReadOnly: true,
      baselineBacktestsRerun: false,
      executionLogicChanged: false,
      skipped
    },
    findings,
    rows: comparisonRows,
    cycleRows,
    rollingRows,
    regimeRows,
    distributionRows
  };
}

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function writeAnalysis(analysis) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_COMPARISON_CSV, `${objectsToCsv(analysis.rows, COMPARISON_COLUMNS)}\n`, 'utf8');
  writeJson(OUTPUT_COMPARISON_JSON, analysis);
  fs.writeFileSync(OUTPUT_CYCLES_CSV, `${objectsToCsv(analysis.cycleRows, CYCLE_COLUMNS)}\n`, 'utf8');
  writeJson(OUTPUT_CYCLES_JSON, {
    generatedAt: analysis.generatedAt,
    methodology: analysis.methodology,
    validation: analysis.validation,
    rows: analysis.cycleRows
  });
  fs.writeFileSync(OUTPUT_ROLLING_CSV, `${objectsToCsv(analysis.rollingRows, ROLLING_COLUMNS)}\n`, 'utf8');
  writeJson(OUTPUT_ROLLING_JSON, {
    generatedAt: analysis.generatedAt,
    methodology: analysis.methodology,
    validation: analysis.validation,
    rows: analysis.rollingRows
  });
  fs.writeFileSync(OUTPUT_REGIME_CSV, `${objectsToCsv(analysis.regimeRows, REGIME_COLUMNS)}\n`, 'utf8');
  writeJson(OUTPUT_REGIME_JSON, {
    generatedAt: analysis.generatedAt,
    methodology: analysis.methodology,
    validation: analysis.validation,
    rows: analysis.regimeRows
  });
  fs.writeFileSync(OUTPUT_DISTRIBUTION_CSV, `${objectsToCsv(analysis.distributionRows, DISTRIBUTION_COLUMNS)}\n`, 'utf8');
  writeJson(OUTPUT_DISTRIBUTION_JSON, {
    generatedAt: analysis.generatedAt,
    methodology: analysis.methodology,
    validation: analysis.validation,
    rows: analysis.distributionRows
  });
  fs.writeFileSync(OUTPUT_FINDINGS_MD, buildMarkdown(analysis), 'utf8');
}

function main() {
  const analysis = buildAnalysis();
  writeAnalysis(analysis);

  console.log(`Generated ${analysis.validation.variantCount} EWMA/VaR variants`);
  console.log(`Expected variants: ${analysis.validation.expectedVariantCount}`);
  console.log(`Cycle rows: ${analysis.validation.cycleRowCount}`);
  console.log(`Hedge ratio > 1 rows: ${analysis.validation.hedgeRatioAboveOneRowCount}`);
  console.log(`Runtime ms: ${analysis.runtimeMs}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_COMPARISON_CSV)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_COMPARISON_JSON)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_CYCLES_CSV)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_CYCLES_JSON)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_ROLLING_CSV)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_ROLLING_JSON)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_REGIME_CSV)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_REGIME_JSON)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_DISTRIBUTION_CSV)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_DISTRIBUTION_JSON)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_FINDINGS_MD)}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('Error building BTC EWMA/VaR hedge Phase 1B:', error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  buildAnalysis,
  writeAnalysis,
  reconstructEwmaVarCycles
};
