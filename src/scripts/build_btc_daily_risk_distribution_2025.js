const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const {
  REPO_ROOT,
  OUTPUT_DIR,
  objectsToCsv,
  optionalNumber,
  roundNumber,
  mean,
  median,
  sampleStdDev,
  percentile
} = require('./btc_deep_risk_utils');

const PREFIX = 'btc_daily_risk_distribution_2025';
const INPUT_JSON = path.join(OUTPUT_DIR, 'poc_daily_mtm_ccw_2025.json');
const OUTPUT_CSV = path.join(OUTPUT_DIR, `${PREFIX}.csv`);
const OUTPUT_JSON = path.join(OUTPUT_DIR, `${PREFIX}.json`);
const OUTPUT_MD = path.join(OUTPUT_DIR, `${PREFIX}.md`);
const CHART_DIR = path.join(OUTPUT_DIR, 'charts');
const INDEX_MD = path.join(CHART_DIR, 'btc_visualization_index.md');

const CHARTS = {
  histogram: 'btc_daily_return_histogram_2025.png',
  ewma: 'btc_daily_ewma_timeseries_2025.png',
  var: 'btc_daily_var_timeseries_2025.png',
  drawdown: 'btc_daily_drawdown_curve_2025.png',
  tailFrequency: 'btc_daily_tail_frequency_2025.png'
};

const SUMMARY_COLUMNS = ['section', 'metric', 'value', 'unit', 'notes'];
const HISTOGRAM_BINS = [-10, -7, -5, -3, -2, -1, 0, 1, 2, 3, 5, 7, 10];
const LOSS_THRESHOLDS = [-2, -3, -5, -7];
const GAIN_THRESHOLDS = [2, 3, 5];
const EWMA_THRESHOLDS = [2, 3, 4, 5];
const VAR_THRESHOLDS = [3, 5, 7, 10];
const TAIL_STREAK_THRESHOLD = -3;
const VOL_SPIKE_THRESHOLD = 3;
const VAR_SPIKE_THRESHOLD = 3;
const ELEVATED_DRAWDOWN_THRESHOLD = -10;

const COLORS = {
  bg: [255, 255, 255, 255],
  text: [31, 41, 55, 255],
  muted: [107, 114, 128, 255],
  grid: [225, 229, 235, 255],
  axis: [55, 65, 81, 255],
  blue: [43, 111, 173, 255],
  green: [58, 145, 91, 255],
  red: [190, 73, 73, 255],
  yellow: [229, 179, 75, 255],
  purple: [112, 88, 166, 255]
};

const FONT = {
  'A': ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  'B': ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  'C': ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  'D': ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  'E': ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  'F': ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  'G': ['01111', '10000', '10000', '10011', '10001', '10001', '01111'],
  'H': ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  'I': ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  'J': ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  'K': ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  'L': ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  'M': ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  'N': ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  'O': ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  'P': ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  'Q': ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  'R': ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  'S': ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  'T': ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  'U': ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  'V': ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  'W': ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  'X': ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  'Y': ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  'Z': ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '10000', '11110', '00001', '00001', '11110'],
  '6': ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  '>': ['10000', '01000', '00100', '00010', '00100', '01000', '10000'],
  '<': ['00001', '00010', '00100', '01000', '00100', '00010', '00001'],
  '=': ['00000', '11111', '00000', '00000', '11111', '00000', '00000'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000']
};

function createCanvas(width, height) {
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = COLORS.bg[0];
    data[i + 1] = COLORS.bg[1];
    data[i + 2] = COLORS.bg[2];
    data[i + 3] = 255;
  }
  return { width, height, data };
}

function setPixel(canvas, x, y, color) {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
  const index = (Math.floor(y) * canvas.width + Math.floor(x)) * 4;
  canvas.data[index] = color[0];
  canvas.data[index + 1] = color[1];
  canvas.data[index + 2] = color[2];
  canvas.data[index + 3] = color[3] ?? 255;
}

function fillRect(canvas, x, y, w, h, color) {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(canvas.width, Math.ceil(x + w));
  const y1 = Math.min(canvas.height, Math.ceil(y + h));
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) setPixel(canvas, px, py, color);
  }
}

function drawLine(canvas, x0, y0, x1, y1, color) {
  if (![x0, y0, x1, y1].every(Number.isFinite)) return;
  const steps = Math.max(Math.abs(Math.round(x1 - x0)), Math.abs(Math.round(y1 - y0)), 1);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    setPixel(canvas, Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), color);
  }
}

function drawText(canvas, text, x, y, color = COLORS.text, scale = 2) {
  let cursor = x;
  for (const char of String(text).toUpperCase()) {
    const glyph = FONT[char] || FONT[' '];
    glyph.forEach((line, gy) => {
      [...line].forEach((bit, gx) => {
        if (bit === '1') fillRect(canvas, cursor + gx * scale, y + gy * scale, scale, scale, color);
      });
    });
    cursor += 6 * scale;
  }
}

function crc32(buffer) {
  let crc = -1;
  for (let i = 0; i < buffer.length; i++) {
    crc ^= buffer[i];
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ -1) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function writePng(canvas, filePath) {
  const raw = Buffer.alloc((canvas.width * 4 + 1) * canvas.height);
  for (let y = 0; y < canvas.height; y++) {
    raw[y * (canvas.width * 4 + 1)] = 0;
    canvas.data.copy(raw, y * (canvas.width * 4 + 1) + 1, y * canvas.width * 4, (y + 1) * canvas.width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(canvas.width, 0);
  ihdr.writeUInt32BE(canvas.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
  fs.writeFileSync(filePath, png);
}

function scaleY(value, plot, yMin, yMax) {
  if (yMax === yMin) return plot.y + plot.h / 2;
  return plot.y + plot.h - ((value - yMin) / (yMax - yMin)) * plot.h;
}

function drawAxes(canvas, plot, yMin, yMax, label) {
  fillRect(canvas, plot.x, plot.y, 1, plot.h, COLORS.axis);
  fillRect(canvas, plot.x, plot.y + plot.h, plot.w, 1, COLORS.axis);
  for (let i = 0; i <= 4; i++) {
    const y = plot.y + plot.h - plot.h * i / 4;
    drawLine(canvas, plot.x, y, plot.x + plot.w, y, COLORS.grid);
    const value = yMin + (yMax - yMin) * i / 4;
    drawText(canvas, value.toFixed(1), 14, y - 7, COLORS.muted, 2);
  }
  drawText(canvas, label, plot.x, plot.y - 20, COLORS.muted, 2);
}

function drawTitle(canvas, title, subtitle) {
  drawText(canvas, title, 34, 24, COLORS.text, 3);
  drawText(canvas, subtitle, 36, 58, COLORS.muted, 2);
}

function parseDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function pct(count, total) {
  return total ? count / total * 100 : 0;
}

function skewness(values) {
  const nums = values.filter(Number.isFinite);
  if (nums.length < 3) return null;
  const avg = mean(nums);
  const sd = sampleStdDev(nums);
  if (!sd) return null;
  const n = nums.length;
  const thirdMoment = nums.reduce((sum, value) => sum + ((value - avg) / sd) ** 3, 0);
  return (n / ((n - 1) * (n - 2))) * thirdMoment;
}

function excessKurtosis(values) {
  const nums = values.filter(Number.isFinite);
  if (nums.length < 4) return null;
  const avg = mean(nums);
  const sd = sampleStdDev(nums);
  if (!sd) return null;
  const n = nums.length;
  const fourthMoment = nums.reduce((sum, value) => sum + ((value - avg) / sd) ** 4, 0);
  return ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * fourthMoment
    - (3 * (n - 1) ** 2) / ((n - 2) * (n - 3));
}

function validRows(rows) {
  return rows
    .map(row => ({
      ...row,
      dailyReturnPct: optionalNumber(row.daily_return_pct),
      ewmaVolPct: optionalNumber(row.EWMA_vol_pct),
      historicalVarPct: optionalNumber(row.historical_VaR_pct),
      historicalVarLossPct: optionalNumber(row.historical_VaR_pct) === null
        ? null
        : Math.abs(Math.min(0, optionalNumber(row.historical_VaR_pct))),
      drawdownPct: optionalNumber(row.rolling_drawdown_pct),
      ccwValue: optionalNumber(row.approximate_CCW_value),
      btcPrice: optionalNumber(row.BTC_price)
    }));
}

function buildHistogram(returnsPct) {
  const bins = [];
  for (let i = 0; i < HISTOGRAM_BINS.length - 1; i++) {
    const lower = HISTOGRAM_BINS[i];
    const upper = HISTOGRAM_BINS[i + 1];
    const count = returnsPct.filter(value => value >= lower && value < upper).length;
    bins.push({
      bin: `${lower}% to ${upper}%`,
      lower,
      upper,
      count,
      frequencyPct: roundNumber(pct(count, returnsPct.length))
    });
  }
  const below = returnsPct.filter(value => value < HISTOGRAM_BINS[0]).length;
  const above = returnsPct.filter(value => value >= HISTOGRAM_BINS[HISTOGRAM_BINS.length - 1]).length;
  return [
    { bin: `< ${HISTOGRAM_BINS[0]}%`, lower: null, upper: HISTOGRAM_BINS[0], count: below, frequencyPct: roundNumber(pct(below, returnsPct.length)) },
    ...bins,
    { bin: `>= ${HISTOGRAM_BINS[HISTOGRAM_BINS.length - 1]}%`, lower: HISTOGRAM_BINS[HISTOGRAM_BINS.length - 1], upper: null, count: above, frequencyPct: roundNumber(pct(above, returnsPct.length)) }
  ];
}

function streaks(rows, predicate) {
  const result = [];
  let current = null;
  for (const row of rows) {
    if (predicate(row)) {
      if (!current) {
        current = {
          startDate: row.date,
          endDate: row.date,
          length: 0,
          cumulativeReturn: 1,
          worstReturnPct: null,
          minDrawdownPct: null
        };
      }
      current.endDate = row.date;
      current.length += 1;
      if (row.dailyReturnPct !== null) current.cumulativeReturn *= 1 + row.dailyReturnPct / 100;
      if (row.dailyReturnPct !== null) {
        current.worstReturnPct = current.worstReturnPct === null
          ? row.dailyReturnPct
          : Math.min(current.worstReturnPct, row.dailyReturnPct);
      }
      if (row.drawdownPct !== null) {
        current.minDrawdownPct = current.minDrawdownPct === null
          ? row.drawdownPct
          : Math.min(current.minDrawdownPct, row.drawdownPct);
      }
    } else if (current) {
      current.cumulativeReturnPct = (current.cumulativeReturn - 1) * 100;
      result.push(current);
      current = null;
    }
  }
  if (current) {
    current.cumulativeReturnPct = (current.cumulativeReturn - 1) * 100;
    result.push(current);
  }
  return result
    .map(row => ({
      ...row,
      cumulativeReturnPct: roundNumber(row.cumulativeReturnPct),
      worstReturnPct: roundNumber(row.worstReturnPct),
      minDrawdownPct: roundNumber(row.minDrawdownPct)
    }))
    .sort((a, b) => b.length - a.length || a.cumulativeReturnPct - b.cumulativeReturnPct);
}

function drawdownEpisodes(rows) {
  return streaks(rows, row => row.drawdownPct !== null && row.drawdownPct < 0)
    .map(episode => ({
      ...episode,
      recovered: rows.some(row => row.date > episode.endDate && row.drawdownPct === 0)
    }))
    .sort((a, b) => a.minDrawdownPct - b.minDrawdownPct || b.length - a.length);
}

function spikeEpisodes(rows, field, threshold) {
  return streaks(rows, row => optionalNumber(row[field]) !== null && optionalNumber(row[field]) >= threshold)
    .sort((a, b) => b.length - a.length);
}

function topRows(rows, field, direction = 'asc', limit = 10) {
  return rows
    .filter(row => optionalNumber(row[field]) !== null)
    .slice()
    .sort((a, b) => direction === 'asc'
      ? optionalNumber(a[field]) - optionalNumber(b[field])
      : optionalNumber(b[field]) - optionalNumber(a[field]))
    .slice(0, limit)
    .map(row => ({
      date: row.date,
      cycle_id: row.cycle_id,
      instrument_name: row.instrument_name,
      dailyReturnPct: roundNumber(row.dailyReturnPct),
      ewmaVolPct: roundNumber(row.ewmaVolPct),
      historicalVarLossPct: roundNumber(row.historicalVarLossPct),
      drawdownPct: roundNumber(row.drawdownPct),
      BTC_price: roundNumber(row.btcPrice),
      approximate_CCW_value: roundNumber(row.ccwValue)
    }));
}

function buildAnalysis() {
  const startedAt = Date.now();
  const input = JSON.parse(fs.readFileSync(INPUT_JSON, 'utf8'));
  const rows = validRows(input.rows || []);
  const completeRows = rows.filter(row => row.ccwValue !== null);
  const returnRows = rows.filter(row => row.dailyReturnPct !== null);
  const returnsPct = returnRows.map(row => row.dailyReturnPct);
  const ewmaRows = completeRows.filter(row => row.ewmaVolPct !== null);
  const ewmaPct = ewmaRows.map(row => row.ewmaVolPct);
  const varRows = completeRows.filter(row => row.historicalVarLossPct !== null);
  const varLossPct = varRows.map(row => row.historicalVarLossPct);
  const drawdownRows = completeRows.filter(row => row.drawdownPct !== null);
  const histogram = buildHistogram(returnsPct);
  const negativeStreaks = streaks(rows, row => row.dailyReturnPct !== null && row.dailyReturnPct < 0);
  const tailStreaks = streaks(rows, row => row.dailyReturnPct !== null && row.dailyReturnPct <= TAIL_STREAK_THRESHOLD);
  const ddEpisodes = drawdownEpisodes(rows);
  const volSpikeEpisodes = spikeEpisodes(rows, 'ewmaVolPct', VOL_SPIKE_THRESHOLD);
  const varSpikeEpisodes = spikeEpisodes(rows, 'historicalVarLossPct', VAR_SPIKE_THRESHOLD);
  const ddExpansionRows = completeRows.filter((row, index) => {
    if (row.drawdownPct === null || index === 0) return false;
    const prev = completeRows[index - 1];
    return prev.drawdownPct !== null && row.drawdownPct < prev.drawdownPct;
  });

  const tailLossFrequency = LOSS_THRESHOLDS.map(threshold => ({
    thresholdPct: threshold,
    count: returnsPct.filter(value => value <= threshold).length,
    frequencyPct: roundNumber(pct(returnsPct.filter(value => value <= threshold).length, returnsPct.length))
  }));
  const tailGainFrequency = GAIN_THRESHOLDS.map(threshold => ({
    thresholdPct: threshold,
    count: returnsPct.filter(value => value >= threshold).length,
    frequencyPct: roundNumber(pct(returnsPct.filter(value => value >= threshold).length, returnsPct.length))
  }));

  const analysis = {
    generatedAt: new Date().toISOString(),
    runtimeMs: null,
    runtimeSeconds: null,
    scope: {
      asset: 'BTC',
      tenor: 'weekly',
      moneyness: 'OTM10',
      year: 2025,
      source: path.relative(REPO_ROOT, INPUT_JSON),
      strictScope: 'Existing Daily Approximate MTM prototype output only.'
    },
    methodology: {
      dailyReturnSource: 'Uses daily_return_pct from poc_daily_mtm_ccw_2025; that prototype computes returns only across adjacent valid MTM observations and does not bridge missing MTM gaps.',
      ewmaSource: 'Uses EWMA_vol_pct from poc_daily_mtm_ccw_2025, lambda = 0.94.',
      historicalVaRSource: 'Uses historical_VaR_pct from poc_daily_mtm_ccw_2025; reported VaR frequencies use positive loss magnitude of the negative empirical 5th percentile.',
      caveats: [
        'Approximate MTM only.',
        'No official historical marks.',
        'No Greeks and no delta-aware hedge.',
        'OHLC/trade-price proxies may be stale, sparse, spread-distorted, or liquidity-distorted.',
        'Missing synthetic cycles are excluded from daily return calculations.',
        'This is a 2025 BTC weekly OTM10 daily MTM subset only.'
      ]
    },
    validation: {
      inputRows: rows.length,
      completeMtmRows: completeRows.length,
      validDailyReturnRows: returnsPct.length,
      ewmaRows: ewmaPct.length,
      historicalVaRRows: varLossPct.length,
      drawdownRows: drawdownRows.length,
      missingMtmRows: rows.filter(row => row.ccwValue === null).length
    },
    dailyReturnDistribution: {
      histogram,
      meanPct: roundNumber(mean(returnsPct)),
      medianPct: roundNumber(median(returnsPct)),
      stdDevPct: roundNumber(sampleStdDev(returnsPct)),
      skewness: roundNumber(skewness(returnsPct)),
      excessKurtosis: roundNumber(excessKurtosis(returnsPct)),
      percentilesPct: {
        p1: roundNumber(percentile(returnsPct, 0.01)),
        p5: roundNumber(percentile(returnsPct, 0.05)),
        p10: roundNumber(percentile(returnsPct, 0.10)),
        p90: roundNumber(percentile(returnsPct, 0.90)),
        p95: roundNumber(percentile(returnsPct, 0.95)),
        p99: roundNumber(percentile(returnsPct, 0.99))
      }
    },
    tailEvents: {
      lossFrequency: tailLossFrequency,
      gainFrequency: tailGainFrequency,
      largestLossDates: topRows(rows, 'dailyReturnPct', 'asc', 10),
      largestGainDates: topRows(rows, 'dailyReturnPct', 'desc', 10),
      longestNegativeReturnStreaks: negativeStreaks.slice(0, 10),
      consecutiveTailEventStreaks: tailStreaks.slice(0, 10),
      largestLossClusters: negativeStreaks.slice().sort((a, b) => a.cumulativeReturnPct - b.cumulativeReturnPct).slice(0, 10)
    },
    ewmaVolatility: {
      minPct: roundNumber(Math.min(...ewmaPct)),
      maxPct: roundNumber(Math.max(...ewmaPct)),
      medianPct: roundNumber(median(ewmaPct)),
      meanPct: roundNumber(mean(ewmaPct)),
      percentilesPct: {
        p1: roundNumber(percentile(ewmaPct, 0.01)),
        p5: roundNumber(percentile(ewmaPct, 0.05)),
        p10: roundNumber(percentile(ewmaPct, 0.10)),
        p90: roundNumber(percentile(ewmaPct, 0.90)),
        p95: roundNumber(percentile(ewmaPct, 0.95)),
        p99: roundNumber(percentile(ewmaPct, 0.99))
      },
      thresholdFrequency: EWMA_THRESHOLDS.map(threshold => ({
        thresholdPct: threshold,
        count: ewmaPct.filter(value => value > threshold).length,
        frequencyPct: roundNumber(pct(ewmaPct.filter(value => value > threshold).length, ewmaPct.length))
      })),
      spikeEpisodes: volSpikeEpisodes.slice(0, 10),
      largestSpikeDates: topRows(rows, 'ewmaVolPct', 'desc', 10)
    },
    historicalVaR: {
      minLossPct: roundNumber(Math.min(...varLossPct)),
      maxLossPct: roundNumber(Math.max(...varLossPct)),
      medianLossPct: roundNumber(median(varLossPct)),
      meanLossPct: roundNumber(mean(varLossPct)),
      percentilesLossPct: {
        p1: roundNumber(percentile(varLossPct, 0.01)),
        p5: roundNumber(percentile(varLossPct, 0.05)),
        p10: roundNumber(percentile(varLossPct, 0.10)),
        p90: roundNumber(percentile(varLossPct, 0.90)),
        p95: roundNumber(percentile(varLossPct, 0.95)),
        p99: roundNumber(percentile(varLossPct, 0.99))
      },
      thresholdFrequency: VAR_THRESHOLDS.map(threshold => ({
        thresholdPct: threshold,
        count: varLossPct.filter(value => value > threshold).length,
        frequencyPct: roundNumber(pct(varLossPct.filter(value => value > threshold).length, varLossPct.length))
      })),
      spikeEpisodes: varSpikeEpisodes.slice(0, 10),
      highestVaRDates: topRows(rows, 'historicalVarLossPct', 'desc', 10)
    },
    drawdownPath: {
      maxDrawdownPct: roundNumber(Math.min(...drawdownRows.map(row => row.drawdownPct))),
      longestUnderwaterPeriods: ddEpisodes.slice().sort((a, b) => b.length - a.length).slice(0, 10),
      largestDrawdownEpisodes: ddEpisodes.slice(0, 10),
      drawdownExpansionDays: ddExpansionRows.length,
      drawdownExpansionFrequencyPct: roundNumber(pct(ddExpansionRows.length, drawdownRows.length)),
      elevatedDrawdownDays: drawdownRows.filter(row => row.drawdownPct <= ELEVATED_DRAWDOWN_THRESHOLD).length,
      elevatedDrawdownFrequencyPct: roundNumber(pct(drawdownRows.filter(row => row.drawdownPct <= ELEVATED_DRAWDOWN_THRESHOLD).length, drawdownRows.length))
    },
    crisisIdentification: {
      largestDailyLossDates: topRows(rows, 'dailyReturnPct', 'asc', 10),
      largestVolatilitySpikeDates: topRows(rows, 'ewmaVolPct', 'desc', 10),
      largestVaRSpikeDates: topRows(rows, 'historicalVarLossPct', 'desc', 10),
      datasetVisibleStressWindows: [
        'Early March to early April 2025: repeated large daily losses, elevated drawdown, and rising EWMA/VaR within the MTM subset.',
        'Early November 2025: deepest drawdown region in the daily MTM path, partly adjacent to a missing synthetic-cycle gap.'
      ]
    },
    findings: {
      observations: [
        `The daily MTM subset contains ${returnsPct.length} adjacent valid daily returns from ${rows.length} daily rows.`,
        `Worst adjacent daily return is ${roundNumber(Math.min(...returnsPct))}% and best adjacent daily return is ${roundNumber(Math.max(...returnsPct))}%.`,
        `Daily return standard deviation is ${roundNumber(sampleStdDev(returnsPct))}%, with max drawdown ${roundNumber(Math.min(...drawdownRows.map(row => row.drawdownPct)))}%.`,
        `On complete MTM rows, EWMA volatility exceeds 3% on ${ewmaPct.filter(value => value > 3).length} rows and historical VaR loss magnitude exceeds 3% on ${varLossPct.filter(value => value > 3).length} rows.`
      ],
      interpretations: [
        'The daily layer appears economically meaningful because it exposes intracycle drawdown, volatility clustering, and tail observations that cycle-level reporting compresses.',
        'The risk layer is usable for monitoring-style research, but the missing synthetic-cycle gaps reduce continuity and should remain visible in any future simulation.',
        'Historical VaR and EWMA react to realized daily stress, but this study does not test whether a hedge would have improved outcomes.'
      ],
      hypotheses: [
        'Future intracycle hedge research may be more sensitive to timing and missing-data continuity than to summary distribution metrics alone.',
        'Daily MTM stress windows may help identify when crisis-trigger or higher-frequency risk controls should be simulated, after costs and liquidity are modeled.',
        'A fuller option data source could reduce synthetic-cycle gaps and improve continuity of daily risk estimates.'
      ]
    }
  };

  analysis.runtimeMs = Date.now() - startedAt;
  analysis.runtimeSeconds = roundNumber(analysis.runtimeMs / 1000, 3);
  return analysis;
}

function summaryRows(analysis) {
  const rows = [];
  const add = (section, metric, value, unit = '', notes = '') => rows.push({ section, metric, value, unit, notes });
  add('validation', 'inputRows', analysis.validation.inputRows, 'rows');
  add('validation', 'validDailyReturnRows', analysis.validation.validDailyReturnRows, 'rows');
  add('daily_return', 'mean', analysis.dailyReturnDistribution.meanPct, '%');
  add('daily_return', 'median', analysis.dailyReturnDistribution.medianPct, '%');
  add('daily_return', 'stdDev', analysis.dailyReturnDistribution.stdDevPct, '%');
  add('daily_return', 'skewness', analysis.dailyReturnDistribution.skewness);
  add('daily_return', 'excessKurtosis', analysis.dailyReturnDistribution.excessKurtosis);
  for (const [key, value] of Object.entries(analysis.dailyReturnDistribution.percentilesPct)) add('daily_return_percentile', key, value, '%');
  analysis.tailEvents.lossFrequency.forEach(row => add('tail_loss_frequency', `<= ${row.thresholdPct}%`, row.count, 'days', `${row.frequencyPct}%`));
  analysis.tailEvents.gainFrequency.forEach(row => add('tail_gain_frequency', `>= ${row.thresholdPct}%`, row.count, 'days', `${row.frequencyPct}%`));
  add('ewma', 'min', analysis.ewmaVolatility.minPct, '%');
  add('ewma', 'median', analysis.ewmaVolatility.medianPct, '%');
  add('ewma', 'max', analysis.ewmaVolatility.maxPct, '%');
  analysis.ewmaVolatility.thresholdFrequency.forEach(row => add('ewma_threshold_frequency', `> ${row.thresholdPct}%`, row.count, 'days', `${row.frequencyPct}%`));
  add('historical_var', 'minLossMagnitude', analysis.historicalVaR.minLossPct, '%');
  add('historical_var', 'medianLossMagnitude', analysis.historicalVaR.medianLossPct, '%');
  add('historical_var', 'maxLossMagnitude', analysis.historicalVaR.maxLossPct, '%');
  analysis.historicalVaR.thresholdFrequency.forEach(row => add('var_threshold_frequency', `> ${row.thresholdPct}%`, row.count, 'days', `${row.frequencyPct}%`));
  add('drawdown', 'maxDrawdown', analysis.drawdownPath.maxDrawdownPct, '%');
  add('drawdown', 'drawdownExpansionDays', analysis.drawdownPath.drawdownExpansionDays, 'days', `${analysis.drawdownPath.drawdownExpansionFrequencyPct}%`);
  add('runtime', 'runtimeSeconds', analysis.runtimeSeconds, 'seconds');
  return rows;
}

function chartX(date, xMin, xMax, plot) {
  const ts = parseDate(date).getTime();
  return plot.x + ((ts - xMin) / (xMax - xMin)) * plot.w;
}

function lineChart(rows, field, output, title, subtitle, color, yMin = null, yMax = null) {
  const canvas = createCanvas(1100, 680);
  const plot = { x: 88, y: 100, w: 960, h: 455 };
  const series = rows.filter(row => optionalNumber(row[field]) !== null && parseDate(row.date));
  const values = series.map(row => optionalNumber(row[field]));
  const dates = series.map(row => parseDate(row.date).getTime());
  const minY = yMin ?? Math.min(...values, 0);
  const maxY = yMax ?? Math.max(...values, 1);
  const xMin = Math.min(...dates);
  const xMax = Math.max(...dates);
  drawTitle(canvas, title, subtitle);
  drawAxes(canvas, plot, minY, maxY, '%');
  for (let i = 1; i < series.length; i++) {
    const a = series[i - 1];
    const b = series[i];
    drawLine(canvas, chartX(a.date, xMin, xMax, plot), scaleY(optionalNumber(a[field]), plot, minY, maxY), chartX(b.date, xMin, xMax, plot), scaleY(optionalNumber(b[field]), plot, minY, maxY), color);
  }
  drawText(canvas, 'JAN', plot.x, plot.y + plot.h + 18, COLORS.muted, 2);
  drawText(canvas, 'DEC', plot.x + plot.w - 42, plot.y + plot.h + 18, COLORS.muted, 2);
  writePng(canvas, output);
}

function histogramChart(histogram, output) {
  const canvas = createCanvas(1100, 680);
  const plot = { x: 88, y: 100, w: 960, h: 455 };
  const yMax = Math.max(...histogram.map(row => row.count), 1) * 1.15;
  drawTitle(canvas, 'DAILY RETURN HISTOGRAM 2025', 'BTC WEEKLY OTM10 APPROX MTM RETURNS');
  drawAxes(canvas, plot, 0, yMax, 'COUNT');
  const barW = plot.w / histogram.length - 4;
  histogram.forEach((row, index) => {
    const x = plot.x + index * (barW + 4);
    const y = scaleY(row.count, plot, 0, yMax);
    const color = row.upper !== null && row.upper <= 0 ? COLORS.red : row.lower !== null && row.lower >= 0 ? COLORS.green : COLORS.yellow;
    fillRect(canvas, x, y, barW, plot.y + plot.h - y, color);
    if (index % 2 === 0) drawText(canvas, String(row.lower ?? '<'), x, plot.y + plot.h + 14, COLORS.muted, 1);
  });
  writePng(canvas, output);
}

function tailFrequencyChart(analysis, output) {
  const rows = [
    ...analysis.tailEvents.lossFrequency.map(row => ({ label: `L${Math.abs(row.thresholdPct)}`, count: row.count, color: COLORS.red })),
    ...analysis.tailEvents.gainFrequency.map(row => ({ label: `G${row.thresholdPct}`, count: row.count, color: COLORS.green }))
  ];
  const canvas = createCanvas(1100, 680);
  const plot = { x: 88, y: 100, w: 960, h: 455 };
  const yMax = Math.max(...rows.map(row => row.count), 1) * 1.15;
  drawTitle(canvas, 'DAILY TAIL EVENT FREQUENCY', 'LOSS THRESHOLDS AND GAIN THRESHOLDS');
  drawAxes(canvas, plot, 0, yMax, 'DAYS');
  const barW = plot.w / rows.length - 20;
  rows.forEach((row, index) => {
    const x = plot.x + index * (barW + 20);
    const y = scaleY(row.count, plot, 0, yMax);
    fillRect(canvas, x, y, barW, plot.y + plot.h - y, row.color);
    drawText(canvas, row.label, x + 4, plot.y + plot.h + 14, COLORS.muted, 2);
  });
  writePng(canvas, output);
}

function buildCharts(analysis) {
  fs.mkdirSync(CHART_DIR, { recursive: true });
  const rows = analysis.sourceRows.filter(row => row.ccwValue !== null);
  histogramChart(analysis.dailyReturnDistribution.histogram, path.join(CHART_DIR, CHARTS.histogram));
  lineChart(rows, 'ewmaVolPct', path.join(CHART_DIR, CHARTS.ewma), 'EWMA VOLATILITY 2025', 'LAMBDA 0.94 DAILY APPROX MTM RETURNS', COLORS.blue, 0, Math.max(5, analysis.ewmaVolatility.maxPct * 1.1));
  lineChart(rows, 'historicalVarLossPct', path.join(CHART_DIR, CHARTS.var), 'HISTORICAL VAR 2025', '30 DAY EMPIRICAL 5TH PERCENTILE LOSS MAGNITUDE', COLORS.purple, 0, Math.max(5, analysis.historicalVaR.maxLossPct * 1.1));
  lineChart(rows, 'drawdownPct', path.join(CHART_DIR, CHARTS.drawdown), 'DAILY DRAWDOWN CURVE 2025', 'APPROX MTM PEAK TO TROUGH PATH', COLORS.red, analysis.drawdownPath.maxDrawdownPct * 1.1, 2);
  tailFrequencyChart(analysis, path.join(CHART_DIR, CHARTS.tailFrequency));
}

function markdownTable(rows, columns) {
  if (!rows.length) return '';
  return [
    `| ${columns.join(' | ')} |`,
    `| ${columns.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${columns.map(column => row[column] ?? '').join(' | ')} |`)
  ].join('\n');
}

function buildMarkdown(analysis) {
  return [
    '# BTC Daily Risk Distribution Study - 2025',
    '',
    `Generated: ${analysis.generatedAt}`,
    '',
    '## Scope',
    '',
    '- BTC weekly OTM10, year 2025 only.',
    `- Source: ${analysis.scope.source}.`,
    '- Uses existing Daily Approximate MTM output only; no baseline backtests, hedge logic, or unrelated analyses were rerun.',
    '',
    '## Validation',
    '',
    `- Runtime: ${analysis.runtimeSeconds}s.`,
    `- Input rows: ${analysis.validation.inputRows}.`,
    `- Complete MTM rows: ${analysis.validation.completeMtmRows}.`,
    `- Valid adjacent daily return rows: ${analysis.validation.validDailyReturnRows}.`,
    `- EWMA rows: ${analysis.validation.ewmaRows}.`,
    `- Historical VaR rows: ${analysis.validation.historicalVaRRows}.`,
    `- Missing MTM rows: ${analysis.validation.missingMtmRows}.`,
    '',
    '## Daily Return Distribution',
    '',
    `- Mean / median / std dev: ${analysis.dailyReturnDistribution.meanPct}% / ${analysis.dailyReturnDistribution.medianPct}% / ${analysis.dailyReturnDistribution.stdDevPct}%.`,
    `- Skewness / excess kurtosis: ${analysis.dailyReturnDistribution.skewness} / ${analysis.dailyReturnDistribution.excessKurtosis}.`,
    `- Percentiles p1/p5/p10: ${analysis.dailyReturnDistribution.percentilesPct.p1}% / ${analysis.dailyReturnDistribution.percentilesPct.p5}% / ${analysis.dailyReturnDistribution.percentilesPct.p10}%.`,
    `- Percentiles p90/p95/p99: ${analysis.dailyReturnDistribution.percentilesPct.p90}% / ${analysis.dailyReturnDistribution.percentilesPct.p95}% / ${analysis.dailyReturnDistribution.percentilesPct.p99}%.`,
    '',
    '## Tail Events',
    '',
    '### Loss Frequency',
    '',
    markdownTable(analysis.tailEvents.lossFrequency, ['thresholdPct', 'count', 'frequencyPct']),
    '',
    '### Gain Frequency',
    '',
    markdownTable(analysis.tailEvents.gainFrequency, ['thresholdPct', 'count', 'frequencyPct']),
    '',
    '### Largest Loss Dates',
    '',
    markdownTable(analysis.tailEvents.largestLossDates.slice(0, 5), ['date', 'cycle_id', 'dailyReturnPct', 'ewmaVolPct', 'historicalVarLossPct', 'drawdownPct', 'BTC_price']),
    '',
    '## EWMA Volatility',
    '',
    `- Min / median / max: ${analysis.ewmaVolatility.minPct}% / ${analysis.ewmaVolatility.medianPct}% / ${analysis.ewmaVolatility.maxPct}%.`,
    markdownTable(analysis.ewmaVolatility.thresholdFrequency, ['thresholdPct', 'count', 'frequencyPct']),
    '',
    '## Historical VaR',
    '',
    `- Loss magnitude min / median / max: ${analysis.historicalVaR.minLossPct}% / ${analysis.historicalVaR.medianLossPct}% / ${analysis.historicalVaR.maxLossPct}%.`,
    markdownTable(analysis.historicalVaR.thresholdFrequency, ['thresholdPct', 'count', 'frequencyPct']),
    '',
    '## Drawdown Path',
    '',
    `- Max drawdown: ${analysis.drawdownPath.maxDrawdownPct}%.`,
    `- Drawdown expansion days: ${analysis.drawdownPath.drawdownExpansionDays} (${analysis.drawdownPath.drawdownExpansionFrequencyPct}%).`,
    `- Days at or below ${ELEVATED_DRAWDOWN_THRESHOLD}% drawdown: ${analysis.drawdownPath.elevatedDrawdownDays} (${analysis.drawdownPath.elevatedDrawdownFrequencyPct}%).`,
    '',
    '### Largest Drawdown Episodes',
    '',
    markdownTable(analysis.drawdownPath.largestDrawdownEpisodes.slice(0, 5), ['startDate', 'endDate', 'length', 'minDrawdownPct', 'recovered']),
    '',
    '## Crisis Period Identification',
    '',
    ...analysis.crisisIdentification.datasetVisibleStressWindows.map(item => `- ${item}`),
    '',
    '## Observations',
    '',
    ...analysis.findings.observations.map(item => `- ${item}`),
    '',
    '## Interpretations',
    '',
    ...analysis.findings.interpretations.map(item => `- ${item}`),
    '',
    '## Hypotheses',
    '',
    ...analysis.findings.hypotheses.map(item => `- ${item}`),
    '',
    '## Caveats',
    '',
    ...analysis.methodology.caveats.map(item => `- ${item}`),
    ''
  ].join('\n');
}

function updateVisualizationIndex() {
  const section = [
    '## Daily Approximate MTM Risk Charts',
    '',
    'Daily risk charts are generated from the BTC weekly OTM10 2025 Daily Approximate MTM prototype only.',
    '',
    `- Daily Return Histogram: [${CHARTS.histogram}](./${CHARTS.histogram})`,
    `- EWMA Volatility Through Time: [${CHARTS.ewma}](./${CHARTS.ewma})`,
    `- Historical VaR Through Time: [${CHARTS.var}](./${CHARTS.var})`,
    `- Daily Drawdown Curve: [${CHARTS.drawdown}](./${CHARTS.drawdown})`,
    `- Tail Event Frequency: [${CHARTS.tailFrequency}](./${CHARTS.tailFrequency})`,
    '',
    '### Daily MTM Risk Caveats',
    '',
    '- Approximate MTM only; option OHLC/trade-price proxies may be imperfect.',
    '- No official historical marks, Greeks, delta-aware hedge, funding, slippage, or margin mechanics are included.',
    '- Scope is BTC weekly OTM10 2025 only; missing synthetic cycles remain excluded from adjacent daily-return calculations.',
    ''
  ].join('\n');

  const current = fs.existsSync(INDEX_MD) ? fs.readFileSync(INDEX_MD, 'utf8') : '# BTC Visualization Index\n\n';
  const marker = '## Daily Approximate MTM Risk Charts';
  const next = current.includes(marker)
    ? current.slice(0, current.indexOf(marker)).trimEnd() + '\n\n' + section
    : current.trimEnd() + '\n\n' + section;
  fs.writeFileSync(INDEX_MD, `${next}\n`, 'utf8');
}

function main() {
  const analysis = buildAnalysis();
  analysis.sourceRows = validRows(JSON.parse(fs.readFileSync(INPUT_JSON, 'utf8')).rows || []);
  buildCharts(analysis);
  const jsonPayload = { ...analysis };
  delete jsonPayload.sourceRows;
  fs.writeFileSync(OUTPUT_CSV, `${objectsToCsv(summaryRows(analysis), SUMMARY_COLUMNS)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(jsonPayload, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_MD, buildMarkdown(analysis), 'utf8');
  updateVisualizationIndex();

  console.log(`Runtime seconds: ${analysis.runtimeSeconds}`);
  console.log(`Input rows: ${analysis.validation.inputRows}`);
  console.log(`Valid daily returns: ${analysis.validation.validDailyReturnRows}`);
  console.log(`Tail losses <= -5%: ${analysis.tailEvents.lossFrequency.find(row => row.thresholdPct === -5).count}`);
  console.log(`EWMA range: ${analysis.ewmaVolatility.minPct}% to ${analysis.ewmaVolatility.maxPct}%`);
  console.log(`VaR loss range: ${analysis.historicalVaR.minLossPct}% to ${analysis.historicalVaR.maxLossPct}%`);
  console.log(`Max drawdown: ${analysis.drawdownPath.maxDrawdownPct}%`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_CSV)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_JSON)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_MD)}`);
  Object.values(CHARTS).forEach(file => console.log(`Wrote ${path.join('analysis', 'generated', 'charts', file)}`));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('Error building BTC daily risk distribution study:', error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  buildAnalysis,
  summaryRows
};
