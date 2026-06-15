const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const GENERATED = path.join(ROOT, "analysis", "generated");
const BATCHES = path.join(ROOT, "runs", "batches");

const out = {
  summaryCsv: path.join(GENERATED, "btc_multi_tenor_summary.csv"),
  summaryJson: path.join(GENERATED, "btc_multi_tenor_summary.json"),
  rankingsCsv: path.join(GENERATED, "btc_multi_tenor_rankings.csv"),
  regimeCsv: path.join(GENERATED, "btc_multi_tenor_regime_analysis.csv"),
  findingsMd: path.join(GENERATED, "btc_multi_tenor_findings.md"),
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
    const o = {};
    header.forEach((h, i) => (o[h] = r[i] ?? ""));
    return o;
  });
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeCsv(file, rows, columns) {
  const lines = [columns.join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => csvEscape(row[c])).join(","));
  }
  fs.writeFileSync(file, `${lines.join("\n")}\n`);
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

function labelFromXOtm(x) {
  if (x === null) return "";
  if (x < 0) return `itm${String(Math.round(Math.abs(x) * 100)).padStart(2, "0")}`;
  if (x === 0) return "atm00";
  return `otm${String(Math.round(x * 100)).padStart(2, "0")}`;
}

function displayTenor(tenor) {
  return tenor === "14d" ? "14d" : tenor[0].toUpperCase() + tenor.slice(1);
}

function displayMoneyness(label) {
  return label.replace(/^([a-z]+)(\d+)$/i, (_, p, n) => `${p.toUpperCase()}${n}`);
}

function key(row) {
  return `${row.tenor}|${row.moneyness_label}`;
}

function mean(values) {
  const xs = values.filter((v) => Number.isFinite(v));
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

function stdev(values) {
  const xs = values.filter((v) => Number.isFinite(v));
  if (xs.length < 2) return null;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / (xs.length - 1));
}

function compound(returnsPct) {
  return (returnsPct.reduce((acc, r) => acc * (1 + r / 100), 1) - 1) * 100;
}

function rankRows(rows, metric, direction = "desc") {
  return [...rows]
    .filter((r) => Number.isFinite(r[metric]))
    .sort((a, b) => direction === "asc" ? a[metric] - b[metric] : b[metric] - a[metric])
    .map((r, i) => ({ ...r, rank: i + 1, ranking_metric: metric, ranking_value: r[metric] }));
}

function annualizeSharpe(meanCycleReturnPct, stdCycleReturnPct, cyclesPerYear) {
  if (!stdCycleReturnPct || stdCycleReturnPct <= 0 || !cyclesPerYear) return null;
  return (meanCycleReturnPct / stdCycleReturnPct) * Math.sqrt(cyclesPerYear);
}

function loadInputs() {
  const analysis = parseCsv(fs.readFileSync(path.join(GENERATED, "btc_multi_tenor_analysis.csv"), "utf8"))
    .filter((r) => r.comparison_scope === "full_period" && r.startYear === "2020" && r.endYear === "2026");
  const rolling = parseCsv(fs.readFileSync(path.join(GENERATED, "btc_rolling_findings_summary.csv"), "utf8"))
    .filter((r) => r.row_type === "configuration");
  const distribution = parseCsv(fs.readFileSync(path.join(GENERATED, "btc_distribution_findings.csv"), "utf8"))
    .filter((r) => r.row_type === "strategy" && r.comparison_scope === "full_period");
  const regimes = parseCsv(fs.readFileSync(path.join(GENERATED, "btc_regime_analysis.csv"), "utf8"))
    .filter((r) => r.comparison_scope === "full_period" && r.cycleCount !== "0");
  return { analysis, rolling, distribution, regimes };
}

function buildYearStats(row) {
  const file = path.join(BATCHES, row.source_batch_name, "summary.json");
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const years = data.rows.filter((r) => Number.isInteger(r.year));
  const fullYears = years.filter((r) => r.year >= 2020 && r.year <= 2025);
  const allReturns = years.map((r) => Number(r.runReturnPct)).filter(Number.isFinite);
  const fullReturns = fullYears.map((r) => Number(r.runReturnPct)).filter(Number.isFinite);
  const fullExcess = fullYears.map((r) => Number(r.runReturnPct) - Number(r.btcReturnPct)).filter(Number.isFinite);
  const y2026 = years.find((r) => r.year === 2026);
  return {
    full_year_count: fullYears.length,
    positive_return_years_2020_2025: fullReturns.filter((v) => v > 0).length,
    positive_excess_years_2020_2025: fullExcess.filter((v) => v > 0).length,
    average_annual_return_pct_2020_2025: round(mean(fullReturns)),
    worst_annual_return_pct_2020_2025: round(Math.min(...fullReturns)),
    annual_return_stdev_pct_2020_2025: round(stdev(fullReturns)),
    annual_return_sharpe_proxy_2020_2025: round(mean(fullReturns) / stdev(fullReturns)),
    partial_2026_return_pct: y2026 ? round(Number(y2026.runReturnPct)) : "",
    partial_2026_btc_return_pct: y2026 ? round(Number(y2026.btcReturnPct)) : "",
    annual_returns_all_available: allReturns,
  };
}

function buildSummary(inputs) {
  const rollingByKey = new Map(inputs.rolling.map((r) => [key(r), r]));
  const distByKey = new Map(inputs.distribution.map((r) => [key(r), r]));
  return inputs.analysis.map((r) => {
    const roll = rollingByKey.get(key(r)) || {};
    const dist = distByKey.get(key(r)) || {};
    const cyclesPerYear = num(r.cycles_per_year);
    const meanCycle = num(dist.meanCycleReturnPct);
    const vol = num(dist.stdDevCycleReturnPct);
    const sharpe = annualizeSharpe(meanCycle, vol, cyclesPerYear);
    const yearly = buildYearStats(r);
    return {
      Asset: r.asset,
      Tenor: displayTenor(r.tenor),
      Moneyness: displayMoneyness(r.moneyness_label),
      Return: round(num(r.totalReturnPct)),
      "BTC Return": round(num(r.btcReturnPct)),
      "Excess Return": round(num(r.excessReturnVsBtcPct)),
      Drawdown: round(num(roll.worstRollingDrawdownPct)),
      Volatility: round(vol),
      Sharpe: round(sharpe),
      Cycles: round(num(r.totalCycles), 0),
      CAGR: round(num(r.cagrPct)),
      "Cycle Mean Return": round(meanCycle),
      "Positive Return Years 2020-2025": yearly.positive_return_years_2020_2025,
      "Positive Excess Years 2020-2025": yearly.positive_excess_years_2020_2025,
      "Worst Annual Return 2020-2025": yearly.worst_annual_return_pct_2020_2025,
      "Partial 2026 Return": yearly.partial_2026_return_pct,
      "Partial 2026 BTC Return": yearly.partial_2026_btc_return_pct,
      source_batch_name: r.source_batch_name,
      tenor: r.tenor,
      moneyness_label: r.moneyness_label,
      xOtm: num(r.xOtm),
      return_vs_btc_ratio: round(num(r.return_vs_btc_ratio)),
      observedOptionCoveragePct: round(num(r.observedOptionCoveragePct)),
      theoreticalFallbackCoveragePct: round(num(r.theoreticalFallbackCoveragePct)),
      settlementFallbackCoveragePct: round(num(r.settlementFallbackCoveragePct)),
      severeLossFrequencyPct: round(num(dist.severeLossFrequencyPct)),
      p05CycleReturnPct: round(num(dist.p05CycleReturnPct)),
      p95CycleReturnPct: round(num(dist.p95CycleReturnPct)),
      annual_return_sharpe_proxy_2020_2025: yearly.annual_return_sharpe_proxy_2020_2025,
    };
  }).sort((a, b) => a.tenor.localeCompare(b.tenor) || a.xOtm - b.xOtm);
}

function buildRankings(summary) {
  const rankSpecs = [
    ["absolute_return", "Return", "desc"],
    ["excess_return_vs_btc", "Excess Return", "desc"],
    ["drawdown", "Drawdown", "desc"],
    ["risk_adjusted_per_cycle", "Sharpe", "desc"],
    ["consistency_across_years", "Positive Excess Years 2020-2025", "desc"],
  ];
  const rows = [];
  for (const [ranking_type, metric, direction] of rankSpecs) {
    const ranked = rankRows(summary, metric, direction);
    for (const r of ranked) {
      rows.push({
        ranking_type,
        rank: r.rank,
        Tenor: r.Tenor,
        Moneyness: r.Moneyness,
        metric,
        value: round(r.ranking_value),
        Return: r.Return,
        "BTC Return": r["BTC Return"],
        "Excess Return": r["Excess Return"],
        Drawdown: r.Drawdown,
        Volatility: r.Volatility,
        Sharpe: r.Sharpe,
        Cycles: r.Cycles,
        "Positive Excess Years 2020-2025": r["Positive Excess Years 2020-2025"],
        source_batch_name: r.source_batch_name,
      });
    }
  }
  return rows;
}

function classifyAnnualRegime(btcReturnPct) {
  if (btcReturnPct >= 20) return "bull";
  if (btcReturnPct <= -20) return "bear";
  return "sideways";
}

function buildRegimeAnalysis(summary, inputs) {
  const existing = inputs.regimes.map((r) => {
    const x = num(r.xOtm);
    return {
      source: "existing_regime_file",
      regime: r.regime,
      regime_label: r.regime_label,
      Tenor: displayTenor(r.tenor),
      Moneyness: displayMoneyness(r.moneyness_label),
      cycleCount: round(num(r.cycleCount), 0),
      returnPct: round(num(r.returnPct)),
      volatilityPct: round(num(r.volatilityPct)),
      drawdownPct: round(num(r.drawdownPct)),
      hitRatePct: round(num(r.hitRatePct)),
      averageCycleReturnPct: round(num(r.averageCycleReturnPct)),
      btcReturnPct: "",
      excessReturnVsBtcPct: "",
      includedYears: "",
      xOtm: x,
    };
  });

  const annualRows = [];
  for (const s of summary) {
    const data = JSON.parse(fs.readFileSync(path.join(BATCHES, s.source_batch_name, "summary.json"), "utf8"));
    const years = data.rows.filter((r) => Number.isInteger(r.year) && r.year >= 2020 && r.year <= 2025);
    const groups = new Map();
    for (const y of years) {
      const regime = classifyAnnualRegime(Number(y.btcReturnPct));
      if (!groups.has(regime)) groups.set(regime, []);
      groups.get(regime).push(y);
    }
    for (const [regime, ys] of groups) {
      const returns = ys.map((y) => Number(y.runReturnPct));
      const btcReturns = ys.map((y) => Number(y.btcReturnPct));
      const compounded = compound(returns);
      const btcCompounded = compound(btcReturns);
      annualRows.push({
        source: "annual_btc_return_classifier",
        regime,
        regime_label: `${regime}_${ys.map((y) => y.year).join("_")}`,
        Tenor: s.Tenor,
        Moneyness: s.Moneyness,
        cycleCount: ys.reduce((acc, y) => acc + Number(y.totalWeeks || y.totalCycles || 0), 0),
        returnPct: round(compounded),
        volatilityPct: round(stdev(returns)),
        drawdownPct: "",
        hitRatePct: round((returns.filter((v) => v > 0).length / returns.length) * 100),
        averageCycleReturnPct: "",
        btcReturnPct: round(btcCompounded),
        excessReturnVsBtcPct: round(compounded - btcCompounded),
        includedYears: ys.map((y) => y.year).join(";"),
        xOtm: s.xOtm,
      });
    }
  }
  return [...existing, ...annualRows].sort((a, b) =>
    a.source.localeCompare(b.source) ||
    a.regime.localeCompare(b.regime) ||
    a.Tenor.localeCompare(b.Tenor) ||
    a.xOtm - b.xOtm
  );
}

function dominationNotes(summary) {
  const rows = summary.map((r) => ({
    label: `${r.Tenor} ${r.Moneyness}`,
    ret: r.Return,
    excess: r["Excess Return"],
    dd: r.Drawdown,
    sharpe: r.Sharpe,
  }));
  const dominated = [];
  for (const a of rows) {
    const dom = rows.find((b) =>
      b.label !== a.label &&
      b.ret >= a.ret &&
      b.excess >= a.excess &&
      b.dd >= a.dd &&
      b.sharpe >= a.sharpe &&
      (b.ret > a.ret || b.excess > a.excess || b.dd > a.dd || b.sharpe > a.sharpe)
    );
    if (dom) dominated.push(`${a.label} is dominated by ${dom.label}`);
  }
  return dominated;
}

function writeFindings(summary, rankings, regimeRows) {
  const bestReturn = rankings.find((r) => r.ranking_type === "absolute_return" && r.rank === 1);
  const bestExcess = rankings.find((r) => r.ranking_type === "excess_return_vs_btc" && r.rank === 1);
  const bestSharpe = rankings.find((r) => r.ranking_type === "risk_adjusted_per_cycle" && r.rank === 1);
  const bestDrawdown = rankings.find((r) => r.ranking_type === "drawdown" && r.rank === 1);
  const positiveExcess = summary.filter((r) => r["Excess Return"] > 0);
  const dominated = dominationNotes(summary);
  const annualRegime = regimeRows.filter((r) => r.source === "annual_btc_return_classifier");
  const sideways = annualRegime.filter((r) => r.regime === "sideways").sort((a, b) => b.excessReturnVsBtcPct - a.excessReturnVsBtcPct).slice(0, 3);
  const bull = annualRegime.filter((r) => r.regime === "bull").sort((a, b) => b.returnPct - a.returnPct).slice(0, 3);
  const bear = annualRegime.filter((r) => r.regime === "bear").sort((a, b) => b.returnPct - a.returnPct).slice(0, 3);

  const lines = [
    "# BTC Multi-Tenor Findings",
    "",
    "Generated from existing repository artifacts only. No new Deribit collection, assets, strategies, hedge optimization, or parameter optimization were used.",
    "",
    "## Method",
    "",
    "- Full-period returns, BTC returns, excess returns, CAGR, cycles and coverage come from `analysis/generated/btc_multi_tenor_analysis.csv`.",
    "- Drawdown uses `worstRollingDrawdownPct` from `analysis/generated/btc_rolling_findings_summary.csv` because the consolidated summary layer does not store a full-period equity max drawdown.",
    "- Volatility uses full-sample cycle-return standard deviation from `analysis/generated/btc_distribution_findings.csv`.",
    "- Sharpe is a simple zero-risk-free cycle Sharpe: `meanCycleReturnPct / stdDevCycleReturnPct * sqrt(cycles_per_year)`.",
    "- Consistency uses full calendar years 2020-2025 from each batch `summary.json`; partial 2026 is retained in the summary but excluded from consistency counts.",
    "- Sideways regime is an annual classifier because the existing regime file has bull, bear, ETF/bull and recovery labels but no explicit sideways label. Annual BTC returns between -20% and +20% are classified as sideways.",
    "",
    "## Headline Results",
    "",
    `- Best absolute return: ${bestReturn.Tenor} ${bestReturn.Moneyness} at ${bestReturn.Return}% total return.`,
    `- Best excess return vs BTC: ${bestExcess.Tenor} ${bestExcess.Moneyness} at ${bestExcess["Excess Return"]}% excess return.`,
    `- Best cycle Sharpe proxy: ${bestSharpe.Tenor} ${bestSharpe.Moneyness} at ${bestSharpe.Sharpe}.`,
    `- Shallowest rolling drawdown: ${bestDrawdown.Tenor} ${bestDrawdown.Moneyness} at ${bestDrawdown.Drawdown}%.`,
    `- Configurations beating BTC over the comparable full period: ${positiveExcess.map((r) => `${r.Tenor} ${r.Moneyness}`).join(", ") || "none"}.`,
    "",
    "## Survivors",
    "",
    "- Weekly OTM10 remains the strongest full-period candidate: highest return, highest excess return, and among the strongest risk-adjusted scores, but with the deepest rolling drawdown among the leading weekly OTM set.",
    "- Weekly OTM05 also survives scrutiny: second-best full-period return/excess and slightly less severe drawdown than Weekly OTM10.",
    "- Weekly OTM03 is a viable lower-moneyness survivor: positive full-period excess return with better drawdown than OTM05/OTM10, but lower total return.",
    "- 14d OTM10 is the only non-weekly configuration that narrowly beats BTC on full-period excess return; it is worth keeping as a secondary candidate, not a replacement for weekly OTM.",
    "",
    "## Dominated Or Weak Combinations",
    "",
    ...dominated.slice(0, 10).map((x) => `- ${x}.`),
    "",
    "## Tenor Read",
    "",
    "- Longer tenors did not improve the main risk-adjusted picture in these artifacts. Monthly has cleaner observed option coverage, but lower full-period return, worse excess return, and lower Sharpe proxy than the best weekly variants.",
    "- 14d improves over monthly in return and excess terms, but only 14d OTM10 crosses BTC full-period excess into positive territory.",
    "- Weekly carries more fallback usage and higher rebalance frequency, yet still dominates the top return and excess-return rankings.",
    "",
    "## Regime Read",
    "",
    `- Bull years: ${bull.map((r) => `${r.Tenor} ${r.Moneyness} ${r.returnPct}%`).join("; ")}.`,
    `- Bear years: ${bear.map((r) => `${r.Tenor} ${r.Moneyness} ${r.returnPct}%`).join("; ")}.`,
    `- Sideways years: ${sideways.map((r) => `${r.Tenor} ${r.Moneyness} excess ${r.excessReturnVsBtcPct}%`).join("; ")}.`,
    "- Bear behavior favors lower moneyness: Weekly ITM05 and Weekly ATM00 hold up better in 2022, while high OTM variants give back more convex upside in drawdowns.",
    "- Bull and recovery behavior favors higher OTM: Weekly OTM10 and Weekly OTM05 capture enough upside to lead the long-run sample.",
    "",
    "## Practical Conclusion",
    "",
    "The BTC expansion shortlist should stay narrow: Weekly OTM10, Weekly OTM05, Weekly OTM03, plus 14d OTM10 as the only longer-tenor candidate that survives full-period BTC comparison. Monthly variants are useful for liquidity/coverage reference, but they are not competitive enough to lead the next research phase.",
  ];
  fs.writeFileSync(out.findingsMd, `${lines.join("\n")}\n`);
}

function main() {
  const inputs = loadInputs();
  const summary = buildSummary(inputs);
  const rankings = buildRankings(summary);
  const regime = buildRegimeAnalysis(summary, inputs);

  writeCsv(out.summaryCsv, summary, [
    "Tenor", "Moneyness", "Return", "BTC Return", "Excess Return", "Drawdown", "Volatility", "Sharpe", "Cycles",
    "CAGR", "Cycle Mean Return", "Positive Return Years 2020-2025", "Positive Excess Years 2020-2025",
    "Worst Annual Return 2020-2025", "Partial 2026 Return", "Partial 2026 BTC Return",
    "source_batch_name", "observedOptionCoveragePct", "theoreticalFallbackCoveragePct", "settlementFallbackCoveragePct",
    "severeLossFrequencyPct", "p05CycleReturnPct", "p95CycleReturnPct",
  ]);
  fs.writeFileSync(out.summaryJson, JSON.stringify({
    generatedAt: new Date().toISOString(),
    methodology: {
      drawdown: "worstRollingDrawdownPct from btc_rolling_findings_summary.csv",
      volatility: "stdDevCycleReturnPct from btc_distribution_findings.csv",
      sharpe: "meanCycleReturnPct / stdDevCycleReturnPct * sqrt(cycles_per_year), risk-free rate assumed zero",
      consistency: "full calendar years 2020-2025 from batch summary.json; 2026 partial retained separately",
      sideways: "annual BTC return classifier: bear <= -20%, bull >= 20%, sideways otherwise",
    },
    rows: summary,
  }, null, 2));
  writeCsv(out.rankingsCsv, rankings, [
    "ranking_type", "rank", "Tenor", "Moneyness", "metric", "value", "Return", "BTC Return", "Excess Return",
    "Drawdown", "Volatility", "Sharpe", "Cycles", "Positive Excess Years 2020-2025", "source_batch_name",
  ]);
  writeCsv(out.regimeCsv, regime, [
    "source", "regime", "regime_label", "Tenor", "Moneyness", "cycleCount", "returnPct", "btcReturnPct",
    "excessReturnVsBtcPct", "volatilityPct", "drawdownPct", "hitRatePct", "averageCycleReturnPct", "includedYears",
  ]);
  writeFindings(summary, rankings, regime);
}

main();
