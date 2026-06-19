const fs = require('fs');
const https = require('https');
const path = require('path');

const {
  REPO_ROOT,
  optionalNumber,
  roundNumber,
  sampleStdDev,
  percentile
} = require('./btc_deep_risk_utils');

const LIVE_DATA_DIR = path.join(REPO_ROOT, 'live', 'data');
const LAMBDA = 0.94;
const MAX_DAILY_GAP_DAYS = 3;
const MIN_REALIZED_VOL_RETURNS = 10;
const VAR_OBSERVATIONS = 30;
const KLINE_LIMIT = 120;

const ASSETS = [
  {
    asset: 'BTC',
    bybitSymbol: 'BTCUSDT',
    output: path.join(LIVE_DATA_DIR, 'btc_live_metrics.json'),
    historyOutput: path.join(LIVE_DATA_DIR, 'btc_live_price_history.json')
  },
  {
    asset: 'ETH',
    bybitSymbol: 'ETHUSDT',
    output: path.join(LIVE_DATA_DIR, 'eth_live_metrics.json'),
    historyOutput: path.join(LIVE_DATA_DIR, 'eth_live_price_history.json')
  }
];

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

async function fetchBybitTicker(asset) {
  const url = `https://api.bybit.com/v5/market/tickers?category=linear&symbol=${asset.bybitSymbol}`;
  const payload = await fetchJson(url);
  const ticker = payload && payload.result && Array.isArray(payload.result.list)
    ? payload.result.list[0]
    : null;
  const price = optionalNumber(ticker && ticker.lastPrice);
  if (price === null) throw new Error(`Missing lastPrice in Bybit response for ${asset.bybitSymbol}`);
  return {
    endpoint: url,
    price,
    exchangeTimestamp: optionalNumber(payload.time) === null ? null : new Date(Number(payload.time)).toISOString()
  };
}

async function fetchBybitDailyKlines(asset) {
  const url = `https://api.bybit.com/v5/market/kline?category=linear&symbol=${asset.bybitSymbol}&interval=D&limit=${KLINE_LIMIT}`;
  const payload = await fetchJson(url);
  const list = payload && payload.result && Array.isArray(payload.result.list)
    ? payload.result.list
    : [];
  const rows = list.map(item => {
    const timestamp = optionalNumber(item[0]);
    const close = optionalNumber(item[4]);
    return {
      date: timestamp === null ? null : new Date(timestamp).toISOString().slice(0, 10),
      timestamp: timestamp === null ? null : new Date(timestamp).toISOString(),
      open: optionalNumber(item[1]),
      high: optionalNumber(item[2]),
      low: optionalNumber(item[3]),
      close,
      volume: optionalNumber(item[5]),
      turnover: optionalNumber(item[6])
    };
  }).filter(row => row.date && row.close !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
  return { endpoint: url, rows };
}

function daysBetween(a, b) {
  const start = new Date(`${a}T00:00:00Z`);
  const end = new Date(`${b}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

function latestRowOnOrBefore(rows, date) {
  const candidates = rows.filter(row => row.date <= date);
  return candidates.length ? candidates[candidates.length - 1] : null;
}

function rowNearTarget(rows, date, daysBack) {
  const target = new Date(`${date}T00:00:00Z`);
  target.setUTCDate(target.getUTCDate() - daysBack);
  const targetDate = target.toISOString().slice(0, 10);
  const row = latestRowOnOrBefore(rows, targetDate);
  if (!row) return null;
  const gap = daysBetween(row.date, targetDate);
  return gap !== null && gap >= 0 && gap <= MAX_DAILY_GAP_DAYS ? row : null;
}

function returnPct(current, prior) {
  if (!current || !prior || prior.close === 0) return null;
  return roundNumber((current.close / prior.close - 1) * 100);
}

function adjacentReturns(rows) {
  const returns = [];
  for (let i = 1; i < rows.length; i++) {
    const gap = daysBetween(rows[i - 1].date, rows[i].date);
    if (gap !== null && gap > 0 && gap <= MAX_DAILY_GAP_DAYS && rows[i - 1].close !== 0) {
      returns.push({
        date: rows[i].date,
        returnPct: (rows[i].close / rows[i - 1].close - 1) * 100
      });
    }
  }
  return returns;
}

function realizedVol30d(rows, date) {
  const start = new Date(`${date}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 30);
  const startDate = start.toISOString().slice(0, 10);
  const returns = adjacentReturns(rows)
    .filter(row => row.date >= startDate && row.date <= date)
    .map(row => row.returnPct);
  return returns.length >= MIN_REALIZED_VOL_RETURNS ? roundNumber(sampleStdDev(returns)) : null;
}

function ewmaVol(rows, date) {
  const returns = adjacentReturns(rows).filter(row => row.date <= date);
  if (!returns.length || returns[returns.length - 1].date !== date) return null;
  let variance = null;
  for (const row of returns) {
    const decimalReturn = row.returnPct / 100;
    variance = variance === null
      ? decimalReturn ** 2
      : LAMBDA * variance + (1 - LAMBDA) * decimalReturn ** 2;
  }
  return variance === null ? null : roundNumber(Math.sqrt(variance) * 100);
}

function historicalVar(rows, date) {
  const returns = adjacentReturns(rows).filter(row => row.date <= date);
  if (returns.length < VAR_OBSERVATIONS || returns[returns.length - 1].date !== date) return null;
  return roundNumber(percentile(returns.slice(-VAR_OBSERVATIONS).map(row => row.returnPct), 0.05));
}

function buildLiveHistory(klineRows, ticker, snapshotDate) {
  const currentRow = {
    date: snapshotDate,
    timestamp: ticker.exchangeTimestamp,
    open: null,
    high: null,
    low: null,
    close: ticker.price,
    volume: null,
    turnover: null,
    source: 'bybit_ticker_current_price'
  };
  return [...klineRows.filter(row => row.date < snapshotDate), currentRow]
    .sort((a, b) => a.date.localeCompare(b.date));
}

function buildMetrics(asset, ticker, kline, snapshotDate) {
  const rows = buildLiveHistory(kline.rows, ticker, snapshotDate);
  const currentRow = latestRowOnOrBefore(rows, snapshotDate);
  const realizedVolDailyPct = realizedVol30d(rows, snapshotDate);
  const ewmaDailyPct = ewmaVol(rows, snapshotDate);
  const historicalVarPct = historicalVar(rows, snapshotDate);

  return {
    generated_at: new Date().toISOString(),
    asset: asset.asset,
    source: 'bybit_public_linear_ticker_and_daily_kline',
    venue: 'Bybit',
    symbol: asset.bybitSymbol,
    endpoints: {
      ticker: ticker.endpoint,
      daily_kline: kline.endpoint
    },
    timestamp: ticker.exchangeTimestamp,
    data_as_of: snapshotDate,
    snapshot_date: snapshotDate,
    current_price: roundNumber(ticker.price),
    return_7d_pct: returnPct(currentRow, rowNearTarget(rows, snapshotDate, 7)),
    return_30d_pct: returnPct(currentRow, rowNearTarget(rows, snapshotDate, 30)),
    return_90d_pct: returnPct(currentRow, rowNearTarget(rows, snapshotDate, 90)),
    realized_vol_30d_pct: realizedVolDailyPct,
    realized_vol_daily_pct: realizedVolDailyPct,
    EWMA_pct: ewmaDailyPct,
    ewma_daily_pct: ewmaDailyPct,
    historical_VaR_pct: historicalVarPct,
    observation_count: rows.length,
    history_start_date: rows.length ? rows[0].date : null,
    history_end_date: rows.length ? rows[rows.length - 1].date : null,
    methodology: {
      price: 'Bybit public v5 market ticker, linear USDT perpetual symbol.',
      history: `Bybit public v5 daily kline, linear USDT perpetual symbol, latest ${KLINE_LIMIT} candles requested.`,
      returns: 'Current public price compared with recent public daily close history at 7d, 30d, and 90d lookbacks.',
      realizedVol: 'Sample standard deviation of adjacent spot returns in the last 30 calendar days; large gaps are not bridged.',
      ewma: `Recursive EWMA over adjacent spot returns with lambda = ${LAMBDA}; large gaps are not bridged.`,
      historicalVaR: 'Empirical 5th percentile over the latest 30 adjacent spot returns ending on the snapshot date.'
    },
    validation: {
      kline_observation_count: kline.rows.length,
      combined_observation_count: rows.length,
      max_daily_gap_days: MAX_DAILY_GAP_DAYS,
      required_var_observations: VAR_OBSERVATIONS,
      metrics_may_be_null_when_recent_history_is_unavailable: true
    }
  };
}

function buildHistoryPayload(asset, ticker, kline, snapshotDate) {
  const rows = buildLiveHistory(kline.rows, ticker, snapshotDate);
  return {
    generated_at: new Date().toISOString(),
    asset: asset.asset,
    source: 'bybit_public_linear_daily_kline_plus_current_ticker',
    symbol: asset.bybitSymbol,
    endpoints: {
      ticker: ticker.endpoint,
      daily_kline: kline.endpoint
    },
    data_as_of: snapshotDate,
    observation_count: rows.length,
    history_start_date: rows.length ? rows[0].date : null,
    history_end_date: rows.length ? rows[rows.length - 1].date : null,
    rows
  };
}

async function main() {
  const snapshotDate = nyDate();
  fs.mkdirSync(LIVE_DATA_DIR, { recursive: true });

  for (const asset of ASSETS) {
    const ticker = await fetchBybitTicker(asset);
    const kline = await fetchBybitDailyKlines(asset);
    const history = buildHistoryPayload(asset, ticker, kline, snapshotDate);
    const metrics = buildMetrics(asset, ticker, kline, snapshotDate);
    fs.writeFileSync(asset.historyOutput, `${JSON.stringify(history, null, 2)}\n`, 'utf8');
    fs.writeFileSync(asset.output, `${JSON.stringify(metrics, null, 2)}\n`, 'utf8');
    console.log(`${asset.asset}: wrote ${path.relative(REPO_ROOT, asset.output)} price=${metrics.current_price} observations=${metrics.observation_count}`);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(`Error refreshing live research data: ${error.stack || error.message}`);
    process.exitCode = 1;
  });
}
