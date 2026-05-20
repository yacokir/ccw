const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const GENERATED_DIR = path.join(REPO_ROOT, 'analysis', 'generated');
const CHART_DIR = path.join(GENERATED_DIR, 'charts');
const INPUT_JSON = path.join(GENERATED_DIR, 'btc_hedge_frontier_phase1_comparison.json');
const INDEX_MD = path.join(CHART_DIR, 'btc_hedge_frontier_index.md');
const MAIN_INDEX_MD = path.join(CHART_DIR, 'btc_visualization_index.md');

const COLORS = {
  weekly: [43, 111, 173, 255],
  '14d': [58, 150, 118, 255],
  h00: [76, 99, 130, 255],
  h10: [58, 150, 118, 255],
  h20: [229, 179, 75, 255],
  h30: [204, 124, 55, 255],
  h40: [190, 73, 73, 255],
  grid: [225, 229, 235, 255],
  axis: [55, 65, 81, 255],
  text: [31, 41, 55, 255],
  muted: [107, 114, 128, 255],
  bg: [255, 255, 255, 255],
  red: [190, 73, 73, 255],
  green: [58, 145, 91, 255],
  blue: [43, 111, 173, 255]
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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function optionalNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function mean(values) {
  const nums = values.filter(Number.isFinite);
  return nums.length ? nums.reduce((sum, value) => sum + value, 0) / nums.length : null;
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
  for (let py = y0; py < y1; py++) {
    let index = (py * canvas.width + x0) * 4;
    for (let px = x0; px < x1; px++) {
      canvas.data[index] = color[0];
      canvas.data[index + 1] = color[1];
      canvas.data[index + 2] = color[2];
      canvas.data[index + 3] = color[3] ?? 255;
      index += 4;
    }
  }
}

function drawLine(canvas, x0, y0, x1, y1, color) {
  if (![x0, y0, x1, y1].every(Number.isFinite)) return;
  const sx = Math.round(x0);
  const sy = Math.round(y0);
  const ex = Math.round(x1);
  const ey = Math.round(y1);
  const steps = Math.max(Math.abs(ex - sx), Math.abs(ey - sy));
  for (let i = 0; i <= steps; i++) {
    const t = steps ? i / steps : 0;
    setPixel(canvas, Math.round(sx + (ex - sx) * t), Math.round(sy + (ey - sy) * t), color);
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

function drawTitle(canvas, title, subtitle) {
  drawText(canvas, title, 34, 24, COLORS.text, 3);
  if (subtitle) drawText(canvas, subtitle, 36, 56, COLORS.muted, 2);
}

function drawAxes(canvas, plot, yMin, yMax, yLabel) {
  fillRect(canvas, plot.x, plot.y, 1, plot.h, COLORS.axis);
  fillRect(canvas, plot.x, plot.y + plot.h, plot.w, 1, COLORS.axis);
  for (let i = 0; i <= 4; i++) {
    const y = plot.y + plot.h - plot.h * i / 4;
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
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
  fs.writeFileSync(filePath, png);
}

function drawLegend(canvas, items, x, y) {
  items.forEach(([key, label], index) => {
    fillRect(canvas, x + index * 112, y, 18, 18, COLORS[key] || COLORS.axis);
    drawText(canvas, label, x + 24 + index * 112, y + 2, COLORS.text, 2);
  });
}

function groupedByTenorBarChart({ title, subtitle, rows, field, output, abs = false, yLabel = '%' }) {
  const canvas = createCanvas(1100, 680);
  const plot = { x: 82, y: 108, w: 960, h: 430 };
  const values = rows.map(row => abs ? Math.abs(optionalNumber(row[field])) : optionalNumber(row[field])).filter(Number.isFinite);
  const yMax = Math.max(...values, 1) * 1.15;
  drawTitle(canvas, title, subtitle);
  drawAxes(canvas, plot, 0, yMax, yLabel);
  const tenors = ['weekly', '14d'];
  const hedges = ['h00', 'h10', 'h20', 'h30', 'h40'];
  const groupW = plot.w / tenors.length;
  tenors.forEach((tenor, tenorIndex) => {
    hedges.forEach((hedge, hedgeIndex) => {
      const row = rows.find(item => item.tenor === tenor && item.hedgeLabel === hedge);
      if (!row) return;
      const value = abs ? Math.abs(optionalNumber(row[field])) : optionalNumber(row[field]);
      if (value === null) return;
      const barW = 30;
      const x = plot.x + tenorIndex * groupW + 56 + hedgeIndex * 42;
      const y = scaleY(value, plot, 0, yMax);
      fillRect(canvas, x, y, barW, plot.y + plot.h - y, COLORS[hedge]);
    });
    drawText(canvas, tenor, plot.x + tenorIndex * groupW + 116, plot.y + plot.h + 18, COLORS.text, 2);
  });
  drawLegend(canvas, hedges.map(hedge => [hedge, hedge.toUpperCase()]), 472, 72);
  writePng(canvas, output);
}

function scatterChart(rows, output) {
  const canvas = createCanvas(1100, 680);
  const plot = { x: 92, y: 108, w: 950, h: 430 };
  const xs = rows.map(row => optionalNumber(row.maxDrawdownPct)).filter(Number.isFinite);
  const ys = rows.map(row => optionalNumber(row.cagrPct)).filter(Number.isFinite);
  const xMin = Math.min(...xs) * 1.05;
  const xMax = Math.max(...xs) * 0.95;
  const yMin = Math.min(...ys, 0);
  const yMax = Math.max(...ys, 1) * 1.08;
  drawTitle(canvas, 'HEDGE RETURN VS DRAWDOWN', 'X: MAX DRAWDOWN %  Y: CAGR %');
  drawAxes(canvas, plot, yMin, yMax, 'CAGR %');
  for (let i = 0; i <= 4; i++) {
    const x = plot.x + plot.w * i / 4;
    const value = xMin + (xMax - xMin) * i / 4;
    drawLine(canvas, x, plot.y, x, plot.y + plot.h, COLORS.grid);
    drawText(canvas, value.toFixed(0), x - 16, plot.y + plot.h + 14, COLORS.muted, 2);
  }
  rows.forEach(row => {
    const xVal = optionalNumber(row.maxDrawdownPct);
    const yVal = optionalNumber(row.cagrPct);
    if (xVal === null || yVal === null) return;
    const x = plot.x + ((xVal - xMin) / (xMax - xMin)) * plot.w;
    const y = scaleY(yVal, plot, yMin, yMax);
    fillRect(canvas, x - 5, y - 5, 10, 10, COLORS[row.hedgeLabel]);
    drawText(canvas, row.tenor === 'weekly' ? 'W' : '14', x + 8, y - 8, COLORS[row.tenor], 1);
  });
  drawLegend(canvas, [['weekly', 'WEEKLY'], ['14d', '14D'], ['h00', 'H00'], ['h20', 'H20'], ['h40', 'H40']], 470, 72);
  writePng(canvas, output);
}

function monthStartDate(value) {
  const date = parseDate(value);
  if (!date) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function aggregateRolling(rows) {
  const source = rows.filter(row => (
    (row.tenor === 'weekly' && Number(row.windowCycles) === 52)
    || (row.tenor === '14d' && Number(row.windowCycles) === 26)
  ));
  const groups = {};
  source.forEach(row => {
    const date = monthStartDate(row.windowEndDate);
    const value = optionalNumber(row.rollingDrawdownPct);
    if (!date || value === null) return;
    const key = `${row.tenor}|${row.hedgeLabel}|${date}`;
    if (!groups[key]) groups[key] = { tenor: row.tenor, hedgeLabel: row.hedgeLabel, date, values: [] };
    groups[key].values.push(value);
  });
  return Object.values(groups).map(group => ({
    tenor: group.tenor,
    hedgeLabel: group.hedgeLabel,
    date: group.date,
    value: mean(group.values)
  })).sort((a, b) => a.tenor.localeCompare(b.tenor) || a.hedgeLabel.localeCompare(b.hedgeLabel) || parseDate(a.date) - parseDate(b.date));
}

function rollingLineChart(rows, output) {
  const canvas = createCanvas(1100, 680);
  const plot = { x: 82, y: 108, w: 960, h: 430 };
  const values = rows.map(row => row.value).filter(Number.isFinite);
  const dates = rows.map(row => parseDate(row.date)).filter(Boolean).map(date => date.getTime());
  const xMin = Math.min(...dates);
  const xMax = Math.max(...dates);
  const yMin = Math.min(...values, 0);
  const yMax = Math.max(...values, 1);
  drawTitle(canvas, 'HEDGE ROLLING DRAWDOWN', 'ONE YEAR WINDOWS BY TENOR AND HEDGE');
  drawAxes(canvas, plot, yMin, yMax, 'DRAWDOWN %');
  ['weekly', '14d'].forEach(tenor => {
    ['h00', 'h20', 'h40'].forEach(hedge => {
      const series = rows.filter(row => row.tenor === tenor && row.hedgeLabel === hedge);
      for (let i = 1; i < series.length; i++) {
        const a = series[i - 1];
        const b = series[i];
        const x0 = plot.x + ((parseDate(a.date).getTime() - xMin) / (xMax - xMin)) * plot.w;
        const x1 = plot.x + ((parseDate(b.date).getTime() - xMin) / (xMax - xMin)) * plot.w;
        drawLine(canvas, x0, scaleY(a.value, plot, yMin, yMax), x1, scaleY(b.value, plot, yMin, yMax), COLORS[hedge]);
      }
    });
  });
  drawLegend(canvas, [['h00', 'H00'], ['h20', 'H20'], ['h40', 'H40']], 706, 72);
  drawText(canvas, '2020', plot.x, plot.y + plot.h + 16, COLORS.muted, 2);
  drawText(canvas, '2026', plot.x + plot.w - 48, plot.y + plot.h + 16, COLORS.muted, 2);
  writePng(canvas, output);
}

function heatColor(value, minValue, maxValue) {
  if (maxValue === minValue) return COLORS.h20;
  const t = (value - minValue) / (maxValue - minValue);
  const r = Math.round(190 * (1 - t) + 58 * t);
  const g = Math.round(73 * (1 - t) + 145 * t);
  const b = Math.round(73 * (1 - t) + 91 * t);
  return [r, g, b, 255];
}

function regimeHeatmap(rows, output) {
  const canvas = createCanvas(1100, 680);
  const filtered = rows.filter(row => row.regime_label === 'bear_2022');
  const values = filtered.map(row => optionalNumber(row.drawdownPct)).filter(Number.isFinite);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  drawTitle(canvas, 'HEDGE BEAR REGIME DRAWDOWN', '2022 END OF CYCLE REGIME DRAWDOWN');
  const tenors = ['weekly', '14d'];
  const hedges = ['h00', 'h10', 'h20', 'h30', 'h40'];
  const x0 = 190;
  const y0 = 150;
  const cellW = 150;
  const cellH = 110;
  hedges.forEach((hedge, index) => drawText(canvas, hedge, x0 + index * cellW + 48, y0 - 36, COLORS.text, 2));
  tenors.forEach((tenor, index) => drawText(canvas, tenor, 70, y0 + index * cellH + 44, COLORS.text, 2));
  tenors.forEach((tenor, yIndex) => {
    hedges.forEach((hedge, xIndex) => {
      const row = filtered.find(item => item.tenor === tenor && item.hedgeLabel === hedge);
      const value = row ? optionalNumber(row.drawdownPct) : null;
      const x = x0 + xIndex * cellW;
      const y = y0 + yIndex * cellH;
      fillRect(canvas, x, y, cellW - 8, cellH - 8, value === null ? COLORS.grid : heatColor(value, minValue, maxValue));
      drawText(canvas, value === null ? 'NA' : value.toFixed(1), x + 44, y + 42, [255, 255, 255, 255], 2);
    });
  });
  writePng(canvas, output);
}

function buildIndex(charts) {
  return [
    '# BTC Hedge Frontier Visualization Index',
    '',
    'Generated static PNG charts for Hedge Frontier Research Phase 1.',
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
    '## Caveats',
    '',
    '- Charts read generated hedge Phase 1 outputs only; no baseline backtests are rerun.',
    '- Funding, basis, liquidation risk, margin mechanics, and intracycle hedge rebalance are ignored.',
    '- Drawdown uses end-of-cycle reconstructed equity and may understate intracycle stress.',
    '- Hedge ratios are fixed always-on short BTC perpetual proxies.',
    ''
  ].join('\n');
}

function updateMainIndex(charts) {
  const existing = fs.existsSync(MAIN_INDEX_MD) ? fs.readFileSync(MAIN_INDEX_MD, 'utf8') : '# BTC Visualization Index\n';
  const marker = '## Hedge Frontier Phase 1 Charts';
  const base = existing.includes(marker) ? existing.slice(0, existing.indexOf(marker)).trimEnd() : existing.trimEnd();
  const section = [
    '',
    marker,
    '',
    'Hedge Frontier Phase 1 charts are generated from analysis-only fixed hedge post-processing outputs.',
    '',
    `- Dedicated index: [btc_hedge_frontier_index.md](./btc_hedge_frontier_index.md)`,
    ...charts.map(chart => `- ${chart.title}: [${chart.file}](./${chart.file})`),
    '',
    '### Hedge Chart Caveats',
    '',
    '- These charts do not include funding, basis, liquidation, or margin mechanics.',
    '- Results are fixed-ratio, roll-rebalanced hedge simulations over existing CCW baseline cycles.',
    ''
  ].join('\n');
  fs.writeFileSync(MAIN_INDEX_MD, `${base}\n${section}`, 'utf8');
}

function main() {
  fs.mkdirSync(CHART_DIR, { recursive: true });
  const analysis = readJson(INPUT_JSON);
  const rows = analysis.rows || [];
  const rollingRows = analysis.rollingRows || [];
  const regimeRows = analysis.regimeRows || [];
  const charts = [];

  const write = (file, fn, meta) => {
    fn(path.join(CHART_DIR, file));
    charts.push({ file, ...meta });
  };

  write('btc_hedge_return_vs_drawdown.png', output => scatterChart(rows, output), {
    title: 'Hedge Return Vs Drawdown',
    represents: 'CAGR versus maximum end-of-cycle drawdown for weekly and 14d OTM10 hedge variants.',
    interpretation: 'Useful for seeing the hedge frontier shape; upper-right is better return with shallower drawdown.'
  });

  write('btc_hedge_cagr_by_ratio.png', output => groupedByTenorBarChart({
    title: 'HEDGE CAGR BY RATIO',
    subtitle: 'WEEKLY AND 14D OTM10 FIXED HEDGES',
    rows,
    field: 'cagrPct',
    output
  }), {
    title: 'CAGR By Hedge Ratio',
    represents: 'CAGR by tenor and fixed hedge ratio.',
    interpretation: 'Shows how much upside is given up as hedge ratio increases.'
  });

  write('btc_hedge_max_drawdown_by_ratio.png', output => groupedByTenorBarChart({
    title: 'HEDGE MAX DRAWDOWN',
    subtitle: 'MAGNITUDE OF END OF CYCLE DRAWDOWN',
    rows,
    field: 'maxDrawdownPct',
    output,
    abs: true
  }), {
    title: 'Max Drawdown By Hedge Ratio',
    represents: 'Maximum drawdown magnitude by tenor and fixed hedge ratio.',
    interpretation: 'Lower bars are better; larger hedges should mechanically reduce long-delta drawdown pressure.'
  });

  write('btc_hedge_ulcer_by_ratio.png', output => groupedByTenorBarChart({
    title: 'HEDGE ULCER INDEX',
    subtitle: 'END OF CYCLE DRAWDOWN DEPTH AND PERSISTENCE',
    rows,
    field: 'ulcerIndex',
    output,
    yLabel: 'INDEX'
  }), {
    title: 'Ulcer Index By Hedge Ratio',
    represents: 'Ulcer index by tenor and fixed hedge ratio.',
    interpretation: 'Lower bars indicate lower average squared drawdown pressure in the end-of-cycle path.'
  });

  write('btc_hedge_rolling_drawdown.png', output => rollingLineChart(aggregateRolling(rollingRows), output), {
    title: 'Rolling Drawdown By Hedge Ratio',
    represents: 'One-year rolling drawdown for h00, h20, and h40 overlays.',
    interpretation: 'Shows whether hedge variants reduce rolling drawdown pressure consistently through time.'
  });

  write('btc_hedge_regime_heatmap.png', output => regimeHeatmap(regimeRows, output), {
    title: 'Bear Regime Drawdown Heatmap',
    represents: '2022 bear-regime drawdown by tenor and hedge ratio.',
    interpretation: 'Greener cells indicate shallower drawdown in the fixed 2022 regime window.'
  });

  fs.writeFileSync(INDEX_MD, buildIndex(charts), 'utf8');
  updateMainIndex(charts);

  console.log(`Generated ${charts.length} hedge charts`);
  charts.forEach(chart => console.log(`- ${path.join('analysis', 'generated', 'charts', chart.file)}`));
  console.log(`Wrote ${path.join('analysis', 'generated', 'charts', 'btc_hedge_frontier_index.md')}`);
  console.log(`Updated ${path.join('analysis', 'generated', 'charts', 'btc_visualization_index.md')}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('Error building BTC hedge visualizations:', error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  main
};
