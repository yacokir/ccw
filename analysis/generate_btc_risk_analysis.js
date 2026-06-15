const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const GENERATED = path.join(ROOT, "analysis", "generated");
const BATCHES = path.join(ROOT, "runs", "batches");

const TARGETS = [
  { id: "weekly_otm03", label: "Weekly OTM03", tenor: "weekly", moneyness: "OTM03", batch: "batch_years_otm03_2020_2026", role: "secondary_validation" },
  { id: "weekly_otm05", label: "Weekly OTM05", tenor: "weekly", moneyness: "OTM05", batch: "batch_years_otm05_2020_2026", role: "primary_focus" },
  { id: "weekly_otm10", label: "Weekly OTM10", tenor: "weekly", moneyness: "OTM10", batch: "batch_years_otm10_2020_2026", role: "primary_focus" },
  { id: "btc_buy_hold", label: "BTC Buy & Hold", tenor: "weekly", moneyness: "B&H", batch: "batch_years_otm05_2020_2026", role: "benchmark_btc" },
  { id: "14d_otm10", label: "14d OTM10", tenor: "14d", moneyness: "OTM10", batch: "batch_years_btc_14d_otm10_2020_2026", role: "benchmark_strategy" },
];

const outputs = {
  riskSummary: path.join(GENERATED, "btc_risk_summary.csv"),
  drawdown: path.join(GENERATED, "btc_drawdown_analysis.csv"),
  underwater: path.join(GENERATED, "btc_underwater_analysis.csv"),
  var: path.join(GENERATED, "btc_var_analysis.csv"),
  capture: path.join(GENERATED, "btc_capture_ratios.csv"),
  findings: path.join(GENERATED, "btc_risk_findings.md"),
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];
    if (quoted) {
      if (c === '"' && n === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        cell += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += c;
    }
  }
  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  const header = rows.shift();
  return rows.filter((r) => r.some((v) => v !== "")).map((r) => {
    const obj = {};
    header.forEach((h, i) => (obj[h] = r[i] ?? ""));
    return obj;
  });
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeCsv(file, rows, columns) {
  fs.writeFileSync(file, `${columns.join(",")}\n${rows.map((r) => columns.map((c) => csvEscape(r[c])).join(",")).join("\n")}\n`);
}

function num(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function round(v, d = 6) {
  if (v === null || v === undefined || !Number.isFinite(Number(v))) return "";
  return Number(Number(v).toFixed(d));
}

function mean(xs) {
  const vals = xs.filter(Number.isFinite);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

function stdev(xs) {
  const vals = xs.filter(Number.isFinite);
  if (vals.length < 2) return null;
  const m = mean(vals);
  return Math.sqrt(vals.reduce((s, x) => s + (x - m) ** 2, 0) / (vals.length - 1));
}

function covariance(a, b) {
  const pairs = a.map((x, i) => [x, b[i]]).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (pairs.length < 2) return null;
  const ma = mean(pairs.map((p) => p[0]));
  const mb = mean(pairs.map((p) => p[1]));
  return pairs.reduce((s, [x, y]) => s + (x - ma) * (y - mb), 0) / (pairs.length - 1);
}

function correlation(a, b) {
  const cov = covariance(a, b);
  const sa = stdev(a);
  const sb = stdev(b);
  return cov === null || !sa || !sb ? null : cov / (sa * sb);
}

function beta(strategy, btc) {
  const cov = covariance(strategy, btc);
  const variance = covariance(btc, btc);
  return cov === null || !variance ? null : cov / variance;
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function compound(returns) {
  return (returns.reduce((acc, r) => acc * (1 + r), 1) - 1);
}

function loadBatchRuns(batchName) {
  const summary = JSON.parse(fs.readFileSync(path.join(BATCHES, batchName, "summary.json"), "utf8"));
  return summary.annualResults
    .filter((r) => r.savedRun && r.savedRun.runPath && Number.isInteger(r.year))
    .map((r) => ({
      year: r.year,
      runPath: r.savedRun.runPath,
      summary: r.summary,
    }));
}

function loadSeries(target) {
  const points = [];
  let sequence = 0;
  for (const run of loadBatchRuns(target.batch)) {
    const tradesPath = path.join(run.runPath, "trades.csv");
    const trades = parseCsv(fs.readFileSync(tradesPath, "utf8"));
    for (const t of trades) {
      const strategyReturn = target.id === "btc_buy_hold"
        ? (num(t.S_exit) / num(t.S_entry)) - 1
        : num(t.return_pct);
      const btcReturn = (num(t.S_exit) / num(t.S_entry)) - 1;
      if (!Number.isFinite(strategyReturn) || !Number.isFinite(btcReturn)) continue;
      sequence += 1;
      points.push({
        sequence,
        date: t.exit_date || t.entry_date,
        entry_date: t.entry_date,
        exit_date: t.exit_date,
        year: run.year,
        strategyReturn,
        btcReturn,
      });
    }
  }
  let equity = 1;
  for (const p of points) {
    equity *= 1 + p.strategyReturn;
    p.equity = equity;
  }
  return points;
}

function drawdownSeries(points) {
  let peak = 1;
  let peakIndex = 0;
  return points.map((p, i) => {
    if (p.equity >= peak) {
      peak = p.equity;
      peakIndex = i + 1;
    }
    return {
      sequence: p.sequence,
      date: p.date,
      equity: p.equity,
      peak,
      peakSequence: peakIndex,
      drawdownPct: (p.equity / peak - 1) * 100,
    };
  });
}

function drawdownEvents(points) {
  const dd = drawdownSeries(points);
  const events = [];
  let current = null;
  for (const row of dd) {
    if (row.drawdownPct < 0 && !current) {
      current = {
        startSequence: row.sequence,
        startDate: row.date,
        troughSequence: row.sequence,
        troughDate: row.date,
        maxDrawdownPct: row.drawdownPct,
      };
    }
    if (current && row.drawdownPct < current.maxDrawdownPct) {
      current.maxDrawdownPct = row.drawdownPct;
      current.troughSequence = row.sequence;
      current.troughDate = row.date;
    }
    if (current && row.drawdownPct === 0) {
      current.recoverySequence = row.sequence;
      current.recoveryDate = row.date;
      current.durationCycles = current.recoverySequence - current.startSequence + 1;
      current.recoveryDurationCycles = current.recoverySequence - current.troughSequence;
      current.recovered = true;
      events.push(current);
      current = null;
    }
  }
  if (current) {
    const last = dd[dd.length - 1];
    current.recoverySequence = "";
    current.recoveryDate = "";
    current.durationCycles = last.sequence - current.startSequence + 1;
    current.recoveryDurationCycles = "";
    current.recovered = false;
    events.push(current);
  }
  return events;
}

function rollingStats(points, window) {
  const rows = [];
  for (let i = window - 1; i < points.length; i++) {
    const slice = points.slice(i - window + 1, i + 1);
    const returns = slice.map((p) => p.strategyReturn);
    const avg = mean(returns);
    const vol = stdev(returns);
    rows.push({
      endSequence: points[i].sequence,
      endDate: points[i].date,
      windowCycles: window,
      rollingReturnPct: compound(returns) * 100,
      rollingVolatilityPct: vol * 100,
      rollingSharpe: vol ? (avg / vol) * Math.sqrt(window) : null,
    });
  }
  return rows;
}

function nonOverlappingReturns(points, span) {
  const out = [];
  for (let i = 0; i + span <= points.length; i += span) {
    out.push(compound(points.slice(i, i + span).map((p) => p.strategyReturn)));
  }
  return out;
}

function varEs(returns, level = 0.05) {
  const sorted = [...returns].filter(Number.isFinite).sort((a, b) => a - b);
  const q = percentile(sorted, level);
  const tail = sorted.filter((x) => x <= q);
  return {
    observations: sorted.length,
    returnVaRPct: round(q * 100),
    lossVaRPct: round(Math.max(0, -q * 100)),
    expectedShortfallReturnPct: round(mean(tail) * 100),
    expectedShortfallLossPct: round(Math.max(0, -mean(tail) * 100)),
  };
}

function capture(strategyReturns, btcReturns) {
  const up = [];
  const upBtc = [];
  const down = [];
  const downBtc = [];
  for (let i = 0; i < strategyReturns.length; i++) {
    if (btcReturns[i] > 0) {
      up.push(strategyReturns[i]);
      upBtc.push(btcReturns[i]);
    } else if (btcReturns[i] < 0) {
      down.push(strategyReturns[i]);
      downBtc.push(btcReturns[i]);
    }
  }
  const avgUpBtc = mean(upBtc);
  const avgDownBtc = mean(downBtc);
  return {
    upsideCapturePct: avgUpBtc ? round((mean(up) / avgUpBtc) * 100) : "",
    downsideCapturePct: avgDownBtc ? round((mean(down) / avgDownBtc) * 100) : "",
    upsideSacrificedPct: avgUpBtc ? round(100 - (mean(up) / avgUpBtc) * 100) : "",
    downsideAvoidedPct: avgDownBtc ? round(100 - (mean(down) / avgDownBtc) * 100) : "",
    upCycles: up.length,
    downCycles: down.length,
  };
}

function summarizeTarget(target, points) {
  const returns = points.map((p) => p.strategyReturn);
  const btcReturns = points.map((p) => p.btcReturn);
  const ddRows = drawdownSeries(points);
  const events = drawdownEvents(points);
  const rollingWindow = target.tenor === "14d" ? 26 : 52;
  const rolling = rollingStats(points, rollingWindow);
  const maxDrawdown = Math.min(...ddRows.map((d) => d.drawdownPct));
  const maxEvent = events.reduce((best, e) => !best || e.maxDrawdownPct < best.maxDrawdownPct ? e : best, null);
  const underwaterCycles = ddRows.filter((d) => d.drawdownPct < 0).length;
  const recoveredEvents = events.filter((e) => e.recovered);
  const rollingVols = rolling.map((r) => r.rollingVolatilityPct);
  const rollingSharpes = rolling.map((r) => r.rollingSharpe);
  const rollingReturns = rolling.map((r) => r.rollingReturnPct);
  const sortedRollingReturns = [...rollingReturns].filter(Number.isFinite).sort((a, b) => a - b);
  const sortedRollingVols = [...rollingVols].filter(Number.isFinite).sort((a, b) => a - b);
  const sortedRollingSharpes = [...rollingSharpes].filter(Number.isFinite).sort((a, b) => a - b);
  return {
    target,
    points,
    ddRows,
    events,
    rolling,
    summary: {
      strategy: target.label,
      role: target.role,
      tenor: target.tenor,
      cycles: points.length,
      totalReturnPct: round((points.at(-1).equity - 1) * 100),
      btcSameCycleReturnPct: round(compound(btcReturns) * 100),
      excessReturnPct: round((points.at(-1).equity - 1 - compound(btcReturns)) * 100),
      averageCycleReturnPct: round(mean(returns) * 100),
      cycleVolatilityPct: round(stdev(returns) * 100),
      annualizedVolatilityPct: round(stdev(returns) * Math.sqrt(target.tenor === "14d" ? 26 : 52) * 100),
      sharpeSimpleAnnualized: round((mean(returns) / stdev(returns)) * Math.sqrt(target.tenor === "14d" ? 26 : 52)),
      maxDrawdownPct: round(maxDrawdown),
      maxDrawdownDurationCycles: maxEvent ? maxEvent.durationCycles : "",
      maxDrawdownRecoveryCycles: maxEvent ? maxEvent.recoveryDurationCycles : "",
      drawdownEventCount: events.length,
      drawdownFrequencyPct: round((events.length / points.length) * 100),
      pctTimeUnderwater: round((underwaterCycles / points.length) * 100),
      longestUnderwaterCycles: Math.max(...events.map((e) => e.durationCycles)),
      averageUnderwaterDurationCycles: round(mean(events.map((e) => e.durationCycles))),
      averageRecoveryDurationCycles: round(mean(recoveredEvents.map((e) => e.recoveryDurationCycles))),
      rollingWindowCycles: rollingWindow,
      averageRollingReturnPct: round(mean(rollingReturns)),
      p10RollingReturnPct: round(percentile(sortedRollingReturns, 0.1)),
      p90RollingReturnPct: round(percentile(sortedRollingReturns, 0.9)),
      worstRollingReturnPct: round(sortedRollingReturns[0]),
      averageRollingVolatilityPct: round(mean(rollingVols)),
      p90RollingVolatilityPct: round(percentile(sortedRollingVols, 0.9)),
      maxRollingVolatilityPct: round(sortedRollingVols.at(-1)),
      averageRollingSharpe: round(mean(rollingSharpes)),
      worstRollingSharpe: round(sortedRollingSharpes[0]),
      betaVsBtc: round(beta(returns, btcReturns)),
      correlationVsBtc: round(correlation(returns, btcReturns)),
    },
  };
}

function buildDrawdownRows(result) {
  const thresholds = [10, 20, 30, 40];
  const rows = thresholds.map((t) => {
    const events = result.events.filter((e) => e.maxDrawdownPct <= -t);
    return {
      strategy: result.target.label,
      row_type: "threshold_summary",
      threshold: `>${t}%`,
      event_count: events.length,
      maxDrawdownPct: events.length ? round(Math.min(...events.map((e) => e.maxDrawdownPct))) : "",
      averageDurationCycles: round(mean(events.map((e) => e.durationCycles))),
      averageRecoveryDurationCycles: round(mean(events.filter((e) => e.recovered).map((e) => e.recoveryDurationCycles))),
      startDate: "",
      troughDate: "",
      recoveryDate: "",
      recovered: "",
    };
  });
  for (const e of result.events) {
    rows.push({
      strategy: result.target.label,
      row_type: "event",
      threshold: "",
      event_count: "",
      maxDrawdownPct: round(e.maxDrawdownPct),
      averageDurationCycles: e.durationCycles,
      averageRecoveryDurationCycles: e.recoveryDurationCycles,
      startDate: e.startDate,
      troughDate: e.troughDate,
      recoveryDate: e.recoveryDate,
      recovered: e.recovered,
    });
  }
  return rows;
}

function buildUnderwaterRow(result) {
  const current = result.events.at(-1);
  const currentUnderwater = current && !current.recovered;
  return {
    strategy: result.target.label,
    cycles: result.points.length,
    underwaterCycles: result.ddRows.filter((d) => d.drawdownPct < 0).length,
    pctTimeUnderwater: result.summary.pctTimeUnderwater,
    underwaterEventCount: result.events.length,
    longestUnderwaterCycles: result.summary.longestUnderwaterCycles,
    averageUnderwaterDurationCycles: result.summary.averageUnderwaterDurationCycles,
    averageRecoveryDurationCycles: result.summary.averageRecoveryDurationCycles,
    currentUnderwater: !!currentUnderwater,
    currentUnderwaterStartDate: currentUnderwater ? current.startDate : "",
    currentUnderwaterDurationCycles: currentUnderwater ? current.durationCycles : "",
    currentDrawdownPct: round(result.ddRows.at(-1).drawdownPct),
    averageDrawdownWhenUnderwaterPct: round(mean(result.ddRows.filter((d) => d.drawdownPct < 0).map((d) => d.drawdownPct))),
  };
}

function buildVarRows(result) {
  const span = result.target.tenor === "14d" ? 2 : 4;
  const weekly = varEs(result.points.map((p) => p.strategyReturn));
  const monthly = varEs(nonOverlappingReturns(result.points, span));
  return [
    { strategy: result.target.label, horizon: result.target.tenor === "14d" ? "cycle_14d" : "weekly", confidencePct: 95, ...weekly },
    { strategy: result.target.label, horizon: "monthly_approx", confidencePct: 95, ...monthly },
  ];
}

function buildCaptureRow(result) {
  const returns = result.points.map((p) => p.strategyReturn);
  const btcReturns = result.points.map((p) => p.btcReturn);
  return {
    strategy: result.target.label,
    comparison_grid: result.target.tenor === "14d" ? "14d cycle BTC moves" : "weekly cycle BTC moves",
    betaVsBtc: result.summary.betaVsBtc,
    correlationVsBtc: result.summary.correlationVsBtc,
    ...capture(returns, btcReturns),
  };
}

function writeFindings(results) {
  const byId = new Map(results.map((r) => [r.target.id, r]));
  const o5 = byId.get("weekly_otm05").summary;
  const o10 = byId.get("weekly_otm10").summary;
  const o3 = byId.get("weekly_otm03").summary;
  const b14 = byId.get("14d_otm10").summary;
  const btc = byId.get("btc_buy_hold").summary;
  const o5Var = varEs(byId.get("weekly_otm05").points.map((p) => p.strategyReturn));
  const o10Var = varEs(byId.get("weekly_otm10").points.map((p) => p.strategyReturn));
  const o5Cap = buildCaptureRow(byId.get("weekly_otm05"));
  const o10Cap = buildCaptureRow(byId.get("weekly_otm10"));
  const extraReturn = o10.totalReturnPct - o5.totalReturnPct;
  const extraDrawdown = Math.abs(o10.maxDrawdownPct) - Math.abs(o5.maxDrawdownPct);
  const extraVol = o10.annualizedVolatilityPct - o5.annualizedVolatilityPct;
  const lines = [
    "# BTC Risk Findings",
    "",
    "Generated from existing backtest `trades.csv` files only. No new market data, assets, tenors, or strategies were introduced.",
    "",
    "## Method",
    "",
    "- Returns are reconstructed from per-cycle `return_pct` in each run `trades.csv`.",
    "- BTC benchmark returns use the same cycle entry/exit prices as each strategy row.",
    "- Drawdowns and underwater periods are measured on reconstructed cycle-end equity.",
    "- Weekly VaR and Expected Shortfall use the historical 5th percentile and average of observations at or below that percentile. Monthly VaR compounds non-overlapping 4-week blocks for weekly series and 2-cycle blocks for 14d.",
    "- Rolling risk uses 52 cycles for weekly/BTC and 26 cycles for 14d, matching the existing project convention for one-year windows.",
    "",
    "## OTM05 vs OTM10",
    "",
    `- Weekly OTM10 total return: ${o10.totalReturnPct}% vs Weekly OTM05 ${o5.totalReturnPct}% (${round(extraReturn)} percentage points higher).`,
    `- Weekly OTM10 max drawdown: ${o10.maxDrawdownPct}% vs Weekly OTM05 ${o5.maxDrawdownPct}% (${round(extraDrawdown)} points deeper).`,
    `- Weekly OTM10 annualized volatility: ${o10.annualizedVolatilityPct}% vs Weekly OTM05 ${o5.annualizedVolatilityPct}% (${round(extraVol)} points higher).`,
    `- Weekly OTM10 annualized Sharpe proxy: ${o10.sharpeSimpleAnnualized} vs Weekly OTM05 ${o5.sharpeSimpleAnnualized}.`,
    `- Weekly OTM10 95% weekly VaR/ES loss: ${o10Var.lossVaRPct}% / ${o10Var.expectedShortfallLossPct}% vs OTM05 ${o5Var.lossVaRPct}% / ${o5Var.expectedShortfallLossPct}%.`,
    `- Weekly OTM10 spent ${o10.pctTimeUnderwater}% of cycles underwater vs OTM05 ${o5.pctTimeUnderwater}%.`,
    "",
    "## Exposure",
    "",
    `- Weekly OTM10 beta/correlation vs BTC: ${o10.betaVsBtc} / ${o10.correlationVsBtc}.`,
    `- Weekly OTM05 beta/correlation vs BTC: ${o5.betaVsBtc} / ${o5.correlationVsBtc}.`,
    `- OTM10 upside/downside capture: ${o10Cap.upsideCapturePct}% / ${o10Cap.downsideCapturePct}%.`,
    `- OTM05 upside/downside capture: ${o5Cap.upsideCapturePct}% / ${o5Cap.downsideCapturePct}%.`,
    "",
    "The strategies do not materially remove BTC exposure; they mostly reshape it. Both retain high BTC correlation and beta, while the short-call overlay trades upside participation for premium income and some downside cushioning.",
    "",
    "## Benchmarks",
    "",
    `- Weekly OTM03: ${o3.totalReturnPct}% total return, ${o3.maxDrawdownPct}% max drawdown, Sharpe ${o3.sharpeSimpleAnnualized}.`,
    `- 14d OTM10: ${b14.totalReturnPct}% total return on its 14d grid, ${b14.maxDrawdownPct}% max drawdown, Sharpe ${b14.sharpeSimpleAnnualized}.`,
    `- BTC Buy & Hold weekly benchmark: ${btc.totalReturnPct}% total return, ${btc.maxDrawdownPct}% max drawdown, Sharpe ${btc.sharpeSimpleAnnualized}.`,
    "",
    "## Recommendation",
    "",
    "Prefer Weekly OTM05 as the risk-analysis baseline. Weekly OTM10 delivers more total return, but the additional return comes with deeper drawdowns, higher volatility, worse tail loss, and more time underwater. OTM10 remains attractive when maximizing long-run upside is the primary objective, but OTM05 is the better balanced candidate for continued research because its risk-adjusted profile is cleaner while still preserving strong outperformance.",
  ];
  fs.writeFileSync(outputs.findings, `${lines.join("\n")}\n`);
}

function main() {
  const results = TARGETS.map((target) => summarizeTarget(target, loadSeries(target)));
  writeCsv(outputs.riskSummary, results.map((r) => r.summary), [
    "strategy", "role", "tenor", "cycles", "totalReturnPct", "btcSameCycleReturnPct", "excessReturnPct",
    "averageCycleReturnPct", "cycleVolatilityPct", "annualizedVolatilityPct", "sharpeSimpleAnnualized",
    "maxDrawdownPct", "maxDrawdownDurationCycles", "maxDrawdownRecoveryCycles", "drawdownEventCount",
    "drawdownFrequencyPct", "pctTimeUnderwater", "longestUnderwaterCycles", "averageUnderwaterDurationCycles",
    "averageRecoveryDurationCycles", "rollingWindowCycles", "averageRollingReturnPct", "averageRollingVolatilityPct",
    "averageRollingSharpe", "p10RollingReturnPct", "p90RollingReturnPct", "worstRollingReturnPct",
    "p90RollingVolatilityPct", "maxRollingVolatilityPct", "worstRollingSharpe", "betaVsBtc", "correlationVsBtc",
  ]);
  writeCsv(outputs.drawdown, results.flatMap(buildDrawdownRows), [
    "strategy", "row_type", "threshold", "event_count", "maxDrawdownPct", "averageDurationCycles",
    "averageRecoveryDurationCycles", "startDate", "troughDate", "recoveryDate", "recovered",
  ]);
  writeCsv(outputs.underwater, results.map(buildUnderwaterRow), [
    "strategy", "cycles", "underwaterCycles", "pctTimeUnderwater", "underwaterEventCount",
    "longestUnderwaterCycles", "averageUnderwaterDurationCycles", "averageRecoveryDurationCycles",
    "currentUnderwater", "currentUnderwaterStartDate", "currentUnderwaterDurationCycles",
    "currentDrawdownPct", "averageDrawdownWhenUnderwaterPct",
  ]);
  writeCsv(outputs.var, results.flatMap(buildVarRows), [
    "strategy", "horizon", "confidencePct", "observations", "returnVaRPct", "lossVaRPct",
    "expectedShortfallReturnPct", "expectedShortfallLossPct",
  ]);
  writeCsv(outputs.capture, results.map(buildCaptureRow), [
    "strategy", "comparison_grid", "betaVsBtc", "correlationVsBtc", "upsideCapturePct",
    "downsideCapturePct", "upsideSacrificedPct", "downsideAvoidedPct", "upCycles", "downCycles",
  ]);
  writeFindings(results);
}

main();
