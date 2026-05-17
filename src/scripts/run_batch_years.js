const fs = require('fs');
const path = require('path');
const { runStrategy } = require('./test_discovery');
const { saveBacktestRun } = require('./run_backtest');

const BASELINE_EXIT_HOUR_UTC = 8;
const BASELINE_EXIT_MINUTE_UTC = 0;

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;

    const keyValue = arg.slice(2);
    if (keyValue.includes('=')) {
      const [key, value] = keyValue.split('=');
      args[key] = value;
    } else {
      const next = argv[i + 1];
      args[keyValue] = next && !next.startsWith('--') ? next : true;
      if (args[keyValue] === next) i++;
    }
  }
  return args;
}

function formatDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function firstFridayOfYear(year) {
  const date = new Date(Date.UTC(year, 0, 1));
  while (date.getUTCDay() !== 5) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return formatDateOnly(date);
}

function formatExitBoundary(dateOnly) {
  const hour = String(BASELINE_EXIT_HOUR_UTC).padStart(2, '0');
  const minute = String(BASELINE_EXIT_MINUTE_UTC).padStart(2, '0');
  return `${dateOnly}T${hour}:${minute}:00Z`;
}

function endDateForYear(year, currentUtcDate) {
  if (year === currentUtcDate.getUTCFullYear()) {
    return formatExitBoundary(formatDateOnly(currentUtcDate));
  }
  return formatExitBoundary(`${year}-12-31`);
}

function xOtmLabel(xOtm) {
  const pct = String(Math.abs(Math.round(xOtm * 100))).padStart(2, '0');
  if (xOtm > 0) return `otm${pct}`;
  if (xOtm < 0) return `itm${pct}`;
  return 'atm00';
}

function batchNameForTenor(tenor, xOtm, startYear, endYear) {
  const moneyness = xOtmLabel(xOtm);
  if (tenor === 'weekly') {
    return `batch_years_${moneyness}_${startYear}_${endYear}`;
  }
  return `batch_years_btc_${tenor}_${moneyness}_${startYear}_${endYear}`;
}

function objectsToCsv(rows) {
  if (!rows || rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escapeValue = value => {
    if (value === null || value === undefined) return '';
    const raw = String(value);
    if (raw.includes('"') || raw.includes(',') || raw.includes('\n')) {
      return `"${raw.replace(/"/g, '""')}"`;
    }
    return raw;
  };
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map(header => escapeValue(row[header])).join(','));
  }
  return lines.join('\n');
}

function chainReturnsPct(rows, field) {
  const cumulative = rows.reduce((product, row) => {
    const value = Number(row[field]);
    return Number.isFinite(value) ? product * (1 + value / 100) : product;
  }, 1);
  return (cumulative - 1) * 100;
}

function sumRows(rows, field) {
  return rows.reduce((sum, row) => {
    const value = Number(row[field]);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);
}

function buildYearRow(year, startDate, endDate, summary, tenor) {
  const totalCycles = summary.totalCycles ?? summary.totalWeeks;
  const callCycles = summary.callCycles ?? summary.callWeeks;
  const observedOptionCycles = summary.observedOptionCycles ?? summary.observedOptionWeeks;
  const theoreticalFallbackCycles = summary.theoreticalFallbackCycles ?? summary.theoreticalFallbackWeeks;
  const syntheticOptionCycles = summary.syntheticOptionCycles ?? summary.syntheticOptionWeeks;
  const settlementFallbackCycles = summary.settlementFallbackCycles ?? summary.settlementFallbackWeeks;

  const row = {
    year,
    startDate,
    endDate,
    runReturnPct: summary.runReturnPct,
    btcReturnPct: summary.btcReturnPct,
    annualizedVolatilityOfWeeklyReturns: summary.annualizedVolatilityOfWeeklyReturns,
    totalWeeks: summary.totalWeeks,
    callWeeks: summary.callWeeks,
    observedOptionWeeks: summary.observedOptionWeeks,
    theoreticalFallbackWeeks: summary.theoreticalFallbackWeeks,
    syntheticOptionWeeks: summary.syntheticOptionWeeks,
    settlementFallbackWeeks: summary.settlementFallbackWeeks,
    totalCycles,
    callCycles,
    observedOptionCycles,
    theoreticalFallbackCycles,
    syntheticOptionCycles,
    settlementFallbackCycles,
    totalPnLCall: summary.totalPnLCall,
    totalPnLUnderlying: summary.totalPnLUnderlying,
    totalPnL: summary.totalPnL
  };

  if (tenor !== 'weekly') {
    row.tenor = tenor;
  }

  return row;
}

function buildTotalRow(rows, tenor) {
  const totalWeeks = sumRows(rows, 'totalWeeks');
  const callWeeks = sumRows(rows, 'callWeeks');
  const observedOptionWeeks = sumRows(rows, 'observedOptionWeeks');
  const theoreticalFallbackWeeks = sumRows(rows, 'theoreticalFallbackWeeks');
  const syntheticOptionWeeks = sumRows(rows, 'syntheticOptionWeeks');
  const settlementFallbackWeeks = sumRows(rows, 'settlementFallbackWeeks');
  const totalCycles = sumRows(rows, 'totalCycles');
  const callCycles = sumRows(rows, 'callCycles');
  const observedOptionCycles = sumRows(rows, 'observedOptionCycles');
  const theoreticalFallbackCycles = sumRows(rows, 'theoreticalFallbackCycles');
  const syntheticOptionCycles = sumRows(rows, 'syntheticOptionCycles');
  const settlementFallbackCycles = sumRows(rows, 'settlementFallbackCycles');

  const row = {
    year: 'TOTAL',
    startDate: rows.length > 0 ? rows[0].startDate : null,
    endDate: rows.length > 0 ? rows[rows.length - 1].endDate : null,
    runReturnPct: chainReturnsPct(rows, 'runReturnPct'),
    btcReturnPct: chainReturnsPct(rows, 'btcReturnPct'),
    annualizedVolatilityOfWeeklyReturns: null,
    totalWeeks,
    callWeeks,
    observedOptionWeeks,
    theoreticalFallbackWeeks,
    syntheticOptionWeeks,
    settlementFallbackWeeks,
    totalCycles,
    callCycles,
    observedOptionCycles,
    theoreticalFallbackCycles,
    syntheticOptionCycles,
    settlementFallbackCycles,
    totalPnLCall: sumRows(rows, 'totalPnLCall'),
    totalPnLUnderlying: sumRows(rows, 'totalPnLUnderlying'),
    totalPnL: sumRows(rows, 'totalPnL'),
    observedOptionCoveragePct: totalCycles > 0 ? (observedOptionCycles / totalCycles) * 100 : null,
    theoreticalFallbackCoveragePct: totalCycles > 0 ? (theoreticalFallbackCycles / totalCycles) * 100 : null,
    syntheticOptionCoveragePct: totalCycles > 0 ? (syntheticOptionCycles / totalCycles) * 100 : null,
    settlementFallbackCoveragePct: totalCycles > 0 ? (settlementFallbackCycles / totalCycles) * 100 : null
  };

  if (tenor !== 'weekly') {
    row.tenor = tenor;
  }

  return row;
}

function formatConsoleRows(rows) {
  return rows.map(row => ({
    year: row.year,
    startDate: row.startDate,
    endDate: row.endDate,
    runReturnPct: row.runReturnPct !== null && row.runReturnPct !== undefined ? Number(row.runReturnPct).toFixed(2) : null,
    btcReturnPct: row.btcReturnPct !== null && row.btcReturnPct !== undefined ? Number(row.btcReturnPct).toFixed(2) : null,
    annVolWeeklyRet: row.annualizedVolatilityOfWeeklyReturns !== null && row.annualizedVolatilityOfWeeklyReturns !== undefined
      ? Number(row.annualizedVolatilityOfWeeklyReturns).toFixed(4)
      : null,
    totalCycles: row.totalCycles ?? row.totalWeeks,
    callCycles: row.callCycles ?? row.callWeeks,
    observedOptionCycles: row.observedOptionCycles ?? row.observedOptionWeeks,
    theoreticalFallbackCycles: row.theoreticalFallbackCycles ?? row.theoreticalFallbackWeeks,
    syntheticOptionCycles: row.syntheticOptionCycles ?? row.syntheticOptionWeeks,
    settlementFallbackCycles: row.settlementFallbackCycles ?? row.settlementFallbackWeeks,
    totalPnLCall: row.totalPnLCall !== null && row.totalPnLCall !== undefined ? Number(row.totalPnLCall).toFixed(2) : null,
    totalPnLUnderlying: row.totalPnLUnderlying !== null && row.totalPnLUnderlying !== undefined ? Number(row.totalPnLUnderlying).toFixed(2) : null,
    totalPnL: row.totalPnL !== null && row.totalPnL !== undefined ? Number(row.totalPnL).toFixed(2) : null
  }));
}

function createProgressWriter(year, startDate, endDate, xOtm, tenor) {
  let lastLength = 0;

  return {
    update(progress) {
      const current = progress.currentCycle ?? '?';
      const total = progress.totalCycles ?? '?';
      const unitLabel = tenor === 'weekly' ? 'week' : 'cycle';
      const tenorLabel = tenor === 'weekly' ? '' : `, tenor=${tenor}`;
      const line = `Running ${year}: ${startDate} to ${endDate}, xOtm=${xOtm}${tenorLabel} ${unitLabel}=${current}/${total}`;
      const padding = lastLength > line.length ? ' '.repeat(lastLength - line.length) : '';
      process.stdout.write(`\r${line}${padding}`);
      lastLength = line.length;
    },
    clear() {
      if (lastLength > 0) {
        process.stdout.write(`\r${' '.repeat(lastLength)}\r`);
        lastLength = 0;
      }
    }
  };
}

async function runQuietly(config, onProgress) {
  const originalLog = console.log;
  try {
    console.log = () => {};
    return await runStrategy(config, { onProgress });
  } finally {
    console.log = originalLog;
  }
}

async function main() {
  const batchStartedAt = new Date();
  const args = parseArgs(process.argv);
  const currentUtcDate = new Date();
  const currentYear = currentUtcDate.getUTCFullYear();
  const xOtm = args.xOtm !== undefined ? Number(args.xOtm) : 0.05;
  const startYear = args.startYear !== undefined ? Number(args.startYear) : 2020;
  const requestedEndYear = args.endYear !== undefined ? Number(args.endYear) : currentYear;
  const endYear = Math.min(requestedEndYear, currentYear);
  const tenor = args.tenor || 'weekly';

  if (!Number.isFinite(xOtm) || xOtm <= -1) {
    throw new Error('Invalid --xOtm. Use a finite value greater than -1. Examples: --xOtm=0.05, --xOtm=0, --xOtm=-0.05');
  }
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || startYear > endYear) {
    throw new Error('Invalid year range. Example: --startYear=2020 --endYear=2026');
  }

  const rows = [];
  const results = [];

  for (let year = startYear; year <= endYear; year++) {
    const startDate = firstFridayOfYear(year);
    const endDate = endDateForYear(year, currentUtcDate);
    // Deeper ITM/OTM studies may need wider strikeRange; keep baseline defaults here.
    const config = { startDate, endDate, xOtm, tenor };
    const progressWriter = createProgressWriter(year, startDate, endDate, xOtm, tenor);

    const result = await runQuietly(config, progressWriter.update);
    progressWriter.clear();
    const savedRun = saveBacktestRun(result.config, result, {
      duplicateMode: 'skip',
      warnOnOverlap: true
    });
    if (savedRun.saved) {
      console.log(`Saved ${year}: ${savedRun.runName}`);
      console.log(`Path: ${savedRun.runPath}`);
    } else if (savedRun.reason === 'duplicate') {
      console.log(`Skipped ${year}: duplicate run already exists`);
      console.log(`Run: ${savedRun.runName}`);
      console.log(`Path: ${savedRun.runPath}`);
    } else {
      console.log(`Skipped ${year}: ${savedRun.reason || 'not saved'}`);
      console.log(`Run: ${savedRun.runName || null}`);
      console.log(`Path: ${savedRun.runPath || null}`);
    }
    rows.push(buildYearRow(year, startDate, endDate, result.summary, tenor));
    results.push({
      year,
      config: result.config,
      summary: result.summary,
      savedRun: {
        saved: savedRun.saved,
        reason: savedRun.reason,
        duplicate: savedRun.reason === 'duplicate',
        runName: savedRun.runName,
        runPath: savedRun.runPath,
        existingRunName: savedRun.existingRow ? savedRun.existingRow.run_name : null,
        existingRunPath: savedRun.existingRow ? savedRun.runPath : null
      }
    });
  }

  const totalRow = buildTotalRow(rows, tenor);
  const allRows = [...rows, totalRow];
  const batchName = batchNameForTenor(tenor, xOtm, startYear, endYear);
  const batchDir = path.resolve(__dirname, '..', '..', 'runs', 'batches', batchName);

  fs.mkdirSync(batchDir, { recursive: true });
  fs.writeFileSync(path.join(batchDir, 'summary.csv'), objectsToCsv(allRows), 'utf8');
  fs.writeFileSync(path.join(batchDir, 'summary.json'), JSON.stringify({
    batchName,
    xOtm,
    ...(tenor !== 'weekly' ? { tenor } : {}),
    startYear,
    endYear,
    generatedAt: new Date().toISOString(),
    rows: allRows,
    annualResults: results
  }, null, 2), 'utf8');

  console.log('\n=== BATCH SUMMARY ===\n');
  console.table(formatConsoleRows(allRows));
  console.log(`Saved batch outputs to ${batchDir}`);

  const batchFinishedAt = new Date();
  const elapsedSeconds = Math.round((batchFinishedAt.getTime() - batchStartedAt.getTime()) / 1000);
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const remainingSeconds = elapsedSeconds % 60;
  console.log(`Batch started: ${batchStartedAt.toISOString()}`);
  console.log(`Batch finished: ${batchFinishedAt.toISOString()}`);
  console.log(`Elapsed: ${elapsedMinutes}m ${remainingSeconds}s`);
}

if (require.main === module) {
  main().catch(error => {
    console.error('Error running yearly batch:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { main };
