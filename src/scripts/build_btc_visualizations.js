const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const GENERATED_DIR = path.join(REPO_ROOT, 'analysis', 'generated');
const CHART_DIR = path.join(GENERATED_DIR, 'charts');

const COLORS = {
  weekly: [43, 111, 173, 255],
  '14d': [58, 150, 118, 255],
  monthly: [204, 124, 55, 255],
  grid: [225, 229, 235, 255],
  axis: [55, 65, 81, 255],
  text: [31, 41, 55, 255],
  muted: [107, 114, 128, 255],
  bg: [255, 255, 255, 255],
  red: [190, 73, 73, 255],
  green: [58, 145, 91, 255],
  yellow: [229, 179, 75, 255]
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
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000']
};

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(GENERATED_DIR, name), 'utf8'));
}

function optionalNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mean(values) {
  const nums = values.filter(Number.isFinite);
  return nums.length ? nums.reduce((sum, value) => sum + value, 0) / nums.length : null;
}

function parseDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function strategyLabel(row) {
  return `${row.tenor.toUpperCase()} ${String(row.moneyness_label).toUpperCase()}`;
}

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
  const r = color[0];
  const g = color[1];
  const b = color[2];
  const a = color[3] ?? 255;
  for (let py = y0; py < y1; py++) {
    let index = (py * canvas.width + x0) * 4;
    for (let px = x0; px < x1; px++) {
      canvas.data[index] = r;
      canvas.data[index + 1] = g;
      canvas.data[index + 2] = b;
      canvas.data[index + 3] = a;
      index += 4;
    }
  }
}

function drawLine(canvas, x0, y0, x1, y1, color) {
  if (![x0, y0, x1, y1].every(Number.isFinite)) return;
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = Math.round(x0);
  let y = Math.round(y0);
  let steps = 0;
  const maxSteps = canvas.width + canvas.height + 100;
  while (true) {
    setPixel(canvas, x, y, color);
    if (x === Math.round(x1) && y === Math.round(y1)) break;
    steps++;
    if (steps > maxSteps) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

function drawSeriesLine(canvas, x0, y0, x1, y1, color) {
  if (![x0, y0, x1, y1].every(Number.isFinite)) return;
  const startX = Math.round(x0);
  const startY = Math.round(y0);
  const endX = Math.round(x1);
  const endY = Math.round(y1);
  const steps = Math.max(Math.abs(endX - startX), Math.abs(endY - startY));
  if (steps === 0) {
    setPixel(canvas, startX, startY, color);
    return;
  }
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = Math.round(startX + (endX - startX) * t);
    const y = Math.round(startY + (endY - startY) * t);
    setPixel(canvas, x, y, color);
  }
}

function drawCircle(canvas, cx, cy, radius, color) {
  for (let y = -radius; y <= radius; y++) {
    for (let x = -radius; x <= radius; x++) {
      if (x * x + y * y <= radius * radius) setPixel(canvas, cx + x, cy + y, color);
    }
  }
}

function drawText(canvas, text, x, y, color = COLORS.text, scale = 2) {
  const raw = String(text).toUpperCase();
  let cursor = x;
  for (const char of raw) {
    const glyph = FONT[char] || FONT[' '];
    glyph.forEach((line, gy) => {
      [...line].forEach((bit, gx) => {
        if (bit === '1') fillRect(canvas, cursor + gx * scale, y + gy * scale, scale, scale, color);
      });
    });
    cursor += 6 * scale;
  }
}

function drawTitle(canvas, title, subtitle) {
  drawText(canvas, title, 34, 24, COLORS.text, 3);
  if (subtitle) drawText(canvas, subtitle, 36, 56, COLORS.muted, 2);
}

function crc32(buffer) {
  let crc = -1;
  for (let i = 0; i < buffer.length; i++) {
    crc ^= buffer[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
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
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
  fs.writeFileSync(filePath, png);
}

function drawAxes(canvas, plot, yMin, yMax, yLabel) {
  fillRect(canvas, plot.x, plot.y, 1, plot.h, COLORS.axis);
  fillRect(canvas, plot.x, plot.y + plot.h, plot.w, 1, COLORS.axis);
  for (let i = 0; i <= 4; i++) {
    const y = plot.y + plot.h - (plot.h * i / 4);
    drawLine(canvas, plot.x, y, plot.x + plot.w, y, COLORS.grid);
    const value = yMin + (yMax - yMin) * i / 4;
    drawText(canvas, value.toFixed(0), 10, y - 7, COLORS.muted, 2);
  }
  if (yLabel) drawText(canvas, yLabel, plot.x, plot.y - 20, COLORS.muted, 2);
}

function scaleY(value, plot, yMin, yMax) {
  if (yMax === yMin) return plot.y + plot.h / 2;
  return plot.y + plot.h - ((value - yMin) / (yMax - yMin)) * plot.h;
}

function barChart({ title, subtitle, rows, field, output, yMin = 0, yMax = null, abs = false }) {
  const canvas = createCanvas(1100, 680);
  const plot = { x: 78, y: 96, w: 980, h: 455 };
  const values = rows.map(row => abs ? Math.abs(optionalNumber(row[field])) : optionalNumber(row[field])).filter(v => v !== null);
  const maxValue = yMax ?? Math.max(...values, 1) * 1.12;
  drawTitle(canvas, title, subtitle);
  drawAxes(canvas, plot, yMin, maxValue, abs ? 'MAGNITUDE %' : '%');
  const groupGap = 12;
  const barW = Math.max(12, (plot.w - groupGap * (rows.length - 1)) / rows.length);
  rows.forEach((row, index) => {
    const value = abs ? Math.abs(optionalNumber(row[field])) : optionalNumber(row[field]);
    if (value === null) return;
    const x = plot.x + index * (barW + groupGap);
    const y = scaleY(value, plot, yMin, maxValue);
    fillRect(canvas, x, y, barW, plot.y + plot.h - y, COLORS[row.tenor] || COLORS.axis);
    drawText(canvas, String(row.moneyness_label).toUpperCase(), x, plot.y + plot.h + 12, COLORS.muted, 1);
  });
  drawLegend(canvas, plot.x + 650, 28);
  writePng(canvas, output);
}

function drawLegend(canvas, x, y) {
  [['weekly', 'WEEKLY'], ['14d', '14D'], ['monthly', 'MONTHLY']].forEach(([key, label], index) => {
    fillRect(canvas, x + index * 130, y, 18, 18, COLORS[key]);
    drawText(canvas, label, x + 24 + index * 130, y + 2, COLORS.text, 2);
  });
}

function scatterChart(rows, output) {
  const canvas = createCanvas(1100, 680);
  const plot = { x: 92, y: 96, w: 960, h: 455 };
  const xs = rows.map(row => optionalNumber(row.maxDrawdownPct)).filter(v => v !== null);
  const ys = rows.map(row => optionalNumber(row.reconstructedTotalReturnPct)).filter(v => v !== null);
  const xMin = Math.min(...xs) * 1.05;
  const xMax = Math.max(...xs) * 0.95;
  const yMin = 0;
  const yMax = Math.max(...ys) * 1.1;
  drawTitle(canvas, 'RETURN VS MAX DRAWDOWN', 'X: MAX DRAWDOWN % (NEGATIVE)  Y: RECONSTRUCTED TOTAL RETURN %');
  drawAxes(canvas, plot, yMin, yMax, 'RETURN %');
  drawText(canvas, 'MAX DRAWDOWN %', plot.x + 420, plot.y + plot.h + 62, COLORS.muted, 2);
  rows.forEach(row => {
    const xVal = optionalNumber(row.maxDrawdownPct);
    const yVal = optionalNumber(row.reconstructedTotalReturnPct);
    if (xVal === null || yVal === null) return;
    const x = plot.x + ((xVal - xMin) / (xMax - xMin)) * plot.w;
    const y = scaleY(yVal, plot, yMin, yMax);
    drawCircle(canvas, x, y, 6, COLORS[row.tenor] || COLORS.axis);
    if ((row.tenor === 'weekly' && row.moneyness_label === 'otm10') || (row.tenor === 'monthly' && row.moneyness_label === 'atm00')) {
      drawText(canvas, strategyLabel(row), x + 8, y - 8, COLORS.text, 1);
    }
  });
  for (let i = 0; i <= 4; i++) {
    const x = plot.x + plot.w * i / 4;
    const value = xMin + (xMax - xMin) * i / 4;
    drawLine(canvas, x, plot.y, x, plot.y + plot.h, COLORS.grid);
    drawText(canvas, value.toFixed(0), x - 16, plot.y + plot.h + 14, COLORS.muted, 2);
  }
  drawLegend(canvas, 700, 28);
  writePng(canvas, output);
}

function groupedBarChart({ title, subtitle, rows, fields, labels, output }) {
  const canvas = createCanvas(1100, 680);
  const plot = { x: 78, y: 96, w: 980, h: 455 };
  const values = rows.flatMap(row => fields.map(field => optionalNumber(row[field]))).filter(v => v !== null);
  const yMax = Math.max(...values, 1) * 1.15;
  drawTitle(canvas, title, subtitle);
  drawAxes(canvas, plot, 0, yMax, 'RATIO');
  const groupW = plot.w / rows.length;
  rows.forEach((row, index) => {
    fields.forEach((field, fieldIndex) => {
      const value = optionalNumber(row[field]);
      if (value === null) return;
      const barW = Math.max(8, groupW / 4);
      const x = plot.x + index * groupW + 8 + fieldIndex * (barW + 4);
      const y = scaleY(value, plot, 0, yMax);
      fillRect(canvas, x, y, barW, plot.y + plot.h - y, fieldIndex === 0 ? COLORS.green : COLORS.red);
    });
    drawText(canvas, `${row.tenor[0]} ${String(row.moneyness_label).replace('otm', 'O').replace('atm', 'A').replace('itm', 'I')}`, plot.x + index * groupW + 2, plot.y + plot.h + 12, COLORS.muted, 1);
  });
  fillRect(canvas, 720, 28, 18, 18, COLORS.green);
  drawText(canvas, labels[0], 746, 30, COLORS.text, 2);
  fillRect(canvas, 870, 28, 18, 18, COLORS.red);
  drawText(canvas, labels[1], 896, 30, COLORS.text, 2);
  writePng(canvas, output);
}

function monthStartDate(value) {
  const date = parseDate(value);
  if (!date) return null;
  const month = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  return month.toISOString().slice(0, 10);
}

function aggregateRollingByMonth(rows, field) {
  return Object.entries(rows.reduce((groups, row) => {
    const date = monthStartDate(row.windowEndDate);
    const value = optionalNumber(row[field]);
    if (!date || value === null) return groups;
    const key = `${row.tenor}|${date}`;
    if (!groups[key]) groups[key] = { tenor: row.tenor, date, values: [] };
    groups[key].values.push(value);
    return groups;
  }, {})).map(([, group]) => ({
    tenor: group.tenor,
    date: group.date,
    value: mean(group.values)
  })).filter(row => row.value !== null && parseDate(row.date))
    .sort((a, b) => a.tenor.localeCompare(b.tenor) || parseDate(a.date) - parseDate(b.date));
}

function lineChart({ title, subtitle, rows, field, output, yLabel }) {
  const canvas = createCanvas(1100, 680);
  const plot = { x: 78, y: 96, w: 980, h: 455 };
  const values = rows.map(row => row.value).filter(Number.isFinite);
  const dates = rows.map(row => parseDate(row.date)).filter(Boolean).map(date => date.getTime());
  const xMin = Math.min(...dates);
  const xMax = Math.max(...dates);
  const yMin = Math.min(...values, 0);
  const yMax = Math.max(...values, 1);
  drawTitle(canvas, title, subtitle);
  drawAxes(canvas, plot, yMin, yMax, yLabel);
  ['weekly', '14d', 'monthly'].forEach(tenor => {
    const seriesByDate = new Map();
    rows
      .filter(row => row.tenor === tenor && Number.isFinite(row.value) && parseDate(row.date))
      .sort((a, b) => parseDate(a.date) - parseDate(b.date))
      .forEach(row => seriesByDate.set(row.date, row));
    const series = [...seriesByDate.values()];
    for (let i = 1; i < series.length; i++) {
      const a = series[i - 1];
      const b = series[i];
      const x0 = plot.x + ((parseDate(a.date).getTime() - xMin) / (xMax - xMin)) * plot.w;
      const x1 = plot.x + ((parseDate(b.date).getTime() - xMin) / (xMax - xMin)) * plot.w;
      drawSeriesLine(canvas, x0, scaleY(a.value, plot, yMin, yMax), x1, scaleY(b.value, plot, yMin, yMax), COLORS[tenor]);
    }
  });
  drawLegend(canvas, 700, 28);
  drawText(canvas, '2020', plot.x, plot.y + plot.h + 16, COLORS.muted, 2);
  drawText(canvas, '2026', plot.x + plot.w - 48, plot.y + plot.h + 16, COLORS.muted, 2);
  writePng(canvas, output);
}

function heatColor(value, min, max) {
  if (max === min) return COLORS.yellow;
  const t = (value - min) / (max - min);
  const r = Math.round(190 * (1 - t) + 58 * t);
  const g = Math.round(73 * (1 - t) + 145 * t);
  const b = Math.round(73 * (1 - t) + 91 * t);
  return [r, g, b, 255];
}

function heatmap(rows, output) {
  const canvas = createCanvas(1100, 680);
  drawTitle(canvas, 'REGIME RETURN HEATMAP', 'AVERAGE REGIME RETURN % BY TENOR AND REGIME');
  const regimes = ['bull_2020_2021', 'bear_2022', 'recovery_transition_2023', 'etf_bull_2024_2025'];
  const tenors = ['weekly', '14d', 'monthly'];
  const values = rows.map(row => row.value).filter(Number.isFinite);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const x0 = 220;
  const y0 = 140;
  const cellW = 195;
  const cellH = 110;
  regimes.forEach((regime, xIndex) => drawText(canvas, regime.replace(/_/g, ' '), x0 + xIndex * cellW + 6, y0 - 36, COLORS.text, 1));
  tenors.forEach((tenor, yIndex) => drawText(canvas, tenor, 90, y0 + yIndex * cellH + 44, COLORS.text, 2));
  tenors.forEach((tenor, yIndex) => {
    regimes.forEach((regime, xIndex) => {
      const row = rows.find(item => item.tenor === tenor && item.regime === regime);
      const value = row ? row.value : null;
      const x = x0 + xIndex * cellW;
      const y = y0 + yIndex * cellH;
      fillRect(canvas, x, y, cellW - 8, cellH - 8, value === null ? COLORS.grid : heatColor(value, min, max));
      drawText(canvas, value === null ? 'NA' : value.toFixed(1), x + 64, y + 42, [255, 255, 255, 255], 2);
    });
  });
  writePng(canvas, output);
}

function buildChartRows() {
  const multi = readJson('btc_multi_tenor_analysis.json').rows.filter(row => row.comparison_scope === 'full_period');
  const equity = readJson('btc_equity_risk_analysis.json').rows.filter(row => row.comparison_scope === 'full_period');
  const rolling = readJson('btc_rolling_risk_analysis.json').rows.filter(row => (
    row.comparison_scope === 'full_period'
    && ((row.tenor === 'weekly' && row.windowCycles === 52)
      || (row.tenor === '14d' && row.windowCycles === 26)
      || (row.tenor === 'monthly' && row.windowCycles === 12))
  ));
  const regime = readJson('btc_regime_analysis.json').rows.filter(row => row.comparison_scope === 'full_period' && optionalNumber(row.returnPct) !== null);

  return { multi, equity, rolling, regime };
}

function buildIndex(charts) {
  return [
    '# BTC Visualization Index',
    '',
    'Generated static PNG charts from existing BTC analysis outputs.',
    '',
    '## Charts',
    '',
    ...charts.map(chart => [
      `### ${chart.title}`,
      '',
      `- File: [${chart.file}](./${chart.file})`,
      `- Represents: ${chart.represents}`,
      `- Interpretation: ${chart.interpretation}`,
      ''
    ].join('\n')),
    '## Methodology Caveats',
    '',
    '- Charts read existing generated analysis outputs only; no backtests or batch runs are executed.',
    '- Rolling charts use one-year tenor-aware windows: weekly 52 cycles, 14d 26 cycles, monthly 12 cycles.',
    '- Rolling chart lines are monthly-bucketed averages by tenor for readability; source analysis data remains unchanged.',
    '- Volatility metrics in the source artifacts are cycle-based and not annualized.',
    '- Current Sharpe/Sortino values are simple per-cycle ratios and are not tenor-normalized.',
    '- Drawdown charts use end-of-cycle reconstructed equity and may understate intracycle risk.',
    '- Regime windows are deterministic calendar regimes used by the analysis layer.',
    ''
  ].join('\n');
}

function main() {
  fs.mkdirSync(CHART_DIR, { recursive: true });
  const { multi, equity, rolling, regime } = buildChartRows();
  const byStrategy = rows => rows.slice().sort((a, b) => (
    a.tenor.localeCompare(b.tenor) || optionalNumber(a.xOtm) - optionalNumber(b.xOtm)
  ));
  const charts = [];

  const write = (file, fn, meta) => {
    const output = path.join(CHART_DIR, file);
    fn(output);
    charts.push({ file, ...meta });
  };

  write('btc_total_return_by_tenor_moneyness.png', output => barChart({
    title: 'BTC TOTAL RETURN BY TENOR',
    subtitle: 'FULL PERIOD SUMMARY RETURN BY MONEYNESS',
    rows: byStrategy(multi),
    field: 'totalReturnPct',
    output
  }), {
    title: 'Total Return By Tenor And Moneyness',
    represents: 'Full-period BTC CCW total return from the multi-tenor analysis.',
    interpretation: 'Higher bars indicate stronger cumulative return; compare moneyness within and across tenors.'
  });

  write('btc_cagr_by_tenor_moneyness.png', output => barChart({
    title: 'BTC CAGR BY TENOR',
    subtitle: 'FULL PERIOD CAGR BY MONEYNESS',
    rows: byStrategy(multi),
    field: 'cagrPct',
    output
  }), {
    title: 'CAGR By Tenor And Moneyness',
    represents: 'Full-period compounded annual growth rate from the multi-tenor analysis.',
    interpretation: 'Higher bars indicate higher annualized return, using summary-level CAGR.'
  });

  write('btc_max_drawdown_by_tenor_moneyness.png', output => barChart({
    title: 'BTC MAX DRAWDOWN MAGNITUDE',
    subtitle: 'END-OF-CYCLE RECONSTRUCTED EQUITY DRAWDOWN',
    rows: byStrategy(equity),
    field: 'maxDrawdownPct',
    output,
    abs: true
  }), {
    title: 'Max Drawdown By Tenor And Moneyness',
    represents: 'Maximum end-of-cycle drawdown magnitude from reconstructed equity.',
    interpretation: 'Lower bars are better; higher bars indicate deeper peak-to-trough losses.'
  });

  write('btc_return_vs_drawdown_scatter.png', output => scatterChart(byStrategy(equity), output), {
    title: 'Return Vs Max Drawdown Scatter',
    represents: 'Reconstructed total return versus maximum drawdown for each full-period strategy.',
    interpretation: 'Upper-right is higher return with less negative drawdown; far-left points carry deeper drawdowns.'
  });

  write('btc_sharpe_sortino_by_strategy.png', output => groupedBarChart({
    title: 'BTC SIMPLE SHARPE SORTINO',
    subtitle: 'PER-CYCLE NON-ANNUALIZED RATIOS',
    rows: byStrategy(equity),
    fields: ['SharpeSimple', 'SortinoSimple'],
    labels: ['SHARPE', 'SORTINO'],
    output
  }), {
    title: 'Sharpe/Sortino Comparison',
    represents: 'Simple per-cycle Sharpe and Sortino values from equity risk analysis.',
    interpretation: 'Useful as a rough consistency view, but not annualized or tenor-normalized.'
  });

  write('btc_rolling_return_by_tenor.png', output => lineChart({
    title: 'BTC ROLLING ONE YEAR RETURN',
    subtitle: 'MONTHLY BUCKET AVG BY TENOR SOURCE DATA UNCHANGED',
    rows: aggregateRollingByMonth(rolling, 'windowReturnPct'),
    field: 'windowReturnPct',
    output,
    yLabel: 'RETURN %'
  }), {
    title: 'Rolling One-Year Return By Tenor',
    represents: 'Monthly-bucketed average rolling one-year return by tenor across full-period moneyness variants.',
    interpretation: 'Shows persistence and regime dependence of return edge over time.'
  });

  write('btc_rolling_drawdown_by_tenor.png', output => lineChart({
    title: 'BTC ROLLING DRAWDOWN',
    subtitle: 'MONTHLY BUCKET AVG BY TENOR SOURCE DATA UNCHANGED',
    rows: aggregateRollingByMonth(rolling, 'rollingDrawdownPct'),
    field: 'rollingDrawdownPct',
    output,
    yLabel: 'DRAWDOWN %'
  }), {
    title: 'Rolling Drawdown By Tenor',
    represents: 'Monthly-bucketed average rolling drawdown by tenor across full-period moneyness variants.',
    interpretation: 'Lower lines indicate deeper rolling drawdown pressure.'
  });

  const regimeHeatRows = Object.entries(regime.reduce((groups, row) => {
    const key = `${row.tenor}|${row.regime_label}`;
    if (!groups[key]) groups[key] = { tenor: row.tenor, regime: row.regime_label, values: [] };
    groups[key].values.push(optionalNumber(row.returnPct));
    return groups;
  }, {})).map(([, group]) => ({
    tenor: group.tenor,
    regime: group.regime,
    value: mean(group.values.filter(value => value !== null))
  }));

  write('btc_regime_return_heatmap.png', output => heatmap(regimeHeatRows, output), {
    title: 'Regime Return Heatmap',
    represents: 'Average regime return by tenor from regime analysis.',
    interpretation: 'Greener cells indicate stronger average regime return; redder cells indicate weaker periods.'
  });

  fs.writeFileSync(path.join(CHART_DIR, 'btc_visualization_index.md'), buildIndex(charts), 'utf8');

  console.log(`Generated ${charts.length} charts`);
  charts.forEach(chart => console.log(`- ${path.join('analysis', 'generated', 'charts', chart.file)}`));
  console.log(`Wrote ${path.join('analysis', 'generated', 'charts', 'btc_visualization_index.md')}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('Error building BTC visualizations:', error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  main
};
