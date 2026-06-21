const fs = require('fs');
const https = require('https');
const path = require('path');

const {
  REPO_ROOT,
  optionalNumber,
  roundNumber
} = require('./btc_deep_risk_utils');

const LIVE_DIR = path.join(REPO_ROOT, 'live');
const LIVE_DATA_DIR = path.join(LIVE_DIR, 'data');
const POSITION_REGISTER_PATH = path.join(LIVE_DIR, 'position_register.json');
const OUTPUT_JSON = path.join(LIVE_DATA_DIR, 'live_position_monitoring.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function nyDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const mapped = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${mapped.year}-${mapped.month}-${mapped.day}`;
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        body += chunk;
      });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`HTTP ${response.statusCode} from ${url}: ${body.slice(0, 200)}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new Error(`Invalid JSON from ${url}: ${error.message}`));
        }
      });
    }).on('error', reject);
  });
}

async function fetchBybitOptionTicker(symbol) {
  const url = `https://api.bybit.com/v5/market/tickers?category=option&symbol=${encodeURIComponent(symbol)}`;
  const payload = await fetchJson(url);
  const row = payload && payload.result && Array.isArray(payload.result.list)
    ? payload.result.list[0]
    : null;
  return { endpoint: url, row };
}

function daysBetween(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

function optionMtmPnl(position, markPrice) {
  const entry = optionalNumber(position.option_entry_premium);
  const qty = optionalNumber(position.option_qty);
  const mark = optionalNumber(markPrice);
  if (entry === null || qty === null || mark === null) return null;
  return roundNumber((mark - entry) * qty);
}

function normalizeTicker(row) {
  return {
    option_bid: optionalNumber(row && row.bid1Price, row && row.bidPrice),
    option_ask: optionalNumber(row && row.ask1Price, row && row.askPrice),
    option_mark_price: optionalNumber(row && row.markPrice),
    option_last_price: optionalNumber(row && row.lastPrice),
    implied_volatility: optionalNumber(row && row.markIv, row && row.bidIv, row && row.askIv),
    delta: optionalNumber(row && row.delta),
    gamma: optionalNumber(row && row.gamma),
    vega: optionalNumber(row && row.vega),
    theta: optionalNumber(row && row.theta)
  };
}

function loadActivePositions() {
  if (!fs.existsSync(POSITION_REGISTER_PATH)) {
    throw new Error(`Missing Position Register: ${path.relative(REPO_ROOT, POSITION_REGISTER_PATH)}`);
  }
  const register = readJson(POSITION_REGISTER_PATH);
  const positions = Array.isArray(register.positions) ? register.positions : [];
  const active = positions.filter(position => String(position.status || '').toUpperCase() === 'ACTIVE');
  if (!active.length) {
    throw new Error('Position Register has no ACTIVE positions. Active monitoring requires a registered open cycle.');
  }
  return active;
}

async function monitorPosition(position, snapshotDate) {
  const warnings = [];
  const instrument = position.option_instrument;
  let tickerResult = { endpoint: null, row: null };
  let ticker = {};

  if (!instrument) {
    warnings.push('Registered option_instrument is missing.');
  } else {
    tickerResult = await fetchBybitOptionTicker(instrument);
    if (!tickerResult.row) warnings.push('Bybit public ticker did not return the registered option instrument.');
    ticker = normalizeTicker(tickerResult.row);
  }

  return {
    asset: position.asset,
    cycle_id: position.cycle_id,
    data_as_of: snapshotDate,
    generated_at: new Date().toISOString(),
    monitoring_source: 'position_register_bybit_public_option_ticker',
    venue: 'Bybit',
    option_instrument: instrument || null,
    option_expiry: position.option_expiry || null,
    days_to_expiration: position.option_expiry ? daysBetween(snapshotDate, position.option_expiry) : null,
    option_strike: optionalNumber(position.option_strike),
    option_qty: optionalNumber(position.option_qty),
    option_entry_premium: optionalNumber(position.option_entry_premium),
    hedge_instrument: position.hedge_instrument || null,
    hedge_qty: optionalNumber(position.hedge_qty),
    hedge_entry_price: optionalNumber(position.hedge_entry_price),
    underlying_qty: optionalNumber(position.underlying_qty),
    option_bid: roundNumber(ticker.option_bid),
    option_ask: roundNumber(ticker.option_ask),
    option_mark_price: roundNumber(ticker.option_mark_price),
    option_last_price: roundNumber(ticker.option_last_price),
    implied_volatility: roundNumber(ticker.implied_volatility),
    greeks: {
      delta: roundNumber(ticker.delta),
      gamma: roundNumber(ticker.gamma),
      vega: roundNumber(ticker.vega),
      theta: roundNumber(ticker.theta)
    },
    option_mtm_pnl: optionMtmPnl(position, ticker.option_mark_price),
    warnings,
    notes: position.notes || '',
    endpoints: {
      option_ticker: tickerResult.endpoint
    }
  };
}

async function main() {
  const snapshotDate = nyDate();
  fs.mkdirSync(LIVE_DATA_DIR, { recursive: true });
  const activePositions = loadActivePositions();
  const rows = [];

  for (const position of activePositions) {
    const row = await monitorPosition(position, snapshotDate);
    rows.push(row);
    console.log(`${row.asset}: monitored ${row.option_instrument || 'missing_option'} mark=${row.option_mark_price === null ? 'null' : row.option_mark_price}`);
  }

  const payload = {
    generated_at: new Date().toISOString(),
    data_as_of: snapshotDate,
    position_register: path.relative(REPO_ROOT, POSITION_REGISTER_PATH),
    rows
  };
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_JSON)}`);
}

if (require.main === module) {
  main().catch(error => {
    console.error(`Error refreshing live position monitoring: ${error.stack || error.message}`);
    process.exitCode = 1;
  });
}
