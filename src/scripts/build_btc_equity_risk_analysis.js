const fs = require('fs');
const path = require('path');

const {
  REPO_ROOT,
  OUTPUT_DIR,
  objectsToCsv,
  roundNumber,
  loadBtcBatchItems,
  loadCyclesForBatch,
  buildNormalizedEquity,
  drawdownStats,
  cycleReturnStats,
  compoundReturnPct,
  baseRunFields
} = require('./btc_deep_risk_utils');

const OUTPUT_CSV = path.join(OUTPUT_DIR, 'btc_equity_risk_analysis.csv');
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'btc_equity_risk_analysis.json');
const OUTPUT_MD = path.join(OUTPUT_DIR, 'btc_equity_risk_analysis.md');

const OUTPUT_COLUMNS = [
  'asset',
  'tenor',
  'moneyness_label',
  'xOtm',
  'source_batch_name',
  'comparison_scope',
  'startYear',
  'endYear',
  'startDate',
  'endDate',
  'cycleCount',
  'reconstructedTotalReturnPct',
  'summaryTotalReturnPct',
  'returnDifferencePct',
  'maxDrawdownPct',
  'maxDrawdownDurationCycles',
  'averageDrawdownPct',
  'ulcerIndex',
  'volatilityOfCycleReturns',
  'downsideVolatility',
  'SharpeSimple',
  'SortinoSimple',
  'returnOverMaxDrawdown',
  'worstCycleReturnPct',
  'bestCycleReturnPct',
  'positiveCyclePct',
  'negativeCyclePct',
  'averageCycleReturnPct',
  'medianCycleReturnPct',
  'source_summary_path',
  'warnings'
];

function optionalSummaryReturn(item) {
  if (!item.totalRow) return null;
  const value = Number(item.totalRow.runReturnPct ?? item.totalRow.totalReturnPct);
  return Number.isFinite(value) ? value : null;
}

function buildRows() {
  const { items, skipped } = loadBtcBatchItems();
  const rows = [];

  for (const item of items) {
    const { cycles, warnings } = loadCyclesForBatch(item);
    const validCycles = cycles.filter(cycle => Number.isFinite(cycle.returnDecimal));
    const equityPoints = buildNormalizedEquity(validCycles);
    const drawdown = drawdownStats(equityPoints);
    const cycleStats = cycleReturnStats(validCycles);
    const reconstructedTotalReturnPct = compoundReturnPct(validCycles);
    const summaryTotalReturnPct = optionalSummaryReturn(item);
    const returnDifferencePct = reconstructedTotalReturnPct !== null && summaryTotalReturnPct !== null
      ? reconstructedTotalReturnPct - summaryTotalReturnPct
      : null;
    const maxDrawdownMagnitude = drawdown.maxDrawdownPct === null ? null : Math.abs(drawdown.maxDrawdownPct);

    if (item.comparison_scope !== 'full_period') warnings.push('partial_period_excluded_from_primary_rankings');
    if (cycles.length === 0) warnings.push('no_cycles_loaded');
    if (returnDifferencePct !== null && Math.abs(returnDifferencePct) > 0.05) {
      warnings.push('reconstructed_return_differs_from_batch_summary');
    }

    rows.push({
      ...baseRunFields(item),
      cycleCount: cycleStats.cycleCount,
      reconstructedTotalReturnPct: roundNumber(reconstructedTotalReturnPct),
      summaryTotalReturnPct: roundNumber(summaryTotalReturnPct),
      returnDifferencePct: roundNumber(returnDifferencePct),
      maxDrawdownPct: roundNumber(drawdown.maxDrawdownPct),
      maxDrawdownDurationCycles: drawdown.maxDrawdownDurationCycles,
      averageDrawdownPct: roundNumber(drawdown.averageDrawdownPct),
      ulcerIndex: roundNumber(drawdown.ulcerIndex),
      volatilityOfCycleReturns: roundNumber(cycleStats.volatilityOfCycleReturns),
      downsideVolatility: roundNumber(cycleStats.downsideVolatility),
      SharpeSimple: roundNumber(cycleStats.SharpeSimple),
      SortinoSimple: roundNumber(cycleStats.SortinoSimple),
      returnOverMaxDrawdown: roundNumber(maxDrawdownMagnitude ? reconstructedTotalReturnPct / maxDrawdownMagnitude : null),
      worstCycleReturnPct: roundNumber(cycleStats.worstCycleReturnPct),
      bestCycleReturnPct: roundNumber(cycleStats.bestCycleReturnPct),
      positiveCyclePct: roundNumber(cycleStats.positiveCyclePct),
      negativeCyclePct: roundNumber(cycleStats.negativeCyclePct),
      averageCycleReturnPct: roundNumber(cycleStats.averageCycleReturnPct),
      medianCycleReturnPct: roundNumber(cycleStats.medianCycleReturnPct),
      warnings
    });
  }

  rows.sort((a, b) => (
    a.asset.localeCompare(b.asset)
    || a.tenor.localeCompare(b.tenor)
    || a.xOtm - b.xOtm
    || a.source_batch_name.localeCompare(b.source_batch_name)
  ));

  return { rows, skipped };
}

function buildMarkdown(analysis) {
  return [
    '# BTC Equity Risk Analysis',
    '',
    `Generated: ${analysis.generatedAt}`,
    '',
    '## Methodology',
    '',
    '- Each batch configuration is reconstructed by reading saved annual run `trades.csv` files from `summary.json` metadata.',
    '- Cycle return is `return_pct` from `trades.csv`; if absent, it is `capital_after / capital_before - 1`.',
    '- Normalized equity starts at 1.0 and compounds sequential cycle returns in chronological order.',
    '- Drawdown is `equity / running_peak - 1`, reported in percent as a negative value.',
    '- `ulcerIndex` is the square root of the mean squared drawdown percentages.',
    '- `SharpeSimple` is average cycle return divided by sample standard deviation of cycle returns, with no risk-free rate and no annualization.',
    '- `SortinoSimple` is average cycle return divided by sample standard deviation of negative cycle returns.',
    '- Metrics remain null when the denominator or required source data is unavailable.',
    '',
    '## Limitations',
    '',
    '- This layer uses realized cycle-to-cycle returns, not intracycle mark-to-market paths.',
    '- Drawdowns are end-of-cycle drawdowns and may understate intracycle underwater risk.',
    '- Partial-period rows are included for traceability but flagged outside primary comparisons.',
    ''
  ].join('\n');
}

function buildAnalysis() {
  const { rows, skipped } = buildRows();
  return {
    generatedAt: new Date().toISOString(),
    outputs: {
      csv: path.relative(REPO_ROOT, OUTPUT_CSV),
      json: path.relative(REPO_ROOT, OUTPUT_JSON),
      markdown: path.relative(REPO_ROOT, OUTPUT_MD)
    },
    methodology: {
      source: 'Saved annual run trades.csv files referenced by runs/batches/**/summary.json.',
      equityReconstruction: 'normalized_equity_t = normalized_equity_t_minus_1 * (1 + cycle_return_decimal)',
      drawdown: 'drawdown_pct = (normalized_equity / running_peak - 1) * 100',
      averageDrawdownPct: 'Arithmetic mean of end-of-cycle drawdown percentages.',
      ulcerIndex: 'sqrt(mean(drawdown_pct^2)) using end-of-cycle drawdowns.',
      volatilityOfCycleReturns: 'Sample standard deviation of cycle return percentages.',
      downsideVolatility: 'Sample standard deviation of negative cycle return percentages.',
      SharpeSimple: 'averageCycleReturnPct / volatilityOfCycleReturns, no risk-free rate, no annualization.',
      SortinoSimple: 'averageCycleReturnPct / downsideVolatility, no risk-free rate, no annualization.',
      returnOverMaxDrawdown: 'reconstructedTotalReturnPct / abs(maxDrawdownPct).'
    },
    validation: {
      rowCount: rows.length,
      tenorsPresent: [...new Set(rows.map(row => row.tenor))].sort(),
      fullPeriodRowCount: rows.filter(row => row.comparison_scope === 'full_period').length,
      partialPeriodRowCount: rows.filter(row => row.comparison_scope !== 'full_period').length,
      skipped
    },
    rows
  };
}

function main() {
  const analysis = buildAnalysis();
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_CSV, `${objectsToCsv(analysis.rows, OUTPUT_COLUMNS)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(analysis, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_MD, buildMarkdown(analysis), 'utf8');

  console.log(`Generated ${analysis.validation.rowCount} rows`);
  console.log(`Tenors: ${analysis.validation.tenorsPresent.join(', ')}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_CSV)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_JSON)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_MD)}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('Error building BTC equity risk analysis:', error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  buildAnalysis,
  buildRows
};
