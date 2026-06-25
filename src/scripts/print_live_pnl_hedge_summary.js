const fs = require('fs');
const path = require('path');

const {
  REPO_ROOT,
  optionalNumber,
  roundNumber,
  readJson
} = require('./btc_deep_risk_utils');

const LIVE_DIR = path.join(REPO_ROOT, 'live');
const LIVE_DATA_DIR = path.join(LIVE_DIR, 'data');
const POSITION_REGISTER_PATH = path.join(LIVE_DIR, 'position_register.json');
const LIVE_POSITION_MONITORING_PATH = path.join(LIVE_DATA_DIR, 'live_position_monitoring.json');
const LIVE_MONITORING_SIGNALS_PATH = path.join(LIVE_DATA_DIR, 'live_monitoring_signals.json');

const HEDGE_BY_STATE = {
  normal: 0,
  watch: 0,
  stress: 30,
  crisis: 40
};

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function loadRows(filePath) {
  if (!fs.existsSync(filePath)) return new Map();
  const payload = readJson(filePath);
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  return new Map(rows.filter(row => row.asset).map(row => [row.asset, row]));
}

function loadActivePositions() {
  if (!fs.existsSync(POSITION_REGISTER_PATH)) {
    fail(`Missing Position Register: ${path.relative(REPO_ROOT, POSITION_REGISTER_PATH)}`);
    return [];
  }
  const payload = readJson(POSITION_REGISTER_PATH);
  const positions = Array.isArray(payload.positions) ? payload.positions : [];
  const active = positions.filter(position => String(position.status || position.position_status || '').toUpperCase() === 'ACTIVE');
  if (!active.length) {
    fail('Position Register has no ACTIVE positions.');
  }
  return active;
}

function formatMoney(value) {
  const number = optionalNumber(value);
  if (number === null) return 'N/A';
  return `${number.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
}

function formatPct(value) {
  const number = optionalNumber(value);
  if (number === null) return 'N/A';
  return `${number.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}%`;
}

function formatPnlPct(value) {
  const number = optionalNumber(value);
  if (number === null) return 'N/A';
  return `${number.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function formatPnlWithPct(pnl, capital) {
  const pnlNumber = optionalNumber(pnl);
  const capitalNumber = optionalNumber(capital);
  const money = formatMoney(pnlNumber);
  if (pnlNumber === null || capitalNumber === null || capitalNumber === 0) {
    return `${money} (N/A)`;
  }
  return `${money} (${formatPnlPct((pnlNumber / capitalNumber) * 100)})`;
}

function value(raw) {
  return raw === null || raw === undefined || raw === '' ? 'N/A' : String(raw);
}

function firstValue(...items) {
  for (const item of items) {
    if (item !== null && item !== undefined && item !== '') return String(item);
  }
  return 'N/A';
}

function currentHedgePct(row, position) {
  const hedgeQty = optionalNumber(row && row.hedge_qty, position && position.hedge_qty);
  const underlyingQty = optionalNumber(row && row.underlying_qty, position && position.underlying_qty);
  if (hedgeQty === null || underlyingQty === null || underlyingQty === 0) return null;
  return roundNumber(Math.abs(hedgeQty) / Math.abs(underlyingQty) * 100);
}

function hedgeDeltaPct(currentHedge, targetHedge) {
  if (currentHedge === null || targetHedge === null) return null;
  const delta = roundNumber(targetHedge - currentHedge);
  return Math.abs(delta) < 0.5 ? 0 : delta;
}

function underlyingEntryPrice(row, position) {
  return optionalNumber(
    row && row.underlying_entry_price,
    position && position.underlying_entry_price,
    row && row.underlying_cost_basis && row.underlying_cost_basis.average_entry_price,
    position && position.underlying_cost_basis && position.underlying_cost_basis.average_entry_price
  );
}

function todayActionFor(asset, targetHedgePct, deltaPct) {
  const target = optionalNumber(targetHedgePct);
  const delta = optionalNumber(deltaPct);
  const symbol = `${asset}USDT`;
  if (target === null || delta === null) return 'N/A';
  if (target === 0 && delta === 0) return 'NO ACTION';
  if (target === 0 && delta < 0) return 'CLOSE HEDGE';
  if (delta > 0) return `SELL ${symbol} PERP (${formatPct(delta)} of spot exposure)`;
  if (delta < 0) return `REDUCE HEDGE TO ${formatPct(target)}`;
  return 'NO ACTION';
}

function circuitWarnings(position, row, signal) {
  const warnings = [];
  if (!row) warnings.push('Registered position monitoring unavailable.');
  if (!signal) warnings.push('Live monitoring signal unavailable.');
  if (row && Array.isArray(row.warnings)) warnings.push(...row.warnings);
  if (optionalNumber(row && row.current_spot_price) === null) warnings.push('Spot price unavailable.');
  if (optionalNumber(row && row.option_mtm_pnl, row && row.option_unrealized_pnl_approx) === null) warnings.push('Option PnL unavailable.');
  if (optionalNumber(row && row.hedge_unrealized_pnl_approx) === null) warnings.push('Hedge PnL unavailable.');
  if (optionalNumber(row && row.underlying_unrealized_pnl) === null) warnings.push('Underlying PnL unavailable.');
  if (position && row && row.option_instrument && position.option_instrument && row.option_instrument !== position.option_instrument) {
    warnings.push(`Option instrument mismatch: register=${position.option_instrument}; monitoring=${row.option_instrument}.`);
  }
  return warnings;
}

function printAsset(position, rows, signals) {
  const asset = position.asset;
  const row = rows.get(asset) || null;
  const signal = signals.get(asset) || null;
  const currentHedge = currentHedgePct(row, position);
  const targetHedge = signal ? (HEDGE_BY_STATE[signal.alert_state] ?? 0) : null;
  const hedgeDelta = hedgeDeltaPct(currentHedge, targetHedge);
  const underlyingPnl = optionalNumber(row && row.underlying_unrealized_pnl);
  const optionPnl = optionalNumber(row && row.option_mtm_pnl, row && row.option_unrealized_pnl_approx);
  const hedgePnl = optionalNumber(row && row.hedge_unrealized_pnl_approx);
  const netPnl = optionalNumber(row && row.net_unrealized_pnl_approx);
  const underlyingQty = optionalNumber(row && row.underlying_qty, position && position.underlying_qty);
  const underlyingEntry = underlyingEntryPrice(row, position);
  const initialCapital = underlyingQty === null || underlyingEntry === null
    ? null
    : Math.abs(underlyingQty) * underlyingEntry;
  const warnings = circuitWarnings(position, row, signal);

  console.log(asset);
  console.log('----------------------------------------');
  console.log(`Option instrument: ${firstValue(row && row.option_instrument, position.option_instrument)}`);
  console.log(`Hedge instrument: ${firstValue(row && row.hedge_instrument, position.hedge_instrument)}`);
  console.log(`Underlying PnL: ${formatMoney(underlyingPnl)}`);
  console.log(`Option PnL: ${formatMoney(optionPnl)}`);
  console.log(`Hedge PnL: ${formatMoney(hedgePnl)}`);
  console.log(`Net PnL: ${formatPnlWithPct(netPnl, initialCapital)}`);
  console.log(`Current hedge: ${formatPct(currentHedge)}`);
  console.log(`Target hedge: ${formatPct(targetHedge)}`);
  console.log(`Hedge delta: ${formatPct(hedgeDelta)}`);
  console.log(`Today action: ${todayActionFor(asset, targetHedge, hedgeDelta)}`);
  console.log(`Damage / Alert: ${value(signal && signal.damage_state)} / ${value(signal && signal.alert_state)}`);
  console.log(`Circuit breaker / warnings: ${warnings.length ? warnings.join('; ') : 'OK'}`);
  console.log('');

  return {
    netPnl,
    initialCapital,
    hasValidCapital: initialCapital !== null
  };
}

function printTotal(summaries) {
  const validPnls = summaries.map(row => row.netPnl).filter(row => row !== null);
  const totalNetPnl = validPnls.length === summaries.length
    ? validPnls.reduce((sum, row) => sum + row, 0)
    : null;
  const allCapitalValid = summaries.every(row => row.hasValidCapital);
  const totalInitialCapital = allCapitalValid
    ? summaries.reduce((sum, row) => sum + row.initialCapital, 0)
    : null;

  console.log('TOTAL');
  console.log('----------------------------------------');
  console.log(`Net PnL: ${formatPnlWithPct(totalNetPnl, totalInitialCapital)}`);
}

function main() {
  const positions = loadActivePositions();
  if (process.exitCode) return;

  const rows = loadRows(LIVE_POSITION_MONITORING_PATH);
  const signals = loadRows(LIVE_MONITORING_SIGNALS_PATH);

  console.log('CCW Live PnL / Hedge Summary');
  console.log('');

  const summaries = positions.map(position => printAsset(position, rows, signals));
  printTotal(summaries);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`Error printing live PnL / hedge summary: ${error.stack || error.message}`);
    process.exitCode = 1;
  }
}
