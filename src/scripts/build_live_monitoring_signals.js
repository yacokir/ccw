const fs = require('fs');
const path = require('path');

const {
  REPO_ROOT,
  optionalNumber,
  roundNumber,
  percentile
} = require('./btc_deep_risk_utils');

const LIVE_DATA_DIR = path.join(REPO_ROOT, 'live', 'data');
const OUTPUT_JSON = path.join(LIVE_DATA_DIR, 'live_monitoring_signals.json');

const THRESHOLDS = {
  drawdownPct: { watch: -20, stress: -40, crisis: -60 },
  ewmaVolPct: { watch: 4.25, stress: 6.00, crisis: 8.00 },
  historicalVaRLossPct: { watch: 6.00, stress: 10.00, crisis: 12.00 },
  dailyReturnPct: { watch: -2, stress: -5, crisis: -10 },
  underwaterDurationDays: { watch: 14, stress: 21 }
};

const STATES = ['normal', 'watch', 'stress', 'crisis'];
const RANK = Object.fromEntries(STATES.map((s, i) => [s, i]));
const TAIL_WINDOW = 7;
const TAIL_CLUSTER_COUNT = 2;
const TAIL_CLUSTER_THRESHOLD = -2;
const VAR_OBSERVATIONS = 30;
const METHODOLOGY_VERSION = 'v0.4b_live_price_proxy';

const ASSETS = [
  {
    asset: 'BTC',
    metricsPath: path.join(LIVE_DATA_DIR, 'btc_live_metrics.json'),
    historyPath: path.join(LIVE_DATA_DIR, 'btc_live_price_history.json')
  },
  {
    asset: 'ETH',
    metricsPath: path.join(LIVE_DATA_DIR, 'eth_live_metrics.json'),
    historyPath: path.join(LIVE_DATA_DIR, 'eth_live_price_history.json')
  }
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function severity(value, thresholds, direction) {
  if (value === null) return 'normal';
  if (direction === 'lte') {
    if (value <= thresholds.crisis) return 'crisis';
    if (value <= thresholds.stress) return 'stress';
    if (value <= thresholds.watch) return 'watch';
    return 'normal';
  }
  if (thresholds.crisis !== undefined && value >= thresholds.crisis) return 'crisis';
  if (value >= thresholds.stress) return 'stress';
  if (value >= thresholds.watch) return 'watch';
  return 'normal';
}

function maxState(states) {
  return states.reduce((max, state) => RANK[state] > RANK[max] ? state : max, 'normal');
}

function capState(state, cap) {
  return RANK[state] > RANK[cap] ? cap : state;
}

function dailyReturns(rows) {
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const prev = optionalNumber(rows[i - 1].close);
    const next = optionalNumber(rows[i].close);
    if (prev !== null && next !== null && prev !== 0) {
      out.push({
        date: rows[i].date,
        returnPct: (next / prev - 1) * 100
      });
    }
  }
  return out;
}

function latestDrawdown(rows) {
  let peak = null;
  let underwaterDuration = 0;
  let drawdownPct = null;

  for (const row of rows) {
    const close = optionalNumber(row.close);
    if (close === null) continue;
    peak = peak === null ? close : Math.max(peak, close);
    drawdownPct = peak > 0 ? (close / peak - 1) * 100 : null;
    if (drawdownPct !== null && drawdownPct < 0) underwaterDuration += 1;
    else underwaterDuration = 0;
  }

  return {
    drawdownPct: roundNumber(drawdownPct),
    underwaterDurationDays: underwaterDuration
  };
}

function latestHistoricalVarLossPct(returns) {
  if (returns.length < VAR_OBSERVATIONS) return null;
  const varPct = percentile(returns.slice(-VAR_OBSERVATIONS).map(row => row.returnPct), 0.05);
  return varPct === null ? null : roundNumber(Math.abs(Math.min(0, varPct)));
}

function stressReasonForV04b(s) {
  if (RANK[s.drawdownState] >= RANK.stress) return 'drawdown_stress';
  if (RANK[s.drawdownState] >= RANK.watch && RANK[s.varState] >= RANK.watch && s.recentTailLossDays >= TAIL_CLUSTER_COUNT) {
    return 'drawdown_watch_plus_var_watch_plus_tail';
  }
  if (RANK[s.drawdownState] >= RANK.watch && RANK[s.durationState] >= RANK.stress && (RANK[s.varState] >= RANK.watch || RANK[s.tailState] >= RANK.watch)) {
    return 'drawdown_watch_plus_duration_plus_risk_signal';
  }
  return null;
}

function buildSignal(assetConfig) {
  if (!fs.existsSync(assetConfig.metricsPath)) throw new Error(`Missing ${assetConfig.metricsPath}`);
  if (!fs.existsSync(assetConfig.historyPath)) throw new Error(`Missing ${assetConfig.historyPath}`);

  const metrics = readJson(assetConfig.metricsPath);
  const history = readJson(assetConfig.historyPath);
  const rows = (history.rows || [])
    .filter(row => row.date && optionalNumber(row.close) !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
  const returns = dailyReturns(rows);
  const latestReturn = returns.length ? returns[returns.length - 1].returnPct : null;
  const drawdown = latestDrawdown(rows);
  const historicalVarLossPct = latestHistoricalVarLossPct(returns);
  const ewmaPct = optionalNumber(metrics.EWMA_pct, metrics.ewma_daily_pct);
  const recentTailLossDays = returns.slice(-TAIL_WINDOW).filter(row => row.returnPct <= TAIL_CLUSTER_THRESHOLD).length;

  const drawdownState = severity(drawdown.drawdownPct, THRESHOLDS.drawdownPct, 'lte');
  const durationState = capState(severity(drawdown.underwaterDurationDays, THRESHOLDS.underwaterDurationDays, 'gte'), 'stress');
  const damageState = maxState([drawdownState, durationState]);
  const varState = severity(historicalVarLossPct, THRESHOLDS.historicalVaRLossPct, 'gte');
  const ewmaState = severity(ewmaPct, THRESHOLDS.ewmaVolPct, 'gte');
  const dailyTailState = severity(latestReturn, THRESHOLDS.dailyReturnPct, 'lte');
  const clusterState = recentTailLossDays >= TAIL_CLUSTER_COUNT ? 'stress' : 'normal';
  const tailState = maxState([dailyTailState, clusterState]);

  const crisis = RANK[drawdownState] >= RANK.stress
    && RANK[varState] >= RANK.stress
    && recentTailLossDays >= TAIL_CLUSTER_COUNT;
  const stressReason = stressReasonForV04b({
    drawdownState,
    durationState,
    varState,
    ewmaState,
    tailState,
    recentTailLossDays
  });

  let alertState = 'normal';
  let alertReason = '';
  if (RANK[damageState] >= RANK.watch) {
    alertState = 'watch';
    alertReason = 'damage_watch_context';
  }
  if (stressReason) {
    alertState = 'stress';
    alertReason = stressReason;
  }
  if (crisis) {
    alertState = 'crisis';
    alertReason = 'drawdown_stress_plus_var_stress_plus_tail';
  }

  return {
    asset: assetConfig.asset,
    data_as_of: metrics.data_as_of || metrics.snapshot_date,
    damage_state: damageState,
    alert_state: alertState,
    monitoring_source: 'live/data price history and metrics',
    methodology_version: METHODOLOGY_VERSION,
    alert_reason: alertReason,
    diagnostics: {
      drawdown_state: drawdownState,
      duration_state: durationState,
      var_state: varState,
      ewma_state: ewmaState,
      tail_state: tailState,
      rolling_drawdown_pct: drawdown.drawdownPct,
      historical_var_loss_pct: historicalVarLossPct,
      ewma_vol_pct: roundNumber(ewmaPct),
      daily_return_pct: roundNumber(latestReturn),
      underwater_duration_days: drawdown.underwaterDurationDays,
      recent_tail_loss_days: recentTailLossDays,
      observation_count: rows.length,
      history_start_date: rows.length ? rows[0].date : null,
      history_end_date: rows.length ? rows[rows.length - 1].date : null
    }
  };
}

function main() {
  const generatedAt = new Date().toISOString();
  const signals = ASSETS.map(buildSignal);
  const payload = {
    generated_at: generatedAt,
    methodology_version: METHODOLOGY_VERSION,
    thresholds: THRESHOLDS,
    rows: signals
  };

  fs.mkdirSync(LIVE_DATA_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  for (const signal of signals) {
    console.log(`${signal.asset}: ${signal.damage_state}/${signal.alert_state} data_as_of=${signal.data_as_of}`);
  }
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_JSON)}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`Error building live monitoring signals: ${error.stack || error.message}`);
    process.exitCode = 1;
  }
}
