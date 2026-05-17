const fs = require('fs');
const path = require('path');

const {
  REPO_ROOT,
  OUTPUT_DIR,
  objectsToCsv,
  roundNumber,
  mean,
  sampleStdDev,
  pct,
  parseDate,
  loadBtcBatchItems,
  loadCyclesForBatch,
  buildNormalizedEquity,
  drawdownStats,
  compoundReturnPct
} = require('./btc_deep_risk_utils');

const OUTPUT_CSV = path.join(OUTPUT_DIR, 'btc_regime_analysis.csv');
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'btc_regime_analysis.json');
const OUTPUT_MD = path.join(OUTPUT_DIR, 'btc_regime_analysis.md');

const REGIMES = [
  { label: 'bull_2020_2021', name: 'Bull', start: '2020-01-01', end: '2021-12-31T23:59:59Z' },
  { label: 'bear_2022', name: 'Bear', start: '2022-01-01', end: '2022-12-31T23:59:59Z' },
  { label: 'recovery_transition_2023', name: 'Recovery/transition', start: '2023-01-01', end: '2023-12-31T23:59:59Z' },
  { label: 'etf_bull_2024_2025', name: 'ETF/bull regime', start: '2024-01-01', end: '2025-12-31T23:59:59Z' }
];

const OUTPUT_COLUMNS = [
  'asset',
  'regime',
  'regime_label',
  'regime_start',
  'regime_end',
  'tenor',
  'moneyness_label',
  'xOtm',
  'source_batch_name',
  'comparison_scope',
  'cycleCount',
  'returnPct',
  'volatilityPct',
  'drawdownPct',
  'hitRatePct',
  'averageCycleReturnPct',
  'warnings'
];

function cycleInRegime(cycle, regime) {
  const date = parseDate(cycle.entry_date || cycle.exit_date);
  const start = parseDate(regime.start);
  const end = parseDate(regime.end);
  return date && start && end && date >= start && date <= end;
}

function regimeMetrics(cycles) {
  const validCycles = cycles.filter(cycle => Number.isFinite(cycle.returnDecimal));
  const returns = validCycles.map(cycle => cycle.returnPct);
  const equity = buildNormalizedEquity(validCycles);
  const drawdown = drawdownStats(equity);

  return {
    cycleCount: validCycles.length,
    returnPct: compoundReturnPct(validCycles),
    volatilityPct: sampleStdDev(returns),
    drawdownPct: drawdown.maxDrawdownPct,
    hitRatePct: pct(returns.filter(value => value > 0).length, returns.length),
    averageCycleReturnPct: mean(returns)
  };
}

function buildRows() {
  const { items, skipped } = loadBtcBatchItems();
  const rows = [];
  const monthlyCycleChecks = [];

  for (const item of items) {
    const { cycles, warnings: loadWarnings } = loadCyclesForBatch(item);

    if (item.tenor === 'monthly') {
      for (const row of item.summary.rows || []) {
        if (!Number.isInteger(Number(row.year))) continue;
        if (Number(row.year) < 2020 || Number(row.year) > 2025) continue;
        const count = Number(row.totalCycles ?? row.totalWeeks);
        monthlyCycleChecks.push({
          source_batch_name: item.summary.batchName,
          year: Number(row.year),
          totalCycles: count,
          expectedCompleteYearCycles: 12,
          pass: count === 12
        });
      }
    }

    for (const regime of REGIMES) {
      const regimeCycles = cycles.filter(cycle => cycleInRegime(cycle, regime));
      const metrics = regimeMetrics(regimeCycles);
      const warnings = [...loadWarnings];
      if (item.comparison_scope !== 'full_period') warnings.push('partial_period_excluded_from_primary_rankings');
      if (metrics.cycleCount === 0) warnings.push('no_cycles_in_regime');

      rows.push({
        asset: item.asset,
        regime: regime.name,
        regime_label: regime.label,
        regime_start: regime.start,
        regime_end: regime.end,
        tenor: item.tenor,
        moneyness_label: item.moneyness_label,
        xOtm: roundNumber(item.xOtm),
        source_batch_name: item.summary.batchName,
        comparison_scope: item.comparison_scope,
        cycleCount: metrics.cycleCount,
        returnPct: roundNumber(metrics.returnPct),
        volatilityPct: roundNumber(metrics.volatilityPct),
        drawdownPct: roundNumber(metrics.drawdownPct),
        hitRatePct: roundNumber(metrics.hitRatePct),
        averageCycleReturnPct: roundNumber(metrics.averageCycleReturnPct),
        warnings
      });
    }
  }

  rows.sort((a, b) => (
    a.regime_label.localeCompare(b.regime_label)
    || a.tenor.localeCompare(b.tenor)
    || a.xOtm - b.xOtm
    || a.source_batch_name.localeCompare(b.source_batch_name)
  ));

  return { rows, skipped, monthlyCycleChecks };
}

function buildMarkdown(analysis) {
  const fullRows = analysis.rows.filter(row => row.comparison_scope === 'full_period' && row.cycleCount > 0);
  const leaders = [];
  for (const regime of REGIMES) {
    const regimeRows = fullRows
      .filter(row => row.regime_label === regime.label)
      .sort((a, b) => b.returnPct - a.returnPct);
    const leader = regimeRows[0];
    if (leader) {
      leaders.push(`- ${regime.name}: ${leader.tenor} ${leader.moneyness_label} (${leader.returnPct}% return).`);
    }
  }

  return [
    '# BTC Regime Analysis',
    '',
    `Generated: ${analysis.generatedAt}`,
    '',
    '## Methodology',
    '',
    '- Regimes are fixed calendar segments: Bull 2020-2021, Bear 2022, Recovery/transition 2023, ETF/bull 2024-2025.',
    '- Cycles are assigned by `entry_date` from `trades.csv`.',
    '- Return is compounded from realized cycle returns inside each regime.',
    '- Volatility is sample standard deviation of cycle return percentages.',
    '- Drawdown is the worst end-of-cycle peak-to-trough drawdown inside the regime.',
    '- Hit rate is the percentage of cycles with positive return.',
    '',
    '## Regime Leaders',
    '',
    leaders.length ? leaders.join('\n') : '- No regime leaders available.',
    ''
  ].join('\n');
}

function buildAnalysis() {
  const { rows, skipped, monthlyCycleChecks } = buildRows();
  return {
    generatedAt: new Date().toISOString(),
    outputs: {
      csv: path.relative(REPO_ROOT, OUTPUT_CSV),
      json: path.relative(REPO_ROOT, OUTPUT_JSON),
      markdown: path.relative(REPO_ROOT, OUTPUT_MD)
    },
    methodology: {
      source: 'Saved annual run trades.csv files referenced by runs/batches/**/summary.json.',
      regimes: REGIMES,
      assignment: 'Cycles are assigned to regimes by trade entry_date.',
      returnPct: 'Compounded cycle return inside the regime.',
      volatilityPct: 'Sample standard deviation of cycle return percentages inside the regime.',
      drawdownPct: 'Worst end-of-cycle drawdown inside the regime using normalized compounded equity.',
      hitRatePct: 'Positive cycle count / regime cycle count * 100.',
      excluded: '2026 cycles are outside the initial explicit regimes and are not included in regime rows.'
    },
    validation: {
      rowCount: rows.length,
      tenorsPresent: [...new Set(rows.map(row => row.tenor))].sort(),
      regimesPresent: [...new Set(rows.map(row => row.regime_label))].sort(),
      monthlyCompleteYearCycleChecks: monthlyCycleChecks,
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
  console.log(`Regimes: ${analysis.validation.regimesPresent.join(', ')}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_CSV)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_JSON)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_MD)}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('Error building BTC regime analysis:', error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  buildAnalysis,
  REGIMES
};
