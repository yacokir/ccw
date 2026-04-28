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