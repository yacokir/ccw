const fs = require('fs');
const path = require('path');

const {
  REPO_ROOT,
  readCsv,
  readJson,
  objectsToCsv,
  optionalNumber,
  roundNumber,
  yearsBetween,
  buildNormalizedEquity,
  drawdownStats,
  compoundReturnPct
} = require('./btc_deep_risk_utils');

const ANALYSIS_ID = 'btc_weekly_portfolios_v01';
const CONFIG_PATH = path.join(REPO_ROOT, 'analysis', 'config', `${ANALYSIS_ID}.json`);
const REFERENCE_RISK_PATH = path.join(REPO_ROOT, 'analysis', 'generated', 'btc_equity_risk_analysis.json');
const OUTPUT_DIR = path.join(REPO_ROOT, 'analysis', 'generated', ANALYSIS_ID);

const STRATEGIES = {
  atm00: 'batch_years_atm00_2020_2026',
  otm03: 'batch_years_otm03_2020_2026',
  otm05: 'batch_years_otm05_2020_2026',
  otm07: 'batch_years_otm07_2020_2026',
  otm10: 'batch_years_otm10_2020_2026'
};

const EXPECTED_CYCLE_COUNT = 325;
const WEIGHT_TOLERANCE = 1e-10;
const VALUE_TOLERANCE = 1e-10;
const REPRODUCTION_TOLERANCE_PCT_POINTS = 1e-6;

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function batchSummaryPath(batchName) {
  return path.join(REPO_ROOT, 'runs', 'batches', batchName, 'summary.json');
}

function totalRow(summary) {
  return (summary.rows || []).find(row => row.year === 'TOTAL');
}

function loadStrategy(strategyId, batchName) {
  const summaryPath = batchSummaryPath(batchName);
  const summary = readJson(summaryPath);
  const cycles = [];

  const annualResults = (summary.annualResults || [])
    .filter(result => Number.isInteger(Number(result.year)))
    .sort((a, b) => Number(a.year) - Number(b.year));

  for (const annualResult of annualResults) {
    const runName = annualResult.savedRun && annualResult.savedRun.runName;
    assert(runName, `${strategyId}: runName ausente para ${annualResult.year}`);

    const tradesPath = path.join(REPO_ROOT, 'runs', runName, 'trades.csv');
    assert(fs.existsSync(tradesPath), `${strategyId}: trades.csv ausente para ${annualResult.year}`);

    const trades = readCsv(tradesPath);
    for (const trade of trades) {
      const explicitReturn = optionalNumber(trade.return_pct);
      const capitalBefore = optionalNumber(trade.capital_before);
      const capitalAfter = optionalNumber(trade.capital_after);
      const returnDecimal = explicitReturn !== null
        ? explicitReturn
        : capitalBefore !== null && capitalAfter !== null && capitalBefore !== 0
          ? capitalAfter / capitalBefore - 1
          : null;

      cycles.push({
        entry_date: trade.entry_date,
        exit_date: trade.exit_date,
        returnDecimal,
        returnPct: returnDecimal === null ? null : returnDecimal * 100,
        S_entry: optionalNumber(trade.S_entry),
        S_exit: optionalNumber(trade.S_exit)
      });
    }
  }

  cycles.sort((a, b) => new Date(a.entry_date) - new Date(b.entry_date));
  cycles.forEach((cycle, index) => {
    cycle.sequence = index + 1;
  });

  return {
    strategyId,
    summary,
    summaryPath,
    total: totalRow(summary),
    cycles
  };
}

function validateConfig(config) {
  assert(config.analysisId === ANALYSIS_ID, `analysisId deve ser ${ANALYSIS_ID}`);
  assert(Array.isArray(config.portfolios) && config.portfolios.length > 0, 'Nenhum portfólio configurado');

  const ids = new Set();
  for (const portfolio of config.portfolios) {
    assert(portfolio.id && !ids.has(portfolio.id), `portfolio id inválido ou duplicado: ${portfolio.id}`);
    ids.add(portfolio.id);
    assert(portfolio.name, `${portfolio.id}: nome ausente`);
    assert(portfolio.weights && typeof portfolio.weights === 'object', `${portfolio.id}: pesos ausentes`);

    const entries = Object.entries(portfolio.weights);
    assert(entries.length > 0, `${portfolio.id}: nenhum peso informado`);
    let sum = 0;
    for (const [strategyId, weight] of entries) {
      assert(Object.hasOwn(STRATEGIES, strategyId), `${portfolio.id}: strike desconhecido ${strategyId}`);
      assert(Number.isFinite(weight) && weight >= 0, `${portfolio.id}: peso inválido para ${strategyId}`);
      sum += weight;
    }
    assert(Math.abs(sum - 1) <= WEIGHT_TOLERANCE, `${portfolio.id}: pesos somam ${sum}, esperado 1`);
  }
}

function validateStrategies(strategies) {
  const canonical = strategies.atm00.cycles;
  assert(canonical.length === EXPECTED_CYCLE_COUNT, `ATM possui ${canonical.length} ciclos, esperado ${EXPECTED_CYCLE_COUNT}`);

  for (const [strategyId, strategy] of Object.entries(strategies)) {
    assert(strategy.cycles.length === EXPECTED_CYCLE_COUNT, `${strategyId} possui ${strategy.cycles.length} ciclos, esperado ${EXPECTED_CYCLE_COUNT}`);
    assert(strategy.total, `${strategyId}: linha TOTAL ausente`);

    strategy.cycles.forEach((cycle, index) => {
      const base = canonical[index];
      assert(cycle.entry_date === base.entry_date, `${strategyId}: entry_date divergente no ciclo ${index + 1}`);
      assert(cycle.exit_date === base.exit_date, `${strategyId}: exit_date divergente no ciclo ${index + 1}`);
      assert(Number.isFinite(cycle.returnDecimal), `${strategyId}: retorno inválido no ciclo ${index + 1}`);
      assert(Number.isFinite(cycle.S_entry) && cycle.S_entry > 0, `${strategyId}: S_entry inválido no ciclo ${index + 1}`);
      assert(Number.isFinite(cycle.S_exit) && cycle.S_exit > 0, `${strategyId}: S_exit inválido no ciclo ${index + 1}`);
      assert(Math.abs(cycle.S_entry - base.S_entry) <= VALUE_TOLERANCE, `${strategyId}: S_entry divergente no ciclo ${index + 1}`);
      assert(Math.abs(cycle.S_exit - base.S_exit) <= VALUE_TOLERANCE, `${strategyId}: S_exit divergente no ciclo ${index + 1}`);

      if (index > 0) {
        assert(new Date(cycle.entry_date) > new Date(strategy.cycles[index - 1].entry_date), `${strategyId}: ciclos fora de ordem`);
        assert(new Date(cycle.entry_date) >= new Date(strategy.cycles[index - 1].exit_date), `${strategyId}: ciclos sobrepostos`);
      }
    });
  }
}

function buildPortfolioCycles(portfolio, strategies) {
  const canonical = strategies.atm00.cycles;
  return canonical.map((base, index) => {
    const returnDecimal = Object.entries(portfolio.weights).reduce(
      (sum, [strategyId, weight]) => sum + weight * strategies[strategyId].cycles[index].returnDecimal,
      0
    );
    return {
      sequence: index + 1,
      entry_date: base.entry_date,
      exit_date: base.exit_date,
      returnDecimal,
      returnPct: returnDecimal * 100
    };
  });
}

function buildBuyHoldCycles(strategies) {
  return strategies.atm00.cycles.map((cycle, index) => {
    const returnDecimal = cycle.S_exit / cycle.S_entry - 1;
    return {
      sequence: index + 1,
      entry_date: cycle.entry_date,
      exit_date: cycle.exit_date,
      returnDecimal,
      returnPct: returnDecimal * 100
    };
  });
}

function metricsForCycles(cycles) {
  const equityPoints = buildNormalizedEquity(cycles);
  const drawdown = drawdownStats(equityPoints);
  const startDate = cycles[0].entry_date;
  const endDate = cycles[cycles.length - 1].exit_date;
  const elapsedYears = yearsBetween(startDate, endDate);
  const finalEquity = equityPoints[equityPoints.length - 1].equity;
  const cagrPct = elapsedYears && finalEquity > 0
    ? (finalEquity ** (1 / elapsedYears) - 1) * 100
    : null;
  const maxDrawdownPct = drawdown.maxDrawdownPct;
  const cagrOverDrawdown = Number.isFinite(cagrPct) && Number.isFinite(maxDrawdownPct) && maxDrawdownPct !== 0
    ? cagrPct / Math.abs(maxDrawdownPct)
    : null;

  return {
    equityPoints,
    startDate,
    endDate,
    elapsedYears,
    finalEquity,
    totalReturnPct: (finalEquity - 1) * 100,
    cagrPct,
    maxDrawdownPct,
    cagrOverDrawdown
  };
}

function weightColumns(weights) {
  return Object.fromEntries(Object.keys(STRATEGIES).map(strategyId => [
    `weight_${strategyId}_pct`,
    (weights[strategyId] || 0) * 100
  ]));
}

function equityRows(portfolioId, cycles, metrics) {
  return cycles.map((cycle, index) => ({
    portfolio_id: portfolioId,
    cycle: cycle.sequence,
    entry_date: cycle.entry_date,
    exit_date: cycle.exit_date,
    cycle_return_pct: roundNumber(cycle.returnPct),
    equity: roundNumber(metrics.equityPoints[index + 1].equity, 10),
    drawdown_pct: roundNumber(metrics.equityPoints[index + 1].drawdownPct)
  }));
}

function validateBuyHold(buyHoldCycles, buyHoldMetrics, strategies) {
  const expectedPct = optionalNumber(strategies.atm00.total.btcReturnPct);
  const compoundedPct = compoundReturnPct(buyHoldCycles);
  assert(expectedPct !== null, 'btcReturnPct consolidado ausente no batch ATM');
  assert(Math.abs(compoundedPct - expectedPct) <= REPRODUCTION_TOLERANCE_PCT_POINTS,
    `Buy & Hold diverge do batch: reconstruído=${compoundedPct}, esperado=${expectedPct}`);
  assert(Math.abs(buyHoldMetrics.totalReturnPct - expectedPct) <= REPRODUCTION_TOLERANCE_PCT_POINTS,
    'Curva Buy & Hold diverge do retorno reconstruído');
  return { expectedPct, reconstructedPct: compoundedPct };
}

function validatePurePortfolio(portfolioId, strategyId, result, strategies, riskReference) {
  const expectedBatchReturnPct = optionalNumber(strategies[strategyId].total.runReturnPct);
  const reference = (riskReference.rows || []).find(row =>
    row.asset === 'BTC' && row.tenor === 'weekly' && row.moneyness_label === strategyId
  );
  assert(expectedBatchReturnPct !== null, `${strategyId}: retorno TOTAL ausente`);
  assert(reference, `${strategyId}: referência de equity risk ausente`);

  const returnDifference = result.metrics.totalReturnPct - expectedBatchReturnPct;
  const drawdownDifference = result.metrics.maxDrawdownPct - optionalNumber(reference.maxDrawdownPct);
  assert(Math.abs(returnDifference) <= REPRODUCTION_TOLERANCE_PCT_POINTS,
    `${portfolioId}: retorno diverge em ${returnDifference} pp`);
  assert(Math.abs(drawdownDifference) <= REPRODUCTION_TOLERANCE_PCT_POINTS,
    `${portfolioId}: drawdown diverge em ${drawdownDifference} pp`);

  return {
    portfolioId,
    strategyId,
    expectedReturnPct: expectedBatchReturnPct,
    reconstructedReturnPct: result.metrics.totalReturnPct,
    expectedMaxDrawdownPct: optionalNumber(reference.maxDrawdownPct),
    reconstructedMaxDrawdownPct: result.metrics.maxDrawdownPct,
    passed: true
  };
}

function formatPct(value) {
  return `${roundNumber(value, 4).toFixed(4)}%`;
}

function formatRatio(value) {
  return roundNumber(value, 4).toFixed(4);
}

function buildReport({ config, summaryRows, validations, buyHoldMetrics }) {
  const bestCagr = [...summaryRows].sort((a, b) => b.cagr_pct - a.cagr_pct)[0];
  const bestDrawdown = [...summaryRows].sort((a, b) => b.max_drawdown_pct - a.max_drawdown_pct)[0];
  const bestRatio = [...summaryRows].sort((a, b) => b.cagr_over_drawdown - a.cagr_over_drawdown)[0];
  const tableRows = summaryRows.map(row =>
    `| ${row.name} | ${formatPct(row.cagr_pct)} | ${formatPct(row.max_drawdown_pct)} | ${formatRatio(row.cagr_over_drawdown)} | ${formatPct(row.buy_hold_cagr_pct)} | ${formatPct(row.cagr_difference_vs_buy_hold_pct_points)} |`
  );
  const reproductionRows = validations.reproductions.map(item =>
    `- ${item.portfolioId}: retorno ${formatPct(item.reconstructedReturnPct)} e drawdown ${formatPct(item.reconstructedMaxDrawdownPct)} reproduzidos exatamente dentro da tolerância de ${REPRODUCTION_TOLERANCE_PCT_POINTS} ponto percentual.`
  );

  return [
    '# BTC Weekly Covered Call Portfolios v01',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Escopo',
    '',
    `- Período: ${summaryRows[0].start_date} a ${summaryRows[0].end_date}.`,
    `- Ciclos semanais: ${summaryRows[0].cycle_count}.`,
    '- Strikes históricos permitidos: ATM, OTM03, OTM05, OTM07 e OTM10.',
    '- Fonte exclusiva: backtests semanais BTC já existentes.',
    '- Pesos reaplicados no início de cada ciclo semanal.',
    '',
    '## Resultados',
    '',
    '| Portfólio | CAGR | Maximum Drawdown | CAGR / Drawdown | CAGR Buy & Hold | Diferença vs B&H |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    ...tableRows,
    '',
    '## Destaques observados',
    '',
    `- Maior CAGR: ${bestCagr.name}, com ${formatPct(bestCagr.cagr_pct)}.`,
    `- Menor Maximum Drawdown: ${bestDrawdown.name}, com ${formatPct(bestDrawdown.max_drawdown_pct)}.`,
    `- Maior CAGR / Drawdown: ${bestRatio.name}, com ${formatRatio(bestRatio.cagr_over_drawdown)}.`,
    `- Buy & Hold no mesmo conjunto de ciclos: CAGR de ${formatPct(buyHoldMetrics.cagrPct)} e Maximum Drawdown de ${formatPct(buyHoldMetrics.maxDrawdownPct)}.`,
    '',
    '## Metodologia',
    '',
    '- O retorno de cada portfólio em cada ciclo é a soma dos retornos dos strikes ponderados pelos pesos configurados.',
    '- A equity normalizada começa em 1 e compõe sequencialmente os 325 retornos semanais.',
    '- Maximum Drawdown usa os fechamentos de ciclo e não mede drawdown intracycle.',
    '- CAGR usa o tempo decorrido entre a primeira entrada e a última saída.',
    '- Buy & Hold usa `S_entry` e `S_exit` dos mesmos ciclos modelados pelos backtests.',
    '',
    '## Validações',
    '',
    `- ${config.portfolios.length} composições carregadas; todos os pesos somam 100%.`,
    `- Cinco strikes com ${EXPECTED_CYCLE_COUNT} ciclos cada; datas e preços do underlying coincidem.`,
    `- Buy & Hold reconstruído em ${formatPct(validations.buyHold.reconstructedPct)}, igual ao benchmark consolidado existente.`,
    ...reproductionRows,
    '',
    '## Ressalvas',
    '',
    '- Os resultados históricos usam instrumentos e dados da Deribit como proxy, embora a operação pretendida seja na Bybit.',
    '- Parte dos ciclos semanais utiliza fallback teórico para o prêmio da opção.',
    '- O período inclui 2026 parcialmente e favorece, em vários trechos, preservação do upside de BTC.',
    '- O benchmark Buy & Hold herda as mesmas janelas efetivamente cobertas pelos runs anuais, inclusive os pequenos intervalos entre anos.',
    '',
    '## Observação para pesquisa futura',
    '',
    `A composição ${bestRatio.name} apresentou a maior relação CAGR / Drawdown entre as alternativas testadas. Este resultado pode orientar uma investigação específica posterior, mas nenhuma extensão foi incorporada à v01.`,
    ''
  ].join('\n');
}

function main() {
  const config = readJson(CONFIG_PATH);
  validateConfig(config);

  const strategies = Object.fromEntries(Object.entries(STRATEGIES).map(([strategyId, batchName]) => [
    strategyId,
    loadStrategy(strategyId, batchName)
  ]));
  validateStrategies(strategies);

  const buyHoldCycles = buildBuyHoldCycles(strategies);
  const buyHoldMetrics = metricsForCycles(buyHoldCycles);
  const buyHoldValidation = validateBuyHold(buyHoldCycles, buyHoldMetrics, strategies);

  const results = config.portfolios.map(portfolio => {
    const cycles = buildPortfolioCycles(portfolio, strategies);
    return { portfolio, cycles, metrics: metricsForCycles(cycles) };
  });

  const riskReference = readJson(REFERENCE_RISK_PATH);
  const reproductions = [
    validatePurePortfolio('atm100', 'atm00', results.find(result => result.portfolio.id === 'atm100'), strategies, riskReference),
    validatePurePortfolio('otm05_100', 'otm05', results.find(result => result.portfolio.id === 'otm05_100'), strategies, riskReference)
  ];

  const summaryRows = results.map(({ portfolio, metrics }) => ({
    portfolio_id: portfolio.id,
    name: portfolio.name,
    ...weightColumns(portfolio.weights),
    start_date: metrics.startDate,
    end_date: metrics.endDate,
    cycle_count: EXPECTED_CYCLE_COUNT,
    cagr_pct: roundNumber(metrics.cagrPct),
    max_drawdown_pct: roundNumber(metrics.maxDrawdownPct),
    cagr_over_drawdown: roundNumber(metrics.cagrOverDrawdown),
    buy_hold_cagr_pct: roundNumber(buyHoldMetrics.cagrPct),
    cagr_difference_vs_buy_hold_pct_points: roundNumber(metrics.cagrPct - buyHoldMetrics.cagrPct)
  }));

  const curveRows = [
    ...results.flatMap(result => equityRows(result.portfolio.id, result.cycles, result.metrics)),
    ...equityRows('buy_hold', buyHoldCycles, buyHoldMetrics)
  ];

  const validations = {
    buyHold: buyHoldValidation,
    reproductions
  };

  const summaryColumns = [
    'portfolio_id', 'name',
    ...Object.keys(STRATEGIES).map(strategyId => `weight_${strategyId}_pct`),
    'start_date', 'end_date', 'cycle_count', 'cagr_pct', 'max_drawdown_pct',
    'cagr_over_drawdown', 'buy_hold_cagr_pct', 'cagr_difference_vs_buy_hold_pct_points'
  ];
  const curveColumns = [
    'portfolio_id', 'cycle', 'entry_date', 'exit_date', 'cycle_return_pct', 'equity', 'drawdown_pct'
  ];

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, 'summary.csv'), `${objectsToCsv(summaryRows, summaryColumns)}\n`, 'utf8');
  fs.writeFileSync(path.join(OUTPUT_DIR, 'equity_curves.csv'), `${objectsToCsv(curveRows, curveColumns)}\n`, 'utf8');
  fs.writeFileSync(path.join(OUTPUT_DIR, 'report.md'), buildReport({
    config,
    summaryRows,
    validations,
    buyHoldMetrics
  }), 'utf8');

  console.log(`Generated ${summaryRows.length} portfolios with ${EXPECTED_CYCLE_COUNT} cycles each.`);
  console.log(`Buy & Hold total return: ${roundNumber(buyHoldMetrics.totalReturnPct)}%`);
  for (const reproduction of reproductions) {
    console.log(`${reproduction.portfolioId}: exact historical reproduction passed.`);
  }
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_DIR)}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`Error building ${ANALYSIS_ID}: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { main };
