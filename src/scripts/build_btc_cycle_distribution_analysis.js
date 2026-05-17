const fs = require('fs');
const path = require('path');

const {
  REPO_ROOT,
  OUTPUT_DIR,
  objectsToCsv,
  roundNumber,
  mean,
  sampleStdDev,
  percentile,
  pct,
  loadBtcBatchItems,
  loadCyclesForBatch,
  baseRunFields
} = require('./btc_deep_risk_utils');

const OUTPUT_CSV = path.join(OUTPUT_DIR, 'btc_cycle_distribution_analysis.csv');
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'btc_cycle_distribution_analysis.json');

const OUTPUT_COLUMNS = [
  'asset',
  'tenor',
  'moneyness_label',
  'xOtm',
  'source_batch_name',
  'comparison_scope',
  'cycleCount',
  'meanCycleReturnPct',
  'medianCycleReturnPct',
  'stdDevCycleReturnPct',
  'skewness',
  'excessKurtosis',
  'interquartileRangePct',
  'p05CycleReturnPct',
  'p25CycleReturnPct',
  'p75CycleReturnPct',
  'p95CycleReturnPct',
  'tailConcentrationPct',
  'severeLossFrequencyPct',
  'severeLossThresholdPct',
  'cappedUpsideFrequencyPct',
  'cappedUpsideThresholdPct',
  'histogramMinPct',
  'histogramMaxPct',
  'histogramBinCount',
  'histogramCounts',
  'warnings'
];

function median(values) {
  const nums = values.filter(value => Number.isFinite(value)).slice().sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

function skewness(values) {
  const nums = values.filter(value => Number.isFinite(value));
  if (nums.length < 3) return null;
  const avg = mean(nums);
  const sd = sampleStdDev(nums);
  if (!sd) return null;
  const n = nums.length;
  const thirdMoment = nums.reduce((sum, value) => sum + ((value - avg) / sd) ** 3, 0);
  return (n / ((n - 1) * (n - 2))) * thirdMoment;
}

function excessKurtosis(values) {
  const nums = values.filter(value => Number.isFinite(value));
  if (nums.length < 4) return null;
  const avg = mean(nums);
  const sd = sampleStdDev(nums);
  if (!sd) return null;
  const n = nums.length;
  const fourthMoment = nums.reduce((sum, value) => sum + ((value - avg) / sd) ** 4, 0);
  return ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * fourthMoment
    - (3 * (n - 1) ** 2) / ((n - 2) * (n - 3));
}

function histogram(values, binCount = 10) {
  const nums = values.filter(value => Number.isFinite(value));
  if (!nums.length) {
    return { min: null, max: null, counts: [] };
  }
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  if (min === max) {
    const counts = Array(binCount).fill(0);
    counts[0] = nums.length;
    return { min, max, counts };
  }
  const width = (max - min) / binCount;
  const counts = Array(binCount).fill(0);
  for (const value of nums) {
    const index = Math.min(binCount - 1, Math.floor((value - min) / width));
    counts[index]++;
  }
  return { min, max, counts };
}

function distributionStats(cycles) {
  const returns = cycles.map(cycle => cycle.returnPct).filter(value => Number.isFinite(value));
  const p05 = percentile(returns, 0.05);
  const p25 = percentile(returns, 0.25);
  const p75 = percentile(returns, 0.75);
  const p95 = percentile(returns, 0.95);
  const severeLossThreshold = Math.min(-10, p05 ?? -10);
  const cappedUpsideThreshold = p95;
  const tailLosses = returns.filter(value => value <= severeLossThreshold);
  const totalNegativeMagnitude = returns
    .filter(value => value < 0)
    .reduce((sum, value) => sum + Math.abs(value), 0);
  const tailNegativeMagnitude = tailLosses.reduce((sum, value) => sum + Math.abs(value), 0);
  const hist = histogram(returns, 10);

  return {
    cycleCount: returns.length,
    meanCycleReturnPct: mean(returns),
    medianCycleReturnPct: median(returns),
    stdDevCycleReturnPct: sampleStdDev(returns),
    skewness: skewness(returns),
    excessKurtosis: excessKurtosis(returns),
    interquartileRangePct: p25 !== null && p75 !== null ? p75 - p25 : null,
    p05CycleReturnPct: p05,
    p25CycleReturnPct: p25,
    p75CycleReturnPct: p75,
    p95CycleReturnPct: p95,
    tailConcentrationPct: totalNegativeMagnitude ? (tailNegativeMagnitude / totalNegativeMagnitude) * 100 : null,
    severeLossFrequencyPct: pct(tailLosses.length, returns.length),
    severeLossThresholdPct: severeLossThreshold,
    cappedUpsideFrequencyPct: cappedUpsideThreshold === null
      ? null
      : pct(returns.filter(value => value >= cappedUpsideThreshold).length, returns.length),
    cappedUpsideThresholdPct: cappedUpsideThreshold,
    histogramMinPct: hist.min,
    histogramMaxPct: hist.max,
    histogramBinCount: hist.counts.length,
    histogramCounts: hist.counts.join('|')
  };
}

function buildAnalysis() {
  const { items, skipped } = loadBtcBatchItems();
  const rows = [];

  for (const item of items) {
    const { cycles, warnings } = loadCyclesForBatch(item);
    const stats = distributionStats(cycles);
    if (item.comparison_scope !== 'full_period') warnings.push('partial_period_excluded_from_primary_rankings');
    if (stats.cycleCount < 4) warnings.push('insufficient_cycles_for_higher_moments');

    rows.push({
      ...baseRunFields(item),
      cycleCount: stats.cycleCount,
      meanCycleReturnPct: roundNumber(stats.meanCycleReturnPct),
      medianCycleReturnPct: roundNumber(stats.medianCycleReturnPct),
      stdDevCycleReturnPct: roundNumber(stats.stdDevCycleReturnPct),
      skewness: roundNumber(stats.skewness),
      excessKurtosis: roundNumber(stats.excessKurtosis),
      interquartileRangePct: roundNumber(stats.interquartileRangePct),
      p05CycleReturnPct: roundNumber(stats.p05CycleReturnPct),
      p25CycleReturnPct: roundNumber(stats.p25CycleReturnPct),
      p75CycleReturnPct: roundNumber(stats.p75CycleReturnPct),
      p95CycleReturnPct: roundNumber(stats.p95CycleReturnPct),
      tailConcentrationPct: roundNumber(stats.tailConcentrationPct),
      severeLossFrequencyPct: roundNumber(stats.severeLossFrequencyPct),
      severeLossThresholdPct: roundNumber(stats.severeLossThresholdPct),
      cappedUpsideFrequencyPct: roundNumber(stats.cappedUpsideFrequencyPct),
      cappedUpsideThresholdPct: roundNumber(stats.cappedUpsideThresholdPct),
      histogramMinPct: roundNumber(stats.histogramMinPct),
      histogramMaxPct: roundNumber(stats.histogramMaxPct),
      histogramBinCount: stats.histogramBinCount,
      histogramCounts: stats.histogramCounts,
      warnings
    });
  }

  rows.sort((a, b) => (
    a.asset.localeCompare(b.asset)
    || a.tenor.localeCompare(b.tenor)
    || a.xOtm - b.xOtm
    || a.source_batch_name.localeCompare(b.source_batch_name)
  ));

  return {
    generatedAt: new Date().toISOString(),
    outputs: {
      csv: path.relative(REPO_ROOT, OUTPUT_CSV),
      json: path.relative(REPO_ROOT, OUTPUT_JSON)
    },
    methodology: {
      source: 'Saved annual run trades.csv files referenced by runs/batches/**/summary.json.',
      skewness: 'Adjusted Fisher-Pearson sample skewness of cycle return percentages.',
      excessKurtosis: 'Sample excess kurtosis of cycle return percentages.',
      dispersion: 'Standard deviation and interquartile range of cycle return percentages.',
      tailConcentrationPct: 'Share of total negative-return magnitude contributed by cycles at or below min(-10%, 5th percentile).',
      severeLossFrequencyPct: 'Percent of cycles at or below min(-10%, 5th percentile).',
      cappedUpsideFrequencyPct: 'Percent of cycles at or above the 95th percentile. This is a distribution flag, not proof of option assignment.'
    },
    validation: {
      rowCount: rows.length,
      tenorsPresent: [...new Set(rows.map(row => row.tenor))].sort(),
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
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_CSV)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_JSON)}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('Error building BTC cycle distribution analysis:', error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  buildAnalysis,
  distributionStats
};
