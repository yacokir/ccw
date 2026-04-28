# Product Requirements Document (PRD)

## 1. Overview

O sistema tem como objetivo permitir o backtest de estratégias de **Covered Call (CCW)** aplicadas a criptomoedas, com foco em análise de execução, impacto de dados e avaliação de performance.

---

## 2. Objectives

- Simular estratégias de Covered Call de forma consistente  
- Avaliar impacto de diferentes modelos de execução  
- Analisar efeitos de gaps e delays nos resultados  
- Gerar métricas de performance e risco  

---

## 3. Scope

### 3.1 In Scope

- Backtest de estratégias CCW  
- Uso de dados históricos de mercado  
- Simulação de diferentes horários de execução  
- Geração de trades e resultados  
- Análise básica de performance  

---

### 3.2 Out of Scope

- Execução em tempo real  
- Integração com corretoras  
- Interface gráfica (UI completa)  
- Automação de trading  

---

## 4. Core Functionality

### 4.1 Input

- Dados históricos de preço (OHLC ou equivalente)  
- Parâmetros da estratégia (ex: strike, prazo, regras)  
- Configuração de execução (horários, delays, etc.)  

---

### 4.2 Processing

- Aplicação da lógica da estratégia CCW  
- Simulação de cenários de execução  
- Geração de trades com base nas regras definidas  

---

### 4.3 Output

- Lista de trades  
- Resultados agregados  
- Métricas básicas de performance  

---

## 5. Execution Scenarios

O sistema deve suportar diferentes modelos de execução para análise comparativa:

- Execução **08 → 08** (modelo teórico)  
- Execução **16 → 16** (modelo mais realista)  
- Execução **08 → 16** (análise de gap)  

---

## 6. Key Metrics (Planned)

- Retorno total  
- Retorno por período  
- Drawdown  
- Comparação com buy & hold  
- Métricas relacionadas a gaps (ex: ITM/OTM)  

---

## 7. Constraints

- Dependência de qualidade dos dados históricos  
- Possíveis limitações de APIs de dados  
- Necessidade de tratamento de gaps e delays  

---

## 8. Success Criteria

- Capacidade de rodar backtests de ponta a ponta  
- Resultados consistentes e reprodutíveis  
- Identificação clara de impactos de execução e dados  