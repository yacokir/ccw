const fs = require('fs');
const path = require('path');

const {
  REPO_ROOT,
  OUTPUT_DIR,
  PHASE1_TENORS,
  PHASE1_HEDGE_RATIOS,
  LEFT_TAIL_THRESHOLD_PCT,
  SEVERE_LOSS_THRESHOLD_PCT,
  objectsToCsv,
  optionalNumber,
  roundNumber,
  buildPhase1HedgeDataset
} = require('./btc_hedge_frontier_utils');

const OUTPUT_COMPARISON_CSV = path.join(OUTPUT_DIR, 'btc_hedge_frontier_phase1_comparison.csv');
const OUTPUT_COMPARISON_JSON = path.join(OUTPUT_DIR, 'btc_hedge_frontier_phase1_comparison.json');
const OUTPUT_CYCLES_CSV = path.join(OUTPUT_DIR, 'btc_hedge_frontier_phase1_cycles.csv');
const OUTPUT_ROLLING_CSV = path.join(OUTPUT_DIR, 'btc_hedge_frontier_phase1_rolling.csv');
const OUTPUT_ROLLING_JSON = path.join(OUTPUT_DIR, 'btc_hedge_frontier_phase1_rolling.json');
const OUTPUT_REGIME_CSV = path.join(OUTPUT_DIR, 'btc_hedge_frontier_phase1_regime.csv');
const OUTPUT_REGIME_JSON = path.join(OUTPUT_DIR, 'btc_hedge_frontier_phase1_regime.json');
const OUTPUT_DISTRIBUTION_CSV = path.join(OUTPUT_DIR, 'btc_hedge_frontier_phase1_distribution.csv');
const OUTPUT_FINDINGS_MD = path.join(OUTPUT_DIR, 'btc_hedge_frontier_phase1_findings.md');
const OUTPUT_FINDINGS_JSON = path.join(OUTPUT_DIR, 'btc_hedge_frontier_phase1_findings.json');

const COMPARISON_COLUMNS = [
  'asset',
  'tenor',
  'moneyness_label',
  'xOtm',
  'hedgeLabel',
  'hedgeRatio',
  'hedgeRatioPct',
  'strategy_label',
  'source_batch_name',
  'comparison_scope',
  'startYear',
  'endYear',
  'startDate',
  'endDate',
  'cycleCount',
  'totalReturnPct',
  'cagrPct',
  'maxDrawdownPct',
  'maxDrawdownDurationCycles',
  'averageDrawdownPct',
  'ulcerIndex',
  'returnOverMaxDrawdown',
  'averageCycleReturnPct',
  'volatilityOfCycleReturns',
  'downsideVolatility',
  'SharpeSimple',
  'SortinoSimple',
  'worstCycleReturnPct',
  'bestCycleReturnPct',
  'positiveCyclePct',
  'negativeCyclePct',
  'leftTailFrequencyPct',
  'leftTailThresholdPct',
  'severeLossFrequencyPct',
  'severeLossThresholdPct',
  'totalPnlHedge',
  'averageHedgeBtc',
  'totalReturnDeltaPct',
  'cagrDeltaPct',
  'maxDrawdownDeltaPct',
  'ulcerDelta',
  'severeLossFrequencyDeltaPct',
  'leftTailFrequencyDeltaPct',
  'warnings'
];

const CYCLE_COLUMNS = [
  'asset',
  'tenor',
  'moneyness_label',
  'hedgeLabel',
  'hedgeRatio',
  'hedgeRatioPct',
  'strategy_label',
  'source_batch_name',
  'sequence',
  'year',
  'entry_date',
  'exit_date',
  'S_entry',
  'S_exit',
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
  'hedgeLabel',
  'hedgeRatio',
  'hedgeRatioPct',
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
  'windowReturnPct'
];

const REGIME_COLUMNS = [
  'asset',
  'regime',
  'regime_label',
  'regime_start',
  'regime_end',
  'tenor',
  'moneyness_label',
  'hedgeLabel',
  'hedgeRatio',
  'hedgeRatioPct',
  'strategy_label',
  'source_batch_name',
  'comparison_scope',
  'cycleCount',
  'returnPct',
  'volatilityPct',
  'drawdownPct',
  'ulcerIndex',
  'hitRatePct',
  'averageCycleReturnPct'
];

const DISTRIBUTION_COLUMNS = [
  'asset',
  'tenor',
  'moneyness_label',
  'hedgeLabel',
  'hedgeRatio',
  'hedgeRatioPct',
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

function rowName(row) {
  return `${row.tenor} ${row.hedgeLabel}`;
}

function byTenor(rows, tenor) {
  return rows.filter(row => row.tenor === tenor).sort((a, b) => optionalNumber(a.hedgeRatio) - optionalNumber(b.hedgeRatio));
}

function baselineFor(rows, tenor) {
  return rows.find(row => row.tenor === tenor && optionalNumber(row.hedgeRatio) === 0) || null;
}

function deltaRow(row, baseline) {
  if (!baseline) return {};
  return {
    totalReturnDeltaPct: roundNumber(optionalNumber(row.totalReturnPct) - optionalNumber(baseline.totalReturnPct)),
    cagrDeltaPct: roundNumber(optionalNumber(row.cagrPct) - optionalNumber(baseline.cagrPct)),
    maxDrawdownDeltaPct: roundNumber(optionalNumber(row.maxDrawdownPct) - optionalNumber(baseline.maxDrawdownPct)),
    ulcerDelta: roundNumber(optionalNumber(row.ulcerIndex) - optionalNumber(baseline.ulcerIndex)),
    severeLossFrequencyDeltaPct: roundNumber(optionalNumber(row.severeLossFrequencyPct) - optionalNumber(baseline.severeLossFrequencyPct)),
    leftTailFrequencyDeltaPct: roundNumber(optionalNumber(row.leftTailFrequencyPct) - optionalNumber(baseline.leftTailFrequencyPct))
  };
}

function buildFrontierRows(rows) {
  return rows.map(row => ({
    ...row,
    ...deltaRow(row, baselineFor(rows, row.tenor))
  }));
}

function bestBy(rows, field, direction = 'max') {
  const candidates = rows.filter(row => optionalNumber(row[field]) !== null);
  candidates.sort((a, b) => optionalNumber(a[field]) - optionalNumber(b[field]));
  return direction === 'min' ? candidates[0] : candidates[candidates.length - 1];
}

function buildFindings(comparisonRows, rollingRows, regimeRows) {
  const observations = [];
  const interpretations = [];
  const hypotheses = [];

  for (const tenor of PHASE1_TENORS) {
    const rows = byTenor(comparisonRows, tenor);
    const baseline = baselineFor(comparisonRows, tenor);
    const bestDrawdown = bestBy(rows, 'maxDrawdownPct', 'max');
    const bestUlcer = bestBy(rows, 'ulcerIndex', 'min');
    const bestCagr = bestBy(rows, 'cagrPct', 'max');
    const bestReturnOverDrawdown = bestBy(rows, 'returnOverMaxDrawdown', 'max');
    const h20 = rows.find(row => optionalNumber(row.hedgeRatio) === 0.2);
    const h40 = rows.find(row => optionalNumber(row.hedgeRatio) === 0.4);

    observations.push(`${tenor}: baseline ${baseline ? rowName(baseline) : 'n/a'} total return is ${baseline ? baseline.totalReturnPct : 'n/a'}%, CAGR ${baseline ? baseline.cagrPct : 'n/a'}%, max drawdown ${baseline ? baseline.maxDrawdownPct : 'n/a'}%, and ulcer index ${baseline ? baseline.ulcerIndex : 'n/a'}.`);
    if (bestDrawdown) observations.push(`${tenor}: shallowest max drawdown is ${rowName(bestDrawdown)} at ${bestDrawdown.maxDrawdownPct}%.`);
    if (bestUlcer) observations.push(`${tenor}: lowest ulcer index is ${rowName(bestUlcer)} at ${bestUlcer.ulcerIndex}.`);
    if (bestCagr) observations.push(`${tenor}: highest CAGR remains ${rowName(bestCagr)} at ${bestCagr.cagrPct}%.`);
    if (bestReturnOverDrawdown) observations.push(`${tenor}: highest return-over-drawdown ratio is ${rowName(bestReturnOverDrawdown)} at ${bestReturnOverDrawdown.returnOverMaxDrawdown}.`);
    if (h20 && baseline) {
      observations.push(`${tenor}: h20 changes CAGR by ${h20.cagrDeltaPct} percentage points and max drawdown by ${h20.maxDrawdownDeltaPct} percentage points versus h00.`);
    }
    if (h40 && baseline) {
      observations.push(`${tenor}: h40 changes CAGR by ${h40.cagrDeltaPct} percentage points and max drawdown by ${h40.maxDrawdownDeltaPct} percentage points versus h00.`);
    }
  }

  const oneYearRolling = rollingRows.filter(row => (
    (row.tenor === 'weekly' && Number(row.windowCycles) === 52)
    || (row.tenor === '14d' && Number(row.windowCycles) === 26)
  ));
  for (const tenor of PHASE1_TENORS) {
    const rows = byTenor(comparisonRows, tenor);
    const rollingTenor = oneYearRolling.filter(row => row.tenor === tenor);
    const baseline = baselineFor(rows, tenor);
    const bestRollingDrawdown = bestBy(rollingTenor, 'rollingDrawdownPct', 'max');
    if (bestRollingDrawdown) {
      observations.push(`${tenor}: best one-year rolling drawdown observation is ${bestRollingDrawdown.strategy_label} at ${bestRollingDrawdown.rollingDrawdownPct}%.`);
    }
    const bearRows = regimeRows.filter(row => row.tenor === tenor && row.regime_label === 'bear_2022');
    const bestBearDrawdown = bestBy(bearRows, 'drawdownPct', 'max');
    if (bestBearDrawdown && baseline) {
      observations.push(`${tenor}: in the fixed 2022 bear regime, shallowest regime drawdown is ${bestBearDrawdown.strategy_label} at ${bestBearDrawdown.drawdownPct}%.`);
    }
  }

  interpretations.push('The hedge frontier should be read as an end-of-cycle risk overlay test, not a full perpetual trading simulation.');
  interpretations.push('Improvement in drawdown or ulcer index at small hedge ratios indicates reduced long-delta exposure, but the same hedge can mechanically reduce upside capture in strong BTC regimes.');
  interpretations.push('A hedge ratio is economically interesting only if the risk improvement is large enough to justify the observed CAGR and total-return drag under these simplified assumptions.');
  interpretations.push('Weekly and 14d rows are comparable only as CCW cycle systems; their cycle counts differ, and simple Sharpe/Sortino values remain cycle-based rather than annualized.');

  hypotheses.push('If h10 or h20 materially lowers drawdown and ulcer index while preserving most CAGR, it may define the first candidate survivability sweet spot for later funding-aware research.');
  hypotheses.push('If h30 or h40 dominates drawdown metrics but causes steep CAGR compression, the frontier likely becomes too defensive for a structurally long BTC CCW objective.');
  hypotheses.push('14d may tolerate small fixed hedges differently from weekly because it has fewer rolls and a different premium/upside tradeoff, but Phase 1 is not sufficient to infer a dynamic hedge policy.');

  return { observations, interpretations, hypotheses };
}

function buildMarkdown(analysis) {
  return [
    '# BTC Hedge Frontier Phase 1 Findings',
    '',
    `Generated: ${analysis.generatedAt}`,
    '',
    '## Scope',
    '',
    '- Analysis-only post-processing of existing BTC CCW OTM10 weekly and 14d baseline runs.',
    '- Hedge ratios: h00, h10, h20, h30, h40.',
    '- Hedge is fixed, always on, and rebalanced only at natural CCW roll boundaries.',
    '- No baseline backtests are rerun and the execution engine is unchanged.',
    '',
    '## Methodology Caveats',
    '',
    '- Funding, basis, borrow, liquidation risk, margin mechanics, slippage, and intracycle mark-to-market are ignored in Phase 1.',
    '- The perpetual hedge is approximated as short BTC exposure over each CCW cycle.',
    '- Results preserve existing option selection, entry, fallback, and settlement methodology from the unhedged baseline trades.',
    '- Drawdown and rolling metrics are end-of-cycle metrics and may understate intracycle stress.',
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
    '## Conservative Reading',
    '',
    '- Treat any apparent sweet spot as a candidate for later validation, not as an implementable hedge policy.',
    '- Phase 1 asks whether fixed partial hedging is worth researching further; it does not model the operational reality of perpetual hedging.',
    ''
  ].join('\n');
}

function buildAnalysis() {
  const dataset = buildPhase1HedgeDataset();
  const comparisonRows = buildFrontierRows(dataset.variants);
  const distributionRows = comparisonRows.map(row => ({
    asset: row.asset,
    tenor: row.tenor,
    moneyness_label: row.moneyness_label,
    hedgeLabel: row.hedgeLabel,
    hedgeRatio: row.hedgeRatio,
    hedgeRatioPct: row.hedgeRatioPct,
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
  }));
  const findings = buildFindings(comparisonRows, dataset.rolling, dataset.regimes);
  const generatedAt = new Date().toISOString();

  return {
    generatedAt,
    inputs: {
      source: 'runs/batches/**/summary.json and referenced annual trades.csv files',
      baselineFilter: 'BTC, weekly/14d, OTM10, full-period 2020-2026 batches'
    },
    outputs: {
      comparisonCsv: path.relative(REPO_ROOT, OUTPUT_COMPARISON_CSV),
      comparisonJson: path.relative(REPO_ROOT, OUTPUT_COMPARISON_JSON),
      cyclesCsv: path.relative(REPO_ROOT, OUTPUT_CYCLES_CSV),
      rollingCsv: path.relative(REPO_ROOT, OUTPUT_ROLLING_CSV),
      rollingJson: path.relative(REPO_ROOT, OUTPUT_ROLLING_JSON),
      regimeCsv: path.relative(REPO_ROOT, OUTPUT_REGIME_CSV),
      regimeJson: path.relative(REPO_ROOT, OUTPUT_REGIME_JSON),
      distributionCsv: path.relative(REPO_ROOT, OUTPUT_DISTRIBUTION_CSV),
      findingsMarkdown: path.relative(REPO_ROOT, OUTPUT_FINDINGS_MD),
      findingsJson: path.relative(REPO_ROOT, OUTPUT_FINDINGS_JSON)
    },
    methodology: {
      hedgeModel: 'Fixed always-on short BTC perpetual proxy. hedge_btc = hedge_ratio * BTC spot exposure at each CCW roll.',
      rebalance: 'Hedge is rebalanced only at natural CCW roll boundaries and remains fixed during each cycle.',
      cyclePnl: 'pnl_total_hedged = pnl_underlying + pnl_call + pnl_hedge; pnl_hedge = -hedge_btc * (S_exit - S_entry).',
      sizing: 'Hedged capital path is recursively recomputed so each next cycle sizes BTC exposure from prior hedged capital.',
      preservedBaseline: 'Option selection, option entry source, theoretical fallback, and settlement are inherited from existing baseline trades.',
      exclusions: [
        'funding',
        'basis',
        'borrow',
        'liquidation risk',
        'margin and leverage mechanics',
        'intracycle hedge rebalance',
        'intracycle mark-to-market risk'
      ],
      tailThresholds: {
        leftTailThresholdPct: LEFT_TAIL_THRESHOLD_PCT,
        severeLossThresholdPct: SEVERE_LOSS_THRESHOLD_PCT
      }
    },
    validation: {
      baselineBatchCount: dataset.items.length,
      expectedBaselineBatchCount: PHASE1_TENORS.length,
      variantCount: comparisonRows.length,
      expectedVariantCount: PHASE1_TENORS.length * PHASE1_HEDGE_RATIOS.length,
      cycleRowCount: dataset.cycles.length,
      rollingRowCount: dataset.rolling.length,
      regimeRowCount: dataset.regimes.length,
      tenorsPresent: [...new Set(comparisonRows.map(row => row.tenor))].sort(),
      hedgeLabelsPresent: [...new Set(comparisonRows.map(row => row.hedgeLabel))].sort(),
      skipped: dataset.skipped
    },
    findings,
    rows: comparisonRows,
    rollingRows: dataset.rolling,
    regimeRows: dataset.regimes,
    distributionRows,
    cycleRows: dataset.cycles
  };
}

function writeAnalysis(analysis) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_COMPARISON_CSV, `${objectsToCsv(analysis.rows, COMPARISON_COLUMNS)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_COMPARISON_JSON, `${JSON.stringify(analysis, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_CYCLES_CSV, `${objectsToCsv(analysis.cycleRows, CYCLE_COLUMNS)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_ROLLING_CSV, `${objectsToCsv(analysis.rollingRows, ROLLING_COLUMNS)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_ROLLING_JSON, `${JSON.stringify({
    generatedAt: analysis.generatedAt,
    methodology: analysis.methodology,
    validation: {
      rowCount: analysis.rollingRows.length,
      tenorsPresent: analysis.validation.tenorsPresent
    },
    rows: analysis.rollingRows
  }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_REGIME_CSV, `${objectsToCsv(analysis.regimeRows, REGIME_COLUMNS)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_REGIME_JSON, `${JSON.stringify({
    generatedAt: analysis.generatedAt,
    methodology: analysis.methodology,
    rows: analysis.regimeRows
  }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_DISTRIBUTION_CSV, `${objectsToCsv(analysis.distributionRows, DISTRIBUTION_COLUMNS)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_FINDINGS_JSON, `${JSON.stringify({
    generatedAt: analysis.generatedAt,
    methodology: analysis.methodology,
    validation: analysis.validation,
    findings: analysis.findings
  }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_FINDINGS_MD, buildMarkdown(analysis), 'utf8');
}

function main() {
  const analysis = buildAnalysis();
  writeAnalysis(analysis);

  console.log(`Generated ${analysis.validation.variantCount} hedge variants`);
  console.log(`Tenors: ${analysis.validation.tenorsPresent.join(', ')}`);
  console.log(`Hedges: ${analysis.validation.hedgeLabelsPresent.join(', ')}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_COMPARISON_CSV)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_COMPARISON_JSON)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_CYCLES_CSV)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_ROLLING_CSV)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_REGIME_CSV)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_DISTRIBUTION_CSV)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_FINDINGS_MD)}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('Error building BTC hedge frontier phase 1:', error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  buildAnalysis,
  buildFindings,
  writeAnalysis
};
