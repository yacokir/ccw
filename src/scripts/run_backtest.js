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

function buildRunName(config, suffix) {
  const asset = config.underlying && config.underlying.toUpperCase().includes('BTC') ? 'btc' : String(config.underlying).toLowerCase().replace(/[^a-z0-9]+/g, '');
  const xOtm = Number(config.xOtm);
  const xOtmLabel = `x${String(Math.round(xOtm * 100)).padStart(2, '0')}`;
  const stepLabel = `step${config.strikeStep}`;
  const fallbackLabel = String(config.fallbackMode).replace(/_/g, '');
  const sizingLabel = config.sizingMode === 'dynamic' ? 'dyn' : String(config.sizingMode).replace(/_/g, '');
  const base = `${asset}_${config.startDate}_${config.endDate}_${xOtmLabel}_${stepLabel}_${fallbackLabel}_${sizingLabel}`;
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
    return row;
  });
}

function formatRowForIndex(row) {
  return [
    row.run_name,
    row.startDate,
    row.endDate,
    row.underlying,
    row.xOtm,
    row.strikeStep,
    row.strikeRange,
    row.fallbackMode,
    row.sizingMode,
    row.finalCapital,
    row.totalPnL,
    row.callWeeks,
    row.totalWeeks,
    row.path,
    row.createdAt
  ];
}

function buildIndexCsv(rows) {
  const headers = ['run_name','startDate','endDate','underlying','xOtm','strikeStep','strikeRange','fallbackMode','sizingMode','finalCapital','totalPnL','callWeeks','totalWeeks','path','createdAt'];
  const lines = [headers.join(',')];
  for (const row of rows) {
    const values = headers.map(header => {
      const value = row[header] == null ? '' : String(row[header]);
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

async function main() {
  const argv = parseArgs(process.argv);
  const config = {
    startDate: normalizeArgValue(argv.startDate, '2025-10-03'),
    endDate: normalizeArgValue(argv.endDate, '2025-12-26'),
    xOtm: argv.xOtm !== undefined ? parseFloat(argv.xOtm) : 0.05,
    underlying: normalizeArgValue(argv.underlying, 'BTC-PERPETUAL'),
    strikeStep: argv.strikeStep !== undefined ? parseInt(argv.strikeStep, 10) : 1000,
    strikeRange: argv.strikeRange !== undefined ? parseInt(argv.strikeRange, 10) : 3000,
    fallbackMode: normalizeArgValue(argv.fallbackMode, 'long_btc'),
    sizingMode: normalizeArgValue(argv.sizingMode, 'dynamic'),
    maxEntryDelayMinutes: argv.maxEntryDelayMinutes !== undefined ? parseInt(argv.maxEntryDelayMinutes, 10) : 60,
    entryHourUtc: argv.entryHourUtc !== undefined ? parseInt(argv.entryHourUtc, 10) : 8,
    entryMinuteUtc: argv.entryMinuteUtc !== undefined ? parseInt(argv.entryMinuteUtc, 10) : 0
  };

  const runsDir = path.resolve(__dirname, '..', '..', 'runs');
  const indexPath = path.join(runsDir, 'index.csv');
  const indexRows = readRunIndex(indexPath);

  const identicalRow = indexRows.find(row =>
    row.startDate === config.startDate &&
    row.endDate === config.endDate &&
    row.underlying === config.underlying &&
    Number(row.xOtm) === config.xOtm &&
    Number(row.strikeStep) === config.strikeStep &&
    Number(row.strikeRange) === config.strikeRange &&
    row.fallbackMode === config.fallbackMode &&
    row.sizingMode === config.sizingMode
  );

  if (identicalRow) {
    console.warn('Warning: an identical run already exists.');
    console.warn(`Existing run: ${identicalRow.run_name}`);
    console.warn(`Path: ${identicalRow.path}`);
    return;
  }

  const overlaps = indexRows.filter(row =>
    row.underlying === config.underlying &&
    Number(row.xOtm) === config.xOtm &&
    Number(row.strikeStep) === config.strikeStep &&
    Number(row.strikeRange) === config.strikeRange &&
    row.fallbackMode === config.fallbackMode &&
    row.sizingMode === config.sizingMode &&
    !(new Date(config.endDate) < new Date(row.startDate) || new Date(config.startDate) > new Date(row.endDate))
  );

  if (overlaps.length > 0) {
    console.warn('Warning: overlapping run periods found for the same strategy parameters:');
    overlaps.forEach(row => {
      console.warn(`- ${row.run_name} (${row.startDate} to ${row.endDate})`);
    });
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

  const result = await runStrategy(config);
  fs.mkdirSync(runPath, { recursive: true });

  const configPath = path.join(runPath, 'config.json');
  const tradesPath = path.join(runPath, 'trades.csv');
  const equityPath = path.join(runPath, 'equity_curve.csv');
  const summaryPath = path.join(runPath, 'summary.json');

  fs.writeFileSync(configPath, JSON.stringify(result.config, null, 2), 'utf8');
  fs.writeFileSync(tradesPath, objectsToCsv(result.trades), 'utf8');
  fs.writeFileSync(equityPath, objectsToCsv(result.equityCurve), 'utf8');
  fs.writeFileSync(summaryPath, JSON.stringify(result.summary, null, 2), 'utf8');

  const newIndexRow = {
    run_name: runName,
    startDate: config.startDate,
    endDate: config.endDate,
    underlying: config.underlying,
    xOtm: config.xOtm,
    strikeStep: config.strikeStep,
    strikeRange: config.strikeRange,
    fallbackMode: config.fallbackMode,
    sizingMode: config.sizingMode,
    finalCapital: result.summary.finalCapital,
    totalPnL: result.summary.totalPnL,
    callWeeks: result.summary.callWeeks,
    totalWeeks: result.summary.totalWeeks,
    path: runName,
    createdAt: new Date().toISOString()
  };

  const updatedIndexRows = [...indexRows, newIndexRow];
  fs.writeFileSync(indexPath, buildIndexCsv(updatedIndexRows), 'utf8');

  console.log(`Run saved to ${runPath}`);
}

if (require.main === module) {
  main();
}

module.exports = { main };
