const fs = require('fs');
const path = require('path');
const { runStrategy } = require('./test_discovery');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const [, keyValue] = arg.split('--');
    if (keyValue.includes('=')) {
      const [key, value] = keyValue.split('=');
      args[key] = value;
    } else {
      const key = keyValue;
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

function safeRunNamePart(value) {
  return String(value)
    .replace(/:/g, '-')
    .replace(/[<>:"/\\|?*]+/g, '-')
    .replace(/\s+/g, '_')
    .replace(/-+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '');
}

function getConfigTenor(config) {
  return config.tenor || 'weekly';
}

const ASSET_DEFAULTS = {
  BTC: {
    underlyingPriceSource: 'BTC-PERPETUAL',
    optionSettlementPriceSource: 'DERIBIT_BTC_USD_DELIVERY_PRICE',
    strikeStep: 1000,
    strikeRange: 3000
  },
  ETH: {
    underlyingPriceSource: 'ETH-PERPETUAL',
    optionSettlementPriceSource: 'DERIBIT_ETH_USD_DELIVERY_PRICE',
    strikeStep: 50,
    strikeRange: 300
  }
};

function normalizeAsset(asset) {
  const normalized = String(asset || 'BTC').trim().toUpperCase();
  return ASSET_DEFAULTS[normalized] ? normalized : 'BTC';
}

function tenorRunNameSuffix(tenor) {
  if (tenor === 'weekly') return '';
  return `_t${safeRunNamePart(tenor).toLowerCase()}`;
}

function buildRunName(config, suffix) {
  const underlyingPriceSource = config.underlyingPriceSource || config.underlying;
  const asset = config.asset
    ? String(config.asset).toLowerCase().replace(/[^a-z0-9]+/g, '')
    : underlyingPriceSource && underlyingPriceSource.toUpperCase().includes('BTC') ? 'btc' : String(underlyingPriceSource).toLowerCase().replace(/[^a-z0-9]+/g, '');
  const xOtm = Number(config.xOtm);
  const xOtmLabel = `x${String(Math.round(xOtm * 100)).padStart(2, '0')}`;
  const stepLabel = `step${config.strikeStep}`;
  const fallbackLabel = String(config.fallbackMode).replace(/_/g, '');
  const sizingLabel = config.sizingMode === 'dynamic' ? 'dyn' : String(config.sizingMode).replace(/_/g, '');
  const entryLabel = `entry${String(config.entryHourUtc).padStart(2, '0')}h${String(config.entryMinuteUtc).padStart(2, '0')}`;
  const delayLabel = `delay${config.maxEntryDelayMinutes}m`;
  const settlementLabel = String(config.optionSettlementPriceSource || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const startDateLabel = safeRunNamePart(config.startDate);
  const endDateLabel = safeRunNamePart(config.endDate);
  const tenorSuffix = tenorRunNameSuffix(getConfigTenor(config));
  const base = `${asset}_${startDateLabel}_${endDateLabel}_${xOtmLabel}_${stepLabel}_${fallbackLabel}_${sizingLabel}_${entryLabel}_${delayLabel}_${settlementLabel}${tenorSuffix}`;
  return suffix ? `${base}_${suffix}` : base;
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
    const values = headers.map(header => escapeValue(row[header]));
    lines.push(values.join(','));
  }
  return lines.join('\n');
}

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

function readRunIndex(indexPath) {
  if (!fs.existsSync(indexPath)) return [];
  const content = fs.readFileSync(indexPath, 'utf8').trim();
  if (!content) return [];
  const lines = content.split(/\r?\n/);
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map(line => {
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] === '' ? null : values[index];
    });
    // Existing index rows predate tenor; interpret them as the weekly baseline.
    row.tenor = getLegacyAwareTenor(row);
    return row;
  });
}

function formatRowForIndex(row) {
  return [
    row.run_name,
    row.startDate,
    row.endDate,
    row.underlying,
    row.underlyingPriceSource,
    row.optionSettlementPriceSource,
    row.entryHourUtc,
    row.entryMinuteUtc,
    row.maxEntryDelayMinutes,
    row.xOtm,
    row.strikeStep,
    row.strikeRange,
    getLegacyAwareTenor(row),
    row.fallbackMode,
    row.sizingMode,
    row.finalCapital,
    row.totalPnL,
    row.callWeeks,
    row.totalWeeks,
    row.observedOptionWeeks,
    row.theoreticalFallbackWeeks,
    row.syntheticOptionWeeks,
    row.missingObservedInstrumentWeeks,
    row.missingObservedCandleWeeks,
    row.invalidObservedOpenWeeks,
    row.settlementFallbackWeeks,
    row.initialBtcPrice,
    row.finalBtcPrice,
    row.runReturnPct,
    row.btcReturnPct,
    row.annualizedVolatilityOfWeeklyReturns,
    row.annualizedVolatilityOfWeeklyReturnsPct,
    row.path,
    row.createdAt
  ];
}

function buildIndexCsv(rows) {
  const headers = ['run_name','startDate','endDate','underlying','underlyingPriceSource','optionSettlementPriceSource','entryHourUtc','entryMinuteUtc','maxEntryDelayMinutes','xOtm','strikeStep','strikeRange','tenor','fallbackMode','sizingMode','finalCapital','totalPnL','callWeeks','totalWeeks','observedOptionWeeks','theoreticalFallbackWeeks','syntheticOptionWeeks','missingObservedInstrumentWeeks','missingObservedCandleWeeks','invalidObservedOpenWeeks','settlementFallbackWeeks','initialBtcPrice','finalBtcPrice','runReturnPct','btcReturnPct','annualizedVolatilityOfWeeklyReturns','annualizedVolatilityOfWeeklyReturnsPct','path','createdAt'];
  const lines = [headers.join(',')];
  for (const row of rows) {
    const values = headers.map(header => {
      const rawValue = header === 'tenor' ? getLegacyAwareTenor(row) : row[header];
      const value = rawValue == null ? '' : String(rawValue);
      if (value.includes('"') || value.includes(',') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    lines.push(values.join(','));
  }
  return lines.join('\n');
}

function normalizeArgValue(value, defaultValue) {
  if (value === null || value === undefined) return defaultValue;
  return value;
}

function getLegacyAwareUnderlyingPriceSource(row) {
  return row.underlyingPriceSource || row.underlying;
}

function getLegacyAwareOptionSettlementPriceSource(row) {
  return row.optionSettlementPriceSource || '__legacy_unspecified_settlement__';
}

function getLegacyAwareNumber(row, key, defaultValue) {
  return row[key] === null || row[key] === undefined ? defaultValue : Number(row[key]);
}

function getLegacyAwareTenor(row) {
  return row.tenor || 'weekly';
}

function hasSameRunIdentityFields(row, config) {
  return (
    getLegacyAwareUnderlyingPriceSource(row) === config.underlyingPriceSource &&
    getLegacyAwareOptionSettlementPriceSource(row) === config.optionSettlementPriceSource &&
    getLegacyAwareNumber(row, 'entryHourUtc', 8) === config.entryHourUtc &&
    getLegacyAwareNumber(row, 'entryMinuteUtc', 0) === config.entryMinuteUtc &&
    getLegacyAwareNumber(row, 'maxEntryDelayMinutes', 60) === config.maxEntryDelayMinutes &&
    Number(row.xOtm) === config.xOtm &&
    Number(row.strikeStep) === config.strikeStep &&
    Number(row.strikeRange) === config.strikeRange &&
    getLegacyAwareTenor(row) === getConfigTenor(config) &&
    row.fallbackMode === config.fallbackMode &&
    row.sizingMode === config.sizingMode
  );
}

function buildConfigFromArgs(argv) {
  const asset = normalizeAsset(argv.asset);
  const assetDefaults = ASSET_DEFAULTS[asset];
  const underlyingPriceSource = normalizeArgValue(argv.underlyingPriceSource, normalizeArgValue(argv.underlying, assetDefaults.underlyingPriceSource));
  const optionSettlementPriceSource = normalizeArgValue(argv.optionSettlementPriceSource, assetDefaults.optionSettlementPriceSource);
  return {
    asset,
    startDate: normalizeArgValue(argv.startDate, '2025-10-03'),
    endDate: normalizeArgValue(argv.endDate, '2025-12-26'),
    xOtm: argv.xOtm !== undefined ? parseFloat(argv.xOtm) : 0.05,
    underlying: underlyingPriceSource,
    underlyingPriceSource,
    optionSettlementPriceSource,
    strikeStep: argv.strikeStep !== undefined ? parseInt(argv.strikeStep, 10) : assetDefaults.strikeStep,
    strikeRange: argv.strikeRange !== undefined ? parseInt(argv.strikeRange, 10) : assetDefaults.strikeRange,
    fallbackMode: normalizeArgValue(argv.fallbackMode, 'long_btc'),
    sizingMode: normalizeArgValue(argv.sizingMode, 'dynamic'),
    maxEntryDelayMinutes: argv.maxEntryDelayMinutes !== undefined ? parseInt(argv.maxEntryDelayMinutes, 10) : 60,
    tenor: normalizeArgValue(argv.tenor, 'weekly'),
    entryHourUtc: argv.entryHourUtc !== undefined ? parseInt(argv.entryHourUtc, 10) : 8,
    entryMinuteUtc: argv.entryMinuteUtc !== undefined ? parseInt(argv.entryMinuteUtc, 10) : 0
  };
}

function getRunIndexContext() {
  const runsDir = path.resolve(__dirname, '..', '..', 'runs');
  const indexPath = path.join(runsDir, 'index.csv');
  const indexRows = readRunIndex(indexPath);
  return { runsDir, indexPath, indexRows };
}

function findIdenticalRun(indexRows, config) {
  return indexRows.find(row =>
    row.startDate === config.startDate &&
    row.endDate === config.endDate &&
    hasSameRunIdentityFields(row, config)
  );
}

function findOverlappingRuns(indexRows, config) {
  return indexRows.filter(row =>
    hasSameRunIdentityFields(row, config) &&
    !(new Date(config.endDate) < new Date(row.startDate) || new Date(config.startDate) > new Date(row.endDate))
  );
}

function warnOverlappingRuns(overlaps) {
  if (overlaps.length > 0) {
    console.warn('Warning: overlapping run periods found for the same strategy parameters:');
    overlaps.forEach(row => {
      console.warn(`- ${row.run_name} (${row.startDate} to ${row.endDate})`);
    });
  }
}

function buildIndexRow(config, result, runName) {
  return {
    run_name: runName,
    startDate: config.startDate,
    endDate: config.endDate,
    underlying: config.underlying,
    underlyingPriceSource: config.underlyingPriceSource,
    optionSettlementPriceSource: config.optionSettlementPriceSource,
    entryHourUtc: config.entryHourUtc,
    entryMinuteUtc: config.entryMinuteUtc,
    maxEntryDelayMinutes: config.maxEntryDelayMinutes,
    xOtm: config.xOtm,
    strikeStep: config.strikeStep,
    strikeRange: config.strikeRange,
    tenor: getConfigTenor(config),
    fallbackMode: config.fallbackMode,
    sizingMode: config.sizingMode,
    finalCapital: result.summary.finalCapital,
    totalPnL: result.summary.totalPnL,
    callWeeks: result.summary.callWeeks,
    totalWeeks: result.summary.totalWeeks,
    observedOptionWeeks: result.summary.observedOptionWeeks,
    theoreticalFallbackWeeks: result.summary.theoreticalFallbackWeeks,
    syntheticOptionWeeks: result.summary.syntheticOptionWeeks,
    missingObservedInstrumentWeeks: result.summary.missingObservedInstrumentWeeks,
    missingObservedCandleWeeks: result.summary.missingObservedCandleWeeks,
    invalidObservedOpenWeeks: result.summary.invalidObservedOpenWeeks,
    settlementFallbackWeeks: result.summary.settlementFallbackWeeks,
    initialBtcPrice: result.summary.initialBtcPrice,
    finalBtcPrice: result.summary.finalBtcPrice,
    runReturnPct: result.summary.runReturnPct,
    btcReturnPct: result.summary.btcReturnPct,
    annualizedVolatilityOfWeeklyReturns: result.summary.annualizedVolatilityOfWeeklyReturns,
    annualizedVolatilityOfWeeklyReturnsPct: result.summary.annualizedVolatilityOfWeeklyReturnsPct,
    path: runName,
    createdAt: new Date().toISOString()
  };
}

function saveBacktestRun(config, result, options = {}) {
  const { duplicateMode = 'skip', warnOnOverlap = true } = options;
  const { runsDir, indexPath, indexRows } = getRunIndexContext();
  const identicalRow = findIdenticalRun(indexRows, config);

  if (identicalRow && duplicateMode === 'skip') {
    console.warn('Warning: an identical run already exists.');
    console.warn(`Existing run: ${identicalRow.run_name}`);
    console.warn(`Path: ${identicalRow.path}`);
    return {
      saved: false,
      reason: 'duplicate',
      existingRow: identicalRow,
      runName: identicalRow.run_name,
      runPath: path.join(runsDir, identicalRow.path)
    };
  }

  if (warnOnOverlap) {
    const overlaps = findOverlappingRuns(indexRows, config)
      .filter(row => !identicalRow || row.run_name !== identicalRow.run_name);
    warnOverlappingRuns(overlaps);
  }

  fs.mkdirSync(runsDir, { recursive: true });

  const baseRunName = buildRunName(config);
  const existingSuffixes = indexRows
    .filter(row => row.run_name.startsWith(`${baseRunName}_`))
    .map(row => {
      const match = row.run_name.match(/_(\d{3})$/);
      return match ? Number(match[1]) : 0;
    });
  const nextSuffix = String((Math.max(0, ...existingSuffixes) + 1)).padStart(3, '0');
  const runName = buildRunName(config, nextSuffix);
  const runPath = path.join(runsDir, runName);

  fs.mkdirSync(runPath, { recursive: true });

  const configPath = path.join(runPath, 'config.json');
  const tradesPath = path.join(runPath, 'trades.csv');
  const equityPath = path.join(runPath, 'equity_curve.csv');
  const summaryPath = path.join(runPath, 'summary.json');

  fs.writeFileSync(configPath, JSON.stringify(result.config, null, 2), 'utf8');
  fs.writeFileSync(tradesPath, objectsToCsv(result.trades), 'utf8');
  fs.writeFileSync(equityPath, objectsToCsv(result.equityCurve), 'utf8');
  fs.writeFileSync(summaryPath, JSON.stringify(result.summary, null, 2), 'utf8');

  const newIndexRow = buildIndexRow(config, result, runName);
  const updatedIndexRows = [...indexRows, newIndexRow];
  fs.writeFileSync(indexPath, buildIndexCsv(updatedIndexRows), 'utf8');

  return {
    saved: true,
    reason: null,
    runName,
    runPath,
    indexRow: newIndexRow
  };
}

async function main() {
  const argv = parseArgs(process.argv);
  const config = buildConfigFromArgs(argv);
  const { runsDir, indexRows } = getRunIndexContext();
  const identicalRow = findIdenticalRun(indexRows, config);

  if (identicalRow) {
    console.warn('Warning: an identical run already exists.');
    console.warn(`Existing run: ${identicalRow.run_name}`);
    console.warn(`Path: ${identicalRow.path}`);
    return;
  }

  warnOverlappingRuns(findOverlappingRuns(indexRows, config));

  const result = await runStrategy(config);
  const savedRun = saveBacktestRun(config, result, {
    duplicateMode: 'skip',
    warnOnOverlap: false
  });

  if (!savedRun.saved) {
    return;
  }

  const runPath = savedRun.runPath || path.join(runsDir, savedRun.runName);
  console.log(`Run saved to ${runPath}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  main,
  parseArgs,
  buildConfigFromArgs,
  saveBacktestRun,
  buildRunName,
  safeRunNamePart,
  readRunIndex,
  buildIndexCsv,
  findIdenticalRun,
  findOverlappingRuns
};
