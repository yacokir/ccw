# System Architecture

## 1. Overview

O sistema é estruturado em três camadas principais:

> Data Layer → Execution Layer → Analysis Layer

Cada camada possui responsabilidades bem definidas e interage com as demais de forma sequencial.

---

## 2. High-Level Architecture

### Fluxo geral:

1. A **Data Layer** fornece os dados processados  
2. A **Execution Layer** consome esses dados e gera trades  
3. A **Analysis Layer** utiliza os resultados para análise  

---

## 3. Layers Description

### 3.1 Data Layer

Responsável pela entrada e preparação dos dados.

**Responsabilidades:**
- Coleta de dados históricos  
- Normalização de estrutura (timestamps, OHLC, etc.)  
- Tratamento de dados faltantes (gaps, fallback)  
- Garantia de consistência  

**Output:**
- Dataset limpo e estruturado pronto para execução  

---

### 3.2 Execution Layer

Responsável pela lógica principal do sistema.

**Responsabilidades:**
- Implementação da estratégia CCW  
- Motor de backtest  
- Regras de execução (entrada, saída, expiração)  
- Simulação de diferentes cenários de execução  
- Geração de trades  

**Output:**
- Lista de trades  
- Resultados brutos da execução  

---

### 3.3 Analysis Layer

Responsável por interpretar os resultados.

**Responsabilidades:**
- Cálculo de métricas (retorno, drawdown, etc.)  
- Geração de indicadores de performance  
- Comparação com benchmarks  
- Análises estatísticas e de risco  
- Daily Approximate MTM research  
- Passive Hedge Monitoring research  
- Hedge Simulation research and operational robustness analysis  

**Output:**
- Métricas consolidadas  
- Insights sobre performance e risco  
- Artefatos de pesquisa sob `analysis/generated/`, preservando rastreabilidade entre baseline, Daily MTM, monitoring e hedge simulation  

---

### 3.4 Live Research Operations Layer

The Live Research Operations Layer is an auxiliary research/pilot layer outside production execution.

**Characteristics:**
- Read-only workflow support.
- Manual/paper trading support.
- Snapshot generation.
- Operational logging.
- Active position monitoring.
- Does not place orders.
- Does not replace production execution controls.

This layer supports the current live pilot by translating research outputs into auditable manual operating artifacts while preserving the separation between research, monitoring, and actual trade execution.

---

## 4. Data Flow

O fluxo de dados entre as camadas é unidirecional:

> Data Layer → Execution Layer → Analysis Layer

No entanto, ajustes podem ocorrer de forma iterativa, retornando às camadas anteriores.

---

### 4.1 Output and artifact naming

Run outputs are stored as artifacts under `runs/` and should be interpreted through structured metadata whenever possible. Current BTC artifacts temporarily contain two moneyness naming conventions: legacy weekly runs use explicit labels such as `atm00`, `otm05` and `itm05`, while newer 14d and monthly runs may use compact labels such as `x00`, `x05` and `x10` with an explicit tenor suffix.

This coexistence is intentional for now to avoid retroactive renaming of indexed artifacts. Analysis code and manual reviews should prefer fields such as `xOtm`, `tenor`, `run_name` and `path` over folder-name parsing alone. A future naming normalization can standardize labels across tenors and assets while preserving compatibility with existing outputs.

---

### 4.2 Current BTC research state

The BTC weekly, 14d, and monthly tenor comparison is complete. Weekly remains the preferred tenor; monthly is no longer an active BTC candidate at this stage, and 14d OTM10 is retained only as a secondary benchmark.

The validated BTC baseline is Weekly OTM05. Weekly OTM10 remains the aggressive return-maximizing variant, and Weekly OTM03 remains a defensive validation/reference configuration.

Future Analysis Layer work should preserve these distinctions and avoid treating tenor exploration, monthly expansion, or BTC baseline risk selection as open questions unless new evidence is explicitly generated and documented. Future cross-asset comparisons should use BTC Weekly OTM05 as the default reference framework.

---

### 4.3 Current ETH research state

The ETH infrastructure, coverage validation, weekly moneyness research, weekly robustness validation, and 14d/monthly tenor exploration are complete.

Weekly clearly dominates 14d and monthly by return in the current ETH artifacts. Neither 14d nor monthly is a primary ETH candidate at this stage.

The provisional ETH baseline is Weekly OTM05. Weekly OTM03 remains the primary comparative variant. OTM03 had the highest historical gross return, but its annualized advantage over OTM05 is small. OTM05 performed better under realistic and stress friction assumptions, has lower operational burden, won more individual years, and preserves methodological compatibility with the validated BTC Weekly OTM05 baseline.

Although ETH Weekly OTM03 had the highest historical gross return, its advantage over OTM05 is relatively small when annualized. Considering OTM05's better performance under friction and stress, its greater operational simplicity, its victory in more individual years, and its compatibility with the BTC baseline, the project adopts ETH Weekly OTM05 as the provisional baseline.

This choice does not mean OTM03 is inferior. It means the current evidence is not strong enough to justify a methodological divergence between BTC and ETH.

---

### 4.4 Current risk and hedge research state

The Daily Approximate MTM layer, Passive Hedge Monitoring layer, and Hedge Simulation Research Layer are Analysis Layer capabilities. They process existing run and Daily MTM artifacts and should not mutate baseline backtest outputs.

Current hedge simulation research uses BTC Weekly OTM05 Daily MTM multi-year artifacts and Passive Hedge Monitoring `v0.4b`. The v03/v04 reference methodology approximates a BTC underlying overlay:

```text
hedged_return = ccw_return - hedge_ratio * underlying_return
```

The earlier proportional formula is retained only as a simplified proxy:

```text
hedged_return = ccw_return * (1 - hedge_ratio)
```

The current primary research candidate is `stress30_crisis40`, with `stress25_crisis50` retained as a conservative benchmark. The evidence suggests the hedge overlay is capturing structural periods of elevated risk rather than only exploiting perfect timing assumptions, but aggregate improvement does not imply improvement in every individual year.

At the architecture level, the project has evolved from covered-call backtesting toward a Dynamic Covered Call Risk Management Framework:

```text
Covered Call
+ Daily Risk Engine
+ Regime Detection
+ Adaptive Hedge Overlay
```

These are research artifacts only. Realistic hedge economics, including funding, basis, slippage, margin, liquidity, collateral, execution assumptions, partial fills, latency sensitivity, and instrument selection, remain future work.

---

## 5. Design Principles

### 5.1 Separação de responsabilidades

Cada camada deve ter um papel claro e independente.

---

### 5.2 Reprodutibilidade

A Execution Layer deve produzir os mesmos resultados dado o mesmo input.

---

### 5.3 Simplicidade

A arquitetura deve permanecer simples e evoluir conforme necessário, evitando complexidade prematura.

---

### 5.4 Iteratividade

O sistema é projetado para evolução contínua, não para execução única.
