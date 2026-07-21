# Artifact Versioning Policy

## Princípio central

O Git guarda conhecimento permanente, definições reproduzíveis e evidências promovidas. Não deve funcionar como banco de estado corrente nem como depósito automático de toda execução.

Esta política existe para manter o histórico do CCW pequeno, compreensível e útil. Gerar um arquivo não é motivo suficiente para versioná-lo. Antes de entrar no Git, ele precisa ter um papel permanente claro.

## As seis categorias

### 1. Source

Código que define o comportamento do projeto: módulos em `src/`, estratégias, testes, geradores, ferramentas e scripts BAT canônicos.

**Política:** entra no Git. Protótipos só entram quando forem úteis para continuar, revisar ou reproduzir o trabalho. Scripts duplicados ou descartáveis não devem ser promovidos.

### 2. Documentation

Conhecimento escrito: arquitetura, metodologia, decisões, playbooks, baselines, limitações e documentação de operação.

**Política:** entra no Git. A documentação deve registrar o estado realmente aceito do projeto e não contradizer evidências operacionais mais recentes.

### 3. Configuration

Parâmetros que definem uma execução reproduzível: configurações de pesquisa, cenários, assumptions, schemas, defaults e arquivos `.example`.

**Política:** entra no Git quando não contém segredos nem valores específicos da máquina. Credenciais, `.env`, chaves de API, configuração local da conta e caminhos pessoais nunca entram.

### 4. Evidence

Artefato revisado que sustenta uma conclusão científica ou registra um evento operacional importante. Exemplos: findings, summary final, abertura ou fechamento de ciclo, reconciliação, incidente e resultado conclusivo do Execution Lab.

**Política:** entra no Git apenas por decisão consciente. Deve ser estável, compreensível, relevante e preferencialmente compacto. Evidência bruta grande pode permanecer preservada fora do Git.

### 5. Generated

Saída produzida por script ou operação: datasets, séries, snapshots, dashboards, reports, charts, probes e outputs intermediários.

**Política:** não entra automaticamente. Permanece local enquanto for saída de trabalho. Pode entrar somente depois de validada e promovida como Evidence.

### 6. Local

Estado da máquina ou da execução corrente: credenciais, dependências, cache, logs, transcrições, uploads, backups, scratch, estado atual da conta e arquivos `current` ou `latest`.

**Política:** não entra no Git. Quando importante, deve ser preservado fora do Git em local seguro e com backup adequado, sem transformar o repositório em arquivo de toda atividade.

## Regras práticas

1. Código, documentação e configuração reproduzível entram no Git.
2. Credenciais, configurações locais, dependências, caches, logs, transcrições e arquivos específicos da máquina ficam fora.
3. Estado corrente não é histórico. Métricas atuais, dashboard atual, último discovery, último account sync e arquivos `current` ou `latest` permanecem locais, salvo promoção deliberada como Evidence.
4. Outputs gerados não entram automaticamente. Antes de versionar, pergunte se contêm conhecimento permanente, sustentam uma conclusão, registram um evento importante, são revisáveis ou seriam difíceis de reconstruir.
5. Evidência segue o fluxo conceitual `generated → validated → promoted`:
   - **generated:** foi produzido por um script ou operação;
   - **validated:** foi revisado e considerado consistente;
   - **promoted:** foi escolhido como registro permanente e pode entrar no Git.
6. Evite duplicação. Não versione CSV, JSON, Markdown e HTML equivalentes sem necessidade clara. Prefira um formato estruturado canônico e, quando útil, uma apresentação humana.
7. Arquivos grandes e séries completas ficam fora do Git por padrão. Quando importantes, devem ser preservados localmente ou em armazenamento durável até existir necessidade real de uma solução mais sofisticada.

## Live Operation

Por padrão, entram no Git:

- relatórios formais de abertura de ciclo;
- relatórios finais de fechamento;
- decisões manuais importantes;
- incidentes e divergências relevantes;
- reconciliações;
- timeline final compacta por ciclo;
- documentação e código de geração.

Não entram automaticamente:

- snapshots de rotina;
- refreshes repetidos;
- dashboards atuais;
- HTML derivado;
- JSON de estado corrente;
- métricas `latest`;
- consultas repetitivas sem mudança material.

Um snapshot pode ser promovido quando documenta incidente, intervenção, divergência, circuit breaker ou decisão relevante. O snapshot promovido deve deixar claro por que foi preservado.

## Research

Por padrão, entram no Git:

- scripts;
- configuração e assumptions;
- metodologia;
- findings;
- summary compacto;
- limitações.

Não entram automaticamente:

- séries completas;
- datasets grandes;
- outputs intermediários;
- gráficos regeneráveis;
- formatos duplicados;
- tentativas exploratórias sem conclusão.

Um resultado científico promovido deve permitir entender a pergunta, os parâmetros, a conclusão e as limitações sem exigir que todos os arquivos intermediários estejam no Git.

## Execution Lab

O Git preserva marcos, não cada consulta. Exemplos de marcos:

- primeira conectividade validada;
- primeira execução aceita;
- feasibility conclusiva;
- bug relevante e sua consequência;
- baseline de capital;
- mudança importante de especificação da corretora;
- conclusão de uma fase.

Probes repetidos, retries, consultas de rotina e snapshots sem mudança material permanecem locais. Quando um probe sustentar um marco, prefira promover uma conclusão legível e um resultado estruturado compacto, preservando o raw fora do Git se ele ainda for importante.

## Checklist antes de `git add`

- [ ] Este arquivo é Source, Documentation, Configuration ou Evidence?
- [ ] Ele representa conhecimento, decisão, conclusão ou evento permanente?
- [ ] É histórico promovido, e não apenas estado corrente?
- [ ] Existe uma duplicata ou versão que pode ser regenerada?
- [ ] Está livre de credenciais e dados sensíveis desnecessários?
- [ ] É pequeno e revisável o suficiente para o Git?
- [ ] Estamos escolhendo conscientemente promovê-lo?

Se as respostas não forem claras, o arquivo permanece local até ser classificado e validado.
