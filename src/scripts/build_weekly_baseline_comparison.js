const fs = require('fs');
const path = require('path');

const MONEYNESS_VARIANTS = ['itm05', 'atm00', 'otm03', 'otm05', 'otm07', 'otm10'];
const OUTPUT_COLUMNS = [
  'strategy',
  'asset',
  'tenor',
  'moneyness',
  'friction_model',
  'total_return',
  'annual_return',
  'cagr',
  'adjusted_return',
  'trade_count',
  'avg_premium',
  'avg_premium_haircut',
  'degradation_vs_raw_pct'
];

// MVP convention:
// - total_return is always the original raw return for the moneyness variant.
// - adjusted_return is the return after applying the selected friction model.
// - degradation_vs_raw_pct compares raw total_return against adjusted_return.
// Uniform friction uses the existing "realistic" scenario: a 10% premium haircut.
const UNIFORM_SCENARIO = 'realistic';
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const BATCHES_DIR = path.join(REPO_ROOT, 'runs', 'batches');
const OUTPUT_DIR = path.join(REPO_ROOT, 'analysis', 'generated');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'weekly_btc_baseline_comparison.csv');

function parseCsvLine(line) {
  const cells = [];
  let value = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          value += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        value += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      cells.push(value);
      value = '';
    } else {
      value += char;
    }
  }

  cells.push(value);
  return cells;
}

function readCsv(filePath) {
  const content = fs.readFileSync(filePath, 'utf8').trim();
  if (!content) return [];

  const lines = content.split(/\r?\n/);
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map(line => {
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] === '' ? null : values[index];
    });
    return row;
  });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
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

function toNumber(value, fieldName) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`Invalid numeric value for ${fieldName}: ${value}`);
  }
  return number;
}

function optionalNumber(value, defaultValue = 0) {
  if (value === null || value === undefined || value === '') return defaultValue;
  const number = Number(value);
  return Number.isFinite(number) ? number : defaultValue;
}

function roundNumber(value, decimals = 6) {
  if (value === null || value === undefined) return value;
  const number = Number(value);
  if (!Number.isFinite(number)) return value;
  const factor = 10 ** decimals;
  return Math.round((number + Number.EPSILON) * factor) / factor;
}

function parseDate(value) {
  if (!value) return null;
  const normalized = String(value).includes('T') ? value : `${value}T00:00:00Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function yearsBetween(startValue, endValue) {
  const start = parseDate(startValue);
  const end = parseDate(endValue);
  if (!start || !end || end <= start) return null;
  return (end.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
}

function simpleAnnualReturn(totalReturnPct, years) {
  if (!Number.isFinite(years) || years <= 0) return null;
  return totalReturnPct / years;
}

function cagr(totalReturnPct, years) {
  if (!Number.isFinite(years) || years <= 0) return null;
  const multiple = 1 + totalReturnPct / 100;
  if (multiple <= 0) return null;
  return (multiple ** (1 / years) - 1) * 100;
}

function resolveRunPath(batchDir, annualResult) {
  const savedRun = annualResult.savedRun || {};
  const rawRunPath = savedRun.runPath || savedRun.existingRunPath || savedRun.runName || savedRun.existingRunName;
  if (!rawRunPath) {
    throw new Error(`Missing saved run path for ${batchDir}, year ${annualResult.year}`);
  }

  if (path.isAbsolute(rawRunPath)) return rawRunPath;
  if (rawRunPath.startsWith('runs/') || rawRunPath.startsWith('runs\\')) {
    return path.join(REPO_ROOT, rawRunPath);
  }
  return path.resolve(batchDir, '..', '..', rawRunPath);
}

function calculateAveragePremium(batchDir, batchSummary) {
  let totalPremium = 0;
  let tradeCount = 0;

  for (const annualResult of batchSummary.annualResults || []) {
    const runPath = resolveRunPath(batchDir, annualResult);
    const tradesPath = path.join(runPath, 'trades.csv');
    console.log(`Reading ${path.relative(REPO_ROOT, tradesPath)}`);
    const trades = readCsv(tradesPath);

    for (const trade of trades) {
      const premiumBtc = optionalNumber(trade.C_entry_btc, optionalNumber(trade.C_entry, 0));
      const spot = optionalNumber(trade.S_entry, 0);
      const btcPosition = optionalNumber(trade.btc_position, 0);
      totalPremium += premiumBtc * spot * btcPosition;
      tradeCount++;
    }
  }

  return {
    avgPremium: tradeCount > 0 ? totalPremium / tradeCount : null,
    tradeCount
  };
}

function findTotalRow(rows, predicate) {
  return rows.find(row => String(row.year).toUpperCase() === 'TOTAL' && predicate(row));
}

function degradationVsRaw(rawReturnPct, adjustedReturnPct) {
  if (!Number.isFinite(rawReturnPct) || rawReturnPct === 0) return null;
  return ((rawReturnPct - adjustedReturnPct) / rawReturnPct) * 100;
}

function buildComparisonRow({ moneyness, frictionModel, sourceRow, rawReturnPct, years, avgPremium }) {
  const totalReturn = toNumber(sourceRow.originalReturnPct || sourceRow.runReturnPct, 'total return');
  const adjustedReturn = frictionModel === 'raw'
    ? totalReturn
    : toNumber(sourceRow.adjustedReturnPct, 'adjustedReturnPct');
  const tradeCount = toNumber(sourceRow.tradeCount || sourceRow.totalWeeks, 'trade count');
  const avgPremiumHaircut = frictionModel === 'raw'
    ? 0
    : optionalNumber(sourceRow.appliedHaircutPct, optionalNumber(sourceRow.haircutPct, 0));

  return {
    strategy: 'covered_call',
    asset: 'BTC',
    tenor: 'weekly',
    moneyness,
    friction_model: frictionModel,
    total_return: roundNumber(totalReturn),
    annual_return: roundNumber(simpleAnnualReturn(adjustedReturn, years)),
    cagr: roundNumber(cagr(adjustedReturn, years)),
    adjusted_return: roundNumber(adjustedReturn),
    trade_count: tradeCount,
    avg_premium: roundNumber(avgPremium),
    avg_premium_haircut: roundNumber(avgPremiumHaircut),
    degradation_vs_raw_pct: frictionModel === 'raw'
      ? 0
      : roundNumber(degradationVsRaw(rawReturnPct, adjustedReturn))
  };
}

function readBatchInputs(moneyness) {
  const batchDir = path.join(BATCHES_DIR, `batch_years_${moneyness}_2020_2026`);
  const summaryPath = path.join(batchDir, 'summary.json');
  const uniformPath = path.join(batchDir, 'analysis', 'execution_friction', 'uniform', 'execution_friction_uniform_summary.csv');
  const moneynessPath = path.join(batchDir, 'analysis', 'execution_friction', 'moneyness', 'execution_friction_moneyness_summary.csv');

  console.log(`Reading ${path.relative(REPO_ROOT, summaryPath)}`);
  const batchSummary = readJson(summaryPath);
  console.log(`Reading ${path.relative(REPO_ROOT, uniformPath)}`);
  const uniformRows = readCsv(uniformPath);
  console.log(`Reading ${path.relative(REPO_ROOT, moneynessPath)}`);
  const moneynessRows = readCsv(moneynessPath);

  return {
    batchDir,
    batchSummary,
    uniformRows,
    moneynessRows
  };
}

function buildRows() {
  const rows = [];

  for (const moneyness of MONEYNESS_VARIANTS) {
    const { batchDir, batchSummary, uniformRows, moneynessRows } = readBatchInputs(moneyness);
    const rawTotalRow = (batchSummary.rows || []).find(row => String(row.year).toUpperCase() === 'TOTAL');
    if (!rawTotalRow) throw new Error(`Missing TOTAL row in ${path.join(batchDir, 'summary.json')}`);

    const rawReturnPct = toNumber(rawTotalRow.runReturnPct, 'raw runReturnPct');
    const years = yearsBetween(rawTotalRow.startDate, rawTotalRow.endDate);
    const { avgPremium, tradeCount } = calculateAveragePremium(batchDir, batchSummary);
    const rawSourceRow = {
      runReturnPct: rawReturnPct,
      totalWeeks: rawTotalRow.totalWeeks || tradeCount
    };
    const uniformTotalRow = findTotalRow(
      uniformRows,
      row => row.frictionModel === 'uniform' && row.scenario === UNIFORM_SCENARIO
    );
    const moneynessTotalRow = findTotalRow(
      moneynessRows,
      row => row.frictionModel === 'moneyness'
    );

    if (!uniformTotalRow) throw new Error(`Missing uniform ${UNIFORM_SCENARIO} TOTAL row for ${moneyness}`);
    if (!moneynessTotalRow) throw new Error(`Missing moneyness TOTAL row for ${moneyness}`);

    rows.push(buildComparisonRow({
      moneyness,
      frictionModel: 'raw',
      sourceRow: rawSourceRow,
      rawReturnPct,
      years,
      avgPremium
    }));
    rows.push(buildComparisonRow({
      moneyness,
      frictionModel: 'uniform',
      sourceRow: uniformTotalRow,
      rawReturnPct,
      years,
      avgPremium
    }));
    rows.push(buildComparisonRow({
      moneyness,
      frictionModel: 'moneyness',
      sourceRow: moneynessTotalRow,
      rawReturnPct,
      years,
      avgPremium
    }));
  }

  return rows;
}

function main() {
  console.log(`Uniform friction assumption: using "${UNIFORM_SCENARIO}" scenario (10% premium haircut)`);
  console.log('Return convention: total_return is raw; adjusted_return is post-friction; degradation_vs_raw_pct compares the two');

  const rows = buildRows();
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${objectsToCsv(rows, OUTPUT_COLUMNS)}\n`, 'utf8');

  console.log(`Generated ${rows.length} rows`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_FILE)}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('Error building weekly baseline comparison:', error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  main,
  buildRows,
  yearsBetween,
  cagr
};
