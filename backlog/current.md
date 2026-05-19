# Current Backlog

## 1. Overview

Este backlog contém as tarefas atuais do sistema, com foco na evolução das camadas Data e Execution.

As tarefas podem ser ajustadas conforme o sistema evolui.

---

## 2. Current Priorities

### 2.1 Data Layer

- Implementar coleta de dados históricos  
- Definir fonte(s) de dados (API, dataset, etc.)  
- Validar estrutura básica dos dados (timestamps, preços)  
- Implementar normalização inicial do dataset  

---

### 2.2 Execution Layer

- Implementar estrutura básica do backtester  
- Definir estrutura de trade (entrada, saída, resultado)  
- Implementar primeiro modelo simples de execução  

---

## 3. Execution Scenarios

- Implementar execução **08 → 08** (base inicial)  
- Preparar estrutura para suportar múltiplos cenários  

---

## 4. Data Issues (To Investigate)

- Identificar presença de gaps nos dados  
- Avaliar necessidade de fallback de preço  
- Medir possíveis delays entre sinal e execução  

---

## 5. Next Steps (Short-Term)

1. Conseguir rodar o sistema ponta a ponta (mesmo que simples)  
2. Gerar primeiros trades  
3. Validar consistência básica dos resultados  

---

## 6. Notes

- Priorizar funcionamento antes de otimização  
- Evitar complexidade prematura  
- Ajustes são esperados durante a execução

---

## 7. Future Cleanup

- Normalize non-weekly run naming from compact `xNN` labels to explicit `atm`/`otm`/`itm` moneyness labels across tenors and future assets, while preserving existing indexed artifacts and avoiding breakage in `runs/index.csv`, batch summaries, and analysis scripts.

---

## 8. Research Framework Roadmap

The BTC CCW project is transitioning from exploratory backtesting to a structured quantitative research framework. The roadmap below preserves existing generated outputs and historical conclusions while prioritizing methodology stability.

### 8.1 Methodology Normalization

- Formalize which metrics are summary-level, reconstructed-equity, rolling-window, regime, and visualization-only.
- Keep full-period and partial-period rows clearly separated in rankings and conclusions.
- Prefer structured metadata fields such as `asset`, `tenor`, `moneyness_label`, `xOtm`, and `comparison_scope` over folder-name parsing.

### 8.2 Annualization Layer

- Add annualized volatility, Sharpe, Sortino, and related risk-adjusted metrics.
- Preserve current cycle-based metrics for traceability.
- Add tenor-normalized comparisons so weekly, 14d, and monthly outputs can be compared more directly.

### 8.3 ETH Replication

- Replicate the stabilized BTC methodology on ETH.
- Reuse the same analysis layers, glossary conventions, and caveat structure.
- Compare ETH results against BTC only after methodology parity exists.

### 8.4 Cross-Asset Comparison

- Build BTC/ETH comparison views after ETH replication.
- Separate asset effects from tenor and moneyness effects.
- Avoid expanding to additional assets before BTC/ETH methodology is stable.

### 8.5 Visualization Improvements

- Improve rolling charts, date ticks, legends, and distribution views.
- Add explicit outlier annotation where extreme observations dominate axes.
- Keep visual aggregation documented and separate from source analysis datasets.

### 8.6 Monte Carlo Layer

- Add future Monte Carlo analysis based on realized cycle-return distributions.
- Use it to study path dependency, tail outcomes, drawdown persistence, and strategy robustness.
- Treat Monte Carlo results as scenario analysis, not historical fact.

### 8.7 CSP, Collars, And Hedging Overlays

- Study cash-secured puts, collars, futures hedges, and regime-based hedging overlays after the baseline CCW methodology is stable.
- Keep overlay research separate from baseline results so historical BTC CCW conclusions remain traceable.

### 8.8 Intracycle Risk Modeling

- Add intracycle mark-to-market risk when suitable price paths and option marks are available.
- Distinguish end-of-cycle reconstructed drawdown from intracycle underwater risk.
- Extend realism layers for fees, slippage, funding, custody, and execution constraints.
