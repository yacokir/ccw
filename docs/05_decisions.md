# Decisions Log

## 1. Overview

Este documento registra decisões relevantes do sistema ao longo do tempo.

O objetivo é:

- Evitar perda de contexto  
- Garantir rastreabilidade  
- Entender o motivo por trás de mudanças  
- Facilitar revisões futuras  

---

## 2. How to Use

Cada decisão deve ser registrada com:

- Data  
- Título  
- Descrição  
- Impacto  

---

## 3. Decisions

---

### [2026-04-28] Estrutura inicial do sistema

**Descrição:**  
Definição da estrutura base do projeto com separação em:

- Data Layer  
- Execution Layer  
- Analysis Layer  

E organização do repositório em:

- `/docs` (documentação)  
- `/backlog` (tarefas)  
- `/src` (código)  

**Impacto:**  
Estabelece a base organizacional do sistema e evita redundância entre documentos.

---

### [2026-04-28] Abordagem iterativa

**Descrição:**  
Decisão de desenvolver o sistema de forma iterativa, sem sequência rígida entre as etapas.

O fluxo definido é:

> Data → Execution → Inspection → Adjustment → Repeat  

**Impacto:**  
Permite evolução contínua e validação progressiva, reduzindo risco de bloqueios.

---

### [2026-04-28] Foco inicial em Data e Execution

**Descrição:**  
Priorização das camadas Data Layer e Execution Layer antes de aprofundar a Analysis Layer.

**Impacto:**  
Garante base funcional antes de investir em análise avançada.

---

### [2026-04-28] Execução com múltiplos cenários

**Descrição:**  
Definição de suporte a diferentes modelos de execução:

- 08 → 08  
- 16 → 16  
- 08 → 16  

**Impacto:**  
Permite análise explícita de impacto de timing e gaps.

---

### [2026-04-28] Tratamento de imperfeições de dados

**Descrição:**  
Decisão de não ignorar problemas de dados (gaps, delays, fallback), mas tratá-los como parte central do sistema.

**Impacto:**  
Aumenta realismo dos resultados e permite análise mais robusta.

---

### [2026-05-17] Naming temporario de runs por tenor

**Descricao:**
O projeto passou a suportar BTC weekly, 14d e monthly. Durante essa transicao, duas convencoes de naming coexistem nos artefatos:

- Runs weekly legadas usam labels explicitos de moneyness, como `atm00`, `otm03`, `otm05`, `otm07`, `otm10` e `itm05`.
- Runs 14d/monthly mais recentes usam labels compactos `xNN`, como `x00`, `x03`, `x05`, `x07` e `x10`, junto com o sufixo de tenor, por exemplo `_t14d_001` ou `_tmonthly_001`.

Essa diferenca e aceita temporariamente para evitar renomear retroativamente artefatos ja indexados. Analises atuais devem depender de metadados estruturados, como `xOtm`, `tenor`, `run_name` e `path`, e nao apenas de parsing de nomes de pastas.

**Impacto:**
Nao ha bug funcional conhecido, mas existe risco de confusao em documentacao, consultas manuais e scripts futuros que inferirem parametros apenas pelo nome da pasta. Uma normalizacao futura pode padronizar o naming entre tenors e assets, preservando artefatos existentes e compatibilidade com indices e analises ja gerados.

---

### [2026-06-15] Baseline BTC apos comparacao de tenor e risco

**Descricao:**
As fases de consolidacao multi-tenor e analise de risco BTC foram concluidas usando artefatos existentes em `analysis/generated/` e resultados de backtest em `runs/`.

Decisoes atuais:

- Weekly OTM05 passa a ser o baseline primario de risco para BTC.
- Weekly OTM10 fica retido como variante agressiva, voltada a maximizacao de retorno.
- Weekly OTM03 fica retido apenas como referencia defensiva e validacao de sensibilidade.
- 14d OTM10 fica como benchmark secundario, mas nao substitui weekly.
- Monthly nao sera perseguido nesta etapa, pois nao demonstrou melhora suficiente de retorno, risco ou simplicidade.
- Novos ativos nao devem ser adicionados antes de documentar completamente as conclusoes BTC.

Racional:

- Weekly permaneceu superior a 14d e monthly na comparacao consolidada.
- Weekly OTM10 teve maior retorno absoluto e maior excesso contra BTC, mas tambem apresentou maior drawdown, volatilidade, VaR, Expected Shortfall e tempo underwater.
- Weekly OTM05 preservou forte excesso de retorno com melhor perfil ajustado a risco do que OTM10.
- OTM10 manteve exposicao mais proxima de BTC, enquanto OTM05 remodelou melhor o risco sem abandonar a tese de retorno.
- OTM03 ajuda a validar o comportamento defensivo da selecao de strike, mas sacrifica retorno demais para ser o candidato principal.

**Impacto:**
Pesquisas BTC futuras devem usar Weekly OTM05 como referencia padrao. OTM10 deve ser interpretado como uma escolha agressiva e explicita, nao como baseline. OTM03 deve ser usado para comparacao defensiva. Expansao para ETH ou outros ativos so deve ocorrer depois que o pacote de conclusoes BTC estiver estavel e documentado.

---

### [2026-06-15] Validacao do baseline BTC concluida

**Descricao:**
A validacao de robustez do baseline BTC foi concluida apos analises de friccao, estabilidade anual, transicoes de regime e realidade operacional.

Decisao:

- Weekly OTM05 e o baseline BTC validado.
- Weekly OTM10 permanece como configuracao agressiva de maximizacao de retorno.
- Weekly OTM03 permanece como configuracao defensiva e referencia de validacao.

Racional:

- OTM05 sobreviveu a todas as fases de validacao.
- OTM05 permaneceu preferivel apos premissas realistas de friccao.
- OTM05 manteve o perfil ajustado a risco mais adequado para baseline.
- OTM10 continuou sendo a configuracao com maior potencial de retorno, mas com mais risco.
- OTM03 continuou util como referencia defensiva, mas nao substitui OTM05 como baseline.

**Impacto:**
A selecao do baseline BTC nao e mais uma pergunta de pesquisa em aberto. Pesquisas futuras, incluindo expansao para novos ativos, devem usar Weekly OTM05 como estrutura padrao de comparacao, mantendo OTM10 e OTM03 apenas como variantes interpretativas quando forem relevantes.

---

### [2026-06-16] Baseline provisorio ETH apos pesquisa weekly, robustez e tenors

**Descricao:**
A fase ETH concluiu infraestrutura, validacao de cobertura, pesquisa Weekly, validacao de robustez Weekly OTM03 vs OTM05, e exploracao dos tenors 14d e monthly usando o periodo 2020-2026.

Decisao:

- Weekly domina claramente 14d e monthly por retorno em ETH.
- 14d nao e candidato principal neste momento.
- Monthly nao e candidato principal neste momento.
- ETH Weekly OTM05 passa a ser o baseline principal provisorio.
- ETH Weekly OTM03 permanece como principal variante comparativa.
- OTM03 venceu em retorno bruto historico.
- OTM05 foi escolhido como baseline por robustez, consistencia operacional e alinhamento metodologico com BTC.

Racional:

- Embora ETH Weekly OTM03 tenha apresentado o maior retorno bruto historico, a vantagem sobre OTM05 e relativamente pequena quando anualizada.
- A diferenca anualizada entre OTM03 e OTM05 e pequena, aproximadamente 1,5 p.p./ano.
- OTM05 teve melhor desempenho sob friccoes realistas e stress.
- OTM05 apresentou menor carga operacional.
- OTM05 venceu mais anos individuais.
- OTM05 oferece maior compatibilidade metodologica com o baseline BTC, que tambem e Weekly OTM05.

Racional consolidado:

Embora ETH Weekly OTM03 tenha apresentado o maior retorno bruto historico, a vantagem sobre OTM05 e relativamente pequena quando anualizada. Considerando a melhor performance de OTM05 sob friccao e stress, sua maior simplicidade operacional, sua vitoria em mais anos individuais e sua compatibilidade com o baseline BTC, o projeto adota ETH Weekly OTM05 como baseline provisorio.

**Impacto:**
A escolha nao significa que OTM03 seja inferior; significa apenas que a evidencia atual nao e suficientemente forte para justificar uma divergencia metodologica entre BTC e ETH. Pesquisas ETH futuras devem usar Weekly OTM05 como referencia padrao, mantendo Weekly OTM03 como a principal variante comparativa.

---

### [2026-06-17] Passive Hedge Monitoring v0.4b como baseline de pesquisa

**Descricao:**
Depois da generalizacao da camada Daily Approximate MTM, o projeto adicionou uma camada passiva de monitoramento de risco baseada nos artefatos BTC Weekly OTM05 multi-year.

A sequencia de pesquisa foi:

```text
Daily MTM
-> Passive Hedge Monitoring
-> Damage State vs Alert State
-> Threshold Calibration
-> v0.4b como baseline de pesquisa atual
```

Decisao:

- Separar `damage_state` de `alert_state`.
- `damage_state` mede dano acumulado, baseado principalmente em drawdown MTM e underwater duration.
- `alert_state` mede risco acionavel atual, baseado principalmente em historical VaR, EWMA volatility e tail events recentes.
- Drawdown e underwater duration nao devem, sozinhos, manter `crisis` por longos periodos.
- `crisis` deve representar risco agudo ou regime extremo atual, exigindo dano profundo mais confirmacao recente.
- A calibragem `v0.4b` passa a ser a baseline provisoria de pesquisa para futura simulacao de hedge parcial.

Racional:

Thresholds iniciais geravam `stress`/`crisis` excessivos e tornavam o monitor pouco discriminativo. A versao `v0.3` tornou `crisis` rara e mais util. A versao `v0.4b` reduziu o excesso de `stress` acionavel ao separar dano acumulado de alerta acionavel.

The `v0.4b` calibration is not intended to predict market crises. Its purpose is to produce sufficiently discriminative states for future partial-hedge simulations and economic analysis.

**Impacto:**
A camada e util para pesquisa e para preparar simulacoes futuras de hedge parcial por `alert_state`, mas ainda nao e uma politica operacional final. A calibragem `v0.4b` e uma ferramenta de classificacao de estados: nao e sinal operacional de trading, nao e politica final de hedge, nao e modelo de previsao, nao executa hedge, nao define tamanho de posicao, e ainda precisa ser validada contra funding, basis, slippage, liquidez, margem e economia real do hedge.

---

### [2026-06-18] Hedge Simulation Research Layer v03/v04 como referencia de pesquisa

**Descricao:**
A camada Hedge Simulation Research foi consolidada em tres fases sobre BTC Weekly OTM05 Daily MTM multi-year e Passive Hedge Monitoring `v0.4b`:

- Phase 3A: Partial Hedge Simulation And Preliminary Economic Evaluation.
- Phase 3B: Hedge Intensity Robustness.
- Phase 3C: Operational Robustness Validation.

Decisao:

- A formula v02 proporcional passa a ser tratada apenas como proxy simplificada:

```text
hedged_return = ccw_return * (1 - hedge_ratio)
```

- A formula v03 underlying-overlay passa a ser a referencia de pesquisa daqui para frente:

```text
hedged_return = ccw_return - hedge_ratio * underlying_return
```

- `stress30_crisis40` e o candidato principal atual.
- `stress25_crisis50` permanece como benchmark conservador herdado da v01.
- Os cenarios operacionais `A_immediate`, `B_delay_1_valid_mtm_day`, `D_confirmation` e `F_delay_confirmation` devem ser carregados para a futura fase de economia realista.
- `C_delay_2_valid_mtm_days` continua superior ao unhedged nos artefatos de pesquisa, mas apresentou deterioracao material e deve ser tratado como limite de latencia operacional.

Racional:

O beneficio preliminar sobreviveu a variacao de intensidade e a aproximacao mais realista de hedge via underlying-overlay. A camada reduziu drawdown, VaR e volatilidade versus unhedged nos artefatos testados, e apresentou retorno agregado superior ao unhedged na metodologia simplificada. A validacao operacional sugere que o resultado nao depende exclusivamente de execucao perfeita, embora latencia importe.

A melhora de retorno agregado nao implica melhora de retorno em todos os anos individuais. Alguns anos, incluindo 2020 e 2025 em cenarios selecionados, sacrificaram retorno, enquanto outros anos tiveram comportamento misto. A leitura correta e que a camada parece capturar periodos estruturais de risco elevado, nao que ela melhora todos os periodos isoladamente.

**Impacto:**
A hipotese de hedge parcial permanece suficientemente promissora para justificar Phase 4: Realistic Hedge Economics. A proxima fase deve separar Phase 4A Economic Assumptions, Phase 4B Execution Assumptions e Phase 4C Economic Simulation. Antes de qualquer conclusao operacional, o projeto deve modelar funding, basis, slippage, margin requirements, liquidity constraints, collateral requirements, execution latency, partial fills e selecao de instrumento, incluindo perpetual, future e option overlay. Esta decisao nao define politica final de hedge e nao sugere execucao real.

---

### [2026-06-21] Separar T0 discovery de active monitoring

**Descricao:**
O piloto live/paper passou a separar explicitamente o fluxo de abertura de ciclo (`T0_DISCOVERY`) dos fluxos de acompanhamento (`ACTIVE_MONITORING_DAILY` e `ACTIVE_MONITORING_MANUAL`).

Decisao:

- `T0_DISCOVERY` pode executar option discovery e selecionar instrumentos para nova abertura.
- `ACTIVE_MONITORING_DAILY` e `ACTIVE_MONITORING_MANUAL` nao executam option discovery.
- Active monitoring deve acompanhar os instrumentos reais registrados para o ciclo ativo.

**Racional:**
Depois que a posicao esta aberta, selecionar automaticamente uma nova opcao pode contaminar DTE, strike, premium, risco de exercicio e leitura operacional do ciclo. O acompanhamento deve usar a posicao realmente aberta.

**Impacto:**
O workflow live permanece research-grade e read-only, mas a operacao manual fica separada entre descoberta de nova posicao e monitoramento de posicao ativa.

---

### [2026-06-21] Tratar Position Register como estado operacional local

**Descricao:**
O arquivo `live/position_register.json` passa a ser a fonte local de verdade para posicoes ativas usadas no active monitoring.

Decisao:

- `live/position_register.json` e estado operacional local e mutavel.
- O arquivo deve conter apenas posicoes `ACTIVE`.
- O arquivo e ignorado pelo Git.
- `live/position_register.example.json` e o template versionado.
- O Position Register nao representa historico completo de ciclos ou posicoes fechadas.

**Racional:**
O piloto precisa de uma fonte simples e auditavel para saber quais instrumentos monitorar sem projetar prematuramente um historico completo de ciclos.

**Impacto:**
O active monitoring pode ser executado com seguranca contra os instrumentos reais registrados, enquanto historico, retencao e trilha operacional de longo prazo permanecem decisoes futuras.

---

### [2026-06-22] Adicionar wrapper idempotente para Windows Task Scheduler

**Descricao:**
O projeto adicionou um wrapper Windows para facilitar a execucao diaria automatizada do active monitoring.

Decisao:

- `run_live_monitoring_daily_auto.bat` e o wrapper para Task Scheduler.
- O wrapper e idempotente por data de Nova York: se o snapshot diario ja existir, ele registra no log e sai com sucesso.
- `run_live_monitoring_daily_auto_check.bat` valida pre-condicoes sem gerar snapshots ou alterar `live/data/`.
- Logs do wrapper ficam sob `logs/live_monitoring/`.

**Racional:**
A automacao diaria deve evitar snapshots duplicados e reduzir risco operacional, mantendo a logica de monitoring concentrada nos scripts ja existentes.

**Impacto:**
A execucao diaria pode ser testada e agendada com menor friccao operacional, sem alterar metodologia, hedge logic, monitoring logic ou assumptions de pesquisa.

---

### [2026-06-27] Separar accounting live entre ciclo atual e portfolio/lifetime

**Descricao:**
Os relatorios live passam a separar explicitamente duas leituras contabeis:

- Current Cycle Accounting.
- Portfolio / Lifetime Accounting.

Decisao:

- Current Cycle Accounting usa o preco de referencia do ciclo em `cycle_accounting.underlying_reference_price`, a opcao atual e o hedge atual.
- Portfolio / Lifetime Accounting usa o custo original de compra do spot, a opcao atual e o hedge atual.
- Relatorios live nao devem exibir um `Net PnL` generico ou ambiguo.
- Campos legados de PnL permanecem para compatibilidade, mas espelham a leitura Portfolio / Lifetime em vez de um net hibrido.
- `cycle_accounting` e estado operacional minimo do ciclo ativo, nao ledger historico.

**Racional:**
O primeiro rollover semanal mostrou que somar underlying PnL desde a compra original do UA com option/hedge PnL do ciclo atual cria um resultado hibrido que nao representa corretamente nem o ciclo atual nem a carteira consolidada.

**Impacto:**
`ACTIVE_MONITORING_DAILY`, `LIVE_POSITION_TIMELINE` e a opcao 5 do menu passam a reportar Net Cycle PnL e Portfolio Net PnL separadamente, sem alterar estrategia, hedge rules, option discovery, execution ou scheduler.
