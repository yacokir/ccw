const path = require('path');

const {
  REPO_ROOT,
  OUTPUT_DIR,
  BATCHES_DIR,
  readJson,
  readCsv,
  objectsToCsv,
  optionalNumber,
  roundNumber,
  parseDate,
  yearsBetween,
  mean,
  median,
  sampleStdDev,
  percentile,
  pct,
  loadBtcBatchItems,
  buildNormalizedEquity,
  drawdownStats,
  compoundReturnPct
} = require('./btc_deep_risk_utils');

const PHASE1_TENORS = ['weekly', '14d'];
const PHASE1_X_OTM = 0.10;
const PHASE1_MONEYNESS_LABEL = 'otm10';
const PHASE1_HEDGE_RATIOS = [0, 0.1, 0.2, 0.3, 0.4];
const LEFT_TAIL_THRESHOLD_PCT = -5;
const SEVERE_LOSS_THRESHOLD_PCT = -10;

const REGIMES = [
  { label: 'bull_2020_2021', name: 'Bull', start: '2020-01-01', end: '2021-12-31T23:59:59Z' },
  { label: 'bear_2022', name: 'Bear', start: '2022-01-01', end: '2022-12-31T23:59:59Z' },
  { label: 'recovery_transition_2023', name: 'Recovery/transition', start: '2023-01-01', end: '2023-12-31T23:59:59Z' },
  { label: 'etf_bull_2024_2025', name: 'ETF/bull regime', start: '2024-01-01', end: '2025-12-31T23:59:59Z' }
];

function hedgeLabel(hedgeRatio) {
  return `h${String(Math.round(hedgeRatio * 100)).padStart(2, '0')}`;
}

function strategyLabel(tenor, hedgeRatio) {
  return `${tenor}_${PHASE1_MONEYNESS_LABEL}_${hedgeLabel(hedgeRatio)}`;
}

function isPhase1Baseline(item) {
  return (
    item.asset === 'BTC'
    && PHASE1_TENORS.includes(item.tenor)
    && Math.abs(optionalNumber(item.xOtm) - PHASE1_X_OTM) < 1e-9
    && item.comparison_scope === 'full_period'
  );
}

function loadPhase1BaselineItems() {
  const { items, skipped } = loadBtcBatchItems();
  const phase1Items = items
    .filter(isPhase1Baseline)
    .sort((a, b) => PHASE1_TENORS.indexOf(a.tenor) - PHASE1_TENORS.indexOf(b.tenor));

  return { items: phase1Items, skipped };
}

function perBtcCallPnl(trade) {
  const pnlCall = optionalNumber(trade.pnl_call);
  const btcPosition = optionalNumber(trade.btc_position);
  if (pnlCall === null || btcPosition === null || btcPosition === 0) return 0;
  return pnlCall / btcPosition;
}

function resolveRunPath(batchDir, annualResult) {
  const savedRun = annualResult.savedRun || {};
  const rawRunPath = savedRun.runPath || savedRun.existingRunPath || savedRun.runName || savedRun.existingRunName;
  if (!rawRunPath) return null;
  if (path.isAbsolute(rawRunPath)) return rawRunPath;
  if (rawRunPath.startsWith('runs/') || rawRunPath.startsWith('runs\\')) {
    return path.join(REPO_ROOT, rawRunPath);
  }
  return path.resolve(batchDir, '..', '..', rawRunPath);
}

function tradeReturn(trade) {
  const explicit = optionalNumber(trade.return_pct);
  if (explicit !== null) return explicit;
  const before = optionalNumber(trade.capital_before);
  const after = optionalNumber(trade.capital_after);
  if (before !== null && after !== null && before !== 0) return after / before - 1;
  return null;
}

function loadRawCyclesForBatch(item) {
  const cycles = [];
  const warnings = [];
  const annualResults = (item.summary.annualResults || [])
    .filter(result => Number.isInteger(Number(result.year)))
    .sort((a, b) => Number(a.year) - Number(b.year));

  for (const annualResult of annualResults) {
    const runPath = resolveRunPath(item.batchDir, annualResult);
    if (!runPath) {
      warnings.push(`missing_run_path_for_${annualResult.year}`);
      continue;
    }

    const tradesPath = path.join(runPath, 'trades.csv');
    if (!require('fs').existsSync(tradesPath)) {
      warnings.push(`missing_trades_csv_for_${annualResult.year}`);
      continue;
    }

    const trades = readCsv(tradesPath);
    trades.forEach((trade, index) => {
      const returnDecimal = tradeReturn(trade);
      cycles.push({
        ...trade,
        source_batch_name: item.summary.batchName,
        run_name: path.basename(runPath),
        year: Number(annualResult.year),
        sequence: cycles.length + 1,
        cycle_in_run: optionalNumber(trade.cycle) ?? index + 1,
        returnDecimal,
        returnPct: returnDecimal === null ? null : returnDecimal * 100,
        pnl_call: optionalNumber(trade.pnl_call),
        pnl_underlying: optionalNumber(trade.pnl_underlying),
        pnl_total: optionalNumber(trade.pnl_total),
        capital_before: optionalNumber(trade.capital_before),
        capital_after: optionalNumber(trade.capital_after),
        btc_position: optionalNumber(trade.btc_position),
        S_entry: optionalNumber(trade.S_entry),
        S_exit: optionalNumber(trade.S_exit),
        C_entry: optionalNumber(trade.C_entry),
        has_call: String(trade.has_call).toLowerCase() === 'true'
      });
    });
  }

  cycles.sort((a, b) => {
    const aDate = parseDate(a.entry_date);
    const bDate = parseDate(b.entry_date);
    if (aDate && bDate && aDate.getTime() !== bDate.getTime()) return aDate - bDate;
    return a.sequence - b.sequence;
  });

  cycles.forEach((cycle, index) => {
    cycle.sequence = index + 1;
  });

  return { cycles, warnings };
}

function initialCapitalForFirstCycle(trade) {
  const sEntry = optionalNumber(trade.S_entry);
  const cEntry = optionalNumber(trade.C_entry);
  const hasCall = String(trade.has_call).toLowerCase() === 'true';
  if (sEntry === null) return optionalNumber(trade.capital_before) ?? 0;
  return hasCall && cEntry !== null ? sEntry - cEntry * sEntry : sEntry;
}

function reconstructHedgedCycles(item, hedgeRatio) {
  const { cycles, warnings } = loadRawCyclesForBatch(item);
  const rows = [];
  let capital = null;

  for (const cycle of cycles) {
    const sEntry = optionalNumber(cycle.S_entry);
    const sExit = optionalNumber(cycle.S_exit);
    const sourceCapitalBefore = optionalNumber(cycle.capital_before);

    if (sEntry === null || sExit === null || sEntry <= 0) {
      warnings.push(`missing_or_invalid_spot_price_cycle_${cycle.sequence}`);
      continue;
    }

    if (capital === null) {
      capital = hedgeRatio === 0 && sourceCapitalBefore !== null
        ? sourceCapitalBefore
        : initialCapitalForFirstCycle(cycle);
    }

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
      ...cycle,
      asset: item.asset,
      tenor: item.tenor,
      moneyness_label: PHASE1_MONEYNESS_LABEL,
      xOtm: PHASE1_X_OTM,
      hedgeRatio,
      hedgeLabel: hedgeLabel(hedgeRatio),
      hedgeRatioPct: hedgeRatio * 100,
      strategy_label: strategyLabel(item.tenor, hedgeRatio),
      source_batch_name: item.summary.batchName,
      source_cycle_returnPct: optionalNumber(cycle.returnPct),
      source_capital_before: sourceCapitalBefore,
      source_capital_after: optionalNumber(cycle.capital_after),
      capital_before: capitalBefore,
      capital_after: capitalAfter,
      btc_position: btcPosition,
      hedge_btc: hedgeBtc,
      pnl_underlying_unhedged: pnlUnderlying,
      pnl_call_hedged_path: pnlCall,
      pnl_hedge: pnlHedge,
      pnl_total_hedged: pnlTotal,
      returnDecimal,
      returnPct: returnDecimal === null ? null : returnDecimal * 100
    });

    capital = capitalAfter;
  }

  return { cycles: rows, warnings };
}

function cagrPct(totalReturnPct, startDate, endDate) {
  const years = yearsBetween(startDate, endDate);
  const total = optionalNumber(totalReturnPct);
  if (years === null || years <= 0 || total === null || total <= -100) return null;
  return ((1 + total / 100) ** (1 / years) - 1) * 100;
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
  const leftTailThreshold = LEFT_TAIL_THRESHOLD_PCT;
  const severeLossThreshold = SEVERE_LOSS_THRESHOLD_PCT;

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
    leftTailFrequencyPct: pct(returns.filter(value => value <= leftTailThreshold).length, returns.length),
    leftTailThresholdPct: leftTailThreshold,
    severeLossFrequencyPct: pct(returns.filter(value => value <= severeLossThreshold).length, returns.length),
    severeLossThresholdPct: severeLossThreshold
  };
}

function cycleReturnStats(cycles) {
  const returns = cycles.map(cycle => cycle.returnPct).filter(Number.isFinite);
  const negativeReturns = returns.filter(value => value < 0);
  const avg = mean(returns);
  const vol = sampleStdDev(returns);
  const downsideVol = sampleStdDev(negativeReturns);

  return {
    averageCycleReturnPct: avg,
    volatilityOfCycleReturns: vol,
    downsideVolatility: downsideVol,
    SharpeSimple: vol ? avg / vol : null,
    SortinoSimple: downsideVol ? avg / downsideVol : null,
    worstCycleReturnPct: returns.length ? Math.min(...returns) : null,
    bestCycleReturnPct: returns.length ? Math.max(...returns) : null,
    positiveCyclePct: pct(returns.filter(value => value > 0).length, returns.length),
    negativeCyclePct: pct(negativeReturns.length, returns.length)
  };
}

function summaryMetrics(item, hedgeRatio, cycles, warnings = []) {
  const validCycles = cycles.filter(cycle => Number.isFinite(cycle.returnDecimal));
  const equity = buildNormalizedEquity(validCycles);
  const drawdown = drawdownStats(equity);
  const totalReturnPct = compoundReturnPct(validCycles);
  const totalRow = item.totalRow || {};
  const maxDrawdownMagnitude = drawdown.maxDrawdownPct === null ? null : Math.abs(drawdown.maxDrawdownPct);
  const dist = distributionStats(validCycles);
  const cycleStats = cycleReturnStats(validCycles);

  return {
    asset: item.asset,
    tenor: item.tenor,
    moneyness_label: PHASE1_MONEYNESS_LABEL,
    xOtm: PHASE1_X_OTM,
    hedgeLabel: hedgeLabel(hedgeRatio),
    hedgeRatio,
    hedgeRatioPct: hedgeRatio * 100,
    strategy_label: strategyLabel(item.tenor, hedgeRatio),
    source_batch_name: item.summary.batchName,
    comparison_scope: item.comparison_scope,
    startYear: item.summary.startYear,
    endYear: item.summary.endYear,
    startDate: totalRow.startDate,
    endDate: totalRow.endDate,
    cycleCount: validCycles.length,
    totalReturnPct,
    cagrPct: cagrPct(totalReturnPct, totalRow.startDate, totalRow.endDate),
    maxDrawdownPct: drawdown.maxDrawdownPct,
    maxDrawdownDurationCycles: drawdown.maxDrawdownDurationCycles,
    averageDrawdownPct: drawdown.averageDrawdownPct,
    ulcerIndex: drawdown.ulcerIndex,
    returnOverMaxDrawdown: maxDrawdownMagnitude ? totalReturnPct / maxDrawdownMagnitude : null,
    ...cycleStats,
    ...dist,
    totalPnlHedge: validCycles.reduce((sum, cycle) => sum + (optionalNumber(cycle.pnl_hedge) || 0), 0),
    averageHedgeBtc: mean(validCycles.map(cycle => optionalNumber(cycle.hedge_btc)).filter(Number.isFinite)),
    warnings
  };
}

function roundSummaryRow(row) {
  const rounded = { ...row };
  [
    'xOtm', 'hedgeRatio', 'hedgeRatioPct', 'totalReturnPct', 'cagrPct', 'maxDrawdownPct',
    'averageDrawdownPct', 'ulcerIndex', 'returnOverMaxDrawdown', 'averageCycleReturnPct',
    'volatilityOfCycleReturns', 'downsideVolatility', 'SharpeSimple', 'SortinoSimple',
    'worstCycleReturnPct', 'bestCycleReturnPct', 'positiveCyclePct', 'negativeCyclePct',
    'meanCycleReturnPct', 'medianCycleReturnPct', 'stdDevCycleReturnPct', 'skewness',
    'excessKurtosis', 'p05CycleReturnPct', 'p25CycleReturnPct', 'p75CycleReturnPct',
    'p95CycleReturnPct', 'leftTailFrequencyPct', 'leftTailThresholdPct',
    'severeLossFrequencyPct', 'severeLossThresholdPct', 'totalPnlHedge', 'averageHedgeBtc'
  ].forEach(key => {
    if (Object.prototype.hasOwnProperty.call(rounded, key)) {
      rounded[key] = roundNumber(rounded[key]);
    }
  });
  return rounded;
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

  for (const windowCycles of windowSizesForTenor(validCycles[0] ? validCycles[0].tenor : 'weekly')) {
    if (validCycles.length < windowCycles) continue;
    for (let index = windowCycles - 1; index < validCycles.length; index++) {
      const slice = validCycles.slice(index - windowCycles + 1, index + 1);
      const returns = slice.map(cycle => cycle.returnPct);
      const negativeReturns = returns.filter(value => value < 0);
      const first = slice[0];
      const last = slice[slice.length - 1];
      rows.push({
        asset: first.asset,
        tenor: first.tenor,
        moneyness_label: first.moneyness_label,
        hedgeLabel: first.hedgeLabel,
        hedgeRatio: roundNumber(first.hedgeRatio),
        hedgeRatioPct: roundNumber(first.hedgeRatioPct),
        strategy_label: first.strategy_label,
        source_batch_name: first.source_batch_name,
        comparison_scope: 'full_period',
        windowCycles,
        windowStartSequence: first.sequence,
        windowEndSequence: last.sequence,
        windowStartDate: first.entry_date,
        windowEndDate: last.exit_date,
        rollingAverageCycleReturnPct: roundNumber(mean(returns)),
        rollingVolatilityPct: roundNumber(sampleStdDev(returns)),
        rollingDownsideVolatilityPct: roundNumber(sampleStdDev(negativeReturns)),
        rollingDrawdownPct: roundNumber(rollingDrawdownPct(returns)),
        rollingStabilityPct: roundNumber(pct(returns.filter(value => value > 0).length, returns.length)),
        windowReturnPct: roundNumber(compoundPctFromReturns(returns))
      });
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
    if (!regimeCycles.length) continue;
    const validCycles = regimeCycles.filter(cycle => Number.isFinite(cycle.returnDecimal));
    const equity = buildNormalizedEquity(validCycles);
    const drawdown = drawdownStats(equity);
    const returns = validCycles.map(cycle => cycle.returnPct).filter(Number.isFinite);
    const first = validCycles[0] || cycles[0];
    rows.push({
      asset: first.asset,
      regime: regime.name,
      regime_label: regime.label,
      regime_start: regime.start,
      regime_end: regime.end,
      tenor: first.tenor,
      moneyness_label: first.moneyness_label,
      hedgeLabel: first.hedgeLabel,
      hedgeRatio: roundNumber(first.hedgeRatio),
      hedgeRatioPct: roundNumber(first.hedgeRatioPct),
      strategy_label: first.strategy_label,
      source_batch_name: first.source_batch_name,
      comparison_scope: 'full_period',
      cycleCount: validCycles.length,
      returnPct: roundNumber(compoundReturnPct(validCycles)),
      volatilityPct: roundNumber(sampleStdDev(returns)),
      drawdownPct: roundNumber(drawdown.maxDrawdownPct),
      ulcerIndex: roundNumber(drawdown.ulcerIndex),
      hitRatePct: roundNumber(pct(returns.filter(value => value > 0).length, returns.length)),
      averageCycleReturnPct: roundNumber(mean(returns))
    });
  }
  return rows;
}

function buildPhase1HedgeDataset() {
  const { items, skipped } = loadPhase1BaselineItems();
  const variants = [];
  const cycles = [];
  const rolling = [];
  const regimes = [];

  for (const item of items) {
    for (const hedgeRatio of PHASE1_HEDGE_RATIOS) {
      const reconstructed = reconstructHedgedCycles(item, hedgeRatio);
      const warnings = [...new Set(reconstructed.warnings)];
      const summary = roundSummaryRow(summaryMetrics(item, hedgeRatio, reconstructed.cycles, warnings));
      variants.push(summary);
      cycles.push(...reconstructed.cycles.map(cycle => ({
        asset: cycle.asset,
        tenor: cycle.tenor,
        moneyness_label: cycle.moneyness_label,
        hedgeLabel: cycle.hedgeLabel,
        hedgeRatio: roundNumber(cycle.hedgeRatio),
        hedgeRatioPct: roundNumber(cycle.hedgeRatioPct),
        strategy_label: cycle.strategy_label,
        source_batch_name: cycle.source_batch_name,
        sequence: cycle.sequence,
        year: cycle.year,
        entry_date: cycle.entry_date,
        exit_date: cycle.exit_date,
        S_entry: roundNumber(cycle.S_entry),
        S_exit: roundNumber(cycle.S_exit),
        capital_before: roundNumber(cycle.capital_before),
        capital_after: roundNumber(cycle.capital_after),
        btc_position: roundNumber(cycle.btc_position),
        hedge_btc: roundNumber(cycle.hedge_btc),
        pnl_underlying_unhedged: roundNumber(cycle.pnl_underlying_unhedged),
        pnl_call_hedged_path: roundNumber(cycle.pnl_call_hedged_path),
        pnl_hedge: roundNumber(cycle.pnl_hedge),
        pnl_total_hedged: roundNumber(cycle.pnl_total_hedged),
        returnPct: roundNumber(cycle.returnPct),
        source_cycle_returnPct: roundNumber(cycle.source_cycle_returnPct)
      })));
      rolling.push(...rollingRowsForCycles(reconstructed.cycles));
      regimes.push(...regimeRowsForCycles(reconstructed.cycles));
    }
  }

  variants.sort((a, b) => (
    PHASE1_TENORS.indexOf(a.tenor) - PHASE1_TENORS.indexOf(b.tenor)
    || a.hedgeRatio - b.hedgeRatio
  ));

  return {
    items,
    skipped,
    variants,
    cycles,
    rolling,
    regimes
  };
}

module.exports = {
  REPO_ROOT,
  OUTPUT_DIR,
  BATCHES_DIR,
  PHASE1_TENORS,
  PHASE1_X_OTM,
  PHASE1_MONEYNESS_LABEL,
  PHASE1_HEDGE_RATIOS,
  LEFT_TAIL_THRESHOLD_PCT,
  SEVERE_LOSS_THRESHOLD_PCT,
  REGIMES,
  objectsToCsv,
  optionalNumber,
  roundNumber,
  mean,
  sampleStdDev,
  hedgeLabel,
  strategyLabel,
  loadPhase1BaselineItems,
  reconstructHedgedCycles,
  distributionStats,
  rollingRowsForCycles,
  regimeRowsForCycles,
  buildPhase1HedgeDataset
};
