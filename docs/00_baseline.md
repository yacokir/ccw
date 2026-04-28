# System Baseline

## 1. Overview

Este projeto implementa um sistema de backtest para estratégias de **Covered Call (CCW)** aplicadas a criptomoedas.

O objetivo é construir uma base consistente para simulação, permitindo analisar o impacto de diferentes modelos de execução, qualidade dos dados e comportamento de mercado.

---

## 2. Problem Definition

Backtests tradicionais frequentemente assumem condições ideais de execução e dados completos, o que pode gerar resultados distorcidos.

Este sistema busca:

- Tornar explícitos os efeitos de gaps e delays  
- Comparar diferentes modelos de execução  
- Avaliar o impacto realista das condições de mercado  

---

## 3. System Scope

O sistema cobre:

- Coleta e preparação de dados históricos  
- Simulação de estratégias CCW  
- Geração de trades  
- Análise de resultados  

---

## 4. Core Principles

### 4.1 Simplicidade

O sistema deve começar simples e evoluir conforme necessário, evitando complexidade desnecessária.

---

### 4.2 Transparência

Todos os efeitos relevantes (gaps, delays, execução) devem ser visíveis e analisáveis.

---

### 4.3 Reprodutibilidade

Resultados devem ser consistentes quando executados sob as mesmas condições.

---

### 4.4 Iteratividade

O desenvolvimento e uso do sistema são iterativos, com ciclos contínuos de ajuste e melhoria.

---

## 5. Key Concepts

### 5.1 Covered Call (CCW)

Estratégia baseada na venda de opções de compra sobre um ativo subjacente, visando geração de renda.

---

### 5.2 Execution Models

Diferentes formas de simular a execução da estratégia, variando horários e condições.

Exemplos:
- 08 → 08  
- 16 → 16  
- 08 → 16  

---

### 5.3 Data Imperfections

Dados de mercado podem apresentar:

- Gaps (ausência de preços)  
- Delays (diferença entre sinal e execução)  
- Inconsistências  

Esses fatores são parte central da análise do sistema.

---

## 6. System Boundaries

O sistema não inclui:

- Execução real de trades  
- Integração com corretoras  
- Interface gráfica completa  

---

## 7. Relationship with Other Documents

- O **PRD** define o que o sistema deve fazer  
- A **Architecture** define como o sistema é estruturado  
- O **Workflow** define como o sistema é utilizado  
- Os **Work Layers** detalham responsabilidades internas  
- O **Backlog** contém tarefas e evoluções futuras  
- O **Decisions Log** registra decisões importantes  

Este documento serve como referência central de entendimento do sistema.