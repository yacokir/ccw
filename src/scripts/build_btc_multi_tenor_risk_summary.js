const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const BATCHES_DIR = path.join(REPO_ROOT, 'runs', 'batches');
const OUTPUT_DIR = path.join(REPO_ROOT, 'analysis', 'generated');
const OUTPUT_CSV = path.join(OUTPUT_DIR, 'btc_multi_tenor_risk_summary.csv');
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'btc_multi_tenor_risk_summary.json');

const OUTPUT_COLUMNS = [
  'asset',
  'tenor',
  'moneyness_label',
  'xOtm',
  'source_batch_name',
  'startYear',
  'endYear',
  'startDate',
  'endDate',
  'runReturnPct',
  'totalReturnPct',
  'btcReturnPct',
  'excessReturnVsBtcPct',
  'cagrPct',
  'annualizedVolatilityOfReturns',
  'totalPnL',
  'totalPnLCall',
  'totalPnLUnderlying',
  'totalCycles',
  'callCycles',
  'observedOptionCycles',
  'theoreticalFallbackCycles',
  'syntheticOptionCycles',
  'settlementFallbackCycles',
  'observedOptionCoveragePct',
  'theoreticalFallbackCoveragePct',
  'settlementFallbackCoveragePct',
  'maxDrawdownPct',
  'sharpeRatio',
  'sortinoRatio',
  'worstCycleReturnPct',
  'source_summary_path'
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function findSummaryFiles(dir) {
  if (!fs.existsSync(dir)) return [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findSummaryFiles(entryPath));
    } else if (entry.isFile() && entry.name === 'summary.json') {
      files.push(entryPath);
    }
  }
  return files;
}

function objectsToCsv(rows, columns) {
  const escapeValue = value => {
    if (value === null || value === undefined) return '';
    const raw = String(value);
    if (raw.includes('"') || raw.includes(',') || raw.includes('\n')) {
      return `"${raw.replace(/"/g, '""')}"`;
    }
    return raw;
  };

  return [
    columns.join(','),
    ...rows.map(row => columns.map(column => escapeValue(row[column])).join(','))
  ].join('\n');
}

function roundNumber(value, decimals = 6) {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const factor = 10 ** decimals;
  return Math.round((number + Number.EPSILON) * factor) / factor;
}

function optionalNumber(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function parseDate(value) {
  if (!value) return null;
  const raw = String(value);
  const ddmmyyyy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const normalized = ddmmyyyy
    ? `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}T00:00:00Z`
    : raw.includes('T') ? raw : `${raw}T00:00:00Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function yearsBetween(startValue, endValue) {
  const start = parseDate(startValue);
  const end = parseDate(endValue);
  if (!start || !end || end <= start) return null;
  return (end.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
}

function cagr(totalReturnPct, startDate, endDate) {
  const years = yearsBetween(startDate, endDate);
  if (!Number.isFinite(years) || years <= 0) return null;
  const multiple = 1 + totalReturnPct / 100;
  if (multiple <= 0) return null;
  return (multiple ** (1 / years) - 1) * 100;
}

function moneynessLabel(xOtm) {
  const value = optionalNumber(xOtm);
  if (value === null) return null;
  const pct = String(Math.abs(Math.round(value * 100))).padStart(2, '0');
  if (value > 0) return `otm${pct}`;
  if (value < 0) return `itm${pct}`;
  return 'atm00';
}

function findTotalRow(summary) {
  return (summary.rows || []).find(row => String(row.year).toUpperCase() === 'TOTAL') || null;
}

function getFirstAnnualResult(summary) {
  return Array.isArray(summary.annualResults) && summary.annualResults.length > 0
    ? summary.annualResults[0]
    : null;
}

function inferAsset(summary) {
  const annualResult = getFirstAnnualResult(summary);
  const config = annualResult && annualResult.config ? annualResult.config : {};
  const candidates = [
    summary.asset,
    config.asset,
    config.underlying,
    config.underlyingPriceSource,
    config.optionSettlementPriceSource
  ].filter(Boolean);

  if (candidates.some(value => String(value).toUpperCase().includes('BTC'))) return 'BTC';
  return null;
}

function inferTenor(summary, totalRow) {
  const annualResult = getFirstAnnualResult(summary);
  const config = annualResult && annualResult.config ? annualResult.config : {};
  return summary.tenor || totalRow.tenor || config.tenor || 'weekly';
}

function isBtcBatchSummary(summary) {
  return inferAsset(summary) === 'BTC' && optionalNumber(summary.xOtm) !== null;
}

function coalesceCycleField(row, cycleField, weekField) {
  return optionalNumber(row[cycleField], row[weekField]);
}

function pct(numerator, denominator) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
  return (numerator / denominator) * 100;
}

function annualizedVolatility(row) {
  return optionalNumber(
    row.annualizedVolatilityOfReturns,
    row.annualizedVolatilityOfWeeklyReturns
  );
}

function buildRow(summary, summaryPath) {
  const totalRow = findTotalRow(summary);
  if (!totalRow) {
    throw new Error(`Missing TOTAL row in ${summaryPath}`);
  }

  const xOtm = optionalNumber(summary.xOtm, totalRow.xOtm);
  const runReturnPct = optionalNumber(totalRow.runReturnPct, totalRow.totalReturnPct);
  const btcReturnPct = optionalNumber(totalRow.btcReturnPct);
  const totalCycles = coalesceCycleField(totalRow, 'totalCycles', 'totalWeeks');
  const callCycles = coalesceCycleField(totalRow, 'callCycles', 'callWeeks');
  const observedOptionCycles = coalesceCycleField(totalRow, 'observedOptionCycles', 'observedOptionWeeks');
  const theoreticalFallbackCycles = coalesceCycleField(totalRow, 'theoreticalFallbackCycles', 'theoreticalFallbackWeeks');
  const syntheticOptionCycles = coalesceCycleField(totalRow, 'syntheticOptionCycles', 'syntheticOptionWeeks');
  const settlementFallbackCycles = coalesceCycleField(totalRow, 'settlementFallbackCycles', 'settlementFallbackWeeks');

  return {
    asset: inferAsset(summary),
    tenor: inferTenor(summary, totalRow),
    moneyness_label: moneynessLabel(xOtm),
    xOtm,
    source_batch_name: summary.batchName,
    startYear: summary.startYear ?? null,
    endYear: summary.endYear ?? null,
    startDate: totalRow.startDate ?? null,
    endDate: totalRow.endDate ?? null,
    runReturnPct: roundNumber(runReturnPct),
    totalReturnPct: roundNumber(optionalNumber(totalRow.totalReturnPct, runReturnPct)),
    btcReturnPct: roundNumber(btcReturnPct),
    excessReturnVsBtcPct: roundNumber(
      runReturnPct !== null && btcReturnPct !== null ? runReturnPct - btcReturnPct : null
    ),
    cagrPct: roundNumber(cagr(runReturnPct, totalRow.startDate, totalRow.endDate)),
    annualizedVolatilityOfReturns: roundNumber(annualizedVolatility(totalRow)),
    totalPnL: roundNumber(optionalNumber(totalRow.totalPnL)),
    totalPnLCall: roundNumber(optionalNumber(totalRow.totalPnLCall)),
    totalPnLUnderlying: roundNumber(optionalNumber(totalRow.totalPnLUnderlying)),
    totalCycles,
    callCycles,
    observedOptionCycles,
    theoreticalFallbackCycles,
    syntheticOptionCycles,
    settlementFallbackCycles,
    observedOptionCoveragePct: roundNumber(pct(observedOptionCycles, totalCycles)),
    theoreticalFallbackCoveragePct: roundNumber(pct(theoreticalFallbackCycles, totalCycles)),
    settlementFallbackCoveragePct: roundNumber(pct(settlementFallbackCycles, totalCycles)),
    maxDrawdownPct: null,
    sharpeRatio: null,
    sortinoRatio: null,
    worstCycleReturnPct: null,
    source_summary_path: path.relative(REPO_ROOT, summaryPath)
  };
}

function isCompleteYearRow(row) {
  if (!Number.isInteger(Number(row.year))) return false;
  const start = parseDate(row.startDate);
  const end = parseDate(row.endDate);
  if (!start || !end) return false;
  return start.getUTCMonth() === 0 && end.getUTCMonth() === 11;
}

function monthlyCycleChecks(summaries) {
  const checks = [];
  for (const item of summaries) {
    const totalRow = findTotalRow(item.summary);
    const tenor = totalRow ? inferTenor(item.summary, totalRow) : null;
    if (tenor !== 'monthly') continue;

    for (const row of item.summary.rows || []) {
      if (!isCompleteYearRow(row)) continue;
      checks.push({
        source_batch_name: item.summary.batchName,
        year: row.year,
        totalCycles: coalesceCycleField(row, 'totalCycles', 'totalWeeks'),
        expectedCompleteYearCycles: 12,
        pass: coalesceCycleField(row, 'totalCycles', 'totalWeeks') === 12
      });
    }
  }
  return checks;
}

function buildSummary() {
  const summaryFiles = findSummaryFiles(BATCHES_DIR).sort();
  const loadedSummaries = [];
  const rows = [];
  const skipped = [];

  for (const summaryPath of summaryFiles) {
    const summary = readJson(summaryPath);
    if (!isBtcBatchSummary(summary)) {
      skipped.push({
        source_summary_path: path.relative(REPO_ROOT, summaryPath),
        reason: 'not a BTC batch summary with structured xOtm metadata'
      });
      continue;
    }

    loadedSummaries.push({ summary, summaryPath });
    rows.push(buildRow(summary, summaryPath));
  }

  rows.sort((a, b) => (
    a.asset.localeCompare(b.asset)
    || a.tenor.localeCompare(b.tenor)
    || a.xOtm - b.xOtm
    || a.source_batch_name.localeCompare(b.source_batch_name)
  ));

  return {
    generatedAt: new Date().toISOString(),
    sourceRoot: path.relative(REPO_ROOT, BATCHES_DIR),
    rowCount: rows.length,
    notes: [
      'Rows are consolidated from runs/batches/**/summary.json and moneyness_label is derived from structured xOtm metadata.',
      'Legacy weekly week-named counters are normalized into cycle fields when totalCycles/callCycles are absent.',
      'Risk fields that require individual equity curves or trades are null in this first pass; deeper drawdown, Sharpe, Sortino, and worst-cycle metrics require reading per-run equity_curve.csv and/or trades.csv.'
    ],
    validation: {
      tenorsPresent: [...new Set(rows.map(row => row.tenor))].sort(),
      monthlyCompleteYearCycleChecks: monthlyCycleChecks(loadedSummaries)
    },
    skipped,
    rows
  };
}

function main() {
  const summary = buildSummary();
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_CSV, `${objectsToCsv(summary.rows, OUTPUT_COLUMNS)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  console.log(`Generated ${summary.rowCount} rows`);
  console.log(`Tenors: ${summary.validation.tenorsPresent.join(', ')}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_CSV)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_JSON)}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('Error building BTC multi-tenor risk summary:', error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  buildSummary,
  moneynessLabel,
  yearsBetween,
  cagr
};
