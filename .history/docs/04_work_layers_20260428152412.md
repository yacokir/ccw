# Work Layers

## 1. Overview

O sistema é estruturado em três camadas principais:

> Data Layer → Execution Layer → Analysis Layer

Cada camada possui responsabilidades bem definidas e pode evoluir de forma relativamente independente.

---

## 2. Data Layer (Entrada de Dados)

Responsável pela qualidade e integridade dos dados.

### Escopo

- Coleta de dados históricos  
- Normalização de estrutura (timestamps, OHLC, etc.)  
- Tratamento básico de dados faltantes (gaps, fallback, etc.)  
- Garantia de consistência do dataset  

### Observação

A coleta de dados é uma etapa crítica, sujeita a limitações de APIs, instabilidades e possíveis delays não triviais.

---

## 3. Execution Layer (Core do Sistema)

Responsável por transformar dados em trades.

### Escopo

- Implementação da estratégia CCW  
- Motor de backtest  
- Regras de execução (entrada, saída, expiração)  
- Geração de trades  
- Garantia de reprodutibilidade dos resultados  

### Pendências atuais

- Implementar e testar diferentes modelos de execução  
- Validar lógica de fills e timestamps  

---

## 4. Analysis Layer (Análise e Avaliação)

Responsável por interpretar os resultados.

### Escopo (evolutivo)

- Equity curve  
- Drawdown  
- Retornos agregados  
- Comparação com benchmarks (ex: buy & hold)  

### Análises específicas planejadas

- Impacto do gap 08–16  
  - métricas: gap_ITM, gap_OTM  
  - distribuição e viés  

- Simulação de Monte Carlo  
- Avaliação de risco  

### Observação

Esta camada pode ser desenvolvida progressivamente após estabilização do core.