const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const BATCHES_DIR = path.join(REPO_ROOT, 'runs', 'batches');
const OUTPUT_DIR = path.join(REPO_ROOT, 'analysis', 'generated');

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
    const raw = Array.isArray(value) ? value.join('; ') : String(value);
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

function optionalNumber(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function roundNumber(value, decimals = 6) {
  const number = optionalNumber(value);
  if (number === null) return null;
  const factor = 10 ** decimals;
  return Math.round((number + Number.EPSILON) * factor) / factor;
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

function mean(values) {
  const nums = values.filter(value => Number.isFinite(value));
  if (nums.length === 0) return null;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

function median(values) {
  const nums = values.filter(value => Number.isFinite(value)).slice().sort((a, b) => a - b);
  if (nums.length === 0) return null;
  const middle = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[middle] : (nums[middle - 1] + nums[middle]) / 2;
}

function sampleStdDev(values) {
  const nums = values.filter(value => Number.isFinite(value));
  if (nums.length < 2) return null;
  const avg = mean(nums);
  const variance = nums.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (nums.length - 1);
  return Math.sqrt(variance);
}

function populationStdDev(values) {
  const nums = values.filter(value => Number.isFinite(value));
  if (nums.length === 0) return null;
  const avg = mean(nums);
  const variance = nums.reduce((sum, value) => sum + (value - avg) ** 2, 0) / nums.length;
  return Math.sqrt(variance);
}

function percentile(values, p) {
  const nums = values.filter(value => Number.isFinite(value)).slice().sort((a, b) => a - b);
  if (nums.length === 0) return null;
  const index = (nums.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return nums[lower];
  return nums[lower] + (nums[upper] - nums[lower]) * (index - lower);
}

function pct(numerator, denominator) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
  return (numerator / denominator) * 100;
}

function findSummaryFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findSummaryFiles(entryPath));
    } else if (entry.isFile() && entry.name === 'summary.json') {
      files.push(entryPath);
    }
  }
  return files;
}

function moneynessLabel(xOtm) {
  const value = optionalNumber(xOtm);
  if (value === null) return null;
  const pctLabel = String(Math.abs(Math.round(value * 100))).padStart(2, '0');
  if (value > 0) return `otm${pctLabel}`;
  if (value < 0) return `itm${pctLabel}`;
  return 'atm00';
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

function findTotalRow(summary) {
  return (summary.rows || []).find(row => String(row.year).toUpperCase() === 'TOTAL') || null;
}

function inferTenor(summary, totalRow) {
  const annualResult = getFirstAnnualResult(summary);
  const config = annualResult && annualResult.config ? annualResult.config : {};
  return summary.tenor || (totalRow && totalRow.tenor) || config.tenor || 'weekly';
}

function isBtcBatchSummary(summary) {
  return inferAsset(summary) === 'BTC' && optionalNumber(summary.xOtm) !== null;
}

function comparisonScope(summary) {
  return Number(summary.startYear) === 2020 && Number(summary.endYear) === 2026
    ? 'full_period'
    : 'partial_period';
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

function loadBtcBatchItems() {
  const items = [];
  const skipped = [];

  for (const summaryPath of findSummaryFiles(BATCHES_DIR).sort()) {
    const summary = readJson(summaryPath);
    if (!isBtcBatchSummary(summary)) {
      skipped.push({
        source_summary_path: path.relative(REPO_ROOT, summaryPath),
        reason: 'not a BTC batch summary with structured xOtm metadata'
      });
      continue;
    }

    const batchDir = path.dirname(summaryPath);
    const totalRow = findTotalRow(summary);
    items.push({
      summary,
      summaryPath,
      batchDir,
      totalRow,
      asset: inferAsset(summary),
      tenor: inferTenor(summary, totalRow),
      xOtm: optionalNumber(summary.xOtm, totalRow && totalRow.xOtm),
      moneyness_label: moneynessLabel(optionalNumber(summary.xOtm, totalRow && totalRow.xOtm)),
      comparison_scope: comparisonScope(summary)
    });
  }

  return { items, skipped };
}

function tradeReturn(trade) {
  const explicit = optionalNumber(trade.return_pct);
  if (explicit !== null) return explicit;
  const before = optionalNumber(trade.capital_before);
  const after = optionalNumber(trade.capital_after);
  if (before !== null && after !== null && before !== 0) return after / before - 1;
  return null;
}

function loadCyclesForBatch(item) {
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
    if (!fs.existsSync(tradesPath)) {
      warnings.push(`missing_trades_csv_for_${annualResult.year}`);
      continue;
    }

    const trades = readCsv(tradesPath);
    trades.forEach((trade, index) => {
      const returnDecimal = tradeReturn(trade);
      cycles.push({
        source_batch_name: item.summary.batchName,
        run_name: path.basename(runPath),
        year: Number(annualResult.year),
        sequence: cycles.length + 1,
        cycle_in_run: optionalNumber(trade.cycle) ?? index + 1,
        entry_date: trade.entry_date,
        exit_date: trade.exit_date,
        returnDecimal,
        returnPct: returnDecimal === null ? null : returnDecimal * 100,
        pnl_total: optionalNumber(trade.pnl_total),
        capital_before: optionalNumber(trade.capital_before),
        capital_after: optionalNumber(trade.capital_after),
        has_call: String(trade.has_call).toLowerCase() === 'true',
        option_entry_price_source: trade.option_entry_price_source,
        option_entry_is_synthetic: String(trade.option_entry_is_synthetic).toLowerCase() === 'true',
        option_settlement_price_fallback_occurred: String(trade.option_settlement_price_fallback_occurred).toLowerCase() === 'true'
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

  if (cycles.some(cycle => cycle.returnDecimal === null)) {
    warnings.push('one_or_more_cycle_returns_missing');
  }

  return { cycles, warnings };
}

function buildNormalizedEquity(cycles) {
  const points = [{ sequence: 0, equity: 1, drawdownPct: 0, exit_date: null }];
  let equity = 1;
  let peak = 1;

  for (const cycle of cycles) {
    if (!Number.isFinite(cycle.returnDecimal)) continue;
    equity *= (1 + cycle.returnDecimal);
    peak = Math.max(peak, equity);
    const drawdownPct = peak > 0 ? (equity / peak - 1) * 100 : null;
    points.push({
      sequence: cycle.sequence,
      equity,
      drawdownPct,
      exit_date: cycle.exit_date
    });
  }

  return points;
}

function drawdownStats(equityPoints) {
  if (equityPoints.length <= 1) {
    return {
      maxDrawdownPct: null,
      maxDrawdownDurationCycles: null,
      averageDrawdownPct: null,
      ulcerIndex: null
    };
  }

  const drawdowns = equityPoints.slice(1).map(point => point.drawdownPct).filter(value => Number.isFinite(value));
  const maxDrawdownPct = drawdowns.length ? Math.min(...drawdowns) : null;
  const averageDrawdownPct = drawdowns.length ? mean(drawdowns) : null;
  const ulcerIndex = drawdowns.length
    ? Math.sqrt(mean(drawdowns.map(value => value ** 2)))
    : null;

  let currentDuration = 0;
  let maxDuration = 0;
  for (const point of equityPoints.slice(1)) {
    if (Number.isFinite(point.drawdownPct) && point.drawdownPct < 0) {
      currentDuration++;
      maxDuration = Math.max(maxDuration, currentDuration);
    } else {
      currentDuration = 0;
    }
  }

  return {
    maxDrawdownPct,
    maxDrawdownDurationCycles: maxDuration,
    averageDrawdownPct,
    ulcerIndex
  };
}

function cycleReturnStats(cycles) {
  const returns = cycles.map(cycle => cycle.returnPct).filter(value => Number.isFinite(value));
  const negatives = returns.filter(value => value < 0);
  const avg = mean(returns);
  const vol = sampleStdDev(returns);
  const downsideVol = sampleStdDev(negatives);

  return {
    cycleCount: returns.length,
    volatilityOfCycleReturns: vol,
    downsideVolatility: downsideVol,
    SharpeSimple: vol && vol !== 0 && avg !== null ? avg / vol : null,
    SortinoSimple: downsideVol && downsideVol !== 0 && avg !== null ? avg / downsideVol : null,
    worstCycleReturnPct: returns.length ? Math.min(...returns) : null,
    bestCycleReturnPct: returns.length ? Math.max(...returns) : null,
    positiveCyclePct: pct(returns.filter(value => value > 0).length, returns.length),
    negativeCyclePct: pct(negatives.length, returns.length),
    averageCycleReturnPct: avg,
    medianCycleReturnPct: median(returns)
  };
}

function compoundReturnPct(cycles) {
  const returns = cycles.map(cycle => cycle.returnDecimal).filter(value => Number.isFinite(value));
  if (!returns.length) return null;
  const multiple = returns.reduce((product, value) => product * (1 + value), 1);
  return (multiple - 1) * 100;
}

function baseRunFields(item) {
  return {
    asset: item.asset,
    tenor: item.tenor,
    moneyness_label: item.moneyness_label,
    xOtm: roundNumber(item.xOtm),
    source_batch_name: item.summary.batchName,
    comparison_scope: item.comparison_scope,
    startYear: item.summary.startYear ?? null,
    endYear: item.summary.endYear ?? null,
    startDate: item.totalRow ? item.totalRow.startDate : null,
    endDate: item.totalRow ? item.totalRow.endDate : null,
    source_summary_path: path.relative(REPO_ROOT, item.summaryPath)
  };
}

module.exports = {
  REPO_ROOT,
  BATCHES_DIR,
  OUTPUT_DIR,
  readCsv,
  readJson,
  objectsToCsv,
  optionalNumber,
  roundNumber,
  parseDate,
  yearsBetween,
  mean,
  median,
  sampleStdDev,
  populationStdDev,
  percentile,
  pct,
  moneynessLabel,
  loadBtcBatchItems,
  loadCyclesForBatch,
  buildNormalizedEquity,
  drawdownStats,
  cycleReturnStats,
  compoundReturnPct,
  baseRunFields
};
