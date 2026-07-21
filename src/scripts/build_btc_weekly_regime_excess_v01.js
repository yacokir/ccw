const fs = require('fs');
const path = require('path');

const {
  REPO_ROOT,
  readCsv,
  readJson,
  objectsToCsv,
  optionalNumber,
  roundNumber,
  mean,
  median,
  pct
} = require('./btc_deep_risk_utils');

const ANALYSIS_ID = 'btc_weekly_regime_excess_v01';
const OUTPUT_DIR = path.join(REPO_ROOT, 'analysis', 'generated', ANALYSIS_ID);
const EXPECTED_CYCLES = 325;
const TOLERANCE = 1e-10;

const STRATEGIES = [
  { id: 'atm00', label: 'ATM', batch: 'batch_years_atm00_2020_2026' },
  { id: 'otm03', label: 'OTM03', batch: 'batch_years_otm03_2020_2026' },
  { id: 'otm05', label: 'OTM05', batch: 'batch_years_otm05_2020_2026' },
  { id: 'otm07', label: 'OTM07', batch: 'batch_years_otm07_2020_2026' },
  { id: 'otm10', label: 'OTM10', batch: 'batch_years_otm10_2020_2026' }
];

const REGIMES = [
  { id: 'strong_down', label: 'Forte queda' },
  { id: 'moderate_down', label: 'Queda moderada' },
  { id: 'stable', label: 'Estabilidade' },
  { id: 'moderate_up', label: 'Alta moderada' },
  { id: 'strong_up', label: 'Forte alta' }
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function regimeForBtcReturn(value) {
  if (value <= -0.10) return 'strong_down';
  if (value < -0.03) return 'moderate_down';
  if (value <= 0.03) return 'stable';
  if (value < 0.10) return 'moderate_up';
  return 'strong_up';
}

function loadStrategy(definition) {
  const summaryPath = path.join(REPO_ROOT, 'runs', 'batches', definition.batch, 'summary.json');
  const summary = readJson(summaryPath);
  const cycles = [];
  const annualResults = (summary.annualResults || [])
    .filter(result => Number.isInteger(Number(result.year)))
    .sort((a, b) => Number(a.year) - Number(b.year));

  for (const annualResult of annualResults) {
    const runName = annualResult.savedRun && annualResult.savedRun.runName;
    assert(runName, `${definition.id}: runName ausente para ${annualResult.year}`);
    const tradesPath = path.join(REPO_ROOT, 'runs', runName, 'trades.csv');
    assert(fs.existsSync(tradesPath), `${definition.id}: trades.csv ausente para ${annualResult.year}`);

    for (const trade of readCsv(tradesPath)) {
      const SEntry = optionalNumber(trade.S_entry);
      const SExit = optionalNumber(trade.S_exit);
      const btcPosition = optionalNumber(trade.btc_position);
      const pnlCall = optionalNumber(trade.pnl_call);
      const pnlUnderlying = optionalNumber(trade.pnl_underlying);
      const pnlTotal = optionalNumber(trade.pnl_total);
      const commonCapital = SEntry !== null && btcPosition !== null ? btcPosition * SEntry : null;

      assert(SEntry !== null && SEntry > 0, `${definition.id}: S_entry inválido em ${trade.entry_date}`);
      assert(SExit !== null && SExit > 0, `${definition.id}: S_exit inválido em ${trade.entry_date}`);
      assert(btcPosition !== null && btcPosition > 0, `${definition.id}: btc_position inválido em ${trade.entry_date}`);
      assert(pnlCall !== null && pnlUnderlying !== null && pnlTotal !== null,
        `${definition.id}: PnL ausente em ${trade.entry_date}`);
      assert(commonCapital > 0, `${definition.id}: capital comum inválido em ${trade.entry_date}`);
      assert(Math.abs(pnlTotal - (pnlCall + pnlUnderlying)) <= TOLERANCE,
        `${definition.id}: decomposição de PnL divergente em ${trade.entry_date}`);

      const btcReturn = SExit / SEntry - 1;
      const normalizedCcwReturn = pnlTotal / commonCapital;
      const excessFromReturns = normalizedCcwReturn - btcReturn;
      const excessFromCall = pnlCall / commonCapital;

      assert(Math.abs(excessFromReturns - excessFromCall) <= TOLERANCE,
        `${definition.id}: fórmulas de excesso divergentes em ${trade.entry_date}`);

      cycles.push({
        entryDate: trade.entry_date,
        exitDate: trade.exit_date,
        SEntry,
        SExit,
        btcReturn,
        normalizedCcwReturn,
        excessReturn: excessFromCall,
        regimeId: regimeForBtcReturn(btcReturn)
      });
    }
  }

  cycles.sort((a, b) => new Date(a.entryDate) - new Date(b.entryDate));
  return { ...definition, cycles };
}

function validateAlignment(strategies) {
  const canonical = strategies[0].cycles;
  assert(canonical.length === EXPECTED_CYCLES,
    `${strategies[0].id}: ${canonical.length} ciclos, esperado ${EXPECTED_CYCLES}`);

  for (const strategy of strategies) {
    assert(strategy.cycles.length === EXPECTED_CYCLES,
      `${strategy.id}: ${strategy.cycles.length} ciclos, esperado ${EXPECTED_CYCLES}`);
    strategy.cycles.forEach((cycle, index) => {
      const base = canonical[index];
      assert(cycle.entryDate === base.entryDate, `${strategy.id}: entry_date divergente no ciclo ${index + 1}`);
      assert(cycle.exitDate === base.exitDate, `${strategy.id}: exit_date divergente no ciclo ${index + 1}`);
      assert(Math.abs(cycle.SEntry - base.SEntry) <= TOLERANCE,
        `${strategy.id}: S_entry divergente no ciclo ${index + 1}`);
      assert(Math.abs(cycle.SExit - base.SExit) <= TOLERANCE,
        `${strategy.id}: S_exit divergente no ciclo ${index + 1}`);
      assert(cycle.regimeId === base.regimeId, `${strategy.id}: regime divergente no ciclo ${index + 1}`);
    });
  }
}

function summarize(strategies) {
  return REGIMES.map(regime => {
    const canonicalCycles = strategies[0].cycles.filter(cycle => cycle.regimeId === regime.id);
    const row = {
      regime_id: regime.id,
      regime: regime.label,
      n: canonicalCycles.length
    };

    for (const strategy of strategies) {
      const excessPct = strategy.cycles
        .filter(cycle => cycle.regimeId === regime.id)
        .map(cycle => cycle.excessReturn * 100);
      assert(excessPct.length === canonicalCycles.length,
        `${strategy.id}: contagem divergente no regime ${regime.id}`);
      row[`${strategy.id}_mean_excess_pct`] = roundNumber(mean(excessPct));
      row[`${strategy.id}_median_excess_pct`] = roundNumber(median(excessPct));
      row[`${strategy.id}_positive_cycles_pct`] = roundNumber(
        pct(excessPct.filter(value => value > 0).length, excessPct.length)
      );
    }
    return row;
  });
}

function formatPct(value) {
  return `${roundNumber(value, 4).toFixed(4)}%`;
}

function markdownTable(rows, strategies, suffix) {
  const header = `| Regime BTC | N | ${strategies.map(strategy => strategy.label).join(' | ')} |`;
  const alignment = `| --- | --: | ${strategies.map(() => '--:').join(' | ')} |`;
  const body = rows.map(row => {
    const values = strategies.map(strategy => formatPct(row[`${strategy.id}_${suffix}`]));
    return `| ${row.regime} | ${row.n} | ${values.join(' | ')} |`;
  });
  return [header, alignment, ...body].join('\n');
}

function buildReport(rows, strategies) {
  return [
    '# BTC Weekly Covered Call Excess Return by BTC Regime v01',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Escopo',
    '',
    '- Fonte exclusiva: 325 ciclos semanais BTC já existentes, de 2020-01-03 a 2026-05-08.',
    '- Estratégias: ATM, OTM03, OTM05, OTM07 e OTM10.',
    '- Análise descritiva; nenhuma pretensão preditiva.',
    '- O regime é conhecido somente após o encerramento do ciclo.',
    '',
    '## Excesso médio semanal sobre Buy & Hold',
    '',
    'Cada célula mostra o excesso médio semanal da Covered Call sobre o BTC, em pontos percentuais, usando a mesma base de capital.',
    '',
    markdownTable(rows, strategies, 'mean_excess_pct'),
    '',
    '## Mediana do excesso semanal',
    '',
    markdownTable(rows, strategies, 'median_excess_pct'),
    '',
    '## Frequência de excesso positivo',
    '',
    markdownTable(rows, strategies, 'positive_cycles_pct'),
    '',
    '## Metodologia',
    '',
    'Para cada ciclo:',
    '',
    '```text',
    'retorno_BTC = (S_exit / S_entry) - 1',
    'capital_comum = btc_position * S_entry',
    'retorno_CCW_normalizado = pnl_total / capital_comum',
    'excesso = retorno_CCW_normalizado - retorno_BTC',
    '```',
    '',
    'A equivalência abaixo foi validada em todos os ciclos:',
    '',
    '```text',
    'excesso = pnl_call / (btc_position * S_entry)',
    '```',
    '',
    'Regimes fixos:',
    '',
    '- Forte queda: BTC <= -10%.',
    '- Queda moderada: -10% < BTC < -3%.',
    '- Estabilidade: -3% <= BTC <= +3%.',
    '- Alta moderada: +3% < BTC < +10%.',
    '- Forte alta: BTC >= +10%.',
    '',
    '## Interpretação',
    '',
    '- Excesso positivo significa desempenho relativo superior ao Buy & Hold no ciclo.',
    '- "Proteção" significa perder menos ou ganhar mais que Buy & Hold; não significa necessariamente retorno absoluto positivo.',
    '- A classificação usa o retorno realizado do próprio ciclo e só pode ser conhecida ex post.',
    '- Os resultados descrevem o payoff histórico condicionado ao movimento do BTC e não constituem regra de seleção antecipada de strike.',
    '',
    '## Validações',
    '',
    `- ${strategies.length} strikes com ${EXPECTED_CYCLES} ciclos alinhados por datas e preços do underlying.`,
    `- ${rows.reduce((sum, row) => sum + row.n, 0)} ciclos classificados exatamente uma vez.`,
    '- Todos os denominadores `btc_position * S_entry` são positivos.',
    '- `pnl_total = pnl_call + pnl_underlying` em todos os ciclos.',
    '- As duas fórmulas aprovadas para o excesso coincidem em todos os ciclos dentro da tolerância numérica.',
    ''
  ].join('\n');
}

function main() {
  const strategies = STRATEGIES.map(loadStrategy);
  validateAlignment(strategies);
  const rows = summarize(strategies);
  assert(rows.reduce((sum, row) => sum + row.n, 0) === EXPECTED_CYCLES,
    'A soma das contagens dos regimes não coincide com o total de ciclos');

  const columns = ['regime_id', 'regime', 'n'];
  for (const strategy of strategies) {
    columns.push(
      `${strategy.id}_mean_excess_pct`,
      `${strategy.id}_median_excess_pct`,
      `${strategy.id}_positive_cycles_pct`
    );
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, 'summary.csv'), `${objectsToCsv(rows, columns)}\n`, 'utf8');
  fs.writeFileSync(path.join(OUTPUT_DIR, 'report.md'), buildReport(rows, strategies), 'utf8');

  console.log(`Generated ${rows.length} BTC regimes from ${EXPECTED_CYCLES} aligned weekly cycles.`);
  console.log(`Counts: ${rows.map(row => `${row.regime}=${row.n}`).join(', ')}`);
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
