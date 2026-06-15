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

**Output:**
- Métricas consolidadas  
- Insights sobre performance e risco  

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

The BTC risk-analysis baseline is Weekly OTM05. Weekly OTM10 remains the aggressive return-maximizing variant, and Weekly OTM03 remains a defensive validation/reference configuration.

Future Analysis Layer work should preserve these distinctions and avoid treating tenor exploration, monthly expansion, or BTC baseline risk selection as open questions unless new evidence is explicitly generated and documented.

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
