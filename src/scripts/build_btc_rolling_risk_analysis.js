const fs = require('fs');
const path = require('path');

const {
  REPO_ROOT,
  OUTPUT_DIR,
  objectsToCsv,
  roundNumber,
  mean,
  sampleStdDev,
  loadBtcBatchItems,
  loadCyclesForBatch
} = require('./btc_deep_risk_utils');

const OUTPUT_CSV = path.join(OUTPUT_DIR, 'btc_rolling_risk_analysis.csv');
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'btc_rolling_risk_analysis.json');

const OUTPUT_COLUMNS = [
  'asset',
  'tenor',
  'moneyness_label',
  'xOtm',
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
  'windowReturnPct'
];

function windowSizesForTenor(tenor) {
  if (tenor === 'monthly') return [3, 6, 12];
  if (tenor === '14d') return [6, 13, 26];
  return [13, 26, 52];
}

function compoundReturnPct(returns) {
  if (!returns.length) return null;
  const multiple = returns.reduce((product, value) => product * (1 + value / 100), 1);
  return (multiple - 1) * 100;
}

function rollingDrawdownPct(returns) {
  let equity = 1;
  let peak = 1;
  let maxDrawdown = 0;

  for (const returnPct of returns) {
    equity *= (1 + returnPct / 100);
    peak = Math.max(peak, equity);
    const drawdown = peak > 0 ? (equity / peak - 1) * 100 : 0;
    maxDrawdown = Math.min(maxDrawdown, drawdown);
  }

  return maxDrawdown;
}

function buildRows() {
  const { items, skipped } = loadBtcBatchItems();
  const rows = [];

  for (const item of items) {
    const { cycles } = loadCyclesForBatch(item);
    const validCycles = cycles.filter(cycle => Number.isFinite(cycle.returnPct));
    const windows = windowSizesForTenor(item.tenor);

    for (const windowCycles of windows) {
      if (validCycles.length < windowCycles) continue;

      for (let index = windowCycles - 1; index < validCycles.length; index++) {
        const slice = validCycles.slice(index - windowCycles + 1, index + 1);
        const returns = slice.map(cycle => cycle.returnPct);
        const negativeReturns = returns.filter(value => value < 0);

        rows.push({
          asset: item.asset,
          tenor: item.tenor,
          moneyness_label: item.moneyness_label,
          xOtm: roundNumber(item.xOtm),
          source_batch_name: item.summary.batchName,
          comparison_scope: item.comparison_scope,
          windowCycles,
          windowStartSequence: slice[0].sequence,
          windowEndSequence: slice[slice.length - 1].sequence,
          windowStartDate: slice[0].entry_date,
          windowEndDate: slice[slice.length - 1].exit_date,
          rollingAverageCycleReturnPct: roundNumber(mean(returns)),
          rollingVolatilityPct: roundNumber(sampleStdDev(returns)),
          rollingDownsideVolatilityPct: roundNumber(sampleStdDev(negativeReturns)),
          rollingDrawdownPct: roundNumber(rollingDrawdownPct(returns)),
          windowReturnPct: roundNumber(compoundReturnPct(returns))
        });
      }
    }
  }

  rows.sort((a, b) => (
    a.asset.localeCompare(b.asset)
    || a.tenor.localeCompare(b.tenor)
    || a.xOtm - b.xOtm
    || a.source_batch_name.localeCompare(b.source_batch_name)
    || a.windowCycles - b.windowCycles
    || a.windowEndSequence - b.windowEndSequence
  ));

  return { rows, skipped };
}

function buildAnalysis() {
  const { rows, skipped } = buildRows();
  return {
    generatedAt: new Date().toISOString(),
    outputs: {
      csv: path.relative(REPO_ROOT, OUTPUT_CSV),
      json: path.relative(REPO_ROOT, OUTPUT_JSON)
    },
    methodology: {
      source: 'Saved annual run trades.csv files referenced by runs/batches/**/summary.json.',
      windowPolicy: 'Simple tenor-aware windows: weekly uses 13/26/52 cycles, 14d uses 6/13/26 cycles, monthly uses 3/6/12 cycles.',
      rollingVolatilityPct: 'Sample standard deviation of cycle return percentages inside the rolling window.',
      rollingAverageCycleReturnPct: 'Arithmetic average of cycle return percentages inside the rolling window.',
      rollingDownsideVolatilityPct: 'Sample standard deviation of negative cycle return percentages inside the rolling window.',
      rollingDrawdownPct: 'Worst peak-to-trough drawdown inside the rolling window using compounded cycle returns.',
      windowReturnPct: 'Compounded return over the rolling window.'
    },
    validation: {
      rowCount: rows.length,
      tenorsPresent: [...new Set(rows.map(row => row.tenor))].sort(),
      windowCyclesPresent: [...new Set(rows.map(row => row.windowCycles))].sort((a, b) => a - b),
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
  console.log(`Generated ${analysis.validation.rowCount} rows`);
  console.log(`Tenors: ${analysis.validation.tenorsPresent.join(', ')}`);
  console.log(`Windows: ${analysis.validation.windowCyclesPresent.join(', ')}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_CSV)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_JSON)}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('Error building BTC rolling risk analysis:', error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  buildAnalysis,
  buildRows
};
