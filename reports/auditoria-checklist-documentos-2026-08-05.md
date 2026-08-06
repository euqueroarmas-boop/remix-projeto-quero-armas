# Auditoria profunda — Checklist de documentos do processo de compra/posse de arma

**Data:** 2026-08-05
**Escopo:** toda a lógica de entrega, extração (parser/IA) e conclusão de checklist de documentos do processo de autorização de compra/posse de arma de fogo, no código atual do repositório `remix-projeto-quero-armas`.
**Motivação:** dois clientes (Mizael e Anthony) relatam dificuldade recorrente para concluir o checklist — em alguns casos o sistema aparenta "tudo certo" e mesmo assim trava.
**Método:** leitura integral de 20 Edge Functions (Deno/TypeScript), migrations SQL relevantes (Postgres/Supabase), componentes e libs de front-end (React/TypeScript), cruzados com o diagrama de fluxo já existente em `reports/diagrama-area-cliente-documentos-2026-07-22.md` e com a diretriz global do projeto (`mem/constraints/quero-armas-diretriz-global.md`).

> Todas as sugestões desta auditoria respeitam a **Diretriz Global — Zero Regressão** do projeto: nenhuma delas propõe apagar, substituir ou refatorar estruturalmente algo validado. São extensões pontuais. Nenhuma foi implementada — isto é só o relatório de auditoria.

---

## 1. Resumo executivo

O checklist de documentos **não tem uma única fonte de verdade**. Existem **quatro implementações paralelas** da mesma regra de negócio (quais documentos faltam, quando um item conta como cumprido, quando a etapa avança, quando o processo fica "pronto para protocolar"):

| Camada | Tecnologia | Onde |
|---|---|---|
| A — Catálogo/explosão | SQL (função Postgres) | `qa_explodir_checklist_processo`, migration `20260804163338_...sql` |
| B — Recálculo automático via trigger | SQL (trigger Postgres) | `qa_proc_docs_recalc_prazos_upd` → `qa_recalcular_prazos_processo`, migration `20260528184553_...sql` |
| C — Edge Functions (checagem sob demanda) | Deno/TypeScript (Supabase Edge Function) | `qa-processo-etapa-auto-liberar`, `qa-processo-checar-conclusao-checklist` |
| D — Front-end (o que o cliente/admin vê) | React/TypeScript | `checklistMetrics.ts`, `checklistGuiadoEngine.ts` (não usado no fluxo real hoje), `cockpit-z6/buildFromReal.ts` |

Essas quatro camadas usam **conjuntos de status "cumprido" ligeiramente diferentes**, **dois esquemas de JSON diferentes** para condicionar visibilidade de item, e (achado central desta auditoria) **uma regra de negócio que existe em uma camada e não nas outras**. É exatamente esse descompasso que produz o sintoma "para o cliente parece 100%, mas o processo não sai do lugar".

### As duas causas-raiz mais prováveis para Mizael e Anthony (confirmadas no código)

1. **[CONFIRMADO] "Identidade única" existe só na tela de progresso do cliente, não no gate real de conclusão.**
   O widget que o cliente vê no Portal — `CockpitZ6MeusProcessos`, renderizado em `src/pages/quero-armas/QAClientePortalPage.tsx:4090` — calcula o percentual de progresso (`buildCockpitZ6FromReal` → `src/components/quero-armas/cockpit-z6/buildFromReal.ts:210-219`) aplicando a regra "documento de identidade é único": se o cliente já tem **CNH** aprovada, o item **RG com CPF** (ou CIN) some da lista de pendências e do cálculo de `progressoPct`. Só que essa mesma dedução **não existe** em `qa-processo-etapa-auto-liberar/index.ts` nem em `qa-processo-checar-conclusao-checklist/index.ts` (as duas funções que de fato liberam etapa e promovem o processo a `pronto_para_protocolar`). Resultado prático: o cliente vê "0 pendências"/"100%" no cockpit, mas o item `rg_com_cpf` continua com `status='pendente'` e `obrigatorio=true` no banco — travando a etapa e o processo **para sempre**, sem qualquer sinal visível de por quê. Isso bate exatamente com a queixa relatada: "quando eu acho que está tudo certo, ocorre um problema sem sentido".
   Arquivos: `src/lib/quero-armas/identidadeUnica.ts`, `src/components/quero-armas/cockpit-z6/buildFromReal.ts:210-219`, `supabase/functions/qa-processo-etapa-auto-liberar/index.ts:180-220`, `supabase/functions/_shared/checklistVisibility.ts:62-68`.

2. **[CONFIRMADO — regra de negócio deliberada, mas sem exceção] Documento de identidade só é aceito como PDF com QR Code baixado na Carteira de Documentos do gov.br.**
   `src/lib/quero-armas/identidadePdfQrCode.ts` (regra datada de 01/08/2026) recusa qualquer envio de RG/CIN/CNH que não seja o PDF oficial do gov.br com marcador de QR Code/autenticidade. Foto do documento, digitalização (scan) ou PDF "impresso" não passam. O botão "Salvar documento" fica desabilitado (`bloqueioExtracao()`, `src/components/quero-armas/clientes/ClienteDocsHubModal.tsx:1916-1926`) sem nenhuma via de contorno no client-side — nem para revisão humana. Cliente sem conta gov.br nível Prata/Ouro, ou que só possui RG físico e não sabe emitir o PDF digital, fica **fisicamente impedido de avançar no primeiro item do checklist**, que normalmente bloqueia toda a Etapa 1. É um forte candidato para "não consigo entregar o documento" (não "o documento foi recusado depois", mas "nem consigo salvar").
   Arquivo: `src/lib/quero-armas/identidadePdfQrCode.ts`, `src/components/quero-armas/clientes/ClienteDocsHubModal.tsx:1916-1926, 2833-2884`.

Recomendo, como próximo passo prático fora desta auditoria de código, consultar os registros de Mizael e Anthony em `qa_processo_documentos` (campo `tipo_documento`, `status`, `obrigatorio`) para confirmar qual dos dois padrões (ou ambos) está presente nos dois casos — não tenho acesso a um cliente com permissão de leitura ao banco de produção nesta sessão (só a chave pública/anônima do `.env`), então a confirmação acima é por leitura de código, não por consulta ao dado real.

---

## 2. Quando o sistema usa **parser** e quando usa **IA**

Não existe um fallback simétrico único. Cada função implementa sua própria decisão. Padrão geral observado: **"se um parser determinístico decide, a IA nunca é chamada"** — nunca o inverso (a IA nunca reconfirma o que um parser já aprovou).

| Função (Edge Function) | Parser determinístico? | IA? | Regra de decisão |
|---|---|---|---|
| `qa-processo-doc-upload` | Sim — mas o parser roda **no navegador do cliente** (`leitura_local`) | Só se o parser local não aprovar | Se `leitura_local.aprovado === true`, o documento é gravado como `aprovado` **sem qualquer IA nem revalidação server-side do conteúdo real do arquivo** |
| `ClienteDocsHubModal.tsx` (front-end, "parse-first") | Sim — `pdf.js` + `parseCertidao`/`parseCcmei`/`parseComprovanteEndereco` | Só se o parser local não reconhecer o documento | Mesma filosofia acima, mas para o Hub Documental |
| `qa-classificar-documento-arma` | Sim, em 2 camadas: (1) casamento com "modelo aprovado" da Biblioteca (≥35% cobertura de palavras-chave), (2) regras regex hard-coded (conta de consumo, TJSP, TRF3, contrato, procuração) | Só se nenhum parser bater (`gemini-3-flash-preview`) | Parser sempre tem prioridade; e mesmo quando a IA responde, as regras determinísticas rodam **de novo** sobre o resultado da IA e podem sobrescrevê-lo |
| `qa-extract-documents` / `qa-adesao-classificar-docs` (Central de Adesão) | Parcial — se o PDF tem texto nativo (`unpdf`) com ≥120 caracteres, classifica pelo texto (mais barato/determinístico); senão manda a imagem para IA | Sim (`gemini-2.5-flash`/`gemini-2.5-pro`) | Duas implementações **paralelas e independentes** do mesmo classificador da Central de Adesão — risco de divergência de vocabulário |
| `qa-processo-doc-validar-ia` (núcleo do pipeline) | Só para extrair a camada de texto do PDF (`unpdf`) — quem interpreta os campos é sempre a IA | Sim, sempre (`gemini-2.5-pro` para PDF com texto, `gemini-2.5-flash` para imagem/PDF escaneado) | Não há parser determinístico de campos aqui — só de camada de texto |
| `qa-craf-extrair` / `qa-autorizacao-extrair` | Não | Sim, 100% (`gemini-2.5-flash`), sem fallback | — |
| `qa-extract-cliente-doc` | Não (mas há correções determinísticas pós-IA — ver §7) | Sim, 100% | — |
| `qa-extract-doc-dates` | Não | Sim, 100% (`json_object`, sem function-calling — mais frágil) | Fallback de regex só para extrair JSON de dentro de markdown, não para substituir a IA |
| `qa-declaracao-residencia` | Sim, 100% — validação de assinatura PKCS#7/PAdES | Não | Único ponto do pipeline sem IA nenhuma para a decisão principal |
| `qa-processo-doc-reaproveitar`, `qa-processo-doc-corrigir-saude`, `qa-processo-doc-aceitar-divergencia`, `qa-cadastro-substituir-documento` | Sim, 100% — regras de negócio puras (CRUD/matching) | Não | — |

**Thresholds de confiança da IA** (`qa-processo-doc-validar-ia`, núcleo do pipeline):

- `conf ≥ 0.90` + sem divergência + sem campo faltando → `aprovado` automático
- `conf < 0.70` → `invalido`
- **Qualquer divergência de dados (mesmo severidade baixa)** → `divergente`, nunca aprova automaticamente
- Falha de IA (erro de rede, gateway fora, resposta vazia) → **nunca aprova por presunção**, sempre `revisao_humana`

> **Achado de documentação enganosa:** o comentário no topo de `qa-processo-doc-validar-ia/index.ts` (linha 3) diz que a faixa `0.70–0.89` vai para revisão humana. O código real (linhas 1222-1231) aprova automaticamente qualquer documento com `conf ≥ 0.70` que passe nos demais checks — a banda de revisão humana intermediária só existe hoje para certidões civis com estado civil incompatível. Um revisor que confiar no comentário terá uma visão errada do comportamento real do sistema em produção.

Depois da decisão bruta da IA, uma segunda camada compara o documento com "modelos aprovados" por embedding + cobertura de palavras-chave (thresholds configuráveis por tipo em `qa_validacao_config`) e pode **rebaixar** `aprovado → revisao_humana` (se o tipo não permitir aprovação automática, ou o score for baixo) ou **promover** `revisao_humana → aprovado` (se o score bater fortemente com um modelo já aprovado). Essa camada nunca aprova algo que a IA marcou `invalido`/`divergente`.

---

## 3. Lógica dos pedidos — enumerada (ordem e dependências)

### 3.1 Pré-requisito antes de o checklist sequer existir

Função SQL `qa_confirmar_pagamento_processo` (`supabase/migrations/20260722260000_qa_gate_pipeline_canonico_estrito.sql`) exige, cumulativamente:
1. `pagamento_status = 'confirmado'`
2. Contrato validado (`qa_contracts.status = 'validated'`)
3. Procuração validada ou reaproveitada (`qa_procuracoes.status IN ('validated','reaproveitada')`)

Só depois disso o checklist é "explodido" (`qa_explodir_checklist_processo`) e as linhas de `qa_processo_documentos` são criadas. Se faltar contrato/procuração, o processo fica em `aguardando_assinatura` sem checklist algum — um cliente pode achar que "não tem nada pra enviar" quando na verdade está preso numa etapa anterior.

### 3.2 Três dimensões que decidem QUAIS documentos entram no checklist

Na explosão inicial (`qa_explodir_checklist_processo`), os itens vêm do catálogo `qa_servicos_documentos`, filtrado por:
1. **Serviço contratado** (`servico_id`) — cada produto/serviço tem seu próprio conjunto de documentos.
2. **Condição profissional** (`condicao_profissional` — CLT, autônomo, empresário, aposentado, funcionário público, segurança pública) — só entra item universal (`NULL`) ou da condição escolhida.
3. **Modalidade** (`condicao_modalidade` — ex. CAC caçador/atirador/colecionador) — só entra item sem restrição ou compatível com a modalidade do processo.

Não existe uma quarta dimensão explícita "primeira arma vs. arma adicional" — isso é resolvido por `servico_id` diferente (produto diferente no catálogo).

### 3.3 Sequência por etapa (1 a 5)

1. Comprovação de endereço
2. Condição profissional (renda)
3. Antecedentes criminais
4. Declarações e compromissos
5. Exames técnicos

O campo `etapa_liberada_ate` só avança quando **todos os itens obrigatórios visíveis da etapa atual** estão em status "cumprido" — nunca retrocede sozinho. Duas rotas paralelas fazem esse avanço (achado de duplicação, ver §7.7):
- Sob demanda: `qa-processo-etapa-auto-liberar` (chamada só pelo front-end ao montar tela).
- Automaticamente: trigger SQL `qa_proc_docs_recalc_prazos_upd` em qualquer `UPDATE` de `qa_processo_documentos`.

### 3.4 Dependência entre itens (documento X só aparece se Y for respondido de um jeito)

Hoje só é usada em dois casos reais — comprovante de endereço em nome de terceiro:
- `pergunta_ainda_reside_imovel` só aparece se `comprovante_em_nome_titular = "nao"`.
- `documento_identificacao_terceiro` (identidade do titular do imóvel) só é exigido na mesma condição.
- `declaracao_responsavel_imovel` (assinatura GOV.BR do responsável) é exigida em seguida, com variação de template conforme a resposta.

Essa condicionalidade é escrita **em dois esquemas de JSON diferentes ao mesmo tempo** (`condicional: {depende_de, valor}` achatado E `exige_quando`/`depende_de` aninhado), porque cada camada do sistema só sabe ler um dos dois esquemas (ver achado §7.2). Hoje funciona porque o admin grava os dois; um item novo cadastrado só com um dos esquemas quebraria de forma silenciosa.

### 3.5 Pergunta que pode ou não exigir documento

Alguns itens são "pergunta com gatilho de documento" (`regra_validacao.exige_documento_quando`): dependendo da resposta do cliente (ex. "você já fez o laudo psicológico?"), o upload do arquivo continua sendo exigido na mesma linha do checklist ou é dispensado (`dispensado_grupo`).

### 3.6 Condição profissional — trava de uso exclusivo

`qa-processo-responder-pergunta` bloqueia (HTTP 409) qualquer tentativa de responder a chave `condicao_profissional` fora de `qa-processo-set-condicao` — só esta função sabe reconstruir corretamente os itens `renda_*` compatíveis com a nova condição. Ao trocar a condição, todo item `renda_*` que não estiver `aprovado` é **apagado e recriado** (inclusive itens `em_analise`/`revisao_humana` — ver achado §7.5).

### 3.7 Reaproveitamento (documento já entregue antes)

Documento aprovado em outro processo do mesmo cliente, ou no "Hub" (acervo pessoal), pode satisfazer automaticamente um item do checklist se: escopo compatível (cliente/arma/atividade CAC), tipo compatível (tabela de apelidos, §4.2), não vencido, e o serviço permitir reaproveitamento automático (`modo_reaproveitamento = "automatico"`; senão, fica marcado como "reaproveitamento assistido", exigindo confirmação da equipe).

### 3.8 Quando o checklist é considerado "completo"

`qa-processo-checar-conclusao-checklist` promove `qa_processos.status → 'pronto_para_protocolar'` somente se, simultaneamente:
- `status` atual está em um dos macro-status "promovíveis" (`aguardando_documentos` e variantes — nota: dois status realmente alcançáveis, `pagamento_confirmado` e `em_analise_interna`, **não** estão nessa lista; ver achado §7.8).
- `pagamento_status` (quando setado) é `'confirmado'`.
- **Todo** item obrigatório e visível (segundo `exige_quando`/`depende_de`/`dispensa_quando`) está em status cumprido (aprovado/validado/concluído/dispensado/reaproveitado/etc.) e nenhum está `em_analise`.
- Existe ao menos 1 item obrigatório (lista vazia = recusa, não sucesso vazio).

Essa checagem **não** conhece a regra "identidade única" (achado central, §1) nem é re-executada depois que o processo já virou `pronto_para_protocolar` — se um documento do Hub for reprovado ou vencer depois, o status do processo pode ficar "pronto" desatualizado (achado §7.3).

---

## 4. Todos os documentos possíveis e suas alternativas

### 4.1 Por etapa (visão do cliente)

**Etapa 1 — Identificação e endereço**
- Identidade: **CNH OU CIN OU RG com CPF** — deveriam ser alternativas entre si (ver achado central §1: essa regra só é aplicada visualmente, não no gate de conclusão real)
- Comprovante de residência (por ano/competência, `comprovante_endereco_ano_YYYY`)
- Se o comprovante não está no nome do cliente: pergunta "ainda reside no imóvel" + identidade do titular do imóvel + declaração assinada do responsável pelo imóvel (via gov.br)

**Etapa 2 — Condição profissional (renda)** — documentos variam por condição:
| Condição | Documentos (obrigatórios salvo indicação) |
|---|---|
| CLT | Holerite do mês + CTPS digital + extrato CNIS |
| Autônomo | CCMEI + Cartão CNPJ + QSA + Nota Fiscal emitida ao cliente |
| Empresário | Cartão CNPJ + QSA + NF da empresa + **(Contrato Social OU Requerimento de Empresário OU Ficha Cadastral da Junta)** |
| Aposentado | Comprovante de benefício (CNIS opcional) |
| Funcionário público | Carteira funcional + holerite |
| Segurança pública | Carteira funcional (PM/PC/PF/PRF/bombeiro/guarda/agente penitenciário) + holerite |

**Etapa 3 — Antecedentes criminais** (8 certidões, a maioria SEM alternativa entre si — são exigências cumulativas, não "OU"):
- Certidão de antecedentes — Polícia Civil/SP
- Certidão federal — TRF3 regional
- Certidão federal — TRF3 SJSP/JEF (distinta da anterior)
- Certidão estadual — TJSP distribuição criminal
- Certidão estadual — TJSP execuções criminais (distinta da anterior)
- Certidão militar — STM/União
- Certidão militar estadual — TJM
- Certidão eleitoral — TSE

**Etapa 4 — Declarações e compromissos**
- Declaração de inexistência de inquérito/processo criminal
- Declaração de guarda responsável
- Declaração correlata / compromisso de treino
- Comprovante de habitualidade: **clube de tiro OU competição OU declaração de habitualidade OU compromisso de habitualidade** (alternativas entre si via tabela de apelidos)
- Comprovante de efetiva necessidade (quando aplicável ao serviço)

**Etapa 5 — Exames técnicos**
- Laudo psicológico (validade recalculada pelo sistema como emissão + 1 ano, **ignorando** a data de validade que a IA eventualmente leia do documento — regra determinística deliberada)
- Laudo de capacidade técnica / exame de tiro (mesma regra de validade)

### 4.2 Tabela de alternativas reconhecidas pelo sistema (reaproveitamento Hub → Processo)

| Documento do processo | Satisfeito também por (Hub) |
|---|---|
| `rg_com_cpf` | `cin` |
| `comprovante_endereco_ano_YYYY` | `comprovante_residencia` |
| `certidao_antecedentes_policia_civil_sp` | `antecedentes_criminais` |
| `certidao_crimes_eleitorais_tse` | `antecedentes_eleitoral` |
| `certidao_crimes_militares_stm` | `antecedentes_militar` (só se o texto do documento mencionar STM/União) |
| `certidao_criminal_tjmsp` | `antecedentes_estadual` (só se mencionar TJM/SP) |
| `certidao_federal_trf3_regional` | `antecedentes_federal` |
| `certidao_federal_trf3_sjsp_jef` | `antecedentes_federal` |
| `certidao_tjsp_distribuicao_criminal` | `antecedentes_estadual` |
| `certidao_tjsp_execucoes_criminais` | `antecedentes_estadual` |
| `comprovante_filiacao_entidade_tiro` | `comprovante_clube_tiro` OU `comprovante_habitualidade` |
| `declaracao_habitualidade_clube` | `comprovante_habitualidade` |
| `declaracao_compromisso_habitualidade` | `comprovante_habitualidade` |
| `declaracao_compromisso_treino` | `declaracao_correlata` |
| `renda_nf_empresa` | `renda_nf_recente` |
| `renda_qsa` | `renda_cartao_cnpj` |

### 4.3 "Identidade única" — a alternativa que só existe visualmente

CNH, CIN, RG com CPF, identidade funcional etc. deveriam ser tratados como alternativas mútuas em **todo** o pipeline (só um é necessário). Hoje isso só é verdade na tela `CockpitZ6MeusProcessos` do Portal do Cliente — não no gate de avanço de etapa nem no gate de conclusão do processo. Ver §1 e §7.1.

---

## 5. Simulação de falhas — cenários de teste e causa raiz

Não tenho acesso de escrita/leitura ao banco de produção nesta sessão (só a chave pública do `.env`), então os cenários abaixo foram construídos por **leitura do código-fonte** (edge functions + triggers + componentes), simulando o caminho de execução linha a linha para cada situação. Cada um aponta o arquivo/condição exata que causa o comportamento.

| # | Cenário simulado | O que acontece no sistema | Causa raiz (arquivo/linha) |
|---|---|---|---|
| 1 | Cliente sobe CNH aprovada, nunca envia RG com CPF | Cockpit mostra 0 pendências/100%, mas `rg_com_cpf` fica `pendente` para sempre; etapa 1 nunca libera; processo nunca vira `pronto_para_protocolar` | `identidadeUnica.ts` aplicado só em `buildFromReal.ts:210-219`; ausente em `qa-processo-etapa-auto-liberar/index.ts:180-220` e `_shared/checklistVisibility.ts:62-68` |
| 2 | Cliente envia RG/CIN/CNH como foto ou PDF "impresso" (não o PDF oficial do gov.br) | Botão "Salvar" fica desabilitado, sem opção de mandar para revisão humana | `identidadePdfQrCode.ts` + `bloqueioExtracao()` em `ClienteDocsHubModal.tsx:1916-1926` |
| 3 | Cliente clica 2x rápido em "reenviar" o mesmo documento (ou app mobile faz retry automático) | Duas validações de IA rodam concorrentemente sobre a mesma linha; a resposta que chegar por último "vence" sem checagem de versão — pode sobrescrever uma aprovação manual da equipe com um resultado de IA mais antigo | Nenhum `UPDATE` em `qa_processo_documentos` usa lock otimista; `qa-processo-doc-upload/index.ts` dispara a validação via `EdgeRuntime.waitUntil` (fire-and-forget) |
| 4 | Cliente troca a condição profissional (ex. de "autônomo" para "empresário") enquanto um documento de renda anterior ainda está `em_analise` pela IA | O item de renda em análise é **apagado** (`DELETE`) no meio do processamento; a validação da IA que estava em andamento tenta atualizar uma linha que não existe mais — o resultado se perde silenciosamente | `qa-processo-set-condicao/index.ts:390-394` — só preserva itens `renda_*` com `status='aprovado'`, remove todo o resto |
| 5 | Cliente envia um arquivo, a leitura automática (parser local + IA) falha por instabilidade passageira (timeout de 60s, quota de IA esgotada, `pdf.js` sem memória no navegador) | Botão "Salvar" trava permanentemente — não há opção de "enviar mesmo assim para revisão humana"; cliente só pode tentar outro arquivo, repetidamente, sem saber se o problema é do documento ou do sistema | `bloqueioExtracao()`, `ClienteDocsHubModal.tsx:1916-1926, 5107-5114` — depende de `!classificacao && !conferenciaLocal?.doc` |
| 6 | O arquivo sobe fisicamente para o Storage, mas uma verificação **depois** do upload físico rejeita o documento (ex. titular divergente, duplicidade) | O arquivo fica órfão no bucket `qa-documentos` — sem nenhuma linha em `qa_documentos_cliente` referenciando-o. Se o cliente reclamar "eu já mandei", a equipe não encontra o arquivo em nenhuma tela monitorada | `ClienteDocsHubModal.tsx:3255-3267` (upload físico) roda **antes** das checagens de `iaConfia`/duplicidade nas linhas `3494-3546` |
| 7 | Cadastro interno do cliente tem erro de digitação (nome abreviado, naturalidade diferente) e o documento enviado está fisicamente correto | Certidão/identidade é recusada repetidamente por divergência de nome — mensagem orienta "emita novamente", mas o erro está no **cadastro**, não no documento | `conferenciaCertidao.ts` — comparação caractere-a-caractere (só normaliza acento/caixa), sem tolerância a erro de digitação |
| 8 | Documento aprovado no checklist, e depois esse mesmo documento do Hub vence ou é reprovado em outro fluxo | Uma trigger reabre a exigência (`status='pendente'`) no `qa_processo_documentos` correspondente, **mesmo que** `qa_processos.status` já seja `pronto_para_protocolar` — e o status do processo não é rebaixado nem o cliente/equipe é notificado de novo (só um evento passivo na timeline) | `supabase/migrations/20260801010000_cascata_documento_invalido.sql` (trigger de reabertura) vs. `qa-processo-checar-conclusao-checklist/index.ts:134-136` (nunca revalida um processo já `pronto_para_protocolar`) |
| 9 | Um item do checklist é cadastrado no catálogo (`qa_servicos_documentos.regra_validacao`) usando só o esquema `exige_quando`/`depende_de` (sem o espelho `condicional` achatado) | O item nunca é considerado "oculto" pelo gate de avanço de etapa (`itemBloqueanteEtapa.ts`/`qa-processo-etapa-auto-liberar`), então bloqueia o avanço de etapa mesmo quando deveria estar dispensado | Dois esquemas de JSON paralelos e não sincronizados automaticamente — ver achado §7.2 |
| 10 | Equipe aprova manualmente, pela fila/lista (não pelo drawer detalhado do processo), o último documento pendente de um cliente | O `UPDATE` acontece, a trigger SQL avança a etapa "por acidente", mas **ninguém chama** `qa-processo-checar-conclusao-checklist` — o processo fica com checklist 100% cumprido só no banco, sem virar `pronto_para_protocolar`, sem e-mail de "documentação completa", até alguém abrir a tela certa do processo por outro motivo | `qa-doc-acao-equipe/index.ts` (ações `aprovar`/`rejeitar`/`solicitar_novo_envio`) nunca chama os dois gates de promoção |
| 11 | Cliente resolve a última pendência em outra aba/dispositivo enquanto a aba principal do Portal está aberta em segundo plano | A tela pode não atualizar sozinha — o canal realtime cobre `qa_documentos_cliente`, mas não `qa_processo_documentos` (o checklist do processo em si); quem cobre isso é um polling de 45s que só roda enquanto existir pendência ativa | `QAClientePortalPage.tsx:1214-1227` (realtime) vs. `useVarreduraSilenciosaPendencias.ts` (polling de 45s condicionado a `ativo`) |

---

## 6. Achados de auditoria (ranqueados por impacto no cliente final)

1. **[CRÍTICO — confirmado] "Identidade única" só existe no cockpit visual do cliente, não no gate de conclusão real.** Ver §1 — é a causa-raiz mais provável do tipo de trava relatada para o Mizael.
2. **[CRÍTICO — confirmado] Regra de PDF-com-QR-Code do gov.br para identidade não tem via de exceção no client-side.** Cliente sem acesso ao app/site gov.br fica travado no primeiro item do checklist, sem caminho de revisão humana. Provável causa da dificuldade do Anthony.
3. **[ALTO] Confiança cega em `leitura_local` no `qa-processo-doc-upload`.** O servidor aprova um documento a partir de um payload que o próprio navegador do cliente montou, sem revalidar o conteúdo real do arquivo nem cruzar com o cadastro — o único ponto do pipeline em que a regra "toda divergência é sinalizada" é contornada por completo.
4. **[ALTO] Ausência de lock otimista em qualquer `UPDATE` de `qa_processo_documentos`.** Reenvio duplo (duplo-clique, retry de app) pode gerar duas validações de IA concorrentes, com a resposta mais lenta "vencendo" por último — inclusive podendo sobrescrever uma aprovação manual da equipe.
5. **[ALTO] `qa-processo-set-condicao` apaga documentos "em voo" (em análise) ao trocar a condição profissional**, sem checar se há uma validação de IA em andamento sobre eles — cliente perde o progresso do upload sem aviso (cenário 4, §5).
6. **[MÉDIO] Comentário desatualizado em `qa-processo-doc-validar-ia`** (linha 3 do arquivo) diz que a faixa 0,70–0,89 vai para revisão humana; o código real aprova automaticamente a partir de 0,70 na maioria dos tipos — risco de um revisor confiar no comentário e formar uma visão errada do comportamento em produção.
7. **[MÉDIO] Dois esquemas de JSON diferentes para condicionar visibilidade de item** (`condicional` achatado vs. `exige_quando`/`depende_de`/`dispensa_quando` aninhado), cada um lido por um subconjunto diferente das quatro camadas do sistema. Hoje funciona porque o admin grava os dois; um cadastro futuro com só um dos dois quebra silenciosamente (cenário 9, §5).
8. **[MÉDIO] Promoção a `pronto_para_protocolar` nunca é revalidada.** Documento pode "voltar a pendente" (vencimento, reprovação no Hub) depois que o processo já foi marcado como pronto e o e-mail de "documentação completa" já foi enviado — sem rebaixamento de status nem novo aviso (cenário 8, §5).
9. **[MÉDIO] Ações manuais da equipe (`qa-doc-acao-equipe`) não disparam os gates de promoção.** A promoção de etapa/processo só acontece "por acidente" via trigger SQL, e a notificação final de conclusão só dispara se alguém abrir a tela certa depois (cenário 10, §5).
10. **[MÉDIO] Duplicação de vocabulário e regras de negócio em 4+ lugares** (listas de tipos de documento, `sanitizeArmaModelo`/`isModeloInvalido`, `tipoCompatKey`/`normalizeTipoSelecionado`, classificação "tipo→etapa") — sem módulo compartilhado único. Já há evidência de que isso causou pelo menos um incidente real documentado no próprio código (`qa-cadastro-refinado-persistir-docs`: slugs em maiúsculo rejeitados pela constraint do banco faziam documentos do cadastro refinado se perderem silenciosamente, até ser corrigido).
11. **[BAIXO/OBSERVAÇÃO] Duas rotas públicas sem autenticação chamando IA** (`qa-adesao-classificar-docs`, modo principal de `qa-extract-documents`), sem rate limiting visível — superfície de abuso de custo de IA, não um bug de checklist em si, mas vale nota de segurança.
12. **[BAIXO/OBSERVAÇÃO] `checklistMetrics.ts` (front-end) não inclui `"hub_reaproveitado"`** no conjunto de status "cumprido", enquanto os dois gates de backend incluem — pode fazer a barra de progresso do admin mostrar "incompleto" para um item que o backend já considera satisfeito.
13. **[BAIXO/OBSERVAÇÃO] Falha silenciosa em `qa-declaracao-residencia`**: se o `UPDATE` do comprovante de terceiro falhar depois da declaração já ter sido validada com sucesso, o comprovante fica preso permanentemente em estado incoerente, sem reconciliação automática depois.
14. **[BAIXO/OBSERVAÇÃO] Enum de status de `qa_processos` com valores "mortos" referenciados em código vivo** — `STATUS_PROMOVIVEIS` em `qa-processo-checar-conclusao-checklist` lista valores que não existem mais no `CHECK` da tabela (resquício de um enum anterior), e não inclui dois status hoje realmente alcançáveis (`pagamento_confirmado`, `em_analise_interna`).

---

## 7. Sugestões de melhoria

Nenhuma sugestão abaixo remove ou substitui algo validado — todas são extensões pontuais, compatíveis com a Diretriz Global de Zero Regressão do projeto. Estão em ordem de prioridade sugerida (maior impacto/menor esforço primeiro).

1. **Levar a regra "identidade única" para os dois gates de backend.** Hoje `filtrarIdentidadeUnica` existe só em `identidadeUnica.ts` e é usada pelo cockpit visual. Bastaria importar essa mesma função dentro de `qa-processo-etapa-auto-liberar` e de `_shared/checklistVisibility.ts` (usada por `qa-processo-checar-conclusao-checklist`), aplicando-a sobre a lista de itens antes de decidir o que conta como pendente/obrigatório. Isso resolveria diretamente a causa-raiz mais provável do caso do Mizael, sem alterar nenhuma tela nem a regra de negócio em si — só sincroniza uma regra que já existe e já é usada visualmente.

2. **Dar uma via de exceção operável para a trava de PDF-com-QR-Code do gov.br.** Sem contestar a regra de negócio (que é deliberada e recente), sugiro um botão "não consigo gerar esse PDF — enviar para revisão manual" no `ClienteDocsHubModal`, que salve o arquivo com `status='revisao_humana'` em vez de bloquear o botão de salvar por completo. Isso mantém o rigor da regra como padrão, mas dá uma saída para o cliente que genuinamente não tem acesso ao gov.br nesse nível, sem depender de suporte via WhatsApp/telefone para destravar manualmente.

3. **Unificar os dois esquemas de condição de visibilidade em um só ponto de leitura.** Em vez de reescrever os dois esquemas nos itens já cadastrados (arriscado), criar uma função utilitária única (`normalizarCondicaoVisibilidade`) que leia ambos os formatos e devolva um resultado único, e trocar as quatro camadas para chamarem essa função em vez de reimplementar a leitura cada uma à sua maneira. Elimina a classe de bug do cenário 9 sem mudar dado nenhum já gravado.

4. **Adicionar lock otimista simples (coluna `updated_at`/`versao` + `WHERE`) nos updates de status de `qa_processo_documentos`** feitos por `qa-processo-doc-upload`, `qa-processo-doc-validar-ia` e `qa-processo-doc-reprocessar-cliente`. É uma extensão aditiva (nova coluna + condição no `WHERE`), não quebra nada existente, e elimina a classe de bug do cenário 3.

5. **Antes de apagar itens `renda_*` "em voo" em `qa-processo-set-condicao`, checar se `validacao_ia_status = 'fila'` ou `status = 'em_analise'`** e, nesse caso, adiar a exclusão (ou avisar explicitamente o admin/cliente) em vez de apagar direto. Resolve o cenário 4.

6. **Corrigir o comentário desatualizado em `qa-processo-doc-validar-ia`** (linha 3) para refletir o comportamento real (`conf ≥ 0.70` aprova automaticamente, banda de revisão humana só para certidões civis hoje). Custo zero, remove uma fonte de confusão para quem mantém o sistema.

7. **Fazer `qa-doc-acao-equipe` chamar `qa-processo-etapa-auto-liberar`/`qa-processo-checar-conclusao-checklist` ao final de uma aprovação manual**, do mesmo jeito que `qa-processo-responder-pergunta` já faz. Resolve o cenário 10 sem depender de alguém abrir a tela certa depois.

8. **Adicionar uma verificação periódica (ou trigger) que reavalie processos em `pronto_para_protocolar` quando um documento vinculado for reaberto**, rebaixando o status e reenviando o aviso à equipe (o aviso ao cliente pode ser mais discreto, para não gerar alarme desnecessário). Resolve o cenário 8.

9. **Registrar, no evento de upload físico ao Storage, uma referência mínima (linha "rascunho") em `qa_documentos_cliente` antes das checagens que ainda podem rejeitar o documento**, mesmo que com status `descartado`/`rejeitado_pre_validacao`. Isso elimina o risco de "arquivo órfão no bucket" (cenário 6) e dá à equipe uma forma de localizar o arquivo se o cliente reclamar.

10. **Médio/longo prazo: extrair um módulo único compartilhado de vocabulário de tipos de documento** (`TIPOS_DOCUMENTO`, `tipoCompatKey`, `sanitizeArmaModelo`/`isModeloInvalido`, classificação tipo→etapa) usado por todas as Edge Functions e pelo front-end, em vez das ~4 reimplementações atuais. Este é o único item que exige planejamento maior (toca várias funções), mas reduz estruturalmente o risco de deriva silenciosa que já causou pelo menos um incidente documentado no próprio histórico do código.

---

## 8. Limitações desta auditoria

- Feita 100% por leitura de código-fonte (Edge Functions, migrations SQL, componentes React) — não houve consulta a dados reais de produção (a sessão só tem acesso à chave pública/anônima do Supabase, sem permissão de leitura irrestrita ao banco).
- Os casos do Mizael e do Anthony foram usados como motivação e para validar hipóteses plausíveis à luz do código, mas **não foram confirmados contra o registro real** desses dois clientes. Recomendo, como próximo passo, consultar diretamente `qa_processo_documentos` (campos `tipo_documento`, `status`, `obrigatorio`, `motivo_rejeicao`) e `qa_documentos_cliente` (`ia_dados_extraidos`, `status`) dos dois processos para confirmar qual achado exato se aplica a cada um.
- 706 migrations existem no repositório; a leitura desta auditoria se concentrou nas migrations mais recentes/relevantes ao tema (localizadas por busca textual), não em 100% do histórico.
