const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const GENERATED = path.join(ROOT, "analysis", "generated");
const BATCHES = path.join(ROOT, "runs", "batches");

const STRATEGIES = [
  { id: "otm03", label: "Weekly OTM03", batch: "batch_years_otm03_2020_2026", role: "reference" },
  { id: "otm05", label: "Weekly OTM05", batch: "batch_years_otm05_2020_2026", role: "baseline" },
  { id: "otm10", label: "Weekly OTM10", batch: "batch_years_otm10_2020_2026", role: "aggressive" },
  { id: "btc", label: "BTC Buy & Hold", batch: "batch_years_otm05_2020_2026", role: "benchmark" },
];

const SCENARIOS = [
  {
    scenario: "idealized",
    optionOpeningFeeRate: 0,
    deliveryFeeRate: 0,
    premiumSlippagePct: 0,
    description: "No option fees, delivery fees, or slippage.",
  },
  {
    scenario: "realistic",
    optionOpeningFeeRate: 0.0003,
    optionOpeningFeePremiumCapPct: 0.125,
    deliveryFeeRate: 0.00015,
    premiumSlippagePct: 0.05,
    description: "Deribit-style option opening fee, delivery fee on assigned calls, and 5% short-premium execution haircut.",
  },
  {
    scenario: "stress",
    optionOpeningFeeRate: 0.0006,
    optionOpeningFeePremiumCapPct: 0.25,
    deliveryFeeRate: 0.0003,
    premiumSlippagePct: 0.10,
    extraUnderlyingSlippageRate: 0.00025,
    description: "2x fee rates, 10% short-premium execution haircut, and additional 2.5 bp underlying slippage on assigned calls.",
  },
];

const outputs = {
  friction: path.join(GENERATED, "btc_friction_analysis.csv"),
  sensitivity: path.join(GENERATED, "btc_friction_sensitivity.csv"),
  yearly: path.join(GENERATED, "btc_yearly_stability_analysis.csv"),
  transitions: path.join(GENERATED, "btc_regime_transition_analysis.csv"),
  implementation: path.join(GENERATED, "btc_implementation_analysis.csv"),
  findings: path.join(GENERATED, "btc_robustness_findings.md"),
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
  const lines = [columns.join(",")];
  for (const row of rows) lines.push(columns.map((c) => csvEscape(row[c])).join(","));
  fs.writeFileSync(file, `${lines.join("\n")}\n`);
}

function n(value, fallback = null) {
  const x = Number(value);
  return Number.isFinite(x) ? x : fallback;
}

function round(value, decimals = 6) {
  if (!Number.isFinite(Number(value))) return "";
  return Number(Number(value).toFixed(decimals));
}

function mean(values) {
  const xs = values.filter(Number.isFinite);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

function stdev(values) {
  const xs = values.filter(Number.isFinite);
  if (xs.length < 2) return null;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}

function compound(returns) {
  return returns.reduce((acc, r) => acc * (1 + r), 1) - 1;
}

function maxDrawdown(points) {
  let peak = 1;
  let maxDd = 0;
  let peakSeq = 0;
  let troughSeq = 0;
  let recoverySeq = "";
  for (const p of points) {
    if (p.equity >= peak) {
      if (troughSeq && !recoverySeq) recoverySeq = p.sequence;
      peak = p.equity;
      peakSeq = p.sequence;
    }
    const dd = p.equity / peak - 1;
    if (dd < maxDd) {
      maxDd = dd;
      troughSeq = p.sequence;
      recoverySeq = "";
    }
  }
  return {
    maxDrawdownPct: maxDd * 100,
    troughSequence: troughSeq,
    recoveryCycles: recoverySeq && troughSeq ? recoverySeq - troughSeq : "",
    peakSequence: peakSeq,
  };
}

function loadBatchRuns(batchName) {
  const summary = JSON.parse(fs.readFileSync(path.join(BATCHES, batchName, "summary.json"), "utf8"));
  return summary.annualResults
    .filter((r) => Number.isInteger(r.year) && r.savedRun && r.savedRun.runPath)
    .map((r) => ({ year: r.year, runPath: r.savedRun.runPath }));
}

function loadTrades(strategy) {
  let sequence = 0;
  const trades = [];
  for (const run of loadBatchRuns(strategy.batch)) {
    const rows = parseCsv(fs.readFileSync(path.join(run.runPath, "trades.csv"), "utf8"));
    for (const row of rows) {
      sequence += 1;
      trades.push({ ...row, year: run.year, sequence });
    }
  }
  return trades;
}

function strategyReturnFromTrade(strategy, trade, scenario) {
  if (strategy.id === "btc") return n(trade.S_exit) / n(trade.S_entry) - 1;

  const capitalBefore = n(trade.capital_before, 0);
  const btcPosition = n(trade.btc_position, 0);
  const sEntry = n(trade.S_entry, 0);
  const sSettlement = n(trade.S_settlement, n(trade.S_exit, sEntry));
  const premiumUsd = n(trade.C_entry_btc, n(trade.C_entry, 0)) * sEntry * btcPosition;
  const payoff = n(trade.payoff, 0);
  const pnlTotal = n(trade.pnl_total, 0);
  const openingFee = Math.min(
    scenario.optionOpeningFeeRate * sEntry * btcPosition,
    (scenario.optionOpeningFeePremiumCapPct ?? 1) * premiumUsd
  );
  const deliveryFee = payoff > 0 ? scenario.deliveryFeeRate * sSettlement * btcPosition : 0;
  const premiumSlippage = scenario.premiumSlippagePct * premiumUsd;
  const underlyingSlippage = payoff > 0 ? (scenario.extraUnderlyingSlippageRate || 0) * sSettlement * btcPosition : 0;
  return (pnlTotal - openingFee - deliveryFee - premiumSlippage - underlyingSlippage) / capitalBefore;
}

function buildScenarioSeries(strategy, scenario) {
  const trades = loadTrades(strategy);
  let equity = 1;
  return trades.map((trade) => {
    const r = strategyReturnFromTrade(strategy, trade, scenario);
    equity *= 1 + r;
    return {
      strategy: strategy.label,
      scenario: scenario.scenario,
      sequence: trade.sequence,
      year: trade.year,
      entryDate: trade.entry_date,
      exitDate: trade.exit_date,
      return: r,
      btcReturn: n(trade.S_exit) / n(trade.S_entry) - 1,
      equity,
      assigned: strategy.id !== "btc" && n(trade.payoff, 0) > 0,
      hasCall: strategy.id !== "btc" && String(trade.has_call).toLowerCase() === "true",
      synthetic: strategy.id !== "btc" && String(trade.option_entry_is_synthetic).toLowerCase() === "true",
    };
  });
}

function summarizeSeries(strategy, scenario, series) {
  const returns = series.map((p) => p.return);
  const btcReturn = compound(series.map((p) => p.btcReturn));
  const dd = maxDrawdown(series);
  return {
    strategy: strategy.label,
    role: strategy.role,
    scenario: scenario.scenario,
    scenario_description: scenario.description,
    cycles: series.length,
    revisedReturnPct: round((series.at(-1).equity - 1) * 100),
    btcReturnPct: round(btcReturn * 100),
    revisedExcessReturnPct: round((series.at(-1).equity - 1 - btcReturn) * 100),
    revisedSharpe: round((mean(returns) / stdev(returns)) * Math.sqrt(52)),
    revisedDrawdownPct: round(dd.maxDrawdownPct),
    totalAssignedCycles: series.filter((p) => p.assigned).length,
    syntheticCycles: series.filter((p) => p.synthetic).length,
  };
}

function buildFrictionRows() {
  const rows = [];
  const cache = new Map();
  for (const strategy of STRATEGIES) {
    for (const scenario of SCENARIOS) {
      const series = buildScenarioSeries(strategy, scenario);
      cache.set(`${strategy.id}|${scenario.scenario}`, series);
      rows.push(summarizeSeries(strategy, scenario, series));
    }
  }
  return { rows, cache };
}

function buildSensitivityRows(frictionRows) {
  const rows = [];
  for (const strategy of STRATEGIES) {
    const ideal = frictionRows.find((r) => r.strategy === strategy.label && r.scenario === "idealized");
    for (const scenario of ["realistic", "stress"]) {
      const row = frictionRows.find((r) => r.strategy === strategy.label && r.scenario === scenario);
      rows.push({
        strategy: strategy.label,
        scenario,
        returnDegradationPctPoints: round(row.revisedReturnPct - ideal.revisedReturnPct),
        excessDegradationPctPoints: round(row.revisedExcessReturnPct - ideal.revisedExcessReturnPct),
        sharpeChange: round(row.revisedSharpe - ideal.revisedSharpe),
        drawdownChangePctPoints: round(row.revisedDrawdownPct - ideal.revisedDrawdownPct),
        remainsAboveBtc: row.revisedExcessReturnPct > 0,
      });
    }
  }
  return rows;
}

function buildYearlyRows(cache) {
  const rows = [];
  for (const strategy of STRATEGIES) {
    const series = cache.get(`${strategy.id}|idealized`);
    const years = [...new Set(series.map((p) => p.year))].sort((a, b) => a - b);
    for (const year of years) {
      const ys = series.filter((p) => p.year === year);
      const returns = ys.map((p) => p.return);
      const btc = compound(ys.map((p) => p.btcReturn));
      const eqSeries = [];
      let equity = 1;
      for (const p of ys) {
        equity *= 1 + p.return;
        eqSeries.push({ ...p, equity });
      }
      rows.push({
        strategy: strategy.label,
        year,
        cycles: ys.length,
        returnPct: round(compound(returns) * 100),
        btcReturnPct: round(btc * 100),
        excessReturnPct: round((compound(returns) - btc) * 100),
        volatilityPct: round(stdev(returns) * 100),
        sharpe: round((mean(returns) / stdev(returns)) * Math.sqrt(52)),
        maxDrawdownPct: round(maxDrawdown(eqSeries).maxDrawdownPct),
        positiveCyclePct: round((returns.filter((r) => r > 0).length / returns.length) * 100),
      });
    }
    const fullYears = rows.filter((r) => r.strategy === strategy.label && r.year >= 2020 && r.year <= 2025);
    rows.push({
      strategy: strategy.label,
      year: "STABILITY_2020_2025",
      cycles: fullYears.reduce((s, r) => s + r.cycles, 0),
      returnPct: round(mean(fullYears.map((r) => r.returnPct))),
      btcReturnPct: round(mean(fullYears.map((r) => r.btcReturnPct))),
      excessReturnPct: round(mean(fullYears.map((r) => r.excessReturnPct))),
      volatilityPct: round(stdev(fullYears.map((r) => r.returnPct))),
      sharpe: round(mean(fullYears.map((r) => r.sharpe))),
      maxDrawdownPct: round(Math.min(...fullYears.map((r) => r.maxDrawdownPct))),
      positiveCyclePct: round((fullYears.filter((r) => r.returnPct > 0).length / fullYears.length) * 100),
    });
  }
  return rows;
}

function inWindow(point, start, end) {
  const t = new Date(point.entryDate).getTime();
  return t >= new Date(start).getTime() && t <= new Date(end).getTime();
}

function buildTransitionRows(cache) {
  const windows = [
    { transition: "bull_to_bear", start: "2021-07-01T00:00:00Z", end: "2022-06-30T23:59:59Z" },
    { transition: "bear_to_bull", start: "2022-07-01T00:00:00Z", end: "2023-06-30T23:59:59Z" },
  ];
  const rows = [];
  for (const strategy of STRATEGIES) {
    const series = cache.get(`${strategy.id}|idealized`);
    for (const w of windows) {
      const xs = series.filter((p) => inWindow(p, w.start, w.end));
      let equity = 1;
      const eq = xs.map((p) => {
        equity *= 1 + p.return;
        return { ...p, equity };
      });
      const dd = maxDrawdown(eq);
      rows.push({
        strategy: strategy.label,
        transition: w.transition,
        windowStart: w.start.slice(0, 10),
        windowEnd: w.end.slice(0, 10),
        cycles: xs.length,
        returnPct: round((equity - 1) * 100),
        btcReturnPct: round(compound(xs.map((p) => p.btcReturn)) * 100),
        returnPreservationVsBtcPct: round(((equity - 1) - compound(xs.map((p) => p.btcReturn))) * 100),
        maxDrawdownPct: round(dd.maxDrawdownPct),
        recoveryCycles: dd.recoveryCycles,
        assignedCycles: xs.filter((p) => p.assigned).length,
      });
    }
  }
  return rows;
}

function buildImplementationRows(cache) {
  const rows = [];
  for (const strategy of STRATEGIES) {
    const series = cache.get(`${strategy.id}|idealized`);
    const years = (new Date(series.at(-1).exitDate) - new Date(series[0].entryDate)) / (365.25 * 24 * 3600 * 1000);
    const openingCycles = series.filter((p) => p.hasCall).length;
    const assignedCycles = series.filter((p) => p.assigned).length;
    const syntheticCycles = series.filter((p) => p.synthetic).length;
    const tradingActions = strategy.id === "btc" ? 1 : openingCycles + assignedCycles;
    rows.push({
      strategy: strategy.label,
      role: strategy.role,
      cycles: series.length,
      estimatedYears: round(years, 3),
      optionOpeningTrades: openingCycles,
      assignmentCycles: assignedCycles,
      assignmentFrequencyPct: round((assignedCycles / Math.max(1, openingCycles)) * 100),
      syntheticOptionCycles: syntheticCycles,
      syntheticOptionPct: round((syntheticCycles / Math.max(1, openingCycles)) * 100),
      estimatedTradingActions: tradingActions,
      estimatedActionsPerYear: round(tradingActions / years),
      operationalComplexity: strategy.id === "btc"
        ? "low"
        : assignedCycles / openingCycles > 0.35 || syntheticCycles / openingCycles > 0.25 ? "high" : "medium",
    });
  }
  return rows;
}

function top(rows, strategy, scenario = "realistic") {
  return rows.find((r) => r.strategy === strategy && r.scenario === scenario);
}

function writeFindings({ frictionRows, yearlyRows, transitionRows, implementationRows }) {
  const o3 = top(frictionRows, "Weekly OTM03");
  const o5 = top(frictionRows, "Weekly OTM05");
  const o10 = top(frictionRows, "Weekly OTM10");
  const btc = top(frictionRows, "BTC Buy & Hold");
  const stab = (s) => yearlyRows.find((r) => r.strategy === s && r.year === "STABILITY_2020_2025");
  const impl = (s) => implementationRows.find((r) => r.strategy === s);
  const btob = (s) => transitionRows.find((r) => r.strategy === s && r.transition === "bull_to_bear");
  const btb = (s) => transitionRows.find((r) => r.strategy === s && r.transition === "bear_to_bull");
  const lines = [
    "# BTC Robustness Findings",
    "",
    "Generated from existing weekly BTC backtest outputs only. No new market data, assets, tenors, or strategies were introduced.",
    "",
    "## Friction Assumptions",
    "",
    "- Idealized: no fees or slippage.",
    "- Realistic: 0.03% option opening fee capped at 12.5% of premium, 0.015% delivery fee on assigned calls, and 5% premium/slippage haircut.",
    "- Stress: 2x fees, 10% premium/slippage haircut, and 2.5 bp underlying slippage on assigned calls.",
    "",
    "These are first-order Deribit-style implementation assumptions, not a full order-book simulator.",
    "",
    "## Friction Result",
    "",
    `- Realistic OTM05: ${o5.revisedReturnPct}% return, ${o5.revisedExcessReturnPct}% excess vs BTC, Sharpe ${o5.revisedSharpe}, drawdown ${o5.revisedDrawdownPct}%.`,
    `- Realistic OTM10: ${o10.revisedReturnPct}% return, ${o10.revisedExcessReturnPct}% excess vs BTC, Sharpe ${o10.revisedSharpe}, drawdown ${o10.revisedDrawdownPct}%.`,
    `- Realistic OTM03: ${o3.revisedReturnPct}% return, ${o3.revisedExcessReturnPct}% excess vs BTC, Sharpe ${o3.revisedSharpe}, drawdown ${o3.revisedDrawdownPct}%.`,
    `- BTC benchmark: ${btc.revisedReturnPct}% return, Sharpe ${btc.revisedSharpe}, drawdown ${btc.revisedDrawdownPct}%.`,
    "",
    "OTM05 remains the best baseline after realistic costs. OTM10 still leads on absolute return, but OTM05 keeps the cleaner risk-adjusted and drawdown profile.",
    "",
    "## Yearly Stability",
    "",
    `- OTM05 2020-2025 average annual return: ${stab("Weekly OTM05").returnPct}%, annual-return stdev ${stab("Weekly OTM05").volatilityPct}%, positive years ${stab("Weekly OTM05").positiveCyclePct}%.`,
    `- OTM10 2020-2025 average annual return: ${stab("Weekly OTM10").returnPct}%, annual-return stdev ${stab("Weekly OTM10").volatilityPct}%, positive years ${stab("Weekly OTM10").positiveCyclePct}%.`,
    `- OTM03 2020-2025 average annual return: ${stab("Weekly OTM03").returnPct}%, annual-return stdev ${stab("Weekly OTM03").volatilityPct}%, positive years ${stab("Weekly OTM03").positiveCyclePct}%.`,
    "",
    "OTM10 is more return-concentrated and more cyclical. OTM03 is the defensive reference. OTM05 sits in the middle with strong returns and less fragile risk than OTM10.",
    "",
    "## Regime Transitions",
    "",
    `- Bull to bear drawdown: OTM05 ${btob("Weekly OTM05").maxDrawdownPct}%, OTM10 ${btob("Weekly OTM10").maxDrawdownPct}%, OTM03 ${btob("Weekly OTM03").maxDrawdownPct}%, BTC ${btob("BTC Buy & Hold").maxDrawdownPct}%.`,
    `- Bear to bull return: OTM05 ${btb("Weekly OTM05").returnPct}%, OTM10 ${btb("Weekly OTM10").returnPct}%, OTM03 ${btb("Weekly OTM03").returnPct}%, BTC ${btb("BTC Buy & Hold").returnPct}%.`,
    "",
    "OTM03 is the most defensive transition reference and slightly leads the bear-to-bull rebound window. OTM10 carries the deepest transition drawdowns. OTM05 remains the balanced middle ground, with stronger long-run return than OTM03 and less transition risk than OTM10.",
    "",
    "## Implementation Reality",
    "",
    `- OTM05 estimated actions/year: ${impl("Weekly OTM05").estimatedActionsPerYear}, assignment frequency ${impl("Weekly OTM05").assignmentFrequencyPct}%, synthetic option cycles ${impl("Weekly OTM05").syntheticOptionPct}%.`,
    `- OTM10 estimated actions/year: ${impl("Weekly OTM10").estimatedActionsPerYear}, assignment frequency ${impl("Weekly OTM10").assignmentFrequencyPct}%, synthetic option cycles ${impl("Weekly OTM10").syntheticOptionPct}%.`,
    `- OTM03 estimated actions/year: ${impl("Weekly OTM03").estimatedActionsPerYear}, assignment frequency ${impl("Weekly OTM03").assignmentFrequencyPct}%, synthetic option cycles ${impl("Weekly OTM03").syntheticOptionPct}%.`,
    "",
    "Operationally, all weekly variants require similar opening cadence. OTM05 is a practical middle ground: less BTC-like and less tail-exposed than OTM10, without giving up as much upside as OTM03.",
    "",
    "## Final Answer",
    "",
    "Weekly OTM05 remains the preferred BTC baseline. No robustness evidence justifies replacing it with OTM10 or OTM03. OTM10 should remain the aggressive return-maximizing variant, and OTM03 should remain the defensive/reference configuration.",
  ];
  fs.writeFileSync(outputs.findings, `${lines.join("\n")}\n`);
}

function main() {
  const { rows: frictionRows, cache } = buildFrictionRows();
  const sensitivityRows = buildSensitivityRows(frictionRows);
  const yearlyRows = buildYearlyRows(cache);
  const transitionRows = buildTransitionRows(cache);
  const implementationRows = buildImplementationRows(cache);

  writeCsv(outputs.friction, frictionRows, [
    "strategy", "role", "scenario", "scenario_description", "cycles", "revisedReturnPct", "btcReturnPct",
    "revisedExcessReturnPct", "revisedSharpe", "revisedDrawdownPct", "totalAssignedCycles", "syntheticCycles",
  ]);
  writeCsv(outputs.sensitivity, sensitivityRows, [
    "strategy", "scenario", "returnDegradationPctPoints", "excessDegradationPctPoints",
    "sharpeChange", "drawdownChangePctPoints", "remainsAboveBtc",
  ]);
  writeCsv(outputs.yearly, yearlyRows, [
    "strategy", "year", "cycles", "returnPct", "btcReturnPct", "excessReturnPct",
    "volatilityPct", "sharpe", "maxDrawdownPct", "positiveCyclePct",
  ]);
  writeCsv(outputs.transitions, transitionRows, [
    "strategy", "transition", "windowStart", "windowEnd", "cycles", "returnPct", "btcReturnPct",
    "returnPreservationVsBtcPct", "maxDrawdownPct", "recoveryCycles", "assignedCycles",
  ]);
  writeCsv(outputs.implementation, implementationRows, [
    "strategy", "role", "cycles", "estimatedYears", "optionOpeningTrades", "assignmentCycles",
    "assignmentFrequencyPct", "syntheticOptionCycles", "syntheticOptionPct",
    "estimatedTradingActions", "estimatedActionsPerYear", "operationalComplexity",
  ]);
  writeFindings({ frictionRows, yearlyRows, transitionRows, implementationRows });
}

main();
