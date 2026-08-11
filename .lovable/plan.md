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

### Certidões (idoneidade)
20. Certidão de Antecedentes Criminais — Polícia Civil/SP (IIRGD) — "Certidão de antecedentes fora da validade. Emita a nova no site da Polícia Civil."
21. Certidão de Distribuição Criminal — Justiça Federal — "Certidão federal fora da validade. Emita a nova no portal da Justiça Federal."
22. Certidão Estadual Criminal — TJSP — "Certidão estadual fora da validade. Emita a nova no portal do TJSP."
23. Certidão Federal — TRF 3ª Região — "Certidão do TRF3 fora da validade. Emita a nova no portal do TRF3."
24. Certidão Federal — Seção Judiciária SP e JEF/SP — "Certidão da Seção Judiciária/JEF fora da validade. Emita a nova no portal da Justiça Federal em SP."
25. Certidão Estadual TJSP — Distribuição de Ações Criminais — "Certidão de distribuição criminal fora da validade. Emita a nova no portal do TJSP."
26. Certidão Estadual TJSP — Execuções Criminais — "Certidão de execuções criminais fora da validade. Emita a nova no portal do TJSP."
27. Certidão Criminal Militar — STM — "Certidão da Justiça Militar da União fora da validade. Emita a nova no portal do STM."
28. Certidão Criminal Militar — TJM — "Certidão da Justiça Militar Estadual fora da validade. Emita a nova no portal do TJM."
29. Certidão de Crimes Eleitorais — TSE — "Certidão de crimes eleitorais fora da validade. Emita a nova no portal do TSE."

### Laudos (sempre 2 itens, nunca 4)
30. Laudo de aptidão psicológica (particular ou da instituição) — "Laudo psicológico com prazo curto: sem ele vigente, o processo trava na PF." CTA "AGENDAR AGORA".
31. Atestado de capacidade técnica / tiro (particular ou da instituição) — "Capacidade técnica é obrigatória. Renove para não travar o processo e o CR." CTA "AGENDAR AGORA".

### Jurídico e processo
32. Procuração / Procuração assinada (Gov.br) — "Procuração com prazo perto do fim. Sem ela válida não podemos atuar no seu processo."
33. Documento do processo sem correspondente no Hub — "Documento entregue no processo com prazo perto do fim."
34. Prazo processual (exigência, recurso, notificação) — "Prazo processual crítico · ação imediata na PF."

Em todos os casos, quando o item já está vencido o texto vira "vencido há X dias" e o kicker muda para "DOCUMENTO VENCIDO · AÇÃO IMEDIATA" (comportamento atual, mantido).

## Detalhes técnicos
Arquivo único: `src/components/quero-armas/clientes/ClienteResumoKanban.tsx`.
- CSS mobile (`max-width:900px`): `.qa-urgbanner{height:410px;min-height:410px}` + grid em linhas fixas; `.qa-urgbanner__title{-webkit-line-clamp:2}`; `.qa-urgbanner__sub{height:96px;-webkit-line-clamp:5}`.
- Substituir o mapa `URG_SUB` por um mapa por `tipo_documento` (`URG_SUB_TIPO`), com fallback para o texto genérico atual quando o tipo não estiver mapeado.
- `pushUrgent` dos documentos passa a resolver o texto por tipo; a lógica de comprovante de residência, terceiro e filiação continua com precedência.
- Nenhuma mudança de dados, banco ou regra de prazo (30 dias de janela, 10 dias de crítico).
