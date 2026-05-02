---
name: Etapas de Liberação e Engine de Prazos
description: Sistema de 5 etapas progressivas (endereço→condição profissional→antecedentes→declarações→exames) com auto-cálculo de prazos via IA e trigger SQL
type: feature
---

**Liberação progressiva (qa_processos.etapa_liberada_ate, 1..5):**
- 1=COMPROVAÇÃO DE ENDEREÇO (sempre liberada e categoria padrão "outros")
- 2=CONDIÇÃO PROFISSIONAL (item nativo `renda_definir_condicao` + docs `renda_*` gerados após seleção)
- 3=ANTECEDENTES CRIMINAIS
- 4=DECLARAÇÕES E COMPROMISSOS
- 5=EXAMES TÉCNICOS

**Condição Profissional (Etapa 2):** NÃO existe card fixo nem componente decorativo. O placeholder `renda_definir_condicao` é renderizado como item normal do checklist, com seletor inline (CLT/Autônomo/Empresário/Aposentado/Funcionário Público) que dispara `qa-processo-set-condicao` — esta remove o placeholder e injeta os docs reais de renda (também categoria `condicao_profissional`). Quando todos os `renda_*` ficam aprovados, a etapa 2 é colapsada em "ETAPAS CONCLUÍDAS · CONSULTA".

Mapeamento por `tipo_documento` via SQL `qa_etapa_documento(text)` e mirror no front (`etapaDoTipo` no ProcessoDetalheDrawer). Tanto cliente quanto Equipe veem no checklist principal APENAS a etapa atual (`etapa_liberada_ate`). Etapas anteriores concluídas vão para a seção colapsável "ETAPAS CONCLUÍDAS · CONSULTA". Etapas futuras ficam ocultas. A aba EQUIPE pode manter visão técnica completa.

**Auto-liberação:** trigger `qa_proc_docs_recalc_prazos` chama `qa_recalcular_prazos_processo(uuid)` que sobe `etapa_liberada_ate` quando 100% dos obrigatórios da etapa atual estão `aprovado`/`dispensado_grupo`.

**Override manual:** botão admin "LIBERAR ETAPA N" no header do drawer, registra evento `etapa_liberada_manualmente`.

**Prazos (qa_processo_documentos):**
- `data_emissao`, `proxima_leitura` extraídos pela edge `qa-extract-doc-dates` (Gemini Flash via Lovable AI Gateway, disparada em background no upload do cliente)
- `data_validade_efetiva = min(data_emissao + validade_dias, proxima_leitura)`
- `extracao_ia_status`: pendente|extraido|confirmado|erro

**Tabela central:** `qa_validade_documentos` (override por doc continua via `qa_processo_documentos.validade_dias`). Sementes: certidões federais 90d (Lei 7.115/83), estaduais 30d, comprovante endereço 90d, laudos 365d (Decreto 9.847/19), declarações sem prazo.

**Processo (qa_processos):**
- `prazo_critico_data` / `prazo_critico_doc_id`: menor `data_validade_efetiva` entre docs vivos (status enviado/em_analise/aprovado/divergente/revisao_humana)
- `primeiro_doc_aprovado_em`: timestamp do 1º comprovante de endereço aprovado (relógio do processo começa aqui)

**Bug fix download modelo:** edge function `qa-fill-template-cliente` valida ownership via `qa_clientes.user_id == auth.uid()`. Drawer faz fallback automático staff→cliente em 401/403.

**Slice 2.1 — Aproveitamento do comprovante de endereço (corrigido):**
`qa_aproveitar_endereco_cadastro_publico(uuid)` SÓ vincula o comprovante do cadastro público ao slot `comprovante_endereco_ano_<YYYY>` quando há `data_emissao` real (extraída pela IA em outro doc com mesmo `arquivo_storage_key`) E o ano cai dentro da janela de 5 anos (atual + 4 anteriores) E o slot está vazio. Sem data, fora da janela, ou slot ocupado: NÃO faz nada — o arquivo permanece apenas como original somente leitura no Hub Cliente / Cadastro Público. PROIBIDO criar item auxiliar (`comprovante_endereco_revisao_ano` foi removido) e PROIBIDO presumir ano atual. Evento único: `endereco_cadastro_publico_aproveitado`.

**Slice 2.2 — Resolução de ano de competência:**
- Edge `qa-extract-doc-dates` agora preenche também `ano_competencia` quando o `tipo_documento` casa `comprovante_endereco_ano_\d{4}` e a IA extrai `data_emissao`.
- O tipo `comprovante_endereco_revisao_ano`, a RPC `qa_mover_endereco_revisao_para_ano`, o trigger `qa_trg_revisao_endereco_auto_promover_t` e o botão "DEFINIR ANO" foram REMOVIDOS — não são exigência real e não devem ser recriados.
- Lib pura `src/lib/quero-armas/enderecoAnoEngine.ts` espelha as regras (sem I/O) para testes determinísticos. Ver `enderecoAnoEngine.test.ts` (9 cenários).

**Perguntas-pivot (Etapa 1) — sem default, sem auto-aprovação:**
Perguntas condicionais (`pergunta_comprovante_em_nome`, `pergunta_ainda_reside_imovel`, `pergunta_responde_inquerito_criminal`) têm ciclo PRÓPRIO:
- Estado inicial: `status='pendente'` e `respostas_questionario_json[chave]` ausente → UI mostra "AGUARDANDO SUA RESPOSTA" (badge âmbar) e botões de opção.
- Após clique explícito do cliente: salva `respostas_questionario_json[chave]=valor` PRIMEIRO, depois `status='dispensado_grupo'` (NUNCA `aprovado`/`validado` — pergunta não é documento aprovado, é resposta declarada). Registra evento `pergunta_respondida` com ator/timestamp.
- Trigger SQL `qa_trg_guard_pergunta_resposta` (BEFORE INSERT/UPDATE OF status) bloqueia qualquer tentativa de marcar pergunta-pivot como cumprida sem a chave correspondente em `respostas_questionario_json` (erro `PERGUNTA_SEM_RESPOSTA`). Coalesce/default/fallback "nao" PROIBIDOS.
- Front (`ProcessoDetalheDrawer`) tem defesa em profundidade: `perguntaSemResposta(d)` força `pendente` na UI e no `etapaResumo` mesmo se o status do banco estiver corrompido. Pergunta sem resposta NÃO conta no progresso, NÃO vai para "Exigências cumpridas", NÃO libera próxima etapa.
