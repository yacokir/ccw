const fs = require('fs');
const path = require('path');

const DEFAULT_HAIRCUTS = [
  { scenario: 'optimistic', haircutPct: 0.05 },
  { scenario: 'realistic', haircutPct: 0.10 },
  { scenario: 'conservative', haircutPct: 0.20 }
];

const FRICTION_MODELS = new Set(['uniform', 'moneyness']);

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

function roundNumber(value, decimals = 2) {
  if (value === null || value === undefined) return value;
  const number = Number(value);
  if (!Number.isFinite(number)) return value;
  const factor = 10 ** decimals;
  return Math.round((number + Number.EPSILON) * factor) / factor;
}

function parseHaircuts(value) {
  if (!value) return DEFAULT_HAIRCUTS;

  const haircuts = String(value)
    .split(',')
    .map(part => Number(part.trim()))
    .filter(number => Number.isFinite(number));

  if (haircuts.length === 0 || haircuts.some(number => number < 0 || number >= 1)) {
    throw new Error('Invalid --haircuts. Use comma-separated decimal percentages, for example --haircuts=0.03,0.07,0.15');
  }

  return haircuts.map(haircutPct => ({
    scenario: `haircut_${Math.round(haircutPct * 10000) / 100}pct`,
    haircutPct
  }));
}

function parseModel(value) {
  const model = value || 'uniform';
  if (!FRICTION_MODELS.has(model)) {
    throw new Error('Invalid --model. Use --model=uniform or --model=moneyness');
  }
  return model;
}

function buildUniformScenarios(haircutsArg) {
  // Uniform model = stress/sensitivity using fixed premium haircut scenarios.
  return parseHaircuts(haircutsArg).map(scenario => ({
    ...scenario,
    frictionModel: 'uniform',
    getHaircutPct: () => scenario.haircutPct
  }));
}

// Assumes farther OTM options have worse execution quality while near-ATM/front-week
// options are more liquid. This is a research approximation, not calibrated
// market microstructure.
function getMoneynessHaircutPct(relativeMoneyness) {
  if (!Number.isFinite(relativeMoneyness)) return 0;
  if (relativeMoneyness <= 0.02) return 0.04;
  if (relativeMoneyness > 0.02 && relativeMoneyness <= 0.05) return 0.06;
  if (relativeMoneyness > 0.05 && relativeMoneyness <= 0.08) return 0.08;
  if (relativeMoneyness > 0.08 && relativeMoneyness <= 0.12) return 0.10;
  if (relativeMoneyness > 0.12) return 0.15;
  return 0.04;
}

function buildMoneynessScenarios() {
  // Moneyness model = economically motivated approximation using strike distance.
  return [{
    scenario: 'moneyness',
    haircutPct: null,
    frictionModel: 'moneyness',
    getHaircutPct: tradeContext => getMoneynessHaircutPct(tradeContext.relativeMoneyness)
  }];
}

function buildScenarios(model, haircutsArg) {
  return model === 'moneyness'
    ? buildMoneynessScenarios()
    : buildUniformScenarios(haircutsArg);
}

function resolveInputPath(inputPath) {
  return path.isAbsolute(inputPath)
    ? inputPath
    : path.resolve(process.cwd(), inputPath);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function getRunName(runPath) {
  return path.basename(path.resolve(runPath));
}

function buildRunScenarioRow(runPath, summary, trades, scenario, year = null) {
  if (trades.length === 0) {
    throw new Error(`No trades found in ${path.join(runPath, 'trades.csv')}`);
  }

  let adjustedCapitalBefore = toNumber(trades[0].capital_before, 'capital_before');
  const initialCapital = adjustedCapitalBefore;
  let adjustedFinalCapital = adjustedCapitalBefore;
  let adjustedTotalPnL = 0;
  let adjustedCallPnL = 0;
  let originalTotalPnL = 0;
  let originalCallPnL = 0;
  let totalPremiumHaircutUsd = 0;
  let relativeMoneynessSum = 0;
  let relativeMoneynessCount = 0;
  let appliedHaircutPctSum = 0;
  let appliedHaircutPctCount = 0;

  for (const trade of trades) {
    const sEntry = toNumber(trade.S_entry, 'S_entry');
    const strike = optionalNumber(trade.strike, null);
    const cEntryBtc = optionalNumber(trade.C_entry_btc, 0);
    const btcPosition = optionalNumber(trade.btc_position, 0);
    const pnlCall = optionalNumber(trade.pnl_call, 0);
    const pnlTotal = optionalNumber(trade.pnl_total, 0);
    const relativeMoneyness = Number.isFinite(strike) && sEntry !== 0 ? (strike / sEntry) - 1 : null;
    const appliedHaircutPct = scenario.getHaircutPct({ trade, relativeMoneyness });
    const originalPremiumUsd = cEntryBtc * sEntry;
    const adjustedPremiumUsd = originalPremiumUsd * (1 - appliedHaircutPct);
    const premiumHaircutUsd = originalPremiumUsd - adjustedPremiumUsd;
    const positionedPremiumHaircutUsd = premiumHaircutUsd * btcPosition;
    const tradeAdjustedCallPnL = pnlCall - positionedPremiumHaircutUsd;
    const tradeAdjustedTotalPnL = pnlTotal - positionedPremiumHaircutUsd;

    adjustedFinalCapital = adjustedCapitalBefore + tradeAdjustedTotalPnL;
    adjustedCapitalBefore = adjustedFinalCapital;
    adjustedTotalPnL += tradeAdjustedTotalPnL;
    adjustedCallPnL += tradeAdjustedCallPnL;
    originalTotalPnL += pnlTotal;
    originalCallPnL += pnlCall;
    totalPremiumHaircutUsd += positionedPremiumHaircutUsd;
    if (Number.isFinite(relativeMoneyness)) {
      relativeMoneynessSum += relativeMoneyness;
      relativeMoneynessCount++;
    }
    if (Number.isFinite(appliedHaircutPct)) {
      appliedHaircutPctSum += appliedHaircutPct;
      appliedHaircutPctCount++;
    }
  }

  const originalReturnPct = Number.isFinite(Number(summary.runReturnPct))
    ? Number(summary.runReturnPct)
    : (originalTotalPnL / initialCapital) * 100;
  const adjustedReturnPct = ((adjustedFinalCapital / initialCapital) - 1) * 100;

  return {
    year,
    frictionModel: scenario.frictionModel,
    scenario: scenario.scenario,
    haircutPct: scenario.haircutPct,
    relativeMoneyness: relativeMoneynessCount > 0 ? relativeMoneynessSum / relativeMoneynessCount : null,
    appliedHaircutPct: appliedHaircutPctCount > 0 ? appliedHaircutPctSum / appliedHaircutPctCount : null,
    originalReturnPct,
    adjustedReturnPct,
    deltaReturnPct: adjustedReturnPct - originalReturnPct,
    originalTotalPnL,
    adjustedTotalPnL,
    totalPremiumHaircutUsd,
    adjustedFinalCapital,
    adjustedCallPnL,
    tradeCount: trades.length,
    runName: getRunName(runPath),
    originalCallPnL
  };
}

function analyzeRun(runPath, scenarios, year = null) {
  const tradesPath = path.join(runPath, 'trades.csv');
  const summaryPath = path.join(runPath, 'summary.json');

  if (!fs.existsSync(tradesPath)) {
    throw new Error(`Missing trades.csv in ${runPath}`);
  }
  if (!fs.existsSync(summaryPath)) {
    throw new Error(`Missing summary.json in ${runPath}`);
  }

  const trades = readCsv(tradesPath);
  const summary = readJson(summaryPath);
  return scenarios.map(scenario => buildRunScenarioRow(runPath, summary, trades, scenario, year));
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

function buildTotalRows(rows, scenarios) {
  return scenarios.map(scenario => {
    const scenarioRows = rows.filter(row => row.scenario === scenario.scenario);
    const originalReturnPct = chainReturnsPct(scenarioRows, 'originalReturnPct');
    const adjustedReturnPct = chainReturnsPct(scenarioRows, 'adjustedReturnPct');

    return {
      year: 'TOTAL',
      frictionModel: scenario.frictionModel,
      scenario: scenario.scenario,
      haircutPct: scenario.haircutPct,
      relativeMoneyness: weightedAverage(scenarioRows, 'relativeMoneyness', 'tradeCount'),
      appliedHaircutPct: weightedAverage(scenarioRows, 'appliedHaircutPct', 'tradeCount'),
      originalReturnPct,
      adjustedReturnPct,
      deltaReturnPct: adjustedReturnPct - originalReturnPct,
      originalTotalPnL: sumRows(scenarioRows, 'originalTotalPnL'),
      adjustedTotalPnL: sumRows(scenarioRows, 'adjustedTotalPnL'),
      totalPremiumHaircutUsd: sumRows(scenarioRows, 'totalPremiumHaircutUsd'),
      adjustedFinalCapital: null,
      adjustedCallPnL: sumRows(scenarioRows, 'adjustedCallPnL'),
      tradeCount: sumRows(scenarioRows, 'tradeCount'),
      runName: 'TOTAL',
      originalCallPnL: sumRows(scenarioRows, 'originalCallPnL')
    };
  });
}

function weightedAverage(rows, field, weightField) {
  const totals = rows.reduce((acc, row) => {
    const value = Number(row[field]);
    const weight = Number(row[weightField]);
    if (Number.isFinite(value) && Number.isFinite(weight) && weight > 0) {
      acc.weightedSum += value * weight;
      acc.weightSum += weight;
    }
    return acc;
  }, { weightedSum: 0, weightSum: 0 });
  return totals.weightSum > 0 ? totals.weightedSum / totals.weightSum : null;
}

function roundExportRow(row) {
  return {
    ...row,
    relativeMoneyness: roundNumber(row.relativeMoneyness, 4),
    appliedHaircutPct: roundNumber(row.appliedHaircutPct, 4),
    originalReturnPct: roundNumber(row.originalReturnPct),
    adjustedReturnPct: roundNumber(row.adjustedReturnPct),
    deltaReturnPct: roundNumber(row.deltaReturnPct),
    originalTotalPnL: roundNumber(row.originalTotalPnL),
    adjustedTotalPnL: roundNumber(row.adjustedTotalPnL),
    totalPremiumHaircutUsd: roundNumber(row.totalPremiumHaircutUsd),
    adjustedFinalCapital: roundNumber(row.adjustedFinalCapital),
    adjustedCallPnL: roundNumber(row.adjustedCallPnL),
    originalCallPnL: roundNumber(row.originalCallPnL)
  };
}

function saveOutputs(outputDir, rows, metadata, model) {
  fs.mkdirSync(outputDir, { recursive: true });
  const csv = objectsToCsv(rows);
  const json = JSON.stringify({
    ...metadata,
    generatedAt: new Date().toISOString(),
    rows
  }, null, 2);
  const modelPrefix = `execution_friction_${model}_summary`;

  fs.writeFileSync(path.join(outputDir, `${modelPrefix}.csv`), csv, 'utf8');
  fs.writeFileSync(path.join(outputDir, `${modelPrefix}.json`), json, 'utf8');
  fs.writeFileSync(path.join(outputDir, 'execution_friction_summary.csv'), csv, 'utf8');
  fs.writeFileSync(path.join(outputDir, 'execution_friction_summary.json'), json, 'utf8');
}

function analyzeSingleRun(runPath, scenarios, model) {
  const rows = analyzeRun(runPath, scenarios).map(roundExportRow);
  const outputDir = path.join(runPath, 'analysis', 'execution_friction', model);
  saveOutputs(outputDir, rows, {
    mode: 'single',
    frictionModel: model,
    runPath,
    note: 'First-order option premium haircut sensitivity analysis; not a full bid/ask simulator.'
  }, model);
  return { outputDir, rows };
}

function getSavedRunPath(batchDir, annualResult) {
  const savedRun = annualResult.savedRun || {};
  const rawRunPath = savedRun.runPath || savedRun.existingRunPath || savedRun.runName || savedRun.existingRunName;
  if (!rawRunPath) {
    throw new Error(`Batch annual result for year ${annualResult.year} is missing savedRun.runPath`);
  }

  if (path.isAbsolute(rawRunPath)) return rawRunPath;
  if (rawRunPath.startsWith('runs/') || rawRunPath.startsWith('runs\\')) {
    return path.resolve(process.cwd(), rawRunPath);
  }
  return path.resolve(batchDir, '..', '..', rawRunPath);
}

function analyzeBatch(batchDir, scenarios, model) {
  const summaryPath = path.join(batchDir, 'summary.json');
  if (!fs.existsSync(summaryPath)) {
    throw new Error(`Missing batch summary.json in ${batchDir}`);
  }

  const batchSummary = readJson(summaryPath);
  const annualResults = Array.isArray(batchSummary.annualResults) ? batchSummary.annualResults : [];
  if (annualResults.length === 0) {
    throw new Error(`Batch summary has no annualResults: ${summaryPath}`);
  }

  const annualRows = [];
  for (const annualResult of annualResults) {
    const runPath = getSavedRunPath(batchDir, annualResult);
    annualRows.push(...analyzeRun(runPath, scenarios, annualResult.year));
  }

  const rows = [...annualRows, ...buildTotalRows(annualRows, scenarios)].map(roundExportRow);
  const outputDir = path.join(batchDir, 'analysis', 'execution_friction', model);
  saveOutputs(outputDir, rows, {
    mode: 'batch',
    frictionModel: model,
    batchPath: batchDir,
    batchName: batchSummary.batchName || path.basename(batchDir),
    note: 'First-order option premium haircut sensitivity analysis; not a full bid/ask simulator.'
  }, model);
  return { outputDir, rows };
}

function formatOptionalNumber(value) {
  return value === null || value === undefined ? null : Number(value).toFixed(2);
}

function formatConsoleRows(rows) {
  return rows.map(row => ({
    year: row.year,
    frictionModel: row.frictionModel,
    scenario: row.scenario,
    haircutPct: row.haircutPct,
    appliedHaircutPct: row.appliedHaircutPct,
    originalReturnPct: formatOptionalNumber(row.originalReturnPct),
    adjustedReturnPct: formatOptionalNumber(row.adjustedReturnPct),
    deltaReturnPct: formatOptionalNumber(row.deltaReturnPct),
    totalPremiumHaircutUsd: formatOptionalNumber(row.totalPremiumHaircutUsd),
    adjustedFinalCapital: formatOptionalNumber(row.adjustedFinalCapital),
    tradeCount: row.tradeCount
  }));
}

function main() {
  const args = parseArgs(process.argv);
  const hasRun = Boolean(args.run);
  const hasBatch = Boolean(args.batch);

  if (hasRun === hasBatch) {
    throw new Error('Use exactly one input mode: --run=runs/<run_name> or --batch=runs/batches/<batch_name>');
  }

  const model = parseModel(args.model);
  const scenarios = buildScenarios(model, args.haircuts);
  const result = hasRun
    ? analyzeSingleRun(resolveInputPath(args.run), scenarios, model)
    : analyzeBatch(resolveInputPath(args.batch), scenarios, model);

  console.table(formatConsoleRows(result.rows));
  console.log(`Saved execution friction outputs to ${result.outputDir}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('Error analyzing execution friction:', error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  main,
  parseArgs,
  parseHaircuts,
  parseModel,
  buildScenarios,
  getMoneynessHaircutPct,
  roundNumber,
  analyzeRun,
  analyzeSingleRun,
  analyzeBatch
};
