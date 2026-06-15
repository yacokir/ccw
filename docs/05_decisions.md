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
