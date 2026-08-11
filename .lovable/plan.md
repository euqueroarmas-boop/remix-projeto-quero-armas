# Badge de vencimento: altura fixa no mobile + texto próprio para cada documento

## 1. Altura fixa da badge (mobile)

Hoje, no mobile, a badge tem `min-height:0` e cresce/encolhe conforme o texto — por isso ela "pula" de tamanho conforme o documento em foco.

Passa a ter altura fixa de 410px (exatamente o tamanho da tela enviada), com:
- título limitado a 2 linhas (reticências se passar);
- texto explicativo com área fixa de 5 linhas;
- botões e o contador de dias sempre na mesma posição, trocando o documento sem mexer no layout.

Desktop segue como está (min-height 236px).

## 2. Quais alertas podem entrar na badge

Entra na badge todo item com data de validade faltando 30 dias ou menos (inclusive vencido). Fontes: Arsenal (CR/CRAF/GTE), Filiação, documentos do Hub, documentos do processo e prazos processuais (≤7 dias).

**Exceção — CR:** o CR passa a alertar com 180 dias de antecedência, porque o prazo fatal para protocolar a renovação é 90 dias antes do vencimento real. De 180 a 91 dias o alerta é de preparação; a partir de 90 dias vira crítico ("PRAZO FATAL DE RENOVAÇÃO").

Hoje quase todos os documentos usam UM texto genérico: "Certidão ou regularidade próxima do vencimento". Só comprovante de residência, filiação e comprovante de terceiro têm texto próprio.

Abaixo, a lista 1 a 1 — nome do documento e texto explicativo proposto — para você aprovar, corrigir ou reescrever item a item.

### Arsenal
1. CR — Certificado de Registro (Exército) — alerta a partir de 180 dias:
   - 180 a 91 dias: "Seu CR vence em X dias. O pedido de renovação precisa ser protocolado até 90 dias antes do vencimento — comece a reunir os documentos agora."
   - 90 dias ou menos: "PRAZO FATAL: faltam X dias para o vencimento do CR e o pedido de renovação já deveria estar protocolado. Sem CR vigente você não compra, não transporta e não registra nenhuma arma."
2. CRAF — Certificado de Registro de Arma de Fogo (por arma) — "O CRAF é o documento da arma. Vencido, o porte/transporte dela é irregular."
3. SINARM — Registro de Arma de Fogo (PF) — "Registro da arma na Polícia Federal. Sem ele vigente, a arma fica irregular."
4. GT — Guia de Tráfego — "Sem guia válida você não pode transportar a arma."
5. GTE — Guia de Tráfego Eventual — "Guia de trânsito eventual vencida bloqueia o transporte da arma."
6. Autorização de compra — "A autorização de compra tem prazo. Vencida, é preciso pedir nova à PF/Exército."

### Filiação e atividade CAC
7. Filiação — clube/entidade — "Filiação vigente é exigida para manter o CAC ativo."
8. Declaração de filiação — "A declaração de filiação vale 90 dias e só serve para uso em processo."
9. Comprovante de habitualidade — "A habitualidade precisa estar atualizada para manter seu CR."
10. Comprovante de clube / entidade — "Comprovante do clube desatualizado trava a análise na PF/Exército."
11. Comprovante de competição / atividade — "Comprovante de atividade fora do prazo não é aceito na renovação."
12. Habilitação de caçador (IBAMA/IBRAM) — "Habilitação ambiental vencida impede o exercício da caça."

### Residência
13. Comprovante de residência — texto já dinâmico: informa a concessionária (EDP, SABESP, Enel...), a data de emissão lida pela IA, quantos dias restam e onde emitir a via nova. Mantém.
14. Comprovante em nome de terceiro — "Comprovante em nome de {primeiro nome} — vence em X dias." Mantém.

### Renda / ocupação
15. Contracheque (holerite) — "A PF aceita contracheque do mês corrente. O seu está saindo da validade."
16. Contracheque de servidor público — mesmo texto do item 15.
17. Nota fiscal recente — "Nota fiscal antiga não comprova atividade atual. Envie a mais recente."
18. Comprovante de benefício — "O comprovante de benefício precisa ser do mês corrente."
19. Extrato INSS — "Extrato do INSS fora do mês corrente não é aceito como comprovação."

### Certidões — renomeação canônica (8 certidões, nem uma a mais)

Os nomes abaixo passam a ser os ÚNICOS rótulos usados no Hub Documental, na aba Documentos, em qualquer slot do checklist e nos e-mails. O texto explicativo aparece só na badge de aviso da home.

20. Crimes Estaduais — Polícia Civil/SP (IIRGD) — "Certidão de antecedentes criminais fora da validade. Emita a nova no site da Polícia Civil."
21. Crimes Estaduais — TJSP — Distribuição de Ações Criminais — "Certidão de distribuição de ações criminais fora da validade. Emita a nova no portal do TJSP."
22. Crimes Estaduais — TJSP — Execuções Criminais — "Certidão de execuções criminais fora da validade. Emita a nova no portal do TJSP."
23. Crimes Estaduais — TJM — "Certidão da Justiça Militar Estadual fora da validade. Emita a nova no portal do TJM."
24. Crimes Federais — TRF 3ª Região — "Certidão do Tribunal Regional Federal da 3ª Região fora da validade. Emita a nova no portal do TRF3."
25. Crimes Federais — Seção Judiciária e JEF/SP — "Certidão da Seção Judiciária/JEF do Estado de São Paulo fora da validade. Emita a nova no portal do TRF3."
26. Crimes contra a União — STM — "Certidão da Justiça Militar da União fora da validade. Emita a nova no portal do STM."
27. Crimes contra a União — TSE — "Certidão de crimes eleitorais fora da validade. Emita a nova no portal do TSE."

**Certidões removidas do catálogo:** "Certidão de Distribuição Criminal — Justiça Federal" (`antecedentes_federal`) e "Certidão Estadual Criminal — TJSP" (`antecedentes_estadual`). Verificado no banco: nenhum cliente tem documento ou exigência nesses dois tipos, então a remoção não afeta ninguém. Ficam apenas como apelido histórico, apontando para a Seção Judiciária/JEF e para a Distribuição de Ações Criminais, para o caso de algum lançamento antigo reaparecer.

**Alertas por e-mail das certidões:** 15 dias, 10 dias e depois contagem regressiva diária (9, 8, 7... 1) até o último dia de validade. Um e-mail por certidão por marco, sem repetir.

### Laudos (sempre 2 itens, nunca 4)

Regra de prazo corrigida: o laudo pode ser protocolado ATÉ o último dia de validade — o processo não trava se a entrega acontecer no último dia. Só trava se for protocolado depois de vencido. O monitoramento começa 120 dias antes do vencimento.

28. Laudo de aptidão psicológica (particular ou instituição) — "Laudo psicológico com prazo curto. Acelere a entrega de seus documentos ou, decida-se agora se irá comprar outro armamento ou não pois irá vencer e você terá que refazê-lo." CTA "AGENDAR AGORA".
29. Laudo de capacidade técnica / tiro (particular ou instituição) — "Laudo de capacidade técnica / tiro com prazo curto. Acelere a entrega de seus documentos ou, decida-se agora se irá comprar outro armamento ou não pois irá vencer e você terá que refazê-lo." CTA "AGENDAR AGORA".

Junto ao alerta, uma linha fixa para o cliente: "Vale até o último dia. Protocolado dentro da validade, o processo segue normalmente — depois de vencido, trava."

**Alertas por e-mail dos laudos:** 120, 90, 60, 45, 30, 20 e 10 dias, e depois contagem regressiva diária (9, 8, 7... 1) até o último dia.

### Jurídico e processo
32. Procuração / Procuração assinada (Gov.br) — "Procuração com prazo perto do fim. Sem ela válida não podemos atuar no seu processo."
30. Prazo processual (exigência, recurso, notificação) — "Prazo processual crítico · ação imediata na PF."
31. Documento do processo sem correspondente no Hub — é o caso em que um documento foi anexado direto na exigência do processo, com um tipo que não existe no catálogo do Hub Documental (lançamento manual da equipe, tipo antigo ou grafado fora do padrão). Ele tem validade, entra na conta de vencimento, mas o sistema não sabe qual é o nome oficial dele — por isso o texto genérico. Com a limpeza das certidões acima, esse caso deve praticamente desaparecer; quando ocorrer, além do alerta ao cliente vai gerar um aviso interno no admin para corrigir o tipo.

Em todos os casos, quando o item já está vencido o texto vira "vencido há X dias" e o kicker muda para "DOCUMENTO VENCIDO · AÇÃO IMEDIATA" (comportamento atual, mantido).

## Detalhes técnicos
Arquivo único: `src/components/quero-armas/clientes/ClienteResumoKanban.tsx`.
- CSS mobile (`max-width:900px`): `.qa-urgbanner{height:410px;min-height:410px}` + grid em linhas fixas; `.qa-urgbanner__title{-webkit-line-clamp:2}`; `.qa-urgbanner__sub{height:96px;-webkit-line-clamp:5}`.
- Substituir o mapa `URG_SUB` por um mapa por `tipo_documento` (`URG_SUB_TIPO`), com fallback para o texto genérico atual quando o tipo não estiver mapeado.
- `pushUrgent` dos documentos passa a resolver o texto por tipo; a lógica de comprovante de residência, terceiro e filiação continua com precedência.
- Janela de alerta passa a ser por tipo: padrão 30 dias (crítico em 10); CR com janela de 180 dias e crítico em 90 (marco do prazo fatal de renovação); laudos com janela de 120 dias; mantendo a ordenação da badge pelo item mais urgente.
- Renomeação das certidões em `documentosHubCatalogo.ts` (label e short) + remoção de `antecedentes_federal` e `antecedentes_estadual`, registrando os dois como apelidos em `qa_tipo_documento_aliases`. Rótulos equivalentes também atualizados em `qa_tipos_documento_catalogo`.
- Laudos: a trava de bloqueio passa a comparar com o fim do dia do vencimento (entrega no último dia é válida); só bloqueia com data de protocolo posterior ao vencimento.
- E-mails: marcos de aviso por família de documento (certidões 15/10 + regressiva diária; laudos 120/90/60/45/30/20/10 + regressiva diária), com deduplicação por documento + marco na tabela de alertas enviados já existente.
